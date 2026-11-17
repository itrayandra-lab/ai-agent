// Markdown → HTML aman: judul, daftar, tabel, kode (tombol salin), kutipan, centang, [[wikilink]], grafik ```chart.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, alias) => `<a class="wikilink" data-note="${t.trim()}">${alias || t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|\s)_([^_]+)_(?=\s|$|[.,!?])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '').slice(0, 48)}</a>`);
  s = s.replace(/(^|\s)#([\w-]{2,})/g, '$1<span class="tag">#$2</span>');
  return s;
}

/** kalimat bersambung "(1) a; (2) b; (3) c" atau "1) a 2) b" → daftar bernomor; "• x • y" → daftar poin */
function listify(text) {
  return text.split('\n').map((ln) => {
    if (/^\s*([-*+•]|\d+[.)])\s/.test(ln) || ln.length < 40) return ln;
    const re = /(?:^|[\s:;,.])\(?(\d{1,2})[.)]\s+(?=\S)/g;
    const marks = []; let m;
    while ((m = re.exec(ln))) {
      const lead = m[0].length - m[0].replace(/^[\s:;,.]+/, '').length;
      marks.push({ n: +m[1], at: m.index + lead, end: re.lastIndex });
    }
    const seq = marks.length >= 2 && marks[0].n === 1 && marks.every((k, i) => k.n === i + 1);
    if (!seq) return ln.replace(/\s•\s+/g, '\n- ').replace(/^•\s+/, '- ');
    const head = ln.slice(0, marks[0].at).replace(/[\s:;,]+$/, '');
    const items = marks.map((k, i) => ln.slice(k.end, marks[i + 1] ? marks[i + 1].at : undefined).replace(/^[\s(]+|[\s;,.]+$/g, ''));
    return (head ? head + ':\n\n' : '') + items.map((x, i) => `${i + 1}. ${x}`).join('\n');
  }).join('\n');
}

