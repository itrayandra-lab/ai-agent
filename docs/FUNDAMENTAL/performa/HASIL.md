# Hasil optimasi performa pemuatan

Tanggal 2026-11-19. Cara ukur dan kondisi sama dengan `BASELINE.md` (Chrome headless + GPU, port 4551, data salinan, tanpa kunci AI). Skrip: `scripts/ukur-performa.mjs <port> [#hash] [lebar] [tinggi]`, `scripts/resumo-performa.mjs berkas.json`, `scripts/ukur-sumber.mjs <port>` (air terjun permintaan). Mesin dipakai sesi lain sehingga waktu absolut bergoyang; yang dapat dipercaya: byte, jumlah permintaan, dan kisaran waktu dari beberapa kali jalan. Dua kali jalan terganggu beban berat (UI 2,5 s dan 19 s) dan dicatat sebagai pencilan.

## Sebelum dan sesudah (desktop 1440x900, rute #office)

| Ukuran | Sebelum | Sesudah | Perubahan |
|---|---|---|---|
| UI pertama berisi, dingin | 2,4-2,8 s | **0,6-1,0 s** (2,5 s saat mesin dibebani) | ±-65% |
| UI pertama berisi, hangat | 1,8-3,2 s | 0,8-1,2 s | ±-60% |
| First Contentful Paint, dingin | 2,3-2,6 s | 0,6-1,3 s (kerangka "Memuat RAIVERSE…" tampil seketika) | ±-60% |
| Kantor 3D tampil, dingin | 13,4-18,7 s | **8,8-12,1 s** | ±-35% |
| Kantor 3D tampil, hangat | 12,7-14,0 s | **5,2-6,0 s** | ±-58% |
| Transfer, dingin | 34,1 MB | **13,3 MB** (11,2 MB di antaranya GLB karakter, tak boleh disentuh) | -61% |
| Transfer, hangat | 31,7 MB | **1,4 MB** (304 + cache) | -96% |
| JS terkirim, dingin | 3,5 MB | 0,76 MB (brotli) | -78% |
| `/api/state` di kabel | 9,56 MB, 2x per muat | **1,34 MB, 1x per muat** | -86% per unduhan, -93% total |
| Tugas panjang terpanjang, dingin | 7,2-10,2 s | 6,6-8,3 s (sisanya kompilasi shader, lihat bawah) | ±-20% |
| FPS saat diam | 79-95 | 98-141 | tidak turun |
| Jumlah permintaan | 143 | 140 | sama |

HP (viewport 390x844, emulasi, hanya SESUDAH): UI berisi 1,1 s dingin / 0,7 s hangat, 3D tampil 7,8 s / 4,7 s, transfer 13,3 MB / 1,4 MB. Tidak ada baseline HP "sebelum" dan ini emulasi di PC, bukan ponsel sungguhan.

## Teknik yang dipakai

**Server** (`server/http-perf.js`, dipasang di `server/index.js` secara bedah)
- Brotli/gzip untuk statis (di-cache terkompresi di memori, sekali per versi berkas) dan JSON (brotli mutu 4 untuk dinamis; hasil terkompresi terakhir di-cache per ETag).
- `ETag` + `304` untuk statis dan GET JSON besar. Kode aplikasi (`.js/.css/.html`) `no-cache` + ETag (edit langsung terlihat, revalidasi hanya 304); aset berversi `?v=` (GLB, wajah) `immutable` setahun; aset lain 10 menit; vendor 1 hari.
- `keepAliveTimeout` 65 s (sambungan dipakai ulang).

