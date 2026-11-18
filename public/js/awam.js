// Bahasa dan pembantu bersama untuk layar pengguna biasa (P4). Tanpa jargon, tanpa emoji sebagai ikon.
// Kamus peladen: server/kamus.js. Tambahan khusus layar depan ada di KATA_TAMBAHAN di bawah dan dipakai test/ui-awam.test.js.

/** padanan awam untuk kata terlarang yang bisa menyelinap lewat teks dari peladen */
const PADANAN = [
  [/\bsecond\s+brain\b/gi, 'Catatan'], [/\bknowledge\s+base\b/gi, 'catatan'], [/\bbrain\b/gi, 'catatan'],
  [/\bworkspace\b/gi, 'ruang kerja'], [/\borkestrator\b/gi, 'asisten'], [/\borchestrator\b/gi, 'asisten'],
  [/\bapprovals?\b/gi, 'konfirmasi'], [/\bpersetujuan\b/gi, 'konfirmasi'],
  [/\bgoals?\b/gi, 'pekerjaan'], [/\btasks?\b/gi, 'pekerjaan'],
  [/\bagen\b/gi, 'pembantu'], [/\bagents?\b/gi, 'pembantu'],
  [/\bmcp\b/gi, 'sambungan'], [/\btools?\b/gi, 'kemampuan'], [/\bcapabilit(?:y|ies)\b/gi, 'kemampuan'],
  [/\btokens?\b/gi, 'jatah'], [/\bmodel\b/gi, 'otak'], [/\bprompt\b/gi, 'arahan'],
  [/\berror\b/gi, 'kendala'], [/\bapi\b/gi, 'sambungan'], [/\bjson\b/gi, 'berkas'],
  [/\bdeliverables?\b/gi, 'hasil'], [/\bsub-?tugas\b/gi, 'langkah'], [/\bsub-?tasks?\b/gi, 'langkah'], [/\bworkflow\b/gi, 'alur kerja'], [/\bn8n\b/gi, 'mesin otomatis'],
];
export const awam = (text) => PADANAN.reduce((s, [re, to]) => s.replace(re, to), String(text ?? ''));

const TEKNIS = /(error|exception|stack|undefined|null|npm|restart|endpoint|localhost|\bat\s+\S+:\d+|ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|unexpected token|json|<\/?[a-z])/i;
/** ubah galat mentah (kode HTTP atau pesan peladen) menjadi kalimat sehari-hari + saran */
export function ramah(raw, status) {
  const msg = String(raw ?? '').trim();
  const s = Number(status) || 0;
  if (s === 401) return 'Sesimu sudah berakhir. Silakan masuk lagi.';
  if (s === 403) return 'Bagian ini hanya bisa dibuka oleh pemilik ruang kerja.';
  if (s === 404) return 'Yang kamu cari belum ketemu. Coba kembali ke Beranda.';
  if (s === 408 || s === 429) return 'Lagi ramai sebentar. Tunggu sebentar lalu coba lagi.';
  if (s >= 500) return 'Ada yang belum berhasil di pihak kami. Coba lagi sebentar ya.';
  if (!s && /failed to fetch|networkerror|load failed|network request/i.test(msg)) return 'Sambungan internet sepertinya terputus. Periksa sambunganmu lalu coba lagi.';
  if (msg && msg.length <= 180 && !TEKNIS.test(msg) && /\s/.test(msg)) return awam(msg);
  return 'Ada yang belum berhasil. Coba lagi sebentar, atau minta Pemandu membantu.';
}

/** status karyawan dalam kata orang. Tidak ada status mentah. */
export function statusOrang(e, tasks = []) {
  const open = tasks.filter((t) => t.assigneeId === e.id && !['done', 'cancelled'].includes(t.status));
  if (open.some((t) => t.status === 'blocked' || (t.failures || 0) > 0)) return { id: 'kendala', kata: 'Ada kendala' };
  if (e.status === 'working' || e.status === 'meeting' || e.status === 'chatting' || open.some((t) => t.status === 'in_progress')) return { id: 'bekerja', kata: 'Sedang bekerja' };
  if (e.status === 'offline') return { id: 'tidak', kata: 'Sedang tidak ada' };
  const baru = tasks.find((t) => t.assigneeId === e.id && t.status === 'done' && Date.now() - (t.completedAt || 0) < 15 * 60000);
  if (baru) return { id: 'selesai', kata: 'Baru selesai' };
  return { id: 'menunggu', kata: 'Menunggu pekerjaan' };
}

/** kelompok pekerjaan untuk Hasil Saya */
export function kelompokTugas(t, pendingTaskIds = new Set()) {
  if (t.status === 'done') return 'selesai';
  if (t.status === 'cancelled') return null;
  if (t.status === 'review' || t.status === 'blocked' || (t.failures || 0) > 0 || pendingTaskIds.has(t.id)) return 'perlu';
  return 'jalan';
}
export const STATUS_KARTU = { perlu: 'Perlu kamu', jalan: 'Sedang dikerjakan', selesai: 'Selesai' };
export const KATA_STATUS_TUGAS = { todo: 'Antre', in_progress: 'Sedang dikerjakan', waiting: 'Menunggu', review: 'Menunggu pendapatmu', blocked: 'Ada kendala', done: 'Selesai', cancelled: 'Dibatalkan' };

/** peran dalam bahasa awam, dari medan baru P1 bila ada, jika tidak dari bendera lama */
export function peranOrang(e) {
  if (e.role === 'pa' || e.isPA) return 'Asisten pribadi';
  if (e.role === 'master' || e.isMaster) return 'Asisten utama';
  if (e.role === 'manager' || e.isLead) return 'Penanggung jawab divisi';
  return awam(e.title || 'Pembantu');
}

/** unduh teks sebagai berkas dari peramban */
export function unduh(nama, isi, jenis = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([isi], { type: `${jenis};charset=utf-8` }));
  a.download = String(nama || 'hasil.txt').replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** siapa yang boleh membuka jalur pengelola (#admin): hanya pengelola PLATFORM, bukan sekadar pemilik ruang kerja.
 *  Peladen yang memutuskan dan menandai /api/state dengan platformAdmin; tampilan ini hanya mengikuti tanda itu (peladen tetap memeriksa tiap rute). */
export function bisaKelola(data) {
  return data?.platformAdmin === true;
}

/** keadaan seragam: kosong, memuat, galat */
export const kosong = (judul, isi = '', tombol = '') => `<div class="state empty-state" role="status"><b>${judul}</b>${isi ? `<p>${isi}</p>` : ''}${tombol}</div>`;
export const memuat = (teks = 'Sebentar ya, lagi disiapkan…') => `<div class="state loading-state" role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span><span>${teks}</span></div>`;
export const galat = (teks, tombol = '') => `<div class="state error-state" role="alert"><b>Ada yang belum berhasil</b><p>${teks}</p>${tombol}</div>`;
