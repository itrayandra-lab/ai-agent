// All screens + agent/task drawers + modals.
import { S, api, esc, emp, div, task, note, noteByTitle, ago, clock, usd, num, avatar, toast, modal, drawer, refreshDrawer, closeDrawer, drawerKey, navigate, formData, opt, empOptions, STATUS_LABEL, TASK_COLS, PRIO, onEvent } from './core.js';
import { md, linksOf } from './md.js';
import { createGraph } from './graph.js';
import { StudioView } from './studio.js';

const D = () => S.data;
const me = () => emp(S.me) || emp('owner');
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const EV_ICON = { task_created: '📥', delegated: '➡️', task_started: '⚡', task_done: '✅', note_written: '📝', message: '💬', reasoning: '💭', learned: '💡', approval_requested: '🛑', approved: '🎉', rejected: '✏️', meeting: '👥', alert: '⚠️', hired: '🎊', handoff: '📦' };
const FOLDER_COLORS = { Company: '#f5b942', SOP: '#4dd4ac', Deliverables: '#5b8cff', Reports: '#ffd166', Research: '#ff9f43', Marketing: '#ff6b8b', Memori: '#c58bff', Knowledge: '#36c2f0', Notes: '#a3a8b8' };
const folderColor = (f) => FOLDER_COLORS[f] || '#' + ((Math.abs([...f].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 0xaaaaaa) + 0x444444).toString(16);
const openTasks = (id) => D().tasks.filter((t) => t.assigneeId === id && t.status !== 'done');

function bindCommon(root) {
  root.addEventListener('click', (e) => {
    const w = e.target.closest('.wikilink');
    if (w) { e.preventDefault(); openNoteByTitle(w.dataset.note); return; }
    const a = e.target.closest('[data-agent]');
    if (a && !e.target.closest('button:not([data-agent])')) { agentDrawer(a.dataset.agent); return; }
    const t = e.target.closest('[data-task]');
    if (t && !e.target.closest('button:not([data-task])')) { taskDrawer(t.dataset.task); return; }
    const n = e.target.closest('[data-note]');
    if (n) { navigate('brain', { note: n.dataset.note }); closeDrawer(); }
  });
}
export function openNoteByTitle(title) {
  const n = noteByTitle(title);
  if (n) { closeDrawer(); navigate('brain', { note: n.id }); }
  else modal('Catatan belum ada', `<p class="muted">Catatan <b>${esc(title)}</b> belum dibuat. Buat sekarang?</p>`, { actions: [{ label: 'Batal' }, { label: 'Buat catatan', kind: 'primary', run: async () => { const c = await api('POST', '/api/notes', { title, folder: 'Notes', userId: S.me }); closeDrawer(); navigate('brain', { note: c.id }); } }] });
}

function feedItem(ev, fresh) {
  const a = emp(ev.actorId);
  return `<div class="feed-item ${fresh ? 'new' : ''}" ${ev.taskId ? `data-task="${ev.taskId}"` : ev.actorId && a ? `data-agent="${ev.actorId}"` : ''}><span>${EV_ICON[ev.type] || '•'}</span><div style="flex:1;min-width:0">${esc(ev.text)}</div><span class="t">${clock(ev.t)}</span></div>`;
}

function commsItem(m, fresh) {
  const a = emp(m.authorId); const ch = D().channels.find((c) => c.id === m.channelId);
  let where = '';
  if (ch?.kind === 'dm') { const o = emp(ch.members.find((x) => x !== m.authorId)); where = `→ ${esc(o?.name || '?')}`; }
  else if (ch?.kind === 'meeting') where = `· 👥 ${esc(ch.name.replace(/^Rapat: /, ''))}`;
  else if (ch) where = `· #${esc(ch.name)}`;
  const txt = String(m.text).replace(/[*_#>`]/g, '').replace(/\s+/g, ' ');
  return `<div class="feed-item ${fresh ? 'new' : ''}" data-goch="${m.channelId}">${avatar(a)}<div style="flex:1;min-width:0"><div class="small"><b>${esc(a?.name || m.authorId)}</b> <span class="muted">${where}</span></div><div class="small" style="color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(txt.slice(0, 280))}</div></div><span class="t">${clock(m.t)}</span></div>`;
}

export function meetingModal(pre = {}) {
  const ai = D().employees.filter((e) => e.type === 'ai');
  modal('👥 Adakan rapat multi-agen', `
    <label class="f">Topik<input class="input" name="topic" value="${esc(pre.topic || '')}" placeholder="mis. Strategi harga paket Growth tahun depan"></label>
    <label class="f">Agenda / pertanyaan kunci<textarea class="input" name="agenda" rows="3" placeholder="Apa yang harus diputuskan? Data apa yang relevan?">${esc(pre.agenda || '')}</textarea></label>
    <div class="grid2"><label class="f">Pemimpin rapat<select class="input" name="chairId">${empOptions(pre.chairId || 'aria', { aiOnly: true })}</select></label>
    <label class="f">Putaran diskusi<select class="input" name="rounds">${opt(1, '1 putaran (cepat)')}${opt(2, '2 putaran (diskusi)', 2)}${opt(3, '3 putaran (mendalam)')}</select></label></div>
    <label class="row small" style="align-items:flex-start"><input type="checkbox" name="ownerLed" checked><span><b>Saya mengawali rapat</b><br><span class="muted">Semua agen diam dan mendengarkan sampai Anda mengirim “saya selesai” atau <code>/selesai</code> di chat rapat.</span></span></label>
    <div class="f" style="display:grid;gap:6px"><span class="small muted">Peserta <b id="mtgcount">0 dipilih</b></span><div class="row wrap"><button class="btn sm" type="button" data-ms="all">Pilih semua</button><button class="btn sm" type="button" data-ms="heads">Semua kepala</button><button class="btn sm" type="button" data-ms="clear">Kosongkan</button>${D().divisions.map((d) => `<button class="btn sm ghost" type="button" data-ms="${d.id}">${d.icon} ${esc(d.short)}</button>`).join('')}</div><div class="list-scroll" style="max-height:260px">${D().divisions.map((d) => `<div class="eyebrow" style="margin:6px 0 2px">${esc(d.name)} <button class="btn sm ghost" type="button" data-ms="${d.id}">pilih divisi</button></div>${ai.filter((e) => e.divisionId === d.id).map((e) => `<label class="row small" style="gap:8px;padding:3px 0"><input type="checkbox" data-p="${e.id}" ${(pre.participants || []).includes(e.id) ? 'checked' : ''}>${esc(e.name)} <span class="muted">· ${esc(e.title)}</span></label>`).join('')}`).join('')}</div></div>
    <p class="small muted" style="margin:0">Untuk pilihan massal, seluruh agen tetap tercatat sebagai peserta yang diwakili; kepala tiap divisi aktif berdiskusi agar rapat tidak menghabiskan 154 panggilan AI. Notulen dan action item otomatis menjadi tugas.</p>`, {
    wide: true,
    onMount: (b) => {
      const boxes = () => [...b.querySelectorAll('[data-p]')];
      const update = () => { b.querySelector('#mtgcount').textContent = `${boxes().filter((x) => x.checked).length} dipilih`; };
      b.querySelectorAll('[data-ms]').forEach((x) => (x.onclick = () => { const s = x.dataset.ms; for (const c of boxes()) c.checked = s === 'all' ? true : s === 'heads' ? !!emp(c.dataset.p)?.isLead : s === 'clear' ? false : emp(c.dataset.p)?.divisionId === s ? true : c.checked; update(); }));
      boxes().forEach((x) => (x.onchange = update)); update();
    },
    actions: [{ label: 'Batal' }, { label: 'Mulai rapat', kind: 'primary', run: async (b) => {
      const f = formData(b); const ids = [...b.querySelectorAll('[data-p]:checked')].map((x) => x.dataset.p);
      if (!f.topic.trim()) { toast('Topik wajib', 'warn'); return false; }
      if (ids.length < 1) { toast('Pilih minimal 1 peserta selain pemimpin', 'warn'); return false; }
      const r = await api('POST', '/api/meetings', { topic: f.topic, agenda: f.agenda, chairId: f.chairId, rounds: f.rounds, participantIds: ids, ownerLed: f.ownerLed });
      toast(r.ownerLed ? `🎙️ ${r.represented} peserta mendengarkan. Buka chat rapat dan kirim /selesai saat Anda selesai bicara.` : `👥 Rapat aktif dengan ${r.activeParticipants} peserta`, 'ok');
    } }],
  });
}

function kpis() {
  const d = D();
  const t0 = today0();
  return {
    ai: d.employees.filter((e) => e.type === 'ai').length,
    humans: d.employees.filter((e) => e.type === 'human').length,
    working: d.employees.filter((e) => e.status === 'working' || e.status === 'meeting').length,
    active: d.tasks.filter((t) => t.status !== 'done').length,
    doneToday: d.tasks.filter((t) => t.status === 'done' && (t.completedAt || 0) >= t0).length,
    approvals: d.approvals.filter((a) => a.status === 'pending').length,
    cost: d.usage.costToday || 0,
  };
}

// ═════════════════════ OFFICE (3D) ═════════════════════
let office = null, officeRoot = null, officeLoading = null;
async function ensureOffice() {
  if (office) return office;
  if (officeLoading) return officeLoading;
  officeRoot = document.createElement('div');
  officeRoot.className = 'office';
  officeRoot.innerHTML = `<div class="canvas-host" style="position:absolute;inset:0"></div><div class="empty" style="position:absolute;inset:0;display:grid;place-items:center" data-loading>Memuat kantor 3D…</div>`;
  officeLoading = import('./office3d.js').then(({ createOffice }) => {
    office = createOffice(officeRoot.querySelector('.canvas-host'), {
      onSelect: (id) => { if (office?.isPlayer()) OfficeView.talkTo(id); },
      onFollow: (id) => OfficeView.followCard(id),
      onRequestPlay: () => OfficeView.togglePlayer(),
      onHelp: (show) => OfficeView.help(show),
      onToast: (t) => OfficeView.chip(t),
      onZone: (z) => { if (office?.isPlayer()) return; z === 'brain' ? navigate('brain', { graph: 1 }) : divisionDrawer(z); },
      onPlayerHint: (h) => OfficeView.playerHint(h), onPlayerAction: (h, kind) => OfficeView.playerAction(h, kind),
    });
    officeRoot.querySelector('[data-loading]')?.remove();
    office.sync(D());
    onEvent((ev) => office.onEvent(ev));
    return office;
  }).catch((err) => { officeRoot.querySelector('[data-loading]').textContent = 'WebGL tidak tersedia: ' + err.message; throw err; });
  return officeLoading;
}
export const officeApi = () => office;

export const OfficeView = {
  mount(root) {
    root.style.overflow = 'hidden';
    ensureOffice().then(() => { office.setVisible(true); if (S.params.focus) setTimeout(() => office.focus(S.params.focus), 300); });
    if (!officeRoot) return;
    root.appendChild(officeRoot);
    const ov = document.createElement('div');
    ov.className = 'office-ov';
    ov.innerHTML = `
      <div class="office-brand"><div class="logo">◐</div><div><b>RAY // OFFICE</b><small>${esc(D().company.name.toLowerCase().replace(/\s+/g, ''))}.ai · live office</small></div></div>
      <div class="ov-left">
        <div class="kpis" id="okpi"></div>
        <div class="glass rooms" id="orooms"></div>
      </div>
      <div class="ov-right">
        <div class="cam-btns">
          <button class="btn glass primary-play" title="Masuk ke kantor sebagai karakter Anda (WASD)" data-cam="play" style="width:auto;padding:0 12px">▶ PLAY</button>
          <button class="btn glass" title="Tampilan isometrik" data-cam="reset">ISO</button>
          <button class="btn glass" title="Tampilan atas" data-cam="top">TOP</button>
          <button class="btn glass" title="Zoom in" data-cam="in">＋</button>
          <button class="btn glass" title="Zoom out" data-cam="out">－</button>
          <button class="btn glass" title="Label nama" data-cam="labels">Aa</button>
          <button class="btn glass" title="Layar penuh" data-cam="full">⛶</button>
          <button class="btn glass" title="Karakter saya (pria/wanita, rambut, kulit)" data-cam="me">👤</button>
          <button class="btn glass" title="Kontrol & pintasan keyboard [H]" data-cam="help">?</button>
        </div>
        <div class="glass hud" id="ohud"></div>
      </div>
      <div class="ov ov-br glass"><div class="card-h" style="padding:7px 10px;gap:6px"><div class="tabs" style="padding:2px"><button data-ft="comms" class="active">Percakapan</button><button data-ft="events">Aktivitas</button></div><span class="badge soft" id="feedcount">0</span><span style="flex:1"></span><span class="muted small" id="feedtoggle" style="cursor:pointer;padding:4px">▾</span></div><div class="feed" id="ofeed"></div></div>
      <div class="phud glass mono" id="phud" hidden><b>MODE PEMAIN</b> · WASD gerak · Shift lari · drag = kamera · Q/R putar · <b>E</b> panggil & bicara · <b>F</b> beri tugas · Spasi lompat · G lambai · H bantuan · <b>Esc</b> keluar</div>
      <div class="follow-card glass" id="ofollow" hidden></div>
      <div class="help-panel glass" id="ohelp" hidden></div>
      <div class="tod-chip glass mono" id="ochip" hidden></div>
      <div class="phint glass" id="phint" hidden></div>
      <div class="ptalk glass" id="ptalk" hidden></div>
      <div class="pmobile" id="pmobile" hidden><div class="pjoy">◎<small>geser</small></div><div class="pbtns"><button class="btn glass" data-pm="talk">E</button><button class="btn glass" data-pm="wave">👋</button><button class="btn glass" data-pm="exit">✕</button></div></div>
      <div class="cmdbar-hint">WASD terbang · E/Q naik-turun · klik agen = ikuti kamera · U/I waktu · Spasi = jalan sebagai karakter · <b>H</b> bantuan</div>
      <div class="cmdbar glass"><input id="goalq" placeholder="Beri goal ke perusahaan… mis. “Luncurkan promo akhir tahun”" maxlength="300"><button class="btn" id="meetgo" title="Adakan rapat multi-agen">Rapat</button><button class="btn primary" id="goalgo">Jalankan</button></div>`;
    root.appendChild(ov);
    const send = async () => {
      const q = ov.querySelector('#goalq');
      if (!q.value.trim()) return q.focus();
      await api('POST', '/api/goals', { title: q.value.trim(), userId: S.me });
      toast(`Goal dikirim ke ${emp('aria')?.name || 'Chief of Staff'} — lihat tim bergerak`, 'ok');
      q.value = '';
    };
    ov.querySelector('#goalgo').onclick = send;
    ov.querySelector('#meetgo').onclick = () => meetingModal();
    ov.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => { const k = b.dataset.pm; if (k === 'exit') this.togglePlayer(); if (k === 'wave') office?.wave(); if (k === 'talk') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); }));
    this.feedTab = this.feedTab || 'comms';
    ov.querySelectorAll('[data-ft]').forEach((b) => (b.onclick = () => { this.feedTab = b.dataset.ft; ov.querySelectorAll('[data-ft]').forEach((x) => x.classList.toggle('active', x === b)); this.update(new Set(['*'])); }));
    ov.querySelector('#goalq').onkeydown = (e) => { if (e.key === 'Enter') send(); };
    ov.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => {
      const c = b.dataset.cam;
      if (!office) return;
      if (c === 'play') return OfficeView.togglePlayer();
      if (c === 'reset') office.resetView(); if (c === 'top') office.topView(); if (c === 'in') office.zoom(0.7); if (c === 'out') office.zoom(1.4);
      if (c === 'labels') office.toggleLabels();
      if (c === 'help') OfficeView.help();
      if (c === 'me') OfficeView.characterPicker();
      if (c === 'full') (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.());
    }));
    let collapsed = matchMedia('(max-width: 820px)').matches;
    const applyCollapse = () => { ov.querySelector('#ofeed').style.display = collapsed ? 'none' : ''; ov.querySelector('#feedtoggle').textContent = collapsed ? '▴' : '▾'; };
    ov.querySelector('#feedtoggle').onclick = () => { collapsed = !collapsed; applyCollapse(); };
    applyCollapse();
    bindCommon(ov);
    this.ov = ov;
    this.update(new Set(['*']));
    clearInterval(this.roomTimer);
    this.roomTimer = setInterval(() => this.renderRooms(), 2000);
  },
  renderRooms() {
    const ov = this.ov; if (!ov || !office) return;
    const st = office.stats();
    const color = (r) => div(r.id)?.color || '#e0c9a6';
    const html = st.rooms.map((r) => `<div class="room" data-room="${r.id}"><i style="background:${color(r)}"></i>${esc(r.name)}<b>${r.here}</b></div>`).join('') + `<div class="room"><i style="background:#555"></i>Koridor<b>${st.corridor}</b></div>`;
    this.roomsOpen ??= innerWidth >= 1500;
    const key = html + this.roomsOpen;
    if (key !== this.roomsHtml) {
      this.roomsHtml = key;
      ov.querySelector('#orooms').innerHTML = `<div class="mono" data-rt style="display:flex;justify-content:space-between;letter-spacing:.14em;font-weight:600;cursor:pointer;gap:16px"><span>SECTIONS ${this.roomsOpen ? '▾' : '▸'}</span><span class="faint">${st.rooms.length} · ${st.rooms.reduce((n, r) => n + r.here, 0)} agen</span></div>${this.roomsOpen ? `<div style="margin-top:4px">${html}</div>` : ''}`;
      ov.querySelector('[data-rt]').onclick = () => { this.roomsOpen = !this.roomsOpen; this.renderRooms(); };
      ov.querySelectorAll('[data-room]').forEach((x) => (x.onclick = () => office.focusZone(x.dataset.room)));
    }
  },
  update(colls) {
    if (office && (colls.has('*') || colls.has('employees') || colls.has('tasks') || colls.has('divisions'))) office.sync(D());
    const ov = this.ov; if (!ov) return;
    const k = kpis(); const d = D(); const h = d.host || {};
    ov.querySelector('#okpi').innerHTML = [
      [k.working, 'aktif'], [k.active, 'tugas'], [k.doneToday, 'selesai'], [k.approvals, 'approval'],
    ].map(([v, l], idx) => `<div class="glass kpi-mini" ${idx === 3 && v ? 'style="border-color:var(--warn);cursor:pointer" data-go="approvals"' : ''}><b>${v}</b><span>${l}</span></div>`).join('');
    ov.querySelector('[data-go]')?.addEventListener('click', () => navigate('approvals'));
    const s = d.settings;
    const ai = d.employees.filter((e) => e.type === 'ai');
    const meter = (v) => (v == null ? '–' : `${v}%<span class="meter"><i style="width:${v}%"></i></span>`);
    const up = (sec = 0) => sec > 3600 ? `${Math.floor(sec / 3600)}j ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m ${sec % 60}d`;
    const prov = d.provider || (d.live ? 'claude' : 'sim');
    const state = !s.autonomy ? 'paused · engine idle' : prov === 'groq' ? 'online · groq live' : prov === 'claude' ? 'online · claude live' : 'online · simulasi';
    const activeModel = prov === 'groq' ? s.groqModel : s.model;
    ov.querySelector('#ohud').innerHTML = `<div class="hud-h">RAY // OFFICE <span>${d.live ? 'live' : 'sim'}</span></div>
      <div class="kv"><span>Status</span><span><i class="live-dot ${!s.autonomy || !d.live ? 'sim-dot' : ''}"></i>${state}</span></div>
      <div class="kv"><span>Build</span><span>v1.1.0 · agora</span></div>
      <div class="kv"><span>Agents</span><span>${ai.length} AI · ${d.employees.length - ai.length} human / ${ai.filter((e) => e.status === 'working' || e.status === 'meeting').length} active</span></div>
      <div class="kv"><span>Sessions</span><span>${d.tasks.filter((t) => t.status === 'in_progress').length} running · ${d.tasks.filter((t) => t.status === 'waiting').length} waiting</span></div>
      <div class="kv"><span>Model</span><span>${esc(activeModel || '-')}</span></div>
      <div class="kv"><span>Tokens</span><span>${num(d.usage.tokensIn + d.usage.tokensOut)} · ${usd(d.usage.costToday)}/${usd(s.dailyBudgetUSD)}</span></div>
      <div class="kv"><span>Brain</span><span>${d.notes.length} notes · ${d.skills?.length || 0} skills</span></div>
      <div class="kv"><span>Host</span><span>CPU ${meter(h.cpu)} MEM ${meter(h.mem)}</span></div>
      <div class="kv"><span>Disk</span><span>${meter(h.disk)} · up ${up(h.uptime)}</span></div>`;
    if (this.talkId && (colls.has('messages') || colls.has('employees')) && !this.ov.querySelector('#ptin:focus')) this.renderTalk(false);
    else if (this.talkId && colls.has('messages')) { const box = this.ov.querySelector('.ptalk-msgs'); const n = D().messages.filter((m) => m.channelId === this.talkCh).length; if (n !== this.talkN) { this.talkN = n; const v = this.ov.querySelector('#ptin').value; this.renderTalk(true); this.ov.querySelector('#ptin').value = v; } }
    if (this.feedTab === 'comms') {
      if (!colls.has('messages') && !colls.has('*')) return;
      const msgs = d.messages.filter((m) => emp(m.authorId)?.type === 'ai').slice(-40).reverse();
      const seen = this.seenM || 0; this.seenM = msgs[0]?.t || seen;
      ov.querySelector('#ofeed').innerHTML = msgs.map((m) => commsItem(m, seen && m.t > seen)).join('') || '<div class="empty small">Belum ada percakapan. Agen akan berdiskusi, rapat, dan berkonsultasi di sini.</div>';
      ov.querySelector('#feedcount').textContent = d.messages.length;
      ov.querySelectorAll('[data-goch]').forEach((x) => (x.onclick = () => navigate('chat', { ch: x.dataset.goch })));
      return;
    }
    if (!colls.has('events') && !colls.has('*')) return;
    const evs = d.events.slice(-40).reverse();
    const seen = this.seenT || 0; this.seenT = evs[0]?.t || seen;
    ov.querySelector('#ofeed').innerHTML = evs.map((e) => feedItem(e, seen && e.t > seen)).join('') || '<div class="empty small">Belum ada aktivitas. Kirim goal pertama di bawah.</div>';
    ov.querySelector('#feedcount').textContent = d.events.length;
  },
  togglePlayer() {
    if (!office) return;
    const ov = this.ov;
    if (office.isPlayer()) { office.exitPlayer(); return this.playerUI(false); }
    if (!office.enterPlayer(S.me)) return toast('Karakter Anda belum ada di kantor', 'warn');
    this.playerUI(true);
    toast('🎮 Anda masuk ke kantor. Dekati rekan lalu tekan E untuk bicara.', 'ok');
  },
  playerUI(on) {
    const ov = this.ov; if (!ov) return;
    ov.querySelector('#phud').hidden = !on;
    ov.querySelector('#pmobile').hidden = !on || !matchMedia('(pointer: coarse)').matches;
    ov.querySelector('[data-cam="play"]').textContent = on ? '■ EXIT' : '▶ PLAY';
    ov.classList.toggle('playing', on);
    if (!on) { ov.querySelector('#phint').hidden = true; ov.querySelector('#ptalk').hidden = true; this.talkId = null; }
  },
  playerHint(h) {
    const el = this.ov?.querySelector('#phint'); if (!el) return;
    if (!office?.isPlayer()) { el.hidden = true; return; }
    if (!h) { el.hidden = true; return; }
    el.hidden = false;
    const e = h.type === 'agent' ? emp(h.id) : null;
    el.innerHTML = h.type === 'agent'
      ? `${avatar(e)}<div><b>${esc(h.label)}</b><div class="small muted">${esc(h.sub || '')} · ${esc(e?.statusText || '')}</div></div><span class="key">E</span> bicara <span class="key">F</span> beri tugas`
      : `<div><b>${esc(h.label)}</b><div class="small muted">${esc(h.sub || '')}</div></div><span class="key">E</span> gunakan`;
  },
  async playerAction(h, kind) {
    if (h.type === 'agent') {
      if (kind === 'task') return newTaskModal({ assigneeId: h.id });
      office?.summon?.(h.id);
      return this.talkTo(h.id);
    }
    if (h.id.startsWith('div:')) return divisionDrawer(h.id.slice(4));
    if (h.id === 'brain') return navigate('brain', { graph: 1 });
    if (h.id === 'meeting') return meetingModal();
    if (h.id === 'board') { const m = (D().meetings || []).at(-1); return m ? navigate('chat', { ch: `mtg-${m.id}` }) : toast('Belum ada rapat', 'warn'); }
    if (h.id === 'coffee') { office.wave(); return toast('☕ Kopi siap. Energi +10', 'ok'); }
    if (h.id === 'lounge') return toast('🛋️ Santai sejenak… agen di sekitar Anda tetap bekerja.', 'ok');
  },
  async talkTo(id) {
    const e = emp(id); if (!e || e.id === S.me) return;
    if (this.talkId && this.talkId !== id) office?.endTalk?.(this.talkId);
    if (office?.isPlayer()) office.summon?.(id);
    office?.express?.(id, e.type === 'ai' ? '👋' : '🙂', 'wave');
    const r = await api('POST', '/api/dm', { with: id, userId: S.me });
    this.talkId = id; this.talkCh = r.id;
    this.renderTalk(true);
  },
  renderTalk(focus) {
    const el = this.ov?.querySelector('#ptalk'); if (!el || !this.talkId) return;
    const e = emp(this.talkId);
    const msgs = D().messages.filter((m) => m.channelId === this.talkCh).slice(-6);
    const typing = el.querySelector('input')?.value || '';
    el.hidden = false;
    el.innerHTML = `<div class="row" style="margin-bottom:6px">${avatar(e)}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b><div class="small muted">${esc(e.title)} · ${esc(e.statusText || '')}</div></div><button class="btn sm ghost" data-tk="full">Buka chat</button><button class="btn sm ghost" data-tk="close">✕</button></div>
      <div class="ptalk-msgs">${msgs.map((m) => `<div class="ptalk-m ${m.authorId === S.me ? 'me' : ''}"><div class="md">${md(m.text.slice(0, 900))}</div></div>`).join('') || `<div class="small muted">Sapa ${esc(e.name)}… mis. “${esc((e.starters || [])[0] || 'Apa yang sedang kamu kerjakan?')}”</div>`}</div>
      <div class="row" style="margin-top:6px"><input class="input" id="ptin" placeholder="Bicara dengan ${esc(e.name)}…" value="${esc(typing)}"><button class="btn primary" data-tk="send">Kirim</button></div>`;
    const box = el.querySelector('.ptalk-msgs'); box.scrollTop = box.scrollHeight;
    const input = el.querySelector('#ptin');
    const send = async () => { const text = input.value.trim(); if (!text) return; input.value = ''; office?.listen?.(this.talkId); await api('POST', '/api/messages', { channelId: this.talkCh, text, userId: S.me }); };
    el.querySelector('[data-tk="send"]').onclick = send;
    const close = () => { el.hidden = true; office?.endTalk?.(this.talkId); this.talkId = null; };
    input.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') send(); if (ev.key === 'Escape') close(); };
    input.onkeyup = (ev) => ev.stopPropagation();
    el.querySelector('[data-tk="close"]').onclick = close;
    el.querySelector('[data-tk="full"]').onclick = () => navigate('chat', { ch: this.talkCh });
    if (focus) input.focus();
  },
  /** Compact card for the agent the camera is following (replaces opening the drawer on click). */
  followCard(id) {
    const el = this.ov?.querySelector('#ofollow'); if (!el) return;
    clearInterval(this.followTimer);
    if (!id) { el.hidden = true; return; }
    const draw = () => {
      const e = emp(id); if (!e) return;
      const t = D().tasks.find((x) => x.id === e.currentTaskId);
      el.hidden = false;
      el.innerHTML = `<div class="row">${avatar(e)}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b> <span class="status-dot st-${e.status}"></span><div class="small muted">${esc(e.title)}${e.team ? ' · ' + esc(e.team) : ''}</div></div><span class="chip mono">📷 IKUTI</span></div>
        <div class="small" style="margin:8px 0 2px">${esc(e.statusText || STATUS_LABEL[e.status] || '')}</div>${t ? `<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${esc(t.title)}</div>` : ''}
        ${e.mind?.mood ? `<div class="small muted">Mood: ${esc(e.mind.mood)} · confidence ${e.mind.confidence ?? '–'}</div>` : ''}
        <div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-fc="detail">Detail</button><button class="btn sm" data-fc="chat">Chat</button><button class="btn sm" data-fc="task">＋ Tugas</button><span style="flex:1"></span><button class="btn sm ghost" data-fc="stop" title="Esc">✕</button></div>
        <div class="small faint mono" style="margin-top:6px">drag = putar kamera · Tab = agen berikutnya · Esc = berhenti</div>`;
      el.querySelector('[data-fc="detail"]').onclick = () => agentDrawer(id);
      el.querySelector('[data-fc="chat"]').onclick = async () => { const r = await api('POST', '/api/dm', { with: id, userId: S.me }); navigate('chat', { ch: r.id }); };
      el.querySelector('[data-fc="task"]').onclick = () => newTaskModal({ assigneeId: id });
      el.querySelector('[data-fc="stop"]').onclick = () => office?.stopChase();
    };
    draw(); this.followTimer = setInterval(draw, 2500);
  },
  /** Enscape-style controls reference. */
  help(show) {
    const el = this.ov?.querySelector('#ohelp'); if (!el) return;
    const on = show === undefined ? el.hidden : show; el.hidden = !on; if (!on) return;
    const k = (...ks) => ks.map((x) => `<span class="kbd">${x}</span>`).join('');
    const rows = (title, list) => `<div class="hp-sec">${title}</div>` + list.map(([l, keys]) => `<div class="hp-row"><span>${l}</span><span>${keys}</span></div>`).join('');
    el.innerHTML = `<div class="row" style="margin-bottom:6px"><b style="flex:1">Bantuan [H]</b><button class="btn sm ghost" data-hx>✕</button></div>
      <div class="hp-tabs"><button class="on" data-hp="nav">Navigasi</button><button data-hp="play">Mode Karakter</button></div>
      <div data-hpv="nav">${rows('Dasar', [['Gerak', k('W', 'A', 'S', 'D')], ['Naik / Turun', k('E', 'Q')], ['Jalan sebagai karakter', k('Space')], ['Putar kamera', '🖱 kiri + drag'], ['Geser (pan)', '🖱 kanan + drag'], ['Zoom', '🖱 scroll'], ['Teleport', '🖱 klik ganda lantai'], ['Ikuti agen', '🖱 klik agen'], ['Agen berikutnya', k('Tab')]])}
        ${rows('Lanjutan', [['Keluar / tutup', k('Esc')], ['Gerak cepat', k('⇧')], ['Gerak sangat cepat', k('Alt')], ['Tampilan standar', k('8', '4', '5', '6', '2')], ['Posisi awal', k('0')], ['Waktu (pagi ↔ malam)', k('U') + ' / ' + k('I')], ['Sudut matahari', k('⇧') + '+' + k('U') + ' / ' + k('I')], ['Simpan tampilan favorit', k('B')], ['Favorit sebelumnya / berikutnya', k('PgUp', 'PgDn')], ['Label nama', k('L')]])}</div>
      <div data-hpv="play" hidden>${rows('Mode Karakter', [['Jalan', k('W', 'A', 'S', 'D')], ['Lari', k('⇧')], ['Putar', k('Q', 'R') + ' / drag'], ['Lompat', k('Space')], ['Lambai', k('G')], ['Panggil & bicara (agen menghampiri)', k('E')], ['Beri tugas', k('F')], ['Keluar', k('Esc')]])}
        <div class="small muted" style="margin-top:8px">Tekan <b>E</b> di dekat agen: dia akan berjalan ke depanmu, menatap, mendengarkan, lalu menjawab dengan ekspresi.</div></div>`;
    el.querySelector('[data-hx]').onclick = () => (el.hidden = true);
    el.querySelectorAll('[data-hp]').forEach((b) => (b.onclick = () => { el.querySelectorAll('[data-hp]').forEach((x) => x.classList.toggle('on', x === b)); el.querySelectorAll('[data-hpv]').forEach((v) => (v.hidden = v.dataset.hpv !== b.dataset.hp)); }));
  },
  chip(text) {
    const el = this.ov?.querySelector('#ochip'); if (!el) return;
    el.textContent = text; el.hidden = false; clearTimeout(this.chipT); this.chipT = setTimeout(() => (el.hidden = true), 1600);
  },
  /** Choose the player's character: female/male, hair style, skin tone, hair colour, glasses. */
  characterPicker() {
    const me = emp(S.me); if (!me) return;
    const ap = { gender: 'female', hairStyle: '', skin: 1, hair: 1, glasses: false, ...(me.appearance || {}) };
    const STY = { female: [['long', 'Panjang'], ['bob', 'Bob'], ['bun', 'Cepol'], ['ponytail', 'Kuncir'], ['hijab', 'Hijab'], ['curly', 'Keriting']], male: [['crop', 'Cepak'], ['side', 'Belah samping'], ['quiff', 'Quiff'], ['curly', 'Keriting'], ['bald', 'Plontos']] };
    const SK = ['#f3d2b8', '#e7b995', '#d29e76', '#b27a54', '#8c5a3a', '#6b4128'], HR = ['#1b1411', '#2e1f17', '#4a3022', '#6b4a2e', '#0d0d0f', '#8a6a4a', '#b7b0a6'];
    const body = () => `<div class="pick-row"><span>Jenis kelamin</span><div class="seg">${[['female', '👩 Wanita'], ['male', '👨 Pria']].map(([v, l]) => `<button class="${ap.gender === v ? 'on' : ''}" data-g="${v}">${l}</button>`).join('')}</div></div>
      <div class="pick-row"><span>Gaya rambut</span><div class="seg wrap">${STY[ap.gender].map(([v, l]) => `<button class="${ap.hairStyle === v ? 'on' : ''}" data-h="${v}">${l}</button>`).join('')}</div></div>
      <div class="pick-row"><span>Warna kulit</span><div class="swatches">${SK.map((c, i) => `<button style="background:${c}" class="${ap.skin === i ? 'on' : ''}" data-s="${i}"></button>`).join('')}</div></div>
      <div class="pick-row"><span>Warna rambut</span><div class="swatches">${HR.map((c, i) => `<button style="background:${c}" class="${ap.hair === i ? 'on' : ''}" data-c="${i}"></button>`).join('')}</div></div>
      <label class="pick-row"><span>Kacamata</span><input type="checkbox" data-gl ${ap.glasses ? 'checked' : ''}></label>`;
    modal('👤 Karakter saya', `<div id="pickbox">${body()}</div><div class="small muted" style="margin-top:8px">Perubahan langsung terlihat di kantor 3D (dan di mode Play).</div>`, {
      onMount: (el) => {
        const box = el.querySelector('#pickbox');
        const bind = () => {
          box.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { ap.gender = b.dataset.g; ap.hairStyle = ''; box.innerHTML = body(); bind(); }));
          box.querySelectorAll('[data-h]').forEach((b) => (b.onclick = () => { ap.hairStyle = b.dataset.h; box.innerHTML = body(); bind(); }));
          box.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { ap.skin = +b.dataset.s; box.innerHTML = body(); bind(); }));
          box.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { ap.hair = +b.dataset.c; box.innerHTML = body(); bind(); }));
          box.querySelector('[data-gl]').onchange = (ev) => (ap.glasses = ev.target.checked);
        };
        bind();
      },
      actions: [{ label: 'Batal' }, { label: 'Simpan karakter', kind: 'primary', run: async () => { const clean = { ...ap }; if (!clean.hairStyle) delete clean.hairStyle; await api('PATCH', `/api/employees/${S.me}`, { appearance: clean }); toast('✨ Karakter diperbarui', 'ok'); } }],
    });
  },
  unmount(root) { if (office?.isPlayer()) office.exitPlayer(); clearInterval(this.roomTimer); clearInterval(this.followTimer); office?.stopChase?.(); office?.setVisible(false); officeRoot?.remove(); this.ov?.remove(); this.ov = null; this.roomsHtml = ''; root.style.overflow = ''; },
};

