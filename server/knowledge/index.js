// Knowledge library loader: merges every area file into Brain notes and attaches the most relevant ones to agents.
import global from './global.js';
import marketing from './marketing.js';
import commerce from './commerce.js';
import beauty from './beauty.js';
import tech from './tech.js';
import business from './business.js';

const AREAS = [['Global', global], ['Marketing', marketing], ['Commerce', commerce], ['Beauty', beauty], ['Tech', tech], ['Business', business]];
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 80);

/** Brain notes for the whole library, filed under "Knowledge Library/<Area>". */
export function knowledgeNotes(t = Date.now()) {
  const out = [];
  for (const [area, list] of AREAS) for (const k of list) {
    out.push({ id: `kb-${slug(k.title)}`, title: k.title, folder: `Knowledge Library/${area}`, content: k.content, tags: ['knowledge', area.toLowerCase(), ...(k.tags || [])], authorId: 'widya', pinned: false, createdAt: t, updatedAt: t, audience: k.audience });
  }
  return out;
}

const matches = (k, e) => {
  if (!k.audience || k.audience.all) return k.audience?.all ? 'global' : null;
  if (k.audience.divisions?.includes(e.divisionId)) return 'division';
  const hay = `${e.title} ${(e.skills || []).join(' ')} ${e.team || ''}`.toLowerCase();
  return (k.audience.roles || []).some((r) => hay.includes(r)) ? 'role' : null;
};

/** Gives each AI agent up to two knowledge notes (role matches first) in knowledgeIds. The rest stay searchable via search_brain, which keeps prompts small. */
export function attachKnowledge(employees, notes) {
  const byId = new Map(notes.filter((n) => n.audience).map((n) => [n.id, n]));
  const all = [...byId.values()];
  for (const e of employees) {
    if (e.type !== 'ai') continue;
    const ranked = all.map((n) => ({ n, kind: matches(n.audience ? n : { audience: n.audience }, e) })).filter((x) => x.kind);
    const order = { role: 0, division: 1, global: 2 };
    ranked.sort((a, b) => order[a.kind] - order[b.kind]);
    const pick = ranked.slice(0, 2).map((x) => x.n.id);
    e.knowledgeIds = [...new Set([...(e.knowledgeIds || []), ...pick])];
  }
}
