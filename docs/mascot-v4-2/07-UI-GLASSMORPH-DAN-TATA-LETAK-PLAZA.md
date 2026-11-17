# 07. UI glassmorph premium, tata letak plaza, dan tombol Play/Exit (2026-11-17, malam)

Tiga permintaan Owner pada gelombang 7-8. Semuanya aditif/terdokumentasi; jangan dibuang tanpa membaca ini.

## A. UI platform bergaya glassmorph premium

- Berkas BARU: `public/css/glass.css`, dimuat SETELAH `app.css` dan `knowledge.css` (`public/index.html`, baris `<link rel="stylesheet" href="/css/glass.css">`).
- Cakupan: semua UI di luar dunia 3D (sidebar, topbar, dashboard, kartu, kolom Kanban, modal, laci, palet perintah, toast, tombol, input, chip, tab/segmen, tabel, scrollbar, nav bawah seluler). HUD di atas dunia 3D (kelas `.glass`) sengaja TIDAK diubah.
- Cara kerja: token CSS (`--gl-*`) lalu menimpa `--bg2/--panel/--panel2/--card/--edge/--line` sehingga seluruh app.css otomatis ikut buram-transparan; `backdrop-filter: blur(22px) saturate(1.45)` ditambahkan pada permukaan struktural; sidebar/topbar menjadi panel kaca melayang (radius 28/22) dengan jarak 12 px; aurora pastel (terang) / indigo malam (gelap) bergerak sangat pelan di `body::before`; tombol utama gradien biru-ungu-merah muda; item nav aktif memakai gradien lembut.
- Tema: terang adalah tampilan utama (pastel seperti referensi Guesty), gelap juga kaca. Pengalih tema lama (`window.setTheme`) tetap bekerja.
- `prefers-reduced-transparency` (sering aktif otomatis di Windows): blur DIPERTAHANKAN, isi dibuat sedikit lebih pekat. Sebelumnya (versi awal berkas) blur dimatikan dan tampilan kembali putih datar.
- Rollback: hapus satu baris `<link ... glass.css>` di `index.html` (app.css tidak diubah). Cadangan index.html: `3D karakter/_backup_runtime_before_v42_logic/pass8/index.html`.
- Belum diuji: seluruh halaman satu per satu (diuji: Dashboard, Tugas, Kantor 3D; terang dan gelap). Bila ada elemen yang tidak terbaca di atas kaca, tambahkan aturan di akhir `glass.css`, jangan mengubah app.css.

## B. Tata letak plaza (pass 8, `office3d.js`)

Keluhan: tengah plaza terlalu padat sementara sisi masih lapang; Company Brain dan air mancur terlalu besar.

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Skala Company Brain (`BRAIN_K`) | 1,5 | 0,95 (pedestal heksagon ×0,62; `solid` 15 → 9,5; poi r 9,6 → 6,4) |
| Skala air mancur (`FOUNT_K`) | 1,0 | 0,62 (bangku/titik berdiri 5,0/4,6 → 3,6/3,3; `solid` dan poi menyesuaikan) |
| Cincin situs dalam (`RR`: panggung, air mancur, kios, sky deck utama, sudut profesi) | 12,5 | 17 |
| Cincin bangku/berdiri di sekeliling Brain | 11,6 / 11,2 | 8,2 / 7,6 |
| Sky Deck Timur / Barat (radius dari pusat) | 21 / 21 | 22,5 / 23 |
| Booth penawaran (pitch) | 170° | 188° (agar tidak menempel pada Sky Deck Barat) |

Bukti: tangkapan atas + sudut rendah di salinan terisolasi (`scratchpad/shots/plaza8b_top.png`, `plaza8b_low.png`). Catatan: titik gerak agen (plazaSpots) mengikuti koordinat baru otomatis karena dihitung dari konstanta yang sama.
Rollback: `3D karakter/_backup_runtime_before_v42_logic/pass8/office3d.js`.

