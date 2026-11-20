// Kesehatan otak: angka dari catatan jalan staf (sukses per kemampuan/divisi, galat terbanyak, macet). Tanpa model asli, tanpa memulai uji berbayar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-kesehatan-'));
Object.assign(process.env, { DATA_DIR: dataDir, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '' });
const store = await import('../server/store.js');
fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify((await import('../server/seed.js')).buildSeed()));
store.load();
const S = await import('../server/staff/index.js');
const D = await import('../server/staff/data.js');
const K = await import('../server/staff/kesehatan.js');
const { runner, registry } = S;

test('kesehatan: data kosong tetap utuh (tidak ada pembagian nol)', () => {
  const s = K.status();
  assert.equal(s.ringkasan.total, 0); assert.equal(s.ringkasan.tingkat, null); assert.deepEqual(s.perKemampuan, []); assert.deepEqual(s.macet, []); assert.equal(s.ujiTerakhir, null); assert.equal(s.uji.jalan, false);
});

test('kesehatan: sukses dan gagal dihitung per kemampuan dan divisi; galat serupa menyatu; yang macet muncul', async () => {
  const sp = registry.get('fin-ratna');
  for (let i = 0; i < 3; i++) assert.equal((await runner.run({ key: sp.key, input: sp.sample.input })).status, 'selesai');
  const ws = store.current(), now = Date.now();
  for (let i = 0; i < 2; i++) D.saveRun({ id: 'run-gagal' + i, ws, staf: 'kap-hitung-sdm', nama: 'x', employeeId: 'sari', status: 'gagal', galat: `Halaman ${i} tidak bisa dibuka`, startedAt: now - 1000, ms: 500, biaya: 0 });
  D.saveRun({ id: 'run-macet1', ws, staf: 'kap-hitung-sdm', nama: 'x', employeeId: 'sari', status: 'jalan', startedAt: now - 30 * 60e3 });
  const s = K.status();
  assert.equal(s.ringkasan.total, 6); assert.equal(s.ringkasan.sukses, 3); assert.equal(s.ringkasan.gagal, 2); assert.equal(s.ringkasan.tingkat, 60);
  const fin = s.perKemampuan.find((x) => x.kemampuan === 'fin-ratna'); assert.equal(fin.tingkat, 100); assert.ok(fin.msRata >= 0);
  const sdm = s.perKemampuan.find((x) => x.kemampuan === 'hitung-sdm'); assert.equal(sdm.tingkat, 0, 'prefiks kap- dibuang dari nama');
  assert.equal(s.galatTerbanyak.length, 1, 'galat serupa disatukan'); assert.equal(s.galatTerbanyak[0].jumlah, 2);
  assert.ok(s.perDivisi.some((x) => x.divisi === 'sari' || x.nama), 'ada pengelompokan divisi');
  assert.ok(s.macet.some((m) => m.id === 'run-macet1' && m.menit >= 29), 'pekerjaan macet terdeteksi');
});

test('kesehatan: hasil uji terakhir dibaca dari data/uji-nyata/hasil.json tanpa rahasia', () => {
  fs.mkdirSync(path.join(dataDir, 'uji-nyata'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'uji-nyata', 'hasil.json'), JSON.stringify({ selesai: '2026-11-19T00:00:00Z', biayaTotal: 0.02, panggilanTotal: 100, ringkasan: { kemampuan: { total: 31, kemampuanLulusSemua: 30 } }, perDivisi: { fin: { total: 2, lulus: 2, biaya: 0.01, msRata: 900 } }, model: 'openai/gpt-oss-20b' }));
  const u = K.status().ujiTerakhir; assert.equal(u.biaya, 0.02); assert.equal(u.perDivisi.fin.lulus, 2);
  assert.doesNotMatch(JSON.stringify(K.status()), /gsk_|sk-ant|Bearer/);
});

test('kesehatan: batas biaya uji ulang dijepit ke maksimum', () => {
  assert.equal(K.MAKS_BATAS_USD, 0.3);
});

test.after(() => setTimeout(() => process.exit(0), 50).unref());
