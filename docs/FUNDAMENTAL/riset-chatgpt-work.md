# Riset ChatGPT (aplikasi desktop: Chat dan Work) untuk RAIVERSE

Tanggal riset: 2026-11-19. Tanda: [F] = fakta dari sumber (URL disertakan), [K] = kesimpulan saya.

## Catatan kejujuran sumber (baca dulu)
- `https://learn.chatgpt.com/docs` ternyata mengarah ke indeks developers.openai.com (bagian "Codex"). Tautan lama `developers.openai.com/codex/...` dialihkan permanen (308) ke `learn.chatgpt.com/docs/...`. [F]
- BERHASIL dibaca (resmi): `learn.chatgpt.com/docs/` + `/quickstart`, `/use-chatgpt`, `/working-with-agents`, `/projects`, `/plugins`, `/automations`, `/long-running-work`, `/features`, `/features/voice`, `/customization/memories`, `/personalize`, `/notifications`, `/permission-modes.md`, `/permissions`, `/browser`, `/computer-use`.
- GAGAL/TIDAK ADA: `learn.chatgpt.com/docs/work` (404), `/docs/personalize-chatgpt` (404), `help.openai.com/en/articles/20001275-chatgpt-work-and-codex` (403, hanya muncul di hasil pencarian; isinya tidak saya baca).
- TIDAK DITEMUKAN di dokumentasi resmi yang terbaca: teks persis layar "What should we work on?", rincian pemilih model, tombol "Files" di kolom ketik, isi tepat "Full access" (hanya disebut, tidak dijelaskan di halaman permission-modes). Bagian itu saya tandai [K]/"tidak terkonfirmasi".
- Sumber sekunder (blog Zapier dan hasil pencarian: theneuron, bigprompthub, dev.to) dipakai hanya bila ditandai; mutu bervariasi, dan ada pertentangan soal akses paket gratis.

---------------------------------------------------------------------
## 1. Ringkasan 10 baris
1. ChatGPT desktop punya dua mode kerja: **Chat** (tanya-jawab) dan **Work** (agen yang mengerjakan sampai ada hasil jadi). [F] learn.chatgpt.com/docs/quickstart
2. Pengalih Chat/Work ada di atas kolom ketik pada halaman chat baru. [F] quickstart
3. Sebelum mulai, pengguna memilih "di mana ChatGPT bekerja": chat biasa, proyek, atau folder. [F] quickstart
4. Kolom ketik berbunyi "Do anything. @ to use plugins.", ada label tingkat usaha ("Medium"), ikon mik, dan tombol kirim. [F] use-chatgpt
5. Izin bukan pertanyaan teknis di depan: ada satu kontrol di bawah kolom ketik dengan tiga mode: "Ask for approval", "Approve for me", "Full access". [F] permission-modes
6. Agen berhenti dan bertanya hanya pada keputusan, akses yang kurang, atau aksi yang butuh persetujuan; selebihnya jalan sendiri. [F] working-with-agents, long-running-work
7. Kemajuan tampil sebagai satu baris tujuan di atas kolom ketik (jeda, lanjut, ubah, hapus), plus notifikasi dan lonceng aktivitas. [F] long-running-work, notifications
8. Kekuatan besar dibungkus tiga konsep sederhana: Proyek (konteks), Plugin (alat, dipanggil dengan "@"), Tugas terjadwal (otomasi). [F] projects, plugins, automations
9. Tindakan berdampak (kirim pesan, beli, hapus, ubah izin) selalu minta konfirmasi; isi halaman web dianggap tidak tepercaya. [F] browser, plugins
10. Pelajaran utama untuk RAIVERSE: satu kolom ketik, satu pilihan izin, satu kotak masuk hasil, dan konfirmasi hanya untuk yang berdampak. [K]

---------------------------------------------------------------------
## 2. Apa saja yang ada di ChatGPT (peta fitur)

Jumlah "langkah" = perkiraan [K] berdasarkan dokumen, bukan diukur di layar.

- **Mode: Chat vs Work**
  - Chat: pertanyaan, ide, penjelajahan lewat percakapan. [F] quickstart
  - Work: riset, analisis, hasil jadi (dokumen, presentasi, spreadsheet, "Sites"). [F] quickstart
  - Work berpondasi sama dengan Codex tetapi tanpa tampilan teknis (terminal, jumlah baris). [F] zapier.com/blog/chatgpt-work (sekunder)
  - Cara pakai: 1 langkah (geser pengalih di atas kolom ketik). [K]
