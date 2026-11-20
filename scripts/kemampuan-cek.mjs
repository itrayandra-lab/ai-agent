// Memeriksa dan mengevaluasi kemampuan inti (server/staff/capabilities/*.json) di lingkungan terisolasi (tanpa AI asli, tanpa n8n).
// Pakai: node scripts/kemampuan-cek.mjs [id ...]      (tanpa id = semua)
//   keluar 0 bila semua lulus; mencetak masalah validasi dan kasus evaluasi yang gagal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ray-kap-'));
const K = await import('../server/staff/kemampuan.js');
const want = process.argv.slice(2);
const load = K.load({ force: true });
let bad = 0;
for (const p of load.problems) { if (want.length && !want.some((w) => p.file.startsWith(w))) continue; bad++; console.log('TIDAK SAH', p.file, '\n  - ' + p.errors.join('\n  - ')); }
for (const cap of K.all()) {
  if (want.length && !want.includes(cap.kemampuan.id)) continue;
  const r = await K.evaluasi(cap);
  console.log((r.ok ? 'LULUS ' : 'GAGAL ') + cap.kemampuan.id + ` (${r.kasus.filter((k) => k.ok).length}/${r.kasus.length} kasus)`);
  for (const k of r.kasus.filter((x) => !x.ok)) { bad++; console.log('   kasus "' + k.nama + '": ' + k.gagal.join('; ')); }
}
console.log(bad ? 'ADA MASALAH' : 'SEMUA LULUS');
process.exit(bad ? 1 : 0);
