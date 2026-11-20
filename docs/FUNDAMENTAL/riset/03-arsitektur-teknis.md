# Riset 03: Arsitektur teknis produk seperti ChatGPT, dan pelajaran untuk RAIVERSE

Ditulis 2026-11-19. Bahasa sederhana. Tanda: **[F]** = fakta dengan URL sumber; **[K]** = kesimpulan saya; **[?]** = tidak dipublikasikan / belum terverifikasi.

## 0. Catatan kejujuran tentang sumber

- Situs `openai.com/index/...` dan `help.openai.com` menolak pengambilan otomatis (HTTP 403) saat riset ini. Isi artikel OpenAI tersebut saya ambil dari **ringkasan pihak ketiga dan cuplikan hasil pencarian**, bukan dari halaman aslinya. Itu saya tandai "(via ringkasan)". Periksa halaman asli sebelum mengutip angka.
- Halaman yang berhasil dibaca langsung: dokumen `developers.openai.com` (streaming, background mode, rate limits, data controls, safety best practices), dokumen Agents SDK (guardrails, tracing), dan blog ClickHouse tentang observabilitas OpenAI.
- **Sebagian besar detail internal ChatGPT TIDAK dipublikasikan**: bentuk skema basis data percakapan, cara persis memori disimpan, protokol streaming aplikasi web (bukan API), isi sandbox, ambang kuota, model biaya. Yang ada hanya: beberapa pos-mortem, satu artikel PostgreSQL, satu studi kasus observabilitas, dokumen API, kartu sistem, dan pengamatan peneliti luar.
- Dokumen API bukan sama dengan aplikasi ChatGPT. Jangan menganggap pola API otomatis berlaku di aplikasi.

## 1. Ringkasan 10 baris

1. OpenAI hanya membuka sedikit detail arsitektur ChatGPT; yang terbuka kuat adalah PostgreSQL, pos-mortem Redis 2023, observabilitas ClickHouse, dan dokumen API.
2. Streaming respons memakai SSE (server-sent events) dengan event bertipe; mudah ditiru di Node tanpa framework. [F]
3. Basis data inti ChatGPT: satu PostgreSQL primer untuk tulis + sekitar 50 replika baca; beban tulis yang bisa dipecah dipindah ke penyimpanan lain. [F via ringkasan]
4. Pelajaran terbesar skala: lindungi basis data (pooler, cache dengan kunci/lease, pembatasan laju di tiap lapis, pisahkan trafik prioritas rendah/tinggi, batasi perubahan skema). [F via ringkasan]
5. Pos-mortem Maret 2023: bug pustaka klien Redis membuat pengguna melihat judul chat dan data tagihan orang lain; pelajaran: cache bersama + koneksi yang dibatalkan = risiko kebocoran lintas pengguna. [F]
6. Memori ChatGPT dibagi dua: "memori tersimpan" yang bisa dilihat/dihapus dan "referensi riwayat chat" yang implisit; ada mode Temporary Chat tanpa memori. [F via ringkasan]
7. Aksi agen berisiko diberi konfirmasi pengguna, mode awasi (watch), dan pemantau injeksi prompt; guardrail dipasang sebelum/sesudah alat. [F]
8. Sandbox kode: pengamatan luar menunjukkan gVisor di Kubernetes tanpa jaringan keluar; OpenAI tidak mengonfirmasi rinci. [F via pengamat, resmi tidak ada]
9. Privasi: penghapusan chat dalam 30 hari, retensi nol bisa diajukan, prediksi usia dan kontrol orang tua untuk remaja. [F]
10. Untuk RAIVERSE (Node tanpa framework): sebagian besar pola sudah ada (gerbang kuota, persetujuan manusia, enkripsi); celah terbesar ada di keandalan streaming, antrean/beban, observabilitas terstruktur, dan batas data pada cache bersama.

## 2. Peta komponen: yang diketahui dan yang TIDAK diketahui

