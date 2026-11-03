// Marketing knowledge: fundamental marketing, brand, kampanye, social, konten, SEO, ads, KOL, CRM, analytics, PR, dan playbook spesifik Ray Group
const K = (title, audience, tags, content) => ({ title, audience, tags, content: content.trim() });
export default [
  K('STP Ray Group: Segmentasi, Targeting, Positioning', { divisions: ['mkt', 'sales', 'exec', 'bizdev'], roles: ['marketing', 'brand', 'strategy'] }, ['stp', 'fundamental', 'segmentasi', 'positioning'], `
# STP Ray Group: Segmentasi, Targeting, Positioning

STP adalah urutan berpikir sebelum membuat kampanye apa pun: pecah pasar menjadi segmen, pilih segmen yang paling layak dikejar, lalu tentukan posisi yang ingin ditempati di benak segmen itu. Melompat langsung ke eksekusi (konten, iklan) tanpa STP menghasilkan pesan yang generik dan budget yang bocor.

## 1. Segmentasi
Gunakan beberapa lapis variabel sekaligus:
- **Demografis/firmografis**: usia, gender, kota (konsumen); jumlah karyawan, omzet, sektor (B2B).
- **Geografis**: kota tier 1 vs tier 2/3, Jawa vs luar Jawa (memengaruhi ongkir, channel, dan bahasa).
- **Psikografis**: nilai, gaya hidup, sikap terhadap teknologi atau skincare.
- **Behavioral**: frekuensi beli, channel favorit (marketplace, WhatsApp, offline), kebutuhan pemicu (jerawat, kusam; atau "rekap pesanan berantakan").

Contoh RayFlow: UMKM kuliner multi-cabang, toko online yang jualan di 3+ marketplace, jasa (klinik, bengkel) yang butuh reminder pelanggan. Detail lihat [[Persona Pelanggan UMKM]] dan [[Ideal Customer Profile]].
Contoh Ray Beauty: pelajar/mahasiswa berbudget terbatas, pekerja muda dengan masalah kulit spesifik, konsumen halal-conscious, pembeli kado.

## 2. Targeting
Nilai setiap segmen dengan skor 1–5 pada kriteria berikut, lalu pilih 1–3 segmen prioritas:
| Kriteria | Pertanyaan kunci |
|---|---|
| Ukuran & pertumbuhan | Cukup besar untuk target revenue? |
| Aksesibilitas | Bisa dijangkau dengan channel yang kita kuasai? |
| Kecocokan produk | Masalah mereka benar-benar diselesaikan produk kita? |
| Profitabilitas | Margin dan LTV memadai setelah CAC? |
| Intensitas kompetisi | Ada celah yang belum diisi pesaing? |

Pilih pola: undifferentiated (jarang tepat), differentiated (pesan berbeda per segmen), atau concentrated/niche (paling cocok untuk brand yang sedang membangun basis).

## 3. Positioning
Tulis positioning statement satu kalimat:
> Untuk [segmen target] yang [kebutuhan/masalah], [brand] adalah [kategori] yang [manfaat utama], karena [reason to believe], tidak seperti [alternatif utama].

Contoh RayFlow: "Untuk pemilik UMKM yang kewalahan mengelola pesanan dari banyak channel, RayFlow adalah platform otomasi alur kerja yang menyatukan pesanan dan follow-up pelanggan dalam satu dasbor berbahasa Indonesia, tidak seperti spreadsheet manual atau tools asing yang rumit."

Reason to believe untuk Ray Beauty bisa berupa pabrik sendiri bersertifikat CPKB dan formulasi yang dikembangkan untuk kulit dan iklim tropis; pastikan setiap klaim sesuai [[Pedoman Klaim Kosmetik]].

## Checklist
- Segmen dideskripsikan dengan data, bukan asumsi.
- Ada maksimal 3 segmen prioritas per kuartal.
- Positioning statement disetujui brand lead dan konsisten dengan [[Brand Guidelines]].
- Turunan pesan (tagline, value proposition per channel) diuji sebelum dipakai di skala besar.
`),

  K('Marketing Mix 4P dan 7P', { divisions: ['mkt', 'sales', 'exec', 'retail', 'ecom'], roles: ['marketing', 'brand', 'product'] }, ['4p', '7p', 'fundamental', 'marketing-mix'], `
# Marketing Mix 4P dan 7P

Marketing mix adalah daftar tuas yang bisa diatur untuk mewujudkan positioning. 4P cocok untuk produk fisik (Ray Beauty); 7P menambahkan tiga elemen layanan yang krusial untuk SaaS (RayFlow) dan pengalaman retail.

## 4P Inti
- **Product**: fitur, kualitas, kemasan, varian, garansi/dukungan. Ray Beauty: formulasi, ukuran (travel size untuk trial), desain kemasan, nomor notifikasi BPOM. RayFlow: modul, integrasi, onboarding. Detail di [[Produk & Layanan]] dan [[Produk Ray Beauty]].
- **Price**: harga dasar, struktur paket, diskon, bundling, cicilan. Harga adalah sinyal positioning; diskon berlebihan merusak persepsi. Acuan resmi di [[Pricing]].
- **Place**: channel distribusi. Ray Beauty: official store marketplace, TikTok Shop, website, reseller, retail modern. RayFlow: self-serve website, sales langsung, partner/reseller.
- **Promotion**: iklan, konten, KOL, PR, promo, event. Harus selaras dengan tiga P lainnya.

## 3P Tambahan (Layanan)
- **People**: semua orang yang berinteraksi dengan pelanggan: CS, sales, beauty advisor, onboarding specialist, bahkan admin DM. Siapkan skrip dan pelatihan.
- **Process**: alur pengalaman pelanggan: checkout, pengiriman, aktivasi akun, penanganan komplain, refund. Proses yang buruk membatalkan promosi yang bagus.
- **Physical Evidence**: bukti nyata kualitas: kemasan unboxing, website, dasbor aplikasi, testimoni, sertifikat CPKB, studi kasus pelanggan.

## Cara Memakai di Ray Group
1. Untuk setiap peluncuran, isi tabel 7P dalam satu halaman sebelum brief kreatif dibuat.
2. Tandai P yang menjadi **pembeda utama** (biasanya 1–2), dan P yang hanya perlu **setara pasar**.
3. Cek konsistensi silang: harga premium harus didukung kemasan, people, dan physical evidence yang premium.
4. Tentukan pemilik per P (product: R&D/product, price: finance+marketing, place: ecom/sales, promotion: marketing, people: HR/CS, process: ops, physical evidence: design).

## Template Singkat
| P | Keputusan | Pembeda/Setara | Pemilik | Risiko |
|---|---|---|---|---|
| Product | ... | ... | ... | ... |
| Price | ... | ... | ... | ... |

## Kesalahan Umum
- Menganggap marketing = promotion saja.
- Mengubah harga tanpa koordinasi dengan sales/reseller sehingga terjadi konflik channel.
- Promosi besar sebelum proses (stok, CS, server) siap menanggung lonjakan.
- Mengabaikan People: balasan DM yang lambat atau ketus menggerus hasil iklan.
`),

  K('Customer Journey, Funnel, AIDA dan AARRR', { divisions: ['mkt', 'sales', 'ecom', 'data', 'cs'], roles: ['marketing', 'growth', 'crm', 'performance'] }, ['funnel', 'aida', 'aarrr', 'customer-journey'], `
# Customer Journey, Funnel, AIDA dan AARRR

Tiga model ini melihat hal yang sama dari sudut berbeda: perjalanan pelanggan (empati), funnel (konversi bertahap), AIDA (psikologi pesan), dan AARRR (metrik pertumbuhan produk).

## Customer Journey Map
Tahap umum: **Awareness → Consideration → Purchase → Onboarding/Usage → Loyalty → Advocacy**. Untuk tiap tahap petakan: tujuan pelanggan, pertanyaan di kepala, touchpoint, emosi, hambatan, dan konten/aksi kita.

Contoh Ray Beauty (serum): lihat video TikTok tentang kulit kusam → cek komentar dan ulasan marketplace → bandingkan harga dengan pesaing → checkout saat flash sale → pakai 2 minggu → repurchase atau ulasan.
Contoh RayFlow: pemilik UMKM mencari "cara rekap pesanan otomatis" → baca artikel blog → ikut webinar → free trial → aktivasi workflow pertama → berlangganan → merekomendasikan ke komunitas.

## Funnel TOFU–MOFU–BOFU
- **TOFU**: edukasi masalah, konten luas, KPI reach, view, CPM.
- **MOFU**: bukti dan perbandingan, KPI engagement, klik, lead, add-to-cart.
- **BOFU**: penawaran dan pengurangan risiko (garansi, trial, testimoni), KPI konversi, CPA.
- **Post-funnel**: retensi, repeat, referral. Sering dilupakan padahal paling murah.

## AIDA (untuk menyusun pesan)
Attention (hook) → Interest (relevansi) → Desire (manfaat dan bukti) → Action (CTA jelas). Dipakai di satu iklan, landing page, atau rangkaian konten. Lihat [[Framework Copywriting: PAS, AIDA, 4U dan Hook]].

## AARRR (Pirate Metrics, untuk RayFlow)
| Tahap | Definisi contoh | Metrik |
|---|---|---|
| Acquisition | Pengunjung datang | Visit per channel, CAC |
| Activation | Momen "aha" pertama | % trial yang membuat workflow pertama |
| Retention | Kembali memakai | Weekly active, churn |
| Revenue | Membayar | Trial-to-paid, ARPU |
| Referral | Mengajak orang lain | Referral rate, K-factor |

Untuk Ray Beauty, adaptasi: Activation = pembelian pertama, Retention = repeat purchase dalam siklus pemakaian produk.

## Cara Diagnosis Funnel
1. Hitung conversion rate antar tahap dari data aktual (definisi di [[KPI Dictionary]]).
2. Cari tahap dengan penurunan terbesar dibanding periode sebelumnya atau benchmark internal.
3. Rumuskan hipotesis penyebab (pesan, harga, UX, stok, kecepatan balasan).
4. Uji satu perbaikan per tahap lewat [[A/B Testing dan Statistik Eksperimen]].
5. Jangan menambah budget TOFU bila kebocoran ada di BOFU atau retensi.
`),

  K('Arsitektur Brand dan Positioning RayFlow vs Ray Beauty', { all: true }, ['brand', 'arsitektur-brand', 'positioning', 'ray-group'], `
# Arsitektur Brand dan Positioning RayFlow vs Ray Beauty

Ray Group menaungi dua lini yang sangat berbeda: RayFlow (SaaS otomasi workflow B2B untuk UMKM) dan Ray Beauty (skincare lokal B2C dengan pabrik sendiri bersertifikat CPKB). Arsitektur brand menentukan seberapa jauh keduanya saling meminjam nama dan reputasi.

## Model Arsitektur
- **Branded house**: satu nama induk mendominasi (cocok bila audiens dan kategori mirip).
- **House of brands**: tiap brand berdiri sendiri, induk nyaris tak terlihat.
- **Endorsed/hybrid**: brand produk tampil di depan, induk hadir sebagai penjamin ("by Ray Group").

Rekomendasi kerja: **hybrid ringan**. RayFlow dan Ray Beauty tampil sebagai brand utama dengan identitas, nada, dan channel masing-masing. "Ray Group" dipakai di konteks korporat: rekrutmen, investor, PR bisnis, kemitraan, dan footer legal. Hindari mencampur konten kedua brand dalam satu akun sosial atau satu iklan.

## Perbedaan Positioning
| Aspek | RayFlow | Ray Beauty |
|---|---|---|
| Audiens | Pemilik/manajer UMKM | Konsumen individu, mayoritas muda |
| Janji inti | Hemat waktu, rapi, bisnis tumbuh | Kulit sehat dengan produk lokal tepercaya |
| Nada | Praktis, suportif, ahli tapi tidak menggurui | Hangat, jujur, edukatif, relatable |
| Bukti | Studi kasus, demo, ROI, integrasi | Kandungan, uji, CPKB, ulasan, BPOM |
| Siklus beli | Pertimbangan lebih lama, ada trial | Impulsif hingga terencana, dipicu promo |
| Channel utama | SEO, webinar, LinkedIn, WhatsApp, komunitas | TikTok, Instagram, marketplace, KOL |

Detail identitas visual dan suara mengikuti [[Brand Guidelines]]; profil korporat di [[Profil Perusahaan]].

## Aturan Lintas Brand
1. Satu brand, satu janji: jangan memasukkan pesan RayFlow ke konten Ray Beauty.
2. Sinergi boleh di belakang layar: Ray Beauty bisa menjadi studi kasus internal pemakaian RayFlow (misalnya otomasi pesanan reseller) bila datanya akurat dan disetujui.
3. Krisis di satu brand tidak boleh otomatis menyeret brand lain; komunikasi krisis dipimpin brand yang terdampak dan PR korporat (lihat [[PR dan Komunikasi Krisis]]).
4. Penamaan sub-produk mengikuti pola brand induknya (misal "RayFlow Order Hub", lini "Ray Beauty Acne Care").

## Membangun Brand Jangka Panjang
- **Konsistensi aset distingtif**: warna, logo, jingle/sonic cue, karakter, format konten yang berulang.
- **Mental availability**: hadir di banyak situasi pemicu pembelian, bukan hanya saat promo.
- **Keseimbangan brand vs performance**: alokasikan porsi budget untuk membangun ingatan, bukan semata konversi jangka pendek (lihat [[Alokasi Budget Marketing]]).
- **Brand health tracking**: awareness, consideration, sentimen, share of search; definisi di [[KPI Dictionary]].
`),

  K('Perencanaan Kampanye Terintegrasi', { divisions: ['mkt', 'studio', 'ecom', 'sales', 'design'], roles: ['marketing', 'campaign', 'brand', 'content'] }, ['kampanye', 'imc', 'campaign-planning', 'brief'], `
# Perencanaan Kampanye Terintegrasi

Kampanye terintegrasi (IMC) berarti satu ide besar dieksekusi konsisten di semua channel, dengan peran tiap channel yang jelas, sehingga hasil keseluruhan lebih besar dari jumlah bagiannya.

## Alur 8 Langkah
1. **Tujuan bisnis**: revenue, jumlah trial, peluncuran produk, atau awareness. Satu tujuan utama saja.
2. **Tujuan marketing dan KPI**: SMART, misalnya "X trial RayFlow dari segmen F&B dalam 6 minggu dengan CAC maksimal Rp Y". Definisi metrik mengacu [[KPI Dictionary]].
3. **Insight audiens**: kebenaran yang dirasakan audiens, bukan fakta produk. Contoh: "Pemilik toko merasa malam harinya habis untuk membalas chat dan rekap pesanan."
4. **Big idea**: satu kalimat kreatif yang bisa diturunkan ke banyak format. Contoh: "Pulang Tepat Waktu" untuk RayFlow.
5. **Peran channel (POEM)**: Paid (iklan menjangkau), Owned (website, sosial, email, WA), Earned (PR, KOL organik, ulasan). Tentukan peran tiap channel di funnel.
6. **Rencana konten dan aset**: daftar aset per channel dan format, mengikuti [[SOP Marketing - Content Pipeline]].
7. **Timeline dan budget**: fase teaser, launch, sustain, dan closing. Cocokkan dengan [[Kalender Kampanye E-commerce]].
8. **Pengukuran**: dasbor, UTM (lihat [[Atribusi, Konvensi UTM, dan Marketing Mix Modeling]]), jadwal review mingguan, dan post-mortem.

## Template Brief Kampanye (1 halaman)
- Nama kampanye, brand, pemilik, periode
- Latar belakang dan masalah bisnis
- Target audiens (segmen dan persona)
- Insight, big idea, key message, reason to believe
- Mandatories: logo, disclaimer, klaim yang diizinkan
- Deliverables per channel
- KPI utama dan pendukung, target angka
- Budget dan pembagian
- Approval yang dibutuhkan (lihat [[Kebijakan Persetujuan]])

## Matriks Channel Contoh (Ray Beauty, peluncuran serum)
| Fase | Paid | Owned | Earned |
|---|---|---|---|
| Teaser | Video awareness TikTok/Meta | Countdown di IG, waitlist WA | Seeding ke KOL mikro |
| Launch | Konversi + Spark Ads konten KOL | Live shopping, email/WA blast ke opt-in | Review KOL, rilis media |
| Sustain | Retargeting, katalog | UGC repost, edukasi | Ulasan pelanggan |

## Checklist Sebelum Go-Live
- Stok, harga, dan voucher sudah dikonfirmasi tim ecom dan finance.
- CS punya FAQ dan skrip kampanye.
- Semua klaim lolos review regulatory (Ray Beauty) sesuai [[Pedoman Klaim Kosmetik]].
- Tracking dan pixel diuji end-to-end.
- Rencana kontinjensi: aset cadangan, batas budget harian, eskalasi bila ada isu.
`),

  K('Strategi Digital Marketing End-to-End', { divisions: ['mkt', 'ecom', 'data'], roles: ['marketing', 'digital', 'growth', 'performance'] }, ['digital-marketing', 'strategi', 'funnel', 'channel'], `
# Strategi Digital Marketing End-to-End

Strategi digital adalah sistem, bukan kumpulan taktik. Kerangka kerja yang dipakai di Ray Group: **Audit → Tujuan → Audiens → Channel → Konten → Konversi → Retensi → Ukur & Optimasi**.

## 1. Audit Situasi
- Aset owned: website (kecepatan, konversi), akun sosial, database email/WA, listing marketplace.
- Performa 3–6 bulan terakhir per channel: biaya, hasil, tren.
- Kompetitor: pesan utama, channel aktif, iklan yang berjalan (gunakan ad library resmi platform).
- SWOT digital singkat.

## 2. Tujuan dan North Star
- RayFlow: north star misalnya jumlah akun berbayar aktif; pendukung: trial, aktivasi.
- Ray Beauty: revenue online dan jumlah pelanggan repeat; pendukung: ROAS, AOV.

## 3. Audiens
Gunakan [[STP Ray Group: Segmentasi, Targeting, Positioning]] dan persona. Untuk setiap persona tentukan platform tempat mereka mencari informasi dan tempat mereka membeli.

## 4. Peran Channel
| Channel | Peran utama | Brand paling cocok |
|---|---|---|
| TikTok | Discovery, social commerce | Ray Beauty |
| Instagram | Brand home, komunitas, Reels | Keduanya |
| SEO/Blog | Demand capture jangka panjang | RayFlow kuat, Ray Beauty edukasi |
| Google Ads Search | Menangkap intent tinggi | RayFlow |
| Meta Ads | Jangkauan dan konversi skala | Keduanya |
| Marketplace ads | Konversi di titik beli | Ray Beauty |
| Email/WhatsApp | Nurture dan retensi | Keduanya |
| KOL/Affiliate | Kepercayaan dan jangkauan niche | Ray Beauty utama |

## 5. Konten
Pilar konten dan kalender editorial (lihat [[Content Marketing dan Kalender Editorial]]). Prinsip: satu ide besar, banyak turunan format (create once, distribute many).

## 6. Konversi
- Landing page spesifik per kampanye, satu CTA utama.
- Kurangi friksi: form pendek, checkout cepat, tombol WhatsApp.
- Bukti sosial di dekat CTA.

## 7. Retensi
Lifecycle flow email/WA, program loyalitas, komunitas. Lihat [[CRM dan Lifecycle Email serta WhatsApp]].

## 8. Ukur dan Optimasi
- Dasbor mingguan: spend, hasil, CAC, ROAS, conversion rate per tahap.
- Ritme: daily check anomali, weekly optimasi taktis, monthly review strategi, quarterly re-planning.
- Formula di [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]].

## Prinsip Kerja
- Kuasai sedikit channel dengan sangat baik sebelum menambah channel baru.
- Owned audience (email, WA, komunitas) adalah aset; follower dan algoritma bukan milik kita.
- Data first-party makin penting karena pelacakan pihak ketiga makin terbatas; verifikasi ke sumber resmi terbaru tentang perubahan privasi platform.
`),

  K('Strategi Instagram: Algoritma, Pilar Konten, Cadence', { divisions: ['mkt', 'studio'], roles: ['social', 'instagram', 'content', 'konten', 'creator', 'digital'] }, ['instagram', 'social-media', 'reels', 'pilar-konten'], `
# Strategi Instagram: Algoritma, Pilar Konten, Cadence

Instagram berfungsi sebagai "rumah brand": tempat orang memvalidasi brand setelah menemukannya di tempat lain, sekaligus tempat membangun komunitas.

## Prinsip Umum Algoritma
Detail algoritma berubah; verifikasi ke sumber resmi terbaru (pernyataan resmi Instagram/Meta). Prinsip yang umum diketahui:
- Tiap permukaan (Feed, Stories, Reels, Explore) memiliki sistem peringkat sendiri.
- Sinyal yang umumnya penting: relevansi minat, hubungan dengan akun (interaksi sebelumnya), watch time dan penyelesaian video, share, save, dan komentar bermakna.
- Share (terutama lewat DM) dan save menunjukkan nilai konten lebih kuat daripada like.
- Konten orisinal lebih diutamakan dibanding repost ulang dengan watermark platform lain.

## Pilar Konten
Tetapkan 4–5 pilar dengan proporsi. Contoh **Ray Beauty**:
1. Edukasi kulit (kandungan, urutan pemakaian, mitos vs fakta)
2. Produk dan cara pakai
3. Behind the scenes pabrik CPKB dan tim R&D
4. Komunitas dan UGC (review pelanggan, repost dengan izin)
5. Hiburan/tren yang relevan

Contoh **RayFlow**:
1. Tips operasional UMKM
2. Demo fitur singkat
3. Cerita pelanggan
4. Insight bisnis dan regulasi praktis
5. Budaya tim dan event

## Format dan Fungsinya
- **Reels**: jangkauan ke non-follower. Lihat [[Craft Short Video: Hook, Struktur, Editing]].
- **Carousel**: edukasi mendalam, mudah di-save.
- **Stories**: kedekatan dengan follower, polling, Q&A, link.
- **Live**: launch, Q&A ahli, kolaborasi.
- **Broadcast channel/DM**: komunikasi langsung ke fans.

## Cadence
Konsistensi lebih penting daripada volume. Pedoman awal: Reels dan carousel beberapa kali per minggu, Stories hampir setiap hari. Sesuaikan dengan kapasitas produksi agar kualitas terjaga; evaluasi dari data insight akun sendiri, bukan angka generik.

## Optimasi Profil
- Bio: siapa kita, untuk siapa, manfaat, CTA.
- Link: landing page atau link-in-bio dengan UTM.
- Highlights: produk, cara pakai, testimoni, FAQ, cara beli.
- Grid tidak perlu sempurna, tapi visual konsisten dengan [[Brand Guidelines]].

## Ritme Kerja Mingguan
- Senin: review insight minggu lalu (reach non-follower, share, save, profile visit, klik link).
- Selasa: finalisasi konten minggu depan sesuai [[SOP Marketing - Content Pipeline]].
- Harian: balas komentar dan DM (lihat [[Community Management Media Sosial]]).
- Jumat: catat pembelajaran, tiga konten terbaik dan terburuk beserta alasan.

## Larangan
- Membeli follower atau engagement.
- Klaim produk yang belum direview (Ray Beauty wajib mengikuti [[Pedoman Klaim Kosmetik]]).
- Memakai musik/aset tanpa hak untuk akun bisnis; gunakan library yang diizinkan untuk akun bisnis.
`),

  K('Strategi TikTok Organik', { divisions: ['mkt', 'studio', 'ecom'], roles: ['tiktok', 'social', 'content', 'konten', 'creator', 'digital'] }, ['tiktok', 'social-media', 'short-video', 'organik'], `
# Strategi TikTok Organik

TikTok adalah mesin discovery: konten bisa menjangkau orang yang belum mengikuti akun. Untuk Ray Beauty, TikTok juga channel penjualan (social commerce). Untuk RayFlow, TikTok berguna untuk edukasi UMKM dan employer branding.

## Prinsip Umum Distribusi
Verifikasi ke sumber resmi terbaru (TikTok Newsroom, Creator Academy). Prinsip yang dikenal luas:
- Rekomendasi For You didasarkan pada interaksi pengguna (tonton sampai habis, tonton ulang, share, komentar, follow), informasi video (caption, suara, hashtag), dan pengaturan perangkat.
- Video diuji ke audiens kecil terlebih dulu; performa awal memengaruhi distribusi lanjutan.
- Retensi menonton, terutama di detik-detik awal, adalah sinyal kuat.
- Jumlah follower tidak menjamin distribusi; setiap video "bersaing" sendiri.

## Positioning Akun
Tentukan satu janji akun yang jelas. Contoh:
- Ray Beauty: "Edukasi skincare jujur dari pabrik sendiri".
- RayFlow: "Trik operasional biar UMKM nggak lembur".

## Pilar dan Format yang Terbukti Umum
| Format | Contoh Ray Beauty | Contoh RayFlow |
|---|---|---|
| Edukasi cepat | "3 kesalahan pakai sunscreen" | "Cara rekap 100 pesanan dalam 5 menit" |
| POV/relatable | "POV: kulit kusam habis begadang" | "POV: admin toko jam 11 malam" |
| Behind the scenes | Proses QC di pabrik | Tim support menjawab pertanyaan |
| Reaksi/duet/stitch | Menanggapi mitos skincare | Menanggapi keluhan UMKM |
| Demo/tutorial | Cara layering | Setup workflow langkah demi langkah |
| Live | Live shopping, Q&A formulator | Live konsultasi otomasi |

## Cadence dan Eksperimen
- Posting rutin dengan volume yang sanggup dijaga kualitasnya; TikTok menghargai iterasi.
- Uji 1 variabel per batch: hook, durasi, talent, format.
- Catat di sheet: hook, durasi, retensi rata-rata, share, komentar, klik keranjang/link.
- Konten pemenang dijadikan template seri dan kandidat Spark Ads (lihat [[TikTok Ads dan Spark Ads]]).

## Social Commerce (Ray Beauty)
- Tag produk di video dan live sesuai fitur yang tersedia; aturan dan fitur TikTok Shop berubah, verifikasi ke sumber resmi terbaru.
- Live terjadwal dengan host terlatih, run-down, promo eksklusif live, dan moderator komentar.
- Kolaborasi dengan affiliate creator (lihat [[Program Affiliate Marketing]]).

## Aturan Wajib
- Gunakan suara/musik dari library komersial untuk akun bisnis.
- Klaim kosmetik mengikuti [[Pedoman Klaim Kosmetik]]; hindari efek filter yang mengubah tampilan kulit pada demo hasil produk.
- Konten berbayar/endorse wajib diberi label sesuai fitur pengungkapan platform.
- Balas komentar dengan nada brand; komentar bisa dijadikan video balasan.
`),

  K('Craft Short Video: Hook, Struktur, Editing', { divisions: ['mkt', 'studio', 'design'], roles: ['content', 'konten', 'creator', 'video', 'tiktok', 'instagram', 'editor'] }, ['short-video', 'reels', 'hook', 'editing'], `
# Craft Short Video: Hook, Struktur, Editing

Short video (Reels, TikTok, Shorts) dinilai penonton dalam hitungan detik. Craft yang baik membuat orang berhenti scroll, bertahan, dan bertindak.

## Anatomi Video 15–60 Detik
1. **Hook (0–3 detik)**: visual + teks + ucapan yang langsung memunculkan rasa ingin tahu atau relevansi.
2. **Setup**: konteks singkat, kenapa ini penting bagi penonton.
3. **Value/payoff bertahap**: inti konten, dibagi menjadi beat pendek.
4. **Proof**: demo, tekstur, hasil (sesuai aturan klaim), testimoni.
5. **CTA**: satu tindakan: save, follow, klik keranjang, komentar kata kunci.

## Tipe Hook
- **Pertanyaan tajam**: "Kenapa sunscreen kamu bikin breakout?"
- **Kontradiksi**: "Berhenti pakai toner kalau kulitmu begini."
- **Angka/daftar**: "3 workflow yang bikin admin toko pulang lebih cepat."
- **POV/relatable**: "POV: dapat 50 chat 'kak ready?' sekaligus."
- **Visual pattern interrupt**: gerakan tak terduga, close-up tekstur, before-after setup (lihat aturan di [[Marketing Kecantikan: Klaim, Before-After, Endorsement Dermatologis]]).
- **Hasil di depan**: tunjukkan output dulu, baru prosesnya.

Lebih banyak pola hook di [[Framework Copywriting: PAS, AIDA, 4U dan Hook]].

## Aturan Editing
- Potong semua jeda dan "eee"; ritme cepat tapi tetap jelas.
- Ganti visual setiap beberapa detik (angle, zoom, B-roll, teks).
- Teks on-screen untuk penonton tanpa suara; letakkan di safe zone (hindari area tombol dan caption UI).
- Subtitle selalu aktif, font sesuai [[Brand Guidelines]].
- Rasio vertikal 9:16, resolusi tinggi, pencahayaan natural untuk produk kulit.
- Musik/suara dari library komersial; volume musik di bawah suara narasi.
- Loop: akhir video yang menyambung ke awal dapat mendorong tonton ulang.

## Checklist Produksi
- [ ] Satu ide per video, bisa dirangkum satu kalimat.
- [ ] Hook diuji 2–3 varian.
- [ ] Talent berbicara seperti teman, bukan membaca iklan.
- [ ] Klaim dan tulisan di layar sudah direview (Ray Beauty: [[Pedoman Klaim Kosmetik]]).
- [ ] Tidak ada filter beauty pada demo hasil skincare.
- [ ] CTA jelas dan sesuai tujuan kampanye.
- [ ] Caption dengan kata kunci yang dicari (search di dalam platform makin penting).
- [ ] File master disimpan untuk diturunkan ke iklan.

## Metrik Evaluasi
- Retensi di detik-detik awal: indikator kekuatan hook.
- Rata-rata durasi tonton dan persentase selesai: kekuatan isi.
- Share dan save: nilai konten.
- Komentar: resonansi dan pertanyaan lanjutan (bahan konten berikutnya).
- Klik/konversi: kekuatan CTA dan penawaran.

Bandingkan antar video milik sendiri untuk menemukan pola, bukan dengan angka benchmark generik.
`),

  K('Community Management Media Sosial', { divisions: ['mkt', 'cs', 'studio'], roles: ['community', 'social', 'admin', 'cs', 'moderator'] }, ['community', 'social-media', 'moderasi', 'engagement'], `
# Community Management Media Sosial

Community management adalah pekerjaan merawat percakapan: membalas, memoderasi, memicu diskusi, dan mengubah follower menjadi komunitas yang loyal dan advokat.

## Tanggung Jawab Inti
1. **Respons**: komentar, DM, mention, dan tag di Instagram, TikTok, dan channel lain.
2. **Moderasi**: menyembunyikan spam, ujaran kebencian, penipuan (akun palsu yang mengaku admin).
3. **Engagement proaktif**: memancing percakapan, membalas dengan konten (video reply), mengapresiasi UGC.
4. **Social listening**: memantau sentimen, keluhan berulang, peluang konten, sinyal krisis.
5. **Eskalasi**: meneruskan isu ke CS, QA, regulatory, atau PR sesuai jenisnya.

## Kategori Pesan dan Penanganan
| Kategori | Contoh | Tindakan |
|---|---|---|
| Pertanyaan produk | "Cocok untuk kulit berminyak?" | Jawab dengan informasi resmi dari [[Produk Ray Beauty]], arahkan ke ahli bila perlu |
| Pertanyaan order | "Paket belum sampai" | Pindahkan ke DM/CS, minta nomor pesanan secara privat |
| Keluhan reaksi kulit | "Muncul kemerahan" | Empati, minta berhenti pemakaian, eskalasi ke CS dan QA, catat sebagai laporan efek tidak diinginkan |
| Pujian/UGC | Review positif | Terima kasih personal, minta izin repost |
| Kritik/negatif | "Harganya kemahalan" | Tanggapi sopan dengan fakta, jangan berdebat |
| Spam/penipuan | Akun palsu promo | Sembunyikan, laporkan, peringatkan komunitas bila masif |
| Sinyal krisis | Tuduhan produk berbahaya, viral | Jangan improvisasi; eskalasi ke [[PR dan Komunikasi Krisis]] |

## Pedoman Nada
- Ikuti suara brand di [[Brand Guidelines]]: Ray Beauty hangat dan edukatif; RayFlow suportif dan solutif.
- Panggil nama, hindari template kaku yang terasa robot.
- Jangan pernah meminta atau menampilkan data pribadi di kolom publik.
- Jangan memberi diagnosis medis; untuk masalah kulit serius sarankan konsultasi dokter.
- Klaim di balasan pun tunduk pada [[Pedoman Klaim Kosmetik]].

## SLA Kerja
Tetapkan SLA internal (misalnya respons pertama pada jam kerja dalam rentang waktu yang disepakati tim) dan tulis di dasbor. Prioritaskan keluhan dan sinyal krisis di atas pertanyaan umum.

## Membangun Komunitas
- Ritual berulang: Q&A mingguan, tantangan rutin, "Skin Diary" pelanggan, atau "Tips Jumat UMKM" untuk RayFlow.
- Grup terkurasi (WhatsApp Community/Telegram) untuk pelanggan setia dan beta tester.
- Program ambassador dari pelanggan paling aktif.
- Tutup loop: tunjukkan bahwa masukan komunitas mengubah produk atau layanan.

## Laporan Mingguan
Volume percakapan, rasio sentimen, topik keluhan teratas, waktu respons, UGC terkumpul, dan ide konten dari komunitas.
`),

  K('Content Marketing dan Kalender Editorial', { divisions: ['mkt', 'studio', 'kms'], roles: ['content', 'konten', 'editor', 'seo', 'copy', 'social'] }, ['content-marketing', 'kalender-editorial', 'perencanaan-konten'], `
# Content Marketing dan Kalender Editorial

Content marketing adalah membuat konten bernilai secara konsisten untuk menarik dan mempertahankan audiens tertentu, sehingga mendorong aksi yang menguntungkan. Kalender editorial adalah alat operasionalnya.

## Strategi Konten dalam 6 Pertanyaan
1. **Untuk siapa?** Persona prioritas (lihat [[Persona Pelanggan UMKM]] untuk RayFlow).
2. **Masalah apa yang kita bantu selesaikan?** Daftar pertanyaan nyata dari CS, sales, komentar, dan riset keyword.
3. **Apa sudut pandang unik kita?** RayFlow: praktik otomasi untuk UMKM Indonesia. Ray Beauty: transparansi dari pabrik sendiri.
4. **Format dan channel apa?** Artikel, video pendek, carousel, newsletter, webinar, e-book.
5. **Apa tujuan tiap konten?** Awareness, consideration, conversion, retention.
6. **Bagaimana mengukurnya?** Metrik per tujuan, bukan satu metrik untuk semua.

## Model Hub–Hero–Help
- **Hero**: konten besar sesekali (kampanye, riset, dokumenter pabrik).
- **Hub**: seri rutin yang membuat orang kembali (misal "Kamis Kandungan", "Workflow of the Week").
- **Help**: konten menjawab pertanyaan yang dicari (SEO, FAQ, tutorial).

## Pillar & Repurposing
Satu konten pilar (misal webinar 45 menit atau artikel panjang) diturunkan menjadi: beberapa klip pendek, carousel, thread, newsletter, kutipan, dan FAQ. Rencanakan turunan sejak brief.

## Struktur Kalender Editorial
Kolom minimal:
| Tanggal | Brand | Pilar | Topik/judul | Format | Channel | Tujuan funnel | Kata kunci | CTA | PIC | Status | Link aset | Approval |

Status mengikuti alur di [[SOP Marketing - Content Pipeline]]: ide → brief → produksi → review → approval → terjadwal → tayang → dievaluasi.

## Ritme Perencanaan
- **Kuartalan**: tema besar, kampanye hero, momen dari [[Kalender Kampanye E-commerce]] (Ramadan, Harbolnas, payday).
- **Bulanan**: daftar topik per pilar dan distribusi format.
- **Mingguan**: finalisasi, produksi batch, slot untuk konten reaktif/tren.
- Sisakan kapasitas untuk konten reaktif; jangan mengisi kalender penuh dengan konten terjadwal.

## Kualitas Konten
- Satu konten, satu ide utama.
- Spesifik dan dapat ditindaklanjuti; sertakan contoh nyata.
- Akurat: fakta diverifikasi, klaim kosmetik sesuai [[Pedoman Klaim Kosmetik]].
- Konsisten dengan [[Brand Guidelines]].

## Evaluasi Bulanan
- Konten top dan bottom per pilar beserta hipotesis penyebab.
- Pilar mana yang perlu ditambah atau dikurangi porsinya.
- Topik baru dari pertanyaan audiens.
- Konten lama yang perlu diperbarui (terutama artikel SEO).
`),

  K('Storytelling Brand Ray Group', { divisions: ['mkt', 'studio', 'design', 'exec'], roles: ['brand', 'content', 'konten', 'copy', 'creator', 'pr'] }, ['storytelling', 'brand', 'narasi', 'konten'], `
# Storytelling Brand Ray Group

Cerita membuat pesan diingat dan dibagikan. Tugas storytelling bukan mengarang, tetapi menyusun kebenaran tentang pelanggan, produk, dan tim menjadi narasi yang menggerakkan.

## Prinsip Utama
- **Pelanggan adalah pahlawan, brand adalah pemandu.** RayFlow bukan pahlawan; pemilik UMKM-lah yang menang. Ray Beauty membantu konsumen merasa nyaman dengan kulitnya.
- **Konflik itu wajib.** Tanpa masalah, tidak ada cerita.
- **Spesifik mengalahkan umum.** "Bu Sari, pemilik katering di Bekasi" lebih kuat daripada "UMKM kuliner".
- **Tunjukkan, jangan hanya katakan.** Gunakan adegan, dialog, detail sensorik.
- **Jujur.** Cerita pelanggan harus nyata dan disetujui; tidak boleh dilebih-lebihkan.

## Kerangka Story Brand (7 bagian)
1. Karakter (pelanggan) yang ingin sesuatu
2. Mengalami masalah (eksternal, internal/perasaan, filosofis)
3. Bertemu pemandu (brand) yang punya empati dan otoritas
4. Yang memberi rencana sederhana
5. Dan mengajak bertindak
6. Agar terhindar dari kegagalan
7. Dan mencapai keberhasilan

Contoh RayFlow: Pemilik toko online (karakter) ingin fokus mengembangkan produk, tetapi tiap malam terjebak rekap pesanan dari tiga marketplace (eksternal) dan merasa bisnisnya mengendalikan dirinya (internal). RayFlow (pemandu) memahami karena tim kami juga mengelola operasional nyata, memberi rencana 3 langkah: hubungkan channel, pilih template workflow, aktifkan notifikasi. CTA: mulai free trial. Gagal: terus lembur dan salah kirim. Berhasil: pulang tepat waktu dan bisnis tumbuh.

## Kerangka Pendek untuk Video
- **Before–After–Bridge**: kondisi sebelum, kondisi sesudah, jembatannya (produk). Untuk Ray Beauty, "after" harus sesuai aturan klaim di [[Marketing Kecantikan: Klaim, Before-After, Endorsement Dermatologis]].
- **Hero's micro-journey**: masalah → titik balik → hasil → pelajaran.
- **Origin story**: kenapa Ray Beauty membangun pabrik CPKB sendiri; kenapa RayFlow dibuat berbahasa Indonesia untuk UMKM.

## Sumber Cerita
- Wawancara pelanggan (rekam dengan izin tertulis).
- Tiket CS dan percakapan sales: masalah nyata dan bahasa pelanggan.
- Tim internal: formulator, QC, engineer, CS.
- Momen milestone perusahaan (lihat [[Profil Perusahaan]]).

## Template Wawancara Studi Kasus
1. Ceritakan bisnis/rutinitas Anda sebelum memakai produk kami.
2. Apa momen paling frustrasi?
3. Apa yang sudah dicoba sebelumnya?
4. Kenapa memilih kami? Apa keraguan awal?
5. Apa yang berubah? (angka bila ada dan bisa diverifikasi)
6. Apa saran untuk orang yang mengalami masalah sama?

Simpan persetujuan publikasi dan versi final yang disetujui pelanggan.
`),

  K('Framework Copywriting: PAS, AIDA, 4U dan Hook', { divisions: ['mkt', 'studio', 'ecom', 'sales'], roles: ['copy', 'content', 'konten', 'ads', 'marketing', 'creator'] }, ['copywriting', 'pas', 'aida', '4u', 'hook'], `
# Framework Copywriting: PAS, AIDA, 4U dan Hook

Framework mempercepat penulisan dan membuat copy lebih konsisten. Pilih sesuai konteks, lalu sunting agar terdengar seperti manusia.

## PAS: Problem – Agitate – Solution
Paling efektif untuk produk penyelesai masalah.
- Problem: "Chat 'kak ready?' numpuk, pesanan terlewat."
- Agitate: "Pelanggan kabur ke toko sebelah, dan kamu masih rekap sampai tengah malam."
- Solution: "RayFlow membalas otomatis dan merekap pesanan dari semua channel. Coba gratis."

## AIDA: Attention – Interest – Desire – Action
Cocok untuk landing page dan iklan panjang.
- Attention: "Kulit kusam setelah begadang?"
- Interest: "Kusam sering terkait lapisan kulit mati dan hidrasi yang kurang."
- Desire: manfaat yang diizinkan, tekstur, bukti, ulasan pelanggan.
- Action: "Checkout sekarang, gratis ongkir hari ini."
Klaim Ray Beauty wajib sesuai [[Pedoman Klaim Kosmetik]].

## 4U untuk Headline
Nilai headline 1–4 pada: **Useful** (bermanfaat), **Urgent** (alasan bertindak sekarang), **Unique** (berbeda), **Ultra-specific** (spesifik). Contoh:
- Lemah: "Solusi Bisnis Anda"
- Kuat: "Rekap Pesanan 3 Marketplace dalam 1 Dasbor, Coba Gratis Minggu Ini"
Urgensi harus jujur; jangan membuat kelangkaan palsu.

## Framework Lain
- **BAB (Before–After–Bridge)**: untuk cerita transformasi.
- **FAB (Feature–Advantage–Benefit)**: menerjemahkan fitur menjadi manfaat. "Integrasi WhatsApp (fitur) → notifikasi otomatis (advantage) → pelanggan tidak menunggu, repeat order naik (benefit; gunakan angka hanya bila terbukti)."
- **4C**: Clear, Concise, Compelling, Credible.

## Bank Pola Hook
1. "Berhenti [kebiasaan] kalau kamu [kondisi]."
2. "[Angka] hal yang [hasil diinginkan] tanpa [pengorbanan]."
3. "Kenapa [masalah umum] terus terjadi? (bukan karena [anggapan umum])"
4. "POV: kamu [situasi relatable]."
5. "Ini yang terjadi kalau [aksi] selama [durasi]." (Ray Beauty: hanya bila sesuai data uji dan aturan klaim)
6. "Saya [peran] dan ini [rahasia/kesalahan] yang jarang dibahas."
7. "Jangan beli [kategori] sebelum cek [kriteria]."
8. "Cara [hasil] dalam [waktu singkat] pakai [alat]."

## Pedoman Bahasa
- Tulis seperti bicara ke satu orang; "kamu" untuk Ray Beauty, "Anda" atau "kamu" sesuai [[Brand Guidelines]] untuk RayFlow.
- Manfaat dulu, fitur kemudian.
- Kalimat pendek, kata kerja aktif, angka spesifik yang dapat dibuktikan.
- Satu CTA utama per materi.
- Hindari superlatif mutlak ("terbaik", "paling ampuh", "100% aman") kecuali ada dasar dan diizinkan.

## Proses
Tulis 10 varian headline/hook → pilih 3 dengan skor 4U tertinggi → uji di iklan atau organik → simpan pemenang di swipe file tim.
`),

  K('SEO Teknis dan On-Page', { divisions: ['mkt', 'eng', 'it'], roles: ['seo', 'content', 'web', 'digital'] }, ['seo', 'technical-seo', 'on-page', 'website'], `
# SEO Teknis dan On-Page

SEO menangkap permintaan yang sudah ada: orang yang sedang mencari solusi. Fondasinya teknis (mesin pencari bisa merayapi dan memahami situs) dan on-page (halaman relevan serta bermanfaat). Pedoman mesin pencari berubah; verifikasi ke sumber resmi terbaru (dokumentasi Google Search Central).

## Checklist SEO Teknis
**Crawling & indexing**
- robots.txt tidak memblokir halaman penting.
- XML sitemap bersih (hanya URL kanonis, status 200) dan didaftarkan di Google Search Console.
- Tag canonical benar untuk halaman duplikat/varian (misal halaman produk dengan parameter filter).
- Noindex untuk halaman tipis: hasil pencarian internal, halaman staging, halaman terima kasih.
- Tidak ada rantai redirect panjang; gunakan redirect permanen untuk URL yang dipindah.
- Periksa laporan coverage/indexing di Search Console secara rutin.

**Performa & pengalaman**
- Pantau Core Web Vitals; optimasi gambar (format modern, ukuran tepat, lazy load), minimalkan JavaScript yang memblokir render.
- Mobile-friendly: mayoritas pengguna Indonesia mengakses lewat ponsel.
- HTTPS di seluruh situs.

**Struktur**
- Arsitektur datar: halaman penting dapat dicapai dalam sedikit klik dari beranda.
- URL deskriptif dan pendek: /blog/cara-rekap-pesanan-otomatis.
- Internal link kontekstual antarhalaman satu topik (lihat [[Riset Keyword dan Content Cluster]]).
- Structured data sesuai jenis halaman: Organization, Product, FAQ, Article, SoftwareApplication, LocalBusiness. Validasi dengan tool resmi.
- Bila situs multibahasa, gunakan hreflang dengan benar.

## Checklist On-Page per Halaman
- [ ] Satu keyword utama + variasi terkait; intent pencarian dipahami (informasional, komersial, transaksional, navigasional).
- [ ] Title tag unik, memuat keyword di awal, menarik diklik.
- [ ] Meta description ringkas dengan manfaat dan CTA.
- [ ] Satu H1 yang jelas; H2/H3 menyusun struktur logis.
- [ ] Paragraf pembuka langsung menjawab pertanyaan.
- [ ] Konten lebih lengkap dan lebih praktis daripada halaman yang sudah ranking, dengan pengalaman nyata (contoh, screenshot, data internal yang boleh dibagikan).
- [ ] Gambar dengan nama file dan alt text deskriptif.
- [ ] Internal link ke halaman pilar dan halaman konversi; external link ke sumber kredibel.
- [ ] Penulis dan tanggal pembaruan terlihat (sinyal E-E-A-T).
- [ ] CTA relevan: free trial RayFlow, atau produk terkait Ray Beauty.

## Khusus Ray Beauty
Halaman produk: deskripsi orisinal (bukan salinan marketplace), daftar kandungan, cara pakai, nomor notifikasi BPOM, FAQ. Semua klaim mengikuti [[Pedoman Klaim Kosmetik]]; artikel edukasi kulit tidak boleh memuat klaim pengobatan.

## Khusus RayFlow
Halaman fitur, halaman per industri (F&B, retail, jasa), halaman integrasi, halaman perbandingan dengan alternatif (fair dan faktual), serta template/alat gratis sebagai magnet tautan.

## Monitoring Bulanan
Klik dan impresi organik, posisi keyword prioritas, halaman yang turun, error indexing, konversi dari organik. Definisi metrik di [[KPI Dictionary]].
`),

  K('Riset Keyword dan Content Cluster', { divisions: ['mkt', 'kms'], roles: ['seo', 'content', 'konten', 'editor', 'digital'] }, ['seo', 'keyword-research', 'content-cluster', 'topical-authority'], `
# Riset Keyword dan Content Cluster

Riset keyword memastikan kita menulis yang dicari orang; content cluster memastikan situs dipandang otoritatif pada suatu topik.

## Langkah Riset Keyword
1. **Seed keyword** dari pemahaman bisnis: RayFlow ("otomasi pesanan", "aplikasi kasir", "rekap pesanan marketplace", "CRM UMKM"); Ray Beauty ("serum untuk kulit kusam", "sunscreen kulit berminyak", "skincare lokal BPOM").
2. **Sumber ide**: pertanyaan pelanggan dari CS dan sales, autocomplete dan "orang juga bertanya" di mesin pencari, Google Search Console (query yang sudah memberi impresi), Keyword Planner, tools SEO pihak ketiga, forum dan komentar TikTok.
3. **Klasifikasi intent**:
   - Informasional: "cara membuat SOP gudang"
   - Komersial: "aplikasi manajemen pesanan terbaik untuk UMKM"
   - Transaksional: "harga RayFlow", "beli serum niacinamide"
   - Navigasional: "login RayFlow"
4. **Prioritas** dengan skor: volume relatif, kesulitan, relevansi bisnis (seberapa dekat ke produk), dan peluang (SERP lemah atau ketinggalan zaman). Relevansi bisnis diberi bobot terbesar.
5. **Analisis SERP**: lihat jenis halaman yang ranking (artikel, halaman produk, video). Sesuaikan format dengan yang diinginkan mesin pencari untuk query itu.

## Model Content Cluster
- **Pillar page**: halaman komprehensif untuk topik luas.
- **Cluster pages**: artikel spesifik yang menjawab subtopik.
- **Internal link**: setiap cluster menautkan ke pillar dan sebaliknya, serta antarcluster yang relevan.

## Contoh Cluster RayFlow
Pillar: "Panduan Otomasi Operasional UMKM"
- Cara rekap pesanan dari banyak marketplace
- Template balasan otomatis WhatsApp untuk toko online
- Cara membuat SOP order fulfillment
- Menghitung waktu yang hilang karena kerja manual
- Checklist memilih software otomasi
Halaman konversi: halaman fitur dan free trial.

## Contoh Cluster Ray Beauty
Pillar: "Panduan Skincare untuk Kulit Berminyak"
- Urutan skincare pagi dan malam
- Cara memilih sunscreen untuk kulit berminyak
- Mengenal niacinamide: cara pakai dan kombinasi
- Mitos dan fakta tentang pori-pori
Halaman konversi: halaman produk terkait. Klaim mengikuti [[Pedoman Klaim Kosmetik]].

## Brief SEO untuk Penulis
- Keyword utama, keyword sekunder, intent
- Judul kerja dan struktur H2/H3 yang disarankan
- Pertanyaan yang wajib dijawab
- Sudut pandang unik/pengalaman Ray Group
- Internal link wajib (pillar, produk, cluster terkait)
- CTA
- Panjang menyesuaikan kebutuhan topik, bukan target kata

## Pemeliharaan
- Audit konten tiap kuartal: perbarui, gabungkan artikel yang saling bersaing untuk keyword sama (kanibalisasi), atau hapus/redirect artikel tipis.
- Lacak posisi cluster sebagai kelompok, bukan hanya keyword tunggal.
- Integrasikan ke kalender di [[Content Marketing dan Kalender Editorial]].
`),

  K('Local SEO dan Google Business Profile', { divisions: ['mkt', 'retail', 'sales'], roles: ['seo', 'local', 'retail', 'digital', 'marketing'] }, ['local-seo', 'google-business-profile', 'maps', 'ulasan'], `
# Local SEO dan Google Business Profile

Local SEO membuat bisnis muncul saat orang mencari dengan intent lokal ("toko skincare dekat saya", "konsultan software kasir Bandung") di Google Search dan Maps. Relevan untuk Ray Beauty (toko/booth offline, pabrik untuk kunjungan) dan kantor RayFlow, serta sangat relevan bagi pelanggan UMKM RayFlow (bisa menjadi konten edukasi).

## Faktor Utama (prinsip umum)
Google menyebut tiga faktor peringkat lokal: **relevansi**, **jarak**, dan **keunggulan/prominence**. Verifikasi ke sumber resmi terbaru (bantuan Google Business Profile).

## Checklist Google Business Profile (GBP)
- [ ] Profil diklaim dan diverifikasi oleh akun perusahaan (bukan akun pribadi karyawan).
- [ ] Nama bisnis sesuai nama nyata, tanpa sisipan keyword (melanggar pedoman).
- [ ] Kategori utama paling tepat, kategori tambahan relevan.
- [ ] Alamat, area layanan, jam buka (termasuk jam khusus hari libur dan Ramadan).
- [ ] Nomor telepon/WhatsApp bisnis dan link website dengan UTM (lihat [[Atribusi, Konvensi UTM, dan Marketing Mix Modeling]]).
- [ ] Deskripsi bisnis sesuai [[Brand Guidelines]].
- [ ] Foto asli: eksterior, interior, produk, tim; diperbarui berkala.
- [ ] Produk/layanan diisi dengan deskripsi dan harga bila relevan.
- [ ] Postingan update rutin: promo, event, produk baru.
- [ ] Q&A dipantau; jawab pertanyaan umum secara proaktif.

## Konsistensi NAP
Name, Address, Phone harus identik di website, GBP, marketplace, direktori bisnis, dan media sosial. Ketidakkonsistenan membingungkan mesin pencari dan pelanggan.

## Strategi Ulasan
- Minta ulasan setelah pengalaman positif (setelah transaksi offline, setelah onboarding RayFlow berhasil) lewat link langsung.
- Jangan memberi imbalan untuk ulasan dan jangan memfilter hanya pelanggan puas (review gating); praktik ini umumnya melanggar kebijakan platform.
- Balas semua ulasan: ucapkan terima kasih secara spesifik; untuk ulasan negatif, akui, minta maaf bila sesuai, pindahkan detail ke channel privat, tindak lanjuti.
- Laporkan ulasan palsu lewat mekanisme resmi; jangan membalas dengan emosi.

## Website untuk Lokal
- Halaman lokasi per toko/kantor dengan alamat, peta tertanam, jam buka, dan structured data LocalBusiness.
- Konten lokal: event komunitas UMKM di kota tertentu, kerja sama dengan pelaku lokal.
- Backlink lokal: media lokal, asosiasi UMKM, kampus, komunitas.

## Metrik
Tampilan profil, pencarian langsung vs discovery, permintaan rute, klik telepon/website, jumlah dan rata-rata rating ulasan, serta kecepatan balasan ulasan.

## Konten Edukasi untuk Pelanggan RayFlow
Checklist di atas dapat diolah menjadi panduan atau webinar "Biar Toko Kamu Muncul di Google Maps", sejalan dengan strategi content-led di [[B2B SaaS Marketing RayFlow]].
`),

  K('Struktur Kampanye Meta Ads', { divisions: ['mkt', 'ecom'], roles: ['ads', 'performance', 'meta', 'digital', 'paid'] }, ['meta-ads', 'facebook-ads', 'instagram-ads', 'paid-social'], `
# Struktur Kampanye Meta Ads

Meta Ads (Facebook, Instagram, Messenger, Audience Network) disusun dalam tiga level: **Campaign → Ad Set → Ad**. Fitur, nama objective, dan rekomendasi struktur sering berubah; verifikasi ke sumber resmi terbaru (Meta Business Help Center).

## Level dan Keputusan
| Level | Yang diatur | Catatan |
|---|---|---|
| Campaign | Objective (awareness, traffic, engagement, leads, app promotion, sales), budget bila memakai budget di level kampanye | Objective menentukan cara sistem mengoptimasi |
| Ad Set | Audiens, penempatan, jadwal, event optimasi, budget bila di level ad set | Satu hipotesis audiens per ad set |
| Ad | Kreatif, copy, CTA, URL dengan UTM | Variasi kreatif diuji di sini |

## Prasyarat Tracking
- Pixel dan Conversions API terpasang, event standar (ViewContent, AddToCart, Purchase, Lead) terkirim dengan nilai.
- Domain terverifikasi dan prioritas event diatur sesuai ketentuan terbaru.
- Uji event sebelum kampanye; kualitas pencocokan event dipantau.
- Untuk RayFlow, kirim event lead berkualitas (misal trial yang teraktivasi) bila memungkinkan, agar sistem belajar mencari prospek bernilai, bukan sekadar pengisi form.

## Struktur yang Disarankan (prinsip)
Sistem pengiriman iklan modern bekerja lebih baik dengan data terkonsolidasi:
- **Prospecting**: audiens luas atau berbasis minat luas dan lookalike, dengan banyak variasi kreatif. Opsi otomatis seperti Advantage+ layak diuji.
- **Retargeting**: pengunjung situs, add-to-cart tanpa beli, engager IG/FB, penonton video. Gunakan pesan berbeda (bukti sosial, penawaran, menjawab keberatan).
- **Retention**: pelanggan lama (custom audience dari CRM, sesuai izin dan aturan privasi) untuk cross-sell/repeat.
Hindari memecah terlalu banyak ad set kecil yang saling bersaing dan tidak keluar dari fase pembelajaran.

## Kreatif adalah Targeting Baru
- Siapkan beberapa konsep berbeda (bukan sekadar ganti warna): UGC testimoni, demo, problem-solution, founder/formulator, perbandingan.
- Format vertikal untuk Reels/Stories, plus format feed.
- Hook kuat di detik awal (lihat [[Craft Short Video: Hook, Struktur, Editing]]).
- Ray Beauty: kategori kosmetik dan klaim tunduk pada kebijakan iklan Meta dan [[Pedoman Klaim Kosmetik]]; hindari konten yang menyiratkan atribut pribadi ("Kamu punya jerawat?") yang dapat melanggar kebijakan.

## Konvensi Penamaan
Campaign: BRAND_OBJ_FUNNEL_PRODUK_YYMM (contoh: RB_SALES_TOF_SERUMBRIGHT_2611)
Ad Set: AUDIENS_PLACEMENT_OPT (contoh: BROAD-F18-34_ADV_PURCHASE)
Ad: KONSEP_FORMAT_HOOK_VERSI (contoh: UGCTESTI_9x16_HOOKKUSAM_V2)

## Rutinitas Optimasi
- Harian: cek pengeluaran, anomali, penolakan iklan.
- Jangan mengubah ad set terlalu sering; perubahan besar dapat mengulang fase pembelajaran.
- Mingguan: matikan kreatif yang jelas kalah, tambah kreatif baru, skalakan pemenang bertahap.
- Pantau frekuensi dan penurunan CTR sebagai tanda creative fatigue.
- Evaluasi dengan metrik bisnis (CAC, ROAS bersih) dari [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]], tidak hanya angka di dalam platform.

## Approval
Budget dan kreatif mengikuti batas di [[Kebijakan Persetujuan]].
`),

  K('TikTok Ads dan Spark Ads', { divisions: ['mkt', 'ecom', 'studio'], roles: ['ads', 'tiktok', 'performance', 'digital', 'paid'] }, ['tiktok-ads', 'spark-ads', 'paid-social', 'short-video'], `
# TikTok Ads dan Spark Ads

TikTok Ads paling efektif bila iklannya terasa seperti konten TikTok asli. Struktur dan fitur (termasuk iklan untuk TikTok Shop) berubah cepat; verifikasi ke sumber resmi terbaru (TikTok Ads Manager Help Center dan TikTok Shop Seller Center).

## Struktur Dasar
**Campaign** (objective: reach, traffic, video views, community interaction, lead generation, app promotion, website conversion, product sales) → **Ad Group** (audiens, penempatan, budget, jadwal, event optimasi, bidding) → **Ad** (video, teks, CTA, identitas).

## Prasyarat
- TikTok Pixel dan Events API terpasang dengan event sesuai funnel.
- Katalog produk tersinkron untuk Ray Beauty bila memakai iklan katalog/shop.
- Identitas akun brand terhubung untuk Spark Ads.

## Spark Ads
Spark Ads mempromosikan postingan organik (milik brand atau kreator dengan izin kode otorisasi) sehingga engagement terkumpul di postingan asli dan iklan tampil dengan identitas kreator.
- Alur: kreator memposting → membuat kode otorisasi untuk durasi yang disepakati → brand memasukkan kode di Ads Manager.
- Masukkan hak penggunaan Spark Ads, durasi, dan pengungkapan iklan ke kontrak KOL (lihat [[KOL dan Influencer Marketing: Tier, Brief, Kontrak, Pengukuran]]).
- Pilih konten organik yang sudah terbukti punya retensi dan komentar positif.

## Prinsip Kreatif TikTok
- **Native**: direkam dengan ponsel, wajah manusia, bahasa sehari-hari, tren dan suara yang tersedia untuk iklan komersial.
- **Hook di detik awal** dengan teks dan ucapan sekaligus.
- **Demo produk nyata**: tekstur, cara pakai, unboxing; untuk RayFlow: layar dasbor dan "sebelum vs sesudah" alur kerja.
- **Banyak variasi**: kreatif di TikTok lebih cepat lelah dibanding banyak platform lain; siapkan pipeline produksi rutin.
- **Modular**: rekam beberapa hook, beberapa isi, beberapa CTA lalu kombinasikan.
- Ray Beauty: tanpa filter kecantikan pada demo hasil; klaim sesuai [[Pedoman Klaim Kosmetik]] dan kebijakan iklan kosmetik TikTok.

## Matriks Pengujian
| Variabel | Contoh varian |
|---|---|
| Hook | Pertanyaan, POV, hasil di depan, kontradiksi |
| Talent | Kreator mikro, karyawan/formulator, pelanggan |
| Format | Talking head, green screen, demo, sketsa |
| Penawaran | Bundle, gratis ongkir, voucher live |

Uji satu variabel utama per putaran agar pembelajaran jelas (lihat [[Bidding, Creative Testing, dan Pengukuran Iklan]]).

## Konvensi dan Ritme
- Penamaan mengikuti pola yang sama dengan [[Struktur Kampanye Meta Ads]] dengan prefix TT.
- Review harian untuk spend dan penolakan; review kreatif dua kali seminggu; refresh kreatif begitu metrik hook dan CTR menurun konsisten.
- Bandingkan hasil di platform dengan data penjualan aktual (marketplace/website) karena atribusi tiap platform cenderung menghitung dengan caranya sendiri.

## RayFlow di TikTok
Gunakan untuk awareness dan lead UMKM dengan konten edukatif ("cara balas 100 chat otomatis"). Arahkan ke landing page singkat atau lead form, lalu nurture lewat WhatsApp.
`),

  K('Google Ads: Search dan Performance Max', { divisions: ['mkt', 'ecom'], roles: ['ads', 'google', 'sem', 'performance', 'digital', 'paid'] }, ['google-ads', 'search-ads', 'pmax', 'sem'], `
# Google Ads: Search dan Performance Max

Google Ads Search menangkap intent yang sudah ada; Performance Max (PMax) memakai otomatisasi untuk menjangkau inventaris Google (Search, YouTube, Display, Discover, Gmail, Maps) dari satu kampanye. Fitur dan opsi kontrol PMax terus berubah; verifikasi ke sumber resmi terbaru (Google Ads Help).

## Search Campaign
**Struktur**: Campaign (budget, bidding, lokasi, bahasa) → Ad Group (tema keyword rapat) → Keyword + Responsive Search Ads.

**Keyword untuk RayFlow**
- Problem-aware: "cara rekap pesanan online otomatis"
- Solution-aware: "software manajemen pesanan UMKM", "aplikasi otomasi WhatsApp bisnis"
- Brand: "RayFlow", "RayFlow harga"
- Kompetitor: hanya bila sesuai kebijakan merek dagang dan strategi; pisahkan kampanyenya.

**Match type**: exact dan phrase untuk kontrol; broad match bekerja lebih baik bila dipadukan dengan bidding otomatis dan data konversi yang cukup. Uji secara terkontrol.

**Negative keyword**: "gratis selamanya", "lowongan", "crack", "pdf", "pengertian" (bila tidak ingin trafik informasional) dan pantau laporan search terms tiap minggu.

**Responsive Search Ads**
- Banyak headline unik: manfaat, fitur, bukti, penawaran, CTA, keyword.
- Description menjawab keberatan (setup cepat, bahasa Indonesia, dukungan lokal).
- Asset/extension: sitelink (Harga, Demo, Fitur, Studi Kasus), callout, structured snippet, call, lead form bila relevan.

**Landing page**: sesuai keyword (message match), cepat, satu CTA (mulai trial/booking demo).

## Performance Max
Cocok untuk Ray Beauty (dengan feed produk Merchant Center) dan untuk RayFlow bila data konversi sudah cukup kuat.
- **Asset group** per tema/produk: teks, gambar, logo, video (sediakan video sendiri agar sistem tidak membuat otomatis dengan kualitas rendah).
- **Audience signals**: data pelanggan, segmen kustom berbasis keyword pencarian, pengunjung situs. Ini sinyal, bukan batas targeting.
- **Feed produk**: judul dan deskripsi produk yang baik, gambar bersih, harga dan stok akurat.
- Gunakan pengecualian brand dan negatif yang tersedia sesuai fitur terbaru untuk menjaga kampanye brand terpisah.
- Evaluasi dengan insight yang tersedia dan dampak inkremental terhadap total penjualan, bukan hanya laporan PMax.

## Tracking dan Bidding
- Konversi utama terpasang via Google Tag/GA4 atau impor offline (untuk RayFlow: trial teraktivasi atau deal dari CRM).
- Enhanced conversions sesuai kebijakan privasi.
- Strategi bidding: mulai Maximize Conversions/Clicks saat data sedikit; pindah ke Target CPA/ROAS setelah konversi cukup stabil. Detail di [[Bidding, Creative Testing, dan Pengukuran Iklan]].
- Nilai konversi mencerminkan nilai bisnis (misal trial dari segmen ICP diberi nilai lebih tinggi, lihat [[Ideal Customer Profile]]).

## Ritme
Mingguan: search terms, negatif baru, performa asset, budget pacing. Bulanan: struktur, landing page test, review CAC terhadap target di [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]].
`),

  K('Bidding, Creative Testing, dan Pengukuran Iklan', { divisions: ['mkt', 'ecom', 'data'], roles: ['ads', 'performance', 'paid', 'digital', 'analyst'] }, ['bidding', 'creative-testing', 'pengukuran', 'paid-ads'], `
# Bidding, Creative Testing, dan Pengukuran Iklan

Tiga keterampilan inti performance marketer: memberi sistem iklan sinyal dan batas yang tepat (bidding), menemukan kreatif pemenang secara sistematis (testing), dan mengukur dampak bisnis yang sebenarnya (measurement).

## Bidding
**Jenis umum** (nama berbeda per platform; verifikasi ke sumber resmi terbaru):
- **Lowest cost / maximize**: sistem mencari hasil sebanyak mungkin dalam budget. Cocok untuk awal dan untuk eksplorasi.
- **Cost cap / target CPA**: menjaga rata-rata biaya per hasil di sekitar target. Risiko: under-delivery bila target terlalu rendah.
- **Bid cap**: batas tawaran per lelang; kontrol tinggi, butuh keahlian.
- **Target ROAS / value-based**: mengoptimasi nilai konversi; butuh data nilai akurat.

**Pedoman**
- Sistem otomatis butuh volume konversi yang cukup; bila sedikit, optimasi ke event yang lebih atas di funnel (misal add-to-cart) sementara.
- Tetapkan target dari unit economics: target CPA maksimal = nilai kontribusi yang bisa ditoleransi per pelanggan (lihat [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]]).
- Naikkan budget bertahap dan beri waktu sistem menyesuaikan.

## Creative Testing
1. **Hipotesis tertulis**: "Hook berbasis POV admin toko akan menaikkan hook rate dibanding hook berbasis fitur."
2. **Satu variabel utama** per uji: konsep, hook, talent, format, atau penawaran.
3. **Struktur**: ad set/campaign uji terpisah dengan budget tetap, atau fitur A/B test resmi platform untuk hasil lebih bersih.
4. **Metrik per tahap**:
   - Hook rate = view 3 detik ÷ impresi (indikasi awal)
   - Hold rate = view lebih lama ÷ view 3 detik
   - CTR (link) = klik link ÷ impresi
   - CVR = konversi ÷ klik
   - CPA dan ROAS
5. **Kriteria keputusan** ditentukan sebelum uji: minimal pengeluaran atau jumlah konversi tertentu sebelum memutuskan.
6. **Dokumentasi** di creative log: hipotesis, varian, hasil, pembelajaran, keputusan.

Statistik uji di [[A/B Testing dan Statistik Eksperimen]].

## Pengukuran
**Masalah umum**: tiap platform mengklaim konversi yang sama (double counting), jendela atribusi berbeda, dan pelacakan berkurang karena privasi.

**Lapisan pengukuran**
1. **Platform reporting**: untuk optimasi taktis harian.
2. **Analytics (GA4) + UTM**: perbandingan lintas channel dengan aturan yang konsisten (lihat [[Atribusi, Konvensi UTM, dan Marketing Mix Modeling]]).
3. **Data bisnis**: penjualan aktual marketplace/website, pelanggan berbayar RayFlow di CRM. Ini kebenaran akhir.
4. **MER (Marketing Efficiency Ratio)** = total revenue ÷ total biaya marketing, sebagai pengecek kesehatan keseluruhan.
5. **Uji inkrementalitas**: conversion lift resmi platform, geo-holdout (matikan iklan di wilayah tertentu), atau on/off test terencana.

## Laporan Mingguan Paid
- Spend vs plan, hasil, CPA/ROAS platform vs ROAS terverifikasi.
- Kreatif top 3 dan bottom 3 dengan alasan.
- Pembelajaran dan rencana uji minggu depan.
- Risiko: penolakan iklan, stok, kenaikan biaya lelang musiman (misal menjelang Harbolnas).
`),

  K('KOL dan Influencer Marketing: Tier, Brief, Kontrak, Pengukuran', { divisions: ['mkt', 'studio', 'legal', 'ecom'], roles: ['kol', 'influencer', 'creator', 'partnership', 'social', 'marketing'] }, ['kol', 'influencer', 'brief', 'kontrak'], `
# KOL dan Influencer Marketing: Tier, Brief, Kontrak, Pengukuran

KOL (Key Opinion Leader) meminjamkan kepercayaan audiensnya ke brand. Untuk Ray Beauty, KOL adalah channel utama; untuk RayFlow, KOL berupa praktisi UMKM, mentor bisnis, dan kreator edukasi.

## Tier KOL
Batas jumlah follower antar-tier tidak baku; tetapkan definisi internal dan catat di [[KPI Dictionary]].
| Tier | Kekuatan | Penggunaan |
|---|---|---|
| Nano | Kedekatan tinggi, biaya rendah | Seeding massal, UGC, ulasan |
| Mikro | Niche dan kredibel | Edukasi, konversi, affiliate |
| Mid-tier | Seimbang jangkauan dan kepercayaan | Peluncuran, live |
| Makro | Jangkauan besar | Awareness kampanye besar |
| Mega/selebriti | Sangat besar, mahal | Momen hero, ambassador |
| Expert (dokter, formulator, praktisi) | Otoritas | Edukasi; ikuti aturan di [[Marketing Kecantikan: Klaim, Before-After, Endorsement Dermatologis]] |

Strategi umum: piramida, banyak nano/mikro untuk volume dan kepercayaan, sedikit makro untuk jangkauan.

## Seleksi (scorecard)
- Kecocokan audiens (usia, lokasi, minat) berdasarkan insight yang diminta dari kreator.
- Kualitas engagement: komentar bermakna, bukan sekadar emoji; cek pola pertumbuhan follower yang tidak wajar.
- Kecocokan nilai dan nada dengan [[Brand Guidelines]].
- Rekam jejak: kontroversi, endorse brand kompetitor yang baru saja, klaim berlebihan.
- Kualitas konten dan kemampuan menjual (riwayat live/affiliate).

## Brief KOL
1. Latar belakang brand dan produk (link [[Produk Ray Beauty]])
2. Tujuan konten dan KPI
3. Key message (maksimal 3) dan pesan yang dilarang
4. Klaim yang diizinkan, kata yang dilarang (sesuai [[Pedoman Klaim Kosmetik]])
5. Mandatories: penyebutan nama produk, tag akun, kode voucher, label iklan/paid partnership
6. Kebebasan kreatif: format bebas selama sesuai aturan; jangan membuat skrip kaku
7. Timeline: kirim draft, revisi, tayang
8. Do and don't: tanpa filter kecantikan saat menunjukkan hasil, tanpa membandingkan merendahkan brand lain

## Kontrak (poin wajib)
- Deliverables rinci (jumlah, format, platform, durasi tayang minimal)
- Jadwal dan proses approval draft
- Fee, termin pembayaran, pajak
- Hak penggunaan konten: durasi, channel, whitelisting/Spark Ads/partnership ads
- Eksklusivitas kategori dan periode
- Kewajiban pengungkapan iklan
- Kepatuhan klaim dan hak brand meminta revisi/takedown
- Klausul moral dan pembatalan
- Kerahasiaan dan pelindungan data
Kontrak ditinjau legal dan disetujui sesuai [[Kebijakan Persetujuan]].

## Pengukuran
- Jangkauan dan views, engagement rate, komentar sentimen
- Klik (link ber-UTM) dan penggunaan kode voucher unik per KOL
- Penjualan terlacak (affiliate link, kode)
- CPM, CPE, CPA efektif = biaya total ÷ hasil
- Nilai konten: performa saat dipakai sebagai iklan
- Kenaikan pencarian brand dan follower selama periode kampanye

Simpan semua data di database KOL untuk keputusan re-booking.
`),

  K('Program Affiliate Marketing', { divisions: ['mkt', 'ecom', 'sales', 'fin'], roles: ['affiliate', 'kol', 'creator', 'partnership', 'marketplace', 'ecommerce'] }, ['affiliate', 'komisi', 'social-commerce', 'partnership'], `
# Program Affiliate Marketing

Affiliate marketing membayar mitra berdasarkan hasil (biasanya penjualan). Untuk Ray Beauty, affiliate kreator di TikTok Shop dan program affiliate marketplace adalah mesin penjualan penting. Untuk RayFlow, model yang relevan adalah program referral/partner (konsultan, agensi, komunitas UMKM) dengan komisi dari langganan.

## Jenis Program
| Model | Contoh | Catatan |
|---|---|---|
| Affiliate platform | TikTok Shop affiliate, program affiliate marketplace | Aturan, komisi minimal, dan fitur berubah: verifikasi ke sumber resmi terbaru |
| Affiliate website sendiri | Link/kode unik via software affiliate | Kontrol penuh, butuh pengelolaan |
| Referral pelanggan | Pelanggan mengajak teman, keduanya dapat benefit | Cocok untuk keduanya |
| Partner/reseller B2B | Konsultan yang menjual RayFlow | Komisi berulang atau sekali, plus enablement |

## Merancang Struktur Komisi
1. Hitung margin kontribusi per order setelah COGS, biaya platform, ongkir subsidi, dan diskon.
2. Tentukan komisi maksimal yang masih memenuhi target profit; bandingkan dengan CAC channel lain.
3. Diferensiasi: komisi lebih tinggi untuk produk hero atau produk baru, lebih rendah untuk produk bermargin tipis.
4. Tier performa: komisi naik setelah mencapai ambang penjualan tertentu; bonus kampanye musiman.
5. RayFlow: komisi dari pembayaran langganan dengan periode clawback bila pelanggan refund/churn cepat.
Semua skema dikonsultasikan dengan finance dan mengikuti [[Pricing]].

## Rekrutmen dan Aktivasi
- Sumber: pelanggan setia, KOL nano/mikro, kreator yang sudah membahas kategori, komunitas.
- Onboarding kit: profil brand, daftar produk dan USP, klaim yang diizinkan sesuai [[Pedoman Klaim Kosmetik]], contoh konten terbaik, jadwal promo.
- Sampel produk gratis untuk affiliate terpilih (bukan untuk semua pendaftar).
- Grup komunikasi affiliate: info promo, brief mingguan, leaderboard.

## Manajemen Kualitas
- Larangan: klaim berlebihan, filter pada hasil kulit, menyamar sebagai ulasan independen tanpa pengungkapan, spam, bidding iklan pada keyword brand tanpa izin.
- Pantau konten affiliate secara berkala; sistem teguran dan pemutusan.
- Lindungi harga: affiliate tidak boleh memberi diskon di luar skema resmi yang mengganggu reseller.

## Metrik
- Jumlah affiliate aktif (yang memposting/menjual dalam periode)
- GMV dan order dari affiliate, AOV
- Komisi sebagai persentase revenue affiliate
- Revenue per affiliate aktif, distribusi (biasanya terkonsentrasi pada sedikit mitra)
- Refund/retur rate per affiliate
- Untuk RayFlow: trial dan pelanggan berbayar dari partner, retensi pelanggan referral

## Ritme
Mingguan: leaderboard, brief konten, stok produk hero. Bulanan: review komisi, pembayaran tepat waktu, rekrutmen gelombang baru. Selaraskan dengan [[Kalender Kampanye E-commerce]] dan [[Playbook Kampanye Ramadan dan Harbolnas]].
`),

  K('CRM dan Lifecycle Email serta WhatsApp', { divisions: ['mkt', 'cs', 'sales', 'ecom'], roles: ['crm', 'email', 'whatsapp', 'retention', 'lifecycle', 'marketing'] }, ['crm', 'email-marketing', 'whatsapp', 'segmentasi', 'lifecycle'], `
# CRM dan Lifecycle Email serta WhatsApp

CRM marketing mengubah pembeli satu kali menjadi pelanggan berulang, dan trial menjadi pelanggan berbayar. Channel utama di Indonesia: WhatsApp (respons tinggi, personal) dan email (murah, kaya konten, cocok untuk B2B).

## Fondasi Kepatuhan
- Kumpulkan **persetujuan (opt-in)** yang jelas untuk komunikasi marketing; catat waktu dan sumbernya.
- Ikuti UU Pelindungan Data Pribadi (UU 27/2022): tujuan jelas, minimal data, keamanan, hak pelanggan untuk berhenti.
- WhatsApp Business Platform: pesan yang dikirim di luar jendela percakapan memakai template yang disetujui; kategori template dan biaya berubah, verifikasi ke sumber resmi terbaru.
- Selalu sediakan cara berhenti berlangganan; hormati segera.

## Segmentasi
- **RFM** (Recency, Frequency, Monetary) untuk Ray Beauty: Champions, Loyal, Potential, At Risk, Hibernating, New.
- **Lifecycle stage**: lead, trial, aktif, at-risk, churn, win-back.
- **Perilaku**: produk dibeli, jenis kulit (bila dikumpulkan dengan izin), channel beli, respons promo.
- **Firmografis untuk RayFlow**: industri, jumlah cabang, paket, fitur yang dipakai.

## Flow Lifecycle Ray Beauty
1. **Welcome**: terima kasih, cerita brand, edukasi cara pakai, insentif pembelian pertama.
2. **Abandoned cart/browse**: pengingat ramah, jawab keberatan (ulasan, cara pakai), insentif bila perlu.
3. **Post-purchase**: konfirmasi, cara pakai, cek kecocokan setelah beberapa hari, permintaan ulasan.
4. **Replenishment**: pengingat beli ulang berdasarkan perkiraan durasi pemakaian ukuran produk.
5. **Cross-sell**: produk pelengkap rutinitas.
6. **Win-back**: pelanggan tidak beli dalam periode tertentu; tanyakan alasan, beri penawaran.
7. **VIP**: akses awal produk baru, hadiah ulang tahun.

## Flow Lifecycle RayFlow
1. **Trial onboarding**: hari 0 sambutan dan satu langkah pertama; hari-hari berikutnya dipicu perilaku (belum menghubungkan channel → panduan; sudah aktivasi → fitur lanjutan).
2. **Trial ending**: ringkasan nilai yang sudah didapat, pilihan paket, tawaran bantuan sales.
3. **Onboarding pelanggan berbayar**: checklist adopsi, webinar pelatihan.
4. **Adopsi & expansion**: fitur yang belum dipakai, upgrade saat batas paket mendekat.
5. **Risiko churn**: penurunan login/penggunaan memicu outreach CS.
6. **Advokasi**: permintaan testimoni, program referral.
Lihat juga [[B2B SaaS Marketing RayFlow]].

## Praktik Penulisan
- WhatsApp: singkat, personal, satu pesan satu tujuan, satu CTA, frekuensi dibatasi agar tidak diblokir.
- Email: subject line jelas (uji dengan [[A/B Testing dan Statistik Eksperimen]]), preheader, satu CTA utama, mobile-first.
- Personalisasi bermakna (nama, produk yang dibeli), bukan sekadar nama depan.

## Metrik
Opt-in rate, delivered, open/read rate, CTR, conversion rate, revenue per pesan, unsubscribe/block rate, repeat purchase rate, trial-to-paid, churn. Definisi di [[KPI Dictionary]].
`),

  K('Atribusi, Konvensi UTM, dan Marketing Mix Modeling', { divisions: ['mkt', 'data', 'ecom'], roles: ['analyst', 'analytics', 'performance', 'ads', 'digital', 'marketing'] }, ['atribusi', 'utm', 'mmm', 'analytics'], `
# Atribusi, Konvensi UTM, dan Marketing Mix Modeling

Atribusi menjawab pertanyaan "channel mana yang berkontribusi pada konversi?". Tidak ada satu model yang sempurna; gunakan beberapa lapis pengukuran yang saling mengecek.

## Model Atribusi
| Model | Cara kerja | Bias |
|---|---|---|
| Last click | 100% ke sentuhan terakhir | Memihak search brand dan retargeting |
| First click | 100% ke sentuhan pertama | Memihak channel awareness |
| Linear | Rata ke semua sentuhan | Mengabaikan peran berbeda |
| Time decay | Bobot lebih ke sentuhan dekat konversi | Masih condong ke bawah funnel |
| Position-based | Bobot besar di awal dan akhir | Bobot arbitrer |
| Data-driven | Dihitung algoritma dari data | Butuh volume data; seperti kotak hitam |

Atribusi berbasis klik tidak menangkap pengaruh view (video yang ditonton tanpa diklik), word of mouth, dan offline. Karena itu lengkapi dengan uji inkrementalitas dan MMM.

## Konvensi UTM Ray Group
Semua link keluar dari channel milik/berbayar wajib memakai UTM. Huruf kecil, tanpa spasi, gunakan tanda hubung.
- **utm_source**: platform. Contoh: instagram, tiktok, meta, google, whatsapp, email, kol-namakreator, newsletter
- **utm_medium**: jenis. Contoh: paid-social, organic-social, cpc, email, wa-broadcast, affiliate, referral, kol
- **utm_campaign**: brand_kampanye_yymm. Contoh: rb_ramadan-glow_2603, rf_trial-fnb_2611
- **utm_content**: varian kreatif/posisi. Contoh: ugc-testi-v2, bio-link, cta-bawah
- **utm_term**: keyword atau audiens (opsional)

Contoh lengkap: ?utm_source=instagram&utm_medium=organic-social&utm_campaign=rb_ramadan-glow_2603&utm_content=bio-link

Aturan: simpan semua link di UTM sheet bersama; jangan memakai UTM untuk link internal di dalam situs sendiri (merusak data sesi); gunakan builder agar konsisten.

## Lapisan Pengukuran yang Disarankan
1. Platform report (optimasi harian)
2. GA4 + UTM (perbandingan lintas channel)
3. Data bisnis (order marketplace, CRM RayFlow) sebagai acuan final
4. Uji inkrementalitas (geo-holdout, conversion lift)
5. MMM untuk keputusan alokasi budget tahunan/kuartalan

## Dasar Marketing Mix Modeling (MMM)
MMM adalah regresi deret waktu yang memodelkan penjualan sebagai fungsi dari pengeluaran per channel plus faktor non-marketing.
- **Input**: penjualan mingguan, spend per channel, harga/promo, musim (Ramadan, Harbolnas, payday), distribusi, aktivitas kompetitor bila ada.
- **Konsep kunci**: adstock (efek iklan berlanjut setelah tayang, meluruh perlahan) dan saturasi (diminishing returns: tambahan spend menghasilkan tambahan hasil yang makin kecil).
- **Output**: kontribusi tiap channel, ROI marginal, kurva respons untuk simulasi alokasi.
- **Syarat**: data historis yang cukup panjang dan variasi spend; tools open source (misal Robyn, Meridian) dapat dipakai oleh tim data.
- **Keterbatasan**: korelasi bukan kausalitas; kalibrasi dengan hasil uji inkrementalitas.

## Tata Kelola
Definisi metrik dan sumber kebenaran ditetapkan di [[KPI Dictionary]]. Perubahan model atribusi dicatat agar tren tidak disalahartikan.
`),

  K('Rumus Unit Economics Marketing: CAC, LTV, ROAS', { divisions: ['mkt', 'fin', 'data', 'exec', 'ecom', 'sales'], roles: ['marketing', 'performance', 'analyst', 'growth', 'ads'] }, ['cac', 'ltv', 'roas', 'unit-economics', 'rumus'], `
# Rumus Unit Economics Marketing: CAC, LTV, ROAS

Unit economics memastikan pertumbuhan menguntungkan. Semua rumus di bawah memakai definisi baku; definisi resmi perusahaan tetap mengacu [[KPI Dictionary]].

## Biaya Akuisisi
- **CAC (Customer Acquisition Cost)** = total biaya akuisisi periode ÷ jumlah pelanggan baru periode.
  - *Blended CAC*: semua biaya marketing (termasuk organik, tim, tools) ÷ semua pelanggan baru.
  - *Paid CAC*: biaya iklan ÷ pelanggan baru yang teratribusi ke paid.
- **CPA** = biaya ÷ jumlah aksi (lead, trial, order). Lead bukan pelanggan; jangan samakan CPA lead dengan CAC.
- **CPL ke CAC**: CAC = CPL ÷ conversion rate lead-ke-pelanggan.

## Nilai Pelanggan
**RayFlow (SaaS)**
- ARPA/ARPU = MRR ÷ jumlah akun aktif.
- Churn rate bulanan = akun yang berhenti di bulan itu ÷ akun aktif awal bulan.
- **LTV** ≈ (ARPA × gross margin %) ÷ churn rate bulanan.
- **LTV:CAC** = LTV ÷ CAC.
- **CAC payback (bulan)** = CAC ÷ (ARPA × gross margin %).

**Ray Beauty (D2C/marketplace)**
- AOV = revenue ÷ jumlah order.
- Frekuensi beli = jumlah order ÷ jumlah pelanggan unik dalam periode.
- **LTV (berbasis kontribusi)** = AOV × margin kontribusi % × rata-rata jumlah order per pelanggan selama horizon yang ditetapkan (misal 12 bulan). Gunakan data kohort aktual, bukan asumsi.
- Margin kontribusi = revenue − COGS − biaya platform/komisi − ongkir subsidi − diskon − biaya pembayaran.

## Efisiensi Iklan
- **ROAS** = revenue teratribusi ÷ biaya iklan.
- **Break-even ROAS** = 1 ÷ margin kontribusi % (sebelum biaya iklan). Contoh ilustrasi: margin kontribusi 40% → break-even ROAS = 2,5.
- **Target ROAS** = 1 ÷ (margin kontribusi % − target profit % atas revenue). Contoh ilustrasi: margin 40%, target profit 10% → 1 ÷ 0,30 ≈ 3,33.
- **MER** = total revenue ÷ total biaya marketing (lintas channel, tanpa atribusi).
- **aMER/nCAC**: revenue atau CAC hanya dari pelanggan baru, untuk memisahkan efek pelanggan lama.
- **POAS** = profit kontribusi ÷ biaya iklan; lebih jujur bila margin antar produk berbeda jauh.

## Funnel Math (perencanaan mundur)
Pelanggan yang dibutuhkan = target revenue ÷ nilai per pelanggan.
Trial dibutuhkan = pelanggan ÷ trial-to-paid rate.
Visit dibutuhkan = trial ÷ visit-to-trial rate.
Budget = visit × CPC, atau pelanggan × CAC target.
Isi rate dengan data historis sendiri.

## Contoh Ilustrasi RayFlow
ARPA Rp 300.000, gross margin 80%, churn 4%/bulan → LTV ≈ 300.000 × 0,8 ÷ 0,04 = Rp 6.000.000. CAC Rp 1.500.000 → LTV:CAC = 4; payback = 1.500.000 ÷ 240.000 ≈ 6,25 bulan. (Angka ilustrasi untuk latihan, bukan data perusahaan; harga resmi di [[Pricing]].)

## Jebakan
- LTV dihitung dari revenue, bukan margin.
- Mengabaikan retur, refund, dan diskon.
- ROAS platform dianggap kebenaran tanpa cek data bisnis (lihat [[Atribusi, Konvensi UTM, dan Marketing Mix Modeling]]).
- Membandingkan CAC antar periode dengan definisi berbeda.
`),

  K('A/B Testing dan Statistik Eksperimen', { divisions: ['mkt', 'data', 'ecom', 'eng'], roles: ['analyst', 'growth', 'cro', 'performance', 'crm', 'email', 'marketing'] }, ['ab-testing', 'statistik', 'eksperimen', 'cro'], `
# A/B Testing dan Statistik Eksperimen

A/B test membandingkan dua versi (kontrol A vs varian B) pada audiens acak untuk mengetahui apakah perubahan benar-benar menyebabkan perbedaan hasil, bukan kebetulan.

## Langkah Eksperimen
1. **Masalah dan data**: misal conversion rate landing page trial RayFlow turun.
2. **Hipotesis**: "Karena calon pengguna ragu soal waktu setup, menambahkan klaim 'siap dalam 10 menit' (jika terbukti benar) di atas tombol akan menaikkan visit-to-trial."
3. **Metrik utama** (satu) dan guardrail (misal kualitas trial/aktivasi, bounce).
4. **Ukuran sampel** dihitung sebelum mulai.
5. **Randomisasi** yang benar dan durasi minimal satu siklus mingguan penuh (pola hari kerja dan akhir pekan berbeda).
6. **Jalankan tanpa mengintip-lalu-berhenti** (peeking).
7. **Analisis** dan dokumentasi, termasuk hasil gagal.

## Konsep Statistik
- **Tingkat signifikansi (alpha)**: peluang menyimpulkan ada efek padahal tidak ada; umumnya 5%.
- **Power (1 − beta)**: peluang mendeteksi efek bila memang ada; umumnya 80%.
- **MDE (Minimum Detectable Effect)**: efek terkecil yang ingin bisa dideteksi.
- **p-value**: peluang melihat perbedaan sebesar ini (atau lebih) jika sebenarnya tidak ada efek. Bukan peluang hipotesis benar.
- **Confidence interval**: rentang plausibel besar efek; laporkan bersama estimasi.

## Rumus Praktis Ukuran Sampel (proporsi)
Pendekatan cepat untuk alpha 5% dan power 80%:
n per varian ≈ 16 × p × (1 − p) ÷ d²
dengan p = baseline conversion rate dan d = selisih absolut yang ingin dideteksi.
Contoh ilustrasi: baseline 4% (0,04), ingin mendeteksi kenaikan ke 5% (d = 0,01): n ≈ 16 × 0,04 × 0,96 ÷ 0,0001 ≈ 6.144 per varian. Efek yang lebih kecil membutuhkan sampel jauh lebih besar (kuadrat).

## Uji Signifikansi Dua Proporsi
z = (p_B − p_A) ÷ akar( p × (1 − p) × (1/n_A + 1/n_B) ), dengan p = total konversi ÷ total sampel. |z| > 1,96 setara signifikan pada alpha 5% (dua sisi). Gunakan kalkulator atau notebook tim data untuk memastikan.

## Kesalahan Umum
- **Peeking**: berhenti begitu terlihat "menang" menaikkan false positive. Gunakan durasi tetap atau metode sequential/Bayesian yang memang dirancang untuk itu.
- **Banyak varian/metrik tanpa koreksi**: makin banyak perbandingan, makin besar peluang kebetulan.
- **Sample ratio mismatch**: pembagian trafik tidak sesuai rencana menandakan masalah teknis.
- **Novelty effect**: varian baru menang sebentar karena baru.
- **Uji di iklan**: algoritma platform tidak membagi audiens secara acak kecuali memakai fitur A/B test resmi.
- **Segmentasi pasca-hoc**: mencari segmen yang "menang" setelah uji gagal adalah eksplorasi, bukan bukti.

## Apa yang Layak Diuji
Headline dan hook, penawaran, harga/paket (koordinasi dengan [[Pricing]]), urutan halaman, form, subject email, waktu kirim WA, onboarding trial. Prioritaskan dengan skor ICE (Impact, Confidence, Ease).

## Dokumentasi
Simpan di experiment log: hipotesis, desain, sampel, durasi, hasil, CI, keputusan, pembelajaran. Hubungkan dengan [[Bidding, Creative Testing, dan Pengukuran Iklan]].
`),

  K('PR dan Komunikasi Krisis', { divisions: ['mkt', 'exec', 'legal', 'cs', 'reg', 'qa'], roles: ['pr', 'brand', 'communication', 'komunikasi', 'social', 'community'] }, ['pr', 'krisis', 'media-relations', 'reputasi'], `
# PR dan Komunikasi Krisis

PR membangun reputasi lewat pihak ketiga (media, komunitas, tokoh) yang lebih dipercaya daripada iklan. Komunikasi krisis melindungi reputasi saat terjadi masalah.

## PR Rutin
**Angle berita yang kuat untuk Ray Group**
- Ray Beauty: investasi pabrik CPKB lokal, penyerapan tenaga kerja, riset bahan lokal, peluncuran produk dengan cerita R&D.
- RayFlow: digitalisasi UMKM, cerita pelanggan yang tumbuh, data/riset internal yang aman dipublikasi, kemitraan dengan asosiasi atau pemerintah daerah.
- Korporat: milestone di [[Profil Perusahaan]], kepemimpinan, program sosial.

**Alat kerja**
- Press release: judul berita, lead 5W1H di paragraf pertama, kutipan narasumber, data pendukung, boilerplate, kontak media.
- Media kit: profil, logo, foto resmi, fakta kunci.
- Media list per beat (bisnis/teknologi, kecantikan/gaya hidup, UMKM, daerah).
- Spokesperson terlatih untuk tiap brand.
- Ukur: jumlah dan kualitas liputan, pesan kunci yang muncul, share of voice, trafik rujukan.

## Klasifikasi Krisis
| Level | Contoh | Respons |
|---|---|---|
| 1 Isu | Keluhan individu di medsos | Community management standar |
| 2 Insiden | Beberapa laporan reaksi kulit, server RayFlow down beberapa jam, konten KOL bermasalah | Tim inti, respons cepat, pantau |
| 3 Krisis | Viral nasional, dugaan produk berbahaya, kebocoran data, isu hukum/BPOM | Tim krisis penuh, keputusan direksi |

## Tim Krisis
Pimpinan (exec), PR/komunikasi, legal, regulatory dan QA (Ray Beauty), engineering/IT dan keamanan (RayFlow), CS, dan social media lead.

## Protokol Golden Hour
1. **Deteksi dan verifikasi** fakta: apa yang terjadi, sejak kapan, siapa terdampak. Jangan berspekulasi.
2. **Eskalasi** ke tim krisis sesuai level.
3. **Holding statement** cepat: kami mengetahui, kami peduli, kami sedang menyelidiki, kapan update berikutnya.
4. **Hentikan konten terjadwal dan iklan** yang bisa terlihat tidak sensitif.
5. **Tindakan nyata**: tarik batch bila perlu (keputusan QA/regulatory), perbaikan sistem, kompensasi.
6. **Komunikasi berkala** di semua channel resmi dengan pesan konsisten.
7. **Post-mortem** dan perbaikan proses.

## Prinsip Pesan
- Empati dahulu, lalu fakta, lalu tindakan, lalu komitmen.
- Akui bila salah; jangan menyalahkan pelanggan.
- Satu suara: hanya spokesperson resmi yang bicara ke media.
- Jangan menghapus komentar kritik yang sah; moderasi hanya spam dan pelanggaran.
- Pernyataan terkait keamanan produk, data pribadi, atau hukum wajib direview legal dan disetujui sesuai [[Kebijakan Persetujuan]].
- Untuk insiden data pribadi, ikuti kewajiban notifikasi sesuai UU PDP; verifikasi ke sumber resmi terbaru.

## Template Holding Statement
"Kami telah menerima laporan mengenai [isu]. Keamanan dan kenyamanan pelanggan adalah prioritas kami. Saat ini tim kami sedang [tindakan]. Kami akan menyampaikan perkembangan selanjutnya paling lambat [waktu]. Pelanggan yang terdampak dapat menghubungi [channel resmi]."
`),

  K('Marketing Kecantikan: Klaim, Before-After, Endorsement Dermatologis', { divisions: ['mkt', 'studio', 'reg', 'legal', 'ecom', 'rnd'], roles: ['marketing', 'content', 'konten', 'kol', 'influencer', 'copy', 'ads', 'brand', 'creator'] }, ['beauty', 'klaim', 'before-after', 'dermatologis', 'kepatuhan'], `
# Marketing Kecantikan: Klaim, Before-After, Endorsement Dermatologis

Marketing Ray Beauty harus kreatif sekaligus patuh. Pelanggaran klaim bisa berujung teguran regulator, penurunan iklan, dan hilangnya kepercayaan. Rujukan utama: [[Pedoman Klaim Kosmetik]]. Regulasi BPOM dan kebijakan platform diperbarui berkala; verifikasi ke sumber resmi terbaru.

## Prinsip Klaim
- Kosmetik bekerja di permukaan tubuh untuk membersihkan, mewangikan, mengubah penampilan, melindungi, dan memelihara. **Klaim yang menyiratkan pengobatan, penyembuhan, atau perubahan fungsi fisiologis tidak diperbolehkan** (misalnya "menyembuhkan jerawat", "menghilangkan flek permanen", "regenerasi sel").
- Klaim harus **didukung bukti** yang sesuai (data uji, literatur bahan) dan selaras dengan klaim yang tercantum saat notifikasi.
- Hindari superlatif mutlak dan jaminan ("100% aman", "pasti", "paling ampuh", "tanpa efek samping").
- Klaim "bebas" (free from) dan "alami/organik" hanya bila sesuai aturan dan dapat dibuktikan.
- Klaim halal hanya dengan sertifikat halal yang berlaku.
- Jangan merendahkan produk kompetitor.

## Alur Review Klaim
1. Copywriter memakai daftar klaim yang disetujui dari [[Produk Ray Beauty]].
2. Klaim baru diajukan ke tim regulatory dengan bukti pendukung.
3. Semua materi (iklan, caption, skrip KOL, kemasan, halaman marketplace) direview sebelum tayang sesuai [[SOP Marketing - Content Pipeline]] dan [[Kebijakan Persetujuan]].
4. Simpan arsip versi yang disetujui.

## Aturan Before-After
- Gunakan hanya bila ada dasar uji atau pemakaian nyata yang terdokumentasi, dan klaim yang disiratkan termasuk klaim yang diizinkan.
- Kondisi foto sama: pencahayaan, sudut, jarak, kamera, tanpa makeup, **tanpa filter dan tanpa retouch** pada area hasil.
- Cantumkan durasi pemakaian dan keterangan bahwa hasil dapat berbeda pada tiap individu.
- Dapatkan persetujuan tertulis dari orang di foto.
- Kebijakan iklan platform sering membatasi before-after untuk kategori tertentu; verifikasi ke sumber resmi terbaru sebelum dipakai di iklan berbayar.
- Alternatif yang lebih aman: demo tekstur, rutinitas harian, "skin diary" jujur tanpa janji hasil.

## Endorsement Dokter/Dermatolog
- Dokter terikat kode etik profesi yang membatasi keterlibatan dalam promosi produk; aturan detail harus diverifikasi ke kode etik dan regulasi terbaru, dan setiap kerja sama ditinjau legal.
- Format yang lebih aman: edukasi umum tentang perawatan kulit atau bahan aktif, bukan rekomendasi produk berlebihan; hindari klaim "direkomendasikan dokter" kecuali dasar dan izinnya jelas.
- Verifikasi STR/kredensial dan spesialisasi; jangan menyebut seseorang dermatolog bila bukan.
- Pisahkan formulator/apoteker internal (boleh menjelaskan proses dan bahan) dari dokter eksternal.

## Checklist Materi Ray Beauty
- [ ] Semua klaim ada di daftar disetujui
- [ ] Tidak ada klaim medis atau jaminan
- [ ] Visual tanpa filter pada area hasil
- [ ] Disclaimer hasil individu bila menampilkan hasil
- [ ] Label iklan/kemitraan pada konten berbayar
- [ ] Nama produk dan informasi sesuai notifikasi
- [ ] Review regulatory selesai dan tercatat

Prinsip ini juga berlaku di brief KOL (lihat [[KOL dan Influencer Marketing: Tier, Brief, Kontrak, Pengukuran]]).
`),

  K('B2B SaaS Marketing RayFlow', { divisions: ['mkt', 'sales', 'cs', 'bizdev'], roles: ['marketing', 'growth', 'content', 'webinar', 'b2b', 'saas', 'product marketing'] }, ['b2b', 'saas', 'rayflow', 'webinar', 'free-trial', 'content-led'], `
# B2B SaaS Marketing RayFlow

RayFlow menjual ke pemilik dan manajer UMKM yang sibuk, sensitif harga, dan skeptis terhadap software. Pemasarannya harus membuktikan nilai secepat mungkin. Rujukan: [[Ideal Customer Profile]], [[Persona Pelanggan UMKM]], [[Produk & Layanan]], [[Pricing]].

## Motion Pertumbuhan
- **Content-led**: edukasi operasional UMKM menarik trafik dan kepercayaan.
- **Product-led**: free trial yang membuat pengguna merasakan "aha" sendiri.
- **Sales-assisted**: untuk akun multi-cabang atau kebutuhan integrasi, sales/onboarding membantu.
- **Community/partner-led**: asosiasi UMKM, komunitas penjual marketplace, konsultan.

## Content-Led Growth
- Topik dari pertanyaan nyata pelanggan: rekap pesanan, follow-up pelanggan, stok, SOP, laporan harian.
- Aset: artikel SEO ([[Riset Keyword dan Content Cluster]]), template gratis (spreadsheet SOP, template balasan WA), kalkulator (waktu yang hilang karena kerja manual), video tutorial, studi kasus.
- Setiap aset punya CTA ke trial atau webinar, dan gated asset dipakai secukupnya untuk mengumpulkan lead dengan izin.

## Playbook Webinar
1. **Topik**: satu masalah spesifik, judul hasil ("Cara Balas 100 Chat Pesanan Tanpa Tambah Admin").
2. **Promosi**: email/WA ke database opt-in, sosial, komunitas mitra, iklan ringan; pengingat H-1 dan H-jam.
3. **Struktur**: masalah dan dampaknya → kerangka solusi (bisa dipakai walau tanpa RayFlow) → demo langsung → studi kasus → penawaran khusus peserta → Q&A.
4. **Follow-up**: rekaman dan materi di hari yang sama, segmentasi peserta (hadir, aktif bertanya, tidak hadir), sales menghubungi lead yang cocok ICP.
5. **Repurpose**: klip pendek, artikel, carousel (lihat [[Content Marketing dan Kalender Editorial]]).
Metrik: registrasi, kehadiran, trial dari peserta, pipeline.

## Free Trial Onboarding
- **Definisikan aktivasi**: tindakan yang paling berkorelasi dengan berlangganan (misal menghubungkan channel pertama dan menjalankan workflow pertama). Tentukan dengan data, catat di [[KPI Dictionary]].
- **Kurangi time-to-value**: template workflow per industri, data contoh, checklist onboarding di dalam aplikasi.
- **Lifecycle pesan** dipicu perilaku lewat email dan WhatsApp (lihat [[CRM dan Lifecycle Email serta WhatsApp]]).
- **Sentuhan manusia** untuk trial ber-ICP tinggi: tawaran sesi setup singkat.
- **Akhir trial**: ringkasan nilai, pilihan paket jelas, perpanjangan untuk yang hampir aktivasi.

## Lead Management
- Lead scoring: kecocokan (fit: industri, jumlah cabang, channel jualan) × minat (engagement: aktivasi, kunjungan halaman harga, kehadiran webinar).
- Definisi MQL, PQL (product-qualified lead), dan SQL disepakati bersama sales.
- SLA follow-up lead panas dan mekanisme pengembalian lead ke nurture.

## Pesan Kunci
Bahasa sederhana, contoh lokal, fokus hasil (waktu, kesalahan berkurang, pelanggan terlayani), dukungan berbahasa Indonesia, setup cepat. Hindari jargon teknis. Klaim angka hanya bila terbukti dari data pelanggan dan disetujui.

## Metrik Utama
Visit-to-trial, aktivasi, trial-to-paid, CAC, payback, churn awal, expansion. Rumus di [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]].
`),

  K('Playbook Kampanye Ramadan dan Harbolnas', { divisions: ['mkt', 'ecom', 'studio', 'scm', 'cs', 'sales'], roles: ['campaign', 'marketing', 'marketplace', 'ecommerce', 'ads', 'kol', 'crm'] }, ['ramadan', 'harbolnas', 'kampanye-musiman', 'mega-sale'], `
# Playbook Kampanye Ramadan dan Harbolnas

Ramadan–Lebaran dan Harbolnas (12.12) adalah dua momen terbesar e-commerce Indonesia, ditambah tanggal kembar (9.9, 10.10, 11.11) dan payday. Tanggal dan program resmi marketplace mengikuti [[Kalender Kampanye E-commerce]]; mekanisme dan biaya program berubah, verifikasi ke sumber resmi terbaru.

## Ramadan dan Lebaran
**Perilaku yang perlu diantisipasi**
- Pola waktu bergeser: aktivitas meningkat sekitar sahur dan setelah berbuka; jadwalkan konten, live, dan iklan sesuai data akun sendiri.
- Fase kebutuhan: persiapan awal Ramadan → belanja kebutuhan dan hampers → mudik → Lebaran → pasca-Lebaran.
- Nuansa: kebersamaan, berbagi, silaturahmi, tampil segar saat Lebaran. Hormati nilai religius; hindari konten yang tidak sensitif.

**Ray Beauty**
- Pesan relevan: perawatan kulit saat puasa (hidrasi, rutinitas sederhana), tampil fresh saat silaturahmi, gift set/hampers.
- Produk: bundel rutinitas, travel size untuk mudik, edisi hampers.
- Klaim tetap sesuai [[Pedoman Klaim Kosmetik]].

**RayFlow**
- Pesan: UMKM siap lonjakan pesanan Ramadan (katering, hampers, fashion muslim), otomasi agar tim bisa libur Lebaran.
- Aset: webinar "Siap Panen Ramadan", template pesanan hampers, promo langganan yang mengikuti [[Pricing]].
- Pengingat: support dan jam operasional selama libur dikomunikasikan jauh hari.

## Harbolnas dan Tanggal Kembar
**Fase**
1. **Persiapan (beberapa minggu sebelum)**: daftar program marketplace, tetapkan produk hero dan bundel, harga dan voucher disetujui finance, stok dan gudang siap.
2. **Pemanasan**: konten teaser, ajakan wishlist/add-to-cart/follow toko, seeding KOL dan affiliate brief.
3. **Hari-H**: live shopping maraton, flash sale terjadwal, iklan marketplace dan sosial dinaikkan bertahap, monitoring stok real time.
4. **Pasca**: pengiriman cepat, penanganan komplain, permintaan ulasan, retargeting pembeli untuk repeat.

## Checklist Lintas Fungsi
| Fungsi | Tugas |
|---|---|
| Marketing | Big idea, aset kreatif, jadwal konten dan live, KOL/affiliate, iklan |
| E-commerce | Pendaftaran program, setting voucher, halaman toko, iklan marketplace |
| Finance | Persetujuan diskon dan budget, simulasi margin per SKU |
| SCM/Ops | Stok, packing, kapasitas kurir, cut-off pengiriman |
| CS | Skrip FAQ promo, jadwal shift tambahan, SLA chat |
| Regulatory | Review klaim semua materi Ray Beauty |

## Prinsip Profitabilitas
- Simulasikan margin kontribusi per SKU setelah diskon, voucher, komisi, dan ongkir (lihat [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]]).
- Gunakan produk hero sebagai penarik dan bundel untuk menaikkan AOV.
- Biaya iklan cenderung naik saat musim ramai karena persaingan; siapkan batas CPA/ROAS dan aset retargeting dari audiens yang dibangun saat pemanasan.
- Jangan melatih pelanggan hanya membeli saat diskon: jaga harga normal tetap kredibel.

## Post-Mortem
Bandingkan target vs aktual: GMV, order, margin, ROAS terverifikasi, pelanggan baru, rating toko, isu operasional. Simpan pembelajaran untuk kampanye berikutnya mengikuti format [[Perencanaan Kampanye Terintegrasi]].
`),

  K('Konsumen Gen Z Beauty Indonesia', { divisions: ['mkt', 'studio', 'rnd', 'ecom'], roles: ['marketing', 'brand', 'content', 'konten', 'social', 'tiktok', 'kol', 'creator', 'insight'] }, ['gen-z', 'beauty', 'consumer-insight', 'ray-beauty'], `
# Konsumen Gen Z Beauty Indonesia

Gen Z (umumnya lahir sekitar pertengahan 1990-an hingga awal 2010-an) adalah audiens inti Ray Beauty. Catatan ini merangkum pola perilaku yang banyak diamati secara kualitatif; validasi dengan riset dan data Ray Beauty sendiri sebelum dijadikan dasar keputusan besar.

## Pola Perilaku yang Umum Diamati
- **Discovery lewat video pendek dan kreator**, bukan iklan tradisional. TikTok dan Instagram Reels menjadi tempat menemukan produk; marketplace dan TikTok Shop menjadi tempat membeli.
- **Riset sebelum beli**: membaca komentar, ulasan, video review, dan daftar kandungan. Literasi bahan aktif (niacinamide, ceramide, salicylic acid, sunscreen SPF/PA) relatif tinggi.
- **Skeptis terhadap iklan yang terlalu dipoles**; menghargai kejujuran, tekstur asli, dan kulit nyata tanpa filter.
- **Sensitif harga tetapi rasional**: mencari value, ukuran trial, bundel, dan promo tanggal kembar; mau membayar lebih untuk bukti kualitas.
- **Kebanggaan produk lokal** meningkat bila kualitasnya terbukti.
- **Nilai**: inklusivitas (beragam warna kulit dan jenis kulit), keberlanjutan, transparansi, kesehatan mental (skin positivity).
- **Komunitas**: ikut tren, tantangan, dan percakapan; ingin didengar dan dilibatkan.

## Implikasi untuk Ray Beauty
| Insight | Aksi |
|---|---|
| Percaya kreator dan teman | Program KOL nano/mikro dan affiliate, UGC, ulasan terverifikasi |
| Literasi bahan tinggi | Edukasi kandungan yang akurat, daftar INCI mudah ditemukan |
| Anti-filter | Demo tanpa filter, tampilkan tekstur dan proses asli |
| Ingin transparansi | Konten behind the scenes pabrik CPKB dan QC |
| Sensitif harga | Travel size, bundel rutinitas, promo terjadwal sesuai [[Kalender Kampanye E-commerce]] |
| Ingin terlibat | Co-creation (voting varian/kemasan), beta tester, komunitas |
| Inklusif | Talent beragam, bahasa yang tidak menghakimi kondisi kulit |

## Tone of Voice
Seperti kakak/teman yang paham skincare: santai, jujur, tidak menggurui, tidak body-shaming. Hindari istilah yang membuat kondisi kulit terlihat sebagai aib ("kulit jelek", "menjijikkan"). Gunakan bahasa gaul secukupnya dan relevan; tren bahasa cepat basi. Ikuti [[Brand Guidelines]].

## Risiko dan Kepatuhan
- Audiens muda rentan terhadap klaim berlebihan dan standar kecantikan tidak realistis; kepatuhan [[Pedoman Klaim Kosmetik]] adalah juga soal etika.
- Hati-hati dengan kreator yang audiensnya di bawah umur; ikuti kebijakan platform dan hukum perlindungan anak.
- Hindari mempromosikan pemakaian berlebihan bahan aktif tanpa edukasi keamanan (misal pentingnya sunscreen saat memakai eksfoliasi).

## Riset Lanjutan yang Disarankan
- Survei singkat pembeli (dengan izin) tentang sumber discovery dan alasan membeli.
- Social listening topik kulit yang paling sering dibicarakan.
- Wawancara mendalam 10–15 pelanggan per kuartal.
- Analisis ulasan marketplace: kata yang sering muncul untuk tekstur, hasil, kemasan.
Hasil diolah menjadi persona dan dipakai dalam [[STP Ray Group: Segmentasi, Targeting, Positioning]].
`),

  K('Alokasi Budget Marketing', { divisions: ['mkt', 'fin', 'exec', 'data'], roles: ['marketing', 'head', 'manager', 'performance', 'growth', 'brand'] }, ['budget', 'alokasi', 'perencanaan', 'roi'], `
# Alokasi Budget Marketing

Alokasi budget adalah keputusan strategis: berapa yang dibelanjakan, di mana, untuk apa, dan bagaimana memindahkannya saat data berubah. Semua angka dalam catatan ini adalah kerangka, bukan patokan industri.

## Menentukan Total Budget
Pendekatan (gunakan lebih dari satu dan rekonsiliasi):
1. **Objective-and-task**: hitung mundur dari target (funnel math di [[Rumus Unit Economics Marketing: CAC, LTV, ROAS]]). Misal target pelanggan baru × CAC target + biaya retensi + brand building.
2. **Persentase revenue**: ditetapkan manajemen sesuai fase bisnis (fase pertumbuhan biasanya lebih agresif).
3. **Unit economics guardrail**: budget boleh naik selama CAC marginal masih di bawah batas (misal LTV:CAC dan payback sesuai target internal).
4. **Kompetitif**: perhatikan share of voice relatif terhadap pesaing utama.
Keputusan final dan perubahan besar mengikuti [[Kebijakan Persetujuan]].

## Kerangka Pembagian
**Per brand**: RayFlow dan Ray Beauty dianggarkan terpisah dengan P&L masing-masing; hindari subsidi silang tanpa keputusan direksi.

**Per tujuan (brand vs activation)**
- *Brand building*: konten, video awareness, PR, sponsorship, KOL besar. Dampak jangka panjang, sulit diatribusi.
- *Activation/performance*: iklan konversi, retargeting, search, marketplace ads, affiliate.
- *Retention*: CRM, loyalty, komunitas.
Porsi ditentukan oleh fase brand, siklus beli, dan data; brand yang hanya mengandalkan performance biasanya menghadapi CAC yang terus naik.

**Model 70-20-10**
- 70% channel terbukti (core)
- 20% channel yang sedang diskalakan
- 10% eksperimen baru (channel, format, audiens)

**Per channel**: dari peran channel di [[Strategi Digital Marketing End-to-End]] dan ROI marginal (bukan rata-rata). Pindahkan dana dari channel yang hasil marginalnya menurun ke channel dengan ruang tumbuh.

## Komponen yang Sering Terlupa
- Produksi kreatif (iklan butuh refresh rutin)
- Tools dan langganan software (analytics, social listening, email/WA platform)
- Biaya platform WhatsApp, fee marketplace, komisi affiliate
- Sampel produk KOL dan ongkir
- Cadangan kontinjensi untuk peluang dan krisis

## Pacing dan Musiman
- Rencanakan kurva per bulan sesuai [[Kalender Kampanye E-commerce]] (Ramadan, tanggal kembar, Harbolnas) dan siklus B2B (awal tahun, awal kuartal).
- Bangun audiens dan konten sebelum puncak musim, karena biaya lelang cenderung naik saat ramai.
- Review pacing mingguan; realokasi bulanan dengan alasan tertulis.

## Template Rencana Budget
| Brand | Channel | Tujuan | Budget/bulan | KPI | Target | Pemilik |
|---|---|---|---|---|---|---|

## Review Kuartalan
1. Realisasi vs rencana per channel.
2. CAC, ROAS terverifikasi, MER, dan kontribusi pelanggan baru.
3. Hasil eksperimen 10%: naik kelas ke 20% atau dihentikan.
4. Input MMM/inkrementalitas bila tersedia (lihat [[Atribusi, Konvensi UTM, dan Marketing Mix Modeling]]).
5. Rencana kuartal berikutnya disetujui finance dan pimpinan.
`),
];
