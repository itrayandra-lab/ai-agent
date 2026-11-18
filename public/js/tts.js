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

/** Strip markdown, links, emoji and code; read numbers and abbreviations naturally. */
export function cleanText(src, max = 420) {
  let t = String(src ?? '');
  t = t.replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, '$1');
  t = t.replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_, a, b) => b || a);
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
  t = t.replace(/\b[A-Za-z][A-Za-z0-9]{1,5}\b/g, (w) => (ACR[w] !== undefined ? ACR[w] : ABBR[w.toLowerCase()] !== undefined && w === w.toLowerCase() ? ABBR[w.toLowerCase()] : w));
  t = t.replace(/&/g, ' dan ').replace(/\//g, ' atau ').replace(/[#*_=<>^~\\{}\[\]]/g, ' ').replace(/[:;]+(?=\s|$)/g, '.').replace(/\s*\n+\s*/g, '. ').replace(/\.{2,}/g, '.').replace(/([.!?])\s*\.\s*/g, '$1 ').replace(/\s+/g, ' ').trim();
  if (t.length > max) { const cut = t.slice(0, max), i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! ')); t = (i > max * 0.5 ? cut.slice(0, i + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '.'); }
  return t;
}

const fnv = (s, seed = 2166136261) => { let h = seed >>> 0; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return h >>> 0; };
const GENDER_HASH = (id) => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };   /* same rule as assets3d.resolveAppearance */
export const genderOf = (e) => (e?.appearance?.gender) || (GENDER_HASH(e?.id || e?.name || 'x') % 100 < 48 ? 'female' : 'male');

// Pitch/speed grid per gender. Neighbouring steps are far enough apart to hear (about 1.5 semitones / 7 percent speed).
const BAND = { female: { pitch: [1.05, 1.3], steps: 6 }, male: { pitch: [0.8, 1.02], steps: 5 } };   /* narrow on purpose: extreme pitch or speed makes the built-in voice swallow soft consonants like s */
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

// ── Pronunciation layer for the built-in voice. Some Indonesian voices swallow the s before a schwa ("sedang" -> "edang"), so the text can be
// respelled before it is spoken. Two parts: a strategy for every "se+consonant" word, and a personal dictionary (word -> how to write it).
// The owner picks the strategy by ear in Settings > Suara (the audition plays all of them); nothing here changes what is shown on screen.
const TALING = new Set(['seks', 'seksi', 'sektor', 'sektoral', 'sentral', 'sentimen', 'sentimeter', 'senator', 'seminar', 'sertifikat', 'server', 'servis', 'sesi', 'segmen', 'selebriti', 'seleb', 'selular', 'semester', 'senior', 'sensor', 'sensitif', 'separator', 'serial', 'serius', 'sekuriti', 'sekunder', 'sedan', 'sel', 'sen', 'sebastian']);
export const PRON = [
  { id: 'none', label: 'Apa adanya', fix: (w) => w },
  { id: 'neutral', label: 'Apa adanya, nada dan kecepatan normal', fix: (w) => w, neutral: true },
  { id: 'circ', label: 'sê-', fix: (w) => 's\u00ea' + w.slice(2) },
  { id: 'eu', label: 'seu-', fix: (w) => 'seu' + w.slice(2) },
  { id: 'u', label: 'su-', fix: (w) => 'su' + w.slice(2) },
  { id: 'ss', label: 'sse-', fix: (w) => 'sse' + w.slice(2) },
];
const keepCase = (src, out) => (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() ? out[0].toUpperCase() + out.slice(1) : out);
/** Respell text for the built-in voice. dict: { word: respelling }, strategy: id from PRON. */
export function applyPron(text, strategy = 'none', dict = {}) {
  let t = String(text ?? '');
  for (const [k, v] of Object.entries(dict || {})) { if (!k || !v) continue; const re = new RegExp('(?<![\\p{L}\\p{N}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'giu'); t = t.replace(re, (m) => keepCase(m, v)); }
  const st = PRON.find((p) => p.id === strategy);
  if (st && st.id !== 'none' && st.id !== 'neutral') t = t.replace(/(?<![\p{L}\p{N}])[Ss]e(?=[bcdfghjklmnpqrstvwxyz])[\p{L}]*/gu, (w) => (TALING.has(w.toLowerCase()) ? w : keepCase(w, st.fix(w.toLowerCase()))));
  return t;
}

// ── runtime (browser only)
const S = { on: false, vol: 0.9, engine: 'browser', v: 3 };   /* 'browser' = built-in voice (default); 'edge' = server voice (Microsoft Gadis/Ardi), also optional */
const EG = { status: 'idle', ok: null, err: '', ms: 0, hits: 0, misses: 0 };   /* server (Microsoft) engine state */
let gen = 0, actx = null, playing = null;
let lookup = null, voices = [], q = [], busy = false, cur = null, lastErr = '', stats = { spoken: 0, dropped: 0, lastStartMs: 0 };
const ss = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
try { const o = JSON.parse(localStorage.getItem('office-tts') || '{}'); if ((o.v || 0) < 3) o.engine = 'browser'; Object.assign(S, o, { v: 3 }); } catch { /* defaults */ }
const PR = { strategy: 'none', dict: {} };
try { Object.assign(PR, JSON.parse(localStorage.getItem('office-tts-pron') || '{}')); } catch { /* defaults */ }
const savePR = () => { try { localStorage.setItem('office-tts-pron', JSON.stringify(PR)); } catch { /* ignore */ } };
const save = () => { try { localStorage.setItem('office-tts', JSON.stringify(S)); } catch { /* ignore */ } };
let hasId = false;
const FEM = /zira|female|gadis|wanita|perempuan|hazel|susan|jenny|aria|samantha|heera|helena|catherine|libby|sonia/i;
const loadVoices = () => { const s = ss(); if (!s) return; const all = s.getVoices(), idv = all.filter((v) => /^id([-_]|$)/i.test(v.lang) || /indonesia/i.test(v.name)); hasId = idv.length > 0; voices = hasId ? idv : all; voices.sort((a, b) => (b.localService - a.localService) || a.name.localeCompare(b.name)); };
try { ss()?.addEventListener?.('voiceschanged', loadVoices); loadVoices(); } catch { /* no speech */ }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });

