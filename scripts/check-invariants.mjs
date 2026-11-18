// npm run check:invariants — menjalankan test/invariants.test.js dan menampilkan ringkasan sinkronisasi:
// LULUS, GAGAL (merah sungguhan, keluar dengan kode 1), DIKETAHUI (pelanggaran yang sudah tercatat), DITUNDA per fase.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/invariants.test.js'], { cwd: root, encoding: 'utf8' });
const lines = (r.stdout || '').split('\n');
const rows = [];
for (const l of lines) {
  const m = /^(not ok|ok) \d+ - (.+?)(?: # (TODO|SKIP)\S* ?(.*))?$/.exec(l);
  if (m) rows.push({ ok: m[1] === 'ok', name: m[2], tag: m[3] || '', note: (m[4] || '').trim() });
}
if (!rows.length) { console.error('Tidak ada hasil tes yang terbaca.\n' + (r.stdout || '').slice(-800) + (r.stderr || '').slice(-400)); process.exit(1); }

const pass = rows.filter((x) => x.ok && !x.tag);
const fail = rows.filter((x) => !x.ok && !x.tag);
const known = rows.filter((x) => x.tag && /^DIKETAHUI/.test(x.note));
const deferred = rows.filter((x) => x.tag && !/^DIKETAHUI/.test(x.note));
const donePending = rows.filter((x) => x.ok && x.tag);   // todo yang sudah lulus: tanda todo boleh dibuang

console.log('RINGKASAN INVARIAN SINKRONISASI');
console.log(`  lulus ${pass.length}  |  gagal ${fail.length}  |  diketahui ${known.length}  |  ditunda ${deferred.length}  (total ${rows.length})\n`);
if (fail.length) { console.log('GAGAL (harus diperbaiki sekarang):'); for (const x of fail) console.log(`  x ${x.name}`); console.log(''); }
if (known.length) { console.log('PELANGGARAN YANG DIKETAHUI (sudah tercatat, diperbaiki fase berikutnya):'); for (const x of known) console.log(`  ! ${x.name}\n      ${x.note.replace(/^DIKETAHUI: /, '')}`); console.log(''); }
const byPhase = {};
for (const x of deferred) { const p = /^\[(P\d)\]/.exec(x.note)?.[1] || '?'; (byPhase[p] ||= []).push(x); }
if (deferred.length) { console.log('DITUNDA PER FASE (tes ada, belum bisa lulus sebelum fasenya selesai):'); for (const p of Object.keys(byPhase).sort()) { console.log(`  ${p}:`); for (const x of byPhase[p]) console.log(`    - ${x.name}`); } console.log(''); }
if (donePending.length) { console.log('SUDAH LULUS tetapi masih bertanda todo (buang tandanya):'); for (const x of donePending) console.log(`  * ${x.name}`); console.log(''); }
console.log('Lulus:'); for (const x of pass) console.log(`  v ${x.name}`);
process.exit(fail.length || r.status ? 1 : 0);
