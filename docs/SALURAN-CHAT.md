# Saluran chat: Telegram dan Discord

Status: dibangun 2026-11-18, **diuji hanya dengan server tiruan**. Uji nyata butuh token bot asli milik Owner (lihat bagian "Yang belum diuji").
Menggantikan rencana WhatsApp (WAHA tidak ada dan tidak dipakai).

## Yang didapat pengguna

1. Di aplikasi: **Pengaturan > Sambungan > Hubungkan Telegram** (atau Discord). Muncul kode 8 karakter, berlaku 10 menit, sekali pakai.
2. Kirim kode itu ke bot (Telegram: `/start KODE` atau cukup kodenya; Discord: DM berisi kodenya).
3. Selesai. Chat itu kini terhubung ke **ruang kerja dan pengguna** yang membuat kode. Pemandu membalas dengan teks dan tombol (Telegram: inline keyboard, Discord: tombol komponen). Hasil panjang dikirim sebagai berkas `hasil.txt`.
4. `/putus` (atau tombol Putuskan di aplikasi) menghapus ikatan. `/baru` memulai percakapan baru. `/bantuan` menampilkan bantuan.

Pengguna yang belum tertaut hanya mendapat petunjuk menautkan, tanpa data apa pun. Grup dan kanal ditolak dengan sopan (bot keluar dari grup Telegram). Pesan bot lain diabaikan. Lampiran (foto, suara) belum dibaca; bot menjawab "aku baru bisa membaca tulisan".

## Jaminan isolasi

- Identitas pengguna **hanya** dari ikatan di server (`data/channels.json`) dan keanggotaan akun saat pesan datang (`auth.memberOf`). Isi pesan tidak pernah menentukan siapa penggunanya (pola yang sama dengan `b.userId` yang ditimpa dari sesi di `server/index.js`).
- Giliran Pemandu dijalankan di `store.run(ruangKerjaTerikat, ...)` sebagai karyawan milik ikatan itu. Sesi Pemandu: `ch-<t|d>-<hash(layanan:id obrolan)>`, unik per (layanan, obrolan) dan per pengguna di ruangnya.
- Satu akun luar hanya bisa terikat ke **satu** ruang kerja pada satu waktu (kode kedua ditolak: "sudah terhubung ke ruang kerja lain"). Satu pengguna aplikasi memegang satu ikatan per layanan (menautkan akun luar baru melepas yang lama).
- Teks masuk adalah data: dioper sebagai `input`, bukan perintah. **Tombol** hanya diterima bila ada di daftar tombol balasan terakhir obrolan itu (nomor urut + indeks); data tombol palsu atau basi dijawab "tombol sudah lewat". Mengetik `oto:on` bukan menekan "Ya, nyalakan".
- Aksi berdampak keluar tetap berhenti di kartu konfirmasi Pemandu (pratinjau + Ya, nyalakan / Ubah / Batal). Penghubung tidak pernah menekan tombol sendiri.
- Hanya Owner/Admin ruang kerja yang boleh memasang otomasi lewat chat (`canAutomate` dihitung dari peran, sama seperti `index.js`).
- Ikatan dihitung ulang tiap pesan: akun dihapus, dikeluarkan dari ruang kerja, atau **ditangguhkan** (`auth.setSuspended`) langsung berlaku. Dikeluarkan atau dihapus = ikatan dilepas; ditangguhkan = ditolak sementara. Pengelola juga bisa memblokir satu akun luar (`admin.setBlocked`).

## Kuota dan batas

Memakai `server/limits.js`, semua angka bisa diatur lewat env:

| Env | Bawaan | Arti |
|---|---|---|
| `CHANNEL_RATE_PER_MIN` | 12 | pesan per menit per akun luar (peringatan ramah sekali, sisanya diam) |
| `CHANNEL_WS_RATE_PER_MIN` | 60 | per ruang kerja |
| `CHANNEL_CODE_TRIES` | 8 per 10 menit | percobaan kode per akun luar |
| `CHANNEL_CODES_PER_HOUR` | 6 | pembuatan kode per pengguna per layanan |
| `QUOTA_MESSAGE_DAY` | 400 | kuota harian "pesan" milik akun (sama dengan pemakaian di aplikasi) |
| `CHANNEL_POLL_MS` / `CHANNEL_POLL_MAX` | 4000 / 150 | cek hasil pekerjaan yang berjalan |