## C. Tombol Play/Exit dan sinematik saat masuk Play lagi (pass 7)

- Bug: setelah keluar dari Play dengan Esc, tombol tetap bertuliskan "■ EXIT". Penyebab: `OfficeView.playerHint()` keluar lebih awal saat bukan mode pemain tanpa memanggil `playerUI(false)`. Perbaikan: pada cabang itu, bila overlay masih berkelas `playing`, panggil `this.playerUI(false)`.
- Masuk Play lagi (klik PLAY) kini memutar sinematik 5,2 dtk (tanpa judul dan tanpa jeda tinjauan) dari posisi kamera terakhir menukik ke belakang karakter (FOV 64→38), lalu masuk Play. `cinematicIntro(onDone, { hold, dur, id, title })`; pembukaan otomatis saat muat halaman memanggil `togglePlayer(true)` agar tidak ada sinematik ganda.
- Diuji di salinan terisolasi: Esc → tombol "▶ PLAY" dan `#phud` tersembunyi; klik PLAY → kamera bergerak (19,1/6,3/-36,4) → (15,7/3,5/-37,1) dalam ±5 dtk, FOV 64→38, lalu tombol "■ EXIT".
- Rollback: `.../pass7/office3d.js` dan `.../pass7/views.js`.

## D. Gelombang 9 (2026-11-17, malam): karakter "gepeng/rusak", slider visual, caret chat

Backup: `3D karakter/_backup_runtime_before_v42_logic/pass9/`.

| Masalah | Akar penyebab (terukur/terbukti) | Perbaikan |
|---|---|---|
| Tepi karakter bergerigi ("rusak") | Rantai `EffectComposer` memakai render target TANPA MSAA; `antialias:true` pada renderer tidak berlaku untuk composer. Tidak ada AA sama sekali | `FXAAShader` setelah OutputPass dan SEBELUM grade (`office3d.js`, `const fxaa`). Urutan penting: grade membaca kedalaman dari buffer tempat RenderPass menggambar, jadi jumlah swap buffer per frame harus genap (`grade.needsSwap = false`) dan FXAA `depthTest/depthWrite=false`. Menaruh FXAA SETELAH grade membuat layar hitam (GL 1282, loop umpan balik) |
| Karakter terlihat buram/lembek di Play | Fokus DOF di Play = `max(dist+1.5, 6, eye*18)` ≈ 11 unit sedangkan kamera ada ±3-6 unit dari karakter, sehingga karakter di depan bidang fokus dan di-blur | Di Play fokus = `player.dist + 0.6` (karakter tajam) |
| Slider Pengaturan visual membuat layar zoom in/out | `applyVisual()` menulis `camera.fov = V.fov` (65) pada setiap gerakan slider, lalu kamera Play menyempitkan lagi ke 38 | Saat Play atau sinematik, `applyVisual` mempertahankan lensa kamera saat ini |
| Kursor teks keluar dari kotak chat setelah kirim | `renderTalk` menimpa `innerHTML` (input baru, fokus hilang) pada tiap kirim/balasan | `hadFocus` disimpan dan fokus + posisi caret dipulihkan; `send` memanggil `renderTalk(true)` |

Catatan jujur: geometri karakter sudah terukur setia terhadap render Blender (lihat 01-KEADAAN); tiga faktor di atas adalah penyebab "tampak rusak/lembek" yang terbukti di kode. Belum dibuktikan di 60 FPS pada mesin Owner.

## E. Gelombang 10-12 (2026-11-17, malam): dunia lebih tenang + Dock Orkestrator

Backup: `3D karakter/_backup_runtime_before_v42_logic/pass10`, `pass11` (server), `pass12`.

