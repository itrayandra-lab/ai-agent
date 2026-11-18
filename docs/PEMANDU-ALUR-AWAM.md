# PEMANDU: rancangan alur untuk pengguna awam

Status: rancangan (belum ada kode). Ditulis 2026-11-18. Bahasa: Indonesia. Dasar: permintaan Owner pada sesi UI 2026-11-18.

## 0. Ringkasan satu menit

Pengguna akhir RAIVERSE adalah orang awam dari segala usia (Gen Alpha sampai boomers). Mereka tidak tahu apa itu agen, tool, MCP, goal, atau persetujuan. Mereka hanya tahu "aku mau ini".

Yang dibangun adalah **Pemandu**: satu teman bicara yang *memimpin* percakapan, bukan menunggu perintah.

1. Pengguna mengatakan keinginannya, dengan ketikan, suara, foto, atau ketuk kartu awal.
2. Pemandu bertanya balik **maksimal 2 pertanyaan**, masing-masing dengan **2–4 tombol jawaban**. Selalu ada "Serahkan ke kamu" dan "Lainnya (ketik)".
3. Pemandu menawarkan **3 pilihan rencana** (cepat, seimbang, lengkap) dengan bahasa hasil, bukan bahasa teknis.
4. Baru setelah pengguna memilih, tim AI bekerja di belakang layar.
5. Hasil datang dengan tombol sederhana: **Pakai ini · Ubah sedikit · Ulangi · Simpan**.
6. Pemandu menutup dengan "Selanjutnya mau apa?" berisi 3 pilihan.

Semua urusan teknis (memilih agen, mencari di Brain, web, browser, MCP, menyimpan catatan) diputuskan sistem. Pengguna tidak pernah memilih tool.

Perbedaan dengan ChatGPT: ChatGPT menunggu pengguna tahu apa yang diminta. Pemandu *mengusulkan* dan memberi pilihan tombol, jadi pengguna tidak harus pandai menulis perintah.

## 1. Pengguna dan konsekuensi desainnya

Catatan jujur: pembagian generasi di bawah adalah asumsi kerja, belum diuji. Bagian 9 mewajibkan uji dengan orang nyata sebelum dianggap benar.

| Kelompok | Kecenderungan | Yang harus disediakan |
|---|---|---|
| Gen Alpha (anak) | Cepat bosan, suka suara dan gambar, butuh keamanan | Mode Anak: tanpa browser, tanpa koneksi luar, tanpa pembayaran, kata sederhana, nada ramah, ada pendamping orang tua |
| Gen Z | Terbiasa HP, tidak sabar, suka suara dan voice note | Input suara, hasil dalam hitungan detik, tampilan cepat |
| Milenial | Pragmatis, butuh hasil kerja nyata | Hasil siap pakai, simpan otomatis, lanjutkan yang kemarin |
| Gen X | Butuh kejelasan dan kontrol | Selalu ada "apa yang akan terjadi" sebelum eksekusi, bisa dibatalkan |
| Boomers dan di atasnya | Huruf kecil melelahkan, takut salah pencet | Mode Besar (huruf 18–20 px, kontras tinggi), tombol besar, tidak ada tindakan yang tidak bisa dibatalkan, bahasa tanpa istilah asing |

Aturan lintas kelompok:

1. **Satu layar, satu keputusan.**
2. **Maksimal 4 tombol pilihan**, dan salah satunya diberi tanda "Disarankan".
3. **Tidak ada layar kosong.** Selalu ada tombol berikutnya.
4. **Kata sehari-hari.** Kamus di bagian 7.
5. **Semua bisa dibatalkan** ("Batalkan" dan "Kembali satu langkah").
6. **Biaya dalam bahasa manusia** ("Hemat", "Biasa", "Lengkap" dan sisa jatah hari ini), tidak pernah dalam dolar.
7. **Tidak ada kebuntuan.** Kalau AI gagal, Pemandu berkata apa yang terjadi dan menawarkan 2 jalan lain.

## 2. Mesin percakapan Pemandu

