// Commerce knowledge: marketplace, TikTok Shop, live commerce, pricing, B2B sales RayFlow, reseller/distributor, customer success, beauty advisor, retail & omnichannel
const K = (title, audience, tags, content) => ({ title, audience, tags, content: content.trim() });
export default [
  K('Setup Toko Shopee & Tokopedia', { divisions: ['ecom'], roles: ['marketplace', 'shopee', 'tokopedia', 'commerce'] }, ['marketplace', 'shopee', 'tokopedia', 'setup', 'ray-beauty'], `
# Setup Toko Shopee & Tokopedia

Panduan menyiapkan toko resmi Ray Beauty (dan toko pendukung bila ada) di Shopee dan Tokopedia agar siap jualan, siap kampanye, dan lolos verifikasi.

## Prasyarat Dokumen
- Legalitas perusahaan: NIB, NPWP badan, akta, dan surat kuasa merek bila pendaftar bukan pemilik merek.
- Sertifikat merek (atau bukti pendaftaran) untuk pengajuan status toko resmi/official.
- Nomor notifikasi BPOM untuk setiap SKU kosmetik; simpan dalam master data produk (lihat [[Produk Ray Beauty]]).
- Rekening perusahaan atas nama badan usaha.
- Syarat status toko resmi/mall berubah dari waktu ke waktu: verifikasi ke ketentuan platform terbaru.

## Langkah Setup
1. Buat akun seller memakai email dan nomor perusahaan (bukan pribadi). Simpan kredensial di password manager tim, aktifkan 2FA.
2. Isi profil toko: nama toko konsisten dengan merek, logo resolusi tinggi, banner toko, deskripsi singkat merek dan klaim yang sudah disetujui ([[Pedoman Klaim Kosmetik]]).
3. Atur alamat gudang/pickup, jam operasional, dan kurir yang diaktifkan. Pilih kurir sesuai cakupan dan berat produk.
4. Buat sub-akun untuk CS, admin listing, dan tim ads dengan hak akses minimum.
5. Atur dekorasi toko: kategori etalase (Serum, Moisturizer, Sunscreen, Bundling, Promo), produk unggulan di atas.
6. Unggah produk mengikuti [[Optimasi Listing Produk Marketplace]] dan [[SOP Marketplace - Listing & Kampanye]].
7. Aktifkan fitur chat otomatis (salam, di luar jam kerja) dan template balasan dari [[CS Marketplace - SLA Chat & Template Balasan]].
8. Ajukan status toko resmi setelah dokumen lengkap.

## Checklist Go-Live
- [ ] Semua SKU memiliki nomor BPOM, berat, dimensi, dan stok akurat.
- [ ] Harga sudah dihitung dengan [[Matematika Harga - Margin Setelah Biaya Platform]].
- [ ] Kebijakan retur toko tertulis dan selaras dengan [[Manajemen Ulasan & Retur Marketplace]].
- [ ] Integrasi stok dengan sistem gudang/OMS diuji (pesanan uji, pembatalan uji).
- [ ] Notifikasi pesanan dan chat masuk ke tim yang tepat.
- [ ] Penanggung jawab harian toko ditetapkan.

## Kesalahan Umum
- Nama dan deskripsi produk berbeda antar-platform sehingga membingungkan pelanggan.
- Stok tidak sinkron sehingga terjadi pembatalan oleh penjual, yang menurunkan performa toko (lihat [[Metrik Performa Toko Marketplace]]).
- Menulis klaim medis di deskripsi ("menyembuhkan jerawat"), berisiko takedown.
`),

  K('Optimasi Listing Produk Marketplace', { divisions: ['ecom'], roles: ['marketplace', 'shopee', 'tokopedia', 'listing', 'commerce'] }, ['marketplace', 'listing', 'seo', 'konten'], `
# Optimasi Listing Produk Marketplace

Listing adalah "etalase dan salesperson" produk. Tujuannya dua: mudah ditemukan (search) dan mudah dibeli (konversi).

## Judul Produk
Rumus: **Merek + Nama Produk + Fungsi/Benefit utama + Bahan kunci + Ukuran/Varian**.
Contoh: "Ray Beauty Brightening Serum Niacinamide 5% 20ml - Serum Wajah Mencerahkan Kulit Kusam".
- Letakkan kata kunci terpenting di awal; batas karakter mengikuti platform (verifikasi ke ketentuan platform terbaru).
- Hindari keyword stuffing, huruf kapital semua, dan nama merek lain.
- Benefit harus sesuai [[Pedoman Klaim Kosmetik]]: "membantu mencerahkan", bukan "memutihkan permanen".

## Riset Kata Kunci
1. Ketik kata dasar di kolom pencarian (mis. "serum niacinamide") dan catat saran autocomplete.
2. Lihat judul 10 kompetitor teratas; ambil pola kata yang berulang.
3. Gunakan data kata kunci di dasbor iklan untuk volume relatif.
4. Kelompokkan: kata kunci utama (judul), sekunder (deskripsi), long-tail (atribut dan tag).

## Gambar (urutan disarankan)
1. Foto utama: produk di latar bersih, terang, produk mengisi sebagian besar frame.
2. Benefit utama dalam teks singkat.
3. Bahan kunci dan fungsinya.
4. Cara pakai (langkah bergambar).
5. Tekstur/swatch.
6. Nomor BPOM, halal (bila ada), dan info ukuran.
7. Testimoni atau before-after hanya bila asli, bisa dibuktikan, dan disetujui Regulatory.
Tambahkan video produk singkat bila platform mendukung.

## Atribut & Deskripsi
- Isi semua atribut wajib dan opsional (jenis kulit, masalah kulit, bahan, ukuran, masa simpan). Atribut lengkap membantu filter pencarian.
- Struktur deskripsi: hook 1 kalimat, benefit (poin), bahan kunci, cara pakai, cocok untuk, komposisi lengkap (INCI), BPOM, info penyimpanan, FAQ singkat.
- Varian: gabungkan ukuran/varian dalam satu listing agar ulasan terkumpul.

## Checklist QC Listing
- [ ] Judul sesuai rumus, tidak ada klaim terlarang.
- [ ] Minimal 6 gambar, foto utama sesuai aturan platform.
- [ ] Atribut 100% terisi, kategori benar.
- [ ] Harga dan stok benar, berat dan dimensi akurat.
- [ ] Deskripsi konsisten dengan kemasan dan website.

## Pemantauan
Tinjau setiap 2 minggu: impresi, klik, CTR, dan konversi per listing (lihat [[Analitik E-commerce - Rumus GMV]]). CTR rendah berarti perbaiki judul/foto utama; konversi rendah berarti perbaiki harga, ulasan, gambar penjelas, atau deskripsi.
`),

  K('Metrik Performa Toko Marketplace', { divisions: ['ecom', 'cs'], roles: ['marketplace', 'shopee', 'tokopedia', 'commerce', 'support'] }, ['marketplace', 'performa', 'rating', 'kpi'], `
# Metrik Performa Toko Marketplace

Platform menilai penjual dengan metrik performa. Skor yang buruk dapat membatasi akses ke kampanye, menurunkan visibilitas, bahkan memicu penalti. Nama metrik, ambang batas, dan konsekuensinya berbeda per platform dan sering berubah: verifikasi ke ketentuan platform terbaru di dasbor seller.

## Kelompok Metrik Umum
| Kelompok | Contoh metrik | Pemilik |
|---|---|---|
| Fulfilment | tingkat pesanan tidak terselesaikan, pembatalan oleh penjual, keterlambatan pengiriman, waktu proses pesanan | Ops/Gudang |
| Layanan | persentase chat dibalas, waktu balas chat | CS |
| Kepuasan | rating toko, rating produk, tingkat retur/komplain | CS + QA |
| Kepatuhan | pelanggaran listing (produk terlarang, klaim, duplikasi, spam) | Admin listing |

## Ritme Pemantauan
- **Harian**: pesanan belum diproses, chat belum dibalas, ulasan bintang 1-3 baru, pelanggaran listing.
- **Mingguan**: tren rating, penyebab pembatalan, keterlambatan per kurir, top keluhan.
- **Bulanan**: laporan performa ke Head of E-commerce, rencana perbaikan.

## Penyebab & Pencegahan
- **Pembatalan oleh penjual** biasanya karena stok tidak sinkron. Solusi: sinkronisasi stok otomatis, buffer stok untuk SKU laris, matikan listing saat stok habis.
- **Keterlambatan kirim**: tetapkan cut-off harian; pesanan masuk sebelum cut-off dikirim hari yang sama. Siapkan tenaga tambahan saat kampanye ([[Kalender Kampanye E-commerce]]).
- **Chat lambat**: jadwal shift CS, auto-reply, template ([[CS Marketplace - SLA Chat & Template Balasan]]).
- **Rating rendah**: telusuri akar masalah (produk, pengiriman, ekspektasi). Lihat [[Manajemen Ulasan & Retur Marketplace]].
- **Pelanggaran listing**: QC sebelum publish ([[Optimasi Listing Produk Marketplace]]).

## Rencana Perbaikan (template)
- Metrik yang turun:
- Nilai sekarang vs target internal:
- Akar masalah (5 Whys):
- Tindakan, PIC, tenggat:
- Cara verifikasi perbaikan:

## Aturan Tim
1. Setiap peringatan performa dari platform dicatat dan ditindaklanjuti maksimal 1 hari kerja.
2. Jangan mengakali metrik (mis. meminta pembeli membatalkan pesanan); risiko sanksi lebih besar.
3. Definisi metrik internal mengacu ke [[KPI Dictionary]].
`),

  K('Kampanye, Voucher & Flash Sale Marketplace', { divisions: ['ecom', 'mkt'], roles: ['marketplace', 'shopee', 'tokopedia', 'campaign', 'commerce', 'pricing'] }, ['marketplace', 'kampanye', 'voucher', 'flash-sale', 'promo'], `
# Kampanye, Voucher & Flash Sale Marketplace

Kampanye tanggal kembar, payday, dan Ramadan menyumbang lonjakan penjualan. Kalender acuan ada di [[Kalender Kampanye E-commerce]], prosedur teknis di [[SOP Marketplace - Listing & Kampanye]].

## Jenis Mekanisme
- **Kampanye platform**: event resmi yang butuh pendaftaran produk dan syarat harga/diskon. Syarat dan biaya tambahan bervariasi: verifikasi ke ketentuan platform terbaru.
- **Voucher toko**: potongan nominal atau persen dengan minimum belanja; bisa publik, khusus follower, atau khusus pembeli lama.
- **Voucher produk**: berlaku untuk SKU tertentu.
- **Flash sale toko**: harga khusus dalam slot waktu terbatas dengan kuota stok.
- **Bundling dan beli X gratis Y**: lihat [[Matematika Promo - Stacking Diskon & Bundling]].
- **Gratis ongkir/cashback**: biasanya program platform dengan biaya layanan tambahan.

## Timeline Persiapan Kampanye Besar
- **H-30**: tetapkan target GMV, SKU hero, mekanisme, budget promo dan ads. Ajukan persetujuan sesuai [[Kebijakan Persetujuan]].
- **H-21**: daftarkan produk ke kampanye platform, cek harga coret dan syarat.
- **H-14**: siapkan materi visual, banner toko, jadwal live dan konten afiliasi.
- **H-7**: alokasi stok ke gudang marketplace, pastikan bahan kemas cukup, briefing CS dan gudang.
- **H-1**: aktifkan voucher terjadwal, uji checkout, cek harga final setelah semua potongan.
- **Hari H**: war room, pantau stok, ads, chat; eskalasi cepat.
- **H+3**: evaluasi kampanye.

## Aturan Desain Voucher
1. Minimum belanja disetel sedikit di atas AOV saat ini untuk menaikkan AOV.
2. Batasi kuota dan periode; pantau penggunaan agar budget tidak bocor.
3. Hitung harga bersih terburuk (semua potongan bertumpuk) dan pastikan margin kontribusi tetap positif atau sesuai rencana investasi.
4. Bedakan voucher akuisisi (pembeli baru) dan retensi (pembeli lama).

## Flash Sale
- Pilih SKU dengan stok kuat dan margin cukup, atau SKU entry-level untuk menarik pembeli baru.
- Kuota kecil menciptakan urgensi; jangan menjual rugi tanpa tujuan jelas.
- Siapkan produk pendamping (cross-sell) di halaman toko.

## Evaluasi Pasca-Kampanye
GMV vs target, jumlah pesanan, AOV, konversi, biaya promo per pesanan, ROAS ads, pembeli baru, dan stok tersisa. Catat pelajaran untuk kampanye berikutnya.
`),

  K('Dasar Iklan Marketplace', { divisions: ['ecom', 'mkt'], roles: ['marketplace', 'ads', 'shopee', 'tokopedia', 'commerce', 'performance'] }, ['marketplace', 'iklan', 'ads', 'roas'], `
# Dasar Iklan Marketplace

Iklan marketplace (iklan pencarian, iklan produk rekomendasi, iklan toko) membeli visibilitas. Iklan hanya efektif bila listing sudah baik; iklan tidak memperbaiki produk atau listing yang lemah.

## Istilah & Rumus
- **Impresi**: berapa kali iklan tampil.
- **CTR** = klik / impresi.
- **CPC** = biaya / klik.
- **CR iklan** = pesanan dari iklan / klik.
- **ROAS** = penjualan dari iklan / biaya iklan.
- **ACOS** = biaya iklan / penjualan dari iklan (kebalikan ROAS).
- **ROAS break-even** = 1 / margin kontribusi sebelum iklan (dalam desimal). Jika margin kontribusi 40%, ROAS break-even = 2,5. Hitung margin dengan [[Matematika Harga - Margin Setelah Biaya Platform]].

## Struktur Kampanye
1. **Kampanye otomatis** untuk menemukan kata kunci baru, budget kecil.
2. **Kampanye manual kata kunci** untuk kata kunci yang terbukti konversi; atur bid per kata kunci.
3. **Kampanye kata kunci merek** ("ray beauty") untuk melindungi pencarian merek.
4. **Iklan toko** untuk membangun awareness dan follower.

## Rutinitas Optimasi
- **Harian**: cek pemakaian budget, iklan berhenti karena stok habis, lonjakan CPC.
- **2-3 kali per minggu**: matikan kata kunci dengan klik banyak tanpa pesanan (setelah data cukup), naikkan bid kata kunci dengan ROAS di atas target, tambahkan kata kunci negatif bila fitur tersedia.
- **Mingguan**: realokasi budget ke SKU dan kata kunci dengan ROAS terbaik.

## Diagnosa Cepat
| Gejala | Kemungkinan penyebab | Tindakan |
|---|---|---|
| Impresi rendah | bid rendah, kata kunci sempit | naikkan bid, tambah kata kunci |
| CTR rendah | foto utama/judul/harga kurang menarik | perbaiki listing |
| CR rendah | ulasan sedikit, harga, deskripsi | perbaiki halaman produk, voucher |
| ROAS turun saat kampanye | CPC naik karena persaingan | fokus SKU hero, batasi kata kunci mahal |

## Aturan Budget
- Tetapkan target ROAS per tujuan: akuisisi produk baru boleh di bawah break-even sementara (dengan persetujuan), produk matang harus di atas break-even.
- Perubahan budget di atas batas wewenang mengikuti [[Kebijakan Persetujuan]].
- Biaya, format, dan aturan iklan berubah: verifikasi ke ketentuan platform terbaru.

Laporan mingguan ads masuk ke dasbor e-commerce bersama komponen GMV ([[Analitik E-commerce - Rumus GMV]]).
`),

  K('TikTok Shop - Afiliasi & Video Belanja', { divisions: ['ecom', 'mkt', 'studio'], roles: ['tiktok', 'affiliate', 'creator', 'kol', 'commerce', 'content'] }, ['tiktok-shop', 'afiliasi', 'video', 'kreator'], `
# TikTok Shop - Afiliasi & Video Belanja

TikTok Shop menggabungkan konten dan belanja. Tiga mesin utamanya: video belanja (shoppable video), live, dan afiliasi kreator. Live dibahas di [[Playbook Live Commerce - Peran Host & Run of Show]].

## Program Afiliasi
- **Open collaboration**: komisi terbuka untuk semua kreator yang memenuhi syarat; cocok untuk menjaring banyak kreator mikro.
- **Targeted collaboration**: komisi khusus untuk kreator terpilih, bisa disertai sampel gratis.
- Besaran komisi dan aturan program: verifikasi ke ketentuan platform terbaru. Tetapkan komisi dari margin, bukan dari kebiasaan pasar.

## Seleksi Kreator
Nilai kreator dari: kecocokan audiens (usia, minat skincare), konsistensi konten, engagement nyata, rekam jejak penjualan produk sejenis, dan reputasi (tidak pernah membuat klaim berlebihan).
Tier kerja: nano/mikro (volume, sampel), menengah (kolaborasi berbayar + komisi), besar (kampanye peluncuran).

## Alur Kerja Afiliasi
1. Bangun daftar target kreator di tracker (nama, niche, follower, rata-rata views, GMV historis bila terlihat).
2. Kirim undangan kolaborasi dengan brief singkat.
3. Kirim sampel; catat nomor resi dan tanggal terima.
4. Follow-up H+5 setelah sampel diterima; tagih jadwal posting.
5. Pantau video: views, klik produk, pesanan, GMV.
6. Kreator berkinerja baik naik ke komisi khusus atau kontrak bulanan.

## Brief Kreator (template)
- Produk dan varian:
- Masalah kulit yang dibahas:
- Pesan kunci (maks 3) yang sudah sesuai [[Pedoman Klaim Kosmetik]]:
- Larangan: klaim medis, "menyembuhkan", "permanen", membandingkan merek lain secara merendahkan, before-after yang tidak asli.
- Wajib: tunjukkan tekstur, cara pakai, keranjang kuning/tautan produk.
- Periode posting dan kode/voucher bila ada.

## Struktur Video Belanja yang Konversi
1. **Hook 0-3 detik**: masalah ("Kulit kusam padahal udah tidur cukup?") atau visual tekstur.
2. **Masalah & konteks** singkat.
3. **Produk sebagai solusi**: bahan kunci dan cara kerja dengan bahasa aman.
4. **Bukti**: demo tekstur, rutinitas pemakaian, testimoni asli.
5. **CTA**: "Cek keranjang kuning, lagi ada voucher".
Durasi pendek, subtitle, pencahayaan natural.

## Konten Brand Sendiri
Unggah rutin dari akun resmi; uji beberapa hook untuk satu produk. Simpan pola hook pemenang di library konten tim studio.

## KPI
Views, CTR produk, CR, GMV per video, GMV afiliasi, jumlah kreator aktif, biaya sampel per pesanan. Hitung kontribusi ke GMV dengan [[Analitik E-commerce - Rumus GMV]].
`),

  K('Playbook Live Commerce - Peran Host & Run of Show', { divisions: ['ecom', 'studio', 'mkt'], roles: ['live', 'host', 'tiktok', 'shopee', 'commerce', 'streamer'] }, ['live-commerce', 'live', 'script', 'run-of-show'], `
# Playbook Live Commerce - Peran Host & Run of Show

Live commerce adalah toko yang buka dengan penjual yang bicara langsung. Kunci: konsistensi jadwal, host yang paham produk, dan tim belakang layar yang sigap.

## Peran Tim
| Peran | Tugas |
|---|---|
| Host utama | memandu, demo produk, menjawab pertanyaan, mendorong checkout |
| Co-host | membantu demo, membaca komentar, menjaga energi, menggantikan host |
| Operator/admin | pin produk, pasang voucher, atur flash sale dalam live, cek stok |
| Moderator chat | membalas komentar, menyaring spam, mencatat pertanyaan berulang |
| Produser | memegang run of show, waktu, target, dan keputusan cepat |
Live kecil bisa dirangkap 2 orang (host + operator), tapi fungsi tetap ada.

## Persiapan (H-1)
- Pilih 3-5 produk fokus, 1 produk hero, 1 penawaran khusus live.
- Siapkan kartu produk: benefit (bahasa aman, lihat [[Pedoman Klaim Kosmetik]]), bahan kunci, cara pakai, jenis kulit, harga normal vs harga live.
- Cek perangkat: kamera, cahaya, mikrofon, koneksi cadangan, properti (produk, kapas, cermin, tester).
- Siapkan voucher dan stok khusus live.

## Run of Show 60 Menit (contoh)
- **00-05**: pembuka, sapa penonton, umumkan promo yang akan datang, ajak follow.
- **05-15**: produk hero, demo tekstur, tunjukkan BPOM, pin produk.
- **15-20**: interaksi: tanya jenis kulit penonton, jawab komentar.
- **20-30**: produk kedua + bundling.
- **30-35**: flash deal dalam live (kuota terbatas, hitung mundur).
- **35-45**: produk ketiga atau rutinitas lengkap pagi/malam.
- **45-55**: rekap semua produk, Q&A.
- **55-60**: last call voucher, ajak follow, umumkan jadwal live berikutnya.
Ulangi ringkasan promo setiap 10-15 menit untuk penonton yang baru masuk.

## Script Inti
- Pembuka: "Halo kak, selamat datang di live Ray Beauty! Yang baru masuk, tap follow dulu ya, hari ini ada harga khusus live."
- Demo: "Lihat teksturnya ringan, cepat meresap. Cocok buat kulit berminyak dan kombinasi."
- Menjawab komentar: sebut nama akun, ulang pertanyaan, jawab singkat.
- Dorongan checkout: "Klik keranjang, pilih produk nomor 1, voucher live otomatis kepakai sampai kuota habis."
- Pertanyaan medis (jerawat parah, alergi): "Untuk kondisi itu sebaiknya konsultasi ke dokter dulu ya kak. Kalau mau, kita bisa sarankan rutinitas dasar yang lembut."

## Larangan
Klaim menyembuhkan, menjamin hasil dalam waktu tertentu, menjelekkan merek lain, harga palsu (harga coret tidak nyata), dan menjanjikan hal di luar kebijakan toko.

Evaluasi setiap sesi memakai [[KPI & Evaluasi Live Commerce]].
`),

  K('KPI & Evaluasi Live Commerce', { divisions: ['ecom', 'studio', 'data'], roles: ['live', 'host', 'tiktok', 'commerce', 'analyst'] }, ['live-commerce', 'kpi', 'evaluasi'], `
# KPI & Evaluasi Live Commerce

Setiap sesi live harus dievaluasi dengan data, bukan perasaan. Pelengkap dari [[Playbook Live Commerce - Peran Host & Run of Show]].

## KPI Utama
| KPI | Rumus / definisi | Makna |
|---|---|---|
| GMV live | total nilai pesanan dari sesi | hasil akhir |
| Penonton unik | jumlah akun yang menonton | jangkauan |
| Rata-rata durasi tonton | total waktu tonton / penonton | daya tarik host dan konten |
| Puncak penonton bersamaan | maksimum concurrent viewer | efek promo/traffic |
| Klik produk (CTR) | klik produk / penonton | daya tarik penawaran |
| Konversi | pesanan / penonton unik | efektivitas closing |
| AOV | GMV / pesanan | efektivitas bundling |
| GMV per jam | GMV / durasi | produktivitas sesi |
| Follower baru | follower bertambah selama live | aset jangka panjang |
| Engagement | komentar, like, share | interaksi |
Rumus dasar tetap: GMV = penonton × konversi × AOV (lihat [[Analitik E-commerce - Rumus GMV]]).

## Diagnosa
- **Penonton sedikit**: jadwal tidak konsisten, judul live kurang menarik, tidak ada pemanasan via video pendek, budget promosi live kurang.
- **Penonton banyak tapi cepat keluar**: pembukaan lambat, host kurang energi, visual/cahaya buruk.
- **Durasi tonton baik tapi klik rendah**: penawaran kurang jelas, produk tidak di-pin, CTA jarang.
- **Klik tinggi tapi konversi rendah**: harga dirasa mahal, voucher sulit dipakai, stok/varian habis, pertanyaan tidak terjawab.
- **AOV rendah**: kurang bundling dan rekomendasi rutinitas.

## Form Evaluasi Pasca-Live (isi maks H+1)
- Tanggal, jam, durasi, host, platform:
- Target vs realisasi GMV:
- 3 momen puncak (menit dan penyebab):
- 3 momen penurunan (menit dan penyebab):
- Pertanyaan pelanggan terbanyak (masukan untuk FAQ dan listing):
- Masalah teknis:
- Eksperimen berikutnya (satu variabel saja: jam, host, hook, penawaran):

## Ritme
- Mingguan: bandingkan sesi per slot jam dan per host; tetapkan jadwal pemenang.
- Bulanan: review biaya live (host, promo, voucher, ads live) vs margin kontribusi dari GMV live.

## Catatan Biaya
Biaya iklan live, komisi, dan biaya layanan platform memengaruhi profit; hitung dengan [[Matematika Harga - Margin Setelah Biaya Platform]] dan verifikasi ke ketentuan platform terbaru.

Definisi KPI baku disimpan di [[KPI Dictionary]] agar semua tim membaca angka yang sama.
`),

  K('Matematika Harga - Margin Setelah Biaya Platform', { divisions: ['ecom', 'fin', 'sales'], roles: ['pricing', 'marketplace', 'commerce', 'finance', 'distributor'] }, ['pricing', 'margin', 'biaya-platform', 'rumus'], `
# Matematika Harga - Margin Setelah Biaya Platform

Harga jual di marketplace bukan uang yang diterima. Setiap SKU wajib punya kalkulasi margin bersih per kanal sebelum dijual atau dipromosikan. Kebijakan harga umum ada di [[Pricing]].

## Komponen Biaya per Pesanan
- **HPP** (COGS): bahan baku, kemasan, tenaga kerja pabrik, overhead produksi (dari Finance/Manufaktur).
- **Biaya platform**: komisi/biaya administrasi, biaya layanan program (gratis ongkir, cashback), biaya transaksi/pembayaran. Besarannya berbeda per kategori dan program: verifikasi ke ketentuan platform terbaru.
- **Biaya promo**: diskon dan voucher yang ditanggung penjual.
- **Biaya fulfilment**: packing, bubble, kardus, insert, tenaga gudang.
- **Biaya akuisisi**: iklan, komisi afiliasi.
- **Pajak**: ikuti arahan Finance.

## Rumus
- Harga bersih setelah diskon = Harga jual × (1 − diskon %) − voucher nominal penjual.
- Biaya platform = Harga bersih × total persentase biaya platform (+ biaya tetap per pesanan bila ada).
- **Margin kontribusi** = Harga bersih − HPP − Biaya platform − Biaya fulfilment − Biaya akuisisi.
- Margin kontribusi % = Margin kontribusi / Harga bersih.

## Contoh (angka ilustratif, bukan tarif platform)
Harga jual Rp100.000, diskon 10%, voucher penjual Rp5.000 → harga bersih Rp85.000.
Misal total biaya platform 15% → Rp12.750. HPP Rp30.000, fulfilment Rp3.000, iklan per pesanan Rp10.000.
Margin kontribusi = 85.000 − 30.000 − 12.750 − 3.000 − 10.000 = Rp29.250 (34%).

## Menentukan Harga dari Target Margin
Harga bersih minimum = (HPP + biaya tetap per pesanan) / (1 − % biaya platform − % target margin − % biaya akuisisi).
Contoh: (30.000 + 3.000) / (1 − 0,15 − 0,30 − 0,10) = 33.000 / 0,45 ≈ Rp73.333.

## Aturan Kerja
1. Simpan kalkulator margin per SKU per kanal (Shopee, Tokopedia, TikTok Shop, website, reseller, distributor, modern trade).
2. Perbarui saat platform mengubah biaya atau HPP berubah.
3. Harga lantai (floor price) ditetapkan Finance; harga di bawah lantai butuh persetujuan ([[Kebijakan Persetujuan]]).
4. Jaga konsistensi harga antar-kanal agar tidak merusak reseller dan distributor ([[Strategi Omnichannel Ray Beauty]]).
5. Untuk promo bertingkat gunakan [[Matematika Promo - Stacking Diskon & Bundling]].

## Checklist Sebelum Menyetujui Harga
- [ ] HPP terbaru terkonfirmasi Finance.
- [ ] Biaya platform terbaru sudah dicek.
- [ ] Margin kontribusi di atas batas minimum.
- [ ] ROAS break-even dihitung untuk tim ads ([[Dasar Iklan Marketplace]]).
`),

  K('Matematika Promo - Stacking Diskon & Bundling', { divisions: ['ecom', 'fin', 'mkt', 'retail'], roles: ['pricing', 'promo', 'marketplace', 'commerce', 'campaign'] }, ['promo', 'diskon', 'bundling', 'rumus', 'pricing'], `
# Matematika Promo - Stacking Diskon & Bundling

Promo yang bertumpuk sering menghasilkan potongan efektif lebih besar dari perkiraan. Selalu hitung skenario terburuk sebelum promo tayang.

## Stacking Diskon
Diskon persen bertumpuk dihitung berurutan, bukan dijumlahkan.
- Diskon efektif dua lapis = 1 − (1 − d1) × (1 − d2).
- Contoh: diskon produk 20% + voucher toko 10% → 1 − 0,8 × 0,9 = 28% (bukan 30%).
- Bila ada voucher nominal: Harga akhir = Harga × (1 − d1) × (1 − d2) − voucher nominal.
- Pisahkan potongan yang **ditanggung penjual** dan yang **ditanggung platform**. Hanya potongan penjual yang mengurangi margin, tetapi biaya program platform dapat bertambah. Pembagian tanggungan: verifikasi ke ketentuan platform terbaru.

## Skenario Terburuk
Daftar semua potongan yang bisa dipakai bersamaan: diskon produk, flash sale, voucher toko, voucher follower, voucher live, koin/cashback penjual, bundling. Hitung harga bersih jika semua berlaku, lalu masukkan ke rumus margin di [[Matematika Harga - Margin Setelah Biaya Platform]]. Jika negatif dan bukan investasi yang disetujui, batasi kombinasi.

## Kenaikan Volume yang Dibutuhkan
Agar laba kotor tidak turun setelah diskon:
Kenaikan volume yang dibutuhkan = margin awal / (margin awal − diskon) − 1 (semua dalam % dari harga).
Contoh: margin 50%, diskon 20% → 0,5 / 0,3 − 1 = 67% tambahan volume.

## Bundling
Jenis:
- **Bundling rutinitas**: cleanser + serum + moisturizer (menaikkan AOV, edukatif).
- **Bundling ukuran**: beli 2 hemat.
- **Bundling hero + produk baru**: memperkenalkan SKU baru.
- **Gift with purchase**: hadiah ukuran travel di atas minimum belanja.
Rumus harga bundling: Harga bundling = Σ harga satuan × (1 − diskon bundling). Margin bundling = Harga bersih bundling − Σ HPP − biaya platform − fulfilment (biasanya fulfilment lebih efisien per item).

## Pola Promo Sehat
1. Gunakan threshold (minimum belanja) di atas AOV untuk mendorong keranjang lebih besar.
2. Prioritaskan bundling dibanding diskon langsung untuk SKU hero agar harga referensi terjaga.
3. Batasi durasi dan kuota.
4. Hindari diskon kedalaman tinggi terus-menerus; pelanggan belajar menunggu promo.
5. Promo kanal online harus dipertimbangkan dampaknya ke reseller, distributor, dan toko ([[Strategi Omnichannel Ray Beauty]]).

## Template Pengajuan Promo
- Tujuan (akuisisi/AOV/clear stock/peluncuran):
- SKU dan mekanisme:
- Harga bersih terburuk dan margin kontribusi:
- Estimasi volume dan biaya promo total:
- Periode dan kuota:
- Persetujuan sesuai [[Kebijakan Persetujuan]]:
`),

  K('Analitik E-commerce - Rumus GMV', { divisions: ['ecom', 'data', 'mkt'], roles: ['analyst', 'marketplace', 'commerce', 'growth', 'tiktok'] }, ['analitik', 'gmv', 'konversi', 'aov', 'kpi'], `
# Analitik E-commerce - Rumus GMV

Semua analisis penjualan online dimulai dari satu rumus:

**GMV = Traffic × Conversion Rate × AOV**

- **Traffic**: pengunjung unik ke toko/produk (atau penonton untuk live, views untuk video).
- **Conversion Rate (CR)** = pembeli (atau pesanan) / pengunjung.
- **AOV** (Average Order Value) = GMV / jumlah pesanan.
Definisi baku tiap metrik mengikuti [[KPI Dictionary]].

## Pohon Diagnosa
Jika GMV turun, cari komponen mana yang turun:
1. **Traffic turun** → pecah per sumber: pencarian organik, iklan, kampanye platform, afiliasi, live, eksternal (sosial, website). Cek ranking kata kunci, budget ads, partisipasi kampanye.
2. **CR turun** → cek harga vs kompetitor, stok/varian habis, ulasan negatif baru, perubahan foto/judul, voucher berakhir, performa chat.
3. **AOV turun** → cek bundling, threshold voucher, mix produk (lebih banyak SKU murah).

## Metrik Pendukung
- CTR listing = klik / impresi (kualitas foto utama dan judul).
- Add-to-cart rate dan checkout rate (titik bocor funnel).
- Tingkat pembatalan dan retur (GMV kotor vs bersih).
- Pembeli baru vs pembeli berulang, repeat purchase rate.
- Net revenue = GMV − pembatalan − retur − potongan penjual.
- Margin kontribusi per kanal (lihat [[Matematika Harga - Margin Setelah Biaya Platform]]).

## Contoh Perhitungan Target
Target GMV bulan depan Rp500 juta. AOV saat ini Rp150.000, CR 2%.
Pesanan dibutuhkan = 500.000.000 / 150.000 ≈ 3.334. Traffic dibutuhkan = 3.334 / 0,02 ≈ 166.700 pengunjung.
Alternatif: naikkan AOV ke Rp170.000 lewat bundling → pesanan ≈ 2.942, traffic ≈ 147.100. Rencana harus memilih tuas mana yang realistis.
(Angka di atas ilustrasi, bukan benchmark.)

## Laporan Mingguan (struktur)
1. Ringkasan: GMV, pesanan, AOV, CR, traffic vs minggu lalu dan vs target.
2. Per kanal: Shopee, Tokopedia, TikTok Shop, website.
3. Top 10 SKU dan SKU yang turun tajam.
4. Ads: biaya, ROAS ([[Dasar Iklan Marketplace]]).
5. Live dan afiliasi ([[KPI & Evaluasi Live Commerce]]).
6. Insight dan 3 aksi minggu depan dengan PIC.

## Prinsip
- Bandingkan periode setara (hari kampanye vs hari kampanye).
- Pisahkan efek kampanye dari tren dasar.
- Satu insight harus berujung pada satu aksi yang bisa diuji.
`),

  K('CS Marketplace - SLA Chat & Template Balasan', { divisions: ['cs', 'ecom'], roles: ['support', 'cs', 'customer service', 'marketplace', 'chat'] }, ['cs', 'chat', 'sla', 'template', 'marketplace'], `
# CS Marketplace - SLA Chat & Template Balasan

Chat adalah tempat keputusan beli terjadi. Kecepatan dan ketepatan balasan memengaruhi konversi dan metrik performa toko ([[Metrik Performa Toko Marketplace]]). Prosedur tiket umum ada di [[SOP CS - Penanganan Tiket]].

## SLA Internal
- Chat pra-pembelian dibalas secepat mungkin selama jam kerja; tetapkan target internal per menit dan pantau di dasbor.
- Di luar jam kerja: auto-reply dengan jam layanan dan link FAQ.
- Kasus komplain: balasan pertama segera, penyelesaian sesuai SLA tiket.
- Target waktu balas yang dihitung platform: verifikasi ke ketentuan platform terbaru.

## Prinsip Balasan
1. Sapa dengan nama pembeli, gunakan bahasa sopan dan hangat.
2. Jawab pertanyaan inti di kalimat pertama.
3. Tambahkan satu rekomendasi relevan (cross-sell) bila pertanyaan pra-pembelian.
4. Jangan membuat klaim medis atau menjamin hasil ([[Pedoman Klaim Kosmetik]]).
5. Jangan meminta transaksi di luar platform (melanggar aturan dan berisiko).
6. Tutup dengan pertanyaan lanjutan atau ucapan terima kasih.

## Template
**Rekomendasi produk**: "Halo Kak [nama], terima kasih sudah bertanya. Untuk kulit berminyak dengan pori besar, Kakak bisa coba [produk] karena teksturnya ringan dan mengandung [bahan]. Sebaiknya lakukan uji tempel dulu di belakang telinga atau lengan dalam selama 24 jam ya. Ada yang ingin ditanyakan lagi?"

**Status pesanan**: "Halo Kak [nama], pesanan Kakak sudah kami kirim dengan nomor resi [resi]. Kakak bisa memantau di menu pesanan. Kalau ada kendala pengiriman, kabari kami ya."

**Keterlambatan**: "Mohon maaf atas keterlambatannya, Kak. Kami sudah menghubungi pihak kurir dan akan mengabari perkembangan paling lambat [waktu]."

**Produk rusak/salah kirim**: "Mohon maaf atas ketidaknyamanannya, Kak. Boleh dibantu kirimkan foto produk, kemasan, dan label resi, serta video unboxing bila ada? Kami akan proses sesuai kebijakan retur."

**Keluhan iritasi**: "Kami turut prihatin, Kak. Mohon hentikan pemakaian produk dahulu dan bila keluhan berlanjut segera periksa ke tenaga medis. Boleh kami minta foto area kulit, foto produk beserta nomor batch, dan kronologinya? Tim kami akan menindaklanjuti." Lalu ikuti [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

**Keaslian produk**: "Produk di toko resmi ini dikirim langsung dari Ray Beauty. Nomor BPOM dapat dicek di kemasan dan situs resmi BPOM."

## Kontrol Kualitas
- Sampling 20 chat per agen per minggu: ketepatan, nada, kepatuhan klaim, upaya cross-sell.
- Pertanyaan berulang dikirim ke tim listing untuk ditambahkan ke deskripsi/FAQ.
- Ulasan dikelola sesuai [[Manajemen Ulasan & Retur Marketplace]].
`),

  K('Manajemen Ulasan & Retur Marketplace', { divisions: ['cs', 'ecom', 'qa'], roles: ['support', 'cs', 'marketplace', 'review', 'returns'] }, ['ulasan', 'retur', 'rating', 'cs', 'marketplace'], `
# Manajemen Ulasan & Retur Marketplace

Ulasan memengaruhi konversi dan rating toko; retur memengaruhi biaya dan metrik performa. Keduanya adalah sumber data kualitas produk.

## Mendorong Ulasan Positif
- Sertakan kartu terima kasih di paket dengan ajakan memberi ulasan jujur dan info cara pakai.
- Kirim pesan follow-up setelah pesanan diterima (dalam batas aturan platform).
- Jangan menawarkan imbalan untuk ulasan bintang 5 atau meminta ulasan palsu; dilarang platform.

## Membalas Ulasan
Balas semua ulasan bintang 1-3 dalam 1 hari kerja, dan sebagian ulasan positif untuk membangun hubungan.
- **Positif**: "Terima kasih Kak [nama]! Senang [produk] cocok di kulit Kakak. Jangan lupa pakai sunscreen di pagi hari ya."
- **Negatif - produk**: "Mohon maaf pengalamannya belum sesuai harapan, Kak. Kami ingin membantu, mohon hubungi kami lewat chat toko agar bisa kami cek lebih lanjut."
- **Negatif - pengiriman**: akui, jelaskan langkah perbaikan, tanpa menyalahkan pembeli.
Jangan membuka data pribadi pembeli, jangan berdebat, jangan klaim medis di balasan publik.

## Klasifikasi Akar Masalah
Tag setiap ulasan negatif: produk (tekstur, aroma, hasil, reaksi kulit), kemasan (bocor, rusak), pengiriman, salah kirim, ekspektasi (deskripsi kurang jelas), harga. Rekap mingguan ke E-commerce, QA, dan R&D.

## Alur Retur/Komplain
1. Terima pengajuan, minta bukti: foto/video produk, kemasan, label resi, nomor batch.
2. Klasifikasi: rusak saat kirim, salah kirim, cacat produk, tidak sesuai deskripsi, reaksi kulit, berubah pikiran.
3. Putuskan solusi sesuai kebijakan toko dan aturan platform (verifikasi ke ketentuan platform terbaru): kirim ulang, pengembalian dana, atau penolakan dengan alasan jelas.
4. Kasus reaksi kulit **selalu** masuk alur [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]], bukan sekadar retur.
5. Cacat produk atau keluhan berulang pada batch yang sama: eskalasi ke QA ([[Eskalasi & Penanganan Keluhan Pelanggan]]).
6. Catat di sistem tiket ([[SOP CS - Penanganan Tiket]]).

## Pencegahan
- Packing standar untuk produk cair/kaca (bubble, segel, kardus kokoh).
- Double check SKU saat packing; foto/video packing untuk bukti.
- Deskripsi jelas tentang ukuran, tekstur, dan aroma untuk mengurangi retur "tidak sesuai ekspektasi".

## KPI
Rating rata-rata produk dan toko, persentase ulasan negatif, tingkat retur per SKU, waktu penyelesaian komplain, persentase komplain yang dimenangkan penjual secara adil.
`),

  K('Website D2C Ray Beauty', { divisions: ['ecom', 'mkt', 'eng'], roles: ['d2c', 'website', 'commerce', 'growth', 'crm'] }, ['d2c', 'website', 'crm', 'retensi'], `
# Website D2C Ray Beauty

Website resmi (D2C) adalah kanal milik sendiri: data pelanggan, pengalaman merek, dan margin lebih terkendali dibanding marketplace. Perannya bukan menyaingi marketplace, melainkan membangun hubungan langsung dan retensi.

## Fungsi Utama
1. Sumber informasi resmi produk, bahan, BPOM, dan cara pakai.
2. Kanal penjualan dengan program loyalitas dan produk/bundling eksklusif.
3. Pengumpulan data first-party (dengan persetujuan) untuk CRM dan clienteling.
4. Landing page untuk iklan, KOL, dan kampanye.

## Elemen Wajib
- Navigasi berdasarkan masalah kulit dan jenis produk.
- Halaman produk: foto, benefit (sesuai [[Pedoman Klaim Kosmetik]]), bahan kunci, INCI lengkap, BPOM, cara pakai, cocok untuk, ulasan terverifikasi, FAQ.
- Kuis jenis kulit atau "rutinitas untukmu" yang mengarah ke bundling (mengacu [[Konsultasi Beauty Advisor - Jenis Kulit & Rutinitas]]).
- Checkout singkat, opsi pembayaran lokal, estimasi ongkir di awal.
- Kebijakan privasi, retur, dan pengiriman yang jelas.
- Tombol chat/WhatsApp CS dan store locator untuk toko fisik.

## Funnel & Metrik
GMV website = sesi × CR × AOV ([[Analitik E-commerce - Rumus GMV]]). Pantau juga: bounce rate halaman produk, add-to-cart rate, abandoned checkout, repeat purchase rate, CAC per kanal, dan LTV.

## Program Retensi
- Email/WhatsApp selamat datang dengan panduan rutinitas.
- Pengingat isi ulang berdasarkan perkiraan masa habis produk (ukuran dan frekuensi pakai).
- Pengingat keranjang tertinggal.
- Poin loyalitas lintas kanal bila sistem mendukung ([[Strategi Omnichannel Ray Beauty]]).
- Segmentasi: pembeli baru, berulang, VIP, tidak aktif.
Semua komunikasi pemasaran hanya ke pelanggan yang memberi persetujuan dan dapat berhenti berlangganan.

## Harga
Harga website mengikuti kebijakan harga lintas kanal; hindari selalu lebih murah dari reseller resmi. Biaya payment gateway dan ongkir masuk ke kalkulasi margin ([[Matematika Harga - Margin Setelah Biaya Platform]]).

## Checklist Bulanan
- [ ] Cek kecepatan halaman di ponsel dan uji checkout end-to-end.
- [ ] Sinkronisasi stok dengan gudang.
- [ ] Review 5 halaman produk dengan konversi terendah.
- [ ] Review alur email/WhatsApp otomatis dan tingkat buka/klik.
- [ ] Pastikan klaim dan materi terbaru sudah disetujui Regulatory.
`),

  K('Prospecting RayFlow untuk UMKM', { divisions: ['sales', 'bizdev'], roles: ['sales', 'sdr', 'bdr', 'account', 'prospecting', 'rayflow'] }, ['rayflow', 'b2b', 'prospecting', 'icp', 'outbound'], `
# Prospecting RayFlow untuk UMKM

Prospecting mengisi pipeline RayFlow dengan calon pelanggan yang tepat. Rujukan profil: [[Ideal Customer Profile]] dan [[Persona Pelanggan UMKM]]; detail produk: [[Produk & Layanan]].

## Ringkasan ICP Operasional
- UMKM dengan proses berulang yang masih manual: pesanan via WhatsApp, rekap Excel, invoice manual, follow-up pelanggan, stok.
- Ada pemilik/manajer yang merasakan sakitnya (waktu habis, salah input, pesanan terlewat).
- Sudah memakai alat digital dasar (WhatsApp Business, spreadsheet, marketplace).
- Mampu mengalokasikan anggaran langganan bulanan.
Diskualifikasi dini: tidak ada proses berulang, tidak ada pengambil keputusan yang bisa diakses, atau kebutuhan di luar cakupan produk.

## Sumber Prospek
1. Inbound: formulir website, webinar, konten edukasi. Prioritas tertinggi; hubungi secepatnya.
2. Referral pelanggan aktif (minta setelah pelanggan mencapai hasil pertama).
3. Komunitas UMKM, asosiasi, inkubator, event.
4. Partner: konsultan, agensi, penyedia POS/akuntansi.
5. Outbound: daftar bisnis per vertikal (F&B, distributor, toko online, jasa).

## Cadence Outbound (contoh 14 hari)
- Hari 1: WhatsApp/email personal + LinkedIn (bila relevan).
- Hari 3: telepon; bila tidak diangkat, pesan singkat.
- Hari 5: kirim contoh kasus serupa (1 paragraf, tanpa angka yang tidak bisa dibuktikan).
- Hari 8: telepon kedua.
- Hari 11: tawarkan demo 20 menit atau template alur kerja gratis.
- Hari 14: pesan penutup ("break-up message").

## Template Pesan Pembuka
"Halo Pak/Bu [nama], saya [nama] dari RayFlow. Saya lihat [bisnis] menerima pesanan lewat WhatsApp dan marketplace. Banyak pemilik usaha serupa kewalahan merekap pesanan dan follow-up pelanggan secara manual. RayFlow membantu mengotomatiskan alur itu. Boleh saya minta 15 menit minggu ini untuk memahami proses di [bisnis]?"

## Riset Sebelum Kontak (5 menit)
Jenis usaha, kanal penjualan, skala (jumlah cabang/karyawan dari sumber publik), pemicu (buka cabang, rekrut admin, keluhan pelanggan), siapa pemilik.

## Kualifikasi & Serah Terima
Gunakan [[SOP Sales - Kualifikasi Lead]]. Lead yang lolos dijadwalkan discovery ([[Discovery Call RayFlow - SPIN & MEDDICC]]) dan dicatat di CRM sesuai [[Kebersihan Data CRM]].

## KPI SDR
Jumlah aktivitas, tingkat respons, meeting terjadwal, meeting terlaksana, persentase lead lolos kualifikasi, dan pipeline yang dihasilkan.
`),

  K('Discovery Call RayFlow - SPIN & MEDDICC', { divisions: ['sales', 'bizdev'], roles: ['sales', 'account', 'ae', 'discovery', 'rayflow'] }, ['rayflow', 'discovery', 'spin', 'meddicc', 'b2b'], `
# Discovery Call RayFlow - SPIN & MEDDICC

Discovery menentukan apakah deal layak dikejar dan bahan apa yang dibutuhkan untuk demo dan proposal. Aturan: sales bicara maksimal sepertiga waktu.

## Struktur 30 Menit
1. **Pembuka (3 menit)**: terima kasih, tujuan panggilan, agenda, konfirmasi waktu. "Di akhir, kita putuskan bersama apakah demo relevan."
2. **Konteks bisnis (5 menit)**: usaha, kanal, tim, target tahun ini.
3. **SPIN (15 menit)**.
4. **Kualifikasi MEDDICC (5 menit)**.
5. **Langkah berikutnya (2 menit)**: jadwal demo dengan peserta yang tepat.

## SPIN
- **Situation**: "Bagaimana alur pesanan dari masuk sampai dikirim hari ini?" "Alat apa yang dipakai tim?"
- **Problem**: "Di bagian mana paling sering terjadi salah atau terlambat?" "Berapa lama admin merekap pesanan per hari?"
- **Implication**: "Kalau pesanan terlewat, apa dampaknya ke pelanggan dan omzet?" "Apa yang terjadi saat volume naik di musim ramai?"
- **Need-payoff**: "Kalau rekap dan follow-up berjalan otomatis, waktu tim bisa dipakai untuk apa?" "Apa artinya bagi rencana buka cabang?"
Minta prospek mengkuantifikasi sendiri (jam per minggu, jumlah pesanan terlewat); jangan mengarang angka.

## MEDDICC (versi UMKM)
| Elemen | Pertanyaan | Catat di CRM |
|---|---|---|
| Metrics | Hasil terukur apa yang ingin dicapai? | metrik + baseline |
| Economic buyer | Siapa yang memutuskan anggaran? | nama, peran |
| Decision criteria | Apa yang dinilai saat memilih solusi? | daftar kriteria |
| Decision process | Langkah dan waktu sampai keputusan? | tanggal target |
| Identify pain | Masalah utama dan biayanya | pain + dampak |
| Champion | Siapa internal yang paling diuntungkan dan mau mendorong? | nama |
| Competition | Alternatif lain? (termasuk "tetap manual") | pesaing |
Di UMKM, economic buyer sering adalah pemilik; pastikan ia hadir di demo.

## Tanda Bahaya
Tidak ada pain yang dirasakan, pemilik tidak terlibat, "nanti saja tahun depan" tanpa pemicu, kebutuhan di luar cakupan [[Produk & Layanan]].

## Ringkasan Pasca-Call (kirim ke prospek hari yang sama)
"Terima kasih, Pak/Bu [nama]. Yang saya tangkap: (1) [masalah], (2) [dampak], (3) [tujuan]. Kita sepakat demo pada [tanggal] bersama [peserta], fokus ke [alur]. Mohon koreksi bila ada yang kurang tepat."

Lanjutkan ke [[Demo Produk RayFlow]] dan perbarui stage di CRM ([[Pipeline Management & Forecasting Sales]]).
`),

  K('Demo Produk RayFlow', { divisions: ['sales', 'cs'], roles: ['sales', 'account', 'ae', 'presales', 'solution', 'rayflow'] }, ['rayflow', 'demo', 'presales', 'b2b'], `
# Demo Produk RayFlow

Demo bukan tur fitur. Demo adalah bukti bahwa RayFlow menyelesaikan masalah yang ditemukan saat [[Discovery Call RayFlow - SPIN & MEDDICC]].

## Persiapan (H-1)
- Baca catatan discovery: 2-3 pain utama, metrik, peserta, kriteria keputusan.
- Siapkan akun demo dengan data contoh yang mirip bisnis prospek (nama produk, alur pesanan, template pesan dalam bahasa mereka).
- Bangun satu alur end-to-end yang meniru proses prospek, mis. pesanan WhatsApp → tercatat otomatis → notifikasi gudang → invoice → follow-up pelanggan.
- Uji koneksi, layar, dan rencana cadangan (rekaman/screenshot) bila internet bermasalah.
- Konfirmasi peserta, terutama pengambil keputusan.

## Struktur 30-45 Menit
1. **Rekap (3 menit)**: "Minggu lalu Bapak menyampaikan... Apakah masih sama? Ada yang berubah?"
2. **Gambaran sebelum-sesudah (2 menit)**: alur manual saat ini vs alur dengan RayFlow.
3. **Demo alur pain #1 (10 menit)**: tunjukkan hasil dulu, lalu cara membuatnya.
4. **Demo alur pain #2 (8 menit)**.
5. **Hal yang dikhawatirkan (5 menit)**: kemudahan pakai, implementasi, keamanan data, dukungan.
6. **Diskusi dan pertanyaan (5-10 menit)**.
7. **Langkah berikutnya (3 menit)**.

## Teknik
- **Tell-Show-Tell**: jelaskan apa yang akan dilihat, tunjukkan, lalu kaitkan ke pain ("Ini berarti admin tidak perlu lagi merekap manual tiap malam").
- Cek pemahaman setiap 5-7 menit: "Apakah ini sesuai dengan cara tim Ibu bekerja?"
- Biarkan prospek mencoba klik sendiri bila memungkinkan.
- Simpan fitur yang tidak relevan; terlalu banyak fitur membingungkan UMKM.
- Jangan menjanjikan fitur yang belum ada; catat sebagai permintaan dan konfirmasi ke tim produk.

## Menutup Demo
- "Dari yang tadi dilihat, bagian mana yang paling bermanfaat?"
- "Apa yang perlu terjadi agar Bapak siap mulai?"
- Tawarkan opsi: uji coba terstruktur dengan kriteria sukses jelas, atau proposal ([[Proposal, Negosiasi & Closing RayFlow]]).

## Pasca-Demo (hari yang sama)
- Kirim ringkasan, rekaman (bila diizinkan), dan materi pendukung.
- Perbarui CRM: stage, tanggal keputusan, peserta, keberatan yang muncul ([[Penanganan Keberatan Sales RayFlow]]).
- Jadwalkan langkah berikutnya dengan tanggal pasti, bukan "nanti dikabari".

## Checklist Kualitas Demo
- [ ] Setiap bagian demo terkait pain yang disebut prospek.
- [ ] Pengambil keputusan hadir atau sudah dijadwalkan.
- [ ] Langkah berikutnya disepakati dengan tanggal.
`),

  K('Proposal, Negosiasi & Closing RayFlow', { divisions: ['sales', 'fin'], roles: ['sales', 'account', 'ae', 'closing', 'rayflow', 'pricing'] }, ['rayflow', 'proposal', 'negosiasi', 'closing', 'b2b'], `
# Proposal, Negosiasi & Closing RayFlow

Proposal merangkum masalah, solusi, nilai, dan investasi. Kirim proposal hanya setelah pain, pengambil keputusan, dan proses keputusan jelas.

## Struktur Proposal (maks 5 halaman)
1. **Ringkasan eksekutif**: situasi, masalah, solusi, hasil yang diharapkan (3-5 kalimat).
2. **Masalah saat ini**: kutip bahasa prospek dan angka yang mereka berikan sendiri.
3. **Solusi**: alur kerja RayFlow yang akan diterapkan, ruang lingkup, yang tidak termasuk.
4. **Rencana implementasi**: tahapan, durasi, peran pelanggan, merujuk [[Playbook Onboarding Pelanggan]].
5. **Investasi**: paket dan harga sesuai [[Pricing]]; opsi (mis. bulanan vs tahunan).
6. **Ukuran keberhasilan**: metrik dan kapan ditinjau.
7. **Langkah berikutnya**: tanda tangan, pembayaran, kickoff.

## Persiapan Negosiasi
- Tentukan **target**, **batas bawah** (walk-away), dan **daftar konsesi** sebelum bertemu.
- Diskon dan syarat khusus mengikuti batas wewenang di [[Kebijakan Persetujuan]].
- Ketahui alternatif prospek (tetap manual, pesaing) dan alternatif kita (deal lain di pipeline).

## Prinsip Negosiasi
1. **Jangan memberi tanpa menerima**: setiap konsesi ditukar (diskon ↔ kontrak tahunan, pembayaran di muka, studi kasus, referral).
2. **Negosiasikan nilai sebelum harga**: kembali ke dampak masalah yang disepakati.
3. **Konsesi mengecil**: setiap konsesi berikutnya lebih kecil dan lebih lambat.
4. **Diam itu alat**: setelah menyebut angka, tunggu respons.
5. **Tulis semua kesepakatan** dalam ringkasan tertulis.
Variabel selain harga: durasi kontrak, termin pembayaran, cakupan onboarding, jumlah pengguna, tanggal mulai, pelatihan tambahan.

## Teknik Closing
- **Mutual action plan**: daftar langkah bersama dengan tanggal (review proposal, persetujuan internal, tanda tangan, kickoff).
- **Closing asumtif**: "Kalau kickoff tanggal 10, siapa dari tim Ibu yang akan jadi PIC?"
- **Closing ringkasan**: rangkum masalah, solusi, nilai, lalu minta keputusan.
- **Pertanyaan pembuka hambatan**: "Apa yang masih membuat Bapak ragu untuk mulai bulan ini?"
Hindari tekanan palsu (diskon "hari ini saja" yang tidak nyata).

## Setelah Deal
1. Konfirmasi tertulis, kontrak/order form, invoice.
2. Update CRM ke closed-won dengan alasan menang.
3. Serah terima ke Customer Success: pain, metrik, champion, janji yang dibuat saat penjualan.
4. Deal kalah: catat alasan kalah secara jujur untuk analisis ([[Pipeline Management & Forecasting Sales]]).
`),

  K('Penanganan Keberatan Sales RayFlow', { divisions: ['sales', 'bizdev'], roles: ['sales', 'account', 'ae', 'sdr', 'rayflow'] }, ['rayflow', 'keberatan', 'objection', 'script', 'b2b'], `
# Penanganan Keberatan Sales RayFlow

Keberatan adalah sinyal minat atau kebutuhan informasi, bukan penolakan final. Gunakan kerangka **LAER**: Listen, Acknowledge, Explore, Respond.

## Kerangka
1. **Dengarkan** sampai selesai, jangan memotong.
2. **Akui**: "Wajar Bapak mempertimbangkan itu."
3. **Gali**: "Boleh saya tahu lebih jauh, dibanding apa terasa mahal?"
4. **Tanggapi** dengan bukti yang relevan, lalu cek: "Apakah itu menjawab kekhawatiran Bapak?"

## Keberatan Umum & Respons
**"Mahal."**
Gali: dibanding apa? anggaran atau nilai? Respons: kembali ke biaya masalah yang prospek hitung sendiri saat discovery (jam admin, pesanan terlewat). Tawarkan paket lebih kecil atau mulai dari satu alur, bukan langsung diskon. Diskon mengikuti [[Kebijakan Persetujuan]].

**"Kami sudah pakai Excel/WhatsApp, cukup."**
"Betul, banyak usaha memulai dari sana. Apa yang terjadi saat pesanan dua kali lipat di musim ramai?" Tunjukkan bahwa RayFlow bisa bekerja berdampingan dengan alat yang sudah dipakai sesuai [[Produk & Layanan]].

**"Tim saya tidak gaptek / sulit belajar."**
Jelaskan pendampingan onboarding ([[Playbook Onboarding Pelanggan]]), template siap pakai, dan tawarkan uji coba dengan satu pengguna kunci.

**"Nanti dulu, belum waktunya."**
"Apa yang perlu terjadi supaya waktunya tepat?" Cari pemicu (musim ramai, cabang baru). Bila memang belum, jadwalkan follow-up bertanggal dan kirim konten edukasi.

**"Saya harus diskusi dengan partner/pemilik."**
"Tentu. Apa yang biasanya beliau tanyakan? Bagaimana kalau kita jadwalkan 20 menit bersama beliau, supaya saya bisa jawab langsung?"

**"Data kami aman tidak?"**
Jelaskan praktik keamanan yang benar-benar diterapkan (dari dokumen resmi tim IT/Legal). Jangan mengarang sertifikasi.

**"Pesaing lebih murah."**
"Boleh saya tahu apa yang ditawarkan? Mari bandingkan berdasarkan kriteria yang tadi Bapak sebut penting." Jangan menjelekkan pesaing.

**"Kirim proposal saja dulu."**
"Tentu. Supaya proposalnya tepat, boleh 10 menit untuk memastikan kebutuhan dan siapa yang akan memutuskan?"

## Aturan
- Catat setiap keberatan di CRM; rekap bulanan untuk masukan tim produk dan pemasaran.
- Jangan menjanjikan fitur, harga, atau jangka waktu di luar kewenangan.
- Keberatan yang sama muncul berulang di tahap akhir berarti discovery kurang dalam; perbaiki di [[Discovery Call RayFlow - SPIN & MEDDICC]].
`),

  K('Pipeline Management & Forecasting Sales', { divisions: ['sales', 'exec', 'data'], roles: ['sales', 'account', 'ae', 'manager', 'forecast', 'crm', 'distributor'] }, ['pipeline', 'forecast', 'crm', 'b2b', 'rayflow'], `
# Pipeline Management & Forecasting Sales

Pipeline yang sehat membuat target bisa diprediksi. Berlaku untuk RayFlow (SaaS) dan dapat diadaptasi untuk deal B2B Ray Beauty (distributor, modern trade).

## Stage Pipeline RayFlow (contoh definisi keluar)
| Stage | Kriteria keluar (bukti) |
|---|---|
| Lead terkualifikasi | lolos [[SOP Sales - Kualifikasi Lead]] |
| Discovery | pain, pengambil keputusan, dan timeline terdokumentasi |
| Demo | demo selesai dengan pengambil keputusan, langkah berikutnya bertanggal |
| Proposal | proposal terkirim dan dibahas |
| Negosiasi | syarat utama disepakati, menunggu tanda tangan |
| Closed won / lost | dokumen ditandatangani / alasan kalah tercatat |
Deal naik stage berdasarkan **bukti**, bukan perasaan sales.

## Kesehatan Pipeline
- **Coverage** = nilai pipeline tertimbang / target sisa periode. Tetapkan rasio minimum internal berdasarkan win rate historis.
- **Win rate** = deal menang / deal yang ditutup (menang + kalah).
- **Siklus penjualan** = rata-rata hari dari lead terkualifikasi sampai closed won.
- **Velocity** = (jumlah deal × nilai rata-rata × win rate) / siklus penjualan.
- **Deal macet**: tidak ada aktivitas atau perubahan stage lebih lama dari batas internal.

## Metode Forecast
1. **Kategori komitmen** (disarankan): setiap deal diberi label Commit (sangat yakin, bukti kuat), Best case (mungkin), Pipeline (belum pasti). Forecast = Commit + sebagian Best case berdasarkan judgement manajer.
2. **Tertimbang stage**: nilai deal × probabilitas stage. Probabilitas diambil dari data historis sendiri, bukan angka umum.
3. Bandingkan kedua metode; selisih besar berarti data perlu dicek.

## Rapat Pipeline Mingguan (30-45 menit)
- Review deal yang berubah stage, deal Commit, dan deal macet.
- Pertanyaan per deal: apa langkah berikutnya dan tanggalnya? siapa pengambil keputusan? apa yang bisa menggagalkan?
- Bersihkan: deal tanpa langkah berikutnya diperbarui atau ditutup sebagai lost.

## Checklist Akhir Bulan
- [ ] Tanggal close realistis dan tidak lewat.
- [ ] Nilai deal sesuai proposal terbaru.
- [ ] Alasan kalah terisi untuk semua deal lost.
- [ ] Forecast dikirim ke manajemen dengan risiko dan peluang utama.

Akurasi forecast bergantung pada data; terapkan [[Kebersihan Data CRM]]. Definisi metrik mengikuti [[KPI Dictionary]].
`),

  K('Kebersihan Data CRM', { divisions: ['sales', 'cs', 'bizdev', 'data'], roles: ['crm', 'sales', 'account', 'support', 'distributor', 'reseller'] }, ['crm', 'data', 'hygiene', 'proses'], `
# Kebersihan Data CRM

CRM adalah satu sumber kebenaran tentang pelanggan dan deal. Data kotor merusak forecast, kampanye, dan pengalaman pelanggan.

## Aturan Dasar
1. **Jika tidak di CRM, berarti tidak terjadi.** Setiap panggilan, meeting, dan janji dicatat di hari yang sama.
2. **Satu entitas, satu record.** Cari dulu sebelum membuat kontak/akun baru.
3. **Field wajib diisi** sebelum deal bisa pindah stage.
4. **Langkah berikutnya selalu bertanggal** untuk setiap deal terbuka.
5. Hanya simpan data yang dibutuhkan dan diizinkan; patuhi ketentuan perlindungan data pribadi dan kebijakan internal Legal.

## Standar Field
| Objek | Field wajib |
|---|---|
| Akun | nama legal, nama dagang, industri/vertikal, kota, segmen, sumber, pemilik akun |
| Kontak | nama, jabatan, peran dalam keputusan, nomor/email dengan status persetujuan |
| Deal | nilai, produk/paket, stage, tanggal close, langkah berikutnya + tanggal, pesaing, pain utama |
| Lost | alasan kalah (pilihan baku) + catatan |
Untuk Ray Beauty B2B tambahkan: tipe mitra (reseller, distributor, modern trade, key account), wilayah, tier, target bulanan.

## Konvensi Penulisan
- Nama perusahaan sesuai dokumen legal; nama dagang di field terpisah.
- Nomor telepon format internasional (+62...).
- Kota dari daftar baku, bukan ketik bebas.
- Catatan meeting format ringkas: konteks, temuan, keputusan, langkah berikutnya.

## Rutinitas
- **Harian (pemilik akun)**: log aktivitas, update langkah berikutnya.
- **Mingguan (manajer)**: laporan deal tanpa aktivitas, tanggal close lewat, field kosong.
- **Bulanan (ops/data)**: deduplikasi, normalisasi kota/industri, arsipkan kontak tidak valid.
- **Kuartalan**: audit sampel record dan review kebutuhan field (hapus yang tidak dipakai).

## Serah Terima Antar-Tim
- Sales → CS: catatan pain, metrik keberhasilan, champion, janji penjualan dicatat di akun sebelum kickoff.
- CS → Sales: sinyal upsell atau risiko churn dicatat sebagai aktivitas dan ditugaskan ke pemilik akun.

## Metrik Kualitas Data
Persentase field wajib terisi, jumlah duplikat, persentase deal terbuka dengan langkah berikutnya bertanggal, persentase deal lost dengan alasan. Gunakan untuk [[Pipeline Management & Forecasting Sales]] dan health score ([[Customer Success RayFlow - Health Score & Pencegahan Churn]]).
`),

  K('Manajemen Reseller Ray Beauty', { divisions: ['sales', 'bizdev', 'ecom'], roles: ['reseller', 'partner', 'sales', 'account', 'channel'] }, ['reseller', 'ray-beauty', 'kemitraan', 'channel'], `
# Manajemen Reseller Ray Beauty

Reseller memperluas jangkauan Ray Beauty ke komunitas dan daerah. Program yang sehat menjaga harga, keaslian produk, dan motivasi mitra.

## Struktur Program
- **Tier** berdasarkan volume pembelian (mis. Reseller, Agen). Diskon dan syarat per tier ditetapkan Sales bersama Finance dan disetujui sesuai [[Kebijakan Persetujuan]].
- **Syarat bergabung**: identitas, alamat, kanal jualan (offline, media sosial, marketplace), pembelian awal minimum, persetujuan kode etik.
- **Kode etik**: tidak menjual di bawah harga eceran minimum yang ditetapkan, tidak membuat klaim di luar [[Pedoman Klaim Kosmetik]], tidak mengubah kemasan atau menjual produk kedaluwarsa, memakai materi resmi.

## Onboarding Reseller Baru
1. Verifikasi data dan kanal jualan.
2. Kirim welcome kit: katalog, daftar harga, materi foto/video resmi, panduan produk ([[Produk Ray Beauty]]), FAQ jenis kulit.
3. Masukkan ke grup komunikasi mitra.
4. Pelatihan produk dasar (bahan, jenis kulit, cara pakai, klaim yang boleh).
5. Tetapkan target 90 hari pertama dan jadwal check-in.

## Pengelolaan Harga
- Terapkan kebijakan harga eceran minimum untuk kanal online; pantau marketplace secara rutin.
- Pelanggaran: peringatan tertulis → penangguhan diskon tier → pemutusan kemitraan, sesuai kontrak.
- Promo pusat diinformasikan ke reseller lebih dulu agar mereka tidak dirugikan ([[Strategi Omnichannel Ray Beauty]]).

## Dukungan Penjualan
- Konten mingguan siap unggah (caption sesuai klaim yang disetujui).
- Bundling dan promo khusus reseller pada momen tertentu ([[Kalender Kampanye E-commerce]]).
- Leaderboard dan insentif berbasis pertumbuhan, bukan hanya volume absolut.
- Kanal tanya-jawab cepat untuk pertanyaan produk dan keluhan pelanggan akhir.

## Keluhan dari Pelanggan Reseller
Reseller wajib meneruskan keluhan reaksi kulit ke Ray Beauty dengan data lengkap (foto, nomor batch, kronologi). Tangani lewat [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

## KPI Program
Jumlah reseller aktif (bertransaksi dalam periode), tingkat aktivasi reseller baru, rata-rata pembelian per reseller, frekuensi order ulang, pelanggaran harga, churn reseller.

## Review Bulanan per Reseller
- Pembelian vs target, mix produk, stok di tangan (tanya).
- Hambatan penjualan dan kebutuhan materi.
- Rencana bulan depan.
Catat di CRM sesuai [[Kebersihan Data CRM]].
`),

  K('Manajemen Distributor Ray Beauty', { divisions: ['sales', 'bizdev', 'scm'], roles: ['distributor', 'sales', 'account', 'channel', 'trade', 'key account'] }, ['distributor', 'ray-beauty', 'b2b', 'sell-out'], `
# Manajemen Distributor Ray Beauty

Distributor membawa Ray Beauty ke toko kosmetik, apotek, dan ritel daerah. Fokus pengelolaan: cakupan wilayah, sell-in vs sell-out, stok sehat, dan disiplin harga.

## Seleksi Distributor
Nilai calon distributor dari: cakupan outlet dan wilayah, armada dan gudang (kondisi penyimpanan kosmetik: kering, sejuk, terhindar sinar matahari langsung), kemampuan finansial dan riwayat pembayaran, portofolio merek (hindari konflik langsung), tim salesman, dan sistem pelaporan.

## Kontrak & Syarat Utama
Wilayah/eksklusivitas, target, harga beli dan margin, termin pembayaran dan plafon kredit, kebijakan retur (rusak, kedaluwarsa), dukungan promosi, kewajiban laporan, ketentuan pemutusan. Kontrak disusun dan ditinjau Legal; syarat di luar standar mengikuti [[Kebijakan Persetujuan]].

## Joint Business Plan (JBP) Tahunan
1. Target sell-in dan sell-out per kuartal.
2. Target outlet aktif dan distribusi numerik (jumlah outlet yang menjual).
3. SKU wajib per tipe outlet (must-stock list).
4. Program promo dan aktivasi.
5. Dukungan Ray Beauty: pelatihan, materi POSM, beauty advisor di outlet kunci.

## Metrik Kunci
- **Sell-in**: penjualan Ray Beauty ke distributor.
- **Sell-out**: penjualan distributor ke outlet/konsumen.
- **Days of inventory** = stok di distributor / rata-rata sell-out harian. Stok terlalu tinggi menandakan risiko retur dan kedaluwarsa.
- **Outlet aktif**, **distribusi numerik**, **rata-rata order per outlet**.
- **Umur piutang** dan ketepatan bayar (bersama Finance).
Fokus pada sell-out: sell-in tinggi tanpa sell-out hanya memindahkan stok.

## Ritme Kerja
- **Mingguan**: laporan sell-out dan stok dari distributor, pesanan berikutnya.
- **Bulanan**: review bisnis (pencapaian, stok per SKU, produk mendekati kedaluwarsa, program promo).
- **Kuartalan**: QBR dengan pemilik distributor, evaluasi JBP.

## Manajemen Stok & Kedaluwarsa
- Terapkan FEFO (first expired, first out).
- Laporan stok per batch dan tanggal kedaluwarsa.
- Program penjualan untuk stok mendekati kedaluwarsa sesuai kebijakan; produk kedaluwarsa tidak boleh dijual.
- Koordinasi perencanaan produksi dengan SCM dan Manufaktur berdasarkan forecast sell-out.

## Keluhan Mutu
Keluhan dari outlet (kemasan bocor, perubahan warna/aroma, reaksi kulit) dilaporkan dengan nomor batch ke QA; ikuti [[Eskalasi & Penanganan Keluhan Pelanggan]] dan untuk reaksi kulit [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

Pipeline distributor baru dikelola dengan [[Pipeline Management & Forecasting Sales]].
`),

  K('Key Account & Listing Modern Trade', { divisions: ['sales', 'bizdev', 'retail'], roles: ['key account', 'modern trade', 'kam', 'sales', 'account', 'trade', 'distributor'] }, ['modern-trade', 'key-account', 'listing', 'ray-beauty', 'b2b'], `
# Key Account & Listing Modern Trade

Modern trade (jaringan drugstore, supermarket/hypermarket, minimarket, department store, beauty retailer) memberi visibilitas besar tetapi menuntut disiplin operasional dan investasi dagang. Key account management (KAM) mengelola hubungan dengan akun strategis ini.

## Proses Listing (umum)
1. **Riset akun**: profil pembeli, kategori yang dijual, kompetitor di rak, rentang harga, lokasi toko.
2. **Proposal listing** ke buyer/category manager: profil merek, SKU yang diusulkan, harga dan margin ritel, rencana promosi, dukungan pemasaran, bukti permintaan (penjualan online, komunitas).
3. **Dokumen**: legalitas, nomor BPOM per SKU, sertifikat halal bila ada, spesifikasi produk, barcode, foto kemasan.
4. **Negosiasi syarat dagang**: margin, biaya listing, rebate, kontribusi promosi, termin pembayaran, kebijakan retur. Struktur biaya sangat bervariasi per ritel; konfirmasi dengan buyer dan hitung dampaknya ke margin ([[Matematika Harga - Margin Setelah Biaya Platform]]). Syarat di luar wewenang mengikuti [[Kebijakan Persetujuan]].
5. **Registrasi item** ke sistem ritel dan pengiriman stok awal.
6. **Peluncuran di toko**: POSM, planogram, promosi pembukaan, beauty advisor di toko prioritas.

## Pemilihan SKU
Mulai dari SKU hero dengan perputaran tertinggi dan harga yang cocok untuk pembeli ritel tersebut. Hindari listing terlalu banyak SKU di awal; SKU lambat berisiko delisting.

## Pengelolaan Setelah Listing
- **Sell-out per toko per SKU** (dari portal/laporan ritel).
- **Out-of-stock (OOS)** di rak dan di gudang ritel; kirim tim untuk cek rak.
- **Kepatuhan planogram** dan visibilitas.
- **Promo** sesuai kalender akun; evaluasi kenaikan penjualan vs biaya.
- Kesehatan stok dan kedaluwarsa (FEFO).

## Account Plan per Key Account (template)
- Tujuan tahunan (penjualan, jumlah toko, SKU):
- Pemangku kepentingan dan hubungan (buyer, category manager, store ops):
- Kinerja vs kategori:
- Inisiatif per kuartal (promo, ekspansi toko, SKU baru):
- Investasi dagang dan ROI yang diharapkan:
- Risiko (delisting, OOS, pesaing) dan mitigasi:

## Ritme
Mingguan: sell-out dan OOS. Bulanan: review dengan buyer. Kuartalan: business review bersama dengan data dan usulan pertumbuhan.

## Prinsip KAM
Pahami target kategori buyer, datang dengan data dan solusi, tepati komitmen pasokan, dan catat semua kesepakatan di CRM ([[Kebersihan Data CRM]]). Koordinasikan harga promo dengan kanal lain agar tidak terjadi konflik ([[Strategi Omnichannel Ray Beauty]]).
`),

  K('Customer Success RayFlow - Health Score & Pencegahan Churn', { divisions: ['cs', 'sales'], roles: ['customer success', 'csm', 'account', 'support', 'retention', 'rayflow'] }, ['customer-success', 'health-score', 'churn', 'rayflow', 'retensi'], `
# Customer Success RayFlow - Health Score & Pencegahan Churn

Customer Success (CS) memastikan pelanggan RayFlow mencapai hasil yang dijanjikan saat penjualan, sehingga mereka bertahan, berkembang, dan merekomendasikan. Tahap awal mengikuti [[Playbook Onboarding Pelanggan]].

## Fase Siklus Pelanggan
1. **Serah terima** dari Sales: pain, metrik keberhasilan, champion, janji.
2. **Onboarding**: kickoff, konfigurasi alur pertama, pelatihan, **first value** (alur pertama berjalan di operasi nyata) secepat mungkin.
3. **Adopsi**: perluas ke alur dan pengguna lain.
4. **Review nilai**: review berkala (bulanan untuk akun baru, kuartalan untuk akun stabil).
5. **Perpanjangan & ekspansi**.

## Health Score (contoh komponen)
| Komponen | Indikator | Bobot (sesuaikan) |
|---|---|---|
| Adopsi | pengguna aktif vs lisensi, alur aktif, frekuensi login | tinggi |
| Hasil | metrik keberhasilan tercapai vs target | tinggi |
| Hubungan | champion aktif, akses ke pemilik | sedang |
| Dukungan | jumlah dan tingkat keparahan tiket, tiket terbuka lama | sedang |
| Sentimen | NPS/CSAT terakhir ([[NPS & CSAT - Pengukuran dan Tindak Lanjut]]) | sedang |
| Komersial | pembayaran tepat waktu | rendah-sedang |
Skor dikelompokkan Hijau / Kuning / Merah. Kalibrasi bobot dengan data akun yang churn dan yang bertahan.

## Sinyal Risiko Churn
Penurunan login atau alur yang dimatikan, champion keluar, pemilik tidak merespons, tiket berulang tanpa solusi, keterlambatan bayar, permintaan export data, keluhan harga, perubahan bisnis (tutup cabang).

## Playbook Akun Merah
1. Hubungi dalam 2 hari kerja; jadwalkan panggilan dengan pemilik/pengambil keputusan.
2. Diagnosa: masalah produk, adopsi, nilai, atau komersial?
3. Rencana penyelamatan tertulis: tindakan, PIC, tanggal, metrik.
4. Libatkan support/teknis atau produk bila perlu ([[Eskalasi & Penanganan Keluhan Pelanggan]]).
5. Review mingguan sampai kembali Kuning/Hijau.
Konsesi komersial (diskon, perpanjangan gratis) mengikuti [[Kebijakan Persetujuan]].

## Ekspansi
Sinyal: lisensi penuh, permintaan alur baru, cabang baru, metrik tercapai. Serahkan peluang ke Sales dengan catatan di CRM.

## Rencana Review Nilai (agenda)
Rekap tujuan → hasil terukur → adopsi → masalah dan solusi → rekomendasi alur berikutnya → rencana periode depan.

## KPI CS
Gross/net revenue retention, logo churn, waktu ke first value, persentase akun Hijau, ekspansi. Definisi di [[KPI Dictionary]].
`),

  K('NPS & CSAT - Pengukuran dan Tindak Lanjut', { divisions: ['cs', 'data', 'retail', 'ecom'], roles: ['customer success', 'support', 'cs', 'survey', 'cx', 'store'] }, ['nps', 'csat', 'survei', 'voice-of-customer'], `
# NPS & CSAT - Pengukuran dan Tindak Lanjut

Survei kepuasan berguna hanya jika ditindaklanjuti. Gunakan NPS untuk loyalitas hubungan dan CSAT untuk kepuasan interaksi tertentu.

## Definisi & Rumus
- **NPS**: "Seberapa mungkin Anda merekomendasikan [RayFlow/Ray Beauty] kepada teman atau rekan?" skala 0-10.
  - Promoter 9-10, Passive 7-8, Detractor 0-6.
  - **NPS = % Promoter − % Detractor** (rentang −100 sampai +100).
- **CSAT**: "Seberapa puas Anda dengan [layanan/interaksi ini]?" skala 1-5.
  - **CSAT % = jumlah jawaban 4-5 / total jawaban × 100**.
- Opsional **CES** (Customer Effort Score): seberapa mudah masalah diselesaikan.
Definisi baku mengikuti [[KPI Dictionary]].

## Kapan Dikirim
| Survei | Pemicu | Kanal |
|---|---|---|
| CSAT tiket | setelah tiket ditutup | chat/email |
| CSAT toko | setelah transaksi/konsultasi di store | struk QR/WhatsApp (dengan persetujuan) |
| NPS RayFlow | 60-90 hari setelah onboarding, lalu berkala | email/in-app |
| NPS Ray Beauty | setelah pembelian ke-2 atau berkala ke pelanggan terdaftar | WhatsApp/email |
Jangan survei pelanggan yang sama terlalu sering; tetapkan jeda minimum.

## Desain Survei
- Satu pertanyaan skor + satu pertanyaan terbuka ("Apa alasan utama skor Anda?").
- Singkat, bahasa sederhana, bisa dijawab di ponsel.
- Jangan memancing skor ("Mohon beri nilai 10").

## Closed-Loop Follow-Up
1. **Detractor/CSAT 1-2**: hubungi dalam 2 hari kerja oleh pemilik akun/supervisor. Dengarkan, minta maaf bila relevan, perbaiki, dan catat. Bila menyangkut reaksi kulit, ikuti [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].
2. **Passive**: tanyakan satu hal yang bisa membuat pengalaman lebih baik.
3. **Promoter**: ucapkan terima kasih; tawarkan program referral atau minta ulasan/testimoni (dengan persetujuan).
4. Tutup loop: informasikan perbaikan yang dilakukan berdasarkan masukan.

## Analisis
- Kodekan jawaban terbuka ke tema (produk, harga, layanan, pengiriman, onboarding, fitur).
- Pantau tren, bukan satu angka; perhatikan jumlah responden sebelum menyimpulkan.
- Segmentasi: kanal, paket, wilayah, toko, agen CS.
- Laporan bulanan: skor, tren, 3 tema teratas, tindakan dan PIC.

## Penggunaan
NPS masuk ke health score RayFlow ([[Customer Success RayFlow - Health Score & Pencegahan Churn]]). CSAT per agen dipakai untuk coaching, bukan hukuman semata. CSAT toko dipakai dalam review [[Operasional Toko Ritel Ray Beauty]].
`),

  K('Eskalasi & Penanganan Keluhan Pelanggan', { divisions: ['cs', 'qa', 'retail', 'ecom'], roles: ['support', 'cs', 'customer success', 'escalation', 'complaint', 'store'] }, ['eskalasi', 'keluhan', 'tiket', 'cs'], `
# Eskalasi & Penanganan Keluhan Pelanggan

Keluhan yang ditangani baik dapat mengembalikan kepercayaan. Prosedur tiket dasar ada di [[SOP CS - Penanganan Tiket]]; catatan ini mengatur prioritas dan eskalasi untuk RayFlow dan Ray Beauty.

## Klasifikasi Prioritas
| Prioritas | Contoh | Respon awal |
|---|---|---|
| P1 Kritis | dugaan reaksi kulit serius, keluhan berpotensi viral/media, kebocoran data, RayFlow tidak bisa dipakai untuk banyak pelanggan | segera, eskalasi langsung ke manajer |
| P2 Tinggi | cacat produk pada batch, fitur utama RayFlow gagal untuk satu pelanggan, pelanggan VIP/key account | hari yang sama |
| P3 Normal | salah kirim, keterlambatan, pertanyaan cara pakai | sesuai SLA standar |
| P4 Rendah | saran, permintaan fitur | dicatat dan dikonfirmasi |
Target waktu spesifik ditetapkan di SOP tiket dan [[KPI Dictionary]].

## Teknik Menangani Keluhan (HEARD)
1. **Hear**: dengarkan tanpa memotong.
2. **Empathize**: "Saya mengerti ini sangat mengganggu."
3. **Apologize**: minta maaf atas pengalaman, tanpa mengakui kesalahan teknis sebelum diverifikasi.
4. **Resolve**: tawarkan solusi atau langkah jelas dengan waktu.
5. **Diagnose**: cari akar masalah agar tidak berulang.

## Jalur Eskalasi
- **Ray Beauty**: Agen CS → Supervisor CS → QA (mutu/batch), Regulatory (reaksi kulit, klaim, BPOM), Legal & PR (risiko hukum/media), SCM (pengiriman).
- **RayFlow**: Agen support → Support lanjutan/teknis → Engineering (bug) → Product (permintaan fitur) → CS Manager (risiko churn akun).
- Keluhan reaksi kulit selalu mengikuti [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

## Isi Tiket Eskalasi (wajib)
- Identitas pelanggan dan kanal (tanpa menyebarkan data pribadi di luar sistem).
- Kronologi singkat dan bukti (foto, video, screenshot, nomor batch/pesanan, log).
- Dampak dan prioritas.
- Yang sudah dilakukan.
- Yang diminta dari tim tujuan dan tenggatnya.

## Keluhan Publik (media sosial, ulasan viral)
Balas publik dengan singkat dan empatik, ajak lanjut ke kanal privat. Jangan berdebat atau mengungkap data pelanggan. Pernyataan resmi hanya melalui tim yang berwenang.

## Kompensasi
Kompensasi (refund, kirim ulang, voucher, perpanjangan langganan) mengikuti batas wewenang di [[Kebijakan Persetujuan]]. Dokumentasikan alasan.

## Penutupan & Pembelajaran
Konfirmasi ke pelanggan bahwa masalah selesai, kirim CSAT ([[NPS & CSAT - Pengukuran dan Tindak Lanjut]]). Rekap bulanan keluhan per kategori ke QA, Produk, dan E-commerce sebagai bahan perbaikan.
`),

  K('Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory', { divisions: ['cs', 'qa', 'reg', 'retail', 'ecom'], roles: ['support', 'cs', 'beauty advisor', 'complaint', 'quality', 'regulatory', 'store', 'marketplace'] }, ['kosmetik', 'iritasi', 'efek-tidak-diinginkan', 'qa', 'regulatory', 'keluhan'], `
# Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory

Setiap laporan reaksi kulit (kemerahan, gatal, perih, bentol, ruam, bengkak) setelah memakai produk Ray Beauty diperlakukan sebagai laporan efek yang tidak diinginkan, dari kanal apa pun: marketplace, TikTok Shop, website, reseller, distributor, toko, atau media sosial.

## Prinsip
1. **Keselamatan pelanggan dulu**: sarankan menghentikan pemakaian dan berkonsultasi ke tenaga medis bila keluhan berlanjut atau berat.
2. **Jangan mendiagnosis** dan jangan memberi saran pengobatan. CS dan beauty advisor bukan tenaga medis.
3. **Jangan menyangkal atau menyalahkan** pelanggan; jangan pula mengakui penyebab sebelum investigasi.
4. **Semua kasus dicatat**, termasuk yang ringan, agar QA dapat melihat pola per batch.
5. Kewajiban pelaporan ke otoritas ditentukan oleh tim Regulatory, bukan oleh CS.

## Langkah CS / Beauty Advisor
1. Tanggapi dengan empati: "Kami turut prihatin. Mohon hentikan pemakaian produk dulu ya, Kak."
2. Kumpulkan data:
   - Nama produk, ukuran, **nomor batch** dan tanggal kedaluwarsa (foto kemasan).
   - Tempat dan tanggal pembelian (untuk menelusuri keaslian).
   - Tanggal mulai pakai, frekuensi, cara pakai, area pemakaian.
   - Gejala, kapan muncul, perkembangan; foto area kulit bila pelanggan bersedia.
   - Produk lain yang dipakai bersamaan, riwayat alergi yang diketahui pelanggan.
   - Apakah sudah ke tenaga medis dan hasilnya (bila mau berbagi).
3. Buat tiket kategori **Efek Tidak Diinginkan** dengan prioritas sesuai tingkat keparahan ([[Eskalasi & Penanganan Keluhan Pelanggan]]).
4. Kasus berat (bengkak di wajah/mata, kesulitan bernapas, luka, perlu perawatan medis) → P1: anjurkan segera ke fasilitas kesehatan, eskalasi langsung ke Supervisor, QA, dan Regulatory pada hari yang sama.
5. Informasikan ke pelanggan bahwa tim kualitas akan menindaklanjuti dan kapan mereka akan dihubungi.
6. Minta pelanggan menyimpan sisa produk; QA dapat meminta sampel kembali.

## Peran QA & Regulatory
- **QA**: cek catatan batch, sampel pertinggal, hasil uji, keluhan lain pada batch yang sama; tentukan apakah perlu investigasi lanjutan atau tindakan pada batch.
- **Regulatory**: menilai kausalitas dan kewajiban pelaporan, meninjau klaim dan label, memberi arahan komunikasi.
- Keputusan penarikan atau penghentian distribusi hanya oleh pihak berwenang internal.

## Komunikasi & Kompensasi
- Komunikasi lanjutan memakai bahasa yang disetujui Regulatory; tidak ada pernyataan publik tanpa persetujuan.
- Refund atau bantuan lain mengikuti [[Kebijakan Persetujuan]]; jangan mensyaratkan pelanggan menghapus ulasan.

## Pencegahan
Edukasi uji tempel (patch test) di listing, konsultasi, dan kartu insert. Hindari klaim "aman untuk semua kulit" atau "tidak mungkin iritasi" ([[Pedoman Klaim Kosmetik]]).

## Checklist Tiket
- [ ] Nomor batch dan foto produk
- [ ] Kronologi dan gejala
- [ ] Tingkat keparahan dan prioritas
- [ ] QA dan Regulatory sudah dinotifikasi
- [ ] Pelanggan sudah diberi info tindak lanjut
`),

  K('Konsultasi Beauty Advisor - Jenis Kulit & Rutinitas', { divisions: ['retail', 'cs', 'ecom'], roles: ['beauty advisor', 'ba', 'store', 'retail', 'live', 'consultant', 'support'] }, ['beauty-advisor', 'jenis-kulit', 'rutinitas', 'konsultasi', 'skincare'], `
# Konsultasi Beauty Advisor - Jenis Kulit & Rutinitas

Beauty advisor (BA) membantu pelanggan memilih produk yang sesuai. Konsultasi bersifat kosmetik, bukan medis. Semua pernyataan produk harus sesuai [[Pedoman Klaim Kosmetik]]; detail produk di [[Produk Ray Beauty]].

## Alur Konsultasi (5-10 menit)
1. **Sapa & bangun kenyamanan**: "Halo Kak, sedang cari produk untuk kebutuhan apa?"
2. **Gali kebutuhan**:
   - Keluhan utama yang ingin diperbaiki (kusam, minyak berlebih, kering, tampilan pori, jerawat ringan, tanda penuaan).
   - Rutinitas saat ini dan produk yang dipakai.
   - Riwayat iritasi/kepekaan terhadap produk tertentu.
   - Preferensi tekstur, aroma, dan anggaran.
3. **Kenali jenis kulit** (lihat tabel), tanyakan bagaimana kulit terasa beberapa jam setelah cuci muka.
4. **Rekomendasikan rutinitas** sederhana, mulai dari dasar.
5. **Demo**: tester di punggung tangan, jelaskan cara pakai dan urutan.
6. **Edukasi keamanan**: uji tempel, perkenalkan produk aktif bertahap, sunscreen setiap pagi.
7. **Tutup & catat**: tawarkan bundling rutinitas, catat profil pelanggan (dengan persetujuan) untuk [[Clienteling Beauty Store]].

## Jenis Kulit (panduan umum)
| Jenis | Ciri yang dirasakan | Arah rekomendasi |
|---|---|---|
| Normal | seimbang, jarang bermasalah | rutinitas dasar perawatan |
| Kering | terasa kencang, kasar, bersisik | pembersih lembut, pelembap lebih kaya |
| Berminyak | mengilap menyeluruh, pori tampak | tekstur ringan, non-komedogenik (bila teruji) |
| Kombinasi | berminyak di area T, normal/kering di pipi | tekstur ringan, hidrasi seimbang |
| Sensitif | mudah merah/perih dengan produk tertentu | formula sederhana, uji tempel wajib, satu produk baru setiap kali |
Kondisi kulit (kusam, dehidrasi, jerawat ringan) bisa terjadi pada jenis kulit mana pun.

## Rutinitas Dasar
- **Pagi**: pembersih → (toner, opsional) → serum sesuai kebutuhan → pelembap → sunscreen.
- **Malam**: bersihkan (double cleansing bila memakai makeup/sunscreen tebal) → serum/treatment → pelembap.
Prinsip: lebih sedikit tetapi konsisten; jangan memulai banyak produk aktif sekaligus.

## Batasan Wajib
- Jangan mendiagnosis penyakit kulit (eksim, jerawat meradang berat, infeksi, flek tertentu). Katakan: "Untuk kondisi seperti ini sebaiknya dicek dokter kulit dulu ya, Kak."
- Jangan menyebut produk "menyembuhkan", "mengobati", "memutihkan permanen", atau menjamin hasil dalam waktu tertentu.
- Jangan menyarankan penggunaan di luar petunjuk label.
- Pelanggan hamil/menyusui atau sedang menjalani perawatan medis: sarankan konsultasi tenaga medis sebelum memakai produk aktif.
- Keluhan reaksi kulit: ikuti [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

## Frasa Aman
"Membantu menjaga kelembapan", "membantu kulit tampak lebih cerah", "membantu mengontrol tampilan minyak", "cocok untuk rutinitas kulit berminyak".
`),

  K('Operasional Toko Ritel Ray Beauty', { divisions: ['retail', 'ops'], roles: ['store', 'retail', 'store manager', 'beauty advisor', 'visual merchandising', 'kasir'] }, ['retail', 'toko', 'visual-merchandising', 'stok', 'kpi-toko'], `
# Operasional Toko Ritel Ray Beauty

Panduan menjalankan beauty store Ray Beauty: tampilan, stok, layanan, dan KPI.

## Rutinitas Harian
**Buka toko**
- [ ] Kebersihan lantai, rak, cermin, area tester.
- [ ] Cek tester: tersedia, bersih, berlabel "Tester", tidak kedaluwarsa; alat aplikasi sekali pakai cukup.
- [ ] Rak penuh, label harga benar, promo aktif terpasang.
- [ ] Briefing 10 menit: target hari ini, promo, produk fokus, pembagian zona.
**Selama jam buka**
- Sapa setiap pelanggan dalam beberapa detik setelah masuk; tawarkan konsultasi ([[Konsultasi Beauty Advisor - Jenis Kulit & Rutinitas]]).
- Isi ulang rak dari gudang toko saat jam sepi.
**Tutup toko**
- [ ] Rekonsiliasi kas dan pembayaran non-tunai.
- [ ] Laporan harian: penjualan, transaksi, pengunjung, produk habis.
- [ ] Amankan stok dan area kasir.

## Visual Merchandising
- **Zona**: area dekompresi di pintu masuk (jangan terlalu padat), meja fokus/peluncuran di zona depan, rak per kebutuhan kulit, area konsultasi dan tester, kasir dengan produk impulse (ukuran travel, lip care).
- **Penataan**: produk hero setinggi mata; blok warna/lini; muka produk menghadap depan; tiga titik fokus per meja (tinggi-sedang-rendah).
- **Komunikasi**: signage singkat berbasis kebutuhan ("Untuk kulit kusam"), harga jelas, semua klaim di materi POS sudah disetujui ([[Pedoman Klaim Kosmetik]]).
- Ganti tampilan meja fokus mengikuti kalender kampanye; foto tampilan dikirim ke pusat untuk cek kepatuhan planogram.

## Manajemen Stok
- Penerimaan barang: cocokkan dengan surat jalan, cek kondisi, nomor batch, dan tanggal kedaluwarsa.
- FEFO di rak dan gudang.
- Stock opname berkala (siklus mingguan untuk SKU hero, penuh sesuai jadwal pusat); selisih diselidiki.
- Titik pemesanan ulang berdasarkan rata-rata penjualan harian dan waktu kirim.
- Produk rusak/kedaluwarsa dipisahkan dan dilaporkan; tidak boleh dijual atau dijadikan tester.

## KPI Toko
| KPI | Rumus |
|---|---|
| Penjualan toko | total penjualan bersih |
| Konversi | jumlah transaksi / jumlah pengunjung |
| ATV (rata-rata nilai transaksi) | penjualan / jumlah transaksi |
| UPT (unit per transaksi) | unit terjual / jumlah transaksi |
| Penjualan per m² | penjualan / luas area jual |
| Penjualan per jam kerja | penjualan / total jam kerja staf |
| Shrinkage | selisih stok / nilai penjualan |
| CSAT toko | lihat [[NPS & CSAT - Pengukuran dan Tindak Lanjut]] |
Rumus inti: **Penjualan = Pengunjung × Konversi × ATV**. Definisi baku di [[KPI Dictionary]].

## Diagnosa Cepat
Pengunjung rendah → aktivasi lokal, tampilan etalase, jam promosi. Konversi rendah → kurang staf di jam ramai, stok habis, sapaan lambat. ATV/UPT rendah → kurang rekomendasi rutinitas dan bundling.

## Review Mingguan Manajer Toko
KPI vs target, top/bottom SKU, OOS, jadwal staf vs jam ramai, coaching BA, rencana minggu depan. Retensi pelanggan toko dijalankan lewat [[Clienteling Beauty Store]].
`),

  K('Clienteling Beauty Store', { divisions: ['retail', 'cs', 'mkt'], roles: ['beauty advisor', 'store', 'retail', 'clienteling', 'crm', 'store manager'] }, ['clienteling', 'retail', 'crm', 'retensi', 'loyalitas'], `
# Clienteling Beauty Store

Clienteling adalah membangun hubungan personal jangka panjang antara beauty advisor (BA) dan pelanggan, berbasis data profil dan riwayat pembelian. Tujuan: kunjungan ulang, pembelian ulang, dan rekomendasi.

## Profil Pelanggan (dengan persetujuan)
Kumpulkan hanya yang perlu dan dengan izin jelas:
- Nama, nomor WhatsApp/email, preferensi kontak, status persetujuan pemasaran.
- Jenis kulit dan keluhan utama (dari [[Konsultasi Beauty Advisor - Jenis Kulit & Rutinitas]]).
- Riwayat pembelian dan produk yang tidak cocok.
- Tanggal penting yang dibagikan sukarela (mis. ulang tahun).
- BA yang melayani.
Data disimpan di sistem resmi (CRM/POS), bukan di ponsel pribadi atau catatan kertas. Patuhi kebijakan privasi perusahaan.

## Kalender Kontak (contoh)
- **H+3 setelah pembelian**: tanyakan pengalaman awal dan ingatkan cara pakai. "Halo Kak [nama], ini [BA] dari Ray Beauty [lokasi]. Bagaimana pengalaman pakai [produk] beberapa hari ini? Kalau ada pertanyaan, kabari saya ya."
- **Mendekati perkiraan produk habis**: pengingat isi ulang, tawarkan simpan produk untuk diambil di toko.
- **Peluncuran produk relevan**: undangan mencoba lebih dulu.
- **Ulang tahun/momen**: ucapan dan penawaran yang berlaku.
- **Tidak aktif lama**: ajakan konsultasi ulang tanpa tekanan.
Batasi frekuensi; hormati permintaan berhenti dihubungi.

## Segmentasi
- Baru (1 pembelian), Berulang, VIP (nilai/frekuensi tertinggi sesuai definisi program), Berisiko (lama tidak kembali).
- VIP: undangan acara, konsultasi prioritas, preview produk.

## Ritual BA Harian
1. Cek daftar kontak hari ini dari sistem (10-15 pelanggan).
2. Kirim pesan personal, bukan broadcast massal.
3. Catat respons dan hasil.
4. Setelah transaksi, perbarui profil dan jadwalkan kontak berikutnya.

## Koneksi Omnichannel
Pelanggan toko bisa membeli lewat website atau marketplace; bila sistem mendukung, atribusikan ke toko/BA (mis. kode BA atau tautan khusus) agar BA tetap termotivasi. Lihat [[Strategi Omnichannel Ray Beauty]].

## Aturan
- Tidak memakai data pelanggan untuk kepentingan pribadi atau dibawa saat pindah kerja.
- Tidak menjanjikan hasil, diskon di luar program, atau membuat klaim terlarang ([[Pedoman Klaim Kosmetik]]).
- Keluhan reaksi kulit dari pelanggan clienteling langsung masuk [[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]].

## KPI
Persentase transaksi dengan profil tercatat, persentase pelanggan dengan persetujuan kontak, tingkat respons pesan, repeat purchase rate pelanggan terdaftar, penjualan dari pelanggan berulang, dan CSAT ([[NPS & CSAT - Pengukuran dan Tindak Lanjut]]).
`),

  K('Strategi Omnichannel Ray Beauty', { divisions: ['ecom', 'retail', 'sales', 'mkt', 'exec'], roles: ['omnichannel', 'commerce', 'marketplace', 'retail', 'distributor', 'reseller', 'pricing', 'channel'] }, ['omnichannel', 'channel', 'harga', 'stok', 'ray-beauty'], `
# Strategi Omnichannel Ray Beauty

Ray Beauty menjual lewat marketplace, TikTok Shop, website D2C, reseller, distributor, modern trade, dan beauty store sendiri. Omnichannel berarti pelanggan mendapat pengalaman, harga, dan informasi yang konsisten di mana pun, dan kanal saling mendukung, bukan saling memakan.

## Peran Tiap Kanal
| Kanal | Peran utama |
|---|---|
| Marketplace | volume, pencarian, kampanye besar |
| TikTok Shop | discovery lewat konten, live, afiliasi |
| Website D2C | data first-party, retensi, eksklusif ([[Website D2C Ray Beauty]]) |
| Beauty store | pengalaman, konsultasi, kepercayaan merek ([[Operasional Toko Ritel Ray Beauty]]) |
| Reseller | jangkauan komunitas ([[Manajemen Reseller Ray Beauty]]) |
| Distributor & modern trade | jangkauan fisik nasional ([[Manajemen Distributor Ray Beauty]], [[Key Account & Listing Modern Trade]]) |

## Arsitektur Harga
- Satu harga eceran rekomendasi (RRP) per SKU sebagai acuan semua kanal ([[Pricing]]).
- Struktur margin berjenjang untuk distributor dan reseller agar mereka tetap untung pada RRP.
- Kebijakan harga minimum untuk kanal online; pantau rutin.
- Promo dibedakan lewat **mekanisme** (bundling, gift, eksklusif kanal), bukan perang diskon antar-kanal ([[Matematika Promo - Stacking Diskon & Bundling]]).
- Kalender promo lintas kanal disepakati di awal bulan dan dikomunikasikan ke mitra sebelum tayang.

## Konsistensi Informasi
Master data produk tunggal: nama, deskripsi, klaim yang disetujui ([[Pedoman Klaim Kosmetik]]), INCI, BPOM, foto. Semua kanal mengambil dari sumber ini; perubahan diumumkan serentak.

## Stok & Fulfilment
- Visibilitas stok terpusat per lokasi (gudang pusat, gudang marketplace, toko).
- Alokasi stok kampanye dirancang lebih dulu agar kanal lain tidak kehabisan.
- Opsi lanjutan bila sistem mendukung: beli online ambil di toko, kirim dari toko terdekat, retur online di toko.

## Data Pelanggan & Loyalitas
- Identitas pelanggan disatukan (dengan persetujuan) antara website, toko, dan program loyalitas.
- Poin dan benefit bisa dipakai lintas kanal milik sendiri.
- Data marketplace terbatas oleh aturan platform: verifikasi ke ketentuan platform terbaru.

## Layanan Lintas Kanal
Standar CS dan jalur keluhan yang sama untuk semua kanal ([[Eskalasi & Penanganan Keluhan Pelanggan]]). Keluhan reaksi kulit dari kanal mana pun masuk satu alur ([[Keluhan Iritasi Kosmetik - Alur ke QA & Regulatory]]).

## Mengelola Konflik Kanal
Gejala: reseller mengeluh harga online, distributor kehilangan outlet, toko sepi saat kampanye online. Tindakan: data penjualan per wilayah dan kanal, forum mitra bulanan, produk/bundling eksklusif per kanal, atribusi penjualan online ke toko/BA ([[Clienteling Beauty Store]]).

## KPI Omnichannel
GMV dan margin kontribusi per kanal, porsi pelanggan multi-kanal, repeat rate lintas kanal, kepatuhan harga, OOS per kanal. Definisi di [[KPI Dictionary]]; dasar analisis di [[Analitik E-commerce - Rumus GMV]].
`),
];
