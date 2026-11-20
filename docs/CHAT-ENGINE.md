# Chat Engine

Satu mesin obrolan untuk web, Kantor 3D, Telegram, dan Discord. Pengguna cukup ngobrol dengan bahasa biasa; tidak ada kata "Pemandu", menu paksa, wizard, atau sintaks `@nama` yang wajib. Berkas: `server/chat-engine.js` (percakapan, routing, rapat), `server/chat-router.js` (pencocokan kabur, tanpa token), `server/pemandu-chat.js` (model obrolan, streaming, alat, saringan bahasa), `server/chat-sources.js` (sumber, kutipan, dokumen jadi), `server/pemandu.js` (mesin usulan kerja dan konfirmasi; dulu "Pemandu").

## Jalur satu pesan

1. `pemandu.turn()` (dipakai klien web, Telegram, Discord) menuju pintu depan yang didaftarkan `chat-engine.js`; satu percakapan = satu sesi (`conv.id`), dengan riwayat yang disimpan di `db().chat.convs`.
2. Tombol milik alur kerja (konfirmasi, hasil, otomasi) langsung diteruskan ke mesin kerja. Ketikan di tengah usulan atau hasil juga diurus alur itu, kecuali jelas menyebut orang lain.
3. Kendali dengan bahasa biasa: "cukup Sora saja", "ajak yang paham pajak".
4. Permintaan kerja yang jelas ("buatkan ...", "tolong tulis ...") dan sapaan/basa-basi dijawab Sora lewat mesin kerja (kalimat konfirmasi, bukan eksekusi).
5. Selain itu **router** memutuskan siapa yang dilibatkan: tidak ada orang tertentu berarti Sora menjawab dengan model; ada, maka Sora menjelaskan singkat ("Aku ajak Dewi (Finance)") lalu orangnya menjawab sebagai pembicara terpisah.

## Router (otomatis penuh)

`chat-router.js`, murni dan tanpa model: nama depan dengan salah ketik kecil (huruf tertukar, satu huruf salah), panggilan ("Pak Hendra"), peran dan bagian ("tim keuangan", "bagian keuangan", "si desainer"), dan topik sehari-hari (pajak, promosi, kontrak, stok) lewat kamus sinonim per divisi ditambah keahlian pimpinan divisi. Hasil:
- `agents`: satu orang (pimpinan divisi), atau pimpinan + 1 sampai 2 staf untuk "tim" dan rapat.
- `siapa`: "siapa yang bisa ..." dijawab daftar kandidat dengan tombol "Tanya X".
- `ambiguous`: nama kembar tanpa pimpinan, atau dua bidang sama kuat: Sora bertanya **sekali** dengan 2 sampai 3 tombol (`pilih:<id>`) plus "Sora saja".
- `none`: Sora menjawab sendiri.
Nama depan 4 huruf harus persis (supaya "hari" tidak dikira Hadi). Saran "@" (opsional, tidak pernah wajib): `GET /api/chat/saran?q=keu` mencari lewat nama, peran, atau divisi.

## Pembicara, rapat, dan penugasan balik

- Setiap balasan membawa `speaker { id, nama, peran, divisi }` dan `thread[]` (urutan bicara satu per satu; `say` gabungan berprefiks nama untuk Telegram/Discord).
- Rapat singkat (kata rapat/diskusi, atau beberapa orang terlibat): Sora membuka, 2 sampai 3 orang berpendapat bergiliran (tiap orang membaca pendapat sebelumnya), lalu Sora merangkum keputusan dan tindak lanjut dengan tombol saran. Rapat panjang yang tercatat tetap lewat `collab.runMeeting`.
- Penugasan balik: yang sedang tidak aktif digantikan rekan sedivisi; bila model gagal menjawab, Sora mengambil alih dan menjelaskannya.
- Tujuan percakapan: `auto` (bawaan), `agen` (satu orang), `tim` (beberapa orang). Bisa diganti tengah jalan; riwayat tetap dan orang baru ikut membaca transkrip.

## Konfirmasi dan eksekusi

- Orang lain (agen) **tidak pernah membuat pekerjaan** dari obrolan. Bila model menandai butuh hasil jadi (`kerja: true`) pada pesan yang bukan pertanyaan, Sora mengusulkannya sebagai kartu `confirm`: satu kalimat, tombol Ya, kerjakan / Ubah / Nanti saja.
- Pagar di kode: `startWork()` di `pemandu.js` melempar galat kecuali `session.confirmed === true`, yang hanya diatur oleh "Ya, kerjakan" atau perintah eksplisit mengubah hasil. Pemasangan otomasi punya kartu konfirmasi sendiri (pratinjau, Ya, nyalakan / Ubah / Batal) dan hanya untuk Owner/Admin.
- Izin yang sama berlaku di semua jalur karena semuanya memakai `turn()`.

## Memori dan alat

- Profil "Yang aku tahu tentang kamu" dan catatan hasil belajar ikut ke perintah model; riwayat percakapan dicari lewat `GET /api/chat/conversations?q=`.
- Alat lewat satu pintu kecil (`alat`: `catatan`, `web`): hasilnya jadi bagian percakapan dengan penanda `tools: [{ label: "Memanggil Catatan", detail }]` yang bisa dibuka.

