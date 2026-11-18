// Memasang staf lengkap ke n8n Owner SECARA PERMANEN (pra-pasang, biasanya pemasangan terjadi malas saat pertama dipakai).
// Memakai registri asli data/staff-deploy.json (agar server RAIVERSE mengenali alurnya), tetapi data aplikasi (db.json) tidak disentuh.
// Pakai:  node --env-file=.env scripts/staff-install.mjs all | <divisi> | kunci,kunci
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const real = path.resolve('data');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-staff-install-'));
Object.assign(process.env, { DATA_DIR: tmp, STAFF_DEPLOY_FILE: path.join(real, 'staff-deploy.json'), STAFF_RUNS_FILE: path.join(real, 'staff-runs.json'), STAFF_OUT_DIR: path.join(real, 'staff-out'), GROQ_API_KEY: '', ANTHROPIC_API_KEY: '' });
const store = await import('../server/store.js');
fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const N = await import('../server/n8n.js');
const staff = await import('../server/staff/index.js');
const arg = process.argv[2] || 'all';
const ready = staff.registry.all().filter(staff.registry.ready);
const keys = arg === 'all' ? ready.map((s) => s.key) : arg.includes('-') ? arg.split(',') : ready.filter((s) => s.division === arg).map((s) => s.key);
store.get().settings.otomasi = { ...(store.get().settings.otomasi || {}), timeoutMs: 40000 };   // n8n Owner kadang lambat saat banyak pemasangan beruntun
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const k of keys) {
  const s = staff.registry.get(k); if (!s || !staff.registry.ready(s)) { out.push({ key: k, hasil: 'dilewati (bukan staf lengkap)' }); continue; }
  let last = '';
  for (let i = 1; i <= 4; i++) {   // ulangi bila mesin otomasi sesaat tidak menjawab (galat uji isi staf tidak diulang)
    try { const d = await staff.deployer.ensure(s, 'main'); out.push({ key: k, hasil: d.baru ? 'terpasang' : 'sudah ada', ms: d.ms }); last = ''; break; }
    catch (e) { last = e.message; if (!/belum menyala|terlalu lama|belum siap/.test(e.message)) break; N.resetClient(); await wait(4000 * i); }
  }
  if (last) out.push({ key: k, hasil: 'gagal: ' + last });
  await wait(400);
}
console.log(JSON.stringify({ out }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
