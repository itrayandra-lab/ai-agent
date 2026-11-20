# Ringkasan perubahan (semua berkas ada di folder aplikasi)

Rincian dan akar penyebab ada di `docs/mascot-v4-2/` (README, 01-07). Cadangan tiap gelombang: `3D karakter/_backup_runtime_before_v42_logic/` (pass1 sampai pass12).

| Gelombang | Isi | Berkas utama |
|---|---|---|
| 1-6 | Karakter V4.2 (12 id), warna unik per agen, gerak/gestur/ekspresi, kaki/duduk, sinematik awal tiap refresh, tarik kamera halus saat Esc, LOD diperbaiki | assets3d.js, office3d.js, views.js, mascot-palettes.js, aset di public/assets/characters/agents |
| 7 | Tombol Play kembali ke PLAY setelah Esc; masuk Play lagi memutar sinematik dari posisi kamera | views.js, office3d.js |
| 8 | Plaza: Brain 1,5 ke 0,95, air mancur x0,62, situs dalam RR 12,5 ke 17 | office3d.js |
| UI | UI glassmorph premium | public/css/glass.css + 1 baris di index.html |
| 9 | FXAA (sebelum grade, grade.needsSwap=false), fokus DOF Play, slider visual tidak memicu zoom, caret chat | office3d.js, views.js |
| 10 | Dunia lebih tenang: rumput pendek, dekor dan lalu lintas langit dikurangi | office3d.js, environment.js, life.js |
| 11 | Server: orchestrate(), ensureGroup, grup bergiliran, @mention hanya anggota, chatBusy | server/engine.js, server/index.js |
| 12 | Dock Orkestrator, setInset, spotlight; fokus DOF Play berdasar jarak ke karakter | views.js, office3d.js, glass.css |

Penjaga: `node docs/mascot-v4-2/verify-v42.mjs` (71 cek).

Peringatan penting:
- FXAA harus sebelum grade; jumlah swap buffer composer per frame harus genap (lihat 07 bagian D). Kalau tidak, layar hitam.
- Setelah edit `server/*` restart server; setelah edit klien refresh keras (Ctrl+F5).
- Penjaga mengecek keberadaan perubahan ini; jangan dibuang tanpa alasan.
