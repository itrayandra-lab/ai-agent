// Agent voices (text-to-speech), Indonesian. Opt-in and OFF by default; nothing is downloaded.
// Engine: the browser's built-in Web Speech API (voice id-ID). Synthesis runs inside the browser's speech service, outside the page's
// main thread, so the 3D office is not blocked. One voice at a time; if messages pile up, the oldest queued ones are dropped.
// Voices: every agent gets a deterministic profile from its id (preset voice x pitch x speed), so hundreds of agents sound different
// without hundreds of models. Pure helpers (cleanText, terbilang, profileFor) have no DOM dependency and are unit tested.

const NUM = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
/** Indonesian number to words (integers up to 999 trillion). */
export function terbilang(n) {
  n = Math.floor(Math.abs(Number(n)) || 0);
  if (n < 12) return NUM[n];
  if (n < 20) return NUM[n - 10] + ' belas';
  if (n < 100) return NUM[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + NUM[n % 10] : '');
  if (n < 200) return 'seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 1000) return NUM[Math.floor(n / 100)] + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  const units = [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']];
  for (const [u, w] of units) if (n >= u) { const q = Math.floor(n / u), r = n % u; return terbilang(q) + ' ' + w + (r ? ' ' + terbilang(r) : ''); }
  return String(n);
}

const ABBR = { yg: 'yang', dgn: 'dengan', utk: 'untuk', krn: 'karena', tdk: 'tidak', gak: 'tidak', ga: 'tidak', jg: 'juga', sdh: 'sudah', blm: 'belum', tgl: 'tanggal', dll: 'dan lain-lain', dsb: 'dan seterusnya', spt: 'seperti', sy: 'saya', pd: 'pada', dr: 'dari', hrs: 'harus', bs: 'bisa', klo: 'kalau', kl: 'kalau', msh: 'masih', 'no.': 'nomor', 'min.': 'minimal', 'maks.': 'maksimal', 'mis.': 'misalnya' };
const ACR = { AI: 'ei ai', CEO: 'si i o', CTO: 'si ti o', CFO: 'si ef o', COO: 'si o o', KPI: 'ka pi ai', SOP: 'es o pi', ROI: 'ar o ai', API: 'ei pi ai', UI: 'yu ai', UX: 'yu eks', PT: 'pe te', CV: 'se fi', HR: 'eich ar', IT: 'ai ti', OK: 'oke', TTS: 'ti ti es', PDF: 'pe de ef', URL: 'u ar el', ID: 'ai di', QA: 'kyu ei', PR: 'pi ar', B2B: 'bi tu bi', SEO: 'es i o', CRM: 'si ar em', ERP: 'i ar pi', USD: 'dolar', IDR: 'rupiah' };

