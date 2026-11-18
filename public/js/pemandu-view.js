// Pemandu: Beranda sebagai SATU percakapan, seperti ngobrol dengan teman yang sangat pintar.
// Pengguna menulis atau berbicara bebas; hasil muncul sebagai balasan di utas yang sama; di akhir tiap balasan ada satu ajakan dan 2-4 tombol saran.
// Server: server/pemandu.js (POST /api/pemandu/turn). Kamus bahasa: server/kamus.js. Titik sambung: docs/PEMANDU-TITIK-SAMBUNG.md.
import { S, esc, emp, modal, toast, loginGate } from './core.js';
import { icon } from './icons.js';
import { md } from './md.js';

/** satu pintu ke server; null bila gagal, sehingga layar tidak pernah kosong atau menampilkan kode galat */
async function call(method, url, body) {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.login) { loginGate(data); return null; }
    return res.ok ? data : null;
  } catch { return null; }
}
const FAIL = { kind: 'error', say: 'Sepertinya sambungan sedang terputus, jadi aku belum bisa melanjutkan. Mau coba lagi?', options: [{ id: 'poll', label: 'Coba lagi', recommended: true }, { id: 'new', label: 'Mulai dari awal' }] };
const STARTERS = [{ id: 'intent:konten', label: 'Bantu aku membuat konten', ikon: 'edit' }, { id: 'intent:riset', label: 'Cari tahu soal sesuatu', ikon: 'search' }, { id: 'intent:rencana', label: 'Atur rencana usahaku', ikon: 'goal' }, { id: 'intent:pesan', label: 'Tuliskan sebuah pesan', ikon: 'chat' }];

