// Tim Saya: tampilan orang, bukan struktur teknis. Asisten kamu, satu baris per divisi dengan penanggung jawabnya, lalu kartu staf.
// Memakai data yang sudah ada (employees, divisions, status, statusText). Medan baru P1 (role, staffId, workflowId) dipakai bila ada.
import { S, esc, navigate, avatar, div } from './core.js';
import { icon } from './icons.js';
import { awam, statusOrang, peranOrang, kosong } from './awam.js';
import { scan } from './kamus-ui.js';

const D = () => S.data;
const ikonStatus = { bekerja: 'bolt', menunggu: 'clock', selesai: 'check', kendala: 'alert', tidak: 'pause' };

/** teks status apa adanya; dibuang bila memuat istilah teknis */
const kalimatStatus = (e, st) => {
  const t = String(e.statusText || '').replace(/\s+/g, ' ').trim();
  return t && t.length < 80 && scan(t).length === 0 && st.id === 'bekerja' ? t : '';
};

export function kartuOrang(e, tasks, { besar = false } = {}) {
  const st = statusOrang(e, tasks);
  const ket = kalimatStatus(e, st);
  const nama = esc(e.name);
  return `<article class="orang ${besar ? 'besar' : ''}" data-id="${esc(e.id)}" aria-label="${nama}, ${esc(st.kata)}">
    <div class="orang-h">${avatar(e, besar ? 'lg' : '')}<div class="orang-n"><b>${nama}</b><span>${esc(peranOrang(e))}</span></div></div>
    <p class="orang-s st-${st.id}">${icon(ikonStatus[st.id] || 'dot', 16)}<span>${esc(st.kata)}${ket ? ` <small>${esc(ket)}</small>` : ''}</span></p>
    <button type="button" class="btn orang-b" data-kasih="${esc(e.id)}" aria-label="Beri pekerjaan ke ${nama}">${icon('plus', 18)} Beri pekerjaan</button>
  </article>`;
}

export const TimView = {
  mount(root) {
    this.q = this.q || '';
    root.innerHTML = `<div class="page tim">
      <header class="page-head"><h2>Tim saya</h2><p class="muted">Orang-orang yang membantumu. Pilih satu untuk memberi pekerjaan, Pemandu yang menemani.</p></header>
      <div class="tim-cari"><label class="sr-only" for="timQ">Cari orang atau divisi</label><input id="timQ" class="input" type="search" placeholder="Cari nama atau bagian…" value="${esc(this.q)}" autocomplete="off"></div>
      <div id="timBody"></div></div>`;
    root.querySelector('#timQ').oninput = (e) => { this.q = e.target.value; this.update(new Set(['employees'])); };
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-kasih]');
      if (b) navigate('dashboard', { untuk: b.dataset.kasih });
    });
    this.root = root; this.draw();
  },
  update(colls) { if (!colls || colls.has('*') || colls.has('employees') || colls.has('tasks') || colls.has('divisions') || colls.has('tick')) this.draw(); },
  draw() {
    const box = this.root?.querySelector('#timBody'); if (!box) return;
    const open = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.div));
    const d = D(); const q = this.q.toLowerCase().trim();
    const ok = (e) => !q || `${e.name} ${e.title || ''} ${div(e.divisionId)?.name || ''}`.toLowerCase().includes(q);
    const ai = d.employees.filter((e) => e.type === 'ai' && e.status !== undefined);
    const asisten = ai.filter((e) => (e.isPA && (e.ownerId === S.me || !d.employees.some((x) => x.isPA && x.ownerId === S.me))) || e.isMaster || e.role === 'pa' || e.role === 'master').filter(ok);
    const idAsisten = new Set(asisten.map((e) => e.id));
    let html = asisten.length ? `<section class="tim-asisten" aria-labelledby="timA"><h3 id="timA">Asisten kamu</h3><div class="orang-grid">${asisten.map((e) => kartuOrang(e, d.tasks, { besar: true })).join('')}</div></section>` : '';
    let n = 0;
    for (const dv of d.divisions) {
      const semua = ai.filter((e) => e.divisionId === dv.id && !idAsisten.has(e.id));
      if (!semua.length) continue;
      const mgr = semua.find((e) => e.isLead || e.role === 'manager');
      const staf = semua.filter((e) => e !== mgr);
      const cocok = !q || (mgr && ok(mgr)) || staf.some(ok) || dv.name.toLowerCase().includes(q);
      if (!cocok) continue;
      n++;
      const aktif = semua.filter((e) => statusOrang(e, d.tasks).id === 'bekerja').length;
      const tampil = q ? staf.filter((e) => ok(e) || dv.name.toLowerCase().includes(q)) : staf;
      html += `<details class="divisi" data-div="${esc(dv.id)}" ${open.has(dv.id) || q ? 'open' : ''}>
        <summary><span class="divisi-t"><i class="titik" style="background:${esc(dv.color || '#7fb3ff')}" aria-hidden="true"></i><b>${esc(awam(dv.name))}</b></span>
          <span class="divisi-m">${mgr ? `Penanggung jawab: ${esc(mgr.name)}` : ''}</span><span class="divisi-c">${aktif ? `${aktif} sedang bekerja · ` : ''}${semua.length} orang</span></summary>
        <div class="divisi-b">${mgr ? `<div class="orang-grid mgr">${kartuOrang(mgr, d.tasks)}</div>` : ''}${tampil.length ? `<div class="orang-grid">${tampil.map((e) => kartuOrang(e, d.tasks)).join('')}</div>` : ''}</div></details>`;
    }
    if (!n && !asisten.length) html = kosong('Belum ada yang cocok', 'Coba kata lain, atau hapus pencarian untuk melihat semua orang.');
    box.innerHTML = html;
  },
};
