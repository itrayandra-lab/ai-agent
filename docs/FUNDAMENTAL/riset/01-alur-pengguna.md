# Riset 01: Alur pengguna ChatGPT (dari pertama masuk sampai mahir)

Tanggal riset: 2026-11-19. Tanda: [F] = fakta dari sumber (URL disebut), [K] = kesimpulan saya, [?] = tidak bisa dipastikan.

Catatan jujur tentang sumber:
- `learn.chatgpt.com` (dokumen dan pelatihan resmi) bisa dibaca penuh. Ini sumber utama.
- `help.openai.com` dan `openai.com` menolak pengambilan langsung (HTTP 403). Isi bantuan di bagian 4 dan 5 saya ambil dari ringkasan hasil pencarian atas halaman resmi itu, bukan dari teks utuh. Ketepatan angka (batas, jumlah berkas) harus dicek lagi di halaman hidupnya.
- Saya TIDAK membuat akun atau melihat layar langsung. Hal yang tidak ada di dokumen (teks persis layar pertama, daftar saran awal di layar) ditandai [?].
- Produk bergerak cepat: pada 2026-11-02 OpenAI mengabarkan Chat dan Work akan digabung. Semua yang menyangkut "tombol Chat/Work" bisa berubah dalam hitungan minggu.

---------------------------------------------------------------------
## 1. RINGKASAN 10 BARIS

1. ChatGPT dibuka langsung ke kotak tulis. Dokumen resmi: "A new chat is already waiting when you open the app" ([OpenAI Academy](https://openai.com/academy/getting-started/), lewat hasil pencarian). Tidak ada tur wajib. [F]
2. Masuk memakai satu akun ChatGPT di web (chatgpt.com), desktop (macOS, Windows, Linux), dan HP. Akun dan ruang kerja yang sama dipakai di semua perangkat. [F] https://learn.chatgpt.com/docs/quickstart
3. Pilihan awal hanya dua kata di atas kotak tulis: Chat (tanya cepat, gagasan) atau Work (tugas bertahap yang menghasilkan sesuatu untuk diperiksa). [F] https://learn.chatgpt.com/docs/get-started-with-work
4. "Getting started" resmi bukan daftar centang wajib. Isinya pelatihan 9 panduan pendek (6 sampai 15 menit) dengan urutan saran, tanpa penanda selesai atau persen kemajuan. [F] https://learn.chatgpt.com/training dan https://learn.chatgpt.com/training/complete
5. Panduan pertama cuma 3 langkah: sambungkan aplikasi (Gmail, Slack), pakai lewat obrolan, coba tugas sederhana. [F] https://learn.chatgpt.com/training/walkthroughs/getting-started
6. Kemampuan lanjutan muncul bertahap, saat dibutuhkan: proyek (kumpulan obrolan, berkas, instruksi), plugin (`@nama`), skill (cara kerja yang disimpan), tugas terjadwal, suara, kendali dari HP. [F] https://learn.chatgpt.com/docs/use-chatgpt
7. Aturan "satu jalur" yang diulang di mana-mana: kerjakan sekali, perbaiki hasilnya, baru simpan sebagai skill atau jadwalkan. [F] https://learn.chatgpt.com/training/walkthroughs/scheduled-tasks
8. Rasa aman dibangun lewat hasil yang bisa diperiksa: "Return a draft for my review", "stop before sending anything", persetujuan untuk tindakan penting. [F] https://learn.chatgpt.com/docs/get-started-with-work
9. Pengaturan dan data punya jalur tetap (Settings, lalu Personalization atau Data controls), dengan sakelar yang bisa dibalik kapan saja dan Temporary Chat sebagai jalan keluar cepat. [F] https://learn.chatgpt.com/docs/personalize.md dan help.openai.com (via pencarian)
10. Batas pemakaian ditampilkan di dalam produk dengan waktu reset, bukan dolar. Chat teks harian di paket gratis disebut tanpa batas, batas terpisah ada untuk berkas, gambar, suara. [F, via ringkasan pencarian] https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq

---------------------------------------------------------------------
## 2. PETA ALUR PENGGUNA PER TAHAP

Hitungan langkah = jumlah tindakan sengaja pengguna (klik, ketik, pilih) menurut dokumen resmi. Bila angkanya dari dokumen, [F]. Bila hitungan saya sendiri dari urutan dokumen, [K].

### 2.1 Tahap PERTAMA KALI

- A. Mendapat akses
  - Web: buka chatgpt.com, masuk dengan akun ChatGPT. [F] https://learn.chatgpt.com/docs/quickstart (web, langkah 1)
  - Desktop: unduh aplikasi (macOS/Windows/Linux), buka, masuk. [F] sumber sama (desktop, langkah 1-2)
  - HP: buka aplikasi, pilih Work (untuk Work). [F] https://learn.chatgpt.com/training/walkthroughs/working-on-your-phone
  - Cara daftar: email, atau akun Google, Microsoft, Apple. [K, dari panduan pihak ketiga, lihat catatan] Verifikasi nomor telepon: sumber bertentangan, satu panduan menyebut sudah tidak wajib. [?]
  - Verifikasi umur: di beberapa wilayah muncul spanduk saat masuk dengan instruksi dan tenggat. [F, via pencarian] https://help.openai.com/en/articles/8411987
  - Langkah menuju kotak tulis: web 2 (buka, masuk). Desktop 3 (unduh, buka, masuk). [K]
- B. Layar pertama
  - Web: tajuk "What should we work on?", kotak tulis berlabel "Work with ChatGPT", tombol `+`, mikrofon, kirim (panah atas). [F] https://learn.chatgpt.com/docs/web
  - Bilah samping: "New chat", "Projects" (ada `+`), "Recents". Di atasnya baris dengan nama, ikon cari, dan tombol bilah samping. [F] sumber sama
  - Pemilih Chat / Work di atas kotak tulis. Pilihan di kotak tulis: "Choose project", "Custom", "Plugins", "Work locally". Pemilih model dan tingkat usaha (contoh "Medium", "Light"). [F] sumber sama
  - Contoh saran di layar (web): "Make a decision", "Daily briefing", "Plan an event". Desktop: "Prepare a decision", "Analyze spreadsheets", "Improve this app". [F] https://learn.chatgpt.com/docs/quickstart
  - Teks persis layar pertama pengguna baru dan apakah ada pertanyaan nama atau tur: [?] tidak ada di dokumen resmi.
- C. Pilihan "Getting started"
  - Resmi: panduan "Getting started with ChatGPT Work" (8 menit), plus dua kartu "Start here": "Plan something from start to finish" (20-25 menit, Work) dan "Make your first code change" (15-25 menit, Codex). [F] https://learn.chatgpt.com/training
  - Isi panduan pertama (3 langkah): 1) Connect the right apps (Plugins, cari Gmail, Install, lalu Slack). 2) Use the connected apps (cari email, ambil konteks Slack, susun balasan, periksa, kirim). 3) Try it (unduh desktop, masuk, pilih Work, coba tugas Gmail sederhana). [F] https://learn.chatgpt.com/training/walkthroughs/getting-started
  - Contoh perintah pertama: "Check the last 30 days in my @Gmail and give me top candidates to unsubscribe from." [F] sumber sama
  - Tidak ada "Mark as complete", tidak ada persen. Halaman penutup hanya berjudul "Continue after hands-on training" dengan "Up next: Plugins and skills" dan ajakan "Try a task of your own in the ChatGPT app". [F] https://learn.chatgpt.com/training/complete
  - [K] Jadi "checklist beberapa langkah" di dalam aplikasi tidak saya temukan di dokumentasi. Yang resmi: 3 langkah di dalam satu panduan, bukan daftar centang yang tersimpan.
