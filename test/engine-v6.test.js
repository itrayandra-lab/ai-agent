import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-agent-v6-'));
process.env.DATA_DIR = dataDir;

const seedMod = await import('../server/seed.js');
const catalog = await import('../server/catalog.js');
const seed = seedMod.buildSeed();
seed.version = 5;
for (const e of seed.employees.filter((x) => x.type === 'ai')) {
  e.tools = ['complete_task'];
  e.skillRefs = (e.skillRefs || []).slice(0, 1);
}
seed.routines.push(
  { id: 'duplicate-a', employeeId: 'pustaka', title: 'Self-Learning update', description: 'knowledge update', cron: '*/5 * * * *', everyMinutes: 0, enabled: true },
  { id: 'duplicate-b', employeeId: 'pustaka', title: 'Knowledge update', description: 'self learning', everyMinutes: 5, enabled: true },
);
seed.tasks.push({ id: 'repair-me', title: 'Audit', assigneeId: 'pustaka', status: 'blocked', failures: 3, log: [{ type: 'error', text: 'Error: Agen berhenti tanpa menyelesaikan tugas' }] });
fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(seed));

const store = await import('../server/store.js');
const db = store.load();
const engine = await import('../server/engine.js');
const collab = await import('../server/collab.js');

test('v6 grants every AI employee every tool and skill', () => {
  for (const e of db.employees.filter((x) => x.type === 'ai')) {
    assert.deepEqual(new Set(e.tools), new Set(catalog.CAP_IDS));
    assert.equal(e.skillRefs.length, db.skills.length);
  }
});

test('v8 replaces five-minute self-learning bursts with one efficient daily job', () => {
  const active = db.routines.filter((r) => r.enabled && (/self.?learning|knowledge update/i.test(`${r.title} ${r.description}`)) && (r.cron === '*/5 * * * *' || Number(r.everyMinutes) === 5));
  assert.equal(active.length, 0);
  const daily = db.routines.filter((r) => r.enabled && /self.?learning|knowledge update/i.test(`${r.title} ${r.description}`));
  assert.equal(daily.length, 1);
  assert.equal(daily[0].cron, '30 18 * * 1-5');
});

test('v6 retries tasks blocked by the repaired completion bug', () => {
  const task = db.tasks.find((t) => t.id === 'repair-me');
  assert.equal(task.status, 'todo');
  assert.equal(task.failures, 0);
});

test('v7 resolves an all-agent routine through division orchestrators', () => {
  const targets = engine.routineTargets({ targetType: 'all' });
  assert.ok(targets.length > 1);
  assert.ok(targets.length <= db.divisions.length);
  assert.ok(targets.every((e) => e.type === 'ai'));
});

test('v7 broadcasts an owner action to all divisions without 154 direct model calls', async () => {
  const before = db.tasks.length;
  const msg = engine.postMessage('general', 'owner', '@all lakukan audit pengujian routing massal');
  await engine.onHumanMessage(msg);
  const made = db.tasks.slice(before);
  assert.ok(made.some((t) => t.kind === 'goal'));
  assert.ok(made.length <= db.divisions.length + 1);
  assert.ok(made.filter((t) => t.parentId).every((t) => t.massMode === true));
  assert.equal(db.messages.find((m) => m.id === msg.id).deliveredTo, db.employees.filter((e) => e.type === 'ai').length);
});

test('v7 auto-approves pending work and completes its task', () => {
  const task = engine.createTask({ title: 'Auto approval test', assigneeId: 'pustaka', createdBy: 'owner' });
  task.status = 'review'; task.output = 'Hasil pengujian auto approve lengkap.'; task.summary = 'Auto approve test';
  store.upsert('tasks', task);
  store.upsert('approvals', { id: 'approval-test', taskId: task.id, requesterId: 'pustaka', approverId: 'owner', title: task.title, summary: task.summary, status: 'pending', createdAt: Date.now() });
  assert.equal(engine.autoApprovePending(), 1);
  assert.equal(task.status, 'done');
  assert.equal(db.approvals.find((a) => a.id === 'approval-test').status, 'approved');
});

test('v8 creates one staggered real-execution routine for every division', () => {
  const jobs = db.routines.filter((r) => r.id.startsWith('r-execute-'));
  assert.equal(jobs.length, db.divisions.length);
  assert.ok(jobs.every((r) => r.enabled && r.targetType === 'division' && /^\d+ \d+ \* \* 1-5$/.test(r.cron)));
  assert.ok(new Set(jobs.map((r) => r.cron)).size > 10);
});

test('v8 owner-led meeting remains silent until owner explicitly finishes', () => {
  const m = store.upsert('meetings', { id: 'mtg-owner-test', ownerId: 'owner', status: 'waiting_owner', participants: ['aria'] });
  store.upsert('channels', { id: 'mtg-mtg-owner-test', kind: 'meeting', meetingId: m.id, members: ['owner', 'aria'] });
  assert.equal(collab.handleOwnerMeetingMessage({ channelId: 'mtg-mtg-owner-test', authorId: 'owner', text: 'saya masih berbicara, belum selesai' }), true);
  assert.equal(m.ownerFinishedAt, undefined);
  assert.equal(collab.handleOwnerMeetingMessage({ channelId: 'mtg-mtg-owner-test', authorId: 'owner', text: '/selesai' }), true);
  assert.ok(m.ownerFinishedAt);
});

test('v8 refuses to claim Google execution without a configured receipt connector', async () => {
  await assert.rejects(() => collab.googleWorkspaceCall('drive.create', { name: 'x', content: 'y' }), /Konektor Google belum aktif/);
});

test.after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 700));
  fs.rmSync(dataDir, { recursive: true, force: true });
});
