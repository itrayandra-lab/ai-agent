# Baseline performa (SEBELUM optimasi)

Diukur 2026-11-19 dengan `scripts/ukur-performa.mjs` (Chrome headless sungguhan lewat CDP, `UJI_GPU=1` = GPU asli, bukan SwiftShader), server uji terisolasi di port 4551 dengan salinan data Owner (171 karyawan, 369 tugas, 2.326 pesan), `GROQ_API_KEY` kosong (mesin SIMULASI), server 4400 tidak disentuh. Layar 1440x900, rute `#office`.
"Dingin" = profil Chrome baru (tanpa cache). "Hangat" = muat ulang dengan cache peramban. Mesin sedang dipakai sesi lain, jadi waktu absolut berfluktuasi; angka byte dan jumlah permintaan deterministik. Dua kali jalan dicantumkan (a / b). Berkas mentah: `baseline-gpu.json`, `baseline-gpu-2.json` (`baseline-desktop.json` = percobaan SwiftShader, tidak dipakai sebagai acuan).

| Ukuran | Dingin | Hangat |
|---|---|---|
| UI pertama berisi (sidebar terisi) | 2,76 s / 2,39 s | 1,78 s / 3,18 s |
| First Contentful Paint | 2,26 s / 2,56 s | 1,16 s / 2,84 s |
| Kantor 3D tampil (canvas ada, tulisan "Memuat" hilang) | 18,7 s / 13,4 s | 12,7 s / 14,0 s |
| Jumlah permintaan | 143 | 142 |
| Transfer total | **34,1 MB** | **31,7 MB** |
| JS terkirim / diurai | 3,5 MB / 3,5 MB (tanpa kompresi) | 1,16 MB |
| `/api/state` | **9,56 MB** (tanpa kompresi), diunduh 2x per muat (boot, lalu lagi saat SSE tersambung) | 9,56 MB x2 |
| Tugas panjang (>50 ms) terpanjang | 10,2 s / 7,2 s | 5,0 s / 4,3 s |
| Memori JS | 226-235 MB | 227-231 MB |
| FPS saat diam | 79-95 | 60-70 |

## Temuan penyebab (dari profil CPU dan daftar permintaan, bukan dugaan)

1. **Tanpa kompresi sama sekali**, dan `Cache-Control: no-cache` tanpa ETag untuk JS/CSS: tiap muat ulang mengunduh ulang semuanya (31,7 MB hangat).
2. **`/api/state` 9,56 MB**: `employees[].skillRefs` 3,0 MB (tiap karyawan membawa ±60 skill), `tasks[].log` 1,4 MB, `tasks[].output` 1,15 MB, `notes[].content` 0,8 MB, `messages[].text` 0,6 MB. Diunduh dua kali per muat (boot, lalu `loadState()` lagi saat SSE pertama tersambung).
3. **Three.js (2 MB tak terkompresi) ada di jalur muat awal UI** lewat impor statis `views.js` → `appearance-ui.js` / `karakter-view.js` → `assets3d.js` → `three`, padahal impor itu tidak dipakai (views.js) atau hanya dipakai di layar tertentu. UI menunggu Three diurai.
4. Stylesheet font Google memblokir render. Modul dimuat berantai (air terjun 3 gelombang).
5. **Waktu terbesar di 3D: kompilasi shader.** Profil CPU: `onFirstUse` (three.module.js:6799) 5,9-9,4 s dari ±12 s. Ada **68 program shader** (65 material kantor + 3 PMREM) yang ditautkan sinkron di GPU saat bingkai pertama; ini memblokir utas utama (tugas panjang 7-10 s).
