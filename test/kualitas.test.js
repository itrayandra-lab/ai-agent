// Mode hemat: logika murni + pengait (CSS tanpa blur, 30 FPS, jendela tak fokus, sakelar Pengaturan). Tanpa WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hematEfektif, buatPenilai, norm, AMBANG_LAMBAT_MS, DETIK_LAMBAT } from '../public/js/kualitas.js';

test('hematEfektif: Hemat selalu, Tinggi tidak pernah, Otomatis menurut perangkat/ukuran', () => {
  assert.equal(hematEfektif('hemat', {}), true); assert.equal(hematEfektif('tinggi', { lemah: true, hp: true }), false);
  assert.equal(hematEfektif('otomatis', {}), false);
  for (const k of ['lemah', 'hp', 'sudahHemat', 'lambat']) assert.equal(hematEfektif('otomatis', { [k]: true }), true, k);
  assert.equal(norm('aneh'), 'otomatis'); assert.equal(norm(null), 'otomatis');
});
test('penilai: hanya beralih setelah lambat berturut-turut cukup lama; pulih bila lancar', () => {
  const p = buatPenilai();
  for (let i = 0; i < DETIK_LAMBAT - 1; i++) assert.equal(p.nilai(AMBANG_LAMBAT_MS + 10), false);
  assert.equal(p.nilai(AMBANG_LAMBAT_MS + 10), true);
  const q = buatPenilai(); q.nilai(100); q.nilai(100); q.nilai(10); q.nilai(10); for (let i = 0; i < DETIK_LAMBAT - 1; i++) assert.equal(q.nilai(100), false);
});
test('pengait: CSS Hemat mematikan blur dan SELALU mematikan blur .lpage/.btn; dimuat terakhir; kantor 30 FPS, 1 DPR, tak fokus 10 FPS', () => {
  const css = fs.readFileSync('public/css/hemat.css', 'utf8'); assert.match(css, /html\[data-hemat="1"\] \*/); assert.match(css, /\.office-ov \.lpage, \.btn/);
  const h = fs.readFileSync('public/index.html', 'utf8'); assert.ok(h.lastIndexOf('/css/hemat.css') > h.lastIndexOf('/css/glass-global.css') && h.lastIndexOf('/css/hemat.css') > h.lastIndexOf('/css/float-nav.css'));
  const o = fs.readFileSync('public/js/office3d.js', 'utf8');
  assert.match(o, /\(gfx === 'eco' \|\| hemat\) && now - lastDraw < 30/); assert.match(o, /!document\.hasFocus\(\) && now - lastDraw < 100/); assert.match(o, /hemat \? 1 : 1\.5/);
  const s = fs.readFileSync('public/js/pengaturan-view.js', 'utf8'); for (const k of ['otomatis', 'tinggi', 'hemat']) assert.match(s, new RegExp('data-ku="' + k + '"'));
});
