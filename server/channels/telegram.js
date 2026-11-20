// Penghubung Telegram: Bot API lewat HTTPS. Long polling `getUpdates` (tidak butuh alamat publik), atau webhook bila RAIVERSE_PUBLIC_URL (https) ada.
// Tanpa paket tambahan. Token tidak pernah masuk log (semua pesan lewat st.scrub). Offset disimpan sebelum pesan diproses (tidak ada pesan ganda saat restart).
import * as st from './state.js';
import * as core from './core.js';
import * as secure from '../secure.js';

const base = () => String(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
const num = (k, d) => { const v = Number(process.env[k]); return process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(v) ? v : d; };
const sleep = (ms, sig) => new Promise((ok) => { const t = setTimeout(ok, ms); sig?.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true }); });
const TOKEN_RE = /^\d{6,12}:[\w-]{30,60}$/;
export const validToken = (t) => TOKEN_RE.test(String(t || '').trim());
class TgError extends Error { constructor(msg, code, retry) { super(msg); this.code = code; this.retry = retry; } }

async function call(token, method, payload = {}, { timeoutMs = 15000, signal, form } = {}) {
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let res;
  try { res = await fetch(`${base()}/bot${token}/${method}`, form ? { method: 'POST', body: form, signal: sig } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: sig }); }
  catch (err) { throw new TgError(err?.name === 'AbortError' || err?.name === 'TimeoutError' ? 'waktu habis' : 'jaringan terputus', 0); }
  const j = await res.json().catch(() => null);
  if (!j?.ok) throw new TgError(String(j?.description || `HTTP ${res.status}`).slice(0, 200), j?.error_code || res.status, j?.parameters?.retry_after);
  return j.result;
}
/** uji token tanpa menyimpannya */
export async function test(token) { const me = await call(token, 'getMe', {}, { timeoutMs: 20000 }); return { ok: true, name: me.username ? `@${me.username}` : me.first_name || 'bot', id: String(me.id) }; }

const chunks = (t, n) => { const out = []; let s = String(t || ''); while (s.length > n) { let i = s.lastIndexOf('\n', n); if (i < n * 0.5) i = n; out.push(s.slice(0, i)); s = s.slice(i).replace(/^\n/, ''); } out.push(s); return out.filter((x) => x.length || !out.length); };

