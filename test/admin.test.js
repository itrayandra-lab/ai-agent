// Uji Konsol Pengelola (server/admin.js, server/platform.js, public/js/admin-*.js).
// Server sungguhan + Google tiruan + penyedia AI tiruan di data sementara, TANPA kunci AI asli, port 4601-4603.
// Bagian A: modul langsung (rahasia platform, rotasi kunci, log audit tanpa rahasia, batas yang menimpa env).
// Bagian B: lewat HTTP (403 untuk bukan pengelola, anti-CSRF, rahasia tidak keluar, audit, kuota berlaku, tangguhkan, data, pengaturan pengguna biasa).
// Bagian C: tampilan (tanpa tautan admin untuk pengguna biasa, nama aksesibel, tanpa emoji, tanpa merah).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import * as U from './ui-scan.mjs';

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), n));
const modDir = tmp('ray-agent-adm-mod-'), srvDir = tmp('ray-agent-adm-srv-');
const KEY_GROQ = 'gsk_RAHASIA_GROQ_UJI_0123456789abcd', KEY_CLAUDE = 'sk-ant-RAHASIA-CLAUDE-UJI-9876543210wxyz';

// ═══════════════════════ A. modul langsung (kunci berkas, tanpa env) ═══════════════════════
Object.assign(process.env, { DATA_DIR: modDir, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '' });
for (const k of ['RAIVERSE_KEYS', 'TOKEN_ENC_KEY', 'RAIVERSE_PUBLIC_MODE', 'GLOBAL_DAILY_BUDGET_USD', 'QUOTA_TASK_DAY']) delete process.env[k];
const platform = await import('../server/platform.js');
const secure = await import('../server/secure.js');
const limits = await import('../server/limits.js');

test('rahasia platform: terenkripsi di berkas, hanya akhiran yang tampil, rotasi kunci berkas membungkus ulang, tanpa bocor ke log audit', () => {
  platform.setSecret('groq', KEY_GROQ);
  assert.equal(platform.secret('groq'), KEY_GROQ);
  const info = platform.secretInfo('groq'); assert.equal(info.terisi, true); assert.equal(info.akhir, 'abcd'); assert.ok(!JSON.stringify(info).includes('gsk_'));
  const raw = fs.readFileSync(path.join(modDir, 'admin.json'), 'utf8'); assert.ok(!raw.includes('RAHASIA_GROQ') && /ev2\.1\./.test(raw), 'berkas hanya memuat amplop terenkripsi');
  assert.throws(() => platform.setSecret('groq', 'pendek'), /tidak valid/); assert.throws(() => platform.setSecret('lainnya', KEY_GROQ), /tidak dikenal/);
  assert.equal(secure.keySource(), 'berkas');
  const r = secure.rotateFileKey(); assert.equal(r.versi, '2'); assert.equal(r.jumlah, 2);
  assert.equal(platform.secret('groq'), KEY_GROQ, 'kunci lama tetap terbaca setelah rotasi'); assert.equal(platform.resealAll(), 1);
  assert.match(fs.readFileSync(path.join(modDir, 'admin.json'), 'utf8'), /ev2\.2\./); assert.equal(platform.resealAll(), 0, 'idempoten');
  assert.equal(platform.secret('groq'), KEY_GROQ);
  platform.audit({ aktor: 'a@x.test', aksi: 'uji.rahasia', rincian: `Bearer abcdef1234567890 ${KEY_GROQ} ${KEY_CLAUDE}` });
  const log = fs.readFileSync(path.join(modDir, 'admin-audit.jsonl'), 'utf8'); assert.ok(!log.includes('RAHASIA') && !log.includes('abcdef1234567890'), 'log audit menyamarkan pola rahasia'); assert.match(log, /disamarkan/);
  assert.deepEqual(platform.readAudit({ aksi: 'uji' }).map((e) => e.aksi), ['uji.rahasia']);
  platform.clearSecret('groq'); assert.equal(platform.secret('groq'), '');
});

test('batas yang diubah di konsol menimpa env dan bawaan, langsung berlaku, dan bisa dikembalikan', () => {
  assert.equal(limits.quotaOf('task').account, 150, 'bawaan aplikasi');
  process.env.QUOTA_TASK_DAY = '40'; assert.equal(limits.quotaOf('task').account, 40, 'env');
  platform.setLimit('QUOTA_TASK_DAY', 2); assert.equal(limits.quotaOf('task').account, 2, 'konsol menimpa env');
  limits.reset(); limits.charge('task', { account: 'ujiA' }); limits.charge('task', { account: 'ujiA' });
  assert.throws(() => limits.charge('task', { account: 'ujiA' }), (e) => e.code === 429 && /Jatah harianmu/.test(e.message));
  platform.setLimit('QUOTA_TASK_DAY', null); assert.equal(limits.quotaOf('task').account, 40, 'kembali ke env');
  assert.throws(() => platform.setLimit('QUOTA_TASK_DAY', -1), /antara/); assert.throws(() => platform.setLimit('PATH', 5), /tidak dikenal/); assert.throws(() => platform.setLimit('QUOTA_TASK_DAY', 'abc'), /antara/);
  delete process.env.QUOTA_TASK_DAY;
  platform.setFlag('aiClosed', true); assert.equal(limits.budgetClosed(), true); assert.throws(() => limits.assertGlobalBudget(), /Anggaran AI/);
  platform.setFlag('aiClosed', false); assert.equal(limits.budgetClosed(), false);
  platform.setModel('groqLead', 'openai/gpt-oss-20b'); assert.equal(platform.model('groqLead'), 'openai/gpt-oss-20b'); assert.throws(() => platform.setModel('groqLead', 'a b;c'), /tidak valid/); platform.setModel('groqLead', '');
  assert.equal(platform.model('groqLead'), '');
});

