// Agent Studio: design AI employees (layered instructions, skills, tools, knowledge), the skill library and the tool catalog.
import { S, api, esc, emp, div, avatar, toast, modal, navigate, opt, formData } from './core.js';
import { bindAppearance } from './appearance-ui.js';
import { resolveAppearance } from './assets3d.js';

const D = () => S.data;
const clone = (o) => JSON.parse(JSON.stringify(o));
const EFFORTS = [['', 'Default (Pengaturan)'], ['low', 'low · cepat & hemat'], ['medium', 'medium'], ['high', 'high · tugas sulit']];
const AVATARS = { bot: '🤖 Bot', cat: '🐱 Kucing', bear: '🐻 Beruang', bunny: '🐰 Kelinci', fox: '🦊 Rubah' };
const CATEGORY_TOOLS = { Research: ['web_search', 'visit_url'], Analysis: ['calculate'], Finance: ['calculate'], Data: ['calculate'], Knowledge: ['search_brain', 'read_note', 'write_note'], Automation: ['schedule_job', 'list_jobs'], Marketing: ['web_search'], Commerce: ['web_search', 'calculate'], Sales: ['calculate'], Strategy: ['web_search'] };
const skillTools = (sk) => (sk?.tools?.length ? sk.tools : CATEGORY_TOOLS[sk?.category] || []);
const autoOn = () => D().settings?.autoActivate !== false;
const toolChips = (ids) => ids.map((t) => `<span class="chip tool-chip">⚡ ${esc(t)}</span>`).join('');
const catsOf = (list) => [...new Set(list.map((x) => x.category))].sort();
const blankEmployee = (divisionId = 'mkt') => ({ name: '', title: '', type: 'ai', divisionId, isLead: false, avatar: 'bot', autonomy: 'auto', model: '', effort: '', outputFormat: 'markdown', persona: '', about: '', taskAndFunction: '', instructions: '', escalation: '', skills: [], skillRefs: (D().skills || []).map((s) => ({ id: s.id, proficiency: 5 })), tools: (D().capabilities || []).map((c) => c.id), knowledgeIds: [], starters: [], reasoning: null });

