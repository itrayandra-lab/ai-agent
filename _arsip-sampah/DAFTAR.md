# Daftar arsip dan perapian (2026-11-19)

Tidak ada berkas yang dibuang permanen dan tidak ada berkas tidak terpakai yang jelas yatim, jadi folder ini kosong. Semua perpindahan:

| Asal | Tujuan | Alasan |
|---|---|---|
| `docs/client_secret_*.json` | `_rahasia-lokal/` (diabaikan git) | Rahasia OAuth tidak semestinya di docs. Tidak pernah dilacak git. |
| `artifacts/` | `docs/gambar/artifacts/` | Konsep UI, ikon, logo hasil eksplorasi |
| `docs/chat-gpt-assets/` | `docs/gambar/chat-gpt-assets/` | Kumpulkan gambar |
| `docs/logo/` | `docs/gambar/logo/` | Kumpulkan gambar |
| `Using OAuth 2.0 to Access Google APIs.md`, `google drive api overview.md` (akar) | `docs/riset/` | Bahan bacaan luar |

Sengaja TIDAK dipindah: `3D karakter/` (aturan mascot melarang menyentuh `_backup_*`, rollback bergantung padanya), `arsip-dummy/` (folder arsip bawaan aplikasi), `docs/uji-nyata/` (ditulis skrip), `docs/*.md` (dirujuk komentar kode di server/).
