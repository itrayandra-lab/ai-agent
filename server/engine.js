// Autonomous work engine: schedules tasks, runs agents (Claude or simulation), delegation, approvals, routines, chat.
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
import { CAPABILITIES, CAP_IDS, autoActivate } from './catalog.js';
import * as lib from './librarian.js';
import * as collab from './collab.js';
import * as browser from './browser.js';
import * as otomasi from './n8n.js';
import * as staff from './staff/index.js';   // staf = alur n8n + karakter 3D; manajer divisi memakai satu tool "staf" (docs/ARSITEKTUR-STAF-N8N.md)
import * as gov from './governor.js';
import * as org from './org.js';
import * as learn from './skills-learn.js';   // belajar mandiri: skill buatan agen, memori kecil, tinjauan pasca-tugas
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
const budgetWarnedWs = new Set();   // per workspace

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

/** Quest contract: every task says what "done" looks like. Agents that do not say it get a sensible default per kind, so nothing is open-ended. */
function defaultExpected(kind, title) {
  if (kind === 'goal') return `Laporan akhir untuk "${String(title).slice(0, 80)}": hasil per bagian, keputusan yang dibutuhkan dari Owner, dan langkah berikutnya. Setiap angka/fakta disertai sumber; yang tidak ada datanya ditulis "data tidak tersedia".`;
  if (kind === 'routine') return 'Ringkasan singkat hasil rutinitas (apa yang dicek, temuan, tindak lanjut) dengan sumber.';
  return `Dokumen hasil "${String(title).slice(0, 80)}" yang siap dipakai, disertai sumber untuk setiap fakta/angka dan daftar hal yang belum bisa dipenuhi.`;
}
export function createTask({ title, description = '', assigneeId, createdBy = 'owner', parentId = null, priority = 'medium', kind = 'task', routineId = null, dueAt = null, expected = '', stage = 0 }) {
  gov.checkCreate({ title, createdBy, parentId, kind, assigneeId });
  const a = emp(assigneeId) || emp('aria');
  const parent = parentId ? task(parentId) : null;
  const t = {
    id: uid('t'), title: String(title).slice(0, 160), description: String(description).slice(0, 6000),
    expected: String(expected || '').trim().slice(0, 600) || defaultExpected(kind, title),   // definition of done
    rootId: parent ? (parent.rootId || parent.id) : null, stage: Math.max(0, Math.min(5, stage | 0)),
    divisionId: a.divisionId, assigneeId: a.id, createdBy, parentId, priority, kind, routineId,
    dueAt: dueAt || task(parentId)?.dueAt || Date.now() + ({ high: 1, medium: 3, low: 7 }[priority] || 3) * (kind === 'routine' ? 0.25 : 1) * 864e5,
    status: 'todo', output: '', summary: '', revisions: 0, failures: 0, log: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  if (!t.rootId) t.rootId = t.id;
  store.upsert('tasks', t);
  logTask(t, createdBy, 'created', `Tugas dibuat untuk ${a.name}`);
  const by = emp(createdBy);
  if (parent && depthOf(t) <= 2) goalNote(t, createdBy, `📨 **${by?.name || 'Sistem'} → ${a.name}**${t.stage ? ` · tahap ${t.stage}` : ''}: ${t.title}\n_Hasil diharapkan:_ ${t.expected.slice(0, 220)}`);
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
    // one pass per workspace, each inside its own data context; one failing workspace never stops the others
    for (const ws of store.ids()) { try { await store.run(ws, tick); } catch (err) { console.error(`tick error [${ws}]`, err); } }
    timer = setTimeout(loop, Math.max(800, db().settings.tickMs || 2500));
  };
  timer = setTimeout(loop, 1000);
}
export function stop() { clearTimeout(timer); timer = null; }

async function tick() {
  const { settings } = db();
  const now = Date.now();
  // meetings end
  try { collab.sweepOrphanMeetings(); } catch (err) { console.warn('[tick] sweep rapat:', err.message); }   // dead meetings must not keep agents "busy" or capture chat
  for (const e of db().employees) if (e.meetingUntil && e.meetingUntil < now) { delete e.meetingUntil; delete e.kickoff; if (e.status === 'meeting') setStatus(e, e.currentTaskId ? 'working' : 'idle', e.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja'); }
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
    } else if (cs.length && cs.every((c) => c.status === 'done' || c.status === 'blocked')) {
      // a blocked child must not leave the parent waiting forever: synthesize from what finished, or block when nothing did
      if (cs.some((c) => c.status === 'done')) { t.status = 'todo'; t.synth = true; logTask(t, 'system', 'resumed', `${cs.filter((c) => c.status === 'blocked').length} subtugas diblokir — sintesis dari yang selesai`); }
      else { t.status = 'blocked'; logTask(t, 'system', 'error', 'Semua subtugas diblokir — tugas induk ikut diblokir'); event('alert', 'system', `"${t.title}" diblokir karena semua subtugasnya gagal`, { taskId: t.id }); }
    } else if (!cs.length && !jobs.has(t.id) && now - (t.waitingSince || (t.waitingSince = now)) > 30000) {
      // orphan: waiting for subtasks that were never created — put it back to work instead of hanging
      t.status = 'todo'; delete t.synth; delete t.waitingSince; t.noDelegate = true;
      logTask(t, 'system', 'resumed', 'Tidak ada subtugas yang dibuat — tugas dikerjakan langsung oleh assignee');
    }
  }

  const live = llm.isLive();
  const liveRunning = [...jobs.values()].filter((j) => j.mode === 'live').length;
  let slots = live ? Math.max(0, settings.maxConcurrent - liveRunning) : 6;
  const order = { high: 0, medium: 1, low: 2 };
  const queue = db().tasks.filter((t) => t.status === 'todo' && !jobs.has(t.id) && (!t.retryAt || t.retryAt <= now) && stageReady(t))
    .sort((a, b) => order[a.priority] - order[b.priority] || a.createdAt - b.createdAt);
  for (const t of queue) {
    if (slots <= 0) break;
    const e = emp(t.assigneeId);
    if (!e || e.type !== 'ai' || e.status === 'offline') continue;
    if ([...jobs.values()].some((j) => j.empId === e.id && (j.ws || 'main') === store.current())) continue;   // same ids exist in other workspaces
    if (e.status === 'meeting' && e.meetingUntil && e.meetingUntil > now) continue;   // an agent in a meeting does not start a job in the middle of it
    if (live && llm.budgetLeft() <= 0) {
      if (!budgetWarnedWs.has(store.current())) { budgetWarnedWs.add(store.current()); event('alert', 'system', `Budget harian $${settings.dailyBudgetUSD} habis — agen live dijeda. Naikkan budget di Pengaturan.`); }
      break;
    }
    budgetWarnedWs.delete(store.current());
    slots--;
    startJob(e, t, live ? 'live' : 'sim');
  }

  // advance simulation jobs one step each
  for (const [taskId, j] of jobs) {
    if (j.mode !== 'sim' || j.busy || (j.ws || 'main') !== store.current()) continue;   // each workspace advances only its own jobs
    if (Math.random() < 0.25) continue; // natural jitter so the office doesn't move in lockstep
    j.busy = true;
    try {
      const step = j.steps[j.i++];
      if (!step) { jobs.delete(taskId); continue; }
      const done = step();
      if (done || j.i >= j.steps.length) endJob(taskId);
    } catch (err) {
      // a crashing step used to leave the task "in_progress" forever with no job: route it through the normal failure/retry/recovery path
      console.error(err); const jt = task(taskId), je = emp(j.empId); endJob(taskId);
      if (jt && je && jt.status === 'in_progress') failTask(je, jt, err);
    }
    finally { j.busy = false; }
  }
}

/** stage gate: a stage-2 subtask waits until every earlier-stage sibling is done (riset dulu, baru eksekusi), so later work builds on real results and tokens are not spent on guesses */
function stageReady(t) {
  if (!t.stage || !t.parentId) return true;
  const p = task(t.parentId); if (!p) return true;
  const earlier = children(p).filter((c) => c.stage && c.stage < t.stage);
  if (!earlier.every((c) => c.status === 'done' || c.status === 'blocked' || c.status === 'cancelled')) return false;
  p.stagesOpened = p.stagesOpened || [];
  if (earlier.length && !p.stagesOpened.includes(t.stage)) {
    p.stagesOpened.push(t.stage); store.upsert('tasks', p);
    const prev = earlier.filter((c) => c.status === 'done').map((c) => `${c.title.slice(0, 60)} (${emp(c.assigneeId)?.name})`).join('; ');
    goalNote(p, p.assigneeId, `▶️ **Tahap ${t.stage} dimulai.** Dibangun di atas hasil tahap sebelumnya: ${prev || '-'}`);
  }
  return true;
}
function startJob(e, t, mode) {
  t.status = 'in_progress'; t.startedAt = t.startedAt || Date.now();
  logTask(t, e.id, 'started', t.synth ? 'Mulai menyusun hasil dari subtugas' : (mode === 'live' ? `Mulai bekerja (${llm.provider() === 'groq' ? 'Groq' : 'Claude'})` : 'Mulai bekerja (simulasi)'));
  setStatus(e, 'working', t.synth ? 'Menyusun hasil tim' : 'Membaca brief', t.id);
  event('task_started', e.id, `${e.name} mulai mengerjakan "${t.title}"`, { taskId: t.id });
  if (mode === 'live') {
    jobs.set(t.id, { empId: e.id, mode, ws: store.current() });
    runLive(e, t).catch((err) => failTask(e, t, err)).finally(() => endJob(t.id));
  } else {
    jobs.set(t.id, { empId: e.id, mode, i: 0, steps: simSteps(e, t), ws: store.current() });
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
    } else if ((t.recoveryCount || 0) >= 2 || t.failures >= 5) t.status = 'blocked';   // nobody to hand over to: stop after 5 failures instead of retrying forever
  }
  logTask(t, e.id, 'error', `Error: ${msg.slice(0, 400)}${t.status === 'blocked' ? ' — diblokir setelah recovery lintas agen' : ' — retry adaptif dijadwalkan'}`);
  if (t.status === 'blocked') goalNote(t, e.id, `⚠️ **Macet:** ${t.title} (${e.name}). Alasan: ${msg.slice(0, 180)}\nBuka **Butuh kamu** untuk mencoba lagi atau memindahkan tugas.`);
  event('alert', e.id, `${e.name} gagal mengerjakan "${t.title}": ${msg.slice(0, 160)}`, { taskId: t.id });
}

// ───────────────────────── completion / approvals ─────────────────────────
const POLICY_RE = /\b(publikasi|publish|posting|kontrak|contract|penawaran resmi|harga|diskon|budget|anggaran|bayar|payment|transfer|rekrut|offer letter|pecat|kebijakan)\b/i;

