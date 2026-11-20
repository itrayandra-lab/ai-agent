# Penilaian ulang 47 temuan (T-01..T-47) terhadap kode commit a24bf9c

Metode: baca dan grep kode saat ini (server/, public/js, public/css, public/index.html). Tidak ada server dijalankan. Nomor baris berlaku untuk keadaan sekarang. Pemeriksaan sebagian temuan hanya sampling; yang butuh mata ditandai TAK TERVERIFIKASI.

| ID | Status | Bukti (file:baris) | Catatan |
|---|---|---|---|
| T-01 | NYATA | public/js/views.js:229,241,252 (`#odock`, `#odwho` masih ada) | Dock lama masih ada bersama Obrolan dan Pesan. |
| T-02 | NYATA | public/js/views.js:1927 (LEGACY chat->pesan); pesan-view.js:207 (hanya `S.params.kontak`); studio.js:234, views.js:1420,1448 | `ch` tetap diabaikan. |
| T-03 | NYATA | public/js/views.js:253,261 (`tutupSembunyi` hanya `el.hidden=true`) vs views.js:913 | Pengatur panel tidak memanggil `teleportClose`, `setBlocking(false)` terlewat. |
| T-04 | NYATA | public/js/views.js:883-886 (`closeApp` tanpa `relock`) | Hanya `setBlocking(false)`. |
| T-05 | NYATA | public/js/app.js:30,55-56 (6 inti + Lainnya = 7 tombol); float-nav.css:43 (`repeat(6)`), identity.css:180 (`repeat(5)`) | 7 tombol di grid 5 atau 6 kolom. |
| T-06 | NYATA | public/js/core.js:73-75 (tanpa `r.ok`) | Hanya 401/403 yang ditangani. |
| T-07 | NYATA | server/chat-engine.js:386-400 (`stafJalan` tak membaca `canAutomate`; `canAutomate` hanya diteruskan di :612) | Tombol `staf:ya` jalan tanpa cek peran. |
| T-08 | NYATA | public/js/pengaturan-view.js:16 ("Cukup empat hal"), bagian :18-30 ada 7 | |
| T-09 | NYATA | sambungan-view.js:20 ("WhatsApp belum tersedia") vs pengaturan-view.js:113 ("cukup minta aray") | Teks "Sora" sudah jadi "aray", kontradiksi tetap. |
| T-10 | NYATA | pengaturan-view.js:27 (sChat) vs :30,112-113 (sSamb: Google, WhatsApp) | |
| T-11 | NYATA | views.js:1522 (`#borg` langsung POST, tanpa konfirmasi); :1563 (Hapus catatan langsung DELETE) | Tanpa urung dan tanpa jumlah. |
| T-12 | NYATA | server/admin/admin.js:294 ada; public/js tidak punya `cabut-akun` (admin-bagian.js:126 hanya `sesi/cabut`) | Rute yatim. |
| T-13 | NYATA | server/keamanan/limits.js:119-123 (`routeKind` tak memuat `/api/chat/*`; orchestrate = task) | Angka kuota berubah (task 150, n8n 60) tetapi ketidakseragaman tetap. |
| T-14 | SEBAGIAN | chat-sources.js:77 (`REVISE_RE` memuat `buat(kan)`); chat-engine.js:438,445-449 | Revisi-salah-tangkap masih; ketikan non-start kini dilempar ke `pemandu.innerTurn` (perilaku stage work/result tak diuji). |
| T-15 | NYATA | chat-engine.js:435 (id tak dikenal -> `innerTurn`); pemandu.js:535-536,640 (`say:N`) | Hanya `ces:N` (chat-engine.js:98) lewat router dan tercatat. |
| T-16 | TAK TERVERIFIKASI | chat-staf.js:82 (teks "butuh izinmu" tanpa tombol) | Bagian izin `approve` dan perbandingan penyetuju tak ditelusuri. |
| T-17 | SEBAGIAN | views.js:739 (Tutup rapat masih via dock lewat `/api/orchestrate`); chat-engine.js:161 (2 target = rapat singkat) | Rapat live tetap di luar Mesin Chat. |
| T-18 | SEBAGIAN | server/staff-catalog/exec/_divisi.json:7 (nama "Aria"); label "aray" di pesan UI | Penamaan ganda masih; tak ditelusuri menyeluruh. |
| T-19 | TAK TERVERIFIKASI | pemandu.js:305,417 | Batas 40 sesi dan perlindungan work/result tak ditemukan lewat grep. |
| T-20 | NYATA | pengaturan-view.js:23 ("Suara asisten", bawaan Mati); obrolan-view.js:194 (hanya auto-announce, tak ada tombol Bacakan) | |
| T-21 | NYATA | obrolan-view.js tidak punya lampir/attach (grep kosong) | |
| T-22 | NYATA | views.js:395 (selektor `.ob-chip`); chip asli `.ob-keping` (obrolan-view.js:163) | `#odwho` tetap "Sora · otomatis". |
| T-23 | NYATA | office3d.js:30-31,835 ("Conference Hall", "Library", "Sky Deck"); pesan-view.js:35 (`SEBUTAN_LAMA`); views.js:645,649 | |
| T-24 | NYATA | app.js:29 (komentar "empat layar", CORE berisi 6); views.js:1909 (dashboard = "Obrolan", ikon dashboard); index.html:7 vs office3d.js:2875 | Merek ganda dan GOLD tak punya `pesan` (icons.js:70). |
| T-25 | SEBAGIAN | pesan.css:56 (`.ob-bar`, `#pmUntuk` disembunyikan di kontak) vs obrolan-view.js:165 (`+ Tambah` tetap dirender di `#obPeserta`) | Izin tersembunyi; tampil "+ Tambah" perlu dilihat di layar. |
| T-26 | NYATA | app.js:66 (pill "Terputus" di topbar) | Topbar disembunyikan di desktop (CSS tak dilacak). |
| T-27 | NYATA | app.js:48,52 (`#modepill` title statis) | |
| T-28 | SEBAGIAN | SUDAH: views.js:18 (`mode-kursor.js` kini diimpor). MASIH: app.js:53 (`navCollapsed` hanya ditulis), views.js:801 (`renderTalk` kosong) | `appsMenu` (views.js:848,303) ada pemicunya lewat `data-cam`. |
| T-29 | SEBAGIAN | views.js:254 (`maks: () => 1`); mode-kursor.js:10-17 | Teks petunjuk "Tab: kursor bebas" tak ditemukan lagi (kemungkinan sudah diganti `petunjukSatuBaris`); sisanya tak diuji. |
| T-30 | SEBAGIAN | views.js:361 (kini ada listener `resize`); breakpoint 820/900 masih berbeda (views.js:321,360 vs boot-awal.js, app.css) | Re-routing struktur tak diperiksa. |
| T-31 | NYATA | views.js:207,296 ("Suara dan tombol" memanggil `OfficeView.help()`, bukan tab Suara) | |
| T-32 | SEBAGIAN | sambungan-view.js:29 (Putuskan tanpa konfirmasi); pengaturan-view.js:17,29 (nama tautan vs judul) | Hapus akun punya modal (pengaturan-view.js:65). |
| T-33 | NYATA | karakter-view.js:23,25 ("Wajah", "Warna aksen"); tak ada tautan ke editor di pengaturan/tim | |
| T-34 | SEBAGIAN | hasil-view.js:77,80 ("Ubah sedikit", mode pilih hanya tugas) | Perilaku muat gagal diam tak diperiksa. |
| T-35 | NYATA | views.js:1496,1499 (Playbooks, Deliverables, Notes, Knowledge tampil mentah) | |
| T-36 | TAK TERVERIFIKASI | tim-view.js (tak ada penanganan manusia di grep) | Perlu dibaca penuh. |
| T-37 | NYATA | admin-view.js:63 ("Kesehatan otak"); admin-bagian.js:74,80 ("Nonaktifkan staf n8n") | |
| T-38 | NYATA | pesan-view.js:194-195 (`window.prompt`, `window.confirm`); :63 ("Buat grup baru" vs label) | |
| T-39 | TAK TERVERIFIKASI | views.js:162 (galat 3D memuat tangani sendiri) | Perlu uji WebGL gagal dan HP. |
| T-40 | NYATA | app.js:86, awam.js:24, pemandu.js:706 ("pemilik ruang kerja") | awam.js:71 sendiri mengakui syaratnya pengelola platform. |
| T-41 | SEBAGIAN | server/channels/core.js:84-98 (`compose` hanya `notes`, `say`, `preview`, `progress`, `cards`) | Field thread, aksi, dokumen, kutipan memang tak dikirim; `needsWork` tak ditemukan. |
| T-42 | NYATA | docs/CHAT-ENGINE.md:55,64 (`/api/percakapan` untuk Kantor 3D) sementara tak ada pemanggil di public/js | |
| T-43 | SEBAGIAN | office3d.js:219 (`window.__ray3d` terbuka) | `staf:ya` kedaluwarsa dan `resolvePending` (chat-engine.js:234) tak dinilai penuh. |
| T-44 | SEBAGIAN | index.html:2 (`data-theme="light"` tetap di html), :6 (satu `theme-color`), app.js:18; app.js:167-170 (hanya `hashchange`) | Kilatan tema perlu dilihat di layar. |
| T-45 | NYATA | hasil-view.js:93 ("Hasil saya") vs views.js:851 ("Hasil Saya") | |
| T-46 | TAK TERVERIFIKASI | views.js:585 (satu listener `blur`) | Duplikat visual perlu mata. |
| T-47 | TAK TERVERIFIKASI | mode-kursor.js:7-17 (Esc di komposer kembali ke karakter) | Perlu uji di layar. |

