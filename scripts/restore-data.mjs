// Pemulihan data (P0) dari folder cadangan buatan backup-data.mjs.
// Pemakaian: node scripts/restore-data.mjs <folder-cadangan> --confirm [--data folder]
// Tanpa --confirm tidak ada yang ditimpa (hanya memeriksa cadangan). Sebelum menimpa, keadaan sekarang dicadangkan otomatis (label pra-pulih).
// Hentikan server dulu: server yang berjalan akan menulis ulang db.json dari memorinya.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, makeBackup, dataFiles } from './backup-data.mjs';

/** periksa cadangan: manifes ada, tiap berkas ada dengan ukuran dan hash cocok. Mengembalikan daftar masalah */
export function verifyBackup(dir) {
  const problems = [];
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) return ['manifest.json tidak ada'];
  let m;
  try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch { return ['manifest.json rusak']; }
  if (!Array.isArray(m.files) || !m.files.length) return ['manifest kosong'];
  for (const f of m.files) {
    if (typeof f.path !== 'string' || f.path.includes('..') || path.isAbsolute(f.path)) { problems.push(`jalur tidak aman: ${f.path}`); continue; }
    const p = path.join(dir, f.path);
    if (!fs.existsSync(p)) { problems.push(`hilang: ${f.path}`); continue; }
    if (fs.statSync(p).size !== f.bytes) problems.push(`ukuran beda: ${f.path}`);
    else if (sha256(p) !== f.sha256) problems.push(`hash beda: ${f.path}`);
  }
  return problems;
}

export function restoreBackup({ backupDir, dataDir, confirm = false }) {
  backupDir = path.resolve(backupDir); dataDir = path.resolve(dataDir);
  const before = verifyBackup(backupDir);
  if (before.length) throw new Error(`Cadangan tidak sah: ${before.join('; ')}`);
  const m = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  if (confirm !== true) return { applied: false, files: m.files.length, note: 'Belum ada yang ditimpa. Tambahkan --confirm untuk memulihkan.' };
  let safety = null;
  if (dataFiles(dataDir).length) safety = makeBackup({ dataDir, label: 'pra-pulih' }).dir;
  for (const f of m.files) {
    const dst = path.join(dataDir, f.path), tmp = dst + '.restore-tmp';
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(backupDir, f.path), tmp);
    fs.renameSync(tmp, dst);
    if (dst.endsWith('.sqlite')) for (const x of ['-wal', '-shm']) fs.rmSync(dst + x, { force: true });   // sisa jurnal lama tidak boleh menempel pada berkas hasil pulih
  }
  const bad = m.files.filter((f) => sha256(path.join(dataDir, f.path)) !== f.sha256).map((f) => f.path);
  if (bad.length) throw new Error(`Verifikasi pulih GAGAL untuk: ${bad.join(', ')} (keadaan sebelumnya ada di ${safety})`);
  return { applied: true, files: m.files.length, verified: true, safety };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const backupDir = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--data');
  const dataDir = opt('--data') || process.env.DATA_DIR || 'data';
  if (!backupDir) { console.error('Pemakaian: node scripts/restore-data.mjs <folder-cadangan> --confirm [--data folder]'); process.exit(2); }
  try {
    const r = restoreBackup({ backupDir, dataDir, confirm: a.includes('--confirm') });
    if (!r.applied) { console.log(`Cadangan sah (${r.files} berkas). ${r.note}`); process.exit(3); }
    console.log(`Pulih ${r.files} berkas ke ${path.resolve(dataDir)}, hash terverifikasi.` + (r.safety ? ` Keadaan sebelumnya disimpan di ${r.safety}` : ''));
  } catch (e) { console.error('Gagal memulihkan:', e.message); process.exit(1); }
}
