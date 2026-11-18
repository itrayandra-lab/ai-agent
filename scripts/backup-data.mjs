// Cadangan data (P0). Menyalin db.json, ws/*/db.json, auth.json, otomasi.json ke <data>/backups/<cap-waktu>-<label>/ + manifest.json.
// Pemakaian: node scripts/backup-data.mjs [--label nama] [--data folder]
// Hanya hitungan dan hash yang dicetak: isi data dan rahasia tidak pernah ditampilkan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** daftar berkas data yang dicadangkan, relatif terhadap folder data */
export function dataFiles(dataDir) {
  const out = [];
  for (const f of ['db.json', 'auth.json', 'otomasi.json']) if (fs.existsSync(path.join(dataDir, f))) out.push(f);
  const ws = path.join(dataDir, 'ws');
  if (fs.existsSync(ws)) for (const id of fs.readdirSync(ws).sort()) { const rel = `ws/${id}/db.json`; if (fs.existsSync(path.join(dataDir, rel))) out.push(rel); }
  return out;
}

/** hitungan saja (karyawan, divisi) dari satu db.json */
function counts(file) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(d.employees)) return {};
    return { employees: d.employees.length, divisions: Array.isArray(d.divisions) ? d.divisions.length : 0, version: d.version ?? null };
  } catch { return { unreadable: true }; }
}

export function makeBackup({ dataDir, label = 'manual', now = new Date() } = {}) {
  dataDir = path.resolve(dataDir);
  const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'manual';
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const dir = path.join(dataDir, 'backups', `${stamp}-${safeLabel}`);
  if (fs.existsSync(dir)) throw new Error(`Folder cadangan sudah ada: ${dir}`);
  const files = dataFiles(dataDir);
  if (!files.length) throw new Error(`Tidak ada berkas data di ${dataDir}`);
  const entries = [];
  for (const rel of files) {
    const src = path.join(dataDir, rel), dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    const e = { path: rel, bytes: fs.statSync(dst).size, sha256: sha256(dst) };
    if (e.sha256 !== sha256(src)) throw new Error(`Salinan ${rel} tidak sama dengan aslinya (berkas berubah saat disalin? hentikan server dulu)`);
    if (rel.endsWith('db.json')) Object.assign(e, counts(dst));
    entries.push(e);
  }
  const manifest = { format: 1, createdAt: now.toISOString(), label: safeLabel, files: entries };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { dir, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const dataDir = opt('--data') || process.env.DATA_DIR || 'data';
  try {
    const { dir, manifest } = makeBackup({ dataDir, label: opt('--label') || 'manual' });
    console.log(`Cadangan dibuat: ${dir}`);
    for (const f of manifest.files) console.log(`  ${f.path}  ${f.bytes} byte  sha256 ${f.sha256.slice(0, 12)}...` + (f.employees != null ? `  karyawan ${f.employees}, divisi ${f.divisions}` : ''));
  } catch (e) { console.error('Gagal mencadangkan:', e.message); process.exit(1); }
}