### E1. Dunia lebih tenang (pass 10)
- Rumput: bilah 0,045 x 0,16-0,22 (sebelumnya 0,07 x 0,4-0,56), skala 0,6-1,1; bunga lebih rendah. Jumlah tetap 5200 (padat tetapi pendek).
- Pulau melayang berpohon: 6 → 3, skala 0,5. Lentera oranye: 10 → 4, radius 0,13 (sebelumnya 0,26). Drone: 5 → 2.
- Lalu lintas langit: mobil 76 → 28, motor 16 → 4, burung 42 → 18, kupu-kupu 34 → 14, ubur-ubur 9 → 4, spora 220 → 110, jejak pesawat dibatasi maks 1 (`life.js`, `applyVisual`).
- Rollback: berkas di `pass10/`.

### E2. Dock Orkestrator (pass 11 server + pass 12 klien)
Tujuan Owner: satu kotak chat untuk semuanya, tanpa berkeliling mencari agen; 3D tetap terlihat.
- Klien (`views.js` `OfficeView.dock*`, `glass.css` `.odock`): panel kaca di kiri-bawah (bar bawah lama dipindah ke dalamnya, id `#goalq/#meetgo/#goalgo` dipertahankan). Chip penerima (default = orkestrator/PA), tombol "＋ Agen" (pencarian nama/jabatan) untuk diskusi grup, mode Otomatis/Obrolan/Goal, pesan ringkas yang memudar ke atas, deretan chip "Sedang bekerja" (klik = kamera mengikuti). `/rapat teks` membuka form rapat. Caret tetap di kotak setelah kirim. Di mode Play tekan Enter: mouse dilepas dan fokus ke kotak chat.
- 3D tidak tertutup: `office.setInset(392)` menggeser gambar 3D ke kanan (`camera.setViewOffset`) sehingga dunia terpusat di area yang masih terlihat; 0 saat Play atau dock dikecilkan.
- Sorotan: `office.spotlight(ids)` memberi cincin berdenyut + sinar lembut pada agen berstatus working/meeting/chatting (maks 10). Kamera meluncur ke agen yang baru mulai bekerja hanya bila Owner baru mengirim pesan (<90 dtk), tidak sedang Play dan tidak sedang mengikuti agen lain (`dock.auto`).
- Server: `POST /api/orchestrate {text, userId, to[], mode}` (`engine.orchestrate`). auto: kalimat kerja (regex `WORK_RE`) tanpa penerima eksplisit = goal ke PA (`submitGoal`), selain itu obrolan: 1 agen = DM, ≥2 agen = kanal `grp-…` (kind `group`, `ensureGroup`).
- Diskusi grup: balasan DIAMBIL BERGANTIAN (satu per satu) sehingga pembicara berikutnya membaca jawaban sebelumnya; `@nama` di dalam grup mempersempit siapa yang menjawab; maksimal 4 pembicara.

### E3. Audit backend chat (yang ditemukan dan diperbaiki)
| Temuan | Dampak | Status |
|---|---|---|
| Balasan beberapa agen dijalankan PARALEL dengan riwayat yang sama | jawaban kembar/tidak saling menanggapi | diperbaiki (turn-taking untuk grup) |
| `@mention` di DM menambah target di luar anggota DM | agen yang bukan anggota membalas di DM yang salah | diperbaiki (hanya anggota DM/grup) |
| `replyAs` memulihkan status "chatting" tanpa menghitung balasan serentak | status agen kembali ke idle di tengah obrolan lain | diperbaiki (`chatBusy` penghitung) |
| Tidak ada pintu masuk tunggal untuk chat/goal/rapat | Owner harus memilih tempat sendiri | `orchestrate()` + dock |
| Kanal `group` belum tampil di halaman Chat lama | diskusi grup hanya terlihat di dock | BELUM (daftar kanal di `ChatView` perlu bagian "Diskusi grup") |
| Rapat (`collab.js`), pendelegasian goal (`engine.js` tick/runLive) | tidak diaudit mendalam gelombang ini | BELUM diaudit |

