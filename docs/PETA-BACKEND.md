# Peta Backend RAIVERSE

Dibaca dalam 5 menit. Ditulis 2026-11-19. Bagian depan (kantor 3D, suara, tampilan) dianggap selesai dan tidak dibahas di sini.
Peta isi kepala AI: `docs/PETA-OTAK.md`. Daftar semua dokumen: `docs/README.md`.

## 1. Sistem ini apa, dalam satu kalimat

Satu server Node (`server/index.js`) yang menerima permintaan, menyuruh "orang AI" berpikir dan bekerja, menyimpan hasilnya, dan menjaga agar aman dan hemat.

## 2. Bagian-bagiannya (per tugas)

| Tugas | Berkas (nama pendek; folder di bagian 9) | Fungsinya |
|---|---|---|
| **Pintu masuk** | `index.js` | Terima permintaan web (REST + siaran langsung), lalu sajikan halaman. Satu-satunya tempat rute dipasang. |
| **Hapus banyak hasil** | `hapus-banyak.js` | Mode "Pilih" di Hasil Saya: hapus beberapa pekerjaan sekaligus, per item; yang berjalan atau menunggu persetujuan dilewati; anggota hanya miliknya. |
| **Pengaturan** | `config.js` | Semua variabel .env dan pengaturan ruang kerja: bawaan, arti, validasi. |
| **Chat Engine (wajah depan)** | `chat-engine.js`, `chat-router.js`, `chat-sources.js`, `chat-staf.js`, `pemandu-chat.js`, `pemandu.js`, `kamus.js`, `chat-kontak.js` (halaman Pesan: kontak dan utas), `otak/perilaku-obrolan.js` (prompt tunggal), `otak/penyedia-chat.js` (tingkat model), `otak/evaluasi-obrolan.js` (rubrik mutu) | Satu mesin obrolan: riwayat, router otomatis, rapat singkat, usulan kerja dengan konfirmasi. Kata teknis dilarang (kamus). Lihat docs/CHAT-ENGINE.md. |
| **Saluran chat** | `channels/*` | Telegram dan Discord. Menerjemahkan pesan luar menjadi giliran Pemandu yang sama. |
| **Mesin kerja** | `engine.js` | Antrean tugas, giliran AI, delegasi, review, rutinitas, chat, rapat. Inti sistem. |
| **Otak AI** | `llm.js`, `governor.js`, `catalog.js` | Memanggil model (Groq/Claude/simulasi), anggaran, pilihan model, daftar alat per peran. |
| **Pengetahuan** | `brain.js`, `knowledge/*`, `librarian.js`, `sop.js`, `memory-lite.js`, `session-search.js` | Catatan Brain, perpustakaan, aturan sistem, memori kecil, pencarian riwayat. |
| **Skill** | `catalog.js` (+`skills-extra/deep/power.js`, `roster-studio.js`), `skills-learn.js`, `staff/skills.js` | Lihat bagian 6. |
| **Organisasi** | `org.js`, `org-rules.js`, `roster.js`, `roster-extra.js`, `roster-teams.js`, `roster-studio.js`, `seed.js`, `workspace.js` | Divisi, orang, peran; seed awal; ruang kerja baru. |
| **Staf nyata** | `staff/*`, `staff-catalog/*` | 216 staf yang benar-benar menghasilkan berkas/angka. Dikerjakan sesi lain; jangan dipindah. |
| **Otomasi berulang** | `n8n.js`, `n8n-templates/*` | Otomasi jadwal/pemicu luar lewat n8n, dibuat Pemandu dengan konfirmasi. |
| **Persetujuan** | `approvals.js` | Satu-satunya yang membuat/memutuskan kartu persetujuan. |
| **Keamanan** | `auth.js`, `secure.js`, `limits.js`, `gate.js`, `privacy.js`, `platform.js` | Login Google, enkripsi, batas laju dan kuota, gerbang AI n8n, hapus/ekspor data, pengaturan pengelola. |
| **Performa HTTP** | `http-perf.js` | Kompresi brotli/gzip, ETag + 304, cache berkas statis di memori; dipakai `index.js` untuk statis dan JSON. |
| **Admin** | `admin.js` | Konsol pengelola `/api/admin/*` (hanya pengelola platform). |
| **Penyimpanan** | `store.js`, `store-sqlite.js` | Basis data satu proses, siaran perubahan, mode json/dual/sqlite. |
| **Kolaborasi** | `collab.js` | Rapat multi-agen, konsultasi, MCP luar. |
| **Integrasi** | `browser.js`, `gdrive.js`, `tts-edge.js`, `studio.js` | Browser agen, Google Drive, suara server, pembuat agen. |

