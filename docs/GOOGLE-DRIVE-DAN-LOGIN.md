# Login Google + Google Drive per pengguna: panduan setup

Tujuan: setiap orang login dengan akun Google. Data perusahaan (Brain) disimpan di Google Drive, bukan di server. Agen membaca fakta dari sana. Data internal tidak pernah bocor ke agen publik.

## 0. Keamanan lebih dulu
- Client secret yang pernah ditempel di chat harus diganti. Buka Google Cloud Console → **APIs & Services → Credentials** → klik OAuth client Anda → **Reset secret**. Simpan secret baru **hanya** di file `.env` (sudah di-gitignore). Jangan tempel di chat, kode, atau dokumen.
- Isi `.env`:
  ```
  GOOGLE_CLIENT_ID=...apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=...        # secret yang baru
  GOOGLE_REDIRECT_URI=http://localhost:4400/auth/google/callback
  SESSION_SECRET=<32+ karakter acak>
  TOKEN_ENC_KEY=<32+ karakter acak, untuk mengenkripsi refresh token>
  ```

## 1. API yang diaktifkan (APIs & Services → Library)
| API | Untuk apa | Wajib |
|---|---|---|
| Google Drive API | folder & file RAIVERSE di Drive tiap pengguna | ya |
| Google Docs API | catatan Brain sebagai Google Doc | ya |
| Google Sheets API | data tabel: produk, harga, pelanggan, laporan | ya |
| Google Slides API | presentasi buatan agen | nanti |
| Google Picker API | pengguna memilih file Drive yang sudah ada untuk dibaca agen | ya |
| Google Calendar API | jadwal rapat/tugas | nanti |

## 2. Scope: cukup yang non-sensitif dulu
Di **OAuth consent screen → Data access**, sisakan:
- `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`: untuk login
- `.../auth/drive.file`: aplikasi hanya bisa melihat file yang **dibuatnya sendiri** atau yang **dipilih pengguna lewat Picker**.

Dengan `drive.file`, API Docs, Sheets, dan Slides tetap bisa membuat dan mengedit file buatan aplikasi. Jadi scope `spreadsheets`, `presentations`, dan `calendar` **tidak perlu** sekarang.

**Hapus** scope berikut dari daftar:
| Scope | Alasan |
|---|---|
| `gmail.modify` | *restricted*: wajib audit keamanan berbayar (CASA) sebelum dipakai publik |
| `youtube`, `youtube.upload` | belum ada fiturnya |
| `calendar`, `calendar.events`, `spreadsheets`, `presentations` | *sensitive*: butuh verifikasi Google, dan selama status "Testing" refresh token-nya kedaluwarsa tiap 7 hari |

Scope tambahan diminta **belakangan**, saat fiturnya dipakai (*incremental authorization*). Contoh: tombol "Sambungkan Kalender" baru meminta `calendar.events`.

Karena sisa scope semuanya non-sensitif, aplikasi bisa langsung **Publish → In production** tanpa proses verifikasi panjang.

## 3. OAuth client (Credentials → OAuth client → Web application)
URI harus persis sama, termasuk path.
- **Authorized JavaScript origins**: `http://localhost:4400`, `https://raymaizing.com`
- **Authorized redirect URIs**: `http://localhost:4400/auth/google/callback`, `https://raymaizing.com/auth/google/callback`

Saat ini yang terdaftar hanya `https://raymaizing.com` tanpa path. Itu tidak akan cocok dengan callback aplikasi.

Untuk Picker, buat juga **API key** (Credentials → Create credentials → API key) dan batasi:
- *Application restrictions*: HTTP referrers `http://localhost:4400/*` dan `https://raymaizing.com/*`
- *API restrictions*: Google Picker API

