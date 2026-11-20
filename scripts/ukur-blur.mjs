// Bandingkan beban GPU dalam SATU sesi: (A) CSS lama (blur di mana-mana), (B) hemat.css bagian selalu-aktif, (C) mode Hemat. Menutup Chrome di akhir.
// Pakai: UJI_GPU=1 node scripts/ukur-blur.mjs <port> [putaran=2]
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [port = '4551', putaran = '2'] = process.argv.slice(2);
const gpu = () => { try { return parseFloat(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./gpu-sampel.ps1', import.meta.url))], { encoding: 'utf8', timeout: 30000 })); } catch { return NaN; } };
const blur = `[...document.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.backdropFilter && s.backdropFilter !== 'none'; }).map((e) => e.getBoundingClientRect().width * e.getBoundingClientRect().height).reduce((a, b) => a + b, 0)`;
const c = await bukaChrome({ dbgPort: 9400 + Math.floor(Math.random() * 90) });
try {
  await c.kirim('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await c.kirim('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('kualitas','tinggi');localStorage.setItem('suasana-hidup','mati')}catch(e){}` });
  await c.buka(`http://127.0.0.1:${port}/#office`);
  for (let i = 0; i < 240; i++) { await tidur(500); if (await c.eval(`!!window.__ray3d?.ambien && !document.querySelector('[data-loading]')`).catch(() => false)) break; }
  await c.eval(`document.querySelector('.office-ov')?.click?.(); 0`); await tidur(5000);
  const set = (x) => c.eval(x);
  for (let r = 0; r < +putaran; r++) {
    await set(`[...document.styleSheets].find((s) => /hemat\.css/.test(s.href || '')).disabled = true`); await tidur(3000);
    const A = { gpu: gpu(), px: await set(blur) };
    await set(`[...document.styleSheets].find((s) => /hemat\.css/.test(s.href || '')).disabled = false`); await tidur(3000);
    const B = { gpu: gpu(), px: await set(blur) };
    await set(`window.dispatchEvent(new CustomEvent('raiverse:kualitas', { detail: { pilihan: 'hemat' } })); 0`); await tidur(3000);
    const C = { gpu: gpu(), px: await set(blur) };
    await set(`window.dispatchEvent(new CustomEvent('raiverse:kualitas', { detail: { pilihan: 'tinggi' } })); 0`); await tidur(1500);
    console.log(`putaran ${r + 1}: A lama GPU ${A.gpu}% blur ${Math.round(A.px / 1e3)}k px | B kini GPU ${B.gpu}% blur ${Math.round(B.px / 1e3)}k px | C hemat GPU ${C.gpu}% blur ${Math.round(C.px / 1e3)}k px`);
  }
} finally { await c.tutup(); }
