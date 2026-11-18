// Titik masuk tunggal modul staf: dipakai engine.js (tool manajer) dan index.js (rute API). Kontrak lengkap: docs/ARSITEKTUR-STAF-N8N.md
import * as registry from './registry.js';
import * as runner from './runner.js';
import * as deployer from './deployer.js';
import * as manager from './manager.js';
import { formView, validateSpec } from './schema.js';
import { awamTools } from './fragments.js';
import { StaffError } from './hook.js';
import * as store from '../store.js';
import { readDeploy, filesOf } from './data.js';
import * as native from './native.js';

import * as skills from './skills.js';
export { registry, runner, deployer, manager, skills };
export const isTool = manager.isTool;
export const toolDefs = manager.toolDefs;
export const promptSection = manager.promptSection;
export const call = manager.call;

const wrap = (fn) => async (b, p, url, me, member) => { try { return await fn(b, p, url, me, member); } catch (err) { if (err instanceof StaffError) throw Object.assign(new Error(err.message), { code: err.code }); throw err; } };
const divisionName = (id) => store.get().divisions?.find((d) => d.id === id)?.name || id;
const detail = (s) => ({ ...registry.brief(s), tugas: s.ringkas, formulir: registry.ready(s) ? formView(s) : [], keluaran: registry.ready(s) ? { teks: !!s.output?.teks, berkas: (s.output?.berkas || []).map((b) => b.jenis) } : null, perluAkun: s.steps?.some((x) => x.use === 'tulis_sheets') ? ['google'] : [], alat: registry.ready(s) ? awamTools(s) : [], contoh: s.sample?.input || null, mesin: runner.engineOf(s), pakaiAI: (s.steps || []).some((x) => x.use === 'otak' || x.use === 'minta_ai') });

export const routes = [
  ['GET', '/api/staff', wrap(() => { registry.linkEmployees(); const sk = skills.install(store.get()); if (sk.skills || sk.refs || sk.dihapus) store.saveNow?.(); const c = registry.counts(); const d = readDeploy().items; return { divisi: Object.entries(c).map(([id, n]) => ({ id, nama: divisionName(id), ...n })), terpasang: Object.keys(d).length, problem: registry.load().problems.length }; })],
  ['GET', '/api/staff/divisi/:id', wrap((b, p) => ({ staf: registry.byDivision(p.id).map(registry.brief) }))],
  ['GET', '/api/staff/files', wrap((b, p, url) => ({ berkas: filesOf(store.current(), { limit: Math.min(200, Number(url.searchParams.get('limit')) || 100) }) }))],
  ['GET', '/api/staff/konektor', wrap(async () => ({ konektor: await native.konektor() }))],
  ['GET', '/api/staff/mesin', wrap(() => ({ mesin: runner.engineOf({}), pemakaianHariIni: runner.nativeUsage(), batas: { perHari: runner.limits().nativePerDay, aiPerHari: runner.limits().otakPerDay } }))],
  ['GET', '/api/staff/runs', wrap((b, p, url) => ({ jalan: runner.list(store.current(), { staf: url.searchParams.get('staf') || undefined, limit: Number(url.searchParams.get('limit')) || 30 }) }))],
  ['GET', '/api/staff/runs/:id', wrap(async (b, p) => { const r = (await runner.settle(store.current(), p.id)) || runner.get(store.current(), p.id); if (!r) throw new StaffError('Pekerjaan itu tidak ditemukan.', 'tak_ada', 404); return r; })],
  ['GET', '/api/staff/runs/:id/files/:name', wrap((b, p) => { const f = runner.fileOf(store.current(), p.id, decodeURIComponent(p.name)); if (!f) throw new StaffError('Berkas tidak ditemukan.', 'tak_ada', 404); return f; })],
  ['POST', '/api/staff/runs/:id/izin', wrap((b, p) => runner.decide(store.current(), p.id, b.setuju === true))],
  ['GET', '/api/staff/:key', wrap((b, p) => { const s = registry.get(p.key); if (!s) throw new StaffError('Staf itu tidak ditemukan.', 'tak_ada', 404); return detail(s); })],
  ['POST', '/api/staff/:key/run', wrap((b, p) => runner.run({ key: p.key, input: b.isian, userId: b.userId || 'owner', ws: store.current(), confirmed: b.konfirmasi === true }))],   // konfirmasi:true = pengguna menekan "Ya, jalankan" di Pemandu
];
