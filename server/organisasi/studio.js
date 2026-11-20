// Agent Studio: generate a complete AI employee (or a skill) from one brief.
// Live mode asks Claude for schema-validated JSON; simulation mode builds the same shape from heuristics.
import * as store from '../penyimpanan/store.js';
import * as llm from '../otak/llm.js';
import { CAP_IDS, SKILL_CATEGORIES, suggestSkills } from '../otak/catalog.js';
import { slug } from './seed.js';

const db = () => store.get();
const AVATARS = ['bot', 'cat', 'bear', 'bunny', 'fox'];
const NAMES = ['Nova', 'Kai', 'Lumi', 'Rio', 'Mika', 'Zara', 'Dewa', 'Ayu', 'Rinda', 'Tara', 'Bara', 'Kira', 'Juno', 'Saka', 'Nala', 'Elan'];
const DIV_RE = {
  mkt: /market|konten|content|sosial|social|iklan|ads|campaign|brand|seo|copy/i, sales: /sales|jual|lead|klien|prospek|deal|account/i,
  eng: /engineer|develop|kode|code|app|fitur|qa|test|product|produk|api/i, cs: /customer|support|pelanggan|tiket|helpdesk|onboarding/i,
  fin: /finance|keuangan|akuntan|invoice|budget|pajak|cfo/i, hr: /hr|rekrut|recruit|talent|karyawan|people|training/i,
  ops: /operasi|operation|vendor|logistik|pengadaan|procure|sop|otomasi/i, legal: /legal|hukum|kontrak|compliance|privasi/i,
  data: /data|analis|riset|research|kpi|dashboard|insight/i, exec: /ceo|chief|strategi|direktur|executive/i,
};

const str = (description) => ({ type: 'string', description });
const strict = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

function agentSchema() {
  const notes = db().notes.filter((n) => ['Company', 'SOP', 'Marketing', 'Research', 'Knowledge'].includes(n.folder)).slice(0, 60);
  return {
    notes,
    schema: strict({
      name: str('Nama panggilan unik 3-8 huruf, mudah diingat dan mencerminkan peran (bukan "Bot"/"Helper")'),
      title: str('Jabatan'),
      divisionId: { type: 'string', enum: db().divisions.map((d) => d.id) },
      isLead: { type: 'boolean' },
      about: str('3-5 kalimat: siapa dia, untuk apa, kapan tugas sebaiknya diberikan kepadanya (dipakai untuk routing)'),
      persona: str('1-2 kalimat sifat & gaya kerja'),
      taskAndFunction: str('6-8 kalimat tanggung jawab konkret'),
      instructions: str('System instruction minimal 450 kata dengan bagian: PERAN, TUJUAN, KONTEKS KERJA, TANGGUNG JAWAB (bernomor, dengan contoh), CARA KERJA (input → analisis → proses → output), ATURAN WAJIB, BATASAN & LARANGAN, GAYA KOMUNIKASI, FORMAT RESPONS, KONDISI ESKALASI'),
      escalation: str('Kapan harus berhenti dan minta persetujuan/eskalasi'),
      keywords: { type: 'array', items: { type: 'string' }, description: '3-6 keahlian singkat' },
      skillIds: { type: 'array', items: { type: 'string', enum: db().skills.map((s) => s.id) } },
      newSkills: { type: 'array', description: '0-3 skill baru bila library belum punya yang cocok', items: strict({ name: str('Nama skill'), category: { type: 'string', enum: SKILL_CATEGORIES }, description: str('1 kalimat'), promptSnippet: str('Metode langkah demi langkah 60-150 kata'), usageGuide: str('Kapan dipakai') }) },
      tools: { type: 'array', items: { type: 'string', enum: CAP_IDS } },
      knowledgeIds: { type: 'array', items: { type: 'string', enum: notes.map((n) => n.id) } },
      avatar: { type: 'string', enum: AVATARS },
      autonomy: { type: 'string', enum: ['auto', 'ask'] },
      effort: { type: 'string', enum: ['low', 'medium', 'high'] },
      starters: { type: 'array', items: { type: 'string' }, description: '3 contoh perintah yang bisa diberikan manusia' },
      reasoning: strict({ division: str('alasan'), skills: str('alasan'), tools: str('alasan'), knowledge: str('alasan'), autonomy: str('alasan') }),
    }),
  };
}

const skillSchema = strict({ name: str('Nama skill'), category: { type: 'string', enum: SKILL_CATEGORIES }, description: str('1 kalimat'), promptSnippet: str('Metode langkah demi langkah 100-200 kata'), usageGuide: str('Kapan dan bagaimana dipakai, 40-100 kata'), example: str('Contoh singkat input → output') });

