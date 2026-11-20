// Obrolan = dock-utas: kecil di kiri bawah, utas tumbuh ke atas dengan latar transparan, sakelar latar diingat; halaman lain tetap panel besar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('mode: Obrolan memakai kelas lp-ob/lp-dock (kecil), halaman lain has-left (besar), Obrolan diperbesar kembali ke panel besar', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /const dockMode = this\.leftId === 'dashboard' && !penuh;/);
  assert.match(v, /ov\.classList\.toggle\('lp-ob', dockMode\); ov\.classList\.toggle\('has-left', ada && !dockMode\)/);
  assert.match(v, /lp\.classList\.toggle\('lp-dock', dockMode\)/);
});

test('latar utas: tiga pilihan Transparan/Kaca/Solid, default Transparan, diingat di penyimpanan lokal (try/catch)', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /\['trans', 'kaca', 'solid'\]/); assert.match(v, /localStorage\.getItem\('ui-latar-utas'\) \|\| 'trans'/); assert.match(v, /localStorage\.setItem\('ui-latar-utas', cur\)/);
  assert.match(v, /id="odlatar"/);
});

test('gaya: utas transparan memakai bayangan teks, gelembung pengguna kaca ringan; lebar dock-utas sama dengan dock (540 px), tinggi maksimal 70% layar', () => {
  const c = baca('public/css/office-layout.css');
  assert.match(c, /\.lpage\.lp-dock \{ flex: 0 1 auto; width: min\(540px, 100%\); max-height: 70dvh; background: transparent !important;/);
  assert.match(c, /lat-trans #pmThread \{ color: #f4f4f4; text-shadow:/); assert.match(c, /lat-trans #pmThread \{ color: #0d0d0d; text-shadow:/);
  assert.match(c, /lat-trans \.pm-bubble\.me \{ background: rgba\(255, 255, 255, \.16\) !important; -webkit-backdrop-filter: blur\(10px\)/);
  assert.match(c, /\.office-ov\.lp-ob \{ --lw: 540px; \}/);
});

test('kontrol Obrolan (Baru, Sumber, Latar, Perbesar, Riwayat) ada di baris kontrol bersama, bukan header lama', () => {
  const v = baca('public/js/views.js'); const c = baca('public/css/office-layout.css');
  for (const id of ['odbaru', 'odsum', 'odlatar', 'odfs', 'odriw']) assert.match(v, new RegExp(`id="${id}"`));
  assert.match(c, /\.lp-dock \.ob-bar \{ display: none !important; \}/); assert.match(c, /\.lp-b \.od-foot \.ob-only \{ display: inline-flex !important; \}/);
});

test('mode sinema dan suara: nav memudar lewat satu keadaan; peristiwa balasan obrolan dibacakan', () => {
  assert.match(baca('public/js/views.js'), /document\.body\.classList\.toggle\('sinema', on\)/);
  assert.match(baca('public/js/tts.js'), /addEventListener\('raiverse:balasan'/);
});
