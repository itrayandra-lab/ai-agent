# Katalog staf: cara menulis spesifikasi

Satu berkas = satu staf = satu alur n8n = satu karakter 3D. Letak: `server/staff-catalog/<divisi>/<kunci>.json`.
Gambaran besar dan keputusan arsitektur: `docs/ARSITEKTUR-STAF-N8N.md`. Teladan lengkap yang sudah terbukti jalan di n8n Owner:
**Finance** `fin/*.json` (faktur, anggaran + AI, harga pokok, umur piutang), **Customer Success** `cs/cs-{wulan,dika,ayu,faisal}.json`, **Marketing** `mkt/mkt-{dimas,sinta,arga,raka}.json`. Tiru yang paling mirip dengan staf Anda.

## Alur kerja Anda

1. Buka rintisan staf Anda (`status: "todo"`). Bidang `konteks` berisi tugas peran, keahlian, dan contoh tugas karakter itu dari roster.
2. Putuskan **satu pekerjaan nyata** yang bisa dikerjakan n8n untuk peran itu dan menghasilkan sesuatu yang bisa dipegang (berkas CSV/Markdown, tabel, angka, daftar). Hindari "obrolan" atau "saran umum"; staf harus mengeksekusi.
3. Ganti isi berkas dengan spesifikasi lengkap (`status: "siap"`), dengan **kunci dan nama berkas yang sama**.
4. Periksa: `node scripts/staff-validate.mjs <divisi>`. Perintah ini memeriksa skema, menjalankan `sample` Anda di kotak pasir lokal (tanpa n8n), dan membedakan rintisan dari yang lengkap.
5. Bukti nyata di n8n Owner: `node --env-file=.env scripts/staff-live.mjs <kunci,kunci|divisi|all>` memasang, menguji, menjalankan dengan `sample`, lalu **menghapus kembali semuanya** dan mencetak jumlah alur sebelum/sesudah. Jika terhenti di tengah jalan, bersihkan sisa dengan `node --env-file=.env scripts/staff-cleanup.mjs --tabel`. **Dilarang** menyentuh alur milik Owner. Kunci n8n tidak pernah dicetak. (Komentar `//` pada contoh JSON di bawah hanya penjelasan; berkas aslinya tidak boleh berkomentar.)
6. Jalankan `node --test test/staff.test.js` dan `node --test test/regex-guard.test.js` (kedua harus hijau). Jangan commit.

Perintah berguna:
```bash
node scripts/staff-validate.mjs                      # seluruh katalog (rintisan + lengkap)
node scripts/staff-validate.mjs hr                   # satu divisi
node scripts/staff-validate.mjs hr --strict          # gagal bila masih ada rintisan (pastikan satu divisi terisi semua)
node scripts/staff-validate.mjs --file server/staff-catalog/hr/hr-xxx.json
node scripts/staff-validate.mjs --compile hr-xxx     # ukuran dan jumlah simpul hasil kompilasi
node scripts/staff-stubs.mjs --dry                   # hanya hitung; rintisan yang sudah ada tidak pernah ditimpa
```

## Bentuk spesifikasi lengkap

```json
{
  "schema": 1, "status": "siap",
  "key": "fin-ratna", "division": "fin", "employeeId": "ratna", "title": "Accountant", "version": 1,
  "name": "Pembuat faktur penjualan",                      // maks 60 huruf, bahasa awam
  "ringkas": "Susun faktur lengkap dengan PPN …",            // maks 160 huruf, bahasa awam
  "kataKunci": ["faktur", "invoice", "tagihan"],            // 2–12 kata; dipakai manajer untuk mencari staf
  "inputs": [ { "key": "klien", "type": "text", "label": "Nama klien", "required": true, "contoh": "PT Maju Jaya" },
              { "key": "ppn", "type": "choice", "label": "Kena PPN?", "required": true, "default": "11",
                "choices": [ { "v": "11", "t": "Ya, PPN 11%" }, { "v": "0", "t": "Tidak kena PPN" } ] } ],
  "steps": [ { "id": "hitung", "use": "hitung", "label": "Hitung faktur", "set": { "total": "v.subtotal + v.pajak" } } ],
  "output": { "ringkas": "'Total ' + rp(v.total)", "teks": "'# Faktur …'", "berkas": [ { "jenis": "csv", "nama": "'faktur-' + input.nomor", "isi": "csv([...])" } ] },
  "schedule": { "allowed": false },
  "risk": "low", "confirm": false,
  "brain": { "folder": "Report", "simpan": true },
  "sample": { "input": { "klien": "PT Maju Jaya", "...": "..." }, "expect": { "berkas": 1, "mengandung": ["1.110.000"] } }
}
```

