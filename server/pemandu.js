// PEMANDU: wajah depan RAIVERSE. Memimpin percakapan dengan tombol pilihan; otak dan backend yang bekerja di belakang layar.
// Rancangan: docs/PEMANDU-ALUR-AWAM.md. Titik sambung sesi lain: docs/PEMANDU-TITIK-SAMBUNG.md.
//
// Tiga jenjang hemat token:
//   L0  aturan + templat, tanpa token  (6 niat umum)
//   L1  model kecil dengan JSON ketat  (niat tak terduga) + cache + cadangan templat L0
//   L2  model besar hanya untuk karya  (dikerjakan lewat submitGoal di langkah "Kerjakan")
import * as store from './store.js';
import * as engine from './engine.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
import * as kamus from './kamus.js';
import * as mem from './memory-lite.js';
import dns from 'node:dns/promises';
import net from 'node:net';

const db = () => store.get();
const state = () => (db().pemandu ||= { sessions: {}, profiles: {}, cache: {} });
const emp = (id) => db().employees.find((e) => e.id === id);
const now = () => Date.now();
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ───────────────────────── templat L0 ─────────────────────────
const ETA = { fast: 'sebentar, sekitar 20 detik', balanced: 'sekitar 1 menit', full: 'beberapa menit' };
const COST = { fast: 'hemat', balanced: 'biasa', full: 'lengkap' };
const o = (id, label, hint, recommended) => ({ id, label, ...(hint ? { hint } : {}), ...(recommended ? { recommended: true } : {}) });

