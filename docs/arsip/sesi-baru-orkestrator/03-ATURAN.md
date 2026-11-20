# Aturan kerja (mengikat)

1. Mulai dengan `node docs/mascot-v4-2/verify-v42.mjs` (71 lolos). Setelah selesai, jalankan lagi dan tambahkan cek untuk perubahan Anda.
2. Cadangkan setiap berkas sebelum diubah ke `3D karakter/_backup_runtime_before_v42_logic/passNN/`.
3. Jangan menimpa berkas dengan salinan lama; sesi lain dan Owner mengedit berkas yang sama. Baca versi terkini dulu.
4. Setelah mengedit JS jalankan `node --check berkas.js`. Jangan menaruh komentar `//` di dalam string pengganti satu baris (pernah menelan kode sesudahnya dan merusak berkas).
5. Uji di salinan terisolasi: salin folder aplikasi, kosongkan kunci API (`GROQ_API_KEY=`, `ANTHROPIC_API_KEY=`), jalankan di port lain (mis. `PORT=4400`). Jangan memakai kunci atau biaya Owner untuk uji.
6. Server aplikasi Owner jangan dimatikan tanpa izin; hentikan hanya proses uji Anda lewat PID yang diverifikasi.
7. Jangan membuang perubahan V4.2, glass.css, FXAA, dock, `orchestrate`. FXAA wajib sebelum pass grade (lihat 07 D).
8. Karakter: jangan skala tak seragam; geometri sudah diukur setia terhadap Blender.
9. Laporkan jujur: apa yang terbukti (dengan bukti), apa yang hanya diduga, dan apa yang belum diuji di 60 FPS.
10. Perbarui `docs/mascot-v4-2/07-...md` dan penjaga untuk setiap perubahan; kabari sesi lain bila relevan.
