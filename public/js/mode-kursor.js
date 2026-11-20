// Mesin keadaan sederhana untuk berpindah antara MODE KARAKTER (kursor terkunci, jalan-jalan) dan MODE KURSOR (kursor bebas, klik dan ketik)
// tanpa menekan Esc berulang. Murni logika (tanpa DOM dan tanpa pointer lock asli) supaya mudah diuji.
//
// Keadaan:   'karakter' = kursor terkunci, WASD/E/F/V/G/M/H aktif
//            'kursor'   = kursor bebas (klik panel, geser jendela); gerak mati sementara
//            'mengetik' = fokus di komposer (Enter atau "/"); ketikan TIDAK bocor ke tombol gerak
// Pemicu:    Tab = bolak-balik karakter <-> kursor; Enter atau "/" = mengetik; Esc di komposer = kembali ke karakter (tidak keluar kantor);
//            Esc di mode karakter/kursor = lepas kursor dulu, lalu keluar jalan-jalan; klik/klik kanan di area kosong = kunci lagi.
// Tombol yang TIDAK dipakai pemicu (bentrok): W A S D E F V G M H P Q R Spasi Shift.
export const PEMICU = Object.freeze({ tab: 'Tab', ngetik: ['Enter', '/'], kembali: 'Esc' });

/** @returns {{ state: string, aksi: ('kunci'|'lepas'|'fokusKomposer'|'blurKomposer'|'keluar'|null) }} */
export function langkah(state, acara) {
  const s = state === 'kursor' || state === 'mengetik' ? state : 'karakter';
  switch (acara) {
    case 'tab':
      if (s === 'mengetik') return { state: 'karakter', aksi: 'blurKomposer' };   // Tab saat mengetik: kembali ke karakter
      return s === 'karakter' ? { state: 'kursor', aksi: 'lepas' } : { state: 'karakter', aksi: 'kunci' };
    case 'enter': case 'slash':
      return s === 'mengetik' ? { state: s, aksi: null } : { state: 'mengetik', aksi: 'fokusKomposer' };
    case 'esc':
      if (s === 'mengetik') return { state: 'karakter', aksi: 'blurKomposer' };    // dari komposer: kembali ke karakter, tetap di kantor
      if (s === 'karakter') return { state: 'kursor', aksi: 'lepas' };             // Esc pertama melepas kursor (perilaku peramban)
      return { state: 'kursor', aksi: 'keluar' };                                  // Esc kedua dari mode kursor: keluar jalan-jalan
    case 'klik-kosong':
      return s === 'mengetik' ? { state: s, aksi: null } : { state: 'karakter', aksi: 'kunci' };
    case 'kunci-hilang':                                                           // peramban melepas kursor (mis. Esc): mode kursor
      return s === 'mengetik' ? { state: s, aksi: null } : { state: 'kursor', aksi: null };
    default: return { state: s, aksi: null };
  }
}

/** satu baris petunjuk kecil sesuai keadaan */
export function petunjukSatuBaris(state) {
  if (state === 'mengetik') return 'Esc: kembali ke karakter';
  if (state === 'kursor') return 'Kursor bebas · Tab atau klik kosong: kunci lagi';
  return 'Tab: kursor bebas · Enter: ngobrol';
}
