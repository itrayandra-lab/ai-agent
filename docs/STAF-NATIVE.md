# Staf berjalan NATIVE (tanpa n8n)

Pertanyaan Owner: "bisa kah tanpa n8n tapi lebih powerful dan full control?" Jawabannya **ya**, dan itu keputusan yang dipakai.
Staf tetap satu karakter 3D = satu spesifikasi (`server/staff-catalog/<divisi>/<kunci>.json`), tetapi yang MENJALANKAN sekarang adalah
mesin di dalam RAIVERSE (`server/staff/native.js`), bukan 221 alur n8n. n8n tetap ada untuk jadwal terus-menerus dan pemicu dari luar.

## Keputusan

| Hal | Sebelum | Sekarang |
|---|---|---|
| Pelaksana staf | alur n8n hasil kompilasi (`blueprint.js`), dipasang malas | penerjemah native di proses RAIVERSE |
| Pemilih mesin | tidak ada | `settings.staffEngine` = `native` (bawaan) atau `n8n`; env `RAIVERSE_STAFF_ENGINE` mengalahkan pengaturan; spesifikasi bertanda `needsN8n: true` selalu lewat n8n |
| Langkah berpikir | `minta_ai` (teks bebas, lewat n8n dua tahap) | ditambah langkah **`otak`** (jawaban AI terstruktur dan diperiksa, ada cadangan aturan) |
| Tabel data | Data Table n8n | `data/staff-table/<ruang kerja>.json` (500 baris terakhir, per ruang kerja) |
| Jatah | eksekusi n8n/hari (governor) | jatah native sendiri per ruang kerja: `usage.staf` (jalan, panggilan AI, token, biaya), batas `settings.staf.nativePerDay` (2000) dan `otakPerDay` (200) |

## Cara kerja

`runner.run` → validasi isian (sama seperti dulu) → izin Owner bila `confirm` (modul persetujuan, tidak berubah) → pilih mesin:

1. **native**: `native.runSpec(spec, { input, hooks })` menjalankan langkah satu per satu. Hasil berbentuk sama dengan simpul "Hasil" n8n
   (`ringkas`, `teks`, `berkas[]`, `data`), lalu jalur lama yang sama: bersihkan → tulis berkas → catatan jalan → ringkasan ke Catatan → `finishTask`-nya tool `staf`.
2. **n8n**: jalur lama utuh (pasang malas, webhook, tahap AI lewat server).

Status 3D: tetap lewat `engine.setStatus` (`working` saat jalan, kembali `idle`/`working` setelah selesai atau gagal), tetap lima nilai.

### Kotak pasir ekspresi (`hitung`, ringkas, teks, berkas)
Penulis spesifikasi menulis satu ekspresi JavaScript; **pengguna hanya memberi data** lewat `input.<kunci>`. Berlapis:
1. `badExpr` menolak `process`, `require`, `import`, `constructor`, `function`, `while/for`, `fetch`, `eval`, `$env`, kurung ganda, dll.
2. `node:vm` di konteks BARU yang kosong (tidak ada objek dari server), pembuatan kode dari teks dimatikan (`eval`/`Function` gagal), strict mode,
   batas waktu 1,5 detik (regex berat ikut dihentikan), `input` dibekukan sampai ke dalam, masukan masuk sebagai JSON (objeknya lahir di dalam kotak pasir),
   keluaran dibatasi 1 MB dan dibulatkan lewat JSON.
3. Langkah yang punya efek keluar tidak jalan di kotak pasir; ia lewat "pengait" (web, tabel, Sheets, AI) yang diperiksa di sisi server.

Batas yang jujur: kotak pasir `vm` menjaga akses, bukan memori; ekspresi yang rakus memori hanya dibatasi waktu dan larangan pola alokasi besar. Spesifikasi
ditulis tim (bukan pengguna) dan lolos validator, jadi ancamannya rendah; jangan mengizinkan pengguna menulis spesifikasi tanpa isolasi proses.

