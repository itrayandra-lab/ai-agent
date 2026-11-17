# Brief untuk sesi Claude 3D (Blender) — karakter Ray Agent Office

Kamu membuat aset. Runtime (Three.js) dipegang sesi lain. **Jangan ubah file di `public/js/`, `public/css/`, `server/`.**
Hasilmu dianggap selesai hanya kalau lolos semua "Kontrak" di bawah — runtime membaca nama bone/material/klip persis seperti tertulis.

## 1. Keluaran (taruh persis di sini)
- `D:\01-raymaizing\01-deployments\ray agent\public\assets\characters\agents\<id>.glb` (LOD0)
- `...\agents\lod\<id>.glb` (LOD1, skeleton & nama bone sama)
- `...\agents\<id>.face.png` (atlas ekspresi, lihat §4)
- `...\agents\<id>.json` (manifest, lihat §7)
- `...\public\assets\props\<nama>.glb` (properti, lihat §5)
- Jangan timpa `bp_agent.glb` yang sedang dipakai; pakai id baru (mis. `bp_agent2`). Runtime akan pindah setelah lolos cek.

## 2. Kontrak badan
- Satuan meter, Y-up, menghadap **+Z**, origin di lantai di antara dua kaki, telapak tepat di y=0 (tidak tenggelam, tidak melayang).
- Tinggi total **1.30 m** (chibi, kepala besar). Hips ±0.41, lutut ±0.23, pergelangan kaki ±0.09. Kalau proporsi berubah, tulis angka barunya di manifest.
- Satu armature, satu SkinnedMesh kalau bisa (maks 2), maks 4 pengaruh bone per vertex, transform di-apply (scale 1, rotasi 0).
- Nama bone **persis** (tanpa titik/spasi): `Root, Hips, Abdomen, Torso, Neck, Head, ShoulderL, UpperArmL, LowerArmL, PalmL, FingersL, ThumbL, ShoulderR, UpperArmR, LowerArmR, PalmR, FingersR, ThumbR, UpperLegL, LowerLegL, FootL, UpperLegR, LowerLegR, FootR` (+ opsional `Cape1, Cape2`).
- Tambah 2 bone tempel tanpa bobot: `PropL` (anak PalmL) dan `PropR` (anak PalmR), posisinya di tengah genggaman; sumbu **+Y searah gagang**, **+Z keluar dari telapak**.
- Lengan & kaki harus bisa ditekuk IK: siku dan lutut punya loop topologi, rest pose lengan lurus (T/A-pose), lutut sedikit menekuk ke depan. Tangan: minimal sarung tangan "mitten" + jempol terpisah yang bisa menggenggam.
- Anggaran: LOD0 ≤ 6.000 segitiga, LOD1 ≤ 1.500, total tekstur ≤ 1024², file ≤ 1,5 MB (Draco/meshopt JANGAN, runtime tidak memuat decoder). Tanpa shape key.

## 3. Material (nama menentukan pewarnaan per agen)
Runtime mewarnai ulang tiap agen lewat nama material. Bagian yang diwarnai harus **putih/abu terang** di base color (warna dikalikan):
`role_skin|Skin`, `role_hair|Hair`, `role_top|Suit`, `role_bottom|Under`. Bagian tetap: `Belt`, `Glove`, `Trim`, `Eye`, `Frame`, `role_glow|Glow` (emissive), `role_cape|Cape`.
Wajah/visor: material bernama **`Face`** pada satu bidang/kaca melengkung di depan kepala, UV-nya mengisi penuh 0..1 (lihat §4). Tanpa tekstur transparan selain `Face`.

## 4. Ekspresi (gaya layar robot lucu, seperti referensi helm biru)
- `<id>.face.png`: atlas 1024×1024, grid **4×4**, latar transparan, gambar putih/terang tebal (akan menyala/emissive), tiap sel berpusat.
- Urutan sel kiri→kanan, atas→bawah: `neutral, blink, smile, laugh, wow(bintang), love(hati), angry, sad, cry, sleepy, wink, think(…), talk1, talk2, focus(mata sipit), error(!)`.
- Mata harus terbaca dari jarak 15 m: bentuk besar, sederhana, tebal.

## 5. Properti yang dipegang (seperti poster "16 types")
- GLB terpisah per benda, origin **di titik genggam**, +Y searah gagang, skala nyata untuk karakter 1,3 m, ≤ 800 segitiga, satu material vertex-color (tanpa tekstur).
- Daftar: `laptop, tablet, phone, book_open, mug, clipboard, pen, wrench, camera, magnifier, headset, box, microphone, brush, megaphone, calculator`.

## 6. Animasi (klip in-place, tanpa root motion, loop mulus kecuali ditandai)
Nama persis: `CH_Idle, CH_Standing, CH_Walk, CH_Run, CH_Sitting, CH_Wave(sekali), CH_Clapping, CH_Cheer(sekali), CH_Think`.
Tambahan baru: `CH_Type` (duduk mengetik), `CH_Read` (duduk/berdiri memegang buku dua tangan), `CH_HoldR` (berdiri, tangan kanan menggenggam benda setinggi dada), `CH_Carry` (dua tangan membawa kotak), `CH_Drink`, `CH_Phone`, `CH_Talk`, `CH_Nod`, `CH_Shrug`, `CH_SitDown(sekali)`, `CH_StandUp(sekali)`.
- `CH_Sitting`: paha mendatar, lutut 90°, pantat di y≈0.25–0.30 (kursi runtime 0.255 m), punggung tegak, telapak rata di lantai.
- Semua klip harus menganimasikan lengan dengan benar (klip lama membiarkan lengan T-pose — itu bug, jangan diulang). Tangan tidak boleh menembus badan/paha.
- Jalan: kaki tidak meluncur (langkah ≈ 0,55 m per siklus pada 1,0 m/s), tumit-jari, lengan berayun berlawanan.

## 7. Manifest `<id>.json`
`{ "height":1.30, "hips":0.41, "knee":0.23, "ankle":0.09, "clips":[...], "expressions":[...16 nama...], "tris":{"lod0":n,"lod1":n}, "walkStride":0.55 }`

## 8. Cek sebelum bilang selesai (wajib, lampirkan hasilnya)
1. Impor ulang GLB ke scene kosong → cetak daftar bone, material, klip, jumlah segitiga, ukuran file; bandingkan dengan §2–§6.
2. Render preview PNG: depan, samping, belakang; pose duduk dari samping (di kursi 0.255 m); pose `CH_HoldR` dengan `wrench` menempel di `PropR`; lembar 16 ekspresi.
3. Uji di `http://localhost:4317/rig-test.html?state=sit&view=side` (juga `walk`, `wave`, `type`) setelah menyalin file.
4. Laporkan jujur apa yang belum lolos. Jangan klaim "sempurna" tanpa gambar bukti.
