# Belajar mandiri: skill buatan agen, memori kecil, tinjauan pasca-tugas

Agen RAIVERSE bisa **belajar dari pengalaman** dan menyimpan pelajarannya, meniru mekanisme Hermes Agent (Nous Research), dengan pengaman tambahan.
Pengguna awam tidak pernah melihat kata "skill" atau "memori": mereka hanya melihat **kartu** ("Aku belajar sesuatu dari tugas tadi. Simpan?") dengan tombol **Simpan / Ubah dulu / Jangan**.

File kode: `server/skills-learn.js` (inti), `server/memory-lite.js` (memori + pemindai isi), `server/session-search.js` (cari riwayat). Tes: `test/skills-learn.test.js`.
Titik sambung di kode bersama (semuanya satu baris): `engine.js` (`systemPrompt`, `runTool`, `buildTools`, `completeTask`, `decideApproval`) dan `index.js` (satu baris rute).

## Cara kerjanya

| Bagian | Apa yang terjadi |
|---|---|
| **Pemuatan bertahap** | Prompt hanya memuat **daftar** skill (`id: deskripsi 90 huruf`). Isi penuh dibuka agen lewat alat kecil `skill_view(nama)` saat perlu. Pakai `settings.progressiveSkills = false` untuk kembali ke bentuk lama. |
| **Alat agen** | `skill_view`, `skill_manage` (create/patch/delete), `memory` (add/patch/remove), `session_search`. Hanya untuk tugas biasa (bukan rutin, bukan massal, bukan chat), hanya agen AI non-publik, dan hanya bila `settings.learning !== false`. Alat ini **tidak melewati daftar izin tool agen dan tidak bisa mengubahnya**. |
| **skill_manage** | **Selalu** menghasilkan *usulan menunggu*. Tidak ada berkas skill aktif sebelum pengguna menyetujui. |
| **Siklus skill** | `menunggu` (usulan) → disetujui → `percobaan` (hanya agen pembuatnya yang melihat) → setelah **3 tugas berhasil tanpa revisi** → `terbukti` (semua agen melihat daftarnya). 2 revisi dari pengguna (dan lebih banyak gagal daripada berhasil) → `ditangguhkan`. Pengguna bisa `dicabut` kapan saja (dan `pulihkan`). |
| **Memori** | Disimpan sebagai catatan **Brain** folder `Memori` (bukan penyimpanan baru). Profil pengguna ≤ **1.375** karakter (judul catatan `Yang aku tahu tentang <Nama>`, pribadi, terverifikasi karena dikonfirmasi pengguna). Catatan kerja agen ≤ **2.200** karakter (`Catatan Kerja <Agen>`, berstatus draf agen). Entri ≤ 300 karakter. Disuntik **sekali per tugas** (snapshot beku) di akhir prompt; agen publik tidak pernah menerimanya. |
| **Konfirmasi memori** | Tambah/ubah/hapus **profil pengguna** menunggu konfirmasi (kartu). **Catatan kerja agen** langsung tersimpan namun muncul di `baruDicatat` dan bisa dibatalkan. |
| **Tinjauan pasca-tugas** | Setelah tugas multi-langkah (≥ 4 pemanggilan alat, atau ≥ 2 delegasi) atau koreksi pengguna, **satu** panggilan model kecil (`gpt-oss-20b` / Haiku, `effort: low`, ≤ 1.500 token) memutuskan ada pelajaran atau tidak, lalu mengirim usulan. Dibatasi: 1 kali per agen per 20 menit, 8 kali per hari per ruang kerja (`settings.learnReviewsPerDay`, `learnReviewGapMin`), berhenti bila antrean menunggu ≥ 10, anggaran habis, atau mode simulasi. Tidak ada panggilan model di setiap pesan. |
| **Cari riwayat** | `session_search` memakai `node:sqlite` + **FTS5** (diuji nyata di Node 26.12; bm25, tanpa aksen). Satu berkas per ruang kerja di `data/sesi/<ruang>/cari.sqlite`, hanya indeks turunan dari `db.json` (bisa dibangun ulang). Cadangan otomatis tanpa sqlite: pencarian kata kunci. DM orang lain tidak pernah muncul. |

