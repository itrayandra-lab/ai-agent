// The only "true from day one" knowledge: how this system works and the rules agents obey.
// Company facts (products, prices, numbers, customers) are NOT here on purpose: they come from the Owner (Brain editor or Google Drive), never from a seed.
const t0 = Date.now();
const note = (id, title, content, tags = []) => ({ id, title, folder: 'Sistem', content, tags: ['sistem', ...tags], kb: 'system', visibility: 'internal', authorId: 'system', pinned: true, createdAt: t0, updatedAt: t0 });

export function systemNotes() {
  return [
    note('sop-alur-kerja', 'SOP Alur Kerja RAIVERSE', `# SOP Alur Kerja RAIVERSE
Satu alur untuk semua kegiatan. Setiap pesan Owner melewati urutan ini, sekali, tanpa tumpang tindih:

1. **Thread goal?** Pesan di thread goal tetap di thread itu. PA menjawab; kepala divisi yang disebut namanya ikut masuk dan menjawab.
2. **Rapat?** Selama Owner ada di rapat live, semua pesan ke orkestrator diucapkan ke ruang rapat. Rapat baru hanya dibuka bila diminta ("rapat dengan …", "rapat baru").
3. **Goal?** Kalimat perintah kerja tanpa penerima (mis. "tolong buat rencana …") menjadi goal dengan thread sendiri.
4. **Obrolan.** Selain itu: obrolan biasa dengan agen yang dipilih (DM) atau beberapa agen (grup).

## Kontrak tugas
- Setiap tugas punya **hasil yang diharapkan**, peminta, penanggung jawab, dan tenggat.
- Saat selesai, agen wajib menyerahkan **bukti** (catatan Brain terverifikasi, URL, atau receipt) dan daftar **yang belum terpenuhi**.
- Tugas tanpa bukti ditandai **asumsi**. Hasil goal dari Owner selalu masuk **Butuh kamu** untuk direview sebelum dianggap selesai.
- Goal dipecah bertahap: riset (tahap 1) selesai dulu, baru eksekusi (tahap 2) di atas hasilnya.

## Hemat token
- Sapaan, status, progres, isi ingatan, dan koreksi dijawab langsung dari data tanpa panggilan AI.
- Pertanyaan berisi dijawab dengan **satu** panggilan model kecil berisi fakta yang relevan saja.
- Tidak ada agen yang bicara tanpa diajak; yang tidak punya poin baru diam.
`, ['sop', 'alur']),
    note('aturan-kejujuran-agen', 'Aturan Kejujuran Agen', `# Aturan Kejujuran Agen
1. **Fakta hanya dari sumber terverifikasi**: catatan bertanda *Owner*, *Drive*, atau *Sistem*, dan keadaan nyata di papan tugas.
2. Catatan bertanda *hasil agen* adalah draf: boleh dirujuk sebagai "draf dari …", bukan sebagai fakta.
3. Isi rapat atau obrolan sebelumnya **bukan fakta**.
4. Bila data tidak ada: katakan "datanya belum ada" dan sebutkan cara mendapatkannya.
5. Dilarang berjanji melakukan sesuatu yang tidak diperintahkan. Dilarang mengarang angka, pelanggan, kampanye, atau hasil.
6. Bila Owner mengoreksi: terima, tarik klaimnya, dan jangan ulangi dalam bentuk lain.
`, ['aturan']),
    note('kebijakan-kerahasiaan-data', 'Kebijakan Kerahasiaan Data', `# Kebijakan Kerahasiaan Data
Setiap catatan punya tingkat akses:
- **Pribadi**: hanya pemiliknya (dan agennya) yang boleh membaca.
- **Internal**: seluruh tim dan agen internal. Tidak boleh keluar ke publik.
- **Publik**: boleh dipakai agen yang melayani orang luar (pelanggan, tamu).

Agen yang melayani publik **hanya** boleh membaca catatan Publik. Bila ragu, anggap Internal.
`, ['kebijakan', 'keamanan']),
    note('status-data-perusahaan', 'Status Data Perusahaan', `# Status Data Perusahaan
Data perusahaan yang sebenarnya (produk, harga, pelanggan, angka penjualan, target) **belum diisi Owner**.
Semua catatan lama sudah dipindah ke folder *Arsip Dummy* karena isinya contoh/rekaan.

Sampai Owner mengisi data:
- Jangan berasumsi apa pun tentang produk, harga, pelanggan, kampanye, atau angka.
- Bila ditanya hal itu, katakan datanya belum ada dan minta Owner mengisinya (Brain → catatan baru, atau sambungkan Google Drive).
`, ['status']),
  ];
}
