// Autonomous work engine: schedules tasks, runs agents (Claude or simulation), delegation, approvals, routines, chat.
import * as store from './store.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
import { CAPABILITIES, CAP_IDS, autoActivate } from './catalog.js';
import * as lib from './librarian.js';
import * as collab from './collab.js';
import * as gov from './governor.js';
import * as org from './org.js';
llm.setTaskCostHook(gov.addCost);

const { uid } = store;
const db = () => store.get();
const emp = (id) => db().employees.find((e) => e.id === id);
const div = (id) => db().divisions.find((d) => d.id === id);
const task = (id) => db().tasks.find((t) => t.id === id);
const children = (t) => db().tasks.filter((c) => c.parentId === t.id);
const OPEN = new Set(['todo', 'in_progress', 'waiting', 'review', 'blocked']);

const jobs = new Map(); // taskId -> { empId, mode, steps, i }
let timer = null;
let budgetWarned = false;

// ───────────────────────── primitives ─────────────────────────
export function event(type, actorId, text, refs = {}) {
  return store.upsert('events', { id: uid('ev'), t: Date.now(), type, actorId, text, ...refs });
}

export function setStatus(e, status, statusText, currentTaskId = e.currentTaskId) {
  // while a meeting is in progress the person stays in the Conference Hall, even if a background task reports progress
  if (e.meetingUntil && e.meetingUntil > Date.now() && status !== 'meeting' && status !== 'offline') status = 'meeting';
  Object.assign(e, { status, statusText, currentTaskId });
  e.stats.lastActiveAt = Date.now();
  store.upsert('employees', e);
}

function logTask(t, actorId, type, text, data) {
  if (t.transient) return; // chat replies use tools without a task record
  t.log = t.log || [];
  t.log.push({ t: Date.now(), actorId, type, text, ...(data ? { data } : {}) });
  if (t.log.length > 250) t.log.splice(0, t.log.length - 250);
  t.updatedAt = Date.now();
  store.upsert('tasks', t);
}

export function postMessage(channelId, authorId, text, extra = {}) {
  const m = store.upsert('messages', { id: uid('m'), channelId, authorId, text, t: Date.now(), ...extra });
  return m;
}

const depthOf = (t) => { let d = 0; let p = t; while (p?.parentId && d < 10) { p = task(p.parentId); d++; } return d; };

