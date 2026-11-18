// AI governance: keeps autonomous work focused, deduplicated, within budget, and routed to the cheapest model that can do it.
import * as store from './store.js';
import * as approvals from './approvals.js';

const db = () => store.get();
const S = () => db().settings;
const OPEN = new Set(['todo', 'in_progress', 'waiting', 'review', 'blocked']);
const emp = (id) => db().employees.find((e) => e.id === id);

export class GovernorError extends Error {}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
function similar(a, b) {
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

// ───────────────────────── kuota per ruang kerja (P2) ─────────────────────────
// Angka awal sengaja konservatif; Owner mengaturnya lewat settings.quota (tasksPerDay, n8nRunsPerDay). Ukurannya JUMLAH, bukan uang.
export const QUOTA_DEFAULTS = { tasksPerDay: 300, n8nRunsPerDay: 100 };
export function quotaLimits() {
  const q = S().quota && typeof S().quota === 'object' ? S().quota : {};
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v !== null ? Math.floor(Number(v)) : d);
  return { tasksPerDay: num(q.tasksPerDay, QUOTA_DEFAULTS.tasksPerDay), n8nRunsPerDay: num(q.n8nRunsPerDay, QUOTA_DEFAULTS.n8nRunsPerDay) };
}
const dayKey = () => new Date().toISOString().slice(0, 10);
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Pemakaian eksekusi n8n hari ini untuk ruang kerja aktif; dicatat di db().usage.exec dan direset tiap hari. */
export function execUsage() {
  const u = (db().usage ||= {});
  if (!u.exec || u.exec.day !== dayKey()) u.exec = { day: dayKey(), runs: 0, byKind: {} };
  return u.exec;
}
export const tasksToday = () => db().tasks.filter((t) => (t.createdAt || 0) >= startOfDay() && t.kind !== 'routine').length;
/** Sisa jatah hari ini (angka dan persen) untuk tugas dan eksekusi; dipakai Pemandu untuk kata "jatah". */
export function quotaStatus() {
  const L = quotaLimits(), x = execUsage(), tt = tasksToday();
  const left = (limit, used) => (limit ? Math.max(0, limit - used) : 0);
  const pct = (limit, used) => (limit ? Math.max(0, Math.min(100, Math.round((left(limit, used) / limit) * 100))) : 100);
  return { tasks: { limit: L.tasksPerDay, used: tt, left: left(L.tasksPerDay, tt), pct: pct(L.tasksPerDay, tt) }, n8nRuns: { limit: L.n8nRunsPerDay, used: x.runs, left: left(L.n8nRunsPerDay, x.runs), pct: pct(L.n8nRunsPerDay, x.runs) } };
}
/** Boleh menjalankan `n` eksekusi n8n lagi hari ini? Mengembalikan null bila boleh, atau { limit, spent } bila melewati batas (bentuk sama seperti overBudget). */
export function execOverBudget(n = 1) {
  const limit = quotaLimits().n8nRunsPerDay, spent = execUsage().runs;
  return limit && spent + n > limit ? { limit, spent, unit: 'eksekusi' } : null;   // 0 = tanpa batas
}
/** Gerbang eksekusi n8n (staf, otomasi, uji): lempar GovernorError bila jatah harian habis. Tidak mencatat; catat dengan recordExec setelah jalan. */
export function checkExec(n = 1) {
  const over = execOverBudget(n);
  if (over) throw new GovernorError(`Jatah pekerjaan otomatis hari ini sudah habis (${over.spent} dari ${over.limit}). Coba lagi besok atau minta Owner menaikkan jatah.`);
}
export function recordExec(n = 1, kind = 'staf') {
  const x = execUsage();
  x.runs += n; x.byKind[kind] = (x.byKind[kind] || 0) + n;
  return x.runs;
}
/** Satu panggilan: periksa lalu catat. Dipakai di titik panggil eksekusi supaya tak ada eksekusi yang lolos tanpa tercatat. */
export function chargeExec(n = 1, kind = 'staf') { checkExec(n); return recordExec(n, kind); }

const recentByWorkspace = new Map(); // timestamps of tasks created by AI without a parent (free-floating initiatives)

/** SATU gerbang pembuatan tugas: engine.createTask memanggilnya untuk semua jalur (/api/tasks, broadcast, Pemandu/goal, rapat, delegasi, chat).
 *  Semua pembuat (manusia, penjadwal, AI) terkena kuota tugas harian per ruang kerja; AI juga dibatasi kapasitas, duplikat, dan inisiatif per jam. */
