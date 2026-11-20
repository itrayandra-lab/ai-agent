// KONTRAK EKSEKUSI: tidak ada pekerjaan staf yang boleh berstatus "selesai" tanpa BUKTI.
// Bukti = berkas yang isinya sah, atau data yang sah, atau (untuk staf yang memang hanya menulis teks) teks yang utuh, atau konfirmasi pengguna.
// Urutan bila keluaran tidak sah: (1) jawaban AI yang rusak diulang SEKALI (di native.js), (2) jatuh ke versi aturan tanpa AI (di runner.js),
// (3) gagal dengan pesan awam dan dua jalan keluar. Tidak ada klaim sukses palsu. Dokumen: docs/UJI-NYATA.md bagian "Kontrak eksekusi".
// Modul ini murni (tanpa efek samping) agar mudah diuji; hanya `runBukti` membaca catatan jalan.
import { findRun } from './data.js';

export const ATURAN = [
  'K1 selesai hanya bila ada bukti: berkas sah, data sah, atau teks utuh (staf yang memang hanya menulis teks)',
  'K2 berkas wajib sesuai jenisnya (CSV punya judul dan isi, JSON bisa dibaca, HTML punya tag, teks tidak kosong)',
  'K3 tidak ada nilai rusak (NaN, undefined, [object Object], Infinity) di ringkasan, teks, berkas, atau data',
  'K4 tulisan "ditulis AI" hanya boleh muncul bila AI benar-benar menjawab dengan sah',
  'K5 jawaban AI tidak sah diulang sekali, lalu jatuh ke versi aturan; bila versi aturan pun tidak sah, pekerjaan gagal dengan pesan awam dan dua jalan keluar',
  'K6 pekerjaan yang butuh izin tidak pernah selesai sebelum pengguna menyetujui',
  'K7 saluran yang belum tersambung gagal jujur; tidak pernah berpura-pura terkirim',
  'K8 batas waktu mesin native menghasilkan "gagal", bukan "menunggu" yang tidak pernah selesai',
];

const BROKEN = /\b(NaN|undefined|Infinity|null)\b|\[object Object\]/;   // nilai bocor dari hitungan gagal; kata "null" tidak ada di bahasa Indonesia
const nonEmpty = (x) => typeof x === 'string' && x.trim().length > 0;

/** Periksa satu berkas menurut jenisnya. Mengembalikan '' bila sah, selain itu alasan singkat berbahasa awam. */
export function periksaBerkas(f) {
  if (!f || !nonEmpty(f.isi)) return `berkas "${f?.nama || '?'}" kosong`;
  const isi = String(f.isi);
  if (f.jenis === 'json') { try { JSON.parse(isi); } catch { return `berkas "${f.nama}" bukan data yang bisa dibaca`; } }
  else if (f.jenis === 'csv') {
    const rows = isi.split(/\r?\n/).filter((l) => l.trim());
    if (rows.length < 1) return `berkas "${f.nama}" tidak punya judul kolom`;   // hanya judul = temuan kosong yang jujur (mis. halaman tanpa harga); tetap sah
  } else if (f.jenis === 'html') { if (!/<[a-z!][^>]*>/i.test(isi)) return `berkas "${f.nama}" bukan halaman yang utuh`; }
  else if (isi.trim().length < 10) return `berkas "${f.nama}" terlalu pendek`;
  if (f.jenis !== 'json' && BROKEN.test(isi)) return `berkas "${f.nama}" memuat nilai rusak`;
  return '';
}

/** Data sah = objek/larik yang bisa diserialisasi, tidak kosong, tanpa nilai rusak. */
export function periksaData(d) {
  if (d === null || d === undefined) return 'data kosong';
  let s; try { s = JSON.stringify(d); } catch { return 'data tidak bisa dibaca'; }
  if (!s || s === '{}' || s === '[]') return 'data kosong';
  if (d && typeof d === 'object' && !Array.isArray(d) && Object.values(d).some((v) => v === null)) return 'ada angka yang gagal dihitung';
  if (/NaN|undefined|Infinity|\[object Object\]/.test(s)) return 'data memuat nilai rusak';
  return '';
}