// Capitalised words: short acronyms are spelled letter by letter (BPOM, KTP, ATM); longer or word-like ones (PHYTOSYNC, NASA) are read as ordinary words.
const LETTER = { a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'ef', g: 'ge', h: 'ha', i: 'i', j: 'je', k: 'ka', l: 'el', m: 'em', n: 'en', o: 'o', p: 'pe', q: 'ki', r: 'er', s: 'es', t: 'te', u: 'u', v: 've', w: 'we', x: 'eks', y: 'ye', z: 'zet' };
const SPELLED = new Set('BPOM CPKB UMKM NPWP KTP ATM BRI BCA BNI BTN OJK PLN BUMN NIK SIM KK RT RW PPN PPH BPJS KUR NPD PPIC QC QA RND HRD WFH WFO PIC OKR MVP SaaS'.toUpperCase().split(' '));
// Hidden list (not a setting): brand/product names and how to say them. Anything not listed is read as an ordinary capitalised word.
const BRANDS = { phytosync: 'Fitosink' };
const spell = (w) => [...w.toLowerCase()].map((c) => LETTER[c] || c).join(' ');
const capWord = (w) => {
  if (ACR[w] !== undefined) return ACR[w];
  const low = w.toLowerCase(); if (BRANDS[low]) return BRANDS[low];
  if (SPELLED.has(w) || w.length <= 3) return spell(w);
  const vowels = (w.match(/[AEIOU]/g) || []).length;
  if (vowels === 0 || (w.length === 4 && vowels === 1)) return spell(w);
  return w[0] + low.slice(1);
};
/** Add product/brand names (from the company data) so they are read as words; pass names, optionally with a respelling. */
export function learnBrands(list) { for (const x of list || []) { const [n, say] = Array.isArray(x) ? x : [x, '']; const k = String(n || '').toLowerCase().replace(/[^a-z]/g, ''); if (k.length >= 4 && !BRANDS[k]) BRANDS[k] = say || k[0].toUpperCase() + k.slice(1); } }
/** Strip markdown, links, emoji and code; read numbers and abbreviations naturally. */
export function cleanText(src, max = 420) {
  let t = String(src ?? '');
  t = t.replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, '$1');
  t = t.replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_, a, b) => b || a);
  t = t.replace(TAG_RE, ' ').replace(/\[[a-z][a-z ,'-]{2,30}\](?!\()/gi, ' ');   /* audio tags such as [excited] steer the delivery, they are never read aloud */
  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, ' tautan ').replace(/\S+@\S+\.\S+/g, ' alamat surel ');
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '').replace(/^\s*>\s?/gm, '').replace(/\|/g, ' ').replace(/^[-=_]{3,}$/gm, ' ');
  t = t.replace(/(\*\*|__|\*|_|~~)/g, '').replace(/<[^>]+>/g, ' ');
  t = t.replace(/\p{Extended_Pictographic}|[‍️⃣]/gu, ' ');
  t = t.replace(/\bjam\s+(?=\d{1,2}[:.]\d{2})/gi, '');
  t = t.replace(/(?:^|\s)[@#][\w-]+/g, (m) => ' ' + m.trim().slice(1).replace(/[-_]/g, ' '));
  t = t.replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?!\s?%)/g, (_, h, m) => 'pukul ' + terbilang(h) + (+m ? ' lewat ' + terbilang(m) : ''));
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m, y) => terbilang(d) + ' ' + (['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][+m] || '') + ' ' + terbilang(y));
  // money, percent, decimals, thousands
  t = t.replace(/Rp\.?\s?(\d[\d.]*)(?:,(\d+))?/gi, (_, a) => terbilang(a.replace(/\./g, '')) + ' rupiah');
  t = t.replace(/\$\s?(\d[\d,]*)/g, (_, a) => terbilang(a.replace(/,/g, '')) + ' dolar');
  t = t.replace(/(\d+)[.,](\d+)\s?%/g, (_, a, b) => terbilang(a) + ' koma ' + [...b].map((d) => NUM[+d]).join(' ') + ' persen').replace(/(\d+)\s?%/g, (_, a) => terbilang(a) + ' persen');
  t = t.replace(/(\d{1,3}(?:\.\d{3})+)(?!\d)/g, (m) => terbilang(m.replace(/\./g, '')));
  t = t.replace(/(\d+),(\d+)/g, (_, a, b) => terbilang(a) + ' koma ' + [...b].map((d) => NUM[+d]).join(' '));
  t = t.replace(/(\d+)\s?[-–]\s?(\d+)/g, (_, a, b) => terbilang(a) + ' sampai ' + terbilang(b));
  t = t.replace(/\d+/g, (m) => (m.length > 15 ? [...m].map((d) => NUM[+d]).join(' ') : terbilang(m)));
  t = t.replace(/\b[A-Z]{2,}\b/g, capWord);
  t = t.replace(/\b[A-Za-z][A-Za-z0-9]{1,5}\b/g, (w) => (ACR[w] !== undefined ? ACR[w] : ABBR[w.toLowerCase()] !== undefined && w === w.toLowerCase() ? ABBR[w.toLowerCase()] : w));
  t = t.replace(/&/g, ' dan ').replace(/\//g, ' atau ').replace(/[#*_=<>^~\\{}\[\]]/g, ' ').replace(/[:;]+(?=\s|$)/g, '.').replace(/\s*\n+\s*/g, '. ').replace(/\.{3,}/g, '…').replace(/\.{2}/g, '.').replace(/([.!?])\s*\.\s*/g, '$1 ').replace(/\s+/g, ' ').trim();
  if (t.length > max) { const cut = t.slice(0, max), i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! ')); t = (i > max * 0.5 ? cut.slice(0, i + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '.'); }
  return t;
}

const fnv = (s, seed = 2166136261) => { let h = seed >>> 0; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return h >>> 0; };
// ── Gender suara agen, dari NAMA. Kamus nama Indonesia umum + aturan akhiran + daftar eksplisit untuk nama merek/ambigu.
// Hasilnya disimpan sekali di data karyawan sebagai `voiceGender` (server/store.js), tidak menimpa nilai yang sudah ada, dan bisa dikoreksi
// tangan lewat data. Ini medan terpisah dari `appearance.gender` sehingga tidak mengubah bentuk karakter 3D sama sekali.
const FEMALE_NAMES = new Set(('dewi maya sinta kirana laras tania alya mira putri wulan ratna sari intan nisa tiara salsa lintang citra anisa nadia lestari bunga melati zahra rini mega jessica salsabila cindy tasya vina dian rara wening yohana widya gita sekar olivia keisha nayla hana kayla ayu lia karin tari fitri raisa nabila sarah kinanti puspa laksmi ratih nirmala ayunda cahya nara aria sora vira fina finia liora mika lara cleo lumi zara rizka iris cora kara lira diva vero pustaka kreasi tintai chroma dewi fira rina ani ika lisa nur siti ningsih wati yanti sinta bella citra mawar indah dina tika dyah eka ria vera santi susi tuti yuni nina nova novi nita nia anggun amel amanda annisa aisyah fatimah khadijah aminah maryam rosa rani rahma rahayu risa rika ririn desi dena devi dara dinda ellen emma eva elsa elisa erna eni evi febri feni gina gisel hesti hilda inka irma isti jihan juwita kania karina kartika kiki lani larasati lidya lina livia luna mei meli mia mila mimi mirna monika mutiara nanda natasya naura nikita nindi nur nurul oky oktavia pipit prita puput qonita rachel rahmi regina renata rosi ruth sabrina safira salma sandra selvi shinta silvi sofia sonia stefani syifa talita tessa titin ulfa ully utami vania vanessa vivi winda wiwik yasmin yeni yulia yuli zaskia zulfa').split(/\s+/).filter(Boolean));
const MALE_NAMES = new Set(('taufik aray kenzo raka dimas bima yoga rafi fajar arif gilang reza dika hendra yusuf galih adi eko rudi bagas bayu rizky farhan wahyu dodi sigit ilham yudha kevin hadi agus putra bagus reno aldi tegar fikri doni naufal hafiz arsa aksa bram arga satria lukas ardi rendra faisal bowo dafa arman rangga ihsan ega budi surya jaya gunawan dirga bintang elang wira samudra prasetyo gading danu pandu rizal rafin arjuna arya divo mirao rexi vendo kreavo kreo vexo nixo vecto daxio medibot propoai rizai lumo riza rafihr andi andre andrian anton bambang chandra denny dedi deni dwi edi eddy fahmi fauzi firman guntur hari haris heri herman iwan joko kurniawan krisna lutfi mahendra malik muhammad ahmad mochamad nugroho nanda nur oka pratama priyo rama ramadhan ridwan rifki rio rizqi robi rohman rully santoso setiawan slamet sugeng sulistyo supriyadi susanto teguh tri wawan wibowo widodo yanto yogi yoyok zainal zaki alfi alvin angga ardian bagus bernard bobby dani david dennis erik fandi fachri gani hasan imam indra jamal kemal komang made nyoman wayan ketut leo marcel mario nando nico oscar pras rangga ricky rio roni ryan sandi sean taufan thomas toni vicky vino wisnu yoga yoseph').split(/\s+/).filter(Boolean));
const FEM_END = /(wati|yanti|ningsih|sari|rani|ni|ti|tri|tia|nia|ria|lia|sha|ita|ina|isa|ela|ella|elia|ah|iah|yah|ira|ani|una|ika|iya|ola)$/;
const MALE_END = /(to|no|ndo|wan|man|din|dy|ky|ro|nto|ono|nyo|yo|ndra|ldi|di|ang|ar|ir|il|us|an|im|ik|ef|ad|id|ih)$/;
const nameKey = (name) => String(name ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').trim().split(/[^a-z]+/).filter(Boolean)[0] || '';
const nameHash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h ^ (h >>> 15)) >>> 0; };
/** 'female' | 'male' guessed from a first name. */
export function inferGender(name) { return explainGender(name).gender; }
/** Same guess with the reason: source is 'daftar' (known name), 'aturan' (suffix rule) or 'tebakan' (no evidence, stable guess). */
export function explainGender(name) {
  const k = nameKey(name);
  if (FEMALE_NAMES.has(k)) return { gender: 'female', source: 'daftar' };
  if (MALE_NAMES.has(k)) return { gender: 'male', source: 'daftar' };
  for (const n of FEMALE_NAMES) if (n.length >= 4 && k.startsWith(n)) return { gender: 'female', source: 'daftar' };
  for (const n of MALE_NAMES) if (n.length >= 4 && k.startsWith(n)) return { gender: 'male', source: 'daftar' };
  if (FEM_END.test(k) && k.length > 3) return { gender: 'female', source: 'aturan' };
  if (MALE_END.test(k)) return { gender: 'male', source: 'aturan' };
  return { gender: nameHash(k) % 2 ? 'female' : 'male', source: 'tebakan' };
}
/** Voice gender of an agent: the stored `voiceGender` first (editable in the data), otherwise guessed from the name. Never uses appearance. */
export const genderOf = (e) => (e?.voiceGender === 'female' || e?.voiceGender === 'male' ? e.voiceGender : e?.type === 'human' && (e?.appearance?.gender === 'female' || e?.appearance?.gender === 'male') ? e.appearance.gender : inferGender(e?.name || e?.id || ''));


// Pitch/speed grid per gender. Neighbouring steps are far enough apart to hear (about 1.5 semitones / 7 percent speed).
export const BAND = { female: { pitch: [1.08, 1.32], steps: 5 }, male: { pitch: [0.76, 0.96], steps: 5 } };   /* narrow on purpose: extreme pitch or speed makes the built-in voice swallow soft consonants like s */
const RATES = [0.9, 0.95, 1.0, 1.05, 1.1];
/** Deterministic voice profile for an agent. voiceCount = number of id-ID voices the browser offers (1 if unknown). */
export function profileFor(id, gender = 'male', voiceCount = 1) {
  const g = gender === 'female' ? 'female' : 'male', B = BAND[g];
  const h1 = fnv(id), h2 = fnv(id, 0x9e3779b9), h3 = fnv(id, 0x85ebca6b);
  const pStep = h1 % B.steps, rStep = h2 % RATES.length, voice = voiceCount > 1 ? h3 % voiceCount : 0;
  const pitch = +(B.pitch[0] + (B.pitch[1] - B.pitch[0]) * (pStep / (B.steps - 1))).toFixed(3);
  const rate = RATES[rStep];
  const jp = ((fnv(id, 7) % 10000) / 10000 - 0.5) * 0.02, jr = ((fnv(id, 11) % 10000) / 10000 - 0.5) * 0.02;   /* sub-audible spread so no two agents share the exact same numbers */
  const cents = Math.round(((fnv(id, 31) % 5) - 2) * 45 + ((fnv(id, 41) % 21) - 10));   /* only used for the hummed phrases */
  const eRate = [-8, -3, 2, 7, 12][fnv(id, 61) % 5], eBase = g === 'female' ? -4 : -10, ePitch = eBase + 4 * (fnv(id, 71) % 5), eVoice = g === 'female' ? 'id-ID-GadisNeural' : 'id-ID-ArdiNeural';   /* server (Microsoft) engine: 2 voices x 5 speeds x 5 pitches */
  return { id, gender: g, eVoice, eRate, ePitch, cents, voice, pitch: +(pitch + jp).toFixed(4), rate: +(rate + jr).toFixed(4), bucket: g[0] + pStep + '.' + rStep + '.' + voice };
}
/** True if two profiles are audibly different (different preset voice, or pitch gap >= 0.06, or speed gap >= 0.06). */
export const audiblyDifferentEdge = (a, b) => a.eVoice !== b.eVoice || Math.abs(a.eRate - b.eRate) >= 5 || Math.abs(a.ePitch - b.ePitch) >= 4;
export const audiblyDifferent = (a, b) => a.voice !== b.voice || Math.abs(a.pitch - b.pitch) >= 0.06 || Math.abs(a.rate - b.rate) >= 0.06;

// ── Pronunciation dictionary for the built-in voice (advanced, empty by default): word -> how to write it so the voice says it right.
// It only changes what is spoken, never what is shown. The "s" that used to vanish from speech came from a server bug that stripped the
// letter from the event text (fixed at the source), so no respelling is applied unless a word is added here.
const keepCase = (src, out) => (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() ? out[0].toUpperCase() + out.slice(1) : out);
/** Respell whole words using dict ({ word: respelling }). Letters, numbers and punctuation elsewhere are untouched. */
export function applyPron(text, dict = {}) {
  let t = String(text ?? '');
  for (const [k, v] of Object.entries(dict || {})) { if (!k || !v) continue; const re = new RegExp('(?<![\\p{L}\\p{N}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'giu'); t = t.replace(re, (m) => keepCase(m, v)); }
  return t;
}
/** Original message for a chat event: by messageId, else (events from a server not restarted yet) the latest one from that sender in that channel. */
export function findMessageFor(ev, messages) {
  const ms = messages || [];
  if (ev?.messageId) { const m = ms.find((x) => x.id === ev.messageId); if (m) return m.text; }
  for (let i = ms.length - 1; i >= 0 && i > ms.length - 300; i--) if (ms[i].authorId === ev?.actorId && ms[i].channelId === ev?.channelId) return ms[i].text;
  return '';
}
/** The text that bubble and voice must use for a chat event: the full original message when it is known, else the event preview. */
export function messageSource(ev, getText) {
  let full = ''; try { full = getText ? getText(ev) : ''; } catch { /* fall back to the preview */ }
  if (full) return String(full).replace(/\s+/g, ' ').trim();
  return String(ev?.text ?? '').split(': ').slice(1).join(': ') || String(ev?.text ?? '');
}

// ── Turn-taking ("floor"): who may speak now. Pure and clock-injectable, so it is tested without a browser.
// Rules: one voice at a time; while the owner types or speaks, nothing new starts; when the owner starts, whoever talks fades out and lines that
// are already out of date are dropped; the next speaker waits a short, slightly random pause (200-600 ms); a line that waited too long is not spoken.
export function createFloor({ now = () => Date.now(), timer = setTimeout, clear = clearTimeout, rand = Math.random, hold = 1200, stale = 20000, keep = 8000, gap = [200, 600], max = 3, start, stop, onDrop } = {}) {
  let q = [], cur = null, tm = null, ownerUntil = 0;
  const pause = () => gap[0] + rand() * (gap[1] - gap[0]);
  const ownerBusy = () => now() < ownerUntil;
  const later = (fn, ms) => { clear(tm); tm = timer(fn, ms); };
  function pump() {
    clear(tm); tm = null;
    if (cur || !q.length) return;
    if (ownerBusy() && !q[0].manual) return later(pump, ownerUntil - now() + pause());
    const t = now(); while (q.length && t - q[0].at > stale) onDrop?.(q.shift());
    if (!q.length) return;
    const it = q.shift(); cur = it;
    start(it, () => { if (cur !== it) return; cur = null; later(pump, pause()); });
  }
  return {
    enqueue(it, { front = false } = {}) { it.at = now(); if (front) q.unshift(it); else q.push(it); while (q.length > max) onDrop?.(front ? q.pop() : q.shift()); pump(); },
    /** the owner types or speaks: hold the floor, fade out whoever talks, forget queued lines that are now out of date */
    ownerActive(ms = hold) {
      ownerUntil = Math.max(ownerUntil, now() + ms);
      if (cur) { const c = cur; cur = null; stop(c); }
      const t = now(); q = q.filter((x) => { const ok = x.manual || t - x.at < keep; if (!ok) onDrop?.(x); return ok; });
      if (q.length) later(pump, ms + pause());
    },
    reset() { clear(tm); tm = null; const c = cur; cur = null; q = []; if (c) stop(c); },
    ownerBusy, speaking: () => !!cur, pending: () => q.length, idle: () => !cur && !q.length && !ownerBusy(),
  };
}

// ── Speaking style (a very light, local take on expressive TTS). ElevenLabs' v3/v4 docs (best-practices page) steer delivery with audio tags
// such as [excited] [whispers] [sighs] [curious] [laughs], punctuation and pauses. Here the same cues move pitch, speed, volume and pauses per sentence.
const TAGS = {
  excited: { dPitch: 0.06, dRate: 0.06 }, happy: { dPitch: 0.05, dRate: 0.04 }, laughs: { dPitch: 0.05, dRate: 0.05 }, 'laughs harder': { dPitch: 0.06, dRate: 0.07 }, 'starts laughing': { dPitch: 0.05, dRate: 0.05 },
  whispers: { dPitch: -0.04, dRate: -0.06, vol: 0.5 }, whispering: { dPitch: -0.04, dRate: -0.06, vol: 0.5 }, sighs: { dPitch: -0.05, dRate: -0.1, vol: 0.85, lead: 450 }, sigh: { dPitch: -0.05, dRate: -0.1, vol: 0.85, lead: 450 }, exhales: { dRate: -0.06, lead: 300 },
  curious: { dPitch: 0.05, dRate: -0.02 }, sarcastic: { dPitch: -0.02, dRate: -0.05 }, crying: { dPitch: -0.06, dRate: -0.08 }, sad: { dPitch: -0.06, dRate: -0.08 }, shouting: { dPitch: 0.04, dRate: 0.04 }, snorts: {}, mischievously: { dPitch: 0.03, dRate: -0.03 },
};
const TAG_RE = new RegExp('\\[(' + Object.keys(TAGS).concat(['wheezing', 'sings', 'gulps', 'swallows', 'applause', 'clapping']).sort((a, b) => b.length - a.length).join('|') + ')\\]', 'gi');
/** First audio tag in the text, lowercase, or ''. */
export const extractTag = (text) => { const m = new RegExp(TAG_RE.source, 'i').exec(String(text ?? '')); return m ? m[1].toLowerCase() : ''; };
const HAPPY = /\b(selamat|mantap|senang|berhasil|hore|bagus|keren|terima kasih|sukses|wah)\b/i, SORRY = /\b(maaf|sayang sekali|turut|kendala|gagal|sedih|belum bisa|tidak bisa)\b/i, UNSURE = /\b(mungkin|sepertinya|kayaknya|barangkali|kurang yakin|entah)\b/i;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Pitch/speed/volume offsets and the pause after one sentence, from punctuation, wording and an optional audio tag. */
export function prosodyFor(sentence, tag = '') {
  const s = String(sentence ?? '').trim();
  let dPitch = 0, dRate = 0, vol = 1, pause = 300, lead = 0;
  if (/\?$/.test(s)) { dPitch += 0.07; dRate -= 0.02; pause = 340; }                    /* question: rises at the end */
  else if (/!$/.test(s)) { dPitch += 0.04; dRate += 0.05; pause = 240; }               /* exclamation: more energy */
  else if (/(\.\.\.|…)$/.test(s)) { dPitch -= 0.04; dRate -= 0.06; pause = 520; }      /* trailing off: slower, lower, longer pause */
  else if (/[,;:]$/.test(s)) pause = 160;                                                /* comma: short pause */
  if (HAPPY.test(s)) { dPitch += 0.04; dRate += 0.04; }
  if (SORRY.test(s)) { dPitch -= 0.05; dRate -= 0.06; }
  if (UNSURE.test(s)) { dRate -= 0.04; dPitch += 0.02; }
  const t = TAGS[String(tag).toLowerCase()];
  if (t) { dPitch += t.dPitch || 0; dRate += t.dRate || 0; vol *= t.vol ?? 1; lead = t.lead || 0; }
  return { dPitch: +clamp(dPitch, -0.12, 0.12).toFixed(3), dRate: +clamp(dRate, -0.15, 0.12).toFixed(3), vol, pause, lead };
}
/** Split into sentences, and long sentences into clauses at commas (short pause), so the delivery follows the punctuation. */
export function sentencesOf(text, longer = 70) {
  const out = [];
  for (const s of String(text ?? '').split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean)) {
    if (s.length <= longer) { out.push(s); continue; }
    let cur = ''; for (const c of s.split(/(?<=,)\s+/)) { if (cur && cur.length + c.length + 1 > longer) { out.push(cur); cur = c; } else cur += (cur ? ' ' : '') + c; }
    if (cur) out.push(cur);
  }
  return out;
}

// ── runtime (browser only)
const S = { on: false, vol: 0.9, engine: 'browser', v: 3, maleEdge: true, autoRead: true, ownerVoice: true };   /* maleEdge: male agents use Microsoft Ardi when the browser has no Indonesian male voice */   /* 'browser' = built-in voice (default); 'edge' = server voice (Microsoft Gadis/Ardi), also optional */
const EG = { status: 'idle', ok: null, err: '', ms: 0, hits: 0, misses: 0 };   /* server (Microsoft) engine state */
let gen = 0, actx = null, live = null;
let lookup = null, voices = [], lastErr = '', stats = { spoken: 0, dropped: 0, lastStartMs: 0 };
const ss = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
const LS = typeof window !== 'undefined' ? window.localStorage : null;
try { const o = JSON.parse(LS?.getItem('office-tts') || '{}'); if ((o.v || 0) < 3) o.engine = 'browser'; Object.assign(S, o, { v: 3 }); } catch { /* defaults */ }
const PR = { dict: {} };
try { Object.assign(PR, JSON.parse(LS?.getItem('office-tts-pron') || '{}')); } catch { /* defaults */ }
const savePR = () => { try { LS?.setItem('office-tts-pron', JSON.stringify(PR)); } catch { /* ignore */ } };
const save = () => { try { LS?.setItem('office-tts', JSON.stringify(S)); } catch { /* ignore */ } };
let hasId = false;
const FEM = /zira|female|gadis|wanita|perempuan|hazel|susan|jenny|aria|samantha|heera|helena|catherine|libby|sonia|karen|tessa|moira|fiona|victoria|ayumi|yuna|ting-ting|\bhuihui\b|katja|hedda|zira|elsa|emma|amy|ava|nova|sara|siti|dewi|ratna|kanya|damayanti/i;
const MALE = /\b(male|man|pria|laki)\b|david|mark|george|ardi|andika|daniel|alex|fred|ravi|guy|ryan|brian|james|thomas|tom|jorge|diego|stefan|yoshi|ichiro|kangkung|pak\b|rizki|budi|agus/i;
/** 'female' | 'male' | '' (unknown) from a voice name; an explicit word like Female/Male wins over a name. */
export const voiceGenderOf = (name) => { const n = String(name || ''); if (/\bfemale\b|wanita|perempuan/i.test(n)) return 'female'; if (/\bmale\b|\bpria\b|laki/i.test(n)) return 'male'; if (FEM.test(n)) return 'female'; if (MALE.test(n)) return 'male'; return ''; };
const loadVoices = () => { const s = ss(); if (!s) return; const all = s.getVoices(), idv = all.filter((v) => /^id([-_]|$)/i.test(v.lang) || /indonesia/i.test(v.name)); hasId = idv.length > 0; voices = hasId ? idv : all; voices.sort((a, b) => (b.localService - a.localService) || a.name.localeCompare(b.name)); };
const kabarSuara = () => { try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('raiverse:suara-berubah')); } catch { /* ignore */ } };
const muatSuara = () => { const n = voices.length; loadVoices(); if (voices.length !== n) kabarSuara(); };
try {
  ss()?.addEventListener?.('voiceschanged', muatSuara); loadVoices();
  // getVoices() sering kosong di awal (dimuat tidak serempak, dan sebagian peramban tidak mengirim voiceschanged): coba lagi tiap 0,5 detik sampai ada, paling lama ~10 detik
  if (!voices.length && typeof setInterval !== 'undefined') { let n = 0; const t = setInterval(() => { muatSuara(); if (voices.length || ++n > 20) { clearInterval(t); kabarSuara(); } }, 500); }
} catch { /* no speech */ }
let terblokir = false, gagalT = 0;
const kabarGagal = (sebab) => { lastErr = sebab; const now = Date.now(); if (now - gagalT < 20000) return; gagalT = now; try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('raiverse:suara-gagal', { detail: { sebab, pesan: kenapaDiam() } })); } catch { /* ignore */ } };

