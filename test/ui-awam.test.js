// P4 (Antarmuka): kata terlarang di SEMUA layar pengguna biasa, nama aksesibel, tanpa emoji ikon, tanpa merah,
// galat ramah, dan tampilan Tim Saya / Hasil Saya / Pengaturan yang dirender dengan data contoh (tanpa jaringan, tanpa AI, tanpa jsdom).
// Jalur pengelola (#admin) dikecualikan secara eksplisit: lihat DAFTAR_PUTIH_PENGELOLA di public/js/kamus-ui.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as U from './ui-scan.mjs';
import { TERLARANG as SERVER_TERLARANG } from '../server/kamus.js';
import { TERLARANG, DAFTAR_PUTIH_PENGELOLA } from '../public/js/kamus-ui.js';

const read = (f) => fs.readFileSync(path.join(U.ROOT, f), 'utf8');
const fmt = (xs) => xs.slice(0, 12).map((x) => `  baris ${x.line}: ${x.hit ? `[${x.hit}] ` : ''}${x.teks || x.warna || ''}`).join('\n');

test('kamus layar depan: mencakup seluruh kamus peladen dan daftar putih tidak menyimpang', () => {
  for (const w of SERVER_TERLARANG) assert.ok(TERLARANG.includes(w), `kata "${w}" ada di server/kamus.js tetapi tidak di kamus-ui.js`);
  for (const f of [...DAFTAR_PUTIH_PENGELOLA.berkas, ...DAFTAR_PUTIH_PENGELOLA.emoji]) assert.ok(fs.existsSync(path.join(U.JS_DIR, f)), `daftar putih menyebut berkas yang tidak ada: ${f}`);
  // penanda wilayah pengelola berpasangan di semua berkas
  for (const f of fs.readdirSync(U.JS_DIR).filter((x) => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(U.JS_DIR, f), 'utf8');
    const a = s.split(DAFTAR_PUTIH_PENGELOLA.penanda[0]).length - 1; const b = s.split(DAFTAR_PUTIH_PENGELOLA.penanda[1]).length - 1;
    assert.equal(a, b, `${f}: penanda pengelola tidak berpasangan (${a} buka, ${b} tutup)`);
  }
});

test('pemindai: kata terlarang terdeteksi di teks tampil, bukan di nama kelas atau kode', () => {
  const kena = U.temuan('const a = `<button class="chat agen" data-x="goal">Buka Obrolan Agen</button>`; const b = "Brain baru"; const c = "/api/tasks";', { cek: U.scan });
  assert.deepEqual(kena.map((x) => x.hit.join()).sort(), ['agen', 'brain'], 'hanya teks tampil yang dihitung (kelas/atribut data/jalur api tidak)');
  assert.deepEqual(U.temuan('const t = `<button aria-label="Tutup tool">x</button>`;', { cek: U.scan }).map((x) => x.hit.join()), ['tool'], 'aria-label ikut dipindai');
  assert.equal(U.emojiTemuan('x = "✅ selesai";').length, 1);
  assert.equal(U.emojiTemuan('x = "▲ Tinggi ✕ ‹";').length, 0, 'simbol biasa bukan emoji');
  assert.ok(U.warnaMerah('a{color:#ff6b6b}b{color:#d33}c{color:rgb(224,72,63)}d{color:red}').length === 4);
  assert.equal(U.warnaMerah('a{color:#a5532f}b{color:#d4a768}c{color:#0f2747}/* #ff0000 */').length, 0, 'terakota/emas/navy bukan merah; komentar tidak dihitung');
});

test('kata terlarang: tidak ada di string yang bisa dilihat pengguna biasa (semua layar, bukan hanya Pemandu)', () => {
  const salah = [];
  for (const { nama, src } of U.layarPengguna()) for (const x of U.temuan(src, { cek: U.scan })) salah.push(`${nama}:${x.line} [${x.hit}] ${x.teks}`);
  assert.deepEqual(salah, [], `kata terlarang di layar pengguna biasa:\n${salah.slice(0, 20).join('\n')}`);
  for (const f of ['index.html']) assert.deepEqual(U.scan(U.teksTampil(read('public/' + f)).replace(/RAIVERSE AGENT/g, '')), [], `${f} memuat kata terlarang`);
});

