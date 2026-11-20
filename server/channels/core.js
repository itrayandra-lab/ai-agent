// Inti saluran chat: penautan per pengguna, sesi terpisah, kuota, dan jembatan ke giliran Pemandu.
// Penghubung (telegram.js, discord.js) hanya menerjemahkan layanan luar menjadi `evt` yang sama dan mengirim balasan.
//
// Aturan yang dijaga di sini:
//  1. Siapa penggunanya HANYA berasal dari ikatan di server (data/channels.json) dan keanggotaan akun saat itu, tidak pernah dari isi pesan.
//  2. Teks masuk adalah data: dioper sebagai `input` ke Pemandu. Tombol hanya diterima bila ada di daftar tombol balasan terakhir untuk obrolan itu.
//  3. Hanya obrolan pribadi. Grup dan kanal ditolak dengan sopan.
//  4. Satu akun luar = satu ruang kerja pada satu waktu.
import * as st from './state.js';
import * as auth from '../auth.js';
import * as store from '../store.js';
import * as limits from '../limits.js';
import * as pemandu from '../pemandu.js';
import * as secure from '../secure.js';

const num = (k, d) => { const v = Number(process.env[k]); return process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(v) ? v : d; };
const clip = (s, n) => String(s ?? '').slice(0, n);
export const log = (...a) => console.log('[saluran]', ...a.map((x) => st.scrub(x?.message ?? x)));

let turnImpl = (a) => pemandu.turn(a);
/** untuk uji: ganti giliran Pemandu */
export const setTurn = (fn) => { turnImpl = fn || ((a) => pemandu.turn(a)); };
const adapters = {};
export const registerAdapter = (a) => { adapters[a.service] = a; };
export const adapterOf = (s) => adapters[s];

const TXT = {
  notLinked: (svc) => `Aku belum mengenali akunmu. Buka aplikasi RAIVERSE, masuk ke Pengaturan, pilih Sambungan, lalu tekan Hubungkan ${st.LABEL[svc]}. Kamu akan dapat kode singkat; kirim kode itu ke sini.`,
  badCode: 'Kodenya tidak cocok atau sudah kedaluwarsa (berlaku 10 menit). Buat kode baru di aplikasi RAIVERSE, lalu kirim lagi.',
  tooMany: 'Terlalu banyak percobaan kode. Tunggu sekitar 10 menit, lalu coba lagi.',
  taken: 'Akun ini sudah terhubung ke ruang kerja lain. Ketik /putus dulu kalau mau pindah, lalu hubungkan lagi.',
  already: 'Akun ini sudah terhubung. Ketik /putus dulu kalau mau memutuskan atau pindah ruang kerja.',
  unlinked: 'Sudah diputus. Akun ini tidak lagi terhubung ke RAIVERSE. Kamu bisa menghubungkannya lagi kapan saja dari aplikasi.',
  group: 'Maaf, aku hanya melayani obrolan pribadi supaya data kamu tidak terbaca orang lain. Kirim pesan langsung (japri) ke aku ya.',
  blocked: 'Akun ini sedang tidak bisa memakai RAIVERSE lewat chat. Hubungi pengelola ruang kerjamu.',
  suspended: 'Akunmu sedang ditangguhkan, jadi chat ini belum bisa dipakai. Hubungi pengelola ruang kerjamu.',
  gone: 'Ikatan ini sudah tidak berlaku (kamu tidak lagi ada di ruang kerja itu). Hubungkan lagi dari aplikasi bila perlu.',
  loginAgain: 'Aplikasi sekarang mewajibkan masuk dengan Google. Masuk dulu di aplikasi, lalu hubungkan chat ini lagi.',
  textOnly: 'Aku baru bisa membaca tulisan. Coba ketik pesannya ya.',
  stale: 'Tombol itu sudah lewat. Ketik pesanmu, atau ketik /baru untuk mulai lagi.',
  help: 'Ketik apa saja yang kamu butuhkan, atau ketuk tombol di bawah balasanku.\n/baru  mulai percakapan baru\n/putus  putuskan akun ini dari RAIVERSE\n/bantuan  tampilkan pesan ini',
  fail: 'Ada yang belum berhasil. Coba lagi sebentar lagi ya.',
  slow: (s) => `Pelan-pelan dulu ya. Coba lagi sekitar ${s} detik lagi.`,
  linked: (name) => `Tersambung! Chat ini sekarang terhubung ke ruang kerja${name ? ` "${name}"` : ''}. Percakapan di sini terpisah dari orang lain. Ketik /putus kapan saja untuk memutuskan.`,
};

