// UJI NYATA: menjalankan skenario lintas divisi dan evaluasi 31 kemampuan dengan MODEL AI ASLI, di SALINAN data Owner (folder sementara).
// Tidak pernah menyentuh data/ asli, tidak menyalakan staffModel di data asli, tidak mencetak kunci. Anggaran biaya dijaga keras.
//   node scripts/uji-nyata.mjs                       semua (skenario + kemampuan), anggaran 0,45 USD
//   node scripts/uji-nyata.mjs --skenario            hanya 40 skenario
//   node scripts/uji-nyata.mjs --kemampuan           hanya 31 kemampuan (3+ masukan tiap kemampuan)
//   node scripts/uji-nyata.mjs --id fin-laba,hr-gaji hanya skenario tertentu; --kemampuan-id hitung-sdm untuk kemampuan tertentu
//   --batas 0.2 (USD)  --keluar berkas.json  --model openai/gpt-oss-20b  --jalur penuh|manajer  --tenang
// Hasil: JSON (per skenario, per kemampuan, per divisi, biaya, panggilan, token) + tabel singkat di layar. Dokumen: docs/UJI-NYATA.md
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { siapkanSalinan, modUrl, ROOT } from './lib/uji-lingkungan.mjs';

const arg = (n, d = null) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]); };
const BATAS = Number(arg('batas', 0.45)) || 0.45;
const CAP_SK = Number(arg('batas-skenario', 0.015)) || 0.015;   // batas biaya per skenario: lewat 1,5x batas ini, pekerjaan dibatalkan dan skenario gagal
const MODEL = arg('model', 'openai/gpt-oss-20b');
const onlyIds = (arg('id') && arg('id') !== true) ? String(arg('id')).split(',') : null;
const onlyCaps = (arg('kemampuan-id') && arg('kemampuan-id') !== true) ? String(arg('kemampuan-id')).split(',') : null;
const doSk = arg('skenario') === true || (!arg('kemampuan') && !onlyCaps) || !!onlyIds;
const doKap = arg('kemampuan') === true || (!arg('skenario') && !onlyIds) || !!onlyCaps;
const onlyJalur = arg('jalur') && arg('jalur') !== true ? String(arg('jalur')) : null;
const OUT = arg('keluar') && arg('keluar') !== true ? path.resolve(String(arg('keluar'))) : path.join(ROOT, 'docs', 'uji-nyata', 'hasil-terakhir.json');
const log = (...a) => { if (arg('tenang') !== true) console.log(...a); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

// ───────────────────────── lingkungan ─────────────────────────
const env = siapkanSalinan({ batasUSD: BATAS, model: MODEL, modelBesar: MODEL });
if (!env.adaKunci) { console.error('Kunci AI tidak ditemukan di .env (GROQ_API_KEY). Uji nyata dibatalkan.'); process.exit(2); }
// n8n Owner TIDAK boleh tersentuh: arahkan ke n8n tiruan lokal (port 4631-4639) atau alamat mati
const { startMockN8n } = await import(modUrl('test/fixtures/mock-n8n.mjs'));
const N8N_KEY = 'kunci-uji-nyata';
const mock = await startMockN8n({ key: N8N_KEY });
process.env.N8N_URL = mock.url; process.env.N8N_API_KEY = N8N_KEY;
const store = await import(modUrl('server/store.js'));
store.load();
const db = store.get();
env.terapkan(db);
// netralkan tumpukan kerja milik Owner di SALINAN: tugas terbuka, rutinitas, persetujuan menunggu (supaya tidak ada pemakaian AI di luar uji)
for (const t of db.tasks) if (['todo', 'in_progress', 'waiting', 'review'].includes(t.status)) t.status = 'cancelled';
for (const r of db.routines || []) r.enabled = false;
for (const a of db.approvals || []) if (a.status === 'pending') a.status = 'expired';
for (const m of db.meetings || []) if (['running', 'waiting_owner'].includes(m.status)) m.status = 'ended';
for (const e of db.employees) { e.currentTaskId = null; if (e.type === 'ai') { e.status = 'idle'; delete e.meetingUntil; } }
db.settings.staf = { ...(db.settings.staf || {}), perHour: 100000, nativePerDay: 100000, otakPerDay: 100000 };   // batas laju produksi (40 jalan/jam) tidak dipakai di uji
db.settings.tickMs = 800; db.settings.goalBudgetUSD = CAP_SK; db.settings.taskBudgetUSD = CAP_SK;
store.save?.();
const engine = await import(modUrl('server/engine.js'));
const llm = await import(modUrl('server/llm.js'));
const pm = await import(modUrl('server/pemandu.js'));
const S = await import(modUrl('server/staff/index.js'));
const K = await import(modUrl('server/staff/kemampuan.js'));
const D = await import(modUrl('server/staff/data.js'));
const kamus = await import(modUrl('server/kamus.js'));
const WS = store.current();
const usage = () => { const u = db.usage; return { biaya: u.costTotal, panggilan: u.calls, masuk: u.tokensIn, keluar: u.tokensOut }; };
const delta = (a, b) => ({ biaya: round(b.biaya - a.biaya), panggilan: b.panggilan - a.panggilan, token: (b.masuk - a.masuk) + (b.keluar - a.keluar) });
const lewatBatasSk = (c0) => db.usage.costTotal - c0 > CAP_SK * 1.5;
const batalkan = (rootId) => { for (const t of treeOf(rootId)) if (!['done', 'cancelled'].includes(t.status)) { t.status = 'cancelled'; store.upsert('tasks', t); } };
const overBudget = () => db.usage.costTotal >= BATAS * 0.92;

// ───────────────────────── alat penilai ─────────────────────────
/** Semua bilangan dalam teks (format Indonesia: 1.250.000 dan 33,33; juga 33.3). */
export function angkaDari(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/-?\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|-?\d[\d.,]*\d|-?\d/g)) {
    let t = m[0].replace(/[   ]/g, ''), v;
    const dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
    if (dots && commas) { v = t.lastIndexOf(',') > t.lastIndexOf('.') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, '')); }
    else if (dots > 1 || (dots === 1 && /^-?\d{1,3}\.\d{3}$/.test(t))) { v = Number(t.replace(/\./g, '')); out.push(Number(t)); }   // 1.250.000 dan 1.250 (bisa juga desimal) : simpan dua tafsir
    else if (commas > 1 || (commas === 1 && /^-?\d{1,3},\d{3}$/.test(t))) { v = Number(t.replace(/,/g, '')); out.push(Number(t.replace(',', '.'))); }
    else v = Number(t.replace(',', '.'));
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}
const cocokAngka = (text, { nilai, toleransi = 0.01, mutlak = false }) => angkaDari(text).some((v) => { const x = mutlak ? Math.abs(v) : v; return Math.abs(x - nilai) <= Math.abs(nilai) * toleransi + 1e-9; });
const norm = (s) => String(s || '').toLowerCase();
const mengandungGrup = (text, grup) => grup.every((g) => (Array.isArray(g) ? g : [g]).some((w) => norm(text).includes(norm(w))));
const SUDAH_KIRIM = /(sudah|telah|berhasil)\s+(terkirim|dikirim|kukirim|kami kirim)|terkirim ke|pesan.{0,20}terkirim/i;
const JUJUR_SALURAN = /belum (tersambung|terhubung|bisa)|tidak (bisa|dapat) (mengirim|kirim)|belum (ada )?saluran|kamu (yang )?(kirim|salin)|kirim sendiri|kirimkan sendiri|salin/i;