export const INTENTS = {
  konten: {
    label: 'Membuat konten', kartu: 'Bantu aku membuat konten', ikon: 'edit',
    re: /\b(konten|caption|postingan|posting|instagram|tiktok|reels|iklan|poster|promo|feed|story)\b/i,
    qs: [
      { id: 'tujuan', brief: 'Tujuan konten', say: 'Konten ini untuk apa?', opts: [o('baru', 'Menarik pembeli baru', 'Cocok untuk akun yang baru tumbuh', 1), o('promo', 'Promo minggu ini', 'Ada penawaran yang mau diumumkan'), o('cerita', 'Cerita tentang usahaku', 'Biar orang kenal dan percaya')] },
      { id: 'kanal', brief: 'Dipasang di', say: 'Mau dipasang lewat mana?', profileKey: 'kanal', infer: [[/instagram|\big\b|reels/i, 'ig'], [/whatsapp|\bwa\b/i, 'wa']], opts: [o('ig', 'Instagram'), o('wa', 'WhatsApp'), o('dua', 'Keduanya', 'Hasilnya cocok untuk dua tempat', 1)], learn: { ig: 'Instagram', wa: 'WhatsApp', dua: 'Instagram dan WhatsApp' } },
    ],
    plans: {
      fast: { give: '1 teks siap pakai dan 1 ide gambar', out: 'Satu teks yang bisa langsung kamu salin' },
      balanced: { give: '5 teks dan jadwal tayang 1 minggu', out: 'Lima teks beserta jadwal tayang' },
      full: { give: 'Rencana 30 hari, 15 teks, dan ide visual', out: 'Rencana bulanan lengkap dengan teks dan ide gambar' },
    },
    lanjut: [['wa', 'Buat versi WhatsApp', 'Ubah hasil tadi jadi versi WhatsApp yang singkat dan akrab'], ['jadwal', 'Jadwalkan'], ['selesai', 'Selesai dulu']],
  },
  riset: {
    label: 'Mencari tahu', kartu: 'Cari tahu soal sesuatu', ikon: 'search',
    re: /\b(riset|cari tahu|carikan|cari|bandingkan|pesaing|kompetitor|tren|harga pasar|selidiki|apa itu)\b/i,
    qs: [
      { id: 'fokus', brief: 'Yang ingin diketahui', say: 'Kamu paling ingin tahu soal apa?', opts: [o('pesaing', 'Pesaing di sekitarku', 'Siapa mereka dan apa kelebihannya', 1), o('pasar', 'Siapa pembeli yang cocok'), o('harga', 'Harga di pasaran')] },
      { id: 'bentuk', brief: 'Bentuk laporan', say: 'Mau laporannya seperti apa?', opts: [o('ringkas', 'Ringkas satu halaman', '', 1), o('lengkap', 'Lengkap dengan sumbernya')] },
    ],
    plans: {
      fast: { give: 'Ringkasan 5 poin', out: 'Lima poin penting yang mudah dibaca' },
      balanced: { give: 'Laporan 1 halaman beserta sumbernya', out: 'Satu halaman laporan dengan sumber' },
      full: { give: 'Laporan lengkap, peluang, dan langkah berikutnya', out: 'Laporan menyeluruh plus saran langkah' },
    },
    lanjut: [['rencana', 'Jadikan rencana langkah', 'Susun rencana langkah dari hasil tadi', 'rencana'], ['ringkas5', 'Ringkas jadi 5 poin', 'Ringkas hasil tadi jadi 5 poin'], ['selesai', 'Selesai dulu']],
  },
  rencana: {
    label: 'Menyusun rencana', kartu: 'Atur rencana usahaku', ikon: 'goal',
    re: /\b(rencana|strategi|bisnis plan|proposal|target|modal|jadwal|roadmap|langkah)\b/i,
    qs: [
      { id: 'tahap', brief: 'Tahap usaha', say: 'Usahamu sekarang ada di tahap mana?', opts: [o('baru', 'Baru mau mulai'), o('jalan', 'Sudah jalan, mau berkembang', '', 1), o('produk', 'Mau meluncurkan sesuatu yang baru')] },
      { id: 'fokus', brief: 'Fokus rencana', say: 'Mau fokus ke mana dulu?', opts: [o('jual', 'Penjualan', 'Biar lebih banyak yang beli', 1), o('uang', 'Uang masuk dan keluar'), o('promosi', 'Cara orang mengenal usahaku')] },
    ],
    plans: {
      fast: { give: '3 langkah paling penting untuk minggu ini', out: 'Tiga langkah yang bisa langsung dikerjakan' },
      balanced: { give: 'Rencana 4 minggu dengan target tiap minggu', out: 'Rencana empat minggu yang jelas' },
      full: { give: 'Rencana 3 bulan, target, perkiraan biaya, dan risikonya', out: 'Rencana tiga bulan lengkap' },
    },
    lanjut: [['pesan', 'Tulis pesan untuk tim atau pelanggan', 'Tulis pesan singkat berdasarkan rencana tadi', 'pesan'], ['jadwal', 'Jadwalkan pengingat'], ['selesai', 'Selesai dulu']],
  },
  pesan: {
    label: 'Menulis pesan', kartu: 'Tuliskan sebuah pesan', ikon: 'chat',
    re: /\b(pesan|balas|balasan|email|surel|surat|undangan|ucapan|tagih|penawaran|chat ke|kirim ke)\b/i,
    qs: [
      { id: 'untuk', brief: 'Pesan untuk', say: 'Pesan ini untuk siapa?', opts: [o('pelanggan', 'Pelanggan', '', 1), o('rekan', 'Rekan kerja'), o('mitra', 'Mitra atau pemasok')] },
      { id: 'nada', brief: 'Gaya bahasa', say: 'Mau pakai gaya bahasa apa?', profileKey: 'gaya', infer: [[/santai|akrab/i, 'santai'], [/resmi|formal|sopan/i, 'resmi']], opts: [o('santai', 'Santai dan ramah', '', 1), o('resmi', 'Sopan dan resmi'), o('tegas', 'Tegas tapi halus')], learn: { santai: 'santai dan ramah', resmi: 'sopan dan resmi', tegas: 'tegas tapi halus' } },
    ],
    plans: {
      fast: { give: '1 pesan siap kirim', out: 'Satu pesan yang bisa langsung kamu kirim' },
      balanced: { give: '1 pesan dan 2 versi lain', out: 'Tiga versi pesan untuk kamu pilih' },
      full: { give: 'Pesan, 2 versi lain, dan balasan untuk 3 kemungkinan jawaban', out: 'Pesan lengkap dengan bahan membalas' },
    },
    lanjut: [['santai', 'Buat versi lebih santai', 'Ubah pesan tadi jadi lebih santai'], ['tolak', 'Buat balasan kalau dia menolak', 'Tulis balasan kalau penerimanya menolak'], ['selesai', 'Selesai dulu']],
  },
  ringkas: {
    label: 'Meringkas', kartu: 'Ringkaskan sebuah tulisan', ikon: 'doc',
    re: /\b(ringkas|ringkaskan|rangkum|rangkuman|simpulkan|intisari|summary|summarize)\b/i,
    needsText: true,
    qs: [
      { id: 'bentuk', brief: 'Bentuk ringkasan', say: 'Mau ringkasannya berbentuk apa?', opts: [o('poin', 'Poin-poin', '', 1), o('paragraf', 'Satu paragraf'), o('tindakan', 'Hal yang harus kulakukan')] },
      { id: 'panjang', brief: 'Panjang', say: 'Seberapa singkat?', opts: [o('sangat', 'Sangat singkat'), o('sedang', 'Sedang', '', 1)] },
    ],
    plans: {
      fast: { give: 'Ringkasan 3 kalimat', out: 'Tiga kalimat inti' },
      balanced: { give: 'Ringkasan poin penting dan kesimpulan', out: 'Poin penting dan kesimpulan' },
      full: { give: 'Ringkasan, poin penting, dan daftar tindakan', out: 'Ringkasan lengkap dengan daftar tindakan' },
    },
    lanjut: [['tindakan', 'Jadikan daftar tindakan', 'Ubah ringkasan tadi jadi daftar tindakan'], ['balas', 'Tulis balasannya', 'Tulis balasan berdasarkan ringkasan tadi'], ['selesai', 'Selesai dulu']],
  },
  belajar: {
    label: 'Belajar', kartu: 'Ajari aku sesuatu', ikon: 'book',
    re: /\b(belajar|ajari|ajarin|jelaskan|pelajari|tutorial|kursus|les|cara membuat|cara kerja)\b/i,
    qs: [
      { id: 'level', brief: 'Pengalaman', say: 'Seberapa jauh kamu sudah tahu soal ini?', opts: [o('baru', 'Belum tahu sama sekali', '', 1), o('sedikit', 'Sudah tahu sedikit'), o('dalam', 'Mau memperdalam')] },
      { id: 'cara', brief: 'Cara belajar', say: 'Mau belajar dengan cara apa?', opts: [o('contoh', 'Penjelasan singkat dan contoh', '', 1), o('rencana', 'Rencana belajar 7 hari'), o('latihan', 'Latihan soal')] },
    ],
    plans: {
      fast: { give: 'Penjelasan singkat dengan 1 contoh', out: 'Penjelasan yang mudah dipahami' },
      balanced: { give: 'Penjelasan, 3 contoh, dan latihan kecil', out: 'Bahan belajar yang bisa langsung dicoba' },
      full: { give: 'Rencana belajar 7 hari beserta latihan', out: 'Rencana belajar mingguan lengkap' },
    },
    lanjut: [['latihan', 'Buat latihan soal', 'Buat latihan soal dari materi tadi'], ['tujuh', 'Buat rencana belajar 7 hari', 'Buat rencana belajar 7 hari dari materi tadi'], ['selesai', 'Selesai dulu']],
  },
};
const UMUM = {
  label: 'Membantu', ikon: 'spark', re: /$^/,
  qs: [
    { id: 'jenis', brief: 'Bentuk hasil', say: 'Kamu mau hasilnya berupa apa?', opts: [o('tulisan', 'Tulisan siap pakai', '', 1), o('langkah', 'Daftar langkah'), o('jawaban', 'Penjelasan singkat')] },
    { id: 'ukuran', brief: 'Ukuran', say: 'Seberapa panjang?', opts: [o('singkat', 'Singkat'), o('sedang', 'Sedang', '', 1), o('lengkap', 'Lengkap')] },
  ],
  plans: {
    fast: { give: 'Jawaban singkat dan jelas', out: 'Satu jawaban singkat' },
    balanced: { give: 'Hasil yang rapi dengan penjelasan', out: 'Hasil rapi dan mudah dipakai' },
    full: { give: 'Hasil lengkap beserta saran langkah berikutnya', out: 'Hasil menyeluruh dengan saran' },
  },
  lanjut: [['ringkas', 'Buat lebih ringkas', 'Buat hasil tadi lebih ringkas'], ['jadwal', 'Jadwalkan'], ['selesai', 'Selesai dulu']],
};
const KARTU_AWAL = ['konten', 'riset', 'rencana', 'pesan'];
const SAPAAN = /^\s*(hi|hai|halo|hello|hey|pagi|siang|sore|malam|assalamualaikum|permisi|tes|test|p)\W*$/i;

const tmplOf = (s) => (s.intent === 'umum' ? (s.l1 ? { ...UMUM, ...s.l1 } : UMUM) : INTENTS[s.intent] || UMUM);

export function detectIntent(text) {
  const t = String(text || '');
  for (const [id, it] of Object.entries(INTENTS)) if (it.re.test(t)) return id;
  return null;
}

// ───────────────────────── jatah, profil ─────────────────────────
export function quota() {
  const budget = Number(db().settings.dailyBudgetUSD) || 0;
  if (!budget) return { pct: 100, word: 'Masih banyak' };
  const pct = Math.max(0, Math.min(100, Math.round((llm.budgetLeft() / budget) * 100)));
  return { pct, word: pct > 60 ? 'Masih banyak' : pct > 25 ? 'Cukup' : pct > 0 ? 'Hampir habis' : 'Habis' };
}

