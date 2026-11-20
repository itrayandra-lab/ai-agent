# Progres konsolidasi (dijeda 2026-11-20)

## Selesai
- Tahap 1 Audit: `scripts/inventaris.mjs`, `AUDIT.md`, `INVENTARIS.txt`, `NILAI-47-TEMUAN.md`.
- Tahap 2 Backend: sudah satu pintu (`pemandu.setFront` → `chat-engine.turn`); ditambah penjaga `canAutomate` pada staf berdampak (T-07).
- Tahap 3 sebagian: `office-layout.css` dilebur (v4..v12 → satu lapis), setara menurut `scripts/snapshot-gaya.mjs`; 12 peneruskan yatim diarsipkan ke `_arsip-kode/`.
- Perbaikan temuan: T-06, T-07, T-08, T-09, T-11 (Rapikan), T-22, T-45.
- Tes kontrak `test/konsolidasi.test.js`; `test/ui-obrolan-sederhana.test.js` diubah agar memeriksa makna CSS, bukan teks persis.
- Dokumen: CHAT-ENGINE, PERILAKU-OBROLAN, PETA-BACKEND, PETA-HALAMAN-LENGKAP (bagian 15), 00-STATUS.

## Sedang berjalan / belum
- Suite penuh (`node --test --test-concurrency=1 test/*.test.js`): satu kegagalan ditemukan dan diperbaiki (ui-obrolan-sederhana); jalankan ulang penuh untuk memastikan hijau.
- Tahap 3 sisanya: satu komposer/popup, `#pesan` memakai UI chat lama, `!important` (57→56, belum berkurang berarti), selektor ganda lintas app/glass/identity.
- Tahap 4: evaluasi 15 percakapan model asli (`node scripts/evaluasi-obrolan.mjs --versi baru --batas 0.14 --id sapa-1,sapa-2,umum-1,umum-2,pendapat-1,rumit-1,jujur-1,jujur-2,sumber-1,catatan-1,hitung-1,kerja-1,pancing-1,lanjut-1,persona-1`; batas total < 0,3 USD).
- Tahap 5: `UKUR.md` (ukuran, permintaan, waktu muat, FPS, memori) belum dibuat. Ukuran awal: CSS 262.701 B, JS klien 1.193.229 B, JS server 1.956.316 B.
- Tahap 6: tangkapan layar per halaman ke `docs/visual-review/konsolidasi/` belum dibuat.
- Tahap 7: perbarui lagi dokumen setelah tahap 3–6.

## Perintah melanjutkan
```
node docs/mascot-v4-2/verify-v42.mjs
node scripts/inventaris.mjs
node --test --test-concurrency=1 test/*.test.js
# server uji terisolasi: DATA_DIR=<tmp> PORT=4511 HOST=127.0.0.1 GROQ_API_KEY= ANTHROPIC_API_KEY= RAY_GROQ_BASE_URL=http://127.0.0.1:1 node server/index.js
node scripts/snapshot-gaya.mjs rekam 4511 <berkas.json> dark   # bandingkan: ... banding a.json b.json (abaikan derau halaman-pengaturan/obrolan-penuh)
```
Rekaman awal CSS (sebelum penggabungan) ada di folder temp sesi dan hilang bila dibersihkan; rekam ulang dari `git stash`/commit sebelumnya bila perlu.

## Berkas belum selesai
Tidak ada berkas setengah jadi. Server uji port 4511 dan Chrome headless ditutup saat dijeda.
