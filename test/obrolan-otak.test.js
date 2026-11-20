// Otak obrolan: prompt tunggal, putaran alat (rencana-aksi-amati), penghitung aman, verifikasi angka, kompaksi, ulangi/ubah/umpan,
// penyedia model, dan rubrik evaluasi. Model tiruan; tidak ada token berbayar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-otak-obrolan-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const chat = await import('../server/pemandu-chat.js');
const ce = await import('../server/chat-engine.js');
const perilaku = await import('../server/otak/perilaku-obrolan.js');
const penyedia = await import('../server/otak/penyedia-chat.js');
const { nilaiPercakapan, ringkas } = await import('../server/otak/evaluasi-obrolan.js');
const { scan } = await import('../server/kamus.js');
store.load();

const dasar = { balasan: 'Baik.', saran: [], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] };
let n = 0; const sid = () => `otak-${++n}-${Date.now()}`;

test('prompt tunggal: prinsip yang sama untuk semua, persona hanya ditambahkan, tanpa istilah teknis di aturan pakai', () => {
  const sora = perilaku.bangunSistem({});
  const orang = perilaku.bangunSistem({ persona: 'Kamu Hendra, Kepala Keuangan di divisi Keuangan.' });
  assert.match(sora, /PRINSIP JAWABAN/); assert.match(orang, /PRINSIP JAWABAN/);
  assert.match(orang, /^Kamu Hendra/); assert.match(sora, /^Kamu aray/);
  for (const kata of ['Langsung ke inti', 'Jujur', 'Rekomendasi tegas', 'JAWAB DULU', 'Saran lanjutan']) assert.ok(sora.includes(kata), kata);
  assert.match(perilaku.bangunSistem({ ringkasan: 'Dibahas harga kopi.' }), /Dibahas harga kopi/);
  assert.match(perilaku.bangunSistem({ stream: true }), /###SARAN/); assert.doesNotMatch(perilaku.bangunSistem({ stream: false }), /###SARAN/);
  assert.ok(perilaku.sistemDokumen('Maya').startsWith('Kamu Maya'));
  assert.notEqual(perilaku.bangunSistem({ versi: 'lama' }), perilaku.bangunSistem({ versi: 'baru' }), 'versi lama tersedia hanya untuk pembandingan');
  assert.equal(chat.systemPrompt({ persona: 'Kamu Rudi, Legal.' }).startsWith('Kamu Rudi'), true, 'jalur obrolan memakai sumber yang sama');
});

test('penghitung aman: angka tepat, tanpa eval, ekspresi aneh ditolak', () => {
  assert.equal(chat.hitungAman('2000000*11/100'), 220000);
  assert.equal(chat.hitungAman('150*22.000*30'), 99000000);
  assert.equal(chat.hitungAman('Rp 1.500.000 + 250.000'), 1750000);
  assert.equal(chat.hitungAman('(5+3)*2'), 16);
  for (const buruk of ['process.exit(1)', '2**3', 'alert(1)', '1/0', '', '((1)']) assert.throws(() => chat.hitungAman(buruk), undefined, buruk);
});

test('verifikasi angka: angka penting tanpa dasar terdeteksi; angka dari pengguna, sumber, dan tahun lolos', () => {
  assert.deepEqual(chat.angkaTakBerdasar('Laporan naik 12% dan omzet Rp 5.000.000', 'ceritakan laporan'), ['12', '5.000.000']);
  assert.deepEqual(chat.angkaTakBerdasar('Harganya 22.000 sejak 2021', 'kopi susu 22 ribu... 22.000 per gelas, berdiri 2021'), []);
  assert.deepEqual(chat.angkaTakBerdasar('Ada 3 pilihan', 'apa saja pilihannya'), [], 'angka kecil tanpa satuan bukan klaim data');
});

test('putaran alat: beberapa langkah, alat bebas jalan bersamaan, hasil dibaca sebelum menjawab, langkah dicatat', async () => {
  const panggilan = [];
  chat.setChat(async ({ system }) => {
    panggilan.push(system);
    if (panggilan.length === 1) return { ...dasar, balasan: '', alat: 'hitung', kueri: '2000000*11/100', tambahan: [{ alat: 'catatan', kueri: 'harga kopi' }] };
    if (panggilan.length === 2) return { ...dasar, balasan: '', alat: 'hitung', kueri: '220000+30000' };   // langkah kedua
    return { ...dasar, balasan: 'Totalnya 250.000 dan potongannya 220.000.', alat: 'tidak' };
  });
  const tiba = [];
  const out = await chat.reply({ history: [{ role: 'user', content: 'berapa 11 persen dari 2.000.000, lalu tambah 30.000?' }], text: 'berapa 11 persen dari 2.000.000, lalu tambah 30.000?', onTool: (t) => tiba.push(t.label) });
  assert.ok(out.tools.length >= 3, 'dua alat paralel + satu langkah kedua');
  assert.deepEqual([...new Set(out.tools.map((t) => t.langkah))], [1, 2], 'dua langkah');
  assert.ok(out.tools.slice(0, 2).every((t) => t.langkah === 1), 'alat bebas dikerjakan pada langkah yang sama');
  assert.equal(tiba.length, out.tools.length);
  assert.ok(panggilan.at(-1).includes('220.000'), 'hasil alat masuk ke panggilan jawaban');
  assert.match(out.balasan, /250\.000/); assert.deepEqual(scan(out.balasan), []);
  chat.setChat(null);
});

test('putaran alat: batas langkah ditegakkan dan alat gagal diakui jujur', async () => {
  let k = 0;
  chat.setChat(async () => { k++; return { ...dasar, balasan: 'Masih mencari.', alat: 'web', kueri: `cari ${k}` }; });   // tidak pernah berhenti sendiri
  const out = await chat.reply({ history: [{ role: 'user', content: 'cari info terbaru soal harga biji kopi' }], text: 'cari info terbaru soal harga biji kopi' });
  assert.ok(k <= perilaku.MAKS_LANGKAH + 2, `model dipanggil ${k} kali; harus berhenti di batas langkah`);
  assert.ok(out.tools.length <= perilaku.MAKS_LANGKAH * perilaku.MAKS_PARALEL);
  assert.ok(out.tools.every((t) => t.ok === false), 'pencarian web tidak tersedia di uji: ditandai belum berhasil');
  assert.match(out.balasan, /belum bisa dipastikan|belum|tidak/i, 'jawaban akhir mengakui bagian yang tidak berhasil');
  chat.setChat(null);
});

test('alat hitung dan sumber: hasil tepat dan pencarian di sumber lampiran', async () => {
  chat.setChat(async ({ system }) => (/Hasil alat \(data/.test(system)
    ? { ...dasar, balasan: /99000000|99\.000\.000/.test(system) ? 'Omzetnya 99.000.000.' : 'Tidak ketemu.', alat: 'tidak' }
    : { ...dasar, balasan: '', alat: 'hitung', kueri: '150*22000*30' }));
  const a = await chat.reply({ history: [{ role: 'user', content: 'omzet 150 gelas x 22000 x 30 hari?' }], text: 'omzet 150 gelas x 22000 x 30 hari?' });
  assert.match(a.balasan, /99\.000\.000/); assert.match(a.tools[0].label, /penghitung/);
  chat.setChat(async ({ system }) => (/Hasil alat \(data/.test(system)
    ? { ...dasar, balasan: /Yogyakarta/.test(system) ? 'Cabang kedua di Yogyakarta.' : 'Tidak ada di sumber.', alat: 'tidak' }
    : { ...dasar, balasan: '', alat: 'sumber', kueri: 'rencana cabang' }));
  const b = await chat.reply({ history: [{ role: 'user', content: 'apa rencana cabangnya?' }], text: 'apa rencana cabangnya?', sources: '[1] Profil\nTarget 2025 adalah membuka cabang kedua di Yogyakarta.' });
  assert.match(b.balasan, /Yogyakarta/); assert.match(b.tools[0].label, /sumber/i);
  chat.setChat(null);
});

test('verifikasi angka dalam jawaban: angka karangan memicu satu pemeriksaan ulang, lalu catatan jujur bila tetap tanpa dasar', async () => {
  let k = 0;
  chat.setChat(async () => { k++; return { ...dasar, balasan: 'Laporan minggu lalu naik 12%.', alat: 'tidak' }; });
  const out = await chat.reply({ history: [{ role: 'user', content: 'ceritakan laporan penjualan minggu lalu' }], text: 'ceritakan laporan penjualan minggu lalu' });
  assert.equal(k, 2, 'satu pemeriksaan ulang, tidak berputar');
  assert.match(out.balasan, /belum bisa kupastikan/);
  chat.setChat(async ({ system }) => ({ ...dasar, balasan: /PERIKSA/.test(system) ? 'Datanya belum ada; bagikan laporannya ya.' : 'Naik 12%.', alat: 'tidak' }));
  const baik = await chat.reply({ history: [{ role: 'user', content: 'ceritakan laporan penjualan minggu lalu' }], text: 'ceritakan laporan penjualan minggu lalu' });
  assert.match(baik.balasan, /belum ada/); assert.doesNotMatch(baik.balasan, /12/);
  chat.setChat(null);
});

test('kompaksi: percakapan panjang diringkas (bagian lama saja) dan ringkasan masuk ke prompt berikutnya', async () => {
  const prompts = []; let diringkas = 0;
  pm.setChat(async ({ system, ringkas: r }) => { prompts.push(system); if (r) diringkas++; return r ? 'Dibahas: kedai kopi, harga 22 ribu.' : { ...dasar, balasan: 'Oke.' }; });
  const s = sid();
  for (let i = 0; i < 14; i++) await ce.turn({ userId: 'owner', sessionId: s, input: `pesan nomor ${i} tentang kedai kopi dan harga` });
  assert.ok(diringkas >= 1, 'kompaksi berjalan setelah ambang pesan');
  const conv = ce.detail('owner', s);
  assert.ok(conv.pesan.length >= 24, 'riwayat lengkap tetap tersimpan untuk pengguna');
  assert.ok(prompts.some((p) => /Dibahas: kedai kopi/.test(p)), 'ringkasan dipakai di prompt');
  pm.setChat(null);
});

test('ulangi, ubah pesan, dan umpan: riwayat dimundurkan, jawaban diganti, umpan tersimpan; pekerjaan tidak bisa diulang', async () => {
  let ke = 0;
  pm.setChat(async () => ({ ...dasar, balasan: `Jawaban ke-${++ke}.` }));
  const s = sid();
  const r1 = await ce.turn({ userId: 'owner', sessionId: s, input: 'apa itu margin?' });
  assert.match(r1.say, /Jawaban ke-1/); assert.ok(r1.pesanId, 'jawaban membawa id pesan');
  assert.deepEqual(ce.umpan('owner', s, { pesanId: r1.pesanId, nilai: 'suka' }), { ok: true, umpan: 'suka' });
  assert.equal(ce.detail('owner', s).pesan.find((m) => m.id === r1.pesanId).umpan, 'suka');
  assert.equal(ce.umpan('owner', s, { pesanId: r1.pesanId, nilai: '' }).umpan, '');
  const ulang = ce.rewind('owner', s, {}); assert.equal(ulang.teks, 'apa itu margin?');
  assert.equal(ce.detail('owner', s).pesan.length, 0, 'pesan terakhir dan jawabannya dibuang sebelum dikirim ulang');
  const r2 = await ce.turn({ userId: 'owner', sessionId: s, input: ulang.teks }); assert.match(r2.say, /Jawaban ke-2/);
  const ubah = ce.rewind('owner', s, { teks: 'apa itu laba?' }); assert.equal(ubah.teks, 'apa itu laba?');
  await ce.turn({ userId: 'owner', sessionId: s, input: ubah.teks });
  const pesan = ce.detail('owner', s).pesan; assert.equal(pesan.filter((m) => m.peran === 'user').length, 1); assert.equal(pesan.find((m) => m.peran === 'user').teks, 'apa itu laba?');
  assert.throws(() => ce.umpan('owner', s, { pesanId: 'tidak-ada', nilai: 'suka' }), /tidak ditemukan/);
  assert.throws(() => ce.rewind('orang-lain', s, {}), /tidak ditemukan/);
  const kerja = sid();
  await ce.turn({ userId: 'owner', sessionId: kerja, input: 'tolong buatkan caption instagram untuk promo kopi susu' });
  assert.throws(() => ce.rewind('owner', kerja, {}), /tidak bisa diulang|pekerjaan|konfirmasi/i, 'usulan kerja tidak bisa diulang diam-diam');
  assert.ok(ce.routes.some(([m, p]) => m === 'POST' && p.endsWith('/ulang')) && ce.routes.some(([, p]) => p.endsWith('/ubah')) && ce.routes.some(([, p]) => p.endsWith('/umpan')));
  pm.setChat(null);
});

test('penyedia model: tingkat cepat/pintar dari pengaturan mesin, tanpa kunci di keluaran', () => {
  const i = penyedia.info();
  assert.ok(['groq', 'claude', 'sim'].includes(i.penyedia)); assert.ok(typeof i.catatanMutu === 'string');
  assert.doesNotMatch(JSON.stringify(i), /sk-|gsk_|api[_-]?key/i);
  assert.equal(typeof penyedia.modelUntuk('cepat'), 'string'); assert.equal(typeof penyedia.modelUntuk('pintar'), 'string');
  assert.equal(penyedia.alirAsli(), penyedia.penyedia() === 'groq');
});

test('rubrik evaluasi: jawaban baik lolos, jawaban buruk ditandai pada dimensi yang tepat', () => {
  const c = (o) => ({ id: 'x', kategori: 'uji', turns: ['halo'], ...o });
  const h = (say, ekstra = {}) => ({ turns: [{ say, kind: 'chat', tools: [], kutipan: [], ...ekstra }], tugasBaru: 0 });
  assert.equal(nilaiPercakapan(c({ kata: [['kopi']], maks: 20 }), h('Kopi itu enak.')).ketepatan, 1);
  assert.equal(nilaiPercakapan(c({ kata: [['kopi']] }), h('Teh itu enak.')).ketepatan, 0);
  const jujur = nilaiPercakapan(c({ tidakTahu: true, turns: ['berapa omzet?'] }), h('Datanya belum ada, bagikan ya.'));
  const karang = nilaiPercakapan(c({ tidakTahu: true, turns: ['berapa omzet?'] }), h('Omzetnya Rp 12.000.000.'));
  assert.equal(jujur.kejujuran, 1); assert.equal(karang.kejujuran, 0);
  assert.equal(nilaiPercakapan(c({ konfirmasi: true }), { ...h('Siap.', { kind: 'progress' }), tugasBaru: 1 }).konfirmasi, 0);
  assert.equal(nilaiPercakapan(c({ konfirmasi: true }), h('Mau aku kerjakan sekarang?', { kind: 'confirm' })).konfirmasi, 1);
  assert.ok(nilaiPercakapan(c({ terstruktur: true }), h('Satu paragraf padat tanpa daftar.')).kejelasan < 1);
  assert.equal(nilaiPercakapan(c({ alat: 'hitung' }), h('99', { tools: [{ label: 'Memanggil penghitung' }] })).alat, 1);
  const r = ringkas([nilaiPercakapan(c({ kata: [['kopi']] }), h('Kopi.')), nilaiPercakapan(c({ kata: [['kopi']] }), h('Teh.'))]);
  assert.equal(r.jumlah, 2); assert.equal(r.gagal.length, 1);
});

test('berkas uji: 33 percakapan lengkap dengan rubrik, dan skrip evaluasi tidak menyentuh data asli', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/obrolan-uji.json', import.meta.url), 'utf8'));
  assert.ok(fx.percakapan.length >= 30);
  const ids = fx.percakapan.map((c) => c.id); assert.equal(new Set(ids).size, ids.length, 'id unik');
  for (const k of ['sapaan', 'pengetahuan umum', 'diskusi', 'rumit', 'kejujuran', 'sumber', 'alat catatan', 'alat hitung', 'permintaan kerja', 'pancingan eksekusi', 'multi-giliran']) assert.ok(fx.percakapan.some((c) => c.kategori === k), `kategori ${k}`);
  const skrip = fs.readFileSync(new URL('../scripts/evaluasi-obrolan.mjs', import.meta.url), 'utf8');
  assert.match(skrip, /siapkanSalinan/); assert.doesNotMatch(skrip, /console\.log\([^)]*(KEY|key)\b/, 'tidak mencetak kunci');
});