```
Klien
├─ Web (browser)
│   ├─ Diketahui: pola SSE untuk token [F API]; tumpukan front-end (React Router dll) hanya dugaan blog luar [?]
│   └─ Tidak diketahui: protokol streaming internal aplikasi, cara menyambung ulang aliran
├─ Desktop / seluler
│   └─ Tidak diketahui: arsitektur internal (tidak saya temukan sumber resmi) [?]
Tepi (edge)
│   └─ Tidak diketahui: CDN, WAF, anti-bot yang dipakai (tidak ada sumber resmi) [?]
Layanan aplikasi (ChatGPT backend)
├─ Diketahui: memakai Redis sebagai cache sesi/pengguna, klien asyncio, cluster [F: pos-mortem 2023]
├─ Diketahui: PostgreSQL primer + ~50 replika, PgBouncer di Kubernetes, Cosmos DB untuk tulis berat [F via ringkasan]
└─ Tidak diketahui: skema percakapan/pesan, layanan antrean, pembagian layanan mikro
Inferensi model
│   └─ Tidak diketahui: penjadwalan GPU, batching; yang terbuka hanya perilaku API (cache prompt, batas laju)
Alat dan eksekusi kode
├─ Diketahui (pengamat): gVisor + Kubernetes, tanpa jaringan keluar, pengguna tak-istimewa [F via pengamat]
└─ Tidak diketahui: pengelolaan siklus hidup sandbox, batas sumber daya persis
Memori, berkas, pencarian
└─ Diketahui di tingkat fitur (help center); penyimpanan internal tidak dipublikasikan [?]
Keselamatan dan privasi
└─ Diketahui di tingkat kebijakan, kartu sistem, prediksi usia; model klasifier internal tidak terbuka
Observabilitas
└─ Diketahui: log ke ClickHouse (90 shard x 2 replika, petabita/hari) [F]
```

## 3. Pola per bidang

### 3.1 Streaming respons
- [F] API memakai `stream=true`, HTTP streaming SSE; tiap event punya `type` (contoh `response.created`, `response.output_text.delta`, `response.completed`, `error`). https://developers.openai.com/api/docs/guides/streaming-responses
- [F] Dokumen mengingatkan: keluaran sebagian lebih sulit dimoderasi; skor moderasi baru tiba setelah seluruh keluaran siap. (sumber sama)
- [F] Mode latar (background): status `queued`/`in_progress`, polling tiap ~2 detik, dan sambung ulang aliran dengan `starting_after = sequence_number` terakhir; event keepalive tidak boleh dijadikan titik sambung. https://developers.openai.com/api/docs/guides/background
- [F] Mode latar menyimpan data sementara terenkripsi walau `store=false`. (sumber sama)
- [K] Pola yang bisa ditiru: event bertipe + nomor urut + titik sambung. Server menyimpan buffer kecil per jawaban (di memori, dengan batas) agar klien yang putus bisa melanjutkan tanpa mengulang model.
- [?] Cara aplikasi web ChatGPT menyambung ulang: tidak dipublikasikan.

### 3.2 Memori
- [F via ringkasan] Dua sistem: memori tersimpan (diminta eksplisit, bisa ditinjau, dihapus satu per satu, atau dimatikan) dan referensi riwayat chat (implisit, berubah mengikuti apa yang dianggap berguna). Menghapus chat tidak menghapus memori tersimpan; keduanya harus dihapus. Temporary Chat tidak memakai/membuat memori. Log memori terhapus dapat disimpan sampai 30 hari untuk keamanan. Sumber: https://help.openai.com/en/articles/8590148-memory-in-chatgpt dan https://help.openai.com/en/articles/10303002-how-does-memory-use-pastconversations (kedua halaman 403 untuk saya; ringkasan dari hasil pencarian).
- [F via ringkasan] Mematikan "reference chat history" menjadwalkan penghapusan informasi dari riwayat dalam 30 hari. (sama)
- [F via penilai luar, bukan OpenAI] Penulisan memori yang dipicu oleh isi dokumen tak tepercaya adalah risiko injeksi. https://airq.adversa.ai/agent/chatgpt-agent
- [K] Pola: memori kecil, terlihat, bisa dikoreksi pengguna, dan terpisah dari riwayat. Penulisan memori oleh model harus lewat persetujuan atau ditandai bila asalnya dari isi tak tepercaya.
- [?] Format penyimpanan dan cara penyuntikan ke prompt: tidak dipublikasikan.

