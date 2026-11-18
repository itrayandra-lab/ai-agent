// Konsol pengelola platform (#admin). Hanya untuk Owner / pengelola platform; TIDAK ditautkan dari menu pengguna biasa dan bukan "mode".
// Bagian: Ringkasan, Penyedia AI, Kuota dan batas, Pengguna, Integrasi, Staf, Keamanan, Data, Alat lama.
// Semua isi datang dari /api/admin/* (peladen memeriksa identitas pengelola di setiap rute; tampilan ini hanya antarmuka).
// Teks di berkas ini dikecualikan dari tes kata terlarang lewat DAFTAR_PUTIH_PENGELOLA di kamus-ui.js. Panduan: docs/KONSOL-ADMIN.md.
import { esc, navigate, toast } from './core.js';
import { icon } from './icons.js';
import { adm, isi, kartu, tile, chip, baris, tombol, konfirmasi, bytes, tgl, lama, Pengguna, Integrasi, Staf, Keamanan, Data } from './admin-bagian.js';

const kunci = (nama, label, d) => {
  const p = d.penyedia[nama];
  return `<div class="set-k2" data-pv="${nama}"><h4>${esc(label)}</h4>
    <div class="adm-meta">${chip(p.terisi ? `Terisi, berakhir ${p.akhir}` : 'Kosong di konsol', p.terisi ? 'ok' : '')}${chip(`Dipakai dari: ${p.sumberAktif}`)}${p.diEnv ? chip('Ada juga di .env server') : ''}</div>
    <label class="f" for="k-${nama}">${p.terisi ? 'Ganti kunci (putar)' : 'Kunci baru'}</label>
    <input class="input" id="k-${nama}" type="password" autocomplete="off" spellcheck="false" placeholder="Tempel kunci di sini; tidak pernah ditampilkan lagi">
    <div class="set-pil">${tombol('Simpan kunci', 'data-simpan', 'primary', 'key')}${tombol('Uji koneksi', 'data-uji', '', 'plug')}${p.terisi ? tombol('Hapus dari konsol', 'data-hapus') : ''}</div>
    <p class="muted" data-hasil role="status"></p></div>`;
};
const tingkat = { groqLead: 'Groq: pemimpin dan sintesis', groqWorker: 'Groq: pekerja', groqSmall: 'Groq: ringan (obrolan, rutinitas)', claudeLead: 'Claude: pemimpin dan sintesis', claudeWorker: 'Claude: pekerja', claudeSmall: 'Claude: ringan' };

