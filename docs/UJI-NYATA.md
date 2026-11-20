# Uji nyata: apakah agen RAIVERSE benar-benar mengeksekusi?

Tanggal uji: 2026-11-19. Model asli: `openai/gpt-oss-20b` (Groq) untuk semua peran (asisten pribadi, manajer, kemampuan). Tidak ada kemampuan yang meminta model besar.
Semua uji jalan di SALINAN data Owner (folder sementara); data asli di `data/`, server Owner (4400), Telegram uji (4611) dan 30 alur n8n Owner tidak disentuh.
n8n diganti n8n tiruan lokal. `staffModel` dinyalakan hanya di salinan.

## Ringkasan jujur

| Hal | Hasil |
|---|---|
| 31 kemampuan, 116 masukan, model asli | **116 dari 116 lulus** (aturan benar, bukti ada, angka dalam rentang); jawaban AI sah di 104 dari 116 (90%); 45 lulus "ketat" (kata kunci dan panjang pembahasan juga cocok). 4 masukan sengaja berantakan ditolak sopan oleh pelari |
| 41 skenario lintas 22 divisi | **19 lulus, 22 gagal** (46%). Jalur manajer 16 dari 25 (64%); jalur penuh 3 dari 16 (19%) |
| Biaya semua uji model asli | **sekitar $0,37** dari anggaran $0,5 (buku biaya: `docs/uji-nyata/buku-biaya.jsonl`) |
| Kesimpulan | Kemampuan (lapisan paling bawah) kuat dan murah. Yang lemah ada di ATAS: model kecil sebagai asisten pribadi dan manajer sering tidak memanggil staf, mendelegasikan keliru, atau berhenti sebelum selesai. Staf native belum layak dinyalakan luas; canary kecil saja (lihat bawah) |

## Cara menjalankan

```bash
node scripts/uji-nyata.mjs --kemampuan                 # 31 kemampuan x 3+ masukan, sekitar $0,014
node scripts/uji-nyata.mjs --skenario --batas 0.2      # 41 skenario, sekitar $0,17 bila tanpa ulangan
node scripts/uji-nyata.mjs --id fin-laba,hr-gaji       # skenario tertentu
```

Pilihan: `--batas <USD>` (anggaran total, bawaan 0,45; uji berhenti dan melaporkan bila 92% terpakai), `--batas-skenario <USD>` (bawaan 0,015; satu skenario yang lewat 1,5 kali batas ini dibatalkan dan dihitung gagal),
`--keluar berkas.json`, `--jalur penuh|manajer`, `--tenang`. Kunci diambil dari `.env` (`GROQ_API_KEY`) dan tidak pernah dicetak. Tiap jalan menambah satu baris ke `docs/uji-nyata/buku-biaya.jsonl`.
Dari konsol admin: bagian **Kesehatan otak**, tombol **Uji ulang** (menjalankan skrip yang sama di proses terpisah, batas biaya maksimal $0,3).
Skenario ada di `test/scenarios/skenario.json` (bentuknya di `test/scenarios/README.md`). Hasil mentah: `docs/uji-nyata/hasil-skenario.json` (putaran 1, 41 skenario), `hasil-skenario-2.json` (putaran 2, 14 diulang), `skenario-akhir.json` (gabungan), `hasil-kemampuan.json`.

**Dua putaran, dijelaskan jujur.** Putaran 1 menjalankan 41 skenario ($0,169). Ia menemukan dua cacat PENILAI dan satu perubahan Pemandu: (a) kata "persetujuan" yang ditulis AI di hasil dihitung sebagai jargon layar (sekarang hanya dicatat),
(b) batas panjang 40 huruf menggagalkan jawaban pendek yang benar ("2,5 kg = 2500 gram"), (c) Pemandu kini lebih dulu mengobrol; permintaan kerja harus lewat usulan kerja (`proposeFor`) lalu konfirmasi, sehingga 6 skenario penuh tidak pernah menjadi pekerjaan.
Penilai dan pintu depan harness diperbaiki, lalu 14 skenario diulang (putaran 2, $0,079). Skenario yang tidak diulang (27) dinilai dengan penilai putaran 1; sebagian gagalnya (mis. `ops-otomasi`, `scm-permintaan`, `ecom-iklan`, `exec-prioritas`, `data-web`) disebabkan pintu depan lama dan BELUM diulang karena anggaran. Jangan dibaca sebagai kegagalan sistem.

## Kontrak eksekusi (server/staff/kontrak.js, diuji test/kontrak-eksekusi.test.js)