// ───────────────────────── pohon pekerjaan, jalan staf, catatan ─────────────────────────
const treeOf = (rootId) => db.tasks.filter((t) => t.id === rootId || t.rootId === rootId);
const runsSince = (t0) => D.runsOf(WS).filter((r) => r.startedAt >= t0).sort((a, b) => a.startedAt - b.startedAt);
const specOf = (key) => { try { return S.registry.get(key) || K.get(String(key).replace(/^kap-/, '')); } catch { return null; } };
const capOfRun = (r) => String(r.staf).startsWith('kap-') ? String(r.staf).slice(4) : null;
const runUsesCap = (r, cap) => { const k = specOf(r.staf)?.kemampuan; return capOfRun(r) === cap || (Array.isArray(k) && k.includes(cap)); };

/** Nilai satu skenario terhadap kriteria. Mengembalikan daftar alasan gagal ([] = lulus). */
function nilai(sc, h) {
  const k = sc.kriteria || {}, why = [];
  const teks = h.hasilTeks || '';
  if (!h.selesaiKerja) why.push('pekerjaan tidak sampai ke hasil (' + (h.statusAkhir || 'tanpa status') + ')');
  if (teks.trim().length < (k.panjangMin ?? 20)) why.push(`hasil terlalu pendek (${teks.trim().length})`);
  if (k.stafSelesai) {
    const ok = h.jalan.filter((r) => r.status === 'selesai');
    if (!ok.length) why.push('tidak ada staf yang menyelesaikan pekerjaan (hasil tidak berasal dari staf)');
    else if (!ok.some((r) => (r.bukti || []).length > 0)) why.push('jalan staf selesai tanpa bukti');
    if (sc.kemampuan && ok.length && !ok.some((r) => runUsesCap(r, sc.kemampuan))) h.kemampuanLain = true;   // kemampuan lain yang sah boleh dipakai; dicatat, bukan kegagalan
  }
  for (const a of k.angka || []) if (!cocokAngka(teks, a)) why.push(`angka ${a.nilai} tidak ada di hasil`);
  if (k.mengandung && !mengandungGrup(teks, k.mengandung)) why.push('hasil tidak memuat kata kunci: ' + JSON.stringify(k.mengandung));
  for (const j of k.berkas || []) if (!h.jalan.some((r) => r.status === 'selesai' && (r.berkas || []).some((b) => b.jenis === j && h.berkasTerbaca[r.id + '/' + b.nama]))) why.push(`berkas ${j} tidak ada atau tidak terbaca`);
  const keras = h.jargon.filter((x) => x.startsWith('layar:'));   // kata terlarang di teks layar buatan sistem = gagal; di tulisan hasil buatan AI hanya dicatat (jargonHasil)
  if (keras.length) why.push('jargon di layar: ' + keras.join(', '));
  if (k.catatan !== false && k.stafSelesai && !h.adaCatatan) why.push('tidak ada Catatan yang tersimpan');
  if (/NaN|undefined|\[object Object\]/.test(teks)) why.push('hasil memuat nilai rusak');
  return why;
}