// ═════════════════════ DASHBOARD ═════════════════════
export const DashboardView = {
  mount(root) {
    root.innerHTML = `<div class="page">
      <div class="kpi-grid" id="dk"></div>
      <div class="dash">
        <div style="display:grid;gap:16px">
          <div class="card"><div class="card-h">🎯 Goal Perusahaan<span style="flex:1"></span><span class="muted small">AI Chief of Staff memecahnya ke divisi</span></div>
            <div class="card-b" style="display:grid;gap:10px">
              <input class="input" id="gt" placeholder="Apa yang ingin dicapai? mis. Tingkatkan penjualan paket Growth 30% bulan ini">
              <textarea class="input" id="gd" rows="2" placeholder="Konteks tambahan, batasan, target, deadline (opsional)"></textarea>
              <div class="row"><select class="input" id="gp" style="width:auto">${opt('high', PRIO.high, 'high')}${opt('medium', PRIO.medium)}${opt('low', PRIO.low)}</select><span style="flex:1"></span><button class="btn primary" id="gsend">🚀 Jalankan goal</button></div>
              <div id="goals" style="display:grid;gap:8px"></div>
            </div></div>
          <div class="card"><div class="card-h">🏢 Divisi<span style="flex:1"></span><button class="btn sm" data-nav="team">Kelola tim</button></div><div class="card-b"><div class="div-grid" id="dd"></div></div></div>
        </div>
        <div style="display:grid;gap:16px">
          <div class="card"><div class="card-h">🛑 Menunggu persetujuan <span class="badge" id="apc">0</span></div><div class="card-b" id="dap" style="display:grid;gap:8px"></div></div>
          <div class="card"><div class="card-h">📈 Throughput 12 jam</div><div class="card-b"><div class="spark" id="spark"></div><div class="row small muted" style="justify-content:space-between;margin-top:6px"><span>-12j</span><span>sekarang</span></div></div></div>
          <div class="card"><div class="card-h">📡 Aktivitas</div><div class="feed" id="dfeed" style="max-height:420px"></div></div>
        </div>
      </div></div>`;
    root.querySelector('#gsend').onclick = async () => {
      const title = root.querySelector('#gt').value.trim();
      if (!title) return root.querySelector('#gt').focus();
      await api('POST', '/api/goals', { title, description: root.querySelector('#gd').value, priority: root.querySelector('#gp').value, userId: S.me });
      root.querySelector('#gt').value = ''; root.querySelector('#gd').value = '';
      toast('🎯 Goal diterima. Tim mulai bekerja.', 'ok');
    };
    root.querySelector('[data-nav]').onclick = () => navigate('team');
    bindCommon(root);
    this.root = root; this.update();
  },
  update() {
    const r = this.root; const k = kpis(); const d = D();
    r.querySelector('#dk').innerHTML = [
      ['Karyawan AI', k.ai, `${k.humans} manusia`], ['Sedang aktif', k.working, 'bekerja / rapat'], ['Tugas aktif', k.active, `${d.tasks.filter((t) => t.status === 'in_progress').length} dikerjakan`],
      ['Selesai hari ini', k.doneToday, `${d.tasks.filter((t) => t.status === 'done').length} total`], ['Approval', k.approvals, 'butuh keputusan manusia'],
      ['Biaya AI hari ini', usd(k.cost), `budget ${usd(d.settings.dailyBudgetUSD)} · ${num(d.usage.tokensIn + d.usage.tokensOut)} token`],
    ].map(([l, v, s]) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const goals = d.tasks.filter((t) => t.kind === 'goal').slice(-6).reverse();
    r.querySelector('#goals').innerHTML = goals.map((g) => {
      const all = descendants(g.id); const done = all.filter((t) => t.status === 'done').length;
      const pct = g.status === 'done' ? 100 : all.length ? Math.round((done / all.length) * 90) : 5;
      return `<div class="tcard" data-task="${g.id}" style="--c:var(--accent)"><div class="row"><div class="tt" style="flex:1">${esc(g.title)}</div>${statusChip(g.status)}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="meta">${done}/${all.length} subtugas · ${[...new Set(all.map((t) => t.divisionId))].map((x) => div(x)?.icon).join(' ')} · ${ago(g.createdAt)}</div></div>`;
    }).join('') || '<div class="muted small">Belum ada goal. Coba: “Siapkan peluncuran fitur integrasi WhatsApp”.</div>';
    r.querySelector('#dd').innerHTML = d.divisions.map((x) => {
      const members = d.employees.filter((e) => e.divisionId === x.id);
      const ts = d.tasks.filter((t) => t.divisionId === x.id);
      const done = ts.filter((t) => t.status === 'done').length;
      return `<div class="div-card" style="--c:${x.color}" data-div="${x.id}"><div class="row"><b>${x.icon} ${esc(x.name)}</b><span style="flex:1"></span><span class="chip">${members.filter((e) => e.status === 'working').length}/${members.length} aktif</span></div>
        <div class="faces">${members.slice(0, 8).map((e) => avatar(e)).join('')}</div>
        <div class="bar"><i style="width:${ts.length ? (done / ts.length) * 100 : 0}%"></i></div><div class="small muted">${ts.length - done} aktif · ${done} selesai</div></div>`;
    }).join('');
    r.querySelectorAll('[data-div]').forEach((c) => (c.onclick = () => divisionDrawer(c.dataset.div)));
    const aps = d.approvals.filter((a) => a.status === 'pending');
    r.querySelector('#apc').textContent = aps.length;
    r.querySelector('#dap').innerHTML = aps.slice(0, 6).map(approvalCard).join('') || '<div class="muted small">Tidak ada yang menunggu. 👌</div>';
    bindApprovalButtons(r.querySelector('#dap'));
    const now = Date.now(); const buckets = Array(12).fill(0);
    for (const t of d.tasks) if (t.completedAt && now - t.completedAt < 12 * 3600e3) buckets[11 - Math.floor((now - t.completedAt) / 3600e3)]++;
    const max = Math.max(1, ...buckets);
    r.querySelector('#spark').innerHTML = buckets.map((b) => `<i style="height:${(b / max) * 100}%" title="${b} tugas"></i>`).join('');
    r.querySelector('#dfeed').innerHTML = d.events.slice(-60).reverse().map((e) => feedItem(e)).join('') || '<div class="empty">Belum ada aktivitas</div>';
  },
};
const descendants = (id) => { const out = []; const walk = (p) => { for (const t of D().tasks) if (t.parentId === p) { out.push(t); walk(t.id); } }; walk(id); return out; };
const statusChip = (s) => { const c = TASK_COLS.find((c) => c.id === s || c.also?.includes(s)); return `<span class="chip" style="${s === 'blocked' ? 'color:var(--bad)' : s === 'review' ? 'color:var(--warn)' : s === 'done' ? 'color:var(--ok)' : ''}">${c?.icon || ''} ${s === 'blocked' ? 'Diblokir' : c?.label || s}</span>`; };

function approvalCard(a) {
  const r = emp(a.requesterId); const t = task(a.taskId);
  return `<div class="tcard" style="--c:var(--warn)" data-task="${a.taskId}"><div class="row">${avatar(r)}<div style="flex:1;min-width:0"><div class="tt">${esc(a.title)}</div><div class="small muted">${esc(r?.name)} · ${ago(a.createdAt)}${t?.revisions ? ` · revisi ${t.revisions}` : ''}</div></div></div>${a.summary ? `<div class="small muted">${esc(a.summary.slice(0, 180))}</div>` : ''}<div class="row"><button class="btn sm ok" data-approve="${a.id}">✓ Setujui</button><button class="btn sm" data-reject="${a.id}">✏️ Revisi</button><span style="flex:1"></span><button class="btn sm ghost" data-task="${a.taskId}">Lihat hasil →</button></div></div>`;
}
function bindApprovalButtons(root) {
  root.querySelectorAll('[data-approve]').forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await api('POST', `/api/approvals/${b.dataset.approve}`, { decision: 'approve', userId: S.me }); toast('Disetujui ✅', 'ok'); }));
  root.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); rejectModal(b.dataset.reject); }));
}
function rejectModal(id) {
  modal('✏️ Minta revisi', `<label class="f">Apa yang perlu diperbaiki?<textarea class="input" name="fb" rows="4" placeholder="mis. Buat lebih singkat, tambahkan estimasi biaya, fokus ke segmen F&B"></textarea></label>`, {
    actions: [{ label: 'Batal' }, { label: 'Kirim revisi', kind: 'primary', run: async (b) => { await api('POST', `/api/approvals/${id}`, { decision: 'reject', feedback: formData(b).fb, userId: S.me }); toast('Revisi dikirim ke agen', 'ok'); } }],
  });
}

