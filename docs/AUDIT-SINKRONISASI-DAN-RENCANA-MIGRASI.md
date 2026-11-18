# Audit sinkronisasi dan rencana migrasi

Status: rencana, belum dieksekusi. Ditulis 2026-11-18 oleh orkestrator dari lima audit baca-saja (data/roster, mesin/alat, antarmuka klien, 3D/suara, publik/keamanan). Semua temuan di bawah berasal dari laporan audit dan belum diverifikasi ulang satu per satu; tiap fase harus membuktikannya dengan tes sebelum mengubah apa pun.

## 1. Logika baru yang menjadi acuan

| Kode | Aturan |
|---|---|
| T1 | Hierarki: Owner (tiap ruang kerja punya owner sendiri) → asisten pribadi (PA) dan master orkestrator → manajer divisi (satu per divisi, 22 divisi; orkestrator khusus staf divisinya) → staf (daun). **Satu staf = satu workflow n8n = satu karakter 3D.** |
| T2 | Eksekusi nyata lewat n8n (data, berkas, aksi). Chat hanya antarmuka. |
| T3 | Satu antarmuka untuk semua orang, tanpa mode, sangat sederhana, dipandu pilihan tombol (Pemandu), tanpa jargon. |
| T4 | Dipakai publik: banyak ruang kerja terisolasi, kuota dan biaya per pengguna, keamanan, persetujuan sebagai konfirmasi. |
| T5 | Skill dan memori belajar sendiri, berstatus draf sampai disetujui. |
| T6 | Pemilihan alat otomatis dengan "satu pintu kecil": Brain → `web_search` → `visit_url` → `buka_browser` → staf n8n → koneksi luar. Model kecil tidak dibanjiri tool. |
| T7 | Status karakter 3D = status eksekusi staf, tanpa mengubah geometri. |
| T8 | Suara: gender dari nama, suara beragam dan ringan, satu suara pada satu waktu, giliran bicara natural. |
| T9 | Satu id yang sama di roster, katalog staf, data, dan 3D. |

## 2. Ringkasan temuan menurut keparahan

### Kritis (harus ada sebelum rilis publik, atau merusak logika baru)
1. **Dua mesin bertabrakan (T2, T6).** Staf daun sekarang adalah agen LLM bebas yang memanggil sekitar 32–35 tool sekaligus (29 `CAP_IDS` + otomasi + belajar + browser). Tool `otomatiskan` hanya mengusulkan otomasi dan tidak mengeksekusi pekerjaan. Penanda `leadOnly`/`paOnly` di `server/catalog.js` tidak ditegakkan, jadi staf biasa melihat `recruit_agent`, `create_division`, `convene_meeting`.
2. **Tidak ada konsep staf = workflow (T1, T9).** Data karyawan tidak punya kunci ke katalog, workflow, atau karakter.
3. **Hook n8n lemah (T4).** Hanya satu token di alamat URL, tanpa tanda tangan, cap waktu, atau pelindung ulang. Gerbang LLM bertoken per eksekusi belum ada (diputuskan sesi fondasi).
4. **Pengambilalihan ruang kerja utama (T4).** Di server baru tanpa login, pengguna Google pertama menjadi Owner data utama.
5. **Tanpa kuota dan batas laju (T4).** Tidak ada rate limit HTTP, tidak ada kuota per pengguna, satu akun Google = ruang kerja baru dengan anggaran baru, `/api/tts` tanpa batas, dan `governor.js` tidak mengenal eksekusi n8n.
6. **Rahasia dan penyimpanan (T4).** Kunci AI per ruang kerja disimpan teks biasa di data; satu `db.json` ditulis ulang seluruhnya tiap simpan dan semua ruang kerja dimuat di memori; `otomasi.json` dan `auth.json` tanpa kunci tulis atau tulis atomik.