test('tanpa emoji sebagai ikon di layar pengguna biasa; emoji tak terpetakan tidak hilang diam-diam', () => {
  const salah = [];
  for (const { nama, src } of U.layarPengguna()) { if (DAFTAR_PUTIH_PENGELOLA.emoji.includes(nama)) continue; for (const x of U.emojiTemuan(src)) salah.push(`${nama}:${x.line} ${x.teks}`); }
  assert.deepEqual(salah, [], `emoji di sumber layar pengguna:\n${salah.slice(0, 20).join('\n')}`);
  const iconizer = read('public/js/iconizer.js');
  assert.match(iconizer, /\|\| 'dot'/, 'emoji tak terpetakan harus diganti penanda, bukan dibuang');
  assert.match(iconizer, /console\.warn/, 'emoji tak terpetakan dicatat');
});

test('tanpa warna merah di CSS aktif dan di gaya sebaris layar pengguna', () => {
  const salah = [];
  for (const f of U.CSS_FILES) for (const x of U.warnaMerah(fs.readFileSync(f, 'utf8'))) salah.push(`${path.basename(f)}:${x.line} ${x.warna} ${x.teks}`);
  for (const { nama, src } of U.layarPengguna()) { if (DAFTAR_PUTIH_PENGELOLA.warna3d.includes(nama)) continue; for (const x of U.warnaMerah(src)) salah.push(`${nama}:${x.line} ${x.warna}`); }
  assert.deepEqual(salah, [], `warna merah ditemukan:\n${salah.join('\n')}`);
  const css = read('public/index.html');
  assert.ok(css.indexOf('identity.css') > css.indexOf('glass.css') && css.indexOf('identity.css') > css.indexOf('app.css'), 'identity.css harus dimuat paling akhir');
});

// ───── nama aksesibel: setiap tombol hanya-simbol punya aria-label (pindai markup di sumber)
function tombolTanpaNama(src) {
  const salah = [];
  const re = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(src))) {
    const [, tag, attr, inner] = m;
    if (tag === 'a' && !/href=/.test(attr)) continue;
    if (/\baria-label=|\baria-labelledby=|\baria-hidden="true"/.test(attr)) continue;
    const teks = inner.replace(/\$\{\s*(?:icon|goldIcon|playBtn)\([^}]*\)\s*\}/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, '');
    if (/\$\{|\$\d/.test(teks) || /\p{L}/u.test(teks) || /<img[^>]*\balt="[^"]*\S/.test(inner)) continue;   // ada teks nyata, ungkapan teks, atau gambar ber-alt
    const baris = src.slice(0, m.index).split('\n').length;
    salah.push(`baris ${baris}: <${tag} ${attr.trim().slice(0, 60)}> isi "${teks.trim().slice(0, 12)}"`);
  }
  return salah;
}
test('nama aksesibel: tombol hanya-simbol (✕ ‹ ☰ ⋯ ikon) punya aria-label di semua layar pengguna biasa', () => {
  const salah = [];
  for (const { nama, src } of U.layarPengguna()) for (const s of tombolTanpaNama(src)) salah.push(`${nama} ${s}`);
  assert.deepEqual(salah, [], `tombol tanpa nama aksesibel:\n${salah.slice(0, 20).join('\n')}`);
  assert.deepEqual(tombolTanpaNama('x = `<button class="btn">✕</button><button aria-label="Tutup">✕</button><button>${icon("x")}</button>`;'), ['baris 1: <button class="btn"> isi "✕"', 'baris 1: <button > isi ""'], 'pendeteksi bekerja');
});

