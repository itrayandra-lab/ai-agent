# 🏢 Ray Agent Office

Sistem operasi perusahaan AI untuk **Ray Group** (RayFlow SaaS + Ray Beauty). **112 karyawan AI + manusia** di **19 divisi dan 57 tim** bekerja sendiri dalam satu rantai komando: **asisten pribadi (PA) tiap manusia → Aria (Master Orchestrator) → head divisi → staf**. Mereka saling mendelegasikan, rapat, saling melatih, merekrut agen baru, riset internet sungguhan, menjalankan cron, dan menulis ke **otak perusahaan** (knowledge graph ala Obsidian). Semua percakapan terlihat live di **kantor 3D**, yang juga bisa Anda masuki sebagai karakter (WASD).

## Menjalankan

```bash
npm install
npm start
```

Buka http://localhost:4317.

### Otak AI (pilih di Pengaturan → Mesin AI)
Simpan key di file `.env` di root project (file ini tidak ikut ter-commit, sudah ada di `.gitignore`):

```
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...   # opsional
```

| Provider | Model default | Catatan |
|---|---|---|
| **Groq** (default bila key ada) | `openai/gpt-oss-120b`, cadangan `gpt-oss-20b` lalu `llama-3.3-70b-versatile` | Cepat dan murah; cocok untuk server produksi. Mendukung tool calling, JSON schema strict, dan **riset web sungguhan** lewat `browser_search`. |
| **Claude** | `claude-opus-5-5` | Adaptive thinking, refusal fallback, prompt caching. |
| Simulasi | – | Tanpa AI; hanya untuk demo offline. |

Budget harian bawaan adalah **$5** dan bisa diubah. Biaya tiap model tercatat di HUD dan Pengaturan. Rotasi model dengan circuit breaker aktif otomatis saat kena rate limit atau overload.

### Akses dari HP / server
Untuk akses dari HP:

```bash
HOST=0.0.0.0 npm start
```

Di PowerShell: `$env:HOST="0.0.0.0"; npm start`. Server ini belum punya login, jadi pasang reverse proxy dengan autentikasi sebelum membukanya ke internet.

## Fitur

