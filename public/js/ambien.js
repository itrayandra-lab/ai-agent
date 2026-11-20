// Penjadwal kehidupan ambien Kantor 3D: logika MURNI (tanpa WebGL, tanpa DOM) supaya bisa diuji dan hampir tanpa biaya.
// Satu detak global (tiap beberapa detik) memilih satu agen menganggur di dekat pandangan untuk "mampir" ke taman, pantri, bangku atau ruang bersama.
// Status nyata selalu menang: hanya agen yang sedang bebas yang dipilih. Pelaksanaan (jalur, titik duduk) memakai fungsi kantor yang sudah ada.
export const TINGKAT = ['penuh', 'ringan', 'mati'];
export const KUOTA = { penuh: 6, ringan: 3, mati: 0 };      // agen ambien bersamaan di sekitar pandangan
export const SELANG = { penuh: 1800, ringan: 3600, mati: 0 }; // jeda antar-penjadwalan (ms)
export const JARAK_DEKAT = 46;                                 // hanya agen sedekat ini ke titik pandang yang boleh dijadwalkan (agen jauh tidak dianimasikan)

/** Tingkat yang benar-benar berlaku: pilihan pengguna dibatasi kondisi perangkat dan halaman. */
export function tingkatEfektif(pilihan, { hp = false, hemat = false, hematTotal = false, tersembunyi = false, penuhLayar = false, fpsRendah = false } = {}) {
  const p = TINGKAT.includes(pilihan) ? pilihan : 'ringan';   // bawaan: Ringan di mana pun (mesin tak dikenal); Penuh hanya bila dipilih
  if (tersembunyi || penuhLayar || hematTotal || fpsRendah || p === 'mati') return 'mati';   // mode hemat atau waktu bingkai > 22 ms: ambien mati
  if (hemat || hp) return 'ringan';   // perangkat lemah atau HP: paling banyak Ringan
  return p;
}
export function kuotaUntuk(tingkat, { hp = false } = {}) { const k = KUOTA[tingkat] ?? 0; return hp ? Math.min(k, 2) : k; }

/** Bobot aktivitas; waktu = 'pagi' | 'siang' | 'sore' | 'malam'. */
export function bobotAktivitas(waktu) {
  const w = { taman: 3, pantri: 2, bangku: 2, rapat: 1, baca: 1 };
  if (waktu === 'pagi' || waktu === 'sore') w.pantri += 1;
  if (waktu === 'siang') w.taman += 1;
  if (waktu === 'malam') { w.taman -= 1; w.bangku += 1; }
  return w;
}
export function pilihBerbobot(bobot, rnd = Math.random) {
  const e = Object.entries(bobot).filter(([, b]) => b > 0); const jml = e.reduce((s, [, b]) => s + b, 0); if (!jml) return null;
  let r = rnd() * jml; for (const [k, b] of e) { r -= b; if (r < 0) return k; } return e[e.length - 1][0];
}

/**
 * Pilih satu agen untuk dijadwalkan, atau null.
 * kandidat: [{ id, jarak, bebas, diMeja, lod, ambien }]  (jarak ke titik pandang)
 * aturan: bebas dan diMeja (belum ke mana-mana), lod <= 2, jarak <= JARAK_DEKAT; agen ambien yang sedang jalan dihitung ke kuota.
 */
export function pilihAgen(kandidat, { kuota, rnd = Math.random } = {}) {
  if (!(kuota > 0)) return null;
  let aktif = 0; const layak = [];
  for (const k of kandidat) {
    if (k.ambien) { aktif++; continue; }
    if (k.bebas && k.diMeja && k.lod <= 2 && k.jarak <= JARAK_DEKAT) layak.push(k);
  }
  if (aktif >= kuota || !layak.length) return null;
  layak.sort((a, b) => a.jarak - b.jarak);
  const n = Math.min(layak.length, 5); return layak[Math.min(n - 1, Math.floor(rnd() * rnd() * n))];   // condong ke yang terdekat, tetapi tidak selalu orang yang sama
}

/** Penjadwal berdetak: panggil tik(now) tiap bingkai (murah: hanya membandingkan waktu); menjalankan `kerja` paling cepat tiap SELANG. */
export function buatPenjadwal({ rnd = Math.random } = {}) {
  let berikut = 0;
  return {
    tik(now, tingkat, kerja) {
      const s = SELANG[tingkat]; if (!s || now < berikut) return false;
      berikut = now + s * (0.7 + rnd() * 0.6); kerja(); return true;
    },
    reset() { berikut = 0; },
  };
}

/** Sapaan untuk pengguna yang lewat dekat; satu per agen per jeda (diatur pemanggil). */
export const SAPAAN = ['Halo {o}!', 'Eh, {o} lewat. Apa kabar?', 'Hai {o}, semangat ya!', 'Halo {o}, mampir minum kopi?', '{o}! Lagi keliling kantor ya?'];
export const OBROLAN_SINGKAT = ['Tadi kopinya enak banget', 'Anginnya adem ya di taman', 'Habis ini aku lanjut kerja lagi', 'Lihat deh, airnya jernih banget', 'Pas banget istirahat sebentar', 'Hehe, kamu udah makan?'];
export const isi = (tpl, o) => String(tpl).replace('{o}', o || 'Bos');
