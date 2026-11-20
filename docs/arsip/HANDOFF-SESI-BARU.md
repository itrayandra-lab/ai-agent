> **ARSIP (2026-11-19):** dokumen sejarah, tidak lagi menggambarkan sistem sekarang. Yang berlaku: `docs/README.md`, `docs/PETA-BACKEND.md`, `docs/PETA-OTAK.md`.

# HANDOFF untuk sesi baru: RAIVERSE AGENT (Ray Agent Office)

Ditulis 2026-11-17 (malam) oleh sesi "runtime" yang memegang `public/js`, `public/css`, `server/`. Tujuan: sesi baru bisa langsung paham semuanya, termasuk perubahan terbaru dari sesi 3D. **Baca file ini sampai habis, lalu baca `docs/mascot-v4-2/README.md`.** Semua pekerjaan belum di-commit (branch `main`, commit terakhir `f987945`).

---

## 0. Kebiasaan wajib (dari kesalahan nyata)

1. Sebelum dan sesudah mengedit `public/js/assets3d.js`, `office3d.js`, `views.js`: jalankan `node docs/mascot-v4-2/verify-v42.mjs` (terakhir 71 cek lolos). Edit bedah dengan anchor unik, jangan menulis ulang file utuh. Lalu `node --check <file>`.
2. Jangan menyentuh `public/assets/characters/agents/` dan jangan menjalankan `build_mascot.py`/`deploy_v4.py` (milik sesi 3D).
3. Jangan menjalankan uji dengan `GROQ_API_KEY` terisi. **Server preview port 4317 (`.claude/launch.json` "ray-office") terakhir tercatat "Mesin AI: LIVE · Groq"** karena mewarisi environment shell. Untuk uji: salinan folder, `GROQ_API_KEY= ANTHROPIC_API_KEY= RAY_GROQ_BASE_URL=http://127.0.0.1:1`, port lain, log harus "Mesin AI: SIMULASI". Server milik Owner berjalan di `localhost:4400`.
4. Laporkan jujur: sebutkan apa yang diuji dan apa yang belum. Jangan klaim "sempurna".
5. Jangan commit/push tanpa diminta. Jangan hapus `3D karakter/_backup_*`.
6. Jangan menyalin email/info pribadi Owner ke layanan luar. `GROQ_API_KEY` hanya di `.env` (gitignored), jangan dicetak.
7. Panel preview browser tersembunyi/tidak fokus membatasi rAF ±1 FPS: hasil animasi/screenshot dari sana tidak bisa dipercaya. Dalam sesi ini panel juga sering dipakai langsung oleh Owner; jangan menavigasi tab yang sedang mereka pakai tanpa perlu.
8. Bash heredoc dengan apostrof/backtick sering rusak di shell ini: pakai Write/Edit, atau skrip patch `.mjs` dengan fungsi `rep(s, a, b)` yang melempar galat bila anchor tidak ketemu.

### Kesalahan saya sendiri yang jangan diulang
- Argumen builder properti tertukar (kode warna dipakai sebagai lebar jutaan meter) membuat halaman crash, lalu layar putih (mode terang) / hitam (mode gelap). Periksa signature builder; uji dekorasi baru dalam jumlah kecil dulu.
- `RoundedBoxGeometry` berulang di properti membuat geometri gabungan meledak di memori. Properti berulang pakai `box` biasa.
- Nama konstanta `PR` bentrok dengan konstanta profiler yang sudah ada; variabel lokal (`boltMat`) dipakai dari loop frame di luar scope. `grep` nama dulu.
- Memakai `pm()` sebelum didefinisikan (TDZ/scope). Gunakan `std2`.

---

## 1. Proyek dan Owner

