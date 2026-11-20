# Riset 02: Bagaimana ChatGPT mengintegrasikan banyak hal, dan padanannya di RAIVERSE

Tanggal riset: 2026-11-19. Tanda: [F] = fakta dari sumber (URL disertakan), [K] = kesimpulan saya. Melengkapi `../riset-chatgpt-work.md` (yang berfokus ke tampilan desktop); berkas ini berfokus ke integrasi dan agen.

## 0. Catatan kejujuran sumber (baca dulu)
- Berhasil dibaca (resmi): learn.chatgpt.com/docs/plugins, /permission-modes.md, /long-running-work, /automations, /browser, /projects; developers.openai.com/apps-sdk/ (indeks) dan /apps-sdk/guides/security-privacy; spesifikasi MCP https://modelcontextprotocol.io/specification/2025-06-18/server/tools [F]
- Gagal (403): help.openai.com/en/articles/11752874-chatgpt-agent dan openai.com/index/introducing-chatgpt-agent. Isi agen lama saya ambil dari VentureBeat (sekunder) dan ringkasan hasil pencarian yang memuat kutipan halaman bantuan OpenAI. Tandai "sekunder". [F]
- Nama berubah-ubah [F]: "Apps SDK" kini tampil sebagai dokumentasi "Plugins" (plugin = skill + server MCP + UI opsional); "Connectors" disebut diganti nama menjadi "Apps" (sumber sekunder, Des 2025); halaman bantuan menyatakan "ChatGPT agent" tidak lagi tersedia dan tugas panjang kini lewat "ChatGPT Work" (dari ringkasan pencarian, bukan halaman yang terbaca penuh). Jangan memakai nama lama sebagai rujukan tetap.
- Tidak terbaca/tidak ditemukan: kriteria rinci peninjauan plugin, pola autentikasi lengkap, anotasi alat (readOnlyHint dll.) dalam panduan keamanan OpenAI, isi "Full access" (hanya disebut), cara berbagi proyek dengan orang lain ("halaman tidak menjelaskan"), dan angka kuota/paket (sumber bertentangan). Tidak saya karang.

---------------------------------------------------------------------
## 1. Ringkasan 10 baris
1. ChatGPT terasa satu alur karena SATU kolom ketik ("Do anything. @ to use plugins.") menjadi pintu ke semua: chat, alat, proyek, agen. [F] learn.chatgpt.com/docs/use-chatgpt (via riset 01)
2. Alat luar disambung lewat satu konsep, Plugin/App, yang dipasang dengan tombol plus lalu disambungkan bila diminta. Di belakangnya: server MCP + skill + UI opsional. [F] learn.chatgpt.com/docs/plugins; developers.openai.com/apps-sdk/
3. Pengguna tidak memilih alat: cukup tulis hasil yang diinginkan, ChatGPT memilih alat terpasang; "@" hanya untuk memaksa. [F] plugins
4. Agen Work/agen lama bekerja di komputer virtual sendiri (peramban visual, peramban teks, terminal, panggilan API) dan berpindah alat dalam satu sesi. [F] VentureBeat (sekunder)
5. Izin dua lapis: sandbox (apa yang terjangkau) + persetujuan (kapan berhenti). Tiga mode: Ask for approval (disarankan), Approve for me, Full access. [F] permission-modes
6. Aksi berdampak (kirim data, beli, ubah izin, hapus) selalu minta konfirmasi; login lewat formulir aman yang model tidak melihatnya; pengguna bisa ambil alih. [F] browser
7. Tujuan panjang tampil sebagai satu baris kemajuan (tujuan, status, waktu; jeda/lanjut/ubah/hapus), plus notifikasi; berhenti hanya saat butuh keputusan. [F] long-running-work
8. Otomasi = tugas terjadwal/berpemicu (Gmail, Slack, GitHub), jalan tanpa pengawasan dengan sandbox bawaan, hasil masuk kotak "Scheduled". [F] automations
9. Proyek menyatukan chat + berkas + instruksi + (folder lokal); tetapi proyek hanya mengorganisir, tidak memberi izin. [F] projects
10. Pelajaran [K]: kekuatan dilipat jadi 4 kata kerja (tanya, @, proyek, jadwalkan), izin satu tombol, hasil satu kotak masuk, konfirmasi hanya yang berdampak. RAIVERSE sudah punya hampir semua mesinnya; celahnya di jembatan antar fitur.

