// Pilihan izin tiga kata: Tanya dulu (ask) | Lanjut sendiri (auto) | Serahkan penuh (full, hanya pengelola ruang kerja).
// Otomasi dan aksi browser TIDAK PERNAH disetujui otomatis, bahkan pada "full"; kartu review hanya ikut pada "full".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-izin-'));
process.env.DATA_DIR = tmp; process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
test.after(async () => { await new Promise((r) => setTimeout(r, 1500)); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara */ } });
const { buildSeed } = await import('../server/seed.js');
const store = await import('../server/store.js');
fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
const db = store.load();
const approvals = await import('../server/approvals.js');
const base = { title: 'uji', summary: 's', requesterId: 'aria', approverId: 'owner' };

test('izin: review hanya otomatis pada "full"; otomasi dan aksi browser tidak pernah', () => {
  const rv = approvals.create({ kind: 'review', ...base }), au = approvals.create({ kind: 'automation', ...base }), br = approvals.create({ kind: 'browser_action', ...base }), po = approvals.create({ kind: 'policy', ...base });
  for (const p of ['ask', 'auto']) { db.settings.permission = p; assert.equal(approvals.autoApprovable(rv), false, p); assert.equal(approvals.autoApprovable(po), true, p); }
  db.settings.permission = 'full';
  assert.equal(approvals.autoApprovable(rv), true);
  assert.equal(approvals.autoApprovable(au), false); assert.equal(approvals.autoApprovable(br), false);
  assert.throws(() => approvals.decide(au.id, { decision: 'approve', userId: 'system-auto' }), /hanya boleh diputuskan manusia/);
  assert.equal(approvals.decide(rv.id, { decision: 'approve', userId: 'system-auto' }).status, 'approved');
});
