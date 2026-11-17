# 03. Aturan dan cara kerja

## 1. Pembagian wewenang

| Area | Pemilik | Aturan |
|---|---|---|
| `public/assets/characters/agents/*` | Sesi 3D (pipeline Blender) | Hanya diubah lewat `pipeline/deploy_v4.py`. Sesi runtime: baca saja. |
| `public/js/`, `public/css/`, `server/` | Sesi runtime | Boleh diubah, **dengan edit bedah** dan wajib mempertahankan `02-DAFTAR-PERUBAHAN-KODE.md`. |
| Folder `docs/mascot-v4-2/` | Bersama | Perbarui bila Anda mengubah salah satu butir A-D; jangan menghapus. |
| Cadangan `3D karakter/_backup_*` | - | Jangan dihapus. |

Sesi 3D sudah melakukan edit di tiga berkas JS atas perintah langsung Owner (lihat 02). Mulai sekarang sesi 3D tidak akan mengedit `public/js`, `css`, `server` tanpa memberi tahu sesi runtime lewat pesan.

## 2. Cara mengedit file JS dengan aman

1. Jalankan `node docs/mascot-v4-2/verify-v42.mjs` (harus lolos).
2. Edit **bedah**: ganti hanya blok yang perlu (Edit dengan string unik). Jangan menyalin ulang file dari sumber lain, jangan `git checkout` file ini tanpa memeriksa: working tree berisi pekerjaan belum di-commit.
3. `node --check public/js/<file>.js` setelah edit.
4. Jalankan penjaga lagi. Bila ada butir GAGAL, perbaiki sebelum lanjut.
5. Bila Anda menambah perilaku baru yang menyentuh agen: pakai properti baru dengan awalan jelas, jangan menimpa `a.react/a.micro/a.fidget*`.
6. Muat ulang browser dengan **Ctrl+F5** untuk memeriksa (modul JS di-cache).

## 3. Larangan keras (alasan: sudah pernah menjadi bug)

- ❌ Mengembalikan `armIK` untuk semua state → lengan kiri diam, tidak ada ayunan lengan.
- ❌ Mengalikan lebar badan chibi dengan nilai acak / skala non-uniform pada `clone`, `g`, `body` → robot gepeng.
- ❌ Menaikkan FOV kamera Mode Play di atas `PLAY_FOV` (38) → badan/wajah teregang di tepi layar. FOV overview 65 boleh (pilihan pengguna).
- ❌ Menambahkan squash/stretch, breathing besar (>2 %), atau bobot skala pada Root/Head/Hips.
- ❌ Mengganti/menimpa berkas di `characters/agents/`, atau menambah id ke `CHIBI.ids` tanpa berkasnya (`loadBody` melempar galat untuk id yang hilang; id itu dilewati).
- ❌ Menjalankan server dari salinan `db.json` dengan environment `GROQ_API_KEY`/`ANTHROPIC_API_KEY` terisi.
- ❌ Mengklaim hasil tanpa bukti (angka/gambar).

## 4. Prosedur uji terisolasi (WAJIB untuk uji yang menyalakan server)

Server aplikasi membaca kunci API dari **environment shell**. `data/db.json` Owner memang tidak berisi kunci, tetapi proses Anda mewarisi environment. Uji dari **salinan** dengan kunci dikosongkan:

```
# 1. salin (tanpa node_modules/.git/3D karakter; node_modules cukup dijunction/symlink)
robocopy "<app>\server" "<scratch>\server" /E
robocopy "<app>\public" "<scratch>\public" /E
copy "<app>\package.json" "<scratch>\package.json"
copy "<app>\data\db.json" "<scratch>\data\db.json"
# node_modules: junction ke <app>\node_modules
# 2. jalankan di port lain, tanpa kunci, Groq diarahkan ke port mati
set GROQ_API_KEY= & set ANTHROPIC_API_KEY= & set RAY_GROQ_BASE_URL=http://127.0.0.1:1 & set PORT=4400 & node server/index.js
# log harus berisi: "Mesin AI: SIMULASI"  -> bila tertulis "LIVE", HENTIKAN segera
```

Jebakan pengujian yang sudah menipu pengukuran sebelumnya:
- **Pane/browser tersembunyi atau tidak fokus membatasi `requestAnimationFrame` ke ±1 FPS.** Animasi (fade klip 0,3 dtk, intro) hampir tidak maju; hasil "T-pose", "bobot aksi 0,004", "kamera diam" adalah artefak ini. Majukan animasi manual (`rig.apply(a)` berulang dengan jeda nyata ±35 ms) atau uji di browser normal.
- `rig-test.html?state=type` memaksa rotasi lengan secara manual (kode uji lama); jangan memakainya untuk menilai klip Type. Gunakan `?state=sit` lalu set `a.e.status = 'working'`.
- `rig-test.html?id=...` memilih badan dengan `hash(id) % jumlah_id` (tidak menerima id badan langsung). Id uji yang memetakan ke badan tertentu (urutan `CHIBI.ids`): `t3`=kiko, `t5`=charcoal, `t22`=azure, `t0`=branch (pool 12).
- Tangkapan layar `computer` pada kanvas WebGL sering kosong/timeout; simpan kanvas lewat `toBlob` + POST ke server statis kecil.
- Counter `renderer.info` terakumulasi bila Anda memanggil `render()` manual berkali-kali; abaikan `calls/tris` dari loop manual.

## 5. Cara mengukur distorsi bentuk (bukan menebak)

Lebar kepala / tinggi total badan pada model asli: Charcoal 0,776, Kiko 0,650, Azure 0,686, Branch 0,718 (`config/interaction_proxy.json` di paket mascot). Di runtime, ukur lebar/tinggi kepala hasil proyeksi layar di tengah vs tepi layar: tengah harus ≈ rasio model (Azure 1,22), tepi tidak lebih dari +10 %.

## 6. Bila Owner mengeluh soal karakter

Periksa urutan ini sebelum mengubah kode:
1. Penjaga lolos? 2. Browser sudah Ctrl+F5? 3. Keluhan terkait lensa/FOV (objek di tepi), skala (skala non-uniform), klip (state yang dipakai), atau atlas (ekspresi)? 4. Bandingkan dengan demo mascot (`http://localhost:8765/demo/`, jalankan `node serve.mjs` di folder paket mascot) sebagai pembanding visual, bukan sebagai tujuan identik: kantor memakai 16 ekspresi kontrak, demo 24 state.
