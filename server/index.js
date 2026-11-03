// HTTP server: REST API, Server-Sent Events stream, static frontend. No framework.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as engine from './engine.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
import { slug } from './seed.js';
import * as studio from './studio.js';
import { CAPABILITIES, ensureEmployeeConfig, autoActivate, skillTools } from './catalog.js';
import * as lib from './librarian.js';
import { personalAssistant } from './roster.js';
import * as collab from './collab.js';
import * as org from './org.js';
import os from 'node:os';

// Local secrets (GROQ_API_KEY / ANTHROPIC_API_KEY) live in .env, never in the repo.
try { process.loadEnvFile(path.resolve('.env')); } catch { /* no .env */ }

const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve('public');
const VENDOR = { '/vendor/three/': path.resolve('node_modules/three/') };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

if (process.argv.includes('--reset-only')) { store.load({ reset: true }); console.log('Data direset.'); process.exit(0); }
store.load();
if (store.get().needsOrganize) { const r = lib.autoOrganize('arsa'); delete store.get().needsOrganize; store.save(); console.log(`Brain dirapikan: ${r.moved} dipindah, ${r.renamed} diganti nama`); }
engine.start();

const clients = new Set();
const BOOT = Date.now();
let lastCpu = os.cpus().map((c) => c.times);
function hostStats() {
  const now = os.cpus().map((c) => c.times);
  let idle = 0, total = 0;
  now.forEach((t, i) => { const p = lastCpu[i] || t; const d = (k) => t[k] - p[k]; const tot = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); idle += d('idle'); total += tot; });
  lastCpu = now;
  let disk = null;
  try { const st = fs.statfsSync(process.cwd()); disk = Math.round((1 - st.bavail / st.blocks) * 100); } catch { /* unsupported fs */ }
  return {
    cpu: total ? Math.round((1 - idle / total) * 100) : 0, mem: Math.round((1 - os.freemem() / os.totalmem()) * 100), disk,
    rss: Math.round(process.memoryUsage().rss / 1048576), uptime: Math.round((Date.now() - BOOT) / 1000), platform: `${os.platform()} ${os.arch()}`,
    node: process.version, sessions: engine.running().length, llm: llm.health(),
  };
}
setInterval(() => store.broadcast({ kind: 'root', key: 'host', value: hostStats() }), 5000);
store.subscribe((msg) => { const line = `data: ${JSON.stringify(msg)}\n\n`; for (const res of clients) res.write(line); });
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

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

on('GET', '/api/state', () => ({ ...store.snapshot(), running: engine.running(), live: llm.isLive(), provider: llm.provider(), models: llm.MODELS, groqModels: llm.GROQ_MODELS, claudeModels: llm.CLAUDE_MODELS, capabilities: CAPABILITIES, host: hostStats() }));

on('POST', '/api/goals', (b) => engine.submitGoal({ title: need(b.title, 'Judul goal wajib'), description: b.description || '', userId: b.userId || db().settings.currentUserId, priority: b.priority || 'high' }));

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
  engine.onHumanMessage(m);
  return m;
});
on('POST', '/api/dm', (b) => ({ id: engine.ensureDM(b.userId || db().settings.currentUserId, need(b.with, 'with wajib')) }));
on('POST', '/api/channels', (b) => store.upsert('channels', { id: slug(need(b.name, 'Nama wajib')), name: slug(b.name), kind: 'channel', divisionId: b.divisionId || null, topic: b.topic || '' }));

on('POST', '/api/notes', (b) => brain.writeNote({ title: need(b.title, 'Judul wajib'), content: b.content || `# ${b.title}\n`, folder: b.folder || 'Notes', tags: b.tags || [], authorId: b.userId || db().settings.currentUserId }));
on('PUT', '/api/notes/:id', (b, p) => {
  const n = db().notes.find((x) => x.id === p.id) || (() => { throw bad('Catatan tidak ada', 404); })();
  Object.assign(n, pick(b, ['title', 'content', 'folder', 'tags', 'pinned']), { updatedAt: Date.now(), lastEditorId: b.userId || db().settings.currentUserId });
  return store.upsert('notes', n);
});
on('DELETE', '/api/notes/:id', (b, p) => ({ ok: store.remove('notes', p.id) }));

