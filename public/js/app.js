// App shell: navigation, topbar status, command palette, notifications, routing.
import { S, api, esc, emp, loadState, connect, onChange, onEvent, navigate, toast, usd, avatar, modal, closeDrawer, refreshDrawer, drawerKey } from './core.js';
import { VIEWS, agentDrawer, taskDrawer, newTaskModal, goalModal, employeeModal, officeApi, meetingModal } from './views.js';
import { icon } from './icons.js';

const $ = (q) => document.querySelector(q);
let current = null;
let connected = false;

window.setTheme = (t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#f4f1ec' : '#0a0a0a';
  try { localStorage.setItem('ui-theme', t); } catch { /* storage unavailable */ }
  officeApi()?.setTheme(t);
};
try { const t = localStorage.getItem('ui-theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* ignore */ }

function badges() {
  const ap = S.data.approvals.filter((a) => a.status === 'pending' && (a.approverId === S.me || S.me === 'owner')).length;
  const myTasks = S.data.tasks.filter((t) => t.assigneeId === S.me && t.status !== 'done').length;
  return { approvals: ap, tasks: myTasks };
}

const NAV = [
  { group: 'Workspace', items: ['office', 'dashboard', 'tasks', 'chat', 'brain'] },
  { group: 'Organisasi', items: ['studio', 'team', 'knowledge', 'approvals'] },
  { group: 'Sistem', items: ['settings'] },
];
const SUB = { office: 'Pantau & masuk ke kantor', dashboard: 'Ringkasan perusahaan', tasks: 'Kanban & jejak kerja', chat: 'Percakapan & rapat', brain: 'Knowledge graph', studio: 'Rancang karyawan AI', studio: 'Rancang karyawan AI', knowledge: 'Knowledge, pelatihan & dataset', team: 'Hierarki & divisi', approvals: 'Keputusan manusia', settings: 'Mesin AI & sistem' };
let collapsed = false;
try { collapsed = localStorage.getItem('navCollapsed') === '1'; } catch { /* ignore */ }

function renderNav() {
  const b = badges();
  const d = S.data;
  const item = (id) => { const v = VIEWS[id]; const n = b[id] || 0; return `<button class="nav-item ${S.view === id ? 'active' : ''}" data-nav="${id}" title="${v.title}"><span class="ic">${icon(v.ic || id)}</span><span class="lbl"><b>${v.title}</b><small>${SUB[id] || ''}</small></span>${n ? `<span class="badge">${n}</span>` : ''}</button>`; };
  const ai = d.employees.filter((e) => e.type === 'ai');
  const active = ai.filter((e) => e.status === 'working' || e.status === 'meeting').length;
  const prov = d.provider || (d.live ? 'claude' : 'sim');
  document.getElementById('app').classList.toggle('nav-collapsed', collapsed);
  $('#sidebar').innerHTML = `<div class="brand"><div class="logo">◐</div><span class="lbl"><span class="wordmark">R<b class="ai">AI</b>VERSE <em>AGENT</em></span><small>${esc(d.company.name)}</small></span><button class="btn icon ghost nav-toggle" id="navtg" title="${collapsed ? 'Perluas' : 'Ciutkan'} navigasi">${icon(collapsed ? 'expand' : 'collapse', 16)}</button></div>
    ${NAV.map((g) => `<div class="nav-group"><div class="nav-label">${g.group}</div>${g.items.map(item).join('')}</div>`).join('')}
    <div class="side-foot">
      <div class="engine"><span class="dot ${prov !== 'sim' && d.settings.autonomy ? 'on' : ''}"></span><span class="lbl">${prov === 'groq' ? 'Groq · GPT-OSS' : prov === 'claude' ? 'Claude' : 'Simulasi'} · ${active}/${ai.length} aktif</span></div>
      <div class="me row">${avatar(emp(S.me))}<div class="lbl" style="min-width:0"><b>${esc(emp(S.me)?.name || '')}</b><small>${esc(emp(S.me)?.title || '')}</small></div></div>
    </div>`;
  $('#navtg').onclick = () => { collapsed = !collapsed; try { localStorage.setItem('navCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } renderNav(); setTimeout(() => dispatchEvent(new Event('resize')), 250); };
  $('#bottomnav').innerHTML = ['office', 'dashboard', 'tasks', 'chat', 'brain'].map((id) => `<button class="${S.view === id ? 'active' : ''}" data-nav="${id}"><span class="ic">${icon(VIEWS[id].ic || id, 20)}</span><span>${VIEWS[id].title.split(' ')[0]}</span>${b[id] ? `<span class="badge">${b[id]}</span>` : ''}</button>`).join('');
  document.querySelectorAll('[data-nav]').forEach((x) => (x.onclick = () => navigate(x.dataset.nav)));
}

function renderTop() {
  const s = S.data.settings;
  const live = S.data.live;
  const ap = badges().approvals;
  const v = VIEWS[S.view];
  $('#topbar').innerHTML = `<div class="page-title"><span class="pt-ic">${icon(v.ic || S.view, 18)}</span><div><h1>${v.title}</h1><small class="hide-m">${SUB[S.view] || ''} · ${esc(S.data.company.name)}</small></div></div><span class="spacer"></span>
    <button class="search-btn" id="pal">${icon('search', 16)}<span class="lbl">Cari karyawan, tugas, catatan…</span><kbd>Ctrl K</kbd></button>
    <button class="btn sm hide-m" id="tgoal">${icon('goal', 15)} Goal</button>
    <button class="btn sm hide-m" id="tmeet">${icon('meeting', 15)} Rapat</button>
    <span class="pill ${!s.autonomy ? 'paused' : live ? 'live' : 'sim'}" id="modepill" title="Klik untuk jeda / jalankan kantor"><span class="dot"></span>${!s.autonomy ? 'Dijeda' : live ? `Live · ${S.data.provider === 'groq' ? 'Groq' : 'Claude'}` : 'Simulasi'}</span>
    <span class="pill hide-m" title="Biaya AI hari ini">${icon('coin', 13)} ${usd(S.data.usage.costToday)}</span>
    ${ap ? `<button class="pill warn" id="appill">${icon('approvals', 13)} ${ap}</button>` : ''}
    <button class="btn icon ghost" id="more" title="Menu">${icon('more', 18)}</button>
    ${connected ? '' : `<span class="pill" style="color:var(--bad)" title="Koneksi realtime terputus">${icon('wifi', 13)}</span>`}`;
  $('#pal').onclick = openPalette;
  $('#tgoal').onclick = () => goalModal();
  $('#tmeet').onclick = () => meetingModal();
  $('#modepill').onclick = () => api('PATCH', '/api/settings', { autonomy: !s.autonomy }).then(() => toast(s.autonomy ? '⏸ Kantor dijeda' : '▶ Kantor berjalan', 'ok'));
  $('#appill')?.addEventListener('click', () => navigate('approvals'));
  $('#more')?.addEventListener('click', () => {
    const b = badges();
    modal('Menu', `<div style="display:grid;gap:6px">${Object.entries(VIEWS).map(([id, vv]) => `<button class="nav-item ${S.view === id ? 'active' : ''}" data-go="${id}"><span class="ic">${icon(vv.ic || id)}</span><span class="lbl"><b>${vv.title}</b><small>${SUB[id] || ''}</small></span>${b[id] ? `<span class="badge">${b[id]}</span>` : ''}</button>`).join('')}</div>`, {
      onMount: (el, close) => el.querySelectorAll('[data-go]').forEach((x) => (x.onclick = () => { close(); navigate(x.dataset.go); })),
    });
  });
}

function route() {
  const next = VIEWS[S.view] ? S.view : 'office';
  S.view = next;
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
function openPalette() {
  const p = $('#palette');
  p.hidden = false;
  p.innerHTML = `<div class="pal-card"><input id="pq" placeholder="Cari karyawan, tugas, catatan… atau ketik perintah" autocomplete="off"><div class="pal-list" id="pl"></div></div>`;
  const input = p.querySelector('#pq');
  let items = []; let sel = 0;
  const actions = [
    { icon: '🎯', label: 'Goal baru untuk perusahaan', run: goalModal, k: 'aksi' },
    { icon: '＋', label: 'Tugas baru', run: () => newTaskModal(), k: 'aksi' },
    { icon: '🤖', label: 'Rekrut karyawan AI', run: () => employeeModal(null, { type: 'ai' }), k: 'aksi' },
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
    if (q && !items.length) items.push({ icon: '🎯', label: `Jadikan goal: “${input.value}”`, run: () => api('POST', '/api/goals', { title: input.value, userId: S.me }).then(() => toast('Goal dikirim', 'ok')), k: 'aksi' });
    sel = Math.min(sel, items.length - 1);
    p.querySelector('#pl').innerHTML = items.map((it, i) => `<div class="pal-i ${i === sel ? 'sel' : ''}" data-i="${i}"><span>${it.icon}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.label)}</span><span class="k">${esc(it.k)}</span></div>`).join('');
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

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape') { if (!$('#palette').hidden) return; if (!$('#modal').hidden) { $('#modal').hidden = true; $('#modal').innerHTML = ''; } else closeDrawer(); }
});

// ───── boot
(async function boot() {
  const [view, query] = location.hash.slice(1).split('?');
  if (view && VIEWS[view]) { S.view = view; S.params = Object.fromEntries(new URLSearchParams(query || '')); }
  try { await loadState(); }
  catch { $('#view').innerHTML = '<div class="empty">Server tidak terjangkau. Jalankan <code>npm start</code>.</div>'; return; }
  route();
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
    if (ev.type === 'approval_requested') toast(`🛑 <b>${esc(emp(ev.actorId)?.name)}</b> butuh persetujuan: ${esc(ev.text.split('"')[1] || '')}`, 'warn', () => taskDrawer(ev.taskId));
    else if (ev.type === 'meeting_done') toast(`👥 ${esc(ev.text)}`, 'ok', () => navigate('chat', { ch: `mtg-${ev.meetingId}` }));
    else if (ev.type === 'alert') toast(`⚠️ ${esc(ev.text)}`, 'bad', () => ev.taskId && taskDrawer(ev.taskId));
    else if (ev.type === 'task_done') { const t = S.data.tasks.find((x) => x.id === ev.taskId); if (t && !t.parentId && t.kind !== 'routine') toast(`✅ ${esc(ev.text)}`, 'ok', () => taskDrawer(ev.taskId)); }
    else if ((ev.type === 'task_created' || ev.type === 'delegated') && ev.targetId === S.me && ev.actorId !== S.me) toast(`📥 Tugas baru untuk Anda: ${esc(ev.text)}`, '', () => taskDrawer(ev.taskId));
  });
  // keep relative timestamps fresh without hammering the DOM
  setInterval(() => { if (S.view === 'dashboard' || S.view === 'tasks') current?.update?.(new Set(['tick'])); }, 30000);
})();