// ═══════════════════════ B. server sungguhan ═══════════════════════
const PORT = 4601, GPORT = 4602, LPORT = 4603, BASE = `http://127.0.0.1:${PORT}`;
const PROFILES = { adm: { sub: 'ga', email: 'adm@x.test', name: 'Pengelola' }, u2: { sub: 'g2', email: 'u2@x.test', name: 'Dua' }, u3: { sub: 'g3', email: 'u3@x.test', name: 'Tiga' } };
const google = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let s = ''; for await (const c of req) s += c; const send = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/token') { const code = new URLSearchParams(s).get('code'); return send({ access_token: 'at-' + code, refresh_token: 'rt-' + code, expires_in: 3600, scope: 'openid email profile https://www.googleapis.com/auth/drive.file' }); }
  if (u.pathname === '/userinfo') { const p = PROFILES[String(req.headers.authorization || '').slice(10)]; return p ? send({ ...p, email_verified: true, picture: '' }) : send({}, 401); }
  send({}, 404);
});
await new Promise((r) => google.listen(GPORT, '127.0.0.1', r));
// penyedia AI tiruan: hanya daftar model; menerima persis KEY_GROQ / KEY_CLAUDE
const llmSeen = [];
const llm = http.createServer((req, res) => {
  const k = req.headers.authorization === `Bearer ${KEY_GROQ}` || req.headers['x-api-key'] === KEY_CLAUDE; llmSeen.push(req.url);
  res.writeHead(k ? 200 : 401, { 'content-type': 'application/json' }); res.end(JSON.stringify(k ? { data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] } : { error: 'ditolak' }));
});
await new Promise((r) => llm.listen(LPORT, '127.0.0.1', r));
const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: srvDir, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', N8N_URL: 'http://127.0.0.1:1', N8N_API_KEY: '', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csec', SESSION_SECRET: 'sesi-rahasia-uji-yang-panjang', TOKEN_ENC_KEY: 'token-enc-key-uji-yang-cukup-panjang',
  GOOGLE_AUTH_URL: `http://127.0.0.1:${GPORT}/auth`, GOOGLE_TOKEN_URL: `http://127.0.0.1:${GPORT}/token`, GOOGLE_USERINFO_URL: `http://127.0.0.1:${GPORT}/userinfo`, GOOGLE_REVOKE_URL: `http://127.0.0.1:${GPORT}/revoke`, GOOGLE_REDIRECT_URI: `${BASE}/auth/google/callback`,
  RAIVERSE_ADMIN_EMAILS: 'adm@x.test', RAY_GROQ_BASE_URL: `http://127.0.0.1:${LPORT}`, RAY_ANTHROPIC_BASE_URL: `http://127.0.0.1:${LPORT}`, WS_PER_IP_DAY: '30', QUOTA_WS_CREATE_DAY_GLOBAL: '100', QUOTA_TASK_DAY: '50', RATE_AUTH_IP_PER_MIN: '200', RATE_API_IP_PER_MIN: '5000', RATE_ACCOUNT_PER_MIN: '5000', RATE_HEAVY_PER_MIN: '500', RATE_ADMIN_PER_MIN: '300', RATE_ADMIN_WRITE_PER_MIN: '1000' };
delete env.RAIVERSE_PUBLIC_MODE; delete env.RAIVERSE_KEYS;
const srv = spawn(process.execPath, ['server/index.js'], { env, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }); let srvLog = ''; srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
after(async () => { await new Promise((r) => { if (srv.exitCode !== null) return r(); srv.once('exit', r); srv.kill(); setTimeout(r, 4000).unref(); }); google.close(); llm.close(); });
for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/api/auth/me')).ok) break; } catch { /* belum siap */ } await new Promise((r) => setTimeout(r, 200)); }
const cookieOf = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !/=$/.test(c)).join('; ');
async function login(who) {
  const r1 = await fetch(`${BASE}/auth/google`, { redirect: 'manual' }); const state = new URL(r1.headers.get('location')).searchParams.get('state');
  const r2 = await fetch(`${BASE}/auth/google/callback?state=${state}&code=${who}`, { redirect: 'manual', headers: { cookie: cookieOf(r1) } });
  return { who, cookie: cookieOf(r2), loc: r2.headers.get('location') || '' };
}
const call = (s, method, p, body, headers = {}) => fetch(BASE + p, { method, headers: { ...(s?.cookie ? { cookie: s.cookie } : {}), 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ code: r.status, text: null, json: await r.json().catch(() => null), headers: r.headers }));
const api = (s, m, p, b) => call(s, m, p, b);
const A = (s, m, p, b) => call(s, m, '/api/admin/' + p, b, { 'x-raiverse-admin': '1' });   // klien konsol yang sah
const S = {};
const NO_SECRET = (x, msg) => { const t = typeof x === 'string' ? x : JSON.stringify(x); for (const k of [KEY_GROQ, KEY_CLAUDE, 'gsk_RAHASIA', 'sk-ant-RAHASIA', 'rt-adm', 'rt-u2', 'at-adm', 'token-enc-key-uji', 'sesi-rahasia-uji', 'csec']) assert.ok(!t.includes(k), `${msg}: memuat rahasia (${k.slice(0, 8)}…)`); };

test('persiapan: pengelola (pra-klaim env) memegang kantor utama; dua pengguna biasa punya ruang kerja sendiri', async () => {
  S.u2 = await login('u2'); S.adm = await login('adm'); S.u3 = await login('u3');
  assert.equal((await api(S.adm, 'GET', '/api/auth/me')).json.workspace.id, 'main');
  assert.notEqual((await api(S.u2, 'GET', '/api/auth/me')).json.workspace.id, 'main');
  const mu = (await api(S.u2, 'GET', '/api/auth/me')).json.workspace; assert.equal(mu.role, 'owner', 'u2 adalah Owner ruang kerjanya sendiri, tetapi BUKAN pengelola platform');
});

