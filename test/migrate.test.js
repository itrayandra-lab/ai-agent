// Tes migrasi P1: satu migrate(db) untuk semua ruang kerja, idempoten, id tidak hilang, cadangan dibuat,
// satu manajer per divisi lewat org.hire / PATCH (juga lewat HTTP), 22 divisi pada ruang kerja baru, kontrak data 3D.
// Semua memakai folder data sementara dan port 4521; tidak pernah menyentuh data/ milik Owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-migrate-'));
process.env.DATA_DIR = tmp;
process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
process.env.ANTHROPIC_API_KEY = ''; process.env.GROQ_API_KEY = '';
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara */ } });

const { buildSeed } = await import('../server/seed.js');
const { starterDb } = await import('../server/workspace.js');
const store = await import('../server/store.js');
const org = await import('../server/org.js');
const rules = await import('../server/org-rules.js');
const { mapStatus, STATUSES } = await import('../server/staff/status-map.js');

const V = rules.SCHEMA_VERSION;
/** db berbentuk lama: tanpa medan P1, isLead/isMaster/isPA saja, master melapor ke PA, owner ber-isLead */
function legacyShaped(version = 8) {
  const d = buildSeed();
  d.version = version;
  for (const e of d.employees) { for (const k of ['role', 'staffId', 'workflowId', 'characterId', 'legacy']) delete e[k]; if (e.type === 'ai') delete e.voiceGender; }
  d.employees.find((e) => e.id === 'aria').reportsTo = 'pa-owner';
  d.employees.find((e) => e.id === 'owner').isLead = true;
  return d;
}
const fp = (db) => JSON.stringify(db.employees.map((e) => [e.id, e.role, e.isLead, e.reportsTo, e.staffId, e.workflowId, e.characterId, e.legacy, e.voiceGender, e.status])) + JSON.stringify(db.divisions.map((d) => [d.id, d.leadId]));

test('migrate: idempoten, tidak ada id hilang, medan baru terisi, master setara PA di bawah owner', () => {
  const d = legacyShaped();
  const ids = d.employees.map((e) => e.id);
  store.migrate(d);
  const f1 = fp(d);
  store.migrate(d);
  assert.equal(fp(d), f1, 'migrasi kedua mengubah hasil');
  assert.deepEqual(d.employees.map((e) => e.id), ids, 'id berubah/hilang/bertambah');
  assert.equal(d.version, V);
  assert.equal(V, rules.SCHEMA_VERSION);
  const by = (id) => d.employees.find((e) => e.id === id);
  assert.equal(by('owner').role, 'owner'); assert.equal(by('owner').isLead, false);
  assert.equal(by('aria').role, 'master'); assert.equal(by('aria').reportsTo, 'owner', 'master tidak lagi melapor ke PA');
  assert.equal(by('pa-owner').role, 'pa'); assert.equal(by('pa-owner').reportsTo, 'owner');
  for (const e of d.employees) {
    assert.equal(e.characterId, e.id);
    assert.equal(typeof e.isLead, 'boolean');
    assert.ok(rules.ROLES.includes(e.role), `${e.id} role ${e.role}`);
    if (e.type === 'ai') assert.ok(e.voiceGender === 'female' || e.voiceGender === 'male', `${e.id} voiceGender`);
  }
  assert.deepEqual(rules.contractProblems(d), []);
  assert.deepEqual(rules.managerProblems(d), []);
  // isLead tetap turunan role (kecuali master Executive yang memimpin lewat leadId)
  for (const e of d.employees.filter((x) => x.role === 'manager')) assert.equal(e.isLead, true);
  assert.equal(d.divisions.find((x) => x.id === 'exec').leadId, 'aria');
});

test('migrate: agen di luar seed/katalog ditandai legacy (tidak dihapus), roster seed tidak', () => {
  const d = legacyShaped();
  const extra = { ...d.employees.find((e) => e.id === 'dewi'), id: 'agenlama1', name: 'Agen Lama', isLead: false };
  d.employees.push(extra);
  store.migrate(d);
  const x = d.employees.find((e) => e.id === 'agenlama1');
  assert.ok(x, 'agen lama hilang');
  assert.equal(x.legacy, true); assert.equal(x.role, 'extra'); assert.equal(x.staffId, null);
  assert.equal(d.employees.filter((e) => e.legacy === true).length, 1);
  assert.equal(d.employees.find((e) => e.id === 'dewi').legacy, false);
  assert.equal(d.employees.find((e) => e.id === 'dewi').staffId, 'exec-dewi', 'staffId = kunci katalog');
  const again = fp(d); store.migrate(d); assert.equal(fp(d), again);
});