const clean = (t) => String(t ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 2000).trim();
const parseCmd = (t) => { const m = t.match(/^[/!](\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/); return m ? { name: m[1].toLowerCase(), arg: (m[2] || '').trim() } : null; };
const sessionOf = (l) => `ch-${l.service[0]}-${secure.sha256(`${l.service}:${l.chat}`).slice(0, 14)}`;

// ── antrean per obrolan (urut, tidak saling melewati) dan penanda "pengguna baru berbuat sesuatu"
const queues = new Map();
function enqueue(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(fn).catch((e) => log('galat:', e)).finally(() => { if (queues.get(key) === next) queues.delete(key); });
  queues.set(key, next); return next;
}
/** untuk uji: tunggu semua pekerjaan yang sedang jalan */
export const idle = async () => { while (queues.size) await Promise.all([...queues.values()]); };
const epochs = new Map(), timers = new Map();
const bump = (k) => { epochs.set(k, (epochs.get(k) || 0) + 1); clearTimeout(timers.get(k)); timers.delete(k); if (epochs.size > 5000) for (const x of [...epochs.keys()].slice(0, 1000)) epochs.delete(x); return epochs.get(k); };

// ── siapa pengguna ini sekarang? (dihitung ulang tiap pesan dari akun dan keanggotaan)
const suspended = (u, m) => !!(u && (u.suspended || u.disabled || u.banned || u.blocked || ['suspended', 'ditangguhkan'].includes(u.status))) || !!(m && (m.suspended || m.disabled));
export function resolve(link) {
  if (link.accountId === 'local') {
    if (auth.enforced()) return { error: TXT.loginAgain, drop: true };
    if (!store.exists(link.ws)) return { error: TXT.gone, drop: true };
    const employeeId = store.run(link.ws, () => store.get().settings.currentUserId);
    return { ws: link.ws, employeeId, canAutomate: true, accountId: 'local' };
  }
  const u = auth.userById(link.accountId);
  if (!u) return { error: TXT.gone, drop: true };
  const m = auth.memberOf(u, link.ws);
  if (!m || !m.employeeId || !store.exists(link.ws)) return { error: TXT.gone, drop: true };
  if (suspended(u, m)) return { error: TXT.suspended };
  if (!store.run(link.ws, () => store.get().employees.some((e) => e.id === m.employeeId))) return { error: TXT.gone, drop: true };
  return { ws: link.ws, employeeId: m.employeeId, canAutomate: ['owner', 'admin'].includes(m.role), accountId: u.id };
}

// ── pesan keluar
const say = (ad, chat, text) => ad.send(chat, { text }).catch((e) => log('gagal kirim:', e));
/** susun balasan Pemandu menjadi teks biasa + tombol (+ berkas bila hasilnya panjang) */
export function compose(r, max = 3500) {
  const lines = []; let file = null;
  for (const n of r.notes || []) lines.push(n);
  if (r.kind === 'result' && r.result) {
    const t = String(r.result.text || ''), title = clip(r.result.title || 'Hasil', 100);
    if (t.length > max - 500) { file = { name: 'hasil.txt', text: t, caption: title }; lines.push(`${title}\n${clip(t, 500).trim()}…`, 'Hasilnya panjang, jadi lengkapnya kukirim sebagai berkas.', r.say); }
    else lines.push(title, t, r.say);
  } else {
    lines.push(r.say);
    if (r.preview?.length) lines.push(r.preview.map((p) => `• ${p.label}: ${p.value}`).join('\n'));
    if (r.progress) lines.push(`(${r.progress.pct}%) ${r.progress.text}`);
  }
  const buttons = (r.options || []).map((o) => ({ id: o.id, label: o.label, primary: !!o.recommended }));
  for (const c of r.cards || []) { lines.push(c.say); if (c.detail) lines.push(c.detail); for (const o of c.options || []) buttons.push({ id: `card:${c.type}:${o.id}`, label: o.label, primary: !!o.recommended }); }
  if (r.delegate && !buttons.some((b) => b.id === 'delegate')) buttons.push({ id: 'delegate', label: 'Serahkan ke kamu' });
  if (r.undo && !buttons.some((b) => b.id === 'back')) buttons.push({ id: 'back', label: 'Kembali' });
  return { text: lines.filter(Boolean).join('\n\n'), buttons: buttons.slice(0, 8), file };
}
async function deliverReply(ad, link, r) {
  const c = compose(r, ad.maxText || 3500);
  const last = { seq: (link.last?.seq || 0) + 1, ids: c.buttons.map((b) => b.id) };
  st.update((s) => { const l = s.links[st.linkKey(link.service, link.ext)]; if (l) l.last = last; });
  link.last = last;
  if (c.file) await ad.sendFile(link.chat, c.file).catch((e) => log('gagal kirim berkas:', e));
  await ad.send(link.chat, { text: c.text, buttons: c.buttons.map((b, i) => ({ ...b, data: `o:${last.seq}:${i}` })) }).catch((e) => log('gagal kirim:', e));
}
export const MAX_FILE_BYTES = 256 * 1024;

// ── kuota dan batas laju
function slowdown(key, limit, windowMs = 60e3) {
  const r = limits.hit(key, { limit, windowMs });
  return r.ok ? null : { once: r.count === limit + 1, text: TXT.slow(r.retryAfter), retry: r.retryAfter };
}

// ── titik masuk dari penghubung
export function handle(evt) {
  const ad = adapters[evt.service]; if (!ad || evt.bot) return Promise.resolve();
  const ext = String(evt.ext || ''), chat = String(evt.chat || ''); if (!ext || !chat) return Promise.resolve();
  const e = { ...evt, ext, chat };
  return enqueue(`${e.service}:${chat}`, () => (e.private ? handlePrivate(ad, e) : groupNotice(ad, e)));
}
async function groupNotice(ad, e) {
  if (!limits.hit(`ch:g:${e.service}:${e.chat}`, { limit: 1, windowMs: 600e3 }).ok) return;
  await say(ad, e.chat, TXT.group);
  if (ad.leave) await ad.leave(e.chat).catch(() => {});
}

async function handlePrivate(ad, e) {
  const { service, ext, chat } = e;
  if (!st.firstTime(service, e.id)) return;   // sudah pernah diproses (restart, kiriman ulang)
  const slow = slowdown(`ch:u:${service}:${ext}`, num('CHANNEL_RATE_PER_MIN', 12));
  if (slow) { if (slow.once) await say(ad, chat, slow.text); return; }
  if (st.isBlocked(service, ext)) return say(ad, chat, TXT.blocked);
  const text = clean(e.text), cmd = parseCmd(text);
  let link = st.getLink(service, ext);

  // belum tertaut: hanya petunjuk, atau penautan bila kodenya benar
  if (!link) {
    if (e.kind === 'button') return say(ad, chat, TXT.notLinked(service));
    const code = st.normCode(cmd?.name === 'start' ? cmd.arg : cmd ? '' : text);
    if (!st.CODE_RE.test(code)) return say(ad, chat, TXT.notLinked(service));
    if (slowdown(`ch:code:${service}:${ext}`, num('CHANNEL_CODE_TRIES', 8), 600e3)) return say(ad, chat, TXT.tooMany);
    const res = bind(service, ext, chat, code);
    if (res.err === 'bad') return say(ad, chat, TXT.badCode);
    if (res.err === 'taken') return say(ad, chat, TXT.taken);
    if (res.err) return say(ad, chat, res.err);
    link = res.link; log(`${st.LABEL[service]}: satu akun tertaut ke ruang kerja ${link.ws}`);
    const name = store.exists(link.ws) ? store.run(link.ws, () => store.get().company?.name) : '';
    await say(ad, chat, TXT.linked(name));
    return converse(ad, link, resolve(link), { input: '' });
  }

  const key = `${service}:${chat}`;
  if (e.kind === 'message' && cmd?.name === 'putus') { bump(key); st.removeLink(service, ext); return say(ad, chat, TXT.unlinked); }
  if (e.kind === 'message' && cmd?.name === 'start' && st.CODE_RE.test(st.normCode(cmd.arg))) return say(ad, chat, TXT.already);
  const acc = resolve(link);
  if (acc.error) { if (acc.drop) { bump(key); st.removeLink(service, ext); } return say(ad, chat, acc.error); }
  if (e.kind === 'message' && cmd?.name === 'bantuan') return say(ad, chat, TXT.help);

  let choiceId = '', input = text;
  if (e.kind === 'button') {
    const m = String(e.data || '').match(/^o:(\d+):(\d+)$/); const id = m && Number(m[1]) === link.last?.seq ? link.last.ids[Number(m[2])] : undefined;
    if (!id) return say(ad, chat, TXT.stale);
    choiceId = id; input = '';
  } else if (!text) return say(ad, chat, e.attachment ? TXT.textOnly : TXT.help);
  else if (cmd?.name === 'baru') { choiceId = 'new'; input = ''; }
  else if (cmd?.name === 'start') input = '';

  const wsSlow = slowdown(`ch:ws:${acc.ws}`, num('CHANNEL_WS_RATE_PER_MIN', 60));
  if (wsSlow) { if (wsSlow.once) await say(ad, chat, wsSlow.text); return; }
  try { limits.charge('message', { account: acc.accountId }); limits.assertGlobalBudget(); }
  catch (err) { if (err instanceof limits.LimitError) return say(ad, chat, err.message); throw err; }
  return converse(ad, link, acc, { input, choiceId });
}

/** satu giliran Pemandu sebagai pengguna yang terikat, lalu kirim balasannya */
async function converse(ad, link, acc, { input = '', choiceId = '' }) {
  if (acc.error) return say(ad, link.chat, acc.error);
  const key = `${link.service}:${link.chat}`; const my = bump(key);
  let r;
  try { r = await runTurn(link, acc, { input, choiceId }); }
  catch (err) { log('giliran gagal:', err); return say(ad, link.chat, TXT.fail); }
  await deliverReply(ad, link, r);
  if (r.kind === 'progress') follow(ad, link, my);
}
const runTurn = (link, acc, { input, choiceId }) => store.run(acc.ws, () => turnImpl({ userId: acc.employeeId, sessionId: sessionOf(link), input, choiceId, canAutomate: acc.canAutomate, source: link.service }));   // percakapan Telegram/Discord tercatat dengan sumbernya

/** selama pekerjaan berjalan, cek berkala dan kirim hasilnya begitu siap (berhenti bila pengguna sudah berbuat hal lain) */
function follow(ad, link, my) {
  const key = `${link.service}:${link.chat}`, every = num('CHANNEL_POLL_MS', 4000); let n = 0;
  const schedule = () => { const t = setTimeout(tick, every); t.unref?.(); timers.set(key, t); };
  const tick = () => {
    if (epochs.get(key) !== my || ++n > num('CHANNEL_POLL_MAX', 150)) return;
    enqueue(key, async () => {
      if (epochs.get(key) !== my) return;
      const cur = st.getLink(link.service, link.ext); if (!cur || cur.accountId !== link.accountId) return;
      const acc = resolve(cur); if (acc.error) return;
      const r = await runTurn(cur, acc, { choiceId: 'poll' }).catch(() => null);
      if (epochs.get(key) !== my || !r) return;
      if (r.kind === 'progress') { schedule(); return; }
      await deliverReply(ad, cur, r);
    });
  };
  schedule();
}

// ── penautan: kode sekali pakai (hash), satu akun luar = satu ruang kerja
function bind(service, ext, chat, code) {
  const peek = st.takeCode(service, code, { keep: true });
  if (!peek) return { err: 'bad' };
  const probe = { service, ws: peek.ws, accountId: peek.accountId, ext, chat, last: { seq: 0, ids: [] } };
  const acc = resolve(probe); if (acc.error) return { err: acc.error };
  return st.update((s) => {
    const h = st.codeHash(service, code); s.codes = s.codes.filter((c) => c.exp > Date.now());
    const i = s.codes.findIndex((c) => c.service === service && secure.safeEqual(c.h, h)); if (i < 0) return { err: 'bad' };
    const c = s.codes[i], k = st.linkKey(service, ext), ex = s.links[k];
    if (ex && (ex.ws !== c.ws || ex.accountId !== c.accountId)) return { err: 'taken' };
    s.codes.splice(i, 1);
    for (const [kk, l] of Object.entries(s.links)) if (l.service === service && l.ws === c.ws && l.accountId === c.accountId && kk !== k) delete s.links[kk];   // pengguna yang sama pindah ke akun luar lain: yang lama dilepas
    s.links[k] = { service, ext, chat, ws: c.ws, accountId: c.accountId, at: Date.now(), last: { seq: 0, ids: [] } };
    return { link: s.links[k] };
  });
}

// ── dipakai rute aplikasi (tombol Hubungkan / Putuskan)
export function context(me) {
  if (me && auth.enforced()) return { accountId: me.id, ws: auth.activeWs(me), me };
  return { accountId: 'local', ws: 'main', me: null };
}
export function startLink({ service, me }) {
  if (!st.SERVICES.includes(service)) throw Object.assign(new Error('Layanan itu belum tersedia.'), { code: 400 });
  if (!st.hasToken(service) || !st.isEnabled(service)) throw Object.assign(new Error(`${st.LABEL[service]} belum disiapkan oleh pemilik platform. Minta pemiliknya memasang bot ${st.LABEL[service]} dulu.`), { code: 409 });
  const cx = context(me);
  if (me && suspended(me, auth.memberOf(me, cx.ws))) throw Object.assign(new Error(TXT.suspended), { code: 403 });
  const r = limits.hit(`ch:mk:${cx.accountId}:${service}`, { limit: num('CHANNEL_CODES_PER_HOUR', 6), windowMs: 3600e3 });
  if (!r.ok) throw new limits.LimitError('Terlalu sering membuat kode. Coba lagi nanti.', r.retryAfter);
  const { code, exp } = st.issueCode({ service, accountId: cx.accountId, ws: cx.ws });
  return { code, expiresAt: exp, minutes: Math.round(st.TTL_MS / 60e3) };
}
export function unlinkFor({ service, me }) {
  const cx = context(me); const mine = st.linksOf(cx.ws, cx.accountId).filter((l) => l.service === service);
  let n = 0; for (const l of mine) if (st.removeLink(l.service, l.ext)) { n++; bump(`${l.service}:${l.chat}`); }
  return { ok: true, diputus: n };
}
export const linkedFor = ({ service, me }) => { const cx = context(me); return st.linksOf(cx.ws, cx.accountId).find((l) => l.service === service) || null; };

/** kabar dari otomasi ke saluran yang tertaut milik pengguna ini (di ruang kerja ini). Mengembalikan jumlah yang terkirim. */
export async function pushNews({ ws, employeeId, text }) {
  let n = 0;
  for (const l of st.allLinks().filter((x) => x.ws === ws)) {
    const ad = adapters[l.service]; if (!ad || st.isBlocked(l.service, l.ext)) continue;
    const acc = resolve(l); if (acc.error || acc.employeeId !== employeeId) continue;
    try { await ad.send(l.chat, { text: `Kabar dari RAIVERSE\n${clip(text, 1500)}` }); n++; } catch (err) { log('kabar tidak terkirim:', err); }
  }
  return n;
}
