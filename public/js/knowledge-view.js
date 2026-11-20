// Ruang Pengetahuan: knowledge spaces per division, library assignment, agent training, and dataset building.
import { S, api, esc, emp, avatar, toast, modal, navigate, formData } from './core.js';

const D = () => S.data;

export const KnowledgeView = {
  mount(root) {
    root.style.overflow = 'auto';
    this.tab = S.params.tab || this.tab || 'ruang';
    this.root = root;
    root.innerHTML = `<div class="page"><div class="page-head"><div><h2 style="margin:0">Ruang Pengetahuan</h2></div></div>
      <div class="space-tabs" id="ktabs">${[['ruang', '🏛️', 'Per divisi'], ['library', '📚', 'Pustaka'], ['belajar', '🎓', 'Latih agen'], ['dataset', '🧬', 'Dataset']].map(([id, ic, l]) => `<button data-kt="${id}" class="${this.tab === id ? 'on' : ''}">${ic} <b>${l}</b></button>`).join('')}</div>
      <div id="kbody"></div></div>`;
    root.querySelectorAll('[data-kt]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.kt; root.querySelectorAll('[data-kt]').forEach((x) => x.classList.toggle('on', x === b)); this.render(); }));
    this.render();
  },
  update(colls) { if (colls.has('*') || colls.has('notes') || colls.has('employees') || colls.has('tick')) this.render(); },
  render() {
    const el = this.root?.querySelector('#kbody'); if (!el) return;
    if (this.tab === 'ruang') return this.spaces(el);
    if (this.tab === 'library') return this.library(el);
    if (this.tab === 'belajar') return this.learning(el);
    return this.dataset(el);
  },
  async spaces(el) {
    const s = await api('GET', '/api/knowledge/spaces');
    const avg = Math.round(s.divisions.reduce((a, d) => a + d.coverage, 0) / Math.max(1, s.divisions.length));
    el.innerHTML = `<div class="small muted" style="margin-bottom:10px">${s.library} catatan pustaka · ${s.totalNotes} catatan Brain · rata-rata cakupan <b>${avg}%</b></div>
      <div class="ks-list">${s.divisions.map((d) => `<div class="ks-row" style="--c:${d.color}"><span class="ks-ic">${d.icon}</span><div class="ks-nm"><b>${esc(d.name)}</b><span class="small muted">${d.agents} agen · ${d.ownNotes} catatan</span></div><div class="ks-bar" title="${d.covered}/${d.agents} agen punya knowledge"><i style="width:${d.coverage}%;background:${d.color}"></i></div><button class="btn sm" data-share="${d.id}">📤 Bagikan</button></div>`).join('')}</div>`;
    el.querySelectorAll('[data-share]').forEach((b) => (b.onclick = () => this.share(b.dataset.share)));
  },
  async share(divisionId) {
    const lib = await api('GET', '/api/knowledge/library');
    const d = D().divisions.find((x) => x.id === divisionId);
    modal(`📤 Bagikan ke ${esc(d?.name || '')}`, `<label class="f">Catatan<select class="input" name="note">${lib.map((n) => `<option value="${n.id}">${esc(n.title)} · ${n.attached} agen</option>`).join('')}</select></label>
      <label class="f">Aksi<select class="input" name="mode"><option value="add">Bagikan ke semua agen divisi</option><option value="remove">Lepas dari semua agen divisi</option></select></label>`, {
      actions: [{ label: 'Batal' }, { label: 'Terapkan', kind: 'primary', run: async (b) => { const f = formData(b); const r = await api('POST', '/api/knowledge/assign', { noteId: f.note, mode: f.mode, divisionId, userId: S.me }); toast(`✅ ${r.changed} agen diperbarui`, 'ok'); this.render(); } }],
    });
  },
  async library(el) {
    const lib = await api('GET', '/api/knowledge/library');
    const q = (this.q || '').toLowerCase();
    const rows = lib.filter((n) => !q || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q));
    el.innerHTML = `<div class="row" style="margin-bottom:10px"><input class="input" id="klq" placeholder="🔎 Cari knowledge…" value="${esc(this.q || '')}" style="max-width:320px"><span class="small muted">${rows.length} dari ${lib.length} catatan</span></div>
      <div class="ks-lib">${rows.map((n) => `<div class="card ks-note"><div class="row"><b style="flex:1;min-width:0">${esc(n.title)}</b><span class="chip">${n.attached} agen</span></div><div class="small faint">${esc(n.folder)} · ${n.words} kata</div><div class="row wrap" style="gap:4px;margin-top:6px">${(n.tags || []).slice(0, 5).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div><div class="row" style="margin-top:8px;gap:6px"><button class="btn sm" data-open="${n.id}">Baca</button><button class="btn sm" data-bc="${n.id}">📤 Bagikan</button></div></div>`).join('') || '<div class="empty">Tidak ada catatan.</div>'}</div>`;
    el.querySelector('#klq').oninput = (ev) => { this.q = ev.target.value; const p = ev.target.selectionStart; this.library(el); const i = el.querySelector('#klq'); i.focus(); i.setSelectionRange(p, p); };
    el.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => navigate('brain', { note: b.dataset.open })));
    el.querySelectorAll('[data-bc]').forEach((b) => (b.onclick = () => {
      const n = lib.find((x) => x.id === b.dataset.bc);
      modal(`📤 ${esc(n.title)}`, `<label class="f">Bagikan ke divisi<select class="input" name="div">${D().divisions.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label><label class="f">Aksi<select class="input" name="mode"><option value="add">Tambahkan</option><option value="remove">Lepas</option></select></label>`, {
        actions: [{ label: 'Batal' }, { label: 'Terapkan', kind: 'primary', run: async (x) => { const f = formData(x); const r = await api('POST', '/api/knowledge/assign', { noteId: n.id, mode: f.mode, divisionId: f.div, userId: S.me }); toast(`✅ ${r.changed} agen diperbarui`, 'ok'); this.library(el); } }],
      });
    }));
  },
  async learning(el) {
    const L = await api('GET', '/api/learning');
    const sorted = [...L].sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0) || b.tasks - a.tasks);
    const scored = L.filter((x) => x.quality != null);
    const q = scored.length ? (scored.reduce((a, x) => a + x.quality, 0) / scored.length).toFixed(1) : '–';
    el.innerHTML = `<div class="kpi-grid" style="margin-bottom:14px">${[[L.length, 'agen AI'], [q, 'rata-rata kualitas'], [L.reduce((a, x) => a + x.examples, 0), 'contoh belajar'], [L.reduce((a, x) => a + x.lessons.length, 0), 'pelajaran tercatat']].map(([v, l]) => `<div class="card kpi"><span class="kpi-l">${l}</span><div class="v">${v}</div></div>`).join('')}</div>
      <div class="ks-learn">${sorted.map((x) => `<div class="card ks-agent"><div class="row">${avatar(emp(x.id))}<div style="flex:1;min-width:0"><b>${esc(x.name)}</b><div class="small muted">${esc(x.title)}${x.team ? ' · ' + esc(x.team) : ''}</div></div><button class="btn sm" data-train="${x.id}">🎓 Latih</button></div>
        <div class="small" style="margin:8px 0 4px">Kualitas ${x.quality ?? '–'}/10 · ${x.tasks} tugas · ${x.examples} contoh${x.mood ? ' · mood ' + esc(x.mood) : ''}</div>
        ${x.skills.map((s) => `<div class="ks-skill"><span>${esc(s.name)}</span><div class="ks-bar"><i style="width:${s.proficiency * 10}%"></i></div><b>${s.proficiency}</b></div>`).join('')}
        ${x.lessons.length ? `<div class="small faint" style="margin-top:8px">Pelajaran terakhir: ${esc(x.lessons[x.lessons.length - 1].lesson).slice(0, 140)}</div>` : ''}</div>`).join('')}</div>`;
    el.querySelectorAll('[data-train]').forEach((b) => (b.onclick = () => this.train(b.dataset.train)));
  },
  train(employeeId) {
    const e = emp(employeeId);
    const skills = (e.skillRefs || []).map((r) => D().skills.find((s) => s.id === r.id)).filter(Boolean);
    modal(`🎓 Latih ${esc(e.name)}`, `<label class="f">Skill<select class="input" name="skill">${skills.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('') || '<option value="">(belum ada skill)</option>'}</select></label>
      <label class="f">Pelajaran praktis (maks 300 karakter)<textarea class="input" name="lesson" rows="3" placeholder="mis. Untuk iklan TikTok, pakai hook 3 detik pertama dan tes 3 kreatif."></textarea></label>`, {
      actions: [{ label: 'Batal' }, { label: 'Latih', kind: 'primary', run: async (b) => {
        const f = formData(b); if (!f.skill || !f.lesson?.trim()) return toast('Pilih skill dan isi pelajaran', 'warn');
        const r = await api('POST', '/api/learning/train', { employeeId, skillId: f.skill, lesson: f.lesson, userId: S.me });
        toast(`🎓 ${e.name} naik ke ${r.proficiency}/10`, 'ok'); this.render();
      } }],
    });
  },
  dataset(el) {
    el.innerHTML = `<div class="card" style="max-width:720px"><div class="card-h">Dataset fine-tuning</div><div class="card-b" style="display:grid;gap:12px">
      <div class="small muted">Dataset dibangun dari contoh kerja berkualitas (skor refleksi di atas batas). Data pribadi seperti nomor atau email disaring. 15% disisihkan untuk evaluasi.</div>
      <label class="f">Cakupan<select class="input" id="dsc"><option value="">Seluruh perusahaan</option>${D().divisions.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label>
      <label class="f">Kualitas minimum<input class="input" id="dsq" type="number" min="1" max="10" value="7"></label>
      <div class="row"><button class="btn primary" id="dsgo">🧬 Bangun dataset</button><span class="small muted" id="dsout"></span></div></div></div>`;
    el.querySelector('#dsgo').onclick = async () => {
      const r = await api('POST', '/api/training-sets', { divisionId: el.querySelector('#dsc').value, minQuality: +el.querySelector('#dsq').value, userId: S.me });
      el.querySelector('#dsout').textContent = `✅ ${r.name}: ${r.train} train · ${r.eval} eval dari ${r.agents} agen`;
      toast('Dataset dibangun', 'ok');
    };
  },
};
