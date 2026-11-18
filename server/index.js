// HTTP server: REST API, Server-Sent Events stream, static frontend. No framework.
import * as edgeTts from './tts-edge.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as engine from './engine.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
import { slug } from './seed.js';
import * as studio from './studio.js';
import { CAPABILITIES, ensureEmployeeConfig, autoActivate, skillTools, grantUniversalSkills } from './catalog.js';
import * as lib from './librarian.js';
import { personalAssistant } from './roster.js';
import * as collab from './collab.js';
import * as org from './org.js';
import os from 'node:os';
import * as auth from './auth.js';
import * as gdrive from './gdrive.js';
import * as browser from './browser.js';
import * as otomasi from './n8n.js';
import * as staffApi from './staff/index.js';
import * as learn from './skills-learn.js';
import * as power from './skills-power.js';
import * as pemandu from './pemandu.js';
import { starterDb } from './workspace.js';

// Local secrets (GROQ_API_KEY / ANTHROPIC_API_KEY) live in .env, never in the repo.
try { process.loadEnvFile(path.resolve('.env')); } catch { /* no .env */ }

const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve('public');
const VENDOR = { '/vendor/three/': path.resolve('node_modules/three/') };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mjs': 'text/javascript; charset=utf-8', '.onnx': 'application/octet-stream', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

if (process.argv.includes('--reset-only')) { store.load({ reset: true }); console.log('Data direset.'); process.exit(0); }
store.load();
store.loadWorkspaces();
for (const ws of store.ids()) store.run(ws, () => { const d = store.get(); if (d.powerRev !== power.REV) { const r = power.install(d); d.powerRev = power.REV; store.saveNow(); console.log(`  Paket skill super [${ws}]: ${r.skills} skill baru, ${r.refs} pemasangan ke agen`); } });
auth.load();
if (store.get().needsOrganize) { const r = lib.autoOrganize('arsa'); delete store.get().needsOrganize; store.save(); console.log(`Brain dirapikan: ${r.moved} dipindah, ${r.renamed} diganti nama`); }
engine.start();

const clients = new Map();   // SSE response -> workspace id
const BOOT = Date.now();
let lastCpu = os.cpus().map((c) => c.times);
let lastProc = process.cpuUsage(), lastProcT = Date.now();
function hostStats() {
  const now = os.cpus().map((c) => c.times);
  let idle = 0, total = 0;
  now.forEach((t, i) => { const p = lastCpu[i] || t; const d = (k) => t[k] - p[k]; const tot = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); idle += d('idle'); total += tot; });
  lastCpu = now;
  const pu = process.cpuUsage(lastProc), pdt = Math.max(1, Date.now() - lastProcT); lastProc = process.cpuUsage(); lastProcT = Date.now();
  const procCpu = Math.round(((pu.user + pu.system) / 1000 / pdt) * 100);   // % of ONE core used by this server process
  let disk = null;
  try { const st = fs.statfsSync(process.cwd()); disk = Math.round((1 - st.bavail / st.blocks) * 100); } catch { /* unsupported fs */ }
  return {
    cpu: total ? Math.round((1 - idle / total) * 100) : 0, mem: Math.round((1 - os.freemem() / os.totalmem()) * 100), disk,
    rss: Math.round(process.memoryUsage().rss / 1048576), procCpu, uptime: Math.round((Date.now() - BOOT) / 1000), platform: `${os.platform()} ${os.arch()}`,
    node: process.version, sessions: engine.running().length, llm: llm.health(),
  };
}
setInterval(() => store.broadcast({ kind: 'root', key: 'host', value: hostStats(), all: true }), 5000);
store.subscribe((msg) => { const line = `data: ${JSON.stringify(msg)}\n\n`; for (const [res, ws] of clients) if (msg.all || msg.ws === ws) { if (msg.coll === 'notes' && msg.kind === 'upsert' && !store.run(ws, () => brain.canRead(msg.item, { employeeId: res.employeeId }))) res.write(`data: ${JSON.stringify({ kind: 'remove', coll: 'notes', id: msg.item.id })}\n\n`); else res.write(line); } });   // a workspace's changes reach only that workspace
setInterval(() => { for (const res of clients.keys()) res.write(': ping\n\n'); }, 20000);

const db = () => store.get();
const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
const need = (v, msg) => { if (v === undefined || v === null || v === '') throw bad(msg); return v; };
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 5e6) throw bad('Payload terlalu besar', 413); }
  return s ? JSON.parse(s) : {};
}

const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

on('GET', '/api/state', async (b, p, url, me, member) => {
  if (llm.hasGroq()) try { await llm.refreshGroqModels(); } catch (err) { console.warn(`Daftar model Groq memakai cache: ${err.message}`); }
  return { ...store.snapshot(), notes: db().notes.filter(n => brain.canRead(n, { employeeId: member?.employeeId || db().settings.currentUserId })), running: engine.running(), live: llm.isLive(), provider: llm.provider(), models: llm.MODELS, groqModels: llm.GROQ_MODELS, claudeModels: llm.CLAUDE_MODELS, capabilities: CAPABILITIES, host: hostStats(), me: member?.employeeId || db().settings.currentUserId, account: auth.publicUser(me), workspace: me ? wsInfo(me) : null };
});

