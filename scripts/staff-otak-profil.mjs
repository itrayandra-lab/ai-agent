// Memberi SETIAP spesifikasi staf blok `otakProfil` (otak berbasis data, bukan kode per staf), dirakit dari data spesifikasi yang sudah ada:
// jabatan, ringkasan tugas, kata kunci, divisi, ditambah tabel gaya per divisi di bawah. Aturan lama tetap kerangka dan pemeriksa;
// blok ini hanya dipakai mesin native untuk meminta AI membahas hasil aturan (lihat server/staff/native.js).
// Idempoten dan hanya menambah satu bidang. Staf yang sudah punya langkah AI sendiri (otak/minta_ai) dilewati.
// Pakai: node scripts/staff-otak-profil.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'staff-catalog');
const dry = process.argv.includes('--dry');
const RISIKO = { pembahasan: 'teks', risiko: 'pilihan:rendah|sedang|tinggi', langkah: 'daftar' };
const IDE = { pembahasan: 'teks', ide: 'daftar', langkah: 'daftar' };
const POIN = { pembahasan: 'teks', poin: 'daftar', langkah: 'daftar' };
// gaya, skema, contoh baik/buruk per divisi (keberagaman nyata per bidang kerja)
const DIV = {
  fin: { gaya: 'teliti, netral, sebut angka seperti apa adanya, tandai risiko uang dengan jelas', skema: RISIKO, baik: 'Piutang lewat 60 hari bernilai Rp 12 juta; hubungi dua klien terbesar minggu ini.', buruk: 'Keuangan perlu diperbaiki.' },
  legal: { gaya: 'hati-hati, jelas, bedakan fakta dan saran, ingatkan bahwa ini bukan nasihat hukum final', skema: RISIKO, baik: 'Klausul pembayaran belum menyebut denda; minta pihak hukum menambahkannya.', buruk: 'Pasti aman secara hukum.' },
  reg: { gaya: 'patuh aturan, tunjuk bagian yang belum memenuhi syarat, tanpa menjanjikan persetujuan', skema: RISIKO, baik: 'Dua dokumen belum lengkap; lengkapi sebelum diajukan.', buruk: 'Pasti disetujui.' },
  qa: { gaya: 'berbasis bukti, sebut batas mutu dan hasil ukur, tegas pada yang di luar batas', skema: RISIKO, baik: 'Satu hasil uji di luar batas; tahan batch sampai diperiksa ulang.', buruk: 'Mutu kelihatannya baik.' },
  it: { gaya: 'teknis tapi mudah dipahami, urutkan dari risiko terbesar, beri langkah yang bisa dicoba', skema: RISIKO, baik: 'Dua kata sandi dipakai ulang; ganti dan nyalakan verifikasi dua langkah.', buruk: 'Sistem mungkin kurang aman.' },
  eng: { gaya: 'runtut dan konkret, sebut penyebab paling mungkin dan cara memeriksanya', skema: RISIKO, baik: 'Waktu respons naik di jam sibuk; periksa kueri tabel pesanan lebih dulu.', buruk: 'Coba perbaiki kodenya.' },
  ops: { gaya: 'praktis, fokus tenggat dan penanggung jawab, ringkas', skema: RISIKO, baik: 'Dua tugas lewat tenggat; tetapkan penanggung jawab hari ini.', buruk: 'Operasional perlu rapi.' },
  scm: { gaya: 'berbasis angka stok dan waktu kirim, tandai risiko kehabisan atau menumpuk', skema: RISIKO, baik: 'Stok serum cukup 9 hari; pesan ulang sebelum Jumat.', buruk: 'Stok sepertinya cukup.' },
  mfg: { gaya: 'disiplin proses, utamakan keselamatan dan kebersihan, sebut batas yang dilanggar', skema: RISIKO, baik: 'Hasil rendemen 88 persen di bawah target 92; cek takaran bahan.', buruk: 'Produksi lancar.' },
  data: { gaya: 'analitis dan sederhana, jelaskan arti angka, jujur soal ketidakpastian', skema: RISIKO, baik: 'Satu nilai jauh di atas yang lain dan menaikkan rata-rata; periksa sumbernya.', buruk: 'Datanya bagus.' },
  rnd: { gaya: 'ingin tahu tapi hati-hati, bedakan temuan dan dugaan, sarankan uji kecil', skema: POIN, baik: 'Formula B lebih stabil di uji 2 minggu; ulangi dengan sampel lebih besar.', buruk: 'Formula B pasti terbaik.' },
  mkt: { gaya: 'hangat, kreatif, jelas manfaatnya bagi pembeli, tanpa janji berlebihan', skema: IDE, baik: 'Buka dengan keluhan kulit kusam, lalu tunjukkan cara pakai tiga langkah.', buruk: 'Produk terbaik sedunia!' },
  sales: { gaya: 'sopan, fokus kebutuhan calon pelanggan, beri langkah tindak lanjut yang jelas', skema: IDE, baik: 'Tawarkan demo 15 menit minggu ini karena mereka sedang menambah cabang.', buruk: 'Beli sekarang atau rugi.' },
  ecom: { gaya: 'cepat dan praktis, bahasa pasar online, sebut angka penjualan dan biaya', skema: IDE, baik: 'Naikkan harga 3 persen pada produk laris; margin tetap aman setelah biaya platform.', buruk: 'Jualan perlu ditingkatkan.' },
  bizdev: { gaya: 'strategis tapi membumi, bandingkan peluang dengan usaha yang dibutuhkan', skema: IDE, baik: 'Kerja sama dengan klinik kecantikan lebih cepat balik modal daripada toko modern.', buruk: 'Peluangnya besar.' },
  retail: { gaya: 'dekat dengan lantai toko, singkat, fokus tindakan hari ini', skema: IDE, baik: 'Pindahkan tester ke rak depan; jumlah coba pelanggan biasanya naik.', buruk: 'Toko harus lebih bagus.' },
  studio: { gaya: 'visual dan hidup, tulis adegan pendek, hindari klaim berlebihan', skema: IDE, baik: 'Adegan 1: wajah lelah, narasi pendek, lalu produk muncul.', buruk: 'Buat iklan yang keren.' },
  design: { gaya: 'rapi dan jelas, jelaskan alasan desain dengan bahasa sederhana', skema: IDE, baik: 'Perbesar tombol utama dan beri jarak agar mudah ditekan di ponsel.', buruk: 'Desainnya kurang bagus.' },
  cs: { gaya: 'ramah, empatik, tenang, jangan menyalahkan pelanggan, beri langkah pasti', skema: POIN, baik: 'Mohon maaf atas keterlambatan; kami cek pesanan Anda dan kabari dalam 2 jam.', buruk: 'Itu bukan salah kami.' },
  hr: { gaya: 'adil, hormat, jaga kerahasiaan, fokus perilaku bukan pribadi', skema: POIN, baik: 'Beban kerja tim logistik tinggi; bahas pembagian tugas bersama atasan.', buruk: 'Karyawan malas.' },
  kms: { gaya: 'rapi dan mudah dicari, ringkas, sebut sumber dan kata kunci', skema: POIN, baik: 'Catatan ini cocok digabung dengan panduan retur yang sudah ada.', buruk: 'Simpan saja.' },
  exec: { gaya: 'singkat untuk pemimpin, mulai dari kesimpulan, lalu keputusan yang dibutuhkan', skema: POIN, baik: 'Kesimpulan: tunda peluncuran dua minggu; butuh keputusan Anda hari Kamis.', buruk: 'Ada banyak hal yang perlu dibahas.' },
  alat: { gaya: 'netral dan singkat, jelaskan arti hasil hitung untuk orang awam', skema: POIN, baik: 'Total sudah termasuk PPN 11 persen; periksa apakah klien perlu faktur pajak.', buruk: 'Hasil sudah benar.' },
};
const GENERIC = DIV.alat;

