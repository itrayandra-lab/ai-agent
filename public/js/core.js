// Shared client state, API, realtime sync and UI primitives.
import { esc } from './md.js';
export { esc };

export const S = { data: null, view: 'office', params: {}, me: 'owner' };
const subs = new Set();
export const onChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };
let pending = new Set();
let flushQueued = false;
function notify(coll) {
  pending.add(coll);
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(() => { flushQueued = false; const p = pending; pending = new Set(); for (const fn of subs) fn(p); });
}
const eventSubs = new Set();
export const onEvent = (fn) => { eventSubs.add(fn); return () => eventSubs.delete(fn); };

export async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { toast(data.error || `Error ${res.status}`, 'bad'); throw new Error(data.error || res.status); }
  return data;
}

/** Any colour → the pastel of the same hue (greys stay grey). Running it twice gives the same result. */
export function soften(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return hex;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const sat = d < 0.08 ? 0.06 : 0.5, l = 0.72, c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h % 2) - 1)), q = l - c / 2;
  const [R, G, B] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return '#' + [R, G, B].map((v) => Math.round((v + q) * 255).toString(16).padStart(2, '0')).join('');
}
const softDiv = (d) => { if (d && d.color) d.color = soften(d.color); return d; };

export async function loadState() {
  S.data = await (await fetch('/api/state')).json();
  (S.data.divisions || []).forEach(softDiv);
  S.me = S.data.settings.currentUserId || 'owner';
  notify('*');
}

export function connect(setConn) {
  const es = new EventSource('/api/stream');
  es.onopen = () => setConn(true);
  es.onerror = () => setConn(false);
  es.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const d = S.data;
    if (!d) return;
    if (msg.kind === 'reload') return location.reload();
    if (msg.kind === 'upsert') {
      const arr = d[msg.coll];
      if (msg.coll === 'divisions') softDiv(msg.item);
      const i = arr.findIndex((x) => x.id === msg.item.id);
      if (i >= 0) arr[i] = msg.item; else arr.push(msg.item);
      if (msg.coll === 'events') { if (arr.length > 600) arr.splice(0, arr.length - 600); for (const fn of eventSubs) fn(msg.item); }
      if (msg.coll === 'messages' && arr.length > 3000) arr.splice(0, arr.length - 3000);
      notify(msg.coll);
    } else if (msg.kind === 'remove') {
      d[msg.coll] = d[msg.coll].filter((x) => x.id !== msg.id);
      notify(msg.coll);
    } else if (msg.kind === 'root') {
      d[msg.key] = msg.value;
      if (msg.key === 'divisions') msg.value.forEach(softDiv);
      if (msg.key === 'settings') S.me = msg.value.currentUserId || S.me;
      notify(msg.key);
    }
  };
  return es;
}

// ───── lookups & formatting
export const emp = (id) => S.data.employees.find((e) => e.id === id);
export const div = (id) => S.data.divisions.find((d) => d.id === id);
export const task = (id) => S.data.tasks.find((t) => t.id === id);
export const note = (id) => S.data.notes.find((n) => n.id === id);
export const noteByTitle = (t) => S.data.notes.find((n) => n.title.toLowerCase() === String(t).toLowerCase());
export const ago = (t) => {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'baru saja';
  if (s < 3600) return `${Math.round(s / 60)} mnt`;
  if (s < 86400) return `${Math.round(s / 3600)} jam`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
export const clock = (t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
export const usd = (n) => '$' + (n || 0).toFixed(n < 1 ? 4 : 2);
export const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n || 0));
export const STATUS_LABEL = { working: 'Bekerja', meeting: 'Rapat', chatting: 'Chat', idle: 'Siaga', offline: 'Offline' };
export const TASK_COLS = [
  { id: 'todo', label: 'To Do', icon: '📥' },
  { id: 'in_progress', label: 'Dikerjakan', icon: '⚡' },
  { id: 'waiting', label: 'Menunggu', icon: '⏳', also: ['blocked'] },
  { id: 'review', label: 'Review', icon: '🛑' },
  { id: 'done', label: 'Selesai', icon: '✅' },
];
export const PRIO = { high: '▲ Tinggi', medium: '■ Sedang', low: '▼ Rendah' };

