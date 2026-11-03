// Tiny JSON-file database with change broadcasting. Single process, debounced writes.
import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from './seed.js';
import { SEED_SKILLS, ensureEmployeeConfig, defaultTools, autoActivate, grantUniversalSkills, CAP_IDS } from './catalog.js';
import { personalAssistant } from './roster.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LIMITS = { events: 600, messages: 3000 };

const listeners = new Set();
let db;
let saveTimer = null;

export function load({ reset = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!reset && fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Merge new default settings keys introduced by later versions.
      db.settings = { ...buildSeed().settings, ...db.settings };
      // v2 migration: skill library + layered employee config
      db.skills ??= SEED_SKILLS.map((s) => ({ ...s, createdAt: Date.now() }));
      for (const d of db.divisions) d.delegation ??= 'best_fit';
      for (const e of db.employees) ensureEmployeeConfig(e, db.skills, db.notes);
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
      db.version = 8;
      // Agents that were mid-task when the server stopped resume from todo.
      for (const e of db.employees) if (e.status !== 'offline') Object.assign(e, { status: 'idle', statusText: 'Siap bekerja', currentTaskId: null });
      for (const t of db.tasks) if (t.status === 'in_progress' && isAI(t.assigneeId)) t.status = 'todo';
      saveNow();
      return db;
    } catch (err) {
      console.error('db.json rusak, membuat ulang:', err.message);
      fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now());
    }
  }
  db = buildSeed();
  saveNow();
  return db;
}

export const get = () => db;
export const isAI = (id) => db.employees.find((e) => e.id === id)?.type === 'ai';

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
export function saveNow() {
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
export function broadcast(msg) { for (const fn of listeners) fn(msg); }

export function upsert(coll, item) {
  const arr = db[coll];
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  const limit = LIMITS[coll];
  if (limit && arr.length > limit) arr.splice(0, arr.length - limit);
  save();
  broadcast({ kind: 'upsert', coll, item: coll === 'settings' ? publicSettings() : item });
  return item;
}

export function patch(coll, id, changes) {
  const item = db[coll].find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, changes, { updatedAt: Date.now() });
  return upsert(coll, item);
}

export function remove(coll, id) {
  const i = db[coll].findIndex((x) => x.id === id);
  if (i < 0) return false;
  db[coll].splice(i, 1);
  save();
  broadcast({ kind: 'remove', coll, id });
  return true;
}

export function setRoot(key, value) {
  db[key] = value;
  save();
  broadcast({ kind: 'root', key, value: key === 'settings' ? publicSettings() : value });
}

export function publicSettings() {
  const s = { ...db.settings };
  s.hasApiKey = !!(s.apiKey || process.env.ANTHROPIC_API_KEY);
  s.apiKey = s.apiKey ? '••••' + s.apiKey.slice(-4) : '';
  s.hasGroqKey = !!(s.groqApiKey || process.env.GROQ_API_KEY);
  s.groqApiKey = s.groqApiKey ? '••••' + s.groqApiKey.slice(-4) : '';
  if (s.googleAppsScript) {
    s.googleAppsScript = { ...s.googleAppsScript, secret: s.googleAppsScript.secret ? '••••' + s.googleAppsScript.secret.slice(-4) : '', hasSecret: !!s.googleAppsScript.secret };
  }
  return s;
}

export function snapshot() {
  return { ...db, settings: publicSettings() };
}

let seq = 0;
export const uid = (p = 'x') => `${p}-${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