/** Check the evidence an agent cites: a Brain note that exists, a URL, an integration receipt, or real tool output gathered while working. Claims alone do not count. */
function verifyEvidence(list, toolEvidence = 0) {
  const items = (Array.isArray(list) ? list : String(list || '').split(/\n|;/)).map((x) => String(x || '').trim()).filter((x) => x && !/^(-|tidak ada|none|n\/a)$/i.test(x)).slice(0, 12);
  const checked = items.map((text) => {
    const title = text.replace(/^\[\[|\]\]$/g, '').replace(/^.*\[\[([^\]|]+).*$/, '$1').trim();
    // a verified note (Owner / Drive / System), a URL or an integration receipt; an agent's own draft note is NOT evidence (it could cite what it just wrote)
    const ok = /https?:\/\/\S+/.test(text) || brain.isVerified(brain.findNote(title)) || /\b(receipt|spreadsheetId|documentId|eventId|range)\b|docs\.google|drive\.google/i.test(text);
    return { text: text.slice(0, 200), ok };
  });
  return { checked, verified: checked.filter((x) => x.ok).length + (toolEvidence > 0 ? 1 : 0) };
}
const needsOwnerReview = (t) => !t.parentId && t.kind !== 'routine' && emp(t.createdBy)?.type === 'human' && db().settings.ownerReview !== false;

function finishTask(e, t, { summary, output, needsApproval, evidence = [], gaps = '', toolEvidence = 0 }) {
  t.output = String(output || summary || '').slice(0, 40000);
  t.summary = String(summary || '').slice(0, 600);
  const ev = verifyEvidence(evidence, toolEvidence);
  t.evidence = ev.checked; t.gaps = String(gaps || '').trim().slice(0, 800); t.unverified = ev.verified === 0;
  if (t.unverified) logTask(t, e.id, 'note', '⚠️ Selesai tanpa bukti yang bisa dicek (catatan Brain, URL, receipt, atau hasil tool). Dianggap asumsi sampai ditinjau.');
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
  // "Butuh kamu": what a human asked for is reviewed by that human before it counts as done (auto-approve never skips this)
  if (needsOwnerReview(t)) {
    t.status = 'review';
    const a = store.upsert('approvals', { id: uid('ap'), kind: 'review', taskId: t.id, requesterId: e.id, approverId: t.createdBy, title: t.title, summary: t.summary, expected: t.expected, evidence: t.evidence, gaps: t.gaps, unverified: t.unverified, status: 'pending', createdAt: Date.now() });
    logTask(t, e.id, 'approval', 'Hasil diserahkan untuk direview Owner', { approvalId: a.id });
    event('approval_requested', e.id, `${e.name} menyerahkan "${t.title}" untuk direview`, { taskId: t.id, targetId: t.createdBy });
    goalNote(t, e.id, `🔎 **Hasil siap direview:** ${t.title}\n${t.summary || ''}\n_Bukti:_ ${t.evidence.filter((x) => x.ok).length}/${t.evidence.length} terverifikasi${t.unverified ? ' — ⚠️ belum ada bukti yang bisa dicek' : ''}${t.gaps ? `\n_Belum terpenuhi:_ ${t.gaps.slice(0, 240)}` : ''}\nSetujui atau minta revisi di **Butuh kamu**, atau balas di sini.`, { approvalId: a.id });
    return;
  }
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
    learn.afterTask(e, t, 'done');
  }
  // personal assistants report finished goals back to their human in DM
  if (!t.parentId && emp(t.createdBy)?.type === 'human') {
    const pa = db().employees.find((x) => x.isPA && x.ownerId === t.createdBy);
    const text = `✅ **${t.title}** selesai${e.id !== pa?.id ? ` (dikerjakan ${e.name})` : ''}.\n${t.summary || ''}${t.noteId ? `\nHasil lengkap: [[${db().notes.find((n) => n.id === t.noteId)?.title || t.title}]]` : ''}`;
    if (t.kind === 'goal') goalNote(t, pa?.id || e.id, text);
    else if (pa) postMessage(ensureDM(pa.id, t.createdBy), pa.id, text, { taskId: t.id });
  } else if (t.parentId) goalNote(t, e.id, `✅ **${e.name}** menyelesaikan: ${t.title}${t.summary ? ` — ${t.summary.slice(0, 200)}` : ''}${t.unverified ? '\n⚠️ _tanpa bukti yang bisa dicek; dianggap asumsi_' : ''}`);
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
  if (a.kind === 'automation') {   // kartu otomasi: menyetujui = menyalakan otomasi yang sudah lolos uji
    Object.assign(a, { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: userId, decidedAt: Date.now(), feedback });
    store.upsert('approvals', a);
    otomasi.onDecision(a, decision).catch((err) => console.warn('[otomasi]', err.message));
    return a;
  }
  if (a.kind === 'browser_action') {   // persetujuan aksi browser: hanya membuka/menutup satu aksi, tidak menyelesaikan atau merevisi tugasnya
    Object.assign(a, { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: userId, decidedAt: Date.now(), feedback });
    store.upsert('approvals', a);
    event(decision === 'approve' ? 'approved' : 'rejected', userId, `${emp(userId)?.name || 'Owner'} ${decision === 'approve' ? 'menyetujui' : 'menolak'} aksi browser "${a.title}"`, { taskId: a.taskId, targetId: a.requesterId });
    return a;
  }
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
    if (e?.type === 'ai') learn.afterTask(e, t, 'revisi');
    logTask(t, userId, 'rejected', `${who} meminta revisi: ${feedback || '(tanpa catatan)'}`);
    event('rejected', userId, `${who} meminta revisi "${t.title}"`, { taskId: t.id, targetId: e.id });
    if (a.kind === 'review') goalNote(t, userId, `↩️ **Revisi diminta** untuk "${t.title}": ${feedback || '(tanpa catatan)'}`);
  }
  return a;
}

export function autoApprovePending() {
  if (db().settings.autoApprove === false) return 0;
  const pending = db().approvals.filter((a) => a.status === 'pending' && a.kind !== 'review' && a.kind !== 'browser_action' && a.kind !== 'automation');   // Owner reviews are never auto-approved
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
  const t = createTask({ title, description, assigneeId: (pa || master).id, createdBy: userId, kind: 'goal', priority });
  if (emp(userId)?.type === 'human') ensureGoalThread(t);   // the goal's own discussion: progress, questions and the review all land here
  return t;
}

// ───────────────────────── context helpers ─────────────────────────
function teamOf(e) { return db().employees.filter((x) => x.divisionId === e.divisionId && x.id !== e.id); }
function leads() { return db().divisions.map((d) => emp(d.leadId)).filter(Boolean); }

