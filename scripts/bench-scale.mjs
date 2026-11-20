// Uji beban sintetis P7. SELALU di folder data terpisah (bukan data/ asli) dan tanpa kunci AI.
// Pemakaian: node scripts/bench-scale.mjs --n 200 [--mode json|dual|sqlite] [--dir <folder>] [--keep] [--tasks 100 --messages 600 --events 300]
// Hasil dicetak sebagai satu baris JSON per tahap. Tiap tahap berjalan di proses baru supaya memori dan waktu boot jujur.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const N = Number(opt('n', 200)), MODE = opt('mode', 'json');
const PROFILE = { tasks: Number(opt('tasks', 100)), messages: Number(opt('messages', 600)), events: Number(opt('events', 300)), active: Number(opt('active', 0.02)) };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(opt('dir', path.join(os.tmpdir(), `raiverse-bench-${N}-${MODE}`)));
const stage = opt('stage', '');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mb = (b) => Math.round(b / 1048576);
const out = (o) => console.log(JSON.stringify(o));

if (DIR === path.resolve('data') || path.basename(DIR) === 'data' && fs.existsSync(path.join(DIR, 'auth.json'))) { console.error('Menolak memakai folder data asli.'); process.exit(2); }

if (!stage) {
  if (!process.argv.includes('--keep')) fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const env = { ...process.env, DATA_DIR: DIR, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', STORAGE_MODE: MODE, RAIVERSE_NO_AUTH: '1', ...(args.includes('--lazy') ? { STORE_LAZY: '1', STORE_IDLE_MS: '1', TICK_ACTIVE_MS: '1' } : {}) };
  for (const st of ['gen', 'boot', 'save', 'tick']) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args, '--stage', st, '--dir', DIR], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    process.stdout.write(r.stdout); if (r.status) { console.error(r.stderr); process.exit(r.status); }
  }
  out({ stage: 'disk', n: N, mode: MODE, dirMB: +(dirSize(DIR) / 1048576).toFixed(1) });
  if (!process.argv.includes('--keep')) fs.rmSync(DIR, { recursive: true, force: true });
  process.exit(0);
}
function dirSize(d) { let t = 0; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); t += f.isDirectory() ? dirSize(p) : fs.statSync(p).size; } return t; }

const store = await import('../server/store.js');
const { starterDb } = await import('../server/workspace.js');
const wsIds = Array.from({ length: N }, (_, i) => `w-bench${String(i).padStart(5, '0')}`);

function fill(d, i) {
  const now = Date.now(), emps = d.employees.filter((e) => e.type === 'ai').map((e) => e.id);
  for (let k = 0; k < PROFILE.tasks; k++) d.tasks.push({ id: `t-${i}-${k}`, title: `Tugas ${k} contoh sintetis`, description: 'x'.repeat(300), status: 'done', assigneeId: emps[k % emps.length], createdBy: 'owner', priority: 'medium', output: 'Hasil sintetis '.repeat(30), summary: 'ringkas', log: Array.from({ length: 7 }, (_, j) => ({ t: now, actorId: 'system', type: 'log', text: `langkah ${j} selesai` })), createdAt: now - k * 1000, updatedAt: now, cost: 0.001 });
  for (let k = 0; k < PROFILE.messages; k++) d.messages.push({ id: `m-${i}-${k}`, channelId: 'umum', authorId: emps[k % emps.length], text: 'Pesan sintetis '.repeat(12), t: now - k * 500 });
  for (let k = 0; k < PROFILE.events; k++) d.events.push({ id: `ev-${i}-${k}`, t: now - k * 800, type: 'info', actorId: 'system', text: 'Peristiwa sintetis sebagai contoh' });
  return d;
}

if (stage === 'gen') {
  const t0 = performance.now(); store.load({ reset: true });
  const tLoad = performance.now() - t0;
  const t1 = performance.now();
  for (let i = 0; i < N; i++) store.createWorkspace(wsIds[i], fill(starterDb({ ownerName: `Pengguna ${i}` }), i));
  const ms = performance.now() - t1;
  out({ stage: 'gen', n: N, mode: MODE, createTotalMs: Math.round(ms), perWorkspaceMs: +(ms / N).toFixed(1), rssMB: mb(process.memoryUsage().rss) });
}

if (stage === 'boot') {
  const t0 = performance.now();
  store.load(); store.loadWorkspaces();
  const ms = performance.now() - t0;
  global.gc?.();
  out({ stage: 'boot', n: N, mode: MODE, bootMs: Math.round(ms), heapMB: mb(process.memoryUsage().heapUsed), rssMB: mb(process.memoryUsage().rss), loadedWorkspaces: store.ids().length });
}

if (stage === 'save') {
  store.load(); store.loadWorkspaces();
  const ids = store.ids().filter((x) => x !== 'main'), lat = [];
  for (const id of ids.slice(0, 30)) store.run(id, () => store.saveNow());   // pemanasan: simpan pertama (mode dual memverifikasi dan mengisi cache) tidak diukur
  for (let k = 0; k < Math.min(30, ids.length); k++) {
    const id = ids[k];
    store.run(id, () => {
      const d = store.get(); store.upsert('messages', { id: `m-new-${k}`, channelId: 'umum', authorId: 'owner', text: 'pesan baru', t: Date.now() });
      const t0 = performance.now(); store.saveNow(); lat.push(performance.now() - t0);
    });
  }
  // semua ruang kerja berubah sekaligus (mis. satu lintasan routine untuk semua)
  const t1 = performance.now();
  for (const id of ids) store.run(id, () => { store.upsert('messages', { id: `m-burst-${id}`, channelId: 'umum', authorId: 'owner', text: 'x', t: Date.now() }); store.saveNow(); });
  out({ stage: 'save', n: N, mode: MODE, saveMedianMs: +med(lat).toFixed(2), saveMaxMs: +Math.max(...lat).toFixed(2), allDirtyMs: Math.round(performance.now() - t1) });
}

if (stage === 'tick') {
  store.load(); store.loadWorkspaces();
  const engine = await import('../server/engine.js');
  const ids = store.ids().filter((x) => x !== 'main');
  // sebagian kecil ruang kerja punya tugas terbuka (aktif)
  const nAct = Math.max(1, Math.round(ids.length * PROFILE.active));
  for (const id of ids.slice(0, nAct)) store.run(id, () => { const d = store.get(); const ai = d.employees.find((e) => e.type === 'ai'); d.tasks.push({ id: 't-open', title: 'Tugas terbuka', description: '', status: 'todo', assigneeId: ai.id, createdBy: 'owner', priority: 'low', log: [], createdAt: Date.now() }); });
  const times = [];
  if (process.env.STORE_LAZY === '1') for (let k = 0; k < Math.ceil(ids.length / 25) + 3; k++) { await engine._passOnce(); await new Promise((r) => setTimeout(r, 3)); }   // pemanasan: semua ruang kerja dibangunkan sekali lalu dilepas
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); await engine._passOnce(); times.push(performance.now() - t0); }
  out({ stage: 'tick', n: N, mode: MODE, lazy: process.env.STORE_LAZY === '1', activeWorkspaces: nAct, loadedAfter: store.storageStats().loaded, passMedianMs: Math.round(med(times)), rssMB: mb(process.memoryUsage().rss) });
  process.exit(0);
}
