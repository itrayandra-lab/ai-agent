# RAIVERSE AGENT — Dokumen Platform Lengkap (untuk serah-terima ke Codex)

Dibuat 2026-11-18 dari kode di cabang `feat/orchestrator-v42-world` (commit `384ba2a`) dan dari data nyata Owner yang dijalankan di salinan uji. Semua gambar ada di [screenshots/](screenshots/) (42 file) dan ditautkan di dokumen ini.

> **Tujuan dokumen:** Codex akan mengganti **UI, UX, "otak", dan backend**, dengan **prioritas tertinggi pada tampilan Otak (Company Brain)**. Dokumen ini menjelaskan apa yang ada sekarang, apa yang rusak/lemah, apa yang HARUS dipertahankan, dan apa yang diminta berubah. Bagian 9 (Otak) adalah inti permintaan.

---

## 0. Cara membaca & ringkasan 1 menit

| Pertanyaan | Jawaban singkat |
|---|---|
| Apa produknya? | Sistem operasi perusahaan berisi **±171 karyawan AI** (22 divisi) + 1 manusia (Owner). Owner memberi perintah lewat satu kotak chat; agen bekerja, berdiskusi, rapat, menulis ke "Brain" (pengetahuan), dan minta persetujuan. Ada **kantor 3D** yang menampilkan agen bekerja. |
| Untuk siapa? | Publik Indonesia yang ingin **instan, mudah, simpel** (pengguna "malas"). UI Bahasa Indonesia informal. |
| Stack | Node.js (v26, ESM) tanpa framework, DB satu file JSON, klien JavaScript vanilla (tanpa bundler), Three.js 0.187 untuk 3D, LLM: Groq (utama) atau Anthropic, mode simulasi bila tanpa kunci. |
| Ukuran kode | `server/` ±5.000 baris, `public/js/` ±8.500 baris (office3d.js 3.305, views.js 1.700), CSS ±1.350 baris. |
| Yang "otak" | Dua arti: **(A) Company Brain** = basis pengetahuan Markdown + graph + UI-nya (halaman *Brain*); **(B) Otak agen** = `server/engine.js` (orkestrator, tugas, prompt, tool, governor). Permintaan "tampilan otak" = **A**. |
| Kondisi data uji | 171 karyawan, 22 divisi, 61 catatan Brain (48 Google Drive, 4 sistem, 8 draf agen, 1 Owner), 341 tugas (semua selesai), 29 goal, 160 channel, 1.610 pesan, 29 rapat, 82 rutinitas, 128 skill, 33 persetujuan. Biaya total tercatat ±$2,50. |

**Peringatan keamanan untuk Codex:** jangan pernah meng-commit `docs/client_secret_*.json` (rahasia OAuth Google; sudah di `.gitignore`), `.env`, `data/`. Tidak ada kunci API di dokumen ini.

---

## 1. Visi, pengguna, prinsip produk

1. **Pengguna:** orang Indonesia dengan tingkat "kemalasan" tinggi: tidak mau membaca, tidak mau menyetel, mau langsung jadi. Karena itu: satu kotak "Mau dikerjakan apa hari ini?", sedikit tombol, daftar panjang dilipat (akordeon), bagian kosong disembunyikan.
2. **Owner (pemilik produk)** adalah kritikus tampilan tingkat tinggi: ingin tampilan *glassmorphism* ala inZOI, tenang, sinematik, tidak berkedip, tidak berantakan, dan **sangat ringan di PC lemah** (CPU/memori). Selalu minta jujur: sebutkan apa yang diuji dan belum.
3. **Prinsip jujur-data (penting untuk Otak):** fakta perusahaan hanya dari sumber terverifikasi (Owner, Google Drive, Sistem). Hasil agen = *draf* (bukan fakta). Catatan demo diarsipkan keluar dari Brain. Lihat bagian 9.
4. **Hemat token:** sapaan/status/progres dijawab dari database tanpa LLM; pertanyaan biasa memakai model kecil; hanya pekerjaan berat memakai model besar.
5. **Bahasa:** semua teks UI Bahasa Indonesia santai.

---

## 2. Arsitektur sistem

```
Browser (vanilla JS, ES modules, tanpa bundler)
   │  fetch /api/*  ── REST JSON
   │  EventSource /api/stream ── realtime (upsert/remove/root/reload)
   ▼
server/index.js (http.createServer, tanpa Express)
   ├─ auth.js        login Google, sesi, workspace aktif, undangan
   ├─ store.js       DB JSON per-workspace + siaran perubahan + migrasi
   ├─ engine.js      otak agen: tick, tugas, goal, orkestrasi, chat, tool
   ├─ collab.js      rapat, tanya-rekan, refleksi, cron, MCP, Google Workspace, kunjungi URL
   ├─ llm.js         Groq/Anthropic/simulasi, harga, anggaran, router model
   ├─ governor.js    batas tugas buatan AI, anggaran per goal, tingkat model, cache
   ├─ brain.js       catatan + wikilink + pencarian kata kunci + kepercayaan
   ├─ librarian.js   klasifikasi/rapikan/gabung catatan, dataset latihan
   ├─ gdrive.js      sinkron Google Drive ⇄ Brain
   ├─ sop.js         catatan sistem (SOP, aturan kejujuran) — satu-satunya "fakta sejak hari 1"
   ├─ workspace.js   cetak biru ruang kerja baru (tim inti kecil)
   ├─ org.js, catalog.js, roster*.js, seed.js, studio.js, knowledge/*  (organisasi, skill, tool, data awal)
data/db.json (workspace "main"), data/ws/<id>/db.json, data/auth.json, data/training/*.jsonl, data/*.log
```

- **Menjalankan:** `npm start` (port 4317, host 127.0.0.1; `PORT`, `HOST` bisa diubah). Kunci: `.env` berisi `GROQ_API_KEY` / `ANTHROPIC_API_KEY` (opsional). Tanpa kunci → log "Mesin AI: SIMULASI".
- **Tes:** `node --test` (10 lolos), `node docs/mascot-v4-2/verify-v42.mjs` (109 cek untuk 3D/karakter).
- **Satu proses, satu thread.** Penyimpanan debounced ke file JSON. Tiap workspace punya file DB sendiri; konteks workspace dibawa lewat `AsyncLocalStorage` sehingga `store.get()` selalu benar tanpa mengoper id.
- **Realtime:** `GET /api/stream` (Server-Sent Events). Pesan: `{kind:'upsert', coll, item}`, `{kind:'remove', coll, id}`, `{kind:'root', key, value}`, `{kind:'reload'}`. Setiap 5 dtk siaran `root:host` (CPU/mem/disk/uptime). Klien `core.js` menerapkan ke `S.data` lalu `notify()` memanggil `view.update(colls)` (dibatching dengan `requestAnimationFrame`).
- **Penting:** `GET /api/state` mengirim **seluruh database** (karyawan, catatan lengkap, 1.600+ pesan, dst.) ke tiap browser. Ini sederhana tapi tidak skala (lihat bagian 13).

