// Browser Agen: sederhana untuk orang awam. Agen membuka browser sendiri bila perlu; di sini Owner melihat, menjeda, atau menghentikannya.
// Pengaturan teknis ada di bagian "Lanjutan" yang terlipat.
import { S, api, esc, toast } from './core.js';
import { icon } from './icons.js';

const STATUS_LABEL = { ok: 'Selesai', ditolak: 'Ditolak', ditahan: 'Menunggu Anda', error: 'Gagal' };

export const BrowserView = {
  st: null, frameAt: 0, timer: 0, busy: false, gone: false,
  mount(root) {
    this.root = root; root.style.overflow = 'auto';
    root.innerHTML = '<div class="page" style="max-width:900px"><div class="page-head"><div><h2 style="margin:0">Browser Agen</h2><p class="muted small" style="margin:4px 0 0">Agen membuka situs web sendiri bila tugasnya memang butuh. Anda tidak perlu mengatur apa pun.</p></div></div><div id="bw-body" class="muted">Memuat…</div></div>';
    this.vis = () => { if (!document.hidden) this.tick(true); };
    document.addEventListener('visibilitychange', this.vis);
    this.tick(true);
  },
  unmount() { clearTimeout(this.timer); this.timer = 0; this.gone = true; document.removeEventListener('visibilitychange', this.vis); },
  /** Polling hemat: berhenti total saat tab aplikasi tersembunyi; 3 dtk saat agen menjelajah, 8 dtk saat siaga; tidak pernah menumpuk permintaan. */
  async tick(now) {
    clearTimeout(this.timer); this.timer = 0; this.gone = false;
    if (document.hidden) return;
    if (now) await this.refresh();
    if (this.gone || document.hidden) return;
    this.timer = setTimeout(async () => { await this.refresh(); this.tick(false); }, this.st?.session ? 3000 : 8000);
  },
  update(colls) { if (colls.has('approvals') || colls.has('*')) this.refresh(); },
  async refresh() {
    if (this.busy || document.hidden) return; this.busy = true;
    try {
      const st = await fetch('/api/browser').then((r) => r.json());
      if (!st.config) throw new Error(st.error || 'tidak ada data');
      this.st = st;
      if (!this.root?.querySelector('#bw-main')) this.render(); else this.paint();
      if (this.active() && st.frameAt && st.frameAt !== this.frameAt) { const f = await fetch('/api/browser/frame').then((r) => r.json()); this.frameAt = f.at; this.drawFrame(f); }   // gambar hanya diambil saat agen sedang menjelajah
    } catch (err) { const b = this.root?.querySelector('#bw-body'); if (b && !this.st) b.innerHTML = `<div class="empty">Belum bisa memuat halaman ini: ${esc(err.message)}</div>`; }
    finally { this.busy = false; }
  },
  /** tampilan hanya saat agen menjelajah, atau sekilas setelah Anda membuka situs sendiri */
  active() { const st = this.st; return !!st.session || (st.running && st.frameAt && Date.now() - st.frameAt < 90000); },
  drawFrame(f) { const img = this.root?.querySelector('#bw-img'); if (img && f.dataUrl) img.src = f.dataUrl; },
  /** Bahasa manusia untuk keadaan sekarang */
  human() {
    const st = this.st, s = st.session, who = s?.agentName || 'Agen';
    if (!st.installed) return { text: 'Browser belum dipasang di komputer ini.', tone: '' };
    if (!st.config.enabled) return { text: 'Agen sedang tidak diizinkan memakai browser.', tone: '' };
    if (s?.stopped) return { text: 'Sesi dihentikan.', tone: '' };
    if (s?.paused) return { text: 'Dijeda. Anda yang mengendalikan.', tone: 'gold' };
    if (s?.waiting) return { text: `${who} menunggu persetujuan Anda.`, tone: 'gold' };
    if (s) return { text: `${who} sedang membuka situs…`, tone: 'ok' };
    return { text: 'Siap. Agen akan membuka browser sendiri bila perlu.', tone: '' };
  },
  render() {
    const st = this.st, body = this.root.querySelector('#bw-body'); body.className = '';
    body.innerHTML = `<div id="bw-approvals" style="display:grid;gap:8px"></div>
      <div id="bw-main" class="card" style="padding:14px;display:grid;gap:12px">
        <div class="row" style="gap:8px"><span class="pill" id="bw-state" style="white-space:normal"></span></div>
        <div id="bw-info" class="small muted"></div>
        <div id="bw-live" style="display:none;gap:10px">
          <div id="bw-url" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px"></div>
          <div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--gl-fill-2);aspect-ratio:16/10;max-height:50vh;width:100%;display:grid;place-items:center"><img id="bw-img" alt="Tampilan situs yang sedang dibuka agen" style="width:100%;height:100%;object-fit:contain;display:block"></div>
          <div class="row wrap" id="bw-ctl" style="gap:8px"></div>
          <div id="bw-manual" class="row wrap" style="gap:8px;display:none"></div>
        </div>
      </div>
      <div class="card" style="padding:14px"><b>Yang baru dilakukan agen</b><div id="bw-trace" class="small" style="display:grid;gap:6px;margin-top:8px"></div></div>
      <details class="card" style="padding:14px"><summary style="cursor:pointer;font-weight:550">Lanjutan</summary><div id="bw-adv" style="display:grid;gap:14px;margin-top:12px"></div></details>`;
    this.paint(true);
  },
  paint(force) {
    const st = this.st, c = st.config, s = st.session, q = (x) => this.root.querySelector(x);
    if (!q('#bw-main')) return;
    const h = this.human();
    q('#bw-state').innerHTML = `<span class="dot ${h.tone === 'ok' ? 'on' : ''}"></span> ${esc(h.text)}`;
    q('#bw-info').innerHTML = !st.installed ? 'Minta admin menjalankan <code>npm run browser:install</code> satu kali, lalu muat ulang halaman ini.' : s ? `${s.taskTitle ? `Tugas: <b>${esc(s.taskTitle)}</b>` : ''}${s.reason ? `<br>Alasan membuka browser: ${esc(s.reason)}` : ''}` : '';
    // persetujuan
    q('#bw-approvals').innerHTML = st.approvals.map((a) => `<div class="card" style="padding:14px;display:grid;gap:8px;border-color:var(--gold,#c9a24a)"><div class="row" style="gap:8px">${icon('alert', 16)}<b style="flex:1;min-width:0">Agen minta izin Anda</b></div><div>${esc(a.title.replace(/^Aksi browser:\s*/, ''))}</div><div class="small muted">${esc(a.summary)}</div><div class="row" style="gap:8px"><button class="btn primary" data-ap="approve" data-id="${a.id}">Setujui</button><button class="btn" data-ap="reject" data-id="${a.id}">Tolak</button></div></div>`).join('');
    q('#bw-approvals').querySelectorAll('[data-ap]').forEach((b) => (b.onclick = async () => { b.disabled = true; await api('POST', `/api/approvals/${b.dataset.id}`, { decision: b.dataset.ap }).catch(() => {}); this.refresh(); }));
    // tampilan langsung: hanya saat agen benar-benar menjelajah (atau Anda mengambil alih)
    const live = q('#bw-live'), show = this.active(); live.style.display = show ? 'grid' : 'none';
    q('#bw-url').textContent = s?.url || 'Situs yang Anda buka';
    const ctl = q('#bw-ctl');
    ctl.innerHTML = s ? `${s.paused ? `<button class="btn primary" data-op="resume">${icon('play', 16)} Lanjutkan</button>` : `<button class="btn" data-op="pause">${icon('pause', 16)} Jeda</button>`}<button class="btn" data-op="stop">${icon('close', 16)} Hentikan</button>` : `<button class="btn" data-op="stop">${icon('close', 16)} Tutup browser</button>`;
    ctl.querySelectorAll('[data-op]').forEach((b) => (b.onclick = () => this.op(b.dataset.op, {}, b)));
    // ambil alih: hanya muncul saat dijeda
    const man = q('#bw-manual'), takeover = !!s?.paused;
    man.style.display = takeover ? 'flex' : 'none';
    if (takeover && !man.dataset.ready) { man.dataset.ready = '1'; man.innerHTML = this.manualHtml(); this.bindManual(man); }
    if (!takeover) { man.dataset.ready = ''; }
    const img = q('#bw-img'); if (img) { img.style.cursor = takeover ? 'crosshair' : 'default'; img.onclick = takeover ? (e) => this.clickImg(e, img) : null; }
    // riwayat dalam bahasa manusia
    const rows = st.trace.filter((t) => !['sesi', 'kendali', 'sistem'].includes(t.tool) || t.tool === 'kendali').slice(0, 8);
    q('#bw-trace').innerHTML = rows.length ? rows.map((t) => `<div class="row" style="gap:8px;align-items:flex-start"><span class="chip" style="flex:none">${esc(STATUS_LABEL[t.status] || t.status)}</span><span style="flex:1;min-width:0;overflow-wrap:anywhere">${t.agentName ? `<b>${esc(t.agentName)}</b> ` : ''}${esc(this.plain(t.summary))}</span><span class="faint" style="flex:none">${new Date(t.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<span class="muted">Belum ada. Beri tugas riset atau uji situs ke agen, dan jejaknya muncul di sini.</span>';
    if (force || !q('#bw-adv').dataset.ready) { q('#bw-adv').dataset.ready = '1'; this.advanced(q('#bw-adv')); }
  },
  /** hilangkan istilah teknis dari kalimat jejak */
  plain(t) { return String(t || '').replace(/\buid\b/gi, 'elemen').replace(/\btool\b/gi, 'alat').replace(/\bMCP\b/g, 'browser').replace(/\bheadless\b/gi, 'tanpa jendela'); },
  manualHtml() {
    return `<div class="small muted" style="flex:1 1 100%">Anda sedang mengendalikan browser. Klik langsung pada gambar untuk menekan sesuatu di situs.</div>
      <div class="row" style="gap:6px;flex:1 1 100%"><input class="input" id="bw-go" placeholder="Alamat situs, mis. contoh.com" style="flex:1;min-width:0" aria-label="Alamat situs"><button class="btn primary" id="bw-gob">Buka</button></div>
      <div class="row" style="gap:6px;flex:1 1 100%"><input class="input" id="bw-type" placeholder="Ketik teks ke kolom yang dipilih" style="flex:1;min-width:0" aria-label="Teks untuk diketik"><button class="btn" id="bw-typeb">Ketik</button></div>
      <div class="row" style="gap:6px"><button class="btn ghost" id="bw-back">${icon('arrow', 16).replace('class="i', 'style="transform:scaleX(-1)" class="i')} Kembali</button><button class="btn ghost" id="bw-rl">${icon('repeat', 16)} Muat ulang</button></div>
      <div class="small muted" style="flex:1 1 100%">Yang Anda ketik di sini tidak dikirim ke AI.</div>`;
  },
  bindManual(man) {
    const q = (x) => man.querySelector(x);
    const go = () => { const v = q('#bw-go').value.trim(); if (v) this.op('goto', { url: /^[a-z]+:/i.test(v) ? v : 'https://' + v }, q('#bw-gob')); };
    q('#bw-gob').onclick = go; q('#bw-go').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    q('#bw-back').onclick = () => this.op('back', {}); q('#bw-rl').onclick = () => this.op('reload', {});
    const typeIt = () => { const v = q('#bw-type').value; if (v) { this.op('type', { text: v, enter: true }, q('#bw-typeb')); q('#bw-type').value = ''; } };
    q('#bw-typeb').onclick = typeIt; q('#bw-type').onkeydown = (e) => { if (e.key === 'Enter') typeIt(); };
  },
  clickImg(e, img) {
    const r = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight; if (!nw) return;
    const sc = Math.min(r.width / nw, r.height / nh), ox = (r.width - nw * sc) / 2, oy = (r.height - nh * sc) / 2;
    const fx = (e.clientX - r.left - ox) / (nw * sc), fy = (e.clientY - r.top - oy) / (nh * sc);
    if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) this.op('click', { fx, fy });
  },
  /** Semua pengaturan teknis ada di sini, dengan bahasa awam */
  advanced(el) {
    const st = this.st, c = st.config;
    const num = (k, label, hint) => `<label class="f small" style="display:grid;gap:4px"><span><b>${label}</b> <span class="muted">${hint}</span></span><input class="input" type="number" data-k="${k}" value="${c[k]}" style="max-width:140px"></label>`;
    el.innerHTML = `<label class="switch-row"><input type="checkbox" data-k="enabled" ${c.enabled ? 'checked' : ''}> Izinkan agen memakai browser (disarankan tetap menyala; browser hanya menyala saat dibutuhkan dan mati sendiri)</label>
      <div><b class="small">Divisi yang boleh memakainya</b><div class="row wrap" style="gap:6px;margin-top:6px">${st.divisions.map((d) => `<label class="chip" style="cursor:pointer;gap:6px"><input type="checkbox" data-div="${d.id}" ${c.allowDivisions.includes(d.id) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}</div></div>
      <label class="switch-row"><input type="checkbox" data-k="lightMode" ${c.lightMode ? 'checked' : ''}> Hemat tenaga komputer: tanpa gambar dan video (disarankan)</label>
      <div class="row wrap" style="gap:12px">${num('maxPages', 'Jumlah jendela', 'maksimal per tugas')}${num('maxActionsPerTask', 'Jumlah langkah', 'maksimal per tugas')}${num('maxSecondsPerTask', 'Lama', 'detik maksimal per tugas')}${num('idleCloseSec', 'Tutup otomatis', 'detik setelah tidak dipakai')}</div>
      <label class="f small" style="display:grid;gap:4px"><span><b>Hanya boleh membuka situs ini</b> <span class="muted">(opsional, satu per baris; kosong = semua situs umum)</span></span><textarea class="input" data-k="allowDomains" rows="3" placeholder="contoh.com">${esc(c.allowDomains.join('\n'))}</textarea></label>
      <label class="f small" style="display:grid;gap:4px"><span><b>Situs yang dilarang</b> <span class="muted">(satu per baris)</span></span><textarea class="input" data-k="denyDomains" rows="3">${esc(c.denyDomains.join('\n'))}</textarea></label>
      <label class="switch-row"><input type="checkbox" data-k="allowScript" ${c.allowScript ? 'checked' : ''}> Izinkan menjalankan kode di halaman (berisiko, biarkan mati kecuali perlu)</label>
      <div class="small muted">Selalu berlaku: tidak membuka alamat internal, tidak mengisi kata sandi atau data kartu, dan aksi seperti kirim, bayar, atau hapus selalu menunggu persetujuan Anda. Hari ini: ${st.today} langkah.</div>
      <div class="row wrap" style="gap:8px"><button class="btn primary" id="bw-save">Simpan</button>${st.running ? `<button class="btn" id="bw-off">Tutup browser sekarang</button>` : ''}</div>
      ${c.enabled && !st.session ? `<details><summary class="small" style="cursor:pointer">Coba buka situs sendiri</summary><div id="bw-own" class="row wrap" style="gap:6px;margin-top:8px"><input class="input" id="bw-owngo" placeholder="Alamat situs, mis. contoh.com" style="flex:1;min-width:0" aria-label="Alamat situs"><button class="btn" id="bw-owngob">Buka</button></div><div class="small muted" style="margin-top:6px">Gambar situs muncul sekilas setelah dibuka. Browser mati sendiri bila dibiarkan.</div></details>` : ''}`;
    el.querySelector('#bw-save').onclick = async () => {
      const body = { allowDivisions: [...el.querySelectorAll('[data-div]')].filter((x) => x.checked).map((x) => x.dataset.div) };
      el.querySelectorAll('[data-k]').forEach((x) => { body[x.dataset.k] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Number(x.value) : x.value; });
      try { await api('PATCH', '/api/browser/config', body); toast('Tersimpan', 'ok'); el.dataset.ready = ''; this.refresh(); } catch { /* api() sudah menampilkan galat */ }
    };
    el.querySelector('#bw-off')?.addEventListener('click', () => this.op('stop', {}));
    const own = () => { const v = el.querySelector('#bw-owngo').value.trim(); if (v) this.op('goto', { url: /^[a-z]+:/i.test(v) ? v : 'https://' + v }, el.querySelector('#bw-owngob')); };
    el.querySelector('#bw-owngob')?.addEventListener('click', own);
    el.querySelector('#bw-owngo')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') own(); });
  },
  async op(op, body, btn) {
    if (btn) btn.disabled = true;
    try { this.st = await api('POST', `/api/browser/${op}`, body); this.frameAt = 0; this.paint(); if (op === 'stop') toast('Dihentikan', 'ok'); }
    catch { /* api() menampilkan galat */ }
    finally { if (btn) btn.disabled = false; this.refresh(); }
  },
};
