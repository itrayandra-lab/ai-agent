// Sumber dan dokumen obrolan (gaya NotebookLM): pengguna menempel teks, memilih catatan, atau memakai hasil; obrolan menjawab dari sumber itu
// dengan kutipan yang diperiksa terhadap isi aslinya, dan bisa membuat dokumen jadi (ringkasan, panduan belajar, FAQ, briefing, rencana, email, tabel).
import { norm } from './chat-router.js';
import { sistemDokumen } from './otak/perilaku-obrolan.js';

export const LIMIT = { sources: 8, perSource: 40000, doc: 12 };
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function addSource(conv, { judul = '', teks = '', jenis = 'teks', ref = null }) {
  const isi = String(teks ?? '').replace(/\r/g, '').trim().slice(0, LIMIT.perSource);
  if (isi.length < 20) throw Object.assign(new Error('Sumbernya terlalu pendek. Tempel isi yang lebih lengkap.'), { code: 400 });
  conv.sources ||= [];
  if (conv.sources.length >= LIMIT.sources) throw Object.assign(new Error(`Sumber sudah ${LIMIT.sources} (batas). Hapus salah satu dulu.`), { code: 429 });
  const s = { id: `s${(conv.sourceSeq = (conv.sourceSeq || 0) + 1)}`, judul: clip(judul, 80) || `Sumber ${conv.sources.length + 1}`, jenis, ref, isi, t: Date.now() };
  conv.sources.push(s);
  return s;
}
export const removeSource = (conv, id) => { const n = (conv.sources || []).length; conv.sources = (conv.sources || []).filter((s) => s.id !== id); return n !== conv.sources.length; };
export const viewSource = (s, i) => ({ id: s.id, nomor: i + 1, judul: s.judul, jenis: s.jenis, panjang: s.isi.length });

const tok = (s) => norm(s).split(' ').filter((w) => w.length > 2);
function pieces(text, size = 900) {
  const out = []; let cur = '';
  for (const para of String(text).split(/\n{2,}|\n(?=#)/)) {
    if ((cur + para).length > size && cur) { out.push(cur.trim()); cur = ''; }
    if (para.length > size) { for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size).trim()); } else cur += `${para}\n\n`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** blok sumber bernomor untuk perintah model. Sumber pendek masuk utuh; yang panjang dipilih potongannya yang paling cocok dengan pertanyaan. */
export function block(sources = [], query = '', budget = 9000) {
  if (!sources.length) return '';
  const total = sources.reduce((n, s) => n + s.isi.length, 0);
  const q = new Set(tok(query));
  return sources.map((s, i) => {
    const share = Math.max(1200, Math.floor(budget * (s.isi.length / total)));
    let body = s.isi;
    if (total > budget) {
      const ps = pieces(s.isi).map((p, idx) => ({ p, idx, sc: tok(p).filter((w) => q.has(w)).length }));
      const keep = ps.sort((a, b) => b.sc - a.sc || a.idx - b.idx); let used = 0; const pick = [];
      for (const x of keep) { if (used + x.p.length > share && pick.length) break; pick.push(x); used += x.p.length; }
      body = pick.sort((a, b) => a.idx - b.idx).map((x) => x.p).join('\n…\n');
    }
    return `[${i + 1}] ${s.judul}\n${body}`;
  }).join('\n\n');
}
/** kutipan dari model diperiksa terhadap isi sumber asli: cuplikan harus benar-benar ada (kata demi kata, longgar pada spasi dan tanda baca) */
export function verify(sources = [], cites = []) {
  return cites.filter((c) => sources[c.n - 1]).map((c) => {
    const s = sources[c.n - 1]; const hay = ` ${norm(s.isi)} `; const needle = norm(c.cuplikan);
    const ok = !!needle && hay.includes(` ${needle} `) || (needle.split(' ').filter((w) => w.length > 3).length >= 3 && needle.split(' ').filter((w) => w.length > 3).every((w) => hay.includes(` ${w} `)));
    return { n: c.n, judul: s.judul, cuplikan: c.cuplikan, terverifikasi: ok };
  });
}

// ───────────────────────── dokumen jadi ─────────────────────────
export const DOC_TYPES = {
  ringkasan: { label: 'Ringkasan', petunjuk: 'Tulis ringkasan yang padat: satu paragraf inti, lalu 5 sampai 8 poin penting, lalu satu kalimat kesimpulan.' },
  panduan: { label: 'Panduan belajar', petunjuk: 'Susun panduan belajar: tujuan belajar, konsep kunci beserta penjelasan sederhana, contoh, 5 pertanyaan latihan, dan daftar istilah.' },
  faq: { label: 'FAQ', petunjuk: 'Susun 8 sampai 12 pertanyaan yang paling mungkin ditanyakan beserta jawaban singkat yang jelas. Format: **Tanya:** dan **Jawab:**.' },
  briefing: { label: 'Briefing', petunjuk: 'Susun briefing satu halaman: latar belakang, hal terpenting, risiko, keputusan yang dibutuhkan, dan langkah berikutnya.' },
  rencana: { label: 'Rencana', petunjuk: 'Susun rencana kerja bertahap: tujuan, langkah berurutan dengan penanggung jawab yang disarankan dan perkiraan waktu, ukuran keberhasilan, dan risiko.' },
  email: { label: 'Email', petunjuk: 'Tulis email siap kirim: baris Subjek, sapaan, isi yang ringkas dan sopan, penutup. Jangan mengarang nama atau angka yang tidak ada di bahan.' },
  notulensi: { label: 'Notulensi', petunjuk: 'Tulis notulensi ringkas dari percakapan: **Kesimpulan** (2 sampai 3 kalimat), **Keputusan** (poin; tulis "belum ada keputusan" bila memang belum), dan **Tugas lanjutan** (poin: apa, siapa penanggung jawabnya, kapan bila disebut). Pakai hanya isi percakapan; jangan menambah keputusan atau tugas yang tidak dibicarakan.' },
  tabel: { label: 'Tabel', petunjuk: 'Rapikan isi bahan menjadi satu atau dua tabel markdown yang jelas (kolom bermakna), diikuti satu kalimat penjelasan.' },
};
export const GEN_ACTIONS = Object.entries(DOC_TYPES).map(([id, d]) => ({ id: `gen:${id}`, label: d.label }));
export const docSystem = (name) => sistemDokumen(name);   // satu sumber perilaku: server/otak/perilaku-obrolan.js
export function docPrompt(type, material, instruksi = '') {
  const d = DOC_TYPES[type];
  return `${d.petunjuk}${instruksi ? `\nTambahan dari pengguna: ${instruksi}` : ''}\n\nBAHAN:\n${material}`;
}
export function revisePrompt(isi, instruksi) {
  return `Ubah dokumen berikut sesuai perintah: ${instruksi}\nPertahankan fakta; hanya ubah bentuk, panjang, atau gaya sesuai perintah. Keluarkan dokumen utuh hasil perubahan saja.\n\nDOKUMEN:\n${isi}`;
}
export const REVISE_RE = /^\s*(?:tolong\s+)?(?:ubah|buat(?:kan)?|tambah(?:kan)?|ganti|perpendek|perpanjang|jadikan|singkat(?:kan)?|rapikan|terjemahkan|lebih)\b/i;