Catatan: server perlu di-restart (`npm start`) agar `/api/orchestrate` aktif. Diuji hanya di mode simulasi (tanpa LLM): grup 2 agen membalas berurutan, goal dirutekan ke PA.

### E4. Blur seluruh layar di Play (pass 12b)
Gejala: seluruh gambar kabur, termasuk karakter, saat Play. Akar penyebab yang terbukti di shader (`environment.js` GradeShader): kabur-jauh mulai pada 1,2 x jarak fokus dan penuh pada 5 x; di pass 9 fokus Play dibuat `player.dist + 0.6` (bisa sekecil 2,8), sehingga semua yang lebih jauh dari ±3,4 unit (karakter dari sudut depan, meja, monitor) ikut kabur. Perbaikan (`office3d.js` `draw`): fokus Play = `max(jarak kamera ke karakter + 0,5, 5,5)` (mode orang pertama = 14), perpindahan fokus 0,35/frame (sebelumnya 0,12, terasa lambat di FPS rendah), dan penjaga `isFinite`. Kecuali Pengaturan visual diubah, DOF 70% tetap bawaan; kalau masih terlalu kabur, kecilkan "Kedalaman medan" di Pengaturan visual. Diuji hanya lewat nilai uniform (fokus 6,38 pada DOF 0,7); belum dilihat di 60 FPS Owner.

## F. Gelombang 13 (2026-11-17, malam): blur Play (akar sebenarnya), goal macet, rapat rapuh

Backup: `3D karakter/_backup_runtime_before_v42_logic/pass13/` (office3d.js, views.js, engine.js, index.js, collab.js sebelum edit; governor.js ada di git HEAD).

### F1. Blur seluruh layar di Play: akar sebenarnya (terbukti)
Perbaikan fokus di pass 12b tidak menyentuh akar masalah. FXAA (pass 9) menggambar ke buffer yang sama dengan kedalaman scene yang dibaca pass grade, dan `renderer.autoClear=true` ikut MENGHAPUS kedalaman itu. Akibatnya DOF membaca kedalaman kosong = "semua piksel sangat jauh" = blur penuh seragam, termasuk karakter di depan.
- Bukti: probe `tDepth` (render buffer kedalaman ke target kecil lalu baca piksel): kode lama 0 dari 576 piksel memiliki kedalaman scene; kode baru 263 dari 576. Di Play (FOV 38) fokus 6,38, karakter tajam, latar lembut wajar.
- Perbaikan: `fxaa.render` dibungkus agar `autoClearDepth/autoClearColor=false` selama FXAA (`office3d.js`, `fxRender`). Aturan pass 9 tetap berlaku (FXAA sebelum grade, `grade.needsSwap=false`).
- Catatan: DOF TIDAK menghemat CPU/memori (justru butuh GPU). Penghematan sebenarnya: LOD agen, culling kota, throttle animasi jauh (sudah ada). Belum ada: sembunyikan dekor ruangan yang jauh.

