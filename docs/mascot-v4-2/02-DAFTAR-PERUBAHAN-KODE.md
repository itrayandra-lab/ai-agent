# 02. Daftar perubahan kode (yang HARUS dipertahankan)

Semua perubahan ada di tiga berkas JS. Tidak ada perubahan di `server/` maupun CSS. Setiap butir: **di mana**, **apa**, **mengapa**, **gejala bila dibuang**, **cara memeriksa** (penjaga `verify-v42.mjs` memeriksa semuanya secara otomatis).

Cadangan versi sebelum tiap gelombang edit: `3D karakter\_backup_runtime_before_v42_logic\` (gelombang 1-2: `assets3d.js`, `office3d.js`), `...\pass3\` (assets3d, office3d, views), `...\pass4\` (office3d).

## A. `public/js/assets3d.js`

| # | Lokasi | Perubahan | Mengapa | Gejala bila dibuang |
|---|---|---|---|---|
| A1 | `const CHIBI = {... ids: [...] }` (±baris 18) | 12 id: kiko, kiko_ocean, kiko_coral, azure, azure_ocean, azure_coral, charcoal, charcoal_ocean, charcoal_coral, branch, branch_ocean, branch_coral. Id lama (terra, mallow, blueprint, sprout, clover, sage) dihapus | Owner ingin hanya karakter V4.2; daftar ini DITULIS TETAP, `index.json` tidak dibaca runtime | Karakter lama muncul lagi / Branch dan colorway tidak dimuat |
| A2 | Di `loadBody`, setelah `const lodRoot = (await glb.loadAsync(lodUrl)).scene;` | `if (info) materialsOf(lodRoot).forEach((m) => { if (String(m.name).split('\|')[0] === 'Face') m.userData.faceSheet = true; });` | `applyFace` hanya menandai material Face milik hero; LOD tidak ditandai sehingga shader tidak memilih satu sel | Layar karakter di LOD1 (jauh/kualitas rendah) menampilkan SELURUH atlas 16 ekspresi sekaligus |
| A3 | `const AGENT_V = '...'` | Dinaikkan tiap deploy aset (`v4-2-1117b` sekarang) | cache-bust GLB | Browser memuat GLB lama dari cache |
| A4 | Baris `clone.scale.set(scale * (chibi ? 1 : ap.build), scale, scale * (chibi ? 1 : ap.build));` | Lebar badan chibi tidak lagi dikali `ap.build` (acak 0,92-1,08 per agen) | Menjaga proporsi desain; sebagian robot tampak gepeng | Robot melebar/gepeng ±14 % |
| A5 | `GEST_CLIP` + `SIT_CLIPS` (di atas `loadBody`) | `GEST_CLIP` ditambah shrug/nod/phone/drink/read; `SIT_CLIPS = Set(Sitting, Type, Read)` | Klip kontrak CH_* sebelumnya tidak dipakai | Gestur tidak memakai klip; Type/Read dianggap berdiri (agen melayang di kursi) |
| A6 | `stateOf` | Memakai klip `Type` (duduk+working), `Read`, `HoldR` (membawa benda), `Talk`; fidget idle (Nod/Shrug/Think/Drink/Phone tiap ±6-17 dtk); `Read` sesekali saat duduk non-kerja | Agen hidup, tidak membeku | Agen diam kaku, tangan tidak sesuai aktivitas |
| A7 | `const sitting = SIT_CLIPS.has(name);` | Duduk mencakup Type/Read | Agar seat/legs IK tetap aktif | Agen "berdiri" di atas kursi saat mengetik |
| A8 | `const clipDriven = !!acts[name] && name !== 'Type';` | Lengan digerakkan klip untuk semua state; hanya **Type** memakai IK keyboard | `armIK` sebelumnya menarik KEDUA tangan ke pose tetap: lengan kiri diam, ayunan jalan hilang. Tangan klip Type melayang ±10 cm di atas meja | Lengan kiri "selalu diam", tidak ada ayunan lengan |
| A9 | Blok `// gait:` sebelum `mixer.update(dt)` | `act.timeScale = Math.min(2.2, Math.max(0.8, v / nat))` untuk Walk/Run (v = 2.8 / 5.2, nat = walkStride*scale/0.54 (x1.9 untuk Run)) | Agen bergerak 2,8 u/dtk, siklus alami ±1,0 u/dtk → kaki meluncur | Moonwalk / kaki meluncur |
| A10 | Setelah `mixer.update` | Napas: `bones.Torso.scale.set(2 - br, br, 2 - br)` (br = 1+0,011 sin) | Kehidupan halus | (kosmetik) |
| A11 | `const breathSeed = ...` setelah `let curName...` | Fase napas per agen | | |