## Rute

| Rute | Fungsi |
|---|---|
| `GET /api/chat/conversations?q=&status=aktif\|arsip\|semua` | daftar riwayat `{id, judul, tujuan, status, sumber, waktu, peserta[], terakhir}` |
| `POST /api/chat/conversations` `{tujuan?, agen?[], judul?}` | percakapan baru |
| `GET /api/chat/conversations/:id` | detail dan pesan (`pembicara`, `teks`, `jenis`) |
| `PATCH /api/chat/conversations/:id` `{judul?, status?, tujuan?, agen?[]}` | ganti nama, arsip, ubah tujuan |
| `DELETE /api/chat/conversations/:id` | hapus |
| `POST /api/chat/conversations/:id/send` `{teks?, pilihan?}` | kirim pesan atau tekan tombol; hasilnya objek balasan (kontrak data) + `speaker`, `thread`, `tools`, `dilibatkan[]`, `disarankan[]` |
| `POST /api/chat/conversations/:id/peserta` `{tambah?[], hapus?[]}` | kepingan peserta |
| `GET /api/chat/conversations/:id/disarankan` | orang yang cocok dengan topik terakhir dan belum ikut |
| `POST /api/chat/conversations/:id/tugas` `{aksi: 'arahan'\|'hentikan', teks?}` | tambah arahan atau hentikan pekerjaan yang berjalan |
| `GET /api/chat/saran?q=` | saran "@" |
| `GET /api/chat/kabar` | notifikasi aktivitas (bukan chat) |
| `GET /api/percakapan` | alias daftar riwayat berbentuk larik `[{id, judul, tujuan, waktu, peserta:[agenId]}]` untuk tampilan Kantor 3D |
Kompatibel mundur: `POST /api/pemandu/turn` (sama dengan `send`) dan rute `/api/orchestrate`, `/api/dm`, kanal lama tidak diubah.

## Belum
Daftar lama sudah dikerjakan. Yang masih tersisa ada di bagian "Daftar Belum terakhir" di akhir dokumen ini.

## Kebutuhan dari sisi tampilan Kantor 3D (sesi P5, 2026-11-19)
Satu permukaan chat di tengah bawah (`#odock`) memakai rute yang ada: `POST /api/orchestrate` (teks, `to`, `mode`, `channelId`), `POST /api/dm`, kanal `group` untuk riwayat. Riwayat kini dibangun di klien dari kanal `group` yang anggotanya termasuk pengguna.
Rute baru yang dibutuhkan agar tampilan tidak menebak:
1. `GET /api/percakapan` -> `[{ id, judul, tujuan: 'auto'|'agen'|'tim', waktu, peserta: [agenId] }]` (urut terbaru; termasuk DM, bukan hanya kanal group).
2. Balasan `/api/orchestrate` sebaiknya memuat `disarankan: [agenId]` (untuk baris "Disarankan: …" di atas kolom ketik) dan `dilibatkan: [agenId]` (kepingan yang bisa diketuk di balasan Sora).
3. Izin: `PATCH /api/settings { permission: 'ask'|'auto'|'full' }` sudah ada (full hanya Owner/Admin; review ikut otomatis, otomasi dan aksi browser tidak pernah).

## Obrolan ala ChatGPT 2026 + NotebookLM (2026-11-19)

Halaman "Obrolan" (`public/js/obrolan-view.js`, gaya `public/css/obrolan.css`; `mountObrolan(root, {compact})` bisa dipakai ulang panel Kantor 3D: satu mesin, satu riwayat) adalah tampilan lain dari percakapan yang sama.

**Mengalir (streaming).** `POST /api/chat/conversations/:id/stream` mengirim peristiwa SSE: `mulai {speaker}` -> `delta {speaker, teks}` (berulang) -> `alat {alat}` -> `selesai {respons}` (atau `galat`). Dengan Groq, jawaban mengalir kata demi kata lewat `llm.groqStream`. Skema JSON ketat membuat Groq menahan seluruh balasan, jadi jalur alir memakai protokol teks: baris JSON kendali `{alat, kueri, kerja, judul, pilihan}`, jawaban teks biasa, lalu `###SARAN` dan `{saran, kutipan}`. Jawaban hanya mengalir bila `alat` = tidak (bila perlu alat, alatnya dipanggil dulu). Bila aliran gagal atau tidak bisa diurai, jatuh ke balasan utuh yang dipotong-potong; klien selalu menutup dengan objek `selesai`. Dokumen jadi juga mengalir. Penyedia lain dan tes memakai potongan 28 huruf dari hasil utuh (bukan streaming asli).

**Tanpa pendamping.** Asisten utama tidak tampil sebagai pembicara pengantar: tidak ada kalimat "Aku ajak ..."; pembicaranya hanya orang yang menjawab. `speaker.utama = true` menandai asisten utama (antarmuka menampilkannya tanpa nama). Peserta yang dilibatkan ada di `dilibatkan[]` (kepingan yang bisa dilepas lewat `POST .../peserta`); `disarankan[]` untuk kepingan "Ajak ...". Catatan pergantian orang yang sedang tidak aktif ada di `notes`.