on('POST', '/api/goals', (b) => { if (/^\s*(\/\w+|saya selesai)\s*$/i.test(String(b.title || ''))) throw new Error('Itu perintah chat rapat, bukan goal. Ketik di chat rapatnya.'); return engine.submitGoal({ title: need(b.title, 'Judul goal wajib'), description: b.description || '', userId: b.userId || db().settings.currentUserId, priority: b.priority || 'high' }); });

on('POST', '/api/tasks', (b) => engine.createTask({ ...pick(b, ['title', 'description', 'assigneeId', 'priority', 'dueAt', 'parentId']), title: need(b.title, 'Judul wajib'), createdBy: b.userId || db().settings.currentUserId }));
on('PATCH', '/api/tasks/:id', (b, p) => {
  const t = db().tasks.find((x) => x.id === p.id) || (() => { throw bad('Tugas tidak ada', 404); })();
  const ch = pick(b, ['title', 'description', 'priority', 'status', 'assigneeId', 'dueAt']);
  if (ch.assigneeId) { const e = db().employees.find((x) => x.id === ch.assigneeId); if (!e) throw bad('Karyawan tidak ada'); ch.divisionId = e.divisionId; }
  if (ch.status === 'todo') t.failures = 0;
  Object.assign(t, ch, { updatedAt: Date.now() });
  t.log.push({ t: Date.now(), actorId: b.userId || 'owner', type: 'edit', text: `Diubah: ${Object.keys(ch).join(', ')}` });
  return store.upsert('tasks', t);
});
on('DELETE', '/api/tasks/:id', (b, p) => {
  const ids = new Set([p.id]);
  let grew = true;
  while (grew) { grew = false; for (const t of db().tasks) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); grew = true; } }
  for (const id of ids) store.remove('tasks', id);
  for (const a of db().approvals.filter((a) => ids.has(a.taskId))) store.remove('approvals', a.id);
  return { removed: ids.size };
});
on('POST', '/api/tasks/:id/comment', (b, p) => {
  const t = db().tasks.find((x) => x.id === p.id) || (() => { throw bad('Tugas tidak ada', 404); })();
  t.log.push({ t: Date.now(), actorId: b.userId || 'owner', type: 'comment', text: need(b.text, 'Komentar kosong') });
  if (b.text && t.status !== 'done') t.description += `\n\n[Komentar ${db().employees.find((e) => e.id === (b.userId || 'owner'))?.name}]: ${b.text}`;
  return store.upsert('tasks', t);
});
on('POST', '/api/tasks/:id/complete', (b, p) => engine.humanComplete(p.id, { userId: b.userId || db().settings.currentUserId, output: b.output || '' }));
on('POST', '/api/approvals/:id', (b, p) => engine.decideApproval(p.id, { decision: need(b.decision, 'decision wajib'), feedback: b.feedback || '', userId: b.userId || db().settings.currentUserId }));

on('POST', '/api/messages', (b) => {
  const m = engine.postMessage(need(b.channelId, 'channelId wajib'), b.userId || db().settings.currentUserId, need(b.text, 'Pesan kosong').slice(0, 8000));
  engine.onHumanMessage(m).catch((err) => console.error('[onHumanMessage]', err));
  return m;
});
on('POST', '/api/orchestrate', (b) => engine.orchestrate({ images: b.images || [], text: b.images?.length ? b.text || '' : need(b.text, 'Pesan kosong'), userId: b.userId || db().settings.currentUserId, to: b.to || [], mode: b.mode || 'auto', channelId: b.channelId || null }));
on('POST', '/api/dm', (b) => ({ id: engine.ensureDM(b.userId || db().settings.currentUserId, need(b.with, 'with wajib')) }));
on('POST', '/api/channels', (b) => store.upsert('channels', { id: slug(need(b.name, 'Nama wajib')), name: slug(b.name), kind: 'channel', divisionId: b.divisionId || null, topic: b.topic || '' }));

on('POST', '/api/notes', (b) => brain.writeNote({ title: need(b.title, 'Judul wajib'), content: b.content || `# ${b.title}\n`, folder: b.folder || 'Notes', tags: b.tags || [], authorId: b.userId || db().settings.currentUserId }));
on('PUT', '/api/notes/:id', (b, p) => {
  const n = db().notes.find((x) => x.id === p.id) || (() => { throw bad('Catatan tidak ada', 404); })();
  const editor = db().employees.find((e) => e.id === (b.userId || db().settings.currentUserId));
  Object.assign(n, pick(b, ['title', 'content', 'folder', 'tags', 'pinned', 'visibility']), { updatedAt: Date.now(), lastEditorId: editor?.id || 'owner' });
  // a human who edits a note vouches for it: it becomes a verified fact, and an archived demo note comes back from the archive
  if (editor?.type === 'human' && b.content !== undefined) { n.kb = 'owner'; if (n.archived) { n.archived = false; if (!b.folder) n.folder = n.origFolder || 'Notes'; } }
  return store.upsert('notes', n);
});
on('DELETE', '/api/notes/:id', (b, p) => ({ ok: store.remove('notes', p.id) }));

const EMP_FIELDS = ['name', 'type', 'divisionId', 'title', 'persona', 'skills', 'isLead', 'reportsTo', 'avatar', 'autonomy', 'model', 'status',
  'about', 'taskAndFunction', 'instructions', 'escalation', 'outputFormat', 'effort', 'skillRefs', 'tools', 'knowledgeIds', 'starters', 'reasoning', 'team', 'appearance', 'voiceGender'];
