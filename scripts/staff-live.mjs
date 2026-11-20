// Uji NYATA terbatas ke n8n: pasang → uji → jalankan dengan sample → HAPUS kembali semuanya (alur staf + tabel data staf).
// Memakai data sementara (bukan data/ aplikasi), tanpa kunci AI (langkah AI memakai teks cadangan), tanpa pesan keluar.
// Pakai:  node --env-file=.env scripts/staff-live.mjs fin-ratna,fin-wening     (kunci dipisah koma)
//         node --env-file=.env scripts/staff-live.mjs fin                      (semua staf lengkap satu divisi)
//         node --env-file=.env scripts/staff-live.mjs all
// Kunci n8n tidak pernah dicetak. Alur milik Owner tidak disentuh; jumlah alur sebelum/sesudah dicetak sebagai bukti tanpa sisa.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-staff-live-'));
Object.assign(process.env, { DATA_DIR: tmp, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '' });
const store = await import('../server/store.js');
fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const N = await import('../server/n8n.js');
const staff = await import('../server/staff/index.js');
const { readDeploy } = await import('../server/staff/data.js');

const arg = process.argv[2] || '';
const all = staff.registry.all().filter(staff.registry.ready);
const keys = !arg ? [] : arg === 'all' ? all.map((s) => s.key) : arg.includes('-') ? arg.split(',') : all.filter((s) => s.division === arg).map((s) => s.key);
if (!keys.length) { console.log('Tidak ada staf lengkap yang dipilih.'); process.exit(1); }
const out = { koneksi: (await N.connection()).pesan, alurSebelum: (await N.listWorkflows(250)).length, hasil: [] };
try {
  for (const key of keys) {
    const spec = staff.registry.get(key); const t0 = Date.now();
    const r = await staff.runner.run({ key, input: spec.sample.input, userId: 'owner', ws: store.current() });
    out.hasil.push({ key, status: r.status, ringkas: (r.ringkas || '').slice(0, 100), berkas: (r.berkas || []).map((b) => `${b.nama} ${b.bytes}B`), galat: r.galat || undefined, ms: Date.now() - t0 });
  }
} finally {
  const dep = readDeploy();
  out.terpasang = Object.values(dep.items).filter((x) => x.n8nId).map((x) => ({ key: x.key, simpul: x.nodes, byte: x.bytes, ujiMs: x.testMs, pasangMs: x.deployMs }));
  for (const k of Object.keys(dep.items)) await staff.deployer.retire(k).catch((e) => console.log('lepas gagal', k, e.message));
  if (dep.tableId) out.tabelStaf = await N.request('DELETE', `/api/v1/data-tables/${dep.tableId}`).then(() => 'dihapus').catch((e) => 'gagal: ' + e.message);
  const after = await N.listWorkflows(250); out.alurSesudah = after.length; out.sisaAlurStaf = after.filter((w) => /^\[RAIVERSE\]\[staf\] /.test(w.name)).map((w) => w.name);
  console.log(JSON.stringify(out, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = out.hasil.every((h) => h.status === 'selesai') && !out.sisaAlurStaf.length ? 0 : 1;
}
