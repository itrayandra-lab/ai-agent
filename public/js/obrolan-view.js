// Obrolan: SATU percakapan seperti ChatGPT. Layar awal hanya sapaan singkat, kolom ketik, dan beberapa chip saran dinamis.
// Setelah kirim: jawaban mengalir (streaming), pembicaranya hanya orang yang menjawab, di akhir ada saran lanjutan atau pilihan ganda,
// sumber + kutipan ala NotebookLM, dokumen jadi lewat tombol aksi, riwayat percakapan. Profil pengguna ada di Pengaturan > Memori.
// Mesin: server/chat-engine.js (POST /api/chat/conversations/:id/stream). Kamus bahasa: server/kamus.js. Kontrak: docs/CHAT-ENGINE.md.
// mountObrolan(root, { compact }) adalah SATU komponen: dipasang sebagai halaman penuh (HP) atau panel kaca kiri Kantor 3D (420-480 px); satu mesin, satu riwayat.
import { S, esc, emp, modal, toast, loginGate, navigate } from './core.js';
import { icon } from './icons.js';
import { md } from './md.js';
import { ubahProfil } from './memori-view.js';
import { bisaKelola } from './awam.js';
import { buatKomposer, cariMention, buangMention, geserPilihan, tambahPenerima } from './komposer-core.js';   // logika komposer bersama (penerima, izin, status, riwayat) dengan dock Kantor 3D

// gaya khusus obrolan (kelas ob-*), dimuat sebelum identity.css supaya identity.css tetap lembar gaya terakhir
(function loadStyle() {
  if (document.querySelector('link[data-obrolan]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/obrolan.css'; l.dataset.obrolan = '1';
  const id = document.querySelector('link[href="/css/identity.css"]'); if (id) id.before(l); else document.head.append(l);
})();

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
const CADANGAN = { say: 'Halo!', chips: [{ label: 'Jelaskan sesuatu yang baru untukku', aksi: 'kirim' }, { label: 'Bantu aku menulis pesan', aksi: 'kirim' }] };
const NON_ALIR = new Set(['poll', 'back', 'new', 'jeda', 'lanjut', 'cancel']);   // balasan pendek: tidak perlu dialirkan
const unduh = (nama, isi) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: 'text/markdown;charset=utf-8' })); a.download = nama; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

