// Memetakan setiap STAF (orang) ke KEMAMPUAN inti dan memberinya "keahlian khusus" (istilah, data, gaya, contoh, batasan khas peran).
// Mengganti blok otakProfil buatan lama di tiap staf (kini otak berasal dari kemampuan + keahlian, dirakit oleh server/staff/kemampuan.js).
// Aturan khas staf (steps/output) TIDAK diubah: itu kerangkanya. Idempoten. Pakai: node scripts/staff-kemampuan-peta.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'staff-catalog');
const dry = process.argv.includes('--dry');

// kemampuan utama per staf (kunci lengkap). Satu kemampuan = satu jenis pekerjaan; lihat server/staff/capabilities/.
const PETA = {
  'analisis-angka': 'alat-statistik-angka alat-statistik-teks cs-ayu data-citra fin-yusuf qa-jaya-pareto',
  'hitung-harga-biaya': 'alat-cicilan-pinjaman alat-diskon-bertingkat alat-hitung-ppn bizdev-gading bizdev-laksmi bizdev-prasetyo-langganan bizdev-samudra ecom-putra fin-bowo fin-ratna fin-wening mkt-reno-titik-impas-iklan rnd-tari-biaya-bahan sales-dian sales-hana-promo sales-satria sales-yoga-negosiasi studio-cahya-biaya',
  'hitung-teknis': 'alat-konversi-satuan alat-selisih-tanggal alat-tambah-hari alat-terbilang-rupiah data-bayu-ukuran-sampel eng-arif-estimasi-fitur qa-bunga-pengenceran rnd-farhan-ukuran-sampel rnd-rizky',
  'hitung-sdm': 'hr-fikri-cuti hr-fikri hr-intan-evaluasi',
  'hitung-hemat-otomasi': 'eng-gilang eng-naufal kms-aksa ops-eko',
  'perkiraan-stok-kapasitas': 'eng-gilang-sla-downtime eng-lukas-batas-laju it-doni-lisensi it-rangga-kapasitas-disk mfg-dodi retail-pandu scm-gunawan-kebutuhan scm-gunawan scm-mega-promo scm-mega scm-rini',
  'analisis-hasil-uji': 'data-citra-uji-ab eng-naufal-evaluasi-model qa-bunga qa-fitri-challenge-test qa-fitri rnd-farhan',
  'bandingkan-pilihan': 'bizdev-samudra-pasar data-bayu kms-sekar-bandingkan mfg-ilham-pemasok-kemasan ops-nisa rnd-nadia scm-agus',
  'nilai-skor': 'bizdev-gading-seleksi eng-fajar kms-sekar mkt-tasya rnd-nadia-penilaian-konsep sales-laras-bant',
  'peta-risiko': 'it-salsa-risiko legal-arman mfg-surya ops-lia-risiko reg-raisa',
  'periksa-kepatuhan': 'cs-rara-kecocokan-bahan legal-arman-hak legal-tiara-audit legal-yohana mkt-olivia-periksa-klaim reg-kevin-label reg-kevin reg-zahra-kesiapan',
  'susun-daftar-periksa': 'design-tegar-label ecom-cindy-audit eng-tania hr-galih-wawancara legal-tiara mfg-sigit-pembersihan-jalur qa-yudha-checklist-audit retail-nirmala-audit rnd-tari',
  'periksa-mutu-teks': 'design-reza kms-hafiz-uji-arahan mkt-kirana-uji-slogan',
  'susun-jadwal': 'hr-dafa it-rangga kms-aksa-cron legal-yohana-perpanjangan mfg-dodi-jadwal-produksi mfg-ilham mkt-sinta qa-yudha reg-raisa-daftar retail-danu rnd-rizky-stabilitas sales-satria-tindaklanjut scm-rini-fefo studio-bintang',
  'susun-rencana-kerja': 'cs-dika cs-rara hr-intan ops-lia retail-ayunda',
  'susun-rencana-pemasaran': 'bizdev-laksmi-cobranding ecom-putra-bundling ecom-salsabila mkt-aldi mkt-bram mkt-olivia mkt-reno sales-hana studio-cahya studio-kinanti studio-puspa',
  'prioritas-keputusan': 'alat-matriks-prioritas eng-ardi-gate-rilis eng-ardi exec-kenzo-skenario exec-kenzo',
  'rancang-struktur': 'alat-pembuat-utm data-karin-rencana-dashboard design-kayla design-rendra design-reza-alur eng-arif eng-lukas ops-eko-rancang retail-nirmala',
  'desain-visual-teknis': 'design-kayla-frame design-mira design-tegar studio-bintang-ekspor',
  'tulis-konten-pemasaran': 'ecom-cindy hr-galih mkt-keisha mkt-kirana mkt-raka',
  'tulis-naskah-video': 'mkt-nayla studio-elang-hitung-kata studio-elang studio-kinanti-hook',
  'tulis-pesan-pelanggan': 'alat-templat-email mkt-aldi-balasan-komunitas mkt-vina bizdev-prasetyo retail-ayunda-keberatan sales-laras sales-yoga studio-puspa-jawab',
  'tulis-dokumen-kerja': 'alat-notulen-rapat design-mira-brief ecom-nabila-brief eng-fajar-penulis-prd eng-tania-laporan-bug exec-dewi-agenda exec-dewi it-salsa-kesadaran mkt-tasya-brief-kreator ops-nisa-po qa-jaya rnd-ega-profil-aroma',
  'ringkas-umpan-balik': 'cs-faisal hr-dafa-survei mkt-keisha-rekap-liputan rnd-ega scm-agus-keterlambatan',
  'laporan-ringkasan-kerja': 'data-karin mfg-budi',
  'cocokkan-bersihkan-data': 'alat-bandingkan-daftar alat-bersihkan-daftar alat-csv-dari-teks data-ihsan-cocokkan data-ihsan kms-arsa-duplikat retail-pandu-opname scm-rini-opname',
  'klasifikasi-pilah': 'cs-wulan ecom-bagus-katakunci it-doni mkt-vina-segmentasi-pelanggan reg-zahra',
  'riset-halaman-web': 'alat-cek-halaman-web data-bayu-baca-halaman-kompetitor it-salsa mkt-dimas',
  'analisis-kinerja-penjualan': 'ecom-bagus ecom-nabila ecom-salsabila-performa ecom-sarah-gmv ecom-sarah mkt-arga mkt-bram-diagnosa-iklan retail-danu-target sales-dian-sellout sales-rafi-konversi sales-rafi',
  'catat-produksi-mutu': 'mfg-budi-oee mfg-sigit mfg-surya-laporan-insiden',
  'kelola-pengetahuan': 'kms-arsa kms-gita-pembagi kms-gita kms-hafiz kms-widya-panduan kms-widya',
};
const BYSTAF = new Map(); for (const [cap, keys] of Object.entries(PETA)) for (const k of keys.split(/ +/).filter(Boolean)) { if (BYSTAF.has(k)) { /* kunci muncul dua kali: yang pertama menang */ continue; } BYSTAF.set(k, cap); }