const PROFIL_LABEL = { nama: 'Nama usaha', bidang: 'Usahaku bergerak di', situs: 'Alamat situs', target: 'Pembeli yang dituju', gaya: 'Gaya bahasa', kanal: 'Tempat berjualan atau promosi', hindari: 'Hal yang tidak kusuka' };
const profileOf = (userId) => (state().profiles[userId] ||= { data: {}, skipped: false, updatedAt: 0 });
export function profileView(userId) {
  const p = profileOf(userId);
  const items = Object.keys(PROFIL_LABEL).filter((k) => p.data[k]).map((k) => ({ key: k, label: PROFIL_LABEL[k], value: p.data[k] }));
  // hal yang dipelajari dari pengalaman bersama (sesi belajar mandiri, server/memory-lite.js); boleh dihapus pengguna
  let extras = []; try { extras = mem.read('pengguna', userId).entries.map((teks, i) => ({ nomor: i + 1, teks })); } catch { /* belum ada */ }
  return { known: items.length > 0 || extras.length > 0, skipped: p.skipped, items, extras, fields: Object.entries(PROFIL_LABEL).map(([key, label]) => ({ key, label })) };
}
const userName = (userId) => { const n = (emp(userId)?.name || '').split(/\s+/)[0] || ''; return /^(anda|owner|pemilik|admin)$/i.test(n) ? '' : n; };

/** simpan profil sebagai catatan sistem di Catatan (ingatan) supaya pembantu lain ikut membacanya */
function syncProfileNote(userId) {
  const p = profileOf(userId);
  const lines = Object.keys(PROFIL_LABEL).filter((k) => p.data[k]).map((k) => `- **${PROFIL_LABEL[k]}:** ${p.data[k]}`);
  p.updatedAt = now();
  if (!lines.length) return;
  try {
    brain.writeNote({ title: `Profil pengguna ${userId}`, folder: 'Sistem', tags: ['sistem', 'profil'], authorId: 'system', visibility: 'internal', content: `# Profil pengguna ${userId}\nCatatan sistem: apa yang Pemandu tahu tentang pengguna ini. Dipakai supaya tidak bertanya dua kali.\n\n${lines.join('\n')}\n` });
  } catch (err) { console.warn('[pemandu] profil tidak tersimpan di catatan:', err.message); }
  store.save();
}
export function setProfile(userId, changes, { replace = false } = {}) {
  const p = profileOf(userId);
  if (replace) p.data = {};
  for (const [k, v] of Object.entries(changes || {})) {
    if (!PROFIL_LABEL[k]) continue;
    const val = clip(v, 240);
    if (val) p.data[k] = val; else delete p.data[k];
  }
  syncProfileNote(userId);
  return profileView(userId);
}

// ───────────────────────── onboarding (satu alamat situs atau satu kalimat) ─────────────────────────
const privateIp = (ip) => net.isIP(ip) === 4
  ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
  : /^(::1?$|fc|fd|fe80)/i.test(ip);
let fetchImpl = (...a) => fetch(...a);
export const setFetch = (fn) => { fetchImpl = fn; };   // untuk tes
async function readSite(raw) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|.*\.local)$/i.test(u.hostname)) return null;
  if (net.isIP(u.hostname) ? privateIp(u.hostname) : (await dns.lookup(u.hostname, { all: true }).catch(() => [])).some((a) => privateIp(a.address))) return null;   // jangan membuka alamat jaringan dalam
  const res = await fetchImpl(u, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'RaiversePemandu/1.0', accept: 'text/html' } });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 400000);
  const meta = (n) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${n}["']`, 'i'))?.[1] || '';
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
  const heads = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ' ')).slice(0, 4).join('. ');
  return { host: u.hostname.replace(/^www\./, ''), nama: clip(meta('og:site_name') || title.split(/\s[|\-–—]\s/)[0], 80), desc: clip(meta('description') || meta('og:description'), 220), heads: clip(heads, 220) };
}
const URL_RE = /((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;

let l1Impl = null;   // diganti tes; bila kosong dipakai llm.json
export const setL1 = (fn) => { l1Impl = fn; };
const l1Live = () => !!l1Impl || (llm.isLive() && llm.budgetLeft() > 0);
async function l1(schema, system, prompt) {
  if (l1Impl) return l1Impl({ schema, system, prompt });
  return llm.json({ system, prompt, schema, model: 'openai/gpt-oss-20b', maxTokens: 1200, effort: 'low' });
}

export async function onboard(userId, input) {
  const text = clip(input, 800);
  if (!text) throw Object.assign(new Error('Tulis satu kalimat tentang usahamu, atau tempel alamat situsnya.'), { code: 400 });
  const found = {};
  const url = text.match(URL_RE)?.[1];
  let site = null;
  if (url && /\./.test(url) && !/\s/.test(url)) { try { site = await readSite(url); } catch { site = null; } }
  if (site) {
    found.situs = site.host;
    if (site.nama) found.nama = site.nama;
    if (site.desc || site.heads) found.bidang = site.desc || site.heads;
  } else {
    const sentence = text.replace(URL_RE, '').trim();
    const nm = sentence.match(/(?:nama (?:usaha|toko|bisnis)(?:ku| saya)?(?: adalah| yaitu)?|namaku|usahaku bernama)\s+["“]?([\w' .&-]{2,40})/i)?.[1];
    if (nm) found.nama = clip(nm.replace(/\s+(di|dan|yang|untuk)\b.*$/i, ''), 60);
    const rest = sentence.replace(/^(?:nama\w*|usahaku bernama)[^,.;]*[,.;]\s*/i, '').trim();   // buang kalimat pembuka yang hanya menyebut nama
    if (rest || sentence) found.bidang = clip(rest || sentence, 200);
    if (url && !site) found.situs = clip(url, 80);
  }
  // L1 (hanya bila ada model aktif): rapikan jadi profil singkat
  if (l1Live() && (site || text.length > 20)) {
    try {
      const out = await l1({ type: 'object', additionalProperties: false, required: ['nama', 'bidang', 'target', 'gaya'], properties: { nama: { type: 'string' }, bidang: { type: 'string' }, target: { type: 'string' }, gaya: { type: 'string' } } },
        'Kamu menyusun profil usaha singkat dalam Bahasa Indonesia sehari-hari. Isi hanya dari bahan yang diberikan; kosongkan bila tidak ada. Maksimal 15 kata per isian.',
        `Bahan: ${site ? `situs ${site.host}; judul ${site.nama}; deskripsi ${site.desc}; judul bagian ${site.heads}` : text}`);
      for (const k of ['nama', 'bidang', 'target', 'gaya']) if (clip(out[k], 200) && kamus.bersih(out[k])) found[k] = clip(out[k], 200);
    } catch (err) { console.warn('[pemandu] ringkasan profil lewat L1 gagal, pakai aturan:', err.message); }
  }
  if (!Object.keys(found).length) throw Object.assign(new Error('Aku belum bisa membaca itu. Coba tulis satu kalimat tentang usahamu.'), { code: 422 });
  setProfile(userId, found);
  profileOf(userId).skipped = false;
  return { say: 'Terima kasih! Ini yang aku tahu tentang kamu. Sudah betul?', profile: profileView(userId), fromSite: !!site };
}

// ───────────────────────── L1: niat tak terduga ─────────────────────────
const L1_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['label', 'questions', 'plans'],
  properties: {
    label: { type: 'string' },
    questions: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false, required: ['say', 'options'], properties: { say: { type: 'string' }, options: { type: 'array', maxItems: 3, items: { type: 'string' } } } } },
    plans: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['give'], properties: { give: { type: 'string' } } } },
  },
};
/** menolak apa pun yang tidak sesuai bentuk atau memuat kata terlarang; pemanggil lalu memakai templat umum */
export function validateL1(out) {
  try {
    const label = clip(out.label, 40);
    if (!label) return null;
    const qs = (out.questions || []).slice(0, 2).map((q, i) => {
      const labels = (q.options || []).map((x) => clip(x, 48)).filter(Boolean).slice(0, 3);
      if (!clip(q.say, 120) || labels.length < 2) throw new Error('pertanyaan tidak sah');
      return { id: `q${i + 1}`, brief: clip(q.say, 60), say: clip(q.say, 120), opts: labels.map((l, j) => o(`o${j + 1}`, l, '', j === 0)) };
    });
    const gives = (out.plans || []).map((p) => clip(p.give, 110));
    if (gives.length !== 3 || gives.some((g) => !g)) throw new Error('rencana tidak sah');
    const plans = Object.fromEntries(['fast', 'balanced', 'full'].map((k, i) => [k, { give: gives[i], out: gives[i] }]));
    const t = { label, qs, plans };
    if (!kamus.bersih(JSON.stringify(t))) throw new Error('memuat kata terlarang');
    return t;
  } catch { return null; }
}
async function l1Template(input) {
  const key = clip(input.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''), 80);
  const cache = state().cache;
  if (cache[key]) return cache[key];
  if (!l1Live()) return null;
  try {
    const out = validateL1(await l1(L1_SCHEMA, 'Kamu Pemandu yang ramah. Dari permintaan pengguna awam, susun nama pekerjaan singkat, paling banyak 2 pertanyaan pilihan (2-3 pilihan pendek), dan 3 tingkat hasil (cepat, seimbang, lengkap) dalam Bahasa Indonesia sehari-hari. Jangan pakai istilah teknis.', `Permintaan: ${clip(input, 400)}`));
    if (out) { const keys = Object.keys(cache); if (keys.length > 60) delete cache[keys[0]]; cache[key] = out; store.save(); }
    return out;
  } catch (err) { console.warn('[pemandu] L1 gagal, pakai templat umum:', err.message); return null; }
}

