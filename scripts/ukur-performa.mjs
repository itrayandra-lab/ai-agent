// Ukur performa pemuatan dengan Chrome headless (CDP). Server uji terisolasi, TANPA kunci AI.
// Pakai: node scripts/ukur-performa.mjs <port> [hash=#office] [lebar=1440] [tinggi=900]
// Keluaran: JSON (dingin = profil baru; hangat = muat ulang). Angka headless (swiftshader) untuk perbandingan sebelum/sesudah, bukan GPU asli.
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';

const [port = '4551', hash = '#office', w = '1440', h = '900'] = process.argv.slice(2);
const AMBIL = String.raw`(async () => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
  const res = performance.getEntriesByType('resource');
  const jenis = (r) => /\.(glb)/.test(r.name) ? 'glb' : /\.(js|mjs)(\?|$)/.test(r.name) ? 'js' : /\.css/.test(r.name) ? 'css' : /\/api\//.test(r.name) ? 'api' : /\.(png|webp|svg|jpg)/.test(r.name) ? 'img' : /font|woff/.test(r.name) ? 'font' : 'lain';
  const per = {};
  for (const r of res) { const k = jenis(r); const o = per[k] ||= { n: 0, transfer: 0, encoded: 0, decoded: 0 }; o.n++; o.transfer += r.transferSize; o.encoded += r.encodedBodySize; o.decoded += r.decodedBodySize; }
  const state = res.find((r) => /\/api\/state/.test(r.name));
  const lcp = await new Promise((ok) => { let v = null; try { new PerformanceObserver((l) => { v = l.getEntries().at(-1); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {} setTimeout(() => ok(v ? Math.round(v.startTime) : null), 50); });
  const lt = await new Promise((ok) => { const a = []; try { new PerformanceObserver((l) => a.push(...l.getEntries())).observe({ type: 'longtask', buffered: true }); } catch {} setTimeout(() => ok(a.map((x) => Math.round(x.duration))), 50); });
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  const sb = document.querySelector('#sidebar, .float-nav, nav');
  return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), fcp: paint['first-contentful-paint'], lcp, req: res.length, perJenis: per,
    totalTransferKB: Math.round(res.reduce((s, r) => s + r.transferSize, 0) / 1024), totalDecodedKB: Math.round(res.reduce((s, r) => s + r.decodedBodySize, 0) / 1024),
    apiState: state ? { transferKB: Math.round(state.transferSize / 1024), decodedKB: Math.round(state.decodedBodySize / 1024), selesaiMs: Math.round(state.responseEnd) } : null,
    longTasks: lt, longTaskTotalMs: lt.reduce((a, b) => a + b, 0), longTaskMax: Math.max(0, ...lt), memMB: mem, ada3d: !!document.querySelector('canvas'), loadingMasihAda: !!document.querySelector('[data-loading]'), navTampil: !!sb && sb.getBoundingClientRect().width > 0 };
})()`;
const FPS = `new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); })`;

const c = await bukaChrome({ dbgPort: 9500 + Math.floor(Math.random() * 90) });
try {
  await c.ukuran(+w, +h);
  await c.kirim('Network.enable'); await c.kirim('Network.setCacheDisabled', { cacheDisabled: false });
  const out = { port, hash, viewport: `${w}x${h}` };
  for (const fase of ['dingin', 'hangat']) {
    const t0 = Date.now();
    if (fase === 'hangat') { await c.buka('about:blank'); await tidur(300); } await c.buka(`http://127.0.0.1:${port}/${hash}`);
    // "interaktif" = kerangka UI ada isinya; "3D tampil" = canvas ada dan tulisan memuat hilang
    let uiMs = null, d3Ms = null;
    for (let i = 0; i < 600; i++) {
      await tidur(50);
      let s; try { s = await c.eval(`JSON.stringify({ ui: !!document.querySelector('#sidebar *, .float-nav *, #topbar *'), d3: !!document.querySelector('canvas') && !document.querySelector('[data-loading]') })`); } catch { continue; }
      const o = JSON.parse(s);
      if (o.ui && uiMs == null) uiMs = Date.now() - t0;
      if (o.d3) { d3Ms = Date.now() - t0; break; }
    }
    await tidur(1500);
    const m = JSON.parse(JSON.stringify(await c.eval(AMBIL)));
    const fps = await c.eval(FPS);
    out[fase] = { uiTampilMs: uiMs, d3TampilMs: d3Ms, fpsIdle: fps, ...m };
  }
  out.galat = c.galat.slice(0, 5);
  console.log(JSON.stringify(out, null, 1));
} finally { await c.tutup(); }