export async function generate({ kind = 'agent', brief, divisionId }) {
  brief = String(brief || '').trim();
  if (!brief) throw Object.assign(new Error('Brief wajib diisi'), { code: 400 });
  if (llm.isLive() && llm.budgetLeft() > 0) return kind === 'skill' ? liveSkill(brief) : liveAgent(brief, divisionId);
  return kind === 'skill' ? simSkill(brief) : simAgent(brief, divisionId);
}

async function liveAgent(brief, divisionId) {
  const { schema, notes } = agentSchema();
  const company = db().company;
  const divs = db().divisions.map((d) => `- ${d.id}: ${d.name} — ${d.mission}`).join('\n');
  const skills = db().skills.map((s) => `- ${s.id}: ${s.name} (${s.category}) — ${s.description}`).join('\n');
  const kb = notes.map((n) => `- ${n.id}: ${n.title} (${n.folder})`).join('\n');
  const taken = db().employees.map((e) => e.name).join(', ');
  const out = await llm.json({
    system: `Kamu adalah perancang karyawan AI untuk ${company.name}. Rancang karyawan AI yang siap bekerja otonom di sebuah kantor bersama karyawan AI dan manusia lain. Semua isi dalam ${company.language}. Setiap pilihan (divisi, skill, tool, knowledge, otonomi) harus berdasarkan brief, bukan acak, dan jelaskan alasannya di reasoning.`,
    prompt: `BRIEF:\n${brief}\n${divisionId ? `\nDivisi yang diminta: ${divisionId}` : ''}\n\nDIVISI:\n${divs}\n\nLIBRARY SKILL:\n${skills}\n\nTOOL: ${CAP_IDS.join(', ')} (complete_task wajib; request_approval wajib bila menyentuh uang/publikasi/kontrak/HR)\n\nKNOWLEDGE YANG BISA DILAMPIRKAN:\n${kb}\n\nNama yang sudah dipakai (jangan dipakai lagi): ${taken}`,
    schema,
  });
  return normalize(out, divisionId, llm.provider());
}

async function liveSkill(brief) {
  const out = await llm.json({ system: `Kamu merancang modul skill (know-how) untuk karyawan AI ${db().company.name}. Tulis dalam ${db().company.language}, konkret dan bisa langsung diikuti.`, prompt: `Brief skill:\n${brief}`, schema: skillSchema, effort: 'low' });
  return { ...out, source: llm.provider() };
}

// Generated text sometimes opens with filler ("Berikut adalah…", "Tentu!") or echoes field labels; strip it.
const clean = (v) => typeof v !== 'string' ? v : v.replace(/^\s*(tentu|baik|oke|siap)[!,.]?\s*/i, '').replace(/^\s*berikut (adalah|ini)[^:\n]*:\s*/i, '').replace(/^\s*(about|tagline|nama|jabatan)\s*:\s*/i, '').trim();

function normalize(o, divisionId, source) {
  for (const k of Object.keys(o)) o[k] = clean(o[k]);
  const d = db().divisions.find((x) => x.id === (divisionId || o.divisionId)) || db().divisions[1];
  const known = new Set(db().skills.map((s) => s.id));
  return {
    source,
    employee: {
      name: o.name, title: o.title, divisionId: d.id, type: 'ai', isLead: !!o.isLead && !d.leadId, about: o.about, persona: o.persona,
      taskAndFunction: o.taskAndFunction, instructions: o.instructions, escalation: o.escalation, skills: o.keywords || [],
      skillRefs: (o.skillIds || []).filter((id) => known.has(id)).map((id, i) => ({ id, proficiency: i < 2 ? 9 : 7 })),
      tools: [...new Set([...(o.tools || CAP_IDS), 'complete_task'])], knowledgeIds: o.knowledgeIds || [], avatar: o.avatar || 'bot',
      autonomy: o.autonomy || 'auto', effort: o.effort || '', starters: o.starters || [], outputFormat: 'markdown',
      reasoning: o.reasoning || null,
    },
    newSkills: o.newSkills || [],
  };
}

