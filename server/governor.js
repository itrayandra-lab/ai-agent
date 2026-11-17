// AI governance: keeps autonomous work focused, deduplicated, within budget, and routed to the cheapest model that can do it.
import * as store from './store.js';

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

const recent = []; // timestamps of tasks created by AI without a parent (free-floating initiatives)

/** Validate a task before it exists. Humans and the scheduler are trusted; AI-created work is rate-limited and deduplicated. */
export function checkCreate({ title, createdBy, parentId, kind, assigneeId }) {
  const t = String(title ?? '').trim();
  if (!t || t === 'undefined' || t === 'null' || t.length < 3) throw new GovernorError('Judul tugas wajib diisi dan jelas.');
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
  const k = String(key).toLowerCase().replace(/\s+/g, ' ').trim();
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

/** Only top-level work goes to humans; subtasks are reviewed by the orchestrator above them. */
const HUMAN_POLICY = /\b(publikasi(kan)?|publish|tayangkan|kirim ke (klien|pelanggan|publik)|tanda ?tangan|kontrak final|transfer dana|pembayaran|bayar|offer letter|phk|pecat|rilis ke produksi)\b/i;
export function needsHumanApproval(t, requested) {
  if (t.parentId) return false;
  if (t.kind === 'goal') return true;
  return !!requested || HUMAN_POLICY.test(`${t.title} ${t.description}`);
}