function taskContext(t) {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [`# Tugas: ${t.title}`, `ID: ${t.id} · Prioritas: ${t.priority} · Jenis: ${t.kind} · Tanggal hari ini: ${today} (gunakan tahun ini saat riset data terbaru)`];
  if (t.description) lines.push('', '## Deskripsi', t.description);
  lines.push('', '## Hasil yang diharapkan (definisi selesai)', t.expected || defaultExpected(t.kind, t.title), 'Saat complete_task: isi "evidence" hanya dengan sumber yang benar-benar ada ([[catatan Brain]], URL, receipt) dan isi "gaps" dengan bagian yang belum terpenuhi. Jujur lebih baik daripada lengkap tapi karangan.');
  if (t.stage > 1 && t.parentId) {
    const prev = children(task(t.parentId)).filter((c) => c.stage && c.stage < t.stage && c.status === 'done');
    if (prev.length) { lines.push('', '## Hasil tahap sebelumnya (pakai sebagai dasar, jangan diulang)'); for (const c of prev) lines.push('', `### ${c.title} — ${emp(c.assigneeId)?.name}${c.unverified ? ' (tanpa bukti: perlakukan sebagai asumsi)' : ''}`, (c.summary || c.output || '').slice(0, 1500)); }
  }
  let p = t.parentId && task(t.parentId); let d = 0;
  while (p && d < 3) { lines.push('', `## Konteks tugas induk (${emp(p.assigneeId)?.name}): ${p.title}`, p.description.slice(0, 1200)); p = p.parentId && task(p.parentId); d++; }
  if (t.feedback) lines.push('', `## Feedback revisi dari manusia (revisi ke-${t.revisions})`, t.feedback, 'Perbaiki hasil sebelumnya:', t.output.slice(0, 4000));
  if (t.synth) {
    lines.push('', '## Hasil subtugas (sudah selesai) — gabungkan menjadi hasil akhir');
    lines.push('Bagian bertanda TANPA BUKTI adalah asumsi: jangan sajikan sebagai fakta. Gabungkan juga semua "belum terpenuhi" menjadi satu daftar jujur di hasil akhir.');
    for (const c of children(t)) lines.push('', `### ${c.title} — ${emp(c.assigneeId)?.name}${c.status === 'blocked' ? ' (MACET, tidak ada hasil)' : c.unverified ? ' (TANPA BUKTI)' : ''}`, (c.output || c.summary || '').slice(0, 5000), c.gaps ? `Belum terpenuhi: ${c.gaps}` : '', c.evidence?.length ? `Sumber: ${c.evidence.filter((x) => x.ok).map((x) => x.text).join('; ')}` : '');
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
  const ownLead = leads().find((x) => x.divisionId === e.divisionId && x.id !== e.id);
  const heads = (e.isLead || e.isPA || e.isMaster ? leads().filter((x) => x.id !== e.id) : [ownLead].filter(Boolean)).map((x) => `- ${x.id}: ${x.name}, ${x.title} — ${div(x.divisionId).name}`).join('\n');
  const orchestrator = e.isPA || e.isMaster;
  const everyone = orchestrator ? db().employees.filter((x) => x.type === 'ai' && x.id !== e.id && !x.isPA).map((x) => `- ${x.id}: ${x.name} · ${x.title} · ${div(x.divisionId)?.short}${x.isLead ? ' · ORKESTRATOR DIVISI' : ''}${x.isMaster ? ' · MASTER ORCHESTRATOR' : ''}`).join('\n') : '';
  const chans = db().channels.filter((c) => c.kind === 'channel').map((c) => `#${c.id}`).join(', ');
  const skills = promptSkills(e, currentTask);
  const caps = CAPABILITIES.filter((c) => (c.required || (e.tools || CAP_IDS).includes(c.id)) && !(currentTask?.kind === 'routine' && ROUTINE_BLOCK.has(c.id)) && !(currentTask?.massMode && MASS_BLOCK.has(c.id)));
  const kb = (e.knowledgeIds || []).map((id) => db().notes.find((n) => n.id === id)).filter((n) => brain.canRead(n, { audience: e.audience || 'internal' }));   // enforce visibility on attached knowledge too
  let kbBudget = orchestrator ? 9000 : 6000; // characters; the rest of a note is one Brain search away
  const kbText = kb.map((n) => { const body = n.content.slice(0, Math.max(0, Math.min(2400, kbBudget))).replace(/^#{1,6}\s+/gm, '### '); kbBudget -= body.length; return body ? `## ${n.title}\n${body}` : ''; }).filter(Boolean).join('\n\n');
  const canDelegate = caps.some((c) => c.id === 'create_subtask');
  const sections = [
    `# IDENTITAS\nKamu adalah ${e.name}, ${e.title} di divisi ${d.name}${e.team ? ` (tim ${e.team}: ${db().employees.filter((x) => x.team === e.team && x.id !== e.id && x.divisionId === e.divisionId).map((x) => x.name).join(", ") || "-"})` : ""} perusahaan ${company.name} ("${company.tagline}"). Kamu karyawan AI otonom di kantor yang dipantau dan diawasi manusia. Jangan menyebut dirimu model AI generik; kamu ${e.name}.`,
    e.instructions?.trim() && `# INSTRUKSI SISTEM\n${e.instructions.trim()}`,
    `# TENTANG KAMU\n${e.about || e.persona}`,
    `# TUGAS & FUNGSI\n${e.taskAndFunction || ''}\nMisi divisi: ${d.mission}`,
    learn.skillSection(e, currentTask, skills, skills.length && `# SKILL\nKamu memiliki akses ke seluruh ${e.skillRefs?.length || 0} skill perusahaan. Demi fokus, berikut metode paling relevan untuk pekerjaan ini:\n${skills.map((r) => `## ${r.s.name} · proficiency ${r.proficiency}/10\n${r.s.promptSnippet}${r.s.usageGuide ? `\nKapan dipakai: ${r.s.usageGuide}` : ''}`).join('\n\n')}`),
    `# TOOL YANG BOLEH KAMU PAKAI\n${caps.map((c) => `- ${c.id}: ${c.guide}`).join('\n')}`,
    browser.promptSection(e),
    otomasi.promptSection(e),
    staff.promptSection(e),
    kbText && `# KNOWLEDGE WAJIB (sudah dilampirkan untukmu)\n${kbText}`,
    orchestrator && `# HIERARKI KOMANDO\n${e.isPA ? `Kamu asisten pribadi ${emp(e.ownerId)?.name}. Kamu memahami maksud user, merencanakan, lalu menggerakkan seluruh perusahaan: goal lintas divisi → serahkan ke Master Orchestrator (${db().employees.find((x) => x.isMaster)?.name}); pekerjaan satu divisi → orkestrator divisinya; pekerjaan spesifik → langsung ke individu. Gunakan convene_meeting untuk keputusan bersama dan schedule_job untuk pekerjaan berulang. Laporkan hasil akhir dengan ringkas ke user.` : 'Kamu Master Orchestrator: tunduk pada asisten pribadi user, mengoordinasikan semua orkestrator divisi, memecah goal lintas divisi, memimpin rapat lintas divisi, dan menyintesis hasil.'}\nSemua karyawan AI yang bisa kamu tugaskan:\n${everyone}`,
    `# ORGANISASI\nRekan satu divisi:\n${team}\nHead divisi lain:\n${heads}\nChannel: ${chans}`,
    `# CARA BEKERJA\n- Kerjakan tugas sampai tuntas. Cari konteks tambahan di Brain bila knowledge di atas belum cukup.\n- Untuk jumlah, daftar, ID, status, atau cakupan agen/divisi, company_status adalah sumber kebenaran live. Jangan memakai catatan Brain sebagai registry karena bisa usang.\n- ${currentTask?.massMode ? 'MODE MASSAL HEMAT TOKEN: kamu mewakili divisimu. Konsultasikan maksimal 2 staf paling relevan, tantang asumsi mereka, lalu buat satu sintesis. Jangan membuat subtugas/rapat/jadwal baru; bagikan pelajaran ke channel divisi agar seluruh staf menerima.' : e.isLead && canDelegate ? `Sebagai head: delegasikan bagian yang lebih cocok untuk anggota tim atau divisi lain (maks 5 subtugas). Strategi divisi: ${DELEGATION[d.delegation] || DELEGATION.best_fit} Setelah mendelegasikan, akhiri giliranmu; kamu akan dipanggil lagi dengan hasil subtugas untuk disintesis.` : canDelegate ? 'Kerjakan sendiri. Delegasikan hanya bila jelas butuh keahlian divisi lain (ke head divisi itu).' : 'Kerjakan sendiri.'}\n- Jika tugas berisi hasil subtugas, gabungkan menjadi satu hasil akhir yang utuh — jangan delegasi lagi.\n- Simpan pengetahuan jangka panjang dengan write_note dan tautkan [[Judul Catatan]].\n- ${caps.some((c) => c.id === 'web_search') ? 'Untuk data pasar, harga, regulasi, tren, atau fakta terbaru, gunakan web_search dan cantumkan sumbernya. Jangan mengarang angka.' : 'Kamu tidak punya akses internet; tandai asumsi dengan jelas, jangan mengarang fakta.'}\n- Gunakan calculate untuk semua hitungan angka (budget, proyeksi, persentase).\n- EKSEKUSI EKSTERNAL: jangan pernah mengatakan data sudah masuk Google Sheets/Drive/Calendar atau sistem lain hanya berdasarkan rencana. Wajib panggil tool integrasi dan cantumkan receipt berupa ID/URL/range. Bila konektor belum aktif atau tool gagal, katakan BELUM TEREKSEKUSI.\n- Jika tool gagal atau data tidak ditemukan, tulis jelas "data tidak tersedia" beserta alasannya. DILARANG mengarang nama, angka, harga, atau sumber.\n- DISIPLIN LINGKUP: kerjakan hanya yang diminta brief. Jangan menciptakan proyek, produk, klien, atau inisiatif baru yang tidak diminta. Kamu tidak terhubung ke sistem eksternal (Teams, Slack, Planner, PowerBI, email, CRM) kecuali lewat tool yang tersedia — hasilmu berupa dokumen/rencana di Brain.\n- Hemat: gunakan tool seperlunya (biasanya 1-4 panggilan), lalu selesaikan.`,
    `# ESKALASI\n${e.escalation || ''}\nJika menyentuh Kebijakan Persetujuan (publikasi, uang, kontrak, HR, data pribadi), selesaikan dengan request_approval.`,
    `# FORMAT OUTPUT\nGunakan ${company.language}. Output akhir lewat complete_task dalam format ${(e.outputFormat || 'markdown').toUpperCase()}, lengkap dan siap pakai (bukan sekadar ringkasan). Langsung ke isi tanpa basa-basi pembuka.`,
  ];
  sections.push(collab.learningSection(e), collab.selfSection(e), ...learn.promptTail(e, currentTask)); // volatile parts last so the prompt prefix stays cacheable
  return sections.filter(Boolean).join('\n\n---\n\n');
}

/** Task-specific context retrieved from the brain (kept out of the cached system prompt). */
function retrievedContext(e, t) {
  const attached = new Set(e.knowledgeIds || []);
  const hits = brain.search(`${t.title} ${t.description}`, { scopeEmployeeId: e.id, limit: 6, audience: e.audience || 'internal' })
    .filter((h) => !attached.has(brain.findNote(h.title)?.id)).slice(0, 3);
  const mem = brain.findNote(`Memori ${e.name}`);
  const memLines = mem ? mem.content.split('\n').slice(2).filter(Boolean).slice(-6).join('\n') : '';
  return [
    hits.length && `## Catatan Brain yang mungkin relevan (hanya yang "terverifikasi" boleh dipakai sebagai fakta)\n${hits.map((h) => `- [[${h.title}]] (${h.folder}; ${h.trust}): ${h.snippet}`).join('\n')}`,
    memLines && `## Memori kerjamu terbaru\n${memLines}`,
  ].filter(Boolean).join('\n\n');
}

const toolsFor = (e, task) => TOOLS.filter((t) => t.name === 'complete_task' || (!(t.name.startsWith('google_') && !collab.googleWorkspaceConfigured()) && (e.tools || CAP_IDS).includes(t.name) && !(task?.kind === 'routine' && ROUTINE_BLOCK.has(t.name)) && !(task?.massMode && MASS_BLOCK.has(t.name))));

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
  { name: 'create_subtask', description: 'Delegasikan subtugas ke rekan (pakai id karyawan). Tugas induk akan menunggu sampai semua subtugas selesai. Pakai "stage" untuk urutan: tahap 2 baru dimulai setelah semua tahap 1 selesai (mis. riset dulu, baru eksekusi).', input_schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string', description: 'Brief lengkap: konteks, batasan' }, expected: { type: 'string', description: 'Hasil yang diharapkan / definisi selesai: apa persisnya yang diserahkan dan kriterianya' }, assignee_id: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] }, stage: { type: 'integer', description: '1 = langsung jalan; 2/3 = menunggu tahap sebelumnya selesai' } }, required: ['title', 'description', 'expected', 'assignee_id'] } },
  { name: 'send_message', description: 'Kirim pesan ke channel (mis. "general", "standup", "div-mkt") atau DM ke karyawan (pakai id karyawan).', input_schema: { type: 'object', properties: { to: { type: 'string' }, text: { type: 'string' } }, required: ['to', 'text'] } },
  { name: 'complete_task', description: 'Selesaikan tugas dengan output akhir, bukti, dan hal yang belum terpenuhi.', input_schema: { type: 'object', properties: { summary: { type: 'string', description: '1-2 kalimat' }, output: { type: 'string', description: 'Hasil lengkap dalam Markdown' }, evidence: { type: 'array', items: { type: 'string' }, description: 'Sumber yang bisa dicek: [[Judul catatan Brain]], URL, atau receipt ID. Kosong bila tidak ada; jangan mengarang.' }, gaps: { type: 'string', description: 'Bagian dari "hasil yang diharapkan" yang BELUM terpenuhi atau datanya tidak tersedia; string kosong bila semua terpenuhi' } }, required: ['summary', 'output', 'evidence', 'gaps'] } },
  { name: 'organize_brain', description: 'Audit kerapian Brain: jumlah per folder, catatan yang belum terklasifikasi (dengan saran folder), judul buruk (dengan saran), dan kandidat duplikat.', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: 'maks item per daftar (5-40)' } }, required: ['limit'] } },
  { name: 'move_note', description: 'Pindahkan catatan ke folder "<Nama Divisi>/<Jenis>" (Jenis: Research, Strategy, Plan, Report, SOP, Policy, Content, Design, Analysis, Meeting, Data, Technical, Training, Knowledge).', input_schema: { type: 'object', properties: { note: { type: 'string', description: 'id atau judul' }, folder: { type: 'string' } }, required: ['note', 'folder'] } },
  { name: 'rename_note', description: 'Ganti judul catatan; semua [[wikilink]] ke catatan ini otomatis diperbarui.', input_schema: { type: 'object', properties: { note: { type: 'string', description: 'id atau judul' }, new_title: { type: 'string' } }, required: ['note', 'new_title'] } },
  { name: 'merge_notes', description: 'Gabungkan catatan duplikat ke catatan utama; duplikat diarsipkan dengan tautan.', input_schema: { type: 'object', properties: { primary: { type: 'string' }, duplicates: { type: 'array', items: { type: 'string' } } }, required: ['primary', 'duplicates'] } },
  { name: 'build_training_set', description: 'Bangun dataset fine-tuning (train/eval JSONL) dari contoh kerja berkualitas, per divisi atau agen.', input_schema: { type: 'object', properties: { division_id: { type: 'string', description: 'kosongkan untuk seluruh perusahaan' }, employee_id: { type: 'string', description: 'opsional' }, min_quality: { type: 'integer', description: '1-10, default 7' } }, required: ['division_id', 'employee_id', 'min_quality'] } },
  { name: 'request_approval', description: 'Serahkan hasil untuk disetujui manusia (untuk hal yang diatur Kebijakan Persetujuan).', input_schema: { type: 'object', properties: { summary: { type: 'string' }, output: { type: 'string' }, reason: { type: 'string' } }, required: ['summary', 'output', 'reason'] } },
];

const STATUS_FOR_TOOL = { recruit_agent: 'Merekrut agen baru', create_division: 'Membentuk divisi', train_colleague: 'Melatih rekan', improve_skill: 'Menyempurnakan skill', acquire_skill: 'Mempelajari skill', ask_colleague: 'Konsultasi rekan', convene_meeting: 'Memimpin rapat', schedule_job: 'Menjadwalkan job', list_jobs: 'Cek jadwal', visit_url: 'Membuka situs', google_sheets_append: 'Menulis Google Sheets', google_drive_create: 'Membuat file Drive', google_calendar_create: 'Membuat acara Calendar', web_search: 'Riset web', calculate: 'Menghitung', company_status: 'Cek status tim', search_brain: 'Mencari di Brain', read_note: 'Membaca catatan', write_note: 'Menulis ke Brain', create_subtask: 'Mendelegasikan', send_message: 'Berkoordinasi', complete_task: 'Menyelesaikan', request_approval: 'Minta persetujuan', organize_brain: 'Mengaudit Brain', move_note: 'Merapikan folder', rename_note: 'Mengganti nama catatan', merge_notes: 'Menggabungkan duplikat', build_training_set: 'Menyusun dataset training', skill_view: 'Membuka panduan kerja', skill_manage: 'Mencatat cara kerja baru', memory: 'Mencatat hal penting', session_search: 'Mencari riwayat' };

async function runTool(e, t, name, input, state) {
  if (name.startsWith('mcp__')) {
    if (!(e.tools || []).includes('mcp')) return 'Tool MCP tidak diizinkan untuk ' + e.name + '.';
    logTask(t, e.id, 'tool', `🔌 ${name}(${JSON.stringify(input).slice(0, 120)})`);
    return collab.mcpCall(name, input).catch((err) => `MCP error: ${err.message}`);
  }
  if (learn.isLearnTool(name)) return learn.call(e, t, name, input);   // skill_view / skill_manage / memory / session_search: tidak lewat daftar izin tool, dan tidak bisa mengubahnya
  if (otomasi.isTool(name)) { logTask(t, e.id, 'tool', '⚙️ otomatiskan(' + JSON.stringify(input).slice(0, 120) + ')'); return otomasi.call(e, t, name, input); }
  if (staff.isTool(name)) { logTask(t, e.id, 'tool', '🧑‍💼 staf(' + JSON.stringify(input).slice(0, 120) + ')'); return staff.call(e, t, name, input); }
  if (browser.isBrowserTool(name)) {
    if (t.transient || t.kind === 'routine') return 'Tool browser tidak tersedia untuk chat atau tugas rutin.';
    logTask(t, e.id, 'tool', `🌐 ${name}(${JSON.stringify(input).slice(0, 120)})`);
    return browser.call(e, t, name, input);
  }
  if (name !== 'complete_task' && !(e.tools || CAP_IDS).includes(name)) return 'Tool ' + name + ' tidak diizinkan untuk ' + e.name + '.';
  switch (name) {
    case 'search_brain': {
      const r = brain.search(input.query, { scopeEmployeeId: e.id, limit: 6, audience: e.audience || 'internal' });
      logTask(t, e.id, 'tool', `🔎 search_brain("${input.query}") → ${r.length} hasil`, { results: r.map((x) => x.title) });
      return r.length ? r.map((x) => `[[${x.title}]] (${x.folder}; ${x.trust}): ${x.snippet}`).join('\n\n') + (r.some((x) => x.verified) ? '' : '\n\nCATATAN: tidak ada hasil terverifikasi. Jangan sajikan isi draf di atas sebagai fakta.') : 'Tidak ada hasil. Data ini belum ada di Brain: katakan "data belum tersedia", jangan mengarang.';
    }
    case 'read_note': {
      const n = brain.findNote(input.title);
      logTask(t, e.id, 'tool', `📖 read_note("${input.title}")${n ? '' : ' — tidak ditemukan'}`);
      return brain.canRead(n, { audience: e.audience || 'internal' }) ? n.content.slice(0, 12000) : 'Catatan tidak ditemukan. Coba search_brain.';
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
      const c = createTask({ title: input.title, description: input.description, expected: input.expected, stage: input.stage, assigneeId: a.id, createdBy: e.id, parentId: t.id, priority: input.priority || t.priority });
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
      const prev = (db().meetings || []).filter((x) => x.originTaskId === t.id).at(-1);
      if (prev && Date.now() - (prev.endedAt || prev.startedAt || 0) < 45 * 60000) {
        logTask(t, e.id, 'tool', '👥 rapat untuk tugas ini sudah ada — tidak diulang');
        return prev.status === 'done' ? `Rapat untuk tugas ini SUDAH selesai, jangan adakan lagi. Lanjutkan dari notulen ini:\n${prev.minutes}` : 'Rapat untuk tugas ini sedang berlangsung. Jangan adakan rapat baru; selesaikan tugas setelah notulen keluar.';
      }
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
      const sent = postMessage(ch, e.id, input.text);
      event('message', e.id, `${e.name} → ${target ? target.name : '#' + ch}: ${input.text.slice(0, 80)}`, { targetId: target?.id, channelId: ch, messageId: sent.id });
      logTask(t, e.id, 'tool', `💬 send_message(${target ? target.name : '#' + ch})`);
      return 'Terkirim.';
    }
    case 'complete_task':
    case 'request_approval': {
      state.finished = true;
      const needsApproval = name === 'request_approval';
      if (name === 'request_approval') logTask(t, e.id, 'tool', `🛑 request_approval: ${input.reason || ''}`);
      finishTask(e, t, { summary: input.summary, output: input.output, needsApproval, evidence: input.evidence, gaps: input.gaps, toolEvidence: realEvidence(state) });
      return 'Tercatat. Akhiri giliranmu.';
    }
    default: return 'Tool tidak dikenal.';
  }
}

/** tool results that are real evidence (Brain, web, live status, integrations), not chatter like send_message */
const realEvidence = (state) => (state?.evidence || []).filter((x) => /^### (search_brain|read_note|web_search|company_status|calculate|visit_url|ask_colleague|google_|mcp__|browser_|staf)/.test(x) && !/Tidak ada hasil|tidak ditemukan|GAGAL|belum berhasil|Belum bisa/i.test(x.slice(0, 200))).length;

async function runLive(e, t) {
  const ctx = retrievedContext(e, t);
  const messages = [{ role: 'user', content: ctx ? `${taskContext(t)}\n\n${ctx}` : taskContext(t) }];
  const state = { finished: false, delegated: false, toolCalls: new Map(), evidence: [] };
  const dm = llm.defaultModels();
  const tier = gov.modelTier(e, t);
  const model = e.model || dm[tier] || dm.worker;
  const mcpDefs = (e.tools || []).includes('mcp') && t.kind !== 'routine' ? (await collab.mcpToolDefs()).map(({ _mcp, ...d }) => d) : [];
  const wantsBrowser = t.kind !== 'routine' && !t.massMode && !t.transient;
  const buildTools = async () => [...toolsFor(e, t), ...(await otomasi.toolDefs(e, t)), ...(await staff.toolDefs(e, t)), ...learn.toolDefs(e, t), ...mcpDefs, ...(wantsBrowser ? await browser.toolDefs(e, t) : [])];   // dihitung ulang tiap giliran: alat browser_* baru muncul setelah buka_browser lolos
  let tools = await buildTools();
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
    tools = await buildTools();
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
      finishTask(e, t, { summary: fallback.slice(0, 200), output: fallback, needsApproval: false, toolEvidence: realEvidence(state), gaps: 'Agen tidak memanggil complete_task; hasil diambil dari teks terakhirnya.' });
      state.finished = true;
      break;
    }
    const results = [];
    for (const u of uses) {
      setStatus(e, 'working', STATUS_FOR_TOOL[u.name] || (browser.isBrowserTool(u.name) ? 'Menjelajah web' : u.name), t.id);
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
  browser.endTask(t.id).catch(() => {});   // tutup tab dan lepas browser untuk tugas ini
  if (!state.finished) {
    if (state.delegated) {
      t.status = 'waiting'; delete t.synth;
      logTask(t, e.id, 'waiting', `Menunggu ${children(t).filter((c) => c.status !== 'done').length} subtugas`);
    } else {
      const fallback = state.evidence.slice(-8).join('\n\n');
      if (fallback) {
        finishTask(e, t, { summary: 'Tugas diselesaikan otomatis dari hasil tool yang telah dikumpulkan.', output: fallback, needsApproval: false, toolEvidence: realEvidence(state), gaps: 'Batas giliran tercapai sebelum agen menyusun hasil akhir; ini kumpulan hasil tool mentah.' });
        logTask(t, e.id, 'note', 'Engine menyelamatkan hasil tool setelah batas giliran tercapai.');
      } else throw new Error('Agen berhenti tanpa hasil yang dapat diselamatkan');
    }
  }
}

// ───────────────────────── simulation agent ─────────────────────────
const ROUTES = {
  mkt: /market|konten|content|sosial|social|iklan|ads|campaign|kampanye|brand|seo|promo\w*|launch|peluncuran/i,
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
  const canDelegate = e.isLead && !t.noDelegate && !t.synth && t.kind !== 'routine' && depthOf(t) < 2 && team.length > 0 && !t.feedback;

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
      if (!heads.length) { finishTask(e, t, { summary: `Goal "${t.title.slice(0, 80)}" dikerjakan langsung (tidak ada divisi lain yang relevan).`, output: simDeliverable(e, t, refs), needsApproval: false, evidence: refs.map((r) => `[[${r.title}]]`), gaps: 'Mode simulasi (tanpa AI).' }); return true; }
      const until = Date.now() + 9000;
      for (const h of [e, ...heads]) if (h.status !== 'working' || h.id === e.id) { h.meetingUntil = until; h.kickoff = true; setStatus(h, 'meeting', 'Rapat kickoff goal', h.currentTaskId); }
      event('meeting', e.id, `${e.name} memimpin rapat kickoff dengan ${heads.map((h) => h.name).join(', ')}`, { participants: heads.map((h) => h.id), taskId: t.id });
      logTask(t, e.id, 'thought', `Goal ini menyentuh divisi: ${divs.map((d) => div(d).name).join(', ')}. Saya pecah per divisi.`);
      const staged = heads.length > 1 && heads.some((h) => h.divisionId === 'data');   // research first, then the divisions act on it
      for (const h of heads) {
        if (children(t).some((x) => x.assigneeId === h.id)) continue;   // a retried step must not create the same part twice
        const d = div(h.divisionId);
        const c = createTask({ title: `[${d.short}] ${t.title}`, description: `Bagian ${d.name} dari goal: "${t.title}".\n${t.description}\n\nFokus: ${d.mission}`, expected: `Rencana & deliverable konkret divisi ${d.name} untuk goal ini, dengan sumber untuk setiap fakta dan daftar hal yang belum bisa dipenuhi.`, stage: staged ? (h.divisionId === 'data' ? 1 : 2) : 0, assigneeId: h.id, createdBy: e.id, parentId: t.id, priority: t.priority });
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
        if (children(t).some((x) => x.assigneeId === m.id)) continue;
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
    finishTask(e, t, { summary, output, needsApproval: POLICY_RE.test(t.title) && !t.parentId, evidence: refs.map((r) => `[[${r.title}]]`), gaps: 'Mode simulasi (tanpa AI): isi berupa kerangka dari catatan Brain, belum dianalisis sungguhan.' });
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

/** a group discussion: Owner + several agents in one channel; replies are taken in turns so each speaker sees the previous ones */
export function ensureGroup(ownerId, memberIds) {
  const members = [...new Set([ownerId, ...memberIds])].sort();
  const id = 'grp-' + members.join('--').slice(0, 120);
  if (!db().channels.some((c) => c.id === id)) store.upsert('channels', { id, kind: 'group', members, name: 'Diskusi: ' + members.filter((m) => m !== ownerId).map((m) => emp(m)?.name || m).join(', ') });
  return id;
}

// ───────────────────────── goal threads: one discussion per goal (progress, questions, reviews in one place) ─────────────────────────
const rootOf = (t) => { let r = t, d = 0; while (r?.parentId && d < 12) { r = task(r.parentId) || r; if (!r.parentId) break; d++; } return task(t.rootId) || r; };
export function ensureGoalThread(root) {
  if (!root) return null;
  const id = `goal-${root.id}`;
  if (!db().channels.some((c) => c.id === id)) {
    const pa = db().employees.find((x) => x.isPA && x.ownerId === root.createdBy) || emp(root.assigneeId);
    store.upsert('channels', { id, kind: 'group', goalId: root.id, members: [...new Set([root.createdBy, pa?.id, root.assigneeId].filter(Boolean))], name: `🎯 ${String(root.title).slice(0, 70)}`, topic: root.expected || '' });
  }
  return id;
}
/** a short, token-free progress line in the goal's thread (only when the task belongs to a goal a human asked for) */
function goalNote(t, authorId, text, extra = {}) {
  const root = t && rootOf(t);
  if (!root || root.kind !== 'goal' || emp(root.createdBy)?.type !== 'human') return;
  const ch = ensureGoalThread(root);
  const c = db().channels.find((x) => x.id === ch);
  if (authorId && emp(authorId)?.type === 'ai' && !c.members.includes(authorId)) { c.members.push(authorId); store.upsert('channels', c); }
  postMessage(ch, emp(authorId) ? authorId : root.assigneeId, text, { taskId: t.id, progress: true, ...extra });
}
/** the real state of a goal, from the database: used to answer "progresnya gimana?" without inventing anything */
export function goalStatus(root) {
  const all = db().tasks.filter((x) => (x.rootId || x.id) === root.id && x.id !== root.id);
  const label = { todo: 'antre', in_progress: 'dikerjakan', waiting: 'menunggu subtugas', review: 'menunggu review', blocked: 'MACET', done: 'selesai' };
  const now = Date.now();
  const lines = all.slice(0, 14).map((x) => `- ${x.stage ? `[tahap ${x.stage}] ` : ''}${x.title.slice(0, 70)} — ${emp(x.assigneeId)?.name || '?'}: ${label[x.status] || x.status}${OPEN.has(x.status) && x.dueAt && x.dueAt < now ? ' (LEWAT TENGGAT)' : ''}${x.status === 'done' && x.unverified ? ' (tanpa bukti)' : ''}`);
  const done = all.filter((x) => x.status === 'done').length;
  return `Goal "${root.title.slice(0, 90)}" — status ${label[root.status] || root.status}; ${done}/${all.length} bagian selesai.${all.length ? '\n' + lines.join('\n') : '\n(belum dipecah ke tim)'}`;
}

const WORK_RE = /\b(tolong|buat|buatkan|bikin|susun|siapkan|kerjakan|analisis|tulis|cari|riset|rancang|lakukan|jalankan|pastikan|pelajari|harus|please|create|make|write|draft|prepare)\b/i;

/** Does this sound like an instruction (goal) rather than a question or small talk? Questions are always chat; imperatives (-kan verbs, known work verbs) are goals. */
const QUESTION_RE = /\?\s*$|^\s*(?:apa|apakah|siapa|kenapa|mengapa|bagaimana|gimana|berapa|kapan|dimana|di mana|mana|bisakah|boleh|hi|hai|halo|hello|hey|pagi|siang|sore|malam|terima kasih|makasih|thanks?)\b/i;
const WORK_VERBS = /^(?:tolong\s+|coba\s+|segera\s+|mohon\s+)?(?:buat|bikin|susun|siapkan|kerjakan|analisis|analisa|tulis|cari|riset|rancang|lakukan|jalankan|pastikan|pelajari|evaluasi|tingkatkan|optimalkan|kirim|jadwalkan|ubah|perbarui|update|review|periksa|cek|hitung|bandingkan|rangkum|ringkas|terjemahkan|launch|plan|build|prepare|draft|write|create|make|analy[sz]e|research|\w{3,}kan)\b/i;
export function looksLikeWork(text) {
  const t = String(text || '').trim();
  if (!t || QUESTION_RE.test(t)) return false;
  if (WORK_VERBS.test(t)) return t.split(/\s+/).length >= 3;
  return WORK_RE.test(t) && t.split(/\s+/).length >= 4;
}

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
  if ((ch.kind === 'dm' || ch.kind === 'group') && emp(msg.authorId)?.type === 'human') {
    const mids = ch.members.filter((x) => x !== msg.authorId && emp(x)?.type === 'ai');
    // the live room hears only the Owner's orchestrator thread (DM with the PA); a DM with a colleague or a goal thread stays that conversation
    const orchestratorThread = !ch.goalId && mids.length > 0 && mids.every((x) => emp(x)?.isPA || emp(x)?.isMaster);
    const guests = orchestratorThread || ch.goalId ? [] : mids;   // in the PA thread or a goal thread, guests come from the names in the sentence
    const intent = meetingIntent(msg.text, guests, msg.authorId);
    if (intent === 'say' && orchestratorThread) { const live = activeLiveMeeting(msg.authorId); postMessage(`mtg-${live.id}`, msg.authorId, msg.text); collab.ownerSpeaks(live.id, msg.text, msg.authorId); return; }
    if (intent && intent !== 'say') { startChatMeeting({ text: msg.text, userId: msg.authorId, channelId: ch.id, ids: guests, intent }); return; }
  }
  let targets = [];
  const closed = ch.kind === 'dm' || ch.kind === 'group';   // only the members of a DM/group may answer in it
  if (ch.kind === 'dm' || ch.kind === 'group') targets = ch.members.filter((m) => m !== msg.authorId).map(emp);
  const scope = broadcastScope(ch, msg.text);
  if (scope) {
    const delivered = scope.type === 'all' ? db().employees.filter((e) => e.type === 'ai').length : scopeTargets(scope).length;
    Object.assign(msg, { broadcast: true, broadcastScope: scope, deliveredTo: delivered }); store.upsert('messages', msg);
    if (WORK_RE.test(msg.text)) { dispatchBroadcast(msg, ch, scope); return; }
    targets.push(db().employees.find((e) => e.isPA && e.ownerId === msg.authorId) || db().employees.find((e) => e.isMaster));
  }
  const mentions = [...msg.text.matchAll(/@([\w-]+)/g)].map((m) => m[1].toLowerCase());
  if (ch.goalId) {   // goal thread: the PA answers by default; a named head/colleague (with or without @) joins the thread and answers instead
    const named = [...new Set([...mentions.map((n) => db().employees.find((x) => x.id === n || x.name.toLowerCase() === n)?.id).filter(Boolean), ...namesIn(msg.text)])].map(emp).filter((x) => x?.type === 'ai').slice(0, 3);
    for (const x of named) if (!ch.members.includes(x.id)) { ch.members.push(x.id); store.upsert('channels', ch); postMessage(ch.id, x.id, `👋 ${x.name} (${x.title}) bergabung ke diskusi goal ini.`); }
    const owner = db().employees.find((x) => x.isPA && x.ownerId === msg.authorId) || emp(task(ch.goalId)?.assigneeId);
    targets = named.length ? named : [owner].filter(Boolean);
  } else if (ch.kind === 'group') { let only = mentions.map((n) => db().employees.find((x) => x.id === n || x.name.toLowerCase() === n)).filter((e) => e && ch.members.includes(e.id)); if (!only.length) only = namesIn(msg.text).filter((id) => ch.members.includes(id)).map(emp); if (only.length) targets = only; }   // "maya gimana menurutmu" = only Maya answers (saves tokens)   // @name inside a group narrows who answers
  else for (const name of mentions) { const e = db().employees.find((x) => x.id === name || x.name.toLowerCase() === name); if (e && (!closed || ch.members.includes(e.id))) targets.push(e); }
  if (!targets.length && ch.kind === 'channel') targets.push(ch.divisionId ? headOf(ch.divisionId) : db().employees.find((e) => e.isPA && e.ownerId === msg.authorId) || db().employees.find((e) => e.isMaster));
  targets = [...new Set(targets.filter((e) => e && e.type === 'ai'))].slice(0, ch.kind === 'group' ? 4 : 3);
  if (ch.kind === 'group') {   // turn-taking: one after another, so later speakers read what the earlier ones said
    (async () => { for (const e of targets) { try { await replyAs(e, ch, msg); } catch (err) { postMessage(ch.id, e.id, `⚠️ Maaf, saya error: ${err.message}`); } } })();
    return;
  }
  for (const e of targets) replyAs(e, ch, msg).catch((err) => postMessage(ch.id, e.id, `⚠️ Maaf, saya error: ${err.message}`));
}

const TASK_RE = /^(tolong|buat|buatkan|bikin|susun|siapkan|kerjakan|analisis|tulis|cari|riset|rancang|please|create|make|write|draft|prepare)\b/i;

const chatBusy = new Map();
async function replyAs(e, ch, msg) {
  // every reply is also SAID in the office: a speech bubble over the agent who answers
  const reply = (text, extra = {}) => { const m = postMessage(ch.id, e.id, text, extra); event('message', e.id, `${e.name} → ${emp(msg.authorId)?.name || ''}: ${String(text).replace(/\s+/g, ' ').slice(0, 180)}`, { targetId: msg.authorId, channelId: ch.id, messageId: m.id }); return m; };
  const prev = { status: e.status, text: e.statusText };
  const busyKey = store.current() + ':' + e.id;   // the same id can exist in several workspaces
  chatBusy.set(busyKey, (chatBusy.get(busyKey) || 0) + 1);
  // "ikuti saya" / "berhenti ikut": the agent walks with the person who asked (and stops when asked)
  const wantsFollow = /\b(ikut(i)?\s+(saya|aku|gue|kami)|ayo\s+ikut|ikut\s+jalan|follow\s+me|jalan[- ]jalan|(?:datangi|hampiri|dekati|temui)\s+(?:saya|aku|gue|kami)|(?:sini|kemari|ke\s+sini|ke\s+tempat\s+(?:saya|aku))|come\s+(?:here|to\s+me))\b/i.test(msg.text);
  const wantsStop = /\b(berhenti\s+(ikut|mengikuti)|stop\s+ikut|kembali\s+(ke\s+)?(meja|kerja)|balik\s+kerja)\b/i.test(msg.text);
  if (wantsFollow) event('follow', e.id, `${e.name} mengikuti ${emp(msg.authorId)?.name}`, { targetId: msg.authorId });
  if (wantsStop) event('unfollow', e.id, `${e.name} kembali bekerja`, { targetId: msg.authorId });
  if (e.status === 'idle') setStatus(e, 'chatting', `Membalas ${emp(msg.authorId)?.name}`);
  event('message', msg.authorId, `${emp(msg.authorId)?.name} → ${e.name}: ${msg.text.slice(0, 80)}`, { targetId: e.id, channelId: ch.id, messageId: msg.id });
  try {
    const quick = quickReply(e, msg, ch);
    if (quick) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 600));
      reply(quick);
    } else if (llm.isLive() && llm.budgetLeft() > 0) {
      const history = db().messages.filter((m) => m.channelId === ch.id).slice(-10);
      const convo = history.map((m) => `${emp(m.authorId)?.name || m.authorId}: ${m.text}`).join('\n');
      const chatTools = toolsFor(e).filter((x) => ['search_brain', 'company_status', 'ask_colleague', 'web_search', 'calculate'].includes(x.name)).concat(learn.chatDefs(e)).concat([{
        name: 'create_task', description: 'Buat tugas baru (untuk dirimu sendiri atau rekan) bila manusia meminta pekerjaan yang butuh waktu.', input_schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, expected: { type: 'string', description: 'Hasil yang diharapkan / definisi selesai' }, assignee_id: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['title', 'description', 'expected'] },
      }]);
      const named = namesIn(msg.text).filter((id) => id !== e.id).slice(0, 4).map(emp).filter(Boolean);
      // the company's own documents most relevant to this message ride along automatically: the model no longer has to remember to search
      const brainFacts = relevantFacts(msg.text, 3);
      const brainBlock = brainFacts ? `FAKTA DARI BRAIN PERUSAHAAN (dokumen asli Owner; kutip judulnya bila dipakai):\n${brainFacts}\n\n` : `BRAIN: tidak ada dokumen terverifikasi yang cocok dengan pesan ini. Jangan mengarang; katakan belum ada datanya dan tawarkan mencari dengan kata lain.\n\n`;
      const goalRoot = ch.goalId ? task(ch.goalId) : null;
      const goalFacts = goalRoot ? `KEADAAN NYATA GOAL INI (dari papan tugas; jangan mengarang progres di luar ini):\n${goalStatus(goalRoot)}\nDefinisi selesai: ${goalRoot.expected || '-'}\nBila Owner memberi arahan baru untuk goal ini, buat tugas lewat create_task dan sebutkan siapa pengerjanya.\n\n` : '';
      const facts = brainBlock + goalFacts + (named.length ? `KEADAAN NYATA rekan yang disebut (pakai ini bila ditanya tentang mereka; jangan menjawab tentang dirimu sendiri):\n${named.map((x) => `- ${x.name} (${x.title || '-'}): ${colleagueState(x)}`).join('\n')}\n\n` : '');
      const messages = [{ role: 'user', content: `Percakapan di ${ch.kind === 'dm' ? 'DM' : ch.kind === 'group' ? 'diskusi grup (' + ch.name + ')' : '#' + ch.name}:\n${convo}\n\n${facts}${wantsFollow ? 'Kamu SEKARANG ikut berjalan bersama orang ini di kantor 3D. Jawab singkat bahwa kamu ikut sambil mengobrol, jangan bilang tidak bisa ikut.\n\n' : ''}${wantsStop ? 'Kamu berhenti ikut dan kembali bekerja di meja. Jawab singkat.\n\n' : ''}Balas pesan terakhir dari ${emp(msg.authorId)?.name} sebagai ${e.name}. Singkat dan membantu.${ch.kind === 'group' ? ' Ini diskusi grup: baca jawaban peserta lain di atas, jangan mengulang isinya; tambahkan sudut pandang divisimu atau setuju/tidak setuju dengan singkat.' : ''} Jawab langsung dan natural seperti rekan kerja; JANGAN menyebut nama tool atau istilah teknis (mis. create_task) kepada manusia. Untuk sapaan atau obrolan ringan, balas satu atau dua kalimat saja. Jika diminta pekerjaan besar, panggil tool create_task lalu konfirmasi singkat apa yang sudah kamu buat dan siapa yang mengerjakan.` }];
      const pseudo = { id: 'chat', title: 'chat', log: [], transient: true, agentId: e.id, createdBy: emp(msg.authorId)?.type === 'human' ? msg.authorId : undefined };
      // model router: 20B (low reasoning) for everyday talk, 120B (medium reasoning) for complex questions, Qwen vision when pictures are attached
      const route = chatRoute(msg, ch);
      const pics = route.tier === 'vision' ? imageBlocks(msg) : [];
      if (pics.length) messages[0].content = [{ type: 'text', text: messages[0].content + '\n\nPesan terakhir menyertakan gambar (terlampir). Jelaskan apa yang benar-benar terlihat; jangan menebak hal yang tidak tampak.' }, ...pics];
      let posted = false;
      for (let i = 0; i < 5; i++) {
        const res = await llm.call({ system: chatSystem(e), messages, tools: pics.length ? [] : chatTools, model: e.model && !pics.length ? e.model : llm.defaultModels()[route.tier], effort: route.effort, employee: e, maxTokens: route.tier === 'small' ? 1200 : 2400 });
        messages.push({ role: 'assistant', content: res.content });
        const uses = res.content.filter((b) => b.type === 'tool_use');
        if (!uses.length) { reply((llm.textOf(res) || '👍').replace(new RegExp(`^\\**${e.name}\\**\\s*:\\s*\\**\\s*`), '')); posted = true; break; }
        const results = [];
        for (const u of uses) {
          let out;
          try {
            if (u.name === 'create_task') {
              const g = ch.goalId && task(ch.goalId), inGoal = g && ['todo', 'in_progress', 'waiting'].includes(g.status);   // an instruction inside a goal thread becomes part of that goal
              const t = createTask({ title: u.input.title, description: u.input.description, expected: u.input.expected, assigneeId: emp(u.input.assignee_id) ? u.input.assignee_id : e.id, createdBy: inGoal ? g.assigneeId : msg.authorId, parentId: inGoal ? g.id : null, priority: u.input.priority || 'medium' });              out = `Tugas ${t.id} dibuat untuk ${emp(t.assigneeId).name}.`;
            } else out = await runTool(e, pseudo, u.name, u.input, {});
          } catch (err) { out = `Error: ${err.message}`; }
          results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out) });
        }
        messages.push({ role: 'user', content: results });
      }
      if (!posted) reply('Saya sudah menjalankan beberapa langkah untuk permintaan ini, tetapi belum sempat merangkum hasilnya. Tanya lagi, atau minta saya membuat tugas.');
    } else {
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 1200));
      const text = msg.text.replace(/@[\w-]+/g, '').trim();
      const dup = ch.kind === 'group' && db().tasks.find((x) => x.createdBy === msg.authorId && x.description === text && Date.now() - x.createdAt < 120000);
      if (dup) reply(`Setuju. Tugas itu sudah diambil **${emp(dup.assigneeId)?.name}**; saya siap membantu dari sisi ${e.title} bila diminta.`, { taskId: dup.id });
      else if (TASK_RE.test(text)) {
        const t = createTask({ title: text.slice(0, 100), description: text, assigneeId: e.id, createdBy: msg.authorId, priority: 'medium' });
        reply(`Siap! Sudah saya masukkan ke antrean kerja: **${t.title}**. Pantau progresnya di Kanban atau lihat saya di kantor 3D 👀`, { taskId: t.id });
      } else {
        const r = brain.search(text, { limit: 2 });
        const open = db().tasks.filter((t) => t.assigneeId === e.id && OPEN.has(t.status));
        {
          const who = /^anda\b/i.test(emp(msg.authorId)?.name || '') ? 'Owner' : String(emp(msg.authorId)?.name || 'Owner').split(' ')[0];
          const prev = db().messages.filter((m) => m.channelId === ch.id && m.authorId === e.id).slice(-3).map((m) => m.text);
          const heads = [`Dicatat, ${who}.`, 'Baik, saya dengar.', `Oke ${who}, saya catat.`, 'Siap.'];
          const head = heads.find((h) => !prev.some((p) => p.startsWith(h))) || heads[0];
          const state = e.status === 'meeting' ? 'Saya sedang di rapat.' : open.filter((t) => t.status !== 'blocked').length ? `Saya sedang menangani "${String(open.filter((t) => t.status !== 'blocked').at(-1).title).slice(0, 50)}".` : 'Saya sedang luang.';
          const hint = prev.some((p) => p.includes('beri tugas')) ? '' : ' Beri saya tugas ("buat …"), ajak rapat ("rapat dengan …"), atau tanya status. _(mode simulasi: tanpa AI)_';
          reply(`${head} ${state}${r.length && String(text).split(/\s+/).length >= 3 ? `\nMungkin relevan: ${r.map((x) => `[[${x.title}]]`).join(', ')}` : ''}${hint}`);
        }
      }
    }
    if (!quick && String(msg.text || '').trim().split(/\s+/).length >= 6) { try { brain.remember(e, `${/^anda\b/i.test(emp(msg.authorId)?.name || '') ? 'Owner' : (emp(msg.authorId)?.name || 'Pengguna')} berkata kepadaku: "${String(msg.text).replace(/\s+/g, ' ').slice(0, 110)}"`); } catch { /* memory is best effort */ } }
  } finally {
    const left = (chatBusy.get(busyKey) || 1) - 1; chatBusy.set(busyKey, left);
    if (left === 0 && e.status === 'chatting') setStatus(e, prev.status === 'chatting' ? 'idle' : prev.status, prev.status === 'chatting' ? 'Siap bekerja' : prev.text);
  }
}