// ───────────────────────── keamanan bawaan ─────────────────────────
const AMAN = [
  { re: /\b(bunuh diri|mengakhiri hidup|menyakiti diri|ingin mati)\b/i, say: 'Aku turut prihatin kamu sedang berat. Kamu tidak sendirian. Tolong hubungi orang terdekat atau layanan bantuan di kotamu sekarang. Kalau mau, aku temani bicara pelan-pelan.' },
  { re: /\b(cara (?:membuat|merakit) (?:bom|racun|senjata)|bikin (?:bom|racun)|situs porno|konten dewasa anak)\b/i, say: 'Maaf, itu tidak bisa aku bantu. Kita coba hal lain yang aman ya.' },
];

// ───────────────────────── sesi ─────────────────────────
const key = (userId, id) => `${userId}:${id}`;
const mkId = () => store.uid('p');
function getSession(userId, sessionId) {
  const S = state().sessions;
  const id = /^[\w-]{6,48}$/.test(sessionId || '') ? sessionId : mkId();
  const k = key(userId, id);
  if (!S[k]) {
    S[k] = { id, userId, intent: null, input: '', extra: '', answers: {}, qs: [], qi: 0, awaiting: null, planId: null, stage: 'start', goalId: null, revs: 0, history: [], notes: [], learned: null, createdAt: now(), updatedAt: now() };
    const keys = Object.keys(S);
    if (keys.length > 40) for (const old of keys.sort((a, b) => S[a].updatedAt - S[b].updatedAt).slice(0, keys.length - 40)) delete S[old];
  }
  return S[k];
}
const SNAP = ['intent', 'input', 'extra', 'answers', 'qs', 'qi', 'awaiting', 'planId', 'stage'];
const snapshot = (s) => s.history.push(JSON.parse(JSON.stringify(Object.fromEntries(SNAP.map((k) => [k, s[k]])))));
function goBack(s) {
  const prev = s.history.pop();
  if (!prev) return reset(s);
  Object.assign(s, prev, { notes: [], learned: null });
}
function reset(s) { Object.assign(s, { auto: null, l1: null, intent: null, input: '', extra: '', answers: {}, qs: [], qi: 0, awaiting: null, planId: null, stage: 'start', goalId: null, revs: 0, history: [], notes: [], learned: null }); }

const STEP = { start: 1, ask: 1, plan: 2, confirm: 2, work: 3, result: 4, tweak: 4, done: 4, auto: 4 };
const base = (s) => ({ sessionId: s.id, step: { now: STEP[s.stage] || 1, of: 4 }, undo: s.history.length > 0 && !['work', 'result', 'done', 'auto'].includes(s.stage), quota: quota(), delegate: false, freeText: false, options: [] });
const take = (s, k) => { const v = s[k]; s[k] = k === 'notes' ? [] : null; return v; };

function pickQuestions(s) {
  const t = tmplOf(s); const p = profileOf(s.userId).data; const used = [];
  for (const q of t.qs) {
    const inferred = q.infer?.find(([re]) => re.test(`${s.input} ${s.extra}`))?.[1];
    if (inferred) { s.answers[q.id] = { id: inferred, label: q.opts.find((x) => x.id === inferred)?.label || inferred, auto: true }; continue; }
    if (q.profileKey && p[q.profileKey]) { s.answers[q.id] = { id: 'profil', label: p[q.profileKey], auto: true, fromProfile: true }; s.notes.push(`Aku pakai yang sudah kamu ceritakan: ${PROFIL_LABEL[q.profileKey].toLowerCase()} ${p[q.profileKey]}.`); continue; }
    used.push(q.id);
  }
  s.qs = used.slice(0, 2);   // paling banyak dua pertanyaan
  s.qi = 0;
}

function enterAfterCapture(s) {
  pickQuestions(s);
  s.stage = s.qs.length ? 'ask' : 'plan';
}

// ───────────────────────── render: satu keadaan -> satu objek (kontrak data bagian 3) ─────────────────────────
function offerCards(s, ctx = {}) {
  return Promise.all(Object.values(CARDS).map(async (c) => { try { return await c.offer({ session: s, userId: s.userId, ...ctx }); } catch { return null; } })).then((a) => a.filter(Boolean));
}