**Saran lanjutan dan pilihan ganda.** Tiap jawaban bermakna diakhiri 2 sampai 4 chip (`options`, id `ces:N`; menekannya sama dengan mengetik). Bila model butuh klarifikasi, `pilihanGanda: true` dan chip berisi pilihan jawaban (tombol kecil, boleh diabaikan dengan mengetik). Pertanyaan pilihan routing (`pilih:<id>`) juga bertanda `pilihanGanda`.

**Sumber dan kutipan (gaya NotebookLM).** Per percakapan, maksimal 8 sumber (teks tempel, berkas teks, Catatan, hasil): `GET/POST /api/chat/conversations/:id/sumber`, `DELETE .../sumber/:sid`. Isi sumber masuk perintah model sebagai blok `[n] judul` (sumber panjang dipilih potongannya yang cocok dengan pertanyaan), ditandai sebagai data, bukan perintah. Model memberi `kutipan [{n, cuplikan}]`; server memeriksa tiap cuplikan terhadap isi sumber asli dan mengembalikan `kutipan [{n, judul, cuplikan, terverifikasi}]` (yang tidak cocok ditandai, tidak disembunyikan). Bila data tidak ada di sumber, model diperintahkan berkata tidak ada.

**Dokumen jadi.** Balasan yang bermakna (atau percakapan dengan sumber) membawa `aksi [{id:'gen:<jenis>', label}]`: ringkasan, panduan belajar, FAQ, briefing, rencana, email, tabel. Menekan tombol (atau mengetik "buatkan ringkasan" saat ada sumber) membuat dokumen dari sumber dan percakapan, mengalirkannya, menyimpannya ke **Hasil Saya** sebagai pekerjaan selesai (`kind: task`, `generated: true`; bukan pekerjaan baru untuk pembantu), dan membalas dengan `dokumen {id, judul, jenis, isi, versi}`. Chip lanjutan: Simpan ke Catatan (`doc:simpan:<id>`, folder Hasil), Buat lebih singkat, Tambah contoh, Ubah jadi tabel. Perintah lanjutan yang diketik ("buat lebih singkat") mengubah dokumen yang sama (versi naik, Hasil Saya ikut diperbarui). `GET .../dokumen/:docId` memberi `{nama, judul, isi}` untuk diunduh. Menekan tombol aksi adalah konfirmasi eksplisit; aksi berdampak keluar (kerja panjang, otomasi) tetap lewat kartu konfirmasi di kode.

**Riwayat di tampilan.** Percakapan baru, Riwayat (cari, buka, ganti nama, arsipkan, hapus), Sumber (tempel, berkas teks, Catatan, Hasil), kepingan peserta, dan menu "Buat dokumen dari ini".

**Router: perbaikan.** Kata biasa yang kebetulan sama dengan nama ("itu bagus" vs Bagus) tidak dikira orang; nama dikenali bila disapa (tanya X, pak X, "X," di awal), berhuruf kapital di tengah kalimat, atau nama panjang yang persis.

### Uji model asli (kedua)
Percakapan 12 giliran, Groq 20b/120b, biaya total sekitar 0,003 USD: sapaan, definisi (mengalir 55 sampai 167 potongan), tindak lanjut, routing topik, sumber dengan kutipan terverifikasi, pertanyaan di luar sumber (model berkata tidak punya data), dokumen ringkasan dan perubahan "lebih singkat" (mengalir), "siapa yang bisa urus pajak", dan permintaan kerja berhenti di kalimat konfirmasi. Tidak ada pekerjaan tanpa konfirmasi dan tidak ada kata terlarang.

### Masih belum
- Jawaban agen yang memakai alat (catatan/web) tidak mengalir pada fase pertama; teksnya tiba utuh lewat `selesai`.
- Streaming bagi penyedia selain Groq (Claude) belum asli.
- Berkas PDF/Word belum dibaca (hanya teks); salin isinya lalu tempel.
- Sumber hanya hidup selama percakapan itu; belum ada pustaka sumber bersama.
- (Diperbarui) Jeda pekerjaan, kemampuan staf dari obrolan, streaming, dan `/api/orchestrate` bawaan Chat Engine sudah dikerjakan; lihat "Daftar Belum terakhir".

## Pembaruan akhir (2026-11-19): layar awal, panel, jeda, kemampuan, kompatibilitas

