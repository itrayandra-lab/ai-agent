# Riset 04: Sintra, Teamily, Marblism, dan rancangan chat engine RAIVERSE

Tanggal riset: 2026-11-19. Bahasa sederhana. Tanda: **[F]** = fakta dari sumber (ada URL), **[K]** = kesimpulan saya.

## 0. Catatan kejujuran sumber (baca dulu)

- Alat WebFetch ditolak untuk ketiga domain (verifikasi keamanan). Saya memuat halaman resmi lewat `curl` lalu mengubahnya jadi teks. Hasilnya cukup untuk halaman pemasaran, tetapi:
  - Aplikasi sebenarnya (layar chat di dalam produk) di belakang login. Saya TIDAK melihatnya. Semua soal tampilan chat berasal dari ulasan yang menjelaskan layar, blog resmi, dan halaman pemasaran.
  - `help.sintra.ai/en/articles/15012096-agent-helpers` mengembalikan "halaman tidak ada". Pusat bantuan Sintra tidak terbaca.
  - `teamily.ai/help` kosong (dirender JavaScript). Pusat bantuan Teamily hanya terlihat lewat kutipan mesin pencari.
  - Tidak ada ulasan pengguna Teamily yang bisa ditemukan (Trustpilot, G2, Reddit). Hasil pencarian "Teamily" malah menunjuk produk lain. Bagian keluhan Teamily kosong, dan itu dikatakan apa adanya.