// keahlian khas per divisi: gaya, contoh, batasan (disaring ke tiap staf lewat jabatan, kata kunci, dan isiannya)
const DIV = {
  fin: ['teliti dan netral, sebut angka seperti apa adanya, tandai risiko uang dengan jelas', 'Piutang lewat 60 hari bernilai Rp 12 juta; hubungi dua klien terbesar minggu ini.', 'Bukan nasihat pajak atau akuntan resmi.'],
  legal: ['hati-hati, bedakan fakta dan saran', 'Klausul pembayaran belum menyebut denda; minta pihak hukum menambahkannya.', 'Bukan nasihat hukum final; selalu sarankan tinjauan pihak hukum.'],
  reg: ['patuh aturan, tunjuk bagian yang belum memenuhi syarat', 'Dua dokumen belum lengkap; lengkapi sebelum diajukan.', 'Jangan menjanjikan persetujuan lembaga.'],
  qa: ['berbasis bukti, sebut batas mutu dan hasil ukur', 'Satu hasil uji di luar batas; tahan batch sampai diperiksa ulang.', 'Keputusan meluluskan batch tetap di tangan penanggung jawab mutu.'],
  it: ['teknis tapi mudah dipahami, urutkan dari risiko terbesar', 'Dua kata sandi dipakai ulang; ganti dan nyalakan verifikasi dua langkah.', 'Jangan meminta atau menyebut kata sandi asli.'],
  eng: ['runtut dan konkret, sebut penyebab paling mungkin', 'Waktu respons naik di jam sibuk; periksa kueri tabel pesanan lebih dulu.', 'Estimasi adalah perkiraan, bukan janji.'],
  ops: ['praktis, fokus tenggat dan penanggung jawab', 'Dua tugas lewat tenggat; tetapkan penanggung jawab hari ini.', 'Keputusan anggaran tetap di manajer.'],
  scm: ['berbasis angka stok dan waktu kirim', 'Stok serum cukup 9 hari; pesan ulang sebelum Jumat.', 'Angka perkiraan bergantung pada data yang dimasukkan.'],
  mfg: ['disiplin proses, utamakan keselamatan dan kebersihan', 'Rendemen 88 persen di bawah target 92; cek takaran bahan.', 'Keselamatan kerja selalu didahulukan dari target.'],
  data: ['analitis dan sederhana, jujur soal ketidakpastian', 'Satu nilai jauh di atas yang lain dan menaikkan rata-rata; periksa sumbernya.', 'Jangan menyimpulkan sebab dari data yang sedikit.'],
  rnd: ['ingin tahu tapi hati-hati, bedakan temuan dan dugaan', 'Formula B lebih stabil di uji 2 minggu; ulangi dengan sampel lebih besar.', 'Hasil uji kecil belum cukup untuk klaim.'],
  mkt: ['hangat dan kreatif, jelas manfaat bagi pembeli', 'Buka dengan keluhan kulit kusam, lalu tunjukkan cara pakai tiga langkah.', 'Tanpa janji berlebihan atau klaim medis.'],
  sales: ['sopan, fokus kebutuhan calon pelanggan', 'Tawarkan demo 15 menit minggu ini karena mereka menambah cabang.', 'Jangan menekan pelanggan atau menjanjikan diskon di luar batas.'],
  ecom: ['cepat dan praktis, bahasa pasar online, sebut angka', 'Naikkan harga 3 persen pada produk laris; margin tetap aman setelah biaya platform.', 'Ikuti aturan platform marketplace.'],
  bizdev: ['strategis tapi membumi, bandingkan peluang dengan usaha', 'Kerja sama klinik lebih cepat balik modal daripada toko modern.', 'Angka kemitraan perlu disepakati tertulis.'],
  retail: ['dekat dengan lantai toko, singkat, fokus tindakan hari ini', 'Pindahkan tester ke rak depan; jumlah coba pelanggan biasanya naik.', 'Sesuaikan dengan kondisi toko sebenarnya.'],
  studio: ['visual dan hidup, adegan pendek, tanpa klaim berlebihan', 'Adegan 1: wajah lelah, narasi pendek, lalu produk muncul.', 'Hak cipta musik dan gambar harus aman.'],
  design: ['rapi dan jelas, jelaskan alasan desain', 'Perbesar tombol utama dan beri jarak agar mudah ditekan di ponsel.', 'Ukuran dan warna mengikuti panduan merek.'],
  cs: ['ramah, empatik, tenang, jangan menyalahkan pelanggan', 'Mohon maaf atas keterlambatan; kami cek pesanan Anda dan kabari dalam 2 jam.', 'Jangan menjanjikan ganti rugi tanpa persetujuan.'],
  hr: ['adil, hormat, jaga kerahasiaan, fokus perilaku bukan pribadi', 'Beban kerja tim logistik tinggi; bahas pembagian tugas bersama atasan.', 'Data pribadi karyawan bersifat rahasia.'],
  kms: ['rapi dan mudah dicari, ringkas, sebut sumber', 'Catatan ini cocok digabung dengan panduan retur yang sudah ada.', 'Jangan menghapus catatan tanpa persetujuan.'],
  exec: ['singkat untuk pemimpin, mulai dari kesimpulan', 'Kesimpulan: tunda peluncuran dua minggu; butuh keputusan Anda hari Kamis.', 'Keputusan akhir ada pada pemimpin.'],
  alat: ['netral dan singkat, jelaskan arti hasil hitung untuk orang awam', 'Total sudah termasuk PPN 11 persen; periksa apakah klien perlu faktur pajak.', 'Hasil hitung bergantung pada isian yang benar.'],
};

