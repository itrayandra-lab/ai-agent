// Organisation changes shared by the API and by agents: hiring, creating divisions, agent-generated recruits.
import * as store from './store.js';
import * as engine from './engine.js';
import * as studio from './studio.js';
import { ensureEmployeeConfig, autoActivate } from './catalog.js';
import { personalAssistant } from './roster.js';
import { slug } from './seed.js';

const db = () => store.get();
const PALETTE = ['#ff8fab', '#7bdff2', '#b2f7ef', '#f7d6e0', '#cdb4db', '#ffc8dd', '#a0c4ff', '#caffbf', '#fdffb6', '#ffd6a5'];

export function hire(b, byId = 'owner') {
  const d = db().divisions.find((x) => x.id === b.divisionId);
  if (!d) throw Object.assign(new Error('Divisi tidak valid'), { code: 400 });
  if (!b.name) throw Object.assign(new Error('Nama wajib'), { code: 400 });
  const ai = db().employees.filter((e) => e.type === 'ai').length;
  if (b.type !== 'human' && ai >= (db().settings.maxEmployees || 160)) throw new Error(`Batas ${db().settings.maxEmployees || 160} karyawan AI tercapai`);
  let id = slug(b.name).replace(/-/g, '').slice(0, 20) || 'emp';
  while (db().employees.some((e) => e.id === id)) id += Math.floor(Math.random() * 9);
  const e = {
    id, type: 'ai', title: 'Staff', persona: '', skills: [], isLead: false, avatar: 'bot', autonomy: 'auto', model: '',
    ...b, reportsTo: b.reportsTo || d.leadId || 'aria', status: 'idle', statusText: b.type === 'human' ? 'Online' : 'Siap bekerja', currentTaskId: null,
    stats: { tasksDone: 0, tokensIn: 0, tokensOut: 0, cost: 0, lastActiveAt: null }, createdAt: Date.now(), hiredBy: byId,
  };
  if (typeof e.skills === 'string') e.skills = e.skills.split(',').map((s) => s.trim()).filter(Boolean);
  ensureEmployeeConfig(e, db().skills, db().notes);
  if (db().settings.autoActivate !== false) autoActivate(e, db().skills);
  store.upsert('employees', e);
  if (e.isLead || !d.leadId) { d.leadId = e.id; e.isLead = true; store.upsert('divisions', d); store.upsert('employees', e); }
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

export function createDivision(b) {
  const id = slug(b.name).replace(/-/g, '').slice(0, 12);
  if (!id) throw Object.assign(new Error('Nama divisi wajib'), { code: 400 });
  if (db().divisions.some((d) => d.id === id)) throw Object.assign(new Error('Divisi sudah ada'), { code: 400 });
  if (db().divisions.length >= 28) throw new Error('Batas 28 divisi tercapai');
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
