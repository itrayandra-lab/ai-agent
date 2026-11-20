// Google sign-in (OpenID Connect, authorization-code flow with PKCE), sessions, roles and per-user Google tokens.
// Auth data lives in data/auth.json, NEVER in the main db: the main db is streamed to every browser.
// Refresh/access tokens are encrypted at rest (AES-256-GCM, key from TOKEN_ENC_KEY). Session ids are stored hashed.
import * as config from '../config.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as vault from './secure.js';
import * as limits from './limits.js';

const DATA_DIR = config.dataDir();
const FILE = path.join(DATA_DIR, 'auth.json');
const env = (k) => process.env[k] || '';
// endpoints are overridable so tests can run against a fake Google; production uses the real ones
const G = () => ({
  auth: env('GOOGLE_AUTH_URL') || 'https://accounts.google.com/o/oauth2/v2/auth',
  token: env('GOOGLE_TOKEN_URL') || 'https://oauth2.googleapis.com/token',
  userinfo: env('GOOGLE_USERINFO_URL') || 'https://openidconnect.googleapis.com/v1/userinfo',
  revoke: env('GOOGLE_REVOKE_URL') || 'https://oauth2.googleapis.com/revoke',
});
/** only non-sensitive scopes: login + files this app creates or the user picks. Nothing else is ever requested. */
export const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'];
const SESSION_DAYS = 30;

let A = { users: [], sessions: [], workspaces: [], deleted: [] };
let saveTimer = null;
const states = new Map();   // login attempts in flight: state -> { verifier, t }

export function load() {
  try { A = { users: [], sessions: [], workspaces: [], deleted: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { /* first run */ }
  A.sessions = A.sessions.filter((s) => s.expires > Date.now());
  // accounts from the earlier single-company version: the old Owner owns the original office, approved members join it
  if (!A.workspaces.length && A.users.some((u) => u.role === 'owner')) {
    const o = A.users.find((u) => u.role === 'owner');
    A.workspaces.push({ id: 'main', name: 'Kantor utama', ownerId: o.id, invites: [], createdAt: Date.now(), members: A.users.filter((u) => u.role === 'owner' || u.role === 'member').map((u) => ({ userId: u.id, role: u.role === 'owner' ? 'owner' : 'member', employeeId: u.employeeId || (u.role === 'owner' ? 'owner' : null), joinedAt: Date.now() })) });
    for (const u of A.users) { if (u.role === 'owner') u.personalWs = 'main'; if (u.role === 'owner' || u.role === 'member') u.currentWs = 'main'; delete u.role; delete u.employeeId; }
    saveNow();
  }
}
// auth.json: ditulis atomik (berkas sementara + rename) di bawah kunci berkas, sehingga proses mati di tengah atau dua penulis tidak merusak berkas
const write = () => vault.withLock(FILE, () => vault.writeAtomic(FILE, JSON.stringify(A, null, 1), { mode: 0o600 }));
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(write, 200); saveTimer.unref?.(); }
export const saveNow = () => { clearTimeout(saveTimer); write(); };

export const configured = () => !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('SESSION_SECRET') && env('TOKEN_ENC_KEY'));
/** (P3) Siapa yang boleh mengklaim kantor utama "main" di server yang belum punya pemilik:
 *  1) RAIVERSE_ADMIN_EMAILS (daftar email, dipisah koma) = pra-klaim: hanya email itu;
 *  2) RAIVERSE_CLAIM_CODE (atau kode acak sekali pakai yang dicetak di konsol server saat mode publik) = pemilik server membuka /auth/google?claim=KODE;
 *  3) tanpa keduanya dan bukan mode publik: pengguna pertama, tetapi HANYA bila login dilakukan dari komputer server itu sendiri (bukan lewat internet).
 *  Pemilik yang sudah terikat (kantor "main" sudah ada di auth.json) tidak terpengaruh sama sekali. */
