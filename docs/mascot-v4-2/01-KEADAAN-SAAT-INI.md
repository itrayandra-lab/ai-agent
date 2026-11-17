# 01. Keadaan saat ini (2026-11-17, malam)

## Yang terpasang

- **12 karakter V4.2** di `public/assets/characters/agents/`: 4 base × 3 tampilan.

| Base | Tampilan | Id |
|---|---|---|
| Kiko (putih, telinga kucing, jas navy) | kanonik / Ocean / Coral | `kiko`, `kiko_ocean`, `kiko_coral` |
| Azure (putih, tanduk, layar biru dot-matrix) | kanonik / Ocean / Coral | `azure`, `azure_ocean`, `azure_coral` |
| Charcoal (arang, antena, LED kuning) | kanonik / Ocean / Coral | `charcoal`, `charcoal_ocean`, `charcoal_coral` |
| Branch (gading, layar navy, antena Y) | kanonik / Ocean / Coral | `branch`, `branch_ocean`, `branch_coral` |

- Semua karakter lama (terra, mallow, blueprint, sprout, clover, sage; juga yang sudah "retired" sebelumnya) **tidak dipakai** lagi oleh runtime. Aset V3 untuk kiko/azure/charcoal dan keenam id lama dicadangkan di `3D karakter\_backup_agents_v3_20261117\`.
- Setiap karakter: ±7.580 segitiga LOD0 / 3.779 LOD1 (dinaikkan dari 5.640/1.425 setelah LOD1 lama terbukti merusak bentuk), 0,65-0,75 MB, 24 tulang kontrak + PropL/PropR, 20 klip `CH_*`, atlas wajah 512² 4×4. Lolos seluruh cek kontrak `BRIEF-KARAKTER-3D.md` (tulang, klip, anggaran, ≤4 pengaruh/vertex, kaki di lantai, duduk 0,255 m).
- Perilaku baru di runtime (rincian di 02): lengan digerakkan klip, kecepatan siklus jalan diselaraskan, fidget idle, ekspresi kaya + mikro-ekspresi, napas, FOV Mode Play 38°, sinematik pembuka → Mode Play otomatis, lebar badan tidak dirusak.

## Permintaan Owner yang melatarbelakangi (urut waktu)

1. Integrasikan paket Robot Mascot V4 (Core+Models) ke proyek; prioritas: modeling & kualitas visual; model harus lucu, pendek, membulat, tidak humanoid.
2. Gunakan hanya karakter terbaru (V4.2), ganti semua yang lama, sempurnakan yang sekarang.
3. Keluhan setelah melihat di kantor: tangan kiri selalu diam; duduk salah; jalan salah; ekspresi monoton; robot gepeng/wajah terlihat tertekan.
4. Sinematik awal: mulai dari pandangan udara, zoom pelan ke karakter yang dimainkan, langsung Mode Play.
5. Pakai sistem di http://localhost:8765/ (demo paket mascot) secara otomatis agar sangat ekspresif (gestur, ekspresi, interaksi).
6. Dokumentasi lengkap dalam satu folder untuk sesi runtime agar tidak saling menimpa (folder ini).

## Hasil ukur yang mendukung (bukan klaim)

| Hal | Hasil | Cara |
|---|---|---|
| Ayunan telapak saat jalan | kiri 0,270 m / kanan 0,269 m (Charcoal); sebelum perbaikan kiri hampir diam | rig-test, animasi dimajukan manual |
| Duduk | paha 1,8 cm di bawah permukaan dudukan (ketinggian benar); telapak simetris ±0,30 | rig-test |
| Mengetik | kedua tangan bergerak; telapak 0,82 m (meja 0,735 + radius tangan) | rig-test, status `working` |
| Distorsi lensa | rasio lebar/tinggi kepala Azure: FOV 65° → 1,22 (tengah) / 1,35 (tengah-samping) / 1,61 (tepi); 46° → 1,39 tepi; 34° → 1,30 tepi; model asli 1,21 | proyeksi vertex kepala |
| Proporsi badan di rig | lebar kepala/tinggi = 0,685 (asli 0,686); skala klon seragam | rig-test |
| Sinematik | kamera turun y=180 → 3,5; FOV 65 → 38; Mode Play aktif | salinan terisolasi, waktu dilonggarkan khusus uji |
| Muat 12 id | 12 GLB + 12 LOD termuat, tanpa galat JS konsol | salinan terisolasi |

## Belum terbukti / belum dikerjakan

- Semua gerakan di **browser normal 60 FPS** (hanya diuji di pane ±1 FPS dengan animasi dimajukan manual). Owner perlu Ctrl+F5 dan menilai.
- Gestur wave/cheer/carry, mode Play penuh, tabrakan, FPS kantor dengan 12 badan, duplikat badan berdampingan (badan dipilih `hash(id) % 12`).
- **Interaksi antar-agen dari demo mascot** (salaman, tos, serah-terima dengan IK kontak, penjadwal sosial otomatis, prioritas state `AgentBrain`, `BackendBridge`, navigasi pasangan, LOD adaptif): **belum dimasukkan ke kantor**. Kantor sudah punya jalan/tabrakan/LOD/obrolan sendiri; yang masuk hanya animasi, ekspresi, kamera. Lihat 05 untuk rancangan.
- Kecocokan wajah dengan demo 8765: kantor memakai 16 ekspresi kontrak (peta: neutral←idle, smile←happy, laugh←celebrate, wow←surprised, sleepy←sleep, think←thinking, talk1←speaking, talk2←curious, cry←sad+air mata, error←error) dan atlas 128 px/sel; Charcoal/Branch memakai wajah layar sederhana pipeline, bukan glyph V4.2 persis.
- FPS: pada iGPU uji, 32 rig di demo mascot ≈ 43-53 ms/frame; angka kantor tidak dibandingkan V3 vs V4 secara andal.

## Peringatan keamanan yang sudah terjadi

Saat pertama menguji dari salinan terisolasi, server salinan menyala dengan "LIVE · Groq" karena environment shell berisi kunci; dihentikan ±15 detik setelah mulai. Tidak ada log aktivitas, tetapi panggilan API tidak bisa dipastikan nol. Owner disarankan memeriksa biaya Groq hari itu. Sejak itu semua uji memakai `GROQ_API_KEY= ... RAY_GROQ_BASE_URL=http://127.0.0.1:1`.

