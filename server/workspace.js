// A new personal workspace: ALL 22 divisions with exactly one manager each (light on memory and tokens), only the true system SOP in the Brain,
// no demo data, no scheduled routines (nothing spends tokens until the owner asks), and a daily AI budget set by the platform owner.
// Staff (the leaves) are added only when the `staffModel` flag is on, and then only those represented in the staff catalog; while it is off
// the workspace holds just the owner, the personal assistant and the managers (plus the master as the Executive manager).
import { buildSeed } from './seed.js';
import { systemNotes } from './sop.js';
import { SCHEMA_VERSION, normalizeOrg, catalogIndex } from './org-rules.js';

export function starterDb({ ownerName = 'Owner', companyName = '', budgetUSD = 0.5, staffModel = false } = {}) {
  const s = buildSeed();
  const divisions = s.divisions;
  const cat = catalogIndex();
  const keep = new Set(['owner', 'pa-owner', ...divisions.map((d) => d.leadId).filter(Boolean)]);
  if (staffModel === true) for (const e of s.employees) if (e.type === 'ai' && !e.isPA && !e.isMaster && cat.byEmployee.has(e.id)) keep.add(e.id);
  const employees = s.employees.filter((e) => keep.has(e.id)).map((e) => ({
    ...e, status: 'idle', statusText: e.type === 'human' ? 'Online' : 'Siap bekerja', currentTaskId: null,
    knowledgeIds: e.type === 'ai' ? ['aturan-kejujuran-agen', 'status-data-perusahaan'] : e.knowledgeIds,
    lessons: [], failureHistory: [], stats: { tasksDone: 0, tokensIn: 0, tokensOut: 0, cost: 0, lastActiveAt: null },
  }));
  const owner = employees.find((e) => e.id === 'owner');
  if (owner) owner.name = ownerName;
  for (const d of divisions) d.teams = (d.teams || []).filter((t) => employees.some((e) => e.team === t));
  for (const e of employees) if (e.type === 'ai' && e.team && !divisions.some((d) => (d.teams || []).includes(e.team))) e.team = null;
  const out = {
    ...s, version: SCHEMA_VERSION, kbResetAt: Date.now(),
    company: { ...s.company, name: companyName || `Ruang kerja ${ownerName}` },
    divisions, employees, channels: s.channels,
    notes: systemNotes(), routines: [], tasks: [], messages: [], approvals: [], events: [], meetings: [],
    usage: { day: new Date().toISOString().slice(0, 10), costToday: 0, costTotal: 0, tokensIn: 0, tokensOut: 0, calls: 0, byModel: {} },
    settings: { ...s.settings, apiKey: '', groqApiKey: '', dailyBudgetUSD: budgetUSD, currentUserId: 'owner', autonomy: true, staffModel: staffModel === true },
  };
  normalizeOrg(out);
  return out;
}