const EMP_FIELDS = ['name', 'type', 'divisionId', 'title', 'persona', 'skills', 'isLead', 'reportsTo', 'avatar', 'autonomy', 'model', 'status',
  'about', 'taskAndFunction', 'instructions', 'escalation', 'outputFormat', 'effort', 'skillRefs', 'tools', 'knowledgeIds', 'starters', 'reasoning', 'team', 'appearance'];
on('POST', '/api/employees', (b) => org.hire(pick(b, EMP_FIELDS), b.userId || 'owner'));
on('PATCH', '/api/employees/:id', (b, p) => {
  const e = db().employees.find((x) => x.id === p.id) || (() => { throw bad('Karyawan tidak ada', 404); })();
  const ch = pick(b, EMP_FIELDS);
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
  const ids = (b.participantIds || []).filter((id) => db().employees.some((e) => e.id === id));
  const chairId = b.chairId || ids[0];
  // run in background; progress streams over SSE (meetings collection + meeting channel)
  collab.runMeeting({ topic: need(b.topic, 'Topik wajib'), agenda: b.agenda || '', participantIds: ids, chairId, rounds: Number(b.rounds) || 2 }).catch((err) => console.warn('[meeting]', err.message));
  return { ok: true };
});
on('POST', '/api/mcp/test', async (b) => {
  const server = { id: 'test', name: b.name || 'test', url: need(b.url, 'URL wajib'), headers: b.headers || {} };
  collab.resetMcp();
  const tools = await collab.mcpListTools(server, true);
  collab.resetMcp();
  return { ok: true, tools: tools.map((t) => ({ name: t.name, description: (t.description || '').slice(0, 160) })) };
});
on('GET', '/api/training/:id', (b, p) => {
  const file = collab.trainingFile(p.id);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { employeeId: p.id, examples: lines.length, jsonl: lines.join('\n') };
});
on('GET', '/api/capabilities', () => CAPABILITIES.map((c) => ({ ...c, users: db().employees.filter((e) => (e.tools || []).includes(c.id)).length, skills: db().skills.filter((s) => skillTools(s).includes(c.id)).map((s) => s.id) })));
on('GET', '/api/brain/audit', () => lib.audit(40));
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
  return store.upsert('skills', { id, category: 'Strategy', description: '', promptSnippet: '', usageGuide: '', example: '', tags: [], divisions: [], ...pick(b, SKILL_FIELDS), builtIn: false, createdAt: Date.now() });
});
on('PATCH', '/api/skills/:id', (b, p) => store.patch('skills', p.id, pick(b, SKILL_FIELDS)));
on('DELETE', '/api/skills/:id', (b, p) => {
  for (const e of db().employees.filter((e) => e.skillRefs?.some((r) => r.id === p.id))) { e.skillRefs = e.skillRefs.filter((r) => r.id !== p.id); store.upsert('employees', e); }
  return { ok: store.remove('skills', p.id) };
});

on('POST', '/api/divisions', (b) => org.createDivision(b));
on('PATCH', '/api/divisions/:id', (b, p) => store.patch('divisions', p.id, pick(b, ['name', 'short', 'color', 'icon', 'mission', 'leadId', 'delegation'])));

on('POST', '/api/routines', (b) => store.upsert('routines', { id: store.uid('r'), employeeId: need(b.employeeId, 'employeeId wajib'), title: need(b.title, 'Judul wajib'), description: b.description || '', everyMinutes: Math.max(1, Number(b.everyMinutes) || 60), enabled: b.enabled !== false, lastRunAt: Date.now() }));
on('PATCH', '/api/routines/:id', (b, p) => store.patch('routines', p.id, pick(b, ['title', 'description', 'everyMinutes', 'enabled', 'employeeId'])));
on('DELETE', '/api/routines/:id', (b, p) => ({ ok: store.remove('routines', p.id) }));
on('POST', '/api/routines/:id/run', (b, p) => { const r = db().routines.find((x) => x.id === p.id); return engine.createTask({ title: r.title, description: r.description, assigneeId: r.employeeId, createdBy: 'system', kind: 'routine', routineId: r.id, priority: 'medium' }); });

