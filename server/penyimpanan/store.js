// Tiny JSON-file database with change broadcasting. Single process, debounced writes.
import * as config from '../config.js';
import { knowledgeNotes, attachKnowledge } from '../knowledge/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { inferGender } from '../../public/js/tts.js';
import { buildSeed } from '../organisasi/seed.js';
import { SEED_SKILLS, ensureEmployeeConfig, defaultTools, autoActivate, grantUniversalSkills, CAP_IDS } from '../otak/catalog.js';
import { personalAssistant } from '../organisasi/roster.js';
import { systemNotes } from '../pengetahuan/sop.js';
import { ROSTER } from '../organisasi/roster.js';
import { SCHEMA_VERSION, normalizeOrg, flattenMasterBoss, markLegacy, stampEmployee } from '../organisasi/org-rules.js';
import { makeBackup } from '../../scripts/backup-data.mjs';
import * as sq from './store-sqlite.js';

/** v11: the archived demo notes leave the Brain for good. Each one is written as a Markdown file under <project>/arsip-dummy/<original folder>/
 *  (nothing is lost; the files can be read or re-imported any time), then removed from the database. The system SOP goes back to "Sistem". */
function exportArchive(db) {
  // the real server (data/ in the project) exports to <project>/arsip-dummy; tests with their own DATA_DIR export inside it and never touch the project
  const dir = path.resolve(config.get('ARCHIVE_DIR') || (config.has('DATA_DIR') ? path.join(DATA_DIR, 'arsip-dummy') : 'arsip-dummy'));
  const safe = (s) => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'tanpa-judul';
  const keep = [], used = new Set();
  let written = 0;
  for (const n of db.notes) {
    if (!(n.archived && n.kb === 'dummy')) { keep.push(n); continue; }
    const folder = String(n.origFolder || 'Notes').split('/').map(safe).join(path.sep);
    let file = path.join(dir, folder, safe(n.title) + '.md');
    if (used.has(file.toLowerCase())) file = path.join(dir, folder, `${safe(n.title)} (${n.id.slice(-6)}).md`);
    used.add(file.toLowerCase());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\njudul: ${JSON.stringify(n.title)}\nfolder_asal: ${JSON.stringify(n.origFolder || '')}\npenulis: ${JSON.stringify(n.authorId || '')}\ndibuat: ${new Date(n.createdAt || Date.now()).toISOString()}\nstatus: arsip dummy (contoh/rekaan, bukan data asli)\n---\n\n${n.content || ''}\n`);
    written++;
  }
  db.notes = keep;
  for (const n of db.notes) if (n.kb === 'system') n.folder = 'Sistem';
  for (const e of db.employees) { delete e.archivedKnowledgeIds; e.knowledgeIds = (e.knowledgeIds || []).filter((id) => keep.some((n) => n.id === id)); }
  if (written) console.log(`  Arsip Dummy: ${written} catatan disimpan ke ${dir} dan dikeluarkan dari Brain`);
}

/** v10 "fakta bersih": every existing note was demo/invented content. Archive it (readable and restorable, never deleted), detach it from agents,
 *  and start the Brain from the only true knowledge: how the system works. Company facts arrive later from the Owner or Google Drive. */
function cleanSlate(db) {
  for (const n of db.notes) {
    if (n.archived || n.kb === 'system') continue;
    Object.assign(n, { archived: true, kb: 'dummy', origFolder: n.folder || 'Notes', folder: 'Arsip Dummy/' + (n.folder || 'Notes'), pinned: false });
  }
  for (const e of db.employees) if (e.type === 'ai' && (e.knowledgeIds || []).length) { e.archivedKnowledgeIds = e.knowledgeIds; e.knowledgeIds = []; }
  for (const s of systemNotes()) { const have = db.notes.find((n) => n.id === s.id); if (have) Object.assign(have, s); else db.notes.push(s); }
  for (const e of db.employees) if (e.type === 'ai') e.knowledgeIds = [...new Set([...(e.knowledgeIds || []), 'aturan-kejujuran-agen', 'status-data-perusahaan'])];
  db.kbResetAt = Date.now();
}

const DATA_DIR = config.dataDir();
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LIMITS = { events: 600, messages: 3000 };

const listeners = new Set();
let db;
let saveTimer = null;

// ───────────────────────── workspaces (like Discord servers) ─────────────────────────
// Every workspace has its OWN database file. "main" is the original office (data/db.json); others live in data/ws/<id>/db.json.
// The workspace of the current request/job travels with the async call chain (AsyncLocalStorage), so every store.get() in every
// module reads the right workspace without passing ids around, and one workspace can never read another's data.
const ALS = new AsyncLocalStorage();
const WS = new Map([['main', { id: 'main', file: DB_FILE, timer: null, get db() { return db; } }]]);
const wsEntry = () => WS.get(ALS.getStore() || 'main') || WS.get('main');
const cur = () => { const w = wsEntry(); if (!w.db) ensureLoaded(w); return w.db; };
export const current = () => ALS.getStore() || 'main';
/** jalankan fn di dalam ruang kerja; menandai ruang kerja itu "baru dipakai" (untuk pemuatan malas dan pelepasan memori) */
export const run = (wsId, fn) => { const w = WS.get(wsId); if (!w) throw new Error(`Ruang kerja ${wsId} tidak ada`); w.lastTouch = Date.now(); return ALS.run(wsId, fn); };
/** seperti run, tetapi TIDAK menandai ruang kerja aktif: dipakai penjadwal supaya mengintip ruang kerja tidak membuatnya terus aktif */
export const runQuiet = (wsId, fn) => { if (!WS.has(wsId)) throw new Error(`Ruang kerja ${wsId} tidak ada`); return ALS.run(wsId, fn); };
export const ids = () => [...WS.keys()];
export const exists = (wsId) => WS.has(wsId);

// ───────────────────────── P7: penyimpanan (JSON → SQLite) di balik bendera per ruang kerja ─────────────────────────
// Mode per ruang kerja:  json   = perilaku lama (satu db.json, ditulis ulang utuh)            ← bawaan
//                        dual   = JSON tetap sumber kebenaran DAN SQLite ditulis berdampingan; pembanding otomatis membandingkan keduanya
//                        sqlite = SQLite sumber kebenaran (cutover); db.json tidak ditulis lagi (rollback: scripts/storage-migrate.mjs rollback)
// Urutan pemilihan: data/storage-flags.json { default, lazy, ws: { <id>: mode } } → env STORAGE_MODE → "json".
// Bila node:sqlite tidak ada, semuanya diam-diam jatuh ke json.
const FLAGS_FILE = path.join(DATA_DIR, 'storage-flags.json');
export const STORAGE_MODES = ['json', 'dual', 'sqlite'];
let flags = null;
const readFlags = () => { try { flags = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8')); } catch { flags = {}; } flags.ws ||= {}; return flags; };
export function storageMode(id) {
  const f = flags || readFlags();
  const m = f.ws[id] ?? process.env.STORAGE_MODE ?? f.default ?? 'json';
  return STORAGE_MODES.includes(m) && (m === 'json' || sq.available()) ? m : 'json';
}
export function setStorageMode(id, mode, { all = false } = {}) {
  if (!STORAGE_MODES.includes(mode)) throw new Error(`Mode penyimpanan tidak dikenal: ${mode}`);
  if (mode !== 'json' && !sq.available()) throw new Error('node:sqlite tidak tersedia di Node ini');
  const f = readFlags();
  if (all) f.default = mode; else f.ws[id] = mode;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FLAGS_FILE + '.tmp', JSON.stringify(f, null, 1)); fs.renameSync(FLAGS_FILE + '.tmp', FLAGS_FILE);
  return storageMode(id);
}
const lazyOn = () => config.get('STORE_LAZY') || (flags || readFlags()).lazy === true;
const sqlFile = (id) => (id === 'main' ? path.join(DATA_DIR, 'db.sqlite') : path.join(DATA_DIR, 'ws', id, 'db.sqlite'));
const sqlHandle = (w) => (w.h ||= sq.open(sqlFile(w.id)));
const VERIFY_EVERY = config.get('STORE_VERIFY_EVERY');
const SQL_STATS = { dualWrites: 0, sqliteWrites: 0, errors: 0, verifies: 0, mismatches: 0, lastMismatch: null, lastError: null };
export const storageStats = () => ({ ...SQL_STATS, modes: Object.fromEntries(STORAGE_MODES.map((m) => [m, ids().filter((i) => storageMode(i) === m).length])), loaded: [...WS.values()].filter((w) => w.db).length, total: WS.size });

/** baca data mentah satu ruang kerja menurut mode-nya. Mode sqlite yang berkasnya belum berisi data → jatuh ke JSON (impor pertama). null = tidak ada apa pun. */
function readRaw(w) {
  if (storageMode(w.id) === 'sqlite') {
    const h = sqlHandle(w);
    if (sq.hasData(h)) return sq.read(h);   // galat di sini TIDAK dibungkus: berkas sqlite rusak = berhenti, bukan membuat ulang data
  }
  if (!fs.existsSync(w.file)) return null;
  return JSON.parse(fs.readFileSync(w.file, 'utf8'));
}
/** muat satu ruang kerja non-utama dari disk: baca → cadangan bila skema lama → migrate → simpan bila skema berubah */
function loadEntry(w) {
  const data = readRaw(w);
  if (!data) throw new Error('data tidak ditemukan');
  const from = data.version || 1;
  if (from < SCHEMA_VERSION && fs.existsSync(w.file)) backupBeforeMigrate(w.file, from);
  migrate(data);   // jalur yang sama dengan ruang kerja utama (mengisi status/suara/tugas juga)
  w.db = data;
  if (from < SCHEMA_VERSION) saveEntry(w);
}
/** pekerjaan yang harus dijalankan setiap kali sebuah ruang kerja selesai dimuat (di dalam konteksnya); dipakai bila pemuatan malas menyala */
const loadHooks = [];
export const onLoad = (fn) => { loadHooks.push(fn); };
function ensureLoaded(w) {
  try { loadEntry(w); }
  catch (err) { throw new Error(`Ruang kerja ${w.id} gagal dimuat: ${err.message}`); }
  for (const fn of loadHooks) { try { ALS.run(w.id, fn); } catch (err) { console.error(`[ruang kerja ${w.id}] pengait muat gagal:`, err.message); } }
}
/** keadaan aktivitas satu ruang kerja untuk penjadwal */
export function activity(id) { const w = WS.get(id); return w ? { loaded: !!w.db, lastTouch: w.lastTouch || 0, busy: !!w.busy, wakeAt: w.wakeAt || 0, ticks: w.ticks || 0 } : null; }
export function setActivity(id, p) { const w = WS.get(id); if (w) Object.assign(w, p); }
/** lepas dari memori ruang kerja non-utama yang sudah lama tidak dipakai dan tidak sibuk (data disimpan dulu). Hanya berlaku bila pemuatan malas menyala. */
export function evictIdle({ idleMs = config.get('STORE_IDLE_MS'), now = Date.now(), hold = () => false } = {}) {
  if (!lazyOn()) return 0;
  let n = 0;
  for (const w of WS.values()) {
    if (w.id === 'main' || !w.db || w.busy || now - (w.lastTouch || 0) < idleMs || hold(w.id)) continue;
    clearTimeout(w.timer); w.timer = null;
    try { saveEntry(w); } catch (err) { console.error(`[ruang kerja ${w.id}] gagal disimpan saat dilepas, tetap di memori:`, err.message); continue; }
    if (w.h) { sq.close(w.h); w.h = null; }
    w.db = null; n++;
  }
  return n;
}
export const isLazy = lazyOn;
/** voice gender of every AI agent, guessed once from its name; never overwrites a value that is already there (edit the data to correct a name) */
export function fillVoiceGender(list) { let n = 0; for (const e of list || []) if (e && e.type === 'ai' && e.voiceGender !== 'female' && e.voiceGender !== 'male') { e.voiceGender = inferGender(e.name || e.id); n++; } return n; }
const wsFile = (id) => path.join(DATA_DIR, 'ws', id, 'db.json');
/** read every saved workspace at boot (main is loaded by load()) */
export function loadWorkspaces() {
  const dir = path.join(DATA_DIR, 'ws');
  if (!fs.existsSync(dir)) return [];
  const lazy = lazyOn();
  for (const id of fs.readdirSync(dir)) {
    const file = wsFile(id);
    if (!/^[\w-]{3,40}$/.test(id) || !(fs.existsSync(file) || fs.existsSync(sqlFile(id)))) continue;
    const w = { id, file, timer: null, db: null, lastTouch: 0 };
    if (lazy) { WS.set(id, w); continue; }   // pemuatan malas: hanya didaftarkan, dibaca saat pertama dipakai
    try { loadEntry(w); WS.set(id, w); }
    catch (err) { console.error(`[ruang kerja ${id}] gagal dimuat:`, err.message); if (w.h) sq.close(w.h); }
  }
  return ids();
}
/** a brand-new workspace with its own database */
export function createWorkspace(id, data) {
  if (!/^[\w-]{3,40}$/.test(id) || WS.has(id)) throw new Error('ID ruang kerja tidak valid atau sudah ada');
  fs.mkdirSync(path.dirname(wsFile(id)), { recursive: true });
  WS.set(id, { id, file: wsFile(id), timer: null, db: data, lastTouch: Date.now() });
  ALS.run(id, () => saveNow());
  return id;
}

/** Satu-satunya jalur migrasi: dipakai load() untuk ruang kerja utama DAN loadWorkspaces() untuk semua ruang kerja lain.
 *  Idempoten (dua kali jalan = hasil sama), hanya menambah/menyeragamkan, tidak pernah menghapus atau mengganti id. Tidak menulis berkas. */
export function migrate(db) {
    // Merge new default settings keys introduced by later versions.
    db.settings = { ...buildSeed().settings, ...db.settings };
    // v2 migration: skill library + layered employee config
    db.skills ??= SEED_SKILLS.map((s) => ({ ...s, createdAt: Date.now() }));
    for (const d of db.divisions) d.delegation ??= 'best_fit';
    for (const e of db.employees) ensureEmployeeConfig(e, db.skills, db.notes);
    fillVoiceGender(db.employees);
    // v3 migration: meetings, personal assistants, master orchestrator, new capabilities
    db.meetings ??= [];
    if ((db.version || 1) < 3) {
      for (const e of db.employees) if (e.type === 'ai') e.tools = [...new Set([...(e.tools || []), ...defaultTools(e)])];
      const master = db.employees.find((e) => e.id === 'aria');
      if (master) Object.assign(master, { isMaster: true, title: 'AI Master Orchestrator' });
      for (const h of db.employees.filter((e) => e.type === 'human')) if (!db.employees.some((e) => e.isPA && e.ownerId === h.id)) db.employees.push(ensureEmployeeConfig(personalAssistant(h), db.skills, db.notes));
      if (master) master.reportsTo = 'pa-owner';
    }
    // v4 migration: Ray Beauty divisions, specialist roles, extra skills/knowledge, cron routines
    if ((db.version || 1) < 4) {
      const seed = buildSeed();
      for (const coll of ['skills', 'divisions', 'notes', 'routines', 'channels']) for (const x of seed[coll]) if (!db[coll].some((y) => y.id === x.id)) db[coll].push(x);
      for (const x of seed.employees) if (!db.employees.some((y) => y.id === x.id)) db.employees.push(x);
    }
    // v5 migration: teams, Knowledge & AI Ops, deep skills, auto-activated tools, Brain re-filing (done in index.js)
    if ((db.version || 1) < 5) {
      const seed = buildSeed();
      for (const coll of ['skills', 'divisions', 'notes', 'routines', 'channels']) for (const x of seed[coll]) if (!db[coll].some((y) => y.id === x.id)) db[coll].push(x);
      for (const x of seed.employees) if (!db.employees.some((y) => y.id === x.id)) db.employees.push(x);
      for (const d of db.divisions) d.teams ??= seed.divisions.find((s) => s.id === d.id)?.teams || [];
      for (const e of db.employees) { const s = seed.employees.find((x) => x.id === e.id); if (s?.team && !e.team) e.team = s.team; if (e.type === 'ai') autoActivate(e, db.skills); }
      db.needsOrganize = true;
    }
    // v6 migration: universal skill/tool access + repair known strict-tool failures.
    if ((db.version || 1) < 6) {
      for (const e of db.employees.filter((x) => x.type === 'ai')) {
        grantUniversalSkills(e, db.skills);
        e.tools = [...CAP_IDS];
      }
      // Keep exactly one global five-minute self-learning job. Older agents
      // created several equivalent schedules, which multiplied cost and errors.
      const noisy = db.routines.filter((r) => r.enabled && (/self.?learning|update knowledge|knowledge update/i.test(`${r.title} ${r.description}`)) && (r.cron === '*/5 * * * *' || Number(r.everyMinutes) === 5));
      if (noisy.length) {
        const keep = noisy.find((r) => r.id === 'r-mw04a0t9n3lb6') || noisy[0];
        Object.assign(keep, {
          title: 'Self-Learning Knowledge Update — Semua Agen',
          description: 'Audit perubahan pengetahuan terbaru, pilih pembaruan yang benar-benar relevan, validasi sumber, simpan ringkasan ke Brain, lalu selesaikan dengan laporan singkat. Jangan membuat job atau subtugas baru.',
          cron: '*/5 * * * *', everyMinutes: 0, employeeId: 'pustaka', enabled: true,
        });
        for (const r of noisy) if (r.id !== keep.id) { r.enabled = false; r.disabledReason = `Digabung ke ${keep.id} pada migrasi v6`; }
      }
      const repairable = /Agen berhenti tanpa menyelesaikan tugas|attempted to call tool|did not match schema/i;
      for (const t of db.tasks.filter((x) => x.status === 'blocked')) {
        const lastErrors = (t.log || []).filter((x) => x.type === 'error').slice(-3).map((x) => x.text).join(' ');
        if (repairable.test(lastErrors)) {
          t.status = 'todo'; t.failures = 0; t.updatedAt = Date.now();
          (t.log ||= []).push({ t: Date.now(), actorId: 'system', type: 'resumed', text: 'Dicoba ulang setelah perbaikan engine v6' });
        }
      }
    }
    // v7: scoped mass routines, automatic approval, and resilient learning defaults.
    if ((db.version || 1) < 7) {
      db.settings.autoApprove ??= true;
      db.settings.massDispatchSize ??= 20;
      for (const r of db.routines) {
        r.targetType ??= 'employee';
        r.targetId ??= r.employeeId;
      }
    }
    // v8: verified Google execution, efficient company-wide cadence, and
    // owner-led meeting controls.
    if ((db.version || 1) < 8) {
      db.settings.googleAppsScript ??= { url: '', secret: '', enabled: false };
      for (const e of db.employees.filter((x) => x.type === 'ai')) e.tools = [...CAP_IDS];
      for (const r of db.routines.filter((x) => /self.?learning|knowledge update|update knowledge/i.test(`${x.title} ${x.description}`) && (x.cron === '*/5 * * * *' || Number(x.everyMinutes) === 5))) {
        Object.assign(r, { title: 'Self-Learning Knowledge Update — Terverifikasi', description: 'Audit kegagalan dan hasil terbaru, validasi fakta, bagikan satu perbaikan ke Playbook serta channel Knowledge & AI Ops. Jangan membuat jadwal atau subtugas baru.', cron: '30 18 * * 1-5', everyMinutes: 0, employeeId: 'pustaka', targetType: 'employee', targetId: 'pustaka' });
      }
      db.divisions.forEach((d, i) => {
        const id = `r-execute-${d.id}`;
        if (db.routines.some((r) => r.id === id)) return;
        const lead = db.employees.find((e) => e.id === d.leadId) || db.employees.find((e) => e.type === 'ai' && e.divisionId === d.id);
        if (!lead) return;
        db.routines.push({ id, employeeId: lead.id, targetType: 'division', targetId: d.id, title: `Eksekusi nyata harian — ${d.name}`, description: 'Periksa tugas dan prioritas divisi. Pilih satu tindakan konkret bernilai tertinggi yang belum selesai, konsultasikan maksimal dua staf relevan, eksekusi memakai tool yang tersedia, lalu kirim hasil dan bukti ke channel divisi. Untuk Google/sistem eksternal, hasil hanya boleh disebut berhasil jika ada receipt ID/URL/range; bila konektor belum aktif tulis BELUM TEREKSEKUSI. Bagikan satu pelajaran untuk tim.', cron: `${(5 + i * 7) % 60} ${9 + Math.floor(i / 8)} * * 1-5`, everyMinutes: 0, enabled: true, lastRunAt: Date.now(), createdBy: 'system-v8' });
      });
    }
    // v9: studio divisions (Content Studio, BizDev, Retail), their agents, teams and skills reach live data
    if ((db.version || 1) < 9) {
      const seed = buildSeed();
      for (const coll of ['skills', 'divisions', 'channels']) for (const x of seed[coll]) if (!db[coll].some((y) => y.id === x.id)) db[coll].push(x);
      for (const d of db.divisions) if (!d.teams?.length) d.teams = seed.divisions.find((s) => s.id === d.id)?.teams || [];
      for (const x of seed.employees) {
        const have = db.employees.find((y) => y.id === x.id);
        if (!have) db.employees.push(x); else if (!have.team) have.team = x.team || null;
      }
      attachKnowledge(db.employees, db.notes);
    }
    if ((db.version || 1) < 10) cleanSlate(db);
    if ((db.version || 1) < 11) exportArchive(db);
    else for (const s of systemNotes()) if (!db.notes.some((n) => n.id === s.id)) db.notes.push(s);   // the system SOP is always there
    if (!db.kbResetAt && !db.notes.some((n) => n.folder?.startsWith('Knowledge Library'))) { for (const n of knowledgeNotes()) if (!db.notes.some((y) => y.id === n.id)) db.notes.push(n); attachKnowledge(db.employees, db.notes); }
    for (const e of db.employees) if (e.type === 'ai' && !e.team && !e.isLead && !e.isPA && !e.isMaster) e.team = db.divisions.find((d) => d.id === e.divisionId)?.teams?.[0] || null;
    // v12 (P1): peran tunggal `role`, staffId/workflowId/characterId, tanda legacy, satu manajer per divisi, master setara PA di bawah owner. Hanya menambah.
  if ((db.version || 1) < 12) {
    flattenMasterBoss(db);
    markLegacy(db, new Set(ROSTER.map((r) => r.id)));
  }
  normalizeOrg(db);   // idempoten: aman dijalankan tiap muat, memulihkan kontrak data bila ada yang miring
  db.version = SCHEMA_VERSION;
    // Agents that were mid-task when the server stopped resume from todo.
    for (const e of db.employees) if (e.status !== 'offline') Object.assign(e, { status: 'idle', statusText: 'Siap bekerja', currentTaskId: null });
    for (const t of db.tasks) if (t.status === 'in_progress' && db.employees.find((e) => e.id === t.assigneeId)?.type === 'ai') t.status = 'todo';
    fillVoiceGender(db.employees);   /* after every migration, so agents added by a migration get one too */
  return db;
}

let fullBackupDone = false;
/** SEBELUM migrasi menulis: cadangan penuh P0 (sekali per proses) + salinan berkas ini ke <berkas>.bak-v<versi>-<cap-waktu>. Gagal mencadangkan = migrasi dibatalkan. */
function backupBeforeMigrate(file, from) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  if (!fullBackupDone) {
    fullBackupDone = true;
    try { makeBackup({ dataDir: DATA_DIR, label: `pra-migrasi-v${SCHEMA_VERSION}` }); }
    catch (err) { if (!/sudah ada/.test(err.message)) console.error('[cadangan penuh] dilewati:', err.message); }
  }
  let dst = `${file}.bak-v${from}-${stamp}`;
  for (let n = 1; fs.existsSync(dst); n++) dst = `${file}.bak-v${from}-${stamp}-${n}`;
  fs.copyFileSync(file, dst);
  return dst;
}

export function load({ reset = false } = {}) {
  if (current() !== 'main') {
    const w = wsEntry();
    if (reset) { w.db = buildSeed(); fillVoiceGender(w.db.employees); saveNow(); }
    return w.db;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!reset && storageMode('main') === 'sqlite') {
    // cutover: SQLite sumber kebenaran. Berkas rusak = galat (tidak pernah membuat ulang data); belum ada isi = jatuh ke impor dari db.json di bawah
    const mw = WS.get('main'), h = sqlHandle(mw);
    if (sq.hasData(h)) {
      const parsed = sq.read(h), from = parsed.version || 1;
      db = parsed; migrate(db); saveNow();
      return db;
    }
  }
  if (!reset && fs.existsSync(DB_FILE)) {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (err) {
      console.error('db.json rusak, membuat ulang:', err.message);
      fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now());
    }
    if (parsed) {
      // Berkas terbaca: kegagalan migrasi TIDAK boleh membuat ulang data (berhenti dengan galat; cadangan sudah ada).
      const from = parsed.version || 1;
      if (from < SCHEMA_VERSION) backupBeforeMigrate(DB_FILE, from);
      db = parsed;
      migrate(db);
      saveNow();
      return db;
    }
  }
  db = buildSeed();
  fillVoiceGender(db.employees);
  saveNow();
  return db;
}

export const get = () => cur();
/** bendera P0 `settings.staffModel` (staf = workflow n8n); hanya `true` murni yang menyalakan, selain itu perilaku lama. wsId kosong = ruang kerja aktif */
export function staffModelOn(wsId) {
  const d = wsId ? WS.get(wsId)?.db : cur();
  return d?.settings?.staffModel === true;
}

export function save() {
  const w = wsEntry();
  clearTimeout(w.timer);
  w.timer = setTimeout(() => saveEntry(w), 400);
}
export function saveNow() { const w = wsEntry(); clearTimeout(w.timer); saveEntry(w); }
/** save every workspace now (shutdown) */
export function saveAll() { for (const w of WS.values()) { clearTimeout(w.timer); if (w.db) saveEntry(w); } }
/** P7 retensi: batas jumlah (cincin) yang juga berlaku untuk jalur yang menambah langsung tanpa upsert; log tugas dipangkas ke yang terbaru */
const LOG_CAP = config.get('STORE_TASK_LOG_CAP');
export function capCollections(d) {
  let cut = 0;
  for (const [k, n] of Object.entries(LIMITS)) if (Array.isArray(d[k]) && d[k].length > n) { cut += d[k].length - n; d[k].splice(0, d[k].length - n); }
  if (Array.isArray(d.tasks)) for (const t of d.tasks) if (Array.isArray(t.log) && t.log.length > LOG_CAP) { cut += t.log.length - LOG_CAP; t.log.splice(0, t.log.length - LOG_CAP); }
  return cut;
}
/** biaya AI hari ini sebuah ruang kerja TANPA memuatnya (untuk anggaran global): yang dimuat dibaca langsung, yang dilepas memakai catatan terakhir */
export function costToday(id, today) {
  const w = WS.get(id); if (!w) return 0;
  const u = w.db ? w.db.usage : null;
  if (u) return u.day === today ? u.costToday || 0 : 0;
  return w.cost && w.cost.day === today ? w.cost.v : 0;
}
function saveEntry(w) {
  if (!w.db) return;   // sudah dilepas dari memori (tidak ada yang perlu disimpan)
  capCollections(w.db);
  if (w.db.usage) w.cost = { day: w.db.usage.day, v: w.db.usage.costToday || 0 };
  const mode = storageMode(w.id);
  if (mode !== 'sqlite') writeJson(w);   // json/dual: JSON tetap sumber kebenaran dan ditulis lebih dulu
  if (mode === 'json') return;
  try {
    sq.write(sqlHandle(w), w.db);
    SQL_STATS[mode === 'dual' ? 'dualWrites' : 'sqliteWrites']++;
    if (mode === 'dual') { w.saves = (w.saves || 0) + 1; if (w.saves === 1 || (VERIFY_EVERY > 0 && w.saves % VERIFY_EVERY === 0)) verifyEntry(w); }
  } catch (err) {
    SQL_STATS.errors++; SQL_STATS.lastError = `${w.id}: ${err.message}`;
    if (mode === 'sqlite') throw err;   // sumber kebenaran gagal menulis: jangan pura-pura berhasil
    console.error(`[ruang kerja ${w.id}] tulis SQLite gagal (JSON tetap benar):`, err.message);
  }
}
/** pembanding otomatis (mode dual): baca ulang JSON dan SQLite dari disk lalu bandingkan isi logisnya per kunci */
export function verifyEntry(w) {
  SQL_STATS.verifies++;
  try {
    const a = JSON.parse(fs.readFileSync(w.file, 'utf8'));
    const h2 = sq.open(sqlFile(w.id));
    let b; try { b = sq.read(h2); } finally { sq.close(h2); }
    const bad = sq.diffKeys(a, b);
    if (bad.length) { SQL_STATS.mismatches++; SQL_STATS.lastMismatch = { ws: w.id, keys: bad, at: Date.now() }; console.error(`[ruang kerja ${w.id}] PEMBANDING: JSON dan SQLite berbeda pada: ${bad.join(', ')}`); }
    return bad;
  } catch (err) { SQL_STATS.errors++; SQL_STATS.lastError = `${w.id}: pembanding ${err.message}`; return ['(galat pembanding)']; }
}
/** untuk skrip dan tes: bandingkan satu ruang kerja yang sedang dimuat */
export const verifyWorkspace = (wsId) => verifyEntry(WS.get(wsId));
function writeJson(w) {
  const DB_FILE = w.file, db = w.db;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { fs.renameSync(tmp, DB_FILE); return; }
    catch (err) {
      lastError = err;
      if (!['EPERM', 'EACCES', 'EEXIST'].includes(err.code)) throw err;
      // Antivirus/indexers can briefly hold db.json on Windows.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (attempt + 1));
    }
  }
  try {
    fs.copyFileSync(tmp, DB_FILE);
    fs.unlinkSync(tmp);
  } catch (err) {
    throw new Error(`Gagal menyimpan database setelah retry: ${err.message}; rename awal: ${lastError?.message}`);
  }
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** every change is tagged with its workspace, so the stream only reaches people inside that workspace (msg.all = everyone, e.g. host stats) */
export function broadcast(msg) { if (!msg.all && !msg.ws) msg.ws = current(); for (const fn of listeners) fn(msg); }

export function upsert(coll, item) {
  const db = cur();
  const arr = db[coll];
  if (coll === 'employees') { fillVoiceGender([item]); stampEmployee(item); }
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  const limit = LIMITS[coll];
  if (limit && arr.length > limit) arr.splice(0, arr.length - limit);
  save();
  broadcast({ kind: 'upsert', coll, item: coll === 'settings' ? publicSettings() : item });
  return item;
}

export function patch(coll, id, changes) {
  const item = cur()[coll].find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, changes, { updatedAt: Date.now() });
  return upsert(coll, item);
}

export function remove(coll, id) {
  const db = cur();
  const i = db[coll].findIndex((x) => x.id === id);
  if (i < 0) return false;
  db[coll].splice(i, 1);
  save();
  broadcast({ kind: 'remove', coll, id });
  return true;
}

export function setRoot(key, value) {
  cur()[key] = value;
  save();
  broadcast({ kind: 'root', key, value: key === 'settings' ? publicSettings() : value });
}

export function exportSettings() {
  const s = structuredClone(cur().settings);
  s.apiKey = ''; s.groqApiKey = '';
  if (s.googleAppsScript) s.googleAppsScript.secret = '';
  if (s.mcpServers) s.mcpServers = s.mcpServers.map(m => ({ ...m, url: '', headers: {} }));
  return s;
}
export function publicSettings() {
  const s = { ...cur().settings };
  s.hasApiKey = !!(s.apiKey || process.env.ANTHROPIC_API_KEY);
  s.apiKey = s.apiKey ? '••••' + s.apiKey.slice(-4) : '';
  s.hasGroqKey = !!(s.groqApiKey || process.env.GROQ_API_KEY);
  s.groqApiKey = s.groqApiKey ? '••••' + s.groqApiKey.slice(-4) : '';
  if (s.googleAppsScript) {
    s.googleAppsScript = { ...s.googleAppsScript, secret: s.googleAppsScript.secret ? '••••' + s.googleAppsScript.secret.slice(-4) : '', hasSecret: !!s.googleAppsScript.secret };
  }
  if (s.mcpServers) s.mcpServers = s.mcpServers.map(m => ({ ...m, headers: {}, url: '', configured: !!m.url }));
  return s;
}

export function snapshot() {
  return { ...cur(), settings: publicSettings() };
}

let seq = 0;
export const uid = (p = 'x') => `${p}-${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
