> **ARSIP (2026-11-19):** dokumen sejarah, tidak lagi menggambarkan sistem sekarang. Yang berlaku: `docs/README.md`, `docs/PETA-BACKEND.md`, `docs/PETA-OTAK.md`.

# Sesi baru: Orkestrator, chat, rapat, goal (serah-terima dari sesi 3D)

Folder ini adalah satu-satunya hal yang perlu Anda sebutkan ke sesi baru (`@docs/sesi-baru-orkestrator`).
Aplikasi: `D:\01-raymaizing\01-deployments\ray agent\` (server http://localhost:4317).

## Prompt untuk ditempel ke sesi baru
> Baca semua berkas di `docs/sesi-baru-orkestrator/` lalu `docs/mascot-v4-2/README.md` (khusus 07). Jangan mengubah apa pun sebelum menjalankan `node docs/mascot-v4-2/verify-v42.mjs` (harus 71 lolos). Tugas: kerjakan `02-TUGAS-BELUM-SELESAI.md` berurutan. Aturan di `03-ATURAN.md` mengikat. Setiap perubahan: cadangkan berkas ke `3D karakter/_backup_runtime_before_v42_logic/passNN/`, jalankan `node --check`, jalankan penjaga, perbarui docs/mascot-v4-2/07 dan penjaga bila perlu. Laporkan jujur apa yang terbukti dan apa yang tidak.

## Isi folder
- `01-RINGKASAN-PERUBAHAN.md` apa saja yang sudah diubah (gelombang 1-12), berkas, dan cara membuktikan.
- `02-TUGAS-BELUM-SELESAI.md` pekerjaan yang tersisa, terutama audit backend rapat dan goal.
- `03-ATURAN.md` aturan kerja, larangan, cara uji aman.
- `04-PETA-KODE-CHAT.md` peta fungsi dan endpoint chat, grup, goal, rapat.

## Keadaan singkat
Karakter V4.2 (12 id) terpasang; sinematik awal; UI glassmorph; plaza ditata ulang; FXAA; fokus blur Play diperbaiki; dock Orkestrator (chat tunggal, grup, goal otomatis, sorotan agen) terpasang; backend `POST /api/orchestrate`. Server harus di-restart (`npm start`) setelah perubahan `server/*`.
