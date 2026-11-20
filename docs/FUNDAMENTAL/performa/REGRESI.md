# Regresi: komputer lag saat localhost:4400 dibuka

Tanggal 2026-11-20. Laporan Owner: begitu 4400 dibuka, seluruh komputer berat.

## Kejujuran dulu: penyebab tunggal BELUM terbukti

Ukuran di mesin ini (Chrome headless ber-GPU, server uji 4551, mesin sedang dipakai aplikasi lain) tidak menunjuk satu penyebab dengan angka bersih:
- Beban GPU 3D seluruh mesin tanpa halaman uji sudah 52-63% (browser lain, `dwm` 28%, streaming `sunshine`). Penghitung GPU juga sering gagal (NaN). Selisih antar-kondisi (6 poin: 83% vs 77%) ada dalam derau.
- Profil CPU saat mode Hemat: utas utama 47% idle, jadi pembatasnya GPU/driver, bukan JavaScript.
- Scene itu sendiri berat: **400 ribu sampai 1 juta segitiga dan 340-760 draw call per bingkai** (171 karakter, tiap bingkai), dan 68 program shader. Ini sudah demikian sebelum hari ini; pelaku utama beban GPU menurut data adalah isi scene, bukan satu perubahan hari ini.
- Perubahan hari ini yang menambah beban: (a) suasana ambien (kecil: ≤6 agen berjalan), (b) tidak ada yang menaikkan resolusi atau FPS; `office3d.js` hanya berubah ±50 baris sejak checkpoint 2994971. Sebaliknya blur kaca adalah gaya yang sudah ada (±62 elemen dengan `backdrop-filter` aktif di halaman Kantor, termasuk SETIAP `.btn` dan panel besar `.lpage` yang sudah 88-92% buram dengan blur 30 px), dan menumpuk di atas kanvas yang terus digambar.

Yang bisa dipastikan hanya beban relatif dan tindakan berikut. Konfirmasi final harus dari mesin Owner (lihat bagian terakhir).

## Yang diubah

1. **Blur**: `public/css/hemat.css` (dimuat terakhir): `.lpage` dan semua `.btn` TIDAK lagi memburamkan latar (tanpa beda tampilan karena sudah hampir buram / kecil). Luas area terblur di halaman Kantor turun dari 127-300 ribu px (kaca lama) menjadi 111 ribu px, dan 0 di mode Hemat. Elemen aktif terlihat: dari ±62 menjadi 3.
2. **Mode Hemat** (Otomatis / Tinggi / Hemat; sakelar "Kualitas" di Pengaturan > Tampilan, bawaan Otomatis): tanpa blur kaca sama sekali (latar semi-solid), suasana ambien mati, DPR 1, maksimum 30 FPS, dan memakai jalur `eco` yang sudah ada (geometri digabung, tanpa bayangan dan pasca-proses, lebih sedikit pejalan).
   - **Otomatis** menyalakan Hemat bila: perangkat lemah (deteksi lama `weakDevice`), HP, atau waktu bingkai rata-rata > 40 ms selama 4 detik berturut-turut saat dipakai aktif (setelah itu tersimpan 7 hari). **Tinggi** tidak pernah hemat. **Hemat** selalu.
3. **Suasana ambien**: bawaan sekarang **Ringan** (bukan Penuh) di mesin mana pun; **mati** otomatis bila mode Hemat aktif atau waktu bingkai rata-rata > 22,5 ms, tab tersembunyi, atau panel penuh.
4. **Jendela tak fokus** (aplikasi lain di depan, tab terbuka di belakang): kantor digambar paling banyak 10 FPS.
5. **Proses sisa uji**: `scripts/lib/chrome-cdp.mjs` memakai `proc.kill()` yang di Windows hanya mematikan proses induk Chrome dan meninggalkan proses GPU/renderer. Penyebab sisa "8 Chrome headless". Kini `taskkill /T /F` mematikan seluruh pohon proses. Tes `ui-tata-letak` sudah membersihkan di `after()`. Yang tersisa di mesin saat diperiksa: 0 proses uji milik sesi ini; server 4310 adalah preview proyek lain (`ray-content-os`), bukan milik repo ini, tidak disentuh; Chrome headless lain milik `chrome-devtools-mcp`.

## Yang BELUM / tidak terbukti
- Seberapa besar blur memberi beban GPU di mesin Owner: tidak terukur bersih di sini.
- Scene 400k-1 juta segitiga tetap menjadi beban GPU terbesar. Pengurangan nyata (LOD agresif untuk 171 karakter, instancing karakter jauh, kurangi program shader) menyentuh tampilan 3D dan aset; butuh sesi 3D dan keputusan Owner.
- Kompilasi ulang shader terus terjadi di kondisi tunak (`getProgramInfoLog` 0,8 s per 10 s di profil), belum dicari sumbernya.
- Mode Hemat belum dinilai mata Owner (apakah kantor masih enak dilihat tanpa bayangan).

## Cara Owner memastikan
1. Muat ulang server 4400, Ctrl+F5.
2. Pengaturan > Tampilan > Kualitas: pilih **Hemat**, buka Manajer Tugas > Kinerja > GPU, bandingkan dengan **Tinggi**.
3. Bila Hemat sudah membuat komputer ringan, Otomatis seharusnya memilih Hemat sendiri pada mesin itu; bila tidak, laporkan agar ambang (40 ms / 4 detik) diturunkan.

## Alat ukur
`UJI_GPU=1 node scripts/ukur-beban.mjs <port>` (FPS, draw call, segitiga, blur aktif per kualitas), `scripts/ukur-blur.mjs` (area blur lama/kini/hemat dalam satu sesi), `scripts/gpu-sampel.ps1` (GPU 3D seluruh mesin; sering NaN). Semua menutup Chrome di `finally`.
