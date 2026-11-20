# Arsitektur Staf = Workflow n8n = Karakter 3D

Status: fondasi berjalan ujung ke ujung sejak 2026-11-18. Kode: `server/staff/`. Katalog: `server/staff-catalog/`. Tes: `test/staff.test.js`.
Pembaca: sesi-sesi yang mengisi katalog staf, sesi yang menyambungkan layar depan (Pemandu, halaman Tim), dan Owner.

## 1. Hierarki dan arti "staf"

```
Owner (atau pengguna lain sebagai owner ruang kerjanya)
 ├─ Asisten pribadi (Sora)  ← satu-satunya yang diajak bicara pengguna lewat Pemandu
 └─ Master orkestrator (Aria)
     └─ Manajer divisi (21 orang, satu per divisi)  ← ORKESTRATOR khusus divisinya
         └─ Staf (105 karakter AI)  ← setiap staf = satu alur n8n + satu karakter 3D
```

- **Staf** adalah satu berkas spesifikasi JSON (`server/staff-catalog/<divisi>/<kunci>.json`). Spesifikasi dikompilasi menjadi **satu alur n8n** yang benar-benar mengerjakan sesuatu (menghitung, membuat berkas CSV/Markdown, membuka halaman web, mencatat data) dan ditampilkan sebagai **karakter 3D** yang sudah ada (`employeeId`). Saat alur berjalan, karakter itu berstatus `working` lewat `setStatus()`; geometri, kamera, dan animasi 3D tidak disentuh.
- **Satu karakter boleh punya beberapa staf** (kunci `<divisi>-<karyawan>-<topik>`): karakter yang sama muncul bekerja, apa pun alurnya. Aturan awalnya: setiap karakter punya satu staf utama (`<divisi>-<karyawan>`); staf tambahan untuk pekerjaan spesifik dianjurkan ("buat sebanyak mungkin").
- **Manajer divisi** tidak punya alur sendiri; ia memakai satu tool `staf` untuk memilih staf yang tepat di divisinya, memecah goal menjadi beberapa panggilan, menggabungkan hasil, lalu melapor lewat `complete_task` seperti biasa.
- Pengguna awam hanya melihat "staf", "tugas", "berkas". Kata workflow, node, n8n tidak pernah keluar (kamus `server/kamus.js` dan `scrub()`).

## 2. Alur permintaan

```
Pengguna ──(Pemandu: tombol pilihan)──► Asisten pribadi ──► Master ──► Manajer divisi
                                                                          │ tool staf: daftar → lihat → jalankan / jalankan_banyak
                                                                          ▼
                                   runner.run(): validasi isian → izin → kuota → pasang malas → panggil alur
                                                                          │ POST /webhook/rv-staf-<kunci>-<token>   (n8n)
                                              ┌───────────────────────────┴──────────────────────────────┐
                                              │ n8n: Terima → Masukan → Cek masukan → langkah-langkah → Hasil │
                                              └───────────────────────────┬──────────────────────────────┘
                              (bila ada langkah AI: alur berhenti di "Minta AI" → server RAIVERSE memanggil model
                               lewat llm.js/governor → memanggil alur lagi dengan fase "selesaikan")
                                                                          ▼
                    hasil {ringkas, teks, berkas[], data} → data/staff-out/<ruang>/<jalan>/ + catatan jalan + Brain
                                                                          ▼
                              manajer menggabungkan ─► master ─► asisten pribadi ─► Pemandu (kartu hasil, berkas)
```

Karakter staf: `setStatus(e,'working','Mengerjakan: <nama staf>')` saat mulai, kembali `idle` (atau `working` bila sedang mengerjakan tugas lain) saat selesai/gagal. Peristiwa `staff_run`/`staff_done`/`staff_failed` tercatat di umpan kejadian.

## 3. Kontrak staf

