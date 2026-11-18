// Batas laju HTTP, kuota harian per akun dan global, nonce sekali-pakai, dan penutup anggaran global (P3).
// Dipasang lewat DUA baris di server/index.js: limits.edge() di paling atas (per alamat IP) dan limits.user() setelah sesi dikenali (per akun + kuota).
// Penghitung yang harus tahan restart (hook otomasi, kuota harian, nonce) disimpan di data/limits.json (tulis atomik); batas per-IP biasa cukup di memori.
// Semua angka bisa diatur lewat env (lihat docs/KEAMANAN-P3.md). Mode publik (RAIVERSE_PUBLIC_MODE=1) menyalakan batas global yang di mode lokal mati.
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as secure from './secure.js';
import * as platform from './platform.js';   // konsol pengelola: nilai yang diubah di sana menimpa env (hapus = kembali ke env/bawaan)

const num = (k, d) => { const o = platform.limitOf(k); if (o !== undefined) return o; const v = Number(process.env[k]); return Number.isFinite(v) && process.env[k] !== '' && process.env[k] !== undefined ? v : d; };
export const publicMode = () => process.env.RAIVERSE_PUBLIC_MODE === '1';
const file = () => path.join(process.env.DATA_DIR || path.resolve('data'), 'limits.json');
export class LimitError extends Error { constructor(msg, retryAfter = 60) { super(msg); this.code = 429; this.retryAfter = retryAfter; } }

// ── penyimpanan tahan restart
let S = null, timer = null;
const day = () => new Date().toISOString().slice(0, 10);
function state() {
  if (S && S.file === file()) return S;
  let j = {}; try { j = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { /* belum ada */ }
  S = { file: file(), win: j.win || {}, daily: j.daily || {}, life: j.life || {}, nonces: j.nonces || {} };
  return S;
}
function persist() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 800); timer.unref?.();
}
export function flush() { clearTimeout(timer); timer = null; if (!S) return; try { prune(); secure.writeAtomic(S.file, JSON.stringify({ win: S.win, daily: S.daily, life: S.life, nonces: S.nonces })); } catch (err) { console.warn('[limits] gagal menyimpan:', err.message); } }
function prune() {
  const now = Date.now();
  for (const [k, w] of Object.entries(S.win)) if (w[0] + (w[2] || 3600e3) < now) delete S.win[k];
  for (const d of Object.keys(S.daily)) if (d < day()) delete S.daily[d];
  for (const [ns, m] of Object.entries(S.nonces)) { for (const [id, exp] of Object.entries(m)) if (exp < now) delete m[id]; if (!Object.keys(m).length) delete S.nonces[ns]; }
}
process.on('exit', () => { try { flush(); } catch { /* keluar */ } });
/** untuk uji: lupakan memori dan baca ulang dari berkas (meniru restart server) */
export function reload() { S = null; mem.clear(); streams.clear(); }
/** untuk uji: kosongkan semua penghitung */
export function reset() { S = { file: file(), win: {}, daily: {}, life: {}, nonces: {} }; mem.clear(); streams.clear(); }

// ── jendela tetap (per kunci). persist:true = tahan restart.
const mem = new Map();
export function hit(key, { limit, windowMs = 60e3, persist: keep = false } = {}) {
  const now = Date.now();
  const bag = keep ? state().win : null;
  let w = keep ? bag[key] : mem.get(key);
  if (!w || now - w[0] >= windowMs) { w = [now, 0, windowMs]; if (keep) bag[key] = w; else { if (mem.size > 20000) for (const k of [...mem.keys()].slice(0, 5000)) mem.delete(k); mem.set(key, w); } }
  w[1]++; if (keep) persist();
  const ok = w[1] <= limit;
  return { ok, count: w[1], remaining: Math.max(0, limit - w[1]), retryAfter: Math.ceil((w[0] + windowMs - now) / 1000) };
}
/** nonce sekali pakai yang tahan restart. true = baru (boleh dipakai); false = pernah dipakai (replay). */
export function once(ns, id, ttlMs = 15 * 60e3) {
  const m = (state().nonces[ns] ||= {}); const now = Date.now();
  if (m[id] && m[id] > now) return false;
  m[id] = now + ttlMs; if (Object.keys(m).length > 50000) { for (const k of Object.keys(m).slice(0, 10000)) delete m[k]; } persist(); return true;
}