async function render(s) {
  const b = base(s); const t = tmplOf(s);
  const notes = s.notes.length ? take(s, 'notes') : null;
  const learned = s.learned ? take(s, 'learned') : null;
  const extra = { ...(notes ? { notes } : {}), ...(learned ? { learned } : {}) };
  switch (s.stage) {
    case 'start': {
      const nm = userName(s.userId);
      return { ...b, ...extra, kind: 'choices', say: `${greeting()}${nm ? ', ' + nm : ''}! Mau dibantu apa hari ini?`, options: KARTU_AWAL.map((id) => o(`intent:${id}`, INTENTS[id].kartu, '')), freeText: true, delegate: false };
    }
    case 'ask': {
      const q = t.qs.find((x) => x.id === s.qs[s.qi]);
      if (s.awaiting === 'other') return { ...b, ...extra, kind: 'choices', say: 'Ketik jawabanmu, atau ucapkan lewat mikrofon.', options: [], freeText: true, delegate: true };
      return { ...b, ...extra, kind: 'choices', say: q.say, options: q.opts, delegate: true, freeText: true, ask: { now: s.qi + 1, of: s.qs.length } };
    }
    case 'topic':
      return { ...b, ...extra, kind: 'choices', say: `Seru! ${t.label} tentang apa? Ketik atau ucapkan satu kalimat saja.`, options: profileOf(s.userId).data.nama ? [o('topic:usaha', `Tentang ${profileOf(s.userId).data.nama}`)] : [], freeText: true, delegate: true };
    case 'plan': {
      const low = quota().pct < 25;
      const opts = ['fast', 'balanced', 'full'].map((k) => ({ ...o(`plan:${k}`, { fast: 'Cepat', balanced: 'Seimbang', full: 'Lengkap' }[k], t.plans[k].give, (low ? k === 'fast' : k === 'balanced')), eta: ETA[k], cost: COST[k] }));
      return { ...b, ...extra, kind: 'plan', say: low ? 'Jatah hari ini tinggal sedikit, jadi aku sarankan yang Cepat. Pilih yang kamu mau:' : 'Ini tiga cara aku bisa membantu. Pilih satu:', options: opts, freeText: true, delegate: true };
    }
    case 'confirm': {
      const p = t.plans[s.planId];
      return { ...b, ...extra, kind: 'confirm', say: `Siap. Aku akan membuat: ${p.give}. Hasilnya kamu terima sebagai: ${p.out}. Mulai sekarang?`, preview: previewOf(s, t), options: [o('start', 'Mulai', ETA[s.planId], 1), o('edit', 'Ubah pilihan')] };
    }
    case 'work': if (resultOf(s)) { s.stage = 'result'; return render(s); } return progressOf(s, b);
    case 'result': case 'tweak': {
      const r = resultOf(s);
      if (!r) return progressOf(s, b);
      if (s.stage === 'tweak') {
        if (s.awaiting === 'other') return { ...b, kind: 'choices', say: 'Ketik bagian mana yang mau diubah.', options: [], freeText: true, result: r };
        return { ...b, kind: 'choices', say: 'Mau diubah bagaimana?', options: [o('tw:singkat', 'Lebih singkat'), o('tw:santai', 'Lebih santai'), o('tw:resmi', 'Lebih resmi'), o('tw:lengkap', 'Lebih lengkap')], freeText: true, result: r };
      }
      return { ...b, ...extra, kind: 'result', say: 'Ini hasilnya. Bagaimana menurutmu?', result: r, options: [o('use', 'Pakai ini', '', 1), o('tweak', 'Ubah sedikit'), o('redo', 'Ulangi'), o('save', 'Simpan')] };
    }
    case 'auto': return renderAuto(s, b);
    case 'done': {
      const cards = await offerCards(s);
      return { ...b, ...extra, kind: 'done', say: s.doneSay || 'Beres! Selanjutnya mau apa?', saved: s.noteTitle ? { title: s.noteTitle } : null, options: t.lanjut.map(([id, label]) => o(`next:${id}`, label, '', id === t.lanjut[0][0])), cards };
    }
    default: return { ...b, kind: 'error', say: 'Ada yang belum berhasil. Mau coba lagi?', options: [o('new', 'Mulai dari awal', '', 1)] };
  }
}

const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'; };
const previewOf = (s, t) => [
  s.input ? { label: 'Permintaanmu', value: clip(s.input, 160) } : null,
  ...Object.entries(s.answers).map(([qid, a]) => ({ label: t.qs.find((q) => q.id === qid)?.brief || qid, value: a.label })),
  s.extra ? { label: 'Tambahan', value: clip(s.extra, 160) } : null,
].filter(Boolean);

