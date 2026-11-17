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

## L. Gelombang 19 (2026-11-17, malam): optimasi beban (CPU/memori) terukur

Backup: `pass19/` (office3d, views, index sebelum edit).
**Fakta yang menentukan target**: angka "CPU / MEM" di panel kanan adalah beban SELURUH PC (Windows + Chrome + semua tab/aplikasi), bukan milik aplikasi, sehingga "di bawah 10%" tidak bisa dicapai oleh optimasi aplikasi. Panel kini punya baris tambahan "Aplikasi ini": RAM server, CPU proses server (% satu core), heap JS tab, fps.
**Baseline terukur** (salinan uji, Intel UHD 0x46A3 = GPU terintegrasi yang sama dengan mesin Owner, tampilan ikhtisar 912x676): heap JS tab 193 MB; server idle 143 MB RAM dan ±3% satu core; 1.972 draw call; 61 ms/frame (render 46,5 ms, loop agen 9,8 ms).
**Temuan**:
- 1.785 dari ±2.250 mesh statis punya material uniknya sendiri (builder membuat material baru per properti) sehingga `mergeStatic` tak menggabungkannya. Material Standard polos identik kini dianggap satu (`matKey`); yang berpendar/emisif, material bersama (`F.M`), custom shader, dan MeshBasic tetap terpisah demi keamanan. Draw call 1.972 -> ±1.2-1.9 ribu (turun ±39% pada satu ukuran, bervariasi menurut kamera).
- Profil GPU: render adegan ±41 ms dari ±55 ms total; post-processing hanya ±13 ms (bloom ±7). Menyembunyikan grup "dunia" menurunkan ke ±12 ms. Jadi hambatan utama adalah beban GPU (isi piksel PBR+bayangan pada dunia) pada GPU terintegrasi, BUKAN jumlah draw call: waktu render hampir tidak berubah setelah draw call turun.
- Loop agen: agen jauh (lod 4) kini melewati pekerjaan kosmetik dan mesin status "life" 3 dari 4 frame.
- Tingkat idle: tanpa input 4/12/45/120 dtk -> ±30/20/10/5 fps (dulu mentok ±20 fps). Input apa pun langsung membangunkan.
**Yang tidak diubah demi tampilan**: resolusi, bayangan, DOF/bloom, jumlah agen dan dekor.
**Jujur**: penurunan beban nyata hanya saat idle; saat Owner aktif, GPU terintegrasi tetap menjadi batas fps. Langkah berikutnya bila perlu (butuh keputusan Owner karena mengubah tampilan): menurunkan kualitas bayangan/PBR di kejauhan, atau profil "Hemat" otomatis.

## M. Gelombang 20 (2026-11-17, malam): agen idle tidak lagi berkeliling serentak

**Pertanyaan Owner**: apakah beban karena banyak agen berjalan, bukannya diam/tidur? Jawab: ya, sebagian. Tidak ada mode "tidur": `want(a)` mengembalikan 'free' untuk setiap agen berstatus idle, dan tiap agen idle memutuskan sendiri tiap 20-60 dtk untuk pergi ke plaza/kafe/lounge (55% plaza + ±33% tempat lain), lalu singgah 10-36 dtk. Tanpa batas, itu puluhan agen berjalan bersamaan.
**Terukur** (salinan uji, 171 agen, mode simulasi, ±40-100 dtk sesudah dimuat): kode lama 117 -> 124 agen berjalan meninggalkan meja bersamaan (129 saat diukur); kode baru 20. Biaya JS per frame: loop agen 7,0 -> 3,0 ms, `separate()` 1,4 -> 0,1 ms. Waktu render (GPU) tidak berubah (±37-42 ms): agen berjalan menambah beban CPU/animasi, bukan beban GPU utama.
**Perbaikan**: `V.crowd` (bawaan 14; slider "Keramaian" di Pengaturan visual > Utama, 0-60). Hanya agen idle yang berkeliling yang dibatasi (mode leisure/visit dihitung tiap frame, `crowdNow`); agen yang bekerja, ke rapat, mengikuti Owner, atau diberi tugas tidak terpengaruh. Agen di atas batas tetap di mejanya (animasi diam). 0 = semua diam di meja. Catatan: ±20 agen pertama (keadaan awal setelah muat) tidak digating.

## N. Gelombang 21 (2026-11-17, malam): target = laptop sederhana pengguna Indonesia