export const running = () => [...jobs.entries()].filter(([, j]) => (j.ws || 'main') === store.current()).map(([taskId, j]) => ({ taskId, empId: j.empId, mode: j.mode }));

// ───────────────────────── meetings and quick replies from chat ─────────────────────────
// A chat sentence that asks for a meeting must REALLY start one (agents walk to the Conference Hall and talk in 3D). Before, the PA model only claimed it had.
const MEETING_RE = /\b(rapat|meeting|rapatkan|kumpul(?:kan)?|berkumpul|ngumpul|briefing|town ?hall|sinkronisasi)\b|ayo\s+ke\s+ruang|ke\s+ruang\s+(?:rapat|meeting)|ke\s+conference/i;
const PAST_MEETING_RE = /\b(notulen|hasil\s+(?:rapat|meeting)|rapat\s+(?:kemarin|tadi|sebelumnya)|jadwal\s+(?:rapat|meeting))\b/i;
const CANCEL_MEETING_RE = /\b(batal(?:kan)?|hentikan|bubarkan|stop|sudahi)\b.*\b(rapat|meeting)\b|\b(rapat|meeting)\b.*\b(batal|dibatalkan|stop)\b/i;
const INVITE_RE = /\b(undang|ajak|panggil|libatkan|tambah(?:kan)?|cuma|hanya)\b/i;