### 3.1 Masukan (spec `inputs`)
Daftar bidang formulir: `{ key, type, label, required, default?, choices?, contoh? }`.
Jenis: `text`, `longtext`, `number`, `choice` (**tombol pilihan untuk Pemandu**, 2–8 pilihan `{v,t}`), `date` (YYYY-MM-DD), `url` (diperiksa `browser.checkUrl`: tanpa alamat lokal/privat), `email`.
`runner` menormalkan semua isian (angka gaya Indonesia "1.500.000" dibaca benar, kunci asing dibuang, kontrol karakter dibuang) **sebelum** dikirim. Isian pengguna hanya masuk ke alur sebagai **data** di `body.input`; tidak pernah dirangkai menjadi ekspresi atau kode.

### 3.2 Keluaran (selalu berbentuk sama)
```json
{ "tahap": "selesai", "ok": true, "runId": "run-…", "staf": "fin-ratna",
  "ringkas": "≤300 huruf, satu kalimat hasil",
  "teks": "Markdown ≤30 KB untuk dibaca langsung",
  "berkas": [ { "nama": "faktur-INV-1.csv", "jenis": "csv|md|txt|json|html", "isi": "≤300 KB" } ],
  "data": { } }
```
Alur yang gagal validasi mengembalikan `{ "tahap": "galat", "pesan": "Isian belum lengkap: …" }`. Batas runner: 6 berkas, total 600 KB, `data` ≤ 20 KB. Berkas disimpan di `data/staff-out/<ruang kerja>/<id jalan>/` dengan nama dibersihkan; sel CSV yang diawali `= + - @` dinetralkan (anti injeksi rumus).
Jenis keluaran lain yang disiapkan skema: baris tabel data (`simpan_baris`), baris Google Sheets (`tulis_sheets`, butuh akun Google), catatan ke Brain (otomatis, `brain.simpan`).

### 3.3 Spesifikasi (ringkas; rincian dan contoh di `server/staff-catalog/README.md`)
`key, division, employeeId, title, name, ringkas, kataKunci, version, inputs, steps, output, schedule, risk, confirm, brain, sample` (+ `status: "todo"|"siap"`).
- `steps`: daftar langkah dari **pustaka potongan** (`server/staff/fragments.js`): `hitung` (rumus/susun data), `ambil_web` (baca halaman publik), `simpan_baris` (tabel data gratis), `tulis_sheets` (Google Sheets lewat konektor), `minta_ai` (model bahasa lewat gerbang server).
- `risk` low/medium/high dan `confirm`: staf yang berdampak ke luar wajib `confirm:true` → runner menahan jalan di status `butuh_izin` sampai Owner menyetujui.
- `schedule`: `{allowed, cron?, keterangan?}` adalah metadata; eksekusi terjadwal belum diaktifkan (lihat bagian 10).
- `sample`: `{input, expect, ai?, web?}`; dipakai sebagai uji lokal, uji pemasangan, dan teladan.
- **Rintisan** = `status:"todo"` dengan identitas + `konteks` (tugas peran, keahlian, contoh tugas dari roster). Validator mengenalinya sebagai `stub`; runner menolak menjalankannya.

## 4. Siklus hidup

`spesifikasi → validasi → kompilasi → pasang (tidak aktif) → uji dengan data contoh → aktifkan → jalan → hasil → catat ke Brain`

