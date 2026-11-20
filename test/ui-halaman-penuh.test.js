// Penjaga statis: pop-up singkat memudar, petunjuk 9 detik, pemicu mode kursor, perbesar halaman, slot Pesan, Hasil Saya dua panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('pop-up singkat memudar (toast sekitar 3 detik), petunjuk tombol 9 detik, pemicu mode kursor terpasang dan terdokumentasi', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /2800\);   \/\/ ±3 detik, lalu hilang halus/);
  assert.match(v, /sig === this\._phSig\) return;/, 'petunjuk objek tidak muncul lagi bila keadaan sama');
  assert.match(v, /petunjukOtomatis\(9000\)/); assert.match(v, /langkahMK\(state\(\), acara\)/);
  assert.match(v, /<kbd>Tab<\/kbd>Kursor bebas ⇄ kunci/); assert.match(v, /<kbd>Enter<\/kbd>Ngobrol \(Esc kembali\)/);
});

test('perbesar halaman: tombol di kepala panel, ingatan per halaman (try/catch), kamera tidak digeser saat penuh; slot Pesan siap', () => {
  const v = baca('public/js/views.js'); const a = baca('public/js/app.js');
  assert.match(v, /id="lpfs"/); assert.match(v, /ui-penuh-' \+ this\.leftId/); assert.match(v, /const geser = buka && !penuh && innerWidth > 900/);
  assert.match(a, /const LEFT = \['dashboard', 'pesan', 'tasks', 'brain', 'team', 'settings'\]/);
});

test('Hasil Saya: dua panel (daftar kompak kiri, isi hasil kanan) bila panel lebar; satu kolom bila sempit; pilih banyak tetap ada', () => {
  const h = baca('public/js/hasil-view.js'); const c = baca('public/css/office-layout.css');
  assert.match(h, /id="hdetail"/); assert.match(h, /this\.lebar = this\.root\.clientWidth >= 640/); assert.match(h, /ResizeObserver/);
  assert.match(c, /\.page\.hasil\.dua \{ display: grid !important; grid-template-columns: minmax\(300px, 2fr\) minmax\(0, 3fr\)/);
  assert.match(h, /id="hpilih"/); assert.match(h, /data-m="hapus"/);
});

test('muat langsung lewat #hash: pergeseran kamera dihitung ulang begitu Kantor 3D siap; sinyal fokus-kontak memakai pusat pandangan ruang kanan', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /if \(!office\) return;   \/\/ Kantor 3D belum siap/); assert.match(v, /office\.setVisible\(true\); OfficeView\.syncInset\?\.\(\);/);
  assert.match(v, /raiverse:fokus-kontak/); assert.match(v, /ev\.detail\?\.sisi === 'kanan'\) OfficeView\.syncInset/);
});

test('mode sinema: navigasi, bilah bawah, toast ikut disembunyikan lewat keadaan intro yang sama, dan kembali sesudahnya; tidak menyentuh Lewati/Esc', () => {
  const v = baca('public/js/views.js'); const c = baca('public/css/office-layout.css');
  assert.match(v, /ov\.classList\.toggle\('intro', on\); document\.body\.classList\.toggle\('sinema', on\)/);
  assert.match(v, /document\.body\.classList\.remove\('sinema'\)/, 'dibersihkan saat meninggalkan Kantor');
  assert.match(c, /body\.sinema \.sidebar, body\.sinema \.bottomnav, body\.sinema \.topbar, body\.sinema #toasts[^{]*\{ opacity: 0 !important; pointer-events: none !important; \}/);
  assert.doesNotMatch(c, /body\.sinema[^{]*(keydown|Escape|lewati)/i);
});