/** ids of AI employees whose name appears in the text, with or without @ ("undang maya aja"); a first name several people share goes to the division head */
export function namesIn(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const firsts = new Map(), out = new Set();
  for (const e of db().employees) {
    if (e.type !== 'ai') continue;
    const full = String(e.name || '').toLowerCase().trim(); if (!full) continue;
    if (full.includes(' ') && t.includes(' ' + full + ' ')) out.add(e.id);
    if (String(e.id).length >= 4 && t.includes(' ' + String(e.id).toLowerCase() + ' ')) out.add(e.id);   // the id also works ("kenzo")
    const first = full.split(/\s+/)[0]; const cur = firsts.get(first);
    if (!cur || (e.isLead && !cur.isLead)) firsts.set(first, e);
  }
  for (const [first, e] of firsts) if (first.length >= 3 && t.includes(' ' + first + ' ')) out.add(e.id);
  return [...out];
}
/** The meeting the Owner sits in right now. Only a meeting whose loop is alive in THIS process counts: a saved-but-dead meeting must never swallow messages or keep people "busy". */
export const activeLiveMeeting = (userId) => db().meetings.find((m) => (m.status === 'waiting_owner' || m.status === 'running') && collab.liveLoops.has(m.id) && m.ownerLed && (!userId || m.ownerId === userId));
const REPLACE_MEETING_RE = /\b(?:rapat|meeting)\s+baru\b|\b(?:undang|ajak|panggil|tambah(?:kan)?)\b/i;
/** THE one place that decides what a message means for meetings: 'new' | 'replace' | 'cancel' | 'say' | null.
 *  While the Owner is in a live meeting EVERYTHING is said in the room ("kita mulai rapat kita" included) unless it clearly cancels, or invites/replaces people. */
