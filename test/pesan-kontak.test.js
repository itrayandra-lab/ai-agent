// Halaman Pesan (server): daftar kontak orang/divisi/grup, utas per kontak tanpa menggandakan data, tugas, belum dibaca, pin, grup, hak akses.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-pesan-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const ce = await import('../server/chat-engine.js');
const kk = await import('../server/chat-kontak.js');
store.load();
const db = () => store.get();
pm.setChat(async ({ system }) => ({ balasan: `${/Kamu (\w+),/.exec(system)?.[1] || 'Sora'} menjawab.`, saran: ['Lanjutkan'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] }));
const ada = (r, id) => r.kontak.find((k) => k.id === id);

test('daftar kontak: orang, divisi, dan grup dengan avatar, status, filter, pencarian, dan jumlah', () => {
  const r = kk.daftar('owner');
  assert.ok(r.jumlah.orang >= 100 && r.jumlah.divisi >= 10 && r.jumlah.grup === 0);
  const h = ada(r, 'orang:hendra'); assert.ok(h);
  assert.equal(h.nama, 'Hendra'); assert.equal(h.peran, 'CFO'); assert.ok(h.divisi); assert.ok(h.avatar.inisial === 'H' && /^hsl\(/.test(h.avatar.warna));
  assert.ok(['bekerja', 'siap', 'rapat', 'luring'].includes(h.status.kode)); assert.ok(h.status.teks);
  assert.ok(h.keahlian.length > 0, 'info keahlian ada');
  assert.ok(r.kontak.some((k) => k.jenis === 'divisi' && k.id.startsWith('divisi:')));
  assert.ok(!r.kontak.some((k) => k.orangId === 'pa-owner' || k.nama === 'Sora'), 'asisten utama bukan kontak (itu halaman Obrolan)');
  assert.ok(kk.daftar('owner', { jenis: 'divisi' }).kontak.every((k) => k.jenis === 'divisi'));
  assert.ok(kk.daftar('owner', { q: 'cfo' }).kontak.some((k) => k.id === 'orang:hendra'));
  assert.equal(kk.daftar('owner', { q: 'zzzxxqq' }).kontak.length, 0);
});

test('status kerja mengikuti pembantu yang sedang bekerja', () => {
  const e = db().employees.find((x) => x.id === 'ratih'); const before = [e.status, e.statusText, e.currentTaskId];
  db().tasks.push({ id: 't-uji-1', title: 'Menyusun rencana diskon', assigneeId: 'ratih', divisionId: e.divisionId, kind: 'task', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() });
  Object.assign(e, { status: 'working', statusText: 'Bekerja', currentTaskId: 't-uji-1' });
  const k = ada(kk.daftar('owner'), 'orang:ratih'); assert.equal(k.status.kode, 'bekerja'); assert.match(k.status.teks, /rencana diskon/);
  Object.assign(e, { status: before[0], statusText: before[1], currentTaskId: before[2] });
  assert.equal(ada(kk.daftar('owner'), 'orang:ratih').status.kode, 'siap');
});

test('sesi kontak: satu percakapan khusus per kontak, dipakai ulang, tidak muncul di riwayat Obrolan, dan menjawab sebagai kontak itu', async () => {
  const a = kk.sesi('owner', 'orang:hendra'); const b = kk.sesi('owner', 'orang:hendra');
  assert.equal(a.convId, b.convId, 'tidak membuat percakapan baru tiap dibuka');
  const conv = db().chat.convs[a.convId]; assert.equal(conv.kontak, 'orang:hendra'); assert.equal(conv.goal, 'agen'); assert.deepEqual(conv.agents, ['hendra']);
  assert.ok(!ce.list('owner').some((c) => c.id === a.convId), 'percakapan khusus kontak tidak memenuhi daftar Obrolan');
  const r = await ce.turn({ userId: 'owner', sessionId: a.convId, input: 'halo Hendra, bagaimana kas hari ini?' });
  assert.equal(r.thread.at(-1).speaker.id, 'hendra');
  const u = kk.utas('owner', 'orang:hendra'); assert.equal(u.convId, a.convId);
  assert.ok(u.pesan.some((m) => m.peran === 'saya' && m.sumber === 'pesan' && /kas hari ini/.test(m.teks)));
  assert.ok(u.pesan.some((m) => m.peran === 'kontak' && m.sumber === 'pesan' && /Hendra menjawab/.test(m.teks)));
});

test('riwayat dari Obrolan ikut di utas kontak (hanya dibaca): tidak ada data ganda dibuat', async () => {
  const c = ce.create('owner', {}); await ce.turn({ userId: 'owner', sessionId: c.id, input: 'tanya Ratih soal promo akhir tahun' });
  const sebelum = JSON.stringify(Object.values(db().chat.convs).map((x) => [x.id, x.msgs.length]));
  const u = kk.utas('owner', 'orang:ratih');
  assert.ok(u.pesan.some((m) => m.sumber === 'obrolan' && m.convId === c.id && m.peran === 'kontak'), 'jawaban Ratih dari Obrolan muncul');
  assert.ok(u.pesan.some((m) => m.sumber === 'obrolan' && m.peran === 'saya' && /promo akhir tahun/.test(m.teks)), 'pertanyaan yang memancing jawaban ikut tampil');
  assert.equal(JSON.stringify(Object.values(db().chat.convs).map((x) => [x.id, x.msgs.length])), sebelum, 'membaca utas tidak mengubah riwayat');
  assert.ok(!kk.utas('owner', 'orang:hendra').pesan.some((m) => m.convId === c.id), 'riwayat kontak lain tidak tercampur');
});

test('tugas kontak: tugas yang dikerjakan dan selesai beserta statusnya, hanya milik kontak itu; divisi menghitung tugas divisinya', () => {
  const d = db().employees.find((x) => x.id === 'hendra').divisionId;
  db().tasks.push({ id: 't-uji-2', title: 'Rekap arus kas November', assigneeId: 'hendra', divisionId: d, kind: 'task', status: 'done', summary: 'Arus kas stabil.', createdAt: Date.now() - 5000, updatedAt: Date.now() - 1000 });
  db().tasks.push({ id: 't-uji-3', title: 'Hitung anggaran 2027', assigneeId: 'hendra', divisionId: d, kind: 'task', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() });
  const u = kk.utas('owner', 'orang:hendra');
  const rekap = u.tugas.find((t) => t.id === 't-uji-2'); assert.equal(rekap.label, 'Selesai'); assert.match(rekap.hasil, /stabil/);
  assert.equal(u.tugas.find((t) => t.id === 't-uji-3').label, 'Dikerjakan');
  assert.ok(u.jumlahTugas.dikerjakan >= 1 && u.jumlahTugas.selesai >= 1);
  assert.ok(!kk.utas('owner', 'orang:ratih').tugas.some((t) => t.id === 't-uji-2'));
  assert.ok(kk.utas('owner', `divisi:${d}`).tugas.some((t) => t.id === 't-uji-2'));
  assert.ok(!kk.utas('owner', 'orang:hendra').tugas.some((t) => t.id.startsWith('c-')), 'percakapan bukan tugas');
});

test('belum dibaca dan pin: pesan baru dari kontak menambah lencana, membuka/baca menghapusnya, pin menaikkan urutan', async () => {
  kk.daftar('owner');   // titik awal "sudah dibaca"
  assert.equal(ada(kk.daftar('owner'), 'orang:alya')?.belumDibaca ?? 0, 0);
  const c = ce.create('owner', {}); db().chat.convs[c.id].msgs.push({ id: 'm-uji-1', t: Date.now() + 5, role: 'agent', speaker: { id: 'alya', nama: 'Alya', peran: 'Desainer', divisi: 'Design' }, text: 'Desainnya sudah selesai, silakan dicek.', kind: 'chat' });
  const k = ada(kk.daftar('owner'), 'orang:alya'); assert.equal(k.belumDibaca, 1); assert.match(k.terakhir.teks, /Desainnya sudah selesai/);
  await new Promise((r) => setTimeout(r, 12)); kk.baca('owner', 'orang:alya');
  assert.equal(ada(kk.daftar('owner'), 'orang:alya').belumDibaca, 0);
  kk.pin('owner', 'orang:rudi', true);
  assert.equal(kk.daftar('owner').kontak[0].id, 'orang:rudi', 'kontak yang dipin di urutan teratas');
  kk.pin('owner', 'orang:rudi', false); assert.notEqual(kk.daftar('owner').kontak[0].id, 'orang:rudi');
});

test('divisi dan grup: pesan ke divisi dijawab tim (rapat singkat), grup buatan sendiri, batas anggota, dan hapus grup ikut menghapus utasnya', async () => {
  const dv = db().divisions.find((x) => x.id === db().employees.find((e) => e.id === 'hendra').divisionId);
  const s = kk.sesi('owner', `divisi:${dv.id}`); const conv = db().chat.convs[s.convId];
  assert.equal(conv.goal, 'tim'); assert.ok(conv.agents.includes(dv.leadId) && conv.agents.length <= 4);
  assert.throws(() => kk.buatGrup('owner', { nama: 'Tim kecil', anggota: ['hendra'] }), /sedikitnya dua/);
  assert.throws(() => kk.buatGrup('owner', { nama: '', anggota: ['hendra', 'ratih'] }), /Nama grup/);
  const g = kk.buatGrup('owner', { nama: 'Tim promo', anggota: ['hendra', 'ratih', 'alya', 'rudi', 'pustaka'] });
  assert.equal(g.jenis, 'grup'); assert.ok(g.anggota.length <= 4);
  assert.ok(ada(kk.daftar('owner'), g.id)); assert.equal(kk.daftar('owner', { jenis: 'grup' }).kontak.length, 1);
  const gs = kk.sesi('owner', g.id); const r = await ce.turn({ userId: 'owner', sessionId: gs.convId, input: 'bahas diskon akhir tahun bersama' });
  assert.ok(r.thread.length >= 2, 'grup menjawab beramai-ramai'); assert.equal(db().chat.convs[gs.convId].kontak, g.id);
  const baru = kk.ubahGrup('owner', g.id.split(':')[1], { nama: 'Promo akhir tahun' }); assert.equal(baru.nama, 'Promo akhir tahun');
  kk.hapusGrup('owner', g.id.split(':')[1]);
  assert.ok(!ada(kk.daftar('owner'), g.id)); assert.ok(!db().chat.convs[gs.convId], 'utas grup ikut terhapus');
  assert.throws(() => kk.utas('owner', g.id), /tidak ditemukan/);
});

test('hak akses: pengguna lain tidak melihat grup, sesi, atau pesan milik pengguna ini; kontak tak dikenal ditolak', () => {
  const g = kk.buatGrup('owner', { nama: 'Rahasia', anggota: ['hendra', 'ratih'] }); const gid = g.id;
  assert.equal(kk.daftar('orang-lain', { jenis: 'grup' }).kontak.length, 0);
  assert.throws(() => kk.sesi('orang-lain', gid), /tidak ditemukan/); assert.throws(() => kk.utas('orang-lain', gid), /tidak ditemukan/);
  const mine = kk.sesi('owner', 'orang:hendra').convId;
  assert.ok(!kk.utas('orang-lain', 'orang:hendra').pesan.some((m) => m.convId === mine || m.sumber === 'pesan'), 'pesan pengguna lain tidak bocor');
  assert.ok(kk.sesi('orang-lain', 'orang:hendra').convId !== mine, 'tiap pengguna punya percakapan kontaknya sendiri');
  for (const buruk of ['hendra', 'orang:', 'orang:tidak-ada', 'divisi:xx', 'x:y', 'orang:../etc']) assert.throws(() => kk.utas('owner', buruk), /tidak ditemukan/, buruk);
  assert.throws(() => kk.pin('owner', 'orang:zzz', true), /tidak ditemukan/);
  kk.hapusGrup('owner', gid.split(':')[1]);
});

test('rute terdaftar dan tampilan Pesan memakai komponen Obrolan yang sama (tanpa menggandakan komposer)', () => {
  for (const [m, p] of [['GET', '/api/pesan/kontak'], ['GET', '/api/pesan/kontak/:kid'], ['POST', '/api/pesan/kontak/:kid/sesi'], ['POST', '/api/pesan/kontak/:kid/baca'], ['POST', '/api/pesan/kontak/:kid/pin'], ['POST', '/api/pesan/grup'], ['PATCH', '/api/pesan/grup/:gid'], ['DELETE', '/api/pesan/grup/:gid']]) assert.ok(kk.routes.some(([mm, pp]) => mm === m && pp === p), `${m} ${p}`);
  const idx = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(idx, /chatKontak\.routes/);
});

test('tampilan Pesan: terdaftar sebagai layar, memakai komponen Obrolan, bahasa awam, kompak, dan memberi sinyal fokus karakter ke Kantor 3D', async () => {
  const baca = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const js = baca('public/js/pesan-view.js'); const css = baca('public/css/pesan.css'); const views = baca('public/js/views.js'); const app = baca('public/js/app.js'); const ob = baca('public/js/obrolan-view.js');
  assert.match(views, /pesan: \{ title: 'Pesan'/); assert.match(app, /const CORE = \['office', 'dashboard', 'pesan'/);
  assert.match(js, /mountObrolan\(host, \{ compact: true, kontak:/, 'utas memakai komponen yang sama dengan Obrolan');
  assert.match(js, /raiverse:fokus-kontak/); assert.match(views, /raiverse:fokus-kontak/); assert.match(ob, /raiverse:fokus-kontak/, 'Obrolan juga memberi sinyal bila satu orang diajak bicara');
  for (const label of ['Semua', 'Orang', 'Divisi', 'Grup', 'Obrolan', 'Tugas', 'Info']) assert.ok(js.includes(`'${label}'`) || js.includes(`>${label}<`) || js.includes(`, '${label}'`) || new RegExp(`\['${label.toLowerCase()}', '${label}`).test(js) || js.includes(label), label);
  const { scan } = await import('../server/kamus.js');
  const teks = [...js.matchAll(/'([^'\n]{3,})'|`([^`\n]{3,})`/g)].map((m) => (m[1] || m[2]).replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ')).filter((t) => /\s/.test(t) && !/\/api\//.test(t));
  assert.deepEqual(scan(teks.join(' . ')), [], 'tidak ada istilah teknis di teks layar');
  assert.match(css, /\.page\.psn\.dua \{ grid-template-columns: 290px/); assert.match(css, /font-size: 14px/);
  assert.match(css, /\.page\.psn:not\(\.dua\)\[data-tampil="utas"\] \.psn-daftar \{ display: none/, 'satu kolom dengan tombol kembali di panel sempit dan HP');
  assert.match(js, /ResizeObserver/); assert.match(js, /data-tampil/);
});

test('Pesan memuat ruang divisi, pekerjaan, dan rapat dari obrolan lama: nama ramah, kode dan istilah teknis dibuang, ChatView lama dihapus, #admin-chat dialihkan', () => {
  const baca = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const js = baca('public/js/pesan-view.js'); const views = baca('public/js/views.js');
  const a = js.indexOf('const NAMA_RUANG'); const b = js.indexOf('const jenisRuang');
  const f = new Function(`${js.slice(a, b)}; return { namaRuang, bersihkan };`)();
  assert.equal(f.namaRuang({ name: 'general' }), 'Umum'); assert.equal(f.namaRuang({ name: 'daily-standup' }), 'Rapat harian'); assert.equal(f.namaRuang({ name: 'marketing' }), 'Pemasaran');
  assert.equal(f.namaRuang({ name: '#content-studio' }), 'Studio konten'); assert.equal(f.namaRuang({ name: 'Diskusi: rencana promo akhir tahun' }), 'Rencana Promo Akhir Tahun'); assert.equal(f.namaRuang({ name: 'ruang-baru-xyz' }), 'Ruang Baru Xyz', 'tanpa pemetaan: tetap ramah, tanpa tanda hubung');
  assert.equal(f.bersihkan('[1793677411884] Halo tim'), 'Halo tim'); assert.doesNotMatch(f.bersihkan('Pesan diterima 154 agen dan koordinator.'), /154|agen|koordinator/);
  assert.match(f.bersihkan('Tolong cek dari agen pemasaran'), /pembantu pemasaran/); assert.equal(f.bersihkan('@all rapat'), '@semua rapat');
  for (const l of ['Ruang', 'Rapat']) assert.ok(js.includes(`'${l}'`));
  assert.match(js, /\/api\/messages/, 'ruang biasa bisa ditulisi lewat jalur pesan yang sudah ada'); assert.match(js, /tts\.speak/, 'tombol dengarkan ikut');
  assert.doesNotMatch(views, /export const ChatView/); assert.match(views, /LEGACY = \{ chat: 'pesan', 'admin-chat': 'pesan'/); assert.doesNotMatch(views, /'admin-chat': \{ title/);
  assert.match(views, /id: 'pesan', title: 'Pesan, ruang, dan rapat'/, 'kartu di konsol alat lama hanya tautan ke halaman Pesan');
});
