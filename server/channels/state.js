// Penyimpanan saluran chat (Telegram, Discord): data/channels.json, ditulis atomik di bawah kunci berkas, mode 0600.
// Isi: token bot (amplop terenkripsi lewat secure.js), ikatan akun luar -> (ruang kerja, pengguna), kode tautan (HANYA hash),
// offset Telegram, daftar pesan yang sudah diproses (supaya tidak ganda), daftar akun luar yang diblokir.
import * as config from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import * as secure from '../secure.js';

export const SERVICES = ['telegram', 'discord'];
export const LABEL = { telegram: 'Telegram', discord: 'Discord' };
const file = () => path.join(config.dataDir(), 'channels.json');
const fill = (s) => { s.tokens ||= {}; s.secrets ||= {}; s.links ||= {}; s.codes ||= []; s.offsets ||= {}; s.blocked ||= {}; s.seen ||= {}; return s; };

export function read() { let j = {}; try { j = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { /* belum ada */ } return fill(j); }
/** baca-ubah-tulis atomik. Mengembalikan nilai yang dikembalikan `fn`. */
export function update(fn) {
  let out;
  secure.updateJson(file(), () => fill({}), (s) => { fill(s); out = fn(s); return s; }, { mode: 0o600 });
  return out;
}

// ── token bot milik platform (satu bot per layanan)
// Urutan: token dari konsol admin (terenkripsi) lebih dulu, lalu variabel lingkungan (TELEGRAM_BOT_TOKEN / DISCORD_BOT_TOKEN) sebagai cadangan.
const ENV_KEY = { telegram: 'TELEGRAM_BOT_TOKEN', discord: 'DISCORD_BOT_TOKEN' };
const envToken = (service) => String(process.env[ENV_KEY[service]] || '').trim();
export const tokenSource = (service) => (read().tokens[service] ? 'konsol' : envToken(service) ? 'env' : '');
export const hasToken = (service) => !!tokenSource(service);
export function getToken(service) { const b = read().tokens[service]; if (b) { try { return secure.open(b, 'channel-token'); } catch { return ''; } } return envToken(service); }
export const maskToken = (service) => (read().tokens[service] ? secure.mask(read().tokens[service]) : envToken(service) ? '••••' + envToken(service).slice(-4) : '');
/** bendera nyala/mati per layanan. BAWAANNYA MATI: penghubung tidak mengambil pesan (getUpdates/Gateway) sampai dinyalakan di konsol admin. */
export const isEnabled = (service) => read().flags?.[service] === true;
export const setEnabled = (service, on) => update((s) => { (s.flags ||= {})[service] = !!on; });
export const setToken = (service, token) => update((s) => { s.tokens[service] = secure.seal(String(token).trim(), 'channel-token'); });
export const clearToken = (service) => update((s) => { delete s.tokens[service]; });
/** rahasia webhook Telegram (dibuat sekali, disimpan terenkripsi) */
export function webhookSecret() {
  const cur = read().secrets.telegramHook;
  if (cur) { try { return secure.open(cur, 'channel-secret'); } catch { /* buat baru */ } }
  const v = secure.rand(24); update((s) => { s.secrets.telegramHook = secure.seal(v, 'channel-secret'); }); return v;
}

// ── ikatan
export const linkKey = (service, ext) => `${service}:${ext}`;
export const getLink = (service, ext) => read().links[linkKey(service, ext)] || null;
export const allLinks = () => Object.values(read().links);
export const linksOf = (ws, accountId) => allLinks().filter((l) => l.ws === ws && l.accountId === accountId);
export const countLinks = (service) => allLinks().filter((l) => l.service === service).length;
export const removeLink = (service, ext) => update((s) => { const k = linkKey(service, ext); const had = !!s.links[k]; delete s.links[k]; return had; });
export const isBlocked = (service, ext) => !!read().blocked[linkKey(service, ext)];

// ── kode tautan sekali pakai. Yang disimpan hanya hash; teks kodenya cuma tampil sekali ke pengguna.
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`^[${ALPHA}]{8}$`);
export const TTL_MS = 10 * 60e3;
export const codeHash = (service, code) => secure.hmacHex(secure.derive('channel-link-code'), `${service}:${normCode(code)}`);
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function newCode() { const b = secure.rand(8); let out = ''; for (let i = 0; i < 8; i++) out += ALPHA[parseInt(b.slice(i * 2, i * 2 + 2), 16) % ALPHA.length]; return out; }
export function issueCode({ service, accountId, ws }) {
  const code = newCode(), exp = Date.now() + TTL_MS;
  update((s) => { s.codes = s.codes.filter((c) => c.exp > Date.now() && !(c.service === service && c.accountId === accountId && c.ws === ws)); s.codes.push({ h: codeHash(service, code), service, accountId, ws, exp }); });
  return { code, exp };
}
/** menukar kode. Mengembalikan entri (dan menghapusnya) atau null. `keep` = jangan hapus (dipakai saat penautan ditolak). */
export function takeCode(service, code, { keep = false } = {}) {
  if (!CODE_RE.test(normCode(code))) return null;
  const h = codeHash(service, code);
  return update((s) => {
    s.codes = s.codes.filter((c) => c.exp > Date.now());
    const i = s.codes.findIndex((c) => c.service === service && secure.safeEqual(c.h, h));
    if (i < 0) return null;
    const [e] = keep ? [s.codes[i]] : s.codes.splice(i, 1); return e;
  });
}
export const activeCodes = () => read().codes.filter((c) => c.exp > Date.now()).length;

// ── offset Telegram dan penanda pesan yang sudah diproses
export const getOffset = (service) => Number(read().offsets[service]) || 0;
export const setOffset = (service, n) => update((s) => { s.offsets[service] = n; });
/** true bila id ini baru; false bila pernah diproses (restart, pengiriman ulang, webhook ganda) */
export function firstTime(service, id) {
  if (id === undefined || id === null || id === '') return true;
  return update((s) => { const a = (s.seen[service] ||= []); if (a.includes(String(id))) return false; a.push(String(id)); if (a.length > 300) a.splice(0, a.length - 300); return true; });
}

/** hapus teks rahasia dari kalimat sebelum masuk log atau layar */
export function scrub(text) {
  let t = String(text ?? '');
  for (const sv of SERVICES) { const tk = getToken(sv); if (tk && tk.length > 8) t = t.split(tk).join('••••'); }
  return t.replace(/\b\d{6,12}:[\w-]{25,}\b/g, '••••').replace(/\b(Bot|Bearer)\s+[\w.-]{20,}/g, '$1 ••••').replace(/\/bot[^/\s]{10,}\//g, '/bot••••/');
}