- **Layar awal (halaman chat baru)**
  - Pengalih Chat/Work di atas kolom ketik. [F] quickstart
  - Judul "What should we work on?": TIDAK terkonfirmasi di dokumen resmi; muncul di pertanyaan Owner. [K]
  - Langkah pertama aplikasi: pasang, masuk akun, pilih tempat kerja (chat, proyek, atau folder), pilih Chat/Work, kirim pesan pertama. [F] quickstart. Sekitar 4 langkah sampai pesan pertama. [K]
- **Kolom ketik (composer)**
  - Placeholder "Do anything. @ to use plugins." [F] use-chatgpt
  - Label tingkat usaha ("Medium"), ikon mik, panah kirim. [F] use-chatgpt (fungsi label tidak dijelaskan)
  - Kontrol izin di bawah kolom ketik. [F] permission-modes
  - Lampirkan berkas/gambar ke satu chat saja. [F] projects
  - "@" memanggil plugin atau skill tertentu; atau cukup jelaskan hasil yang diinginkan dan ChatGPT memilih alat. [F] plugins
  - Pemilih model dan tombol tambah (+): ada menurut tangkapan layar pihak lain, tetapi tidak dijelaskan di halaman resmi yang terbaca. Tidak terkonfirmasi.
- **Proyek dan folder**
  - Dua jenis: proyek ChatGPT (chat, berkas, instruksi, sumber disatukan; bagian "Chats" dan "Sources") dan proyek lokal (menghubungkan chat ke satu atau lebih folder di komputer). [F] learn.chatgpt.com/docs/projects
  - Tambah folder: Edit project, lalu Add folder; "Make primary" menentukan folder utama tempat chat baru dimulai. [F] projects
  - "New chat" di samping "Recents"; "Quick chat" (Ctrl+Alt+N di Windows) untuk tanya cepat tanpa proyek. [F] projects
  - "Search chats", "Archive chats", dan "Locked chats" (dilindungi PIN). [F] projects
  - Cara pakai: pilih folder 2 langkah; buat proyek 2-3 langkah. [K]
- **Berkas (Files)**
  - Berkas proyek disimpan di "Sources" dan tersedia di semua chat proyek; berkas satu chat dilampirkan di chat itu. [F] projects
  - Panduan tahan lama disarankan ditulis di `AGENTS.md`/dokumen. [F] projects
- **Plugin dan konektor**
  - Tab "Plugins": cari/telusuri, buka detail, tekan tombol plus untuk memasang; sambungkan layanan bila diminta (Gmail, Google Drive, Slack, GitHub, dsb.). [F] learn.chatgpt.com/docs/plugins. Sekitar 3-4 langkah. [K]
  - Ada yang meminta persetujuan tiap aksi, misalnya plugin pesan menanyakan setiap pesan dan penerima sebelum kirim; "Always allow" menghilangkan pemeriksaan akhir itu. [F] plugins
  - Hapus pasangan plugin tidak memutus integrasinya; harus diputus terpisah. [F] plugins
- **Tingkat akses (izin)**
  - "Ask for approval": kerja di dalam ruang kerja, berhenti sebelum keluar batas; disarankan sebagai awal. [F] permission-modes
  - "Approve for me" (di pengaturan disebut Auto-review): batas sama, tetapi permintaan melewati batas dinilai peninjau otomatis. [F] permission-modes
  - "Full access": ada, tetapi halaman resmi tidak menjelaskan; dokumen sandbox menyebut profil sejenis "menghapus batasan sandbox, hanya bila memang disengaja". [F] learn.chatgpt.com/docs/permissions
  - Mode lanjutan perlu dinyalakan dulu di Settings > General > Permissions; mode yang tak diizinkan organisasi tampil nonaktif. [F] permission-modes
  - Sandbox menentukan apa yang bisa diakses; persetujuan menentukan kapan berhenti. [F] permission-modes
  - Cara pakai: 1 langkah (pilih di bawah kolom ketik). [K]
- **Model**
  - Pemilih model/usaha ada; detail tidak terbaca dari sumber resmi. Dokumen suara: suara memakai model tugas yang dipilih. [F] features/voice
