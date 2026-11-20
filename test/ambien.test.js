// Penjadwal kehidupan ambien: logika murni (tanpa WebGL). Menjaga anggaran: kuota kecil, mati di HP/tab tersembunyi/layar penuh, status nyata menang.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tingkatEfektif, kuotaUntuk, bobotAktivitas, pilihBerbobot, pilihAgen, buatPenjadwal, KUOTA, SELANG, JARAK_DEKAT, isi } from '../public/js/ambien.js';

test('tingkat: bawaan Ringan (mesin tak dikenal); Penuh hanya bila dipilih; hemat/FPS rendah/tab tersembunyi/layar penuh = mati', () => {
  assert.equal(tingkatEfektif(null, {}), 'ringan'); assert.equal(tingkatEfektif(null, { hp: true }), 'ringan');
  assert.equal(tingkatEfektif('penuh', {}), 'penuh'); assert.equal(tingkatEfektif('penuh', { hp: true }), 'ringan', 'HP tidak pernah lebih dari Ringan');
  assert.equal(tingkatEfektif('mati', {}), 'mati');
  assert.equal(tingkatEfektif('penuh', { tersembunyi: true }), 'mati'); assert.equal(tingkatEfektif('penuh', { penuhLayar: true }), 'mati');
  assert.equal(tingkatEfektif('penuh', { hematTotal: true }), 'mati'); assert.equal(tingkatEfektif('penuh', { fpsRendah: true }), 'mati');
  assert.equal(tingkatEfektif('penuh', { hemat: true }), 'ringan'); assert.equal(tingkatEfektif('asing', {}), 'ringan');
});

test('kuota kecil: Penuh <= 8, Ringan lebih sedikit, Mati nol, HP paling banyak 2', () => {
  assert.ok(KUOTA.penuh <= 8 && KUOTA.ringan < KUOTA.penuh && KUOTA.mati === 0);
  assert.equal(kuotaUntuk('mati'), 0); assert.ok(kuotaUntuk('penuh', { hp: true }) <= 2);
  assert.equal(SELANG.mati, 0);
});

test('pilihAgen: hanya agen bebas di meja, dekat, LOD rendah; status nyata (tidak bebas) tidak pernah dipilih', () => {
  const k = (id, o = {}) => ({ id, jarak: 10, bebas: true, diMeja: true, lod: 1, ambien: false, ...o });
  const kand = [k('sibuk', { bebas: false, jarak: 1 }), k('jauh', { jarak: JARAK_DEKAT + 1 }), k('lod', { lod: 3 }), k('jalan', { diMeja: false }), k('ok', { jarak: 20 })];
  assert.equal(pilihAgen(kand, { kuota: 3, rnd: () => 0 }).id, 'ok');
  assert.equal(pilihAgen(kand, { kuota: 0 }), null);
});

test('pilihAgen: kuota penuh = tidak menjadwalkan lagi; terdekat diutamakan', () => {
  const k = (id, jarak, ambien = false) => ({ id, jarak, bebas: true, diMeja: true, lod: 0, ambien });
  assert.equal(pilihAgen([k('a', 5, true), k('b', 6, true), k('c', 7)], { kuota: 2 }), null);
  assert.equal(pilihAgen([k('x', 30), k('y', 5), k('z', 12)], { kuota: 2, rnd: () => 0 }).id, 'y');
  for (let i = 0; i < 200; i++) assert.ok(['x', 'y', 'z'].includes(pilihAgen([k('x', 30), k('y', 5), k('z', 12)], { kuota: 2 }).id));
});

test('penjadwal: satu detak global, tidak jalan saat mati, jeda diacak di sekitar selang', () => {
  const p = buatPenjadwal({ rnd: () => 0.5 }); let n = 0;
  assert.equal(p.tik(1000, 'mati', () => n++), false); assert.equal(n, 0);
  assert.equal(p.tik(1000, 'penuh', () => n++), true); assert.equal(n, 1);
  assert.equal(p.tik(1000 + SELANG.penuh - 10, 'penuh', () => n++), false, 'belum waktunya');
  assert.equal(p.tik(1000 + SELANG.penuh + 10, 'penuh', () => n++), true); assert.equal(n, 2);
  p.reset(); assert.equal(p.tik(0, 'ringan', () => n++), true);
});

test('bobot aktivitas dan pilihan berbobot: deterministik dengan rnd, selalu valid', () => {
  const b = bobotAktivitas('pagi'); assert.ok(b.pantri > bobotAktivitas('siang').pantri);
  assert.equal(pilihBerbobot({ a: 1, b: 0 }, () => 0.99), 'a'); assert.equal(pilihBerbobot({}, () => 0), null);
  for (const w of ['pagi', 'siang', 'sore', 'malam']) for (let i = 0; i < 50; i++) assert.ok(pilihBerbobot(bobotAktivitas(w)));
  assert.equal(isi('Halo {o}!', 'Taufik'), 'Halo Taufik!');
});

test('anggaran: office3d memanggil penjadwal ambien, ikut tab tersembunyi/layar penuh/mode hemat; Pengaturan punya sakelar tiga tingkat', () => {
  const o = fs.readFileSync('public/js/office3d.js', 'utf8');
  assert.match(o, /ambientTick\(now\)/); assert.match(o, /tersembunyi: !visible \|\| document\.hidden, penuhLayar: uiBlock \|\| winDim/); assert.match(o, /hemat: gfx === 'eco' \|\| perfLite/);
  const s = fs.readFileSync('public/js/pengaturan-view.js', 'utf8');
  for (const t of ['penuh', 'ringan', 'mati']) assert.match(s, new RegExp('data-su="' + t + '"'));
});