---------------------------------------------------------------------
## 2. Peta integrasi (fitur, apa yang disambungkan, cara menyambungkan, langkah)
Jumlah langkah = perkiraan [K] dari dokumen, belum diukur di layar.

- **Plugin / App (alat luar)**
  - Disambungkan: layanan seperti Gmail, Google Drive, Slack, GitHub; bisa membawa skill + server MCP + UI. [F] learn.chatgpt.com/docs/plugins
  - Cara: tab Plugins, cari, buka detail, tombol plus; sambungkan akun bila diminta (ada yang saat pasang, ada yang saat pertama dipakai); mulai chat baru. [F] plugins
  - Langkah: 3-4. [K]
  - Nuansa: mencopot plugin TIDAK memutus sambungan MCP-nya; putuskan terpisah. [F] plugins
- **Konektor Google Drive / GitHub (cara lama, sumber sekunder)**
  - Cara: Settings > Connectors > pilih layanan > Connect > setujui akses; GitHub: pilih repositori (bisa diubah di Manage). Di chat, menu akan menampilkan konektor yang aktif untuk dinyalakan per chat. [F] ai.byu.edu/how-to-enable-chatgpt-connectors (sekunder, lewat hasil pencarian)
  - Langkah: 3-4 lalu 1 per chat. [K]
  - Ketersediaan bergantung paket, wilayah, ruang kerja, peran, model. [F] help.openai.com/en/articles/11487775 (kutipan hasil pencarian)
- **Server MCP (di balik plugin)**
  - Disambungkan: alat dan data sistem luar. Klien menemukan alat lewat `tools/list`, memanggil lewat `tools/call`; model memilih, klien menjalankan. [F] modelcontextprotocol.io/specification/2025-06-18/server/tools
  - Cara bagi pengguna: tidak terlihat; ia hanya memasang plugin. [K]
- **Agen / Work**
  - Disambungkan: peramban awan, berkas, kode, plugin, proyek. [F] browser; plugins; VentureBeat
  - Cara: geser ke Work (atau /agent di versi lama), tulis tujuan. 1-2 langkah. [K]
- **Izin**
  - Satu kontrol di bawah kolom ketik. 1 langkah. [F] permission-modes
- **Tugas terjadwal**
  - Disambungkan: prompt + jadwal atau pemicu peristiwa (Gmail pesan baru, Slack pesan di kanal pilihan, GitHub aktivitas PR). [F] automations
  - Cara: minta ChatGPT di chat untuk membuat/mengubah; hasil di "Scheduled". 1-2 langkah. [F]/[K]
- **Proyek dan folder**
  - Disambungkan: chat, berkas (Sources), instruksi proyek, folder lokal. [F] projects
  - Cara: Edit project > Add folder; Make primary. 2-3 langkah. [K]
- **Memori dan instruksi**
  - Memori lokal mati secara bawaan, dinyalakan di Settings > Personalization; hapus kapan saja; Work memakai pengaturan memori akun/ruang kerja. [F] learn.chatgpt.com/docs/customization/memories (via riset 01)
- **Berbagi**
  - Sinkron percakapan tidak mengunggah folder; periksa sumber dan alat sebelum lanjut di perangkat lain. [F] projects. Cara berbagi proyek ke orang lain tidak dijelaskan di halaman itu. [F]
  - Admin ruang kerja bisa memasang plugin untuk tim ("Workspace connections"). [F] plugins
- **Suara**
  - Memakai izin sama dengan tugas yang diarahkannya (tidak ada jalur izin kedua). [F] learn.chatgpt.com/docs/features/voice (via riset 01)

---------------------------------------------------------------------
## 3. Arsitektur agen Work (konseptual, dari sumber publik)