Catatan A9 (diperbarui gelombang 5): kecepatan sekarang satu sumber, `export const GAIT = { walk: 1.4, run: 2.7 }` di assets3d.js, dipakai oleh `office3d.js` (NPC dan pemain) dan blok gait. **Ubah kecepatan hanya lewat GAIT**, dan jaga rasio ke kecepatan alami klip (jalan ≈1,04 u/dtk, lari ≈2,0 u/dtk; timeScale dibatasi 0,85-1,5).

### Gelombang 5 (jalan/lari natural, keluar Play halus, tampilan unik)

| # | Lokasi | Perubahan | Mengapa | Gejala bila dibuang |
|---|---|---|---|---|
| A12 | assets3d.js `export const GAIT` + blok gait | Kecepatan jalan 1,4 / lari 2,7 (sebelumnya NPC 2,6, pemain 2,8/5,2), timeScale 0,85-1,5 | Langkah terlalu cepat; jalan dan lari tidak dibedakan | Kaki 'berlari di tempat', jalan = lari |
| A13 | assets3d.js `V4_ROLE`, `roleId`, uniform `roleColors[8]`, uji Face `abs(roleId - 5.0) < 0.5` | Bagian V4 (`LOCKED_V4_body/bezel/accent/shell/cloth`) mendapat slot warna per agen (1,2,3,4,6) | Pewarnaan per agen untuk 200+ karakter | Semua agen sebadan tampak kembar |
| A14 | assets3d.js `buildFbxRig`: `const look = ... pickMascotLook(...)`, `bodyMaterial` key + `hex.cloth`, `heroMatsFor` | Palet deterministik per id agen (colorway 10 x edisi 5 x variasi halus); jaket hero Kiko (bertekstur) di-clone per tampilan | 171 dari 171 agen nyata dan 600 dari 600 id sintetis unik | Kembar |
| A15 | **berkas baru** `public/js/mascot-palettes.js` | `MASCOT_PALETTES`, `EDITION_ACCENTS`, `pickMascotLook(id, family)` (dihasilkan dari `config/agents_200.json`) | Sumber palet | Impor gagal, aset tidak termuat |
| B8 | office3d.js NPC `step` | `a.running` otomatis: lari bila jarak ke tujuan akhir >28 (hysteresis <14), kecepatan `GAIT` | Jalan vs lari jelas | semua jalan / semua lari |
| B9 | office3d.js `softPullBack/stepPull` (+ `let pull`, cabang `else if (pull) stepPull(realDt)`) dan di `exitPlayer`: `} else softPullBack(a);` | Keluar Mode Play: tarik-mundur sinematik 3,4 dtk ke ±10 unit di belakang/atas karakter, FOV kembali ke pilihan pengguna | Owner: jangan zoom jauh saat keluar Play | Kamera melompat ke overview seluruh kampus |
| B10 | office3d.js import `GAIT` dan pemain `const sp = (a.running ? GAIT.run : GAIT.walk) * dt` | | | |

## B. `public/js/office3d.js`

