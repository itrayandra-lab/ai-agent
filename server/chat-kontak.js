// PESAN: daftar KONTAK (orang, divisi, grup) dan utas per kontak, seperti WhatsApp/Telegram. Tidak menggandakan data:
//   - satu kontak = satu percakapan Chat Engine khusus (conv.kontak = "orang:hendra") yang dipakai untuk mengirim pesan;
//   - riwayat kontak = percakapan khusus itu + pesan kontak itu di percakapan Obrolan lain (hanya dibaca, ditandai sumbernya);
//   - tugas kontak = daftar tugas milik ruang kerja yang sama (assigneeId / divisionId), hanya dibaca.
// Keadaan kecil per pengguna (pin, tanda sudah dibaca, grup buatan) disimpan di db().chat.kontak[userId]. Hak akses: semua dibatasi userId dan ruang kerja aktif.
// Pengiriman memakai rute Chat Engine yang ada (/api/chat/conversations/:id/stream), jadi aliran, saran lanjutan, konfirmasi, ulangi, dan sumber sama dengan Obrolan.
import * as store from './penyimpanan/store.js';
import * as ce from './chat-engine.js';
import * as router from './chat-router.js';

const db = () => store.get();
const emp = (id) => db().employees.find((e) => e.id === id);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const state = (userId) => ((db().chat ||= { convs: {} }).kontak ||= {})[userId] ||= { pin: {}, dibaca: {}, grup: {} };
const convs = (userId) => Object.values((db().chat ||= { convs: {} }).convs).filter((c) => c.userId === userId);
const KID = /^(orang|divisi|grup):([\w-]{1,48})$/;
const err = (m, code) => Object.assign(new Error(m), { code });