let generatedClaim = '';
export function claimCode() {
  if (env('RAIVERSE_CLAIM_CODE')) return env('RAIVERSE_CLAIM_CODE');
  if (!generatedClaim && limits.publicMode() && !env('RAIVERSE_ADMIN_EMAILS')) generatedClaim = crypto.randomBytes(9).toString('base64url');
  return generatedClaim;
}
/** dipanggil sekali saat boot: bila kantor utama belum diklaim dan perlu kode, cetak kodenya (hanya terlihat oleh pemilik server) */
export function announceClaim() { if (!mainClaimed() && configured() && !env('RAIVERSE_ADMIN_EMAILS')) { const c = claimCode(); if (c && !env('RAIVERSE_CLAIM_CODE')) console.log(`  Kantor utama belum diklaim. Buka /auth/google?claim=${c} sekali untuk menjadi Owner.`); } }
export function mayClaimMain(req, email, claim) {
  const admins = env('RAIVERSE_ADMIN_EMAILS').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (admins.length) return admins.includes(String(email).toLowerCase());
  const code = claimCode();
  if (code) return !!claim && vault.safeEqual(claim, code);
  return limits.isLocalDirect(req);
}
/** login becomes mandatory the moment the first person has signed in; before that the app stays open so nobody is locked out by setup */
export const enforced = () => configured() && !env('AUTH_DISABLED') && A.users.length > 0;

// ── crypto helpers
// token Google disimpan sebagai amplop berversi (vault.seal). Format lama tanpa versi (sha256 TOKEN_ENC_KEY) tetap terbaca; yang ditulis ulang selalu format baru.
export const enc = (text) => vault.seal(text, 'drive-token');
export const dec = (blob) => vault.open(blob, 'drive-token', { legacy: 'auth' });
/** tulis ulang semua token dengan kunci sekarang (rotasi kunci). Mengembalikan jumlah yang diperbarui. */
export function rotateTokens() { let n = 0; for (const u of A.users) for (const k of ['refresh', 'access']) if (u[k] && vault.needsReseal(u[k])) { try { u[k] = vault.seal(dec(u[k]), 'drive-token'); n++; } catch { delete u[k]; } } if (n) saveNow(); return n; }
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('base64url');
const rand = (n = 32) => crypto.randomBytes(n).toString('base64url');
const sign = (v) => `${v}.${crypto.createHmac('sha256', env('SESSION_SECRET')).update(v).digest('base64url')}`;
const unsign = (s) => { const i = String(s || '').lastIndexOf('.'); if (i < 1) return null; const v = s.slice(0, i); const a = Buffer.from(sign(v)), b = Buffer.from(s); return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null; };

