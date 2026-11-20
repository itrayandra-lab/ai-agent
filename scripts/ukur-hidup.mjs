// Ukur biaya kehidupan ambien Kantor 3D: FPS, memori, dan jumlah agen yang sedang mampir, untuk tiap tingkat Suasana hidup.
// Pakai: UJI_GPU=1 node scripts/ukur-hidup.mjs <port> [detik=40]
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [port = '4551', detik = '40'] = process.argv.slice(2);
for (const tingkat of ['mati', 'penuh']) {
  const c = await bukaChrome({ dbgPort: 9400 + Math.floor(Math.random() * 90) });
  try {
    await c.ukuran(1440, 900);
    await c.kirim('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('suasana-hidup','${tingkat}')}catch(e){}` });
    await c.buka(`http://127.0.0.1:${port}/#office`);
    for (let i = 0; i < 300; i++) { await tidur(500); if (await c.eval(`!!window.__ray3d?.ambien && !document.querySelector('[data-loading]')`).catch(() => false)) break; }
    await tidur(4000);
    const s = JSON.parse(await c.eval(`new Promise((ok) => { const r = []; const t0 = performance.now(); const f = () => { if (performance.now() - t0 > ${+detik * 1000}) { ok(JSON.stringify({ fps: r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0, ft95: r.sort((a, b) => a - b)[Math.floor(r.length * 0.05)] ?? 0, mem: Math.round(performance.memory.usedJSHeapSize / 1048576), ambien: __ray3d.ambien() })); return; } r.push(__ray3d.perf().fps); setTimeout(f, 1000); }; f(); })`));
    console.log(tingkat, JSON.stringify(s));
  } finally { await c.tutup(); }
}
