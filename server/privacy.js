// Privasi (P3): ekspor data pribadi, hapus akun/ruang kerja, retensi pesan dan kejadian, serta migrasi rahasia ke amplop berversi.
// Tidak mengubah data apa pun kecuali diminta (rute hapus akun, skrip --apply, atau retensi yang diaktifkan lewat env).
// Catatan hukum: dokumen ini tidak menyatakan kepatuhan hukum apa pun. Soal data anak dan persetujuan orang tua, lihat docs/KEAMANAN-P3.md (butuh tinjauan hukum Owner).
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as auth from './auth.js';
import * as secure from './secure.js';
import * as brain from './brain.js';
import * as otomasi from './n8n.js';

const dataDir = () => process.env.DATA_DIR || path.resolve('data');
const trashDir = () => path.join(dataDir(), 'trash');
const TRASH_DAYS = () => Number(process.env.PRIVACY_TRASH_DAYS) || 7;
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
const safeId = (id) => /^[\w-]{3,40}$/.test(String(id));
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* sudah hilang */ } };

/** Satu kali saat boot, SEBELUM ruang kerja dimuat: ruang kerja yang ditandai terhapus dipindah ke data/trash (dihapus permanen setelah PRIVACY_TRASH_DAYS hari). */
export function purgeAtBoot() {
  let moved = 0;
  try {
    const A = JSON.parse(fs.readFileSync(path.join(dataDir(), 'auth.json'), 'utf8'));
    for (const d of A.deleted || []) {
      if (!safeId(d.id) || d.id === 'main') continue;
      const src = path.join(dataDir(), 'ws', d.id);
      if (fs.existsSync(src)) { fs.mkdirSync(trashDir(), { recursive: true }); fs.renameSync(src, path.join(trashDir(), `${d.id}-${d.at || Date.now()}`)); moved++; }
      rmrf(path.join(dataDir(), 'staff-out', d.id));
    }
  } catch { /* belum ada auth.json: tidak ada yang dihapus */ }
  try { for (const f of fs.readdirSync(trashDir())) { const t = Number(f.split('-').pop()); if (t && Date.now() - t > TRASH_DAYS() * 864e5) rmrf(path.join(trashDir(), f)); } } catch { /* tidak ada tempat sampah */ }
  return moved;
}
/** Setelah auth.load(): hapus penanda "terhapus" yang datanya sudah dipindahkan. */
export function afterAuthLoad() { for (const d of auth.pendingDeletedWs()) if (!fs.existsSync(path.join(dataDir(), 'ws', d.id))) auth.clearDeletedWs(d.id); }

// ── ekspor
const redact = (e) => ({ id: e.id, name: e.name, email: e.email, title: e.title, divisionId: e.divisionId, type: e.type });
/** Data pribadi satu akun. Pemilik ruang kerja pribadinya mendapat seluruh data ruang kerja itu (tanpa kunci rahasia); anggota di ruang kerja orang lain hanya mendapat miliknya sendiri. */
export function exportMine(me, member) {
  const out = { dibuat: new Date().toISOString(), catatan: 'Berkas ini memuat data pribadimu. Token dan kunci rahasia tidak ikut diekspor.', ...auth.exportAccount(me), data: {} };
  for (const w of auth.myWorkspaces(me)) {
    if (!store.exists(w.id)) continue;
    const m = auth.memberOf(me, w.id), mine = m?.employeeId;
    out.data[w.id] = store.run(w.id, () => {
      const d = store.get();
      if (m?.role === 'owner' && w.id === me.personalWs) return { jenis: 'seluruh ruang kerja milikmu', ...d, settings: store.exportSettings(), notes: d.notes.filter((n) => brain.canRead(n, { employeeId: mine })) };
      return {
        jenis: 'hanya milikmu di ruang kerja orang lain',
        karyawan: d.employees.filter((e) => e.id === mine).map(redact),
        pesan: d.messages.filter((x) => x.authorId === mine).map((x) => ({ id: x.id, channelId: x.channelId, t: x.t, text: x.text })),
        catatanPribadi: d.notes.filter((n) => n.authorId === mine).map((n) => ({ id: n.id, title: n.title, folder: n.folder, content: n.content })),
      };
    });
  }
  return out;
}

