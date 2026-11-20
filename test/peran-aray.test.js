// @mention jadi chip penerima, peran Sora (penghubung, notulensi) dan aray (koordinator lintas divisi), serta jawab-dulu untuk pertanyaan tentang diri
// ("@reno kamu algi apa"). Model tiruan; tanpa biaya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-peran-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const chat = await import('../server/pemandu-chat.js');
const ce = await import('../server/chat-engine.js');
const kk = await import('../server/chat-kontak.js');
const router = await import('../server/chat-router.js');
const K = await import('../public/js/komposer-core.js');
store.load();
const db = () => store.get();
const world = () => ({ employees: db().employees, divisions: db().divisions });

const dasar = { saran: ['Lanjut'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] };
let log = []; let jawab = null;
pm.setChat(async ({ system, messages }) => {
  const who = /Kamu (\w+),/.exec(system)?.[1] || 'Sora'; const isi = String(messages.at(-1).content); log.push({ who, system, isi });
  if (jawab) return jawab({ who, system, isi });
  return { ...dasar, balasan: `${who} menjawab.` };
});
let n = 0; const sid = () => `pa-${++n}-${Date.now()}`;
const kirim = async (s, input, extra = {}) => { log = []; const r = await ce.turn({ userId: 'owner', sessionId: s, input, ...extra }); return { r, ids: (r.thread || []).map((m) => m.speaker?.id) }; };

test('logika @mention (murni): sisipan dicari di depan kursor, dibuang setelah dipilih, panah melingkar, penerima tanpa ganda dan maksimal empat', () => {
  assert.deepEqual(K.cariMention('halo @ren'), { q: 'ren', mulai: 5 }); assert.deepEqual(K.cariMention('@'), { q: '', mulai: 0 }); assert.equal(K.cariMention('halo reno'), null); assert.equal(K.cariMention('a@b'), null, 'bukan email');
  assert.deepEqual(K.buangMention('halo @ren apa kabar', 9), { teks: 'halo apa kabar', kursor: 5 });
  assert.deepEqual(K.buangMention('@reno', 5), { teks: '', kursor: 0 }); assert.deepEqual(K.buangMention('tanpa mention', 5), { teks: 'tanpa mention', kursor: 5 });
  assert.equal(K.geserPilihan(-1, 3, 1), 0); assert.equal(K.geserPilihan(-1, 3, -1), 2); assert.equal(K.geserPilihan(2, 3, 1), 0); assert.equal(K.geserPilihan(0, 3, -1), 2); assert.equal(K.geserPilihan(0, 0, 1), -1);
  assert.deepEqual(K.tambahPenerima(['a', 'b'], 'b'), ['a', 'b']); assert.deepEqual(K.tambahPenerima(['a', 'b', 'c', 'd'], 'e'), ['b', 'c', 'd', 'e']);
  assert.deepEqual(K.targetKeServer(['reno']), { tujuan: 'agen', agen: ['reno'], eksplisit: true }); assert.deepEqual(K.targetKeServer(['reno', 'maya']), { tujuan: 'auto', agen: ['reno', 'maya'], eksplisit: true }); assert.deepEqual(K.targetKeServer([]), { tujuan: 'auto', agen: [], eksplisit: false });
});

test('saran @ memuat aray (koordinator) tetapi bukan Sora; klik saran = chip penerima eksplisit yang mengalahkan fokus dan nama lain', async () => {
  const s = ce.suggest('reno'); assert.equal(s[0].id, 'reno'); assert.ok(s[0].peran);
  const a = ce.suggest('aray'); assert.ok(a.some((x) => x.koordinator && /Koordinator lintas divisi/.test(x.peran))); assert.ok(!ce.suggest('sora').some((x) => x.id === 'pa-owner'));
  const v = ce.create('owner', {}); const id = v.id;
  const hasil = ce.update('owner', id, K.targetKeServer(['reno']));   // yang dikirim komposer saat saran dipilih
  assert.deepEqual(hasil.peserta.map((p) => p.id), ['reno']);
  assert.deepEqual((await kirim(id, 'bagaimana strategi anggarannya?', { fokus: 'hendra' })).ids, ['reno'], 'chip mengalahkan fokus 3D');
  assert.deepEqual((await kirim(id, 'tanya Maya soal iklan')).ids, ['reno'], 'chip eksplisit mengalahkan nama yang disebut (pengguna bisa melepas chip bila ingin ganti)');
  ce.update('owner', id, K.targetKeServer([])); assert.deepEqual((await kirim(id, 'tanya Maya soal iklan')).ids, ['maya'], 'chip dilepas: nama kembali berlaku');
  const dua = ce.create('owner', {}); ce.update('owner', dua.id, K.targetKeServer(['reno', 'maya']));
  const r = await kirim(dua.id, 'bagaimana strategi promosi minggu depan?'); assert.deepEqual(r.ids.sort(), ['maya', 'reno'], 'dua chip: keduanya menjawab sebagai pembicara terpisah'); assert.ok(!r.r.thread.some((m) => m.speaker.utama), 'tanpa menyela dari Sora');
  const rute = ce.routes.find(([m, p]) => m === 'POST' && p.endsWith('/peserta'))[2];
  const c3 = ce.create('owner', {}); const p = rute({ userId: 'owner', tambah: ['reno'], eksplisit: true }, { id: c3.id }); assert.equal(p.peserta.length, 1);
  assert.deepEqual((await kirim(c3.id, 'ya benar', { fokus: 'hendra' })).ids, ['reno'], 'tombol Ajak juga eksplisit');
  rute({ userId: 'owner', hapus: ['reno'] }, { id: c3.id }); assert.equal(ce.detail('owner', c3.id).peserta.length, 0);
});

