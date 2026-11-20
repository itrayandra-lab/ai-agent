// Migrasi penyimpanan JSON <-> SQLite (P7). Hentikan server dulu. Dapat diulang: menjalankannya dua kali menghasilkan keadaan yang sama.
//   node scripts/storage-migrate.mjs status   [--data data]
//   node scripts/storage-migrate.mjs migrate  [--data data] [--ws <id>] [--mode dual|sqlite] [--no-backup]   JSON -> SQLite, dibandingkan, lalu bendera ke dual (bawaan)
//   node scripts/storage-migrate.mjs verify   [--data data] [--ws <id>]                                       bandingkan JSON dan SQLite
//   node scripts/storage-migrate.mjs cutover  [--data data] [--ws <id>]                                       verifikasi lalu bendera ke sqlite (JSON berhenti ditulis)
//   node scripts/storage-migrate.mjs rollback [--data data] [--ws <id>]                                       sqlite -> db.json (cadangan dulu), bendera ke json
// Tanpa --ws = semua ruang kerja (main dan ws/*). Cadangan penuh otomatis lewat scripts/backup-data.mjs (sama dengan `npm run data:backup`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBackup } from './backup-data.mjs';
import * as sq from '../server/store-sqlite.js';

const a = process.argv.slice(2), cmd = a[0];
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const DATA = path.resolve(opt('--data', process.env.DATA_DIR || 'data'));
const only = opt('--ws');
const FLAGS = path.join(DATA, 'storage-flags.json');
const jsonFile = (id) => (id === 'main' ? path.join(DATA, 'db.json') : path.join(DATA, 'ws', id, 'db.json'));
const sqlFile = (id) => (id === 'main' ? path.join(DATA, 'db.sqlite') : path.join(DATA, 'ws', id, 'db.sqlite'));

export function workspaceIds(dataDir = DATA) {
  const out = [];
  if (fs.existsSync(path.join(dataDir, 'db.json')) || fs.existsSync(path.join(dataDir, 'db.sqlite'))) out.push('main');
  const dir = path.join(dataDir, 'ws');
  if (fs.existsSync(dir)) for (const id of fs.readdirSync(dir).sort()) if (/^[\w-]{3,40}$/.test(id) && (fs.existsSync(path.join(dir, id, 'db.json')) || fs.existsSync(path.join(dir, id, 'db.sqlite')))) out.push(id);
  return out;
}
const readFlags = () => { try { const f = JSON.parse(fs.readFileSync(FLAGS, 'utf8')); f.ws ||= {}; return f; } catch { return { ws: {} }; } };
const writeFlags = (f) => { fs.writeFileSync(FLAGS + '.tmp', JSON.stringify(f, null, 1)); fs.renameSync(FLAGS + '.tmp', FLAGS); };
const targets = () => { const all = workspaceIds(); if (only) { if (!all.includes(only)) throw new Error(`Ruang kerja ${only} tidak ada`); return [only]; } return all; };