- **Layar awal** hanya sapaan singkat, kolom ketik, dan 2 sampai 4 chip saran dinamis dari `GET /api/chat/awal` (lanjutan percakapan terakhir, hasil yang menunggu, ide dari profil usaha, saran sesuai jam). Tidak ada kartu menu, tidak ada tulisan "Aku Sora", tidak ada "Yang aku tahu tentang kamu", tidak ada ajakan kenalan. `pemandu.home()` kini mengembalikan `cards: []` tanpa `sub`.
- **Memori** pindah ke **Pengaturan > Memori** (`public/js/memori-view.js`): profil bisa dibaca dan diubah, kenalan lewat alamat situs atau satu kalimat, dan hal yang dipelajari dari bekerja bersama bisa dihapus.
- **Satu komponen**: `mountObrolan(root, { compact })` dipakai halaman Obrolan (HP penuh) dan panel kiri Kantor 3D (420-480 px; pemasangannya ada di sisi tampilan). Header kecil (judul percakapan otomatis, percakapan baru, riwayat, sumber), daftar pesan, chip saran, pilihan ganda, **panel sumber lipat**, komposer. `@` opsional: mengetik "@" menampilkan saran yang bisa dicari lewat nama, peran, atau divisi (`GET /api/chat/saran`); tidak pernah wajib.
- **Jeda pekerjaan**: tombol Jeda/Lanjutkan di kartu kemajuan, atau `POST .../tugas {aksi: 'jeda'|'lanjut'|'arahan'|'hentikan'}`. Penanda `paused` pada tugas; antrean `engine.js` tidak memulai tugas `todo` yang dijeda. Bagian yang sudah berjalan tetap selesai (tidak dipotong di tengah).
- **Kemampuan staf dari obrolan**: kolom `alat: "staf"` mencari kemampuan yang cocok lewat `staff/manager.rankKemampuan` dan menampilkannya sebagai penanda "Memanggil kemampuan". Hanya mencari: menjalankannya (yang bisa berdampak) tetap lewat usulan kerja yang dikonfirmasi.
- **`/api/orchestrate`**: kirim `mesin: "chat"` (dan `percakapan`) agar pesan diurus Chat Engine; hasilnya `{ action: 'chat', convId, respons }`. Tanpa flag, perilaku lama dok Kantor 3D tidak berubah (ada kanal dan pesan lama yang bergantung padanya); tampilan baru memakai `/api/chat/*`.

### Daftar "Belum" yang tersisa (jujur)
- Jawaban yang memakai alat tidak mengalir pada fase pertama, dan beberapa jawaban orang tertentu tiba utuh lewat `selesai` walau Groq aktif.
- Streaming asli hanya untuk Groq; penyedia lain memotong hasil utuh.
- Kemampuan staf dari obrolan dipicu oleh permintaan berangka yang memuat kata kerja hitung/susun/cek; permintaan tanpa angka tetap lewat usulan kerja yang dikonfirmasi. Browser belum jadi alat obrolan.
- PDF/Word belum dibaca sebagai sumber (hanya teks).
- Saluran Telegram/Discord memakai mesin yang sama, tetapi percakapannya tercatat dengan sumber "web" karena `channels/core.js` belum meneruskan nama saluran.
- Kode dok lama (daftar pesan, mode, pemilih orang) masih ada di `views.js` walau tersembunyi; penghapusannya dikerjakan sesi tampilan.

## Tiga sisa, selesai (2026-11-19)

**1. Panel kiri Kantor 3D memakai komponen yang sama.** Di `views.js` (`OfficeView.setLeft`), "Obrolan" kini halaman biasa di panel kaca kiri: `ObrolanView.mount` memasang `mountObrolan(root, {compact: true})` bila induknya `#lpage` (panel 420-480 px), dan halaman penuh di HP memakai komponen yang sama, satu riwayat. Dok lama dijadikan **bilah pintu masuk**: kolom ketiknya meneruskan pesan ke komponen (`OfficeView.bukaObrolan`), tombol "Percakapan" membuka panel Obrolan, dan "Menunggu kamu" membuka Hasil Saya. Daftar pesan, riwayat, mode, dan pemilih orang milik dok lama tidak lagi dipakai (kodenya masih ada, tersembunyi, dan bisa dihapus sesi tampilan). **Enter atau "/" saat bermain karakter** melepas kursor, membuka panel Obrolan, dan memfokuskan komposer (`#pmIn`).

**2. Kemampuan staf dijalankan dari obrolan** (`server/chat-staf.js`, 31 kemampuan inti). Permintaan berhitung/menyusun yang memuat angka dicocokkan ke kemampuan lewat `manager.rankKemampuan`; formulir diisi dari kalimat (model kecil, JSON ketat; tanpa model: angka berurutan ke bidang angka, dan **isian wajib diperiksa pengguna dulu**); bagian wajib yang kurang ditanya satu per satu (pilihan jadi tombol). Bila spesifikasi rakitan berdampak keluar (`composeFor(...).confirm`, ragu dianggap berdampak), berhenti di kartu `confirm` dengan pratinjau isian: Ya, jalankan / Batal. Pagar di kode: satu-satunya jalan ke `confirmed: true` adalah tombol `staf:ya`, dan `staff/runner.js` tetap menolak menjalankan staf berdampak tanpa itu. Eksekusi lewat `runner.run({capability, person, ...})`; hasil tampil di utas (pembicara = staf yang mengerjakan, dengan baris "Dihitung dari ...") dan tercatat sebagai jalan staf yang tampil di Hasil Saya (`respons.hasil = {id, status}`). Alat `alat: "staf"` tetap hanya mencari.

**3. `/api/orchestrate` bawaannya Chat Engine.** Pesan baru diurus Chat Engine (`{action: 'chat', mesin: 'chat', convId, channelId: null, members, orchestrator, respons}`), tercatat di riwayat bersama, dan bisa dilanjutkan dengan `percakapan`. **Jalur lama tetap** (bentuk balasan lama) bila ada `channelId` (thread pekerjaan, rapat), `to` (penerima tertentu), gambar, `mode` selain auto, rapat langsung yang sedang berjalan, atau `mesin: "lama"`. Diuji pada peladen sungguhan di `test/orchestrate-chat.test.js` (port 4652): bawaan, kompatibilitas mundur, tanpa pekerjaan sebelum konfirmasi, dan aliran SSE.

