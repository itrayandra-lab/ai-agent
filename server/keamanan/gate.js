// Gerbang LLM bertoken per eksekusi (P3). Alur n8n yang butuh model bahasa memanggil POST /api/llm-gate dengan token pendek umur
// yang dicetak server ini. Kunci AI TIDAK PERNAH ada di n8n: model, batas token, anggaran, dan pencatatan biaya tetap
// dikendalikan server/llm.js + governor (anggaran harian per ruang kerja) + limits.js (kuota akun dan global).
//
// Token:  rg1.<payload base64url>.<hmac-sha256 hex>
//   payload = { ws, key (staf/otomasi), kind, exp, iat, n (nonce sekali pakai), mt (plafon token keluaran), mc (plafon biaya USD) }
// Satu token = SATU panggilan. Kedaluwarsa singkat (bawaan 2 menit), nonce dicatat tahan restart, tanda tangan memakai kunci turunan terpisah.
// Pola dua-ketukan yang sudah dipakai server/staff/runner.js tetap sah (tidak butuh alamat publik); gerbang ini adalah jalur langsung
// bila RAIVERSE_PUBLIC_URL tersedia. Pemanggil: gate.mint() lalu taruh token di payload alur; alur mengirim token ke /api/llm-gate.
import * as secure from './secure.js';
import * as limits from './limits.js';
import * as store from '../penyimpanan/store.js';
import * as llm from '../otak/llm.js';

export class GateError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = () => secure.derive('llm-gate');
const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; };
const clip = (s, n) => String(s ?? '').slice(0, n);

export function mint({ ws, key, kind = 'staf', maxTokens = 900, maxCostUSD = 0.05, ttlMs } = {}) {
  if (!ws || !key) throw new GateError('Token butuh ruang kerja dan kunci.');
  const now = Date.now();
  const payload = { ws: String(ws), key: String(key).slice(0, 80), kind, iat: now, exp: now + (ttlMs || num('GATE_TTL_MS', 120000)), n: secure.rand(12), mt: Math.min(3000, Math.max(50, Math.floor(maxTokens))), mc: Math.max(0.0001, Number(maxCostUSD) || 0.05) };
  const p = b64(payload);
  return `rg1.${p}.${secure.hmacHex(secret(), p)}`;
}
/** Periksa tanda tangan dan masa berlaku TANPA menghabiskan nonce. */
export function verify(token) {
  const m = String(token || '').match(/^rg1\.([A-Za-z0-9_-]{20,1500})\.([a-f0-9]{64})$/);
  if (!m || !secure.safeEqual(secure.hmacHex(secret(), m[1]), m[2])) throw new GateError('Token tidak sah.', 401);
  let c; try { c = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { throw new GateError('Token tidak sah.', 401); }
  if (!c || typeof c.ws !== 'string' || typeof c.n !== 'string' || !(c.exp > Date.now())) throw new GateError('Token sudah kedaluwarsa.', 401);
  return c;
}
/** Satu panggilan model atas nama satu token. Nonce dihabiskan SEBELUM memanggil model, jadi pemakaian ulang selalu ditolak. */
export async function invoke(token, { system = '', prompt = '', maxTokens, ws: claimedWs } = {}) {
  const c = verify(token);
  if (claimedWs && claimedWs !== c.ws) throw new GateError('Token ini bukan milik ruang kerja itu.', 403);
  if (!store.exists(c.ws)) throw new GateError('Ruang kerja tidak dikenal.', 404);
  if (!limits.once('gate', c.n, Math.max(60e3, c.exp - Date.now() + 60e3))) throw new GateError('Token sudah dipakai.', 409);
  const w = limits.hit(`gate:${c.ws}`, { limit: num('RATE_GATE_PER_MIN', 20), persist: true });
  if (!w.ok) throw new GateError('Terlalu sering memanggil AI. Tunggu sebentar.', 429);
  try { limits.charge('gate', { account: 'ws:' + c.ws }); limits.assertGlobalBudget(); } catch (err) { throw new GateError(err.message, 429); }
  return store.run(c.ws, async () => {
    if (store.get().settings.deleted) throw new GateError('Ruang kerja ini sudah dihapus.', 410);
    if (!llm.isLive()) throw new GateError('AI belum tersambung untuk ruang kerja ini.', 503);
    if (llm.budgetLeft() <= 0) throw new GateError('Anggaran AI harian ruang kerja ini sudah habis.', 429);
    const u0 = store.get().usage?.costToday || 0;
    // model dipilih SERVER (bukan pemanggil): selalu tingkat "worker"; plafon token = yang terkecil dari token, permintaan, dan batas global
    const cap = Math.min(c.mt, Math.max(50, Number(maxTokens) || c.mt), 3000);
    let res;
    try { res = await llm.call({ system: clip(system, 3000), messages: [{ role: 'user', content: clip(prompt, 12000) }], model: llm.defaultModels().worker, maxTokens: cap }); }
    catch (err) { throw new GateError(`AI gagal menjawab: ${String(err.message || err).slice(0, 120)}`, 502); }
    const cost = Math.max(0, (store.get().usage?.costToday || 0) - u0);
    if (cost > c.mc) console.warn(`[gate] biaya ${cost.toFixed(4)} melampaui plafon token ${c.mc} (ruang kerja ${c.ws}, kunci ${c.key})`);
    return { text: clip(llm.textOf(res), 8000), usage: { masuk: res.usage?.input_tokens || 0, keluar: res.usage?.output_tokens || 0 }, biayaUSD: Number(cost.toFixed(6)) };
  });
}

/** Penangan HTTP: dipasang di server/index.js SEBELUM gerbang login (kredensialnya adalah token itu sendiri). true = sudah ditangani. */
export async function handle(req, res, url, readBody) {
  if (url.pathname !== '/api/llm-gate') return false;
  const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); return true; };
  if (req.method !== 'POST') return send(405, { error: 'Gunakan POST.' });
  try {
    const b = await readBody(req);
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return send(200, await invoke(b?.token || bearer, { system: b?.system, prompt: b?.prompt, maxTokens: b?.maxTokens, ws: b?.ws }));
  } catch (err) { return send(err.code && Number.isInteger(err.code) ? err.code : 400, { error: err.message }); }
}
