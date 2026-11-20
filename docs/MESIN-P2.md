# Mesin (Fase P2)

Status: selesai dan teruji, 2026-11-18. Rencana induk: `docs/arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md` (temuan 1, 9, 16, 17). Pagar: `docs/PAGAR-SINKRONISASI.md`. Arsitektur staf: `docs/ARSITEKTUR-STAF-N8N.md`.
Kode: `server/catalog.js` (peran dan kelompok alat), `server/approvals.js` (baru), `server/governor.js` (kuota), `server/engine.js` (pintu alat, prompt, status). Tes: `test/invariants.test.js` (INV5d, INV6a, INV6b, INV7, INV8, INV10, INV11b).

## 1. Alat per peran: satu pintu kecil

Yang dilihat agen = **dasar peran** + kelompok yang dibuka lewat tool `buka_alat(kelompok, alasan)` untuk **satu tugas**. Izin data (`e.tools`) tidak diubah; penyaringnya `catalog.roleAllows` dan `catalog.coreToolIds`, satu-satunya sumber daftar alat adalah `engine.visibleTools`. Peran dibaca dari medan `role` (P1) bila ada, bila tidak dari `isPA/isMaster/isLead`.

| Peran | Alat terlihat | Sebelum | Sesudah |
|---|---|---|---|
| Staf (daun) | `complete_task`, `search_brain`, `web_search`, `calculate`, `request_approval`, `buka_alat`, + `staf` bila punya staf siap | 31–32 | **7** |
| Manajer divisi | daun, tanpa `staf` bila tidak ada, + `create_subtask`, `ask_colleague`, `convene_meeting` | 32 | **10** |
| Master | manajer + `company_status` | 31 | **11** |
| Asisten pribadi | master (tanpa `staf` karena PA tidak punya staf) | 31 | **10–11** |

Diukur dari seed pada keadaan yang sama (alat `buka_browser` ikut terhitung di "sebelum" bila agen boleh). Tes memeriksa **semua** agen AI di seed, bukan contoh: daun < 8, PA/master/manajer < 12.

Daftar "sebelum" untuk staf pemasaran (Raka), 32 tool: `recruit_agent, create_division, train_colleague, improve_skill, acquire_skill, ask_colleague, convene_meeting, schedule_job, list_jobs, visit_url, web_search, calculate, company_status, search_brain, read_note, write_note, create_subtask, send_message, request_approval, complete_task, organize_brain, move_note, rename_note, merge_notes, build_training_set, otomatiskan, staf, skill_view, skill_manage, memory, session_search, buka_browser`.

### Kelompok di belakang pintu (`catalog.TOOL_GROUPS`)

| Kelompok | Isi | Siapa |
|---|---|---|
| `catatan` | `read_note`, `write_note` | semua |
| `web` | `visit_url` | semua |
| `tim` | `ask_colleague`, `send_message`, `create_subtask`, `company_status`, `list_jobs` | semua |
| `google` | `google_sheets_append`, `google_drive_create`, `google_calendar_create` | semua (butuh konektor) |
| `belajar` | `acquire_skill`, `skill_view`, `skill_manage`, `memory`, `session_search` | semua |
| `otomasi` | `otomatiskan` | semua (persetujuan Owner tetap berlaku) |
| `browser` | `buka_browser` lalu `browser_*` | agen yang diizinkan Owner |
| `kelola` | `recruit_agent`, `schedule_job`, `train_colleague`, `improve_skill`, (`create_division` hanya asisten pribadi) | manajer, master, PA |
| `mcp` | tool MCP | manajer, master, PA |
| `otak` | `organize_brain`, `move_note`, `rename_note`, `merge_notes`, `build_training_set` | spesialis (divisi `kms`) |

Penegakan: `leadOnly` = manajer/master/PA, `paOnly` = PA, `specialist` = divisi `kms`. Dicek dua kali: saat menyusun daftar tool (`visibleTools`) dan saat memanggil (`runTool` menolak "bukan untuk perannmu" tanpa efek, atau "buka dulu lewat buka_alat"). Aturan kecil: alasan minimal satu kalimat, maksimal 4 kelompok terbuka per tugas, tugas rutin dan massal tidak boleh membuka `belajar/otomasi/browser/mcp/kelola`, dan `catatan/web/tim` langsung terbuka untuk tugas rutin/massal (tidak ada giliran tambahan). Obrolan memakai alat dasar + `tim`. Kelompok terbuka disimpan di memori server per tugas.

