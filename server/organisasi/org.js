// Organisation changes shared by the API and by agents: hiring, creating divisions, agent-generated recruits.
import * as store from '../penyimpanan/store.js';
import * as engine from '../engine.js';
import * as studio from './studio.js';
import { ensureEmployeeConfig, autoActivate } from '../otak/catalog.js';
import { personalAssistant } from './roster.js';
import { slug } from './seed.js';
import { normalizeOrg, API_ROLES } from './org-rules.js';

/** batas yang tidak boleh bertabrakan dengan data yang ada (seed: 22 divisi, ~130 agen; data Owner ~170 agen) */
export const MAX_AI_DEFAULT = 400;
export const MAX_DIVISIONS = 40;

const db = () => store.get();
const PALETTE = ['#ff8fab', '#7bdff2', '#b2f7ef', '#f7d6e0', '#cdb4db', '#ffc8dd', '#a0c4ff', '#caffbf', '#fdffb6', '#ffd6a5'];

export function hire(b, byId = 'owner') {
  const d = db().divisions.find((x) => x.id === b.divisionId);
  if (!d) throw Object.assign(new Error('Divisi tidak valid'), { code: 400 });
  if (!b.name) throw Object.assign(new Error('Nama wajib'), { code: 400 });
  const ai = db().employees.filter((e) => e.type === 'ai').length;
  if (b.type !== 'human' && ai >= (db().settings.maxEmployees || MAX_AI_DEFAULT)) throw new Error(`Batas ${db().settings.maxEmployees || MAX_AI_DEFAULT} karyawan AI tercapai`);
  if (b.role !== undefined && !API_ROLES.includes(b.role)) throw Object.assign(new Error('Peran tidak valid (manager, staff, atau extra)'), { code: 400 });
  const wantsLead = b.type !== 'human' && (b.isLead === true || b.role === 'manager');
  if (b.role === 'manager' && b.type === 'human') throw Object.assign(new Error('Manusia tidak bisa menjadi manajer divisi'), { code: 400 });
  let id = slug(b.name).replace(/-/g, '').slice(0, 20) || 'emp';
  while (db().employees.some((e) => e.id === id)) id += Math.floor(Math.random() * 9);
  const e = {
    id, type: 'ai', title: 'Staff', persona: '', skills: [], isLead: false, legacy: false, staffId: null, workflowId: null, characterId: id, avatar: 'bot', autonomy: 'auto', model: '',
    ...b, reportsTo: b.reportsTo || d.leadId || 'aria', status: 'idle', statusText: b.type === 'human' ? 'Online' : 'Siap bekerja', currentTaskId: null,
    stats: { tasksDone: 0, tokensIn: 0, tokensOut: 0, cost: 0, lastActiveAt: null }, createdAt: Date.now(), hiredBy: byId,
  };
  e.isLead = false; delete e.role;   // peran ditetapkan sistem di bawah (role dan isLead dari satu aturan)
  if (typeof e.skills === 'string') e.skills = e.skills.split(',').map((s) => s.trim()).filter(Boolean);
  ensureEmployeeConfig(e, db().skills, db().notes);
  if (db().settings.autoActivate !== false) autoActivate(e, db().skills);
  // satu manajer per divisi: yang baru menjadi manajer menurunkan manajer lama; divisi tanpa manajer memberi jabatan itu ke AI pertama
  if (e.type === 'ai' && (wantsLead || !d.leadId)) e.isLead = true;
  else if (b.role === 'extra') e.role = 'extra';
  store.upsert('employees', e);
  settleOrg(e.id);
  if (e.type === 'human') {
    const names = ['Sora', 'Lumi', 'Kai', 'Nova', 'Rin', 'Aya', 'Zen', 'Mika'];
    const pa = ensureEmployeeConfig(personalAssistant(e, Date.now(), names.find((n) => !db().employees.some((x) => x.name === n)) || `Asisten ${e.name}`), db().skills, db().notes);
    store.upsert('employees', pa);
    engine.event('hired', e.id, `${pa.name} menjadi asisten pribadi ${e.name}`, { targetId: pa.id });
  }
  const by = db().employees.find((x) => x.id === byId);
  engine.event('hired', byId, `${by?.name || 'Owner'} merekrut ${e.name} (${e.type === 'ai' ? 'AI' : 'manusia'}) sebagai ${e.title} di ${d.name}`, { targetId: e.id });
  return e;
}