### 3.1 Alur satu tugas
```
Pengguna: tulis tujuan (+ pilih tempat kerja: chat / proyek / folder)
  |
  v
Rencana (opsional "plan" dulu; pengguna setuju)             [F] working-with-agents, quickstart
  |
  v
Loop agen: rencana -> pilih alat -> jalankan -> periksa -> sesuaikan   [F] working-with-agents
  |   alat: peramban awan, plugin/MCP, berkas proyek, kode/terminal    [F] browser, plugins, VentureBeat
  |
  +-- butuh keputusan / akses kurang / aksi berdampak --> BERHENTI, tanya pengguna
  |
  v
Hasil: dokumen, spreadsheet, presentasi, dsb. + notifikasi "siap"       [F] notifications; zapier (sekunder)
  |
  v
Pengguna tinjau: langkah terlihat, sumber, aksi alat; lanjut / koreksi / jeda   [F] working-with-agents
```

### 3.2 Alat dan "komputer"
- Agen lama: komputer virtual sendiri; berpindah antara peramban visual, peramban teks, dan terminal (termasuk Python) dalam satu sesi; juga panggilan API; menggabungkan Operator (peramban visual) dan Deep Research (peramban teks). [F] VentureBeat (sekunder)
- Work kini: peramban awan terpisah dengan cookie dan sesi sendiri, dipisah dari peramban pengguna. [F] learn.chatgpt.com/docs/browser
- Peramban dalam aplikasi desktop: profil terpisah; pengaturan default menjelajah/unduh/unggah + pengecualian per situs; ChatGPT tidak bisa mengotomasi unggah berkas. [F] browser
- Plugin = skill + MCP + ekstensi; izin mengikuti ruang kerja dan layanan masing-masing. [F] plugins

### 3.3 Izin dan sandbox
- Dua lapis: sandbox menentukan apa yang bisa diakses; persetujuan menentukan kapan berhenti. Mengganti peninjau tidak memperluas sandbox. [F] permission-modes
- Mode: "Ask for approval" (titik awal disarankan, berhenti sebelum keluar batas ruang kerja), "Approve for me" (batas sama, permintaan yang melewati batas dinilai peninjau otomatis), "Full access" (hanya muncul di keterangan gambar, tidak dijelaskan). [F] permission-modes
- Ada peringatan: pada Full access, perintah persetujuan plugin (mis. kirim pesan) bisa nonaktif atau gagal; kembali ke mode lain. [F] plugins
- Tujuan jangka panjang tidak memperluas akses: sandbox dan kebijakan persetujuan awal tetap, jeda saat butuh keputusan. [F] long-running-work
- Tugas terjadwal berjalan tanpa pengawasan dengan sandbox bawaan; mode baca-saja membuat panggilan tulis/jaringan/aplikasi gagal. [F] automations
- Admin organisasi dapat membatasi mode, plugin, dan hook; mode yang dilarang tampil nonaktif. [F] permission-modes, plugins

### 3.4 Kemajuan dan hasil
- Baris tujuan di atas kolom ketik: tujuan, status ("Paused goal"), waktu; jeda, lanjut, ubah, hapus. [F] long-running-work
- Pesan susulan saat berjalan; "side chat" untuk ringkasan tanpa mengganggu. [F] long-running-work
- Tiap chat menyimpan konteks, pesan, hasil, dan tujuannya sendiri. [F] long-running-work
- Status singkat dan lonceng aktivitas; notifikasi sistem. [F] learn.chatgpt.com/docs/notifications (via riset 01)
- Hasil tugas terjadwal: kotak "Scheduled" dengan penanda belum dibaca; tugas mandiri membuka chat baru tiap jalan, tugas di dalam chat kembali ke chat itu. [F] automations
- Peringatan resmi: ringkasan yang yakin bukan bukti berhasil, periksa hasil nyata. [F] working-with-agents (via riset 01)