## Hitungan per status
- NYATA: 29 (T-01 sampai T-13 kecuali tak ada; T-15, 20, 21, 22, 23, 24, 26, 27, 31, 33, 35, 37, 38, 40, 42, 45)
- SEBAGIAN: 12 (T-14, 17, 18, 25, 28, 29, 30, 32, 34, 41, 43, 44)
- SUDAH BERES (penuh): 0 (hanya potongan: T-28 `mode-kursor.js` kini diimpor; T-30 listener resize ada)
- TAK TERVERIFIKASI: 6 (T-16, 19, 36, 39, 46, 47)
- Total 47.

## NYATA yang kecil, aman, kode saja (<15 baris, bukan geometri/gerak 3D)
- T-03: `pn.daftarkan('pindah', ..., { tutup: () => this.teleportClose() })` di views.js:261.
- T-04: di `closeApp` (views.js:885) panggil `office?.relock?.()` bila mode Play.
- T-06: `if (!r.ok) throw new Error('Gagal memuat')` di core.js setelah baris 74 (sebelum `r.json()`).
- T-07: di `stafJalan` (chat-engine.js:386) tolak bila `!args.canAutomate` dan `confirmed`.
- T-08: ganti subjudul pengaturan-view.js:16.
- T-09 dan T-10: samakan teks WhatsApp (sambungan-view.js:20 vs pengaturan-view.js:113).
- T-22: ganti selektor `.ob-chip` menjadi `.ob-keping .ob-kn` di views.js:395.
- T-40: ganti "pemilik ruang kerja" menjadi "pengelola platform" (app.js:86, awam.js:24, pemandu.js:706).
- T-45: samakan "Hasil saya" menjadi "Hasil Saya" (hasil-view.js:93).
- T-24 (sebagian): perbarui komentar "empat layar" (app.js:29).
- T-31: `data-cam="sound"` buka tab Suara (views.js:296) bila `help()` mendukung parameter tab.
- T-12: hapus rute `cabut-akun` (admin.js:294) atau tambah tombol (lebih besar, opsional).
- T-11 (konfirmasi saja): bungkus `#borg` dan "Hapus catatan" dengan `confirm`/`modal` (views.js:1522,1563).
- T-38 (teks saja): "Pilih kontak di kiri" untuk HP (pesan-view.js:123).
- T-42: perbarui CHAT-ENGINE.md (dokumen).
