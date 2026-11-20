# Fundamental RAIVERSE

Dokumen hidup. Sumber utama diagram ada di berkas ini (blok `mermaid`). Setelah mengubahnya jalankan `node scripts/sync-fundamental.mjs` agar `index.html` ikut diperbarui. Terakhir diperbarui: 2026-11-19.

## 1. Tujuan satu kalimat
Platform "perusahaan AI" yang **sangat sederhana di depan** (ngobrol dan pilih tombol, untuk semua orang) tetapi **sangat kuat di belakang** (agen dan staf yang benar-benar mengerjakan, menghasilkan berkas dan data).

## 2. Prinsip yang sudah diputuskan
1. Satu antarmuka untuk semua orang. Tidak ada mode (bukan Mode Anak, Lengkap, Mahir).
2. Depan dipandu pilihan tombol seperti ChatGPT: ngobrol, AI mengerjakan, di akhir ada saran atau konfirmasi berupa tombol.
3. Bagian depan (kantor 3D `#office`, suara, UI) **dibekukan** karena sudah bagus. Perubahan sekarang ada di backend.
4. Hal teknis (kunci AI, model, MCP, kuota, data, keamanan) hanya di **konsol admin** untuk pengelola, bukan untuk pengguna.
5. Hierarki: Owner → asisten pribadi + master → manajer divisi (22) → staf.
6. **Staf = orang + kemampuan.** 238 staf tetap ada sebagai karakter 3D, tetapi otaknya dipakai bersama lewat sekitar 30 kemampuan inti. Staf = kemampuan inti + keahlian khusus.
7. Eksekusi staf berjalan **native** di RAIVERSE, bukan 221 workflow n8n. n8n hanya untuk jadwal dan pemicu luar.
8. Saluran chat luar: **Telegram dan Discord** (bukan WhatsApp), setiap pengguna di sesinya sendiri.
9. Hasil tidak boleh dipalsukan: bila sesuatu belum tersambung (Sheets, email), katakan jujur.
10. Visual lock dicabut sebagai gerbang tes. Pengaman 3D tetap: `node docs/mascot-v4-2/verify-v42.mjs`.

## 3. Peta lapisan
Warna: hijau = jalan, kuning = setengah atau baru, abu-abu = ada tapi mati.

```mermaid
%% id: lapisan
flowchart TB
  subgraph DEPAN["Depan (beku)"]
    O3D["Kantor 3D #office"]:::ok
    SUARA["Suara agen"]:::ok
    BER["Beranda chat (Pemandu)"]:::half
    HAS["Hasil Saya, Tim Saya, Catatan"]:::half
    ADM["Konsol admin #admin"]:::half
  end
  subgraph OTAK["Backend / otak (sedang dirapikan)"]
    PEM["Pemandu: paham, tanya, saran"]:::half
    ENG["Mesin kerja: asisten + master, manajer, staf"]:::ok
    GUARD["Penjaga: keamanan, kuota, persetujuan"]:::ok
    MEM["Ingatan: catatan, skill, memori"]:::ok
    DATA["Data: JSON (SQLite mati)"]:::ok
  end
  subgraph LUAR["Dunia luar"]
    GROQ["Groq (AI)"]:::ok
    TG["Telegram dan Discord"]:::half
    N8N["n8n: 221 staf tersimpan, 0 aktif"]:::off
    WEB["Browser agen dan web"]:::half
  end
  DEPAN --> OTAK --> LUAR
  classDef ok fill:#E1F5EE,stroke:#0F6E56,color:#085041
  classDef half fill:#FAEEDA,stroke:#854F0B,color:#633806
  classDef off fill:#F1EFE8,stroke:#5F5E5A,color:#444441
```

## 4. Alur satu permintaan
```mermaid
%% id: alur
flowchart LR
  U["Pengguna: ngobrol (web atau Telegram)"] --> P["Pemandu: paham, tanya sedikit"]
  P --> M["Master: pilih divisi"]
  M --> MG["Manajer divisi: pilih kemampuan"]
  MG --> S["Staf: kemampuan + keahlian"]
  S --> H["Hasil: teks, berkas, data"]
  H --> C["Chat: hasil + 2-4 tombol saran"]
  C --> N["Catatan otomatis"]
  H -. aksi berdampak .-> K["Konfirmasi: pratinjau, Ya atau Batal"]
  K --> H
```

## 5. Hierarki dan staf
```mermaid
%% id: hierarki
flowchart TB
  OW["Owner / pengguna"] --> PA["Asisten pribadi"]
  OW --> MA["Master orkestrator"]
  MA --> MG["Manajer divisi (22)"]
  MG --> ST["Staf (238) = orang 3D"]
  ST --> KM["Kemampuan inti (sekitar 30)"]
  ST --> KH["Keahlian khusus staf"]
```

## 6. Rujukan peta detail
- Isi website (dari kode): [`../PETA-WEBSITE.md`](../PETA-WEBSITE.md)
- Backend: [`../PETA-BACKEND.md`](../PETA-BACKEND.md) (dibuat sesi perapian)
- Otak AI: [`../PETA-OTAK.md`](../PETA-OTAK.md) (dibuat sesi perapian)
- Rencana dan keputusan: [`../AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md`](../AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md)
- Staf native: [`../STAF-NATIVE.md`](../STAF-NATIVE.md)
