# Folder FUNDAMENTAL

Satu tempat untuk memahami RAIVERSE. Dokumen hidup: diperbarui setiap ada perubahan.

| Berkas | Isi |
|---|---|
| `01-FUNDAMENTAL.md` | Tujuan, prinsip yang sudah diputuskan, dan diagram (kode mermaid) |
| `00-STATUS.md` | Status terkini tiap bagian (tabel) dan riwayat perubahan |
| `index.html` | Halaman yang menampilkan diagram dan status; buka langsung di browser |
| `../PETA-WEBSITE.md` | Isi website dari kode |
| `../PETA-BACKEND.md`, `../PETA-OTAK.md` | Peta backend dan otak (dari sesi perapian) |

## Cara memperbarui
1. Ubah diagram di `01-FUNDAMENTAL.md` (blok ` ```mermaid ` dengan baris `%% id: nama`).
2. Perbarui tabel di `00-STATUS.md`.
3. Jalankan `node scripts/sync-fundamental.mjs` supaya `index.html` mengikuti.