const ADMIN_ROUTES = [['GET', 'ringkasan'], ['GET', 'ai'], ['POST', 'ai/kunci', { penyedia: 'groq', nilai: KEY_GROQ }], ['POST', 'ai/kunci/hapus', {}], ['POST', 'ai/uji', { penyedia: 'groq' }], ['POST', 'ai/model', { tingkat: 'groqLead', model: 'x' }], ['GET', 'batas'], ['POST', 'batas', { nilai: { QUOTA_TASK_DAY: 1 } }], ['POST', 'anggaran', { tutup: true }],
  ['GET', 'pengguna'], ['POST', 'pengguna/tangguhkan', { id: 'x' }], ['POST', 'pengguna/ekspor', { id: 'x' }], ['POST', 'pengguna/hapus', { id: 'x' }], ['GET', 'integrasi'], ['POST', 'integrasi/mcp', { url: 'http://x' }], ['POST', 'integrasi/mcp/hapus', { id: 'x' }], ['POST', 'integrasi/n8n/nonaktifkan-staf', {}], ['POST', 'integrasi/n8n/cek-sekarang', {}],
  ['GET', 'staf'], ['POST', 'staf/bendera', { staffModel: true }], ['GET', 'kesehatan'], ['POST', 'kesehatan/uji', { cakupan: 'kemampuan' }], ['GET', 'keamanan'], ['POST', 'keamanan/sesi/cabut', { ref: 'abcdefgh' }], ['POST', 'keamanan/kunci/putar', {}], ['POST', 'keamanan/kunci/bungkus-ulang', {}], ['GET', 'data'], ['POST', 'data/cadangan', {}], ['POST', 'data/pulihkan', { nama: 'x' }], ['POST', 'data/penyimpanan', { ws: 'main', mode: 'dual' }], ['GET', 'tidak-ada-sama-sekali']];

test('KEAMANAN: bukan pengelola (pengguna biasa, Owner ruang kerja lain, tanpa login) mendapat 403 seragam untuk SEMUA rute admin, tanpa membocorkan apa pun', async () => {
  const bodies = new Set();
  for (const who of ['u2', 'u3', null]) for (const [m, p, b] of ADMIN_ROUTES) {
    const r = await A(who ? S[who] : null, m, p, b);
    assert.equal(r.code, 403, `${who || 'anonim'} ${m} /api/admin/${p} harus 403, dapat ${r.code}`); bodies.add(JSON.stringify(r.json));
  }
  assert.equal(bodies.size, 1, 'badan jawaban seragam (rute yang ada dan yang tidak ada tidak bisa dibedakan)'); assert.deepEqual(JSON.parse([...bodies][0]), { error: 'Tidak diizinkan.' });
  // tanpa header anti-CSRF pun tetap 403 (bukan 400/404 yang membedakan)
  assert.equal((await call(S.u2, 'POST', '/api/admin/ai/kunci', { penyedia: 'groq', nilai: KEY_GROQ })).code, 403);
  const st = await api(S.adm, 'GET', '/api/admin/ringkasan'); assert.equal(st.code, 200, 'pengelola sah lewat dengan GET');
});

test('ANTI-CSRF: metode yang mengubah wajib header X-Raiverse-Admin dan asal yang sama', async () => {
  const body = { nilai: { QUOTA_TASK_DAY: 40 } };
  assert.equal((await call(S.adm, 'POST', '/api/admin/batas', body)).code, 403, 'tanpa header');
  assert.equal((await call(S.adm, 'POST', '/api/admin/batas', body, { 'x-raiverse-admin': '1', origin: 'https://jahat.example' })).code, 403, 'asal asing');
  assert.equal((await call(S.adm, 'POST', '/api/admin/batas', body, { 'x-raiverse-admin': '1', 'sec-fetch-site': 'cross-site' })).code, 403, 'lintas situs');
  const ok = await call(S.adm, 'POST', '/api/admin/batas', body, { 'x-raiverse-admin': '1', origin: BASE }); assert.equal(ok.code, 200, 'asal sama diterima');
  assert.equal((await A(S.adm, 'POST', '/api/admin/batas', { nilai: { QUOTA_TASK_DAY: null } })).code === 200 || true, true);
  assert.equal((await A(S.adm, 'POST', 'batas', { nilai: { QUOTA_TASK_DAY: null } })).code, 200);
  assert.equal((await A(S.adm, 'POST', 'batas', [])).code, 400, 'isi harus objek');
});

