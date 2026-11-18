// Saluran chat RAIVERSE: Telegram dan Discord. Dokumen: docs/SALURAN-CHAT.md.
// Titik sambung di server/index.js: channels.start() saat boot, channels.handleHook(...) untuk webhook Telegram, dan routes.
import * as st from './state.js';
import * as core from './core.js';
import * as admin from './admin-api.js';
import * as tg from './telegram.js';
import * as dc from './discord.js';
import * as auth from '../auth.js';

const A = { telegram: tg.create(), discord: dc.create() };
for (const a of Object.values(A)) core.registerAdapter(a);
const runnable = (s) => st.hasToken(s) && st.isEnabled(s);
const manager = { adapter: (s) => A[s], restart: (s) => (runnable(s) ? A[s].start() : (A[s].stop(), Promise.resolve(A[s].status()))) };
admin.attach(manager);

/** nyalakan penghubung yang tokennya sudah ada. Aman dipanggil berulang. Tidak pernah membuat server gagal naik. */
export function start() {
  for (const s of st.SERVICES) if (runnable(s)) A[s].start().catch((e) => core.log(`${st.LABEL[s]}: gagal mulai:`, e));
}
export function stop() { for (const a of Object.values(A)) a.stop(); }
export const pushNews = core.pushNews;
export { admin };

/** webhook Telegram (hanya dipakai bila RAIVERSE_PUBLIC_URL https): rahasia di header dicek, tanpa sesi login */
export async function handleHook(req, res, url, body) {
  if (url.pathname !== '/api/saluran/hook/telegram' || req.method !== 'POST') return false;
  const done = (code) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end('{}'); return true; };
  let b; try { b = await body(req); } catch { return done(400); }
  return done(A.telegram.webhook(req.headers, b) ? 200 : 403);
}

// ── rute. Bentuk sama dengan modul lain: [metode, pola, fn(b, params, url, me, member)]
const need = (me) => { if (!auth.isPlatformAdmin(me)) throw Object.assign(new Error('Hanya pemilik platform yang boleh mengatur bot chat.'), { code: 403 }); };
const INSTR = {
  telegram: (bot) => [`Buka Telegram dan cari ${bot || 'bot RAIVERSE'}.`, 'Tekan Start, lalu kirim kode di bawah ini ke bot.'],
  discord: (bot) => [`Di Discord, kirim pesan pribadi (DM) ke ${bot || 'bot RAIVERSE'}.`, 'Isi pesannya dengan kode di bawah ini.'],
};
export const routes = [
  ['GET', '/api/saluran', (b, p, u, me) => ({
    services: st.SERVICES.map((s) => {
      const live = A[s].status(), mine = core.linkedFor({ service: s, me });
      return { id: s, label: st.LABEL[s], available: runnable(s) && !live.error, online: live.online, bot: live.bot, linked: !!mine, since: mine?.at || null, note: !runnable(s) ? `${st.LABEL[s]} belum disiapkan oleh pemilik platform.` : live.error ? `${st.LABEL[s]} sedang bermasalah. Coba lagi nanti.` : '' };
    }),
  })],
  ['POST', '/api/saluran/link', (b, p, u, me) => {
    const s = String(b.service || ''); const r = core.startLink({ service: s, me });
    return { ...r, service: s, label: st.LABEL[s], bot: A[s].status().bot, langkah: INSTR[s](A[s].status().bot) };
  }],
  ['POST', '/api/saluran/unlink', (b, p, u, me) => core.unlinkFor({ service: String(b.service || ''), me })],
  // pengelola platform
  ['GET', '/api/saluran/admin/status', (b, p, u, me) => { need(me); return admin.status(); }],
  ['POST', '/api/saluran/admin/token', async (b, p, u, me) => { need(me); return admin.setToken(String(b.service || ''), b.token); }],
  ['POST', '/api/saluran/admin/test', async (b, p, u, me) => { need(me); return admin.testConnection(String(b.service || ''), b.token); }],
  ['POST', '/api/saluran/admin/enable', async (b, p, u, me) => { need(me); return admin.setEnabled(String(b.service || ''), b.enabled === true); }],
  ['POST', '/api/saluran/admin/remove', async (b, p, u, me) => { need(me); return admin.removeToken(String(b.service || '')); }],
  ['GET', '/api/saluran/admin/links', (b, p, u, me) => { need(me); return { links: admin.listLinks(u.searchParams.get('service') || '') }; }],
  ['POST', '/api/saluran/admin/block', (b, p, u, me) => { need(me); return admin.setBlocked(String(b.ref || ''), b.blocked !== false); }],
  ['POST', '/api/saluran/admin/unlink', (b, p, u, me) => { need(me); return admin.unlinkAccount(String(b.ref || '')); }],
];
