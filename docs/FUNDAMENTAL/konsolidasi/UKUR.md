# Ukur sebelum/sesudah konsolidasi (2026-11-20)

Alat: `scripts/inventaris.mjs` (ukuran) dan `scripts/ukur-konsolidasi.mjs` (Chrome headless, 1440×900, tema gelap, median 3 muat; server uji terisolasi, tanpa kunci AI). "Sebelum" = commit `a24bf9c` (worktree sementara, port 4512); "sesudah" = branch ini (port 4511).

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| CSS total (byte) | 262.701 | ~259.700 (office-layout.css 43.574 → 40.539) |
| JS klien (byte) | 1.193.229 | 1.193.523 (+ perbaikan T-06/T-08/T-09/T-11/T-22/T-45) |
| JS server (byte) | 1.956.316 | ~1.954.400 (12 peneruskan yatim diarsipkan; 107 berkas dari 119) |
| Permintaan saat muat (median) | 144 | 144 |
| Byte terkirim (KB, median) | 12.312 | 12.314 |
| Dock siap (ms, median) | 1.188 | 1.200 |
| DOMContentLoaded (ms) | 283 | 273 |
| Load event (ms) | 369 | 332 |
| Heap JS (MB) | 171 | 176 |
| FPS headless | 1 | 2 |

**Pembacaan jujur:** konsolidasi tidak mengubah beban muat secara berarti (selisih dalam derau pengukuran); manfaatnya pada kejelasan kode dan CSS yang lebih kecil, bukan kecepatan. FPS headless tanpa GPU (≈1–2) tidak mewakili FPS nyata di peramban Owner dan tidak boleh dipakai sebagai angka performa 3D; FPS/memori 3D nyata hanya bisa diukur di peramban Owner (`scripts/ukur-performa.mjs`, mode kualitas).

**Hasil optimasi dipertahankan:** mode kualitas, ambien Ringan sebagai bawaan, dan larangan blur mahal di atas canvas tetap dijaga tesnya (`test/kualitas.test.js`, `test/ambien.test.js`, `test/performa.test.js`, ketiganya hijau pada suite penuh: 494 lolos, 0 gagal). Penggabungan CSS tidak menambah `backdrop-filter`.