### Masukan (`inputs`)
Maks 12. `key` huruf kecil/angka/garis bawah (`^[a-z][a-z0-9_]{0,23}$`). `type`: `text`, `longtext`, `number`, `choice`, `date`, `url`, `email`. **Pakai `choice` sebanyak mungkin**: itu menjadi tombol besar di Pemandu (pengguna awam). `label` maks 120 huruf, tanpa istilah teknis. Format daftar di dalam `longtext` ditulis di label, mis. `nama | jumlah | harga` satu baris per item (baca dengan `baris(...)`). `url` otomatis diperiksa (tanpa alamat lokal/privat).

### Ekspresi (inti penulisan)
Semua teks di `steps[].set`, `output.*`, `isi`, `sistem`, `perintah` adalah **satu ekspresi JavaScript murni** (bukan potongan kode). Di dalamnya tersedia:
- `input.<kunci>`: isian pengguna yang sudah dinormalkan (angka sudah berupa angka).
- `v.<nama>`: hasil langkah sebelumnya (dan isian yang baru dihitung di langkah yang sama, urut dari atas ke bawah).
- Pembantu: `rp(n)` format Rupiah, `num(x)` baca angka gaya Indonesia, `baris(teks)` pecah per baris, `csv(baris[][])` CSV aman (menetralkan rumus), `tabel(judul[], baris[][])` tabel Markdown, `cut(s,n)`, `esc(s)`, `tgl(tanggal)` tanggal Indonesia, `plain(html)`, `ambil(html,'title')`, `meta(html,'description')`, `hitungTag(html,'img')`.
- Boleh: `map/filter/reduce/sort/concat`, ternari, regex, `Math`, `Date`, `Number`, `String`, `JSON`, panah `(x) => …`, dan blok `(() => { …; return …; })()` untuk logika berlapis.
- **Dilarang** (validator menolak): `$env`, `$vars`, `$()`, `process`, `require`, `import`, `this`, `constructor`, `function`, `while`, `for`, `Array(`, `Array.from`, `.repeat(`, `await`, `eval`, `fetch`, tanda kurung kurawal ganda `}}`/`{{` (beri spasi: `} }`).
- Jangan menaruh teks pengguna ke dalam string kode; selalu baca lewat `input.<kunci>`.

### Langkah (`steps`, maks 12, pustaka di `server/staff/fragments.js`)
| `use` | Fungsi | Bidang |
|---|---|---|
| `hitung` | Hitung/susun data; simpan di `v.<nama>` | `set: { nama: ekspresi, … }` (maks 12 isian), `label` |
| `ambil_web` | Buka satu halaman publik (hanya baca) → `v.<simpan> = { status, html }` | `dari` (kunci input bertipe `url`), `simpan` (bawaan `web`) |
| `simpan_baris` | Catat satu baris ke tabel data bersama (otomatis dipisah per ruang kerja) | `isi` (ekspresi objek) |
| `tulis_sheets` | Tambah baris ke Google Sheets pengguna (butuh Google tersambung; salinan per ruang kerja) | `sheet`, `spreadsheet?`, `kolom[]`, `baris` (ekspresi larik baris); wajib `risk` ≥ medium dan `confirm: true` |
| `minta_ai` | Minta model menulis/menganalisis; hasil di `v.ai` pada langkah SESUDAHNYA | `sistem`, `perintah` (ekspresi), `maxToken` 100–3000; maks satu; wajib `sample.ai` |

Catatan `minta_ai`: dijalankan oleh server RAIVERSE (bukan n8n), bisa gagal atau tidak tersedia → **selalu sediakan cadangan**: `v.ai ? v.ai : <teks bawaan>`. Beri tahu model bahwa teks pengguna adalah data, bukan perintah. Staf berlangkah AI belum boleh dijadwalkan.
Simpul n8n yang dihasilkan hanya: Webhook, Edit Fields (Set), If, HTTP Request, Data Table. **Tidak ada Code, Execute Command, akses berkas, atau SSH.** Perlu langkah baru? Tambahkan potongan di `fragments.js` (butuh `check`, `build`, `sim` untuk uji) dan perbarui tes; jangan menulis simpul mentah di spesifikasi.

