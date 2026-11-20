# Peta Otak RAIVERSE

Dibaca dalam 5 menit. Ditulis 2026-11-19, dari kode yang berjalan (bukan dari rencana). Peta bagian lain: `docs/PETA-BACKEND.md`.

## 1. Empat tingkat "otak"

```
 Owner
   │ bicara / ketik / Telegram
   ▼
 PEMANDU (wajah depan, bukan agen)   aturan dulu (tanpa token) → model kecil bila tak terduga
   │ "Kerjakan"
   ▼
 ASISTEN PRIBADI (PA)  ── 1 per Owner ── paham maksud, merencanakan, melapor
   │
   ├─ goal lintas divisi ─► MASTER ORKESTRATOR (1 per ruang kerja) ── memecah, memimpin rapat lintas divisi
   └─ urusan satu divisi ─► MANAJER DIVISI (22, satu per divisi) ── memecah ke stafnya
                               │
                               ▼
                           STAF (daun) ── mengerjakan; berkas dan angka nyata
```

Aturan: satu manajer per divisi (dijaga invarian). Master dan PA setara di bawah Owner.

## 2. Apa yang dilihat dan boleh dilakukan tiap tingkat

Sumber: `catalog.ROLE_BASE`, `catalog.TOOL_GROUPS`, `catalog.roleAllows`, `engine.visibleTools`. Angka diperiksa tes (staf < 8 alat, lainnya < 12).

| | Staf | Manajer | Master | PA |
|---|---|---|---|---|
| Alat selalu terlihat | `search_brain`, `web_search`, `calculate`, `request_approval`, `complete_task` | + `create_subtask`, `ask_colleague`, `convene_meeting` | + `company_status` | sama dengan master |
| Pintu `buka_alat` (satu kelompok per langkah, maks 4 per tugas) | catatan, web, tim, google, belajar, otomasi, browser* | semua staf + **kelola**, **mcp** | sama | sama; `create_division` hanya PA |
| Tool `staf` (jalankan staf nyata) | bila ia punya spesifikasi siap | ya, untuk stafnya | tidak | tidak (PA tidak punya staf) |
| Model | kecil/sedang ("worker") | besar ("lead") | besar | besar |
| Daftar orang di prompt | rekan divisi (maks 12) + manajernya | stafnya + manajer lain | semua manajer | semua manajer |

\* browser hanya untuk agen/divisi yang diizinkan Owner. Spesialis pengetahuan (divisi Knowledge & AI Ops) juga punya kelompok **otak** (merapikan Brain).

Ditegakkan dua kali oleh kode, bukan oleh "kepatuhan" model: saat menyusun daftar alat, dan saat alat dipanggil (`runTool` menolak "bukan untuk perannmu").

Tugas **rutin** dan **massal** tidak boleh membuat subtugas, rapat, jadwal, rekrut, atau divisi baru (`ROUTINE_BLOCK`, `MASS_BLOCK`), supaya tidak berlipat ganda sendiri.

## 3. Cara memutuskan (satu giliran kerja)

1. Tugas dibuat lewat satu gerbang (`createTask` → kuota harian). Yang menerima dipilih: PA untuk goal Owner; manajer/staf untuk tugas turunan.
2. Mesin kerja (`engine.tick`) mengambil tugas yang siap (`maxConcurrent` 3 per ruang kerja).
3. Agen membaca: tugas + hasil tahap sebelumnya + 3 catatan Brain paling relevan + memori kerjanya.
4. Maksimal 10 giliran (rutin 5, massal 6). Tiap giliran: model memilih alat. Giliran terakhir hanya boleh `complete_task`.
5. Bila anggaran tugas habis, agen diminta merangkum dengan yang ada.
6. Selesai = `complete_task` dengan **bukti** (catatan terverifikasi, URL, receipt) dan **yang belum terpenuhi**. Tanpa bukti = ditandai asumsi.
7. Hasil goal dari Owner selalu masuk kartu review ("Butuh kamu"); kebijakan sensitif (uang, kontrak, HR, data pribadi, publikasi) lewat `request_approval`. Review, otomasi, dan aksi browser **tidak pernah** disetujui otomatis.
8. Manajer yang mendelegasikan menunggu hasil subtugas, lalu menyintesis (tidak boleh mendelegasi lagi).

