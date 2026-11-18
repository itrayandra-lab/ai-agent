// Pemasang: spesifikasi → alur n8n, idempoten dan MALAS (baru dipasang saat staf pertama kali dipakai).
// Urutan: rakit → buat TIDAK AKTIF → uji salinan sementara dengan data contoh (efek keluar diganti pencatat) → hapus salinan → aktifkan.
// Hanya alur berawalan "[RAIVERSE][staf] " yang tercatat di registri kita yang boleh diubah/dihapus; 30 alur milik Owner tidak pernah disentuh.
import crypto from 'node:crypto';
import * as N from '../n8n.js';
import * as store from '../store.js';
import * as C from '../n8n-templates/common.js';
import { compile, testCopy, workflowName, needsAccount, NAME_PREFIX, BLUEPRINT_VERSION } from './blueprint.js';
import { FRAGMENTS } from './fragments.js';
import { ALLOWED_NODE_TYPES, FORBIDDEN_NODE, checkExpect } from './schema.js';
import { ready } from './registry.js';
import { readDeploy, updateDeploy } from './data.js';
import { callHook, StaffError } from './hook.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TABLE = 'raiverse_staf';
// Privasi & keamanan: isian pengguna tidak disimpan di riwayat eksekusi bila sukses (hanya galat disimpan untuk diperbaiki, lalu dipangkas n8n sendiri); batas waktu 90 dtk.
export const STAFF_SETTINGS = { saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 90 };
const locks = new Map();
export const scopeKey = (spec, ws) => `staf:${spec.key}${needsAccount(spec).length ? '@' + ws : ''}`;
const specHash = (spec, extra) => crypto.createHash('sha1').update(JSON.stringify([{ ...spec, __kind: undefined }, BLUEPRINT_VERSION, extra])).digest('hex').slice(0, 16);

/** Pemeriksaan ulang tepat sebelum dikirim ke mesin otomasi (lapis kedua setelah validator). */
export function vetStaffWorkflow(wf) {
  const p = [];
  if (!String(wf.name).startsWith(NAME_PREFIX)) p.push('nama alur tidak berawalan penanda staf');
  for (const n of wf.nodes || []) {
    const short = String(n.type || '').replace(/^n8n-nodes-base\./, '');
    if (!String(n.type).startsWith('n8n-nodes-base.') || FORBIDDEN_NODE.test(short) || !ALLOWED_NODE_TYPES.has(short)) p.push(`simpul "${n.name}" (${short}) tidak diizinkan`);
  }
  return p;
}

// ── tabel data bersama untuk keluaran staf (gratis, tanpa akun luar); baris dipisah per ruang kerja lewat kolom "tenant"
export async function ensureTable() {
  const reg = readDeploy();
  if (reg.tableId) { const ok = await N.request('GET', `/api/v1/data-tables/${reg.tableId}`).then(() => true).catch((e) => e.kind !== 'ditolak'); if (ok) return reg.tableId; }
  const found = ((await N.request('GET', '/api/v1/data-tables?limit=250'))?.data || []).find((t) => t.name === TABLE);
  const t = found || await N.request('POST', '/api/v1/data-tables', { name: TABLE, columns: ['tenant', 'staf', 'runId', 'waktu', 'isi'].map((name) => ({ name, type: 'string' })) });
  updateDeploy((d) => { d.tableId = t.id; }); return t.id;
}