const profileOf = (id) => { const e = lookup?.(id); return profileFor(id, genderOf(e || { id }), Math.max(1, voices.length)); };
/** pick a voice for the profile: prefer one that matches the agent's gender when the pool allows it */
const voiceFor = (p) => { if (!voices.length) return null; const m = voices.filter((v) => FEM.test(v.name) === (p.gender === 'female')); const pool = m.length ? m : voices; return pool[p.voice % pool.length]; };
function next() {
  const s = ss(); if (!s || busy || !q.length) return;
  const it = q.shift(); busy = true;
  if (S.engine === 'edge' && !it.fb && EG.ok !== false) return playEdge(it);
  const strat = it.pron || PR.strategy, u = new SpeechSynthesisUtterance(applyPron(it.text, strat, it.pron ? {} : PR.dict)); const p = it.profile;
  u.lang = 'id-ID'; const vv = voiceFor(p); if (vv) u.voice = vv; u.pitch = PRON.find((x) => x.id === strat)?.neutral ? 1 : p.pitch; u.rate = PRON.find((x) => x.id === strat)?.neutral ? 1 : p.rate; u.volume = Math.min(1, Math.max(0, it.vol ?? S.vol));
  const t0 = performance.now(); let started = false;
  const fin = () => { if (cur === u) { cur = null; busy = false; clearTimeout(wd); next(); } };
  const wd = setTimeout(() => { try { s.cancel(); } catch { /* ignore */ } fin(); }, 4000 + it.text.length * 140);   /* some engines never fire onend */
  u.onstart = () => { started = true; stats.lastStartMs = Math.round(performance.now() - t0); };
  u.onend = fin; u.onerror = (ev) => { if (!started && ev?.error && ev.error !== 'canceled' && ev.error !== 'interrupted') lastErr = ev.error; fin(); };
  cur = u; try { s.speak(u); stats.spoken++; } catch (e) { lastErr = String(e); fin(); }
}

