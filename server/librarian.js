// Knowledge librarian: classifies every note into "<Division>/<Type>", cleans titles, renames with wikilink
// rewrites, merges duplicates, and builds curated training sets. Deterministic (zero tokens); the Knowledge Ops
// agents call the same functions through tools for the judgement calls.
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import { trainingFile } from './collab.js';

const db = () => store.get();
/** Folders that are already curated and stay top-level. */
export const SYSTEM_FOLDERS = new Set(['Company', 'SOP', 'Memori', 'Meetings', 'Playbooks', 'Archive']);
const LOOSE = new Set(['Deliverables', 'Reports', 'Notes', 'Knowledge', 'Approvals', 'Research', 'Marketing', '']);

const TYPES = [
  ['Meeting', /\b(notulen|rapat|meeting|agenda|workshop|standup|retro)\b/i],
  ['Training', /\b(training|pelatihan|dataset|fine-?tun|kurikulum|onboarding karyawan|evaluasi agen)\b/i],
  ['SOP', /\b(sop|prosedur|checklist|panduan|playbook|runbook|guideline|pedoman)\b/i],
  ['Policy', /\b(kebijakan|policy|compliance|kepatuhan|regulasi|bpom|halal|uu pdp|kontrak|legal)\b/i],
  ['Report', /\b(laporan|report|kpi|weekly|mingguan|bulanan|status|ringkasan eksekutif|summary|dashboard)\b/i],
  ['Research', /\b(riset|research|analisis pasar|kompetitor|benchmark|tren|survey|literatur|market)\b/i],
  ['Strategy', /\b(strategi|strategy|okr|swot|porter|roadmap|positioning|business case|skenario|go-to-market|gtm)\b/i],
  ['Plan', /\b(rencana|plan|timeline|milestone|jadwal|kalender|rancang|schedule|mps|forecast)\b/i],
  ['Design', /\b(desain|design|visual|mockup|ui|ux|brand identity|kemasan|packaging|storyboard|render|asset)\b/i],
  ['Content', /\b(konten|content|copy|caption|artikel|naskah|press release|email|post|utm|campaign|kampanye)\b/i],
  ['Analysis', /\b(analisis|analysis|evaluasi|audit|review|perhitungan|hitung|biaya|cost|margin|variance)\b/i],
  ['Data', /\b(data|schema|tabel|spreadsheet|hex|dataset|model data)\b/i],
  ['Technical', /\b(api|arsitektur|architecture|backend|frontend|database|integrasi|deploy|server|flowchart|automate)\b/i],
];

export function classifyType(title, content = '') {
  for (const [type, re] of TYPES) if (re.test(title)) return type;
  const head = String(content).slice(0, 600);
  for (const [type, re] of TYPES) if (re.test(head)) return type;
  return 'Knowledge';
}

