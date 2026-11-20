# Kantor 3D terasa hidup: audit, tambahan, biaya

Tanggal 2026-11-20. Permintaan Owner: kantor terasa sepi, tetapi platform tetap sangat ringan.

## 1. Audit: apa yang SUDAH ada (office3d.js, life.js, chatter.js)

Hampir semua unsur "hidup" sudah ada dan tidak perlu ditulis ulang:
- **Langit** (`life.js`, satu update per bingkai, instanced/Points): awan, burung, paus langit, spora bercahaya, aurora, kabut; kunang-kunang diatur kualitas (84 / 44 / 28).
- **Agen**: status working/meeting/leisure/visit, gestur (cheer, clap, think, drink, phone, dance, stretch…), ekspresi wajah, kedip, emote, bubble teks, obrolan dua orang (`socialTick` → `startConvo`, kalimat Indonesia di `chatter.js` per waktu dan topik), kehidupan di ruang bermain, kafe, lounge, plaza (`leisureLife`, `plazaLife`), air mancur, lampu.
- **Keputusan jalan-jalan**: agen menganggur di meja pindah ke plaza/kafe/lounge dengan peluang 6% per pengecekan dan jeda 20-60 s (`nextIdle`), dibatasi `crowdCap()` = `V.crowd` (14; 6 di mode eco) untuk SELURUH stasiun (171 orang).

## 2. Mengapa tetap tampak sepi (dari tangkapan layar plaza dan kode)

1. **Kuota 14 untuk seluruh stasiun**, dibagi rata ke semua ruang dan lantai. Di plaza tempat kamera berada biasanya hanya 0-2 orang, bangku taman kosong.
2. Peluang kecil (6%) dan jeda panjang (20-60 s) per agen; ditambah syarat agen "free" (tanpa pekerjaan nyata). Dengan "0 AI bekerja" semua free, tetapi tetap lambat dan tersebar.
3. Tidak ada pemilihan yang **berpihak pada apa yang sedang terlihat**: agen yang dikirim jalan-jalan bisa saja di sayap lain.
4. Bubble sapaan ke pengguna hanya muncul di jalur tertentu.

## 3. Yang ditambahkan (aditif, tanpa mengubah jalan/rig/geometri/kamera/aset)

- **`public/js/ambien.js`** (logika murni, diuji): satu penjadwal global berdetak tiap 1,8 s (Penuh) atau 3,6 s (Ringan), +-30% acak. Tiap detak: kumpulkan kandidat sekali (iterasi agen, tanpa alokasi per bingkai selain satu array kecil tiap detak), pilih SATU agen yang bebas, di meja, LOD <= 2 dan dalam 46 satuan dari titik pandang (condong ke yang terdekat), lalu kirim ke taman (plaza), pantri (kafe), bangku (lounge), ruang bermain atau perpustakaan memakai `goPlaza`/`claimSpot`/`goSpot` yang sudah ada (jalur dan titik sama, tanpa pathfinding baru). Bobot aktivitas menurut waktu (pagi/sore: pantri; siang: taman; malam: bangku).
- **Kuota ambien** di sekitar pandangan: Penuh 6, Ringan 3, Mati 0; HP paling banyak 2. Ini DITAMBAH di atas kuota lama, sehingga ruang yang sedang dilihat terisi.
- **Status nyata menang**: hanya agen berstatus bebas yang dipilih; agen working/meeting tidak pernah diganggu.
- **Sapaan**: bila pengguna mode Play, agen bebas dalam 7 satuan sesekali (14-30 s) menoleh, melambai (gestur `cheer`), tersenyum dan berkata "Halo {nama}!" (daftar kalimat di `ambien.js`).
- **Sakelar "Suasana hidup: Penuh / Ringan / Mati"** di Pengaturan > Tampilan (`localStorage['suasana-hidup']` + peristiwa `raiverse:suasana`). Bawaan: Penuh di desktop, Ringan di HP.
- **Mati otomatis** (`tingkatEfektif`): tab tersembunyi, panel/halaman penuh yang menutup 3D (`uiBlock`/`winDim`), pilihan Mati; **turun ke Ringan** di HP, mode hemat (`gfx==='eco'` atau `perfLite`), atau FPS rata-rata < 30.
- Pemeriksaan: `__ray3d.ambien()` mengembalikan tingkat efektif dan jumlah agen ambien yang sedang di luar meja.

## 4. Biaya (Chrome headless + GPU, port 4551, 40 s setelah 3D tampil)

`UJI_GPU=1 node scripts/ukur-hidup.mjs 4551 40`

| Tingkat dipilih | Tingkat efektif | Agen ambien aktif | FPS rata-rata | Memori JS |
|---|---|---|---|---|
| Mati | mati | 0 | 22,8 | 234 MB |
| Penuh | **ringan** (FPS < 30 memicu turun) | 3 | 22,3 | 249 MB |

Catatan jujur:
- Di mesin uji, 3D hanya berjalan ±22 FPS (perangkat bersama dan kompilasi shader), sehingga aturan adaptif langsung menurunkan Penuh ke Ringan; **tingkat Penuh (6 agen) tidak terukur di sini**. Selisih FPS 0,5 berada dalam derau.
- Selisih memori +15 MB bisa berasal dari bubble/sprite agen yang berjalan, dan satu kali jalan belum cukup untuk membuktikan beda nyata; perlu diukur ulang di PC Owner (GPU asli) dengan 3-5 kali jalan.
- Biaya CPU per detak: satu iterasi atas agen (171) tiap 1,8-3,6 s, bukan per bingkai; per bingkai hanya satu perbandingan waktu. Belum diukur dengan profil terpisah di bawah 1 ms; secara desain jauh di bawahnya.

## 5. Yang BELUM dikerjakan dari permintaan

- c) partikel/daun/kupu-kupu baru, awan lebih pelan, matahari berayun, lampu kedip: sudah ada kunang-kunang, awan, burung, air mancur dan lampu di `life.js`/`environment.js`; tidak ada yang baru ditambah (tanpa bukti perlu, dan tiap tambahan menambah draw call).
- d) suara ambien tambahan: tidak ditambah (tanpa unduhan baru).
- f) denyut dari event SSE ke meja/papan (lampu hijau, layar menyala): belum.
- Bayangan bulat palsu: belum.
- Bangku taman: agen dikirim lewat `goPlaza` (titik plaza yang sudah ada); apakah bangku tertentu terpakai bergantung pada titik duduk yang terdaftar di `plazaSpots`; belum dipastikan setiap bangku di tangkapan layar punya titik duduk.

## 6. Yang akan terlihat Owner

Setelah server 4400 dimuat ulang dan Ctrl+F5: di sekitar tempat kamera berada, tiap beberapa detik satu agen menganggur berjalan keluar mejanya ke taman/pantri/lounge, sampai 6 orang sekaligus di Penuh (3 di Ringan), ditambah obrolan antar-agen yang sudah ada. Dalam mode Play, agen di dekatmu menyapa. Mohon dinilai langsung di layar; ini belum divalidasi oleh mata manusia.

Tes: `test/ambien.test.js` (7 tes: tingkat/kuota/pemilihan/penjadwal/pengait).