export const StudioView = {
  mount(root) {
    root.style.overflow = 'hidden';
    this.tab = S.params.tab || this.tab || 'agents';
    if (S.params.emp) this.select(S.params.emp, false);
    root.innerHTML = `<div class="studio ${this.sel || this.skillSel ? 'has-sel' : ''}" id="studio"><div class="studio-list" id="sl"></div><div class="studio-main" id="sm"></div></div>`;
    this.root = root;
    this.renderList();
    this.renderMain();
  },
  update(colls) {
    if (['*', 'employees', 'skills', 'divisions', 'notes'].some((c) => colls.has(c))) this.renderList();
    if (this.tab !== 'agents' && (colls.has('skills') || colls.has('employees')) && !this.root.querySelector('#sm').contains(document.activeElement)) this.renderMain();
  },
  unmount(root) { root.style.overflow = ''; },

  select(id, render = true) {
    this.sel = id;
    const e = id === 'new' ? blankEmployee() : emp(id);
    this.draft = e ? clone({ ...blankEmployee(e.divisionId), ...e }) : null;
    this.newSkills = [];
    this.promptText = null;
    if (render) { this.root.querySelector('#studio').classList.add('has-sel'); this.renderList(); this.renderMain(); }
  },

  // ───── left column
  renderList() {
    const el = this.root?.querySelector('#sl'); if (!el) return;
    const q = (this.q || '').toLowerCase();
    const tabs = `<div class="tabs" style="margin-bottom:8px">${[['agents', 'Karyawan'], ['skills', 'Skill'], ['tools', 'Tool']].map(([id, l]) => `<button class="${this.tab === id ? 'active' : ''}" data-tab="${id}" style="flex:1">${l}</button>`).join('')}</div>
      <input class="input" id="sq" placeholder="Cari…" value="${esc(this.q || '')}" style="margin-bottom:6px">`;
    let body = '';
    if (this.tab === 'agents') {
      body = `<div class="row" style="gap:6px;margin-bottom:6px"><button class="btn primary sm" id="snew" style="flex:1">✨ Karyawan baru</button><button class="btn sm" id="sbulk">Bulk</button></div>` +
        D().divisions.map((d) => {
          const list = D().employees.filter((e) => e.divisionId === d.id && (!q || `${e.name} ${e.title}`.toLowerCase().includes(q)));
          if (!list.length) return '';
          return `<details class="chg" data-sg="${d.id}" ${(this.sopen ||= new Set()).has(d.id) || q || list.some((e) => e.id === this.sel) ? 'open' : ''}><summary>${d.icon} ${esc(d.name)}<em>${list.length}</em></summary>${list.map((e) => `<div class="member ${this.sel === e.id ? 'active' : ''}" data-sel="${e.id}" style="${this.sel === e.id ? 'background:var(--panel2)' : ''}">${avatar(e)}<div style="min-width:0;flex:1"><div class="nm">${esc(e.name)} ${e.isLead ? '👑' : ''}</div><div class="rl">${esc(e.title)}${e.type === 'ai' ? ` · ${(e.skillRefs || []).length} skill` : ' · manusia'}</div></div></div>`).join('')}</details>`;
        }).join('');
    } else if (this.tab === 'skills') {
      const sk = (D().skills || []).filter((s) => !q || `${s.name} ${s.category} ${s.description}`.toLowerCase().includes(q));
      body = `<button class="btn primary sm" id="sknew" style="width:100%;margin-bottom:6px">＋ Skill baru</button><div class="small faint" style="margin:2px 4px 6px">${sk.length} skill · ${catsOf(sk).length} kategori</div>` + catsOf(sk).map((cat) => `<div class="eyebrow" style="margin:10px 4px 4px">${esc(cat)} · ${sk.filter((x) => x.category === cat).length}</div>` + sk.filter((x) => x.category === cat).map((s) => `<div class="member" data-skill="${s.id}" style="${this.skillSel === s.id ? 'background:var(--panel2)' : ''}"><div class="ava" style="background:var(--panel2);color:var(--sand);font-family:var(--mono);font-size:11px">${esc(s.category.slice(0, 2).toUpperCase())}</div><div style="min-width:0;flex:1"><div class="nm">${esc(s.name)}</div><div class="rl">${D().employees.filter((e) => e.skillRefs?.some((r) => r.id === s.id)).length} karyawan · ${skillTools(s).length} tool</div></div></div>`).join('')).join('');
    } else {
      const cs = (D().capabilities || []).filter((c) => !q || `${c.id} ${c.label} ${c.category}`.toLowerCase().includes(q));
      body = catsOf(cs).map((cat) => `<div class="eyebrow" style="margin:10px 4px 4px">${esc(cat)}</div>` + cs.filter((c) => c.category === cat).map((c) => `<div class="member"><div class="ava" style="background:var(--panel2);color:var(--sand);font-family:var(--mono);font-size:11px">${c.risk === 'medium' ? '◆' : '◇'}</div><div style="min-width:0;flex:1"><div class="nm mono" style="font-size:12px">${c.id}</div><div class="rl">${esc(c.label)} · ${D().employees.filter((e) => e.type === 'ai' && (e.tools || []).includes(c.id)).length} karyawan</div></div></div>`).join('')).join('');
    }
    el.innerHTML = tabs + body;
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.renderList(); this.renderMain(); }));
    const sq = el.querySelector('#sq');
    sq.oninput = () => { this.q = sq.value; const pos = sq.selectionStart; this.renderList(); const n = this.root.querySelector('#sq'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll('details[data-sg]').forEach((x) => (x.ontoggle = () => { x.open ? this.sopen.add(x.dataset.sg) : this.sopen.delete(x.dataset.sg); }));
    el.querySelectorAll('[data-sel]').forEach((x) => (x.onclick = () => this.select(x.dataset.sel)));
    el.querySelectorAll('[data-skill]').forEach((x) => (x.onclick = () => { this.skillSel = x.dataset.skill; this.root.querySelector('#studio').classList.add('has-sel'); this.renderList(); this.renderMain(); }));
    el.querySelector('#snew')?.addEventListener('click', () => this.select('new'));
    el.querySelector('#sbulk')?.addEventListener('click', () => this.bulk());
    el.querySelector('#sknew')?.addEventListener('click', () => { this.skillSel = 'new'; this.root.querySelector('#studio').classList.add('has-sel'); this.renderMain(); });
  },

  // ───── main column
  renderMain() {
    const el = this.root?.querySelector('#sm'); if (!el) return;
    if (this.tab === 'skills') return this.renderSkill(el);
    if (this.tab === 'tools') return this.renderTools(el);
    const e = this.draft;
    if (!e) {
      el.innerHTML = `<div class="studio-body"><div class="eyebrow">agent studio</div><h2 style="margin:0">Rancang karyawan AI yang benar-benar siap kerja</h2>
        <p class="muted" style="max-width:640px;margin:0">Setiap karyawan punya lapisan instruksi (identitas → about → tugas → system instruction → eskalasi), <b>skill</b> dari library dengan tingkat keahlian, <b>tool</b> yang boleh dipakai, dan <b>knowledge</b> wajib dari Brain. Tulis satu brief, AI mengisi semuanya beserta alasannya.</p>
        <div class="row wrap"><button class="btn primary" id="s0new">✨ Buat karyawan dari brief</button><button class="btn" id="s0bulk">Bulk dari banyak brief</button></div></div>`;
      el.querySelector('#s0new').onclick = () => this.select('new');
      el.querySelector('#s0bulk').onclick = () => this.bulk();
      return;
    }
    const isNew = this.sel === 'new';
    const ai = e.type === 'ai';
    const skills = D().skills || [];
    const caps = D().capabilities || [];
    const kbNotes = D().notes.filter((n) => n.folder !== 'Memori');
    const refOf = (id) => e.skillRefs.find((r) => r.id === id);
    const needBy = (toolId) => e.skillRefs.map((r) => skills.find((x) => x.id === r.id)).filter((x) => x && skillTools(x).includes(toolId));
    const reasoning = e.reasoning && Object.entries(e.reasoning).filter(([, v]) => v);
    el.innerHTML = `
      <div class="studio-head">
        <button class="btn ghost icon" id="sback" title="Kembali">‹</button>
        ${isNew ? '<div class="ava" style="background:var(--panel2)">✨</div>' : avatar(emp(this.sel) || e)}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:16px">${esc(e.name || 'Karyawan baru')}</div><div class="small muted">${esc(e.title || 'Belum ada jabatan')} · ${esc(div(e.divisionId)?.name || '')}</div></div>
        ${!isNew ? `<button class="btn sm" id="schat">Uji via chat</button><button class="btn sm" id="s3d">Lihat di 3D</button>` : ''}
        <button class="btn primary" id="ssave">${isNew ? 'Rekrut' : 'Simpan'}</button>
      </div>
      <div class="studio-body">
        ${ai ? `<div class="gen-box"><div class="row"><span class="eyebrow" style="flex:1">ai draft</span><span class="small muted">${D().live ? 'Claude · JSON schema' : 'mode simulasi (heuristik)'}</span></div>
          <textarea class="input" id="gbrief" rows="3" placeholder="Tulis brief: peran, tujuan, tugas utama, gaya kerja. Contoh: “Spesialis TikTok Ads untuk UMKM F&B, fokus konversi dan laporan mingguan”">${esc(this.brief || '')}</textarea>
          <div class="row"><span class="small muted" style="flex:1">AI mengisi semua field, memilih skill/tool/knowledge dengan alasan, dan mengusulkan skill baru bila library belum cukup.</span><button class="btn primary" id="ggo">✨ Generate</button></div></div>` : ''}
        <div class="card"><div class="card-h">identitas</div><div class="card-b" style="display:grid;gap:12px">
          <div class="grid2"><label class="f">Nama<input class="input" data-f="name" value="${esc(e.name)}"></label><label class="f">Jabatan<input class="input" data-f="title" value="${esc(e.title)}"></label></div>
          <div class="grid2"><label class="f">Divisi<select class="input" data-f="divisionId">${D().divisions.map((d) => opt(d.id, d.name, e.divisionId)).join('')}</select></label>
            <label class="f">Jenis<select class="input" data-f="type">${opt('ai', 'Karyawan AI', e.type)}${opt('human', 'Manusia', e.type)}</select></label></div>
          <div class="grid2"><label class="f">Head divisi<select class="input" data-f="isLead">${opt('false', 'Tidak', String(e.isLead))}${opt('true', 'Ya', String(e.isLead))}</select></label>
            <label class="f">Avatar 3D<select class="input" data-f="avatar">${Object.entries(AVATARS).map(([k, v]) => opt(k, v, e.avatar)).join('')}</select></label></div>
          ${ai ? `<div class="grid2"><label class="f">Otonomi<select class="input" data-f="autonomy">${opt('auto', 'Otomatis penuh', e.autonomy)}${opt('ask', 'Selalu minta persetujuan', e.autonomy)}</select></label>
            <label class="f">Format output<select class="input" data-f="outputFormat">${['markdown', 'json', 'html', 'csv', 'text'].map((x) => opt(x, x.toUpperCase(), e.outputFormat)).join('')}</select></label></div>
          <div class="grid2"><label class="f">Model<select class="input" data-f="model">${opt('', 'Default (Pengaturan)', e.model)}${(D().models || []).map((m) => opt(m, m, e.model)).join('')}</select></label>
            <label class="f">Effort penalaran<select class="input" data-f="effort">${EFFORTS.map(([v, l]) => opt(v, l, e.effort)).join('')}</select></label></div>` : ''}
          <label class="f">Persona singkat<input class="input" data-f="persona" value="${esc(e.persona)}"></label>
          <label class="f">Keahlian (tag, pisahkan koma)<input class="input" data-f="skills" value="${esc((e.skills || []).join(', '))}"></label>
        </div></div>
        ${ai ? `
        <div class="card"><div class="card-h">penampilan 3D <span class="small muted" style="text-transform:none;letter-spacing:0">Sims-style · gender, rambut, kulit, baju, aksesori</span></div><div class="card-b" id="apbox"></div></div>
        <div class="card"><div class="card-h">instruksi berlapis</div><div class="card-b" style="display:grid;gap:12px">
          <label class="f">About — siapa dia & kapan tugas diberikan kepadanya (dipakai untuk routing)<textarea class="input" data-f="about" rows="3">${esc(e.about)}</textarea></label>
          <label class="f">Tugas & fungsi<textarea class="input" data-f="taskAndFunction" rows="3">${esc(e.taskAndFunction)}</textarea></label>
          <label class="f">System instruction (peran, tujuan, cara kerja, aturan, batasan, gaya, format)<textarea class="input mono" data-f="instructions" rows="10" style="font-size:12.5px">${esc(e.instructions)}</textarea></label>
          <label class="f">Eskalasi — kapan berhenti & minta persetujuan<textarea class="input" data-f="escalation" rows="2">${esc(e.escalation)}</textarea></label>
          <label class="f">Contoh perintah (satu per baris)<textarea class="input" data-f="starters" rows="3">${esc((e.starters || []).join('\n'))}</textarea></label>
        </div></div>
        <div class="card"><div class="card-h">skill <span class="badge soft">${e.skillRefs.length}</span><span style="flex:1"></span><span class="small" style="text-transform:none;letter-spacing:0">snippet skill disuntikkan ke prompt sesuai proficiency</span></div><div class="card-b list-scroll">
          ${skills.map((s) => { const r = refOf(s.id); return `<div class="skill-row ${r ? 'on' : ''}"><input type="checkbox" data-skillon="${s.id}" ${r ? 'checked' : ''}><div><b style="font-size:13px">${esc(s.name)}</b> <span class="chip">${esc(s.category)}</span><div class="meta">${esc(s.description)}</div><div class="row wrap" style="gap:4px;margin-top:4px">${toolChips(skillTools(s))}</div></div><div class="row" style="gap:6px">${r ? `<input type="range" min="1" max="10" value="${r.proficiency}" data-prof="${s.id}" style="width:80px"><span class="range-num">${r.proficiency}/10</span>` : ''}</div></div>`; }).join('')}
          ${(this.newSkills || []).length ? `<div class="eyebrow" style="margin-top:8px">usulan skill baru dari ai</div>${this.newSkills.map((s, i) => `<div class="skill-row"><span>✨</span><div><b style="font-size:13px">${esc(s.name)}</b> <span class="chip">${esc(s.category)}</span><div class="meta">${esc(s.description)}</div></div><button class="btn sm" data-addskill="${i}">＋ Tambah & pasang</button></div>`).join('')}` : ''}
        </div></div>
        <div class="card"><div class="card-h">tool / capability <span class="badge soft">${e.tools.length}</span><span style="flex:1"></span><label class="switch-row" style="text-transform:none;letter-spacing:0"><input type="checkbox" id="autoact" ${autoOn() ? 'checked' : ''}> ⚡ Auto-aktif dari skill</label><button class="btn sm" id="actnow" style="text-transform:none;letter-spacing:0">Aktifkan yang dibutuhkan</button></div><div class="card-b" style="display:grid;gap:8px">
          ${caps.map((c) => { const on = c.required || e.tools.includes(c.id); return `<div class="cap-row ${on ? 'on' : ''}"><input type="checkbox" data-tool="${c.id}" ${on ? 'checked' : ''} ${c.required ? 'disabled' : ''}><div><b class="mono" style="font-size:12.5px">${c.id}</b> <span class="chip">${esc(c.category)}</span> ${c.risk === 'medium' ? '<span class="chip" style="color:var(--warn)">risiko sedang</span>' : ''}<div class="meta">${esc(c.guide)}</div>${needBy(c.id).length ? `<div class="small faint" style="margin-top:3px">dibutuhkan skill: ${needBy(c.id).map((x) => esc(x.name)).join(', ')}</div>` : ''}</div><span class="small faint">${c.required ? 'wajib' : c.leadOnly ? 'lead' : c.specialist ? 'spesialis' : ''}</span></div>`; }).join('')}
        </div></div>
        <div class="card"><div class="card-h">knowledge wajib <span class="badge soft">${e.knowledgeIds.length}</span><span style="flex:1"></span><label class="btn sm" style="text-transform:none;letter-spacing:0">⬆ Upload .md .txt .csv .json<input type="file" id="kup" accept=".md,.txt,.csv,.json,.html,.yaml,.yml" multiple hidden></label></div><div class="card-b" style="display:grid;gap:8px">
          <input class="input" id="kq" placeholder="Filter catatan…" value="${esc(this.kq || '')}">
          <div class="list-scroll" id="klist">${this.kbRows(kbNotes, e)}</div>
          <div class="small muted">Catatan terpilih dilampirkan penuh ke prompt (maks ±14 ribu karakter). Catatan lain tetap bisa dicari agen lewat <code>search_brain</code>, dan 3 catatan paling relevan otomatis disertakan per tugas.</div>
        </div></div>
        ${reasoning?.length ? `<div class="card"><div class="card-h">alasan pilihan ai</div><div class="card-b" style="display:grid;gap:8px">${reasoning.map(([k, v]) => `<div class="reason"><b class="mono" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em">${esc(k)}</b><br>${esc(v)}</div>`).join('')}</div></div>` : ''}
        ${!isNew ? `<div class="card"><div class="card-h">prompt final<span style="flex:1"></span><button class="btn sm" id="pview" style="text-transform:none;letter-spacing:0">${this.promptText ? 'Muat ulang' : 'Tampilkan'}</button></div>${this.promptText ? `<div class="card-b"><div class="small muted" style="margin-bottom:8px">${this.promptText.chars.toLocaleString('id-ID')} karakter · ±${this.promptText.approxTokens.toLocaleString('id-ID')} token · versi tersimpan</div><div class="prompt-view">${esc(this.promptText.text)}</div></div>` : ''}</div>` : ''}
        ` : ''}
        ${!isNew && e.id !== 'owner' ? `<div class="row"><span style="flex:1"></span><button class="btn danger sm" id="sdel">Hapus karyawan</button></div>` : ''}
      </div>`;
    this.bindMain(el, kbNotes);
  },

  kbRows(notes, e) {
    const q = (this.kq || '').toLowerCase();
    const list = notes.filter((n) => !q || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q))
      .sort((a, b) => e.knowledgeIds.includes(b.id) - e.knowledgeIds.includes(a.id) || a.folder.localeCompare(b.folder));
    return list.slice(0, 80).map((n) => `<div class="kb-row ${e.knowledgeIds.includes(n.id) ? 'on' : ''}"><input type="checkbox" data-kb="${n.id}" ${e.knowledgeIds.includes(n.id) ? 'checked' : ''}><div><b style="font-size:13px">${esc(n.title)}</b><div class="meta">${esc(n.folder)} · ${n.content.length.toLocaleString('id-ID')} karakter</div></div><span></span></div>`).join('') || '<div class="muted small">Tidak ada</div>';
  },

  bindMain(el, kbNotes) {
    const e = this.draft;
    const apBox = el.querySelector('#apbox');
    if (apBox) bindAppearance(apBox, resolveAppearance(e, div(e.divisionId)?.color), (ap) => { e.appearance = ap; });
    el.querySelector('#sback').onclick = () => { this.root.querySelector('#studio').classList.remove('has-sel'); };
    el.querySelectorAll('[data-f]').forEach((x) => (x.oninput = x.onchange = () => {
      const k = x.dataset.f; let v = x.value;
      if (k === 'isLead') v = v === 'true';
      if (k === 'skills') v = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (k === 'starters') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
      e[k] = v;
      if (k === 'type' && x.tagName === 'SELECT') this.renderMain();
    }));
    el.querySelectorAll('[data-skillon]').forEach((x) => (x.onchange = () => {
      const id = x.dataset.skillon;
      e.skillRefs = x.checked ? [...e.skillRefs, { id, proficiency: 7 }] : e.skillRefs.filter((r) => r.id !== id);
      if (x.checked && autoOn()) { const need = skillTools(D().skills.find((k) => k.id === id)).filter((t) => (D().capabilities || []).some((c) => c.id === t) && !e.tools.includes(t)); if (need.length) { e.tools = [...e.tools, ...need]; toast(`⚡ Tool aktif otomatis: ${need.join(', ')}`, 'ok'); } }
      this.keepScroll(() => this.renderMain());
    }));
    el.querySelectorAll('[data-prof]').forEach((x) => (x.oninput = () => { const r = e.skillRefs.find((r) => r.id === x.dataset.prof); r.proficiency = +x.value; x.nextElementSibling.textContent = `${x.value}/10`; }));
    el.querySelectorAll('[data-tool]').forEach((x) => (x.onchange = () => { e.tools = x.checked ? [...new Set([...e.tools, x.dataset.tool])] : e.tools.filter((t) => t !== x.dataset.tool); x.closest('.cap-row').classList.toggle('on', x.checked); }));
    el.querySelector('#autoact')?.addEventListener('change', (ev) => api('PATCH', '/api/settings', { autoActivate: ev.target.checked }).then(() => toast(ev.target.checked ? '⚡ Auto-aktif tool dari skill: ON' : 'Auto-aktif: OFF', 'ok')));
    el.querySelector('#actnow')?.addEventListener('click', () => {
      const need = [...new Set(e.skillRefs.flatMap((r) => skillTools(D().skills.find((k) => k.id === r.id))))].filter((t) => (D().capabilities || []).some((c) => c.id === t) && !e.tools.includes(t));
      e.tools = [...e.tools, ...need]; toast(need.length ? `⚡ Diaktifkan: ${need.join(', ')}` : 'Semua tool yang dibutuhkan sudah aktif', 'ok'); this.keepScroll(() => this.renderMain());
    });
    const bindKb = () => el.querySelectorAll('[data-kb]').forEach((x) => (x.onchange = () => { e.knowledgeIds = x.checked ? [...e.knowledgeIds, x.dataset.kb] : e.knowledgeIds.filter((k) => k !== x.dataset.kb); x.closest('.kb-row').classList.toggle('on', x.checked); }));
    bindKb();
    el.querySelector('#kq')?.addEventListener('input', (ev) => { this.kq = ev.target.value; el.querySelector('#klist').innerHTML = this.kbRows(kbNotes, e); bindKb(); });
    el.querySelector('#kup')?.addEventListener('change', async (ev) => {
      for (const f of ev.target.files) {
        if (f.size > 2e6) { toast(`${f.name} terlalu besar (maks 2 MB)`, 'warn'); continue; }
        const text = await f.text();
        const title = f.name.replace(/\.[^.]+$/, '');
        const body = /\.(md|txt)$/i.test(f.name) ? text : `# ${title}\n\n\`\`\`\n${text.slice(0, 200000)}\n\`\`\``;
        const n = await api('POST', '/api/notes', { title, content: body, folder: 'Knowledge', tags: ['upload'], userId: S.me });
        e.knowledgeIds = [...new Set([...e.knowledgeIds, n.id])];
        toast(`📎 ${n.title} ditambahkan ke Brain & dilampirkan`, 'ok');
      }
      setTimeout(() => this.keepScroll(() => this.renderMain()), 80);
    });
    el.querySelectorAll('[data-addskill]').forEach((x) => (x.onclick = async () => {
      const s = this.newSkills[+x.dataset.addskill];
      const created = await api('POST', '/api/skills', { ...s, divisions: [e.divisionId] });
      e.skillRefs = [...e.skillRefs, { id: created.id, proficiency: 8 }];
      this.newSkills.splice(+x.dataset.addskill, 1);
      toast(`Skill “${created.name}” masuk library`, 'ok');
      setTimeout(() => this.keepScroll(() => this.renderMain()), 80);
    }));
    el.querySelector('#gbrief')?.addEventListener('input', (ev) => { this.brief = ev.target.value; });
    el.querySelector('#ggo')?.addEventListener('click', async (ev) => {
      if (!this.brief?.trim()) return el.querySelector('#gbrief').focus();
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Merancang…';
      try {
        const r = await api('POST', '/api/studio/generate', { kind: 'agent', brief: this.brief, divisionId: this.sel === 'new' ? undefined : e.divisionId });
        const keep = this.sel === 'new' ? {} : { name: e.name, divisionId: e.divisionId, isLead: e.isLead, avatar: e.avatar, type: e.type };
        Object.assign(e, r.employee, keep);
        this.newSkills = r.newSkills || [];
        toast(`✨ Draft dibuat (${r.source}). Periksa lalu ${this.sel === 'new' ? 'Rekrut' : 'Simpan'}.`, 'ok');
        this.renderMain();
      } finally { b.disabled = false; b.textContent = '✨ Generate'; }
    });
    el.querySelector('#ssave').onclick = async () => {
      if (!e.name?.trim()) return toast('Nama wajib diisi', 'warn');
      const body = { ...e }; delete body.stats; delete body.status; delete body.statusText; delete body.currentTaskId; delete body.id;
      if (this.sel === 'new') {
        const r = await api('POST', '/api/employees', body);
        toast(`🎊 ${r.name} bergabung di ${div(r.divisionId)?.name}`, 'ok');
        this.select(r.id);
      } else {
        await api('PATCH', `/api/employees/${this.sel}`, body);
        toast('Tersimpan', 'ok');
        this.promptText = null;
      }
    };
    el.querySelector('#schat')?.addEventListener('click', async () => { const r = await api('POST', '/api/dm', { with: this.sel, userId: S.me }); navigate('chat', { ch: r.id }); });
    el.querySelector('#s3d')?.addEventListener('click', () => navigate('office', { focus: this.sel }));
    el.querySelector('#pview')?.addEventListener('click', async () => { this.promptText = await api('GET', `/api/employees/${this.sel}/prompt`); this.keepScroll(() => this.renderMain()); });
    el.querySelector('#sdel')?.addEventListener('click', () => modal('Hapus karyawan?', `<p><b>${esc(e.name)}</b> akan dihapus. Tugas aktifnya dialihkan ke atasannya.</p>`, { actions: [{ label: 'Batal' }, { label: 'Hapus', kind: 'danger', run: async () => { await api('DELETE', `/api/employees/${this.sel}`); this.sel = null; this.draft = null; this.renderList(); this.renderMain(); } }] }));
  },

  keepScroll(fn) { const m = this.root.querySelector('#sm'); const y = m.scrollTop; fn(); m.scrollTop = y; },

  // ───── skill library
  renderSkill(el) {
    const id = this.skillSel;
    const s = id === 'new' ? { name: '', category: 'Strategy', description: '', promptSnippet: '', usageGuide: '', example: '' } : (D().skills || []).find((x) => x.id === id);
    if (!s) {
      el.innerHTML = `<div class="studio-body"><div class="eyebrow">skill library</div><h2 style="margin:0">Know-how yang bisa dipasang ke karyawan mana pun</h2><p class="muted" style="margin:0;max-width:640px">Skill berisi metode kerja (prompt snippet) dan panduan kapan dipakai. Snippet benar-benar disuntikkan ke prompt karyawan sesuai tingkat keahliannya.</p>
        <div class="stat-strip">${[['skill', (D().skills || []).length], ['kategori', catsOf(D().skills || []).length], ['dibuat agen', (D().skills || []).filter((x) => !x.builtIn).length], ['pemakaian', D().employees.reduce((a, e) => a + (e.skillRefs || []).length, 0)]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        ${catsOf(D().skills || []).map((cat) => `<div class="eyebrow" style="margin-top:6px">${esc(cat)}</div><div class="lib-grid">${(D().skills || []).filter((x) => x.category === cat).map((x) => `<div class="card lib-card" data-open="${x.id}"><div class="row"><b style="flex:1">${esc(x.name)}</b>${x.builtIn ? '' : '<span class="chip" style="color:var(--sand)">baru</span>'}</div><div class="small muted">${esc(x.description)}</div><div class="row wrap" style="gap:4px">${toolChips(skillTools(x))}</div><div class="faces">${D().employees.filter((e) => e.skillRefs?.some((r) => r.id === x.id)).slice(0, 8).map((e) => avatar(e)).join('')}</div></div>`).join('')}</div>`).join('')}</div>`;
      el.querySelectorAll('[data-open]').forEach((c) => (c.onclick = () => { this.skillSel = c.dataset.open; this.renderList(); this.renderMain(); }));
      return;
    }
    const users = D().employees.filter((e) => e.skillRefs?.some((r) => r.id === s.id));
    el.innerHTML = `<div class="studio-head"><button class="btn ghost icon" id="kback">‹</button><div style="flex:1"><div style="font-weight:600;font-size:16px">${esc(s.name || 'Skill baru')}</div><div class="small muted">${esc(s.category)} · dipakai ${users.length} karyawan</div></div><button class="btn primary" id="ksave">${id === 'new' ? 'Buat skill' : 'Simpan'}</button></div>
      <div class="studio-body">
        <div class="gen-box"><span class="eyebrow">ai draft</span><textarea class="input" id="kbrief" rows="2" placeholder="Brief skill, mis. “Analisis cohort retensi pelanggan SaaS”"></textarea><div class="row"><span style="flex:1"></span><button class="btn primary" id="kgen">✨ Generate</button></div></div>
        <div class="card"><div class="card-b" style="display:grid;gap:12px">
          <div class="grid2"><label class="f">Nama<input class="input" name="name" value="${esc(s.name)}"></label><label class="f">Kategori<select class="input" name="category">${[...new Set(['Communication', 'Creative', 'Analysis', 'Strategy', 'Technical', 'Management', 'Sales', 'Customer', 'Research', 'Finance', 'People', 'Legal', 'Knowledge', 'AI', 'Automation', 'Marketing', 'Commerce', 'Product', 'Engineering', 'Data', 'Operations', 'Quality', 'Support', ...catsOf(D().skills || [])])].map((c) => opt(c, c, s.category)).join('')}</select></label></div>
          <label class="f">Deskripsi<input class="input" name="description" value="${esc(s.description)}"></label>
          <label class="f">Prompt snippet — metode langkah demi langkah<textarea class="input mono" name="promptSnippet" rows="7" style="font-size:12.5px">${esc(s.promptSnippet)}</textarea></label>
          <label class="f">Kapan dipakai<textarea class="input" name="usageGuide" rows="2">${esc(s.usageGuide)}</textarea></label>
          <label class="f">Contoh<textarea class="input" name="example" rows="2">${esc(s.example || '')}</textarea></label>
        </div></div>
        <div class="card"><div class="card-h">tool yang dibutuhkan<span style="flex:1"></span><span class="small" style="text-transform:none;letter-spacing:0">${autoOn() ? '⚡ otomatis aktif saat skill dipasang' : 'auto-aktif mati'}</span></div><div class="card-b row wrap" id="ktools">${(D().capabilities || []).filter((c) => !c.required).map((c) => `<label class="chip" style="cursor:pointer;${skillTools(s).includes(c.id) ? 'color:var(--sand);border-color:var(--sand)' : ''}"><input type="checkbox" value="${c.id}" ${skillTools(s).includes(c.id) ? 'checked' : ''} style="margin:0 4px 0 0">${esc(c.id)}</label>`).join('')}</div></div>
        ${s.history?.length ? `<div class="card"><div class="card-h">riwayat penyempurnaan oleh agen <span class="badge soft">${s.history.length}</span></div><div class="card-b" style="display:grid;gap:8px">${s.history.slice(-5).reverse().map((h) => `<div class="reason"><b>${esc(emp(h.by)?.name || h.by || '')}</b> · ${new Date(h.t || h.at || Date.now()).toLocaleString('id-ID')}<br>${esc(h.reason || '')}</div>`).join('')}</div></div>` : ''}
        ${users.length ? `<div class="card"><div class="card-h">dipakai oleh</div><div class="card-b row wrap">${users.map((u) => `<span class="chip" style="cursor:pointer" data-goemp="${u.id}">${esc(u.name)} · ${u.skillRefs.find((r) => r.id === s.id).proficiency}/10</span>`).join('')}</div></div>` : ''}
        ${id !== 'new' && !s.builtIn ? '<div class="row"><span style="flex:1"></span><button class="btn danger sm" id="kdel">Hapus skill</button></div>' : ''}
      </div>`;
    const form = el.querySelector('.card .card-b');
    el.querySelector('#kback').onclick = () => { this.skillSel = null; this.root.querySelector('#studio').classList.remove('has-sel'); this.renderList(); this.renderMain(); };
    el.querySelector('#kgen').onclick = async (ev) => {
      const brief = el.querySelector('#kbrief').value.trim(); if (!brief) return;
      ev.currentTarget.disabled = true;
      try { const r = await api('POST', '/api/studio/generate', { kind: 'skill', brief }); for (const k of ['name', 'category', 'description', 'promptSnippet', 'usageGuide', 'example']) { const f = form.querySelector(`[name=${k}]`); if (f && r[k]) f.value = r[k]; } toast(`Draft skill dibuat (${r.source})`, 'ok'); }
      finally { ev.currentTarget.disabled = false; }
    };
    el.querySelector('#ksave').onclick = async () => {
      const f = formData(form); if (!f.name.trim()) return toast('Nama wajib', 'warn');
      f.tools = [...el.querySelectorAll('#ktools input:checked')].map((x) => x.value);
      if (id === 'new') { const r = await api('POST', '/api/skills', f); this.skillSel = r.id; toast('Skill dibuat', 'ok'); }
      else { await api('PATCH', `/api/skills/${id}`, f); toast('Tersimpan', 'ok'); }
    };
    el.querySelectorAll('[data-goemp]').forEach((c) => (c.onclick = () => { this.tab = 'agents'; this.select(c.dataset.goemp); }));
    el.querySelector('#kdel')?.addEventListener('click', async () => { await api('DELETE', `/api/skills/${id}`); this.skillSel = null; this.renderMain(); });
  },

  renderTools(el) {
    el.innerHTML = `<div class="studio-body"><div class="eyebrow">capabilities</div><h2 style="margin:0">Tool yang bisa dipakai karyawan AI</h2><p class="muted" style="margin:0;max-width:680px">Setiap tool dilengkapi panduan pemakaian yang ikut masuk ke prompt. Aktifkan atau matikan per karyawan di tab Karyawan. Tool berisiko sedang (delegasi) bisa dibatasi untuk head divisi saja.</p>
      <label class="switch-row"><input type="checkbox" id="autoact2" ${autoOn() ? 'checked' : ''}> <b>⚡ Auto-aktif</b> — saat agen dibuat atau mempelajari skill, semua tool yang dibutuhkan skill itu langsung aktif</label>
      ${catsOf(D().capabilities || []).map((cat) => `<div class="eyebrow" style="margin-top:6px">${esc(cat)}</div><div class="lib-grid">${(D().capabilities || []).filter((c) => c.category === cat).map((c) => { const users = D().employees.filter((e) => e.type === 'ai' && (e.tools || []).includes(c.id)); const need = (D().skills || []).filter((x) => skillTools(x).includes(c.id)); return `<div class="card lib-card"><div class="row"><b class="mono" style="flex:1;font-size:13px">${c.id}</b>${c.risk === 'medium' ? '<span class="chip" style="color:var(--warn)">risiko sedang</span>' : ''}${c.leadOnly ? '<span class="chip">lead</span>' : ''}${c.specialist ? '<span class="chip">spesialis</span>' : ''}</div><div><b>${esc(c.label)}</b></div><div class="small muted">${esc(c.guide)}</div>${need.length ? `<div class="small faint">dibutuhkan ${need.length} skill: ${need.slice(0, 4).map((x) => esc(x.name)).join(', ')}${need.length > 4 ? '…' : ''}</div>` : ''}<div class="row" style="gap:8px"><div class="meter" style="flex:1"><i style="width:${Math.round(users.length / Math.max(1, D().employees.filter((e) => e.type === 'ai').length) * 100)}%"></i></div><span class="small faint mono">${users.length} agen</span></div><div class="faces">${users.slice(0, 10).map((u) => avatar(u)).join('')}</div></div>`; }).join('')}</div>`).join('')}</div>`;
    el.querySelector('#autoact2').onchange = (ev) => api('PATCH', '/api/settings', { autoActivate: ev.target.checked }).then(() => toast(ev.target.checked ? '⚡ Auto-aktif ON' : 'Auto-aktif OFF', 'ok'));
  },

  bulk() {
    modal('Bulk create karyawan AI', `<p class="small muted" style="margin:0">Satu brief per blok, pisahkan dengan baris <code>---</code>. Setiap brief diproses berurutan oleh generator, lalu langsung direkrut.</p>
      <textarea class="input" name="briefs" rows="10" placeholder="Spesialis TikTok Ads untuk UMKM F&B\n---\nAnalis cohort retensi pelanggan\n---\nPenulis newsletter mingguan"></textarea>
      <label class="f">Divisi (opsional)<select class="input" name="divisionId"><option value="">Otomatis dari brief</option>${D().divisions.map((d) => opt(d.id, d.name)).join('')}</select></label>
      <div id="bprog" style="display:grid;gap:4px"></div>`, {
      wide: true,
      actions: [{ label: 'Tutup' }, { label: 'Generate & rekrut semua', kind: 'primary', run: async (b) => {
        const f = formData(b);
        const briefs = f.briefs.split(/\n-{3,}\n/).map((x) => x.trim()).filter(Boolean);
        if (!briefs.length) return false;
        const prog = b.querySelector('#bprog');
        for (const [i, brief] of briefs.entries()) {
          const line = document.createElement('div'); line.className = 'small mono'; line.textContent = `[${i + 1}/${briefs.length}] merancang: ${brief.slice(0, 60)}…`; prog.appendChild(line);
          try {
            const r = await api('POST', '/api/studio/generate', { kind: 'agent', brief, divisionId: f.divisionId || undefined });
            const created = await api('POST', '/api/employees', r.employee);
            line.textContent = `✓ ${created.name} — ${created.title} (${div(created.divisionId)?.short})`;
          } catch (err) { line.textContent = `✗ gagal: ${err.message}`; }
        }
        toast(`${briefs.length} brief diproses`, 'ok');
        return false;
      } }],
    });
  },
};