```
Tangkap → Pahami → Tanya (≤2) → Usul rencana (3 opsi) → Konfirmasi → Kerjakan → Tinjau → Simpan → Lanjut
```

### 2.1 Tangkap
Masukan: teks, suara (Web Speech API di browser, ringan), foto, atau ketukan kartu awal. Kartu awal di Beranda berubah menurut jam, riwayat, dan profil: "Lanjutkan yang kemarin", "Bantu aku menulis…", "Cari tahu soal…", "Atur rencana…".

### 2.2 Pahami (tiga jenjang hemat token)
- **L0, tanpa token:** aturan dan templat. Dipakai untuk niat yang sering (konten, riset, rencana, tulis pesan, ringkas, belajar). Fungsi pembantu yang sudah ada di `server/engine.js`: `looksLikeWork()`, `meetingIntent()`, `namesIn()`.
- **L1, model kecil (`openai/gpt-oss-20b`):** menggolongkan niat yang tidak terduga dan menyusun pertanyaan dan pilihan. Keluaran wajib JSON ketat (model gpt-oss sudah masuk daftar `GROQ_STRICT` di `server/llm.js`). Hasil di-cache per niat.
- **L2, model besar (`openai/gpt-oss-120b`):** hanya untuk menghasilkan karya (tulisan, rencana, analisis).

Niat: `ngobrol`, `tanya`, `buat`, `cari-tahu`, `rencanakan`, `urus` (aksi nyata), `ingat` (simpan). Kalau ragu, Pemandu bertanya dengan pilihan, tidak menebak.

### 2.3 Tanya (maksimal 2)
Aturan:
- Lewati pertanyaan bila jawabannya sudah ada di kalimat pengguna atau di profil (bagian 5.1).
- Setiap pertanyaan: 2–4 pilihan konkret, satu "Disarankan", plus **Serahkan ke kamu** dan **Lainnya (ketik)**.
- Pertanyaan pertama biasanya *tujuan/untuk siapa*, kedua *gaya atau ukuran*.

Contoh, pengguna: "bikinin aku konten buat jualan kopi".
> Konten ini untuk apa?
> [Menarik pembeli baru] [Promo minggu ini] [Cerita tentang usahaku] [Serahkan ke kamu]
>
> Mau lewat mana?
> [Instagram] [WhatsApp] [Keduanya, disarankan] [Lainnya]

### 2.4 Usul rencana (3 pilihan)
Kartu rencana, bukan daftar tugas teknis.

| Pilihan | Isi | Perkiraan |
|---|---|---|
| Cepat | "1 caption + 1 ide gambar" | sekitar 20 detik, hemat |
| Seimbang (disarankan) | "5 caption dan jadwal 1 minggu" | sekitar 1 menit |
| Lengkap | "Rencana 30 hari + 15 caption + ide visual" | beberapa menit |

Di bawahnya: "Hasilnya akan kamu terima sebagai: …". Waktu dan biaya memakai kata ("sebentar", "hemat"), dan angka hanya sebagai perkiraan.

### 2.5 Konfirmasi
Satu tombol besar: **Mulai**. Di sebelahnya **Ubah pilihan**. Untuk aksi berdampak (kirim pesan, posting, beli, hapus) konfirmasi menampilkan *pratinjau persis* apa yang akan dikirim dan ke siapa.

### 2.6 Kerjakan
Pemandu berbicara dengan kalimat manusia ("Sinta lagi menyusun caption…"), tidak dengan log teknis. Bisa dijeda atau dihentikan. Kalau agen terhambat, Pemandu bertanya dengan pilihan ("Harga belum ada. [Aku isi nanti] [Pakai perkiraan] [Tanya aku]").

### 2.7 Tinjau
Kartu hasil dengan empat tombol:
- **Pakai ini**
- **Ubah sedikit**, yang membuka pilihan *lebih singkat · lebih santai · lebih resmi · lebih lengkap · lainnya*. Ini memakai alur revisi yang sudah ada (`decideApproval` dengan `reject` dan `feedback` di `server/engine.js`), jadi tidak perlu mesin baru.
- **Ulangi**
- **Simpan**