Prompt hanya menjelaskan alat dasar dan menyebut nama kelompok; deskripsi alat lain ikut muncul bersama definisi tool setelah dibuka, jadi awalan prompt tetap stabil untuk cache.

## 2. Satu modul persetujuan (`server/approvals.js`)

`create`, `recordAuto`, `decide`, `expire`, `sweep`, `get`, `pending`, `canDecide`, `autoApprovable`, `needsHuman` (aturan regex "perlu manusia" pindah dari governor). Hanya modul ini yang memanggil `store.upsert('approvals'`; tes INV8 memindai seluruh `server/`.

Bentuk kartu: `id, kind, title, summary, preview, status, requesterId, approverId, createdAt, expiresAt` + medan lama (`taskId, expected, evidence, gaps, unverified, decidedBy, decidedAt, feedback, automationId, automationAction`). Jenis: `review`, `policy` (dulu tanpa jenis), `automation`, `browser_action`. Yang diarahkan: `engine.js` (review, kebijakan, keputusan), `n8n.js` (kartu otomasi), `browser.js` (aksi browser dan kedaluwarsa), `governor.needsHumanApproval` (meneruskan).

`review`, `automation`, `browser_action` **tidak pernah** disetujui otomatis: `recordAuto` menolak jenis itu, `decide(..., userId:'system-auto')` ditolak, dan `autoApprovePending` memakai `autoApprovable`. Hanya kartu aksi browser yang punya `expiresAt` (batas tunggunya); mesin menutup kartu kedaluwarsa tiap putaran (`sweep`). Perilaku yang terlihat tidak berubah, `decideApproval` dan bentuk keluarannya sama.

## 3. Governor: jatah per ruang kerja

Angka awal konservatif, dapat diatur lewat `PATCH /api/settings {"quota":{"tasksPerDay":300,"n8nRunsPerDay":100}}` (0 = tanpa batas). Satuannya **jumlah**, bukan uang; biaya uang tetap lewat anggaran yang ada.

- **Satu gerbang pembuatan tugas:** `governor.checkCreate`, dipanggil hanya dari `engine.createTask`. Semua jalur sudah lewat sini: `/api/tasks`, `/api/goals` dan Pemandu (`submitGoal`), broadcast, rapat, delegasi, obrolan. Tes memastikan hanya ada satu pemanggil. Kini **semua pembuat** (manusia, penjadwal, AI) terkena jatah tugas harian; tugas `routine` tidak menghabiskan jatah. Aturan AI yang lama (kapasitas, duplikat, inisiatif per jam) tetap.
- **Eksekusi n8n:** `execUsage` (dicatat di `db().usage.exec = {day, runs, byKind}`, reset harian), `checkExec`, `recordExec`, `chargeExec`, `execOverBudget` (bentuk sama seperti `overBudget`: `{limit, spent}`), `quotaStatus`.
- **Titik yang kini menagih:** `server/staff/runner.js` `execute` (semua jalan staf: Pemandu, antarmuka, tool `staf`) dan `engine.runTool` untuk `otomatiskan(aksi:"usulkan")` (uji eksekusi nyata).
- **Pemandu:** `pemandu.quota()` kini memuat `jatah: { tugas:{sisa,dari}, otomatis:{sisa,dari,pct,word} }`; `pct` dan `word` utama tetap tentang anggaran uang.

## 4. Prompt dan status

`systemPrompt`: daftar seluruh agen (`everyone`) dan "karyawan AI otonom" dihapus. Diganti: peran sendiri, struktur ("asisten pribadi dan master → manajer divisi → staf"), daftar ringkas staf divisi sendiri maksimal 12 baris (sisanya lewat `company_status`), dan daftar manajer. Banner "mode simulasi — tambahkan API key Claude" di dokumen keluaran simulasi dihapus (catatan jujur `gaps` tetap). Panjang prompt diukur pada seed dan keadaan kode yang sama:

| Peran | Huruf sebelum | Huruf sesudah |
|---|---|---|
| Staf pemasaran | 20.502 | 17.954 |
| Staf desain | 18.339 | 15.789 |
| Manajer pemasaran | 22.580 | 20.471 |
| Master | 28.520 | 20.508 |
| Asisten pribadi | 26.242 | 17.862 |

