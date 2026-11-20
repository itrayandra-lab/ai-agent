// KONFIGURASI TUNGGAL RAIVERSE. Satu tempat yang mendaftar SEMUA variabel lingkungan (.env) dan semua pengaturan per ruang kerja
// (db().settings), lengkap dengan nilai bawaan, arti, dan validasi. Peta bacaan untuk Owner: docs/PETA-BACKEND.md bagian "Konfigurasi".
//
// Aturan:
//  - Modul ini TIDAK mengimpor apa pun dari server (hanya node:path), jadi boleh dipakai siapa saja tanpa putaran impor.
//  - Nilai dibaca LANGSUNG dari process.env tiap dipanggil (tidak disimpan), sama seperti kode lama: tes dan .env yang dimuat belakangan tetap bekerja.
//  - Setiap process.env.NAMA di server/ (di luar server/staff/) WAJIB terdaftar di ENV_KEYS (dijaga test/invariants.test.js).
//  - Pembacaan baru lewat config.get('NAMA') / config.dataDir(), bukan process.env langsung.
//  - Rahasia (rahasia: true) tidak pernah dicetak; table() hanya menyatakan apakah terisi.
import path from 'node:path';

// tipe: teks | angka (kosong/tidak valid -> bawaan, 0 sah) | positif (harus > 0, selain itu bawaan) | satu (hanya "1" yang menyalakan) | daftar (pisah koma)
const K = (grup, tipe, bawaan, arti, extra = {}) => ({ grup, tipe, bawaan, arti, ...extra });

