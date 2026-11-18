// Pelari: menjalankan satu staf. Validasi isian → izin → kuota → pasang malas → panggil alur → (langkah AI lewat gerbang server) → hasil → Brain.
// Tidak ada kunci AI di mesin otomasi: langkah AI dijalankan di SINI lewat server/llm.js sehingga biaya, batas, dan model tetap diatur governor.
import crypto from 'node:crypto';
import * as store from '../store.js';
import * as engine from '../engine.js';
import * as llm from '../llm.js';
import * as gov from '../governor.js';
import * as brain from '../brain.js';
import * as browser from '../browser.js';
import * as C from '../n8n-templates/common.js';
import * as N from '../n8n.js';
import * as registry from './registry.js';
import * as deployer from './deployer.js';
import { normalizeInput, InputError, FILE_KINDS } from './schema.js';
import { callHook, StaffError } from './hook.js';
import { saveRun, findRun, runsOf, writeFiles, readFile, cleanFileName, appendRow, filesOf } from './data.js';
import * as native from './native.js';

const db = () => store.get();
export const LIMITS = { perHour: 40, concurrent: 3, timeoutMs: 60_000, maxFiles: 6, maxFileBytes: 300_000, maxTotalBytes: 600_000, nativePerDay: 2000, otakPerDay: 200 };
export const limits = () => ({ ...LIMITS, ...(db().settings?.staf || {}) });
const busy = new Map();   // employeeId → jumlah jalan bersamaan (agar status 3D kembali benar)
const emp = (id) => db().employees.find((e) => e.id === id) || null;

const clip = (s, n) => String(s ?? '').slice(0, n);
const viewRun = (r) => ({ id: r.id, status: r.status, staf: { kunci: r.staf, nama: r.nama }, karyawan: r.employeeId, ringkas: r.ringkas || '', teks: r.teks || '', berkas: r.berkas || [], data: r.data || null, pesan: r.pesan || '', galat: r.galat || '', mesin: r.mesin || 'n8n', catatan: r.catatan || '', pakaiAI: r.pakaiAI ?? null, ms: r.ms || 0, biaya: r.biaya || 0, mulai: r.startedAt, selesai: r.endedAt || null });

function setWorking(e, text) {
  if (!e) return; busy.set(e.id, (busy.get(e.id) || 0) + 1);
  engine.setStatus(e, 'working', text, e.currentTaskId);
}
function setDone(e, ok) {
  if (!e) return; const n = Math.max(0, (busy.get(e.id) || 1) - 1); busy.set(e.id, n); if (n) return;
  engine.setStatus(e, e.currentTaskId ? 'working' : 'idle', e.currentTaskId ? (ok ? 'Menyusun hasil staf' : 'Melanjutkan setelah kendala') : 'Siap bekerja', e.currentTaskId);
}

/** Langkah AI lewat gerbang: satu panggilan, dibatasi token, selalu lewat llm.js (governor/anggaran). Tidak pernah melempar: gagal → teks kosong. */
async function llmGateway(req, e, taskId) {
  if (!llm.isLive()) return { text: '', alasan: 'AI belum tersambung' };
  if (llm.budgetLeft() <= 0) return { text: '', alasan: 'anggaran harian AI habis' };
  try {
    const res = await llm.call({ system: clip(req.system, 3000), messages: [{ role: 'user', content: clip(req.prompt, 12000) }], model: llm.defaultModels().worker, employee: e, maxTokens: Math.min(3000, Math.max(100, Number(req.maxTokens) || 900)), taskId });
    return { text: clip(llm.textOf(res), 8000) };
  } catch (err) { return { text: '', alasan: 'AI sedang tidak bisa dipakai' }; }
}

