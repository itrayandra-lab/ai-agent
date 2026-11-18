import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startMockN8n } from './fixtures/mock-n8n.mjs';

// ── lingkungan terisolasi: data sementara, n8n tiruan, "Anthropic" tiruan (tanpa biaya, tanpa kunci asli)
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-agent-staff-'));
const KEY = 'test-key-123';
const mock = await startMockN8n({ key: KEY });
let llmCalls = 0, llmText = 'Pos Iklan melewati anggaran 12%. Tinjau ulang kanal berbiaya tinggi dan tahan pengeluaran tambahan.';
const llmSrv = http.createServer(async (req, res) => { let s = ''; for await (const c of req) s += c; llmCalls++; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: llmText }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 30 } })); });
await new Promise((r) => llmSrv.listen(0, '127.0.0.1', r));
Object.assign(process.env, { DATA_DIR: dataDir, N8N_URL: mock.url, N8N_API_KEY: KEY, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', RAY_ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmSrv.address().port}` });
const store = await import('../server/store.js');
fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const db = store.get();
const S = await import('../server/staff/index.js');
const { registry, runner, deployer, manager } = S;
const X = await import('../server/staff/expr.js');
const { validateSpec, normalizeInput, InputError } = await import('../server/staff/schema.js');
const { compile, NAME_PREFIX } = await import('../server/staff/blueprint.js');
const { simulate } = await import('../server/staff/simulate.js');
const { StaffError } = await import('../server/staff/hook.js');
const D = await import('../server/staff/data.js');
const roster = db.employees;
const wfCount = () => mock.state.workflows.size;
const readySpecs = () => registry.all().filter(registry.ready);
const clone = (o) => JSON.parse(JSON.stringify(o));
const emp = (id) => db.employees.find((e) => e.id === id);

// ───────────────────────── katalog & rintisan ─────────────────────────
test('katalog: setiap staf AI non-manajer punya berkas, semua valid, tidak ada masalah', () => {
  registry.reset(); const cat = registry.load({ force: true });
  assert.deepEqual(cat.problems, []);
  const staffEmps = roster.filter((e) => e.type === 'ai' && !e.isLead && !e.isMaster && !e.isPA);
  assert.ok(staffEmps.length >= 100);
  for (const e of staffEmps) { const mine = registry.byEmployee(e.id); assert.ok(mine.length >= 1, `tanpa berkas: ${e.id}`); assert.equal(mine[0].division, e.divisionId); }
  assert.equal(new Set(registry.all().map((s) => s.key)).size, registry.all().length, 'kunci unik');
  const divs = new Set(staffEmps.map((e) => e.divisionId)); assert.ok(divs.size >= 22 - 1, 'seluruh divisi tercakup');
  for (const d of divs) assert.ok(fs.existsSync(path.join(registry.catalogDir(), d, '_divisi.json')), 'manifest divisi ' + d);
});

test('validator membedakan rintisan dan spesifikasi lengkap; rintisan tidak bisa dijalankan', async () => {
  const stub = registry.get('hr-' + roster.find((e) => e.divisionId === 'hr' && !e.isLead && e.type === 'ai').id);
  assert.equal(validateSpec(stub, { roster }).kind, 'stub'); assert.equal(registry.ready(stub), false);
  assert.equal(validateSpec(registry.get('fin-ratna'), { roster }).kind, 'ready');
  await assert.rejects(runner.run({ key: stub.key, input: {} }), (e) => e instanceof StaffError && e.kind === 'belum_siap');
  const c = registry.counts(); assert.ok(c.fin.lengkap === 4 && c.mkt.lengkap >= 4 && c.cs.lengkap >= 4 && c.hr.lengkap === 0);
});

test('validator: menolak spesifikasi buruk (rahasia, istilah teknis, ekspresi berbahaya, risiko, jadwal AI, contoh hilang)', () => {
  const ok = registry.get('fin-ratna'); const bad = (mut, re) => { const s = clone(ok); mut(s); const r = validateSpec(s, { roster }); assert.equal(r.kind, 'invalid'); assert.match(r.errors.join('|'), re); };
  bad((s) => { s.key = 'Fin_Ratna'; }, /key/);
  bad((s) => { s.name = 'Alur workflow n8n untuk faktur'; }, /istilah teknis/);
  bad((s) => { s.ringkas = 'Panggil API dengan token'; }, /istilah teknis/);
  bad((s) => { s.steps[0].set.x = 'process.env.N8N_API_KEY'; }, /dilarang/);
  bad((s) => { s.steps[0].set.x = '$env.SECRET'; }, /variabel n8n/);
  bad((s) => { s.steps[0].set.x = "$('Masukan').item.json"; }, /\$\(\)/);
  bad((s) => { s.steps[0].set.x = 'while (true) {}'; }, /perulangan|dilarang/);
  bad((s) => { s.steps[0].set.x = 'Array(1e9).length'; }, /alokasi|perulangan/);
  bad((s) => { s.steps[0].set.x = 'a }} b'; }, /kurung ganda/);
  bad((s) => { s.steps[0].use = 'execute_command'; }, /use/);
  bad((s) => { s.steps[0].set = {}; }, /set/);
  bad((s) => { s.steps.push({ use: 'minta_ai', sistem: "'a'", perintah: "'b'" }, { use: 'minta_ai', sistem: "'a'", perintah: "'b'" }); }, /satu langkah/);
  bad((s) => { s.steps.push({ use: 'minta_ai', sistem: "'a'", perintah: "'b'" }); s.schedule = { allowed: true, cron: '0 8 * * 1' }; s.sample.ai = 'x'; }, /dijadwalkan/);
  bad((s) => { s.sample = undefined; }, /sample/);
  bad((s) => { s.inputs[4].choices = [{ v: 'a', t: 'Satu' }]; }, /pilihan tombol/);
  bad((s) => { s.risk = 'high'; s.confirm = false; }, /confirm/);
  bad((s) => { s.notes = 'sk-' + 'a'.repeat(24); }, /rahasia/);
  bad((s) => { s.output = { ringkas: "'x'" }; }, /teks|berkas/);
  bad((s) => { s.employeeId = 'tidak-ada'; }, /roster/);
  bad((s) => { s.division = 'mkt'; }, /key|milik divisi/);
  const w = clone(ok); w.steps.push({ use: 'tulis_sheets', sheet: 'Data', kolom: ['a'], baris: "[[input.klien]]" }); w.risk = 'low';
  assert.match(validateSpec(w, { roster }).errors.join('|'), /risk "medium"/);
});

test('pemeriksaan ulang simpul: Execute Command, berkas, Code, dan alur milik Owner ditolak', () => {
  const wf = (type, name = NAME_PREFIX + 'x') => ({ name, nodes: [{ name: 'a', type: 'n8n-nodes-base.' + type, parameters: {} }] });
  for (const t of ['executeCommand', 'readWriteFile', 'ssh', 'code', 'executeWorkflow', 'emailSend', 'function']) assert.ok(deployer.vetStaffWorkflow(wf(t)).length, t);
  assert.ok(deployer.vetStaffWorkflow(wf('set', 'Alur Owner')).length, 'nama tanpa penanda staf');
  assert.deepEqual(deployer.vetStaffWorkflow(wf('set')), []);
});

// ───────────────────────── pembangun ─────────────────────────
test('pembantu ekspresi: semua sintaks valid, CSV menetralkan rumus, angka gaya Indonesia dibaca benar', () => {
  for (const [k, v] of Object.entries(X.HELPERS)) assert.doesNotThrow(() => new Function(v + '; return 1')(), k);
  const run = (code, json = {}) => new Function('$json', `return ${code}`)(json);
  const pre = (name) => X.HELPERS[name];
  assert.equal(new Function(pre('num') + " return [num('Rp 1.500.000'), num('1.500,75'), num('2,5'), num('abc'), num('10')]")().join('|'), '1500000|1500.75|2.5|0|10');
  const csv = new Function(pre('csv') + " return csv([['=HYPERLINK(\"x\")', '+1', 'a\"b', 5, -3]])")();
  assert.equal(csv, `"'=HYPERLINK(""x"")","'+1","a""b",5,-3`);
  assert.match(new Function(pre('meta') + " return meta('<meta name=\"description\" content=\"halo dunia\">', 'description')")(), /halo dunia/);
  assert.ok(X.badExpr('v.a.map((x) => x + 1)') === '' && X.badExpr('x.constructor') && X.badExpr('this.x') && X.badExpr('import("x")'));
});

test('kompilasi: semua spesifikasi lengkap menghasilkan alur aman dan terstruktur', () => {
  for (const s of readySpecs()) {
    const b = compile(s, { token: 'tok123456789', tableId: 'T1' }); const names = b.nodes.map((n) => n.name);
    assert.equal(new Set(names).size, names.length, `nama simpul unik ${s.key}`);
    assert.deepEqual(deployer.vetStaffWorkflow({ name: NAME_PREFIX + s.key, nodes: b.nodes }), [], s.key);
    assert.ok(b.nodes.length <= 14 && JSON.stringify(b).length < 20_000, `ukuran ${s.key}`);
    assert.ok(names.includes('Terima permintaan') && names.includes('Masukan') && names.includes('Cek masukan') && names.includes('Hasil'));
    assert.match(b.path, /^rv-staf-[a-z0-9-]+-tok123456789$/);
    assert.ok(!JSON.stringify(b).includes(KEY));
    assert.equal(b.twoPhase, s.steps.some((x) => x.use === 'minta_ai'));
    for (const n of b.nodes) if (typeof n.parameters?.jsonBody === 'string') assert.ok(!/\}\}\}/.test(n.parameters.jsonBody));
  }
});

