# Konsol pengelola platform (#admin)

Konsol terpisah untuk Owner / pengelola platform RAIVERSE. Semua hal teknis (kunci AI, model, jatah, MCP, data, keamanan) diatur di sini. Pengguna biasa tidak memakai kunci sendiri, tidak mengatur MCP atau model, dan tidak melihat tautan ke konsol ini. Kode: `server/admin.js` (rute), `server/platform.js` (pengaturan platform, log audit), `public/js/admin-view.js` dan `admin-bagian.js` (tampilan). Tes: `test/admin.test.js`.

## 1. Cara menjadi pengelola

Pengelola platform BUKAN "admin ruang kerja". Ia ditentukan di server:

1. **`RAIVERSE_ADMIN_EMAILS=a@x.id,b@x.id`** di `.env`: hanya akun Google dengan email itu yang menjadi pengelola. Email yang sama juga satu-satunya yang boleh mengklaim kantor utama (lihat `docs/KEAMANAN-P3.md`). Bila daftar diisi, pemilik kantor utama yang tidak ada di daftar BUKAN pengelola.
2. Tanpa daftar itu: **pemilik kantor utama** yang mengklaimnya dengan aman (kode klaim `RAIVERSE_CLAIM_CODE` atau kode sekali pakai di konsol server, atau login dari komputer server sendiri).
3. Server yang belum punya akun sama sekali (komputer pribadi, belum login): hanya permintaan **langsung dari komputer itu** (loopback, tanpa proxy) yang dianggap pengelola. Lewat internet, tidak.

Buka `https://alamatmu/#admin`. Tidak ada tombol atau menu yang menautkannya dari tampilan pengguna biasa. Akun yang ditangguhkan tidak bisa masuk.

## 2. Bagian-bagian

| Bagian | Isi |
|---|---|
| Ringkasan | kesehatan server, mesin AI aktif (live atau simulasi) dan sumber kuncinya, pemakaian dan biaya hari ini, jumlah ruang kerja dan akun, mode penyimpanan, status n8n, usia data utama, cadangan terakhir |
| Penyedia AI | kunci Groq dan Anthropic (isi, ganti = putar, uji koneksi, hapus), model per tingkat (pemimpin, pekerja, ringan), batas global |
| Kuota dan batas | batas harian per akun dan seluruh platform (tugas, eksekusi staf, suara, pesan, panggilan AI otomasi, ruang kerja baru), batas laju, anggaran harian, tombol tutup anggaran |
| Pengguna | daftar dan cari akun, tangguhkan atau aktifkan, ekspor data pribadi (butuh alasan), hapus akun (konfirmasi + alasan), daftar ruang kerja dan mode penyimpanannya |
| Integrasi | Google (OAuth, konektor Apps Script), n8n (alamat, status, jumlah alur berlabel `[RAIVERSE]`, tombol nonaktifkan staf n8n), server MCP (tambah, uji, hapus), WhatsApp dan email (status jujur) |
| Staf dan katalog | spesifikasi staf per divisi (lengkap atau rintisan), mesin staf (`native` atau `n8n`), bendera `staffModel` dan bendera lain |
| Keamanan | log audit yang bisa difilter, sesi aktif dan pencabutan, laporan upaya ditolak (403/429), kunci enkripsi (bungkus ulang, putar), status token hook |
| Data | ukuran data, cadangan (buat, periksa), pemulihan, mode penyimpanan json, dual, sqlite dengan pembanding |
| Alat lama | halaman teknis lama (obrolan, konfirmasi, studio, pusat belajar, penjelajah web, papan lama, struktur lama, pengaturan teknis) tetap ada untuk pengelola |

## 3. Yang aman, dan bagaimana