### 2.7b Simpan dan lanjut
Hasil disimpan otomatis ke Catatan (judul dan folder diberikan sistem lewat `server/librarian.js`). Pemandu menutup dengan tiga langkah lanjut yang relevan ("Buat versi WhatsApp", "Jadwalkan", "Selesai dulu").

## 3. Kontrak data pilihan (supaya UI dan server sepakat)

Setiap giliran Pemandu mengembalikan satu objek:

```json
{
  "say": "Konten ini untuk apa?",
  "kind": "choices",
  "options": [
    { "id": "new-buyers", "label": "Menarik pembeli baru", "hint": "Cocok untuk akun baru", "recommended": true },
    { "id": "promo", "label": "Promo minggu ini" }
  ],
  "delegate": true,
  "freeText": true,
  "step": { "now": 1, "of": 4 },
  "undo": true
}
```

`kind` bernilai `choices | plan | confirm | progress | result | done | error`. Server menolak keluaran model yang tidak sesuai skema dan memakai templat L0 sebagai cadangan, sehingga model kecil yang salah format tidak pernah menampilkan layar rusak.

Rute baru yang disarankan: `POST /api/pemandu/turn` dengan `{sessionId, input?, choiceId?}`. Status percakapan disimpan di koleksi baru, dan baru pada langkah **Kerjakan** server memanggil `orchestrate()` atau `submitGoal()` yang sudah ada. Pilihan pengguna ikut sebagai *brief* pada tugas, sehingga agen tahu apa yang sudah diputuskan.

## 4. Sistem pintar di belakang layar (pengguna tidak mengurus apa pun)

### 4.1 Pemilih alat otomatis
Urutan dari yang paling murah:
1. Brain (ingatan sendiri)
2. `web_search` dan `visit_url` (ringan, di server Groq)
3. `buka_browser` (Chrome sungguhan, hanya bila perlu klik atau isi form)
4. MCP/koneksi luar (Gmail, Drive, dll.), hanya setelah pengguna menyambungkannya
5. Bertanya kepada pengguna

Pola router yang sama dengan Browser Agen: model hanya melihat satu pintu kecil, tool lengkap terbuka bila alasan valid. Nama tool tidak pernah tampil ke pengguna.

### 4.2 Pengetahuan yang mengatur dirinya
- Setiap hasil dan fakta penting otomatis disimpan dengan judul, folder, dan tautan (sudah ada: `librarian.js`).
- Tampilan untuk pengguna adalah **jawaban**, bukan berkas: "Kamu pernah menyimpan menu dan harga bulan lalu. Pakai itu?"
- Status kepercayaan (`kb`: verified/draft/arsip) ditampilkan sebagai dua kata, **Sudah dicek** dan **Masih draf**. Hari ini status ini belum tampil sama sekali di antarmuka.
- Perapian berkala berjalan sebagai tugas latar tanpa model (gabung duplikat, beri judul).

### 4.3 Koneksi (MCP, Drive, email) sebagai toko kecil
Tidak ada formulir URL dan JSON. Hanya kartu: "Hubungkan Gmail untuk kirim email?" dengan satu tombol masuk akun. Pemandu *menyarankan* koneksi tepat saat dibutuhkan ("Untuk kirim ini, hubungkan Gmail dulu. Mau?"). Konfigurasi mentah tetap ada di Lanjutan untuk yang paham.

### 4.4 Persetujuan menjadi konfirmasi biasa
Bahasa "Persetujuan/Approval" hilang dari wajah pengguna. Yang tampil: "Aku mau kirim ini ke Budi. Boleh?" dengan pratinjau. Aksi berisiko rendah berjalan otomatis; aksi berdampak selalu bertanya.

### 4.5 Jatah dan biaya
Bar "Sisa jatah hari ini" menggantikan angka dolar. Saat hampir habis, Pemandu menawarkan mode Hemat. Penjaga yang sudah ada (`server/governor.js`) tetap menjadi pagar.

## 5. Memori yang ramah

