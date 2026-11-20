// Hapus banyak hasil sekaligus (Hasil Saya, mode "Pilih"): aman, per item, dan hanya di ruang kerja yang sedang aktif.
// Aturan: hanya pekerjaan tingkat atas yang selesai, tertahan, atau dibatalkan boleh dihapus; yang masih berjalan, antre, atau menunggu
// persetujuan DILEWATI (dengan alasan). Anggota biasa hanya boleh menghapus miliknya; Owner dan Admin boleh semuanya.
// Id dari ruang kerja lain tidak ada di penyimpanan ini, jadi otomatis ditolak sebagai "tidak ditemukan".
import * as store from './penyimpanan/store.js';

const db = () => store.get();
export const BOLEH_DIHAPUS = new Set(['done', 'blocked', 'cancelled']);
export const MAKS = 200;

/** @returns {{ dihapus: string[], dilewati: { id: string, alasan: string }[] }} */
export function hapusBanyak(ids, { aktor, bolehSemua = false } = {}) {
  const daftar = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && x.length < 80))].slice(0, MAKS);
  const dihapus = [], dilewati = [];
  const pending = new Set(db().approvals.filter((a) => a.status === 'pending').map((a) => a.taskId));
  for (const id of daftar) {
    const t = db().tasks.find((x) => x.id === id);
    if (!t) { dilewati.push({ id, alasan: 'tidak ditemukan' }); continue; }
    if (t.parentId) { dilewati.push({ id, alasan: 'bagian dari pekerjaan lain' }); continue; }
    if (!bolehSemua && t.createdBy !== aktor) { dilewati.push({ id, alasan: 'bukan milikmu' }); continue; }
    if (pending.has(t.id) || [...db().tasks].some((c) => c.parentId === t.id && pending.has(c.id))) { dilewati.push({ id, alasan: 'menunggu persetujuan' }); continue; }
    if (!BOLEH_DIHAPUS.has(t.status)) { dilewati.push({ id, alasan: 'masih berjalan atau antre' }); continue; }
    const semua = new Set([t.id]);
    let tumbuh = true;
    while (tumbuh) { tumbuh = false; for (const c of db().tasks) if (c.parentId && semua.has(c.parentId) && !semua.has(c.id)) { semua.add(c.id); tumbuh = true; } }
    if ([...semua].some((x) => ['in_progress', 'review', 'waiting'].includes(db().tasks.find((c) => c.id === x)?.status))) { dilewati.push({ id, alasan: 'ada bagian yang masih berjalan' }); continue; }
    for (const x of semua) store.remove('tasks', x);
    for (const a of db().approvals.filter((a) => semua.has(a.taskId))) store.remove('approvals', a.id);
    dihapus.push(id);
  }
  return { dihapus, dilewati };
}
