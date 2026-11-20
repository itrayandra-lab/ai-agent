# Tinjauan visual: Pemandu sebagai satu percakapan, 2026-11-18

Arah Owner: terasa ribet, ingin satu antarmuka seperti ChatGPT. Diuji di salinan terisolasi (port 4581, kunci AI kosong, mode simulasi). Menggantikan tinjauan wizard sebelumnya (`2026-11-18-pemandu.md`).

## Berkas frontend yang berubah
`public/js/pemandu-view.js` (ditulis ulang), `public/css/identity.css` (blok Pemandu diganti). Berkas lain (`views.js`, `app.js`) tidak berubah pada putaran ini.

## Perubahan
- Dihapus: penunjuk langkah, kartu rencana tiga opsi, panel onboarding/profil terpisah, bar jatah besar.
- Sekarang: sapaan + 4 saran pembuka, utas percakapan, kolom ketik dengan mikrofon, satu baris kecil "Sisa jatah hari ini". Kemajuan, hasil, dan kartu konfirmasi kecil muncul di dalam utas; tombol saran (2 sampai 4) hanya di balasan terakhir.
- Server: bertanya hanya bila perlu (maks. 1; permintaan jelas langsung dikerjakan), rencana dipilih otomatis, konfirmasi hanya untuk aksi berdampak (otomasi: Ya, nyalakan / Ubah / Batal), obrolan ringan dijawab langsung.

## Diperiksa
| Ukuran | Tema | Keadaan | Hasil |
|---|---|---|---|
| 390 × 844 | terang | awal (kenalan + saran), pertanyaan dengan tombol, kolom ketik | tanpa gulir samping, tombol ≥ 48 px |
| 1440 × 900 | gelap | kemajuan di utas, hasil di utas dengan 4 tombol | terbaca, kolom 760 px di tengah |
| 1440 × 900 | terang | hasil di utas | terbaca |
Belum diperiksa satu per satu: 390 gelap, 820 × 900, keadaan galat, kartu konfirmasi otomasi dengan n8n hidup, mikrofon sungguhan, pembaca layar.

## Berkas untuk persetujuan hash (Owner)
`public/js/pemandu-view.js`, `public/css/identity.css` (ditambah `views.js`, `app.js` dari putaran sebelumnya). Perintah ada di `2026-11-18-pemandu.md`.
