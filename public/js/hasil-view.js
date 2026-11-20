// Hasil Saya: satu daftar jelas (Perlu kamu, Sedang dikerjakan, Selesai). Tiap kartu menunjukkan judul awam, siapa yang mengerjakan,
// status, dan hasilnya: teks, berkas, data atau baris tabel. Tombol sama dengan kartu hasil Pemandu: Pakai ini, Ubah sedikit, Ulangi, Simpan.
// Wadah hasil (renderHasil) tidak bergantung pada bentuk tertentu: menerima potongan {jenis:'teks'|'berkas'|'data'} dari mana pun.
import { S, api, esc, emp, ago, avatar, navigate, toast, modal, formData } from './core.js';
import { icon } from './icons.js';
import { md } from './md.js';
import { awam, kelompokTugas, STATUS_KARTU, KATA_STATUS_TUGAS, unduh, kosong, memuat } from './awam.js';

const D = () => S.data;
const RUN_STATUS = { jalan: 'jalan', menunggu: 'jalan', butuh_izin: 'perlu', gagal: 'perlu', ditolak: 'selesai', selesai: 'selesai' };
const RUN_KATA = { jalan: 'Sedang dikerjakan', menunggu: 'Sedang dikerjakan', butuh_izin: 'Menunggu izinmu', gagal: 'Ada kendala', ditolak: 'Tidak dijalankan', selesai: 'Selesai' };
const MIME = { csv: 'text/csv', md: 'text/markdown', txt: 'text/plain', json: 'application/json', html: 'text/html' };
const UBAH = [['singkat', 'Lebih singkat'], ['santai', 'Lebih santai'], ['resmi', 'Lebih resmi'], ['lengkap', 'Lebih lengkap']];
const ikonKelompok = { perlu: 'alert', jalan: 'clock', selesai: 'check' };

