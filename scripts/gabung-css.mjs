// Gabungkan aturan CSS berselektor sama di dalam satu konteks (top-level / satu blok @media), tanpa menumpuk versi.
// Pakai: node scripts/gabung-css.mjs <masuk.css> <keluar.css> [first|last]   (posisi aturan gabungan: kemunculan pertama/terakhir)
// Deklarasi terakhir menang; !important mengalahkan non-important. Komentar versi (v4..v12) dibuang; komentar lain dipertahankan di atas aturan pertama.
import fs from 'node:fs';
const [, , inp, out, pos = 'last'] = process.argv;
let src = fs.readFileSync(inp, 'utf8');
function parse(s) {
  const items = []; let i = 0, cm = [];
  while (i < s.length) {
    const rest = s.slice(i); const ws = /^\s+/.exec(rest); if (ws) { i += ws[0].length; continue; }
    if (rest.startsWith('/*')) { const e = s.indexOf('*/', i) + 2; cm.push(s.slice(i, e)); i = e; continue; }
    let j = i, d = 0; while (j < s.length && s[j] !== '{' && s[j] !== ';') j++;
    if (s[j] === ';') { items.push({ t: 'raw', text: s.slice(i, j + 1) }); i = j + 1; continue; }
    const head = s.slice(i, j).trim(); let k = j + 1; d = 1;
    while (k < s.length && d) { if (s[k] === '{') d++; else if (s[k] === '}') d--; else if (s.startsWith('/*', k)) { k = s.indexOf('*/', k) + 1; } k++; }
    const body = s.slice(j + 1, k - 1);
    if (/^@(media|supports|container)/.test(head)) items.push({ t: 'at', head, items: parse(body), cm });
    else if (head.startsWith('@')) items.push({ t: 'raw', text: s.slice(i, k) });
    else items.push({ t: 'rule', sel: head.replace(/\s+/g, ' '), decls: decls(body), cm });
    cm = []; i = k;
  }
  return items;
}
function decls(b) { const o = []; b = b.replace(/\/\*[\s\S]*?\*\//g, ''); let cur = '', p = 0, q = null; for (const ch of b) { if (q) { cur += ch; if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; } if (ch === '(') p++; if (ch === ')') p--; if (ch === ';' && !p) { o.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) o.push(cur); return o.map((x) => { const c = x.indexOf(':'); const prop = x.slice(0, c).trim(), val = x.slice(c + 1).trim(); const imp = /!important\s*$/.test(val); return { prop, val: val.replace(/\s*!important\s*$/, ''), imp }; }).filter((x) => x.prop); }
function merge(items) {
  const keep = items.map((x) => (x.t === 'at' ? { ...x, items: merge(x.items) } : x));
  const idx = new Map(); const res = [];
  for (const it of keep) {
    if (it.t !== 'rule') { res.push(it); continue; }
    if (!idx.has(it.sel)) { idx.set(it.sel, { ...it, decls: [...it.decls], cm: [...it.cm] }); res.push(idx.get(it.sel)); continue; }
    const m = idx.get(it.sel);
    for (const d of it.decls) { const e = m.decls.findIndex((x) => x.prop === d.prop); if (e < 0) m.decls.push(d); else if (d.imp || !m.decls[e].imp) m.decls[e] = d; }
    m.cm.push(...it.cm);
    if (pos === 'last') { res.splice(res.indexOf(m), 1); res.push(m); }
  }
  return res;
}
const clean = (c) => c.filter((x) => !/v\d+\b|═══/.test(x));
const ser = (items, ind = '') => items.map((it) => it.t === 'raw' ? ind + it.text : it.t === 'at' ? `${clean(it.cm).map((c) => ind + c + '\n').join('')}${ind}${it.head} {\n${ser(it.items, ind + '  ')}\n${ind}}` : `${clean(it.cm).map((c) => ind + c + '\n').join('')}${ind}${it.sel} { ${it.decls.map((d) => `${d.prop}: ${d.val}${d.imp ? ' !important' : ''}`).join('; ')}; }`).join('\n');
const tree = merge(parse(src));
fs.writeFileSync(out, ser(tree) + '\n');
console.log(`${inp}: ${Buffer.byteLength(src)} B -> ${out}: ${fs.statSync(out).size} B`);
