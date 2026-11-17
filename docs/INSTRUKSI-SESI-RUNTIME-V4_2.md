> **DIGANTI:** dokumen yang berlaku ada di folder `docs/mascot-v4-2/` (mulai dari `README.md`). Berkas ini disimpan sebagai riwayat.

# Instruksi untuk sesi runtime (Ray Agent Office): karakter V4.2

Dari: sesi "3D / mascot" (pipeline Blender). Tanggal 2026-11-17 ±19:20. Pemilik: Owner. Tujuan: mencegah dua sesi saling menimpa.

## 1. Keadaan sekarang (sudah terpasang, jangan diulang)

Karakter lama (terra, mallow, blueprint, sprout, clover, sage) **sudah pensiun**. Runtime hanya memakai karakter Robot Mascot V4.2: 4 base × 3 tampilan = 12 id.

| Base | Id |
|---|---|
| Kiko | `kiko`, `kiko_ocean`, `kiko_coral` |
| Azure | `azure`, `azure_ocean`, `azure_coral` |
| Charcoal | `charcoal`, `charcoal_ocean`, `charcoal_coral` |
| Branch | `branch`, `branch_ocean`, `branch_coral` |

File ada di `public/assets/characters/agents/` (`<id>.glb`, `lod/<id>.glb`, `<id>.face.png`, `<id>.json`) dan `index.json` (ids = 12 id di atas; id lama masuk `retired`). Semua lolos kontrak `BRIEF-KARAKTER-3D.md` (±5,6 rb / 1,4 rb segitiga, ≤0,66 MB, 24 tulang + PropL/R, 20 klip CH_*, atlas 512² 4×4, kaki di lantai, duduk 0,255 m).
Cadangan karakter V3 lama: `3D karakter/_backup_agents_v3_20261117/` (semua 9 id V3 beserta lod).

## 2. Edit yang saya lakukan di `public/js/assets3d.js` (hanya 3 tempat; jangan dibatalkan)

1. Baris `const CHIBI = {... ids: [...] }`: sekarang berisi 12 id di atas. **Daftar ini ditulis tetap di kode; `index.json` TIDAK dibaca runtime.** Setiap kali id berubah, ubah keduanya dan pastikan identik.
2. Di `loadBody`, tepat setelah `const lodRoot = (await glb.loadAsync(lodUrl)).scene;` ada 2 baris tambahan: material `Face` pada LOD diberi `userData.faceSheet = true`. Tanpa ini geometri LOD1 menampilkan **seluruh atlas 16 ekspresi sekaligus** (bug sebelumnya, terlihat pada kualitas rendah/jauh).
3. `const AGENT_V = 'v4-2-1117b'`. Naikkan setiap kali GLB di-deploy ulang (cache-bust).

Tidak ada perubahan di `server/`, `public/css/`, dan file `public/js/` lain. Jika Anda menulis ulang seluruh `assets3d.js`, pertahankan ketiga hal ini.

## 3. Aturan agar tidak bertabrakan

- **Saya (sesi 3D) hanya menyentuh `public/assets/characters/agents/*` dan `docs/V4_2-*`**, lewat skrip `pipeline/deploy_v4.py` (folder Blender). Saya tidak akan mengedit `public/js`, `public/css`, atau `server/` lagi tanpa memberi tahu Anda dulu.
- **Anda (sesi runtime) memegang `public/js`, `public/css`, `server/`.** Jangan menimpa/menghapus berkas di `public/assets/characters/agents/` dan jangan menjalankan `build_mascot.py`/`deploy_v4.py`. Perlu aset baru atau proporsi berbeda? Minta lewat Owner/pesan ke saya.
- Tidak ada commit dari saya. Working tree Anda yang belum di-commit tidak saya sentuh selain tiga edit di atas.
- Jangan menjalankan server uji dari salinan `data/db.json` dengan variabel lingkungan `GROQ_API_KEY` terisi: itu memanggil API sungguhan. Untuk uji: `GROQ_API_KEY= ANTHROPIC_API_KEY= RAY_GROQ_BASE_URL=http://127.0.0.1:1`, port lain, di salinan folder.

## 4. Fakta yang perlu Anda ketahui

- Material tubuh bernama `LOCKED_V4_*` (tidak diwarnai ulang, `role_*` tidak dipakai). Layar = `Eye`, panel wajah = `Face`. `faceTint` dari manifest: Kiko `#64eb30`, Azure `#bcebff`, Charcoal `#ffeb43`, Branch `#dbf7ff` (colorway memakai warna LED masing-masing).
- Warna per agen hanya dari pilihan 12 badan (`hash % 12`). Menambah variasi = minta saya bangun colorway lagi (±35 dtk per id).
- Ekspresi kontrak 16 sel; Kiko/Azure memakai piksel V4.2, Charcoal/Branch wajah layar sederhana. Telinga Kiko ikut `Head` (tanpa spring), `springs: []`.
- Tinggi manifest 1,298–1,300 m; runtime menskalakan ke 1,74 m seperti sebelumnya. `walkStride` dan `seatHip` per id ada di manifest (jalan pendek: sesuaikan kecepatan ke stride/0,54).
- Kiko duduk: kaki menggantung (kaki terlalu pendek untuk lantai), tercatat di `notes` manifest.

## 5. Yang belum diverifikasi (mohon dicek di sisi runtime)

1. Gestur `wave`, `cheer`, `type`, `carry`, `hold` pada keempat base di kantor sungguhan (saya hanya melihat jalan dan duduk).
2. Mode Play: agen menoleh/melambai saat didekati, tabrakan, kamera orang ketiga.
3. Performa kantor dengan 12 badan baru (muat awal 12 GLB + 12 LOD; frame time bervariasi 10–59 ms pada iGPU uji, tidak ada perbandingan V3 vs V4 yang andal).
4. Apakah penilai kualitas adaptif (LOD) Anda perlu penyesuaian: pada pane lambat semua agen turun ke LOD1.
5. Tampilan seluruh 112 agen: periksa tidak ada duplikat mencolok bersebelahan; bila perlu pakai penugasan badan berdasarkan divisi, bukan hash murni.

## 6. Rollback cepat
Salin isi `3D karakter/_backup_agents_v3_20261117/` ke `public/assets/characters/agents/`, kembalikan `CHIBI.ids` lama (`terra, mallow, blueprint, sprout, clover, sage, charcoal, kiko, azure`), `index.json`, dan naikkan `AGENT_V`. Hapus 9 id colorway/branch bila perlu.

Detail lengkap: `docs/V4_2-MASCOT-INTEGRATION.md`.