### F2. Audit backend (engine/collab/governor): temuan dan perbaikan
| Temuan (bukti) | Dampak | Perbaikan |
|---|---|---|
| `governor.checkCreate` menganggap induk "serupa" dengan subtugasnya (kata sama + "[MKT]"); log `GovernorError` pada goal uji | delegasi goal ke divisi SELALU ditolak; goal `in_progress` selamanya tanpa anak | leluhur dikecualikan; di bawah induk, duplikat hanya bila penerima sama (`assigneeId` kini dikirim `createTask`) |
| Langkah simulasi yang melempar galat hanya `endJob` | tugas macet `in_progress` tanpa job | sekarang lewat `failTask` (retry/recovery/blokir) |
| Anak `blocked` / induk `waiting` tanpa anak | induk menunggu selamanya | tick: sintesis dari anak selesai, atau blokir induk; yatim >30 dtk dikerjakan langsung (`noDelegate`) |
| `failTask` tanpa kandidat pengganti | retry tanpa batas | blokir setelah 5 kegagalan |
| Pemecahan goal diulang saat retry | anak ganda | lewati penerima yang sudah punya anak |
| Agen berstatus rapat memulai job | status rapat tertimpa | tick melewati agen yang `meetingUntil` masih aktif |
| `runMeeting`: satu panggilan LLM gagal | seluruh rapat batal | giliran dilewati; berhenti hanya bila 3 gagal berturut-turut |
| Dua rapat berbagi peserta | rapat pertama yang selesai melepas peserta dari rapat kedua | peserta yang sedang rapat dikecualikan; ketua sibuk ditolak jelas |
| Regex `say()` memotong awalan seperti "Usulan saya:" | isi ucapan hilang | hanya awalan nama pembicara sendiri |
| Rapat `running` sebelum restart tidak pernah ditutup | peserta terblokir rapat baru | saat boot ditandai `failed` ("Terputus...") |
| `onHumanMessage` tanpa `.catch` + tanpa handler global | satu galat bisa mematikan proses | `.catch` di `/api/messages`, `orchestrate`; `unhandledRejection/uncaughtException` dicatat |
| `replyAs` live berhenti diam setelah 5 putaran tool | pesan tidak dibalas | balasan cadangan |
| Grup (simulasi): tiap anggota membuat tugas yang sama | 4 tugas kembar | anggota berikutnya menunjuk tugas yang sudah ada |
| `WORK_RE` tak mengenal "luncurkan/rencanakan/…" (contoh di kotak chat sendiri salah rute) | goal dianggap obrolan | `looksLikeWork()` (pertanyaan/sapaan = obrolan, kata kerja -kan/daftar kerja = goal) hanya untuk `orchestrate` |
| Klien memanggil `/api/orchestrate` pada server lama ("Endpoint tidak ada") | kirim gagal | `dockSend` jatuh ke `/api/goals` atau `/api/dm`+`/api/messages` dan memberi tahu agar restart |

Terbukti di salinan terisolasi mode SIMULASI (port 4511): goal Luncurkan promo → 3 anak + 6 cucu selesai, 0 galat; grup 2 agen bergiliran; "apa yang harus dikerjakan?/hi/terima kasih" = obrolan. `node --test` 9 lolos.
Belum: rapat sungguhan (butuh LLM live; mode simulasi menolak rapat multi-agen), kualitas goal dengan Groq, efisiensi token (jumlah panggilan per goal belum diukur).

## G. Gelombang 14 (2026-11-17, malam): kamera rendah, bubble terbaca, kecepatan, preset Owner, kabut mimpi, bukit