export const ENV_KEYS = {
  // ── Inti server
  PORT: K('inti', 'angka', 4317, 'Port server. Server Owner memakai 4400; tes memakai 4540-4629.', { cek: (v) => v >= 1 && v <= 65535 }),
  HOST: K('inti', 'teks', '127.0.0.1', 'Alamat dengar. 0.0.0.0 agar bisa dibuka dari HP di jaringan yang sama.'),
  DATA_DIR: K('inti', 'teks', null, 'Folder data. Kosong = folder "data" di folder aplikasi. Tes memakai folder sementara.'),
  TICK_ACTIVE_MS: K('inti', 'angka', 60000, 'Berapa lama setelah pesan terakhir mesin kerja dianggap "aktif" (ms).'),
  TRUST_PROXY: K('inti', 'satu', false, '1 = percaya header X-Forwarded-* dari reverse proxy (untuk alamat IP dan host).'),
  RAIVERSE_PUBLIC_URL: K('inti', 'teks', '', 'Alamat publik aplikasi (https). Dibutuhkan webhook Telegram dan panggilan balik n8n jauh.'),
  RAIVERSE_PUBLIC_MODE: K('inti', 'satu', false, '1 = mode publik: batas global dan penutup anggaran menyala (default lokal mati).'),
  RAIVERSE_SEAL_ON_BOOT: K('inti', 'satu', false, '1 = saat boot, rahasia lama dibungkus ulang ke amplop terenkripsi.'),
  // ── Penyimpanan
  STORAGE_MODE: K('penyimpanan', 'teks', null, 'Mode penyimpanan bawaan: json (RESMI) | dual | sqlite. Berkas data/storage-flags.json per ruang kerja lebih kuat dari ini.', { cek: (v) => ['json', 'dual', 'sqlite'].includes(v) }),
  STORE_LAZY: K('penyimpanan', 'satu', false, '1 = ruang kerja dimuat saat dibutuhkan, bukan semuanya saat boot.'),
  STORE_IDLE_MS: K('penyimpanan', 'angka', 600000, 'Ruang kerja yang menganggur selama ini dikeluarkan dari memori (mode malas).'),
  STORE_VERIFY_EVERY: K('penyimpanan', 'angka', 50, 'Mode dual: pembanding JSON vs SQLite tiap N simpan (0 = hanya yang pertama).'),
  STORE_TASK_LOG_CAP: K('penyimpanan', 'angka', 300, 'Batas baris catatan per tugas yang disimpan.'),
  ARCHIVE_DIR: K('penyimpanan', 'teks', null, 'Folder arsip data demo yang dibuang. Kosong = "arsip-dummy" (di dalam DATA_DIR bila DATA_DIR diisi).'),
  RAIVERSE_NO_SQLITE: K('penyimpanan', 'teks', '', 'Isi apa saja = pencarian riwayat memakai cadangan kata kunci, bukan SQLite.'),
  // ── AI
  GROQ_API_KEY: K('ai', 'teks', '', 'Kunci Groq (mesin AI bawaan). Bisa juga diisi di konsol admin.', { rahasia: true }),
  ANTHROPIC_API_KEY: K('ai', 'teks', '', 'Kunci Anthropic (Claude), pilihan lain.', { rahasia: true }),
  RAY_PROMPT_OBROLAN: K('ai', 'teks', 'baru', 'Versi perilaku obrolan: "baru" (bawaan) atau "lama" (hanya untuk membandingkan mutu di scripts/evaluasi-obrolan.mjs).'),
  RAY_GROQ_BASE_URL: K('ai', 'teks', 'https://api.groq.com/openai/v1', 'Alamat API Groq (diubah hanya untuk tes).'),
  RAY_ANTHROPIC_BASE_URL: K('ai', 'teks', 'https://api.anthropic.com', 'Alamat API Anthropic (diubah hanya untuk tes).'),
  GATE_TTL_MS: K('ai', 'positif', 120000, 'Umur token gerbang AI untuk alur n8n (ms).'),
  RATE_GATE_PER_MIN: K('ai', 'positif', 20, 'Batas panggilan gerbang AI per ruang kerja per menit.'),
  TTS_PYTHON: K('ai', 'teks', '', 'Perintah Python untuk suara edge-tts (kosong = python3, python, py).'),
  // ── Login dan keamanan
  GOOGLE_CLIENT_ID: K('login', 'teks', '', 'ID klien OAuth Google. Login Google aktif hanya bila 4 hal terisi: ini, rahasia klien, SESSION_SECRET, TOKEN_ENC_KEY.'),
  GOOGLE_CLIENT_SECRET: K('login', 'teks', '', 'Rahasia klien OAuth Google.', { rahasia: true }),
  GOOGLE_REDIRECT_URI: K('login', 'teks', '', 'Alamat balik login Google.'),
  GOOGLE_REDIRECT_URIS: K('login', 'daftar', '', 'Alamat balik tambahan (pisah koma).'),
  GOOGLE_PICKER_API_KEY: K('login', 'teks', '', 'Kunci Google Picker (pemilih berkas Drive).', { rahasia: true }),
  GOOGLE_AUTH_URL: K('login', 'teks', '', 'Alamat OAuth lain (hanya untuk tes).'),
  GOOGLE_TOKEN_URL: K('login', 'teks', '', 'Alamat token lain (hanya untuk tes).'),
  GOOGLE_USERINFO_URL: K('login', 'teks', '', 'Alamat userinfo lain (hanya untuk tes).'),
  GOOGLE_REVOKE_URL: K('login', 'teks', '', 'Alamat pencabutan lain (hanya untuk tes).'),
  GOOGLE_API_BASE: K('login', 'teks', 'https://www.googleapis.com', 'Alamat API Google Drive (diubah hanya untuk tes).'),
  SESSION_SECRET: K('login', 'teks', '', 'Rahasia penanda tangan sesi login.', { rahasia: true }),
  TOKEN_ENC_KEY: K('login', 'teks', '', 'Kunci enkripsi token dan rahasia di disk (AES-256-GCM).', { rahasia: true }),
  RAIVERSE_KEYS: K('login', 'teks', '', 'Daftar kunci berversi untuk rotasi kunci enkripsi.', { rahasia: true }),
  AUTH_DISABLED: K('login', 'teks', '', 'Isi apa saja = login dimatikan (hanya untuk pemulihan darurat).'),
  RAIVERSE_ADMIN_EMAILS: K('login', 'daftar', '', 'Email pengelola platform (pisah koma). Hanya mereka yang melihat konsol admin.'),
  RAIVERSE_CLAIM_CODE: K('login', 'teks', '', 'Kode untuk mengklaim kantor utama pada server baru.', { rahasia: true }),
  RAIVERSE_SIGNUP: K('login', 'teks', 'terbuka', 'Pendaftaran akun baru: terbuka | tutup.'),
  INVITE_MAX_USES: K('login', 'positif', 10, 'Pemakaian maksimum satu tautan undangan.'),
  WS_LIFETIME_PER_ACCOUNT: K('login', 'angka', null, 'Batas jumlah ruang kerja seumur hidup per akun (lihat limits.js).'),
  WS_PER_IP_DAY: K('login', 'angka', null, 'Batas ruang kerja baru per alamat IP per hari (lihat limits.js).'),
  // ── Batas laju dan kuota (angka bawaan ada di server/limits.js; konsol admin bisa menimpa tanpa .env)
  RATE_API_IP_PER_MIN: K('batas', 'angka', 900, 'Permintaan API per alamat IP per menit.'),
  RATE_AUTH_IP_PER_MIN: K('batas', 'angka', 30, 'Permintaan login per alamat IP per menit.'),
  RATE_HOOK_IP_PER_MIN: K('batas', 'angka', 120, 'Panggilan webhook per alamat IP per menit.'),
  RATE_ACCOUNT_PER_MIN: K('batas', 'angka', 600, 'Permintaan per akun per menit.'),
  RATE_HEAVY_PER_MIN: K('batas', 'angka', 30, 'Pekerjaan berat per akun per menit.'),
  RATE_ADMIN_PER_MIN: K('batas', 'angka', 240, 'Permintaan konsol admin per orang per menit.'),
  RATE_ADMIN_WRITE_PER_MIN: K('batas', 'angka', 40, 'Perubahan lewat konsol admin per orang per menit.'),
  MAX_STREAMS_PER_USER: K('batas', 'angka', 6, 'Sambungan langsung (SSE) bersamaan per pengguna.'),
  GLOBAL_DAILY_BUDGET_USD: K('batas', 'angka', null, 'Anggaran AI harian seluruh platform (USD). Bawaan 0 di mode lokal, 25 di mode publik.'),
  QUOTA_TASK_DAY: K('batas', 'angka', 150, 'Tugas per akun per hari (juga QUOTA_TASK_DAY_GLOBAL = 3000).'),
  QUOTA_MESSAGE_DAY: K('batas', 'angka', 400, 'Pesan ke agen per akun per hari (juga QUOTA_MESSAGE_DAY_GLOBAL = 8000).'),
  QUOTA_TTS_DAY: K('batas', 'angka', 200, 'Suara per akun per hari (juga QUOTA_TTS_DAY_GLOBAL = 4000).'),
  QUOTA_N8N_DAY: K('batas', 'angka', 60, 'Eksekusi otomasi per akun per hari (juga QUOTA_N8N_DAY_GLOBAL = 1500).'),
  QUOTA_GATE_DAY: K('batas', 'angka', 120, 'Panggilan AI dari otomasi per akun per hari (juga QUOTA_GATE_DAY_GLOBAL = 3000).'),
  QUOTA_WS_CREATE_DAY: K('batas', 'angka', 1, 'Ruang kerja baru per akun per hari (juga QUOTA_WS_CREATE_DAY_GLOBAL = 40).'),
  // ── Privasi dan retensi
  PRIVACY_TRASH_DAYS: K('privasi', 'positif', 7, 'Hari ruang kerja yang dihapus pemiliknya disimpan di data/trash sebelum dibuang.'),
  RETENTION_EVENT_DAYS: K('privasi', 'angka', 90, 'Umur maksimum kejadian (hari).'),
  RETENTION_MESSAGE_DAYS: K('privasi', 'angka', 365, 'Umur maksimum pesan (hari).'),
  RETENTION_APPLY_MAIN: K('privasi', 'satu', false, '1 = retensi juga berlaku untuk kantor utama.'),
  // ── Otomasi (n8n), WhatsApp, email
  N8N_URL: K('otomasi', 'teks', 'http://127.0.0.1:5678', 'Alamat n8n. n8n sekarang hanya untuk jadwal dan pemicu luar, bukan eksekusi staf.'),
  N8N_API_KEY: K('otomasi', 'teks', '', 'Kunci API n8n.', { rahasia: true }),
  N8N_MAIL_FROM: K('otomasi', 'teks', '', 'Alamat pengirim email dari otomasi.'),
  N8N_SMTP_CREDENTIAL_ID: K('otomasi', 'teks', '', 'ID kredensial SMTP di n8n.'),
  N8N_SMTP_CREDENTIAL_NAME: K('otomasi', 'teks', 'SMTP', 'Nama kredensial SMTP di n8n.'),
  WAHA_URL: K('otomasi', 'teks', 'http://127.0.0.1:3000', 'Alamat WAHA (WhatsApp).'),
  WAHA_API_KEY: K('otomasi', 'teks', '', 'Kunci API WAHA.', { rahasia: true }),
  WAHA_ENABLED: K('otomasi', 'teks', '', '1 atau true = WhatsApp dinyalakan.'),
  OTOMASI_FILE: K('otomasi', 'teks', null, 'Lokasi berkas daftar otomasi. Kosong = DATA_DIR/otomasi.json.'),
  OTOMASI_POLL_MS: K('otomasi', 'positif', 60000, 'Jeda pengambilan hasil otomasi dari n8n (ms).'),
  OTOMASI_SHARED_SENDERS: K('otomasi', 'satu', false, '1 = ruang kerja non-utama boleh memakai pengirim bersama.'),
  OTOMASI_LEGACY_HOOK_UNTIL: K('otomasi', 'teks', '', 'Tanggal ISO batas panggilan webhook lama tanpa tanda tangan (setelahnya 410).'),
  HOOK_SKEW_MS: K('otomasi', 'positif', 300000, 'Toleransi selisih jam tanda tangan webhook (ms).'),
  // ── Saluran chat
  TELEGRAM_API_BASE: K('saluran', 'teks', 'https://api.telegram.org', 'Alamat API Telegram (diubah hanya untuk tes).'),
  // ── Saluran chat: angka bawaan hidup di server/channels/*.js (dibaca lewat num()), dicatat di sini
  CHANNEL_RATE_PER_MIN: K('saluran', 'angka', 12, 'Pesan per orang luar per menit sebelum diperlambat.'),
  CHANNEL_CODE_TRIES: K('saluran', 'angka', 8, 'Percobaan kode tautan per orang luar per 10 menit.'),
  CHANNEL_WS_RATE_PER_MIN: K('saluran', 'angka', 60, 'Pesan saluran per ruang kerja per menit.'),
  CHANNEL_POLL_MS: K('saluran', 'angka', 4000, 'Jeda memeriksa kemajuan pekerjaan untuk dibalas ke chat (ms).'),
  CHANNEL_POLL_MAX: K('saluran', 'angka', 150, 'Berapa kali kemajuan diperiksa sebelum berhenti menunggu.'),
  CHANNEL_CODES_PER_HOUR: K('saluran', 'angka', 6, 'Kode tautan baru per akun per jam.'),
  CHANNEL_BACKOFF_MAX_MS: K('saluran', 'angka', 60000, 'Jeda maksimum sebelum sambung ulang bila saluran terputus (ms).'),
  CHANNEL_TG_POLL_SECS: K('saluran', 'angka', 25, 'Lama satu pengambilan pesan Telegram (detik).'),
  DISCORD_API_BASE: K('saluran', 'teks', 'https://discord.com/api/v10', 'Alamat API Discord (diubah hanya untuk tes).'),
  // ── Browser agen dan MCP
  RAIVERSE_BROWSER_MCP_ENTRY: K('browser', 'teks', '', 'Lokasi berkas masuk chrome-devtools-mcp (kosong = data/browser-mcp).'),
  RAIVERSE_BROWSER_CHROME: K('browser', 'teks', '', 'Lokasi Chrome yang dipakai browser agen.'),
  RAIVERSE_BROWSER_ALLOW_LOOPBACK: K('browser', 'satu', false, 'KHUSUS TES: izinkan alamat lokal (aplikasi sendiri tetap diblokir).'),
  RAIVERSE_BROWSER_FORCE_BUSY: K('browser', 'satu', false, 'KHUSUS TES: paksa status sibuk.'),
  RAIVERSE_BROWSER_SKIP_LOAD_CHECK: K('browser', 'satu', false, 'KHUSUS TES: lewati cek beban CPU.'),
  MCP_BLOCK_PRIVATE: K('browser', 'satu', false, '1 = server MCP ke alamat pribadi diblokir juga di kantor utama.'),
  // ── Staf (dibaca di server/staff/*, milik mesin staf)
  RAIVERSE_STAFF_ENGINE: K('staf', 'teks', '', 'Mesin staf: native (RESMI, bawaan) | n8n. Menimpa pengaturan ruang kerja staffEngine.', { cek: (v) => ['', 'native', 'n8n'].includes(v) }),
  STAFF_CATALOG_DIR: K('staf', 'teks', null, 'Lokasi katalog staf. Kosong = server/staff-catalog.'),
  STAFF_CAP_DIR: K('staf', 'teks', null, 'Lokasi katalog kemampuan staf.'),
  STAFF_DEPLOY_FILE: K('staf', 'teks', null, 'Lokasi catatan alur staf di n8n. Kosong = DATA_DIR/staff-deploy.json.'),
  STAFF_RUNS_FILE: K('staf', 'teks', null, 'Lokasi catatan jalan staf. Kosong = DATA_DIR/staff-runs.json.'),
  STAFF_OUT_DIR: K('staf', 'teks', null, 'Lokasi berkas hasil staf. Kosong = DATA_DIR/staff-out.'),
  // ── Bawaan sistem (bukan milik RAIVERSE, hanya dibaca)
  PATH: K('sistem', 'teks', '', 'PATH sistem (dipakai konsol admin untuk menemukan perintah).'),
};

