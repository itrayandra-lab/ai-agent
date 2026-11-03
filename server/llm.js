// LLM access for agents: Groq (OpenAI-compatible, fast/cheap, default when GROQ_API_KEY exists) or Claude.
// The engine speaks Anthropic-style messages/tool blocks; the Groq adapter translates both ways so agent code is provider-agnostic.
import Anthropic from '@anthropic-ai/sdk';
import * as store from './store.js';

// USD per 1M tokens [input, output]
const PRICES = {
  'claude-fable-5-1': [10, 50], 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
  'openai/gpt-oss-120b': [0.15, 0.6], 'openai/gpt-oss-20b': [0.075, 0.3], 'llama-3.3-70b-versatile': [0.59, 0.79],
  'llama-3.1-8b-instant': [0.05, 0.08], 'qwen/qwen3.6-27b': [0.6, 3], 'groq/compound': [0.15, 0.6], 'groq/compound-mini': [0.1, 0.3],
};
export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'];
export const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'llama-3.1-8b-instant'];
export const MODELS = [...GROQ_MODELS, ...CLAUDE_MODELS];
const FALLBACK_OK = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']);
const GROQ_STRICT = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
const GROQ_URL = process.env.RAY_GROQ_BASE_URL || 'https://api.groq.com/openai/v1';

const S = () => store.get().settings;
const claudeKey = () => S().apiKey || process.env.ANTHROPIC_API_KEY || '';
const groqKey = () => S().groqApiKey || process.env.GROQ_API_KEY || '';
export const hasGroq = () => !!groqKey();

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
  const s = S();
  return p === 'groq' ? { lead: s.groqModel || 'openai/gpt-oss-120b', worker: s.groqWorkerModel || 'openai/gpt-oss-120b', small: 'openai/gpt-oss-20b' }
    : { lead: s.model || 'claude-opus-5-5', worker: s.workerModel || s.model, small: 'claude-haiku-5-5' };
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
const isOpen = (m) => { const b = breaker.get(m); return b && b.fails >= 5 && Date.now() - b.at < 60000; };
const fail = (m) => { const b = breaker.get(m) || { fails: 0, at: 0 }; b.fails += 1; b.at = Date.now(); breaker.set(m, b); };
const ok = (m) => breaker.delete(m);
const limits = {}; // last rate-limit headers per provider
export const health = () => ({ breakers: Object.fromEntries([...breaker].map(([m, b]) => [m, { fails: b.fails, open: isOpen(m) }])), limits });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class CapacityError extends Error {}
const retryable = (err) => err instanceof CapacityError || err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError || err?.status === 529;

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
    }
  }
  return out;
}
function fromOpenAI(j, model) {
  const msg = j.choices?.[0]?.message || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
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
async function groqFetch(body, attempt = 0) {
  const res = await fetch(`${GROQ_URL}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${groqKey()}`, 'Content-Type': 'application/json', 'Groq-Model-Version': 'latest' }, body: JSON.stringify(body) });
  const h = {}; for (const [k, v] of res.headers) if (k.startsWith('x-ratelimit')) h[k.replace('x-ratelimit-', '')] = v;
  if (Object.keys(h).length) limits.groq = { ...h, at: Date.now() };
  if (res.ok) return res.json();
  const text = await res.text();
  let err; try { err = JSON.parse(text).error; } catch { err = { message: text.slice(0, 300) }; }
  if (res.status === 429 || res.status >= 500) {
    const wait = Math.min(20, Number(res.headers.get('retry-after')) || 2 ** attempt);
    if (attempt < 2) { await sleep(wait * 1000); return groqFetch(body, attempt + 1); }
    throw new CapacityError(`Groq ${res.status}: ${err?.message || 'capacity'}`);
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
  try {
    return fromOpenAI(await groqFetch(body), model);
  } catch (err) {
    // A malformed tool call or a schema the strict decoder rejects: retry once with looser settings.
    if (err.status === 400 && (err.code === 'tool_use_failed' || p.format)) {
      if (p.format) body.response_format = { type: 'json_object' };
      if (p.format && !/json/i.test(body.messages[0].content)) body.messages[0].content += '\nBalas hanya dengan satu objek JSON valid.';
      return fromOpenAI(await groqFetch(body), model);
    }
    throw err;
  }
}

/** One completion with model rotation. Returns an Anthropic-shaped response. */
export async function call({ system, messages, tools, model, employee, maxTokens = 8000, effort, format, taskId }) {
  const p = provider();
  if (p === 'sim') throw new Error('Mode simulasi: tidak ada provider AI aktif');
  const d = defaultModels(p);
  const pool = p === 'groq' ? GROQ_MODELS : CLAUDE_MODELS;
  const first = pool.includes(model) ? model : d.lead;
  const chain = [...new Set([first, d.worker, p === 'groq' ? 'openai/gpt-oss-20b' : 'claude-haiku-5-5', ...(p === 'groq' ? ['llama-3.3-70b-versatile'] : [])])];
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
      console.warn(`[llm] ${m} gagal (${err.status || err.message}), mencoba model berikutnya`);
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
