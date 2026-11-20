// Tes invarian lintas lapisan (P0, docs/arsip/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md bagian 5).
// Tiga keadaan yang sengaja kelihatan di laporan:
//   - LULUS     : sinkron sekarang; jika merah berarti ada yang rusak.
//   - DITUNDA   : tes `todo` bertanda [P<fase>]; badan tes memeriksa keadaan sebenarnya dan gagal sampai fase itu selesai.
//                 Tidak dihapus dan tidak dipaksa lulus. Ketika sebuah fase selesai, tes ini lulus sendiri; lalu buang tanda todo.
//   - DIKETAHUI : pelanggaran yang sudah ada (daftar KNOWN di bawah) dilaporkan sebagai todo bertuliskan daftarnya;
//                 pelanggaran BARU di luar daftar membuat tes merah sungguhan.
// Semua tes memakai seed dan folder data sementara, tidak pernah data Owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-invariants-'));
process.env.DATA_DIR = tmp;
process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
process.env.ANTHROPIC_API_KEY = ''; process.env.GROQ_API_KEY = '';
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara saja */ } });

const { buildSeed } = await import('../server/seed.js');
const { starterDb } = await import('../server/workspace.js');
const store = await import('../server/store.js');
const catalog = await import('../server/catalog.js');
const org = await import('../server/org.js');
const rules = await import('../server/org-rules.js');
const { mapStatus, STATUSES: STATUS_3D } = await import('../server/staff/status-map.js');
const { pickMascotLook, MASCOT_PALETTES } = await import('../public/js/mascot-palettes.js');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const listJs = (dir) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => `${dir}/${String(f).replace(/\\/g, '/')}`) : [];
const STATUSES = ['working', 'meeting', 'chatting', 'idle', 'offline'];   // lima nilai yang dimengerti ruang 3D (office3d.js STATUS_COLOR)
const seed = buildSeed();
const ai = (db) => db.employees.filter((e) => e.type === 'ai');

/** pelanggaran yang sudah ada dan dicatat; tes merah hanya untuk yang baru. */
function knownFailure(t, violations, known, why) {
  const fresh = violations.filter((v) => !known.includes(v));
  assert.deepEqual(fresh, [], `Pelanggaran BARU (di luar daftar yang diketahui): ${fresh.join(', ')}`);
  if (violations.length) {
    t.todo(`DIKETAHUI: ${why}. Daftar: ${violations.join(', ')}`);
    assert.fail(`Pelanggaran yang diketahui: ${violations.join(', ')}`);
  }
}
const phase = (p, why) => ({ todo: `[${p}] ${why}` });

