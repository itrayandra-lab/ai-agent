// Pembangun: spesifikasi staf (JSON) → alur n8n valid.
// Kerangka standar:
//   Terima permintaan (webhook bertoken) → Masukan → [Tahap?] → Cek masukan → langkah-langkah → Hasil
// Bila ada langkah minta_ai: alur dipecah dua fase (server RAIVERSE yang memanggil AI, n8n tidak memegang kunci AI):
//   fase "jalankan": ... langkah sebelum AI → "Minta AI" (berhenti, mengembalikan permintaan + state)
//   fase "selesaikan": Pulihkan state + teks AI → langkah sesudah AI → Hasil
import * as C from '../n8n-templates/common.js';
import * as X from './expr.js';
import { FRAGMENTS, setT } from './fragments.js';

export const BLUEPRINT_VERSION = 1;
export const NAME_PREFIX = '[RAIVERSE][staf] ';
const typed = (value, type = 'string') => ({ value, type });
const IF = (name, leftExpr, pos) => C.node(name, 'n8n-nodes-base.if', 2.2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: C.uuid(), leftValue: X.raw(leftExpr), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, pos);

export const workflowName = (spec, ws) => `${NAME_PREFIX}${spec.key}${ws ? ` [${ws}]` : ''} v${spec.version || 1}`;
export const webhookPath = (spec, token) => `rv-staf-${spec.key}-${token}`;
/** Staf yang butuh akun luar milik pengguna dipasang sebagai salinan per ruang kerja; yang lain dipakai bersama. */
export const needsAccount = (spec) => [...new Set((spec.steps || []).map((s) => FRAGMENTS[s.use]?.account).filter(Boolean))];

