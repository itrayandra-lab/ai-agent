# 06. Rollback

Lakukan hanya atas permintaan Owner. Selalu jalankan `node docs/mascot-v4-2/verify-v42.mjs` sebelum dan sesudah untuk melihat apa yang berubah (setelah rollback penuh penjaga sengaja akan GAGAL).

## Cadangan yang tersedia

| Lokasi (di `3D karakter\`) | Isi |
|---|---|
| `_backup_agents_v3_20261117\` | aset V3: kiko, azure, charcoal (+lod) dan terra, mallow, blueprint, sprout, clover, sage (glb, lod, face.png, json) |
| `_backup_runtime_before_v42_logic\` | `assets3d.js`, `office3d.js` sebelum gelombang 1-2 |
| `_backup_runtime_before_v42_logic\pass3\` | `assets3d.js`, `office3d.js`, `views.js` sebelum gelombang 3 (sinematik + anti-gepeng) |
| `_backup_runtime_before_v42_logic\pass4\` | `office3d.js` sebelum gelombang 4 (FOV Mode Play) |

## Rollback sebagian (disarankan)

- **Matikan sinematik saja:** tambahkan `?nointro` ke URL (tanpa mengubah kode), atau hapus blok C1 di `views.js`.
- **FOV Mode Play:** ubah `PLAY_FOV` di `office3d.js` (mis. 65 mengembalikan perilaku lama; distorsi tepi layar kembali).
- **Gerak lengan:** ganti `clipDriven` (A8) menjadi `name === 'Wave' || (gestNow && name === GEST_CLIP[gestNow])` (perilaku lama; lengan kiri diam kembali).
- **Ekspresi:** kembalikan `updateFace` dari cadangan.

## Rollback penuh ke karakter V3

1. Salin isi `_backup_agents_v3_20261117\` ke `public/assets/characters/agents/` (termasuk `lod/`).
2. Hapus berkas `*.glb`, `lod/*.glb`, `*.face.png`, `*.json` untuk id `*_ocean`, `*_coral`, `branch*` (dan `branch.*`).
3. `index.json`: `ids` = `terra, mallow, blueprint, sprout, clover, sage, charcoal, kiko, azure` (id lain boleh tetap di `retired`).
4. `assets3d.js`: `CHIBI.ids` sama dengan butir 3; kembalikan baris A2/A4/A8 bila ingin perilaku lama; naikkan `AGENT_V`.
5. Muat ulang dengan Ctrl+F5.

## Setelah rollback

Perbarui `verify-v42.mjs` (daftar `IDS`/pemeriksaan) atau tandai folder ini "tidak berlaku", dan catat alasannya di `01-KEADAAN-SAAT-INI.md`.