// ───────────────────────── kerja nyata (hanya di langkah Kerjakan) ─────────────────────────
const goal = (s) => (s.goalId ? db().tasks.find((x) => x.id === s.goalId) : null);
function briefOf(s) {
  const t = tmplOf(s); const p = t.plans[s.planId];
  const prof = Object.entries(profileOf(s.userId).data).map(([k, v]) => `- ${PROFIL_LABEL[k]}: ${v}`);
  const lines = [
    `Permintaan pengguna: ${s.input || '(dari kartu awal, ikuti profil)'}`,
    s.extra ? `Tambahan: ${s.extra}` : '',
    '', 'Yang sudah diputuskan pengguna (jangan ditanyakan lagi):',
    ...Object.entries(s.answers).map(([qid, a]) => `- ${t.qs.find((q) => q.id === qid)?.brief || qid}: ${a.label}${a.auto && !a.fromProfile ? ' (diserahkan ke Pemandu)' : ''}`),
    `- Bentuk hasil: ${p.give}`,
    prof.length ? `\nYang diketahui tentang pengguna:\n${prof.join('\n')}` : '',
    '\nTulis hasil akhir dalam Bahasa Indonesia sehari-hari, siap dipakai langsung oleh orang awam, tanpa istilah teknis.',
    s.previous ? `\nHasil sebelumnya sebagai bahan:\n${s.previous}` : '',
  ];
  return { title: clip(`${t.label}: ${s.input || s.extra || t.label}`, 120), description: lines.filter((l) => l !== '').join('\n'), priority: s.planId === 'full' ? 'high' : s.planId === 'fast' ? 'low' : 'medium' };
}
function startWork(s) {
  const br = briefOf(s);
  const g = engine.submitGoal({ title: br.title, description: br.description, userId: s.userId, priority: br.priority });
  s.goalId = g.id; s.stage = 'work'; s.startedAt = now(); s.revs = 0;
}
const pendingReview = (g) => db().approvals.find((a) => a.taskId === g.id && a.status === 'pending' && a.kind === 'review');
function progressOf(s, b) {
  const g = goal(s);
  if (!g) return { ...b, kind: 'error', say: 'Ada yang belum berhasil: pekerjaannya tidak ketemu. Mau mulai lagi?', options: [o('new', 'Mulai dari awal', '', 1), o('back', 'Kembali satu langkah')] };
  if (g.status === 'blocked' || g.status === 'cancelled') return { ...b, kind: 'error', say: 'Ada yang belum berhasil. Aku bisa coba lagi dengan cara yang sama, atau kamu ubah permintaannya.', options: [o('redo', 'Coba lagi', '', 1), o('edit', 'Ubah permintaan')] };
  const kids = db().tasks.filter((x) => x.rootId === g.id && x.id !== g.id);
  const done = kids.filter((x) => x.status === 'done').length;
  const active = kids.find((x) => x.status === 'in_progress') || (g.status === 'in_progress' ? g : null);
  const who = emp(active?.assigneeId)?.name;
  const waited = Math.round((now() - (s.startedAt || now())) / 1000);
  const pct = Math.min(92, kids.length ? 8 + Math.round((done / kids.length) * 80) : 6 + Math.min(70, waited * 2));
  return { ...b, kind: 'progress', say: who ? `${who} lagi menyiapkan hasilnya. Sebentar ya.` : 'Lagi disiapkan. Sebentar ya.', progress: { pct, text: kids.length ? `${done} dari ${kids.length} bagian selesai` : 'Mulai dikerjakan' }, options: [o('cancel', 'Hentikan')], undo: false };
}
function resultOf(s) {
  const g = goal(s);
  if (!g) return null;
  const ready = g.status === 'done' || (g.status === 'review' && pendingReview(g));
  if (!ready) return null;
  s.approvalId = pendingReview(g)?.id || null;
  return { title: clip(g.title.replace(/^[^:]+:\s*/, ''), 100), text: g.output || g.summary || '', revision: s.revs, checked: !g.unverified, gaps: g.gaps || '' };
}
function review(s, decision, feedback) {
  const g = goal(s); const a = g && pendingReview(g);
  if (!a) return false;
  engine.decideApproval(a.id, { decision, feedback, userId: s.userId });
  return true;
}
function cancelWork(s) {
  const g = goal(s); if (!g) return;
  for (const t of db().tasks.filter((x) => x.rootId === g.id && !['done', 'cancelled'].includes(x.status))) { t.status = 'cancelled'; store.upsert('tasks', t); }
}

// ───────────────────────── titik sambung: otomasi (server/n8n.js) dan belajar mandiri (server/skills-learn.js) ─────────────────────────
// Kartu tambahan muncul di respons `done` sebagai `cards`: { offer(ctx) -> kartu | null, act(optionId, ctx) -> { say } }. Lihat docs/PEMANDU-TITIK-SAMBUNG.md.
export const CARDS = {};
export const registerCard = (type, card) => { CARDS[type] = card; };
const load = async (file) => { try { return await import(file); } catch { return null; } };
const EVERY = { daily: 1440, weekly: 10080 };

registerCard('learned', {
  // "Aku belajar sesuatu, simpan?": usulan yang menunggu di server/skills-learn.js (pending/decide)
  async offer({ userId }) {
    const m = await load('./skills-learn.js'); const it = m?.pending?.()[0];
    if (!it) return null;
    return { type: 'learned', say: 'Aku belajar sesuatu dari pekerjaan tadi. Simpan?', detail: clip(`${it.kartu.judul}. ${it.kartu.isi}`, 280), ref: it.id, options: [o('setuju', 'Simpan', '', 1), o('tolak', 'Jangan')] };
  },
  async act(optionId, { userId, ref }) {
    const m = await load('./skills-learn.js');
    try { m.decide(ref, { keputusan: optionId === 'setuju' ? 'setuju' : 'tolak', userId }); } catch { return { say: 'Usulan itu sudah diputuskan sebelumnya.' }; }
    return { say: optionId === 'setuju' ? 'Tersimpan. Lain kali aku lebih cepat.' : 'Oke, tidak kusimpan.' };
  },
});

// Otomasi: "Mau aku otomatiskan ini?" -> pilih -> (isian bila perlu) -> pratinjau + uji data contoh -> "Ya, nyalakan"
const safeMsg = (e) => (e?.kind !== undefined && e?.message && kamus.bersih(e.message) ? e.message : 'Otomasi belum bisa dipasang sekarang.');
async function startAuto(s) {
  const n8n = await load('./n8n.js');
  if (!n8n?.propose) { s.auto = { step: 'err', err: 'Mesin otomasi belum tersedia.' }; s.stage = 'auto'; return; }
  try {
    const r = n8n.propose({ text: clip(`${s.input} ${goal(s)?.title || ''}`, 500), userId: s.userId });
    s.auto = { id: r.id, pilihan: r.pilihan, step: 'pick', answers: {}, tanya: [] };
  } catch (e) { s.auto = { step: 'err', err: safeMsg(e) }; }
  s.stage = 'auto';
}
async function prepareAuto(s) {
  const a = s.auto; const n8n = await load('./n8n.js');
  try {
    const r = await n8n.prepare(a.id, { option: a.pick, answers: a.answers, userId: s.userId });
    if (r.status === 'tanya') { a.tanya = r.tanya; a.step = 'ask'; }
    else if (r.status === 'perlu_sambung') { a.step = 'err'; a.err = r.perlu.map((x) => x.pesan).join(' '); }
    else { a.step = 'confirm'; a.pratinjau = r.pratinjau; a.uji = r.uji; a.tanyaOn = r.tanya; }
  } catch (e) { a.step = 'err'; a.err = safeMsg(e); }
}
function scheduleRoutine(s, every = 'daily') {
  const g = goal(s); const pa = db().employees.find((e) => e.isPA && e.ownerId === s.userId) || emp('aria');
  store.upsert('routines', { id: store.uid('r'), employeeId: pa.id, targetType: 'employee', targetId: pa.id, targetTag: '', title: clip(g?.title || 'Pekerjaan terjadwal', 120), description: briefOf(s).description, everyMinutes: EVERY[every], enabled: true, lastRunAt: now() });
}
function renderAuto(s, b) {
  const a = s.auto || { step: 'err', err: '' };
  if (a.step === 'pick') return { ...b, kind: 'choices', say: 'Mau aku otomatiskan ini? Pilih caranya:', options: [...a.pilihan.slice(0, 3).map((p, i) => o(`oto:${p.id}`, p.judul, p.siap ? p.ringkas : `${p.ringkas} Perlu: ${p.perlu[0]}`, i === 0)), o('oto:no', 'Tidak dulu')], undo: false };
  if (a.step === 'ask') {
    const q = a.tanya[0];
    const opts = q.jenis === 'choice' ? (q.pilihan || []).slice(0, 4).map((p) => o(`ans:${p.nilai}`, p.teks)) : [];
    return { ...b, kind: 'choices', say: `${q.label}${q.contoh ? ` Contoh: ${q.contoh}` : ''}`, options: opts, freeText: true, undo: false };
  }
  if (a.step === 'confirm') {
    const rows = [...(a.pratinjau?.langkah || []).map((v) => ({ label: 'Langkah', value: v })), ...(a.pratinjau?.dampak || []).map((v) => ({ label: 'Yang akan terjadi', value: v }))];
    return { ...b, kind: 'confirm', say: `${a.uji?.catatan || ''} ${a.tanyaOn || 'Nyalakan sekarang?'}`.trim(), preview: rows, options: [o('oto:on', 'Ya, nyalakan', '', 1), o('oto:no', 'Jangan dulu')], undo: false };
  }
  return { ...b, kind: 'error', say: `${a.err || 'Otomasi belum bisa dipasang sekarang.'} Mau aku ulangi pekerjaan ini setiap hari saja?`, options: [o('oto:biasa', 'Ya, ulangi setiap hari', '', 1), o('oto:no', 'Tidak dulu')], undo: false };
}
async function autoTurn(s, cid, text) {
  const a = s.auto || {};
  const finish = (say) => { s.stage = 'done'; s.doneSay = say; s.auto = null; };
  if (cid === 'oto:no') { const n8n = await load('./n8n.js'); if (a.id && n8n?.remove) await n8n.remove(a.id).catch(() => {}); return finish('Oke, tidak dijadwalkan dulu. Selanjutnya mau apa?'); }
  if (cid === 'oto:biasa') { scheduleRoutine(s); return finish('Sudah dijadwalkan setiap hari. Aku kabari kalau ada yang perlu kamu lihat.'); }
  if (a.step === 'pick' && cid.startsWith('oto:opsi')) { a.pick = cid.slice(4); await prepareAuto(s); return; }
  if (a.step === 'ask' && (cid.startsWith('ans:') || text)) { a.answers[a.tanya[0].kunci] = cid.startsWith('ans:') ? cid.slice(4) : text; a.tanya.shift(); if (!a.tanya.length) await prepareAuto(s); return; }
  if (a.step === 'confirm' && cid === 'oto:on') {
    const n8n = await load('./n8n.js');
    try { await n8n.activate(a.id); return finish('Sudah jalan. Aku akan kabari kalau ada yang bermasalah. Selanjutnya mau apa?'); } catch (e) { a.step = 'err'; a.err = safeMsg(e); }
  }
}

