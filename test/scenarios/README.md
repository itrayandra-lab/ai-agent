# Skenario uji nyata

`skenario.json` memuat 41 skenario lintas 22 divisi (hitung, tulis, periksa, berkas, riset, satu alur konfirmasi, satu alur saluran yang belum tersambung).
Dijalankan oleh `scripts/uji-nyata.mjs` dengan model AI asli di SALINAN data (folder sementara). Cara pakai dan hasil: `docs/UJI-NYATA.md`.

Bentuk satu skenario:

| Bidang | Arti |
|---|---|
| `id`, `divisi` | nama unik dan divisi yang paling relevan |
| `jalur` | `penuh` = pesan → Pemandu (usulan kerja + konfirmasi) → asisten pribadi → manajer → kemampuan/staf → hasil → Catatan; `manajer` = pekerjaan langsung ke manajer divisi (lebih murah) |
| `jenis` | `hitung`, `tulis`, `periksa`, `berkas`, `riset`, `konfirmasi`, `saluran` |
| `pesan` | kalimat pengguna awam apa adanya |
| `kemampuan` | kemampuan yang diharapkan (kemampuan lain yang sah hanya dicatat) |
| `kriteria.stafSelesai` | minimal satu jalan staf selesai dan berbukti |
| `kriteria.angka` | `{nilai, toleransi, mutlak?}`: angka itu harus muncul di hasil akhir (format Indonesia dibaca: 1.250.000 dan 33,3) |
| `kriteria.mengandung` | daftar kelompok; tiap kelompok cukup salah satu kata (huruf besar kecil diabaikan) |
| `kriteria.berkas` | jenis berkas yang harus ada dan terbaca |
| `kriteria.panjangMin` | panjang minimal hasil (bawaan 20 huruf) |
| `kriteria.konfirmasi` | kartu konfirmasi muncul; sebelum pengguna setuju tidak ada otomasi menyala |
| `kriteria.saluranTakTersambung` | hasil tidak boleh mengaku terkirim; harus menyebut saluran belum tersambung |

Kriteria yang selalu berlaku: hasil sampai ke pengguna, Catatan tersimpan, tidak ada nilai rusak (NaN, undefined), tidak ada kata terlarang di teks layar buatan sistem.
Tanpa regex bergaris miring di berkas data (jebakan escape).