const PAL = ['#6d6cf5', '#f08a4b', '#37b79a', '#e65c8a', '#4aa3e8', '#c9a227', '#9b6cf5', '#7cae4b'];
const fmt = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}rb` : String(Math.round(v * 100) / 100));

/** grafik SVG ringan dari JSON: {type: bar|line|pie|donut, title, labels[], data[] | series[{name,data[]}]} */
export function chartHtml(spec) {
  let c;
  try { c = typeof spec === 'string' ? JSON.parse(spec) : spec; } catch { return null; }
  if (!c || typeof c !== 'object') return null;
  const labels = (c.labels || []).map(String).slice(0, 24);
  const series = (c.series || [{ name: '', data: c.data || [] }]).map((x) => ({ name: String(x.name || ''), data: (x.data || []).map(Number).slice(0, 24) })).filter((x) => x.data.length && x.data.every(Number.isFinite));
  if (!series.length) return null;
  const type = ['bar', 'line', 'pie', 'donut'].includes(c.type) ? c.type : 'bar';
  const n = Math.max(...series.map((x) => x.data.length));
  const lab = (i) => esc(labels[i] ?? String(i + 1));
  const title = c.title ? `<div class="chart-t">${esc(c.title)}</div>` : '';
  if (type === 'pie' || type === 'donut') {
    const d = series[0].data.map((v) => Math.max(0, v));
    const tot = d.reduce((a, b) => a + b, 0) || 1;
    let a0 = -Math.PI / 2;
    const pt = (a, r) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
    const arcs = d.map((v, i) => {
      const a1 = a0 + (v / tot) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const shape = v / tot > 0.9999 ? `<circle cx="60" cy="60" r="56" fill="${PAL[i % 8]}"/>` : `<path d="M60 60 L${pt(a0, 56)} A56 56 0 ${big} 1 ${pt(a1, 56)} Z" fill="${PAL[i % 8]}"/>`;
      a0 = a1;
      return shape;
    }).join('');
    const rows = d.map((v, i) => `<span><i style="background:${PAL[i % 8]}"></i>${lab(i)} <b>${fmt(v)}</b> · ${Math.round((v / tot) * 100)}%</span>`).join('');
    return `<div class="chart">${title}<div class="chart-pie"><svg viewBox="0 0 120 120" width="120" height="120">${arcs}${type === 'donut' ? '<circle cx="60" cy="60" r="30" class="chart-hole"/>' : ''}</svg><div class="chart-lg v">${rows}</div></div></div>`;
  }
  const W = 360; const H = 170; const L = 36; const B = 24; const T = 8; const R = 8;
  const all = series.flatMap((x) => x.data);
  const mx = Math.max(...all, 0); const mn = Math.min(...all, 0); const span = mx - mn || 1;
  const y = (v) => T + (H - T - B) * (1 - (v - mn) / span);
  const gw = (W - L - R) / n;
  const grid = [0, 0.5, 1].map((t) => { const v = mn + span * t; return `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="chart-g"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="chart-x">${fmt(v)}</text>`; }).join('');
  const xl = Array.from({ length: n }, (_, i) => (n <= 8 || i % Math.ceil(n / 8) === 0 ? `<text x="${(L + gw * (i + 0.5)).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="chart-x">${lab(i).slice(0, 10)}</text>` : '')).join('');
  let body = '';
  if (type === 'line') {
    body = series.map((x, k) => {
      const pts = x.data.map((v, i) => [L + gw * (i + 0.5), y(v)]);
      return `<polyline fill="none" stroke="${PAL[k % 8]}" stroke-width="2.2" stroke-linejoin="round" points="${pts.map((p) => p.map((q) => q.toFixed(1)).join(',')).join(' ')}"/>` + pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${PAL[k % 8]}"><title>${lab(i)}: ${fmt(x.data[i])}</title></circle>`).join('');
    }).join('');
  } else {
    const bw = Math.min(34, (gw * 0.78) / series.length);
    body = series.map((x, k) => x.data.map((v, i) => {
      const x0 = L + gw * i + (gw - bw * series.length) / 2 + bw * k;
      const h = Math.abs(y(v) - y(0));
      return `<rect x="${x0.toFixed(1)}" y="${y(Math.max(v, 0)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="3" fill="${PAL[k % 8]}"><title>${lab(i)}: ${fmt(v)}</title></rect>`;
    }).join('')).join('');
  }
  const legend = series.length > 1 ? `<div class="chart-lg">${series.map((x, i) => `<span><i style="background:${PAL[i % 8]}"></i>${esc(x.name || `Seri ${i + 1}`)}</span>`).join('')}</div>` : '';
  return `<div class="chart">${title}<svg viewBox="0 0 ${W} ${H}" class="chart-svg">${grid}${body}${xl}</svg>${legend}</div>`;
}

export function md(src = '') {
  const lines = listify(String(src).replace(/\r/g, '')).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const lang = (l.match(/^```\s*([\w+-]*)/) || [])[1] || '';
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (lang === 'chart') { const h = chartHtml(buf.join('\n')); if (h) { out.push(h); continue; } }
      out.push(`<div class="codebox"><div class="codebar"><span>${esc(lang || 'kode')}</span><button type="button" data-copy>Salin</button></div><pre><code>${esc(buf.join('\n'))}</code></pre></div>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const row = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(l);
      const al = row(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
      i += 2; const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(row(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${al[k] ? ` style="text-align:${al[k]}"` : ''}>${inline(c)}</${tag}>`;
      out.push(`<div class="tablewrap"><table><thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, k) => cell('td', c, k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      const first = buf[0] || '';
      const co = first.match(/^\[!(tip|info|warn|warning|note|penting)\]\s*(.*)/i);
      if (co) { buf[0] = co[2]; out.push(`<div class="callout ${co[1].toLowerCase()}">${md(buf.join('\n'))}</div>`); continue; }
      out.push(`<blockquote>${md(buf.join('\n'))}</blockquote>`); continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
      const li = items.map((x) => {
        const c = x.match(/^\[( |x)\]\s*(.*)/i);
        return c ? `<li class="check"><input type="checkbox" disabled ${c[1] !== ' ' ? 'checked' : ''}> ${inline(c[2])}</li>` : `<li>${inline(x)}</li>`;
      }).join('');
      out.push(ordered ? `<ol>${li}</ol>` : `<ul>${li}</ul>`); continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+\.)\s|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

export const linksOf = (content) => [...String(content).matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((m) => m[1].trim());