export function checkCreate({ title, createdBy, parentId, kind, assigneeId }) {
  const t = String(title ?? '').trim();
  if (!t || t === 'undefined' || t === 'null' || t.length < 3) throw new GovernorError('Judul tugas wajib diisi dan jelas.');
  if (kind !== 'routine') {
    const limit = quotaLimits().tasksPerDay;
    if (limit && tasksToday() >= limit) throw new GovernorError(`Jatah tugas hari ini sudah habis (${limit} tugas). Coba lagi besok atau minta Owner menaikkan jatah.`);
  }
  const byAI = emp(createdBy)?.type === 'ai';
  if (!byAI) return;
  const g = S();
  const open = db().tasks.filter((x) => OPEN.has(x.status));
  if (open.length >= (g.maxActiveTasks || 80)) throw new GovernorError(`Kapasitas kerja penuh (${open.length} tugas aktif). Selesaikan pekerjaan yang ada dulu.`);
  // a subtask legitimately echoes its parent's title ("[MKT] <goal>"): the task's own ancestors are never "duplicates" of it
  const ancestors = new Set(); for (let p = parentId, n = 0; p && n++ < 12;) { ancestors.add(p); p = db().tasks.find((x) => x.id === p)?.parentId; }
  // a fan-out ("[DATA] X", "[MKT] X", "X — riset") gives different people similar titles on purpose: under a parent only the SAME assignee counts as a duplicate
  const dup = open.find((x) => !ancestors.has(x.id) && similar(x.title, t) >= 0.8 && (parentId ? x.assigneeId === assigneeId && (x.parentId === parentId || !x.parentId) : !x.parentId));
  if (dup) throw new GovernorError(`Tugas serupa sudah ada: ${dup.id} "${dup.title}" (${emp(dup.assigneeId)?.name}). Gunakan itu, jangan duplikasi.`);
  if (!parentId && kind !== 'routine') {
    const recent = recentByWorkspace.get(store.current()) || []; recentByWorkspace.set(store.current(), recent);
    const hour = Date.now() - 3600e3;
    while (recent.length && recent[0] < hour) recent.shift();
    if (recent.length >= (g.maxAgentInitiativesPerHour ?? 8)) throw new GovernorError('Batas inisiatif baru per jam tercapai. Fokus ke tugas yang sudah ada.');
    recent.push(Date.now());
  }
}

/** Root of a task tree (the goal or standalone task that owns the budget). */
export function rootOf(t) {
  let p = t, guard = 0;
  while (p?.parentId && guard++ < 12) p = db().tasks.find((x) => x.id === p.parentId) || null;
  return p || t;
}
export function addCost(taskId, cost) {
  const t = db().tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.cost = (t.cost || 0) + cost;
  const r = rootOf(t);
  if (r && r !== t) r.treeCost = (r.treeCost || r.cost || 0) + cost;
  else t.treeCost = (t.treeCost || 0) + cost;
}
export function overBudget(t) {
  const r = rootOf(t);
  const limit = r.kind === 'goal' ? (S().goalBudgetUSD ?? 1.5) : (S().taskBudgetUSD ?? 0.4);
  return (r.treeCost || 0) > limit ? { limit, spent: r.treeCost } : null;
}

/** Cheapest adequate model per purpose: orchestration/synthesis → lead, normal work → worker, routine/chat/reflection → small. */
export function modelTier(e, t, purpose = 'task') {
  if (purpose === 'chat' || purpose === 'meeting' || purpose === 'reflect' || purpose === 'consult') return 'small';
  if (t?.kind === 'routine') return 'small';
  if (e?.isPA || e?.isMaster || t?.synth || t?.kind === 'goal') return 'lead';
  if (e?.isLead) return 'lead';
  return 'worker';
}

// small TTL caches for repeated research (saves tokens when several agents research the same thing)
const caches = { web: new Map(), url: new Map() };
export function cached(kind, key, ttlMs, fn) {
  const k = store.current() + ':' + String(key).toLowerCase().replace(/\s+/g, ' ').trim();
  const c = caches[kind].get(k);
  if (c && Date.now() - c.at < ttlMs) return Promise.resolve(c.value + '\n\n(hasil cache riset sebelumnya)');
  return fn().then((value) => { if (!/^GAGAL|^Gagal/.test(value)) caches[kind].set(k, { at: Date.now(), value }); if (caches[kind].size > 300) caches[kind].delete(caches[kind].keys().next().value); return value; });
}

/** Shrink old tool results in a running conversation so long tasks don't resend huge context every turn. */
export function compact(messages, keepLast = 4, limit = 700) {
  const cut = messages.length - keepLast;
  for (let i = 1; i < cut; i++) {
    const m = messages[i];
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const b of m.content) if (b.type === 'tool_result' && typeof b.content === 'string' && b.content.length > limit) b.content = b.content.slice(0, limit) + ' …[diringkas]';
  }
}

/** Only top-level work goes to humans; subtasks are reviewed by the orchestrator above them. Aturannya hidup di approvals.js (satu modul persetujuan). */
export const needsHumanApproval = (t, requested) => approvals.needsHuman(t, requested);
