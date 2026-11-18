// Pemandu: Beranda sebagai percakapan yang dipimpin tombol pilihan. Satu antarmuka untuk semua orang (tanpa mode).
// Server: server/pemandu.js (POST /api/pemandu/turn). Rancangan: docs/PEMANDU-ALUR-AWAM.md. Kamus bahasa: server/kamus.js.
import { esc, modal, toast, loginGate } from './core.js';
import { icon } from './icons.js';
import { md } from './md.js';

const STEPS = ['Ceritakan', 'Pilih', 'Dikerjakan', 'Hasil'];
/** satu pintu ke server; mengembalikan null bila gagal sehingga layar tidak pernah kosong atau menampilkan kode galat */
async function call(method, url, body) {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.login) { loginGate(data); return null; }
    return res.ok ? data : null;
  } catch { return null; }
}
const FAIL = { kind: 'error', say: 'Sepertinya sambungan sedang terputus, jadi aku belum bisa melanjutkan. Mau coba lagi?', options: [{ id: 'poll', label: 'Coba lagi', recommended: true }, { id: 'new', label: 'Mulai dari awal' }], step: { now: 1, of: 4 } };

export const PemanduView = {
  mount(root) {
    const st = { sid: '',   // percakapan baru setiap Beranda dibuka; yang belum selesai muncul sebagai kartu "Lanjutkan yang tadi"
      msgs: [], cur: null, busy: false, timer: null, home: null, last: null, rec: null };
    this.st = st;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    root.innerHTML = `<div class="page pemandu">
      <div id="pmTop" class="pm-top"></div>
      <div id="pmHome" class="pm-home"></div>
      <div id="pmThread" class="pm-thread" aria-live="polite"></div>
      <div id="pmStage" class="pm-stage"></div>
      <form id="pmForm" class="pm-compose" autocomplete="off">
        <label class="sr-only" for="pmIn">Tulis atau ucapkan yang kamu butuhkan</label>
        <textarea id="pmIn" class="input" rows="1" placeholder="Tulis atau ucapkan…" enterkeyhint="send"></textarea>
        ${Rec ? `<button type="button" class="btn icon pm-mic" id="pmMic" aria-pressed="false" aria-label="Bicara" title="Bicara">${icon('mic', 22)}</button>` : ''}
        <button type="submit" class="btn primary pm-send" id="pmGo">${icon('arrow', 20)}<span>Kirim</span></button>
      </form>
    </div>`;
    const $ = (q) => root.querySelector(q);
    const input = $('#pmIn');
    const scrollDown = () => requestAnimationFrame(() => $('#pmForm').scrollIntoView({ block: 'end', behavior: 'smooth' }));

    // ───── bagian atas: penunjuk langkah dan sisa jatah
    const renderTop = () => {
      const r = st.cur; const now = st.msgs.length && r ? r.step?.now || 1 : 0;
      const q = r?.quota || st.home?.quota;
      $('#pmTop').innerHTML = `${now ? `<ol class="pm-steps" aria-label="Langkah">${STEPS.map((s, i) => `<li class="${i + 1 < now ? 'done' : i + 1 === now ? 'on' : ''}" ${i + 1 === now ? 'aria-current="step"' : ''}><b>${i + 1 < now ? icon('check', 14) : i + 1}</b><span>${s}</span></li>`).join('')}</ol>` : ''}
        ${q ? `<div class="pm-quota" title="Sisa jatah hari ini"><span>Sisa jatah hari ini: <b>${esc(q.word)}</b></span><span class="bar" role="img" aria-label="Sisa jatah ${q.pct} persen"><i style="width:${q.pct}%"></i></span></div>` : ''}`;
    };

    // ───── beranda awal
    const renderHome = () => {
      const h = st.home; const box = $('#pmHome');
      box.hidden = !!st.msgs.length;
      if (st.msgs.length) return;
      if (!h) { box.innerHTML = '<div class="pm-bubble guide">Sebentar ya, aku siapkan dulu…</div>'; return; }
      const items = h.profile?.items || [];
      box.innerHTML = `<div class="pm-hero"><h2>${esc(h.say)}</h2><p>${esc(h.sub)}</p></div>
        ${h.onboarding ? `<section class="card pm-onb" aria-labelledby="onbT"><div class="card-b">
          <h3 id="onbT">Kenalan dulu, cukup 30 detik</h3>
          <p>Tempel alamat situs usahamu, atau tulis satu kalimat tentang kebutuhanmu. Dengan begitu aku tidak perlu bertanya hal yang sama berulang-ulang.</p>
          <label class="sr-only" for="onbIn">Alamat situs atau satu kalimat tentang usahamu</label>
          <input id="onbIn" class="input" placeholder="Contoh: kedaikopi.id, atau “Aku jual kopi susu di Bandung”">
          <div class="pm-row"><button class="btn primary" id="onbGo">Lanjut</button><button class="btn ghost" id="onbSkip">Lewati dulu</button></div>
          <p class="pm-err" id="onbErr" hidden></p></div></section>` : ''}
        <div class="pm-cards" role="list">${h.cards.map((c) => `<button class="btn pm-start" role="listitem" data-cid="${esc(c.id)}" data-label="${esc(c.label)}">${icon(c.ikon || 'spark', 22)}<span><b>${esc(c.label)}</b>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</span></button>`).join('')}</div>
        ${items.length || (h.profile?.extras || []).length ? `<section class="card pm-know" aria-labelledby="knT"><div class="card-b"><div class="pm-row between"><h3 id="knT">Yang aku tahu tentang kamu</h3><button class="btn sm" id="knEdit">${icon('edit', 16)} Ubah</button></div>
          <ul>${items.slice(0, 5).map((i) => `<li><span>${esc(i.label)}</span> ${esc(i.value)}</li>`).join('')}${(h.profile?.extras || []).slice(0, 3).map((x) => `<li>${esc(x.teks)}</li>`).join('')}</ul></div></section>` : ''}`;
    };

    // ───── percakapan
    const bubble = (m) => `<div class="pm-bubble ${m.from}">${esc(m.text)}</div>`;
    const renderThread = () => { $('#pmThread').innerHTML = st.msgs.map(bubble).join(''); $('#pmThread').hidden = !st.msgs.length; };
    const say = (from, text) => { if (text) st.msgs.push({ from, text }); };

    const choiceBtn = (o, kind) => `<button class="btn pm-choice ${o.recommended ? 'rec' : ''}" data-cid="${esc(o.id)}" data-label="${esc(o.label)}">
        <span class="pm-ct"><b>${esc(o.label)}</b>${o.recommended ? '<em class="pm-tag">Disarankan</em>' : ''}</span>
        ${o.hint ? `<small>${esc(o.hint)}</small>` : ''}${kind === 'plan' ? `<small class="pm-meta">${icon('clock', 14)} ${esc(o.eta)} · ${esc(o.cost)}</small>` : ''}</button>`;
    const sideBtns = (r) => `<div class="pm-side">
        ${r.delegate ? `<button class="btn" data-cid="delegate" data-label="Serahkan ke kamu">${icon('spark', 18)} Serahkan ke kamu</button>` : ''}
        ${r.freeText && r.options?.length ? `<button class="btn" data-other="1">${icon('edit', 18)} Lainnya (ketik)</button>` : ''}
        ${r.undo ? `<button class="btn ghost" data-cid="back" data-label="Kembali">${icon('collapse', 18)} Kembali satu langkah</button>` : ''}</div>`;

    const renderStage = () => {
      const r = st.cur; const box = $('#pmStage');
      box.hidden = !st.msgs.length;
      if (!r) return (box.innerHTML = '');
      let html = '';
      if (r.learned) html += `<div class="pm-learn" role="status"><span>${esc(r.learned.text)}</span><button class="btn sm" data-keep="1">Betul</button><button class="btn sm ghost" data-profile="1">Ubah</button></div>`;
      if (r.kind === 'confirm' && r.preview?.length) html += `<section class="card pm-preview"><div class="card-b"><h3>Sebelum mulai, ini yang akan kukerjakan</h3><dl>${r.preview.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl></div></section>`;
      if (r.kind === 'progress') html += `<section class="card pm-progress" role="status"><div class="card-b"><div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress?.pct || 0}"><i style="width:${r.progress?.pct || 5}%"></i></div><p>${esc(r.progress?.text || 'Mulai dikerjakan')}</p></div></section>`;
      if (r.result) html += `<section class="card pm-result"><div class="card-h">${icon('doc', 16)} ${esc(r.result.title || 'Hasil')}${r.result.revision ? ` · versi ${r.result.revision + 1}` : ''}</div><div class="card-b md">${md(r.result.text || 'Belum ada isinya.')}</div>
          ${r.result.gaps ? `<div class="card-b small">Yang belum terpenuhi: ${esc(r.result.gaps)}</div>` : ''}<div class="card-b"><button class="btn sm" data-copy-result="1">${icon('doc', 16)} Salin teks</button></div></section>`;
      if (r.kind === 'done' && st.last && !r.result) html += `<details class="pm-again"><summary>Lihat hasilnya lagi</summary><div class="md">${md(st.last.text || '')}</div></details>`;
      if (r.saved) html += `<p class="pm-saved" role="status">${icon('check', 16)} Tersimpan di Catatan: <b>${esc(r.saved.title)}</b></p>`;
      const opts = r.options || [];
      const big = ['choices', 'plan', 'confirm', 'error', 'done'].includes(r.kind) ? opts : [];
      const shown = r.kind === 'result' ? opts : big;
      if (shown.length) html += `<div class="pm-opts ${r.kind === 'result' ? 'quad' : ''}" role="group" aria-label="Pilihan">${shown.map((o) => choiceBtn(o, r.kind)).join('')}</div>`;
      if (r.kind === 'progress') html += `<div class="pm-side">${opts.map((o) => `<button class="btn" data-cid="${esc(o.id)}" data-label="${esc(o.label)}">${esc(o.label)}</button>`).join('')}</div>`;
      if (['choices', 'plan'].includes(r.kind)) html += sideBtns(r);
      else if (r.undo && r.kind !== 'progress') html += `<div class="pm-side"><button class="btn ghost" data-cid="back" data-label="Kembali">${icon('collapse', 18)} Kembali satu langkah</button></div>`;
      for (const c of r.cards || []) html += `<section class="card pm-card"><div class="card-b"><h3>${esc(c.say)}</h3>${c.detail ? `<p>${esc(c.detail)}</p>` : ''}<div class="pm-opts">${c.options.map((o) => `<button class="btn pm-choice ${o.recommended ? 'rec' : ''}" data-card="${esc(c.type)}:${esc(o.id)}" data-ref="${esc(c.ref || '')}" data-label="${esc(o.label)}"><span class="pm-ct"><b>${esc(o.label)}</b></span></button>`).join('')}</div></div></section>`;
      box.innerHTML = html;
    };
    const paint = (focus) => {
      renderTop(); renderHome(); renderThread(); renderStage();
      if (focus) { const f = $('#pmStage .pm-choice'); if (f) f.focus({ preventScroll: true }); else if (st.cur?.freeText) input.focus({ preventScroll: true }); scrollDown(); }
    };

    // ───── jalan satu giliran
    const handle = (r, { announce = true } = {}) => {
      st.cur = r;
      if (r.sessionId) st.sid = r.sessionId;
      if (r.result) st.last = r.result;
      if (announce) { for (const n of r.notes || []) say('guide', n); say('guide', r.say); }
      paint(announce);
      clearTimeout(st.timer);
      if (r.kind === 'progress') st.timer = setTimeout(poll, 2500);
    };
    const poll = async () => {
      if (st.busy || !root.isConnected) return;
      const r = (await call('POST', '/api/pemandu/turn', { sessionId: st.sid, choiceId: 'poll' })) || null;
      if (!r) { st.timer = setTimeout(poll, 5000); return; }   // sambungan sebentar putus: coba lagi diam-diam
      if (r.kind === 'progress') { st.cur = r; renderTop(); renderStage(); st.timer = setTimeout(poll, 2500); } else handle(r);
    };
    const send = async ({ choiceId, input: text, label, ref }) => {
      if (st.busy) return;
      clearTimeout(st.timer);
      const shown = label || text;
      if (shown && !['poll', 'back'].includes(choiceId)) say('me', shown);
      st.busy = true; $('#pmGo').disabled = true; $('#pmStage').setAttribute('aria-busy', 'true');
      const r = await call('POST', '/api/pemandu/turn', { sessionId: st.sid, choiceId, input: text || ref || undefined });
      st.busy = false; $('#pmGo').disabled = false; $('#pmStage').removeAttribute('aria-busy');
      if (choiceId === 'back' && r) { st.msgs.splice(-2); handle(r, { announce: false }); return; }   // kembali: percakapan ikut mundur satu langkah
      handle(r || FAIL);
      if (choiceId === 'use' && r?.copy) navigator.clipboard?.writeText(r.copy).then(() => toast('Teks sudah disalin. Tinggal tempel di mana kamu mau.', 'ok')).catch(() => {});
    };
    st.send = send;

    // ───── interaksi
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
      if (t.dataset.cid) {
        const reset = t.dataset.cid.startsWith('intent:') || t.dataset.cid.startsWith('resume:');
        if (reset && !st.msgs.length) st.cur = null;
        return send({ choiceId: t.dataset.cid, label: t.dataset.label });
      }
      if (t.dataset.card) return send({ choiceId: `card:${t.dataset.card}`, label: t.dataset.label, ref: t.dataset.ref });
      if (t.dataset.other) { const q = st.cur; if (q?.ask) return send({ choiceId: 'other', label: 'Lainnya' }); input.focus(); return; }
      if (t.dataset.copyResult) { navigator.clipboard?.writeText(st.cur?.result?.text || '').then(() => toast('Teks sudah disalin.', 'ok')).catch(() => {}); return; }
      if (t.dataset.keep && st.cur) { st.cur = { ...st.cur, learned: null }; renderStage(); return; }
      if (t.dataset.profile) { this.editProfile(); return; }
      if (t.id === 'knEdit') return this.editProfile();
      if (t.id === 'onbSkip') { call('POST', '/api/pemandu/onboard', { skip: true }); st.home.onboarding = false; renderHome(); return; }
      if (t.id === 'onbGo') return this.onboard(root);
    });
    $('#pmForm').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return input.focus(); input.value = ''; autosize(); send({ input: v }); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#pmForm').requestSubmit(); } });
    const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };
    input.addEventListener('input', autosize);

    // ───── suara (Web Speech API, hanya bila peramban mendukung)
    const mic = $('#pmMic');
    if (mic && Rec) {
      mic.onclick = () => {
        if (st.rec) { st.rec.stop(); return; }
        const rec = new Rec(); rec.lang = 'id-ID'; rec.interimResults = true; rec.continuous = false;
        let final = '';
        rec.onresult = (ev) => { final = ''; let tmp = ''; for (const r of ev.results) (r.isFinal ? (final += r[0].transcript) : (tmp += r[0].transcript)); input.value = (final + tmp).trim(); autosize(); };
        rec.onerror = () => { toast('Suara belum terdengar. Coba lagi atau ketik saja.', ''); };
        rec.onend = () => { st.rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('live'); input.focus(); };
        st.rec = rec; mic.setAttribute('aria-pressed', 'true'); mic.classList.add('live');
        try { rec.start(); } catch { st.rec = null; }
      };
    }

    this.root = root; this.paint = paint; this.st = st;
    // beranda dimuat dari server (sapaan, kartu awal, profil, jatah)
    renderHome();
    call('GET', '/api/pemandu/home').then((h) => { st.home = h || { say: 'Halo!', sub: 'Aku Pemandu. Ceritakan yang kamu butuhkan.', cards: [{ id: 'intent:konten', label: 'Bantu aku membuat konten', ikon: 'edit' }, { id: 'intent:riset', label: 'Cari tahu soal sesuatu', ikon: 'search' }, { id: 'intent:rencana', label: 'Atur rencana usahaku', ikon: 'goal' }, { id: 'intent:pesan', label: 'Tuliskan sebuah pesan', ikon: 'chat' }], profile: { items: [] } }; paint(); });
  },

  async onboard(root) {
    const v = root.querySelector('#onbIn').value.trim(); const err = root.querySelector('#onbErr'); const btn = root.querySelector('#onbGo');
    if (!v) { err.hidden = false; err.textContent = 'Tulis satu kalimat dulu, atau tempel alamat situsnya.'; return root.querySelector('#onbIn').focus(); }
    btn.disabled = true; btn.textContent = 'Sebentar…'; err.hidden = true;
    const r = await call('POST', '/api/pemandu/onboard', { input: v });
    btn.disabled = false; btn.textContent = 'Lanjut';
    if (!r) { err.hidden = false; err.textContent = 'Aku belum bisa membaca itu. Coba tulis satu kalimat tentang usahamu.'; return; }
    this.st.home.profile = r.profile; this.st.home.onboarding = false;
    this.paint();
    toast(r.say, 'ok');
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
        if (r) { if (this.st.home) this.st.home.profile = r; this.paint?.(); toast('Sudah kuingat.', 'ok'); }
      } }],
    });
  },

  unmount() { clearTimeout(this.st?.timer); try { this.st?.rec?.stop(); } catch { /* sudah berhenti */ } },
  update() { /* percakapan diperbarui lewat polling kecil milik sendiri */ },
};