let n = 0, skip = 0;
for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const mf = path.join(root, dir.name, '_divisi.json'), manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : { nama: 'alat umum' };
  for (const f of fs.readdirSync(path.join(root, dir.name)).filter((x) => x.endsWith('.json') && x !== '_divisi.json')) {
    const file = path.join(root, dir.name, f), spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (spec.status !== 'siap') continue;
    if ((spec.steps || []).some((s) => s.use === 'otak' || s.use === 'minta_ai') || spec.otakProfil) { skip++; continue; }
    const d = DIV[spec.division] || GENERIC, kk = String(spec.kataKunci?.[0] || spec.name).toLowerCase();
    spec.otakProfil = {
      peran: `${spec.title} di divisi ${manifest.nama || spec.division}, memakai bahasa awam`,
      tujuan: `${spec.ringkas} Setelah aturan selesai menghitung, bahas artinya dan beri langkah berikutnya yang jelas.`,
      gaya: d.gaya,
      skema: d.skema,
      contoh: { baik: d.baik, buruk: d.buruk },
      batas: { pembahasan: 600, butir: 5 },
      model: 'kecil',
      kriteria: { kataKunci: [kk], minPanjang: 40, maksPanjang: 600 },
      contohAI: JSON.stringify({ pembahasan: `Hasil ${spec.name.toLowerCase()} perlu dibaca bersama: ${kk} menjadi fokus utama dan angka dari aturan sudah dipakai apa adanya.`, ...(d.skema.risiko ? { risiko: 'sedang' } : {}), ...(d.skema.ide ? { ide: ['Coba satu langkah kecil dulu', 'Catat hasilnya minggu depan'] } : {}), ...(d.skema.poin ? { poin: ['Hasil sudah dihitung dengan aturan', 'Periksa isian yang paling menentukan'] } : {}), langkah: ['Periksa isian yang paling berpengaruh', 'Putuskan tindakan hari ini', 'Catat hasilnya'] }),
    };
    if (!dry) fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    n++;
  }
}
console.log(`${dry ? 'akan ditambah' : 'ditambah'}: ${n} staf, dilewati (sudah punya AI/blok): ${skip}`);