/** Kredensial Google milik ruang kerja ini lewat konektor yang sudah dipasang (rahasia hanya di brankas mesin otomasi). */
async function googleCtx(ws) {
  const g = store.get().settings?.googleAppsScript || {};
  if (!g.url || !g.secret || g.enabled === false) throw new StaffError('Google belum tersambung. Sambungkan Google dulu (cukup sekali), lalu aku lanjutkan.', 'akun', 409);
  const name = `RAIVERSE Google ${ws}`, hash = crypto.createHash('sha256').update(g.secret).digest('hex');
  const reg = readDeploy(); const meta = reg.cred?.[name];
  if (meta?.hash === hash) return { googleUrl: g.url, googleCred: { id: meta.id, name } };
  if (meta?.id) await N.request('DELETE', `/api/v1/credentials/${meta.id}`).catch(() => {});
  const made = await N.request('POST', '/api/v1/credentials', { name, type: 'httpCustomAuth', data: { json: JSON.stringify({ body: { secret: g.secret } }) } });
  updateDeploy((d) => { (d.cred ||= {})[name] = { id: made.id, hash }; });
  return { googleUrl: g.url, googleCred: { id: made.id, name } };
}

/** Uji dengan salinan sementara. Mengembalikan { ms, fase }. Melempar StaffError bila gagal. Salinan selalu dihapus. */
export async function testRun(spec, built) {
  const twinPath = `rv-uji-staf-${C.hex(8)}`, t0 = Date.now();
  const copy = testCopy(built, twinPath);
  const twin = await N.createWorkflow({ name: `${NAME_PREFIX}UJI ${spec.key}`, nodes: copy.nodes, connections: copy.connections, settings: STAFF_SETTINGS });
  try {
    await N.setActive(twin.id, true); await wait(1200);
    const base = { ws: 'uji', user: 'uji', runId: 'uji-' + C.hex(4), staf: spec.key, input: spec.sample.input };
    let res = await callHook(twinPath, { ...base, phase: 'jalankan' }, { timeoutMs: 30_000, retry404: 4 });
    let fase = 1;
    if (res.tahap === 'minta_ai') { if (!res.llm?.prompt) throw new StaffError('Uji gagal: langkah AI tidak menghasilkan permintaan.', 'uji', 422); res = await callHook(twinPath, { ...base, phase: 'selesaikan', state: res.state, llmText: spec.sample.ai }, { timeoutMs: 30_000, retry404: 2 }); fase = 2; }
    const bad = checkExpect(res, spec.sample.expect); if (bad) throw new StaffError(`Uji gagal: ${bad}`, 'uji', 422);
    return { ms: Date.now() - t0, fase, hasil: res };
  } finally { await N.setActive(twin.id, false).catch(() => {}); await N.deleteWorkflow(twin.id).catch(() => {}); }
}

async function owned(item) {
  const wf = await N.getWorkflow(item.n8nId);
  if (!String(wf?.name || '').startsWith(NAME_PREFIX)) throw new StaffError('Ini bukan staf buatan RAIVERSE, jadi tidak boleh diubah dari sini.', 'bukan_milik', 403);
  return wf;
}

/** Pastikan staf terpasang, teruji, dan aktif. Mengembalikan { path, n8nId, scopeKey, baru, ms }. */
export function ensure(spec, ws) {
  if (!ready(spec)) return Promise.reject(new StaffError('Staf ini belum siap dipakai (masih rintisan).', 'belum_siap', 409));
  const key = scopeKey(spec, ws);
  if (locks.has(key)) return locks.get(key);
  const p = doEnsure(spec, ws, key).finally(() => locks.delete(key));
  locks.set(key, p); return p;
}

