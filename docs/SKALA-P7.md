# Kesiapan skala publik (P7)

Status: dibangun dan teruji pada salinan terisolasi, 2026-11-18. **Bawaan tetap `json` (perilaku lama).** Tidak ada data asli di `data/` yang disentuh dan belum ada ruang kerja Owner yang dipindah. Rencana induk: `docs/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md` (temuan 6, fase P7).

## 1. Angka (Node 26.12, Windows, satu proses; ruang kerja sintetis ±0,7 MB: 100 tugas, 600 pesan, 300 peristiwa; API key AI kosong)

Skrip: `npm run bench:scale -- --n 1000 --mode json|dual|sqlite [--lazy]`.

| Ukuran | Keadaan | Boot | Memori (RSS) | Simpan 1 ruang kerja (median) | Tick, satu lintasan |
|---|---|---|---|---|---|
| 200 | sebelum (json) | 5,5 dtk | 511 MB | 5,3 ms | 6 ms |
| 200 | sesudah (sqlite + malas) | 0,15 dtk | 91 MB di boot, 448 MB setelah semua pernah disentuh sekali | 6,4 ms | 2 ms |
| 1000 | sebelum (json) | **23,5 dtk** | **2.001 MB** | 4,4 ms | 16 ms |
| 1000 | sesudah (sqlite + malas) | **0,39 dtk** | **100 MB** di boot, ±500 MB setelah warmup; hanya 21 ruang kerja tertinggal di memori | 15,5 ms* | 2 ms |
| 1000 | dual (json + sqlite) | 33,2 dtk | 1.687 MB | 5,0 ms | 3 ms |

\* Di mode malas angka simpan memuat ruang kerja dari disk dulu; untuk simpan murni lihat 6,4 ms pada 200.
Ruang kerja berat (±3,4 MB JSON: 1.500 tugas, 3.000 pesan, 600 peristiwa, n=30): simpan json 11,2 ms, sqlite 9,3 ms.

**Temuan jujur:**
- Simpan satu ruang kerja **tidak lebih cepat** untuk ruang kerja kecil (JSON 4–5 ms, SQLite 6–10 ms): tiap simpan masih membuat teks tiap dokumen untuk dibandingkan. Keuntungan SQLite: hanya baris yang berubah ditulis ke disk (satu pesan baru = satu baris), jurnal WAL tahan mati mendadak, dan bisa dibaca per ruang kerja tanpa memuat semuanya.
- Kemenangan besar ada di **boot dan memori** (pemuatan malas + pelepasan ruang kerja idle), bukan di waktu simpan.
- Tick sudah murah di uji ini (ruang kerja baru tanpa rutinitas). Beban sebenarnya muncul bila banyak ruang kerja punya rutinitas aktif; itu tidak diukur.
- Ruang kerja berat di mode sqlite boot lebih lambat (5,8 dtk vs 1,1 dtk, n=30, semua dimuat) karena membaca ribuan baris dan sisa jurnal WAL dari proses yang tidak ditutup rapi. Tidak penting bila malas menyala, tetapi belum dioptimalkan.
- Disk lebih besar: SQLite 1,25 GB vs JSON 0,68 GB untuk 1000 ruang kerja (indeks + WAL belum dipadatkan).
- Angka "semua ruang kerja berubah sekaligus" tidak dilaporkan: di mode malas ia memuat 1000 berkas dan tidak sebanding.

## 2. Yang dibangun

- `server/store-sqlite.js`: satu berkas `.sqlite` per ruang kerja (`node:sqlite` bawaan, **tanpa paket baru**). Koleksi berupa larik ber-`id` = satu baris per dokumen; sisanya (settings, company, ...) di tabel kv. Simpan = tulis selisih dalam satu transaksi; urutan larik terjaga.
- Bendera per ruang kerja di `data/storage-flags.json` (`{ default, lazy, ws: { id: mode } }`), atau env `STORAGE_MODE`, `STORE_LAZY=1`:
  - `json`: lama. `dual`: JSON tetap sumber kebenaran, SQLite ditulis berdampingan; **pembanding otomatis** membaca ulang keduanya dan membandingkan hash per kunci pada simpan pertama lalu tiap 50 simpan (`STORE_VERIFY_EVERY`); hasil di `store.storageStats()`. SQLite gagal di mode dual hanya dicatat; JSON tetap tersimpan. `sqlite`: cutover; `db.json` tidak ditulis lagi; berkas SQLite rusak = galat, tidak pernah membuat data baru.
