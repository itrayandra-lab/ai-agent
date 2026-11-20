// Kerangka aplikasi: navigasi, bilah atas, palet perintah, pemberitahuan, rute.
// Pengguna biasa hanya melihat Beranda (Pemandu), Hasil Saya, Catatan, Tim Saya, dan di "Lainnya": Kantor 3D dan Pengaturan.
import { S, api, esc, emp, loadState, connect, onChange, onEvent, navigate, toast, avatar, modal, closeDrawer, refreshDrawer, drawerKey } from './core.js';
import { VIEWS, LEGACY, agentDrawer, officeApi } from './views.js';
import { icon, goldIcon } from './icons.js';
import { startIconizer } from './iconizer.js';
import { bisaKelola, kosong } from './awam.js';

const $ = (q) => document.querySelector(q);
const navIc = (id, size) => goldIcon(id, size, VIEWS[id]?.ic || id);   // ikon emas bila ada; yang lain ikon garis
let current = null;
const LEFT = ['dashboard', 'pesan', 'tasks', 'brain', 'team', 'settings'];   // 'pesan' = halaman kontak agen/grup dari sesi Chat: otomatis tampil di panel kiri begitu VIEWS.pesan terdaftar   // halaman yang tampil di PANEL KIRI di atas Kantor 3D (desktop)
const desktop = () => !matchMedia('(max-width: 820px)').matches;
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
  return { tasks: ap };   // angka di "Hasil Saya" = yang menunggu keputusanmu
}

// Menu utama: empat layar. Sisanya terlipat di "Lainnya". Jalur pengelola (#admin) tidak ditautkan di sini.
const CORE = ['office', 'dashboard', 'pesan', 'tasks', 'brain', 'team'];   // Kantor 3D utama; Beranda = versi obrolan untuk yang malas melihat 3D
const MORE = ['settings'];
let moreOpen = false;
let collapsed = true;   // selalu ciut setiap halaman dimuat; buka-tutup manual hanya berlaku selama sesi halaman

/** sisa jatah hari ini dalam kata, tidak pernah dalam dolar */
function jatah(d) { const b = Number(d.settings.dailyBudgetUSD) || 0; if (!b) return 'banyak'; const p = 1 - (d.usage.costToday || 0) / b; return p > 0.6 ? 'banyak' : p > 0.25 ? 'cukup' : p > 0 ? 'hampir habis' : 'habis'; }