### 3.3 Riwayat dan penyimpanan percakapan
- [F via ringkasan] Basis data inti: satu primer PostgreSQL untuk semua tulis, sekitar 50 replika baca lintas wilayah, ~800 juta pengguna, beban naik >10x dalam setahun. Penulis: Bohan Zhang, 22 Jan 2026. https://openai.com/index/scaling-postgresql/ (403; isi dari https://blog.bytebytego.com/p/how-openai-scaled-to-800-million dan https://www.infoq.com/news/2026/02/openai-runs-chatgpt-postgres)
- [F via ringkasan] Tidak di-shard karena akan mengubah ratusan endpoint; beban tulis yang bisa dipecah dipindah ke Azure Cosmos DB; fitur baru yang butuh tabel baru diarahkan ke Cosmos DB, bukan menambah tabel PostgreSQL.
- [F via ringkasan] Aturan skema: hanya perubahan ringan, batas waktu 5 detik per perubahan skema, indeks dibuat/dihapus secara concurrent, hindari penulisan ulang tabel penuh.
- [F via ringkasan] Mengurangi tulis: perbaiki tulis berlebih, tulis malas (lazy write) untuk meratakan lonjakan, backfill dibatasi laju (bisa lebih dari seminggu).
- [F via ringkasan] Gabungan 12 tabel pernah memicu insiden berat; logika join dipindah ke aplikasi; SQL dari ORM ditinjau manual; `idle_in_transaction_session_timeout` dipasang.
- [K] Untuk platform kecil: satu penulis + salinan baca cukup; yang penting adalah disiplin tulis (kurangi tulis berlebih, tulis malas, batas waktu perubahan skema).

### 3.4 Berkas
- [F via ringkasan] Berkas unggahan dan penyimpanan vektor tinggal "sampai dihapus" di API; ingest ke vector store dibatasi 300 permintaan/menit per penyimpanan. Sumber: https://developers.openai.com/api/docs/guides/your-data dan https://developers.openai.com/api/docs/guides/rate-limits
- [F] Berkas/gambar yang ditandai kemungkinan CSAM tetap disimpan untuk tinjauan manual, bahkan di retensi nol. https://developers.openai.com/api/docs/guides/your-data
- [?] Batas ukuran/jumlah berkas di aplikasi ChatGPT: halaman FAQ unggah berkas tidak bisa saya baca; jangan kutip angka dari memori.
- [K] Pola: simpan berkas di luar basis data utama (disk/objek), simpan hanya metadata di basis data, beri kedaluwarsa dan jejak hapus.

### 3.5 Alat dan sandbox kode
- [F via pengamat] Analisis luar menunjukkan interpreter kode memakai gVisor, berjalan sebagai pengguna tak-istimewa, tanpa akses jaringan keluar, dengan jejak variabel lingkungan Kubernetes. https://itnext.io/openais-code-execution-runtime-replicating-sandboxing-infrastructure-a2574e22dc3c (403 untuk saya), https://pncnmnp.github.io/blogs/chatgpt-containers.html, dan ringkasan analisis AntTech lewat pencarian. OpenAI tidak mengonfirmasi detailnya. [?]
- [F] Loop agen Codex tidak memakai `previous_response_id` agar permintaan tetap tanpa status (stateless) dan cocok dengan retensi nol; konten statis ditaruh di awal prompt demi cache prompt; riwayat dipadatkan otomatis di atas ambang. Michael Bolin, 23 Jan 2026. https://openai.com/index/unrolling-the-codex-agent-loop (via ringkasan; sandbox tidak terkonfirmasi di sana)
- [F] Cache prompt dapat menyimpan tensor terenkripsi di penyimpanan GPU lokal hingga 24 jam. https://developers.openai.com/api/docs/guides/your-data
- [F] Guardrail Agents SDK: input, output, dan **tool guardrail** (dicek sebelum dan sesudah tiap panggilan alat); tripwire menghentikan eksekusi; mode paralel (cepat, boleh sudah memakai token) atau blocking (tidak menjalankan agen bila gagal). Disarankan memakai model murah/cepat untuk pemeriksaan. https://openai.github.io/openai-agents-python/guardrails/
- [K] Pola ringan: alat berisiko dijalankan di proses/folder terpisah tanpa jaringan, batas waktu dan memori, tidak mewarisi rahasia server. Di Node: proses anak dengan `--permission` (bila tersedia), lingkungan bersih, folder kerja sementara, batas waktu.

