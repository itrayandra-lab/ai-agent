// Pengaturan tingkat PLATFORM (bukan per ruang kerja) untuk konsol pengelola: kunci AI platform, pilihan model per tingkat,
// batas yang bisa diubah tanpa menyentuh .env, penutup anggaran, log audit, dan catatan upaya yang ditolak (403/429).
// Berkas: data/admin.json (tulis atomik, mode 0600; rahasia hanya sebagai amplop terenkripsi secure.seal, konteks 'admin-secret').
// Modul ini sengaja TIDAK mengimpor store/auth/llm supaya llm.js dan limits.js boleh memakainya tanpa putaran impor.
// Rahasia tidak pernah dikembalikan, dicatat, atau dimasukkan ke log audit (scrub di bawah).
import fs from 'node:fs';
import path from 'node:path';
import * as secure from './secure.js';

const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });   // galat masukan: tampil apa adanya ke pengelola (400), bukan 500
const dir = () => process.env.DATA_DIR || path.resolve('data');
const confFile = () => path.join(dir(), 'admin.json');
const auditFile = () => path.join(dir(), 'admin-audit.jsonl');

// ── konfigurasi
let C = null, cFile = '';
function conf() {
  if (C && cFile === confFile()) return C;
  let j = {}; try { j = JSON.parse(fs.readFileSync(confFile(), 'utf8')); } catch { /* belum ada */ }
  C = { secrets: j.secrets || {}, limits: j.limits || {}, models: j.models || {}, flags: j.flags || {} }; cFile = confFile();
  return C;
}
function save() { secure.updateJson(confFile(), () => ({}), () => ({ secrets: C.secrets, limits: C.limits, models: C.models, flags: C.flags }), { mode: 0o600 }); }
/** untuk uji: baca ulang dari berkas */
export const reload = () => { C = null; };

// ── rahasia platform ('groq' | 'anthropic')
export const SECRET_NAMES = ['groq', 'anthropic'];
/** nilai asli; hanya untuk llm.js dan uji koneksi. Kosong bila belum diisi atau tidak terbaca. */
export function secret(name) { const v = conf().secrets[name]; if (!v) return ''; try { return secure.open(v, 'admin-secret'); } catch { return ''; } }
export function setSecret(name, value) {
  if (!SECRET_NAMES.includes(name)) throw bad('Penyedia tidak dikenal');
  const v = String(value ?? '').trim();
  if (v.length < 8 || v.length > 400 || /\s/.test(v)) throw bad('Kunci tidak valid (8 sampai 400 karakter, tanpa spasi).');
  conf().secrets[name] = secure.seal(v, 'admin-secret'); save();
}
export function clearSecret(name) { delete conf().secrets[name]; save(); }
/** tampilan aman: hanya terisi atau kosong dan empat karakter terakhir (dari petunjuk di amplop) */
export function secretInfo(name) { const v = conf().secrets[name]; return v ? { terisi: true, akhir: secure.mask(v).slice(-4), versiKunci: String(v).split('.')[1] || '?' } : { terisi: false }; }
/** bungkus ulang semua rahasia platform dengan kunci enkripsi terkini; mengembalikan jumlah yang diperbarui */
export function resealAll() { let n = 0; for (const [k, v] of Object.entries(conf().secrets)) if (secure.needsReseal(v)) { try { conf().secrets[k] = secure.reseal(v, 'admin-secret'); n++; } catch { delete conf().secrets[k]; } } if (n) save(); return n; }

// ── model per tingkat
export const MODEL_TIERS = ['groqLead', 'groqWorker', 'groqSmall', 'claudeLead', 'claudeWorker', 'claudeSmall'];
export const model = (tier) => conf().models[tier] || '';
export function setModel(tier, id) {
  if (!MODEL_TIERS.includes(tier)) throw bad('Tingkat model tidak dikenal');
  const v = String(id ?? '').trim();
  if (v && !/^[\w./:-]{2,80}$/.test(v)) throw bad('Nama model tidak valid.');
  if (v) conf().models[tier] = v; else delete conf().models[tier];
  save();
}
export const models = () => ({ ...conf().models });