const baseProfile = (id) => { const e = lookup?.(id); return profileFor(id, genderOf(e || { id }), Math.max(1, voices.length)); };
const SHIFTS = []; for (let dp = -4; dp <= 4; dp++) for (let dr = -2; dr <= 2; dr++) SHIFTS.push([dp, dr]);
SHIFTS.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]) || a[0] - b[0] || a[1] - b[1]);   /* nearest changes first */
/** Nudge a profile (pitch step and speed step) without leaving its gender band, until it differs from everyone already placed. */
function nudge(p, k, engine) {
  const B = BAND[p.gender];
  const [dp, dr] = SHIFTS[k];
  if (engine === 'edge') return { ...p, ePitch: p.ePitch + 4 * dp, eRate: p.eRate + 5 * dr };
  return { ...p, pitch: +Math.min(B.pitch[1] + 0.01, Math.max(B.pitch[0] - 0.01, p.pitch + 0.065 * dp)).toFixed(4), rate: +Math.min(1.2, Math.max(0.84, p.rate + 0.065 * dr)).toFixed(4) };
}
/** Profile of one agent; when `group` (ids of everyone in the same room or meeting) is given, nobody in the group sounds the same as another. */
function profileOf(id, group) {
  const mine = baseProfile(id); if (!group || group.length < 2 || !group.includes(id)) return mine;
  const diff = S.engine === 'edge' ? audiblyDifferentEdge : audiblyDifferent, placed = [];
  for (const x of [...new Set(group)].sort()) {
    const base = baseProfile(x); let p = base;
    for (let k = 1; k < SHIFTS.length && placed.some((o) => !diff(o, p)); k++) p = nudge(base, k, S.engine);
    placed.push(p); if (x === id) return p;
  }
  return mine;
}
/** pick a voice for the profile: prefer one that matches the agent's gender when the pool allows it */
const voiceFor = (p) => {   /* a male agent only ever gets a voice known to be male when one exists; an unnamed voice is the second choice, a voice known to be the other gender the last */
  if (!voices.length) return null;
  const want = p.gender, other = want === 'female' ? 'male' : 'female';
  const exact = voices.filter((v) => voiceGenderOf(v.name) === want), unknown = voices.filter((v) => !voiceGenderOf(v.name));
  const pool = exact.length ? exact : unknown.length ? unknown : voices.filter((v) => voiceGenderOf(v.name) !== other).length ? voices.filter((v) => voiceGenderOf(v.name) !== other) : voices;
  return pool[p.voice % pool.length];
};
/** What this device can do for each gender (shown in Settings): the voices known to be female / male / unnamed. */
const voiceInfo = () => ({ female: voices.filter((v) => voiceGenderOf(v.name) === 'female').map((v) => v.name), male: voices.filter((v) => voiceGenderOf(v.name) === 'male').map((v) => v.name), unknown: voices.filter((v) => !voiceGenderOf(v.name)).map((v) => v.name) });