test('migrate: dua pemimpin dalam satu divisi diselesaikan (leadId menang), tanpa mengganti id', () => {
  const d = legacyShaped();
  const div = d.divisions.find((x) => x.id === 'fin');
  const lead = div.leadId;
  const other = d.employees.find((e) => e.divisionId === 'fin' && !e.isLead);
  other.isLead = true;
  store.migrate(d);
  assert.equal(d.employees.filter((e) => e.divisionId === 'fin' && e.isLead).length, 1);
  assert.equal(div.leadId, lead);
  assert.equal(d.employees.find((e) => e.id === other.id).role, 'staff');
  assert.deepEqual(rules.managerProblems(d), []);
});

test('load + loadWorkspaces memakai migrate yang sama; cadangan dibuat sebelum menulis', () => {
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(legacyShaped(8)));
  const wsDir = path.join(tmp, 'ws', 'ws-lama-p1');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'db.json'), JSON.stringify(legacyShaped(7)));
  const mainBefore = fs.readFileSync(path.join(tmp, 'db.json'), 'utf8');
  const wsBefore = fs.readFileSync(path.join(wsDir, 'db.json'), 'utf8');
  const main = store.load();
  store.loadWorkspaces();
  const ws = store.run('ws-lama-p1', () => store.get());
  assert.equal(main.version, V); assert.equal(ws.version, V, 'ruang kerja lain tidak ikut termigrasi');
  for (const d of [main, ws]) { assert.ok(d.employees.every((e) => e.role && e.characterId === e.id)); assert.deepEqual(rules.managerProblems(d), []); }
  // salinan berkas lama: *.bak-v<versi>-<cap-waktu> berisi isi SEBELUM migrasi
  const baks = (dir) => fs.readdirSync(dir).filter((f) => f.startsWith('db.json.bak-v'));
  const mb = baks(tmp), wb = baks(wsDir);
  assert.ok(mb.some((f) => /^db\.json\.bak-v8-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/.test(f)), `cadangan main: ${mb}`);
  assert.ok(wb.some((f) => f.startsWith('db.json.bak-v7-')), `cadangan ws: ${wb}`);
  assert.equal(fs.readFileSync(path.join(tmp, mb[0]), 'utf8'), mainBefore);
  assert.equal(fs.readFileSync(path.join(wsDir, wb[0]), 'utf8'), wsBefore);
  // cadangan penuh P0 (manifest) juga ada
  const bdir = path.join(tmp, 'backups');
  assert.ok(fs.existsSync(bdir) && fs.readdirSync(bdir).some((d) => fs.existsSync(path.join(bdir, d, 'manifest.json'))), 'cadangan penuh P0 tidak dibuat');
  // dimuat ulang dari berkas yang sudah termigrasi: sama dan tanpa cadangan baru
  const nb = baks(tmp).length;
  const again = store.load();
  assert.equal(fp(again), fp(main)); assert.equal(baks(tmp).length, nb, 'data yang sudah termigrasi tidak dicadangkan lagi');
});

test('migrasi yang gagal TIDAK membuat ulang data (berkas asli tetap, galat dilempar)', () => {
  const bad = legacyShaped(8); bad.divisions = null;   // merusak struktur setelah dibaca
  const raw = JSON.stringify(bad);
  fs.writeFileSync(path.join(tmp, 'db.json'), raw);
  assert.throws(() => store.load());
  assert.equal(fs.readFileSync(path.join(tmp, 'db.json'), 'utf8'), raw, 'db.json asli tertimpa');
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(legacyShaped(8)));
  store.load();
});

