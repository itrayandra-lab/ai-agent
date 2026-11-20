// Pengaturan untuk pengguna biasa: Akun, Tampilan, Ruang kerja dan undangan, Sambungan (Google, WhatsApp).
// Tanpa istilah penyedia AI, otak, kunci, atau sambungan teknis. Halaman teknis lama ada di jalur pengelola (admin-view.js, #admin).
import { S, api, esc, toast, navigate, modal } from './core.js';
import { icon } from './icons.js';
import { tts } from './tts.js';
import { kosong, memuat, galat, ramah } from './awam.js';
import { pasangSambungan } from './sambungan-view.js';
import { renderMemori } from './memori-view.js';

const PERAN = { owner: 'Pemilik', admin: 'Pengelola', member: 'Anggota' };

export const PengaturanView = {
  mount(root) {
    this.root = root;
    root.innerHTML = `<div class="page pengaturan">
      <header class="page-head"><h2>Pengaturan</h2><p class="muted">Akun, tampilan, ruang kerja, dan sambungan: semuanya diatur dari sini.</p></header>
      <nav class="set-nav" aria-label="Bagian pengaturan"><a href="#sTamp" data-sn="sTamp">Tampilan</a><a href="#sAkun" data-sn="sAkun">Akun</a><a href="#sRuang" data-sn="sRuang">Ruang kerja</a><a href="#sChat" data-sn="sChat">Obrolan di ponsel</a><a href="#sMemori" data-sn="sMemori">Memori</a><a href="#sData" data-sn="sData">Data pribadi</a><a href="#sSamb" data-sn="sSamb">Sambungan</a></nav>
      <section class="card set-k" aria-labelledby="sTamp"><div class="card-b"><h3 id="sTamp">Tampilan</h3>
        <p class="muted">Pilih yang paling nyaman di matamu.</p>
        <div class="set-pil" role="group" aria-label="Pilih tampilan"><button type="button" class="btn" data-th="light">${icon('sun', 20)} Terang</button><button type="button" class="btn" data-th="dark">${icon('moon', 20)} Gelap</button></div>
        <div class="set-row"><div><b>Kualitas</b><p class="muted">Otomatis menyesuaikan diri dengan perangkatmu. Hemat mematikan efek kaca buram, suasana hidup, dan membatasi 30 gambar per detik, supaya komputer tetap ringan.</p></div><div class="set-pil" role="group" aria-label="Kualitas"><button type="button" class="btn" data-ku="otomatis" aria-pressed="false">Otomatis</button><button type="button" class="btn" data-ku="tinggi" aria-pressed="false">Tinggi</button><button type="button" class="btn" data-ku="hemat" aria-pressed="false">Hemat</button></div></div>
        <div class="set-row"><div><b>Suasana hidup</b><p class="muted">Seberapa ramai kantor 3D: orang berjalan, ngobrol, mampir ke taman. Mati paling hemat baterai.</p></div><div class="set-pil" role="group" aria-label="Suasana hidup"><button type="button" class="btn" data-su="penuh" aria-pressed="false">Penuh</button><button type="button" class="btn" data-su="ringan" aria-pressed="false">Ringan</button><button type="button" class="btn" data-su="mati" aria-pressed="false">Mati</button></div></div>
        <div class="set-row"><div><b>Suara asisten</b><p class="muted">Asisten membacakan balasannya dengan suara.</p></div><button type="button" class="btn" id="sSuara" aria-pressed="false">Mati</button></div>
        <div class="set-row"><div><b>Tes suara</b><p class="muted" id="sSuaraInfo" role="status"></p></div><button type="button" class="btn" id="sTes">Tes suara</button></div></div></section>
      <section class="card set-k" aria-labelledby="sAkun"><div class="card-b"><h3 id="sAkun">Akun</h3><div id="sAkunBox">${memuat()}</div></div></section>
      <section class="card set-k" aria-labelledby="sRuang"><div class="card-b"><h3 id="sRuang">Ruang kerja dan undangan</h3><div id="sRuangBox">${memuat()}</div></div></section>
      <section class="card set-k" aria-labelledby="sChat"><div class="card-b"><h3 id="sChat">Obrolan di ponsel</h3><div id="sChatBox"></div></div></section>
      <section class="card set-k" aria-labelledby="sMemori"><div class="card-b"><h3 id="sMemori">Memori</h3><div id="sMemoriBox"></div></div></section>
      <section class="card set-k" aria-labelledby="sData"><div class="card-b"><h3 id="sData">Data pribadimu</h3><div id="sDataBox"></div></div></section>
      <section class="card set-k" aria-labelledby="sSamb"><div class="card-b"><h3 id="sSamb">Sambungan</h3><div id="sSambBox">${memuat()}</div></div></section>
    </div>`;
    const $ = (q) => root.querySelector(q);
    root.querySelectorAll('[data-sn]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); root.querySelector('#' + a.dataset.sn)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); root.querySelectorAll('[data-sn]').forEach((x) => x.classList.toggle('on', x === a)); }));
    const tema = () => document.documentElement.dataset.theme;
    const segar = () => root.querySelectorAll('[data-th]').forEach((b) => { const on = tema() === b.dataset.th; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    root.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { window.setTheme(b.dataset.th); segar(); }));
    segar();
    const suasanaNow = () => { try { const v = localStorage.getItem('suasana-hidup'); if (v) return v; } catch { /* bawaan */ } return 'ringan'; };
    const suasanaSegar = () => root.querySelectorAll('[data-su]').forEach((b) => { const on = suasanaNow() === b.dataset.su; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    root.querySelectorAll('[data-su]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('suasana-hidup', b.dataset.su); } catch { /* sesi ini saja */ } window.dispatchEvent(new CustomEvent('raiverse:suasana', { detail: { tingkat: b.dataset.su } })); suasanaSegar(); }));
    suasanaSegar();
    const kualNow = () => { try { const v = localStorage.getItem('kualitas'); if (v === 'tinggi' || v === 'hemat') return v; } catch { /* bawaan */ } return 'otomatis'; };
    const kualSegar = () => root.querySelectorAll('[data-ku]').forEach((b) => { const on = kualNow() === b.dataset.ku; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    root.querySelectorAll('[data-ku]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('kualitas', b.dataset.ku); } catch { /* sesi ini saja */ } window.dispatchEvent(new CustomEvent('raiverse:kualitas', { detail: { pilihan: b.dataset.ku } })); kualSegar(); }));
    kualSegar();
    const suara = () => { const on = tts.isOn?.(); $('#sSuara').textContent = on ? 'Nyala' : 'Mati'; $('#sSuara').setAttribute('aria-pressed', String(!!on)); $('#sSuara').classList.toggle('on', !!on); };
    $('#sSuara').onclick = () => { tts.set({ on: !tts.isOn() }); suara(); };
    const info = () => { const el = $('#sSuaraInfo'); if (!el) return; const d = tts.diagnosa(); el.textContent = tts.kenapaDiam(d) || ('Siap: ' + d.jumlahSuara + ' suara tersedia' + (d.adaIndonesia ? ', termasuk bahasa Indonesia.' : '.')); };
    $('#sTes').onclick = () => { tts.test(); setTimeout(info, 600); };
    this._suaraH = () => info(); window.addEventListener('raiverse:suara-berubah', this._suaraH); window.addEventListener('raiverse:suara-gagal', this._suaraH);
    suara(); info();
    this.bersihSambungan = pasangSambungan($('#sChatBox'));
    this.dataPribadi($('#sDataBox'));
    renderMemori($('#sMemoriBox'));   // "Yang aku tahu tentang kamu" pindah ke sini dari layar obrolan
    this.muat();
  },
  /** unduh salinan data, keluar dari semua perangkat, dan hapus akun: rute /api/me/* sudah ada di peladen */
  dataPribadi(box) {
    box.innerHTML = `<p class="muted">Kamu berhak membawa pulang atau menghapus datamu kapan saja.</p>
      <div class="set-row"><div><b>Unduh salinan datamu</b><p class="muted">Berkas berisi catatan, hasil, dan pengaturanmu.</p></div><button type="button" class="btn" id="dExp">${icon('download', 18)} Unduh</button></div>
      <div class="set-row"><div><b>Keluar dari semua perangkat</b><p class="muted">Berguna bila ponsel atau komputermu hilang.</p></div><button type="button" class="btn" id="dRev">Keluar semua</button></div>
      <div class="set-row"><div><b>Hapus akun dan data</b><p class="muted">Tidak bisa dibatalkan.</p></div><button type="button" class="btn" id="dDel">Hapus akunku</button></div>`;
    box.querySelector('#dExp').onclick = async () => { try { const r = await api('GET', '/api/me/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })); a.download = 'data-raiverse.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Salinan datamu sudah diunduh.', 'ok'); } catch { /* api() sudah memberi tahu */ } };
    box.querySelector('#dRev').onclick = () => modal('Keluar dari semua perangkat?', '<p>Kamu perlu masuk lagi di tiap perangkat.</p>', { actions: [{ label: 'Batal' }, { label: 'Keluar semua', kind: 'primary', run: async () => { await api('POST', '/api/me/sessions/revoke', {}); toast('Selesai. Kamu akan diminta masuk lagi.', 'ok'); setTimeout(() => location.reload(), 1200); } }] });
    box.querySelector('#dDel').onclick = () => modal('Hapus akun dan semua datamu?', '<p>Semua catatan, hasil, dan pengaturanmu dihapus <b>selamanya</b>. Ketik <b>HAPUS</b> untuk memastikan.</p><input class="input" name="konfirmasi" aria-label="Ketik HAPUS" autocomplete="off">', { actions: [{ label: 'Batal' }, { label: 'Hapus selamanya', kind: 'primary', run: async (b) => { if (b.querySelector('[name=konfirmasi]').value.trim() !== 'HAPUS') { toast('Ketik HAPUS dulu ya.', 'warn'); return false; } await api('POST', '/api/me/delete', { konfirmasi: 'HAPUS AKUN SAYA' }); toast('Akunmu sudah dihapus.', 'ok'); setTimeout(() => location.reload(), 1500); } }] });
  },
  async muat() {
    const root = this.root; if (!root) return;
    let me, cfg = {};
    try {
      me = await fetch('/api/auth/me').then((r) => r.json());
      cfg = await fetch('/api/drive/config').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    } catch { for (const id of ['sAkunBox', 'sRuangBox', 'sSambBox']) root.querySelector('#' + id).innerHTML = galat(ramah('', 0), '<button type="button" class="btn" data-ulangi>Coba lagi</button>'); root.querySelector('[data-ulangi]')?.addEventListener('click', () => this.mount(root)); return; }
    if (!this.root) return;
    this.akun(me); this.ruang(me); this.sambungan(me, cfg);
  },
  akun(me) {
    const box = this.root.querySelector('#sAkunBox'); const u = me.user;
    if (!me.configured || !u) { box.innerHTML = kosong('Kamu memakai ruang kerjamu sendiri', 'Belum perlu masuk. Saat aplikasi dibuka untuk umum, kamu akan masuk dengan akun Google.', me.configured ? '<a class="btn primary" href="/auth/google">Masuk dengan Google</a>' : ''); return; }
    box.innerHTML = `<div class="set-row"><div class="set-akun">${u.picture ? `<img src="${esc(u.picture)}" alt="" width="48" height="48" referrerpolicy="no-referrer">` : icon('user', 32)}<div><b>${esc(u.name || u.email)}</b><p class="muted">${esc(u.email)}</p></div></div><a class="btn" href="/auth/logout">Keluar</a></div>`;
  },
  ruang(me) {
    const box = this.root.querySelector('#sRuangBox'); const u = me.user; const ws = me.workspace || {};
    if (!u) { box.innerHTML = kosong('Ruang kerjamu siap dipakai', 'Undangan dan anggota akan muncul di sini setelah kamu masuk dengan akun.'); return; }
    const role = ws.role; const pemilik = role === 'owner'; const kelola = pemilik || role === 'admin';
    box.innerHTML = `<p><b>${esc(ws.name || 'Ruang kerjaku')}</b> <span class="chip">${esc(PERAN[role] || 'Anggota')}</span></p>
      ${me.workspaces?.length > 1 ? `<div class="set-list" aria-label="Ruang kerja yang kamu punya">${me.workspaces.map((w) => `<div class="set-row"><span><b>${esc(w.name)}</b> <small class="muted">${esc(PERAN[w.role] || '')}${w.personal ? ' · milikmu' : ` · milik ${esc(w.ownerName)}`}</small></span>${w.id === ws.id ? '<span class="chip">Dipakai</span>' : `<button type="button" class="btn sm" data-ws="${esc(w.id)}">Buka</button>`}</div>`).join('')}</div>` : ''}
      ${pemilik ? `<div class="set-row"><label class="sr-only" for="wsn">Nama ruang kerja</label><input class="input" id="wsn" value="${esc(ws.name || '')}" placeholder="Nama ruang kerja"><button type="button" class="btn" id="wsr">Ganti nama</button></div>` : ''}
      <h4>Orang di ruang kerja ini</h4><div id="wsm" class="set-list">${memuat('Memuat daftar…')}</div>
      ${kelola ? `<div class="set-row"><label class="sr-only" for="invr">Undang sebagai</label><select class="input" id="invr"><option value="member">Undang sebagai anggota</option>${pemilik ? '<option value="admin">Undang sebagai pengelola</option>' : ''}</select><button type="button" class="btn primary" id="invg">${icon('link', 18)} Buat tautan undangan</button></div><div id="invo" aria-live="polite"></div>` : ''}`;
    box.querySelectorAll('[data-ws]').forEach((b) => (b.onclick = async () => { await api('POST', '/api/ws/switch', { id: b.dataset.ws }); location.reload(); }));
    box.querySelector('#wsr')?.addEventListener('click', async () => { await api('POST', '/api/ws/rename', { name: box.querySelector('#wsn').value }); toast('Nama ruang kerja sudah diganti.', 'ok'); });
    const anggota = async () => {
      const el = box.querySelector('#wsm'); if (!el) return;
      try {
        const { members } = await api('GET', '/api/ws/members');
        el.innerHTML = members.map((m) => `<div class="set-row"><span>${esc(m.name || m.email)} <small class="muted">${esc(m.email || '')}</small></span>${m.role === 'owner' || !kelola || m.userId === u.id ? `<span class="chip">${esc(PERAN[m.role] || m.role)}</span>` : `<span class="set-aksi">${pemilik ? `<label class="sr-only" for="r-${esc(m.userId)}">Peran ${esc(m.name || m.email)}</label><select class="input" id="r-${esc(m.userId)}" data-mrole="${esc(m.userId)}"><option value="member" ${m.role === 'member' ? 'selected' : ''}>Anggota</option><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Pengelola</option></select>` : `<span class="chip">${esc(PERAN[m.role])}</span>`}<button type="button" class="btn sm" data-mdel="${esc(m.userId)}" aria-label="Keluarkan ${esc(m.name || m.email)}">Keluarkan</button></span>`}</div>`).join('') || kosong('Baru kamu sendiri', 'Buat tautan undangan untuk mengajak orang lain.');
        el.querySelectorAll('[data-mrole]').forEach((s) => (s.onchange = async () => { await api('POST', '/api/ws/member', { accountId: s.dataset.mrole, role: s.value }); toast('Sudah diperbarui.', 'ok'); }));
        el.querySelectorAll('[data-mdel]').forEach((b) => (b.onclick = () => modal('Keluarkan orang ini?', '<p>Ia tidak akan bisa membuka ruang kerja ini lagi. Kamu bisa mengundangnya kembali kapan saja.</p>', { actions: [{ label: 'Batal' }, { label: 'Keluarkan', kind: 'primary', run: async () => { await api('POST', '/api/ws/member', { accountId: b.dataset.mdel, role: 'remove' }); toast('Sudah dikeluarkan.', 'ok'); anggota(); } }] })));
      } catch { el.innerHTML = galat(ramah('', 0)); }
    };
    anggota();
    box.querySelector('#invg')?.addEventListener('click', async () => {
      const r = await api('POST', '/api/ws/invite', { role: box.querySelector('#invr').value }); const link = location.origin + r.path;
      box.querySelector('#invo').innerHTML = `<div class="set-row"><label class="sr-only" for="invl">Tautan undangan</label><input class="input" id="invl" readonly value="${esc(link)}"><button type="button" class="btn" id="invc">Salin</button></div><p class="muted">Berlaku 7 hari. Siapa pun yang membukanya dan masuk dengan akun Google akan bergabung.</p>`;
      box.querySelector('#invc').onclick = () => navigator.clipboard?.writeText(link).then(() => toast('Tautan sudah disalin.', 'ok')).catch(() => toast('Salin manual dari kolom ya.', 'warn'));
    });
  },
  sambungan(me, cfg) {
    const box = this.root.querySelector('#sSambBox'); const u = me.user; const pemilik = (me.workspace || {}).role === 'owner' || !u;
    const google = u ? (u.drive ? `<p class="set-ok">${icon('check', 18)} Google tersambung${cfg.root ? ` · <a href="https://drive.google.com/drive/folders/${esc(cfg.root)}" target="_blank" rel="noopener">buka foldermu</a>` : ''}</p>${pemilik ? `<div class="set-pil"><button type="button" class="btn" data-dr="setup">Siapkan folder</button><button type="button" class="btn" data-dr="push">Kirim Catatan ke Google</button><button type="button" class="btn" data-dr="pull">Ambil dari Google</button></div><p class="muted" id="drres" role="status"></p>` : ''}` : `<p>Belum tersambung. Masuk lagi dengan Google dan izinkan akses ke Drive.</p><a class="btn primary" href="/auth/google">Sambungkan Google</a>`) : '<p>Setelah kamu masuk dengan akun, Google bisa disambungkan di sini.</p>';
    box.innerHTML = `<div class="set-k2"><h4>Google</h4>${google}</div>
      <div class="set-k2"><h4>WhatsApp</h4><p>Untuk mengirim pesan dan pengingat lewat WhatsApp, cukup minta aray. Ia akan memandumu langkah demi langkah.</p><button type="button" class="btn" data-pemandu="Tolong sambungkan WhatsApp-ku">${icon('chat', 18)} Minta aray menyambungkan</button></div>`;
    box.querySelector('[data-pemandu]')?.addEventListener('click', (e) => navigate('dashboard', { mulai: e.currentTarget.dataset.pemandu }));
    const res = () => box.querySelector('#drres'); const say = (t) => { if (res()) res().textContent = t; };
    box.querySelectorAll('[data-dr]').forEach((b) => (b.onclick = async () => {
      b.disabled = true; say('Sebentar ya, lagi diproses…');
      try {
        let r = await api('POST', '/api/drive/' + b.dataset.dr);
        if (b.dataset.dr === 'pull') { while (r.running) { say(`Mengambil dari Google… ${r.done || 0} dari ${r.total || '?'} berkas`); await new Promise((ok) => setTimeout(ok, 2000)); r = await api('GET', '/api/drive/pull-status'); } if (r.error) throw new Error(r.error); r = { ...r.result }; }
        say(b.dataset.dr === 'setup' ? 'Folder sudah siap.' : b.dataset.dr === 'push' ? `Terkirim: ${r.created} baru, ${r.updated} diperbarui.` : `Diambil: ${r.added} baru, ${r.changed} berubah.`);
      } catch (err) { say(ramah(err.message, 0)); } finally { b.disabled = false; }
    }));
  },
  update() { /* data akun dimuat sekali per buka */ },
  unmount() { window.removeEventListener('raiverse:suara-berubah', this._suaraH); window.removeEventListener('raiverse:suara-gagal', this._suaraH); this.bersihSambungan?.(); this.root = null; },
};