test('uji lokal (kotak pasir): setiap spesifikasi lengkap lolos dengan sample-nya, dua fase untuk langkah AI', () => {
  for (const s of readySpecs()) { const r = simulate(s); assert.ok(r.ok, `${s.key}: ${r.galat}`); assert.equal(r.hasil.tahap, 'selesai'); }
  const y = simulate(registry.get('fin-yusuf')); assert.match(y.hasil.teks, /tahan pengeluaran/);
  const noAi = simulate(registry.get('fin-yusuf'), { ai: '' }); assert.match(noAi.hasil.teks, /AI belum tersedia/);
  // serangan rumus di CSV: sel yang diawali = dinetralkan dengan tanda kutip
  const f = simulate(registry.get('fin-ratna'), { input: { ...registry.get('fin-ratna').sample.input, items: '=HYPERLINK("http://jahat")|1|100' } });
  assert.equal(f.hasil.tahap, 'selesai'); assert.match(f.hasil.berkas[0].isi, /"'=HYPERLINK/); assert.doesNotMatch(f.hasil.berkas[0].isi, /^"=HYPERLINK|,"=HYPERLINK/m);
  // isian wajib hilang → alur sendiri berhenti dengan pesan, tidak menghitung
  const miss = simulate(registry.get('fin-ratna'), { input: { klien: 'x' } }); assert.equal(miss.hasil.tahap, 'galat'); assert.match(miss.hasil.pesan, /belum lengkap/); assert.equal(miss.ok, false);
});

// ───────────────────────── isian ─────────────────────────
test('isian pengguna: dinormalkan, kunci asing dibuang, tombol dipetakan, alamat web diperiksa', async () => {
  const spec = registry.get('fin-ratna');
  const out = await normalizeInput(spec, { klien: '  PT  Maju\u0000 ', nomor: 'INV-1', tanggal: '2026-11-18', items: 'a | 1 | 1.500', ppn: 'Ya, PPN 11%', admin: 'true', __proto__: { x: 1 } });
  assert.deepEqual(Object.keys(out).sort(), ['items', 'klien', 'nomor', 'ppn', 'tanggal']); assert.equal(out.ppn, '11'); assert.equal(out.klien, 'PT  Maju');
  await assert.rejects(normalizeInput(spec, { klien: 'x' }), (e) => e instanceof InputError && /Isi dulu/.test(e.message));
  await assert.rejects(normalizeInput(spec, { ...spec.sample.input, tanggal: '18/11/2026' }), /tanggal/);
  await assert.rejects(normalizeInput(spec, { ...spec.sample.input, ppn: '99' }), /pilih salah satu/);
  const w = registry.get('fin-wening'); await assert.rejects(normalizeInput(w, { ...w.sample.input, tenaga: 'banyak' }), /angka/);
  assert.equal((await normalizeInput(w, { ...w.sample.input, tenaga: 'Rp 1.500.000' })).tenaga, 1500000);
  const d = registry.get('mkt-dimas'); await assert.rejects(normalizeInput(d, { url: 'ftp://x' }), /https/);
  await assert.rejects(normalizeInput(d, { url: 'https://x.com' }, { checkUrl: async () => ({ ok: false, reason: 'alamat lokal ditolak' }) }), /lokal/);
});

// ───────────────────────── pemasang ─────────────────────────
test('pemasang: malas, idempoten, berlabel, teruji dengan salinan yang dihapus, tidak menyentuh alur Owner', async () => {
  mock.state.workflows.set('owner1', { id: 'owner1', name: 'Alur Owner Penting', active: true, nodes: [], connections: {} });
  const before = wfCount(); const spec = registry.get('fin-ratna');
  const a = await deployer.ensure(spec, 'main');
  assert.equal(a.baru, true); assert.equal(wfCount(), before + 1, 'hanya satu alur baru (salinan uji sudah dihapus)');
  const wf = mock.state.workflows.get(a.n8nId); assert.ok(wf.name.startsWith('[RAIVERSE][staf] fin-ratna')); assert.equal(wf.active, true);
  assert.equal(wf.settings.saveDataSuccessExecution, 'none', 'isian pengguna tidak disimpan di riwayat bila sukses'); assert.ok(wf.settings.executionTimeout <= 90);
  assert.deepEqual(mock.state.workflows.get('owner1'), { id: 'owner1', name: 'Alur Owner Penting', active: true, nodes: [], connections: {} });
  const b = await deployer.ensure(spec, 'main'); assert.equal(b.baru, false); assert.equal(b.n8nId, a.n8nId); assert.equal(wfCount(), before + 1, 'tidak dobel');
  const par = await Promise.all([deployer.ensure(registry.get('fin-wening'), 'main'), deployer.ensure(registry.get('fin-wening'), 'main')]); assert.equal(par[0].n8nId, par[1].n8nId); assert.equal(wfCount(), before + 2, 'pemanggilan serentak dipasang sekali');
  assert.ok(!JSON.stringify(D.readDeploy()).includes(KEY), 'kunci tidak masuk registri');
  // perubahan spesifikasi → pembaruan di tempat (id sama), tetap hanya satu alur
  const v2 = clone(spec); v2.version = 2; v2.name = 'Pembuat faktur penjualan v2';
  const c = await deployer.ensure(v2, 'main'); assert.equal(c.n8nId, a.n8nId); assert.equal(c.baru, true); assert.equal(wfCount(), before + 2);
  assert.ok(mock.state.workflows.get(a.n8nId).name.includes('v2'));
});

test('pemasang: uji gagal membersihkan alur dan menahan percobaan ulang; rintisan ditolak', async () => {
  const bad = clone(registry.get('fin-wening')); bad.key = 'fin-wening-rusak'; bad.sample.expect = { mengandung: ['TIDAK-ADA-DI-HASIL'] };
  const before = wfCount();
  await assert.rejects(deployer.ensure(bad, 'main'), (e) => e instanceof StaffError && /Uji gagal/.test(e.message));
  assert.equal(wfCount(), before, 'alur gagal uji dihapus kembali (tidak ada sisa)');
  await assert.rejects(deployer.ensure(bad, 'main'), /sedang diperbaiki|Uji gagal/);
  await assert.rejects(deployer.ensure(registry.get('hr-' + roster.find((e) => e.divisionId === 'hr' && !e.isLead && e.type === 'ai').id), 'main'), /rintisan/);
});

test('pemasang: lepas pasang hanya alur bertanda milik kita; alur Owner yang disamarkan di registri ditolak', async () => {
  assert.equal(await deployer.retire('staf:fin-wening'), true); assert.ok(![...mock.state.workflows.values()].some((w) => w.name.includes('fin-wening')));
  D.updateDeploy((d) => { d.items['staf:palsu'] = { key: 'palsu', n8nId: 'owner1', path: 'x' }; });
  await assert.rejects(deployer.retire('staf:palsu'), (e) => e.kind === 'bukan_milik'); assert.ok(mock.state.workflows.has('owner1'), 'alur Owner tetap ada');
  D.updateDeploy((d) => { delete d.items['staf:palsu']; });
});

// ───────────────────────── pelari ─────────────────────────
test('pelari: faktur berjalan ujung ke ujung — berkas nyata, Brain, status karakter, riwayat', async () => {
  const e = emp('ratna'); const before = db.events.length;
  const r = await runner.run({ key: 'fin-ratna', input: registry.get('fin-ratna').sample.input, userId: 'owner', ws: store.current() });
  assert.equal(r.status, 'selesai', r.galat); assert.match(r.ringkas, /Rp 1\.110\.000/); assert.equal(r.berkas.length, 1);
  const f = runner.fileOf(store.current(), r.id, r.berkas[0].nama); assert.match(f.isi, /"Total"/); assert.match(f.isi, /1110000/);
  assert.equal(e.status, 'idle', 'karakter kembali siaga'); assert.equal(e.staff.terakhir.id, r.id);
  assert.ok(db.events.slice(before).some((x) => x.type === 'staff_run') && db.events.slice(before).some((x) => x.type === 'staff_done'));
  assert.ok(db.notes.some((n) => /Pembuat faktur/.test(n.title) && n.folder.startsWith('Finance')), 'hasil dicatat ke Brain');
  assert.equal(runner.list(store.current(), { staf: 'fin-ratna' })[0].id, r.id);
  assert.equal(runner.fileOf(store.current(), r.id, '../../../etc/passwd'), null);
  assert.equal(runner.get('ruang-lain', r.id), null, 'ruang kerja lain tidak melihat hasil ini');
  assert.equal(runner.fileOf('ruang-lain', r.id, r.berkas[0].nama), null);
});

test('pelari: isian kurang → penolakan sopan; galat n8n → pesan awam tanpa istilah teknis atau kunci', async () => {
  await assert.rejects(runner.run({ key: 'fin-ratna', input: { klien: 'x' } }), (e) => e instanceof InputError && /Isi dulu/.test(e.message));
  mock.state.reject = 'n8n workflow node gagal ' + KEY; mock.state.workflows.forEach((w) => { w.nodes = w.nodes.map((n) => ({ ...n, type: n.type })); });
  mock.state.reject = null;
  // pemicu galat saat jalan: ganti simpul agar melempar (tipe HTTP tidak boleh dijalankan di n8n tiruan)
  const dep = D.readDeploy().items['staf:fin-ratna']; const wf = mock.state.workflows.get(dep.n8nId); const keep = JSON.stringify(wf.nodes);
  wf.nodes.find((n) => n.name === 'Hitung faktur').type = 'n8n-nodes-base.httpRequest';
  const r = await runner.run({ key: 'fin-ratna', input: registry.get('fin-ratna').sample.input });
  wf.nodes = JSON.parse(keep);
  assert.equal(r.status, 'gagal'); assert.ok(!/n8n|workflow|\bnode\b|eyJ/i.test(r.galat) && !r.galat.includes(KEY), r.galat); assert.equal(emp('ratna').status, 'idle');
});

test('pelari: langkah AI lewat gerbang server (governor) bila AI tersedia, cadangan bila tidak', async () => {
  const spec = registry.get('fin-yusuf'); const input = spec.sample.input;
  const off = await runner.run({ key: 'fin-yusuf', input }); assert.equal(off.status, 'selesai'); assert.match(off.teks, /AI belum tersedia/); assert.equal(llmCalls, 0, 'tanpa AI: tidak ada panggilan');
  process.env.ANTHROPIC_API_KEY = 'kunci-uji'; db.settings.provider = 'claude';
  const on = await runner.run({ key: 'fin-yusuf', input }); process.env.ANTHROPIC_API_KEY = ''; db.settings.provider = undefined;
  assert.equal(on.status, 'selesai', on.galat); assert.equal(llmCalls, 1, 'tepat satu panggilan model lewat server'); assert.match(on.teks, /tahan pengeluaran/); assert.ok(on.biaya > 0, 'biaya tercatat');
  const sentToN8n = JSON.stringify(mock.state.log); assert.ok(!sentToN8n.includes('kunci-uji'), 'kunci AI tidak pernah dikirim ke mesin otomasi');
});

test('pelari: staf berdampak butuh izin; izin ditolak/diterima; kuota per jam dan serentak', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-staff-cat-')); fs.cpSync(registry.catalogDir(), dir, { recursive: true });
  const izin = clone(registry.get('fin-ratna')); Object.assign(izin, { key: 'fin-ratna-izin', name: 'Faktur yang perlu izin', risk: 'high', confirm: true, version: 1 });
  fs.writeFileSync(path.join(dir, 'fin', 'fin-ratna-izin.json'), JSON.stringify(izin));
  process.env.STAFF_CATALOG_DIR = dir; registry.reset();
  try {
    const n0 = wfCount(); const w = await runner.run({ key: 'fin-ratna-izin', input: izin.sample.input });
    assert.equal(w.status, 'butuh_izin'); assert.equal(wfCount(), n0, 'belum ada yang dipasang atau dijalankan sebelum izin'); assert.ok(!JSON.stringify(D.readRuns()).includes('"inputFull":{}'));
    const no = await runner.decide(store.current(), w.id, false); assert.equal(no.status, 'ditolak');
    const w2 = await runner.run({ key: 'fin-ratna-izin', input: izin.sample.input }); const yes = await runner.decide(store.current(), w2.id, true); assert.equal(yes.status, 'selesai', yes.galat);
    await assert.rejects(runner.decide(store.current(), w2.id, true), /tidak sedang menunggu/);
    const ok = await runner.run({ key: 'fin-ratna-izin', input: izin.sample.input, confirmed: true }); assert.equal(ok.status, 'selesai');
    // kuota
    db.settings.staf = { perHour: 1 }; await assert.rejects(runner.run({ key: 'fin-ratna', input: registry.get('fin-ratna').sample.input }), (e) => e.kind === 'batas'); db.settings.staf = undefined;
    db.settings.staf = { concurrent: 0 }; await assert.rejects(runner.run({ key: 'fin-ratna', input: registry.get('fin-ratna').sample.input }), (e) => e.kind === 'batas'); db.settings.staf = undefined;
  } finally { delete process.env.STAFF_CATALOG_DIR; registry.reset(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('pelari: hasil dibersihkan — nama berkas aman, jenis dibatasi, ukuran dibatasi', async () => {
  const name = D.cleanFileName('../../evil/<x>:y|z.sh', 'csv'); assert.match(name, /^[\p{L}\p{N} _.-]+\.csv$/u); assert.ok(!/[\\/:<>|]|\.\./.test(name), name);
  assert.equal(D.cleanFileName('x', 'exe'), 'x.txt'); assert.equal(D.cleanFileName('', 'md'), 'hasil.md'); assert.equal(D.cleanFileName('CON.', 'csv').endsWith('.csv'), true);
  // dua berkas bernama sama tidak saling menimpa; ukuran dibatasi
  const meta = D.writeFiles('uji-ws', 'run-x', [{ nama: 'a.csv', jenis: 'csv', isi: '1' }, { nama: 'a.csv', jenis: 'csv', isi: '22' }]); assert.deepEqual(meta.map((m) => m.nama), ['a.csv', 'a (2).csv']); assert.equal(D.readFile('uji-ws', 'run-x', 'a (2).csv'), '22'); D.rmRunFiles('uji-ws', 'run-x');
  assert.equal(runner.limits().maxTotalBytes, 600_000);
});

// ───────────────────────── orkestrator manajer ─────────────────────────
test('manajer: satu tool kecil, hanya staf divisinya, daftar ringkas, jalankan beberapa staf sekaligus', async () => {
  const lead = db.employees.find((e) => e.isLead && e.divisionId === 'fin'); const t = { id: 't1', createdBy: 'owner', kind: 'task' };
  const defs = await manager.toolDefs(lead, t); assert.equal(defs.length, 1); assert.equal(defs[0].name, 'staf');
  assert.equal((await manager.toolDefs(lead, { kind: 'routine' })).length, 0); assert.equal((await manager.toolDefs(lead, { transient: true })).length, 0);
  const hrLead = db.employees.find((e) => e.isLead && e.divisionId === 'hr'); assert.equal((await manager.toolDefs(hrLead, t)).length, 0, 'divisi tanpa staf siap: tool tidak muncul (tidak membebani model)');
  const prompt = manager.promptSection(lead); assert.match(prompt, /fin-ratna/); assert.ok(prompt.split('\n').filter((l) => l.startsWith('•')).length <= 8); assert.ok(!/n8n|workflow/i.test(prompt.replace(/Jangan menyebut kata[^.]*\./, '')));
  const masterP = manager.promptSection(db.employees.find((e) => e.isMaster)); assert.match(masterP, /dan \d+ lainnya/); assert.ok(masterP.split('\n').filter((l) => l.startsWith('•')).length === 8, 'prompt tidak dibanjiri: maksimal 8 baris');
  const list = await manager.call(lead, t, 'staf', { aksi: 'daftar', cari: 'faktur penjualan' }); assert.ok(list.indexOf('fin-ratna') < list.indexOf('fin-bowo') || !list.includes('fin-bowo'), list);
  assert.match(await manager.call(lead, t, 'staf', { aksi: 'lihat', staf: 'fin-ratna' }), /ppn.*wajib|ppn \(choice, wajib\)/);
  assert.match(await manager.call(lead, t, 'staf', { aksi: 'jalankan', staf: 'mkt-dimas', isian: { url: 'https://example.com' } }), /tidak ada di daftarmu/, 'tidak bisa menjalankan staf divisi lain');
  const one = await manager.call(lead, t, 'staf', { aksi: 'jalankan', staf: 'fin-ratna', isian: registry.get('fin-ratna').sample.input }); assert.match(one, /✅.*run-[0-9a-f]{10}/s); assert.match(one, /faktur-INV-2026-001\.csv/);
  assert.match(await manager.call(lead, t, 'staf', { aksi: 'jalankan', staf: 'fin-ratna', isian: { klien: 'x' } }), /Belum bisa menjalankan.*Isi dulu/);
  const many = await manager.call(lead, t, 'staf', { aksi: 'jalankan_banyak', banyak: [{ staf: 'fin-wening', isian: registry.get('fin-wening').sample.input }, { staf: 'fin-bowo', isian: registry.get('fin-bowo').sample.input }] });
  assert.equal((many.match(/✅/g) || []).length, 2, many);
  const member = emp('ratna'); assert.equal((await manager.toolDefs(member, t)).length, 1); assert.match(await manager.call(member, t, 'staf', { aksi: 'daftar' }), /fin-ratna/); assert.doesNotMatch(await manager.call(member, t, 'staf', { aksi: 'daftar' }), /fin-wening/);
  const master = db.employees.find((e) => e.isMaster); assert.match(await manager.call(master, t, 'staf', { aksi: 'daftar', divisi: 'cs', cari: 'tiket' }), /cs-wulan/);
});

test('titik sambung engine: tool "staf" terpasang dan hasil terhitung sebagai bukti nyata', async () => {
  const engineSrc = fs.readFileSync(new URL('../server/engine.js', import.meta.url), 'utf8');
  assert.match(engineSrc, /staff\.isTool\(name\)/); assert.match(engineSrc, /staff\.toolDefs\(e, t\)/); assert.match(engineSrc, /staff\.promptSection\(e\)/);
  assert.match(fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8'), /staffApi\.routes/);
});

// ───────────────────────── rute API ─────────────────────────
test('rute API: ringkasan divisi, detail + formulir awam, jalankan, hasil, berkas, izin', async () => {
  const route = (m, p) => S.routes.find(([mm, pp]) => mm === m && pp === p)[2]; const url = new URL('http://x/api/staff/runs');
  const idx = await route('GET', '/api/staff')({}, {}, url); const fin = idx.divisi.find((d) => d.id === 'fin'); assert.equal(fin.lengkap, 4); assert.ok(idx.divisi.length >= 21);
  assert.ok(emp('ratna').staff.siap.includes('fin-ratna'), 'karyawan tertaut ke staf');
  const det = await route('GET', '/api/staff/:key')({}, { key: 'fin-ratna' }); assert.equal(det.formulir.find((f) => f.kunci === 'ppn').pilihan.length, 2); assert.ok(!JSON.stringify(det).match(/Hitung faktur|webhook|steps/i));
  await assert.rejects(route('GET', '/api/staff/:key')({}, { key: 'tidak-ada-x' }), (e) => e.code === 404);
  const r = await route('POST', '/api/staff/:key/run')({ isian: registry.get('fin-ratna').sample.input }, { key: 'fin-ratna' }); assert.equal(r.status, 'selesai');
  assert.equal((await route('GET', '/api/staff/runs/:id')({}, { id: r.id })).id, r.id);
  assert.match((await route('GET', '/api/staff/runs/:id/files/:name')({}, { id: r.id, name: encodeURIComponent(r.berkas[0].nama) })).isi, /Total/);
  assert.ok((await route('GET', '/api/staff/runs')({}, {}, url)).jalan.length >= 1);
  await assert.rejects(route('POST', '/api/staff/runs/:id/izin')({ setuju: true }, { id: r.id }), (e) => e.code === 409);
  await assert.rejects(route('POST', '/api/staff/:key/run')({ isian: {} }, { key: 'fin-ratna' }), (e) => e.code === 400);
});

test('keamanan: kunci n8n tidak ada di catatan jalan, registri, atau berkas hasil; lepas pasang semua bersih', async () => {
  const dump = JSON.stringify(D.readRuns()) + JSON.stringify(D.readDeploy()) + JSON.stringify(db.events);
  assert.ok(!dump.includes(KEY));
  for (const f of fs.readdirSync(D.outDir(), { recursive: true })) { const p = path.join(D.outDir(), String(f)); if (fs.statSync(p).isFile()) assert.ok(!fs.readFileSync(p, 'utf8').includes(KEY)); }
  const n = await deployer.retireIdle({ days: -1 }); assert.ok(n >= 1);
  assert.deepEqual([...mock.state.workflows.values()].filter((w) => String(w.name).startsWith('[RAIVERSE][staf]')), [], 'tidak ada sisa alur staf');
  assert.ok(mock.state.workflows.has('owner1'));
});

test.after(async () => { mock.close?.(); llmSrv.close(); await new Promise((r) => setTimeout(r, 1200)); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* sisa penyimpanan latar belakang */ } });