// ── batas yang bisa diubah (menimpa env; hapus = kembali ke bawaan)
/** kunci yang boleh diubah → [terkecil, terbesar, kelompok, label] */
export const LIMIT_KEYS = {
  QUOTA_TASK_DAY: [0, 100000, 'akun', 'Tugas per akun per hari'], QUOTA_TASK_DAY_GLOBAL: [0, 10000000, 'global', 'Tugas seluruh platform per hari'],
  QUOTA_N8N_DAY: [0, 100000, 'akun', 'Eksekusi staf per akun per hari'], QUOTA_N8N_DAY_GLOBAL: [0, 10000000, 'global', 'Eksekusi staf seluruh platform per hari'],
  QUOTA_TTS_DAY: [0, 100000, 'akun', 'Suara per akun per hari'], QUOTA_TTS_DAY_GLOBAL: [0, 10000000, 'global', 'Suara seluruh platform per hari'],
  QUOTA_MESSAGE_DAY: [0, 100000, 'akun', 'Pesan per akun per hari'], QUOTA_MESSAGE_DAY_GLOBAL: [0, 10000000, 'global', 'Pesan seluruh platform per hari'],
  QUOTA_GATE_DAY: [0, 100000, 'akun', 'Panggilan AI dari otomasi per akun per hari'], QUOTA_GATE_DAY_GLOBAL: [0, 10000000, 'global', 'Panggilan AI dari otomasi seluruh platform per hari'],
  QUOTA_WS_CREATE_DAY: [0, 1000, 'akun', 'Ruang kerja baru per akun per hari'], QUOTA_WS_CREATE_DAY_GLOBAL: [0, 100000, 'global', 'Ruang kerja baru seluruh platform per hari'],
  RATE_API_IP_PER_MIN: [10, 100000, 'laju', 'Permintaan per alamat IP per menit'], RATE_AUTH_IP_PER_MIN: [3, 10000, 'laju', 'Percobaan masuk per alamat IP per menit'],
  RATE_ACCOUNT_PER_MIN: [10, 100000, 'laju', 'Permintaan per akun per menit'], RATE_HEAVY_PER_MIN: [1, 10000, 'laju', 'Pekerjaan berat per akun per menit'],
  RATE_HOOK_IP_PER_MIN: [5, 100000, 'laju', 'Panggilan otomasi per alamat IP per menit'], MAX_STREAMS_PER_USER: [1, 100, 'laju', 'Sambungan langsung per akun'],
  GLOBAL_DAILY_BUDGET_USD: [0, 100000, 'anggaran', 'Anggaran AI harian seluruh platform (USD)'],
};
/** nilai ubahan, atau undefined bila tidak diubah lewat konsol */
export const limitOf = (k) => { const v = conf().limits[k]; return typeof v === 'number' ? v : undefined; };
export function setLimit(k, value) {
  const d = LIMIT_KEYS[k]; if (!d) throw bad('Batas itu tidak dikenal');
  if (value === null || value === '' || value === undefined) { delete conf().limits[k]; save(); return; }
  const n = Number(value);
  if (!Number.isFinite(n) || n < d[0] || n > d[1]) throw bad(`Nilai harus antara ${d[0]} dan ${d[1]}.`);
  conf().limits[k] = k === 'GLOBAL_DAILY_BUDGET_USD' ? Math.round(n * 100) / 100 : Math.floor(n); save();
}
export const limitOverrides = () => ({ ...conf().limits });

// ── bendera platform
export const FLAGS = ['aiClosed'];
export const flag = (name) => conf().flags[name] === true;
export function setFlag(name, on) { if (!FLAGS.includes(name)) throw bad('Bendera tidak dikenal'); if (on) conf().flags[name] = true; else delete conf().flags[name]; save(); }

