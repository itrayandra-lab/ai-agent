# Tabel periksa P5 (antarmuka Kantor 3D dan kerangka)

Status: **sudah** / **sebagian** / **belum**. Bukti = berkas atau tes.

| # | Item | Status | Bukti / catatan |
|---|---|---|---|
| 1 | Panel Kantor 3D nol tumpang tindih, 5 ukuran layar | sudah | `test/ui-tata-letak.test.js`, `scripts/uji-tata-letak-kantor.mjs`, `public/css/office-layout.css` |
| 2 | Ruangan: nama Indonesia, dikelompokkan, bisa dicari | sudah | `public/js/nama-ruang.js`, `renderRooms` di `views.js` |
| 3 | Panel chat kaca di KIRI | sudah | `office-layout.css` (v4) |
| 4 | Karakter dibingkai di kanan saat ngobrol (satu orang) | sebagian | `setInset` + `startChase` di `dockRender`; belum diuji dengan model asli |
| 5 | Rapat multi-agen: 2–4 peserta di kanan, sorot pembicara | belum | butuh fungsi kamera kelompok; tidak ditulis ulang |
| 6 | Huruf compact 14 px, kontrol 36 px | sebagian | Kantor 3D, halaman, modal sudah (`glass-global.css`); konsol admin hanya tab dan kartu |
| 7 | Enter / "/" fokus chat di mode karakter, Esc menutup | sudah (kode) | tes statis di `ui-tata-letak.test.js`; belum diuji di Play sungguhan |
| 8 | Satu permukaan chat, panel DM kanan dihapus | sudah | `talkTo`, `#ptalk` dihapus |
| 9 | Tooltip karakter tidak menimpa dock | sudah | `.phint` di wilayah atas |
| 10 | Bilah navigasi vertikal mengambang + pil di HP | sudah | `float-nav.css` |
| 11 | Gaya kaca semua halaman | sebagian | `glass-global.css`; konsol admin dan modal diterapkan lewat gaya umum, belum diperiksa satu per satu |
| 12 | HUD kaca di Kantor 3D (kabar, status empat kata, jatah) | sudah | `#oinfobar` |
| 13 | Halaman pendukung sebagai panel melayang di atas Kantor | sudah (desktop) | `bukaPanel` di `app.js`; HP layar penuh |
| 14 | Beranda jadi "Obrolan" | sudah | `VIEWS.dashboard.title`, tes ui-awam |
| 15 | Hasil Saya tanpa ** mentah | sudah | `bersih()` di `hasil-view.js` |
| 16 | Hasil Saya: panel detail samping | belum | hasil terbuka di dalam kartu |
| 17 | Tim Saya kisi kartu kompak | sudah | tangkapan `kaca-team-1440x900-dark.png` |
| 18 | Pengaturan: menu samping + kartu kecil | sudah | tangkapan `kaca-settings-1440x900-light.png` |
| 19 | Catatan tiga kolom ringkas | sebagian | CSS saja; belum dilihat di tangkapan |
| 20 | Konsol admin: tab ringkas | sebagian | CSS saja; belum dilihat di tangkapan |
| 21 | Kartu Telegram/Discord hidup | sudah | `pasangSambungan` di Pengaturan |
| 22 | Izin tiga kata | sudah | `dockIzin`, `server/approvals.js`, `test/izin-tiga-kata.test.js` |
| 23 | Status empat kata + lonceng aktivitas | sudah | `#ibteam`, lonceng Kabar |
| 24 | Pencarian dan percakapan baru | sebagian | di dock (Riwayat dengan cari, Baru); Beranda/Obrolan milik sesi Chat Engine |
| 25 | Bacakan | sebagian | tombol di balasan dock (`tts.speak`); balasan Pemandu belum (milik sesi Chat Engine) |
| 26 | Pratinjau konfirmasi isi persis | belum | logika Pemandu, bukan bagian tampilan ini |
| 27 | Terjadwal / "Ulangi tiap" | belum | tidak sempat |
| 28 | Unduh / hapus data pribadi | sudah | `dataPribadi` di Pengaturan, rute `/api/me/*` |
| 29 | Bersih jargon (rapat multi-agen, 154 panggilan, Backlinks, node, Mode Play) | sudah | `views.js`; org chart pengelola (master orchestrator) tidak diubah |
| 30 | Pesan 403 gerbang benar | sudah | `core.js` + tes statis |
| 31 | "@" memilih orang, kepingan peserta | sudah | `dockPick`, input "@" |
| 32 | Tab Kantor 3D / Obrolan tidak pudar | sudah | `.ov-tabs` solid |
| 33 | Tangkapan layar sebelum/sesudah | sudah | `docs/visual-review/p5/sebelum`, `sesudah` |
| 34 | Rel ikon + panel kedua berkelompok, menu akun | belum | struktur navigasi hanya diubah gayanya |
| 35 | "Mulai cepat" kecil, tab di Obrolan | belum | Obrolan milik sesi Chat Engine |

## Logika final (v5): Kantor 3D = ruang kerja utama
| # | Item | Status | Bukti / catatan |
|---|---|---|---|
| 36 | 3D penuh sampai tepi kiri, nav kaca mengambang di atasnya, tanpa kolom latar | sudah | `float-nav.css` v5; `v5-*.png` |
| 37 | Item "Kantor 3D" dihapus dari nav (desktop); tab "Kantor 3D \| Obrolan" dihapus | sudah | `app.js` (`CORE.filter`), tes `ui-awam`; di HP bilah bawah masih memuat "Kantor" |
| 38 | Obrolan = panel kiri (kolom ketik dibesarkan, riwayat, baru, cari) | sudah | `setLeft('dashboard')`; isi percakapan milik sesi Chat Engine |
| 39 | Halaman lain (Hasil, Catatan, Tim, Pengaturan) tampil di panel kiri yang sama, tombol tutup, Esc | sudah (desktop) | `OfficeView.setLeft`, tes tumpang tindih state halaman-hasil/pengaturan |
| 40 | Kamera bergeser ke kanan saat panel kiri terbuka, kembali halus saat ditutup | sebagian | `syncInset` memakai `setInset` yang ada; terlihat di tangkapan (kantor bergeser), belum diuji dengan karakter yang dibingkai |
| 41 | HUD (status, ruangan, jam) di kanan atas; bilah kabar/siap/jatah di kanan bawah | sudah | `office-layout.css` v5 |
| 42 | HP: panel kiri jadi lembar; nav pil bawah | sebagian | dock jadi lembar; halaman di HP tetap layar penuh terpisah (lebih ringan), belum jadi lembar di atas 3D |
| 43 | Kualitas 3D rendah otomatis di HP, lazy-load | sudah (bawaan) | `isMobile` di office3d.js, impor dinamis; tidak diubah |
| 44 | Tampilan bersih (sembunyikan HUD dan nav, sisakan tombol Menu) | sudah (kode) | menu Tampilan, `body.mode-bersih`; belum diuji di browser |
| 45 | URL langsung `#tasks` dll membuka Kantor 3D dengan panel kiri; `#admin` layar penuh | sudah | `route()` di `app.js`; tangkapan `v5-settings-*.png` dari hash langsung |
| 46 | Tes tumpang tindih disesuaikan (state halaman-hasil, halaman-pengaturan, obrolan-penuh, nav diukur) | sudah | `scripts/uji-tata-letak-kantor.mjs` |
