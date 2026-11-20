# Status terkini (dokumen hidup)

Terakhir diperbarui: **2026-11-19**. Perbarui tabel ini tiap ada perubahan, lalu tambahkan satu baris di "Riwayat".

| Bagian | Status | Catatan |
|---|---|---|
| Kantor 3D, suara | Jalan, beku | Jangan diubah |
| Beranda chat (Pemandu) | Setengah | Kode ada, belum dicoba Owner |
| Tim Saya, Hasil Saya, Catatan | Setengah | Baru, belum dicoba Owner |
| Konsol admin | Setengah | Terpisah dari pengguna, 17 tes lolos |
| Agen AI lama (Groq) | Jalan | 171 agen, 22 divisi; ini yang bekerja sekarang |
| Keamanan, kuota, persetujuan | Jalan (teruji tes) | Belum dipakai publik |
| Data | JSON jalan, SQLite mati | Bendera, bawaan JSON |
| Staf 238 | Belum aktif | Katalog lengkap; `staffModel` mati di data Owner |
| Kemampuan inti | Setengah | 31 kemampuan ditulis dan lulus evaluasi dengan model TIRUAN; 0 panggilan model asli, mutu AI sungguhan belum dinilai |
| n8n | Ada, tidak aktif | 253 workflow: 30 milik Owner, 221 staf tersimpan, 0 aktif |
| Telegram | Setengah | Bot `@raiverse_bot` hidup di salinan uji (port 4611) |
| Discord | Dibangun, belum diuji nyata | Butuh token |
| WhatsApp, email, Sheets lewat RAIVERSE | Belum ada | WAHA/SMTP kosong, konektor Apps Script belum diisi |
| Perapian backend | Selesai | Peta: docs/PETA-BACKEND.md, docs/PETA-OTAK.md, docs/README.md; kode dipindah ke folder (33 dari 41 berkas akar kini hanya peneruskan satu baris); 295 tes, 0 gagal |
| Uji nyata dengan model asli | Belum dimulai | Kartu sesi menunggu; biaya dibatasi sekitar 0,5 USD |
| Menu | Kantor 3D utama | Urutan: Kantor 3D, Beranda, Hasil Saya, Catatan, Tim Saya; di HP layar pertama tetap Beranda |
| Peta isi website (dari kode) | Jalan | docs/PETA-WEBSITE.md: 15 halaman, 20 jalur #hash, sekitar 170 tombol, 0 rute hilang |
| Kartu Telegram/Discord di layar | Belum tertaut | Komponen ada, tidak pernah diimpor; rute /api/saluran/* sudah ada |
| Peta halaman lengkap (diagram) | Jalan | peta-halaman/PETA-HALAMAN-LENGKAP.md v3 + artifact: 17 diagram lolos parser, 47 temuan bernomor T-01..T-47; dibaca dari kode 2026-11-20, belum dilihat di layar |
| Perapian berkas | Selesai | Gambar ke docs/gambar/, bacaan luar ke docs/riset/, rahasia OAuth ke _rahasia-lokal/ (diabaikan git); daftar: _arsip-sampah/DAFTAR.md |

## Fakta penting
- Server Owner: `localhost:4400`. Server uji Telegram: `4611`. Hanya satu server boleh polling token Telegram yang sama.
- Git: 3 titik aman (`70338c0` dipush, `2973eb2` dan `2994971` lokal).
- Tes terakhir (saya jalankan sendiri): 295 tes, 293 lulus, 0 gagal, 2 ditunda; mascot 109/0.
- Rahasia di `.env` (jangan dicetak): Groq, n8n, Telegram. Kunci n8n dan token Telegram sempat tertulis di chat: putar sebelum dipakai publik.

## Riwayat
- 2026-11-20: peta halaman v3 (Obrolan, Pesan, panel kiri tunggal, robot, admin 10 tab). 47 temuan keliru/janggal untuk dipilih Owner; terbesar: tiga UI chat, dock lama, tautan chat mati, menu V mengunci gerak, staf lewat chat tanpa cek peran.
- 2026-11-19: perapian berkas akar dan docs (gambar dikumpulkan, rahasia OAuth keluar dari docs, README docs diperbarui). Tidak ada yang dihapus; 3D karakter sengaja tidak disentuh.
- 2026-11-19: peta halaman lengkap dengan diagram mermaid dan artifact diperbarui (dari kode). Temuan: dock Kantor 3D masih jalur lama /api/orchestrate, riwayat chat belum punya tampilan, admin 10 tab. Kartu Telegram/Discord kini sudah tertaut di Pengaturan (baris lama di tabel perlu dicek ulang).
- 2026-11-19: perapian backend selesai (peta, konfigurasi tunggal, folder). Staf native: 31 kemampuan inti. Menu: Kantor 3D jadi utama.
- 2026-11-19: peta website dari kode selesai (15 halaman). Temuan: kartu Telegram/Discord yatim, ekspor/hapus data belum punya tombol, balasan Pemandu belum dibacakan.
- 2026-11-19: dokumen dibuat. Visual lock dicabut sebagai gerbang tes. n8n staf dinonaktifkan (0 aktif).

## Otak obrolan setara Claude (2026-11-19)
Prompt tunggal (`server/otak/perilaku-obrolan.js`), putaran alat 4 langkah/3 paralel/anggaran 0,06 USD, penghitung aman, verifikasi angka, kompaksi, penyedia model cepat/pintar (Claude bila kunci diisi pengelola), rute Ulangi/Ubah/Umpan, UI (berpikir, langkah, Hentikan, panel dokumen). Detail dan batas: docs/PERILAKU-OBROLAN.md.
- **Sudah:** semua di atas; 12 tes baru (`test/obrolan-otak.test.js`); evaluasi 33 percakapan dengan model asli (3 putaran, sekitar 0,005 USD tiap putaran): lama 0,93, baru 0,95 dan 0,90 (derau sama besar dengan selisih; tidak ada bukti peningkatan).
- **Sebagian:** mesin tugas `engine.js` belum memakai prompt tunggal; Ubah hanya pesan terakhir; Hentikan memutus tampilan saja.
- **Belum:** jalur Claude dengan kunci sungguhan; alat browser di obrolan; penilaian manusia. Setara Claude hanya dengan model Claude.

## Halaman Pesan (2026-11-19)
Kontak (orang, divisi, grup) + utas per kontak (riwayat Obrolan/rapat, tugas, info), komposer sama dengan Obrolan; server `chat-kontak.js`, rute `/api/pesan/*`, 10 tes. Menu: Kantor, Obrolan, Pesan, Hasil, Catatan, Tim. Diperiksa di panel 1280 px, HP 375 px, dan mode gelap. Sinyal fokus karakter `raiverse:fokus-kontak` terkirim; pembingkaian "di kanan" menunggu kamera sesi tampilan. Detail: docs/CHAT-ENGINE.md.

## @mention, peran Sora/aray, jawab dulu, satu UI pesan (2026-11-19)
Saran @ menjadi chip penerima ("Ke: Reno"), Sora = penghubung dan notulensi, aray = koordinator lintas divisi (hanya bila diminta; usulan lewat konfirmasi), pertanyaan tentang diri dijawab langsung dari profil (tanpa menu, tanpa karangan), ChatView lama dihapus dan #chat/#admin-chat dialihkan ke #pesan yang kini memuat Ruang dan Rapat dengan nama ramah. Evaluasi nyata 44 percakapan (model kecil, sekitar 0,008 USD): total 0,94 (prompt lama) vs 0,95 dan 0,98 (baru, dua putaran); 11 kasus persona respons 1,00 pada tiga putaran terakhir. Belum: perintah slash dan siaran lama, rapat dibuat dari chat, balasan model untuk ruang divisi.

## aray = kembaran digital, Sora bukan pembicara (2026-11-20)
aray menjadi pintu bawaan Obrolan (menjawab sendiri atau "Saya minta Reno." lalu Reno menjawab), bicara langsung ke agen tidak disela, laporan agen -> aray -> pemilik diturunkan dari pekerjaan selesai (tab Laporan di Pesan), Sora disembunyikan dari chat (data tidak diubah), label "Ke: aray". Spesifikasi dan diagram: docs/PERILAKU-OBROLAN.md bagian 9. Belum: pengingat proaktif, kartu laporan di Kabar 3D, peran sekretaris Sora di data 3D.

## Konsolidasi menyeluruh (2026-11-20)
Audit berbukti (`scripts/inventaris.mjs`), 12 peneruskan yatim diarsipkan ke `_arsip-kode/`, `office-layout.css` dilebur dari v4..v12 (dibuktikan setara dengan `scripts/snapshot-gaya.mjs`), 7 temuan peta halaman diperbaiki, tes kontrak `test/konsolidasi.test.js`. Rincian dan yang belum: `docs/FUNDAMENTAL/konsolidasi/AUDIT.md`, `UKUR.md`.

### Penutup konsolidasi (2026-11-20)
Suite penuh 494 lolos/0 gagal, mascot 109/0. Evaluasi model asli 13/15 (skor 0,99), beban muat tidak berubah berarti (`konsolidasi/UKUR.md`), tangkapan layar di `docs/visual-review/konsolidasi/`. Sisa dan keputusan: `konsolidasi/AUDIT.md` §5, `PROGRES.md`.