| Aturan | Isi | Tes |
|---|---|---|
| K1 | "selesai" hanya bila ada bukti: berkas sah, data sah, atau (staf teks-saja) teks utuh; bukti disimpan di catatan jalan (`bukti[]`) | pemeriksa murni, pelari |
| K2 | berkas sah menurut jenis: CSV punya judul, JSON terbaca, HTML bertag, teks tidak kosong | pemeriksa murni |
| K3 | tidak ada nilai rusak (NaN, undefined, null, [object Object]) di ringkasan, teks, berkas, data | pelari: hitungan gagal → "gagal" + dua jalan keluar |
| K4 | kalimat "ditulis AI" hanya bila AI benar menjawab dengan sah | pemeriksa murni |
| K5 | jawaban AI rusak diulang SEKALI; lalu versi aturan; bila hasil AI tidak lolos pemeriksaan, AI dibuang dan versi aturan dicoba; bila tetap rusak: gagal, pesan awam, dua jalan keluar ("Coba lagi", "Ubah isiannya atau pilih pekerjaan lain") | pelari (2 tes) |
| K6 | aksi berdampak butuh izin: status `butuh_izin`, tanpa bukti, tidak pernah selesai sebelum disetujui; ditolak = tidak jalan | pelari |
| K7 | saluran belum tersambung gagal jujur (Google Sheets tanpa konektor: "Google belum tersambung") | pelari |
| K8 | batas waktu mesin native = "gagal" (sebelumnya status "menunggu" yang tidak pernah selesai: cacat yang ditemukan dan diperbaiki) | pelari |
| E1 | di engine: id jalan (`run-...`) yang dicantumkan agen sebagai bukti hanya sah bila jalan itu ada, selesai, dan berbukti; id karangan = tidak terverifikasi | engine (2 tes) |
| E2 | di engine: hasil tool `staf` yang gagal, menunggu izin, atau hanya daftar tidak dihitung sebagai bukti | engine |
| E3 | di engine: tugas yang baru mendelegasikan subtugas tidak boleh memanggil `complete_task` sebelum subtugas selesai | (dicoba di uji nyata) |

Penambahan lain di jalur agen: petunjuk "langkah pertama" (kemampuan yang cocok dipilih dengan pencocokan kata kunci, top-3 tepat untuk 39 dari 39 skenario) ditempel ke konteks tugas manajer, dan untuk asisten pribadi/master berisi manajer divisi yang tepat.
Bila agen menjawab teks saja tanpa menjalankan staf, ia diingatkan sekali; asisten pribadi/master yang tetap tidak mendelegasikan didelegasikan otomatis oleh sistem (tanpa AI). Satu panggilan Groq kini punya batas waktu 90 dtk (dulu tanpa batas: satu sambungan menggantung = tugas macet selamanya).

## Hasil per divisi (skenario, gabungan dua putaran)

| Divisi | Lulus/Total | Waktu rata-rata | Biaya |
|---|---|---|---|
| hr | 3/3 | 30 dtk | $0.0145 |
| qa | 2/2 | 9 dtk | $0.0060 |
| it | 2/2 | 11 dtk | $0.0098 |
| reg | 1/1 | 20 dtk | $0.0054 |
| mfg | 1/1 | 9 dtk | $0.0027 |
| kms | 1/1 | 9 dtk | $0.0030 |
| retail | 1/1 | 10 dtk | $0.0023 |
| fin | 2/3 | 13 dtk | $0.0105 |
| bizdev | 1/2 | 16 dtk | $0.0046 |
| rnd | 1/2 | 9 dtk | $0.0026 |
| cs | 2/4 | 27 dtk | $0.0100 |
| eng | 1/2 | 6 dtk | $0.0024 |
| exec | 1/2 | 32 dtk | $0.0086 |
| legal | 0/1 | 22 dtk | $0.0123 |
| design | 0/1 | 7 dtk | $0.0018 |
| data | 0/3 | 7 dtk | $0.0062 |
| sales | 0/2 | 73 dtk | $0.0258 |
| ops | 0/3 | 14 dtk | $0.0156 |
| scm | 0/1 | 2 dtk | $0.0001 |
| mkt | 0/2 | 96 dtk | $0.0256 |
| studio | 0/1 | 42 dtk | $0.0137 |
| ecom | 0/1 | 1 dtk | $0.0001 |

## Hasil per skenario