- **Suara**
  - "Start voice chat" / "Start new voice chat"; pertama kali: izinkan mikrofon dan pilih suara. Bisa disela, ganti arah, dan memeriksa pekerjaan yang berjalan. Hanya satu chat suara aktif. [F] learn.chatgpt.com/docs/features/voice
  - Suara memakai izin yang sama dengan tugas yang diarahkannya; bisa memulai tugas lain, menanyakan kemajuan, mengirim instruksi tambahan. [F] features/voice
  - Beda dengan "dikte": dikte hanya mengubah ucapan menjadi teks prompt. [F] features/voice
  - Cara pakai: 1 ketukan setelah izin awal. [K]
- **Riwayat dan aktivitas**
  - Lonceng di sidebar menampilkan chat belum dibaca, berjalan, atau menunggu jawaban (Work, Chat, Pinned, Scheduled; "Mark all as read"). [F] learn.chatgpt.com/docs/notifications
  - "Pet" melayang menampilkan status: Running, Needs input, Ready, Blocked. [F] notifications
  - Notifikasi selesai/izin/pertanyaan dapat diatur terpisah. [F] notifications
- **Tugas terjadwal (otomasi)**
  - Berjalan di latar menurut jadwal atau peristiwa (Gmail, Slack, GitHub; pemicu peristiwa tidak di desktop). [F] learn.chatgpt.com/docs/automations
  - Dibuat dengan meminta ChatGPT di chat. Hasil masuk "Scheduled" (kotak masuk dengan penanda belum dibaca). [F] automations
  - Tugas desktop butuh komputer menyala dan aplikasi terbuka. [F] automations
  - Saran: uji di chat biasa dulu, tinjau beberapa run pertama. [F] automations
- **Memori dan instruksi**
  - Memori Codex lokal mati secara bawaan, dinyalakan di Settings > Personalization; per chat bisa diatur lewat `/memories`; ada "Delete Codex memories". [F] learn.chatgpt.com/docs/customization/memories
  - Work memakai pengaturan memori akun/ruang kerja, bukan kontrol lokal. [F] memories
  - Gaya dan nada dasar, instruksi khusus, "Writing style" dari email/dokumen terhubung (opsional). [F] learn.chatgpt.com/docs/personalize
  - "Computer History" (macOS, opt-in) bisa dijeda, dikecualikan, dihapus. [F] personalize
- **Browser dan kontrol komputer**
  - Browser dalam aplikasi di samping chat; Work memakai browser awan terpisah, masuk-akun lewat formulir aman yang menjeda tugas; pengguna bisa mengambil alih. [F] learn.chatgpt.com/docs/browser
  - Computer Use (macOS/Windows): minta izin per aplikasi, opsi "Always allow", daftar aplikasi yang diizinkan bisa dihapus. [F] learn.chatgpt.com/docs/computer-use
- **Pengaturan**: Settings (umum, izin, suara, personalisasi, browser, notifikasi). [F] berbagai halaman di atas

---------------------------------------------------------------------
## 3. Cara kerja Work mode (agen)

### 3.1 Alur dari permintaan sampai hasil
- Pengguna: pilih tempat kerja, pilih Work, tulis tujuan dan konteks. [F] quickstart; [F] zapier (sekunder: pilih proyek, plugin, model, tingkat usaha)
- Opsional "Plan mode": agen mengusulkan strategi dulu, pengguna menyetujui sebelum mulai. [F] zapier (sekunder); dokumen resmi juga menyebut "plan before execution" sebagai satu tingkat kemandirian. [F] working-with-agents
- Agen: merencanakan, memakai alat, memeriksa hasil, menyesuaikan diri dalam batas instruksi dan izin. [F] working-with-agents
- Dibiarkan berjalan di latar; memberi tahu saat selesai; bertanya bila butuh info atau macet. [F] zapier (sekunder)
- Pengguna meninjau: langkah yang terlihat, sumber, aksi alat, hasil; bandingkan dengan permintaan. [F] working-with-agents
- Lanjut, minta koreksi terarah, atau jeda. [F] working-with-agents