## 4. Cara data disimpan (satu struktur untuk semua)
Saat pertama kali login dan menyetujui izin, aplikasi membuat folder di Drive **milik pengguna itu**:
```
RAIVERSE/
  Perusahaan/        ← hanya di Drive Owner: fakta perusahaan (Internal)
    Profil Perusahaan (Doc)
    Produk & Harga (Sheet)
    Pelanggan (Sheet)
    SOP/ (Doc per SOP)
  Publik/            ← boleh dipakai agen yang melayani orang luar
    FAQ (Doc), Katalog Publik (Sheet)
  Pribadi/           ← catatan pribadi pengguna; hanya dia dan agennya
  Hasil Agen/        ← dokumen buatan agen (draf, menunggu review)
```
- **Folder menentukan tingkat akses**: `Perusahaan` → Internal, `Publik` → Publik, `Pribadi` → Pribadi. Agen publik hanya membaca `Publik/`.
- **Yang sudah Anda punya di Drive**: buka Brain → "Tambah dari Drive" (Picker) → pilih file. Aplikasi hanya mendapat akses ke file yang dipilih.
- **Fakta = isi Drive dan catatan yang Anda tulis sendiri.** Dokumen buatan agen tetap berstatus *draf* sampai Anda setujui di **Butuh kamu**.

## 5. Banyak pengguna (A, B, C)
- **Satu** project dan **satu** client ID milik Anda. Pengguna lain tidak perlu membuat apa pun: mereka cukup klik "Login dengan Google", lalu centang izin.
- Setiap pengguna punya refresh token sendiri, disimpan terenkripsi di server, dan **folder `RAIVERSE/` di Drive-nya sendiri**.
- Fakta perusahaan dibaca dari Drive Owner. Anggota tim bisa membacanya lewat agen, tetapi tidak bisa mengubahnya kecuali Owner membagikan folder itu.
- Peran:
  - **owner**: semua akses
  - **member**: data internal dan miliknya sendiri
  - **guest**: hanya agen publik

## 6. Cara pakai (sudah dibangun)
1. Restart server (`npm start`), lalu buka **http://localhost:4400**. Pakai `localhost`, bukan `127.0.0.1`, supaya cocok dengan redirect URI.
2. Buka **Pengaturan → 🔐 Akun & Google Drive**, lalu klik **Login dengan Google**. **Orang pertama yang login menjadi Owner.** Sejak saat itu kantor hanya bisa dibuka setelah login.
3. Klik **📁 Siapkan folder**. Folder `RAIVERSE/` dengan isi Perusahaan, Publik, Pribadi, dan Hasil Agen dibuat di Drive Anda.
4. Isi data asli langsung di Drive, sebagai Google Docs atau Sheets di folder yang sesuai, lalu klik **⬇ Ambil dari Drive**. Isinya masuk ke Brain sebagai fakta terverifikasi. Sheet otomatis menjadi tabel.
5. File Drive yang sudah ada: klik **📎 Pilih file dari Drive** (Google Picker).
6. **⬆ Kirim Brain ke Drive**: catatan Anda dan SOP masuk sebagai Google Docs; draf agen masuk ke folder Hasil Agen.
7. Anggota tim:
   - Undang email mereka di **Siapa yang boleh masuk**, lalu minta mereka login.
   - Orang yang login tanpa undangan berstatus **Menunggu** sampai Anda ubah menjadi **Anggota**.
   - Setiap anggota mendapat asisten pribadi (PA) dan folder `RAIVERSE/` di Drive-nya sendiri.
8. Darurat (misalnya akun Owner terkunci): tambahkan `AUTH_DISABLED=1` di `.env` lalu restart. Login dimatikan sementara.

Batasan versi ini:
- Pesan dan catatan masih terlihat oleh semua anggota yang sudah login. Agen tidak membaca catatan Pribadi, tetapi tampilan per orang belum dipisah.
- Sinkronisasi Drive berjalan saat tombol ditekan, belum otomatis berkala.

## 7. Urutan pengerjaan berikutnya (di aplikasi)
1. Login Google (OpenID Connect) dengan sesi cookie dan peran owner/member/guest. Semua API dikunci untuk yang belum login.
2. Hubungkan Drive: buat struktur folder, sinkronisasi dua arah Brain ↔ Docs/Sheets (judul = judul catatan), dan tombol Picker.
3. Penegakan tingkat akses Publik/Internal/Pribadi di setiap pencarian Brain dan setiap agen.
4. Kalender dan Slides (scope tambahan, diminta saat dipakai).

Yang perlu Anda lakukan sekarang:
- Bagian 0 (reset secret, isi `.env`)
- Bagian 2 (rapikan scope)
- Bagian 3 (tambah redirect URI yang lengkap)