| Area | Isi |
|---|---|
| 🏢 Kantor 3D | Kampus berlanskap dengan hingga 4 sayap dan 18 section divisi. Tiap divisi punya ruang khasnya: lab formulasi (fume hood, lab bench), pabrik (mixing tank, conveyor, filling line), gudang (rak palet), studio live-commerce (ring light, kamera), server room, dan studio kreatif. Ada juga Conference Hall, Library + Brain, café, lounge, pohon, mobil, dan taman. Visualnya memakai PBR + RoomEnvironment, tone mapping AgX, bloom, wall AO, contact shadow, dan tekstur kayu/plester prosedural. Geometri statis di-merge, dan kualitas menyesuaikan FPS. |
| 🧍 Karakter | Low-poly tapi unik per orang: 9 gaya rambut (termasuk hijab), outfit per peran (blazer, jas lab, coverall, kasual), rok, kacamata, jenggot, dan earpiece untuk AI. Rig bahu–siku dan pinggul–lutut membuat mereka bisa berjalan, duduk, dan mengetik. Gelembung bicara menampilkan isi pesan dan rapat sungguhan. |
| 🎮 Mode Play | Masuk sebagai karakter: WASD/joystick, kamera orang ketiga, dan collision. Tekan **E** di dekat agen untuk bicara atau memberi tugas, juga di dekat papan divisi, Brain, ruang rapat, atau café. |
| 🧠 Kesadaran agen | Tiap agen punya *self-model*: kekuatan, energi, confidence, mood, track record, dan keyakinan. Agen juga punya checklist metakognisi. Setelah tugas selesai, agen merefleksikan pelajaran, tip tim, dan kualitas kerjanya. Pelajaran itu menaikkan proficiency skill dan masuk ke **Playbook divisi**, lalu dibaca rekan kerja. |
| 🤝 Kolaborasi | `convene_meeting` menggelar rapat multi-agen yang hadir fisik di ruang rapat. Hasilnya notulen dan action item yang otomatis jadi subtask. Ada juga `ask_colleague`, `train_colleague`, `improve_skill`, `acquire_skill`, dan DM. |
| 🏗️ Organisasi dinamis | Agen bisa `recruit_agent` (satu agen atau bulk, dibuat dari brief beserta skill barunya) dan `create_division`. PA otomatis dibuat untuk setiap manusia baru. |
| 🗂️ Brain rapi otomatis | Setiap hasil kerja langsung diklasifikasikan ke folder **`<Divisi>/<Jenis>`** (Research, Strategy, Plan, Report, SOP, Policy, Content, Design, Analysis, dan lainnya) dengan judul yang bersih. Tim **Knowledge & AI Ops** bertugas menjaganya: **Arsa** (librarian) memakai `organize_brain`, `move_note`, `rename_note` (wikilink ikut diperbarui), dan `merge_notes` setiap hari. **Widya** menyintesis panduan evergreen, **Gita** membangun dataset training dengan `build_training_set`, **Sekar** mengevaluasi kualitas agen, **Hafiz** menciptakan dan menyempurnakan skill, dan **Aksa** mengurus otomasi. Brain juga punya tombol 🗂️ Rapikan. |
| ⚡ Skill & tool | Library berisi 100 skill. Setiap skill mencantumkan tool yang dibutuhkannya. Dengan **Auto-aktif** (Studio → Tool), agen yang baru dibuat atau baru mempelajari skill langsung mendapat tool-nya. Katalog skill dan tool dikelompokkan per kategori, lengkap dengan pemakai, skill terkait, dan riwayat penyempurnaan oleh agen. |
| 🎭 Agen ekspresif | Agen menampilkan emote yang muncul di atas kepala (🎉 💡 ✋ 📨 😵 👏) dan gestur: bersorak, berpikir, mengangguk, menunjuk, mengangkat bahu, tepuk tangan, dan meregang. Peserta rapat mengangguk saat setuju, dan postur agen mengikuti mood dari refleksinya. Di mode Play, agen yang Anda ajak bicara menoleh dan melambai. |
| ⏰ Otomasi | Cron 5-field (`schedule_job`/`list_jobs`): standup harian, KPI mingguan, sosial media, laporan marketplace, cek regulasi, dan retro setiap head. Agen juga punya `visit_url` (dengan SSRF guard) dan klien **MCP** (Streamable HTTP) yang tool-nya otomatis tersedia untuk agen. |
| ⚡ Hemat token | Tier model: lead dan worker memakai `gpt-oss-120b`, sedangkan chat staf, rapat, dan refleksi memakai `gpt-oss-20b`. Prefix prompt stabil dan bisa di-cache. Ada juga cache riset 6 jam, compaction konteks, batas giliran, dan budget per goal ($1,5) dan per tugas ($0,4). **Governor** menolak tugas kosong atau duplikat, inisiatif berlebihan, dan delegasi terlalu dalam. |
| 📊 Google Workspace nyata | Konektor gratis Google Apps Script untuk menambah baris Sheets, membuat file/Google Doc di Drive, dan membuat event Calendar. Agen hanya boleh mengaku berhasil jika menerima receipt berisi ID/URL/range; tanpa konektor hasil ditandai **BELUM TEREKSEKUSI**. |
| 🎙️ Rapat owner-led | Saat Owner memulai rapat, peserta masuk Conference Hall tetapi diam mendengarkan. Diskusi AI baru dimulai setelah Owner mengirim `saya selesai` atau `/selesai`. Pemilih peserta mendukung semua agen, semua kepala, per divisi, dan individu. |
| 🎓 Training | Dataset fine-tuning JSONL per agen (Pengaturan → Training) dan log feedback dari persetujuan manusia. |
| ✨ Agent Studio | Editor karyawan berlapis: identitas, instruksi, KPI, skill dengan proficiency, tool, dan knowledge. Ada AI Draft dari satu brief, bulk create, dan preview prompt final. |
| 🎯 Goal → eksekusi | Goal dikirim ke PA Anda, diteruskan ke Aria, lalu dipecah ke head divisi dan staf. Hasilnya disintesis kembali dan dilaporkan ke Anda. Persetujuan manusia hanya diminta untuk keputusan berisiko: uang, publikasi, kontrak, dan HR. |
| 🌆 Dunia | Di sekitar kantor ada skyline kota (gedung instanced dengan jendela menyala saat senja), ring road dengan mobil yang berjalan, dan lampu jalan. Ada juga gedung Ray Group Tower, Ray Beauty Plant, gedung parkir, plaza dengan air mancur, bendera, bangku, payung kafe, dan hutan pohon. Kabut sinematik mengikuti jarak kamera dan menyatu dengan sky dome, jadi ujung dunia tidak terlihat. Color grading-nya filmic dengan vignette, dan bloom hanya muncul pada lampu (tidak silau). |
| 💬 Chat cerdas | `/goal`, `/tugas @nama judul`, `/rapat`, `/cari`, `/status`, autocomplete `@nama` (dengan tim dan status), dan chip aksi cepat. |
| 📣 Broadcast hemat token | Pesan di `#general` selalu dijawab PA. Gunakan `@all`, `@kepala`, `@staff`, `#divisi`, atau hashtag keahlian untuk routing massal. Eksekusi dibagi per head divisi dan dibatasi maksimal dua konsultasi staf per divisi agar tidak memanggil seluruh model serentak. |
| 🔁 Rutinitas berscope | Target rutinitas dapat berupa semua agen, semua kepala, semua staf, satu divisi, hashtag/tim/keahlian, atau satu agen. Target massal memakai antrean koordinator divisi. |
| 🧠 Failure recovery | Kegagalan menjadi failure case di Playbook dan channel divisi/Knowledge & AI Ops, memakai retry dengan backoff, lalu handoff otomatis ke agen cadangan bila tiga percobaan gagal. |
| ⚡ Auto-approve | Mode auto-approve melanjutkan pekerjaan tanpa klik manual sambil tetap menyimpan keputusan sebagai audit trail. |
| 📋 Tugas cerdas | Lensa: sedang dikerjakan, macet, butuh keputusan, prioritas tinggi, selesai hari ini, dan inisiatif agen. Ada juga rata-rata waktu selesai dan biaya AI. |
| 📋 Tugas · 💬 Chat · 🧠 Brain · 📊 Dashboard | Kanban dengan jejak kerja (pikiran, tool call, biaya). Chat berisi channel divisi, DM, dan notulen rapat. Brain berisi 42 catatan (SOP 18 divisi, produk, pedoman klaim kosmetik, kalender kampanye). Dashboard menampilkan KPI, hierarki, dan biaya per model. |

