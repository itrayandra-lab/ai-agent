// Ukur muat UI Kantor: permintaan, byte, waktu sampai dock siap, heap JS, FPS (headless tanpa GPU: bandingkan antar-versi, bukan nilai mutlak).
// Pakai: node scripts/ukur-konsolidasi.mjs <port> [label] [ulang=3]
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [, , port = '4511', label = 'uji', ulang = '3'] = process.argv;
const c = await bukaChrome(); const hasil = [];
await c.ukuran(1440, 900, { tema: 'dark' });
for (let i = 0; i < Number(ulang); i++) {
  await c.buka('about:blank'); await tidur(300);
  const t0 = Date.now(); await c.buka(`http://127.0.0.1:${port}/?nointro&r=${Date.now()}#office`);
  const denyut = () => c.kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5 + (Date.now() % 7), y: 5 }).catch(() => {});
  let siap = null; while (Date.now() - t0 < 60000) { await denyut(); const ok = await c.eval(`!!document.querySelector('.office-ov #odock')`).catch(() => false); if (ok) { siap = Date.now() - t0; break; } await tidur(100); }
  await tidur(2500);
  const r = JSON.parse(await c.eval(`(async () => { const res = performance.getEntriesByType('resource'); const nav = performance.getEntriesByType('navigation')[0];
    let n = 0; const t = performance.now(); await new Promise((ok) => { const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
    return JSON.stringify({ permintaan: res.length + 1, byteKirim: Math.round(res.reduce((s, x) => s + (x.encodedBodySize || 0), 0) / 1024), js: res.filter((x) => /\.js/.test(x.name)).length, css: res.filter((x) => /\.css/.test(x.name)).length, dcl: Math.round(nav.domContentLoadedEventEnd), muat: Math.round(nav.loadEventEnd), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, fps: Math.round(n / 3) }); })()`));
  hasil.push({ siapDock: siap, ...r });
}
await c.tutup();
const med = (k) => { const a = hasil.map((h) => h[k]).filter((x) => x != null).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const ringkas = Object.fromEntries(['siapDock', 'permintaan', 'byteKirim', 'js', 'css', 'dcl', 'muat', 'heapMB', 'fps'].map((k) => [k, med(k)]));
console.log(JSON.stringify({ label, ringkas, runs: hasil }));