### 3.2 Izin dan konfirmasi
- Permintaan tertulis sebaiknya menyebut apa yang boleh dilakukan sendiri, apa yang perlu persetujuan, dan kapan harus berhenti. [F] working-with-agents
- Agen dapat berhenti untuk "akses yang kurang, keputusan terbuka, atau aksi yang butuh persetujuan". [F] working-with-agents
- Memulai tujuan jangka panjang tidak memperluas akses; tetap "pauses when it needs a decision". [F] long-running-work
- Instruksi = niat; izin = akses. Pakai kontrol izin produk, bukan hanya kalimat di prompt. [F] working-with-agents
- Aksi sensitif di browser (kirim data, beli, ubah izin, hapus data) minta konfirmasi; pembayaran/pemesanan tetap dikonfirmasi walau situs diizinkan. [F] browser
- Tugas terjadwal berjalan tanpa pengawasan di sandbox bawaan; mode baca-saja gagal bila perlu menulis. [F] automations

### 3.3 Menampilkan kemajuan
- Baris tujuan di atas kolom ketik dengan waktu berjalan; jeda, lanjut, ubah, hapus. [F] long-running-work
- Kirim pesan susulan saat berjalan; "side chat" untuk ringkasan tanpa mengganggu. [F] long-running-work
- Lonceng aktivitas, pet status, notifikasi sistem. [F] notifications
- Peringatan: ringkasan yang yakin belum bukti tugas berhasil; periksa hasil nyata. [F] working-with-agents

### 3.4 Berkas dan alat
- Proyek lokal: ChatGPT bisa membaca dan mengubah berkas di semua folder terpasang. [F] projects
- Plugin: keterampilan + server MCP + ekstensi; izin mengikuti ruang kerja dan layanan masing-masing. [F] plugins
- Hasil jadi: dokumen, spreadsheet, presentasi, email, dasbor/aplikasi web, ringkasan. [F] zapier (sekunder)

### 3.5 Batas dan keamanan
- Dua lapis: sandbox (apa yang bisa dijangkau) dan persetujuan (kapan bertanya). Mengganti peninjau tidak memperluas sandbox. [F] permission-modes
- Jaringan mati kecuali dinyalakan; tulis ke skrip/berkas startup ditandai sensitif. [F] learn.chatgpt.com/docs/permissions
- Profil sandbox tidak mengatur web search, konektor, MCP, browser, Computer Use. [F] permissions
- "Treat page content as untrusted context" (isi halaman tidak tepercaya; risiko prompt injection). [F] browser
- Computer Use tidak bisa menyetujui prompt keamanan atau menjadi administrator. [F] computer-use
- Admin organisasi bisa membatasi mode, aplikasi, bahkan mematikan fitur. [F] permission-modes, computer-use
- Batas dari sumber sekunder: browser web bisa diblokir sebagai bot, tidak bisa login situs atau bayar sendiri; kualitas desain lemah. [F] zapier (sekunder)
- Ketersediaan paket: bertentangan antar sumber; jangan dipakai sebagai fakta. Tidak terkonfirmasi.

---------------------------------------------------------------------
## 4. Pola UX yang membuatnya terasa sederhana

Yang patut ditiru [K, berdasar fakta di atas]
1. Satu pintu: satu kolom ketik ("Do anything.") untuk segalanya.
2. Dua mode saja dengan bahasa jelas (Chat = bicara, Work = kerjakan), satu pengalih.
3. Pertanyaan "di mana bekerja?" diajukan sebelum mulai, bukan istilah teknis.
4. Kekuatan dilipat ke kata kerja: "@" untuk alat, proyek untuk konteks, "Scheduled" untuk otomasi.
5. Izin = satu pilihan dengan tiga nama manusiawi, bawaan aman, mode berisiko harus dinyalakan sengaja.
6. Agen berhenti hanya untuk keputusan atau persetujuan; sisanya jalan sendiri.
7. Kemajuan = satu baris yang bisa dijeda/diubah, ditambah kotak masuk (lonceng, Scheduled) dan status 4 kata (Running, Needs input, Ready, Blocked).
8. Notifikasi dikendalikan terpisah (selesai, izin, pertanyaan).
9. Uji dulu, lalu otomasi: coba prompt di chat, baru jadwalkan.
10. Percakapan suara dapat mengarahkan tugas yang sama dengan izin yang sama (tidak ada jalur izin kedua).
11. Pembersihan mudah: "Search chats", arsip, kunci PIN.