// ═════════════════════ TASKS (Kanban) ═════════════════════
export const TasksView = {
  mount(root) {
    this.f = this.f || { q: '', div: '', who: '', top: false, lens: '', view: 'kanban', month: Date.now(), sort: 'due' };
    root.innerHTML = `<div class="toolbar">
        <input class="input" id="tq" placeholder="🔎 Cari tugas…" style="min-width:180px;flex:1;max-width:320px" value="${esc(this.f.q)}">
        <select class="input" id="tdiv"><option value="">Semua divisi</option>${D().divisions.map((d) => opt(d.id, d.icon + ' ' + d.name, this.f.div)).join('')}</select>
        <select class="input" id="twho"><option value="">Semua orang</option>${opt('__me', '👤 Tugas saya', this.f.who)}${empOptions(this.f.who)}</select>
        <label class="row small muted" style="gap:6px"><input type="checkbox" id="ttop" ${this.f.top ? 'checked' : ''}> Hanya tugas utama</label>
        <span style="flex:1"></span>
        <div class="view-switch" id="tview">${[['kanban', '▥ Kanban'], ['calendar', '📅 Kalender'], ['timeline', '⏱ Timeline'], ['list', '☰ Daftar']].map(([v, l]) => `<button data-v="${v}" class="${this.f.view === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <button class="btn" id="tgoal2">🎯 Goal</button>
        <button class="btn primary" id="tnew">＋ Tugas</button>
      </div><div class="insight" id="tins"></div><div class="kanban" id="kb"></div>`;
    root.querySelector('#tgoal2').onclick = () => goalModal();
    root.querySelectorAll('#tview [data-v]').forEach((b) => (b.onclick = () => { this.f.view = b.dataset.v; root.querySelectorAll('#tview [data-v]').forEach((x) => x.classList.toggle('on', x === b)); this.update(); }));
    const set = (k, v) => { this.f[k] = v; this.update(); };
    root.querySelector('#tq').oninput = (e) => set('q', e.target.value);
    root.querySelector('#tdiv').onchange = (e) => set('div', e.target.value);
    root.querySelector('#twho').onchange = (e) => set('who', e.target.value);
    root.querySelector('#ttop').onchange = (e) => set('top', e.target.checked);
    root.querySelector('#tnew').onclick = () => newTaskModal();
    bindCommon(root);
    this.root = root; this.update();
  },
  update() {
    const f = this.f; const q = f.q.toLowerCase();
    const running = new Set((D().running || []).map((r) => r.taskId));
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const LENS = {
      running: ['⚡ Sedang dikerjakan', (t) => running.has(t.id) || t.status === 'in_progress'],
      blocked: ['⛔ Macet', (t) => t.status === 'blocked' || (t.failures || 0) > 0 && t.status !== 'done'],
      review: ['🛑 Butuh keputusan', (t) => t.status === 'review'],
      high: ['🔥 Prioritas tinggi', (t) => t.priority === 'high' && t.status !== 'done'],
      today: ['✅ Selesai hari ini', (t) => t.status === 'done' && (t.completedAt || 0) >= day.getTime()],
      ai: ['🤖 Inisiatif agen', (t) => emp(t.createdBy)?.type === 'ai' && !t.parentId],
    };
    const base = D().tasks.filter((t) => (!f.div || t.divisionId === f.div) && (!f.who || t.assigneeId === (f.who === '__me' ? S.me : f.who)) && (!f.top || !t.parentId) && (!q || `${t.title} ${t.description || ''} ${emp(t.assigneeId)?.name || ''}`.toLowerCase().includes(q)));
    const list = f.lens && LENS[f.lens] ? base.filter(LENS[f.lens][1]) : base;
    const done = base.filter((t) => t.status === 'done' && t.completedAt && t.createdAt);
    const cycle = done.length ? done.slice(-40).reduce((a, t) => a + (t.completedAt - t.createdAt), 0) / Math.min(40, done.length) / 60000 : 0;
    const cost = base.reduce((a, t) => a + (t.cost || 0), 0);
    this.root.querySelector('#tins').innerHTML = Object.entries(LENS).map(([k, [l, fn]]) => `<button class="lens ${f.lens === k ? 'on' : ''}" data-lens="${k}"><b>${base.filter(fn).length}</b><span>${l}</span></button>`).join('') + `<div class="lens static"><b>${cycle ? (cycle < 60 ? cycle.toFixed(0) + ' mnt' : (cycle / 60).toFixed(1) + ' jam') : '–'}</b><span>⏱ Rata-rata selesai</span></div><div class="lens static"><b>${usd(cost)}</b><span>💰 Biaya AI</span></div>`;
    this.root.querySelectorAll('[data-lens]').forEach((b) => (b.onclick = () => { this.f.lens = this.f.lens === b.dataset.lens ? '' : b.dataset.lens; this.update(); }));
    const kb = this.root.querySelector('#kb');
    if (f.view !== 'kanban') { kb.className = { calendar: 'cal', timeline: 'tl', list: 'tlist' }[f.view]; return this[f.view](kb, list); }
    kb.className = 'kanban';
    const scrolls = [...kb.querySelectorAll('.col-b')].map((c) => c.scrollTop);
    kb.innerHTML = TASK_COLS.map((c) => {
      let items = list.filter((t) => t.status === c.id || c.also?.includes(t.status));
      items.sort((a, b) => (c.id === 'done' ? (b.completedAt || 0) - (a.completedAt || 0) : b.updatedAt - a.updatedAt));
      const more = items.length > 80 ? items.length - 80 : 0; items = items.slice(0, 80);
      return `<div class="col" data-col="${c.id}"><div class="col-h">${c.icon} ${c.label}<span class="badge soft">${list.filter((t) => t.status === c.id || c.also?.includes(t.status)).length}</span></div><div class="col-b">${items.map((t) => taskCard(t, running.has(t.id) || t.status === 'in_progress')).join('') || '<div class="empty small">Kosong</div>'}${more ? `<div class="muted small" style="text-align:center">+${more} lagi</div>` : ''}</div></div>`;
    }).join('');
    kb.querySelectorAll('.col-b').forEach((c, i) => (c.scrollTop = scrolls[i] || 0));
    // drag & drop status change
    kb.querySelectorAll('.tcard').forEach((el) => { el.draggable = true; el.ondragstart = (e) => e.dataTransfer.setData('text/plain', el.dataset.task); });
    kb.querySelectorAll('.col').forEach((col) => {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
      col.ondragleave = () => col.classList.remove('drop');
      col.ondrop = async (e) => { e.preventDefault(); col.classList.remove('drop'); const id = e.dataTransfer.getData('text/plain'); if (col.dataset.col === 'review') return toast('Review diisi otomatis saat agen meminta persetujuan', 'warn'); await api('PATCH', `/api/tasks/${id}`, { status: col.dataset.col, userId: S.me }); };
    });
  },
  /** Month calendar: tasks on their due date (or completion date), plus every scheduled cron routine run. */
  async calendar(el, list) {
    const m = new Date(this.f.month); m.setDate(1); m.setHours(0, 0, 0, 0);
    const start = new Date(m); start.setDate(1 - ((m.getDay() + 6) % 7)); // weeks start Monday
    const end = new Date(start); end.setDate(start.getDate() + 42);
    const key = `${start.getTime()}`;
    if (this.calKey !== key) { this.calKey = key; this.calRoutines = null; api('GET', `/api/calendar?from=${start.getTime()}&to=${end.getTime()}`).then((r) => { this.calRoutines = r; if (this.f.view === 'calendar') this.update(); }).catch(() => {}); }
    const day0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const byDay = new Map();
    const push = (t, item) => { const k = day0(t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(item); };
    for (const t of list) push(t.status === 'done' ? t.completedAt || t.dueAt || t.createdAt : t.dueAt || t.createdAt, { t });
    for (const r of this.calRoutines || []) push(r.at, { r });
    const today = day0(Date.now());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const k = d.getTime();
      const items = byDay.get(k) || [];
      const shown = items.slice(0, 5);
      cells.push(`<div class="cal-cell ${d.getMonth() !== m.getMonth() ? 'other' : ''} ${k === today ? 'today' : ''}"><div class="dn"><b>${d.getDate()}</b><span>${items.length || ''}</span></div>${shown.map((x) => x.t
        ? `<div class="cal-ev ${x.t.status === 'done' ? 'done' : ''}" style="--c:${div(x.t.divisionId)?.color}" data-task="${x.t.id}" title="${esc(x.t.title)} · ${esc(emp(x.t.assigneeId)?.name || '')}">${x.t.kind === 'goal' ? '🎯 ' : ''}${esc(x.t.title)}</div>`
        : `<div class="cal-ev routine" style="--c:${div(emp(x.r.employeeId)?.divisionId)?.color}" data-agent="${x.r.employeeId}" title="${esc(x.r.title)} · ${new Date(x.r.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}">🔁 ${new Date(x.r.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ${esc(x.r.title)}</div>`).join('')}${items.length > 5 ? `<div class="cal-more">+${items.length - 5} lagi</div>` : ''}</div>`);
    }
    el.innerHTML = `<div class="cal-h"><button class="btn sm" data-mo="-1">‹</button><b>${m.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</b><button class="btn sm" data-mo="1">›</button><button class="btn sm ghost" data-mo="0">Hari ini</button><span style="flex:1"></span><span class="small muted">📋 tugas (tenggat/selesai) · 🔁 jadwal cron agen</span></div>
      <div class="cal-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((x) => `<div class="cal-dow">${x}</div>`).join('')}${cells.join('')}</div>`;
    el.querySelectorAll('[data-mo]').forEach((b) => (b.onclick = () => { const v = +b.dataset.mo; const d = new Date(this.f.month); if (!v) this.f.month = Date.now(); else { d.setDate(1); d.setMonth(d.getMonth() + v); this.f.month = d.getTime(); } this.update(); }));
  },
  /** Gantt-style timeline: one lane per division, a bar per task from creation to completion (or now / due). */
  timeline(el, list) {
    const now = Date.now(); const span = this.f.span || 7;
    const from = now - span * 0.7 * 864e5, to = now + span * 0.3 * 864e5;
    const x = (t) => ((Math.min(Math.max(t, from), to) - from) / (to - from)) * 100;
    const ticks = Array.from({ length: span + 1 }, (_, i) => from + i * ((to - from) / span));
    const lanes = D().divisions.map((d) => [d, list.filter((t) => t.divisionId === d.id && (t.completedAt || now) >= from && t.createdAt <= to)]).filter(([, l]) => l.length);
    el.innerHTML = `<div class="cal-h"><b>Timeline kerja</b><div class="view-switch">${[3, 7, 14, 30].map((s) => `<button data-span="${s}" class="${span === s ? 'on' : ''}">${s} hari</button>`).join('')}</div><span style="flex:1"></span><span class="small muted">Bar = dibuat → selesai · arsiran = masih berjalan · garis merah = sekarang</span></div>
      <div class="tl-wrap"><div class="tl-lane" style="min-height:0"><b></b><div class="tl-axis" style="grid-template-columns:repeat(${span},1fr)">${ticks.slice(0, -1).map((t) => `<span>${new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}${span <= 3 ? ' ' + new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>`).join('')}</div></div>
      ${lanes.map(([d, l]) => { const rows = []; for (const t of l.sort((a, b) => a.createdAt - b.createdAt)) { const s = x(t.createdAt), e2 = x(t.completedAt || Math.max(now, t.dueAt || now)); let r = rows.findIndex((end) => end < s - 0.5); if (r < 0) { rows.push(0); r = rows.length - 1; } rows[r] = e2; t._row = r; t._s = s; t._e = e2; }
        return `<div class="tl-lane"><b><span style="color:${d.color}">${d.icon}</span>${esc(d.name)}</b><div class="tl-track" style="height:${Math.max(1, rows.length) * 26 + 10}px"><div class="tl-now" style="left:${x(now)}%"></div>${l.map((t) => `<div class="tl-bar ${t.status === 'done' ? '' : 'open'}" data-task="${t.id}" title="${esc(t.title)} · ${esc(emp(t.assigneeId)?.name || '')} · ${t.status}" style="left:${t._s}%;width:${Math.max(0.6, t._e - t._s)}%;top:${5 + t._row * 26}px;background:${d.color}">${esc(emp(t.assigneeId)?.name || '')}: ${esc(t.title)}</div>`).join('')}</div></div>`; }).join('') || '<div class="empty">Belum ada tugas pada rentang ini.</div>'}</div>`;
    el.querySelectorAll('[data-span]').forEach((b) => (b.onclick = () => { this.f.span = +b.dataset.span; this.update(); }));
  },
  /** Sortable table of every task. */
  list(el, list) {
    const S2 = { due: (a, b) => (a.dueAt || 9e15) - (b.dueAt || 9e15), prio: (a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]), status: (a, b) => a.status.localeCompare(b.status), updated: (a, b) => b.updatedAt - a.updatedAt, cost: (a, b) => (b.cost || 0) - (a.cost || 0) };
    const rows = [...list].sort(S2[this.f.sort] || S2.due).slice(0, 300);
    const overdue = (t) => t.status !== 'done' && t.dueAt && t.dueAt < Date.now();
    el.innerHTML = `<table><thead><tr><th>Tugas</th><th>Penanggung jawab</th><th data-s="status">Status</th><th data-s="prio">Prioritas</th><th data-s="due">Tenggat</th><th data-s="cost">Biaya</th><th data-s="updated">Update</th></tr></thead><tbody>${rows.map((t) => { const a = emp(t.assigneeId); const kids = D().tasks.filter((c) => c.parentId === t.id); return `<tr data-task="${t.id}"><td>${t.parentId ? '<span class="faint">↳ </span>' : ''}${t.kind === 'goal' ? '🎯 ' : t.kind === 'routine' ? '🔁 ' : ''}<b>${esc(t.title)}</b>${kids.length ? ` <span class="chip">${kids.filter((k) => k.status === 'done').length}/${kids.length}</span>` : ''}</td><td>${avatar(a)} ${esc(a?.name || '')}<div class="small faint">${esc(div(t.divisionId)?.name || '')}</div></td><td><span class="chip">${esc(t.status)}</span></td><td>${esc(PRIO[t.priority]?.label || t.priority)}</td><td style="${overdue(t) ? 'color:var(--bad)' : ''}">${t.dueAt ? new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '–'}${overdue(t) ? ' ⚠' : ''}</td><td class="mono small">${usd(t.cost || 0)}</td><td class="small muted">${ago(t.updatedAt)}</td></tr>`; }).join('')}</tbody></table>${list.length > 300 ? `<div class="small muted" style="margin-top:8px">Menampilkan 300 dari ${list.length}</div>` : ''}`;
    el.querySelectorAll('[data-s]').forEach((th) => (th.onclick = () => { this.f.sort = th.dataset.s; this.update(); }));
  },
};
function taskCard(t, running) {
  const a = emp(t.assigneeId); const d = div(t.divisionId);
  const kids = D().tasks.filter((c) => c.parentId === t.id);
  return `<div class="tcard ${running ? 'running' : ''}" style="--c:${d?.color}" data-task="${t.id}">
    <div class="tt">${t.kind === 'goal' ? '🎯 ' : t.kind === 'routine' ? '🔁 ' : ''}${esc(t.title)}</div>
    <div class="meta">${avatar(a)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a?.name || '?')}${a?.type === 'human' ? ' 👤' : ''}</span><span class="prio-${t.priority}">${PRIO[t.priority]?.split(' ')[0]}</span></div>
    <div class="meta"><span class="chip">${d?.icon} ${esc(d?.short || '')}</span>${kids.length ? `<span class="chip">🧩 ${kids.filter((k) => k.status === 'done').length}/${kids.length}</span>` : ''}${t.status === 'blocked' ? '<span class="chip" style="color:var(--bad)">⛔ blocked</span>' : ''}${running && a ? `<span class="chip" style="color:var(--ok)">⚡ ${esc(a.statusText || '')}</span>` : ''}<span style="margin-left:auto">${ago(t.updatedAt)}</span></div></div>`;
}

export function newTaskModal(pre = {}) {
  modal('＋ Tugas baru', `
    <label class="f">Judul<input class="input" name="title" value="${esc(pre.title || '')}" placeholder="mis. Tulis 3 artikel SEO tentang otomasi UMKM"></label>
    <label class="f">Brief / deskripsi<textarea class="input" name="description" rows="4" placeholder="Konteks, ekspektasi output, batasan, referensi [[Catatan]]">${esc(pre.description || '')}</textarea></label>
    <div class="grid2"><label class="f">Ditugaskan ke<select class="input" name="assigneeId">${empOptions(pre.assigneeId || 'aria')}</select></label>
    <label class="f">Prioritas<select class="input" name="priority">${opt('high', PRIO.high)}${opt('medium', PRIO.medium, 'medium')}${opt('low', PRIO.low)}</select></label></div>`, {
    actions: [{ label: 'Batal' }, { label: 'Buat tugas', kind: 'primary', run: async (b) => { const f = formData(b); if (!f.title.trim()) { toast('Judul wajib', 'warn'); return false; } const t = await api('POST', '/api/tasks', { ...f, userId: S.me }); toast(`Tugas dibuat untuk ${emp(t.assigneeId)?.name}`, 'ok'); } }],
  });
}
export function goalModal() {
  modal('🎯 Goal baru untuk perusahaan', `<label class="f">Goal<input class="input" name="title" placeholder="mis. Naikkan MRR 20% kuartal ini"></label><label class="f">Konteks<textarea class="input" name="description" rows="3"></textarea></label>`, {
    actions: [{ label: 'Batal' }, { label: '🚀 Jalankan', kind: 'primary', run: async (b) => { const f = formData(b); if (!f.title.trim()) return false; await api('POST', '/api/goals', { ...f, userId: S.me }); toast('Goal dikirim', 'ok'); } }],
  });
}

// ═════════════════════ TASK DRAWER ═════════════════════
const LOG_ICON = { created: '📥', started: '⚡', tool: '🔧', thought: '💭', delegate: '➡️', waiting: '⏳', resumed: '🔄', approval: '🛑', approved: '🎉', rejected: '✏️', done: '✅', error: '⚠️', comment: '💬', edit: '✎' };
export function taskDrawer(id) {
  drawer(() => {
    const t = task(id);
    if (!t) return null;
    const a = emp(t.assigneeId); const d = div(t.divisionId); const parent = t.parentId && task(t.parentId);
    const kids = D().tasks.filter((c) => c.parentId === t.id);
    const ap = D().approvals.find((x) => x.taskId === t.id && x.status === 'pending');
    const n = t.noteId && note(t.noteId);
    return {
      head: `<div style="min-width:0"><div class="small muted">${d?.icon} ${esc(d?.name)} · ${t.kind === 'goal' ? '🎯 Goal' : t.kind === 'routine' ? '🔁 Rutinitas' : 'Tugas'} · <code>${t.id}</code></div><div style="font-weight:700;font-size:15px;line-height:1.3">${esc(t.title)}</div></div>`,
      body: `
        <div class="row wrap">${statusChip(t.status)}<span class="chip prio-${t.priority}">${PRIO[t.priority]}</span>${t.revisions ? `<span class="chip">revisi ${t.revisions}</span>` : ''}<span class="chip">dibuat ${ago(t.createdAt)} oleh ${esc(emp(t.createdBy)?.name || t.createdBy)}</span></div>
        ${ap ? `<div class="card" style="border-color:var(--warn)"><div class="card-b" style="display:grid;gap:8px"><b>🛑 ${esc(a?.name)} meminta persetujuan Anda</b><div class="row"><button class="btn ok" data-approve="${ap.id}">✓ Setujui</button><button class="btn" data-reject="${ap.id}">✏️ Minta revisi</button></div></div></div>` : ''}
        ${a?.type === 'human' && t.status !== 'done' ? `<div class="card" style="border-color:var(--accent)"><div class="card-b" style="display:grid;gap:8px"><b>👤 Tugas untuk manusia (${esc(a.name)})</b><textarea class="input" id="hout" rows="3" placeholder="Tulis hasil / catatan penyelesaian">${esc(t.output || '')}</textarea><div class="row"><button class="btn primary" id="hdone">✓ Tandai selesai</button></div></div></div>` : ''}
        <div class="sec"><h4>Pelaksana</h4><div class="row">${avatar(a)}<div style="flex:1;min-width:0"><b data-agent="${a?.id}" style="cursor:pointer">${esc(a?.name)}</b><div class="small muted">${esc(a?.title)} · ${esc(a?.statusText || '')}</div></div><select class="input" id="reassign" style="width:auto;max-width:170px">${empOptions(t.assigneeId)}</select></div></div>
        <div class="row wrap">
          <select class="input" id="tstatus" style="width:auto">${['todo', 'in_progress', 'waiting', 'blocked', 'done'].map((s) => opt(s, { todo: 'To Do', in_progress: 'Dikerjakan', waiting: 'Menunggu', blocked: 'Diblokir', done: 'Selesai' }[s], t.status)).join('')}${t.status === 'review' ? opt('review', 'Review', 'review') : ''}</select>
          <select class="input" id="tprio" style="width:auto">${['high', 'medium', 'low'].map((p) => opt(p, PRIO[p], t.priority)).join('')}</select>
          ${t.status === 'blocked' || t.status === 'done' ? '<button class="btn sm" id="retry">🔄 Jalankan ulang</button>' : ''}
          <span style="flex:1"></span><button class="btn sm danger" id="tdel">Hapus</button>
        </div>
        ${parent ? `<div class="sec"><h4>Tugas induk</h4><div class="bl" data-task="${parent.id}">⬆️ ${esc(parent.title)} ${statusChip(parent.status)}</div></div>` : ''}
        ${kids.length ? `<div class="sec"><h4>Subtugas (${kids.filter((k) => k.status === 'done').length}/${kids.length})</h4><div style="display:grid;gap:6px">${kids.map((k) => `<div class="bl row" data-task="${k.id}">${avatar(emp(k.assigneeId))}<span style="flex:1;min-width:0">${esc(k.title)}</span>${statusChip(k.status)}</div>`).join('')}</div></div>` : ''}
        ${t.description ? `<div class="sec"><h4>Brief</h4><div class="md small">${md(t.description)}</div></div>` : ''}
        ${t.output ? `<div class="sec"><h4>Hasil kerja ${n ? `<a data-note="${n.id}" style="cursor:pointer;text-transform:none;letter-spacing:0">· buka di Brain →</a>` : ''}</h4><div class="output md">${md(t.output)}</div></div>` : ''}
        <div class="sec"><h4>Jejak kerja (observability)</h4><div class="trace">${(t.log || []).slice().reverse().map((l) => `<div class="trace-i ${l.type}"><div class="ico">${LOG_ICON[l.type] || '•'}</div><div><div class="txt">${l.type === 'thought' ? esc(l.text) : `<b>${esc(emp(l.actorId)?.name || l.actorId)}</b> ${esc(l.text)}`}</div><div class="when">${new Date(l.t).toLocaleString('id-ID')}</div></div></div>`).join('')}</div></div>
        <div class="sec"><h4>Komentar</h4><div class="row"><input class="input" id="tc" placeholder="Tambahkan arahan untuk agen…"><button class="btn" id="tcs">Kirim</button></div></div>`,
      mount(el) {
        bindCommon(el);
        bindApprovalButtons(el);
        const patch = (b) => api('PATCH', `/api/tasks/${t.id}`, { ...b, userId: S.me });
        el.querySelector('#reassign').onchange = (e) => patch({ assigneeId: e.target.value, status: t.status === 'done' ? 'done' : 'todo' });
        el.querySelector('#tstatus').onchange = (e) => patch({ status: e.target.value });
        el.querySelector('#tprio').onchange = (e) => patch({ priority: e.target.value });
        el.querySelector('#retry')?.addEventListener('click', () => patch({ status: 'todo' }));
        el.querySelector('#tdel').onclick = () => modal('Hapus tugas?', `<p>Tugas <b>${esc(t.title)}</b> beserta semua subtugasnya akan dihapus.</p>`, { actions: [{ label: 'Batal' }, { label: 'Hapus', kind: 'danger', run: async () => { await api('DELETE', `/api/tasks/${t.id}`); closeDrawer(); } }] });
        const sendC = async () => { const i = el.querySelector('#tc'); if (!i.value.trim()) return; await api('POST', `/api/tasks/${t.id}/comment`, { text: i.value, userId: S.me }); i.value = ''; };
        el.querySelector('#tcs').onclick = sendC;
        el.querySelector('#tc').onkeydown = (e) => e.key === 'Enter' && sendC();
        el.querySelector('#hdone')?.addEventListener('click', async () => { await api('POST', `/api/tasks/${t.id}/complete`, { output: el.querySelector('#hout').value, userId: a.id }); toast('Tugas selesai ✅', 'ok'); });
      },
    };
  }, 'task:' + id);
}

// ═════════════════════ AGENT DRAWER ═════════════════════
export function agentDrawer(id) {
  drawer(() => {
    const e = emp(id);
    if (!e) return null;
    const d = div(e.divisionId);
    const open = openTasks(e.id);
    const cur = e.currentTaskId && task(e.currentTaskId);
    const evs = D().events.filter((x) => x.actorId === e.id || x.targetId === e.id).slice(-15).reverse();
    const mem = noteByTitle(`Memori ${e.name}`);
    const routines = D().routines.filter((r) => r.employeeId === e.id);
    const boss = emp(e.reportsTo);
    const reports = D().employees.filter((x) => x.reportsTo === e.id);
    return {
      head: `${avatar(e, 'lg')}<div style="min-width:0"><div style="font-weight:700;font-size:16px">${esc(e.name)} ${e.isLead ? '👑' : ''}</div><div class="small muted">${esc(e.title)} · ${d?.icon} ${esc(d?.name)}</div><div class="small"><span class="status-dot st-${e.status}"></span> ${STATUS_LABEL[e.status] || e.status} — ${esc(e.statusText || '')}</div></div>`,
      body: `
        <div class="row wrap">
          ${e.id !== S.me ? '<button class="btn primary" id="adm">💬 Chat</button>' : ''}
          <button class="btn" id="atask">＋ Beri tugas</button>
          <button class="btn" id="a3d">🎯 Lihat di 3D</button>
          <button class="btn" id="aedit">✎ Edit</button>
          ${e.type === 'ai' ? `<button class="btn ${e.status === 'offline' ? 'ok' : ''}" id="apause">${e.status === 'offline' ? '▶ Aktifkan' : '⏸ Jeda'}</button>` : ''}
        </div>
        ${cur ? `<div class="sec"><h4>Sedang dikerjakan</h4><div class="tcard running" data-task="${cur.id}" style="--c:${d?.color}"><div class="tt">${esc(cur.title)}</div><div class="meta">⚡ ${esc(e.statusText)}</div>${(cur.log || []).slice(-4).reverse().map((l) => `<div class="small ${l.type === 'thought' ? 'muted' : ''}" style="border-left:2px solid var(--line2);padding-left:8px;white-space:pre-wrap;max-height:90px;overflow:hidden">${esc(l.text.slice(0, 260))}</div>`).join('')}</div></div>` : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:8px">
          <div class="card kpi" style="padding:10px"><div class="l">Selesai</div><div class="v" style="font-size:20px">${e.stats.tasksDone}</div></div>
          <div class="card kpi" style="padding:10px"><div class="l">Token</div><div class="v" style="font-size:20px">${num(e.stats.tokensIn + e.stats.tokensOut)}</div></div>
          <div class="card kpi" style="padding:10px"><div class="l">Biaya</div><div class="v" style="font-size:20px">${usd(e.stats.cost)}</div></div>
        </div>
        <div class="sec"><h4>Profil</h4><div class="md small"><p>${esc(e.persona)}</p></div><div class="row wrap" style="gap:5px">${e.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
          <div class="small muted" style="margin-top:8px">${e.type === 'ai' ? `🤖 AI · model ${esc(e.model || (e.isLead ? D().settings.model : D().settings.workerModel))} · otonomi: ${e.autonomy === 'ask' ? 'minta persetujuan' : 'otomatis'}` : '👤 Manusia'}${boss ? ` · lapor ke <a data-agent="${boss.id}" style="cursor:pointer">${esc(boss.name)}</a>` : ''}</div>
          ${reports.length ? `<div class="faces" style="margin-top:8px">${reports.map((r) => `<span data-agent="${r.id}" style="cursor:pointer">${avatar(r)}</span>`).join('')}</div>` : ''}</div>
        ${e.type === 'ai' ? `<div class="sec"><h4>Konfigurasi agen</h4><div style="display:grid;gap:8px">
          <div class="row wrap" style="gap:5px">${(e.skillRefs || []).map((r) => { const sk = (D().skills || []).find((x) => x.id === r.id); return sk ? `<span class="chip" title="${esc(sk.description)}">◆ ${esc(sk.name)} · ${r.proficiency}/10</span>` : ''; }).join('') || '<span class="small muted">Belum ada skill dari library</span>'}</div>
          <div class="small muted mono">tools: ${(e.tools || []).join(' · ')}</div>
          <div class="small muted">Knowledge wajib: ${(e.knowledgeIds || []).map((id) => note(id)).filter(Boolean).map((n) => `<a data-note="${n.id}" style="cursor:pointer">${esc(n.title)}</a>`).join(', ') || '-'}</div>
          ${(e.starters || []).length ? `<div class="row wrap" style="gap:5px">${e.starters.map((x) => `<button class="btn sm" data-starter="${esc(x)}">${esc(x.slice(0, 48))}</button>`).join('')}</div>` : ''}
        </div></div>` : ''}
        <div class="sec"><h4>Tugas aktif (${open.length})</h4><div style="display:grid;gap:6px">${open.slice(0, 12).map((t) => `<div class="bl row" data-task="${t.id}"><span style="flex:1;min-width:0">${esc(t.title)}</span>${statusChip(t.status)}</div>`).join('') || '<div class="muted small">Tidak ada</div>'}</div></div>
        ${routines.length ? `<div class="sec"><h4>Rutinitas otomatis</h4>${routines.map((r) => `<div class="bl">🔁 ${esc(r.title)} · tiap ${r.everyMinutes} mnt ${r.enabled ? '' : '(nonaktif)'}</div>`).join('')}</div>` : ''}
        ${mem ? `<div class="sec"><h4>Memori</h4><div class="bl" data-note="${mem.id}">🧠 ${esc(mem.title)} · ${ago(mem.updatedAt)}</div></div>` : ''}
        <div class="sec"><h4>Aktivitas terbaru</h4>${evs.map((e) => feedItem(e)).join('') || '<div class="muted small">Belum ada</div>'}</div>`,
      mount(el) {
        bindCommon(el);
        el.querySelector('#adm')?.addEventListener('click', async () => { const r = await api('POST', '/api/dm', { with: e.id, userId: S.me }); closeDrawer(); navigate('chat', { ch: r.id }); });
        el.querySelector('#atask').onclick = () => newTaskModal({ assigneeId: e.id });
        el.querySelectorAll('[data-starter]').forEach((b) => (b.onclick = () => newTaskModal({ assigneeId: e.id, title: b.dataset.starter })));
        el.querySelector('#a3d').onclick = () => { closeDrawer(); navigate('office', { focus: e.id }); setTimeout(() => office?.focus(e.id), 400); };
        el.querySelector('#aedit').onclick = () => { closeDrawer(); navigate('studio', { emp: e.id, tab: 'agents' }); };
        el.querySelector('#apause')?.addEventListener('click', () => api('PATCH', `/api/employees/${e.id}`, { status: e.status === 'offline' ? 'idle' : 'offline' }));
      },
    };
  }, 'agent:' + id);
}

function divisionDrawer(id) {
  drawer(() => {
    const d = div(id); if (!d) return null;
    const members = D().employees.filter((e) => e.divisionId === id);
    const ts = D().tasks.filter((t) => t.divisionId === id && t.status !== 'done');
    const sops = D().notes.filter((n) => n.authorId && members.some((m) => m.id === n.authorId) && n.folder === 'SOP');
    return {
      head: `<div class="ava lg" style="background:${d.color}">${d.icon}</div><div><div style="font-weight:700;font-size:16px">${esc(d.name)}</div><div class="small muted">${esc(d.mission)}</div></div>`,
      body: `<div class="row wrap"><button class="btn primary" id="dtask">＋ Tugas ke divisi</button><button class="btn" id="dhire">＋ Rekrut</button><button class="btn" id="d3d">🎯 Lihat di 3D</button><button class="btn" id="dchat">💬 Channel</button></div>
        <div class="sec"><h4>Anggota (${members.length})</h4>${members.map((m) => `<div class="member" data-agent="${m.id}">${avatar(m)}<div style="min-width:0;flex:1"><div class="nm">${esc(m.name)} ${m.isLead ? '👑' : ''}</div><div class="rl">${esc(m.title)} · ${esc(m.statusText || '')}</div></div></div>`).join('')}</div>
        <div class="sec"><h4>Tugas aktif (${ts.length})</h4><div style="display:grid;gap:6px">${ts.slice(0, 15).map((t) => `<div class="bl row" data-task="${t.id}"><span style="flex:1;min-width:0">${esc(t.title)}</span>${statusChip(t.status)}</div>`).join('') || '<div class="muted small">Tidak ada</div>'}</div></div>
        ${sops.length ? `<div class="sec"><h4>SOP divisi</h4>${sops.map((n) => `<div class="bl" data-note="${n.id}">📘 ${esc(n.title)}</div>`).join('')}</div>` : ''}`,
      mount(el) {
        bindCommon(el);
        el.querySelector('#dtask').onclick = () => newTaskModal({ assigneeId: d.leadId });
        el.querySelector('#dhire').onclick = () => employeeModal(null, { divisionId: d.id });
        el.querySelector('#d3d').onclick = () => { closeDrawer(); navigate('office'); setTimeout(() => office?.focusZone(d.id), 400); };
        el.querySelector('#dchat').onclick = () => { closeDrawer(); navigate('chat', { ch: `div-${d.id}` }); };
      },
    };
  }, 'div:' + id);
}

// ═════════════════════ CHAT ═════════════════════
export const ChatView = {
  mount(root) {
    this.ch = S.params.ch || this.ch || 'general';
    root.style.overflow = 'hidden';
    root.innerHTML = `<div class="chat has-sel" id="chat"><div class="chat-list" id="cl"></div><div class="chat-main"><div class="chat-h" id="chh"></div><div class="msgs" id="msgs"></div>
      <div class="quick" id="cquick">${[['@all ', '📣 Semua agen'], ['@kepala ', '👑 Semua kepala'], ['@staff ', '🤖 Semua staf'], ['/goal ', '🎯 Goal'], ['/tugas @', '📋 Tugas'], ['/rapat ', '👥 Rapat'], ['/cari ', '🔎 Cari Brain'], ['/status', '📊 Status']].map(([c, l]) => `<button class="chip" data-cmd="${c}">${l}</button>`).join('')}<span class="small faint hide-m" style="margin-left:auto">@all · @kepala · @staff · #divisi</span></div>
      <div class="mention-pop" id="cpop" hidden></div>
      <div class="composer"><textarea class="input" id="cin" rows="1" placeholder="Tulis pesan… gunakan @all, @kepala, @staff, #divisi, atau @nama"></textarea><button class="btn primary" id="csend">Kirim</button></div></div></div>`;
    const send = async () => {
      const i = root.querySelector('#cin'); const text = i.value.trim(); if (!text) return;
      i.value = ''; i.style.height = ''; root.querySelector('#cpop').hidden = true;
      if (text.startsWith('/') && await this.command(text)) return;
      await api('POST', '/api/messages', { channelId: this.ch, text, userId: S.me });
    };
    root.querySelector('#csend').onclick = send;
    const cin = root.querySelector('#cin');
    const pop = root.querySelector('#cpop');
    const pick = (el) => { const v = cin.value, at = v.lastIndexOf('@', cin.selectionStart - 1); cin.value = v.slice(0, at) + '@' + el.dataset.name + ' ' + v.slice(cin.selectionStart); pop.hidden = true; cin.focus(); };
    cin.onkeydown = (e) => {
      if (!pop.hidden && ['ArrowDown', 'ArrowUp', 'Tab', 'Enter'].includes(e.key)) {
        const items = [...pop.querySelectorAll('.mi')]; let i = items.findIndex((x) => x.classList.contains('on'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[i]?.classList.remove('on'); i = (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; items[i].classList.add('on'); return; }
        e.preventDefault(); const el = items[Math.max(0, i)];
        if (el.dataset.cmd) { cin.value = el.dataset.cmd + ' '; pop.hidden = true; return; }
        return pick(el);
      }
      if (e.key === 'Escape') pop.hidden = true;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };
    cin.oninput = () => {
      cin.style.height = 'auto'; cin.style.height = Math.min(160, cin.scrollHeight) + 'px';
      const before = cin.value.slice(0, cin.selectionStart); const m = before.match(/@([\w-]{0,20})$/);
      if (m) {
        const q = m[1].toLowerCase();
        const special = [['all', '📣 Semua agen', `${D().employees.filter((x) => x.type === 'ai').length} agen · eksekusi bertahap`], ['kepala', '👑 Semua kepala', 'orkestrator setiap divisi'], ['staff', '🤖 Semua staf', 'melalui kepala divisi']].filter((x) => x[0].includes(q) || x[1].toLowerCase().includes(q));
        const hits = D().employees.filter((x) => x.id !== S.me && (`${x.name} ${x.title} ${x.team || ''}`.toLowerCase().includes(q))).slice(0, Math.max(0, 7 - special.length));
        pop.innerHTML = special.map((x, k) => `<div class="mi ${k ? '' : 'on'}" data-name="${x[0]}"><span class="ava">${x[1].slice(0, 2)}</span><div><b>${x[1]}</b><small>${x[2]}</small></div></div>`).join('') + hits.map((x, k) => `<div class="mi ${k || special.length ? '' : 'on'}" data-name="${esc(x.name)}">${avatar(x)}<div><b>${esc(x.name)}</b><small>${esc(x.title)}${x.team ? ' · ' + esc(x.team) : ''}</small></div><span class="status-dot st-${x.status}"></span></div>`).join('');
        pop.hidden = !hits.length && !special.length; pop.querySelectorAll('[data-name]').forEach((el) => (el.onmousedown = (ev) => { ev.preventDefault(); pick(el); }));
      } else if (/^\/\w*$/.test(cin.value)) {
        pop.innerHTML = CMDS.map((c, k) => `<div class="mi ${k ? '' : 'on'}" data-cmd="${c[0]}"><span class="cmd">${c[0]}</span><div><b>${c[1]}</b><small>${c[2]}</small></div></div>`).join('');
        pop.hidden = false; pop.querySelectorAll('[data-cmd]').forEach((el) => (el.onmousedown = (ev) => { ev.preventDefault(); cin.value = el.dataset.cmd + ' '; pop.hidden = true; cin.focus(); }));
      } else pop.hidden = true;
    };
    root.querySelectorAll('#cquick [data-cmd]').forEach((b) => (b.onclick = () => { cin.value = b.dataset.cmd; cin.focus(); cin.dispatchEvent(new Event('input')); if (b.dataset.cmd === '/status') send(); }));
    bindCommon(root);
    this.root = root; this.lastCount = -1; this.listKey = ''; this.update();
  },
  update(colls = new Set(['*'])) {
    const r = this.root; const d = D();
    if (!['*', 'channels', 'messages', 'employees', 'chat', 'meetings'].some((c) => colls.has(c))) return;
    const listChanged = ['*', 'channels', 'messages', 'chat', 'meetings'].some((c) => colls.has(c));
    const myDMs = d.channels.filter((c) => c.kind === 'dm' && c.members.includes(S.me));
    const last = (cid) => { for (let i = d.messages.length - 1; i >= 0; i--) if (d.messages[i].channelId === cid) return d.messages[i]; };
    const sortedDMs = myDMs.sort((a, b) => (last(b.id)?.t || 0) - (last(a.id)?.t || 0));
    const agentDMs = d.channels.filter((c) => c.kind === 'dm' && !c.members.includes(S.me)).slice(-15).reverse();
    const meetings = d.channels.filter((c) => c.kind === 'meeting').slice(-12).reverse();
    const listKey = [this.ch, ...d.channels.filter((c) => c.kind === 'channel').map((c) => c.id), ...sortedDMs.map((c) => c.id), ...agentDMs.map((c) => c.id), ...meetings.map((c) => c.id + (d.meetings?.find((m) => m.id === c.meetingId)?.status || ''))].join('|');
    if (listChanged && listKey !== this.listKey) { this.listKey = listKey; r.querySelector('#cl').innerHTML = `<button class="btn sm" id="newdm" style="width:100%">＋ Chat dengan karyawan</button>
      <h4>Channel</h4>${d.channels.filter((c) => c.kind === 'channel').map((c) => `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}"><span>#</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span></div>`).join('')}
      <h4>Pesan langsung</h4>${sortedDMs.map((c) => { const o = emp(c.members.find((m) => m !== S.me)); return `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}">${avatar(o)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o?.name)}</span></div>`; }).join('') || '<div class="small faint" style="padding:0 9px">Belum ada</div>'}
      <h4>Rapat</h4>${meetings.map((c) => { const m = d.meetings?.find((x) => x.id === c.meetingId); return `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}"><span>${m?.status === 'waiting_owner' ? '🎙️' : m?.status === 'running' ? '🔴' : '👥'}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="small">${esc(c.name.replace(/^Rapat: /, ''))}</span></div>`; }).join('') || '<div class="small faint" style="padding:0 9px">Belum ada</div>'}
      <h4>Antar agen (pantau)</h4>${agentDMs.map((c) => `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}"><span>👀</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="small">${esc(c.name)}</span></div>`).join('') || '<div class="small faint" style="padding:0 9px">Belum ada</div>'}`;
    r.querySelectorAll('[data-ch]').forEach((x) => (x.onclick = () => { this.ch = x.dataset.ch; r.querySelector('#chat').classList.add('has-sel'); this.lastCount = -1; this.update(); }));
    }
    r.querySelector('#newdm').onclick = () => modal('Chat dengan siapa?', `<select class="input" name="w">${empOptions('', { aiOnly: false })}</select>`, { actions: [{ label: 'Batal' }, { label: 'Mulai chat', kind: 'primary', run: async (b) => { const res = await api('POST', '/api/dm', { with: formData(b).w, userId: S.me }); this.ch = res.id; this.lastCount = -1; setTimeout(() => this.update(), 50); } }] });
    const ch = d.channels.find((c) => c.id === this.ch) || d.channels[0];
    if (!ch) return;
    const other = ch.kind === 'dm' ? emp(ch.members.find((m) => m !== S.me)) : null;
    r.querySelector('#chh').innerHTML = `<button class="btn ghost icon" id="chback" title="Kembali">‹</button>${other ? `${avatar(other)}<div style="flex:1;min-width:0"><b data-agent="${other.id}" style="cursor:pointer">${esc(other.name)}</b><div class="small muted">${esc(other.title)} · ${esc(other.statusText || '')}</div></div>` : `<div style="flex:1;min-width:0"><b>${ch.kind === 'dm' ? '👀 ' + esc(ch.name) : ch.kind === 'meeting' ? '👥 ' + esc(ch.name) : '# ' + esc(ch.name)}</b><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ch.kind === 'meeting' ? (() => { const m = d.meetings?.find((x) => x.id === ch.meetingId); return `${m?.status === 'waiting_owner' ? '🎙️ peserta diam—kirim /selesai saat Anda selesai' : m?.status === 'running' ? '🔴 berlangsung' : m?.status === 'failed' ? 'gagal' : 'selesai'} · ${m?.representedParticipants?.length || m?.participants?.length || 0} peserta diwakili`; })() : esc(ch.topic || (ch.kind === 'dm' ? 'Percakapan antar agen' : ''))}</div></div>${ch.kind === 'meeting' && d.meetings?.find((x) => x.id === ch.meetingId)?.noteId ? `<button class="btn sm" data-note="${d.meetings.find((x) => x.id === ch.meetingId).noteId}">Notulen</button>` : ''}`}`;
    r.querySelector('#chback').onclick = () => r.querySelector('#chat').classList.remove('has-sel');
    const msgs = d.messages.filter((m) => m.channelId === ch.id).slice(-150);
    if (msgs.length === this.lastCount && this.lastCh === ch.id) return;
    const box = r.querySelector('#msgs');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || this.lastCh !== ch.id;
    this.lastCount = msgs.length; this.lastCh = ch.id;
    box.innerHTML = msgs.map((m) => { const a = emp(m.authorId); return `<div class="msg">${avatar(a)}<div class="body"><div class="who"><span data-agent="${a?.id}" style="cursor:pointer;margin:0;font-size:13px;font-weight:650;color:var(--text)">${esc(a?.name || m.authorId)}</span><span>${a?.type === 'ai' ? '🤖 ' : ''}${clock(m.t)}</span></div><div class="md">${md(m.text)}</div>${m.broadcast ? `<span class="chip" style="color:var(--ok)">📣 diterima ${m.deliveredTo || 0} agen/koordinator</span>` : ''}${m.taskId ? `<button class="btn sm" data-task="${m.taskId}" style="margin-top:4px">📋 Lihat tugas</button>` : ''}</div></div>`; }).join('') || `<div class="empty">Mulai percakapan. ${other?.type === 'ai' ? `${esc(other.name)} akan membalas otomatis.` : '#general selalu dijawab PA; gunakan @all untuk seluruh perusahaan.'}</div>`;
    if (atBottom) box.scrollTop = box.scrollHeight;
  },
  /** Slash commands act directly instead of posting a message. Returns true when handled. */
  async command(text) {
    const [cmd, ...rest] = text.split(' '); const arg = rest.join(' ').trim();
    const mention = (t) => { const m = t.match(/@([\w-]+)/); return m && D().employees.find((x) => x.name.toLowerCase() === m[1].toLowerCase() || x.id === m[1].toLowerCase()); };
    if (cmd === '/goal') { if (!arg) { goalModal(); return true; } await api('POST', '/api/goals', { title: arg, userId: S.me }); toast('🎯 Goal dikirim ke asisten pribadimu', 'ok'); return true; }
    if (cmd === '/tugas') { const who = mention(arg); const title = arg.replace(/@[\w-]+/, '').trim(); if (!who || !title) { newTaskModal({ assigneeId: who?.id, title }); return true; } await api('POST', '/api/tasks', { title, assigneeId: who.id, userId: S.me }); toast(`📋 Tugas dibuat untuk ${who.name}`, 'ok'); return true; }
    if (cmd === '/rapat') { meetingModal({ topic: arg }); return true; }
    if (cmd === '/cari') { navigate('brain', {}); setTimeout(() => { const q = document.querySelector('#bq'); if (q) { q.value = arg; q.dispatchEvent(new Event('input')); } }, 150); return true; }
    if (cmd === '/status') {
      const d = D(); const open = d.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
      const busy = d.employees.filter((e) => e.status === 'working' || e.status === 'meeting');
      modal('📊 Status perusahaan', `<div class="stat-strip">${[['tugas aktif', open.length], ['agen bekerja', busy.length], ['persetujuan', d.approvals.filter((a) => a.status === 'pending').length], ['biaya hari ini', usd(d.usage.costToday)]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>${busy.slice(0, 12).map((e) => `<div class="member">${avatar(e)}<div style="flex:1;min-width:0"><div class="nm">${esc(e.name)}</div><div class="rl">${esc(e.statusText || '')}</div></div></div>`).join('') || '<div class="empty small">Semua agen sedang luang</div>'}`, { actions: [{ label: 'Tutup' }] });
      return true;
    }
    return false;
  },
  unmount(root) { root.style.overflow = ''; },
};
const CMDS = [['/goal', 'Kirim goal', 'Asisten pribadimu memecahnya ke seluruh perusahaan'], ['/tugas', 'Buat tugas', '/tugas @nama judul tugas'], ['/rapat', 'Adakan rapat', 'Rapat multi-agen dengan notulen'], ['/cari', 'Cari di Brain', 'Buka Brain dengan pencarian'], ['/status', 'Status perusahaan', 'Siapa sedang mengerjakan apa']];

// ═════════════════════ BRAIN (Obsidian-like) ═════════════════════
export const BrainView = {
  mount(root) {
    root.style.overflow = 'hidden';
    this.sel = S.params.note || this.sel || D().notes.find((n) => n.pinned || n.tags?.includes('pinned'))?.id || D().notes[0]?.id;
    this.mode = S.params.graph ? 'graph' : this.mode === 'graph' ? 'graph' : 'note';
    this.edit = false; this.q = '';
    root.innerHTML = `<div class="brain" id="brain">
      <div class="tree"><div class="row" style="margin-bottom:8px"><input class="input" id="bq" placeholder="🔎 Cari di Brain…"><button class="btn icon" id="bnew" title="Catatan baru">＋</button></div><div id="btree"></div></div>
      <div class="editor"><div class="editor-h" id="beh"></div><div class="editor-b" id="beb" style="position:relative"></div></div>
      <div class="side-r"><div class="graph-box"><canvas id="lg"></canvas></div><div class="backlinks" id="bl"></div></div></div>`;
    root.querySelector('#bq').oninput = (e) => { this.q = e.target.value.toLowerCase(); this.renderTree(); };
    root.querySelector('#bnew').onclick = () => modal('📝 Catatan baru', `<label class="f">Judul<input class="input" name="title"></label><label class="f">Folder<input class="input" name="folder" list="folders" value="Knowledge"><datalist id="folders">${[...new Set(D().notes.map((n) => n.folder))].map((f) => `<option value="${esc(f)}">`).join('')}</datalist></label>`, { actions: [{ label: 'Batal' }, { label: 'Buat', kind: 'primary', run: async (b) => { const f = formData(b); if (!f.title.trim()) return false; const n = await api('POST', '/api/notes', { ...f, userId: S.me }); this.sel = n.id; this.mode = 'note'; this.edit = true; setTimeout(() => this.update(new Set(['notes'])), 60); } }] });
    this.root = root;
    this.local = createGraph(root.querySelector('#lg'), { onOpen: (id, t) => (id ? this.open(id) : openNoteByTitle(t)) });
    bindCommon(root);
    this.renderAll();
  },
  open(id) { this.sel = id; this.mode = 'note'; this.edit = false; navigate('brain', { note: id }); this.renderAll(); },
  renderAll() { this.renderTree(); this.renderEditor(); this.renderSide(); },
  update(colls) {
    if (!colls.has('notes') && !colls.has('*')) return;
    this.renderTree(); this.renderSide();
    const n = note(this.sel);
    // refresh preview when an agent edits the open note, never while the human is typing
    if (this.mode === 'graph') this.full?.setData(D().notes, { folderColors: this.colors() });
    else if (!this.edit && n && n.updatedAt !== this.shownAt) this.renderEditor();
  },
  colors() { return Object.fromEntries([...new Set(D().notes.map((n) => n.folder))].map((f) => [f, folderColor(f)])); },
  renderTree() {
    const q = this.q; const tree = this.root.querySelector('#btree');
    const notes = D().notes.filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    const SYS = ['Company', 'SOP', 'Meetings', 'Playbooks', 'Memori', 'Archive'];
    const tops = [...new Set(notes.map((n) => n.folder.split('/')[0]))].sort((a, b) => (SYS.indexOf(a) + 1 || 99) - (SYS.indexOf(b) + 1 || 99) || a.localeCompare(b));
    const open = this.openFolders || (this.openFolders = new Set(['Company']));
    const loose = D().notes.filter((n) => ['Deliverables', 'Reports', 'Notes', 'Knowledge', 'Approvals'].includes(n.folder)).length;
    const item = (n) => `<div class="note-item ${n.id === this.sel && this.mode === 'note' ? 'active' : ''}" data-open="${n.id}" title="${esc(n.title)}">${esc(n.title)}</div>`;
    const byRecent = (a, b) => b.updatedAt - a.updatedAt;
    tree.innerHTML = `<div class="row" style="gap:6px;margin-bottom:6px"><div class="note-item ${this.mode === 'graph' ? 'active' : ''}" style="padding-left:8px;flex:1" id="bgraph">🕸️ Graph view</div><button class="btn sm" id="borg" title="Klasifikasikan & rapikan semua catatan">🗂️ Rapikan${loose ? ` <span class="badge">${loose}</span>` : ''}</button></div>
      <div class="small faint" style="margin:0 6px 8px">${D().notes.length} catatan · ${tops.length} folder · disusun otomatis per Divisi/Jenis</div>` + tops.map((top) => {
      const inTop = notes.filter((n) => n.folder.split('/')[0] === top);
      const direct = inTop.filter((n) => !n.folder.includes('/')).sort(byRecent);
      const subs = [...new Set(inTop.filter((n) => n.folder.includes('/')).map((n) => n.folder.split('/').slice(1).join('/')))].sort();
      const dv = D().divisions.find((x) => x.name === top);
      return `<details class="folder" ${open.has(top) || q ? 'open' : ''} data-f="${esc(top)}"><summary><span style="color:${dv?.color || folderColor(top)}">${dv ? dv.icon : '●'}</span> ${esc(top)} <span class="faint small" style="margin-left:auto">${inTop.length}</span></summary>${direct.map(item).join('')}${subs.map((sub) => { const key = top + '/' + sub; const l = inTop.filter((n) => n.folder === key).sort(byRecent); return `<details class="folder sub" ${open.has(key) || q ? 'open' : ''} data-f="${esc(key)}"><summary>${esc(sub)} <span class="faint small" style="margin-left:auto">${l.length}</span></summary>${l.map(item).join('')}</details>`; }).join('')}</details>`;
    }).join('');
    tree.querySelector('#borg').onclick = async (ev) => { ev.currentTarget.disabled = true; const r = await api('POST', '/api/brain/organize', { userId: S.me }); toast(`🗂️ Brain dirapikan: ${r.moved} dipindah, ${r.renamed} judul diperbaiki`, 'ok'); };
    tree.querySelectorAll('details').forEach((dt) => (dt.ontoggle = () => (dt.open ? open.add(dt.dataset.f) : open.delete(dt.dataset.f))));
    tree.querySelectorAll('[data-open]').forEach((x) => (x.onclick = () => { this.open(x.dataset.open); this.root.querySelector('#brain').classList.remove('show-tree'); }));
    tree.querySelector('#bgraph').onclick = () => { this.mode = 'graph'; this.renderAll(); this.root.querySelector('#brain').classList.remove('show-tree'); };
  },
  renderEditor() {
    const h = this.root.querySelector('#beh'); const b = this.root.querySelector('#beb');
    this.full?.dispose(); this.full = null;
    const treeBtn = '<button class="btn icon ghost" id="btree-t" title="Daftar catatan">☰</button>';
    if (this.mode === 'graph') {
      h.innerHTML = `${treeBtn}<b style="flex:1">🕸️ Graph pengetahuan perusahaan</b><span class="small muted">${D().notes.length} catatan · klik node untuk membuka</span>`;
      b.innerHTML = '<div class="graph-full"><canvas id="fg"></canvas></div>';
      b.style.padding = '0';
      this.full = createGraph(b.querySelector('#fg'), { onOpen: (id, t) => (id ? this.open(id) : openNoteByTitle(t)) });
      this.full.setData(D().notes, { folderColors: this.colors() });
      this.bindTreeBtn(); return;
    }
    b.style.padding = '';
    const n = note(this.sel);
    if (!n) { h.innerHTML = treeBtn; b.innerHTML = '<div class="empty">Pilih catatan</div>'; this.bindTreeBtn(); return; }
    this.shownAt = n.updatedAt;
    const author = emp(n.authorId);
    h.innerHTML = `${treeBtn}<input class="title" id="nt" value="${esc(n.title)}" ${this.edit ? '' : 'readonly'}>
      <span class="chip" style="color:${folderColor(n.folder)}">${esc(n.folder)}</span>
      <div class="tabs"><button class="${this.edit ? '' : 'active'}" data-m="0">👁 Baca</button><button class="${this.edit ? 'active' : ''}" data-m="1">✎ Edit</button></div>
      <button class="btn icon ghost" id="nmore" title="Lainnya">⋯</button>`;
    b.innerHTML = this.edit
      ? `<textarea id="nc" spellcheck="false">${esc(n.content)}</textarea>`
      : `<div class="small muted" style="margin-bottom:12px">${author ? `${avatar(author)} ` : ''}${esc(author?.name || '')} · diperbarui ${ago(n.updatedAt)}${n.lastEditorId && n.lastEditorId !== n.authorId ? ` oleh ${esc(emp(n.lastEditorId)?.name || '')}` : ''}</div><div class="md" style="max-width:820px">${md(n.content)}</div>`;
    if (!this.edit) b.querySelector('.small .ava')?.setAttribute('style', b.querySelector('.small .ava').getAttribute('style') + ';display:inline-grid;width:20px;height:20px;font-size:9px;vertical-align:middle');
    h.querySelectorAll('[data-m]').forEach((x) => (x.onclick = async () => { if (this.edit) await this.save(); this.edit = x.dataset.m === '1'; this.renderEditor(); }));
    if (this.edit) {
      const ta = b.querySelector('#nc');
      let timer;
      ta.oninput = () => { clearTimeout(timer); timer = setTimeout(() => this.save(), 900); };
      ta.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.save(); toast('Tersimpan', 'ok'); } };
      h.querySelector('#nt').onchange = () => this.save();
      ta.focus();
    }
    h.querySelector('#nmore').onclick = () => modal('Opsi catatan', `<label class="f">Folder<input class="input" name="folder" value="${esc(n.folder)}"></label><label class="f">Tag (pisahkan koma)<input class="input" name="tags" value="${esc((n.tags || []).join(', '))}"></label>`, {
      actions: [{ label: 'Hapus catatan', kind: 'danger', run: async () => { await api('DELETE', `/api/notes/${n.id}`); this.sel = D().notes.find((x) => x.id !== n.id)?.id; this.renderAll(); } }, { label: 'Simpan', kind: 'primary', run: async (bb) => { const f = formData(bb); await api('PUT', `/api/notes/${n.id}`, { folder: f.folder || 'Notes', tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), userId: S.me }); setTimeout(() => this.renderAll(), 60); } }],
    });
    this.bindTreeBtn();
  },
  bindTreeBtn() { this.root.querySelector('#btree-t').onclick = () => this.root.querySelector('#brain').classList.toggle('show-tree'); },
  async save() {
    const n = note(this.sel); if (!n) return;
    const content = this.root.querySelector('#nc')?.value ?? n.content;
    const title = this.root.querySelector('#nt')?.value.trim() || n.title;
    if (content === n.content && title === n.title) return;
    const saved = await api('PUT', `/api/notes/${n.id}`, { content, title, userId: S.me });
    this.shownAt = saved.updatedAt;
  },
  renderSide() {
    const n = note(this.sel); const bl = this.root.querySelector('#bl');
    if (!n) { bl.innerHTML = ''; return; }
    this.local.setData(D().notes, { folderColors: this.colors(), focus: n.id });
    const back = D().notes.filter((x) => x.id !== n.id && linksOf(x.content).some((l) => l.toLowerCase() === n.title.toLowerCase()));
    const outl = [...new Set(linksOf(n.content))];
    bl.innerHTML = `<h4>Backlinks (${back.length})</h4>${back.map((x) => `<div class="bl" data-open="${x.id}"><b>${esc(x.title)}</b><div class="small faint">${esc(x.folder)}</div></div>`).join('') || '<div class="small faint">Belum ada catatan yang menautkan ke sini</div>'}
      <h4 style="margin-top:10px">Tautan keluar (${outl.length})</h4>${outl.map((t) => { const x = noteByTitle(t); return `<div class="bl" ${x ? `data-open="${x.id}"` : `data-ghost="${esc(t)}"`}>${x ? '' : '👻 '}${esc(t)}</div>`; }).join('') || '<div class="small faint">-</div>'}`;
    bl.querySelectorAll('[data-open]').forEach((x) => (x.onclick = () => this.open(x.dataset.open)));
    bl.querySelectorAll('[data-ghost]').forEach((x) => (x.onclick = () => openNoteByTitle(x.dataset.ghost)));
  },
  unmount(root) { if (this.edit) this.save(); this.local?.dispose(); this.full?.dispose(); this.full = null; root.style.overflow = ''; },
};

// ═════════════════════ TEAM ═════════════════════
export const TeamView = {
  mount(root) {
    root.innerHTML = `<div class="page"><div class="row wrap"><h2 style="margin:0;flex:1">👥 Organisasi</h2><button class="btn" id="ndiv">＋ Divisi</button><button class="btn" id="nhum">＋ Manusia</button><button class="btn primary" id="nai">＋ Rekrut karyawan AI</button></div>
      <div class="card" id="hier"></div>
      <div class="org" id="org"></div>
      <div class="card"><div class="card-h">🔁 Rutinitas otomatis<span style="flex:1"></span><button class="btn sm" id="nrt">＋ Rutinitas</button></div><div class="card-b" id="rts" style="display:grid;gap:8px"></div></div></div>`;
    root.querySelector('#nai').onclick = () => navigate('studio', { emp: 'new', tab: 'agents' });
    root.querySelector('#nhum').onclick = () => employeeModal(null, { type: 'human' });
    root.querySelector('#ndiv').onclick = () => modal('＋ Divisi baru', `<div class="grid2"><label class="f">Nama<input class="input" name="name" placeholder="mis. Design"></label><label class="f">Ikon<input class="input" name="icon" value="🎨"></label></div><label class="f">Misi<input class="input" name="mission"></label><label class="f">Warna<input type="color" class="input" name="color" value="#7aa2ff" style="height:40px"></label>`, { actions: [{ label: 'Batal' }, { label: 'Buat', kind: 'primary', run: async (b) => { await api('POST', '/api/divisions', formData(b)); } }] });
    root.querySelector('#nrt').onclick = () => routineModal();
    bindCommon(root);
    this.root = root; this.update();
  },
  update() {
    const d = D();
    const humans = d.employees.filter((e) => e.type === 'human');
    const master = d.employees.find((e) => e.isMaster);
    const node = (e, extra = '') => e ? `<div class="hnode" data-agent="${e.id}">${avatar(e)}<div><b>${esc(e.name)}</b><div class="small muted">${esc(e.title)}${extra}</div></div></div>` : '';
    this.root.querySelector('#hier').innerHTML = `<div class="card-h">hierarki komando<span style="flex:1"></span><span class="small" style="text-transform:none;letter-spacing:0">setiap manusia punya asisten AI pribadi yang menggerakkan seluruh perusahaan</span></div>
      <div class="card-b hier">
        <div class="hrow">${humans.map((h) => node(h, ' · manusia')).join('')}</div><div class="harrow">↓</div>
        <div class="hrow">${humans.map((h) => node(d.employees.find((e) => e.isPA && e.ownerId === h.id), ' · asisten pribadi')).join('')}</div><div class="harrow">↓</div>
        <div class="hrow">${node(master, ' · master orchestrator')}</div><div class="harrow">↓</div>
        <div class="hrow wrap">${d.divisions.map((x) => d.employees.find((e) => e.id === x.leadId && e.id !== master?.id)).filter(Boolean).map((e) => node(e, ' · orkestrator ' + (div(e.divisionId)?.short || ''))).join('')}</div><div class="harrow">↓</div>
        <div class="small muted" style="text-align:center">${d.employees.filter((e) => e.type === 'ai' && !e.isLead && !e.isPA && !e.isMaster).length} staf AI spesialis di ${d.divisions.length} divisi · ${d.divisions.reduce((a, x) => a + (x.teams || []).length, 0)} tim · rapat, konsultasi, cron job, riset web, MCP</div>
      </div>`;
    this.root.querySelector('#org').innerHTML = d.divisions.map((x) => {
      const members = d.employees.filter((e) => e.divisionId === x.id).sort((a, b) => b.isLead - a.isLead);
      const row = (m) => `<div class="member" data-agent="${m.id}">${avatar(m)}<div style="min-width:0;flex:1"><div class="nm">${esc(m.name)} ${m.isLead ? '👑' : ''} ${m.type === 'human' ? '<span class="chip">manusia</span>' : ''}</div><div class="rl">${esc(m.title)} · <span class="status-dot st-${m.status}"></span> ${esc(m.statusText || STATUS_LABEL[m.status])}</div></div><span class="small faint">${m.stats.tasksDone}✓</span></div>`;
      const teams = x.teams || [];
      const lead = members.filter((m) => m.isLead || !m.team || !teams.includes(m.team));
      const groups = teams.map((tn) => [tn, members.filter((m) => !m.isLead && m.team === tn)]).filter(([, l]) => l.length);
      return `<div class="card" style="border-top:3px solid ${x.color}"><div class="card-h" style="cursor:pointer" data-divd="${x.id}">${x.icon} ${esc(x.name)}<span style="flex:1"></span><span class="chip">${teams.length} tim</span><span class="chip">${members.length}</span></div><div class="card-b" style="padding:6px">${lead.map(row).join('')}${groups.map(([tn, l]) => `<div class="team-h"><span style="background:${x.color}"></span>${esc(tn)}<em>${l.length}</em></div>${l.map(row).join('')}`).join('')}${members.length ? '' : '<div class="empty small">Belum ada anggota</div>'}</div></div>`;
    }).join('');
    this.root.querySelectorAll('[data-divd]').forEach((c) => (c.onclick = () => divisionDrawer(c.dataset.divd)));
    const rts = this.root.querySelector('#rts');
    rts.innerHTML = d.routines.map((r) => { const e = emp(r.employeeId); const cadence = r.cron ? `cron ${r.cron}` : `tiap ${r.everyMinutes || 60} menit`; return `<div class="row" style="padding:8px;border:1px solid var(--line);border-radius:10px">${avatar(e)}<div style="flex:1;min-width:0"><b>${esc(r.title)}</b><div class="small muted">🎯 ${esc(routineTargetLabel(r))} · ${esc(cadence)} · terakhir ${ago(r.lastRunAt)}</div></div><button class="btn sm" data-run="${r.id}" title="Jalankan sekarang">▶</button><button class="btn sm ghost" data-edit="${r.id}">✎</button><label class="switch"><input type="checkbox" data-tog="${r.id}" ${r.enabled ? 'checked' : ''}><span></span></label></div>`; }).join('') || '<div class="muted small">Belum ada rutinitas</div>';
    rts.querySelectorAll('[data-tog]').forEach((c) => (c.onchange = () => api('PATCH', `/api/routines/${c.dataset.tog}`, { enabled: c.checked })));
    rts.querySelectorAll('[data-run]').forEach((c) => (c.onclick = async () => { await api('POST', `/api/routines/${c.dataset.run}/run`); toast('Rutinitas dijalankan', 'ok'); }));
    rts.querySelectorAll('[data-edit]').forEach((c) => (c.onclick = () => routineModal(d.routines.find((r) => r.id === c.dataset.edit))));
  },
};

const ROLE_TEMPLATES = [
  ['Content Writer', 'mkt', 'Penulis persuasif, paham SEO dan brand voice.', 'copywriting, artikel, caption'],
  ['Graphic Design Brief Writer', 'mkt', 'Menerjemahkan ide jadi brief visual yang jelas.', 'brief desain, moodboard, visual'],
  ['Sales Development Rep', 'sales', 'Gigih dan personal dalam outreach.', 'prospecting, cold email, follow-up'],
  ['Backend Engineer', 'eng', 'Rapi, aman, dan teruji.', 'api, database, keamanan'],
  ['Customer Support', 'cs', 'Sabar, empatik, cepat.', 'tiket, faq, troubleshooting'],
  ['Financial Analyst', 'fin', 'Teliti dalam angka.', 'forecast, budget, analisis'],
  ['Recruiter', 'hr', 'Jeli menilai talenta.', 'jd, screening, interview'],
  ['Data Analyst', 'data', 'Skeptis yang sehat.', 'sql, dashboard, insight'],
  ['Legal Analyst', 'legal', 'Presisi dan hati-hati.', 'kontrak, kepatuhan, privasi'],
];
export function employeeModal(e, pre = {}) {
  const isNew = !e;
  e = e || { name: '', type: pre.type || 'ai', divisionId: pre.divisionId || 'mkt', title: '', persona: '', skills: [], isLead: false, avatar: 'bot', autonomy: 'auto', model: '' };
  modal(isNew ? (e.type === 'human' ? '＋ Tambah anggota manusia' : '＋ Rekrut karyawan AI') : `✎ Edit ${esc(e.name)}`, `
    ${isNew && e.type === 'ai' ? `<label class="f">Template peran (opsional)<select class="input" id="tpl"><option value="">— Pilih template —</option>${ROLE_TEMPLATES.map((t, i) => opt(i, `${t[0]} (${div(t[1])?.short})`)).join('')}</select></label>` : ''}
    <div class="grid2"><label class="f">Nama<input class="input" name="name" value="${esc(e.name)}"></label><label class="f">Jabatan<input class="input" name="title" value="${esc(e.title)}"></label></div>
    <div class="grid2"><label class="f">Divisi<select class="input" name="divisionId">${D().divisions.map((d) => opt(d.id, d.icon + ' ' + d.name, e.divisionId)).join('')}</select></label>
      <label class="f">Jenis<select class="input" name="type">${opt('ai', '🤖 Karyawan AI', e.type)}${opt('human', '👤 Manusia', e.type)}</select></label></div>
    <label class="f">Persona & cara kerja<textarea class="input" name="persona" rows="3" placeholder="Sifat, gaya komunikasi, standar kualitas…">${esc(e.persona)}</textarea></label>
    <label class="f">Keahlian (pisahkan koma)<input class="input" name="skills" value="${esc(e.skills.join(', '))}"></label>
    <div class="grid2"><label class="f">Avatar 3D<select class="input" name="avatar">${['bot', 'cat', 'bear', 'bunny', 'fox'].map((a) => opt(a, { bot: '🤖 Bot', cat: '🐱 Kucing', bear: '🐻 Beruang', bunny: '🐰 Kelinci', fox: '🦊 Rubah' }[a], e.avatar)).join('')}</select></label>
      <label class="f">Otonomi<select class="input" name="autonomy">${opt('auto', 'Otomatis penuh', e.autonomy)}${opt('ask', 'Selalu minta persetujuan', e.autonomy)}</select></label></div>
    <div class="grid2"><label class="f">Model AI<select class="input" name="model">${opt('', 'Default (Pengaturan)', e.model)}${(D().models || []).map((m) => opt(m, m, e.model)).join('')}</select></label>
      <label class="f">Head divisi?<select class="input" name="isLead">${opt('false', 'Tidak', String(e.isLead))}${opt('true', 'Ya 👑', String(e.isLead))}</select></label></div>`, {
    onMount(b) {
      b.querySelector('#tpl')?.addEventListener('change', (ev) => {
        const t = ROLE_TEMPLATES[ev.target.value]; if (!t) return;
        const set = (n, v) => (b.querySelector(`[name=${n}]`).value = v);
        set('title', t[0]); set('divisionId', t[1]); set('persona', t[2]); set('skills', t[3]);
        if (!b.querySelector('[name=name]').value) set('name', ['Nova', 'Kai', 'Lumi', 'Rio', 'Mika', 'Zara', 'Dewa', 'Ayu'][Math.floor(Math.random() * 8)]);
      });
    },
    actions: [
      ...(!isNew && e.id !== 'owner' ? [{ label: 'Hapus', kind: 'danger', run: async () => { await api('DELETE', `/api/employees/${e.id}`); closeDrawer(); } }] : []),
      { label: 'Batal' },
      { label: isNew ? 'Rekrut' : 'Simpan', kind: 'primary', run: async (b) => { const f = formData(b); f.isLead = f.isLead === 'true'; if (!f.name.trim()) { toast('Nama wajib', 'warn'); return false; } const r = isNew ? await api('POST', '/api/employees', f) : await api('PATCH', `/api/employees/${e.id}`, f); toast(isNew ? `🎊 ${r.name} bergabung!` : 'Tersimpan', 'ok'); setTimeout(refreshDrawer, 50); } },
    ],
  });
}
function routineTargetLabel(r) {
  const type = r.targetType || 'employee';
  if (type === 'all') return `Semua agen (${D().employees.filter((e) => e.type === 'ai').length})`;
  if (type === 'heads') return 'Semua kepala divisi';
  if (type === 'staff') return 'Semua staf';
  if (type === 'division') return `Divisi ${div(r.targetId)?.name || r.targetId}`;
  if (type === 'tag') return `#${r.targetTag || r.targetId}`;
  return emp(r.targetId || r.employeeId)?.name || 'Agen';
}
function routineModal(r) {
  const isNew = !r;
  r = r || { title: '', description: '', employeeId: 'aria', targetType: 'employee', targetId: 'aria', targetTag: '', everyMinutes: 60, enabled: true };
  const current = (r.targetType || 'employee') === 'employee' ? `employee:${r.targetId || r.employeeId}` : (r.targetType === 'division' ? `division:${r.targetId}` : r.targetType || 'employee:aria');
  const targetOpts = `<option value="all" ${current === 'all' ? 'selected' : ''}>📣 Semua agen (hemat: via head divisi)</option><option value="heads" ${current === 'heads' ? 'selected' : ''}>👑 Semua kepala divisi</option><option value="staff" ${current === 'staff' ? 'selected' : ''}>🤖 Semua staf (via head divisi)</option><option value="tag" ${current === 'tag' ? 'selected' : ''}># Hashtag / tim / keahlian</option>${D().divisions.map((d) => `<option value="division:${d.id}" ${current === `division:${d.id}` ? 'selected' : ''}>${d.icon} Divisi ${esc(d.name)}</option>`).join('')}${D().employees.filter((e) => e.type === 'ai').map((e) => `<option value="employee:${e.id}" ${current === `employee:${e.id}` ? 'selected' : ''}>${esc(e.name)} · ${esc(e.title)}</option>`).join('')}`;
  modal(isNew ? '＋ Rutinitas otomatis' : '✎ Edit rutinitas', `<label class="f">Judul<input class="input" name="title" value="${esc(r.title)}" placeholder="mis. Laporan penjualan harian"></label><label class="f">Instruksi<textarea class="input" name="description" rows="3">${esc(r.description)}</textarea></label><label class="f">Target<select class="input" name="targetSpec">${targetOpts}</select></label><label class="f">Hashtag / tim / keahlian (dipakai jika target Hashtag)<input class="input" name="targetTag" value="${esc(r.targetTag || '')}" placeholder="mis. seo, marketplace, Growth Team"></label><div class="grid2"><label class="f">Koordinator fallback<select class="input" name="employeeId">${empOptions(r.employeeId || 'aria', { aiOnly: true })}</select></label><label class="f">Setiap (menit)<input class="input" type="number" min="1" name="everyMinutes" value="${r.everyMinutes || 60}"></label></div><div class="small muted">Target massal dijalankan per koordinator divisi dan masuk antrean bertahap, bukan memanggil semua model sekaligus.</div>`, {
    actions: [...(!isNew ? [{ label: 'Hapus', kind: 'danger', run: () => api('DELETE', `/api/routines/${r.id}`) }] : []), { label: 'Batal' }, { label: 'Simpan', kind: 'primary', run: async (b) => { const f = formData(b); if (!f.title.trim()) return false; const [kind, id] = f.targetSpec.split(':'); f.targetType = kind; f.targetId = id || (kind === 'tag' ? f.targetTag : ''); delete f.targetSpec; if (kind === 'employee') f.employeeId = id; isNew ? await api('POST', '/api/routines', f) : await api('PATCH', `/api/routines/${r.id}`, f); } }],
  });
}

// ═════════════════════ APPROVALS ═════════════════════
export const ApprovalsView = {
  mount(root) { root.innerHTML = `<div class="page" style="max-width:980px"><h2 style="margin:0">🛑 Persetujuan</h2><p class="muted" style="margin:0">${D().settings.autoApprove !== false ? '⚡ Auto-approve aktif: keputusan dicatat sebagai audit trail dan pekerjaan langsung berlanjut.' : 'Human-in-the-loop aktif: agen menunggu keputusan berisiko sesuai kebijakan.'} <a class="wikilink" data-note="Kebijakan Persetujuan">Kebijakan Persetujuan</a></p><div id="ap" style="display:grid;gap:10px"></div><h3 style="margin:10px 0 0">Riwayat</h3><div id="aph" style="display:grid;gap:6px"></div></div>`; bindCommon(root); this.root = root; this.update(); },
  update() {
    const aps = D().approvals;
    const pend = aps.filter((a) => a.status === 'pending').reverse();
    const r = this.root;
    r.querySelector('#ap').innerHTML = pend.map((a) => { const t = task(a.taskId); return approvalCard(a) + (t?.output ? `<details class="card" style="margin-top:-6px"><summary class="card-h" style="cursor:pointer;font-weight:550">📄 Pratinjau hasil</summary><div class="card-b md">${md(t.output.slice(0, 5000))}</div></details>` : ''); }).join('') || '<div class="card empty">Tidak ada yang menunggu persetujuan 🎉</div>';
    bindApprovalButtons(r.querySelector('#ap'));
    r.querySelector('#aph').innerHTML = aps.filter((a) => a.status !== 'pending').slice(-30).reverse().map((a) => `<div class="bl row" data-task="${a.taskId}"><span>${a.status === 'approved' ? '✅' : '✏️'}</span><span style="flex:1;min-width:0">${esc(a.title)}</span><span class="small muted">${esc(emp(a.decidedBy)?.name || '')} · ${ago(a.decidedAt)}</span></div>`).join('') || '<div class="muted small">Belum ada</div>';
  },
};

// ═════════════════════ SETTINGS ═════════════════════
export const SettingsView = {
  mount(root) {
    const s = D().settings; const c = D().company; const u = D().usage;
    root.innerHTML = `<div class="page settings">
      <h2 style="margin:0">⚙️ Pengaturan</h2>
      <div class="card"><div class="card-h">🤖 Mesin AI <span style="flex:1"></span><span class="pill ${D().live ? 'live' : 'sim'}"><span class="dot"></span>${{ groq: 'LIVE · Groq', claude: 'LIVE · Claude', sim: 'SIMULASI' }[D().provider || 'sim']}</span></div><div class="card-b" style="display:grid;gap:12px">
        <p class="small muted" style="margin:0">Pilih otak karyawan AI. <b>Groq</b> (GPT-OSS 120B, sangat cepat & murah, cocok untuk server produksi) atau <b>Claude</b>. Mode <b>Otomatis</b> memakai Groq bila key tersedia, lalu Claude. Riset web sungguhan memakai <code>browser_search</code> Groq. Key bisa diisi di sini atau di file <code>.env</code> (<code>GROQ_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>).</p>
        <div class="grid2"><label class="f">Provider<select class="input" name="provider">${opt('auto', 'Otomatis (Groq → Claude)', s.provider)}${opt('groq', 'Groq', s.provider)}${opt('claude', 'Claude (Anthropic)', s.provider)}${opt('sim', 'Simulasi (tanpa AI)', s.provider)}</select></label>
          <label class="f">Effort penalaran<select class="input" name="effort">${['low', 'medium', 'high'].map((x) => opt(x, x + (x === 'low' ? ' (hemat, cepat)' : ''), s.effort)).join('')}</select></label></div>
        <div class="grid2"><label class="f">Groq API key ${s.hasGroqKey ? '<span class="chip" style="color:var(--ok)">terpasang</span>' : ''}<input class="input" name="groqApiKey" type="password" autocomplete="off" placeholder="${s.hasGroqKey && !s.groqApiKey ? 'dari .env' : 'gsk_…'}" value="${esc(s.groqApiKey)}"></label>
          <label class="f">Anthropic API key ${s.hasApiKey ? '<span class="chip" style="color:var(--ok)">terpasang</span>' : ''}<input class="input" name="apiKey" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(s.apiKey)}"></label></div>
        <div class="grid2"><label class="f">Groq · model Head/Lead<select class="input" name="groqModel">${(D().groqModels || []).map((m) => opt(m, m, s.groqModel)).join('')}</select></label>
          <label class="f">Groq · model staf<select class="input" name="groqWorkerModel">${(D().groqModels || []).map((m) => opt(m, m, s.groqWorkerModel)).join('')}</select></label></div>
        <div class="grid2"><label class="f">Claude · model Head/Lead<select class="input" name="model">${(D().claudeModels || []).map((m) => opt(m, m, s.model)).join('')}</select></label>
          <label class="f">Claude · model staf<select class="input" name="workerModel">${(D().claudeModels || []).map((m) => opt(m, m, s.workerModel)).join('')}</select></label></div>
        <div class="grid2"><label class="f">Agen live paralel (maks)<input class="input" type="number" min="1" max="20" name="maxConcurrent" value="${s.maxConcurrent}"></label>
          <label class="f">Budget harian (USD)<input class="input" type="number" min="0" step="0.5" name="dailyBudgetUSD" value="${s.dailyBudgetUSD}"></label></div>
        <div class="row small muted">Hari ini: ${usd(u.costToday)} · total ${usd(u.costTotal)} · ${num(u.tokensIn)} in / ${num(u.tokensOut)} out · ${u.calls} panggilan</div>
        <div class="row"><button class="btn primary" id="saveai">Simpan</button><button class="btn" id="testkey">🔌 Tes koneksi</button></div>
      </div></div>
      <div class="card"><div class="card-h">⚡ Otonomi</div><div class="card-b" style="display:grid;gap:12px">
        <div class="row"><label class="switch"><input type="checkbox" id="auto" ${s.autonomy ? 'checked' : ''}><span></span></label><div><b>Kantor berjalan otomatis</b><div class="small muted">Agen mengambil tugas, mendelegasi, dan menjalankan rutinitas sendiri.</div></div></div>
        <div class="row"><label class="switch"><input type="checkbox" id="autoapprove" ${s.autoApprove !== false ? 'checked' : ''}><span></span></label><div><b>Auto-approve</b><div class="small muted">Permintaan persetujuan tetap dicatat untuk audit, tetapi langsung dilanjutkan tanpa menunggu klik manual.</div></div></div>
        <label class="f">Kecepatan siklus (ms per tick)<input class="input" type="range" min="800" max="8000" step="100" id="tick" value="${s.tickMs}"><span class="small" id="tickv">${s.tickMs} ms</span></label>
      </div></div>
      <div class="card"><div class="card-h">🏢 Perusahaan & identitas</div><div class="card-b" style="display:grid;gap:12px">
        <div class="grid2"><label class="f">Nama perusahaan<input class="input" id="cname" value="${esc(c.name)}"></label><label class="f">Tagline<input class="input" id="ctag" value="${esc(c.tagline)}"></label></div>
        <div class="grid2"><label class="f">Bahasa kerja agen<input class="input" id="clang" value="${esc(c.language)}"></label><label class="f">Saya adalah (manusia)<select class="input" id="meid">${D().employees.filter((e) => e.type === 'human').map((e) => opt(e.id, e.name + ' — ' + e.title, S.me)).join('')}</select></label></div>
        <div class="row"><button class="btn primary" id="savec">Simpan</button></div>
      </div></div>
      <div class="card"><div class="card-h">🎨 Tampilan</div><div class="card-b row"><div class="tabs"><button data-th="dark">🌙 Gelap</button><button data-th="light">☀️ Terang</button></div></div></div>
      <div class="card"><div class="card-h">🧠 Pembelajaran agen</div><div class="card-b" style="display:grid;gap:12px">
        <div class="row"><label class="switch"><input type="checkbox" id="learn" ${s.learning !== false ? 'checked' : ''}><span></span></label><div><b>Refleksi & pelajaran otomatis</b><div class="small muted">Setelah tiap tugas, agen menilai hasilnya, menyimpan pelajaran ke memorinya dan ke Playbook divisi. Pelajaran dan feedback manusia disuntikkan ke prompt berikutnya, sehingga agen makin akurat dari waktu ke waktu.</div></div></div>
        <div class="row"><label class="switch"><input type="checkbox" id="train" ${s.collectTraining !== false ? 'checked' : ''}><span></span></label><div><b>Kumpulkan dataset fine-tuning</b><div class="small muted">Hasil kerja yang selesai/disetujui disimpan sebagai JSONL (format chat OpenAI/Groq) per agen di <code>data/training/</code>, siap dipakai untuk fine-tune model.</div></div></div>
        <div class="row wrap"><select class="input" id="trsel" style="width:auto">${D().employees.filter((e) => e.type === 'ai').map((e) => opt(e.id, `${e.name} · ${e.stats.trainingExamples || 0} contoh`)).join('')}</select><button class="btn" id="trdl">⬇ Unduh dataset JSONL</button></div>
      </div></div>
      <div class="card"><div class="card-h">📊 Google Workspace · eksekusi nyata</div><div class="card-b" style="display:grid;gap:10px">
        <p class="small muted" style="margin:0">Konektor gratis melalui Google Apps Script Web App. Setelah aktif, agen dapat benar-benar menambah baris Sheets, membuat file/Doc di Drive, dan membuat Calendar event. Setiap keberhasilan wajib mempunyai receipt ID/URL/range.</p>
        <label class="f">URL Web App<input class="input" id="gurl" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(s.googleAppsScript?.url || '')}"></label>
        <div class="grid2"><label class="f">Shared secret ${s.googleAppsScript?.hasSecret ? '<span class="chip" style="color:var(--ok)">terpasang</span>' : ''}<input class="input" id="gsecret" type="password" autocomplete="off" placeholder="secret yang sama dengan Script Properties" value="${esc(s.googleAppsScript?.secret || '')}"></label><label class="row small"><input type="checkbox" id="genabled" ${s.googleAppsScript?.enabled !== false ? 'checked' : ''}> Aktifkan konektor</label></div>
        <div class="row"><button class="btn primary" id="gsave">Simpan konektor</button><button class="btn" id="gtest">Tes + verifikasi receipt</button><span class="small muted">Template: <code>integrations/google-apps-script/Code.gs</code></span></div>
      </div></div>
      <div class="card"><div class="card-h">🔌 MCP server</div><div class="card-b" style="display:grid;gap:10px">
        <p class="small muted" style="margin:0">Hubungkan server Model Context Protocol (Streamable HTTP). Tool-nya otomatis tersedia untuk agen yang punya capability <code>mcp</code> (head divisi, master, asisten pribadi).</p>
        <div id="mcpl" style="display:grid;gap:8px">${(s.mcpServers || []).map((m, i) => `<div class="row" style="padding:8px;border:1px solid var(--line);border-radius:9px"><b style="flex:1">${esc(m.name)}</b><span class="small mono muted" style="flex:2;overflow:hidden;text-overflow:ellipsis">${esc(m.url)}</span><button class="btn sm" data-mcptest="${i}">Tes</button><button class="btn sm danger" data-mcpdel="${i}">Hapus</button></div>`).join('') || '<div class="small faint">Belum ada server.</div>'}</div>
        <div class="grid2"><input class="input" id="mcpn" placeholder="Nama, mis. github"><input class="input" id="mcpu" placeholder="https://…/mcp"></div>
        <div class="row"><input class="input" id="mcph" placeholder='Header opsional (JSON), mis. {"Authorization":"Bearer …"}'><button class="btn primary" id="mcpadd">＋ Tambah</button></div>
      </div></div>
      <div class="card"><div class="card-h">💾 Data</div><div class="card-b row wrap"><button class="btn" id="exp">⬇ Ekspor JSON</button><label class="btn">⬆ Impor JSON<input type="file" accept="application/json" id="imp" hidden></label><span style="flex:1"></span><button class="btn danger" id="reset">Reset ke awal</button></div></div>
    </div>`;
    const $ = (q) => root.querySelector(q);
    $('#saveai').onclick = async () => { const b = formData(root.querySelector('.card .card-b')); await api('PATCH', '/api/settings', b); toast('Pengaturan AI disimpan', 'ok'); setTimeout(() => this.mount(root), 300); };
    $('#testkey').onclick = async () => { $('#testkey').disabled = true; try { const r = await api('POST', '/api/test-key'); toast(`✅ Terhubung ke ${r.provider === "groq" ? "Groq" : "Claude"} (${esc(r.model)}): “${esc(r.reply.slice(0, 40))}”`, 'ok'); } finally { $('#testkey').disabled = false; } };
    $('#auto').onchange = (e) => api('PATCH', '/api/settings', { autonomy: e.target.checked });
    $('#autoapprove').onchange = (e) => api('PATCH', '/api/settings', { autoApprove: e.target.checked });
    $('#tick').oninput = (e) => ($('#tickv').textContent = e.target.value + ' ms');
    $('#tick').onchange = (e) => api('PATCH', '/api/settings', { tickMs: e.target.value });
    $('#savec').onclick = async () => { await api('PATCH', '/api/company', { name: $('#cname').value, tagline: $('#ctag').value, language: $('#clang').value }); await api('PATCH', '/api/settings', { currentUserId: $('#meid').value }); S.me = $('#meid').value; toast('Tersimpan', 'ok'); };
    root.querySelectorAll('[data-th]').forEach((b) => { b.classList.toggle('active', document.documentElement.dataset.theme === b.dataset.th); b.onclick = () => { window.setTheme(b.dataset.th); root.querySelectorAll('[data-th]').forEach((x) => x.classList.toggle('active', x === b)); }; });
    $('#learn').onchange = (e) => api('PATCH', '/api/settings', { learning: e.target.checked });
    $('#train').onchange = (e) => api('PATCH', '/api/settings', { collectTraining: e.target.checked });
    $('#gsave').onclick = async () => { await api('PATCH', '/api/settings', { googleAppsScript: { url: $('#gurl').value.trim(), secret: $('#gsecret').value, enabled: $('#genabled').checked } }); toast('Konektor Google disimpan', 'ok'); setTimeout(() => this.mount(root), 250); };
    $('#gtest').onclick = async () => { $('#gtest').disabled = true; try { const r = await api('POST', '/api/google-workspace/test'); toast(`✅ Google terhubung: ${esc(r.receipt?.service || 'Apps Script')}`, 'ok'); } finally { $('#gtest').disabled = false; } };
    $('#trdl').onclick = async () => { const id = $('#trsel').value; const r = await api('GET', `/api/training/${id}`); if (!r.examples) return toast('Belum ada contoh training untuk agen ini', 'warn'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.jsonl + '\n'], { type: 'application/jsonl' })); a.download = `training-${id}.jsonl`; a.click(); };
    const mcpSave = (list) => api('PATCH', '/api/settings', { mcpServers: list }).then(() => setTimeout(() => this.mount(root), 200));
    $('#mcpadd').onclick = async () => {
      let headers = {};
      try { headers = $('#mcph').value.trim() ? JSON.parse($('#mcph').value) : {}; } catch { return toast('Header harus JSON valid', 'warn'); }
      if (!/^https?:\/\//.test($('#mcpu').value)) return toast('URL MCP harus http(s)', 'warn');
      await mcpSave([...(D().settings.mcpServers || []), { name: $('#mcpn').value || 'mcp', url: $('#mcpu').value.trim(), headers }]);
      toast('Server MCP ditambahkan', 'ok');
    };
    root.querySelectorAll('[data-mcpdel]').forEach((b) => (b.onclick = () => mcpSave((D().settings.mcpServers || []).filter((_, i) => i !== +b.dataset.mcpdel))));
    root.querySelectorAll('[data-mcptest]').forEach((b) => (b.onclick = async () => { const m = D().settings.mcpServers[+b.dataset.mcptest]; b.disabled = true; try { const r = await api('POST', '/api/mcp/test', m); toast(`✅ ${r.tools.length} tool: ${r.tools.slice(0, 6).map((t) => esc(t.name)).join(', ')}`, 'ok'); } finally { b.disabled = false; } }));
    $('#exp').onclick = async () => { const data = await api('GET', '/api/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `ray-office-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
    $('#imp').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; await api('POST', '/api/import', JSON.parse(await f.text())); };
    $('#reset').onclick = () => modal('Reset semua data?', '<p>Semua tugas, catatan buatan agen, chat, dan statistik akan dihapus dan kembali ke data awal. API key tetap disimpan.</p>', { actions: [{ label: 'Batal' }, { label: 'Reset', kind: 'danger', run: () => api('POST', '/api/reset') }] });
    this.root = root;
  },
  update(colls) { if (colls.has('usage') || colls.has('live')) { const el = this.root?.querySelector('.row.small.muted'); const u = D().usage; if (el) el.textContent = `Hari ini: ${usd(u.costToday)} · total ${usd(u.costTotal)} · ${num(u.tokensIn)} in / ${num(u.tokensOut)} out · ${u.calls} panggilan`; } },
};

export const VIEWS = {
  office: { title: 'Kantor 3D', icon: '🏢', view: OfficeView },
  dashboard: { title: 'Dashboard', icon: '📊', view: DashboardView },
  tasks: { title: 'Tugas', icon: '📋', view: TasksView },
  chat: { title: 'Chat', icon: '💬', view: ChatView },
  brain: { title: 'Brain', icon: '🧠', view: BrainView },
  studio: { title: 'Agent Studio', icon: '✨', view: StudioView },
  team: { title: 'Tim & Divisi', icon: '👥', view: TeamView },
  approvals: { title: 'Persetujuan', icon: '🛑', view: ApprovalsView },
  settings: { title: 'Pengaturan', icon: '⚙️', view: SettingsView },
};
export { drawerKey };
