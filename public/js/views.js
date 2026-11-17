// All screens + agent/task drawers + modals.
import { S, api, esc, emp, div, task, note, noteByTitle, ago, clock, usd, num, avatar, toast, modal, drawer, refreshDrawer, closeDrawer, drawerKey, navigate, formData, opt, empOptions, STATUS_LABEL, TASK_COLS, PRIO, onEvent, onChange } from './core.js';
import { md, linksOf } from './md.js';
import { createGraph } from './graph.js';
import { StudioView } from './studio.js';
import { KnowledgeView } from './knowledge-view.js';
import { bindAppearance } from './appearance-ui.js';
import { resolveAppearance } from './assets3d.js';
import { sfx } from './sfx.js';

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
  officeLoading = Promise.all([import('./office3d.js'), import('./assets3d.js').then((m) => m.loadAssets())]).then(([{ createOffice }]) => {
    office = createOffice(officeRoot.querySelector('.canvas-host'), {
      onAgentPie: (id) => (id && OfficeView.pieId !== id ? OfficeView.pie(id) : OfficeView.pie(null)),
      onSelect: (id) => { if (office?.isPlayer()) OfficeView.talkTo(id); },
      onFollow: (id) => OfficeView.followCard(id),
      onTime: (t, ph, auto, h) => OfficeView.clock(t, ph, auto, h),
      onKeys: (j) => { clearTimeout(OfficeView.keyT); OfficeView.keyT = setTimeout(() => api('PATCH', '/api/settings', { uiKeys: j }).catch(() => {}), 600); },
      onMenu: async (k, id) => { if (k === 'detail') return agentDrawer(id); if (k === 'task') return newTaskModal({ assigneeId: id }); if (k === 'chat') { const r = await api('POST', '/api/dm', { with: id, userId: S.me }); navigate('chat', { ch: r.id }); } },
      onRequestPlay: () => OfficeView.togglePlayer(),
      onHelp: (show) => OfficeView.help(show),
      onToast: (t) => OfficeView.chip(t),
      onLower: (z) => OfficeView.lower(z),
      onTeleport: (i) => OfficeView.teleportChip(i),
      onTeleportMenu: () => OfficeView.teleportMenu(),
      onApp: (id) => OfficeView.openApp(id),
      onHolo: (p) => (p === 1 ? OfficeView.help(true) : p === 2 ? toast('🕐 Waktu & siang-malam: tombol T mengunci atau menjalankan jam', 'ok') : OfficeView.openApp('dashboard')),
      onZone: (z) => { if (office?.isPlayer()) return; z === 'brain' ? OfficeView.openApp('brain', { graph: 1 }) : divisionDrawer(z); },
      onPlayerHint: (h) => OfficeView.playerHint(h), onPlayerAction: (h, kind) => OfficeView.playerAction(h, kind),
    });
    officeRoot.querySelector('[data-loading]')?.remove();
    office.sync(D());
    try { office.loadKeys(D().settings?.uiKeys); } catch { /* ignore */ }
    OfficeView.bindClock();
    onEvent((ev) => office.onEvent(ev));
    return office;
  }).catch((err) => { console.error('[office] gagal:', err.stack || err); const ld = officeRoot.querySelector('[data-loading]'); if (ld) ld.textContent = 'WebGL tidak tersedia: ' + err.message; throw err; });
  return officeLoading;
}
export const officeApi = () => office;