const cleanVoiceGender = (o) => { if ('voiceGender' in o && o.voiceGender !== 'female' && o.voiceGender !== 'male') delete o.voiceGender; return o; };   // the voice follows this field; anything else is ignored
on('POST', '/api/employees', (b) => org.hire(cleanVoiceGender(pick(b, EMP_FIELDS)), b.userId || 'owner'));
on('PATCH', '/api/employees/:id', (b, p) => {
  const e = db().employees.find((x) => x.id === p.id) || (() => { throw bad('Karyawan tidak ada', 404); })();
  const ch = cleanVoiceGender(pick(b, EMP_FIELDS));
  if (typeof ch.skills === 'string') ch.skills = ch.skills.split(',').map((s) => s.trim()).filter(Boolean);
  if (ch.status === 'offline') ch.statusText = 'Offline';
  if (ch.status === 'idle') ch.statusText = 'Siap bekerja';
  Object.assign(e, ch);
  if (ch.skillRefs && db().settings.autoActivate !== false) autoActivate(e, db().skills);
  if (ch.isLead) { const d = db().divisions.find((x) => x.id === e.divisionId); d.leadId = e.id; store.upsert('divisions', d); }
  return store.upsert('employees', e);
});
on('DELETE', '/api/employees/:id', (b, p) => {
  if (p.id === 'owner') throw bad('Owner tidak bisa dihapus');
  const e = db().employees.find((x) => x.id === p.id);
  for (const t of db().tasks.filter((t) => t.assigneeId === p.id && t.status !== 'done')) Object.assign(t, { assigneeId: e?.reportsTo && e.reportsTo !== 'owner' ? e.reportsTo : 'aria', status: 'todo' }), store.upsert('tasks', t);
  for (const d of db().divisions.filter((d) => d.leadId === p.id)) { d.leadId = null; store.upsert('divisions', d); }
  return { ok: store.remove('employees', p.id) };
});