/** jejak ringkas apa yang dilakukan agen (tool dan kesalahan), untuk membaca kenapa sebuah skenario gagal */
const jejakDari = (rootId) => treeOf(rootId).flatMap((t) => (t.log || []).filter((l) => ['tool', 'error', 'external_receipt', 'delegate', 'waiting', 'note'].includes(l.type)).map((l) => `${t.assigneeId}: ${String(l.text).replace(/\s+/g, ' ').slice(0, 160)}`)).slice(0, 16);

function kumpul(t0, rootId, hasilTeks, statusAkhir, extra = {}) {
  const jalan = runsSince(t0).map((r) => ({ id: r.id, staf: r.staf, status: r.status, pakaiAI: r.pakaiAI ?? null, bukti: r.bukti || [], berkas: r.berkas || [], biaya: r.biaya || 0, ms: r.ms || 0, galat: r.galat || '', modelAI: r.modelAI || '', panggilanAI: r.panggilanAI || 0 }));
  const berkasTerbaca = {};
  for (const r of jalan) for (const b of r.berkas) { const f = S.runner.fileOf(WS, r.id, b.nama); berkasTerbaca[r.id + '/' + b.nama] = !!f && String(f.isi).trim().length > 0; }
  const ids = jalan.map((r) => r.id), root = rootId ? db.tasks.find((t) => t.id === rootId) : null;
  const adaCatatan = db.notes.some((n) => ids.some((id) => String(n.title).includes(id) || String(n.content).includes(id)) || (root?.noteId && n.id === root.noteId));
  return { hasilTeks, statusAkhir, jalan, berkasTerbaca, adaCatatan, jargon: kamus.scan(hasilTeks), selesaiKerja: ['result', 'done', 'review'].includes(statusAkhir), rootUnverified: root?.unverified ?? null, ...extra };
}

// ───────────────────────── jalur PENUH: pesan → Pemandu → master/asisten → manajer → kemampuan/staf → hasil → Catatan ─────────────────────────
async function tickUntil(cond, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { await engine._passOnce(); if (cond()) return true; await sleep(350); }
  return cond();
}
const pilihRekomendasi = (r) => (r.options || []).find((o) => o.recommended) || (r.options || [])[0];