function sanitize(res) {
  const L = limits(); let total = 0; const files = [];
  for (const f of Array.isArray(res.berkas) ? res.berkas : []) {
    if (files.length >= L.maxFiles || !f || typeof f.isi !== 'string') continue;
    const kind = FILE_KINDS.includes(f.jenis) ? f.jenis : 'txt', isi = f.isi.slice(0, L.maxFileBytes);
    if (total + isi.length > L.maxTotalBytes) break; total += isi.length;
    files.push({ nama: cleanFileName(f.nama, kind), jenis: kind, isi });
  }
  let data = null; try { const s = JSON.stringify(res.data ?? null); data = s.length <= 20_000 ? JSON.parse(s) : null; } catch { /* abaikan */ }
  return { ringkas: clip(res.ringkas, 300), teks: clip(res.teks, 30_000), files, data };
}

function toBrain(spec, e, run, out) {
  if (spec.brain?.simpan === false) return;
  try {
    const div = db().divisions?.find((d) => d.id === spec.division);
    const body = [`**${out.ringkas}**`, '', out.teks ? clip(out.teks, 3000) : '', out.files.length ? `\nBerkas: ${out.files.map((f) => `${f.nama} (${f.bytes} B)`).join(', ')}` : '', `\n_Dikerjakan oleh ${e?.name || spec.title} lewat staf "${spec.name}" (jalan ${run.id})._`].join('\n');
    brain.writeNote({ title: `${spec.name} — ${new Date(run.startedAt).toISOString().slice(0, 16).replace('T', ' ')} (${run.id})`, content: body, folder: `${div?.name || spec.division}/${spec.brain?.folder || 'Report'}`, tags: ['staf', spec.key], authorId: e?.id || 'system' });
  } catch { /* Brain gagal tidak boleh menggagalkan hasil */ }
}

function failure(run, spec, e, err) {
  const msg = err instanceof StaffError || err instanceof InputError ? err.message : N.scrub(err?.message || 'Terjadi kendala.');
  Object.assign(run, { status: err?.kind === 'lama' && !spec?.__twoPhase ? 'menunggu' : 'gagal', galat: msg, endedAt: Date.now(), ms: Date.now() - run.startedAt });
  saveRun(run); setDone(e, false);
  engine.event('staff_failed', e?.id || 'system', `Staf "${run.nama}" gagal: ${msg}`, {});
  return run;
}

/** Jalankan satu staf. Mengembalikan tampilan jalan; melempar StaffError/InputError hanya untuk penolakan sebelum mulai. */
export async function run({ key, input, userId = 'owner', taskId = null, confirmed = false, ws = store.current(), employeeId = null } = {}) {
  const spec = registry.get(key); if (!spec) throw new StaffError('Staf itu tidak ditemukan.', 'tak_ada', 404);
  if (!registry.ready(spec)) throw new StaffError(`"${spec.title}" belum siap dipakai. Pilih staf lain dulu.`, 'belum_siap', 409);
  const clean = await normalizeInput(spec, input, { checkUrl: (u) => browser.checkUrl(u, browser.cfg()) });
  const e = emp(spec.employeeId) || emp(employeeId);
  const L = limits(), mine = runsOf(ws), hour = Date.now() - 3600e3;
  if (mine.filter((r) => r.status === 'jalan').length >= L.concurrent) throw new StaffError('Sedang ada beberapa pekerjaan berjalan. Tunggu sebentar lalu coba lagi.', 'batas', 429);
  if (mine.filter((r) => r.startedAt > hour && r.status !== 'butuh_izin').length >= L.perHour) throw new StaffError('Batas pekerjaan per jam sudah tercapai. Coba lagi nanti.', 'batas', 429);
  const rec = { id: 'run-' + C.hex(5), ws, staf: spec.key, nama: spec.name, employeeId: spec.employeeId, by: userId, taskId, status: 'jalan', startedAt: Date.now(), input: JSON.stringify(clean).length <= 4000 ? clean : {} };
  if (spec.confirm && !confirmed) {
    Object.assign(rec, { status: 'butuh_izin', pesan: `"${spec.name}" butuh izinmu dulu karena berdampak ke luar. Setujui untuk melanjutkan.`, inputFull: clean });
    saveRun(rec); engine.event('staff_wait', e?.id || 'system', `Staf "${spec.name}" menunggu izin`, {});
    return viewRun(rec);
  }
  return execute(rec, spec, clean, e);
}

