// Kualitas grafis Otomatis / Tinggi / Hemat: logika murni (diuji). Hemat = tanpa blur kaca, tanpa suasana ambien, DPR 1, 30 FPS.
export const PILIHAN = ['otomatis', 'tinggi', 'hemat'];
export const norm = (p) => (PILIHAN.includes(p) ? p : 'otomatis');
/** Apakah mode hemat berlaku. Otomatis: perangkat lemah, HP, pernah terukur lambat (tersimpan sementara), atau sedang lambat. Tinggi tidak pernah hemat. */
export function hematEfektif(pilihan, { lemah = false, hp = false, sudahHemat = false, lambat = false } = {}) {
  const p = norm(pilihan);
  if (p === 'hemat') return true;
  if (p === 'tinggi') return false;
  return !!(lemah || hp || sudahHemat || lambat);
}
export const AMBANG_LAMBAT_MS = 40;   // rata-rata waktu bingkai (saat aktif) di atas ini selama DETIK_LAMBAT = beralih ke hemat
export const DETIK_LAMBAT = 4;
export const AMBANG_AMBIEN_MS = 22.5; // di atas ini suasana ambien dimatikan
export const MASA_INGAT_MS = 7 * 24 * 3600 * 1000;
/** Penilai berdetak tiap detik: kembalikan true bila harus beralih ke hemat. Keadaan disimpan di objek penilai. */
export function buatPenilai() {
  let detik = 0;
  return { nilai(dtEma) { if (dtEma > AMBANG_LAMBAT_MS) { detik++; return detik >= DETIK_LAMBAT; } detik = Math.max(0, detik - 1); return false; }, reset() { detik = 0; } };
}
