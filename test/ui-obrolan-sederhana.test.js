// Obrolan disederhanakan: penerima bawaan Aray (bukan Sora), satu pemilih penerima, tanpa kontrol ganda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('penerima bawaan = Aray (koordinator); tidak ada lagi label Sora di dock atau penanda kontrol', () => {
  const v = baca('public/js/views.js');
  assert.match(v, /orchestrator\(\) \{ const d = D\(\); return d\.employees\.find\(\(e\) => e\.isMaster\)/);
  assert.match(v, /namaPenerima\(\)/); assert.doesNotMatch(v, /\|\| 'Sora'\) \+ ' · otomatis'/);
  assert.doesNotMatch(v, /<span class="od-chip dim">/, 'kapsul penerima bawaan di atas komposer sudah dihapus');
});

test('satu pemilih penerima: chip "Ke: ..." milik Obrolan bisa diklik; dropdown izin dan tombol tujuan dock disembunyikan di dalam panel', () => {
  const v = baca('public/js/views.js'); const c = baca('public/css/office-layout.css');
  assert.match(v, /ke\.title = 'Ganti penerima'/); assert.match(v, /ke\.onclick = \(\) => this\.pilihTujuan\(\)/);
  assert.match(c, /\.pm-dock > \.od-foot #odwho[^{]*#odperm[^{]*#odtog \{ display: none !important; \}/);
});

test('kontrol ganda dihapus dari tampilan: tombol Sumber (ada "+"), "Percakapan ▴", teks Riwayat/Baru/Latar; "Menunggu" hanya bila ada', () => {
  const v = baca('public/js/views.js'); const c = baca('public/css/office-layout.css');
  assert.match(c, /#odsum, :root\[data-theme\] \.office-ov \.od-foot #odtog \{ display: none !important; \}/);
  const mulai = v.indexOf('<div class="od-foot">'); const foot = v.slice(mulai, v.indexOf('</div>', mulai));
  assert.doesNotMatch(foot, /Baru<\/button>|Latar<\/button>|Riwayat<\/button>/, 'baris kontrol: tombol ikon saja');
  assert.match(v, /nb\.hidden = !need\.count/);
  assert.match(c, /#pmFoot \{[^}]*font-size: 0 !important/, 'teks "Sisa jatah hari ini" disembunyikan, tinggal kata dan bilah');
});