// ───────────────────────── 1. struktur organisasi ─────────────────────────
test('INV1 id karyawan unik, reportsTo menuju id yang ada, tanpa siklus (seed dan ruang kerja baru)', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    const ids = db.employees.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${name}: id ganda`);
    const set = new Set(ids);
    for (const e of db.employees) if (e.reportsTo != null) assert.ok(set.has(e.reportsTo), `${name}: ${e.id} melapor ke ${e.reportsTo} yang tidak ada`);
    const by = new Map(db.employees.map((e) => [e.id, e]));
    for (const e of db.employees) { const seen = new Set(); for (let c = e; c; c = by.get(c.reportsTo)) { assert.ok(!seen.has(c.id), `${name}: siklus di ${e.id}`); seen.add(c.id); } }
  }
});

test('INV2a tiap divisi punya tepat satu manajer AI dan leadId menunjuk dia (seed, 22 divisi)', () => {
  assert.equal(seed.divisions.length, 22);
  for (const d of seed.divisions) {
    const leads = ai(seed).filter((e) => e.divisionId === d.id && e.isLead);
    assert.equal(leads.length, 1, `divisi ${d.id}: ${leads.length} manajer AI`);
    assert.equal(d.leadId, leads[0].id, `divisi ${d.id}: leadId tidak sama dengan manajernya`);
  }
});

test('INV2b tiap divisi persis satu pemimpin (manusia tidak pernah memimpin), leadId = pemimpin itu', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    assert.deepEqual(rules.managerProblems(db), [], name);
    for (const d of db.divisions) assert.equal(db.employees.filter((e) => e.divisionId === d.id && e.isLead).length, 1, `${name}: divisi ${d.id}`);
    assert.ok(db.employees.filter((e) => e.type === 'human').every((e) => e.isLead === false && e.role === 'owner'), `${name}: manusia bukan manajer`);
  }
});

test('INV2c ruang kerja baru berisi 22 divisi, satu manajer tiap divisi', () => {
  const w = starterDb();
  assert.equal(w.divisions.length, 22);
  for (const d of w.divisions) assert.ok(w.employees.some((e) => e.id === d.leadId && e.divisionId === d.id), `divisi ${d.id} tanpa manajer`);
});

test('INV2d aturan satu manajer tetap benar setelah PATCH isLead dan hire (jalur org.js; jalur HTTP di test/migrate.test.js)', () => {
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
  const d = store.load();
  const staffer = d.employees.find((e) => e.divisionId === 'fin' && e.type === 'ai' && !e.isLead);
  const ch = { isLead: true }; org.checkRoleChange(staffer, ch); Object.assign(staffer, ch); org.settleLead(staffer, ch);
  org.hire({ name: 'Kepala Uji Invarian', divisionId: 'ops', isLead: true });
  org.hire({ name: 'Orang Uji Invarian', type: 'human', divisionId: 'exec' });
  assert.deepEqual(rules.managerProblems(d), []);
  for (const dv of d.divisions) assert.ok(d.employees.filter((e) => e.divisionId === dv.id && e.isLead).length <= 1, dv.id);
});

test('INV3a tepat satu PA per owner dan satu master per ruang kerja', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    for (const o of db.employees.filter((e) => e.type === 'human')) assert.equal(db.employees.filter((e) => e.isPA && e.ownerId === o.id).length, 1, `${name}: PA untuk ${o.id}`);
    assert.equal(db.employees.filter((e) => e.isMaster).length, 1, `${name}: jumlah master`);
  }
});

test('INV3b PA dan master bukan manajer (role) dan setara di bawah owner', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    for (const e of db.employees.filter((x) => x.isPA || x.isMaster)) { assert.notEqual(e.role, 'manager', `${name}: ${e.id}`); assert.equal(e.reportsTo, 'owner', `${name}: ${e.id} harus melapor ke owner`); }
  }
});

// ───────────────────────── 5. bentuk data ─────────────────────────
test('INV5a isLead boolean, divisionId ada di divisions, status dalam lima nilai (seed dan ruang kerja baru)', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    const divs = new Set(db.divisions.map((d) => d.id));
    for (const e of db.employees) {
      if (e.isLead !== undefined) assert.equal(typeof e.isLead, 'boolean', `${name}: isLead ${e.id}`);
      assert.ok(divs.has(e.divisionId), `${name}: ${e.id} berdivisi ${e.divisionId} yang tidak ada`);
      assert.ok(STATUSES.includes(e.status), `${name}: status ${e.id} = ${e.status}`);
    }
    for (const d of db.divisions) if (d.leadId) assert.ok(db.employees.some((e) => e.id === d.leadId), `${name}: leadId ${d.leadId}`);
  }
});

test('INV5b pemetaan status workflow ke lima nilai 3D tertutup', () => {
  assert.deepEqual(STATUS_3D, STATUSES);
  for (const x of ['jalan', 'menunggu', 'butuh_izin', 'selesai', 'gagal', 'ditolak', 'new', 'running', 'waiting', 'success', 'error', 'crashed', 'canceled', '', null, undefined, 'tidak-dikenal', 7]) assert.ok(STATUSES.includes(mapStatus(x)), String(x));
});

/** engine dimuat malas setelah seed dimuat ke folder data sementara; mengembalikan db aktif */
async function loadEngine() {
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
  const db = store.load();
  const engine = await import('../server/engine.js');
  return { db, engine };
}

test('INV5d setStatus hanya menyimpan lima nilai 3D, apa pun masukannya (P2)', async () => {
  const { db, engine } = await loadEngine();
  const e = db.employees.find((x) => x.type === 'ai' && !x.isLead);
  for (const raw of ['running', 'jalan', 'waiting', 'success', 'error', 'canceled', 'butuh_izin', 'RUNNING', 'tidak-dikenal', '', null, undefined, 42]) {
    engine.setStatus(e, raw, 'uji');
    assert.ok(STATUSES.includes(e.status), `setStatus(${raw}) menyimpan ${e.status}`);
  }
  engine.setStatus(e, 'running', 'uji'); assert.equal(e.status, 'working');
  engine.setStatus(e, 'error', 'uji'); assert.equal(e.status, 'idle');
  engine.setStatus(e, 'meeting', 'uji'); assert.equal(e.status, 'meeting');
  engine.setStatus(e, 'idle', 'uji');
});

test('INV5c kontrak data minimum 3D (id, divisionId, isLead boolean, status, statusText, currentTaskId, voiceGender, role, characterId)', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()], ['starterDb+staf', starterDb({ staffModel: true })]]) assert.deepEqual(rules.contractProblems(db), [], name);
});

// ───────────────────────── 4. satu id di semua lapisan ─────────────────────────
test('INV4a tiap agen punya tampilan 3D deterministik untuk keluarga palet yang ada', () => {
  const fams = Object.keys(MASCOT_PALETTES);
  assert.ok(fams.length >= 4);
  for (const e of ai(seed)) for (const f of fams) {
    const look = pickMascotLook(e.id, f);
    assert.ok(look && /^#[0-9a-f]{6}$/i.test(look.top), `${e.id}/${f}: tampilan tidak valid`);
    assert.deepEqual(look, pickMascotLook(e.id, f), `${e.id}/${f}: tampilan tidak deterministik`);
  }
  const src = read('public/js/assets3d.js');
  for (const id of ['kiko', 'azure', 'charcoal', 'branch']) assert.ok(src.includes(`'${id}'`), `rangka ${id} hilang dari CHIBI.ids`);
});

test('INV4b tiap staf punya role, characterId (= id) dan staffId yang ada di katalog; manajer/PA/master tanpa staffId', () => {
  const cat = rules.catalogIndex();
  for (const e of ai(seed)) {
    assert.ok(e.role && e.characterId === e.id, `${e.id}: role/characterId`);
    if (e.role === 'staff') assert.ok(e.staffId && cat.keys.has(e.staffId), `${e.id}: staffId ${e.staffId} tidak ada di katalog`);
    else assert.equal(e.staffId, null, `${e.id}: bukan staf, staffId harus kosong`);
  }
});

test('INV4b2 tiap staf punya jalur eksekusi nyata: spesifikasi siap yang jalan di mesin native (workflowId n8n hanya wajib untuk needsN8n)', async () => {
  const registry = await import('../server/staff/registry.js');
  for (const e of ai(seed).filter((x) => x.role === 'staff')) {
    const ready = registry.byEmployee(e.id).filter(registry.ready);
    assert.ok(ready.length >= 1, `${e.id}: tidak punya spesifikasi staf siap`);
    for (const sp of ready) if (sp.needsN8n === true) assert.ok(e.workflowId, `${e.id}.workflowId untuk ${sp.key} (needsN8n)`);
  }
});

test('INV4c himpunan id roster staf = katalog staf = data = 3D, tanpa katalog yatim', async () => {
  const registry = await import('../server/staff/registry.js');
  const specs = registry.all();
  const roster = new Set(ai(seed).filter((e) => !e.isPA && !e.isMaster).map((e) => e.id));
  const staff = ai(seed).filter((e) => e.role === 'staff').map((e) => e.id);
  assert.deepEqual(staff.filter((id) => !registry.byEmployee(id).length), [], 'staf tanpa spesifikasi katalog');
  assert.deepEqual(specs.filter((sp) => sp.division !== 'alat' && !roster.has(sp.employeeId)).map((sp) => sp.key), [], 'spesifikasi katalog yatim (karyawan tidak ada)');
  assert.deepEqual(registry.load().problems, [], 'katalog tanpa masalah');
});

// ───────────────────────── 6-8. mesin ─────────────────────────
const TASK_X = { id: 't-inv-p2', kind: 'task', title: 'uji', description: '' };
const namesOf = async (engine, e, t = TASK_X) => (await engine.visibleTools(e, t)).map((d) => d.name);

test('INV6a daun melihat kurang dari 8 tool, PA/master/manajer kurang dari 12', async () => {
  const { db, engine } = await loadEngine();
  const A = (f) => db.employees.find((e) => e.type === 'ai' && f(e));
  const leaves = [A((e) => !e.isLead && !e.isPA && !e.isMaster && e.divisionId === 'mkt'), A((e) => !e.isLead && !e.isPA && !e.isMaster && e.divisionId === 'design')];
  for (const leaf of leaves) { const n = await namesOf(engine, leaf); assert.ok(n.length < 8, `daun ${leaf.id} melihat ${n.length} tool: ${n}`); assert.ok(n.includes('complete_task') && n.includes('buka_alat')); }
  for (const e of [A((e) => e.isLead && !e.isMaster), A((e) => e.isMaster), A((e) => e.isPA)]) { const n = await namesOf(engine, e); assert.ok(n.length < 12, `${e.id} melihat ${n.length} tool: ${n}`); }
  // semua daun dan semua manajer di seed, bukan hanya contoh
  for (const e of db.employees.filter((x) => x.type === 'ai')) { const n = (await namesOf(engine, e)).length; assert.ok(n < (e.isPA || e.isMaster || e.isLead ? 12 : 8), `${e.id}: ${n}`); }
});

test('INV6b leadOnly, paOnly, dan specialist ditegakkan: staf tidak melihat recruit_agent; pintu buka_alat memberi kelompok sesuai peran', async () => {
  const { db, engine } = await loadEngine();
  const A = (f) => db.employees.find((e) => e.type === 'ai' && f(e));
  const leaf = A((e) => !e.isLead && !e.isPA && !e.isMaster && e.divisionId === 'mkt'), lead = A((e) => e.isLead && !e.isMaster && e.divisionId === 'mkt'), pa = A((e) => e.isPA);
  const kms = A((e) => !e.isLead && e.divisionId === 'kms');
  for (const id of ['recruit_agent', 'create_division', 'convene_meeting', 'schedule_job', 'train_colleague', 'improve_skill', 'mcp']) assert.equal(catalog.roleAllows(leaf, id), false, `daun tidak boleh ${id}`);
  assert.equal(catalog.roleAllows(lead, 'recruit_agent'), true);
  assert.equal(catalog.roleAllows(lead, 'create_division'), false, 'create_division hanya asisten pribadi');
  assert.equal(catalog.roleAllows(pa, 'create_division'), true);
  assert.equal(catalog.roleAllows(leaf, 'organize_brain'), false, 'specialist hanya divisi kms');
  assert.equal(catalog.roleAllows(kms, 'organize_brain'), true);
  // runtime: daun yang memanggil tool terlarang atau kelompok yang belum dibuka ditolak, tanpa efek
  const t = { ...TASK_X, id: 't-inv-6b' };
  for (const [name, input] of [['recruit_agent', { division_id: 'mkt', briefs: ['x'] }], ['create_division', { name: 'x', mission: 'y', icon: 'z', roles: ['a'] }], ['schedule_job', { title: 'x', instructions: 'y', assignee_id: leaf.id }]]) {
    const before = db.employees.length;
    assert.match(String(await engine.runTool(leaf, t, name, input, {})), /bukan untuk perannmu/);
    assert.equal(db.employees.length, before);
  }
  assert.match(String(await engine.runTool(leaf, t, 'write_note', { title: 'x', content: 'y' }, {})), /buka_alat/, 'write_note ada di kelompok catatan: harus dibuka dulu');
  assert.match(String(await engine.runTool(leaf, t, 'buka_alat', { kelompok: 'kelola', alasan: 'ingin merekrut orang' }, {})), /tidak ada atau bukan untuk perannmu/);
  assert.match(String(await engine.runTool(leaf, t, 'buka_alat', { kelompok: 'tim', alasan: '' }, {})), /alasan/i);
  assert.match(String(await engine.runTool(leaf, t, 'buka_alat', { kelompok: 'tim', alasan: 'perlu bertanya ke rekan desain' }, {})), /terbuka/);
  const after = await namesOf(engine, leaf, t);
  assert.ok(after.includes('ask_colleague') && after.includes('create_subtask') && !after.includes('recruit_agent'), after.join());
  // manajer: kelola terbuka, tapi create_division tetap tidak; PA: create_division terbuka
  const tl = { ...TASK_X, id: 't-inv-6b-lead' }, tp = { ...TASK_X, id: 't-inv-6b-pa' };
  await engine.runTool(lead, tl, 'buka_alat', { kelompok: 'kelola', alasan: 'perlu menjadwalkan laporan' }, {});
  await engine.runTool(pa, tp, 'buka_alat', { kelompok: 'kelola', alasan: 'perlu membentuk divisi baru' }, {});
  const ln = await namesOf(engine, lead, tl), pn = await namesOf(engine, pa, tp);
  assert.ok(ln.includes('recruit_agent') && ln.includes('schedule_job') && !ln.includes('create_division'), ln.join());
  assert.ok(pn.includes('create_division'), pn.join());
  // batas kelompok terbuka per tugas dan tugas rutin tidak boleh membuka kelompok berat
  const tr = { ...TASK_X, id: 't-inv-6b-r', kind: 'routine' };
  assert.match(String(await engine.runTool(lead, tr, 'buka_alat', { kelompok: 'kelola', alasan: 'merekrut dari rutinitas' }, {})), /rutin/);
});

test('INV7 satu gerbang pembuat tugas dengan kuota per ruang kerja; biaya n8n tercatat dan memblokir', async () => {
  const { db, engine } = await loadEngine();
  const gov = await import('../server/governor.js');
  // satu gerbang: checkCreate dipanggil dari satu tempat (engine.createTask) dan semua jalur memakai createTask
  const callers = listJs('server').filter((f) => /\bgov(ernor)?\.checkCreate\(/.test(read(f)));
  assert.deepEqual(callers, ['server/engine.js']);
  assert.equal((read('server/engine.js').match(/gov\.checkCreate\(/g) || []).length, 1);
  assert.ok(!listJs('server').some((f) => f !== 'server/engine.js' && /store\.upsert\('tasks',\s*\{\s*id:\s*(?:store\.)?uid\('t'\)/.test(read(f))), 'ada pembuat tugas yang melewati gerbang');
  assert.deepEqual(Object.keys(gov.QUOTA_DEFAULTS).sort(), ['n8nRunsPerDay', 'tasksPerDay']);
  // kuota tugas per ruang kerja (angka kecil untuk uji), berlaku untuk manusia juga
  db.settings.quota = { tasksPerDay: 2, n8nRunsPerDay: 3 };
  const mk = (title) => engine.createTask({ title, assigneeId: 'aria', createdBy: 'owner' });
  const base = gov.tasksToday();
  assert.ok(base <= 2, 'seed tidak boleh sudah memakai jatah');
  for (let i = base; i < 2; i++) mk(`Tugas kuota nomor ${i} uji berbeda`);
  assert.throws(() => mk('Tugas ketiga harus ditolak'), (err) => err instanceof gov.GovernorError && /Jatah tugas/.test(err.message));
  assert.doesNotThrow(() => gov.checkCreate({ title: 'Rutinitas pagi', createdBy: 'system', kind: 'routine' }), 'tugas rutin tidak memakan jatah');
  // eksekusi n8n: dicatat di data penggunaan, memblokir saat habis, 0 = tanpa batas
  assert.equal(gov.execUsage().runs, 0);
  gov.chargeExec(1, 'staf'); gov.chargeExec(2, 'otomasi');
  assert.equal(db.usage.exec.runs, 3);
  assert.deepEqual(db.usage.exec.byKind, { staf: 1, otomasi: 2 });
  assert.deepEqual(gov.execOverBudget(1), { limit: 3, spent: 3, unit: 'eksekusi' });
  assert.throws(() => gov.chargeExec(1, 'staf'), (err) => err instanceof gov.GovernorError && /Jatah pekerjaan otomatis/.test(err.message));
  assert.equal(db.usage.exec.runs, 3, 'yang ditolak tidak boleh tercatat');
  // sisa jatah ikut tampil di Pemandu
  const pemandu = await import('../server/pemandu.js');
  const q = pemandu.quota();
  assert.deepEqual([q.jatah.otomatis.sisa, q.jatah.otomatis.dari, q.jatah.tugas.dari], [0, 3, 2]);
  assert.equal(q.jatah.otomatis.word, 'Habis');
  db.settings.quota = { tasksPerDay: 0, n8nRunsPerDay: 0 };
  assert.equal(gov.execOverBudget(500), null, '0 berarti tanpa batas');
  assert.doesNotThrow(() => mk('Tugas tanpa batas jatah'));
});

test('INV8 tidak ada store.upsert(\'approvals\' di luar modul persetujuan; otomasi dan aksi browser tidak disetujui otomatis', async () => {
  const outside = listJs('server').filter((f) => !/\/approvals\.js$/.test(f)).filter((f) => /store\.upsert\(\s*['"]approvals['"]/.test(read(f)));
  assert.deepEqual(outside, [], `upsert approvals di luar modul: ${outside.join(', ')}`);
  assert.ok(/store\.upsert\(\s*'approvals'/.test(read('server/approvals.js')));
  const { db, engine } = await loadEngine();
  const approvals = await import('../server/approvals.js');
  const base = { title: 'Nyalakan otomasi: tes', summary: 'ringkasan', requesterId: 'aria', approverId: 'owner' };
  const card = approvals.create({ kind: 'automation', preview: ['langkah satu', 'langkah dua'], ...base });
  for (const k of ['id', 'kind', 'title', 'summary', 'preview', 'status', 'requesterId', 'approverId', 'createdAt', 'expiresAt']) assert.ok(k in card, `kartu tanpa ${k}`);
  assert.match(card.preview, /langkah satu/);
  assert.equal(card.status, 'pending');
  const br = approvals.create({ kind: 'browser_action', ...base });
  for (const kind of ['automation', 'browser_action', 'review']) assert.throws(() => approvals.recordAuto({ kind, ...base }), /tidak boleh disetujui otomatis/);
  assert.equal(approvals.autoApprovable(card), false);
  assert.equal(approvals.autoApprovable(approvals.create({ kind: 'policy', ...base })), true);
  assert.throws(() => approvals.decide(card.id, { decision: 'approve', userId: 'system-auto' }), /hanya boleh diputuskan manusia/);
  db.settings.autoApprove = true;
  engine.autoApprovePending();
  assert.equal(approvals.get(card.id).status, 'pending', 'kartu otomasi tetap menunggu manusia');
  assert.equal(approvals.get(br.id).status, 'pending', 'kartu aksi browser tetap menunggu manusia');
  const decided = approvals.decide(card.id, { decision: 'reject', userId: 'owner', feedback: 'tidak' });
  assert.deepEqual([decided.status, decided.decidedBy, decided.feedback], ['rejected', 'owner', 'tidak']);
  assert.throws(() => approvals.decide(card.id, { decision: 'approve' }), /sudah diputuskan/);
  // kedaluwarsa
  const ex = approvals.create({ kind: 'browser_action', expiresAt: Date.now() - 1000, ...base });
  assert.equal(approvals.sweep().map((x) => x.id).includes(ex.id), true);
  assert.deepEqual([approvals.get(ex.id).status, approvals.get(ex.id).expired], ['rejected', true]);
  // aturan "perlu manusia" hidup di modul persetujuan; governor hanya meneruskan
  assert.equal(approvals.needsHuman({ title: 'Publikasikan artikel', description: '' }), true);
  assert.equal(approvals.needsHuman({ title: 'Publikasikan artikel', description: '', parentId: 'x' }), false);
  assert.ok(!/HUMAN_POLICY\s*=/.test(read('server/governor.js')), 'regex kebijakan tidak boleh tersisa di governor');
});

// ───────────────────────── 9. migrasi ─────────────────────────
function lastMigrationVersion() {
  assert.ok(/db\.version\s*=\s*SCHEMA_VERSION\s*;/.test(read('server/penyimpanan/store.js')), 'migrate() harus menetapkan db.version = SCHEMA_VERSION');
  return rules.SCHEMA_VERSION;
}
const fingerprint = (db) => JSON.stringify({ v: db.version, emp: db.employees.map((e) => e.id).sort(), div: db.divisions.map((d) => d.id).sort(), notes: db.notes.map((n) => n.id).sort(), skills: db.skills.map((s) => s.id).sort(), routines: db.routines.map((r) => r.id).sort() });

test('INV9a migrasi idempoten dan tidak menghilangkan id (db lama v8 -> terbaru, dijalankan dua kali)', () => {
  const old = buildSeed(); old.version = 8;
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(old));
  const first = store.load();
  const f1 = fingerprint(first);
  const seedIds = buildSeed().employees.map((e) => e.id);
  for (const id of seedIds) assert.ok(first.employees.some((e) => e.id === id), `id ${id} hilang setelah migrasi`);
  assert.equal(first.version, lastMigrationVersion());
  const second = store.load();   // membaca ulang berkas yang sudah termigrasi
  assert.equal(fingerprint(second), f1, 'menjalankan migrasi ulang mengubah hasil');
  assert.deepEqual(second.employees.map((e) => e.id), first.employees.map((e) => e.id));
});

test('INV9b version seed dan starterDb sama dengan migrasi terakhir', () => {
  const last = lastMigrationVersion();
  assert.equal(buildSeed().version, last); assert.equal(starterDb().version, last);
});

test('INV9c migrasi berlaku untuk semua ruang kerja (loadWorkspaces)', () => {
  const dir = path.join(tmp, 'ws', 'ws-lama-tes');
  fs.mkdirSync(dir, { recursive: true });
  const old = buildSeed(); old.version = 7;
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(old));
  store.loadWorkspaces();
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('db.json.bak-v7-')), 'cadangan sebelum migrasi tidak dibuat');
  const got = store.run('ws-lama-tes', () => store.get());
  assert.equal(got.version, lastMigrationVersion(), `ruang kerja lama tetap di v${got.version}`);
});

// ───────────────────────── bendera P0 ─────────────────────────
test('BENDERA settings.staffModel default mati di seed, ruang kerja baru, dan data lama', () => {
  assert.strictEqual(seed.settings.staffModel, false);
  assert.strictEqual(starterDb().settings.staffModel, false);
  assert.equal(typeof store.staffModelOn, 'function');
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
  const d = store.load();
  assert.strictEqual(store.staffModelOn(), false);
  d.settings.staffModel = 'true';   // hanya boolean true yang menyalakan
  assert.strictEqual(store.staffModelOn(), false);
  d.settings.staffModel = true;
  assert.strictEqual(store.staffModelOn(), true);
  delete d.settings.staffModel;
  assert.strictEqual(store.staffModelOn(), false);
  assert.strictEqual(store.staffModelOn('tidak-ada'), false);
});

// ───────────────────────── 11. regex dan prompt ─────────────────────────
test('INV11a tidak ada pola /s+/ (huruf s, bukan spasi) di server dan klien', () => {
  const suspect = /\.(?:replace|replaceAll|split|match)\(\s*\/(?:s[+*]|\^s[+*]|s[+*]\$)\/[a-z]*/;
  const hits = [];
  for (const f of [...listJs('server'), ...listJs('public/js')]) read(f).split('\n').forEach((line, i) => { if (suspect.test(line)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, []);
});

test('INV11b prompt sistem tidak memuat id agen yang tidak ada, tanpa daftar semua agen dan istilah lama', async () => {
  const { db, engine } = await loadEngine();
  const ids = new Set(db.employees.map((e) => e.id));
  const divs = new Set([...db.divisions.map((d) => d.id), ...db.skills.map((s) => s.id), ...catalog.CAPABILITIES.map((c) => c.id), 'buka_alat']);   // baris "- id:" juga dipakai daftar skill, tool, dan divisi
  for (const e of db.employees.filter((x) => x.type === 'ai')) {
    const p = engine.systemPrompt(e, { id: 't-inv-11b', kind: 'task', title: 'uji', description: '' });
    // baris daftar orang: "- <id>: <nama>"
    for (const m of p.matchAll(/^- ([a-z0-9][a-z0-9_-]*): /gm)) assert.ok(ids.has(m[1]) || divs.has(m[1]), `${e.id}: prompt menyebut id yang tidak ada: ${m[1]}`);
    assert.ok(!/karyawan AI otonom/i.test(p), `${e.id}: istilah lama "karyawan AI otonom"`);
    assert.ok(!/mode simulasi/i.test(p), `${e.id}: banner simulasi`);
    assert.ok(!/Semua karyawan AI yang bisa kamu tugaskan/.test(p), `${e.id}: daftar semua agen`);
    assert.ok(/Struktur: asisten pribadi dan master → manajer divisi/.test(p), `${e.id}: struktur baru tidak ada`);
    const people = [...p.matchAll(/^- ([a-z0-9][a-z0-9_-]*): [^\n]*(?:AI|MANUSIA)\)$/gm)].length;
    assert.ok(people <= 13, `${e.id}: prompt memuat ${people} baris orang (maks 12 + ringkasan)`);
  }
  // prompt lebih pendek dari sebelum P2 (diukur di docs/MESIN-P2.md): master tidak lagi memuat 170 agen
  const master = db.employees.find((e) => e.isMaster);
  assert.ok(engine.systemPrompt(master).length < 24000, `prompt master ${engine.systemPrompt(master).length} huruf`);
});

// ───────────────────────── 12-13. antarmuka dan publik ─────────────────────────
test('INV12 kata terlarang, nama aksesibel, tanpa emoji ikon/merah, ukuran huruf dan area ketuk di semua layar pengguna', phase('P4', 'hanya pemandu-view.js yang dijaga kamus; layar lain masih penuh jargon'), () => {
  assert.fail('pemindaian seluruh layar menunggu P4');
});

test('INV13 isolasi dua pengguna, tanda tangan hook, kuota 429, n8n mati lalu pulih tanpa duplikasi', phase('P3', 'keamanan publik belum dikerjakan (hook, kuota, batas laju)'), () => {
  assert.fail('belum ada mekanisme yang bisa diuji');
});

test('INV10 status 3D mengikuti setStatus selama staff.run', () => {
  const src = read('server/staff/runner.js');
  assert.ok((src.match(/engine\.setStatus\(/g) || []).length >= 2, 'runner staf harus memakai engine.setStatus saat mulai dan selesai');
  assert.ok(/'working'/.test(src), 'status bekerja saat jalan');
  assert.ok(/mapStatus\(status\)/.test(read('server/engine.js')), 'setStatus harus lewat pemetaan tertutup');
});

// ───────────────────────── 14. mascot ─────────────────────────
test('INV14 verifikasi mascot V4.2 utuh', () => {
  const r = spawnSync(process.execPath, ['docs/mascot-v4-2/verify-v42.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `verify-v42 gagal:\n${(r.stdout || '').slice(-600)}${(r.stderr || '').slice(-300)}`);
  assert.match(r.stdout, /0 masalah/);
});

// ───────────────────────── 15. arsitektur backend satu sistem (docs/PETA-BACKEND.md) ─────────────────────────
// Dibaca dari kode, bukan dari dokumen: sumber kebenaran konfigurasi satu tempat, tidak ada modul yatim, peta dan indeks dokumen lengkap.
const serverFiles = () => listJs('server').filter((f) => !f.startsWith('server/staff/') && !f.startsWith('server/staff-catalog/'));
const stripComments = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('INV15a semua variabel lingkungan yang dibaca server terdaftar di server/config.js (satu sumber konfigurasi)', async () => {
  const config = await import('../server/config.js');
  const found = new Map();
  const res = [/\bprocess\.env\.([A-Z][A-Z0-9_]{2,})/g, /\bprocess\.env\['([A-Z][A-Z0-9_]{2,})'\]/g, /\benv\('([A-Z][A-Z0-9_]{2,})'\)/g, /\bnum\('([A-Z][A-Z0-9_]{2,})'/g, /'((?:QUOTA|RATE|MAX|GLOBAL|GATE|WS)_[A-Z0-9_]{3,})'/g];
  for (const f of serverFiles().filter((x) => x !== 'server/config.js')) {
    const src = stripComments(read(f));
    for (const re of res) for (const m of src.matchAll(re)) if (!found.has(m[1])) found.set(m[1], f);
  }
  const missing = [...found].filter(([n]) => !(n in config.ENV_KEYS) && !/_GLOBAL$/.test(n)).map(([n, f]) => `${n} (${f})`);
  assert.deepEqual(missing, [], 'daftarkan di config.ENV_KEYS');
});

test('INV15b folder data dibaca lewat config.dataDir(), bukan process.env.DATA_DIR langsung (kecuali server/staff/*)', () => {
  const hits = serverFiles().filter((f) => f !== 'server/config.js' && /process\.env\.DATA_DIR/.test(stripComments(read(f))));
  assert.deepEqual(hits, []);
});

test('INV15c config: bawaan, tipe, validasi, dan dokumentasi tiap kunci; seed.settings seluruhnya terdokumentasi', async () => {
  const config = await import('../server/config.js');
  const saved = { ...process.env };
  try {
    for (const k of Object.keys(config.ENV_KEYS)) if (k !== 'PATH') delete process.env[k];
    assert.equal(config.get('PORT'), 4317); assert.equal(config.get('HOST'), '127.0.0.1');
    assert.equal(config.get('RAIVERSE_PUBLIC_MODE'), false); assert.equal(config.get('STORE_VERIFY_EVERY'), 50);
    assert.equal(config.get('PRIVACY_TRASH_DAYS'), 7); assert.deepEqual(config.get('RAIVERSE_ADMIN_EMAILS'), []);
    assert.deepEqual(config.validate(), []);
    process.env.PORT = 'abc'; process.env.STORAGE_MODE = 'ajaib'; process.env.GOOGLE_CLIENT_ID = 'x';
    const v = config.validate().join('|');
    assert.match(v, /PORT/); assert.match(v, /STORAGE_MODE/); assert.match(v, /Login Google setengah/);
    assert.equal(config.get('PORT'), 4317, 'angka rusak memakai bawaan');
    assert.throws(() => config.get('TIDAK_ADA_INI'));
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  for (const [k, s] of Object.entries(config.ENV_KEYS)) assert.ok(s.grup && s.arti && s.tipe, `${k} tanpa grup/arti/tipe`);
  for (const [k, s] of Object.entries(config.SETTINGS)) assert.ok(s.arti && ['resmi', 'usang', 'rahasia'].includes(s.status), `${k} setting tanpa arti/status`);
  const undocumented = Object.keys(seed.settings).filter((k) => !(k in config.SETTINGS));
  assert.deepEqual(undocumented, [], 'setiap kunci seed.settings harus ada di config.SETTINGS');
  assert.ok(config.table().every((r) => !r.rahasia || r.nilai === undefined), 'tabel tidak boleh memuat nilai rahasia');
});

test('INV15d tidak ada modul server yatim: setiap berkas server (di luar staff/) diimpor modul lain atau tes', () => {
  const all = [...listJs('server'), ...listJs('test'), ...listJs('scripts')].map((f) => [f, read(f)]);
  const orphan = serverFiles().filter((f) => f !== 'server/index.js').filter((f) => {
    const base = path.basename(f, '.js');
    return !all.some(([g, src]) => g !== f && (src.includes(`/${base}.js'`) || src.includes(`/${base}'`) || src.includes(`/${base}/index.js'`)));
  });
  assert.deepEqual(orphan, []);
});

