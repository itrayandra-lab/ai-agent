// Pemindai layar pengguna biasa (bantuan tes, bukan tes). Tanpa pustaka luar: pemecah JavaScript sederhana + penyaring markup.
// Dipakai test/ui-awam.test.js. Jalur pengelola dikecualikan secara eksplisit (kamus-ui.js: DAFTAR_PUTIH_PENGELOLA), tidak diam-diam.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, DAFTAR_PUTIH_PENGELOLA } from '../public/js/kamus-ui.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const JS_DIR = path.join(ROOT, 'public/js');
export const CSS_FILES = ['app.css', 'knowledge.css', 'glass.css', 'identity.css'].map((f) => path.join(ROOT, 'public/css', f));
export { scan };

/** hapus wilayah pengelola dari views.js dan baris yang diberi tanda 3d (simbol milik dunia 3D) */
export function bersihkan(nama, src) {
  const [a, b] = DAFTAR_PUTIH_PENGELOLA.penanda;
  let out = ''; let i = 0;
  for (;;) {
    const s = src.indexOf(a, i);
    if (s < 0) { out += src.slice(i); break; }
    out += src.slice(i, s);
    const e = src.indexOf(b, s);
    if (e < 0) throw new Error(`${nama}: penanda pengelola tidak berpasangan`);
    out += '\n'.repeat((src.slice(s, e + b.length).match(/\n/g) || []).length);   // nomor baris tetap sama dengan berkas asli
    i = e + b.length;
  }
  return out.split('\n').map((l) => (/\/\*\s*(3d|kunci-data)/.test(l) ? '' : l)).join('\n');
}
export function layarPengguna() {
  const skip = new Set(DAFTAR_PUTIH_PENGELOLA.berkas);
  return fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && !skip.has(f)).sort().map((f) => ({ nama: f, src: bersihkan(f, fs.readFileSync(path.join(JS_DIR, f), 'utf8')) }));
}

/** semua literal teks (string biasa dan bagian teks template, termasuk yang bersarang di dalam ${}) dengan nomor baris */
export function literal(src) {
  const out = []; const n = src.length; let line = 1;
  const prevTok = { v: '' };
  const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|(^|[^\w$.])(return|typeof|case|in|of|delete|void|throw|new)$/;
  function str(q, i, startLine) {
    let t = ''; i++;
    while (i < n && src[i] !== q) { if (src[i] === '\\') { t += src[i + 1] || ''; i += 2; continue; } if (src[i] === '\n') line++; t += src[i++]; }
    out.push({ t, line: startLine }); return i + 1;
  }
  function tpl(i) {
    let t = ''; let ln = line; i++;
    const flush = () => { if (t) out.push({ t, line: ln, tpl: true }); t = ''; };
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { t += src[i + 1] || ''; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { flush(); i = code(i + 2, true); ln = line; continue; }
      if (src[i] === '\n') line++;
      t += src[i++];
    }
    flush(); return i + 1;
  }
  function code(i, inTpl) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const chunk = src.slice(i, e < 0 ? n : e + 2); line += (chunk.match(/\n/g) || []).length; i = e < 0 ? n : e + 2; continue; }
      if (c === "'" || c === '"') { i = str(c, i, line); prevTok.v = 'x'; continue; }
      if (c === '`') { i = tpl(i); prevTok.v = 'x'; continue; }
      if (c === '/') {
        const before = src.slice(Math.max(0, i - 12), i).trimEnd();
        if (!before || REGEX_AFTER.test(before)) { let j = i + 1; let cls = false; while (j < n && (src[j] !== '/' || cls) && src[j] !== '\n') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; } i = j + 1; while (/[a-z]/i.test(src[i] || '')) i++; continue; }
      }
      if (inTpl) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) return i + 1; depth--; } }
      i++;
    }
    return i;
  }
  code(0, false);
  return out;
}

const ATTR = /\b(?:aria-label|aria-description|title|placeholder|alt|label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
/** teks yang benar-benar dilihat atau dibacakan: isi di luar tag + atribut aria-label/title/placeholder/alt */
export function teksTampil(t) {
  const parts = [];
  let m; ATTR.lastIndex = 0;
  while ((m = ATTR.exec(t))) parts.push(m[1] ?? m[2]);
  const luar = t.replace(/<[^>]*>/g, ' ').replace(/<[^>]*$/, ' ').replace(/^[^<]*>/, ' ');
  parts.push(luar);
  return parts.join(' | ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}
const SEPERTI_ID = /^[\w:.#/\-?=&%@*+,;[\]()!|^~$'"\\{}]*$/;
const MEREK = /R\s*AI\s*VERSE\s+AGENT|RAY\s+AGENT\s+OFFICE/gi;   // nama merek/judul sinematik, bukan jargon
export function temuan(src, { cek }) {
  const hasil = [];
  for (const { t, line, tpl } of literal(src)) {
    const v = teksTampil(t).replace(MEREK, 'RAIVERSE');
    // string pendek mirip pengenal (kunci, jalur) dilewati; potongan templat markup selalu diperiksa
    if (!v || (!tpl && SEPERTI_ID.test(v) && !/\s/.test(v) && !/^[A-Z]/.test(v))) continue;
    if (tpl && (/^\s*\/[\w/.\-]*\s*$/.test(t) || /^[\s"']*[\w-]+=["']?\s*$/.test(t))) continue;   // potongan jalur API atau atribut yang terbelah oleh ${}
    const r = cek(v);
    if (r && r.length) hasil.push({ line, teks: v.slice(0, 120), hit: r });
  }
  return hasil;
}

export const EMOJI = /\p{Extended_Pictographic}/u;
export const emojiTemuan = (src) => src.split('\n').flatMap((l, i) => (EMOJI.test(l) ? [{ line: i + 1, teks: l.trim().slice(0, 110) }] : []));

// ───── warna merah
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; const l = (mx + mn) / 2;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  return { h, s, l };
}
export function merah(r, g, b) { const { h, s, l } = hsl(r, g, b); return (h <= 12 || h >= 345) && s >= 0.45 && l >= 0.22 && l <= 0.76; }
export function warnaMerah(src0) {
  const src = src0.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));   // komentar tidak dihitung
  const out = [];
  src.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
      let h = m[1]; if (![3, 4, 6, 8].includes(h.length)) continue;
      if (h.length <= 4) h = [...h].slice(0, 3).map((x) => x + x).join('');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      if (merah(r, g, b)) out.push({ line: i + 1, warna: m[0], teks: l.trim().slice(0, 100) });
    }
    for (const m of l.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) if (merah(+m[1], +m[2], +m[3])) out.push({ line: i + 1, warna: m[0], teks: l.trim().slice(0, 100) });
    for (const m of l.matchAll(/(?<![\w-])(red|crimson|firebrick|tomato|darkred|indianred)(?![\w-])/gi)) if (!/\/\*.*\*\//.test(l.slice(0, m.index))) out.push({ line: i + 1, warna: m[0], teks: l.trim().slice(0, 100) });
  });
  return out;
}