## Uji model asli (2026-11-19)
Satu kali, Groq 20b/120b, biaya total sekitar 0,005 USD: sapaan, diskusi bisnis, routing topik ("strategi promosi" menuju Maya), rapat tim keuangan dengan ringkasan moderator, nama salah eja ("Hendar" menuju Hendra), "siapa yang bisa urus pajak", "cukup Sora saja", dan permintaan kerja. Tidak ada pekerjaan tercipta tanpa konfirmasi dan tidak ada kata terlarang. Temuan: model sempat mengarang data kas; aturan "jujur soal data" ditambahkan ke perintah dan terbukti menahan jawaban ("aku belum punya data").

## Otak obrolan setara Claude: perilaku, alat, memori, antarmuka (2026-11-19)

Perilaku lengkap dan batasnya ada di [PERILAKU-OBROLAN.md](PERILAKU-OBROLAN.md). Ringkasnya, yang berubah di mesin ini:

- **Satu prompt untuk semua yang berbicara** (`server/otak/perilaku-obrolan.js`): asisten utama, tiap orang/staf, penulis dokumen, Telegram, Discord. `pemandu-chat.systemPrompt` dan `chat-sources.docSystem` kini hanya meneruskan ke sana.
- **Putaran rencana-aksi-amati** di `pemandu-chat.reply`: sampai 4 langkah, 3 alat paralel (`catatan`, `web`, `sumber`, `hitung`, `staf`), anggaran 0,06 USD per giliran, penghitung aman tanpa `eval`, verifikasi angka dan pengakuan alat gagal. Penanda langkah (`tools[]` dengan `ok` dan `langkah`) ikut di balasan.
- **Kompaksi** (`chat-engine.compact`): setelah 24 pesan, bagian lama diringkas ke `conv.ringkasan` (juga ke sesi asisten utama lewat `pemandu.setRingkasan`).
- **Rute baru:** `POST /api/chat/conversations/:id/ulang` dan `/ubah` (SSE, memundurkan riwayat lalu mengirim ulang), `POST …/umpan` (`{pesanId, nilai: 'suka'|'kurang'|''}`). Balasan `turn` kini membawa `pesanId`. `GET …/conversations/:id` mengembalikan `umpan` per pesan.
- **Pagar relevansi staf** (`chat-staf.relevan`): kemampuan staf hanya terpicu bila kalimat memuat kata khas kemampuan itu; sebelumnya "berapa 11 persen dari 2.000.000" dibajak kemampuan "catat produksi" (ditemukan evaluasi dengan model asli).
- **Streaming:** jawaban alir Groq kini memakai `effort: low` dan mengulang sekali bila model mengembalikan keluaran kosong sebelum ada yang tampil.
- **Antarmuka** (`public/js/obrolan-view.js`, `public/css/obrolan.css`): indikator berpikir, baris langkah yang bisa dibuka, Salin/Ulangi/Membantu/Kurang pas, Ubah pesan, tombol Hentikan, panel dokumen (Salin/Unduh/Simpan ke Catatan). Markdown penuh dari `md.js` (sudah ada). Tata letak CSS sesi tampilan tidak diubah; panel hanya menumpuk di dalam komponen (`.ob-panel`).
- **Penyedia model** (`server/otak/penyedia-chat.js`): tingkat cepat/pintar mengikuti konsol pengelola; Claude bila kunci diisi di sana. Tes: `test/obrolan-otak.test.js` (12 tes), evaluasi 33 percakapan: `scripts/evaluasi-obrolan.mjs`.

Belum / sebagian: mesin tugas (`engine.js`) memakai prompt perannya sendiri; alat browser belum jadi alat obrolan; Ubah hanya untuk pesan terakhir; Hentikan memutus tampilan tetapi server dapat menyelesaikan jawaban; jalur Claude belum diuji dengan kunci sungguhan.

## Tampilan ringkas dan multi-agen (revisi Owner, 2026-11-19)
- **Gaya** (`public/css/obrolan.css`, blok "TAMPILAN RINGKAS", selektor `.page.ob`; `identity.css` tidak diubah): teks 14 px/1,5, judul dalam jawaban 15 px, label dan tombol 12 px, jawaban agen tanpa gelembung (avatar bulat 20 px + nama + peran kecil, teks lebar penuh), pesan pengguna gelembung ringan di kanan, komposer 38 px, "Sisa jatah" 11 px, aksi jawaban berupa ikon 28 px sebaris (Salin, Ulangi, Membantu, Kurang pas, Buka di panel).
- **Peserta:** satu baris chip kecil (avatar + nama + ×) tepat di atas komposer, bisa digulir ke samping, plus "+ Disarankan" dan "+ Tambah" (menyisipkan "@" dan membuka daftar saran). Pembicara yang sedang menjawab ditandai titik berdenyut halus di chipnya dan di kepala jawabannya.
- **Router:** "tim keuangan dan Ratih" kini melibatkan pimpinan tim DAN Ratih (sebelumnya nama menutupi tim).
- **Gulir:** `toEnd` menggulir wadah yang benar langsung ke dasar sehingga aksi di bawah jawaban tidak tertutup komposer.
- **Tes:** `test/obrolan-multiagen.test.js` (6 tes: mention + tim, satu/banyak/tim dengan nama-peran-divisi, tambah/hapus peserta, aliran per pembicara, ulangi multi-pembicara, pilihan ganda/saran, bukti gaya ringkas).