1. **Validasi** (`schema.js`, `scripts/staff-validate.mjs`): skema, kunci unik, nama berkas = kunci, karyawan ada di roster, tanpa istilah teknis di teks pengguna, tanpa pola rahasia, ekspresi tanpa `$env`/`process`/`require`/`while`/`for`/`$()`, simpul hasil kompilasi hanya dari daftar putih (Execute Command, berkas, SSH, Code, Execute Workflow dilarang), **uji lokal sample di kotak pasir** (`simulate.js`).
2. **Kompilasi** (`blueprint.js`): kerangka standar `Terima permintaan (webhook bertoken) → Masukan → Cek masukan → langkah-langkah → Hasil`; bila ada `minta_ai`, alur dipecah dua fase.
3. **Pasang** (`deployer.js`): **malas** (saat pertama dipakai), **idempoten** (hash spesifikasi + versi pembangun; sama = tidak dipasang ulang; beda = diperbarui di tempat, id sama), kunci per staf agar panggilan serentak memasang sekali, nama `[RAIVERSE][staf] <kunci> v<versi>` (+ `[ruang]` untuk salinan per ruang kerja). Dibuat **tidak aktif**, lalu **diuji dengan salinan sementara** (simpul berefek keluar diganti pencatat, dipicu data contoh, salinan selalu dihapus), baru diaktifkan. Uji gagal → alur dihapus, percobaan ulang ditahan 60 detik, pesan awam.
4. **Jalan** (`runner.js`): batas waktu 60 dtk, kuota 40 jalan/jam/ruang kerja, 3 serentak, status karakter, galat dibersihkan (`scrub`) menjadi bahasa awam.
5. **Hasil**: berkas + catatan jalan (`data/staff-runs.json`, 200 terakhir per ruang kerja) + catatan Brain `"<nama staf> — <waktu> (<id>)"` di folder `"<Divisi>/<Jenis>"`.
6. **Lepas pasang**: `deployer.retireIdle({days:30})` menghapus staf yang lama tidak dipakai; `scripts/staff-cleanup.mjs` membersihkan semua alur berawalan `[RAIVERSE][staf] `.

## 5. Keputusan skala publik (dan alasannya)

**Pilihan: satu alur per TEMPLAT staf, dipakai bersama semua ruang kerja, diparameterisasi lewat payload, dipasang malas; salinan per ruang kerja hanya untuk staf yang butuh akun luar milik pengguna.**

| Pola | Jumlah alur | Kesimpulan |
|---|---|---|
| 105 staf × setiap pengguna | 105 × N (N=1.000 → 105.000) | **Ditolak.** n8n melambat (pendaftaran webhook saat boot, daftar editor), tiap pembaruan versi harus disebar ke ribuan alur, biaya operasi tak terkendali. |
| Satu alur raksasa untuk semua staf | 1 | Ditolak: tak bisa diuji/dibatasi per staf, satu galat memadamkan semua, tak sesuai "staf = karakter". |
| **Satu alur per templat, bersama** | ≤ jumlah staf (kini 105 jika semua dipakai; **praktis 10–40 aktif** karena malas) | **Dipilih.** Tidak tergantung jumlah pengguna. Pembaruan satu kali. Terpisahnya data pengguna dijaga oleh payload (`ws`, `user`, `runId`) + kolom `tenant`. |
| Salinan per ruang kerja untuk staf berakun luar | (jumlah staf berakun) × (pengguna yang memakainya) | Dipakai **hanya** untuk `tulis_sheets` (kredensial Google per ruang kerja `RAIVERSE Google <ruang>`). Dibatasi karena malas + lepas pasang 30 hari idle. |

Alasan tambahan: ukuran satu alur rata-rata 8,8 KB (7–11 KB), 7,3 simpul → 105 alur penuh ≈ 0,9 MB JSON; sedangkan pola per pengguna tak punya batas atas.