test('keadaan galat: api() mengubah galat mentah menjadi kalimat awam (tanpa kode, tanpa "npm start")', async () => {
  const { ramah, awam } = await import('../public/js/awam.js');
  const KASAR = /error|exception|npm|restart|endpoint|econn|\b50\d\b|\b40\d\b|undefined|json|fetch|token|agen|goal/i;
  for (const [pesan, status] of [['Error 500', 500], ['connect ECONNREFUSED 127.0.0.1:4317', 0], ['Failed to fetch', 0], ['Endpoint tidak ada', 404], ['Unexpected token < in JSON', 200], ['TypeError: Cannot read properties of undefined', 0], ['restart npm start', 0], ['', 429], ['Silakan login dengan Google', 401], ['Goal wajib diisi', 400]]) {
    const r = ramah(pesan, status);
    assert.ok(r.length > 10 && !KASAR.test(r), `galat "${pesan}" (${status}) → "${r}" masih kasar`);
  }
  assert.equal(ramah('Judul wajib diisi', 400), 'Judul wajib diisi', 'pesan peladen yang sudah ramah dipertahankan');
  assert.equal(awam('Agen membuat goal di Second Brain'), 'pembantu membuat pekerjaan di Catatan'.replace(/^p/, 'p'), 'padanan awam');
  // api() dengan fetch palsu
  const toasts = [];
  globalThis.document = { addEventListener() {}, hidden: false, createElement: () => ({ setAttribute() {}, set innerHTML(v) { toasts.push(v); }, remove() {}, set onclick(_) {} }), getElementById: () => ({ appendChild() {} }), querySelectorAll: () => [] };
  globalThis.location = { search: '' }; globalThis.requestAnimationFrame = (f) => f();
  const { api } = await import('../public/js/core.js');
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'Error: ENOENT stack at x.js:10:5' }) });
  await assert.rejects(api('GET', '/api/x'), (e) => { assert.ok(!KASAR.test(e.message), e.message); return true; });
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(api('GET', '/api/x'), (e) => /sambungan/i.test(e.message));
  assert.ok(toasts.length === 2 && toasts.every((t) => !KASAR.test(t)), `pemberitahuan galat harus ramah: ${toasts.join(' | ')}`);
});