## Halaman Pesan: kontak dan utas per kontak (2026-11-19)
Terpisah dari Obrolan. **Obrolan** = bicara langsung (diskusi, dialog dengan siapa saja, rapat, dokumen). **Pesan** = seperti WhatsApp/Telegram: daftar kontak di kiri, utas kontak terpilih di kanan.

- **Server** `server/chat-kontak.js`, rute `/api/pesan/*`: `GET kontak?q=&jenis=orang|divisi|grup` (avatar, status kerja awam, pesan terakhir, belum dibaca, pin), `GET kontak/:kid` (utas, tugas, info), `POST kontak/:kid/sesi` (percakapan khusus kontak), `…/baca`, `…/pin`, `POST|PATCH|DELETE grup`. Kunci kontak: `orang:hendra`, `divisi:fin`, `grup:g-…`.
- **Tanpa data ganda:** satu kontak = satu percakapan Chat Engine (`conv.kontak`), tersembunyi dari riwayat Obrolan; utas = percakapan itu + pesan kontak yang sama di percakapan Obrolan lain (hanya dibaca, ditandai Obrolan/Rapat); tugas dibaca dari daftar tugas ruang kerja (`assigneeId`/`divisionId`). Hanya tanda kecil (pin, sudah dibaca, grup buatan) disimpan di `db().chat.kontak[userId]`. Semua dibatasi `userId` dan ruang kerja aktif; pengguna lain mendapat "tidak ditemukan".
- **Pengiriman** memakai rute Chat Engine yang ada (aliran, saran lanjutan, konfirmasi, ulangi, sumber): divisi dijawab tim (pimpinan + dua staf, rapat singkat), grup dijawab anggotanya (2 sampai 4).
- **Tampilan** `public/js/pesan-view.js` + `public/css/pesan.css` (14 px, kaca): dua kolom bila lebar ≥ 700 px, satu kolom dengan tombol kembali di panel sempit dan HP; tab Obrolan | Tugas | Info; filter Semua/Orang/Divisi/Grup; pencarian; pin; "+ Grup". Utas memasang `mountObrolan(host, {kontak})` (komponen yang sama). Terdaftar di `VIEWS.pesan` dan menu (`CORE`: Kantor, Obrolan, Pesan, Hasil, Catatan, Tim).
- **Sinyal ke Kantor 3D:** peristiwa `raiverse:fokus-kontak` (`detail: {id, sisi: 'kanan'}`) dikirim saat satu orang diajak bicara di Pesan atau Obrolan; `views.js` meneruskannya ke `office.focus(id, {sisi})`. Pembingkaian "di kanan" bergantung pada pembingkai kamera sesi tampilan (parameter kedua baru diabaikan bila belum didukung).
- **Tes:** `test/pesan-kontak.test.js` (10 tes).

## Daftar Belum terakhir (jujur)
Sudah dikerjakan dari daftar lama: jeda/lanjut/hentikan pekerjaan, streaming (asli di Groq), kemampuan staf dari obrolan dengan konfirmasi di kode, `/api/orchestrate` bawaan Chat Engine, evaluasi mutu dengan model asli, sumber Telegram/Discord kini tercatat benar (`channels/core.js` meneruskan `source`), layar HP 375 px dan mode gelap diperiksa untuk Pesan dan Obrolan.
Masih tersisa:
- Jawaban yang memakai alat tidak mengalir pada fase pertama; streaming asli hanya Groq.
- PDF/Word belum dibaca sebagai sumber (hanya teks); sumber hidup per percakapan.
- Alat browser belum menjadi alat obrolan; mesin tugas `engine.js` belum memakai prompt tunggal.
- Ubah pesan hanya untuk pesan terakhir; Hentikan memutus tampilan, server dapat menyelesaikan jawaban.
- Pembingkaian karakter "di kanan" di Kantor 3D menunggu dukungan kamera sesi tampilan; jalur Claude belum diuji dengan kunci sungguhan.
- Lencana belum dibaca dihitung dari pesan kontak di percakapan; belum ada pemberitahuan dorong (push) saat halaman tertutup.

