// Router obrolan: mengerti siapa yang dimaksud pengguna dari bahasa biasa, tanpa sintaks apa pun.
// Nama salah eja, panggilan, peran ("bagian keuangan", "si desainer"), dan topik ("strategi promosi") diselesaikan dengan pencocokan kabur.
// Bila ambigu, hasilnya meminta satu pertanyaan pilihan; tidak pernah menolak. Modul ini murni (tanpa model, tanpa token).

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

/** jarak sunting dua kata (kecil, cukup untuk salah ketik) */
export function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // dua huruf tertukar dihitung satu salah ketik
    }
  }
  return d[a.length][b.length];
}

const STOP = new Set(('yang dan di ke dari untuk dengan ini itu ada apa siapa bisa tolong minta mohon tim bagian divisi departemen dept cek tanya ajak panggil supaya agar sama saya aku kamu kita kami kalian gimana bagaimana kapan dimana mana apakah atau juga lagi sudah belum akan harus perlu mau ingin yg dg utk hari minggu bulan depan ini tadi nanti dulu saja aja dong deh ya kok sih lah si pak bu mas mbak kak bantu bantuin buat buatkan bikin lihat liat kasih beri tentang soal masalah hal cara paham ahli jago pandai urus mengurus ngurus pegang').split(' '));

/** sinonim sehari-hari -> id divisi (nama divisi di data berbahasa Inggris; pengguna berbicara Indonesia) */
export const DIV_TERMS = {
  exec: ['eksekutif', 'direksi', 'pimpinan', 'strategi perusahaan', 'arah perusahaan'],
  mkt: ['marketing', 'pemasaran', 'promosi', 'iklan', 'kampanye', 'campaign', 'branding', 'brand', 'sosmed', 'media sosial', 'seo'],
  sales: ['sales', 'penjualan', 'jualan', 'prospek', 'closing', 'negosiasi harga'],
  eng: ['teknologi', 'engineering', 'aplikasi', 'pemrograman', 'developer', 'programmer', 'coding', 'kode', 'software', 'fitur produk'],
  design: ['desain', 'desainer', 'design', 'designer', 'visual', 'logo', 'tampilan', 'ux', 'kreatif'],
  cs: ['pelanggan', 'layanan pelanggan', 'customer', 'komplain', 'keluhan', 'bantuan pelanggan', 'retensi'],
  fin: ['keuangan', 'finansial', 'finance', 'anggaran', 'budget', 'pajak', 'akuntan', 'akuntansi', 'laporan keuangan', 'arus kas', 'cashflow', 'biaya', 'pembukuan', 'invoice', 'tagihan'],
  hr: ['sdm', 'hr', 'karyawan', 'rekrutmen', 'merekrut', 'lowongan', 'gaji', 'cuti', 'budaya kerja', 'people'],
  ops: ['operasional', 'operasi', 'proses bisnis', 'sop', 'vendor', 'efisiensi'],
  legal: ['hukum', 'legal', 'kontrak', 'perjanjian', 'izin usaha', 'kepatuhan', 'hak cipta', 'merek dagang', 'privasi'],
  it: ['it', 'keamanan sistem', 'jaringan', 'server', 'akses', 'keamanan data', 'infrastruktur'],
  data: ['data', 'riset pasar', 'analisis', 'analis', 'statistik', 'laporan data', 'dashboard', 'kpi'],
  rnd: ['formula', 'formulasi', 'riset bahan', 'inovasi produk', 'skincare', 'kimia'],
  mfg: ['produksi', 'pabrik', 'manufaktur', 'cpkb', 'batch produksi'],
  qa: ['mutu', 'kualitas', 'quality', 'audit mutu', 'capa'],
  reg: ['regulasi', 'bpom', 'notifikasi produk', 'perizinan produk'],
  scm: ['gudang', 'stok', 'pasokan', 'supply chain', 'pemasok', 'logistik', 'pengadaan'],
  ecom: ['marketplace', 'toko online', 'e commerce', 'ecommerce', 'shopee', 'tokopedia', 'lazada'],
  kms: ['catatan perusahaan', 'pengetahuan', 'dokumentasi', 'arsip'],
  studio: ['konten', 'foto', 'video', 'live', 'naskah', 'produksi konten', 'editor'],
  bizdev: ['kemitraan', 'partner', 'mitra', 'kolaborasi', 'bisnis baru', 'ekspansi'],
  retail: ['retail', 'toko offline', 'counter', 'gerai', 'toko fisik'],
};