/** A real Indonesian male voice in the browser? (An English male voice reading Indonesian does not count.) */
const hasMaleIdVoice = () => hasId && voices.some((v) => voiceGenderOf(v.name) === 'male');
/** Male agents are spoken by Microsoft Ardi when the browser has no Indonesian male voice and the server voice is available; otherwise the built-in voice. */
const maleViaEdge = (p) => !!(S.maleEdge && S.engine === 'browser' && p?.gender === 'male' && !hasMaleIdVoice() && EG.avail === true && EG.ok !== false && !edgeSlow());
const willUseEdge = (it) => !it.browserOnly && !it.fb && EG.ok !== false && (S.engine === 'edge' || maleViaEdge(it.profile));
/** The Microsoft voice is judged too slow when the last three first sounds all took more than 5 s; it is tried again after 3 minutes. */
const edgeSlow = () => { if (!EG.slow) return false; if (Date.now() - EG.slowAt > 180000) { EG.slow = false; EG.lat = []; return false; } return true; };

// the one floor of the whole page
const floor = createFloor({
  start: (it, done) => runItem(it, done),
  stop: () => { gen++; const l = live; live = null; try { l?.stop(true); } catch { /* ignore */ } try { ss()?.cancel(); } catch { /* ignore */ } },
  onDrop: (x) => { stats.dropped++; try { x?.ac?.abort(); } catch { /* ignore */ } },
});
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });
  // the owner holds the floor while typing in any text field (dock, chat, forms) or speaking into the microphone
  const isField = (t) => t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|submit|file|color)$/i.test(t.type || '')) || t.isContentEditable);
  document.addEventListener('input', (e) => { if (isField(e.target)) floor.ownerActive(); }, true);
  document.addEventListener('keydown', (e) => { if (isField(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key?.length === 1 || e.key === 'Backspace')) floor.ownerActive(); }, true);
  addEventListener('owner-speaking', (e) => floor.ownerActive(e.detail?.ms || 2500));
}