| Skenario | Jalur | Putaran | Hasil | Waktu | Biaya | Catatan |
|---|---|---|---|---|---|---|
| fin-cicilan | manajer | 1 | GAGAL | 8 dtk | $0.0012 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf) |
| fin-ppn | manajer | 1 | lulus | 9 dtk | $0.0009 |  |
| bizdev-impas | manajer | 1 | GAGAL | 17 dtk | $0.0013 | angka 12500000 tidak ada di hasil |
| hr-cuti | manajer | 1 | lulus | 15 dtk | $0.0006 |  |
| rnd-satuan | manajer | 2 | lulus | 4 dtk | $0.0007 |  |
| qa-sampel | manajer | 2 | lulus | 14 dtk | $0.0049 |  |
| rnd-encer | manajer | 1 | GAGAL | 15 dtk | $0.0020 | hasil terlalu pendek (35); tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf) |
| cs-skor | manajer | 1 | lulus | 15 dtk | $0.0010 |  |
| eng-tanggal | manajer | 2 | GAGAL | 8 dtk | $0.0015 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf); hasil tidak memuat kata kunci: [[ |
| it-disk | manajer | 1 | lulus | 4 dtk | $0.0016 |  |
| cs-komentar | manajer | 1 | lulus | 10 dtk | $0.0014 |  |
| legal-iklan | manajer | 1 | GAGAL | 22 dtk | $0.0123 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf) |
| reg-klaim | manajer | 1 | lulus | 20 dtk | $0.0054 |  |
| design-kontras | manajer | 1 | GAGAL | 7 dtk | $0.0018 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf); hasil tidak memuat kata kunci: [[ |
| hr-onboarding | manajer | 2 | lulus | 7 dtk | $0.0029 |  |
| mfg-batch | manajer | 1 | lulus | 9 dtk | $0.0027 | kemampuan lain dipakai |
| kms-panduan | manajer | 2 | lulus | 9 dtk | $0.0030 |  |
| data-rapikan | manajer | 1 | GAGAL | 4 dtk | $0.0013 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf) |
| bizdev-pemasok | manajer | 1 | lulus | 15 dtk | $0.0033 |  |
| sales-mitra | manajer | 1 | GAGAL | 38 dtk | $0.0068 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf); jargon: persetujuan |
| it-risiko | manajer | 1 | lulus | 18 dtk | $0.0082 |  |
| eng-struktur | manajer | 2 | lulus | 4 dtk | $0.0009 |  |
| retail-pilah | manajer | 1 | lulus | 10 dtk | $0.0023 | kemampuan lain dipakai |
| ops-rencanakerja | manajer | 1 | GAGAL | 6 dtk | $0.0021 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf); jargon: persetujuan |
| qa-hasiluji | manajer | 1 | lulus | 3 dtk | $0.0010 |  |
| fin-laba | penuh | 2 | lulus | 23 dtk | $0.0084 |  |
| sales-diskon | penuh | 2 | GAGAL | 107 dtk | $0.0190 | pekerjaan tidak sampai ke hasil (melebihi-biaya); hasil terlalu pendek (0) |
| hr-gaji | penuh | 2 | lulus | 69 dtk | $0.0110 |  |
| ops-otomasi | penuh | 1 | GAGAL | 2 dtk | $0.0001 | pekerjaan tidak sampai ke hasil (chat); hasil terlalu pendek (0) |
| scm-permintaan | penuh | 1 | GAGAL | 2 dtk | $0.0001 | pekerjaan tidak sampai ke hasil (chat); hasil terlalu pendek (0) |
| data-janggal | penuh | 2 | GAGAL | 7 dtk | $0.0034 | tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf); angka 118.75 tidak ada di hasil |
| mkt-caption | penuh | 2 | GAGAL | 139 dtk | $0.0073 | pekerjaan tidak sampai ke hasil (error); hasil terlalu pendek (0) |
| studio-naskah | penuh | 1 | GAGAL | 42 dtk | $0.0137 | jargon: persetujuan |
| cs-balasan | penuh | 2 | GAGAL | 62 dtk | $0.0000 | pekerjaan tidak sampai ke hasil (error); hasil terlalu pendek (0) |
| ops-jadwal | penuh | 1 | GAGAL | 35 dtk | $0.0134 | hasil tidak memuat kata kunci: [["2026-12-07","7 Desember","07-12-2026"]]; jargon: persetujuan |
| ecom-iklan | penuh | 1 | GAGAL | 1 dtk | $0.0001 | pekerjaan tidak sampai ke hasil (chat); hasil terlalu pendek (0) |
| exec-prioritas | penuh | 1 | GAGAL | 1 dtk | $0.0001 | pekerjaan tidak sampai ke hasil (chat); hasil terlalu pendek (0) |
| mkt-rencana | penuh | 1 | GAGAL | 53 dtk | $0.0183 | pekerjaan tidak sampai ke hasil (melebihi-biaya); hasil terlalu pendek (0) |
| data-web | penuh | 1 | GAGAL | 10 dtk | $0.0016 | pekerjaan tidak sampai ke hasil (chat); hasil terlalu pendek (0) |
| konfirmasi-otomasi | penuh | 2 | lulus | 64 dtk | $0.0085 |  |
| saluran-wa | penuh | 2 | GAGAL | 20 dtk | $0.0075 | hasil tidak menyebut dengan jelas bahwa WhatsApp belum tersambung / pengguna yang perlu mengirim |

