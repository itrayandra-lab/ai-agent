// Ukur beban GPU/CPU/FPS Kantor 3D di bawah kondisi berbeda (blur, DPR, suasana). Selalu menutup Chrome dan membersihkan.
// Pakai: UJI_GPU=1 node scripts/ukur-beban.mjs <port> [detik=20]
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [port = '4551', detik = '20'] = process.argv.slice(2);
const gpuSistem = () => { try { const o = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./gpu-sampel.ps1', import.meta.url))], { encoding: 'utf8', timeout: 30000 }); return parseFloat(o); } catch { return null; } };
const kasus = [
  { n: 'Tinggi + ambien Penuh (blur tersisa)', ku: 'tinggi', su: 'penuh' },
  { n: 'Otomatis (bawaan)', ku: 'otomatis', su: null },
  { n: 'Hemat', ku: 'hemat', su: 'mati' },
];
for (const k of kasus) {
  const c = await bukaChrome({ dbgPort: 9400 + Math.floor(Math.random() * 90) });
  try {
    await c.kirim('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: k.dpr, mobile: false });
    await c.kirim('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('kualitas','${k.ku}');${k.su ? `localStorage.setItem('suasana-hidup','${k.su}')` : ''}}catch(e){}` });
    await c.buka(`http://127.0.0.1:${port}/#office`);
    for (let i = 0; i < 240; i++) { await tidur(500); if (await c.eval(`!!window.__ray3d?.ambien && !document.querySelector('[data-loading]')`).catch(() => false)) break; }
    await tidur(6000);
    const gpu = gpuSistem();
    await tidur(+detik * 1000 - 6000 > 0 ? 3000 : 0);
    const r = JSON.parse(await c.eval(`JSON.stringify({ perf: (({ fps, pixelRatio, canvas }) => ({ fps, pixelRatio, canvas }))(__ray3d.perf()), amb: __ray3d.ambien(), info: { calls: __ray3d.renderer.info.render.calls, tris: __ray3d.renderer.info.render.triangles }, blurAktif: [...document.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().width > 0).filter((e) => { const s = getComputedStyle(e); return s.backdropFilter && s.backdropFilter !== 'none'; }).length })`));
    console.log(k.n.padEnd(38), 'GPU3D% =', gpu, '| fps', r.perf.fps, '| pixelRatio', r.perf.pixelRatio, '| canvas', r.perf.canvas.join('x'), '| calls', r.info.calls, '| tris', r.info.tris, '| elemen blur', r.blurAktif, '| hemat', r.amb.hemat, '| ambien', r.amb.tingkat + '/' + r.amb.aktif);
  } finally { await c.tutup(); }
}
