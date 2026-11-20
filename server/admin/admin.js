// Konsol pengelola platform (/api/admin/*). Untuk Owner atau pengelola platform SAJA; pengguna biasa tidak melihat apa pun dari sini.
// Pemasangan di server/index.js hanya satu baris: admin.handle() dipanggil sebelum gerbang sesi, jadi siapa pun yang bukan pengelola mendapat 403 seragam
// (juga untuk alamat yang tidak ada: keberadaan fitur tidak bocor). Lihat docs/KONSOL-ADMIN.md.
//
// Prinsip: tidak ada rahasia di respons atau log; semua masukan divalidasi; aksi yang mengubah wajib header X-Raiverse-Admin dan asal yang sama (anti-CSRF),
// dibatasi laju, dan dicatat di log audit (siapa, kapan, apa, tanpa rahasia). Aksi yang merusak atau berdampak luas wajib mengetik ulang kalimat konfirmasi.
// Tidak ada eksekusi perintah bebas: satu-satunya proses anak adalah skrip tetap scripts/n8n-staf-nonaktifkan.mjs (bila ada), tanpa argumen dari pengguna.
import * as config from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as store from '../penyimpanan/store.js';
import * as auth from '../keamanan/auth.js';
import * as limits from '../keamanan/limits.js';
import * as secure from '../keamanan/secure.js';
import * as platform from './platform.js';
import * as privacy from '../keamanan/privacy.js';
import * as llm from '../otak/llm.js';
import * as otomasi from '../integrasi/n8n.js';
import * as collab from '../collab.js';
import * as registry from '../staff/registry.js';
import * as kesehatan from '../staff/kesehatan.js';
import * as sq from '../penyimpanan/store-sqlite.js';
import { slug } from '../organisasi/seed.js';
import { makeBackup } from '../../scripts/backup-data.mjs';
import { verifyBackup, restoreBackup } from '../../scripts/restore-data.mjs';

const dataDir = () => config.dataDir();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ═════════════════════ identitas pengelola ═════════════════════
/** email pengelola platform dari env RAIVERSE_ADMIN_EMAILS (dipisah koma) */
export const adminEmails = () => String(config.get('RAIVERSE_ADMIN_EMAILS').join(',')).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
/** Pengelola platform:
 *  - sudah ada yang masuk (login berlaku): email di RAIVERSE_ADMIN_EMAILS; bila daftar itu kosong, pemilik kantor utama (yang mengklaimnya dengan aman);
 *  - belum ada yang masuk (komputer pribadi tanpa login): hanya permintaan langsung dari komputer ini (soket loopback, tanpa proxy).
 *  `req` boleh dihilangkan hanya untuk petunjuk tampilan (bukan penjaga rute). */
export function isAdmin(me, req) {
  if (!auth.enforced()) return req ? limits.isLocalDirect(req) : true;
  if (!me) return false;
  const list = adminEmails();
  if (list.length) return list.includes(String(me.email || '').toLowerCase());
  return auth.isPlatformAdmin(me);
}
/** petunjuk untuk tampilan (/api/state): hanya `true` untuk pengelola; peladen tetap memeriksa lagi di setiap rute */
export const uiFlag = (me) => isAdmin(me);
const TECH_SETTINGS = ['apiKey', 'groqApiKey', 'hasApiKey', 'hasGroqKey', 'mcpServers', 'googleAppsScript'];
/** salinan pengaturan tanpa bagian teknis, untuk pengguna biasa (/api/state dan siaran langsung) */
export function stripSettings(s) { const o = { ...s }; for (const k of TECH_SETTINGS) delete o[k]; return o; }
/** kunci pengaturan yang hanya boleh diubah pengelola platform */
export const TECH_PATCH_KEYS = ['apiKey', 'groqApiKey', 'mcpServers', 'googleAppsScript', 'provider', 'model', 'workerModel', 'groqModel', 'groqWorkerModel', 'dailyBudgetUSD', 'quota', 'staffModel', 'tickMs', 'maxConcurrent', 'mode'];

// ═════════════════════ pemulihan tertunda (dipakai saat boot) ═════════════════════
const pendingFile = () => path.join(dataDir(), 'restore-pending.json');
/** Dipanggil SEKALI saat boot, sebelum data dimuat: menerapkan pemulihan yang dijadwalkan dari konsol (server yang berjalan tidak boleh ditimpa dari bawah kakinya). */
export function applyPendingRestore() {
  let p; try { p = JSON.parse(fs.readFileSync(pendingFile(), 'utf8')); } catch { return null; }
  try { fs.unlinkSync(pendingFile()); } catch { /* sudah hilang */ }
  try {
    const dir = path.join(dataDir(), 'backups', String(p.nama || ''));
    if (!/^[\w.-]{5,80}$/.test(String(p.nama || '')) || !fs.existsSync(dir)) throw new Error('cadangan tidak ditemukan');
    const r = restoreBackup({ backupDir: dir, dataDir: dataDir(), confirm: true });
    platform.audit({ aktor: 'boot', aksi: 'data.pulihkan.terapkan', sasaran: p.nama, rincian: `${r.files} berkas, hash terverifikasi, keadaan sebelumnya disimpan` });
    console.log(`  Pemulihan data diterapkan dari cadangan ${p.nama} (${r.files} berkas).`);
    return r;
  } catch (err) { platform.audit({ aktor: 'boot', aksi: 'data.pulihkan.terapkan', sasaran: p.nama, hasil: 'gagal', rincian: err.message }); console.error('  Pemulihan data GAGAL, data tidak diubah:', err.message); return null; }
}