async function jalurPenuh(sc) {
  const sid = 'uji-' + sc.id, turn = (x) => pm.turn({ userId: 'owner', sessionId: sid, ...x });
  const t0 = Date.now(), c0 = db.usage.costTotal, tanya = [], say = []; let r = (await pm.proposeFor?.("owner", sid, sc.pesan)) || await turn({ input: sc.pesan }), n = 0, melebihi = false;
  const logSay = (x) => { say.push(x.say || ''); for (const o of x.options || []) say.push(o.label || ''); };
  while (n++ < 600 && Date.now() - t0 < 170000) {
    logSay(r);
    if (r.kind === 'choices' && r.ask) { tanya.push(r.say); r = await turn({ choiceId: pilihRekomendasi(r).id }); continue; }
    if (r.kind === 'choices' && r.freeText && !(r.options || []).length) { r = await turn({ input: sc.pesan }); continue; }
    if (r.kind === 'choices' && !r.ask) { r = (r.options || []).length ? await turn({ choiceId: pilihRekomendasi(r).id }) : await turn({ input: sc.pesan }); continue; }
    if (r.kind === 'confirm') { r = await turn({ choiceId: 'start' }); continue; }
    if (r.kind === 'progress') {
      if (lewatBatasSk(c0)) { melebihi = true; const gg = db.tasks.find((t) => t.kind === 'goal' && t.createdAt >= t0 - 1000 && t.createdBy === 'owner'); if (gg) batalkan(gg.id); break; }
      await engine._passOnce(); await sleep(400); r = await turn({ choiceId: 'poll' }); continue;
    }
    break;
  }
  const g = db.tasks.find((t) => t.kind === 'goal' && t.createdAt >= t0 - 1000 && t.createdBy === 'owner');
  if (r.kind === 'result') await sleep(100);
  const hasil = kumpul(t0, g?.id, r.result?.text || g?.output || '', melebihi ? 'melebihi-biaya' : r.kind, { pertanyaan: tanya.length, say, goalStatus: g?.status });
  const sayJargon = kamus.scan(say.join(' | '));
  if (sayJargon.length) hasil.jargon = [...new Set([...hasil.jargon, ...sayJargon.map((x) => 'layar:' + x)])];
  hasil.pohon = g ? treeOf(g.id).map((t) => ({ id: t.id, oleh: t.assigneeId, status: t.status })) : [];
  hasil.jejak = g ? jejakDari(g.id) : [];
  return hasil;
}

// ───────────────────────── jalur MANAJER: pekerjaan langsung ke manajer divisi (jalur lebih murah) ─────────────────────────
async function jalurManajer(sc) {
  const div = db.divisions.find((d) => d.id === sc.divisi); const lead = db.employees.find((e) => e.id === div?.leadId);
  if (!lead) throw new Error('divisi tidak punya manajer: ' + sc.divisi);
  const t0 = Date.now();
  const t = engine.createTask({ title: sc.pesan.slice(0, 100), description: sc.pesan + '\n\nTulis hasil akhir dalam Bahasa Indonesia sehari-hari, siap dipakai orang awam.', assigneeId: lead.id, createdBy: 'owner', kind: 'goal', priority: 'medium' });
  const fin = () => ['done', 'review', 'blocked', 'cancelled'].includes(db.tasks.find((x) => x.id === t.id)?.status);
  const c0 = db.usage.costTotal; let melebihi = false;
  await tickUntil(() => { if (lewatBatasSk(c0)) { melebihi = true; batalkan(t.id); return true; } return fin(); }, 120000);
  const cur = db.tasks.find((x) => x.id === t.id);
  const kode = melebihi ? 'melebihi-biaya' : cur.status === 'done' || cur.status === 'review' ? 'done' : cur.status;
  const hasil = kumpul(t0, t.id, cur.output || cur.summary || '', kode, { goalStatus: cur.status });
  hasil.pohon = treeOf(t.id).map((x) => ({ id: x.id, oleh: x.assigneeId, status: x.status }));
  hasil.jejak = jejakDari(t.id);
  return hasil;
}