test('satu manajer per divisi: hire dan PATCH menurunkan manajer lama; PA/manusia/master dijaga', () => {
  const d = store.load();
  const fin = d.divisions.find((x) => x.id === 'fin');
  const oldLead = fin.leadId;
  const staffer = d.employees.find((e) => e.divisionId === 'fin' && e.type === 'ai' && !e.isLead);
  // PATCH isLead:true pada staf
  const e1 = d.employees.find((e) => e.id === staffer.id);
  const ch1 = { isLead: true };
  org.checkRoleChange(e1, ch1); Object.assign(e1, ch1); org.settleLead(e1, ch1);
  assert.equal(fin.leadId, staffer.id);
  assert.deepEqual(d.employees.filter((e) => e.divisionId === 'fin' && e.isLead).map((e) => e.id), [staffer.id]);
  assert.equal(d.employees.find((e) => e.id === oldLead).role, 'staff');
  assert.equal(e1.role, 'manager');
  assert.equal(d.employees.find((e) => e.id === oldLead).reportsTo, staffer.id, 'manajer lama melapor ke yang baru');
  assert.deepEqual(rules.managerProblems(d), []);
  // lewat role: 'manager' (kembalikan manajer lama)
  const e0 = d.employees.find((e) => e.id === oldLead); const ch0 = { role: 'manager' };
  org.checkRoleChange(e0, ch0); Object.assign(e0, ch0); org.settleLead(e0, ch0);
  assert.equal(fin.leadId, oldLead); assert.equal(d.employees.filter((e) => e.divisionId === 'fin' && e.isLead).length, 1);
  assert.equal(e1.role, 'staff');
  // hire dengan isLead
  const h = org.hire({ name: 'Manajer Baru Fin', divisionId: 'fin', isLead: true });
  assert.equal(fin.leadId, h.id); assert.equal(d.employees.filter((e) => e.divisionId === 'fin' && e.isLead).length, 1);
  assert.equal(d.employees.find((e) => e.id === h.id).role, 'manager');
  assert.equal(h.characterId, h.id); assert.equal(h.staffId, null); assert.equal(h.workflowId, null);
  // hire biasa tidak mengubah manajer
  const s = org.hire({ name: 'Staf Biasa Fin', divisionId: 'fin' });
  assert.equal(fin.leadId, h.id); assert.equal(s.isLead, false); assert.equal(s.role, 'staff');
  // dijaga: PA, manusia, master di luar Executive, peran tidak sah
  assert.throws(() => org.checkRoleChange(d.employees.find((e) => e.isPA), { isLead: true }), /bukan manajer/);
  assert.throws(() => org.checkRoleChange(d.employees.find((e) => e.id === 'owner'), { role: 'manager' }), /bukan manajer/);
  assert.throws(() => org.checkRoleChange(d.employees.find((e) => e.id === staffer.id), { role: 'master' }), /Peran tidak valid/);
  assert.throws(() => org.hire({ name: 'X', divisionId: 'fin', role: 'owner' }), /Peran tidak valid/);
  // Executive: owner bukan manajer; manusia baru di exec tidak jadi manajer; aria (master) tetap memimpin exec
  const hu = org.hire({ name: 'Rekan Manusia', type: 'human', divisionId: 'exec' });
  assert.equal(hu.isLead, false); assert.equal(hu.role, 'owner');
  assert.equal(d.divisions.find((x) => x.id === 'exec').leadId, 'aria');
  assert.deepEqual(rules.managerProblems(d), []); assert.deepEqual(rules.contractProblems(d), []);
  // melepas jabatan: divisi sementara tanpa manajer, tanpa dua pemimpin
  const eh = d.employees.find((e) => e.id === h.id); const chh = { isLead: false };
  org.checkRoleChange(eh, chh); Object.assign(eh, chh); org.settleLead(eh, chh);
  assert.equal(fin.leadId, null); assert.equal(eh.role, 'staff'); assert.deepEqual(rules.managerProblems(d), []);
  // batas dinaikkan
  assert.ok(org.MAX_AI_DEFAULT >= 300 && org.MAX_DIVISIONS >= 40);
});