### 3.5 Pola keselamatan (ringkas)
- Konfirmasi sebelum aksi berdampak: kirim data, beli, ubah izin, hapus. [F] browser. Agen lama: sebelum kirim formulir atau email. [F] VentureBeat
- Login: berhenti di layar login; kredensial lewat formulir aman yang tidak dilihat model, atau masuk di halaman web; model peninjau memeriksa tanda phishing sebelum permintaan masuk. [F] browser
- Ambil alih: pengguna dapat mengambil alih komputer agen (mobile/desktop). Menurut ringkasan halaman bantuan, tangkapan layar tidak diambil selama pengguna memegang kendali. [F] hasil pencarian kutipan help.openai.com/en/articles/11752874 (sekunder)
- Isi web = konteks tak tepercaya; izin situs tidak membuat isinya tepercaya. [F] browser
- Izin situs di awan: Always ask / Auto approve / Always allow (tidak disarankan) + daftar izinkan/blokir per situs. [F] browser
- Penolakan tugas berisiko tinggi (transfer keuangan, pelanggaran privasi); Watch Mode; tanpa memori antar-sesi agen lama. [F] VentureBeat (sekunder)
- Pemantauan prompt injection ada tetapi "tidak menghapus semua risiko"; aktifkan hanya aplikasi yang perlu. [F] hasil pencarian kutipan help.openai.com (sekunder)
- MCP (spesifikasi): harus ada manusia dalam lingkaran yang bisa menolak pemanggilan alat; UI harus jelas alat apa yang terbuka ke model dan penanda visual saat alat dipanggil; klien sebaiknya menampilkan masukan alat sebelum panggilan; server wajib validasi masukan, kontrol akses, batas laju, sanitasi keluaran; anotasi alat dianggap tak tepercaya kecuali dari server tepercaya. [F] modelcontextprotocol.io/specification/2025-06-18/server/tools
- Panduan keamanan plugin OpenAI: hak akses minimum; pahami saat menautkan akun/memberi akses tulis; asumsikan masukan berbahaya akan sampai ke server, validasi di sisi server; konfirmasi manusia untuk aksi yang tak bisa dibatalkan; minimalkan data dan jangan taruh rahasia di properti komponen; OAuth 2.1; verifikasi scope di tiap panggilan alat. [F] developers.openai.com/apps-sdk/guides/security-privacy

---------------------------------------------------------------------
## 4. Pola yang membuat banyak komponen terasa SATU alur
1. **Satu pintu masuk.** Satu kolom ketik; pengguna menyebut hasil, bukan alat. Alat dipilih sistem; "@" hanya jalan pintas. [F] plugins [K]
2. **Penyatuan lewat standar.** Semua alat luar tampil sama (plugin/app) walau di belakangnya MCP, skill, OAuth beragam. Pengguna hanya melihat "pasang, sambungkan". [F] plugins; apps-sdk [K]
3. **Hasil kembali ke tempat yang sama.** Tugas panjang kembali ke chat; tugas jadwal ke "Scheduled"; keduanya bertanda belum dibaca. [F] automations [K]
4. **Satu aturan izin untuk semua jalur.** Suara memakai izin tugasnya; tugas jangka panjang tidak memperluas akses; tugas terjadwal memakai sandbox bawaan. Jadi tidak ada jalur dengan aturan lain. [F] voice, long-running-work, automations [K]
5. **Konteks menempel pada wadah, bukan pada pengguna.** Proyek membawa instruksi dan sumber ke setiap chat di dalamnya; lalu agen dan jadwal berjalan di wadah itu. [F] projects [K]
6. **Berhenti hanya saat perlu.** Tanya bila ada keputusan, akses kurang, atau aksi berdampak; selebihnya jalan sendiri. [F] working-with-agents, long-running-work
7. **Kemajuan = satu baris + kotak masuk + status pendek.** Bukan log teknis. [F] long-running-work, notifications [K]
8. **Uji dulu baru otomasi.** Coba di chat biasa, tinjau beberapa run awal, baru jadwalkan; prompt jadwal harus menyebut kapan berhenti/tanya. [F] automations
9. **Pengetahuan berulang dipaketkan jadi skill**, dipanggil `$nama` atau otomatis. [F] automations, plugins
10. **Kontrol administrator di satu tempat** (sambungan tim, mode izin, hook) sehingga pengguna awam tidak perlu mengambil keputusan teknis. [F] plugins, permission-modes
11. **Batas yang jujur.** Dokumentasi mengakui: proyek tidak menegakkan batas; sandbox tidak mengatur web search, konektor, MCP, peramban; ringkasan agen bukan bukti. [F] projects, permissions, working-with-agents [K]

Kelemahan yang terlihat [K]: nama berubah-ubah (Apps SDK/Plugins/Connectors/Apps; agent/Work), Full access tidak dijelaskan di halaman izinnya, perilaku tugas jadwal desktop bergantung komputer menyala, istilah teknis (MCP, sandbox, RRULE) bocor.