export function meetingIntent(text, ids = [], userId = 'owner') {
  const t = String(text || '').trim();
  if (!t) return null;
  const live = activeLiveMeeting(userId);
  if (live) {
    if (CANCEL_MEETING_RE.test(t)) return 'cancel';
    if (REPLACE_MEETING_RE.test(t) && (ids.length || namesIn(t).some((id) => !(live.participants || []).includes(id)))) return 'replace';
    return 'say';
  }
  if (/\?\s*$|^\s*(?:apa|apakah|siapa|kenapa|mengapa|bagaimana|gimana|berapa|kapan|dimana|mana|bisakah)\b/i.test(t) || PAST_MEETING_RE.test(t)) return null;   // questions about meetings are chat, not a request to hold one
  return MEETING_RE.test(t) ? 'new' : null;
}
export function startChatMeeting({ text, userId = 'owner', channelId, ids = [], intent = 'new' }) {
  const pa = db().employees.find((x) => x.isPA && x.ownerId === userId && x.status !== 'offline') || db().employees.find((x) => x.isMaster) || emp('aria');
  const say = (msg, extra = {}) => postMessage(channelId, pa.id, msg, extra);
  const active = activeLiveMeeting(userId);
  if (intent === 'cancel') { if (active && collab.cancelMeeting(active.id)) say('Rapat dibatalkan. Semua kembali ke pekerjaan masing-masing.'); else say('Tidak ada rapat yang sedang berjalan.'); return { action: 'meeting', cancelled: true }; }
  const named = namesIn(text).filter((id) => id !== pa.id);
  let invited = [...new Set([...ids, ...named])].filter((id) => emp(id)?.type === 'ai' && id !== pa.id);
  if (/\b(semua|seluruh)\b/i.test(text) && !invited.length) invited = db().divisions.map((d) => d.leadId).filter((id) => emp(id)?.type === 'ai' && id !== pa.id);
  if (!invited.length) { const m = db().employees.find((x) => x.isMaster && x.id !== pa.id); invited = [m?.id || db().divisions.map((d) => d.leadId).find((id) => id && id !== pa.id)].filter(Boolean); }
  const nameSet = new Set([...invited, pa.id].flatMap((id) => [String(emp(id)?.name || '').toLowerCase().split(/\s+/)[0], String(id).toLowerCase()]));
  const rest = String(text).replace(/@[\w-]+/g, ' ').replace(/\b(ayo|yuk|ya|tolong|coba|kita|ke|di|ruang|ruangan|rapat|meeting|conference|hall|kumpul|berkumpul|ngumpul|diskusi|undang|ajak|dengan|bareng|saja|aja|cuma|hanya|udah|sudah|sebisa|mungkin|hemat|token|loh|semua|semuanya|seluruh|dan|pergi|datang|masuk|segera|sekarang|skrg|sekarng|now|kalian|langsung)\b/gi, ' ').split(/\s+/).map((w) => w.replace(/^[,;:.!]+|[,;:.!]+$/g, '')).filter((w) => w && !nameSet.has(w.toLowerCase())).join(' ').replace(/^(?:soal|tentang|mengenai|untuk)\s+/i, '').trim();
  const names = invited.map((id) => emp(id).name);
  const topic = rest.length >= 8 ? rest.slice(0, 140) : 'Diskusi Owner dengan ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ` dan ${names.length - 3} lainnya` : '');
  if (active && intent === 'replace') collab.cancelMeeting(active.id);   // "undang Maya saja" replaces the meeting that was just opened with default guests
  let started = null;
  const auto = /\b(tanpa\s+(?:saya|aku)|sendiri(?:an)?|laporkan\s+hasil|kabari\s+hasil|otomatis)\b/i.test(text);   // "rapat sendiri dulu" = agents only; otherwise the Owner is in the room
  collab.runMeeting({ topic, participantIds: invited, chairId: pa.id, ownerLed: !auto, ownerId: userId, fromChat: true, mirrorChannelId: channelId, onStart: (m) => { started = m; } })
    .catch((err) => { console.warn('[meeting]', err.message); say('⚠️ Rapat belum bisa dimulai: ' + err.message); });
  if (started) {
    const how = auto ? 'Mereka berdiskusi sendiri lalu menyusun notulen (1 panggilan AI saja).' : 'Setelah berkumpul, saya buka dengan usulan agenda. Tulis arahanmu di kotak ini: peserta menjawab setiap pesanmu. Ketik "selesai" atau "tutup rapat" untuk mengakhiri (otomatis ditutup bila 10 menit tanpa arahan).';
    say(`📅 **Rapat dimulai** di Conference Hall bersama ${names.join(', ')}.\nTopik: ${topic}\n${how}`, { meetingId: started.id });
  }
  return { action: 'meeting', channelId, meetingId: started?.id || null, members: invited, orchestrator: pa.id };
}