Tes INV11b memeriksa setiap agen AI: tidak ada id yang tidak ada di roster, tidak ada daftar semua agen, tidak ada istilah lama.

Status: `setStatus` memakai pemetaan tertutup milik sesi P1 (`server/staff/status-map.js`, tidak diduplikasi) sehingga hanya `working/meeting/chatting/idle/offline` yang tersimpan (INV5d).

## 5. Sumber kebenaran: skill vs tool vs templat n8n

| Kebutuhan | Yang resmi | Yang diarahkan |
|---|---|---|
| Tulis data ke Google Sheets **sekali** | `google_sheets_append` (kelompok `google`) | — |
| Catat ke Sheets **berulang** tiap data baru masuk | `otomatiskan` templat `catat_sheets` | `google_sheets_append` menyebut ini di panduannya |
| Staf menulis hasil ke Sheets | fragmen `tulis_sheets` (staf) | dipakai staf, bukan agen bebas |
| Ringkasan kabar tetap tiap hari (tanpa AI) | `otomatiskan` templat `ringkasan_harian` | bukan `schedule_job` |
| Pekerjaan berulang yang butuh berpikir AI | `schedule_job` (kelompok `kelola`, khusus manajer/master/PA) | — |
| Baca satu halaman web | `visit_url` (kelompok `web`) | pencarian: `web_search` |
| Klik/isi formulir | `buka_browser` (kelompok `browser`) | membaca saja: `web_search`/`visit_url` |
| Pekerjaan nyata yang sudah punya staf | tool `staf` | `otomatiskan` hanya bila pekerjaannya berulang |

Teks skill `pilih-alat-tepat` dan `riset-bersumber` (`server/skills-power.js`) dan panduan `google_sheets_append`/`schedule_job` di `catalog.js` sudah diselaraskan dengan tabel ini dan dengan nama kelompok `buka_alat`.

## 6. Titik sambung staf = workflow

Sesi fondasi memakai tool `staf` (`visibleTools` → `staff.toolDefs`, `runTool` → `staff.call`). **Belum ada** cabang `staff.run` di `runLive`; komentar di awal `runLive` mendokumentasikan titik tunggalnya bila kelak dibutuhkan. Bentuk keluaran `orchestrate`, `submitGoal`, `goalStatus`, `finishTask`, `decideApproval`, `systemPrompt`, dan `runTool` dipertahankan (`runTool` kini juga diekspor untuk tes).

## 7. Yang belum / tidak diuji (jujur)

- Tidak ada panggilan AI nyata dan tidak ada n8n nyata dalam tes P2; alur LLM dengan model sungguhan (apakah model kecil benar-benar memakai `buka_alat` dengan baik) **belum terbukti**. Tes memeriksa daftar tool, penolakan runtime, dan pembukaan kelompok secara langsung.
- Eksekusi n8n dari otomasi **yang sudah aktif** (dipoll `pollOnce` di `server/n8n.js`) belum ditagih ke jatah; hanya uji `usulkan` dan jalan staf. Titik tagihnya satu baris (`gov.recordExec(n,'otomasi')` di `pollOnce`) tetapi `n8n.js` milik fase P3.
- Hitungan jatah tugas memakai tanggal komputer server (zona waktu server) dan tugas yang masih tersimpan; tugas lama yang dihapus mengurangi hitungan.
- Kelompok terbuka disimpan di memori: setelah server dimulai ulang, tugas yang sedang berjalan harus membuka pintu lagi (aman, hanya satu giliran tambahan).
- Layar pengaturan belum punya kolom untuk `quota`; hanya lewat `PATCH /api/settings`.
- `check:visual` menunggu hash Owner. Verifikasi mascot V4.2: 109 lolos, 0 masalah sebelum dan sesudah (sempat gagal satu pemeriksaan di tengah pekerjaan karena suntingan sesi antarmuka P4 pada `public/js/views.js`, lalu pulih; bukan dari P2).
- Tes penuh (`node --test --test-concurrency=1 test/*.test.js`): 199 lulus, 4 tertunda (bertanda P3/P4/P5, bukan P2). Dua tes browser dan satu tes keamanan sempat gagal sesekali karena komputer sibuk atau port 4541/4542 dipakai sesi lain; lulus bila dijalankan sendiri.
