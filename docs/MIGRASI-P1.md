# Migrasi P1 (data dan struktur karyawan)

Fase P1 dari `docs/arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md`. Semua perubahan hanya **menambah** atau menyeragamkan; tidak ada id, agen, divisi, catatan, atau tugas yang dihapus. Versi data naik dari 11 ke **12**.

## 1. Apa yang berubah

| Hal | Sebelum | Sesudah |
|---|---|---|
| Jalur migrasi | Hanya `load()` (ruang kerja utama) yang memigrasi; `loadWorkspaces()` tidak | Satu fungsi `migrate(db)` di `server/store.js`, dipakai `load()` **dan** `loadWorkspaces()`. Idempoten. |
| Versi | seed v8, `starterDb` v10, migrasi v11 | Satu sumber: `SCHEMA_VERSION = 12` di `server/org-rules.js`; seed, `starterDb`, dan `migrate` memakainya |
| Peran | tiga bendera tak eksklusif | medan tunggal `role`: `owner`, `pa`, `master`, `manager`, `staff`, `extra`. `isLead`/`isMaster`/`isPA` tetap ada (turunan) |
| Kunci | tidak ada | `staffId` (kunci katalog, mis. `exec-dewi`; `null` untuk yang belum ada), `workflowId` (`null` sampai dipasang), `characterId` (= id, tidak pernah diganti) |
| Agen lama | tidak dibedakan | `legacy: true` untuk agen AI yang tidak ada di roster seed dan tidak di katalog (di data Owner: 42). `role` mereka `extra`. |
| Suara | `voiceGender` terisi saat dimuat | terisi dan **tersimpan** untuk semua agen AI (seed, ruang kerja baru, hire, migrasi) |
| Manajer | `PATCH isLead` dan `hire` tidak menurunkan manajer lama; Executive punya dua pemimpin | tepat satu pemimpin per divisi, ditegakkan di API (lihat bagian 3) |
| Master | melapor ke PA (`pa-owner`) | master dan PA setara, keduanya melapor ke owner |
| Ruang kerja baru | 6 divisi inti | 22 divisi, satu manajer tiap divisi (lihat bagian 4) |
| Batas | 160 karyawan AI, 28 divisi | 400 karyawan AI (`settings.maxEmployees` masih bisa menimpa), 40 divisi |

Modul baru: `server/org-rules.js` (aturan murni: peran, satu manajer, kontrak data, indeks katalog), `server/staff/status-map.js` (status workflow ke lima nilai 3D). Berkas lain yang disentuh: `server/store.js`, `server/org.js`, `server/seed.js`, `server/workspace.js`, dan dua titik kecil di `server/index.js` (daftar medan + `PATCH /api/employees/:id`).

### Keputusan untuk Executive
- **Owner (manusia) bukan manajer**: `isLead:false`, `role:'owner'`, tidak pernah menjadi `leadId`.
- **PA** dan **master** bukan `manager` (`role` `pa` / `master`). Master (`aria`) tetap **pemimpin divisi Executive lewat `leadId`** (dan `isLead:true`), jadi kode mesin yang membaca `leadId`/`isLead` tidak berubah perilaku. Divisi Executive punya tepat satu pemimpin AI: aria.
- Manusia baru yang direkrut ke Executive tidak otomatis menjadi manajer (dulu menjadi manajer bila divisinya kosong).

### Dampak `reportsTo` master (sudah diukur)
Yang membaca `reportsTo`: `engine.js:272` (calon rekan konsultasi: hanya AI, jadi owner manusia tidak masuk daftar; PA tetap terjangkau karena satu divisi), `engine.js:1021` (teks "Review oleh <atasan>": kini menyebut owner), `collab.js:411` (nama atasan di pelatihan: owner), `index.js` hapus karyawan (tugas dialihkan ke `reportsTo` kecuali `owner`, lalu `aria`), halaman Tim `views.js:1109` (hirarki: owner kini punya dua bawahan langsung, PA dan master). Tidak ada kode yang menyimpulkan "master di bawah PA" dari `reportsTo`.