// ───── tampilan yang dirender dengan data contoh (tanpa jsdom: akar tiruan yang menangkap innerHTML)
function akarTiruan() {
  const log = [];
  const mk = () => new Proxy(function () {}, {
    get(t, k) {
      if (k === 'innerHTML') return t.__h ?? '';
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector' || k === 'closest') return () => (k === 'closest' ? null : mk());
      if (k === 'classList') return { toggle() {}, add() {}, remove() {} };
      if (k === 'style' || k === 'dataset') return {};
      if (k === 'isConnected') return true;
      if (k === Symbol.toPrimitive) return () => '';
      return t[k] ?? (() => undefined);
    },
    set(t, k, v) { t[k] = v; if (k === 'innerHTML') { t.__h = v; log.push(v); } return true; },
    apply() { return undefined; },
  });
  const root = mk(); root.__log = log; return { root, log };
}
const ORANG = (id, name, over = {}) => ({ id, name, type: 'ai', divisionId: 'mkt', title: 'Content Writer', status: 'idle', statusText: '', ...over });
const DATA = () => ({
  divisions: [{ id: 'exec', name: 'Executive Office', color: '#d9c19a' }, { id: 'mkt', name: 'Marketing', color: '#c8a0b0' }],
  employees: [
    ORANG('owner', 'Ray', { type: 'human', divisionId: 'exec', title: 'Owner' }),
    ORANG('pa-owner', 'Sora', { divisionId: 'exec', title: 'Asisten Pribadi', isPA: true, ownerId: 'owner' }),
    ORANG('aria', 'Aria', { divisionId: 'exec', title: 'AI Master Orchestrator', isMaster: true, isLead: true }),
    ORANG('maya', 'Maya', { isLead: true, title: 'Head of Marketing', status: 'working', statusText: 'Mengerjakan: kampanye agen baru' }),
    ORANG('sinta', 'Sinta <b>x</b>', { status: 'working', statusText: 'Menulis caption' }),
    ORANG('dewi', 'Dewi', {}),
  ],
  tasks: [
    { id: 't1', title: 'Caption promo kopi', assigneeId: 'sinta', createdBy: 'owner', status: 'in_progress', kind: 'task', updatedAt: Date.now(), createdAt: Date.now() },
    { id: 't2', title: 'Rencana bulan depan', assigneeId: 'maya', createdBy: 'owner', status: 'review', kind: 'goal', output: '# Rencana\n- satu\n- dua', summary: 'Rencana siap', updatedAt: Date.now(), createdAt: Date.now(), evidence: [{ ok: true, text: 'run-abc' }] },
    { id: 't3', title: 'Laporan <img src=x onerror=alert(1)>', assigneeId: 'dewi', createdBy: 'owner', status: 'done', kind: 'task', output: 'Selesai.', completedAt: Date.now() - 3600e3, updatedAt: Date.now(), createdAt: Date.now() - 7200e3, noteId: 'n1' },
    { id: 't4', title: 'Tugas rutin', assigneeId: 'dewi', createdBy: 'system', status: 'done', kind: 'routine', updatedAt: 1, createdAt: 1 },
  ],
  approvals: [{ id: 'ap1', kind: 'review', taskId: 't2', requesterId: 'maya', approverId: 'owner', title: 'Rencana bulan depan', status: 'pending', createdAt: Date.now() }, { id: 'ap2', kind: 'automation', taskId: 'x', requesterId: 'sinta', approverId: 'owner', title: 'Kirim pengingat', summary: 'Kirim pesan ke Budi setiap Senin', status: 'pending', createdAt: Date.now() }],
  notes: [], settings: {}, company: { name: 'Kopi' }, usage: {}, workspace: null,
});
async function muat() {
  globalThis.window = globalThis; globalThis.addEventListener ||= () => {}; globalThis.removeEventListener ||= () => {}; globalThis.localStorage = { getItem: () => null, setItem() {} };
  const core = await import('../public/js/core.js');
  core.S.data = DATA(); core.S.me = 'owner'; core.S.params = {};
  return core;
}
const tampil = (log) => U.teksTampil(log.join('\n')).replace(/RAIVERSE AGENT/g, '');

test('Tim Saya: asisten, satu baris per divisi dengan penanggung jawab, kartu orang dengan status awam dan satu tombol "Beri pekerjaan"', async () => {
  await muat(); const { TimView } = await import('../public/js/tim-view.js');
  const { root, log } = akarTiruan(); TimView.mount(root);
  const html = log.join('\n');
  assert.match(html, /Asisten kamu/); assert.match(html, /Sora/); assert.match(html, /Aria/);
  assert.match(html, /Penanggung jawab: Maya/, 'manajer tampil di baris divisi');
  assert.equal((html.match(/data-kasih=/g) || []).length >= 5, true, 'tiap orang punya tombol Beri pekerjaan');
  assert.match(html, /Sedang bekerja/); assert.match(html, /Menunggu pekerjaan/);
  assert.doesNotMatch(html, /Mengerjakan: kampanye agen/, 'status teknis (memuat kata terlarang) tidak ditampilkan');
  assert.match(html, /Menulis caption/, 'status apa adanya bila bersih');
  assert.match(html, /Sinta &lt;b&gt;x&lt;\/b&gt;/, 'nama di-escape');
  assert.deepEqual(U.scan(tampil(log)), [], 'tanpa kata terlarang');
  assert.equal(U.emojiTemuan(html).length, 0);
  assert.deepEqual(tombolTanpaNama(html), []);
  assert.doesNotMatch(html, /(approval|workflow|persona|otonomi|cron)/i);
});