## Komposer bersama (Obrolan + dock Kantor 3D) (2026-11-19)
Satu logika, bukan dua komposer. `public/js/komposer-core.js` (modul murni, tanpa DOM dan tanpa impor, dites di Node) memegang data dan aturannya; `obrolan-view.js` memasangnya di komposer Obrolan, dan dock Kantor 3D memakai antarmuka yang sama.
- **Antarmuka:** `buatKomposer({panggil, nama, bisaKelola, ambilData})` → `state` {`target` {mode auto/agen/tim, ids, label "Ke: Sora (otomatis)"}, `izin` {nilai, opsi}, `status` {kode, teks}, `mengetik`, `sibuk`, `convId`}; `subscribe`, `setTarget`, `setIzin`, `setSibuk`, `setMengetik`, `pakaiPercakapan`, `sinkron`, `riwayat(q)`. Peristiwa jendela `raiverse:komposer` (detail: target, izin, status, mengetik, convId) memberi kabar ke pihak lain.
- **Izin tiga kata** (`ask` Tanya dulu, `auto` Lanjut sendiri, `full` Serahkan penuh hanya pengelola) memakai `PATCH /api/settings {permission}` yang sudah ada; gagal = nilai lama kembali. Penting: izin TIDAK melonggarkan pagar obrolan; memulai pekerjaan dari obrolan tetap lewat kalimat konfirmasi dan tombol "Ya, kerjakan"; izin mengatur persetujuan hasil kerja setelah berjalan.
- **Penerima** otomatis/orang/rapat mengikuti peserta percakapan; disimpan lewat `PATCH /api/chat/conversations/:id {tujuan, agen}`.
- **Status** dari data ruang kerja (prioritas: sedang menjawab, dijeda, terhambat, perlu kamu, sedang jalan, siap). **Keadaan kursor:** `mengetik` true saat kolom berisi dan false saat kosong atau kehilangan fokus (untuk pembingkaian kontrol 3D oleh sesi tampilan).
- Tes: `test/komposer-core.test.js` (6 tes). Penempatan dan gaya dock (selalu kiri bawah) dikerjakan sesi tampilan; yang tersisa dari sisi saya hanya memasang dock ke `komposer-core.js` bila sesi tampilan memintanya.

## Prioritas penerima pesan (perbaikan bug "halo kamu reno ya" dijawab Sora, 2026-11-19)
Akar masalah: sapaan orang kedua ("halo kamu reno ya") tidak dianggap menyebut nama, sapaan polos selalu dijawab Sora, dan fokus 3D tidak ikut dikirim. Sekarang, per pesan (`chat-engine.turnInti`):
1. **Tujuan eksplisit**: chip peserta, kontak dari Pesan (`conv.goal` bukan auto dengan peserta).
2. **Nama yang disapa atau disebut** (`chat-router.nameHits`): "tanya X", "@X", "halo X", "kamu X ya", "X, ...", "X kamu bisa apa", salah eja (nama pendek hanya bila jelas disapa). Kata biasa yang mirip nama ("itu bagus ya") tidak dihitung.
3. **Orang yang sedang diikuti/difokus di Kantor 3D**: klien mengirim `fokus` bersama pesan (rute `/send`, `/stream`, `/ulang`, `/ubah`, dan `/api/orchestrate`); views.js menyiarkan `raiverse:fokus-3d` dari `onFollow` kamera. Fokus hanya penerima bawaan: tidak menempel (fokus berganti, penerima ikut berganti) dan tidak mengalahkan nama yang disebut jelas. Catatan keputusan: urutan awal dari Owner menaruh fokus di atas nama; saya menaruh nama yang disapa/disebut di atas fokus karena "tanya Maya" saat memfokus Reno jelas ditujukan ke Maya.
4. **Topik/peran**, 5. **peserta yang sudah diajak**, 6. **Sora** hanya bila tidak ada yang cocok atau pesannya soal koordinasi (usulan kerja tetap lewat Sora dan kalimat konfirmasi).
- Sapaan polos ("halo", "terima kasih", "kamu siapa?") dijawab orang yang diajak atau diikuti; Sora hanya bila tidak ada penerima.
- **Sora netral:** persona "penghubung dan asisten koordinasi", bukan tokoh utama; aturan baru melarang pembuka kaku "Halo, saya X, siap membantu kamu" (perkenalan hanya bila ditanya/relevan, sesuai nama dan peran sendiri); jawaban "kamu siapa?" Sora tidak lagi menyebut diri "teman ngobrol".
- **Komposer** (`komposer-core.js`): `setFokus(id)`; label "Ke: Reno" (sumber `fokus`), chip mengalahkan fokus (sumber `chip`), berubah otomatis saat fokus berganti. Telegram/Discord dan dock lewat `turn` yang sama (tanpa fokus, tetap mengenali nama).
- Tes: `test/penerima-chat.test.js` (8 tes, termasuk kasus Owner dengan dan tanpa fokus, fokus berganti, salah eja, ambigu, SSE, Telegram).
- Belum: nama pada kalimat panjang tanpa sapaan (mis. "menurut saya sebaiknya reno saja yang mengerjakan") bergantung pada kata isyarat; "Aku Sora" tersisa hanya di teks bantuan kecil (Pengaturan, Tim Saya, pencarian "Tanya Sora") dan belum dinetralkan.