Yang patut dihindari [K]
- Banyak mode berisiko di depan tanpa penjelasan: "Full access" tidak dijelaskan di halaman izinnya sendiri.
- Istilah teknis bocor ke pengguna awam: sandbox, MCP, RRULE, worktree, `AGENTS.md`, `config.toml`.
- Perilaku beda antar tempat (desktop vs web vs seluler) membingungkan; sumber sekunder menyebutnya "unintuitive".
- Tugas terjadwal desktop gagal diam-diam bila komputer mati; bilang di depan.
- Halaman dokumentasi tidak konsisten (nama mode, tautan 404, dua domain).
- Ringkasan yang yakin tetapi belum diverifikasi: sebutkan bukti hasil.

---------------------------------------------------------------------
## 5. PEMETAAN KE RAIVERSE

Padanan RAIVERSE dibaca dari `docs/PETA-WEBSITE.md` dan `docs/FUNDAMENTAL/01-FUNDAMENTAL.md` (dari kode, belum dilihat di layar). Saran = kecil dan berdampak besar, tanpa menyentuh Kantor 3D yang dibekukan.

| Fitur ChatGPT | Padanan RAIVERSE sekarang | Celah | Saran kecil, dampak besar |
|---|---|---|---|
| Pengalih Chat vs Work | Beranda Pemandu (chat berpandu) dan Kantor 3D sebagai layar utama; keduanya terpisah halaman | Pengguna tidak diberi tahu bedanya "ngobrol" dan "suruh tim kerja" | Satu kalimat/dua tombol di Beranda: "Tanya saja" dan "Suruh tim mengerjakan" (di balik layar tetap Pemandu) |
| Layar awal "What should we work on?" | Sapaan Pemandu + 4 kartu (konten, riset, rencana usaha, pesan) + "Lanjutkan yang tadi" | Intent Meringkas dan Belajar ada di server tetapi tak jadi kartu | Tambah 2 kartu yang sudah ada di server; judul sapaan = satu pertanyaan tunggal |
| Kolom ketik "Do anything. @ to use plugins." | Kotak tulis + mik + Kirim di Beranda | Tidak ada cara menyebut orang/kemampuan langsung | Ketik "@" menampilkan daftar staf/kemampuan (data `?untuk=ID` sudah ada) |
| Pemilih proyek/folder | Tim Saya, Catatan, rute `?untuk=ID` | Tidak ada konsep "proyek" untuk menyatukan chat + berkas + instruksi | Kelompok "Proyek" ringan di Catatan: nama, instruksi tetap, berkas; dipilih di Beranda |
| Files / Sources | Catatan, Google Drive, Hasil Saya | Berkas dan catatan tidak bisa dilampirkan di satu giliran chat dengan jelas | Tombol "Lampirkan" di kolom tulis; "Simpan" ke Catatan sudah ada |
| Plugin dan konektor | Kemampuan inti (31) dan staf; Telegram/Discord; konsol admin untuk sambungan | Pengguna biasa tidak punya tempat menyambungkan Telegram/Discord (kartu yatim, `sambungan-view.js`) | Hidupkan kartu Sambungan di Pengaturan: 2 tombol, 3 langkah |
| Tingkat akses (3 mode) | Persetujuan sebagai konfirmasi (`confirm`: pratinjau, "Mulai"/"Ubah pilihan"); konsol admin untuk izin | Tidak ada pilihan "seberapa mandiri" bagi pengguna; konfirmasi sama untuk semua | Satu pilihan 3 kata di Pengaturan: "Tanya dulu" (bawaan), "Tanya hanya yang berdampak", "Jalankan sendiri" |
| Konfirmasi aksi berdampak | `confirm` di Pemandu, lencana persetujuan di Hasil Saya | Layar desktop tak punya bilah atas, jadi lencana kurang terlihat; Aula Rapat memunculkan jargon | Pertahankan konfirmasi; ganti jargon rapat ("154 panggilan AI") dengan kalimat awam |
| Baris tujuan/kemajuan | `progress` (bilah + teks, polling 2,5 dtk); "Jeda atau lanjutkan kerja tim" hanya di sidebar desktop | Di HP tombol jeda dan jatah hilang; tidak ada "ubah arah" saat berjalan | Pindahkan tombol Jeda ke kartu kemajuan; tambah "Tambah arahan" |
| Lonceng aktivitas dan notifikasi | Lencana angka di Hasil Saya; tanda "Terputus" hanya di HP; Telegram/Discord | Desktop tanpa tanda terputus; tak ada status 4 kata | Tampilkan status per pekerjaan: Bekerja, Perlu kamu, Siap, Terhenti (kelompok "Perlu kamu" sudah ada); kirim ke Telegram |
| Scheduled (kotak masuk hasil terjadwal) | Hasil Saya; otomasi `/api/automations/*` sudah ada di server | Rute otomasi tanpa tombol | Tombol "Ulangi tiap ..." di kartu hasil + bagian "Terjadwal" di Hasil Saya |
| Suara (GPT-Live) | Mik (Web Speech) di Beranda; suara asisten di dock Kantor 3D, bawaan mati | Balasan Pemandu tidak dibacakan | Tombol "Bacakan" per balasan di Beranda (pakai `tts` yang sudah ada) |
| Memori dan instruksi | "Yang aku tahu tentang kamu" (lihat, ubah, hapus), kenalan awal, "Aku belajar sesuatu... Simpan?" | Sudah lebih baik daripada ChatGPT soal kendali; kurang terlihat | Pertahankan; tampilkan satu kalimat "Aku ingat: ..." di sapaan |
| Riwayat dan pencarian chat | Hasil Saya, palet Ctrl+K, Catatan otomatis | Tidak ada tombol Cari di desktop; tidak ada "Percakapan baru" tetap | Tombol Cari + "Percakapan baru" di Beranda desktop |
| Browser agen | Browser agen (konsol admin, `#admin-browser`), izin per divisi | Hanya untuk pengelola; belum diuji penuh | Tetap di admin; pakai pola "sign-in menjeda tugas, pengguna ambil alih" bila dibuka ke pengguna |
| Keamanan: isi web tidak tepercaya | Penjaga: keamanan, kuota, persetujuan | Belum ada aturan eksplisit di layar | Label "dari web, belum diperiksa" pada kutipan sumber |
| Riwayat tugas/hasil jadi | Hasil Saya: "Perlu kamu", "Sedang dikerjakan", "Selesai"; "Lihat hasil" | Sudah sangat dekat dengan gagasan "kotak masuk" | Beri satu kartu ringkas "Yang berubah" (apa dibuat, di mana disimpan) |
| Kantor 3D | Layar utama; orang 3D = kemampuan | Tidak ada padanan di ChatGPT; ini pembeda | Jangan diubah; hubungkan: klik orang 3D membuka "beri pekerjaan" (sudah ada `?untuk=ID`) |