### Tinggi
7. **Migrasi tidak berlaku untuk ruang kerja lain.** `loadWorkspaces` tidak menjalankan migrasi; ruang kerja baru hanya berisi 6 divisi (bukan 22).
8. **Aturan satu manajer per divisi bisa dilanggar** (`PATCH isLead` dan `hire` tidak menurunkan pemimpin lama; divisi Executive punya dua pemimpin). Peran ditentukan tiga bendera tak eksklusif, bukan satu medan `role`.
9. **Persetujuan tersebar di 4 tempat** (review/kebijakan, otomasi, browser, regex kebijakan) dengan bentuk kartu berbeda.
10. **Antarmuka masih berbicara dalam struktur lama.** Palet perintah, dock Orkestrator 3D, halaman Pengaturan, Tugas, Chat, Tim, Studio, dan Browser penuh jargon (pemindaian kamus: `views.js` 147 dari 1531 string terlarang). Tes kata terlarang hanya menjaga `pemandu-view.js`.
11. **Id adalah akar tampilan dan suara.** Bentuk tubuh, palet, dan suara agen diturunkan dari hash id. Mengganti id mengubah semuanya.
12. **Status di luar lima nilai** (bekerja, rapat, ngobrol, siaga, offline) membuat karakter berkeliaran tanpa tujuan. Status workflow wajib dipetakan ke lima nilai itu.
13. **Asumsi Owner tunggal** masih tersisa (pengiriman kabar, kredensial WhatsApp tunggal, konektor Apps Script, pengirim Drive).
14. **Privasi dan kepatuhan:** tidak ada hapus akun, ekspor data, retensi, atau aturan data anak.

### Sedang
15. 42 agen di data Owner tidak ada di seed (buatan asisten pribadi, mis. desain 22 vs seed 6); akan yatim bila katalog menjadi acuan.
16. Prompt sistem menyebut struktur lama (daftar semua agen, "karyawan AI otonom") dan banner simulasi usang.
17. Skill baru dan templat n8n menduplikasi sebagian alat (dua sumber kebenaran).
18. Status 3D diturunkan dari giliran LLM, bukan dari eksekusi n8n; tidak ada batas jumlah karakter per divisi dan menambah/menghapus satu staf membangun ulang seluruh gedung.
19. Variasi suara: sekitar 50 kombinasi untuk 170 agen, jadi sebagian mirip.
20. Siaran SSE `host` (CPU, versi, sesi) dikirim ke semua pengguna; `mcpServers` URL bebas berisiko SSRF; bila n8n mati, hasil tidak diambil ulang.
21. Konsistensi visual: emoji berwarna/merah masih muncul (🛑 🔴 ⛔ ⚠️), 9 `aria-label` dari 110 tombol, 126 deklarasi huruf 9–13 px, label ganda (Beranda/Dashboard, Konfirmasi/Persetujuan, Obrolan/Chat).

## 3. Prinsip migrasi (mitigasi risiko)

1. **Cadangan dulu, selalu.** Salin `data/db.json` dan `data/ws/*/db.json` ke `*.bak-<versi>-<cap-waktu>` sebelum migrasi apa pun. Skrip migrasi dapat diulang dan hasilnya sama bila dijalankan dua kali.
2. **Bendera fitur.** `settings.staffModel` (default mati) mengontrol percabangan staf = workflow. Perilaku lama tetap berjalan sampai bendera dinyalakan per ruang kerja. Pengguna lama tidak melihat perubahan sampai siap.
3. **Hanya menambah, tidak menghapus.** Migrasi menambah medan (`role`, `staffId`, `workflowId`, `characterId`, `voiceGender`), dan `isLead/isMaster/isPA` tetap ada sebagai turunan `role`. Agen yang tidak ada di katalog ditandai `legacy: true`, bukan dihapus.
4. **Satu fungsi `migrate(db)`** dipakai oleh `load` dan `loadWorkspaces`, sehingga ruang kerja publik ikut termigrasi. Perbaiki `version` seed agar sama dengan migrasi terakhir.
5. **Id agen tidak pernah diganti.** Bentuk, warna, dan suara bergantung padanya.
6. **Satu gerbang untuk hal sensitif:** satu pintu pembuatan tugas (`governor.checkCreate` dengan kuota per ruang kerja), satu modul persetujuan, satu pemetaan status ke lima nilai 3D.
7. **Titik sambung sekecil mungkin:** satu percabangan di awal `runLive` (`server/engine.js`): bila penerima punya `workflowId`, panggil `staff.run(e, t)`, lalu hasil masuk ke `finishTask` yang sama agar bukti, persetujuan, dan Brain tetap jalan. Bentuk keluaran `orchestrate` dan `submitGoal` dipertahankan (dipakai Pemandu dan antarmuka).
8. **Tidak ada fase yang boleh melewati tesnya.** Fase berikut tidak dimulai bila tes fase sebelumnya merah, dan visual lock hanya diperbarui oleh Owner setelah meninjau tampilan.
9. **Titik pemulihan git** sebelum tiap fase besar (commit titik aman, lalu cabang kerja).