test('ruang kerja baru: 22 divisi, tepat satu manajer tiap divisi; staf hanya di bawah bendera staffModel', () => {
  const a = starterDb();
  assert.equal(a.divisions.length, 22); assert.equal(a.version, V);
  assert.deepEqual(rules.managerProblems(a), []); assert.deepEqual(rules.contractProblems(a), []);
  for (const d of a.divisions) assert.equal(a.employees.filter((e) => e.divisionId === d.id && e.isLead && e.type === 'ai').length, 1, d.id);
  assert.equal(a.employees.filter((e) => e.role === 'staff').length, 0, 'bendera mati: tanpa staf daun');
  assert.equal(a.settings.staffModel, false);
  const b = starterDb({ staffModel: true });
  assert.equal(b.settings.staffModel, true);
  const cat = rules.catalogIndex();
  const leaves = b.employees.filter((e) => e.role === 'staff');
  assert.ok(leaves.length > 0 && leaves.every((e) => cat.byEmployee.has(e.id) && e.staffId), 'staf harus terwakili katalog');
  assert.deepEqual(rules.managerProblems(b), []);
  const f1 = fp(b); store.migrate(b); assert.equal(fp(b), f1, 'migrasi ulang mengubah ruang kerja baru');
});

test('pemetaan status workflow → lima nilai 3D tertutup', () => {
  for (const s of ['jalan', 'menunggu', 'butuh_izin', 'selesai', 'gagal', 'ditolak', 'new', 'running', 'waiting', 'success', 'error', 'crashed', 'canceled', 'working', 'idle', 'offline', '', null, undefined, 'aneh', 42, {}]) assert.ok(STATUSES.includes(mapStatus(s)), String(s));
  assert.equal(mapStatus('running'), 'working'); assert.equal(mapStatus('success'), 'idle'); assert.equal(mapStatus('RUNNING '), 'working'); assert.equal(mapStatus('xyz'), 'idle');
});

// ───────────────────────── lewat HTTP (server sungguhan di port 4521, data sementara) ─────────────────────────
test('HTTP: PATCH /api/employees dan POST /api/employees menegakkan satu manajer per divisi', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-migrate-http-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(legacyShaped(8)));
  const port = 4521, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, ARCHIVE_DIR: path.join(dir, 'arsip'), ANTHROPIC_API_KEY: '', GROQ_API_KEY: '' }, stdio: 'ignore' });
  t.after(() => { child.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* sementara */ } });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(base + '/api/state')).ok; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  assert.ok(up, 'server uji tidak menyala');
  const api = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const state = async () => (await api('GET', '/api/state')).body;
  let s = await state();
  assert.ok(s.employees.every((e) => e.characterId === e.id && e.role), 'migrasi tidak berlaku pada server');
  const lead0 = s.divisions.find((d) => d.id === 'mkt').leadId;
  const staff = s.employees.find((e) => e.divisionId === 'mkt' && e.type === 'ai' && !e.isLead);
  let r = await api('PATCH', `/api/employees/${staff.id}`, { isLead: true });
  assert.equal(r.status, 200);
  s = await state();
  assert.equal(s.divisions.find((d) => d.id === 'mkt').leadId, staff.id);
  assert.deepEqual(s.employees.filter((e) => e.divisionId === 'mkt' && e.isLead).map((e) => e.id), [staff.id]);
  assert.equal(s.employees.find((e) => e.id === lead0).role, 'staff');
  r = await api('PATCH', `/api/employees/${lead0}`, { role: 'manager' });
  assert.equal(r.status, 200);
  s = await state();
  assert.equal(s.divisions.find((d) => d.id === 'mkt').leadId, lead0);
  assert.equal(s.employees.filter((e) => e.divisionId === 'mkt' && e.isLead).length, 1);
  r = await api('POST', '/api/employees', { name: 'Kepala Baru HTTP', divisionId: 'mkt', isLead: true });
  assert.equal(r.status, 200);
  s = await state();
  assert.equal(s.divisions.find((d) => d.id === 'mkt').leadId, r.body.id);
  assert.equal(s.employees.filter((e) => e.divisionId === 'mkt' && e.isLead).length, 1);
  // pelanggaran ditolak 400 dan tidak mengubah apa pun
  const pa = s.employees.find((e) => e.isPA);
  assert.equal((await api('PATCH', `/api/employees/${pa.id}`, { isLead: true })).status, 400);
  assert.equal((await api('PATCH', '/api/employees/owner', { role: 'manager' })).status, 400);
  assert.equal((await api('PATCH', `/api/employees/${staff.id}`, { role: 'master' })).status, 400);
  const s2 = await state();
  assert.deepEqual(s2.divisions.map((d) => d.leadId), s.divisions.map((d) => d.leadId));
  for (const d of s2.divisions) assert.ok(s2.employees.filter((e) => e.divisionId === d.id && e.isLead && e.type === 'ai').length <= 1, d.id);
});