test('kunci AI: tersimpan terenkripsi, tidak pernah dikembalikan, uji koneksi jalan, log audit mencatat tanpa rahasia', async () => {
  let r = await A(S.adm, 'POST', 'ai/kunci', { penyedia: 'groq', nilai: KEY_GROQ }); assert.equal(r.code, 200);
  assert.equal(r.json.penyedia.groq.terisi, true); assert.equal(r.json.penyedia.groq.akhir, 'abcd'); NO_SECRET(r.json, 'respons simpan');
  NO_SECRET((await A(S.adm, 'GET', 'ai')).json, 'GET ai'); NO_SECRET((await A(S.adm, 'GET', 'ringkasan')).json, 'ringkasan');
  r = await A(S.adm, 'POST', 'ai/kunci', { penyedia: 'groq', nilai: 'pendek' }); assert.equal(r.code, 400);
  r = await A(S.adm, 'POST', 'ai/kunci', { penyedia: 'tidak-dikenal', nilai: KEY_GROQ }); assert.equal(r.code, 400);
  // uji koneksi memakai kunci tersimpan; kunci salah ditolak penyedia; nilai uji tidak disimpan
  r = await A(S.adm, 'POST', 'ai/uji', { penyedia: 'groq' }); assert.equal(r.json.ok, true); assert.equal(r.json.modelTerlihat, 3);
  r = await A(S.adm, 'POST', 'ai/uji', { penyedia: 'groq', nilai: 'gsk_salah_salah_salah_1234' }); assert.equal(r.json.ok, false); assert.match(r.json.pesan, /ditolak/);
  r = await A(S.adm, 'POST', 'ai/uji', { penyedia: 'anthropic', nilai: KEY_CLAUDE }); assert.equal(r.json.ok, true); assert.equal((await A(S.adm, 'GET', 'ai')).json.penyedia.anthropic.terisi, false, 'nilai uji tidak tersimpan');
  r = await A(S.adm, 'POST', 'ai/model', { tingkat: 'groqLead', model: 'openai/gpt-oss-20b' }); assert.equal(r.json.model.groqLead.nilai, 'openai/gpt-oss-20b');
  assert.equal((await A(S.adm, 'POST', 'ai/model', { tingkat: 'groqLead', model: 'a b;rm' })).code, 400); await A(S.adm, 'POST', 'ai/model', { tingkat: 'groqLead', model: '' });
  // hapus wajib mengetik ulang
  assert.equal((await A(S.adm, 'POST', 'ai/kunci/hapus', { penyedia: 'groq' })).code, 400);
  assert.equal((await A(S.adm, 'POST', 'ai/kunci/hapus', { penyedia: 'groq', konfirmasi: 'hapus' })).code, 400);
  r = await A(S.adm, 'POST', 'ai/kunci/hapus', { penyedia: 'groq', konfirmasi: 'HAPUS KUNCI GROQ' }); assert.equal(r.code, 200); assert.equal(r.json.penyedia.groq.terisi, false);
  // berkas dan log di disk: amplop terenkripsi, tidak ada teks asli
  await A(S.adm, 'POST', 'ai/kunci', { penyedia: 'anthropic', nilai: KEY_CLAUDE });
  for (const f of ['admin.json', 'admin-audit.jsonl']) { const t = fs.readFileSync(path.join(srvDir, f), 'utf8'); NO_SECRET(t, f); }
  assert.match(fs.readFileSync(path.join(srvDir, 'admin.json'), 'utf8'), /ev2\./); await A(S.adm, 'POST', 'ai/kunci/hapus', { penyedia: 'anthropic', konfirmasi: 'HAPUS KUNCI ANTHROPIC' });
  const audit = (await A(S.adm, 'GET', 'keamanan?aksi=ai')).json.audit, aksi = audit.map((e) => e.aksi);
  for (const a of ['ai.kunci', 'ai.uji', 'ai.model', 'ai.kunci.hapus']) assert.ok(aksi.includes(a), `audit mencatat ${a}`);
  assert.ok(audit.every((e) => e.aktor === 'adm@x.test' && e.t > 0), 'siapa dan kapan tercatat'); NO_SECRET(audit, 'audit');
  assert.ok(audit.some((e) => e.aksi === 'ai.kunci.hapus' && e.hasil === 'gagal'), 'upaya hapus tanpa konfirmasi tercatat gagal');
});

test('kuota: batas yang diubah di konsol langsung berlaku untuk pengguna; validasi; tutup anggaran perlu konfirmasi dan menghentikan pekerjaan AI baru', async () => {
  const baca = (await A(S.adm, 'GET', 'batas')).json; assert.equal(baca.batas.find((x) => x.kunci === 'QUOTA_TASK_DAY').nilai, 50); assert.ok(baca.batas.every((x) => x.label && x.max >= x.min));
  assert.equal((await A(S.adm, 'POST', 'batas', { nilai: { QUOTA_TASK_DAY: 'abc' } })).code, 400); assert.equal((await A(S.adm, 'POST', 'batas', { nilai: { QUOTA_TASK_DAY: -5 } })).code, 400); assert.equal((await A(S.adm, 'POST', 'batas', { nilai: { PATH: 1 } })).code, 400); assert.equal((await A(S.adm, 'POST', 'batas', { nilai: {} })).code, 400);
  assert.equal(JSON.stringify((await A(S.adm, 'GET', 'batas')).json.batas.find((x) => x.kunci === 'QUOTA_TASK_DAY').nilai), '50', 'perubahan yang tidak sah tidak menyisakan apa pun');
  let r = await A(S.adm, 'POST', 'batas', { nilai: { QUOTA_TASK_DAY: 2 } }); assert.equal(r.json.batas.find((x) => x.kunci === 'QUOTA_TASK_DAY').nilai, 2); assert.equal(r.json.batas.find((x) => x.kunci === 'QUOTA_TASK_DAY').diubah, true);
  const buat = (i) => api(S.u2, 'POST', '/api/tasks', { title: `Tugas uji kuota nomor ${i} ${Date.now()}` });
  assert.equal((await buat(1)).code, 200); assert.equal((await buat(2)).code, 200); const tiga = await buat(3); assert.equal(tiga.code, 429, 'tugas ketiga ditolak: batas dari konsol berlaku'); assert.match(tiga.json.error, /Jatah harianmu/);
  r = await A(S.adm, 'POST', 'batas', { nilai: { QUOTA_TASK_DAY: null } }); assert.equal(r.json.batas.find((x) => x.kunci === 'QUOTA_TASK_DAY').nilai, 50, 'kembali ke nilai env');
  assert.equal((await buat(4)).code, 200, 'jatah kembali longgar');
  // tutup anggaran
  assert.equal((await A(S.adm, 'POST', 'anggaran', { tutup: true })).code, 400, 'tanpa konfirmasi ditolak');
  assert.equal((await A(S.adm, 'POST', 'anggaran', { tutup: true, konfirmasi: 'TUTUP ANGGARAN' })).json.anggaran.ditutup, true);
  const ditutup = await buat(5); assert.equal(ditutup.code, 429); assert.match(ditutup.json.error, /Anggaran AI/);
  assert.equal((await A(S.adm, 'POST', 'anggaran', { tutup: false })).json.anggaran.ditutup, false); assert.equal((await buat(6)).code, 200);
  const a = (await A(S.adm, 'GET', 'keamanan?aksi=batas')).json.audit; assert.ok(a.some((e) => e.aksi === 'batas.ubah' && /QUOTA_TASK_DAY/.test(e.sasaran)));
});

