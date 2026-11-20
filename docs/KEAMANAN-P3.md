# Keamanan publik (Fase P3)

Status: selesai dan teruji pada 2026-11-18 (tes: `test/security.test.js`, 18 tes; ikut `npm test`). Bagian 7 menjelaskan dengan jujur apa yang **belum** aman untuk rilis publik. Rencana induk: `docs/arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md`.

## 1. Ringkasan: apa yang sekarang aman

| Temuan audit | Perbaikan | Berkas |
|---|---|---|
| Hook n8n hanya token di URL | Hook v2 bertanda tangan HMAC + cap waktu + nonce sekali pakai; token disimpan sebagai hash; batas laju per otomasi tahan restart; rute `digest` ikut dibatasi; "hanya komputer ini" tidak lagi mati karena `RAIVERSE_PUBLIC_URL` dan tidak bisa dipalsukan lewat proxy | `server/n8n.js`, `server/limits.js`, `server/n8n-templates/index.js` |
| Gerbang LLM bertoken belum ada | `POST /api/llm-gate` + token HMAC per eksekusi (ruang kerja, kunci, kedaluwarsa 2 menit, nonce, plafon token dan biaya). Kunci AI tidak pernah ada di n8n | `server/gate.js` |
| Tanpa kuota dan batas laju | Batas per IP dan per akun (429 + `Retry-After`), kuota harian per akun dan global, penutup anggaran global, batas koneksi SSE | `server/limits.js`, 3 baris di `server/index.js` |
| Pengambilalihan kantor utama | Pra-klaim email admin, kode klaim, atau lokal saja. Bukan lagi "siapa pun yang pertama" | `server/auth.js` |
| Kunci AI teks biasa, kunci enkripsi tanpa versi | Amplop `ev2.<versi>.…` berversi, terikat konteks, rotasi; teks biasa lama tetap terbaca | `server/secure.js`, `server/llm.js`, `server/auth.js` |
| Tulis berkas tanpa kunci | Tulis atomik (berkas sementara + rename) + kunci berkas untuk `auth.json` dan `otomasi.json`; pembacaan ulang sebelum tulis (tidak ada tulisan hilang) | `server/secure.js` |
| Siaran SSE `host` ke semua | Hanya untuk admin platform; `/api/state` mengirim `host: {}` ke yang lain; maksimal koneksi SSE per pengguna | `server/index.js` |
| SSRF `mcpServers` | `collab.assertMcpUrl`: ruang kerja publik lewat `browser.checkUrl` (termasuk DNS); kantor utama hanya MCP lokalnya sendiri; diperiksa saat disimpan dan saat dipanggil | `server/collab.js`, `server/index.js` |
| Undangan multi-pakai tanpa pencabutan | Hanya hash kode disimpan, batas pakai (10), kedaluwarsa, daftar dan pencabutan | `server/auth.js` |
| Anggota biasa bisa melakukan apa saja | Izin eksplisit per rute berdampak (merekrut/mengubah karyawan dan divisi, hapus tugas, putuskan persetujuan, rutinitas) | `server/auth.js`, `server/index.js` |
| `deliver()` ke `currentUserId` global | Kabar ke Owner ruang kerja yang benar (menurut akun) | `server/n8n.js` |
| n8n mati lalu pulih | Penanda maju berurutan, kunci kabar tetap (`autoKey`), eksekusi yang belum selesai ditunda: tidak hilang, tidak ganda | `server/n8n.js` |
| Tidak ada hapus/ekspor/retensi | Ekspor data pribadi, hapus akun, tutup sesi, retensi pesan dan kejadian | `server/privacy.js`, `scripts/security-tools.mjs` |
| Pengguna tanpa keanggotaan jatuh ke data kantor utama | Server menolak (403) permintaan `/api/*` dari akun yang bukan anggota ruang kerja mana pun | `server/index.js` |

## 2. Hook otomasi bertanda tangan (v2)

Alamat tetap `/api/automations/hook/<32 hex>/(ping|digest)`. Pada v2, 32 hex itu hanya **pengenal**; yang disimpan hanya `sha256(pengenal)` (`hookKey`) dan rahasia penandatangan terenkripsi (`hookSecret`, amplop `ev2`). Setiap panggilan membawa:

