// Evaluasi mutu otomatis per staf: satu contoh masukan (sample.input) + kriteria lulus sederhana yang diperiksa mesin
// (struktur, panjang, kata kunci wajib, dan kerangka aturan tetap utuh). Dengan model tiruan (jawaban contoh dari spesifikasi).
// Bukan pengganti uji dengan model asli: itu memeriksa kerapian alur, bukan kecerdasan model.
import { runSpec } from './native.js';
import { checkExpect } from './schema.js';

/** Jawaban AI contoh milik spesifikasi: otakProfil.contohAI, atau sample.ai untuk staf yang punya langkah AI sendiri. */
export const contohAI = (spec) => spec.otakProfil?.contohAI || spec.sample?.ai || '';

export async function evaluasi(spec, { llmText = contohAI(spec) } = {}) {
  const gagal = [];
  const hooks = { saveRow() {}, web: async () => ({ status: 200, html: String(spec.sample?.web ? Object.values(spec.sample.web)[0] : '<html><head><title>Contoh</title></head><body>contoh</body></html>') }), llm: async () => ({ text: llmText }) };
  let r;
  try { r = await runSpec(spec, { input: spec.sample.input, hooks }); } catch (e) { return { ok: false, gagal: ['galat: ' + e.message] }; }
  const bad = checkExpect({ ...r, berkas: r.berkas.filter((b) => b.nama !== spec.key + '-pembahasan') }, spec.sample.expect); if (bad) gagal.push('kerangka aturan rusak: ' + bad);
  if (r.pakaiAI !== true) gagal.push('jawaban AI contoh tidak diterima (struktur tidak sesuai skema)');
  const p = spec.otakProfil;
  if (p) {
    const pem = String(r.data?.pembahasanAI?.pembahasan ?? '');
    if (!/## Pembahasan/.test(r.teks)) gagal.push('bagian pembahasan tidak muncul di teks');
    if (!r.berkas.some((b) => b.nama === spec.key + '-pembahasan')) gagal.push('berkas pembahasan tidak dibuat');
    const k = p.kriteria;
    if (pem.length < k.minPanjang || pem.length > k.maksPanjang) gagal.push(`panjang pembahasan ${pem.length} di luar ${k.minPanjang}-${k.maksPanjang}`);
    for (const w of k.kataKunci) if (!pem.toLowerCase().includes(String(w).toLowerCase())) gagal.push(`kata kunci "${w}" tidak ada`);
  }
  return { ok: !gagal.length, gagal, pakaiAI: r.pakaiAI, berkas: r.berkas.length };
}
