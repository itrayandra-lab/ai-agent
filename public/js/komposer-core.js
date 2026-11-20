// LOGIKA KOMPOSER BERSAMA: satu sumber untuk komposer halaman Obrolan DAN dock Kantor 3D. Modul ini murni (tanpa DOM, tanpa impor)
// supaya bisa dites di Node dan dipakai dua tempat tanpa membuat komposer kedua. Penempatan dan gaya = sesi tampilan; data dan aturan = di sini.
//
// Antarmuka kecil (props/event):
//   const k = buatKomposer({ panggil, nama, bisaKelola, ambilData })
//   k.state  -> { target:{mode,ids,label}, izin:{nilai,opsi[]}, status:{kode,teks}, mengetik, convId, sibuk }
//   k.subscribe(fn) -> fn(state) tiap ada perubahan (mengembalikan fungsi berhenti)
//   k.setTarget({ids}) / k.setIzin('ask'|'auto'|'full') / k.setSibuk(bool) / k.setMengetik(bool) / k.pakaiPercakapan(id, conv)
//   k.riwayat(q) -> daftar percakapan (judul, terakhir, waktu); k.sinkron() dipanggil saat data ruang kerja berubah
// Peristiwa jendela untuk pihak lain (mis. dock): 'raiverse:komposer' { detail: state } dikirim oleh pemasang (lihat obrolan-view.js).
//
// Aturan yang TIDAK berubah oleh izin: memulai pekerjaan dari obrolan selalu lewat kalimat konfirmasi + tombol "Ya, kerjakan" (pagar di server/pemandu.js).
// Izin mengatur persetujuan hasil kerja setelah pekerjaan berjalan (server/engine.js); mengirim ke luar dan otomasi selalu tetap meminta izin.

export const IZIN = [
  { nilai: 'ask', label: 'Tanya dulu', petunjuk: 'Semua hal yang berdampak minta izinmu dulu.' },
  { nilai: 'auto', label: 'Lanjut sendiri', petunjuk: 'Hal berisiko rendah jalan sendiri; yang berdampak tetap minta izinmu.' },
  { nilai: 'full', label: 'Serahkan penuh', petunjuk: 'Hasil kerja ikut disetujui otomatis. Kirim ke luar dan otomasi tetap minta izinmu.', hanyaPengelola: true },
];

/** nilai izin yang berlaku dari pengaturan ruang kerja (pengaturan lama autoApprove=false berarti "ask") */
export const izinSaatIni = (settings = {}) => (IZIN.some((o) => o.nilai === settings.permission) ? settings.permission : settings.autoApprove === false ? 'ask' : 'auto');
/** pilihan yang boleh dilihat: "Serahkan penuh" hanya untuk pengelola */
export const izinOpsi = (bisaKelola) => IZIN.filter((o) => !o.hanyaPengelola || bisaKelola);
/** izin yang diminta tetapi tidak boleh (bukan pengelola) jatuh ke "auto" */
export const izinSah = (nilai, bisaKelola) => (izinOpsi(bisaKelola).some((o) => o.nilai === nilai) ? nilai : 'auto');

/** mode penerima dari daftar orang: kosong = asisten memilih (otomatis), satu = orang itu, lebih = rapat singkat dengan moderator */
export const modeDari = (ids = []) => (ids.length === 0 ? 'auto' : ids.length === 1 ? 'agen' : 'tim');
/** kalimat "Ke: ..." untuk komposer */
export function labelTarget({ ids = [], nama = (x) => x, fokus = null } = {}) {
  const mode = modeDari(ids);
  if (mode === 'auto' && fokus) return `Ke: ${String(nama(fokus) || fokus).split(' ')[0]}`;   // orang yang sedang diikuti di Kantor 3D menjadi penerima bawaan
  if (mode === 'auto') return 'Ke: aray';
  const n = ids.map((id) => String(nama(id) || id).split(' ')[0]);
  return mode === 'agen' ? `Ke: ${n[0]}` : `Ke: ${n.slice(0, 3).join(', ')}${n.length > 3 ? ` +${n.length - 3}` : ''} (rapat)`;
}
/** bentuk untuk server (PATCH /api/chat/conversations/:id) dan sebaliknya */
// penerima yang dipilih pengguna = eksplisit (mengalahkan nama, fokus, dan topik). Banyak orang tidak memaksa rapat tiap pesan: rapat hanya bila diminta ("rapat", "diskusi").
export const targetKeServer = (ids = []) => ({ tujuan: ids.length === 1 ? 'agen' : 'auto', agen: ids.slice(0, 4), eksplisit: ids.length > 0 });

