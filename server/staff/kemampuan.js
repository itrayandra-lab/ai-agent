// KEMAMPUAN (apa yang dikerjakan) dipisah dari STAF (siapa yang mengerjakan).
//  - Kemampuan inti: server/staff/capabilities/<id>.json. Berbentuk spesifikasi lengkap (division "kap", key "kap-<id>") sehingga bisa dijalankan
//    sendiri oleh mesin native: masukan, langkah aturan (kerangka dan pemeriksa), blok `otakProfil` (pedoman AI, gaya, skema terstruktur, contoh baik/buruk, batas),
//    keluaran nyata, ditambah `kemampuan` (metadata) dan `evaluasi` (>= 3 masukan contoh dengan kriteria lulus otomatis).
//  - Staf (orang): spesifikasi tetap di server/staff-catalog dengan `kemampuan: [id...]` + `keahlian` (istilah, gaya, contoh, batasan khas peran).
//    Mesin merakit eksekusi = kemampuan + keahlian lewat composeProfil. Aturan khas staf (steps/output) tetap kerangkanya.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec, checkProfil } from './schema.js';

export const capDir = () => process.env.STAFF_CAP_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'capabilities');
let cache = null, cacheAt = 0;
export const reset = () => { cache = null; };

/** Muat semua kemampuan. { caps: Map(id → spec), problems[] }. Di-cache 5 detik. */
export function load({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < 5000) return cache;
  const out = { caps: new Map(), problems: [] };
  let files = []; try { files = fs.readdirSync(capDir()).filter((f) => f.endsWith('.json')); } catch { /* belum ada */ }
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(capDir(), f), 'utf8')); } catch (e) { out.problems.push({ file: f, errors: ['JSON rusak: ' + e.message] }); continue; }
    const errors = validateKemampuan(j);
    if (f !== j.key?.replace(/^kap-/, '') + '.json') errors.push('nama berkas harus <id>.json dengan key kap-<id>');
    if (errors.length) { out.problems.push({ file: f, errors }); continue; }
    out.caps.set(j.kemampuan.id, j);
  }
  cache = out; cacheAt = Date.now(); return out;
}
export const all = () => [...load().caps.values()];
export const get = (id) => load().caps.get(String(id || '')) || null;

const CRIT_KEYS = ['mengandung', 'mengandungAturan', 'panjangMin', 'panjangMaks', 'nilai'];
/** Periksa satu berkas kemampuan. Mengembalikan daftar masalah ([] = sah). */
export function validateKemampuan(c) {
  const e = [];
  if (!c || typeof c !== 'object') return ['bukan objek'];
  if (c.division !== 'kap' || !/^kap-[a-z0-9]+(-[a-z0-9]+)*$/.test(c.key || '')) e.push('division harus "kap" dan key "kap-<id>"');
  const v = validateSpec(c); if (v.kind !== 'ready') e.push(...v.errors.map((x) => 'spesifikasi: ' + x));
  const k = c.kemampuan; if (!k || k.id !== String(c.key).replace(/^kap-/, '') || typeof k.kelompok !== 'string' || !k.tujuanAwam || String(k.tujuanAwam).length > 200) e.push('"kemampuan" wajib { id (= key tanpa kap-), kelompok, tujuanAwam (maks 200) }');
  if (!c.otakProfil) e.push('"otakProfil" wajib (langkah otak AI)'); else for (const m of checkProfil(c.otakProfil)) e.push('otakProfil: ' + m);
  if (c.otakProfil && !Array.isArray(c.otakProfil.pedoman) && c.otakProfil.pedoman !== undefined) e.push('otakProfil.pedoman harus daftar kalimat');
  if (!Array.isArray(c.inputs) || !c.inputs.some((f) => f.type === 'choice')) e.push('masukan harus memuat minimal satu bidang berpilihan tombol (choice) untuk Pemandu');
  const ev = c.evaluasi;
  if (!Array.isArray(ev) || ev.length < 3) e.push('"evaluasi" minimal 3 masukan contoh');
  else ev.forEach((x, i) => {
    if (!x?.nama || !x.input || typeof x.input !== 'object' || typeof x.ai !== 'string' || !x.kriteria || typeof x.kriteria !== 'object') { e.push(`evaluasi[${i}]: butuh nama, input, ai (jawaban AI contoh), kriteria`); return; }
    for (const key of Object.keys(x.kriteria)) if (!CRIT_KEYS.includes(key)) e.push(`evaluasi[${i}]: kriteria "${key}" tidak dikenal`);
    if (!Array.isArray(x.kriteria.mengandung) || !x.kriteria.mengandung.length) e.push(`evaluasi[${i}]: kriteria.mengandung wajib (kata kunci)`);
    if (!(x.kriteria.panjangMin >= 1) || !(x.kriteria.panjangMaks >= x.kriteria.panjangMin)) e.push(`evaluasi[${i}]: panjangMin/panjangMaks wajib`);
  });
  return e;
}

/** Ambil nilai bersarang "data.total" dari hasil. */
const pathGet = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