```
x-rv-ts     milidetik epoch (selisih maksimal 5 menit, HOOK_SKEW_MS)
x-rv-nonce  8-64 karakter, sekali pakai (dicatat tahan restart)
x-rv-sig    hex HMAC-SHA256(rahasia, `${ts}.${nonce}.${METODE}.${aksi}.${sha256(badan)}`)
```

Urutan pemeriksaan: lokasi (`isLocalDirect` atau `RAIVERSE_PUBLIC_URL`), hash pengenal, **batas laju** per otomasi per aksi (30/jam, tahan restart), jam, tanda tangan, baru nonce dihabiskan (penyerang tidak bisa menghabiskan nonce orang lain). Templat ringkasan harian (kanal WhatsApp/email) kini memuat simpul "Waktu panggilan" (Set) dan "Tanda tangan" (Crypto, HMAC SHA-256) sebelum memanggil RAIVERSE.

**Dari komputer ini** = soket loopback **dan** tanpa header proxy (`x-forwarded-for`, `forwarded`, `x-real-ip`). Lewat reverse proxy, semua dianggap dari luar (aman secara bawaan). `TRUST_PROXY=1` hanya mengubah alamat IP yang dipakai untuk batas laju.

### Otomasi lama (token polos) dan transisi
- Saat server dimulai, `migrateHooks()` mengganti token polos di `data/otomasi.json` dengan hash (`hookKey`, `hookLegacy`, `hookLegacyUntil`) dan menyimpan salinan `otomasi.json.bak-p3`. Idempoten.
- Otomasi lama **tetap diterima** dari komputer ini selama 30 hari (atau sampai `OTOMASI_LEGACY_HOOK_UNTIL=YYYY-MM-DD`), dengan peringatan di log; dari luar tidak diterima sama sekali; sesudahnya 410 "siapkan ulang".
- Dua otomasi `[RAIVERSE] [main]` milik Owner yang aktif (`catat_tabel` dan `cek_situs`) **tidak memakai hook sama sekali**, jadi tidak terpengaruh. Tidak ada alur n8n mereka yang disentuh. Untuk pindah ke v2, siapkan ulang otomasi dari layar (alur dibuat ulang dengan tanda tangan).

## 3. Gerbang LLM bertoken

```
server                                    n8n (tanpa kunci AI)                       server
gate.mint({ws,key,maxTokens,...}) ──token──► alur  ── POST /api/llm-gate {token,system,prompt} ──► gate.invoke
                                                                                  llm.call (model dipilih SERVER, plafon token, anggaran harian, kuota, catat biaya)
```

- Token `rg1.<payload>.<hmac>`; kunci HMAC diturunkan terpisah dari kunci enkripsi (`secure.derive('llm-gate')`).
- Ditolak: tanda tangan salah, isi diubah, kedaluwarsa (401), dipakai ulang termasuk setelah restart (409), `ws` pada badan berbeda dari token (403), ruang kerja tidak ada (404), batas laju/kuota/anggaran harian/anggaran global (429), AI belum tersambung (503).
- Pola dua-ketukan milik `server/staff/runner.js` tetap berjalan dan tidak diubah. Gerbang ini adalah jalur langsung bila `RAIVERSE_PUBLIC_URL` tersedia; pemanggilnya cukup `gate.mint()` lalu menaruh token di payload alur. **Belum dipasang ke alur staf mana pun** (itu keputusan sesi staf).

## 4. Kuota dan batas laju (semua dapat diatur lewat env)