// ───────────────────────── pembacaan ─────────────────────────
const raw = (name) => process.env[name];
const kosong = (v) => v === undefined || v === null || v === '';

/** Nilai terkoersi menurut tipe di ENV_KEYS, atau bawaannya. Nama yang tidak terdaftar = kesalahan pemrogram. */
export function get(name) {
  const s = ENV_KEYS[name];
  if (!s) throw new Error(`Variabel lingkungan tidak terdaftar di server/config.js: ${name}`);
  const v = raw(name);
  if (s.tipe === 'satu') return v === '1';
  if (kosong(v)) return s.tipe === 'daftar' ? [] : s.bawaan;
  if (s.tipe === 'angka') { const n = Number(v); return Number.isFinite(n) ? n : s.bawaan; }
  if (s.tipe === 'positif') { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : s.bawaan; }
  if (s.tipe === 'daftar') return String(v).split(',').map((x) => x.trim()).filter(Boolean);
  return String(v);
}

/** nilai mentah apa adanya (undefined bila tidak ada), untuk pemanggil yang membedakan "tidak diisi" dari "kosong" */
export const has = (name) => { if (!ENV_KEYS[name]) throw new Error(`Variabel lingkungan tidak terdaftar: ${name}`); return !kosong(raw(name)); };

/** folder data; dibaca ulang tiap panggilan */
export const dataDir = () => get('DATA_DIR') || path.resolve('data');
export const port = () => get('PORT');
export const host = () => get('HOST');