/** Speak `text` in the voice of agent `agentId`. No-op while the switch is off. Old queued lines are dropped when more than 2 wait. */
export function speak(agentId, text, opts = {}) {
  const s = ss(); if (!s || (!S.on && !opts.force)) return false;
  const t = cleanText(text); if (!t || t.length < 2) return false;
  if (opts.ambient && (busy || q.length)) return false;   /* background chatter never waits in line and never delays a real reply */
  const it = { text: t, profile: opts.profile || profileOf(agentId), vol: opts.vol, ambient: !!opts.ambient, fb: !!opts.browserOnly, pron: opts.pron };
  if (opts.interrupt) stopSpeaking();
  q.push(it); while (q.length > 2) { q.shift(); stats.dropped++; }
  next();
  return true;
}
export function stopSpeaking() { gen++; q = []; busy = false; try { playing?.stop(); } catch { /* ignore */ } playing = null; const s = ss(); cur = null; try { s?.cancel(); } catch { /* ignore */ } }

// ── Server engine (Microsoft Gadis/Ardi through /api/tts). Sentence by sentence, played gapless; any failure falls back to the browser voice.
const splitSentences = (t, max = 110) => { const out = []; let cur = ''; for (const s of t.split(/(?<=[.!?])\s+/)) { if (cur && cur.length + s.length + 1 > max) { out.push(cur); cur = s; } else cur += (cur ? ' ' : '') + s; } if (cur) out.push(cur); return out.flatMap((x) => (x.length <= max ? [x] : x.match(new RegExp('.{1,' + max + '}(\\s|$)', 'g')) || [x])).map((x) => x.trim()).filter(Boolean); };
const ecache = new Map();
async function edgeFetch(text, p, signal) {
  const key = p.eVoice + '|' + p.eRate + '|' + p.ePitch + '|' + text, hit = ecache.get(key);
  if (hit) { EG.hits++; ecache.delete(key); ecache.set(key, hit); return hit; }
  EG.misses++;
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: p.eVoice, rate: (p.eRate >= 0 ? '+' : '') + p.eRate + '%', pitch: (p.ePitch >= 0 ? '+' : '') + p.ePitch + 'Hz' }), signal });
  if (!r.ok) throw new Error('suara server ' + r.status);
  const j = await r.json(), bin = atob(j.audio), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = await actx.decodeAudioData(u8.buffer);
  if (text.length <= 120) { ecache.set(key, buf); while (ecache.size > 30) ecache.delete(ecache.keys().next().value); }
  return buf;
}
async function playEdge(it) {
  const my = gen, p = it.profile, parts = splitSentences(it.text), run = { srcs: [], live: 0, next: 0, finished: false }, vol = Math.min(1, Math.max(0, it.vol ?? S.vol)), ac = new AbortController();
  let played = 0;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') await actx.resume();
    const end = () => { if (playing === run) { playing = null; busy = false; next(); } };
    run.stop = () => { ac.abort(); for (const x of run.srcs) { x.onended = null; try { x.stop(); } catch { /* ignore */ } } };
    playing = run;
    const t0 = performance.now();
    for (const sentence of parts) {
      const tm = setTimeout(() => ac.abort(), 12000);
      let buf; try { buf = await edgeFetch(sentence, p, ac.signal); } finally { clearTimeout(tm); }
      if (my !== gen) return;
      const src = actx.createBufferSource(); src.buffer = buf; const g = actx.createGain(); g.gain.value = vol; src.connect(g).connect(actx.destination);
      const t = Math.max(actx.currentTime + 0.03, run.next); src.start(t); run.next = t + buf.duration + 0.12; run.srcs.push(src); run.live++; played++;
      src.onended = () => { run.live--; if (run.finished && run.live === 0) end(); };
      if (played === 1) EG.ms = Math.round(performance.now() - t0);
    }
    EG.ok = true; EG.err = ''; EG.fails = 0;
    run.finished = true; if (run.live === 0) end();
  } catch (e) {
    if (my !== gen) return;
    EG.err = String(e.message || e); if (!played) EG.fails = (EG.fails || 0) + 1; if ((EG.fails || 0) >= 3) EG.ok = false;   /* three failures in a row: stop trying until the owner picks it again */
    const rest = parts.slice(played).join(' '); playing?.stop?.(); playing = null; busy = false;
    if (rest) { q.unshift({ ...it, text: rest, fb: true }); next(); } else next();
  }
}
async function checkEdge() { try { const r = await fetch('/api/tts/status'); if (r.status === 404) { EG.avail = false; EG.availErr = 'server belum dimulai ulang (rute suara baru belum aktif)'; } else if (r.status === 401) { EG.avail = false; EG.availErr = 'sesi login habis; muat ulang halaman'; } else { const j = await r.json(); EG.avail = !!j.available; EG.availErr = j.error || ''; } } catch { EG.avail = false; EG.availErr = 'server tidak menjawab'; } if (EG.avail === false) EG.ok = false; else if (EG.ok === false && !EG.fails) EG.ok = null; return EG.avail; }
if (typeof document !== 'undefined' && typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:/.test(location.protocol)) checkEdge();