### 5.1 "Yang aku tahu tentang kamu"
Satu catatan sistem yang dapat dibaca dan diubah pengguna (nama usaha, gaya bahasa, target, hal yang tidak disukai). Pemandu mengisinya dari percakapan dan *selalu memberi tahu*: "Aku catat kamu suka bahasa santai. Betul?" [Betul] [Ubah]. Tujuan: tidak pernah menanyakan hal yang sama dua kali.

### 5.2 Lanjutkan kemarin
Kartu paling atas di Beranda bila ada pekerjaan belum selesai.

## 6. Perubahan antarmuka

Prinsip: pakai identity.css, komponen, dan ikon yang sudah ada (lihat `VISUAL-LOCK.md`). Tidak ada gaya baru yang liar.

1. **Beranda menjadi percakapan.** Sapaan, kartu awal, kolom ketik dengan tombol mikrofon. Setelah pengguna mengirim, percakapan terjadi di halaman yang sama dengan tombol pilihan besar bertumpuk (di HP satu kolom, mudah dijangkau jempol).
2. **Penunjuk langkah** di atas: *Ceritakan → Pilih → Dikerjakan → Hasil* (sudah ada versi awal berupa tiga tombol di Beranda).
3. **Navigasi awam:** hanya Beranda, Hasil Saya (nama baru untuk Pekerjaan), Catatan. Kantor 3D, Tim, Studio, Pengetahuan, Browser, dan Pengaturan teknis berada di "Lainnya". Spesialis muncul kontekstual ("Dibantu: Sinta dari Marketing"), bukan daftar 22 divisi.
4. **Mode tampilan** dipilih sekali saat awal dengan tiga contoh: *Biasa · Besar · Besar dan kontras tinggi*.
5. **Suara:** masukan suara (Web Speech) dan bacaan hasil (TTS yang sudah ada).
6. **Mode Anak:** profil "Anak" mematikan browser, koneksi luar, pembayaran, dan pencarian bebas; kata disederhanakan; ada ajakan untuk didampingi orang tua. Catatan hukum: data anak berada di bawah aturan pelindungan data pribadi, jadi cakupannya perlu ditinjau sebelum dirilis.

## 7. Kamus bahasa (wajib, diuji otomatis)

| Hindari | Pakai |
|---|---|
| Agen / karyawan AI | Pembantu, atau nama orangnya |
| Goal / task | Pekerjaan |
| Approval / persetujuan | Konfirmasi ("Boleh?") |
| MCP / tool / capability | Kemampuan (hanya bila harus disebut) |
| Brain / knowledge base | Catatan / ingatan |
| Workspace | Ruang kerja |
| Token / model / prompt | tidak disebut |
| Error | "Ada yang belum berhasil" + dua jalan keluar |

Tes otomatis memindai teks antarmuka pengguna awam dan menandai kata dari kolom kiri.

## 8. Pemetaan ke kode saat ini

| Kebutuhan | Titik di kode | Catatan |
|---|---|---|
| Penerimaan niat | `orchestrate()` di `server/engine.js` | Hari ini teks yang terbaca seperti kerja langsung menjadi goal. Pemandu menyisipkan langkah tanya dan rencana *sebelum* itu |
| Membuat pekerjaan | `submitGoal()` | Dipanggil hanya pada langkah Kerjakan |
| Revisi | `decideApproval()` (`reject` + `feedback`) | Dipakai ulang untuk "Ubah sedikit" |
| Penyimpanan hasil | `server/librarian.js`, `server/brain.js` | Judul dan folder otomatis |
| Model dan JSON ketat | `server/llm.js` (`GROQ_STRICT`) | Untuk keluaran pilihan |
| Pemilih alat | `toolsFor()` di engine, router browser di `server/browser.js` | Perluas ke semua alat |
| UI Beranda | `DashboardView` di `public/js/views.js` | Diganti/diperluas jadi percakapan |
| Komponen pilihan | baru, `public/js/pemandu-view.js` | Pakai `.btn`, `icon()`, identity.css |
| Suara | `public/js/tts.js` (sudah ada), Web Speech untuk masukan | Masukan suara belum ada |

