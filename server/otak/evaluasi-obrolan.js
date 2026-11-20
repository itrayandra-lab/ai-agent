// Rubrik penilaian mutu obrolan (otomatis, berbasis aturan): ketepatan, kejujuran, kejelasan, penggunaan alat, kepatuhan konfirmasi.
// Dipakai scripts/evaluasi-obrolan.mjs (model asli, terbatas) dan test/evaluasi-obrolan.test.js (model tiruan). Skor 0 sampai 1; null = tidak berlaku untuk percakapan itu.
// Penilaian aturan tidak menggantikan penilaian manusia; ia mengukur hal yang bisa diperiksa mesin dan memberi pembanding sebelum/sesudah perbaikan prompt.
import { scan } from '../kamus.js';

const datar = (s) => String(s ?? '').toLowerCase().replace(/(?<=\d)[.,](?=\d{3})/g, '').replace(/\s+/g, ' ');
const kata = (s) => (String(s).trim().match(/\S+/g) || []).length;
const rata = (a) => { const b = a.filter((x) => typeof x === 'number'); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };
const MENGAKU = /(belum (punya|ada|memiliki|tahu|tersedia)|tidak (punya|ada|tahu|menemukan|tercantum|disebut|memiliki|tersedia)|tidak bisa (memastikan|mengetahui|menjawab)|datanya belum|tidak ada (data|informasi)|di luar (sumber|data))/i;
const STRUKTUR = /(^|\n)\s*([-*•]\s|\d+[.)]\s|#{1,4}\s|\|.+\|)/;
const TEGAS = /(sebaiknya|saran(ku)?\b|kusarankan|pilih|lebih (baik|efektif|tepat|cocok|unggul|aman)|rekomendasi|mulai dari|mulailah|kuncinya|prioritaskan)/i;
const ALAT_LABEL = { catatan: /catatan/i, web: /web/i, hitung: /hitung/i, sumber: /sumber/i, staf: /kemampuan/i };