/** Tegakkan aturan satu manajer per divisi dan seragamkan medan peran; `preferId` menang di divisinya. Menyiarkan semua karyawan/divisi yang berubah. */
export function settleOrg(preferId = null) {
  const before = new Map(db().employees.map((e) => [e.id, JSON.stringify([e.isLead, e.role, e.reportsTo, e.staffId, e.characterId])]));
  const beforeLead = new Map(db().divisions.map((d) => [d.id, d.leadId]));
  const changes = normalizeOrg(db(), { prefer: preferId });
  for (const e of db().employees) if (before.get(e.id) !== JSON.stringify([e.isLead, e.role, e.reportsTo, e.staffId, e.characterId])) store.upsert('employees', e);
  for (const d of db().divisions) if (beforeLead.get(d.id) !== d.leadId) store.upsert('divisions', d);
  return changes;
}

/** sebelum PATCH karyawan: tolak yang melanggar aturan peran (melempar 400 sebelum ada yang berubah) dan terjemahkan `role` ke `isLead` */
export function checkRoleChange(e, ch) {
  const bad = (m) => { throw Object.assign(new Error(m), { code: 400 }); };
  if ('isLead' in ch) ch.isLead = ch.isLead === true || ch.isLead === 'true';
  if ('role' in ch) {
    if (!API_ROLES.includes(ch.role)) bad('Peran tidak valid (manager, staff, atau extra)');
    if (e.type === 'human' || e.isPA) bad('Pemilik dan asisten pribadi bukan manajer divisi');
    ch.isLead = ch.role === 'manager';
  }
  const becomes = 'type' in ch ? ch.type : e.type;
  if (ch.isLead === true && (becomes === 'human' || e.isPA)) bad('Pemilik dan asisten pribadi bukan manajer divisi');
  if (ch.isLead === true && e.isMaster && !db().divisions.some((d) => d.leadId === e.id)) bad('Master orkestrator hanya memimpin divisi Executive');
}

/** sesudah PATCH karyawan: tegakkan aturan satu manajer (isLead:true menurunkan manajer lama; isLead:false melepas jabatan) */
export function settleLead(e, ch) {
  if (ch.isLead === false || ch.role === 'staff' || ch.role === 'extra') {
    for (const d of db().divisions) if (d.leadId === e.id) d.leadId = null;   // melepas jabatan: divisi sementara tanpa manajer
    if (e.role === 'manager' || e.role === 'extra' || e.role === 'staff') e.role = ch.role === 'extra' ? 'extra' : 'staff';
  }
  settleOrg(ch.isLead === true ? e.id : null);
}

export function createDivision(b) {
  const id = slug(b.name).replace(/-/g, '').slice(0, 12);
  if (!id) throw Object.assign(new Error('Nama divisi wajib'), { code: 400 });
  if (db().divisions.some((d) => d.id === id)) throw Object.assign(new Error('Divisi sudah ada'), { code: 400 });
  if (db().divisions.length >= MAX_DIVISIONS) throw new Error(`Batas ${MAX_DIVISIONS} divisi tercapai`);
  const d = store.upsert('divisions', { id, name: b.name, short: (b.short || b.name).replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase(), color: b.color || PALETTE[db().divisions.length % PALETTE.length], icon: b.icon || '🏢', mission: b.mission || '', delegation: 'best_fit', leadId: null });
  store.upsert('channels', { id: `div-${id}`, name: id, kind: 'channel', divisionId: id, topic: d.mission });
  return d;
}

/** An agent designs and hires new colleagues from short role briefs (one generator call each). */
export async function recruitFromBriefs(byId, divisionId, briefs) {
  const out = [];
  for (const brief of briefs.slice(0, 6)) {
    const g = await studio.generate({ kind: 'agent', brief, divisionId });
    for (const ns of g.newSkills || []) {
      try {
        let sid = slug(ns.name); if (db().skills.some((s) => s.id === sid)) { g.employee.skillRefs.push({ id: sid, proficiency: 7 }); continue; }
        store.upsert('skills', { id: sid, ...ns, example: '', tags: [], divisions: [divisionId], builtIn: false, createdAt: Date.now(), createdBy: byId });
        g.employee.skillRefs.push({ id: sid, proficiency: 7 });
      } catch { /* skill creation is best-effort */ }
    }
    out.push(hire({ ...g.employee, divisionId, isLead: g.employee.isLead && !db().divisions.find((d) => d.id === divisionId)?.leadId }, byId));
  }
  return out;
}