/** "@" di depan kursor: { q, mulai } atau null. Dipakai daftar saran @mention. */
export function cariMention(sebelumKursor = '') { const m = /(?:^|\s)@([^\s@]{0,24})$/.exec(sebelumKursor); return m ? { q: m[1], mulai: sebelumKursor.length - m[1].length - 1 } : null; }
/** buang teks "@kata" yang sedang diketik setelah satu saran dipilih; mengembalikan teks dan posisi kursor baru */
export function buangMention(teks = '', kursor = teks.length) {
  const sebelum = teks.slice(0, kursor); const m = cariMention(sebelum); if (!m) return { teks, kursor };
  const kiri = sebelum.slice(0, m.mulai).replace(/\s+$/, ''); const kanan = teks.slice(kursor).replace(/^\s+/, '');
  const baru = kiri && kanan ? `${kiri} ${kanan}` : kiri || kanan; return { teks: baru, kursor: kiri.length + (kiri && kanan ? 1 : 0) };
}
/** geser sorotan daftar saran dengan panah (melingkar); idx -1 = belum ada sorotan */
export const geserPilihan = (idx, n, arah) => (n <= 0 ? -1 : idx < 0 ? (arah > 0 ? 0 : n - 1) : (idx + arah + n) % n);
/** tambah penerima (tanpa ganda, paling banyak empat; yang terbaru dipertahankan) */
export const tambahPenerima = (ids = [], id, maks = 4) => [...new Set([...ids, id])].slice(-maks);
export const targetDariServer = (conv = {}) => { const ids = (conv.peserta || []).map((p) => p.id || p).slice(0, 4); return { ids, mode: modeDari(ids) }; };

/**
 * status satu kata-dua kata untuk komposer dan dock. Urutan prioritas: sedang menjawab, tim dijeda, terhambat, perlu kamu, sedang jalan, siap.
 * data = { settings, tasks, approvals, employees }, sibuk = komposer sedang menunggu jawaban.
 */
export function statusTim({ settings = {}, tasks = [], approvals = [], employees = [] } = {}, sibuk = false) {
  const nunggu = approvals.filter((a) => a.status === 'pending').length;
  const kerja = employees.filter((e) => e.type === 'ai' && (e.status === 'working' || e.status === 'meeting')).length;
  if (sibuk) return { kode: 'menjawab', teks: 'Sedang menjawab' };
  if (settings.autonomy === false) return { kode: 'dijeda', teks: 'Tim dijeda' };
  if (tasks.some((t) => t.status === 'blocked')) return { kode: 'terhambat', teks: 'Terhambat' };
  if (nunggu) return { kode: 'perlu-kamu', teks: nunggu > 1 ? `${nunggu} hal menunggumu` : 'Perlu kamu' };
  if (kerja) return { kode: 'jalan', teks: `${kerja} orang bekerja` };
  return { kode: 'siap', teks: 'Siap' };
}

/** satu baris riwayat dari satu percakapan (bentuk dari GET /api/chat/conversations) */
export const barisRiwayat = (c) => ({ id: c.id, judul: c.judul || 'Percakapan baru', terakhir: c.terakhir || '', waktu: c.waktu || 0, peserta: (c.peserta || []).map((p) => p.nama).filter(Boolean) });

