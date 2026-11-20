# Desain ala ChatGPT desktop untuk RAIVERSE

Sumber: tangkapan layar Owner (1920 × ~1000, mode gelap; saya baca langsung `47.png`, sisanya dari deskripsi sesi dokumentasi). Tiap angka ditandai **[diukur]** (dibaca dari piksel tangkapan) atau **[perkiraan]**. Angka diukur pada tangkapan 1920 px; ChatGPT menampilkannya pada skala 100%.

## 1. Struktur
| Bagian | Nilai | Status |
|---|---|---|
| Rel ikon kiri | lebar 52 px, ikon garis 20 px, 5 ikon + "..." + dua ikon di bawah | [diukur] |
| Panel kedua | lebar 238 px (x 52–290), judul halaman 17 px tebal, baris daftar tinggi 48 px, baris terpilih berlatar abu +1 tingkat dan sudut 10 px | [diukur] |
| Bilah atas isi | tinggi ~70 px, judul kecil 13 px dengan tanda panah, ikon aksi di kanan | [diukur] |
| Kolom isi obrolan | lebar baca ~735 px di tengah (x 735–1471) | [diukur] |
| Kolom ketik | pil, tinggi ~40 px, lebar 735 px, sudut penuh, tanda + di kiri, pemilih model dan mik di kanan, tombol kirim bulat biru 26 px | [diukur] |
| Bilah bawah panel kedua | "Getting started 0 of 5" kecil, tinggi 36 px | [diukur] |

## 2. Warna
Gelap: latar isi `#181818` [perkiraan], panel samping `#212121` [perkiraan], baris terpilih `#2f2f2f` [perkiraan], kolom ketik `#2b2b2b`–`#2f2f2f` [perkiraan], teks `#ececec`, redup `#b4b4b4` [perkiraan], tepi putih 9% [perkiraan], aksen biru `#2f6fe0`-ke-`#6b9bff` [perkiraan].
Terang (sepadan, perkiraan): latar `#ffffff`, panel `#f4f4f4`, permukaan `#ececec`, teks `#0d0d0d`, redup `#5d5d5d`, aksen `#1f5fd6`.

## 3. Tipografi
Sans bersih (Inter), tanpa serif. Judul halaman 17 px/600 [diukur]; isi 14–15 px/400 [diukur]; label kecil 12–13 px/500 [diukur]; baris waktu redup 12 px [diukur]. RAIVERSE menaikkan minimum ke 16 px untuk antarmuka awam (aturan Owner), jadi kepadatan sedikit lebih longgar daripada aslinya; area ketuk tetap 48 px.

## 4. Obrolan
Pesan pengguna: gelembung kanan, latar permukaan +1, sudut 18 px [perkiraan]. Balasan: tanpa kotak, teks langsung di kolom baca [diukur]. Di bawah tiap balasan: baris ikon aksi kecil (salin, suka, dengar, bagikan, lainnya) [dari deskripsi]. Langkah kerja berupa chip "Memanggil …" yang bisa dibuka [dari deskripsi].

## 5. Ikon dan lain-lain
Ikon garis 1,75 px, 18–20 px, tanpa emoji [diukur]. Kelompok sidebar terlipat (Pinned, Agents, Projects) [dari deskripsi]. Tooltip kunci pintasan hitam kecil dengan huruf pintasan [dari deskripsi]. Sudut: pil 999 px, kartu 12–16 px, baris 10 px [perkiraan].

## 6. Yang sudah diterapkan (sesi ini)
- Palet netral dua tema lewat token di `public/css/identity.css` (nama token lama dipertahankan sebagai peran). Kontras dihitung: teks utama ≥ 12:1, redup ≥ 7:1 (gelap) dan ≥ 6:1 (terang), tombol utama ≥ 4,5:1.
- Font: Inter untuk semuanya (serif dimatikan lewat token `--serif`).
- Kantor 3D: kolom ketik pil di tengah bawah, bilah tab "Kantor 3D | Obrolan", daftar ruangan terlipat, lonceng "Kabar".
## 7. Belum
Rel ikon + panel kedua berkelompok, menu akun kiri bawah, halaman Hasil Saya gaya "All/Scheduled", baris ikon aksi pada balasan Pemandu, chip "Memanggil …", dan tab Kantor 3D | Obrolan di Beranda. Struktur ini belum diubah; hanya warna, font, dan kepadatan Kantor 3D yang sudah mendekati.