export function avatar(e, cls = '') {
  if (!e) return `<div class="ava ${cls}" style="background:#555">?</div>`;
  const d = div(e.divisionId);
  const emoji = { cat: '🐱', bear: '🐻', bunny: '🐰', fox: '🦊', bot: '🤖', human: '' }[e.type === 'human' ? 'human' : e.avatar] || '';
  const inner = e.type === 'human' ? esc(e.name.replace(/^Anda\s*\(?/, '').slice(0, 1).toUpperCase() || 'A') : emoji || esc(e.name[0]);
  return `<div class="ava ${e.type === 'human' ? 'human' : ''} ${cls}" style="background:${d?.color || '#666'}" title="${esc(e.name)}">${inner}<i class="status-dot st-${e.status}"></i></div>`;
}

// ───── toasts
export function toast(text, kind = '', onClick) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div>${text}</div>`;
  el.onclick = () => { onClick?.(); el.remove(); };
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 7000 : 4500);
  const all = document.querySelectorAll('.toast');
  if (all.length > 4) all[0].remove();
}

// ───── modal & drawer
export function modal(title, bodyHTML, { onMount, actions = [], wide } = {}) {
  const m = document.getElementById('modal');
  m.hidden = false;
  m.innerHTML = `<div class="modal-card" style="${wide ? 'width:min(760px,100%)' : ''}"><div class="card-h">${title}<span style="flex:1"></span><button class="btn ghost icon" data-x>✕</button></div><div class="card-b">${bodyHTML}</div>${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-a="${i}">${a.label}</button>`).join('')}</div>` : ''}</div>`;
  const close = () => { m.hidden = true; m.innerHTML = ''; };
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-x]')) close(); };
  m.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
    const a = actions[b.dataset.a];
    if (!a.run) return close();
    b.disabled = true;
    try { const r = await a.run(m.querySelector('.card-b')); if (r !== false) close(); } catch { /* toast already shown */ } finally { b.disabled = false; }
  }));
  onMount?.(m.querySelector('.card-b'), close);
  setTimeout(() => m.querySelector('input,textarea,select')?.focus(), 30);
  return close;
}
export const closeModal = () => { const m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; };

let drawerState = null;
export function drawer(render, key) {
  const d = document.getElementById('drawer');
  drawerState = { render, key };
  d.hidden = false;
  let scrim = document.querySelector('.scrim');
  if (!scrim) { scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = closeDrawer; document.body.appendChild(scrim); }
  refreshDrawer(true);
}
export function refreshDrawer(first) {
  if (!drawerState) return;
  const d = document.getElementById('drawer');
  const body = d.querySelector('.drawer-b');
  const scroll = body?.scrollTop || 0;
  const active = document.activeElement;
  if (!first && active && d.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return; // don't clobber typing
  const out = drawerState.render();
  if (out === null) return closeDrawer();
  d.innerHTML = `<div class="drawer-h">${out.head}<span style="flex:1"></span><button class="btn ghost icon" data-close>✕</button></div><div class="drawer-b">${out.body}</div>`;
  d.querySelector('[data-close]').onclick = closeDrawer;
  out.mount?.(d);
  if (!first) d.querySelector('.drawer-b').scrollTop = scroll;
}
export function closeDrawer() {
  drawerState = null;
  const d = document.getElementById('drawer');
  d.hidden = true; d.innerHTML = '';
  document.querySelector('.scrim')?.remove();
}
export const drawerKey = () => drawerState?.key;

export function navigate(view, params = {}) {
  if (S.embedHook && S.embedUntil && performance.now() < S.embedUntil && S.embedHook(view, params)) return;
  S.view = view; S.params = params;
  const q = new URLSearchParams(params).toString();
  history.replaceState(null, '', `#${view}${q ? '?' + q : ''}`);
  notify('__route');
}

export const formData = (root) => Object.fromEntries([...root.querySelectorAll('[name]')].map((el) => [el.name, el.type === 'checkbox' ? el.checked : el.value]));
export const opt = (value, label, sel) => `<option value="${esc(value)}" ${String(sel) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
export const empOptions = (sel, { aiOnly } = {}) => S.data.divisions.map((d) => `<optgroup label="${esc(d.icon + ' ' + d.name)}">${S.data.employees.filter((e) => e.divisionId === d.id && (!aiOnly || e.type === 'ai')).map((e) => opt(e.id, `${e.name} — ${e.title}${e.type === 'human' ? ' (manusia)' : ''}`, sel)).join('')}</optgroup>`).join('');