---------------------------------------------------------------------
## 6. 10 rekomendasi terurut (dampak tinggi dan mudah dulu)
1. Hidupkan kartu Sambungan Telegram/Discord di Pengaturan (kode sudah ada tetapi yatim). Mudah, dampak besar. [K]
2. Bacakan balasan Pemandu (tombol "Bacakan" memakai `tts` yang ada). Mudah. [K]
3. Tambah "Perlu kamu" ke notifikasi Telegram/Discord dan status 4 kata (Bekerja, Perlu kamu, Siap, Terhenti). Sedang. [K]
4. Pilihan kemandirian 3 kata di Pengaturan ("Tanya dulu", "Tanya hanya yang berdampak", "Jalankan sendiri"), bawaan paling aman, mode terakhir perlu dinyalakan sengaja. Sedang. [K]
5. Pindahkan "Jeda" dan jatah ke kartu kemajuan agar ada di HP dan desktop; tambah "Tambah arahan" saat berjalan. Sedang. [K]
6. Tombol Cari dan "Percakapan baru" di Beranda desktop; tanda "Terputus" di desktop. Mudah. [K]
7. "@" di kolom tulis untuk memilih staf atau kemampuan. Sedang. [K]
8. Tombol "Ulangi tiap ..." pada kartu hasil + bagian "Terjadwal" di Hasil Saya (rute otomasi sudah ada). Sedang. [K]
9. "Proyek" ringan: nama, instruksi tetap, berkas, dipilih saat mulai; dan tombol "Lampirkan" per giliran. Lebih besar, dampak besar. [K]
10. Bersihkan jargon yang bocor ("Agen", "Backlinks", "node", jendela Aula Rapat, "fps/draw") dan tambah 2 kartu awal (Meringkas, Belajar). Mudah. [K]

Catatan: semua padanan RAIVERSE di atas berasal dari PETA-WEBSITE.md (dari kode) dan belum diperiksa di layar; perilaku ChatGPT yang dikutip dari dokumen resmi yang berhasil dibaca pada 2026-11-19 dan bisa berubah.
