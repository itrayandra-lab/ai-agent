# Pemandu: titik sambung untuk sesi lain

Status: berlaku sejak 2026-11-18. Modul: `server/pemandu.js`. Rancangan induk: `docs/PEMANDU-ALUR-AWAM.md`.

Pemandu menampilkan **kartu** di akhir pekerjaan (respons `kind: "done"`, bidang `cards`). Kartu didaftarkan lewat `registerCard(type, { offer, act })` dan sudah ada dua yang siap disambung. Sesi lain **tidak perlu mengubah `pemandu.js`**: cukup mengekspor fungsi bernama di berkasnya sendiri. Bila berkas atau fungsinya belum ada, Pemandu diam-diam memakai cadangan (tidak ada galat, tidak ada layar rusak).

Aturan bahasa untuk semua teks yang sampai ke layar: kamus di `server/kamus.js` (tidak boleh ada agen, goal, task, approval, persetujuan, MCP, tool, Brain, workspace, token, model, prompt, error, API, JSON). Tes `test/pemandu.test.js` memindai teks kartu.

## 1. Otomasi ("Mau aku otomatiskan ini?"): sudah tersambung ke `server/n8n.js`

Setelah hasil dipakai, tombol langkah lanjut "Jadwalkan" memulai tahap otomasi di Pemandu (tahap `auto`), memakai kontrak di `docs/N8N-OTOMASI.md`:

1. `propose({ text, userId })` mengembalikan 2 sampai 3 pilihan; tampil sebagai tombol (ditambah "Tidak dulu").
2. `prepare(id, { option, answers, userId })`: bila `status: "tanya"`, pertanyaan tampil satu per satu (tombol bila jenis `choice`, kolom ketik bila lain); bila `perlu_sambung`, alasannya ditampilkan dengan jalan keluar; bila `siap`, tampil konfirmasi dengan pratinjau (langkah dan dampak) dan catatan uji data contoh.
3. Hanya setelah pengguna menekan "Ya, nyalakan", Pemandu memanggil `activate(id)`. Otomasi tidak pernah menyala tanpa konfirmasi itu.
4. Jika mesin otomasi mati atau menolak, pengguna mendapat kalimat jujur dan pilihan "Ya, ulangi setiap hari" (jadwal bawaan RAIVERSE, `routines`) atau "Tidak dulu". Pilihan "Tidak dulu" juga menghapus draf (`remove`).
5. Hanya Owner/Admin ruang kerja yang boleh memasang otomasi (dijaga di `server/index.js` lewat `b.canAutomate`).

## 2. Kartu `learned` ("Aku belajar sesuatu, simpan?"): sudah tersambung ke `server/skills-learn.js`

Di layar "selesai", Pemandu memanggil `pending()` dan menampilkan usulan pertama (judul dan isi dari `kartu`) dengan tombol Simpan (`decide(id, { keputusan: 'setuju' })`) dan Jangan (`'tolak'`). Tidak ada usulan menunggu = tidak ada kartu. Catatan yang dipelajari tentang pengguna (`memory-lite`) ikut tampil di panel "Yang aku tahu tentang kamu" dan bisa dihapus di sana (`DELETE /api/belajar/profil/:nomor`).

## 3. Menambah jenis kartu baru

```js
import { registerCard } from './pemandu.js';
registerCard('namaKartu', {
  offer: async ({ session, userId }) => ({ type: 'namaKartu', say: 'Pertanyaan singkat?', ref: 'opsional', options: [{ id: 'ya', label: 'Ya', recommended: true }, { id: 'tidak', label: 'Tidak dulu' }] }),   // atau null
  act: async (optionId, { session, userId, ref }) => ({ say: 'Kalimat balasan' }),
});
```

Klien menampilkan kartu apa pun dari `cards` sebagai judul + tombol besar. Ketukan dikirim ke `POST /api/pemandu/turn` dengan `choiceId: "card:<type>:<optionId>"`. Aturan: 2 sampai 4 tombol, satu `recommended`, bahasa sehari-hari, tanpa istilah teknis.

## Alur percakapan (arah Owner 2: obrolan dulu seperti ChatGPT, kerja hanya bila diminta dan dikonfirmasi)

Layar depan: utas percakapan, kolom ketik (dengan mikrofon), dan keadaan awal bersih (sapaan + saran pembuka). Tidak ada penunjuk langkah, kartu rencana, atau menu topik paksa.

