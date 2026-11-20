# 05. Masalah yang pernah ada, diagnosis, dan pekerjaan berikutnya

## A. Bug yang sudah diperbaiki: pelajari agar tidak terulang

| Keluhan Owner | Akar masalah (terbukti) | Perbaikan | Mudah kambuh bila |
|---|---|---|---|
| Layar karakter jauh menampilkan semua 16 ekspresi sekaligus | Material Face LOD tidak diberi `faceSheet` → `roleId` 0 → shader tidak memilih sel | A2 | `loadBody` ditulis ulang |
| Lengan kiri selalu diam; ayunan lengan jalan tidak ada | `armIK` menarik KEDUA tangan ke pose istirahat tetap setelah klip; hanya Wave/gestur yang "clipDriven" | A8 | `clipDriven` dikembalikan ke kondisi lama |
| Jalan salah (kaki meluncur) | Agen 2,8 / 5,2 u/dtk vs siklus klip alami ±1,0 u/dtk | A9 | kecepatan diubah tanpa menyamakan konstanta |
| Duduk "salah" | Ketinggian duduk BENAR (paha 1,8 cm di bawah dudukan). Yang tampak salah: lengan hasil IK tetap, dan Type/Read tidak dikenali sebagai duduk | A5-A8 | `SIT_CLIPS` dibuang |
| Ekspresi monoton | `updateFace` hanya memilih neutral/focus/smile/talk | B1 | fungsi diganti |
| Robot gepeng | (1) `ap.build` acak 0,92-1,08 pada lebar badan; (2) **FOV 65° meregangkan objek di tepi layar**: kepala 1,22x → 1,61x lebar/tinggi | A4, B5-B7 | build/FOV dikembalikan |

| Langkah tidak natural; jalan = lari | NPC 2,6 u/dtk, pemain 2,8/5,2; klip alami ≈1,04/≈2,0 | `GAIT` 1,4/2,7, timeScale 0,85-1,5, NPC lari otomatis jarak jauh (A12, B8) | kecepatan diubah tanpa GAIT |
| Keluar Mode Play zoom sangat jauh | `exitPlayer` memanggil `fitCamera(false,'iso')` (overview seluruh kampus) | `softPullBack` (B9) | pemanggilan lama dikembalikan |
| Banyak karakter kembar (200+ agen, 12 tampilan) | Badan dipilih `hash % 12`; material V4 `LOCKED_V4_*` tidak punya slot warna | slot warna V4 + palet unik per agen (A13-A15): 171/171 unik | `mascot-palettes.js`/`V4_ROLE` dibuang, atau `roleColors[6]` dikembalikan |

| Sinematik tidak diputar saat refresh | flag `sessionStorage.rayIntroDone` (sekali per tab) | flag `window.__rayIntroPlayed` (setiap muat halaman) | flag dikembalikan ke sessionStorage/localStorage |
| Karakter "rusak/gepeng/bergerigi" terutama pada agen jauh atau saat FPS turun | **LOD1 (1.425 segitiga)** dibuat dengan desimasi paksa multi-tahap dari mesh 79 ribu segitiga: kepala jadi kotak, telinga runcing, jaket bergerigi. Geometri LOD0 sendiri terukur setia (lebar/tinggi tubuh 0,655 vs 0,651 render Blender) | Pipeline: LOD1 diturunkan dari LOD0 dalam SATU tahap; anggaran dinaikkan LOD0 8000 / LOD1 4000 (`characters/v4/*.json`: `lod0_budget`, `lod1_budget`) | aset dibangun ulang dengan anggaran lama 6000/1500 |

Bukti dan ukuran lengkap: `01-KEADAAN-SAAT-INI.md`.

## B. Diagnosis yang menyesatkan (jangan terjebak)

- "Lengan T-pose, bobot aksi 0,004" di rig-test = pane membatasi rAF ±1 FPS; bukan bug aplikasi.
- `rig-test.html?state=type` memaksa rotasi lengan manual; bukan cerminan kantor.
- Tangkapan layar kantor dari pane kosong/identik: kamera/`controls` tidak bergerak karena rAF throttle; gunakan `window.__ray3d` (scene, camera, controls, renderer) dan simpan kanvas lewat `toBlob`.
- Hitungan `renderer.info.calls` dari loop render manual terakumulasi.
- Perbandingan FPS V3 vs V4 tidak andal: variasi antar-sesi (10-59 ms) lebih besar dari beda aset (kualitas adaptif aplikasi menurunkan ke LOD1 ketika frame lambat).