on('GET', '/api/employees/:id/prompt', (b, p) => {
  const e = db().employees.find((x) => x.id === p.id) || (() => { throw bad('Karyawan tidak ada', 404); })();
  const text = engine.systemPrompt(e);
  return { text, chars: text.length, approxTokens: Math.round(text.length / 3.6) };
});
on('POST', '/api/studio/generate', (b) => studio.generate(b));
on('POST', '/api/meetings', (b) => {
  const representedIds = [...new Set((b.participantIds || []).filter((id) => db().employees.some((e) => e.id === id && e.type === 'ai')))];
  let ids = representedIds;
  // A company-wide meeting is represented by every division head. All selected
  // employees remain recorded as represented participants without 154 LLM calls.
  if (ids.length > 25) {
    const divisions = new Set(ids.map((id) => db().employees.find((e) => e.id === id)?.divisionId));
    ids = db().divisions.filter((d) => divisions.has(d.id)).map((d) => db().employees.find((e) => e.id === d.leadId) || db().employees.find((e) => e.type === 'ai' && e.divisionId === d.id)).filter(Boolean).map((e) => e.id);
  }
  const chairId = b.chairId || ids[0] || 'aria';
  // run in background; progress streams over SSE (meetings collection + meeting channel)
  const meetUser = b.userId || db().settings.currentUserId, meetPA = db().employees.find((e) => e.isPA && e.ownerId === meetUser);
  collab.runMeeting({ topic: need(b.topic, 'Topik wajib'), agenda: b.agenda || '', participantIds: ids, representedParticipantIds: representedIds, chairId, rounds: Number(b.rounds) || 2, ownerLed: b.ownerLed !== false, ownerId: meetUser, mode: b.mode, mirrorChannelId: meetPA ? engine.ensureDM(meetUser, meetPA.id) : null }).catch((err) => console.warn('[meeting]', err.message));
  return { ok: true, represented: representedIds.length, activeParticipants: [...new Set([chairId, ...ids])].length, ownerLed: b.ownerLed !== false };
});
on('POST', '/api/mcp/test', async (b) => {
  const server = { id: 'test', name: b.name || 'test', url: need(b.url, 'URL wajib'), headers: b.headers || {} };
  collab.resetMcp();
  const tools = await collab.mcpListTools(server, true);
  collab.resetMcp();
  return { ok: true, tools: tools.map((t) => ({ name: t.name, description: (t.description || '').slice(0, 160) })) };
});
on('POST', '/api/google-workspace/test', async () => collab.googleWorkspaceCall('status', {}));
on('GET', '/api/training/:id', (b, p) => {
  const file = collab.trainingFile(p.id);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { employeeId: p.id, examples: lines.length, jsonl: lines.join('\n') };
});
on('GET', '/api/capabilities', () => CAPABILITIES.map((c) => ({ ...c, users: db().employees.filter((e) => (e.tools || []).includes(c.id)).length, skills: db().skills.filter((s) => skillTools(s).includes(c.id)).map((s) => s.id) })));
on('GET', '/api/brain/audit', () => lib.audit(40));
// ───── Knowledge spaces: per-division knowledge coverage, library assignments, learning overview
on('GET', '/api/knowledge/spaces', () => {
  const notes = db().notes, emps = db().employees.filter((e) => e.type === 'ai');
  const lib2 = notes.filter((n) => n.folder?.startsWith('Knowledge Library/'));
  const areas = {};
  for (const n of lib2) { const a = n.folder.split('/')[1]; areas[a] = (areas[a] || 0) + 1; }
  const divisions = db().divisions.map((d) => {
    const mem = emps.filter((e) => e.divisionId === d.id);
    const withKb = mem.filter((e) => (e.knowledgeIds || []).some((k) => lib2.some((n) => n.id === k))).length;
    const ownNotes = notes.filter((n) => n.folder?.split('/')[0] === d.name).length;
    const avgSkill = mem.length ? mem.reduce((a, e) => a + (e.skillRefs || []).reduce((x, r) => x + r.proficiency, 0) / Math.max(1, (e.skillRefs || []).length), 0) / mem.length : 0;
    return { id: d.id, name: d.name, icon: d.icon, color: d.color, agents: mem.length, covered: withKb, coverage: mem.length ? Math.round((withKb / mem.length) * 100) : 0, ownNotes, avgSkill: Math.round(avgSkill * 10) / 10, teams: (d.teams || []).length };
  });
  return { library: lib2.length, areas, divisions, totalNotes: notes.length, agents: emps.length };
});
on('GET', '/api/knowledge/library', () => db().notes.filter(n => brain.canRead(n)).filter((n) => n.folder?.startsWith('Knowledge Library/')).map((n) => ({ id: n.id, title: n.title, folder: n.folder, tags: n.tags, words: n.content.split(/\s+/).length, attached: db().employees.filter((e) => e.type === 'ai' && (e.knowledgeIds || []).includes(n.id)).length })));
on('POST', '/api/knowledge/assign', (b) => {
  const n = db().notes.find((x) => x.id === b.noteId); if (!n) throw bad('Catatan tidak ditemukan', 404);
  const ids = b.divisionId ? db().employees.filter((e) => e.type === 'ai' && e.divisionId === b.divisionId).map((e) => e.id) : (b.employeeIds || []);
  let n2 = 0;
  for (const id of ids) {
    const e = db().employees.find((x) => x.id === id); if (!e || e.type !== 'ai') continue;
    const has = (e.knowledgeIds || []).includes(n.id);
    if (b.mode === 'remove' && has) { e.knowledgeIds = e.knowledgeIds.filter((k) => k !== n.id); n2++; }
    if ((b.mode || 'add') === 'add' && !has) { e.knowledgeIds = [...(e.knowledgeIds || []), n.id]; n2++; }
    store.upsert('employees', e);
  }
  engine.event('learned', b.userId || 'owner', `${n.title} dibagikan ke ${n2} agen`, { targetId: ids[0] });
  return { changed: n2 };
});
on('GET', '/api/learning', () => db().employees.filter((e) => e.type === 'ai').map((e) => ({
  id: e.id, name: e.name, divisionId: e.divisionId, team: e.team || null, title: e.title, status: e.status,
  quality: e.stats?.qualityN ? Math.round((e.stats.qualitySum / e.stats.qualityN) * 10) / 10 : null,
  tasks: e.stats?.tasksDone || 0, examples: e.stats?.trainingExamples || 0, mood: e.mind?.mood || null, confidence: e.mind?.confidence ?? null,
  skills: (e.skillRefs || []).slice().sort((a, b2) => b2.proficiency - a.proficiency).slice(0, 4).map((r) => ({ id: r.id, name: db().skills.find((s) => s.id === r.id)?.name || r.id, proficiency: r.proficiency })),
  lessons: (e.lessons || []).slice(-3).map((l) => ({ t: l.t, lesson: l.lesson, quality: l.quality })),
})));
on('POST', '/api/learning/train', (b) => {
  const e = db().employees.find((x) => x.id === b.employeeId && x.type === 'ai'); if (!e) throw bad('Agen tidak ditemukan', 404);
  const sk = db().skills.find((s) => s.id === b.skillId); if (!sk) throw bad('Skill tidak ditemukan', 404);
  const lesson = String(b.lesson || '').trim().slice(0, 300); if (!lesson) throw bad('Isi pelajaran wajib');
  const ref = (e.skillRefs ||= []).find((r) => r.id === sk.id);
  if (ref) ref.proficiency = Math.min(10, Math.round((ref.proficiency + 0.5) * 10) / 10); else e.skillRefs.push({ id: sk.id, proficiency: 5 });
  e.lessons = [...(e.lessons || []), { t: Date.now(), taskId: null, lesson, quality: 8, by: b.userId || 'owner' }].slice(-25);
  brain.remember(e, `Dilatih ${sk.name}: ${lesson}`);
  store.upsert('employees', e);
  engine.event('learned', e.id, `${e.name} belajar: ${sk.name} — ${lesson.slice(0, 120)}`, { targetId: e.id });
  return { ok: true, proficiency: (e.skillRefs.find((r) => r.id === sk.id) || {}).proficiency };
});
// Calendar: expand cron/interval routines into concrete occurrences for a date range (max 62 days, 800 items)
on('GET', '/api/calendar', (b, p, url) => {
  const from = Number(url.searchParams.get('from')) || Date.now();
  const to = Math.min(Number(url.searchParams.get('to')) || from + 31 * 864e5, from + 62 * 864e5);
  const out = [];
  for (const r of db().routines.filter((x) => x.enabled)) {
    if (r.cron) {
      const f = collab.parseCron(r.cron); if (!f) continue;
      for (let t = Math.ceil(from / 60000) * 60000; t < to && out.length < 800; t += 60000) {
        const d = new Date(t);
        if (!f[1].has(d.getHours())) { t += (59 - d.getMinutes()) * 60000; continue; }
        if (f[0].has(d.getMinutes()) && f[2].has(d.getDate()) && f[3].has(d.getMonth() + 1) && f[4].has(d.getDay())) out.push({ routineId: r.id, title: r.title, employeeId: r.employeeId, at: t });
      }
    } else if (r.everyMinutes >= 30) for (let t = (r.lastRunAt || from) + r.everyMinutes * 60000; t < to && out.length < 800; t += r.everyMinutes * 60000) if (t >= from) out.push({ routineId: r.id, title: r.title, employeeId: r.employeeId, at: t });
  }
  return out.sort((a, b2) => a.at - b2.at);
});
on('POST', '/api/brain/organize', (b) => { const r = lib.autoOrganize(b.userId || 'arsa'); engine.event('note_written', 'arsa', `Arsa merapikan Brain: ${r.moved} catatan dipindah, ${r.renamed} judul diperbaiki`, {}); return r; });
on('POST', '/api/training-sets', (b) => lib.buildTrainingSet({ divisionId: b.divisionId || undefined, employeeId: b.employeeId || undefined, minQuality: Number(b.minQuality) || 7 }));
on('POST', '/api/employees/:id/activate', (b, p) => { const e = db().employees.find((x) => x.id === p.id) || (() => { throw bad('Karyawan tidak ada', 404); })(); const added = autoActivate(e, db().skills); store.upsert('employees', e); return { added, tools: e.tools }; });
const SKILL_FIELDS = ['name', 'category', 'description', 'promptSnippet', 'usageGuide', 'example', 'tags', 'divisions', 'tools'];
on('POST', '/api/skills', (b) => {
  let id = slug(need(b.name, 'Nama skill wajib'));
  while (db().skills.some((x) => x.id === id)) id += '-' + Math.random().toString(36).slice(2, 4);
  const skill = store.upsert('skills', { id, category: 'Strategy', description: '', promptSnippet: '', usageGuide: '', example: '', tags: [], divisions: [], ...pick(b, SKILL_FIELDS), builtIn: false, createdAt: Date.now() });
  for (const e of db().employees.filter((x) => x.type === 'ai')) {
    grantUniversalSkills(e, db().skills);
    store.upsert('employees', e);
  }
  return skill;
});
on('PATCH', '/api/skills/:id', (b, p) => store.patch('skills', p.id, pick(b, SKILL_FIELDS)));
on('DELETE', '/api/skills/:id', (b, p) => {
  for (const e of db().employees.filter((e) => e.skillRefs?.some((r) => r.id === p.id))) { e.skillRefs = e.skillRefs.filter((r) => r.id !== p.id); store.upsert('employees', e); }
  return { ok: store.remove('skills', p.id) };
});

