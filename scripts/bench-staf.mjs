// Pengukuran waktu dan memori: staf lewat n8n (webhook alur terpasang) vs mesin native, satu kali dan 100 kali berturut-turut.
// Hanya MEMBACA daftar alur lalu memanggil alur staf [RAIVERSE][staf] yang sudah terpasang dengan isian contoh (tanpa efek keluar).
// Pakai: node scripts/bench-staf.mjs [kunci-staf] [--tanpa-n8n]    (bawaan: fin-ratna). Kunci n8n dari .env, tidak pernah dicetak.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from './lib/n8n-staf.mjs';

L.loadEnv();
process.env.DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ray-bench-'));
const key = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'fin-ratna';
const withN8n = !process.argv.includes('--tanpa-n8n');
const registry = await import('../server/staff/registry.js');
const native = await import('../server/staff/native.js');
const spec = registry.get(key); if (!spec) throw new Error('staf tidak ada: ' + key);
const input = spec.sample.input;
const ms = (t0) => Math.round((performance.now() - t0) * 100) / 100;
const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { rata: Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) / 100, median: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], maks: s.at(-1) }; };
const rssMB = (pid) => { try { return Math.round(Number(execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).WorkingSet64`], { encoding: 'utf8' }).trim()) / 1048576); } catch { return null; } };
const n8nPid = () => { try { return Number(execFileSync('powershell', ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${new URL(L.baseUrl()).port || 5678} -State Listen -ErrorAction Stop | Select-Object -First 1).OwningProcess`], { encoding: 'utf8' }).trim()) || null; } catch { return null; } };
const sum = (o) => JSON.stringify(o).length;

const out = { staf: key };
// ── native
{
  const hooks = { saveRow() {}, llm: async () => ({ text: '' }) };
  const rss0 = process.memoryUsage().rss, t1 = performance.now(); const r1 = await native.runSpec(spec, { input, hooks }); const one = ms(t1);
  const times = []; const t100 = performance.now(); let cpu0 = process.cpuUsage();
  for (let i = 0; i < 100; i++) { const t = performance.now(); await native.runSpec(spec, { input, runId: 'b' + i, hooks }); times.push(ms(t)); }
  const cpu = process.cpuUsage(cpu0);
  out.native = { satuKali_ms: one, seratus_total_ms: ms(t100), per_jalan: stat(times), cpu_ms_100: Math.round((cpu.user + cpu.system) / 1000), tambahanRSS_MB: Math.round((process.memoryUsage().rss - rss0) / 1048576), ringkas: r1.ringkas, ukuranHasil: sum(r1) };
}
// ── n8n
if (withN8n) {
  try {
    const list = (await L.listAll()).filter((w) => w.name.startsWith(`${L.STAF_PREFIX}${key} v`) && w.active);
    if (!list.length) throw new Error('alur aktif untuk staf ini tidak ada di n8n');
    const wf = await L.api('GET', `/api/v1/workflows/${encodeURIComponent(list[0].id)}`);
    const hook = (wf.nodes || []).find((n) => /webhook$/.test(n.type)); const p = hook?.parameters?.path; if (!p) throw new Error('alur tanpa alamat masuk');
    const call = async (runId) => { const t = performance.now(); const res = await fetch(`${L.baseUrl()}/webhook/${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws: 'uji-bench', user: 'uji', runId, staf: key, phase: 'jalankan', input }), signal: AbortSignal.timeout(60_000) }); const j = await res.json().catch(() => null); const o = Array.isArray(j) ? j[0] : j; return { ms: ms(t), ok: res.ok && o?.tahap === 'selesai', ringkas: o?.ringkas }; };
    const pid = n8nPid(), rss0 = pid ? rssMB(pid) : null;
    const first = await call('bench-0'); const times = []; let salah = 0; const t100 = performance.now();
    for (let i = 0; i < 100; i++) { const r = await call('bench-' + (i + 1)); times.push(r.ms); if (!r.ok) salah++; }
    out.n8n = { satuKali_ms: first.ms, seratus_total_ms: ms(t100), per_jalan: stat(times), gagal: salah + (first.ok ? 0 : 1), ringkasSama: first.ringkas === out.native.ringkas, RSS_sebelum_MB: rss0, RSS_sesudah_MB: pid ? rssMB(pid) : null, pid: pid ? 'ada' : 'tidak terbaca' };
  } catch (e) { out.n8n = { galat: e.message }; }
}
console.log(JSON.stringify(out, null, 2));