/** Jalankan SET EVALUASI satu kemampuan (model tiruan: jawaban AI contoh dari berkas). Mengembalikan { ok, kasus: [{nama, ok, gagal[]}] }. */
export async function evaluasi(cap, { runSpec, composeFor } = {}) {
  const run = runSpec || (await import('./native.js')).runSpec; const kasus = [];
  const spec = composeFor ? composeFor(cap) : cap;
  for (const x of cap.evaluasi || []) {
    const gagal = [], kr = x.kriteria;
    const mk = (text) => ({ saveRow() {}, web: async () => ({ status: 200, html: String(cap.sample?.web ? Object.values(cap.sample.web)[0] : '<html><head><title>Contoh</title></head><body>contoh</body></html>') }), llm: async () => ({ text }) });
    try {
      const r = await run(spec, { input: x.input, hooks: mk(x.ai) });
      if (r.tahap !== 'selesai') gagal.push('tidak selesai: ' + (r.pesan || r.tahap));
      else {
        if (r.pakaiAI !== true) gagal.push('jawaban AI contoh tidak lolos skema');
        const all = JSON.stringify(r).toLowerCase();
        for (const w of kr.mengandung) if (!all.includes(String(w).toLowerCase())) gagal.push(`tidak memuat "${w}"`);
        const len = String(r.teks).length; if (len < kr.panjangMin || len > kr.panjangMaks) gagal.push(`panjang teks ${len} di luar ${kr.panjangMin}-${kr.panjangMaks}`);
        for (const n of kr.nilai || []) { const val = Number(pathGet(r, n.path)); if (!Number.isFinite(val) || val < n.min || val > n.max) gagal.push(`nilai ${n.path}=${pathGet(r, n.path)} di luar ${n.min}..${n.max}`); }
        if (!r.berkas?.length && !r.teks) gagal.push('tidak ada keluaran');
      }
      // jatuh-balik: tanpa AI hasil aturan tetap jadi dan memuat kata kunci aturan
      const f = await run(spec, { input: x.input, hooks: mk('') });
      if (f.tahap !== 'selesai') gagal.push('tanpa AI: tidak selesai'); else {
        if (f.pakaiAI === true) gagal.push('tanpa AI: salah menandai pakai AI');
        const fa = JSON.stringify(f).toLowerCase(); for (const w of kr.mengandungAturan || []) if (!fa.includes(String(w).toLowerCase())) gagal.push(`tanpa AI: tidak memuat "${w}"`);
      }
    } catch (err) { gagal.push('galat: ' + err.message); }
    kasus.push({ nama: x.nama, ok: !gagal.length, gagal });
  }
  return { ok: kasus.length >= 3 && kasus.every((k) => k.ok), kasus };
}

// ───────────────────────── perakitan: kemampuan + keahlian ─────────────────────────
const asList = (x) => (Array.isArray(x) ? x : x ? [x] : []);
/** Gabungkan blok otak milik kemampuan dengan keahlian khusus staf. Hasilnya berbentuk otakProfil biasa. */
export function composeProfil(cap, staff) {
  const base = cap.otakProfil, ke = staff.keahlian || {};
  const extra = [];
  if (asList(ke.istilah).length) extra.push('Istilah khas peranmu: ' + asList(ke.istilah).join(', ') + '.');
  if (asList(ke.data).length) extra.push('Data yang biasa kamu tangani: ' + asList(ke.data).join(', ') + '.');
  if (asList(ke.batasan).length) extra.push('Batasan peranmu: ' + asList(ke.batasan).join(' '));
  const kk = String(staff.kataKunci?.[0] || base.kriteria.kataKunci[0]).toLowerCase();
  let contohAI = base.contohAI; try { const j = JSON.parse(base.contohAI); if (typeof j.pembahasan === 'string') j.pembahasan = j.pembahasan.replace(/\.$/, '') + ` (fokus ${kk}).`; contohAI = JSON.stringify(j); } catch { /* biarkan */ }
  return {
    ...base,
    peran: `${staff.title}, memakai kemampuan "${cap.name}"; ${base.peran}`,
    tujuan: `${staff.ringkas} ${base.tujuan}`,
    gaya: [base.gaya, ke.gaya].filter(Boolean).join('; '),
    pedoman: [...asList(base.pedoman), ...extra],
    contoh: { baik: ke.contoh?.baik || base.contoh?.baik, buruk: ke.contoh?.buruk || base.contoh?.buruk },
    batas: { ...base.batas, ...(ke.batas || {}) },
    kriteria: { ...base.kriteria, kataKunci: [kk] },
    contohAI,
    model: ke.model === 'sedang' ? 'sedang' : base.model,
  };
}
/** Spesifikasi kemampuan yang dijalankan oleh seorang staf tertentu (untuk "manajer memilih kemampuan"). */
export function composeFor(cap, staff) { return staff ? { ...cap, employeeId: staff.employeeId, otakProfil: composeProfil(cap, staff) } : cap; }