export function create() {
  const A = { service: 'telegram', maxText: 3800, running: false, gen: 0, ctl: null, bot: '', mode: '', error: '', since: 0, lastOk: 0 };
  const tok = () => st.getToken('telegram');
  const fail = (msg) => { A.error = st.scrub(msg); };

  A.online = () => A.running && !A.error;
  A.status = () => ({ configured: st.hasToken('telegram'), online: A.online(), mode: A.mode, bot: A.bot, error: A.error, since: A.since });

  async function withRetry(method, payload, opts) {
    try { return await call(tok(), method, payload, opts); }
    catch (err) { if (err.code === 429 && err.retry && err.retry <= 5) { await sleep(err.retry * 1000 + 100); return call(tok(), method, payload, opts); } throw err; }
  }
  A.send = async (chat, { text, buttons }) => {
    const parts = chunks(text, A.maxText);
    for (let i = 0; i < parts.length; i++) {
      const p = { chat_id: chat, text: parts[i] || '…', disable_web_page_preview: true };
      if (buttons?.length && i === parts.length - 1) p.reply_markup = { inline_keyboard: buttons.map((b) => [{ text: String(b.label).slice(0, 60), callback_data: b.data }]) };
      await withRetry('sendMessage', p);
    }
  };
  A.sendFile = async (chat, { name, text, caption }) => {
    const bytes = Buffer.from(String(text || ''), 'utf8');
    if (bytes.length > core.MAX_FILE_BYTES) throw new Error('berkas terlalu besar');
    const mk = () => { const f = new FormData(); f.set('chat_id', String(chat)); if (caption) f.set('caption', String(caption).slice(0, 1000)); f.set('document', new Blob([bytes], { type: 'text/plain' }), String(name || 'hasil.txt').replace(/[^\w.-]/g, '_')); return f; };
    await withRetry('sendDocument', null, { form: mk(), timeoutMs: 30000 });
  };
  A.leave = (chat) => call(tok(), 'leaveChat', { chat_id: chat });
  const ack = (id) => call(tok(), 'answerCallbackQuery', { callback_query_id: id }).catch(() => {});

  /** ubah satu update Telegram menjadi evt yang sama untuk semua layanan */
  A.dispatch = (up) => {
    const m = up.message;
    if (m) {
      const priv = m.chat?.type === 'private' && m.from && String(m.from.id) === String(m.chat.id);
      const text = m.text || m.caption || '';
      return core.handle({ service: 'telegram', kind: 'message', id: up.update_id, ext: m.from?.id, chat: m.chat?.id, private: priv, bot: !!m.from?.is_bot, text, attachment: !m.text && !!(m.photo || m.document || m.voice || m.audio || m.video || m.sticker || m.contact || m.location) });
    }
    const q = up.callback_query;
    if (q) {
      ack(q.id);
      const chat = q.message?.chat;
      const priv = chat?.type === 'private' && String(q.from?.id) === String(chat.id);
      return core.handle({ service: 'telegram', kind: 'button', id: up.update_id, ext: q.from?.id, chat: chat?.id, private: priv, bot: !!q.from?.is_bot, data: q.data });
    }
  };

  // ── polling
  async function loop(gen) {
    let backoff = 1000;
    while (A.running && gen === A.gen) {
      try {
        const secs = num('CHANNEL_TG_POLL_SECS', 25);
        const ups = await call(tok(), 'getUpdates', { offset: st.getOffset('telegram'), timeout: secs, allowed_updates: ['message', 'callback_query'] }, { timeoutMs: (secs + 10) * 1000, signal: A.ctl.signal });
        if (gen !== A.gen) return;
        A.error = ''; A.lastOk = Date.now(); backoff = 1000;
        if (ups.length) { st.setOffset('telegram', Math.max(...ups.map((u) => u.update_id)) + 1); for (const u of ups) A.dispatch(u); }
      } catch (err) {
        if (gen !== A.gen) return;
        if (err.code === 401 || err.code === 404) { fail('Bot menolak kodenya (token salah atau dicabut). Periksa lagi di konsol admin.'); A.running = false; core.log('Telegram: token ditolak, berhenti.'); return; }
        fail(err.code === 409 ? 'Ada penjemput pesan lain untuk bot ini (webhook atau program lain).' : `Telegram belum terjangkau (${err.message}). Mencoba lagi…`);
        core.log('Telegram:', A.error);
        await sleep(backoff, A.ctl?.signal); backoff = Math.min(backoff * 2, num('CHANNEL_BACKOFF_MAX_MS', 60000));
      }
    }
  }

  A.start = async () => {
    A.stop();
    if (!tok()) { A.error = ''; A.bot = ''; return A.status(); }
    A.running = true; const gen = ++A.gen; A.ctl = new AbortController(); A.since = Date.now(); A.error = '';
    try { const me = await test(tok()); A.bot = me.name; }
    catch (err) { if (err.code === 401 || err.code === 404) { fail('Bot menolak kodenya (token salah atau dicabut).'); A.running = false; return A.status(); } fail(`Telegram belum terjangkau (${err.message}). Mencoba lagi…`); }
    const pub = String(process.env.RAIVERSE_PUBLIC_URL || '');
    try {
      if (/^https:\/\//i.test(pub)) { A.mode = 'webhook'; await call(tok(), 'setWebhook', { url: `${pub.replace(/\/+$/, '')}/api/saluran/hook/telegram`, secret_token: st.webhookSecret(), allowed_updates: ['message', 'callback_query'] }); }
      else { A.mode = 'polling'; await call(tok(), 'deleteWebhook', { drop_pending_updates: false }); loop(gen); }
    } catch (err) { fail(`Telegram belum terjangkau (${err.message}).`); if (A.mode === 'polling') loop(gen); }
    return A.status();
  };
  A.stop = () => { A.running = false; A.gen++; try { A.ctl?.abort(); } catch { /* sudah berhenti */ } A.ctl = null; };

  /** webhook masuk: rahasia dicek waktu-konstan; update ganda dibuang lewat nomor update */
  A.webhook = (headers, update) => {
    const want = st.webhookSecret(), got = String(headers['x-telegram-bot-api-secret-token'] || '');
    if (!got || !secure.safeEqual(got, want)) return false;
    if (update?.update_id !== undefined && !st.firstTime('telegram-hook', update.update_id)) return true;
    if (update && A.mode === 'webhook') A.dispatch(update);
    return true;
  };
  return A;
}