let n = 0; const sisa = [], cacah = {};
for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of fs.readdirSync(path.join(root, dir.name)).filter((x) => x.endsWith('.json') && x !== '_divisi.json')) {
    const file = path.join(root, dir.name, f), spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (spec.status !== 'siap') continue;
    const cap = BYSTAF.get(spec.key); if (!cap) { sisa.push(spec.key); continue; }
    const d = DIV[spec.division] || DIV.alat;
    delete spec.otakProfil;
    spec.kemampuan = [cap];
    spec.keahlian = {
      istilah: (spec.kataKunci || []).slice(0, 8),
      data: (spec.inputs || []).filter((i) => !['email'].includes(i.type)).slice(0, 4).map((i) => String(i.label).toLowerCase().slice(0, 60)),
      gaya: d[0],
      contoh: { baik: d[1], buruk: 'Jawaban umum tanpa angka atau langkah yang jelas.' },
      batasan: [d[2]],
    };
    cacah[cap] = (cacah[cap] || 0) + 1;
    if (!dry) fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    n++;
  }
}
console.log(`${dry ? 'akan dipetakan' : 'dipetakan'}: ${n} staf ke ${Object.keys(cacah).length} kemampuan`);
console.log('belum terpetakan:', sisa.length ? sisa.join(' ') : '(tidak ada)');
console.log(Object.entries(cacah).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' '));
