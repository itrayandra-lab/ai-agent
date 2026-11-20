// Pengendali Chrome headless seminimal lewat CDP (tanpa pustaka luar). Dipakai tes tata letak dan tangkapan layar.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KANDIDAT = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
export const cariChrome = () => KANDIDAT.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
export const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/** Matikan Chrome BESERTA seluruh proses anaknya (GPU, renderer); di Windows proc.kill() saja meninggalkan anak-anaknya. */
function matikan(proc) { try { if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill('SIGKILL'); } catch { /* sudah mati */ } try { proc.kill(); } catch { /* sudah mati */ } }

export async function bukaChrome({ dbgPort = 9400 + Math.floor(Math.random() * 90) } = {}) {
  const exe = cariChrome(); if (!exe) throw new Error('Chrome tidak ditemukan');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-chrome-'));
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${prof}`, ...(process.env.UJI_GPU ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']), '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find((t) => t.type === 'page'); } catch { /* belum siap */ } if (!target) await tidur(300); }
  if (!target) { matikan(proc); throw new Error('Chrome tidak mau terbuka'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const galat = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') galat.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const kirim = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await kirim('Page.enable'); await kirim('Runtime.enable'); await kirim('Emulation.setFocusEmulationEnabled', { enabled: true });   // halaman headless dianggap fokus (kantor 3D membatasi 10 FPS bila jendela tak fokus)
  const eval_ = async (expr) => { const r = await kirim('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval gagal'); return r.result?.result?.value; };
  return {
    galat, eval: eval_, kirim,
    async ukuran(w, h, { tema } = {}) {
      await kirim('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
      if (tema) await kirim('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema }] });
    },
    async buka(url) { await kirim('Page.navigate', { url }); },
    async foto(berkas) {
      for (let k = 0; k < 3; k++) { const r = await kirim('Page.captureScreenshot', { format: 'png' }); if (r.result) { fs.writeFileSync(berkas, Buffer.from(r.result.data, 'base64')); return true; } await tidur(800); }
      return false;
    },
    async tutup() { try { ws.close(); } catch { /* sudah tutup */ } matikan(proc); await tidur(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { /* terkunci: biarkan */ } },
  };
}