/**
 * Periksa hasil satu jalan terhadap kontrak. `out` = { ringkas, teks, files|berkas, data }, `spec` = spesifikasi, `meta` = { pakaiAI }.
 * Mengembalikan { ok, bukti[], masalah[] }. `bukti` berisi jenis bukti yang SAH (disimpan di catatan jalan).
 */
export function periksaHasil(spec, out, meta = {}) {
  const masalah = [], bukti = [];
  const files = Array.isArray(out?.files) ? out.files : Array.isArray(out?.berkas) ? out.berkas : [];
  const teks = String(out?.teks ?? ''), ringkas = String(out?.ringkas ?? '');
  if (!nonEmpty(ringkas)) masalah.push('ringkasan hasil kosong');
  if (BROKEN.test(ringkas) || BROKEN.test(teks)) masalah.push('teks hasil memuat nilai rusak (angka gagal dihitung)');
  const declared = (spec?.output?.berkas || []).length > 0;
  let fileOk = 0;
  for (const f of files) { const m = periksaBerkas(f); if (m) masalah.push(m); else { fileOk++; bukti.push({ jenis: 'berkas', nama: f.nama, bytes: Buffer.byteLength(String(f.isi)) }); } }
  if (declared && !files.length) masalah.push('berkas yang dijanjikan tidak dibuat');
  const dm = out?.data == null ? '' : periksaData(out.data);
  if (out?.data != null && dm && dm !== 'data kosong') masalah.push(dm);
  else if (out?.data != null && !dm) bukti.push({ jenis: 'data', kunci: Object.keys(out.data || {}).slice(0, 8) });
  if (teks.trim().length >= 3) bukti.push({ jenis: 'teks', panjang: teks.length });
  // K4: klaim ditulis AI harus benar
  if (/ditulis AI/i.test(teks) && meta.pakaiAI !== true) masalah.push('hasil mengaku ditulis AI padahal AI tidak menjawab');
  // K1: bukti utama. Staf berkas/data harus punya bukti dari berkas/data; staf teks saja cukup dengan teks utuh.
  const utama = bukti.filter((b) => b.jenis !== 'teks').length;
  if (declared || spec?.output?.data) { if (!utama) masalah.push('tidak ada berkas atau data yang sah sebagai bukti'); }
  else if (!utama && !bukti.some((b) => b.jenis === 'teks')) masalah.push('tidak ada isi yang bisa dijadikan bukti');
  return { ok: masalah.length === 0, bukti, masalah };
}

/** Pesan awam bila pekerjaan gagal, selalu dengan dua jalan keluar. Tidak memuat istilah teknis. */
export function pesanGagal(namaKerja, masalah = []) {
  const alasan = masalah.length ? masalah.slice(0, 2).join('; ') : 'hasilnya belum utuh';
  return {
    galat: `"${namaKerja}" belum bisa kuselesaikan dengan benar: ${alasan}. Aku tidak mau menyerahkan hasil yang setengah jadi.`,
    jalanKeluar: [
      { id: 'ulang', label: 'Coba lagi', hint: 'Jalankan sekali lagi dengan isian yang sama.' },
      { id: 'ubah', label: 'Ubah isiannya atau pilih pekerjaan lain', hint: 'Periksa isiannya, atau minta pembantu lain mengerjakannya.' },
    ],
  };
}

const RUN_ID = /\brun-[0-9a-f]{5,}\b/g;
export const runIdsDari = (text) => [...new Set(String(text || '').match(RUN_ID) || [])];

/** Apakah id jalan ini benar-benar ada, berstatus selesai, dan membawa bukti? Dipakai engine untuk menolak klaim palsu. */
export function runBukti(ws, id) {
  const r = findRun(ws, id);
  return !!r && r.status === 'selesai' && Array.isArray(r.bukti) && r.bukti.length > 0;
}