### Pengaman (diuji)
- Isi skill/memori dipindai: penyisipan instruksi ("abaikan instruksi…", tag `<system>`), usaha memberi izin ("tambahkan izin tool…", `allowed-tools:`), menghindari persetujuan, perintah destruktif/unduh-jalankan, penampung data keluar (webhook.site dll.), kunci/kata sandi/kartu, blok base64 → **ditolak** dengan alasan (agen bisa menulis ulang). Karakter tak terlihat, HTML, gambar, dan tautan mencurigakan (bukan https, IP, pemendek, ada token di query) **dibersihkan**.
- Frontmatter buatan agen **dibuang**; metadata (versi, status, pembuat, tugas asal, penghitung) hanya ditulis sistem. Tidak ada kolom `tools`/izin di format ini sama sekali.
- Skill dipindai ulang saat dibuka; bila rusak di disk → status `diblokir`.
- Batas: nama ≤ 48, deskripsi ≤ 200, isi ≤ 6.000 karakter / 150 baris, 2 usulan skill dan 4 perubahan memori per tugas, 5 usulan menunggu per agen, 40 total, 80 skill buatan, 10 versi lama disimpan.
- Skill bawaan perusahaan tidak bisa ditimpa atau dihapus agen.
- Agen tidak punya alat untuk menyetujui; keputusan hanya lewat API di bawah (rute dibatasi Owner/Admin seperti rute browser).

### Lokasi data (di `data/`, tidak ikut Git)
```
data/skills-agen/<ruang>/usulan.json                     antrean + riwayat keputusan + penghitung tinjauan
data/skills-agen/<ruang>/skills/<nama>/SKILL.md          skill aktif/uji coba/dicabut
data/skills-agen/<ruang>/skills/<nama>/versions/vN.md    versi lama
data/sesi/<ruang>/cari.sqlite                            indeks pencarian riwayat
```
Format `SKILL.md` (kompatibel dengan gaya agentskills.io):
```markdown
---
name: "balas-komplain"
description: "Membalas komplain pengiriman terlambat dengan sopan."
version: 2
platforms: ["raiverse"]
status: percobaan
metadata:
  kategori: "agen"
  tags: ["cs"]
  kepercayaan: "agen"
  dibuat_oleh: "<id agen>"
  dari_tugas: "<id tugas>"
  dibuat: "2026-..."
  disetujui_oleh: "<id pengguna>"
  dipakai: 3
  berhasil: 2
  gagal: 0
---
## Kapan dipakai / ## Prosedur / ## Jebakan / ## Verifikasi
```

## Kontrak API (untuk kartu di layar depan)

Semua JSON. Rute dibatasi Owner/Admin. `userId` diambil dari sesi bila ada.

### `GET /api/belajar/usulan`
```json
{ "total": 1,
  "items": [{
    "id": "ul-…", "status": "menunggu", "jenis": "skill|skill_ubah|skill_cabut|memori",
    "dibuat": 1760000000000, "diputuskan": null, "asal": "agen|tinjauan", "alasan": "…",
    "dari": { "agenId": "…", "agen": "Nova", "tugasId": "t-…", "tugas": "Judul tugas" },
    "kartu": { "judul": "Aku belajar cara kerja baru", "isi": "teks ringkas untuk dibaca awam", "detail": "isi penuh (opsional, untuk 'lihat detail')",
               "tombol": [ {"id":"setuju","label":"Simpan"}, {"id":"ubah","label":"Ubah dulu"}, {"id":"tolak","label":"Jangan"} ] },
    "bersih": ["HTML/gambar/tautan mencurigakan dibersihkan"], "diubahPengguna": false }],
  "baruDicatat": [ /* catatan kerja agen yang sudah tersimpan otomatis; kartu.tombol = [{"id":"batal","label":"Batalkan"}], status "diterapkan" */ ] }
```
Pakai hanya `kartu.*` dan `dari.agen` untuk tampilan; `jenis`/`detail` istilah teknis jangan ditampilkan ke pengguna awam.

### `POST /api/belajar/usulan/:id`
Body: `{ "keputusan": "setuju" | "tolak" | "ubah", "isi"?: "…", "deskripsi"?: "…", "teks"?: "…" }`
- `setuju` → diterapkan (skill jadi *uji coba*; memori masuk profil). Bisa disertai suntingan (`isi`/`deskripsi` untuk cara kerja, `teks` untuk catatan tentang pengguna).
- `ubah` → hanya memperbarui draf, status tetap `menunggu` (kartu dirender ulang; lalu pengguna menekan Simpan).
- `tolak` → ditolak.
- Mengembalikan item (bentuk sama seperti di atas) dengan status baru. Galat: `404` tidak ada, `409` sudah diputuskan, `422` suntingan tidak lolos pemindai/batas.

### `POST /api/belajar/usulan/:id/batal`
Membatalkan catatan kerja agen yang tersimpan otomatis (item `baruDicatat`).