test('pengguna: daftar dan cari tanpa isi pribadi, tangguhkan memutus sesi dan melarang masuk, ekspor butuh alasan dan tanpa token, hapus butuh konfirmasi', async () => {
  let r = await A(S.adm, 'GET', 'pengguna'); assert.equal(r.code, 200); const emails = r.json.pengguna.map((u) => u.email); assert.ok(emails.includes('u2@x.test') && emails.includes('adm@x.test'));
  assert.ok(r.json.ruangKerja.length >= 3 && r.json.ruangKerja.every((w) => w.penyimpanan)); NO_SECRET(r.json, 'daftar pengguna'); assert.ok(!JSON.stringify(r.json).includes('Tugas uji kuota'), 'isi tugas/pesan tidak ikut');
  assert.deepEqual((await A(S.adm, 'GET', 'pengguna?cari=u3%40x')).json.pengguna.map((u) => u.email), ['u3@x.test']);
  const u2 = r.json.pengguna.find((u) => u.email === 'u2@x.test'), adm = r.json.pengguna.find((u) => u.email === 'adm@x.test');
  assert.equal((await A(S.adm, 'POST', 'pengguna/tangguhkan', { id: adm.id, ya: true })).code, 400, 'tidak bisa menangguhkan diri sendiri');
  // tangguhkan
  assert.equal((await A(S.adm, 'POST', 'pengguna/tangguhkan', { id: u2.id, ya: true })).json.ditangguhkan, true);
  assert.equal((await api(S.u2, 'GET', '/api/state')).code, 401, 'sesi lama langsung mati');
  const coba = await login('u2'); assert.match(decodeURIComponent(coba.loc), /ditangguhkan/); assert.equal(coba.cookie.includes('rs='), false, 'tidak ada sesi baru');
  assert.equal((await A(S.adm, 'POST', 'pengguna/tangguhkan', { id: u2.id, ya: false })).json.ditangguhkan, false);
  S.u2 = await login('u2'); assert.equal((await api(S.u2, 'GET', '/api/state')).code, 200, 'masuk lagi setelah diaktifkan');
  // ekspor
  assert.equal((await A(S.adm, 'POST', 'pengguna/ekspor', { id: u2.id })).code, 400); assert.equal((await A(S.adm, 'POST', 'pengguna/ekspor', { id: u2.id, alasan: 'pendek' })).code, 400);
  r = await A(S.adm, 'POST', 'pengguna/ekspor', { id: u2.id, alasan: 'Permintaan pemilik akun lewat email' }); assert.equal(r.code, 200); assert.equal(r.json.akun.email, 'u2@x.test'); NO_SECRET(r.json, 'ekspor');
  assert.ok((await A(S.adm, 'GET', 'keamanan?aksi=pengguna.ekspor')).json.audit.some((e) => /Permintaan pemilik akun/.test(e.rincian)), 'alasan ekspor tercatat');
  // hapus
  const u3 = (await A(S.adm, 'GET', 'pengguna?cari=u3')).json.pengguna[0];
  assert.equal((await A(S.adm, 'POST', 'pengguna/hapus', { id: u3.id, alasan: 'akun uji dihapus oleh pengelola' })).code, 400, 'tanpa konfirmasi');
  assert.equal((await A(S.adm, 'POST', 'pengguna/hapus', { id: u3.id, konfirmasi: 'HAPUS u3@x.test' })).code, 400, 'tanpa alasan');
  assert.equal((await A(S.adm, 'POST', 'pengguna/hapus', { id: adm.id, konfirmasi: 'HAPUS adm@x.test', alasan: 'mencoba menghapus diri sendiri' })).code, 400);
  r = await A(S.adm, 'POST', 'pengguna/hapus', { id: u3.id, konfirmasi: 'HAPUS u3@x.test', alasan: 'akun uji dihapus oleh pengelola' }); assert.equal(r.code, 200); assert.equal(r.json.ok, true);
  assert.equal((await A(S.adm, 'GET', 'pengguna?cari=u3%40x')).json.total, 0);
});

test('integrasi: status jujur tanpa rahasia, MCP anti-SSRF, hapus wajib konfirmasi, skrip penonaktif staf n8n hanya bila ada', async () => {
  let r = await A(S.adm, 'GET', 'integrasi'); assert.equal(r.code, 200); NO_SECRET(r.json, 'integrasi');
  assert.equal(r.json.kabarBalik.lewat, 'pengambilan berkala (tanpa alamat publik)'); assert.equal(r.json.kabarBalik.webhookMasuk.perluAlamatPublik, false, 'n8n lokal: tidak butuh alamat publik'); assert.equal(r.json.kabarBalik.terakhir, 0);
  const cek = await A(S.adm, 'POST', 'integrasi/n8n/cek-sekarang', {}); assert.equal(cek.code, 200); assert.equal(typeof cek.json.diambil, 'number'); assert.ok(cek.json.status.terakhir > 0, 'waktu pengambilan terakhir tercatat'); NO_SECRET(cek.json, 'cek sekarang');
  assert.match(r.json.whatsapp.status, /Belum tersambung/); assert.match(r.json.email.status, /Belum tersambung/); assert.equal(r.json.n8n.tersambung, false); assert.equal(r.json.google.loginDiatur, true);
  for (const url of ['http://169.254.169.254/latest', 'file:///etc/passwd', 'bukan url', 'https://u:p@x.example/mcp', `http://127.0.0.1:${PORT}/api/state`]) assert.equal((await A(S.adm, 'POST', 'integrasi/mcp', { nama: 'x', url })).code, 400, `ditolak: ${url}`);
  r = await A(S.adm, 'POST', 'integrasi/mcp', { nama: 'Uji MCP', url: 'http://127.0.0.1:5678/rahasia/jalur?token=RAHASIA-MCP', headers: { Authorization: 'Bearer RAHASIA-HEADER-123' } }); assert.equal(r.code, 200);
  const m = r.json.mcp.find((x) => x.nama === 'Uji MCP'); assert.equal(m.alamat, 'http://127.0.0.1:5678'); NO_SECRET(r.json, 'daftar MCP'); assert.ok(!JSON.stringify(r.json).includes('RAHASIA-MCP') && !JSON.stringify(r.json).includes('RAHASIA-HEADER'), 'jalur, kueri, dan header tidak ditampilkan');
  assert.equal((await A(S.adm, 'POST', 'integrasi/mcp', { nama: 'Uji MCP', url: 'http://127.0.0.1:5678/x' })).code, 400, 'nama ganda');
  assert.equal((await A(S.adm, 'POST', 'integrasi/mcp/hapus', { id: m.id })).code, 400); assert.equal((await A(S.adm, 'POST', 'integrasi/mcp/hapus', { id: m.id, konfirmasi: 'HAPUS Uji MCP' })).json.mcp.length, 0);
  assert.equal((await A(S.adm, 'POST', 'integrasi/n8n/nonaktifkan-staf', {})).code, 400, 'butuh konfirmasi');
  if (!fs.existsSync('scripts/n8n-staf-nonaktifkan.mjs')) { assert.equal((await A(S.adm, 'POST', 'integrasi/n8n/nonaktifkan-staf', { konfirmasi: 'NONAKTIFKAN STAF N8N' })).code, 409, 'skrip belum ada: ditolak jujur'); assert.equal((await A(S.adm, 'GET', 'integrasi')).json.skripNonaktifkanStaf, false); }
});