Pemilihan model oleh `governor.modelTier`: obrolan/rapat/rutin = kecil; PA, master, manajer, sintesis, goal = besar; selain itu = pekerja.
Urutan alat yang disarankan ("satu pintu kecil"): Brain → `web_search` → `visit_url` → `buka_browser` → staf → sambungan luar.

## 4. Memori, skill, kemampuan

| Hal | Apa | Di mana | Siapa yang boleh mengubah |
|---|---|---|---|
| **Brain** | Catatan Markdown bertautan `[[...]]`. Tanda kepercayaan: *Owner*, *Drive*, *Sistem* = fakta; *hasil agen* = draf | `brain.js`, `data` ruang kerja | Owner mengedit (jadi terverifikasi); agen menulis draf (`write_note`) |
| **Aturan sistem** | SOP alur kerja, aturan kejujuran, kerahasiaan, status data | `sop.js` (catatan folder "Sistem") | Kode saja |
| **Memori kecil** | Catatan agen (±2.200 huruf) dan profil pengguna (±1.375), disimpan sebagai catatan Brain "Memori <nama>" | `memory-lite.js` | Agen mengusulkan lewat alat `memory`; menunggu persetujuan pengguna (kecuali catatan kerjanya sendiri, bisa dibatalkan) |
| **Skill (pustaka)** | Cara kerja bernama; prompt hanya memuat daftar relevan (maks 12), isi penuh lewat `skill_view` | `catalog.SEED_SKILLS`, `skills-power.js`, `staff/skills.js` | Owner dan sistem |
| **Skill buatan agen** | Usulan `skill_manage`; selalu draf; tidak punya jalur memberi izin alat; "uji coba" sampai terbukti 3 kali | `skills-learn.js`, `data/skills-agen/` | Owner menyetujui lewat kartu "Aku belajar sesuatu" |
| **Kemampuan staf** | Spesifikasi kerja nyata (langkah, isian, keluaran, langkah "otak") | `staff-catalog/<divisi>/<kunci>.json`, dijalankan `staff/native.js` | Penulis katalog; lolos validator dan tes ekuivalensi |
| **Riwayat** | Pencarian percakapan/tugas lama tanpa merangkum ulang | `session-search.js` (alat `session_search`) | Otomatis |

Staf nyata "berpikir" lewat langkah **otak**: aturan menghitung kerangka dan angka; model kecil hanya mengisi pembahasan; jawaban diperiksa skema, dan bila tidak sah dipakai **cadangan aturan**. Email, telepon, dan deret angka panjang disamarkan sebelum ke model. Jatah staf native: 2.000 jalan dan 200 panggilan AI per hari per ruang kerja.

## 5. Prompt sistem: hasil pemeriksaan (2026-11-19)

Prompt dirakit di `engine.systemPrompt` (kerja) dan `engine.chatSystem` (obrolan, tanpa daftar alat).
- Tidak ada rujukan ke daftar semua agen, "karyawan AI otonom", atau id yang tak ada di roster (dijaga INV11b); alat per peran di tabel bagian 2 dijaga INV6a, INV6b, dan INV15f.
- Struktur yang disebut: "asisten pribadi dan master → manajer divisi → staf". Sesuai kode.
- Obrolan menyebut tool `create_task`: benar, alat itu memang hanya ada di jalur obrolan (`replyAs`).
- Bagian staf (`staff.promptSection`) milik sesi staf; tidak disentuh.
- Tidak ditemukan kontradiksi yang jelas salah, jadi tidak ada teks prompt yang diubah.

## 6. Yang belum terbukti (jujur)

- Belum ada uji dengan model sungguhan yang menilai apakah model kecil memakai `buka_alat` dengan baik; tes memeriksa daftar alat dan penolakan, bukan mutu bahasa.
- Staf nyata diuji dengan model tiruan (216 dari 216 lulus bentuk); kualitas bahasa model asli belum dinilai.