## Hasil per kemampuan (model asli)

Lulus = hasil aturan benar, bukti ada, angka dalam rentang. AI sah = jawaban AI lolos skema. Ketat = juga kata kunci dan panjang pembahasan cocok (kata kuncinya ditulis untuk jawaban tiruan, jadi ketat sengaja keras).

| Kemampuan | Lulus | AI sah | Ketat |
|---|---|---|---|
| analisis-angka | 3/3 | 3/3 | 1/3 |
| analisis-hasil-uji | 5/5 | 5/5 | 3/5 |
| analisis-kinerja-penjualan | 3/3 | 3/3 | 2/3 |
| bandingkan-pilihan | 4/4 | 3/4 | 2/4 |
| catat-produksi-mutu | 3/3 | 3/3 | 1/3 |
| cocokkan-bersihkan-data | 4/4 | 4/4 | 1/4 |
| desain-visual-teknis | 5/5 | 5/5 | 0/5 |
| hitung-harga-biaya | 5/5 | 5/5 | 2/5 |
| hitung-hemat-otomasi | 4/4 | 4/4 | 3/4 |
| hitung-sdm | 5/5 | 5/5 | 0/5 |
| hitung-teknis | 6/6 | 6/6 | 2/6 |
| kelola-pengetahuan | 4/4 | 4/4 | 1/4 |
| klasifikasi-pilah | 3/3 | 3/3 | 1/3 |
| laporan-ringkasan-kerja | 3/3 | 3/3 | 3/3 |
| nilai-skor | 4/4 | 1/4 | 0/4 |
| periksa-kepatuhan | 4/4 | 4/4 | 4/4 |
| periksa-mutu-teks | 4/4 | 3/4 | 1/4 |
| perkiraan-stok-kapasitas | 5/5 | 5/5 | 3/5 |
| peta-risiko | 4/4 | 3/4 | 2/4 |
| prioritas-keputusan | 4/4 | 4/4 | 1/4 |
| rancang-struktur | 3/3 | 3/3 | 0/3 |
| ringkas-umpan-balik | 3/3 | 2/3 | 0/3 |
| riset-halaman-web | 3/3 | 3/3 | 1/3 |
| susun-daftar-periksa | 4/4 | 4/4 | 4/4 |
| susun-jadwal | 3/3 | 2/3 | 1/3 |
| susun-rencana-kerja | 3/3 | 2/3 | 1/3 |
| susun-rencana-pemasaran | 3/3 | 2/3 | 2/3 |
| tulis-dokumen-kerja | 3/3 | 3/3 | 1/3 |
| tulis-konten-pemasaran | 3/3 | 2/3 | 0/3 |
| tulis-naskah-video | 3/3 | 2/3 | 2/3 |
| tulis-pesan-pelanggan | 3/3 | 3/3 | 0/3 |

Perbaikan yang dibuat dari hasil ini: (1) daftar kosong dari AI kini sah (`nilai-skor`: sebelum perbaikan hanya 1 dari 4 jawaban AI diterima; satu kasus diuji ulang setelahnya dan diterima, sisanya belum diulang karena anggaran), (2) pilihan dengan huruf besar/spasi dirapikan, daftar berisi objek dirapikan (tetap ditolak bila tanpa teks), (3) kegagalan membuka halaman memberi pesan awam, bukan "fetch failed".
Mutu bahasa: pembahasan model kecil umumnya jelas, tetapi kadang kaku atau berulang; angka asing (yang tidak ada di masukan atau hasil aturan) tidak ditemukan pada contoh yang dibaca tangan. Penilaian bahasa ini belum disetujui manusia.

## Yang masih gagal