### Langkah OTAK
```json
{ "use": "otak", "simpan": "otak", "sistem": "'...'", "perintah": "'... ' + v.hasilAturan",
  "skema": { "ringkasan": "teks", "nada": "pilihan:positif|campuran|negatif", "saran": "daftar", "skor": "angka" },
  "cadangan": "({ ringkasan: '...' })", "maxToken": 700, "model": "kecil" }
```
Aturan (langkah `hitung`) menghitung angka dan kerangka; AI hanya mengisi dan membahas. Jawaban wajib JSON sesuai `skema`; tiap bidang diperiksa
(teks harus string ≤1500 huruf, angka harus bilangan, daftar ≤8 butir, pilihan harus salah satu). Bidang salah/kosong diganti **cadangan aturan**; bila AI mati,
anggaran habis, jatah habis, atau jawabannya sampah, hasil tetap jadi dan jujur ("ringkasan aturan" vs "ditulis AI, sudah diperiksa"; `pakaiAI`, `catatan` di hasil).
Model kecil (`openai/gpt-oss-20b` di Groq) untuk tugas ringan, `model: "sedang"` untuk yang lebih berat. Satu langkah AI per staf; teks pengguna selalu data, bukan perintah.
Di alur n8n (kompatibel mundur) langkah ini hanya menghitung cadangan aturan (`dariAI:false`).

**Staf percontohan (8)**: `cs-faisal` (rangkum umpan balik), `mkt-nayla` (hook, caption, tagar), `ecom-cindy` (judul dan deskripsi produk),
`data-citra` (bahas angka janggal), `ecom-sarah` (untung rugi), `sales-rafi` (pipeline), `hr-dafa-survei` (survei karyawan), `mkt-bram-diagnosa-iklan` (diagnosa iklan).
Dibuat oleh `scripts/staff-otak-pilot.mjs` (idempoten). Versi tiap spesifikasi naik 1.

### Otak berbasis data untuk SEMUA staf (`otakProfil`)
Perluasan: setiap staf lengkap (216) kini "berpikir", tanpa kode per staf. Spesifikasi punya blok data `otakProfil` (peran, tujuan, gaya, skema keluaran, contoh baik dan buruk,
batas panjang, kriteria lulus, `contohAI`) yang dirakit dari data yang sudah ada (jabatan, ringkasan, kata kunci, divisi) plus tabel gaya per divisi
(`scripts/staff-otak-profil.mjs`, idempoten). 201 staf memakai blok ini; 15 staf lain sudah punya langkah AI sendiri (8 `otak` percontohan + 7 `minta_ai`) dan dilewati.
Cara kerjanya di mesin native: aturan lama jalan dulu dan tetap menjadi kerangka serta pemeriksa (angka, format, batas); lalu mesin merakit permintaan dari blok itu
(ringkasan hasil aturan + isian pengguna yang sudah disamarkan), meminta JSON sesuai skema, memeriksanya, dan **hanya bila sah** menempelkan bagian "Pembahasan (ditulis AI, sudah diperiksa)"
ke teks, menambah berkas `<kunci>-pembahasan.md`, dan mengisi `data.pembahasanAI`. Bila AI mati/anggaran habis/jatah habis/jawaban tidak sah, hasil persis seperti versi aturan (identik dengan n8n).

Kendali biaya dan mutu: model kecil bawaan (`model: "sedang"` hanya bila diminta spesifikasi); maks 600-900 token per panggilan dan satu panggilan per eksekusi;
**cache** 1 jam per ruang kerja untuk masukan identik (tanpa biaya dan tanpa memakai jatah); jawaban tidak sah **diulang sekali** lalu jatuh ke aturan; jatah harian dan biaya per ruang kerja di `usage.staf`;
**privasi**: email, nomor telepon, deret angka panjang disamarkan, dan isian bernama email/telepon/NIK/rekening/alamat/sandi tidak pernah dikirim ke model.

**Evaluasi mutu otomatis** (`server/staff/mutu.js`, `node scripts/staff-mutu.mjs`): tiap staf punya contoh masukan (`sample.input`) dan kriteria lulus (`otakProfil.kriteria`: panjang, kata kunci wajib) plus
struktur (jawaban sesuai skema, bagian dan berkas pembahasan muncul) dan kerangka aturan tetap utuh (`sample.expect`). Hasil dengan **model tiruan**: **216 dari 216 staf lulus**; jawaban dangkal atau ngawur diuji gagal.
Ini memeriksa kerapian alur, bukan kecerdasan model: **tidak ada uji dengan model asli** (kunci AI sengaja kosong; 0 panggilan, Rp 0). Kualitas bahasa model asli belum dinilai.
Catatan jujur: blok `otakProfil` dirakit oleh skrip dari data dan tabel gaya per divisi, bukan ditulis tangan per staf lewat subagen; keberagaman ada di tingkat divisi dan jabatan,
sedangkan spesifikasi tingkat staf (contoh khusus, kriteria khusus) bisa diperkaya satu per satu lewat berkas JSON masing-masing.