- Lokasi: `D:\01-raymaizing\01-deployments\ray agent`. Node 26 tanpa framework, DB JSON (`data/db.json`), JS vanilla + Three.js 0.187, UI Bahasa Indonesia informal, port default 4317. Perusahaan fiktif "Ray Group" (RayFlow SaaS + Ray Beauty).
- Brand: **RAIVERSE AGENT**. ±171 agen AI (22 divisi) + 1 manusia (Owner), hirarki PA → master → kepala divisi, Groq-first (gpt-oss-120b/20b), rapat, notulen, Brain (knowledge, 600+ catatan), cron, MCP, approvals.
- Owner: kritikus 3D tingkat Enscape/SketchUp. Selalu menekankan: **sangat ringan di PC lemah (CPU/memori)**, tampilan sinematik/realistis/tenang, tidak berkedip, dimensi realistis, tidak kosong/lowong, jelas dan tidak berantakan. Berbahasa Indonesia santai. Memakai Chrome sendiri (GPU asli) di port 4400.
- Visi Owner: interaksi ala Sims 4 (menu pie, kebutuhan, plumbob, dialog pintar), UI glassmorph ala inZOI, dunia realistis, hemat token Groq. Jangan menyalin aset dari instalasi Sims 4 (hanya referensi visual).
- Memori otomatis Claude: `C:\Users\raymaizing\.claude\projects\D--01-raymaizing-01-deployments-ray-agent\memory\` (MEMORY.md, `ray-agent-office-project.md`, `ray-agent-office-handoff.md`, `ray-agent-mascot-v42-rules.md`).

## 2. Pembagian wewenang dengan sesi 3D

Sesi "3D / mascot" (pipeline Blender di `D:\01-vixv\deployment\3d blender automation\`) memegang aset karakter dan, atas izin Owner, juga mengedit beberapa file runtime (gelombang 1-12). Ia memberi tahu lewat pesan lintas-sesi dan mendokumentasikan di `docs/mascot-v4-2/` (README, 01–07, `verify-v42.mjs`, `bukti/`). Yang berlaku: folder itu. Dokumen lama `docs/V4_2-MASCOT-INTEGRATION.md` dan `docs/INSTRUKSI-SESI-RUNTIME-V4_2.md` hanya riwayat.

Ringkasan perubahan sesi 3D yang WAJIB dipertahankan (detail di `02-DAFTAR-PERUBAHAN-KODE.md` dan `07-...`):
- 12 karakter Robot Mascot V4.2 (kiko/azure/charcoal/branch × kanonik/ocean/coral), `CHIBI.ids` ditulis tetap di `assets3d.js` dan harus sama dengan `index.json`; `AGENT_V` dinaikkan tiap deploy (terakhir `v4-2-1117c`). Aset dibangun ulang dengan anggaran LOD0 8000 / LOD1 4000 segitiga; LOD0 dipakai <22 unit, LOD1 22-50.
- Lengan digerakkan klip (bukan `armIK` untuk semua state; IK hanya untuk `Type`), `GAIT = {walk:1.4, run:2.7}` diekspor dari assets3d.js dan dipakai office3d.js (NPC dan pemain), lebar badan chibi tidak dikali `ap.build`, napas Torso, fidget idle, ekspresi kaya + mikro-ekspresi (`updateFace`), tampilan unik per agen (`public/js/mascot-palettes.js`, slot warna V4, 171/171 unik; jangan kembalikan `roleColors[6]`).
- Mode Play: FOV dibatasi `PLAY_FOV = 38` (jangan naikkan), keluar Play memakai `softPullBack` (bukan `fitCamera('iso')`), sinematik pembuka `cinematicIntro(onDone, opts)` setiap muat halaman (flag `window.__rayIntroPlayed`, bukan sessionStorage), klik PLAY memutar sinematik dari posisi kamera terakhir, `?nointro` mematikan intro. Tombol Play kembali "PLAY" setelah Esc.
- Pasca-proses: FXAA ditambahkan sebelum pass grade dengan `grade.needsSwap=false`. **Jangan memindahkan FXAA setelah grade atau menambah pass yang ikut swap: layar hitam.** Fokus DOF Play = `player.dist + 0.6`; `applyVisual` menjaga lensa saat Play/sinematik.
- Chat: `renderTalk` di views.js menjaga fokus/caret input.
- CSS: `public/css/glass.css` baru + 1 `<link>` di `index.html` (UI glassmorph di luar 3D; `app.css` tidak diubah; rollback = hapus satu baris link).
- Plaza relayout (pass 8): `BRAIN_K = 0.95`, `FOUNT_K = 0.62`, cincin situs dalam `RR` 12.5→17, Sky Deck Timur/Barat 22.5/23, booth pitch 188°, cincin bangku/berdiri sekeliling Brain 8.2 / 7.6.
- Pass 10: dekor luar dikurangi (rumput pendek; pulau/lentera/drone/mobil/burung dikurangi).
- Pass 11 (server): `ensureGroup` + `orchestrate()` di `server/engine.js`, grup bergiliran, `@mention` hanya anggota DM/grup, `chatBusy`, `POST /api/orchestrate` di `server/index.js`. **Server perlu restart agar berlaku.**
- Pass 12 (klien): dock Orkestrator di OfficeView (`views.js` dock*, `glass.css .odock`), `office3d.js` `setInset` + spotlight.
- Cadangan: `3D karakter\_backup_runtime_before_v42_logic\pass3 … pass12`, `_backup_agents_v3_20261117`, `_backup_agents_v4_pre_lodfix`.

## 3. Arsitektur singkat

### Server (`server/`)
`index.js` (HTTP API + static), `store.js` (JSON DB + migrasi), `engine.js` (agen, tugas, rapat, orkestrasi), `llm.js` (Groq; `flattenTools` bila tanpa tools), `roster.js`/`roster-teams.js`/`seed.js` (22 divisi, tim), `catalog.js` (skill/tool/kapabilitas universal), `collab.js`, `governor.js` (membatasi tugas buatan AI saja), `librarian.js` (Brain auto-filing "<Divisi>/<Tipe>"), `knowledge/index.js`. Tes: `node --test` (9 lolos, `test/engine-v6.test.js`). Penyedia 'auto' memilih Groq; `ANTHROPIC_API_KEY` di lingkungan preview BUKAN milik Owner, jangan dipakai.

### Klien (`public/js/`)
- `core.js` (state, `navigate`, intercept `S.embedHook`/`S.embedUntil`), `app.js`, `views.js` (semua halaman, `OfficeView`, panel visual 🎛, pie menu, jendela aplikasi di dalam 3D `openApp/closeApp`, dock Orkestrator, banner `OfficeView.lower`), `icons.js`, `studio.js`, `knowledge-view.js`, `appearance-ui.js`.
- `office3d.js` (±3000 baris, inti 3D): `createOffice`, `build()`, loop `frame()`, agen, plaza, kamera, Mode Play, efek.
- `environment.js` (kota/langit/jalur terbang, `GradeShader`: DOF, haze, aberasi kromatik, split-toning), `life.js` (awan, cirrus, contrail, aurora), `furniture.js` (furnitur/material/tekstur prosedural, `F.*`), `assets3d.js` (karakter, rig, IK, animasi), `mascot-palettes.js`, `sfx.js` (WebAudio: musik tenang + efek, `office-audio`), `chatter.js` (dialog Indonesia bervariasi), `props.js` (dekorasi divisi, lihat §5).
- `public/rig-test.html?state=sit|type|stand|walk|wave&view=...` panggung uji pose (tidak menerima id badan langsung; lihat 03 di mascot-v4-2).
- Hook debug: `window.__ray3d` (scene, camera, controls, renderer, `step(n)`, `sendTo(id, tag)`, `plazaSpots`, `play(id)`, `sit()`), `window.__avatars`.

### Konsep kunci di `office3d.js`
- Denah: 27 pod bundar kaca dalam dua cincin mengelilingi plaza; koordinat denah = koordinat dunia (identitas). Bangunan lama bertingkat memakai `toWorld()` dan `wp(a)/wpY(a,h)` (jangan baca `a.g.position` untuk kamera/efek; agen memakai `matrixAutoUpdate=false`).
- `mergeStatic()` menggabungkan SEMUA mesh statis per material (lihat `skipMerge`: InstancedMesh, `userData.dynamic`/`keep`, pickables dikecualikan). Hal yang bergerak harus ditandai `dynamic`/`keep`. Material tekstur dunia: `worldTextured()`.
- Pod: radius lantai 8.7, kaca 8.8, `clampFn` membatasi furnitur dalam radius 7.8; `ang(a, rho)` = [sin a·rho, cos a·rho] dengan a=0 pintu; `ringSlots(n, tight)` untuk cincin meja; entrance gap `GA=0.9` rad.
- Plaza: `plazaR = RI-11`, celah masuk `gaps[]`, struktur `makeDeck()` ×3 (sky deck, `elev/deckOf/decks[]`), panggung, air mancur, kios, sudut konten, taman peregangan, booth pitch, meja maker/lab, bangku; titik perilaku `plazaSpots`/`claimPlaza`/`goPlaza`/`PLAZA_BY_DIV`/`plazaLife`; landmark aplikasi (Papan Tugas, Studio, Approvals, Knowledge, Team, Chat) dengan layar hi-tech berisi data nyata (`HT` kit, `mkScreenMat`, `drawScreens`, `drawKanban`, `drawHolo`).
- Sosial: `startConvo`/`socialTick` + `chat` (chatter.js); bubble ucapan `say()`; emote `emote()`; kebutuhan/perilaku mandiri; pemain: `playerSit/playerStand`, `playerDo`/`PDO`, `playerLife` (otonom bila diam).
- Klik: klik kiri = ikuti kamera, klik kanan = menu pie bubble (satu menu saja), "Lainnya" = menu daftar. Walk mode = mode Play tanpa karakter (`player.fp`).
- Fisika/zona: `surfaceAt` + gravitasi + respawn aman (`player.safe`), `zoneAt/zoneTick` + banner, jembatan cahaya ke pulau lain (`env.walk`), lalu lintas atas (mobil/motor, `lanes`/`bikeLanes`).
- Pipeline sinematik: composer pada kualitas ≥1 dengan `depthTexture`; DOF spiral di `GradeShader` (`uTaps/uWide/uFocus`), bloom `UnrealBloomPass` (kekuatan `0.04+0.6*V.bloom²`, radius 0.5, ambang 1.25), CA delta-saja, haze ≤0.8, `perfLite`. Governor performa otomatis (`resScale`, kualitas turun bila <26 fps), bayangan diperbarui ±8 Hz, batas fps saat diam, LOD agen (anim tiap 2/4/8 frame, instansi titik >110 m), kota di-cull >360 m. Visual `V`/`VDEF` (`ver:3`) di localStorage `office-visual`.
- Default visual pilihan Owner (preset "Pilihan Ray"): FOV 65, exposure 45%, Highlights 25%, Shadows 6%, Saturation 164%, 5500 K, Bloom 28%, Vignette 61%, CA 37%, kabut 100%, awan density 76%/variety 16%/cirrus 65%/contrail 4/lon 0.13/lat 0, matahari 91%, bintang/bulan 153%, ukuran bulan 260%. Panel Enscape-style (awan, dll.) di tombol 🎛.
- Teks sprite (`textSprite`): kini punya opsi `glass:true` (kaca buram), label tajam dekat dan makin kabur jauh.

## 4. Pekerjaan sesi runtime ini (ringkasan kronologis akhir)

1. **Company Brain besar + interaktif** (`office3d.js` blok `// ── Company Brain`): atrium kaca, bola jaringan saraf 72 neuron berkedip, 3 cincin gimbal bersatelit, 4 pilar energi dengan petir (`brainCore.boltMat`), cincin glyph lantai, motes, balok cahaya halus. Interaksi: tekan **E** di dekat Brain atau klik Brain/kartunya → `brainTouch()` (tiga gelombang kejut, percikan, bunyi, cincin berputar cepat) lalu jendela Company Brain; ring pemindai saat dekat; "insight" acak tiap 22-46 dtk (`knowledgeFlow`); agen di sekitar Brain sesekali mengirim aliran pengetahuan. Skala sekarang `BRAIN_K` (diperkecil sesi 3D ke 0.95).
2. **Kartu catatan Brain** jadi chip ungu muda kecil (`brainCardSwap`/`refreshBrainNotes`): fade-in, tahan ±9 dtk, fade-out, ganti judul catatan nyata (`data.notes`), memudar bila kamera jauh; klik membuka Brain.
3. **Bubble ucapan agen** jadi kaca buram (`textSprite({glass:true})`): lebih kecil, teks ringan, fade-in/naik halus, fade-out di 500 ms terakhir (`a.bubble.userData` `glass/y0/k/t0`; opasitas dihitung per frame di update agen).
4. **Dekorasi per divisi** (`public/js/props.js`, dipanggil dari `buildRoom` lewat `DECOR`): ±40 jenis properti (loker, rak, mikroskop, tabung gas, server mini, rak baju, parfum, trofi, timbangan, brankas, hologram, softbox, spanduk, dll.). Tiap divisi (22) punya set `rim` (12 properti tipis di sepanjang kaca, radius 8.3, hadap tengah), `front` (2 gugus di kiri-kanan pintu, ±0.62 rad, radius 6.9, dengan `solid`), spanduk berwarna divisi di kaca (radius 8.62, y 3.0), dan barang kecil di meja per divisi (`DECOR.deskItems`). Ruangan non-divisi memakai set per `kind`, divisi baru memakai `FALLBACK`. Tanda tangan builder: `monitorWall(w,hue)`, `wallScreen(hue,w)`, `barChart(hue)`, `holoPillar(hue)`; `P.make(name, accent)` menyesuaikan argumen. Semua memakai `box/cyl` dari cache dan material terbagi `C()` agar ikut `mergeStatic`.
   - Sakelar uji sisa (aman, boleh dihapus): hash URL `nodecor`, `norim`, `nobanner`, `nofront`, `rimN`.