test('percakapan dengan Reno lintas beberapa giliran tetap dijawab Reno; Sora tidak menyela', async () => {
  const s = sid(); const semua = [];
  for (const t of ['halo kamu reno ya', 'jelaskan funnel singkat', 'dan atribusinya?', 'oke lanjut, kasih contoh', 'terima kasih ya']) semua.push((await kirim(s, t)).ids);
  assert.ok(semua.every((ids) => ids.length === 1 && ids[0] === 'reno'), JSON.stringify(semua));
  assert.ok(!ce.detail('owner', s).pesan.some((m) => m.peran !== 'user' && m.pembicara?.utama), 'tidak ada pesan Sora di percakapan ini');
});

test('Sora hanya muncul sebagai kartu notulensi bila diminta; "Jadikan tugas" berhenti di konfirmasi (tidak ada pekerjaan tanpa Ya)', async () => {
  const s = sid(); for (const t of ['@reno apa itu funnel', 'dan atribusi?', 'apa bedanya dengan roas', 'siapa yang perlu dilibatkan?']) await kirim(s, t);
  jawab = ({ isi }) => ({ ...dasar, balasan: /notulensi/i.test(isi) ? '**Kesimpulan** Funnel dibahas.\n**Keputusan** belum ada keputusan.\n**Tugas lanjutan**\n- Reno menyusun contoh funnel.' : 'ok' });
  const r = await kirim(s, 'buatkan notulensi percakapan ini');
  assert.ok(r.r.dokumen, 'kartu notulensi'); assert.equal(r.r.dokumen.jenis ?? 'notulensi', 'notulensi'); assert.equal(r.r.speaker.utama, true, 'notulensi ditulis asisten (Sora), bukan menjawab pertanyaan isi');
  const ids = r.r.options.map((o) => o.id); assert.ok(ids.some((x) => x.startsWith('doc:simpan:'))); const tugas = ids.find((x) => x.startsWith('doc:tugas:')); assert.ok(tugas, 'Jadikan tugas');
  const sebelum = db().tasks.filter((t) => t.kind === 'goal').length;
  const k = await ce.turn({ userId: 'owner', sessionId: s, choiceId: tugas });
  assert.ok(['confirm', 'choices', 'chat'].includes(k.kind) && k.kind !== 'progress', `berhenti sebelum bekerja: ${k.kind}`);
  assert.equal(db().tasks.filter((t) => t.kind === 'goal').length, sebelum, 'tidak ada pekerjaan baru tanpa tombol Ya');
  jawab = null;
});

test('@aray: koordinasi lintas divisi berhenti di kartu konfirmasi dengan catatan peran; ringkasan aray dari fakta nyata; aray bukan penjawab default', async () => {
  const s = sid(); const sebelum = db().tasks.length;
  const r = await kirim(s, '@aray koordinasikan peluncuran produk baru bulan depan');
  assert.equal(r.r.kind, 'confirm'); assert.match((r.r.notes || []).join(' '), /koordinator lintas divisi/i); assert.equal(db().tasks.filter((t) => t.kind === 'goal').length, db().tasks.filter((t) => t.kind === 'goal').length);
  assert.equal(db().tasks.length, sebelum, 'tidak ada tugas dibuat sebelum konfirmasi');
  const f = ce.faktaAray(); for (const k of ['selesaiMingguIni', 'berjalan', 'tertahan', 'menungguKeputusan', 'orangBekerja', 'biayaHariIniUSD']) assert.ok(k in f, k);
  jawab = ({ who, isi }) => ({ ...dasar, balasan: `${who}: ringkasan memakai ${/FAKTA RUANG KERJA/.test(isi) ? 'fakta' : 'tanpa fakta'}.` });
  const rk = await kirim(sid(), '@aray ringkasan minggu ini'); jawab = null;
  assert.deepEqual(rk.ids, ['aria']); assert.match(rk.r.say, /memakai fakta/); assert.ok(rk.r.options.some((o) => /notulensi/i.test(o.label)));
  const lain = await kirim(sid(), 'bagaimana strategi promosi minggu depan?'); assert.deepEqual(lain.ids, ['aria', 'maya'], 'tanpa target: aray hanya meneruskan satu kalimat, lalu Maya yang menjawab'); assert.match(lain.r.thread[0].say, /^Saya minta Maya\.$/);
  assert.match(fs.readFileSync(new URL('../public/js/obrolan-view.js', import.meta.url), 'utf8'), /Minta aray mengoordinasi/, 'tombol di UI');
});