## C. Keterbatasan yang diketahui

1. (Diselesaikan gelombang 5) Tiap agen kini punya palet unik; yang masih sama hanya geometri badan (4 bentuk) dan warna LED wajah (per template). Bila ingin bentuk berbeda per divisi, lihat D4.
2. Tangan mengetik memakai IK keyboard (bukan klip) karena tangan klip melayang ±10 cm; tapping dua tangan sederhana.
3. Ekspresi hanya 16 sel; sel "cry" adalah sad + air mata; Charcoal/Branch bukan glyph V4.2 persis.
4. Telinga Kiko ikut Head (tanpa spring). Kiko duduk: kaki menggantung (terlalu pendek untuk lantai) — dicatat di `notes` manifest.
5. Fidget `Drink/Phone/Think/Nod/Shrug` dipilih acak; belum ada prop minuman/ponsel di tangan (animasi tangan ke mulut/telinga tanpa benda). Bila ingin prop, pakai `rig.setProp` (prop berada di tangan kanan).
6. Kecepatan siklus dibatasi 2,2×; pada 2,8 u/dtk masih ada sedikit selip (±25-35 %) karena stride chibi pendek. Opsi lanjutan: turunkan kecepatan jalan agen (`office3d.js` ±baris 2669) dan konstanta di A9 secara bersamaan.
7. Sinematik: waktu tetap (3,4 dtk + 9,5 dtk); tidak ada musik; dapat dilewati; jalur melewati titik tinggi di atas Owner — belum diuji di 60 FPS.

## D. Rancangan pekerjaan berikutnya (belum dikerjakan)

**D1. Interaksi antar-agen dari demo mascot** (salaman, tos, serah-terima). Di demo (`robot_mascot_system_v4_2/runtime/agent_system.mjs`): `InteractionSystem` + `planStance` (pose berdampingan karena kepala lebar/lengan pendek, twist dada ≤35°, jangkauan 98 % panjang lengan), IK dua-tulang di `three_adapter.mjs` (`solveArm`), toleransi kontak 0,03 tinggi karakter, serah-terima tepat-sekali. Di kantor: animator berbeda (IK `twoBone` sendiri di assets3d.js). Rencana: (a) pakai `planStance` untuk menentukan jarak/hadap dua agen yang sudah saling berhadapan saat obrolan (`a.talkUntil`/`a.lookAt` di office3d.js ±baris 1473-1479); (b) gunakan `twoBone(arm.s.bone, arm.el.bone, arm.wr.bone, target, pole)` yang sudah ada untuk menjangkau titik kontak; (c) timpa lengan hanya selama fase kontak (≤1,5 dtk) lalu kembali ke klip; (d) ukur tangan-ke-tangan ≤0,03×tinggi dengan skrip seperti `interaction.test.mjs`. Risiko: tinggi untuk tabrakan kepala; wajib uji 12 badan × 12 badan.
**D2. Prioritas state & event backend** (`AgentBrain`, `BackendBridge`): sebagian sudah tercermin lewat `updateFace` (status → ekspresi). Tahap lanjut: peta status server (working/meeting/chatting/pending/waiting/todo/done/blocked/offline/idle) ke satu fungsi prioritas yang dipakai wajah DAN klip; offline mengalahkan semuanya.
**D3. LOD adaptif**: aplikasi sudah punya kualitas adaptif; tidak perlu `LodBudget` demo, kecuali histeresis (hindari kedip LOD).
**D4. Badan berdasarkan divisi** dan penambahan colorway (04).

## E. Pertanyaan terbuka untuk Owner

- Apakah wajah di kantor sudah cukup mirip demo setelah perbaikan FOV/skala? (Kirim gambar pembanding bila belum.)
- Apakah interaksi salaman/tos antar-agen (D1) diinginkan sebagai fitur kantor, dan seberapa sering?
- Apakah 12 tampilan cukup atau perlu colorway tambahan?