**1. Setiap pesan = obrolan dulu** (`server/pemandu-chat.js`)
- Sapaan, terima kasih, dan "kamu bisa apa" dijawab aturan murah (tanpa token): satu atau dua kalimat, paling banyak satu baris saran ringan.
- Selain itu dijawab model: `openai/gpt-oss-20b` untuk obrolan, `openai/gpt-oss-120b` hanya bila pesan panjang atau rumit (`engine.isComplex`). Keluaran JSON ketat: `{ balasan, saran[maks 3], alat: tidak|catatan|web, kueri, kerja, judul }`. Riwayat percakapan (14 pesan terakhir) dan profil pengguna ikut dikirim. Balasan disaring kamus bahasa (`rapikan`): kata teknis diganti padanan awam.
- Tanpa model (mode simulasi, jatah habis, atau model gagal): jawaban cadangan yang jujur ("otak AI-ku sedang belum tersambung") plus satu tombol "Kerjakan sebagai pekerjaan"; permintaan yang jelas tetap bisa dikerjakan lewat aturan L0.
- Respons baru `kind: "chat"`: `say` (markdown ringan), `options` = 0 sampai 3 saran (id `say:N`; bila ditekan dikirim sebagai pesan pengguna) dan `tools` = `[{ label: "Memanggil Catatan", detail }]` bila alat dipakai.

**2. Alat lewat satu pintu kecil**: kolom `alat` (`catatan` = cari di Catatan, `web` = pencarian web, hanya bila Groq aktif). Satu alat per giliran; hasilnya dimasukkan sebagai data (bukan perintah) lalu model menjawab; klien menampilkan penanda "Memanggil ..." yang bisa dibuka. Kemampuan staf dan otomasi tidak dipanggil dari obrolan; itu lewat usulan kerja di bawah.

**3. Tidak ada eksekusi spontan** (pagar di kode, bukan hanya prompt)
- Niat kerja yang jelas ("buatkan ...", "tolong tulis ...", atau `kerja: true` dari model pada pesan yang bukan pertanyaan) hanya menghasilkan **usulan**: paling banyak satu pertanyaan, lalu kartu `kind: "confirm"` berisi satu kalimat "Mau aku kerjakan sekarang?" dengan tombol **Ya, kerjakan** (`start`), **Ubah** (`edit`: ketik perubahan), **Nanti saja** (`later`: kembali ngobrol).
- `startWork()` melempar galat kecuali `session.confirmed === true`, yang hanya diatur saat pengguna menekan "Ya, kerjakan", atau memilih atau mengetik perbaikan atas hasil yang sudah ada (Ubah sedikit, Buat versi lain, teks perbaikan). Tombol "Ya" yang basi pada sesi tanpa usulan tidak membuat apa pun.
- Pertanyaan, sapaan, atau basa-basi di tengah usulan membatalkan usulan dan dijawab sebagai obrolan. Pertanyaan soal hasil yang sudah ada juga dijawab sebagai obrolan (bukan revisi).
- Pemasangan otomasi tetap lewat kartu konfirmasi dengan pratinjau: Ya, nyalakan / Ubah / Batal.

**4. Tombol hanya saran** setelah balasan yang bermakna, 2 sampai 4 pilihan; bukan menu pembuka. Kartu awal lama (`intent:*`) dikirim klien sebagai pesan biasa.

Klien membaca parameter `untuk` dan `mulai` dari `navigate('dashboard', {...})`: "Beri pekerjaan" dari Tim Saya memberi awalan "Minta <nama> untuk …" pada pesan pertama, dan `mulai` dikirim sebagai pesan.

Pengujian model asli (Groq 20b/120b, biaya total sekitar 0,004 USD): sapaan, basa-basi, pertanyaan, diskusi bisnis, "jelaskan otomasi", pertanyaan berjargon, permintaan kerja, dan pencarian web. Tidak ada pekerjaan tercipta tanpa konfirmasi dan tidak ada kata terlarang di layar.

## Kontrak respons (ringkas)

`{ sessionId, say, kind, options[{id,label,hint?,recommended?}], delegate, freeText, step{now,of}, undo, quota{pct,word}, notes?, learned?, preview?, progress?, result?, saved?, cards? }`

`kind` = `chat | choices | plan | confirm | progress | result | done | error` (`plan` tidak lagi dikirim pada alur biasa; `tools` hadir pada `chat` bila alat dipakai).

## Profil pengguna ("Yang aku tahu tentang kamu")

Disimpan di `db().pemandu.profiles[userId]` dan disalin sebagai catatan sistem `Profil pengguna <id>` (folder Sistem) lewat `brain.writeNote`, sehingga pembantu lain ikut membacanya lewat pencarian catatan biasa. Rute: `GET/PUT /api/pemandu/profile`, `POST /api/pemandu/onboard` (`{input}` berupa alamat situs atau satu kalimat, atau `{skip:true}`).
