// PESAN: daftar kontak (orang, divisi, grup) di kiri dan utas kontak yang dipilih di kanan, seperti WhatsApp/Telegram.
// Utas = komponen Obrolan yang sama (jawaban mengalir, saran lanjutan, konfirmasi, ulangi) terikat ke percakapan khusus kontak itu.
// Server: server/chat-kontak.js (/api/pesan/*). Kontrak dan aturan data: docs/CHAT-ENGINE.md, bagian "Pesan".
// Lebar menentukan tata letak: >= 700 px dua kolom; lebih sempit (panel kiri Kantor 3D, HP) satu kolom dengan tombol kembali.
import { S, esc, emp, modal, toast, loginGate, api } from './core.js';
import { tts } from './tts.js';
import { icon } from './icons.js';
import { mountObrolan } from './obrolan-view.js';

(function loadStyle() {
  if (document.querySelector('link[data-pesan]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/pesan.css'; l.dataset.pesan = '1';
  const id = document.querySelector('link[href="/css/identity.css"]'); if (id) id.before(l); else document.head.append(l);
})();

async function call(method, url, body) {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.login) { loginGate(data); return null; }
    return res.ok ? data : null;
  } catch { return null; }
}
const STATUS = { bekerja: 'Sedang bekerja', rapat: 'Sedang rapat', siap: 'Siap membantu', luring: 'Tidak aktif' };
const FILTER = [['', 'Semua'], ['orang', 'Orang'], ['divisi', 'Divisi'], ['grup', 'Grup'], ['ruang', 'Ruang'], ['rapat', 'Rapat']];

