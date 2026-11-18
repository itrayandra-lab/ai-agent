# Otomasi nyata (di belakang layar) — kontrak untuk layar depan Pemandu

Pengguna awam **tidak pernah** melihat kata workflow, node, atau n8n. Di layar depan semuanya disebut **"otomasi"**. Semua teks di JSON di bawah sudah berbahasa awam dan dibersihkan dari istilah teknis dan rahasia (`scrub()` di `server/n8n.js`).

## Pengaturan (hanya di server, di `.env`; jangan di-commit)

| Variabel | Fungsi |
|---|---|
| `N8N_API_KEY` | Kunci akses mesin otomasi. Hanya dibaca dari `process.env`; tidak pernah dicatat, dikirim ke agen, atau ditulis ke alur. |
| `N8N_URL` | Alamat mesin otomasi. Saat ini `https://n8n.raycorpgroup.com` (server Owner). Kosong = `http://127.0.0.1:5678`. |
| `RAIVERSE_PUBLIC_URL` | Alamat publik aplikasi ini. **Opsional**: kabar lewat RAIVERSE tidak memakainya (RAIVERSE mengambil hasil). Hanya dibutuhkan untuk ringkasan lewat WhatsApp/email dan jalur panggilan masuk `hook` (yang kini wajib bertanda tangan; lihat `docs/KEAMANAN-P3.md`). |
| `OTOMASI_POLL_MS` | Selang pengambilan hasil (bawaan 60000). `OTOMASI_FILE` mengganti lokasi registri (pengujian). |
| `WAHA_URL`, `WAHA_ENABLED=1` / `WAHA_API_KEY` | Jalur WhatsApp (WAHA). Bila mesin di server lain, `WAHA_URL` harus alamat yang bisa dijangkau server itu. |
| `N8N_SMTP_CREDENTIAL_ID`, `N8N_SMTP_CREDENTIAL_NAME`, `N8N_MAIL_FROM` | Jalur email (kredensial SMTP yang dibuat Owner sekali di mesin otomasi). |

Pengaturan batas (opsional) di `settings.otomasi`: `maxActive` (10), `maxDrafts` (20), `maxCreatePerHourAI` (6), `maxPings` (30/jam/otomasi), `timeoutMs` (12000).

## Jalur Google (kenapa begini)

Dipakai **konektor Google Apps Script yang sudah ada** (Pengaturan → Integrasi): Owner mengisinya sekali. Server membuat satu kredensial di mesin otomasi (`RAIVERSE Google`, jenis custom-auth) berisi rahasia konektor itu, dan alur hanya merujuknya. Alasan: pengguna awam tidak perlu mengisi OAuth/Client ID/Cloud Console; rahasia tidak muncul di berkas alur; tidak ada kata sandi Google yang dimasukkan siapa pun. Bila konektor belum aktif, hasilnya `status: "perlu_sambung"` dengan `jenis: "google"` dan kalimat sederhana. (Alternatif OAuth Google di mesin otomasi menuntut Owner membuat proyek Google dan melakukan login di editor teknis, jadi tidak dipilih.)

## Daur hidup

`usulan` → `siap` (dibuat TIDAK AKTIF + lolos uji data contoh) → `aktif` ⇄ `jeda` → dihapus. Menyalakan hanya terjadi setelah pengguna/Owner mengonfirmasi pratinjau. Uji memakai **salinan sementara** dengan semua langkah berefek keluar (kirim pesan, tulis Sheets, buka halaman) diganti pencatat; salinan dihapus setelah uji. Tidak ada pesan nyata terkirim saat uji.

## Rute (Owner/Admin ruang kerja)

### `GET /api/automations`
```json
{ "koneksi": { "tersambung": true, "kunci": true, "pesan": "Siap dipakai." },
  "otomasi": [ { "id": "oto-…", "judul": "Pengingat terjadwal", "status": "aktif",
    "keterangan": "Berjalan", "langkah": ["Setiap hari jam 08:00", "…"], "dampak": ["Mengirim pengingat ke …"],
    "olehAgen": false, "dibuat": 0, "diubah": 0,
    "terakhir": { "waktu": "ISO", "hasil": "Berhasil|Gagal|Sedang jalan", "masalah": "" },
    "alamatMasuk": "…/webhook/rv-…  (hanya templat penerima data, saat aktif)" } ] }
```
`koneksi.tersambung=false` bukan galat HTTP: daftar tetap tampil, `pesan` menjelaskan ("Mesin otomasi belum menyala", "Kunci akses ditolak"…).