/** Pemilih mesin: 'native' (bawaan) atau 'n8n' (settings.staffEngine / env RAIVERSE_STAFF_ENGINE). Spesifikasi bertanda needsN8n selalu lewat n8n. */
export function engineOf(spec) {
  const pick = process.env.RAIVERSE_STAFF_ENGINE || db().settings?.staffEngine;
  if (spec?.needsN8n === true) return 'n8n';
  return pick === 'n8n' ? 'n8n' : 'native';
}
const today = () => new Date().toISOString().slice(0, 10);
/** Pemakaian mesin native hari ini untuk ruang kerja aktif (jumlah jalan, panggilan AI, token, biaya); disimpan di usage.staf, reset tiap hari. */
export function nativeUsage() {
  const u = (db().usage ||= {});
  if (!u.staf || u.staf.day !== today()) u.staf = { day: today(), runs: 0, otak: 0, tokens: 0, cost: 0, ms: 0 };
  return u.staf;
}
const usageCost = () => db().usage?.costTotal || 0;
function chargeNative() {
  const u = nativeUsage(), max = limits().nativePerDay;
  if (max && u.runs >= max) throw new StaffError(`Jatah pekerjaan staf hari ini sudah habis (${u.runs} dari ${max}). Coba lagi besok atau minta Owner menaikkan jatah.`, 'batas', 429);
  u.runs++; store.setRoot('usage', db().usage);
}
/** Pengait AI untuk mesin native: model kecil untuk langkah otak, jatah dan biaya dicatat per ruang kerja; tidak pernah melempar. */
const aiCache = new Map();   // hasil AI untuk masukan identik (per ruang kerja, 1 jam, maks 300): hemat biaya dan jatah
const CACHE_MS = 3600e3;
export const clearAiCache = () => aiCache.clear();
function nativeLlm(e, taskId, rec) {
  return async (req) => {
    const ck = crypto.createHash('sha1').update([rec.ws, req.model, req.system, req.prompt].join('')).digest('hex');
    const hit = aiCache.get(ck);
    if (!req.noCache && hit && Date.now() - hit.at < CACHE_MS) { rec.dariCache = (rec.dariCache || 0) + 1; return { text: hit.text }; }
    const out = await nativeLlmCall(req, e, taskId, rec);
    if (out.text) { aiCache.set(ck, { at: Date.now(), text: out.text }); if (aiCache.size > 300) aiCache.delete(aiCache.keys().next().value); }
    return out;
  };
}
function nativeLlmCall(req, e, taskId, rec) {
  return (async () => {
    if (!llm.isLive()) return { text: '', alasan: 'AI belum tersambung, hasil memakai aturan saja' };
    if (llm.budgetLeft() <= 0) return { text: '', alasan: 'anggaran AI harian habis, hasil memakai aturan saja' };
    const u = nativeUsage(), max = limits().otakPerDay;
    if (max && u.otak >= max) return { text: '', alasan: 'jatah AI staf hari ini habis, hasil memakai aturan saja' };
    const dm = llm.defaultModels(), model = req.otak && req.model !== 'sedang' ? dm.small : dm.worker;
    const c0 = usageCost(), in0 = db().usage?.tokensIn || 0, out0 = db().usage?.tokensOut || 0;
    try {
      const res = await llm.call({ system: clip(req.system, 3500), messages: [{ role: 'user', content: clip(req.prompt, 12000) }], model, employee: e, maxTokens: Math.min(3000, Math.max(100, Number(req.maxTokens) || 900)), taskId });
      u.otak++; u.cost += usageCost() - c0; u.tokens += (db().usage?.tokensIn || 0) - in0 + (db().usage?.tokensOut || 0) - out0; store.setRoot('usage', db().usage);
      rec.panggilanAI = (rec.panggilanAI || 0) + 1; rec.modelAI = res.usedModel || model;
      return { text: clip(llm.textOf(res), 8000) };
    } catch { return { text: '', alasan: 'AI sedang tidak bisa dipakai, hasil memakai aturan saja' }; }
  })();
}
async function runNative(spec, clean, rec, e) {
  const hooks = { llm: nativeLlm(e, rec.taskId, rec), saveRow: (row) => appendRow(rec.ws, row) };
  const res = await Promise.race([native.runSpec(spec, { input: clean, ws: rec.ws, user: rec.by, runId: rec.id, hooks }), new Promise((_, rej) => setTimeout(() => rej(new StaffError('Pekerjaan ini memakan waktu lebih lama dari biasanya.', 'lama', 504)), limits().timeoutMs).unref())]);
  const u = nativeUsage(); u.ms += Date.now() - rec.startedAt; return res;
}

