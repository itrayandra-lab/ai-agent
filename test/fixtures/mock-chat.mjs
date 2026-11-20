// Server tiruan Telegram (HTTP) dan Discord (REST + Gateway WebSocket) untuk tes saluran chat. Hanya di localhost, tanpa token asli.
import http from 'node:http';
import crypto from 'node:crypto';

const readBody = async (req) => { const parts = []; for await (const c of req) parts.push(c); return Buffer.concat(parts); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** parser multipart seadanya: medan teks dan satu berkas */
function parseMultipart(buf, contentType) {
  const boundary = /boundary=(.+)$/.exec(contentType || '')?.[1]; const out = { fields: {}, file: null };
  if (!boundary) return out;
  const text = buf.toString('latin1');
  for (const part of text.split(`--${boundary}`).slice(1)) {
    if (part.startsWith('--')) break;
    const [head, ...rest] = part.replace(/^\r\n/, '').split('\r\n\r\n'); const data = rest.join('\r\n\r\n').replace(/\r\n$/, '');
    const name = /name="([^"]+)"/.exec(head)?.[1]; const filename = /filename="([^"]+)"/.exec(head)?.[1];
    if (filename) out.file = { name: filename, bytes: Buffer.from(data, 'latin1') }; else if (name) out.fields[name] = Buffer.from(data, 'latin1').toString('utf8');
  }
  return out;
}

export async function startMockTelegram({ token }) {
  const S = { sent: [], docs: [], acks: [], left: [], hooks: [], offsets: [], deleted: 0, down: false, updates: [], nextId: 1000, calls: 0 };
  const srv = http.createServer(async (req, res) => {
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (!m) return send(404, { ok: false, error_code: 404, description: 'Not Found' });
    if (S.down) return req.destroy();
    S.calls++;
    const raw = await readBody(req); const ct = req.headers['content-type'] || '';
    const isForm = ct.startsWith('multipart/'); let b = {}, form = null;
    if (isForm) form = parseMultipart(raw, ct); else { try { b = JSON.parse(raw.toString('utf8') || '{}'); } catch { b = {}; } }
    if (m[1] !== token) return send(401, { ok: false, error_code: 401, description: 'Unauthorized' });
    switch (m[2]) {
      case 'getMe': return send(200, { ok: true, result: { id: 777000111, is_bot: true, first_name: 'RAIVERSE Uji', username: 'raiverse_uji_bot' } });
      case 'deleteWebhook': S.deleted++; return send(200, { ok: true, result: true });
      case 'setWebhook': S.hooks.push(b); return send(200, { ok: true, result: true });
      case 'getUpdates': {
        S.offsets.push(b.offset); S.updates = S.updates.filter((u) => u.update_id >= (b.offset || 0));
        const t0 = Date.now();
        while (!S.updates.length && Date.now() - t0 < 250 && !req.destroyed) await sleep(25);
        return send(200, { ok: true, result: S.updates.slice() });
      }
      case 'sendMessage': S.sent.push({ chat: String(b.chat_id), text: b.text, kb: b.reply_markup?.inline_keyboard?.flat() || [] }); return send(200, { ok: true, result: { message_id: S.sent.length } });
      case 'sendDocument': S.docs.push({ chat: String(form.fields.chat_id), name: form.file?.name, text: form.file?.bytes.toString('utf8'), caption: form.fields.caption }); return send(200, { ok: true, result: { message_id: 1 } });
      case 'answerCallbackQuery': S.acks.push(b.callback_query_id); return send(200, { ok: true, result: true });
      case 'leaveChat': S.left.push(String(b.chat_id)); return send(200, { ok: true, result: true });
      default: return send(200, { ok: true, result: true });
    }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const push = (u) => { const up = { update_id: S.nextId++, ...u }; S.updates.push(up); return up; };
  return {
    url: `http://127.0.0.1:${srv.address().port}`, state: S, push,
    /** pesan pribadi dari pengguna `from` */
    say: (from, text, extra = {}) => push({ message: { message_id: 1, from: { id: from, is_bot: false, first_name: 'U' + from }, chat: { id: from, type: 'private' }, text, ...extra } }),
    press: (from, data) => push({ callback_query: { id: 'cb' + S.nextId, from: { id: from, is_bot: false }, message: { chat: { id: from, type: 'private' } }, data } }),
    lastTo: (chat) => [...S.sent].reverse().find((x) => x.chat === String(chat)),
    allTo: (chat) => S.sent.filter((x) => x.chat === String(chat)),
    close: () => new Promise((ok) => { srv.closeAllConnections?.(); srv.close(ok); }),
  };
}

// ── Discord: REST + Gateway
const frame = (opcode, payload) => {
  const len = payload.length; let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]); else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); } else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
};
function decodeFrames(state, chunk, onFrame) {
  state.buf = Buffer.concat([state.buf, chunk]);
  for (;;) {
    const b = state.buf; if (b.length < 2) return;
    const opcode = b[0] & 0x0f, masked = !!(b[1] & 0x80); let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
    let data = b.subarray(off + (masked ? 4 : 0), need);
    if (masked) { const k = b.subarray(off, off + 4); data = Buffer.from(data.map((x, i) => x ^ k[i % 4])); }
    state.buf = b.subarray(need); onFrame(opcode, data);
  }
}

