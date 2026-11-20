// Pemetaan status pekerjaan staf (workflow n8n / catatan jalan) → lima nilai yang dimengerti ruang 3D.
// Tertutup: apa pun masukannya, hasilnya salah satu dari lima nilai. Tidak menyentuh geometri atau animasi.
export const STATUSES = ['working', 'meeting', 'chatting', 'idle', 'offline'];

const MAP = {
  // catatan jalan staf (server/staff/runner.js)
  jalan: 'working', menunggu: 'working', butuh_izin: 'chatting', selesai: 'idle', gagal: 'idle', ditolak: 'idle',
  // eksekusi n8n
  new: 'working', running: 'working', waiting: 'working', success: 'idle', error: 'idle', crashed: 'idle', canceled: 'idle', cancelled: 'idle',
  // istilah lain yang wajar
  queued: 'working', started: 'working', paused: 'chatting', approval: 'chatting', meeting: 'meeting', chatting: 'chatting', done: 'idle', failed: 'idle',
  working: 'working', idle: 'idle', offline: 'offline',
};

/** nilai apa pun → salah satu dari lima status 3D (tidak dikenal = idle) */
export function mapStatus(s) {
  const k = String(s ?? '').trim().toLowerCase();
  return MAP[k] || 'idle';
}
export const isStatus3D = (s) => STATUSES.includes(s);