---------------------------------------------------------------------
## 5. PEMETAAN KE RAIVERSE
Padanan dibaca dari `docs/FUNDAMENTAL/01-FUNDAMENTAL.md`, `docs/PETA-BACKEND.md`, `docs/PETA-OTAK.md` (dari kode; belum dicoba di layar). Bagian depan 3D dibekukan; saran bersifat backend atau tombol kecil.

| Pola ChatGPT | Padanan RAIVERSE | Celah | Saran konkret |
|---|---|---|---|
| Satu kolom ketik, pilih hasil bukan alat | Pemandu: aturan dulu (tanpa token), model kecil bila tak terduga; lalu "Kerjakan" -> `engine.submitGoal` | Pemandu sudah memilih jalur, tetapi pengguna tak melihat "siapa mengerjakan" | Setelah "Kerjakan", tampilkan satu baris: "Tim X mengerjakan: <tujuan>" (dari data tugas) |
| Agen: rencana -> alat -> periksa -> hasil | Master (lintas divisi) -> manajer (22) -> staf; maks 10 giliran; `complete_task` wajib berisi bukti dan "belum terpenuhi"; manajer menunggu subtugas lalu menyintesis | Sudah lebih disiplin soal bukti dibanding ChatGPT; belum ada "mode rencana" yang bisa disetujui pengguna sebelum jalan | Untuk goal lintas divisi, tampilkan rencana master (daftar langkah) dalam kartu konfirmasi sebelum tugas dibuat |
| Plugin/App = skill + MCP + UI | 31 kemampuan inti + staf (216 spesifikasi native) = "kemampuan"; alat `buka_alat` kelompok "mcp" (manajer/master/PA) lewat `collab.js` | Staf dan kemampuan tidak tampil sebagai "katalog pasang" yang bisa dilihat pengguna; MCP hanya level manajer ke atas | Halaman "Kemampuan" bergaya katalog (nama, apa yang dilakukan, perlu sambungan apa) memakai data `staff-catalog`; label "perlu Google" dst. |
| Konektor Google Drive/GitHub (satu tombol sambung) | `gdrive.js` + login Google; token terenkripsi (`secure.js`); sinkron Drive ke Brain ditandai "Drive" = fakta | Penyambungan Google ke Drive dan Gmail/Sheets belum satu alur; Sheets/email "belum tersambung" dikatakan jujur | Satu kartu "Sambungkan Google" dengan daftar izin yang jelas ("Drive: baca; Sheets: ..."), tampilkan status tersambung per layanan |
| "Pasang, sambungkan saat diminta" | Hasil tidak boleh dipalsukan: bila belum tersambung, katakan jujur (prinsip 9) | Pesan "belum tersambung" belum selalu disertai tombol sambung | Setiap pesan "belum tersambung" membawa satu tombol "Sambungkan" langsung ke layanan terkait |
| Saluran lain (Slack/Gmail sebagai pemicu) | Telegram dan Discord, satu sesi per pengguna, diterjemahkan ke giliran Pemandu yang sama (`channels/*`) | Kartu Sambungan di Pengaturan yatim (dari riset 01); hasil/konfirmasi di saluran belum teruji penuh | Hidupkan kartu Sambungan; pastikan kartu persetujuan juga muncul sebagai tombol di Telegram/Discord |
| 3 mode izin (Tanya dulu / Setujui untukku / Akses penuh) | `approvals.js`: review, otomasi, aksi browser TIDAK pernah disetujui otomatis; setelan `autoApprove` (nyala) hanya untuk selebihnya; konsol admin untuk pengelola | Tidak ada pilihan tingkat mandiri bagi pengguna; "Full access" sengaja tidak ada (bagus) | Tiga kata di Pengaturan: "Tanya dulu" (bawaan), "Tanya hanya yang berdampak", "Jalankan rutin sendiri"; JANGAN buat Akses penuh. Penjaga kode tetap menang |
| Dua lapis: sandbox + persetujuan | Dua lapis juga: `catalog.roleAllows` + `runTool` (apa yang boleh dilihat/dipanggil per peran) dan `approvals` (kapan berhenti); `governor` (kuota, anggaran) | Lapis ketiga RAIVERSE (biaya) tak ada di ChatGPT; bagus | Dokumentasikan sebagai "tiga pagar: izin peran, persetujuan, anggaran" di konsol admin |
| Konfirmasi aksi berdampak | `confirm` di Pemandu (pratinjau, Ya/Batal); kartu "Butuh kamu"; `request_approval` untuk uang, kontrak, HR, data pribadi, publikasi | Konfirmasi sudah ada; belum menampilkan "masukan yang akan dikirim" secara lengkap (MCP menyarankan) | Pratinjau kartu menampilkan isi persis yang akan dikirim/disimpan dan ke mana; tombol "Ubah" |
| Browser awan dan ambil alih | Browser agen (`browser.js`, Chrome DevTools MCP), izin per divisi, pagar domain/kata sandi/pembayaran, isi web = data bukan perintah; aksi browser tak pernah disetujui otomatis | Hanya admin; tidak ada "jeda di login, pengguna mengambil alih" untuk pengguna biasa; belum teruji penuh | Tambah keadaan "Menunggu kamu masuk" pada tugas browser dengan tombol "Saya sudah masuk"; kata sandi tak pernah lewat model |
| Isi web tak tepercaya | Prompt dan `browser.js` memperlakukan web sebagai data; samarkan email/telepon sebelum ke model (`staf`) | Tidak terlihat pengguna | Label "dari web, belum diperiksa" pada kutipan; catat sumber di bukti hasil |
| Kemajuan: satu baris + jeda/ubah | `progress` (bilah + teks), mesin kerja `tick`, `maxConcurrent` 3, siaran langsung, jeda hanya di sidebar desktop | Jeda/ubah arah tidak ada di HP; tak ada "tambah arahan saat berjalan" | Kartu kemajuan memuat Jeda, Lanjut, "Tambah arahan"; kirim ke tugas lewat `create_subtask` atau pesan ke PA |
| Status singkat dan notifikasi | Lencana "Perlu kamu", "Sedang dikerjakan", "Selesai" di Hasil Saya; Telegram/Discord | Belum ada status tunggal 4 kata, dan notifikasi Telegram untuk "Perlu kamu" belum jelas | Status: Bekerja, Perlu kamu, Siap, Terhenti; kirim sebagai pesan saluran |
| Tugas terjadwal + kotak "Scheduled" | n8n (`n8n.js`, `n8n-templates`) hanya untuk jadwal dan pemicu luar, dibuat Pemandu dengan konfirmasi; hook bertanda tangan; otomasi tak pernah disetujui otomatis; `gate.js` token pendek ke AI | Hasil jadwal tak punya "kotak masuk" sendiri di depan; n8n harus hidup; 221 alur tersimpan, 0 aktif | Bagian "Terjadwal" di Hasil Saya + tombol "Ulangi tiap ..." di kartu hasil; tampilkan "n8n mati" jujur |
| Pemicu peristiwa (Gmail/Slack/GitHub) | Pemicu luar lewat n8n; Telegram sebagai masukan | Tak ada pemicu "email baru" untuk pengguna | Mulai dari satu pemicu: "pesan baru di Telegram" atau "berkas baru di Drive" ke Pemandu |
| Proyek (chat + berkas + instruksi + folder) | Brain (catatan bertautan), perpustakaan, Hasil Saya, Tim Saya; ruang kerja per pengguna; "Memori" kecil; Drive sync | Tidak ada wadah "Proyek" yang membawa instruksi tetap ke semua chat dan tugas | "Proyek" ringan di Brain: nama, instruksi tetap (dimasukkan ke prompt), catatan/berkas, dipilih di Beranda; goal baru mewarisi |
| Berkas / Sources | Brain (catatan Markdown), `data/uploads`, `data/staff-out` (hasil berkas staf), Drive | Hasil staf (CSV/teks/HTML) tersebar | Tombol "Simpan ke Proyek/Catatan" pada setiap berkas hasil |
| Memori dan instruksi khusus | `memory-lite.js` (catatan agen ±2.200, profil ±1.375, menunggu persetujuan pengguna); Brain; "Aku belajar sesuatu... Simpan?" | Lebih terkendali daripada ChatGPT; kurang terlihat | Pertahankan; tampilkan "Aku ingat: ..." di sapaan; tambah tombol "lupakan" per butir |
| Skill (paket cara kerja) | Skill pustaka (`SEED_SKILLS`), skill buatan agen = selalu draf, uji coba 3 kali, disetujui Owner | Sudah kuat | Pertahankan; sebutkan di UI sebagai "Cara kerja" |
| Berbagi | Ruang kerja per pengguna, anggota hanya melihat ruangnya (`auth.js`); ekspor/hapus (`privacy.js`) | Tidak ada berbagi hasil/proyek lintas pengguna | Tautan baca-saja ke satu hasil (kadaluarsa), tanpa membuka ruang kerja |
| Admin mengatur sambungan, mode, hook | Konsol admin: kunci AI, model, MCP, kuota, data, keamanan; hanya pengelola (403 seragam) | Sudah sejalan; hanya perlu "daftar alat yang terbuka ke model" (MCP menyarankan) | Halaman admin: "Alat yang terlihat tiap peran" (dari `catalog.ROLE_BASE`) + log pemanggilan alat (audit) |
| Mencopot tidak memutus sambungan | Token Google terenkripsi; privasi hapus akun | Belum jelas bahwa "putus Google" menghapus token | Tombol "Putuskan" yang menghapus token dan menjelaskan apa yang berubah |
| Prompt injection dan MCP luar | Alat `mcp` hanya manajer/master/PA; kuota, tak ada subtugas dari tugas rutin/massal | Tidak ada daftar putih server MCP/anotasi alat | Admin: daftar putih server MCP; tandai alat baca-saja vs mengubah; semua alat "mengubah" lewat konfirmasi |