### `POST /api/automations/propose`  `{ "text": "ingatkan saya bayar listrik tiap hari jam 7 lewat WhatsApp 0812…" }`
```json
{ "id": "oto-…", "tanya": "Mau aku otomatiskan ini?",
  "pilihan": [ { "id": "opsi1", "templat": "pengingat", "judul": "Pengingat terjadwal",
    "ringkas": "Aku kirim pesan pengingat sesuai jadwal yang kamu mau.",
    "siap": true, "perlu": [], "isianTebakan": { "saluran": "whatsapp", "jam": "07:00" } }, … ] }
```
2–3 pilihan. `siap:false` + `perlu:["kalimat sederhana"]` bila ada yang belum tersambung. Tidak ada panggilan AI berbayar (pencocokan kata kunci).

### `POST /api/automations/:id/confirm`
Tahap 1 — siapkan: `{ "pilihan": "opsi1", "isian": { "pesan": "Bayar listrik", "jam": "07:00" } }` (atau `"templat": "pengingat"`). Hasil, salah satu:
- `{ "status":"tanya", "tanya":[{ "kunci":"pesan", "label":"Apa yang perlu diingatkan?", "jenis":"text|time|url|choice", "pilihan":[{"nilai","teks"}], "contoh":"", "pesan":"" }] }` → tampilkan sebagai pertanyaan/tombol, kirim lagi dengan `isian` lengkap.
- `{ "status":"perlu_sambung", "perlu":[{ "jenis":"google|whatsapp|email|alamat", "pesan":"…" }] }`
- `{ "status":"siap", "pratinjau":{ "judul","langkah":[],"dampak":[] }, "uji":{ "berhasil":true,"catatan":"…" }, "tanya":"Nyalakan sekarang?" }`

Tahap 2 — nyalakan (setelah pengguna menekan "Ya, nyalakan"): `{ "setuju": true }` → tampilan otomasi dengan `status:"aktif"`. Juga dipakai untuk melanjutkan otomasi `jeda`. Sebelum tahap 1 selesai, `setuju` ditolak (409).

### `POST /api/automations/:id/pause` → tampilan otomasi `status:"jeda"`.
### `GET /api/automations/:id/data` → `{ "baris": [{ "waktu", "isi": {…} }] }` (hanya untuk templat tabel; maks 50 baris).
### `GET /api/automations/:id`, `DELETE /api/automations/:id` (menghapus; alur mesin ikut terhapus).

Galat: `{ "error": "kalimat sederhana" }` dengan kode 400/404/409/422/429 (batas)/503 (mesin mati atau kunci ditolak) — aman ditampilkan langsung.