---

## 3. Model data (koleksi di `db.json`)

| Koleksi | Jumlah (uji) | Field utama |
|---|---|---|
| `company` | 1 objek | `name, tagline, language` |
| `divisions` | 22 | `id, name, short, color, icon, mission, teams[], delegation, leadId` |
| `employees` | 171 | `id, name, type('ai'/'human'), divisionId, title, persona, skills[], isLead, isMaster, isPA, ownerId, reportsTo, team, about, taskAndFunction, instructions, escalation, skillRefs[], starters[], outputFormat, effort, status('idle/working/meeting/offline…'), statusText, currentTaskId, avatar, autonomy, model, reasoning, stats{tasksDone,tokensIn,tokensOut,cost,qualitySum,qualityN}, tools[], knowledgeIds[], lessons[], mind, failureHistory[]` |
| `tasks` | 341 | `id, title, description, divisionId, assigneeId, createdBy, parentId, priority(low/medium/high), kind('task'/'goal'/'routine'), routineId, dueAt, status(todo/in_progress/waiting/review/blocked/done), output, summary, expected, evidence, revisions, failures, log[], cost, treeCost, noteId, createdAt/updatedAt/startedAt/completedAt` |
| `approvals` | 33 | `id, taskId, requesterId, approverId, title, summary, status(pending/approved/rejected), feedback, createdAt` |
| `channels` | 160 | `id, name, kind('channel'/'dm'/'group'/'meeting'), members[], goalId, meetingId, divisionId` |
| `messages` | 1.610 (batas 3.000) | `id, channelId, authorId, text, createdAt, extra (gambar, lencana, dll.)` |
| `meetings` | 29 | `id, topic, agenda, chairId, participants[], status(running/waiting_owner/done/failed), transcript[{t,speakerId,text}], minutes, actionItems` |
| `notes` | 61 | `id, title, folder, content(Markdown+[[wikilink]]), tags[], kb('owner'/'drive'/'system'/'agent'/'dummy'), visibility('internal'/'private'/'public'), authorId, lastEditorId, pinned, archived, origFolder, createdAt, updatedAt` |
| `skills` | 128 | `id, name, category, divisions[], description, promptSnippet, versi/riwayat` |
| `routines` | 82 | `id, employeeId, title, description, cron / everyMinutes, enabled, lastRunAt, scope` |
| `events` | 600 (batas) | `id, t, type, actorId, text, refs` — dasar "Aktivitas terbaru" dan efek 3D |
| `usage` | 1 objek | `day, costToday, costTotal, tokensIn/Out, calls, byModel{}` |
| `settings` | 1 objek | `provider, groqModel, groqWorkerModel, model, workerModel, effort, autonomy, tickMs, maxConcurrent, dailyBudgetUSD, goalBudgetUSD, taskBudgetUSD, autoActivate, autoOrganize, autoApprove, massDispatchSize, currentUserId, kunci (di-mask saat dikirim ke klien)` |

Catatan data: field `kb` **tidak pernah ditampilkan di UI** saat ini (lihat bagian 9.F). Folder catatan bersifat hierarki lewat `/` (mis. `Drive/Perusahaan/Raycorp/04-deployment/business-units/airaylabs/Prompt & Formula`).

---

## 4. "Otak agen" — `server/engine.js` (1.457 baris)

### 4.1 Siklus kerja
1. `start()` memulai loop `tick()` per workspace tiap `tickMs` (default 2,5–5 dtk).
2. `tick()`: sapu rapat yatim → jalankan rutinitas yang jatuh tempo (cron/interval) → bangunkan tugas induk yang semua subtugasnya selesai (`waiting → todo`, `synth=true`) → isi antrean `todo` (prioritas high>medium>low) sesuai slot `maxConcurrent` dan anggaran → jalankan `startJob` (mode `live` bila LLM aktif, `sim` bila tidak) → majukan job simulasi satu langkah dengan jitter.
3. Tugas melewati `finishTask → verifyEvidence → (perlu persetujuan?) → approval → completeTask`. Goal dari Owner **selalu** masuk "Butuh kamu" (approval) sebelum dianggap selesai. Subtugas ditinjau orkestrator di atasnya, bukan manusia.
4. Goal dipecah **bertahap** (`stage`): tahap 1 riset selesai dulu, baru tahap 2 eksekusi (`stageReady`).
5. Kegagalan → `failTask` (retry dengan `retryAt`, pelajaran `failureLesson` disimpan ke memori), tugas bisa `blocked`.

### 4.2 Chat & orkestrasi (satu kotak untuk segalanya)
`orchestrate({text,to,mode,channelId,images})` → keputusan: thread goal? rapat live? goal (kalimat perintah tanpa penerima, `looksLikeWork`)? obrolan DM/grup? Aturan resmi ada di catatan Brain **"SOP Alur Kerja RAIVERSE"** (`sop.js`). `quickReply` menjawab sapaan/status **tanpa token**. `chatRoute` memilih model: gambar → Qwen vision; kompleks → gpt-oss-120b (reasoning medium); lainnya → gpt-oss-20b (low). `chatSystem(e)` = persona ringkas yang dibumikan pada keadaan nyata agen. Aturan format: agen diminta menjawab Markdown (daftar, tabel, blok ```chart berisi JSON angka asli saja).

### 4.3 Tool agen (`catalog.js` CAPABILITIES, 29 tool)
Organisasi: `recruit_agent`, `create_division`. Belajar: `train_colleague`, `improve_skill`, `acquire_skill`. Kolaborasi: `ask_colleague`, `convene_meeting`, `create_subtask`, `send_message`, `company_status`. Otomasi: `schedule_job`, `list_jobs`. Riset: `web_search`, `visit_url`, `calculate`. Integrasi: `mcp`, `google_sheets_append`, `google_drive_create`, `google_calendar_create`. **Pengetahuan (Otak): `search_brain`, `read_note`, `write_note`, `organize_brain`, `move_note`, `rename_note`, `merge_notes`**. AI: `build_training_set`. Tata kelola: `request_approval`, `complete_task` (wajib). Setiap tool punya `risk`, kadang `leadOnly/paOnly/specialist`.

### 4.4 Governor (`governor.js`)
- `checkCreate`: tugas buatan AI dibatasi (maks tugas aktif 80, inisiatif baru 8/jam, deteksi duplikat by kemiripan ≥0,8). Manusia & penjadwal dipercaya.
- `overBudget`: anggaran per goal ($1,5) dan per tugas ($0,4); `llm.budgetLeft()` anggaran harian ($5 default) → agen live dijeda bila habis.
- `modelTier`: chat/rapat/refleksi → `small`; PA/master/sintesis/goal/kepala → `lead`; lainnya `worker`.
- `needsHumanApproval`: hanya tugas puncak; kata kunci berisiko (publikasi, kontrak, bayar, PHK…) memaksa persetujuan.
- `cached`, `compact`: cache riset TTL & pemadatan hasil tool lama agar konteks tidak membengkak.

### 4.5 LLM (`llm.js`)
Penyedia `auto` memilih Groq bila ada kunci. Model: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `qwen/qwen3.6-27b`, `allam-2-7b` (tak tersedia), + Claude (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`). Pelacakan biaya per panggilan (`track`), tabel `PRICES`, `refreshGroqModels`. Jika tanpa tools, `flattenTools`. **Mode simulasi** (`simSteps`) membuat hasil palsu-masuk-akal agar UI hidup tanpa biaya.

