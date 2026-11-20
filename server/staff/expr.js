// Ekspresi n8n untuk staf: pembungkus aman + pustaka pembantu kecil + pemeriksa larangan.
// Teks dari pengguna TIDAK PERNAH dimasukkan ke ekspresi; ia hanya dibaca lewat `input.<kunci>` sebagai data.
// Penulis spesifikasi hanya menulis SATU ekspresi JavaScript murni; pembungkus menyediakan `input`, `v` (hasil langkah sebelumnya)
// dan pembantu (rp, num, baris, csv, tabel, cut, esc, tgl, plain, ambil, meta). Semua ditulis dengan String.raw supaya garis miring tidak rusak.

export const HELPERS = {
  rp: String.raw`const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');`,
  num: String.raw`const num = (x) => { let s = String(x ?? '').replace(/rp/gi, '').replace(/\s/g, ''); if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.'); else s = s.replace(/,/g, ''); const n = Number(s); return Number.isFinite(n) ? n : 0; };`,
  baris: String.raw`const baris = (t) => String(t ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);`,
  csv: String.raw`const csv = (rows) => rows.map((r) => r.map((c) => { if (typeof c === 'number') return String(c); let s = String(c ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(',')).join('\n');`,
  tabel: String.raw`const tabel = (h, rows) => '| ' + h.join(' | ') + ' |\n|' + h.map(() => '---').join('|') + '|\n' + rows.map((r) => '| ' + r.map((c) => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ') + ' |').join('\n');`,
  cut: String.raw`const cut = (s, n) => String(s ?? '').slice(0, n);`,
  esc: String.raw`const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');`,
  tgl: String.raw`const tgl = (d) => new Date(d || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });`,
  plain: String.raw`const plain = (h) => String(h ?? '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();`,
  ambil: String.raw`const ambil = (h, t) => { const m = String(h ?? '').match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''; };`,
  meta: String.raw`const meta = (h, n) => { const m = String(h ?? '').match(new RegExp('<meta[^>]+(?:name|property)=["\']' + n + '["\'][^>]*>', 'i')); const c = m && m[0].match(/content=["']([^"']*)["']/i); return c ? c[1] : ''; };`,
  hitungTag: String.raw`const hitungTag = (h, t) => (String(h ?? '').match(new RegExp('<' + t + '[\\s>]', 'gi')) || []).length;`,
};
export const HELPER_NAMES = Object.keys(HELPERS);

// larangan untuk ekspresi karangan penulis spesifikasi
const BAD = [
  [/\}\}|\{\{/, 'tidak boleh memuat kurung ganda'],
  [/\$env|\$vars|\$secrets|\$execution|\$workflow|\$node|\$prevNode|\$input|\$items|\$parameter|\$credentials/, 'memakai variabel n8n yang dilarang'],
  [/\$\s*\(/, 'tidak boleh merujuk langkah lain lewat $()'],
  [/\bprocess\b|require\s*\(|\bimport\b|child_process|globalThis|\bglobal\b|\bwindow\b|\bthis\b|\beval\s*\(|\bFunction\b|\bfunction\b|constructor|__proto__|prototype|\bfetch\s*\(|XMLHttp|WebSocket|setTimeout|setInterval|\bfs\b|\bawait\b|\byield\b|\bclass\b/, 'memuat kode yang dilarang'],
  [/\bwhile\b|\bfor\b|\bdo\s*\{|\.repeat\s*\(|\bArray\s*\(|Array\.from|new\s+Array|\.fill\s*\(|\.padStart\s*\(\s*[^)]*\d{4,}|\.padEnd\s*\(\s*[^)]*\d{4,}/, 'memuat perulangan atau alokasi besar yang dilarang (pakai map/reduce/filter)'],
  [/\\u00|\\x[0-9a-f]{2}/i, 'tidak boleh memakai karakter lolos tersembunyi'],
];
/** Mengembalikan alasan penolakan, atau '' bila ekspresi aman. */
export function badExpr(expr) {
  const s = String(expr ?? '');
  if (!s.trim()) return 'kosong';
  if (s.length > 4000) return 'terlalu panjang (maks 4000 karakter)';
  for (const [re, why] of BAD) if (re.test(s)) return why;
  return '';
}

const usedHelpers = (...exprs) => { const all = exprs.join('\n'); return HELPER_NAMES.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(all)).map((n) => HELPERS[n]).join(' '); };
/** `}}` dalam hasil rakitan dipecah agar tidak dibaca sebagai penutup ekspresi. */
export const sp = (s) => String(s).replace(/\}\}/g, '} }').replace(/\{\{/g, '{ {');
const base = (extra = '') => `const input = $json.input || {};${extra}`;

/** Isi JavaScript (tanpa pembungkus n8n) dari satu ekspresi hanya-baca; dirangkai ke dalam ekspresi lain lalu dibungkus `raw`. */
export const inner = (expr) => `(() => { ${usedHelpers(expr)} ${base(' const v = $json.v || {};')} return (${expr}); })()`;
/** Satu ekspresi nilai (hanya-baca): `={{ ... }}`. */
export const value = (expr) => '={{ ' + sp(inner(expr)) + ' }}';
/** Beberapa isian berurutan ke `v` (isian belakangan boleh membaca isian depan lewat `v.nama`). */
export function accumulate(fields) {
  const exprs = Object.values(fields);
  const body = Object.entries(fields).map(([k, e]) => `v.${k} = (${e});`).join(' ');
  return '={{ ' + sp(`(() => { ${usedHelpers(...exprs)} ${base(' const v = Object.assign({}, $json.v);')} ${body} return v; })()`) + ' }}';
}
/** Ekspresi tetap buatan kompiler (bukan karangan penulis) tanpa pembungkus. */
export const raw = (js) => '={{ ' + sp(js) + ' }}';
export const lit = (s) => raw(JSON.stringify(String(s)));