**Koreksi saya atas klaim sebelumnya** ("beban GPU/isi piksel, bukan draw call"): SALAH. Uji A/B berselang-seling: menyembunyikan 50% mesh menurunkan frame ±87 -> ±63 ms (±19 us per objek), sedangkan resolusi 4x lebih kecil tidak mengubah waktu (86 -> 90 ms). Beban adegan dibatasi JUMLAH OBJEK yang harus dikirim CPU/driver ke GPU (dan jumlah segitiga), bukan isi piksel.
**Mode Ringan (eco) kini otomatis**: `weakDevice()` (GPU Intel iGPU non-Iris-Xe/Arc, Mali/Adreno/PowerVR/software, deviceMemory <= 4, <= 4 inti) memilih eco bila pengguna belum memilih mode; mode "Otomatis" yang lambat (<30 fps selama 8 dtk saat aktif) berpindah ke eco dan membangun ulang. Pilihan manual di Pengaturan (Grafis) tetap menang dan tersimpan.
**Isi eco**: tanpa rantai pasca-proses/bayangan (quality 0), resolusi lantai 0,6, tanpa kabut mimpi, pengembara idle maks 6, badan detail hanya <12 unit (LOD x0,55); pembatchan: mesh Standard polos -> 1 material Lambert warna-vertex, Basic/emisif -> 1 material Basic warna-vertex, dipecah per sel 26 m (agar culling bekerja) dan benda kecil (<0,8 m) dipisah serta disembunyikan saat kamera >75 m; ring/layar meja/kursi disembunyikan >55 unit, titik status >110.
**Terukur** (salinan uji, tampilan ikhtisar, mesin sedang berbeban sehingga ms tidak stabil; hitungan objek stabil): draw call 1.972 -> 754; segitiga/frame 2,09 juta -> 0,41 juta; ms adegan ±85 -> ±27-30 (ukuran sama, kondisi berbeban). Tampilan dekat plaza: 385-588 draw call, ~0,93-1,0 juta segitiga, ±32-36 ms (belum cukup).
**Belum / jujur**: (1) belum diuji di perangkat lemah sungguhan; mesin uji (Intel UHD Xe) jauh lebih kuat daripada laptop kelas Celeron/HD Graphics 4-6 seri; target realistis 30 fps di sana belum terbukti. (2) Tampilan dekat masih ±1 juta segitiga: berasal dari dunia dekat (bukan agen); perlu LOD geometri per sel. (3) Mode Ringan tampil lebih datar (Lambert/Basic, tanpa blur/bloom/bayangan); mesin Owner (Intel UHD) kini otomatis masuk eco, bisa diganti ke Tinggi di Pengaturan. (4) Material bersama F.M (lantai/dinding besar) belum di-batch.

## O. Gelombang 22 (2026-11-17, malam): HUD tidak lagi bertumpuk

- Banner "Kamu berada di ..." (`.lower3`, `OfficeView.lower`) dan dock Orkestrator sama-sama di kiri-bawah sehingga bertumpuk. Banner kini jatuh dari **atas-tengah** (di bawah bilah petunjuk Play; `top: 182px` pada lebar <= 1180 px agar tidak menimpa deretan statistik di kiri). Animasi masuk/keluar vertikal (`l3drop/l3lift`).
- Dock Orkestrator naik dari `bottom: 62px` ke `80px` (82px di layar sempit) karena chip pemain `#osim` (kiri-bawah) tertimpa 7 px.
- Terbukti: diukur lewat posisi tiap elemen HUD pada lebar 1024 px (banner dan dock tidak beririsan dengan elemen absolut lain). Semua perubahan di `glass.css` saja; rollback = hapus blok di akhir berkas. Belum diperiksa pada lebar sangat sempit (<500 px).

## P. Gelombang 23 (2026-11-17, malam): kunang-kunang plaza dan dialog terbaca

