# RAIVERSE — ikon menu emas

20 ikon untuk menu utama dan kontrol Kantor 3D, mengikuti referensi ikon Ray Social Army: siluet emas hangat, gradasi diagonal lembut, aksen putih kecil. Dibuat sebagai SVG agar tepinya bersih dan ukuran dapat diubah; tidak menggunakan hasil generasi raster AI.

## Isi

- `PREVIEW-SEMUA-IKON.png`: lembar seluruh ikon.
- `PREVIEW-PENEMPATAN-MENU.png`: contoh penempatan pada sidebar dan kontrol kantor. Ini ilustrasi penempatan, bukan tangkapan layar aplikasi aktif.
- `svg/`: 20 SVG dengan aksen putih, viewBox 128 × 128.
- `svg-compact/`: 20 SVG tanpa aksen putih, untuk ukuran kecil atau tampilan yang lebih tenang.
- `png-512/`, `png-128/`, `png-64/`, `png-32/`: PNG transparan.
- `manifest.json`: pemetaan nama ikon ke fungsi menu.

## Pemakaian

Ikon 01–11 mengikuti menu pada screenshot pertama. Ikon 12–20 melengkapi kontrol kantor. Pengaturan dipakai bersama pada kedua menu, sehingga ada 20 bentuk unik untuk 21 posisi.

Untuk sidebar dan menu, gunakan ukuran kotak 28–32 px agar aksen dan siluet tidak terlalu kecil. Pada 18–24 px gunakan versi compact. Label menu tetap berupa teks aplikasi, tidak disatukan dengan gambar. Ikon dekoratif dalam tombol sebaiknya `aria-hidden="true"` sementara tombol mempunyai label yang jelas.

Warna: emas muda #FBE6AF, emas tengah #DCC08D, perunggu hangat #AF8B70; aksen putih #FFFFFF ke #CFD7DF. Tidak memakai merah. Dirancang terutama untuk latar navy/gelap; kontras pada latar terang perlu ditinjau sebelum dipasang.

## Review

Kedua preview diperiksa secara visual. Semua bentuk disesuaikan dengan makna menu; variasi siluet disengaja agar aplikasi, kantor, pustaka, dan pekerjaan mudah dibedakan. Versi PNG memiliki latar transparan. Keterbacaan dalam aplikasi sebenarnya, mode terang, state aktif/disabled, dan perangkat mobile belum diuji. Tidak ada file frontend atau visual-lock.json yang diubah untuk membuat paket ini. Website dan perilaku 3D belum diubah.

Pemeriksaan project: 109 penjaga V4.2 lulus sebelum dan sesudah. npm test dijalankan tetapi tertahan visual lock karena perubahan frontend yang sudah ada (identity.css, app.js, icons.js, views.js). Tes unit dalam rangkaian itu belum berjalan. Paket ini hanya menambahkan artifacts.