function runItem(it, done) {
  const my = gen;
  if (willUseEdge(it)) return playEdge(it, my, done);
  runBrowser(it, my, done);
}
/** Built-in voice, sentence by sentence with pitch/speed/pause following the punctuation. */
function runBrowser(it, my, done) {
  const s = ss(); if (!s) return done();
  const parts = sentencesOf(it.text), p = it.profile, vol = clamp(it.vol ?? S.vol, 0, 1); let i = 0, first = true, wd = 0, to = 0;
  const handle = { stop: () => { clearTimeout(wd); clearTimeout(to); try { s.cancel(); } catch { /* ignore */ } } }; live = handle;
  const finish = () => { clearTimeout(wd); if (live === handle) live = null; if (my === gen) done(); };
  const step = () => {
    if (my !== gen) return;
    if (i >= parts.length) return finish();
    const sen = parts[i++], pr = prosodyFor(sen, i === 1 ? it.tag : ''), u = new SpeechSynthesisUtterance(applyPron(sen, PR.dict));
    u.lang = 'id-ID'; const vv = voiceFor(p); if (vv) u.voice = vv;
    const B = BAND[p.gender], jp = (Math.random() - 0.5) * 0.024, jr = (Math.random() - 0.5) * 0.03; u.pitch = +clamp(p.pitch + pr.dPitch + jp, B.pitch[0] - 0.12, B.pitch[1] + 0.12).toFixed(3); u.rate = +clamp(p.rate + pr.dRate + jr, 0.7, 1.3).toFixed(3); u.volume = clamp(vol * pr.vol, 0, 1);
    const t0 = performance.now(); let started = false;
    const next = () => { clearTimeout(wd); if (my !== gen) return; to = setTimeout(step, pr.pause); };
    wd = setTimeout(() => { try { s.cancel(); } catch { /* ignore */ } if (!started) kabarGagal(voices.length ? 'tidak-mulai' : 'tanpa-suara'); next(); }, 4000 + sen.length * 140);   /* some engines never fire onend */
    u.onstart = () => { started = true; stats.started = (stats.started || 0) + 1; if (first) { stats.lastStartMs = Math.round(performance.now() - t0); first = false; } };
    u.onend = next; u.onerror = (ev) => { if (!started && ev?.error && ev.error !== 'canceled' && ev.error !== 'interrupted') { if (ev.error === 'not-allowed') terblokir = true; kabarGagal(ev.error); } next(); };
    try { s.speak(u); stats.spoken++; } catch (e) { kabarGagal(String(e)); next(); }
  };
  const lead = prosodyFor(parts[0] || '', it.tag).lead; if (lead) to = setTimeout(step, lead); else step();
}