async function execute(rec, spec, clean, e) {
  const mesin = engineOf(spec); rec.mesin = mesin;
  if (mesin === 'n8n') { try { gov.chargeExec(1, 'staf'); } catch (err) { throw new StaffError(err.message, 'batas', 429); } }
  else chargeNative();   // jatah eksekusi n8n harian (governor); mesin native punya jatah sendiri (usage.staf)
  const cost0 = usageCost();
  saveRun(rec); setWorking(e, `Mengerjakan: ${spec.name}`);
  engine.event('staff_run', e?.id || 'system', `Staf "${spec.name}" mulai bekerja`, { taskId: rec.taskId });
  try {
    let res;
    if (mesin === 'native') { try { res = await runNative(spec, clean, rec, e); } catch (err) { if (err instanceof native.SandboxError) throw new StaffError('Ada langkah hitung yang tidak bisa dijalankan dengan aman: ' + err.message, 'langkah', 500); throw err; } if (res.catatan) rec.catatan = res.catatan; }   // native: kotak pasir + pengait
    else {
    const dep = await deployer.ensure(spec, rec.ws); deployer.touch(dep.scopeKey);
    const base = { ws: rec.ws, user: rec.by, runId: rec.id, staf: spec.key, input: clean };
    res = await callHook(dep.path, { ...base, phase: 'jalankan' }, { timeoutMs: limits().timeoutMs });
    if (res.tahap === 'minta_ai') {
      const g = await llmGateway(res.llm || {}, e, rec.taskId);
      if (g.alasan) rec.catatan = g.alasan;
      res = await callHook(dep.path, { ...base, phase: 'selesaikan', state: res.state, llmText: g.text }, { timeoutMs: limits().timeoutMs });
    }
    }
    if (res.tahap === 'galat') throw new InputError(clip(res.pesan, 200) || 'Isian belum lengkap.');
    if (res.tahap !== 'selesai') throw new StaffError('Hasil staf tidak lengkap.', 'kosong', 502);
    const out = sanitize(res);
    const meta = writeFiles(rec.ws, rec.id, out.files); out.files.forEach((f, i) => { f.bytes = meta[i].bytes; f.nama = meta[i].nama; });
    Object.assign(rec, { status: 'selesai', ringkas: out.ringkas, teks: out.teks, berkas: meta, data: out.data, endedAt: Date.now(), ms: Date.now() - rec.startedAt, biaya: Math.round((usageCost() - cost0) * 1e6) / 1e6, pakaiAI: res.pakaiAI ?? null });
    delete rec.inputFull; saveRun(rec);
    toBrain(spec, e, rec, { ...out, files: meta });
    if (e) { e.staff = { ...(e.staff || {}), terakhir: { staf: spec.key, id: rec.id, hasil: 'selesai', waktu: rec.endedAt } }; store.upsert('employees', e); }
    engine.event('staff_done', e?.id || 'system', `Staf "${spec.name}" selesai: ${out.ringkas}`, { taskId: rec.taskId });
    setDone(e, true);
    return viewRun(rec);
  } catch (err) { return viewRun(failure(rec, spec, e, err)); }
}