async function doEnsure(spec, ws, key) {
  const t0 = Date.now(), account = needsAccount(spec);
  const tableId = (spec.steps || []).some((s) => s.use === 'simpan_baris') ? await ensureTable() : null;
  const ctxAccount = account.includes('google') ? await googleCtx(ws) : {};
  const hash = specHash(spec, [tableId, ctxAccount.googleCred?.id || null]);
  let item = readDeploy().items[key];
  if (item?.failedUntil > Date.now()) throw new StaffError(item.failMsg || 'Staf ini sedang diperbaiki. Coba lagi sebentar lagi.', 'uji', 503);
  if (item?.hash === hash && item.n8nId) {
    if (item.verifiedAt && Date.now() - item.verifiedAt < 300_000) return { path: item.path, n8nId: item.n8nId, scopeKey: key, baru: false, ms: 0 };
    const wf = await N.getWorkflow(item.n8nId).catch((e) => (e.kind === 'ditolak' ? null : Promise.reject(e)));   // n8n menjawab "tidak ditemukan" sebagai penolakan 4xx
    if (wf && String(wf.name).startsWith(NAME_PREFIX) && wf.active) { updateDeploy((d) => { d.items[key].verifiedAt = Date.now(); }); return { path: item.path, n8nId: item.n8nId, scopeKey: key, baru: false, ms: 0 }; }
    if (wf && String(wf.name).startsWith(NAME_PREFIX)) { await N.setActive(item.n8nId, true); updateDeploy((d) => { d.items[key].verifiedAt = Date.now(); }); return { path: item.path, n8nId: item.n8nId, scopeKey: key, baru: false, ms: 0 }; }
    item = null;   // alurnya hilang di mesin otomasi: pasang ulang
  }
  const token = item?.token || C.hex(12);
  const built = compile(spec, { token, tableId, ...ctxAccount });
  const wf = { name: workflowName(spec, needsAccount(spec).length ? ws : null), nodes: built.nodes, connections: built.connections, settings: STAFF_SETTINGS };
  const problems = vetStaffWorkflow(wf); if (problems.length) throw new StaffError(`Rakitan ditolak: ${problems[0]}`, 'ditolak', 422);
  let id = item?.n8nId, created = false;
  if (id) { await owned(item); await N.setActive(id, false).catch(() => {}); await N.updateWorkflow(id, wf); }
  else { const c = await N.createWorkflow(wf); id = c.id; created = true; }
  let test;
  try { test = await testRun(spec, built); }
  catch (err) {
    if (created) await N.deleteWorkflow(id).catch(() => {});
    const msg = err instanceof StaffError ? err.message : N.scrub(err.message);
    updateDeploy((d) => { d.items[key] = { ...(d.items[key] || {}), key: spec.key, n8nId: created ? null : id, failedUntil: Date.now() + 60_000, failMsg: msg }; });
    throw err instanceof StaffError ? err : new StaffError(msg, 'uji', 502);
  }
  await N.setActive(id, true);
  const ms = Date.now() - t0;
  updateDeploy((d) => { d.items[key] = { key: spec.key, ws: needsAccount(spec).length ? ws : null, n8nId: id, path: built.path, token, hash, deployedAt: Date.now(), verifiedAt: Date.now(), lastUsed: Date.now(), nodes: built.nodeCount, bytes: JSON.stringify(wf).length, testMs: test.ms, deployMs: ms, twoPhase: built.twoPhase }; });
  return { path: built.path, n8nId: id, scopeKey: key, baru: true, ms };
}

export const touch = (key) => updateDeploy((d) => { if (d.items[key]) d.items[key].lastUsed = Date.now(); });
export const deployed = () => Object.values(readDeploy().items).filter((x) => x.n8nId);

/** Lepas pasang satu staf (nonaktifkan + hapus di mesin otomasi). Hanya yang berawalan penanda dan tercatat. */
export async function retire(key) {
  const item = readDeploy().items[key]; if (!item) return false;
  if (item.n8nId) { try { await owned(item); await N.setActive(item.n8nId, false).catch(() => {}); await N.deleteWorkflow(item.n8nId); } catch (e) { if (e.code !== 404 && e.kind !== 'ditolak') throw e; } }
  updateDeploy((d) => { delete d.items[key]; }); return true;
}
/** Bersihkan staf yang lama tidak dipakai (bawaan 30 hari) supaya mesin otomasi tidak menumpuk. */
export async function retireIdle({ days = 30 } = {}) {
  const cut = Date.now() - days * 864e5; let n = 0;
  for (const [k, it] of Object.entries(readDeploy().items)) if ((it.lastUsed || it.deployedAt || 0) < cut) { if (await retire(k).catch(() => false)) n++; }
  return n;
}
export { FRAGMENTS };