- D. Tugas utama pertama kali dan jumlah langkah
  - Kirim pesan pertama (web): 4 langkah resmi: buka dan masuk, mulai obrolan (Chat atau Work), pilih tempat kerja (obrolan atau proyek), kirim pesan. [F] https://learn.chatgpt.com/docs/quickstart
  - Kirim pesan pertama (desktop): 5 langkah: unduh, buka dan masuk, pilih tempat (obrolan, proyek, atau folder), mulai obrolan (ChatGPT/Work, Chat, atau Codex), kirim pesan. [F] sumber sama
  - Pasang satu plugin: 3 langkah: Customize, Plugins, pasang. Lalu `@nama` di pesan. [F] https://learn.chatgpt.com/docs/get-started-with-work
  - Tugas Work pertama: 3 langkah: pilih Work, pilih tugas (hasil jelas, beberapa bahan, keluaran bisa diperiksa), kirim. [F] sumber sama

### 2.2 Tahap HARIAN

- Mulai pekerjaan
  - Chat untuk jawaban, penjelasan, curah gagasan, draf pendek. Work untuk tugas bermanfaat nyata: ringkasan, dek, analisis, pembaruan berulang, berkas yang bisa diperiksa. [F] https://learn.chatgpt.com/docs/get-started-with-work
  - Aturan pilih (kata resmi): mulai di Chat bila cukup satu percakapan. Work bisa lebih lama dan memakai lebih banyak kredit. [F] https://learn.chatgpt.com/training/walkthroughs/getting-started
  - Langkah: 1 (ketik dan kirim, Chat). Work: 2 (pilih Work, ketik dan kirim). [K]
