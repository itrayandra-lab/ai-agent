// Logika keadaan mode karakter <-> mode kursor (tanpa pointer lock asli).
import test from 'node:test';
import assert from 'node:assert/strict';
import { langkah, petunjukSatuBaris, PEMICU } from '../public/js/mode-kursor.js';

test('Tab bolak-balik antara karakter dan kursor tanpa Esc', () => {
  let r = langkah('karakter', 'tab'); assert.deepEqual(r, { state: 'kursor', aksi: 'lepas' });
  r = langkah(r.state, 'tab'); assert.deepEqual(r, { state: 'karakter', aksi: 'kunci' });
});

test('Enter atau "/" membuka komposer; Esc dari komposer kembali ke karakter tanpa keluar kantor', () => {
  for (const e of ['enter', 'slash']) { const r = langkah('karakter', e); assert.deepEqual(r, { state: 'mengetik', aksi: 'fokusKomposer' }); assert.deepEqual(langkah('kursor', e), { state: 'mengetik', aksi: 'fokusKomposer' }); }
  assert.deepEqual(langkah('mengetik', 'enter'), { state: 'mengetik', aksi: null }, 'Enter saat mengetik tidak berbuat apa-apa (dikirim oleh komposer)');
  const r = langkah('mengetik', 'esc'); assert.deepEqual(r, { state: 'karakter', aksi: 'blurKomposer' }); assert.notEqual(r.aksi, 'keluar');
  assert.deepEqual(langkah('mengetik', 'tab'), { state: 'karakter', aksi: 'blurKomposer' });
});

test('Esc: pertama melepas kursor, kedua dari mode kursor keluar jalan-jalan; klik di area kosong mengunci lagi', () => {
  assert.deepEqual(langkah('karakter', 'esc'), { state: 'kursor', aksi: 'lepas' });
  assert.deepEqual(langkah('kursor', 'esc'), { state: 'kursor', aksi: 'keluar' });
  assert.deepEqual(langkah('kursor', 'klik-kosong'), { state: 'karakter', aksi: 'kunci' });
  assert.deepEqual(langkah('mengetik', 'klik-kosong'), { state: 'mengetik', aksi: null }, 'klik saat mengetik tidak mencuri fokus');
});

test('kursor dilepas peramban: mode kursor, kecuali sedang mengetik; masukan aneh jatuh ke karakter', () => {
  assert.deepEqual(langkah('karakter', 'kunci-hilang'), { state: 'kursor', aksi: null });
  assert.deepEqual(langkah('mengetik', 'kunci-hilang'), { state: 'mengetik', aksi: null });
  assert.deepEqual(langkah(undefined, 'tab'), { state: 'kursor', aksi: 'lepas' });
  assert.deepEqual(langkah('x', 'acara-aneh'), { state: 'karakter', aksi: null });
});

test('pemicu tidak bentrok dengan tombol gerak dan pintasan karakter; petunjuk satu baris menyebut pemicunya', () => {
  const dipakai = new Set(['W', 'A', 'S', 'D', 'E', 'F', 'V', 'G', 'M', 'H', 'P', 'Q', 'R', 'Spasi', 'Shift', 'Space']);
  for (const k of [PEMICU.tab, ...PEMICU.ngetik, PEMICU.kembali]) assert.ok(!dipakai.has(k.toUpperCase()) && !dipakai.has(k), `pemicu ${k} tidak bentrok`);
  assert.match(petunjukSatuBaris('karakter'), /Tab/); assert.match(petunjukSatuBaris('karakter'), /Enter/);
  assert.match(petunjukSatuBaris('kursor'), /Tab/); assert.match(petunjukSatuBaris('mengetik'), /Esc/);
});