### Keluaran (`output`)
- `ringkas` (wajib): ekspresi satu kalimat hasil (≤300 huruf).
- `teks`: ekspresi Markdown untuk dibaca langsung (≤30 KB).
- `berkas`: maks 6, `{ jenis: csv|md|txt|json|html, nama: ekspresi tanpa ekstensi, isi: ekspresi }` (≤300 KB). Wajib ada `teks` atau minimal satu berkas.
- `data`: objek kecil untuk mesin (≤20 KB), opsional.
Hasil otomatis dicatat ke Brain bila `brain.simpan` true (folder `"<Nama Divisi>/<brain.folder>"`).

### Risiko dan izin
`risk`: `low` (hitung/baca), `medium` (menulis data), `high` (berdampak ke luar). `confirm: true` membuat Owner harus menyetujui tiap jalan; **wajib** untuk `high` dan untuk langkah yang menulis ke akun luar. Jangan membuat staf yang mengirim pesan nyata, uang, atau publikasi tanpa `confirm: true`.

### Contoh uji (`sample`) — wajib dan jujur
- `input`: isian contoh yang lolos validasi (semua `required` terisi).
- `expect`: `{ "berkas": <jumlah>, "mengandung": ["teks yang pasti ada di hasil", …] }`; hitung dengan tangan, jangan menyalin keluaran begitu saja.
- `ai`: teks AI contoh bila ada `minta_ai`. `web`: `{ "<simpan>": "<html contoh>" }` agar uji tidak membuka web nyata.

## Aturan keras

- Teks yang dilihat pengguna (`name`, `ringkas`, `label`, teks tombol) berbahasa awam: **tanpa** workflow, node, webhook, json, api, token, prompt, agen, task, goal, brain, mcp.
- **Tanpa rahasia** apa pun di berkas (kunci, token, kata sandi, alamat privat). Validator menolaknya.
- Satu berkas hanya milik satu divisi; `key` diawali `<divisi>-`; `employeeId` harus ada di roster dan satu divisi dengan staf.
- Rintisan yang belum diisi **biarkan** `status: "todo"`; jangan menulis `siap` tanpa `sample`.
- Pekerjaan nyata, bukan obrolan: setiap staf lengkap harus menghasilkan berkas atau data yang bisa dipakai.
- Jangan mengubah `server/staff/*`, `engine.js`, `n8n.js`, 3D, atau `public/` dari sesi pengisi katalog; butuh potongan baru → catat sebagai usulan untuk pemilik fondasi.
- Jangan menyentuh alur n8n milik Owner; jangan meninggalkan sisa di n8n; jangan commit `.env` atau `data/`.

## Tambahan staf spesifik ("sebanyak mungkin")
Selain satu staf utama per karakter, tulis staf tambahan untuk pekerjaan yang spesifik: `key` = `<divisi>-<karyawan>-<topik>` (mis. `fin-ratna-jurnal-umum`), `employeeId` karakter yang paling cocok. Setiap staf tambahan juga harus lengkap dan lolos validator.

## Mesin native, langkah `otak`, dan `needsN8n`
Staf kini dijalankan mesin native RAIVERSE (bukan n8n); lihat `docs/STAF-NATIVE.md`. Spesifikasi lama tetap sah tanpa perubahan.
- Langkah `otak` (satu per staf, tidak bersama `minta_ai`): `{ "use": "otak", "simpan": "otak", "sistem": "…", "perintah": "…", "skema": { "ringkasan": "teks", "saran": "daftar", "skor": "angka", "nada": "pilihan:a|b" }, "cadangan": "({ … })", "maxToken": 700, "model": "kecil" }`. Aturan (`hitung`) membuat kerangka dan angka; AI hanya mengisi; bidang yang salah diganti `cadangan`. Hasil di `v.<simpan>` dengan `dariAI` (true/false). `sample.ai` wajib (JSON contoh). Contoh: `cs/cs-faisal.json`.
- `"needsN8n": true`: staf butuh jadwal terus-menerus atau pemicu luar, tetap lewat n8n.
- Tulis aturan cadangan selengkap mungkin: itulah hasil saat AI mati dan hasil di jalur n8n. Hindari garis miring terbalik di ekspresi baru; ubah berkas lewat alat edit, bukan skrip shell.