const warna = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 42% 40%)`; };
const avatar = (nama, id) => ({ inisial: String(nama || '?').trim().slice(0, 1).toUpperCase(), warna: warna(id) });
const divisiOf = (e) => db().divisions.find((d) => d.id === e?.divisionId);
const ai = () => db().employees.filter((e) => e.type === 'ai' && !e.isPA && !e.isMaster);
/** kontak orang: pembantu biasa + aray (koordinator lintas divisi, peran jelas); Sora (asisten pribadi) tetap di halaman Obrolan */
const orangKontak = () => db().employees.filter((e) => e.type === 'ai' && !e.isPA);
const peranOf = (e) => (e.isMaster ? 'Koordinator lintas divisi' : e.title);
const kunci = (jenis, id) => `${jenis}:${id}`;

/** status kerja dalam bahasa awam: bekerja | rapat | siap | luring, dengan keterangan singkat */
function statusOf(e) {
  if (!e) return { kode: 'luring', teks: 'Tidak ada' };
  if (e.status === 'offline') return { kode: 'luring', teks: 'Sedang tidak aktif' };
  if (e.status === 'meeting') return { kode: 'rapat', teks: 'Sedang rapat' };
  if (e.status === 'working' || e.currentTaskId) { const t = db().tasks.find((x) => x.id === e.currentTaskId); return { kode: 'bekerja', teks: clip(t?.title || e.statusText || 'Sedang mengerjakan sesuatu', 60) }; }
  return { kode: 'siap', teks: 'Siap membantu' };
}
const LABEL_TUGAS = { todo: 'Menunggu', pending: 'Menunggu', queued: 'Menunggu', in_progress: 'Dikerjakan', running: 'Dikerjakan', working: 'Dikerjakan', review: 'Diperiksa', blocked: 'Tertahan', waiting_approval: 'Menunggu konfirmasi', done: 'Selesai', completed: 'Selesai', cancelled: 'Dibatalkan', failed: 'Belum berhasil' };

/** anggota percakapan sebuah kontak: orang = dirinya; divisi = pimpinan + dua staf; grup = anggota grup */
function anggotaOf(userId, jenis, id) {
  if (jenis === 'orang') { const e = emp(id); if (!e || e.type !== 'ai' || e.isPA) throw err('Kontak tidak ditemukan', 404); return [e.id]; }
  if (jenis === 'divisi') {
    const d = db().divisions.find((x) => x.id === id); if (!d) throw err('Kontak tidak ditemukan', 404);
    const staf = ai().filter((e) => e.divisionId === d.id && e.id !== d.leadId && e.status !== 'offline').slice(0, 2).map((e) => e.id);
    return [d.leadId, ...staf].filter((x) => emp(x));
  }
  const g = state(userId).grup[id]; if (!g) throw err('Kontak tidak ditemukan', 404);
  return g.anggota.filter((x) => emp(x));
}
function infoKontak(userId, jenis, id) {
  const st = state(userId); const kid = kunci(jenis, id);
  if (jenis === 'orang') {
    const e = emp(id); if (!e || e.type !== 'ai' || e.isPA) throw err('Kontak tidak ditemukan', 404); const d = divisiOf(e);
    return { id: kid, jenis, nama: e.name, peran: peranOf(e), divisi: d?.name || '', avatar: avatar(e.name, e.id), status: statusOf(e), keahlian: e.isMaster ? ['memecah tujuan lintas divisi', 'menunjuk penanggung jawab', 'memantau kemajuan', 'ringkasan untuk pemilik', 'menjaga kualitas dan anggaran'] : (e.skills || []).slice(0, 8), tentang: e.isMaster ? 'Koordinator lintas divisi: memecah tujuan besar menjadi tugas, menunjuk penanggung jawab, memantau kemajuan, mengurus eskalasi dan persetujuan, membuat ringkasan untuk pemilik. Hadir bila diminta; tidak menyela percakapan lain.' : clip(e.about || e.persona, 280), pin: !!st.pin[kid], orangId: e.id, ...(e.isMaster ? { koordinator: true } : {}) };
  }
  if (jenis === 'divisi') {
    const d = db().divisions.find((x) => x.id === id); if (!d) throw err('Kontak tidak ditemukan', 404); const lead = emp(d.leadId); const orang = ai().filter((e) => e.divisionId === d.id);
    const kerja = orang.filter((e) => statusOf(e).kode === 'bekerja').length;
    return { id: kid, jenis, nama: d.name, peran: `Divisi · ${orang.length} orang`, divisi: d.name, avatar: avatar(d.name, d.id), status: { kode: kerja ? 'bekerja' : 'siap', teks: kerja ? `${kerja} orang sedang bekerja` : 'Siap membantu' }, keahlian: [], tentang: clip(d.mission || d.description || '', 280), pin: !!st.pin[kid], pimpinan: lead ? { id: lead.id, nama: lead.name } : null, orangId: lead?.id || null };
  }
  const g = st.grup[id]; if (!g) throw err('Kontak tidak ditemukan', 404); const anggota = g.anggota.map((x) => emp(x)).filter(Boolean);
  return { id: kid, jenis, nama: g.nama, peran: `Grup · ${anggota.length} orang`, divisi: '', avatar: avatar(g.nama, id), status: { kode: anggota.some((e) => statusOf(e).kode === 'bekerja') ? 'bekerja' : 'siap', teks: anggota.map((e) => e.name.split(' ')[0]).join(', ') }, keahlian: [], tentang: '', pin: !!st.pin[kid], anggota: anggota.map((e) => ({ id: e.id, nama: e.name, peran: e.title })), orangId: null };
}
/** ID orang yang menjadi "milik" kontak, dipakai untuk mencocokkan pesan di percakapan lain */
const milikOrang = (jenis, id, userId) => (jenis === 'orang' ? [id] : jenis === 'divisi' ? ai().filter((e) => e.divisionId === id).map((e) => e.id) : (state(userId).grup[id]?.anggota || []));

/** pesan terakhir dan jumlah belum dibaca per kontak, dari satu kali penelusuran riwayat */
function ringkasan(userId) {
  const per = new Map();   // orangId -> { t, teks, dari, baruList: [t] }
  for (const c of convs(userId)) for (const m of c.msgs.slice(-60)) {
    if (m.role === 'user' || !m.speaker?.id || m.speaker.utama) continue;
    const r = per.get(m.speaker.id) || { ts: [], t: 0, teks: '' };
    r.ts.push(m.t); if (m.t > r.t) { r.t = m.t; r.teks = clip(m.text, 80); } per.set(m.speaker.id, r);
  }
  return per;
}
function lastOf(per, ids) { let best = null; for (const id of ids) { const r = per.get(id); if (r && (!best || r.t > best.t)) best = r; } return best; }
function belum(per, ids, dibaca) { let n = 0; for (const id of ids) n += (per.get(id)?.ts || []).filter((t) => t > dibaca).length; return n; }

export function daftar(userId, { q = '', jenis = '' } = {}) {
  const st = state(userId); const per = ringkasan(userId); const needle = router.norm(q); const now = Date.now();
  const semua = [
    ...orangKontak().map((e) => ['orang', e.id]),
    ...db().divisions.map((d) => ['divisi', d.id]),
    ...Object.keys(st.grup).map((g) => ['grup', g]),
  ];
  const rows = [];
  for (const [j, id] of semua) {
    if (jenis && jenis !== j) continue;
    let info; try { info = infoKontak(userId, j, id); } catch { continue; }
    if (needle && !router.norm(`${info.nama} ${info.peran} ${info.divisi} ${(info.keahlian || []).join(' ')}`).includes(needle)) continue;
    const kid = info.id; if (st.dibaca[kid] === undefined) st.dibaca[kid] = now;   // sebelum pertama kali dilihat, riwayat lama dianggap sudah dibaca
    const ids = milikOrang(j, id, userId); const t = lastOf(per, ids);
    rows.push({ ...info, terakhir: t ? { teks: t.teks, waktu: t.t } : null, belumDibaca: belum(per, ids, st.dibaca[kid]) });
  }
  rows.sort((a, b) => (b.pin - a.pin) || ((b.terakhir?.waktu || 0) - (a.terakhir?.waktu || 0)) || a.nama.localeCompare(b.nama));
  return { kontak: rows, jumlah: { orang: rows.filter((r) => r.jenis === 'orang').length, divisi: rows.filter((r) => r.jenis === 'divisi').length, grup: rows.filter((r) => r.jenis === 'grup').length } };
}

function parse(kid) { const m = KID.exec(String(kid || '')); if (!m) throw err('Kontak tidak ditemukan', 404); return [m[1], m[2]]; }

/** percakapan khusus kontak (dibuat saat pertama dipakai); semua pesan yang dikirim dari Pesan masuk ke sini */
export function sesi(userId, kid) {
  const [j, id] = parse(kid); const anggota = anggotaOf(userId, j, id); const info = infoKontak(userId, j, id);
  let c = convs(userId).find((x) => x.kontak === info.id);
  if (!c) {
    const v = ce.create(userId, { tujuan: j === 'orang' ? 'agen' : 'tim', agen: anggota, judul: info.nama });
    c = db().chat.convs[v.id]; c.kontak = info.id;
  } else if (j !== 'orang' && c.agents.join() !== anggota.join()) c.agents = anggota.slice(0, 4);   // divisi/grup berubah: anggota ikut diperbarui
  state(userId).dibaca[info.id] = Date.now(); store.save();
  return { convId: c.id, kontak: info };
}

export function utas(userId, kid) {
  const [j, id] = parse(kid); const info = infoKontak(userId, j, id); const milik = new Set(milikOrang(j, id, userId));
  const khusus = convs(userId).find((x) => x.kontak === info.id);
  const pesan = [];
  for (const c of convs(userId)) {
    const dari = c.kontak === info.id ? 'pesan' : null;
    if (c.kontak && !dari) continue;   // percakapan khusus kontak lain bukan bagian utas ini
    c.msgs.slice(-120).forEach((m, i, arr) => {
      if (dari) return pesan.push({ id: m.id, peran: m.role === 'user' ? 'saya' : 'kontak', teks: m.text, waktu: m.t, sumber: 'pesan', pembicara: m.speaker?.nama || null });
      if (m.role === 'user' || !milik.has(m.speaker?.id)) return;
      const tanya = [...arr.slice(0, i)].reverse().find((x) => x.role === 'user');
      if (tanya && !pesan.some((p) => p.id === tanya.id)) pesan.push({ id: tanya.id, peran: 'saya', teks: tanya.text, waktu: tanya.t, sumber: c.goal === 'tim' ? 'rapat' : 'obrolan', convId: c.id, judul: c.title });
      pesan.push({ id: m.id, peran: 'kontak', teks: m.text, waktu: m.t, sumber: c.goal === 'tim' ? 'rapat' : 'obrolan', convId: c.id, judul: c.title, pembicara: m.speaker?.nama || null });
    });
  }
  pesan.sort((a, b) => a.waktu - b.waktu);
  const tugasMilik = db().tasks.filter((t) => t.kind !== 'chat' && !t.parentId && (j === 'orang' ? t.assigneeId === id : j === 'divisi' ? t.divisionId === id : milik.has(t.assigneeId)));
  const tugas = tugasMilik.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 30).map((t) => ({ id: t.id, judul: clip(t.title, 90), status: t.status, label: LABEL_TUGAS[t.status] || 'Dalam proses', pemilik: emp(t.assigneeId)?.name || '', diperbarui: t.updatedAt || t.createdAt, hasil: t.status === 'done' ? clip(t.summary || t.output, 160) : '' }));
  return { kontak: info, convId: khusus?.id || null, pesan: pesan.slice(-120), tugas, jumlahTugas: { dikerjakan: tugasMilik.filter((t) => ['in_progress', 'running', 'working'].includes(t.status)).length, selesai: tugasMilik.filter((t) => t.status === 'done').length } };
}

export function baca(userId, kid) { const [j, id] = parse(kid); anggotaOf(userId, j, id); state(userId).dibaca[kunci(j, id)] = Date.now(); store.save(); return { ok: true }; }
export function pin(userId, kid, on) { const [j, id] = parse(kid); anggotaOf(userId, j, id); const k = kunci(j, id); if (on) state(userId).pin[k] = true; else delete state(userId).pin[k]; store.save(); return { ok: true, pin: !!on }; }

// ───── grup buatan pengguna
const nama = (s) => clip(s, 40);
export function buatGrup(userId, { nama: n = '', anggota = [] } = {}) {
  const ids = [...new Set(anggota)].filter((x) => { const e = emp(x); return e && e.type === 'ai' && !e.isPA && !e.isMaster; }).slice(0, 4);
  if (!nama(n)) throw err('Nama grup wajib diisi', 400); if (ids.length < 2) throw err('Pilih sedikitnya dua orang untuk grup', 400);
  const st = state(userId); if (Object.keys(st.grup).length >= 30) throw err('Jumlah grup sudah penuh', 400);
  const id = store.uid('g'); st.grup[id] = { id, nama: nama(n), anggota: ids, dibuat: Date.now() }; store.save();
  return infoKontak(userId, 'grup', id);
}
export function ubahGrup(userId, id, { nama: n, anggota } = {}) {
  const g = state(userId).grup[id]; if (!g) throw err('Kontak tidak ditemukan', 404);
  if (typeof n === 'string' && nama(n)) g.nama = nama(n);
  if (Array.isArray(anggota)) { const ids = [...new Set(anggota)].filter((x) => emp(x)?.type === 'ai').slice(0, 4); if (ids.length < 2) throw err('Pilih sedikitnya dua orang untuk grup', 400); g.anggota = ids; }
  store.save(); return infoKontak(userId, 'grup', id);
}
export function hapusGrup(userId, id) {
  const st = state(userId); if (!st.grup[id]) throw err('Kontak tidak ditemukan', 404);
  delete st.grup[id]; delete st.pin[kunci('grup', id)]; delete st.dibaca[kunci('grup', id)];
  const c = convs(userId).find((x) => x.kontak === kunci('grup', id)); if (c) delete db().chat.convs[c.id];
  store.save(); return { ok: true };
}

const who = (b) => b.userId || db().settings.currentUserId;
export const routes = [
  ['GET', '/api/pesan/kontak', (b, p, url) => daftar(who(b), { q: url.searchParams.get('q') || '', jenis: url.searchParams.get('jenis') || '' })],
  ['GET', '/api/pesan/kontak/:kid', (b, p) => utas(who(b), p.kid)],
  ['POST', '/api/pesan/kontak/:kid/sesi', (b, p) => sesi(who(b), p.kid)],
  ['POST', '/api/pesan/kontak/:kid/baca', (b, p) => baca(who(b), p.kid)],
  ['POST', '/api/pesan/kontak/:kid/pin', (b, p) => pin(who(b), p.kid, b.pin !== false)],
  ['POST', '/api/pesan/grup', (b) => buatGrup(who(b), b)],
  ['PATCH', '/api/pesan/grup/:gid', (b, p) => ubahGrup(who(b), p.gid, b)],
  ['DELETE', '/api/pesan/grup/:gid', (b, p) => hapusGrup(who(b), p.gid)],
];
