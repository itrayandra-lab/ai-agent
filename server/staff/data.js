// Penyimpanan milik RAIVERSE untuk staf: registri pemasangan, catatan jalan, dan berkas hasil.
// Semua di folder data/ (tidak di-commit). Tidak ada rahasia pengguna di sini; kunci n8n tidak pernah disimpan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = () => process.env.DATA_DIR || path.resolve('data');
const deployFile = () => process.env.STAFF_DEPLOY_FILE || path.join(dir(), 'staff-deploy.json');
const runsFile = () => process.env.STAFF_RUNS_FILE || path.join(dir(), 'staff-runs.json');
export const outDir = () => process.env.STAFF_OUT_DIR || path.join(dir(), 'staff-out');

function readJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
function writeJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); }

// ── registri pemasangan: { secret, tableId, items: { "<scopeKey>": {...} } }
export const readDeploy = () => { const d = readJson(deployFile(), null) || {}; d.items ||= {}; d.secret ||= crypto.randomBytes(24).toString('hex'); return d; };
export const writeDeploy = (d) => writeJson(deployFile(), d);
export function updateDeploy(fn) { const d = readDeploy(); fn(d); writeDeploy(d); return d; }

// ── catatan jalan
const MAX_RUNS_PER_WS = 200;
export const readRuns = () => { const r = readJson(runsFile(), null) || {}; r.runs ||= []; return r; };
export function saveRun(run) {
  const r = readRuns(); const i = r.runs.findIndex((x) => x.id === run.id);
  run.updatedAt = Date.now(); if (i >= 0) r.runs[i] = run; else r.runs.push(run);
  const mine = r.runs.filter((x) => x.ws === run.ws);
  if (mine.length > MAX_RUNS_PER_WS) { const drop = new Set(mine.sort((a, b) => a.startedAt - b.startedAt).slice(0, mine.length - MAX_RUNS_PER_WS).map((x) => x.id)); r.runs = r.runs.filter((x) => !drop.has(x.id)); for (const id of drop) rmRunFiles(run.ws, id); }
  writeJson(runsFile(), r); return run;
}
export const runsOf = (ws) => readRuns().runs.filter((x) => x.ws === ws).sort((a, b) => b.startedAt - a.startedAt);
export const findRun = (ws, id) => readRuns().runs.find((x) => x.ws === ws && x.id === id) || null;

// ── berkas hasil: data/staff-out/<ruang kerja>/<id jalan>/<nama>
const safeSeg = (s) => String(s).replace(/[^\w.-]+/g, '_').slice(0, 60) || 'x';
const FILE_EXT = { csv: 'csv', md: 'md', txt: 'txt', json: 'json', html: 'html' };
export function cleanFileName(name, kind) {
  const ext = FILE_EXT[kind] || 'txt';
  const base = String(name ?? '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^\p{L}\p{N} _.-]+/gu, ' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 70) || 'hasil';
  return `${base}.${ext}`;
}
export function writeFiles(ws, runId, files) {
  const base = path.join(outDir(), safeSeg(ws), safeSeg(runId)); fs.mkdirSync(base, { recursive: true });
  const seen = new Set(), meta = [];
  for (const f of files) {
    let n = f.nama, i = 2; while (seen.has(n.toLowerCase())) n = f.nama.replace(/(\.[^.]+)$/, ` (${i++})$1`); seen.add(n.toLowerCase());
    fs.writeFileSync(path.join(base, n), f.isi, 'utf8'); meta.push({ nama: n, jenis: f.jenis, bytes: Buffer.byteLength(f.isi) });
  }
  return meta;
}
export function readFile(ws, runId, name) {
  const base = path.join(outDir(), safeSeg(ws), safeSeg(runId)), p = path.join(base, path.basename(String(name)));
  if (path.dirname(p) !== base) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
export function rmRunFiles(ws, runId) { try { fs.rmSync(path.join(outDir(), safeSeg(ws), safeSeg(runId)), { recursive: true, force: true }); } catch { /* sudah tidak ada */ } }
