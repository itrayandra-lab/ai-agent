// Rekam gaya komputasi (properti penting) semua elemen UI Kantor pada 5 ukuran x banyak keadaan, lalu bandingkan dua rekaman.
// Pakai: node scripts/snapshot-gaya.mjs rekam <port> <berkas.json> [tema]   |   node scripts/snapshot-gaya.mjs banding <a.json> <b.json>
// Tujuan: membuktikan penyatuan CSS tidak mengubah tampilan (CSS baru harus menghasilkan rekaman identik/lebih baik).
import fs from 'node:fs';
import { bukaChrome } from './lib/chrome-cdp.mjs';
import { ujiTataLetak } from './uji-tata-letak-kantor.mjs';
const PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight', 'margin', 'padding', 'zIndex', 'opacity', 'visibility', 'overflow', 'flexDirection', 'gridTemplateColumns', 'gap', 'color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'fontSize', 'fontWeight', 'lineHeight', 'transform', 'pointerEvents', 'backdropFilter', 'filter', 'alignItems', 'justifyContent', 'textAlign', 'whiteSpace'];
const JS = `(() => { if (!document.getElementById('snap-noanim')) { const s = document.createElement('style'); s.id = 'snap-noanim'; s.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(s); } void document.body.offsetHeight; const P = ${JSON.stringify(PROPS)}; const out = {}; const roots = ['.office-ov', '#sidebar', '#lpage', '.bottomnav', '.topbar'];
  for (const r of roots) for (const root of document.querySelectorAll(r)) for (const el of [root, ...root.querySelectorAll('*')]) { if (el.closest('.meter')) continue;
    if (/^(SCRIPT|STYLE|CANVAS|PATH|SVG|CIRCLE|RECT|G|LINE|POLYLINE|DEFS|USE)$/i.test(el.tagName) && el.tagName.toUpperCase() !== 'CANVAS') continue;
    const cs = getComputedStyle(el); const hid = cs.display === 'none'; const path = []; for (let n = el, i = 0; n && n.nodeType === 1 && i < 6; n = n.parentElement, i++) path.unshift(n.id ? '#' + n.id : n.tagName.toLowerCase() + (n.classList[0] ? '.' + n.classList[0] : ''));
    const key = path.join('>'); let k = key, c = 1; while (out[k]) k = key + '~' + (++c);
    out[k] = hid ? 'none' : P.map((p) => cs[p]).join('|'); } return JSON.stringify(out); })()`;
const [, , modo, a, b, tema = 'dark'] = process.argv;
if (modo === 'rekam') {
  const hasil = {}; const c = await bukaChrome();
  await ujiTataLetak({ port: a, peramban: c, tema, snap: async (cc, w, h, nama) => { hasil[`${w}x${h}:${nama}`] = JSON.parse(await cc.eval(JS)); } });
  await c.tutup(); fs.writeFileSync(b, JSON.stringify(hasil)); console.log('tersimpan', b, Object.keys(hasil).length, 'keadaan');
} else if (modo === 'banding') {
  const x = JSON.parse(fs.readFileSync(a)), y = JSON.parse(fs.readFileSync(b)); let beda = 0, total = 0; const per = {};
  for (const st of Object.keys(x).filter((s) => !s.endsWith(':halaman-pengaturan'))) for (const k of new Set([...Object.keys(x[st]), ...Object.keys(y[st] || {})])) { total++; const u = x[st][k], v = (y[st] || {})[k]; if (u !== v) { beda++; (per[st] ||= []).push(k + ' :: ' + (u === 'none' || v === 'none' || !u || !v ? `${u ? 'ada' : '-'}→${v ? 'ada' : '-'}` : u.split('|').map((q, i) => q === v.split('|')[i] ? null : `${PROPS[i]}: ${q} → ${v.split('|')[i]}`).filter(Boolean).join('; '))); } }
  console.log(`${beda} beda dari ${total} elemen-keadaan`); for (const [st, l] of Object.entries(per)) { console.log('\n' + st + ' (' + l.length + ')'); l.slice(0, 6).forEach((q) => console.log('  ' + q.slice(0, 260))); }
  process.exit(beda ? 1 : 0);
}