### 3.6 Keamanan dan persetujuan aksi
- [F via help center/ringkasan] ChatGPT agent: konfirmasi pengguna untuk aksi berdampak besar, penolakan untuk tugas terlarang, pemantauan injeksi prompt, dan "watch mode" pada situs tertentu; OpenAI menyebut langkah ini mengurangi risiko, tidak menghilangkannya. https://help.openai.com/en/articles/11752874-chatgpt-agent
- [F via kutipan peneliti OpenAI] Model dilatih mengabaikan instruksi mencurigakan di situs berisiko, dan ada monitor yang menghentikan agen bila perilaku mencurigakan. https://decrypt.co/330714/openais-chatgpt-agent-launches-expanded-powers-elevated-risk
- [F via ringkasan] Panduan agen OpenAI: beri peringkat risiko tiap alat dan wajibkan manusia untuk yang berisiko tinggi; dua pemicu intervensi manusia: ambang kegagalan terlampaui dan aksi berisiko tinggi; guardrail berlapis (klasifier relevansi/keamanan, filter PII, moderasi, blocklist regex). https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf (PDF tidak terbaca langsung; lihat ringkasan di https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/)
- [F via kritik luar] Aktivasi watch mode memakai klasifikasi heuristik, bukan aturan deterministik. https://airq.adversa.ai/agent/chatgpt-agent
- [F] Pos-mortem 20 Maret 2023: perubahan server menaikkan pembatalan permintaan Redis, bug di klien redis-py asyncio untuk Redis Cluster membuat koneksi bisa mengembalikan data pengguna lain; sekitar 1,2% pelanggan Plus mungkin terlihat data tagihan dalam jendela 9 jam. https://openai.com/index/march-20-chatgpt-outage (via https://www.helpnetsecurity.com/2023/03/27/chatgpt-data-leak/ dan https://thehackernews.com/2023/03/openai-reveals-redis-bug-behind-chatgpt.html; halaman asli 403)
- [K] Pelajaran: (a) kunci cache wajib memuat id pengguna/ruang kerja; (b) kegagalan koneksi bersama tidak boleh menyisakan respons yang salah pasangan; (c) uji kebocoran lintas pengguna sebagai tes tetap.

### 3.7 Pembatasan dan kuota
- [F] Batas diukur RPM, RPD, TPM, TPD (dan gambar/audio); mana yang tercapai lebih dulu berlaku; per organisasi dan proyek; tingkat naik otomatis menurut pembelian kredit; batas belanja keras mengembalikan 429. https://developers.openai.com/api/docs/guides/rate-limits
- [F] Header: `x-ratelimit-limit/remaining/reset-requests|tokens`, `Retry-After` pada 429 dan 503. Kode `slow_down` = laju naik terlalu cepat; naikkan beban tidak lebih dari 50% per 15 menit. Jangan ulangi kesalahan kuota/tagihan. Gunakan backoff eksponensial + jitter, batasi jumlah percobaan. (sumber sama)
- [F] Token yang dihitung untuk batas = yang lebih besar antara `max_tokens` dan estimasi dari panjang permintaan; set `max_tokens` dekat ukuran jawaban yang diharapkan. (sumber sama)
- [F] Beban tak mendesak bisa lewat Batch API di luar batas sinkron. (sumber sama)
- [?] Batas pesan per jam di aplikasi ChatGPT dan cara penegakannya: tidak dipublikasikan di sumber yang saya baca.
- [K] Pola: kuota ganda (laju per menit + anggaran harian), header sisa kuota ke klien, `Retry-After`, dan backoff dengan jitter.

