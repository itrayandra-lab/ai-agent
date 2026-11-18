# Pagar sinkronisasi (Fase P0)

Tiga pengaman sebelum arsitektur "staf = workflow n8n" dikerjakan: cadangan data yang bisa dipulihkan, bendera fitur, dan tes invarian yang memperlihatkan apa yang belum sinkron. Rencana lengkap: `docs/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md`.

## 1. Cadangan

```bash
npm run data:backup -- --label sebelum-p1
```

Menyalin `data/db.json`, semua `data/ws/*/db.json`, serta `auth.json` dan `otomasi.json` (bila ada) ke `data/backups/<cap-waktu>-<label>/` bersama `manifest.json` (ukuran, hash sha256, jumlah karyawan dan divisi per ruang kerja). Layar hanya menampilkan hitungan dan potongan hash, tidak pernah isi data atau rahasia. Folder `data/` tidak di-commit.

Hentikan server dulu bila bisa: berkas yang berubah saat disalin akan terdeteksi (hash salinan harus sama dengan aslinya) dan cadangan dibatalkan.

Pilihan: `--data <folder>` untuk folder data lain (mis. salinan uji).

## 2. Pemulihan

```bash
npm run data:restore -- data/backups/<folder-cadangan>            # hanya memeriksa, tidak menimpa
npm run data:restore -- data/backups/<folder-cadangan> --confirm  # benar-benar memulihkan
```

- Tanpa `--confirm` tidak ada yang ditimpa (keluar dengan kode 3).
- Cadangan diperiksa dulu (manifes, ukuran, hash). Cadangan yang berubah atau rusak ditolak.
- Sebelum menimpa, keadaan sekarang dicadangkan otomatis dengan label `pra-pulih`, jadi pemulihan sendiri bisa dibatalkan.
- Setelah menyalin, hash tiap berkas diverifikasi ulang.
- **Hentikan server sebelum memulihkan.** Server yang berjalan menulis ulang `db.json` dari memorinya dan akan menimpa hasil pulih.

## 3. Bendera `settings.staffModel`

Medan pengaturan ruang kerja, default `false` (seed, ruang kerja baru, dan data lama yang dimuat). Saat mati, perilaku tidak berubah sama sekali: belum ada kode yang membacanya selain fungsi bantu.

- Fungsi bantu: `staffModelOn()` di `server/store.js` (ruang kerja aktif) atau `staffModelOn(wsId)`. Hanya boolean `true` yang menyalakan; teks `"true"` atau medan hilang dianggap mati.
- Menyalakan per ruang kerja (hanya Owner): `PATCH /api/settings` dengan `{ "staffModel": true }`. Nilai selain `true` murni disimpan sebagai `false`.
- Fase berikutnya memakainya sebagai percabangan: `if (store.staffModelOn()) { …jalur staf = workflow… } else { …jalur lama… }`.

## 4. Laporan invarian

```bash
npm run check:invariants
```

Menjalankan `test/invariants.test.js` (juga ikut `npm test`) pada seed dan folder data sementara, bukan data Owner. Ringkasan terdiri dari empat bagian:

| Bagian | Arti |
|---|---|
| Lulus | Sinkron sekarang. Bila berubah merah, ada yang rusak. |
| Gagal | Merah sungguhan, perlu diperbaiki sekarang (perintah keluar dengan kode 1). |
| Diketahui | Pelanggaran yang sudah ada dan dicatat berikut daftarnya (mis. Executive punya dua pemimpin, `aria` master sekaligus manajer, `version` seed v8 vs migrasi v11). Pelanggaran **baru** di luar daftar menjadi Gagal. |
| Ditunda per fase | Tes `todo` bertanda `[P1]`…`[P5]`. Badan tesnya memeriksa keadaan sebenarnya dan gagal sampai fase itu selesai. Tidak dihapus dan tidak dipaksa lulus. |

Saat sebuah fase selesai, tes tertundanya lulus sendiri dan laporan menampilkannya di bagian "sudah lulus tetapi masih bertanda todo": buang `phase(...)` dari tes itu agar menjadi penjaga permanen. Saat sebuah pelanggaran yang diketahui diperbaiki, kosongkan daftarnya di `knownFailure(...)`.

Kelompok invarian: INV1–3 struktur organisasi, INV4 satu id di roster/katalog/data/3D, INV5 bentuk data dan status, INV6–8 mesin (tool per peran, gerbang tugas, satu modul persetujuan), INV9 migrasi (idempoten, versi seed, semua ruang kerja), INV10 status 3D, INV11 regex dan prompt, INV12 antarmuka, INV13 keamanan publik, INV14 verifikasi mascot V4.2.

## 5. Penjaga regex

`test/regex-guard.test.js` mencegah backslash hilang: `/s+/` (huruf s) padahal maksudnya `/\s+/`. Sekarang juga menangkap `d`, `w`, `S`, `D`, `W` telanjang dengan penghitung pada `replace/split/match/test/exec/search` dan `new RegExp('s+')`, memindai sub-folder (mis. `server/staff/`), dan punya tes pembuktian bahwa polanya menangkap contoh salah dan tidak menandai contoh benar.

## Urutan kerja yang aman sebelum perubahan besar

1. `npm run data:backup -- --label <nama-fase>`
2. `node docs/mascot-v4-2/verify-v42.mjs` dan `npm run check:invariants` (catat angkanya)
3. Kerjakan perubahan
4. Ulangi langkah 2; tidak boleh ada Gagal baru
5. Bila ada masalah: hentikan server, `npm run data:restore -- <folder> --confirm`