## Banyak pengguna sekaligus (isolasi)
Satu mesin otomasi dipakai bersama, tetapi tiap pengguna = satu ruang kerja RAIVERSE dan datanya tidak bercampur:
- **Registri per ruang kerja**: setiap otomasi tercatat dengan `ws`; semua rute/tool hanya melihat milik ruang kerja yang sedang aktif (`store.current()`). Id milik orang lain = "tidak ditemukan".
- **Nama alur** memuat penanda `[ruang-kerja]` dan id; sebelum mengubah, kecocokan label+ruang kerja+id dicek ulang.
- **Alamat masuk** (webhook) berisi token acak 96-bit per otomasi; tidak ada alamat bersama.
- **Kredensial Google per ruang kerja** (`RAIVERSE Google <ruang>`), berisi rahasia konektor ruang kerja itu saja.
- **Kabar**: alur hanya menaruh teks di keluaran `kabar`; RAIVERSE mengambilnya (polling 60 dtk, `pollOnce`) dan menaruh di DM pemilik otomasi itu. Tidak perlu alamat publik dan tidak ada panggilan masuk. Tiap eksekusi dikirim sekali (`lastExec`).
- **Pengirim bersama (WhatsApp, email) hanya untuk ruang kerja `main`** (pemilik platform), karena nomor/pengirimnya satu. Pengguna publik memakai kabar lewat RAIVERSE, Google milik mereka sendiri, atau tabel gratis. Pengaturan `OTOMASI_SHARED_SENDERS=1` membukanya untuk semua (tidak disarankan).
- **Batas**: per ruang kerja (10 aktif, 20 draf, 6 buatan agen/jam) dan global (300 aktif di mesin).
- **Penyimpanan gratis**: tabel data bawaan mesin otomasi (`raiverse_catatan`: tenant, otomasi, waktu, isi). Penulisan hanya oleh templat tepercaya dengan tenant tertanam; pembacaan hanya lewat `GET /api/automations/:id/data` yang menyaring ruang kerja + otomasi (disaring dua kali). Belum ada kuota baris per pengguna dan API publik tidak bisa menghapus baris (perlu dilakukan dari editor).

## Templat tepercaya
`catat_tabel` (simpan data masuk ke tabel gratis, tanpa Google), `cek_situs` (kabar saat situs mati/pulih), `catat_sheets` (catat baris ke Google Sheets), `ringkasan_harian` (jam + saluran), `pengingat` (harian/hari kerja/mingguan), `formulir_masuk` (masuk → Sheets → kabar), `pantau_halaman` (URL publik, tiap 1/3/6/12/24 jam, kabar saat berubah). Saluran kabar: `raiverse` (pesan DM di RAIVERSE), `whatsapp`, `email`. Jadwal paling sering: tiap 1 jam.

## Tool agen: `otomatiskan` (satu pintu, seperti `buka_browser`)
`aksi`: `usulkan` (rakit tidak aktif + uji + **kartu persetujuan Owner** `kind:"automation"`; menyetujui kartu = menyalakan, tidak pernah disetujui otomatis), `daftar`, `status`, `jeda`, `hapus` (hanya yang tidak aktif). Kapabilitas katalog: `otomasi` (restricted, tidak diberikan massal; semua agen AI punya akses karena risiko ditahan kartu persetujuan). Agen tidak bisa menyalakan sendiri.

## Keamanan
- Hanya alur berlabel `[RAIVERSE] ` dan tercatat di registri (`data/otomasi.json`, gitignored) yang bisa diubah/dinyalakan/dihapus; alur milik Owner tidak disentuh (dicek ulang tiap operasi).
- Alur buatan agen (di luar templat): hanya jenis langkah yang diizinkan; Execute Command, berkas, SSH/FTP, Execute Workflow, Code, `$env`, `process`, `require`, alamat lokal/privat ditolak (`vet()`).
- Teks dari pengguna/halaman web dimasukkan hanya sebagai literal string; `{{ }}` dinetralkan; isi dari luar tidak pernah dieksekusi.
- Panggilan balik mesin → RAIVERSE: `/api/automations/hook/<pengenal 128-bit>/(ping|digest)`, di luar gerbang login. **Sejak Fase P3 bertanda tangan** (v2): header `x-rv-ts`, `x-rv-nonce`, `x-rv-sig` = HMAC-SHA256(rahasia otomasi, `ts.nonce.METODE.aksi.sha256(badan)`); jam melenceng > 5 menit, tanda tangan salah, dan nonce yang dipakai ulang ditolak; batas laju per otomasi (ping 30/jam, digest 30/jam) tahan restart. Yang disimpan hanya hash pengenal dan rahasia terenkripsi. Otomasi lama (token polos) dimigrasi jadi hash dan hanya diterima dari komputer ini selama masa transisi (30 hari, `OTOMASI_LEGACY_HOOK_UNTIL`). Detail: `docs/KEAMANAN-P3.md`.
- Batas: otomasi aktif (10), draf (20), pembuatan oleh agen per jam (6).
- Rahasia Google/WAHA ada di kredensial mesin otomasi, tidak di berkas alur, log, atau keluaran agen.
