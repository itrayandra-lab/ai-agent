# Ringkasan riset ChatGPT dan prioritas untuk RAIVERSE

Diringkas orkestrator pada 2026-11-19 dari empat riset: `../riset-chatgpt-work.md`, `01-alur-pengguna.md`, `02-integrasi-dan-agen.md`, `03-arsitektur-teknis.md`. Semua isi berasal dari laporan pembantu riset dan belum diverifikasi ulang satu per satu. Banyak halaman resmi OpenAI menolak diambil (403), jadi sebagian bahan berasal dari ringkasan sumber kedua dan ditandai begitu di tiap berkas.

## Pelajaran inti (satu kalimat tiap bidang)
- **Alur pengguna:** pilihan awal sedikit, pengungkapan bertahap, dan hasil nyata dulu sebelum "kenalan". OpenAI mengumumkan Chat dan Work akan digabung (2026-11-02), sejalan dengan prinsip RAIVERSE tanpa mode.
- **Integrasi:** satu kolom ketik, alat dipilih sistem ("@" hanya jalan pintas), semua alat luar tampil seragam sebagai plugin atau app.
- **Izin:** dua lapis (apa yang terjangkau dan kapan berhenti) dengan tiga mode sederhana; aksi berdampak selalu minta konfirmasi; isi web dianggap tidak tepercaya; satu aturan izin berlaku di semua jalur (suara, tujuan panjang, jadwal).
- **Kemajuan:** tujuan panjang tampil sebagai satu baris (jeda, lanjut, ubah), status empat kata, dan satu tempat untuk tugas terjadwal.
- **Teknis:** kunci cache wajib per pengguna (pelajaran kebocoran 2023), pembatasan laju berlapis, event streaming bernomor dengan sambung ulang, konfirmasi manusia untuk aksi berisiko, dan mode aman bila usia ragu.

## SEKARANG (dikerjakan sesi "UI Kantor 3D rapi + navigasi compact")
1. Hidupkan kartu Sambungan Telegram/Discord (kodenya sudah ada tapi yatim) sebagai satu kartu "Sambungkan".
2. Pilihan izin tiga kata (Tanya dulu, Lanjut sendiri, Serahkan penuh hanya untuk pengelola) tanpa menampilkan "Akses penuh" bagi pengguna biasa.
3. Status empat kata dan lonceng aktivitas; kartu kemajuan dengan Jeda dan Tambah arahan.
4. Tombol Cari dan Percakapan baru di Beranda desktop; "@" untuk memilih staf atau kemampuan; tombol Bacakan untuk balasan Pemandu.
5. Pratinjau konfirmasi yang menampilkan isi persis yang akan dikirim.
6. Bagian Terjadwal sederhana ("Ulangi tiap ...").
7. Tombol unduh dan hapus data pribadi di Pengaturan.
8. Bersihkan jargon yang bocor; perbaiki pesan 403 gerbang.
9. Jangan tambah pemilih mode baru; hasil nyata dulu sebelum onboarding "kenalan".

## MENYUSUL (hardening backend, setelah sesi "Uji nyata" selesai)
1. Tes kebocoran lintas ruang kerja dan kunci cache berawalan `wsId:userId`.
2. Event siaran bernomor `seq` dengan buffer sambung ulang.
3. `Retry-After` dan backoff berjitter.
4. Tabel risiko per alat yang menentukan kapan konfirmasi wajib.
5. Dua antrean (penting dan latar) dengan load shedding.
6. Log JSONL dengan `traceId`.
7. "Proyek" ringan dengan tombol Lampirkan.

## JANGAN DITIRU
- Menambah pemilih mode untuk pengguna biasa.
- Menampilkan "Full access" tanpa penjelasan dan tanpa peringatan jelas.
- Mengandalkan klaim internal ChatGPT yang tidak dipublikasikan (skema percakapan, kuota aplikasi); ambil polanya, bukan angkanya.