// ── alamat klien
const LOOP = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;
export function clientIp(req) {
  const ra = req.socket?.remoteAddress || '';
  if (process.env.TRUST_PROXY === '1') { const f = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f; }
  return ra.replace(/^::ffff:/, '') || 'unknown';
}
/** benar-benar dari komputer ini: soket loopback DAN tidak lewat proxy. Pemeriksaan ini tidak melemah hanya karena RAIVERSE_PUBLIC_URL diisi. */
export function isLocalDirect(req) {
  const h = req.headers || {};
  return LOOP.test(req.socket?.remoteAddress || '') && !h['x-forwarded-for'] && !h.forwarded && !h['x-real-ip'] && !h['x-forwarded-host'];
}

// ── kuota harian
export const QUOTAS = {
  task: { acct: ['QUOTA_TASK_DAY', 150], glob: ['QUOTA_TASK_DAY_GLOBAL', 3000], label: 'tugas' },
  message: { acct: ['QUOTA_MESSAGE_DAY', 400], glob: ['QUOTA_MESSAGE_DAY_GLOBAL', 8000], label: 'pesan ke agen' },
  tts: { acct: ['QUOTA_TTS_DAY', 200], glob: ['QUOTA_TTS_DAY_GLOBAL', 4000], label: 'suara' },
  n8n: { acct: ['QUOTA_N8N_DAY', 60], glob: ['QUOTA_N8N_DAY_GLOBAL', 1500], label: 'eksekusi otomasi' },
  gate: { acct: ['QUOTA_GATE_DAY', 120], glob: ['QUOTA_GATE_DAY_GLOBAL', 3000], label: 'panggilan AI dari otomasi' },
  ws_create: { acct: ['QUOTA_WS_CREATE_DAY', 1], glob: ['QUOTA_WS_CREATE_DAY_GLOBAL', 40], label: 'ruang kerja baru' },
};
export const quotaOf = (kind) => { const q = QUOTAS[kind]; return { account: num(...q.acct), global: num(...q.glob) }; };
const secondsToMidnight = () => { const n = new Date(); return Math.max(60, Math.ceil((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime()) / 1000)); };
/** Tambah satu pemakaian. Melempar LimitError (429) bila kuota akun atau global hari ini habis. exempt = tidak dihitung ke akun (tetap ke global). */
export function charge(kind, { account = 'anon', exempt = false, n = 1 } = {}) {
  const q = QUOTAS[kind]; if (!q) return;
  const lim = quotaOf(kind), d = (state().daily[day()] ||= {});
  const gk = `g:${kind}`, ak = `a:${kind}:${account}`;
  if ((d[gk] || 0) + n > lim.global) throw new LimitError(`Kuota harian platform untuk ${q.label} sudah habis. Coba lagi besok.`, secondsToMidnight());
  if (!exempt && (d[ak] || 0) + n > lim.account) throw new LimitError(`Jatah harianmu untuk ${q.label} sudah habis (${lim.account} per hari). Coba lagi besok.`, secondsToMidnight());
  d[gk] = (d[gk] || 0) + n; if (!exempt) d[ak] = (d[ak] || 0) + n; persist();
}
export const used = (kind, account) => { const d = state().daily[day()] || {}; return { account: d[`a:${kind}:${account}`] || 0, global: d[`g:${kind}`] || 0 }; };
/** pembatasan seumur hidup (mis. jumlah ruang kerja yang pernah dibuat satu akun Google) */
export function lifetime(key, max, msg) { const l = state().life; if ((l[key] || 0) >= max) throw new LimitError(msg || 'Batas tercapai.', 86400); l[key] = (l[key] || 0) + 1; persist(); }
export const lifetimeCount = (key) => state().life[key] || 0;

