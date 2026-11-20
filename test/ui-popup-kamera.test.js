// Aturan popup Kantor 3D (satu sekali waktu), tombol H, petunjuk di atas, fokus dock membuka Obrolan, kamera ke tengah ruang kanan.
// Pengukuran sebenarnya (Chrome headless, 5 ukuran layar) ada di test/ui-tata-letak.test.js; ini penjaga statis yang cepat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('popup: satu manajer, maksimum SATU terbuka; klik di luar dan Esc menutup semua', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /buatPengatur\(ov, \{ maks: \(\) => 1 \}\)/);
  for (const nama of ['rooms', 'feed', 'menu', 'info', 'petunjuk', 'pindah', 'jam']) assert.match(v, new RegExp(`pn\\.daftarkan\\('${nama}'`), `popup ${nama} terdaftar`);
  assert.match(v, /document\.addEventListener\('pointerdown', this\._offClick, true\)/); assert.match(v, /e\.key === 'Escape' && \[\.\.\.pn\.daftar\.values\(\)\]\.some/);
});

test('menu Tampilan tanpa Tampilan bersih, Kembali ke pandangan awal, Pindah cepat, Petunjuk tombol; petunjuk jadi ikon di baris atas', () => {
  const v = baca('public/js/views.js');
  const menu = v.slice(v.indexOf('class="glass cam-menu"'), v.indexOf('id="ohud"'));
  for (const kata of ['Tampilan bersih', 'Kembali ke pandangan awal', 'Pindah cepat', 'Petunjuk tombol', 'Buka layar di kantor']) assert.ok(!menu.includes(kata), `menu tanpa: ${kata}`);
  assert.match(v, /data-cam="hint" aria-label="Petunjuk tombol"/);
  assert.match(v, /data-cam="tele" aria-label="Pindah cepat"/, 'Pindah cepat tetap di grup ikon kanan bawah');
});

test('tombol H (dan ?) membuka/menutup Petunjuk tombol, juga di mode karakter; kartu memuat baris H', () => {
  const v = baca('public/js/views.js'); const o = baca('public/js/office3d.js');
  assert.match(v, /onHelp: \(show\) => OfficeView\.togglePetunjuk\(show\)/); assert.match(v, /togglePetunjuk\(show\) \{/); assert.match(v, /<kbd>H<\/kbd>Petunjuk ini/);
  assert.match(o, /e\.code === 'KeyH' \|\| e\.key === '\?'\) \{ onHelp\?\.\(\); return; \}/, 'mode bebas');
  assert.match(o, /if \(e\.code === 'KeyH'\) onHelp\?\.\(\);/, 'mode karakter');
});

test('petunjuk muncul di ATAS kolom kanan dan otomatis beberapa detik (ingatan lokal dibungkus try/catch)', () => {
  const c = baca('public/css/office-layout.css'); const v = baca('public/js/views.js');
  assert.match(c, /\.ovz\.rm #phud \{ margin-bottom: auto; \}/);
  assert.match(v, /localStorage\.getItem\('ui-petunjuk'\) !== '1'/); assert.match(v, /}, 9000\)/); assert.match(v, /penyimpanan terblokir/);
});

test('fokus atau klik komposer dock tertutup langsung membuka panel Obrolan; kaki panel Obrolan transparan', () => {
  const v = baca('public/js/views.js'); const g = baca('public/css/glass-global.css');
  assert.match(v, /gq\.addEventListener\('focus', bukaObrolan\); gq\.addEventListener\('click', bukaObrolan\)/); assert.match(v, /navigate\('dashboard'\)/);
  assert.match(g, /\.pm-dock[^{]*\{ background: transparent !important;/);
});

test('kamera: pergeseran dihitung dari lebar panel sebenarnya (--lw), juga di mode karakter, dan diukur ulang saat jendela berubah', () => {
  const v = baca('public/js/views.js'); const o = baca('public/js/office3d.js');
  assert.match(v, /width:var\(--lw\)/); assert.match(v, /const geser = buka && !penuh && innerWidth > 900 \? Math\.round\(pl \+ lw\) : 0/);
  assert.doesNotMatch(v, /buka && !office\?\.isPlayer\?\.\(\)/, 'tidak lagi dinonaktifkan di mode karakter');
  assert.match(v, /addEventListener\('resize', \(\) => \{ this\._insetTarget = null/);
  assert.match(o, /focusScreen: \(\) =>/, 'pusat pandangan bisa diukur oleh tes');
});