test('Hasil Saya: kelompok Perlu kamu / Sedang dikerjakan / Selesai, kartu Boleh?, hasil teks-berkas-data tanpa bergantung bentuk', async () => {
  const core = await muat(); const m = await import('../public/js/hasil-view.js');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ jalan: [
    { id: 'run-abc', status: 'selesai', staf: { kunci: 'fin-ratna', nama: 'Faktur bulanan' }, karyawan: 'dewi', ringkas: 'Faktur siap', teks: 'Ringkasan **faktur**', berkas: [{ nama: 'faktur.csv', jenis: 'csv', bytes: 2048 }], data: { baris: [{ nama: '<script>x</script>', total: 150000 }], sheetUrl: 'javascript:alert(1)' }, mulai: Date.now() - 1000, selesai: Date.now() },
    { id: 'run-zzz', status: 'gagal', staf: { kunci: 'a', nama: 'Cek stok' }, karyawan: 'sinta', galat: 'Ada langkah yang gagal.', mulai: Date.now() },
  ] }) });
  const { root, log } = akarTiruan(); m.HasilView.mount(root); await new Promise((r) => setTimeout(r, 20));
  m.HasilView.buka = 't2'; m.HasilView.draw();
  const html = log.join('\n');
  for (const k of ['Perlu kamu', 'Sedang dikerjakan', 'Selesai']) assert.match(html, new RegExp(k), `kelompok ${k}`);
  assert.match(html, /Pakai ini/); assert.match(html, /Ubah sedikit/); assert.match(html, /Ulangi/); assert.match(html, /Simpan|Buka di Catatan/);
  assert.match(html, /data-ya=/, 'konfirmasi non-ulasan tampil sebagai kartu Boleh?'); assert.match(html, /Kirim pesan ke Budi setiap Senin/, 'pratinjau tampil');
  assert.match(html, /Cek stok/, 'jalan staf yang gagal tampil sebagai Perlu kamu');
  assert.doesNotMatch(html, /Tugas rutin/, 'rutinitas tidak ikut');
  assert.doesNotMatch(html, /<img src=x/, 'judul di-escape'); assert.doesNotMatch(html, /<script>x/, 'isi data di-escape');
  // wadah hasil: bentuk apa pun
  const w = m.renderHasil([{ jenis: 'teks', teks: '# Judul' }, { jenis: 'berkas', id: 'run-abc', berkas: [{ nama: 'a.csv', bytes: 10 }] }, { jenis: 'data', data: { baris: [{ a: 1 }] } }, { jenis: 'data', data: { total: 5, url: 'javascript:alert(1)' } }, { jenis: 'data', data: { sheetUrl: 'https://docs.google.com/spreadsheets/d/x' } }]);
  assert.match(w, /Buka a\.csv/); assert.match(w, /Unduh a\.csv/); assert.match(w, /<table>/); assert.doesNotMatch(w, /javascript:/); assert.match(w, /href="https:\/\/docs\.google\.com/);
  assert.ok(m.renderHasil([]).includes('Belum ada isi'), 'kosong tetap ramah');
  assert.deepEqual(U.scan(tampil(log)), [], `kata terlarang di Hasil Saya: ${U.scan(tampil(log))}`);
  assert.equal(U.emojiTemuan(html).length, 0); assert.deepEqual(tombolTanpaNama(html), []);
  void core;
});

test('Hasil Saya: tanpa pekerjaan menampilkan keadaan kosong yang ramah', async () => {
  const core = await muat(); core.S.data.tasks = []; core.S.data.approvals = [];
  const m = await import('../public/js/hasil-view.js');
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Hanya Owner/Admin' }) });
  const { root, log } = akarTiruan(); m.HasilView.runs = []; m.HasilView.mount(root); await new Promise((r) => setTimeout(r, 20));
  const html = log.join('\n'); assert.match(html, /Belum ada pekerjaan/); assert.match(html, /Mulai pekerjaan/); assert.deepEqual(U.scan(tampil(log)), []);
});