## 4. Urutan fase

| Fase | Isi | Bergantung pada | File utama |
|---|---|---|---|
| **P0 Pagar sinkronisasi** | Skrip cadangan; bendera `settings.staffModel`; tes invarian lintas lapisan (bagian 5) yang gagal merah sampai fase terkait selesai; penguatan `regex-guard` | tidak ada | `scripts/`, `test/` |
| **P1 Data dan migrasi** | Medan `role` tunggal, `staffId`/`workflowId`/`characterId`; migrasi untuk semua ruang kerja; satu manajer per divisi (perbaiki `PATCH isLead`/`hire`); ruang kerja baru berisi 22 divisi; tandai 42 agen lama; `version` seed; simpan `voiceGender` | P0, skema dari sesi fondasi | `server/store.js`, `workspace.js`, `org.js`, `seed.js` |
| **P2 Mesin** | Tegakkan `leadOnly`/`paOnly`; daun melihat kurang dari 8 tool, PA/master/manajer kurang dari 12; manajer memakai pintu `pilih_staf`/`jalankan_staf`; cabang `staff.run`; satu modul persetujuan; `governor` mencatat biaya dan kuota eksekusi n8n; prompt dirapikan; pemetaan status | P1 | `server/engine.js`, `catalog.js`, `governor.js` |
| **P3 Keamanan publik** | Gerbang LLM bertoken HMAC per eksekusi; hook bertanda tangan + cap waktu + nonce, token disimpan berhash; kuota dan batas laju per akun dan global; perbaiki klaim ruang kerja utama; enkripsi kunci per ruang kerja; tulis atomik dan kunci untuk `auth.json`/`otomasi.json`; hentikan siaran `host`; batasi URL `mcpServers`; hapus/ekspor data; antrean ulang bila n8n mati | P1, sebagian P2 | `server/auth.js`, `n8n.js`, `index.js`, `llm.js` |
| **P4 Antarmuka** | "Tim saya" (manajer dan staf sebagai karakter dengan status apa adanya); "Hasil Saya" menampilkan berkas dan data dari staf; Konfirmasi dan Obrolan/dock Orkestrator diserap Pemandu; halaman teknis disembunyikan dari pengguna biasa (konsol admin terpisah); Pengaturan disederhanakan (Akun, Tampilan, Ruang kerja dan undangan, Sambungan); HUD 3D satu kalimat; kamus diperluas ke semua string; nama aksesibel, tanpa emoji ikon dan tanpa merah; keadaan kosong/memuat/galat ramah | P2 (data hasil staf), kontrak dari P1 | `public/js/*`, `identity.css` |
| **P5 Katalog staf (paralel)** | Isi spesifikasi staf semua divisi dalam beberapa sesi per kelompok divisi, masing-masing divalidasi, dikompilasi, dan diuji di n8n tanpa sisa | skema, pembangun, dan validator dari sesi fondasi | `server/staff-catalog/<divisi>/` |
| **P6 Suara** | Gender tersimpan dan terverifikasi; variasi suara sampai profil unik untuk 170 agen; teks suara = teks pesan asli | P1 | `public/js/tts.js` |
| **P7 Kesiapan rilis** | Uji beban banyak ruang kerja (waktu simpan dan tick), pindah ke SQLite/Postgres per ruang kerja dengan tulis ganda dan pembanding, uji isolasi, privasi, dan pemulihan | P3 | `server/store.js` |

P0 dan P5 dapat dimulai segera setelah sesi fondasi melaporkan skema. P1 harus selesai sebelum P2, P3, dan P4 menyentuh data. P2 dan P4 dapat berjalan paralel di berkas yang berbeda (server dan klien), tetapi keduanya menunggu kontrak hasil staf dari P1/P2. P3 tidak boleh berjalan bersamaan dengan P1 di `server/store.js` dan `server/index.js`.