## @mention, peran Sora dan aray, jawab dulu, dan satu UI pesan (2026-11-19)
- **@mention:** klik, Enter, atau Tab pada saran "@" membuang teks "@kata", menjadikan orangnya chip penerima eksplisit ("Reno ×"), dan komposer menampilkan "Ke: Reno". Panah atas/bawah menyorot saran (melingkar), Escape menutup. Logika murni di `komposer-core.js` (`cariMention`, `buangMention`, `geserPilihan`, `tambahPenerima`); `targetKeServer` kini `{tujuan, agen, eksplisit}`. Penerima eksplisit (`conv.eksplisit` atau `goal` bukan auto) mengalahkan nama, fokus 3D, dan topik; banyak chip tidak memaksa rapat tiap pesan. Router mengenali awalan "@" dan "kmu/km" (nama pendek seperti "@reno hai" sebelumnya jatuh ke Sora).
- **Peran Sora dan aray**: spesifikasi di `docs/PERILAKU-OBROLAN.md` bagian 9. Sora = penghubung dan penulis **notulensi** (kartu: kesimpulan, keputusan, tugas lanjutan; Simpan ke Catatan atau "Jadikan tugas" yang berhenti di konfirmasi); aray = koordinator lintas divisi, hadir lewat `@aray` atau tombol "Minta aray mengoordinasi": usulan kerja dengan kartu konfirmasi, atau ringkasan dari fakta nyata (`faktaAray`). aray muncul di Pesan sebagai kontak "Koordinator lintas divisi"; "aray" dikenali apa pun nama tampilan di data. Sora dan aray tidak menyela percakapan orang lain.
- **Jawab dulu** (`PERILAKU-OBROLAN.md` bagian 10): pertanyaan tentang diri ("kamu ahli apa", salah ketik "algi") dijawab langsung dari profil; menu kaku ditolak dan dijawab ulang; karangan angka (termasuk "5 tahun", "08:00") diganti pengakuan "belum ada di profilku"; angka perumpamaan ("misalnya ...") tidak dihitung sebagai klaim.
- **Satu UI pesan:** ChatView lama (admin) dihapus dari `views.js`; `#chat` dan `#admin-chat` dialihkan ke `#pesan`; kartu di Konsol "Alat lama" hanya tautan. Halaman Pesan memuat bagian yang dulu hanya ada di obrolan lama: filter **Ruang** (ruang divisi, pekerjaan dan grup) dan **Rapat**, dengan nama ramah ("general" jadi "Umum", "daily-standup" jadi "Rapat harian"), kode dan teks teknis dibuang (`bersihkan`), tombol dengarkan per pesan, dan kirim pesan ke ruang biasa lewat jalur pesan yang sudah ada. Percakapan pribadi, divisi, dan grup memakai mesin baru dan riwayat yang sama dengan Obrolan. Catatan keputusan: ChatView TIDAK dijadikan dasar komponen karena terikat mesin pesan lama (kanal/pesan antar pembantu); fiturnya yang dipindahkan ke komponen Pesan.
- **Belum dari ChatView lama:** perintah `/goal /tugas /rapat /cari /status` dan siaran `@all`/`@kepala` (tidak dipindahkan; `@all` memang seharusnya hanya pemilik), pembuatan rapat dari chat, "Chat baru" ke sembarang orang (pengganti: kontak di Pesan), pengelompokan terlipat dengan hitungan per kelompok (diganti filter), ruang divisi hanya terbaca/tertulis lewat jalur lama tanpa balasan model baru, rapat hanya dibaca.
- Tes: `test/peran-aray.test.js` (9 tes), `test/pesan-kontak.test.js` (11), `test/penerima-chat.test.js` (8). Evaluasi nyata: `docs/uji-nyata/persona-baru-*.json` dan `obrolan-*.json` (44 percakapan, 11 kasus persona).

## aray = kembaran digital, pintu bawaan; Sora bukan pembicara (2026-11-20)
Spesifikasi lengkap, diagram alur, model laporan, dan contoh percakapan: [PERILAKU-OBROLAN.md](PERILAKU-OBROLAN.md) bagian 9. Ringkas perubahan kode:
- `pemandu.paOf` mengembalikan aray (master); id Sora di data tidak diubah. Pembicara utama, moderator rapat, penulis dokumen dan notulensi, kartu konfirmasi, dan jawaban "kamu siapa" semuanya aray.
- `chat-engine.turnInti`: tanpa target eksplisit, tanpa nama, tanpa fokus, pesan menuju aray; bila topik jelas milik seseorang aray berkata "Saya minta <nama>." (`plan.delegasi`, tanpa model) lalu orangnya menjawab; selain itu aray menjawab sendiri. `@aray`: ringkasan (fakta nyata), koordinasi (usulan lewat konfirmasi), atau jawaban biasa.
- `PERSONA_ARAY` satu sumber di `otak/perilaku-obrolan.js` (dipakai chat-engine dan pemandu). Label komposer "Ke: aray" (bukan "Ke: Sora (otomatis)"); pilihan klarifikasi "aray saja" (`pilih:aray`; `pilih:sora` lama masih dikenali).
- Laporan: `GET /api/chat/laporan`, `POST /api/chat/laporan/:id/baca`; tab Laporan di Pesan > aray.
- Teks layar: semua "Sora" di layar pengguna diganti "aray" (app, awam, tim-view, pengaturan-view, hasil-view, views).
- Tes: `test/aray-kembaran.test.js` (7 tes: pintu bawaan aray, delegasi satu kalimat, bicara langsung tanpa menyela, konfirmasi untuk kerja nyata, laporan, tanpa "Sora" sebagai pembicara/kontak/teks layar, data Sora utuh). Tes lama diperbarui: pembicara utama kini `aria`, topik = [aria, orang], label komposer.