**Dunia luar.** Staf tidak mengirim apa pun sendiri. Titik sambung pengiriman: `native.kirimKeluar({ ws, employeeId, teks })` memakai modul saluran (`server/channels`, milik sesi lain; tidak diduplikasi)
dan jujur mengembalikan `terkirim:false` bila belum ada saluran tertaut. Status Telegram/Discord tampil di `GET /api/staff/konektor` apa adanya. Tulis ke Google tetap lewat konfirmasi dan konektor Google; bila belum terisi gagal jujur.

## Keluaran nyata (tanpa n8n)
- Berkas CSV/Markdown/teks/JSON/HTML (siap cetak) di `data/staff-out/<ruang kerja>/<id jalan>/`; jenis dibatasi lima macam, nama dibersihkan, maks 6 berkas, 300 KB per berkas, 600 KB total. PDF sengaja tidak dibuat (tanpa unduhan besar; cetak HTML ke PDF dari peramban).
- `GET /api/staff/files` (daftar, hanya ruang kerja aktif), `GET /api/staff/runs/:id/files/:nama` (unduh; nama harus ada di catatan jalan itu, tanpa path traversal), `GET /api/staff/runs` (Hasil Saya memakai ini; kontrak tidak berubah, hanya ditambah `mesin`, `catatan`, `pakaiAI`).
- Ringkasan masuk Catatan lewat jalur yang ada (`brain.writeNote`).
- Google Sheets: memakai konektor Google yang ada bila terisi; bila tidak, langkahnya gagal jujur "Google belum tersambung". `GET /api/staff/konektor` menyatakan status apa adanya.

## Yang sengaja tetap di n8n
Jadwal terus-menerus dan pemicu dari luar (webhook masuk, pantau halaman berkala). Penandanya `"needsN8n": true` di spesifikasi; staf itu tetap lewat otomasi n8n
(`server/n8n.js`, pasang malas). RAIVERSE berjalan di localhost tanpa alamat publik, jadi n8n tidak bisa memanggil balik; itu alasan tidak semuanya dipindah.
Saat ini **belum ada** spesifikasi yang bertanda `needsN8n` (semua 216 jalan native); penandanya disiapkan untuk kebutuhan berikutnya.
Otomasi `[RAIVERSE]` non-staf (mis. catat Sheets) tidak disentuh.

## Meringankan n8n Owner
- `node scripts/n8n-staf-nonaktifkan.mjs` (kering: hanya hitung) lalu `--jalan` untuk MENONAKTIFKAN (bukan menghapus) alur berawalan `[RAIVERSE][staf] `.
  Daftar id disimpan di `data/n8n-staf-nonaktif.json`; sidik jari alur non-staf dibandingkan sebelum dan sesudah (30 alur Owner dan otomasi lain tidak boleh berubah).
- Dinyalakan lagi: `node scripts/n8n-staf-aktifkan.mjs --jalan`. Kunci n8n dibaca dari `.env`, tidak pernah dicetak.
- Tidak ada yang dihapus. Menghapus 221 alur staf menunggu persetujuan Owner.

## Bukti dan angka
**Ekuivalensi.** `test/staff-native.test.js` menjalankan seluruh 216 spesifikasi lengkap (238 berkas dikurangi 22 manifes divisi) di mesin native dan di alur n8n hasil
kompilasi (emulator `simulate.js`) dengan data contoh masing-masing: 216 dari 216 identik (ringkas, teks, berkas, data). Untuk 8 staf percontohan, mode tanpa AI
identik dengan n8n, dan mode AI diuji terpisah. Bukti tambahan ke **n8n asli milik Owner**: 195 staf hitung-murni dipanggil lewat webhook-nya dan dibandingkan:
195 sama persis, 0 beda (21 dilewati: langkah web/tabel/AI atau versi alur sudah naik).

**Waktu** (`node scripts/bench-staf.mjs fin-ratna`, staf pembuat faktur, data contoh sama):

| | n8n (alur terpasang, via webhook) | native |
|---|---|---|
| satu eksekusi (dingin) | 191 ms | 17,5 ms |
| rata-rata per eksekusi (100 berturut-turut) | 141,6 ms (median 118, p95 297, maks 415) | 1,55 ms (median 1,43, p95 2,7, maks 2,9) |
| 100 eksekusi total | 14,2 detik | 0,155 detik |
| CPU 100 eksekusi | tidak terukur dari luar | 171 ms |
| memori | proses n8n tetap 359 MB selama pengukuran | proses RAIVERSE bertambah 39 MB (termasuk pemuatan modul pertama) |