- `scripts/storage-migrate.mjs` (`npm run storage:migrate -- status|migrate|verify|cutover|rollback [--ws id]`): cadangan penuh otomatis (`makeBackup`, sekarang memuat `.sqlite` lewat `VACUUM INTO` dan melewati SQLite rusak tanpa menggagalkan cadangan JSON), dapat diulang (migrasi kedua = 0 baris), cocok dulu baru bendera berubah. **Rollback** = sqlite → `db.json` (db.json lama disalin ke `.bak-pra-rollback-*`) lalu bendera `json`. Sebelum cutover, JSON selalu masih benar.
- Pemuatan malas + pelepasan memori (`STORE_LAZY=1`): ruang kerja baru dibaca saat dipakai; yang idle >10 menit (`STORE_IDLE_MS`) dan tidak sibuk disimpan lalu dilepas. Pengait `store.onLoad` menjalankan pemasangan skill saat dimuat.
- Tick hanya untuk ruang kerja aktif (`engine._passOnce`): ada tugas terbuka/rapat/job, atau baru dipakai orang (60 dtk), atau utama. Yang tidur dilewati sampai `wakeAt` (rutinitas atau persetujuan berbatas waktu terdekat); warmup bertahap 25 per lintasan.
- Retensi: `store.capCollections` memangkas events (600), messages (3000), dan log tiap tugas (300) pada setiap simpan, juga untuk jalur yang menambah langsung. Retensi berbasis hari tetap di `privacy.js`.
- Indeks sesi: `auth.sessionUser` dan `userById` memakai Map (bukan menyisir larik).
- Anggaran global (`limits.spentToday`) membaca biaya dari catatan tanpa memuat ruang kerja yang dilepas.
- Tes: `test/storage-p7.test.js` (11 tes: selisih, urutan, dual + deteksi rusak, SQLite rusak, cutover, isolasi, migrasi/rollback, cadangan, retensi, malas, tick aktif). Seluruh suite: 217 lulus, 0 gagal. Mascot 109/0, visual-lock tidak diubah.

## 3. Cara memakai (urutan aman)

1. `npm run data:backup`, lalu `npm run storage:migrate -- migrate --ws <id>` (mode dual) pada satu ruang kerja uji. Jalankan server, pantau `storageStats().mismatches` = 0 beberapa hari.
2. `... cutover --ws <id>` bila cocok. Salah satu gejala aneh: `... rollback --ws <id>`.
3. Terakhir nyalakan `"lazy": true` dan `default` di `storage-flags.json`. Server harus dimulai ulang; hentikan server sebelum menjalankan skrip.

## 4. Yang BELUM siap untuk rilis publik

1. **Belum diuji di ruang kerja asli Owner** (data utama 7 MB, 171 karyawan) maupun lewat peramban; hanya data sintetis dan satu boot server uji.
2. **Satu proses, satu mesin.** SQLite per berkas bukan basis data multi-server; skala horizontal tetap butuh Postgres atau sejenisnya.
3. Simpan masih membuat teks seluruh dokumen tiap kali; ruang kerja sangat besar tetap membayar CPU. Perlu penanda "kotor" per dokumen.
4. Pelepasan memori mengandaikan tidak ada kode yang menyimpan rujukan `db` lintas tick di ruang kerja idle; busy-flag melindungi tugas/rapat/job, tetapi pemanggil asinkron lain (n8n, peramban) belum diuji dengan pelepasan. Karena itu malas **mati** bawaan.
5. Anggaran global di mode malas hanya tahu biaya ruang kerja yang sudah dimuat sejak boot (menghitung kurang selama warmup).
6. `auth.json` dan `otomasi.json` masih satu berkas JSON; belum dipindah. Kunci rahasia dan kuota berada di luar lingkup ini.
7. Retensi berbasis hari tetap mati bawaan; tugas selesai tidak dipangkas (hubungan induk-anak).
8. WAL belum dipadatkan berkala (disk lebih besar) dan boot ruang kerja berat tanpa malas lebih lambat.
9. Syarat hukum/privasi (data anak, UU PDP) di `docs/KEAMANAN-P3.md` bagian 7 tidak berubah.