test('INV15e peta dan indeks dokumen ada dan lengkap: tiap modul server disebut di PETA-BACKEND, tiap dokumen docs/*.md ada di docs/README.md', () => {
  for (const f of ['docs/PETA-BACKEND.md', 'docs/PETA-OTAK.md', 'docs/README.md']) assert.ok(fs.existsSync(path.join(root, f)), `${f} hilang`);
  const peta = read('docs/PETA-BACKEND.md');
  const tanpaPeta = fs.readdirSync(path.join(root, 'server')).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')).filter((b) => !peta.includes(b));
  assert.deepEqual(tanpaPeta, [], 'modul belum disebut di docs/PETA-BACKEND.md');
  const idx = read('docs/README.md');
  const tanpaIndeks = fs.readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md') && f !== 'README.md' && !idx.includes(f));
  assert.deepEqual(tanpaIndeks, [], 'dokumen belum masuk docs/README.md');
  for (const f of fs.readdirSync(path.join(root, 'docs', 'arsip')).filter((x) => x.endsWith('.md'))) assert.ok(idx.includes(`arsip/${f}`), `${f} belum tercatat di tabel arsip`);
});

test('INV15f alat per peran sama dengan yang tertulis di docs/PETA-OTAK.md (dasar peran, PA/master/manajer/staf)', () => {
  const pick = (f) => seed.employees.find((e) => e.type === 'ai' && f(e));
  const staff = pick((e) => catalog.roleOf(e) === 'staff'), mgr = pick((e) => catalog.roleOf(e) === 'manager'), master = pick((e) => catalog.roleOf(e) === 'master'), pa = pick((e) => catalog.roleOf(e) === 'pa');
  const ids = (e) => new Set(catalog.coreToolIds(e));
  const BASE = ['complete_task', 'search_brain', 'web_search', 'calculate', 'request_approval'];
  for (const t of BASE) for (const e of [staff, mgr, master, pa]) assert.ok(ids(e).has(t), `${e.id} harus punya ${t}`);
  for (const t of ['create_subtask', 'ask_colleague', 'convene_meeting']) { assert.ok(!ids(staff).has(t), `staf tidak boleh punya ${t}`); for (const e of [mgr, master, pa]) assert.ok(ids(e).has(t), `${e.id} harus punya ${t}`); }
  assert.ok(ids(master).has('company_status') && ids(pa).has('company_status') && !ids(mgr).has('company_status') && !ids(staff).has('company_status'));
  for (const t of ['recruit_agent', 'create_division', 'schedule_job']) assert.ok(!ids(staff).has(t), `staf tidak boleh melihat ${t} tanpa pintu`);
  assert.ok(catalog.groupsFor(mgr).includes('kelola') && catalog.groupsFor(mgr).includes('mcp') && !catalog.groupsFor(staff).includes('kelola') && !catalog.groupsFor(staff).includes('mcp'));
  assert.ok(!catalog.roleAllows(mgr, 'create_division') && catalog.roleAllows(pa, 'create_division'), 'create_division hanya PA');
  assert.ok(/MAX_OPEN_GROUPS = 4/.test(read('server/engine.js')), 'PETA-OTAK menyebut maks 4 kelompok terbuka per tugas');
});
