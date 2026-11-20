# 04. Aset dan pipeline

## Kontrak yang dipenuhi (`docs/BRIEF-KARAKTER-3D.md`)

- Satuan meter, Y-up, menghadap +Z, tinggi 1,30 m, telapak di y=0.
- 24 tulang berurutan nama: `Root, Hips, Abdomen, Torso, Neck, Head, Shoulder/UpperArm/LowerArm/Palm/Fingers/Thumb (L,R), UpperLeg/LowerLeg/Foot (L,R)` + `PropL`, `PropR`. L = +X.
- Material: tubuh bernama `LOCKED_V4_*` (tidak diwarnai ulang runtime; warna kanonik V4.2), layar gelap = `Eye`, panel ekspresi = `Face` (UV 0..1, atlas 4×4). `role_*` tidak dipakai, sehingga warna per divisi pada jas TIDAK berlaku untuk V4.2.
- 20 klip dasar: `CH_Standing, CH_Idle, CH_Walk, CH_Run, CH_Sitting, CH_SitDown, CH_StandUp, CH_Type, CH_Read, CH_HoldR, CH_Carry, CH_Drink, CH_Phone, CH_Talk, CH_Nod, CH_Shrug, CH_Wave, CH_Clapping, CH_Cheer, CH_Think`. Dibuat prosedural dari sendi terukur (`pipeline/anim2.py`), semuanya menganimasikan lengan; runtime menamai aksi dengan token terakhir setelah `_` (mis. `Type`).
- Atlas wajah 512² (4×4 sel 128 px), putih/transparan, urutan: neutral, blink, smile, laugh, wow, love, angry, sad, cry, sleepy, wink, think, talk1, talk2, focus, error. `faceStyle: screen`, `faceTint` dari warna LED tiap id.
- Anggaran: **LOD0 ≤8000, LOD1 ≤4000 segitiga** (brief asli 6000/1500; dinaikkan 2026-11-17 karena LOD1 1500 menghancurkan bentuk bulat: kepala kotak, telinga runcing, jaket bergerigi), GLB ≤2,5 MB, ≤4 pengaruh tulang per vertex, tanpa shape key/Draco. Pipeline: LOD0 didesimasi dari mesh hero sekali jalan; **LOD1 diturunkan dari LOD0 dalam satu tahap** (`lod1_from_lod0`), bukan dari 79 ribu segitiga. Kiko menyertakan normal+roughness map kain (tertanam).
- Manifest `<id>.json`: tinggi, hips/knee/ankle, seatHip, palmL/R, propL/R, walkStride, klip, ekspresi, tris, files, faceStyle, faceTint, springs (kosong), designColors, seat {hipHeight, thighLow, feetFlat}, notes.

## Ukuran tiap id

| Id | LOD0/LOD1 segitiga | GLB (MB) | Tinggi (m) |
|---|---|---|---|
| kiko* | ≈7580 / 3779 | 0,75 | 1,298 |
| azure* | ≈7588 / 3779 | 0,68 | 1,300 |
| charcoal* | ≈7595 / 3779 | 0,65 | 1,300 |
| branch* | ≈7585 / 3779 | 0,66 | 1,300 |

## Asal-usul aset

Sumber: master Blender V4.2 di `D:\01-vixv\deployment\3d blender automation\agen-karakter-v3\robot_mascot_system_v4_2\models\<base>\<base>_MASTER.blend` (hero 45-79 ribu segitiga) dan GLB colorway `<base>_NN.glb`. Dikonversi oleh builder `pipeline\v4.py` (T-pose lengan, penamaan tulang kontrak, penghapusan glyph FACE_* diganti panel Face, material → LOCKED_V4_*, decimate ke anggaran, ekspor LOD0/LOD1, verifikasi re-impor). Konfigurasi: `characters\v4\<id>.json` (warna layar/LED dari `config/canonical_palettes.json` dan `config/agents_200.json`).

Atlas wajah Kiko/Azure digambar dari topeng piksel V4.2 (`textures/*_faces.npz`) pada rasio panel terukur (piksel tetap persegi; supersampling 4×); Charcoal/Branch memakai `faces.atlas` pipeline.

Colorway: Ocean = colorway 1, Coral = colorway 6 dari `design.py`.

## Cara membangun ulang / menambah aset (dilakukan sesi 3D, bukan runtime)

```
cd "D:\01-vixv\deployment\3d blender automation"
"Blender 5.2\blender.exe" -b --factory-startup -P pipeline/build_mascot.py -- characters/v4/<id>.json
"Blender 5.2\5.2\python\bin\python.exe" pipeline/deploy_v4.py --assets "<app>\public\assets" ^
   --backup "<app>\3D karakter\_backup_agents_v3_20261117" --ids <daftar id lengkap, dipisah koma> --exclusive
```
`--exclusive` menjadikan `index.json.ids` persis daftar yang diberikan dan memindahkan id lain ke cadangan. Setelah deploy: samakan `CHIBI.ids`, naikkan `AGENT_V`, jalankan penjaga (perbarui daftar `IDS` di `verify-v42.mjs` bila id berubah).

Contoh menambah colorway baru (mis. Lavender = colorway 5 untuk Kiko): buat `characters/v4/kiko_lavender.json` dari `kiko_ocean.json` (ubah `id`, `name`, `v4` ke `models/kiko/kiko_05.glb`, warna dari palet 5), bangun, deploy, tambahkan id ke `CHIBI.ids`.

## Permintaan aset ke sesi 3D

Sertakan: id/ciri yang diinginkan, alasan (mis. "perlu variasi warna", "klip baru X"), dan batas (tidak mengubah proporsi dasar). Jangan meminta perubahan bentuk yang menjauhi desain (kepala besar, tubuh pendek-bulat, tanpa jari manusia/humanoid).

## Paket sumber (referensi)

`robot_mascot_system_v4_2\docs\V4_2_CHANGES.md` (apa yang diubah dari V4.1 dan mengapa), `docs\VALIDATION.md` (angka pengujian, keterbatasan), `docs\INTEGRATION.md` (kontrak runtime demo: BackendBridge, interaksi/kontak, LOD adaptif). Pengujian: `node checks/run_all.mjs` di paket itu.