| Env | Bawaan | Arti |
|---|---|---|
| `RATE_API_IP_PER_MIN` / `RATE_AUTH_IP_PER_MIN` / `RATE_HOOK_IP_PER_MIN` | 900 / 30 / 120 | permintaan per IP per menit (API / login / hook dan gerbang) |
| `RATE_ACCOUNT_PER_MIN`, `RATE_HEAVY_PER_MIN` | 600, 30 | per akun; pekerjaan berat (tugas, pesan, suara, eksekusi) |
| `QUOTA_TASK_DAY`, `QUOTA_MESSAGE_DAY`, `QUOTA_TTS_DAY`, `QUOTA_N8N_DAY`, `QUOTA_GATE_DAY` | 150, 400, 200, 60, 120 | per akun per hari (UTC) |
| `QUOTA_*_DAY_GLOBAL` | 3000, 8000, 4000, 1500, 3000 | seluruh platform per hari |
| `QUOTA_WS_CREATE_DAY`, `QUOTA_WS_CREATE_DAY_GLOBAL`, `WS_LIFETIME_PER_ACCOUNT`, `WS_PER_IP_DAY` | 1, 40, 3, 5 | ruang kerja baru: per akun/hari, global/hari, seumur hidup per akun Google, per IP/hari |
| `RAIVERSE_SIGNUP=closed` | terbuka | tutup pendaftaran baru (undangan tetap boleh) |
| `GLOBAL_DAILY_BUDGET_USD` | 0 (mati); 25 bila `RAIVERSE_PUBLIC_MODE=1` | menutup semua panggilan AI platform bila jumlah biaya hari ini tercapai |
| `MAX_STREAMS_PER_USER` | 6 | koneksi SSE per pengguna |
| `GATE_TTL_MS`, `RATE_GATE_PER_MIN` | 120000, 20 | masa berlaku token gerbang; panggilan gerbang per ruang kerja per menit |

Admin platform (Owner kantor utama) dikecualikan dari kuota **akun**, tetap dihitung ke kuota global. Penghitung harian, nonce, dan batas otomasi disimpan di `data/limits.json` (atomik). Kuota dipotong sebelum pekerjaan dijalankan (permintaan yang gagal validasi tetap terhitung; sengaja konservatif).

## 5. Klaim kantor utama

Berlaku **hanya** bila kantor utama belum terikat ke akun mana pun. Pemilik yang sudah terikat tidak berubah.
1. `RAIVERSE_ADMIN_EMAILS=a@x.id,b@x.id` (pra-klaim): hanya email itu yang bisa menjadi Owner kantor utama.
2. `RAIVERSE_CLAIM_CODE=…`: pemilik server membuka `/auth/google?claim=KODE` sekali. Di mode publik tanpa keduanya, server membuat kode acak dan mencetaknya di konsol saat boot.
3. Tanpa keduanya dan bukan mode publik: pengguna pertama, **hanya** bila login dari komputer server itu sendiri.
Akun lain selalu mendapat ruang kerja baru (dengan batas di bagian 4).

## 6. Rahasia: amplop berversi dan rotasi

- Kunci: `RAIVERSE_KEYS="3:rahasia-baru,2:rahasia-lama"` (pertama = dipakai menulis; setiap rahasia ≥ 17 karakter). Tanpa itu dipakai `TOKEN_ENC_KEY` sebagai versi 1; tanpa keduanya dibuat `data/.raiverse-keys.json` (mode 0600).
- **Cadangkan kunci itu bersama data.** Rahasia yang sudah terenkripsi tidak bisa dibuka tanpa kuncinya.
- Yang terenkripsi: kunci AI per ruang kerja (`settings.apiKey`, `settings.groqApiKey`; ditulis terenkripsi saat disimpan lewat Pengaturan), token Drive, rahasia penandatangan hook. Tampilan `••••abcd` tidak berubah.
- Migrasi data lama (teks biasa → amplop), tidak pernah mencetak rahasia:
  ```bash
  node scripts/security-tools.mjs status            # hitung saja
  node scripts/security-tools.mjs migrate           # hitung saja
  node scripts/security-tools.mjs migrate --apply   # tulis (hentikan server dulu; cadangkan dulu: npm run data:backup)
  ```
  Atau `RAIVERSE_SEAL_ON_BOOT=1` sekali saat server dimulai. **Belum dijalankan pada data Owner** (sesuai batasan).
- Rotasi: tambahkan kunci baru di depan `RAIVERSE_KEYS`, jalankan `migrate --apply`, lalu buang kunci lama.