**Langkah AI lewat gerbang di server RAIVERSE, bukan di n8n.** n8n tidak memegang kunci AI. Karena aplikasi ini belum punya alamat publik (n8n Owner di server lain tidak bisa memanggil `127.0.0.1`), dipilih pola **dua ketukan** yang tidak butuh alamat publik: alur berhenti di langkah "Minta AI" dan mengembalikan `{tahap:"minta_ai", llm:{system,prompt,maxTokens}, state}`; **server RAIVERSE** memanggil model lewat `llm.js` (anggaran harian, model, pencatatan biaya, `taskId`), lalu memanggil alur yang sama dengan `phase:"selesaikan"` membawa `state` dan `llmText`. Hasilnya: tidak ada kunci AI di n8n, biaya/batas/model tetap dikendalikan governor, satu panggilan AI paling banyak per jalan (≤3000 token keluaran). Jika AI belum tersambung atau anggaran habis, `v.ai` kosong dan spesifikasi memakai teks cadangan (staf tetap berguna).
*Jalur lanjutan* bila `RAIVERSE_PUBLIC_URL` tersedia: rute internal bertoken per eksekusi agar alur memanggil gerbang sendiri tanpa berhenti; belum dibangun karena dua ketukan sudah memenuhi syarat dan lebih sederhana.

**Hasil kembali ke RAIVERSE:** (a) jawaban sinkron dari webhook (`responseMode: lastNode`), cukup untuk pekerjaan ≤60 detik; (b) bila terlalu lama, jalan berstatus `menunggu` dan `runner.settle()` mengambil hasilnya lewat pengambilan berkala eksekusi (pola yang sama dengan `pollOnce` di `server/n8n.js`). **Tanpa panggilan balik, tanpa alamat publik.** Karena privasi, eksekusi sukses tidak menyimpan isinya di n8n (`saveDataSuccessExecution: none`), jadi jalan yang kehabisan waktu dilaporkan "selesai tetapi hasil tidak tersimpan, ulangi" (lihat bagian 10).

## 6. Keamanan

- **Rahasia**: kunci n8n hanya di `process.env`; tidak masuk spesifikasi (validator menolak pola rahasia), alur, registri, catatan jalan, berkas hasil, atau log (tes memindai). Kunci AI hanya di server RAIVERSE.
- **Kapabilitas webhook**: alamat masuk memuat token acak 96-bit per staf (`rv-staf-<kunci>-<token>`), hanya diketahui server RAIVERSE dan n8n. Tidak ada alamat bersama.
- **Kepemilikan**: hanya alur berawalan `[RAIVERSE][staf] ` yang tercatat di registri `data/staff-deploy.json` yang boleh diubah atau dihapus; nama dicek ulang sebelum setiap operasi. 30 alur Owner dan otomasi `[RAIVERSE] [main]` tidak disentuh.
- **Kode**: tanpa simpul Code; semua logika berupa ekspresi murni dengan pembantu tetap (`expr.js`). Ekspresi dilarang memakai `$env`, `$vars`, `$()`, `process`, `require`, `import`, `this`, `constructor`, `while`, `for`, `Array(`, `.repeat(`, dan sejenisnya. Batas waktu eksekusi 90 dtk.
- **Isi dari luar adalah data**: teks pengguna dan isi halaman web tidak pernah dieksekusi; sistem prompt langkah AI menyatakan hal itu; keluaran AI hanya menjadi teks.
- **Jaringan**: `ambil_web` hanya GET (tanpa akun), alamat diperiksa `browser.checkUrl` sebelum dikirim.
- **Isolasi ruang kerja**: catatan jalan, berkas hasil, dan rute selalu per `store.current()`; ruang kerja lain mendapat "tidak ditemukan"; baris tabel data diberi `tenant`.
- **Privasi**: isian tidak disimpan di riwayat n8n untuk eksekusi sukses; galat disimpan dan dipangkas oleh n8n.
- **Izin**: staf `confirm:true` tidak jalan tanpa persetujuan Owner (`butuh_izin` → `POST /api/staff/runs/:id/izin`); semua rute `/api/staff` hanya untuk Owner/Admin ruang kerja (`ownerOnly`).

## 7. Biaya

