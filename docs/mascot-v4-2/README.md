# Robot Mascot V4.2 di Ray Agent Office: BACA INI DULU

Folder ini adalah satu-satunya sumber kebenaran untuk integrasi karakter **Robot Mascot V4.2** (Kiko, Azure, Charcoal, Branch) ke kantor 3D. Ditulis 2026-11-17 oleh sesi "3D / mascot" atas perintah Owner, ditujukan untuk sesi runtime ("AI employee platform dengan 3D office visual") dan siapa pun yang mengedit aplikasi ini sesudahnya.

**Bila Owner meminta Anda "membaca folder ini": baca README ini sampai habis, jalankan penjaga (langkah 1 di bawah), lalu baca file bernomor sesuai kebutuhan.**

## Langkah wajib sebelum mengubah apa pun

1. Jalankan penjaga (hanya membaca, ±1 detik):
   ```
   node docs/mascot-v4-2/verify-v42.mjs
   ```
   Harus menampilkan `Semua perubahan V4.2 utuh.` (58 pemeriksaan pada saat ditulis). Jalankan lagi **setelah selesai mengedit**. Bila gagal, perubahan V4.2 hilang atau rusak: perbaiki, jangan lanjut.
2. Baca bagian "Aturan emas" di bawah.
3. Bila Anda akan menyentuh `public/js/assets3d.js`, `public/js/office3d.js`, atau `public/js/views.js`: baca `02-DAFTAR-PERUBAHAN-KODE.md` (daftar persis baris yang dipertahankan).

## Aturan emas (ringkas; rincian di 03)

1. **Jangan menulis ulang** `assets3d.js`, `office3d.js`, `views.js` secara utuh dari salinan lama/ingatan. Edit bedah saja (Edit/patch per anchor), karena file-file itu memuat perubahan V4.2 yang tidak ada di versi lama.
2. **Jangan menyentuh** `public/assets/characters/agents/` (GLB, LOD, atlas wajah, manifest, `index.json`). Aset dibangun oleh pipeline Blender di luar aplikasi ini. Butuh aset baru/berbeda: minta ke Owner/sesi 3D.
3. **`CHIBI.ids` (assets3d.js baris ±18) dan `index.json` harus identik.** Runtime memuat dari `CHIBI.ids` yang ditulis tetap di kode, bukan dari `index.json`.
4. Setiap kali GLB diganti, **naikkan `AGENT_V`** di assets3d.js (cache-bust).
5. **Jangan mengembalikan `armIK` untuk semua state**, jangan mengembalikan `ap.build` ke skala badan chibi, jangan menaikkan FOV Mode Play di atas 38°. Ketiganya sudah pernah menjadi bug yang dikeluhkan Owner (lengan kiri diam; robot gepeng; wajah/badan teregang di tepi layar).
6. **Jangan memodifikasi bentuk/proporsi karakter di runtime** (skala non-uniform, squash/stretch pada akar atau kepala). Owner sangat sensitif: robot harus pendek, membulat, kepala besar, sesuai desain.
7. **Uji hanya di salinan terisolasi dengan kunci API dikosongkan** (lihat 03). Menjalankan server dari salinan `data/db.json` dengan `GROQ_API_KEY` di environment memanggil API sungguhan dan memakai anggaran Owner.
8. Jangan commit/push tanpa diminta Owner. Jangan menghapus folder `3D karakter/_backup_*` (cadangan).
9. Laporkan jujur: jangan klaim "sempurna/60 FPS/semua teruji" tanpa bukti. Catat apa yang diuji dan apa yang tidak.
10. Bila ragu apakah suatu perubahan merusak karya V4.2: jalankan penjaga, bandingkan dengan folder cadangan, tanya Owner.

## Peta folder

| Berkas | Isi |
|---|---|
| `README.md` | ini |
| `01-KEADAAN-SAAT-INI.md` | apa yang terpasang, hasil ukur, keputusan Owner, yang terbukti vs belum |
| `02-DAFTAR-PERUBAHAN-KODE.md` | **setiap edit kode**: file, lokasi, alasan, gejala bila dibuang, cara memeriksa |
| `03-ATURAN-DAN-CARA-KERJA.md` | pembagian wewenang, cara mengedit aman, prosedur uji terisolasi, jebakan |
| `04-ASET-DAN-PIPELINE.md` | kontrak aset, 12 id, cara aset dibuat, cara meminta aset baru |
| `05-MASALAH-DAN-YANG-BELUM-SELESAI.md` | bug yang pernah ada + diagnosis, keterbatasan, pekerjaan berikutnya |
| `06-ROLLBACK.md` | cara mundur seluruhnya atau sebagian |
| `verify-v42.mjs` | penjaga otomatis (baca-saja) |
| `bukti/` | gambar bukti (sebelum/sesudah, ekspresi, kontak) |

Dokumen lama `docs/V4_2-MASCOT-INTEGRATION.md` dan `docs/INSTRUKSI-SESI-RUNTIME-V4_2.md` masih ada, tetapi **folder ini yang berlaku**.

## Lokasi di luar aplikasi ini

- Paket karakter + demo + pengujian: `D:\01-vixv\deployment\3d blender automation\agen-karakter-v3\robot_mascot_system_v4_2\` (demo: `node serve.mjs`, buka http://localhost:8765/demo/ ; docs/VALIDATION.md).
- Pipeline Blender yang membangun aset aplikasi ini: `D:\01-vixv\deployment\3d blender automation\pipeline\` (`build_mascot.py`, `v4.py`, `deploy_v4.py`) dan konfigurasi `characters\v4\*.json`.
- Cadangan sebelum perubahan: `3D karakter\_backup_agents_v3_20261117\` (aset V3), `3D karakter\_backup_runtime_before_v42_logic\` (JS sebelum edit; subfolder `pass3\`, `pass4\`).

- **07-UI-GLASSMORPH-DAN-TATA-LETAK-PLAZA.md** — UI glassmorph premium (`public/css/glass.css`), tata letak plaza baru (Brain/air mancur lebih kecil), perbaikan tombol Play/Exit dan sinematik masuk Play lagi.

- **docs/sesi-baru-orkestrator/** paket serah-terima untuk sesi baru (audit backend chat, rapat, goal; ringkasan perubahan; aturan).