// ───────────────────────── satu giliran ─────────────────────────
function pickPlanOrOption(s, choiceId) {
  const t = tmplOf(s);
  const q = t.qs.find((x) => x.id === s.qs[s.qi]);
  return { q, opt: q?.opts.find((x) => x.id === choiceId) };
}

function answer(s, q, opt, { auto = false, text = null } = {}) {
  const chosen = opt || q.opts.find((x) => x.recommended) || q.opts[0];
  s.answers[q.id] = { id: text ? 'ketik' : chosen.id, label: text ? clip(text, 160) : chosen.label, auto };
  const learnVal = !auto && !text && tmplOf(s).qs.find((x) => x.id === q.id)?.learn?.[chosen.id];
  if (learnVal && q.profileKey) {
    const p = profileOf(s.userId);
    if (p.data[q.profileKey] !== learnVal) { setProfile(s.userId, { [q.profileKey]: learnVal }); s.learned = { key: q.profileKey, label: PROFIL_LABEL[q.profileKey], value: learnVal, text: `Aku catat: ${PROFIL_LABEL[q.profileKey].toLowerCase()} ${learnVal}. Betul?` }; }
  }
  s.qi += 1;
  if (s.qi >= s.qs.length) s.stage = 'plan';
  s.awaiting = null;
}

const FEED = { singkat: 'Buat versi yang lebih singkat, intinya saja.', santai: 'Buat versi yang lebih santai dan akrab.', resmi: 'Buat versi yang lebih resmi dan sopan.', lengkap: 'Buat versi yang lebih lengkap dan rinci.' };