const BAGIAN = {
  ringkasan: { judul: 'Ringkasan', ikon: 'dashboard', mount(el) {
    isi(el, 'ringkasan', (d) => {
      const s = d.server, a = d.mesinAI, h = d.hariIni, v = d.data, md = d.penyimpanan.modes;
      el.innerHTML = kartu('rgServer', 'Kesehatan server', `<div class="adm-tiles">${tile('Aktif sejak', lama(s.aktifDetik))}${tile('Memori', `${s.memoriMB} MB`, s.sistem)}${tile('Node', s.node)}${tile('Login', s.loginWajib ? 'Wajib' : 'Belum aktif', s.modeUmum ? 'mode umum nyala' : 'mode lokal')}</div>`)
        + kartu('rgAI', 'Mesin AI', `<div class="adm-tiles">${tile('Aktif', a.live ? a.aktif : 'simulasi', a.live ? 'memakai kunci asli' : 'tanpa kunci: balasan contoh')}${tile('Kunci Groq', a.groq)}${tile('Kunci Anthropic', a.anthropic)}${tile('Anggaran', a.ditutup ? 'Ditutup' : 'Terbuka')}</div>`)
        + kartu('rgPakai', 'Hari ini', `<div class="adm-tiles">${tile('Tugas', h.tugas)}${tile('Pesan ke pembantu', h.pesan)}${tile('Eksekusi staf', h.staf)}${tile('Suara', h.suara)}${tile('Ruang kerja baru', h.ruangBaru)}${tile('Biaya AI', '$' + h.biayaUSD.toFixed(4), h.anggaranUSD ? `dari batas $${h.anggaranUSD}` : 'tanpa batas global')}</div>`)
        + kartu('rgIsi', 'Isi platform', `<div class="adm-tiles">${tile('Ruang kerja', d.jumlah.ruangKerja)}${tile('Akun', d.jumlah.akun, d.jumlah.ditangguhkan ? `${d.jumlah.ditangguhkan} ditangguhkan` : '')}${tile('Penyimpanan', `json ${md.json || 0}, dual ${md.dual || 0}, sqlite ${md.sqlite || 0}`, d.penyimpanan.sqliteTersedia ? 'SQLite tersedia' : 'SQLite tidak tersedia')}${tile('n8n', d.n8n.tersambung ? 'Tersambung' : d.n8n.menyala ? 'Menyala' : 'Belum menyala', d.n8n.pesan)}</div>`)
        + kartu('rgData', 'Data dan cadangan', `<div class="adm-tiles">${tile('Data utama ditulis', v.menitSejakDataUtamaDitulis == null ? '-' : `${v.menitSejakDataUtamaDitulis} menit lalu`)}${tile('Cadangan terakhir', v.cadanganTerakhir ? tgl(Date.parse(v.cadanganTerakhir.dibuat)) : 'belum ada', v.cadanganTerakhir ? `${v.cadanganTerakhir.berkas} berkas, ${bytes(v.cadanganTerakhir.byte)}` : 'buat satu di bagian Data')}${tile('Jumlah cadangan', v.jumlahCadangan)}${tile('Pemulihan', v.pemulihanTertunda ? 'Menunggu mulai ulang' : 'Tidak ada')}</div>`);
    });
  } },

  ai: { judul: 'Penyedia AI', ikon: 'key', mount(el) {
    const muat = () => isi(el, 'ai', (d) => {
      el.innerHTML = kartu('aiKunci', 'Kunci penyedia', `<p class="muted">Nilai kunci disimpan terenkripsi di server dan tidak pernah dikirim balik ke layar ini. Urutan pemakaian: kunci ruang kerja, lalu kunci konsol, lalu .env server.</p>${kunci('groq', 'Groq', d)}${kunci('anthropic', 'Anthropic (Claude)', d)}`)
        + kartu('aiModel', 'Model per tingkat', `<p class="muted">Kosong berarti memakai bawaan. Pilihan di sini berlaku untuk semua ruang kerja.</p><div class="adm-form">${Object.entries(tingkat).map(([k, label]) => { const t = d.model[k], daftar = k.startsWith('groq') ? d.daftarModel.groq : d.daftarModel.claude; return `<label class="f" for="m-${k}">${esc(label)}</label><select class="input" id="m-${k}" data-tk="${k}"><option value="">Bawaan (${esc(t.efektif || '-')})</option>${[...new Set([...(t.nilai ? [t.nilai] : []), ...daftar])].map((x) => `<option value="${esc(x)}" ${x === t.nilai ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`; }).join('')}</div>`)
        + kartu('aiBatas', 'Batas global', `<div class="adm-tiles">${tile('Anggaran harian', d.batasGlobal.anggaranUSD ? '$' + d.batasGlobal.anggaranUSD : 'Tanpa batas')}${tile('Terpakai hari ini', '$' + d.batasGlobal.terpakaiHariIniUSD.toFixed(4))}${tile('Layanan AI', d.ditutup ? 'Ditutup pengelola' : d.batasGlobal.ditutup ? 'Ditutup otomatis' : 'Terbuka')}</div><p class="muted">Angka batas diubah di bagian Kuota dan batas.</p>`);
      el.querySelectorAll('[data-pv]').forEach((box) => {
        const n = box.dataset.pv, hasil = (t, ok) => { const p = box.querySelector('[data-hasil]'); p.textContent = t; p.classList.toggle('set-ok', !!ok); };
        box.querySelector('[data-simpan]').onclick = async () => { const i = box.querySelector('input'); if (!i.value.trim()) { toast('Tempel kuncinya dulu.', 'warn'); return; } await adm('POST', 'ai/kunci', { penyedia: n, nilai: i.value }); i.value = ''; toast('Kunci disimpan terenkripsi.', 'ok'); muat(); };
        box.querySelector('[data-uji]').onclick = async (e) => { e.currentTarget.disabled = true; hasil('Menguji…'); try { const r = await adm('POST', 'ai/uji', { penyedia: n, nilai: box.querySelector('input').value }); hasil(`${r.pesan}${r.ms ? ` (${r.ms} md${r.modelTerlihat != null ? `, ${r.modelTerlihat} model terlihat` : ''})` : ''}`, r.ok); } finally { e.currentTarget.disabled = false; } };
        box.querySelector('[data-hapus]')?.addEventListener('click', () => konfirmasi({ judul: 'Hapus kunci dari konsol?', isi: `Kunci ${esc(n)} yang tersimpan di konsol dihapus. Kunci di .env server (bila ada) tetap dipakai.`, kalimat: `HAPUS KUNCI ${n.toUpperCase()}`, tombol: 'Hapus kunci', jalan: async (k) => { await adm('POST', 'ai/kunci/hapus', { penyedia: n, ...k }); toast('Kunci dihapus.', 'ok'); muat(); } }));
      });
      el.querySelectorAll('[data-tk]').forEach((s) => (s.onchange = async () => { await adm('POST', 'ai/model', { tingkat: s.dataset.tk, model: s.value }); toast('Model diperbarui.', 'ok'); muat(); }));
    });
    muat();
  } },

  kuota: { judul: 'Kuota dan batas', ikon: 'coin', mount(el) {
    const GRUP = { akun: 'Per akun per hari', global: 'Seluruh platform per hari', laju: 'Batas laju', anggaran: 'Anggaran' };
    const muat = () => isi(el, 'batas', (d) => {
      el.innerHTML = Object.entries(GRUP).map(([g, judul]) => kartu('kq-' + g, judul, `<div class="adm-form">${d.batas.filter((x) => x.kelompok === g).map((x) => `<label class="f" for="q-${esc(x.kunci)}">${esc(x.label)} ${x.diubah ? chip('diubah di konsol', 'warn') : ''}</label><div class="set-row"><input class="input" id="q-${esc(x.kunci)}" data-q="${esc(x.kunci)}" data-awal="${x.nilai}" type="number" inputmode="decimal" min="${x.min}" max="${x.max}" step="${g === 'anggaran' ? '0.01' : '1'}" value="${x.nilai}">${x.diubah ? tombol('Bawaan', `data-bw="${esc(x.kunci)}" aria-label="Kembalikan ${esc(x.label)} ke bawaan"`, 'sm') : `<small class="muted">${x.dariEnv ? 'dari .env' : 'bawaan'}</small>`}</div>`).join('')}</div>`)).join('')
        + `<div class="set-pil">${tombol('Simpan perubahan', 'data-sv', 'primary', 'check')}</div><p class="muted">${esc(d.catatan)}</p>`
        + kartu('kqPakai', 'Pemakaian global hari ini', `<div class="adm-tiles">${Object.entries(d.pemakaianGlobalHariIni).map(([k, v]) => tile(k, v)).join('')}</div>`)
        + kartu('kqTutup', 'Tutup anggaran', `<p>${d.anggaran.ditutup ? 'Layanan AI sedang ditutup oleh pengelola. Pekerjaan baru yang butuh AI ditolak sampai dibuka lagi.' : d.anggaran.otomatisTutup ? 'Layanan AI tertutup otomatis karena batas biaya harian tercapai.' : 'Layanan AI terbuka. Tutup anggaran bila perlu menghentikan semua pekerjaan AI baru seketika.'}</p><div class="set-pil">${d.anggaran.ditutup ? tombol('Buka kembali', 'data-buka', 'primary') : tombol('Tutup anggaran sekarang', 'data-tutup')}</div>`);
      el.querySelector('[data-sv]').onclick = async () => { const nilai = {}; el.querySelectorAll('[data-q]').forEach((i) => { if (i.value !== i.dataset.awal && i.value !== '') nilai[i.dataset.q] = Number(i.value); }); if (!Object.keys(nilai).length) { toast('Belum ada yang diubah.', 'warn'); return; } await adm('POST', 'batas', { nilai }); toast('Batas disimpan dan langsung berlaku.', 'ok'); muat(); };
      el.querySelectorAll('[data-bw]').forEach((b) => (b.onclick = async () => { await adm('POST', 'batas', { nilai: { [b.dataset.bw]: null } }); toast('Kembali ke bawaan.', 'ok'); muat(); }));
      el.querySelector('[data-buka]')?.addEventListener('click', async () => { await adm('POST', 'anggaran', { tutup: false }); toast('Layanan AI dibuka.', 'ok'); muat(); });
      el.querySelector('[data-tutup]')?.addEventListener('click', () => konfirmasi({ judul: 'Tutup anggaran AI?', isi: 'Semua pekerjaan AI baru di seluruh platform ditolak sampai kamu membukanya lagi.', kalimat: 'TUTUP ANGGARAN', tombol: 'Tutup anggaran', jalan: async (k) => { await adm('POST', 'anggaran', { tutup: true, ...k }); toast('Anggaran ditutup.', 'ok'); muat(); } }));
    });
    muat();
  } },

  pengguna: { judul: 'Pengguna', ikon: 'user', mount: (el) => Pengguna.mount(el) },
  integrasi: { judul: 'Integrasi', ikon: 'plug', mount: (el) => Integrasi.mount(el) },
  staf: { judul: 'Staf dan katalog', ikon: 'team', mount: (el) => Staf.mount(el) },
  keamanan: { judul: 'Keamanan', ikon: 'eye', mount: (el) => Keamanan.mount(el) },
  data: { judul: 'Data', ikon: 'folder', mount: (el) => Data.mount(el) },
  alat: { judul: 'Alat lama', ikon: 'settings', mount(el, view) {
    el.innerHTML = kartu('alLama', 'Halaman teknis lama', `<div class="admin-grid">${view.items.map((x) => `<button type="button" class="btn admin-i" data-go="${esc(x.id)}"><b>${esc(x.title)}</b><small>${esc(x.hint)}</small></button>`).join('')}</div>`, 'Halaman lama tetap tersedia untuk pengelola. Kunci, model, dan MCP sekarang diatur di bagian-bagian konsol ini.');
    el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go)));
  } },
};

export const AdminView = {
  items: [],   // diisi views.js: [{ id, title, hint }]
  bagian: 'ringkasan',
  mount(root) {
    this.root = root;
    root.innerHTML = `<div class="page admin"><header class="page-head"><h2>Konsol pengelola</h2><p class="muted">Pengaturan teknis platform. Hanya untuk pemilik dan pengelola platform; pengguna biasa tidak melihat bagian ini.</p></header>
      <nav class="adm-tabs" role="tablist" aria-label="Bagian konsol">${Object.entries(BAGIAN).map(([id, b]) => `<button type="button" role="tab" class="btn adm-tab" id="tab-${id}" data-b="${id}" aria-selected="false" aria-controls="adm-isi">${icon(b.ikon, 18)} ${esc(b.judul)}</button>`).join('')}</nav>
      <div id="adm-isi" role="tabpanel" class="adm-isi" tabindex="-1"></div>
      <p><button type="button" class="btn" data-go="dashboard">Kembali ke Beranda</button></p></div>`;
    root.querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => this.buka(b.dataset.b)));
    root.querySelector('[data-go="dashboard"]').onclick = () => navigate('dashboard');
    this.buka(this.bagian);
  },
  buka(id) {
    if (!BAGIAN[id] || !this.root) return;
    this.bagian = id;
    this.root.querySelectorAll('[data-b]').forEach((b) => { const on = b.dataset.b === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const el = this.root.querySelector('#adm-isi'); el.setAttribute('aria-labelledby', 'tab-' + id); el.innerHTML = '';
    BAGIAN[id].mount(el, this);
  },
  update() {},
  unmount() { this.root = null; },
};
