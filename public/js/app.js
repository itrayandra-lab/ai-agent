// App shell: navigation, topbar status, command palette, notifications, routing.
import { S, api, esc, emp, loadState, connect, onChange, onEvent, navigate, toast, usd, avatar, modal, closeDrawer, refreshDrawer, drawerKey } from './core.js';
import { VIEWS, agentDrawer, taskDrawer, newTaskModal, goalModal, employeeModal, officeApi, meetingModal } from './views.js';
import { icon, goldIcon } from './icons.js';
import { startIconizer } from './iconizer.js';

const $ = (q) => document.querySelector(q);
const navIc = (id, size) => goldIcon(id, size, VIEWS[id]?.ic || id);   // ikon emas bila ada; Browser tetap ikon garis
let current = null;
let connected = false;

window.setTheme = (t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = '#0A1426';
  try { localStorage.setItem('ui-theme', t); } catch { /* storage unavailable */ }
  officeApi()?.setTheme(t);
};
try { const t = localStorage.getItem('ui-theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* ignore */ }

function badges() {
  const ap = S.data.approvals.filter((a) => a.status === 'pending' && (a.approverId === S.me || S.me === 'owner')).length;
  const myTasks = S.data.tasks.filter((t) => t.assigneeId === S.me && t.status !== 'done').length;
  return { approvals: ap, tasks: myTasks };
}

// Menu utama: Beranda, Kantor 3D, Chat, Second Brain. Sisanya disembunyikan di "Lainnya".
const CORE = ['dashboard', 'tasks', 'brain'];   // wajah depan hanya tiga: Beranda (Pemandu), Hasil Saya, Catatan
const MORE = ['office', 'chat', 'approvals', 'browser', 'team', 'studio', 'knowledge', 'settings'];   // halaman lama: tetap ada, tidak dipromosikan
let moreOpen = false;
const SUB = { };
const SUB_OLD = { office: 'Pantau & masuk ke kantor', dashboard: 'Ringkasan perusahaan', tasks: 'Kanban & jejak kerja', chat: 'Percakapan & rapat', brain: 'Knowledge graph', studio: 'Rancang karyawan AI', studio: 'Rancang karyawan AI', knowledge: 'Knowledge, pelatihan & dataset', team: 'Hierarki & divisi', approvals: 'Keputusan manusia', settings: 'Mesin AI & sistem' };
let collapsed = true;   // selalu ciut setiap halaman dimuat/di-refresh; buka-tutup manual hanya berlaku selama sesi halaman

/** sisa jatah hari ini dalam kata, tidak pernah dalam dolar */
function jatah(d) { const b = Number(d.settings.dailyBudgetUSD) || 0; if (!b) return 'banyak'; const p = 1 - (d.usage.costToday || 0) / b; return p > 0.6 ? 'banyak' : p > 0.25 ? 'cukup' : p > 0 ? 'hampir habis' : 'habis'; }

function renderNav() {
  const b = badges();
  const d = S.data;
  const item = (id) => { const v = VIEWS[id]; const n = b[id] || 0; return `<button class="nav-item ${S.view === id ? 'active' : ''}" data-nav="${id}" title="${v.title}" ${S.view === id ? 'aria-current="page"' : ''}><span class="ic">${navIc(id, 28)}</span><span class="lbl"><b>${v.title}</b></span>${n ? `<span class="badge">${n}</span>` : ''}</button>`; };
  const ai = d.employees.filter((e) => e.type === 'ai');
  const active = ai.filter((e) => e.status === 'working' || e.status === 'meeting').length;
  const prov = d.provider || (d.live ? 'claude' : 'sim');
  document.getElementById('app').classList.toggle('nav-collapsed', collapsed);
  $('#sidebar').innerHTML = `<div class="brand"><div class="logo"><img src="/assets/brand/logo-mark-white.webp" alt="" width="34" height="34"></div><span class="lbl"><img class="wordmark-img" src="/assets/brand/logo-wordmark-light.webp" alt="RAIVERSE AGENT" width="112" height="28"><small>${esc(d.company.name)}</small></span><button class="btn icon ghost nav-toggle" id="navtg" title="${collapsed ? 'Perluas' : 'Ciutkan'} navigasi">${icon(collapsed ? 'expand' : 'collapse', 16)}</button></div>
    <div class="nav-group">${CORE.map(item).join('')}</div>
    <div class="side-foot">
      <button class="engine" id="modepill" aria-label="Jeda atau jalankan kantor" title="Klik untuk jeda / jalankan kantor"><span class="dot ${prov !== 'sim' && d.settings.autonomy ? 'on' : ''}"></span><span class="lbl">${!d.settings.autonomy ? 'Dijeda' : active ? 'Sedang bekerja' : 'Siap membantu'} · Jatah ${jatah(d)}</span></button>
    </div>
    <div class="nav-group more ${moreOpen ? 'open' : ''}"><button class="nav-more" id="navmore" aria-label="Menu lainnya" title="Menu lainnya" aria-expanded="${moreOpen}">${goldIcon('more', 28)}<span class="lbl">Lainnya</span>${b.approvals && !(moreOpen) ? `<span class="badge">${b.approvals}</span>` : ''}<span class="chev lbl">▾</span></button><div class="more-list">${MORE.map(item).join('')}</div></div>`;
  $('#navmore').onclick = () => { moreOpen = !moreOpen; renderNav(); };
  $('#modepill').onclick = () => api('PATCH', '/api/settings', { autonomy: !S.data.settings.autonomy }).then(() => toast(S.data.settings.autonomy ? '▶ Kantor berjalan' : '⏸ Kantor dijeda', 'ok'));
  $('#navtg').onclick = () => { collapsed = !collapsed; try { localStorage.setItem('navCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } renderNav(); setTimeout(() => dispatchEvent(new Event('resize')), 250); };
  $('#sidebar .logo').onclick = () => { if (collapsed) $('#navtg').click(); };   // collapsed: the logo and its arrow expand the menu
  $('#bottomnav').innerHTML = CORE.map((id) => `<button class="${S.view === id ? 'active' : ''}" data-nav="${id}"><span class="ic">${navIc(id, 24)}</span><span>${VIEWS[id].short || VIEWS[id].title.split(' ')[0]}</span>${b[id] ? `<span class="badge">${b[id]}</span>` : ''}</button>`).join('');
  $('#bottomnav').insertAdjacentHTML('beforeend', `<button id="bnmore" class="${MORE.includes(S.view) ? 'active' : ''}"><span class="ic">${goldIcon('more', 24)}</span><span>Lainnya</span>${b.approvals ? `<span class="badge">${b.approvals}</span>` : ''}</button>`);
  document.querySelectorAll('[data-nav]').forEach((x) => (x.onclick = () => navigate(x.dataset.nav)));
  $('#bnmore').onclick = openMenu;
}

function renderTop() {
  // Desktop: tidak ada topbar (judul sudah ada di sidebar & halaman). Seluler: bilah kecil dengan cari + menu.
  const v = VIEWS[S.view];
  $('#topbar').innerHTML = `<div class="page-title"><h1>${v.title}</h1></div><span class="spacer"></span>
    <button class="btn icon ghost" id="pal" aria-label="Cari">${icon('search', 18)}</button>
    <button class="btn icon ghost" id="more" title="Menu" aria-label="Buka menu">${icon('more', 18)}</button>${connected ? '' : `<span class="pill" style="color:var(--bad)" title="Koneksi realtime terputus">${icon('wifi', 13)}</span>`}`;
  $('#pal').onclick = openPalette;
  $('#more').onclick = openMenu;
}
function openMenu() {
  {
    const b = badges();
    modal('Menu', `<div style="display:grid;gap:6px">${[...CORE, ...MORE].map((id) => { const vv = VIEWS[id]; return `<button class="nav-item ${S.view === id ? 'active' : ''}" data-go="${id}"><span class="ic">${navIc(id, 28)}</span><span class="lbl"><b>${vv.title}</b></span>${b[id] ? `<span class="badge">${b[id]}</span>` : ''}</button>`; }).join('')}</div>`, {
      onMount: (el, close) => el.querySelectorAll('[data-go]').forEach((x) => (x.onclick = () => { close(); navigate(x.dataset.go); })),
    });
  }
}

function route() {
  const next = VIEWS[S.view] ? S.view : 'office';
  S.view = next;
  moreOpen = false;   // "Lainnya" is closed by default and collapses again after any navigation
  const root = $('#view');
  if (current) current.unmount?.(root);
  root.innerHTML = '';
  root.scrollTop = 0;
  current = VIEWS[next].view;
  current.mount(root);
  renderNav(); renderTop();
  document.title = `${VIEWS[next].title} · RAIVERSE AGENT`;
}

// ───── command palette (Obsidian/Linear style)
function paletteIcon(value) {
  const names = { '🎯': 'goal', '👥': 'team', '＋': 'plus', '🤖': 'studio', '👤': 'team', '⏯': 'play', '🌓': 'spark', '📝': 'brain', '📋': 'tasks', '🏢': 'office', '📊': 'dashboard', '💬': 'chat', '🧠': 'brain', '✨': 'studio', '🏛️': 'knowledge', '🛑': 'approvals', '🌐': 'browser', '⚙️': 'settings' };
  return icon(names[value] || 'search');
}
function openPalette() {
  const p = $('#palette');
  p.hidden = false;
  p.innerHTML = `<div class="pal-card"><input id="pq" placeholder="Cari karyawan, tugas, catatan… atau ketik perintah" autocomplete="off"><div class="pal-list" id="pl"></div></div>`;
  const input = p.querySelector('#pq');
  let items = []; let sel = 0;
  const actions = [
    { icon: '🎯', label: 'Pekerjaan baru untuk perusahaan', run: goalModal, k: 'aksi' },
    { icon: '👥', label: 'Rapat baru', run: () => meetingModal(), k: 'aksi' },
    { icon: '＋', label: 'Tugas baru', run: () => newTaskModal(), k: 'aksi' },
    { icon: '🤖', label: 'Tambah pembantu baru', run: () => employeeModal(null, { type: 'ai' }), k: 'aksi' },
    { icon: '⏯', label: 'Jeda / jalankan kantor', run: () => api('PATCH', '/api/settings', { autonomy: !S.data.settings.autonomy }), k: 'aksi' },
    { icon: '🌓', label: 'Ganti tema terang/gelap', run: () => window.setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'), k: 'aksi' },
    ...Object.entries(VIEWS).map(([id, v]) => ({ icon: v.icon, label: `Buka ${v.title}`, run: () => navigate(id), k: 'halaman' })),
  ];
  const render = () => {
    const q = input.value.toLowerCase().trim();
    const m = (s) => s.toLowerCase().includes(q);
    items = [
      ...actions.filter((a) => !q || m(a.label)),
      ...S.data.employees.filter((e) => q && (m(e.name) || m(e.title))).slice(0, 6).map((e) => ({ icon: e.type === 'ai' ? '🤖' : '👤', label: `${e.name} — ${e.title}`, run: () => agentDrawer(e.id), k: 'karyawan' })),
      ...S.data.notes.filter((n) => q && (m(n.title) || m(n.content))).slice(0, 8).map((n) => ({ icon: '📝', label: n.title, run: () => navigate('brain', { note: n.id }), k: n.folder })),
      ...S.data.tasks.filter((t) => q && m(t.title)).slice(-8).reverse().map((t) => ({ icon: '📋', label: t.title, run: () => taskDrawer(t.id), k: t.status })),
    ].slice(0, 30);
    if (q && !items.length) items.push({ icon: '🎯', label: `Jadikan pekerjaan: “${input.value}”`, run: () => api('POST', '/api/goals', { title: input.value, userId: S.me }).then(() => toast('Pekerjaan dikirim', 'ok')), k: 'aksi' });
    sel = Math.min(sel, items.length - 1);
    p.querySelector('#pl').innerHTML = items.map((it, i) => `<div class="pal-i ${i === sel ? 'sel' : ''}" data-i="${i}"><span>${paletteIcon(it.icon)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.label)}</span><span class="k">${esc(it.k)}</span></div>`).join('');
    p.querySelectorAll('[data-i]').forEach((x) => (x.onclick = () => choose(+x.dataset.i)));
  };
  const close = () => { p.hidden = true; p.innerHTML = ''; };
  const choose = (i) => { const it = items[i]; close(); it?.run(); };
  input.oninput = () => { sel = 0; render(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    if (e.key === 'Enter') choose(sel);
    if (e.key === 'Escape') close();
  };
  p.onclick = (e) => { if (e.target === p) close(); };
  render(); input.focus();
}

document.addEventListener('click', (e) => { const b = e.target.closest?.('[data-copy]'); if (!b) return; const t = b.closest('.codebox')?.querySelector('code')?.textContent || ''; navigator.clipboard?.writeText(t).then(() => { b.textContent = 'Tersalin ✓'; setTimeout(() => (b.textContent = 'Salin'), 1500); }).catch(() => {}); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape') { if (!$('#palette').hidden) return; if (!$('#modal').hidden) { $('#modal').hidden = true; $('#modal').innerHTML = ''; } else closeDrawer(); }
});

// ───── boot
(async function boot() {
  const [view, query] = location.hash.slice(1).split('?');
  if (view && VIEWS[view]) { S.view = view; S.params = Object.fromEntries(new URLSearchParams(query || '')); }
  try { await loadState(); }
  catch (err) { if (err?.gate) return; $('#view').innerHTML = '<div class="empty">Server tidak terjangkau. Jalankan <code>npm start</code>.</div>'; return; }   // gate: the sign-in card is already on screen
  route();
  startIconizer(document.body);
  window.addEventListener('hashchange', () => {
    const [v, q] = location.hash.slice(1).split('?');
    if (VIEWS[v]) navigate(v, Object.fromEntries(new URLSearchParams(q || '')));
  });
  connect((ok) => { if (ok !== connected) { connected = ok; renderTop(); if (ok) loadState(); } });
  onChange((colls) => {
    if (colls.has('__route')) return route();
    current?.update?.(colls);
    if (colls.has('*') || colls.has('approvals') || colls.has('tasks') || colls.has('settings') || colls.has('employees') || colls.has('company')) renderNav();
    if (colls.has('*') || colls.has('approvals') || colls.has('settings') || colls.has('usage') || colls.has('live') || colls.has('provider')) renderTop();
    if (drawerKey()) refreshDrawer();
  });
  onEvent((ev) => {
    if (ev.type === 'approval_requested') toast(`🛑 <b>${esc(emp(ev.actorId)?.name)}</b> butuh konfirmasimu: ${esc(ev.text.split('"')[1] || '')}`, 'warn', () => taskDrawer(ev.taskId));
    else if (ev.type === 'meeting_done') toast(`👥 ${esc(ev.text)}`, 'ok', () => navigate('chat', { ch: `mtg-${ev.meetingId}` }));
    else if (ev.type === 'alert') toast(`⚠️ ${esc(ev.text)}`, 'bad', () => ev.taskId && taskDrawer(ev.taskId));
    else if (ev.type === 'task_done') { const t = S.data.tasks.find((x) => x.id === ev.taskId); if (t && !t.parentId && t.kind !== 'routine') toast(`✅ ${esc(ev.text)}`, 'ok', () => taskDrawer(ev.taskId)); }
    else if ((ev.type === 'task_created' || ev.type === 'delegated') && ev.targetId === S.me && ev.actorId !== S.me) toast(`📥 Ada pekerjaan baru untukmu: ${esc(ev.text)}`, '', () => taskDrawer(ev.taskId));
  });
  // keep relative timestamps fresh without hammering the DOM
  setInterval(() => { if (S.view === 'dashboard' || S.view === 'tasks') current?.update?.(new Set(['tick'])); }, 30000);
})();