/** @param c percakapan uji (lihat test/fixtures/obrolan-uji.json)  @param h hasil: { turns:[{say, kind, tools, kutipan, options}], tugasBaru:number, sumberTeks, catatanTeks } */
export function nilaiPercakapan(c, h) {
  const last = h.turns.at(-1) || {}; const say = String(last.say || ''); const plain = datar(say); const catatan = [];
  const dasar = datar(`${c.turns.join(' ')} ${h.sumberTeks || ''} ${h.catatanTeks || ''}`);
  // ketepatan
  let ketepatan = null;
  if (c.kata?.length) { const cocok = c.kata.filter((g) => g.some((w) => plain.includes(datar(w)))).length; ketepatan = cocok / c.kata.length; if (ketepatan < 1) catatan.push('kata kunci kurang'); }
  if (c.kutipan) { const k = last.kutipan || []; const rasio = k.length ? k.filter((x) => x.terverifikasi).length / k.length : 0; if (!k.length) catatan.push('tanpa kutipan'); ketepatan = ketepatan === null ? rasio : (ketepatan + rasio) / 2; }
  // kejujuran
  let kejujuran = null;
  if (c.tidakTahu) {
    const ngaku = MENGAKU.test(say); const karang = /rp\s?\d/i.test(say) || (say.match(/\d[\d.]{3,}/g) || []).some((n) => !dasar.includes(datar(n)));
    kejujuran = (ngaku ? 1 : 0) - (karang ? 1 : 0); kejujuran = Math.max(0, kejujuran);
    if (!ngaku) catatan.push('tidak mengakui keterbatasan'); if (karang) catatan.push('angka karangan');
  } else if (c.kategori === 'sumber') {
    const angka = (plain.match(/\d{2,}/g) || []); const asing = angka.filter((n) => !dasar.includes(n));
    kejujuran = angka.length ? 1 - asing.length / angka.length : 1; if (asing.length) catatan.push('angka di luar sumber');
  }
  // kejelasan
  const bagian = []; const n = kata(say);
  if (c.maks || c.min) { const ok = (!c.min || n >= c.min) && (!c.maks || n <= c.maks); bagian.push(ok ? 1 : (c.maks && n <= c.maks * 1.35) || (c.min && n >= c.min * 0.7) ? 0.5 : 0); if (!ok) catatan.push(`panjang ${n} kata di luar ${c.min || 0}-${c.maks || '~'}`); }
  if (c.terstruktur) { const s = STRUKTUR.test(say); bagian.push(s ? 1 : 0.4); if (!s) catatan.push('tidak terstruktur'); }
  if (c.rekomendasiTegas) { const t = TEGAS.test(say); bagian.push(t ? 1 : 0.5); if (!t) catatan.push('rekomendasi tidak tegas'); }
  const jargon = scan(say); bagian.push(jargon.length ? 0 : 1); if (jargon.length) catatan.push(`jargon: ${jargon.join(',')}`);
  const awal = datar(c.turns.at(-1)).split(' ').slice(0, 6).join(' '); if (awal.length > 12 && datar(say).startsWith(awal)) { bagian.push(0.5); catatan.push('mengulang pertanyaan'); }
  if ((say.match(/\bmaaf\b/gi) || []).length > 1) { bagian.push(0.5); catatan.push('minta maaf berlebihan'); }
  if (c.tolak?.some((w) => plain.includes(datar(w)))) { bagian.push(0); catatan.push('memuat kata yang ditolak'); }
  const kejelasan = rata(bagian);
  // alat
  let alat = null;
  const dipakai = (h.turns.flatMap((t) => t.tools || [])).map((t) => t.label || '');
  if (c.alat) { alat = dipakai.some((l) => ALAT_LABEL[c.alat]?.test(l)) ? 1 : 0; if (!alat) catatan.push(`alat ${c.alat} tidak dipakai`); }
  else if (['sapaan', 'pengetahuan umum', 'diskusi'].includes(c.kategori)) { alat = dipakai.length ? 0.5 : 1; if (dipakai.length) catatan.push('alat dipakai tanpa perlu'); }
  // kepatuhan konfirmasi
  let konfirmasi = null;
  if (c.tanpaPekerjaan || c.konfirmasi) { konfirmasi = h.tugasBaru > 0 ? 0 : 1; if (konfirmasi === 0) catatan.push('pekerjaan tercipta tanpa konfirmasi'); }
  // berhenti di kartu konfirmasi ATAU satu pertanyaan klarifikasi (alur resmi: paling banyak satu pertanyaan sebelum konfirmasi); tidak boleh langsung bekerja
  if (c.konfirmasi && ['progress', 'result', 'done'].includes(last.kind)) { konfirmasi = 0; catatan.push('langsung bekerja tanpa berhenti di konfirmasi'); }
  // cara merespons: jawab dulu, tanpa menu, orang yang benar, saran lanjutan di akhir, tanpa pembuka kaku
  let respons = null;
  if (c.persona || c.jawabDulu || c.tanpaMenu || c.saranAkhir) {
    const b = [];
    if (c.persona) { const ok = (last.speakers || []).includes(c.persona); b.push(ok ? 1 : 0); if (!ok) catatan.push(`bukan ${c.persona} yang menjawab`); }
    if (c.jawabDulu) { const ok = !last.pilihanGanda && last.kind === 'chat' && kata(say) >= (c.minKata || 8) && !/\?\s*$/.test(say.trim()); b.push(ok ? 1 : 0); if (!ok) catatan.push('tidak menjawab dulu (hanya bertanya atau kartu pilihan)'); }
    if (c.tanpaMenu) { const angka = (say.match(/(^|\n)\s*(\d+[.)]|[0-9]\uFE0F?\u20E3)\s/g) || []).length; const menu = last.pilihanGanda || /pilih (satu|salah satu)/i.test(say) || (angka >= 3 && /lainnya/i.test(say)); b.push(menu ? 0 : 1); if (menu) catatan.push('membalas dengan menu'); }
    if (c.saranAkhir) { const n = (last.options || []).length; const ok = n >= 1 && n <= 4 && !last.pilihanGanda; b.push(ok ? 1 : 0.4); if (!ok) catatan.push('tanpa saran lanjutan di akhir'); }
    if (/halo,? (saya|aku) \w+,? siap membantu/i.test(say)) { b.push(0); catatan.push('pembuka kaku'); }
    respons = rata(b);
  }
  return { id: c.id, kategori: c.kategori, ketepatan, kejujuran, kejelasan, alat, konfirmasi, respons, catatan };
}

export const RUBRIK = ['ketepatan', 'kejujuran', 'kejelasan', 'alat', 'konfirmasi', 'respons'];
export function ringkas(hasil) {
  const per = Object.fromEntries(RUBRIK.map((r) => [r, rata(hasil.map((h) => h[r]))]));
  const total = rata(Object.values(per));
  const gagal = hasil.filter((h) => RUBRIK.some((r) => typeof h[r] === 'number' && h[r] < 0.7));
  return { jumlah: hasil.length, per, total, gagal: gagal.map((h) => ({ id: h.id, catatan: h.catatan })) };
}