/** Speak `text` in the voice of agent `agentId`. No-op while the switch is off. Takes its turn: see createFloor. */
export function speak(agentId, text, opts = {}) {
  const s = ss(); if (!s || (!S.on && !opts.force)) return false;
  const tag = extractTag(text), t = cleanText(text); if (!t || t.length < 2) return false;
  if (opts.ambient && !floor.idle()) return false;   /* background chatter never waits in line, never delays a real reply, and is silent while the owner has the floor */
  const it = { text: t, tag, profile: opts.profile || profileOf(agentId, opts.group), vol: opts.vol, ambient: !!opts.ambient, manual: !!(opts.manual || opts.force), browserOnly: !!opts.browserOnly };
  if (willUseEdge(it)) edgeJobs(it);   /* start fetching the audio now, while the line waits for its turn */
  if (opts.interrupt) floor.reset();
  floor.enqueue(it, { front: !!opts.front });
  return true;
}
export function stopSpeaking() { floor.reset(); }
/** Which new chat messages should be spoken: only those from conversations the owner takes part in, fresh (< 20 s), not mirrored copies, not slash commands.
 *  `seen` is a Set of message ids already handled. The owner's own lines are marked so they can go first and use the owner's voice. */
export function pickSpeakable(messages, channels, me, seen, now = Date.now()) {
  const out = [], ch = new Map((channels || []).map((c) => [c.id, c]));
  for (let i = Math.max(0, (messages || []).length - 40); i < messages.length; i++) {
    const m = messages[i]; if (!m || seen.has(m.id)) continue; seen.add(m.id);
    if (now - (m.t || 0) > 20000 || m.mirrored) continue;
    const c = ch.get(m.channelId); if (!c || (c.members && !c.members.includes(me))) continue;   /* a channel without a member list (#general) is open to everyone */
    const text = String(m.text ?? ''); if (!text.trim() || /^\s*\//.test(text)) continue;
    out.push({ id: m.id, authorId: m.authorId, text, owner: m.authorId === me, group: (c.members || []).filter((x) => x !== me) });
  }
  return out;
}
let primed = false; const seenMsgs = new Set();
/** Call whenever chat messages change. The first call only remembers what is already there; after that every new message in a conversation the owner is in is spoken
 *  in its author's voice (the owner's own message first, in the owner's voice), so one-to-one chats, groups and meetings all sound like a conversation. */
function ingest(messages, channels, me) {
  if (!primed) { primed = true; for (const m of messages || []) seenMsgs.add(m.id); return 0; }
  if (seenMsgs.size > 4000) seenMsgs.clear();
  const list = pickSpeakable(messages || [], channels || [], me, seenMsgs);
  if (!S.on || !S.autoRead) return 0;
  let n = 0;
  for (const m of list) {
    if (m.owner && !S.ownerVoice) continue;
    if (speak(m.authorId, m.text, { group: m.group.concat([m.authorId]), front: m.owner, manual: m.owner, browserOnly: m.owner })) n++;   /* the owner's own line uses the local voice: no network wait before the agents answer */
  }
  return n;
}
let watchT = 0;
/** Poll the chat data a few times a second (independent of animation frames, which pause in background tabs). ctx() returns { messages, channels, me }. */
function watch(ctx) { clearInterval(watchT); if (typeof setInterval === 'undefined' || !ctx) return; watchT = setInterval(() => { try { const c = ctx(); if (c?.messages) ingest(c.messages, c.channels, c.me); } catch { /* ignore */ } }, 600); }
const waiters = []; let waitT = 0;
/** Run `fn` now, or as soon as the owner stops typing (used so a new reply bubble never appears over the text being written). */
export function whenFree(fn) {
  if (!floor.ownerBusy()) return fn();
  waiters.push(fn);
  if (!waitT) waitT = setInterval(() => { if (floor.ownerBusy()) return; clearInterval(waitT); waitT = 0; for (const f of waiters.splice(0)) { try { f(); } catch { /* ignore */ } } }, 250);
}

// ── Server engine (Microsoft Gadis/Ardi through /api/tts). Sentence by sentence, played gapless; any failure falls back to the browser voice.
const splitSentences = (t, max = 110) => { const out = []; let cur = ''; for (const s of t.split(/(?<=[.!?])\s+/)) { if (cur && cur.length + s.length + 1 > max) { out.push(cur); cur = s; } else cur += (cur ? ' ' : '') + s; } if (cur) out.push(cur); return out.flatMap((x) => (x.length <= max ? [x] : x.match(new RegExp('.{1,' + max + '}(\\s|$)', 'g')) || [x])).map((x) => x.trim()).filter(Boolean); };
const ecache = new Map();
const ensureCtx = () => (actx = actx || new (window.AudioContext || window.webkitAudioContext)());
async function edgeFetch(text, p, signal) {
  const key = p.eVoice + '|' + p.eRate + '|' + p.ePitch + '|' + text, hit = ecache.get(key);
  if (hit) { EG.hits++; ecache.delete(key); ecache.set(key, hit); return hit; }
  EG.misses++;
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: p.eVoice, rate: (p.eRate >= 0 ? '+' : '') + p.eRate + '%', pitch: (p.ePitch >= 0 ? '+' : '') + p.ePitch + 'Hz' }), signal });
  if (!r.ok) throw new Error('suara server ' + r.status);
  const j = await r.json(), bin = atob(j.audio), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = await ensureCtx().decodeAudioData(u8.buffer);
  if (text.length <= 120) { ecache.set(key, buf); while (ecache.size > 30) ecache.delete(ecache.keys().next().value); }
  return buf;
}
/** Request the audio of every sentence of a line at once (the wait is that of the slowest, not the sum). Called when the line is queued, so it is often ready by its turn. */
function edgeJobs(it) {
  if (it.jobs) return it;
  const p = it.profile; it.parts = splitSentences(it.text); it.ac = new AbortController(); it.t0 = performance.now();
  it.pros = it.parts.map((x, k) => prosodyFor(x, k === 0 ? it.tag : ''));
  const tm = setTimeout(() => it.ac.abort(), 15000);
  it.jobs = it.parts.map((x, k) => { const pr = it.pros[k], pp = { ...p, ePitch: p.ePitch + Math.round(pr.dPitch * 40 + (Math.random() - 0.5) * 3), eRate: p.eRate + Math.round(pr.dRate * 60 + (Math.random() - 0.5) * 3) }; return edgeFetch(x, pp, it.ac.signal).catch((e) => e); });
  Promise.allSettled(it.jobs).then(() => clearTimeout(tm));
  return it;
}
function playEdge(it, my, done) {
  edgeJobs(it);
  const parts = it.parts, vol = clamp(it.vol ?? S.vol, 0, 1), run = { srcs: [], live: 0, next: 0, finished: false };
  let played = 0, mg = null;
  const finish = () => { if (live === run) live = null; if (my === gen) done(); };
  run.stop = (fade) => {
    try { it.ac.abort(); } catch { /* ignore */ }
    const srcs = run.srcs.splice(0); for (const x of srcs) x.onended = null;
    if (fade && mg && actx) { const t = actx.currentTime; mg.gain.cancelScheduledValues(t); mg.gain.setValueAtTime(mg.gain.value, t); mg.gain.linearRampToValueAtTime(0.0001, t + 0.2); setTimeout(() => { for (const x of srcs) try { x.stop(); } catch { /* ignore */ } }, 260); }
    else for (const x of srcs) try { x.stop(); } catch { /* ignore */ }
  };
  live = run;
  (async () => {
    try {
      ensureCtx(); if (actx.state === 'suspended') await actx.resume();
      mg = actx.createGain(); mg.gain.value = vol; mg.connect(actx.destination);
      for (let k = 0; k < parts.length; k++) {
        const pr = it.pros[k]; const r = await it.jobs[k]; if (r instanceof Error) throw r; const buf = r;
        if (my !== gen) return;
        const src = actx.createBufferSource(); src.buffer = buf; const g = actx.createGain(); g.gain.value = pr.vol; src.connect(g).connect(mg);
        const t = Math.max(actx.currentTime + 0.03, run.next) + (k === 0 ? (pr.lead || 0) / 1000 : 0); src.start(t); run.next = t + buf.duration + pr.pause / 1000; run.srcs.push(src); run.live++; played++;
        src.onended = () => { run.live--; if (run.finished && run.live === 0) finish(); };
        if (played === 1) {   // time from queueing to the first sound; three slow ones in a row switch male agents to the local voice for a while
          EG.ms = Math.round(performance.now() - it.t0); (EG.lat = EG.lat || []).push(EG.ms); if (EG.lat.length > 3) EG.lat.shift();
          if (EG.lat.length === 3 && EG.lat.every((x) => x > 5000)) { EG.slow = true; EG.slowAt = Date.now(); }
        }
      }
      EG.ok = true; EG.err = ''; EG.fails = 0;
      run.finished = true; if (run.live === 0) finish();
    } catch (e) {
      if (my !== gen) return;
      EG.err = String(e.message || e); if (!played) EG.fails = (EG.fails || 0) + 1; if ((EG.fails || 0) >= 3) EG.ok = false;   /* three failures in a row: stop trying until the owner picks it again */
      const rest = parts.slice(played).join(' '); run.stop(false); if (live === run) live = null;
      if (rest) runBrowser({ ...it, text: rest, fb: true }, my, done); else done();
    }
  })();
}
async function checkEdge() { try { const r = await fetch('/api/tts/status'); if (r.status === 404) { EG.avail = false; EG.availErr = 'server belum dimulai ulang (rute suara baru belum aktif)'; } else if (r.status === 401) { EG.avail = false; EG.availErr = 'sesi login habis; muat ulang halaman'; } else { const j = await r.json(); EG.avail = !!j.available; EG.availErr = j.error || ''; } } catch { EG.avail = false; EG.availErr = 'server tidak menjawab'; } if (EG.avail === false) EG.ok = false; else if (EG.ok === false && !EG.fails) EG.ok = null; return EG.avail; }
if (typeof document !== 'undefined' && typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:/.test(location.protocol)) checkEdge();