- Angka harga berbeda antar sumber dan berubah. Saya cantumkan angka dari halaman resmi saat saya memuatnya (19 Nov 2026) dan tandai yang bertentangan.
- "AI Employee Index" di situs Marblism adalah tes yang diterbitkan Marblism sendiri dan menempatkan Marblism peringkat 1 [F: https://www.marblism.com/pricing]. Jangan dianggap netral.
- Banyak ulasan Sintra/Marblism berisi tautan afiliasi. Ulasan Crevio dan Carly adalah produk pesaing. Dicatat di tempatnya.

## 1. Ringkasan 10 baris

1. Ketiganya menjual "tim AI", tetapi bentuk chat-nya berbeda: **Sintra dan Marblism = satu obrolan per karyawan**; **Teamily = satu grup chat tempat manusia dan banyak agen hadir bersama**.
2. Sintra: 12 helper bernama, memori bersama "Brain AI", Vizzy (asisten) bisa memanggil helper lain di utas yang sama, tetapi ulasan independen menulis helper tidak berbagi konteks satu sama lain [F].
3. Marblism: 7 karyawan, tiap karyawan punya chat sendiri dan semua memakai satu "Brain" dokumen; setiap agen "lapor" sekali sehari untuk disetujui; semua berbagi 50 jam kerja per bulan [F].
4. Teamily: agen jadi anggota grup, bisa di-@, dijadikan tugas paralel, ada rencana eksekusi yang terlihat, memori lintas konteks, tugas terjadwal, studio kolaborasi [F].
5. Eksekusi yang terasa baik di Sintra/Marblism selalu berbentuk: agen menyiapkan DRAFT, pengguna menyetujui (Jadwalkan / Kirim / Tolak), hasil masuk kalender atau kotak masuk [F].
6. Keluhan terbesar Sintra: kredit cepat habis, kredit terpakai untuk memperbaiki kesalahan AI, pembaruan tak terduga, sulit batal [F: Trustpilot lewat ringkasan pencarian].
7. Keluhan terbesar Marblism: kuota 50 jam bersama, hasil lead generation lemah, agen kadang kehilangan konteks pada instruksi bertahap; bukan "tanpa sentuhan" (10-30 menit/hari persetujuan) [F: Crevio].
8. Kelemahan Teamily (kesimpulan, bukan keluhan terdokumentasi): produk sangat luas (sosial, studio, feed publik), batas pemakaian per jendela 5 jam, tidak ada ulasan independen yang ditemukan.
9. Yang patut ditiru: satu utas berisi percakapan + kartu kemajuan + hasil; draft lalu setujui; memori yang diisi dari obrolan (simpan cepat); agen "asisten" yang menjadi pintu tunggal dan memanggil spesialis.
10. Yang patut dihindari: kuota yang tak terlihat, helper terkotak-kotak tanpa konteks bersama, tombol/kartu yang "tidak terlihat di chat", dan janji "otonom" yang dibantah ulasan.

---

## 2. Profil Sintra

Sumber utama: https://sintra.ai/ai-employees, https://sintra.ai/pricing, https://sintra.ai/features/brain-ai, https://sintra.ai/sintra-x, ulasan Unite.AI https://www.unite.ai/sintra-ai-review/ (18 Apr 2026), Gmelius https://gmelius.com/blog/sintra-ai-review.

### 2.1 Karyawan/helper dan keahlian [F: https://sintra.ai/ai-employees dan https://sintra.ai/pricing]

Dua belas helper. Halaman `ai-employees` menulis tiap helper dengan tiga kemampuan utama:

- Soshie (manajer media sosial): buat dan jadwalkan posting, lacak keterlibatan, rancang profil, cari tren.
- Penn (copywriter): tulis naskah, haluskan nada, tingkatkan konversi.
- Buddy (strategi/pengembangan bisnis): susun strategi, cari peluang, analisis pesaing, luncurkan produk.
- Vizzy (asisten virtual/eksekutif): atur jadwal, ringkas hari, prioritaskan tugas, kalender, rencana perjalanan.
- Commet (e-commerce / pembuat situs): bangun situs, rencanakan promosi, optimalkan daftar produk.
- Seomi (SEO): cari kata kunci, optimalkan halaman, lacak peringkat.
- Cassie (dukungan pelanggan): balas email, live chat, balas komentar sosial, perbarui manual/FAQ, laporan dukungan.
- Milli (manajer penjualan): skrip, kelola lead, tutup transaksi.
- Emmie (email marketing): kampanye, alur keranjang tertinggal, email sambutan, win-back.
- Dexter (analis data): analisis tren, laporan, prediksi, neraca, kesehatan keuangan.
- Gigi (pelatih pribadi): tujuan, rencana makan, olahraga, studi, motivasi.
- Scouty (perekrut): iklan lowongan, saring CV, wawancara, onboarding.

Catatan: sumber pihak ketiga tidak konsisten (satu ulasan menyebut Milli perekrut; satu halaman menulis "Seomy"). Daftar resmi di atas yang dipakai. Beberapa menu situs juga menyebut "growth coach", "eCom specialist", "executive assistant" sebagai nama lain peran yang sama.

### 2.2 Model obrolan

- **Satu obrolan per helper** [F]: "Every AI worker runs as a chatbot" (https://sintra.ai/ ; FAQ). Alur tiga langkah: pilih helper, ngobrol dengan bahasa biasa, tinjau lalu setujui atau kembalikan [F: Unite.AI].
- **Router/pintu masuk**: penguji Unite.AI memulai dengan Vizzy yang bertanya "siap menjelajah?" dan menyarankan tiga tugas pertama. Ketika diminta memperkenalkan Soshie, "Vizzy mulai berbicara dengan Soshie dan memberi tahu saya apa yang dikatakan Soshie, tetap di chat yang sama" [F: https://www.unite.ai/sintra-ai-review/]. Jadi ada pola "asisten sebagai pialang ke spesialis" di utas yang sama.
- **Kartu di chat + panel kanan** [F: Unite.AI]: rencana aksi Soshie berupa kartu "Lihat", panel kanan menampilkan tombol "Connect" dan draft. Satu keluhan kecil: kartu yang disebut tidak terlihat di chat sampai pengguna bertanya "di mana kartunya?" lalu Vizzy memunculkannya.
- **Agen berdiskusi satu sama lain**: tidak ada bukti. Yang ada hanya Vizzy menyampaikan dari Soshie. Ulasan menulis "Helpers don't share context, so you have to move work between them manually" [F: Unite.AI, bagian Cons].
- **@mention**: tidak ditemukan di sumber mana pun. [K] Sintra tidak memakai @ sebagai pola utama; pemilihan dilakukan lewat memilih helper.
- **Tampilan per agen**: tiap helper punya avatar/nama/peran dan lembar obrolan sendiri; ada "Use Cases" satu klik (misal membuat gambar massal, meringkas email hari ini) [F: https://sintra.ai/pricing].

### 2.3 Eksekusi

- Kemajuan dan hasil [F: Unite.AI, penjelasan langkah 12-14]: setelah penyiapan, Soshie "membuat posting setiap Minggu" berdasarkan Brain AI; draft datang sebagai pesan di kotak masuk dengan gambar, keterangan, tanggal, platform, halaman; pengguna bisa ubah, regenerasi dengan AI, "Jadwalkan", atau tolak. Ada dasbor media sosial dan kalender konten (klik posting untuk ubah, hapus, duplikat).
- Persetujuan sebelum aksi keluar: penyiapan menanyakan apakah mau menyetujui draft sebelum diposting [F: Unite.AI langkah 8]; "I can always review, edit, or reject any post before it goes live".
- Terjadwal/otomasi: "Scheduled Automations" sederhana, misalnya ringkasan harian kalender dan email [F: Unite.AI]. Gmelius menulis Sintra "mengantisipasi" kebutuhan dan menjalankan tugas berulang [F: Gmelius], tetapi Unite.AI menyebut otomasinya terbatas dibanding Zapier (tanpa pemicu rumit) [F].
- Hasil/tempat simpan: dasbor per helper (kalender, kotak masuk), perpustakaan media pada kit merek. Tidak ditemukan konsep "folder hasil" umum.
- Power-Ups: lebih dari 90 tambahan (speech-to-text, skrip video, audit SEO) [F: Gmelius]. Menurut Gmelius ini membingungkan karena tanpa panduan.

### 2.4 Memori bersama: Brain AI [F: https://sintra.ai/features/brain-ai]

- Cara mengisi: teks, halaman web, PDF, TXT, CSV, dan sekitar 20 format berkas lain; "quick-save" dari chat ke Brain; ringkasan otomatis jadi format fakta cepat; **pertanyaan harian** dari helper untuk belajar tentang merek; kuesioner awal dan analisis situs web saat onboarding.
- Bersama semua helper dan Use Case.
- Sampai 5 profil Brain berbeda (agensi, multi-merek), pindah profil seketika.
- Klaim "93% pengguna melaporkan akurasi naik" dan "5,2 jam hemat per minggu" adalah klaim pemasaran Sintra, tanpa metode.
- Keluhan terkait: satu pengulas G2 menulis harus "mengajari ulang" semuanya [F: ringkasan pencarian atas https://g2.com/products/sintra-ai/reviews]. Namun tidak ada keluhan eksplisit helper melupakan konteks yang saya temukan.

### 2.5 Integrasi [F]

Halaman menyebut "1000+ tools" di menu, tetapi paket menulis "15+ integrations" (https://sintra.ai/pricing). Ulasan menyebut Gmail, Google Drive, Google Calendar, Notion, LinkedIn, Instagram, Facebook, YouTube, TikTok. Gmelius: ekosistem "belum matang"; CRM dan Zapier kurang/janggal.

### 2.6 Onboarding dan layar awal [F: Unite.AI]

Daftar, pilih paket (tidak ada paket gratis; garansi uang kembali 14 hari), isi kuesioner tentang bisnis, Sintra menganalisis situs web, chat pertama dibuka oleh Vizzy yang menyarankan tiga tugas pertama. Penguji: "terasa seperti asisten onboarding". Satu ulasan pengguna: awalnya "terasa membingungkan" tetapi setelah memahami cara berpikir pengguna jadi berguna [F: halaman beranda Sintra, testimoni].

### 2.7 Batas, harga, kredit, keluhan

- Harga di halaman resmi saya muat: 1 bulan $97 dicoret jadi $48,50; 3 bulan $59 jadi $23,60/bulan; 12 bulan $52 jadi $15,60/bulan; semua: 12 helper, **250 kredit per bulan**, 15+ integrasi, dukungan 24/7, garansi 14 hari [F: https://sintra.ai/pricing]. Per helper $39/bulan [F: https://sintra.ai/shop]. Angka lain ($47, $97) beredar di ulasan; harga cepat berubah dan tampaknya selalu "diskon".
- Keluhan dari ringkasan pencarian atas Trustpilot [F: https://www.trustpilot.com/review/sintra.ai]:
  - Kredit habis cepat (pengguna berat dalam 2-3 minggu), kredit terpakai untuk memperbaiki kesalahan AI sendiri.
  - Tidak ada top-up; pembaruan otomatis tak terduga; sulit batal; dukungan lambat/otomatis.
  - Jawaban Sintra: kemungkinan otomasi berjalan lebih sering dari yang dimaksud.
  - Trustpilot menahan skor Sintra karena pelanggaran pedoman insentif ulasan (menurut ulasan pihak ketiga). Skor tidak bisa dijadikan acuan.
- Ulasan lain: ada Reddit yang dikutip Gmelius tetapi saya tidak membukanya.

### 2.8 Kelebihan dan kelemahan

- Kelebihan: onboarding terpandu, helper berperan jelas, suara merek konsisten lewat Brain, kartu dan panel untuk menyetujui draft, aplikasi seluler.
- Kelemahan: helper terkotak, otomasi dangkal, sedikit kustomisasi (tidak bisa membuat helper sendiri) [F: Unite.AI], kredit tak transparan, harga naik untuk tim.

---

## 3. Profil Teamily

Sumber: https://teamily.ai/, https://teamily.ai/about, https://teamily.ai/pricing, blog https://blog.teamily.ai/ (termasuk https://blog.teamily.ai/teamily-ai-brings-agent-teams-to-human-teams/ yang mengutip Forbes 6 Mar 2026), serta https://blog.teamily.ai/what-problems-we-learn-from-users-and-how-we-solve-them/. Semua adalah tulisan perusahaan sendiri kecuali kutipan Forbes.

### 3.1 Karyawan/helper dan keahlian

Berbeda dari dua lainnya: tidak ada roster tetap bernama peran bisnis. Yang ada [F]:
- **Personal AI** (agen pribadi pengguna, "lintas konteks dan proaktif") dan **AI Twin** yang bisa mewakili pengguna di grup mana pun [F: blog "Create your AI twin"].
- Agen bawaan dalam contoh beranda: Analysis Agent, Webpage Developer, Market Research, Finance Assistant, Slides Assistant, Music Hub [F: https://teamily.ai/].
- Agen kustom: tombol "+ New Agent", pilih agen berbasis prompt, templat (SEO Autopilot, IT Ops, Community Manager), atau agen "cloud-native" bergaya OpenClaw dengan mesin virtual Ubuntu sendiri dan terminal [F: blog "Create and Train Your OpenClaw-like Agent Team"].
- Direktori publik "Discover": agen, artefak, alur kerja buatan komunitas yang bisa di-fork [F: beranda].

### 3.2 Model obrolan

- **Satu grup chat bersama manusia dan banyak agen** [F: https://teamily.ai/about]: "Multi-User x Multi-Agent Symbiotic Group Chat... agen bekerja bersama dalam satu utas".
- Agen muncul sebagai anggota bernama, "bisa disebut (@), diberi tugas, dan menjalankan pekerjaan paralel selagi obrolan berlanjut" [F: blog yang mengutip Forbes].
- **Router/otak**: "Social Brain Model" menganalisis niat, memecah tujuan jadi rencana, mendistribusikan tugas ke agen (apa, siapa, urutan, paralel/berurutan) [F: https://teamily.ai/about]; di beranda juga ada "context-aware semantic router" yang memilih kombinasi model dan agen demi kecepatan/biaya/mutu [F: https://teamily.ai/]. Dalam demo, "AI di chat adalah master AI yang mendatangkan AI ahli lain bila perlu" [F: blog Forbes].
- **Rencana eksekusi terlihat**: "visible execution plan tracked progress while participants continued discussing" [F: blog Forbes]. Beranda menampilkan alat chat: Create, Templates, Composer, Skills, Connect, Connectors, Schedule.
- **Agen saling berdiskusi**: tidak ada bukti diskusi/rapat bebas antar-agen. Yang ada: orkestrasi dan sub-agen dari satu agen utama; satu agen "integrasi" yang menuntun penyambungan akun [F: blog "Cross-context memory and sub-agent teams"].
- **Tampilan**: DM, grup, studio kolaboratif (web, slide, dokumen, dasbor) dengan Annotate/Fork/Open Studio, feed publik. Aplikasi web, macOS, Windows, iOS, Android [F: beranda].
- **Privasi antar grup**: "batas privasi ketat antara grup" disebut sebagai fitur [F: about]; cara kerjanya tidak dirinci.

### 3.3 Eksekusi

- Dari percakapan ke hasil: studio untuk situs web, slide, dokumen, dasbor; kolaborator manusia bisa komentar paralel dan edit langsung [F: blog "what-problems..."].
- Paralel: contoh dek pitch (riset pasar, analisis pesaing, desain, slide) dijalankan serentak [F: about].
- Persetujuan: paket Plus "kolaborasi lalu konfirmasi sebelum mengirim" email; paket Premium "cabang bersyarat dan persetujuan", "pengiriman otomatis dalam aturan yang diizinkan eksplisit" [F: https://teamily.ai/pricing]. Jadi persetujuan ada tetapi ditaruh di tingkat berbayar tinggi.
- Terjadwal: "AI-Scheduled Recurring Tasks": satu perintah bahasa biasa ("kirim ringkasan berita AI tiap hari jam 10") membuat pemicu berulang, sampel langsung, bisa dijalankan sesuai permintaan, ekspor/tautan bagikan [F: blog "Scheduled recurring tasks"]. Batas: tugas terjadwal 8 (Plus), 32 (Pro) [F: pricing].
- Loops: templat alur kerja bersama (simpan 20 di Plus) [F: pricing]. Cara kerjanya tidak dijelaskan rinci di halaman yang saya baca.
- Hasil tersimpan: studio/artefak, situs terbit (5/15/30), dokumen; "Artifact: context across chats, meetings, work, and apps" [F: pricing].

### 3.4 Memori

- "Living memory": dibangun dan disusun ulang sendiri dari setiap percakapan, bukan sekadar riwayat/pencarian; ditampilkan sebagai keputusan, item aksi, dan ringkasan lintas grup [F: beranda dan about].
- Cara mengisi: otomatis dari percakapan; juga dokumen, aplikasi, hubungan sosial ("social graph") [F: blog "Cross-context personal knowledge base"]. Pengguna tidak perlu merawat catatan.
- [K] Risiko: memori yang menulis sendiri sulit diaudit. Tidak ada keterangan tentang tanda "terverifikasi vs dugaan".

### 3.5 Integrasi

Konektor aplikasi, "Channels" (agen di kanal luar yang didukung), Skill Library, MCP/API, Gmail, X, Slack, GitHub [F: about, pricing]. Agen Email: baca, atur, draf, kirim. Agentic API untuk memanggil agen dari luar. Aplikasi menolak menerima kata sandi dan memandu penyambungan resmi [F: blog sub-agen].

### 3.6 Onboarding dan layar awal

Layar utama = daftar chat gaya messenger (Personal AI di atas, lalu grup, lalu agen) dengan tab Chat, Discover, Contacts, Settings [F: beranda]. Tidak ada wizard yang saya baca. [K] Mulai dari "ngobrol dengan Personal AI".

### 3.7 Batas, harga, keluhan

- Harga [F: https://teamily.ai/pricing, dimuat 19 Nov 2026]: Free $0 (5 agen kustom, 2 tugas bersamaan, batas penggunaan per jendela 5 jam dan mingguan "Base"); Plus $19,99/bulan (5x, 8 tugas bersamaan, 50 agen, 5 situs); Premium $99,99/bulan (15x, 16 tugas bersamaan, agen tak terbatas, persetujuan dan pemicu); Pro $199,99/bulan (30x, video AI). Ada paket Team. Pusat bantuan: "On-Demand Usage" membayar per token setelah jatah habis (Plus/Pro) [F: hasil pencarian atas https://teamily.ai/about/help-center].
- Ulasan pengguna nyata: **tidak ditemukan**. Klaim "5 juta pengguna" dan "10.000 pengguna beta" berasal dari rilis dan Forbes, bukan ulasan [F: blog].
- Pendiri: Aiden He dan Salman Avestimehr, anak usaha TensorOpera AI [F: blog Forbes].

### 3.7a Kelebihan dan kelemahan

- Kelebihan: arsitektur "satu utas untuk semua", rencana terlihat, paralel, memori yang bekerja otomatis, banyak orang dalam satu grup.
- Kelemahan [K]: ruang lingkup sangat lebar (sosial, feed, video), batas penggunaan rumit (jendela 5 jam, kelipatan "5x/15x/30x"), persetujuan baru jelas di paket tinggi, tidak ada bukti mutu dari pihak ketiga.

---

## 4. Profil Marblism

Sumber: https://www.marblism.com/, https://www.marblism.com/pricing, https://www.marblism.com/ai-employees/eva; ulasan: Crevio https://crevio.co/blog/marblism-review (Crevio adalah pesaing), eesel https://www.eesel.ai/blog/marblism-pricing, Carly https://www.usecarly.com/blog/marblism-ai/ (pesaing).

### 4.1 Karyawan dan keahlian [F: https://www.marblism.com/pricing]

Tujuh karyawan:
- Eva (asisten eksekutif): balas email dengan suaramu, catat rapat, kejar tindak lanjut, kalender, ringkasan pagi.
- Sonny (media sosial): pantau tren TikTok/Instagram/LinkedIn, tulis hook dan keterangan, buat foto dan video, posting 3x/hari di 7 platform, belajar dari performa.
- Stan (lead generation): basis data 700 juta kontak terverifikasi (klaim), outreach LinkedIn, email otomatis, urutan tindak lanjut, jadwalkan rapat.
- Penny (SEO): artikel mingguan, kata kunci, lacak peringkat, audit situs, tautan internal.
- Rachel (resepsionis telepon): jawab telepon 24/7, 100+ bahasa, buat janji, catat pesan dan kirim ringkasan SMS.
- Walter (pembuat situs): bangun dari prompt, terus diperbaiki, ubah dengan chat, domain sendiri.
- Linda (asisten hukum): draf kontrak, tandai klausul berisiko, templat.

### 4.2 Model obrolan

- **Satu obrolan per karyawan** dan semuanya memakai "Brain" dokumen bersama [F: https://www.usecarly.com/blog/marblism-ai/ (pesaing)]. Halaman Eva menampilkan "Chat with Eva" (contoh: "Brief me on the 3pm with Sarah").
- Tidak ada obrolan tim, @mention, atau diskusi antar-agen yang saya temukan. [K] Marblism = banyak pekerja, bukan banyak peserta chat.
- **Check-in harian**: "setiap agen melapor sekali sehari dengan pekerjaan untuk ditinjau dan disetujui" [F: Crevio]; pengulas menghabiskan 10-30 menit per hari.

### 4.3 Eksekusi

- Beranda: "Set the goal. They own it" (tetapkan tujuan, mereka mengerjakannya setiap hari) [F: https://www.marblism.com/]. Karyawan masuk ke kotak surat, kalender, media sosial, dan situs Anda dan bekerja di sana.
- Draf lalu kirim: halaman Eva menampilkan DRAFT "prepared by Eva" dengan tombol Send [F: halaman Eva].
- Terjadwal: posting rutin (Sonny), artikel mingguan (Penny), ringkasan pagi (Eva).
- Hasil: tersimpan di tempat tujuan (email terkirim, situs, posting, kalender). Tidak ada ruang hasil terpusat yang saya baca.

### 4.4 Memori

"Brain" dokumen bersama; belajar dari umpan balik pengguna [F: Crevio, Carly]. Tidak ada rincian tambahan di sumber yang saya baca.

### 4.5 Integrasi [F: beranda]

Gmail, Outlook, Instagram, Facebook, LinkedIn, TikTok, YouTube, X, Google Calendar, Zoom, Microsoft Teams, WordPress, Shopify, Webflow, Wix. Ulasan: untuk integrasi mendalam banyak alat, produk lain lebih cocok.

### 4.6 Onboarding

"Guided onboarding" dan dukungan chat langsung [F: Crevio]; demo interaktif 3 menit di beranda. Pengulas: penyiapan cepat dan antarmuka intuitif.

### 4.7 Batas, harga, keluhan

- Harga [F: https://www.marblism.com/pricing, dimuat 19 Nov 2026]: $24/bulan (tahunan) atau $44/bulan (bulanan); semua karyawan, **50 jam kerja per bulan bersama**, bisnis dan anggota tim tak terbatas. Obrolan dan tugas cepat tidak memakai jam; "aksi AI lanjutan" memakai jam; top-up tersedia tetapi tarifnya tidak dipublikasikan [F: eesel, mengutip pusat bantuan Marblism]. Harga lama "$39 tak terbatas" sudah tidak berlaku [F: eesel].
- Ulasan: Trustpilot 4,8 dari 1.149 ulasan [F: Crevio]; "85% bintang lima, 2% bintang satu". Keluhan: hasil Stan paling banyak mengecewakan; Sonny kadang kehilangan konteks pada instruksi bertahap; jam habis cepat; checkout tanpa langkah konfirmasi dan sengketa pengembalian dana [F: Crevio, eesel]; beberapa pengguna lama marah pada peralihan ke model berbasis jam [F: Crevio]. Kebijakan pengembalian dana tertulis 7 hari di satu tempat dan 77 hari di tempat lain [F: Crevio].
- Sumber yang bersaing (Crevio, Carly) punya kepentingan; jangan dipakai sendirian.

### 4.8 Kelebihan dan kelemahan

- Kelebihan: peran sangat jelas (bisnis kecil paham), eksekusi nyata di akun pengguna, persetujuan harian, harga rendah, telepon (Rachel).
- Kelemahan: tidak ada chat tim, kuota jam bersama dan tidak transparan, kualitas outreach, bukan otonom penuh.

---

## 5. Tabel perbandingan

| Aspek | Sintra | Marblism | Teamily |
|---|---|---|---|
| Jumlah/jenis agen | 12 helper bernama (bisnis + pribadi) | 7 karyawan bernama (operasional UKM) | Personal AI, agen kustom tak terbatas, direktori publik |
| Bentuk chat | Satu chat per helper; Vizzy sebagai pintu | Satu chat per karyawan + check-in harian | Grup bersama manusia + banyak agen; DM; studio |
| Router | Vizzy menyarankan dan memanggil helper; pengguna juga memilih | Tidak ada (pilih karyawan) | "Social Brain" + router semantik; master AI mendatangkan ahli |
| @mention | Tidak ditemukan | Tidak ditemukan | Ya |
| Agen berdiskusi | Tidak (Vizzy menyampaikan dari Soshie); helper tak berbagi konteks | Tidak ditemukan | Orkestrasi dan sub-agen; paralel; bukan "rapat" yang terdokumentasi |
| Persetujuan aksi keluar | Draf, ubah/jadwalkan/tolak | Draf, check-in harian, Send | Konfirmasi di Plus; aturan otomatis di Premium |
| Terjadwal | Otomasi sederhana, ringkasan harian | Posting/artikel/ringkasan rutin | Bahasa biasa jadi jadwal; batas 8/32 |
| Hasil | Kalender, kotak masuk, dasbor per helper | Di akun tujuan | Studio, dokumen, situs, artefak |
| Memori | Brain AI (diisi manual, simpan cepat, pertanyaan harian, 5 profil) | Brain dokumen bersama | Memori hidup otomatis lintas grup |
| Integrasi | 15+ (klaim 1000+) | Email, sosial, kalender, CMS, Zoom/Teams | Konektor, MCP, API, kanal luar, Gmail, Slack, GitHub |
| Onboarding | Kuesioner + analisis situs + Vizzy usul tugas | Pemandu + demo 3 menit | Layar chat langsung |
| Harga | ~$15,60-$48,50/bln, 250 kredit | $24-$44/bln, 50 jam bersama | $0 / $19,99 / $99,99 / $199,99 |
| Keluhan utama | Kredit habis, tak top-up, batal sulit | Jam habis, outreach lemah | Tidak ada ulasan ditemukan |

---

## 6. Pola UX: ditiru dan dihindari

### 6.1 Patut ditiru

1. **Satu pintu, banyak spesialis di utas yang sama** (Vizzy menyampaikan dari Soshie; master AI Teamily). Pengguna tak pindah layar.
2. **Draf dulu, aksi kemudian**: kartu berisi gambar/teks, tanggal, tujuan, tombol Ubah / Jadwalkan / Tolak (Sintra, Marblism).
3. **Rencana yang terlihat** saat tugas berjalan, sementara obrolan tetap bisa dilanjutkan (Teamily).
4. **Memori yang diisi dari obrolan** (simpan cepat ke Brain, ringkasan keputusan) dan pertanyaan balik harian agar memori tidak kosong.
5. **Layar awal yang menyarankan tiga tugas pertama** (Vizzy) alih-alih halaman kosong.
6. **Tugas terjadwal dari satu kalimat** ("tiap hari jam 10") dengan sampel langsung (Teamily).
7. **Menolak kata sandi dan memandu penyambungan resmi** (Teamily).
8. **Check-in ringkas** per agen (Marblism), tetapi digabung jadi satu kartu "Butuh kamu".

### 6.2 Patut dihindari

1. Kuota yang tak terlihat dan tarif top-up tersembunyi (keluhan Sintra dan Marblism).
2. Kredit terbakar karena memperbaiki kesalahan AI (keluhan Sintra) [K]: tampilkan biaya dan batalkan langkah gagal tanpa biaya.
3. Helper yang tak berbagi konteks sehingga pengguna menjadi kurir (Unite.AI).
4. Kartu yang tidak muncul di chat (Unite.AI).
5. Janji otonom padahal harus setuju tiap hari (Marblism).
6. Terlalu banyak tambahan tanpa panduan (90+ Power-Up Sintra).
7. Memori yang menulis diri sendiri tanpa tanda "terverifikasi / dugaan" [K].
8. Fitur sosial dan feed publik yang tidak relevan untuk pengguna perusahaan [K].

---

## 7. RANCANGAN CHAT ENGINE UNTUK RAIVERSE

### 7.0 Titik berangkat: yang SUDAH ada (diperiksa di kode)

Dibaca dari `docs/FUNDAMENTAL/01-FUNDAMENTAL.md`, `docs/PETA-OTAK.md`, `docs/PETA-BACKEND.md`, `docs/FUNDAMENTAL/riset/02-integrasi-dan-agen.md`, dan `server/engine.js`, `server/collab.js`:

- **Hierarki**: Owner, asisten pribadi (PA) dan master, 22 manajer divisi, 238 staf (216 staf nyata), 31 kemampuan inti.
- **Chat sudah banyak**: `orchestrate()` (engine.js ~1596) menerima teks + `@nama`; bila tak ada yang disebut dan terbaca sebagai pekerjaan, ia membuat **goal** dengan utas sendiri (`ensureGoalThread`); bila tidak, ia membuat/memakai DM atau **grup** (`ensureGroup`, ~1172, id `grp-...`).
- **`onHumanMessage()`** (~1263) sudah menangani: niat rapat (`meetingIntent`), siaran (`broadcastScope`), @mention, utas goal (PA menjawab, kepala yang disebut bergabung), grup (giliran bergantian: `for (const e of targets) await replyAs(...)`, maks 4 agen di grup, 3 di lainnya).
- **Rapat** (`collab.runMeeting`, ~198): 2-7 peserta, 1-3 putaran, ketua, notulen, item aksi jadi tugas; rapat dipimpin Owner mencegah agen menyela sampai Owner bilang "selesai".
- **Alat agen**: `ask_colleague`, `convene_meeting`, `create_subtask`, `request_approval`, `complete_task`, `buka_alat`, `search_brain`, `write_note` (draf), `memory` (butuh persetujuan), `staf`.
- **Persetujuan**: `approvals.js` satu pintu; review, otomasi, aksi browser tidak pernah disetujui otomatis.
- **Memori**: Brain (Catatan) dengan tanda kepercayaan Owner/Drive/Sistem = fakta, hasil agen = draf.
- **Saluran luar**: Telegram dan Discord lewat `channels/*`, menerjemahkan ke giliran yang sama.
- **Pemandu** (`pemandu.js`): wajah depan berbasis menu/tombol. Ini yang diminta diganti.

[K] Jadi masalahnya BUKAN menciptakan mesin multi-agen baru. Mesinnya sudah ada. Yang kurang: satu lapisan percakapan di depan yang menyatukan semuanya, tanpa menu "pemandu".

### 7.1 Prinsip desain (dari riset ini)

1. **Satu utas = satu tempat** untuk bicara, kemajuan, persetujuan, dan hasil (belajar dari Teamily dan Vizzy+Soshie).
2. **Pintu tunggal bernama**: asisten pribadi (PA) adalah lawan bicara bawaan. Spesialis datang ke utas, pengguna tidak pindah layar.
3. **Obrolan dulu, aksi bila diminta**: tidak ada menu. Tombol hanya muncul sebagai kartu konfirmasi atau saran singkat yang dihasilkan dari konteks.
4. **Biaya dan batas terlihat** (kebalikan dari keluhan Sintra/Marblism).
5. **Jujur** (prinsip 9 Fundamental): bila belum tersambung, katakan.

### 7.2 Satu sistem obrolan: model ruang dan peserta

Ruang percakapan ("utas") hanya tiga jenis, memakai `channels` yang sudah ada:

| Jenis | Kunci kode yang ada | Siapa menjawab | Dipakai untuk |
|---|---|---|---|
| **Utas utama (Asisten)** | DM dengan PA (`ensureDM`) | PA | Diskusi panjang, pertanyaan, titik masuk semua permintaan |
| **Utas goal / tugas** | `ensureGoalThread` | PA bawaan; kepala divisi yang disebut bergabung | Pekerjaan bertahap dengan kemajuan dan hasil |
| **Utas tim** | `ensureGroup` / kanal divisi | Agen yang disebut (@) atau yang ditebak lewat `namesIn` | Bicara dengan banyak agen sekaligus |
| **Rapat** | `runMeeting`, saluran `mtg-...` | Ketua + peserta bergiliran | Diskusi terarah dengan hasil |

Tidak ada utas khusus per spesialis seperti Sintra. Spesialis hanya dipanggil ke salah satu utas di atas (Pola A: Vizzy menyampaikan Soshie).

### 7.3 Satu alur masuk: "router" tanpa menu

Semua pesan lewat `orchestrate()`. Urutan keputusan (aturan murah dulu, model kecil bila ambigu; tidak ada pertanyaan "pilih menu"):

```
Pesan masuk
  ├─ ada @nama / nama agen?  ──► tambah agen ke utas, agen itu menjawab (maks 4)
  ├─ di dalam rapat Owner?   ──► jangan menyela, sampai Owner bilang "selesai"
  ├─ niat rapat? ("rapat", "diskusikan bersama")  ──► rapat singkat (7.6)
  ├─ siaran? ("semua divisi ...")                 ──► pesan ke banyak agen (7.5)
  ├─ terbaca sebagai pekerjaan & tidak ada @      ──► goal baru + utas goal
  │       (looksLikeWork, atau tombol/mode "Goal" eksplisit)
  └─ selain itu                                    ──► PA menjawab (diskusi)
```

Tambahan yang disarankan (belum ada, [K]):
- **Pertanyaan klarifikasi satu kalimat** dari PA bila ambigu antara obrolan dan pekerjaan, bukan menu tombol.
- **Penunjuk "mengapa agen ini"**: label kecil di bawah balasan ("dijawab Kepala Pemasaran karena kamu menyebut kampanye"). Meniru transparansi router Teamily dan membantu pengguna belajar @.
- Pemandu lama (`pemandu.js`) diubah dari "menu berbasis kamus" menjadi lapisan tipis di dalam PA: kamus kata teknis dipertahankan sebagai penyaring bahasa balasan saja.

### 7.4 (a) Diskusi panjang dengan asisten utama

- PA menjawab di utas utama dengan `chatSystem` (tanpa daftar alat), memori kecil, 3 catatan Brain paling relevan, dan `session_search` untuk riwayat.
- **Memadatkan diskusi panjang**: setiap N giliran, PA menulis ringkasan berjalan ("sejauh ini: keputusan, pertanyaan terbuka") yang menggantikan riwayat lama di prompt. Ringkasan itu juga jadi draf Catatan (7.8).
- Tombol "Jadikan tugas" muncul di bawah balasan yang berisi rencana. Sekali klik membuat goal dari ringkasan, tanpa mengetik ulang (menghindari "pengguna jadi kurir konteks", masalah 1 di blog Teamily).
- Model: kecil untuk obrolan, besar bila PA merencanakan (aturan `governor.modelTier` yang sudah ada).

### 7.5 (b) Eksekusi lewat alat, dengan konfirmasi

- Alat obrolan tetap kecil dan hanya yang aman: `search_brain`, `company_status`, `ask_colleague`, `web_search`, `calculate` + `create_task` (sudah di `replyAs`).
- Pekerjaan sebenarnya selalu menjadi **tugas** (satu gerbang kuota `createTask`), dikerjakan manajer dan staf. Chat tidak mengeksekusi aksi berdampak langsung.
- **Konfirmasi sebelum aksi keluar** (bagian keamanan PETA-BACKEND 6): kartu di utas dengan pratinjau persis (siapa penerima, isi, kapan) + [Ya, kirim] [Ubah] [Batal]. Berlaku untuk: kirim email/pesan luar, tulis ke Drive/Sheets, otomasi n8n, aksi browser, uang/kontrak/HR/publikasi. Sudah ada di `approvals.js`; yang baru adalah **menampilkannya sebagai kartu di utas yang sama**, bukan layar terpisah.
- **Tugas terjadwal**: kalimat biasa ("tiap Senin jam 8 ringkas penjualan") membuat otomasi lewat n8n dengan kartu konfirmasi (sudah ada di Pemandu; dipindah ke PA). Tampilkan "Jadwal Saya" ringkas dan jumlah sisa kuota.
- **Batas biaya terlihat**: tiap kartu tugas menampilkan perkiraan "kecil/sedang/besar" dan sisa kuota harian (governor). Tidak ada kredit tersembunyi.

### 7.6 (c) Bicara dengan banyak agen sekaligus

Tiga bentuk, semuanya memakai yang sudah ada:

1. **Obrolan tim (grup)**: Owner membuat atau otomatis mendapat grup lewat `ensureGroup` ketika menyebut beberapa agen. Agen menjawab **bergantian** (agar yang kemudian membaca yang sebelumnya), maks 4 sekali jalan. Tiap pesan punya avatar, nama, peran.
2. **@mention**: `@nama` di mana saja menambah agen ke utas dan menjadikannya penjawab. Autocomplete @ di kotak ketik menampilkan nama, divisi, dan satu baris keahlian (meniru "kontak" Teamily). Di utas goal, nama yang disebut bergabung dengan pesan "bergabung".
3. **Rapat singkat antar agen** (`convene_meeting` / `runMeeting`):
   - Pemicu: Owner ("rapatkan Pemasaran dan Keuangan soal anggaran") atau agen (`convene_meeting`).
   - Peserta 2-7, **moderator = ketua** (manajer atau master), 1-3 putaran, bergiliran; agen lain tidak menyela.
   - Di utas yang sama tampil: undangan, ringkasan tiap giliran (diciutkan, bisa dibuka), dan akhir **rangkuman**: keputusan, perbedaan pendapat, item aksi.
   - Item aksi diusulkan sebagai tugas dengan tombol [Buat semua] [Pilih]; tidak otomatis.
   - **Moderasi** (kontrol Owner): tombol [Ikut bicara] (`ownerSpeaks`), [Akhiri sekarang], dan batas waktu/putaran supaya biaya terbatas.
- Teamily tidak mendokumentasikan "rapat antar agen"; ini keunggulan RAIVERSE yang sudah ada dan perlu ditonjolkan. Sintra/Marblism tidak punya.
- **Siaran**: "semua divisi, laporkan status" memakai `broadcastScope` dan merangkum balasan menjadi satu kartu, supaya utas tidak banjir.

### 7.7 (e) Kemajuan dan hasil di utas yang sama

Setiap pekerjaan membuat **satu kartu hidup** di utas (diperbarui, bukan pesan baru tiap langkah):

```
[Kartu tugas]  Laporan penjualan Oktober          sedang berjalan
  ├─ Pemasaran: riset pesaing ............ selesai
  ├─ Analis data: hitung angka ........... berjalan
  └─ Penulis: draf ....................... menunggu
  [Jeda] [Batalkan] [Lihat langkah]      biaya: sedang, kuota 41/300
```

- Sumber data: `store` (tugas, subtugas, `logTask`), siaran langsung yang sudah ada. Status berbahasa awam dari `STATUS_FOR_TOOL` ("Riset web", "Menjalankan staf", "Minta persetujuan").
- Saat selesai: kartu hasil berisi ringkasan, **bukti** (catatan terverifikasi, URL, berkas), bagian **"Belum terpenuhi"** (sudah ada di `complete_task`), tautan berkas (`data/staff-out`), dan 2-4 saran. Tidak ada klaim tanpa bukti.
- Kartu **"Butuh kamu"**: semua permintaan persetujuan dan review dari beberapa agen digabung jadi satu daftar dan satu kartu per keputusan; tidak ada check-in terpisah per agen (hindari beban 10-30 menit/hari ala Marblism).
- Semua tersimpan juga di **Hasil Saya**, tetapi sumbernya satu: kartu di utas menunjuk ke objek yang sama.

### 7.8 (d) Memori bersama (Catatan)

- **Satu penyimpanan**: Brain/Catatan yang sudah ada. Tidak ada memori terpisah per agen yang bisa bertentangan.
- **Mengisi**:
  1. Otomatis: ringkasan utas, keputusan rapat, hasil tugas ditulis sebagai **draf** (tanda "hasil agen").
  2. Cepat: tombol [Simpan ke Catatan] di bawah pesan mana pun (meniru quick-save Sintra).
  3. Unggah: berkas dan tautan (via `librarian.js`/Drive).
  4. Pertanyaan balik harian: PA satu kali sehari menanyakan satu hal yang belum diketahui tentang perusahaan, jawaban jadi catatan. (Meniru Sintra, tetapi maksimal satu pertanyaan, bisa dimatikan.)
- **Kepercayaan**: edit atau konfirmasi Owner mengubah draf jadi "terverifikasi" (sudah ada). Memori yang menulis sendiri tanpa tanda adalah kelemahan Teamily yang dihindari.
- **Dipakai**: tiap giliran agen membaca 3 catatan relevan; alat `memory` tetap butuh persetujuan pengguna.
- **Privasi antar utas**: sebuah catatan bertanda sumber utas; agen hanya membaca catatan yang boleh dilihat peran dan divisinya.

### 7.9 Layar dan tampilan pesan (tanpa mengubah 3D)

- Satu kolom utas: kiri daftar utas (Asisten, Goal aktif, Tim, Rapat), tengah pesan, kanan panel detail (draf/berkas) seperti panel kanan Sintra.
- Pesan per agen: avatar 3D kecil, nama, peran, penanda "mengapa dia".
- Pesan sistem kecil dan abu-abu (bergabung, kartu tugas). Kartu hanya muncul **di dalam** utas (hindari kartu yang tidak terlihat di chat).
- Telegram/Discord: sama, kartu menjadi teks + tombol bawaan platform; konfirmasi tetap wajib.
- Layar awal: bukan wizard. Chat kosong dengan satu kalimat sapaan PA dan 3 saran yang dihasilkan dari data perusahaan (meniru tiga tugas pertama Vizzy).

### 7.10 Yang perlu dibangun (urutan dampak) dan yang tidak

Sudah ada, tinggal dirangkai: routing `orchestrate`/`onHumanMessage`, grup bergiliran, rapat, persetujuan, Brain, jadwal n8n, saluran Telegram/Discord.

Perlu dibangun (urut):
1. Mengganti Pemandu menu menjadi PA percakapan (satu pintu) dengan penanda "mengapa agen ini".
2. Kartu tugas hidup + kartu persetujuan **di dalam utas**.
3. Ringkasan berjalan untuk diskusi panjang + tombol "Jadikan tugas".
4. Kartu rapat dengan moderator, rangkuman, dan [Buat semua tugas].
5. Autocomplete @ dengan keahlian; penggabungan "Butuh kamu".
6. Simpan-ke-Catatan dan pertanyaan harian; label kepercayaan.
7. Indikator biaya/kuota di kartu tugas.

Tidak ditiru:
- Roster dua belas helper "satu chat per orang" (RAIVERSE punya hierarki dan staf; chat per spesialis memecah konteks).
- Feed sosial/direktori publik Teamily.
- Check-in harian per agen.
- "Memori hidup" tanpa tanda kepercayaan.

### 7.11 Risiko dan hal yang belum terbukti (jujur)

- Saya tidak melihat isi aplikasi ketiga produk (di belakang login). Deskripsi layar berasal dari ulasan dan halaman produk.
- Bagaimana Teamily menangani giliran bicara antar banyak agen dan "Loops" tidak dijelaskan rinci publik.
- Tidak ada uji RAIVERSE dengan model sungguhan atas routing baru. Perubahan 7.3 perlu tes: pesan ambigu, @ ke agen di luar utas, rapat yang dipotong Owner.
- Beban biaya model untuk rapat dan ringkasan berjalan harus diukur oleh `governor` sebelum dibuka ke pengguna.
- Perubahan di depan memengaruhi layar yang "beku"; sesuai `AGENTS.md`, pekerjaan visual wajib membaca `VISUAL-LOCK.md` dan menjalankan `node docs/mascot-v4-2/verify-v42.mjs` sebelum dan sesudah.

---

## 8. Daftar sumber

- Sintra: https://sintra.ai/ai-employees, https://sintra.ai/pricing, https://sintra.ai/shop, https://sintra.ai/sintra-x, https://sintra.ai/features/brain-ai, https://www.unite.ai/sintra-ai-review/, https://gmelius.com/blog/sintra-ai-review, https://www.trustpilot.com/review/sintra.ai, https://g2.com/products/sintra-ai/reviews, https://help.sintra.ai/en/articles/15012096-agent-helpers (tidak terbaca).
- Teamily: https://teamily.ai/, https://teamily.ai/about, https://teamily.ai/pricing, https://teamily.ai/about/help-center (hanya via kutipan pencarian), https://blog.teamily.ai/ dan pos-pos: teamily-ai-brings-agent-teams-to-human-teams, what-problems-we-learn-from-users-and-how-we-solve-them, scheduled-recurring-tasks-automated-daily-b, personal-ai-cross-context-memory-and-sub-agent-teams, create-and-train-your-agent-team-effortlessly, personal-ai-create-your-ai-twin, cross-context-personal-knowledge-base-with-social-graph.
- Marblism: https://www.marblism.com/, https://www.marblism.com/pricing, https://www.marblism.com/ai-employees/eva, https://crevio.co/blog/marblism-review, https://www.eesel.ai/blog/marblism-pricing, https://www.usecarly.com/blog/marblism-ai/.
- Internal: `docs/FUNDAMENTAL/01-FUNDAMENTAL.md`, `docs/PETA-OTAK.md`, `docs/PETA-BACKEND.md`, `docs/FUNDAMENTAL/riset/02-integrasi-dan-agen.md`, `server/engine.js` (`orchestrate`, `onHumanMessage`, `ensureGroup`, `replyAs`), `server/collab.js` (`runMeeting`).
