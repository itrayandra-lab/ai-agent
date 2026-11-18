// Penghubung Discord: Gateway WebSocket minimal (identify, heartbeat, resume, sambung ulang) + REST untuk membalas. Hanya pesan pribadi (DM).
// Memakai WebSocket bawaan Node (tanpa paket tambahan). Intent yang diminta: DIRECT_MESSAGES saja; isi DM terbaca tanpa intent istimewa.
import * as st from './state.js';
import * as core from './core.js';

const api = () => String(process.env.DISCORD_API_BASE || 'https://discord.com/api/v10').replace(/\/+$/, '');
const num = (k, d) => { const v = Number(process.env[k]); return process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(v) ? v : d; };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const TOKEN_RE = /^[\w-]{20,}\.[\w-]{4,}\.[\w-]{20,}$/;
export const validToken = (t) => TOKEN_RE.test(String(t || '').trim());
const INTENTS = 1 << 12;   // DIRECT_MESSAGES
const FATAL = new Set([4004, 4010, 4011, 4012, 4013, 4014]);   // token salah, shard/intents tidak sah: jangan diulang
class DcError extends Error { constructor(msg, code, retry) { super(msg); this.code = code; this.retry = retry; } }

async function rest(token, method, path, body, { form, timeoutMs = 15000, auth = true } = {}) {
  const headers = { 'user-agent': 'DiscordBot (raiverse, 1.0)' };
  if (auth) headers.authorization = `Bot ${token}`;
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(`${api()}${path}`, { method, headers, body: payload, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (err) { throw new DcError(err?.name === 'TimeoutError' ? 'waktu habis' : 'jaringan terputus', 0); }
  if (res.status === 204) return {};
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new DcError(String(j?.message || `HTTP ${res.status}`).slice(0, 200), res.status, j?.retry_after);
  return j ?? {};
}
/** uji token tanpa menyimpannya */
export async function test(token) { const me = await rest(token, 'GET', '/users/@me', undefined, { timeoutMs: 10000 }); return { ok: true, name: me.username ? `${me.username}${me.discriminator && me.discriminator !== '0' ? '#' + me.discriminator : ''}` : 'bot', id: String(me.id || '') }; }

const chunks = (t, n) => { const out = []; let s = String(t || ''); while (s.length > n) { let i = s.lastIndexOf('\n', n); if (i < n * 0.5) i = n; out.push(s.slice(0, i)); s = s.slice(i).replace(/^\n/, ''); } out.push(s); return out; };

export function create() {
  const A = { service: 'discord', maxText: 1800, running: false, gen: 0, ws: null, bot: '', botId: '', error: '', since: 0, ready: false };
  let seq = null, sessionId = '', resumeUrl = '', hb = null, acked = true, backoff = 1000, retryTimer = null;
  const tok = () => st.getToken('discord');
  const fail = (m) => { A.error = st.scrub(m); };
  A.online = () => A.running && A.ready && !A.error;
  A.status = () => ({ configured: st.hasToken('discord'), online: A.online(), mode: 'gateway', bot: A.bot, error: A.error, since: A.since });

  async function post(path, body, opts) {
    try { return await rest(tok(), 'POST', path, body, opts); }
    catch (err) { if (err.code === 429 && err.retry && err.retry <= 5) { await sleep(err.retry * 1000 + 100); return rest(tok(), 'POST', path, body, opts); } throw err; }
  }
  const rows = (buttons) => { const out = []; for (let i = 0; i < buttons.length && out.length < 5; i += 5) out.push({ type: 1, components: buttons.slice(i, i + 5).map((b) => ({ type: 2, style: b.primary ? 1 : 2, label: String(b.label).slice(0, 80), custom_id: b.data })) }); return out; };
  A.send = async (chat, { text, buttons }) => {
    const parts = chunks(text, A.maxText);
    for (let i = 0; i < parts.length; i++) {
      const body = { content: parts[i] || '…', allowed_mentions: { parse: [] } };   // isi dari luar tidak boleh menyebut siapa pun
      if (buttons?.length && i === parts.length - 1) body.components = rows(buttons);
      await post(`/channels/${chat}/messages`, body);
    }
  };
  A.sendFile = async (chat, { name, text, caption }) => {
    const bytes = Buffer.from(String(text || ''), 'utf8');
    if (bytes.length > core.MAX_FILE_BYTES) throw new Error('berkas terlalu besar');
    const f = new FormData(); const fname = String(name || 'hasil.txt').replace(/[^\w.-]/g, '_');
    f.set('payload_json', JSON.stringify({ content: String(caption || '').slice(0, 1800), allowed_mentions: { parse: [] }, attachments: [{ id: 0, filename: fname }] }));
    f.set('files[0]', new Blob([bytes], { type: 'text/plain' }), fname);
    await post(`/channels/${chat}/messages`, undefined, { form: f, timeoutMs: 30000 });
  };

  // ── ubah kejadian Discord menjadi evt yang sama untuk semua layanan
  function onDispatch(t, d) {
    if (t === 'READY') { sessionId = d.session_id; resumeUrl = d.resume_gateway_url || ''; A.botId = String(d.user?.id || ''); A.ready = true; A.error = ''; backoff = 1000; core.log('Discord: bot online.'); return; }
    if (t === 'RESUMED') { A.ready = true; A.error = ''; backoff = 1000; return; }
    if (t === 'MESSAGE_CREATE') {
      if (String(d.author?.id) === A.botId) return;
      return core.handle({ service: 'discord', kind: 'message', id: d.id, ext: d.author?.id, chat: d.channel_id, private: !d.guild_id && d.type === 0, bot: !!d.author?.bot, text: d.content || '', attachment: !d.content && !!d.attachments?.length });
    }
    if (t === 'INTERACTION_CREATE' && d.type === 3) {
      const u = d.member?.user || d.user;
      rest(tok(), 'POST', `/interactions/${d.id}/${d.token}/callback`, { type: 6 }, { auth: false }).catch(() => {});   // "sedang diproses": tombol tidak menggantung
      return core.handle({ service: 'discord', kind: 'button', id: d.id, ext: u?.id, chat: d.channel_id, private: !d.guild_id, bot: !!u?.bot, data: d.data?.custom_id });
    }
  }

  // ── gateway
  const send = (op, d) => { try { if (A.ws?.readyState === 1) A.ws.send(JSON.stringify({ op, d })); } catch { /* menutup */ } };
  const stopHb = () => { clearInterval(hb); hb = null; };
  function startHb(ms, ws) {
    stopHb(); acked = true;
    const beat = () => { if (A.ws !== ws) return; if (!acked) { core.log('Discord: detak tidak dibalas, menyambung ulang.'); try { ws.close(4000, 'zombie'); } catch { /* sudah putus */ } return; } acked = false; send(1, seq); };
    setTimeout(() => { if (A.ws === ws) { beat(); hb = setInterval(beat, ms); hb.unref?.(); } }, Math.floor(ms * Math.random()));
  }
  async function connect(gen) {
    if (!A.running || gen !== A.gen) return;
    let url = resumeUrl;
    if (!url) {
      try { url = (await rest(tok(), 'GET', '/gateway/bot')).url || 'wss://gateway.discord.gg'; }
      catch (err) {
        if (err.code === 401) { fail('Discord menolak kodenya (token salah atau dicabut). Periksa lagi di konsol admin.'); A.running = false; return; }
        fail(`Discord belum terjangkau (${err.message}). Mencoba lagi…`); return reconnect(gen);
      }
    }
    let ws;
    try { ws = new WebSocket(`${url}${url.includes('?') ? '&' : '?'}v=10&encoding=json`); } catch (err) { fail(`Discord belum terjangkau (${err.message}).`); return reconnect(gen); }
    A.ws = ws; A.ready = false;
    ws.onmessage = (ev) => {
      if (A.ws !== ws) return;
      let p; try { p = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch { return; }
      if (p.s != null) seq = p.s;
      if (p.op === 10) {
        startHb(p.d.heartbeat_interval, ws);
        if (sessionId && seq != null) send(6, { token: tok(), session_id: sessionId, seq });
        else send(2, { token: tok(), intents: INTENTS, properties: { os: process.platform, browser: 'raiverse', device: 'raiverse' } });
      } else if (p.op === 11) acked = true;
      else if (p.op === 1) send(1, seq);
      else if (p.op === 7) { try { ws.close(4000, 'reconnect'); } catch { /* sudah putus */ } }
      else if (p.op === 9) { if (!p.d) { sessionId = ''; seq = null; resumeUrl = ''; } setTimeout(() => { if (A.ws === ws) { if (sessionId && seq != null) send(6, { token: tok(), session_id: sessionId, seq }); else send(2, { token: tok(), intents: INTENTS, properties: { os: process.platform, browser: 'raiverse', device: 'raiverse' } }); } }, 1000 + Math.random() * 2000); }
      else if (p.op === 0) { try { onDispatch(p.t, p.d); } catch (err) { core.log('Discord: kejadian gagal diproses:', err); } }
    };
    ws.onclose = (ev) => {
      if (A.ws !== ws) return;
      stopHb(); A.ready = false; A.ws = null;
      if (!A.running || gen !== A.gen) return;
      if (FATAL.has(ev.code)) { fail(ev.code === 4004 ? 'Discord menolak kodenya (token salah atau dicabut). Periksa lagi di konsol admin.' : 'Discord menolak pengaturan bot (periksa izin DM di Developer Portal).'); A.running = false; core.log('Discord: ditolak, berhenti. Kode', ev.code); return; }
      if (ev.code === 4007 || ev.code === 4009) { sessionId = ''; seq = null; resumeUrl = ''; }
      fail('Discord terputus. Menyambung ulang…'); reconnect(gen);
    };
    ws.onerror = () => { /* onclose menyusul */ };
  }
  function reconnect(gen) {
    clearTimeout(retryTimer);
    const wait = backoff + Math.random() * 250; backoff = Math.min(backoff * 2, num('CHANNEL_BACKOFF_MAX_MS', 60000));
    retryTimer = setTimeout(() => connect(gen), wait); retryTimer.unref?.();
  }

  A.start = async () => {
    A.stop();
    if (!tok()) { A.error = ''; A.bot = ''; return A.status(); }
    A.running = true; const gen = ++A.gen; A.since = Date.now(); A.error = ''; backoff = 1000;
    try { A.bot = (await test(tok())).name; }
    catch (err) { if (err.code === 401) { fail('Discord menolak kodenya (token salah atau dicabut).'); A.running = false; return A.status(); } fail(`Discord belum terjangkau (${err.message}). Mencoba lagi…`); }
    connect(gen);
    return A.status();
  };
  A.stop = () => {
    A.running = false; A.gen++; A.ready = false; stopHb(); clearTimeout(retryTimer);
    const ws = A.ws; A.ws = null; seq = null; sessionId = ''; resumeUrl = '';
    try { ws?.close(1000, 'stop'); } catch { /* sudah putus */ }
  };
  /** untuk uji: putuskan paksa soket (meniru jaringan putus) */
  A._drop = () => { try { A.ws?.close(4000, 'uji'); } catch { /* sudah putus */ } };
  return A;
}