const TEAM_RE = /\b(tim|bagian|divisi|departemen|dept|orang)\b/;
export const MEETING_RE = /\b(rapat|rapat singkat|meeting|diskusi(?:kan)?|bahas bersama|brainstorm|pendapat (?:tim|kalian|semua)|rembuk|musyawarah)\b/;
const WHO_RE = /\b(siapa (?:yang )?(?:bisa|paham|ahli|jago|pegang|ngurus|mengurus|cocok|tepat)|siapa saja yang|orang yang (?:paham|bisa|ahli))\b/;

function divisionTerms(d) {
  const t = new Set([...(DIV_TERMS[d.id] || []).map(norm), ...words(d.name), norm(d.short)]);
  t.delete('');
  return [...t].filter((x) => x && !STOP.has(x) && x !== 'and');
}
const has = (text, term) => (term.includes(' ') ? ` ${text} `.includes(` ${term} `) : false);

/** skor tiap divisi terhadap teks: sinonim/nama = 3, kata kunci keahlian pimpinan = 2, kata misi = 1 */
export function scoreDivisions(text, { divisions, employees }) {
  const t = norm(text); const tokens = new Set(words(t).filter((w) => !STOP.has(w)));
  const out = [];
  for (const d of divisions) {
    let score = 0; const hits = [];
    for (const term of divisionTerms(d)) {
      const hit = term.includes(' ') ? has(t, term) : [...tokens].some((w) => w === term || (w.length >= 6 && term.length >= 6 && lev(w, term) <= 1));
      if (hit) { score += 3; hits.push(term); }
    }
    const lead = employees.find((e) => e.id === d.leadId);
    for (const k of [...(lead?.skills || []), ...words(d.mission || '').filter((w) => w.length >= 6)]) {
      const kk = norm(k); if (!kk || STOP.has(kk)) continue;
      const hit = kk.includes(' ') ? has(t, kk) : tokens.has(kk);
      if (hit) { score += kk === norm(k) && (lead?.skills || []).map(norm).includes(kk) ? 2 : 1; hits.push(kk); }
    }
    if (score) out.push({ division: d, score, hits });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** kecocokan nama depan: persis, awalan, atau salah ketik kecil. Nama 4 huruf harus persis agar "hari" tidak menjadi "Hadi". */
function nameMatch(token, first) {
  if (token === first) return 10;
  if (token.length >= 5 && first.length >= 5 && lev(token, first) <= 1) return 7;
  if (token.length >= 7 && first.length >= 7 && lev(token, first) <= 2) return 5;
  return 0;
}

/** sapaan dan kata ganti orang kedua: "halo reno", "kamu reno ya" berarti pengguna berbicara KEPADA orang itu */
const SAPA = new Set(['pagi', 'siang', 'sore', 'malam', 'halo', 'hai', 'hi', 'hello', 'hey', 'hei', 'oi', 'woi', 'eh', 'kamu', 'anda', 'engkau', 'kau', 'selamat', 'terima', 'makasih', 'thanks']);
const ORANG2 = new Set(['kamu', 'anda', 'engkau', 'kau', 'kmu', 'km', 'kamoe']);
const ALAMAT = new Set(['tanya', 'tanyakan', 'minta', 'ajak', 'panggil', 'hubungi', 'bilang', 'kasih', 'beri', 'ke', 'sama', 'dengan', 'si', 'pak', 'bu', 'ibu', 'bapak', 'mas', 'mbak', 'kak', 'cek', 'suruh', 'libatkan', 'undang', 'tambahkan', 'bareng', 'bersama', 'dari', 'menurut', 'kata']);
/** nama orang yang disebut. Kata biasa yang kebetulan sama dengan nama ("itu bagus") tidak dihitung: butuh petunjuk menyapa
 *  (tanya X, pak X, "X," di awal), huruf kapital di tengah kalimat, atau nama panjang yang persis. */
export function nameHits(text, employees) {
  const raw = String(text);
  const toks = [...raw.matchAll(/[\p{L}\p{N}]+/gu)].map((m, i, all) => ({
    tk: norm(m[0]), cap: /^\p{Lu}/u.test(m[0]), pos: i, at: m.index > 0 && raw[m.index - 1] === '@', prev: i > 0 ? norm(all[i - 1][0]) : '', next: i + 1 < all.length ? norm(all[i + 1][0]) : '', after: raw.slice(m.index + m[0].length, m.index + m[0].length + 2),
  })).filter((t) => t.tk.length >= 3 && !STOP.has(t.tk));
  const byId = new Map();
  for (const e of employees) {
    const first = words(e.name)[0]; if (!first || first.length < 3) continue;
    const full = norm(e.name);
    if (full.includes(' ') && ` ${norm(raw)} `.includes(` ${full} `)) { byId.set(e.id, 10); continue; }
    for (const t of toks) {
      let sc = nameMatch(t.tk, first);
      // nama pendek yang salah eja ("renoo") hanya dikenali bila jelas disapa
      if (sc < 5 && t.tk.length >= 4 && first.length >= 4 && lev(t.tk, first) <= 1 && (t.at || ALAMAT.has(t.prev) || SAPA.has(t.prev) || (t.pos === 0 && (ORANG2.has(t.next) || /^\s*[,:?!]/.test(t.after))))) sc = 6;
      if (sc < 5) continue;
      // sapaan dan kata ganti orang kedua ("halo reno", "kamu reno ya", "reno kamu bisa apa", "reno, ...") berarti pengguna bicara KEPADA orang itu; kata biasa yang mirip nama ("itu bagus") tidak cukup
      const cue = t.at || ALAMAT.has(t.prev) || SAPA.has(t.prev) || (t.cap && t.pos > 0) || (t.pos === 0 && /^\s*[,:?!]/.test(t.after)) || (t.pos === 0 && ORANG2.has(t.next)) || (sc === 10 && first.length >= 6);
      if (cue) byId.set(e.id, Math.max(byId.get(e.id) || 0, sc));
    }
  }
  return [...byId].map(([id, score]) => ({ e: employees.find((x) => x.id === id), score }));
}

const label = (e, divs) => `${e.name} (${divs.find((d) => d.id === e.divisionId)?.name || e.title})`;

/** staf yang cocok dengan teks dalam satu divisi (untuk "tim X": pimpinan + 1-2 staf) */
function staffFor(division, text, employees, limit) {
  const t = new Set(words(text));
  return employees.filter((e) => e.divisionId === division.id && !e.isLead && !e.isPA && !e.isMaster && e.status !== 'offline')
    .map((e) => ({ e, s: [...(e.skills || []), e.title].flatMap(words).filter((w) => w.length >= 4 && t.has(w)).length }))
    .sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.e);
}

/**
 * Putuskan siapa yang dilibatkan.
 * @returns {{kind:'none'|'agents'|'ambiguous'|'siapa', agents:string[], meeting:boolean, why:string[], options?:{id,label}[], candidates?:object[]}}
 */
export function route(text, { employees, divisions }, { max = 3 } = {}) {
  const ai = employees.filter((e) => e.type === 'ai' && !e.isPA && !e.isMaster);
  const t = norm(text);
  const meeting = MEETING_RE.test(t);
  const team = TEAM_RE.test(t);
  // 1. nama orang (salah eja, panggilan depan)
  const names = nameHits(text, ai);
  if (names.length) {
    const top = Math.max(...names.map((n) => n.score));
    const best = names.filter((n) => n.score === top).map((n) => n.e);
    // nama depan yang sama dipakai beberapa orang: pimpinan menang bila hanya satu; jika tidak, tanya sekali
    const firsts = new Map();
    for (const e of best) { const f = words(e.name)[0]; (firsts.get(f) || firsts.set(f, []).get(f)).push(e); }
    const picks = []; const amb = [];
    for (const group of firsts.values()) {
      const leads = group.filter((e) => e.isLead);
      if (group.length === 1) picks.push(group[0]); else if (leads.length === 1) picks.push(leads[0]); else amb.push(...group);
    }
    if (amb.length) return { kind: 'ambiguous', agents: picks.map((e) => e.id), meeting, why: [], options: amb.slice(0, 3).map((e) => ({ id: e.id, label: label(e, divisions) })) };
    if (team) {   // "tim keuangan dan Ratih ...": nama DAN tim disebut sekaligus, jadi pimpinan tim itu ikut
      const top = scoreDivisions(text, { divisions, employees })[0];
      const lead = top && employees.find((e) => e.id === top.division.leadId);
      if (lead && !picks.some((e) => e.id === lead.id)) picks.unshift(lead);
    }
    return { kind: 'agents', agents: picks.slice(0, max).map((e) => e.id), meeting: meeting || picks.length > 1, why: picks.map((e) => label(e, divisions)) };
  }
  // 2. "siapa yang bisa ...": daftar kandidat, bukan memanggil siapa pun
  const divScores = scoreDivisions(text, { divisions, employees });
  if (WHO_RE.test(t)) {
    const cands = divScores.slice(0, 3).map((x) => employees.find((e) => e.id === x.division.leadId)).filter(Boolean);
    return { kind: 'siapa', agents: cands.map((e) => e.id), meeting: false, why: cands.map((e) => label(e, divisions)), candidates: cands };
  }
  // 3. peran, divisi, atau topik
  if (!divScores.length) return { kind: 'none', agents: [], meeting, why: [] };
  const [a, b] = divScores;
  const explicit = team || a.hits.some((h) => (DIV_TERMS[a.division.id] || []).map(norm).includes(h));   // disebut sebagai tim/bagian atau lewat kata divisinya
  const strong = a.score >= 3 && (!b || a.score >= b.score * 1.5);
  const close = b && b.score >= 3 && a.score < b.score * 1.5;
  if (close && explicit) {   // dua bidang sama kuat: libatkan keduanya bila rapat, kalau tidak tanya sekali
    const leads = [a, b].map((x) => employees.find((e) => e.id === x.division.leadId)).filter(Boolean);
    if (meeting) return { kind: 'agents', agents: leads.map((e) => e.id), meeting: true, why: leads.map((e) => label(e, divisions)) };
    return { kind: 'ambiguous', agents: [], meeting, why: [], options: leads.slice(0, 3).map((e) => ({ id: e.id, label: label(e, divisions) })) };
  }
  if (!strong || (!explicit && a.score < 3)) return { kind: 'none', agents: [], meeting, why: [] };
  const lead = employees.find((e) => e.id === a.division.leadId);
  if (!lead || lead.status === 'offline') { const alt = staffFor(a.division, text, employees, 1)[0]; if (!alt) return { kind: 'none', agents: [], meeting, why: [] }; return { kind: 'agents', agents: [alt.id], meeting: false, why: [label(alt, divisions)], notes: lead ? [`${lead.name} sedang tidak aktif, jadi aku minta ${alt.name}.`] : [] }; }
  const crew = [lead, ...(team || meeting ? staffFor(a.division, text, employees, 2) : [])].slice(0, max);
  return { kind: 'agents', agents: crew.map((e) => e.id), meeting: meeting || crew.length > 1, why: crew.map((e) => label(e, divisions)), topicOnly: !explicit };
}

/** saran "@" yang bisa dicari lewat nama, peran, atau divisi dalam bahasa biasa ("keu" -> Hendra, Finance) */
export function suggest(q, { employees, divisions }, limit = 8) {
  const needle = norm(q); if (!needle) return [];
  const ai = employees.filter((e) => e.type === 'ai' && !e.isPA);   // aray (koordinator) ikut daftar "@"; Sora (asisten pribadi) bukan tujuan yang dicari
  const divHit = new Set(divisions.filter((d) => divisionTerms(d).some((t) => t.startsWith(needle) || (needle.length >= 4 && lev(t.slice(0, needle.length), needle) <= 1))).map((d) => d.id));
  return ai.map((e) => {
    const first = words(e.name)[0] || ''; let s = 0;
    if (first === needle) s = 10; else if (first.startsWith(needle)) s = 8; else if (needle.length >= 4 && lev(first, needle) <= 1) s = 6;
    if (e.isMaster && ['koordinator', 'koordinasi', 'master', 'orkestrator'].some((k) => k.startsWith(needle))) s = Math.max(s, 6);
    if (words(e.title).some((w) => w.startsWith(needle))) s = Math.max(s, 5);
    if (divHit.has(e.divisionId)) s = Math.max(s, e.isLead ? 7 : 4);
    if ((e.skills || []).some((k) => norm(k).includes(needle))) s = Math.max(s, 3);
    return { e, s };
  }).filter((x) => x.s > 0).sort((x, y) => y.s - x.s || Number(!!y.e.isLead) - Number(!!x.e.isLead)).slice(0, limit)
    .map(({ e }) => ({ id: e.id, nama: e.name, peran: e.isMaster ? 'Koordinator lintas divisi' : e.title, divisi: divisions.find((d) => d.id === e.divisionId)?.name || '', ...(e.isMaster ? { koordinator: true } : {}) }));
}