### 4.6 Rapat (`collab.js`)
`runMeeting`: peserta 2–7, bergiliran, putaran `rounds`, Owner bisa ikut (status `waiting_owner`), notulen + action item otomatis jadi tugas. `handleOwnerMeetingMessage`/`meetingIntent` memutuskan apakah pesan Owner untuk rapat. Juga: `reflect` (skor kualitas), `recordFeedback`, `recordTraining` (JSONL per agen), `cronMatches`, `mcpCall`, `googleWorkspaceCall`, `visitUrl`.

---

## 5. API (semua di `server/index.js`)

Autentikasi: bila sudah ada yang login Google (`auth.enforced()`), semua `/api/*` kecuali `/api/auth/me` butuh sesi (401 + `login:'/auth/google'`). `userId` pada body **diganti** dari sesi; klien tidak boleh mengklaimnya. Semua handler berjalan di dalam `store.run(ws, …)`.

| Metode & path | Fungsi |
|---|---|
| `GET /api/state` | Snapshot seluruh DB + `running, live, provider, models, capabilities…` |
| `GET /api/stream` | SSE realtime |
| `GET /api/files/:id` | Gambar chat (per workspace) |
| `POST /api/goals` | Goal baru `{title, description, priority}` |
| `POST /api/orchestrate` | Kotak chat tunggal `{text, to[], mode, channelId, images[]}` |
| `POST /api/messages`, `/api/dm`, `/api/channels` | Pesan, buka DM, buat channel |
| `POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`, `POST …/comment`, `POST …/complete` | CRUD tugas |
| `POST /api/approvals/:id` | `{decision:'approve'/'reject', feedback}` |
| `POST /api/meetings` | Rapat baru |
| `POST /api/notes`, `PUT/DELETE /api/notes/:id` | CRUD catatan Brain |
| `GET /api/brain/audit`, `POST /api/brain/organize` | Audit kerapian, rapikan otomatis |
| `GET /api/knowledge/spaces`, `GET /api/knowledge/library`, `POST /api/knowledge/assign` | Ruang pengetahuan per divisi, pustaka, bagikan ke agen |
| `GET /api/learning`, `POST /api/learning/train`, `GET /api/training/:id`, `POST /api/training-sets` | Pelatihan agen & dataset |
| `POST/PATCH/DELETE /api/employees…`, `GET /api/employees/:id/prompt`, `POST …/activate` | Karyawan |
| `POST /api/studio/generate` | Buat karyawan dari brief (AI) |
| `POST/PATCH/DELETE /api/skills…`, `/api/divisions…`, `/api/routines…`, `POST /api/routines/:id/run` | Skill, divisi, rutinitas |
| `GET /api/capabilities`, `GET /api/calendar` | Tool & kalender |
| `PATCH /api/settings`, `POST /api/groq-models/refresh`, `PATCH /api/company`, `POST /api/test-key`, `POST /api/mcp/test`, `POST /api/google-workspace/test` | Pengaturan & uji koneksi |
| `GET /api/export`, `POST /api/import`, `POST /api/reset` | Ekspor/impor/reset |
| `GET /api/auth/me`, `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/join/:token` | Login Google & undangan |
| `POST /api/ws/switch|invite|member|rename`, `GET /api/ws/members` | Ruang kerja (seperti server Discord) |
| `GET /api/drive/config|token|pull-status`, `POST /api/drive/setup|push|pull|picked` | Google Drive ⇄ Brain |

Helper: `on(method, pattern, fn)`; pola `:id` menjadi grup bernama; kesalahan → `{error}` dengan kode `err.code/status`.

---

## 6. Multi-ruang kerja, login, Google Drive

- **Workspace:** `main` = kantor asli (`data/db.json`). Pengguna login mendapat ruang kerja pribadi baru (`workspace.js starterDb`: 6 divisi inti `exec, mkt, sales, fin, ops, data`, hanya SOP sistem di Brain, tanpa rutinitas, anggaran awal $0,5).
- **Auth:** Google OAuth (`auth.js`), sesi cookie, peran anggota, tautan undangan `/join/<token>`. Sebelum ada yang login, aplikasi terbuka bebas sebagai Owner. Kartu masuk ada di `core.js loginGate`.
- **Drive** (`gdrive.js`): `ensureFolders` membuat struktur folder; `push` menulis catatan ke Drive; `pull` (latar belakang) menarik ratusan file jadi catatan bertanda `kb:'drive'` di folder `Drive/…`; Picker untuk memilih file. Catatan Drive & sistem **di-pin**: librarian/agen tidak memindahkannya. Dokumen setup: [../GOOGLE-DRIVE-DAN-LOGIN.md](../GOOGLE-DRIVE-DAN-LOGIN.md).

---

## 7. Klien — arsitektur UI