test('Pengaturan: hanya Akun, Tampilan, Ruang kerja dan undangan, Sambungan; tanpa istilah penyedia, model, kunci, MCP', async () => {
  await muat(); const { PengaturanView } = await import('../public/js/pengaturan-view.js');
  globalThis.fetch = async (u) => ({ ok: true, json: async () => (String(u).includes('auth/me') ? { configured: true, user: { id: 'u1', name: 'Ray', email: 'ray@contoh.id', drive: true }, workspace: { id: 'w', name: 'Kopiku', role: 'owner' }, workspaces: [{ id: 'w', name: 'Kopiku', role: 'owner', personal: true, members: 1 }] } : {}) });
  const { root, log } = akarTiruan(); PengaturanView.mount(root); await new Promise((r) => setTimeout(r, 30));
  const html = log.join('\n'); const t = tampil(log);
  for (const k of ['Tampilan', 'Akun', 'Ruang kerja dan undangan', 'Sambungan']) assert.match(t, new RegExp(k));
  assert.doesNotMatch(t, /(provider|effort|api key|kunci|model|token|mcp|budget|dataset|fine-tun|webhook|apps script)/i, 'tanpa istilah teknis');
  assert.deepEqual(U.scan(t), []); assert.equal(U.emojiTemuan(html).length, 0); assert.deepEqual(tombolTanpaNama(html), []);
});