1. **Asisten pribadi dan manajer tidak konsisten memanggil staf** (model kecil). 8 dari 25 skenario jalur manajer menghitung/menulis sendiri atau mencari di web (jawabannya sering benar, tetapi tanpa bukti staf: `eng-tanggal`, `fin-cicilan`, `data-rapikan`, `design-kontras`, `legal-iklan`, `ops-rencanakerja`, `rnd-encer`, `sales-mitra`); 1 lagi memakai staf tetapi angka akhirnya tidak muncul di jawaban (`bizdev-impas`).
2. **Asisten pribadi kadang menyatakan "selesai menugaskan" tanpa hasil** (`data-janggal`); hasilnya ditandai "belum terverifikasi", tetapi pengguna tetap melihat kalimat itu.
3. **Jalur penuh mahal dan lambat**: rata-rata 25 sampai 100 detik dan $0,008 sampai $0,019 per skenario (10 sampai 36 panggilan). `sales-diskon` dan `mkt-rencana` melewati batas biaya skenario dan dibatalkan. Lingkaran `ask_colleague` antara asisten pribadi dan manajer adalah penyebab utama.
4. **Gangguan jaringan ke penyedia AI** ("fetch failed" berulang, `cs-balasan`) membuat tugas gagal setelah beberapa percobaan; pesan akhirnya jujur, tetapi tidak ada jalan keluar yang ditawarkan di jalur agen (hanya di jalur staf).
5. **Saluran belum tersambung (`saluran-wa`)**: hasil tidak mengaku terkirim (aman), tetapi tidak menyebut dengan jelas bahwa WhatsApp belum tersambung; perlu kalimat tegas.
6. Batas bawaan `goalBudgetUSD` 1,5 USD per goal terlalu longgar untuk model murah: satu lingkaran bisa menghabiskan banyak sebelum berhenti. Disarankan 0,05 sampai 0,1 sampai ada bukti lain.
7. Batas laju produksi 40 jalan staf per jam per ruang kerja (`LIMITS.perHour`) akan terasa untuk pengguna aktif; di uji dinaikkan.

## Belum teruji

- Saluran luar sungguhan: Telegram/Discord/WhatsApp/email (hanya penolakan jujur saat belum tersambung); Google Sheets/Drive (hanya jalur "belum tersambung").
- Jadwal berulang dan pemicu luar (n8n tiruan dipakai; alur n8n Owner tidak disentuh). Aksi keluar sungguhan: hanya gerbang konfirmasi otomasi yang diuji (0 alur menyala sebelum "Ya, nyalakan", 0 setelah "Batal").
- Model besar (`openai/gpt-oss-120b`) dan Claude: tidak diuji (anggaran); mungkin jauh lebih baik sebagai asisten pribadi/manajer dan itu jalur perbaikan paling murah untuk butir 1 sampai 3.
- Satu halaman web nyata (`example.com`) untuk pembaca halaman; situs lain, situs berat JavaScript, dan situs yang menolak robot belum.
- Beban banyak pengguna bersamaan; keandalan Groq pada jam sibuk.
- Layar Kesehatan otak diuji lewat tes server dan pemeriksaan sintaks; belum dilihat di peramban oleh sesi ini.

## Penyalaan bertahap (rekomendasi)

Pada data Owner `staffModel` TETAP mati. Urutan yang disarankan, berdasarkan angka di atas (lulus skenario manajer, tanpa jalur penuh):

| Tahap | Divisi | Alasan |
|---|---|---|
| Canary 1 | hr, qa, it, reg, mfg, kms, retail | 11 dari 11 skenario lulus, murah dan cepat (3 sampai 30 dtk). Kemampuannya hitungan dan pemeriksaan yang bisa dicek angkanya |
| Canary 2 | fin, bizdev, cs, eng, rnd, exec | lulus sebagian (50 sampai 67%); perbaiki petunjuk pemilihan kemampuan dulu (butir 1) |
| Tunda | sales, mkt, ops, data, studio, legal, design, scm, ecom | gagal atau terhambat jalur penuh dan pemilihan kemampuan; ulang uji setelah perbaikan |

Syarat sebelum canary: (1) pakai model besar atau menengah untuk asisten pribadi dan manajer (uji ulang `--model`), (2) turunkan `goalBudgetUSD`, (3) pantau lewat Kesehatan otak (tingkat sukses, galat terbanyak, macet), (4) ulang `node scripts/uji-nyata.mjs --skenario` bila kemampuan atau pedoman berubah.
Tanpa canary pun, kemampuan (31) aman dipakai langsung oleh pengguna lewat form/tombol karena kontrak eksekusi menjamin bukti atau kegagalan jujur.