## 2. Cadangan dan pemulihan

Sebelum migrasi menulis apa pun (hanya bila versi berkas < 12):
1. **Cadangan penuh P0** sekali per proses: `data/backups/<cap-waktu>-pra-migrasi-v12/` (skrip yang sama dengan `npm run data:backup`, lengkap dengan `manifest.json` dan hash).
2. **Salinan berkas yang akan diubah**: `db.json.bak-v<versi-lama>-<cap-waktu>` di samping `db.json` (juga `data/ws/<id>/db.json.bak-v…`).

Bila pencadangan gagal, migrasi tidak jalan. Bila migrasi sendiri gagal (galat), `db.json` **tidak** dibuat ulang: server berhenti dengan galat dan berkas asli tetap. (Hanya berkas yang tidak bisa dibaca sebagai JSON yang disalin ke `.corrupt-<waktu>`, perilaku lama.)

Memulihkan: hentikan server, lalu
```bash
npm run data:restore -- data/backups/<folder-cadangan> --confirm
```
atau salin manual `db.json.bak-v11-…` menimpa `db.json`. Menjalankan ulang server memigrasi lagi dengan aman.

## 3. Aturan satu manajer per divisi

Ditegakkan oleh `enforceOneManager` (`server/org-rules.js`) dan dipanggil dari semua jalur tulis:
- `PATCH /api/employees/:id` dengan `isLead:true` atau `role:'manager'` menjadikannya manajer dan menurunkan manajer lama di divisi yang sama (jadi `staff`, melapor ke manajer baru; staf yang melapor ke manajer lama pindah ke manajer baru). `isLead:false` / `role:'staff'|'extra'` melepas jabatan (divisi sementara tanpa manajer, tidak pernah dua).
- `POST /api/employees` (`hire`) dengan `isLead:true` / `role:'manager'` idem; tanpa itu manajer tidak berubah. Divisi tanpa manajer memberi jabatan itu ke AI pertama yang direkrut.
- Ditolak dengan **400**: PA atau manusia dijadikan manajer, master dijadikan manajer di luar Executive, `role` selain `manager|staff|extra`. Tidak ada yang berubah saat ditolak.
- Mengubah `divisionId` seorang manajer atau menghapusnya tidak meninggalkan `leadId` yang menggantung.
- `id`, `characterId`, `staffId`, `workflowId` tidak bisa diubah lewat API (tidak ada di daftar medan).

## 4. Ruang kerja baru

`starterDb()` kini berisi **22 divisi**, tiap divisi satu manajer (aria memimpin Executive), ditambah owner dan PA: 24 karyawan, 22 saluran divisi. Hemat: tanpa tugas, jadwal, atau catatan demo. Tidak ada staf daun selama bendera mati, sehingga isi ruang kerja baru tetap kecil.

`starterDb({ staffModel: true })` menambahkan **hanya** staf yang terwakili katalog (`server/staff-catalog/`) dan menyalakan `settings.staffModel`. Bendera tetap dinyalakan per ruang kerja lewat `PATCH /api/settings` (P0); selama mati perilaku lama dipertahankan.

## 5. Kontrak data minimum untuk 3D

Dijaga `stampEmployee` (tiap `upsert` karyawan dan tiap migrasi) dan diperiksa `contractProblems(db)`: `id` stabil, `divisionId` ada di `divisions`, `isLead` boolean, `status` salah satu dari `working|meeting|chatting|idle|offline`, `statusText`, `currentTaskId` (boleh `null`), `voiceGender`, `role`, `characterId = id`.