let humAt = 0, humCtx = null;
/** A short soft hummed phrase in the agent's own pitch (procedural, a few oscillator nodes, no model). Skipped while anyone is speaking. */
export function hum(agentId, closeness = 1) {
  if (!S.on || !floor.idle() || typeof window === 'undefined') return false;
  const now = performance.now(); if (now - humAt < 9000) return false; humAt = now;
  try {
    humCtx = humCtx || actx || new (window.AudioContext || window.webkitAudioContext)(); if (humCtx.state !== 'running') { humCtx.resume?.(); return false; }
    const p = profileOf(agentId), base = (p.gender === 'female' ? 220 : 130) * Math.pow(2, (p.cents || 0) / 1200), t0 = humCtx.currentTime + 0.02, vol = 0.05 * S.vol * Math.min(1, Math.max(0.1, closeness));
    const scale = [0, 2, 4, 7, 9], seed = fnv(agentId, Math.floor(now / 60000)), len = 4 + (seed % 3);
    const lp = humCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = humCtx.createGain(); g.gain.value = 0; lp.connect(g).connect(humCtx.destination);
    const o = humCtx.createOscillator(); o.type = 'triangle'; const lfo = humCtx.createOscillator(), lg = humCtx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 5; lfo.connect(lg).connect(o.detune); o.connect(lp);
    let t = t0; for (let i = 0; i < len; i++) { const st = scale[(seed >> (i * 2)) % scale.length], f = base * Math.pow(2, st / 12), d = 0.28 + ((seed >> i) % 3) * 0.1; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.linearRampToValueAtTime(0.0001, t + d); t += d + 0.04; }
    o.start(t0); lfo.start(t0); o.stop(t + 0.1); lfo.stop(t + 0.1); return true;
  } catch { return false; }
}