| # | Lokasi | Perubahan | Mengapa | Gejala bila dibuang |
|---|---|---|---|---|
| B1 | `function updateFace(a, now, gest, mood)` | Ekspresi per status (working: fokus/berpikir; meeting/chatting: senyum/kaget/berpikir; pending/waiting/todo: berpikir; done: senyum; blocked: error; offline: mengantuk; lelah: mengantuk/sedih), reaksi singkat saat status berubah (`a.react`, `a.lastSt`), bicara dengan tawa sesekali, **mikro-ekspresi idle** (`a.micro`, `a.microNext`: senyum/kedip sebelah/tawa/kaget/hati/berpikir/mengantuk) | Owner: "ekspresi itu-itu saja, tidak ekspresif" | Wajah monoton (neutral/focus/smile saja) |
| B2 | Blok `// ───── opening cinematic` sebelum `function lockMouse()` | `let intro`, `PLAY_FOV = 38`, `easeIO`, `cinematicIntro(onDone)`, `endIntro(done)`, `stepIntro(dt)` | Owner: mulai dari pandangan udara, zoom pelan ke karakter, langsung Mode Play | Tidak ada sinematik pembuka |
| B3 | Loop render: `if (intro) stepIntro(realDt);\n else if (camAnim) {...` | Intro mengambil alih kamera selama berlangsung | | Intro tidak berjalan |
| B4 | Objek return: `enterPlayer, exitPlayer, isPlayer: () => !!player, cinematicIntro, hasAvatar: (id) => avatars.has(id), introActive: () => !!intro,` | API untuk views.js | | `views.js` error (office.cinematicIntro bukan fungsi) |
| B5 | Cabang kamera orang-ketiga Mode Play: setelah `controls.target.lerp(target, ...)` | `{ const tf = Math.min(V.fov, PLAY_FOV); ... camera.fov += ...; camera.updateProjectionMatrix(); }` | **FOV 65° default meregangkan objek di tepi layar**: kepala Azure terukur 1,22x lebar/tinggi di tengah vs 1,61x di tepi (+32 %). FOV 38° → +9 % | Robot/wajah tampak gepeng/melebar saat dekat tepi layar |
| B6 | `function exitPlayer() {` baris pertama | `camera.fov = V.fov; camera.updateProjectionMatrix();` | Kembalikan FOV pilihan pengguna | FOV sempit tertinggal setelah keluar dari Play |
| B7 | Di `stepIntro` dan `endIntro` | FOV menyempit selama menukik; dipulihkan bila intro dibatalkan | | Lompatan FOV saat masuk Play |

Properti baru pada objek agen (dipakai B1/A6, jangan dipakai ulang untuk hal lain): `a.react`, `a.lastSt`, `a.micro`, `a.microNext`, `a.fidget`, `a.fidgetAt`.

## C. `public/js/views.js`

| # | Lokasi | Perubahan | Mengapa |
|---|---|---|---|
| C1 | `OfficeView.mount`: setelah `ensureOffice().then(() => { office.setVisible(true); ... })` | Pemicu intro: **setiap muat halaman** (flag `window.__rayIntroPlayed`, bukan sessionStorage: refresh memutar ulang; berpindah tab di dalam aplikasi tidak), menunggu avatar `owner` (`office.hasAvatar('owner')`, polling 500 ms, maks 40 dtk), lalu `office.cinematicIntro(() => { if (!office.isPlayer()) OfficeView.togglePlayer(); })`. `?nointro` di URL menonaktifkannya; tidak dijalankan bila `S.params.focus` ada | Alur intro → Mode Play |

Perilaku intro: ±3,4 dtk melayang di pandangan udara, ±9,5 dtk menukik (ease-in-out) ke belakang karakter Owner, FOV 65→38, letterbox + judul "RAY AGENT OFFICE", tombol/klik apa saja melewati.

## D. Aset (bukan kode)

`public/assets/characters/agents/` berisi 12 id × 4 berkas + `index.json`. Lihat `04-ASET-DAN-PIPELINE.md`. **Jangan diedit tangan.**

## Cara memeriksa cepat

```
node docs/mascot-v4-2/verify-v42.mjs
```
Memeriksa semua butir A-D (58 pemeriksaan). Untuk butir perilaku (bukan sekadar kehadiran kode) lihat prosedur uji di `03-ATURAN-DAN-CARA-KERJA.md`.
