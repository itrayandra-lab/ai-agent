// Pemeriksa katalog staf. Membedakan RINTISAN (todo) dari spesifikasi LENGKAP (siap); gagal (kode 1) bila ada berkas rusak.
// Pakai:  node scripts/staff-validate.mjs                 (seluruh katalog)
//         node scripts/staff-validate.mjs fin             (satu divisi)
//         node scripts/staff-validate.mjs --file server/staff-catalog/fin/fin-ratna.json
//         node scripts/staff-validate.mjs --strict        (rintisan dianggap gagal; untuk memastikan satu divisi sudah terisi semua)
//         node scripts/staff-validate.mjs --compile fin-ratna   (cetak ukuran & jumlah simpul hasil kompilasi, tanpa menyentuh n8n)
//         --no-run   (lewati uji lokal sample; secara bawaan spesifikasi lengkap dijalankan dengan sample-nya di kotak pasir lokal)
import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { validateSpec } from '../server/staff/schema.js';
import { compile } from '../server/staff/blueprint.js';
import { simulate } from '../server/staff/simulate.js';
import { catalogDir } from '../server/staff/registry.js';

const args = process.argv.slice(2), strict = args.includes('--strict');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const compileArg = args.includes('--compile') ? args[args.indexOf('--compile') + 1] : null;
const div = args.find((a) => !a.startsWith('--') && a !== fileArg && a !== compileArg);
const roster = buildSeed().employees;
const root = catalogDir();

const files = [];
if (fileArg) files.push(path.resolve(fileArg));
else for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  if (div && d !== div) continue;
  const dd = path.join(root, d); if (!fs.statSync(dd).isDirectory()) continue;
  for (const f of fs.readdirSync(dd)) if (f.endsWith('.json') && f !== '_divisi.json') files.push(path.join(dd, f));
}

const keys = new Map(), employeesSeen = new Map(), per = {}, bad = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { bad.push([rel, ['JSON rusak: ' + e.message]]); continue; }
  const v = validateSpec(j, { roster });
  const errs = [...v.errors];
  if (v.kind === 'ready' && !args.includes('--no-run')) { const r = simulate(j); if (!r.ok) errs.push(`uji lokal dengan sample gagal: ${r.galat}`); }   // jalankan sample di kotak pasir lokal (tanpa n8n)
  if (path.basename(f) !== `${j.key}.json`) errs.push('nama berkas harus "<key>.json"');
  if (!fileArg && path.basename(path.dirname(f)) !== j.division) errs.push('berkas harus di folder divisinya');
  if (keys.has(j.key)) errs.push(`key dobel dengan ${keys.get(j.key)}`); else keys.set(j.key, rel);
  const c = (per[j.division] ||= { rintisan: 0, lengkap: 0, rusak: 0 });
  if (errs.length) { c.rusak++; bad.push([rel, errs]); continue; }
  if (v.kind === 'stub') { c.rintisan++; if (strict) bad.push([rel, ['masih rintisan (--strict)']]); } else c.lengkap++;
  if (j.employeeId) employeesSeen.set(j.employeeId, (employeesSeen.get(j.employeeId) || 0) + 1);
  for (const w of v.warnings) console.log(`peringatan ${rel}: ${w}`);
  if (compileArg === j.key) { const t0 = performance.now(); const b = compile(j, { token: 'cetak0000', tableId: 'T' }); console.log(JSON.stringify({ key: j.key, simpul: b.nodeCount, byte: JSON.stringify({ nodes: b.nodes, connections: b.connections }).length, msKompilasi: +(performance.now() - t0).toFixed(2), duaFase: b.twoPhase })); }
}
// setiap karyawan AI non-manajer wajib punya minimal satu berkas (hanya saat memeriksa seluruh katalog)
if (!fileArg && !div) for (const e of roster.filter((x) => x.type === 'ai' && !x.isLead && !x.isMaster && !x.isPA)) if (!employeesSeen.has(e.id)) bad.push([`${e.divisionId}/${e.divisionId}-${e.id}.json`, ['karyawan tanpa berkas rintisan (jalankan scripts/staff-stubs.mjs)']]);

const total = Object.values(per).reduce((a, c) => ({ rintisan: a.rintisan + c.rintisan, lengkap: a.lengkap + c.lengkap, rusak: a.rusak + c.rusak }), { rintisan: 0, lengkap: 0, rusak: 0 });
for (const [rel, errs] of bad) console.log(`✗ ${rel}\n   - ${errs.join('\n   - ')}`);
console.log(JSON.stringify({ berkas: files.length, ...total, perDivisi: per }));
process.exit(bad.length ? 1 : 0);