- **Identitas dicek di server, di setiap rute** `/api/admin/*`. Bukan pengelola (pengguna biasa, Owner ruang kerja lain, tanpa login) mendapat **403 dengan badan yang sama** untuk rute yang ada maupun yang tidak ada, sehingga keberadaan fitur tidak bocor. Pemeriksaan terjadi sebelum gerbang sesi.
- **Rahasia tidak pernah dikirim ke layar atau dicatat.** Kunci disimpan sebagai amplop terenkripsi (`secure.seal`, konteks `admin-secret`) di `data/admin.json` (mode 0600). Respons hanya "terisi/kosong" dan empat karakter terakhir. Log audit menyamarkan pola rahasia. Uji koneksi memakai nilai yang ditempel tanpa menyimpannya.
- **Anti-CSRF**: metode yang mengubah wajib header `X-Raiverse-Admin: 1` (tidak bisa dikirim lintas situs tanpa izin CORS) dan `Origin` yang sama; `Sec-Fetch-Site: cross-site` ditolak. Percobaan yang gagal tercatat (`admin.csrf`).
- **Batas laju**: 240 permintaan per menit dan 40 perubahan per menit per akun (dapat diatur `RATE_ADMIN_PER_MIN`, `RATE_ADMIN_WRITE_PER_MIN`); lewat itu 429.
- **Log audit** (`data/admin-audit.jsonl`, hanya menambah, dirotasi pada 4 MB): waktu, pelaku (email), alamat, aksi, sasaran, hasil (`ok`, `gagal`, `ditolak`), rincian singkat. Setiap aksi yang mengubah dicatat, termasuk yang gagal dan yang ditolak. Dapat difilter di bagian Keamanan.
- **Aksi berdampak besar wajib mengetik ulang kalimat konfirmasi** dan diperiksa lagi di server: hapus kunci, tutup anggaran, hapus akun (plus alasan), pulihkan cadangan, alih ke sqlite, nonaktifkan staf n8n, hapus server MCP, cabut semua sesi akun, bungkus ulang atau putar kunci. Ekspor data pribadi wajib alasan tertulis.
- **Isi pesan, catatan, dan tugas pengguna tidak ditampilkan** di daftar pengguna.
- **Tidak ada eksekusi perintah bebas.** Satu-satunya proses anak adalah skrip tetap `scripts/n8n-staf-nonaktifkan.mjs` (bila ada), tanpa argumen dari pengguna dan dengan lingkungan minimal.
- **MCP**: alamat diperiksa anti-SSRF (`collab.assertMcpUrl`: metadata awan dan aplikasi ini sendiri ditolak; kantor utama boleh MCP lokal kecuali `MCP_BLOCK_PRIVATE=1`). Konsol hanya menampilkan asal (skema dan host), bukan jalur, kueri, atau header.
- **Pengguna biasa**: `PATCH /api/settings` menolak (403) kunci, model, MCP, konektor, jatah, anggaran, `staffModel`, `tickMs`, `maxConcurrent`, `mode`, dan rute `test-key`, `mcp/test`, `groq-models`, `google-workspace/test`. `/api/state` dan siaran langsung tidak membawa `apiKey`, `hasApiKey`, `mcpServers`, `googleAppsScript` untuk non-pengelola, dan `platformAdmin` hanya ada untuk pengelola. Pengaturan sehari-hari (otonomi, tampilan, nama ruang kerja, undangan) tetap jalan. Ruang kerja Owner yang sudah berjalan tetap utuh: kunci per ruang kerja lama tetap dipakai (urutan: kunci ruang kerja, kunci konsol, `.env`), dan di server lokal tanpa login pemilik tunggal tetap pengelola.

## 4. Cara kerja beberapa bagian

