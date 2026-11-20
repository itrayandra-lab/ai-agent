// Evaluasi mutu seluruh staf dengan model tiruan: node scripts/staff-mutu.mjs [divisi]
process.env.DATA_DIR ||= (await import('node:fs')).mkdtempSync((await import('node:path')).join((await import('node:os')).tmpdir(), 'ray-mutu-'));
const registry = await import('../server/staff/registry.js'); const { evaluasi } = await import('../server/staff/mutu.js');
const only = process.argv[2]; let lulus = 0, total = 0; const gagal = [];
for (const s of registry.all().filter(registry.ready).filter((x) => !only || x.division === only)) { total++; const r = await evaluasi(s); if (r.ok) lulus++; else gagal.push([s.key, r.gagal.join('; ')]); }
console.log(`Mutu (model tiruan): ${lulus} dari ${total} staf lulus`); for (const g of gagal) console.log('  GAGAL', g[0], '-', g[1]);
process.exit(gagal.length ? 1 : 0);