Aturan proyek tetap berlaku: baca `AGENTS.md` dan `VISUAL-LOCK.md`, jangan memperbarui `visual-lock.json` otomatis, jalankan `node docs/mascot-v4-2/verify-v42.mjs` dan `npm test`, uji hanya di salinan terisolasi.

## 9. Pengukuran dan uji dengan orang nyata

Target awal (perlu dikoreksi dengan data):
- Waktu sampai hasil pertama: di bawah 60 detik.
- Ketukan atau ketikan sebelum hasil: tidak lebih dari 4.
- Pertanyaan balik per permintaan: tidak lebih dari 2, dan 0 bila profil sudah cukup.
- Persentase sesi yang berakhir dengan hasil yang dipakai: dipantau mingguan.
- Biaya per sesi: dipantau, dengan ambang peringatan.
- Kata terlarang pada antarmuka: 0.

Uji pengguna: 5 orang per kelompok usia, tanpa bantuan, dengan tugas nyata ("buat promo untuk tokomu"). Yang diamati: di mana ragu, kata yang tidak dipahami, tombol yang dilewatkan. Hasil uji menentukan perubahan, bukan asumsi di dokumen ini.

## 10. Tahapan pembangunan (tiap tahap bisa dirilis sendiri)

| Tahap | Isi | Hasil yang terlihat |
|---|---|---|
| T0 | Kamus bahasa, sembunyikan istilah teknis, ganti nama menu | Wajah antarmuka bersih dari jargon |
| T1 | Pemandu di Beranda dengan **templat L0** untuk 5–6 niat umum, tombol pilihan, rencana 3 opsi, memanggil `submitGoal` | Alur tanya-pilih-kerjakan berjalan tanpa token ekstra untuk niat umum |
| T2 | Pilihan buatan model kecil (JSON ketat) untuk niat tak terduga, dengan cache dan cadangan templat | Pemandu paham permintaan apa pun |
| T3 | Kartu hasil: Pakai/Ubah sedikit/Ulangi/Simpan, simpan otomatis, langkah lanjut | Siklus lengkap sampai tersimpan |
| T4 | Profil "Yang aku tahu tentang kamu", onboarding 60 detik, kartu "Lanjutkan kemarin" | Tidak menanyakan hal yang sama dua kali |
| T5 | Koneksi sebagai kartu, pemilih alat otomatis penuh, konfirmasi pengganti persetujuan | Pengguna tidak pernah menyentuh MCP |
| T6 | Masukan suara, Mode Besar, Mode Anak | Kenyamanan lintas usia dan keamanan anak |
| T7 | Uji dengan pengguna nyata dan perbaikan | Angka bagian 9 terukur |

Rekomendasi: kerjakan **T0 dan T1 lebih dulu**. Keduanya paling terlihat oleh pengguna, hampir tanpa biaya token, dan memvalidasi seluruh kerangka.

## 11. Keputusan yang masih terbuka (perlu jawaban Owner)

1. Apakah Mode Anak ikut rilis pertama atau ditunda sampai tinjauan hukum selesai?
2. Aksi berisiko rendah (menulis, meringkas, riset) berjalan otomatis tanpa konfirmasi. Setuju?
3. Nama Pemandu: tetap "Pemandu", memakai nama asisten pribadi yang sudah ada (mis. Sora), atau nama baru?
4. Beranda lama (kolom tugas dan daftar pekerjaan) tetap tersedia untuk pengguna mahir sebagai "Mode Lengkap", atau dihapus?

## 12. Risiko

- **Model kecil salah format:** diatasi skema ketat dan cadangan templat.
- **Terlalu banyak bertanya membuat pengguna bosan:** batas 2 pertanyaan, dan tombol "Serahkan ke kamu" selalu ada.
- **Biaya token naik:** templat L0 untuk niat umum, cache, dan model besar hanya untuk karya.
- **Pengguna awam menekan aksi berdampak:** konfirmasi dengan pratinjau, aksi mudah dibatalkan.
- **Keamanan anak dan data pribadi:** Mode Anak dengan pembatasan dan tinjauan hukum.
- **Asumsi generasi keliru:** uji pengguna nyata (bagian 9) sebelum menyimpulkan.