## 3. Jalur satu permintaan

```
Beranda (ketik)  ──┐
Telegram/Discord ──┴─► Pemandu.turn  (L0 aturan tanpa token → L1 model kecil bila tak terduga)
                          │ "Kerjakan"
                          ▼
              engine.submitGoal ─► engine.createTask ─► governor.checkCreate (kuota harian, satu gerbang)
                          │
                          ▼  tugas masuk antrean, mesin kerja (tick) mengambilnya
          PA (asisten pribadi) berpikir ── goal lintas divisi → Master ── satu divisi → Manajer
                          │                                        │
                          │                    Manajer memecah: create_subtask ke staf, atau tool `staf`
                          ▼                                        ▼
              Staf (daun): AI kecil dengan 7 alat      ATAU    staf nyata (staff/native.js): langkah pasti,
              (cari Brain, web, hitung, minta setuju)           berkas CSV/teks/HTML, langkah "otak" model kecil
                          │                                        │
                          └──────────► finishTask: bukti + "belum terpenuhi" ──► kartu review/persetujuan (approvals)
                                                   │
                                                   ▼
                       hasil → Brain, utas goal, siaran langsung ke layar, balasan Pemandu / Telegram
```

Rute lain yang berakhir di mesin yang sama: `/api/goals`, `/api/orchestrate`, `/api/tasks`, `/api/messages` (layar lama). Semuanya lewat `createTask` dan satu gerbang kuota.

## 4. Siapa berpikir, siapa mengerjakan

| Peran | Berpikir? | Mengerjakan? |
|---|---|---|
| Asisten pribadi (PA) | Ya: paham maksud, rencana | Tidak langsung: menyerahkan ke master/manajer |
| Master | Ya: memecah goal lintas divisi, rapat | Tidak langsung |
| Manajer divisi (22) | Ya: memecah ke staf | Memanggil staf (`create_subtask`, tool `staf`) |
| Staf (daun) | Sedikit: model kecil dengan 7 alat | **Ya**: staf nyata menghasilkan berkas dan angka di mesin native |
| n8n | Tidak | Hanya jadwal dan pemicu dari luar |

Detail alat per peran: `docs/PETA-OTAK.md`.

## 5. Di mana data disimpan (semua di `data/`, kecuali dicatat)

| Isi | Tempat |
|---|---|
| Kantor utama | `data/db.json` (atau SQLite bila dimigrasi) |
| Ruang kerja lain | `data/ws/<id>/db.json` atau `.sqlite` |
| Akun, sesi, token Google (terenkripsi) | `data/auth.json` |
| Batas laju dan kuota | `data/limits.json` |
| Pengaturan pengelola, log audit | `data/admin.json` |
| Telegram/Discord | `data/channels.json` |
| Otomasi n8n | `data/otomasi.json` |
| Staf: jalan, berkas hasil, alur terpasang | `data/staff-runs.json`, `data/staff-out/`, `data/staff-deploy.json` |
| Skill buatan agen | `data/skills-agen/<ruang kerja>/` |
| Gambar obrolan, contoh latih, indeks riwayat | `data/uploads/`, `data/training/`, `data/sesi/` |
| Ruang kerja yang dihapus (7 hari) | `data/trash/` |
| Cadangan | `data/backups/` (`npm run data:backup`) |
| Katalog staf (kode, bukan data) | `server/staff-catalog/` |