// ───────────────────────── skenario khusus ─────────────────────────
/** Aksi berdampak: otomasi harus berhenti di kartu konfirmasi dan tidak menyala sebelum pengguna menekan "Ya, nyalakan". */
async function jalurKonfirmasi(sc) {
  const sid = 'uji-' + sc.id, turn = (x) => pm.turn({ userId: 'owner', sessionId: sid, ...x }), t0 = Date.now();
  const alasan = []; let r = (await pm.proposeFor?.("owner", sid, sc.pesan)) || await turn({ input: sc.pesan }), n = 0;
  while (n++ < 600 && Date.now() - t0 < 170000 && r.kind !== 'result') {
    if (r.kind === 'choices' && r.ask) r = await turn({ choiceId: pilihRekomendasi(r).id });
    else if (r.kind === 'confirm') r = await turn({ choiceId: 'start' });
    else if (r.kind === 'progress') { await engine._passOnce(); await sleep(400); r = await turn({ choiceId: 'poll' }); }
    else if (r.kind === 'choices' && !(r.options || []).length) r = await turn({ input: sc.pesan });
    else if (r.kind === 'choices') r = await turn({ choiceId: pilihRekomendasi(r).id });
    else break;
  }
  if (r.kind !== 'result') return { hasilTeks: '', statusAkhir: r.kind, jalan: [], berkasTerbaca: {}, adaCatatan: false, jargon: [], selesaiKerja: false, alasanKhusus: ['pekerjaan dasar tidak sampai ke hasil'] };
  const hasilTeks = r.result?.text || '';
  r = await turn({ choiceId: 'use' });                                                    // → "done" dengan pilihan lanjut
  const jadwal = (r.options || []).find((o) => /jadwal/i.test(o.label));
  if (!jadwal) alasan.push('pilihan "Jadwalkan" tidak muncul setelah hasil dipakai');
  else {
    r = await turn({ choiceId: jadwal.id });
    let guard = 0;
    while (r.kind === 'choices' && guard++ < 6) {
      const pick = (r.options || []).find((o) => /^oto:opsi/.test(o.id)) || (r.options || []).find((o) => /^ans:/.test(o.id));
      if (!pick) { if (r.freeText) { r = await turn({ input: 'setiap pagi jam 8' }); continue; } break; }
      r = await turn({ choiceId: pick.id });
    }
    if (r.kind === 'confirm') {
      const aktifSebelum = [...mock.state.workflows.values()].filter((w) => w.active).length;
      if (aktifSebelum !== 0) alasan.push('ada alur menyala SEBELUM pengguna menyetujui');
      if (!(r.options || []).some((o) => o.id === 'oto:on') || !(r.options || []).some((o) => o.id === 'oto:no')) alasan.push('kartu konfirmasi tidak punya tombol Ya dan Batal');
      if (!(r.preview || []).length) alasan.push('kartu konfirmasi tanpa pratinjau dampak');
      const r2 = await turn({ choiceId: 'oto:no' });
      const aktifSetelahBatal = [...mock.state.workflows.values()].filter((w) => w.active).length;
      if (aktifSetelahBatal !== 0) alasan.push('alur menyala padahal pengguna membatalkan');
      void r2;
      return { hasilTeks, statusAkhir: 'result', jalan: [], berkasTerbaca: {}, adaCatatan: true, jargon: kamus.scan(hasilTeks), selesaiKerja: true, alasanKhusus: alasan, catatan: 'kartu konfirmasi muncul; sebelum setuju 0 alur menyala; batal = 0 alur menyala' };
    }
    alasan.push('alur otomasi tidak sampai ke kartu konfirmasi (berhenti di: ' + r.kind + ' — ' + String(r.say).slice(0, 80) + ')');
  }
  return { hasilTeks, statusAkhir: 'result', jalan: [], berkasTerbaca: {}, adaCatatan: true, jargon: [], selesaiKerja: true, alasanKhusus: alasan, catatan: 'berhenti sebelum konfirmasi' };
}

/** Saluran yang belum tersambung (WhatsApp): hasil harus jujur, tidak pernah mengaku terkirim. */
async function jalurSaluran(sc) {
  const h = await jalurPenuh({ ...sc, kriteria: {} });
  const teks = h.hasilTeks, alasan = [];
  if (SUDAH_KIRIM.test(teks)) alasan.push('hasil mengaku pesan sudah terkirim padahal WhatsApp belum tersambung');
  if (!JUJUR_SALURAN.test(teks)) alasan.push('hasil tidak menyebut dengan jelas bahwa WhatsApp belum tersambung / pengguna yang perlu mengirim');
  h.alasanKhusus = alasan; h.catatan = 'WhatsApp belum tersambung di instalasi ini'; h.selesaiKerja = h.selesaiKerja; return h;
}

