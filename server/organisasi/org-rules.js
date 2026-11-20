// Aturan data organisasi (P1): satu medan `role`, satu manajer per divisi, kunci staf/karakter, kontrak data minimum untuk 3D.
// Modul murni: tidak menyentuh berkas maupun store, hanya mengubah objek db yang diberikan. Semua fungsi idempoten.
// Dipakai oleh store.js (migrate), org.js (hire/PATCH), seed.js dan workspace.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** versi skema terakhir; satu-satunya sumber (store.migrate, seed, starterDb) */
export const SCHEMA_VERSION = 12;
export const ROLES = ['owner', 'pa', 'master', 'manager', 'staff', 'extra'];
export const STATUSES = ['working', 'meeting', 'chatting', 'idle', 'offline'];
/** peran yang boleh diubah lewat API; owner/pa/master ditetapkan sistem */
export const API_ROLES = ['manager', 'staff', 'extra'];

const isHuman = (e) => e.type === 'human';
const isAIE = (e) => e.type === 'ai';

// ───────────────────────── katalog staf (hanya nama berkas, tanpa membaca isi) ─────────────────────────
const catalogDir = () => process.env.STAFF_CATALOG_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'staff-catalog');
let idxCache = null, idxAt = 0;
/** { byEmployee: Map(employeeId → kunci utama), keys: Set } dari server/staff-catalog/<divisi>/<divisi>-<karyawan>[-topik].json */
export function catalogIndex({ force = false } = {}) {
  if (!force && idxCache && Date.now() - idxAt < 5000) return idxCache;
  const byEmployee = new Map(), keys = new Set();
  let dirs = [];
  try { dirs = fs.readdirSync(catalogDir(), { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { /* katalog belum ada */ }
  for (const d of dirs) {
    let files = []; try { files = fs.readdirSync(path.join(catalogDir(), d.name)).filter((f) => f.endsWith('.json') && !f.startsWith('_')); } catch { continue; }
    for (const f of files.sort()) {
      const key = f.slice(0, -5);
      if (!key.startsWith(d.name + '-')) continue;
      keys.add(key);
      const rest = key.slice(d.name.length + 1), emp = rest.split('-')[0];
      if (!rest.includes('-') || !byEmployee.has(emp)) byEmployee.set(emp, key);   // kunci utama (tanpa topik) menang
    }
  }
  idxCache = { byEmployee, keys }; idxAt = Date.now();
  return idxCache;
}

// ───────────────────────── peran ─────────────────────────
/** isi dan benahi satu karyawan: karakter, kunci staf, peran, status, suara; hanya menambah/menyeragamkan, tidak pernah mengganti id */
export function stampEmployee(e, { catalog = catalogIndex() } = {}) {
  if (!e || typeof e !== 'object' || !e.id) return e;
  e.characterId = e.id;                                   // karakter 3D = id karyawan, tidak pernah diganti
  if (e.isLead !== true) e.isLead = false;                // boolean pasti, tidak boleh undefined
  if (isHuman(e)) { e.isLead = false; e.role = 'owner'; }
  else {
    if (e.isPA) e.role = 'pa';
    else if (e.isMaster) e.role = 'master';
    else if (e.isLead) e.role = 'manager';
    else if (e.role === 'extra' || e.legacy === true) e.role = 'extra';
    else e.role = 'staff';
  }
  if (isAIE(e) && !e.isPA && !e.isMaster) {
    if (e.staffId === undefined || e.staffId === '') e.staffId = catalog.byEmployee.get(e.id) || null;
    e.workflowId ??= null;
  } else { e.staffId ??= null; e.workflowId ??= null; }
  if (!STATUSES.includes(e.status)) e.status = 'idle';
  if (typeof e.statusText !== 'string') e.statusText = e.status === 'offline' ? 'Offline' : isHuman(e) ? 'Online' : 'Siap bekerja';
  if (e.currentTaskId === undefined) e.currentTaskId = null;
  return e;
}

// ───────────────────────── satu manajer per divisi ─────────────────────────
/** manajer yang boleh: AI, bukan PA. Master hanya bila memang sudah memimpin divisinya (Executive). Manusia tidak pernah. */
const eligible = (e) => isAIE(e) && !e.isPA;

/**
 * Menegakkan: tiap divisi punya paling banyak satu pemimpin (isLead) dan leadId menunjuknya.
 * `prefer` = id karyawan yang baru dijadikan pemimpin (PATCH/hire): ia menang di divisinya.
 * Pemimpin lama diturunkan menjadi staf dan melapor ke pemimpin baru; staf yang melapor ke pemimpin lama pindah ke pemimpin baru.
 * Master/PA tidak dipindah-lapor. Mengembalikan daftar perubahan [{kind,id,...}] untuk dicatat bila perlu.
 */
export function enforceOneManager(db, { prefer = null } = {}) {
  const changes = [];
  const by = new Map(db.employees.map((e) => [e.id, e]));
  for (const e of db.employees) { if (e.isLead !== true) e.isLead = false; if (isHuman(e) || e.isPA) e.isLead = false; }
  for (const d of db.divisions) {
    const inDiv = db.employees.filter((e) => e.divisionId === d.id && eligible(e));
    const flagged = inDiv.filter((e) => e.isLead);
    const cur = by.get(d.leadId);
    const curOk = cur && cur.divisionId === d.id && eligible(cur);
    let keeper = null;
    if (prefer && inDiv.some((e) => e.id === prefer) && by.get(prefer).isLead) keeper = by.get(prefer);
    else if (curOk && cur.isLead) keeper = cur;
    else if (flagged.length) keeper = flagged[0];
    else if (curOk) { keeper = cur; cur.isLead = true; }   // leadId sah tetapi bendera hilang: leadId dipertahankan (tidak mengganggu mesin yang membacanya)
    const oldIds = [...new Set([...(curOk ? [cur.id] : []), ...flagged.map((e) => e.id)])].filter((id) => id !== keeper?.id);
    for (const id of oldIds) {
      const o = by.get(id);
      if (o.isLead) { o.isLead = false; changes.push({ kind: 'demote', id }); }
      if (keeper && o.role !== 'master') {
        const oldBoss = o.reportsTo;
        if (oldBoss !== keeper.id) o.reportsTo = keeper.id;
        if (keeper.reportsTo === o.id) keeper.reportsTo = oldBoss && oldBoss !== keeper.id ? oldBoss : 'aria';
        for (const s of db.employees) if (s.reportsTo === o.id && s.id !== keeper.id && s.id !== o.id && s.divisionId === d.id) s.reportsTo = keeper.id;
      } else if (keeper && o.role === 'master' && keeper.reportsTo === keeper.id) keeper.reportsTo = o.id;
    }
    if (keeper && keeper.reportsTo === keeper.id) keeper.reportsTo = 'aria';
    const newLead = keeper ? keeper.id : null;
    if ((d.leadId ?? null) !== newLead) { changes.push({ kind: 'lead', divisionId: d.id, from: d.leadId ?? null, to: newLead }); d.leadId = newLead; }
  }
  return changes;
}

/** satu langkah rapi: tegakkan satu manajer lalu isi/seragamkan semua karyawan */
export function normalizeOrg(db, opts = {}) {
  const changes = enforceOneManager(db, opts);
  const catalog = catalogIndex();
  for (const e of db.employees) stampEmployee(e, { catalog });
  return changes;
}

/** Master dan PA setara di bawah owner: master yang melapor ke PA dipindah ke pemilik PA itu. Mengembalikan jumlah yang diubah. */
export function flattenMasterBoss(db) {
  let n = 0;
  for (const m of db.employees.filter((e) => e.isMaster)) {
    const pa = db.employees.find((e) => e.isPA && e.id === m.reportsTo);
    if (pa) { m.reportsTo = pa.ownerId || db.employees.find((e) => isHuman(e))?.id || null; n++; }
  }
  return n;
}

/** 42 agen di data Owner yang bukan roster seed dan tidak ada di katalog: ditandai, tidak pernah dihapus. */
export function markLegacy(db, rosterIds, { catalog = catalogIndex() } = {}) {
  const emps = new Set(catalog.byEmployee.keys());
  let n = 0;
  for (const e of db.employees) {
    if (!isAIE(e)) continue;
    const legacy = !e.isPA && !e.isMaster && !rosterIds.has(e.id) && !emps.has(e.id);
    if (legacy) n++;
    if (legacy) e.legacy = true; else if (e.legacy !== true) e.legacy = false;
  }
  return n;
}

// ───────────────────────── kontrak data minimum untuk 3D ─────────────────────────
/** daftar masalah (teks) terhadap kontrak: id stabil, divisionId ada, isLead boolean, status lima nilai, statusText, currentTaskId, voiceGender */
export function contractProblems(db) {
  const out = [], seen = new Set(), divs = new Set(db.divisions.map((d) => d.id));
  for (const e of db.employees) {
    const w = (m) => out.push(`${e.id}: ${m}`);
    if (!e.id || typeof e.id !== 'string') { out.push('karyawan tanpa id'); continue; }
    if (seen.has(e.id)) w('id ganda'); seen.add(e.id);
    if (!divs.has(e.divisionId)) w(`divisionId ${e.divisionId} tidak ada`);
    if (typeof e.isLead !== 'boolean') w('isLead bukan boolean');
    if (!STATUSES.includes(e.status)) w(`status ${e.status}`);
    if (typeof e.statusText !== 'string') w('statusText hilang');
    if (e.currentTaskId === undefined) w('currentTaskId hilang');
    if (!ROLES.includes(e.role)) w(`role ${e.role}`);
    if (e.characterId !== e.id) w('characterId bukan id');
    if (isAIE(e) && e.voiceGender !== 'female' && e.voiceGender !== 'male') w('voiceGender kosong');
  }
  return out;
}

/** aturan manajer: untuk tiap divisi daftar pemimpin AI (isLead) dan apakah leadId cocok */
export function managerProblems(db) {
  const out = [];
  for (const d of db.divisions) {
    const leads = db.employees.filter((e) => e.divisionId === d.id && e.isLead && e.type === 'ai');
    if (leads.length > 1) out.push(`divisi ${d.id}: ${leads.length} pemimpin (${leads.map((e) => e.id).join('+')})`);
    if (leads.length === 1 && d.leadId !== leads[0].id) out.push(`divisi ${d.id}: leadId ${d.leadId} bukan ${leads[0].id}`);
    if (!leads.length && d.leadId) out.push(`divisi ${d.id}: leadId ${d.leadId} tanpa pemimpin`);
  }
  return out;
}
