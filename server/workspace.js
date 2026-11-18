// A new personal workspace: a small core team (light on memory and tokens), only the true system SOP in the Brain, no demo data,
// no scheduled routines (nothing spends tokens until the owner asks), and a daily AI budget set by the platform owner.
import { buildSeed } from './seed.js';
import { systemNotes } from './sop.js';

const CORE = ['exec', 'mkt', 'sales', 'fin', 'ops', 'data'];   // strategy/orchestration, marketing, sales, finance, operations, research

export function starterDb({ ownerName = 'Owner', companyName = '', budgetUSD = 0.5 } = {}) {
  const s = buildSeed();
  const divisions = s.divisions.filter((d) => CORE.includes(d.id));
  const keep = new Set(['owner', 'pa-owner', ...divisions.map((d) => d.leadId)]);
  const employees = s.employees.filter((e) => keep.has(e.id)).map((e) => ({
    ...e, status: 'idle', statusText: e.type === 'human' ? 'Online' : 'Siap bekerja', currentTaskId: null,
    knowledgeIds: e.type === 'ai' ? ['aturan-kejujuran-agen', 'status-data-perusahaan'] : e.knowledgeIds,
    lessons: [], failureHistory: [], stats: { tasksDone: 0, tokensIn: 0, tokensOut: 0, cost: 0, lastActiveAt: null },
  }));
  const owner = employees.find((e) => e.id === 'owner');
  if (owner) owner.name = ownerName;
  for (const d of divisions) d.teams = (d.teams || []).filter((t) => employees.some((e) => e.team === t));
  for (const e of employees) if (e.type === 'ai' && e.team && !divisions.some((d) => (d.teams || []).includes(e.team))) e.team = null;
  const channels = s.channels.filter((c) => c.kind !== 'channel' || ['general', 'standup'].includes(c.id) || CORE.includes(String(c.divisionId || c.id.replace(/^div-/, ''))));
  return {
    ...s, version: 10, kbResetAt: Date.now(),
    company: { ...s.company, name: companyName || `Ruang kerja ${ownerName}` },
    divisions, employees, channels,
    notes: systemNotes(), routines: [], tasks: [], messages: [], approvals: [], events: [], meetings: [],
    usage: { day: new Date().toISOString().slice(0, 10), costToday: 0, costTotal: 0, tokensIn: 0, tokensOut: 0, calls: 0, byModel: {} },
    settings: { ...s.settings, apiKey: '', groqApiKey: '', dailyBudgetUSD: budgetUSD, currentUserId: 'owner', autonomy: true },
  };
}