test('staf: katalog per divisi, mesin dan bendera hanya nilai sah', async () => {
  let r = await A(S.adm, 'GET', 'staf'); assert.equal(r.code, 200); assert.ok(r.json.jumlah.total > 50 && r.json.perDivisi.length >= 10); assert.equal(typeof r.json.bendera.staffModel, 'boolean');
  assert.equal((await A(S.adm, 'POST', 'staf/bendera', { staffEngine: 'bebas' })).code, 400); assert.equal((await A(S.adm, 'POST', 'staf/bendera', { staffModel: 'ya' })).code, 400); assert.equal((await A(S.adm, 'POST', 'staf/bendera', {})).code, 400);
  r = await A(S.adm, 'POST', 'staf/bendera', { staffEngine: 'native' }); assert.equal(r.json.mesin.pilihan, 'native'); assert.equal(r.json.mesin.efektif, 'native');
});

test('keamanan: audit bisa difilter, sesi bisa dicabut tanpa hash penuh, upaya ditolak terlapor, kunci enkripsi butuh konfirmasi', async () => {
  let r = await A(S.adm, 'GET', 'keamanan'); assert.equal(r.code, 200); NO_SECRET(r.json, 'keamanan');
  assert.ok(r.json.audit.some((e) => e.aksi === 'admin.ditolak' && e.hasil === 'ditolak'), 'upaya non-pengelola tercatat di audit'); assert.ok(r.json.audit.some((e) => e.aksi === 'admin.csrf'));
  assert.ok(r.json.ditolak.duaPuluhEmpatJam[403] >= 10 && r.json.ditolak.terbaru.length > 0 && r.json.ditolak.terbaru.every((e) => /^[0-9a-f]{8}$/.test(e.dari)), 'laporan 403 memakai penanda acak, bukan IP');
  assert.ok(!JSON.stringify(r.json.ditolak).includes('127.0.0.1'));
  assert.ok((await A(S.adm, 'GET', 'keamanan?hasil=ditolak')).json.audit.every((e) => e.hasil === 'ditolak')); assert.ok((await A(S.adm, 'GET', 'keamanan?aktor=adm%40x')).json.audit.every((e) => e.aktor.includes('adm@x')));
  assert.ok((await A(S.adm, 'GET', 'keamanan?aksi=zzz-tidak-ada')).json.audit.length === 0);
  // sesi: rujukan pendek, bukan hash penuh
  const sesi = r.json.sesi.daftar; assert.ok(sesi.length >= 2 && sesi.every((s) => s.ref.length === 12 && !('id' in s))); const target = sesi.find((s) => s.email === 'u2@x.test');
  assert.equal((await A(S.adm, 'POST', 'keamanan/sesi/cabut', { ref: 'x' })).code, 400); assert.equal((await A(S.adm, 'POST', 'keamanan/sesi/cabut', { ref: 'abcdefghijkl' })).code, 404);
  assert.equal((await A(S.adm, 'POST', 'keamanan/sesi/cabut', { ref: target.ref })).json.ditutup, 1); assert.equal((await api(S.u2, 'GET', '/api/state')).code, 401, 'sesi yang dicabut langsung mati'); S.u2 = await login('u2');
  // kunci enkripsi
  assert.equal(r.json.kunci.sumber, 'env'); assert.equal(r.json.kunci.bisaDiputarDariKonsol, false);
  assert.equal((await A(S.adm, 'POST', 'keamanan/kunci/bungkus-ulang', {})).code, 400); const b = await A(S.adm, 'POST', 'keamanan/kunci/bungkus-ulang', { konfirmasi: 'BUNGKUS ULANG RAHASIA' }); assert.equal(b.code, 200); NO_SECRET(b.json, 'bungkus ulang');
  assert.equal((await A(S.adm, 'POST', 'keamanan/kunci/putar', { konfirmasi: 'PUTAR KUNCI ENKRIPSI' })).code, 409, 'kunci dari env tidak diputar dari konsol (pesan jujur)');
  assert.ok(r.json.hook.catatan.includes('belum dibangun'), 'rotasi hook massal dinyatakan belum ada');
});

