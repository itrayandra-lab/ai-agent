// Uji LOKAL tanpa n8n: menjalankan alur hasil kompilasi dengan data contoh di kotak pasir (node:vm, batas waktu).
// Untuk penulis spesifikasi: umpan balik cepat sebelum pemasangan sungguhan. Pemasang (deployer.js) tetap menguji di n8n.
// Mendukung simpul yang dihasilkan pembangun: webhook, set, if, noOp. Simpul berefek keluar (HTTP, tabel, Sheets) diganti pencatat contoh (sim).
import vm from 'node:vm';
import { compile, testCopy } from './blueprint.js';
import { checkExpect } from './schema.js';

const FLAGS = { timeout: 2000 };
function evalExpr(value, json, byName) {
  if (typeof value !== 'string' || !value.startsWith('=')) return value;
  const m = value.slice(1).trim().match(/^\{\{([\s\S]*)\}\}$/); if (!m) return value.slice(1);
  const ctx = vm.createContext({ $json: json, $: (n) => ({ item: { json: byName[n] ?? {} } }), Math, Number, String, Date, JSON, Object, Array, Boolean, parseFloat, parseInt, isNaN, RegExp, Intl });
  return vm.runInContext(`(${m[1]})`, ctx, FLAGS);
}
const typeFix = (v, type) => (type === 'number' ? Number(v) : type === 'boolean' ? (v === true || v === 'true') : v);

function runFlow(nodes, conns, bodyJson) {
  const byNode = new Map(nodes.map((n) => [n.name, n])); const byName = {};
  const trig = nodes.find((n) => /webhook$/.test(n.type)); let cur = trig.name, json = { body: bodyJson, headers: {}, query: {} }; byName[cur] = json;
  for (let guard = 0; guard < 60 && cur; guard++) {
    const n = byNode.get(cur); let out = 0;
    try {
      if (/\.set$/.test(n.type)) {
        const next = {}; const keep = n.parameters.includeOtherFields ? { ...json } : {};
        for (const a of n.parameters.assignments.assignments) next[a.name] = typeFix(evalExpr(a.value, json, byName), a.type);
        json = Object.assign(keep, next);
      } else if (/\.if$/.test(n.type)) {
        const c = n.parameters.conditions.conditions[0]; out = evalExpr(c.leftValue, json, byName) === true ? 0 : 1;
      } else if (/\.(noOp|webhook)$/.test(n.type)) { /* lewat */ }
      else throw new Error(`simpul ${n.type} tidak ada pengganti uji (tambahkan sim)`);
    } catch (e) { throw Object.assign(new Error(`Langkah "${n.name}" gagal: ${e.message}`), { node: n.name }); }
    byName[cur] = json; cur = conns[cur]?.main?.[out]?.[0]?.node;
  }
  return json;
}

/** Jalankan sample spesifikasi secara lokal. Mengembalikan { ok, hasil, galat }. */
export function simulate(spec, { input = spec.sample?.input, ai = spec.sample?.ai } = {}) {
  try {
    const built = compile(spec, { token: 'sim', tableId: 'T' });
    const copy = testCopy(built, 'sim');
    const base = { ws: 'uji', user: 'uji', runId: 'sim-1', staf: spec.key, input };
    let res = runFlow(copy.nodes, copy.connections, { ...base, phase: 'jalankan' });
    if (res.tahap === 'minta_ai') res = runFlow(copy.nodes, copy.connections, { ...base, phase: 'selesaikan', state: res.state, llmText: ai ?? '' });
    const bad = checkExpect(res, spec.sample?.expect);
    return { ok: !bad, hasil: res, galat: bad };
  } catch (e) { return { ok: false, hasil: null, galat: e.message }; }
}