## 7. Yang BELUM aman / masih syarat rilis publik

1. **Penyimpanan** masih berkas JSON per ruang kerja yang ditulis ulang utuh dan dimuat seluruhnya di memori. Syarat rilis: SQLite/Postgres per ruang kerja (Fase P7). Tulis atomik hanya mencegah berkas rusak, bukan masalah skala.
2. **Rahasia lain masih teks biasa:** `settings.googleAppsScript.secret`, header `settings.mcpServers[].headers`, dan kredensial Google/WAHA per ruang kerja yang dibuat di n8n berasal dari sana. Mengenkripsinya butuh perubahan `server/store.js` (`publicSettings`/`exportSettings`), yang dipegang P1. Permintaan di bagian 8.
3. **Satu proses, satu mesin.** Batas laju, nonce, dan kuota aman untuk satu proses (state di `data/limits.json`). Beberapa proses/server butuh penyimpanan bersama (Redis/DB).
4. **Rahasia penandatangan hook ada di n8n** (di dalam alur, karena n8n harus menandatangani). Siapa pun dengan akses ke editor n8n bisa memalsukan panggilan hook **otomasi itu saja** (bukan yang lain; tetap dibatasi laju). Gerbang LLM tidak punya masalah ini (token per eksekusi, kunci AI tidak di n8n).
5. **Uji nyata terhadap n8n asli belum dilakukan** untuk simpul Crypto/penandatanganan pada templat ringkasan: diuji dengan n8n tiruan (struktur, simulasi) dan dengan penanda tangan di sisi uji, bukan eksekusi n8n sungguhan (n8n Owner ada di server lain dan tidak bisa memanggil komputer ini; larangan menyentuh alur Owner).
6. **Hapus akun** membuang sesi, keanggotaan, dan otomasi, menonaktifkan ruang kerja pribadi seketika, lalu memindahkan datanya ke `data/trash/` **saat server dimulai ulang** (dibuang permanen setelah `PRIVACY_TRASH_DAYS`=7 hari), karena `server/store.js` belum punya `removeWorkspace`. Hasil `data/staff-runs.json` dan data tabel n8n milik ruang kerja itu belum ikut dibersihkan otomatis (`data/staff-out/<ws>` ikut dihapus).
7. **Retensi** hanya memangkas ruang kerja non-utama (90 hari kejadian, 365 hari pesan; `RETENTION_*`). Catatan Brain, tugas, dan data lain tidak dipangkas. Perlu kebijakan dari Owner.
8. **Data anak dan persetujuan:** produk ini menyasar pengguna lintas usia. Aplikasi **tidak** memiliki verifikasi usia, persetujuan orang tua, atau pemisahan data anak, dan dokumen ini **tidak menyatakan kepatuhan** terhadap hukum mana pun (mis. UU PDP Indonesia, COPPA, GDPR). Sebelum rilis publik, Owner perlu tinjauan hukum untuk: dasar pemrosesan dan persetujuan, usia minimum, persetujuan orang tua/wali, penyedia AI pihak ketiga (isi percakapan dikirim ke Groq/Anthropic/Microsoft Edge TTS), lokasi penyimpanan, masa retensi, hak akses/hapus, dan prosedur kebocoran data.
9. **Izin anggota** bersifat kasar (empat izin). Antarmuka untuk memberi izin dan membaca pesan 403 belum ada (P4). Rute lain bisa dipakai anggota biasa; hanya rute berdampak di bagian 1 yang dijaga, ditambah rute yang sudah `ownerOnly`.
10. **Isi dari luar** (catatan, web, hook) hanya diperlakukan sebagai data; izin tidak pernah ditentukan oleh teks. Ini dijaga oleh kode (izin per rute, `ownerOnly`, persetujuan), bukan oleh ketahanan model.
11. **TLS, CORS, header keamanan, WAF, pemantauan dan peringatan:** tidak bagian dari fase ini. Jalankan di belakang reverse proxy HTTPS (`TRUST_PROXY=1`, cookie `Secure` otomatis lewat `x-forwarded-proto`).
12. Belum diuji: beban banyak pengguna serentak, pemulihan setelah rotasi kunci pada data Owner, dan alur login Google asli (diuji dengan Google tiruan).