UI-nya memakai navigasi sidebar berkelompok yang bisa diciutkan, ikon SVG, tema gelap/terang, dan bottom nav di HP.

## Organisasi bawaan
Setiap divisi dibagi menjadi tim. Contohnya Marketing: Brand & Comms, Content & Social, Performance & Growth, dan CRM & Partnerships. Daftar tim ada di `server/roster-teams.js`.

19 divisi, termasuk **Knowledge & AI Ops**: Executive, Marketing (termasuk digital marketing, performance ads, SEO, KOL, community), Sales, Product & Engineering, Creative & Design, Customer Success, Finance, People & HR, Operations, Legal & Compliance, IT & Security, Data & Research, **R&D & Formulation**, **Manufacturing**, **Quality Control & Assurance**, **Regulatory Affairs** (BPOM, halal), **Supply Chain & Warehouse**, dan **E-commerce & Marketplace** (marketplace specialist, live commerce, marketplace ads). Library skill berisi 65 skill.

## Struktur

```
server/
  index.js       HTTP API + SSE realtime + static, memuat .env
  engine.js      scheduler, loop agen (tool use), delegasi, approval, cron, chat
  governor.js    guardrail: dedup, batas inisiatif, budget, tier model, cache, compaction
  librarian.js   klasifikasi Divisi/Jenis, rename + relink, merge duplikat, dataset training
  roster-teams.js divisi Knowledge & AI Ops, 37 agen spesialis, tim per divisi
  collab.js      rapat, ask/train colleague, refleksi, self-model, cron parser, visit_url, MCP
  org.js         rekrut agen / divisi (bulk)
  llm.js         provider Groq + Claude, rotasi model, riset web, biaya
  roster.js      divisi inti + PA + master orchestrator (+ roster-extra.js)
  catalog.js     library skill (+ skills-extra.js, skills-deep.js) + capability + auto-aktif
  studio.js      generator karyawan/skill dari brief
  store.js       database JSON (data/db.json) + migrasi v4
  seed.js        knowledge, channel, rutinitas cron
public/js/
  office3d.js    scene 3D, world builder, mode play, emote & gestur
  environment.js kota, jalan, lalu lintas, plaza, kabut, color grading
  furniture.js   furnitur & material prosedural
  people.js      karakter + rig
```

## Menghubungkan Google Workspace (gratis)

1. Buat project baru di [Google Apps Script](https://script.google.com), lalu salin isi `integrations/google-apps-script/Code.gs`.
2. Jalankan `setRayAgentSecret('secret-acak-minimal-16-karakter')` satu kali dari editor.
3. Pilih **Deploy → New deployment → Web app**, jalankan sebagai akun Anda, lalu salin URL `/exec`.
4. Di Ray Office buka **Pengaturan → Google Workspace**, isi URL dan secret yang sama, simpan, lalu tekan **Tes + verifikasi receipt**.

Setelah tes sukses, tool `google_sheets_append`, `google_drive_create`, dan `google_calendar_create` tersedia untuk seluruh agen. Setiap eksekusi tercatat di jejak tugas sebagai `external_receipt`.

`npm run reset` mengembalikan data ke kondisi awal (API key tetap disimpan).
