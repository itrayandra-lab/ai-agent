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

## Alur percakapan (revisi arah Owner: satu percakapan, bukan wizard)

Layar depan hanya: utas percakapan, kolom ketik (dengan mikrofon), dan keadaan awal berisi sapaan serta beberapa saran pembuka. Tidak ada penunjuk langkah, kartu rencana tiga opsi, atau panel terpisah.

- Pengguna menulis bebas. Pemandu bertanya balik **hanya bila perlu**: permintaan yang sudah jelas (9 kata atau lebih), atau yang jawabannya sudah ada di kalimat atau profil, langsung dikerjakan; selain itu **satu** pertanyaan (paling banyak dua) dengan tombol jawaban, "Serahkan ke kamu", dan "Lainnya (ketik)".
- Rencana dipilih diam-diam (Seimbang, atau Cepat bila jatah menipis). `kind: "plan"` tetap sah di kontrak tetapi tidak lagi dikirim pada alur biasa; "Ubah sedikit" (lebih singkat, santai, resmi, lengkap, atau ketik) mengatur hasilnya lewat `decideApproval` tolak-dengan-catatan.
- Kemajuan (`kind: "progress"`), hasil (`kind: "result"`, di dalam balasan yang sama), dan penutup (`kind: "done"`) semuanya muncul sebagai balasan di utas. **Tiap balasan diakhiri satu kalimat ajakan dan 2 sampai 4 tombol** (`options`): Pakai ini, Ubah sedikit, Buat versi lain, Simpan; setelah dipakai: langkah lanjut khusus niat, "Jadwalkan", "Cukup dulu". Tombol hanya aktif di balasan terakhir.
- `kind: "confirm"` kini khusus **aksi berdampak keluar** (sementara: memasang otomasi). Kartu kecil di utas berisi pratinjau dan tiga tombol: Ya, nyalakan (`oto:on`), Ubah (`oto:edit`), Batal (`oto:no`). Aksi berdampak baru apa pun wajib berhenti di kartu seperti ini.
- Obrolan ringan (sapaan, terima kasih, "kamu bisa apa") dijawab langsung tanpa membuat pekerjaan.
- Klien membaca parameter `untuk` dan `mulai` dari `navigate('dashboard', {...})`: "Beri pekerjaan" dari Tim Saya memberi awalan "Minta <nama> untuk …" pada pesan pertama, dan `mulai` langsung dikirim sebagai pesan.

## Kontrak respons (ringkas)

`{ sessionId, say, kind, options[{id,label,hint?,recommended?}], delegate, freeText, step{now,of}, undo, quota{pct,word}, notes?, learned?, preview?, progress?, result?, saved?, cards? }`

`kind` = `choices | plan | confirm | progress | result | done | error`.

## Profil pengguna ("Yang aku tahu tentang kamu")

Disimpan di `db().pemandu.profiles[userId]` dan disalin sebagai catatan sistem `Profil pengguna <id>` (folder Sistem) lewat `brain.writeNote`, sehingga pembantu lain ikut membacanya lewat pencarian catatan biasa. Rute: `GET/PUT /api/pemandu/profile`, `POST /api/pemandu/onboard` (`{input}` berupa alamat situs atau satu kalimat, atau `{skip:true}`).
