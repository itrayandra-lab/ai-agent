#!/usr/bin/env node
// Inventaris kode (baca-saja): berkas JS/CSS, impor, rute API (definisi vs pemanggil), id DOM ganda,
// selektor CSS yang didefinisikan di banyak berkas, jumlah !important, modul tanpa pemanggil.
// Pakai: node scripts/inventaris.mjs [--json]
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const walk = (d, ext, out = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'assets', '_arsip-kode', '_arsip-sampah'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p, ext, out); else if (ext.some((e) => f.name.endsWith(e))) out.push(p); } return out; };
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');
const serverJs = walk(path.join(root, 'server'), ['.js']);
const pubJs = walk(path.join(root, 'public/js'), ['.js']);
const css = walk(path.join(root, 'public/css'), ['.css']);
const tests = walk(path.join(root, 'test'), ['.js', '.mjs']);
const html = read(path.join(root, 'public/index.html'));
const R = {};

// 1. berkas
R.berkas = [...serverJs, ...pubJs, ...css].map((p) => { const t = read(p); return { berkas: rel(p), byte: Buffer.byteLength(t), baris: t.split('\n').length, important: (t.match(/!important/g) || []).length }; });

// 2. impor server -> modul tanpa pemanggil (server: import; klien: <script src> + import)
const importers = {};
for (const p of [...serverJs, ...tests, ...walk(path.join(root, 'scripts'), ['.mjs'])]) {
  const t = read(p); for (const m of t.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) { const target = path.resolve(path.dirname(p), m[1]); const k = rel(fs.existsSync(target) ? target : target + '.js'); (importers[k] ||= new Set()).add(rel(p)); }
}
R.serverTanpaPemanggil = serverJs.map(rel).filter((f) => !importers[f] && f !== 'server/index.js');
const htmlScripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1].replace(/\?.*$/, '').replace(/^\//, 'public/'));
const jsImp = {};
for (const p of pubJs) { const t = read(p); for (const m of t.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) { const k = rel(path.resolve(path.dirname(p), m[1])); (jsImp[k] ||= new Set()).add(rel(p)); } }
R.klienTanpaPemanggil = pubJs.map(rel).filter((f) => !htmlScripts.includes(f) && !jsImp[f]);
const htmlCss = [...html.matchAll(/<link[^>]*href="([^"]+\.css)/g)].map((m) => 'public' + (m[1].startsWith('/') ? '' : '/') + m[1].replace(/\?.*$/, ''));
R.cssTidakDipasang = css.map(rel).filter((f) => !htmlCss.includes(f));
R.urutanCss = htmlCss;

