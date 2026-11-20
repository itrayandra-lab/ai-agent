// Nama ruangan untuk tampilan: bahasa Indonesia sederhana. Hanya pemetaan tampilan; id dan data tidak diubah.
export const NAMA_RUANG = {
  exec: 'Kantor Pimpinan', conference: 'Ruang Rapat', hr: 'Orang dan SDM', legal: 'Hukum dan Aturan', fin: 'Keuangan', ops: 'Operasional',
  mkt: 'Pemasaran', sales: 'Penjualan', cs: 'Layanan Pelanggan', ecom: 'Toko Online', retail: 'Toko dan Gerai', bizdev: 'Kemitraan',
  eng: 'Produk dan Teknologi', design: 'Desain Kreatif', studio: 'Studio Konten', data: 'Data dan Riset', kms: 'Pengetahuan dan AI', it: 'IT dan Keamanan',
  rnd: 'Riset dan Formulasi', mfg: 'Produksi', qa: 'Pengawasan Mutu', reg: 'Perizinan', scm: 'Gudang dan Pasokan',
  library: 'Perpustakaan', cafe: 'Kafe Taman', play: 'Ruang Santai', lounge: 'Ruang Tamu',
};
export const GRUP_RUANG = [
  ['Pimpinan dan umum', ['exec', 'conference', 'hr', 'legal', 'fin', 'ops']],
  ['Bisnis', ['mkt', 'sales', 'cs', 'ecom', 'retail', 'bizdev']],
  ['Produk dan kreatif', ['eng', 'design', 'studio', 'data', 'kms', 'it']],
  ['Produksi dan mutu', ['rnd', 'mfg', 'qa', 'reg', 'scm']],
  ['Fasilitas', ['library', 'cafe', 'play', 'lounge']],
];
export const namaRuang = (id, asli) => NAMA_RUANG[id] || asli || id;
