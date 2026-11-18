import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, terbilang, profileFor, audiblyDifferent, genderOf } from '../public/js/tts.js';
import { buildSeed } from '../server/seed.js';

test('terbilang membaca angka dengan wajar', () => {
  assert.equal(terbilang(0), 'nol'); assert.equal(terbilang(11), 'sebelas'); assert.equal(terbilang(100), 'seratus');
  assert.equal(terbilang(2025), 'dua ribu dua puluh lima'); assert.equal(terbilang(1500000), 'satu juta lima ratus ribu');
});
test('cleanText membuang markdown, tautan, emoji; angka dan singkatan dibacakan', () => {
  const t = cleanText('## Laporan **KPI** 🎉\n- Selesai 95% dgn [dokumen](https://x.io/a) cek https://x.io\n`kode` Rp1.500.000 utk 3 tim');
  assert.ok(!/[*#`\[\]🎉]|https?:/.test(t), t);
  assert.match(t, /ka pi ai/); assert.match(t, /sembilan puluh lima persen/); assert.match(t, /dengan dokumen/); assert.match(t, /satu juta lima ratus ribu rupiah/); assert.match(t, /untuk tiga tim/);
});
test('cleanText memotong teks panjang di batas kalimat', () => {
  const t = cleanText(('Ini kalimat panjang sekali. ').repeat(60), 200); assert.ok(t.length <= 200 && t.endsWith('.'));
});
test('profil suara deterministik dan berbeda untuk 170+ agen', () => {
  const emps = buildSeed().employees.filter((e) => e.type === 'ai');
  assert.ok(emps.length >= 100);
  const P = emps.map((e) => profileFor(e.id, genderOf(e), 1));
  assert.deepEqual(P[3], profileFor(emps[3].id, genderOf(emps[3]), 1));
  assert.equal(new Set(P.map((p) => p.pitch + '/' + p.rate)).size, P.length, 'parameter tepat sama');
  // 20 agen pertama: setiap pasangan terhitung, minimal 85% terdengar berbeda dengan satu suara id-ID
  const first = P.slice(0, 20); let pairs = 0, diff = 0;
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) { pairs++; if (audiblyDifferent(first[i], first[j])) diff++; }
  assert.ok(diff / pairs >= 0.85, `hanya ${diff}/${pairs}`);
  for (const p of P) { assert.ok(p.pitch >= 0.55 && p.pitch <= 1.55 && p.rate >= 0.8 && p.rate <= 1.2); }
});

test('profil mesin server (Microsoft): suara sesuai gender, parameter valid, 20 agen cukup berbeda', async () => {
  const { audiblyDifferentEdge, cleanText: ct } = await import('../public/js/tts.js');
  const emps = buildSeed().employees.filter((e) => e.type === 'ai').slice(0, 20);
  const P = emps.map((e) => profileFor(e.id, genderOf(e), 1));
  for (const p of P) { assert.equal(p.eVoice, p.gender === 'female' ? 'id-ID-GadisNeural' : 'id-ID-ArdiNeural'); assert.ok(p.eRate >= -8 && p.eRate <= 12 && p.ePitch >= -10 && p.ePitch <= 12); }
  let pairs = 0, diff = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { pairs++; if (audiblyDifferentEdge(P[i], P[j])) diff++; }
  assert.ok(diff / pairs >= 0.88, diff + '/' + pairs);
  assert.match(ct('Rapat jam 10:30 tgl 05/12/2025 dgn @maya'), /^Rapat pukul sepuluh lewat tiga puluh tanggal lima Desember dua ribu dua puluh lima dengan maya$/);
});

test('sistem ucapan: kata se- dieja ulang, kecuali kata e-taling; kamus mengganti kata utuh', async () => {
  const { applyPron } = await import('../public/js/tts.js');
  const s = 'Saya sedang luang, selesai sesuai target dan sebagainya. Sesi server sehat? Sekolah semua.';
  assert.equal(applyPron(s, 'none', {}), s);
  assert.equal(applyPron(s, 'u', {}), 'Saya sudang luang, sulesai susuai target dan subagainya. Sesi server suhat? Sukolah sumua.');
  assert.match(applyPron(s, 'circ', {}), /sêdang .* sêbagainya/);
  assert.equal(applyPron('Sedang, sedang-sedangan', 'none', { sedang: 'sudang' }), 'Sudang, sudang-sudangan'.replace('sudangan', 'sedangan'));
  assert.equal(applyPron('kata (x) 5%', 'u', { x: 'ex' }), 'kata (ex) 5%');
});