---------------------------------------------------------------------
## 6. 10 rekomendasi terurut dampak
1. **Satu kartu "Sambungkan" untuk Google dan Telegram/Discord** dengan daftar izin yang jelas, status per layanan, dan tombol "Putuskan"; setiap pesan "belum tersambung" memuat tombol sambung. Dampak terbesar: ini "pintu" semua integrasi. [K]
2. **Pilihan kemandirian 3 kata** untuk pengguna (Tanya dulu / Tanya hanya yang berdampak / Jalankan rutin sendiri); tanpa "Akses penuh"; review, otomasi, browser tetap manual. [K]
3. **Pratinjau konfirmasi yang jujur**: tampilkan isi persis yang akan dikirim, ke mana, dan dapat diubah (sesuai anjuran MCP: tampilkan masukan alat sebelum panggilan). [K]
4. **Kartu kemajuan terpadu**: baris tujuan, status 4 kata (Bekerja, Perlu kamu, Siap, Terhenti), Jeda, Lanjut, "Tambah arahan"; kirim juga ke Telegram/Discord. [K]
5. **"Proyek" ringan** (instruksi tetap + catatan/berkas + goal yang mewarisi) agar chat, berkas, dan agen terasa satu alur. [K]
6. **Rencana master yang bisa disetujui** untuk goal lintas divisi sebelum tugas dibuat (padanan "plan mode"). [K]
7. **Kotak "Terjadwal" di Hasil Saya** + tombol "Ulangi tiap ..." di kartu hasil; jujur bila n8n mati; uji dulu satu kali sebelum dijadwalkan. [K]
8. **Katalog "Kemampuan"** untuk pengguna (dari `staff-catalog`: apa yang dilakukan, perlu sambungan apa) dan "@" di kolom tulis untuk memilih staf/kemampuan. [K]
9. **Browser agen: keadaan "Menunggu kamu masuk" + ambil alih**; kata sandi tidak melewati model; label "dari web, belum diperiksa". Tetap uji dulu sebelum dibuka ke pengguna. [K]
10. **Pagar admin yang terlihat**: daftar alat per peran, daftar putih server MCP, penanda alat baca-saja vs mengubah, log pemanggilan; untuk berbagi, tautan baca-saja berkedaluwarsa. [K]

Catatan akhir: padanan RAIVERSE berasal dari dokumen peta (kode), belum dicoba di layar. Perilaku ChatGPT dibaca dari dokumentasi resmi yang terbuka pada 2026-11-19 dan dapat berubah; butir bertanda "sekunder" harus diverifikasi sebelum dijadikan keputusan.