export function buatKomposer({ panggil, nama = (x) => x, bisaKelola = () => false, ambilData = () => ({}) } = {}) {
  const dengar = new Set();
  const st = { fokus: null, target: { mode: 'auto', ids: [], sumber: 'otomatis', label: 'Ke: aray' }, izin: { nilai: 'auto', opsi: izinOpsi(false) }, status: { kode: 'siap', teks: 'Siap' }, mengetik: false, sibuk: false, convId: '' };
  const ubah = () => { for (const f of dengar) { try { f(st); } catch { /* pendengar rusak tidak boleh menjatuhkan komposer */ } } };
  const segar = () => {
    const d = ambilData() || {}; const kelola = !!bisaKelola();
    st.izin = { nilai: izinSah(izinSaatIni(d.settings), kelola), opsi: izinOpsi(kelola) };
    st.status = statusTim(d, st.sibuk);
    // prioritas: pilihan eksplisit (chip/kontak) > orang yang difokus di 3D > otomatis (nama yang disebut dalam pesan ditentukan server per pesan)
    const sumber = st.target.ids.length ? 'chip' : st.fokus ? 'fokus' : 'otomatis';
    st.target = { mode: st.target.ids.length ? modeDari(st.target.ids) : st.fokus ? 'agen' : 'auto', ids: st.target.ids, sumber, label: labelTarget({ ids: st.target.ids, nama, fokus: st.fokus }) };
  };
  segar();
  return {
    state: st,
    subscribe(fn) { dengar.add(fn); return () => dengar.delete(fn); },
    sinkron() { segar(); ubah(); },
    setSibuk(b) { st.sibuk = !!b; segar(); ubah(); },
    /** orang yang sedang diikuti/dipilih di Kantor 3D (null = tidak ada); dikirim bersama tiap pesan sebagai `fokus` */
    setFokus(id) { const baru = id || null; if (baru === st.fokus) return; st.fokus = baru; segar(); ubah(); },
    setMengetik(b) { if (st.mengetik !== !!b) { st.mengetik = !!b; ubah(); } },
    /** pasang percakapan yang sedang aktif (id) dan targetnya dari server */
    pakaiPercakapan(id, conv) {
      const ids = targetDariServer(conv).ids;
      if ((id || '') === st.convId && ids.join() === st.target.ids.join()) return;   // tidak berubah: jangan membanjiri pendengar saat jawaban mengalir
      st.convId = id || ''; st.target.ids = ids; segar(); ubah();
    },
    /** ubah penerima; bila percakapan sudah ada, disimpan ke server. Mengembalikan false bila gagal (keadaan lama dipulihkan). */
    async setTarget({ ids = [] } = {}) {
      const lama = st.target.ids; st.target.ids = [...new Set(ids)].slice(0, 4); segar(); ubah();
      if (!st.convId || !panggil) return true;
      const r = await panggil('PATCH', `/api/chat/conversations/${st.convId}`, targetKeServer(st.target.ids));
      if (r) return true;
      st.target.ids = lama; segar(); ubah(); return false;
    },
    /** ubah izin asisten; "full" hanya untuk pengelola. Gagal = nilai lama kembali. */
    async setIzin(nilai) {
      const kelola = !!bisaKelola(); const v = izinSah(nilai, kelola); if (v !== nilai) return false;
      const lama = st.izin.nilai; st.izin = { ...st.izin, nilai: v }; ubah();
      if (!panggil) return true;
      const r = await panggil('PATCH', '/api/settings', { permission: v });
      if (r) return true;
      st.izin = { ...st.izin, nilai: lama }; ubah(); return false;
    },
    async riwayat(q = '') {
      if (!panggil) return [];
      const d = await panggil('GET', '/api/chat/conversations?q=' + encodeURIComponent(q));
      return (d?.percakapan || []).map(barisRiwayat);
    },
  };
}