## 6. Yang dijaga, dan oleh siapa

| Dijaga | Penjaga |
|---|---|
| Spam dan beban | `limits.edge` (per IP) dan `limits.user` (per akun, kuota harian, anggaran global) |
| Login dan ruang kerja | `auth.js`: begitu login Google dipasang, tanpa sesi valid tidak ada data; anggota hanya melihat ruang kerjanya |
| Rahasia | `secure.js`: kunci AI dan token terenkripsi di disk; tidak pernah dikirim ke klien |
| Biaya | `governor.js`: anggaran per ruang kerja, kuota tugas per hari, pilihan model termurah yang cukup |
| Apa yang boleh dilihat agen | `catalog.roleAllows`: staf tidak melihat `recruit_agent` dll. (ditegakkan di daftar alat dan saat dipanggil) |
| Persetujuan manusia | `approvals.js`: review, otomasi, dan aksi browser **tidak pernah** disetujui otomatis |
| Aksi berdampak keluar | Pemandu berhenti di kartu konfirmasi; browser agen punya pagar domain/kata sandi/pembayaran |
| Panggilan n8n ke AI | `gate.js`: token pendek per eksekusi; kunci AI tidak pernah ada di n8n |
| Isi web/halaman | dianggap data, bukan perintah (`browser.js`, prompt) |
| Privasi | `privacy.js`: ekspor dan hapus akun, retensi pesan |
| Pengelola | `admin.js`: bukan pengelola mendapat 403 seragam |

## 7. VERSI YANG TERCAMPUR: keputusan tegas