export function mountObrolan(root, { compact = false, kontak = null } = {}) {   // kontak = { convId, nama }: utas satu kontak di halaman Pesan (komponen dan mesin yang sama)
  const st = { sid: '', judul: '', items: [], busy: false, timer: null, home: null, rec: null, mode: '', untuk: null, sumber: 0, peserta: [], at: null };
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  root.innerHTML = `<div class="page pemandu ob ${compact ? 'compact' : ''}${kontak ? ' kontak' : ''}">
    <header class="ob-bar" role="toolbar" aria-label="Obrolan">
      <b class="ob-judul" id="obJudul">Percakapan baru</b>
      <button type="button" class="btn sm ghost" id="obBaru" aria-label="Percakapan baru" title="Percakapan baru">${icon('plus', 16)} <span>Baru</span></button>
      <button type="button" class="btn sm ghost" id="obRiwayat" aria-label="Riwayat percakapan" title="Riwayat percakapan">${icon('clock', 16)} <span>Riwayat</span></button>
      <button type="button" class="btn sm ghost" id="obSumber" aria-expanded="false" aria-controls="obSrc" aria-label="Sumber untuk percakapan ini" title="Sumber untuk percakapan ini">${icon('doc', 16)} <span>Sumber</span> <span id="obSumberN"></span></button>
    </header>
    <section class="ob-src" id="obSrc" hidden aria-label="Sumber percakapan"></section>
    <div id="pmHome" class="pm-home"></div>
    <div id="pmUntuk"></div>
    <div id="pmThread" class="pm-thread" role="log" aria-live="polite" aria-label="Percakapan"></div>
    <aside class="ob-panel" id="obPanel" hidden aria-label="Dokumen"></aside>
    <div class="pm-dock">
      <div class="ob-kontrol" id="obKontrol" aria-label="Kontrol komposer"><span class="ob-ke" id="obKe"></span><label class="sr-only" for="obIzin">Izin untuk asisten</label><select id="obIzin" class="input ob-izin"></select><span class="ob-status" id="obStatus" role="status"></span></div>
      <div id="obPeserta" class="ob-peserta" role="group" aria-label="Peserta percakapan"></div>
      <div class="ob-at" id="obAt" role="listbox" aria-label="Saran orang" hidden></div>
      <form id="pmForm" class="pm-compose" autocomplete="off">
        <label class="sr-only" for="pmIn">Tulis atau ucapkan yang kamu butuhkan</label>
        <textarea id="pmIn" class="input" rows="1" placeholder="Tanya apa saja…" enterkeyhint="send"></textarea>
        ${Rec ? `<button type="button" class="btn icon pm-mic" id="pmMic" aria-pressed="false" aria-label="Bicara" title="Bicara">${icon('mic', 22)}</button>` : ''}
        <button type="submit" class="btn primary pm-send" id="pmGo" aria-label="Kirim">${icon('arrow', 20)}<span>Kirim</span></button>
      </form>
      <div class="pm-foot" id="pmFoot"></div>
    </div>
  </div>`;
  const $ = (q) => root.querySelector(q);
  const input = $('#pmIn');
  const last = () => st.items[st.items.length - 1];
  /** tombol kirim berubah jadi Hentikan selama jawaban dibuat */
  const busy = (b) => { st.busy = b; setTimeout(() => kk.setSibuk(b), 0); const g = $('#pmGo'); g.disabled = false; g.classList.toggle('stop', b); g.setAttribute('aria-label', b ? 'Hentikan jawaban' : 'Kirim'); g.innerHTML = b ? `${icon('close', 20)}<span>Hentikan</span>` : `${icon('arrow', 20)}<span>Kirim</span>`; };
  /** gulir ke dasar: wadah yang bisa digulir dicari sendiri (panel kiri atau halaman), langsung tanpa animasi supaya aksi di bawah jawaban tidak tertutup komposer */
  const toEnd = () => requestAnimationFrame(() => {
    let p = $('#pmThread')?.parentElement;
    while (p && p !== document.body && !(p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    if (p && p !== document.body) p.scrollTop = p.scrollHeight; else $('#pmForm').scrollIntoView({ block: 'end' });
  });

  // ───── satu balasan: satu blok per pembicara (asisten utama tanpa nama), isi tambahan, lalu tombol hanya pada balasan terakhir
  const chip = (o, cls = '') => `<button class="btn pm-chip ${cls} ${o.recommended ? 'rec' : ''}" data-cid="${esc(o.id)}" data-label="${esc(o.label)}"><b>${esc(o.label)}</b>${o.recommended ? '<em class="pm-tag">Disarankan</em>' : ''}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</button>`;
  const warna = (id) => { let h = 0; for (const c of String(id || 'sora')) h = (h * 31 + c.charCodeAt(0)) % 360; return 'hsl(' + h + ' 42% 40%)'; };
  const avatar = (sp) => '<span class="ob-ava" style="background:' + warna(sp?.id) + '" aria-hidden="true">' + esc(String(sp?.nama || 'a').slice(0, 1).toUpperCase()) + '</span>';
  /** jawaban tanpa gelembung: avatar kecil + nama + peran kecil, lalu teks mengalir lebar penuh */
  const speakBlock = (m, live, giliran = live) => '<div class="pm-speak" data-sp="' + esc(m.speaker?.id || '') + '"><div class="ob-kepala">' + avatar(m.speaker) + '<b class="ob-nama">' + esc(m.speaker?.nama || 'aray') + '</b>' + (m.speaker && !m.speaker.utama && m.speaker.peran ? '<span class="ob-peran">' + esc(m.speaker.peran) + '</span>' : '') + (giliran ? '<span class="ob-bicara" role="status" aria-label="sedang menjawab"></span>' : '') + '</div><div class="md pm-chat' + (live ? ' ob-live' : '') + '">' + md(m.say || '') + '</div></div>';
  const body = (r) => {
    let h = '';
    for (const n of r.notes || []) h += `<p class="pm-note">${esc(n)}</p>`;
    // langkah yang dikerjakan: satu baris ringkas yang bisa dibuka (tiap langkah bertanda berhasil atau tidak)
    if (r.tools?.length) {
      const gagal = r.tools.filter((tl) => tl.ok === false).length;
      h += `<details class="pm-tool ob-langkah"><summary>${icon('check', 14)} ${r.streaming ? 'Sedang bekerja' : 'Selesai'} · ${r.tools.length} langkah${gagal ? ` · ${gagal} belum berhasil` : ''}</summary><ol class="ob-langkah-daftar">${r.tools.map((tl) => `<li class="${tl.ok === false ? 'ob-tak' : 'ob-ok'}"><b>${esc(tl.label)}</b><small>${esc(tl.detail)}</small></li>`).join('')}</ol></details>`;
    }
    if (r.streaming && !(r.thread || []).some((m) => m.say)) h += `<p class="ob-pikir" role="status"><span class="ob-titik" aria-hidden="true"><i></i><i></i><i></i></span> ${r.tools?.length ? 'Menyusun jawaban…' : 'Sedang berpikir…'}</p>`;
    if (r.kind === 'chat' && r.thread?.length) h += r.thread.map((m, i) => speakBlock(m, r.streaming && i === r.thread.length - 1, r.streaming && i === r.thread.length - 1)).join('');
    else if (r.kind === 'chat') h += `<div class="md pm-chat">${md(r.say || '')}</div>`;
    else h += `<p>${esc(r.say)}</p>`;
    if (r.kutipan?.length) h += `<ol class="ob-kutip" aria-label="Kutipan sumber">${r.kutipan.map((k) => `<li class="${k.terverifikasi ? 'ob-ok' : 'ob-tak'}"><b>[${k.n}] ${esc(k.judul)}</b> “${esc(k.cuplikan)}”${k.terverifikasi ? '' : ' <i>(belum cocok dengan isi sumber)</i>'}</li>`).join('')}</ol>`;
    if (r.dokumen) h += `<section class="ob-doc"><header>${icon('doc', 16)} ${esc(r.dokumen.judul)} · versi ${r.dokumen.versi}</header><div class="md">${md(r.dokumen.isi)}</div><div class="pm-chips"><button class="btn sm ghost" data-panel="${esc(r.dokumen.id)}">${icon('eye', 16)} Buka di panel</button><button class="btn sm ghost" data-unduh="${esc(r.dokumen.id)}">${icon('download', 16)} Unduh</button><button class="btn sm ghost" data-salin="${esc(r.dokumen.id)}">${icon('doc', 16)} Salin</button></div></section>`;
    if (r.profile) h += `<ul class="pm-know">${r.profile.items.map((i) => `<li><span>${esc(i.label)}:</span> ${esc(i.value)}</li>`).join('')}</ul>`;
    if (r.kind === 'confirm' && r.preview?.length) h += `<div class="pm-preview"><dl>${r.preview.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl></div>`;
    if (r.kind === 'progress') h += `<div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress?.pct || 0}"><i style="width:${r.progress?.pct || 5}%"></i></div><p class="pm-sub">${esc(r.progress?.text || 'Mulai dikerjakan')}</p>`;
    if (r.result) h += `<section class="pm-result"><header>${icon('doc', 16)} ${esc(r.result.title || 'Hasil')}${r.result.revision ? ` · versi ${r.result.revision + 1}` : ''}</header><div class="md">${md(r.result.text || 'Belum ada isinya.')}</div>${r.result.gaps ? `<p class="pm-sub">Yang belum terpenuhi: ${esc(r.result.gaps)}</p>` : ''}<button class="btn sm ghost" data-copy="1">${icon('doc', 16)} Salin teks</button><button class="btn sm ghost" data-panel="hasil">${icon('eye', 16)} Buka di panel</button></section>`;
    if (r.saved) h += `<p class="pm-saved">${icon('check', 16)} Tersimpan di Catatan: <b>${esc(r.saved.title)}</b></p>`;
    if (r.learned) h += `<p class="pm-note">${esc(r.learned.text)}</p>`;
    for (const c of r.cards || []) h += `<div class="pm-minicard"><p><b>${esc(c.say)}</b></p>${c.detail ? `<p class="pm-sub">${esc(c.detail)}</p>` : ''}<div class="pm-chips">${c.options.map((o) => `<button class="btn pm-chip ${o.recommended ? 'rec' : ''}" data-card="${esc(c.type)}:${esc(o.id)}" data-ref="${esc(c.ref || '')}" data-label="${esc(o.label)}"><b>${esc(o.label)}</b></button>`).join('')}</div></div>`;
    return h;
  };
  /** baris aksi di bawah jawaban terakhir: Salin, Ulangi, Suka, Kurang pas */
  const ik = (data, nama, ikon, on = false, extra = '') => '<button type="button" class="btn ob-ik' + (on ? ' on' : '') + '" ' + data + ' aria-label="' + nama + '" title="' + nama + '"' + extra + '>' + icon(ikon, 15) + '</button>';
  const barisAksi = (r) => (r.kind === 'chat' && (r.say || r.thread?.length) && !r.streaming
    ? '<div class="ob-aksi-jawab" role="group" aria-label="Aksi untuk jawaban ini">' + ik('data-salin-jawab="1"', 'Salin jawaban', 'doc') + (r.pesanId || r.sessionId ? ik('data-ulang="1"', 'Ulangi jawaban', 'repeat') : '') + ik('data-aray="1"', 'Minta aray mengoordinasi', 'team') + (r.pesanId ? ik('data-umpan="suka"', 'Jawaban ini membantu', 'check', r.umpan === 'suka', ' aria-pressed="' + (r.umpan === 'suka') + '"') + ik('data-umpan="kurang"', 'Jawaban ini kurang pas', 'alert', r.umpan === 'kurang', ' aria-pressed="' + (r.umpan === 'kurang') + '"') : '') + ((r.say || '').length > 900 ? ik('data-panel="jawab"', 'Buka jawaban ini di panel', 'eye') : '') + '</div>'
    : '');
  const actions = (r) => {
    if (r.streaming) return '';
    const opts = r.options || [];
    let h = barisAksi(r);
    if (opts.length) h += `<div class="pm-chips ${r.pilihanGanda ? 'ob-pilih' : 'ob-saran'} ${opts.some((o) => o.hint) ? 'stack' : ''}" role="group" aria-label="${r.pilihanGanda ? 'Pilih salah satu atau ketik jawabanmu' : 'Saran lanjutan'}">${opts.map((o) => chip(o)).join('')}${r.kind === 'progress' ? '<button class="btn pm-chip ghost" data-arahan="1"><b>Tambah arahan</b></button>' : ''}</div>`;
    const more = [];
    if (r.learned) more.push('<button class="btn pm-chip ghost" data-keep="1"><b>Betul</b></button><button class="btn pm-chip ghost" data-profile="1"><b>Ubah</b></button>');
    if (r.delegate) more.push('<button class="btn pm-chip ghost" data-cid="delegate" data-label="Serahkan ke kamu"><b>Serahkan ke kamu</b></button>');
    if (r.freeText && r.ask && opts.length) more.push('<button class="btn pm-chip ghost" data-other="1"><b>Lainnya (ketik)</b></button>');
    if (r.undo) more.push('<button class="btn pm-chip ghost" data-cid="back" data-label="Kembali"><b>Kembali</b></button>');
    if (more.length) h += `<div class="pm-chips">${more.join('')}</div>`;
    if (r.aksi?.length) h += `<details class="ob-aksi"><summary>${icon('doc', 16)} Buat dokumen dari ini</summary><div class="pm-chips">${r.aksi.map((a) => chip({ id: a.id, label: a.label }, 'ghost')).join('')}</div></details>`;
    return h;
  };
  /** panel hasil di samping (atau menutupi komponen di layar sempit): dokumen jadi, hasil pekerjaan, atau jawaban panjang */
  const bukaPanel = (kunci) => {
    let d = null;
    if (kunci === 'jawab') { const t = (last()?.r?.thread || []).map((m) => m.say).join(String.fromCharCode(10, 10)) || last()?.r?.say || ''; d = { judul: st.judul && st.judul !== 'Percakapan baru' ? st.judul : 'Jawaban', isi: t }; }
    else if (kunci === 'hasil') { const x = [...st.items].reverse().find((m) => m.r?.result)?.r.result; if (x) d = { judul: x.title || 'Hasil', isi: x.text || '' }; }
    else { const x = [...st.items].reverse().map((m) => m.r?.dokumen).find((q) => q && q.id === kunci); if (x) d = { judul: x.judul, isi: x.isi, docId: x.id }; }
    if (!d) return;
    st.panel = d; const p = $('#obPanel'); p.hidden = false;
    p.innerHTML = `<header><b>${esc(d.judul)}</b><span class="ob-panel-aksi"><button type="button" class="btn sm ghost" data-panel-salin="1">${icon('doc', 16)} <span>Salin</span></button><button type="button" class="btn sm ghost" data-panel-unduh="1">${icon('download', 16)} <span>Unduh</span></button><button type="button" class="btn sm ghost" data-panel-simpan="1">${icon('folder', 16)} <span>Simpan ke Catatan</span></button><button type="button" class="btn sm ghost" data-tutup-panel="1" aria-label="Tutup panel">${icon('close', 16)}</button></span></header><div class="md ob-panel-isi">${md(d.isi)}</div>`;
    root.querySelector('.ob')?.classList.add('ada-panel'); p.querySelector('[data-tutup-panel]')?.focus({ preventScroll: true });
  };
  const tutupPanel = () => { st.panel = null; const p = $('#obPanel'); p.hidden = true; p.innerHTML = ''; root.querySelector('.ob')?.classList.remove('ada-panel'); };
  const render = () => {
    const li = st.items.length - 1;
    const meTerakhir = st.items.map((m) => m.role).lastIndexOf('me');
    const bisaUbah = (i) => i === meTerakhir && !st.busy && st.items[i + 1]?.r?.kind === 'chat' && st.items[i + 1]?.r?.sessionId;
    $('#pmThread').innerHTML = st.items.map((m, i) => (m.role === 'me'
      ? `<div class="pm-row me"><div class="pm-bubble me">${esc(m.text)}</div>${bisaUbah(i) ? `<button type="button" class="btn sm ghost ob-ubah" data-ubah="1" aria-label="Ubah pesan ini">${icon('edit', 14)} <span>Ubah</span></button>` : ''}</div>`
      : `<div class="pm-row guide"><div class="pm-bubble guide kind-${esc(m.r.kind)}">${body(m.r)}</div>${i === li ? actions(m.r) : ''}</div>`)).join('');
    $('#pmThread').hidden = !st.items.length;
    renderHome(); renderFoot(); renderPeserta(); kk.pakaiPercakapan(st.sid, { peserta: st.peserta });
    $('#obJudul').textContent = st.judul || 'Percakapan baru';
  };
  // komposer bersama: penerima, izin, status; keadaan dibagikan ke pihak lain lewat peristiwa jendela
  const kk = buatKomposer({ panggil: call, nama: (id) => emp(id)?.name || id, bisaKelola: () => !!S.data && bisaKelola(S.data), ambilData: () => S.data });
  kk.subscribe((k) => {
    const ke = $('#obKe'); if (ke) ke.textContent = k.target.label;
    const sel = $('#obIzin'); if (sel) { const sig = k.izin.opsi.map((o) => o.nilai).join(); if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = k.izin.opsi.map((o) => '<option value="' + o.nilai + '" title="' + esc(o.petunjuk) + '">' + esc(o.label) + '</option>').join(''); } sel.value = k.izin.nilai; sel.title = (k.izin.opsi.find((o) => o.nilai === k.izin.nilai) || {}).petunjuk || ''; }
    const stt = $('#obStatus'); if (stt) { stt.textContent = k.status.teks; stt.dataset.kode = k.status.kode; }
    try { window.dispatchEvent(new CustomEvent('raiverse:komposer', { detail: { target: k.target, izin: k.izin.nilai, status: k.status, mengetik: k.mengetik, convId: k.convId } })); } catch { /* tanpa jendela */ }
  });
  const renderFoot = () => {
    const q = (last()?.r || st.home)?.quota || st.home?.quota;
    $('#pmFoot').innerHTML = q ? `<span class="pm-quota" title="Sisa jatah hari ini">Sisa jatah hari ini: <b>${esc(q.word)}</b><span class="bar" role="img" aria-label="Sisa jatah ${q.pct} persen"><i style="width:${q.pct}%"></i></span></span>` : '';
    $('#obSumberN').textContent = st.sumber ? `(${st.sumber})` : '';
  };
  /** kepingan peserta: yang ikut bisa dilepas, yang disarankan bisa diajak, tanpa mengetik nama */
  const renderPeserta = () => {
    const r = last()?.r; const box = $('#obPeserta');
    const ikut = st.peserta; const saran = (r?.disarankan || []).filter((id) => !ikut.some((p) => p.id === id)).map((id) => emp(id)).filter(Boolean).slice(0, 2);
    box.hidden = !st.items.length && !ikut.length;
    box.innerHTML = ikut.map((p) => '<span class="ob-keping' + (st.bicara === p.id ? ' bicara' : '') + '" title="' + esc(p.nama) + (p.divisi ? ' · ' + esc(p.divisi) : '') + '">' + avatar(p) + '<span class="ob-kn">' + esc(p.nama) + '</span>' + (st.bicara === p.id ? '<i class="ob-denyut" aria-hidden="true"></i>' : '') + '<button type="button" class="ob-x" data-lepas="' + esc(p.id) + '" aria-label="Lepas ' + esc(p.nama) + ' dari percakapan">' + icon('close', 11) + '</button></span>').join('')
      + saran.map((e) => '<button type="button" class="btn ob-ajak" data-ajak="' + esc(e.id) + '" title="Disarankan untuk topik ini">+ ' + esc(e.name) + '</button>').join('')
      + '<button type="button" class="btn ob-ajak" data-tambah="1" aria-label="Tambah peserta" title="Tambah peserta">+ Tambah</button>';
  };
  /** layar awal: sapaan singkat dan beberapa chip saran dinamis (bukan menu kartu) */
  const renderHome = () => {
    const h = st.home; const box = $('#pmHome');
    box.hidden = !!st.items.length || !!kontak;
    if (st.items.length || kontak) return;
    if (!h) { box.innerHTML = '<p class="pm-sub">Sebentar ya…</p>'; return; }
    box.innerHTML = `<h2 class="ob-sapa">${esc(h.say)}</h2><div class="ob-chips" role="list" aria-label="Saran untuk memulai">${(h.chips || []).map((c, i) => `<button type="button" class="btn ob-chip" role="listitem" data-chip="${i}">${esc(c.label)}</button>`).join('')}</div>`;
  };

  // ───── percakapan: dibuat saat pesan pertama, lalu dialirkan
  const ensureConv = async () => {
    if (st.sid) return st.sid;
    const c = await call('POST', '/api/chat/conversations', {});
    if (c?.id) st.sid = c.id;
    return st.sid;
  };
  /** satu orang yang diajak bicara: beri tahu Kantor 3D agar karakternya dibingkai (views.js mendengarkan peristiwa ini) */
  const fokusKarakter = (ids) => { if (ids.length === 1 && ids[0] !== st.fokus) { st.fokus = ids[0]; try { window.dispatchEvent(new CustomEvent('raiverse:fokus-kontak', { detail: { id: ids[0], sisi: 'kanan' } })); } catch { /* tanpa Kantor 3D */ } } };
  const absorb = (r) => {   // keadaan percakapan dari balasan
    if (r.sessionId) st.sid = r.sessionId;
    if (r.judul) st.judul = r.judul;
    if (r.dilibatkan) fokusKarakter(r.dilibatkan);
    if (r.dilibatkan) st.peserta = r.dilibatkan.map((id) => ({ id, nama: emp(id)?.name || id, divisi: S.data?.divisions?.find((d) => d.id === emp(id)?.divisionId)?.name || '' }));
    if (typeof r.jumlahSumber === 'number') st.sumber = r.jumlahSumber;
  };
  const handle = (r, { replace = false } = {}) => {
    absorb(r); if (kontak?.onBalas) setTimeout(kontak.onBalas, 0);
    // suara: tiap blok pembicara yang SELESAI diumumkan sekali (bukan tiap potongan aliran); pembaca suara (tts.js) memutuskan bunyi atau tidak
    if (r.kind === 'chat' && !r.dihentikan) for (const m of (r.thread?.length ? r.thread : [{ speaker: r.speaker, say: r.say }])) { if (m.say) { try { window.dispatchEvent(new CustomEvent('raiverse:balasan', { detail: { speakerId: m.speaker?.id || '', text: m.say } })); } catch { /* tanpa jendela */ } } }   // Pesan: balasan yang tiba di utas terbuka langsung dianggap dibaca
    const item = { role: 'guide', r };
    if (replace && last()?.role === 'guide') st.items[st.items.length - 1] = item; else st.items.push(item);
    render(); toEnd();
    clearTimeout(st.timer);
    if (r.kind === 'progress') st.timer = setTimeout(poll, 2500);
  };
  const poll = async () => {
    if (st.busy || !root.isConnected) return;
    const r = await call('POST', `/api/chat/conversations/${st.sid}/send`, { pilihan: 'poll' });
    if (!r) { st.timer = setTimeout(poll, 5000); return; }   // sambungan sebentar putus: coba lagi diam-diam
    if (last()?.r?.kind === 'progress') handle(r, { replace: true }); else handle(r);
  };
  /** kirim dan alirkan: peristiwa mulai/delta/alat/selesai (SSE). Gagal mengalir -> jatuh ke kiriman biasa. */
  async function streamSend(payload, rute = 'stream') {
    const live = { role: 'guide', r: { kind: 'chat', say: '', thread: [], streaming: true, tools: [] } };
    st.items.push(live);
    let cur = null; let timer = 0; let final = null;
    const paint = () => { timer = 0; render(); toEnd(); };
    try {
      st.abort = new AbortController();
      const res = await fetch(`/api/chat/conversations/${st.sid}/${rute}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: st.abort.signal });
      if (res.status === 401) { loginGate(await res.json().catch(() => ({}))); throw new Error('masuk'); }
      if (!res.ok || !res.body) throw new Error('tidak bisa mengalir');
      const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          if (!line.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          if (ev.jenis === 'mulai' || ev.jenis === 'delta') st.bicara = ev.speaker?.id || '';
          if (ev.jenis === 'mulai') { cur = { speaker: ev.speaker, say: '' }; live.r.thread.push(cur); live.r.speaker = ev.speaker; }
          else if (ev.jenis === 'delta') { if (!cur || cur.speaker?.id !== ev.speaker?.id) { cur = { speaker: ev.speaker, say: '' }; live.r.thread.push(cur); } cur.say += ev.teks; }
          else if (ev.jenis === 'alat') live.r.tools.push(ev.alat);
          else if (ev.jenis === 'selesai') final = ev.respons;
          else if (ev.jenis === 'galat') throw new Error(ev.pesan || 'galat');
          if (!timer && ev.jenis !== 'selesai') timer = setTimeout(paint, 60);   // satu lukisan per ~60 ms supaya halus
        }
      }
    } catch (err) {
      final = final || null;
      if (err?.name === 'AbortError') {   // dihentikan pengguna: simpan bagian yang sudah tampil, tanpa mengirim ulang
        clearTimeout(timer); st.items.pop();
        const teks = live.r.thread.map((m) => m.say).join(String.fromCharCode(10, 10)).trim();
        return { kind: 'chat', sessionId: st.sid, say: teks || 'Dihentikan.', thread: live.r.thread.length ? live.r.thread : [{ say: 'Dihentikan.' }], tools: live.r.tools, options: [], dihentikan: true };
      }
    }
    st.abort = null; st.bicara = '';
    clearTimeout(timer);
    st.items.pop();   // ganti balasan sementara dengan yang final
    if (final) return final;
    if (rute !== 'stream') return FAIL;   // ulangi/ubah tidak boleh terkirim dua kali lewat jalur biasa
    return await call('POST', `/api/chat/conversations/${st.sid}/send`, payload) || FAIL;
  }
  const send = async ({ choiceId, input: text, label, ref, rute }) => {
    if (st.busy) return;
    clearTimeout(st.timer);
    const shown = label || text;
    if (rute === 'ulang') { while (last()?.role === 'guide') st.items.pop(); }   // jawaban terakhir dibuang, pesan pengguna tetap
    else if (rute === 'ubah') { const i = st.items.map((m) => m.role).lastIndexOf('me'); if (i >= 0) st.items.splice(i); st.items.push({ role: 'me', text: shown }); }
    else if (shown && !NON_ALIR.has(choiceId)) st.items.push({ role: 'me', text: shown });
    busy(true);
    render();
    const sid = await ensureConv();
    if (!sid) { busy(false); return handle(FAIL); }
    const payload = { teks: text || ref || undefined, pilihan: choiceId || undefined, fokus: kontak ? undefined : kk.state.fokus || undefined };
    let r;
    if (NON_ALIR.has(choiceId) || choiceId?.startsWith('card:') || choiceId?.startsWith('local:')) r = await call('POST', `/api/chat/conversations/${sid}/send`, payload);
    else r = await streamSend(payload, rute || 'stream');
    busy(false);
    if (choiceId === 'back' && r) { st.items.splice(-2); handle(r, { replace: true }); return; }   // kembali: percakapan ikut mundur satu langkah
    handle(r || FAIL, { replace: !!r && ['jeda', 'lanjut'].includes(choiceId) });
    if (choiceId === 'use' && r?.copy) navigator.clipboard?.writeText(r.copy).then(() => toast('Teks sudah disalin. Tinggal tempel di mana kamu mau.', 'ok')).catch(() => {});
  };
  const say = (r) => { st.items.push({ role: 'guide', r: { quota: st.home?.quota, ...r } }); render(); toEnd(); };

  // ───── riwayat dan sumber
  const baru = () => { clearTimeout(st.timer); Object.assign(st, { sid: '', judul: '', items: [], sumber: 0, peserta: [], busy: false, mode: '' }); busy(false); tutupPanel(); $('#obSrc').hidden = true; $('#obSumber').setAttribute('aria-expanded', 'false'); input.placeholder = 'Tanya apa saja…'; render(); input.focus(); };
  async function riwayat() {
    let q = '';
    const draw = async (el) => {
      const daftarUrl = '/api/chat/conversations'; const d = await call('GET', daftarUrl + '?q=' + encodeURIComponent(q) + '&status=' + (el.querySelector('#obArsip')?.checked ? 'arsip' : 'aktif'));
      const rows = d?.percakapan || [];
      el.querySelector('#obDaftar').innerHTML = rows.length ? rows.map((c) => `<li><button type="button" class="ob-baris" data-buka="${esc(c.id)}"><b>${esc(c.judul)}</b><small>${esc(c.terakhir || 'Belum ada isi')}</small></button><span class="ob-aksi-baris"><button type="button" class="btn sm ghost" data-nama="${esc(c.id)}">Ganti nama</button><button type="button" class="btn sm ghost" data-arsip="${esc(c.id)}" data-status="${c.status}">${c.status === 'arsip' ? 'Pulihkan' : 'Arsipkan'}</button><button type="button" class="btn sm ghost" data-hapus="${esc(c.id)}">Hapus</button></span></li>`).join('') : '<li class="pm-sub">Belum ada percakapan.</li>';
    };
    modal('Riwayat percakapan', '<label class="sr-only" for="obCari">Cari percakapan</label><input id="obCari" class="input" placeholder="Cari judul atau isi…"><label class="ob-cek"><input type="checkbox" id="obArsip"> Tampilkan yang diarsipkan</label><ul class="ob-daftar" id="obDaftar"></ul>', {
      onMount: (el, close) => {
        draw(el);
        el.querySelector('#obCari').oninput = (e) => { q = e.target.value; draw(el); };
        el.querySelector('#obArsip').onchange = () => draw(el);
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.buka) { close(); await buka(b.dataset.buka); }
          else if (b.dataset.nama) { const n = window.prompt('Nama baru untuk percakapan ini:'); if (n) { await call('PATCH', `/api/chat/conversations/${b.dataset.nama}`, { judul: n }); if (st.sid === b.dataset.nama) { st.judul = n; render(); } draw(el); } }
          else if (b.dataset.arsip) { await call('PATCH', `/api/chat/conversations/${b.dataset.arsip}`, { status: b.dataset.status === 'arsip' ? 'aktif' : 'arsip' }); draw(el); }
          else if (b.dataset.hapus && window.confirm('Hapus percakapan ini? Tidak bisa dikembalikan.')) { await call('DELETE', `/api/chat/conversations/${b.dataset.hapus}`); if (st.sid === b.dataset.hapus) baru(); draw(el); }
        });
      },
      actions: [{ label: 'Tutup' }],
    });
  }
  async function buka(id) {
    const d = await call('GET', `/api/chat/conversations/${id}`); if (!d) return toast('Percakapan itu belum bisa dibuka.', '');
    clearTimeout(st.timer);
    st.sid = d.id; st.judul = d.judul; st.sumber = d.sumber?.length || 0; st.peserta = (d.peserta || []).map((p) => ({ id: p.id, nama: p.nama, divisi: p.divisi }));
    st.items = d.pesan.map((m) => (m.peran === 'user' ? { role: 'me', text: m.teks } : { role: 'guide', r: { kind: 'chat', say: m.teks, pesanId: m.id, umpan: m.umpan, sessionId: d.id, speaker: m.pembicara, thread: [{ speaker: m.pembicara, say: m.teks }], options: [], dokumen: m.dokumenId ? d.dokumen.find((x) => x.id === m.dokumenId) : undefined } }));
    render(); toEnd();
  }
  /** panel sumber lipat di dalam komponen (bukan jendela terpisah) */
  async function panelSumber(buka2) {
    const box = $('#obSrc'); const btn = $('#obSumber');
    const tampil = buka2 ?? box.hidden;
    box.hidden = !tampil; btn.setAttribute('aria-expanded', String(tampil));
    if (!tampil) return;
    if (!(await ensureConv())) { box.hidden = true; return toast('Belum bisa membuka sumber. Coba lagi sebentar.', ''); }
    const catatan = (S.data?.notes || []).filter((n) => n.content && n.content.length > 40).slice(-80).reverse();
    const hasil = (S.data?.tasks || []).filter((t) => !t.parentId && t.status === 'done' && (t.output || t.summary)).slice(-40).reverse();
    box.innerHTML = `<p class="small muted">Obrolan menjawab dari sumber ini dan menyebut kutipannya. Sumber hanya dipakai di percakapan ini.</p><ul class="ob-daftar" id="obSrcList"></ul>
      <details class="ob-tambah"><summary>Tambah sumber</summary>
        <label class="f" for="obSJudul">Tempel teks</label><input id="obSJudul" class="input" placeholder="Judul sumber (boleh kosong)"><textarea id="obSTeks" class="input" rows="3" placeholder="Tempel isi tulisan di sini…"></textarea><button type="button" class="btn sm" id="obSTambah">Tambahkan teks</button>
        <label class="f" for="obSBerkas">Dari berkas teks (txt, md, csv)</label><input id="obSBerkas" type="file" accept=".txt,.md,.csv,.json,.html,text/*" class="input">
        <label class="f" for="obSCatatan">Dari Catatan</label><select id="obSCatatan" class="input"><option value="">Pilih catatan…</option>${catatan.map((n) => `<option value="${esc(n.id)}">${esc(n.title)}</option>`).join('')}</select>
        <label class="f" for="obSHasil">Dari Hasil Saya</label><select id="obSHasil" class="input"><option value="">Pilih hasil…</option>${hasil.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select>
        <p class="small muted">Untuk PDF atau Word, salin isinya lalu tempel.</p></details>`;
    const draw = async () => {
      const d = await call('GET', `/api/chat/conversations/${st.sid}/sumber`); st.sumber = d?.sumber?.length || 0; renderFoot();
      box.querySelector('#obSrcList').innerHTML = (d?.sumber || []).map((s) => `<li><span><b>[${s.nomor}] ${esc(s.judul)}</b> <small>${esc(s.jenis)} · ${s.panjang} huruf</small></span><button type="button" class="btn sm ghost" data-hapus-src="${esc(s.id)}">Hapus</button></li>`).join('') || '<li class="pm-sub">Belum ada sumber. Tambahkan di bawah, lalu tanyakan isinya.</li>';
    };
    const tambah = async (b) => { const r = await call('POST', `/api/chat/conversations/${st.sid}/sumber`, b); if (!r) return toast('Sumber belum bisa ditambahkan. Pastikan isinya cukup panjang.', ''); toast('Sumber ditambahkan.', 'ok'); draw(); };
    draw();
    box.querySelector('#obSTambah').onclick = () => tambah({ judul: box.querySelector('#obSJudul').value, teks: box.querySelector('#obSTeks').value }).then(() => { box.querySelector('#obSTeks').value = ''; });
    box.querySelector('#obSBerkas').onchange = async (e) => { const f = e.target.files?.[0]; if (f) await tambah({ judul: f.name, teks: await f.text(), jenis: 'berkas' }); e.target.value = ''; };
    box.querySelector('#obSCatatan').onchange = (e) => { if (e.target.value) tambah({ catatanId: e.target.value }); e.target.value = ''; };
    box.querySelector('#obSHasil').onchange = (e) => { if (e.target.value) tambah({ tugasId: e.target.value }); e.target.value = ''; };
    box.querySelector('#obSrcList').onclick = async (e) => { const b = e.target.closest('[data-hapus-src]'); if (b) { await call('DELETE', `/api/chat/conversations/${st.sid}/sumber/${b.dataset.hapusSrc}`); draw(); } };
  }

  // ───── "@": opsional, dicari lewat nama, peran, atau divisi dalam bahasa biasa; tidak pernah wajib
  let atTimer = 0;
  const tutupAt = () => { const b = $('#obAt'); b.hidden = true; b.innerHTML = ''; st.at = null; };
  const cekAt = () => {
    const sebelum = input.value.slice(0, input.selectionStart ?? input.value.length);
    const m = cariMention(sebelum) && [null, cariMention(sebelum).q];
    if (!m) return tutupAt();
    clearTimeout(atTimer);
    atTimer = setTimeout(async () => {
      const saranUrl = '/api/chat/saran'; const d = await call('GET', saranUrl + '?q=' + encodeURIComponent(m[1])); const rows = d?.saran || [];
      const b = $('#obAt'); st.at = { q: m[1] }; st.atRows = rows; st.atIdx = rows.length ? 0 : -1;
      if (!rows.length) { b.hidden = false; b.innerHTML = `<p class="pm-sub">Tidak ada yang cocok. Tulis saja kebutuhanmu, aku carikan orangnya.</p>`; return; }
      b.hidden = false; b.innerHTML = rows.map((x, i) => `<button type="button" class="btn ghost ob-at-baris${i === 0 ? ' aktif' : ''}" role="option" aria-selected="${i === 0}" data-at-id="${esc(x.id)}" data-at="${esc(x.nama)}"><b>${esc(x.nama)}</b> <small>${esc(x.peran || '')}${x.divisi ? ` · ${esc(x.divisi)}` : ''}</small></button>`).join('');
    }, 150);
  };

  /** satu saran @ dipilih (klik, Enter, atau Tab): teks "@kata" dibuang, orangnya menjadi chip penerima eksplisit, komposer "Ke: Nama" */
  async function pilihMention(id) {
    const e = emp(id); if (!e) return tutupAt();
    const baru = buangMention(input.value, input.selectionStart ?? input.value.length); input.value = baru.teks; autosize(); tutupAt();
    if (!(await ensureConv())) return toast('Belum bisa memilih penerima. Coba lagi sebentar.', '');
    const ids = tambahPenerima(st.peserta.map((p) => p.id), id);
    kk.pakaiPercakapan(st.sid, { peserta: st.peserta });
    const ok = await kk.setTarget({ ids });
    if (!ok) return toast('Belum bisa memilih penerima. Coba lagi sebentar.', '');
    st.peserta = ids.map((x) => ({ id: x, nama: emp(x)?.name || x, divisi: S.data?.divisions?.find((d) => d.id === emp(x)?.divisionId)?.name || '' }));
    render(); input.focus(); input.setSelectionRange(baru.kursor, baru.kursor);
    try { window.dispatchEvent(new CustomEvent('raiverse:fokus-kontak', { detail: { id: ids.length === 1 ? ids[0] : id, sisi: 'kanan' } })); } catch { /* tanpa Kantor 3D */ }
  }

  // ───── interaksi
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.atId) return pilihMention(t.dataset.atId);
    if (t.id === 'obBaru') return baru();
    if (t.id === 'obRiwayat') return riwayat();
    if (t.id === 'obSumber') return panelSumber();
    if (t.dataset.chip !== undefined) {
      const c = st.home?.chips?.[Number(t.dataset.chip)]; if (!c) return;
      if (c.aksi === 'buka') return buka(c.ref);
      if (c.aksi === 'ke') return navigate(c.ref);
      return send({ input: c.label });   // chip saran = pesan biasa; obrolan dulu
    }
    if (t.dataset.tambah) { input.value = input.value + (input.value && !/\s$/.test(input.value) ? ' ' : '') + '@'; input.focus(); input.setSelectionRange(input.value.length, input.value.length); cekAt(); return; }
    if (t.dataset.lepas) { const r = await call('POST', `/api/chat/conversations/${st.sid}/peserta`, { hapus: [t.dataset.lepas] }); if (r) { st.peserta = (r.peserta || []).map((p) => ({ id: p.id, nama: p.nama, divisi: p.divisi })); render(); } return; }
    if (t.dataset.ajak) { const r = await call('POST', `/api/chat/conversations/${await ensureConv()}/peserta`, { tambah: [t.dataset.ajak], eksplisit: true }); if (r) { st.peserta = (r.peserta || []).map((p) => ({ id: p.id, nama: p.nama, divisi: p.divisi })); render(); } return; }
    if (t.dataset.unduh) { const f = await call('GET', `/api/chat/conversations/${st.sid}/dokumen/${t.dataset.unduh}`); if (f) unduh(f.nama, f.isi); return; }
    if (t.dataset.salin) { const f = await call('GET', `/api/chat/conversations/${st.sid}/dokumen/${t.dataset.salin}`); if (f) navigator.clipboard?.writeText(f.isi).then(() => toast('Dokumen sudah disalin.', 'ok')).catch(() => {}); return; }
    if (t.dataset.salinJawab) { const teks = (last()?.r?.thread || []).map((m) => m.say).join(String.fromCharCode(10, 10)) || last()?.r?.say || ''; navigator.clipboard?.writeText(teks).then(() => toast('Jawaban sudah disalin.', 'ok')).catch(() => {}); return; }
    if (t.dataset.ulang) return send({ rute: 'ulang', input: '' , label: '' });
    if (t.dataset.aray) { const tanya = [...st.items].reverse().find((m) => m.role === 'me')?.text || ''; return send({ input: `@aray koordinasikan: ${tanya}`.slice(0, 600) }); }
    if (t.dataset.umpan) { const l = last(); if (!l?.r?.pesanId) return; const nilai = l.r.umpan === t.dataset.umpan ? '' : t.dataset.umpan; const r = await call('POST', `/api/chat/conversations/${st.sid}/umpan`, { pesanId: l.r.pesanId, nilai }); if (r) { l.r = { ...l.r, umpan: r.umpan }; render(); toast(r.umpan === 'suka' ? 'Terima kasih, aku catat ya.' : r.umpan ? 'Terima kasih, aku catat. Coba tekan Ulangi untuk jawaban lain.' : 'Penilaian dihapus.', 'ok'); } return; }
    if (t.dataset.ubah) { const i = st.items.map((m) => m.role).lastIndexOf('me'); if (i < 0) return; st.mode = 'ubah'; input.value = st.items[i].text; autosize(); input.placeholder = 'Ubah pesanmu lalu kirim. Jawaban sebelumnya akan diganti.'; input.focus(); return; }
    if (t.dataset.panel) return bukaPanel(t.dataset.panel);
    if (t.dataset.tutupPanel) return tutupPanel();
    if (t.dataset.panelSalin) { navigator.clipboard?.writeText(st.panel?.isi || '').then(() => toast('Sudah disalin.', 'ok')).catch(() => {}); return; }
    if (t.dataset.panelUnduh) { unduh(`${(st.panel?.judul || 'dokumen').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'dokumen'}.md`, st.panel?.isi || ''); return; }
    if (t.dataset.panelSimpan) { const d = st.panel; if (!d) return; if (d.docId) { tutupPanel(); return send({ choiceId: `doc:simpan:${d.docId}`, label: 'Simpan ke Catatan' }); } const r = await call('POST', '/api/notes', { title: d.judul, content: d.isi, folder: 'Hasil' }); toast(r ? 'Tersimpan di Catatan.' : 'Belum bisa menyimpan. Coba lagi sebentar.', r ? 'ok' : ''); return; }
    if (t.dataset.arahan) { st.mode = 'arahan'; input.placeholder = 'Tulis arahan tambahan untuk pekerjaan ini…'; input.focus(); return; }
    if (st.busy) return;
    const cid = t.dataset.cid;
    if (cid) return send({ choiceId: cid, label: t.dataset.label });
    if (t.dataset.card) return send({ choiceId: `card:${t.dataset.card}`, label: t.dataset.label, ref: t.dataset.ref });
    if (t.dataset.other) { const q = last()?.r; if (q?.ask) return send({ choiceId: 'other', label: 'Lainnya' }); input.focus(); return; }
    if (t.dataset.copy) { const txt = [...st.items].reverse().find((m) => m.r?.result)?.r.result.text || ''; navigator.clipboard?.writeText(txt).then(() => toast('Teks sudah disalin.', 'ok')).catch(() => {}); return; }
    if (t.dataset.keep) { const l = last(); if (l?.r) { l.r = { ...l.r, learned: null }; render(); } return; }
    if (t.dataset.profile) return ubahProfil();
  });
  const autosize = () => { if (!input.value) { input.style.height = ''; return; } input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };
  $('#pmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (st.busy) { st.abort?.abort(); return; }   // tombol berubah jadi "Hentikan" selama jawaban dibuat
    const v = input.value.trim(); if (!v) return input.focus();
    if (st.mode === 'ubah') { st.mode = ''; input.value = ''; autosize(); input.placeholder = 'Tanya apa saja…'; return send({ input: v, label: v, rute: 'ubah' }); }
    input.value = ''; autosize(); tutupAt();
    if (st.mode === 'arahan') {
      st.mode = ''; input.placeholder = 'Tanya apa saja…'; st.items.push({ role: 'me', text: v }); render();
      const r = await call('POST', `/api/chat/conversations/${st.sid}/tugas`, { aksi: 'arahan', teks: v });
      return say({ kind: 'chat', say: r?.pesan || 'Arahan belum bisa ditambahkan. Coba lagi sebentar.', thread: [{ say: r?.pesan || 'Arahan belum bisa ditambahkan. Coba lagi sebentar.' }], options: [] });
    }
    send({ input: st.untuk && !st.items.length ? `Minta ${st.untuk.name} untuk ${v}` : v });
  });
  input.addEventListener('keydown', (e) => {
    const bukaAt = !$('#obAt').hidden && st.atRows?.length;
    if (bukaAt && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); st.atIdx = geserPilihan(st.atIdx ?? -1, st.atRows.length, e.key === 'ArrowDown' ? 1 : -1); $('#obAt').querySelectorAll('.ob-at-baris').forEach((b, i) => { b.classList.toggle('aktif', i === st.atIdx); b.setAttribute('aria-selected', String(i === st.atIdx)); }); return; }
    if (bukaAt && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.isComposing) { e.preventDefault(); const r = st.atRows[Math.max(0, st.atIdx ?? 0)]; return r && pilihMention(r.id); }
    if (e.key === 'Escape') return tutupAt();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#pmForm').requestSubmit(); }
  });
  input.addEventListener('input', () => { autosize(); cekAt(); kk.setMengetik(!!input.value); });
  input.addEventListener('blur', () => kk.setMengetik(false));
  $('#obIzin').addEventListener('change', async (e) => {
    const v = e.target.value; const kirim = async () => { const ok = await kk.setIzin(v); if (ok) toast('Izin: ' + (kk.state.izin.opsi.find((o) => o.nilai === v) || {}).label, 'ok'); else { kk.sinkron(); toast('Izin belum bisa diubah. Coba lagi sebentar.', ''); } };
    if (v === 'full') modal('Serahkan penuh?', '<p>Asisten boleh menyetujui hasil kerja sendiri tanpa menunggumu. Pengiriman ke luar dan otomasi <b>tetap</b> meminta persetujuanmu. Kamu bisa mengembalikannya kapan saja.</p>', { actions: [{ label: 'Batal', run: async () => { kk.sinkron(); } }, { label: 'Ya, serahkan penuh', kind: 'primary', run: kirim }] });
    else kirim();
  });

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

  renderHome();
  // "Beri pekerjaan" dari Tim Saya (untuk) atau permintaan dari pencarian dan Pengaturan (mulai): tetap sebagai percakapan biasa
  const untuk = S.params?.untuk ? emp(S.params.untuk) : null; const mulai = S.params?.mulai || '';
  st.untuk = untuk;
  if (untuk) {
    input.placeholder = `Apa yang mau dikerjakan ${untuk.name}?`;
    $('#pmUntuk').innerHTML = `<div class="pm-untuk" role="status">${icon('user', 18)}<span>Pekerjaan ini untuk <b>${esc(untuk.name)}</b></span><button type="button" class="btn sm ghost" id="untukX" aria-label="Batal memilih ${esc(untuk.name)}">${icon('close', 16)} Batal</button></div>`;
    $('#untukX').onclick = () => { st.untuk = null; $('#pmUntuk').innerHTML = ''; input.placeholder = 'Tanya apa saja…'; input.focus({ preventScroll: true }); };
  }
  if (kontak?.convId) { st.home = CADANGAN; input.placeholder = `Tulis pesan untuk ${kontak.nama || 'kontak ini'}…`; buka(kontak.convId); }
  else call('GET', '/api/chat/awal').then((h) => {
    st.home = h || CADANGAN;
    render();
    if (mulai) setTimeout(() => send({ input: mulai }), 0);
  });
  // fokus Kantor 3D: orang yang diikuti menjadi penerima bawaan (views.js mengirim 'raiverse:fokus-3d'); keadaan awal dari variabel jendela
  const dengarFokus = (ev) => kk.setFokus(ev.detail?.id || null);
  window.addEventListener('raiverse:fokus-3d', dengarFokus);
  if (!kontak) kk.setFokus(window.__raiverseFokus3d || null);
  kk.sinkron();
  return { komposer: kk, lepasFokus: () => window.removeEventListener('raiverse:fokus-3d', dengarFokus), unmount() { window.removeEventListener('raiverse:fokus-3d', dengarFokus); clearTimeout(st.timer); clearTimeout(atTimer); try { st.rec?.stop(); } catch { /* sudah berhenti */ } }, baru, buka, send };
}

export const ObrolanView = {
  /** halaman penuh (HP) atau panel kaca kiri Kantor 3D (kompak): komponen yang sama, riwayat yang sama */
  mount(root) {
    const panel = !!root.closest?.('#lpage'); const ctl = this.ctl = mountObrolan(root, { compact: panel });
    if (panel) setTimeout(() => root.querySelector('#pmIn')?.focus({ preventScroll: true }), 80);
    // pesan dari bilah dok: dikirim oleh pemasangan yang masih hidup (pemasangan ganda saat berpindah halaman tidak membuatnya hilang)
    setTimeout(() => { if (root.isConnected && this.kirimNanti) { const t = this.kirimNanti; this.kirimNanti = null; ctl.send({ input: t }); } }, 300);
  },
  kirimNanti: null,
  unmount() { this.ctl?.unmount(); this.ctl = null; },
  update() { this.ctl?.komposer?.sinkron(); },   // data ruang kerja berubah: status dan izin diperbarui; percakapan sendiri lewat aliran
};
