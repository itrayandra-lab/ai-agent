// Pembersih alur staf di mesin otomasi: menghapus HANYA alur berawalan "[RAIVERSE][staf] " (dan tabel "raiverse_staf" dengan --tabel).
// Alur milik Owner dan alur "[RAIVERSE] [..]" milik otomasi pengguna tidak disentuh.
// Pakai:  node --env-file=.env scripts/staff-cleanup.mjs --dry        (hanya tampilkan)
//         node --env-file=.env scripts/staff-cleanup.mjs              (hapus alur staf)
//         node --env-file=.env scripts/staff-cleanup.mjs --tabel      (hapus juga tabel data staf)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ray-staff-clean-'));
const store = await import('../server/store.js');
if (!fs.existsSync(path.join(process.env.DATA_DIR, 'db.json'))) fs.writeFileSync(path.join(process.env.DATA_DIR, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const N = await import('../server/n8n.js');
const dry = process.argv.includes('--dry');
const mine = (await N.listWorkflows(250)).filter((w) => /^\[RAIVERSE\]\[staf\] /.test(w.name));
for (const w of mine) { console.log(dry ? 'akan dihapus:' : 'hapus:', w.name); if (!dry) { await N.setActive(w.id, false).catch(() => {}); await N.deleteWorkflow(w.id); } }
if (process.argv.includes('--tabel')) for (const t of ((await N.request('GET', '/api/v1/data-tables?limit=250'))?.data || []).filter((x) => x.name === 'raiverse_staf')) { console.log(dry ? 'tabel akan dihapus:' : 'tabel dihapus:', t.name); if (!dry) await N.request('DELETE', `/api/v1/data-tables/${t.id}`); }
console.log(JSON.stringify({ alurStaf: mine.length, dry }));