**Klien**
- Jalur muat awal bebas Three.js: `views.js` tidak lagi mengimpor `assets3d` / `appearance-ui` / `karakter-view` secara statis (impor mati dibuang; editor Karakter dan editor tampilan di Studio dimuat dinamis saat dibuka). Dijaga tes.
- `index.html`: kerangka "Memuat RAIVERSE…" seketika; font Google tak lagi memblokir render; `modulepreload` untuk seluruh rantai modul UI (air terjun 3 gelombang jadi 1); `js/boot-awal.js` memulai unduhan `/api/state` sebelum modul jalan dan (hanya layar lebar yang membuka #office) memulai unduhan Three.js dan modul 3D sejajar dengan UI.
- Sambungan SSE pertama tidak lagi mengunduh ulang seluruh state (hanya sambungan ulang).
- `office3d.js`: satu baris `renderer.compileAsync` sebelum bingkai pertama (bila peramban mendukung kompilasi paralel, utas utama tidak terkunci; bila tidak, perilaku lama).

**Tidak diubah** (sesuai aturan): aset GLB, kecepatan jalan/animasi/geometri/kamera, proporsi karakter. `verify-v42`: 109 lolos, 0 masalah sebelum dan sesudah.

## Yang BELUM selesai, dan batasnya

1. **Kompilasi shader ±7 s di utas utama saat 3D pertama tampil** (68 program). `compileAsync` tidak memberi gain terukur di Chrome headless ini (tetap memblokir ±7 s); di GPU asli Owner mungkin berbeda, belum dibuktikan. Percobaan `checkShaderErrors=false` justru memperburuk (blok 7 s jadi 11,9 s) dan dibatalkan. Jalan keluar nyata: kurangi jumlah program (satukan material, hindari `onBeforeCompile` per material, tunda PMREM). Itu menyentuh tampilan 3D, jadi perlu sesi 3D/keputusan Owner.
2. **`/api/state` masih 9,56 MB mentah (1,34 MB di kabel)**; server tetap membayar stringify + brotli ±0,3-0,6 s per unduhan. Pemangkasan sungguhan butuh perubahan model data: `skillRefs` 3,0 MB (ganti "semua skill" dengan flag), `log` / `output` tugas dan isi catatan dimuat saat detail dibuka. Tidak dilakukan karena memotong field yang dipakai klien penyunting (Studio, Catatan) berisiko menimpa data dengan kosong.
3. Belum dikerjakan: virtualisasi daftar (Hasil Saya, Catatan, Tim Saya, riwayat), debounce pencarian, pembaruan sebagian pada event SSE, pemecahan `views.js` (234 KB, 63 KB brotli) per halaman, service worker/Cache Storage untuk GLB (cache HTTP `immutable` sudah menutup kebutuhan ulang), mode HP tanpa 3D (rute #office di HP tetap memuat 3D penuh; butuh keputusan produk).
4. FPS dan tugas panjang di GPU asli Owner dan di ponsel sungguhan belum diukur.

## Anggaran performa dan penjagaannya

| Anggaran | Target | Terukur |
|---|---|---|
| UI interaktif (jaringan lokal) | < 1,5 s | 0,6-1,0 s: lolos (2,5 s hanya saat mesin dibebani) |
| Kantor 3D tampil | < 4 s | **8,8-12 s dingin, 5-6 s hangat: BELUM lolos** (kompilasi shader) |
| Tugas panjang > 100 ms saat idle | tidak ada | lolos setelah 3D tampil; tugas panjang hanya saat muat awal |
| FPS idle | stabil | 98-141 |
| Transfer hangat | < 2 MB | 1,4 MB |

Tes penjaga `test/performa.test.js` (ikut `npm test`): kompresi br/gzip mengecil dengan isi identik; 304 pada ETag cocok; `?v=` immutable; JSON besar terkompresi, kecil tidak; **jalur impor statis dari `app.js` tidak boleh memuat `three`, `assets3d`, `office3d`, `environment`, `furniture`, `karakter-view` dan maksimal 60 modul**; `index.html` tanpa font pemblokir, ada kerangka, `boot-awal.js`, dan modulepreload; sambungan SSE pertama tidak mengunduh ulang state. Waktu (UI/3D) tidak dijadikan tes otomatis karena goyah di mesin bersama; jalankan `UJI_GPU=1 node scripts/ukur-performa.mjs <port>` secara manual.

## Perlu tindakan Owner

Server 4400 belum dimuat ulang: kompresi dan cache baru aktif setelah server dijalankan ulang, lalu Ctrl+F5.
