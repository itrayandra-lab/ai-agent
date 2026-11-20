// Pasangan scripts/n8n-staf-nonaktifkan.mjs: menyalakan kembali alur staf yang dulu dinonaktifkan (dibaca dari daftar id).
// Hanya alur yang (1) ada di daftar dan (2) namanya masih berawalan "[RAIVERSE][staf] " yang dinyalakan. Tidak menghapus apa pun.
// Pakai:  node scripts/n8n-staf-aktifkan.mjs               (mode KERING, bawaan)
//         node scripts/n8n-staf-aktifkan.mjs --jalan       (menyalakan)
//         opsi: --daftar <berkas.json>
import * as L from './lib/n8n-staf.mjs';

L.loadEnv();
const jalan = process.argv.includes('--jalan'), file = L.argOf('--daftar', L.defaultFile());
try {
  const daftar = L.readJson(file, null);
  if (!daftar?.alur?.length) { console.log(`Tidak ada daftar id di ${file}. Tidak ada yang perlu dinyalakan.`); process.exit(0); }
  const nyata = new Map((await L.listAll()).map((w) => [w.id, w]));
  const target = daftar.alur.filter((x) => { const w = nyata.get(x.id); return w && L.isStaf(w) && !w.active; });
  console.log(`Daftar berisi ${daftar.alur.length} id; ${target.length} perlu dinyalakan (sisanya sudah menyala atau sudah tidak ada).`);
  if (!jalan) { console.log('MODE KERING: tidak ada yang diubah. Tambahkan --jalan untuk melaksanakan.'); process.exit(0); }
  let ok = 0, gagal = 0;
  for (const x of target) { try { await L.api('POST', `/api/v1/workflows/${encodeURIComponent(x.id)}/activate`, {}); ok++; } catch (e) { gagal++; console.log('  gagal:', x.name, '-', e.message); } }
  console.log(`Dinyalakan ${ok}, gagal ${gagal}.`);
  console.log(JSON.stringify({ mode: 'jalan', dinyalakan: ok, gagal }));
  process.exit(gagal ? 1 : 0);
} catch (e) { console.error('Gagal:', e.message); process.exit(1); }