- **Berkas:** `public/index.html` memuat `css/app.css` (966 baris, berlapis/berantakan), `css/glass.css` (369, lapisan glassmorph, menimpa), `css/knowledge.css`; modul JS: `app.js` (cangkang, rute, palet), `core.js` (state `S`, `api()`, SSE, `navigate`, `modal`, `toast`, util), `views.js` (semua halaman, 1.700 baris), `studio.js`, `knowledge-view.js`, `graph.js`, `md.js` (renderer Markdown + grafik SVG), `office3d.js` + `environment/furniture/assets3d/life/props/people/chatter/sfx` (3D).
- **Routing:** hash `#view?param=…` via `navigate(view, params)` → `history.replaceState` + `notify('__route')`. `VIEWS = {office, dashboard, tasks, chat, brain, studio, team, knowledge, approvals, settings}`; tiap view punya `mount(root)`, `update(colls)`, `unmount(root)`. Penjelajah 3D punya "jendela aplikasi" di dalam kantor 3D (`openApp/closeApp`) yang memuat view yang sama.
- **State:** `S.data` = snapshot; pembaruan realtime menimpa langsung; view me-render ulang HTML string (`innerHTML`) — **tanpa virtual DOM/komponen**, tanpa framework.
- **Cangkang (sidebar):** logo, tombol cari/palet `Ctrl K`, grup inti (Kantor 3D, Dashboard, Tugas, Chat, Brain), grup "Lainnya" yang bisa dilipat (Persetujuan, Tim & Divisi, Agent Studio, Ruang Pengetahuan, Pengaturan), kaki sidebar dengan kartu pengguna + tombol jeda/jalankan kantor ("N/M agen aktif · $biaya"). Di desktop **tidak ada topbar**; di mobile ada bilah atas (judul, cari, menu) + bilah tab bawah.
- **Tema:** terang/gelap lewat `data-theme` di `<html>` (disimpan `localStorage ui-theme`). Token CSS di `glass.css`: `--gl-blur 22px`, `--gl-r 24px`, `--gl-fill*`, `--gl-stroke*`, `--gl-grad` (biru #5aa9ff → ungu #8b6cff → merah muda #ff7fc0), `--accent #5b6cf0`, `--text #15172b`, `--muted #50567a`. Font Inter. Palet warna divisi dilembutkan (`soften()`).
- **Pola UI yang dipakai ulang:** `<details class="acc">` (akordeon), `.chg` (grup daftar), `.card`, `.chip`, `modal(title, html, {actions})`, drawer (`taskDrawer`, `agentDrawer`, `divisionDrawer`), toast, `.stabs` (tab pengaturan), kanban 4 kolom (kolom kosong disembunyikan).
- **Markdown (`md.js`):** judul, daftar bersarang, daftar otomatis dari "(1) a; (2) b", tabel, kode + tombol salin, callout, **grafik SVG** dari blok ```chart JSON.

---

## 8. Katalog halaman (dengan screenshot)

Semua gambar diambil di 1440×900 (desktop) dan 390×844 @2x (mobile) dari salinan uji dengan data Owner. **Catatan jujur:** halaman 3D diambil lewat Chrome headless dengan renderer perangkat lunak (SwiftShader), jadi tampilan/performa 3D tidak mewakili GPU asli Owner.

### 8.1 Kantor 3D (`#office`)
![Kantor 3D](screenshots/01-kantor-3d.png)
- **Isi:** kampus bundar dengan 27 "pod" kaca (satu per divisi/ruang) dalam dua cincin mengelilingi plaza; HUD kiri-atas (jumlah agen bekerja, jam, "Ruangan"), tombol PLAY/layar penuh/efek/bantuan di kanan-atas, **dock Orkestrator** (kotak chat kaca di kiri-bawah: tab Agen/Butuh kamu/Otomatis, kotak tulis, tombol Rapat & kirim), tombol "Percakapan" kanan-bawah.
- **Data:** `employees.status`, `events`, `tasks`, `notes` (kartu chip di Brain 3D), layar hi-tech di landmark aplikasi.
- **Aksi:** klik agen/ruangan, menu pie klik-kanan, PLAY (jalan orang pertama), tekan E dekat Brain.
- **Catatan Codex:** bagian 3D **di luar cakupan penggantian** kecuali dikoordinasikan (lihat bagian 10 & 11).

### 8.2 Dashboard (`#dashboard`)
![Dashboard](screenshots/02-dashboard.png) · mobile: ![](screenshots/34-dashboard-mobile.png) · gelap: ![](screenshots/40-dashboard-gelap.png)
- **Isi:** salam + KPI satu baris (agen bekerja, tugas berjalan, biaya hari ini) + tombol "Masuk Kantor 3D"; kotak besar **"Mau dikerjakan apa hari ini?"** + "Tambah detail (opsional)" + **Jalankan**; "Pekerjaan terbaru" (4 goal terakhir dengan bar progres); "Aktivitas terbaru" dan "Divisi · 22" terlipat; kartu "Perlu keputusanmu" hanya muncul bila ada persetujuan.
- **API:** `POST /api/goals`. Observasi: bar progres goal selesai tampil penuh tanpa makna lain; hampir semua isi sama sekali tidak menyajikan wawasan "otak".

### 8.3 Tugas (`#tasks`)
Papan: ![](screenshots/03-tugas-papan.png) · Daftar: ![](screenshots/12-tugas-daftar.png) · Kalender: ![](screenshots/13-tugas-kalender.png) · Detail: ![](screenshots/14-tugas-detail-drawer.png) · Tugas baru: ![](screenshots/15-tugas-baru-modal.png) · mobile: ![](screenshots/37-tugas-mobile.png)
- **Isi:** bilah alat (cari, Papan/Daftar/Kalender, ＋Tugas), Filter dalam `<details>`, "lensa" cepat hanya bila ada isinya, kolom kosong disembunyikan, kartu "Semua beres" bila tidak ada kerja terbuka, kolom Selesai dibatasi 8 + "+N lagi". Drawer detail: lencana status, pelaksana (ganti), brief, kontrak (peminta/penanggung jawab/tenggat/bukti), hasil kerja (Markdown), log, komentar, ulang/hapus.
- **Masalah:** 341 tugas, semuanya `done`; 195 bertipe rutinitas dengan judul yang identik ("lakukan self knowledge upgrade…") sehingga Daftar terlihat berulang. Judul rutinitas perlu diringkas.

### 8.4 Chat (`#chat`)
Daftar+percakapan: ![](screenshots/17-chat-percakapan.png) · Goal/grup: ![](screenshots/18-chat-grup-goal.png) · mobile: ![](screenshots/38-chat-mobile.png)
- **Isi:** kolom kiri akordeon (💬 Karyawan 41, 🎯 Goal & grup, 👥 Rapat, # Channel divisi, 👀 Antar agen), pencarian, "＋ Chat baru"; kanan: riwayat pesan dengan Markdown kaya, chip aksi cepat (Goal, Rapat, Tugas, Semua agen, Status), kotak tulis. `@nama` menyebut agen; `@all` siaran.
- **Aturan perilaku:** lihat 4.2 dan SOP.

### 8.5 Brain / Otak (`#brain`) — **fokus utama, lihat bagian 9**
Catatan: ![](screenshots/05-brain-catatan.png) · Edit: ![](screenshots/19-brain-edit.png) · Tautan/backlink: ![](screenshots/20-brain-tautan-samping.png) · Folder terbuka: ![](screenshots/21-brain-folder-terbuka.png) · Catatan Drive: ![](screenshots/22-brain-catatan-drive.png) · Catatan baru: ![](screenshots/23-brain-catatan-baru-modal.png) · **Graph**: ![](screenshots/06-brain-graph.png) · Graph gelap: ![](screenshots/41-brain-graph-gelap.png) · mobile: ![](screenshots/35-brain-mobile.png) ![](screenshots/36-brain-graph-mobile.png) ![](screenshots/42-brain-catatan-mobile-tree.png)

### 8.6 Agent Studio (`#studio`)
Karyawan: ![](screenshots/07-studio-karyawan.png) · terpilih: ![](screenshots/26-studio-karyawan-dipilih.png) · Skill: ![](screenshots/24-studio-skill.png) · Tool: ![](screenshots/25-studio-tool.png)
- **Isi:** tiga tab (Karyawan/Skill/Tool); daftar karyawan per divisi (akordeon); editor lapisan instruksi (identitas → about → tugas → system instruction → eskalasi), skill & tingkat keahlian, tool yang boleh dipakai, knowledge dari Brain; "Buat karyawan dari brief" (AI) dan "Bulk dari banyak brief".

### 8.7 Tim & Divisi (`#team`)
![](screenshots/08-organisasi.png) · terbuka: ![](screenshots/27-organisasi-divisi-terbuka.png)
- **Isi:** "Struktur komando" (Owner → PA → Master → kepala divisi → staf), kartu divisi (akordeon, tombol Detail → drawer), rutinitas otomatis (10 aktif dulu + "tampilkan semua"), tombol ＋Divisi/＋Manusia/＋Rekrut.

### 8.8 Ruang Pengetahuan (`#knowledge`)
Per divisi: ![](screenshots/09-knowledge.png) · Pustaka: ![](screenshots/28-knowledge-pustaka.png) · Latih agen: ![](screenshots/29-knowledge-latih-agen.png) · Dataset: ![](screenshots/30-knowledge-dataset.png)
- **Isi:** empat tab; membagi catatan Brain ke agen (`knowledgeIds`), pustaka (folder `Knowledge Library/`), pelatihan agen (skor kualitas, contoh), pembuat dataset JSONL (`buildTrainingSet`).
- **Catatan:** halaman ini tumpang tindih konsep dengan Brain dan Studio → kandidat digabung.

### 8.9 Persetujuan (`#approvals`)
![](screenshots/10-persetujuan.png)
- **Isi:** kartu "Butuh kamu" per permintaan (judul, ringkasan hasil, Setujui/Tolak + umpan balik), riwayat dalam akordeon (12 terbaru). Semua goal Owner berhenti di sini.

### 8.10 Pengaturan (`#settings`)
Umum (default): ![](screenshots/11-pengaturan.png) · AI: ![](screenshots/31-pengaturan-ai.png) · Integrasi: ![](screenshots/32-pengaturan-integrasi.png) · Data: ![](screenshots/33-pengaturan-data.png)
- **Isi:** empat tab (Umum/AI/Integrasi/Data), "Pengaturan lanjutan" terlipat (model, paralel, anggaran), Google Workspace/MCP, ekspor/impor/reset, tema, workspace & login.
- **Catatan:** tab dibentuk **pasca-proses** dengan regex pada judul kartu (`TABS` di `views.js` ±baris 1650) — rapuh.

### 8.11 Palet perintah & menu mobile
![](screenshots/16-palet-perintah.png) · ![](screenshots/39-menu-mobile.png)
- `Ctrl K`: aksi (Goal baru, Rapat baru, Tugas baru, Rekrut, Jeda, Ganti tema), halaman, lalu pencarian karyawan/catatan/tugas; jika tak ada hasil → "Jadikan goal: …".

---

## 9. OTAK — Company Brain (inti permintaan)

### 9.A Apa itu Brain
Basis pengetahuan perusahaan gaya Obsidian: catatan Markdown yang saling menaut dengan `[[wikilink]]` (`[[Judul]]`, `[[Judul|alias]]`, `[[Judul#bagian]]`). Dibaca **manusia** (halaman Brain) dan **agen** (tool `search_brain`, `read_note`, `write_note`…, serta potongan fakta yang disisipkan ke prompt lewat `relevantFacts`/`retrievedContext`/`brainOverview`).

### 9.B Kepercayaan (konsep produk paling penting, belum terlihat di UI)
`brain.js`:
- `TRUST = { owner:'terverifikasi · Owner', drive:'terverifikasi · Google Drive', system:'terverifikasi · Sistem', agent:'draf hasil agen (belum diverifikasi)' }`.
- `isVerified(n)` = kb ∈ {owner, drive, system}. Pencarian menaikkan skor catatan terverifikasi ×1,6 dan folder `SOP`/`Company` ×1,2.
- Catatan `archived` (demo lama) **tidak pernah** dicari; `visibility:'private'` tidak pernah sampai ke agen; agen "publik" hanya melihat `visibility:'public'`.
- Edit manusia mengubah catatan jadi terverifikasi (`kb:'owner'`); edit agen tidak pernah menurunkannya.
- Catatan demo lama diekspor ke `arsip-dummy/` (di-.gitignore) dan dihapus dari DB (`store.js exportArchive/cleanSlate`).
- Aturan agen ada di catatan sistem **"Aturan Kejujuran Agen"** dan **"Status Data Perusahaan"** (`sop.js`).

### 9.C Pencarian & aliran ke agen
`search(query,{limit=5, scopeEmployeeId, verifiedOnly, audience})`: tokenisasi sederhana (kata >2 huruf), skor = judul×5 + frekuensi isi (maks 5) + tag×2, bonus memori milik agen, bonus terverifikasi. **Tanpa embedding/semantik, tanpa stemming bahasa Indonesia, tanpa indeks (memindai semua catatan tiap panggilan).** `remember(agent, text)` menjaga catatan `Memori <nama>` (maks 40 entri).

### 9.D Pustakawan (`librarian.js`, tanpa token)
- `classifyType` (regex 13 jenis: Meeting, Training, SOP, Policy, Report, Research, Strategy, Plan, Design, Content, Analysis, Data, Technical) + `folderFor(divisi, jenis)` → folder `"<Divisi>/<Jenis>"`.
- `audit()` (jumlah per folder, catatan "longgar", judul buruk, duplikat kemiripan ≥0,75), `autoOrganize()` (dipakai tombol **Rapikan**; catatan Drive/sistem/arsip tidak disentuh), `renameNote` (menulis ulang semua wikilink), `mergeNotes` (gabung → arsip dengan tautan), `moveNote`, `buildTrainingSet` (JSONL train/eval, saring PII sederhana).
- `SYSTEM_FOLDERS = Company, SOP, Memori, Meetings, Playbooks, Archive, Sistem`.

### 9.E Tampilan saat ini (`BrainView`, `views.js` ±baris 1258–1380, `graph.js` 158 baris)
Tata letak 3 kolom: **Pohon folder** (kiri) | **Editor/Pembaca atau Graph penuh** (tengah) | **Panel samping** (kanan, hanya bila tombol 🔗 ditekan: graph lokal + Backlinks + Tautan keluar).
- *Pohon:* kotak cari ("🔎 Cari di Brain…", mencocokkan judul **dan isi**), tombol ＋, tombol "🕸️ Graph view", tombol **Rapikan** + lencana jumlah usulan, ringkasan "61 catatan · 7 folder · disusun otomatis per Divisi/Jenis". Folder inti dahulu (Drive, Company, SOP, Sistem, Meetings, Playbooks, Memori, Archive), lalu "🏢 Per divisi", lalu "📚 Pustaka & lainnya" (`bucketize`). Hierarki seperti Obsidian, rantai folder berisi satu anak digabung ("04-deployment › business-units"). Status buka-tutup disimpan di `this.openFolders`.
- *Pembaca/Editor:* judul, chip folder, tab 👁 Baca / ✎ Edit, 🔗 panel samping, ⋯ opsi (folder, tag, hapus). Edit = `<textarea>` polos Markdown, simpan otomatis 900 ms (Ctrl+S), tidak menimpa saat manusia mengetik. Baca = hasil `md.js` (judul, daftar, tabel, kode, grafik) + baris "penulis · diperbarui N jam".
- *Graph (`createGraph`):* kanvas 2D, simulasi gaya (tolak-menolak O(n²), pegas, gravitasi) di thread utama; geser/zoom (roda, pinch), seret node, hover menyorot tetangga, klik node membuka catatan; node hantu (`[[tautan]]` tanpa catatan) berwarna abu; ukuran node ∝ √derajat; label muncul bila zoom>0,75 / derajat>4 / hover; warna node = hash nama folder (`folderColor`).
- *Realtime:* `update(colls)` me-render ulang pohon/samping, memuat ulang graph; pratinjau diperbarui bila agen mengedit catatan yang terbuka (tidak saat Owner mengetik).

### 9.F Masalah nyata di tampilan Brain (dari screenshot + kode) — **inilah yang harus diganti**
1. **Kepercayaan tak terlihat.** `kb` (owner/drive/system/agent) tidak ditampilkan di mana pun di klien. Pengguna tidak bisa membedakan **fakta** dari **draf agen** — padahal itu aturan inti produk.
2. **Graph tampak seperti taburan titik.** Dari 61 catatan, hanya segelintir yang saling menaut; mayoritas node terpisah (lihat [graph](screenshots/06-brain-graph.png), [mobile](screenshots/36-brain-graph-mobile.png)). Tidak ada makna layout (posisi acak + gaya), tidak ada pengelompokan per folder/divisi, tidak ada legenda warna, label saling tumpang tindih, node hantu tak dijelaskan, tidak ada pencarian/filter/pemilih kedalaman di graph, tidak ada tombol zoom/fit/reset, di mobile tak ada petunjuk gestur.
3. **Hierarki Drive terlalu dalam.** Jalur `Drive/Perusahaan/Raycorp/04-deployment/business-units/airaylabs/project/Ray Rangers/AutoBot/…` memaksa banyak klik; bucket "Per divisi" nyaris kosong karena catatan Drive tidak punya divisi.
4. **Tidak ada ringkasan.** Tidak ada tampilan "isi otak" untuk pengguna malas: berapa fakta terverifikasi, apa yang baru, apa yang kosong, apa yang sering dipakai agen, apa yang kedaluwarsa.
5. **Tidak ada jejak pemakaian.** Tidak terlihat catatan mana yang dipakai agen/tugas mana (padahal `knowledgeIds`, `relevantFacts`, `evidence` ada di data).
6. **Editor minim.** Hanya `<textarea>` Markdown; tidak ada toolbar, pratinjau berdampingan, penyisip `[[`, autocomplete tautan, tempel gambar, riwayat versi, diff.
7. **Pencarian dangkal.** Hanya `includes` di klien (isi penuh 61 catatan sudah dikirim ke browser); tanpa peringkat, tanpa sorotan hasil, tanpa filter tag/folder/penulis/kepercayaan.
8. **Aksi pemeliharaan tersembunyi.** Rapikan satu tombol kecil; audit duplikat/judul buruk/yatim tidak ditampilkan; merge/rename hanya lewat tool agen.
9. **Tanpa konteks 3D↔2D.** Brain di plaza 3D (bola neuron berkedip, kartu catatan melayang) hanya "membuka halaman Brain"; kedua dunia tak berbagi pengalaman.
10. **Mobile:** pohon dan samping tersembunyi di balik ☰ / 🔗 dengan label kecil ([lihat](screenshots/42-brain-catatan-mobile-tree.png)); header graph memakan tiga baris.
11. **Skala:** seluruh `notes[].content` dikirim lewat `/api/state` dan `graph.setData` mem-parse regex semua catatan tiap perubahan; 600+ catatan (jumlah sebelum pembersihan demo) sudah terasa berat.
12. **Terkait data:** judul catatan Drive panjang/aneh ("1.2.Bot Marksy", "Untitled", "README" berulang) → graph dan pohon berantakan; belum ada normalisasi judul untuk catatan Drive (librarian sengaja tidak menyentuhnya).

### 9.G Spesifikasi target "Brain v2" (usulan untuk Codex; boleh disesuaikan)
Prinsip: *instan, jelas, terpercaya, cantik, ringan*.

**G1. Layar utama "Otak" = ringkasan dulu, bukan pohon dulu.**
- Baris atas: pencarian besar tunggal ("Cari apa di otak perusahaan?") dengan hasil langsung (peringkat, cuplikan tersorot, lencana kepercayaan, folder ringkas).
- Kartu ringkasan: **Fakta terverifikasi** (n) · **Draf agen** (n, "perlu dicek") · **Baru minggu ini** · **Paling sering dipakai agen** · **Perlu dirapikan** (duplikat/judul buruk/yatim) · **Celah** (divisi tanpa pengetahuan).
- Tombol aksi utama maksimal 3: ＋ Catatan, ☁️ Sinkron Drive, 🧹 Rapikan.

**G2. Lencana kepercayaan di mana-mana** (pohon, hasil cari, judul catatan, graph, kartu 3D, rujukan di chat): ✔ Terverifikasi (Owner/Drive/Sistem) vs ✎ Draf agen. Tombol **"Verifikasi"** pada draf (mengubah `kb` ke `owner` — endpoint baru atau `PUT /api/notes/:id` dengan `kb`), dan filter "hanya fakta".

**G3. Graph yang bermakna** (opsi: tetap canvas 2D atau WebGL ringan; wajib 60 fps pada 600–2.000 node di PC lemah):
- Pengelompokan per divisi/folder teratas (gugus berwarna) + legenda yang bisa diklik untuk menyembunyikan/menyorot.
- Sembunyikan node yatim secara default (sakelar "tampilkan yang tak bertaut"), sorot node terverifikasi vs draf (cincin/isi), ukuran = pemakaian agen + derajat.
- Pencarian dalam graph (lompat & sorot), kedalaman 1/2/3 dari node terpilih, tombol zoom/fit/reset, mini-info saat hover (judul, folder, kepercayaan, jumlah tautan), label tanpa tabrakan (culling berbasis prioritas), simulasi dihentikan setelah stabil dan tata letak di-cache.
- Mobile: gestur dijelaskan, panel info di bawah (bottom sheet).

**G4. Pohon/penjelajah:** satu panel dengan tiga cara lihat — *Folder*, *Divisi*, *Terbaru/Sering dipakai*; folder Drive dipangkas jalur panjangnya (breadcrumb + "buka folder"), jumlah per folder, lencana kepercayaan, seret-lepas untuk memindah.

**G5. Pembaca/Editor:** pembaca bersih dengan *metadata strip* (kepercayaan, sumber Drive/Owner/Agen, penulis, diperbarui, dipakai oleh N agen), daftar isi otomatis, backlink di bawah; editor dengan toolbar, pratinjau berdampingan, autocomplete `[[`, tempel gambar, simpan otomatis + indikator, **riwayat versi & diff** (butuh field baru di data).

**G6. "Jejak pengetahuan":** di tiap catatan "Dipakai di: tugas/goal/chat apa" dan di tiap tugas/jawaban agen "Sumber: catatan A, B" (pakai `evidence`, `noteId`, `relevantFacts`). Ini membangun kepercayaan pengguna.

**G7. Pemeliharaan visual:** panel "Kesehatan otak" memakai `GET /api/brain/audit` (jumlah per folder, longgar, judul buruk, duplikat) dengan tombol per-item (Pindah, Ganti nama, Gabung) — memanggil fungsi librarian yang sama.

**G8. Selaras dengan 3D:** kartu catatan 3D & pencarian di dock menampilkan lencana yang sama; klik membuka catatan yang sama.

**G9. Performa & skala:** jangan kirim isi penuh semua catatan di `/api/state`; kirim *metadata* (id, title, folder, tags, kb, updatedAt, panjang, daftar tautan) dan ambil isi per catatan (`GET /api/notes/:id`) atau lewat pencarian server (`GET /api/brain/search?q=`). Graph dibangun dari daftar tautan yang dihitung server (`GET /api/brain/graph`). Indeks pencarian di server (invers sederhana atau BM25; bonus: embedding lokal bila memungkinkan) menggantikan pemindaian penuh.

### 9.H Kontrak yang HARUS tetap (agar agen & integrasi tidak patah)
- Bentuk catatan (`id,title,folder,content,tags,kb,visibility,authorId,lastEditorId,pinned,archived,createdAt,updatedAt`), wikilink `[[Judul]]` dan perilaku `renameNote` (menulis ulang tautan).
- Tool agen `search_brain/read_note/write_note/organize_brain/move_note/rename_note/merge_notes` dan semantik `kb`/`visibility`/`archived` (bagian 9.B).
- Endpoint yang dipakai klien lama sampai klien baru siap: `POST/PUT/DELETE /api/notes`, `GET /api/brain/audit`, `POST /api/brain/organize`, `GET /api/knowledge/*`, `POST /api/drive/*`.
- Catatan sistem (`sop.js`) tetap dipin dan tidak boleh diarsipkan/dipindah.
- Streaming SSE `upsert/remove` pada koleksi `notes` (halaman lain & 3D bergantung padanya).

---

## 10. Kantor 3D (ringkas; milik "sesi 3D" — jangan disentuh tanpa koordinasi)

- `office3d.js` (3.305 baris) + `assets3d.js`, `environment.js`, `furniture.js`, `life.js`, `props.js`, `people.js`, `chatter.js`, `sfx.js`. Dokumentasi mendalam: [../HANDOFF-SESI-BARU.md](../HANDOFF-SESI-BARU.md), [../mascot-v4-2/README.md](../mascot-v4-2/README.md) (dan 01–07).
- Konsep: denah 27 pod bundar + plaza (Company Brain di tengah, air mancur, sky deck, panggung, kios, booth); 12 karakter robot Mascot V4.2 dengan LOD (LOD0 <22 unit, LOD1 22–50, instansi titik >110); mode **PLAY** (jalan orang pertama, FOV tetap 38) dan sinematik pembuka (`?nointro` mematikan); governor performa otomatis; hook debug `window.__ray3d`.
- Interaksi dengan "otak": kartu catatan Brain melayang (diambil dari `data.notes`), sentuh Brain (E) → buka graf pengetahuan, agen membaca di Brain (`READING` regex), dock Orkestrator → `POST /api/orchestrate`.
- **Kontrak untuk penggantian UI:** cangkang tidak boleh merusak `OfficeView` (mount/unmount, `setInset`, `S.embedHook` jendela aplikasi), `window.__ray3d`, atau `verify-v42.mjs`.
- Perbaikan terbaru: kubah kaca pod tetap tampil dari luar saat PLAY (bagian Y di `07-UI-GLASSMORPH-DAN-TATA-LETAK-PLAZA.md`).

---

## 11. Yang HARUS dipertahankan / dilarang

1. **Jangan** menyentuh `public/assets/characters/agents/`, pipeline Blender, `3D karakter/`; jangan menjalankan `build_mascot.py`/`deploy_v4.py`.
2. **Jangan** meng-commit rahasia: `.env`, `data/`, `docs/client_secret_*.json`, `3D karakter/`.
3. **Jangan** menguji dengan kunci LLM asli terisi (biaya nyata). Uji di salinan folder: `PORT=4511 GROQ_API_KEY= ANTHROPIC_API_KEY= node server/index.js` → log "SIMULASI".
4. Jangan membunuh server Owner di port 4317.
5. Tiga invarian produk: (a) **fakta hanya dari sumber terverifikasi**, (b) **goal Owner selalu lewat persetujuan**, (c) **hemat token** (jawaban tanpa LLM bila bisa).
6. Berbahasa Indonesia santai; jangan menambahkan sistem yang butuh pengguna "membaca manual".
7. Performa: PC lemah. Tidak boleh ada pass 3D tambahan/animasi CSS berat/`backdrop-filter` bertumpuk berlebihan; uji FPS.
8. Jangan mengubah urutan pass pasca-proses 3D (FXAA sebelum grade) — layar hitam.
9. Panel Browser tersembunyi membekukan `requestAnimationFrame` (`notify()` memakainya) — saat menguji UI gunakan browser yang tampil/Chrome headless.

---

## 12. Rencana penggantian yang disarankan untuk Codex

**Fase 0 — Persiapan (1 hari).** Jalankan salinan uji, baca bagian 3–9, jalankan `node --test` dan `verify-v42.mjs`. Putuskan: tetap vanilla JS atau pindah framework (mis. React/Svelte + Vite). Bila pindah, **pertahankan** `/api/*`, SSE, hash routing, dan jendela-aplikasi dalam 3D (atau sediakan adaptor).

**Fase 1 — Backend "otak" (kontrak dulu).** (a) Pisahkan `/api/state` menjadi metadata ringan + endpoint rinci (`/api/notes/:id`, `/api/brain/search`, `/api/brain/graph`, `/api/brain/usage`). (b) Indeks pencarian server. (c) Riwayat versi catatan. (d) Endpoint "verifikasi catatan". (e) Hitung & cache tautan di server. (f) Pecah `engine.js` (1.457 baris) per tanggung jawab (tick/jobs, chat, tools, approvals) **tanpa mengubah perilaku**; tambah tes.

**Fase 2 — Tampilan Otak (prioritas).** Implementasikan 9.G (G1–G8) di halaman Brain, termasuk lencana kepercayaan global dan graph bermakna. Uji dengan data Owner (61 catatan, 48 dari Drive) **dan** dataset stres (1.000–2.000 catatan sintetis) di PC lemah.

**Fase 3 — Cangkang & halaman lain.** Ganti CSS berlapis (`app.css` + `glass.css`) dengan satu sistem desain bertoken; satukan Knowledge ke Brain/Studio; perbaiki tab Pengaturan (hentikan pasca-proses regex); ringkas judul rutinitas.

**Fase 4 — Integrasi 3D.** Pastikan dock Orkestrator, jendela aplikasi, kartu Brain 3D memakai komponen baru; jalankan `verify-v42.mjs`.

**Akseptansi minimum (Brain):**
- Pengguna bisa menjawab dalam 3 detik: "apa yang otak tahu tentang X, dan apakah itu fakta?"
- Lencana kepercayaan tampil di pohon, hasil cari, pembaca, graph, 3D.
- Graph 1.000 node ≥ 50 fps pada laptop tanpa GPU diskrit; label tidak bertabrakan; ada legenda, pencarian, filter yatim, fit/zoom.
- Edit manusia → status Terverifikasi; edit agen tidak menurunkan.
- Tidak ada regresi pada tool agen, `verify-v42.mjs` (109), `node --test` (10).
- Mobile: pencarian, pembaca, dan graph dapat dipakai satu tangan.

---

## 13. Utang teknis & masalah yang diketahui

- `GET /api/state` mengirim seluruh DB (1.610 pesan + isi catatan) ke semua klien; setiap perubahan disiarkan ke semua.
- Render dengan `innerHTML` string; state UI tersebar (`this.xxx`, Set global, `localStorage`); `app.css` berlapis dan saling menimpa dengan `glass.css`.
- Tab Pengaturan dibentuk lewat regex judul kartu; dock/3D memakai `S.embedHook` hack.
- Tugas rutinitas menumpuk: 82 rutinitas, 195 tugas rutin selesai berjudul sama; "duplikat rutinitas dinonaktifkan" belum dibersihkan; 33 persetujuan, tugas `blocked` belum dirapikan.
- Pencarian Brain tanpa indeks/semantik; librarian sengaja tidak menyentuh judul catatan Drive.
- `llm.js` memuat daftar model/harga manual (`allam-2-7b` ditandai tak tersedia).
- Uji otomatis hanya `test/engine-v6.test.js` (10 tes) + verifikasi 3D; **tidak ada tes UI/E2E**.
- Meeting loop di memori: setelah restart server, rapat `running` ditandai `failed`.
- Belum diverifikasi di GPU Owner: tampilan akhir 3D, dock, mode Play penuh, dekorasi dari dekat; tema gelap hanya diperiksa untuk Dashboard dan Graph.

---

## 14. Lampiran

### 14.1 Struktur berkas penting
```
server/  index.js store.js engine.js collab.js llm.js governor.js brain.js librarian.js
         auth.js gdrive.js sop.js workspace.js org.js catalog.js studio.js seed.js
         roster.js roster-extra.js roster-teams.js roster-studio.js skills-*.js knowledge/*
public/  index.html css/{app,glass,knowledge}.css
         js/{app,core,views,studio,knowledge-view,graph,md,icons}.js
         js/{office3d,assets3d,environment,furniture,life,props,people,chatter,sfx,appearance-ui,mascot-palettes}.js
test/engine-v6.test.js      docs/ (mascot-v4-2/, sesi-baru-orkestrator/, platform/)
integrations/google-apps-script/Code.gs
```

### 14.2 Daftar 22 divisi
EXEC Executive Office · MKT Marketing · SALES Sales · ENG Product & Engineering · DSGN Creative & Design · CS Customer Success · FIN Finance · HR People & HR · OPS Operations · LEGAL Legal & Compliance · IT IT & Security · DATA Data & Research · R&D R&D & Formulation · MFG Manufacturing · QA Quality Control & Assurance · REG Regulatory Affairs · SCM Supply Chain & Warehouse · ECOM E-commerce & Marketplace · KAI Knowledge & AI Ops · STU Content Studio · BD Business Development & Partnerships · RTL Retail & Beauty Stores.

### 14.3 Cara mereproduksi screenshot
Skrip `shots.mjs` (Chrome DevTools Protocol lewat Chrome headless; tanpa dependensi) ada di scratchpad sesi dan **tidak** ikut repo. Langkah: salin `server/` dan `public/` ke folder uji, siapkan `data/db.json` (kunci dikosongkan), jalankan `PORT=4511 GROQ_API_KEY= ANTHROPIC_API_KEY= node server/index.js`, lalu buka `http://127.0.0.1:4511/?nointro#<view>` pada 1440×900 / 390×844@2×. Rute: `#office #dashboard #tasks #chat #brain #brain?graph=1 #studio?tab=skills|tools #team #knowledge?tab=ruang|library|belajar #approvals #settings`.

### 14.4 Indeks screenshot (42)
`01` kantor-3d · `02` dashboard · `03` tugas-papan · `04` chat · `05` brain-catatan · `06` brain-graph · `07` studio-karyawan · `08` organisasi · `09` knowledge · `10` persetujuan · `11` pengaturan · `12` tugas-daftar · `13` tugas-kalender · `14` tugas-detail-drawer · `15` tugas-baru-modal · `16` palet-perintah · `17` chat-percakapan · `18` chat-grup-goal · `19` brain-edit · `20` brain-tautan-samping · `21` brain-folder-terbuka · `22` brain-catatan-drive · `23` brain-catatan-baru-modal · `24` studio-skill · `25` studio-tool · `26` studio-karyawan-dipilih · `27` organisasi-divisi-terbuka · `28` knowledge-pustaka · `29` knowledge-latih-agen · `30` knowledge-dataset · `31` pengaturan-ai · `32` pengaturan-integrasi · `33` pengaturan-data · `34` dashboard-mobile · `35` brain-mobile · `36` brain-graph-mobile · `37` tugas-mobile · `38` chat-mobile · `39` menu-mobile · `40` dashboard-gelap · `41` brain-graph-gelap · `42` brain-catatan-mobile-tree.

### 14.5 Dokumen terkait di repo
[HANDOFF-SESI-BARU](../HANDOFF-SESI-BARU.md) (arsitektur 3D & kebiasaan) · [mascot-v4-2/README](../mascot-v4-2/README.md) · [07-UI-GLASSMORPH-DAN-TATA-LETAK-PLAZA](../mascot-v4-2/07-UI-GLASSMORPH-DAN-TATA-LETAK-PLAZA.md) (bagian W simplifikasi UI, X render chat, Y atap pod) · [sesi-baru-orkestrator/](../sesi-baru-orkestrator/00-MULAI-DI-SINI.md) · [GOOGLE-DRIVE-DAN-LOGIN](../GOOGLE-DRIVE-DAN-LOGIN.md).
