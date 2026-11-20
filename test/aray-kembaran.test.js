// Keputusan desain Owner: aray = orkestrator utama = kembaran digital pemilik, pintu bawaan percakapan; Sora bukan persona pembicara.
// Routing: tujuan eksplisit > nama disapa/disebut > fokus 3D > (bawaan) aray; aray menjawab sendiri atau meneruskan dengan satu kalimat lalu orangnya menjawab.
// Laporan agen -> aray -> pemilik diturunkan dari pekerjaan selesai. Model tiruan; tanpa biaya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-kembaran-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const ce = await import('../server/chat-engine.js');
const kk = await import('../server/chat-kontak.js');
const K = await import('../public/js/komposer-core.js');
store.load();
const db = () => store.get();
const aray = () => db().employees.find((e) => e.isMaster);
const sora = () => db().employees.find((e) => e.isPA);

let panggilan = [];
pm.setChat(async ({ system }) => { const who = /Kamu (\w+),/.exec(system)?.[1] || '?'; panggilan.push({ who, system }); return { balasan: `${who} menjawab.`, saran: ['Lanjut'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] }; });
let n = 0; const sid = () => `ak-${++n}-${Date.now()}`;
const semuaPembicara = [];
const kirim = async (s, input, extra = {}) => { panggilan = []; const r = await ce.turn({ userId: 'owner', sessionId: s, input, ...extra }); const ids = (r.thread || [r]).map((m) => m.speaker?.id); semuaPembicara.push(...ids); return { r, ids, nama: (r.thread || [r]).map((m) => m.speaker?.nama) }; };

test('tanpa target: aray menjawab sendiri (umum, sapaan, tentang pemilik, "kamu siapa") sebagai kembaran digital', async () => {
  const umum = await kirim(sid(), 'bagaimana cuaca besok kira-kira?'); assert.deepEqual(umum.ids, [aray().id]); assert.equal(umum.r.speaker.utama, true);
  assert.match(panggilan[0].system, /kembaran digital pemilik/); assert.match(panggilan[0].system, new RegExp(`^Kamu ${aray().name},`));
  const halo = await kirim(sid(), 'halo'); assert.deepEqual(halo.ids, [aray().id]); assert.doesNotMatch(halo.r.say, /Sora/);
  const siapa = await kirim(sid(), 'kamu siapa?'); assert.deepEqual(siapa.ids, [aray().id]); assert.match(siapa.r.say, /kembaran digitalmu/); assert.doesNotMatch(siapa.r.say, /Sora|teman ngobrol/);
  assert.equal((await kirim(sid(), 'halo', { source: 'telegram' })).ids[0], aray().id, 'Telegram/Discord: pintu bawaan juga aray');
});

test('tanpa target tetapi topik jelas: aray meneruskan dengan satu kalimat singkat, lalu orangnya menjawab dengan nama dan perannya sendiri', async () => {
  const r = await kirim(sid(), 'gimana strategi promosi minggu depan?');
  assert.deepEqual(r.ids, [aray().id, 'maya']); assert.match(r.r.thread[0].say, /^Saya minta Maya\.$/); assert.equal(r.r.thread[1].speaker.peran, db().employees.find((e) => e.id === 'maya').title);
  assert.deepEqual(panggilan.map((p) => p.who), ['Maya'], 'model hanya untuk Maya; jembatan aray tanpa model dan tanpa karangan');
});

test('bicara langsung: aray tidak menyela. Reno tetap Reno lintas giliran, dengan chip, nama, atau fokus', async () => {
  const s = sid(); const semua = [];
  for (const [t, extra] of [['halo kamu reno ya', {}], ['jelaskan funnel singkat', {}], ['dan atribusinya?', {}], ['terima kasih ya', {}]]) semua.push((await kirim(s, t, extra)).ids);
  assert.ok(semua.every((i) => i.length === 1 && i[0] === 'reno'), JSON.stringify(semua));
  assert.deepEqual((await kirim(sid(), 'bagaimana kabarnya?', { fokus: 'reno' })).ids, ['reno'], 'fokus 3D tanpa nama');
  const v = ce.create('owner', {}); ce.update('owner', v.id, K.targetKeServer(['reno']));
  assert.deepEqual((await kirim(v.id, 'ada kabar apa dari divisi lain?')).ids, ['reno'], 'chip eksplisit: agen memegang percakapan');
});

test('pekerjaan nyata lewat aray: usulan berhenti di konfirmasi (diucapkan aray), tidak ada pekerjaan sebelum "Ya, kerjakan"; "@aray koordinasikan" juga', async () => {
  const sebelum = db().tasks.filter((t) => t.kind === 'goal').length;
  const a = await kirim(sid(), 'tolong buatkan caption instagram untuk promo kopi'); assert.equal(a.r.kind, 'confirm'); assert.equal(a.r.speaker.id, aray().id);
  const b = await kirim(sid(), '@aray koordinasikan peluncuran produk baru lintas divisi'); assert.equal(b.r.kind, 'confirm'); assert.match((b.r.notes || []).join(' '), /koordinator lintas divisi/i);
  assert.equal(db().tasks.filter((t) => t.kind === 'goal').length, sebelum, 'tidak ada pekerjaan tanpa konfirmasi');
  const c = await kirim(sid(), '@aray apa kabar?'); assert.deepEqual(c.ids, [aray().id]); assert.notEqual(c.r.kind, 'confirm', 'sapaan ke aray bukan usulan kerja');
});

