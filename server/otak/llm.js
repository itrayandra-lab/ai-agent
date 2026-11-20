// LLM access for agents: Groq (OpenAI-compatible, fast/cheap, default when GROQ_API_KEY exists) or Claude.
// The engine speaks Anthropic-style messages/tool blocks; the Groq adapter translates both ways so agent code is provider-agnostic.
import Anthropic from '@anthropic-ai/sdk';
import * as store from '../penyimpanan/store.js';
import * as secure from '../keamanan/secure.js';
import * as quota from '../keamanan/limits.js';
import * as platform from '../admin/platform.js';

// USD per 1M tokens [input, output]
const PRICES = {
  'claude-fable-5-1': [10, 50], 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
  'openai/gpt-oss-120b': [0.15, 0.6], 'openai/gpt-oss-20b': [0.075, 0.3], 'llama-3.3-70b-versatile': [0.59, 0.79],
  'llama-3.1-8b-instant': [0.05, 0.08], 'qwen/qwen3.6-27b': [0.6, 3], 'qwen/qwen3.8-27b': [0.6, 3], 'groq/compound': [0.15, 0.6], 'groq/compound-mini': [0.1, 0.3],
};
export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'];
// This is only the offline fallback. With an API key, /models replaces it with
// the text-generation models that are active for that specific Groq account.
export const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'allam-2-7b'];
export const MODELS = [...GROQ_MODELS, ...CLAUDE_MODELS];
const FALLBACK_OK = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']);
const GROQ_STRICT = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
const GROQ_URL = process.env.RAY_GROQ_BASE_URL || 'https://api.groq.com/openai/v1';

const S = () => store.get().settings;
// kunci per ruang kerja disimpan sebagai amplop terenkripsi (secure.seal); teks biasa lama tetap terbaca
const stored = (v) => { try { return secure.open(v, 'ws-secret'); } catch { return ''; } };
// urutan: kunci ruang kerja → kunci platform (konsol pengelola) → .env
const claudeKey = () => stored(S().apiKey) || platform.secret('anthropic') || process.env.ANTHROPIC_API_KEY || '';
const groqKey = () => stored(S().groqApiKey) || platform.secret('groq') || process.env.GROQ_API_KEY || '';
export const hasGroq = () => !!groqKey();

const GROQ_UTILITY_MODEL = /(?:whisper|orpheus|prompt-guard|safeguard)/i;
let groqModelsAt = 0, groqModelsKey = '', groqModelsRequest = null;
let groqCatalog = [...GROQ_MODELS];
const sortGroqModels = (models) => [...new Set(models)].sort((a, b) => {
  const preferred = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
  return (preferred.indexOf(a) < 0 ? 99 : preferred.indexOf(a)) - (preferred.indexOf(b) < 0 ? 99 : preferred.indexOf(b)) || a.localeCompare(b);
});
function replaceGroqModels(models) {
  GROQ_MODELS.splice(0, GROQ_MODELS.length, ...models);
  MODELS.splice(0, MODELS.length, ...models, ...CLAUDE_MODELS);
}
/** Refresh the selectable models from Groq. Audio/TTS/guard models are active
 * API models too, but cannot run this app's chat-completion agents. */