- Mengarahkan alat
  - Ketik `@` lalu pilih plugin atau skill dari menu. [F] https://learn.chatgpt.com/training/walkthroughs/plugins-and-skills
  - Jumlah langkah memakai plugin yang sudah terpasang: 2 (ketik `@nama`, jelaskan hasil). Periksa hasil jadi langkah ke-3. [F] sumber sama
- Meninjau dan mengarahkan
  - Ikuti kemajuan, jawab pertanyaan, ubah arah, setujui tindakan penting. [F] https://learn.chatgpt.com/docs/get-started-with-work
  - Hasil berkas tampil di penampil (contoh "1/8" halaman, zoom "100%") dan bisa diunduh. [F] https://learn.chatgpt.com/docs/web
  - Meminta revisi terarah, bukan menulis ulang seluruh perintah. [F] https://learn.chatgpt.com/docs/prompting
- Proyek
  - Pakai obrolan sekali pakai untuk satu tugas. Pakai proyek bila obrolan, berkas, dan instruksi perlu tetap bersama. [F] https://learn.chatgpt.com/docs/web
  - Cara membuat: tombol `+` di samping "Projects" di bilah samping, atau "Choose project" di kotak tulis. [K, dari label di https://learn.chatgpt.com/docs/web]
  - Proyek punya memori sendiri bagi obrolan dan berkas di dalamnya. Proyek bersama memakai memori khusus proyek. [F, via pencarian] https://help.openai.com/en/articles/10169521-projects-in-ChatGPT
  - Batas berkas per proyek: Free 5, Go dan Plus 25, Business/Enterprise/Edu 40. [F, via ringkasan pencarian, sumber saling berbeda, cek ulang]
- Berkas
  - Unggah dokumen, presentasi, spreadsheet, PDF, gambar, ekspor data. Ringkas, bandingkan, ambil isi. [F] https://learn.chatgpt.com/docs/use-chatgpt
  - Berkas tersimpan di "Library", terpisah dari batas harian. Hapus obrolan tidak menghapus berkas Library. [F, via pencarian] https://help.openai.com/en/articles/10169521-file-storage-and-library-in-chatgpt
  - Batas unggah paket gratis: 3 berkas per hari. [F, via pencarian, cek ulang]
- Riwayat
  - "Recents" di bilah samping. Chat dari web dan HP muncul bersama chat Work di desktop. [F] https://learn.chatgpt.com/docs/use-chatgpt
  - Arsip: mengeluarkan obrolan dari bilah samping tanpa menghapus, tetap bisa dicari. Hapus: permanen. "Delete all chats" tidak bisa dibatalkan. Kelola arsip di Settings, Data controls, Manage. [F, via pencarian] https://help.openai.com/en/articles/8809935-deleting-and-archiving-chats-in-chatgpt
  - Sematkan (pin) obrolan: tidak ada dokumentasi resmi yang saya temukan. [?]
  - Langkah arsip/hapus satu obrolan: 2 (menu obrolan, lalu pilih). [K, tidak dibuktikan teks resmi]
- Berbagi
  - Tautan bagi anonim secara bawaan. Siapa pun yang punya tautan bisa buka. Tidak bisa dibatasi per orang untuk akun pribadi. Hapus tautan lewat Settings, Data controls, Shared links, Manage, "Delete shared link". Menghapus tautan tidak menghapus obrolan aslinya. [F, via pencarian] https://help.openai.com/en/articles/7925741-chatgpt-shared-links
  - Di ruang kerja: kontrol "Who has access", "Only people and groups invited", lalu "Copy link" (3 langkah setelah memilih Share). [F] https://learn.chatgpt.com/docs/use-chatgpt
- Suara
  - Desktop: ikon Voice dipilih SEBELUM pesan pertama, lalu bicara. Pertama kali: izinkan mikrofon, pilih suara, tinjau Screen context di Mac. [F] https://learn.chatgpt.com/training/walkthroughs/using-voice
  - Di kotak tulis web ada ikon mikrofon langsung. [F] https://learn.chatgpt.com/docs/web

### 2.3 Tahap MAHIR

- Skill (cara kerja tersimpan): 4 langkah: kerjakan sekali, simpan caranya, pakai lagi dengan bahan baru, perbaiki. Contoh nama "meeting-prep", dipanggil `@meeting-prep`; minta "ask before creating or changing events". [F] https://learn.chatgpt.com/training/walkthroughs/plugins-and-skills
- Tugas terjadwal: 3 langkah: jalankan sekali di obrolan biasa, minta jadwalkan di obrolan yang sama (contoh "Schedule this task to run every weekday at 9:00 AM"), sambungkan plugin yang perlu. [F] https://learn.chatgpt.com/training/walkthroughs/scheduled-tasks
  - Kelola di tab "Scheduled": lihat aktif/jeda, jadwal berikutnya, hasil terakhir dan riwayat, ubah, jeda, hapus. Berlatih tanpa jalan sungguhan: jeda dulu setelah mengecek jadwal berikutnya. [F] sumber sama
  - Batas tugas aktif: Free dan Go 3, Plus 5, Business dan Edu 10, Pro dan Enterprise 15. Maksimal satu kali per jam. Tidak untuk obrolan suara, GPT, obrolan terkunci. [F, via pencarian, cek ulang] https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
  - Notifikasi: Settings, Notifications: Push, Email, atau keduanya. Push HP butuh tugas dibuat di aplikasi HP dan izin diterima. [F, via pencarian] sumber sama
- Awan atau lokal: "Cloud" untuk tugas yang tidak butuh komputermu (cek situs terjadwal), "Local" untuk berkas dan aplikasi di komputer. Komputer harus menyala bila tugas butuh berkas lokal. [F] https://learn.chatgpt.com/docs/get-started-with-work
- HP: buka aplikasi, pilih Work, mulai tugas atau lanjutkan. Remote (kendali komputer dari HP): 5 langkah (buka desktop, Settings, Connections, Control this Mac or PC, Set up atau Add, pindai QR, pilih komputer, biarkan komputer menyala dan masuk akun sama). Di Remote: lihat tugas, setujui tindakan, tinjau hasil, mulai tugas baru. [F] https://learn.chatgpt.com/training/walkthroughs/working-on-your-phone
- Personalisasi
  - Settings, Personalization, "Base style and tone" (gaya dan nada, bukan kemampuan). Settings, Personalization, Writing: matikan "Reference my writing style" bila tak mau. [F] https://learn.chatgpt.com/docs/personalize.md
  - Gaya tulis di Work: 4 langkah: buka halaman "Set up writing style", sambungkan aplikasi email/pesan/dokumen, pilih "Use writing style" (hanya menyambung belum selesai), minta Work menulis. [F] sumber sama
  - Instruksi kustom: preferensi yang berlaku di semua obrolan. Memori: konteks dari obrolan lama. Aturan yang wajib selalu berlaku sebaiknya ditulis sebagai instruksi, bukan mengandalkan memori. [F] sumber sama
  - Memori: Settings, Personalization, Manage memories. Mematikan tidak menghapus yang sudah ada. Menghapus obrolan tidak menghapus memori. "Reference saved memories" dan "Reference chat history" berkaitan (mematikan yang pertama mematikan yang kedua). Temporary Chat untuk obrolan tanpa memori. [F, via pencarian] https://help.openai.com/en/articles/8590148-memory-faq
  - Computer History (macOS, opt-in): jeda, kecualikan aplikasi dan situs, periksa dan hapus butir, hapus semua. Tanpa tangkapan layar, tanpa rekaman suara. [F] https://learn.chatgpt.com/docs/personalize.md
- Data dan keamanan
  - Settings, Data controls: sakelar "Improve the model for everyone" (bawaan hidup di akun pribadi, mematikan tidak menghapus riwayat). Ekspor data dari pengaturan. Hapus akun: permanen. [F, via pencarian] https://help.openai.com/articles/7730893-data-controls-in-chatgpt
  - Temporary Chat: tidak masuk riwayat, tidak membuat memori, tidak dipakai melatih model, bisa disimpan hingga 30 hari untuk keamanan. [F, via pencarian] https://help.openai.com/en/articles/7730893-data-controls-faq
  - Izin: tugas Work boleh dijeda oleh pemantau keamanan; ikuti pemberitahuan lalu tinjau temuan. [F] https://learn.chatgpt.com/docs/get-started-with-work
- Model: pilihan "GPT-6.2 Astra" (kerja berat, hasil akhir rapi), "GPT-6.2 Sol" (harian), "Luna" (tugas sederhana). Naikkan tingkat usaha hanya untuk perencanaan atau analisis lebih dalam. [F] sumber sama dan https://learn.chatgpt.com/docs/web

---------------------------------------------------------------------
## 3. PRINSIP PENGUNGKAPAN BERTAHAP DAN BAHASA

### 3.1 Prinsip (kesimpulan saya, bukti disebut)

1. Mulai dari satu kotak tulis. Tidak ada formulir sebelum bisa mencoba. [F] "A new chat is already waiting" (Academy); [K] layar web hanya tajuk, kotak, bilah samping.
2. Satu pilihan besar, dua kata: Chat atau Work. Sisanya menumpuk di balik `+`, "Plugins", "Custom". [F] https://learn.chatgpt.com/docs/web
3. Nilai dulu, pengaturan nanti. Panduan pertama langsung mengerjakan sesuatu yang nyata (email, kalender), bukan menjelaskan menu. [F] https://learn.chatgpt.com/training/walkthroughs/getting-started
4. Kemampuan muncul saat tugas membutuhkannya: `@` hanya berguna setelah plugin terpasang; skill hanya setelah ada hasil bagus; jadwal hanya "di obrolan yang sama" setelah satu kali jalan. [F] walkthrough plugins-and-skills dan scheduled-tasks
5. Urutan yang disarankan (9 panduan): Work, Plugins dan skill, Jadwal, Slide dan dokumen, Komputer dan browser, Situs, HP, Suara, Personalisasi. Personalisasi paling akhir (15 menit, terpanjang). [F] https://learn.chatgpt.com/training
6. Tidak memaksa, tidak menghitung. "Follow them in order or jump straight to what you want to learn" (via pencarian); tanpa persen, tanpa penanda selesai. [F] /training dan /training/complete
7. Pengaturan lanjutan hanya satu jalur tetap: Settings, lalu satu bagian (Personalization, Data controls, Notifications). [F]
8. Rem ada di setiap tindakan berdampak: minta draf dulu, batasi bahan, "stop before sending anything". [F] get-started-with-work
9. Satu cara berbicara yang sama di semua perangkat: akun dan ruang kerja yang sama, lanjut di desktop, HP, web. [F] get-started-with-work
10. Hal yang rumit disembunyikan di tempat bernama jelas: "Customize" (plugin, skill), "Work locally"/"Cloud" (tempat berjalan), model dan usaha (di pemilih kecil, nilai bawaan cukup). [F] docs/web

### 3.2 Kata-kata yang dipakai (semua dari dokumen resmi)

- Kata kerja sehari-hari, bukan istilah teknis: "Start a chat", "Select where ChatGPT should work", "Send your first message", "Try it".
- Tajuk bersifat ajakan: "What should we work on?", "Work with ChatGPT".
- Contoh perintah bersifat hasil: "Make a decision", "Daily briefing", "Plan an event".
- Kerangka perintah empat kata: Goal, Context, Output, Boundaries. [F] https://learn.chatgpt.com/docs/prompting
- Nasihat Chat: "Start with the outcome you want, then add detail only when it changes the answer." [F] sumber sama (satu kutipan, di bawah 15 kata dari dokumen)
- Hasil disebut "something you can review" bukan "otomatis jadi". Kata "draft for my review" dan "approve" konsisten.
- Istilah "plugin" dan "skill", bukan "MCP" atau "konektor teknis", di antarmuka. [F] docs/web
- Angka konkret dalam nama panduan: "8 min", "9 min", "7 min". Ekspektasi waktu jelas. [F] /training

---------------------------------------------------------------------
## 4. KEADAAN KOSONG, GALAT, DAN BATAS

### 4.1 Keadaan kosong
- Layar baru: tajuk "What should we work on?" + kotak tulis + saran contoh ("Make a decision", "Daily briefing", "Plan an event"). [F] docs/web, docs/quickstart
- Bilah samping kosong: "Recents" bertambah dengan sendirinya; teks kosong persis [?] tidak ada di dokumen.
- Tab "Scheduled" bila belum ada tugas: [?] tidak dijelaskan. Dokumen hanya menyebut label "Scheduled Active" dan prompt "Ask ChatGPT to schedule tasks, set reminders, or monitor for updates". [F] get-started-with-work
- Plugin belum terpasang: halaman Plugins dengan daftar unggulan dan kolom "Search plugins". [F] docs/web dan get-started-with-work
- [K] Pola: keadaan kosong adalah ajakan bertindak (contoh nyata), bukan penjelasan fitur.

### 4.2 Galat
- Pesan umum "Something went wrong": penyebab server sementara atau perangkat. Langkah: muat ulang atau obrolan baru, cek halaman status, coba jaringan lain. [F, via pencarian] https://help.openai.com/en/articles/7996703-troubleshooting-chatgpt-error-messages
- Galat jaringan: nonaktifkan ekstensi pemblokir, coba jendela penyamaran atau browser lain. [F, sumber sama]
- Obrolan terlalu panjang atau lambat: mulai obrolan baru. Respons macet: tunggu 30-60 detik, Stop lalu Regenerate. [F, sumber sama]
- Obrolan penuh: tidak ada waktu reset; obrolan baru jadi jalan keluar. [F, via pencarian] https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq
- Tugas Work terjeda keamanan: ikuti pemberitahuan dan tinjau temuan sebelum lanjut. [F] get-started-with-work
- Komputer mati saat tugas lokal: tugas yang memenuhi syarat bisa lanjut di container awan tanpa berkas komputer; giliran yang sedang jalan tidak bisa pindah dari lokal ke awan. [F] get-started-with-work
- Pesan "Too many requests": [?] tidak terbukti di sumber resmi yang bisa saya baca.

### 4.3 Batas pemakaian
- Chat teks harian di Free dan Go disebut tanpa batas (dengan penjaga penyalahgunaan). Batas terpisah ada untuk unggah berkas, gambar, suara, analisis data. [F, via pencarian] https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt dan free-tier-faq
- Saat batas model tercapai: akses model dijeda sampai reset dan waktunya ditampilkan di dalam produk. Naik paket meriset tarif. Dukungan OpenAI tidak mereset batas. [F, via pencarian] sumber sama
- Work: periksa penggunaan paket sebelum tugas besar; tugas lebih panjang atau kompleks memakai lebih banyak kredit. [F] get-started-with-work
- Pengumuman 2026-11-02: ChatGPT dan Codex akan berbagi satu jatah pemakaian; "Unlimited Instant" tetap dan tidak memotong jatah. [F] https://9to5mac.com/2026/11/02/openai-is-retiring-chatgpt-classic-app-will-soon-combine-chat-and-work-tabs-in-new-app/
- [K] Satuan yang dipakai pengguna: "kredit" dan "usage", bukan dolar per pesan.

### 4.4 Aksesibilitas (sumber resmi sangat tipis)
- Tidak ada halaman bantuan resmi tentang pembaca layar yang saya temukan. [?]
- Dari panduan universitas dan forum (pihak ketiga): dialog pintasan keyboard dibuka dengan Ctrl atau Cmd + `/`; aplikasi Mac disarankan untuk pembaca layar; ada laporan fokus terjebak di dialog dan kontrol yang dibaca sebagai teks statis. [F, sumber pihak ketiga] https://applevis.com/forum/windows/chatgpt-broken-keyboard-accessibility-web-version
- [K] Pelajaran: aksesibilitas tidak bisa dianggap sudah beres hanya karena terlihat sederhana.

### 4.5 Perubahan besar yang sedang berjalan
- 2026-07-09: ChatGPT Work diluncurkan bersama GPT-5.6 dan desktop baru, menggantikan Agent Mode. [F, media] https://9to5mac.com/2026/07/09/openai-announcing-the-next-chapter-for-chatgpt-today-watch-here/
- 2026-11-02: Chat dan Work akan digabung (uji kecil dulu); ChatGPT Classic pensiun 2027-01-30, riwayat obrolan dibawa. Codex tetap terpisah. [F, media] URL 9to5mac November di atas.
- [K] Arti untuk kita: OpenAI sendiri sedang menghapus pilihan Chat/Work. Pelajaran RAIVERSE: jangan membuat pengguna memilih "mode"; sistem yang memutuskan seberapa berat tugasnya. Ini sejalan dengan prinsip 1 FUNDAMENTAL (tidak ada mode).

---------------------------------------------------------------------
## 5. PEMETAAN KE RAIVERSE

Sumber padanan: `docs/FUNDAMENTAL/01-FUNDAMENTAL.md` dan `docs/PETA-WEBSITE.md` (keduanya dibaca sebagian: bagian gerbang, kerangka aplikasi, Beranda, awal Hasil Saya; hal yang tidak terbaca ditandai).

| Alur ChatGPT | Padanan RAIVERSE sekarang | Celah | Saran konkret kecil |
|---|---|---|---|
| Masuk: chatgpt.com, satu akun di semua perangkat | Kartu "Masuk ke RAIVERSE" dengan satu tombol "Masuk dengan Google" (c.js:33-48) | Orang yang sudah masuk tetapi belum jadi anggota ruang kerja (403) tetap disuruh "Masuk dengan Google" tanpa penjelasan (PETA-WEBSITE bagian 1) | Pisahkan pesan 403: "Akunmu sudah masuk, tapi belum diundang ke ruang kerja. Minta pemilik mengirim tautan undangan." |
| Layar pertama: tajuk + satu kotak + saran contoh | Beranda Pemandu: sapaan, 4 kartu saran ("Bantu aku membuat konten", dst.), kotak tulis | Sudah sangat dekat. Kartu awal 4 buah; "Meringkas" dan "Belajar" ada di server tapi tidak tampil | Pertahankan 4 kartu. Tambah satu kartu tindak lanjut hanya bila ada sesi 2 hari terakhir (sudah ada: "Lanjutkan yang tadi") |
| Pilihan Chat vs Work | Tidak ada mode; Pemandu menentukan (prinsip 1) | Tidak ada celah. Ini keunggulan; OpenAI sendiri menggabungkan keduanya | Jangan tambah tombol mode. Bila tugas besar, Pemandu menawarkan "Mulai" dengan ringkasan "Yang akan terjadi" |
| Panduan "Getting started" 3 langkah | Kartu "Boleh kenalan dulu?" (onboarding) dengan "Boleh, kenalan" / "Lewati dulu" | Tidak ada panduan hasil nyata pertama; kenalan berupa wawancara, bukan hasil | Ganti kenalan: tawarkan satu tugas contoh nyata (misal "tulis pesan") dulu, tanyakan profil sambil jalan |
| "Tidak ada penanda selesai" | Tidak ada daftar centang (belum diketahui di sisa PETA-WEBSITE [?]) | Tidak ada celah; jangan tambah daftar centang | Bila ingin "yang berikutnya", cukup satu kartu saran di akhir hasil, bukan persen kemajuan |
| Keadaan kosong = ajakan dengan contoh | Beranda berisi kartu saran; Hasil Saya punya tiga kelompok ("Perlu kamu", dst.) | Teks kosong di Hasil Saya dan Tim Saya belum diperiksa [?] | Pastikan kelompok kosong menampilkan satu contoh + tombol "Mulai pekerjaan" (sudah ada tombolnya di Hasil Saya) |
| Plugin dan `@nama` | Alat staf native; Telegram/Discord punya kode tapi tidak ada tempat menyambung bagi pengguna (PETA-WEBSITE ringkasan 4) | Pengguna biasa tidak bisa menyambung saluran; tidak ada setara "@" | Hidupkan kartu sambungan (sudah ada kodenya, yatim) di Pengaturan. Pertimbangkan `@nama staf` di kotak tulis untuk menugaskan ke staf tertentu |
| Proyek (obrolan + berkas + instruksi) | Hasil Saya + Catatan + Tim Saya; "Beri pekerjaan untuk <nama>" lewat `?untuk=ID` | Tidak ada wadah bernama "proyek" yang menyatukan pekerjaan, berkas, instruksi | Hasil Saya: kelompokkan pekerjaan di bawah kepala "Proyek" opsional; jangan wajibkan |
| Unggah berkas | [?] Belum terbaca di bagian yang saya baca | Belum bisa dinilai | Cek di Beranda: tombol `+` kecil di kotak tulis untuk lampiran |
| Riwayat: Recents, arsip, hapus, cari | Palet Ctrl+K mencari orang, catatan, hasil (6/8/8 baris); Hasil Saya punya kolom cari | Tombol Cari tidak ada di desktop, hanya Ctrl+K (PETA-WEBSITE ringkasan 5); tidak ada arsip atau sematkan [?] | Tambah ikon cari kecil di sidebar desktop. Pin/arsip jangan dulu, tunggu kebutuhan |
| Berbagi tautan | [?] Tidak terbaca | Belum bisa dinilai | Bila ada, ikuti: tautan anonim bawaan, daftar tautan dengan "hapus" di satu tempat |
| Pengaturan: Personalization, Data controls | Halaman Pengaturan; "Yang aku tahu tentang kamu" (ubah, hapus butir); rute ekspor dan hapus data (`/api/me/*`) belum punya tombol | Ekspor dan hapus data pribadi tidak ada tombolnya (PETA-WEBSITE ringkasan 10); cabut sesi tanpa tombol | Tambah dua tombol di Pengaturan: "Unduh datamu" dan "Hapus datamu" (dengan konfirmasi). Jaga hal teknis di konsol admin |
| Memori dan Temporary Chat | "Yang aku tahu tentang kamu" dapat diedit; "Hapus" per butir | Tidak ada jalan "obrolan tanpa diingat" | Tambah opsi "Jangan ingat obrolan ini" di Pemandu (satu sakelar kecil di kaki) |
| Tugas terjadwal (tab Scheduled, jeda, hapus) | Pilihan "jadwal" di langkah lanjut bila pemilik; n8n untuk jadwal; sidebar punya tombol Jeda/lanjut kerja tim | Jadwal hanya muncul untuk pemilik; tidak ada daftar jadwal yang jelas untuk pengguna biasa [?]; di HP tombol Jeda hilang | Satu layar kecil "Terjadwal" (aktif/jeda, jadwal berikutnya, hasil terakhir). Pindahkan Jeda ke menu "Lainnya" di HP |
| Notifikasi (Push/Email) | Telegram/Discord sebagai saluran luar (belum bisa disambung pengguna) | Tidak ada pilihan kanal notifikasi | Setelah kartu sambungan hidup, tawarkan "Kabari lewat: Telegram" di pengaturan |
| Desktop dan HP, lanjut lintas perangkat | Web responsif; menu bawah HP dengan "Lainnya" | Menu "Lainnya" memuat 4 item ganda; Jatah hilang di HP | Hapus item ganda di menu "Lainnya"; tampilkan "Jatah" di bilah atas HP |
| Suara | Mik di Beranda (hasil masuk ke kolom, tidak terkirim otomatis); suara baca asisten hanya di Kantor 3D, bawaan mati | Balasan Pemandu tidak dibacakan | Tombol kecil "Bacakan" per balasan di Beranda (tidak otomatis) |
| Persetujuan sebelum tindakan berdampak ("stop before sending") | Kartu `confirm`: "Yang akan terjadi" + "Mulai"/"Ubah pilihan"; lencana persetujuan di Hasil Saya | Sudah sejajar | Pertahankan; pakai bahasa "Periksa dulu" |
| Galat ramah | `error`: pesan ramah + "Coba lagi" / "Mulai dari awal"; sambungan putus: "Sepertinya sambungan sedang terputus..." | Tidak ada toast galat di Beranda; tanda "Terputus" tidak ada di desktop | Tampilkan tanda "Terputus" kecil juga di desktop |
| Batas pemakaian | "Sisa jatah hari ini: banyak/cukup/hampir habis/habis" (bukan dolar) | Sudah sejajar dan lebih sederhana dari ChatGPT; belum ada "kapan reset" | Saat habis, tambah satu kalimat "Jatah kembali besok pagi" bila waktunya diketahui |
| Aksesibilitas | Tidak diperiksa [?] | Belum diketahui | Cek fokus, label tombol ikon, kontras; jangan klaim sudah aksesibel sebelum diuji |
| Bahasa tanpa jargon | Jargon masih tampil: "Agen", "Backlinks", "node", folder berbahasa Inggris di Catatan, "Mode Play", "fps", "draw"; Aula Rapat berisi emoji dan "154 panggilan AI" (PETA-WEBSITE ringkasan 8-9) | Bertentangan dengan gaya kata ChatGPT yang sehari-hari | Ganti kata di layar biasa; sembunyikan hitungan teknis di konsol admin |

---------------------------------------------------------------------
## 6. 10 REKOMENDASI TERURUT DAMPAK

1. Pertahankan "tanpa mode" dan jangan tambah pemilih Chat/Work. OpenAI sendiri menggabungkan keduanya. Dampak terbesar: pengguna tidak perlu memutuskan tingkat berat tugas.
2. Ganti onboarding "kenalan" (wawancara) dengan satu hasil nyata dalam 1 pesan, lalu tanya profil sambil jalan. Meniru panduan "nilai dulu, pengaturan nanti" ChatGPT.
3. Hidupkan kartu sambungan Telegram/Discord di Pengaturan. Kodenya sudah ada tetapi yatim; tanpa ini saluran luar dan notifikasi tidak bisa dipakai.
4. Perbaiki pesan 403 pada gerbang ("sudah masuk tetapi belum diundang"). Jalan buntu pertama kali adalah risiko terbesar tahap pertama.
5. Satu layar kecil "Terjadwal" untuk pengguna biasa: aktif/jeda, jadwal berikutnya, hasil terakhir, jeda, hapus. Tiru tab Scheduled.
6. Tambah tombol "Unduh datamu" dan "Hapus datamu" di Pengaturan (rute sudah ada). Memenuhi kebutuhan percaya, setara Data controls.
7. Bersihkan jargon di layar pengguna biasa (Agen, Backlinks, node, Mode Play, fps, draw, emoji, hitungan "panggilan AI"). Kata sehari-hari adalah inti rasa sederhana ChatGPT.
8. Samakan pengalaman desktop dan HP: ikon Cari di desktop, tanda "Terputus" di desktop, Jatah dan Jeda di HP, buang item ganda di menu "Lainnya".
9. Tambah "Jangan ingat obrolan ini" (setara Temporary Chat) dan tombol "Bacakan" per balasan Pemandu (tidak otomatis).
10. Tambah keterangan "kapan jatah kembali" pada keadaan habis, dan lakukan pengujian aksesibilitas dasar (fokus, label ikon, kontras) sebelum klaim apa pun.

Catatan metode: semua tanda [F] dengan kata "via pencarian" berarti teks halaman asli tidak bisa saya buka; angka dan label bisa sudah berubah. Bagian padanan RAIVERSE hanya memakai apa yang tertulis di `01-FUNDAMENTAL.md` dan bagian awal `PETA-WEBSITE.md`; baris bertanda [?] belum diverifikasi.