let humAt = 0, humCtx = null;
/** A short soft hummed phrase in the agent's own pitch (procedural, a few oscillator nodes, no model). Skipped while anyone is speaking. */
export function hum(agentId, closeness = 1) {
  if (!S.on || busy || q.length || typeof window === 'undefined') return false;
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

const AUDITION = 'Saya sedang luang. Semua tugas selesai sesuai target, dan sebagainya.';
let auditioning = 0;
/** Plays the same sentence once per strategy, announced by number, with the built-in voice. Resolves when finished or stopped. */
async function audition() {
  const my = ++auditioning; stopSpeaking();
  for (let i = 0; i < PRON.length; i++) {
    if (my !== auditioning) return;
    speak('uji', 'Nomor ' + (i + 1) + '.', { force: true, browserOnly: true, pron: 'none', profile: { ...profileFor('uji', 'female', 1), pitch: 1, rate: 1 } });
    speak('uji', AUDITION, { force: true, browserOnly: true, pron: PRON[i].id, profile: { ...profileFor('uji', 'female', 1), pitch: 1.1, rate: 1 } });
    for (let k = 0; k < 150 && my === auditioning && (busy || q.length || k < 5); k++) await new Promise((r) => setTimeout(r, 100));
  }
}

export const tts = {
  hum, audition, stopAudition: () => { auditioning++; stopSpeaking(); },
  pron: () => ({ strategy: PR.strategy, dict: { ...PR.dict }, options: PRON.map(({ id, label }) => ({ id, label })) }),
  setPron(patch) { if (patch.strategy && PRON.some((p) => p.id === patch.strategy)) PR.strategy = patch.strategy; if (patch.word !== undefined) { const w = String(patch.word).trim().toLowerCase(), v = String(patch.say || '').trim(); if (w && v) PR.dict[w] = v; else if (w) delete PR.dict[w]; } savePR(); },
  applyPron: (t) => applyPron(t, PR.strategy, PR.dict),
  checkEdge, edgeState: () => ({ ...EG, cached: ecache.size }),
  speak, stop: stopSpeaking, stopSpeaking, cleanText, profileFor,
  bind(fn) { lookup = fn; },
  available: () => !!ss(),
  voices: () => voices.map((v) => ({ name: v.name, lang: v.lang, local: v.localService })),
  state: () => ({ ...S, edge: { ...EG }, available: !!ss(), voiceCount: voices.length, hasIndonesian: hasId, voiceNames: voices.map((v) => v.name), speaking: busy, lastErr, ...stats }),
  isOn: () => S.on,
  profile: (id) => profileOf(id),
  set(patch) { if (patch.engine === 'edge') { EG.ok = null; EG.fails = 0; EG.err = ''; }
    if (patch.engine && patch.engine !== 'edge' && patch.engine !== 'browser') delete patch.engine;
    Object.assign(S, patch); S.vol = Math.min(1, Math.max(0, +S.vol || 0)); save(); if (!S.on) stopSpeaking(); return { ...S }; },
  /** test voice button: works even with the switch off, so people can hear it before enabling */
  test(agentId = 'owner', text = 'Halo, saya agen RAIVERSE. Hari ini ada dua belas tugas selesai, sembilan puluh lima persen sesuai target.') { stopSpeaking(); return speak(agentId, text, { force: true }); },
};
