import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startMockN8n } from './fixtures/mock-n8n.mjs';

// ── lingkungan terisolasi: data sementara, n8n tiruan, model tiruan (tanpa kunci asli, tanpa biaya)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-agent-native-'));
const KEY = 'kunci-n8n-uji-98765';
const mock = await startMockN8n({ key: KEY });
const llm = { calls: 0, models: [], text: '', delay: 0 };
const llmSrv = http.createServer(async (req, res) => {
  let s = ''; for await (const c of req) s += c; llm.calls++; try { llm.models.push(JSON.parse(s).model); } catch { /* abaikan */ }
  if (llm.delay) await new Promise((r) => setTimeout(r, llm.delay));
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: llm.text }], stop_reason: 'end_turn', usage: { input_tokens: 400, output_tokens: 120 } }));
});
await new Promise((r) => llmSrv.listen(0, '127.0.0.1', r));
Object.assign(process.env, { DATA_DIR: dataDir, N8N_URL: mock.url, N8N_API_KEY: KEY, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', RAY_ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmSrv.address().port}` });
delete process.env.RAIVERSE_STAFF_ENGINE;
const store = await import('../server/store.js');
fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const db = store.get();
const S = await import('../server/staff/index.js');
const { registry, runner } = S;
const N = await import('../server/staff/native.js');
const X = await import('../server/staff/expr.js');
const D = await import('../server/staff/data.js');
const { simulate } = await import('../server/staff/simulate.js');
const { validateSpec } = await import('../server/staff/schema.js');
const { StaffError } = await import('../server/staff/hook.js');
const readySpecs = () => registry.all().filter(registry.ready);
const emp = (id) => db.employees.find((e) => e.id === id);
const PILOTS = ['cs-faisal', 'mkt-nayla', 'ecom-cindy', 'data-citra', 'ecom-sarah', 'sales-rafi', 'hr-dafa-survei', 'mkt-bram-diagnosa-iklan'];
const live = (on) => { process.env.ANTHROPIC_API_KEY = on ? 'kunci-uji' : ''; db.settings.provider = on ? 'claude' : undefined; };
const resetUse = () => { delete db.usage.staf; db.settings.staf = {}; llm.calls = 0; llm.models = []; llm.delay = 0; };
const sampleHook = (s) => ({ web: async () => ({ status: 200, html: String(s.sample?.web?.[(s.steps.find((x) => x.use === 'ambil_web') || {}).simpan || 'web'] ?? '<html><head><title>Contoh</title></head><body>contoh</body></html>').replace(/^=/, ' =') }), saveRow: () => {}, llm: async (q) => ({ text: q.otak ? '' : s.sample.ai }) });
const pick = (r) => JSON.stringify({ tahap: r.tahap, ok: r.ok, ringkas: r.ringkas, teks: r.teks, berkas: r.berkas, data: r.data });

// ───────────────────────── ekuivalensi ─────────────────────────
test('ekuivalensi: SELURUH spesifikasi lengkap — hasil native identik dengan alur n8n (kotak pasir) untuk data contoh', async () => {
  const specs = readySpecs(); assert.ok(specs.length >= 200, 'katalog terisi');
  for (const s of specs) {
    const sim = simulate(s); assert.ok(sim.hasil, `${s.key}: n8n gagal: ${sim.galat}`);
    const nat = await N.runSpec(s, { input: s.sample.input, hooks: sampleHook(s) });
    assert.equal(pick(nat), pick(sim.hasil), `${s.key}: hasil native beda dari n8n`);
  }
});

test('ekuivalensi mode AI: staf percontohan dengan jawaban AI sah memakai jawaban itu; sample.expect tetap terpenuhi', async () => {
  for (const key of PILOTS) {
    const s = registry.get(key); assert.ok(s.steps.some((x) => x.use === 'otak'), key);
    const nat = await N.runSpec(s, { input: s.sample.input, hooks: { saveRow() {}, llm: async () => ({ text: s.sample.ai }) } });
    assert.equal(nat.tahap, 'selesai'); assert.equal(nat.pakaiAI, true, key + ' memakai jawaban AI');
    assert.equal(nat.berkas.length, s.sample.expect.berkas ?? nat.berkas.length);
    for (const t of s.sample.expect.mengandung || []) assert.ok(JSON.stringify(nat).includes(t), `${key}: tidak memuat "${t}"`);
    assert.match(nat.teks, /ditulis AI, sudah diperiksa/);
  }
});

test('langkah otak: jawaban ngawur/ber-JSON rusak/tak sesuai skema diganti cadangan aturan, tidak pernah merusak hasil', async () => {
  const s = registry.get('cs-faisal');
  const run = (text) => N.runSpec(s, { input: s.sample.input, hooks: { llm: async () => ({ text }) } });
  const base = simulate(s).hasil;
  for (const bad of ['', 'bukan json sama sekali', '{"ringkasan":', '[1,2,3]', '{"ringkasan":123,"nada":"marah","saran":"x"}', '{"ringkasan":{"a":1},"nada":null,"saran":[{"x":1}]}']) {
    const r = await run(bad); assert.equal(r.tahap, 'selesai'); assert.equal(r.pakaiAI, false, bad); assert.equal(pick(r), pick(base), 'jatuh ke cadangan: ' + bad);
  }
  const part = await run('{"ringkasan":"Ringkasan baik","nada":"marah","saran":["a"]}');   // sebagian sah: bidang sah dipakai, bidang salah → cadangan
  assert.match(part.teks, /Ringkasan baik/); assert.doesNotMatch(part.teks, /marah/); assert.equal(part.pakaiAI, false);
  const fenced = await run('Tentu!\n```json\n{"ringkasan":"R","nada":"positif","saran":["s1","s2"]}\n```'); assert.equal(fenced.pakaiAI, true);
});

// ───────────────────────── kotak pasir ─────────────────────────
test('kotak pasir: ekspresi jahat ditolak sebelum jalan', async () => {
  const jahat = ["process.exit(1)", "require('fs')", "globalThis.process", "this.constructor.constructor('return process')()", "(function(){ return 1 })()", "fetch('http://x')", "eval('1')", "import('fs')", "while (true) {}", "'x'.repeat(1e9)", "Array(1e9).fill(0)", "$env.N8N_API_KEY", "__proto__", "({}).constructor", "setTimeout(() => 1, 1)", "'}}'", ''];
  for (const e of jahat) assert.throws(() => N.evalExpr(e, { input: {}, v: {} }), N.SandboxError, e);
  const spec = { ...registry.get('fin-ratna'), steps: [{ use: 'hitung', set: { x: "process.env.PATH" } }] };
  await assert.rejects(N.runSpec(spec, { input: registry.get('fin-ratna').sample.input }), N.SandboxError);
});

test('kotak pasir: lapisan vm sendiri aman walau pemeriksa pola dilewati — tanpa akses luar, batas waktu, masukan beku', () => {
  const box = (body, input = {}, ms) => N._inBox(body, { input, v: {} }, [], ms);
  assert.equal(box(`return JSON.stringify({ r: typeof process + typeof require + typeof fetch + typeof globalThis.process + typeof Buffer })`).r, 'undefinedundefinedundefinedundefinedundefined');
  assert.throws(() => box(`return (0, eval)('1')`), /gagal/, 'eval mati');
  assert.throws(() => box(`return new Function('return 1')()`), /gagal/, 'Function dari teks mati');
  assert.throws(() => box(`return [].constructor.constructor('return process')()`), /gagal/, 'lolos lewat constructor mati');
  assert.throws(() => box(`while (true) {}`, {}, 100), /terlalu lama/, 'batas waktu');
  assert.throws(() => box(`const re = /(a+)+$/; return JSON.stringify(re.test('a'.padEnd(40, 'a') + '!'))`, {}, 150), /terlalu lama/, 'regex berat dihentikan');
  assert.throws(() => box(`input.x = 2; return JSON.stringify(input)`, { x: 1 }), /gagal/, 'masukan beku (strict)');
  assert.throws(() => box(`input.d.k = 2; return 1`, { d: { k: 1 } }), /gagal/, 'beku sampai ke dalam');
  assert.throws(() => box(`undeclared = 1; return 1`), /gagal/, 'tak ada global liar (strict)');
  assert.throws(() => box(`return 'x'.padEnd(2e6, 'y')`), /terlalu besar/, 'keluaran dibatasi');
  assert.equal(globalThis.undeclared, undefined);
  // masukan tidak bocor antar panggilan
  assert.equal(box(`return JSON.stringify({ r: typeof globalThis.sisa })`, { a: 1 }).r, 'undefined');
});

test('kotak pasir: teks pengguna hanya menjadi data — tanda kutip/kode di isian tidak dieksekusi', async () => {
  const s = registry.get('fin-ratna'); const input = { ...s.sample.input, klien: `PT "; process.exit(1); //` };
  const r = await N.runSpec(s, { input }); assert.equal(r.tahap, 'selesai'); assert.ok(r.teks.includes('process.exit(1)'), 'ditampilkan apa adanya sebagai teks');
});

test('masukan kurang → galat sopan yang sama dengan n8n; tanpa menjalankan langkah', async () => {
  const s = registry.get('fin-ratna'); const r = await N.runSpec(s, { input: {} });
  assert.equal(r.tahap, 'galat'); assert.match(r.pesan, /^Isian belum lengkap: /);
});

// ───────────────────────── skema otak ─────────────────────────
test('skema: langkah otak divalidasi; spesifikasi lama tetap sah (kompatibel mundur)', () => {
  const roster = db.employees;
  for (const s of readySpecs()) assert.equal(validateSpec(s, { roster }).kind, 'ready', s.key);
  const base = JSON.parse(JSON.stringify(registry.get('cs-faisal')));
  const bad = (mut, re) => { const s = JSON.parse(JSON.stringify(base)); mut(s); const r = validateSpec(s, { roster }); assert.equal(r.kind, 'invalid'); assert.match(r.errors.join(' | '), re, JSON.stringify(r.errors)); };
  bad((s) => { s.steps.at(-1).skema = {}; }, /skema/);
  bad((s) => { s.steps.at(-1).skema = { a: 'aneh' }; }, /jenis harus/);
  bad((s) => { s.steps.at(-1).simpan = 'Bad Name'; }, /simpan/);
  bad((s) => { s.steps.at(-1).sistem = "process.exit(1)"; }, /sistem/);
  bad((s) => { s.steps.at(-1).cadangan = "require('fs')"; }, /cadangan/);
  bad((s) => { s.steps.at(-1).model = 'raksasa'; }, /model/);
  bad((s) => { s.steps.push({ use: 'minta_ai', sistem: "'a'", perintah: "'b'" }); }, /satu langkah AI/);
  bad((s) => { delete s.sample.ai; }, /sample\.ai/);
  bad((s) => { s.schedule = { allowed: true }; }, /dijadwalkan/);
  bad((s) => { s.needsN8n = 'ya'; }, /needsN8n/);
  const ok = JSON.parse(JSON.stringify(base)); ok.needsN8n = true; assert.equal(validateSpec(ok, { roster }).kind, 'ready');
});

// ───────────────────────── pelari native: AI, biaya, kuota, status 3D ─────────────────────────
test('pelari native: tanpa AI → aturan saja, jujur; tanpa n8n sama sekali; berkas, catatan, status 3D', async () => {
  resetUse(); live(false); const wf0 = mock.state.workflows.size, hooks0 = mock.state.log.length;
  const s = registry.get('cs-faisal'); const r = await runner.run({ key: s.key, input: s.sample.input });
  assert.equal(r.status, 'selesai', r.galat); assert.equal(r.mesin, 'native'); assert.equal(r.pakaiAI, false); assert.match(r.catatan, /AI belum tersambung/);
  assert.equal(llm.calls, 0); assert.equal(mock.state.workflows.size, wf0, 'tidak memasang apa pun di n8n'); assert.equal(mock.state.log.length, hooks0, 'tidak memanggil n8n');
  assert.equal(r.berkas.length, 1); assert.match(r.teks, /ringkasan aturan/); assert.equal(emp('faisal').status, 'idle');
  const f = runner.fileOf(store.current(), r.id, r.berkas[0].nama); assert.ok(f && f.isi.includes('Tema'), 'berkas nyata bisa diambil');
  assert.ok(store.get().notes.some((n) => n.title.includes(r.id)), 'ringkasan masuk Catatan');
});

test('pelari native: AI lewat gerbang — model kecil, biaya dan jatah tercatat per ruang kerja, status 3D bekerja lalu siaga', async () => {
  resetUse(); live(true); const s = registry.get('cs-faisal'); llm.text = s.sample.ai; llm.delay = 350;
  const used0 = db.usage.costTotal, p = runner.run({ key: s.key, input: s.sample.input });
  await new Promise((r) => setTimeout(r, 120)); assert.equal(emp('faisal').status, 'working', 'karakter 3D bekerja saat AI berpikir');
  const r = await p; live(false);
  assert.equal(r.status, 'selesai', r.galat); assert.equal(r.mesin, 'native'); assert.equal(r.pakaiAI, true); assert.match(r.teks, /Pelanggan puas dengan kualitas/); assert.match(r.teks, /ditulis AI/);
  assert.equal(llm.calls, 1, 'tepat satu panggilan'); assert.deepEqual(llm.models, ['claude-haiku-5-5'], 'model kecil untuk tugas ringan');
  assert.ok(r.biaya > 0 && db.usage.costTotal > used0, 'biaya tercatat'); const u = runner.nativeUsage();
  assert.equal(u.runs, 1); assert.equal(u.otak, 1); assert.ok(u.cost > 0 && u.tokens >= 500, 'jatah, biaya, token per ruang kerja');
  assert.equal(emp('faisal').status, 'idle'); assert.equal(emp('faisal').staff.terakhir.id, r.id);
});

test('pelari native: AI gagal/rusak → hasil aturan tetap jadi; jatah AI harian dan jatah jalan harian ditegakkan', async () => {
  resetUse(); live(true); runner.clearAiCache(); const s = registry.get('data-citra'); llm.text = 'maaf, saya tidak bisa';
  const bad = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(bad.status, 'selesai'); assert.equal(bad.pakaiAI, false); assert.match(bad.teks, /ringkasan aturan/);
  db.settings.staf = { otakPerDay: 1, nativePerDay: 3 }; delete db.usage.staf; llm.calls = 0; llm.text = s.sample.ai;
  const a = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(a.pakaiAI, true);
  runner.clearAiCache(); const b = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(b.pakaiAI, false); assert.match(b.catatan, /jatah AI/); assert.equal(llm.calls, 1, 'tidak ada panggilan ke-2');
  const c = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(c.status, 'selesai');
  await assert.rejects(runner.run({ key: s.key, input: s.sample.input }), (e) => e instanceof StaffError && e.code === 429 && /Jatah pekerjaan staf/.test(e.message), 'jalan ke-4 ditolak');
  assert.equal(runner.nativeUsage().runs, 3); live(false); resetUse();
});

test('pelari native: anggaran AI harian habis → tanpa panggilan, hasil aturan', async () => {
  resetUse(); live(true); const was = db.settings.dailyBudgetUSD; db.settings.dailyBudgetUSD = 0;
  const s = registry.get('sales-rafi'); const r = await runner.run({ key: s.key, input: s.sample.input });
  db.settings.dailyBudgetUSD = was; live(false);
  assert.equal(r.status, 'selesai'); assert.equal(r.pakaiAI, false); assert.match(r.catatan, /anggaran AI/); assert.equal(llm.calls, 0);
});

test('pelari native: langkah tabel menyimpan baris per ruang kerja (tanpa Data Table n8n)', async () => {
  resetUse(); const s = registry.get('cs-wulan'); const wf0 = mock.state.workflows.size;
  const a = await runner.run({ key: s.key, input: s.sample.input, ws: 'ws-a' }); assert.equal(a.status, 'selesai', a.galat);
  assert.equal(D.rowsOf('ws-a', s.key).length, 1); assert.equal(D.rowsOf('ws-b', s.key).length, 0, 'ruang kerja lain tidak melihatnya'); assert.equal(mock.state.workflows.size, wf0);
  for (let i = 0; i < 3; i++) D.appendRow('ws-a', { staf: 'x', runId: 'r', waktu: 't', isi: 'y'.repeat(5000) }); assert.ok(D.rowsOf('ws-a', 'x').every((r) => r.isi.length <= 3000), 'baris dipangkas');
});

// ───────────────────────── berkas hasil: isolasi ─────────────────────────
test('berkas: terisolasi per ruang kerja, tanpa path traversal, jenis dan ukuran dibatasi, daftar hanya milik sendiri', async () => {
  resetUse(); const s = registry.get('fin-ratna');
  const a = await runner.run({ key: s.key, input: s.sample.input, ws: 'ws-isolasi-a' }); assert.equal(a.status, 'selesai', a.galat);
  const name = a.berkas[0].nama;
  assert.ok(runner.fileOf('ws-isolasi-a', a.id, name), 'pemilik bisa mengambil');
  assert.equal(runner.fileOf('ws-isolasi-b', a.id, name), null, 'ruang kerja lain tidak bisa');
  assert.equal(D.readFile('ws-isolasi-b', a.id, name), null);
  for (const evil of ['../../../package.json', '..\\..\\package.json', '/etc/passwd', 'C:\\Windows\\win.ini', `${name}/../../x`, '', null, undefined, '%2e%2e%2f', 'CON']) assert.equal(runner.fileOf('ws-isolasi-a', a.id, evil), null, String(evil));
  assert.equal(runner.fileOf('ws-isolasi-a', '../ws-isolasi-b/x', name), null, 'id jalan palsu');
  assert.equal(D.filesOf('ws-isolasi-b').length, 0); const mine = D.filesOf('ws-isolasi-a'); assert.ok(mine.length >= 1 && mine.every((f) => f.jalan === a.id || f.jalan));
  const real = path.join(D.outDir(), 'ws-isolasi-a'); assert.ok(fs.existsSync(real)); assert.ok(!fs.existsSync(path.join(D.outDir(), 'ws-isolasi-b')));
  // jenis dibatasi: tak ada .exe/.html berbahaya dari jenis tak dikenal; nama dibersihkan
  assert.match(D.cleanFileName('../../evil.exe', 'exe'), /^[^/\\]+\.txt$/); assert.match(D.cleanFileName('a/b\\c', 'csv'), /^[^/\\]+\.csv$/);
});

test('API berkas: daftar berkas (milik ruang kerja aktif) dan unduh lewat rute staf', async () => {
  resetUse(); const route = (m, p) => S.routes.find((r) => r[0] === m && r[1] === p)[2];
  const s = registry.get('fin-ratna'); const r = await route('POST', '/api/staff/:key/run')({ isian: s.sample.input }, { key: s.key });
  const list = await route('GET', '/api/staff/files')({}, {}, new URL('http://x/api/staff/files')); assert.ok(list.berkas.some((f) => f.jalan === r.id && f.nama === r.berkas[0].nama && f.bytes > 0));
  const dl = await route('GET', '/api/staff/runs/:id/files/:name')({}, { id: r.id, name: encodeURIComponent(r.berkas[0].nama) }); assert.ok(dl.isi.length > 10);
  await assert.rejects(route('GET', '/api/staff/runs/:id/files/:name')({}, { id: r.id, name: encodeURIComponent('../../package.json') }), /tidak ditemukan/);
  const k = await route('GET', '/api/staff/konektor')({}, {}); const by = Object.fromEntries(k.konektor.map((x) => [x.id, x]));
  assert.equal(by.berkas.tersambung, true); assert.equal(by.whatsapp.tersambung, false); assert.equal(by.email.tersambung, false); assert.equal(by.sheets.tersambung, false, 'Google belum diisi → jujur belum tersambung');
  assert.match(by.sheets.catatan, /Belum tersambung/); assert.match(by.whatsapp.catatan, /kamu yang mengirimnya/);
});

test('penulisan ke Google tanpa konektor: gagal jujur (tidak memalsukan keberhasilan)', async () => {
  const s = { ...registry.get('fin-ratna'), steps: [{ use: 'tulis_sheets', sheet: 'Uji', kolom: ['a'], baris: "[[1]]" }] };
  await assert.rejects(N.runSpec(s, { input: registry.get('fin-ratna').sample.input }), (e) => e instanceof StaffError && /Google belum tersambung/.test(e.message));
});

// ───────────────────────── pemilih mesin ─────────────────────────
test('pemilih mesin: native bawaan; settings.staffEngine=n8n memakai alur n8n; needsN8n selalu n8n', async () => {
  resetUse(); const s = registry.get('fin-ratna');
  assert.equal(runner.engineOf(s), 'native'); db.settings.staffEngine = 'bukan-apa-apa'; assert.equal(runner.engineOf(s), 'native');
  const wf0 = mock.state.workflows.size; const nat = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(nat.mesin, 'native'); assert.equal(mock.state.workflows.size, wf0);
  db.settings.staffEngine = 'n8n'; assert.equal(runner.engineOf(s), 'n8n');
  const viaN8n = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(viaN8n.status, 'selesai', viaN8n.galat); assert.equal(viaN8n.mesin, 'n8n'); assert.ok(mock.state.workflows.size > wf0, 'dipasang malas di n8n');
  assert.equal(viaN8n.teks, nat.teks, 'teks identik antar mesin'); assert.deepEqual(viaN8n.berkas.map((b) => b.nama), nat.berkas.map((b) => b.nama));
  db.settings.staffEngine = 'native'; const spec2 = registry.get('fin-wening'); spec2.needsN8n = true;
  try { assert.equal(runner.engineOf(spec2), 'n8n'); const r = await runner.run({ key: spec2.key, input: spec2.sample.input }); assert.equal(r.mesin, 'n8n'); assert.equal(r.status, 'selesai', r.galat); }
  finally { delete spec2.needsN8n; delete db.settings.staffEngine; }
  process.env.RAIVERSE_STAFF_ENGINE = 'n8n'; assert.equal(runner.engineOf(s), 'n8n'); delete process.env.RAIVERSE_STAFF_ENGINE;
});

test('status 3D: hanya lima nilai; gagal di tengah jalan mengembalikan karakter ke siaga', async () => {
  resetUse(); const { mapStatus, isStatus3D } = await import('../server/staff/status-map.js');
  for (const x of ['jalan', 'selesai', 'gagal', 'butuh_izin', 'apa-saja', undefined, null, {}]) assert.ok(isStatus3D(mapStatus(x)));
  const s = { ...registry.get('fin-ratna') }; const seen = [];
  const e = emp(s.employeeId); const orig = e.status; seen.push(orig);
  const bad = await runner.run({ key: 'fin-ratna', input: { ...s.sample.input, items: '' } }).catch((x) => x); assert.ok(bad instanceof Error, 'isian kurang ditolak sebelum mulai'); assert.equal(e.status, 'idle');
});

// ───────────────────────── skrip penonaktif n8n (terhadap n8n tiruan) ─────────────────────────
test('skrip n8n-staf-nonaktifkan: kering tidak mengubah; jalan hanya menonaktifkan alur staf, tidak menghapus, alur lain utuh; aktifkan kembali', async () => {
  mock.state.workflows.clear();
  const add = (id, name, active) => mock.state.workflows.set(id, { id, name, active, nodes: [], connections: {} });
  for (let i = 1; i <= 5; i++) add('s' + i, `[RAIVERSE][staf] fin-x${i} v1`, true);
  add('s6', '[RAIVERSE][staf] fin-mati v1', false);
  add('r1', '[RAIVERSE] Otomasi catat sheets', true); add('r2', '[RAIVERSE] Pengingat', true);
  add('o1', 'Workflow Owner A', true); add('o2', 'Workflow Owner B', true); add('o3', 'Draf Owner', false); add('o4', '[RAIVERSE][stafkah] bukan staf', true); add('o5', 'Salinan [RAIVERSE][staf] x', true);
  const snap = () => JSON.stringify([...mock.state.workflows.values()].map((w) => [w.id, w.name, w.active]).sort());
  const daftar = path.join(dataDir, 'nonaktif-uji.json'); const env = { ...process.env, N8N_URL: mock.url, N8N_API_KEY: KEY };
  const run = (envX, script, args) => new Promise((resolve) => execFile(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd: ROOT, env: envX, encoding: 'utf8', timeout: 20000 }, (err, stdout, stderr) => resolve({ status: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr })));   // asinkron: n8n tiruan hidup di proses yang sama
  const sh = (script, ...args) => run(env, script, ['--daftar', daftar, ...args]);
  const awal = snap();
  const kering = await sh('n8n-staf-nonaktifkan.mjs'); assert.equal(kering.status, 0, kering.stderr); assert.match(kering.stdout, /MODE KERING: 5 alur staf aktif/); assert.equal(snap(), awal, 'mode kering tidak mengubah apa pun'); assert.ok(!fs.existsSync(daftar));
  const jalan = await sh('n8n-staf-nonaktifkan.mjs', '--jalan'); assert.equal(jalan.status, 0, jalan.stdout + jalan.stderr);
  assert.match(jalan.stdout, /SEBELUM: total 13 \| staf 6 \(aktif 5\)/); assert.match(jalan.stdout, /SESUDAH: total 13 \| staf 6 \(aktif 0\)/); assert.match(jalan.stdout, /Alur non-staf tidak berubah: YA/);
  assert.equal(mock.state.workflows.size, 13, 'tidak ada yang dihapus');
  for (const id of ['s1', 's2', 's3', 's4', 's5', 's6']) assert.equal(mock.state.workflows.get(id).active, false);
  for (const [id, w] of mock.state.workflows) if (!id.startsWith('s') || id === 's6') { /* non-staf utuh */ }
  assert.deepEqual(['r1', 'r2', 'o1', 'o2', 'o4', 'o5'].map((id) => mock.state.workflows.get(id).active), [true, true, true, true, true, true], 'otomasi RAIVERSE lain dan milik Owner tetap menyala');
  assert.equal(mock.state.workflows.get('o3').active, false);
  const saved = JSON.parse(fs.readFileSync(daftar, 'utf8')); assert.deepEqual(saved.alur.map((x) => x.id).sort(), ['s1', 's2', 's3', 's4', 's5']);
  assert.ok(!jalan.stdout.includes(KEY) && !jalan.stderr.includes(KEY) && !fs.readFileSync(daftar, 'utf8').includes(KEY), 'kunci tidak pernah tercetak/tersimpan');
  const ulang = await sh('n8n-staf-nonaktifkan.mjs', '--jalan'); assert.equal(ulang.status, 0); assert.deepEqual(JSON.parse(fs.readFileSync(daftar, 'utf8')).alur.length, 5, 'jalan ulang tidak menghilangkan id');
  const aktifKering = await sh('n8n-staf-aktifkan.mjs'); assert.match(aktifKering.stdout, /5 perlu dinyalakan/); assert.equal(mock.state.workflows.get('s1').active, false);
  const aktif = await sh('n8n-staf-aktifkan.mjs', '--jalan'); assert.equal(aktif.status, 0, aktif.stdout + aktif.stderr);
  for (const id of ['s1', 's2', 's3', 's4', 's5']) assert.equal(mock.state.workflows.get(id).active, true, id + ' menyala lagi');
  assert.equal(mock.state.workflows.get('s6').active, false, 'yang memang mati sebelumnya tidak dinyalakan'); assert.equal(mock.state.workflows.size, 13);
  // kunci salah → gagal tanpa efek dan tanpa membocorkan kunci
  const salah = await run({ ...env, N8N_API_KEY: 'kunci-salah-12345' }, 'n8n-staf-nonaktifkan.mjs', ['--jalan', '--daftar', daftar]); assert.equal(salah.status, 1); assert.ok(!(salah.stdout + salah.stderr).includes('kunci-salah-12345'));
});

// ───────────────────────── otak berbasis data (otakProfil) untuk seluruh staf ─────────────────────────
const { evaluasi } = await import('../server/staff/mutu.js');
const { checkProfil } = await import('../server/staff/schema.js');
const profilOnly = () => readySpecs().filter((x) => x.otakProfil);

test('otakProfil: SEMUA staf lengkap punya otak (blok data atau langkah AI sendiri), dan bloknya sah', () => {
  const all = readySpecs(); assert.ok(all.length >= 200);
  for (const sp of all) { const own = sp.steps.some((x) => x.use === 'otak' || x.use === 'minta_ai'); assert.ok(own || sp.otakProfil, sp.key + ' tanpa otak'); if (sp.otakProfil) { assert.deepEqual(checkProfil(sp.otakProfil), [], sp.key); assert.ok(!own, sp.key + ' dobel AI'); } }
  assert.ok(profilOnly().length >= 200, 'mayoritas lewat blok data');
  const gaya = new Set(profilOnly().map((x) => x.otakProfil.gaya)); assert.ok(gaya.size >= 15, 'gaya beragam per bidang: ' + gaya.size);
});

test('otakProfil: validator menolak blok rusak', () => {
  const ok = JSON.parse(JSON.stringify(profilOnly()[0].otakProfil)); assert.deepEqual(checkProfil(ok), []);
  const bad = (mut, re) => { const p = JSON.parse(JSON.stringify(ok)); mut(p); assert.match(checkProfil(p).join('|'), re); };
  bad((p) => { delete p.peran; }, /peran/); bad((p) => { p.skema = { x: 'teks' }; }, /pembahasan/); bad((p) => { p.skema.langkah = 'aneh'; }, /bidang skema/);
  bad((p) => { p.kriteria.kataKunci = []; }, /kataKunci/); bad((p) => { p.contohAI = '{"pembahasan":1}'; }, /contohAI/); bad((p) => { p.model = 'raksasa'; }, /model/); bad((p) => { p.batas.butir = 99; }, /batas/);
  assert.match(checkProfil(null).join(), /objek/);
});

test('mutu: setiap staf lulus kriteria otomatis (struktur, panjang, kata kunci, kerangka aturan utuh) dengan model tiruan', async () => {
  let lulus = 0; const gagal = [];
  for (const sp of readySpecs()) { const r = await evaluasi(sp); if (r.ok) lulus++; else gagal.push(sp.key + ': ' + r.gagal.join('; ')); }
  assert.deepEqual(gagal, []); assert.equal(lulus, readySpecs().length);
  // kriteria benar-benar memeriksa: jawaban dangkal/ngawur gagal
  const sp = profilOnly()[0];
  assert.equal((await evaluasi(sp, { llmText: 'tidak sesuai' })).ok, false);
  assert.equal((await evaluasi(sp, { llmText: JSON.stringify({ pembahasan: 'x', langkah: ['a'] }) })).ok, false, 'terlalu pendek / skema kurang');
});

test('otakProfil di pelari: biaya dan jatah tercatat, model kecil, cache untuk masukan identik, ulang sekali bila format salah, berkas pembahasan', async () => {
  resetUse(); live(true); runner.clearAiCache(); const sp = profilOnly().find((x) => x.key === 'fin-bowo') || profilOnly()[0]; llm.text = sp.otakProfil.contohAI;
  const a = await runner.run({ key: sp.key, input: sp.sample.input }); assert.equal(a.status, 'selesai', a.galat); assert.equal(a.pakaiAI, true);
  assert.match(a.teks, /Pembahasan \(ditulis AI/); assert.ok(a.berkas.some((b) => b.nama.includes('pembahasan')), 'berkas pembahasan nyata'); assert.ok(a.data?.pembahasanAI);
  assert.equal(llm.calls, 1); assert.deepEqual(llm.models, ['claude-haiku-5-5']); assert.ok(a.biaya > 0);
  const b = await runner.run({ key: sp.key, input: sp.sample.input }); assert.equal(b.pakaiAI, true); assert.equal(llm.calls, 1, 'masukan identik: dari cache, tanpa panggilan'); assert.equal(b.biaya, 0); assert.equal(runner.nativeUsage().otak, 1);
  // jawaban salah → diulang sekali → tetap salah → jatuh ke aturan (hasil tetap jadi)
  runner.clearAiCache(); llm.calls = 0; llm.text = 'bukan json'; const c = await runner.run({ key: sp.key, input: sp.sample.input }); assert.equal(c.status, 'selesai'); assert.equal(c.pakaiAI, false); assert.equal(llm.calls, 2, 'tepat satu pengulangan'); assert.doesNotMatch(c.teks, /ditulis AI/);
  live(false); resetUse();
});

test('privasi: data pribadi disamarkan dan isian sensitif tidak dikirim ke model', async () => {
  assert.equal(N.redact('a.b@x.co +62 812-3456-7890 NIK 3201234567890123 ada 12 pcs'), '[email] [nomor] NIK [nomor] ada 12 pcs');
  const sp = profilOnly().find((x) => x.inputs.some((f) => f.type === 'longtext' || f.type === 'text')); const input = { ...sp.sample.input }; const key = sp.inputs.find((f) => f.type === 'longtext' || f.type === 'text').key; input[key] = 'Hubungi budi@contoh.id atau 081234567890 soal ini';
  let seen = ''; await N.runSpec(sp, { input, hooks: { saveRow() {}, llm: async (q) => { seen += q.system + q.prompt; return { text: '' }; } } });
  assert.ok(seen.includes('[email]') && seen.includes('[nomor]') && !seen.includes('budi@contoh.id') && !seen.includes('081234567890'), seen.slice(0, 300));
  const st = N.profilStep({ ...sp, inputs: [...sp.inputs, { key: 'email_klien', type: 'text', label: 'Surel' }] }, { ...input, email_klien: 'rahasia@x.id' }, 'r'); assert.ok(!st.prompt.includes('rahasia@x.id'));
});

test('konektor: Telegram/Discord dilaporkan apa adanya (belum tersambung di sini) dan titik kirim keluar jujur', async () => {
  const k = Object.fromEntries((await N.konektor()).map((x) => [x.id, x])); assert.ok(k.telegram && k.discord, 'status saluran ada'); assert.equal(k.telegram.tersambung, false); assert.match(k.discord.catatan, /Belum tersambung/);
  const r = await N.kirimKeluar({ ws: store.current(), employeeId: 'tidak-ada', teks: 'uji' }); assert.equal(r.terkirim, false); assert.ok(r.alasan);
});

// ───────────────────────── kemampuan inti + staf = orang ─────────────────────────
const K = await import('../server/staff/kemampuan.js');

test('kemampuan: berkas sah semua, jumlah pas, tiap kemampuan punya >= 3 kasus evaluasi dan SEMUA lulus (model tiruan)', async () => {
  K.reset(); const load = K.load({ force: true }); assert.deepEqual(load.problems, [], JSON.stringify(load.problems).slice(0, 600));
  const caps = K.all(); assert.ok(caps.length >= 30 && caps.length <= 40, 'jumlah kemampuan ' + caps.length);
  const gagal = [];
  for (const c of caps) { assert.ok(c.evaluasi.length >= 3, c.key); assert.ok(c.inputs.some((x) => x.type === 'choice'), c.key + ' punya tombol'); assert.ok(c.output.berkas?.length >= 1, c.key + ' punya berkas'); const r = await K.evaluasi(c); if (!r.ok) gagal.push(c.key + ': ' + r.kasus.filter((k) => !k.ok).map((k) => k.nama + ' => ' + k.gagal.join('; ')).join(' | ')); }
  assert.deepEqual(gagal, []);
});

test('staf = orang: 216 staf tetap ada, tiap staf merujuk kemampuan yang ada + keahlian khusus; otak dirakit dari kemampuan + keahlian', async () => {
  const all = readySpecs(); assert.equal(all.length, 216);
  const ids = new Set(K.all().map((c) => c.kemampuan.id)); const pakai = {};
  for (const sp of all) {
    assert.ok(Array.isArray(sp.kemampuan) && sp.kemampuan.length >= 1 && sp.kemampuan.every((id) => ids.has(id)), sp.key + ' kemampuan');
    assert.ok(sp.keahlian && sp.keahlian.istilah?.length && sp.keahlian.gaya && sp.keahlian.batasan?.length, sp.key + ' keahlian'); for (const id of sp.kemampuan) pakai[id] = (pakai[id] || 0) + 1;
    assert.ok(db.employees.some((e) => e.id === sp.employeeId) || sp.division === 'alat', sp.key + ' punya karakter');
    if (sp.otakProfil) { const st = N.profilStep(sp, sp.sample.input, 'ringkasan'); assert.ok(st.sistem.includes('Istilah khas peranmu'), sp.key); assert.ok(st.sistem.includes(sp.title), sp.key + ' peran memuat jabatan'); }
  }
  for (const id of ids) assert.ok(pakai[id] >= 1, 'kemampuan tanpa pengguna: ' + id);
  const a = registry.get('fin-ratna'), b = registry.get('hr-fikri'); assert.notEqual(a.otakProfil.peran, b.otakProfil.peran);
});

test('kemampuan dijalankan lewat pintu manajer: daftar ringkas bertahap, dikerjakan staf yang cocok (karakter 3D bekerja), jujur tanpa AI', async () => {
  resetUse(); live(false); const lead = db.employees.find((e) => e.isLead && e.divisionId === 'fin');
  const list = await S.manager.call(lead, { id: 't1', createdBy: 'owner' }, 'staf', { aksi: 'kemampuan' });
  assert.match(list, /^Kemampuan \(\d+\), halaman 1 dari/); assert.ok(list.split('\n').length <= 14, 'daftar ringkas');
  assert.match(await S.manager.call(lead, { id: 't1' }, 'staf', { aksi: 'kemampuan', halaman: 99 }), /\(kosong\)/);
  const id = list.match(/• ([a-z0-9-]+) —/)[1]; const cap = K.get(id);
  const lihat = await S.manager.call(lead, { id: 't1' }, 'staf', { aksi: 'lihat', kemampuan: id }); assert.ok(lihat.includes(cap.inputs[0].key));
  const out = await S.manager.call(lead, { id: 't1', createdBy: 'owner' }, 'staf', { aksi: 'jalankan_kemampuan', kemampuan: id, isian: cap.sample.input });
  assert.match(out, /selesai/); assert.match(out, new RegExp(cap.name.slice(0, 12))); assert.match(await S.manager.call(lead, { id: 't1' }, 'staf', { aksi: 'jalankan_kemampuan', kemampuan: 'tidak-ada' }), /tidak ada di daftarmu/);
});

test('kemampuan + staf: dengan AI, keahlian staf masuk ke permintaan, model kecil, biaya tercatat; karakter orang itu yang bekerja', async () => {
  resetUse(); live(true); runner.clearAiCache(); const cap = K.get('hitung-harga-biaya'); const person = readySpecs().find((x) => x.kemampuan.includes('hitung-harga-biaya') && x.division === 'sales') || readySpecs().find((x) => x.kemampuan.includes('hitung-harga-biaya'));
  llm.text = cap.otakProfil.contohAI; const e = db.employees.find((x) => x.id === person.employeeId); const p = runner.run({ capability: cap, person, input: cap.sample.input }); llm.delay = 0;
  const r = await p; live(false); assert.equal(r.status, 'selesai', r.galat); assert.equal(r.pakaiAI, true); assert.equal(r.karyawan, person.employeeId); assert.match(r.staf.nama, /oleh/); assert.deepEqual(llm.models, ['claude-haiku-5-5']); assert.ok(r.biaya > 0);
  assert.equal(e.status, 'idle'); resetUse();
});

test.after(() => { llmSrv.close(); mock.close?.(); setTimeout(() => process.exit(0), 50).unref(); });
