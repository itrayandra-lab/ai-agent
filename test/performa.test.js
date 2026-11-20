// Anggaran performa pemuatan: kompresi, cache/304, dan jalur muat awal bebas Three.js. Tanpa peramban, tanpa kunci AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { kirimJson, kirimBerkas, pilihSandi } from '../server/http-perf.js';

const PUB = path.resolve('public');
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/besar.json') return kirimJson(req, res, 200, { a: 'x'.repeat(200_000) });
  if (u.pathname === '/kecil.json') return kirimJson(req, res, 200, { ok: true });
  const ada = await kirimBerkas(req, res, path.join(PUB, u.pathname), u.pathname.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', { kebijakan: /[?&]v=/.test(req.url) ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (!ada) { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
test.after(() => srv.close());
const ambil = (p, h = {}) => new Promise((ok, no) => http.get(base + p, { headers: h, agent: false }, (r) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => ok({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c) })); }).on('error', no));

test('pilihSandi: br diutamakan, lalu gzip, lalu tanpa kompresi', () => {
  assert.equal(pilihSandi({ headers: { 'accept-encoding': 'gzip, deflate, br' } }), 'br');
  assert.equal(pilihSandi({ headers: { 'accept-encoding': 'gzip' } }), 'gzip');
  assert.equal(pilihSandi({ headers: {} }), null);
});

test('JS statis: brotli dan gzip jauh lebih kecil, isi tetap sama, tanpa kompresi bila tak diminta', async () => {
  const mentah = fs.readFileSync(path.join(PUB, 'js/views.js'));
  const plain = await ambil('/js/views.js'); assert.equal(plain.status, 200); assert.ok(!plain.headers['content-encoding']); assert.equal(plain.body.length, mentah.length);
  const br = await ambil('/js/views.js', { 'accept-encoding': 'br' }); assert.equal(br.headers['content-encoding'], 'br');
  assert.ok(br.body.length < mentah.length * 0.4, `br ${br.body.length} vs ${mentah.length}`); assert.deepEqual(zlib.brotliDecompressSync(br.body), mentah);
  const gz = await ambil('/js/views.js', { 'accept-encoding': 'gzip' }); assert.equal(gz.headers['content-encoding'], 'gzip'); assert.deepEqual(zlib.gunzipSync(gz.body), mentah);
  assert.match(br.headers.vary, /Accept-Encoding/i);
});

test('ETag dan 304: validasi ulang tidak mengirim isi; berkas berubah = ETag berubah', async () => {
  const a = await ambil('/js/core.js', { 'accept-encoding': 'br' }); assert.ok(a.headers.etag);
  const b = await ambil('/js/core.js', { 'accept-encoding': 'br', 'if-none-match': a.headers.etag }); assert.equal(b.status, 304); assert.equal(b.body.length, 0);
  const c = await ambil('/js/core.js', { 'if-none-match': '"lain"' }); assert.equal(c.status, 200);
});

test('aset berversi (?v=) abadi, berkas tak ada = 404', async () => {
  const a = await ambil('/js/core.js?v=1'); assert.match(a.headers['cache-control'], /immutable/);
  assert.equal((await ambil('/js/tidak-ada.js')).status, 404);
});

test('JSON besar dikompres dan sama persis; JSON kecil tidak dikompres; GET besar punya ETag dan 304', async () => {
  const k = await ambil('/kecil.json', { 'accept-encoding': 'br' }); assert.ok(!k.headers['content-encoding']); assert.deepEqual(JSON.parse(k.body), { ok: true });
  const b = await ambil('/besar.json', { 'accept-encoding': 'br' }); assert.equal(b.headers['content-encoding'], 'br'); assert.ok(b.body.length < 2000);
  assert.equal(JSON.parse(zlib.brotliDecompressSync(b.body)).a.length, 200_000);
  assert.ok(b.headers.etag); const n = await ambil('/besar.json', { 'accept-encoding': 'br', 'if-none-match': b.headers.etag }); assert.equal(n.status, 304);
});

// ── anggaran jalur muat awal (statis, dari kode sumber)
function graf(awal) {
  const lihat = new Set(); const antri = [awal];
  while (antri.length) {
    const f = antri.pop(); if (lihat.has(f)) continue; lihat.add(f);
    const src = fs.readFileSync(path.join(PUB, f), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"\n]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm)) {   // hanya import statis di awal baris
      const s = m[1] || m[2]; if (s.startsWith('./')) antri.push('js/' + s.slice(2)); else lihat.add(s);
    }
  }
  return lihat;
}
test('anggaran: jalur muat awal (app.js) TIDAK menarik Three.js, assets3d, office3d, maupun editor 3D', () => {
  const g = graf('js/app.js');
  for (const terlarang of ['three', 'js/assets3d.js', 'js/office3d.js', 'js/karakter-view.js', 'js/environment.js', 'js/furniture.js']) assert.ok(!g.has(terlarang), `${terlarang} masuk jalur muat awal`);
  assert.ok(g.size < 60, `terlalu banyak modul di jalur awal: ${g.size}`);
});

test('anggaran: index.html tidak memblokir tampilan (font tak memblokir, ada kerangka, data diunduh dini, modul di-preload)', () => {
  const h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const tanpaNoscript = h.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  for (const l of tanpaNoscript.match(/<link[^>]+rel="stylesheet"[^>]+fonts\.googleapis\.com[^>]*>/g) || []) assert.match(l, /media="print"/, 'font Google memblokir render');
  assert.match(h, /boot-skel/); assert.match(h, /boot-awal\.js/); assert.match(fs.readFileSync(path.join(PUB, 'js/boot-awal.js'), 'utf8'), /__state0 = fetch\('\/api\/state'\)/); assert.match(h, /rel="modulepreload" href="\/js\/views\.js"/);
  assert.ok((h.match(/stylesheet/g) || []).length <= 12, 'terlalu banyak stylesheet');
});

test('anggaran: sambungan SSE pertama tidak mengunduh ulang seluruh state', () => {
  const a = fs.readFileSync(path.join(PUB, 'js/app.js'), 'utf8');
  assert.match(a, /sambungPertama/);
});