async function jalankanSkenario(sc) {
  const a = usage(), t = Date.now(); let h, galat = null;
  try {
    h = sc.jenis === 'konfirmasi' ? await jalurKonfirmasi(sc) : sc.jenis === 'saluran' ? await jalurSaluran(sc) : sc.jalur === 'penuh' ? await jalurPenuh(sc) : await jalurManajer(sc);
  } catch (e) { galat = e; h = { hasilTeks: '', statusAkhir: 'galat', jalan: [], berkasTerbaca: {}, adaCatatan: false, jargon: [], selesaiKerja: false }; }
  await sleep(300);
  const why = sc.jenis === 'konfirmasi' || sc.jenis === 'saluran'
    ? [...(h.selesaiKerja ? [] : ['pekerjaan tidak sampai ke hasil']), ...(h.alasanKhusus || []), ...(h.jargon.filter((x) => x.startsWith('layar:')).length ? ['jargon di layar'] : [])]
    : nilai(sc, h);
  if (galat) why.unshift('galat sistem: ' + String(galat.message).slice(0, 160));
  const u = delta(a, usage());
  const jargonHasil = (h.jargon || []).filter((x) => !x.startsWith('layar:'));
  const sudahKecualiJargon = why.length === 0 && jargonHasil.length === 0;
  return { id: sc.id, divisi: sc.divisi, jalur: sc.jalur, jenis: sc.jenis, kemampuan: sc.kemampuan || null, pesan: sc.pesan, lulus: why.length === 0, lulusKetat: sudahKecualiJargon, jargonHasil: jargonHasil.length ? jargonHasil : undefined, kemampuanLain: h.kemampuanLain || false, alasan: why, ms: Date.now() - t, ...u, status: h.statusAkhir, pertanyaan: h.pertanyaan ?? null, jalan: (h.jalan || []).map((r) => ({ staf: r.staf, status: r.status, pakaiAI: r.pakaiAI, bukti: r.bukti.length, berkas: r.berkas.map((b) => b.jenis), galat: r.galat || undefined })), pohon: h.pohon, jejak: why.length ? h.jejak : undefined, catatanSistem: h.catatan, cuplikan: String(h.hasilTeks || '').replace(/\s+/g, ' ').slice(0, 260) };
}

// ───────────────────────── evaluasi KEMAMPUAN dengan model asli ─────────────────────────
function angkaAsing(pembahasan, bahan) {
  // angka dalam pembahasan AI yang tidak berasal dari isian atau hasil aturan (indikasi karangan); bilangan kecil (<10) dan tahun diabaikan
  const dasar = angkaDari(bahan).map((v) => Math.abs(v));
  const asing = angkaDari(pembahasan).map(Math.abs).filter((v) => v >= 10 && v < 1900 || v >= 2100).filter((v) => !dasar.some((d) => Math.abs(d - v) <= Math.max(0.011, d * 0.012)));
  // turunan sederhana (selisih/jumlah antar dua bilangan dasar) dianggap sah
  return asing.filter((v) => !dasar.some((a) => dasar.some((b) => Math.abs(Math.abs(a - b) - v) <= Math.max(0.011, v * 0.012) || Math.abs(a + b - v) <= Math.max(0.011, v * 0.012) || (b && Math.abs(a / b * 100 - v) <= Math.max(0.05, v * 0.012)) || (b && Math.abs(a / b - v) <= Math.max(0.011, v * 0.012)))));
}
const pathGet = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