/** ctx: { token, tableId, googleUrl, googleCred }. Mengembalikan { name?, nodes, connections, trigger, sim, twoPhase, path }. */
export function compile(spec, ctx = {}) {
  const nodes = [], conns = {}, sim = {}; const used = new Set(); let col = 0, row = 0;
  const pos = () => [col * 240, row * 160];
  const uniq = (label) => { let n = String(label).replace(/[^\p{L}\p{N} _–-]/gu, '').slice(0, 40) || 'Langkah', i = 2, base = n; while (used.has(n)) n = `${base} ${i++}`; used.add(n); return n; };
  const add = (n) => { nodes.push(n); used.add(n.name); return n; };
  const steps = spec.steps || [];
  const ai = steps.findIndex((s) => s.use === 'minta_ai');
  const path = webhookPath(spec, ctx.token || 'uji'), requiredKeys = (spec.inputs || []).filter((f) => f.required).map((f) => f.key);
  const out = { webhook: add(C.webhookNode('Terima permintaan', path, [0, 0])) };
  const prevOf = { name: 'Terima permintaan' };

  col = 1;
  const masukan = add(setT('Masukan', {
    ws: typed(X.raw(`String($json.body?.ws ?? '')`)), user: typed(X.raw(`String($json.body?.user ?? '')`)), runId: typed(X.raw(`String($json.body?.runId ?? '')`)), staf: typed(X.raw(`String($json.body?.staf ?? '')`)),
    phase: typed(X.raw(`String($json.body?.phase || 'jalankan')`)), input: typed(X.raw(`($json.body?.input || {})`), 'object'), state: typed(X.raw(`($json.body?.state || {})`), 'object'), llmText: typed(X.raw(`String($json.body?.llmText ?? '')`)), v: typed(X.raw('({})'), 'object'),
  }, pos()));
  C.link(conns, 'Terima permintaan', masukan.name);
  prevOf.name = masukan.name;

  const cek = IF('Cek masukan', requiredKeys.length ? `${JSON.stringify(requiredKeys)}.every((k) => String($json.input?.[k] ?? '').trim() !== '')` : 'true', [2 * 240, 0]);
  const kurang = setT('Masukan kurang', { tahap: typed('galat'), ok: typed('false', 'boolean'), runId: typed(X.raw('$json.runId')), pesan: typed(X.raw(`'Isian belum lengkap: ' + ${JSON.stringify(requiredKeys)}.filter((k) => String($json.input?.[k] ?? '').trim() === '').join(', ')`)) }, [2 * 240, 200]);
  let tahap = null;
  if (ai >= 0) { tahap = IF('Tahap selesaikan?', `$json.phase === 'selesaikan'`, [2 * 240, -160]); add(tahap); C.link(conns, masukan.name, tahap.name); }
  add(cek); add(kurang);
  C.link(conns, cek.name, kurang.name, 1);
  if (tahap) C.link(conns, tahap.name, cek.name, 1); else C.link(conns, masukan.name, cek.name);

  const cursor = { name: cek.name, out: 0 };
  const chainTo = (n) => { C.link(conns, cursor.name, n.name, cursor.out); cursor.name = n.name; cursor.out = 0; prevOf.name = n.name; };
  const runStep = (step, rowIdx) => {
    row = rowIdx; col = 3 + (nodes.length % 6);
    const c = { uniq, pos: () => { col++; return pos(); }, prevName: () => prevOf.name, spec, ctx };
    const r = FRAGMENTS[step.use].build(step, c);
    for (const n of r.nodes) { add(n); chainTo(n); }
    Object.assign(sim, r.sim);
  };

  const before = ai >= 0 ? steps.slice(0, ai) : steps, after = ai >= 0 ? steps.slice(ai + 1) : [];
  for (const s of before) runStep(s, 0);
  if (ai >= 0) {
    runStep(steps[ai], 0);   // "Minta AI": berhenti di sini pada fase "jalankan"
    const pulih = add(setT('Pulihkan', { ws: typed(X.raw('$json.ws')), user: typed(X.raw('$json.user')), runId: typed(X.raw('$json.runId')), staf: typed(X.raw('$json.staf')), phase: typed(X.raw('$json.phase')), input: typed(X.raw('$json.state.input || {}'), 'object'), v: typed(X.raw(`Object.assign({}, $json.state.v, { ai: String($json.llmText || '') })`), 'object') }, [3 * 240, -160]));
    C.link(conns, tahap.name, pulih.name, 0); cursor.name = pulih.name; cursor.out = 0; prevOf.name = pulih.name;
    for (const s of after) runStep(s, -1);
  }

  // Hasil: kontrak keluaran staf (selalu sama bentuknya)
  const o = spec.output || {};
  const fields = {
    tahap: typed('selesai'), ok: typed('true', 'boolean'), runId: typed(X.raw('$json.runId')), staf: typed(X.raw('$json.staf')),
    ringkas: typed(X.value(`cut(${o.ringkas || "''"}, 300)`)), teks: typed(X.value(`cut(${o.teks || "''"}, 30000)`)),
    berkas: typed(X.value(`[${(o.berkas || []).map((b) => `{ nama: cut(${b.nama}, 80), jenis: ${JSON.stringify(b.jenis)}, isi: cut(${b.isi}, 300000) }`).join(', ')}]`), 'array'),
    data: typed(X.value(o.data || '({})'), 'object'),
  };
  col = 9; row = 0;
  const hasil = add(setT('Hasil', fields, pos()));
  C.link(conns, cursor.name, hasil.name, cursor.out);
  return { nodes, connections: conns, trigger: 'Terima permintaan', sim, twoPhase: ai >= 0, path, nodeCount: nodes.length };
}

/** Salinan untuk uji: simpul berefek keluar diganti pencatat (sim). */
export function testCopy(built, path) {
  const nodes = JSON.parse(JSON.stringify(built.nodes));
  for (const [name, fields] of Object.entries(built.sim || {})) {
    const i = nodes.findIndex((n) => n.name === name); if (i < 0) continue;
    nodes[i] = setT(name, Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, typeof f === 'object' && f && 'value' in f ? f : typed(f)])), nodes[i].position, true);
  }
  const t = nodes.findIndex((n) => n.name === built.trigger); nodes[t] = C.webhookNode(built.trigger, path, nodes[t].position);
  return { nodes, connections: JSON.parse(JSON.stringify(built.connections)) };
}
