// Prioritas penerima pesan (bug "halo kamu reno ya" dijawab Sora): tujuan eksplisit > nama yang disapa/disebut > orang yang difokus di Kantor 3D > topik > peserta sebelumnya > Sora.
// Sora bukan tokoh default. Model tiruan mencatat siapa yang menjawab; tanpa biaya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-penerima-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const ce = await import('../server/chat-engine.js');
const router = await import('../server/chat-router.js');
const K = await import('../public/js/komposer-core.js');
const perilaku = await import('../server/otak/perilaku-obrolan.js');
store.load();
const db = () => store.get();
const world = () => ({ employees: db().employees, divisions: db().divisions });

let spoken = [];
pm.setChat(async ({ system }) => { const who = /Kamu (\w+),/.exec(system)?.[1] || 'Sora'; spoken.push(who); return { balasan: `${who} menjawab.`, saran: ['Lanjut'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] }; });
let n = 0; const sid = () => `pn-${++n}-${Date.now()}`;
const kirim = async (s, input, extra = {}) => { spoken = []; const r = await ce.turn({ userId: 'owner', sessionId: s, input, ...extra }); return { r, ids: r.thread?.map((m) => m.speaker?.id) || [r.speaker?.id], spoken: [...spoken] }; };

test('kasus Owner: "halo kamu reno ya" ke Reno, dengan fokus Reno maupun tanpa fokus; bukan Sora', async () => {
  const a = await kirim(sid(), 'halo kamu reno ya', { fokus: 'reno' }); assert.deepEqual(a.ids, ['reno']); assert.deepEqual(a.spoken, ['Reno']);
  const b = await kirim(sid(), 'halo kamu reno ya'); assert.deepEqual(b.ids, ['reno'], 'tanpa fokus pun, nama yang disapa menang');
  const c = await kirim(sid(), 'reno kamu bisa apa'); assert.deepEqual(c.ids, ['reno']);
  const d = await kirim(sid(), 'kamu renoo ya', {}); assert.deepEqual(d.ids, ['reno'], 'salah eja nama pendek yang jelas disapa tetap dikenali');
  const e = await kirim(sid(), 'selamat pagi reno'); assert.deepEqual(e.ids, ['reno']);
  const f = await kirim(sid(), 'halo kamu reno ya', { source: 'telegram' }); assert.deepEqual(f.ids, ['reno'], 'saluran Telegram/Discord memakai logika yang sama');
  assert.ok(!a.r.say.includes('Sora'));
});

test('nama yang disebut jelas ("tanya Maya") menang atas fokus; kata biasa yang mirip nama tidak dianggap nama', async () => {
  assert.deepEqual((await kirim(sid(), 'tanya Maya soal iklan')).ids, ['maya']);
  assert.deepEqual((await kirim(sid(), 'tanya Maya soal iklan', { fokus: 'reno' })).ids, ['maya'], 'penerima yang disebut mengalahkan fokus');
  const bagus = router.route('itu bagus ya', world()); assert.equal(bagus.kind, 'none');
  const pagi = router.route('pagi ya', world()); assert.equal(pagi.kind, 'none');
});

test('fokus Kantor 3D jadi penerima bawaan: pesan tanpa nama ke orang yang diikuti, mengalahkan topik; berganti di tengah percakapan; sapaan polos juga', async () => {
  const s = sid();
  const satu = await kirim(s, 'bagaimana strategi promosi minggu depan?', { fokus: 'reno' }); assert.deepEqual(satu.ids, ['reno'], 'topik promosi biasanya ke Maya, tetapi fokus ke Reno');
  const dua = await kirim(s, 'dan soal anggarannya?', { fokus: 'hendra' }); assert.deepEqual(dua.ids, ['hendra'], 'fokus berganti: penerima ikut berganti, tidak menempel pada Reno');
  const tiga = await kirim(s, 'oke terima kasih', { fokus: 'maya' }); assert.deepEqual(tiga.ids, ['maya']);
  const halo = await kirim(sid(), 'halo', { fokus: 'reno' }); assert.deepEqual(halo.ids, ['reno'], 'sapaan ke orang yang diikuti dijawab orang itu');
  const siapa = await kirim(sid(), 'kamu siapa?', { fokus: 'reno' }); assert.deepEqual(siapa.ids, ['reno'], 'orang itu memperkenalkan dirinya sendiri');
});

test('tanpa nama dan tanpa fokus: topik menentukan; umum atau sapaan polos boleh Sora; fokus tidak sah diabaikan', async () => {
  assert.deepEqual((await kirim(sid(), 'gimana strategi promosi minggu depan?')).ids, ['aria', 'maya'], 'topik: aray meneruskan dengan satu kalimat, Maya menjawab');
  const halo = await kirim(sid(), 'halo'); assert.equal(halo.r.speaker.utama, true, 'sapaan polos tanpa penerima: asisten utama');
  const umum = await kirim(sid(), 'bagaimana cuaca besok kira-kira?'); assert.equal(umum.r.speaker.utama, true);
  const paId = db().employees.find((e) => e.isPA)?.id;
  for (const buruk of ['tidak-ada', paId, '../etc', '']) assert.equal((await kirim(sid(), 'bagaimana cuaca besok kira-kira?', { fokus: buruk })).r.speaker.utama, true, `fokus ${buruk} diabaikan`);
  const off = db().employees.find((e) => e.id === 'reno'); const st = off.status; off.status = 'offline';
  assert.equal((await kirim(sid(), 'bagaimana cuaca besok kira-kira?', { fokus: 'reno' })).r.speaker.utama, true, 'orang yang tidak aktif tidak jadi penerima bawaan'); off.status = st;
});