export const PemanduView = {
  mount(root) {
    const st = { sid: '', items: [], busy: false, timer: null, home: null, rec: null, mode: '', untuk: null };
    this.st = st;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    root.innerHTML = `<div class="page pemandu">
      <div id="pmHome" class="pm-home"></div>
      <div id="pmUntuk"></div>
      <div id="pmThread" class="pm-thread" role="log" aria-live="polite" aria-label="Percakapan"></div>
      <div class="pm-dock">
        <form id="pmForm" class="pm-compose" autocomplete="off">
          <label class="sr-only" for="pmIn">Tulis atau ucapkan yang kamu butuhkan</label>
          <textarea id="pmIn" class="input" rows="1" placeholder="Tulis atau ucapkan…" enterkeyhint="send"></textarea>
          ${Rec ? `<button type="button" class="btn icon pm-mic" id="pmMic" aria-pressed="false" aria-label="Bicara" title="Bicara">${icon('mic', 22)}</button>` : ''}
          <button type="submit" class="btn primary pm-send" id="pmGo" aria-label="Kirim">${icon('arrow', 20)}<span>Kirim</span></button>
        </form>
        <div class="pm-foot" id="pmFoot"></div>
      </div>
    </div>`;
    const $ = (q) => root.querySelector(q);
    const input = $('#pmIn');
    const last = () => st.items[st.items.length - 1];
    const toEnd = () => requestAnimationFrame(() => $('#pmForm').scrollIntoView({ block: 'end', behavior: 'smooth' }));

    // ───── satu balasan Pemandu: kalimat, isi (hasil, pratinjau, kemajuan), lalu tombol saran hanya pada balasan terakhir
    const chip = (o) => `<button class="btn pm-chip ${o.recommended ? 'rec' : ''}" data-cid="${esc(o.id)}" data-label="${esc(o.label)}"><b>${esc(o.label)}</b>${o.recommended ? '<em class="pm-tag">Disarankan</em>' : ''}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</button>`;
    const body = (r) => {
      let h = '';
      for (const n of r.notes || []) h += `<p class="pm-note">${esc(n)}</p>`;
      h += `<p>${esc(r.say)}</p>`;
      if (r.profile) h += `<ul class="pm-know">${r.profile.items.map((i) => `<li><span>${esc(i.label)}:</span> ${esc(i.value)}</li>`).join('')}</ul>`;
      if (r.kind === 'confirm' && r.preview?.length) h += `<div class="pm-preview"><dl>${r.preview.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl></div>`;
      if (r.kind === 'progress') h += `<div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress?.pct || 0}"><i style="width:${r.progress?.pct || 5}%"></i></div><p class="pm-sub">${esc(r.progress?.text || 'Mulai dikerjakan')}</p>`;
      if (r.result) h += `<section class="pm-result"><header>${icon('doc', 16)} ${esc(r.result.title || 'Hasil')}${r.result.revision ? ` · versi ${r.result.revision + 1}` : ''}</header><div class="md">${md(r.result.text || 'Belum ada isinya.')}</div>${r.result.gaps ? `<p class="pm-sub">Yang belum terpenuhi: ${esc(r.result.gaps)}</p>` : ''}<button class="btn sm ghost" data-copy="1">${icon('doc', 16)} Salin teks</button></section>`;
      if (r.saved) h += `<p class="pm-saved">${icon('check', 16)} Tersimpan di Catatan: <b>${esc(r.saved.title)}</b></p>`;
      if (r.learned) h += `<p class="pm-note">${esc(r.learned.text)}</p>`;
      for (const c of r.cards || []) h += `<div class="pm-minicard"><p><b>${esc(c.say)}</b></p>${c.detail ? `<p class="pm-sub">${esc(c.detail)}</p>` : ''}<div class="pm-chips">${c.options.map((o) => `<button class="btn pm-chip ${o.recommended ? 'rec' : ''}" data-card="${esc(c.type)}:${esc(o.id)}" data-ref="${esc(c.ref || '')}" data-label="${esc(o.label)}"><b>${esc(o.label)}</b></button>`).join('')}</div></div>`;
      return h;
    };
    const actions = (r) => {
      const opts = r.options || [];
      let h = '';
      if (opts.length) h += `<div class="pm-chips ${opts.some((o) => o.hint) ? 'stack' : ''}">${opts.map(chip).join('')}</div>`;
      const more = [];
      if (r.learned) more.push('<button class="btn pm-chip ghost" data-keep="1"><b>Betul</b></button><button class="btn pm-chip ghost" data-profile="1"><b>Ubah</b></button>');
      if (r.delegate) more.push('<button class="btn pm-chip ghost" data-cid="delegate" data-label="Serahkan ke kamu"><b>Serahkan ke kamu</b></button>');
      if (r.freeText && opts.length) more.push('<button class="btn pm-chip ghost" data-other="1"><b>Lainnya (ketik)</b></button>');
      if (r.undo) more.push('<button class="btn pm-chip ghost" data-cid="back" data-label="Kembali"><b>Kembali</b></button>');
      return h + (more.length ? `<div class="pm-chips">${more.join('')}</div>` : '');
    };
    const render = () => {
      const li = st.items.length - 1;
      $('#pmThread').innerHTML = st.items.map((m, i) => (m.role === 'me'
        ? `<div class="pm-row me"><div class="pm-bubble me">${esc(m.text)}</div></div>`
        : `<div class="pm-row guide"><div class="pm-bubble guide kind-${esc(m.r.kind)}">${body(m.r)}</div>${i === li ? actions(m.r) : ''}</div>`)).join('');
      $('#pmThread').hidden = !st.items.length;
      renderHome(); renderFoot();
    };
    const renderFoot = () => {
      const q = (last()?.r || st.home)?.quota || st.home?.quota;
      $('#pmFoot').innerHTML = `${q ? `<span class="pm-quota" title="Sisa jatah hari ini">Sisa jatah hari ini: <b>${esc(q.word)}</b><span class="bar" role="img" aria-label="Sisa jatah ${q.pct} persen"><i style="width:${q.pct}%"></i></span></span>` : ''}${st.home?.profile?.known ? '<button class="btn sm ghost" data-profile="1">Yang aku tahu tentang kamu</button>' : ''}`;
    };

    // ───── keadaan awal yang bersih: sapaan dan beberapa saran pembuka
    const renderHome = () => {
      const h = st.home; const box = $('#pmHome');
      box.hidden = !!st.items.length;
      if (st.items.length) return;
      if (!h) { box.innerHTML = '<p class="pm-sub">Sebentar ya, aku siapkan dulu…</p>'; return; }
      box.innerHTML = `<div class="pm-hero"><h2>${esc(h.say)}</h2><p>${esc(h.sub)}</p></div>
        ${h.onboarding && st.mode !== 'onboard' ? '<div class="pm-bubble guide pm-intro"><p>Boleh kenalan dulu? Cukup tempel alamat situsmu atau tulis satu kalimat tentang usahamu, supaya aku tidak perlu bertanya hal yang sama berulang-ulang.</p><div class="pm-chips"><button class="btn pm-chip rec" data-onb="1"><b>Boleh, kenalan</b></button><button class="btn pm-chip ghost" data-onb-skip="1"><b>Lewati dulu</b></button></div></div>' : ''}
        ${st.mode === 'onboard' ? '<div class="pm-bubble guide pm-intro"><p>Silakan ketik atau tempel di kolom bawah: alamat situs, atau satu kalimat tentang usahamu.</p></div>' : ''}
        <div class="pm-suggest" role="list">${h.cards.map((c) => `<button class="btn pm-chip" role="listitem" data-cid="${esc(c.id)}" data-label="${esc(c.label)}">${icon(c.ikon || 'spark', 20)}<b>${esc(c.label)}</b>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</button>`).join('')}</div>`;
    };

    // ───── jalan satu giliran
    const handle = (r, { replace = false } = {}) => {
      if (r.sessionId) st.sid = r.sessionId;
      const item = { role: 'guide', r };
      if (replace && last()?.role === 'guide') st.items[st.items.length - 1] = item; else st.items.push(item);
      render(); toEnd();
      clearTimeout(st.timer);
      if (r.kind === 'progress') st.timer = setTimeout(poll, 2500);
    };
    const poll = async () => {
      if (st.busy || !root.isConnected) return;
      const r = await call('POST', '/api/pemandu/turn', { sessionId: st.sid, choiceId: 'poll' });
      if (!r) { st.timer = setTimeout(poll, 5000); return; }   // sambungan sebentar putus: coba lagi diam-diam
      if (last()?.r?.kind === 'progress') handle(r, { replace: true }); else handle(r);
    };
    const send = async ({ choiceId, input: text, label, ref }) => {
      if (st.busy) return;
      clearTimeout(st.timer);
      const shown = label || text;
      if (shown && !['poll', 'back'].includes(choiceId)) st.items.push({ role: 'me', text: shown });
      st.busy = true; $('#pmGo').disabled = true;
      render();
      const r = await call('POST', '/api/pemandu/turn', { sessionId: st.sid, choiceId, input: text || ref || undefined });
      st.busy = false; $('#pmGo').disabled = false;
      if (choiceId === 'back' && r) { st.items.splice(-2); handle(r, { replace: true }); return; }   // kembali: percakapan ikut mundur satu langkah
      handle(r || FAIL);
      if (choiceId === 'use' && r?.copy) navigator.clipboard?.writeText(r.copy).then(() => toast('Teks sudah disalin. Tinggal tempel di mana kamu mau.', 'ok')).catch(() => {});
    };
    const starters = () => (st.home?.cards || STARTERS).filter((c) => c.id.startsWith('intent:')).slice(0, 4).map((c) => ({ id: c.id, label: c.label }));
    const say = (r) => { st.items.push({ role: 'guide', r: { quota: st.home?.quota, ...r } }); render(); toEnd(); };
    const sendOnboard = async (v) => {
      st.items.push({ role: 'me', text: v }); st.mode = ''; render();
      const r = await call('POST', '/api/pemandu/onboard', { input: v });
      if (!r) return say({ kind: 'error', say: 'Aku belum bisa membaca itu. Coba tulis satu kalimat tentang usahamu.', options: [{ id: 'local:onb', label: 'Coba lagi' }, { id: 'local:skip', label: 'Lewati dulu' }] });
      st.home.profile = { ...r.profile, known: true }; st.home.onboarding = false;
      say({ kind: 'choices', say: r.say, profile: r.profile, options: [{ id: 'local:ok', label: 'Betul', recommended: true }, { id: 'local:edit', label: 'Ubah' }] });
    };
    const local = (id) => {
      if (id === 'local:ok') say({ kind: 'choices', say: 'Sip, sudah kucatat. Mau dibantu apa?', options: starters() });
      else if (id === 'local:edit') this.editProfile();
      else if (id === 'local:onb') { st.mode = 'onboard'; input.placeholder = 'Alamat situs atau satu kalimat…'; render(); input.focus(); }
      else if (id === 'local:skip') { call('POST', '/api/pemandu/onboard', { skip: true }); st.home.onboarding = false; st.mode = ''; if (st.items.length) say({ kind: 'choices', say: 'Tidak apa-apa. Mau dibantu apa?', options: starters() }); else render(); }
    };

    // ───── interaksi
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t || !root.contains(t) || st.busy) return;
      const cid = t.dataset.cid;
      if (cid?.startsWith('local:')) return local(cid);
      if (cid) return send({ choiceId: cid, label: t.dataset.label });
      if (t.dataset.card) return send({ choiceId: `card:${t.dataset.card}`, label: t.dataset.label, ref: t.dataset.ref });
      if (t.dataset.other) { const q = last()?.r; if (q?.ask) return send({ choiceId: 'other', label: 'Lainnya' }); input.focus(); return; }
      if (t.dataset.copy) { const txt = [...st.items].reverse().find((m) => m.r?.result)?.r.result.text || ''; navigator.clipboard?.writeText(txt).then(() => toast('Teks sudah disalin.', 'ok')).catch(() => {}); return; }
      if (t.dataset.keep) { const l = last(); if (l?.r) { l.r = { ...l.r, learned: null }; render(); } return; }
      if (t.dataset.profile) return this.editProfile();
      if (t.dataset.onb) return local('local:onb');
      if (t.dataset.onbSkip) return local('local:skip');
    });
    const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };
    $('#pmForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return input.focus();
      input.value = ''; autosize();
      if (st.mode === 'onboard') { input.placeholder = 'Tulis atau ucapkan…'; return sendOnboard(v); }
      send({ input: st.untuk && !st.items.length ? `Minta ${st.untuk.name} untuk ${v}` : v });
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#pmForm').requestSubmit(); } });
    input.addEventListener('input', autosize);

    // ───── suara (Web Speech API, hanya bila peramban mendukung)
    const mic = $('#pmMic');
    if (mic && Rec) {
      mic.onclick = () => {
        if (st.rec) { st.rec.stop(); return; }
        const rec = new Rec(); rec.lang = 'id-ID'; rec.interimResults = true; rec.continuous = false;
        rec.onresult = (ev) => { let fin = '', tmp = ''; for (const r of ev.results) (r.isFinal ? (fin += r[0].transcript) : (tmp += r[0].transcript)); input.value = (fin + tmp).trim(); autosize(); };
        rec.onerror = () => toast('Suara belum terdengar. Coba lagi atau ketik saja.', '');
        rec.onend = () => { st.rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('live'); input.focus(); };
        st.rec = rec; mic.setAttribute('aria-pressed', 'true'); mic.classList.add('live');
        try { rec.start(); } catch { st.rec = null; }
      };
    }

    this.root = root; this.render = render;
    renderHome();
    // "Beri pekerjaan" dari Tim Saya (untuk) atau permintaan dari pencarian dan Pengaturan (mulai): tetap sebagai percakapan biasa
    const untuk = S.params?.untuk ? emp(S.params.untuk) : null; const mulai = S.params?.mulai || '';
    st.untuk = untuk;
    if (untuk) {
      input.placeholder = `Apa yang mau dikerjakan ${untuk.name}?`;
      $('#pmUntuk').innerHTML = `<div class="pm-untuk" role="status">${icon('user', 18)}<span>Pekerjaan ini untuk <b>${esc(untuk.name)}</b></span><button type="button" class="btn sm ghost" id="untukX" aria-label="Batal memilih ${esc(untuk.name)}">${icon('close', 16)} Batal</button></div>`;
      $('#untukX').onclick = () => { st.untuk = null; $('#pmUntuk').innerHTML = ''; input.placeholder = 'Tulis atau ucapkan…'; input.focus({ preventScroll: true }); };
    }
    call('GET', '/api/pemandu/home').then((h) => {
      st.home = h || { say: 'Halo!', sub: 'Aku Pemandu. Ceritakan yang kamu butuhkan.', cards: STARTERS, profile: { items: [] } };
      render();
      if (mulai) setTimeout(() => send({ input: mulai }), 0);
    });
  },

  /** "Yang aku tahu tentang kamu": bisa dibaca dan diubah */
  async editProfile() {
    const p = await call('GET', '/api/pemandu/profile'); if (!p) return toast('Belum bisa dibuka. Coba lagi sebentar.', '');
    const val = Object.fromEntries(p.items.map((i) => [i.key, i.value]));
    modal('Yang aku tahu tentang kamu', `<p class="small muted">Boleh diubah kapan saja. Kosongkan kalau mau dihapus.</p>${(p.extras || []).length ? `<h4>Yang kupelajari dari kita bekerja bersama</h4><ul class="pm-extra">${p.extras.map((x) => `<li><span>${esc(x.teks)}</span><button class="btn sm ghost" data-del-extra="${x.nomor}">Hapus</button></li>`).join('')}</ul>` : ''}<div class="pm-form">${p.fields.map((f) => `<label class="f" for="pf-${f.key}">${esc(f.label)}</label><input class="input" id="pf-${f.key}" name="${f.key}" value="${esc(val[f.key] || '')}">`).join('')}</div>`, {
      onMount: (el, close) => el.querySelectorAll('[data-del-extra]').forEach((b) => (b.onclick = async () => { b.disabled = true; await call('DELETE', `/api/belajar/profil/${b.dataset.delExtra}`); close(); this.editProfile(); })),
      actions: [{ label: 'Batal' }, { label: 'Simpan', kind: 'primary', run: async () => {
        const items = Object.fromEntries(p.fields.map((f) => [f.key, document.getElementById(`pf-${f.key}`)?.value || '']));
        const r = await call('PUT', '/api/pemandu/profile', { items, replace: true });
        if (r) { if (this.st.home) this.st.home.profile = r; this.render?.(); toast('Sudah kuingat.', 'ok'); }
      } }],
    });
  },

  unmount() { clearTimeout(this.st?.timer); try { this.st?.rec?.stop(); } catch { /* sudah berhenti */ } },
  update() { /* percakapan diperbarui lewat polling kecil milik sendiri */ },
};