Backup: `3D karakter/_backup_runtime_before_v42_logic/pass14/` (office3d, environment, assets3d, life, views sebelum edit).
- **Kamera Play**: pitch minimum -0,85 (sebelumnya 0,05/0,12) sehingga kamera bisa turun di bawah tinggi kepala dan menatap ke atas; kamera dijepit `surfaceAt + 0,22` agar tidak menembus tanah. Orang pertama tetap ±1,4. Orbit bebas sudah mendukung (maxPolar 0,97 pi).
- **Bubble/dialog buram**: sprite kaca tidak menulis kedalaman, jadi DOF memperlakukannya sebagai latar jauh dan memburamkan teksnya. Kini `depthWrite:true`, `alphaTest 0.14`; bubble juga lebih pekat (a0 0,8 / a1 0,66) dan sedikit lebih besar (size 15, scale 0,0054).
- **Kecepatan**: `GAIT` jalan 1,4 -> 2,0, lari 2,7 -> 3,9; batas timeScale siklus klip 1,5 -> 2,2 (agar kaki tidak meluncur). Belum dinilai di 60 FPS.
- **Preset bawaan = nilai Owner** (FOV 50, DOF 30%, exposure 21%, Highlights 39%, Shadows -49%, saturasi 140%, 5400 K, bloom 67%, vignette 59%, CA 33%, kabut 41%, awan 100%/0%/cirrus 100%, jejak 2, bujur 0,49, matahari 36%, bintang 200%, bulan 300%, gaya Lembut). `VDEF.ver` dinaikkan ke 4: pengaturan lama tersimpan di localStorage direset sekali ke bawaan baru.
- **Kabut mimpi** (`life.js` `setDream`, slider "Kabut tipis & berkas cahaya", preset "Foggy Dreams"): 26 sprite kabut rendah berdenyut pelan dengan tepi lembut dan 5 berkas cahaya aditif; memudar bila dekat kamera (tidak menutup pandangan), hilang di ketinggian >70. Warna mengikuti horizon + biru-hijau lembut. Bawaan 0,6.
- **Bukit padang rumput** (`office3d.js` blok "rolling hills"): sampai 12 gundukan bulat (tinggi 0,4-1,0 m, radius 3-5,6 m) di lawn, dijauhkan dari semua situs (`exc`), pohon, dan lorong gerbang; lawn datar tetap ada di bawahnya sehingga tidak ada yang bergeser. Rumput/bunga mengikuti tinggi bukit, `surfaceAt` membuat pemain berjalan di atasnya. Terukur di salinan uji: 6 bukit, puncak 0,99 m. NPC masih berjalan di y=0 (bukit sengaja jauh dari rute). Hook debug: `__ray3d.terrainH(x,z)`.
- Belum: pulau melayang lain masih datar; gaya cahaya film penuh ala Sky (volumetrik sungguhan) tidak dibuat demi performa PC lemah.

## H. Gelombang 15 (2026-11-17, malam): SFX, tiang pylon, dunia pucat/bergerigi

Backup: `pass14/` (juga sfx.js).
- **SFX**: bus efek 1,0 -> 0,4; bunyi sentuh Brain ±3x lebih pelan; dengung Brain 0,07 -> 0,025. Musik latar tidak diubah.
- **Tiang hitam**: empat tiang pylon di sekitar Brain (kotak 0,2x4,6x0,2) dibuang. Kristal berlian emas dan kilat ke inti tetap ada (melayang).
- **Dunia pucat/bergerigi (laporan Owner, 3 tangkapan)**: TIDAK bisa direproduksi persis di panel uji (rAF ±1 FPS, tidak ada GPU Owner). Yang diketahui: (1) sejak perbaikan kedalaman (pass 13) haze jarak jauh di GradeShader benar-benar aktif lagi (sebelumnya buffer kedalaman kosong sehingga haze nyaris mati), dan haze memakai jarak fokus Play (±6) sebagai skala sehingga semua di atas ±10 unit ikut memutih; (2) kabut mimpi gelombang 14 memakai 26+5 sprite transparan besar = beban fill-rate yang bisa menurunkan `resScale` (render lebih rendah = tepi bergerigi). Perbaikan: haze memakai `max(uFocus, 48)` dan batas 0,55; sprite kabut 14 + 3 dan tak digambar bila transparan; mode ringan (`perfLite`) mematikan setengahnya dan semua berkas cahaya; efektif dream = slider x 0,75.
- Bila masih bergerigi: kecilkan slider "Kabut tipis & berkas cahaya" ke 0 dan bandingkan; periksa `__ray3d.renderer.domElement.width` terhadap lebar jendela (rasio kecil = governor menurunkan resolusi).

## I. Gelombang 16 (2026-11-17, malam): dunia kosong (agen hilang) dan tepi bergerigi