### 3.8 Skala dan keandalan
- [F via ringkasan] PgBouncer (mode statement/transaction) per replika di Kubernetes; waktu koneksi rata-rata turun 50 ms menjadi 5 ms; batas koneksi Azure 5.000 pernah menimbulkan badai koneksi dan gangguan.
- [F via ringkasan] Cache dengan **cache locking/leasing**: satu permintaan mengisi ulang kunci yang hilang, yang lain menunggu, supaya cache miss tidak membanjiri basis data.
- [F via ringkasan] Pembatasan laju di lapis aplikasi, pooler, proxy, dan query; jeda ulang tidak terlalu pendek (cegah badai retry); ORM bisa memblokir pola query saat lonjakan.
- [F via ringkasan] Trafik prioritas rendah dan tinggi dipisah ke instans berbeda.
- [F via ringkasan] Primer HA dengan hot standby; replika punya kapasitas cadangan; hasil: lag replikasi mendekati nol, p99 puluhan milidetik, ketersediaan lima sembilan, satu insiden SEV-0 dalam 12 bulan saat peluncuran ImageGen (tulis naik >10x, >100 juta pendaftar seminggu). Sumber: https://blog.bytebytego.com/p/how-openai-scaled-to-800-million
- [F] Bendera mode latar dan jendela penyelesaian (`soonest`, 2h, 8h) memungkinkan menggeser pekerjaan lambat dari jalur interaktif.
- [K] Untuk Node kecil: satu proses + antrean dalam memori dengan batas, pemisahan jalur interaktif vs latar, cache dengan satu pengisi per kunci (single-flight), dan "load shedding" (tolak dini dengan 429/503 + `Retry-After`).

### 3.9 Observabilitas
- [F] Log lewat Fluent Bit -> penyeimbang beban -> ClickHouse (90 shard x 2 replika); petabita log per hari, tumbuh >20% per bulan; ~80% query hanya menyentuh 2 hari terakhir (disimpan di disk, sisanya di blob); replika ketiga khusus query agar ingest tidak terganggu. https://clickhouse.com/blog/why-openai-uses-clickhouse-for-petabyte-scale-observability
- [F] Insiden 25 Maret 2025 (peluncuran gambar GPT-4o): volume log naik ~50% semalam; mitigasi sampling; akar masalah pembagian di filter Bloom; perbaikan menurunkan CPU ~40%. (sumber sama)
- [F] Agents SDK: pelacakan (trace) aktif secara bawaan; satu trace = satu alur kerja; span untuk panggilan model, alat, guardrail; `trace_include_sensitive_data` bawaan True dan bisa dimatikan; prosesor bisa diganti untuk redaksi. https://openai.github.io/openai-agents-python/tracing/
- [K] Pola: log JSON baris-per-peristiwa dengan id korelasi (trace id) per goal; simpan hari terbaru "panas", arsip "dingin"; redaksi PII sebelum menulis log.
- [?] Pelacakan internal ChatGPT, SLO, dan alarm: tidak dipublikasikan.

### 3.10 Keselamatan konten dan privasi (termasuk anak)
- [F] Moderation API gratis, bisa meminta skor bersama pembuatan teks; uji adversarial; manusia dalam lingkaran; batasi panjang input dan token keluaran; pakai pilihan dropdown bila bisa; kirim `safety_identifier` (id pengguna yang di-hash) agar penyalahgunaan satu orang tidak menghukum yang lain; sediakan jalur lapor pengguna. https://developers.openai.com/api/docs/guides/safety-best-practices
- [F] Data API tidak dipakai melatih model kecuali opt-in; log pemantauan penyalahgunaan hingga 30 hari; Zero Data Retention dan Modified Abuse Monitoring butuh persetujuan; `store` bawaan menyimpan respons 30 hari; kunci enkripsi milik pelanggan (EKM). https://developers.openai.com/api/docs/guides/your-data
- [F via ringkasan] Penghapusan permanen chat dihapus dari sistem dalam 30 hari (termasuk Temporary Chat), dengan pengecualian hukum/keamanan; perintah pelestarian dalam gugatan NYT berakhir 26 Sep 2025; Enterprise dikecualikan. https://openai.com/index/response-to-nyt-data-demands/ (403; via https://gizmodo.com/openai-will-stop-saving-users-deleted-posts-2000671374)
- [F via ringkasan] Prediksi usia (diumumkan 20 Jan 2026): memperkirakan apakah akun di bawah 18, bukan hanya dari tanggal lahir yang diisi; bila ragu, **default ke pengalaman di bawah 18**; orang dewasa yang salah tebak bisa verifikasi selfie lewat pihak ketiga (Persona); kontrol orang tua (jam tenang, memori, pelatihan model, peringatan tanda tekanan akut) tanpa akses ke isi percakapan. https://openai.com/index/our-approach-to-age-prediction/ (via https://www.helpnetsecurity.com/?p=354038 dan https://the-decoder.com/openai-rolls-out-age-prediction-to-apply-teen-safeguards-in-chatgpt/)
- [K] Pola data anak untuk platform kecil: jangan kumpulkan umur lebih dari perlu; bila ada kemungkinan anak, default ke mode lebih aman; orang tua mengatur tanpa membaca isi; retensi pendek; jangan melatih dengan data anak.