// ═════════════════════ pembantu ═════════════════════
const confirm = (b, expected) => { if (String(b.konfirmasi || '').trim() !== expected) throw bad(`Untuk melanjutkan, ketik persis: ${expected}`, 400); };
const mainSettings = (fn) => store.run('main', () => fn(store.get().settings));
const origin = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const exec = (file, args, opt) => new Promise((ok) => execFile(file, args, opt, (err, out, errOut) => ok({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(out || ''), err: String(errOut || '') })));
const sizeOf = (p, budget = { n: 30000 }) => { try { const st = fs.lstatSync(p); if (st.isFile()) return st.size; if (!st.isDirectory()) return 0; let t = 0; for (const f of fs.readdirSync(p)) { if (--budget.n < 0) break; t += sizeOf(path.join(p, f), budget); } return t; } catch { return 0; } };

function listBackups() {
  const dir = path.join(dataDir(), 'backups'); const out = [];
  try { for (const n of fs.readdirSync(dir)) { try { const m = JSON.parse(fs.readFileSync(path.join(dir, n, 'manifest.json'), 'utf8')); out.push({ nama: n, dibuat: m.createdAt, label: m.label, berkas: (m.files || []).length, byte: (m.files || []).reduce((a, f) => a + (f.bytes || 0), 0) }); } catch { /* bukan cadangan sah */ } } } catch { /* belum ada */ }
  return out.sort((a, b) => String(b.dibuat).localeCompare(String(a.dibuat)));
}
const keySource = (name) => store.run('main', () => { const s = store.get().settings; const ws = name === 'groq' ? s.groqApiKey : s.apiKey; return ws ? 'ruang kerja utama' : platform.secret(name) ? 'konsol' : process.env[name === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY'] ? 'server (.env)' : 'kosong'; });

// ═════════════════════ bagian-bagian ═════════════════════
async function ringkasan() {
  const wsList = auth.adminWorkspaces(), users = auth.adminUsers();
  const [n8n] = await Promise.all([Promise.race([otomasi.connection(), new Promise((ok) => setTimeout(() => ok({ tersambung: false, pesan: 'Tidak menjawab tepat waktu.' }), 3500))])]);
  const bk = listBackups()[0] || null; let dbAge = null; try { dbAge = Math.round((Date.now() - fs.statSync(path.join(dataDir(), 'db.json')).mtimeMs) / 60000); } catch { /* belum ada */ }
  const u = (k) => limits.used(k, '-').global;
  return {
    server: { aktifDetik: Math.round(process.uptime()), node: process.version, memoriMB: Math.round(process.memoryUsage().rss / 1048576), sistem: `${process.platform} ${process.arch}`, modeUmum: limits.publicMode(), loginWajib: auth.enforced() },
    mesinAI: { aktif: store.run('main', () => llm.provider()), live: store.run('main', () => llm.isLive()), groq: keySource('groq'), anthropic: keySource('anthropic'), ditutup: platform.flag('aiClosed') },
    penyimpanan: { ...store.storageStats(), sqliteTersedia: sq.available() },
    jumlah: { ruangKerja: store.ids().length, akun: users.length, ditangguhkan: users.filter((x) => x.ditangguhkan).length, terdaftar: wsList.length },
    hariIni: { tugas: u('task'), pesan: u('message'), staf: u('n8n'), suara: u('tts'), ruangBaru: u('ws_create'), biayaUSD: Math.round(limits.spentToday() * 10000) / 10000, anggaranUSD: limits.globalBudget(), anggaranTutup: limits.budgetClosed() },
    n8n: { menyala: !!n8n.menyala, tersambung: !!n8n.tersambung, pesan: n8n.pesan || '' },
    data: { menitSejakDataUtamaDitulis: dbAge, cadanganTerakhir: bk, jumlahCadangan: listBackups().length, pemulihanTertunda: fs.existsSync(pendingFile()) },
  };
}

function aiStatus() {
  const info = (name) => ({ ...platform.secretInfo(name), sumberAktif: keySource(name), diEnv: !!process.env[name === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY'] });
  const m = platform.models(), d = store.run('main', () => ({ groq: llm.defaultModels('groq'), claude: llm.defaultModels('claude') }));
  const tier = (k, def) => ({ nilai: m[k] || '', efektif: def });
  return {
    mesin: store.run('main', () => llm.provider()), ditutup: platform.flag('aiClosed'),
    penyedia: { groq: info('groq'), anthropic: info('anthropic') },
    model: { groqLead: tier('groqLead', d.groq.lead), groqWorker: tier('groqWorker', d.groq.worker), groqSmall: tier('groqSmall', d.groq.small), claudeLead: tier('claudeLead', d.claude.lead), claudeWorker: tier('claudeWorker', d.claude.worker), claudeSmall: tier('claudeSmall', d.claude.small) },
    daftarModel: { groq: [...llm.GROQ_MODELS], claude: [...llm.CLAUDE_MODELS] },
    batasGlobal: { anggaranUSD: limits.globalBudget(), terpakaiHariIniUSD: Math.round(limits.spentToday() * 10000) / 10000, ditutup: limits.budgetClosed() },
  };
}
/** uji koneksi: daftar model dari penyedia (gratis, tanpa menghabiskan token). Nilai uji tidak pernah disimpan atau dicatat. */
async function ujiPenyedia(name, nilai) {
  if (!platform.SECRET_NAMES.includes(name)) throw bad('Penyedia tidak dikenal');
  const key = String(nilai || '').trim() || platform.secret(name) || process.env[name === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY'] || '';
  if (!key) return { ok: false, pesan: 'Belum ada kunci untuk diuji.' };
  if (key.length > 400 || /\s/.test(key)) return { ok: false, pesan: 'Bentuk kunci tidak valid.' };
  const url = name === 'groq' ? `${process.env.RAY_GROQ_BASE_URL || 'https://api.groq.com/openai/v1'}/models` : `${process.env.RAY_ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/models`;
  const headers = name === 'groq' ? { Authorization: `Bearer ${key}` } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, status: r.status, ms: Date.now() - t0, modelTerlihat: Array.isArray(j.data) ? j.data.length : null, pesan: 'Tersambung.' };
    return { ok: false, status: r.status, ms: Date.now() - t0, pesan: r.status === 401 || r.status === 403 ? 'Kunci ditolak penyedia.' : r.status === 429 ? 'Penyedia sedang membatasi permintaan.' : `Penyedia menjawab dengan kode ${r.status}.` };
  } catch (err) { return { ok: false, pesan: err.name === 'TimeoutError' ? 'Penyedia tidak menjawab tepat waktu.' : 'Tidak bisa menghubungi penyedia.' }; }
}

const RATE_DEFAULTS = { RATE_API_IP_PER_MIN: 900, RATE_AUTH_IP_PER_MIN: 30, RATE_ACCOUNT_PER_MIN: 600, RATE_HEAVY_PER_MIN: 30, RATE_HOOK_IP_PER_MIN: 120, MAX_STREAMS_PER_USER: 6 };
function bawaanBatas(k) {
  for (const q of Object.values(limits.QUOTAS)) { if (q.acct[0] === k) return q.acct[1]; if (q.glob[0] === k) return q.glob[1]; }
  if (k === 'GLOBAL_DAILY_BUDGET_USD') return limits.publicMode() ? 25 : 0;
  return RATE_DEFAULTS[k] ?? 0;
}
function batasStatus() {
  const items = Object.entries(platform.LIMIT_KEYS).map(([k, [min, max, kelompok, label]]) => {
    const env = process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(Number(process.env[k])) ? Number(process.env[k]) : undefined;
    const diubah = platform.limitOf(k);
    return { kunci: k, label, kelompok, min, max, bawaan: env ?? bawaanBatas(k), nilai: diubah ?? env ?? bawaanBatas(k), diubah: diubah !== undefined, dariEnv: env !== undefined };
  });
  const pakai = {}; for (const kind of Object.keys(limits.QUOTAS)) pakai[kind] = limits.used(kind, '-').global;
  return { batas: items, pemakaianGlobalHariIni: pakai, anggaran: { ditutup: platform.flag('aiClosed'), otomatisTutup: limits.budgetClosed() && !platform.flag('aiClosed') }, catatan: '0 berarti tanpa batas untuk kuota harian. Kolom "bawaan" adalah nilai dari server (.env) atau bawaan aplikasi.' };
}

function penggunaDaftar(url) {
  const q = String(url.searchParams.get('cari') || '').trim().toLowerCase().slice(0, 60);
  const hal = Math.max(1, Math.floor(num(url.searchParams.get('hal')) || 1)), per = 25;
  const all = auth.adminUsers().filter((x) => !q || String(x.email).toLowerCase().includes(q) || String(x.nama || '').toLowerCase().includes(q));
  const ws = auth.adminWorkspaces().filter((w) => !q || String(w.nama).toLowerCase().includes(q) || String(w.pemilik).toLowerCase().includes(q) || w.id.includes(q));
  return {
    total: all.length, halaman: hal, perHalaman: per,
    pengguna: all.sort((a, b) => (b.masukTerakhir || 0) - (a.masukTerakhir || 0)).slice((hal - 1) * per, hal * per),
    totalRuang: ws.length, ruangKerja: ws.slice(0, 50).map((w) => ({ ...w, penyimpanan: store.storageMode(w.id) })),
    catatan: 'Isi pesan, catatan, dan tugas pengguna tidak ditampilkan di sini. Ekspor data pribadi butuh alasan tertulis dan tercatat.',
  };
}

async function integrasi() {
  const g = mainSettings((s) => ({ aktif: s.googleAppsScript?.enabled !== false && !!s.googleAppsScript?.url, urlTerisi: !!s.googleAppsScript?.url, rahasiaTerisi: !!s.googleAppsScript?.secret, host: s.googleAppsScript?.url ? (() => { try { return new URL(s.googleAppsScript.url).hostname; } catch { return ''; } })() : '' }));
  const konektor = store.run('main', () => collab.googleWorkspaceConfigured());
  const n8n = await Promise.race([otomasi.connection(), new Promise((ok) => setTimeout(() => ok({ tersambung: false, pesan: 'Tidak menjawab tepat waktu.' }), 3500))]);
  let berlabel = null;
  if (n8n.tersambung) { try { berlabel = (await otomasi.listWorkflows(250)).filter((w) => String(w.name || '').startsWith(otomasi.LABEL)).length; } catch { berlabel = null; } }
  const mcp = mainSettings((s) => (s.mcpServers || []).map((m) => ({ id: m.id, nama: m.name, alamat: origin(m.url), aktif: m.enabled !== false, punyaHeader: Object.keys(m.headers || {}).length > 0 })));
  const wa = { url: !!process.env.WAHA_URL, kunci: !!process.env.WAHA_API_KEY, aktif: process.env.WAHA_ENABLED === '1' || process.env.WAHA_ENABLED === 'true' };
  const email = { pengirim: !!process.env.N8N_MAIL_FROM };
  return {
    google: { loginDiatur: auth.configured(), pickerDiisi: !!process.env.GOOGLE_PICKER_API_KEY, redirectDiisi: !!process.env.GOOGLE_REDIRECT_URI, loginWajib: auth.enforced(), konektorAppsScript: { ...g, tersambung: konektor } },
    n8n: { alamat: origin(process.env.N8N_URL || 'http://127.0.0.1:5678'), kunciDiisi: !!process.env.N8N_API_KEY, menyala: !!n8n.menyala, tersambung: !!n8n.tersambung, pesan: n8n.pesan || '', alurBerlabelRaiverse: berlabel, label: otomasi.LABEL.trim() },
    kabarBalik: { ...otomasi.pollStatus(), lewat: 'pengambilan berkala (tanpa alamat publik)', webhookMasuk: { perluAlamatPublik: otomasi.isRemote() && !process.env.RAIVERSE_PUBLIC_URL, alamatPublikDiisi: !!process.env.RAIVERSE_PUBLIC_URL, n8nJauh: otomasi.isRemote(), catatan: 'Hanya panggilan balik webhook (mis. ringkasan lewat email) yang butuh alamat publik bila n8n ada di server lain.' } },
    skripNonaktifkanStaf: fs.existsSync(path.join(ROOT, 'scripts', 'n8n-staf-nonaktifkan.mjs')),
    mcp,
    whatsapp: { ...wa, status: wa.url && wa.kunci ? (wa.aktif ? 'Diatur dan dinyalakan.' : 'Diatur tetapi belum dinyalakan.') : 'Belum tersambung: WAHA belum diatur di server.' },
    email: { ...email, status: email.pengirim ? 'Alamat pengirim diatur; pengiriman lewat n8n.' : 'Belum tersambung: alamat pengirim email belum diatur di server.' },
  };
}

function stafStatus() {
  const counts = registry.counts(); const divs = store.run('main', () => store.get().divisions || []);
  const nama = (id) => divs.find((d) => d.id === id)?.name || id;
  const perDivisi = Object.entries(counts).map(([id, c]) => ({ id, nama: nama(id), ...c })).sort((a, b) => a.nama.localeCompare(b.nama));
  const tot = perDivisi.reduce((a, c) => ({ total: a.total + c.total, lengkap: a.lengkap + c.lengkap, rintisan: a.rintisan + c.rintisan }), { total: 0, lengkap: 0, rintisan: 0 });
  const s = store.run('main', () => store.get().settings), terpasang = store.run('main', () => store.get().employees.filter((e) => e.staffId).length);
  return {
    jumlah: tot, perDivisi, karyawanTertaut: terpasang,
    mesin: { pilihan: s.staffEngine ?? null, envMenimpa: process.env.RAIVERSE_STAFF_ENGINE || null, efektif: process.env.RAIVERSE_STAFF_ENGINE || s.staffEngine || 'native' },
    bendera: { staffModel: s.staffModel === true, autonomy: !!s.autonomy, autoApprove: !!s.autoApprove, autoActivate: s.autoActivate !== false, learning: !!s.learning, collectTraining: !!s.collectTraining, aiDitutup: platform.flag('aiClosed') },
    env: { modeUmum: limits.publicMode(), pendaftaran: process.env.RAIVERSE_SIGNUP || 'terbuka', muatMalas: process.env.STORE_LAZY === '1', modePenyimpananEnv: process.env.STORAGE_MODE || null },
  };
}

function hookStatus() { try { const r = JSON.parse(fs.readFileSync(path.join(dataDir(), 'otomasi.json'), 'utf8')); const it = r.items || []; return { total: it.length, versi2: it.filter((x) => x.hookV === 2).length, lama: it.filter((x) => x.hookToken || x.hookLegacy).length }; } catch { return { total: 0, versi2: 0, lama: 0 }; } }
function keamanan(url) {
  const q = url.searchParams, t = (k) => { const v = Date.parse(q.get(k) || ''); return Number.isFinite(v) ? v : 0; };
  const sesi = auth.adminSessions().sort((a, b) => b.dibuat - a.dibuat).slice(0, 100);
  const dry = privacy.migrateSecrets({ apply: false });
  return {
    audit: platform.readAudit({ aksi: String(q.get('aksi') || '').slice(0, 40), aktor: String(q.get('aktor') || '').slice(0, 80), hasil: String(q.get('hasil') || '').slice(0, 12), dari: t('dari'), sampai: t('sampai'), batas: num(q.get('batas')) || 100 }),
    sesi: { total: auth.adminSessions().length, daftar: sesi },
    ditolak: platform.deniedReport(),
    kunci: { sumber: secure.keySource(), versiSekarang: secure.currentKeyId(), jumlahVersi: secure.keyCount(), perluDibungkusUlang: dry.kunciAI + dry.ruangKerja, bisaDiputarDariKonsol: secure.keySource() === 'berkas' },
    hook: { ...hookStatus(), catatan: 'Token hook dibuat per otomasi. Memutarnya berarti memasang ulang alurnya di n8n; itu dilakukan per otomasi dari layar Otomasi, bukan massal dari konsol (belum dibangun).' },
  };
}

function dataStatus() {
  const d = dataDir(); const groups = { 'Ruang kerja utama': ['db.json', 'db.sqlite', 'db.sqlite-wal', 'db.sqlite-shm'], 'Ruang kerja pengguna': ['ws'], Akun: ['auth.json'], Otomasi: ['otomasi.json', 'staff-out'], Cadangan: ['backups'], 'Tempat sampah': ['trash'], 'Pengaturan konsol dan log': ['admin.json', 'admin-audit.jsonl', 'admin-audit.jsonl.1', 'limits.json', 'storage-flags.json'] };
  const seen = new Set(), ukuran = [];
  for (const [label, names] of Object.entries(groups)) { let b = 0; for (const n of names) { seen.add(n); b += sizeOf(path.join(d, n)); } ukuran.push({ label, byte: b }); }
  let lain = 0; try { for (const n of fs.readdirSync(d)) if (!seen.has(n) && !n.startsWith('.')) lain += sizeOf(path.join(d, n)); } catch { /* belum ada */ }
  ukuran.push({ label: 'Lainnya', byte: lain });
  const ws = store.ids().slice(0, 60).map((id) => ({ id, mode: store.storageMode(id) }));
  let pending = null; try { pending = JSON.parse(fs.readFileSync(pendingFile(), 'utf8')); } catch { /* tidak ada */ }
  return { ukuran, cadangan: listBackups().slice(0, 30), penyimpanan: { statistik: store.storageStats(), sqliteTersedia: sq.available(), ruangKerja: ws, bawaan: process.env.STORAGE_MODE || 'json' }, pemulihanTertunda: pending ? { nama: pending.nama, sejak: pending.t } : null };
}

// ═════════════════════ tabel rute ═════════════════════
// [metode, pola, fungsi(b, p, url, c)]; c.catat(sasaran, rincian) mengisi log audit untuk aksi yang mengubah.
const R = [];
const on = (m, p, aksi, fn) => R.push({ m, re: new RegExp('^/api/admin/' + p + '$'), aksi, fn });

on('GET', 'ringkasan', '', () => ringkasan());
on('GET', 'ai', '', () => aiStatus());
on('POST', 'ai/kunci', 'ai.kunci', (b, p, u, c) => { platform.setSecret(String(b.penyedia), b.nilai); c.catat(b.penyedia, 'kunci diisi atau diputar'); return aiStatus(); });   // daftar model Groq menyegar sendiri lewat /api/state
on('POST', 'ai/kunci/hapus', 'ai.kunci.hapus', (b, p, u, c) => { const n = String(b.penyedia); if (!platform.SECRET_NAMES.includes(n)) throw bad('Penyedia tidak dikenal'); confirm(b, `HAPUS KUNCI ${n.toUpperCase()}`); platform.clearSecret(n); c.catat(n, 'kunci platform dihapus'); return aiStatus(); });
on('POST', 'ai/uji', 'ai.uji', async (b, p, u, c) => { const r = await ujiPenyedia(String(b.penyedia), b.nilai); c.catat(b.penyedia, r.ok ? 'tersambung' : r.pesan); return r; });
on('POST', 'ai/model', 'ai.model', (b, p, u, c) => { platform.setModel(String(b.tingkat), b.model); c.catat(b.tingkat, b.model || '(bawaan)'); return aiStatus(); });
on('GET', 'batas', '', () => batasStatus());
on('POST', 'batas', 'batas.ubah', (b, p, u, c) => {
  const nilai = b.nilai && typeof b.nilai === 'object' && !Array.isArray(b.nilai) ? b.nilai : null; if (!nilai || !Object.keys(nilai).length) throw bad('Tidak ada yang diubah');
  for (const [k, v] of Object.entries(nilai)) { const d = platform.LIMIT_KEYS[k]; if (!d) throw bad(`Batas tidak dikenal: ${String(k).slice(0, 40)}`); if (v !== null && v !== '') { const n = Number(v); if (!Number.isFinite(n) || n < d[0] || n > d[1]) throw bad(`${d[3]}: nilai harus antara ${d[0]} dan ${d[1]}.`); } }
  for (const [k, v] of Object.entries(nilai)) platform.setLimit(k, v);
  c.catat(Object.keys(nilai).join(','), JSON.stringify(nilai)); return batasStatus();
});
on('POST', 'anggaran', 'anggaran.tutup', (b, p, u, c) => { if (b.tutup === true) { confirm(b, 'TUTUP ANGGARAN'); platform.setFlag('aiClosed', true); } else platform.setFlag('aiClosed', false); c.catat('aiClosed', b.tutup === true ? 'ditutup' : 'dibuka'); return batasStatus(); });

on('GET', 'pengguna', '', (b, p, url) => penggunaDaftar(url));
on('POST', 'pengguna/tangguhkan', 'pengguna.tangguhkan', (b, p, u, c) => { const x = auth.userById(String(b.id)); if (!x) throw bad('Akun tidak ada', 404); if (x.id === c.me?.id) throw bad('Kamu tidak bisa menangguhkan dirimu sendiri.', 400); const r = auth.setSuspended(x.id, b.ya === true); c.catat(x.email, b.ya === true ? 'ditangguhkan' : 'diaktifkan'); return r; });
on('POST', 'pengguna/ekspor', 'pengguna.ekspor', (b, p, u, c) => {
  const x = auth.userById(String(b.id)); if (!x) throw bad('Akun tidak ada', 404);
  const alasan = String(b.alasan || '').trim(); if (alasan.length < 10) throw bad('Tulis alasan ekspor (minimal 10 karakter). Alasan dicatat di log audit.');
  c.catat(x.email, `alasan: ${alasan.slice(0, 160)}`); return privacy.exportMine(x, null);
});
on('POST', 'pengguna/hapus', 'pengguna.hapus', async (b, p, u, c) => {
  const x = auth.userById(String(b.id)); if (!x) throw bad('Akun tidak ada', 404); if (x.id === c.me?.id) throw bad('Kamu tidak bisa menghapus akunmu sendiri dari konsol.', 400);
  confirm(b, `HAPUS ${x.email}`); const alasan = String(b.alasan || '').trim(); if (alasan.length < 10) throw bad('Tulis alasan penghapusan (minimal 10 karakter).');
  c.catat(x.email, `alasan: ${alasan.slice(0, 160)}`); return privacy.deleteMine(x, { konfirmasi: 'HAPUS AKUN SAYA' });
});

on('GET', 'integrasi', '', () => integrasi());
on('POST', 'integrasi/mcp', 'integrasi.mcp.tambah', async (b, p, u, c) => {
  const url = await collab.assertMcpUrl(String(b.url || ''), 'main').catch((e) => { throw bad(e.message); });
  const nama = String(b.nama || '').trim().slice(0, 40) || 'MCP';
  const headers = {}; if (b.headers && typeof b.headers === 'object' && !Array.isArray(b.headers)) for (const [k, v] of Object.entries(b.headers).slice(0, 8)) if (/^[\w-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 400) headers[k] = v;
  store.run('main', () => { const s = store.get().settings, list = s.mcpServers || []; if (list.length >= 12) throw bad('Terlalu banyak server MCP (maksimal 12).'); const id = slug(nama).replace(/-/g, '').slice(0, 16) || `mcp${list.length}`; if (list.some((m) => m.id === id)) throw bad('Nama itu sudah dipakai server MCP lain.'); store.setRoot('settings', { ...s, mcpServers: [...list, { id, name: nama, url, headers, enabled: true }] }); });
  collab.resetMcp(); c.catat(nama, origin(url)); return integrasi();
});
on('POST', 'integrasi/mcp/hapus', 'integrasi.mcp.hapus', (b, p, u, c) => {
  const m = mainSettings((s) => (s.mcpServers || []).find((x) => x.id === String(b.id))); if (!m) throw bad('Server MCP tidak ada', 404);
  confirm(b, `HAPUS ${m.name}`); store.run('main', () => { const s = store.get().settings; store.setRoot('settings', { ...s, mcpServers: (s.mcpServers || []).filter((x) => x.id !== m.id) }); });
  collab.resetMcp(); c.catat(m.name, origin(m.url)); return integrasi();
});
on('POST', 'integrasi/mcp/uji', 'integrasi.mcp.uji', async (b, p, u, c) => {
  const m = mainSettings((s) => (s.mcpServers || []).find((x) => x.id === String(b.id))); if (!m) throw bad('Server MCP tidak ada', 404);
  try { const tools = await store.run('main', () => collab.mcpListTools(m, true)); c.catat(m.name, `${tools.length} alat`); return { ok: true, jumlahAlat: tools.length }; }
  catch (err) { c.catat(m.name, 'gagal', 'gagal'); return { ok: false, pesan: 'Server MCP tidak menjawab dengan benar.' }; }
});
on('POST', 'integrasi/n8n/cek-sekarang', 'integrasi.n8n.cek-sekarang', async (b, p, u, c) => { const n = await otomasi.pollOnce(); c.catat('n8n', `${n} hasil diambil`); return { diambil: n, status: otomasi.pollStatus() }; });
on('POST', 'integrasi/n8n/nonaktifkan-staf', 'integrasi.n8n.nonaktifkan-staf', async (b, p, u, c) => {
  confirm(b, 'NONAKTIFKAN STAF N8N');
  const script = path.join(ROOT, 'scripts', 'n8n-staf-nonaktifkan.mjs'); if (!fs.existsSync(script)) throw bad('Skrip penonaktif belum tersedia di server ini (scripts/n8n-staf-nonaktifkan.mjs).', 409);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, N8N_URL: process.env.N8N_URL, N8N_API_KEY: process.env.N8N_API_KEY, DATA_DIR: dataDir() };
  const r = await exec(process.execPath, [script], { cwd: ROOT, env, timeout: 60000, maxBuffer: 1e6, windowsHide: true });
  const teks = (r.out + r.err).replace(process.env.N8N_API_KEY || '\u0000', '[disamarkan]').slice(0, 1500);
  c.catat('staf-n8n', `kode ${r.code}`, r.code === 0 ? 'ok' : 'gagal'); return { ok: r.code === 0, kode: r.code, keluaran: teks };
});

on('GET', 'staf', '', () => stafStatus());
on('GET', 'kesehatan', '', () => kesehatan.status());
on('POST', 'kesehatan/uji', 'kesehatan.uji', (b, p, u, c) => { c.catat('uji-nyata', `cakupan ${b.cakupan || 'kemampuan'}, batas ${b.batasUSD ?? 0.05} USD`); return kesehatan.ujiUlang({ cakupan: b.cakupan, batasUSD: b.batasUSD }); });
on('POST', 'staf/bendera', 'staf.bendera', (b, p, u, c) => {
  const ch = {};
  if ('staffModel' in b) { if (typeof b.staffModel !== 'boolean') throw bad('staffModel harus true atau false'); ch.staffModel = b.staffModel; }
  if ('staffEngine' in b) { if (!['native', 'n8n'].includes(b.staffEngine)) throw bad('Mesin staf harus native atau n8n'); ch.staffEngine = b.staffEngine; }
  if (!Object.keys(ch).length) throw bad('Tidak ada yang diubah');
  store.run('main', () => store.setRoot('settings', { ...store.get().settings, ...ch })); c.catat(Object.keys(ch).join(','), JSON.stringify(ch)); return stafStatus();
});

on('GET', 'keamanan', '', (b, p, url) => keamanan(url));
on('POST', 'keamanan/sesi/cabut', 'keamanan.sesi.cabut', (b, p, u, c) => { const r = auth.revokeSessionRef(b.ref); c.catat(String(b.ref).slice(0, 12), 'sesi dicabut'); return r; });
on('POST', 'keamanan/sesi/cabut-akun', 'keamanan.sesi.cabut-akun', (b, p, u, c) => { const x = auth.userById(String(b.id)); if (!x) throw bad('Akun tidak ada', 404); confirm(b, `CABUT SESI ${x.email}`); const r = auth.revokeUserSessions(x.id); c.catat(x.email, `${r.ditutup} sesi dicabut`); return r; });
on('POST', 'keamanan/kunci/bungkus-ulang', 'keamanan.kunci.bungkus-ulang', (b, p, u, c) => { confirm(b, 'BUNGKUS ULANG RAHASIA'); const r = privacy.migrateSecrets({ apply: true }); r.rahasiaPlatform = platform.resealAll(); c.catat('rahasia', JSON.stringify(r)); return r; });
on('POST', 'keamanan/kunci/putar', 'keamanan.kunci.putar', (b, p, u, c) => { confirm(b, 'PUTAR KUNCI ENKRIPSI'); const k = secure.rotateFileKey(); const r = privacy.migrateSecrets({ apply: true }); r.rahasiaPlatform = platform.resealAll(); c.catat('kunci', `versi ${k.versi}`); return { ...k, dibungkusUlang: r }; });

on('GET', 'data', '', () => dataStatus());
on('POST', 'data/cadangan', 'data.cadangan', (b, p, u, c) => { const r = makeBackup({ dataDir: dataDir(), label: String(b.label || 'konsol').slice(0, 30) || 'konsol' }); c.catat(path.basename(r.dir), `${r.manifest.files.length} berkas`); return { nama: path.basename(r.dir), berkas: r.manifest.files.length }; });
on('POST', 'data/cadangan/periksa', 'data.cadangan.periksa', (b, p, u, c) => { const nama = String(b.nama || ''); if (!/^[\w.-]{5,80}$/.test(nama)) throw bad('Nama cadangan tidak valid'); const dir = path.join(dataDir(), 'backups', nama); if (!fs.existsSync(dir)) throw bad('Cadangan tidak ada', 404); const masalah = verifyBackup(dir); c.catat(nama, masalah.length ? `${masalah.length} masalah` : 'sah'); return { sah: !masalah.length, masalah }; });
on('POST', 'data/pulihkan', 'data.pulihkan', (b, p, u, c) => {
  const nama = String(b.nama || ''); if (!/^[\w.-]{5,80}$/.test(nama)) throw bad('Nama cadangan tidak valid'); const dir = path.join(dataDir(), 'backups', nama); if (!fs.existsSync(dir)) throw bad('Cadangan tidak ada', 404);
  confirm(b, `PULIHKAN ${nama}`);
  const masalah = verifyBackup(dir); if (masalah.length) throw bad(`Cadangan tidak sah: ${masalah.slice(0, 3).join('; ')}`);
  secure.writeAtomic(pendingFile(), JSON.stringify({ nama, t: Date.now() }), { mode: 0o600 });
  c.catat(nama, 'pemulihan dijadwalkan (diterapkan saat server dimulai ulang)');
  return { dijadwalkan: true, nama, catatan: 'Pemulihan dijadwalkan dan baru diterapkan saat server dimulai ulang; keadaan sekarang dicadangkan otomatis lebih dulu. Perubahan setelah ini sampai mulai ulang akan tertimpa.' };
});
on('POST', 'data/pulihkan/batal', 'data.pulihkan.batal', (b, p, u, c) => { try { fs.unlinkSync(pendingFile()); } catch { /* tidak ada */ } c.catat('pemulihan', 'dibatalkan'); return dataStatus(); });
on('GET', 'data/bandingkan', '', (b, p, url) => {
  const id = String(url.searchParams.get('ws') || ''); if (!store.exists(id)) throw bad('Ruang kerja tidak ada', 404);
  const mode = store.storageMode(id); if (mode === 'json') return { ws: id, mode, dibandingkan: false, pesan: 'Mode json tidak punya salinan SQLite untuk dibandingkan. Alihkan ke dual dulu.' };
  const beda = store.verifyWorkspace(id); return { ws: id, mode, dibandingkan: true, sama: !beda.length, beda };
});
on('POST', 'data/penyimpanan', 'data.penyimpanan', (b, p, u, c) => {
  const id = String(b.ws || ''), mode = String(b.mode || ''); if (!store.exists(id)) throw bad('Ruang kerja tidak ada', 404); if (!store.STORAGE_MODES.includes(mode)) throw bad('Mode tidak dikenal');
  const now = store.storageMode(id); if (now === mode) throw bad('Ruang kerja itu sudah memakai mode tersebut.');
  if (mode === 'sqlite') { if (now !== 'dual') throw bad('Beralih ke sqlite hanya dari mode dual. Alihkan ke dual dulu dan biarkan pembanding berjalan.', 409); const beda = store.verifyWorkspace(id); if (beda.length) throw bad(`JSON dan SQLite masih berbeda pada: ${beda.slice(0, 5).join(', ')}. Alih ke sqlite ditolak.`, 409); confirm(b, `ALIHKAN ${id} KE SQLITE`); }
  if (now === 'sqlite') throw bad('Keluar dari sqlite memakai skrip: node scripts/storage-migrate.mjs rollback (cadangan otomatis).', 409);
  if (mode === 'dual' && now !== 'json') throw bad('Mode dual hanya dari mode json.', 409);
  store.setStorageMode(id, mode); c.catat(id, `${now} -> ${mode}`); return dataStatus();
});

// ═════════════════════ penangan ═════════════════════
const sendJson = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
const lastDenied = new Map();
function originOk(req) {
  const site = req.headers['sec-fetch-site']; if (site && site !== 'same-origin' && site !== 'none') return false;
  const o = req.headers.origin; if (!o) return true;
  try {
    const h = new URL(o).host, ok = new Set([String(req.headers.host || '')]);
    if (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-host']) ok.add(String(req.headers['x-forwarded-host']).split(',')[0].trim());
    if (process.env.RAIVERSE_PUBLIC_URL) { try { ok.add(new URL(process.env.RAIVERSE_PUBLIC_URL).host); } catch { /* diabaikan */ } }
    return ok.has(h);
  } catch { return false; }
}
/** Dipanggil index.js untuk setiap /api/admin/*. ctx = { me, body } (body = pembaca JSON permintaan milik server). Mengembalikan true (sudah dijawab). */
export async function handle(req, res, url, { me, body }) {
  const ip = limits.clientIp(req), who = me?.id || `anon:${ip}`;
  if (!isAdmin(me, req)) {
    platform.denied({ code: 403, ip, path: url.pathname, alasan: 'bukan pengelola' });
    const k = `${ip}`; if (Date.now() - (lastDenied.get(k) || 0) > 60000) { lastDenied.set(k, Date.now()); if (lastDenied.size > 2000) lastDenied.clear(); platform.audit({ aktor: me?.email || 'anonim', ip, aksi: 'admin.ditolak', sasaran: url.pathname.slice(0, 80), hasil: 'ditolak' }); }
    return sendJson(res, 403, { error: 'Tidak diizinkan.' }), true;
  }
  const mutating = !['GET', 'HEAD'].includes(req.method);
  const rl = limits.hit(`admin:${who}`, { limit: Number(process.env.RATE_ADMIN_PER_MIN) || 240 }), rw = mutating ? limits.hit(`adminw:${who}`, { limit: Number(process.env.RATE_ADMIN_WRITE_PER_MIN) || 40 }) : { ok: true };
  if (!rl.ok || !rw.ok) { platform.denied({ code: 429, ip, path: url.pathname, alasan: 'konsol' }); res.setHeader?.('Retry-After', String(Math.max(rl.retryAfter || 1, rw.retryAfter || 1))); return sendJson(res, 429, { error: 'Terlalu cepat. Tunggu sebentar.' }), true; }
  if (mutating && (req.headers['x-raiverse-admin'] !== '1' || !originOk(req))) { platform.audit({ aktor: me?.email || 'lokal', ip, aksi: 'admin.csrf', sasaran: url.pathname.slice(0, 80), hasil: 'ditolak' }); platform.denied({ code: 403, ip, path: url.pathname, alasan: 'asal' }); return sendJson(res, 403, { error: 'Permintaan ditolak (asal tidak dikenal).' }), true; }
  const route = R.find((r) => r.m === req.method && r.re.test(url.pathname));
  if (!route) return sendJson(res, 404, { error: 'Tidak ditemukan.' }), true;
  const aktor = me?.email || 'pemilik-lokal'; const c = { me, sasaran: '', rincian: '', hasil: 'ok', catat(s, r = '', h = 'ok') { this.sasaran = s; this.rincian = r; this.hasil = h; } };
  try {
    const b = mutating ? await body(req) : {};
    if (mutating && (b === null || typeof b !== 'object' || Array.isArray(b))) throw bad('Isi permintaan harus berupa objek JSON');
    const out = await route.fn(b, {}, url, c);
    if (route.aksi) platform.audit({ aktor, ip, aksi: route.aksi, sasaran: c.sasaran, hasil: c.hasil, rincian: c.rincian });
    return sendJson(res, 200, out), true;
  } catch (err) {
    const code = Number.isInteger(err.code) ? err.code : (err instanceof SyntaxError ? 400 : 500);
    if (route.aksi) platform.audit({ aktor, ip, aksi: route.aksi, sasaran: c.sasaran, hasil: 'gagal', rincian: code >= 500 ? 'galat server' : err.message });
    if (code >= 500) console.error('[admin]', route.aksi || url.pathname, err.message);
    return sendJson(res, code, { error: code >= 500 ? 'Terjadi galat di server.' : err instanceof SyntaxError ? 'Isi permintaan bukan JSON yang sah.' : err.message }), true;
  }
}