export async function refreshGroqModels({ force = false } = {}) {
  const key = groqKey();
  if (!key) return GROQ_MODELS;
  const keyId = key.slice(-8);
  if (!force && keyId === groqModelsKey && Date.now() - groqModelsAt < 10 * 60_000) return GROQ_MODELS;
  if (groqModelsRequest) return groqModelsRequest;
  groqModelsRequest = (async () => {
    const res = await fetch(`${GROQ_URL}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw Object.assign(new Error(`Groq ${res.status}: daftar model tidak dapat dimuat`), { status: res.status });
    const json = await res.json();
    const blocked = new Set(S().groqUnavailableModels || []);
    const models = (json.data || []).filter((m) => m.active !== false && m.id && !GROQ_UTILITY_MODEL.test(m.id)).map((m) => m.id);
    groqCatalog = [...new Set(models)];
    const allowed = models.filter((id) => !blocked.has(id));
    if (allowed.length) replaceGroqModels(sortGroqModels(allowed));
    groqModelsAt = Date.now(); groqModelsKey = keyId;
    return GROQ_MODELS;
  })().finally(() => { groqModelsRequest = null; });
  return groqModelsRequest;
}

/** Explicit, lightweight account-level verification. Unlike /models, this also
 * catches models blocked by an organization's Groq settings. */
export async function verifyGroqModels() {
  await refreshGroqModels({ force: true });
  const unavailable = new Set(S().groqUnavailableModels || []);
  const deferred = [];
  for (const model of groqCatalog) {
    try {
      await groqFetch({ model, messages: [{ role: 'user', content: 'Reply OK' }], max_completion_tokens: 8 });
      unavailable.delete(model);
    } catch (err) {
      if (err.status === 400 || err.status === 403 || err.status === 404) unavailable.add(model);
      else deferred.push(model); // rate/capacity trouble is temporary, not an access denial
    }
  }
  const s = S(); s.groqUnavailableModels = [...unavailable]; store.setRoot('settings', s);
  replaceGroqModels(sortGroqModels(groqCatalog.filter((id) => !unavailable.has(id))));
  return { models: GROQ_MODELS, unavailable: [...unavailable], deferred };
}

/** 'groq' | 'claude' | 'sim' — which engine agents run on right now. */
export function provider() {
  const s = S();
  if (s.mode === 'sim' || s.provider === 'sim') return 'sim';
  if (s.provider === 'groq') return groqKey() ? 'groq' : 'sim';
  if (s.provider === 'claude') return claudeKey() ? 'claude' : 'sim';
  return groqKey() ? 'groq' : claudeKey() ? 'claude' : 'sim';
}
export const isLive = () => provider() !== 'sim';
export function defaultModels(p = provider()) {
  const s = S(), pm = platform.model;   // pilihan model di konsol pengelola (bila ada) mengalahkan pilihan per ruang kerja
  return p === 'groq' ? { lead: pm('groqLead') || s.groqModel || 'openai/gpt-oss-120b', worker: pm('groqWorker') || s.groqWorkerModel || 'openai/gpt-oss-120b', small: pm('groqSmall') || 'openai/gpt-oss-20b', smart: pm('groqLead') || s.groqSmartModel || 'openai/gpt-oss-120b', vision: s.groqVisionModel || 'qwen/qwen3.8-27b' }
    : { lead: pm('claudeLead') || s.model || 'claude-opus-5-5', worker: pm('claudeWorker') || s.workerModel || s.model, small: pm('claudeSmall') || 'claude-haiku-5-5', smart: pm('claudeLead') || s.model || 'claude-opus-5-5', vision: pm('claudeLead') || s.model || 'claude-opus-5-5' };
}

let client = null, clientKey = null;
function getClient() {
  const key = claudeKey();
  if (!client || clientKey !== key) { client = new Anthropic({ apiKey: key, baseURL: process.env.RAY_ANTHROPIC_BASE_URL || 'https://api.anthropic.com', maxRetries: 2 }); clientKey = key; }
  return client;
}

export function budgetLeft() {
  const { usage, settings } = store.get();
  rollDay(usage);
  return settings.dailyBudgetUSD - usage.costToday;
}
function rollDay(usage) {
  const day = new Date().toISOString().slice(0, 10);
  if (usage.day !== day) Object.assign(usage, { day, costToday: 0 });
}

let onTaskCost = null;
export const setTaskCostHook = (fn) => { onTaskCost = fn; };
export function track(employee, model, u) {
  const [pi, po] = PRICES[model] || [1, 2];
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  const cost = (inTok * pi + (u.output_tokens || 0) * po) / 1e6;
  const usage = store.get().usage;
  rollDay(usage);
  usage.costToday += cost; usage.costTotal += cost;
  usage.tokensIn += u.input_tokens || 0; usage.tokensOut += u.output_tokens || 0; usage.calls += 1;
  usage.byModel = usage.byModel || {};
  const m = (usage.byModel[model] ||= { calls: 0, tokens: 0, cost: 0 });
  m.calls += 1; m.tokens += (u.input_tokens || 0) + (u.output_tokens || 0); m.cost += cost;
  store.setRoot('usage', usage);
  if (employee) {
    employee.stats.tokensIn += u.input_tokens || 0;
    employee.stats.tokensOut += u.output_tokens || 0;
    employee.stats.cost += cost;
  }
  return cost;
}

// ───── resilience: per-model circuit breaker + rate-limit memory
const breaker = new Map();
const cooldowns = new Map();
const isOpen = (m) => { const b = breaker.get(m); return (cooldowns.get(m)?.until || 0) > Date.now() || (b && b.fails >= 5 && Date.now() - b.at < 60000); };
const fail = (m) => { const b = breaker.get(m) || { fails: 0, at: 0 }; b.fails += 1; b.at = Date.now(); breaker.set(m, b); };
const ok = (m) => { breaker.delete(m); if ((cooldowns.get(m)?.until || 0) <= Date.now()) cooldowns.delete(m); };
const limits = {}; // last rate-limit headers per provider
export const health = () => ({
  breakers: Object.fromEntries([...breaker].map(([m, b]) => [m, { fails: b.fails, open: isOpen(m) }])),
  cooldowns: Object.fromEntries([...cooldowns].filter(([, c]) => c.until > Date.now()).map(([m, c]) => [m, { retryAt: c.until, reason: c.reason }])), limits,
});
class CapacityError extends Error { constructor(message, fields = {}) { super(message); Object.assign(this, fields); } }
const retryable = (err) => err instanceof CapacityError || err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError || err?.status === 529;

function durationMs(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) * 1000;
  let total = 0;
  for (const m of raw.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m|h)/gi)) total += Number(m[1]) * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000 })[m[2].toLowerCase()];
  return total;
}
function retryDelay(res, message) {
  return durationMs(res.headers.get('retry-after')) || durationMs(res.headers.get('x-ratelimit-reset-tokens'))
    || durationMs(message?.match(/try again in\s+([\d.]+\s*(?:ms|s|m|h))/i)?.[1]) || 60_000;
}
function coolDown(model, ms, reason) {
  cooldowns.set(model, { until: Date.now() + Math.max(1000, Math.min(ms, 60 * 60_000)), reason });
}

// ───── Claude
async function claudeOnce(model, p) {
  const params = {
    model, max_tokens: p.maxTokens,
    system: [{ type: 'text', text: p.system, cache_control: { type: 'ephemeral' } }],
    messages: p.messages, thinking: { type: 'adaptive' },
    output_config: { effort: p.effort || S().effort || 'low', ...(p.format ? { format: { type: 'json_schema', schema: p.format } } : {}) },
  };
  if (p.tools?.length) params.tools = p.tools;
  if (FALLBACK_OK.has(model)) return getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  return getClient().messages.create(params);
}

// ───── Groq (OpenAI-compatible chat completions)
function toOpenAI(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      out.push({ role: 'assistant', content: text || (calls.length ? null : ''), ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const b of m.content) {
        if (b.type === 'tool_result') out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
        else if (b.type === 'text') out.push({ role: 'user', content: b.text });
      }
      // a user turn with pictures goes as ONE multimodal message (text + image_url parts) for vision models
      const imgs = m.content.filter((b) => b.type === 'image');
      if (imgs.length) {
        while (out.length && out[out.length - 1].role === 'user' && typeof out[out.length - 1].content === 'string' && m.content.some((b) => b.type === 'text' && b.text === out[out.length - 1].content)) out.pop();
        out.push({ role: 'user', content: [...m.content.filter((b) => b.type === 'text').map((b) => ({ type: 'text', text: b.text })), ...imgs.map((b) => ({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }))] });
      }
    }
  }
  return out;
}
function fromOpenAI(j, model) {
  const msg = j.choices?.[0]?.message || {};
  const content = [];
  const said = String(msg.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();   // Qwen thinks out loud inside <think>; the reader only gets the answer
  if (said) content.push({ type: 'text', text: said });
  for (const c of msg.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(c.function.arguments || '{}'); } catch { input = { _raw: c.function.arguments }; }
    content.push({ type: 'tool_use', id: c.id, name: c.function.name, input });
  }
  const fr = j.choices?.[0]?.finish_reason;
  const stop_reason = content.some((b) => b.type === 'tool_use') ? 'tool_use' : fr === 'length' ? 'max_tokens' : 'end_turn';
  const u = j.usage || {};
  const cached = u.prompt_tokens_details?.cached_tokens || 0;
  return { id: j.id, model, content, stop_reason, reasoning: msg.reasoning || '', executed_tools: msg.executed_tools, usage: { input_tokens: (u.prompt_tokens || 0) - cached, cache_read_input_tokens: cached, output_tokens: u.completion_tokens || 0 } };
}
// One lane prevents several agents from consuming the same remaining TPM at
// once. A 429 is never immediately retried; its model sleeps until Groq's reset.
let groqLane = Promise.resolve();
async function groqFetch(body) {
  const model = body.model;
  if (isOpen(model)) {
    const retryAt = cooldowns.get(model)?.until;
    throw new CapacityError(`Groq ${model} sedang cooldown${retryAt ? ` sampai ${new Date(retryAt).toISOString()}` : ''}`, { status: 429, retryAt });
  }
  const execute = async () => fetch(`${GROQ_URL}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${groqKey()}`, 'Content-Type': 'application/json', 'Groq-Model-Version': 'latest' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });   // tanpa batas waktu, satu panggilan yang menggantung membuat tugas macet selamanya (temuan uji nyata)
  const pending = groqLane.then(execute, execute);
  groqLane = pending.then(() => undefined, () => undefined);
  const res = await pending;
  const h = {}; for (const [k, v] of res.headers) if (k.startsWith('x-ratelimit')) h[k.replace('x-ratelimit-', '')] = v;
  if (Object.keys(h).length) limits.groq = { ...h, at: Date.now() };
  if (res.ok) return res.json();
  const text = await res.text();
  let err; try { err = JSON.parse(text).error; } catch { err = { message: text.slice(0, 300) }; }
  if (res.status === 429 || res.status >= 500) {
    const wait = retryDelay(res, err?.message);
    coolDown(model, wait, res.status === 429 ? 'rate limit' : 'server error');
    throw new CapacityError(`Groq ${res.status}: ${err?.message || 'capacity'}`, { status: res.status, retryAt: Date.now() + wait });
  }
  const e = new Error(`Groq ${res.status}: ${err?.message || text.slice(0, 200)}`);
  e.status = res.status; e.code = err?.code; e.failedGeneration = err?.failed_generation;
  throw e;
}
async function groqOnce(model, p) {
  const body = { model, messages: toOpenAI(p.system, p.messages), max_completion_tokens: Math.min(p.maxTokens, 32000) };
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' }[p.effort || S().effort] || 'low';
  if (p.tools?.length) {
    body.tools = p.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    body.tool_choice = 'auto';
  }
  if (p.format) body.response_format = GROQ_STRICT.has(model) ? { type: 'json_schema', json_schema: { name: 'output', strict: true, schema: p.format } } : { type: 'json_object' };
  // No tools on offer this turn: hand the model a history without tool-call structure, otherwise it tries to call one and Groq rejects the request.
  if (!body.tools) body.messages = flattenTools(body.messages);
  try {
    return fromOpenAI(await groqFetch(body), model);
  } catch (err) {
    if (err.status !== 400) throw err;
    const msg = err.message || '';
    const noTools = /tool choice is none/i.test(msg), badTool = err.code === 'tool_use_failed' || /tool call/i.test(msg), parse = /pars(e|ing) failed|failed_generation/i.test(msg);
    if (!(noTools || badTool || parse || p.format)) throw err;
    // one retry with the loosest settings: no tools, flat history, low reasoning, plain instruction
    if (body.tools) { delete body.tools; delete body.tool_choice; }
    body.messages = flattenTools(body.messages);
    if (body.reasoning_effort) body.reasoning_effort = 'low';
    if (p.format) {
      body.response_format = { type: 'json_object' };
      if (!/json/i.test(body.messages[0].content)) body.messages[0].content += '\nBalas hanya dengan satu objek JSON valid.';
    } else body.messages.push({ role: 'user', content: 'Jawab langsung dengan teks biasa yang ringkas, tanpa memanggil tool apa pun.' });
    try {
      return fromOpenAI(await groqFetch(body), model);
    } catch (e2) {
      // the model did write an answer, only the decoder rejected it: use that text rather than failing the whole turn
      const raw = String(e2.failedGeneration || err.failedGeneration || '').trim();
      if (e2.status === 400 && !p.format && raw.length > 20 && !/^[\[{<]/.test(raw)) return fromOpenAI({ choices: [{ message: { role: 'assistant', content: raw }, finish_reason: 'stop' }], usage: {} }, model);
      throw e2;
    }
  }
}

/** Chat history without tool-call structure: tool calls become nothing, tool results become plain notes. */
function flattenTools(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool') { out.push({ role: 'user', content: 'Catatan hasil kerja sebelumnya: ' + String(m.content || '').slice(0, 1500) }); continue; }
    if (m.role === 'assistant' && m.tool_calls) { if (m.content) out.push({ role: 'assistant', content: m.content }); continue; }
    out.push(m);
  }
  return out;
}

/** One completion with model rotation. Returns an Anthropic-shaped response. */
export async function call({ system, messages, tools, model, employee, maxTokens = 8000, effort, format, taskId }) {
  const p = provider();
  if (p === 'sim') throw new Error('Mode simulasi: tidak ada provider AI aktif');
  quota.assertGlobalBudget();   // penutup anggaran global platform (mode publik)
  if (p === 'groq') {
    // Discovery is cached for ten minutes and shared by concurrent calls.
    try { await refreshGroqModels(); } catch (err) { console.warn(`[llm] daftar model Groq gagal dimuat: ${err.message}`); }
  }
  const d = defaultModels(p);
  const pool = p === 'groq' ? GROQ_MODELS : CLAUDE_MODELS;
  const first = pool.includes(model) ? model : pool.includes(d.lead) ? d.lead : pool[0];
  const candidates = [first, d.worker, p === 'groq' ? 'openai/gpt-oss-20b' : 'claude-haiku-5-5', ...pool];
  // At most one fallback for Groq: enough to survive a per-model limit without
  // turning one user action into requests across the entire model catalog.
  const maxAttempts = p === 'groq' ? 2 : candidates.length;
  const available = [...new Set(candidates)].filter((m) => pool.includes(m));
  const healthy = available.filter((m) => !isOpen(m));
  const chain = (healthy.length ? healthy : available.slice(0, 1)).slice(0, maxAttempts);
  const once = p === 'groq' ? groqOnce : claudeOnce;
  const req = { system, messages, tools, maxTokens, effort, format };
  let lastErr;
  for (const m of chain) {
    if (isOpen(m) && m !== chain.at(-1)) continue;
    try {
      const res = await once(m, req);
      ok(m);
      const cost = track(employee, m, res.usage || {});
      if (taskId) onTaskCost?.(taskId, cost);
      res.usedModel = m;
      return res;
    } catch (err) {
      if (!retryable(err)) throw err;
      fail(m); lastErr = err;
      console.warn(`[llm] ${m} gagal (${err.status || err.message})${m !== chain.at(-1) ? ', mencoba satu model cadangan' : ''}`);
    }
  }
  throw lastErr;
}

/** Structured JSON output (schema-constrained where the provider supports it). */
export async function json({ system, prompt, schema, model, employee, maxTokens = 16000, effort = 'medium' }) {
  const res = await call({ system, messages: [{ role: 'user', content: prompt }], model, employee, maxTokens, effort, format: schema });
  if (res.stop_reason === 'refusal') throw new Error('Permintaan ditolak oleh model');
  if (res.stop_reason === 'max_tokens') throw new Error('Output terpotong (max_tokens)');
  const text = textOf(res).replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

/** Real web research via GPT-OSS built-in browser_search on Groq (searches + opens pages). Works whichever provider runs the agents. */
export async function webResearch(query, employee) {
  if (!groqKey()) throw new Error('Riset web membutuhkan GROQ_API_KEY');
  let model = 'openai/gpt-oss-120b';
  const attempt = (m) => groqFetch({
    model: m, max_completion_tokens: 4000, reasoning_effort: 'low', tool_choice: 'required', tools: [{ type: 'browser_search' }],
    messages: [{ role: 'system', content: 'Kamu asisten riset web. Cari dan buka sumber terpercaya, lalu jawab ringkas dan faktual dalam Bahasa Indonesia dengan angka/tanggal penting. Bila data tidak ditemukan, katakan tidak ditemukan — jangan menebak. Akhiri dengan daftar "Sumber:" berisi judul + URL.' }, { role: 'user', content: query }],
  });
  let j;
  try { j = await attempt(model); }
  catch (err) { if (err.status !== 400) throw err; model = 'openai/gpt-oss-20b'; j = await attempt(model); } // browser output occasionally fails to parse; retry on the smaller model
  const r = fromOpenAI(j, model);
  track(employee, model, r.usage);
  const text = textOf(r).replace(/【[^】]*】/g, '').trim();
  const sources = [...new Map((j.choices?.[0]?.message?.executed_tools || []).flatMap((t) => t.search_results?.results || []).filter((s) => s.url).map((s) => [s.url, s])).values()].slice(0, 6).map((s) => `- ${s.title || s.url} — ${s.url}`);
  return `${text}${sources.length && !/https?:\/\//.test(text) ? `\n\nSumber:\n${sources.join('\n')}` : ''}`;
}

export const textOf = (res) => res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

/** Balasan Groq bertahap (SSE) untuk obrolan: onContent dipanggil tiap potongan teks jawaban; biaya tetap dicatat lewat track().
 *  Dipakai server/pemandu-chat.js. Tanpa percobaan ulang atau model cadangan: pemanggil yang memutuskan (jatuh ke llm.call). */
export async function groqStream({ model, system, messages, schema, maxTokens = 2400, effort = 'low' }, onContent = () => {}) {
  if (!groqKey()) throw new Error('Groq belum terpasang');
  if (isOpen(model)) throw new Error(`Groq ${model} sedang cooldown`);
  const body = { model, messages: toOpenAI(system, messages), max_completion_tokens: maxTokens, stream: true, stream_options: { include_usage: true } };
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = effort;
  // skema ketat membuat Groq menahan seluruh balasan lalu mengirimnya sekaligus; mode json_object tetap mengalir kata demi kata (schema === 'json_object')
  if (schema === 'json_object') body.response_format = { type: 'json_object' };
  else if (schema) body.response_format = GROQ_STRICT.has(model) ? { type: 'json_schema', json_schema: { name: 'output', strict: true, schema } } : { type: 'json_object' };
  const res = await fetch(`${GROQ_URL}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${groqKey()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  if (!res.ok) { fail(model); const t = await res.text(); throw Object.assign(new Error(`Groq ${res.status}: ${t.slice(0, 200)}`), { status: res.status }); }
  const dec = new TextDecoder(); let buf = '', text = '', usage = null;
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of ev.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch { continue; }
        const d = j.choices?.[0]?.delta?.content; if (d) { text += d; onContent(d); }
        if (j.usage) usage = j.usage;
      }
    }
  }
  ok(model);
  track(null, model, { input_tokens: usage?.prompt_tokens || 0, output_tokens: usage?.completion_tokens || 0 });
  return { text, usage };
}