## 5. Tes invarian lintas lapisan (otomatis, tanpa GPU)

1. Id karyawan unik; setiap `reportsTo` mengarah ke id yang ada; tidak ada siklus.
2. Tiap divisi persis satu manajer (manusia dikecualikan) dan `leadId` = manajer itu; 22 divisi pada ruang kerja baru. Tetap benar setelah `PATCH isLead` dan `hire`.
3. Tepat satu PA per owner dan satu master per ruang kerja; keduanya bukan manajer.
4. Setiap staf punya `staffId` yang ada di katalog, `workflowId`, dan `characterId`; himpunan id roster = katalog = data = 3D, tanpa katalog yatim.
5. `isLead` bertipe boolean; `divisionId` ada di `divisions`; `status` dalam lima nilai; pemetaan status workflow tertutup.
6. Daun melihat kurang dari 8 tool, PA/master/manajer kurang dari 12; `leadOnly`/`paOnly` ditegakkan (staf tidak melihat `recruit_agent`).
7. Semua pembuat tugas lewat satu gerbang dengan kuota per ruang kerja; biaya n8n tercatat dan `overBudget` memblokir eksekusi.
8. Tidak ada `store.upsert('approvals'` di luar modul persetujuan.
9. Migrasi idempoten, berlaku untuk semua ruang kerja, dan tidak menghilangkan id.
10. Status 3D mengikuti `setStatus` selama `staff.run`.
11. Prompt tidak memuat id yang tidak ada; tidak ada pola `/s+/` (penjaga regex).
12. Kata terlarang, nama aksesibel, tanpa emoji ikon, tanpa merah, ukuran huruf dan area ketuk (390 × 844), dan keadaan kosong/memuat/galat pada semua layar yang bisa dilihat pengguna biasa.
13. Isolasi dua pengguna (SSE, Brain, memori, skill, token hook); tanda tangan atau pelindung ulang yang kedaluwarsa ditolak; kuota dan batas laju mengembalikan 429; injeksi di catatan, web, atau hook tidak mengubah izin; n8n mati lalu pulih tanpa duplikasi.
14. Verifikasi mascot V4.2 (`node docs/mascot-v4-2/verify-v42.mjs`) sebelum dan sesudah setiap fase.

## 6. Keputusan yang dibutuhkan dari Owner

1. **Konsol admin terpisah.** Pengguna publik tidak akan memakai kunci AI sendiri atau mengatur MCP/model; hal teknis itu pindah ke konsol admin (hanya untuk Anda, bukan "mode" bagi pengguna). Setuju?
2. **Model kuota publik.** Batas harian gratis per akun (jumlah tugas, eksekusi n8n, suara) dan batas global. Perlu angka awal.
3. **Penyimpanan untuk skala.** Rencana SQLite atau Postgres per ruang kerja (P7) tetap menjadi syarat rilis publik. Kapan target rilis publik?
4. **42 agen buatan asisten pribadi.** Ditandai `legacy` dan dipertahankan untuk ruang kerja Anda, atau dilebur ke dalam katalog staf?
5. **Hosting.** Aplikasi ini belum punya alamat publik; hook n8n dan login Google publik bergantung padanya.

## 7. Pembagian sesi yang diusulkan

- **Sesi fondasi (berjalan):** arsitektur staf = workflow, skema, validator, pembangun, pemasang, pelari, orkestrator manajer, rintisan semua divisi, dan 3 divisi percontohan.
- **Sesi P0 (pagar):** cadangan, bendera, tes invarian. Kecil dan murah, dimulai lebih dulu.
- **Sesi P1 → P2 (berurutan):** data dan migrasi, lalu mesin.
- **Sesi P3:** keamanan publik, setelah P1.
- **Sesi P4:** antarmuka, setelah kontrak dari P1/P2; ditinjau visual bersama Owner.
- **Sesi P5 (5 sesi paralel):** pengisian katalog per kelompok divisi.
- **Sesi suara (sudah ada):** P6.