Anggaran AI global (`limits.assertGlobalBudget`) ikut berlaku; pesan 429 yang ramah dikirim sebagai teks.

## Keamanan

- Token bot milik **platform** (satu bot per layanan), disimpan terenkripsi (`secure.seal`, konteks `channel-token`) di `data/channels.json` (mode 0600). Tidak pernah dikembalikan utuh: hanya `••••abcd`.
- Semua log lewat `scrub()` (token hilang dari pesan galat, URL, header). Tes memeriksa log.
- Kode tautan: hanya hash HMAC yang disimpan (kunci turunan `secure.derive`), perbandingan waktu-konstan, kedaluwarsa 10 menit, sekali pakai.
- Telegram: offset disimpan **sebelum** pesan diproses, ditambah penanda id pesan yang sudah diproses (`seen`). Artinya paling banyak sekali; bila server mati tepat setelah menerima tetapi sebelum membalas, pesan itu tidak dibalas (pengguna cukup mengirim ulang). Tidak ada pesan ganda.
- Discord: sambung ulang dengan resume, detak jantung dipantau (tidak dibalas = sambung ulang), kode penutupan fatal (token salah, intent tidak sah) menghentikan penghubung dengan pesan jelas. `allowed_mentions: parse []` supaya isi dari luar tidak bisa menyebut siapa pun.
- Hanya teks yang dikirim sebagai lampiran (`.txt`, maksimum 256 KB).

## Berkas

- `server/channels/state.js` penyimpanan dan `scrub`
- `server/channels/core.js` penautan, sesi, kuota, penyusun balasan, jembatan ke `pemandu.turn`
- `server/channels/telegram.js` long polling `getUpdates` (webhook bila `RAIVERSE_PUBLIC_URL` berawalan `https://`; rahasia webhook dibuat otomatis, dicek di header `X-Telegram-Bot-Api-Secret-Token`)
- `server/channels/discord.js` Gateway WebSocket minimal memakai `WebSocket` bawaan Node 26 (tanpa paket baru) + REST untuk membalas
- `server/channels/admin-api.js` fungsi konsol admin; `server/channels/index.js` rute dan `start()`
- `public/js/sambungan-view.js` kartu pengguna
- `test/channels.test.js` dan `test/fixtures/mock-chat.mjs` (server Telegram/Discord tiruan, termasuk server WebSocket)

Titik sambung di berkas bersama (masing-masing satu baris): `server/index.js` (impor, `channels.start()`, loop rute, penangan webhook), `server/n8n.js` (`deliver` meneruskan kabar ke saluran tertaut).

## Titik sambung untuk sesi konsol admin (jangan diubah dari sini)

Rute (hanya pemilik platform; selain itu 403), semuanya JSON:

| Rute | Fungsi |
|---|---|
| `GET /api/saluran/admin/status` | `{ services: { telegram|discord: { configured, tokenMask, online, mode, bot, error, links, blocked } }, codesActive, publicUrl }` |
| `POST /api/saluran/admin/token` `{service, token}` | cek format, uji ke layanan, simpan terenkripsi, nyalakan |
| `POST /api/saluran/admin/test` `{service, token?}` | uji koneksi (tanpa `token`: uji yang tersimpan; dengan `token`: uji tanpa menyimpan) |
| `POST /api/saluran/admin/remove` `{service}` | hapus token dan matikan |
| `GET /api/saluran/admin/links?service=` | daftar ikatan (id akun luar disamarkan, ada `ref`) |
| `POST /api/saluran/admin/block` `{ref, blocked}` / `POST /api/saluran/admin/unlink` `{ref}` | blokir atau lepas akun luar |