export function createTask({ title, description = '', assigneeId, createdBy = 'owner', parentId = null, priority = 'medium', kind = 'task', routineId = null, dueAt = null }) {
  gov.checkCreate({ title, createdBy, parentId, kind });
  const a = emp(assigneeId) || emp('aria');
  const t = {
    id: uid('t'), title: String(title).slice(0, 160), description: String(description).slice(0, 6000),
    divisionId: a.divisionId, assigneeId: a.id, createdBy, parentId, priority, kind, routineId,
    dueAt: dueAt || task(parentId)?.dueAt || Date.now() + ({ high: 1, medium: 3, low: 7 }[priority] || 3) * (kind === 'routine' ? 0.25 : 1) * 864e5,
    status: 'todo', output: '', summary: '', revisions: 0, failures: 0, log: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  store.upsert('tasks', t);
  logTask(t, createdBy, 'created', `Tugas dibuat untuk ${a.name}`);
  const by = emp(createdBy);
  if (parentId) event('delegated', createdBy, `${by?.name || 'Sistem'} mendelegasikan "${t.title}" ke ${a.name}`, { targetId: a.id, taskId: t.id });
  else event('task_created', createdBy, `${by?.name || 'Sistem'} membuat tugas "${t.title}" untuk ${a.name}`, { targetId: a.id, taskId: t.id });
  return t;
}

const activeLoad = (id) => db().tasks.filter((t) => t.assigneeId === id && OPEN.has(t.status)).length;
const headOf = (divisionId) => emp(div(divisionId)?.leadId) || db().employees.find((e) => e.divisionId === divisionId && e.isLead);
const searchableEmployee = (e) => `${e.id} ${e.name} ${e.title} ${e.team || ''} ${div(e.divisionId)?.name || ''} ${(e.skills || []).join(' ')}`.toLowerCase();

/** Resolve a routine scope to a small set of orchestrators, never a 154-call burst. */
export function routineTargets(r) {
  const ai = db().employees.filter((e) => e.type === 'ai' && e.status !== 'offline');
  const type = r.targetType || 'employee';
  if (type === 'employee') return [emp(r.targetId || r.employeeId)].filter((e) => e?.type === 'ai');
  if (type === 'division') return [headOf(r.targetId)].filter(Boolean);
  if (type === 'heads') return db().divisions.map((d) => headOf(d.id)).filter(Boolean);
  if (type === 'all' || type === 'staff') return db().divisions.map((d) => headOf(d.id)).filter(Boolean);
  if (type === 'tag') {
    const q = String(r.targetTag || r.targetId || '').replace(/^#/, '').trim().toLowerCase();
    const matched = ai.filter((e) => searchableEmployee(e).includes(q));
    if (matched.length <= 6) return matched;
    return [...new Set(matched.map((e) => e.divisionId))].map(headOf).filter(Boolean);
  }
  return [emp(r.employeeId)].filter(Boolean);
}

export function runRoutine(r, { priority = 'medium' } = {}) {
  if (!r) throw new Error('Rutinitas tidak ditemukan');
  const targets = [...new Map(routineTargets(r).map((e) => [e.id, e])).values()].sort((a, b) => activeLoad(a.id) - activeLoad(b.id));
  const scope = r.targetType === 'all' ? 'seluruh perusahaan' : r.targetType === 'staff' ? 'seluruh staf melalui head divisi' : r.targetType === 'heads' ? 'seluruh kepala divisi' : r.targetType === 'division' ? `divisi ${div(r.targetId)?.name || r.targetId}` : r.targetType === 'tag' ? `target #${r.targetTag || r.targetId}` : emp(r.targetId || r.employeeId)?.name;
  return targets.map((e) => {
    const description = `${r.description || ''}\n\nTARGET RUTINITAS: ${scope}. Kamu adalah koordinator untuk bagianmu. Libatkan staf yang relevan lewat konsultasi/koordinasi, bagikan pelajaran ke channel divisi, dan hasilkan satu sintesis agar hemat token. Jangan membuat jadwal duplikat.`;
    const t = createTask({ title: targets.length > 1 ? `${r.title} — ${div(e.divisionId)?.name || e.name}` : r.title, description, assigneeId: e.id, createdBy: 'system', kind: 'routine', routineId: r.id, priority });
    t.routineScope = { type: r.targetType || 'employee', id: r.targetId || r.employeeId, tag: r.targetTag || '' };
    return store.upsert('tasks', t);
  });
}

// ───────────────────────── scheduler ─────────────────────────
export function start() {
  stop();
  if (db().settings.autoApprove !== false) autoApprovePending();
  const loop = async () => {
    try { await tick(); } catch (err) { console.error('tick error', err); }
    timer = setTimeout(loop, Math.max(800, db().settings.tickMs || 2500));
  };
  timer = setTimeout(loop, 1000);
}
export function stop() { clearTimeout(timer); timer = null; }

async function tick() {
  const { settings } = db();
  const now = Date.now();
  // meetings end
  for (const e of db().employees) if (e.meetingUntil && e.meetingUntil < now) { delete e.meetingUntil; if (e.status === 'meeting') setStatus(e, e.currentTaskId ? 'working' : 'idle', e.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja'); }
  if (!settings.autonomy) return;

  // routines
  for (const r of db().routines) {
    if (!r.enabled) continue;
    const minuteKey = Math.floor(now / 60000);
    const due = r.cron ? collab.cronMatches(r.cron, new Date(now)) && r.lastMinute !== minuteKey : now - (r.lastRunAt || 0) >= (r.everyMinutes || 60) * 60000;
    if (!due) continue;
    r.lastRunAt = now; r.lastMinute = minuteKey; store.upsert('routines', r);
    if (db().tasks.some((t) => t.routineId === r.id && OPEN.has(t.status))) continue;
    runRoutine(r, { priority: 'low' });
  }

  // parents whose subtasks are all done → back to assignee for synthesis
  for (const t of db().tasks) {
    if (t.status !== 'waiting') continue;
    const cs = children(t);
    if (cs.length && cs.every((c) => c.status === 'done')) {
      t.status = 'todo'; t.synth = true;
      logTask(t, 'system', 'resumed', 'Semua subtugas selesai — kembali ke assignee untuk sintesis');
    }
  }

  const live = llm.isLive();
  const liveRunning = [...jobs.values()].filter((j) => j.mode === 'live').length;
  let slots = live ? Math.max(0, settings.maxConcurrent - liveRunning) : 6;
  const order = { high: 0, medium: 1, low: 2 };
  const queue = db().tasks.filter((t) => t.status === 'todo' && !jobs.has(t.id) && (!t.retryAt || t.retryAt <= now))
    .sort((a, b) => order[a.priority] - order[b.priority] || a.createdAt - b.createdAt);
  for (const t of queue) {
    if (slots <= 0) break;
    const e = emp(t.assigneeId);
    if (!e || e.type !== 'ai' || e.status === 'offline') continue;
    if ([...jobs.values()].some((j) => j.empId === e.id)) continue;
    if (live && llm.budgetLeft() <= 0) {
      if (!budgetWarned) { budgetWarned = true; event('alert', 'system', `Budget harian $${settings.dailyBudgetUSD} habis — agen live dijeda. Naikkan budget di Pengaturan.`); }
      break;
    }
    budgetWarned = false;
    slots--;
    startJob(e, t, live ? 'live' : 'sim');
  }

  // advance simulation jobs one step each
  for (const [taskId, j] of jobs) {
    if (j.mode !== 'sim' || j.busy) continue;
    if (Math.random() < 0.25) continue; // natural jitter so the office doesn't move in lockstep
    j.busy = true;
    try {
      const step = j.steps[j.i++];
      if (!step) { jobs.delete(taskId); continue; }
      const done = step();
      if (done || j.i >= j.steps.length) endJob(taskId);
    } catch (err) { console.error(err); endJob(taskId); }
    finally { j.busy = false; }
  }
}

function startJob(e, t, mode) {
  t.status = 'in_progress'; t.startedAt = t.startedAt || Date.now();
  logTask(t, e.id, 'started', t.synth ? 'Mulai menyusun hasil dari subtugas' : (mode === 'live' ? `Mulai bekerja (${llm.provider() === 'groq' ? 'Groq' : 'Claude'})` : 'Mulai bekerja (simulasi)'));
  setStatus(e, 'working', t.synth ? 'Menyusun hasil tim' : 'Membaca brief', t.id);
  event('task_started', e.id, `${e.name} mulai mengerjakan "${t.title}"`, { taskId: t.id });
  if (mode === 'live') {
    jobs.set(t.id, { empId: e.id, mode });
    runLive(e, t).catch((err) => failTask(e, t, err)).finally(() => endJob(t.id));
  } else {
    jobs.set(t.id, { empId: e.id, mode, i: 0, steps: simSteps(e, t) });
  }
}

function endJob(taskId) {
  const j = jobs.get(taskId);
  jobs.delete(taskId);
  if (!j) return;
  const e = emp(j.empId);
  if (e && e.currentTaskId === taskId && e.status !== 'meeting') setStatus(e, 'idle', 'Siap bekerja', null);
}

function failureLesson(msg) {
  if (/tool call|schema|did not match/i.test(msg)) return 'Validasi nama tool dan seluruh parameter terhadap schema sebelum memanggilnya.';
  if (/rate|429|capacity|overload/i.test(msg)) return 'Kurangi paralelisme, gunakan model kecil, dan beri jeda sebelum retry.';
  if (/budget|token/i.test(msg)) return 'Ringkas konteks dan sintesis bukti yang sudah ada sebelum meminta panggilan model tambahan.';
  if (/timeout|network|connection/i.test(msg)) return 'Simpan progres, gunakan backoff, lalu lanjutkan dari bukti terakhir tanpa mengulang semua langkah.';
  if (/berhenti|menyelesaikan|hasil/i.test(msg)) return 'Setelah memperoleh bukti yang cukup, hentikan pencarian dan segera susun output final.';
  return 'Catat kondisi gagal, verifikasi asumsi, lalu minta agen lain meninjau pendekatan sebelum retry.';
}

function failTask(e, t, err) {
  const msg = err?.message || String(err);
  console.error(`[${e.name}] ${t.title}:`, msg);
  t.failures = (t.failures || 0) + 1;
  const lesson = failureLesson(msg);
  e.lessons = [...(e.lessons || []), { t: Date.now(), taskId: t.id, lesson: `Failure case: ${lesson}`, quality: 3, failure: true }].slice(-25);
  e.failureHistory = [...(e.failureHistory || []), { t: Date.now(), taskId: t.id, error: msg.slice(0, 300), lesson }].slice(-30);
  store.upsert('employees', e);
  if (t.failures === 1) {
    brain.writeNote({ title: `Playbook ${div(e.divisionId)?.name}`, folder: 'Playbooks', authorId: e.id, tags: ['learning', 'failure-case'], append: true, content: `- ${new Date().toLocaleDateString('id-ID')} · **Failure case ${e.name}** (${t.title.slice(0, 70)}): ${lesson}` });
    postMessage(`div-${e.divisionId}`, e.id, `⚠️ **Failure case:** ${t.title}\nMasalah: ${msg.slice(0, 220)}\nPelajaran tim: ${lesson}`, { taskId: t.id, failureCase: true });
    postMessage('div-kms', e.id, `🧠 **Failure case lintas agen** · ${e.name} / ${div(e.divisionId)?.name}\n${msg.slice(0, 220)}\nPerbaikan: ${lesson}`, { taskId: t.id, failureCase: true });
    event('learned', e.id, `${e.name} belajar dari kegagalan: ${lesson.slice(0, 120)}`, { taskId: t.id });
  }
  t.retryAt = Date.now() + Math.min(120000, 3000 * 2 ** Math.min(t.failures, 5));
  t.status = 'todo';
  if (t.failures >= 3) {
    const candidates = db().employees.filter((x) => x.type === 'ai' && x.id !== e.id && x.status !== 'offline' && (x.divisionId === e.divisionId || x.id === e.reportsTo));
    const backup = candidates.sort((a, b) => db().tasks.filter((x) => x.assigneeId === a.id && OPEN.has(x.status)).length - db().tasks.filter((x) => x.assigneeId === b.id && OPEN.has(x.status)).length)[0];
    if (backup && (t.recoveryCount || 0) < 2) {
      const previous = e; t.assigneeId = backup.id; t.divisionId = backup.divisionId; t.failures = 0; t.recoveryCount = (t.recoveryCount || 0) + 1; t.retryAt = Date.now() + 2000;
      logTask(t, 'system', 'resumed', `Recovery handoff: ${previous.name} → ${backup.name}. Pelajaran: ${lesson}`);
      event('handoff', previous.id, `${previous.name} menyerahkan failure case "${t.title}" ke ${backup.name}`, { targetId: backup.id, taskId: t.id });
    } else if ((t.recoveryCount || 0) >= 2) t.status = 'blocked';
  }
  logTask(t, e.id, 'error', `Error: ${msg.slice(0, 400)}${t.status === 'blocked' ? ' — diblokir setelah recovery lintas agen' : ' — retry adaptif dijadwalkan'}`);
  event('alert', e.id, `${e.name} gagal mengerjakan "${t.title}": ${msg.slice(0, 160)}`, { taskId: t.id });
}

// ───────────────────────── completion / approvals ─────────────────────────
const POLICY_RE = /\b(publikasi|publish|posting|kontrak|contract|penawaran resmi|harga|diskon|budget|anggaran|bayar|payment|transfer|rekrut|offer letter|pecat|kebijakan)\b/i;

function finishTask(e, t, { summary, output, needsApproval }) {
  t.output = String(output || summary || '').slice(0, 40000);
  t.summary = String(summary || '').slice(0, 600);
  delete t.synth;
  if (t.output.length > 40) {
    // auto-filed into "<Division>/<Type>" with a clean title (same task overwrites; a different task gets a suffix)
    const fd = lib.fileDeliverable(e, t, t.output);
    const prev = brain.findNote(fd.title);
    if (prev && !prev.content.includes(t.id)) fd.title = t.kind === 'routine' ? `${fd.title} ${new Date().toLocaleDateString('id-ID')}` : `${fd.title} (${e.name})`;
    const n = brain.writeNote({
      title: fd.title, folder: fd.folder, authorId: e.id,
      tags: fd.tags,
      content: `# ${t.title}\n> Oleh **${e.name}** (${e.title}) · ${new Date().toLocaleString('id-ID')} · Tugas \`${t.id}\`\n\n${t.output}`,
    });
    t.noteId = n.id;
    event('note_written', e.id, `${e.name} menyimpan "${n.title}" ke ${n.folder}`, { noteId: n.id, taskId: t.id });
  }
  brain.remember(e, `Menyelesaikan "${t.title}"${t.summary ? ' — ' + t.summary.slice(0, 160) : ''}`);
  const approve = gov.needsHumanApproval(t, needsApproval) || (e.autonomy === 'ask' && !t.parentId);
  if (needsApproval && t.parentId) logTask(t, e.id, 'note', 'Ditandai untuk ditinjau orkestrator di atasnya (bukan manusia).');
  if (approve && db().settings.autoApprove !== false) {
    const a = store.upsert('approvals', { id: uid('ap'), taskId: t.id, requesterId: e.id, approverId: 'owner', title: t.title, summary: t.summary, status: 'approved', decidedBy: 'system-auto', createdAt: Date.now(), decidedAt: Date.now(), feedback: 'Disetujui otomatis sesuai pengaturan perusahaan.' });
    logTask(t, 'system', 'approved', 'Auto-approve aktif — dilanjutkan tanpa menunggu manusia', { approvalId: a.id });
    collab.recordFeedback(e, t, 'approve', 'Auto-approve');
    event('approved', 'system', `Auto-approve menyetujui "${t.title}"`, { taskId: t.id, targetId: e.id });
    completeTask(e, t);
  } else if (approve) {
    t.status = 'review';
    const approverId = t.createdBy && emp(t.createdBy)?.type === 'human' ? t.createdBy : 'owner';
    const a = store.upsert('approvals', { id: uid('ap'), taskId: t.id, requesterId: e.id, approverId, title: t.title, summary: t.summary, status: 'pending', createdAt: Date.now() });
    logTask(t, e.id, 'approval', 'Meminta persetujuan manusia', { approvalId: a.id });
    event('approval_requested', e.id, `${e.name} meminta persetujuan untuk "${t.title}"`, { taskId: t.id, targetId: approverId });
  } else {
    completeTask(e, t);
  }
}

function completeTask(e, t) {
  t.status = 'done'; t.completedAt = Date.now();
  logTask(t, e.id, 'done', t.summary || 'Selesai');
  e.stats.tasksDone += 1;
  store.upsert('employees', e);
  event('task_done', e.id, `${e.name} menyelesaikan "${t.title}"`, { taskId: t.id });
  if (e.type === 'ai' && t.liveRun) {
    collab.recordTraining(e, t, systemPrompt(e, t), taskContext(t));
    collab.reflect(e, t);
  }
  // personal assistants report finished goals back to their human in DM
  if (!t.parentId && emp(t.createdBy)?.type === 'human') {
    const pa = db().employees.find((x) => x.isPA && x.ownerId === t.createdBy);
    if (pa) postMessage(ensureDM(pa.id, t.createdBy), pa.id, `✅ **${t.title}** selesai${e.id !== pa.id ? ` (dikerjakan ${e.name})` : ''}.\n${t.summary || ''}`, { taskId: t.id });
  }
  const parent = t.parentId && task(t.parentId);
  if (parent) event('handoff', e.id, `${e.name} menyerahkan hasil "${t.title}" ke ${emp(parent.assigneeId)?.name}`, { targetId: parent.assigneeId, taskId: t.id });
  if (t.routineId === 'r-standup' || !t.parentId) {
    const ch = t.routineId === 'r-standup' ? 'standup' : `div-${e.divisionId}`;
    postMessage(ch, e.id, `✅ **${t.title}** selesai.\n${t.summary || ''}`, { taskId: t.id });
  }
}

export function decideApproval(approvalId, { decision, feedback = '', userId = 'owner' }) {
  const a = db().approvals.find((x) => x.id === approvalId);
  if (!a || a.status !== 'pending') throw new Error('Approval tidak ditemukan atau sudah diputuskan');
  const t = task(a.taskId);
  const e = emp(a.requesterId);
  Object.assign(a, { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: userId, decidedAt: Date.now(), feedback });
  store.upsert('approvals', a);
  const who = emp(userId)?.name || 'Manusia';
  if (decision === 'approve') {
    logTask(t, userId, 'approved', `${who} menyetujui${feedback ? ': ' + feedback : ''}`);
    collab.recordFeedback(e, t, 'approve', feedback);
    event('approved', userId, `${who} menyetujui "${t.title}"`, { taskId: t.id, targetId: e.id });
    completeTask(e, t);
  } else {
    t.status = 'todo'; t.revisions = (t.revisions || 0) + 1; t.feedback = feedback;
    collab.recordFeedback(e, t, 'reject', feedback);
    logTask(t, userId, 'rejected', `${who} meminta revisi: ${feedback || '(tanpa catatan)'}`);
    event('rejected', userId, `${who} meminta revisi "${t.title}"`, { taskId: t.id, targetId: e.id });
  }
  return a;
}

export function autoApprovePending() {
  if (db().settings.autoApprove === false) return 0;
  const pending = db().approvals.filter((a) => a.status === 'pending');
  let count = 0;
  for (const a of pending) {
    try { decideApproval(a.id, { decision: 'approve', feedback: 'Auto-approve diaktifkan', userId: 'system-auto' }); count++; }
    catch (err) { console.warn('[auto-approve]', a.id, err.message); }
  }
  return count;
}

/** A human finishes a task assigned to them. */
export function humanComplete(taskId, { userId, output = '' }) {
  const t = task(taskId); const e = emp(userId);
  if (!t || !e) throw new Error('Tidak ditemukan');
  t.output = output || t.output; t.summary = output.slice(0, 300);
  completeTask(e, t);
  return t;
}

// ───────────────────────── goals ─────────────────────────
export function submitGoal({ title, description, userId = 'owner', priority = 'high' }) {
  const pa = db().employees.find((x) => x.isPA && x.ownerId === userId && x.status !== 'offline');
  const master = db().employees.find((x) => x.isMaster) || emp('aria');
  return createTask({ title, description, assigneeId: (pa || master).id, createdBy: userId, kind: 'goal', priority });
}

// ───────────────────────── context helpers ─────────────────────────
function teamOf(e) { return db().employees.filter((x) => x.divisionId === e.divisionId && x.id !== e.id); }
function leads() { return db().divisions.map((d) => emp(d.leadId)).filter(Boolean); }

function taskContext(t) {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [`# Tugas: ${t.title}`, `ID: ${t.id} · Prioritas: ${t.priority} · Jenis: ${t.kind} · Tanggal hari ini: ${today} (gunakan tahun ini saat riset data terbaru)`];
  if (t.description) lines.push('', '## Deskripsi', t.description);
  let p = t.parentId && task(t.parentId); let d = 0;
  while (p && d < 3) { lines.push('', `## Konteks tugas induk (${emp(p.assigneeId)?.name}): ${p.title}`, p.description.slice(0, 1200)); p = p.parentId && task(p.parentId); d++; }
  if (t.feedback) lines.push('', `## Feedback revisi dari manusia (revisi ke-${t.revisions})`, t.feedback, 'Perbaiki hasil sebelumnya:', t.output.slice(0, 4000));
  if (t.synth) {
    lines.push('', '## Hasil subtugas (sudah selesai) — gabungkan menjadi hasil akhir');
    for (const c of children(t)) lines.push('', `### ${c.title} — ${emp(c.assigneeId)?.name}`, (c.output || c.summary).slice(0, 5000));
  }
  return lines.join('\n');
}

const DELEGATION = {
  best_fit: 'Pilih penerima subtugas berdasarkan kecocokan skill dan beban kerja.',
  round_robin: 'Bagi subtugas bergiliran ke anggota tim agar beban merata.',
  parallel: 'Pecah pekerjaan menjadi bagian paralel untuk semua anggota tim yang relevan.',
  sequential: 'Delegasikan bertahap: satu subtugas per tahap, gunakan hasil tahap sebelumnya.',
};
const ROUTINE_BLOCK = new Set(['create_subtask', 'convene_meeting', 'schedule_job', 'recruit_agent', 'create_division']);
const MASS_BLOCK = new Set(['create_subtask', 'convene_meeting', 'schedule_job', 'recruit_agent', 'create_division']);

const words = (value) => new Set(String(value || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').split(/\s+/).filter((x) => x.length > 2));
/** All skills remain granted, but only the most relevant methods are expanded into each prompt. */
function promptSkills(e, t) {
  const query = words(`${t?.title || ''} ${t?.description || ''} ${e.title} ${e.taskAndFunction || ''}`);
  return (e.skillRefs || []).map((r) => ({ ...r, s: db().skills.find((x) => x.id === r.id) })).filter((r) => r.s).map((r) => {
    const hay = words(`${r.s.name} ${r.s.category} ${r.s.description} ${(r.s.tags || []).join(' ')}`);
    let overlap = 0; for (const w of query) if (hay.has(w)) overlap++;
    const divisionFit = (r.s.divisions || []).includes(e.divisionId) ? 3 : 0;
    const specialist = Number(r.proficiency) > 5 ? 6 + Number(r.proficiency) : 0;
    return { ...r, score: overlap * 5 + divisionFit + specialist };
  }).sort((a, b) => b.score - a.score || b.proficiency - a.proficiency).slice(0, 12);
}

/** Stable per-employee system prompt (cache-friendly). Order: identity → instructions → task → skills → tools → knowledge → org → rules → output. */
export function systemPrompt(e, currentTask = null) {
  const { company } = db();
  const d = div(e.divisionId);
  const team = teamOf(e).map((x) => `- ${x.id}: ${x.name}, ${x.title} (${x.type === 'ai' ? 'AI' : 'MANUSIA'})`).join('\n') || '- (tidak ada)';
  const heads = leads().filter((x) => x.id !== e.id).map((x) => `- ${x.id}: ${x.name}, ${x.title} — ${div(x.divisionId).name}`).join('\n');
  const orchestrator = e.isPA || e.isMaster;
  const everyone = orchestrator ? db().employees.filter((x) => x.type === 'ai' && x.id !== e.id && !x.isPA).map((x) => `- ${x.id}: ${x.name} · ${x.title} · ${div(x.divisionId)?.short}${x.isLead ? ' · ORKESTRATOR DIVISI' : ''}${x.isMaster ? ' · MASTER ORCHESTRATOR' : ''}`).join('\n') : '';
  const chans = db().channels.filter((c) => c.kind === 'channel').map((c) => `#${c.id}`).join(', ');
  const skills = promptSkills(e, currentTask);
  const caps = CAPABILITIES.filter((c) => (c.required || (e.tools || CAP_IDS).includes(c.id)) && !(currentTask?.kind === 'routine' && ROUTINE_BLOCK.has(c.id)) && !(currentTask?.massMode && MASS_BLOCK.has(c.id)));
  const kb = (e.knowledgeIds || []).map((id) => db().notes.find((n) => n.id === id)).filter(Boolean);
  let kbBudget = 14000;
  const kbText = kb.map((n) => { const body = n.content.slice(0, Math.max(0, Math.min(5000, kbBudget))).replace(/^#{1,6}\s+/gm, '### '); kbBudget -= body.length; return body ? `## ${n.title}\n${body}` : ''; }).filter(Boolean).join('\n\n');
  const canDelegate = caps.some((c) => c.id === 'create_subtask');
  const sections = [
    `# IDENTITAS\nKamu adalah ${e.name}, ${e.title} di divisi ${d.name}${e.team ? ` (tim ${e.team}: ${db().employees.filter((x) => x.team === e.team && x.id !== e.id && x.divisionId === e.divisionId).map((x) => x.name).join(", ") || "-"})` : ""} perusahaan ${company.name} ("${company.tagline}"). Kamu karyawan AI otonom di kantor yang dipantau dan diawasi manusia. Jangan menyebut dirimu model AI generik; kamu ${e.name}.`,
    e.instructions?.trim() && `# INSTRUKSI SISTEM\n${e.instructions.trim()}`,
    `# TENTANG KAMU\n${e.about || e.persona}`,
    `# TUGAS & FUNGSI\n${e.taskAndFunction || ''}\nMisi divisi: ${d.mission}`,
    skills.length && `# SKILL\nKamu memiliki akses ke seluruh ${e.skillRefs?.length || 0} skill perusahaan. Demi fokus, berikut metode paling relevan untuk pekerjaan ini:\n${skills.map((r) => `## ${r.s.name} · proficiency ${r.proficiency}/10\n${r.s.promptSnippet}${r.s.usageGuide ? `\nKapan dipakai: ${r.s.usageGuide}` : ''}`).join('\n\n')}`,
    `# TOOL YANG BOLEH KAMU PAKAI\n${caps.map((c) => `- ${c.id}: ${c.guide}`).join('\n')}`,
    kbText && `# KNOWLEDGE WAJIB (sudah dilampirkan untukmu)\n${kbText}`,
    orchestrator && `# HIERARKI KOMANDO\n${e.isPA ? `Kamu asisten pribadi ${emp(e.ownerId)?.name}. Kamu memahami maksud user, merencanakan, lalu menggerakkan seluruh perusahaan: goal lintas divisi → serahkan ke Master Orchestrator (${db().employees.find((x) => x.isMaster)?.name}); pekerjaan satu divisi → orkestrator divisinya; pekerjaan spesifik → langsung ke individu. Gunakan convene_meeting untuk keputusan bersama dan schedule_job untuk pekerjaan berulang. Laporkan hasil akhir dengan ringkas ke user.` : 'Kamu Master Orchestrator: tunduk pada asisten pribadi user, mengoordinasikan semua orkestrator divisi, memecah goal lintas divisi, memimpin rapat lintas divisi, dan menyintesis hasil.'}\nSemua karyawan AI yang bisa kamu tugaskan:\n${everyone}`,
    `# ORGANISASI\nRekan satu divisi:\n${team}\nHead divisi lain:\n${heads}\nChannel: ${chans}`,
    `# CARA BEKERJA\n- Kerjakan tugas sampai tuntas. Cari konteks tambahan di Brain bila knowledge di atas belum cukup.\n- Untuk jumlah, daftar, ID, status, atau cakupan agen/divisi, company_status adalah sumber kebenaran live. Jangan memakai catatan Brain sebagai registry karena bisa usang.\n- ${currentTask?.massMode ? 'MODE MASSAL HEMAT TOKEN: kamu mewakili divisimu. Konsultasikan maksimal 2 staf paling relevan, tantang asumsi mereka, lalu buat satu sintesis. Jangan membuat subtugas/rapat/jadwal baru; bagikan pelajaran ke channel divisi agar seluruh staf menerima.' : e.isLead && canDelegate ? `Sebagai head: delegasikan bagian yang lebih cocok untuk anggota tim atau divisi lain (maks 5 subtugas). Strategi divisi: ${DELEGATION[d.delegation] || DELEGATION.best_fit} Setelah mendelegasikan, akhiri giliranmu; kamu akan dipanggil lagi dengan hasil subtugas untuk disintesis.` : canDelegate ? 'Kerjakan sendiri. Delegasikan hanya bila jelas butuh keahlian divisi lain (ke head divisi itu).' : 'Kerjakan sendiri.'}\n- Jika tugas berisi hasil subtugas, gabungkan menjadi satu hasil akhir yang utuh — jangan delegasi lagi.\n- Simpan pengetahuan jangka panjang dengan write_note dan tautkan [[Judul Catatan]].\n- ${caps.some((c) => c.id === 'web_search') ? 'Untuk data pasar, harga, regulasi, tren, atau fakta terbaru, gunakan web_search dan cantumkan sumbernya. Jangan mengarang angka.' : 'Kamu tidak punya akses internet; tandai asumsi dengan jelas, jangan mengarang fakta.'}\n- Gunakan calculate untuk semua hitungan angka (budget, proyeksi, persentase).\n- EKSEKUSI EKSTERNAL: jangan pernah mengatakan data sudah masuk Google Sheets/Drive/Calendar atau sistem lain hanya berdasarkan rencana. Wajib panggil tool integrasi dan cantumkan receipt berupa ID/URL/range. Bila konektor belum aktif atau tool gagal, katakan BELUM TEREKSEKUSI.\n- Jika tool gagal atau data tidak ditemukan, tulis jelas "data tidak tersedia" beserta alasannya. DILARANG mengarang nama, angka, harga, atau sumber.\n- DISIPLIN LINGKUP: kerjakan hanya yang diminta brief. Jangan menciptakan proyek, produk, klien, atau inisiatif baru yang tidak diminta. Kamu tidak terhubung ke sistem eksternal (Teams, Slack, Planner, PowerBI, email, CRM) kecuali lewat tool yang tersedia — hasilmu berupa dokumen/rencana di Brain.\n- Hemat: gunakan tool seperlunya (biasanya 1-4 panggilan), lalu selesaikan.`,
    `# ESKALASI\n${e.escalation || ''}\nJika menyentuh Kebijakan Persetujuan (publikasi, uang, kontrak, HR, data pribadi), selesaikan dengan request_approval.`,
    `# FORMAT OUTPUT\nGunakan ${company.language}. Output akhir lewat complete_task dalam format ${(e.outputFormat || 'markdown').toUpperCase()}, lengkap dan siap pakai (bukan sekadar ringkasan). Langsung ke isi tanpa basa-basi pembuka.`,
  ];
  sections.push(collab.learningSection(e), collab.selfSection(e)); // volatile parts last so the prompt prefix stays cacheable
  return sections.filter(Boolean).join('\n\n---\n\n');
}

/** Task-specific context retrieved from the brain (kept out of the cached system prompt). */
function retrievedContext(e, t) {
  const attached = new Set(e.knowledgeIds || []);
  const hits = brain.search(`${t.title} ${t.description}`, { scopeEmployeeId: e.id, limit: 6 })
    .filter((h) => !attached.has(brain.findNote(h.title)?.id)).slice(0, 3);
  const mem = brain.findNote(`Memori ${e.name}`);
  const memLines = mem ? mem.content.split('\n').slice(2).filter(Boolean).slice(-6).join('\n') : '';
  return [
    hits.length && `## Catatan Brain yang mungkin relevan\n${hits.map((h) => `- [[${h.title}]] (${h.folder}): ${h.snippet}`).join('\n')}`,
    memLines && `## Memori kerjamu terbaru\n${memLines}`,
  ].filter(Boolean).join('\n\n');
}

const toolsFor = (e, task) => TOOLS.filter((t) => t.name === 'complete_task' || ((e.tools || CAP_IDS).includes(t.name) && !(task?.kind === 'routine' && ROUTINE_BLOCK.has(t.name)) && !(task?.massMode && MASS_BLOCK.has(t.name))));

// ───────────────────────── live (Claude) agent ─────────────────────────
const TOOLS = [
  { name: 'recruit_agent', description: 'Rancang dan rekrut karyawan AI baru ke sebuah divisi dari brief peran (1-5 orang sekaligus). Agen baru langsung bisa diberi tugas.', input_schema: { type: 'object', properties: { division_id: { type: 'string' }, briefs: { type: 'array', items: { type: 'string' }, description: 'Satu brief per orang: peran, tugas utama, keahlian' } }, required: ['division_id', 'briefs'] } },
  { name: 'create_division', description: 'Bentuk divisi baru lengkap dengan kepala divisi dan anggota (maks 5 peran).', input_schema: { type: 'object', properties: { name: { type: 'string' }, mission: { type: 'string' }, icon: { type: 'string', description: 'satu emoji' }, roles: { type: 'array', items: { type: 'string' }, description: 'Brief peran; yang pertama menjadi kepala divisi' } }, required: ['name', 'mission', 'icon', 'roles'] } },
  { name: 'train_colleague', description: 'Latih/mentoring rekan: ajarkan sebuah skill dari library beserta pelajaran praktis. Proficiency mereka naik dan pelajaran tersimpan di memori mereka.', input_schema: { type: 'object', properties: { employee_id: { type: 'string' }, skill_id: { type: 'string' }, lesson: { type: 'string', description: 'Pelajaran konkret, maks 3 kalimat' } }, required: ['employee_id', 'skill_id', 'lesson'] } },
  { name: 'improve_skill', description: 'Perbarui metode (prompt snippet) sebuah skill di library berdasarkan pengalaman nyata. Versi lama disimpan di riwayat.', input_schema: { type: 'object', properties: { skill_id: { type: 'string' }, improved_snippet: { type: 'string' }, reason: { type: 'string' } }, required: ['skill_id', 'improved_snippet', 'reason'] } },
  { name: 'acquire_skill', description: 'Pelajari skill dari library (masuk ke daftar skill-mu dengan proficiency awal 5).', input_schema: { type: 'object', properties: { skill_id: { type: 'string' } }, required: ['skill_id'] } },
  { name: 'ask_colleague', description: 'Konsultasi cepat ke rekan (AI) mana pun dan dapatkan jawabannya langsung. Gunakan untuk minta pendapat ahli divisi lain tanpa mendelegasikan tugas.', input_schema: { type: 'object', properties: { employee_id: { type: 'string' }, question: { type: 'string' } }, required: ['employee_id', 'question'] } },
  { name: 'convene_meeting', description: 'Adakan rapat multi-agen sungguhan (2-7 peserta) untuk diskusi/keputusan. Peserta berdiskusi bergiliran, lalu notulen + action item otomatis dibuat menjadi tugas. Mengembalikan notulen.', input_schema: { type: 'object', properties: { topic: { type: 'string' }, agenda: { type: 'string' }, participant_ids: { type: 'array', items: { type: 'string' } }, rounds: { type: 'integer', description: '1-3 putaran diskusi' } }, required: ['topic', 'agenda', 'participant_ids', 'rounds'] } },
  { name: 'schedule_job', description: 'Jadwalkan pekerjaan berulang untuk dirimu atau rekan. Isi cron 5 kolom ATAU every_minutes. Interval yang terlalu rapat akan dinormalisasi engine. Jangan membuat jadwal duplikat.', input_schema: { type: 'object', properties: { title: { type: 'string' }, instructions: { type: 'string' }, assignee_id: { type: 'string' }, cron: { type: ['string', 'null'], description: 'Contoh "0 9 * * 1-5"; null bila memakai every_minutes' }, every_minutes: { type: ['integer', 'null'], description: 'null bila memakai cron' } }, required: ['title', 'instructions', 'assignee_id'] } },
  { name: 'list_jobs', description: 'Lihat semua jadwal/cron job perusahaan.', input_schema: { type: 'object', properties: { scope: { type: 'string', description: '"all" atau id karyawan' } }, required: ['scope'] } },
  { name: 'visit_url', description: 'Buka dan baca isi halaman web publik (teks) dari URL tertentu, mis. halaman pricing atau dokumentasi.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'google_sheets_append', description: 'Tulis baris sungguhan ke Google Sheets melalui konektor. Jika spreadsheet_id kosong, konektor membuat spreadsheet baru. Berhasil hanya bila hasil berisi receipt spreadsheetId/range/url.', input_schema: { type: 'object', properties: { spreadsheet_id: { type: 'string' }, spreadsheet_name: { type: 'string' }, sheet_name: { type: 'string' }, headers: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: {} } } }, required: ['sheet_name', 'rows'] } },
  { name: 'google_drive_create', description: 'Buat file atau Google Doc sungguhan di Drive. Berhasil hanya bila hasil berisi receipt fileId/url.', input_schema: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' }, mime_type: { type: 'string', description: 'text/plain, text/csv, application/json, atau application/vnd.google-apps.document' }, folder_id: { type: 'string' } }, required: ['name', 'content'] } },
  { name: 'google_calendar_create', description: 'Buat event sungguhan di Google Calendar. Gunakan waktu ISO 8601 dengan zona waktu. Berhasil hanya bila hasil berisi receipt eventId.', input_schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, calendar_id: { type: 'string' }, guests: { type: 'array', items: { type: 'string' } } }, required: ['title', 'start', 'end'] } },
  { name: 'web_search', description: 'Riset internet sungguhan (pencarian web + membaca situs) untuk data terbaru: pasar, kompetitor, harga, regulasi, tren. Kembalikan ringkasan faktual beserta sumber.', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Pertanyaan riset yang spesifik, sertakan konteks negara/industri/tahun bila relevan' } }, required: ['query'] } },
  { name: 'calculate', description: 'Hitung ekspresi matematika secara akurat, mis. "1250000*12*0.8" atau "(150-120)/120*100".', input_schema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
  { name: 'company_status', description: 'Sumber live resmi untuk roster: jumlah, ID/nama/status setiap agen, tugas aktif per divisi, dan persetujuan tertunda. Gunakan untuk audit cakupan agen.', input_schema: { type: 'object', properties: { scope: { type: 'string', description: '"all" untuk seluruh perusahaan, atau id divisi (mis. "mkt")' } }, required: ['scope'] } },
  { name: 'search_brain', description: 'Cari catatan di Brain perusahaan (SOP, kebijakan, deliverable, memori). Kembalikan judul + cuplikan.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'read_note', description: 'Baca isi lengkap satu catatan Brain berdasarkan judul.', input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  { name: 'write_note', description: 'Buat atau perbarui catatan pengetahuan di Brain (Markdown, boleh [[wikilink]]).', input_schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, folder: { type: 'string', description: 'mis. Knowledge, SOP, Research, Marketing' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'content'] } },
  { name: 'create_subtask', description: 'Delegasikan subtugas ke rekan (pakai id karyawan). Tugas induk akan menunggu sampai semua subtugas selesai.', input_schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string', description: 'Brief lengkap: konteks, ekspektasi output, batasan' }, assignee_id: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['title', 'description', 'assignee_id'] } },
  { name: 'send_message', description: 'Kirim pesan ke channel (mis. "general", "standup", "div-mkt") atau DM ke karyawan (pakai id karyawan).', input_schema: { type: 'object', properties: { to: { type: 'string' }, text: { type: 'string' } }, required: ['to', 'text'] } },
  { name: 'complete_task', description: 'Selesaikan tugas dengan output akhir.', input_schema: { type: 'object', properties: { summary: { type: 'string', description: '1-2 kalimat' }, output: { type: 'string', description: 'Hasil lengkap dalam Markdown' } }, required: ['summary', 'output'] } },
  { name: 'organize_brain', description: 'Audit kerapian Brain: jumlah per folder, catatan yang belum terklasifikasi (dengan saran folder), judul buruk (dengan saran), dan kandidat duplikat.', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: 'maks item per daftar (5-40)' } }, required: ['limit'] } },
  { name: 'move_note', description: 'Pindahkan catatan ke folder "<Nama Divisi>/<Jenis>" (Jenis: Research, Strategy, Plan, Report, SOP, Policy, Content, Design, Analysis, Meeting, Data, Technical, Training, Knowledge).', input_schema: { type: 'object', properties: { note: { type: 'string', description: 'id atau judul' }, folder: { type: 'string' } }, required: ['note', 'folder'] } },
  { name: 'rename_note', description: 'Ganti judul catatan; semua [[wikilink]] ke catatan ini otomatis diperbarui.', input_schema: { type: 'object', properties: { note: { type: 'string', description: 'id atau judul' }, new_title: { type: 'string' } }, required: ['note', 'new_title'] } },
  { name: 'merge_notes', description: 'Gabungkan catatan duplikat ke catatan utama; duplikat diarsipkan dengan tautan.', input_schema: { type: 'object', properties: { primary: { type: 'string' }, duplicates: { type: 'array', items: { type: 'string' } } }, required: ['primary', 'duplicates'] } },
  { name: 'build_training_set', description: 'Bangun dataset fine-tuning (train/eval JSONL) dari contoh kerja berkualitas, per divisi atau agen.', input_schema: { type: 'object', properties: { division_id: { type: 'string', description: 'kosongkan untuk seluruh perusahaan' }, employee_id: { type: 'string', description: 'opsional' }, min_quality: { type: 'integer', description: '1-10, default 7' } }, required: ['division_id', 'employee_id', 'min_quality'] } },
  { name: 'request_approval', description: 'Serahkan hasil untuk disetujui manusia (untuk hal yang diatur Kebijakan Persetujuan).', input_schema: { type: 'object', properties: { summary: { type: 'string' }, output: { type: 'string' }, reason: { type: 'string' } }, required: ['summary', 'output', 'reason'] } },
];

const STATUS_FOR_TOOL = { recruit_agent: 'Merekrut agen baru', create_division: 'Membentuk divisi', train_colleague: 'Melatih rekan', improve_skill: 'Menyempurnakan skill', acquire_skill: 'Mempelajari skill', ask_colleague: 'Konsultasi rekan', convene_meeting: 'Memimpin rapat', schedule_job: 'Menjadwalkan job', list_jobs: 'Cek jadwal', visit_url: 'Membuka situs', google_sheets_append: 'Menulis Google Sheets', google_drive_create: 'Membuat file Drive', google_calendar_create: 'Membuat acara Calendar', web_search: 'Riset web', calculate: 'Menghitung', company_status: 'Cek status tim', search_brain: 'Mencari di Brain', read_note: 'Membaca catatan', write_note: 'Menulis ke Brain', create_subtask: 'Mendelegasikan', send_message: 'Berkoordinasi', complete_task: 'Menyelesaikan', request_approval: 'Minta persetujuan', organize_brain: 'Mengaudit Brain', move_note: 'Merapikan folder', rename_note: 'Mengganti nama catatan', merge_notes: 'Menggabungkan duplikat', build_training_set: 'Menyusun dataset training' };

async function runTool(e, t, name, input, state) {
  if (name.startsWith('mcp__')) {
    if (!(e.tools || []).includes('mcp')) return 'Tool MCP tidak diizinkan untuk ' + e.name + '.';
    logTask(t, e.id, 'tool', `🔌 ${name}(${JSON.stringify(input).slice(0, 120)})`);
    return collab.mcpCall(name, input).catch((err) => `MCP error: ${err.message}`);
  }
  if (name !== 'complete_task' && !(e.tools || CAP_IDS).includes(name)) return 'Tool ' + name + ' tidak diizinkan untuk ' + e.name + '.';
  switch (name) {
    case 'search_brain': {
      const r = brain.search(input.query, { scopeEmployeeId: e.id, limit: 6 });
      logTask(t, e.id, 'tool', `🔎 search_brain("${input.query}") → ${r.length} hasil`, { results: r.map((x) => x.title) });
      return r.length ? r.map((x) => `[[${x.title}]] (${x.folder}): ${x.snippet}`).join('\n\n') : 'Tidak ada hasil.';
    }
    case 'read_note': {
      const n = brain.findNote(input.title);
      logTask(t, e.id, 'tool', `📖 read_note("${input.title}")${n ? '' : ' — tidak ditemukan'}`);
      return n ? n.content.slice(0, 12000) : 'Catatan tidak ditemukan. Coba search_brain.';
    }
    case 'write_note': {
      const f = String(input.folder || '');
      const folder = f.includes('/') || lib.SYSTEM_FOLDERS.has(f) ? f : lib.folderFor(db().divisions.find((d) => d.name.toLowerCase() === f.toLowerCase())?.id || e.divisionId, lib.classifyType(input.title, input.content));
      const n = brain.writeNote({ title: lib.cleanTitle(input.title, e.name) || input.title, content: input.content, folder, tags: input.tags || [], authorId: e.id });
      logTask(t, e.id, 'tool', `📝 write_note("${n.title}")`);
      event('note_written', e.id, `${e.name} menulis "${n.title}" ke Brain`, { noteId: n.id, taskId: t.id });
      return `Tersimpan sebagai [[${n.title}]].`;
    }
    case 'create_subtask': {
      const a = emp(input.assignee_id);
      if (!a) return `Karyawan "${input.assignee_id}" tidak ada. Gunakan id dari daftar.`;
      if (a.id === e.id) return 'Tidak bisa mendelegasikan ke diri sendiri.';
      if (depthOf(t) >= 4) return 'Kedalaman delegasi maksimum tercapai — kerjakan sendiri.';
      if (children(t).length >= 5) return 'Maksimum 5 subtugas per tugas. Kerjakan sisanya sendiri.';
      if (t.kind === 'routine') return 'Tugas rutin tidak boleh didelegasikan.';
      const c = createTask({ title: input.title, description: input.description, assigneeId: a.id, createdBy: e.id, parentId: t.id, priority: input.priority || t.priority });
      state.delegated = true;
      logTask(t, e.id, 'delegate', `➡️ Delegasi ke ${a.name}: ${c.title}`, { childId: c.id });
      return `Subtugas ${c.id} dibuat untuk ${a.name}${a.type === 'human' ? ' (manusia — akan dikerjakan manual)' : ''}.`;
    }
    case 'web_search': {
      logTask(t, e.id, 'tool', `🌐 web_search("${String(input.query).slice(0, 120)}")`);
      return gov.cached('web', input.query, 6 * 3600e3, () => llm.webResearch(String(input.query || ''), e)).catch((err) => {
        logTask(t, e.id, 'error', `web_search gagal: ${err.message}`);
        return `GAGAL: riset web tidak tersedia (${err.message}). JANGAN mengarang data; tandai bagian ini sebagai "data tidak tersedia".`;
      }).then((r) => {
        if (r.startsWith('GAGAL')) return r;
        logTask(t, e.id, 'tool', `🌐 hasil riset: ${r.slice(0, 160).replace(/\n/g, ' ')}…`, { result: r.slice(0, 4000) });
        return r.slice(0, 9000);
      });
    }
    case 'calculate': {
      const expr = String(input.expression || '');
      if (!/^[\d\s.+\-*/%()e,]+$/i.test(expr)) return 'Ekspresi hanya boleh berisi angka dan operator + - * / % ( ).';
      let val;
      try { val = Function(`"use strict"; return (${expr.replace(/,/g, '')});`)(); } catch (err) { return 'Ekspresi tidak valid: ' + err.message; }
      logTask(t, e.id, 'tool', `🧮 ${expr} = ${val}`);
      return String(val);
    }
    case 'company_status': {
      const scope = input.scope || input.division_id || 'all';
      const divs = db().divisions.filter((d) => scope === 'all' || d.id === scope);
      const lines = divs.map((d) => {
        const ts = db().tasks.filter((x) => x.divisionId === d.id && x.status !== 'done');
        const people = db().employees.filter((x) => x.divisionId === d.id).map((x) => `${x.name}(${x.status}, ${db().tasks.filter((k) => k.assigneeId === x.id && k.status !== 'done').length} tugas)`).join(', ');
        return `- ${d.name}: ${ts.length} tugas aktif [${ts.slice(0, 5).map((x) => `${x.title.slice(0, 50)} (${x.status})`).join('; ')}] · tim: ${people}`;
      });
      logTask(t, e.id, 'tool', '📊 company_status');
      return `${lines.join('\n')}\nPersetujuan tertunda: ${db().approvals.filter((a) => a.status === 'pending').length}`;
    }
    case 'recruit_agent': {
      const d = div(input.division_id);
      if (!d) return 'Divisi tidak ditemukan. Gunakan id divisi yang valid.';
      if (!e.isPA && !e.isMaster && e.divisionId !== d.id && e.divisionId !== 'hr') return 'Kamu hanya boleh merekrut untuk divisimu sendiri.';
      const briefs = (input.briefs || []).map(String).filter((x) => x.trim().length > 8).slice(0, 5);
      if (!briefs.length) return 'Berikan minimal satu brief peran yang jelas.';
      logTask(t, e.id, 'tool', `🧬 recruit_agent(${d.short}, ${briefs.length} orang)`);
      return org.recruitFromBriefs(e.id, d.id, briefs).then((list) => {
        for (const n of list) brain.remember(n, `Direkrut oleh ${e.name} untuk: ${t.title}`);
        return `Berhasil merekrut: ${list.map((n) => `${n.id} (${n.name}, ${n.title})`).join('; ')}. Mereka bisa langsung diberi subtugas.`;
      });
    }
    case 'create_division': {
      if (!e.isPA && !e.isMaster) return 'Hanya asisten pribadi atau Master Orchestrator yang boleh membentuk divisi.';
      const d = org.createDivision({ name: input.name, mission: input.mission, icon: input.icon });
      const roles = (input.roles || []).map(String).filter(Boolean).slice(0, 5);
      logTask(t, e.id, 'tool', `🏗️ create_division(${d.name}) dengan ${roles.length} peran`);
      event('hired', e.id, `${e.name} membentuk divisi baru: ${d.icon} ${d.name}`, {});
      return org.recruitFromBriefs(e.id, d.id, roles.map((r, i) => (i === 0 ? `Kepala divisi ${d.name}: ${r}` : r))).then((list) =>
        `Divisi ${d.id} dibentuk. Anggota: ${list.map((n) => `${n.id} (${n.name}, ${n.title}${n.isLead ? ', kepala' : ''})`).join('; ')}.`);
    }
    case 'train_colleague': {
      const m = emp(input.employee_id); const sk = db().skills.find((x) => x.id === input.skill_id);
      if (!m || m.type !== 'ai') return 'Rekan AI tidak ditemukan.';
      if (!sk) return 'Skill tidak ada di library. Gunakan id skill yang valid.';
      const mine = (e.skillRefs || []).find((r) => r.id === sk.id)?.proficiency || 6;
      m.skillRefs = m.skillRefs || [];
      const r = m.skillRefs.find((x) => x.id === sk.id);
      const before = r?.proficiency || 0;
      if (r) r.proficiency = Math.min(10, Math.max(r.proficiency, Math.min(mine, r.proficiency + 1))); else m.skillRefs.push({ id: sk.id, proficiency: Math.min(mine, 6) });
      m.lessons = [...(m.lessons || []), { t: Date.now(), lesson: `(dari ${e.name}) ${String(input.lesson).slice(0, 300)}`, quality: null }].slice(-25);
      store.upsert('employees', m);
      postMessage(ensureDM(e.id, m.id), e.id, `🎓 Mentoring **${sk.name}**: ${input.lesson}`);
      event('trained', e.id, `${e.name} melatih ${m.name} skill ${sk.name} (${before || 0}→${m.skillRefs.find((x) => x.id === sk.id).proficiency})`, { targetId: m.id });
      logTask(t, e.id, 'tool', `🎓 train_colleague(${m.name}, ${sk.name})`);
      return `${m.name} kini menguasai ${sk.name} level ${m.skillRefs.find((x) => x.id === sk.id).proficiency}/10.`;
    }
    case 'improve_skill': {
      const sk = db().skills.find((x) => x.id === input.skill_id);
      if (!sk) return 'Skill tidak ditemukan.';
      if (String(input.improved_snippet || '').length < 60) return 'Snippet terlalu pendek; tulis metode langkah demi langkah.';
      sk.history = [...(sk.history || []), { t: Date.now(), by: e.id, snippet: sk.promptSnippet, reason: input.reason }].slice(-10);
      sk.promptSnippet = String(input.improved_snippet).slice(0, 2500); sk.version = (sk.version || 1) + 1; sk.updatedAt = Date.now();
      store.upsert('skills', sk);
      event('skill_upgraded', e.id, `${e.name} menyempurnakan skill ${sk.name} ke v${sk.version}: ${String(input.reason).slice(0, 90)}`, {});
      logTask(t, e.id, 'tool', `⬆️ improve_skill(${sk.name} v${sk.version})`);
      return `Skill ${sk.name} diperbarui ke versi ${sk.version}. Semua pemilik skill ini langsung memakai metode baru.`;
    }
    case 'organize_brain': {
      const r = lib.audit(Math.max(5, Math.min(40, Number(input.limit) || 20)));
      logTask(t, e.id, 'tool', `🗂️ organize_brain → ${r.looseCount} belum rapi, ${r.badTitles.length} judul buruk, ${r.duplicates.length} duplikat`);
      return JSON.stringify(r).slice(0, 9000);
    }
    case 'move_note': case 'rename_note': case 'merge_notes': {
      try {
        const r = name === 'move_note' ? lib.moveNote(input.note, input.folder, e.id) : name === 'rename_note' ? lib.renameNote(input.note, input.new_title, e.id) : lib.mergeNotes(input.primary, input.duplicates || [], e.id);
        logTask(t, e.id, 'tool', `🗂️ ${name} ${JSON.stringify(r).slice(0, 160)}`);
        state.organized = (state.organized || 0) + 1;
        if (state.organized === 1 || state.organized % 10 === 0) event('note_written', e.id, `${e.name} merapikan Brain (${state.organized} perubahan)`, { taskId: t.id });
        return JSON.stringify(r);
      } catch (err) { return 'Gagal: ' + err.message; }
    }
    case 'build_training_set': {
      const r = lib.buildTrainingSet({ divisionId: input.division_id || undefined, employeeId: input.employee_id || undefined, minQuality: Number(input.min_quality) || 7 });
      logTask(t, e.id, 'tool', `🎓 dataset ${r.name}: ${r.train} train / ${r.eval} eval dari ${r.agents} agen`);
      event('learned', e.id, `${e.name} membangun dataset training ${r.name} (${r.train + r.eval} contoh)`, {});
      return JSON.stringify(r);
    }
    case 'acquire_skill': {
      const sk = db().skills.find((x) => x.id === input.skill_id);
      if (!sk) return 'Skill tidak ditemukan.';
      e.skillRefs = e.skillRefs || [];
      if (!e.skillRefs.some((r) => r.id === sk.id)) e.skillRefs.push({ id: sk.id, proficiency: 5 });
      const added = db().settings.autoActivate !== false ? autoActivate(e, db().skills) : [];
      store.upsert('employees', e);
      if (added.length) logTask(t, e.id, 'tool', `⚡ Tool aktif otomatis: ${added.join(', ')}`);
      event('learned', e.id, `${e.name} belajar: skill baru ${sk.name}`, {});
      return `Kamu sekarang punya skill ${sk.name}. Metode:\n${sk.promptSnippet}`;
    }
    case 'ask_colleague': {
      logTask(t, e.id, 'tool', `🗣️ ask_colleague(${emp(input.employee_id)?.name || input.employee_id}): ${String(input.question).slice(0, 100)}`);
      return collab.askColleague(e, input.employee_id, String(input.question || '')).then((r) => { logTask(t, e.id, 'tool', `🗣️ jawaban: ${r.slice(0, 160)}`); return r; });
    }
    case 'convene_meeting': {
      const ids = (input.participant_ids || []).filter((id) => emp(id));
      logTask(t, e.id, 'tool', `👥 convene_meeting("${String(input.topic).slice(0, 80)}") dengan ${ids.map((id) => emp(id).name).join(', ')}`);
      return collab.runMeeting({ topic: input.topic, agenda: input.agenda, participantIds: ids, chairId: e.id, rounds: input.rounds || 2, originTaskId: t.id })
        .then((m) => { logTask(t, e.id, 'tool', `👥 notulen: ${m.minutes.slice(0, 200)}`); return `Rapat selesai.\n${m.minutes}`; })
        .catch((err) => `Rapat gagal: ${err.message}`);
    }
    case 'schedule_job': {
      const a = emp(input.assignee_id) || e;
      const cron = String(input.cron || '').trim();
      if (cron && !collab.parseCron(cron)) return 'Format cron tidak valid. Contoh: "0 9 * * 1-5".';
      const every = cron ? 0 : Math.max(10, Number(input.every_minutes) || 60);
      const normalizedTitle = String(input.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const learningJob = /self.?learning|knowledge update|update knowledge/i;
      const duplicate = db().routines.find((r) => r.enabled && (cron ? r.cron === cron : Number(r.everyMinutes) === every) && (
        (r.employeeId === a.id && String(r.title).trim().toLowerCase().replace(/\s+/g, ' ') === normalizedTitle) ||
        (learningJob.test(`${input.title} ${input.instructions}`) && learningJob.test(`${r.title} ${r.description}`))
      ));
      if (duplicate) return `Jadwal identik sudah ada: ${duplicate.id}. Tidak dibuat duplikat.`;
      if (db().routines.filter((r) => r.createdBy && r.createdBy !== 'owner').length >= 30) return 'Batas 30 jadwal buatan agen tercapai.';
      const r = store.upsert('routines', { id: uid('r'), employeeId: a.id, title: String(input.title).slice(0, 120), description: String(input.instructions || '').slice(0, 2000), cron: cron || '', everyMinutes: cron ? 0 : every, enabled: true, lastRunAt: Date.now(), createdBy: e.id });
      logTask(t, e.id, 'tool', `⏰ schedule_job("${r.title}", ${cron || 'tiap ' + every + ' menit'}) → ${a.name}`);
      event('scheduled', e.id, `${e.name} menjadwalkan "${r.title}" (${cron || 'tiap ' + every + ' mnt'}) untuk ${a.name}`, { targetId: a.id });
      return `Jadwal ${r.id} dibuat untuk ${a.name}.`;
    }
    case 'list_jobs': {
      const list = db().routines.filter((r) => !input.scope || input.scope === 'all' || r.employeeId === input.scope);
      return list.map((r) => `- ${r.id}: ${r.title} · ${emp(r.employeeId)?.name} · ${r.cron || 'tiap ' + r.everyMinutes + ' mnt'} · ${r.enabled ? 'aktif' : 'nonaktif'}`).join('\n') || 'Belum ada jadwal.';
    }
    case 'visit_url': {
      logTask(t, e.id, 'tool', `🔗 visit_url(${String(input.url).slice(0, 120)})`);
      return gov.cached('url', input.url, 3600e3, () => collab.visitUrl(String(input.url || '')));
    }
    case 'google_sheets_append': case 'google_drive_create': case 'google_calendar_create': {
      const action = name === 'google_sheets_append' ? 'sheets.append' : name === 'google_drive_create' ? 'drive.create' : 'calendar.create';
      logTask(t, e.id, 'tool', `🔌 ${name}(${JSON.stringify(input).slice(0, 180)})`);
      try {
        const result = await collab.googleWorkspaceCall(action, input);
        logTask(t, e.id, 'external_receipt', `✅ ${name} terverifikasi`, result.receipt);
        event('external_executed', e.id, `${e.name} mengeksekusi ${action} dan menerima receipt`, { taskId: t.id, receipt: result.receipt });
        return `TEREKSEKUSI DAN TERVERIFIKASI\n${JSON.stringify(result)}`;
      } catch (err) {
        logTask(t, e.id, 'error', `❌ ${name}: ${err.message}`);
        return `BELUM TEREKSEKUSI: ${err.message}. Jangan mengklaim berhasil.`;
      }
    }
    case 'send_message': {
      const target = emp(input.to);
      const ch = target ? dmId(e.id, target.id) : db().channels.find((c) => c.id === input.to.replace(/^#/, '') || c.name === input.to.replace(/^#/, ''))?.id;
      if (!ch) return 'Channel/penerima tidak ditemukan.';
      if (target) ensureDM(e.id, target.id);
      postMessage(ch, e.id, input.text);
      event('message', e.id, `${e.name} → ${target ? target.name : '#' + ch}: ${input.text.slice(0, 80)}`, { targetId: target?.id, channelId: ch });
      logTask(t, e.id, 'tool', `💬 send_message(${target ? target.name : '#' + ch})`);
      return 'Terkirim.';
    }
    case 'complete_task':
    case 'request_approval': {
      state.finished = true;
      const needsApproval = name === 'request_approval';
      if (name === 'request_approval') logTask(t, e.id, 'tool', `🛑 request_approval: ${input.reason || ''}`);
      finishTask(e, t, { summary: input.summary, output: input.output, needsApproval });
      return 'Tercatat. Akhiri giliranmu.';
    }
    default: return 'Tool tidak dikenal.';
  }
}

async function runLive(e, t) {
  const ctx = retrievedContext(e, t);
  const messages = [{ role: 'user', content: ctx ? `${taskContext(t)}\n\n${ctx}` : taskContext(t) }];
  const state = { finished: false, delegated: false, toolCalls: new Map(), evidence: [] };
  const dm = llm.defaultModels();
  const tier = gov.modelTier(e, t);
  const model = e.model || dm[tier] || dm.worker;
  const mcpDefs = (e.tools || []).includes('mcp') && t.kind !== 'routine' ? (await collab.mcpToolDefs()).map(({ _mcp, ...d }) => d) : [];
  const tools = [...toolsFor(e, t), ...mcpDefs];
  t.liveRun = true;
  const maxTurns = t.massMode ? 6 : t.kind === 'routine' ? 5 : 10;
  for (let turn = 0; turn < maxTurns && !state.finished; turn++) {
    if (llm.budgetLeft() <= 0) throw new Error('Budget harian habis');
    const over = gov.overBudget(t);
    if (over && turn > 0) {
      // out of budget for this goal: wrap up with what we have instead of burning more tokens
      messages.push({ role: 'user', content: `Anggaran tugas ini ($${over.limit}) sudah terpakai. Segera panggil complete_task dengan hasil terbaik yang sudah ada.` });
    }
    const finalTurn = turn === maxTurns - 1;
    if (finalTurn) messages.push({ role: 'user', content: 'Ini giliran final. Satu-satunya tool yang tersedia adalah complete_task. Panggil complete_task sekarang dengan hasil akhir lengkap berdasarkan pekerjaan dan bukti yang sudah terkumpul.' });
    gov.compact(messages);
    setStatus(e, 'working', turn === 0 ? 'Berpikir…' : 'Melanjutkan…', t.id);
    const res = await llm.call({ system: systemPrompt(e, t), messages, tools, model, employee: e, effort: e.effort, maxTokens: t.massMode ? 5000 : t.kind === 'routine' ? 4500 : 8000, taskId: t.id });
    const said = llm.textOf(res);
    if (said) {
      logTask(t, e.id, 'thought', said.slice(0, 1500));
      const progress = said.replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (progress) { setStatus(e, 'working', `💭 ${progress}`, t.id); event('reasoning', e.id, progress, { taskId: t.id }); }
    }
    if (res.stop_reason === 'refusal') throw new Error('Permintaan ditolak oleh model (refusal)');
    messages.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) {
      if (state.delegated) break;
      // Model ended without calling complete_task: treat its text as the output.
      const fallback = said || state.evidence.slice(-8).join('\n\n') || 'Pekerjaan selesai tanpa keluaran teks dari model.';
      finishTask(e, t, { summary: fallback.slice(0, 200), output: fallback, needsApproval: false });
      state.finished = true;
      break;
    }
    const results = [];
    for (const u of uses) {
      setStatus(e, 'working', STATUS_FOR_TOOL[u.name] || u.name, t.id);
      let out;
      try {
        const signature = `${u.name}:${JSON.stringify(u.input || {})}`;
        const repeated = (state.toolCalls.get(signature) || 0) + 1;
        state.toolCalls.set(signature, repeated);
        out = repeated > 2 ? 'Tool dan input identik sudah dipakai dua kali. Jangan ulangi; simpulkan hasil yang ada dan selesaikan tugas.' : state.finished ? 'Tugas sudah selesai.' : await runTool(e, t, u.name, u.input || {}, state);
      }
      catch (err) { out = `Error: ${err.message}`; }
      if (!/^Error:/.test(String(out))) state.evidence.push(`### ${u.name}\n${String(out).slice(0, 3000)}`);
      results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out) });
    }
    messages.push({ role: 'user', content: results });
    store.upsert('employees', e);
  }
  if (!state.finished) {
    if (state.delegated) {
      t.status = 'waiting'; delete t.synth;
      logTask(t, e.id, 'waiting', `Menunggu ${children(t).filter((c) => c.status !== 'done').length} subtugas`);
    } else {
      const fallback = state.evidence.slice(-8).join('\n\n');
      if (fallback) {
        finishTask(e, t, { summary: 'Tugas diselesaikan otomatis dari hasil tool yang telah dikumpulkan.', output: fallback, needsApproval: false });
        logTask(t, e.id, 'note', 'Engine menyelamatkan hasil tool setelah batas giliran tercapai.');
      } else throw new Error('Agen berhenti tanpa hasil yang dapat diselamatkan');
    }
  }
}

// ───────────────────────── simulation agent ─────────────────────────
const ROUTES = {
  mkt: /market|konten|content|sosial|social|iklan|ads|campaign|kampanye|brand|seo|promosi|launch|peluncuran/i,
  sales: /sales|jual|penjualan|lead|klien|client|prospek|deal|revenue|omzet|pelanggan baru/i,
  eng: /aplikasi|app|fitur|feature|bug|website|web|develop|sistem|api|produk|teknis|integrasi/i,
  cs: /customer|support|komplain|tiket|layanan|retensi|churn|nps|onboarding/i,
  fin: /budget|anggaran|keuangan|finance|invoice|biaya|cost|pajak|cashflow|harga|pricing/i,
  hr: /rekrut|hiring|karyawan|training|pelatihan|hr|talenta|budaya|onboarding karyawan/i,
  ops: /operasional|operasi|vendor|supply|logistik|pengadaan|proses|sop|otomasi/i,
  legal: /kontrak|legal|hukum|compliance|izin|regulasi|privasi|pdp/i,
  data: /data|riset|research|analisis|survey|survei|pasar|market|kompetitor|kpi|laporan/i,
  design: /desain|design|ui|ux|visual|logo|banner|tampilan|brand asset/i,
  it: /keamanan|security|server|akses|password|infrastruktur|hack|phishing|backup/i,
};

function simSteps(e, t) {
  const steps = [];
  const say = (text, status = 'working') => () => { setStatus(e, status, text, t.id); };
  const isGoal = t.kind === 'goal' && !t.synth;
  const team = teamOf(e).filter((x) => x.type === 'ai');
  const canDelegate = e.isLead && !t.synth && t.kind !== 'routine' && depthOf(t) < 2 && team.length > 0 && !t.feedback;

  steps.push(say('Membaca brief'));
  let refs = [];
  steps.push(() => {
    refs = brain.search(`${t.title} ${t.description}`, { scopeEmployeeId: e.id, limit: 4 });
    setStatus(e, 'working', 'Mencari di Brain', t.id);
    logTask(t, e.id, 'tool', `🔎 search_brain("${t.title.slice(0, 60)}") → ${refs.length} hasil`, { results: refs.map((r) => r.title) });
  });

  if (isGoal) {
    steps.push(() => {
      const text = `${t.title} ${t.description}`;
      let divs = Object.entries(ROUTES).filter(([, re]) => re.test(text)).map(([d]) => d);
      if (!divs.length) divs = ['data', 'mkt', 'ops'];
      divs = divs.slice(0, 5);
      const heads = divs.map((d) => emp(div(d)?.leadId)).filter((x) => x && x.id !== e.id);
      const until = Date.now() + 9000;
      for (const h of [e, ...heads]) if (h.status !== 'working' || h.id === e.id) { h.meetingUntil = until; setStatus(h, 'meeting', 'Rapat kickoff goal', h.currentTaskId); }
      event('meeting', e.id, `${e.name} memimpin rapat kickoff dengan ${heads.map((h) => h.name).join(', ')}`, { participants: heads.map((h) => h.id), taskId: t.id });
      logTask(t, e.id, 'thought', `Goal ini menyentuh divisi: ${divs.map((d) => div(d).name).join(', ')}. Saya pecah per divisi.`);
      for (const h of heads) {
        const d = div(h.divisionId);
        const c = createTask({ title: `[${d.short}] ${t.title}`, description: `Bagian ${d.name} dari goal: "${t.title}".\n${t.description}\n\nFokus: ${d.mission}\nOutput: rencana & deliverable konkret untuk divisi ${d.name}.`, assigneeId: h.id, createdBy: e.id, parentId: t.id, priority: t.priority });
        logTask(t, e.id, 'delegate', `➡️ Delegasi ke ${h.name}: ${c.title}`, { childId: c.id });
      }
      t.status = 'waiting';
      logTask(t, e.id, 'waiting', `Menunggu ${heads.length} divisi`);
      return true;
    });
    return steps;
  }

  if (canDelegate) {
    steps.push(() => {
      const busy = (x) => db().tasks.filter((k) => k.assigneeId === x.id && OPEN.has(k.status)).length;
      const strat = div(e.divisionId)?.delegation || 'best_fit';
      const words = `${t.title} ${t.description}`.toLowerCase();
      const fit = (x) => [...x.skills, ...(x.skillRefs || []).map((r) => r.id.replace(/-/g, ' '))].filter((k) => words.includes(String(k).toLowerCase().split(' ')[0])).length;
      const lastGiven = (x) => Math.max(0, ...db().tasks.filter((k) => k.assigneeId === x.id).map((k) => k.createdAt));
      const order = strat === 'round_robin' ? (a, b) => lastGiven(a) - lastGiven(b) : (a, b) => fit(b) - fit(a) || busy(a) - busy(b) || Math.random() - 0.5;
      const count = strat === 'parallel' ? team.length : strat === 'sequential' ? 1 : team.length > 2 ? 2 : 1;
      const pick = [...team].sort(order).slice(0, count);
      logTask(t, e.id, 'thought', `Strategi delegasi ${strat}: ${pick.map((m) => m.name).join(', ')}`);
      for (const m of pick) {
        const c = createTask({ title: `${t.title.replace(/^\[[A-Z]+\]\s*/, '')} — ${m.skills[0]}`, description: `Dari ${e.name}: kerjakan bagian ${m.skills.join(', ')} untuk "${t.title}".\n${t.description.slice(0, 800)}`, assigneeId: m.id, createdBy: e.id, parentId: t.id, priority: t.priority });
        logTask(t, e.id, 'delegate', `➡️ Delegasi ke ${m.name}: ${c.title}`, { childId: c.id });
      }
      t.status = 'waiting';
      logTask(t, e.id, 'waiting', `Menunggu ${pick.length} anggota tim`);
      return true;
    });
    return steps;
  }

  steps.push(say(t.synth ? 'Menggabungkan hasil tim' : 'Menyusun kerangka'));
  steps.push(say(t.synth ? 'Menulis ringkasan' : 'Menulis draft'));
  if (Math.random() < 0.45 && !t.synth) {
    steps.push(() => {
      const mates = teamOf(e).filter((x) => x.type === 'ai');
      const peer = mates[Math.floor(Math.random() * mates.length)];
      if (!peer) return;
      ensureDM(e.id, peer.id);
      const text = `Hai ${peer.name}, aku lagi mengerjakan "${t.title}". Ada masukan dari sisi ${peer.skills[0]}?`;
      postMessage(dmId(e.id, peer.id), e.id, text);
      event('message', e.id, `${e.name} → ${peer.name}: minta masukan`, { targetId: peer.id });
      setStatus(e, 'working', `Diskusi dengan ${peer.name}`, t.id);
      logTask(t, e.id, 'tool', `💬 Diskusi dengan ${peer.name}`);
      setTimeout(() => { postMessage(dmId(e.id, peer.id), peer.id, `Siap! Pastikan selaras dengan [[${refs[0]?.title || 'Nilai Perusahaan'}]] ya.`); }, 2500);
    });
  }
  steps.push(say('Review akhir'));
  steps.push(() => {
    const output = t.synth ? simSynthesis(e, t) : simDeliverable(e, t, refs);
    const summary = t.synth ? `Hasil ${children(t).length} subtugas digabung menjadi satu deliverable.` : `Deliverable ${e.title.toLowerCase()} untuk "${t.title}" siap (mode simulasi).`;
    if (t.routineId === 'r-standup') postMessage('standup', e.id, standupText());
    finishTask(e, t, { summary, output, needsApproval: POLICY_RE.test(t.title) && !t.parentId });
    return true;
  });
  return steps;
}

function standupText() {
  const ts = db().tasks;
  const lines = db().divisions.map((d) => {
    const mine = ts.filter((t) => t.divisionId === d.id);
    return `- **${d.name}**: ${mine.filter((t) => t.status === 'done').length} selesai, ${mine.filter((t) => t.status === 'in_progress').length} berjalan, ${mine.filter((t) => t.status === 'waiting' || t.status === 'review').length} menunggu`;
  });
  return `📋 **Standup otomatis** — ${new Date().toLocaleString('id-ID')}\n${lines.join('\n')}\nPersetujuan tertunda: ${db().approvals.filter((a) => a.status === 'pending').length}`;
}

function simSynthesis(e, t) {
  const cs = children(t);
  return `## Ringkasan Eksekutif\n${t.title} telah dikerjakan oleh ${cs.length} kontributor: ${cs.map((c) => emp(c.assigneeId)?.name).join(', ')}.\n\n` +
    cs.map((c) => `## ${c.title}\n*Oleh ${emp(c.assigneeId)?.name}*${c.noteId ? ` · lihat [[${db().notes.find((n) => n.id === c.noteId)?.title}]]` : ''}\n\n${(c.summary || '').trim()}\n`).join('\n') +
    `\n## Langkah Berikutnya\n1. Owner meninjau dan menyetujui hasil.\n2. Eksekusi dipantau di Kanban.\n3. Evaluasi hasil pada laporan KPI berikutnya ([[SOP Data - Laporan KPI]]).\n\n> ⚠️ Dibuat dalam **mode simulasi** — tambahkan API key Claude di Pengaturan untuk hasil kerja AI sungguhan.`;
}

const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
function simDeliverable(e, t, refs) {
  const topic = t.title.replace(/^\[[A-Z]+\]\s*/, '');
  const ctx = refs.length ? refs.map((r) => `- [[${r.title}]]`).join('\n') : '- (tidak ada referensi spesifik)';
  const blocks = {
    mkt: `## Rencana Konten\n| Hari | Kanal | Format | Hook |\n|---|---|---|---|\n| Sen | Instagram | Carousel | "3 tanda bisnismu butuh otomasi" |\n| Rab | TikTok | Video 30s | "Sebelum vs sesudah ${topic.slice(0, 30)}" |\n| Jum | Blog | Artikel SEO | "Panduan lengkap ${topic.slice(0, 40)}" |\n\n## Draft Copy\n> **Kerja lebih ringan, bisnis lebih kencang.** ${topic} — mulai hari ini, tanpa ribet.\n\n**KPI:** reach ${rnd(20, 80)}rb, CTR ${rnd(15, 40) / 10}%, ${rnd(80, 300)} leads.`,
    sales: `## Pipeline Target\n| Tahap | Jumlah | Nilai (Rp) |\n|---|---|---|\n| Prospek | ${rnd(80, 200)} | - |\n| Qualified | ${rnd(30, 60)} | ${rnd(200, 500)} jt |\n| Proposal | ${rnd(10, 25)} | ${rnd(100, 300)} jt |\n\n## Template Outreach\n> Halo {Nama}, saya lihat {Perusahaan} masih banyak proses manual. Kami bantu UMKM hemat 10 jam/minggu dengan RayFlow. 15 menit minggu ini?`,
    eng: `## User Stories\n- Sebagai owner UMKM, saya ingin ${topic.toLowerCase().slice(0, 60)} agar hemat waktu.\n- Sebagai admin, saya ingin melihat log aktivitas.\n\n## Rencana Teknis\n1. API endpoint + validasi\n2. UI responsif\n3. Unit & integration test\n4. Rilis bertahap (feature flag)\n\n**Estimasi:** ${rnd(3, 12)} hari kerja · Risiko: integrasi pihak ketiga.`,
    cs: `## Template Respons\n> Hai Kak, terima kasih sudah menghubungi kami 🙏 Terkait ${topic.toLowerCase().slice(0, 50)}, berikut langkahnya: ...\n\n## FAQ Baru\n1. Bagaimana memulai? → Ikuti onboarding 3 langkah.\n2. Bisa integrasi WhatsApp? → Bisa, di paket Growth.\n\n**Target:** first response < 15 menit, CSAT ≥ 4.6.`,
    fin: `## Estimasi Anggaran\n| Pos | Rp |\n|---|---|\n| Tools & software | ${rnd(2, 8)}.000.000 |\n| Iklan | ${rnd(10, 30)}.000.000 |\n| Cadangan 10% | ${rnd(1, 4)}.000.000 |\n\n**ROI proyeksi:** ${rnd(150, 400)}% dalam 6 bulan. Pengeluaran > Rp 5 jt memerlukan persetujuan ([[Kebijakan Persetujuan]]).`,
    hr: `## Job Description / Rencana People\n- Peran: ${topic.slice(0, 50)}\n- Tanggung jawab: 5 poin utama\n- Kualifikasi: 3+ tahun pengalaman relevan\n\n## Proses\n1. Screening CV (AI-assisted)\n2. Interview terstruktur\n3. Studi kasus\n4. Offer (persetujuan Owner)`,
    ops: `## Perbandingan Vendor\n| Vendor | Harga | SLA | Skor |\n|---|---|---|---|\n| Vendor A | Rp ${rnd(5, 15)} jt | 99.5% | 8/10 |\n| Vendor B | Rp ${rnd(4, 12)} jt | 99.0% | 7/10 |\n| Vendor C | Rp ${rnd(6, 18)} jt | 99.9% | 9/10 |\n\n## Perbaikan Proses\n- Otomasi 3 langkah manual → hemat ${rnd(5, 20)} jam/minggu.`,
    legal: `## Checklist Risiko\n- [x] Identitas para pihak\n- [x] Klausul liabilitas & batas ganti rugi\n- [ ] Perlindungan data pribadi (UU PDP)\n- [ ] Mekanisme terminasi\n\n**Rekomendasi:** tambahkan klausul DPA dan batas liabilitas 12 bulan nilai kontrak.`,
    data: `## Snapshot KPI\n| Metrik | Aktual | Target | Status |\n|---|---|---|---|\n| Pelanggan baru | ${rnd(40, 110)} | 120 | ${'🟡'} |\n| MRR (Rp jt) | ${rnd(90, 160)} | 150 | 🟢 |\n| NPS | ${rnd(38, 62)} | 50 | 🟡 |\n| Churn | ${rnd(15, 45) / 10}% | <3% | 🟡 |\n\n## Insight\n1. Kanal organik tumbuh paling efisien.\n2. Churn terkonsentrasi di bulan pertama → perkuat onboarding.\n3. Paket Growth punya LTV tertinggi.`,
    exec: `## Ringkasan Eksekutif\n- Tujuan: ${topic}\n- Divisi terlibat: lihat subtugas\n- Risiko utama: kapasitas tim & budget\n\n## Keputusan yang dibutuhkan\n1. Persetujuan prioritas\n2. Persetujuan anggaran`,
  };
  return `## Konteks\nTugas: **${topic}**\n${t.description ? `\n${t.description.slice(0, 500)}\n` : ''}\nReferensi Brain yang dipakai:\n${ctx}\n\n${blocks[e.divisionId] || blocks.exec}\n\n## Langkah Berikutnya\n1. Review oleh ${emp(e.reportsTo)?.name || 'atasan'}\n2. Eksekusi & pantau hasil\n\n> ⚠️ Dibuat dalam **mode simulasi** — tambahkan API key Claude di Pengaturan agar ${e.name} benar-benar bekerja dengan AI.`;
}

// ───────────────────────── chat ─────────────────────────
export const dmId = (a, b) => `dm-${[a, b].sort().join('--')}`;
export function ensureDM(a, b) {
  const id = dmId(a, b);
  if (!db().channels.some((c) => c.id === id)) store.upsert('channels', { id, kind: 'dm', members: [a, b].sort(), name: `${emp(a)?.name} & ${emp(b)?.name}` });
  return id;
}

const WORK_RE = /\b(tolong|buat|buatkan|bikin|susun|siapkan|kerjakan|analisis|tulis|cari|riset|rancang|lakukan|jalankan|pastikan|pelajari|harus|please|create|make|write|draft|prepare)\b/i;

function broadcastScope(ch, text) {
  if (/@(?:all|semua)\b|#(?:all|semua)\b|\b(?:semua|seluruh)\s+(?:ai\s+)?agen/i.test(text)) return { type: 'all' };
  if (/@(?:kepala|heads?)\b/i.test(text)) return { type: 'heads' };
  if (/@(?:staff|staf)\b/i.test(text)) return { type: 'staff' };
  const tags = [...String(text).matchAll(/#([\w-]+)/g)].map((m) => m[1].toLowerCase());
  for (const tag of tags) {
    const channel = db().channels.find((c) => c.kind === 'channel' && (c.id === tag || c.name === tag));
    if (channel?.divisionId) return { type: 'division', id: channel.divisionId };
    const d = db().divisions.find((x) => x.id === tag || x.short?.toLowerCase() === tag || x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === tag);
    if (d) return { type: 'division', id: d.id };
    if (tag !== 'general') return { type: 'tag', tag };
  }
  if (ch.divisionId) return { type: 'division', id: ch.divisionId };
  return null;
}

function scopeTargets(scope) {
  if (!scope) return [];
  if (scope.type === 'division') return [headOf(scope.id)].filter(Boolean);
  if (scope.type === 'heads' || scope.type === 'all' || scope.type === 'staff') return db().divisions.map((d) => headOf(d.id)).filter(Boolean);
  if (scope.type === 'tag') {
    const matched = db().employees.filter((e) => e.type === 'ai' && searchableEmployee(e).includes(scope.tag));
    return [...new Set(matched.map((e) => e.divisionId))].map(headOf).filter(Boolean);
  }
  return [];
}

function dispatchBroadcast(msg, ch, scope) {
  const pa = db().employees.find((e) => e.isPA && e.ownerId === msg.authorId && e.status !== 'offline') || db().employees.find((e) => e.isMaster) || emp('aria');
  const label = scope.type === 'all' ? 'seluruh agen' : scope.type === 'heads' ? 'seluruh kepala divisi' : scope.type === 'staff' ? 'seluruh staf melalui kepala divisi' : scope.type === 'division' ? `divisi ${div(scope.id)?.name}` : `target #${scope.tag}`;
  const root = createTask({ title: msg.text.replace(/@(?:all|semua|kepala|heads?|staff|staf)\b/gi, '').trim().slice(0, 150) || `Instruksi untuk ${label}`, description: `INSTRUKSI BROADCAST dari Owner untuk ${label}:\n${msg.text}\n\nKoordinasikan secara hemat token, minta setiap divisi berbagi pelajaran, lalu sintesis hasilnya.`, assigneeId: pa.id, createdBy: msg.authorId, kind: 'goal', priority: 'high' });
  const targets = [...new Map(scopeTargets(scope).map((e) => [e.id, e])).values()];
  for (const e of targets) {
    const child = createTask({ title: `${root.title} — ${div(e.divisionId)?.name || e.name}`, description: `Bagian dari broadcast ${label}. Diskusikan dengan maksimal 2 staf relevan di divisimu, kerjakan bagian yang sesuai fungsi divisi, bagikan pembelajaran, lalu serahkan sintesis ke ${pa.name}.\n\nInstruksi Owner: ${msg.text}`, assigneeId: e.id, createdBy: msg.authorId, parentId: root.id, priority: 'high' });
    child.massMode = true; store.upsert('tasks', child);
  }
  if (targets.length) { root.status = 'waiting'; store.upsert('tasks', root); }
  postMessage(ch.id, pa.id, `📣 **Broadcast diterima ${label}.** ${targets.length} koordinator divisi sudah masuk antrean bertahap agar tidak kena rate/token limit. Saya akan menyintesis hasilnya.`, { taskId: root.id, broadcast: true, deliveredTo: scope.type === 'all' ? db().employees.filter((e) => e.type === 'ai').length : targets.length });
  event('message', pa.id, `${pa.name} mengonfirmasi broadcast ke ${label}`, { channelId: ch.id, taskId: root.id });
  return root;
}

export async function onHumanMessage(msg) {
  const ch = db().channels.find((c) => c.id === msg.channelId);
  if (!ch) return;
  // In an owner-led meeting agents must not interrupt. The collaboration layer
  // only releases them after the owner explicitly says "selesai".
  if (ch.kind === 'meeting' && collab.handleOwnerMeetingMessage(msg)) return;
  let targets = [];
  if (ch.kind === 'dm') targets = ch.members.filter((m) => m !== msg.authorId).map(emp);
  const scope = broadcastScope(ch, msg.text);
  if (scope) {
    const delivered = scope.type === 'all' ? db().employees.filter((e) => e.type === 'ai').length : scopeTargets(scope).length;
    Object.assign(msg, { broadcast: true, broadcastScope: scope, deliveredTo: delivered }); store.upsert('messages', msg);
    if (WORK_RE.test(msg.text)) { dispatchBroadcast(msg, ch, scope); return; }
    targets.push(db().employees.find((e) => e.isPA && e.ownerId === msg.authorId) || db().employees.find((e) => e.isMaster));
  }
  const mentions = [...msg.text.matchAll(/@([\w-]+)/g)].map((m) => m[1].toLowerCase());
  for (const name of mentions) { const e = db().employees.find((x) => x.id === name || x.name.toLowerCase() === name); if (e) targets.push(e); }
  if (!targets.length && ch.kind === 'channel') targets.push(ch.divisionId ? headOf(ch.divisionId) : db().employees.find((e) => e.isPA && e.ownerId === msg.authorId) || db().employees.find((e) => e.isMaster));
  targets = [...new Set(targets.filter((e) => e && e.type === 'ai'))].slice(0, 3);
  for (const e of targets) replyAs(e, ch, msg).catch((err) => postMessage(ch.id, e.id, `⚠️ Maaf, saya error: ${err.message}`));
}

const TASK_RE = /^(tolong|buat|buatkan|bikin|susun|siapkan|kerjakan|analisis|tulis|cari|riset|rancang|please|create|make|write|draft|prepare)\b/i;

async function replyAs(e, ch, msg) {
  const prev = { status: e.status, text: e.statusText };
  if (e.status === 'idle') setStatus(e, 'chatting', `Membalas ${emp(msg.authorId)?.name}`);
  event('message', msg.authorId, `${emp(msg.authorId)?.name} → ${e.name}: ${msg.text.slice(0, 80)}`, { targetId: e.id, channelId: ch.id });
  try {
    if (llm.isLive() && llm.budgetLeft() > 0) {
      const history = db().messages.filter((m) => m.channelId === ch.id).slice(-16);
      const convo = history.map((m) => `${emp(m.authorId)?.name || m.authorId}: ${m.text}`).join('\n');
      const chatTools = toolsFor(e).filter((x) => ['search_brain', 'read_note', 'write_note', 'web_search', 'calculate', 'company_status', 'ask_colleague', 'convene_meeting', 'schedule_job', 'list_jobs', 'visit_url', 'google_sheets_append', 'google_drive_create', 'google_calendar_create'].includes(x.name)).concat([{
        name: 'create_task', description: 'Buat tugas baru (untuk dirimu sendiri atau rekan) bila manusia meminta pekerjaan yang butuh waktu.', input_schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, assignee_id: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['title', 'description'] },
      }]);
      const messages = [{ role: 'user', content: `Percakapan di ${ch.kind === 'dm' ? 'DM' : '#' + ch.name}:\n${convo}\n\nBalas pesan terakhir dari ${emp(msg.authorId)?.name} sebagai ${e.name}. Singkat dan membantu. Jika diminta pekerjaan besar, buat tugas dengan create_task lalu konfirmasi.` }];
      const pseudo = { id: 'chat', title: 'chat', log: [], transient: true };
      for (let i = 0; i < 5; i++) {
        const res = await llm.call({ system: systemPrompt(e), messages, tools: chatTools, model: e.model || llm.defaultModels()[e.isPA || e.isMaster || e.isLead ? 'worker' : 'small'], employee: e, maxTokens: 4000 });
        messages.push({ role: 'assistant', content: res.content });
        const uses = res.content.filter((b) => b.type === 'tool_use');
        if (!uses.length) { postMessage(ch.id, e.id, (llm.textOf(res) || '👍').replace(new RegExp(`^\\**${e.name}\\**\\s*:\\s*\\**\\s*`), '')); break; }
        const results = [];
        for (const u of uses) {
          let out;
          try {
            if (u.name === 'create_task') {
              const t = createTask({ title: u.input.title, description: u.input.description, assigneeId: emp(u.input.assignee_id) ? u.input.assignee_id : e.id, createdBy: msg.authorId, priority: u.input.priority || 'medium' });
              out = `Tugas ${t.id} dibuat untuk ${emp(t.assigneeId).name}.`;
            } else out = await runTool(e, pseudo, u.name, u.input, {});
          } catch (err) { out = `Error: ${err.message}`; }
          results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out) });
        }
        messages.push({ role: 'user', content: results });
      }
    } else {
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 1200));
      const text = msg.text.replace(/@[\w-]+/g, '').trim();
      if (TASK_RE.test(text)) {
        const t = createTask({ title: text.slice(0, 100), description: text, assigneeId: e.id, createdBy: msg.authorId, priority: 'medium' });
        postMessage(ch.id, e.id, `Siap! Sudah saya masukkan ke antrean kerja: **${t.title}**. Pantau progresnya di Kanban atau lihat saya di kantor 3D 👀`, { taskId: t.id });
      } else {
        const r = brain.search(text, { limit: 2 });
        const open = db().tasks.filter((t) => t.assigneeId === e.id && OPEN.has(t.status));
        postMessage(ch.id, e.id, `Halo! Saya ${e.name}, ${e.title}. ${open.length ? `Saat ini saya pegang ${open.length} tugas (terbaru: "${open.at(-1).title}").` : 'Saat ini saya sedang luang.'}${r.length ? `\nMungkin relevan: ${r.map((x) => `[[${x.title}]]`).join(', ')}` : ''}\nMinta saya "buat …" / "tolong …" untuk memberi tugas. _(mode simulasi)_`);
      }
    }
  } finally {
    if (e.status === 'chatting') setStatus(e, prev.status === 'chatting' ? 'idle' : prev.status, prev.status === 'chatting' ? 'Siap bekerja' : prev.text);
  }
}

export const running = () => [...jobs.entries()].map(([taskId, j]) => ({ taskId, empId: j.empId, mode: j.mode }));