## 4. PEMETAAN KE RAIVERSE

Kondisi RAIVERSE diambil dari `docs/PETA-BACKEND.md` dan `docs/PETA-OTAK.md` (dibaca hari ini). Yang tidak tertulis di sana saya tandai "tidak terdokumentasi", bukan "tidak ada".

| Pola | Kondisi RAIVERSE sekarang | Celah | Saran konkret yang ringan |
|---|---|---|---|
| Streaming bertipe + sambung ulang | Siaran langsung ke layar lewat `index.js` (REST + siaran); mekanisme sambung ulang tidak terdokumentasi | Belum jelas ada nomor urut event dan buffer pemulihan | Beri tiap event siaran `seq`; simpan 200 event terakhir per goal di memori; klien kirim `Last-Event-ID`/`starting_after`; tanpa mengulang model |
| Memori terlihat dan bisa dikoreksi | `memory-lite.js`: catatan kecil, usul agen menunggu persetujuan pengguna; Brain dengan tanda kepercayaan (Owner/Drive/Sistem = fakta, hasil agen = draf) | Sudah lebih ketat dari ChatGPT. Belum terdokumentasi: tanda bila usulan memori berasal dari isi web/berkas tak tepercaya | Tambah bidang `asal` (owner/web/berkas/model) di usulan memori dan tampilkan di kartu persetujuan |
| Riwayat dan basis data | `store.js`: satu proses, json/dual/sqlite; ruang kerja terpisah (`data/ws/<id>`); `session-search.js`; retensi pesan 365 hari | Mode json menulis seluruh berkas; risiko tulis berlebih bila banyak pengguna | Tulis malas (debounce) + satu penulis; sqlite WAL untuk ruang kerja aktif; aturan "migrasi skema dengan batas waktu" ala 5 detik |
| Berkas | `data/uploads/`, `data/staff-out/`, Google Drive; sampah 7 hari | Batas ukuran/kuota berkas per ruang kerja tidak tertulis di peta | Kuota byte per ruang kerja + penghapus terjadwal; metadata saja di basis data |
| Alat dan sandbox | Staf nyata `staff/native.js` (langkah pasti, bukan kode bebas); alat per peran ditegakkan dua kali; browser agen dengan pagar domain/sandi/pembayaran; PII disamarkan sebelum ke model | Tidak ada eksekusi kode bebas (baik). Bila kelak ada, belum ada sandbox | Tetap jangan beri eksekusi kode bebas; bila perlu, proses anak tanpa jaringan + lingkungan bersih + batas waktu/memori |
| Persetujuan aksi | `approvals.js` satu pintu; review/otomasi/aksi browser tidak pernah disetujui otomatis; Pemandu berhenti di kartu konfirmasi | Peringkat risiko per alat belum tertulis eksplisit sebagai tabel; "ambang kegagalan berulang" ke manusia tidak terdokumentasi | Tabel risiko per alat (rendah/sedang/tinggi) di `catalog.js`; tugas yang gagal 3x berturut-turut otomatis menjadi kartu "Butuh kamu" |
| Guardrail input/output | Kamus kata teknis; isi web dianggap data bukan perintah; `ROUTINE_BLOCK`/`MASS_BLOCK` | Belum terdokumentasi: pemeriksaan keluaran sebelum dikirim ke saluran luar (Telegram/Discord) | Guardrail murah (aturan + model kecil) pada keluaran yang keluar dari sistem; tripwire = berhenti + kartu |
| Injeksi prompt | Isi web/halaman = data; kunci AI tidak pernah ke klien/n8n; token pendek per eksekusi (`gate.js`) | Tes otomatis injeksi belum terdokumentasi | Set tes "halaman berisi perintah palsu" yang dijalankan di `npm test` |
| Kuota dan laju | `limits.edge` (per IP), `limits.user` (harian, anggaran global), `governor` (anggaran per ruang kerja, kuota tugas 300/hari); `createTask` satu gerbang | Header `Retry-After`/sisa kuota untuk klien tidak terdokumentasi; jitter pada percobaan ulang ke LLM tidak terdokumentasi | Kembalikan `Retry-After` + `x-ratelimit-remaining`; backoff eksponensial + jitter di `llm.js`; jangan ulangi galat kuota |
| Skala dan keandalan | `maxConcurrent` 3 per ruang kerja; `STORE_LAZY`, `STORE_IDLE_MS`; pilihan model termurah yang cukup | Pemisahan jalur interaktif vs latar (obrolan vs tugas massal) tidak tertulis; belum ada load shedding tertulis | Dua antrean: obrolan (prioritas) dan tugas latar; tolak dini 503 + `Retry-After` saat antrean melewati batas; single-flight untuk cache |
| Cache bersama | `brain`/indeks di memori per ruang kerja; `STORE_LAZY` memuat ruang kerja sesuai kebutuhan | Risiko kebocoran lintas ruang kerja bila ada cache global (pelajaran Redis 2023) | Semua kunci cache diawali `wsId:userId:`; tes "pengguna A tidak pernah melihat data B" |
| Observabilitas | Log audit di `data/admin.json`; riwayat tugas dengan `STORE_TASK_LOG_CAP` 300 | Belum terdokumentasi: id korelasi per goal, metrik latensi/biaya per langkah, redaksi log | JSONL harian `data/log/YYYY-MM-DD.jsonl` dengan `traceId`, durasi, token, biaya; redaksi PII; rotasi 14 hari |
| Privasi dan retensi | `privacy.js` ekspor/hapus akun; sampah 7 hari; retensi pesan 365, peristiwa 90 hari; kunci dan token dienkripsi (`secure.js`) | Mode "obrolan sementara" tanpa memori/riwayat tidak terdokumentasi; hapus-menyeluruh termasuk cadangan (`data/backups/`) tidak tertulis | Tombol "obrolan sementara"; kebijakan: cadangan lebih tua dari 30 hari dihapus; catat jadwal penghapusan |
| Data anak dan usia | Tidak terdokumentasi di dua peta | Tidak ada kebijakan tertulis tentang pengguna di bawah umur | Bila produk terbuka untuk umum: syarat usia di pendaftaran, mode aman bawaan saat ragu, tanpa pelatihan dari data pengguna; konsultasi hukum setempat (UU PDP) |
| Pemisah data per pengguna | Login Google, anggota hanya melihat ruang kerjanya; pengelola 403 seragam | Sudah baik; uji lintas pengguna perlu dijaga | Tes invarian "tidak ada jalur baca lintas ruang kerja" di `check:invariants` |