Atau panggil langsung `import { admin } from '../channels/index.js'` (`status, setToken, testConnection, removeToken, listLinks, setBlocked, unlinkAccount`). Penangguhan akun memakai `auth.setSuspended` yang sudah ada dan otomatis dihormati.

## Titik sambung kartu "Sambungan" di Pengaturan

`public/js/pengaturan-view.js` (milik sesi lain) masih punya kartu "WhatsApp" di fungsi `sambungan()`. Gantikan dengan:

```js
import { pasangSambungan } from './sambungan-view.js';
// di dalam sambungan(me, cfg), setelah box.innerHTML = ... (hapus bagian <h4>WhatsApp</h4>):
const wadah = document.createElement('div'); box.appendChild(wadah);
this.bersihSambungan = pasangSambungan(wadah);   // panggil this.bersihSambungan?.() di unmount()
```

Rute pengguna (cukup masuk): `GET /api/saluran`, `POST /api/saluran/link {service}`, `POST /api/saluran/unlink {service}`.

## Cara Owner menyiapkan bot (langkah awam)

**Telegram (sekitar 2 menit)**
1. Buka Telegram, cari akun `@BotFather` (centang biru), tekan Start.
2. Ketik `/newbot`, beri nama (mis. RAIVERSE) lalu nama pengguna yang berakhiran `bot` (mis. `raiverse_saya_bot`).
3. BotFather mengirim sebuah kode panjang berbentuk `angka:huruf`. Salin. **Jangan dibagikan ke siapa pun.**
4. Konsol admin > Saluran > Telegram > tempel kode > Simpan dan uji. Status harus "online" dan nama bot tampil.

**Discord (sekitar 5 menit)**
1. Buka discord.com/developers/applications > New Application > beri nama.
2. Menu **Bot**: tekan Reset Token, salin kodenya (tampil sekali; jangan dibagikan).
3. Di halaman Bot tidak ada intent istimewa yang wajib: pesan pribadi (DM) terbaca tanpa Message Content Intent. Jangan matikan bot publik bila pengguna lain perlu menambahkannya.
4. Agar orang bisa mengirim DM ke bot, Discord mensyaratkan mereka berbagi server dengan bot **atau** bot dipasang sebagai aplikasi pengguna. Cara paling mudah: buat satu server kecil "RAIVERSE", menu **OAuth2 > URL Generator**, centang `bot` (tanpa izin apa pun), buka tautannya untuk memasukkan bot ke server itu, lalu undang pengguna ke server tersebut. Alternatif: menu **Installation** > aktifkan *User Install* supaya pengguna bisa menambahkan bot ke akunnya.
5. Konsol admin > Saluran > Discord > tempel kode > Simpan dan uji.

Bila `RAIVERSE_PUBLIC_URL` (https) diatur, Telegram otomatis memakai webhook; bila tidak, long polling (tanpa alamat publik). Discord selalu memakai Gateway.

## Pengganti WhatsApp: yang diubah

- `server/n8n.js` `deliver()`: setelah kabar masuk ke DM di aplikasi, kabar yang sama diteruskan ke Telegram/Discord milik pemiliknya bila sudah tertaut (idempoten: hanya saat kabar baru benar-benar terkirim). Belum tertaut = cukup kabar di aplikasi.
- Templat n8n (`server/n8n-templates/common.js`, `index.js`): pilihan "WhatsApp" dihapus dari isian; pilihan "Di sini" kini berbunyi "Di sini (dan Telegram atau Discord bila sudah dihubungkan)". Bila seseorang tetap menyebut WhatsApp, usulan menjawab jujur: "WhatsApp belum tersedia di RAIVERSE. Hubungkan Telegram atau Discord di Pengaturan, atau pilih kabar lewat RAIVERSE." Kode pembuat simpul WhatsApp lama dibiarkan (tidak merusak otomasi yang sudah berjalan).
- `test/n8n.test.js`: dua contoh yang memakai WhatsApp sebagai saluran "siap" diganti ke saluran RAIVERSE.
- Masih menyebut WhatsApp: kartu di `public/js/pengaturan-view.js` (milik sesi konsol admin, lihat titik sambung di atas) dan opsi "Instagram / WhatsApp" pada alur Konten Pemandu (itu tempat pemakai memasang konten, bukan saluran RAIVERSE).