## 8. Permintaan untuk sesi/fase lain (saya tidak mengedit berkas ini)

- **P1 (`server/store.js`, `workspace.js`):** (a) `removeWorkspace(id)` (menghapus entri `WS` dan berkas); `privacy.purgeAtBoot` bisa diganti. (b) `publicSettings`/`exportSettings`: sembunyikan juga `googleAppsScript.secret` dan `mcpServers[].headers`, dan sediakan penyimpanan terenkripsi untuknya (`secure.seal(…, 'ws-secret')`). (c) Tanda `settings.deleted` dipakai `gate.js`; abaikan ruang kerja itu di `engine` tick.
- **P2 (`server/browser.js`, `engine.js`):** `browser.secretValue` membandingkan `db().settings.apiKey` apa adanya; sejak kunci disimpan terenkripsi, bandingkan dengan nilai terbuka (`secure.open(settings.apiKey, 'ws-secret')`). Kunci dari `.env` tetap terlindungi. Catat biaya eksekusi n8n lewat `limits.charge('n8n', …)` bila ingin hitung di luar HTTP.
- **Sesi staf (`server/staff/`):** (a) memakai `gate.mint` bila memilih jalur langsung; (b) bersihkan `data/staff-runs.json` dan tabel `raiverse_staf` untuk ruang kerja yang dihapus; (c) `POST /api/staff/:kunci/run` sudah terkena kuota `n8n`.
- **P4 (`public/*`):** pesan 429 (`error`, `retryAfter`), 403 izin, layar izin anggota (`POST /api/ws/member-perms`, `GET /api/ws/invites`, `POST /api/ws/invite/revoke`), layar Privasi (`GET /api/me/export`, `POST /api/me/delete` dengan `{"konfirmasi":"HAPUS AKUN SAYA"}`, `POST /api/me/sessions/revoke`), dan jangan membaca `state.host` untuk non-admin (kini `{}`).

## 9. Rute dan antarmuka baru

`POST /api/llm-gate` (token) · `GET /api/ws/invites` · `POST /api/ws/invite/revoke {id}` · `POST /api/ws/invite {role,maxUses,days}` · `POST /api/ws/member-perms {accountId,perms[]}` (izin: `hire`, `taskDelete`, `approve`, `routine`) · `GET /api/me/export` · `POST /api/me/delete {konfirmasi}` · `POST /api/me/sessions/revoke`. Semua galat berbentuk `{ "error": "kalimat awam" }`; 429 menyertakan `Retry-After`.

## 10. Verifikasi

```bash
node --test --test-concurrency=1 test/security.test.js     # 18 tes P3 (port 4541-4542, data sementara, tanpa kunci AI)
node --test --test-concurrency=1 test/*.test.js            # seluruh suite
node docs/mascot-v4-2/verify-v42.mjs                       # mascot V4.2
node scripts/security-tools.mjs status                     # keadaan rahasia/hook pada folder data (DATA_DIR=... untuk salinan)
```

Cakupan `test/security.test.js`: amplop (versi, konteks, rotasi, format lama), kunci AI terenkripsi tetap dipakai, gerbang LLM (sah, kedaluwarsa, palsu, replay termasuk setelah restart, ruang kerja lain, plafon token, anggaran harian dan global), batas laju dan kuota (429, `Retry-After`, tahan restart), alamat lokal tidak bisa dipalsukan proxy, klaim kantor utama, tulis bersamaan lintas proses, n8n mati lalu pulih tanpa ganda, SSRF MCP, retensi, server sungguhan dengan Google tiruan: klaim, isolasi dua pengguna (Brain, memori, skill, SSE), siaran `host` hanya admin, batas koneksi SSE, kuota tugas/suara 429, izin anggota, undangan (batas pakai, pencabutan), injeksi di catatan, gerbang LLM lewat HTTP, ekspor/hapus akun, 429 pada jalur login. Tes hook v2 dan migrasi hook lama ada di `test/n8n.test.js`.