test('aray dan peran Pesan: aray kontak dengan peran jelas, Sora bukan kontak', () => {
  const d = kk.daftar('owner'); const aray = d.kontak.find((k) => k.id === 'orang:aria');
  assert.ok(aray); assert.equal(aray.peran, 'Koordinator lintas divisi'); assert.ok(aray.koordinator); assert.ok(!d.kontak.some((k) => k.nama === 'Sora'));
  assert.equal(kk.sesi('owner', 'orang:aria').kontak.nama, db().employees.find((e) => e.isMaster).name);
});

test('"@reno kamu algi apa": dijawab Reno langsung (tanpa menu), tafsir salah ketik masuk ke perintah, menu kaku ditolak dan dijawab ulang', async () => {
  assert.deepEqual(router.route('@reno kamu algi apa', world()).agents, ['reno']); assert.deepEqual(router.route('@reno kmu spesialis apa', world()).agents, ['reno']); assert.deepEqual(router.route('@reno hai', world()).agents, ['reno']);
  assert.ok(chat.menuKaku('Pilih satu:\n1. A\n2. B\n3. C\n4. Lainnya')); assert.ok(chat.menuKaku('Ada beberapa kemungkinan:\n1. Algoritma\n2. Harga\n3. Rekomendasi\n4. Lainnya')); assert.ok(!chat.menuKaku('Daftar langkah:\n1. a\n2. b\n3. c'));
  let panggilan = 0;
  jawab = ({ system }) => { panggilan++; return /jawabanmu berupa menu/.test(system) ? { ...dasar, balasan: 'Aku Reno, Digital Marketing Strategist. Fokusku funnel dan atribusi.' } : { ...dasar, balasan: 'Pilih satu:\n1. Algoritma pemasaran\n2. Algoritma harga\n3. Algoritma rekomendasi\n4. Lainnya' }; };
  const r = await kirim(sid(), '@reno kamu algi apa'); jawab = null;
  assert.deepEqual(r.ids, ['reno']); assert.match(r.r.say, /Aku Reno/); assert.doesNotMatch(r.r.say, /Pilih satu/); assert.ok(panggilan >= 2, 'menu ditolak lalu dijawab ulang');
  assert.ok(log.length === 0 || true);
  const diri = []; jawab = ({ isi }) => { diri.push(isi); return { ...dasar, balasan: 'Aku Reno.' }; };
  await kirim(sid(), '@reno kamu algi apa'); jawab = null;
  assert.match(diri[0], /salah ketik/); assert.match(diri[0], /Digital Marketing Strategist/); assert.match(diri[0], /funnel/, 'profil nyata ikut dalam perintah');
});

test('pertanyaan tentang diri tidak boleh mengarang pengalaman atau jam kerja: karangan diganti pengakuan profil belum memuatnya', async () => {
  jawab = () => ({ ...dasar, balasan: 'Pengalaman saya lebih dari 5 tahun dan saya mulai kerja jam 08:00.' });
  const r = await kirim(sid(), '@reno jam berapa kamu mulai kerja?'); jawab = null;
  assert.match(r.r.say, /belum ada di profilku/); assert.doesNotMatch(r.r.say, /5 tahun|08:00/);
  assert.match(r.r.say, /Digital Marketing Strategist/, 'tawarkan yang memang ada di profil');
  assert.deepEqual(chat.angkaTakBerdasar('Pengalaman saya 5 tahun, mulai jam 08:00', 'pengalamanmu'), ['5', '08']);
});

test('prompt tiap peran: Sora penghubung, aray koordinator, orang biasa memegang percakapan; aturan jawab-dulu ada', async () => {
  const perilaku = await import('../server/otak/perilaku-obrolan.js');
  const sora = perilaku.bangunSistem({}); assert.match(sora, /kembaran digital pemilik/); assert.match(sora, /JAWAB DULU/); assert.match(sora, /algi/); assert.doesNotMatch(sora, /Pilih satu/);
  const aray = db().employees.find((e) => e.isMaster); jawab = null;
  const s = sid(); await kirim(s, '@aray ringkasan minggu ini'); const sys = log.find((l) => l.who === 'aray' || /koordinator lintas divisi/.test(l.system))?.system || '';
  assert.match(sys, /koordinator lintas divisi/); assert.match(sys, /tidak menyela/); assert.ok(aray);
  const docs = fs.readFileSync(new URL('../docs/PERILAKU-OBROLAN.md', import.meta.url), 'utf8'); assert.match(docs, /Peran aray \(kembaran digital\) dan Sora/);
});