// ── hapus akun
/** Hapus akun ini sepenuhnya. Wajib mengirim { konfirmasi: "HAPUS AKUN SAYA" }. Ruang kerja pribadinya dinonaktifkan seketika dan datanya dipindah ke tempat sampah saat server dimulai ulang. */
export async function deleteMine(me, body = {}) {
  if (String(body.konfirmasi || '') !== 'HAPUS AKUN SAYA') throw bad('Kirim konfirmasi "HAPUS AKUN SAYA" untuk menghapus akun. Ini tidak bisa dibatalkan.');
  const r = await auth.deleteAccount(me);   // melempar 403 untuk Owner kantor utama
  const done = { ruangKerjaDihapus: [], keanggotaanDibersihkan: 0, otomasiDihapus: 0 };
  for (const ws of r.ownedWs) {
    if (!store.exists(ws)) continue;
    done.otomasiDihapus += await otomasi.purgeWorkspace(ws).catch(() => 0);
    store.run(ws, () => {   // berhenti memakai anggaran AI dan menerima pekerjaan sampai datanya benar-benar dibuang saat restart
      const s = store.get().settings; Object.assign(s, { deleted: true, deletedAt: Date.now(), dailyBudgetUSD: 0, apiKey: '', groqApiKey: '', mcpServers: [], googleAppsScript: { url: '', secret: '', enabled: false }, provider: 'sim' });
      store.saveNow();
    });
    done.ruangKerjaDihapus.push(ws);
  }
  for (const { ws, employeeId } of r.memberWs) {
    if (!store.exists(ws)) continue;
    store.run(ws, () => {
      const d = store.get(), e = d.employees.find((x) => x.id === employeeId && x.type === 'human');
      if (e) { Object.assign(e, { name: 'Mantan anggota', email: '', persona: '', about: '', avatar: 'human', status: 'offline', statusText: 'Sudah keluar' }); store.upsert('employees', e); }
      for (const n of d.notes.filter((x) => x.visibility === 'private' && x.authorId === employeeId)) store.remove('notes', n.id);
    });
    done.keanggotaanDibersihkan++;
  }
  return { ok: true, ...done, catatan: 'Akunmu sudah dihapus dan sesi ditutup. Data ruang kerja pribadimu dibuang permanen setelah masa tunggu di tempat sampah server.' };
}

// ── retensi
export const retention = () => ({ eventDays: Number(process.env.RETENTION_EVENT_DAYS ?? 90), messageDays: Number(process.env.RETENTION_MESSAGE_DAYS ?? 365), applyMain: process.env.RETENTION_APPLY_MAIN === '1' });
/** Buang kejadian dan pesan yang lebih tua dari batas. Kantor utama (data pemilik platform) tidak disentuh kecuali RETENTION_APPLY_MAIN=1. 0 = tidak dibatasi. */
export function prune({ now = Date.now() } = {}) {
  const c = retention(), out = { events: 0, messages: 0 };
  for (const ws of store.ids()) {
    if (ws === 'main' && !c.applyMain) continue;
    store.runQuiet(ws, () => {   // runQuiet: pemangkasan tidak membuat ruang kerja tidur terlihat aktif
      const d = store.get(); let changed = false;
      if (c.eventDays > 0) { const cut = now - c.eventDays * 864e5, n = d.events.length; d.events = d.events.filter((e) => (e.t || 0) >= cut); out.events += n - d.events.length; changed ||= n !== d.events.length; }
      if (c.messageDays > 0) { const cut = now - c.messageDays * 864e5, n = d.messages.length; d.messages = d.messages.filter((m) => (m.t || 0) >= cut); out.messages += n - d.messages.length; changed ||= n !== d.messages.length; }
      if (changed) store.save();
    });
  }
  return out;
}
export function startRetention() { const t = setInterval(() => { try { prune(); } catch (err) { console.warn('[privasi] retensi gagal:', err.message); } }, 6 * 3600e3); t.unref?.(); return t; }

// ── rahasia: bungkus ulang kunci AI per ruang kerja dan token Drive dengan kunci terbaru
const KEYS = ['apiKey', 'groqApiKey'];
/** apply=false hanya menghitung. Tidak pernah mencetak nilai rahasia. */
export function migrateSecrets({ apply = false } = {}) {
  const out = { ruangKerja: 0, kunciAI: 0, tokenDrive: 0 };
  for (const ws of store.ids()) {
    store.run(ws, () => {
      const s = store.get().settings; let n = 0;
      for (const k of KEYS) if (s[k] && !String(s[k]).startsWith('••••') && secure.needsReseal(s[k])) { n++; if (apply) s[k] = secure.reseal(s[k], 'ws-secret'); }
      if (n) { out.ruangKerja++; out.kunciAI += n; if (apply) store.saveNow(); }
    });
  }
  if (apply) out.tokenDrive = auth.rotateTokens();
  return out;
}