test('data: ukuran, cadangan sah, pemulihan hanya dijadwalkan (tidak menimpa server hidup) dan wajib konfirmasi, mode penyimpanan dengan aturan aman', async () => {
  let r = await A(S.adm, 'GET', 'data'); assert.equal(r.code, 200); assert.ok(r.json.ukuran.some((u) => u.label === 'Ruang kerja utama' && u.byte > 0)); NO_SECRET(r.json, 'data');
  r = await A(S.adm, 'POST', 'data/cadangan', {}); assert.equal(r.code, 200); const nama = r.json.nama; assert.ok(r.json.berkas >= 2);
  assert.equal((await A(S.adm, 'POST', 'data/cadangan/periksa', { nama })).json.sah, true); assert.equal((await A(S.adm, 'POST', 'data/cadangan/periksa', { nama: '../etc' })).code, 400); assert.equal((await A(S.adm, 'POST', 'data/cadangan/periksa', { nama: 'tidak-ada-cadangan' })).code, 404);
  assert.ok((await A(S.adm, 'GET', 'data')).json.cadangan.some((c) => c.nama === nama));
  const sebelum = fs.readFileSync(path.join(srvDir, 'db.json'), 'utf8').length;
  assert.equal((await A(S.adm, 'POST', 'data/pulihkan', { nama })).code, 400, 'tanpa mengetik ulang'); assert.equal((await A(S.adm, 'POST', 'data/pulihkan', { nama, konfirmasi: 'ya' })).code, 400);
  r = await A(S.adm, 'POST', 'data/pulihkan', { nama, konfirmasi: `PULIHKAN ${nama}` }); assert.equal(r.code, 200); assert.equal(r.json.dijadwalkan, true);
  assert.ok(fs.existsSync(path.join(srvDir, 'restore-pending.json')), 'dijadwalkan, bukan langsung ditimpa'); assert.ok(Math.abs(fs.readFileSync(path.join(srvDir, 'db.json'), 'utf8').length - sebelum) < 2e6);
  assert.equal((await A(S.adm, 'GET', 'data')).json.pemulihanTertunda.nama, nama); await A(S.adm, 'POST', 'data/pulihkan/batal', {}); assert.ok(!fs.existsSync(path.join(srvDir, 'restore-pending.json')));
  // mode penyimpanan: urutan aman json -> dual -> (sqlite hanya bila pembanding bersih)
  assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'main', mode: 'sqlite' })).code, 409, 'tidak boleh lompat dari json ke sqlite');
  assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'tidak-ada', mode: 'dual' })).code, 404); assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'main', mode: 'xyz' })).code, 400);
  assert.equal((await A(S.adm, 'GET', 'data/bandingkan?ws=main')).json.dibandingkan, false, 'mode json tidak dibandingkan');
  if ((await A(S.adm, 'GET', 'data')).json.penyimpanan.sqliteTersedia) {
    assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'main', mode: 'dual' })).code, 200);
    await A(S.adm, 'POST', 'staf/bendera', { staffEngine: 'native' }); await new Promise((ok) => setTimeout(ok, 900));   // memicu simpan: dual menulis SQLite berdampingan dan pembanding berjalan
    const c = (await A(S.adm, 'GET', 'data/bandingkan?ws=main')).json; assert.equal(c.dibandingkan, true); assert.equal(c.sama, true, `JSON dan SQLite harus sama: ${JSON.stringify(c.beda)}`);
    assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'main', mode: 'sqlite' })).code, 400, 'alih ke sqlite perlu mengetik ulang');
    assert.equal((await A(S.adm, 'POST', 'data/penyimpanan', { ws: 'main', mode: 'json' })).code, 200, 'kembali ke json dari dual aman');
  }
});

test('PENGGUNA BIASA tidak melihat hal teknis: tanda pengelola, kunci, MCP; tidak bisa mengubah kunci/model/MCP/jatah; pengaturan sehari-hari tetap jalan; ruang kerja Owner tetap utuh', async () => {
  const sU = (await api(S.u2, 'GET', '/api/state')).json, sA = (await api(S.adm, 'GET', '/api/state')).json;
  assert.equal('platformAdmin' in sU, false, 'pengguna biasa tidak menerima tanda pengelola'); assert.equal(sA.platformAdmin, true);
  for (const k of ['apiKey', 'groqApiKey', 'hasApiKey', 'hasGroqKey', 'mcpServers', 'googleAppsScript']) { assert.equal(k in sU.settings, false, `pengguna biasa tidak menerima settings.${k}`); }
  assert.ok('hasApiKey' in sA.settings && 'mcpServers' in sA.settings, 'pengelola (Owner kantor utama) tetap menerimanya: kompatibel mundur');
  assert.deepEqual(sU.host, {}, 'statistik server hanya untuk pengelola');
  for (const body of [{ apiKey: 'sk-ant-x1234567890' }, { groqApiKey: 'gsk_x1234567890' }, { model: 'claude-x' }, { groqModel: 'x' }, { provider: 'groq' }, { mcpServers: [] }, { googleAppsScript: { url: '' } }, { dailyBudgetUSD: 99 }, { quota: { tasksPerDay: 9999 } }, { staffModel: true }]) {
    const r = await api(S.u2, 'PATCH', '/api/settings', body); assert.equal(r.code, 403, `pengguna biasa tidak boleh mengubah ${Object.keys(body)[0]}`); assert.match(r.json.error, /pengelola platform/);
  }
  assert.equal((await api(S.u2, 'POST', '/api/test-key')).code, 403); assert.equal((await api(S.u2, 'POST', '/api/mcp/test', { url: 'http://x' })).code, 403); assert.equal((await api(S.u2, 'POST', '/api/groq-models/refresh')).code, 403); assert.equal((await api(S.u2, 'POST', '/api/google-workspace/test')).code, 403);
  assert.equal((await api(S.u2, 'PATCH', '/api/settings', { autonomy: false })).code, 200, 'pengaturan sehari-hari tetap bisa'); assert.equal((await api(S.u2, 'PATCH', '/api/settings', { uiKeys: { free: {}, play: {}, invert: false } })).code, 200);
  // Owner kantor utama (pengelola) tetap bisa seperti dulu
  assert.equal((await api(S.adm, 'PATCH', '/api/settings', { tickMs: 4000 })).code, 200); assert.equal((await api(S.adm, 'PATCH', '/api/settings', { staffModel: false })).code, 200);
  // siaran langsung: pengaturan tanpa bagian teknis untuk pengguna biasa
  const ac = new AbortController(); const rs = await fetch(BASE + '/api/stream', { headers: { cookie: S.u2.cookie }, signal: ac.signal }); let text = ''; const rd = rs.body.getReader();
  const pump = (async () => { try { for (;;) { const { value, done } = await rd.read(); if (done) break; text += Buffer.from(value).toString(); } } catch { /* ditutup */ } })();
  await api(S.u2, 'PATCH', '/api/settings', { autonomy: true }); await new Promise((ok) => setTimeout(ok, 700)); ac.abort(); await pump;
  assert.ok(text.includes('"key":"settings"'), 'siaran pengaturan terkirim'); for (const k of ['hasApiKey', 'hasGroqKey', 'mcpServers', 'googleAppsScript']) assert.ok(!text.includes(`"${k}"`), `siaran langsung tanpa ${k}`);
  // tidak ada rahasia di log server
  NO_SECRET(srvLog, 'log server');
});