## Yang belum diuji (butuh token asli dari Owner)

Semua tes memakai server tiruan lokal. Belum terbukti pada layanan sungguhan:
- bentuk persis respons Telegram/Discord di edge-case (rate limit asli, `retry_after`, pesan yang sangat panjang, sticker);
- Discord: DM ke bot butuh server bersama atau pemasangan pengguna (lihat langkah 4); perilaku Gateway nyata (resume lintas wilayah, `resume_gateway_url`), batas intent;
- penerusan kabar otomasi ke chat dari mesin n8n sungguhan;
- webhook Telegram lewat alamat publik https sungguhan;
- tampilan kartu Sambungan di dalam layar Pengaturan (belum dipasang; menunggu sesi konsol admin) dan ulasan visual (lihat VISUAL-LOCK.md).
- Pekerjaan Pemandu yang sedang berjalan saat server dimulai ulang: kabar otomatis "hasil siap" hilang (timer di memori); pengguna cukup mengetik apa saja dan hasilnya muncul.

Jangan meminta atau menempel token di chat. Cukup masukkan di konsol admin; sistem tidak pernah mencetaknya.

## Token dari env, bendera nyala/mati, dan uji ujung ke ujung (Telegram `@raiverse_bot`)

**Urutan token:** token yang diisi di konsol admin (terenkripsi) didahulukan; bila kosong, dipakai `TELEGRAM_BOT_TOKEN` (Discord: `DISCORD_BOT_TOKEN`) dari `.env`. Status admin menampilkan `tokenSource` (`konsol` atau `env`) dan topeng `••••abcd`; nilai utuh tidak pernah dicetak atau dicatat.

**Bendera bawaan MATI:** walau token ada, penghubung tidak mengambil pesan (tidak ada `getUpdates` dan tidak ada Gateway) sampai dinyalakan lewat `POST /api/saluran/admin/enable {service, enabled:true}` (`admin.setEnabled`). Tombol "Hubungkan" di aplikasi juga baru tersedia setelah dinyalakan. Alasannya: hanya SATU proses boleh memakai `getUpdates` untuk satu token. Jangan nyalakan di server Owner (4400) bersamaan dengan salinan uji.

**Uji hanya-baca yang sudah dilakukan (2026-11-19):** `getMe` ke `api.telegram.org` dengan token dari env: valid, username `@raiverse_bot` cocok. Tidak ada pesan terkirim dan tidak ada `getUpdates`. (Percobaan pertama sempat "waktu habis" karena jaringan lambat; ulangan berhasil dalam ±1 detik.)

**Langkah uji ujung ke ujung untuk Owner** (pilih satu proses saja yang boleh polling):
1. Pastikan hanya satu server yang berjalan dengan token ini (mis. server Owner, atau salinan uji di port 4611-4619, jangan keduanya).
2. Masuk sebagai pemilik platform, konsol admin > Saluran > Telegram > nyalakan (bendera). Status harus "online", bot `@raiverse_bot`.
3. Di aplikasi: Pengaturan > Sambungan > **Hubungkan Telegram**. Muncul kode 8 karakter.
4. Di Telegram buka `@raiverse_bot`, kirim `/start KODE`. Bot menjawab "Tersambung!" dan menyapa.
5. Ngobrol seperti biasa (mis. "bantu buat konten promo kopi"). Coba juga `/baru`, `/bantuan`, `/putus`.
6. Selesai menguji: matikan bendera bila tidak ingin bot menjawab.

**Memutar token (disarankan):** token sempat tertulis di chat. Di BotFather kirim `/revoke`, pilih `@raiverse_bot`, ambil token baru, isi di konsol admin (atau ganti `TELEGRAM_BOT_TOKEN` di `.env`), lalu mulai ulang. Token lama langsung mati.