## 5. Risiko dan hal yang JANGAN ditiru

- Jangan meniru skala: PostgreSQL + 50 replika, ClickHouse 90 shard, Kubernetes. Terlalu berat untuk platform ringan. Tiru **disiplinnya**, bukan alatnya. [K]
- Jangan menganggap angka OpenAI (lima sembilan, p99 milidetik) sebagai target; itu hasil tim dan anggaran besar. [K]
- Jangan memakai satu cache bersama tanpa kunci per pengguna/ruang kerja (kebocoran 2023). [F]
- Jangan mengandalkan klasifikasi heuristik saja untuk menentukan aksi berbahaya; pakai aturan deterministik (daftar putih) lalu model. [F via kritik luar, K]
- Jangan menyimpan memori yang dipicu isi tak tepercaya tanpa konfirmasi. [F via kritik luar]
- Jangan menjalankan guardrail secara paralel untuk aksi yang punya efek samping; pakai mode blocking untuk alat berisiko (paralel boleh menghabiskan token/menjalankan alat sebelum gagal). [F]
- Jangan mengaktifkan pelacakan dengan isi sensitif secara bawaan (bawaan SDK OpenAI: True). Untuk RAIVERSE bawaan sebaiknya False. [F + K]
- Jangan menjanjikan "dihapus" bila cadangan masih ada. OpenAI sendiri memberi jendela 30 hari. [F via ringkasan]
- Jangan meniru retensi log jangka panjang dengan isi percakapan; log cukup metadata. [K]
- Jangan menyatakan kepatuhan hukum (COPPA/GDPR/UU PDP) dari dokumen ini; riset ini bukan nasihat hukum. [K]
- Beberapa sumber di atas adalah blog pihak ketiga yang bisa menyederhanakan; angka penting harus dicek ke sumber primer. [K]