- n8n: swakelola, biaya hanya komputasi. Terukur di server Owner: jalan hangat ≈ 0,9 dtk, pemasangan pertama ≈ 2,2 dtk (uji 1,6 dtk di dalamnya); sekali teramati 25 dtk pada panggilan pertama server baru (n8n dingin).
- AI: paling banyak satu panggilan per jalan, ≤3000 token keluaran, memakai `defaultModels().worker`; biaya per jalan dicatat (`run.biaya`) dan ikut anggaran harian/tugas governor. Staf murni hitung tidak memakai AI sama sekali (10 dari 12 teladan); 2 memakai satu langkah AI dengan teks cadangan bila AI tidak tersedia.
- Kuota per ruang kerja (`settings.staf`): `perHour` 40, `concurrent` 3, `timeoutMs` 60000, `maxFiles` 6, `maxFileBytes` 300000, `maxTotalBytes` 600000.

## 8. Antarmuka (minimal) untuk layar depan

Semua di `server/staff/index.js`, dipasang di `server/index.js` (Owner/Admin). Galat berbentuk `{ "error": "kalimat awam" }` dengan kode 400/404/409/429/5xx.

| Rute | Hasil |
|---|---|
| `GET /api/staff` | `{ divisi:[{id,nama,rintisan,lengkap,total}], terpasang, problem }` |
| `GET /api/staff/divisi/:id` | `{ staf:[{kunci,nama,ringkas,jabatan,divisi,karyawan,siap,risiko,perluIzin}] }` |
| `GET /api/staff/:kunci` | ringkasan + `formulir:[{kunci,label,jenis,wajib,pilihan:[{nilai,teks}],contoh,bawaan}]`, `keluaran`, `alat` (bahasa awam), `perluAkun`, `contoh` |
| `POST /api/staff/:kunci/run` `{isian, konfirmasi?}` | tampilan jalan (di bawah). `konfirmasi:true` = pengguna menekan "Ya, jalankan" |
| `GET /api/staff/runs?staf=&limit=` | `{ jalan:[…] }` ruang kerja ini |
| `GET /api/staff/runs/:id` | tampilan jalan; bila `menunggu`, mencoba mengambil hasilnya |
| `GET /api/staff/runs/:id/files/:nama` | `{ nama, jenis, bytes, isi }` (layar depan membuat unduhan dari `isi`) |
| `POST /api/staff/runs/:id/izin` `{setuju}` | menjalankan/menolak jalan `butuh_izin` |

Tampilan jalan: `{ id, status: jalan|selesai|gagal|menunggu|butuh_izin|ditolak, staf:{kunci,nama}, karyawan, ringkas, teks, berkas:[{nama,jenis,bytes}], data, pesan, galat, ms, biaya, mulai, selesai }`.

**Rancangan sambungan Pemandu (dikerjakan sesi berikutnya, belum dibuat):** setelah kebutuhan pengguna jelas, Pemandu memanggil `GET /api/staff/divisi/:id` (atau mencocokkan lewat `kataKunci`) → tombol "Pakai staf …" → pertanyaan satu per satu dari `formulir` (tombol untuk `pilihan`, kolom ketik untuk lainnya) → `POST …/run` → kartu hasil dengan `ringkas`, tombol unduh per berkas, dan "Simpan ke Brain" (sudah otomatis). Kartu baru didaftarkan lewat `registerCard('staf', …)` sesuai `docs/PEMANDU-TITIK-SAMBUNG.md`; tidak perlu mengubah `pemandu.js`.

## 9. Titik sambung ke kode orang lain (minimal)

- `server/engine.js`: import `staff`, satu baris di `runTool` (`staff.isTool`), satu di `buildTools` (`staff.toolDefs`), satu di daftar `promptSection`, dan `staf` ditambahkan ke regex bukti nyata `realEvidence`. Perilaku lain tidak berubah.
- `server/index.js`: satu import dan satu baris `for (…of staffApi.routes)`.
- `server/n8n.js` hanya **dipakai** (klien REST, `scrub`, `listExecutions`), tidak diubah. `server/pemandu.js`, `catalog.js`, aset 3D tidak disentuh.