// 3. rute API: definisi vs pemanggil
const defs = new Map();
const addDef = (m, p, f) => { const k = `${m} ${p}`; (defs.get(k) || defs.set(k, new Set()).get(k)).add(f); };
for (const p of serverJs) { const t = read(p);
  for (const m of t.matchAll(/\bon\(\s*'(GET|POST|PUT|PATCH|DELETE)'\s*,\s*'(\/api\/[^']*)'/g)) addDef(m[1], m[2], rel(p));
  for (const m of t.matchAll(/\[\s*'(GET|POST|PUT|PATCH|DELETE)'\s*,\s*'(\/api\/[^']*)'/g)) addDef(m[1], m[2], rel(p)); }
const norm = (s) => s.replace(/:[a-zA-Z]+/g, ':x').replace(/\$\{[^}]*\}/g, ':x').replace(/\?.*$/, '');
const callers = new Map();
for (const p of [...pubJs, ...tests, ...walk(path.join(root, 'scripts'), ['.mjs']), ...walk(path.join(root, 'integrations'), ['.js', '.mjs'])]) { const t = read(p);
  for (const m of t.matchAll(/['"`](\/api\/[A-Za-z0-9_\-/:${}.?=&+,() '"]*?)['"`]/g)) { const k = norm(m[1]); (callers.get(k) || callers.set(k, new Set()).get(k)).add(rel(p)); } }
R.rute = [...defs].map(([k, fs_]) => { const [m, pth] = k.split(' '); const n = norm(pth); const c = [...callers].filter(([cp]) => cp === n || cp.startsWith(n + '/') || n.startsWith(cp + '/') || (n.endsWith('/:x') && cp.startsWith(n.slice(0, -2)))).flatMap(([, v]) => [...v]); return { rute: k, definisi: [...fs_], pemanggil: [...new Set(c)].length }; });
R.ruteYatim = R.rute.filter((r) => r.pemanggil === 0).map((r) => r.rute);
const defPaths = new Set(R.rute.map((r) => norm(r.rute.split(' ')[1])));
R.pemanggilTanpaRute = [...callers].filter(([k]) => ![...defPaths].some((d) => d === k || d.startsWith(k + '/') || k.startsWith(d)) && !/^\/api\/(admin|saluran|automations|llm-gate|stream|files)/.test(k)).map(([k, v]) => `${k}  <- ${[...v].slice(0, 2).join(', ')}`);

// 4. id DOM: ganda di index.html, dan id dibuat di JS lebih dari satu berkas
const ids = {}; for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids[m[1]] = (ids[m[1]] || 0) + 1;
R.idGandaHtml = Object.entries(ids).filter(([, n]) => n > 1).map(([k, n]) => `${k} x${n}`);
const jsIds = {}; for (const p of pubJs) { for (const m of read(p).matchAll(/\bid=\\?["']([A-Za-z][\w-]*)/g)) (jsIds[m[1]] ||= new Set()).add(rel(p)); }
R.idDibuatDiBanyakBerkas = Object.entries(jsIds).filter(([, v]) => v.size > 1).map(([k, v]) => `${k}: ${[...v].join(', ')}`);

// 5. selektor CSS saling menimpa: selektor identik di >1 berkas / >1 kali
const sel = {};
for (const p of css) { const t = read(p).replace(/\/\*[\s\S]*?\*\//g, ''); for (const m of t.matchAll(/(?:^|})\s*([^{}@][^{}]*)\{/g)) { for (const s of m[1].split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean)) { (sel[s] ||= []).push(rel(p)); } } }
R.selektorGanda = Object.entries(sel).filter(([, v]) => v.length > 1).map(([s, v]) => ({ selektor: s, kali: v.length, berkas: [...new Set(v)] })).sort((a, b) => b.kali - a.kali);
R.marka = { versiOffice: (read(path.join(root, 'public/css/office-layout.css')).match(/\/\*[^*]*v\d+[^*]*\*\//g) || []).length };

if (process.argv.includes('--json')) console.log(JSON.stringify(R, null, 1));
else {
  const tot = (a) => a.reduce((s, x) => s + x.byte, 0);
  console.log(`JS server ${serverJs.length} berkas; JS klien ${pubJs.length}; CSS ${css.length}; tes ${tests.length}`);
  console.log(`Ukuran: CSS ${tot(R.berkas.filter((b) => b.berkas.endsWith('.css')))} B; JS klien ${tot(R.berkas.filter((b) => b.berkas.startsWith('public/js')))} B; JS server ${tot(R.berkas.filter((b) => b.berkas.startsWith('server/')))} B`);
  console.log('!important per CSS:', R.berkas.filter((b) => b.important).map((b) => `${b.berkas}=${b.important}`).join(', '));
  for (const k of ['serverTanpaPemanggil', 'klienTanpaPemanggil', 'cssTidakDipasang', 'ruteYatim', 'pemanggilTanpaRute', 'idGandaHtml', 'idDibuatDiBanyakBerkas']) console.log(`\n## ${k} (${R[k].length})\n` + R[k].map((x) => '- ' + x).join('\n'));
  console.log(`\n## selektorGanda (${R.selektorGanda.length}) — 25 teratas\n` + R.selektorGanda.slice(0, 25).map((s) => `- ${s.kali}x ${s.selektor}  [${s.berkas.join(', ')}]`).join('\n'));
  console.log('\nmarka versi office-layout:', R.marka.versiOffice);
}