(Permintaan Owner yang sebelumnya ditunda sesi 3D karena menyentuh office3d.js/life.js.)
- **Kunang-kunang** (`life.js`: `fireflies`, `setFireflies`): hingga 84 titik putih hangat berkilau, dikelompokkan di 8 titik sekitar plaza tengah (radius 6-23 dari pusat, tinggi 0,5-2,6 m), melayang pelan dan berkedip (per titik di shader), SATU draw call Points aditif. Lebih terang saat senja/malam, tetap terlihat siang. Hanya tampil bila kamera <95 unit dari pusat dan <70 m tinggi. Jumlah: 84 normal, 44 saat `perfLite`, 28 di mode Ringan. Bug yang sempat ada dan sudah diperbaiki: `center` di life.js adalah objek biasa {x,z}, bukan Vector3, sehingga `distanceTo` menghasilkan NaN dan kunang-kunang tak pernah tampil (ditemukan lewat probe uniform `uT` yang tetap 0).
- **Dialog** (`textSprite` + panggilan bubble): kaca lebih pekat (alpha 0,94/0,88, sebelumnya 0,8/0,66), teks lebih tebal (650) dan gelap (#141c42) dengan halo putih tipis (`halo:true`), tekstur 3x (sebelumnya 2x) agar tajam saat dekat, ukuran 16 px. Tetap gaya kaca (gradien, tepi terang, bayangan lembut).
- **Terbukti**: kunang-kunang terlihat di salinan uji (siang hari, halus; probe: visible true, uT berjalan), 171 agen, tanpa galat. **Belum terbukti**: tampilan bubble yang baru belum dilihat langsung (tidak ada pemicu ucapan yang dapat dipanggil dari panel uji); kecerahan kunang-kunang pada malam hari belum dilihat.

## Q. Gelombang 24 (2026-11-17, malam): balasan chat berulang, ingatan agen

**Laporan Owner**: Sora menjawab "hi" dan "sora" dengan blok teks yang sama persis ("Halo Owner! Saya Sora, Personal AI Assistant · Anda (Owner)...").
**Akar (kesalahan saya, gelombang 17)**: `quickReply` (template nol-token untuk sapaan) tidak membaca riwayat percakapan maupun ingatan; judul agen PA memang berisi "· Anda (Owner)" dan ikut tercetak. Selain itu `chatSystem` (prompt chat ringkas) tidak memuat ingatan pribadi agen walau tiap agen punya catatan "Memori <nama>" (`brain.remember`), jadi chat tidak punya kesinambungan.
**Perbaikan** (`engine.js`):
- `quickReply(e, msg, ch)`: sapaan pertama dalam 6 jam = perkenalan singkat + status nyata; sesudahnya jawaban pendek yang BERGANTI-GANTI dan tidak pernah sama dengan 4 balasan terakhir; memanggil nama saja ("sora") dijawab "Ya, Owner? Saya di sini."; judul dibersihkan; tetap 0 panggilan AI.
- Prompt chat (`chatSystem`) kini memuat "INGATANMU": 4 baris terakhir catatan Memori agen (kejadian nyata, ditegaskan bukan berarti masih dikerjakan) selain status/tugas nyata.
- Pesan substantif (>= 6 kata) dicatat ke ingatan agen ("Owner berkata kepadaku: ...") agar chat berikutnya nyambung; sapaan tidak dicatat.
- Mode simulasi (tanpa AI) tidak lagi mencetak blok "Halo! Saya ..." tiap pesan: kalimat pembuka bergantian, status nyata, petunjuk hanya sekali.
- **Terbukti** (simulasi + server Groq tiruan): "hi/sora/hai/halo" dijawab 4 kalimat berbeda tanpa panggilan AI; pesan substantif membawa INGATANMU + KEADAAN NYATA; dua pesan beruntun tercatat di Memori Sora. **Belum**: kualitas jawaban dengan Groq sungguhan; ingatan lama yang sudah berisi catatan uji tetap ikut terbaca (bisa dirapikan).

## R. Gelombang 25 (2026-11-17, malam): anatomi duduk (kaki menembus bangku/kursi)

**Laporan Owner**: saat duduk (bangku plaza), kaki karakter tembus dudukan; "semua agen duduknya begitu".
**Diagnosis terukur** (tulang di salinan uji; bangku: papan y 0,45-0,52, tepi depan +0,225 m dari pusat): saat duduk, pinggul 0,61 m, lutut 0,596 m dan pergelangan 0,354 m pada jarak depan 0,04-0,08 m dari pusat = paha dan betis LURUS KE BAWAH melewati tengah papan. Dugaan awal saya (tinggi duduk salah) keliru: `SEAT_TOP` 0,48 m sudah sama dengan dudukan 0,485 m.
**Akar** (`assets3d.js` `seatLegs`): target pergelangan kaki ditaruh di LANTAI; kaki chibi terlalu pendek untuk mencapainya, sehingga IK dua-tulang meluruskan kaki ke bawah, menembus dudukan. Berlaku untuk semua kursi dan bangku, juga meja kerja.
**Perbaikan (hanya badan chibi/V4.2; badan manusia lama tidak diubah)**: paha diarahkan hampir horizontal ke depan (turun ±6°), betis menggantung ke bawah di depan tepi, dan badan digeser ke depan (`seatFwdApplied`, `0.275 - panjang paha` ≈ 0,145 m, dihapus saat berdiri atau saat kursi digeser `setSeatShift`) agar lutut jatuh melewati tepi dudukan.
**Terukur sesudah**: bangku: pinggul 0,13 m, lutut 0,27 m, pergelangan 0,29 m (semua di depan tepi 0,225 m), paha di atas papan; tampak samping: paha menumpu horizontal, betis menggantung di depan tepi. Meja kerja: lutut/pergelangan kini di tepi depan kursi (sebelumnya di tengah dudukan). 171 agen, tanpa galat.
**Belum**: tinggi paha masih ±6 cm di atas papan (jarak pinggul ke permukaan bawaan rig); kursi putar kantor tepi depannya ±0,21 m sehingga margin tipis; tabrakan lengan dengan meja saat mengetik dengan badan lebih maju belum diperiksa satu per satu.

## S. Gelombang 26 (2026-11-17, malam): agen NPC berjalan di atas bukit

**Laporan Owner**: di Mode Play karakter pemain berjalan benar di atas bukit, tetapi saat Exit semua agen tertanam di bukit.
**Akar**: tinggi bukit (`terrainH`) hanya dipakai rumput, `surfaceAt` (pemain) dan kamera. Loop agen NPC hanya mengatur `y` lewat `elev()` (dek langit) sehingga agen berjalan di y=0 dan tenggelam di gundukan (catatan di bagian G sudah menandainya sebagai keterbatasan).
**Perbaikan** (`office3d.js`, loop agen): untuk agen non-pemain yang tidak duduk dan bukan titik jauh (lod < 4), `y = elev(x,z) + terrainH(x,z)` bila di atas bukit; flag `a.onHill` mengembalikan `y` ke dasar saat turun. Biaya: ≤12 gaussian per agen dekat per frame.
**Terukur** (salinan uji): agen berjalan melintasi puncak bukit setinggi 0,99 m: `y` = tinggi bukit di setiap langkah (selisih maksimum 0,000), naik sampai 0,987 dan kembali ke 0; 171 agen, tanpa galat. **Catatan uji**: halaman harus dimuat ulang sungguh-sungguh (location.reload); mengubah hash saja tidak memuat modul baru. **Belum**: agen yang berhenti di lereng saat mengobrol tidak digeser sendiri (mengikuti rumus yang sama bila lod < 4); pulau melayang lain tetap datar.

## T. Gelombang 27 (2026-11-18): monitor semua agen hidup

**Permintaan Owner**: semua monitor menampilkan sesuatu tentang yang sedang dikerjakan (kerja, editing video, data), super ringan.
**Keadaan sebelumnya**: layar meja sudah berupa shader gulir dengan strip tekstur bersama per jenis konten, tetapi agen idle (hampir semua) menampilkan "saver" bercak biru (itulah layar biru polos di tangkapan Owner).
**Perubahan** (`office3d.js`, hanya ±14 kanvas bersama dan satu shader; tidak ada beban per agen):
- Jenis konten baru (digambar sekali, dipakai semua meja): `video` (editor timeline: pratinjau, 3 jalur klip, playhead), `wave` (gelombang audio), `dash` (kartu KPI + grafik garis), `feed` (aliran aktivitas), `mail`, `cal` (kalender). Ditambahkan ke daftar per divisi (`ROLE_SCREENS`: marketing/desain/e-commerce mendapat video, dst).
- Agen idle tidak lagi memakai saver biru: mereka menampilkan konten AMBIEN (dash, feed, mail, cal, chart, kanban; dipilih dari id agen sehingga stabil) dengan gulir lambat dan warna redup. Agen yang bekerja memakai konten sesuai divisinya, gulir lebih cepat (sudah ada). Offline tetap mati.
- **Bilah judul "sedang mengerjakan apa"**: seperlima atas layar menampilkan titik status + judul tugas `in_progress` agen (atau teks status: Rapat/Mengobrol/Siap bekerja/Offline), memakai satu uniform sampler di shader yang sama. Tekstur 256x32 dibuat hanya untuk meja dalam jarak 18 unit (9 di mode Ringan), dilepas (`dispose`) saat kamera >24 unit. Kunci cache program shader dinaikkan ke `deskscreen2`.
- **Terbukti** (salinan uji): 170 meja semuanya berisi konten (cal 21, chart 26, dash 39, feed 25, kanban 28, mail 31 saat semua idle); tekstur video/wave/dash/feed/mail/cal diperiksa langsung dari kanvasnya; bilah judul "Menyusun rencana promo akhi…" terbentuk dengan titik status; 171 agen, tanpa galat. **Belum**: tampilan layar dari sudut kamera dekat di dunia 3D tidak sempat dibingkai di panel uji (konten diperiksa dari tekstur, bukan dari render akhir); judul panjang dipotong di ±26 karakter.

**Koreksi T (Owner: "semua tetap biru")**: perubahan konten di atas benar tetapi TIDAK terlihat. Akar: model meja bawaan (`F.desk` di furniture.js) punya panel layar biru sendiri (`M.screen`, depan di z = -d/2 + 0,21) dan bezel (depan -d/2 + 0,215); layar dinamis dibuat di z = -d/2 + 0,188 = 0,022 m DI BELAKANG keduanya, sehingga selalu tertutup (kemungkinan sejak furnitur meja diganti). Bukti raycast dari mata pengguna ke layar: urutan hit = panel biru (1,117 m), bezel (1,132 m), layar hidup (1,139 m). **Perbaikan**: layar hidup dimajukan ke z = -d/2 + 0,224 (y 1,13). **Terukur sesudah**: pada 167 dari 170 meja, layar hidup adalah hit PERTAMA dari mata pengguna (3 sisanya terhalang benda lain di depannya). Pelajaran: verifikasi fitur visual dengan raycast/render akhir, bukan hanya dengan memeriksa tekstur.

## U. Gelombang 28 (2026-11-18): teleport untuk perjalanan jauh, lari untuk sedang

**Permintaan Owner**: saat rapat/tugas diminta, agen lama berjalan; jauh = teleport (UI menarik), dekat = lari.
**Aturan** (`office3d.js`): hanya perjalanan *mendesak* (dipicu kerja lewat `applyWant`: ke rapat, Library, stasiun kerja, kembali ke meja; flag `a.urgent`) yang dinilai di `routeTo` dengan panjang jalur L: **L > V.tele (bawaan 45 unit) = teleport**, **L > 9 = lari** (`a.runTrip`: klip Run + `GAIT.run`), selain itu jalan. Jalan-jalan santai/leisure dan mengikuti Owner tetap berjalan. Slider "Agen teleport bila jarak lebih dari" (Pengaturan visual > Utama > Keramaian; 0 = mati).
**Teleport** (`teleStep`): agen menghilang di tempat (skala seragam 1 -> 0,02 dalam 0,33 dtk; efek portal), muncul di titik terakhir sebelum tujuan (0,38 dtk), lalu berjalan beberapa langkah terakhir sehingga logika kedatangan (duduk, hadap, dll.) berjalan seperti biasa. Bila kamera >90 unit dari kedua ujung: teleport instan tanpa efek (hemat).
**Efek/UI**: pool 10 portal cahaya aditif (2 cincin menyebar, kolom cahaya, 16 percik naik; warna divisi agen); emote ⚡; suara `tele` sangat pelan (hanya bila kamera <35 unit dari tujuan); **chip kaca gradien** di kanan-bawah (ikon petir berputar bergradien konik, nama agen, tujuan) memuat semua agen yang teleport dalam 0,8 dtk (satu chip untuk satu rapat), tampil 2,6 dtk (`OfficeView.teleportChip`, `.tele3` di glass.css).
**Terbukti** (salinan uji; status server tak sampai ke panel tersembunyi sehingga dipicu lewat kait debug `__ray3d.applyWant`): 4 agen dari jarak 30-60+ unit semuanya TELEPORT ke Conference Hall dan mendarat ±5 unit dari kursi; skala turun ke 0,02 lalu pulih; 6 efek aktif bersamaan; chip "⚡ Teleport aray, Dewi, Maya, Bima -> Conference Hall" tampil dengan benar. **Belum**: keputusan lari belum diamati pada jarak 9-45 unit; tampilan efek portal dari dekat belum dilihat sebagai gambar yang jelas (hanya diukur); suara belum didengar.

**Penyempurnaan U (hasil uji lanjutan, 2026-11-18)** — hanya `public/js/office3d.js`; `server/` tidak disentuh karena sesi "ux deployment" sedang mengubah `engine.js`/`collab.js`:
- **L diukur sepanjang JALUR** (keluar ruangan -> pintu -> jalan melingkar -> pintu tujuan), bukan jarak lurus. Terukur: jarak lurus 21-33 unit ternyata jalur 60-150 unit; dari plaza ke Conference Hall jalurnya 78-153 unit. Jadi hampir semua perjalanan antar-ruangan menjadi TELEPORT; lari terjadi untuk perjalanan di dalam satu ruangan/area.
- Batas lari diturunkan 9 -> **6 unit** agar "dekat = lari" nyata. Terukur di dalam Conference Hall: jalur 7,8 dan 8,5 -> LARI (kecepatan 2,68 dan 1,81 unit/dtk, ±1,6-2,3x agen yang berjalan ±1,1-1,2); jalur 4,4 dan 3,4 -> jalan.
- Rute baru yang menggantikan teleport yang sedang berjalan membatalkannya (skala dipulihkan, `a.tele = null`) agar indeks `drop` tidak salah.
- **Bukti visual**: dengan kamera 6 unit dari titik pendaratan, kolom cahaya portal tampak menyala di Conference Hall dan agen sedang muncul kembali (tangkapan layar panel uji). **Belum**: suara `tele` tidak dapat didengar dari panel uji (tidak ada galat saat dipanggil); tampilan efek lebih menarik (mis. warna cincin lebih kuat di siang hari) bisa disetel bila Owner mau.
- Kait debug `__ray3d.applyWant(id)` ditambahkan untuk menguji jalur kerja tanpa menunggu aliran status server.

## V. Gelombang 29 (2026-11-18): teleport untuk pemain (menu V / tombol ⚡)

**Masalah Owner**: di Mode Play mouse terkunci (pointer lock) sehingga tidak bisa mengeklik apa pun, dan tidak ada cara berpindah cepat.
**Solusi** (client saja; `server/` tidak disentuh karena sedang dikerjakan sesi lain):
- **Tombol V** (Play dan kamera bebas; terdaftar di daftar tombol yang bisa diubah) dan **tombol ⚡** di bilah kanan-atas membuka **menu teleport**. Saat menu terbuka, `setBlocking(true)` melepas kunci mouse dan mengabaikan tombol permainan; kolom cari langsung fokus (Enter = hasil pertama, Esc = tutup, klik di luar = tutup). Setelah memilih, mouse dikunci ulang (di dalam klik, jadi diizinkan browser).
- **Tujuan** (`teleTargets`): Plaza tengah, landmark plaza (Company Brain, panggung, air mancur, kios, Papan Tugas, Bengkel Agent Studio, dll.; papan nama ruangan disaring karena sudah ada di grup Ruangan), Sky Deck (mendarat DI atas dek, y=5), semua Ruangan (27), dan Agen (yang aktif tampil dulu; ketik untuk mencari semua 171). Titik mendarat dicari dari titik bebas terdekat (`collides`) dan menghadap tujuan.
- **Mesin sama dengan agen**: pemain mengecil (0,33 dtk) di portal cahaya, muncul di tujuan (0,38 dtk), kamera orang-ketiga langsung dipasang di belakang karakter (tanpa menyapu seluruh kampus), dan chip "⚡ Teleport Anda -> <tujuan>" muncul. Di kamera bebas: kamera terbang ke tujuan dengan portal.
- **Terbukti** (salinan uji, lewat hotkey nyata dan klik item): menu terbuka dengan V di Play, mouse dilepas, kolom cari terfokus, pencarian "conference" menemukan 2 hasil; teleport ke Conference Hall (38,9; 0; -20), Plaza tengah (0; 0; 12), Sky Deck (5,8; 5; -16) dan ke samping agen Maya (jarak 1,63) semuanya benar, skala turun ke 0,02 lalu pulih, menu tertutup, chip tampil; di kamera bebas target kamera berpindah; tanpa galat konsol.
- **Belum**: pointer lock sungguhan tidak dapat diuji di panel uji (hanya pelepasan lewat `setBlocking`); layar sentuh/seluler tidak punya tombol V (tombol ⚡ tersedia); Sky Deck lain dan ruangan tertentu belum dicoba satu per satu.