| # | Yang bercabang | RESMI (pakai ini) | Usang / tidak dipakai | Tindakan sekarang |
|---|---|---|---|---|
| 1 | **Penyimpanan** json / dual / sqlite | **json** sampai Owner menjalankan migrasi per ruang kerja. **sqlite** adalah tujuan akhir (skala). | **dual** hanya masa transisi sementara, bukan mode tetap | Tidak ada yang dihapus. Pilihan hidup di `data/storage-flags.json` atau `STORAGE_MODE` (dicatat di `config.js`). |
| 2 | **Mesin staf** native / n8n | **native** (`staff/native.js`) | Jalur n8n staf (`blueprint`, `deployer`, `hook`, `simulate`) tinggal untuk spesifikasi bertanda `needsN8n` (kini 0) dan tes ekuivalensi | Dibiarkan (milik sesi staf). Dicatat di `config.js`. Hapus bila Owner setuju. |
| 3 | **Bendera `staffModel`** | `staffEngine` = native | `staffModel` (bendera P0 "staf = alur n8n"): tidak lagi mengubah eksekusi | Tetap ada (tes, konsol, data lama). Ditandai usang di `config.SETTINGS`. |
| 4 | **Agen `legacy`** | Agen di seed/katalog | 42 agen buatan asisten pribadi di data Owner (`legacy: true`, peran `extra`) | Dipertahankan, tidak diubah, tidak di katalog. Keputusan Owner 2026-11-18. |
| 5 | **Pembuat tugas** | `engine.createTask` (satu gerbang kuota). Pintu depan: **Pemandu**. | `/api/goals`, `/api/orchestrate`, `/api/tasks` dipakai layar lama; jangan dipakai jalur baru | Semua sudah lewat gerbang yang sama. Tidak ada yang dihapus (layar depan beku). |
| 6 | **Skill** di banyak berkas | Pustaka dasar = `catalog.SEED_SKILLS` (disusun dari `skills-extra`, `skills-deep`, `roster-studio`); paket `skills-power` dipasang idempoten; satu skill per staf (`staff/skills.js`); skill buatan agen (`skills-learn`) selalu draf sampai disetujui | Tidak ada duplikat isi; hanya sebaran berkas | Dibiarkan; dicatat. Langkah berikut: kumpulkan ke folder `skills/`. |
| 7 | **Daftar orang** (roster) | `roster.js` + `roster-extra.js`, `roster-teams.js`, `roster-studio.js` = kerangka 128 AI di 22 divisi (seed). `staff-catalog` = 216 spesifikasi kerja nyata. Id sama (satu id = satu karakter). | — | Dibiarkan. |
| 8 | **Templat n8n vs kemampuan staf** | Templat (`n8n-templates`) = otomasi **berulang** buatan Pemandu. Staf = pekerjaan **sekali jalan**. | — | Berbeda tugas, keduanya resmi. |
| 9 | **Persetujuan** | `approvals.js` saja (dijaga INV8) | Tidak ada lagi jalur sendiri | Selesai (P2). `canDecide` yang tak dipanggil siapa pun dihapus. |
| 10 | **Pemandu lama** | Percakapan bebas dengan tombol; `confirm` khusus aksi berdampak | Wizard "kartu rencana tiga opsi"; `kind: "plan"` masih sah di kontrak tapi tidak dikirim | Dokumen rancangan awal diarsipkan; kontrak tidak diubah (layar depan beku). |
| 11 | **Hook otomasi lama** tanpa tanda tangan | Hook bertanda tangan + cap waktu | Alamat lama: ditolak 410 setelah `OTOMASI_LEGACY_HOOK_UNTIL` | Dibiarkan sampai batas waktu. |
| 12 | **Kunci AI** di 3 tempat | Konsol admin (`platform`) | Kunci per ruang kerja (`settings.apiKey`) dan `.env` hanya cadangan | Urutan baca di `llm.js`: ruang kerja → konsol → .env. Tidak diubah. |
| 13 | **Setelan lama** | — | `settings.mode`, `progressiveSkills=false` | Tidak dibaca/jarang; ditandai usang di `config.SETTINGS`. |
| 14 | **Dokumen bertumpuk** | `docs/README.md` menunjuk yang berlaku | Rencana lama dan serah-terima lama | Dipindah ke `docs/arsip/` (tidak dihapus). |

Kode mati yang terbukti tak dipanggil di seluruh repo (cari di server, skrip, tes, klien) dan sudah dihapus: `approvals.canDecide`, `channels/state.saveLink`, `limits.lifetimeCount`, `org-rules.roleFromFlags`, `platform.limitOverrides`, `store.isAI`.
Rute yang tidak dipanggil klien tapi sengaja dibiarkan karena publik: `POST /api/drive/push` (API Drive), `GET /api/brain/audit`, `GET /api/capabilities` (alat admin).

## 8. Konfigurasi (satu tempat: `server/config.js`)

Nilai dibaca langsung dari `.env`/lingkungan tiap dipakai. Setiap variabel di `server/` WAJIB terdaftar di `config.ENV_KEYS` (dijaga tes `INV15a`-`INV15c`). Pembacaan baru: `config.get('NAMA')`, `config.dataDir()`. Pengaturan per ruang kerja ada di `config.SETTINGS` (dengan status resmi/usang). Daftar lengkap bertipe: `node -e "import('./server/config.js').then(c=>console.table(c.table()))"` (rahasia tidak dicetak).