test('tujuan eksplisit (chip/kontak) mengalahkan fokus; nama ambigu = satu pertanyaan klarifikasi', async () => {
  const v = ce.create('owner', { tujuan: 'agen', agen: ['hendra'] });
  assert.deepEqual((await kirim(v.id, 'bagaimana kabarnya?', { fokus: 'reno' })).ids, ['hendra'], 'penerima yang dipilih pengguna lebih kuat daripada fokus 3D');
  const dup = ['design', 'fin', 'legal'].map((d, i) => ({ id: `zora${i}`, type: 'ai', name: 'Zora', title: `Staf ${d}`, divisionId: d, skills: [], status: 'idle', stats: {}, tools: [] }));
  db().employees.push(...dup);
  const amb = await kirim(sid(), 'halo kamu Zora ya', { fokus: 'reno' });
  assert.equal(amb.r.kind, 'chat'); assert.match(amb.r.say, /Maksudmu yang mana/); assert.ok(amb.r.options.length >= 2 && amb.r.options.length <= 4);
});

test('aray = kembaran digital pemilik dan pintu bawaan: persona orkestrator, tanpa perkenalan kaku, tidak ada "Sora" sebagai pembicara', async () => {
  const sistem = perilaku.bangunSistem({});
  assert.match(sistem, /kembaran digital pemilik/); assert.match(sistem, /orkestrator utama/); assert.doesNotMatch(sistem, /teman ngobrol yang sangat pintar|Kamu Sora/);
  assert.match(sistem, /Jangan membuka dengan perkenalan kaku/);
  const siapa = await kirim(sid(), 'kamu siapa?'); assert.match(siapa.r.say, /kembaran digitalmu/); assert.doesNotMatch(siapa.r.say, /teman ngobrolmu|Sora/);
  assert.ok(!/siap membantu kamu/i.test(JSON.stringify(siapa.r)));
});

test('komposer menampilkan target nyata: "Ke: Reno" dari fokus 3D, chip mengalahkan fokus, berubah otomatis saat fokus berganti', () => {
  const nama = (id) => ({ reno: 'Reno', hendra: 'Hendra' }[id]);
  const k = K.buatKomposer({ nama, ambilData: () => ({}), bisaKelola: () => false });
  assert.equal(k.state.target.label, 'Ke: aray'); assert.equal(k.state.target.sumber, 'otomatis');
  const log = []; k.subscribe((s) => log.push(s.target.label));
  k.setFokus('reno'); assert.equal(k.state.target.label, 'Ke: Reno'); assert.equal(k.state.target.sumber, 'fokus'); assert.equal(k.state.target.mode, 'agen');
  k.setFokus('reno'); assert.equal(log.length, 1, 'fokus yang sama tidak mengabarkan ulang');
  k.setFokus('hendra'); assert.equal(k.state.target.label, 'Ke: Hendra');
  k.pakaiPercakapan('c1', { peserta: [{ id: 'reno' }, { id: 'hendra' }] }); assert.equal(k.state.target.sumber, 'chip'); assert.match(k.state.target.label, /rapat/);
  k.pakaiPercakapan('c1', { peserta: [] }); k.setFokus(null); assert.equal(k.state.target.label, 'Ke: aray');
});

test('semua jalur memakai logika yang sama: rute /api/chat, /api/orchestrate, dan jembatan fokus 3D', () => {
  const baca = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(baca('server/chat-engine.js'), /fokus: b\.fokus \|\| undefined/, 'rute /send, /stream, /ulang, /ubah meneruskan fokus');
  assert.match(baca('server/index.js'), /fokus: b\.fokus \|\| undefined/, '/api/orchestrate meneruskan fokus');
  assert.match(baca('public/js/views.js'), /raiverse:fokus-3d/); assert.match(baca('public/js/obrolan-view.js'), /raiverse:fokus-3d/);
  assert.match(baca('public/js/obrolan-view.js'), /fokus: kontak \? undefined : kk\.state\.fokus/, 'klien mengirim fokus bersama pesan (kecuali utas Pesan yang sudah bertujuan)');
  assert.match(baca('server/channels/core.js'), /turnImpl\(/, 'Telegram/Discord lewat turn yang sama');
  const handler = ce.routes.find(([m, p]) => m === 'POST' && p.endsWith('/stream'))[2];
  const c = ce.create('owner', {}); const ev = []; const out = handler({ userId: 'owner', teks: 'halo kamu reno ya', fokus: 'hendra' }, { id: c.id });
  return out.__sse((e) => ev.push(e)).then(() => { assert.equal(ev.find((e) => e.jenis === 'mulai').speaker.id, 'reno', 'aliran SSE: nama yang disapa menang atas fokus'); });
});

test('suara: tiap balasan chat yang selesai diumumkan sekali lewat raiverse:balasan; id tombol yang dipicu dock tetap ada', () => {
  const ob = fs.readFileSync(new URL('../public/js/obrolan-view.js', import.meta.url), 'utf8');
  assert.match(ob, /raiverse:balasan/); assert.match(ob, /detail: \{ speakerId: m\.speaker\?\.id \|\| '', text: m\.say \}/);
  assert.match(ob, /r\.kind === 'chat' && !r\.dihentikan/, 'hanya balasan chat yang selesai, bukan potongan aliran dan bukan jawaban yang dihentikan');
  for (const id of ['obBaru', 'obSumber', 'obRiwayat', 'pmHome']) assert.ok(ob.includes(`id="${id}"`), `id ${id} dipertahankan untuk dock-utas`);
});