// ───────────────────────── pengaturan per ruang kerja (db().settings) ─────────────────────────
// status: 'resmi' = dipakai sekarang | 'usang' = masih ada demi kompatibilitas, jangan diandalkan | 'rahasia' = tidak pernah dikirim ke klien
export const SETTINGS = {
  provider: { bawaan: 'auto', arti: 'Penyedia AI: auto (Groq bila ada kuncinya, lalu Claude, lalu simulasi) | groq | claude.', status: 'resmi' },
  model: { bawaan: 'claude-opus-5-5', arti: 'Model besar Claude (pemimpin).', status: 'resmi' },
  workerModel: { bawaan: 'claude-opus-5-5', arti: 'Model Claude untuk pekerja.', status: 'resmi' },
  groqModel: { bawaan: 'openai/gpt-oss-120b', arti: 'Model Groq untuk pemimpin.', status: 'resmi' },
  groqWorkerModel: { bawaan: 'openai/gpt-oss-120b', arti: 'Model Groq untuk pekerja.', status: 'resmi' },
  effort: { bawaan: 'low', arti: 'Tingkat usaha berpikir model (low/medium/high).', status: 'resmi' },
  apiKey: { bawaan: '', arti: 'Kunci Claude milik ruang kerja (amplop terenkripsi).', status: 'rahasia' },
  groqApiKey: { bawaan: '', arti: 'Kunci Groq milik ruang kerja (amplop terenkripsi).', status: 'rahasia' },
  dailyBudgetUSD: { bawaan: 5, arti: 'Anggaran AI harian ruang kerja (USD). Ruang kerja baru: workspaceBudgetUSD kantor utama (0,5).', status: 'resmi' },
  workspaceBudgetUSD: { bawaan: 0.5, arti: 'Hanya di kantor utama: anggaran harian untuk setiap ruang kerja BARU.', status: 'resmi' },
  quota: { bawaan: { tasksPerDay: 300, n8nRunsPerDay: 100 }, arti: 'Jatah harian per ruang kerja: jumlah tugas dan eksekusi n8n. 0 = tanpa batas.', status: 'resmi' },
  autonomy: { bawaan: true, arti: 'Mesin kerja berjalan sendiri (mengambil tugas dari antrean).', status: 'resmi' },
  tickMs: { bawaan: 2500, arti: 'Jeda mesin kerja memeriksa antrean (ms).', status: 'resmi' },
  maxConcurrent: { bawaan: 3, arti: 'Jumlah tugas AI yang boleh berjalan bersamaan per ruang kerja.', status: 'resmi' },
  autoApprove: { bawaan: true, arti: 'Hasil kerja disetujui otomatis (kartu review/kebijakan). Jenis review, otomasi, dan aksi browser TIDAK pernah otomatis.', status: 'resmi' },
  autoActivate: { bawaan: true, arti: 'Skill baru otomatis memberi agen tool yang dibutuhkannya.', status: 'resmi' },
  autoOrganize: { bawaan: true, arti: 'Brain dirapikan otomatis oleh Arsa.', status: 'resmi' },
  massDispatchSize: { bawaan: 20, arti: 'Jumlah penerima di atas ini dianggap pekerjaan massal (mode hemat token).', status: 'resmi' },
  learning: { bawaan: undefined, arti: 'Agen belajar dari pengalaman (skill dan memori buatan agen, selalu menunggu persetujuan).', status: 'resmi' },
  collectTraining: { bawaan: undefined, arti: 'Simpan contoh kerja berkualitas untuk dataset fine-tuning.', status: 'resmi' },
  progressiveSkills: { bawaan: undefined, arti: 'Prompt hanya memuat daftar skill; isi lewat skill_view. false = bentuk lama (semua isi skill di prompt).', status: 'usang' },
  staffEngine: { bawaan: 'native', arti: 'Mesin staf: native (RESMI) | n8n. Env RAIVERSE_STAFF_ENGINE menimpa.', status: 'resmi' },
  staffModel: { bawaan: false, arti: 'Bendera P0 lama ("staf = alur n8n"). Sekarang tidak mengubah eksekusi staf; hanya menentukan apakah starterDb() menyertakan staf. Dibiarkan karena tes, konsol admin, dan data lama memakainya.', status: 'usang' },
  mode: { bawaan: 'auto', arti: 'Mode lama tampilan/Owner; tidak dibaca mesin. Dibiarkan demi data lama.', status: 'usang' },
  currentUserId: { bawaan: 'owner', arti: 'Siapa pengguna aktif sebelum login Google dipasang (ruang kerja lokal tunggal).', status: 'resmi' },
  mcpServers: { bawaan: [], arti: 'Server MCP luar (hanya konsol admin).', status: 'resmi' },
  googleAppsScript: { bawaan: { url: '', secret: '', enabled: false }, arti: 'Konektor Google Apps Script (alamat, rahasia, aktif).', status: 'resmi' },
  uiKeys: { bawaan: undefined, arti: 'Pemetaan tombol keyboard antarmuka (klien).', status: 'resmi' },
  staf: { bawaan: undefined, arti: 'Batas mesin native: { nativePerDay: 2000, otakPerDay: 200 }.', status: 'resmi' },
};