function renderNav() {
  const b = badges();
  const d = S.data;
  const item = (id) => { const v = VIEWS[id]; const n = b[id] || 0; return `<button type="button" class="nav-item ${S.view === id ? 'active' : ''}" data-nav="${id}" title="${v.title}" aria-label="${v.title}" ${S.view === id ? 'aria-current="page"' : ''}><span class="ic">${navIc(id, 28)}</span><span class="lbl"><b>${v.title}</b></span>${n ? `<span class="badge" aria-label="${n} menunggu">${n}</span>` : ''}</button>`; };
  const ai = d.employees.filter((e) => e.type === 'ai');
  const active = ai.filter((e) => e.status === 'working' || e.status === 'meeting').length;
  document.getElementById('app').classList.toggle('nav-collapsed', collapsed);
  $('#sidebar').innerHTML = `<div class="brand"><div class="logo"><img src="/assets/brand/logo-mark-white.webp" alt="" width="34" height="34"></div><span class="lbl"><img class="wordmark-img" src="/assets/brand/logo-wordmark-light.webp" alt="RAIVERSE AGENT" width="112" height="28"><small>${esc(d.company.name)}</small></span><button type="button" class="btn icon ghost nav-toggle" id="navtg" aria-label="${collapsed ? 'Perluas menu' : 'Ciutkan menu'}" aria-expanded="${!collapsed}" title="${collapsed ? 'Perluas menu' : 'Ciutkan menu'}">${icon(collapsed ? 'expand' : 'collapse', 16)}</button></div>
    <div class="nav-group">${CORE.filter((id) => id !== 'office').map(item).join('')}</div>
    <div class="side-foot">
      <button type="button" class="engine" id="modepill" aria-label="Jeda atau lanjutkan kerja tim" title="Jeda atau lanjutkan kerja tim"><span class="dot ${d.settings.autonomy ? 'on' : ''}"></span><span class="lbl">${!d.settings.autonomy ? 'Dijeda' : active ? 'Sedang bekerja' : 'Siap membantu'} · Jatah ${jatah(d)}</span></button>
    </div>
    <div class="nav-group more ${moreOpen ? 'open' : ''}"><button type="button" class="nav-more" id="navmore" aria-label="Menu lainnya" title="Menu lainnya" aria-expanded="${moreOpen}">${goldIcon('more', 28)}<span class="lbl">Lainnya</span><span class="chev lbl" aria-hidden="true">▾</span></button><div class="more-list">${MORE.map(item).join('')}</div></div>`;
  $('#navmore').onclick = () => { moreOpen = !moreOpen; renderNav(); };
  $('#modepill').onclick = () => api('PATCH', '/api/settings', { autonomy: !S.data.settings.autonomy }).then(() => toast(S.data.settings.autonomy ? 'Tim kembali bekerja' : 'Tim dijeda dulu', 'ok'));
  $('#navtg').onclick = () => { collapsed = !collapsed; try { localStorage.setItem('navCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } renderNav(); setTimeout(() => dispatchEvent(new Event('resize')), 250); };
  $('#sidebar .logo').onclick = () => { if (collapsed) $('#navtg').click(); };   // menu ciut: logo ikut membukanya
  $('#bottomnav').innerHTML = CORE.map((id) => `<button type="button" class="${S.view === id ? 'active' : ''}" data-nav="${id}" aria-label="${VIEWS[id].title}" ${S.view === id ? 'aria-current="page"' : ''}><span class="ic">${navIc(id, 24)}</span><span>${VIEWS[id].short || VIEWS[id].title.split(' ')[0]}</span>${b[id] ? `<span class="badge" aria-label="${b[id]} menunggu">${b[id]}</span>` : ''}</button>`).join('');
  $('#bottomnav').insertAdjacentHTML('beforeend', `<button type="button" id="bnmore" aria-label="Menu lainnya" class="${MORE.includes(S.view) ? 'active' : ''}"><span class="ic">${goldIcon('more', 24)}</span><span>Lainnya</span></button>`);
  document.querySelectorAll('[data-nav]').forEach((x) => (x.onclick = () => { const id = x.dataset.nav; navigate(id === S.view && desktop() && LEFT.includes(id) ? 'office' : id); /* klik item yang sedang terbuka = tutup panel */ }));
  $('#bnmore').onclick = openMenu;
}

function renderTop() {
  // Desktop: tidak ada bilah atas (judul sudah ada di menu dan halaman). Seluler: bilah kecil dengan cari dan menu.
  const v = VIEWS[S.view];
  $('#topbar').innerHTML = `<div class="page-title"><h1>${v.title}</h1></div><span class="spacer"></span>
    <button type="button" class="btn icon ghost" id="pal" aria-label="Cari" title="Cari">${icon('search', 20)}</button>
    <button type="button" class="btn icon ghost" id="more" title="Menu" aria-label="Buka menu">${icon('menu', 20)}</button>${connected ? '' : `<span class="pill" role="status" style="color:var(--bad)">${icon('wifi', 14)} Terputus</span>`}`;
  $('#pal').onclick = openPalette;
  $('#more').onclick = openMenu;
}
function openMenu() {
  const b = badges();
  modal('Menu', `<div class="menu-list">${[...CORE, ...MORE].map((id) => { const vv = VIEWS[id]; return `<button type="button" class="nav-item ${S.view === id ? 'active' : ''}" data-go="${id}"><span class="ic">${navIc(id, 28)}</span><span class="lbl"><b>${vv.title}</b></span>${b[id] ? `<span class="badge" aria-label="${b[id]} menunggu">${b[id]}</span>` : ''}</button>`; }).join('')}</div>`, {
    onMount: (el, close) => el.querySelectorAll('[data-go]').forEach((x) => (x.onclick = () => { close(); navigate(x.dataset.go); })),
  });
}

/** nama lama diterjemahkan, layar pengelola dilindungi peran. Mengembalikan nama layar yang boleh dipakai. */
function izin(view) {
  const v = LEGACY[view] || view;
  if (!VIEWS[v]) return 'dashboard';
  if (VIEWS[v].admin && !bisaKelola(S.data)) return 'dashboard';
  return v;
}
function route() {
  const want = S.view; const next = izin(want);
  if (next !== want && VIEWS[LEGACY[want] || want]?.admin) toast('Bagian itu hanya untuk pemilik ruang kerja.', 'warn');
  S.view = next;
  moreOpen = false;   // "Lainnya" tertutup dan menutup lagi setelah berpindah
  const root = $('#view');
  const office = VIEWS.office.view;
  if (desktop() && (next === 'office' || LEFT.includes(next))) {
    // Kantor 3D adalah ruang kerja utama: tetap terpasang, halaman lain hanya mengganti isi PANEL KIRI
    if (current !== office) { current?.unmount?.(root); root.innerHTML = ''; root.scrollTop = 0; current = office; office.mount(root); }
    office.setLeft(next === 'office' ? null : next);
  } else {
    if (current) current.unmount?.(root);
    root.innerHTML = '';
    root.scrollTop = 0;
    current = VIEWS[next].view;
    current.mount(root);
  }
  renderNav(); renderTop();
  document.title = `${VIEWS[next].title} · RAIVERSE AGENT`;
}

// ───── palet perintah: hanya tindakan awam
function openPalette() {
  const p = $('#palette');
  p.hidden = false;
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Cari atau mulai sesuatu');
  p.innerHTML = `<div class="pal-card"><label class="sr-only" for="pq">Cari orang, hasil, atau catatan</label><input id="pq" placeholder="Cari orang, hasil, atau catatan…" autocomplete="off"><div class="pal-list" id="pl" role="listbox"></div></div>`;
  const input = p.querySelector('#pq');
  let items = []; let sel = 0;
  const aksi = [
    { icon: 'goal', label: 'Mulai pekerjaan baru', run: () => navigate('dashboard'), k: 'mulai' },
    { icon: 'tasks', label: 'Buka Hasil Saya', run: () => navigate('tasks'), k: 'buka' },
    { icon: 'brain', label: 'Buka Catatan', run: () => navigate('brain'), k: 'buka' },
    { icon: 'team', label: 'Buka Tim Saya', run: () => navigate('team'), k: 'buka' },
    { icon: 'office', label: 'Buka Kantor 3D', run: () => navigate('office'), k: 'buka' },
    { icon: 'sun', label: 'Ganti tampilan terang atau gelap', run: () => window.setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'), k: 'tampilan' },
  ];
  const render = () => {
    const q = input.value.toLowerCase().trim();
    const m = (s) => String(s || '').toLowerCase().includes(q);
    items = [
      ...aksi.filter((a) => !q || m(a.label)),
      ...S.data.employees.filter((e) => q && e.type === 'ai' && (m(e.name) || m(e.title))).slice(0, 6).map((e) => ({ icon: 'user', label: `${e.name}, ${e.title}`, run: () => agentDrawer(e.id), k: 'orang' })),
      ...S.data.notes.filter((n) => q && (m(n.title) || m(n.content))).slice(0, 8).map((n) => ({ icon: 'doc', label: n.title, run: () => navigate('brain', { note: n.id }), k: 'catatan' })),
      ...S.data.tasks.filter((t) => q && !t.parentId && m(t.title)).slice(-8).reverse().map((t) => ({ icon: 'tasks', label: t.title, run: () => navigate('tasks', { buka: t.id }), k: 'hasil' })),
    ].slice(0, 30);
    if (q && !items.some((i) => i.k === 'orang' || i.k === 'catatan' || i.k === 'hasil')) items.push({ icon: 'spark', label: `Tanya aray: “${input.value}”`, run: () => navigate('dashboard', { mulai: input.value }), k: 'pemandu' });
    sel = Math.max(0, Math.min(sel, items.length - 1));
    p.querySelector('#pl').innerHTML = items.map((it, i) => `<div class="pal-i ${i === sel ? 'sel' : ''}" role="option" aria-selected="${i === sel}" tabindex="0" data-i="${i}"><span aria-hidden="true">${icon(it.icon)}</span><span class="pal-t">${esc(it.label)}</span><span class="k">${esc(it.k)}</span></div>`).join('');
    p.querySelectorAll('[data-i]').forEach((x) => { x.onclick = () => choose(+x.dataset.i); x.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(+x.dataset.i); } }; });
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

document.addEventListener('click', (e) => { const b = e.target.closest?.('[data-copy]'); if (!b) return; const t = b.closest('.codebox')?.querySelector('code')?.textContent || ''; navigator.clipboard?.writeText(t).then(() => { b.textContent = 'Tersalin'; setTimeout(() => (b.textContent = 'Salin'), 1500); }).catch(() => {}); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape') { if (!$('#palette').hidden) return; if (desktop() && LEFT.includes(S.view) && $('#modal').hidden && !drawerKey()) { navigate('office'); return; } if (!$('#modal').hidden) { $('#modal').hidden = true; $('#modal').innerHTML = ''; } else closeDrawer(); }
});

// ───── mulai
(async function boot() {
  const [view, query] = location.hash.slice(1).split('?');
  if (view && (VIEWS[view] || LEGACY[view])) { S.view = view; S.params = Object.fromEntries(new URLSearchParams(query || '')); }
  try { await loadState(); }
  catch (err) {
    if (err?.gate) return;   // kartu masuk sudah tampil
    $('#view').innerHTML = kosong('Belum bisa tersambung', 'Sambungan ke aplikasi sedang terputus. Periksa internet atau tunggu sebentar, lalu muat ulang halaman ini.', '<button type="button" class="btn primary" onclick="location.reload()">Muat ulang</button>');
    return;
  }
  route();
  startIconizer(document.body);
  window.addEventListener('hashchange', () => {
    const [v, q] = location.hash.slice(1).split('?');
    if (VIEWS[v] || LEGACY[v]) navigate(v, Object.fromEntries(new URLSearchParams(q || '')));
  });
  let sambungPertama = true;   // perf: sambungan pertama tidak mengunduh ulang seluruh data yang baru saja dimuat; hanya sambungan ulang yang menyegarkan
  connect((ok) => { if (ok !== connected) { connected = ok; renderTop(); if (ok) { if (sambungPertama) sambungPertama = false; else loadState(); } } });
  onChange((colls) => {
    if (colls.has('__route')) return route();
    current?.update?.(colls);
    if (colls.has('*') || colls.has('approvals') || colls.has('tasks') || colls.has('settings') || colls.has('employees') || colls.has('company')) renderNav();
    if (colls.has('*') || colls.has('approvals') || colls.has('settings') || colls.has('usage') || colls.has('live') || colls.has('provider')) renderTop();
    if (drawerKey()) refreshDrawer();
  });
  onEvent((ev) => {
    if (ev.type === 'approval_requested') toast(`<b>${esc(emp(ev.actorId)?.name)}</b> butuh jawabanmu: ${esc(ev.text.split('"')[1] || 'ada yang perlu dilihat')}`, 'warn', () => navigate('tasks'));
    else if (ev.type === 'meeting_done') toast(`Rapat selesai: ${esc(ev.text)}`, 'ok', () => navigate('tasks'));
    else if (ev.type === 'alert') toast(`Ada yang perlu dilihat: ${esc(ev.text)}`, 'bad', () => navigate('tasks', ev.taskId ? { buka: ev.taskId } : {}));
    else if (ev.type === 'task_done') { const t = S.data.tasks.find((x) => x.id === ev.taskId); if (t && !t.parentId && t.kind !== 'routine') toast(`Selesai: ${esc(ev.text)}`, 'ok', () => navigate('tasks', { buka: ev.taskId })); }
    else if ((ev.type === 'task_created' || ev.type === 'delegated') && ev.targetId === S.me && ev.actorId !== S.me) toast(`Ada pekerjaan baru untukmu: ${esc(ev.text)}`, '', () => navigate('tasks', { buka: ev.taskId }));
  });
  // jaga waktu relatif tetap segar tanpa membebani tampilan
  setInterval(() => { if (S.view === 'tasks' || S.view === 'team') current?.update?.(new Set(['tick'])); }, 30000);
})();