export async function startMockDiscord({ token, botId = '999' }) {
  const S = { sent: [], docs: [], acks: [], identifies: 0, resumes: 0, connections: 0, rejectGateway: false, nextId: 5000000000, beats: 0, ignoreBeats: false };
  const sockets = new Set(); let seq = 0, port = 0;
  const srv = http.createServer(async (req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const raw = await readBody(req); const ct = req.headers['content-type'] || '';
    if (req.url.startsWith('/interactions/')) { S.acks.push(req.url); return send(204, {}); }
    if (req.headers.authorization !== `Bot ${token}`) return send(401, { message: '401: Unauthorized', code: 0 });
    if (req.url === '/users/@me') return send(200, { id: botId, username: 'raiverse-uji', discriminator: '0' });
    if (req.url === '/gateway/bot') return send(200, { url: `ws://127.0.0.1:${port}/gw` });
    const m = /^\/channels\/(\d+)\/messages$/.exec(req.url);
    if (m && req.method === 'POST') {
      if (ct.startsWith('multipart/')) { const f = parseMultipart(raw, ct); const pj = JSON.parse(f.fields.payload_json || '{}'); S.docs.push({ chat: m[1], name: f.file?.name, text: f.file?.bytes.toString('utf8'), caption: pj.content }); }
      else { const b = JSON.parse(raw.toString('utf8') || '{}'); S.sent.push({ chat: m[1], text: b.content, kb: (b.components || []).flatMap((r) => r.components), mentions: b.allowed_mentions }); }
      return send(200, { id: String(S.nextId++) });
    }
    send(404, { message: 'Unknown' });
  });
  srv.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}\r\n\r\n`);
    S.connections++; sockets.add(socket);
    const st = { buf: Buffer.alloc(0) }; const sid = `sess-${S.connections}`;
    const out = (obj) => { try { socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); } catch { /* putus */ } };
    const dispatch = (t, d) => out({ op: 0, t, s: ++seq, d });
    socket._dispatch = dispatch;
    out({ op: 10, d: { heartbeat_interval: 300 } });
    socket.on('data', (chunk) => decodeFrames(st, chunk, (op, data) => {
      if (op === 8) { socket.end(frame(8, Buffer.alloc(2))); return; }
      if (op === 9) { socket.write(frame(10, data)); return; }
      if (op !== 1) return;
      const p = JSON.parse(data.toString('utf8'));
      if (p.op === 1) { S.beats++; if (!S.ignoreBeats) out({ op: 11 }); }
      else if (p.op === 2) {
        S.identifies++; S.lastIntents = p.d.intents;
        if (p.d.token !== token) { const c = Buffer.alloc(2); c.writeUInt16BE(4004); socket.end(frame(8, Buffer.concat([c, Buffer.from('Authentication failed.')]))); return; }
        dispatch('READY', { session_id: sid, user: { id: botId }, resume_gateway_url: `ws://127.0.0.1:${port}/gw` });
      } else if (p.op === 6) { S.resumes++; dispatch('RESUMED', {}); }
    }));
    socket.on('close', () => sockets.delete(socket)); socket.on('error', () => sockets.delete(socket));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); port = srv.address().port;
  const live = () => [...sockets].filter((s) => !s.destroyed);
  const dispatchAll = (t, d) => live().forEach((s) => s._dispatch?.(t, d));
  const id = () => String(S.nextId++);
  return {
    url: `http://127.0.0.1:${port}`, state: S,
    /** pesan pribadi (tanpa guild_id) */
    dm: (user, channel, content, extra = {}) => dispatchAll('MESSAGE_CREATE', { id: id(), type: 0, channel_id: channel, content, author: { id: user, bot: false, username: 'u' + user }, attachments: [], ...extra }),
    guild: (user, channel, content) => dispatchAll('MESSAGE_CREATE', { id: id(), type: 0, channel_id: channel, guild_id: 'g1', content, author: { id: user, bot: false }, attachments: [] }),
    bot: (user, channel, content) => dispatchAll('MESSAGE_CREATE', { id: id(), type: 0, channel_id: channel, content, author: { id: user, bot: true }, attachments: [] }),
    click: (user, channel, custom_id) => dispatchAll('INTERACTION_CREATE', { id: id(), type: 3, token: 'tok' + S.nextId, channel_id: channel, user: { id: user }, data: { custom_id } }),
    drop: () => live().forEach((s) => s.end(frame(8, Buffer.from([0x03, 0xe9])))),   // server menutup (1001): klien harus menyambung ulang
    lastTo: (chat) => [...S.sent].reverse().find((x) => x.chat === String(chat)),
    allTo: (chat) => S.sent.filter((x) => x.chat === String(chat)),
    close: () => new Promise((ok) => { live().forEach((s) => s.destroy()); srv.closeAllConnections?.(); srv.close(ok); }),
  };
}