Pemetaan status workflow → lima nilai ada di `server/staff/status-map.js` (`mapStatus`): `jalan`/`running`/`new` → `working`; `menunggu`/`waiting` → `working`; `butuh_izin` → `chatting`; hasil akhir (`selesai`, `gagal`, `success`, `error`, …) → `idle`; apa pun yang tidak dikenal → `idle`. Menyambungkannya ke `setStatus` adalah tugas P2 (`staff.run`).

## 6. Bendera dan perilaku saat mati

`settings.staffModel` (P0) tetap default mati. P1 tidak mengubah jalur eksekusi: yang berubah hanya bentuk data (medan tambahan, satu manajer, master di bawah owner). Satu-satunya perubahan perilaku yang tampak tanpa bendera: manajer lama diturunkan saat manajer baru ditetapkan, manusia tidak pernah jadi manajer, dan ruang kerja **baru** berisi 22 divisi.

## 7. Memverifikasi pada data Owner TANPA mengubahnya

Jangan pernah menjalankan migrasi pada `data/` yang sedang dipakai server Owner. Pakai salinan:

```bash
node -e "require('fs').cpSync('data', process.env.TEMP + '/salinan-p1/data', { recursive: true })"
```
lalu jalankan `load()` dan `loadWorkspaces()` dengan `DATA_DIR` menunjuk ke salinan itu (API key AI dikosongkan) dan cetak **hanya hitungan**. Hasil pada salinan data Owner, 2026-11-18:

| Berkas | Sebelum | Sesudah |
|---|---|---|
| `db.json` (utama) | v11, 171 karyawan (170 AI), 22 divisi, 1 divisi dengan dua pemimpin, 0 berperan | **v12**, 171 karyawan (170 AI), 22 divisi, 0 divisi dengan dua pemimpin, 0 divisi tanpa manajer |
| `ws/<1 ruang kerja>/db.json` | v10, 8 karyawan, 6 divisi, 1 divisi dengan dua pemimpin | **v12**, 8 karyawan, 6 divisi, tepat satu pemimpin per divisi |

Rincian peran pada ruang kerja utama sesudah migrasi: owner 1, pa 1, master 1, manager 21, staff 105 (semuanya punya `staffId` katalog), extra 42 (= `legacy: true`, tepat 42 seperti yang diperkirakan audit). `id` hilang: 0; `id` ganda: 0; agen AI tanpa `voiceGender`: 0; masalah kontrak 3D: 0; master melapor ke owner; migrasi dijalankan lagi: hasil identik. Cadangan tercipta di salinan: satu folder `pra-migrasi-v12` dan satu `db.json.bak-v11-…` per berkas.

Sebelum mengizinkan server Owner memakainya: hentikan server, `npm run data:backup -- --label sebelum-p1`, jalankan ulang server (migrasi otomatis dan membuat cadangan sendiri), lalu `npm run check:invariants`.

## 8. Tes

- `test/migrate.test.js`: idempoten, id tidak hilang, `legacy`, dua pemimpin diselesaikan, `load` dan `loadWorkspaces` memigrasi dan mencadangkan (isi cadangan sama dengan berkas lama), migrasi gagal tidak membuat ulang data, satu manajer lewat `org.js`, **lewat HTTP sungguhan** (server uji di port 4521 dengan data sementara), 22 divisi pada ruang kerja baru, status-map tertutup.
- `test/invariants.test.js`: INV2b, 2c, 2d, 3b, 4b, 5b, 5c, 9a, 9b, 9c kini hijau dan permanen (tanda `todo`/pengetahuan dibuang). Tetap `todo`: INV4b2 (workflowId, P5), INV4c (katalog lengkap, P5), INV6a, INV10, INV11b (P2), INV12 (P4), INV13 (P3).
- Belum diuji: pemulihan nyata dari cadangan pada data Owner (sengaja tidak disentuh); perilaku antarmuka (halaman Tim) setelah master pindah ke bawah owner; perilaku mesin LLM sungguhan setelah migrasi (tanpa API key).