test('laporan agen -> aray -> pemilik: diturunkan dari pekerjaan selesai, agen sumber bisa ditelusuri, tanda dibaca per pengguna, tanpa data ganda', async () => {
  const t0 = Date.now(); const tugas = (o) => ({ kind: 'task', status: 'done', createdAt: t0 - 5000, updatedAt: t0, completedAt: t0, ...o });
  db().tasks.push(tugas({ id: 't-lap-akar', kind: 'goal', title: 'Peluncuran produk baru', assigneeId: sora().id, summary: 'Peluncuran siap: materi, anggaran, dan jadwal selesai.' }));
  db().tasks.push(tugas({ id: 't-lap-a', title: 'Susun anggaran peluncuran', assigneeId: 'hendra', rootId: 't-lap-akar', parentId: 't-lap-akar', summary: 'Anggaran disusun.' }));
  db().tasks.push(tugas({ id: 't-lap-b', title: 'Rencana promo peluncuran', assigneeId: 'maya', rootId: 't-lap-akar', parentId: 't-lap-akar', summary: 'Promo direncanakan.' }));
  db().tasks.push(tugas({ id: 't-lap-reno', title: 'Audit funnel toko', assigneeId: 'reno', summary: 'Funnel diaudit: tiga titik bocor.' }));
  const sebelumTugas = db().tasks.length;
  const l = ce.laporan('owner'); const akar = l.laporan.find((x) => x.id === 't-lap-akar'); const reno = l.laporan.find((x) => x.id === 't-lap-reno');
  assert.equal(l.lewat.id, aray().id); assert.equal(akar.dari.id, aray().id, 'hasil pecahan dilaporkan aray'); assert.deepEqual(akar.sumberAgen.map((a) => a.id).sort(), ['hendra', 'maya'], 'agen sumber bisa ditelusuri');
  assert.equal(reno.dari.id, 'reno'); assert.equal(reno.lewat.id, aray().id); assert.deepEqual(reno.sumberAgen.map((a) => a.id), ['reno']);
  assert.ok(!l.laporan.some((x) => x.id === 't-lap-a'), 'sub-tugas tidak jadi kartu sendiri'); assert.ok(l.belumDibaca >= 2);
  assert.equal(db().tasks.length, sebelumTugas, 'membaca laporan tidak membuat data baru');
  ce.laporanBaca('owner', 't-lap-reno'); assert.equal(ce.laporan('owner').laporan.find((x) => x.id === 't-lap-reno').dibaca, true); assert.equal(ce.laporan('orang-lain').laporan.find((x) => x.id === 't-lap-reno').dibaca, false, 'tanda dibaca per pengguna');
  assert.equal(ce.laporanBaca('owner', 'semua').belumDibaca, 0);
  assert.ok(ce.routes.some(([m, p]) => m === 'GET' && p === '/api/chat/laporan') && ce.routes.some(([m, p]) => m === 'POST' && p === '/api/chat/laporan/:id/baca'));
});

test('tidak ada "Sora" sebagai pembicara, penerima, kontak, atau teks layar; label komposer "Ke: aray"', async () => {
  for (const t of ['halo', 'terima kasih', 'kamu siapa?', 'apa kabar?', 'cukup aray saja']) await kirim(sid(), t);
  assert.ok(!semuaPembicara.includes(sora().id) && !semuaPembicara.includes('pa-owner'), 'Sora tidak pernah berbicara');
  assert.ok(!kk.daftar('owner').kontak.some((k) => k.orangId === sora().id || k.nama === 'Sora')); assert.ok(!ce.suggest('sora').some((x) => x.id === sora().id));
  assert.equal(K.labelTarget({ ids: [] }), 'Ke: aray'); assert.equal(K.buatKomposer({ ambilData: () => ({}) }).state.target.label, 'Ke: aray');
  const baca = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const f of ['public/js/obrolan-view.js', 'public/js/pesan-view.js', 'public/js/komposer-core.js', 'public/js/app.js', 'public/js/awam.js', 'public/js/tim-view.js', 'public/js/pengaturan-view.js', 'public/js/hasil-view.js', 'server/chat-engine.js', 'server/pemandu-chat.js', 'server/otak/perilaku-obrolan.js', 'server/chat-kontak.js']) assert.doesNotMatch(tanpaKomentar(baca(f)), /\bSora\b/, `${f} masih memuat "Sora"`);
  assert.doesNotMatch(tanpaKomentar(baca('server/pemandu.js')), /\bSora\b/);
});

test('data Sora tidak diubah (id tetap), hanya disembunyikan dari chat; persona aray satu sumber dan memuat batas "tidak menyela"', async () => {
  assert.equal(sora().id, 'pa-owner'); assert.ok(sora().isPA); assert.ok(aray().isMaster);
  const perilaku = await import('../server/otak/perilaku-obrolan.js');
  const p = perilaku.PERSONA_ARAY('aray'); for (const kata of ['kembaran digital pemilik', 'mendelegasikan', 'notulensi dan pengingat', 'tidak menyela', 'jangan mengarang']) assert.ok(p.includes(kata), kata);
  assert.equal(pm.paOf('owner').id, aray().id, 'identitas pembicara utama = aray');
});
