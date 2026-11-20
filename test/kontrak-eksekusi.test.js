// KONTRAK EKSEKUSI (server/staff/kontrak.js): satu tes per aturan K1..K8. Tanpa kunci asli: model tiruan lokal, data sementara.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-kontrak-'));
const llm = { calls: 0, text: '', delay: 0 };
const llmSrv = http.createServer(async (req, res) => {
  let s = ''; for await (const c of req) s += c; llm.calls++;
  if (llm.delay) await new Promise((r) => setTimeout(r, llm.delay));
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: llm.text }], stop_reason: 'end_turn', usage: { input_tokens: 300, output_tokens: 100 } }));
});
await new Promise((r) => llmSrv.listen(0, '127.0.0.1', r));
Object.assign(process.env, { DATA_DIR: dataDir, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', RAY_ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmSrv.address().port}` });
delete process.env.RAIVERSE_STAFF_ENGINE;
const store = await import('../server/store.js');
fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const db = store.get();
const engine = await import('../server/engine.js');
const S = await import('../server/staff/index.js');
const { registry, runner, kontrak } = S;
const live = (on) => { process.env.ANTHROPIC_API_KEY = on ? 'kunci-uji' : ''; db.settings.provider = on ? 'claude' : undefined; };
const reset = () => { delete db.usage.staf; db.settings.staf = {}; llm.calls = 0; llm.delay = 0; runner.clearAiCache(); };

/** spesifikasi buatan (dilewatkan sebagai "kemampuan"): isian a, hasil dari `output` */
const mk = (extra = {}) => ({
  key: 'kap-uji-kontrak', division: 'kap', name: 'Uji Kontrak', title: 'Uji', ringkas: 'Uji', inputs: [{ key: 'a', label: 'Angka', type: 'text', required: true }],
  steps: [], output: { ringkas: "'Hasil uji'", teks: "'Ini hasil uji yang utuh dan bisa dibaca.'" }, ...extra,
});

test('K1/K2/K3: pemeriksa murni — bukti sah lolos; kosong, rusak, atau tanpa bukti ditolak', () => {
  const ok = kontrak.periksaHasil(mk(), { ringkas: 'Beres', teks: 'Isi yang utuh.', files: [], data: null }, {});
  assert.equal(ok.ok, true); assert.ok(ok.bukti.length >= 1);
  assert.equal(kontrak.periksaHasil(mk(), { ringkas: '', teks: 'Isi utuh', files: [] }, {}).ok, false, 'ringkasan kosong');
  assert.equal(kontrak.periksaHasil(mk(), { ringkas: 'x', teks: '', files: [] }, {}).ok, false, 'tanpa isi sama sekali');
  assert.match(kontrak.periksaHasil(mk(), { ringkas: 'Total NaN', teks: 'Total: NaN', files: [] }, {}).masalah.join(), /rusak/);
  assert.match(kontrak.periksaHasil(mk(), { ringkas: 'x', teks: 'Total: null rupiah', files: [] }, {}).masalah.join(), /rusak/);
  const withFile = mk({ output: { ringkas: "'a'", berkas: [{ nama: "'x'", jenis: 'json', isi: "'{}'" }] } });
  assert.match(kontrak.periksaHasil(withFile, { ringkas: 'a', teks: '', files: [] }, {}).masalah.join(), /dijanjikan tidak dibuat/);
  assert.match(kontrak.periksaHasil(withFile, { ringkas: 'a', teks: '', files: [{ nama: 'x.json', jenis: 'json', isi: '{rusak' }] }, {}).masalah.join(), /bukan data yang bisa dibaca/);
  assert.match(kontrak.periksaHasil(withFile, { ringkas: 'a', teks: '', files: [{ nama: 'x.csv', jenis: 'csv', isi: '   ' }] }, {}).masalah.join(), /kosong/);
  const good = kontrak.periksaHasil(withFile, { ringkas: 'a', teks: '', files: [{ nama: 'x.json', jenis: 'json', isi: '{"a":1}' }] }, {});
  assert.equal(good.ok, true); assert.equal(good.bukti[0].jenis, 'berkas');
  assert.match(kontrak.periksaData({ total: null }), /gagal dihitung/); assert.equal(kontrak.periksaData({ total: 5 }), ''); assert.equal(kontrak.periksaData({}), 'data kosong');
});

test('K4: klaim "ditulis AI" tanpa AI yang menjawab ditolak', () => {
  const r = kontrak.periksaHasil(mk(), { ringkas: 'a', teks: '## Pembahasan (ditulis AI, sudah diperiksa)\nbagus sekali' }, { pakaiAI: false });
  assert.match(r.masalah.join(), /mengaku ditulis AI/);
  assert.equal(kontrak.periksaHasil(mk(), { ringkas: 'a', teks: '## Pembahasan (ditulis AI, sudah diperiksa)\nbagus sekali' }, { pakaiAI: true }).ok, true);
});

test('K3 di pelari: hitungan gagal (angka rusak) → status gagal, pesan awam, dua jalan keluar, TIDAK ada klaim selesai', async () => {
  reset(); live(false);
  const cap = mk({ steps: [{ use: 'hitung', set: { x: 'Number(input.a) / 0 * 0' } }], output: { ringkas: "'Total ' + v.x", teks: "'Total: ' + v.x + ' rupiah'" } });
  const r = await runner.run({ capability: cap, input: { a: '5' } });
  assert.equal(r.status, 'gagal'); assert.match(r.galat, /belum bisa kuselesaikan dengan benar/); assert.equal(r.jalanKeluar.length, 2);
  assert.deepEqual(r.bukti, []); assert.equal(r.berkas.length, 0);
  assert.doesNotMatch(r.galat + JSON.stringify(r.jalanKeluar), /\b(null|NaN|error|token|JSON|API)\b/i, 'pesan awam, tanpa istilah teknis');
  const rec = S.runner.get(store.current(), r.id); assert.equal(rec.status, 'gagal', 'catatan jalan juga gagal');
});

test('K1 di pelari: jalan yang sukses membawa bukti tersimpan dan berkas yang benar-benar terbaca', async () => {
  reset(); live(false);
  const cap = mk({ output: { ringkas: "'Daftar siap'", teks: "'Lihat berkas.'", berkas: [{ nama: "'daftar'", jenis: 'csv', isi: "'nama,jumlah\\nkopi,3'" }] } });
  const r = await runner.run({ capability: cap, input: { a: '1' } });
  assert.equal(r.status, 'selesai', r.galat); assert.ok(r.bukti.some((b) => b.jenis === 'berkas')); assert.deepEqual(r.jalanKeluar, []);
  const f = runner.fileOf(store.current(), r.id, r.berkas[0].nama); assert.ok(f && f.isi.includes('kopi'));
  assert.equal(kontrak.runBukti(store.current(), r.id), true); assert.equal(kontrak.runBukti(store.current(), 'run-00000'), false);
});

test('K5: jawaban AI rusak diulang SEKALI, lalu jatuh ke versi aturan yang jujur (selesai, bukan pakai AI)', async () => {
  reset(); live(true); llm.text = 'maaf saya tidak bisa';
  const s = registry.get('data-citra');
  const r = await runner.run({ key: s.key, input: s.sample.input }); live(false);
  assert.equal(r.status, 'selesai', r.galat); assert.equal(r.pakaiAI, false); assert.equal(llm.calls, 2, 'satu panggilan + satu ulangan, tidak lebih'); assert.ok(r.bukti.length >= 1);
  assert.match(r.teks, /ringkasan aturan/);
});

test('K5: hasil bermasalah yang ikut ditulis AI → versi aturan dicoba otomatis; bila aturan pun rusak → gagal', async () => {
  reset(); live(true);
  // spesifikasi buatan dengan langkah AI: bagian aturan rusak (NaN) sehingga tetap gagal setelah AI dibuang
  llm.text = JSON.stringify({ ringkasan: 'Bagus', saran: ['a'] });
  const cap = mk({ steps: [{ use: 'hitung', set: { x: 'Number(input.a) / 0 * 0' } }, { use: 'otak', simpan: 'o', sistem: "'s'", perintah: "'p'", skema: { ringkasan: 'teks', saran: 'daftar' }, cadangan: "({ ringkasan: 'cadangan' })", maxToken: 200 }], output: { ringkas: "'Total ' + v.x", teks: "'Total: ' + v.x" } });
  const r = await runner.run({ capability: cap, input: { a: '2' } }); live(false);
  assert.equal(r.status, 'gagal'); assert.equal(r.jalanKeluar.length, 2); assert.equal(llm.calls, 1, 'AI sempat menjawab sekali');
  assert.match(S.runner.get(store.current(), r.id).catatan, /versi aturan/, 'dicatat bahwa AI dibuang lalu versi aturan dicoba');
});

test('K6: aksi berdampak butuh izin — tidak pernah "selesai" sebelum disetujui; ditolak = tidak jalan', async () => {
  reset(); live(false);
  const cap = mk({ confirm: true });
  // jalur kemampuan tidak menyimpan spesifikasi ke registri; gunakan staf asli yang ditandai butuh izin lewat penimpaan sementara
  const s = registry.get('fin-ratna'); const was = s.confirm; s.confirm = true;
  try {
    const r = await runner.run({ key: s.key, input: s.sample.input });
    assert.equal(r.status, 'butuh_izin'); assert.deepEqual(r.bukti, []); assert.equal(r.berkas.length, 0); assert.equal(kontrak.runBukti(store.current(), r.id), false, 'belum jalan = bukan bukti');
    const no = await runner.decide(store.current(), r.id, false); assert.equal(no.status, 'ditolak'); assert.equal(kontrak.runBukti(store.current(), r.id), false);
    const r2 = await runner.run({ key: s.key, input: s.sample.input }); const ok = await runner.decide(store.current(), r2.id, true);
    assert.equal(ok.status, 'selesai', ok.galat); assert.ok(ok.bukti.length >= 1);
  } finally { s.confirm = was; }
  void cap;
});

test('K7: saluran yang belum tersambung gagal jujur dengan dua jalan keluar (Google Sheets tanpa konektor)', async () => {
  reset(); live(false);
  const cap = mk({ steps: [{ use: 'tulis_sheets', spreadsheet: 'Uji', sheet: 'A', kolom: ['a'], baris: '[[input.a]]' }] });
  const r = await runner.run({ capability: cap, input: { a: '1' } });
  assert.equal(r.status, 'gagal'); assert.match(r.galat, /Google belum tersambung/); assert.equal(r.jalanKeluar.length, 2); assert.deepEqual(r.bukti, []);
});

test('K8: mesin native yang kehabisan waktu = gagal (bukan "menunggu" yang tidak pernah selesai)', async () => {
  reset(); live(true); db.settings.staf = { timeoutMs: 150 }; llm.delay = 800; llm.text = '{}';
  const s = registry.get('cs-faisal');
  const r = await runner.run({ key: s.key, input: s.sample.input }); live(false); db.settings.staf = {};
  assert.equal(r.status, 'gagal'); assert.equal(r.mesin, 'native'); assert.match(r.galat, /lebih lama/); assert.ok(r.jalanKeluar.length === 2);
  assert.notEqual(S.runner.get(store.current(), r.id).status, 'menunggu');
});

test('engine: id jalan karangan bukan bukti; id jalan nyata yang selesai berbukti dihitung sah', async () => {
  reset(); live(false);
  const s = registry.get('fin-ratna'); const run = await runner.run({ key: s.key, input: s.sample.input }); assert.equal(run.status, 'selesai');
  const lead = db.employees.find((e) => e.isLead && e.type === 'ai');
  const mkTask = (evidence) => {
    const t = engine.createTask({ title: 'Uji bukti ' + Math.random(), description: 'uji', assigneeId: lead.id, createdBy: 'owner' });
    return engine.runTool(lead, t, 'complete_task', { summary: 'Selesai', output: 'Hasil lengkap uji bukti kontrak eksekusi staf.', evidence, gaps: '' }, { finished: false, toolCalls: new Map(), evidence: [] }).then(() => t);
  };
  const fake = await mkTask(['run-deadbeef selesai dengan 3 berkas']); assert.equal(fake.unverified, true, 'id karangan tidak dihitung');
  const real = await mkTask([`${run.id} (jalan staf)`]); assert.equal(real.unverified, false, 'id nyata dihitung'); assert.equal(real.evidence[0].ok, true);
});

test('engine: hasil staf yang gagal atau menunggu izin tidak pernah dihitung sebagai bukti tool', async () => {
  reset(); live(false);
  const lead = db.employees.find((e) => e.isLead && e.type === 'ai');
  const t = engine.createTask({ title: 'Uji bukti tool', description: 'uji', assigneeId: lead.id, createdBy: 'owner' });
  const st = { finished: false, toolCalls: new Map(), evidence: ['### staf\n❌ Staf "X" belum berhasil: kosong', '### staf\n⏸ Staf "X" butuh izin Owner dulu (jalan run-abcde12).', '### staf\nDaftar staf: • a • b'] };
  await engine.runTool(lead, t, 'complete_task', { summary: 'Selesai', output: 'Hasil yang panjang cukup untuk diuji.', evidence: [], gaps: '' }, st);
  assert.equal(t.unverified, true, 'tanpa bukti tool yang sah → ditandai belum terverifikasi');
});

test.after(() => { llmSrv.close(); setTimeout(() => process.exit(0), 50).unref(); });

test('skema otak (hasil uji nyata): daftar kosong sah, daftar berisi sampah tetap ditolak, pilihan dirapikan', async () => {
  const N = await import('../server/staff/native.js');
  const skema = { pembahasan: 'teks', perlu: 'daftar', saran: 'pilihan:lanjutkan-teratas|ubah-kriteria' };
  const ok = N.checkOtak(skema, JSON.stringify({ pembahasan: 'Baik', perlu: [], saran: 'Lanjutkan teratas' }), {});
  assert.equal(ok.dariAI, true); assert.deepEqual(ok.perlu, []); assert.equal(ok.saran, 'lanjutkan-teratas');
  assert.equal(N.checkOtak(skema, JSON.stringify({ pembahasan: 'Baik', perlu: [{ x: 1 }], saran: 'ubah-kriteria' }), {}).dariAI, false, 'butir tanpa teks = rusak');
  assert.equal(N.checkOtak(skema, JSON.stringify({ pembahasan: 'Baik', perlu: [], saran: 'ngawur' }), {}).dariAI, false, 'pilihan di luar daftar ditolak');
});
