// Suara: penjelasan awam kenapa diam, diagnosa tanpa audio, jembatan obrolan baru, tes suara di Pengaturan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diagnosa, kenapaDiam } from '../public/js/tts.js';

const baca = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const D = (x) => diagnosa({ tersedia: true, jumlah: 3, adaIndonesia: true, on: true, autoRead: true, engine: 'browser', terblokir: false, galat: '', mulai: 1, bicara: 1, ...x });

test('kenapaDiam: tiap penyebab punya kalimat awam; keadaan sehat tidak menampilkan peringatan', () => {
  assert.equal(kenapaDiam(D({})), '');
  assert.match(kenapaDiam(D({ tersedia: false })), /tidak punya suara bicara/);
  assert.match(kenapaDiam(D({ terblokir: true })), /Tes suara/);
  assert.match(kenapaDiam(D({ jumlah: 0 })), /belum punya suara bicara/);
  assert.match(kenapaDiam(D({ on: false })), /masih mati/);
  assert.match(kenapaDiam(D({ galat: 'tidak-mulai' })), /tidak berbunyi/);
  assert.match(kenapaDiam(D({ adaIndonesia: false })), /suara lain/, 'tanpa suara Indonesia: tetap bicara dengan suara yang ada, bukan diam');
  for (const d of [D({ tersedia: false }), D({ jumlah: 0 }), D({ on: false })]) assert.ok(!/[{}]|undefined|Error/.test(kenapaDiam(d)), 'tanpa istilah teknis');
});

test('diagnosa: bentuk tetap dan memakai nilai yang diberikan', () => {
  const d = D({ jumlah: 7, engine: 'edge' });
  assert.deepEqual(Object.keys(d).sort(), ['adaIndonesia', 'autoRead', 'bicara', 'engine', 'galat', 'jumlahSuara', 'mulai', 'on', 'terblokir', 'tersedia'].sort());
  assert.equal(d.jumlahSuara, 7); assert.equal(d.engine, 'edge');
});

test('suara dimuat async: coba lagi sampai ada, suara lain dipakai bila tidak ada bahasa Indonesia; kegagalan diberi kabar', () => {
  const t = baca('public/js/tts.js');
  assert.match(t, /voiceschanged', muatSuara/); assert.match(t, /\+\+n > 20/, 'coba lagi sampai ~10 detik');
  assert.match(t, /voices = hasId \? idv : all;/, 'tanpa suara Indonesia: semua suara yang ada');
  assert.match(t, /raiverse:suara-gagal/); assert.match(t, /kabarGagal\(ev\.error\)/); assert.match(t, /'tanpa-suara'/);
});

test('jembatan obrolan baru: balasan akhir dibacakan lewat peristiwa raiverse:balasan, dan satu gerakan pertama membuka kunci peramban', () => {
  const t = baca('public/js/tts.js');
  assert.match(t, /addEventListener\('raiverse:balasan'/); assert.match(t, /!S\.on \|\| !S\.autoRead \|\| !d\.text/);
  assert.match(t, /addEventListener\('pointerdown', buka, true\)/);
});

test('Pengaturan: tombol Tes suara dan baris keadaan; toast saat suara gagal diputar', () => {
  const p = baca('public/js/pengaturan-view.js'); const v = baca('public/js/views.js');
  assert.match(p, /id="sTes"/); assert.match(p, /tts\.diagnosa\(\)/); assert.match(p, /tts\.kenapaDiam\(d\)/);
  assert.match(v, /addEventListener\('raiverse:suara-gagal'/);
});