// ── cookies
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const secure = (req) => req.headers['x-forwarded-proto'] === 'https' || /^https:/.test(env('GOOGLE_REDIRECT_URI'));
const setCookie = (req, name, value, maxAge) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`;

/** redirect URI for this request: the configured one, or the matching origin when the app is opened from another registered host (e.g. raymaizing.com) */
function redirectUri(req) {
  const list = [env('GOOGLE_REDIRECT_URI'), ...env('GOOGLE_REDIRECT_URIS').split(',')].map((s) => s.trim()).filter(Boolean);
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  return list.find((u) => { try { return new URL(u).host === host; } catch { return false; } }) || list[0];
}

// ── users & sessions
const safeUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, picture: u.picture, personalWs: u.personalWs, currentWs: activeWs(u), drive: !!u.refresh, scopes: u.scopes || [], driveFolders: u.drive?.folders ? Object.keys(u.drive.folders) : [], createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });
export const publicUser = safeUser;
// P7: indeks id → data (O(1) alih-alih menyisir larik tiap permintaan). Dibangun ulang otomatis bila larik diganti atau panjangnya berubah.
const idx = { users: null, uRef: null, uLen: -1, sess: null, sRef: null, sLen: -1 };
const userIndex = () => { if (idx.uRef !== A.users || idx.uLen !== A.users.length) { idx.users = new Map(A.users.map((u) => [u.id, u])); idx.uRef = A.users; idx.uLen = A.users.length; } return idx.users; };
const sessionIndex = () => { if (idx.sRef !== A.sessions || idx.sLen !== A.sessions.length) { idx.sess = new Map(A.sessions.map((x) => [x.id, x])); idx.sRef = A.sessions; idx.sLen = A.sessions.length; } return idx.sess; };
export const userById = (id) => { const u = userIndex().get(id); return u && u.id === id ? u : A.users.find((x) => x.id === id); };
export const users = () => A.users.map(safeUser);
export function sessionUser(req) {
  const sid = unsign(cookies(req).rs);
  if (!sid) return null;
  const s = sessionIndex().get(sha(sid));
  const u = s && s.expires > Date.now() ? userById(s.userId) : null;
  return u && !u.suspended ? u : null;   // akun yang ditangguhkan pengelola tidak punya sesi
}
// ── workspaces (like Discord servers): every person owns a personal one and can be invited into others
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
export const wsById = (id) => A.workspaces.find((w) => w.id === id);
export const memberOf = (u, wsId) => (u && wsById(wsId)?.members.find((m) => m.userId === u.id)) || null;
/** the workspace a signed-in person is looking at (falls back to their personal one if they were removed) */
export function activeWs(u) { if (!u) return 'main'; return memberOf(u, u.currentWs) ? u.currentWs : u.personalWs || 'main'; }
export const mainClaimed = () => !!wsById('main');
/** pemilik platform = Owner kantor utama ("main"); sebelum ada yang login, pengguna lokal tunggal dianggap admin */
export const isPlatformAdmin = (u) => (u ? wsById('main')?.ownerId === u.id : !enforced());
/** Izin eksplisit untuk anggota biasa pada rute berdampak. Owner dan Admin selalu boleh; anggota hanya bila Owner memberinya izin itu. */
export const PERMS = { hire: 'merekrut atau mengubah karyawan', taskDelete: 'menghapus tugas', approve: 'memutuskan persetujuan', routine: 'mengatur rutinitas' };
export const can = (member, perm) => !enforced() || ['owner', 'admin'].includes(member?.role) || (Array.isArray(member?.perms) && member.perms.includes(perm));
export function setMemberPerms(u, wsId, userId, perms) {
  if (!canManage(u, wsId)) throw bad('Hanya Owner/Admin yang bisa mengatur izin', 403);
  const m = wsById(wsId)?.members.find((x) => x.userId === userId); if (!m) throw bad('Anggota tidak ada', 404);
  if (m.role !== 'member') throw bad('Izin khusus hanya untuk anggota biasa', 400);
  m.perms = [...new Set((Array.isArray(perms) ? perms : []).filter((p) => p in PERMS))]; saveNow(); return m.perms;
}
export function myWorkspaces(u) {
  return A.workspaces.filter((w) => w.members.some((m) => m.userId === u.id)).map((w) => ({ id: w.id, name: w.name, role: memberOf(u, w.id).role, personal: w.id === u.personalWs, members: w.members.length, ownerName: userById(w.ownerId)?.name || '' }));
}
export function switchWs(u, wsId) { if (!memberOf(u, wsId)) throw bad('Anda bukan anggota ruang kerja itu', 403); u.currentWs = wsId; saveNow(); return wsId; }
export function wsMembers(wsId) { return (wsById(wsId)?.members || []).map((m) => ({ userId: m.userId, role: m.role, perms: m.perms || [], employeeId: m.employeeId, name: userById(m.userId)?.name, email: userById(m.userId)?.email, picture: userById(m.userId)?.picture })); }
const canManage = (u, wsId) => ['owner', 'admin'].includes(memberOf(u, wsId)?.role);
export function renameWs(u, wsId, name) { if (memberOf(u, wsId)?.role !== 'owner') throw bad('Hanya Owner ruang kerja', 403); const w = wsById(wsId); w.name = String(name || '').trim().slice(0, 60) || w.name; saveNow(); return w.name; }
/** an invite link (7 days, default 10 uses). Owners and admins can invite. Only a hash of the code is stored; the code is shown once. Revocable. */
export function createInvite(u, wsId, role = 'member', { maxUses = Number(env('INVITE_MAX_USES')) || 10, days = 7 } = {}) {
  if (!canManage(u, wsId)) throw bad('Hanya Owner/Admin yang bisa mengundang', 403);
  if (!['member', 'admin'].includes(role)) role = 'member';
  if (role === 'admin' && memberOf(u, wsId).role !== 'owner') role = 'member';
  const w = wsById(wsId), code = rand(12), exp = Date.now() + Math.min(30, Math.max(1, days)) * 864e5;
  const open = (w.invites || []).filter((i) => i.exp > Date.now() && !i.revoked);
  if (open.length >= 20) throw bad('Terlalu banyak undangan aktif. Cabut yang tidak dipakai dulu.', 429);
  w.invites = [...open, { id: rand(5), hash: sha(code), role, by: u.id, exp, uses: 0, maxUses: Math.min(100, Math.max(1, Math.floor(maxUses))) }];
  saveNow(); return { code, id: w.invites.at(-1).id, role, exp, maxUses: w.invites.at(-1).maxUses };
}
const inviteMatches = (i, code) => (i.hash ? vault.safeEqual(i.hash, sha(code)) : typeof i.code === 'string' && vault.safeEqual(i.code, code));   // undangan lama (kode polos) masih diterima sampai kedaluwarsa
const inviteLive = (i) => i.exp > Date.now() && !i.revoked && (i.uses || 0) < (i.maxUses || Infinity);
const inviteId = (i) => i.id || sha(i.code || '').slice(0, 8);
export function listInvites(u, wsId) { if (!canManage(u, wsId)) throw bad('Hanya Owner/Admin', 403); return (wsById(wsId)?.invites || []).filter((i) => i.exp > Date.now()).map((i) => ({ id: inviteId(i), role: i.role, uses: i.uses || 0, maxUses: i.maxUses || null, exp: i.exp, revoked: !!i.revoked })); }
export function revokeInvite(u, wsId, id) {
  if (!canManage(u, wsId)) throw bad('Hanya Owner/Admin yang bisa mencabut undangan', 403);
  const i = (wsById(wsId)?.invites || []).find((x) => inviteId(x) === id); if (!i) throw bad('Undangan tidak ada', 404);
  i.revoked = true; saveNow(); return { id, revoked: true };
}
export function join(u, code, hooks = {}) {
  code = String(code || '').slice(0, 64);
  const w = A.workspaces.find((x) => !x.deletedAt && (x.invites || []).some((i) => inviteMatches(i, code) && inviteLive(i)));
  if (!w) throw bad('Link undangan tidak berlaku, sudah dicabut, habis dipakai, atau kedaluwarsa', 404);
  if (!memberOf(u, w.id)) {
    const inv = w.invites.find((i) => inviteMatches(i, code) && inviteLive(i));
    const employeeId = hooks.joinWorkspace ? hooks.joinWorkspace(w.id, u) : null;
    w.members.push({ userId: u.id, role: inv.role, employeeId, joinedAt: Date.now() });
    inv.uses = (inv.uses || 0) + 1;
  }
  u.currentWs = w.id; saveNow(); return w.id;   // membership changes are written at once (a crash must not lose them)
}
/** owner changes a member's role, or removes them ('remove'). Admins can remove plain members. */
export function setMemberRole(u, wsId, userId, role) {
  const actor = memberOf(u, wsId), w = wsById(wsId), m = w?.members.find((x) => x.userId === userId);
  if (!m) throw bad('Anggota tidak ada', 404);
  if (m.role === 'owner') throw bad('Owner ruang kerja tidak bisa diubah', 403);
  if (role === 'remove') { if (!(actor?.role === 'owner' || (actor?.role === 'admin' && m.role === 'member'))) throw bad('Tidak berwenang', 403); w.members = w.members.filter((x) => x !== m); }
  else { if (actor?.role !== 'owner') throw bad('Hanya Owner yang bisa mengubah peran', 403); if (!['admin', 'member'].includes(role)) throw bad('Peran tidak valid'); m.role = role; }
  saveNow(); return wsMembers(wsId);
}

// ── login flow
export function startLogin(req, res) {
  if (!configured()) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Login Google belum dikonfigurasi (.env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, TOKEN_ENC_KEY).'); }
  for (const [k, v] of states) if (Date.now() - v.t > 600000) states.delete(k);
  const state = rand(24), verifier = rand(48);
  let claim = ''; try { claim = String(new URL(req.url, 'http://x').searchParams.get('claim') || '').slice(0, 80); } catch { /* tanpa kode */ }
  states.set(state, { verifier, t: Date.now(), redirect: redirectUri(req), claim });
  const known = sessionUser(req);
  const q = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri(req), response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', include_granted_scopes: 'true', state,
    prompt: known?.refresh ? 'select_account' : 'consent select_account',   // consent once, so Google issues a refresh token
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  });
  res.writeHead(302, { Location: `${G().auth}?${q}`, 'Set-Cookie': setCookie(req, 'rs_state', sign(state), 600), 'Cache-Control': 'no-store' });
  res.end();
}

async function postForm(url, data) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || `HTTP ${r.status}`), { oauth: j.error, status: r.status });
  return j;
}

/** Google redirects back here. hooks.linkOwner() / hooks.newMember(user) create or link the app's human employee. */
export async function callback(req, res, url, hooks = {}) {
  const fail = (msg) => { res.writeHead(302, { Location: '/?login=' + encodeURIComponent(msg), 'Set-Cookie': setCookie(req, 'rs_state', '', 0) }); res.end(); };
  try {
    if (url.searchParams.get('error')) return fail(url.searchParams.get('error') === 'access_denied' ? 'Izin ditolak' : 'Login dibatalkan');
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    const fromCookie = unsign(cookies(req).rs_state);
    const st = state && states.get(state);
    if (!st || fromCookie !== state) return fail('Sesi login kedaluwarsa, coba lagi');
    states.delete(state);
    const tok = await postForm(G().token, { code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: st.redirect, grant_type: 'authorization_code', code_verifier: st.verifier });
    const ir = await fetch(G().userinfo, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const info = await ir.json();
    if (!ir.ok || !info.sub) return fail('Gagal membaca profil Google');
    if (info.email_verified === false) return fail('Email Google belum terverifikasi');
    const email = String(info.email || '').toLowerCase();
    let u = A.users.find((x) => x.sub === info.sub);
    if (u?.suspended) return fail('Akun ini sedang ditangguhkan. Hubungi pengelola.');
    const needsWs = !u || !u.personalWs || !wsById(u.personalWs);
    const asOwner = needsWs && !mainClaimed() && mayClaimMain(req, email, st.claim);   // (P3) bukan lagi "siapa pun yang pertama"
    if (needsWs && !asOwner) {
      // ruang kerja baru: dibatasi SEBELUM akun dibuat (pendaftaran ditutup / kuota harian / batas seumur hidup per akun Google / per alamat IP)
      if (env('RAIVERSE_SIGNUP') === 'closed' && !unsign(cookies(req).rs_join)) return fail('Pendaftaran akun baru sedang ditutup');
      try {
        limits.lifetime('wscreate:' + info.sub, Number(env('WS_LIFETIME_PER_ACCOUNT')) || 3, 'Akun Google ini sudah terlalu sering membuat ruang kerja.');
        limits.charge('ws_create', { account: info.sub });
        const ipw = limits.hit('wsip:' + limits.clientIp(req), { limit: Number(env('WS_PER_IP_DAY')) || 5, windowMs: 864e5, persist: true });
        if (!ipw.ok) throw new limits.LimitError('Terlalu banyak ruang kerja baru dari alamat ini hari ini.', ipw.retryAfter);
      } catch (err) { if (err instanceof limits.LimitError) return fail(err.message); throw err; }
    }
    if (!u) { u = { id: 'u-' + rand(9), sub: info.sub, email, createdAt: Date.now() }; A.users.push(u); }
    Object.assign(u, { email, name: info.name || email, picture: info.picture || '', lastLoginAt: Date.now() });
    // everyone owns a personal workspace. The person the server owner pre-claimed (or who holds the claim code) takes the original office ("main"); everybody else gets a fresh one.
    if (needsWs) {
      if (asOwner) {
        A.workspaces.push({ id: 'main', name: hooks.mainName ? hooks.mainName() : 'Kantor utama', ownerId: u.id, members: [{ userId: u.id, role: 'owner', employeeId: hooks.linkOwner ? hooks.linkOwner(u) : 'owner', joinedAt: Date.now() }], invites: [], createdAt: Date.now() });
        u.personalWs = 'main';
      } else {
        const id = 'w-' + rand(6).toLowerCase().replace(/[^a-z0-9]/g, 'x');
        const r = hooks.createWorkspace ? hooks.createWorkspace(id, u) : { name: `Ruang kerja ${u.name}`, employeeId: 'owner' };
        A.workspaces.push({ id, name: r.name, ownerId: u.id, members: [{ userId: u.id, role: 'owner', employeeId: r.employeeId, joinedAt: Date.now() }], invites: [], createdAt: Date.now() });
        u.personalWs = id;
      }
      u.currentWs = u.personalWs;
    }
    // came in through an invite link: join that workspace and open it
    const joinCode = unsign(cookies(req).rs_join);
    if (joinCode) { try { join(u, joinCode, hooks); } catch (err) { console.warn('[auth] undangan:', err.message); } }
    if (tok.refresh_token) u.refresh = enc(tok.refresh_token);
    u.access = enc(tok.access_token); u.accessExp = Date.now() + (tok.expires_in || 3600) * 1000;
    u.scopes = String(tok.scope || '').split(' ').filter(Boolean);
    const sid = rand(32);
    A.sessions.push({ id: sha(sid), userId: u.id, created: Date.now(), expires: Date.now() + SESSION_DAYS * 864e5, ua: String(req.headers['user-agent'] || '').slice(0, 120) });
    saveNow();
    res.writeHead(302, { Location: '/', 'Set-Cookie': [setCookie(req, 'rs', sign(sid), SESSION_DAYS * 86400), setCookie(req, 'rs_state', '', 0), setCookie(req, 'rs_join', '', 0)], 'Cache-Control': 'no-store' });
    res.end();
  } catch (err) { console.error('[auth] callback:', err.message); fail('Login gagal: ' + err.message); }
}

/** /join/<code>: signed in → join now; otherwise remember the code and go through Google sign-in first */
export function joinLink(req, res, code, hooks) {
  const u = sessionUser(req);
  if (u) {
    try { join(u, code, hooks); res.writeHead(302, { Location: '/' }); }
    catch (err) { res.writeHead(302, { Location: '/?login=' + encodeURIComponent(err.message) }); }
    return res.end();
  }
  res.writeHead(302, { Location: '/auth/google', 'Set-Cookie': setCookie(req, 'rs_join', sign(String(code).slice(0, 40)), 1800) }); res.end();
}

export function logout(req, res) {
  const sid = unsign(cookies(req).rs);
  if (sid) { A.sessions = A.sessions.filter((s) => s.id !== sha(sid)); save(); }
  res.writeHead(302, { Location: '/', 'Set-Cookie': setCookie(req, 'rs', '', 0) }); res.end();
}

/** a valid access token for this user's Google account (refreshed when needed). Throws with .needLogin when the grant is gone. */
export async function accessToken(userId) {
  const u = userById(userId);
  if (!u) throw new Error('Pengguna tidak ada');
  if (u.access && u.accessExp > Date.now() + 60000) return dec(u.access);
  if (!u.refresh) throw Object.assign(new Error('Google Drive belum tersambung: login ulang dengan Google'), { needLogin: true });
  try {
    const tok = await postForm(G().token, { client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: dec(u.refresh), grant_type: 'refresh_token' });
    u.access = enc(tok.access_token); u.accessExp = Date.now() + (tok.expires_in || 3600) * 1000;
    if (tok.refresh_token) u.refresh = enc(tok.refresh_token);
    save(); return tok.access_token;
  } catch (err) {
    if (err.oauth === 'invalid_grant') { delete u.refresh; delete u.access; save(); throw Object.assign(new Error('Izin Google dicabut atau kedaluwarsa: login ulang dengan Google'), { needLogin: true }); }
    throw err;
  }
}
// ── privasi (P3): ekspor data akun dan hapus akun. Data ruang kerja (karyawan, tugas, pesan) ditangani server/privacy.js lewat store.
/** Semua yang disimpan tentang akun ini di auth.json. Tidak pernah memuat token, hash sesi, atau kode undangan. */
export function exportAccount(u) {
  return {
    akun: { id: u.id, email: u.email, nama: u.name, foto: u.picture, dibuat: u.createdAt, loginTerakhir: u.lastLoginAt, izinGoogle: u.scopes || [], driveTersambung: !!u.refresh, folderDrive: u.drive?.folders ? Object.keys(u.drive.folders) : [] },
    ruangKerja: A.workspaces.filter((w) => w.members.some((m) => m.userId === u.id)).map((w) => { const m = memberOf(u, w.id); return { id: w.id, nama: w.name, peran: m.role, izinKhusus: m.perms || [], bergabung: m.joinedAt, pribadi: w.id === u.personalWs }; }),
    sesiAktif: A.sessions.filter((x) => x.userId === u.id).map((x) => ({ dibuat: x.created, kedaluwarsa: x.expires, perangkat: x.ua })),
  };
}
/** Hapus akun: cabut izin Google (sebaik mungkin), hapus sesi dan keanggotaan, tandai ruang kerja pribadinya terhapus. Kantor utama platform tidak bisa dihapus lewat jalur ini.
 *  Mengembalikan { ownedWs, memberWs, email } agar server/privacy.js membersihkan data ruang kerja. */
export async function deleteAccount(u) {
  if (wsById('main')?.ownerId === u.id) throw bad('Owner kantor utama tidak bisa dihapus lewat sini. Serahkan kepemilikan atau hapus lewat server.', 403);
  const owned = [], member = [];
  for (const w of A.workspaces) {
    const m = w.members.find((x) => x.userId === u.id); if (!m) continue;
    if (w.ownerId === u.id) { owned.push(w.id); w.deletedAt = Date.now(); w.members = []; w.invites = []; A.deleted.push({ id: w.id, at: Date.now() }); }
    else { member.push({ ws: w.id, employeeId: m.employeeId }); w.members = w.members.filter((x) => x !== m); }
  }
  A.workspaces = A.workspaces.filter((w) => !w.deletedAt);
  const tok = u.refresh ? (() => { try { return dec(u.refresh); } catch { return ''; } })() : '';
  const email = u.email;
  A.sessions = A.sessions.filter((x) => x.userId !== u.id);
  A.users = A.users.filter((x) => x.id !== u.id);
  saveNow();
  if (tok) { try { await fetch(G().revoke, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tok }), signal: AbortSignal.timeout(5000) }); } catch { /* izin dicabut sebaik mungkin; token sudah terhapus dari sini */ } }
  return { ownedWs: owned, memberWs: member, email };
}
export const pendingDeletedWs = () => A.deleted.slice();
export function clearDeletedWs(id) { A.deleted = A.deleted.filter((x) => x.id !== id); saveNow(); }
/** tutup semua sesi akun ini (mis. setelah kebocoran) */
export function revokeSessions(u) { const n = A.sessions.filter((x) => x.userId === u.id).length; A.sessions = A.sessions.filter((x) => x.userId !== u.id); saveNow(); return n; }

export function setDrive(userId, drive) { const u = userById(userId); if (u) { u.drive = { ...(u.drive || {}), ...drive }; save(); } return u?.drive; }
export const driveOf = (userId) => userById(userId)?.drive || null;

// ── konsol pengelola (server/admin.js): daftar akun, tangguhkan, sesi. Tidak pernah mengembalikan token, hash sesi penuh, atau kode undangan.
export const adminUsers = () => A.users.map((u) => ({ id: u.id, email: u.email, nama: u.name, dibuat: u.createdAt, masukTerakhir: u.lastLoginAt, ditangguhkan: !!u.suspended, drive: !!u.refresh, utama: wsById('main')?.ownerId === u.id,
  ruangKerja: A.workspaces.filter((w) => w.members.some((m) => m.userId === u.id)).map((w) => ({ id: w.id, peran: w.members.find((m) => m.userId === u.id).role })), sesi: A.sessions.filter((s) => s.userId === u.id).length }));
export const adminWorkspaces = () => A.workspaces.map((w) => ({ id: w.id, nama: w.name, pemilik: userById(w.ownerId)?.email || '', anggota: w.members.length, dibuat: w.createdAt, utama: w.id === 'main' }));
export function setSuspended(id, on) {
  const u = userById(id); if (!u) throw bad('Akun tidak ada', 404);
  if (wsById('main')?.ownerId === u.id) throw bad('Pemilik kantor utama tidak bisa ditangguhkan.', 403);
  u.suspended = !!on; if (on) A.sessions = A.sessions.filter((s) => s.userId !== u.id);   // ditangguhkan = semua sesinya ditutup seketika
  saveNow(); return { id: u.id, ditangguhkan: !!u.suspended };
}
export const adminSessions = () => A.sessions.map((s) => ({ ref: s.id.slice(0, 12), email: userById(s.userId)?.email || '', dibuat: s.created, kedaluwarsa: s.expires, perangkat: s.ua || '' }));
export function revokeSessionRef(ref) {
  ref = String(ref || ''); if (!/^[\w-]{8,24}$/.test(ref)) throw bad('Rujukan sesi tidak valid');
  const hit = A.sessions.filter((s) => s.id.startsWith(ref)); if (hit.length !== 1) throw bad('Sesi tidak ditemukan', 404);
  A.sessions = A.sessions.filter((s) => s !== hit[0]); saveNow(); return { ditutup: 1 };
}
export const revokeUserSessions = (id) => { const u = userById(id); if (!u) throw bad('Akun tidak ada', 404); return { ditutup: revokeSessions(u) }; };