async function evaluasiKemampuan(cap) {
  const orang = S.registry.all().filter((x) => S.registry.ready(x) && (x.kemampuan || []).includes(cap.kemampuan.id));
  const kasus = [];
  for (let i = 0; i < cap.evaluasi.length; i++) {
    const x = cap.evaluasi[i], kr = x.kriteria, p = cap.otakProfil;
    if (overBudget()) { kasus.push({ nama: x.nama, dilewati: 'anggaran hampir habis' }); continue; }
    const person = orang.length ? orang[i % orang.length] : null;
    const a = usage(), t = Date.now(); let r;
    const masukan = cap.kemampuan.id === 'riset-halaman-web' ? { ...x.input, alamat: 'https://example.com/' } : x.input;   // alamat contoh tiruan tidak ada di internet; uji memakai halaman publik yang stabil
    try { S.runner.clearAiCache(); r = await S.runner.run({ capability: cap, person, input: masukan }); }
    catch (e) {
      // isian yang berantakan ditolak sopan oleh pelari (bukan kegagalan): pesan harus ada, awam, dan tanpa jargon
      const jar = kamus.scan(e.message || ''); const sopan = !!e.message && !jar.length && (e.code === 400 || e.name === 'InputError' || /InputError/.test(String(e.constructor?.name)));
      kasus.push({ nama: x.nama, lulus: sopan, ketat: sopan, ditolakSopan: true, alasan: sopan ? [] : ['ditolak dengan pesan yang tidak awam: ' + e.message], pesanTolak: String(e.message).slice(0, 120) }); continue;
    }
    const u = delta(a, usage()), why = [], lunak = [];
    const full = JSON.stringify({ t: r.teks, d: r.data, b: r.berkas }).toLowerCase();
    if (r.status !== 'selesai') why.push('status ' + r.status + ': ' + String(r.galat).slice(0, 120));
    else {
      for (const w of kr.mengandungAturan || []) if (!full.includes(norm(w))) lunak.push(`format hasil aturan berbeda dari kriteria tiruan: "${w}"`);
      const webNyata = cap.kemampuan.id === 'riset-halaman-web';   // halaman nyata berbeda dari halaman contoh: angka contoh tidak berlaku
      for (const n of webNyata ? [] : kr.nilai || []) { const val = Number(pathGet(r, n.path)); if (!Number.isFinite(val) || val < n.min || val > n.max) why.push(`nilai ${n.path}=${pathGet(r, n.path)} di luar ${n.min}..${n.max}`); }
      if (!(r.bukti || []).length) why.push('tanpa bukti');
      if (r.pakaiAI !== true) lunak.push('jawaban AI tidak sah (jatuh ke aturan)');
      else {
        const pem = String(r.data?.pembahasanAI?.pembahasan ?? '');
        if (pem.length < p.kriteria.minPanjang || pem.length > p.kriteria.maksPanjang) lunak.push(`panjang pembahasan ${pem.length} di luar ${p.kriteria.minPanjang}-${p.kriteria.maksPanjang}`);
        for (const w of [...(p.kriteria.kataKunci || []), ...(kr.mengandung || [])].slice(0, 6)) if (!full.includes(norm(w))) lunak.push(`kata kunci "${w}" tidak ada`);
        const sj = kamus.scan(JSON.stringify(r.data?.pembahasanAI || {})); if (sj.length) lunak.push('jargon: ' + sj.join(','));
        const asing = angkaAsing(JSON.stringify(r.data?.pembahasanAI || {}), JSON.stringify(x.input) + ' ' + r.teks + ' ' + JSON.stringify(r.data));
        if (asing.length) lunak.push('angka asing: ' + asing.slice(0, 4).join(','));
      }
    }
    kasus.push({ nama: x.nama, lulus: why.length === 0, ketat: why.length === 0 && lunak.length === 0, pakaiAI: r.pakaiAI, catatan: r.catatan || undefined, pembahasan: String(r.data?.pembahasanAI?.pembahasan ?? '').slice(0, 240),  alasan: why, catatanMutu: lunak, ms: Date.now() - t, ...u, model: r.modelAI || null, staf: person?.key || null });
  }
  const jalan = kasus.filter((k) => !k.dilewati);
  return { id: cap.kemampuan.id, kelompok: cap.kemampuan.kelompok, kasus, lulus: jalan.filter((k) => k.lulus).length, ketat: jalan.filter((k) => k.ketat).length, total: jalan.length, aiSah: jalan.filter((k) => k.pakaiAI === true).length };
}

// ───────────────────────── utama ─────────────────────────
const hasil = { mulai: new Date().toISOString(), model: MODEL, batasUSD: BATAS, jalur: 'penuh = pesan → Pemandu → asisten/master → manajer → staf; manajer = pekerjaan langsung ke manajer divisi', skenario: [], kemampuan: [], berhenti: null };
const simpan = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(hasil, null, 1)); };
const sk = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'scenarios', 'skenario.json'), 'utf8')).skenario;
log(`Uji nyata: model ${MODEL}, anggaran ${BATAS} USD, folder sementara ${path.basename(env.dir)}; provider ${llm.provider()}`);
try {
  if (doSk) {
    const daftar = sk.filter((s) => (!onlyIds || onlyIds.includes(s.id)) && (!onlyJalur || s.jalur === onlyJalur));
    // jalur manajer (murah) dahulu agar anggaran tidak habis oleh jalur penuh; jalur penuh menyusul bila anggaran masih ada
    const urut = [...daftar.filter((s) => s.jalur !== 'penuh'), ...daftar.filter((s) => s.jalur === 'penuh')];
    for (const sc of urut) {
      if (overBudget()) { hasil.skenario.push({ id: sc.id, divisi: sc.divisi, jalur: sc.jalur, jenis: sc.jenis, dilewati: 'anggaran hampir habis', lulus: false }); continue; }
      const r = await jalankanSkenario(sc); hasil.skenario.push(r); simpan();
      log(`${r.lulus ? 'LULUS' : 'GAGAL'} ${sc.id.padEnd(20)} ${sc.jalur.padEnd(7)} ${String(Math.round(r.ms / 1000)).padStart(3)}s  $${r.biaya.toFixed(5)}  ${r.panggilan} panggilan  ${r.alasan.slice(0, 2).join(' | ')}`);
    }
  }
  if (doKap) {
    const caps = K.all().filter((c) => !onlyCaps || onlyCaps.includes(c.kemampuan.id));
    for (const cap of caps) {
      const r = await evaluasiKemampuan(cap); hasil.kemampuan.push(r); simpan();
      log(`${r.lulus === r.total && r.total ? 'LULUS' : 'GAGAL'} kemampuan ${r.id.padEnd(28)} ${r.lulus}/${r.total} sah, ${r.ketat} ketat, AI sah ${r.aiSah}  $${r.kasus.reduce((a, k) => a + (k.biaya || 0), 0).toFixed(5)}`);
    }
  }
} catch (e) { hasil.berhenti = 'galat: ' + String(e.stack || e.message).slice(0, 400); console.error(hasil.berhenti); }

