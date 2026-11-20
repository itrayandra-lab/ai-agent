// Hapus banyak hasil: per item, dalam ruang kerja ini, yang berjalan/menunggu izin dilewati, anggota hanya miliknya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-hapus-'));
process.env.DATA_DIR = tmp; process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
test.after(async () => { await new Promise((r) => setTimeout(r, 1500)); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara */ } });
const { buildSeed } = await import('../server/seed.js');
const store = await import('../server/penyimpanan/store.js');
fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
const db = store.load();
const { hapusBanyak, MAKS } = await import('../server/hapus-banyak.js');
const approvals = await import('../server/approvals.js');

const T = (id, status, extra = {}) => { const t = { id, title: 'Tugas ' + id, status, createdBy: 'owner', createdAt: Date.now(), log: [], ...extra }; db.tasks.push(t); return t; };

test('hapus banyak: selesai/tertahan/batal terhapus, berjalan/antre/menunggu izin dilewati dengan alasan', () => {
  T('h1', 'done'); T('h2', 'blocked'); T('h3', 'cancelled'); T('h4', 'in_progress'); T('h5', 'todo'); T('h6', 'done'); T('h7', 'review');
  const apv = approvals.create({ kind: 'review', title: 'x', requesterId: 'aria', taskId: 'h6' });
  T('h1a', 'done', { parentId: 'h1' });
  const r = hapusBanyak(['h1a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'tidak-ada', 'h1'], { aktor: 'owner', bolehSemua: true });
  assert.deepEqual(r.dihapus.sort(), ['h1', 'h2', 'h3']);
  const alasan = Object.fromEntries(r.dilewati.map((x) => [x.id, x.alasan]));
  assert.match(alasan.h4, /berjalan/); assert.match(alasan.h5, /antre/); assert.match(alasan.h6, /persetujuan/); assert.match(alasan.h7, /berjalan|antre/);
  assert.match(alasan.h1a, /bagian/); assert.match(alasan['tidak-ada'], /tidak ditemukan/);
  assert.equal(db.tasks.some((t) => ['h1', 'h2', 'h3'].includes(t.id)), false); assert.equal(db.tasks.some((t) => t.id === 'h1a'), false, 'anak ikut terhapus bersama induknya');
  assert.ok(db.tasks.some((t) => t.id === 'h4') && db.tasks.some((t) => t.id === 'h6'));
  assert.ok(approvals.get(apv.id), 'kartu persetujuan yang masih menunggu tidak ikut terhapus');
});

test('hapus banyak: anggota biasa hanya miliknya; masukan aneh dan batas jumlah aman', () => {
  T('m1', 'done', { createdBy: 'orang-lain' }); T('m2', 'done', { createdBy: 'aku' });
  const r = hapusBanyak(['m1', 'm2'], { aktor: 'aku', bolehSemua: false });
  assert.deepEqual(r.dihapus, ['m2']); assert.match(r.dilewati[0].alasan, /bukan milikmu/);
  assert.deepEqual(hapusBanyak(null, { aktor: 'x' }), { dihapus: [], dilewati: [] });
  assert.deepEqual(hapusBanyak([1, {}, null, 'x'.repeat(200)], { aktor: 'x' }), { dihapus: [], dilewati: [] });
  const banyak = Array.from({ length: MAKS + 50 }, (_, i) => 'zz' + i);
  assert.equal(hapusBanyak(banyak, { aktor: 'x' }).dilewati.length, MAKS, 'dibatasi MAKS per permintaan');
});

test('rute hapus banyak terpasang dengan izin taskDelete dan memakai modul yang diuji', () => {
  const idx = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(idx, /on\('POST', '\/api\/tasks\/hapus-banyak'/); assert.match(idx, /p === '\/api\/tasks\/hapus-banyak'\) \? 'taskDelete'/); assert.match(idx, /hapusBanyak\(b\.ids/);
});
