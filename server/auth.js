// Google sign-in (OpenID Connect, authorization-code flow with PKCE), sessions, roles and per-user Google tokens.
// Auth data lives in data/auth.json, NEVER in the main db: the main db is streamed to every browser.
// Refresh/access tokens are encrypted at rest (AES-256-GCM, key from TOKEN_ENC_KEY). Session ids are stored hashed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
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

let A = { users: [], sessions: [], workspaces: [] };
let saveTimer = null;
const states = new Map();   // login attempts in flight: state -> { verifier, t }

export function load() {
  try { A = { users: [], sessions: [], workspaces: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { /* first run */ }
  A.sessions = A.sessions.filter((s) => s.expires > Date.now());
  // accounts from the earlier single-company version: the old Owner owns the original office, approved members join it
  if (!A.workspaces.length && A.users.some((u) => u.role === 'owner')) {
    const o = A.users.find((u) => u.role === 'owner');
    A.workspaces.push({ id: 'main', name: 'Kantor utama', ownerId: o.id, invites: [], createdAt: Date.now(), members: A.users.filter((u) => u.role === 'owner' || u.role === 'member').map((u) => ({ userId: u.id, role: u.role === 'owner' ? 'owner' : 'member', employeeId: u.employeeId || (u.role === 'owner' ? 'owner' : null), joinedAt: Date.now() })) });
    for (const u of A.users) { if (u.role === 'owner') u.personalWs = 'main'; if (u.role === 'owner' || u.role === 'member') u.currentWs = 'main'; delete u.role; delete u.employeeId; }
    saveNow();
  }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(A, null, 1), { mode: 0o600 }); }, 200);
}
export const saveNow = () => { clearTimeout(saveTimer); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(A, null, 1), { mode: 0o600 }); };

export const configured = () => !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('SESSION_SECRET') && env('TOKEN_ENC_KEY'));
/** login becomes mandatory the moment the first person has signed in; before that the app stays open so nobody is locked out by setup */
export const enforced = () => configured() && !env('AUTH_DISABLED') && A.users.length > 0;

// ── crypto helpers
const key = () => crypto.createHash('sha256').update(env('TOKEN_ENC_KEY')).digest();
export function enc(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}
export function dec(blob) {
  if (!blob) return '';
  const [iv, tag, ct] = String(blob).split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
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
export const userById = (id) => A.users.find((u) => u.id === id);
export const users = () => A.users.map(safeUser);
export function sessionUser(req) {
  const sid = unsign(cookies(req).rs);
  if (!sid) return null;
  const s = A.sessions.find((x) => x.id === sha(sid) && x.expires > Date.now());
  return s ? userById(s.userId) : null;
}
// ── workspaces (like Discord servers): every person owns a personal one and can be invited into others
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
export const wsById = (id) => A.workspaces.find((w) => w.id === id);
export const memberOf = (u, wsId) => (u && wsById(wsId)?.members.find((m) => m.userId === u.id)) || null;
/** the workspace a signed-in person is looking at (falls back to their personal one if they were removed) */
export function activeWs(u) { if (!u) return 'main'; return memberOf(u, u.currentWs) ? u.currentWs : u.personalWs || 'main'; }
export const mainClaimed = () => !!wsById('main');
export function myWorkspaces(u) {
  return A.workspaces.filter((w) => w.members.some((m) => m.userId === u.id)).map((w) => ({ id: w.id, name: w.name, role: memberOf(u, w.id).role, personal: w.id === u.personalWs, members: w.members.length, ownerName: userById(w.ownerId)?.name || '' }));
}
export function switchWs(u, wsId) { if (!memberOf(u, wsId)) throw bad('Anda bukan anggota ruang kerja itu', 403); u.currentWs = wsId; saveNow(); return wsId; }
export function wsMembers(wsId) { return (wsById(wsId)?.members || []).map((m) => ({ userId: m.userId, role: m.role, employeeId: m.employeeId, name: userById(m.userId)?.name, email: userById(m.userId)?.email, picture: userById(m.userId)?.picture })); }
const canManage = (u, wsId) => ['owner', 'admin'].includes(memberOf(u, wsId)?.role);
export function renameWs(u, wsId, name) { if (memberOf(u, wsId)?.role !== 'owner') throw bad('Hanya Owner ruang kerja', 403); const w = wsById(wsId); w.name = String(name || '').trim().slice(0, 60) || w.name; saveNow(); return w.name; }
/** an invite link (7 days). Owners and admins can invite. */
export function createInvite(u, wsId, role = 'member') {
  if (!canManage(u, wsId)) throw bad('Hanya Owner/Admin yang bisa mengundang', 403);
  if (!['member', 'admin'].includes(role)) role = 'member';
  if (role === 'admin' && memberOf(u, wsId).role !== 'owner') role = 'member';
  const w = wsById(wsId), code = rand(12);
  w.invites = [...(w.invites || []).filter((i) => i.exp > Date.now()), { code, role, by: u.id, exp: Date.now() + 7 * 864e5 }];
  saveNow(); return { code, role, exp: Date.now() + 7 * 864e5 };
}
export function join(u, code, hooks = {}) {
  const w = A.workspaces.find((x) => (x.invites || []).some((i) => i.code === code && i.exp > Date.now()));
  if (!w) throw bad('Link undangan tidak berlaku atau sudah kedaluwarsa', 404);
  if (!memberOf(u, w.id)) {
    const inv = w.invites.find((i) => i.code === code);
    const employeeId = hooks.joinWorkspace ? hooks.joinWorkspace(w.id, u) : null;
    w.members.push({ userId: u.id, role: inv.role, employeeId, joinedAt: Date.now() });
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
  states.set(state, { verifier, t: Date.now(), redirect: redirectUri(req) });
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
    if (!u) { u = { id: 'u-' + rand(9), sub: info.sub, email, createdAt: Date.now() }; A.users.push(u); }
    Object.assign(u, { email, name: info.name || email, picture: info.picture || '', lastLoginAt: Date.now() });
    // everyone owns a personal workspace. The very first person claims the original office ("main"); everybody else gets a fresh one.
    if (!u.personalWs || !wsById(u.personalWs)) {
      if (!mainClaimed()) {
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
export function setDrive(userId, drive) { const u = userById(userId); if (u) { u.drive = { ...(u.drive || {}), ...drive }; save(); } return u?.drive; }
export const driveOf = (userId) => userById(userId)?.drive || null;