on('PATCH', '/api/settings', (b) => {
  const s = db().settings;
  const ch = pick(b, ['mcpServers', 'learning', 'collectTraining', 'model', 'workerModel', 'groqModel', 'groqWorkerModel', 'provider', 'effort', 'autonomy', 'tickMs', 'maxConcurrent', 'dailyBudgetUSD', 'mode', 'currentUserId', 'autoActivate', 'autoOrganize']);
  if (typeof b.apiKey === 'string' && !b.apiKey.startsWith('••••')) ch.apiKey = b.apiKey.trim();
  if (typeof b.groqApiKey === 'string' && !b.groqApiKey.startsWith('••••')) ch.groqApiKey = b.groqApiKey.trim();
  for (const k of ['tickMs', 'maxConcurrent', 'dailyBudgetUSD']) if (k in ch) ch[k] = Number(ch[k]);
  if (ch.mcpServers) { ch.mcpServers = ch.mcpServers.filter((m) => /^https?:\/\//.test(m.url || '')).map((m, i) => ({ id: slug(m.name || m.id || `mcp${i}`).replace(/-/g, '').slice(0, 16) || `mcp${i}`, name: String(m.name || 'MCP').slice(0, 40), url: m.url, headers: m.headers && typeof m.headers === 'object' ? m.headers : {}, enabled: m.enabled !== false })); collab.resetMcp(); }
  Object.assign(s, ch);
  store.setRoot('settings', s);
  store.broadcast({ kind: 'root', key: 'live', value: llm.isLive() });
  store.broadcast({ kind: 'root', key: 'provider', value: llm.provider() });
  return store.publicSettings();
});
on('PATCH', '/api/company', (b) => { const c = Object.assign(db().company, pick(b, ['name', 'tagline', 'language'])); store.setRoot('company', c); return c; });
on('POST', '/api/test-key', async () => {
  if (!llm.isLive()) throw bad('Belum ada API key / mode simulasi aktif');
  const res = await llm.call({ system: 'Balas satu kata.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 2000 });
  return { ok: true, provider: llm.provider(), model: res.usedModel, reply: llm.textOf(res), usage: res.usage };
});
on('GET', '/api/export', () => ({ ...db(), settings: { ...db().settings, apiKey: '' } }));
on('POST', '/api/import', (b) => {
  if (!Array.isArray(b.employees) || !Array.isArray(b.notes)) throw bad('Format file tidak valid');
  const key = db().settings.apiKey;
  const fresh = store.load({ reset: true });
  Object.assign(fresh, b, { settings: { ...fresh.settings, ...b.settings, apiKey: key } });
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
  if (url.pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    try { return json(res, 200, await r.fn(await body(req), m.groups || {}, url)); }
    catch (err) {
      const code = err.code && Number.isInteger(err.code) ? err.code : (err.status || 500);
      if (code >= 500) console.error(err);
      return json(res, code, { error: err.message || String(err) });
    }
  }
  json(res, 404, { error: 'Endpoint tidak ada' });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🏢 Ray Agent Office berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Mesin AI: ${{ groq: 'LIVE · Groq', claude: 'LIVE · Claude', sim: 'SIMULASI (isi GROQ_API_KEY atau ANTHROPIC_API_KEY di .env / Pengaturan)' }[llm.provider()]}`);
  if (HOST === '127.0.0.1') console.log('  Akses dari HP di jaringan yang sama: jalankan dengan HOST=0.0.0.0\n');
});
process.on('SIGINT', () => { store.saveNow(); process.exit(0); });
