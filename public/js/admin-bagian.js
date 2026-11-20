// Konsol pengelola platform (bagian 2): pembantu tampilan + bagian Pengguna, Integrasi, Staf, Keamanan, Data.
// Hanya terjangkau lewat #admin oleh pengelola platform (lihat docs/KONSOL-ADMIN.md). Berkas ini dikecualikan dari tes kata terlarang
// lewat DAFTAR_PUTIH_PENGELOLA di kamus-ui.js karena memang memuat istilah teknis. Semua teks dinamis di-esc; tanpa emoji; tanpa warna merah.
import { esc, toast, modal } from './core.js';
import { icon } from './icons.js';
import { kosong, memuat, galat, unduh } from './awam.js';

/** satu pintu ke /api/admin: header anti-CSRF, galat dalam bahasa sehari-hari, tidak pernah mencetak isi permintaan */
export async function adm(method, path, body) {
  let res;
  try { res = await fetch('/api/admin/' + path, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Raiverse-Admin': '1' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }); }
  catch { toast('Tidak bisa menghubungi server.', 'bad'); throw new Error('jaringan'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const m = res.status === 403 ? 'Bagian ini hanya untuk pengelola platform.' : j.error || 'Ada yang belum berhasil.'; toast(esc(m), 'bad'); throw Object.assign(new Error(m), { status: res.status }); }
  return j;
}
export const bytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' KB' : (n || 0) + ' B');
export const tgl = (t) => (t ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const lama = (d) => (d >= 86400 ? `${Math.floor(d / 86400)} hari ${Math.floor((d % 86400) / 3600)} jam` : d >= 3600 ? `${Math.floor(d / 3600)} jam ${Math.floor((d % 3600) / 60)} menit` : `${Math.floor(d / 60)} menit`);
export const chip = (t, tone = '') => `<span class="chip ${tone === 'ok' ? 'st-selesai' : tone === 'warn' ? 'st-perlu' : ''}">${esc(t)}</span>`;
export const tile = (label, value, sub = '') => `<div class="adm-tile"><span>${esc(label)}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
export const kartu = (id, judul, isi, bantuan = '') => `<section class="card set-k adm-k" aria-labelledby="${id}"><div class="card-b"><h3 id="${id}">${esc(judul)}</h3>${bantuan ? `<p class="muted">${bantuan}</p>` : ''}${isi}</div></section>`;
export const baris = (kiri, kanan = '') => `<div class="adm-item"><div class="adm-main">${kiri}</div>${kanan ? `<div class="set-aksi">${kanan}</div>` : ''}</div>`;
export const tombol = (label, attrs = '', kind = '', ic = '') => `<button type="button" class="btn ${kind}" ${attrs}>${ic ? icon(ic, 18) + ' ' : ''}${esc(label)}</button>`;

/** aksi yang merusak atau berdampak luas: pengelola wajib mengetik ulang kalimat konfirmasi; server memeriksa lagi */
export function konfirmasi({ judul, isi, kalimat, tombol: label = 'Lanjutkan', alasan = false, jalan }) {
  modal(esc(judul), `<p>${isi}</p><label class="f" for="kfm">Ketik persis: <b>${esc(kalimat)}</b></label><input class="input" id="kfm" autocomplete="off" spellcheck="false">${alasan ? '<label class="f" for="kal">Alasan (minimal 10 karakter, dicatat di log audit)</label><input class="input" id="kal" autocomplete="off">' : ''}`, {
    actions: [{ label: 'Batal' }, { label, kind: 'primary', run: async (el) => {
      if (el.querySelector('#kfm').value.trim() !== kalimat) { toast('Kalimat konfirmasi belum sama persis.', 'warn'); return false; }
      const a = alasan ? el.querySelector('#kal').value.trim() : undefined;
      if (alasan && a.length < 10) { toast('Tulis alasan minimal 10 karakter.', 'warn'); return false; }
      await jalan({ konfirmasi: kalimat, alasan: a });
    } }],
  });
}
/** pasang bagian: ambil data, tampilkan memuat / galat, lalu panggil render */
export async function isi(el, path, render) {
  el.innerHTML = memuat('Memuat…');
  try { const d = await adm('GET', path); if (el.isConnected) { el.innerHTML = ''; render(d); } }
  catch (e) { if (el.isConnected) el.innerHTML = galat(esc(e.message || 'Tidak bisa dimuat.'), '<button type="button" class="btn" data-ulang>Coba lagi</button>'); el.querySelector('[data-ulang]')?.addEventListener('click', () => isi(el, path, render)); }
}

// ═════════════════════ Pengguna dan ruang kerja ═════════════════════
export const Pengguna = {
  cari: '', hal: 1,
  mount(el) {
    const muat = () => isi(el, `pengguna?cari=${encodeURIComponent(this.cari)}&hal=${this.hal}`, (d) => {
      const maks = Math.max(1, Math.ceil(d.total / d.perHalaman));
      el.innerHTML = kartu('pgCari', 'Akun', `<form class="set-row" id="pgForm" role="search"><label class="sr-only" for="pgQ">Cari akun atau ruang kerja</label><input class="input" id="pgQ" type="search" maxlength="60" placeholder="Cari nama atau email" value="${esc(this.cari)}">${tombol('Cari', 'type="submit"', 'primary', 'search')}</form>
        <div class="set-list" id="pgList">${d.pengguna.map((u) => baris(`<b>${esc(u.nama || u.email)}</b> <small class="muted">${esc(u.email)}</small><div class="adm-meta">${u.utama ? chip('Pemilik kantor utama') : ''}${u.ditangguhkan ? chip('Ditangguhkan', 'warn') : ''}${u.drive ? chip('Google tersambung') : ''}${chip(`${u.ruangKerja.length} ruang kerja`)}${chip(`${u.sesi} sesi`)}<small class="muted">Masuk terakhir ${esc(tgl(u.masukTerakhir))}</small></div>`,
          `${u.utama ? '' : tombol(u.ditangguhkan ? 'Aktifkan' : 'Tangguhkan', `data-tg="${esc(u.id)}" data-ya="${u.ditangguhkan ? 0 : 1}" aria-label="${u.ditangguhkan ? 'Aktifkan' : 'Tangguhkan'} ${esc(u.email)}"`, 'sm')}${tombol('Ekspor data', `data-ek="${esc(u.id)}" data-em="${esc(u.email)}" aria-label="Ekspor data ${esc(u.email)}"`, 'sm')}${u.utama ? '' : tombol('Hapus', `data-hp="${esc(u.id)}" data-em="${esc(u.email)}" aria-label="Hapus akun ${esc(u.email)}"`, 'sm')}`)).join('') || kosong('Tidak ada akun yang cocok')}</div>
        <div class="set-row"><span class="muted">${d.total} akun, halaman ${d.halaman} dari ${maks}</span><span class="set-aksi">${tombol('Sebelumnya', `data-pg="-1" ${d.halaman <= 1 ? 'disabled' : ''}`, 'sm')}${tombol('Berikutnya', `data-pg="1" ${d.halaman >= maks ? 'disabled' : ''}`, 'sm')}</span></div>
        <p class="muted">${esc(d.catatan)}</p>`)
        + kartu('pgRuang', 'Ruang kerja', `<div class="set-list">${d.ruangKerja.map((w) => baris(`<b>${esc(w.nama)}</b> <small class="muted">${esc(w.id)}</small><div class="adm-meta">${chip(w.pemilik || 'tanpa pemilik')}${chip(`${w.anggota} anggota`)}${chip(`penyimpanan ${w.penyimpanan}`)}${w.utama ? chip('Kantor utama', 'ok') : ''}</div>`)).join('') || kosong('Belum ada ruang kerja')}</div>${d.totalRuang > 50 ? `<p class="muted">Menampilkan 50 dari ${d.totalRuang}. Pakai kolom cari untuk mempersempit.</p>` : ''}`);
      el.querySelector('#pgForm').onsubmit = (e) => { e.preventDefault(); this.cari = el.querySelector('#pgQ').value.trim(); this.hal = 1; muat(); };
      el.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = () => { this.hal = Math.max(1, this.hal + Number(b.dataset.pg)); muat(); }));
      el.querySelectorAll('[data-tg]').forEach((b) => (b.onclick = async () => { await adm('POST', 'pengguna/tangguhkan', { id: b.dataset.tg, ya: b.dataset.ya === '1' }); toast(b.dataset.ya === '1' ? 'Akun ditangguhkan, sesinya ditutup.' : 'Akun diaktifkan lagi.', 'ok'); muat(); }));
      el.querySelectorAll('[data-ek]').forEach((b) => (b.onclick = () => modal('Ekspor data pribadi', `<p>Berkas ini memuat data pribadi <b>${esc(b.dataset.em)}</b>. Alasan wajib diisi dan dicatat di log audit.</p><label class="f" for="eal">Alasan</label><input class="input" id="eal" autocomplete="off" placeholder="Mis. permintaan pemilik akun lewat email">`, { actions: [{ label: 'Batal' }, { label: 'Unduh berkas', kind: 'primary', run: async (m) => { const a = m.querySelector('#eal').value.trim(); if (a.length < 10) { toast('Tulis alasan minimal 10 karakter.', 'warn'); return false; } const r = await adm('POST', 'pengguna/ekspor', { id: b.dataset.ek, alasan: a }); unduh(`data-${b.dataset.em.replace(/[^\w.-]+/g, '_')}.json`, JSON.stringify(r, null, 1), 'application/json'); toast('Berkas diunduh. Simpan dengan aman.', 'ok'); } }] })));
      el.querySelectorAll('[data-hp]').forEach((b) => (b.onclick = () => konfirmasi({ judul: 'Hapus akun ini?', isi: `Akun <b>${esc(b.dataset.em)}</b> dan ruang kerja pribadinya akan dihapus permanen setelah masa tunggu di tempat sampah server. Ini tidak bisa dibatalkan dari sini.`, kalimat: `HAPUS ${b.dataset.em}`, tombol: 'Hapus akun', alasan: true, jalan: async (k) => { await adm('POST', 'pengguna/hapus', { id: b.dataset.hp, ...k }); toast('Akun dihapus.', 'ok'); muat(); } })));
    });
    muat();
  },
};

// ═════════════════════ Integrasi ═════════════════════
export const Integrasi = {
  mount(el) {
    const muat = () => isi(el, 'integrasi', (d) => {
      const g = d.google, ap = g.konektorAppsScript, n = d.n8n;
      el.innerHTML = kartu('inGoogle', 'Google', `<div class="adm-kvs">${[['Masuk dengan Google', g.loginDiatur ? 'Diatur' : 'Belum diatur'], ['Login wajib', g.loginWajib ? 'Ya' : 'Belum (belum ada yang masuk)'], ['Kunci pemilih berkas', g.pickerDiisi ? 'Terisi' : 'Kosong'], ['Alamat balik (redirect)', g.redirectDiisi ? 'Terisi' : 'Kosong'], ['Konektor Apps Script', ap.tersambung ? 'Tersambung' : ap.urlTerisi ? 'Terisi, belum aktif' : 'Belum diatur'], ['Alamat konektor', ap.host || '-']].map(([k, v]) => `<div class="adm-kv"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div><p class="muted">Rahasia Google tidak pernah ditampilkan. Mengubah OAuth dilakukan di berkas .env server.</p>`)
        + kartu('inN8n', 'n8n (otomasi)', `<div class="adm-kvs">${[['Alamat', n.alamat], ['Kunci akses', n.kunciDiisi ? 'Terisi' : 'Kosong'], ['Status', n.tersambung ? 'Tersambung' : n.menyala ? 'Menyala, belum tersambung' : 'Belum menyala'], ['Alur berlabel ' + n.label, n.alurBerlabelRaiverse ?? '-']].map(([k, v]) => `<div class="adm-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>${n.pesan ? `<p class="muted">${esc(n.pesan)}</p>` : ''}
          <div class="adm-kvs">${[['Kabar balik n8n', `lewat ${d.kabarBalik.lewat}`], ['Pengambil berkala', d.kabarBalik.berjalan ? `Berjalan, tiap ${Math.round(d.kabarBalik.tiapMs / 1000)} detik` : d.kabarBalik.otomasiAktif ? 'Belum berjalan' : 'Menunggu otomasi aktif pertama'], ['Pengambilan terakhir', d.kabarBalik.terakhir ? tgl(d.kabarBalik.terakhir) : 'belum pernah'], ['Hasil diambil (terakhir, total)', `${d.kabarBalik.diambilTerakhir}, ${d.kabarBalik.totalDiambil}`], ['Otomasi aktif berkabar ke RAIVERSE', d.kabarBalik.otomasiAktif], ['Panggilan balik webhook', d.kabarBalik.webhookMasuk.perluAlamatPublik ? 'Perlu alamat publik (n8n di server lain, alamat publik belum diatur)' : 'Tidak terhalang']].map(([k, v]) => `<div class="adm-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>${d.kabarBalik.galat ? `<p class="muted">Galat terakhir: ${esc(d.kabarBalik.galat)}</p>` : ''}<p class="muted">${esc(d.kabarBalik.webhookMasuk.catatan)}</p>
          <div class="set-pil">${tombol('Cek sekarang', 'data-cek', '', 'repeat')}${tombol('Nonaktifkan staf n8n', `data-nonaktif ${d.skripNonaktifkanStaf ? '' : 'disabled'}`, '', 'pause')}</div>
          <p class="muted">${d.skripNonaktifkanStaf ? 'Menjalankan skrip tetap scripts/n8n-staf-nonaktifkan.mjs. Tidak ada alur yang dihapus.' : 'Tombol ini aktif setelah skrip scripts/n8n-staf-nonaktifkan.mjs tersedia di server. Belum ada.'}</p><pre class="adm-out" id="nonOut" hidden></pre>`)
        + kartu('inMcp', 'Server MCP', `<div class="set-list">${d.mcp.map((m) => baris(`<b>${esc(m.nama)}</b> <small class="muted">${esc(m.alamat)}</small><div class="adm-meta">${chip(m.aktif ? 'Aktif' : 'Mati', m.aktif ? 'ok' : '')}${m.punyaHeader ? chip('Memakai header rahasia') : ''}</div>`, `${tombol('Uji', `data-mu="${esc(m.id)}" aria-label="Uji ${esc(m.nama)}"`, 'sm')}${tombol('Hapus', `data-mh="${esc(m.id)}" data-nm="${esc(m.nama)}" aria-label="Hapus ${esc(m.nama)}"`, 'sm')}`)).join('') || kosong('Belum ada server MCP')}</div>
          <form id="mcpF" class="adm-form"><label class="f" for="mcpN">Nama</label><input class="input" id="mcpN" maxlength="40" required><label class="f" for="mcpU">Alamat (http atau https)</label><input class="input" id="mcpU" type="url" required placeholder="https://contoh.id/mcp"><label class="f" for="mcpH">Header rahasia (opsional, satu baris: Nama: nilai)</label><input class="input" id="mcpH" autocomplete="off">${tombol('Tambah server', 'type="submit"', 'primary', 'plus')}</form><p class="muted">Alamat diperiksa anti-SSRF: metadata awan dan aplikasi ini sendiri ditolak.</p>`)
        + kartu('inWa', 'WhatsApp dan email', `<div class="set-list">${baris(`<b>WhatsApp</b><div class="adm-meta">${chip(d.whatsapp.status, d.whatsapp.url && d.whatsapp.kunci && d.whatsapp.aktif ? 'ok' : '')}</div>`)}${baris(`<b>Email</b><div class="adm-meta">${chip(d.email.status, d.email.pengirim ? 'ok' : '')}</div>`)}</div><p class="muted">Pengaturan ini ada di berkas .env server (WAHA_URL, WAHA_API_KEY, N8N_MAIL_FROM). Konsol hanya menampilkan statusnya dengan jujur.</p>`);
      el.querySelector('[data-cek]').onclick = async (e) => { e.currentTarget.disabled = true; try { const r = await adm('POST', 'integrasi/n8n/cek-sekarang', {}); toast(`Pengecekan selesai: ${r.diambil} hasil baru diambil.`, 'ok'); muat(); } catch { e.target.disabled = false; } };
      el.querySelector('[data-nonaktif]')?.addEventListener('click', () => konfirmasi({ judul: 'Nonaktifkan staf n8n?', isi: 'Alur staf berlabel RAIVERSE dimatikan lewat skrip tetap. Tidak ada yang dihapus. Pekerjaan staf yang sedang bergantung pada n8n akan berhenti.', kalimat: 'NONAKTIFKAN STAF N8N', tombol: 'Nonaktifkan', jalan: async (k) => { const r = await adm('POST', 'integrasi/n8n/nonaktifkan-staf', k); const o = el.querySelector('#nonOut'); o.hidden = false; o.textContent = r.keluaran || '(tanpa keluaran)'; toast(r.ok ? 'Selesai.' : 'Skrip selesai dengan catatan, lihat keluaran.', r.ok ? 'ok' : 'warn'); } }));
      el.querySelectorAll('[data-mu]').forEach((b) => (b.onclick = async () => { b.disabled = true; try { const r = await adm('POST', 'integrasi/mcp/uji', { id: b.dataset.mu }); toast(r.ok ? `Tersambung, ${r.jumlahAlat} alat terlihat.` : esc(r.pesan), r.ok ? 'ok' : 'warn'); } finally { b.disabled = false; } }));
      el.querySelectorAll('[data-mh]').forEach((b) => (b.onclick = () => konfirmasi({ judul: 'Hapus server MCP?', isi: `Server <b>${esc(b.dataset.nm)}</b> dilepas dari kantor utama.`, kalimat: `HAPUS ${b.dataset.nm}`, tombol: 'Hapus', jalan: async (k) => { await adm('POST', 'integrasi/mcp/hapus', { id: b.dataset.mh, ...k }); toast('Server dihapus.', 'ok'); muat(); } })));
      el.querySelector('#mcpF').onsubmit = async (e) => {
        e.preventDefault(); const h = el.querySelector('#mcpH').value.trim(), headers = {}; if (h) { const i = h.indexOf(':'); if (i < 1) { toast('Header ditulis seperti Nama: nilai.', 'warn'); return; } headers[h.slice(0, i).trim()] = h.slice(i + 1).trim(); }
        await adm('POST', 'integrasi/mcp', { nama: el.querySelector('#mcpN').value, url: el.querySelector('#mcpU').value, headers }); toast('Server MCP ditambahkan.', 'ok'); muat();
      };
    });
    muat();
  },
};

// ═════════════════════ Staf dan katalog ═════════════════════
export const Staf = {
  mount(el) {
    const muat = () => isi(el, 'staf', (d) => {
      const b = d.bendera, m = d.mesin;
      el.innerHTML = kartu('sfJml', 'Katalog staf', `<div class="adm-tiles">${tile('Spesifikasi', d.jumlah.total)}${tile('Lengkap', d.jumlah.lengkap, 'siap dijalankan')}${tile('Rintisan', d.jumlah.rintisan, 'masih kerangka')}${tile('Karyawan tertaut', d.karyawanTertaut)}</div>
        <div class="set-list">${d.perDivisi.map((x) => baris(`<b>${esc(x.nama)}</b>`, `${chip(`${x.lengkap} lengkap`, x.lengkap ? 'ok' : '')}${chip(`${x.rintisan} rintisan`)}${chip(`${x.total} total`)}`)).join('')}</div>`)
        + kartu('sfMesin', 'Mesin staf', `<p>Mesin yang dipakai sekarang: <b>${esc(m.efektif)}</b>${m.envMenimpa ? ` (dipaksa oleh env RAIVERSE_STAFF_ENGINE=${esc(m.envMenimpa)})` : ''}.</p>
          <div class="set-pil" role="group" aria-label="Pilih mesin staf">${['native', 'n8n'].map((x) => tombol(x === 'native' ? 'Native (di dalam aplikasi)' : 'n8n', `data-eng="${x}" aria-pressed="${m.pilihan === x}"`, m.pilihan === x ? 'on' : '')).join('')}</div>
          <p class="muted">Pilihan disimpan di pengaturan kantor utama. Spesifikasi yang butuh n8n selalu lewat n8n.</p>
          <div class="set-row"><div><b>Staf sebagai alur n8n (staffModel)</b><p class="muted">Bendera lama fase P0. Menyalakannya mengikat staf ke alur n8n.</p></div>${tombol(b.staffModel ? 'Nyala' : 'Mati', `data-sm aria-pressed="${b.staffModel}"`, b.staffModel ? 'on' : '')}</div>`)
        + kartu('sfBen', 'Bendera lain', `<div class="set-list">${[['Otonomi tim', b.autonomy], ['Setujui otomatis', b.autoApprove], ['Aktifkan alat otomatis', b.autoActivate], ['Belajar dari pekerjaan', b.learning], ['Kumpulkan contoh latihan', b.collectTraining], ['Anggaran AI ditutup', b.aiDitutup]].map(([k, v]) => baris(`<b>${esc(k)}</b>`, chip(v ? 'Nyala' : 'Mati', v ? 'ok' : ''))).join('')}${[['Mode umum', d.env.modeUmum ? 'Nyala' : 'Mati'], ['Pendaftaran', d.env.pendaftaran], ['Muat ruang kerja malas', d.env.muatMalas ? 'Nyala' : 'Mati'], ['Mode penyimpanan (env)', d.env.modePenyimpananEnv || 'bawaan']].map(([k, v]) => baris(`<b>${esc(k)}</b> <small class="muted">dari env, hanya baca</small>`, chip(v))).join('')}</div>`);
      el.querySelectorAll('[data-eng]').forEach((x) => (x.onclick = async () => { await adm('POST', 'staf/bendera', { staffEngine: x.dataset.eng }); toast('Mesin staf diganti.', 'ok'); muat(); }));
      el.querySelector('[data-sm]').onclick = async () => { await adm('POST', 'staf/bendera', { staffModel: !b.staffModel }); toast('Bendera diperbarui.', 'ok'); muat(); };
    });
    muat();
  },
};

// ═════════════════════ Keamanan ═════════════════════
export const Keamanan = {
  f: { aksi: '', aktor: '', hasil: '' },
  mount(el) {
    const muat = () => isi(el, `keamanan?aksi=${encodeURIComponent(this.f.aksi)}&aktor=${encodeURIComponent(this.f.aktor)}&hasil=${encodeURIComponent(this.f.hasil)}`, (d) => {
      const k = d.kunci, t = d.ditolak;
      el.innerHTML = kartu('kmAudit', 'Log audit', `<form class="adm-filter" id="kmF"><label class="sr-only" for="kmA">Awalan aksi</label><input class="input" id="kmA" placeholder="Aksi (mis. ai, data, pengguna)" value="${esc(this.f.aksi)}" maxlength="40"><label class="sr-only" for="kmB">Pelaku</label><input class="input" id="kmB" placeholder="Pelaku (email)" value="${esc(this.f.aktor)}" maxlength="80"><label class="sr-only" for="kmC">Hasil</label><select class="input" id="kmC"><option value="">Semua hasil</option>${['ok', 'gagal', 'ditolak'].map((x) => `<option value="${x}" ${this.f.hasil === x ? 'selected' : ''}>${x}</option>`).join('')}</select>${tombol('Terapkan', 'type="submit"', 'primary', 'search')}</form>
        <div class="set-list">${d.audit.map((e) => baris(`<b>${esc(e.aksi)}</b> <small class="muted">${esc(e.sasaran)}</small><div class="adm-meta">${chip(e.aktor)}${chip(e.hasil, e.hasil === 'ok' ? 'ok' : 'warn')}<small class="muted">${esc(tgl(e.t))}${e.ip ? ' dari ' + esc(e.ip) : ''}</small></div>${e.rincian ? `<small class="muted">${esc(e.rincian)}</small>` : ''}`)).join('') || kosong('Belum ada catatan yang cocok', 'Setiap aksi pengelola yang mengubah sesuatu dicatat di sini, tanpa rahasia.')}</div>`)
        + kartu('kmSesi', 'Sesi aktif', `<p class="muted">${d.sesi.total} sesi aktif. Mencabut sesi memaksa orangnya masuk lagi.</p><div class="set-list">${d.sesi.daftar.map((s) => baris(`<b>${esc(s.email || 'akun dihapus')}</b><div class="adm-meta"><small class="muted">Dibuat ${esc(tgl(s.dibuat))}, berlaku sampai ${esc(tgl(s.kedaluwarsa))}</small></div><small class="muted">${esc(s.perangkat)}</small>`, tombol('Cabut', `data-sc="${esc(s.ref)}" aria-label="Cabut sesi ${esc(s.email)}"`, 'sm'))).join('') || kosong('Tidak ada sesi aktif')}</div>`)
        + kartu('kmTolak', 'Upaya ditolak (24 jam)', `<div class="adm-tiles">${tile('Ditolak (403)', t.duaPuluhEmpatJam[403])}${tile('Dibatasi (429)', t.duaPuluhEmpatJam[429])}</div><div class="set-list">${t.terbaru.map((e) => baris(`<b>${e.code}</b> <small class="muted">${esc(e.jalur)}</small><div class="adm-meta">${chip(e.alasan || '-')}${chip('dari ' + e.dari)}<small class="muted">${esc(tgl(e.t))}</small></div>`)).join('') || kosong('Tidak ada upaya ditolak sejak server menyala')}</div><p class="muted">Asal ditampilkan sebagai kode acak pendek, bukan alamat IP. Catatan ini di memori dan hilang saat server dimulai ulang.</p>`)
        + kartu('kmKunci', 'Kunci enkripsi dan token', `<div class="adm-kvs">${[['Sumber kunci', k.sumber], ['Versi sekarang', k.versiSekarang], ['Jumlah versi', k.jumlahVersi], ['Perlu dibungkus ulang', k.perluDibungkusUlang]].map(([a, v]) => `<div class="adm-kv"><span>${esc(a)}</span><b>${esc(v)}</b></div>`).join('')}</div>
          <div class="set-pil">${tombol('Bungkus ulang rahasia', 'data-bu', '', 'key')}${tombol('Putar kunci enkripsi', `data-pk ${k.bisaDiputarDariKonsol ? '' : 'disabled'}`, '', 'repeat')}</div>
          <p class="muted">${k.bisaDiputarDariKonsol ? 'Putar menambah versi kunci baru lalu membungkus ulang semua rahasia.' : 'Kunci diatur lewat env, jadi tidak bisa diputar dari konsol. Tambah versi baru di RAIVERSE_KEYS, mulai ulang server, lalu pakai Bungkus ulang rahasia.'}</p>
          <div class="set-list">${baris(`<b>Token hook otomasi</b><div class="adm-meta">${chip(`${d.hook.total} otomasi`)}${chip(`${d.hook.versi2} versi 2`, 'ok')}${chip(`${d.hook.lama} format lama`, d.hook.lama ? 'warn' : '')}</div><small class="muted">${esc(d.hook.catatan)}</small>`)}</div>`);
      el.querySelector('#kmF').onsubmit = (e) => { e.preventDefault(); this.f = { aksi: el.querySelector('#kmA').value.trim(), aktor: el.querySelector('#kmB').value.trim(), hasil: el.querySelector('#kmC').value }; muat(); };
      el.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = async () => { await adm('POST', 'keamanan/sesi/cabut', { ref: b.dataset.sc }); toast('Sesi dicabut.', 'ok'); muat(); }));
      el.querySelector('[data-bu]').onclick = () => konfirmasi({ judul: 'Bungkus ulang rahasia?', isi: 'Semua kunci AI dan token yang tersimpan ditulis ulang dengan kunci enkripsi terbaru. Nilainya tidak berubah.', kalimat: 'BUNGKUS ULANG RAHASIA', jalan: async (x) => { const r = await adm('POST', 'keamanan/kunci/bungkus-ulang', x); toast(`Selesai: ${r.kunciAI} kunci AI, ${r.tokenDrive} token Google, ${r.rahasiaPlatform} rahasia platform.`, 'ok'); muat(); } });
      el.querySelector('[data-pk]')?.addEventListener('click', () => konfirmasi({ judul: 'Putar kunci enkripsi?', isi: 'Versi kunci baru dibuat dan dipakai menulis. Kunci lama tetap ada di berkas kunci supaya data lama terbaca. Cadangkan berkas data/.raiverse-keys.json bersama cadangan data.', kalimat: 'PUTAR KUNCI ENKRIPSI', jalan: async (x) => { const r = await adm('POST', 'keamanan/kunci/putar', x); toast(`Kunci versi ${esc(r.versi)} dipakai.`, 'ok'); muat(); } }));
    });
    muat();
  },
};