## Pembaruan gelombang 5 (2026-11-17, malam)

- **Langkah natural:** kecepatan satu sumber `GAIT` (jalan 1,4 / lari 2,7); NPC berlari otomatis untuk jarak >28 unit, berjalan untuk jarak dekat; timeScale siklus 0,85-1,5.
- **Keluar Mode Play:** tarik-mundur sinematik halus (3,4 dtk) ke ±10 unit; FOV kembali ke pilihan pengguna. Diukur: kamera dari (14,1; 3,5; -42,2) ke (13,6; 6,3; -43,3), jarak 10, FOV 38 ke 65 (sebelumnya pandangan seluruh kampus ±180 unit).
- **Tampilan unik:** slot warna V4 + `pickMascotLook`: 171/171 agen nyata unik, 600/600 id sintetis unik. Bukti visual kerumunan: emas, merah muda, teal, lavender, koral, navy berdampingan (salinan terisolasi).
- Belum terbukti: kenyamanan kecepatan di 60 FPS; selip kaki residual pada lari; warna LED wajah tetap per template (bukan per agen).

## Pembaruan gelombang 6 (2026-11-17, malam)

- **Karakter 'rusak/gepeng' (keluhan Owner walau FOV sudah 35°):** geometri LOD0 terukur setia (siluet lebar/tinggi 0,655 vs 0,651 render Blender; kepala 0,685 vs 0,686; skala klon seragam), tetapi **LOD1 (1.425 segitiga, dipakai untuk agen 22-50 unit dan saat kualitas turun) rusak**: dibuat dengan desimasi paksa multi-tahap dari 79 ribu segitiga. Diperbaiki: LOD1 dari LOD0 dalam satu tahap, anggaran 8000/4000, ke-12 aset dibangun ulang dan dideploy (cadangan: `3D karakter\_backup_agents_v4_pre_lodfix\`). Bukti: render LOD0 vs LOD1 Azure/Branch hampir identik.
- **Sinematik pada refresh:** flag `sessionStorage` (sekali per tab) diganti `window.__rayIntroPlayed` (setiap muat halaman). Diuji dua muat berurutan di tab yang sama: judul sinematik muncul pada keduanya (detik 9 dan 7), kamera mulai dari y=180.
- `AGENT_V` = `v4-2-1117c`.
- Belum terbukti: bila tampilan terasa 'datar', penyebab yang tersisa adalah gaya pencahayaan kantor (haze, 'Gaya warna film: Lembut', bloom/DOF) yang tidak saya ubah; coba 'Alami' di Pengaturan Visual.
