> **ARSIP (2026-11-19):** dokumen sejarah, tidak lagi menggambarkan sistem sekarang. Yang berlaku: `docs/README.md`, `docs/PETA-BACKEND.md`, `docs/PETA-OTAK.md`.

> **DIGANTI:** dokumen yang berlaku ada di folder `docs/mascot-v4-2/` (mulai dari `README.md`). Berkas ini disimpan sebagai riwayat.

# Integrasi Robot Mascot V4.2 ke Ray Agent Office

Tanggal: 2026-11-17. Sumber: `D:\01-vixv\deployment\3d blender automation\agen-karakter-v3\robot_mascot_system_v4_2\` (master Blender V4.2).

## Yang berubah di aplikasi

| Berkas | Perubahan |
|---|---|
| `public/assets/characters/agents/{kiko,azure,charcoal}.glb`, `lod/*.glb`, `*.face.png`, `*.json` | Diganti dengan versi V4.2 (keluarga yang sama dengan V3). Versi V3 lama ada di `3D karakter/_backup_agents_v3_20261117/` |
| `public/assets/characters/agents/{branch}.*` | Karakter baru (ivory, layar navy, antena Y) |
| `public/assets/characters/agents/index.json` | `branch` ditambahkan |
| `public/js/assets3d.js` baris 18 | `branch` ditambahkan ke `CHIBI.ids` (daftar id di runtime ditulis tetap; `index.json` tidak dibaca runtime) |
| `public/js/assets3d.js` (blok LOD di `loadBody`) | Satu baris: Face pada geometri LOD diberi `userData.faceSheet = true` |
| `public/js/assets3d.js` baris `AGENT_V` | `v3-felt-1240` → `v4-2-1117` agar browser memuat ulang GLB |

Tidak ada perubahan pada `server/`, `public/css/`, atau file `public/js/` lain.

### Mengapa perubahan satu baris pada LOD diperlukan
`applyFace` hanya menandai material Face milik hero sebagai `faceSheet`. Geometri LOD dibuat dari GLB LOD terpisah, material Face-nya tidak ditandai, sehingga `roleId` Face menjadi 0 dan shader tidak memilih satu sel: **seluruh atlas 4×4 tampil sekaligus** pada layar karakter di LOD1. Gambar sebelum/sesudah: `evidence_v4_2/office_integration/BEFORE_fix_lod1_shows_full_face_atlas.png` dan `AFTER_fix_lod1_single_expression.png` (di folder paket mascot). Setelah perbaikan, semua geometri LOD memiliki 600 vertex ber-`roleId` 5, sama dengan hero. Jalur kode ini sama untuk karakter V3 beratlas wajah; apakah karakter V3 terdampak tidak diuji.

## Spesifikasi hasil (kontrak `BRIEF-KARAKTER-3D.md`)

| Base | LOD0 / LOD1 segitiga | LOD0 MB | Tinggi | Lolos cek pipeline |
|---|---:|---:|---:|---|
| Kiko | 5633 / 1425 | 0,66 | 1,298 m | bones, clips, ≤6000, ≤1500, ≤2,5 MB, ≤4 pengaruh, kaki di lantai, duduk 0,255 m |
| Azure | 5642 / 1425 | 0,60 | 1,300 m | sama |
| Charcoal | 5645 / 1425 | 0,57 | 1,300 m | sama |
| Branch | 5637 / 1425 | 0,59 | 1,300 m | sama |

- 24 tulang kontrak + PropL/PropR, 20 klip `CH_*` (dibuat prosedural dari sendi terukur oleh `pipeline/anim2.py`), atlas wajah 512² 4×4.
- Material tubuh bernama `LOCKED_V4_*` (tidak diwarnai ulang runtime), `screen` → `Eye`, panel `Face`. Kain Kiko (normal + roughness) tertanam.
- **Perbedaan dari V4.2 murni:** 16 ekspresi kontrak menggantikan 24 state (peta: neutral←idle, smile←happy, laugh←celebrate, wow←surprised, sleepy←sleep, think←thinking, talk1←speaking, talk2←curious, cry←sad+air mata, error←error). Kiko/Azure memakai topeng piksel V4.2; Charcoal/Branch memakai wajah layar sederhana pipeline (mirip, bukan piksel identik). Telinga Kiko ikut Head (tanpa spring). Segitiga turun dari 45–79 ribu (hero V4.2) ke ≈5,6 ribu lewat decimate; bentuk tampak nyaris identik pada render, detail kecil halus dapat hilang. Tidak ada 10 colorway/200 identitas V4: runtime hanya mewarnai material `role_*`.

## Pengujian
- Pipeline: `output/<id>4/verify.json` per karakter (re-impor GLB ke scene kosong).
- Aplikasi sungguhan dijalankan dari **salinan terisolasi** (port berbeda, mode simulasi, tanpa kunci API) dengan file `public/` yang sama dengan aplikasi ini; kantor 3D memuat keempat base tanpa galat konsol, wajah satu sel pada hero dan LOD1.
- Belum diuji: animasi berjalan/melambai/mengetik per base secara visual di kantor, perilaku di perangkat lain, performa FPS kantor dengan base baru.

## Rollback
1. Salin isi `3D karakter/_backup_agents_v3_20261117/` kembali ke `public/assets/characters/agents/` (termasuk `lod/`).
2. Hapus `branch.*` dan `lod/branch.glb`, kembalikan `index.json` dan baris `CHIBI.ids`; kembalikan `AGENT_V` ke `v3-felt-1240` atau naikkan nilainya.

## Membangun ulang
`pipeline/build_mascot.py characters/v4/<keluarga>.json` (builder `pipeline/v4.py`), lalu `python pipeline/deploy_v4.py --assets "<app>\public\assets" --backup <folder>`. Setelah deploy, naikkan `AGENT_V`.

## Pembaruan 2026-11-17 (malam): logika animasi dan ekspresi

Dilakukan atas permintaan Owner ("masukkan semua logikanya"); cadangan file sebelum perubahan: `3D karakter/_backup_runtime_before_v42_logic/` (assets3d.js, office3d.js).

Akar masalah yang ditemukan:
1. `armIK` selalu menarik **kedua** tangan ke pose istirahat tetap, kecuali Wave/gestur → lengan kiri "diam", ayunan jalan hilang. Klip `CH_Type/Talk/Nod/Shrug/HoldR/Carry/Drink/Phone/Read` tidak dipakai sama sekali.
2. Agen bergerak 2,8 (jalan) / 5,2 (lari) unit/dtk, sedangkan siklus klip jalan alami ±1,0 unit/dtk → kaki meluncur.
3. `updateFace` hanya memilih sedikit dari 16 ekspresi.

Perubahan (assets3d.js):
- Lengan digerakkan klip untuk semua state; hanya **Type** memakai IK keyboard (tangan klip melayang ±10 cm di atas meja). `SIT_CLIPS` = Sitting/Type/Read dianggap duduk.
- `stateOf` memakai Type, Talk, HoldR, Read serta gestur shrug/nod/phone/drink/read. Fidget idle (Nod, Shrug, Think, Drink, Phone) tiap ±6–17 dtk; duduk non-kerja memutar Read sesekali.
- Kecepatan siklus Walk/Run diselaraskan dengan kecepatan gerak (timeScale 0,8–2,2; selip kaki berkurang, belum nol bila kecepatan >2,2× alami).
- Napas: skala Torso ±1,1 % per agen.
Perubahan (office3d.js, `updateFace`): reaksi singkat saat status berubah (done→tertawa, blocked→error, offline→kaget saat kembali), ekspresi per status (working: fokus/berpikir bergantian; meeting/chatting: senyum/kaget/berpikir; pending/waiting: berpikir; lelah: mengantuk/sedih; offline: tidur; blocked: error), bicara dengan mulut dan sesekali tertawa, serta mikro-ekspresi acak saat diam (senyum, kedip sebelah, tawa, kaget, hati, berpikir, mengantuk).

Hasil ukur (salinan terisolasi, animasi dimajukan manual karena pane uji hanya ±1 FPS): jalan Charcoal ayunan telapak kiri 0,270 m / kanan 0,269 m (sebelumnya kiri hampir diam); duduk telapak simetris (±0,30); mengetik kedua tangan bergerak, tinggi 0,82 (meja 0,735 + radius tangan); idle memutar Phone, duduk memutar Read; tanpa galat JS; kantor penuh termuat (206 skinned mesh).

Belum diuji secara visual/FPS nyata: semua gerakan di browser normal (hard refresh Ctrl+F5 dibutuhkan agar JS baru dimuat), kenyamanan fidget, selip kaki saat lari, mode Play.

## Pembaruan 3 (2026-11-17): robot gepeng + sinematik pembuka

- **Robot gepeng:** `resolveAppearance` memberi tiap agen `build` acak 0,92–1,08 yang mengalikan lebar (x/z) badan, dan `height` 0,95–1,05. Untuk badan chibi V4 lebar kini selalu 1 (`assets3d.js`, `clone.scale.set(scale * (chibi ? 1 : ap.build), ...)`). Tinggi tetap bervariasi seragam (tanpa distorsi bentuk).
- **Sinematik pembuka** (`office3d.js`: `cinematicIntro/stepIntro/endIntro`, API `cinematicIntro, hasAvatar, introActive`; `views.js`: pemicu di `OfficeView.mount`): pada kunjungan pertama di tab (sessionStorage `rayIntroDone`), kamera melayang pelan di pandangan udara ±3,4 dtk, lalu menukik ±9,5 dtk (ease-in-out, melewati titik tinggi di atas karakter) ke belakang karakter Owner, lalu otomatis masuk Mode Play lewat `OfficeView.togglePlayer()`. Letterbox + judul "RAY AGENT OFFICE"; tombol/klik apa saja melewati. Nonaktifkan dengan `?nointro` di URL. Diuji di salinan terisolasi (batas dt dilonggarkan khusus uji karena pane ±1 FPS): kamera turun dari y=180 ke y=3,5 dan Mode Play aktif.
- Cadangan: `3D karakter/_backup_runtime_before_v42_logic/pass3/` (assets3d.js, office3d.js, views.js sebelum pembaruan ini).