/** keadaan suara tanpa perlu audio: dipakai Pengaturan dan tes */
export function diagnosa(x = {}) {
  const tersedia = x.tersedia ?? !!ss(), jumlah = x.jumlah ?? voices.length;
  return { tersedia, jumlahSuara: jumlah, adaIndonesia: x.adaIndonesia ?? hasId, on: x.on ?? S.on, autoRead: x.autoRead ?? S.autoRead, engine: x.engine ?? S.engine, terblokir: x.terblokir ?? terblokir, galat: x.galat ?? lastErr, mulai: x.mulai ?? (stats.started || 0), bicara: x.bicara ?? stats.spoken };
}
/** kalimat awam: kenapa suara tidak terdengar, dan apa yang bisa dilakukan; '' bila tampak baik-baik saja */
export function kenapaDiam(d = diagnosa()) {
  if (!d.tersedia) return 'Peramban ini tidak punya suara bicara. Coba Chrome atau Edge terbaru.';
  if (d.terblokir) return 'Peramban menahan suara sampai kamu menyentuh halaman. Tekan "Tes suara" sekali.';
  if (!d.jumlahSuara) return 'Perangkat ini belum punya suara bicara. Pasang suara bahasa Indonesia di pengaturan sistem, atau pilih mesin suara Server.';
  if (!d.on) return 'Suara bicara masih mati.';
  if (d.galat === 'tidak-mulai') return 'Suara dikirim tetapi tidak berbunyi. Cek volume perangkat, lalu tekan "Tes suara".';
  if (!d.adaIndonesia) return 'Belum ada suara bahasa Indonesia; dipakai suara lain yang tersedia.';
  return '';
}
export const tts = {
  hum, ingest, watch, messageSource, whenFree, learnBrands, extractTag, prosodyFor,
  /** the owner is talking (microphone): hold the floor for `ms` */
  ownerSpeaking: (ms = 2500) => floor.ownerActive(ms),
  pron: () => ({ dict: { ...PR.dict } }),
  setPron(patch) { if (patch.word !== undefined) { const w = String(patch.word).trim().toLowerCase(), v = String(patch.say || '').trim(); if (w && v) PR.dict[w] = v; else if (w) delete PR.dict[w]; } savePR(); },
  applyPron: (t) => applyPron(t, PR.dict),
  checkEdge, edgeState: () => ({ ...EG, cached: ecache.size }),
  speak, stop: stopSpeaking, stopSpeaking, cleanText, profileFor,
  bind(fn) { lookup = fn; },
  available: () => !!ss(),
  voices: () => voices.map((v) => ({ name: v.name, lang: v.lang, local: v.localService })),
  state: () => ({ ...S, edge: { ...EG }, available: !!ss(), voiceCount: voices.length, hasIndonesian: hasId, voiceNames: voices.map((v) => v.name), voiceInfo: voiceInfo(), maleSlow: edgeSlow(), maleBrowser: hasMaleIdVoice(), maleViaEdge: maleViaEdge({ gender: 'male' }), speaking: floor.speaking(), pending: floor.pending(), ownerBusy: floor.ownerBusy(), lastErr, ...stats }),
  isOn: () => S.on,
  diagnosa, kenapaDiam,
  profile: (id, group) => profileOf(id, group),
  set(patch) { if (patch.engine === 'edge') { EG.ok = null; EG.fails = 0; EG.err = ''; }
    if (patch.engine && patch.engine !== 'edge' && patch.engine !== 'browser') delete patch.engine;
    Object.assign(S, patch); S.vol = Math.min(1, Math.max(0, +S.vol || 0)); save(); if (!S.on) stopSpeaking(); return { ...S }; },
  /** test voice button: works even with the switch off, so people can hear it before enabling */
  test(agentId = 'owner', text = 'Halo, saya agen RAIVERSE. Hari ini ada dua belas tugas selesai, sembilan puluh lima persen sesuai target.') { stopSpeaking(); return speak(agentId, text, { force: true }); },
};

// ── jembatan obrolan baru: Obrolan (mesin chat baru) tidak menulis ke S.data.messages, jadi pengamat pesan lama tidak pernah melihat balasannya.
// Kontrak: window.dispatchEvent(new CustomEvent('raiverse:balasan', { detail: { speakerId, text } })) saat satu balasan SELESAI (bukan tiap potongan streaming).
if (typeof window !== 'undefined') {
  window.addEventListener('raiverse:balasan', (e) => { const d = e.detail || {}; if (!S.on || !S.autoRead || !d.text) return; try { speak(d.speakerId || 'aria', String(d.text), { interrupt: false }); } catch { /* ignore */ } });
  // satu gerakan pengguna pertama membuka kunci suara peramban (autoplay): ucapan kosong, tanpa bunyi
  const buka = () => { try { const s = ss(); if (s) { s.resume?.(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); terblokir = false; } } catch { /* ignore */ } window.removeEventListener('pointerdown', buka, true); window.removeEventListener('keydown', buka, true); };
  window.addEventListener('pointerdown', buka, true); window.addEventListener('keydown', buka, true);
}