/** A compact chat persona grounded in the agent's REAL state. The full work prompt (skills, knowledge, self-model: thousands of tokens) made chat expensive and let the model
 *  invent work ("fokus pada kalender kampanye Q3") from old memories. Chat gets who-you-are + what is actually true right now, and a ban on inventing the rest. */
function chatSystem(e) {
  const open = db().tasks.filter((t) => t.assigneeId === e.id && OPEN.has(t.status) && t.status !== 'blocked').slice(0, 5);
  const where = e.status === 'meeting' ? 'sedang di rapat' : e.status === 'working' ? 'sedang bekerja' : e.status === 'chatting' ? 'sedang mengobrol' : 'sedang luang';
  const c = db().company;
  const memNote = brain.findNote(`Memori ${e.name}`), memLines = memNote ? memNote.content.split('\n').slice(2).filter(Boolean).slice(-4).map((l) => l.replace(/^- /, '- ').slice(0, 160)).join('\n') : '';
  return `Kamu ${e.name}, ${String(e.title || '').replace(/\s*[·\-–]\s*Anda \(Owner\)\s*$/i, '')} di divisi ${div(e.divisionId)?.name || '-'} ${c.name}. ${String(e.about || e.persona || '').slice(0, 280)}
Keahlian: ${(e.skills || []).slice(0, 4).join(', ') || '-'}.

# KEADAAN NYATA SAAT INI (satu-satunya sumber kebenaran tentang dirimu)
- Status: ${where}${e.statusText ? ` (${String(e.statusText).slice(0, 60)})` : ''}
- Tugas aktif: ${open.length ? open.map((t) => `"${String(t.title).slice(0, 60)}" [${t.status}]`).join('; ') : 'TIDAK ADA'}

${memLines ? `# INGATANMU (kejadian nyata yang kamu alami; bukan berarti masih kamu kerjakan)\n${memLines}\n\n` : ''}${learn.chatBlock(e)}# ATURAN
- Jawab 1-3 kalimat, natural, ${c.language}, seperti rekan kerja.
- Format: untuk 2 hal atau lebih pakai daftar Markdown (satu baris per butir, "- " atau "1. "), bukan kalimat panjang bersambung. Perbandingan/angka berderet pakai tabel Markdown. Untuk grafik tulis blok \`\`\`chart berisi JSON {"type":"bar|line|pie","title":"…","labels":[…],"data":[…]} hanya dengan angka NYATA dari data di atas.
- Data perusahaan yang sebenarnya (produk, harga, pelanggan, angka, target) ${db().notes.some((n) => n.kb === 'owner' || n.kb === 'drive') ? 'hanya yang ada di catatan Brain bertanda terverifikasi; selain itu belum ada' : 'BELUM diisi Owner'}. Jangan menebaknya; bila ditanya, katakan datanya belum ada.
- Jawab dari blok "FAKTA DARI BRAIN" bila ada dan sebut judul dokumennya. DILARANG menyebut nama folder, file, atau dokumen yang tidak tercantum di pesan ini (jangan mengarang folder seperti "Data Perusahaan").
- JANGAN mengarang pekerjaan, proyek, angka, atau status yang tidak tertulis di atas. Bila ditanya sedang apa atau di mana, jawab sesuai keadaan nyata; bila tidak ada tugas, katakan sedang luang.
- Bila tidak tahu atau datanya tidak ada, katakan terus terang dan sebutkan cara mendapatkannya (cari di Brain, tanya rekan, riset). Jangan pura-pura sudah mengerjakan sesuatu.
- Kritis, bukan penurut: bila permintaan kabur, tanyakan SATU hal yang paling penting dulu; bila ada risiko atau asumsi lemah, sebutkan singkat beserta alasannya.
- Ditanya tentang rekan: jawab hanya dari blok "KEADAAN NYATA rekan" bila ada; jangan menceritakan dirimu sebagai gantinya.
- Jangan menyebut nama tool atau istilah teknis.
- Bila diminta pekerjaan besar, panggil create_task lalu konfirmasi singkat apa yang dibuat dan siapa pengerjanya.`;
}

/** one true sentence about a colleague, from the database (never invented) */
// ───────────────────────── model router: cheap by default, strong only when it matters ─────────────────────────
const COMPLEX_RE = /\b(analisis|analisa|analisislah|bandingkan|perbandingan|strategi|rencana|rancang|rancangan|susun(?:kan)?|evaluasi|hitung|proyeksi|kenapa|mengapa|jelaskan|uraikan|rangkum(?:kan)?|ringkas(?:kan)?|prioritas(?:kan)?|risiko|rekomendasi(?:kan)?|solusi|bagaimana cara|langkah[- ]langkah|pro(?:s)? (?:dan|&) kontra|kelebihan|kekurangan|tren|forecast|anggaran|budget)\b/i;
/** a message worth the big model: long, analytical, or several questions at once */
export const isComplex = (text) => { const t = String(text || ''); return t.split(/\s+/).length > 40 || COMPLEX_RE.test(t) || (t.match(/\?/g) || []).length >= 2; };
/** pictures → vision model (Qwen); complex → 120B with medium reasoning; everything else → 20B with low reasoning (it still reasons, just briefly) */
export function chatRoute(msg, ch = {}) {
  if ((msg.attachments || []).some((a) => a.type === 'image')) return { tier: 'vision', effort: 'low', why: 'gambar' };
  if (isComplex(msg.text) || ch.goalId) return { tier: 'smart', effort: 'medium', why: 'kompleks' };
  return { tier: 'small', effort: 'low', why: 'biasa' };
}
// ── chat pictures: stored as files per workspace (never inside the database that is streamed to every browser)
const uploadDir = () => path.join(process.env.DATA_DIR || path.resolve('data'), 'uploads', store.current());
const IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
export function saveImages(list = []) {
  const out = [];
  for (const img of (Array.isArray(list) ? list : []).slice(0, 3)) {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(img?.dataUrl || ''));
    if (!m) continue;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1048576) throw Object.assign(new Error('Gambar terlalu besar (maks 4 MB)'), { code: 413 });
    const id = uid('img') + '.' + IMG_TYPES[m[1]];
    fs.mkdirSync(uploadDir(), { recursive: true });
    fs.writeFileSync(path.join(uploadDir(), id), buf);
    out.push({ id, type: 'image', mime: m[1], name: String(img.name || 'gambar').slice(0, 80), url: `/api/files/${id}` });
  }
  return out;
}
export function readUpload(id) {
  if (!/^img-[\w-]+\.(png|jpg|webp|gif)$/.test(String(id))) return null;
  const f = path.join(uploadDir(), id);
  return fs.existsSync(f) ? { data: fs.readFileSync(f), mime: Object.keys(IMG_TYPES).find((k) => IMG_TYPES[k] === id.split('.').pop()) } : null;
}
const imageBlocks = (msg) => (msg.attachments || []).filter((a) => a.type === 'image').map((a) => readUpload(a.id)).filter(Boolean).map((f) => ({ type: 'image', source: { type: 'base64', media_type: f.mime, data: f.data.toString('base64') } }));