| Kelompok | Variabel penting (bawaan) |
|---|---|
| Inti | `PORT` (4317), `HOST` (127.0.0.1), `DATA_DIR` (folder `data`), `RAIVERSE_PUBLIC_URL`, `RAIVERSE_PUBLIC_MODE` (0), `TRUST_PROXY` (0) |
| Penyimpanan | `STORAGE_MODE` (json), `STORE_LAZY` (0), `STORE_IDLE_MS` (600000), `STORE_VERIFY_EVERY` (50), `STORE_TASK_LOG_CAP` (300) |
| AI | `GROQ_API_KEY`, `ANTHROPIC_API_KEY` (rahasia), `GATE_TTL_MS` (120000) |
| Login | `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `TOKEN_ENC_KEY` (keempatnya sekaligus), `RAIVERSE_ADMIN_EMAILS`, `RAIVERSE_SIGNUP` (terbuka) |
| Batas | `RATE_*_PER_MIN`, `QUOTA_*_DAY`, `GLOBAL_DAILY_BUDGET_USD` (0 lokal / 25 publik) |
| Privasi | `PRIVACY_TRASH_DAYS` (7), `RETENTION_EVENT_DAYS` (90), `RETENTION_MESSAGE_DAYS` (365) |
| Otomasi | `N8N_URL` (127.0.0.1:5678), `N8N_API_KEY`, `WAHA_*`, `OTOMASI_POLL_MS` (60000) |
| Staf | `RAIVERSE_STAFF_ENGINE` (native), `STAFF_*_DIR/FILE` |

Pengaturan per ruang kerja yang paling berpengaruh: `provider` (auto), `dailyBudgetUSD` (5), `quota` (300 tugas, 100 eksekusi n8n per hari), `autonomy` (nyala), `autoApprove` (nyala; review/otomasi/browser tetap manual), `maxConcurrent` (3), `staffEngine` (native).

## 9. Susunan folder `server/` (sudah dirapikan 2026-11-19)

```
server/
  index.js  config.js  engine.js  pemandu.js  collab.js  approvals.js  governor.js  kamus.js   ← INTI (di akar)
  penyimpanan/   store.js  store-sqlite.js
  keamanan/      auth.js  secure.js  limits.js  gate.js  privacy.js
  admin/         admin.js  platform.js
  otak/          llm.js  catalog.js   (governor.js tetap di akar: skrip verifikasi mascot membacanya di sana)
  pengetahuan/   brain.js  librarian.js  sop.js  memory-lite.js  session-search.js
                 skills-learn.js  skills-power.js  skills-extra.js  skills-deep.js
  organisasi/    org.js  org-rules.js  roster.js  roster-extra.js  roster-teams.js  roster-studio.js
                 seed.js  workspace.js  studio.js
  integrasi/     browser.js  gdrive.js  tts-edge.js (+ tts_edge.py)  n8n.js
  staff/  staff-catalog/    ← staf nyata (tidak dipindah, sudah satu folder)
  channels/               ← Telegram dan Discord (sudah satu folder)
  knowledge/  n8n-templates/
```

Cara aman: setiap berkas yang pindah meninggalkan **berkas peneruskan** di tempat lama (satu baris `export * from './folder/nama.js'`), jadi `import '../server/store.js'` di tes, skrip, `staff/`, dan `channels/` tetap bekerja tanpa diubah. Impor di akar, folder baru, `knowledge/`, dan `n8n-templates/` sudah menunjuk langsung ke lokasi baru. Modul yang sama dimuat sekali (tidak ada salinan ganda).
Menambah modul baru: taruh langsung di folder tugasnya dan impor lewat jalur barunya; jangan menambah berkas peneruskan baru.
Langkah berikut (opsional): alihkan impor `staff/`, `channels/`, tes, dan skrip ke jalur baru, lalu hapus berkas peneruskan.

## 10. Cara menjaga agar tidak campur lagi

- `npm run check:invariants` dan `node --test test/*.test.js`: tes arsitektur (satu gerbang tugas, satu modul persetujuan, alat per peran, semua env terdaftar di `config.js`, dokumen utama ada).
- Menambah variabel .env: daftarkan di `config.ENV_KEYS` dulu.
- Menambah pembuat tugas: lewat `engine.createTask`; jangan `store.upsert('tasks', ...)` baru.
- Menambah kartu persetujuan: lewat `approvals.create`.
