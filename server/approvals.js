// Satu-satunya modul yang membuat, memutuskan, dan mengadaluarsakan kartu persetujuan (P2).
// Dipakai engine (review dan kebijakan), n8n.js (otomasi), browser.js (aksi browser), dan governor (aturan "perlu manusia").
// Aturan: hanya modul ini yang boleh memanggil store.upsert('approvals', ...); ada tes yang menjaganya.
//
// Bentuk kartu (medan lama dipertahankan agar layar yang ada tidak berubah):
//   id, kind ('review' | 'policy' | 'automation' | 'browser_action'), title (kalimat awam), summary, preview (pratinjau singkat),
//   status ('pending' | 'approved' | 'rejected'), requesterId, approverId (siapa yang boleh memutuskan), createdAt, expiresAt (null = tidak kedaluwarsa),
//   taskId, decidedBy, decidedAt, feedback, + medan khusus jenis (evidence/gaps/expected/unverified, automationId/automationAction).
import * as store from './penyimpanan/store.js';

const db = () => store.get();

export const KINDS = ['review', 'policy', 'automation', 'browser_action'];
/** jenis yang TIDAK PERNAH disetujui otomatis: berdampak ke luar atau harus dilihat manusia */
export const NEVER_AUTO = new Set(['review', 'automation', 'browser_action']);

/** Pekerjaan tingkat atas yang menyentuh uang, publikasi, kontrak, atau HR selalu menunggu manusia (dulu regex di governor.js). */
export const HUMAN_POLICY = /\b(publikasi(kan)?|publish|tayangkan|kirim ke (klien|pelanggan|publik)|tanda ?tangan|kontrak final|transfer dana|pembayaran|bayar|offer letter|phk|pecat|rilis ke produksi)\b/i;
export function needsHuman(t, requested) {
  if (t.parentId) return false;   // hanya pekerjaan tingkat atas ke manusia; subtugas ditinjau orkestrator di atasnya
  if (t.kind === 'goal') return true;
  return !!requested || HUMAN_POLICY.test(`${t.title} ${t.description}`);
}

const clip = (s, n) => String(s ?? '').slice(0, n);

/** Buat kartu menunggu keputusan. `preview` boleh teks atau daftar baris. */
export function create({ kind = 'policy', title, summary = '', preview, requesterId, approverId = 'owner', taskId, expiresAt = null, ...extra }) {
  if (!KINDS.includes(kind)) throw new Error(`Jenis persetujuan tidak dikenal: ${kind}`);
  const pv = Array.isArray(preview) ? preview.map((x) => `• ${x}`).join('\n') : preview;
  const card = {
    id: store.uid('ap'), kind, title: clip(title, 200), summary, preview: clip(pv ?? summary, 600),
    requesterId, approverId, taskId, expiresAt: expiresAt || null, status: 'pending', createdAt: Date.now(), ...extra,
  };
  return store.upsert('approvals', card);
}

/** Catatan persetujuan otomatis (bukan manusia). Ditolak untuk jenis yang tidak boleh disetujui otomatis. */
export function recordAuto({ kind = 'policy', title, summary = '', requesterId, approverId = 'owner', taskId, feedback = 'Disetujui otomatis sesuai pengaturan perusahaan.' }) {
  if (NEVER_AUTO.has(kind)) throw new Error(`Kartu jenis ${kind} tidak boleh disetujui otomatis.`);
  const now = Date.now();
  return store.upsert('approvals', { id: store.uid('ap'), kind, title: clip(title, 200), summary, preview: clip(summary, 600), requesterId, approverId, taskId, expiresAt: null, status: 'approved', decidedBy: 'system-auto', createdAt: now, decidedAt: now, feedback });
}

export const get = (id) => db().approvals.find((x) => x.id === id);
export const pending = (kind) => db().approvals.filter((a) => a.status === 'pending' && (!kind || a.kind === kind));
/** kartu yang boleh disetujui otomatis oleh pengaturan autoApprove */
/** "Serahkan penuh" (settings.permission === 'full', hanya pengelola ruang kerja): kartu review ikut disetujui otomatis; otomasi dan aksi browser TETAP hanya oleh manusia */
export const fullTrust = () => db().settings.permission === 'full';
const bolehOtomatis = (kind) => !NEVER_AUTO.has(kind) || (kind === 'review' && fullTrust());
export const autoApprovable = (a) => a.status === 'pending' && bolehOtomatis(a.kind);


/** Putuskan kartu. Mengembalikan kartu; efek lanjutan (selesaikan tugas, nyalakan otomasi, buka aksi) tetap di pemanggil. */
export function decide(id, { decision, feedback = '', userId = 'owner' }) {
  const a = get(id);
  if (!a || a.status !== 'pending') throw new Error('Approval tidak ditemukan atau sudah diputuskan');
  if (userId === 'system-auto' && !bolehOtomatis(a.kind)) throw new Error(`Kartu jenis ${a.kind} hanya boleh diputuskan manusia.`);
  Object.assign(a, { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: userId, decidedAt: Date.now(), feedback });
  return store.upsert('approvals', a);
}

/** Tolak karena waktu habis. Tidak berbuat apa-apa bila kartu sudah diputuskan. */
export function expire(id, feedback = 'Kedaluwarsa: Owner tidak memutuskan tepat waktu.') {
  const a = get(id);
  if (!a || a.status !== 'pending') return a || null;
  Object.assign(a, { status: 'rejected', decidedBy: 'system-expired', decidedAt: Date.now(), feedback, expired: true });
  return store.upsert('approvals', a);
}

/** Tutup semua kartu yang lewat batas waktunya (dipanggil periodik oleh mesin). Mengembalikan kartu yang ditutup. */
export function sweep(now = Date.now()) {
  return db().approvals.filter((a) => a.status === 'pending' && a.expiresAt && a.expiresAt < now).map((a) => expire(a.id));
}