## 6. Sepuluh rekomendasi, urut dampak dan kemudahan

| # | Rekomendasi | Dampak | Kemudahan | Alasan singkat |
|---|---|---|---|---|
| 1 | Tes invarian "tidak ada kebocoran lintas ruang kerja/pengguna" + kunci cache berawalan `wsId:userId:` | Tinggi | Mudah | Pelajaran paling mahal OpenAI (2023) |
| 2 | Event siaran bernomor `seq` + buffer 200 event + `Last-Event-ID` | Tinggi | Sedang | Layar tidak putus-putus saat jaringan buruk, tanpa mengulang model |
| 3 | `Retry-After` + header sisa kuota + backoff eksponensial berjitter di `llm.js`; jangan ulangi galat kuota | Tinggi | Mudah | Pola dokumen resmi, murah |
| 4 | Tabel risiko per alat + tugas gagal 3x otomatis ke manusia | Tinggi | Mudah | Pemicu intervensi manusia ala panduan agen |
| 5 | Dua antrean (obrolan prioritas vs latar) + load shedding 503 | Tinggi | Sedang | Pisahkan trafik prioritas seperti OpenAI, tanpa infrastruktur baru |
| 6 | Log JSONL dengan `traceId` per goal, durasi, token, biaya; redaksi PII; rotasi | Tinggi | Sedang | Observabilitas tanpa layanan eksternal |
| 7 | Single-flight cache + tulis malas (debounce) + batas waktu migrasi skema | Sedang | Mudah | Cegah badai cache miss dan tulis berlebih |
| 8 | Guardrail keluaran sebelum keluar ke Telegram/Discord/Drive (blocking untuk aksi berefek samping) | Sedang | Sedang | Tool guardrail ala Agents SDK |
| 9 | Obrolan sementara + kebijakan hapus cadangan 30 hari + catat jadwal penghapusan | Sedang | Sedang | Janji privasi yang bisa ditepati |
| 10 | Tes injeksi prompt otomatis + tanda `asal` pada usulan memori + kebijakan tertulis data anak/usia (konsultasi hukum) | Sedang | Sulit | Menutup risiko yang dikritik pada agen ChatGPT dan menyiapkan publik |

## 7. Daftar sumber utama

- Dokumen API (dibaca langsung): https://developers.openai.com/api/docs/guides/streaming-responses ; /background ; /rate-limits ; /your-data ; /safety-best-practices
- Agents SDK (dibaca langsung): https://openai.github.io/openai-agents-python/guardrails/ ; /tracing/
- ClickHouse (dibaca langsung): https://clickhouse.com/blog/why-openai-uses-clickhouse-for-petabyte-scale-observability
- PostgreSQL (primer 403, via ringkasan): https://openai.com/index/scaling-postgresql/ ; https://blog.bytebytego.com/p/how-openai-scaled-to-800-million ; https://www.infoq.com/news/2026/02/openai-runs-chatgpt-postgres
- Pos-mortem Redis (primer 403, via ringkasan): https://openai.com/index/march-20-chatgpt-outage ; https://www.helpnetsecurity.com/2023/03/27/chatgpt-data-leak/
- Memori, agen, usia (primer 403, via ringkasan): https://help.openai.com/en/articles/8590148-memory-in-chatgpt ; https://help.openai.com/en/articles/11752874-chatgpt-agent ; https://openai.com/index/our-approach-to-age-prediction/
- Codex agent loop (via ringkasan): https://openai.com/index/unrolling-the-codex-agent-loop
- Panduan agen (via ringkasan): https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- Sandbox (pengamat luar, tidak resmi): https://pncnmnp.github.io/blogs/chatgpt-containers.html
- Dokumen sandbox/persetujuan Codex: tidak berhasil dibaca (halaman yang terbuka hanya tentang Codex Security). Pola sandbox/persetujuan Codex di sini tidak saya klaim.