// ───── bagian dari obrolan lama (ruang divisi, pekerjaan dan grup, rapat): satu tempat, nama ramah, tanpa kode teknis
const NAMA_RUANG = { general: 'Umum', 'daily-standup': 'Rapat harian', standup: 'Rapat harian', random: 'Santai', announcements: 'Pengumuman', marketing: 'Pemasaran', finance: 'Keuangan', engineering: 'Teknologi', tech: 'Teknologi', design: 'Desain', sales: 'Penjualan', support: 'Layanan pelanggan', hr: 'SDM', legal: 'Hukum', operations: 'Operasional', product: 'Produk', research: 'Riset', ops: 'Operasional', 'customer-support': 'Layanan pelanggan', 'content-studio': 'Studio konten' };
const kapital = (t) => t.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const namaRuang = (c) => {
  const mentah = String(c?.name || '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/^Diskusi:\s*/i, '').trim();
  const kunci = mentah.toLowerCase().replace(/\s+/g, '-');
  return NAMA_RUANG[kunci] || kapital(mentah.replace(/[-_]+/g, ' ')) || 'Percakapan';
};
const SEBUTAN_LAMA = new RegExp(['\\b', 'ag', 'en', '(ts)?\\b'].join(''), 'gi');
/** buang kode dan istilah teknis dari pesan lama: nomor panjang dalam kurung, "diterima N ... koordinator", dan sebutan lama */
const bersihkan = (t) => String(t || '').replace(/\[\d{8,}\]/g, '').replace(/diterima\s+\d+[^.\n]*(koordinator|pembantu)[^.\n]*\.?/gi, '').replace(SEBUTAN_LAMA, 'pembantu').replace(/@all\b/gi, '@semua').replace(/[ \t]{2,}/g, ' ').trim();
const jenisRuang = (c) => (c.kind === 'meeting' ? 'rapat' : 'ruang');
const labelRuang = (c) => (c.kind === 'meeting' ? 'Rapat' : c.kind === 'channel' ? 'Ruang divisi' : c.goalId ? 'Pekerjaan' : 'Grup kerja');
const pesanRuang = (cid) => (S.data?.messages || []).filter((m) => m.channelId === cid);
/** daftar ruang/rapat sebagai kontak (dihitung di klien dari data ruang kerja yang sudah dimuat; tidak ada salinan di server) */
function daftarRuang(jenis, q) {
  const needle = String(q || '').toLowerCase(); const chs = (S.data?.channels || []).filter((c) => (jenis === 'rapat' ? c.kind === 'meeting' : c.kind === 'channel' || (c.kind === 'group' && (c.members || []).includes(S.me))));
  return chs.map((c) => { const ms = pesanRuang(c.id); const t = ms[ms.length - 1];
    return { id: 'ruang:' + c.id, jenis: 'ruang', ruang: c, nama: namaRuang(c), peran: labelRuang(c), avatar: { inisial: jenis === 'rapat' ? 'R' : c.kind === 'channel' ? '#' : 'P', warna: c.kind === 'meeting' ? 'hsl(215 45% 42%)' : 'hsl(160 38% 36%)' }, status: null, pin: false, belumDibaca: 0, terakhir: t ? { teks: bersihkan(t.text).slice(0, 80), waktu: t.t } : null };
  }).filter((k) => !needle || `${k.nama} ${k.peran}`.toLowerCase().includes(needle)).sort((a, b) => (b.terakhir?.waktu || 0) - (a.terakhir?.waktu || 0)).slice(0, 80);
}
const SUMBER = { pesan: 'Pesan', obrolan: 'Obrolan', rapat: 'Rapat' };
const waktu = (t) => {
  if (!t) return '';
  const d = new Date(t); const now = new Date(); const sama = d.toDateString() === now.toDateString();
  return sama ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
const warnaDari = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return 'hsl(' + h + ' 42% 40%)'; };
const ava = (k, cls = '') => `<span class="psn-ava ${cls}" style="background:${esc(k.avatar?.warna || '#667')}" aria-hidden="true">${esc(k.avatar?.inisial || '?')}${k.status ? `<i class="psn-dot ${esc(k.status.kode)}" title="${esc(STATUS[k.status.kode] || '')}"></i>` : ''}</span>`;
const fokus = (k) => { const id = k?.orangId; if (!id) return; try { window.dispatchEvent(new CustomEvent('raiverse:fokus-kontak', { detail: { id, sisi: 'kanan' } })); } catch { /* tanpa Kantor 3D */ } };

export const PesanView = {
  mount(root) {
    const st = { kontak: [], q: '', jenis: '', pilih: null, tab: 'obrolan', utas: null, obrolan: null, timer: 0, ro: null };
    root.innerHTML = `<div class="page psn" data-tampil="daftar">
      <section class="psn-daftar" aria-label="Daftar kontak">
        <header class="psn-kepala"><b>Pesan</b><button type="button" class="btn sm ghost" id="psnGrup" aria-label="Buat grup baru" title="Buat grup baru">${icon('plus', 14)} <span>Grup</span></button></header>
        <label class="sr-only" for="psnCari">Cari kontak</label>
        <div class="psn-cari">${icon('search', 14)}<input id="psnCari" class="input" placeholder="Cari nama, peran, atau divisi" autocomplete="off"></div>
        <div class="psn-filter" role="tablist" aria-label="Jenis kontak">${FILTER.map(([v, l]) => `<button type="button" role="tab" class="btn sm ghost${v === '' ? ' on' : ''}" data-f="${v}" aria-selected="${v === ''}">${l}</button>`).join('')}</div>
        <ul class="psn-list" id="psnList" aria-live="polite"></ul>
      </section>
      <section class="psn-utas" id="psnUtas" aria-label="Percakapan dengan kontak"></section>
    </div>`;
    const $ = (q) => root.querySelector(q);
    const page = $('.psn');

    // tata letak mengikuti lebar tempat komponen dipasang (panel kiri, layar penuh, HP)
    const ukur = () => { page.classList.toggle('dua', root.clientWidth >= 700); };
    ukur(); if (window.ResizeObserver) { st.ro = new ResizeObserver(ukur); st.ro.observe(root); }

    const baris = (k) => `<li><button type="button" class="psn-baris${st.pilih === k.id ? ' aktif' : ''}" data-k="${esc(k.id)}">
      ${k.status ? ava(k) : ava({ ...k, status: null })}<span class="psn-isi"><span class="psn-atas"><b class="psn-nama">${esc(k.nama)}</b>${k.pin ? `<span class="psn-pin" aria-label="Dipin">${icon('star', 11)}</span>` : ''}<time>${esc(waktu(k.terakhir?.waktu))}</time></span>
      <span class="psn-bawah"><span class="psn-sub">${esc(k.terakhir?.teks || (k.status?.kode === 'bekerja' ? k.status.teks : k.peran))}</span>${k.belumDibaca ? `<span class="psn-badge" aria-label="${k.belumDibaca} pesan belum dibaca">${k.belumDibaca > 9 ? '9+' : k.belumDibaca}</span>` : ''}</span></span></button></li>`;
    const gambarDaftar = () => {
      const ul = $('#psnList');
      ul.innerHTML = st.kontak.length ? st.kontak.map(baris).join('') : `<li class="psn-kosong">${st.q ? 'Tidak ada kontak yang cocok.' : st.jenis === 'grup' ? 'Belum ada grup. Tekan "+ Grup" untuk membuat.' : 'Belum ada kontak.'}</li>`;
    };
    async function muatDaftar() {
      if (st.pilih && (page.classList.contains('dua') || page.dataset.tampil === 'utas')) await call('POST', `/api/pesan/kontak/${st.pilih}/baca`);   // utas yang sedang terbuka tidak menumpuk lencana
      if (st.jenis === 'ruang' || st.jenis === 'rapat') { st.kontak = daftarRuang(st.jenis, st.q); gambarDaftar(); return; }
      const d = await call('GET', '/api/pesan/kontak?q=' + encodeURIComponent(st.q) + '&jenis=' + encodeURIComponent(st.jenis));
      if (!d || !root.isConnected) return;
      st.kontak = d.kontak; gambarDaftar();
    }
    // lencana dan status diperbarui pelan-pelan selama halaman terbuka
    const denyut = () => { st.timer = setTimeout(async () => { if (root.isConnected) { await muatDaftar(); denyut(); } }, 20000); };

    // ───── utas
    const kepala = (k, u) => `<header class="psn-hu"><button type="button" class="btn ghost icon psn-kembali" id="psnKembali" aria-label="Kembali ke daftar kontak">${icon('arrow', 16)}</button>
      ${ava(k, 'besar')}<span class="psn-judul"><b>${esc(k.nama)}</b><small class="psn-st ${esc(k.status.kode)}">${esc(STATUS[k.status.kode] || '')}${k.status.kode === 'bekerja' && k.status.teks ? ' · ' + esc(k.status.teks) : k.jenis === 'grup' ? ' · ' + esc(k.status.teks) : ''}</small></span>
      <button type="button" class="btn ghost icon psn-pinbtn${k.pin ? ' on' : ''}" id="psnPin" aria-pressed="${!!k.pin}" aria-label="${k.pin ? 'Lepas pin' : 'Pin kontak'}" title="${k.pin ? 'Lepas pin' : 'Pin kontak'}">${icon('star', 15)}</button>
      <nav class="psn-tab" role="tablist" aria-label="Bagian utas">${[['obrolan', 'Obrolan'], ...(k.koordinator ? [['laporan', `Laporan${st.laporan?.belumDibaca ? ` (${st.laporan.belumDibaca})` : ''}`]] : []), ['tugas', `Tugas${u?.jumlahTugas?.dikerjakan ? ` (${u.jumlahTugas.dikerjakan})` : ''}`], ['info', 'Info']].map(([id, l]) => `<button type="button" role="tab" class="btn sm ghost${st.tab === id ? ' on' : ''}" data-t="${id}" aria-selected="${st.tab === id}">${l}</button>`).join('')}</nav></header>`;
    const riwayatLama = (u) => {
      const lama = u.pesan.filter((m) => m.sumber !== 'pesan');
      if (!lama.length) return '';
      return `<details class="psn-lama"><summary>${icon('clock', 13)} Riwayat dari Obrolan dan rapat (${lama.length})</summary><ul>${lama.slice(-40).map((m) => `<li class="${m.peran}"><span class="psn-chip">${esc(SUMBER[m.sumber] || m.sumber)}</span><span>${esc(String(m.teks).slice(0, 220))}</span><time>${esc(waktu(m.waktu))}</time></li>`).join('')}</ul></details>`;
    };
    const tabTugas = (u) => u.tugas.length ? `<ul class="psn-tugas">${u.tugas.map((t) => `<li><span class="psn-tl ${esc(t.status)}">${esc(t.label)}</span><b>${esc(t.judul)}</b>${t.pemilik && u.kontak.jenis !== 'orang' ? `<small>${esc(t.pemilik)}</small>` : ''}${t.hasil ? `<p>${esc(t.hasil)}</p>` : ''}<time>${esc(waktu(t.diperbarui))}</time></li>`).join('')}</ul>` : '<p class="psn-kosong">Belum ada tugas untuk kontak ini. Tulis pesan di tab Obrolan untuk memintanya.</p>';
    /** laporan yang diteruskan aray: kartu per pekerjaan selesai dengan penelusuran ke agen sumber (diturunkan dari pekerjaan, tidak disalin) */
    const tabLaporan = () => {
      const l = st.laporan; if (!l) return '<p class="psn-kosong">Memuat laporan…</p>';
      return l.laporan.length ? `<ul class="psn-tugas">${l.laporan.map((x) => `<li class="${x.dibaca ? '' : 'baru'}"><b>${esc(x.judul)}</b><p>${esc(x.ringkas)}</p><small>Dilaporkan ${esc(x.dari?.nama || '')} lewat ${esc(x.lewat?.nama || '')} · <time>${esc(waktu(x.waktu))}</time></small>${(x.sumberAgen || []).length ? `<span class="psn-keahlian">${x.sumberAgen.map((a) => `<button type="button" class="psn-chip" data-k="orang:${esc(a.id)}">Telusuri ${esc(a.nama)}</button>`).join('')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="psn-kosong">Belum ada laporan. Begitu pekerjaan selesai, ringkasannya muncul di sini.</p>';
    };
    const tabInfo = (u) => {
      const k = u.kontak;
      return `<div class="psn-info"><div class="psn-info-h">${ava(k, 'raksasa')}<div><b>${esc(k.nama)}</b><small>${esc(k.peran)}</small></div></div>
        <dl><div><dt>Status</dt><dd class="psn-st ${esc(k.status.kode)}">${esc(STATUS[k.status.kode] || '')}${k.status.teks && k.status.kode !== 'siap' ? ' · ' + esc(k.status.teks) : ''}</dd></div>
        ${k.divisi ? `<div><dt>Divisi</dt><dd>${esc(k.divisi)}</dd></div>` : ''}${k.pimpinan ? `<div><dt>Pimpinan</dt><dd>${esc(k.pimpinan.nama)}</dd></div>` : ''}
        ${k.keahlian?.length ? `<div><dt>Keahlian</dt><dd class="psn-keahlian">${k.keahlian.map((x) => `<span class="psn-chip">${esc(x)}</span>`).join('')}</dd></div>` : ''}
        ${k.anggota?.length ? `<div><dt>Anggota</dt><dd class="psn-keahlian">${k.anggota.map((a) => `<span class="psn-chip">${esc(a.nama)} · ${esc(a.peran)}</span>`).join('')}</dd></div>` : ''}
        ${k.tentang ? `<div><dt>Tentang</dt><dd>${esc(k.tentang)}</dd></div>` : ''}
        <div><dt>Tugas</dt><dd>${u.jumlahTugas.dikerjakan} dikerjakan · ${u.jumlahTugas.selesai} selesai</dd></div></dl>
        ${k.jenis === 'grup' ? `<div class="psn-aksi-grup"><button type="button" class="btn sm ghost" data-ubah-grup="1">Ubah nama</button><button type="button" class="btn sm ghost" data-hapus-grup="1">Hapus grup</button></div>` : ''}</div>`;
    };
    function gambarUtas() {
      const box = $('#psnUtas'); const u = st.utas; if (!u) { box.innerHTML = `<div class="psn-belum">${icon('chat', 28)}<p>Pilih kontak di kiri untuk mulai berkirim pesan.</p></div>`; return; }
      box.innerHTML = `${kepala(u.kontak, u)}<div class="psn-badan">${st.tab === 'obrolan' ? `${riwayatLama(u)}<div class="psn-ob" id="psnOb"></div>` : st.tab === 'laporan' ? tabLaporan() : st.tab === 'tugas' ? tabTugas(u) : tabInfo(u)}</div>`;
      if (st.tab === 'obrolan') pasangObrolan();
    }
    function pasangObrolan() {
      st.obrolan?.unmount?.(); st.obrolan = null;
      const host = $('#psnOb'); if (!host || !st.utas?.convId) return;
      st.obrolan = mountObrolan(host, { compact: true, kontak: { convId: st.utas.convId, nama: st.utas.kontak.nama, onBalas: () => { if (st.pilih) call('POST', `/api/pesan/kontak/${st.pilih}/baca`).then(() => muatDaftar()); } } });
    }
    /** ruang atau rapat dari obrolan lama: pesan terbaca langsung dari data ruang kerja (nama ramah, tanpa kode), tombol dengarkan, dan kirim pesan bila ruang biasa */
    function gambarRuang() {
      const c = (S.data?.channels || []).find((x) => x.id === st.ruang); const box = $('#psnUtas'); if (!c) return;
      const ms = pesanRuang(c.id).slice(-80); const bisaTulis = c.kind !== 'meeting';
      const barisPesan = ms.map((m) => { const a = emp(m.authorId); const nama = a?.name || 'Pengguna'; const ik = { id: a?.id || 'x', nama, inisial: nama.slice(0, 1).toUpperCase() };
        return `<div class="psn-msg"><span class="psn-ava kecil" style="background:${esc(warnaDari(ik.id))}" aria-hidden="true">${esc(ik.inisial)}</span><div><b>${esc(nama)}</b>${a?.title ? ` <small>${esc(a.title)}</small>` : ''} <time>${esc(waktu(m.t))}</time><p>${esc(bersihkan(m.text))}</p></div><button type="button" class="btn ob-ik" data-dengar="${esc(m.id)}" aria-label="Dengarkan pesan ini" title="Dengarkan">${icon('sound', 14)}</button></div>`; }).join('');
      const adaForm = !!box.querySelector('#psnRuangIn'); const nilai = box.querySelector('#psnRuangIn')?.value || '';
      const dekat = (() => { const b = box.querySelector('.psn-ruang-isi'); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 80; })();
      box.innerHTML = `<header class="psn-hu"><button type="button" class="btn ghost icon psn-kembali" id="psnKembali" aria-label="Kembali ke daftar">${icon('arrow', 16)}</button><span class="psn-ava besar" style="background:${c.kind === 'meeting' ? 'hsl(215 45% 42%)' : 'hsl(160 38% 36%)'}" aria-hidden="true">${c.kind === 'meeting' ? 'R' : c.kind === 'channel' ? '#' : 'P'}</span><span class="psn-judul"><b>${esc(namaRuang(c))}</b><small>${esc(labelRuang(c))}${(c.members || []).length ? ' · ' + c.members.length + ' orang' : ''}</small></span></header>
        <div class="psn-ruang-isi" id="psnRuangIsi">${barisPesan || '<p class="psn-kosong">Belum ada pesan di sini.</p>'}</div>
        ${bisaTulis ? `<form class="psn-ruang-form" id="psnRuangForm" autocomplete="off"><label class="sr-only" for="psnRuangIn">Tulis pesan</label><textarea id="psnRuangIn" class="input" rows="1" placeholder="Tulis pesan untuk ruang ini"></textarea><button type="submit" class="btn primary" aria-label="Kirim">${icon('arrow', 16)}</button></form>` : '<p class="psn-kosong">Rapat hanya bisa dibaca. Untuk membahas, buka percakapan dengan orangnya.</p>'}`;
      const isi = box.querySelector('#psnRuangIsi'); if (dekat && isi) isi.scrollTop = isi.scrollHeight;
      const ta = box.querySelector('#psnRuangIn'); if (ta) { ta.value = nilai; if (adaForm && nilai) ta.focus(); }
    }
    function bukaRuang(rid) { st.ruang = rid.replace(/^ruang:/, ''); st.pilih = rid; st.utas = null; page.dataset.tampil = 'utas'; gambarDaftar(); gambarRuang(); }
    async function bukaKontak(kid) {
      if (String(kid).startsWith('ruang:')) return bukaRuang(kid);
      st.ruang = null;
      st.pilih = kid; st.tab = 'obrolan'; page.dataset.tampil = 'utas'; gambarDaftar();
      $('#psnUtas').innerHTML = '<div class="psn-belum"><p>Membuka percakapan…</p></div>';
      const sesi = await call('POST', `/api/pesan/kontak/${kid}/sesi`);
      const u = sesi && await call('GET', `/api/pesan/kontak/${kid}`);
      if (!u) { $('#psnUtas').innerHTML = '<div class="psn-belum"><p>Percakapan ini belum bisa dibuka. Coba lagi sebentar.</p></div>'; return; }
      st.utas = { ...u, convId: sesi.convId };
      gambarUtas(); fokus(u.kontak);
      const k = st.kontak.find((x) => x.id === kid); if (k) { k.belumDibaca = 0; gambarDaftar(); }
    }

    // ───── grup baru
    function grupBaru() {
      const orang = st.kontak.filter((k) => k.jenis === 'orang');
      modal('Grup baru', `<label class="f" for="gNama">Nama grup</label><input id="gNama" class="input" maxlength="40" placeholder="Misalnya: Tim promo akhir tahun"><p class="small muted">Pilih 2 sampai 4 orang.</p><label class="sr-only" for="gCari">Cari orang</label><input id="gCari" class="input" placeholder="Cari orang…"><ul class="psn-pilih" id="gDaftar"></ul>`, {
        onMount: (el, close) => {
          const pilih = new Set(); let q = '';
          const gambar = () => { el.querySelector('#gDaftar').innerHTML = orang.filter((k) => !q || `${k.nama} ${k.peran} ${k.divisi}`.toLowerCase().includes(q)).slice(0, 60).map((k) => `<li><label class="psn-cek"><input type="checkbox" value="${esc(k.orangId)}"${pilih.has(k.orangId) ? ' checked' : ''}>${ava(k)}<span><b>${esc(k.nama)}</b><small>${esc(k.peran)}${k.divisi ? ' · ' + esc(k.divisi) : ''}</small></span></label></li>`).join(''); };
          gambar();
          el.querySelector('#gCari').oninput = (e) => { q = e.target.value.toLowerCase(); gambar(); };
          el.querySelector('#gDaftar').onchange = (e) => { const v = e.target.value; if (e.target.checked) { if (pilih.size >= 4) { e.target.checked = false; return toast('Paling banyak empat orang dalam satu grup.', ''); } pilih.add(v); } else pilih.delete(v); };
          st.pilihGrup = pilih;
        },
        actions: [{ label: 'Batal' }, { label: 'Buat grup', kind: 'primary', run: async (body) => {
          const nama = body.querySelector('#gNama').value.trim(); const pilih = st.pilihGrup || new Set();
          if (!nama) { toast('Beri nama grupnya dulu ya.', ''); return false; }
          if (pilih.size < 2) { toast('Pilih sedikitnya dua orang.', ''); return false; }
          const g = await call('POST', '/api/pesan/grup', { nama, anggota: [...pilih] });
          if (!g) { toast('Grup belum bisa dibuat. Coba lagi sebentar.', ''); return false; }
          st.jenis = ''; root.querySelectorAll('[data-f]').forEach((x) => { const on = x.dataset.f === ''; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
          await muatDaftar(); bukaKontak(g.id);
        } }],
      });
    }

    // ───── interaksi
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
      if (t.dataset.k) return bukaKontak(t.dataset.k);
      if (t.dataset.dengar) { const m = (S.data?.messages || []).find((x) => x.id === t.dataset.dengar); if (m) tts.speak(m.authorId, bersihkan(m.text), { interrupt: true }); return; }
      if (t.dataset.f !== undefined) { st.jenis = t.dataset.f; root.querySelectorAll('[data-f]').forEach((b) => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); return muatDaftar(); }
      if (t.id === 'psnGrup') return grupBaru();
      if (t.id === 'psnKembali') { page.dataset.tampil = 'daftar'; return; }
      if (t.id === 'psnPin' && st.utas) { const on = !st.utas.kontak.pin; const r = await call('POST', `/api/pesan/kontak/${st.utas.kontak.id}/pin`, { pin: on }); if (r) { st.utas.kontak.pin = on; await muatDaftar(); gambarUtas(); } return; }
      if (t.dataset.t && st.utas) { st.tab = t.dataset.t; gambarUtas(); if (st.tab === 'laporan') { const l = await call('GET', '/api/chat/laporan'); if (l) { st.laporan = l; gambarUtas(); await call('POST', '/api/chat/laporan/semua/baca'); } } return; }
      if (t.dataset.ubahGrup && st.utas) { const n = window.prompt('Nama baru untuk grup ini:', st.utas.kontak.nama); if (n) { const r = await call('PATCH', `/api/pesan/grup/${st.utas.kontak.id.split(':')[1]}`, { nama: n }); if (r) { st.utas.kontak = { ...st.utas.kontak, nama: r.nama }; await muatDaftar(); gambarUtas(); } } return; }
      if (t.dataset.hapusGrup && st.utas && window.confirm('Hapus grup ini beserta percakapannya? Tidak bisa dikembalikan.')) { await call('DELETE', `/api/pesan/grup/${st.utas.kontak.id.split(':')[1]}`); st.utas = null; st.pilih = null; page.dataset.tampil = 'daftar'; await muatDaftar(); gambarUtas(); }
    });
    root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'psnRuangForm') return; e.preventDefault();
      const ta = $('#psnRuangIn'); const teks = ta.value.trim(); if (!teks || !st.ruang) return; ta.value = '';
      try { await api('POST', '/api/messages', { channelId: st.ruang, text: teks, userId: S.me }); } catch { ta.value = teks; toast('Pesan belum terkirim. Coba lagi sebentar.', ''); }
    });
    root.addEventListener('keydown', (e) => { if (e.target.id === 'psnRuangIn' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#psnRuangForm').requestSubmit(); } });
    let cariT = 0;
    $('#psnCari').addEventListener('input', (e) => { clearTimeout(cariT); cariT = setTimeout(() => { st.q = e.target.value.trim(); muatDaftar(); }, 180); });

    gambarUtas();
    muatDaftar().then(() => { const buka = S.params?.kontak; if (buka) bukaKontak(String(buka).includes(':') ? buka : `orang:${buka}`); });
    denyut();
    this.ctl = { buka: bukaKontak, segarkan() { if (st.ruang) gambarRuang(); else if (st.jenis === 'ruang' || st.jenis === 'rapat') muatDaftar(); }, unmount() { clearTimeout(st.timer); clearTimeout(cariT); st.ro?.disconnect(); st.obrolan?.unmount?.(); } };
  },
  ctl: null,
  unmount() { this.ctl?.unmount(); this.ctl = null; },
  update() { this.ctl?.segarkan(); },   // pesan baru di ruang yang terbuka tampil langsung; kontak diperbarui oleh denyut kecil sendiri
};
