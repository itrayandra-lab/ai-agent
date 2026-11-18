// Katalog staf: memuat server/staff-catalog/<divisi>/<kunci>.json (+ _divisi.json) dan menjawab "siapa staf apa".
// Hanya spesifikasi LENGKAP yang valid yang bisa dijalankan; rintisan hanya terhitung sebagai "belum siap".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from '../store.js';
import { validateSpec, isStub } from './schema.js';
import { readDeploy } from './data.js';

export const catalogDir = () => process.env.STAFF_CATALOG_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'staff-catalog');
let cache = null, cacheAt = 0;
export const reset = () => { cache = null; };

/** Muat seluruh katalog (di-cache 5 detik; berkas diganti sesi lain tetap terbaca). */
export function load({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < 5000) return cache;
  const out = { specs: new Map(), divisions: new Map(), problems: [] };
  const root = catalogDir();
  let dirs = []; try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { /* katalog belum ada */ }
  for (const d of dirs) {
    let files = []; try { files = fs.readdirSync(path.join(root, d.name)).filter((f) => f.endsWith('.json')); } catch { continue; }
    for (const f of files) {
      const file = path.join(root, d.name, f);
      let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { out.problems.push({ file: `${d.name}/${f}`, errors: ['JSON rusak: ' + e.message] }); continue; }
      if (f === '_divisi.json') { out.divisions.set(d.name, j); continue; }
      if (f !== `${j.key}.json` || d.name !== j.division) { out.problems.push({ file: `${d.name}/${f}`, errors: ['nama berkas/folder harus sama dengan key dan division'] }); continue; }
      if (out.specs.has(j.key)) { out.problems.push({ file: `${d.name}/${f}`, errors: ['key dobel'] }); continue; }
      const v = validateSpec(j);
      if (v.kind === 'invalid') { out.problems.push({ file: `${d.name}/${f}`, errors: v.errors }); continue; }
      out.specs.set(j.key, Object.assign(j, { __kind: v.kind }));
    }
  }
  cache = out; cacheAt = Date.now(); return out;
}

export const all = () => [...load().specs.values()];
export const get = (key) => load().specs.get(String(key || '')) || null;
export const ready = (spec) => !!spec && spec.__kind === 'ready';
export const byDivision = (divisionId, { onlyReady = false } = {}) => all().filter((s) => s.division === divisionId && (!onlyReady || ready(s)));
export const byEmployee = (employeeId) => all().filter((s) => s.employeeId === employeeId);

/** Hitungan per divisi: { rintisan, lengkap, total }. */
export function counts() {
  const out = {};
  for (const s of all()) { const c = (out[s.division] ||= { rintisan: 0, lengkap: 0, total: 0 }); c.total++; if (isStub(s)) c.rintisan++; else c.lengkap++; }
  return out;
}

/** Kunci kata awam → skor kecocokan sederhana (tanpa AI berbayar) untuk memilih staf dari kalimat. */
/** Urutkan daftar staf menurut kecocokan kata kunci (tanpa AI berbayar). Tanpa kata kunci: urut abjad kunci. */
export function rank(list, query, { limit = 8 } = {}) {
  const words = String(query || '').toLowerCase().normalize('NFKD').split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const rows = list.map((s) => {
    const hay = [s.name, s.ringkas, ...(s.kataKunci || [])].join(' ').toLowerCase();
    const score = words.reduce((n, w) => n + (hay.includes(w) ? ((s.kataKunci || []).some((k) => k.toLowerCase().includes(w)) ? 3 : 1) : 0), 0);
    return { s, score };
  });
  return rows.sort((a, b) => b.score - a.score || a.s.key.localeCompare(b.s.key)).filter((r) => !words.length || r.score > 0).slice(0, limit).map((r) => r.s);
}
export const search = (divisionId, query, { limit = 8, onlyReady = true } = {}) => rank(byDivision(divisionId, { onlyReady }), query, { limit });

/** Ringkasan satu staf untuk layar atau manajer (tanpa langkah teknis). */
export const brief = (s) => ({ kunci: s.key, nama: s.name, ringkas: s.ringkas, jabatan: s.title, divisi: s.division, karyawan: s.employeeId, siap: ready(s), risiko: s.risk, perluIzin: !!s.confirm });

/** Tautkan ke karyawan: employee.staff = { kunci[], siap, terakhir } (hanya data ringkas, tanpa mengubah 3D). */
export function linkEmployees() {
  const d = store.get(); if (!d?.employees) return 0; let n = 0;
  for (const e of d.employees) {
    if (e.type !== 'ai') continue;
    const mine = byEmployee(e.id); const siap = mine.filter(ready).map((s) => s.key);
    const next = { kunci: mine.map((s) => s.key), siap, terakhir: e.staff?.terakhir || null };
    const dep = readDeploy().items[`staf:${e.staffId || mine[0]?.key}`];   // id alur n8n staf utama (bila sudah terpasang)
    if (dep?.n8nId && e.workflowId !== dep.n8nId) { e.workflowId = dep.n8nId; store.upsert('employees', e); n++; }
    if (JSON.stringify({ ...e.staff, terakhir: 0 }) !== JSON.stringify({ ...next, terakhir: 0 })) { e.staff = next; store.upsert('employees', e); n++; }
  }
  return n;
}