on('POST', '/api/divisions', (b) => org.createDivision(b));
on('PATCH', '/api/divisions/:id', (b, p) => store.patch('divisions', p.id, pick(b, ['name', 'short', 'color', 'icon', 'mission', 'leadId', 'delegation'])));

on('POST', '/api/routines', (b) => {
  const targetType = b.targetType || 'employee';
  const targetId = b.targetId || b.employeeId || 'aria';
  return store.upsert('routines', { id: store.uid('r'), employeeId: targetType === 'employee' ? targetId : (b.employeeId || 'aria'), targetType, targetId, targetTag: String(b.targetTag || '').replace(/^#/, '').slice(0, 60), title: need(b.title, 'Judul wajib'), description: b.description || '', everyMinutes: Math.max(1, Number(b.everyMinutes) || 60), enabled: b.enabled !== false, lastRunAt: Date.now() });
});
on('PATCH', '/api/routines/:id', (b, p) => store.patch('routines', p.id, pick(b, ['title', 'description', 'everyMinutes', 'enabled', 'employeeId', 'targetType', 'targetId', 'targetTag'])));
on('DELETE', '/api/routines/:id', (b, p) => ({ ok: store.remove('routines', p.id) }));
on('POST', '/api/routines/:id/run', (b, p) => engine.runRoutine(db().routines.find((x) => x.id === p.id), { priority: 'medium' }));

on('PATCH', '/api/settings', async (b, p, url, me, member) => {
  ownerOnly(me, member);
  const s = db().settings;
  const ch = pick(b, ['uiKeys', 'mcpServers', 'googleAppsScript', 'learning', 'collectTraining', 'model', 'workerModel', 'groqModel', 'groqWorkerModel', 'provider', 'effort', 'autonomy', 'tickMs', 'maxConcurrent', 'dailyBudgetUSD', 'mode', 'currentUserId', 'autoActivate', 'autoOrganize', 'autoApprove', 'massDispatchSize', 'staffModel']);
  if ('staffModel' in ch) ch.staffModel = ch.staffModel === true;
  if (typeof b.apiKey === 'string' && !b.apiKey.startsWith('••••')) ch.apiKey = b.apiKey.trim();
  if (typeof b.groqApiKey === 'string' && !b.groqApiKey.startsWith('••••')) ch.groqApiKey = b.groqApiKey.trim();
  for (const k of ['tickMs', 'maxConcurrent', 'dailyBudgetUSD']) if (k in ch) ch[k] = Number(ch[k]);
  if ('uiKeys' in ch) { const u = ch.uiKeys || {}, clean = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 60).filter(([a, v]) => typeof v === 'string' && v.length < 24).map(([a, v]) => [String(a).slice(0, 32), v])); ch.uiKeys = { free: clean(u.free), play: clean(u.play), invert: !!u.invert }; }
  if (ch.mcpServers) { ch.mcpServers = ch.mcpServers.map(m => { const old = (s.mcpServers || []).find(x => x.id === m.id); return old && m.configured && !m.url ? { ...m, url: old.url, headers: old.headers } : m; }); ch.mcpServers = ch.mcpServers.filter((m) => /^https?:\/\//.test(m.url || '')).map((m, i) => ({ id: slug(m.name || m.id || `mcp${i}`).replace(/-/g, '').slice(0, 16) || `mcp${i}`, name: String(m.name || 'MCP').slice(0, 40), url: m.url, headers: m.headers && typeof m.headers === 'object' ? m.headers : {}, enabled: m.enabled !== false })); collab.resetMcp(); }
  if (ch.googleAppsScript) {
    const prev = s.googleAppsScript || {};
    const next = ch.googleAppsScript || {};
    if (!/^https:\/\/(script\.google\.com|script\.googleusercontent\.com)\//i.test(next.url || '')) next.url = '';
    if (typeof next.secret !== 'string' || next.secret.startsWith('••••')) next.secret = prev.secret || '';
    ch.googleAppsScript = { url: String(next.url || '').slice(0, 1000), secret: String(next.secret || '').slice(0, 300), enabled: next.enabled !== false };
  }
  Object.assign(s, ch);
  store.setRoot('settings', s);
  if (ch.autoApprove === true) engine.autoApprovePending();
  store.broadcast({ kind: 'root', key: 'live', value: llm.isLive() });
  store.broadcast({ kind: 'root', key: 'provider', value: llm.provider() });
  if (llm.hasGroq() && ('groqApiKey' in ch || ch.provider === 'groq' || ch.provider === 'auto')) {
    try {
      await llm.refreshGroqModels({ force: 'groqApiKey' in ch });
      store.broadcast({ kind: 'root', key: 'groqModels', value: llm.GROQ_MODELS });
      store.broadcast({ kind: 'root', key: 'models', value: llm.MODELS });
    } catch (err) { console.warn(`Daftar model Groq tidak diperbarui: ${err.message}`); }
  }
  return store.publicSettings();
});
on('POST', '/api/groq-models/refresh', async () => {
  if (!llm.hasGroq()) throw bad('Groq API key belum terpasang');
  const result = await llm.verifyGroqModels();
  store.broadcast({ kind: 'root', key: 'groqModels', value: result.models });
  store.broadcast({ kind: 'root', key: 'models', value: llm.MODELS });
  return result;
});
on('PATCH', '/api/company', (b) => { const c = Object.assign(db().company, pick(b, ['name', 'tagline', 'language'])); store.setRoot('company', c); return c; });
on('POST', '/api/test-key', async () => {
  if (!llm.isLive()) throw bad('Belum ada API key / mode simulasi aktif');
  const res = await llm.call({ system: 'Balas satu kata.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 32 });
  return { ok: true, provider: llm.provider(), model: res.usedModel, reply: llm.textOf(res), usage: res.usage };
});
on('GET', '/api/export', (b, p, url, me, member) => { ownerOnly(me, member); return { ...db(), settings: store.exportSettings(), notes: db().notes.filter(n => brain.canRead(n, { employeeId: member?.employeeId || db().settings.currentUserId })) }; });
on('POST', '/api/import', (b) => {
  if (!Array.isArray(b.employees) || !Array.isArray(b.notes)) throw bad('Format file tidak valid');
  const key = db().settings.apiKey, savedSettings = structuredClone(db().settings);
  const fresh = store.load({ reset: true });
  Object.assign(fresh, b, { settings: { ...fresh.settings, ...b.settings, apiKey: key, groqApiKey: savedSettings.groqApiKey, googleAppsScript: savedSettings.googleAppsScript, mcpServers: savedSettings.mcpServers } });
  store.saveNow();
  store.broadcast({ kind: 'reload' });
  return { ok: true };
});
on('POST', '/api/reset', () => {
  const key = db().settings.apiKey;
  const fresh = store.load({ reset: true });
  fresh.settings.apiKey = key; store.saveNow();
  store.broadcast({ kind: 'reload' });
  return { ok: true };
});

// ───────────────────────── accounts & Google Drive ─────────────────────────
/** Workspaces like Discord servers: the first person claims the original office ("main"); everyone else gets a fresh personal workspace
 *  with a small core team; invited people join someone's workspace as a human employee with their own PA. */
const AUTH_HOOKS = {
  mainName: () => store.run('main', () => db().company?.name || 'Kantor utama'),
  linkOwner: (u) => store.run('main', () => { const e = db().employees.find((x) => x.id === 'owner'); if (e) { e.email = u.email; store.upsert('employees', e); } return 'owner'; }),
  createWorkspace: (id, u) => {
    const budget = store.run('main', () => db().settings.workspaceBudgetUSD ?? 0.5);   // daily AI quota per workspace, set by the platform owner
    const data = starterDb({ ownerName: u.name || u.email.split('@')[0], budgetUSD: budget });
    data.employees.find((e) => e.id === 'owner').email = u.email;
    store.createWorkspace(id, data);
    return { name: data.company.name, employeeId: 'owner' };
  },
  joinWorkspace: (wsId, u) => store.run(wsId, () => {
    const have = db().employees.find((x) => x.type === 'human' && x.email === u.email);
    if (have) return have.id;
    return org.hire({ type: 'human', name: u.name || u.email.split('@')[0], title: 'Anggota tim', divisionId: db().divisions.find((d) => d.id === 'exec')?.id || db().divisions[0].id, email: u.email, avatar: 'human' }, 'owner').id;
  }),
};
/** owners and admins of the CURRENT workspace manage it (before anyone has signed in, the local single user does) */
const ownerOnly = (me, member) => { if (auth.enforced() && !['owner', 'admin'].includes(member?.role)) throw bad('Hanya Owner/Admin ruang kerja ini yang boleh melakukan ini', 403); };
const signedIn = (me) => { if (!me) throw bad('Login dengan Google dulu', 401); return me; };
/** Drive belongs to a person, so it may only feed a workspace that person OWNS (never someone else's shared workspace) */
const driveOwner = (me, member) => { signedIn(me); if (member?.role !== 'owner') throw bad('Google Drive hanya bisa disambungkan di ruang kerja milik Anda sendiri', 403); return me; };
const wsInfo = (me) => { const id = auth.activeWs(me), w = auth.wsById(id); return { id, name: w?.name || db().company?.name || 'Kantor', role: auth.memberOf(me, id)?.role || (auth.enforced() ? null : 'owner') }; };
// Browser agen (Chrome DevTools MCP): hanya Owner/Admin yang boleh melihat dan mengendalikan
for (const [m, p, fn] of otomasi.routes) on(m, p, (b, params, url, me, member) => { ownerOnly(me, member); return fn(b, params, url, me, member); });
for (const [m, p, fn] of staffApi.routes) on(m, p, (b, params, url, me, member) => { ownerOnly(me, member); return fn(b, params, url, me, member); });   // staf: daftar, jalankan, hasil (docs/ARSITEKTUR-STAF-N8N.md)
for (const [m, p, fn] of browser.routes) on(m, p, (b, params, url, me, member) => { ownerOnly(me, member); return fn(b, params, url); });
for (const [m, p, fn] of learn.routes) on(m, p, (b, params, url, me, member) => { ownerOnly(me, member); return fn(b, params, url); });   // kartu "aku belajar sesuatu": hanya Owner/Admin yang memutuskan
for (const [m, p, fn] of pemandu.routes) on(m, p, (b, params, url, me, member) => { b.canAutomate = !auth.enforced() || ['owner', 'admin'].includes(member?.role); return fn(b, params, url, me, member); });   // Pemandu: antarmuka depan yang dipandu pilihan tombol
on('GET', '/api/auth/me', (b, p, url, me, member) => ({ configured: auth.configured(), enforced: auth.enforced(), user: auth.publicUser(me), employeeId: member?.employeeId || db().settings.currentUserId, workspace: me ? wsInfo(me) : null, workspaces: me ? auth.myWorkspaces(me) : [], scopes: auth.SCOPES }));
on('POST', '/api/ws/switch', (b, p, url, me) => ({ id: auth.switchWs(signedIn(me), need(b.id, 'id wajib')) }));
on('GET', '/api/ws/members', (b, p, url, me) => { signedIn(me); return { members: auth.wsMembers(auth.activeWs(me)) }; });
on('POST', '/api/ws/invite', (b, p, url, me) => { const r = auth.createInvite(signedIn(me), auth.activeWs(me), b.role); return { ...r, path: '/join/' + r.code }; });
on('POST', '/api/ws/member', (b, p, url, me) => auth.setMemberRole(signedIn(me), auth.activeWs(me), need(b.accountId, 'accountId wajib'), need(b.role, 'role wajib')));
on('POST', '/api/ws/rename', (b, p, url, me) => { const name = auth.renameWs(signedIn(me), auth.activeWs(me), b.name); store.setRoot('company', { ...db().company, name }); return { name }; });
on('GET', '/api/drive/config', (b, p, url, me) => ({ clientId: process.env.GOOGLE_CLIENT_ID || '', pickerKey: process.env.GOOGLE_PICKER_API_KEY || '', appId: String(process.env.GOOGLE_CLIENT_ID || '').split('-')[0], connected: !!me && auth.publicUser(me).drive, folders: auth.driveOf(me?.id)?.folders || null, root: auth.driveOf(me?.id)?.root || null }));
on('GET', '/api/drive/token', async (b, p, url, me) => ({ token: await auth.accessToken(signedIn(me).id) }));   // short-lived, for the Picker in THIS user's browser only
on('POST', '/api/drive/setup', (b, p, url, me, member) => gdrive.ensureFolders(driveOwner(me, member).id));
on('POST', '/api/drive/push', (b, p, url, me, member) => gdrive.push(driveOwner(me, member).id));
on('POST', '/api/drive/pull', (b, p, url, me, member) => gdrive.startPull(driveOwner(me, member).id));   // runs in the background (hundreds of files)
on('GET', '/api/drive/pull-status', (b, p, url, me, member) => gdrive.pullStatus(driveOwner(me, member).id) || { running: false });
on('POST', '/api/drive/picked', (b, p, url, me, member) => gdrive.addPicked(driveOwner(me, member).id, b.ids || []));

on('GET', '/api/tts/status', () => edgeTts.status());
on('POST', '/api/tts', async (b) => { const r = await edgeTts.synthesize(b.text, { voice: b.voice, rate: b.rate, pitch: b.pitch }); return { mime: r.mime, audio: r.audio.toString('base64'), cached: !!r.cached }; });   // opt-in Microsoft voice; the line of text leaves the server

function serveStatic(req, res, urlPath) {
  let base = ROOT; let rel = urlPath;
  for (const [prefix, dir] of Object.entries(VENDOR)) if (urlPath.startsWith(prefix)) { base = dir; rel = urlPath.slice(prefix.length - 1); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(base, path.normalize(decodeURIComponent(rel)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (base === ROOT && !path.extname(rel)) return serveStatic(req, res, '/index.html'); // SPA fallback
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': base === ROOT ? 'no-cache' : 'public, max-age=86400' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // ── sign-in with Google
  if (url.pathname === '/auth/google') return auth.startLogin(req, res);
  if (url.pathname === '/auth/google/callback') return auth.callback(req, res, url, AUTH_HOOKS);
  if (url.pathname === '/auth/logout') return auth.logout(req, res);
  if (url.pathname.startsWith('/join/')) return auth.joinLink(req, res, url.pathname.slice(6), AUTH_HOOKS);
  if (url.pathname.startsWith('/api/automations/hook/') && await otomasi.handleHook(req, res, url, body)) return;   // panggilan balik dari mesin otomasi lokal: token + hanya dari komputer ini, tanpa sesi login
  // ── gate: once anyone has signed in, every API call needs a session (the page itself loads and shows the sign-in card)
  const me = auth.sessionUser(req);
  if (url.pathname.startsWith('/api/') && auth.enforced() && url.pathname !== '/api/auth/me' && !me) return json(res, 401, { error: 'Silakan login dengan Google', login: '/auth/google' });
  // ── which workspace this request belongs to: the person's active one (membership checked); before any sign-in, the original office
  const ws = me && auth.enforced() ? auth.activeWs(me) : 'main';
  const member = me ? auth.memberOf(me, ws) : null;
  if (!store.exists(ws)) return json(res, 500, { error: `Ruang kerja ${ws} tidak ditemukan di server` });
  if (url.pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    res.employeeId = member?.employeeId || store.run(ws, () => db().settings.currentUserId);
    clients.set(res, ws);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  if (req.method === 'GET' && url.pathname.startsWith('/api/files/')) {   // chat pictures: only inside the workspace they belong to (the gate above already checked the session)
    const f = store.run(ws, () => engine.readUpload(decodeURIComponent(url.pathname.slice(11))));
    if (!f) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400' }); return res.end(f.data);
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    try {
      const b = await body(req);
      const sensitive = /^\/api\/(?:import|reset|training|mcp|google-workspace|groq-models|test-key)(?:\/|$)/.test(url.pathname);
      if (sensitive) ownerOnly(me, member);
      if (/^\/api\/(import|reset)$/.test(url.pathname) && store.run(ws, () => engine.running().length || db().meetings.some(m => collab.liveLoops.has(m.id)))) throw bad('Tunggu pekerjaan dan rapat aktif selesai sebelum mengganti data', 409);
      if (/^\/api\/notes\//.test(url.pathname)) {
        const n = store.run(ws, () => db().notes.find(n => n.id === m.groups?.id));
        if (n && !store.run(ws, () => brain.canRead(n, { employeeId: member?.employeeId || db().settings.currentUserId }))) throw bad('Catatan tidak tersedia', 404);
      }
      if (member?.employeeId) b.userId = member.employeeId;   // who is acting comes from the session + workspace, never from what the browser claims
      return json(res, 200, await store.run(ws, () => r.fn(b, m.groups || {}, url, me, member)));   // everything inside runs on THIS workspace's data
    }
    catch (err) {
      const code = err.code && Number.isInteger(err.code) ? err.code : (err.status || 500);
      if (code >= 500) console.error(err);
      return json(res, code, { error: err.message || String(err) });
    }
  }
  json(res, 404, { error: 'Endpoint tidak ada' });
});

// a rejected promise anywhere in a background chat/meeting/job must not take the whole office down
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
// meetings are in-memory loops: after a restart any meeting still marked running/waiting_owner is dead and would block its participants from new meetings
for (const m of store.get().meetings || []) if (m.status === 'running' || m.status === 'waiting_owner') { m.status = 'failed'; m.error = 'Terputus karena server dimulai ulang'; store.upsert('meetings', m); }

server.listen(PORT, HOST, () => {
  console.log(`\n  🏢 RAIVERSE AGENT berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Mesin AI: ${{ groq: 'LIVE · Groq', claude: 'LIVE · Claude', sim: 'SIMULASI (isi GROQ_API_KEY atau ANTHROPIC_API_KEY di .env / Pengaturan)' }[llm.provider()]}`);
  if (HOST === '127.0.0.1') console.log('  Akses dari HP di jaringan yang sama: jalankan dengan HOST=0.0.0.0\n');
});
process.on('SIGINT', () => { store.saveAll(); auth.saveNow(); process.exit(0); });