/** "Buat kanal Teams "Recruit-Bu... — Aria" → "Buat Kanal Teams Recruit-Bu…". Drops author suffixes, quotes, 'undefined'. */
export function cleanTitle(title, authorName = '') {
  let t = String(title || '').replace(/\bundefined\b|\bnull\b/gi, '').replace(/["“”'`]/g, '').replace(/[[\]|#]/g, '');
  if (authorName) t = t.replace(new RegExp(`\\s*[—–-]\\s*${authorName}\\s*$`, 'i'), '');
  t = t.replace(/\s*[—–-]\s*$/, '').replace(/\s+/g, ' ').trim();
  if (t.length > 90) t = t.slice(0, 88).replace(/\s+\S*$/, '') + '…';
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

const divOf = (id) => db().divisions.find((d) => d.id === id);
const empOf = (id) => db().employees.find((e) => e.id === id);
export function folderFor(divisionId, type) {
  const d = divOf(divisionId);
  return `${d ? d.name : 'Company'}/${type}`;
}

/** Where a task deliverable belongs and what it should be called. */
export function fileDeliverable(e, t, output) {
  const type = t.kind === 'routine' ? 'Report' : classifyType(t.title, output);
  const title = cleanTitle(t.title, e.name) || `${type} ${new Date().toLocaleDateString('id-ID')}`;
  const d = divOf(t.divisionId || e.divisionId);
  return { folder: folderFor(d?.id || e.divisionId, type), title, tags: [d?.short.toLowerCase() || 'umum', type.toLowerCase(), t.kind].filter(Boolean), type };
}

// ───────────────────────── operations ─────────────────────────
const note = (idOrTitle) => db().notes.find((n) => n.id === idOrTitle) || db().notes.find((n) => n.title.toLowerCase() === String(idOrTitle).toLowerCase());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function moveNote(idOrTitle, folder, byId) {
  const n = note(idOrTitle); if (!n) throw new Error(`Catatan "${idOrTitle}" tidak ditemukan`);
  const f = String(folder || '').split('/').map((p) => p.trim()).filter(Boolean).slice(0, 3).join('/');
  if (!f) throw new Error('Folder wajib');
  const from = n.folder; n.folder = f; n.updatedAt = Date.now(); n.lastEditorId = byId;
  store.upsert('notes', n);
  return { id: n.id, title: n.title, from, to: f };
}

export function renameNote(idOrTitle, newTitle, byId) {
  const n = note(idOrTitle); if (!n) throw new Error(`Catatan "${idOrTitle}" tidak ditemukan`);
  const title = cleanTitle(newTitle); if (!title) throw new Error('Judul baru tidak valid');
  if (title.toLowerCase() !== n.title.toLowerCase() && note(title)) throw new Error(`Judul "${title}" sudah dipakai — gunakan merge_notes bila duplikat`);
  const old = n.title; n.title = title; n.updatedAt = Date.now(); n.lastEditorId = byId;
  n.content = n.content.replace(new RegExp(`^# ${esc(old)}\\s*$`, 'm'), `# ${title}`);
  let relinked = 0;
  const re = new RegExp(`\\[\\[${esc(old)}(\\|[^\\]]*)?\\]\\]`, 'gi');
  for (const x of db().notes) if (x.content.includes('[[')) { const c = x.content.replace(re, (_, alias = '') => `[[${title}${alias}]]`); if (c !== x.content) { x.content = c; relinked++; store.upsert('notes', x); } }
  store.upsert('notes', n);
  return { id: n.id, from: old, to: title, relinked };
}

export function mergeNotes(primary, others = [], byId) {
  const p = note(primary); if (!p) throw new Error(`Catatan utama "${primary}" tidak ditemukan`);
  const merged = [];
  for (const o of others) {
    const x = note(o); if (!x || x.id === p.id) continue;
    p.content += `\n\n---\n## Digabung dari: ${x.title}\n${x.content.replace(/^# .*\n?/, '')}`;
    p.tags = [...new Set([...(p.tags || []), ...(x.tags || [])])];
    x.folder = 'Archive'; x.content = `Catatan ini digabung ke [[${p.title}]].`; x.updatedAt = Date.now();
    store.upsert('notes', x); merged.push(x.title);
  }
  p.updatedAt = Date.now(); p.lastEditorId = byId; store.upsert('notes', p);
  return { into: p.title, merged };
}

const words = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((w) => w.length > 2));
function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.max(A.size, B.size); }
const badTitle = (t) => /undefined|null|["“”]| — [A-Z][a-z]+$/.test(t) || t.length > 90;

/** Health report the librarian agents work from. */
export function audit(limit = 25) {
  const notes = db().notes.filter((n) => n.folder !== 'Archive');
  const folders = {};
  for (const n of notes) folders[n.folder] = (folders[n.folder] || 0) + 1;
  const loose = notes.filter((n) => LOOSE.has(n.folder) || (!n.folder.includes('/') && !SYSTEM_FOLDERS.has(n.folder)));
  const bad = notes.filter((n) => badTitle(n.title));
  const dups = [];
  const pool = notes.filter((n) => !SYSTEM_FOLDERS.has(n.folder) || n.folder === 'SOP').slice(-300);
  for (let i = 0; i < pool.length && dups.length < limit; i++) for (let j = i + 1; j < pool.length; j++) if (similar(pool[i].title, pool[j].title) >= 0.75) { dups.push([pool[i].title, pool[j].title]); break; }
  return { total: notes.length, folders, loose: loose.slice(0, limit).map((n) => ({ id: n.id, title: n.title, folder: n.folder, suggested: folderFor(empOf(n.authorId)?.divisionId, classifyType(n.title, n.content)) })), looseCount: loose.length, badTitles: bad.slice(0, limit).map((n) => ({ id: n.id, title: n.title, suggested: cleanTitle(n.title, empOf(n.authorId)?.name) })), duplicates: dups };
}

/** One deterministic pass: file loose notes, fix bad titles, archive empty duplicates. Used by migration and the "Rapikan" button. */
export function autoOrganize(byId = 'arsa') {
  const r = { moved: 0, renamed: 0 };
  for (const n of [...db().notes]) {
    if (n.folder === 'Archive') continue;
    const author = empOf(n.authorId);
    if (badTitle(n.title)) {
      let t = cleanTitle(n.title, author?.name) || cleanTitle(`${classifyType(n.title, n.content)} ${author?.name || ''} ${new Date(n.createdAt || Date.now()).toLocaleDateString('id-ID')}`);
      if (t && t !== n.title) { if (note(t) && note(t).id !== n.id) t = `${t} (${author?.name || n.id.slice(-4)})`; try { renameNote(n.id, t, byId); r.renamed++; } catch { /* keep title */ } }
    }
    if (LOOSE.has(n.folder) || (!n.folder.includes('/') && !SYSTEM_FOLDERS.has(n.folder))) {
      const known = db().divisions.find((d) => d.name.toLowerCase() === n.folder.toLowerCase() || d.short.toLowerCase() === n.folder.toLowerCase());
      moveNote(n.id, folderFor(known?.id || author?.divisionId, classifyType(n.title, n.content)), byId); r.moved++;
    }
  }
  return r;
}

/** Curated JSONL dataset (per division or agent) from collected examples; quality-filtered by reflection scores. */
export function buildTrainingSet({ divisionId, employeeId, minQuality = 7, evalShare = 0.15 } = {}) {
  const emps = db().employees.filter((e) => e.type === 'ai' && (!employeeId || e.id === employeeId) && (!divisionId || e.divisionId === divisionId));
  const rows = [];
  for (const e of emps) {
    const q = e.stats?.qualityN ? e.stats.qualitySum / e.stats.qualityN : null;
    if (q != null && q < minQuality) continue;
    const f = trainingFile(e.id); if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
      try { const ex = JSON.parse(line); const txt = JSON.stringify(ex); if (/\b\d{10,16}\b|@[a-z0-9-]+\.[a-z]{2,}/i.test(txt)) continue; rows.push(ex); } catch { /* skip */ }
    }
  }
  const split = Math.floor(rows.length * (1 - evalShare));
  const name = `${divisionId || employeeId || 'company'}-${new Date().toISOString().slice(0, 10)}`;
  const dir = path.join(process.env.DATA_DIR || path.resolve('data'), 'training', 'sets');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.train.jsonl`), rows.slice(0, split).map((r) => JSON.stringify(r)).join('\n'));
  fs.writeFileSync(path.join(dir, `${name}.eval.jsonl`), rows.slice(split).map((r) => JSON.stringify(r)).join('\n'));
  return { name, agents: emps.length, train: split, eval: rows.length - split };
}
