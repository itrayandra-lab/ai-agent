// Fungsi untuk konsol admin: atur token bot, uji koneksi, status online, jumlah tautan, blokir/lepas akun luar.
// Dipanggil dari rute /api/channels/admin/* (server/channels/index.js). Titik sambung layar: docs/SALURAN-CHAT.md.
// Token tidak pernah dikembalikan dalam bentuk utuh: hanya "••••abcd".
import * as st from './state.js';
import * as tg from './telegram.js';
import * as dc from './discord.js';

const err = (msg, code = 400) => Object.assign(new Error(msg), { code });
const MOD = { telegram: tg, discord: dc };
const FORMAT = { telegram: 'Kode bot Telegram bentuknya angka, titik dua, lalu huruf (contoh: 123456789:AAxxxx). Salin dari BotFather.', discord: 'Kode bot Discord terdiri dari tiga bagian dipisah titik. Salin dari halaman Bot di Developer Portal.' };
let manager = null;
/** diisi oleh server/channels/index.js */
export const attach = (m) => { manager = m; };
const svc = (s) => { if (!st.SERVICES.includes(s)) throw err('Layanan itu tidak dikenal.'); return s; };

export function status() {
  const out = {};
  for (const s of st.SERVICES) {
    const live = manager?.adapter(s)?.status?.() || {};
    out[s] = { label: st.LABEL[s], configured: st.hasToken(s), enabled: st.isEnabled(s), tokenSource: st.tokenSource(s), tokenMask: st.maskToken(s), online: !!live.online, mode: live.mode || '', bot: live.bot || '', error: live.error || '', links: st.countLinks(s), blocked: Object.keys(st.read().blocked).filter((k) => k.startsWith(s + ':')).length };
  }
  return { services: out, codesActive: st.activeCodes(), publicUrl: /^https:\/\//i.test(process.env.RAIVERSE_PUBLIC_URL || '') };
}

/** uji koneksi. Dengan `token`: uji kode baru tanpa menyimpannya. Tanpa: uji kode yang tersimpan. */
export async function testConnection(service, token) {
  svc(service); const t = String(token || '').trim() || st.getToken(service);
  if (!t) throw err(`${st.LABEL[service]} belum diberi kode bot.`);
  if (!MOD[service].validToken(t)) throw err(FORMAT[service]);
  try { const r = await MOD[service].test(t); return { ok: true, bot: r.name }; }
  catch (e) { throw err(e.code === 401 || e.code === 404 ? 'Kode bot ditolak oleh layanan. Periksa lagi salinannya.' : `Belum bisa menghubungi ${st.LABEL[service]} (${st.scrub(e.message)}).`, 422); }
}
/** simpan token (terenkripsi) setelah lolos uji, lalu nyalakan penghubungnya */
export async function setToken(service, token, { skipTest = false } = {}) {
  svc(service); const t = String(token || '').trim();
  if (!MOD[service].validToken(t)) throw err(FORMAT[service]);
  if (!skipTest) await testConnection(service, t);
  st.setToken(service, t);
  await manager?.restart(service);
  return status().services[service];
}
export async function removeToken(service) { svc(service); st.clearToken(service); await manager?.restart(service); return status().services[service]; }

export function listLinks(service) {
  return st.allLinks().filter((l) => !service || l.service === service).map((l) => ({ service: l.service, ext: String(l.ext).slice(0, 3) + '•••' + String(l.ext).slice(-2), ws: l.ws, accountId: l.accountId, since: l.at, blocked: st.isBlocked(l.service, l.ext), ref: `${l.service}:${l.ext}` }));
}
/** blokir atau buka blokir akun luar (ref dari listLinks). Akun diblokir tidak dilayani sama sekali. */
export function setBlocked(ref, blocked = true) {
  const [service, ...rest] = String(ref).split(':'); const ext = rest.join(':'); svc(service);
  st.update((s) => { if (blocked) s.blocked[`${service}:${ext}`] = Date.now(); else delete s.blocked[`${service}:${ext}`]; });
  return { ok: true };
}
export const unlinkAccount = (ref) => { const [service, ...rest] = String(ref).split(':'); return { ok: st.removeLink(svc(service), rest.join(':')) }; };
/** nyalakan/matikan penghubung (bawaan mati). Menyala hanya bila token juga ada (dari konsol atau env). */
export async function setEnabled(service, on) { svc(service); st.setEnabled(service, on === true); await manager?.restart(service); return status().services[service]; }