5. **Bangku di sekeliling Brain**: 6 bangku menghadap Brain + 6 titik berdiri (sekarang radius 8.2 / 7.6 setelah relayout sesi 3D).
6. **Perf**: rasio piksel maks 1.5 (kualitas tinggi) / 1.0 (menengah).
7. **Bug putih/hitam** dari `wallScreen` sudah diperbaiki (lihat §0).

## 5. Belum diverifikasi / terbuka

- Semua yang terkait tampilan akhir belum dilihat langsung di GPU Owner: dekorasi ruangan dari dekat (tabrakan dengan meja? terlalu penuh/kosong?), bubble kaca dan chip Brain, efek sentuhan Brain, relayout plaza sesi 3D, `glass.css` di semua halaman (hanya Dashboard/Tugas/Kantor 3D diuji sesi 3D), FXAA, dock Orkestrator, sinematik pembuka, Mode Play penuh, gestur wave/cheer/carry, FPS dengan aset V4.2 baru.
- Memori: heap JS ±190 MB tanpa dekorasi → ±300-380 MB dengan dekorasi pada pengukuran preview (sebelum pass 10 mengurangi dekor luar). Angka "CPU/MEM" di panel adalah beban seluruh PC (termasuk Chrome). Bila masih berat: kurangi properti per ruangan atau sembunyikan dekorasi ruangan yang jauh dari kamera (belum dikerjakan).
- Tekstur untuk dinding/furnitur (baru paving/pad/rumput), restyling furnitur lebih sci-fi, polesan fisika/interaksi, layar mobile yang tertahan memuat (tidak berhasil direproduksi).
- Dari 05 mascot-v4-2: duplikat badan (12 tampilan, tapi sekarang 171/171 unik lewat palet), interaksi antar-agen ala demo (salaman/tos/serah-terima) belum masuk, fidget tanpa prop di tangan.
- Server: setelah pass 11 butuh restart; belum diuji end-to-end bersama dock Orkestrator.
- Biaya Groq: server preview 4317 sempat LIVE selama sesi ini; Owner disarankan memeriksa biaya hari ini. Sesi 3D juga mencatat satu kejadian server uji LIVE ±15 detik.

## 6. Cara memverifikasi cepat di sesi baru

```
node docs/mascot-v4-2/verify-v42.mjs      # harus 71+ lolos
node --check public/js/office3d.js        # juga assets3d, views, props, mascot-palettes
node --test                               # 9 lolos
```
Lalu muat ulang browser dengan Ctrl+F5 (modul JS di-cache; `navigate` hash saja tidak memuat ulang). Pengamatan visual yang benar hanya di browser normal Owner (`localhost:4400`) atau panel yang tampil dan fokus.

## 7. Pesan terakhir Owner (konteks)

Owner meminta semua ingatan dikumpulkan ke satu file agar sesi baru benar-benar mengerti, termasuk pembaruan terbaru. Sebelumnya Owner mengeluh: bangku plaza kelihatan salah posisi (sudah ditata ulang), layar putih/hitam (sudah diperbaiki), ruangan terlalu kosong dan CPU/memori terlalu berat (dekorasi ditambah secara ringan; perf sebagian dikurangi), bubble agen dan kartu Brain terlalu solid dan besar (sudah dibuat kaca lembut).