/** what the company's verified knowledge actually contains (Drive + Owner + System), grouped by folder; this is the only truthful answer to "data apa saja yang ada?" */
export function brainOverview({ groups = 12, examples = 3 } = {}) {
  const notes = db().notes.filter((n) => !n.archived && brain.isVerified(n) && n.visibility !== 'private');
  if (!notes.length) return { total: 0, text: 'Brain belum berisi data terverifikasi. Isi lewat Google Drive (Pengaturan → Ambil dari Drive) atau tulis catatan sendiri di Brain.' };
  const key = (n) => { const p = String(n.folder || '').split('/'); return p[0] === 'Drive' ? p.slice(1, 4).join(' › ') : p[0]; };   // Drive/Perusahaan/Raycorp/… → "Perusahaan › Raycorp › …"
  const by = new Map();
  for (const n of notes) { const k = key(n); if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
  const rows = [...by.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, groups);
  const text = `Brain berisi ${notes.length} catatan terverifikasi:\n` + rows.map(([k, l]) => `- **${k}** (${l.length}): ${l.slice(0, examples).map((n) => n.title).join('; ')}${l.length > examples ? '; …' : ''}`).join('\n') + (by.size > groups ? `\n- …dan ${by.size - groups} folder lain.` : '');
  return { total: notes.length, text };
}
/** the few verified notes most relevant to a question, as short facts for the prompt (keeps tokens low, keeps answers grounded) */
function relevantFacts(text, limit = 3) {
  return brain.search(text, { limit, verifiedOnly: true }).map((h) => `- [[${h.title}]] (${h.folder}): ${h.snippet}`).join('\n');
}
function colleagueState(x) {
  const open = db().tasks.filter((t) => t.assigneeId === x.id && OPEN.has(t.status) && t.status !== 'blocked');
  const mtg = db().meetings.find((m) => (m.status === 'running' || m.status === 'waiting_owner') && (m.participants || []).includes(x.id));
  if (x.status === 'offline') return 'sedang offline.';
  if (x.status === 'meeting') return mtg ? `sedang rapat "${String(mtg.topic).slice(0, 50)}".` : 'sedang rapat singkat.';
  if (x.status === 'working' || open.length) return open.length ? `sedang mengerjakan "${String(open[0].title).slice(0, 60)}"${open.length > 1 ? ` (+${open.length - 1} tugas lain)` : ''}.` : 'sedang bekerja.';
  if (x.status === 'chatting') return 'sedang mengobrol dengan seseorang.';
  return 'sedang luang, tidak ada tugas aktif.';
}
const GREET_WORDS = new Set(['hai', 'halo', 'hi', 'hello', 'hey', 'p', 'tes', 'test', 'pagi', 'siang', 'sore', 'malam', 'oi', 'woi', 'assalamualaikum', 'selamat', 'ya', 'owner']);
/** zero-token answers for greetings and "what can you do": the model adds nothing there, and it kept parroting tool names */
function quickReply(e, msg, ch) {
  const raw = String(msg.text || '').replace(/@[\w-]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const who = /^anda\b/i.test(emp(msg.authorId)?.name || '') ? 'Owner' : String(emp(msg.authorId)?.name || 'Owner').split(' ')[0];
  const words = raw.split(' ').filter(Boolean);
  const first = String(e.name || '').toLowerCase().split(' ')[0];
  const title = String(e.title || '').replace(/\s*[·\-–]\s*Anda \(Owner\)\s*$/i, '').trim();
  const mine = db().messages.filter((m) => m.channelId === ch.id && m.authorId === e.id);
  const lastMine = new Set(mine.slice(-4).map((m) => m.text));
  const pick = (arr) => arr.find((t) => !lastMine.has(t)) || arr[Math.floor(Date.now() / 1000) % arr.length];   // never repeat what was just said
  const open = db().tasks.filter((t) => t.assigneeId === e.id && OPEN.has(t.status) && t.status !== 'blocked');
  const state = e.status === 'meeting' ? 'Saya sedang di rapat.' : open.length ? `Saya sedang menangani "${String(open[0].title).slice(0, 50)}".` : 'Saya sedang luang.';
  if (words.length && words.length <= 3 && words.every((w) => GREET_WORDS.has(w) || w === first)) {
    const spokeRecently = mine.some((m) => Date.now() - (m.t || 0) < 6 * 3600e3);
    if (!spokeRecently) return `Halo ${who}! Saya ${e.name}, ${title}. ${state} Mau beri tugas, ajak rapat, atau sekadar tanya?`;
    if (words.length === 1 && words[0] === first) return pick([`Ya, ${who}? Saya di sini.`, `Iya ${who}, saya dengar.`, `Siap, ${who}. Ada yang bisa saya bantu?`]);
    return pick([`Halo lagi, ${who}. ${state}`, `Hai ${who}! Ada yang bisa saya bantu?`, `Siap ${who}. Mau mulai dari mana?`, `Hai! ${state} Silakan beri arahan.`]);
  }
  // "list semua", "daftar lengkap", "apa lagi": EVERY document title, grouped by folder, straight from the Brain (complete and true, zero tokens)
  if (words.length <= 10 && /\b(list|daftar|daftarkan|sebutkan)\b.*\b(semua|semuanya|lengkap|seluruh)\b|\b(semua|semuanya|seluruh)\b.*\b(list|daftar|judul|dokumen)\b|\bapa\s?lagi\b|\bapalgi\b/.test(raw)) {
    const notes = db().notes.filter((n) => !n.archived && brain.isVerified(n) && n.visibility !== 'private');
    if (!notes.length) return brainOverview().text;
    const by = new Map();
    for (const n of notes) { const k = String(n.folder || '').replace(/^Drive\//, '').split('/').join(' › '); if (!by.has(k)) by.set(k, []); by.get(k).push(n.title); }
    const MAX = 150; let shown = 0;
    const parts = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id', { numeric: true })).map(([k, l]) => { const take = l.slice(0, Math.max(0, MAX - shown)); shown += take.length; return take.length ? `**${k}** (${l.length})\n${take.map((t) => `- ${t}`).join('\n')}` : ''; }).filter(Boolean);
    return `Semua dokumen terverifikasi di Brain (${notes.length}):\n\n${parts.join('\n\n')}${notes.length > MAX ? `\n\n…dan ${notes.length - MAX} lagi. Buka halaman Brain untuk melihat semuanya.` : ''}`;
  }
  // "ada data apa aja?", "isi drive apa?": the Brain answers itself, zero tokens, no invented folders
  if (words.length <= 10 && (/\b(data|dokumen|file|catatan|knowledge|pengetahuan|isi)\b.*\b(apa|apa aja|apa saja|aja|saja)\b/.test(raw) || /\b(isi|ada apa)\b.*\b(drive|brain|otak)\b|\b(drive|brain)\b.*\b(isi|ada apa|apa aja|apa saja)\b|\bdi folder drive\b/.test(raw))) {
    const o = brainOverview();
    return o.text + (o.total ? '\n\nTanya isi salah satunya, mis. "jelaskan struktur organisasi RayCorp", dan saya jawab dari dokumennya.' : '');
  }
  // "progresnya gimana?": answered straight from the task tree, zero tokens, nothing invented
  if (/\b(progres\w*|progress\w*|status\w*|sampai\s+mana|sudah\s+sampai|update\w*|perkembangan\w*|kabar\w*)\b/.test(raw) && words.length <= 8) {
    const root = ch.goalId ? task(ch.goalId) : (e.isPA ? db().tasks.filter((x) => x.kind === 'goal' && !x.parentId && x.createdBy === msg.authorId).at(-1) : null);
    if (root) return goalStatus(root) + (root.status === 'review' ? '\nHasil akhirnya menunggu review-mu di **Butuh kamu**.' : '');
  }
  // "taufik lagi apa?", "sora?" asked to someone else: answer with the colleague's REAL state instead of the replier's own (it used to describe itself)
  const others = namesIn(raw).filter((id) => id !== e.id && !(ch.members || []).includes(id)).map(emp).filter(Boolean);   // people in this thread answer for themselves
  if (others.length && others.length <= 3 && (/\b(lagi|sedang|lg)\s+(apa|ngapain|dimana|di\s+mana|kerja\s+apa)\b|\bngapain\b|\b(dimana|di\s+mana|kemana|ke\s+mana)\b|\bstatus\b/.test(raw) || words.length <= 2)) {
    return others.map((x) => `${x.name} ${colleagueState(x)}`).join(' ') + (words.length <= 2 ? ` Mau saya sampaikan sesuatu ke ${others[0].name}, atau kamu ajak bicara langsung lewat "+ Agen"?` : '');
  }
  if (/\b(bisa\s+apa|apa\s+(?:saja|aja)\s+(?:yang\s+)?bisa|bantuan|help|fitur)\b/.test(raw)) return pick(['Lewat kotak ini kamu bisa: beri tugas atau goal ("buat rencana promo akhir tahun") yang saya pecah ke tim; ajak rapat ("rapat dengan Maya soal promo") dan mereka berkumpul di Conference Hall; tanya status atau isi Brain; atau minta saya mendekat ("ikuti saya"). Beberapa agen sekaligus lewat "+ Agen".', 'Singkatnya: kasih saya tugas, ajak rapat, tanya status, atau minta saya mendekat. Contoh: "tolong rangkum laporan penjualan" atau "rapat dengan Maya".']);
  return null;
}

// ───────────────────────── orchestrator entry point (one chat box for everything) ─────────────────────────
/** One message from the Owner. mode: 'auto' | 'chat' | 'goal'. auto = goal when it reads like work and nobody was addressed, otherwise a chat (DM with one agent, group with several). */
export function orchestrate({ text, userId = 'owner', to = [], mode = 'auto', channelId = null, images = [] }) {
  text = String(text || '').trim().slice(0, 8000);
  const attachments = saveImages(images);   // pictures become files; the message only carries links
  if (!text && !attachments.length) throw new Error('Pesan kosong');
  if (!text) text = '(gambar)';
  if (attachments.length && mode === 'goal') mode = 'chat';   // a picture is something to look at and talk about, not a new goal
  // replying inside a goal thread: the message stays in that thread (PA answers, named heads join), it is not a new goal
  const thread = channelId && db().channels.find((c) => c.id === channelId && c.goalId && c.members.includes(userId));
  if (thread && !(Array.isArray(to) && to.length)) {
    const m = postMessage(thread.id, userId, text, attachments.length ? { attachments } : {});
    onHumanMessage(m).catch((err) => { console.error('[orchestrate] goal thread', err); postMessage(thread.id, task(thread.goalId)?.assigneeId || userId, '⚠️ Maaf, ada galat: ' + err.message); });
    return { action: 'chat', channelId: thread.id, members: thread.members.filter((x) => x !== userId), orchestrator: task(thread.goalId)?.assigneeId };
  }
  const pa = db().employees.find((x) => x.isPA && x.ownerId === userId && x.status !== 'offline') || db().employees.find((x) => x.isMaster) || emp('aria');
  const mentioned = [...text.matchAll(/@([\w-]+)/g)].map((m) => m[1].toLowerCase()).map((n) => db().employees.find((x) => x.id === n || x.name.toLowerCase() === n)).filter(Boolean).map((e) => e.id);
  const ids = [...new Set([...(Array.isArray(to) ? to : []), ...mentioned])].filter((id) => emp(id)?.type === 'ai');
  // a goal only when nobody was addressed, no meeting is going on or asked for, and the sentence reads like work (or the Owner picked "Goal")
  const meet = mode === 'goal' || attachments.length ? null : meetingIntent(text, ids, userId);
  const action = mode === 'goal' ? 'goal' : mode === 'chat' || meet || attachments.length ? 'chat' : (!ids.length && looksLikeWork(text) ? 'goal' : 'chat');
  if (action === 'goal') {
    const t = submitGoal({ title: text.replace(/@[\w-]+/g, '').trim().slice(0, 150) || 'Goal dari Owner', description: text, userId });
    const chId = ensureGoalThread(t) || ensureDM(userId, pa.id);
    postMessage(chId, userId, text);
    postMessage(chId, pa.id, `🎯 **Goal diterima** dan punya thread sendiri ini.\n_Definisi selesai:_ ${t.expected}\nKemajuan tiap bagian muncul di sini. Tanya "progresnya?" kapan saja, sebut nama kepala divisi untuk mengajaknya bicara, dan hasil akhirnya kamu review di **Butuh kamu** sebelum dianggap selesai.`, { taskId: t.id, goal: true });
    postMessage(ensureDM(userId, pa.id), pa.id, `🎯 Goal baru: **${t.title.slice(0, 90)}**. Diskusinya pindah ke thread goal itu.`, { taskId: t.id, goal: true, channelRef: chId });
    return { action: 'goal', channelId: chId, taskId: t.id, orchestrator: pa.id };
  }
  // everything else is a message in a conversation; onHumanMessage decides meeting / broadcast / reply in ONE place
  const members = ids.length ? ids : [pa.id];
  const chId = members.length === 1 ? ensureDM(userId, members[0]) : ensureGroup(userId, members);
  const m = postMessage(chId, userId, text, attachments.length ? { attachments } : {});
  onHumanMessage(m).catch((err) => { console.error('[orchestrate] chat error', err); postMessage(chId, pa.id, '⚠️ Maaf, ada galat saat memproses pesan: ' + err.message); });
  return { action: meet && (meet !== 'say' || !ids.length) ? 'meeting' : 'chat', channelId: chId, members, orchestrator: pa.id };
}