**Orkestrator manajer (`manager.js`)**: tool `staf` (aksi `daftar`, `lihat`, `jalankan`, `jalankan_banyak` maks 4 paralel). Cakupan: master → semua divisi; manajer → divisinya; anggota → hanya miliknya. Tool **tidak muncul** bila tidak ada staf siap (tidak membebani model), tidak muncul di tugas rutin/obrolan. Prompt hanya memuat 8 baris staf + "dan N lainnya"; sisanya dimuat bertahap lewat `daftar` dengan kata kunci. Hasil memuat id jalan dan nama berkas untuk `evidence` di `complete_task`.

## 10. Yang belum dikerjakan / belum terbukti (jujur)

- **Jadwal**: spesifikasi punya `schedule` (metadata) dan dua teladan menyatakan Senin pagi, tetapi pemicu terjadwal belum dikompilasi/diaktifkan. Rencana: pengambilan berkala eksekusi seperti `pollOnce`.
- **`tulis_sheets` (Google)**: dikompilasi, divalidasi, dan diuji dengan n8n tiruan (pencatat), **belum** dijalankan nyata ke Google (tidak ada konektor aman yang dipakai dalam uji ini).
- **`settle()`** (jalan yang kehabisan waktu): kodenya ada, tidak diuji dengan eksekusi nyata; dengan privasi `none` hasil tidak bisa dipulihkan.
- **Gerbang langsung** (alur memanggil RAIVERSE tanpa berhenti) belum dibangun; dua ketukan dipakai. Langkah AI diuji dengan model tiruan (jalur Claude) dan di n8n nyata dengan teks contoh; **bukan** dengan Groq/Claude sungguhan (tanpa panggilan berbayar).
- **Tabel data `raiverse_staf`** dibuat sekali di n8n Owner saat staf `simpan_baris` pertama dipakai; pembacaan balik oleh pengguna belum ada rutenya; API publik tidak bisa menghapus baris (tabel dibuang utuh saat uji).
- **Layar depan** (Pemandu, halaman Tim, unduhan berkas) belum disambungkan; hanya kontrak API di atas.
- Hanya satu `employeeId` per rintisan di generator; staf tambahan ditulis manual.
- Pengujian bersama (beberapa pengguna menjalankan staf yang sama serentak di n8n nyata) belum dilakukan; ada tes pemasangan serentak dengan n8n tiruan.

## 11. Angka (diukur 2026-11-18)

- Roster: 105 staf AI non-manajer, 21 manajer divisi (+ master + asisten pribadi), 22 divisi.
- Katalog: **105 berkas staf** (93 rintisan + 12 lengkap) dan 22 `_divisi.json`.
  Per divisi (lengkap/total): mkt 4/13, fin 4/4, cs 4/5; lainnya 0 dari: bizdev 4, data 4, design 5, ecom 6, eng 7, exec 2, hr 4, it 3, kms 6, legal 3, mfg 5, ops 3, qa 4, reg 3, retail 4, rnd 5, sales 6, scm 4, studio 5.
- Kompilasi: 0,2–0,3 ms per staf; 6–9 simpul (rata-rata 7,3); 7,2–10,9 KB JSON (rata-rata 8,8 KB).
- n8n Owner nyata: pasang + uji + aktifkan rata-rata 2,2 dtk (uji 1,6 dtk); jalan hangat ≈ 0,9 dtk lewat server RAIVERSE; ukuran jawaban contoh 0,4–1,7 KB (diukur lewat uji lokal dengan sample yang sama). 12 dari 12 teladan lolos uji dan berjalan; alur Owner tetap 32 sebelum dan sesudah; tabel dan alur uji dibersihkan.
- Tes: `test/staff.test.js` 20 tes (katalog, validator, kompilasi, kotak pasir, pemasangan, pelari, AI, izin, kuota, manajer, rute, keamanan).