Kira-kira 90 kali lebih cepat per eksekusi, dan tanpa lalu lintas HTTP, tanpa pemasangan alur, tanpa jatah eksekusi n8n.

**n8n Owner, sebelum dan sesudah** (`scripts/n8n-staf-nonaktifkan.mjs --jalan`, dijalankan setelah tes hijau):

| | sebelum | sesudah |
|---|---|---|
| total alur | 253 | 253 (tidak ada yang dihapus) |
| alur staf `[RAIVERSE][staf]` aktif | 217 dari 221 | **0** dari 221 |
| otomasi `[RAIVERSE]` lain aktif | 2 | 2 (tak tersentuh) |
| alur milik Owner (30) aktif | 13 | 13 (tak tersentuh; sidik jari nama/id/aktif sama) |
| alur aktif seluruhnya | 232 | 15 |

Yang JUJUR soal memori n8n: tidak turun seketika. Pembacaan memori proses n8n sebelum 138 MB (saat tenang) dan sesudah 390 MB, tetap 390 MB selama 1 menit; angka itu mengikuti
pelepasan 217 pendaftaran webhook dan tidak mengecil sendiri karena pengelola memori Node jarang mengembalikan memori ke sistem. Penghematan memori yang nyata baru terlihat
setelah n8n dimulai ulang (belum dilakukan; itu keputusan Owner). Yang sudah pasti: 217 pendaftaran webhook dan penyiapan alur aktif tidak lagi ada.
Kembali ke keadaan semula: `node scripts/n8n-staf-aktifkan.mjs --jalan` (dibaca dari `data/n8n-staf-nonaktif.json`, 217 id; mode kering sudah dicoba).

**Tes.** `node --test --test-concurrency=1 test/*.test.js`: 285 tes, 283 lulus, 0 gagal, 2 ditunda (INV12 dan INV13, milik fase lain). Mascot V4.2: 109 lolos, 0 masalah (sebelum dan sesudah).
`test/regex-guard.test.js` hijau. `npm run check:invariants`: 25 lulus, 0 gagal; INV4b2 dan INV4c diaktifkan (tanda todo dibuang) dengan definisi yang disesuaikan ke arsitektur native
(tiap staf punya spesifikasi siap yang jalan native; katalog JSON tanpa yatim). `npm run check:visual` melaporkan berkas baru `public/js/sambungan-view.js` yang belum ditinjau; itu bukan dari pekerjaan ini (tidak ada perubahan di `public/`).
Tes baru (`staff-native.test.js`, 19 tes): ekuivalensi, mode AI, jawaban AI rusak, kotak pasir (ekspresi jahat dan lapisan vm), skema otak, tanpa AI, AI + biaya + jatah + status 3D,
jatah harian, anggaran habis, tabel per ruang kerja, isolasi berkas, API berkas dan konektor, Google belum tersambung, pemilih mesin, skrip penonaktif/pengaktif terhadap n8n tiruan.

## Belum tersambung / belum diuji
- **WhatsApp** dan **email**: belum tersambung; staf hanya menyiapkan teks, pengguna yang mengirim. Antarmuka hanya boleh menulis "belum tersambung".
- **Google Sheets/Drive**: bergantung pada konektor Google (alamat dan kata kunci di Pengaturan); belum diisi di instalasi ini. Jalur nyata ke Google tidak diuji (hanya penolakan jujur saat belum tersambung).
- **Model AI asli**: diuji dengan model tiruan (jumlah panggilan, model kecil, biaya, jatah). Tidak ada panggilan ke model asli dalam pekerjaan ini.
- **Langkah `ambil_web` dan `tulis_sheets` native**: pembaca halaman diuji lewat pengait, bukan ke internet.
- **Tampilan**: tidak ada perubahan di `public/`. Hasil Saya membaca kontrak yang sama; kolom baru (`mesin`, `catatan`, `pakaiAI`) belum ditampilkan.
- Staf berjadwal (mis. `cs-ayu`, `fin-bowo`) kini dijalankan oleh penjadwal RAIVERSE lewat tool `staf`, bukan oleh jadwal n8n.
