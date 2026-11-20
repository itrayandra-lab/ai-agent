# Audit konsolidasi (2026-11-20)

Metode: `node scripts/inventaris.mjs` (baca-saja; keluaran terbaru di `INVENTARIS.txt`, `--json` untuk mesin) memindai berkas JS/CSS, impor, rute API (definisi vs pemanggil), id DOM, selektor CSS, `!important`, modul tanpa pemanggil. Bukti perilaku gaya: `scripts/snapshot-gaya.mjs` (rekam gaya komputasi semua elemen UI Kantor pada 5 ukuran × 14 keadaan, bandingkan sebelum/sesudah). Penilaian 47 temuan: `NILAI-47-TEMUAN.md` (diperiksa subagen baca-saja terhadap kode terkini, dengan file:baris).

## 1. Peta alur pesan end-to-end (dari kode, bukan dari rencana)

```
Komposer (dock #odock di 3D / panel Obrolan #dashboard / utas Pesan)  — public/js/obrolan-view.js + komposer-core.js
   │ POST /api/chat/conversations/:id/stream|send   (target eksplisit = chip; fokus 3D = b.fokus)
   ▼
server/chat-engine.js  turn()  ◄── pemandu.turn() lewat setFront  ◄── Telegram/Discord (channels/core.js), /api/pemandu/turn, /api/orchestrate (bawaan)
   │  urutan penerima: chip eksplisit > nama disebut > fokus 3D > topik/peran > peserta yang sudah diajak > aray
   ▼
 agen penjawab (persona + model)  ATAU  aray (kembaran digital; koordinasi/delegasi)
   │  pekerjaan nyata: kartu konfirmasi dipaksa di kode (wantsWork → proposeWork; startWork menolak tanpa tombol "Ya, kerjakan"; staf berdampak: confirmed hanya dari tombol, kini juga cek canAutomate)
   ▼
 eksekusi staf native (chat-staf.js → staff runner)  →  laporan agen → aray → Owner
   ▼
 Hasil Saya (tasks) / Catatan (brain) / Kabar (/api/chat/laporan, /api/chat/kabar)
```
Jalur yang BEDA dan sengaja dipertahankan: `/api/messages` (+`engine.onHumanMessage`) untuk kanal/utas pekerjaan di halaman Pesan dan rapat langsung; `/api/orchestrate` hanya jalur kompatibel (kanal, `to`, gambar, rapat) — selain itu adaptor tipis ke `chatEngine.turn`.

## 2. Temuan inventaris dan keputusan

| Butir | Bukti | Keputusan | Alasan |
|---|---|---|---|
| 12 berkas peneruskan satu baris di akar `server/` (admin, gdrive, librarian, roster*, skills-*, sop, studio, tts-edge) | `serverTanpaPemanggil` = 12, tidak diimpor server/tes/skrip | **Arsipkan** ke `_arsip-kode/` (DAFTAR.md) | Sisa pemindahan folder, tak ada pemanggil; dijaga tes `konsolidasi.test.js` |
| 21 peneruskan lain di akar `server/` (auth, store, org, …) | punya pemanggil | **Pertahankan** | Masih diimpor; memindahkan semua pemanggil di luar cakupan aman |
| `office-layout.css` v4…v12 ditumpuk | 8 penanda versi, 436 baris | **Gabung** (`scripts/gabung-css.mjs`): selektor sama dilebur, penanda versi dibuang, 43.574 → 40.539 B | Terbukti setara lewat snapshot gaya (lihat §4) |
| `!important` (app 33, glass-global 22, identity 16, office-layout 56, hemat 7, float-nav 6, glass 1) | inventaris | **Pertahankan** | Percobaan membuang semua `!important` di office-layout mengubah 913 elemen-keadaan (dock, kontrol); tak aman tanpa mata Owner. Tidak berkurang berarti (57→56). |
| Selektor didefinisikan di banyak berkas CSS (393 selektor; `.topbar`, `.sidebar`, `.btn` … di app/glass/identity) | inventaris | **Dicatat, belum digabung** | Lapisan app→glass→identity→office adalah arsitektur token Owner (identity = lapisan identitas final); menyatukan semuanya = risiko visual tanpa verifikasi mata |
| `obrolan.css`, `pesan.css` tak ada di index.html | dimuat malas oleh obrolan-view.js / pesan-view.js | **Pertahankan** | Bukan yatim; pemuatan malas menghemat awal |
| 15 rute tanpa pemanggil (`/api/pemandu/turn|home`, `/api/percakapan`, `/api/chat/kabar`, `/api/drive/setup|push|pull`, `/api/automations/*`, `/api/belajar/*`, `/api/capabilities`, `/api/brain/audit`, `POST /api/channels`) | `ruteYatim` | **Pertahankan** | Adaptor kompatibel (pemandu/turn → Chat Engine lewat `setFront`), dipakai Telegram/skrip/tes/integrasi di luar `public/`. Menghapus = memutus pemanggil eksternal. |
| id `drres` dibuat di dua berkas JS | `idDibuatDiBanyakBerkas` | **Pertahankan** | Dua halaman berbeda (Pengaturan lama vs views.js), tak pernah aktif bersamaan |
| id ganda di index.html | 0 | — | bersih |
| Sora vs aray | `paOf()` = `isMaster` (aray) lebih dulu; `soraSays` hanya nama fungsi, pembicaranya `pa()` = aray; id agen Sora di data tidak diubah | **Pertahankan** | Aray sudah penerima default dan pembicara pesan sistem |

## 3. Penilaian 47 temuan PETA-HALAMAN-LENGKAP (ringkas)
NYATA 29 · SEBAGIAN 12 · SUDAH BERES 0 · TAK TERVERIFIKASI 6 (rinci di `NILAI-47-temuan`). Diperbaiki di sesi ini (kode + tes `konsolidasi.test.js`): T-06 (loadState cek `r.ok`), T-07 (staf berdampak tolak bila `canAutomate=false`), T-08 (subjudul Pengaturan tanpa hitungan keliru), T-09 (teks WhatsApp tak lagi bertentangan), T-11 (konfirmasi sebelum Rapikan catatan), T-22 (selektor `.ob-keping`), T-45 ("Hasil Saya" seragam). Sisanya tetap terbuka dan tercatat; yang menyangkut 3D (T-03, T-04 mengunci pointer) sengaja tidak disentuh (aturan keras: gerak/kamera 3D tetap).

## 4. Bukti setara CSS
Rekam awal 2 kali (derau: tinggi panel Obrolan/lebar baris ruangan berubah acak antar-rekaman, ±2–30 elemen dari ±52.000) lalu rekam setelah penggabungan: tema gelap 16 dan 82 beda (di keadaan berbeda tiap kali = derau, bukan selisih tetap), tema terang 57 (derau yang sama). Memakai posisi "kemunculan pertama" (posisi "terakhir" menghasilkan 84 beda tetap di dock 820 px, ditolak).
