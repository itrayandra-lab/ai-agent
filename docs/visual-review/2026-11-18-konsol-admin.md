# Tinjauan visual: Konsol pengelola (#admin), 2026-11-18

Sesi: konsol admin lengkap. Berkas frontend yang berubah (penyebab `npm run check:visual` gagal, wajar dan memang harus ditinjau Owner):

| Berkas | Perubahan |
|---|---|
| `public/js/admin-view.js` | ditulis ulang: kerangka bertab + bagian Ringkasan, Penyedia AI, Kuota dan batas, Alat lama |
| `public/js/admin-bagian.js` | BARU: pembantu tampilan + bagian Pengguna, Integrasi, Staf, Keamanan, Data |
| `public/js/awam.js` | `bisaKelola()` kini hanya mengikuti tanda `platformAdmin` dari peladen (bukan peran ruang kerja) |
| `public/js/kamus-ui.js` | `admin-bagian.js` masuk daftar putih berkas pengelola |
| `public/css/identity.css` | satu blok baru di akhir berkas ("Konsol pengelola"): `.adm-*`, hanya token identitas, tanpa merah |

`public/js/sambungan-view.js` ikut terdaftar sebagai "unreviewed" oleh pagar, tetapi itu milik sesi lain, bukan sesi ini.

## Yang diperiksa (peramban Claude, server terisolasi: data sementara, kunci AI kosong, port 4606)

Tiga ukuran × dua tema × sembilan bagian (Ringkasan, Penyedia AI, Kuota dan batas, Pengguna, Integrasi, Staf dan katalog, Keamanan, Data, Alat lama), diperiksa dengan penyapu otomatis di halaman:

| Ukuran | Tema terang | Tema gelap |
|---|---|---|
| 390 × 844 (ponsel) | lolos | lolos |
| 820 × 900 (tablet) | lolos | lolos |
| 1440 × 900 (desktop) | lolos | lolos |

"Lolos" berarti, untuk setiap bagian: tidak ada gulir mendatar halaman, tidak ada elemen yang melewati tepi layar, tidak ada tombol/kolom lebih pendek dari 44 px, tidak ada kartu galat. Dua cacat ditemukan dan sudah dibetulkan sebelum lolos: (1) tab aktif tidak berwarna karena `.btn` lebih spesifik, (2) kartu Integrasi melebar di 390 px karena kapsul status panjang tidak bisa turun baris dan kolom grid tidak `minmax(0,1fr)`.

Uji fungsi di peramban: tab pindah, ubah batas harian lalu Simpan (toast "langsung berlaku", nilai terbaca ulang dari server) lalu "Bawaan" (kembali ke nilai semula).

Tangkapan layar (`docs/visual-review/konsol-admin/`): `desktop-1440-gelap-penyedia-ai.jpg`, `desktop-1440-gelap-alat-lama.jpg`, `desktop-1440-terang-kuota.jpg`, `ponsel-390-terang-keamanan.jpg`.

## Yang belum diperiksa (jujur)

- Peramban dengan akun Google sungguhan dan data banyak (daftar pengguna ratusan baris): daftar pengguna dan sesi hanya dilihat dalam keadaan kosong di peramban; isi terisi diuji lewat tes HTTP (`test/admin.test.js`), bukan secara visual.
- Pembaca layar (VoiceOver/NVDA) tidak dijalankan; nama aksesibel (label, `aria-label`, peran tab/tabpanel) dijaga tes otomatis, bukan didengar.
- Kontras diperiksa dengan mata di dua tema memakai token identitas yang sudah ada; tidak ada pengukuran rasio kontras otomatis.
- Setiap kotak dialog konfirmasi (ketik ulang) diuji logikanya lewat tes server (menolak bila tidak sama), tetapi tampilannya tidak ditangkap satu per satu.

## Perintah untuk Owner (pagar visual)

Setelah Owner meninjau berkas di atas, baseline diperbarui **oleh Owner** (bukan otomatis, lihat `VISUAL-LOCK.md`). Sesi ini tidak menjalankannya.

Perintah persis (hanya lima berkas konsol; jalankan dari folder proyek SETELAH Owner meninjau dan menyetujui, lalu `npm run check:visual`):

```bash
node -e "const fs=require('fs'),c=require('crypto');const m=JSON.parse(fs.readFileSync('visual-lock.json','utf8'));for(const f of ['public/js/admin-view.js','public/js/admin-bagian.js','public/js/awam.js','public/js/kamus-ui.js','public/css/identity.css'])m.files[f]=c.createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');fs.writeFileSync('visual-lock.json',JSON.stringify(m,null,2)+'\n')"
```

Catatan: `identity.css` juga bisa berubah oleh sesi lain; kalau begitu tinjau dulu bagian itu. Berkas `sambungan-view.js` bukan bagian perintah ini.