/** salin satu ruang kerja JSON -> SQLite lalu baca ulang dari berkas dan bandingkan. Mengembalikan { rows, bad } */
export function toSqlite(id) {
  const data = JSON.parse(fs.readFileSync(jsonFile(id), 'utf8'));
  const h = sq.open(sqlFile(id));
  try {
    const rows = sq.write(h, data);
    sq.close(h);
    const h2 = sq.open(sqlFile(id));
    try { return { rows, bad: sq.diffKeys(data, sq.read(h2)) }; } finally { sq.close(h2); }
  } catch (e) { sq.close(h); throw e; }
}
/** bandingkan JSON dan SQLite yang sudah ada di disk */
export function compare(id) {
  if (!fs.existsSync(jsonFile(id))) return ['(db.json tidak ada)'];
  if (!fs.existsSync(sqlFile(id))) return ['(db.sqlite tidak ada)'];
  const h = sq.open(sqlFile(id));
  try { if (!sq.hasData(h)) return ['(db.sqlite kosong)']; return sq.diffKeys(JSON.parse(fs.readFileSync(jsonFile(id), 'utf8')), sq.read(h)); } finally { sq.close(h); }
}
/** SQLite -> db.json (atomik). db.json lama disalin dulu ke db.json.bak-pra-rollback-<cap-waktu>. */
export function toJson(id) {
  const h = sq.open(sqlFile(id));
  let data; try { if (!sq.hasData(h)) throw new Error('db.sqlite kosong, tidak ada yang bisa dipulihkan'); data = sq.read(h); } finally { sq.close(h); }
  const f = jsonFile(id);
  if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.bak-pra-rollback-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
  fs.writeFileSync(f + '.tmp', JSON.stringify(data)); fs.renameSync(f + '.tmp', f);
  return sq.diffKeys(data, JSON.parse(fs.readFileSync(f, 'utf8')));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fail = (m) => { console.error(m); process.exit(1); };
  if (!sq.available()) fail('node:sqlite tidak tersedia di Node ini.');
  if (!['status', 'migrate', 'verify', 'cutover', 'rollback'].includes(cmd)) fail('Pemakaian: storage-migrate.mjs status|migrate|verify|cutover|rollback [--data folder] [--ws id] [--mode dual|sqlite] [--no-backup]');
  try {
    const ids = targets(), flags = readFlags();
    if (cmd === 'status') {
      for (const id of ids) console.log(`${id.padEnd(22)} mode=${(flags.ws[id] ?? flags.default ?? 'json').padEnd(6)} json=${fs.existsSync(jsonFile(id)) ? Math.round(fs.statSync(jsonFile(id)).size / 1024) + 'KB' : '-'} sqlite=${fs.existsSync(sqlFile(id)) ? Math.round(fs.statSync(sqlFile(id)).size / 1024) + 'KB' : '-'}`);
      process.exit(0);
    }
    if (cmd === 'migrate' || cmd === 'rollback') {
      if (!a.includes('--no-backup')) { const b = makeBackup({ dataDir: DATA, label: cmd === 'migrate' ? 'pra-sqlite' : 'pra-rollback-sqlite' }); console.log(`Cadangan penuh: ${b.dir}`); }
    }
    let bad = 0;
    for (const id of ids) {
      if (cmd === 'migrate') {
        const mode = opt('--mode', 'dual'); if (!['dual', 'sqlite'].includes(mode)) fail('--mode harus dual atau sqlite');
        if (!fs.existsSync(jsonFile(id))) { console.log(`${id}: dilewati (tidak ada db.json)`); continue; }
        const r = toSqlite(id);
        if (r.bad.length) { bad++; console.log(`${id}: BEDA pada ${r.bad.join(', ')} (bendera TIDAK diubah)`); continue; }
        flags.ws[id] = mode; console.log(`${id}: ${r.rows} baris ditulis, cocok, mode=${mode}`);
      } else if (cmd === 'verify') {
        const d = compare(id); if (d.length) bad++; console.log(`${id}: ${d.length ? 'BEDA ' + d.join(', ') : 'cocok'}`);
      } else if (cmd === 'cutover') {
        const d = compare(id); if (d.length) { bad++; console.log(`${id}: tidak dipindah, BEDA ${d.join(', ')}`); continue; }
        flags.ws[id] = 'sqlite'; console.log(`${id}: cutover, mode=sqlite (db.json berhenti ditulis)`);
      } else if (cmd === 'rollback') {
        if ((flags.ws[id] ?? flags.default ?? 'json') === 'sqlite' || fs.existsSync(sqlFile(id)) && !fs.existsSync(jsonFile(id))) { const d = toJson(id); if (d.length) { bad++; console.log(`${id}: rollback BEDA ${d.join(', ')}`); continue; } }
        flags.ws[id] = 'json'; console.log(`${id}: kembali ke json`);
      }
    }
    if (cmd !== 'verify') writeFlags(flags);
    process.exit(bad ? 1 : 0);
  } catch (e) { fail(`Gagal: ${e.message}`); }
}