- **Agen dan detail dunia hilang = KESALAHAN SAYA (gelombang 14)**: blok bukit memakai `PI` yang tidak ada di cakupannya, jadi `build()` melempar `ReferenceError: PI is not defined` di tengah jalan; semua yang dibangun sesudahnya (dekorasi, furnitur, 171 agen) tidak pernah dibuat. Diperbaiki (`Math.PI`). Terbukti: 171 avatar terbentuk, konsol tanpa galat. Uji saya sebelumnya salah menyimpulkan "bukit OK" dari `window.__hills` yang diisi SEBELUM baris yang gagal, dan salinan uji tanpa aset karakter. ATURAN: setelah mengedit office3d.js, muat halaman di salinan LENGKAP (termasuk assets/) dan periksa `window.__avatars.size` (171) serta konsol tanpa "[office] gagal".
- **Tepi bergerigi**: governor menurunkan `resScale` sampai 0,55 saat FPS Play <42. Kini lantainya `RES_FLOOR = 0.8`; efek dikorbankan dulu: `perfLite` (FPS <46 saat bergerak) mematikan bloom, memangkas tap blur (8; normal 14, dulu 20) dan setengah kabut mimpi. Diagnosa di mesin Owner: ketik `__ray3d.perf()` di konsol (fps, resScale, pixelRatio, ukuran kanvas).

## J. Gelombang 17 (2026-11-17, malam): rapat nyata dari chat dan hemat token

Backup: `pass17/` (collab.js, engine.js, index.js sebelum edit).
**Masalah (Owner)**: "ayo ke ruang meeting" hanya dijawab Sora "sudah saya atur" tanpa ada rapat di 3D. Akar: kalimat itu hanya sampai ke model bahasa (chat), yang mengaku tanpa memanggil apa pun; `runMeeting` juga menolak berjalan tanpa AI.
- **Niat rapat dari chat** (`engine.js` `meetingIntent/startChatMeeting`): kata rapat/meeting/kumpul/berkumpul/"ayo ke ruang…" memulai rapat sungguhan (status `meeting` -> agen berjalan ke Conference Hall, bubble `meeting_say` di 3D, notulen ke Brain). Pertanyaan ("apa itu rapat?") dan masa lalu ("hasil rapat kemarin") tetap obrolan. Nama tanpa @ dikenali (`namesIn`: nama, nama lengkap, atau id). Tanpa nama: Sora + Master; "semua kepala divisi": semua kepala. Pesan lanjutan "udah cuma undang Maya aja" **mengganti** rapat yang baru dibuka; "batalkan rapat" membatalkan dan melepas semua peserta seketika. Dipakai oleh dock (`orchestrate`) dan halaman Chat (`onHumanMessage`). `convene_meeting` dicabut dari tool chat (model dulu berhalusinasi).
- **Hemat token** (`collab.js` `meetingScript`, bawaan `settings.meetingMode='hemat'`): SATU panggilan model kecil menghasilkan dialog semua pembicara + notulen + maks 2 action item (penanggung jawab dibatasi daftar peserta, bukan 170 id), lalu diputar bergiliran di 3D. Biaya tetap berapa pun pesertanya; yang berbicara maks 8 (kepala divisi diutamakan), sisanya hadir diam. Tanpa AI/anggaran habis/gagal: template gratis (0 panggilan). Mode lama `mode:'deep'` (satu panggilan per pembicara, transkrip membesar) tetap ada.
- **Balasan nol token** (`quickReply`): sapaan ("hai", "sora") dan "bisa apa" dijawab template, tidak memanggil model.
- Ucapan Owner saat rapat berjalan dicatat ke notulen (tidak membuat tiap agen menjawab).
- **Terbukti** (simulasi + server Groq tiruan lokal tanpa kunci/biaya): rapat 4 peserta = 1 panggilan AI (panggilan kedua adalah tugas hasil action item); rapat 23 peserta selesai dengan 8 pembicara dan semua dilepas; ganti peserta dan batal bekerja; 0 galat; `node --test` 9 lolos.
- **Belum**: kualitas dialog dengan Groq sungguhan (tiruan hanya memeriksa alur); agen jauh bisa belum sampai saat gather 14 dtk; owner-led via modal "Rapat" tetap seperti sebelumnya.