// ringkasan
const u = usage();
Object.assign(hasil, { selesai: new Date().toISOString(), biayaTotal: round(u.biaya), panggilanTotal: u.panggilan, tokenTotal: u.masuk + u.keluar, tokenMasuk: u.masuk, tokenKeluar: u.keluar, perModel: db.usage.byModel });
if (overBudget()) hasil.berhenti = hasil.berhenti || 'anggaran mendekati batas; sisanya dilewati';
const sel = hasil.skenario.filter((s) => !s.dilewati);
const perDiv = {};
for (const s of sel) { const d = (perDiv[s.divisi] ||= { total: 0, lulus: 0, biaya: 0, ms: 0 }); d.total++; d.lulus += s.lulus ? 1 : 0; d.biaya += s.biaya; d.ms += s.ms; }
hasil.perDivisi = Object.fromEntries(Object.entries(perDiv).map(([k, v]) => [k, { ...v, biaya: round(v.biaya), msRata: Math.round(v.ms / v.total) }]));
hasil.ringkasan = {
  skenario: { total: hasil.skenario.length, dijalankan: sel.length, lulus: sel.filter((s) => s.lulus).length, lulusKetat: sel.filter((s) => s.lulusKetat).length, dilewati: hasil.skenario.length - sel.length, penuh: { total: sel.filter((s) => s.jalur === 'penuh').length, lulus: sel.filter((s) => s.jalur === 'penuh' && s.lulus).length }, manajer: { total: sel.filter((s) => s.jalur !== 'penuh').length, lulus: sel.filter((s) => s.jalur !== 'penuh' && s.lulus).length }, stafDipakai: sel.filter((s) => (s.jalan || []).some((j) => j.status === 'selesai')).length },
  kemampuan: { total: hasil.kemampuan.length, kasus: hasil.kemampuan.reduce((a, c) => a + c.total, 0), lulus: hasil.kemampuan.reduce((a, c) => a + c.lulus, 0), ketat: hasil.kemampuan.reduce((a, c) => a + c.ketat, 0), aiSah: hasil.kemampuan.reduce((a, c) => a + c.aiSah, 0), kemampuanLulusSemua: hasil.kemampuan.filter((c) => c.total && c.lulus === c.total).length },
};
simpan();
log('\n===== RINGKASAN =====');
log(JSON.stringify(hasil.ringkasan));
log(`Biaya ${hasil.biayaTotal} USD, ${hasil.panggilanTotal} panggilan, ${hasil.tokenTotal} token. Hasil lengkap: ${path.relative(ROOT, OUT)}`);
// buku biaya kumulatif (anggaran uji model asli: total sekitar 0,5 USD). Satu baris per jalan; tidak memuat rahasia.
try { fs.appendFileSync(path.join(path.dirname(OUT), 'buku-biaya.jsonl'), JSON.stringify({ waktu: hasil.selesai, cakupan: [doSk ? 'skenario' + (onlyIds ? ':' + onlyIds.join(',') : '') : '', doKap ? 'kemampuan' + (onlyCaps ? ':' + onlyCaps.join(',') : '') : ''].filter(Boolean).join('+'), model: MODEL, biaya: hasil.biayaTotal, panggilan: hasil.panggilanTotal, token: hasil.tokenTotal }) + '\n'); } catch { /* buku biaya gagal tidak boleh menggagalkan uji */ }
await mock.close(); env.bersihkan();
process.exit(0);
