# PETA WEBSITE (bagian depan) RAIVERSE AGENT

Dibuat dari KODE di `public/` (index.html, js/*.js, css/*.css) dan dicocokkan dengan rute di `server/`. Bukan dari ingatan atau dokumen lama.
Belum ada yang dijalankan di peramban: semua isi di bawah dibaca dari kode, bukan dilihat di layar.

Tanda keyakinan:
- [K] = yakin, terbaca langsung di kode (berkas:baris di ujung butir).
- [D] = dugaan, perlu dicek di layar atau dengan akun lain.
Singkatan: `v.js` = views.js, `a.js` = app.js, `c.js` = core.js, `p.js` = obrolan-view.js, `h.js` = hasil-view.js, `t.js` = tim-view.js, `s.js` = pengaturan-view.js, `ab.js` = admin-bagian.js, `av.js` = admin-view.js, `o3.js` = office3d.js. Nomor baris = keadaan berkas saat dibaca.

---------------------------------------------------------------------
## RINGKASAN 10 BARIS

1. Halaman: 15 layar terdaftar di `VIEWS` (v.js:1767). 6 untuk pengguna biasa (Beranda, Hasil Saya, Catatan, Tim Saya, Kantor 3D, Pengaturan) dan 9 khusus pengelola platform (#admin + 8 halaman lama). Jalur #hash valid = 20 (15 + 5 nama lama di `LEGACY`, v.js:1787).
2. Tombol aksi: kira-kira 170 definisi tombol di layar pengguna biasa (60% di Kantor 3D) dan kira-kira 100 di konsol dan layar lama. Ini hitungan teks (`<button`, `tombol(`), bukan hitungan layar, jadi angka kasar.
3. Rute API yang dipanggil: 74 pasang metode+alamat unik di luar konsol, ditambah 32 rute `/api/admin/*`, ditambah `/api/stream`, `/auth/google`, `/auth/logout`. Semua cocok dengan server (hasil skrip pencocokan); 0 rute hilang.
4. PENTING 1: Dua bagian kode yatim: kartu Telegram/Discord (`sambungan-view.js`, tidak pernah diimpor) dan `DashboardView` lama (tidak ada di `VIEWS`). Pengguna biasa tidak punya tempat menyambungkan Telegram/Discord walau servernya sudah siap.
5. PENTING 2: Di layar desktop TIDAK ada bilah atas, jadi tidak ada tombol Cari (palet hanya lewat Ctrl+K) dan tidak ada tanda "Terputus" (a.js:59, glass.css:271). Di HP kedua hal itu ada.
6. PENTING 3: Di HP tombol "Jeda atau lanjutkan kerja tim" dan keterangan "Jatah" hilang, karena letaknya di sidebar yang disembunyikan (a.js:50, app.css:262).
7. PENTING 4: Suara asisten (Pengaturan > Tampilan) hanya membacakan pesan percakapan (dock Kantor 3D, obrolan). Balasan Pemandu di Beranda TIDAK dibacakan. Suara bawaan: mati.
8. PENTING 5: Rapat lewat Aula Rapat di Kantor 3D memunculkan jendela berjargon dan berisi emoji ("Adakan rapat multi-agen", "154 panggilan AI") ke pengguna biasa (v.js:67, v.js:493).
9. Jargon masih tampil: "Agen" (menu Pindah cepat, nama browser tab), "Backlinks", "node", folder berbahasa Inggris di Catatan, "Mode Play", "fps", "draw".
10. Rute server tanpa tombol: ekspor dan hapus data pribadi (`/api/me/*`), cabut sesi, daftar dan cabut undangan, izin anggota, otomasi (`/api/automations/*`).

---------------------------------------------------------------------
## 0. KERANGKA HTML DASAR  [K]

- `index.html`: satu halaman, judul tab "RAIVERSE AGENT" (index.html:6), bahasa `id`, tema bawaan terang.
  - Wadah: `#sidebar`, `#topbar`, `#view` (isi halaman), `#bottomnav` (HP), `#drawer`, `#modal`, `#palette`, `#toasts` (index.html:20-28).
  - Skrip tunggal: `/js/app.js` (modul). Peta impor three.js untuk Kantor 3D (index.html:15-17).
  - Gaya dimuat berurutan: app.css, knowledge.css, glass.css, identity.css (identity.css paling akhir = lapisan identitas).
  - Judul tab berganti "<Nama halaman> · RAIVERSE AGENT" (a.js:90).

---------------------------------------------------------------------
## 1. GERBANG MASUK

- Saat dibuka, `boot()` memanggil `GET /api/state` (a.js:147, c.js:61).
  - Jika 200: lanjut ke halaman [K].
  - Jika 401 atau 403: kartu masuk `#gate` menutupi layar dan halaman tidak digambar (c.js:63; a.js:151).
  - Jika jaringan putus: layar kosong "Belum bisa tersambung" + tombol "Muat ulang" (a.js:153).
- Kartu masuk (c.js:33-48)
  - Logo, judul "Masuk ke RAIVERSE".
  - Teks: masuk dengan akun Google, otomatis dapat ruang kerja sendiri, bisa diundang lewat tautan.
  - Satu tombol: "Masuk dengan Google" = tautan ke `/auth/google` (c.js:43).
  - Catatan kecil: aplikasi hanya meminta nama, email, dan akses ke berkas Drive yang dibuat atau dipilih.
  - Pesan galat dari `?login=...` pada alamat ditampilkan merah bila ada (c.js:42).
- Sesi berakhir di tengah pemakaian: setiap `api()` yang menerima 401 memunculkan kartu yang sama (c.js:25).
- Mode lokal (belum ada yang pernah masuk): server tidak mewajibkan login, kartu tidak muncul, dan pengguna dianggap pemilik + pengelola platform [K] (server/auth.js:116 `isPlatformAdmin`, `enforced()`).
- TEMUAN gerbang:
  - Kartu yang sama dipakai untuk 403 "Kamu belum menjadi anggota ruang kerja mana pun" (server/index.js:~476). Orang yang SUDAH masuk akan tetap disuruh "Masuk dengan Google", tanpa penjelasan. Komentar di c.js:32 menyebut keadaan "menunggu persetujuan Owner", tetapi tidak ada kode untuk itu: parameter `info` tidak dipakai [K].

---------------------------------------------------------------------
## 2. KERANGKA APLIKASI (a.js)

### 2.1 Jalur #hash dan rute
- Hash valid (nama `VIEWS`, v.js:1767-1786) [K]
  - Pengguna biasa: `#dashboard` (Beranda), `#tasks` (Hasil Saya), `#brain` (Catatan), `#team` (Tim Saya), `#office` (Kantor 3D), `#settings` (Pengaturan).
  - Pengelola: `#admin`, `#admin-chat`, `#admin-approvals`, `#admin-studio`, `#admin-knowledge`, `#admin-browser`, `#admin-tasks`, `#admin-team`, `#admin-settings`.
  - Nama lama (`LEGACY`, v.js:1787): `#chat`, `#approvals`, `#studio`, `#knowledge`, `#browser` diterjemahkan ke `admin-*` yang sesuai.
  - Parameter lewat `?`: `#brain?note=ID`, `#tasks?buka=ID`, `#dashboard?mulai=teks`, `#dashboard?untuk=ID`, `#office?focus=ID`, `#office?nointro`, `#brain?graph=1` [K] (c.js:198, a.js:148-149).
- Hash tidak dikenal [K]
  - Saat halaman dibuka: diabaikan, Beranda yang tampil, tulisan hash aneh tetap di alamat sampai pindah halaman (a.js:148).
  - Saat hash diubah manual: diabaikan, halaman tetap di tempat (a.js:158-161). Tidak ada pesan.
- Hash layar pengelola oleh bukan pengelola platform: dialihkan ke Beranda + toast "Bagian itu hanya untuk pemilik ruang kerja." (a.js:76-86). Yang menentukan: `data.platformAdmin === true` (awam.js `bisaKelola`). Server tetap memeriksa tiap rute `/api/admin/*` dan membalas 403.
- Pindah halaman memakai `history.replaceState` (tidak menambah riwayat tombol Kembali) (c.js:198-204) [K].
- Di dalam jendela Kantor 3D, `navigate()` membuka jendela di dalam 3D, bukan meninggalkan kantor (c.js:199, v.js:589-616).

### 2.2 Sidebar (desktop, di atas 820 px) [K]
- Kepala: logo, tulisan "RAIVERSE AGENT", nama perusahaan (`company.name`), tombol ciutkan/perluas (a.js:43). Selalu ciut saat halaman dimuat; pilihan disimpan di `navCollapsed` tetapi tidak pernah dibaca lagi (a.js:30, 51).
- Menu utama (urutan `CORE`, a.js:28): 1 Beranda, 2 Hasil Saya, 3 Catatan, 4 Tim Saya.
  - Lencana angka di Hasil Saya = jumlah persetujuan menunggu untukmu (a.js:22-25).
- Kaki: tombol "Jeda atau lanjutkan kerja tim" menampilkan "Dijeda / Sedang bekerja / Siap membantu · Jatah banyak|cukup|hampir habis|habis" (a.js:34, 50). Klik memanggil `PATCH /api/settings {autonomy}`.
- "Lainnya" (a.js:53, daftar `MORE` a.js:29): Kantor 3D, Pengaturan. Membuka daftar kecil di tempat.
- Lebar 821-1024 px: sidebar hanya ikon (app.css:254-258).

### 2.3 Bilah atas dan menu bawah di HP (820 px ke bawah) [K]
- Bilah atas hanya tampil di HP (glass.css:271 menyembunyikan di desktop; glass.css:286 menampilkan di HP).
  - Isi: judul halaman, tombol Cari (membuka palet), tombol Menu, dan label "Terputus" bila SSE putus (a.js:59-66).
- Menu bawah (a.js:54-56): 4 tombol utama (Beranda, Hasil, Catatan, Tim; memakai `short`) + "Lainnya".
  - "Lainnya" membuka jendela "Menu" yang berisi 6 item: 4 utama + Kantor 3D + Pengaturan (a.js:68-74). Empat di antaranya ganda dengan menu bawah.
- Sidebar disembunyikan di HP (app.css:262), sehingga tombol Jeda/Jatah tidak ada.

### 2.4 Palet perintah (Ctrl atau Cmd + K, Esc menutup) [K]
- Pembuka: hanya pintasan keyboard di desktop (a.js:142); tombol Cari hanya di HP (a.js:61).
- Kolom: "Cari orang, hasil, atau catatan…" (a.js:100).
- Aksi bawaan PERSIS 6 (a.js:105-112):
  1. Mulai pekerjaan baru (ke Beranda)
  2. Buka Hasil Saya
  3. Buka Catatan
  4. Buka Tim Saya
  5. Buka Kantor 3D
  6. Ganti tampilan terang atau gelap
- Hasil pencarian (hanya saat ada ketikan): sampai 6 orang AI (buka kartu orang), 8 catatan (buka di Catatan), 8 pekerjaan induk terbaru (buka di Hasil Saya), maksimal 30 baris (a.js:113-121).
- Bila tak ada orang/catatan/hasil yang cocok: baris "Tanya Pemandu: “<ketikan>”" membuka Beranda dengan `?mulai=` (a.js:122).
- Panah atas/bawah, Enter, Esc, klik di luar kartu menutup (a.js:126-136).

### 2.5 Tema, kejadian, dan penyegaran [K]
- Tema terang/gelap: `window.setTheme`, disimpan di `localStorage ui-theme` (a.js:14-20). Tombolnya: palet, Pengaturan.
- SSE `/api/stream` (c.js:71): pesan `reload` memuat ulang seluruh halaman (c.js:78); `upsert/remove/root` memperbarui data lokal lalu tiap halaman menggambar ulang lewat `update()`.
- Waktu relatif ("5 mnt") disegarkan tiap 30 detik hanya di Hasil Saya dan Tim Saya (a.js:178).
- Tombol "Salin" di kotak kode (`data-copy`) memakai papan klip (a.js:140).

---------------------------------------------------------------------
## 3. HALAMAN-HALAMAN

### 3.1 BERANDA = Pemandu (`#dashboard`) — p.js
Judul di bilah: "Beranda". Satu percakapan dengan "Pemandu".
- Susunan layar (p.js:21-37): sapaan awal `#pmHome`, penanda "pekerjaan untuk <orang>" `#pmUntuk`, utas percakapan `#pmThread`, kotak tulis + tombol mik + tombol Kirim, dan baris kaki (sisa jatah + "Yang aku tahu tentang kamu").
- Data yang dibaca: `GET /api/pemandu/home` saat dibuka (p.js:188). Jika gagal, sapaan cadangan "Halo!" + 4 kartu bawaan `STARTERS` (p.js:18, 189).
- Keadaan awal (p.js:84-95)
  - Sapaan dari server (mis. "Selamat pagi, <nama>!") + kalimat pengantar.
  - Bila belum kenal pengguna (`onboarding`): kartu "Boleh kenalan dulu?" dengan "Boleh, kenalan" dan "Lewati dulu".
  - Kartu saran dari server: "Lanjutkan yang tadi" (bila ada sesi 2 hari terakhir) + 4 kartu: "Bantu aku membuat konten", "Cari tahu soal sesuatu", "Atur rencana usahaku", "Tuliskan sebuah pesan" (server/pemandu.js:129, 683). Intent "Meringkas" dan "Belajar" ada di server tetapi tidak jadi kartu awal [K].
- Alur giliran (p.js:110-124)
  - Klik kartu atau tombol saran = `POST /api/pemandu/turn {sessionId, choiceId}`. Ketik bebas = `{input}`. Enter kirim, Shift+Enter baris baru.
  - Pesan pengguna muncul dulu sebagai gelembung, lalu balasan Pemandu. Tombol saran hanya melekat pada balasan TERAKHIR (p.js:60-70).
  - Gagal jaringan: balasan cadangan "Sepertinya sambungan sedang terputus..." + "Coba lagi" / "Mulai dari awal" (p.js:17). Tidak ada toast galat di layar ini.
  - Mode "kembali" memundurkan percakapan satu langkah (p.js:113).
- Jenis balasan `kind` (server/pemandu.js:354-663) dan cara tampil [K]
  - `choices`: pertanyaan + 2-4 tombol saran; ada tanda "Disarankan", petunjuk kecil, "Serahkan ke kamu", "Lainnya (ketik)", "Kembali".
  - `confirm`: ringkasan "Yang akan terjadi" (daftar label-nilai) + tombol "Mulai" dan "Ubah pilihan".
  - `progress`: bilah kemajuan + teks; layar memeriksa ulang tiap 2,5 detik (`choiceId:'poll'`, p.js:104-108); bila jaringan putus mencoba lagi tiap 5 detik.
  - `result`: kartu hasil (judul, teks, "versi N", "Yang belum terpenuhi"), tombol "Salin teks"; pilihan "Pakai ini", "Ubah sedikit", "Buat versi lain", "Simpan".
    - "Ubah sedikit" memberi pilihan: Lebih singkat, Lebih santai, Lebih resmi, Lebih lengkap + ketik bebas.
    - "Pakai ini" menyalin teks ke papan klip + toast "Teks sudah disalin..." (p.js:121). "Simpan" menulis ke Catatan: "Tersimpan di Catatan: <judul>".
  - `done`: ucapan selesai + tombol "langkah lanjut" (termasuk "jadwal" bila pemilik) + kartu tambahan.
  - `error`: pesan ramah + "Coba lagi" / "Mulai dari awal".
  - Kartu mini (`cards[]`, tombol `card:<tipe>:<id>`): satu-satunya tipe terdaftar adalah `learned` ("Aku belajar sesuatu dari pekerjaan tadi. Simpan?") (server/pemandu.js:456-461).
  - Blok tambahan: catatan kecil (`notes`), daftar "yang kuketahui" (`profile`), "Betul" / "Ubah" setelah belajar (p.js:64).
- Kenalan (onboarding): "Boleh, kenalan" membuka mode ketik; isi dikirim `POST /api/pemandu/onboard {input}`; balasan berisi ringkasan + "Betul"/"Ubah". "Lewati dulu" = `POST /api/pemandu/onboard {skip:true}` (p.js:125-139).
- "Yang aku tahu tentang kamu" (jendela, p.js:196-207)
  - Dibaca `GET /api/pemandu/profile`; setiap isian bisa diubah; kosongkan = hapus.
  - "Yang kupelajari dari kita bekerja bersama": tiap butir ada "Hapus" = `DELETE /api/belajar/profil/:nomor`.
  - Simpan = `PUT /api/pemandu/profile {items, replace:true}` + toast "Sudah kuingat."
- Mik (`#pmMic`): hanya muncul bila peramban punya Web Speech; bahasa `id-ID`; hasil masuk ke kolom tulis, tidak terkirim otomatis (p.js:165-176).
- "Beri pekerjaan" dari Tim Saya atau kantor 3D (`?untuk=ID`): muncul penanda "Pekerjaan ini untuk <nama>" + "Batal"; pesan pertama dikirim sebagai "Minta <nama> untuk <tulisan>" (p.js:148, 185-187).
- `?mulai=teks` (dari palet, Pengaturan WhatsApp): langsung mengirim teks itu (p.js:190).
- Kaki: "Sisa jatah hari ini: <banyak|cukup|hampir habis|habis>" + bilah (p.js:80). Tidak pernah dalam dolar.
- Pembersihan: `unmount` menghentikan polling dan mik (p.js:209).
- TEMUAN halaman ini: balasan Pemandu tidak dibacakan suara (p.js tidak mengimpor `tts`) [K]; tidak ada tombol "Percakapan baru" selain pilihan "Mulai dari awal" di dalam saran [K].

### 3.2 HASIL SAYA (`#tasks`) — h.js
Judul: "Hasil Saya" di menu, "Hasil saya" di kepala halaman (huruf besar-kecil beda, h.js:91).
- Kepala + kalimat: "Semua pekerjaan timmu ada di sini..." (h.js:91).
- Bilah: kolom "Cari pekerjaan…" (menyaring judul, nama, ringkasan) dan tombol "Mulai pekerjaan" (ke Beranda) (h.js:92-95).
- Data: `d.tasks` (tanpa anak, bukan rutinitas, bukan batal), `d.approvals`, dan `GET /api/staff/runs?limit=30` (h.js:101); runs disegarkan tiap 30 detik (a.js:178).
- Tiga kelompok (h.js:113-117): "Perlu kamu" (selalu tampil), "Sedang dikerjakan", "Selesai" (maks 20 terbaru) + lencana jumlah.
  - Aturan kelompok `kelompokTugas` (awam.js): ulasan/blokir/gagal/menunggu persetujuan = Perlu kamu; selesai = Selesai; sisanya Sedang dikerjakan.
- Kartu (h.js:69-84): avatar, judul (dibersihkan jargon dengan `awam()`), "Dikerjakan <nama> · <waktu> · N dari M langkah", lencana status, ringkasan 220 huruf, tombol:
  - "Lihat hasil" / "Tutup hasil": membuka isi (teks, berkas, tabel data).
  - Pekerjaan menunggu ulasan: "Pakai ini" (`POST /api/approvals/:id {decision:approve}`) dan "Ubah sedikit".
  - Izin terlepas (jenis `boleh`): "Boleh" (approve) dan "Jangan dulu" (`reject`, umpan balik "Jangan dulu") + kotak "Yang akan terjadi".
  - Pekerjaan lain: "Ubah sedikit", "Ulangi" (`PATCH /api/tasks/:id {status:'todo'}`), "Simpan" (`POST /api/notes`, folder "Hasil") atau "Buka di Catatan" bila sudah tersimpan.
- Jendela "Mau diubah seperti apa?" (h.js:145): 4 pilihan cepat + kolom bebas + "Kirim".
  - Bila ada persetujuan: `POST /api/approvals/:id {decision:'reject', feedback}`; bila tidak: `POST /api/tasks/:id/comment` lalu `PATCH /api/tasks/:id {status:'todo'}`.
  - Kosong: toast "Pilih salah satu atau tulis dulu ya."
- Berkas hasil (h.js:36, 155-162): "Buka" menampilkan jendela lebar (Markdown atau teks mentah, maks 60.000 huruf) dengan "Tutup" dan "Unduh"; "Unduh" langsung mengunduh. Data: `GET /api/staff/runs/:id/files/:nama`.
- Tabel hasil (maks 50 baris, 8 kolom), daftar kunci-nilai, tombol "Buka tabelnya" untuk tautan `https://` (h.js:18-30).
- Keadaan: memuat "Menyiapkan daftar hasilmu…"; kosong "Belum ada pekerjaan" + "Mulai pekerjaan"; pencarian kosong "Belum ada yang cocok"; kelompok Perlu kamu kosong "Tidak ada yang menunggumu sekarang." (h.js:93, 111, 116).
- `?buka=ID` membuka kartu itu langsung (h.js:89).

### 3.3 CATATAN (`#brain`) — v.js:1325-1450 (kode di dalam area "pengelola" tetapi dipasang ke pengguna biasa, v.js:1770)
Tiga kolom (daftar, penyunting, tautan); di HP kolom bergantian.
- Kolom kiri: kolom "Cari di Catatan…" + tombol "+" (Catatan baru) (v.js:1332).
  - Baris "Peta hubungan" (membuka graf) + tombol "Rapikan <lencana>" (`POST /api/brain/organize`, toast "Catatan dirapikan: N dipindah, M judul diperbaiki") (v.js:1362-1380).
  - Pohon folder: urutan folder sistem `Drive, Company, SOP, Sistem, Meetings, Playbooks, Memori, Archive`, lalu "Per divisi", lalu "Pustaka dan lainnya"; sub-folder bersarang, rantai satu anak diringkas "a › b" (v.js:1335-1385).
  - Ringkasan: "N catatan · M folder · disusun otomatis per Divisi/Jenis".
- Tengah: judul (bisa diubah di mode Ubah), chip folder, tab "Baca" | "Ubah", tombol tautan, tombol "Lainnya" (v.js:1387-1435).
  - Baca: penulis, "diperbarui <waktu>", isi Markdown dengan tautan `[[judul]]`.
  - Ubah: kotak teks, simpan otomatis 0,9 detik setelah berhenti mengetik atau Ctrl+S (toast "Tersimpan"). `PUT /api/notes/:id`.
  - "Lainnya" = jendela "Opsi catatan": folder, tag (pisah koma), "Hapus catatan" (`DELETE /api/notes/:id`), "Simpan".
  - Pilih catatan kosong: "Pilih catatan".
- Graf penuh: kanvas "Peta hubungan catatan perusahaan", klik titik membuka catatan (`createGraph`, graph.js).
- Kolom kanan: graf mini + "Backlinks (N)" + "Tautan keluar (N)"; tautan ke judul yang belum ada ditandai "(belum ada)" dan membuka jendela "Catatan belum ada" → "Buat catatan" (`POST /api/notes`) (v.js:1436-1448, v.js:45).
- Catatan baru (jendela): Judul + Folder (isian awal "Knowledge") → `POST /api/notes`, langsung masuk mode Ubah (v.js:1332).
- Data: `d.notes` (hanya yang boleh dibaca server). Dibuka dari palet, kartu Hasil, atau `?note=ID`.
- TEMUAN: lihat 6.c (Backlinks, node, nama folder Inggris, "Knowledge" bawaan).

### 3.4 TIM SAYA (`#team`) — t.js
- Kepala "Tim saya" + kalimat, kolom "Cari nama atau bagian…" (t.js:28-31).
- "Asisten kamu": kartu besar asisten pribadi dan asisten utama (t.js:51).
- Satu bagian lipat per divisi (`<details>`): nama divisi, "Penanggung jawab: <nama>", "N sedang bekerja · M orang", lalu kartu penanggung jawab dan staf (t.js:63-70). Membuka/menutup diingat selama tampilan; saat mencari semua terbuka.
- Kartu orang (t.js:17-24): avatar, nama, peran awam ("Asisten pribadi", "Asisten utama", "Penanggung jawab divisi", atau jabatan), status (Sedang bekerja, Menunggu pekerjaan, Baru selesai, Ada kendala, Sedang tidak ada) + kalimat status bila bersih dari jargon, tombol "Beri pekerjaan" = ke Beranda dengan `?untuk=ID`.
- Kosong: "Belum ada yang cocok" (t.js:68). Hanya karyawan bertipe AI yang ditampilkan.
- Tidak ada panggilan API sendiri (membaca `S.data`).
- Kartu orang juga muncul sebagai jendela saat `agentDrawer(id)` dipanggil dari palet atau Kantor 3D oleh pengguna biasa (v.js:1759-1763); untuk pengelola yang muncul laci teknis lama.

### 3.5 KANTOR 3D (`#office`): lihat bagian 4.

### 3.6 PENGATURAN (`#settings`) — s.js
Kepala "Pengaturan: Cukup empat hal: akunmu, tampilan, ruang kerja, dan sambungan." Empat kartu:
- Tampilan (s.js:15-18)
  - "Terang" / "Gelap" (`window.setTheme`).
  - "Suara asisten": tombol Nyala/Mati (`tts.set({on})`, disimpan di peramban). Bawaan: mati (tts.js:211).
- Akun (`GET /api/auth/me`, `GET /api/drive/config`, s.js:37-38)
  - Belum masuk atau mode lokal: "Kamu memakai ruang kerjamu sendiri" (+ "Masuk dengan Google" bila login tersedia).
  - Sudah masuk: foto, nama, email, tombol "Keluar" = tautan `/auth/logout` (s.js:46).
- Ruang kerja dan undangan (s.js:48-74)
  - Nama ruang kerja + peran (Pemilik, Pengelola, Anggota).
  - Bila punya lebih dari satu: daftar + "Buka" (`POST /api/ws/switch`, lalu muat ulang halaman).
  - Pemilik: kolom nama + "Ganti nama" (`POST /api/ws/rename`).
  - "Orang di ruang kerja ini" (`GET /api/ws/members`): pemilik dapat mengubah peran (Anggota/Pengelola, `POST /api/ws/member`) dan "Keluarkan" (jendela konfirmasi, `role:'remove'`).
  - Pemilik/pengelola: pilihan "Undang sebagai anggota/pengelola" + "Buat tautan undangan" (`POST /api/ws/invite`); hasil: kolom tautan + "Salin" + keterangan "Berlaku 7 hari".
  - Kosong: "Baru kamu sendiri".
- Sambungan (s.js:75-89)
  - Google: bila tersambung, "buka foldermu"; pemilik mendapat "Siapkan folder" (`POST /api/drive/setup`), "Kirim Catatan ke Google" (`push`), "Ambil dari Google" (`pull`, lalu polling `GET /api/drive/pull-status` tiap 2 detik dengan keterangan kemajuan).
  - Belum tersambung: tombol "Sambungkan Google" (ke `/auth/google`).
  - WhatsApp: tombol "Minta Pemandu menyambungkan" → Beranda dengan `?mulai=Tolong sambungkan WhatsApp-ku`.
- Gagal memuat: kartu galat + "Coba lagi" (s.js:39).
- TEMUAN: lihat 6.a (tidak ada Telegram/Discord) dan 6.d.

### 3.7 KONSOL PENGELOLA (`#admin`) — av.js, ab.js
Tidak ditautkan dari menu mana pun (a.js:27). Hanya terlihat bila `platformAdmin` benar. Semua panggilan lewat `adm()` ke `/api/admin/*` dengan header `X-Raiverse-Admin` (ab.js:9). Aksi berisiko memakai jendela `konfirmasi()`: harus mengetik ulang kalimat persis (ab.js:27).
- Kepala "Konsol pengelola" + 9 tab (av.js:20-21, 74-93):
  1. Ringkasan (`GET ringkasan`): kesehatan server, mesin AI, pemakaian hari ini, isi platform, data dan cadangan (ubin angka). Tanpa tombol.
  2. Penyedia AI (`GET ai`): kunci Groq dan Anthropic (Simpan kunci `POST ai/kunci`, Uji koneksi `ai/uji`, Hapus dari konsol `ai/kunci/hapus` dengan konfirmasi), model per tingkat (6 pilihan, `POST ai/model`), batas global (hanya baca).
  3. Kuota dan batas (`GET batas`): isian angka per kelompok (akun, global, laju, anggaran), "Simpan perubahan" (`POST batas`), "Bawaan" per baris, "Tutup anggaran sekarang"/"Buka kembali" (`POST anggaran`, tutup butuh konfirmasi), pemakaian global hari ini.
  4. Pengguna (`GET pengguna?cari&hal`): cari akun, Tangguhkan/Aktifkan (`pengguna/tangguhkan`), "Ekspor data" (alasan min. 10 huruf, unduh JSON, `pengguna/ekspor`), "Hapus" (konfirmasi + alasan, `pengguna/hapus`), halaman Sebelumnya/Berikutnya; daftar ruang kerja.
  5. Integrasi (`GET integrasi`): Google (hanya baca), n8n (status, "Cek sekarang" `integrasi/n8n/cek-sekarang`, "Nonaktifkan staf n8n" `integrasi/n8n/nonaktifkan-staf`, aktif bila skrip `scripts/n8n-staf-nonaktifkan.mjs` ada), Server MCP (daftar, Uji `integrasi/mcp/uji`, Hapus `integrasi/mcp/hapus`, formulir tambah `integrasi/mcp`), WhatsApp dan email (status saja).
  6. Staf dan katalog (`GET staf`): jumlah spesifikasi, pilihan mesin staf Native atau n8n dan bendera `staffModel` (`POST staf/bendera`), daftar bendera lain hanya baca.
  7. Keamanan (`GET keamanan`): log audit dengan saringan (aksi, pelaku, hasil), sesi aktif + "Cabut" (`keamanan/sesi/cabut`), upaya ditolak 24 jam, kunci enkripsi: "Bungkus ulang rahasia" (`keamanan/kunci/bungkus-ulang`) dan "Putar kunci enkripsi" (`keamanan/kunci/putar`), token hook.
  8. Data (`GET data`): ukuran data, "Buat cadangan sekarang" (`data/cadangan`), Periksa dan Pulihkan per cadangan (`data/cadangan/periksa`, `data/pulihkan`, pulihkan dijadwalkan saat server mulai ulang), "Batalkan pemulihan", mode penyimpanan per ruang kerja (json, dual, sqlite; `data/penyimpanan`, `data/bandingkan`).
  9. Alat lama: 8 tombol ke halaman lama (av.js:68-71, v.js:1789-1794).
- Tombol "Kembali ke Beranda" di bawah (av.js:84).
- Keadaan: memuat "Memuat…"; galat kartu "Ada yang belum berhasil" + "Coba lagi" (ab.js:37-42).
- Server: semua 31 rute dipakai terdapat di `server/admin.js:224-312`. Satu rute server tanpa tombol: `keamanan/sesi/cabut-akun` [K].

### 3.8 HALAMAN LAMA UNTUK PENGELOLA (hanya lewat Konsol > Alat lama atau hash `admin-*`)
Kodenya masih hidup dan terhubung; tampilannya penuh istilah teknis dan emoji (dikecualikan dari tes kata terlarang lewat `kamus-ui.js`).
- Obrolan dan rapat lama (`#admin-chat`, `#chat`) sudah dialihkan ke `#pesan` (pesan-view.js); dulu: daftar saluran, DM, rapat; perintah `/goal`, `/rapat`, `/tugas`, `@all`, `/status`; tombol suara per pesan memanggil `tts.speak`. API: `/api/messages`, `/api/dm`, `/api/goals`, `/api/tasks`.
- Konfirmasi (`#admin-approvals`; v.js:1559): daftar keputusan menunggu + riwayat 12 terakhir, `/api/approvals/:id`.
- Rancang Pembantu (`#admin-studio`, `#studio`; studio.js:18): tab "Karyawan", "Skill", "Tool"; penyunting karyawan AI (persona, instruksi, model, effort, tampilan karakter), skill, katalog alat; API `/api/employees`, `/api/skills`, `/api/studio/generate`, `/api/settings`, `/api/notes`, `/api/dm`.
- Pusat Belajar (`#admin-knowledge`, `#knowledge`; knowledge-view.js:12): tab "Per divisi", "Pustaka", "Latih agen", "Dataset"; API `/api/knowledge/*`, `/api/learning`, `/api/training-sets`.
- Penjelajah Web (`#admin-browser`, `#browser`; browser-view.js:8): status browser agen, jeda/lanjut/hentikan, ambil alih (klik gambar, ketik alamat), persetujuan aksi browser, riwayat, bagian "Lanjutan" (izin, divisi, batas, daftar situs). API `GET /api/browser`, `GET /api/browser/frame`, `PATCH /api/browser/config`, `POST /api/browser/:op`, `POST /api/approvals/:id`. Polling 3 detik saat aktif, 8 detik siaga, berhenti saat tab tersembunyi.
- Pekerjaan (papan lama) (`#admin-tasks`; v.js:929): Papan, Daftar, Kalender; saringan; seret kartu untuk ganti status (`PATCH /api/tasks/:id`); `GET /api/calendar`.
- Organisasi (struktur lama) (`#admin-team`; v.js:1452): struktur komando, tambah divisi, manusia, pembantu, rutinitas (`/api/divisions`, `/api/employees`, `/api/routines`).
- Pengaturan teknis (`#admin-settings`; v.js:1633): mesin AI, kunci, model, otonomi, perusahaan, pembelajaran, Google Apps Script, MCP, akun dan Drive, ekspor/impor/reset data (`/api/settings`, `/api/test-key`, `/api/export`, `/api/import`, `/api/reset`, dll).

### 3.9 KOMPONEN YATIM (kode ada, tidak tertaut dari menu mana pun)
- Kartu "Obrolan: Telegram dan Discord" (`sambungan-view.js:12-62`, fungsi `pasangSambungan`) [K]: tidak diimpor oleh berkas lain (pencarian di `public/` dan `server/` hanya menemukan berkasnya sendiri). Tombol: "Hubungkan <layanan>" (`POST /api/saluran/link`), "Salin" kode, "Putuskan" (`POST /api/saluran/unlink`); `GET /api/saluran` tiap 3 detik selama kode berlaku. Rute servernya ada (server/channels/index.js:39-49).
- `DashboardView` (v.js:836-899) [K]: Beranda versi lama (kotak "Apa yang ingin kamu kerjakan?", alur 3 langkah, saran contoh, "Pekerjaan terbaru", "Jejak aktivitas"). Tidak ada di `VIEWS`; komentar v.js:1769 membenarkan Pemandu menggantikannya.
- Tombol `data-cam` yang punya penangan tetapi tidak punya tombol di HTML (v.js:246-262) [K]: `reset`, `top`, `in`, `out`, `floor`, `roof`, `help`, `settings`. Kode mati.

---------------------------------------------------------------------
## 4. KANTOR 3D (`#office`) — hanya antarmuka (v.js:126-835, o3.js)

- Memuat: layar "Memuat kantor 3D…"; bila WebGL gagal: "WebGL tidak tersedia: <pesan>" (v.js:131, 158).
- Pembuka sinematik: tiap halaman dimuat sekali per muatan, setelah karakter pemilik ada, kamera memutar lalu masuk mode Jalan otomatis; tombol apa pun melewatinya; `?nointro` mematikan (v.js:166-175). Selama pembuka semua HUD disembunyikan (v.js:261).
- Hanya bagian lapisan kaca (`.office-ov`) yang dibuat v.js:178-232.

### 4.1 Pojok kiri atas
- Merek "RAIVERSE AGENT" + "Kantor <nama perusahaan>" (v.js:180).
- "Kembali ke Beranda" (v.js:181; `data-cam="home"`).
- "Karakter saya" (`#osim`, avatar + nama + jabatan) membuka jendela pemilih karakter (v.js:182, 818).
  - Pemilih: jenis kelamin, gaya rambut, pakaian, warna kulit/rambut/baju/celana, kacamata; pratinjau langsung di 3D; "Simpan karakter" = `PATCH /api/employees/:id {appearance}`.
- KPI: "N orang sedang bekerja"; bila ada, tombol "N menunggu jawabanmu" ke Hasil Saya (v.js:306-309).
- Jam kantor (v.js:185-190): tombol jam membuka geser jam 0-24 + "Pagi, Siang, Sore, Malam, Otomatis". Tombol T mengunci/menjalankan jam.
- "Ruangan" (lipat): daftar divisi dengan jumlah orang per ruang + "Koridor"; klik = kamera ke ruang itu (v.js:274-290). Disembunyikan bila tinggi layar kurang dari 820 px (glass.css:220).

### 4.2 Pojok kanan atas (toolbar)
- Tiga tombol (v.js:193-197): "JALAN"/"KELUAR" (mode jalan-jalan), "Layar penuh", "Tampilan dan bantuan" (menu titik tiga).
- Isi menu titik tiga, tepat 8 (v.js:198-207):
  1. Nama di atas kepala (nyala/mati label)
  2. Gambar dan suasana (panel visual)
  3. Suara dan tombol (membuka panel Pengaturan, tab pertama; lihat 6.c)
  4. Buka layar di kantor (menu 5 aplikasi)
  5. Karakter saya
  6. Keadaan tim (membuka/menutup HUD)
  7. Petunjuk tombol (menyalakan strip petunjuk jalan-jalan)
  8. Pindah cepat (menu tujuan, tombol V)
- HUD (`#ohud`): "RAIVERSE AGENT" + satu kalimat status ("Tim sedang dijeda.", "N orang sedang bekerja, M hal menunggu jawabanmu.", dst.) (v.js:304-312). Untuk pengelola platform ditambah "Rincian teknis" (model, token, CPU/memori PC, disk) (v.js:112-124).

### 4.3 Panel Pengaturan Kantor (tombol H atau ?, atau item "Suara dan tombol") — v.js:715-798
Lima tab:
- Navigasi: daftar pintasan dasar dan lanjutan (geser, tengok, orbit, naik/turun, zoom, waktu, favorit, tampilan 8/5/4/6/2/0, label).
- Mode Karakter: W A S D jalan, Shift lari, Q R putar, Spasi lompat, G lambai, E panggil dan bicara, F beri pekerjaan, Esc keluar.
- Atur Tombol: tiap aksi punya tombol yang bisa diganti (klik lalu tekan tombol; bentrok = saling tukar), "Balik arah tengok", "Kembalikan semua ke standar". Disimpan di peramban (`office-keys-v2`) dan di server lewat `PATCH /api/settings {uiKeys}` (v.js:138).
- Grafis: Otomatis / Hemat / Tinggi, gaya warna film, bingkai layar lebar, fokus lensa, lebar pandangan, hitungan fps.
- Suara: saklar "Semua suara", "Musik latar", "Efek suara", Volume; bagian "Suara orang di kantor": Suara bicara, Mesin suara (Browser atau Microsoft lewat `/api/tts`), Volume suara bicara, "Bacakan percakapan", "Suaraku ikut dibacakan", kamus ucapan, "Uji suara".
- Panel "Gambar dan suasana" (v.js:667-714): preset (9 bawaan + buatan sendiri disimpan di peramban `office-presets`), tab Utama/Gambar/Atmosfer berisi penggeser kamera, koreksi, kabut, awan, bintang; "Simpan", "Reset tab ini".

### 4.4 Dock percakapan (kiri bawah; di HP melebar penuh) — v.js:227, 339-475
- Kepala "Asisten": chip tujuan (nama asisten, atau orang yang diajak, atau nama percakapan pekerjaan dengan tanda x), "Ajak orang" (pencarian orang, maks 8), "Menunggu kamu <angka>", tombol mode, kecilkan/besarkan (▾), info "Cara memakai".
- Mode (v.js:431-432): "Pilihkan" (asisten memilih sendiri), "Ngobrol" (semua pesan hanya obrolan), "Kerjakan" (semua pesan jadi pekerjaan); berputar tiap klik.
- "Menunggu kamu" (v.js:405-418): daftar persetujuan ("Perlu dicek" atau "Boleh?"), kendala ("Ada kendala"), lewat tenggat. Tombol: "Pakai ini"/"Boleh" (`POST /api/approvals/:id`), "Ubah sedikit"/"Jangan dulu" (jendela, umpan balik), "Lihat hasil", "Coba lagi" (`PATCH /api/tasks/:id`), "Percakapan".
- Pesan: 12 terakhir di utas, gelembung dengan avatar, Markdown, gambar terlampir.
- Baris "Sedang bekerja": chip orang sibuk (klik = kamera mengikuti); bila ada rapat yang menunggu pemilik: bilah "Rapat berlangsung" + "Tutup rapat" (`POST /api/orchestrate {text:'tutup rapat'}`) (v.js:445-452).
- Kolom tulis "Tanya atau beri pekerjaan… (@nama untuk mengajak orang)" (maks 2000), lampirkan gambar (maks 3, dikecilkan ke 1600 px, tempel Ctrl+V juga bisa), "Kirim" (`POST /api/orchestrate`). Awal dock membuka DM dengan asisten lewat `POST /api/dm` (v.js:362).
- Gagal kirim: teks dan gambar dikembalikan ke kotak (v.js:395-400).
- Enter saat jalan-jalan melepas mouse dan memfokuskan kotak tulis (v.js:354).
- Penanda masalah: tiap 25 detik, hingga 6 orang yang tersendat atau lewat tenggat diberi simbol di atas kepala selama 8 detik (v.js:357).

### 4.5 Panel kabar (kanan bawah, `.ov-br`)
- Tab "Percakapan" (40 pesan AI terakhir; klik = Hasil Saya) dan "Kabar" (40 peristiwa terakhir; klik = buka orang/pekerjaan) + lencana jumlah + tombol lipat. Awalnya terlipat (v.js:236-247, 313-336).
- Kosong: "Belum ada percakapan..." / "Belum ada kabar. Beri pekerjaan pertama lewat percakapan di bawah."

### 4.6 Elemen yang muncul sewaktu-waktu
- Kartu ikut (`#ofollow`): nama, status, pekerjaan sekarang, suasana hati, percaya diri, kapasitas, tombol "Profil", "Bicara", "Beri pekerjaan", berhenti (Esc) (v.js:536-557).
- Menu lingkar (pie) mengikuti orang yang diklik: "Bicara", "Beri pekerjaan", "Profil", "Sapa", "Lainnya" (v.js:558-580).
- Menu klik di 3D (o3.js:2667-2730): pada orang: Sapa, High-five, Tanya kabar, Ajak ngobrol rekan, 6 ekspresi, Ikuti dengan kamera, Detail & pekerjaan, Bicara, Beri tugas; pada komputer dan kursi: nyalakan/matikan layar, panggil ke meja, tarik kursi, lihat pekerjaan, beri tugas.
- Kartu bicara (`#ptalk`): obrolan singkat satu orang, "Beri pekerjaan", tutup; `POST /api/dm`, `POST /api/messages` (v.js:497-535).
- Petunjuk jalan-jalan (`#phint`): nama orang atau tempat dekat + "E bicara, F beri pekerjaan" atau "E gunakan" (v.js:477-486). Aksi E di tempat: divisi (kartu orang/divisi), Catatan perusahaan (jendela Catatan dengan graf), layar aplikasi, Aula Rapat (jendela rapat), whiteboard rapat (ke Hasil Saya), kopi, lounge (v.js:487-496).
- Pita "Kamu berada di <zona>" (lower third) 4,5 detik (v.js:658).
- Pita "Pindah cepat" saat orang berpindah (v.js:648).
- Kartu jam kecil (`#ochip`): konfirmasi tombol, 1,6 detik.
- Hologram di 3D: klik membuka bantuan, tips waktu, atau jendela Beranda (v.js:150).
- Di HP saat jalan-jalan: joystick "geser" + tombol E (bicara), lambai, keluar (v.js:225-226, 193).

### 4.7 Jendela aplikasi di dalam 3D (v.js:581-621)
- Menu "Buka layar di kantor": 5 aplikasi (Beranda, Hasil Saya, Catatan, Tim Saya, Pengaturan).
- Tiap jendela: judul, "Perbesar" (maksimal), "Tutup"; bisa digeser lewat judul dan diubah ukuran; di HP selalu penuh layar (app.css:966). Memuat halaman asli (mount sama) sehingga semua tombolnya aktif. Esc menutup jendela teratas. Berpindah halaman dari dalam jendela membuka jendela lain.
- Saat jendela terbuka, mouse 3D dilepas (`setBlocking`).

### 4.8 Menu Pindah cepat (V atau menu titik tiga) — v.js:622-647
- Kartu dengan kolom "Cari tempat atau orang…"; kelompok "Plaza", "Sky Deck", "Ruangan", "Agen" (orang yang sedang bekerja 8 teratas bila tanpa ketikan); Enter = hasil pertama; Esc menutup.

### 4.9 Tombol keyboard penting (o3.js:2516-2524, 2902-2915)
- Kamera bebas: W A S D geser, Z/C tengok, Q/E naik-turun, Spasi mode jalan/terbang, P main sebagai karakter, Tab orang berikutnya, U/I jam mundur/maju, T siang-malam otomatis, L label, H bantuan, B simpan tampilan favorit, PgUp/PgDn favorit, angka 8/5/4/6/2/0 tampilan.
- Mode jalan-jalan: W A S D, Shift lari, Q R putar, Spasi lompat, G lambai, E bicara, F beri pekerjaan, V pindah cepat, M suara, Enter ke kotak tulis, Esc keluar.
- Strip petunjuk kamera di bawah (`.cmdbar-hint`) hanya di lebar 1100 px ke atas (app.css:758).

---------------------------------------------------------------------
## 5. SUARA DAN NOTIFIKASI

### 5.1 Suara bicara agen (`tts.js`, jalan di semua halaman setelah views.js dimuat; v.js:24-25) [K]
- Pemicu: pemantau tiap beberapa detik membaca `S.data.messages` dan `channels` lalu membacakan pesan baru dari agen di percakapan yang diikuti pemilik (tts.js:340-354). Hanya bila `on` dan `autoRead` (tts.js:344).
- Bawaan: `on:false` (tts.js:211). Dinyalakan di Pengaturan > Tampilan > "Suara asisten" (s.js:18, 28-29) atau panel Kantor > Suara.
- Mesin: Browser (suara bawaan perangkat) atau Microsoft (`POST /api/tts`, `GET /api/tts/status`, tts.js:371, 425); gagal = jatuh ke suara browser.
- Kantor: kartu bicara (`#ptalk`) memanggil `office.speak` untuk balasan baru (v.js:517).
- Obrolan lama (admin-chat): tombol bicara per pesan (v.js:1293).
- TIDAK dibacakan: balasan Pemandu di Beranda (p.js tidak memanggil tts).

### 5.2 Efek dan musik (`sfx.js`) [K]
- Dibuat di peramban tanpa berkas audio. Bawaan: semua nyala, volume 0,7 (sfx.js:5). Disimpan di `office-audio`.
- Efek dipicu dari kejadian di dunia 3D: tugas, pesan, selesai, minta izin, disetujui, peringatan, rapat, perekrutan, pindah cepat, duduk, lompat (o3.js:2339-2362 dan lainnya). Tombol M menyalakan/mematikan semuanya.
- Dugaan [D]: pendengar kejadian (`onEvent`) tetap terpasang setelah Kantor 3D pernah dibuka, jadi efek mungkin tetap berbunyi di halaman lain; belum dicek.

### 5.3 Toast dan pemberitahuan
- Toast: `toast(teks, jenis, aksi)` di pojok `#toasts`; jenis `ok`, `warn`, `bad`, kosong; tampil 4,5 detik (galat 7 detik); maksimal 4 sekaligus; klik menjalankan aksi lalu menutup (c.js:135-146). Galat memakai `role="alert"`.
- Toast otomatis dari kejadian server (a.js:170-176):
  - Persetujuan diminta: "<nama> butuh jawabanmu: <judul>" → Hasil Saya.
  - Rapat selesai: "Rapat selesai: ..." → Hasil Saya.
  - Peringatan: "Ada yang perlu dilihat: ..." → Hasil Saya (kartu terkait).
  - Pekerjaan induk selesai: "Selesai: ..." → kartu di Hasil Saya.
  - Pekerjaan baru untukmu dari orang lain: "Ada pekerjaan baru untukmu: ..." → Hasil Saya.
- Galat dari `api()` selalu diubah menjadi kalimat ramah (awam.js `ramah`, c.js:22-31).
- Lencana angka di menu Hasil Saya (a.js:22). Tidak ada notifikasi sistem peramban, tidak ada layanan pekerja (service worker), tidak ada manifest PWA (pencarian di `public/` kosong) [K].

---------------------------------------------------------------------
## 6. TEMUAN

### 6.a Halaman atau komponen yatim
1. `sambungan-view.js:12` `pasangSambungan` tidak diimpor di mana pun [K]. Telegram/Discord tidak bisa disambungkan dari layar manapun, padahal `/api/saluran/*` sudah ada di server (server/channels/index.js:39-58) dan Pengaturan mengaku "empat hal" (s.js:14).
2. `v.js:836` `DashboardView` (Beranda lama) tidak di `VIEWS`; kode mati [K]. Termasuk `#hfind` yang membuka palet (satu-satunya tombol Cari di desktop, dan ikut mati).
3. Delapan cabang `data-cam` tanpa tombol (`reset, top, in, out, floor, roof, help, settings`; v.js:246-262) [K].
4. Rute server tanpa tombol di depan [K]: `POST /api/me/delete`, `GET /api/me/export`, `POST /api/me/sessions/revoke` (hak data pribadi pengguna), `GET /api/ws/invites`, `POST /api/ws/invite/revoke`, `POST /api/ws/member-perms`, `/api/automations/*`, `POST /api/staff/:key/run`, `/api/belajar/*` (selain hapus profil), `keamanan/sesi/cabut-akun`. Akibat: undangan tidak bisa dicabut dari layar; pengguna tidak bisa mengekspor atau menghapus data sendiri dari Pengaturan.
5. `localStorage navCollapsed` ditulis tetapi tidak pernah dibaca (a.js:30, 51) [K].
6. `public/rig-test.html` adalah halaman uji yang tidak tertaut dari mana pun; isinya tidak dibaca. Bila server menyajikan `public/` apa adanya, alamat `/rig-test.html` terbuka untuk siapa saja [D].
7. Catatan sampingan: ada berkas `docs/client_secret_...apps.googleusercontent.com.json` di folder docs. `git ls-files` tidak mencantumkannya (tidak terlacak), tetapi pastikan masuk `.gitignore` dan tidak ikut terkirim ke server publik [D].

### 6.b Tombol yang memanggil rute yang tidak ada di server
- Hasil pencocokan skrip: 0 rute hilang (74 pasangan metode+alamat non-konsol + 32 konsol) [K].
- Tiga alamat disusun dengan string yang tidak bisa dicocokkan otomatis: `/api/drive/${setup|push|pull}` (s.js:85, v.js:1611) dan awalan `/api/admin/` (ab.js:11). Ketiganya ada di server (index.js:436-438, admin.js:224-312) [K].
- Peringatan sisi server (bukan rute hilang) [K]: `PATCH /api/settings` memakai `ownerOnly` (server/index.js:325). Tombol "Jeda atau lanjutkan kerja tim" (a.js:50) dan simpanan `uiKeys` Kantor (v.js:138) tampil untuk semua anggota; anggota biasa akan menerima galat 403 (toast "Bagian ini hanya bisa dibuka oleh pemilik ruang kerja."). Perilaku persisnya per peran [D], belum diuji dengan akun anggota.

### 6.c Teks berjargon atau ganda
- Merek "RAIVERSE AGENT" memakai kata "AGENT" yang ada di daftar kata terlarang (kamus-ui.js:5): judul tab (index.html:6), logo sidebar (a.js:38), HUD Kantor (v.js:180, 304).
- Menu Pindah cepat: nama kelompok "Agen" untuk orang (v.js:623, o3.js:2756), "Sky Deck", "Plaza" (v.js:626) [K].
- Catatan: "Backlinks" (v.js:1442), "klik node untuk membuka" (v.js:1392), "(belum ada)" (v.js:1447), nama folder mentah berbahasa Inggris (Company, SOP, Deliverables, Reports, Notes, Knowledge, Playbooks, Meetings, Memori) di pohon dan di pilihan folder (v.js:1332, 1340-1345), isian awal folder "Knowledge", "Per divisi", "Pustaka dan lainnya", teks kaki "disusun otomatis per Divisi/Jenis" (v.js:1357) [K].
- Jendela rapat di Aula Rapat (v.js:67-94): "Adakan rapat multi-agen", "Agenda / pertanyaan kunci", "Putaran diskusi", "Pemimpin rapat", "Saya mengawali rapat", "154 panggilan AI", "action item", emoji di judul dan toast. Dapat dicapai pengguna biasa dengan jalan-jalan ke Aula Rapat lalu E (v.js:493) walau berada di area "pengelola" [K].
- Mode jalan: tombol "JALAN"/"KELUAR" tetapi label aksesibilitas "Masuk mode Play" dan "Keluar dari mode Play" (v.js:490-ish, 481-483, playerUI); panel "Mode Karakter" dan "Mode karakter (PLAY)" (v.js:734) [K]. Tiga nama untuk satu hal: Jalan-jalan, Mode Karakter, Play.
- Panel Kantor memakai istilah "Pengaturan" (judul panel, v.js:719) yang BEDA dari halaman Pengaturan; item menu "Suara dan tombol" membuka panel itu (bukan halaman) dan jatuh ke tab "Navigasi", bukan "Suara" (v.js:250, 715-724) [K].
- Istilah teknis di Grafis dan bantuan: "fps", "draw", "segitiga" (v.js:~793), "Orbit", "pan", "bloom", "Saturasi", "cirrus", "Bujur/Lintang" (v.js:672-700), "preset" [K].
- "Karakter saya" ada di dua tempat dengan fungsi sama: kotak di kiri atas dan item menu (v.js:182, 204) [K].
- Judul tak seragam: "Hasil Saya" vs "Hasil saya", "Tim Saya" vs "Tim saya" (menu vs kepala halaman; h.js:91, t.js:36) [K].
- Mode dock "Pilihkan / Ngobrol / Kerjakan" artinya tidak jelas dari kata saja (v.js:431); penjelasan hanya di tooltip.
- Toast di 3D masih memakai emoji (🔊, 🔇, 🖱) (o3.js:2902, 2934) [K].
- Hash admin untuk bukan pengelola: pesan "hanya untuk pemilik ruang kerja" (a.js:84), padahal aturannya "pengelola platform" (awam.js `bisaKelola`); pemilik ruang kerja biasa akan membaca pesan yang menyesatkan [K].
- Mengandung dua tempat untuk hal yang sama: "Mulai pekerjaan" di Hasil Saya dan Beranda, Cari di palet vs kolom cari per halaman: wajar, bukan cacat.

### 6.d Beda layar HP dan desktop
- Bilah atas: ada di HP saja (glass.css:271, 286). Konsekuensi di desktop: tidak ada tombol Cari (hanya Ctrl+K) dan tidak ada penanda "Terputus" (a.js:59-66) [K].
- Jeda/lanjut kerja tim dan keterangan "Jatah": hanya di sidebar, jadi hilang di HP (a.js:50; app.css:262). "Jatah" masih tampil di kaki Beranda [K].
- Menu "Lainnya": desktop = daftar lipat di sidebar berisi 2 item; HP = jendela "Menu" berisi 6 item (a.js:53, 68-74) [K].
- Kantor 3D di HP: dock penuh lebar dan tidak menggeser gambar (hanya >900 px, v.js:473); strip petunjuk jalan dan petunjuk kamera disembunyikan (app.css:415, 758); joystick sentuh + tombol E/lambai/keluar muncul bila layar sentuh (v.js:225); tanpa bayangan dan tanpa kunci mouse (o3.js:26, 39, 2809); jendela aplikasi selalu penuh layar (app.css:966); daftar Ruangan disembunyikan bila tinggi < 820 px; kartu Pindah cepat pindah ke atas (glass.css:246) [K].
- Catatan di HP: tiga kolom jadi satu, daftar dan tautan dibuka dengan tombol "Daftar catatan" (☰) dan tombol tautan (glass.css:320) [K].
- Tim, Hasil, Pengaturan: tata letak menyesuaikan lebar; tidak ada logika terpisah [D].
- Pintasan keyboard (Ctrl+K, Esc, semua tombol Kantor) tidak ada padanan sentuh kecuali joystick [K].