## K. Gelombang 18 (2026-11-17, malam): rapat interaktif, chat dipagari fakta, kamera di tangga

Backup: `pass17/` (collab, engine, index sebelum gelombang 17; kondisi sebelum gelombang 18 ada di git commit 25e6fe2 + perubahan gelombang 17).

**Diagnosis dari `data/db.json` asli Owner** (bukan tebakan):
- Rapat yang dibuka lewat tombol "Rapat" berstatus `waiting_owner`: peserta berkumpul tetapi DILARANG bicara sampai Owner mengetik persis "selesai"; pesan Owner ("kira kira agenda kita apa aja") ditelan `handleOwnerMeetingMessage` tanpa jawaban. Itu penyebab "kita udah ngumpul, terus apa?". Cacat alur, bukan Brain berantakan.
- Tidak ada agen bekerja sendiri: semua 80+ rutin `off`, 17 tugas terbuka semuanya `blocked`; satu-satunya yang "aktif" adalah peserta rapat. "Fokus pada kalender kampanye Q3" yang diucapkan Maya adalah karangan model: jawaban chat memakai prompt kerja penuh (skill, knowledge, memori lama) tanpa pagar status nyata.
- Total pemakaian tercatat: 2.945 panggilan, 15,8 juta token masuk ($2,45 sepanjang waktu) sebagian besar dari rutin lama.

**Perbaikan**
1. **Rapat live** (`collab.js`): Ketua membuka dengan usulan agenda (1 panggilan kecil atau template gratis), lalu SETIAP pesan Owner dijawab 1-3 giliran peserta yang relevan (debounce 3,5 dtk agar Owner bisa mengetik beberapa pesan; "belum selesai/tunggu" menahan jawaban). Rapat ditutup dengan "selesai"/"tutup rapat" (pesan pendek; kalimat panjang yang memuat kata "selesai" tidak menutup) atau otomatis setelah 10 menit tanpa arahan (`settings.meetingIdleMin`), lalu 1 panggilan notulen + action item (penanggung jawab dibatasi peserta). Agen tidak pernah bicara sendiri di antara pesan Owner. Dialog juga di-cermin ke thread dock (`mirrorChannelId`). Rapat dari chat bawaannya live; kata "sendiri/tanpa saya/laporkan hasil" = agen berdiskusi sendiri (skenario 1 panggilan).
2. **Pesan Owner di dalam rapat** dari dock/Chat dikirim ke ruangan (`activeLiveMeeting` + `ownerSpeaks`), bukan ke chat biasa. Mengundang orang lain ("undang Maya aja") mengganti rapat; "rapat baru" juga.
3. **Chat dipagari fakta** (`chatSystem`): prompt ±250 token (sebelumnya ribuan) berisi identitas singkat + KEADAAN NYATA (status, tugas aktif) + larangan mengarang pekerjaan; tool chat dikurangi ke search_brain, company_status, ask_colleague, web_search, calculate + create_task; maxTokens 4000 -> 1200.
4. **Kamera Play di tangga/deck**: `clampCamera` membatasi fokus ke ±2,5 m dan menggeser kamera turun sebesar selisihnya tiap frame; di Play (deck lebih tinggi) kamera tertahan. Kini di Play hanya dijaga >0,12.
- **Terbukti** (server Groq tiruan lokal, tanpa kunci/biaya): seluruh rapat interaktif = 3 panggilan AI (buka, jawab Owner, notulen); prompt chat 934 karakter; 0 galat; 10 tes lolos (1 tes baru). **Belum terbukti**: kualitas jawaban dengan Groq sungguhan; kamera Play di tangga (diperbaiki dari akar kode, belum dilihat di GPU Owner).
- **Belum**: rutin/self-learning lama tetap mati (aktifkan manual); Brain 609 catatan belum dirapikan ulang; modal "Rapat" lama masih meminta "/selesai" pada teks bantuannya (sekarang juga "selesai" biasa).