// ───── simulation generator (no API key)
function simAgent(brief, divisionId) {
  const first = brief.split('\n')[0].replace(/^(roles?|peran|jabatan)\s*[:\-]\s*/i, '').trim();
  const title = first.length > 60 ? first.slice(0, 57) + '…' : first.replace(/^(buat|buatkan|saya butuh|butuh)\s+/i, '').replace(/^\w/, (c) => c.toUpperCase());
  const divId = divisionId || Object.entries(DIV_RE).find(([, re]) => re.test(brief))?.[0] || 'ops';
  const d = db().divisions.find((x) => x.id === divId) || db().divisions[0];
  const taken = new Set(db().employees.map((e) => e.name));
  const name = NAMES.find((n) => !taken.has(n)) || `Agen${db().employees.length}`;
  const keywords = [...new Set(brief.toLowerCase().match(/[a-z]{5,}/g) || [])].slice(0, 5);
  const draft = { title, divisionId: d.id, persona: brief, skills: keywords, isLead: false };
  const skillRefs = suggestSkills(draft, db().skills);
  const sopId = db().notes.find((n) => n.folder === 'SOP' && n.authorId === d.leadId)?.id;
  const knowledgeIds = [sopId, slug('Kebijakan Persetujuan'), slug('Profil Perusahaan')].filter((id) => id && db().notes.some((n) => n.id === id));
  const risky = /publikasi|kontrak|bayar|uang|harga|rekrut|hukum/i.test(brief);
  const skillNames = skillRefs.map((r) => db().skills.find((s) => s.id === r.id)?.name).filter(Boolean);
  const instructions = `## PERAN\nKamu adalah ${name}, ${title} di divisi ${d.name}.\n\n## TUJUAN\n${brief}\n\n## KONTEKS KERJA\nKamu bekerja bersama karyawan AI dan manusia di ${db().company.name}. Ikuti SOP divisi ${d.name} dan Kebijakan Persetujuan.\n\n## TANGGUNG JAWAB\n1. Memahami brief tugas dan menanyakan/menandai informasi yang kurang.\n2. Mencari konteks di Brain sebelum mulai.\n3. Menghasilkan output lengkap yang siap dipakai.\n4. Menyimpan pengetahuan baru ke Brain.\n5. Berkoordinasi dengan rekan bila butuh keahlian lain.\n\n## CARA KERJA\nInput → analisis kebutuhan → cari referensi → susun draft → review mandiri dengan checklist → output.\n\n## ATURAN WAJIB\n- Tandai asumsi dengan jelas.\n- Gunakan skill: ${skillNames.join(', ') || 'sesuai kebutuhan'}.\n- Output langsung ke isi, tanpa basa-basi.\n\n## BATASAN & LARANGAN\n- Jangan mengarang data faktual.\n- Jangan mengambil keputusan uang, publikasi, kontrak, atau HR tanpa persetujuan.\n\n## GAYA KOMUNIKASI\nRamah, ringkas, profesional.\n\n## FORMAT RESPONS\nMarkdown dengan judul, poin bernomor, dan tabel bila perlu.\n\n## KONDISI ESKALASI\nInformasi tidak cukup, risiko tinggi, atau di luar wewenang → minta persetujuan/eskalasi ke ${db().employees.find((e) => e.id === d.leadId)?.name || 'atasan'}.`;
  return normalize({
    name, title, divisionId: d.id, isLead: false, about: `${name} adalah ${title} di divisi ${d.name}. Berikan tugas kepada ${name} bila berkaitan dengan: ${brief.slice(0, 200)}`,
    persona: 'Teliti, proaktif, dan komunikatif.', taskAndFunction: `${name} bertanggung jawab atas ${title.toLowerCase()}: ${brief.slice(0, 300)}`,
    instructions, escalation: 'Eskalasi bila informasi tidak cukup, menyangkut uang/publikasi/kontrak/HR, atau di luar wewenang.',
    keywords, skillIds: skillRefs.map((r) => r.id), newSkills: [], tools: CAP_IDS.filter((c) => c !== 'create_subtask' || /lead|head|manager|kepala/i.test(brief)),
    knowledgeIds, avatar: AVATARS[db().employees.length % AVATARS.length], autonomy: risky ? 'ask' : 'auto', effort: '',
    starters: [`Buatkan rencana kerja ${title.toLowerCase()} minggu ini`, `Analisis kondisi saat ini terkait ${keywords[0] || d.name}`, 'Susun laporan singkat untuk Owner'],
    reasoning: { division: `Kata kunci brief paling cocok dengan ${d.name}.`, skills: `Dipilih dari library berdasarkan kata kunci dan divisi: ${skillNames.join(', ')}.`, tools: 'Semua tool kerja standar; delegasi hanya untuk peran pemimpin.', knowledge: 'SOP divisi, kebijakan persetujuan, dan profil perusahaan.', autonomy: risky ? 'Brief menyentuh area berisiko → selalu minta persetujuan.' : 'Pekerjaan rutin berisiko rendah → otomatis.' },
  }, divisionId, 'simulasi');
}

function simSkill(brief) {
  const name = brief.split('\n')[0].slice(0, 50).replace(/^\w/, (c) => c.toUpperCase());
  return {
    source: 'simulasi', name, category: 'Strategy', description: brief.slice(0, 140),
    promptSnippet: `1. Pahami tujuan dan audiens dari tugas.\n2. Kumpulkan konteks dari Brain (SOP, data, deliverable sebelumnya).\n3. Susun kerangka sesuai metode: ${brief.slice(0, 120)}.\n4. Kerjakan draft lengkap, tandai asumsi.\n5. Review dengan checklist kualitas: jelas, akurat, bisa dieksekusi.\n6. Sajikan output dalam format yang diminta.`,
    usageGuide: `Dipakai saat tugas berkaitan dengan: ${brief.slice(0, 120)}.`, example: '',
  };
}