test('navigasi: pengguna biasa hanya melihat Beranda, Hasil Saya, Catatan, Tim Saya (+ Kantor 3D dan Pengaturan di Lainnya); halaman teknis hanya lewat #admin', () => {
  const app = read('public/js/app.js'); const views = read('public/js/views.js');
  const core = JSON.parse(app.match(/const CORE = (\[[^\]]*\])/)[1].replace(/'/g, '"')); const more = JSON.parse(app.match(/const MORE = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(core, ['office', 'dashboard', 'pesan', 'tasks', 'brain', 'team']); assert.deepEqual(more, ['settings']);   // Kantor 3D utama (keputusan Owner 2026-11-19)
  const tail = views.slice(views.indexOf('export const VIEWS = {'));
  for (const id of [...core, ...more]) assert.match(tail, new RegExp(`\\n  ${id}: \\{ title: '[^']+', (short: '[^']+', )?icon: '[a-z]+', (ic: '[a-z]+', )?view: \\w+ \\}`), `${id} harus layar pengguna biasa (tanpa admin)`);
  assert.match(tail, /LEGACY = \{ chat: 'pesan', 'admin-chat': 'pesan'/, 'obrolan lama (#chat, #admin-chat) dialihkan ke halaman Pesan, tanpa salinan kode');
  assert.doesNotMatch(tail, /ChatView/, 'ChatView lama sudah dihapus: satu UI pesan');
  for (const id of ['approvals', 'studio', 'knowledge', 'browser']) assert.match(tail, new RegExp(`'admin-${id}': \\{[^}]*admin: true`), `admin-${id} dilindungi`);
  assert.match(app, /bisaKelola\(S\.data\)/, 'rute admin dilindungi peran');
  const judul = [...tail.matchAll(/\n  (\w+): \{ title: '([^']+)'/g)].filter((m) => core.includes(m[1]) || more.includes(m[1])).map((m) => m[2]);
  assert.deepEqual(judul, ['Kantor 3D', 'Obrolan', 'Pesan', 'Hasil Saya', 'Catatan', 'Tim Saya', 'Pengaturan'], 'satu nama per layar: tidak ada Dashboard/Konfirmasi/Obrolan/Brain ganda');
});

test('Kantor 3D: HUD satu kalimat awam, tombol Kembali ke Beranda, dock tanpa istilah teknis, tanpa "restart npm start"', () => {
  const v = U.bersihkan('views.js', read('public/js/views.js')); const a = read('public/js/app.js');
  assert.doesNotMatch(v, /class="ov-tabs/); assert.match(v, /aria-label="Tutup dan kembali ke kantor"/);   /* tab dihapus (keputusan Owner): Kantor 3D = ruang kerja utama, halaman lain di panel kiri */ assert.match(v, /class="hud-s"/);
  for (const jargon of ['Tokens', 'Build</span>', 'Sessions', 'CPU ${meter', 'groq live', 'Info sistem']) assert.ok(!v.includes(jargon), `HUD masih memuat "${jargon}"`);
  assert.ok(!/npm start/i.test(v + a), 'tidak ada pesan "npm start"');
  assert.match(v, /Pilihkan.*Ngobrol.*Kerjakan/s, 'mode dock memakai kata awam'); assert.ok(!/'Otomatis', chat: 'Obrolan', goal: 'Goal'/.test(v));
  assert.ok(!/Rapat baru|Tambah pembantu baru|Jadikan pekerjaan/.test(a), 'palet perintah hanya tindakan awam');
});

test('jalur pengelola: hanya pengelola PLATFORM (tanda platformAdmin dari peladen); pemilik ruang kerja biasa dan anggota dialihkan ke Beranda', async () => {
  const { bisaKelola, statusOrang, kelompokTugas, peranOrang } = await import('../public/js/awam.js');
  assert.equal(bisaKelola({ platformAdmin: true, workspace: null }), true, 'peladen tanpa login: pemilik tunggal ditandai peladen');
  assert.equal(bisaKelola({ workspace: { role: 'owner' } }), false, 'pemilik ruang kerja biasa bukan pengelola platform');
  assert.equal(bisaKelola({ workspace: { role: 'admin' } }), false);
  assert.equal(bisaKelola({ workspace: { role: 'member' } }), false); assert.equal(bisaKelola(null), false);
  const app = read('public/js/app.js');
  assert.match(app, /VIEWS\[v\]\.admin && !bisaKelola\(S\.data\)\) return 'dashboard'/, 'rute admin dialihkan untuk pengguna biasa');
  assert.match(app, /LEGACY\[view\] \|\| view/, 'nama lama (chat, approvals, studio, knowledge, browser) tetap dikenali dan ikut dilindungi');
  assert.ok(!/data-nav="admin|navigate\('admin/.test(read('public/js/views.js').replace(/\/\/ <pengelola>[\s\S]*?\/\/ <\/pengelola>/g, '')), 'tidak ada tautan ke #admin di layar pengguna biasa');
  // kata untuk status dan kelompok
  const e = { id: 'a', name: 'Aya', status: 'working' };
  assert.equal(statusOrang(e, []).kata, 'Sedang bekerja'); assert.equal(statusOrang({ ...e, status: 'idle' }, []).kata, 'Menunggu pekerjaan');
  assert.equal(statusOrang({ ...e, status: 'idle' }, [{ assigneeId: 'a', status: 'blocked' }]).kata, 'Ada kendala');
  assert.equal(statusOrang({ ...e, status: 'idle' }, [{ assigneeId: 'a', status: 'done', completedAt: Date.now() }]).kata, 'Baru selesai');
  assert.equal(kelompokTugas({ status: 'review' }), 'perlu'); assert.equal(kelompokTugas({ status: 'in_progress' }), 'jalan'); assert.equal(kelompokTugas({ status: 'done' }), 'selesai');
  assert.equal(kelompokTugas({ status: 'todo', failures: 2 }), 'perlu', 'tugas yang gagal berulang perlu perhatianmu'); assert.equal(kelompokTugas({ status: 'cancelled' }), null);
  assert.equal(peranOrang({ isPA: true }), 'Asisten pribadi'); assert.equal(peranOrang({ role: 'manager' }), 'Penanggung jawab divisi'); assert.equal(peranOrang({ title: 'Head of Agent Studio' }), 'Head of pembantu Studio');
});