// ── log audit (hanya menambah; tanpa rahasia)
const SECRET_LIKE = /(gsk_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{8,}|ev2\.[\w.~-]+|Bearer\s+\S+|[A-Za-z0-9_-]{32,})/g;
const clean = (v, n = 300) => String(v ?? '').replace(SECRET_LIKE, '[disamarkan]').replace(/[\r\n\t]+/g, ' ').slice(0, n);
let lastRot = 0;
/** catat satu aksi. Tidak pernah melempar galat (kegagalan log tidak boleh menjatuhkan permintaan). */
export function audit({ aktor, ip = '', aksi, sasaran = '', hasil = 'ok', rincian = '' }) {
  try {
    const f = auditFile(); fs.mkdirSync(path.dirname(f), { recursive: true });
    if (Date.now() - lastRot > 60000) { lastRot = Date.now(); try { if (fs.statSync(f).size > 4e6) fs.renameSync(f, f + '.1'); } catch { /* belum ada */ } }
    fs.appendFileSync(f, JSON.stringify({ t: Date.now(), aktor: clean(aktor, 120), ip: clean(ip, 64), aksi: clean(aksi, 60), sasaran: clean(sasaran, 120), hasil: clean(hasil, 20), rincian: clean(rincian) }) + '\n', { mode: 0o600 });
  } catch (err) { console.warn('[audit] gagal menulis:', err.message); }
}
/** baca log (terbaru dulu). Penyaring: aksi (sama persis atau awalan), aktor (mengandung), hasil, dari/sampai (ms). */
export function readAudit({ aksi = '', aktor = '', hasil = '', dari = 0, sampai = 0, batas = 100 } = {}) {
  const lines = [];
  for (const f of [auditFile() + '.1', auditFile()]) { try { const s = fs.readFileSync(f, 'utf8'); lines.push(...s.split('\n').filter(Boolean).slice(-5000)); } catch { /* tidak ada */ } }
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < Math.min(500, Math.max(1, batas)); i--) {
    let e; try { e = JSON.parse(lines[i]); } catch { continue; }
    if (aksi && !String(e.aksi).startsWith(aksi)) continue;
    if (aktor && !String(e.aktor).toLowerCase().includes(String(aktor).toLowerCase())) continue;
    if (hasil && e.hasil !== hasil) continue;
    if (dari && e.t < dari) continue; if (sampai && e.t > sampai) continue;
    out.push(e);
  }
  return out;
}

// ── upaya yang ditolak (403/429): cincin di memori + hitungan per jam
const DENIED = []; const HOURS = new Map();
const tag = (ip) => secure.sha256(String(ip || '')).slice(0, 8);
export function denied({ code, ip = '', path: p = '', alasan = '' }) {
  const h = Math.floor(Date.now() / 3600e3);
  const b = HOURS.get(h) || {}; b[code] = (b[code] || 0) + 1; HOURS.set(h, b);
  for (const k of [...HOURS.keys()]) if (k < h - 47) HOURS.delete(k);
  DENIED.push({ t: Date.now(), code, dari: tag(ip), jalur: clean(String(p).replace(/[0-9a-f]{16,}/gi, ':id'), 80), alasan: clean(alasan, 80) });
  if (DENIED.length > 200) DENIED.splice(0, DENIED.length - 200);
}
export function deniedReport() {
  const now = Math.floor(Date.now() / 3600e3), per = { 403: 0, 429: 0 };
  const jam = []; for (let h = now - 23; h <= now; h++) { const b = HOURS.get(h) || {}; per[403] += b[403] || 0; per[429] += b[429] || 0; jam.push({ jam: new Date(h * 3600e3).toISOString().slice(11, 13), 403: b[403] || 0, 429: b[429] || 0 }); }
  return { duaPuluhEmpatJam: per, perJam: jam, terbaru: DENIED.slice(-30).reverse() };
}