- **Kunci dan model**: `llm.js` memakai kunci ruang kerja, lalu kunci konsol, lalu `.env`. Model yang dipilih di konsol per tingkat mengalahkan pilihan per ruang kerja untuk semua ruang kerja; kosong = bawaan.
- **Batas**: nilai yang diubah di konsol menimpa `.env` dan bawaan, berlaku seketika tanpa mulai ulang, dan "Bawaan" menghapus penimpaannya. Hanya kunci dalam daftar putih (`platform.LIMIT_KEYS`) dengan rentang aman yang bisa diubah. `0` pada kuota harian berarti tanpa batas. Jatah per ruang kerja (`settings.quota`) tetap diatur per ruang kerja lewat jalur lama, kini hanya oleh pengelola.
- **Tutup anggaran** (`aiClosed`): semua pekerjaan AI baru ditolak (429) di seluruh platform sampai dibuka lagi.
- **Pulihkan cadangan**: TIDAK menimpa data saat server berjalan (server akan menulis ulang dari memorinya). Konsol memeriksa cadangan (ukuran dan hash), menjadwalkan, dan baru menerapkannya **saat server dimulai ulang**, sebelum data dimuat, setelah keadaan sekarang dicadangkan otomatis (memakai `scripts/restore-data.mjs`). Bisa dibatalkan sebelum mulai ulang.
- **Mode penyimpanan**: urutan aman json, lalu dual (SQLite ditulis berdampingan dan dibandingkan), lalu sqlite hanya bila pembanding bersih dan setelah konfirmasi. Keluar dari sqlite memakai `node scripts/storage-migrate.mjs rollback`; konsol menolak dan menunjukkannya.
- **Putar kunci enkripsi**: hanya bila kunci tidak berasal dari env (berkas `data/.raiverse-keys.json`); menambah versi baru lalu membungkus ulang semua rahasia. Bila kunci dari env, konsol menjelaskan caranya (tambah versi di `RAIVERSE_KEYS`, mulai ulang, lalu "Bungkus ulang rahasia"). Cadangkan berkas kunci bersama data.

## 5. Yang belum (jujur)

- **Rotasi token hook otomasi secara massal belum dibangun.** Token dibuat per otomasi saat dipasang di n8n; memutarnya berarti memasang ulang alurnya. Konsol hanya menampilkan jumlah (versi 2 dan format lama). Rotasi per otomasi lewat layar Otomasi.
- **Peran pengelola lebih dari satu tingkat** (mis. hanya-lihat) belum ada: pengelola berarti akses penuh ke konsol.
- **WhatsApp dan email** hanya ditampilkan statusnya; pengaturannya tetap di `.env` server (`WAHA_URL`, `WAHA_API_KEY`, `N8N_MAIL_FROM`). Konsol tidak mengirim apa pun.
- **Kunci OAuth Google dan rahasia sesi** tetap di `.env`; konsol hanya menampilkan "diatur atau belum".
- **Header rahasia server MCP** disimpan di data kantor utama seperti sebelumnya (tidak diselubungi ulang oleh konsol); tidak pernah dikirim balik ke layar.
- **Catatan upaya ditolak** hidup di memori (hilang saat mulai ulang); log audit di disk. Alamat ditampilkan sebagai penanda acak 8 huruf, bukan IP.
- **Tombol "Nonaktifkan staf n8n"** hanya aktif bila `scripts/n8n-staf-nonaktifkan.mjs` ada (dibuat sesi lain). Konsol menjalankannya tanpa argumen; kalau skrip itu membutuhkan argumen, tombolnya perlu disesuaikan. Belum diuji terhadap skrip aslinya.
- Berkas JavaScript konsol (`admin-view.js`) tetap bisa diunduh siapa pun karena dimuat modul bersama; otorisasinya ada di server, bukan di kerahasiaan kode.
- Pagar visual: `visual-lock.json` belum diperbarui; menunggu tinjauan Owner (`docs/visual-review/2026-11-18-konsol-admin.md`).

## 6. Env yang relevan

`RAIVERSE_ADMIN_EMAILS`, `RAIVERSE_CLAIM_CODE`, `RAIVERSE_PUBLIC_MODE`, `RATE_ADMIN_PER_MIN`, `RATE_ADMIN_WRITE_PER_MIN`, `TRUST_PROXY`, `RAIVERSE_PUBLIC_URL` (asal yang sah di balik proxy), `MCP_BLOCK_PRIVATE`. Berkas data yang ditambahkan: `data/admin.json`, `data/admin-audit.jsonl(.1)`, `data/restore-pending.json` (sementara).