### "Yang aku tahu tentang kamu"
- `GET /api/belajar/profil` → `{ "judul": "Yang aku tahu tentang kamu", "entri": [{"nomor":1,"teks":"…"}], "terpakai": 24, "batas": 1375 }`
- `POST /api/belajar/profil` `{ "teks": "…" }` tambah entri (pengguna sendiri, tanpa konfirmasi)
- `PUT /api/belajar/profil` `{ "entri": ["…", "…"] }` ganti seluruh isi
- `DELETE /api/belajar/profil/:nomor` hapus satu entri (nomor mulai 1)
- Galat `422` bila melebihi batas karakter atau ditolak pemindai (pesan menjelaskan alasannya).

### Lainnya
- `GET /api/belajar/ringkasan` → `{ menunggu, skillAktif, skillTotal, tinjauanHariIni, belajarAktif, pemuatanBertahap }` (untuk lencana angka)
- `GET /api/belajar/catatan/:agentId` dan `DELETE /api/belajar/catatan/:agentId/:nomor` — catatan kerja satu agen
- `GET /api/belajar/skill`, `GET /api/belajar/skill/:id`, `POST /api/belajar/skill/:id/cabut` `{alasan?}`, `POST /api/belajar/skill/:id/pulihkan` — kelola cara kerja yang sudah dipelajari (layar Lanjutan)
- `GET /api/belajar/cari?q=kata&batas=5` → `{ engine: "sqlite-fts5", hasil: [{jenis, judul, kapan, cuplikan, rujukan}] }`

## Pengaturan (`db.settings`, semua opsional)
`learning` (bawaan aktif; `false` mematikan semuanya, ini pengaturan yang sudah ada) · `progressiveSkills` (`false` = prompt bentuk lama) · `learnReviewsPerDay` (8) · `learnReviewGapMin` (20).

## Hasil pengukuran
Dari `node --test test/skills-learn.test.js` (12 agen, satu per divisi, tugas contoh):
- Prompt sistem: **180.349 → 141.076 karakter** total (≈ 45.087 → 35.269 token, **hemat ±22%**, ±820 token per agen); skill kini hanya daftar nama+deskripsi.
- Angka "baru" di atas **sudah termasuk** blok "Pola kerja" (651 karakter, ±160 token). Di luar prompt masih ada definisi 4 alat ±1.750 karakter (±440 token per giliran). Per agen: sebelum ±3.760 token → sesudah ±2.940 + 440 = ±3.380 token per giliran, jadi bersihnya **hemat ±10%** (memori beku menambah sedikit hanya bila ada isi, maks ±3.575 karakter).

## Belum teruji
- **Perilaku model Groq asli** (gpt-oss-120b/20b): apakah model benar-benar memanggil `skill_view` tepat waktu, menulis skill yang bermutu, dan keputusan tinjauan yang bijak. Tes memakai model palsu; tanpa kunci hal ini tidak bisa dibuktikan. Kalau kualitas turun, set `progressiveSkills=false`.
- Tampilan kartu (tugas sesi Pemandu) dan alur klik di layar depan.
- Perilaku model asli di chat (apakah memanggil `memory` pada saat yang tepat) juga belum teruji.
- Kualitas pemindai pada bahasa selain Indonesia/Inggris, dan pada serangan yang disamarkan dengan sangat cerdik (pemindai berbasis pola; lapisan pertahanan utamanya tetap: tidak ada jalur izin + persetujuan pengguna + masa uji coba).

## Paket skill super (`server/skills-power.js`)
58 skill buatan sistem/Owner (bukan buatan agen, jadi langsung aktif): 12 lintas agen (perencanaan dan periksa sendiri, memilih alat, riset bersumber, bertanya dengan pilihan, menjelaskan untuk awam, belajar dari tugas, serah terima, penanganan galat, hemat token, keselamatan data, otomasi n8n, browser seperlunya) dan 2-3 spesialis untuk **setiap** divisi (22 divisi). Tiap skill berisi Prosedur, Jebakan, Verifikasi.
- **Pemasangan:** idempoten. `index.js` memasang ke semua ruang kerja saat start (ditandai `db.powerRev`), `seed.js` memasangnya di data baru. Skill spesialis diberi proficiency 8 (kepala divisi 9) ke semua agen AI di divisinya; skill lintas agen 6 ke semua agen AI (sengaja lebih rendah supaya spesialis tetap menang di daftar relevan). Pemasangan hanya menaikkan nilai, tidak menurunkan, dan tidak menimpa skill yang diubah Owner (skill paket ditandai tag `paket-super`; naikkan `REV` di file itu untuk menyebarkan revisi isi).
- **Chat langsung:** alat `memory` dan `session_search` tersedia di chat, memori beku masuk prompt chat, batas 4 perubahan memori per jam per agen. `skill_view`/`skill_manage` tidak ada di chat karena chat tidak memuat daftar skill.
- Diuji pada salinan database Owner: 58 skill baru + 2.845 pemasangan (ruang utama), 170 dari 170 agen AI memegang skill lintas agen.