// ───────────────────────── validasi dan tabel ─────────────────────────
/** daftar masalah konfigurasi (kosong = baik). Tidak pernah melempar dan tidak mencetak nilai rahasia. */
export function validate() {
  const out = [];
  for (const [name, s] of Object.entries(ENV_KEYS)) {
    const v = raw(name);
    if (kosong(v)) continue;
    if ((s.tipe === 'angka' || s.tipe === 'positif') && !Number.isFinite(Number(v))) out.push(`${name} harus angka (nilai sekarang tidak valid; memakai bawaan ${s.bawaan}).`);
    else if (s.tipe === 'positif' && Number(v) <= 0) out.push(`${name} harus lebih dari 0 (memakai bawaan ${s.bawaan}).`);
    else if (s.tipe === 'satu' && v !== '1' && v !== '0') out.push(`${name} hanya mengenal 1 (nyala); nilai lain dianggap mati.`);
    if (s.cek && !s.rahasia) { const nilai = s.tipe === 'teks' ? String(v) : Number(v); if (!s.cek(nilai)) out.push(`${name} bernilai tidak dikenal (${String(v).slice(0, 40)}).`); }
  }
  const login = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET', 'TOKEN_ENC_KEY'].filter((n) => has(n));
  if (login.length > 0 && login.length < 4) out.push('Login Google setengah terisi: butuh GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, dan TOKEN_ENC_KEY sekaligus; selama belum lengkap login tidak aktif.');
  const url = raw('RAIVERSE_PUBLIC_URL'); if (!kosong(url) && !/^https?:\/\//i.test(url)) out.push('RAIVERSE_PUBLIC_URL harus diawali http:// atau https://.');
  return out;
}

/** tabel untuk dokumentasi dan konsol: tanpa nilai rahasia (hanya "terisi") */
export function table() {
  return Object.entries(ENV_KEYS).map(([nama, s]) => ({ nama, grup: s.grup, tipe: s.tipe, bawaan: s.bawaan, arti: s.arti, rahasia: !!s.rahasia, terisi: has(nama), nilai: s.rahasia || !has(nama) ? undefined : get(nama) }));
}