export async function turn({ userId, sessionId, input, choiceId, canAutomate = true }) {
  const s = getSession(userId, sessionId);
  s.updatedAt = now();
  const text = clip(input, 2000);
  try {
    // keamanan bawaan untuk semua pengguna
    const bad = text && AMAN.find((x) => x.re.test(text));
    if (bad) return { ...base(s), kind: 'error', say: bad.say, options: [o('new', 'Bantu aku hal lain', '', 1)] };

    const cid = choiceId || '';
    if (cid === 'back') { goBack(s); return await render(s); }
    if (cid === 'new') { reset(s); return await render(s); }
    const live = ['poll', 'resume'].includes(cid.split(':')[0]);
    if (!live && (cid || text)) snapshot(s);
    if (s.history.length > 12) s.history.shift();
    if (cid === 'poll' || cid.startsWith('resume')) { if (cid.startsWith('resume')) { const prev = state().sessions[key(userId, cid.split(':')[1])]; if (prev) return await render(prev); } return await render(s); }
    if (cid === 'cancel') { cancelWork(s); reset(s); s.notes.push('Sudah kuhentikan.'); return await render(s); }
    if (cid === 'edit') { s.stage = pickQuestionsFresh(s); return await render(s); }
    if (cid.startsWith('card:')) {
      const [, type, opt] = cid.split(':'); const card = CARDS[type];
      if (!card) return await render(s);
      const r = await card.act(opt, { session: s, userId, ref: input });
      s.doneSay = r?.say || s.doneSay;
      return await render(s);
    }

    // 1. awal
    if (s.stage === 'start') {
      if (cid.startsWith('intent:')) { s.intent = cid.slice(7); s.stage = 'topic'; if (!INTENTS[s.intent]) { reset(s); return await render(s); } if (INTENTS[s.intent].needsText) s.needInput = true; return await render(s); }
      if (!text) return await render(s);
      if (SAPAAN.test(text)) return await render(s);
      s.input = text;
      s.intent = detectIntent(text);
      if (!s.intent) {
        const l1t = await l1Template(text);
        s.intent = 'umum'; s.l1 = l1t || null;
        if (l1t) s.notes.push('Aku coba pahami dulu maksudmu.');
      }
      if (INTENTS[s.intent]?.needsText && text.length < 140 && !/\n/.test(text)) { s.stage = 'topic'; s.needInput = true; return await render(s); }
      enterAfterCapture(s); return await render(s);
    }
    if (s.stage === 'topic') {
      if (cid === 'delegate' || cid === 'topic:usaha') s.input = profileOf(userId).data.nama ? `tentang ${profileOf(userId).data.nama}` : '(ikuti profil, pilihkan topiknya)';
      else if (text) s.input = text; else return await render(s);
      enterAfterCapture(s); return await render(s);
    }
    // 2. pertanyaan
    if (s.stage === 'ask') {
      const { q, opt } = pickPlanOrOption(s, cid);
      if (cid === 'delegate') answer(s, q, null, { auto: true });
      else if (cid === 'other') { s.awaiting = 'other'; }
      else if (opt) answer(s, q, opt);
      else if (text) answer(s, q, null, { text });
      else s.notes.push('Pilihan itu sudah lewat. Ini yang sekarang:');
      return await render(s);
    }
    // 3. rencana
    if (s.stage === 'plan') {
      if (cid.startsWith('plan:') && tmplOf(s).plans[cid.slice(5)]) { s.planId = cid.slice(5); s.stage = 'confirm'; return await render(s); }
      if (cid === 'delegate') { s.planId = quota().pct < 25 ? 'fast' : 'balanced'; s.stage = 'confirm'; return await render(s); }
      if (text) { s.extra = clip(`${s.extra} ${text}`, 400); s.notes.push('Aku catat tambahannya. Pilih rencananya:'); }
      return await render(s);
    }
    // 4. konfirmasi lalu kerjakan
    if (s.stage === 'confirm') {
      if (cid === 'start') { startWork(s); return await render(s); }
      if (text) { s.extra = clip(`${s.extra} ${text}`, 400); s.notes.push('Sudah kutambahkan.'); }
      return await render(s);
    }
    // 5. sedang dikerjakan
    if (s.stage === 'work') {
      if (cid === 'redo') { const g = goal(s); if (g) { Object.assign(g, { status: 'todo', failures: 0 }); store.upsert('tasks', g); s.startedAt = now(); } }
      return await render(s);
    }
    // 6. hasil
    if (s.stage === 'result') {
      if (cid === 'use' || cid === 'save') {
        const g = goal(s); const r = resultOf(s);
        review(s, 'approve', '');
        s.noteTitle = db().notes.find((n) => n.id === g?.noteId)?.title || null;
        s.stage = 'done'; s.doneSay = cid === 'save' ? 'Sudah tersimpan di Catatan. Selanjutnya mau apa?' : 'Sip, hasilnya sudah kamu pakai. Selanjutnya mau apa?';
        s.previous = clip(r?.text, 700);
        const out = await render(s); return cid === 'use' ? { ...out, copy: r?.text || '' } : out;
      }
      if (cid === 'tweak') { s.stage = 'tweak'; s.awaiting = null; return await render(s); }
      if (cid === 'redo') { revise(s, 'Ulangi dari awal dengan pendekatan yang berbeda dan hasil yang lebih baik.'); return await render(s); }
      if (text) { revise(s, text); return await render(s); }
      return await render(s);
    }
    if (s.stage === 'tweak') {
      if (cid === 'other') { s.awaiting = 'other'; return await render(s); }
      const f = cid.startsWith('tw:') ? FEED[cid.slice(3)] : text;
      if (f) { revise(s, f); return await render(s); }
      return await render(s);
    }
    // 6b. otomasi
    if (s.stage === 'auto') { await autoTurn(s, cid, text); return await render(s); }
    // 7. selesai: langkah lanjut
    if (s.stage === 'done') {
      if (cid.startsWith('next:')) {
        const id = cid.slice(5); const row = tmplOf(s).lanjut.find((x) => x[0] === id);
        if (!row || id === 'selesai') { reset(s); s.notes.push('Sampai jumpa! Kalau butuh sesuatu lagi, aku di sini.'); return await render(s); }
        if (id === 'jadwal') {
          if (!canAutomate) { s.notes.push('Hanya pemilik ruang kerja yang boleh memasang otomasi.'); return await render(s); }
          await startAuto(s); return await render(s);
        }
        const { previous, answers, intent, l1 } = s; const same = !row[3] || row[3] === intent;
        reset(s);
        Object.assign(s, { intent: row[3] || intent, input: row[2] || row[1], previous, answers: same ? answers : {}, l1: same ? l1 : null, qs: [], stage: 'plan' });
        return await render(s);
      }
      if (text) { reset(s); return await turn({ userId, sessionId: s.id, input: text }); }
      return await render(s);
    }
    return await render(s);
  } catch (err) {
    console.warn('[pemandu] giliran gagal:', err.message);
    return { ...base(s), kind: 'error', say: 'Ada yang belum berhasil. Kamu bisa coba lagi, atau mulai dari awal.', options: [o('poll', 'Coba lagi', '', 1), o('new', 'Mulai dari awal')] };
  } finally { store.save(); }
}
function pickQuestionsFresh(s) { s.answers = {}; s.notes = []; pickQuestions(s); return s.qs.length ? 'ask' : 'plan'; }
function revise(s, feedback) {
  const revs = s.revs + 1;
  if (review(s, 'reject', feedback)) { s.stage = 'work'; s.startedAt = now(); }
  else { const g = goal(s); s.previous = clip(g?.output || g?.summary, 700); s.extra = clip(`${s.extra} ${feedback}`, 400); startWork(s); }   // hasil sudah selesai tanpa konfirmasi: mulai pekerjaan baru dari hasil tadi
  s.revs = revs; s.awaiting = null;
}

// ───────────────────────── beranda ─────────────────────────
export function home(userId) {
  const sessions = Object.values(state().sessions).filter((x) => x.userId === userId && ['work', 'result', 'tweak'].includes(x.stage) && now() - x.updatedAt < 2 * 864e5).sort((a, b) => b.updatedAt - a.updatedAt);
  const last = sessions[0];
  const nm = userName(userId);
  const profile = profileView(userId);
  return {
    say: `${greeting()}${nm ? ', ' + nm : ''}!`,
    sub: 'Aku Pemandu. Ceritakan yang kamu butuhkan, atau ketuk salah satu pilihan.',
    cards: [...(last ? [{ id: `resume:${last.id}`, label: 'Lanjutkan yang tadi', hint: (last.input || '(').startsWith('(') ? tmplOf(last).label : clip(last.input, 60), ikon: 'clock' }] : []), ...KARTU_AWAL.map((id) => ({ id: `intent:${id}`, label: INTENTS[id].kartu, ikon: INTENTS[id].ikon }))],
    profile, onboarding: !profile.known && !profile.skipped, quota: quota(),
  };
}
export function skipOnboarding(userId) { profileOf(userId).skipped = true; store.save(); return { ok: true }; }

// ───────────────────────── rute ─────────────────────────
const who = (b) => b.userId || db().settings.currentUserId;
export const routes = [
  ['POST', '/api/pemandu/turn', (b) => turn({ userId: who(b), sessionId: b.sessionId, input: b.input, choiceId: b.choiceId, canAutomate: b.canAutomate !== false })],
  ['GET', '/api/pemandu/home', (b) => home(who(b))],
  ['POST', '/api/pemandu/onboard', (b) => (b.skip ? skipOnboarding(who(b)) : onboard(who(b), b.input))],
  ['GET', '/api/pemandu/profile', (b) => profileView(who(b))],
  ['PUT', '/api/pemandu/profile', (b) => setProfile(who(b), b.items || {}, { replace: !!b.replace })],
];