// ───── wadah hasil: potongan apa pun → tampilan
/** buang tanda markdown mentah (**tebal**, # judul, `kode`) dari judul dan ringkasan supaya terbaca bersih */
const bersih = (s) => String(s ?? '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
const sel = (v) => (v == null ? '' : typeof v === 'object' ? esc(JSON.stringify(v)) : esc(String(v)));
function tabelBaris(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r || {})))].slice(0, 8);
  return `<div class="tabel-geser" tabindex="0" role="region" aria-label="Tabel hasil"><table><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 50).map((r) => `<tr>${cols.map((c) => `<td>${sel(r?.[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > 50 ? `<p class="small muted">Menampilkan 50 dari ${rows.length} baris.</p>` : ''}`;
}
function tampilData(data) {
  if (data == null || data === '') return '';
  const rows = Array.isArray(data) ? data : Array.isArray(data.baris) ? data.baris : Array.isArray(data.rows) ? data.rows : null;
  if (rows && rows.length && rows.every((r) => r && typeof r === 'object')) return tabelBaris(rows);
  if (typeof data !== 'object') return `<p>${esc(data)}</p>`;
  const link = [data.sheetUrl, data.url, data.tautan].find((u) => typeof u === 'string' && /^https:\/\//.test(u));
  const ent = Object.entries(data).filter(([k, v]) => v != null && !['sheetUrl', 'url', 'tautan'].includes(k));
  return `<dl class="data-kv">${ent.slice(0, 40).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${sel(v)}</dd></div>`).join('')}</dl>${link ? `<p><a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('link', 16)} Buka tabelnya</a></p>` : ''}`;
}
/** potongan: {jenis:'teks', teks} | {jenis:'berkas', berkas:[{nama,jenis,bytes,ambil?}]} | {jenis:'data', data} */
export function renderHasil(bagian) {
  const out = [];
  for (const b of bagian) {
    if (b.jenis === 'teks' && b.teks) out.push(`<div class="hasil-teks md">${md(String(b.teks).slice(0, 12000))}</div>`);
    if (b.jenis === 'berkas' && b.berkas?.length) out.push(`<ul class="hasil-berkas" aria-label="Berkas hasil">${b.berkas.map((f, i) => `<li><span class="fn">${icon('doc', 18)} <b>${esc(f.nama)}</b>${f.bytes ? ` <small>${Math.max(1, Math.round(f.bytes / 1024))} KB</small>` : ''}</span><span class="fa"><button type="button" class="btn sm" data-buka="${esc(b.id || '')}" data-i="${i}" aria-label="Buka ${esc(f.nama)}">${icon('eye', 16)} Buka</button><button type="button" class="btn sm" data-unduh="${esc(b.id || '')}" data-i="${i}" aria-label="Unduh ${esc(f.nama)}">${icon('download', 16)} Unduh</button></span></li>`).join('')}</ul>`);
    if (b.jenis === 'data') { const t = tampilData(b.data); if (t) out.push(`<div class="hasil-data">${t}</div>`); }
  }
  return out.join('') || '<p class="muted">Belum ada isi yang bisa ditampilkan.</p>';
}

// ───── bahan: pekerjaan dan jalan staf → kartu
function bahan() {
  const d = D(); const pend = d.approvals.filter((a) => a.status === 'pending' && (a.approverId === S.me || a.approverId === 'owner' || S.me === 'owner'));
  const pendIds = new Set(pend.map((a) => a.taskId));
  const kartu = [];
  const runs = HasilView.runs || [];
  const dipakai = new Set();
  for (const t of d.tasks) {
    if (t.parentId || t.kind === 'routine' || t.status === 'cancelled') continue;
    const kids = d.tasks.filter((c) => c.parentId === t.id);
    const mine = runs.filter((r) => (t.evidence || []).some((x) => String(x.text || '').includes(r.id)));
    mine.forEach((r) => dipakai.add(r.id));
    const bagian = [{ jenis: 'teks', teks: t.output || t.summary || '' }, ...mine.flatMap((r) => [r.teks && r.teks !== t.output ? { jenis: 'teks', teks: r.teks } : null, r.berkas?.length ? { jenis: 'berkas', id: r.id, berkas: r.berkas } : null, r.data ? { jenis: 'data', data: r.data } : null].filter(Boolean))];
    kartu.push({ id: t.id, tipe: 'tugas', t, judul: t.title, oleh: emp(t.assigneeId), grup: kelompokTugas(t, pendIds), kata: t.status === 'in_progress' && (t.failures || 0) === 0 ? KATA_STATUS_TUGAS.in_progress : (t.failures || 0) > 0 && t.status !== 'done' ? 'Ada kendala' : KATA_STATUS_TUGAS[t.status] || '', ringkas: t.summary || '', bagian, waktu: t.completedAt || t.updatedAt, langkah: kids.length ? [kids.filter((k) => k.status === 'done').length, kids.length] : null, apv: pend.find((a) => a.taskId === t.id) });
  }
  for (const r of runs) {
    if (dipakai.has(r.id)) continue;
    kartu.push({ id: r.id, tipe: 'jalan', r, judul: r.staf?.nama || 'Pekerjaan', oleh: emp(r.karyawan), grup: RUN_STATUS[r.status] || 'jalan', kata: RUN_KATA[r.status] || '', ringkas: r.ringkas || r.pesan || r.galat || '', bagian: [{ jenis: 'teks', teks: r.teks }, r.berkas?.length ? { jenis: 'berkas', id: r.id, berkas: r.berkas } : null, r.data ? { jenis: 'data', data: r.data } : null].filter(Boolean), waktu: r.selesai || r.mulai });
  }
  // konfirmasi non-ulasan yang belum terkait pekerjaan terbuka
  const loose = pend.filter((a) => a.kind !== 'review' && !d.tasks.some((t) => t.id === a.taskId && !t.parentId));
  for (const a of loose) kartu.push({ id: a.id, tipe: 'boleh', a, judul: a.title, oleh: emp(a.requesterId), grup: 'perlu', kata: 'Menunggu izinmu', ringkas: a.summary || '', bagian: [], waktu: a.createdAt });
  return kartu;
}

const chip = (grup, kata) => `<span class="chip st-${grup}">${icon(ikonKelompok[grup] || 'dot', 14)} ${esc(kata)}</span>`;

function kartuHtml(k, bukaId, pilih) {
  const open = bukaId === k.id;
  const apv = k.apv || (k.tipe === 'boleh' ? k.a : null);
  const aksi = [];
  if (apv && k.tipe === 'boleh') aksi.push(`<button type="button" class="btn primary" data-ya="${esc(apv.id)}">Boleh</button><button type="button" class="btn" data-tidak="${esc(apv.id)}">Jangan dulu</button>`);
  else if (apv) aksi.push(`<button type="button" class="btn primary" data-pakai="${esc(apv.id)}">Pakai ini</button><button type="button" class="btn" data-ubah="${esc(k.id)}" data-apv="${esc(apv.id)}">Ubah sedikit</button>`);
  else if (k.tipe === 'tugas') aksi.push(`<button type="button" class="btn" data-ubah="${esc(k.id)}">Ubah sedikit</button><button type="button" class="btn" data-ulang="${esc(k.id)}">Ulangi</button><button type="button" class="btn" data-simpan="${esc(k.id)}">${k.t.noteId ? 'Buka di Catatan' : 'Simpan'}</button>`);
  const ada = (k.bagian || []).some((b) => (b.jenis === 'teks' && b.teks) || (b.jenis === 'berkas' && b.berkas?.length) || (b.jenis === 'data' && b.data));
  return `<article class="hasil-k g-${k.grup}" data-k="${esc(k.id)}">
    <header class="hasil-h">${pilih && k.tipe === 'tugas' ? `<label class="hasil-cek"><input type="checkbox" data-cek="${esc(k.id)}" ${pilih.ids.has(k.id) ? 'checked' : ''} aria-label="Pilih ${esc(bersih(awam(k.judul)).slice(0, 60))}"></label>` : ''}${k.oleh ? avatar(k.oleh) : ''}<div class="hasil-t"><h4>${esc(bersih(awam(k.judul)).slice(0, 90))}</h4><p class="small muted">${k.oleh ? `Dikerjakan ${esc(k.oleh.name)}` : 'Dikerjakan timmu'}${k.waktu ? ` · ${esc(ago(k.waktu))}` : ''}${k.langkah ? ` · ${k.langkah[0]} dari ${k.langkah[1]} langkah` : ''}</p></div>${chip(k.grup, k.kata)}</header>
    ${k.ringkas && !open ? `<p class="hasil-r">${esc(bersih(awam(k.ringkas)).slice(0, 160))}</p>` : ''}
    ${k.tipe === 'boleh' && k.ringkas ? `<div class="hasil-pratinjau"><b>Yang akan terjadi</b><p>${esc(bersih(awam(k.ringkas)))}</p></div>` : ''}
    ${open && ada ? `<div class="hasil-isi">${renderHasil(k.bagian)}</div>` : ''}
    <div class="hasil-a">${ada ? `<button type="button" class="btn" data-lihat="${esc(k.id)}" aria-expanded="${open}">${icon('eye', 18)} ${open ? 'Tutup hasil' : 'Lihat hasil'}</button>` : ''}${aksi.join('')}</div>
  </article>`;
}

export const HasilView = {
  runs: [],
  mount(root) {
    this.f = this.f || { q: '' }; this.pilih = { on: false, ids: new Set() }; this.buka = S.params?.buka || null; this.root = root;
    root.innerHTML = `<div class="page hasil">
      <header class="page-head"><h2>Hasil saya</h2><p class="muted">Semua pekerjaan timmu ada di sini: yang perlu kamu putuskan, yang sedang jalan, dan yang sudah jadi.</p></header>
      <div class="hasil-bar"><label class="sr-only" for="hq">Cari pekerjaan</label><input id="hq" class="input" type="search" placeholder="Cari pekerjaan…" value="${esc(this.f.q)}" autocomplete="off"><button type="button" class="btn primary" id="hbaru">${icon('plus', 18)} Mulai pekerjaan</button><button type="button" class="btn" id="hpilih" aria-pressed="false">${icon('check', 16)} Pilih</button></div>
      <div class="hasil-massal glass" id="hmassal" role="toolbar" aria-label="Aksi untuk hasil yang dipilih" hidden><b id="hn" aria-live="polite">0 dipilih</b><span style="flex:1"></span><button type="button" class="btn sm" data-m="semua">Pilih semua</button><button type="button" class="btn sm" data-m="simpan">${icon('doc', 14)} Simpan ke Catatan</button><button type="button" class="btn sm" data-m="hapus">${icon('close', 14)} Hapus</button><button type="button" class="btn sm ghost" data-m="batal">Batal</button></div>
      <div id="hbody">${memuat('Menyiapkan daftar hasilmu…')}</div>
      <aside id="hdetail" class="hasil-detail" aria-label="Isi hasil yang dipilih"></aside></div>`;
    root.querySelector('#hq').oninput = (e) => { this.f.q = e.target.value; this.draw(); };
    root.querySelector('#hbaru').onclick = () => navigate('dashboard');
    root.querySelector('#hpilih').onclick = () => this.modePilih(!this.pilih.on);
    root.addEventListener('change', (e) => { const c = e.target.closest?.('[data-cek]'); if (!c) return; if (c.checked) this.pilih.ids.add(c.dataset.cek); else this.pilih.ids.delete(c.dataset.cek); this.barMassal(); });
    root.addEventListener('click', (e) => this.klik(e));
    try { this._ro?.disconnect(); this._ro = new ResizeObserver(() => { if ((this.root?.clientWidth >= 640) !== this.lebar) this.draw(); }); this._ro.observe(root); } catch { /* tanpa ResizeObserver: tetap satu kolom */ }
    this.muatJalan().finally(() => this.draw());
    this.draw();
  },
  async muatJalan() {
    try { this.runs = (await fetch('/api/staff/runs?limit=30').then((r) => (r.ok ? r.json() : { jalan: [] }))).jalan || []; } catch { this.runs = []; }
  },
  update(colls) {
    if (!colls || colls.has('*') || colls.has('tasks') || colls.has('approvals') || colls.has('employees') || colls.has('tick')) { if (colls?.has('tick')) this.muatJalan().then(() => this.draw()); else this.draw(); }
  },
  draw() {
    const box = this.root?.querySelector('#hbody'); if (!box) return;
    this.lebar = this.root.clientWidth >= 640;
    this.root.querySelector('.page.hasil')?.classList.toggle('dua', this.lebar);
    const q = this.f.q.toLowerCase().trim();
    const semua = bahan().filter((k) => k.grup && (!q || `${k.judul} ${k.oleh?.name || ''} ${k.ringkas}`.toLowerCase().includes(q)));
    const urut = (a, b) => (b.waktu || 0) - (a.waktu || 0);
    if (!semua.length) { box.innerHTML = kosong(q ? 'Belum ada yang cocok' : 'Belum ada pekerjaan', q ? 'Coba kata lain.' : 'Mulai dari Obrolan: ceritakan yang kamu butuhkan, aray yang mengatur sisanya.', q ? '' : '<button type="button" class="btn primary" data-ke="dashboard">Mulai pekerjaan</button>'); return; }
    const scrollY = this.root.closest('#view')?.scrollTop;
    box.innerHTML = ['perlu', 'jalan', 'selesai'].map((g) => {
      const l = semua.filter((k) => k.grup === g).sort(urut).slice(0, g === 'selesai' ? 20 : 60);
      if (!l.length && g !== 'perlu') return '';
      return `<section class="hasil-g g-${g}" aria-labelledby="hg-${g}"><h3 id="hg-${g}">${icon(ikonKelompok[g], 20)} ${STATUS_KARTU[g]} <span class="badge soft">${semua.filter((k) => k.grup === g).length}</span></h3>${l.length ? l.map((k) => kartuHtml(k, this.lebar ? null : this.buka, this.pilih.on ? this.pilih : null)).join('') : '<p class="muted hasil-nol">Tidak ada yang menunggumu sekarang.</p>'}</section>`;
    }).join('');
    if (scrollY != null) this.root.closest('#view').scrollTop = scrollY;
    this.terlihat = semua.filter((k) => k.tipe === 'tugas').map((k) => k.id);
    // dua panel: kartu terpilih tampil utuh di kanan (isi hasil, Salin/Unduh/Simpan, aksi)
    const det = this.root.querySelector('#hdetail');
    if (det) {
      if (!this.lebar) det.innerHTML = '';
      else {
        const urut2 = [...semua].sort(urut); const sel = semua.find((k) => k.id === this.buka) || urut2[0];
        if (sel && !semua.some((k) => k.id === this.buka)) this.buka = sel.id;
        det.innerHTML = sel ? kartuHtml(sel, sel.id, null) : '<p class="muted">Belum ada hasil untuk ditampilkan.</p>';
        box.querySelectorAll('.hasil-k').forEach((a) => a.classList.toggle('aktif', a.dataset.k === sel?.id));
      }
    }
    this.barMassal();
  },
  /** mode Pilih: kotak centang per kartu tugas, bilah aksi kecil (Pilih semua, Simpan ke Catatan, Hapus, Batal) */
  modePilih(on) {
    this.pilih.on = !!on; if (!on) this.pilih.ids.clear();
    const t = this.root?.querySelector('#hpilih'); if (t) { t.setAttribute('aria-pressed', String(!!on)); t.classList.toggle('on', !!on); }
    this.draw();
  },
  barMassal() {
    const bar = this.root?.querySelector('#hmassal'); if (!bar) return;
    bar.hidden = !this.pilih.on; const n = this.pilih.ids.size;
    const hn = bar.querySelector('#hn'); if (hn) hn.textContent = n + ' dipilih';
    for (const b of bar.querySelectorAll('[data-m="simpan"],[data-m="hapus"]')) b.disabled = !n;
  },
  async massal(aksi) {
    const ids = [...this.pilih.ids];
    if (aksi === 'batal') return this.modePilih(false);
    if (aksi === 'semua') { for (const id of this.terlihat || []) this.pilih.ids.add(id); return this.draw(); }
    if (!ids.length) return;
    if (aksi === 'simpan') {
      let n = 0;
      for (const id of ids) { const t = D().tasks.find((x) => x.id === id); if (!t || t.noteId) continue; try { await api('POST', '/api/notes', { title: t.title, folder: 'Hasil', content: `# ${t.title}\n\n${t.output || t.summary || ''}`, userId: S.me }); n++; } catch { /* api() sudah memberi tahu */ } }
      toast(n ? `${n} hasil tersimpan di Catatan.` : 'Semua yang dipilih sudah ada di Catatan.', 'ok'); return this.modePilih(false);
    }
    if (aksi === 'hapus') {
      modal(`Hapus ${ids.length} hasil?`, `<p>${ids.length} hasil akan dihapus dan <b>tidak bisa dikembalikan</b>. Yang masih berjalan atau menunggu izinmu otomatis dilewati.</p>`, { actions: [{ label: 'Batal' }, { label: `Hapus ${ids.length}`, kind: 'primary', run: async () => {
        const r = await api('POST', '/api/tasks/hapus-banyak', { ids });
        const lewat = (r.dilewati || []).length;
        toast(`${r.dihapus} hasil dihapus${lewat ? `, ${lewat} dilewati (${[...new Set(r.dilewati.map((x) => x.alasan))].join(', ')})` : ''}.`, lewat ? 'warn' : 'ok');
        this.modePilih(false);
      } }] });
    }
  },
  async klik(e) {
    const kartu = e.target.closest('#hbody .hasil-k');
    if (this.lebar && kartu && !e.target.closest('button, a, input, label, select, textarea')) { this.buka = kartu.dataset.k; return this.draw(); }
    const b = e.target.closest('button'); if (!b || !this.root.contains(b)) return;
    const ds = b.dataset;
    if (ds.m) return this.massal(ds.m);
    if (ds.ke) return navigate(ds.ke);
    if (ds.lihat) { this.buka = (this.lebar || this.buka !== ds.lihat) ? ds.lihat : null; return this.draw(); }
    if (ds.buka !== undefined && ds.i !== undefined) return this.bukaBerkas(ds.buka, +ds.i, false);
    if (ds.unduh !== undefined && ds.i !== undefined) return this.bukaBerkas(ds.unduh, +ds.i, true);
    try {
      b.disabled = true;
      if (ds.pakai) { await api('POST', `/api/approvals/${ds.pakai}`, { decision: 'approve', userId: S.me }); toast('Siap, hasilnya dipakai.', 'ok'); }
      else if (ds.ya) { await api('POST', `/api/approvals/${ds.ya}`, { decision: 'approve', userId: S.me }); toast('Oke, dilanjutkan.', 'ok'); }
      else if (ds.tidak) { await api('POST', `/api/approvals/${ds.tidak}`, { decision: 'reject', feedback: 'Jangan dulu', userId: S.me }); toast('Baik, tidak dilanjutkan.', 'ok'); }
      else if (ds.ulang) { await api('PATCH', `/api/tasks/${ds.ulang}`, { status: 'todo', userId: S.me }); toast('Diulang dari awal.', 'ok'); }
      else if (ds.simpan) await this.simpan(ds.simpan);
      else if (ds.ubah) this.ubah(ds.ubah, ds.apv);
    } catch { /* api() sudah menampilkan kalimat ramah */ } finally { b.disabled = false; }
  },
  async simpan(id) {
    const t = D().tasks.find((x) => x.id === id); if (!t) return;
    if (t.noteId) return navigate('brain', { note: t.noteId });
    const n = await api('POST', '/api/notes', { title: t.title, folder: 'Hasil', content: `# ${t.title}\n\n${t.output || t.summary || ''}`, userId: S.me });
    toast('Tersimpan di Catatan.', 'ok', () => navigate('brain', { note: n.id }));
  },
  /** "Ubah sedikit": pilihan cepat + kolom bebas. Bila ada kartu "menunggu pendapatmu" memakai alur revisi, jika tidak pekerjaan diulang dengan catatanmu. */
  ubah(taskId, apvId) {
    modal('Mau diubah seperti apa?', `<div class="ubah-pilihan" role="group" aria-label="Pilihan perubahan">${UBAH.map(([v, l]) => `<button type="button" class="btn" data-pil="${v}">${l}</button>`).join('')}</div><label class="f" for="ubTxt">Atau tulis sendiri</label><textarea id="ubTxt" class="input" name="fb" rows="3" placeholder="Contoh: tambahkan harga, pakai bahasa anak muda"></textarea>`, {
      onMount: (el) => el.querySelectorAll('[data-pil]').forEach((x) => (x.onclick = () => { el.querySelector('#ubTxt').value = x.textContent.trim(); el.querySelectorAll('[data-pil]').forEach((y) => y.classList.toggle('on', y === x)); })),
      actions: [{ label: 'Batal' }, { label: 'Kirim', kind: 'primary', run: async (el) => {
        const fb = formData(el).fb.trim(); if (!fb) { toast('Pilih salah satu atau tulis dulu ya.', 'warn'); return false; }
        if (apvId) await api('POST', `/api/approvals/${apvId}`, { decision: 'reject', feedback: fb, userId: S.me });
        else { await api('POST', `/api/tasks/${taskId}/comment`, { text: fb, userId: S.me }); await api('PATCH', `/api/tasks/${taskId}`, { status: 'todo', userId: S.me }); }
        toast('Dikirim. Hasil barunya akan muncul di sini.', 'ok');
      } }],
    });
  },
  async bukaBerkas(runId, i, simpan) {
    const run = this.runs.find((r) => r.id === runId); const f = run?.berkas?.[i]; if (!f) return;
    try {
      const x = await api('GET', `/api/staff/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(f.nama)}`);
      if (simpan) return unduh(x.nama, x.isi, MIME[x.jenis] || 'text/plain');
      modal(esc(x.nama), x.jenis === 'md' ? `<div class="md">${md(String(x.isi).slice(0, 60000))}</div>` : `<pre class="pratinjau-berkas" tabindex="0">${esc(String(x.isi).slice(0, 60000))}</pre>`, { wide: true, actions: [{ label: 'Tutup' }, { label: 'Unduh', kind: 'primary', run: () => { unduh(x.nama, x.isi, MIME[x.jenis] || 'text/plain'); return false; } }] });
    } catch { /* api() sudah menampilkan kalimat ramah */ }
  },
  unmount() { try { this._ro?.disconnect(); } catch { /* ignore */ } this.root = null; },
};