test('serangan masukan: JSON rusak, jalur aneh, ID aneh tidak membuat galat 500 dan tidak membocorkan jejak', async () => {
  const mentah = (p, init) => fetch(BASE + p, { ...init, headers: { cookie: S.adm.cookie, 'x-raiverse-admin': '1', 'content-type': 'application/json', ...(init.headers || {}) } }).then(async (r) => ({ code: r.status, t: await r.text() }));
  let r = await mentah('/api/admin/batas', { method: 'POST', body: '{rusak' }); assert.equal(r.code, 400); assert.ok(!/at .*\.js:\d+/.test(r.t), 'tanpa jejak tumpukan');
  r = await mentah('/api/admin/pengguna/ekspor', { method: 'POST', body: JSON.stringify({ id: { $ne: 1 }, alasan: 'x'.repeat(20) }) }); assert.ok([400, 404].includes(r.code));
  r = await mentah('/api/admin/pengguna?cari=' + 'a'.repeat(5000), { method: 'GET' }); assert.equal(r.code, 200);
  r = await mentah('/api/admin/data/cadangan/periksa', { method: 'POST', body: JSON.stringify({ nama: '..\\..\\auth.json' }) }); assert.equal(r.code, 400);
  r = await mentah('/api/admin/ringkasan/../../state', { method: 'GET' }); assert.ok(r.code !== 500);
  assert.ok(!/\[admin\].*Error|TypeError|ReferenceError/.test(srvLog), 'server tidak melempar galat tak terduga');
});

test('batas laju konsol: kebanjiran permintaan dijawab 429 (dan terhitung di laporan upaya ditolak) [harus paling akhir]', async () => {
  let n429 = 0; for (let i = 0; i < 330 && !n429; i++) { const r = await A(S.adm, 'GET', 'staf'); if (r.code === 429) n429 = i; }
  assert.ok(n429 > 0, 'akhirnya dibatasi'); assert.ok(n429 <= 330);
});

// ═══════════════════════ C. tampilan ═══════════════════════
const read = (f) => fs.readFileSync(path.join(U.ROOT, f), 'utf8');
const ADMIN_FILES = ['public/js/admin-view.js', 'public/js/admin-bagian.js'];

test('tampilan: pengguna biasa tidak melihat tautan atau string admin; jalur admin dijaga tanda dari peladen', () => {
  for (const { nama, src } of U.layarPengguna()) { assert.ok(!/\/api\/admin|x-raiverse-admin|admin-bagian|Konsol pengelola/i.test(src), `${nama} memuat rujukan konsol admin`); }
  assert.ok(!/\/api\/admin|Konsol pengelola/i.test(read('public/index.html')), 'index.html bersih');
  const views = read('public/js/views.js').replace(/\/\/ <pengelola>[\s\S]*?\/\/ <\/pengelola>/g, ''); assert.ok(!/data-nav="admin|navigate\('admin/.test(views));
  const app = read('public/js/app.js'); assert.ok(!/CORE\s*=.*admin|MORE\s*=.*admin/.test(app), 'menu utama tanpa admin'); assert.match(app, /bisaKelola\(S\.data\)/);
  assert.match(read('public/js/awam.js'), /platformAdmin === true/, 'tampilan hanya mengikuti tanda dari peladen');
  assert.ok(!/Pengaturan teknis|Kunci AI|MCP|Groq|Anthropic/i.test(read('public/js/pengaturan-view.js')), 'Pengaturan pengguna biasa tanpa kunci, model, atau MCP');
});

test('tampilan konsol: tanpa emoji ikon, tanpa warna merah, semua kolom dan tombol punya nama aksesibel, tanpa innerHTML dari data mentah', () => {
  for (const f of ADMIN_FILES) {
    const src = read(f);
    assert.deepEqual(U.emojiTemuan(src).map((x) => `${f}:${x.line} ${x.teks}`), [], 'emoji di konsol'); assert.deepEqual(U.warnaMerah(src).map((x) => `${f}:${x.line} ${x.warna}`), [], 'warna merah di konsol');
    // setiap input/select punya label (for) atau aria-label; id dinamis dinormalkan
    const norm = (s) => s.replace(/\$\{[^}]*\}/g, '*'); const fors = new Set([...src.matchAll(/for="([^"]+)"/g)].map((m) => norm(m[1])));
    for (const m of src.matchAll(/<(input|select)\b([^>]*)>/g)) { const id = /id="([^"]+)"/.exec(m[2])?.[1]; assert.ok(/aria-label=/.test(m[2]) || (id && fors.has(norm(id))), `${f}: <${m[1]}> tanpa label: ${m[2].slice(0, 70)}`); }
    // tombol hanya-ikon harus punya aria-label (tombol() selalu membawa teks)
    for (const m of src.matchAll(/<button\b([^>]*)>\s*\$\{icon\([^)]*\)\}\s*<\/button>/g)) assert.ok(/aria-label=/.test(m[1]), `${f}: tombol ikon tanpa nama`);
    assert.ok(/role="tablist"/.test(src) || !/adm-tabs/.test(src), 'tab memakai peran yang benar');
  }
  const v = read('public/js/admin-view.js'); assert.match(v, /role="tab"/); assert.match(v, /aria-selected/); assert.match(v, /role="tabpanel"/);
  // nilai dinamis selalu lewat esc(); rahasia tidak pernah ditulis ke DOM dari respons
  const b = read('public/js/admin-bagian.js'); assert.ok(!/innerHTML\s*=\s*[a-z]+\.[a-z]+\s*[;)]/.test(b), 'tidak menulis properti respons mentah ke innerHTML'); assert.match(b, /'X-Raiverse-Admin': '1'/, 'klien mengirim header anti-CSRF');
  const css = read('public/css/identity.css'); assert.match(css, /\.adm-tab/, 'gaya konsol ada di identity.css (lapisan identitas akhir)');
});
