# Indeks dokumen RAIVERSE

Diperbarui 2026-11-19. Mulai dari dua peta ini, lalu buka sisanya hanya bila perlu.

## Mulai di sini (berlaku sekarang)

| Dokumen | Isi |
|---|---|
| [PETA-BACKEND.md](PETA-BACKEND.md) | Bagian backend, jalur satu permintaan, data, penjagaan, **keputusan versi resmi**, tabel konfigurasi |
| [PETA-OTAK.md](PETA-OTAK.md) | Siapa berpikir dan siapa mengerjakan, alat per peran, memori, skill, alur keputusan |
| [PETA-WEBSITE.md](PETA-WEBSITE.md) | Peta bagian depan (public/): layar, rute yang dipanggil. Dibuat sesi lain dari kode |

## Dokumen rinci yang berlaku (satu per bagian)

| Bagian | Dokumen | Catatan |
|---|---|---|
| Chat Engine (satu mesin obrolan) | [CHAT-ENGINE.md](CHAT-ENGINE.md) | Riwayat percakapan, router otomatis, rapat singkat, konfirmasi, rute `/api/chat/*`. Menggantikan pendekatan wizard Pemandu. |
| Perilaku obrolan (cara membalas, alat, mutu) | [PERILAKU-OBROLAN.md](PERILAKU-OBROLAN.md) | Satu prompt untuk semua yang berbicara, putaran alat, kompaksi, penyedia model, evaluasi mutu, dan batas kesetaraan dengan Claude. |
| Pemandu (wajah depan) | [PEMANDU-TITIK-SAMBUNG.md](PEMANDU-TITIK-SAMBUNG.md) (kontrak), [PEMANDU-ALUR-AWAM.md](PEMANDU-ALUR-AWAM.md) (rancangan induk) | Rancangan induk memuat wizard awal yang sudah diganti percakapan bebas; kontrak yang berlaku ada di titik sambung |
| Data dan migrasi | [MIGRASI-P1.md](MIGRASI-P1.md) | Peran tunggal, satu manajer per divisi |
| Mesin dan alat per peran | [MESIN-P2.md](MESIN-P2.md) | Pintu `buka_alat`, persetujuan, kuota. (`canDecide` yang disebut di sana sudah dihapus) |
| Keamanan publik | [KEAMANAN-P3.md](KEAMANAN-P3.md) | Login, enkripsi, batas laju, privasi |
| Skala dan penyimpanan | [SKALA-P7.md](SKALA-P7.md) | json / dual / sqlite, migrasi per ruang kerja |
| Pagar sinkronisasi | [PAGAR-SINKRONISASI.md](PAGAR-SINKRONISASI.md) | Cadangan dan tes invarian |
| Konsol admin | [KONSOL-ADMIN.md](KONSOL-ADMIN.md) | `/api/admin/*`, hanya pengelola |
| Saluran chat | [SALURAN-CHAT.md](SALURAN-CHAT.md) | Telegram dan Discord |
| Staf nyata (mesin native) | [STAF-NATIVE.md](STAF-NATIVE.md) | **Resmi untuk eksekusi staf** |
| Uji nyata dengan model asli, kontrak eksekusi, Kesehatan otak | [UJI-NYATA.md](UJI-NYATA.md) | Hasil terukur, cara mengulang, rekomendasi penyalaan bertahap |
| Staf: skema dan katalog | [ARSITEKTUR-STAF-N8N.md](ARSITEKTUR-STAF-N8N.md) | Skema spesifikasi dan katalog masih berlaku; bagian "dijalankan sebagai alur n8n" diganti STAF-NATIVE |
| Otomasi berulang | [N8N-OTOMASI.md](N8N-OTOMASI.md) | n8n hanya untuk jadwal dan pemicu luar |
| Skill dan memori mandiri | [SKILL-MEMORI-MANDIRI.md](SKILL-MEMORI-MANDIRI.md) | Skill buatan agen, selalu draf sampai disetujui |
| Browser agen | [BROWSER-MCP.md](BROWSER-MCP.md) | Chrome DevTools MCP |
| Google Drive dan login | [GOOGLE-DRIVE-DAN-LOGIN.md](GOOGLE-DRIVE-DAN-LOGIN.md) | |
| Suara | [SUARA-GENDER-AGEN.md](SUARA-GENDER-AGEN.md) | Bagian depan (beku) |
| Karakter 3D | [mascot-v4-2/README.md](mascot-v4-2/README.md), [BRIEF-KARAKTER-3D.md](BRIEF-KARAKTER-3D.md) | Bagian depan (beku). Verifikasi: `node docs/mascot-v4-2/verify-v42.mjs` |

## Bukti dan gambar (bukan petunjuk)

- `visual-review/`: catatan tinjauan visual per sesi dan tangkapan layar (bukti, bukan aturan).
- `platform/DOKUMEN-PLATFORM-RAIVERSE.md`: potret platform dengan 42 tangkapan layar untuk Codex. Potret waktu itu, bisa tertinggal.
- `gambar/`: aset gambar. `gambar/logo/` (logo RAYVERSE), `gambar/chat-gpt-assets/` (tangkapan layar dari ChatGPT), `gambar/artifacts/` (konsep UI, ikon, logo hasil eksplorasi 2026-11-18; dulu folder `artifacts/` di akar).
- `riset/`: bahan bacaan luar (Google OAuth, Drive API) yang dulu tergeletak di akar.
- `uji-nyata/`: keluaran skrip `scripts/uji-nyata.mjs` (jangan dipindah, skrip menulis ke sini).

## Arsip (`arsip/`, tidak berlaku lagi, disimpan sebagai sejarah)

| Dokumen | Alasan diarsipkan |
|---|---|
| [arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md](arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md) | Rencana fase P0-P7 yang sudah dijalankan. Bagian "staf = alur n8n" sudah diganti mesin native |
| [arsip/HANDOFF-SESI-BARU.md](arsip/HANDOFF-SESI-BARU.md) | Serah terima 2026-11-17, sebelum fase P0-P7 |
| [arsip/INSTRUKSI-SESI-RUNTIME-V4_2.md](arsip/INSTRUKSI-SESI-RUNTIME-V4_2.md) | Sudah diganti folder `mascot-v4-2/` |
| [arsip/V4_2-MASCOT-INTEGRATION.md](arsip/V4_2-MASCOT-INTEGRATION.md) | Sudah diganti folder `mascot-v4-2/` |
| [arsip/sesi-baru-orkestrator/](arsip/sesi-baru-orkestrator/00-MULAI-DI-SINI.md) | Paket serah terima sesi lama (port 4317, tes lama) |

## Aturan merawat dokumen

- Satu bagian satu dokumen. Dokumen baru wajib masuk tabel di atas.
- Dokumen yang tidak lagi benar dipindah ke `arsip/` (jangan dihapus) dan diberi baris di tabel arsip.
- Keputusan "mana yang resmi" hanya ditulis di `PETA-BACKEND.md` bagian 7.