export const OfficeView = {
  mount(root) {
    root.style.overflow = 'hidden';
    ensureOffice().then(() => {
      office.setVisible(true); if (S.params.focus) setTimeout(() => office.focus(S.params.focus), 300);
      // every page load: cinematic overview -> dive to your character -> Play mode (skippable with any key; ?nointro disables)
      let introTried = 0;
      try { if (!window.__rayIntroPlayed && !/nointro/.test(location.search + location.hash) && !S.params.focus) {
        const t = setInterval(() => { introTried++; if (office.hasAvatar('owner')) { clearInterval(t); setTimeout(() => { if (office.isPlayer()) return; window.__rayIntroPlayed = true; /* once per page load: refresh replays the opening, switching tabs inside the app does not */ office.cinematicIntro(() => { if (!office.isPlayer()) OfficeView.togglePlayer(true); }); }, 1800); } else if (introTried > 80) clearInterval(t); }, 500);
      } } catch { /* storage blocked: no intro */ }
    });
    if (!officeRoot) return;
    root.appendChild(officeRoot);
    const ov = document.createElement('div');
    ov.className = 'office-ov';
    ov.innerHTML = `
      <div class="office-brand"><div class="logo">◐</div><div><b>R<b class="ai">AI</b>VERSE <em>AGENT</em></b><small>${esc(D().company.name.toLowerCase().replace(/\s+/g, ''))}.ai · live office</small></div></div>
      <button class="sim-dock glass" id="osim" title="Karakter saya">${avatar(me())}<span><b>${esc(me().name)}</b><small>${esc(me().title || 'Owner')}</small></span></button>
      <div class="ov-left">
        <div class="kpis" id="okpi"></div>
        <div class="tod-clock glass" id="oclock"><button data-clock title="Waktu di kantor: klik untuk mengatur"><span data-cph>🌅</span><b data-ctm>--:--</b><small data-cmd>otomatis</small></button>
          <div class="tod-pop" hidden>
            <input type="range" min="0" max="24" step="0.25" data-cr>
            <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-ch="7">🌅 Pagi</button><button class="btn sm" data-ch="12">☀️ Siang</button><button class="btn sm" data-ch="17.5">🌇 Sore</button><button class="btn sm" data-ch="22">🌙 Malam</button><button class="btn sm ghost" data-cauto>↻ Otomatis</button></div>
          </div></div>
        <div class="glass rooms" id="orooms"></div>
      </div>
      <div class="ov-right">
        <div class="cam-btns">
          <button class="btn glass primary-play" title="Masuk ke kantor sebagai karakter Anda (WASD)" data-cam="play" style="width:auto;padding:0 12px">▶ PLAY</button>
          <button class="btn glass" title="Layar penuh" data-cam="full">⛶</button>
          <button class="btn glass tp-open" title="Teleport ke tempat atau agen mana pun (tombol V)" data-cam="tele" style="width:auto;padding:0 10px">⚡</button>
          <button class="btn glass" title="Tampilkan / sembunyikan petunjuk kontrol" data-cam="hint">?</button>
          <button class="btn glass" title="Menu lainnya" data-cam="more">⋯</button>
        </div>
        <div class="glass cam-menu" hidden>
          <button class="cm-i" data-cam="labels"><i>Aa</i>Label nama</button>
          <button class="cm-i" data-cam="apps"><i>🗂</i>Aplikasi</button>
          <button class="cm-i" data-cam="visual"><i>🎛</i>Visual</button>
          <button class="cm-i" data-cam="me"><i>👤</i>Karakter saya</button>
          <button class="cm-i" data-cam="settings"><i>⚙</i>Pengaturan</button>
          <button class="cm-i" data-cam="info"><i>!</i>Info sistem</button>
        </div>
        <div class="glass hud" id="ohud"></div>
      </div>
      <div class="ov ov-br glass"><div class="card-h" style="padding:7px 10px;gap:6px"><div class="tabs" style="padding:2px"><button data-ft="comms" class="active">Percakapan</button><button data-ft="events">Aktivitas</button></div><span class="badge soft" id="feedcount">0</span><span style="flex:1"></span><span class="muted small" id="feedtoggle" style="cursor:pointer;padding:4px">▾</span></div><div class="feed" id="ofeed"></div></div>
      <div class="phud glass mono" id="phud" hidden><b>MODE PEMAIN</b> · WASD gerak · Shift lari · <b>gerakkan mouse = arah kamera & jalan</b> (tanpa klik) · <b>E</b> panggil & bicara · <b>F</b> beri tugas · Spasi lompat · <b>V</b> teleport · G lambai · M suara · H bantuan · <b>Esc</b> keluar</div>
      <div class="follow-card glass" id="ofollow" hidden></div>
      <div class="pie" id="opie" hidden></div>
      <div class="help-panel glass" id="ohelp" hidden></div>
      <div class="help-panel glass vis-panel" id="ovis" hidden></div>
      <div class="tod-chip glass mono" id="ochip" hidden></div>
      <div class="phint glass" id="phint" hidden></div>
      <div class="lower3" id="olower" hidden></div>
      <div class="tele3" id="otele" hidden></div>
      <div class="tpm" id="otpm" hidden></div>
      <div class="owins" id="owins"></div>
      <div class="oapps glass" id="oapps" hidden></div>
      <div class="ptalk glass" id="ptalk" hidden></div>
      <div class="pmobile" id="pmobile" hidden><div class="pjoy">◎<small>geser</small></div><div class="pbtns"><button class="btn glass" data-pm="talk">E</button><button class="btn glass" data-pm="wave">👋</button><button class="btn glass" data-pm="exit">✕</button></div></div>
      <div class="cmdbar-hint">drag = geser · kiri + drag = geser (pan) · C / Z = tengok kiri / kanan · klik kanan + drag = orbit · Q E = naik turun · Shift = cepat · scroll = zoom · klik agen = menu · P = main sebagai karakter · <b>H</b> bantuan</div>
      <div class="odock glass" id="odock"><div class="od-h"><b>Orkestrator</b><span class="od-to" id="odto"></span><button class="btn sm ghost" id="odadd" title="Tambah agen ke diskusi">＋ Agen</button><button class="btn sm ghost od-needb" id="odneed" title="Review hasil, persetujuan, tugas macet dan lewat tenggat">Butuh kamu<span class="od-n" id="odneedn"></span></button><button class="btn sm ghost" id="odmode" title="Otomatis: kalimat kerja = goal, selain itu obrolan">Otomatis</button><button class="btn sm ghost" id="odtog" title="Kecilkan / besarkan">▾</button><button class="btn sm ghost" id="odinfo" title="Info">i</button></div><div class="od-pick" id="odpick" hidden><input id="odq" placeholder="Cari agen… nama atau jabatan" autocomplete="off"><div class="od-list" id="odlist"></div></div><div class="od-need" id="odneedp" hidden></div><div class="od-info small muted" id="odinfotxt" hidden>Tulis di bawah. Tanpa @nama, pesan ini ke orkestrator yang membagi pekerjaan ke manajer dan staf. Tambahkan agen dengan ＋ untuk diskusi grup.</div><div class="od-body" id="odbody"><div class="od-msgs" id="odmsgs"></div><div class="od-work" id="odwork"></div></div><div class="cmdbar"><input id="goalq" placeholder="Tanya, beri tugas, atau diskusi… (@nama untuk menambah agen)" maxlength="2000" autocomplete="off"><button class="btn" id="meetgo" title="Adakan rapat multi-agen">Rapat</button><button class="btn primary" id="goalgo">Kirim</button></div></div>`;
    root.appendChild(ov);
    ov.querySelector('#osim').onclick = () => OfficeView.characterPicker();
    const send = () => OfficeView.dockSend();
    ov.querySelector('#goalgo').onclick = send;
    ov.querySelector('#meetgo').onclick = () => meetingModal();
    ov.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => { const k = b.dataset.pm; if (k === 'exit') this.togglePlayer(); if (k === 'wave') office?.wave(); if (k === 'talk') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); }));
    this.feedTab = this.feedTab || 'comms';
    ov.querySelectorAll('[data-ft]').forEach((b) => (b.onclick = () => { this.feedTab = b.dataset.ft; ov.querySelectorAll('[data-ft]').forEach((x) => x.classList.toggle('active', x === b)); this.update(new Set(['*'])); }));
    ov.querySelector('#goalq').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) send(); };
    ov.querySelector('#goalq').onkeyup = (e) => e.stopPropagation();
    ov.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => {
      const c = b.dataset.cam;
      if (b.closest('.cam-menu')) ov.querySelector('.cam-menu').hidden = true; // pilihan dari menu ⋯ menutup menu
      if (!office) return;
      if (c === 'play') return OfficeView.togglePlayer();
      if (c === 'tele') return OfficeView.teleportMenu();
      if (c === 'reset') office.resetView(); if (c === 'top') office.topView(); if (c === 'in') office.zoom(0.7); if (c === 'out') office.zoom(1.4);
      if (c === 'labels') office.toggleLabels();
      if (c === 'floor') { const n = office.floorCount(); const k = office.setFloor((office.getFloor() - 1 + n) % n); document.querySelectorAll('[data-cam="floor"]').forEach((x) => (x.textContent = k === n - 1 ? '🏢' : 'L' + (k + 1))); toast('🏢 Lantai ' + (k + 1) + ' dari ' + n + (k === n - 1 ? ' (seluruh gedung)' : ''), 'ok'); }
      if (c === 'more') { const m = ov.querySelector('.cam-menu'); m.hidden = !m.hidden; if (!m.hidden) setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('.ov-right')) { m.hidden = true; document.removeEventListener('click', off); } }), 0); }
      if (c === 'info') { const r = ov.querySelector('.ov-right'); r.classList.toggle('info'); if (r.classList.contains('info')) setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('.ov-right')) { r.classList.remove('info'); document.removeEventListener('click', off); } }), 0); }
      if (c === 'roof') { const m = office.toggleRoof(); toast('🏠 Atap: ' + ({ auto: 'otomatis (terpotong saat melihat ke dalam)', on: 'selalu tampil', off: 'selalu sembunyi' })[m], 'ok'); }
      if (c === 'sound') { const o = sfx.toggle(); b.textContent = o ? '🔊' : '🔇'; if (o) sfx.play('click'); }
      if (c === 'help') OfficeView.help();
      if (c === 'settings') return navigate('settings');
      if (c === 'hint') { this.hintOn = !this.hintOn; ov.querySelector('#phud').hidden = !this.hintOn; b.classList.toggle('on', this.hintOn); return; }
      if (c === 'visual') OfficeView.visual();
      if (c === 'apps') OfficeView.appsMenu();
      if (c === 'me') OfficeView.characterPicker();
      if (c === 'full') (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.());
    }));
    let collapsed = true;
    const applyCollapse = () => { ov.querySelector('#ofeed').style.display = collapsed ? 'none' : ''; ov.querySelector('#feedtoggle').textContent = collapsed ? '▴' : '▾'; ov.querySelector('.ov-br').classList.toggle('mini', collapsed); };
    ov.querySelector('.ov-br .card-h').onclick = (e) => { if (collapsed && !e.target.closest('#feedtoggle')) { collapsed = false; applyCollapse(); } };
    ov.querySelector('#feedtoggle').onclick = () => { collapsed = !collapsed; applyCollapse(); };
    applyCollapse();
    bindCommon(ov);
    this.ov = ov;
    // sinematik pembuka: sembunyikan semua HUD/chat supaya layar bersih; cek ringan 5x per detik
    clearInterval(this._introWatch); this._introWatch = setInterval(() => { const on = !!office?.introActive?.(); if (ov.classList.contains('intro') !== on) ov.classList.toggle('intro', on); }, 200);
    this.dockInit(); // harus setelah this.ov terisi, kalau tidak handler dock tidak terpasang
    this.update(new Set(['*']));
    clearInterval(this.roomTimer);
    this.roomTimer = setInterval(() => this.renderRooms(), 2000);
  },
  renderRooms() {
    const ov = this.ov; if (!ov || !office) return;
    const st = office.stats();
    const color = (r) => div(r.id)?.color || '#e0c9a6';
    const html = st.rooms.map((r) => `<div class="room" data-room="${r.id}"><i style="background:${color(r)}"></i>${esc(r.name)}<b>${r.here}</b></div>`).join('') + `<div class="room"><i style="background:#555"></i>Koridor<b>${st.corridor}</b></div>`;
    this.roomsOpen ??= false; // Ruangan default tertutup; klik judulnya untuk membuka
    const key = html + this.roomsOpen;
    if (key !== this.roomsHtml) {
      this.roomsHtml = key;
      ov.querySelector('#orooms').innerHTML = `<div class="mono" data-rt style="display:flex;justify-content:space-between;letter-spacing:.14em;font-weight:600;cursor:pointer;gap:16px"><span>Ruangan ${this.roomsOpen ? '▾' : '▸'}</span><span class="faint">${st.rooms.length} · ${st.rooms.reduce((n, r) => n + r.here, 0)} agen</span></div>${this.roomsOpen ? `<div style="margin-top:4px">${html}</div>` : ''}`;
      ov.querySelector('[data-rt]').onclick = () => { this.roomsOpen = !this.roomsOpen; this.renderRooms(); };
      ov.querySelectorAll('[data-room]').forEach((x) => (x.onclick = () => office.focusZone(x.dataset.room)));
    }
  },
  update(colls) {
    if (office && (colls.has('*') || colls.has('employees') || colls.has('tasks') || colls.has('divisions'))) office.sync(D());
    const ov = this.ov; if (!ov) return;
    if (colls.has('*') || colls.has('messages') || colls.has('employees') || colls.has('channels') || colls.has('tasks')) this.dockRender();
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
    ov.querySelector('#ohud').innerHTML = `<div class="hud-h">R<b class="ai">AI</b>VERSE <em>AGENT</em> <span>${d.live ? 'live' : 'sim'}</span></div>
      <div class="kv"><span>Status</span><span><i class="live-dot ${!s.autonomy || !d.live ? 'sim-dot' : ''}"></i>${state}</span></div>
      <div class="kv"><span>Build</span><span>v1.1.0 · agora</span></div>
      <div class="kv"><span>Agents</span><span>${ai.length} AI · ${d.employees.length - ai.length} human / ${ai.filter((e) => e.status === 'working' || e.status === 'meeting').length} active</span></div>
      <div class="kv"><span>Sessions</span><span>${d.tasks.filter((t) => t.status === 'in_progress').length} running · ${d.tasks.filter((t) => t.status === 'waiting').length} waiting</span></div>
      <div class="kv"><span>Model</span><span>${esc(activeModel || '-')}</span></div>
      <div class="kv"><span>Tokens</span><span>${num(d.usage.tokensIn + d.usage.tokensOut)} · ${usd(d.usage.costToday)}/${usd(s.dailyBudgetUSD)}</span></div>
      <div class="kv"><span>Brain</span><span>${d.notes.length} notes · ${d.skills?.length || 0} skills</span></div>
      <div class="kv"><span>Host (seluruh PC)</span><span>CPU ${meter(h.cpu)} MEM ${meter(h.mem)}</span></div>
      <div class="kv"><span>Aplikasi ini</span><span>server ${h.rss ?? '–'} MB · ${h.procCpu ?? '–'}% · tab ${(() => { try { return Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB · ' + (window.__ray3d?.perf?.().fps ?? '–') + ' fps'; } catch { return '–'; } })()}</span></div>
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
  togglePlayer(noCinematic = false) {
    if (!office) return;
    const ov = this.ov;
    if (office.isPlayer()) { office.exitPlayer(); return this.playerUI(false); }
    if (office.introActive()) return;
    const enter = () => {
      if (!office.enterPlayer(S.me)) return toast('Karakter Anda belum ada di kantor', 'warn');
      this.playerUI(true);
      toast('🎮 Anda masuk ke kantor. Dekati rekan lalu tekan E untuk bicara.', 'ok');
    };
    // entering Play again: a short cinematic dive from wherever the camera is now (no title, no overview hold)
    if (noCinematic || !office.cinematicIntro(enter, { hold: 0, dur: 5.2, id: S.me, title: false })) enter();
  },
  // ───── Orchestrator dock: one chat for everything (chat with one agent, group discussion, or a goal for the whole company); sits at the left so the 3D stays visible
  dock: { ch: null, to: [], mode: 'auto', open: true, auto: true, sentAt: 0, seen: new Set() },
  orchestrator() { const d = D(); return d.employees.find((e) => e.isPA && e.ownerId === S.me && e.status !== 'offline') || d.employees.find((e) => e.isMaster) || emp('aria'); },
  async dockInit() {
    const ov = this.ov, dk = this.dock; if (!ov) return;
    ov.querySelector('#odtog').onclick = () => { dk.open = !dk.open; this.dockRender(); };
    ov.querySelector('#odneed').onclick = () => { dk.need = !dk.need; this._odNeed = null; this.dockRender(); };
    ov.querySelector('#odinfo').onclick = () => { const t = ov.querySelector('#odinfotxt'); t.hidden = !t.hidden; };
    ov.querySelector('#odmode').onclick = () => { dk.mode = dk.mode === 'auto' ? 'chat' : dk.mode === 'chat' ? 'goal' : 'auto'; this.dockRender(); };
    ov.querySelector('#odadd').onclick = () => { const p = ov.querySelector('#odpick'); p.hidden = !p.hidden; if (!p.hidden) { const q = ov.querySelector('#odq'); q.value = ''; this.dockPick(''); q.focus(); } };
    const q = ov.querySelector('#odq'); q.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') ov.querySelector('#odpick').hidden = true; }; q.onkeyup = (e) => e.stopPropagation(); q.oninput = () => this.dockPick(q.value);
    /* Enter while playing: release the mouse and jump into the chat box */
    if (!this._dockKey) { this._dockKey = true; addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !office?.isPlayer?.()) return; if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; e.preventDefault(); try { document.exitPointerLock(); } catch { /* ignore */ } this.ov?.querySelector('#goalq')?.focus(); }, true); }
    /* problems are visible in the office: every 25 s, stuck (⚠️) and overdue (⏰) agents show a label over their head for 8 s; at most 6, calm, no flicker */
    if (!this._flagT) this._flagT = setInterval(() => {
      if (!office?.mark || document.hidden) return;
      const now = Date.now(), seen = new Set();
      for (const t of D().tasks) {
        if (seen.size >= 6) break;
        const late = ['todo', 'in_progress', 'waiting'].includes(t.status) && t.dueAt && t.dueAt < now;
        if ((t.status !== 'blocked' && !late) || seen.has(t.assigneeId) || emp(t.assigneeId)?.type !== 'ai') continue;
        seen.add(t.assigneeId); office.mark(t.assigneeId, t.status === 'blocked' ? '⚠️' : '⏰', 8000);
      }
    }, 25000);
    if (!dk.ch) { const pa = this.orchestrator(); if (pa) { try { dk.ch = (await api('POST', '/api/dm', { with: pa.id, userId: S.me })).id; } catch { /* retry on send */ } } }
    this.dockRender();
  },
  dockPick(text) {
    const ov = this.ov, list = ov?.querySelector('#odlist'); if (!list) return; const t = text.trim().toLowerCase(), dk = this.dock;
    const rows = D().employees.filter((e) => e.type === 'ai' && !dk.to.includes(e.id) && (!t || (e.name + ' ' + e.title + ' ' + (e.team || '')).toLowerCase().includes(t))).slice(0, 8);
    list.innerHTML = rows.map((e) => `<button class="od-row" data-pk="${e.id}">${avatar(e)}<span><b>${esc(e.name)}</b><small>${esc(e.title || '')}</small></span></button>`).join('') || '<div class="small muted" style="padding:8px">Tidak ada yang cocok</div>';
    list.querySelectorAll('[data-pk]').forEach((b) => (b.onclick = () => { dk.to.push(b.dataset.pk); dk.ch = null; dk.thread = null; ov.querySelector('#odpick').hidden = true; this.dockRender(); ov.querySelector('#goalq').focus(); }));
  },
  async dockSend() {
    const ov = this.ov, dk = this.dock, q = ov?.querySelector('#goalq'); if (!q) return;
    const text = q.value.trim(); if (!text) return q.focus();
    if (/^\/rapat\b/i.test(text)) { q.value = ''; return meetingModal({ topic: text.replace(/^\/rapat\s*/i, '') }); }
    q.value = ''; dk.sentAt = Date.now();
    try {
      const r = await api('POST', '/api/orchestrate', { text, userId: S.me, to: dk.to, mode: dk.mode, channelId: !dk.to.length && dk.thread ? dk.thread : undefined });
      dk.ch = r.channelId; dk.lastAction = r.action; dk.lastMembers = r.members || [];
      dk.thread = String(r.channelId || '').startsWith('goal-') ? r.channelId : dk.to.length ? null : dk.thread;
      if (r.action === 'goal') toast('🎯 Goal diterima orkestrator — lihat tim yang bergerak', 'ok');
    } catch (err) {
      if (/Endpoint tidak ada/i.test(err.message)) {
        /* the server still runs the old code (no /api/orchestrate): fall back to the older endpoints so the box keeps working, and say why */
        try {
          const pa = this.orchestrator(), who = dk.to.length ? dk.to : [pa.id];
          const goalish = dk.mode === 'goal' || (dk.mode === 'auto' && !dk.to.length && /\b(tolong|buat|buatkan|bikin|susun|siapkan|kerjakan|analisis|tulis|cari|riset|rancang|lakukan|jalankan|pastikan|pelajari|please|create|make|write|draft|prepare)\b/i.test(text));
          if (goalish) { await api('POST', '/api/goals', { title: text.slice(0, 150), description: text, userId: S.me }); toast('🎯 Goal dikirim (server lama: restart npm start untuk fitur grup penuh)', 'ok'); }
          else { dk.ch = (await api('POST', '/api/dm', { with: who[0], userId: S.me })).id; await api('POST', '/api/messages', { channelId: dk.ch, userId: S.me, text }); toast('Server masih versi lama: restart "npm start" agar diskusi grup berfungsi', 'warn'); }
          this.dockRender(); q.focus(); return;
        } catch (err2) { err = err2; }
      }
      q.value = text; toast('Gagal mengirim: ' + err.message, 'warn');
    }
    this.dockRender(); q.focus();   /* the caret stays in the box so the discussion can continue */
  },
  /** "Butuh kamu": reviews, approvals, stuck and overdue work from the Owner's own goals, in one list */
  needItems() {
    const d = D(), me = S.me, now = Date.now();
    const rootOf = (t) => d.tasks.find((x) => x.id === (t.rootId || t.id)) || t;
    const mine = (t) => rootOf(t).createdBy === me;
    const aps = (d.approvals || []).filter((a) => a.status === 'pending' && (a.approverId === me || a.approverId === 'owner'));
    const blocked = d.tasks.filter((t) => t.status === 'blocked' && mine(t)).slice(0, 6);
    const late = d.tasks.filter((t) => ['todo', 'in_progress', 'waiting'].includes(t.status) && t.dueAt && t.dueAt < now && mine(t)).slice(0, 6);
    const thread = (t) => { const r = rootOf(t); return r.kind === 'goal' && d.channels.some((c) => c.id === 'goal-' + r.id) ? `<button class="btn sm ghost" data-thread="goal-${r.id}">Thread</button>` : ''; };
    const rev = aps.map((a) => { const t = d.tasks.find((x) => x.id === a.taskId) || {}; const ev = a.evidence || t.evidence || []; return `<div class="od-ni"><div class="od-nt" data-task="${a.taskId}">${a.kind === 'review' ? '🔎 Review' : '🛑 Persetujuan'} · <b>${esc(String(a.title).slice(0, 70))}</b></div><div class="small muted">${esc(emp(a.requesterId)?.name || '')}${a.summary ? ': ' + esc(String(a.summary).slice(0, 140)) : ''}</div><div class="small">${ev.length ? `Bukti ${ev.filter((x) => x.ok).length}/${ev.length} terverifikasi` : 'Tanpa bukti'}${(a.unverified ?? t.unverified) ? ' · <b style="color:var(--warn)">⚠️ perlakukan sebagai asumsi</b>' : ''}${(a.gaps || t.gaps) ? `<br>Belum terpenuhi: ${esc(String(a.gaps || t.gaps).slice(0, 160))}` : ''}</div><div class="row"><button class="btn sm ok" data-approve="${a.id}">✓ Setujui</button><button class="btn sm" data-reject="${a.id}">✏️ Revisi</button><button class="btn sm ghost" data-task="${a.taskId}">Lihat hasil</button>${thread(t)}</div></div>`; }).join('');
    const blk = blocked.map((t) => `<div class="od-ni"><div class="od-nt" data-task="${t.id}">⚠️ Macet · <b>${esc(t.title.slice(0, 70))}</b></div><div class="small muted">${esc(emp(t.assigneeId)?.name || '')}: ${esc(String((t.log || []).filter((l) => l.type === 'error').at(-1)?.text || '').slice(0, 140))}</div><div class="row"><button class="btn sm" data-retry="${t.id}">🔄 Coba lagi</button><button class="btn sm ghost" data-task="${t.id}">Pindahkan / detail</button>${thread(t)}</div></div>`).join('');
    const lt = late.map((t) => `<div class="od-ni"><div class="od-nt" data-task="${t.id}">⏰ Lewat tenggat · <b>${esc(t.title.slice(0, 70))}</b></div><div class="small muted">${esc(emp(t.assigneeId)?.name || '')} · tenggat ${ago(t.dueAt)}</div><div class="row"><button class="btn sm ghost" data-task="${t.id}">Detail</button>${thread(t)}</div></div>`).join('');
    const count = aps.length + blocked.length + late.length;
    return { count, sig: [...aps.map((a) => a.id), ...blocked.map((t) => t.id), ...late.map((t) => t.id)].join(','), html: count ? rev + blk + lt : '<div class="small muted" style="padding:6px 4px">Tidak ada yang menunggu keputusanmu. 👍</div>' };
  },
  dockRender() {
    const ov = this.ov, dk = this.dock; if (!ov) return; const box = ov.querySelector('#odock'); if (!box) return;
    const need = this.needItems(), nEl = ov.querySelector('#odneedn'), np = ov.querySelector('#odneedp');
    if (nEl) { nEl.textContent = need.count ? String(need.count) : ''; nEl.hidden = !need.count; }
    if (np) {
      np.hidden = !dk.need;
      if (dk.need && need.sig + '|' !== this._odNeed) {
        this._odNeed = need.sig + '|'; np.innerHTML = need.html; bindApprovalButtons(np);
        np.querySelectorAll('[data-retry]').forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); try { await api('PATCH', `/api/tasks/${b.dataset.retry}`, { status: 'todo', userId: S.me }); toast('Tugas dijalankan ulang', 'ok'); } catch (err) { toast(err.message, 'warn'); } }));
        np.querySelectorAll('[data-thread]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); dk.thread = b.dataset.thread; dk.ch = dk.thread; dk.to = []; dk.need = false; this._odSig = null; this.dockRender(); }));
      }
    }
    box.classList.toggle('collapsed', !dk.open); ov.querySelector('#odtog').textContent = dk.open ? '▾' : '▴';
    ov.querySelector('#odmode').textContent = ({ auto: 'Otomatis', chat: 'Obrolan', goal: 'Goal' })[dk.mode];
    const pa = this.orchestrator();
    const th = dk.thread && D().channels.find((c) => c.id === dk.thread);
    ov.querySelector('#odto').innerHTML = th && !dk.to.length ? `<span class="od-chip" data-leave="1" title="Keluar dari thread goal (kembali ke orkestrator)">${esc(String(th.name).slice(0, 28))} ✕</span>` : (dk.to.length ? dk.to.map((id) => `<span class="od-chip" data-rm="${id}" title="Klik untuk mengeluarkan">${esc(emp(id)?.name?.split(' ')[0] || id)} ✕</span>`).join('') : `<span class="od-chip dim">${esc(pa?.name?.split(' ')[0] || 'Orkestrator')}</span>`);
    ov.querySelector('[data-leave]')?.addEventListener('click', () => { dk.thread = null; dk.ch = null; this._odSig = null; this.dockInit(); });
    ov.querySelectorAll('[data-rm]').forEach((c) => (c.onclick = () => { dk.to = dk.to.filter((x) => x !== c.dataset.rm); dk.ch = null; this.dockRender(); }));
    /* messages of the active thread, newest at the bottom; older ones fade out by CSS */
    const msgs = dk.ch ? D().messages.filter((m) => m.channelId === dk.ch).slice(-12) : [];
    const el = ov.querySelector('#odmsgs'), sig = msgs.map((m) => m.id).join(',');
    if (el && sig !== this._odSig) {
      this._odSig = sig; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      el.innerHTML = msgs.map((m) => { const a = emp(m.authorId), me = m.authorId === S.me; return `<div class="od-m ${me ? 'me' : ''}">${me ? '' : avatar(a)}<div class="od-b"><div class="od-w">${me ? 'Anda' : esc(a?.name || m.authorId)}</div><div class="md">${md(String(m.text).slice(0, 700))}</div></div></div>`; }).join('');
      if (near || !this._odInit) el.scrollTop = el.scrollHeight; this._odInit = true;
    }
    /* who is busy right now: chips + spotlight in the 3D world */
    const busy = D().employees.filter((e) => e.type === 'ai' && ['working', 'meeting', 'chatting'].includes(e.status)).slice(0, 10);
    const talkTo = new Set(dk.to.length ? dk.to : dk.lastAction === 'chat' && dk.lastMembers?.length ? dk.lastMembers : [pa?.id]);
    const relevant = (e) => talkTo.has(e.id) || ((dk.lastAction === 'goal' || dk.lastAction === 'meeting') && Date.now() - dk.sentAt < 10 * 60000 && e.status !== 'chatting');
    /* a meeting the Owner sits in: say so plainly, because every message without a chosen agent now goes to the room */
    const liveM = (D().meetings || []).find((m) => m.status === 'waiting_owner' && m.ownerId === S.me);
    const wk = ov.querySelector('#odwork'), wsig = busy.map((e) => e.id + e.status).join(',') + '|' + (liveM?.id || '') + dk.to.length;
    if (wk && wsig !== this._odW) {
      this._odW = wsig;
      const mBar = liveM ? `<div class="od-live"><span>🎙️ <b>Rapat berlangsung</b> · ${esc(String(liveM.topic || '').slice(0, 40))}<small>${dk.to.length ? 'Pesan ke agen pilihan tetap jadi obrolan pribadi. Hapus pilihan agen untuk bicara ke ruang rapat.' : 'Pesanmu didengar seluruh peserta. Sebut nama agar orang itu yang menjawab.'}</small></span><button class="btn sm" id="odend">Tutup rapat</button></div>` : '';
      wk.innerHTML = mBar + (busy.length ? '<span class="od-wl">Sedang bekerja</span>' + busy.map((e) => `<button class="od-chip work" data-wf="${e.id}" title="${esc(e.statusText || '')}">● ${esc(e.name.split(' ')[0])}</button>`).join('') : '');
      wk.querySelector('#odend')?.addEventListener('click', async () => { try { await api('POST', '/api/orchestrate', { text: 'tutup rapat', userId: S.me, to: [], mode: 'chat' }); toast('Rapat ditutup; notulen sedang disusun', 'ok'); } catch (err) { toast('Gagal menutup rapat: ' + err.message, 'warn'); } });
      wk.querySelectorAll('[data-wf]').forEach((c) => (c.onclick = () => office?.startChase?.(c.dataset.wf)));
      /* a freshly started agent right after you sent something: the camera glides to them (only if you are not already following someone or playing) */
      for (const e of busy) if (!dk.seen.has(e.id)) { dk.seen.add(e.id); if (dk.auto && relevant(e) && Date.now() - dk.sentAt < 90000 && office && !office.isPlayer?.() && !office.following?.()) { office.startChase?.(e.id); } }
      for (const id of [...dk.seen]) if (!busy.some((e) => e.id === id)) dk.seen.delete(id);
    }
    /* only the people of THIS conversation glow (chat with aray = aray; a goal = whoever starts working on it), not every agent that happens to be busy */
    office?.spotlight?.(busy.filter(relevant).map((e) => e.id));
    office?.setInset?.(dk.open && !office?.isPlayer?.() && innerWidth > 900 ? 392 : 0);
  },
  playerUI(on) {
    const ov = this.ov; if (!ov) return;
    ov.querySelector('#phud').hidden = !(on && this.hintOn); // petunjuk hanya tampil saat tombol ? ditekan
    ov.querySelector('#pmobile').hidden = !on || !matchMedia('(pointer: coarse)').matches;
    ov.querySelector('[data-cam="play"]').textContent = on ? '■ EXIT' : '▶ PLAY';
    ov.classList.toggle('playing', on); office?.setInset?.(on ? 0 : (this.dock?.open && innerWidth > 900 ? 392 : 0));
    if (!on) { ov.querySelector('#phint').hidden = true; ov.querySelector('#ptalk').hidden = true; this.talkId = null; }
  },
  playerHint(h) {
    const el = this.ov?.querySelector('#phint'); if (!el) return;
    if (!office?.isPlayer()) { el.hidden = true; if (this.ov?.classList.contains('playing')) this.playerUI(false); return; }   // left Play with Esc: the button must say PLAY again
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
    if (h.id === 'brain') return this.openApp('brain', { graph: 1 });
    if (h.id.startsWith('app:')) return this.openApp(h.id.slice(4));
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
    this.talkId = id; this.talkCh = r.id; this.spokenMsg = undefined; this.talkWait = false;
    this.renderTalk(true);
  },
  renderTalk(focus) {
    const el = this.ov?.querySelector('#ptalk'); if (!el || !this.talkId) return;
    const e = emp(this.talkId);
    const msgs = D().messages.filter((m) => m.channelId === this.talkCh).slice(-6);
    const typing = el.querySelector('input')?.value || '';
    const hadFocus = document.activeElement?.id === 'ptin' || (el.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT');   // keep the caret in the box
    const last = msgs[msgs.length - 1], lastMine = !!last && last.authorId === S.me;
    if (last && !lastMine && last.id !== this.spokenMsg) { if (this.spokenMsg !== undefined || this.talkWait) office?.speak?.(this.talkId, last.text); this.talkWait = false; }
    if (last && !lastMine) this.spokenMsg = last.id; else if (!last && this.spokenMsg === undefined) this.spokenMsg = null;
    const waiting = !!this.talkWait && lastMine;
    el.hidden = false;
    el.innerHTML = `<div class="row" style="margin-bottom:6px">${avatar(e)}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b><div class="small muted">${esc(e.title)} · ${esc(e.statusText || '')}</div></div><button class="btn sm ghost" data-tk="full">Buka chat</button><button class="btn sm ghost" data-tk="close">✕</button></div>
      <div class="ptalk-msgs">${msgs.map((m) => `<div class="ptalk-m ${m.authorId === S.me ? 'me' : ''}"><div class="md">${md(m.text.slice(0, 900))}</div></div>`).join('') + (waiting ? '<div class="ptalk-m typing"><span class="dots"><i></i><i></i><i></i></span> <span class="small muted">' + esc(e.name.split(' ')[0]) + ' sedang berpikir…</span></div>' : '') || `<div class="small muted">Sapa ${esc(e.name)}… mis. “${esc((e.starters || [])[0] || 'Apa yang sedang kamu kerjakan?')}”</div>`}</div>
      <div class="row" style="margin-top:6px"><input class="input" id="ptin" placeholder="Bicara dengan ${esc(e.name)}…" value="${esc(typing)}"><button class="btn primary" data-tk="send">Kirim</button></div>`;
    const box = el.querySelector('.ptalk-msgs'); box.scrollTop = box.scrollHeight;
    const input = el.querySelector('#ptin');
    const send = async () => { const text = input.value.trim(); if (!text) return; input.value = ''; office?.think?.(this.talkId); this.talkWait = true; input.focus(); this.renderTalk(true); await api('POST', '/api/messages', { channelId: this.talkCh, text, userId: S.me }); };
    el.querySelector('[data-tk="send"]').onclick = send;
    const close = () => { el.hidden = true; office?.endTalk?.(this.talkId); this.talkId = null; };
    input.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') send(); if (ev.key === 'Escape') close(); };
    input.onkeyup = (ev) => ev.stopPropagation();
    el.querySelector('[data-tk="close"]').onclick = close;
    el.querySelector('[data-tk="full"]').onclick = () => navigate('chat', { ch: this.talkCh });
    if (focus || hadFocus) { input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* ignore */ } }
  },
  /** Compact card for the agent the camera is following (replaces opening the drawer on click). */
  followCard(id) {
    const el = this.ov?.querySelector('#ofollow'); if (!el) return;
    clearInterval(this.followTimer);
    if (!id) { el.hidden = true; this.pie(null); return; }
    const draw = () => {
      const e = emp(id); if (!e) return;
      const t = D().tasks.find((x) => x.id === e.currentTaskId);
      el.hidden = false;
      el.innerHTML = `<div class="row">${avatar(e)}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b> <span class="status-dot st-${e.status}"></span><div class="small muted">${esc(e.title)}${e.team ? ' · ' + esc(e.team) : ''}</div></div><span class="chip mono">📷 IKUTI</span></div>
        <div class="small" style="margin:8px 0 2px">${esc(e.statusText || STATUS_LABEL[e.status] || '')}</div>${t ? `<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${esc(t.title)}</div>` : ''}
        ${e.mind?.mood ? `<div class="small muted">Mood: ${esc(e.mind.mood)}</div>` : ''}
        ${(() => { const open = D().tasks.filter((x) => x.assigneeId === id && x.status !== 'done').length; const bars = [['Percaya diri', e.mind?.confidence ?? 60], ['Kapasitas', Math.max(5, 100 - open * 22)]]; return `<div class="needs">${bars.map(([l, v]) => `<div class="need ${v < 35 ? 'low' : ''}">${l}<i><b style="width:${Math.round(v)}%"></b></i></div>`).join('')}</div>`; })()}
        <div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-fc="detail">Detail</button><button class="btn sm" data-fc="chat">Chat</button><button class="btn sm" data-fc="task">＋ Tugas</button><span style="flex:1"></span><button class="btn sm ghost" data-fc="stop" title="Esc">✕</button></div>
        <div class="small faint mono" style="margin-top:6px">drag = putar kamera · Tab = agen berikutnya · Esc = berhenti</div>`;
      el.querySelector('[data-fc="detail"]').onclick = () => agentDrawer(id);
      el.querySelector('[data-fc="chat"]').onclick = async () => { const r = await api('POST', '/api/dm', { with: id, userId: S.me }); navigate('chat', { ch: r.id }); };
      el.querySelector('[data-fc="task"]').onclick = () => newTaskModal({ assigneeId: id });
      el.querySelector('[data-fc="stop"]').onclick = () => office?.stopChase();
    };
    draw(); this.followTimer = setInterval(draw, 2500);
  },
  /** Sims-style pie menu that floats around the selected agent and follows it on screen. */
  pie(id) {
    cancelAnimationFrame(this.pieRaf);
    const el = this.ov?.querySelector('#opie'); if (!el) return;
    if (!id || !emp(id)) { el.hidden = true; el.classList.remove('open'); this.pieId = null; return; }
    if (this.pieId !== id) {
      this.pieId = id;
      const e = emp(id);
      const items = [['💬 Bicara', 'chat'], ['📋 Beri tugas', 'task'], ['🧠 Profil', 'detail'], ['👋 Sapa', 'wave'], ['⋯ Lainnya', 'more']];
      const R = 96;
      el.innerHTML = `<div class="pie-n glass"><b>${esc(e.name)}</b> · ${esc(STATUS_LABEL[e.status] || e.status || '')}</div>` + items.map(([label, act], i) => { const a = -Math.PI / 2 + (i - (items.length - 1) / 2) * 0.82; return `<button class="pie-i glass" data-pa="${act}" style="left:${Math.cos(a) * R * 1.25}px;top:${Math.sin(a) * R}px">${label}</button>`; }).join('');
      const run = { chat: async () => { const r = await api('POST', '/api/dm', { with: id, userId: S.me }); navigate('chat', { ch: r.id }); }, task: () => newTaskModal({ assigneeId: id }), detail: () => agentDrawer(id), wave: () => { office?.wave(id); toast('👋 ' + emp(id).name + ' menyapa balik', 'ok'); }, more: () => office?.agentMenuAt?.(id) };
      el.querySelectorAll('[data-pa]').forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); this.pie(null); run[b.dataset.pa](); }));
      el.hidden = false; requestAnimationFrame(() => el.classList.add('open'));
    }
    const follow = () => {
      const pt = office?.screenOf(id);
      if (pt) { el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; el.style.visibility = 'visible'; } else el.style.visibility = 'hidden';
      this.pieRaf = requestAnimationFrame(follow);
    };
    follow();
  },
  /** Enscape-style controls reference. */
  // ───── application windows: every page of the platform opens right inside the 3D scene
  appsMenu() {
    const el = this.ov?.querySelector('#oapps'); if (!el) return;
    if (!el.hidden) { el.hidden = true; return; }
    const APPS = [['dashboard', '📊', 'Dashboard', 'Ringkasan perusahaan'], ['tasks', '📋', 'Tugas', 'Kanban & jejak kerja'], ['chat', '💬', 'Chat', 'Percakapan & rapat'], ['brain', '🧠', 'Brain', 'Knowledge graph'], ['studio', '✨', 'Agent Studio', 'Rancang karyawan AI'], ['team', '👥', 'Tim & Divisi', 'Struktur organisasi'], ['knowledge', '🏛️', 'Ruang Pengetahuan', 'Perpustakaan'], ['approvals', '🛑', 'Persetujuan', 'Menunggu keputusan'], ['settings', '⚙️', 'Pengaturan', 'Sistem & AI']];
    el.innerHTML = '<div class="oapps-h">Buka di kantor</div>' + APPS.map(([id, ic, t, s]) => '<button class="oapp" data-app="' + id + '"><span class="oapp-ic">' + ic + '</span><span><b>' + t + '</b><small>' + s + '</small></span></button>').join('');
    el.hidden = false;
    el.querySelectorAll('[data-app]').forEach((b) => (b.onclick = () => { el.hidden = true; this.openApp(b.dataset.app); }));
  },
  openApp(id, params = {}) {
    const host = this.ov?.querySelector('#owins'); const V = VIEWS[id]; if (!host || !V || id === 'office') return;
    this.wins = this.wins || new Map();
    this.ov.querySelector('#oapps')?.setAttribute('hidden', '');
    let w = this.wins.get(id);
    if (w) { w.view.unmount?.(w.body); w.body.innerHTML = ''; w.body.style.overflow = ''; }
    else {
      const el = document.createElement('div'); el.className = 'owin glass'; el.dataset.win = id;
      el.innerHTML = '<div class="owin-h"><span class="owin-t">' + V.icon + ' ' + esc(V.title) + '</span><span style="flex:1"></span><button class="owin-b" data-w="max" title="Perbesar">⤢</button><button class="owin-b" data-w="x" title="Tutup">✕</button></div><div class="owin-body"></div>';
      const n = this.wins.size; el.style.left = 6 + n * 3 + '%'; el.style.top = 7 + n * 3 + '%';
      host.appendChild(el);
      const body = el.querySelector('.owin-body'); w = { id, el, body, view: V.view }; this.wins.set(id, w);
      const front = () => { el.style.zIndex = (this.winZ = (this.winZ || 20) + 1); S.embedUntil = performance.now() + 2500; };
      el.addEventListener('pointerdown', front, true); el.addEventListener('keydown', () => { S.embedUntil = performance.now() + 2500; }, true); front();
      el.querySelector('[data-w="x"]').onclick = () => this.closeApp(id);
      el.querySelector('[data-w="max"]').onclick = () => el.classList.toggle('max');
      const hd = el.querySelector('.owin-h'); let drag = null;
      hd.addEventListener('pointerdown', (e) => { if (e.target.closest('button') || el.classList.contains('max')) return; const r = el.getBoundingClientRect(), pr = host.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, pr }; hd.setPointerCapture(e.pointerId); });
      hd.addEventListener('pointermove', (e) => { if (!drag) return; el.style.left = Math.max(0, Math.min(drag.pr.width - 120, e.clientX - drag.pr.left - drag.dx)) + 'px'; el.style.top = Math.max(0, Math.min(drag.pr.height - 40, e.clientY - drag.pr.top - drag.dy)) + 'px'; });
      hd.addEventListener('pointerup', () => { drag = null; });
      if (!this.appHooked) { this.appHooked = true; onChange((colls) => { for (const x of this.wins?.values() || []) x.view.update?.(colls); }); S.embedHook = (view, p) => { if (S.view !== 'office' || !VIEWS[view] || view === 'office') return false; this.openApp(view, p); return true; }; }
    }
    S.params = params || {};
    try { w.view.mount(w.body); } catch (err) { w.body.innerHTML = '<div class="page"><p class="muted">Gagal membuka: ' + esc(err.message) + '</p></div>'; }
    w.el.style.zIndex = (this.winZ = (this.winZ || 20) + 1);
    office?.setBlocking?.(true);
  },
  closeApp(id) {
    const w = this.wins?.get(id); if (!w) return; try { w.view.unmount?.(w.body); } catch { /* ignore */ } w.el.remove(); this.wins.delete(id);
    if (!this.wins.size) { office?.setBlocking?.(false); S.embedUntil = 0; }
  },
  closeAllApps() { for (const id of [...(this.wins?.keys() || [])]) this.closeApp(id); },
  /** teleport menu (V / ⚡): releases the mouse (setBlocking), lists plaza landmarks, rooms and agents with a search box; picking one jumps there and re-locks the mouse */
  teleportMenu() {
    const el = this.ov?.querySelector('#otpm'); if (!el || !office) return;
    if (!el.hidden) return this.teleportClose();
    const all = office.teleportTargets(), groups = ['Plaza', 'Sky Deck', 'Ruangan', 'Agen'];
    el.hidden = false; office.setBlocking?.(true);
    el.innerHTML = '<div class="tpm-card glass"><div class="tpm-h"><b>⚡ Teleport</b><small>pilih tujuan · Enter = yang pertama · Esc = tutup</small><button class="tpm-x" data-x title="Tutup">✕</button></div><input class="tpm-q" placeholder="Cari tempat atau agen…" autocomplete="off" spellcheck="false"><div class="tpm-body"></div></div>';
    const q = el.querySelector('.tpm-q'), body = el.querySelector('.tpm-body');
    const go = (id) => { this.teleportClose(); office.teleportTo(id); office.relock?.(); };
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      body.innerHTML = groups.map((g) => {
        let rows = all.filter((x) => x.group === g && (!t || (x.label + ' ' + x.sub).toLowerCase().includes(t)));
        rows = g === 'Agen' && !t ? rows.filter((x) => x.status === 'working' || x.status === 'meeting').slice(0, 8) : rows.slice(0, 30);
        if (!rows.length) return '';
        return '<div class="tpm-g"><h4>' + g + (g === 'Agen' && !t ? ' <em>yang sedang aktif · ketik untuk mencari</em>' : '') + '</h4><div class="tpm-grid">' + rows.map((x) => '<button class="tpm-i" data-id="' + esc(x.id) + '"><i>' + x.icon + '</i><span><b>' + esc(x.label) + '</b><small>' + esc(x.sub || '') + '</small></span></button>').join('') + '</div></div>';
      }).join('') || '<div class="tpm-empty">Tidak ada yang cocok</div>';
      body.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => go(b.dataset.id)));
    };
    q.oninput = draw; draw();
    q.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); this.teleportClose(); } else if (e.key === 'Enter') { e.preventDefault(); const b = body.querySelector('[data-id]'); if (b) go(b.dataset.id); } };
    el.onclick = (e) => { if (e.target === el || e.target.closest('[data-x]')) this.teleportClose(); };
    setTimeout(() => q.focus(), 30);
  },
  teleportClose() { const el = this.ov?.querySelector('#otpm'); if (!el || el.hidden) return; el.hidden = true; el.innerHTML = ''; office?.setBlocking?.(false); },
  /** teleport chip: a gradient glass pill that slides in at the bottom right while agents jump across the campus */
  teleportChip(i) {
    const el = this.ov?.querySelector('#otele'); if (!el) return;
    clearTimeout(this.teleT1); clearTimeout(this.teleT2);
    const names = i.names.slice(0, 4).map(esc).join(', ') + (i.n > 4 ? ' +' + (i.n - 4) : '');
    el.innerHTML = '<span class="tp-ic"><i></i><b>⚡</b></span><div><div class="tp-k">Teleport</div><div class="tp-t">' + names + '</div><div class="tp-s">→ ' + esc(i.label) + '</div></div>';
    el.hidden = false; el.classList.remove('in', 'out'); void el.offsetWidth; el.classList.add('in');
    this.teleT1 = setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 2600);
    this.teleT2 = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 3300);
  },
  /** lower third: slides in for a few seconds to say where you are, then fades away */
  lower(z) {
    const el = this.ov?.querySelector('#olower'); if (!el || !office?.isPlayer?.()) return;
    clearTimeout(this.lowerT1); clearTimeout(this.lowerT2);
    el.innerHTML = '<span class="l3-bar" style="background:' + esc(z.color || '#7c83ff') + '"></span><span class="l3-ic">' + esc(z.icon || '📍') + '</span><div><div class="l3-k">Kamu berada di</div><div class="l3-t">' + esc(z.title) + '</div><div class="l3-s">' + esc(z.sub || '') + '</div></div>';
    el.hidden = false; el.classList.remove('in', 'out'); void el.offsetWidth; el.classList.add('in');
    this.lowerT1 = setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 3800);
    this.lowerT2 = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 4500);
  },
  /** Enscape-style visual settings: camera, image, atmosphere (fog, clouds, sky orbs); presets can be saved */
  visual(show) {
    const el = this.ov?.querySelector('#ovis'); if (!el || !office?.visual) return;
    el.hidden = show === undefined ? !el.hidden : !show; if (el.hidden) return;
    const hp = this.ov.querySelector('#ohelp'); if (hp) hp.hidden = true;
    const tab = this.visTab || 'main';
    const pct = (x) => Math.round(x * 100) + '%';
    const mm = (f) => (12 / Math.tan((f * Math.PI) / 360)).toFixed(1) + 'mm';
    // [key, label, min, max, step, formatter]
    const SCHEMA = {
      main: [['Kamera', [['fov', 'Sudut pandang (FOV)', 20, 90, 1, (x) => Math.round(x) + '° / ' + mm(x)], ['dof', 'Kedalaman medan (blur latar)', 0, 2.5, 0.05, pct], ['exposure', 'Kecerahan / exposure', 0, 1, 0.01, pct]]], ['Keramaian', [['crowd', 'Agen idle yang boleh berkeliling sekaligus', 0, 60, 1, (x) => Math.round(x) + ' agen'], ['tele', 'Agen teleport bila jarak lebih dari', 0, 120, 5, (x) => (x ? Math.round(x) + ' unit' : 'mati')]]]],
      image: [['Koreksi', [['hi', 'Highlights', -1, 1, 0.01, pct], ['sh', 'Shadows', -1, 1, 0.01, pct]]], ['Warna', [['sat', 'Saturasi', 0, 2, 0.01, pct], ['temp', 'Suhu warna', 3000, 10000, 100, (x) => Math.round(x) + ' K']]], ['Efek', [['bloom', 'Bloom / glow', 0, 1, 0.01, pct], ['vig', 'Vignette', 0, 1, 0.01, pct], ['ca', 'Chromatic aberration', 0, 1, 0.01, pct]]]],
      atmos: [['Kabut', [['fog', 'Atmosfer (kabut)', 0, 100, 1, (x) => Math.round(x) + '%']]], ['Awan', [['density', 'Kepadatan', 0, 1, 0.01, pct], ['variety', 'Keragaman', 0, 1, 0.01, pct], ['cirrus', 'Awan cirrus (tipis tinggi)', 0, 1, 0.01, pct], ['contrails', 'Jejak pesawat', 0, 6, 1, (x) => Math.round(x)], ['lon', 'Bujur (arah awan)', 0, 1, 0.01, (x) => Math.round(x * 10000) + 'm'], ['lat', 'Lintang (jarak awan)', 0, 1, 0.01, (x) => Math.round(x * 10000) + 'm']]], ['Mimpi berkabut', [['dream', 'Kabut tipis & berkas cahaya', 0, 1, 0.01, pct]]], ['Cahaya langit', [['sun', 'Kecerahan matahari', 0, 2, 0.01, pct], ['starsMoon', 'Bintang & bulan', 0, 2, 0.01, pct], ['moon', 'Ukuran bulan', 0.5, 3, 0.05, pct]]]],
    };
    const PRESETS = {
      'Pilihan Ray (bawaan)': { look: 'soft', dof: 0.3, fov: 50, exposure: 0.21, hi: 0.39, sh: -0.49, sat: 1.4, temp: 5400, bloom: 0.67, vig: 0.59, ca: 0.33, fog: 41, density: 1, variety: 0, cirrus: 1, contrails: 2, lon: 0.49, lat: 0, sun: 0.36, starsMoon: 2, moon: 3, dream: 0.6 },
      'Foggy Dreams': { look: 'soft', dof: 0.35, fov: 50, exposure: 0.25, hi: 0.3, sh: -0.3, sat: 1.15, temp: 6300, bloom: 0.55, vig: 0.5, ca: 0.2, fog: 62, density: 0.9, variety: 0.2, cirrus: 0.8, contrails: 0, sun: 0.5, starsMoon: 1.2, dream: 1 },
      'Film sinematik': { look: 'cinema', dof: 0.8, exposure: 0.5, hi: 0, sh: 0, sat: 1, temp: 6600, bloom: 0.15, vig: 0.3, ca: 0.25, fog: 20 },
      'Lembut & menenangkan': { look: 'soft', dof: 0.9, sat: 0.9, temp: 6000, bloom: 0.35, vig: 0.35, fog: 30, density: 0.6, cirrus: 0.7, contrails: 1 },
      'Alami': { look: 'natural', dof: 0.4, sat: 1, temp: 6600, bloom: 0, vig: 0.15, ca: 0, fog: 15, density: 0.5, cirrus: 0.4 },
      'Dingin segar': { look: 'cool', temp: 7600, fog: 15, density: 0.4, bloom: 0.1 },
      'Langit dramatis': { density: 0.9, variety: 1, cirrus: 0.8, contrails: 3, sun: 1.2, fog: 25, hi: -0.15, sh: 0.1 },
      'Senja emas': { time: 17.5, temp: 5200, bloom: 0.3, fog: 28, sun: 1.1 },
      'Malam tenang': { time: 23, starsMoon: 1.4, moon: 1.3, bloom: 0.25, fog: 22 },
    };
    const mine = () => { try { return JSON.parse(localStorage.getItem('office-presets') || '{}'); } catch { return {}; } };
    const applyPreset = (p) => { const { time, look, ...rest } = p; office.setVisual(rest); if (look) office.setLook(look); if (time != null) office.timeOfDay?.(time); };
    const draw = () => {
      const V = office.visual(), D0 = office.visualDefaults();
      const row = ([k, l, mn, mx, st, f]) => '<div class="vis-row"><div class="vis-l"><span>' + l + '</span><b data-val="' + k + '">' + f(V[k]) + '</b></div><input type="range" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + V[k] + '" data-k="' + k + '"></div>';
      const groups = tab === 'main'
        ? SCHEMA.main.map(([g, rows]) => '<div class="vis-g"><h4>' + g + '</h4>' + rows.map(row).join('') + '</div>').join('') + '<div class="vis-g"><h4>Gaya & bingkai</h4><div class="hp-row"><span><b>Gaya warna film</b></span><span>' + ['natural', 'cinema', 'soft', 'cool'].map((k) => '<button class="btn sm ' + (office.look() === k ? '' : 'ghost') + '" data-look="' + k + '">' + ({ natural: 'Alami', cinema: 'Film', soft: 'Lembut', cool: 'Dingin' })[k] + '</button>').join(' ') + '</span></div><div class="hp-row"><span><b>Bingkai layar lebar 2,39:1</b></span><button class="btn sm ' + (office.bars() ? '' : 'ghost') + '" data-bars>' + (office.bars() ? 'Nyala' : 'Mati') + '</button></div></div>'
        : SCHEMA[tab].map(([g, rows]) => '<div class="vis-g"><h4>' + g + '</h4>' + rows.map(row).join('') + '</div>').join('');
      const all = { ...PRESETS, ...mine() };
      el.innerHTML = '<div class="row" style="margin-bottom:8px"><b style="flex:1;font-size:14px">Pengaturan visual</b><button class="btn sm ghost" data-vc>✕</button></div>' +
        '<div class="row" style="gap:6px;margin-bottom:8px"><select class="input" data-vp style="flex:1"><option value="">Pilih preset…</option>' + Object.keys(all).map((n) => '<option>' + esc(n) + '</option>').join('') + '</select><button class="btn sm" data-vs title="Simpan pengaturan sekarang sebagai preset">💾</button></div>' +
        '<div class="tabs" style="margin-bottom:8px">' + [['main', 'Utama'], ['image', 'Gambar'], ['atmos', 'Atmosfer']].map(([k, l]) => '<button data-vt="' + k + '" class="' + (tab === k ? 'active' : '') + '">' + l + '</button>').join('') + '</div>' +
        '<div class="vis-body">' + groups + '</div><div class="row" style="margin-top:10px"><button class="btn sm ghost" data-vr>Reset tab ini</button></div>';
      el.querySelector('[data-vc]').onclick = () => (el.hidden = true);
      el.querySelectorAll('[data-vt]').forEach((b) => (b.onclick = () => { this.visTab = b.dataset.vt; this.visual(true); }));
      el.querySelectorAll('input[data-k]').forEach((inp) => (inp.oninput = () => { const k = inp.dataset.k, val = +inp.value; office.setVisual({ [k]: val }); const f = [].concat(...Object.values(SCHEMA).map((g) => (Array.isArray(g[0]) ? g.flatMap((x) => x[1]) : g))).find((r) => r[0] === k)?.[5]; const lab = el.querySelector('[data-val="' + k + '"]'); if (lab && f) lab.textContent = f(val); }));
      el.querySelectorAll('[data-look]').forEach((b) => (b.onclick = () => { office.setLook(b.dataset.look); draw(); }));
      el.querySelector('[data-bars]')?.addEventListener('click', () => { office.setBars(!office.bars()); draw(); });
      el.querySelector('[data-vp]').onchange = (ev) => { const p = all[ev.target.value]; if (p) { applyPreset(p); draw(); } };
      el.querySelector('[data-vs]').onclick = () => { const n = prompt('Nama preset:'); if (!n) return; const m = mine(); m[n] = office.visual(); try { localStorage.setItem('office-presets', JSON.stringify(m)); } catch { /* ignore */ } draw(); toast('💾 Preset "' + n + '" disimpan', 'ok'); };
      el.querySelector('[data-vr]').onclick = () => { const keys = tab === 'main' ? ['fov', 'dof', 'exposure'] : (SCHEMA[tab] || []).flatMap((g) => g[1].map((r) => r[0])); office.setVisual(Object.fromEntries(keys.map((k) => [k, D0[k]]))); draw(); };
    };
    draw();
  },
  help(show) {
    const el = this.ov?.querySelector('#ohelp'); if (!el) return;
    const on = show === undefined ? el.hidden : show; el.hidden = !on; if (!on) return;
    const k = (...ks) => ks.map((x) => `<span class="kbd">${x}</span>`).join('');
    const ka = office?.keyActions?.() || [], kn = (c) => String(c).replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Panah '), kk = (m, id, d) => kn((ka.find((a) => a.mode === m && a.id === id) || { key: d }).key);
    const rows = (title, list) => `<div class="hp-sec">${title}</div>` + list.map(([l, keys]) => `<div class="hp-row"><span>${l}</span><span>${keys}</span></div>`).join('');
    el.innerHTML = `<div class="row" style="margin-bottom:6px"><b style="flex:1">Bantuan [H]</b><button class="btn sm ghost" data-hx>✕</button></div>
      <div class="hp-tabs"><button class="on" data-hp="nav">Navigasi</button><button data-hp="play">Mode Karakter</button><button data-hp="keys">Atur Tombol</button><button data-hp="gfx">Grafis</button><button data-hp="snd">Suara</button></div>
      <div data-hpv="nav">${rows('Dasar', [['Geser (pan)', '🖱 kiri + drag / ' + k('W', 'A', 'S', 'D')], ['Tengok kiri / kanan', k(kk('free', 'Act:lookLeft', 'KeyZ'), kk('free', 'Act:lookRight', 'KeyC')) + ' (menoleh di tempat)'], ['Orbit', '🖱 kanan + drag'], ['Naik / Turun', k(kk('free', 'Act:up', 'KeyQ'), kk('free', 'Act:down', 'KeyE'))], ['Lebih cepat', 'tahan ' + k('Shift')], ['Zoom ke kursor', '🖱 scroll'], ['Mode jalan / terbang', k('Space')], ['Teleport', '🖱 klik ganda lantai'], ['Ikuti agen', '🖱 klik agen'], ['Agen berikutnya', k('Tab')]])}
        ${rows('Lanjutan', [['Keluar / tutup', k('Esc')], ['Gerak cepat', k('⇧')], ['Gerak sangat cepat', k('Alt')], ['Tampilan standar', k('8', '4', '5', '6', '2')], ['Posisi awal', k('0')], ['Waktu (pagi ↔ malam)', k('U') + ' / ' + k('I')], ['Sudut matahari', k('⇧') + '+' + k('U') + ' / ' + k('I')], ['Simpan tampilan favorit', k('B')], ['Favorit sebelumnya / berikutnya', k('PgUp', 'PgDn')], ['Label nama', k('L')]])}</div>
      <div data-hpv="keys" hidden></div>
      <div data-hpv="gfx" hidden></div>
      <div data-hpv="snd" hidden></div>
      <div data-hpv="play" hidden>${rows('Mode Karakter', [['Jalan', k('W', 'A', 'S', 'D')], ['Lari', k('⇧')], ['Putar', k('Q', 'R') + ' / drag'], ['Lompat', k('Space')], ['Lambai', k('G')], ['Panggil & bicara (agen menghampiri)', k('E')], ['Beri tugas', k('F')], ['Keluar', k('Esc')]])}
        <div class="small muted" style="margin-top:8px">Tekan <b>E</b> di dekat agen: dia akan berjalan ke depanmu, menatap, mendengarkan, lalu menjawab dengan ekspresi.</div></div>`;
    const kp = el.querySelector('[data-hpv="keys"]');
    const drawKeys = () => {
      if (!office?.keyActions) { kp.innerHTML = '<div class="small muted">Kantor belum siap.</div>'; return; }
      const acts = office.keyActions(), inv = office.lookInvert();
      const sec = (title, mode) => '<div class="hp-sec">' + title + '</div>' + acts.filter((a) => a.mode === mode).map((a) => '<div class="hp-row"><span>' + esc(a.label) + '</span><button class="btn sm ' + (a.key === a.def ? 'ghost' : '') + '" data-bind="' + mode + '|' + a.id + '">' + esc(kn(a.key)) + '</button></div>').join('');
      kp.innerHTML = '<div class="small muted" style="margin:4px 0 6px">Klik sebuah tombol lalu tekan tombol keyboard yang kamu mau (Esc membatalkan). Kalau tombolnya sudah dipakai fungsi lain, keduanya saling bertukar. Tersimpan otomatis di browser dan di server, jadi tetap ada setelah hard refresh.</div>' +
        sec('Kamera bebas', 'free') + '<div class="hp-row"><span>Balik arah tengok</span><button class="btn sm ' + (inv ? '' : 'ghost') + '" data-inv>' + (inv ? 'Aktif' : 'Mati') + '</button></div>' + sec('Mode karakter (PLAY)', 'play') +
        '<div style="margin:10px 0 2px"><button class="btn sm ghost" data-reset>Kembalikan semua ke standar</button></div>';
      kp.querySelectorAll('[data-bind]').forEach((b) => (b.onclick = () => {
        b.textContent = 'tekan tombol…';
        const on = (ev) => { ev.preventDefault(); ev.stopPropagation(); removeEventListener('keydown', on, true); if (ev.code !== 'Escape' && !office.setKey(...b.dataset.bind.split('|'), ev.code)) toast('Tombol itu tidak bisa dipakai', 'warn'); drawKeys(); };
        addEventListener('keydown', on, true);
      }));
      kp.querySelector('[data-inv]').onclick = () => { office.setLookInvert(!inv); drawKeys(); };
      kp.querySelector('[data-reset]').onclick = () => { office.resetKeys(); drawKeys(); };
    };
    drawKeys();
    const sp = el.querySelector('[data-hpv="snd"]');
    const drawSnd = () => {
      const st = sfx.state(), row = (k, l, d) => '<div class="hp-row"><span><b>' + l + '</b><br><small class="muted">' + d + '</small></span><button class="btn sm ' + (st[k] ? '' : 'ghost') + '" data-s="' + k + '">' + (st[k] ? 'Nyala' : 'Mati') + '</button></div>';
      sp.innerHTML = '<div class="small muted" style="margin:4px 0 8px">Musik latar yang menenangkan dibuat langsung di browser (tanpa file). Matikan kapan saja bila mengganggu. Tombol <b>M</b> menyalakan atau mematikan semuanya.</div>' +
        row('on', 'Semua suara', 'saklar utama') + row('music', 'Musik latar', 'pad lembut & lonceng pelan') + row('fx', 'Efek suara', 'lonceng tugas, air, langkah, dll') +
        '<div class="hp-row"><span><b>Volume</b></span><input type="range" min="0" max="100" value="' + Math.round(st.vol * 100) + '" data-sv style="width:140px"></div>';
      sp.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { sfx.set({ [b.dataset.s]: !sfx.state()[b.dataset.s] }); drawSnd(); const sb = document.querySelector('[data-cam="sound"]'); if (sb) sb.textContent = sfx.isOn() ? '🔊' : '🔇'; }));
      sp.querySelector('[data-sv]').oninput = (e) => sfx.set({ vol: e.target.value / 100 });
    };
    drawSnd();
    const gp = el.querySelector('[data-hpv="gfx"]');
    const drawGfx = () => {
      if (!office?.gfx) return; const m = office.gfx(), st = office.gfxStats();
      const opt = [['auto', 'Otomatis', 'menyesuaikan sendiri'], ['eco', 'Hemat', '30 fps, tanpa bayangan, paling ringan'], ['high', 'Tinggi', 'bloom, warna sinematik, blur kedalaman']];
      gp.innerHTML = '<div class="small muted" style="margin:4px 0 8px">Pilih beban grafis. Kantor selalu otomatis menurunkan resolusi bila terasa berat, menyembunyikan kota yang jauh, dan menggambar agen jauh sebagai titik.</div>' +
        opt.map(([k, l, d]) => '<div class="hp-row"><span><b>' + l + '</b><br><small class="muted">' + d + '</small></span><button class="btn sm ' + (m === k ? '' : 'ghost') + '" data-g="' + k + '">' + (m === k ? 'Aktif' : 'Pilih') + '</button></div>').join('') +
        '<div class="hp-row"><span><b>Gaya warna film</b><br><small class="muted">' + ({ natural: 'Alami', cinema: 'Sinematik: bayangan sejuk, cahaya hangat, glow lembut', soft: 'Lembut & menenangkan', cool: 'Dingin segar' })[office.look?.() || 'cinema'] + '</small></span><span>' + ['natural', 'cinema', 'soft', 'cool'].map((k) => '<button class="btn sm ' + ((office.look?.() || 'cinema') === k ? '' : 'ghost') + '" data-look="' + k + '">' + ({ natural: 'Alami', cinema: 'Film', soft: 'Lembut', cool: 'Dingin' })[k] + '</button>').join(' ') + '</span></div>' +
        '<div class="hp-row"><span><b>Bingkai layar lebar</b><br><small class="muted">garis hitam atas-bawah 2,39:1 seperti film</small></span><button class="btn sm ' + (office.bars?.() ? '' : 'ghost') + '" data-bars>' + (office.bars?.() ? 'Nyala' : 'Mati') + '</button></div>' +
        '<div class="hp-row"><span><b>Fokus lensa (blur latar)</b><br><small class="muted">0 = tajam semua · lebih tinggi = latar & foreground makin kabur</small></span><input type="range" min="0" max="200" value="' + Math.round((office.dof?.() ?? 1.3) * 100) + '" data-dof style="width:120px"></div>' +
        '<div class="hp-row"><span><b>Sudut pandang (FOV)</b><br><small class="muted">kecil = lensa tele sinematik · besar = lebar</small></span><input type="range" min="22" max="75" value="' + Math.round(office.fov?.() ?? 45) + '" data-fov style="width:120px"></div>' +
        '<div class="small muted mono" style="margin-top:8px" data-gs>' + st.fps + ' fps · resolusi ' + Math.round(st.res * 100) + '% · ' + st.calls + ' draw · ' + Math.round(st.tris / 1000) + 'k segitiga</div>';
      gp.querySelectorAll('[data-look]').forEach((b) => (b.onclick = () => { office.setLook(b.dataset.look); drawGfx(); }));
      gp.querySelector('[data-bars]').onclick = () => { office.setBars(!office.bars()); drawGfx(); };
      gp.querySelector('[data-dof]').oninput = (ev) => office.setDof(ev.target.value / 100);
      gp.querySelector('[data-fov]').oninput = (ev) => office.setFov(+ev.target.value);
      gp.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { office.setGfx(b.dataset.g); drawGfx(); }));
    };
    drawGfx(); clearInterval(this.gfxT); this.gfxT = setInterval(() => { if (el.hidden || gp.hidden) return; const st = office?.gfxStats?.(), e2 = gp.querySelector('[data-gs]'); if (st && e2) e2.textContent = st.fps + ' fps · resolusi ' + Math.round(st.res * 100) + '% · ' + st.calls + ' draw · ' + Math.round(st.tris / 1000) + 'k segitiga'; }, 1000);
    el.querySelector('[data-hx]').onclick = () => (el.hidden = true);
    el.querySelectorAll('[data-hp]').forEach((b) => (b.onclick = () => { el.querySelectorAll('[data-hp]').forEach((x) => x.classList.toggle('on', x === b)); el.querySelectorAll('[data-hpv]').forEach((v) => (v.hidden = v.dataset.hpv !== b.dataset.hp)); }));
  },
  clock(t, ph, auto, h) {
    const el = this.ov?.querySelector('#oclock'); if (!el) return;
    el.querySelector('[data-cph]').textContent = ph; el.querySelector('[data-ctm]').textContent = t; el.querySelector('[data-cmd]').textContent = auto ? 'otomatis' : 'manual';
    const r = el.querySelector('[data-cr]'); if (r && document.activeElement !== r) r.value = h;
  },
  bindClock() {
    const el = this.ov?.querySelector('#oclock'); if (!el || el.dataset.bound) return; el.dataset.bound = '1';
    const pop = el.querySelector('.tod-pop');
    el.querySelector('[data-clock]').onclick = () => (pop.hidden = !pop.hidden);
    el.querySelector('[data-cr]').oninput = (e) => { office.setAutoDay(false); office.timeOfDay(+e.target.value); };
    el.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { office.setAutoDay(false); office.timeOfDay(+b.dataset.ch); }));
    el.querySelector('[data-cauto]').onclick = () => office.setAutoDay(true);
  },
  chip(text) {
    const el = this.ov?.querySelector('#ochip'); if (!el) return;
    el.textContent = text; el.hidden = false; clearTimeout(this.chipT); this.chipT = setTimeout(() => (el.hidden = true), 1600);
  },
  /** Choose the player's character: female/male, hair style, skin tone, hair colour, glasses. */
  characterPicker() {
    const me = emp(S.me); if (!me) return;
    const ap0 = resolveAppearance(me, div(me.divisionId)?.color || '#888888');
    let latest = ap0;
    modal('👤 Karakter saya', `<div id="pickbox"></div><div class="small muted" style="margin-top:8px">Perubahan langsung terlihat di kantor 3D.</div>`, {
      onMount: (el) => {
        const box = el.querySelector('#pickbox');
        // live preview: the character in the 3D office updates as you change the look
        bindAppearance(box, ap0, (ap) => { latest = ap; });
      },
      actions: [{ label: 'Batal' }, { label: 'Simpan karakter', kind: 'primary', run: async () => { await api('PATCH', `/api/employees/${S.me}`, { appearance: latest }); toast('✨ Karakter diperbarui', 'ok'); } }],
    });
  },
  unmount(root) { this.closeAllApps?.(); if (office?.isPlayer()) office.exitPlayer(); clearInterval(this.roomTimer); clearInterval(this.followTimer); office?.stopChase?.(); office?.setVisible(false); officeRoot?.remove(); this.ov?.remove(); this.ov = null; this.roomsHtml = ''; root.style.overflow = ''; },
};

// ═════════════════════ DASHBOARD ═════════════════════
export const DashboardView = {
  mount(root) {
    root.innerHTML = `<div class="page">
      <div class="hero"><div><div class="hero-k">${esc(D().company.name)}</div><h2>Halo, ${esc(me().name.split(' ')[0])} 👋</h2><div class="hero-s" id="dhs"></div></div><div class="hero-a"><button class="btn primary" id="hgo">▶ Masuk Kantor 3D</button><button class="btn" id="hgoal">🎯 Goal baru</button></div></div>
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
    root.querySelector('#hgo').onclick = () => navigate('office');
    root.querySelector('#hgoal').onclick = () => root.querySelector('#gt').focus();
    bindCommon(root);
    this.root = root; this.update();
  },
  update() {
    const r = this.root; const k = kpis(); const d = D();
    { const ai = d.employees.filter((e) => e.type === 'ai'); const busy = ai.filter((e) => e.status === 'working' || e.status === 'meeting').length; const open = d.tasks.filter((t) => t.status !== 'done').length; const hs = r.querySelector('#dhs'); if (hs) hs.innerHTML = `<span class="dot ok"></span>${ai.length} agen AI · <b>${busy}</b> sedang bekerja · <b>${open}</b> tugas berjalan · ${d.divisions.length} divisi`; }
    r.querySelector('#dk').innerHTML = [
      ['Karyawan AI', k.ai, `${k.humans} manusia`], ['Sedang aktif', k.working, 'bekerja / rapat'], ['Tugas aktif', k.active, `${d.tasks.filter((t) => t.status === 'in_progress').length} dikerjakan`],
      ['Selesai hari ini', k.doneToday, `${d.tasks.filter((t) => t.status === 'done').length} total`], ['Approval', k.approvals, 'butuh keputusan manusia'],
      ['Biaya AI hari ini', usd(k.cost), `budget ${usd(d.settings.dailyBudgetUSD)} · ${num(d.usage.tokensIn + d.usage.tokensOut)} token`],
    ].map(([l, v, s]) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const goals = d.tasks.filter((t) => t.kind === 'goal' && !/^\s*(\/|saya selesai\s*$)/i.test(t.title)).slice(-4).reverse();
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
/** the quest contract of a task: what "done" means, who asked, when it is due, and the evidence the agent handed in */
function contractBlock(t) {
  if (!t) return '';
  const late = t.dueAt && t.dueAt < Date.now() && !['done', 'cancelled'].includes(t.status);
  const ev = t.evidence || [];
  return `<div class="sec"><h4>Kontrak</h4><div class="small" style="display:grid;gap:5px">
    ${t.expected ? `<div><b>Hasil yang diharapkan:</b> ${esc(t.expected)}</div>` : ''}
    <div class="muted">Diminta ${esc(emp(t.createdBy)?.name || t.createdBy)} · dikerjakan ${esc(emp(t.assigneeId)?.name || '?')}${t.dueAt ? ` · tenggat ${new Date(t.dueAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}${t.stage ? ` · tahap ${t.stage}` : ''}${late ? ' · <b style="color:var(--warn)">⏰ lewat tenggat</b>' : ''}</div>
    ${t.status === 'done' || t.status === 'review' || ev.length ? `<div><b>Bukti:</b> ${ev.length ? ev.map((x) => `<span class="chip" style="${x.ok ? 'color:var(--ok)' : 'opacity:.7'}" title="${x.ok ? 'terverifikasi' : 'tidak bisa dicek'}">${x.ok ? '✓' : '?'} ${esc(x.text.slice(0, 60))}</span>`).join(' ') : '<span class="muted">tidak ada</span>'}${t.unverified ? ' <b style="color:var(--warn)">⚠️ belum ada bukti yang bisa dicek, perlakukan sebagai asumsi</b>' : ''}</div>` : ''}
    ${t.gaps ? `<div><b>Belum terpenuhi:</b> ${esc(t.gaps)}</div>` : ''}
  </div></div>`;
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
      ${lanes.map(([d, l]) => { const rows = []; for (const t of l.sort((a, b) => a.createdAt - b.createdAt)) { const s = x(t.createdAt), e2 = x(t.completedAt || Math.max(now, t.dueAt || now)); let r = rows.findIndex((end) => end < s - 0.5); if (r < 0) { if (rows.length < 8) { rows.push(0); r = rows.length - 1; } else { r = rows.indexOf(Math.min(...rows)); } } rows[r] = e2; t._row = r; t._s = s; t._e = e2; }
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
        ${contractBlock(t)}
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
    const groups = d.channels.filter((c) => c.kind === 'group' && c.members.includes(S.me)).sort((a, b) => (last(b.id)?.t || 0) - (last(a.id)?.t || 0)).slice(0, 15);   /* goal threads + group discussions from the dock */
    const listKey = [this.ch, ...groups.map((c) => c.id + (last(c.id)?.id || '')), ...d.channels.filter((c) => c.kind === 'channel').map((c) => c.id), ...sortedDMs.map((c) => c.id), ...agentDMs.map((c) => c.id), ...meetings.map((c) => c.id + (d.meetings?.find((m) => m.id === c.meetingId)?.status || ''))].join('|');
    if (listChanged && listKey !== this.listKey) { this.listKey = listKey; r.querySelector('#cl').innerHTML = `<button class="btn sm" id="newdm" style="width:100%">＋ Chat dengan karyawan</button>
      <h4>Channel</h4>${d.channels.filter((c) => c.kind === 'channel').map((c) => `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}"><span>#</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span></div>`).join('')}
      <h4>Pesan langsung</h4>${sortedDMs.map((c) => { const o = emp(c.members.find((m) => m !== S.me)); return `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}">${avatar(o)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o?.name)}</span></div>`; }).join('') || '<div class="small faint" style="padding:0 9px">Belum ada</div>'}
      <h4>Goal & diskusi grup</h4>${groups.map((c) => `<div class="ch-item ${c.id === this.ch ? 'active' : ''}" data-ch="${c.id}" title="${esc(c.members.map((m) => emp(m)?.name || m).join(', '))}"><span>${c.goalId ? '🎯' : '💬'}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="small">${esc(String(c.name).replace(/^🎯s*|^Diskusi:s*/, ''))}</span></div>`).join('') || '<div class="small faint" style="padding:0 9px">Belum ada</div>'}
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
        <div class="small muted">${(D().groqModels || []).length} model chat aktif untuk akun Groq ini. Daftar disinkronkan otomatis; model audio, TTS, dan guard tidak ditampilkan karena tidak dapat menjalankan agen chat.</div>
        <div class="grid2"><label class="f">Claude · model Head/Lead<select class="input" name="model">${(D().claudeModels || []).map((m) => opt(m, m, s.model)).join('')}</select></label>
          <label class="f">Claude · model staf<select class="input" name="workerModel">${(D().claudeModels || []).map((m) => opt(m, m, s.workerModel)).join('')}</select></label></div>
        <div class="grid2"><label class="f">Agen live paralel (maks)<input class="input" type="number" min="1" max="20" name="maxConcurrent" value="${s.maxConcurrent}"></label>
          <label class="f">Budget harian (USD)<input class="input" type="number" min="0" step="0.5" name="dailyBudgetUSD" value="${s.dailyBudgetUSD}"></label></div>
        <div class="row small muted">Hari ini: ${usd(u.costToday)} · total ${usd(u.costTotal)} · ${num(u.tokensIn)} in / ${num(u.tokensOut)} out · ${u.calls} panggilan</div>
        <div class="row"><button class="btn primary" id="saveai">Simpan</button><button class="btn" id="testkey">🔌 Tes koneksi</button><button class="btn" id="refreshgroq">↻ Verifikasi semua model Groq</button></div>
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
    $('#refreshgroq').onclick = async () => { $('#refreshgroq').disabled = true; try { const r = await api('POST', '/api/groq-models/refresh'); const extra = r.unavailable.length ? ` · ${r.unavailable.length} diblokir organisasi` : ''; toast(`✅ ${r.models.length} model chat Groq dapat dipakai${extra}`, 'ok'); setTimeout(() => this.mount(root), 150); } finally { $('#refreshgroq').disabled = false; } };
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
    // four plain tabs instead of one long form; the choice is remembered
    { const page = root.querySelector('.page.settings'); const cards = [...page.querySelectorAll(':scope > .card')];
      const TABS = [['umum', 'Umum', /PERUSAHAAN|TAMPILAN/i], ['ai', 'AI', /MESIN AI|OTONOMI|PEMBELAJARAN/i], ['integrasi', 'Integrasi', /GOOGLE|MCP/i], ['data', 'Data', /DATA/i]];
      const of = (c) => { const h = (c.querySelector('.card-h')?.textContent || '').trim(); return (TABS.find((t) => t[2].test(h)) || TABS[3])[0]; };
      cards.forEach((c) => (c.dataset.stab = of(c)));
      const bar = document.createElement('div'); bar.className = 'stabs';
      bar.innerHTML = TABS.map(([id, label]) => `<button data-st="${id}">${label}</button>`).join('');
      page.insertBefore(bar, cards[0]);
      let cur = 'umum'; try { cur = localStorage.getItem('settings-tab') || 'umum'; } catch { /* storage unavailable */ }
      const show = (id) => { cur = TABS.some((t) => t[0] === id) ? id : 'umum'; cards.forEach((c) => (c.hidden = c.dataset.stab !== cur)); bar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.st === cur)); try { localStorage.setItem('settings-tab', cur); } catch { /* ignore */ } };
      bar.querySelectorAll('button').forEach((b) => (b.onclick = () => show(b.dataset.st)));
      show(cur);
      // AI tab: the three things an owner decides up front; everything else folds under "Lanjutan"
      const ai = cards.find((c) => /MESIN AI/i.test(c.querySelector('.card-h')?.textContent || ''));
      if (ai) {
        const b = ai.querySelector('.card-b'); const f = (n) => b.querySelector(`[name="${n}"]`)?.closest('label');
        const L = Object.fromEntries(['provider', 'effort', 'groqApiKey', 'apiKey', 'groqModel', 'groqWorkerModel', 'model', 'workerModel', 'maxConcurrent', 'dailyBudgetUSD'].map((n) => [n, f(n)]));
        const name = (el, t) => { if (el?.firstChild?.nodeType === 3) el.firstChild.nodeValue = t + ' '; };
        name(L.provider, 'Otak AI'); name(L.dailyBudgetUSD, 'Batas biaya per hari (USD)'); name(L.groqApiKey, 'Kunci Groq'); name(L.apiKey, 'Kunci Claude (opsional)');
        name(L.effort, 'Kedalaman berpikir'); name(L.maxConcurrent, 'Agen yang bekerja bersamaan'); name(L.groqModel, 'Groq · model kepala divisi'); name(L.groqWorkerModel, 'Groq · model staf'); name(L.model, 'Claude · model kepala divisi'); name(L.workerModel, 'Claude · model staf');
        L.effort?.querySelectorAll('option').forEach((o) => (o.textContent = { low: 'Hemat & cepat', medium: 'Sedang', high: 'Mendalam (lebih mahal)' }[o.value] || o.value));
        const intro = b.querySelector('p.small.muted'); if (intro) intro.textContent = 'Pilih otak untuk karyawan AI dan batas biayanya per hari.';
        const note = [...b.children].find((x) => x.matches('div.small.muted') && !x.classList.contains('row'));
        const grid = (...els) => { const d = document.createElement('div'); d.className = 'grid2'; d.append(...els.filter(Boolean)); return d; };
        const adv = document.createElement('details'); adv.className = 'adv';
        adv.innerHTML = '<summary>Lanjutan: model, kedalaman berpikir, kunci Claude</summary><div class="adv-b"></div>';
        const basic = grid(L.provider, L.dailyBudgetUSD);
        adv.lastElementChild.append(grid(L.effort, L.maxConcurrent), grid(L.groqModel, L.groqWorkerModel), grid(L.model, L.workerModel), ...[L.apiKey, note, b.querySelector('#refreshgroq')].filter(Boolean));
        intro ? intro.after(basic) : b.prepend(basic); if (L.groqApiKey) basic.after(L.groqApiKey);
        const usage = b.querySelector('.row.small.muted'); usage ? usage.before(adv) : b.append(adv);
        [...b.querySelectorAll(':scope > .grid2')].forEach((x) => { if (!x.children.length) x.remove(); });
      }
      const tick = page.querySelector('#tick')?.closest('label');
      if (tick) { const d = document.createElement('details'); d.className = 'adv'; d.innerHTML = '<summary>Lanjutan: kecepatan siklus</summary><div class="adv-b"></div>'; tick.before(d); d.lastElementChild.append(tick); } }
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
  knowledge: { title: 'Ruang Pengetahuan', icon: '🏛️', view: KnowledgeView },
  approvals: { title: 'Persetujuan', icon: '🛑', view: ApprovalsView },
  settings: { title: 'Pengaturan', icon: '⚙️', view: SettingsView },
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && OfficeView.wins?.size && !/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) { const top = [...OfficeView.wins.values()].sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0))[0]; if (top && !document.querySelector('.modal:not([hidden]), .drawer.open')) OfficeView.closeApp(top.id); } });
export { drawerKey };
