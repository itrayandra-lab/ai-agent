// Meringankan n8n: MENONAKTIFKAN (bukan menghapus) semua alur berawalan "[RAIVERSE][staf] ".
// Staf kini berjalan di mesin native RAIVERSE (docs/STAF-NATIVE.md); alur n8n-nya tidak perlu menyala.
// Aman: tidak menyentuh 30 alur milik Owner maupun otomasi "[RAIVERSE] ..." non-staf (dibuktikan dengan sidik jari sebelum/sesudah),
// tidak ada penghapusan, id alur yang dinonaktifkan disimpan agar bisa dinyalakan lagi dengan scripts/n8n-staf-aktifkan.mjs.
// Pakai:
//   node scripts/n8n-staf-nonaktifkan.mjs                 (mode KERING: hanya daftar dan hitungan; bawaan)
//   node scripts/n8n-staf-nonaktifkan.mjs --jalan         (benar-benar menonaktifkan)
//   opsi: --daftar <berkas.json>  (tempat menyimpan id; bawaan data/n8n-staf-nonaktif.json)
// Kunci n8n dibaca dari .env (N8N_API_KEY, N8N_URL) dan tidak pernah dicetak.
import * as L from './lib/n8n-staf.mjs';

L.loadEnv();
const jalan = process.argv.includes('--jalan'), file = L.argOf('--daftar', L.defaultFile());
const tampil = (judul, r) => console.log(`${judul}: total ${r.total} | staf ${r.staf} (aktif ${r.stafAktif}) | otomasi RAIVERSE lain ${r.raiverseLain} (aktif ${r.raiverseLainAktif}) | milik Owner/lainnya ${r.lainnya} (aktif ${r.lainnyaAktif})`);

try {
  const sebelum = await L.listAll(), r0 = L.ringkas(sebelum);
  tampil('SEBELUM', r0);
  const target = sebelum.filter((w) => L.isStaf(w) && w.active);
  if (!jalan) {
    for (const w of target.slice(0, 5)) console.log('  contoh yang akan dinonaktifkan:', w.name);
    console.log(`MODE KERING: ${target.length} alur staf aktif akan dinonaktifkan. Tidak ada yang diubah. Tambahkan --jalan untuk melaksanakan.`);
    console.log(JSON.stringify({ mode: 'kering', akanDinonaktifkan: target.length, ...r0 }));
    process.exit(0);
  }
  // simpan daftar DULU (gabungkan dengan daftar lama supaya jalan ulang tidak menghilangkan id)
  const lama = L.readJson(file, { alur: [] }), byId = new Map((lama.alur || []).map((x) => [x.id, x]));
  for (const w of target) byId.set(w.id, { id: w.id, name: w.name });
  L.writeJson(file, { dibuat: new Date().toISOString(), catatan: 'Alur staf yang dinonaktifkan oleh scripts/n8n-staf-nonaktifkan.mjs. Nyalakan lagi: node scripts/n8n-staf-aktifkan.mjs --jalan', alur: [...byId.values()] });
  let ok = 0, gagal = 0;
  for (const w of target) {
    if (!L.isStaf(w)) continue;   // sabuk pengaman kedua
    try { await L.api('POST', `/api/v1/workflows/${encodeURIComponent(w.id)}/deactivate`, {}); ok++; } catch (e) { gagal++; console.log('  gagal:', w.name, '-', e.message); }
  }
  const sesudah = await L.listAll(), r1 = L.ringkas(sesudah);
  tampil('SESUDAH', r1);
  const utuh = L.sidikJari(sebelum) === L.sidikJari(sesudah);
  console.log(`Dinonaktifkan ${ok}, gagal ${gagal}. Alur non-staf tidak berubah: ${utuh ? 'YA' : 'TIDAK (periksa!)'}. Daftar id: ${file}`);
  console.log(JSON.stringify({ mode: 'jalan', dinonaktifkan: ok, gagal, nonStafUtuh: utuh, sebelum: r0, sesudah: r1 }));
  process.exit(gagal || !utuh ? 1 : 0);
} catch (e) { console.error('Gagal:', e.message); process.exit(1); }