/** Persetujuan Owner untuk jalan yang menunggu izin (staf berisiko tinggi). */
export async function decide(ws, id, setuju) {
  const rec = findRun(ws, id); if (!rec) throw new StaffError('Pekerjaan itu tidak ditemukan.', 'tak_ada', 404);
  if (rec.status !== 'butuh_izin') throw new StaffError('Pekerjaan ini tidak sedang menunggu izin.', 'status', 409);
  if (!setuju) { Object.assign(rec, { status: 'ditolak', endedAt: Date.now(), pesan: 'Tidak dijalankan.' }); delete rec.inputFull; saveRun(rec); return viewRun(rec); }
  const spec = registry.get(rec.staf); if (!spec || !registry.ready(spec)) throw new StaffError('Staf itu tidak lagi tersedia.', 'belum_siap', 409);
  const clean = rec.inputFull || {}; Object.assign(rec, { status: 'jalan', startedAt: Date.now(), pesan: '' });
  return execute(rec, spec, clean, emp(spec.employeeId));
}

/** Ambil hasil jalan yang "menunggu" (alur kelamaan) lewat pengambilan berkala eksekusi di mesin otomasi. */
export async function settle(ws, id) {
  const rec = findRun(ws, id); if (!rec || rec.status !== 'menunggu') return rec ? viewRun(rec) : null;
  const spec = registry.get(rec.staf); const dep = spec && (await N.listWorkflows().catch(() => [])).find((w) => String(w.name).startsWith('[RAIVERSE][staf] ' + spec.key));
  if (!dep) return viewRun(rec);
  const list = await N.listExecutions({ workflowId: dep.id, limit: 20 }).catch(() => []);
  for (const x of list) {
    const ex = await N.getExecution(x.id, true).catch(() => null); const d = ex?.data?.resultData?.runData;
    if (d?.Masukan?.[0]?.data?.main?.[0]?.[0]?.json?.runId !== rec.id) continue;
    if (ex.status === 'running' || ex.status === 'waiting' || ex.status === 'new') return viewRun(rec);
    const res = d?.Hasil?.[0]?.data?.main?.[0]?.[0]?.json;
    if (ex.status === 'success' && res?.tahap === 'selesai') {
      const out = sanitize(res); const meta = writeFiles(rec.ws, rec.id, out.files);
      Object.assign(rec, { status: 'selesai', ringkas: out.ringkas, teks: out.teks, berkas: meta, data: out.data, endedAt: Date.now(), ms: Date.now() - rec.startedAt, galat: '' }); saveRun(rec); toBrain(spec, emp(spec.employeeId), rec, { ...out, files: meta }); return viewRun(rec);
    }
    const lost = ex.status === 'success';   // sukses tidak menyimpan isi eksekusi (privasi): hasilnya tidak bisa diambil lagi
    Object.assign(rec, { status: 'gagal', galat: lost ? 'Pekerjaan selesai, tetapi hasilnya tidak tersimpan demi privasi. Jalankan ulang.' : N.executionProblem(ex) || 'Ada langkah yang gagal.', endedAt: Date.now() }); saveRun(rec); return viewRun(rec);
  }
  return viewRun(rec);
}

export const get = (ws, id) => { const r = findRun(ws, id); return r ? viewRun(r) : null; };
export const list = (ws, { staf, limit = 30 } = {}) => runsOf(ws).filter((r) => !staf || r.staf === staf).slice(0, Math.min(100, limit)).map(viewRun);
export const fileOf = (ws, id, name) => { const r = findRun(ws, id); const f = r?.berkas?.find((b) => b.nama === name); if (!f) return null; const isi = readFile(ws, id, name); return isi === null ? null : { nama: f.nama, jenis: f.jenis, bytes: f.bytes, isi }; };
