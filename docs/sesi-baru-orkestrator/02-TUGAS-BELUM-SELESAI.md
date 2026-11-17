# Tugas belum selesai (urut prioritas)

Keluhan Owner: "terlalu banyak update, satu fungsi sering menimpa fungsi lain, masih banyak bug". Tujuan: chat, rapat, goal, dan beri tugas benar-benar andal.

## 1. Audit mendalam backend (belum dilakukan sama sekali)
Baca penuh dulu, catat temuan dengan bukti (baris kode atau uji), baru perbaiki.
- `server/collab.js`: `runMeeting` (baris sekitar 27), `handleOwnerMeetingMessage` (sekitar 117: agen tidak boleh menyela rapat yang dipimpin Owner sampai Owner bilang "selesai"), `askColleague`. Periksa kebocoran status agen, rapat macet bila satu panggilan LLM gagal, batas token dan biaya, perilaku saat lebih dari 25 peserta (diwakili kepala divisi), rapat ganda serentak.
- `server/engine.js`: `tick` (sekitar 116), `startJob/endJob/failTask`, `submitGoal` (sekitar 344), delegasi `create_subtask` (sekitar 500-510), `finishTask/completeTask`, `decideApproval`. Periksa goal yang tidak turun ke manajer dan staf, tugas yatim, siklus delegasi, retry tanpa batas, status `waiting` goal yang tidak pernah selesai, persetujuan yang menggantung.
- `server/governor.js`: anggaran per goal dan tugas, pemilihan model.
- Evaluasi efisiensi: jumlah panggilan LLM per goal, pemborosan konteks (`taskContext`, `systemPrompt`), penjadwalan `tick`.
- Uji tanpa LLM nyata dulu (mode simulasi), lalu satu uji live kecil bila Owner mengizinkan (ada biaya).

## 2. Halaman Chat lama
`public/js/views.js` ChatView (sekitar baris 1007-1030) hanya mengenal kanal `channel`, `dm`, `meeting`. Tambahkan bagian "Diskusi grup" untuk kanal `kind: 'group'` (dibuat oleh `engine.ensureGroup`), lengkap dengan judul dan anggotanya.

## 3. Dock Orkestrator: penyempurnaan
- Layar sempit (di bawah 500 px): dock memakan ruang; rapikan (`.odock` di glass.css).
- Thread orkestrator (DM dengan PA) menampilkan laporan tugas selesai yang panjang; pertimbangkan filter atau ringkasan.
- Kamera otomatis ke agen yang bekerja berisiko menarik kamera berulang; evaluasi dengan Owner.
- Uji dengan LLM nyata: kualitas diskusi grup dan ketepatan perutean goal vs chat (regex `WORK_RE` di engine.js bisa salah menebak).

## 4. Belum terbukti
- Semua perubahan visual diuji di salinan terisolasi dengan rAF sekitar 1 FPS, belum di 60 FPS mesin Owner.
- Interaksi kontak karakter (jabat tangan, high-five) belum diterapkan di kantor (docs/mascot-v4-2/05 bagian D1).
- Bila karakter terasa "datar": pencahayaan film kantor (haze, "Gaya warna film: Lembut", bloom) belum diubah.

## 5. Blur Play (sudah diperbaiki, perlu dikonfirmasi Owner)
- Gejala: seluruh layar kabur di Play. Penyebab: fokus DOF terlalu dekat (player.dist + 0,6, bisa 2,8) sehingga blur jauh (mulai 1,2x jarak fokus, penuh 5x) mengenai karakter, meja, monitor.
- Perbaikan (office3d.js, fungsi draw): fokus Play = max(jarak kamera ke karakter + 0,5; 5,5); orang pertama = 14; kecepatan fokus 0,35/frame; pengaman isFinite. Diuji hanya lewat nilai uniform (fokus 6,38 pada DOF 70%), belum dilihat di 60 FPS Owner. Bila masih kabur: kecilkan "Kedalaman medan" di Pengaturan visual atau kurangi dofAmt di Play.
- Dock Orkestrator di layar sangat sempit (sekitar 300 px) memakan banyak ruang: belum dirapikan (lihat tugas 3).
- Owner perlu restart server (npm start) lalu Ctrl+F5, kalau tidak halaman masih menampilkan bar bawah lama.