// ═════════════════════ Data ═════════════════════
export const Data = {
  mount(el) {
    const muat = () => isi(el, 'data', (d) => {
      const p = d.penyimpanan, tunda = d.pemulihanTertunda;
      el.innerHTML = (tunda ? `<div class="state" role="status"><b>Pemulihan menunggu mulai ulang server</b><p>Cadangan ${esc(tunda.nama)} akan diterapkan saat server dimulai ulang (dijadwalkan ${esc(tgl(tunda.sejak))}).</p>${tombol('Batalkan pemulihan', 'data-bt')}</div>` : '')
        + kartu('dtUkuran', 'Ukuran data', `<div class="set-list">${d.ukuran.map((u) => baris(`<b>${esc(u.label)}</b>`, chip(bytes(u.byte)))).join('')}</div>`)
        + kartu('dtCad', 'Cadangan', `<div class="set-pil">${tombol('Buat cadangan sekarang', 'data-cb', 'primary', 'download')}</div><div class="set-list">${d.cadangan.map((c) => baris(`<b>${esc(c.nama)}</b><div class="adm-meta">${chip(`${c.berkas} berkas`)}${chip(bytes(c.byte))}<small class="muted">${esc(tgl(Date.parse(c.dibuat)))}</small></div>`, `${tombol('Periksa', `data-cp="${esc(c.nama)}" aria-label="Periksa cadangan ${esc(c.nama)}"`, 'sm')}${tombol('Pulihkan', `data-cr="${esc(c.nama)}" aria-label="Pulihkan cadangan ${esc(c.nama)}"`, 'sm')}`)).join('') || kosong('Belum ada cadangan', 'Buat satu sebelum mengubah penyimpanan atau memulihkan data.')}</div>
          <p class="muted">Pemulihan tidak menimpa data saat server berjalan: ia dijadwalkan dan diterapkan saat mulai ulang, setelah keadaan sekarang dicadangkan otomatis. Rahasia tidak dicetak.</p>`)
        + kartu('dtSimpan', 'Mode penyimpanan', `<p class="muted">${p.sqliteTersedia ? 'Urutan aman: json, lalu dual (dibandingkan otomatis), lalu sqlite.' : 'SQLite tidak tersedia di Node ini, jadi semuanya tetap json.'} Bawaan dari env: ${esc(p.bawaan)}. Selisih dual: ${p.statistik.mismatches}, galat tulis: ${p.statistik.errors}.</p>
          <div class="set-list">${p.ruangKerja.map((w) => baris(`<b>${esc(w.id)}</b><div class="adm-meta">${chip(w.mode, w.mode === 'json' ? '' : 'ok')}</div>`, `${w.mode !== 'json' ? tombol('Bandingkan', `data-bd="${esc(w.id)}" aria-label="Bandingkan ${esc(w.id)}"`, 'sm') : ''}${w.mode === 'json' && p.sqliteTersedia ? tombol('Ke dual', `data-md="${esc(w.id)}|dual"`, 'sm') : ''}${w.mode === 'dual' ? tombol('Ke sqlite', `data-md="${esc(w.id)}|sqlite"`, 'sm') + tombol('Kembali ke json', `data-md="${esc(w.id)}|json"`, 'sm') : ''}`)).join('')}</div><p class="muted" id="bdOut" role="status"></p>`);
      el.querySelector('[data-bt]')?.addEventListener('click', async () => { await adm('POST', 'data/pulihkan/batal', {}); toast('Pemulihan dibatalkan.', 'ok'); muat(); });
      el.querySelector('[data-cb]').onclick = async (e) => { e.currentTarget.disabled = true; try { const r = await adm('POST', 'data/cadangan', { label: 'konsol' }); toast(`Cadangan dibuat: ${esc(r.nama)} (${r.berkas} berkas).`, 'ok'); muat(); } catch { e.target.disabled = false; } };
      el.querySelectorAll('[data-cp]').forEach((b) => (b.onclick = async () => { const r = await adm('POST', 'data/cadangan/periksa', { nama: b.dataset.cp }); toast(r.sah ? 'Cadangan sah: ukuran dan hash cocok.' : esc('Cadangan bermasalah: ' + r.masalah.slice(0, 2).join('; ')), r.sah ? 'ok' : 'warn'); }));
      el.querySelectorAll('[data-cr]').forEach((b) => (b.onclick = () => konfirmasi({ judul: 'Pulihkan cadangan ini?', isi: `Data akan diganti dengan isi cadangan <b>${esc(b.dataset.cr)}</b> saat server dimulai ulang. Keadaan sekarang dicadangkan otomatis lebih dulu.`, kalimat: `PULIHKAN ${b.dataset.cr}`, tombol: 'Jadwalkan pemulihan', jalan: async (x) => { const r = await adm('POST', 'data/pulihkan', { nama: b.dataset.cr, ...x }); toast(esc(r.catatan), 'ok'); muat(); } })));
      el.querySelectorAll('[data-bd]').forEach((b) => (b.onclick = async () => { const r = await adm('GET', 'data/bandingkan?ws=' + encodeURIComponent(b.dataset.bd)); el.querySelector('#bdOut').textContent = r.dibandingkan ? (r.sama ? `${r.ws}: JSON dan SQLite sama.` : `${r.ws}: berbeda pada ${r.beda.slice(0, 6).join(', ')}.`) : r.pesan; }));
      el.querySelectorAll('[data-md]').forEach((b) => (b.onclick = () => {
        const [ws, mode] = b.dataset.md.split('|'), kirim = async (x = {}) => { await adm('POST', 'data/penyimpanan', { ws, mode, ...x }); toast(`Mode ${esc(ws)}: ${esc(mode)}.`, 'ok'); muat(); };
        if (mode === 'sqlite') konfirmasi({ judul: 'Beralih ke sqlite?', isi: 'JSON berhenti ditulis; SQLite menjadi sumber kebenaran. Pembanding harus bersih. Kembali ke json lewat skrip rollback.', kalimat: `ALIHKAN ${ws} KE SQLITE`, tombol: 'Alihkan', jalan: kirim }); else kirim();
      }));
    });
    muat();
  },
};
