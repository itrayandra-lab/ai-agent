# Arsip kode (dipindah, bukan dihapus)

Dibuat oleh konsolidasi 2026-11-20 (docs/FUNDAMENTAL/konsolidasi/AUDIT.md). Pulihkan dengan `git mv` kembali.

| Berkas arsip | Asal | Alasan |
|---|---|---|
| server-admin.js, server-gdrive.js, server-librarian.js, server-roster-extra.js, server-roster-studio.js, server-roster-teams.js, server-roster.js, server-skills-deep.js, server-skills-extra.js, server-sop.js, server-studio.js, server-tts-edge.js | server/<nama>.js | Berkas peneruskan satu baris (`export * from './<folder>/<nama>.js'`) sisa pemindahan folder; `scripts/inventaris.mjs` membuktikan tidak ada impor (server, tes, skrip). Modul asli ada di server/admin, integrasi, organisasi, pengetahuan. |
