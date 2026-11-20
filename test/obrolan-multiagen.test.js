// Obrolan multi-agen end-to-end di tingkat mesin + bukti tampilan ringkas (CSS/JS): mention, nama + tim sekaligus, satu/banyak/tim,
// tambah-hapus peserta, rapat dengan moderator, jawaban terpisah dengan nama dan peran, aliran per pembicara, ulangi, pilihan ganda,
// kerangka tombol (Hentikan/Ulangi/Ubah), dan gaya kecil seperti ChatGPT/Claude. Model tiruan; tanpa biaya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-multiagen-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const ce = await import('../server/chat-engine.js');
const router = await import('../server/chat-router.js');
store.load();

const world = () => ({ employees: store.get().employees, divisions: store.get().divisions });
let n = 0; const sid = () => `ma-${++n}-${Date.now()}`;
const turn = (s, x, userId = 'owner') => ce.turn({ userId, sessionId: s, ...x });
const ids = (r) => r.thread.map((m) => m.speaker?.id);
let spoken = []; let pilih = false;
pm.setChat(async ({ system, messages }) => {
  const who = /Kamu (\w+),/.exec(system)?.[1] || 'Sora'; spoken.push(who);
  const rangkum = /rangkum rapat/i.test(messages.at(-1).content);
  return { balasan: rangkum ? 'Keputusan: lanjut. Tindak lanjut: susun jadwal.' : `${who} menjawab dari sudut pandangnya.`, saran: pilih ? ['Pelanggan', 'Rekan kerja'] : ['Lanjutkan'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: pilih, kutipan: [] };
});

test('mention dan tim sekaligus: "tim keuangan dan Ratih" melibatkan pimpinan keuangan DAN Ratih; satu nama saja tetap satu orang', () => {
  const dua = router.route('minta tim keuangan dan Ratih bahas strategi diskon', world());
  assert.equal(dua.kind, 'agents'); assert.ok(dua.agents.includes('hendra') && dua.agents.includes('ratih'), dua.agents.join(','));
  assert.equal(dua.meeting, true, 'lebih dari satu orang = rapat');
  const satu = router.route('@hendra kerjanya apa', world());
  assert.deepEqual(satu.agents, ['hendra']); assert.equal(satu.meeting, false);
  assert.ok(ce.suggest('hen').some((x) => x.id === 'hendra'), 'daftar "@" bisa dicari');
});

test('satu agen vs banyak agen vs tim: tiap jawaban terpisah dengan nama, peran, dan divisi', async () => {
  const s1 = sid(); spoken = [];
  const a = await turn(s1, { input: '@hendra apa tugasmu?' });
  assert.deepEqual(ids(a), ['hendra']); assert.deepEqual(spoken, ['Hendra']);
  assert.ok(a.thread[0].speaker.nama && a.thread[0].speaker.peran && a.thread[0].speaker.divisi, 'nama, peran, dan divisi ikut di tiap jawaban');
  const s2 = sid(); spoken = [];
  const b = await turn(s2, { input: 'tanya Hendra dan Ratih soal strategi diskon akhir tahun' });
  const bicara = ids(b).filter((x) => x && x !== 'aria');
  assert.ok(bicara.includes('hendra') && bicara.includes('ratih'), `kedua orang menjawab: ${bicara}`);
  assert.ok(new Set(bicara).size === bicara.length, 'tiap orang satu jawaban terpisah');
  const s3 = sid(); spoken = [];
  const c = await turn(s3, { input: 'minta tim keuangan rapat soal arus kas bulan ini' });
  assert.ok(c.multi, 'balasan ditandai multi-pembicara');
  assert.ok(ids(c).filter((x) => x !== 'aria').length >= 2, 'beberapa orang dalam tim berbicara');
  assert.match(c.thread.at(-1).say, /Keputusan|Tindak lanjut/, 'moderator (asisten utama) menutup dengan ringkasan');
  assert.equal(c.thread.at(-1).speaker.id, 'aria');
});

test('tambah dan hapus peserta lewat rute; batas jumlah dihormati; yang diajak menjawab giliran berikutnya', async () => {
  const s = sid(); const c = ce.create('owner', {}); const id = c.id;
  const rute = (m, suffix) => ce.routes.find(([mm, p]) => mm === m && p === `/api/chat/conversations/:id/${suffix}`)[2];
  let v = rute('POST', 'peserta')({ userId: 'owner', tambah: ['hendra', 'ratih'] }, { id });
  assert.deepEqual(v.peserta.map((p) => p.id).sort(), ['hendra', 'ratih']);
  v = rute('POST', 'peserta')({ userId: 'owner', hapus: ['ratih'] }, { id });
  assert.deepEqual(v.peserta.map((p) => p.id), ['hendra']);
  spoken = []; const r = await turn(id, { input: 'jadi bagaimana menurutmu?' });
  assert.deepEqual(spoken, ['Hendra'], 'peserta yang sudah ada menjawab tanpa disebut namanya');
  assert.ok(r.dilibatkan.includes('hendra'));
  const banyak = rute('POST', 'peserta')({ userId: 'owner', tambah: store.get().employees.filter((e) => e.type === 'ai' && !e.isPA && !e.isMaster).slice(0, 8).map((e) => e.id) }, { id });
  assert.ok(banyak.peserta.length <= 4, 'paling banyak empat peserta');
  void s;
});

test('aliran: tiap pembicara punya peristiwa "mulai" sendiri, kata mengalir sebelum "selesai", dan Hentikan/Ulangi/Ubah tersedia di rute', async () => {
  const handler = ce.routes.find(([m, p]) => m === 'POST' && p.endsWith('/stream'))[2];
  const c = ce.create('owner', {});
  const ev = []; const out = handler({ userId: 'owner', teks: 'tanya Hendra dan Ratih soal strategi diskon akhir tahun' }, { id: c.id });
  await out.__sse((e) => ev.push(e));
  const jenis = ev.map((e) => e.jenis);
  assert.equal(jenis.at(-1), 'selesai'); assert.ok(jenis.includes('delta'), 'ada kata yang mengalir');
  const mulai = ev.filter((e) => e.jenis === 'mulai').map((e) => e.speaker.id);
  assert.ok(new Set(mulai).size >= 2, `lebih dari satu pembicara memulai: ${mulai}`);
  assert.ok(jenis.indexOf('selesai') > jenis.lastIndexOf('delta'));
  for (const suffix of ['/ulang', '/ubah', '/umpan', '/peserta', '/disarankan', '/sumber', '/tugas']) assert.ok(ce.routes.some(([, p]) => p.endsWith(suffix)), suffix);
  // ulangi jawaban multi-pembicara: orang yang sama menjawab lagi, riwayat tidak menggandakan pesan pengguna
  const s = sid(); await turn(s, { input: 'tanya Hendra dan Ratih soal diskon akhir tahun' });
  const { teks } = ce.rewind('owner', s, {}); assert.match(teks, /Hendra dan Ratih/);
  spoken = []; await turn(s, { input: teks });
  assert.ok(spoken.includes('Hendra') && spoken.includes('Ratih'));
  assert.equal(ce.detail('owner', s).pesan.filter((m) => m.peran === 'user').length, 1);
});

test('pilihan ganda dan saran lanjutan: klarifikasi menjadi tombol (2-4), saran biasa menjadi chip; keduanya tanpa membuat pekerjaan', async () => {
  pilih = true; const sebelum = store.get().tasks.length;
  const r = await turn(sid(), { input: 'aku bingung harus mulai dari mana' });
  pilih = false;
  assert.equal(r.pilihanGanda, true); assert.ok(r.options.length >= 2 && r.options.length <= 4);
  const chat = await turn(sid(), { input: 'apa itu margin?' });
  assert.ok(chat.options.length >= 1 && chat.options.length <= 4, 'saran lanjutan 1-4 chip');
  assert.equal(store.get().tasks.length, sebelum, 'tidak ada pekerjaan baru');
});

test('tampilan ringkas: teks 14 px, jawaban tanpa gelembung, ikon aksi kecil, komposer 36-40 px, peserta satu baris yang bisa digulir', () => {
  const css = fs.readFileSync(new URL('../public/css/obrolan.css', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../public/js/obrolan-view.js', import.meta.url), 'utf8');
  const blok = css.slice(css.indexOf('TAMPILAN RINGKAS'));
  assert.match(blok, /\.page\.ob \.md, \.page\.ob \.pm-chat \{ font-size: 14px; line-height: 1\.5/);
  assert.match(blok, /\.page\.ob \.pm-bubble\.guide \{ background: transparent; border: 0/);
  assert.match(blok, /\.page\.ob \.btn\.ob-ik \{[^}]*width: 28px/);
  assert.match(blok, /\.page\.ob \.pm-compose \.input \{ min-height: 38px/);
  assert.match(blok, /\.page\.ob \.ob-peserta \{[^}]*flex-wrap: nowrap[^}]*overflow-x: auto/);
  assert.match(blok, /\.page\.ob \.md h1, \.page\.ob \.md h2[^}]*font-size: 15px/);
  assert.match(blok, /\.page\.ob \.pm-foot \{[^}]*font-size: 11px/);
  assert.match(js, /id="obKontrol"[^\n]*\n\s*<div id="obPeserta"[^\n]*\n\s*<div class="ob-at"[^\n]*\n\s*<form id="pmForm"/, 'kontrol lalu baris peserta tepat di atas komposer');
  assert.match(js, /data-ulang/); assert.match(js, /data-ubah/); assert.match(js, /Hentikan/); assert.match(js, /ob-bicara/, 'indikator giliran bicara');
  assert.match(js, /data-tambah/, 'tombol + Tambah');
});