// ── anggaran global: jumlah biaya AI semua ruang kerja hari ini
export function spentToday() {
  let sum = 0; const today = day();
  for (const ws of store.ids()) { try { sum += store.costToday(ws, today); } catch { /* ruang kerja belum siap */ } }   // tidak memuat ruang kerja yang sedang dilepas dari memori
  return sum;
}
export const globalBudget = () => num('GLOBAL_DAILY_BUDGET_USD', publicMode() ? 25 : 0);   // 0 = tidak dibatasi (mode lokal)
export function budgetClosed() { if (platform.flag('aiClosed')) return true; const cap = globalBudget(); return cap > 0 && spentToday() >= cap; }   // aiClosed = tombol "tutup anggaran" di konsol pengelola
export function assertGlobalBudget() { if (budgetClosed()) throw new LimitError('Anggaran AI harian platform sudah habis. Layanan AI dibuka lagi besok.', secondsToMidnight()); }

// ── koneksi SSE per pengguna
const streams = new Map();
export function acquireStream(who) {
  const max = num('MAX_STREAMS_PER_USER', 6), n = streams.get(who) || 0;
  if (n >= max) return null;
  streams.set(who, n + 1); let done = false;
  return () => { if (done) return; done = true; const c = (streams.get(who) || 1) - 1; if (c <= 0) streams.delete(who); else streams.set(who, c); };
}

// ── peta rute → jenis kuota
export function routeKind(method, p) {
  if (method !== 'POST') return null;
  if (/^\/api\/(goals|orchestrate|tasks|meetings|studio\/generate)$/.test(p) || /^\/api\/routines\/[^/]+\/run$/.test(p)) return 'task';
  if (p === '/api/messages') return 'message';
  if (p === '/api/tts') return 'tts';
  if (/^\/api\/staff\/(?!runs\/)[^/]+\/run$/.test(p) || /^\/api\/automations\/[^/]+\/confirm$/.test(p)) return 'n8n';
  return null;
}
function reject(res, err, req) {
  platform.denied({ code: err.code || 429, ip: req ? clientIp(req) : '', path: req?.url || '', alasan: 'batas' });
  res.writeHead(err.code || 429, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(err.retryAfter || 60) });
  res.end(JSON.stringify({ error: err.message, retryAfter: err.retryAfter || 60 })); return true;
}
/** Baris pertama di server: batas per IP untuk /api, /auth, /join. Mengembalikan true bila permintaan sudah dijawab (429). */
export function edge(req, res, url) {
  const p = url.pathname;
  if (!(p.startsWith('/api/') || p.startsWith('/auth/') || p.startsWith('/join/'))) return false;
  if (p === '/api/stream') return false;   // dibatasi per koneksi, bukan per permintaan
  const ip = clientIp(req), hook = p.startsWith('/api/automations/hook/') || p === '/api/llm-gate';
  const authy = !p.startsWith('/api/');
  const r = hit(`ip:${hook ? 'hook' : authy ? 'auth' : 'api'}:${ip}`, { limit: hook ? num('RATE_HOOK_IP_PER_MIN', 120) : authy ? num('RATE_AUTH_IP_PER_MIN', 30) : num('RATE_API_IP_PER_MIN', 900) });
  return r.ok ? false : reject(res, new LimitError('Terlalu banyak permintaan dari alamat ini. Tunggu sebentar.', r.retryAfter), req);
}
/** Setelah sesi dikenali: batas per akun + kuota harian per jenis pekerjaan + penutup anggaran global. */
export function user(req, res, url, { me, admin = false } = {}) {
  const p = url.pathname; if (!p.startsWith('/api/')) return false;
  const who = me?.id || `anon:${clientIp(req)}`;
  try {
    const r = hit(`acct:${who}`, { limit: num('RATE_ACCOUNT_PER_MIN', 600) });
    if (!r.ok) throw new LimitError('Terlalu banyak permintaan dari akunmu. Tunggu sebentar.', r.retryAfter);
    const kind = routeKind(req.method, p); if (!kind) return false;
    const rk = hit(`acct:${kind}:${who}`, { limit: num('RATE_HEAVY_PER_MIN', 30) });
    if (!rk.ok) throw new LimitError('Pelan-pelan dulu, terlalu cepat.', rk.retryAfter);
    if (kind !== 'tts' && kind !== 'n8n') assertGlobalBudget();
    charge(kind, { account: who, exempt: admin });
    return false;
  } catch (err) { if (err instanceof LimitError) return reject(res, err, req); throw err; }
}
