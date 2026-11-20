// Tangkapan layar tiap halaman utama lewat server uji terisolasi. Pakai: node scripts/tangkap-halaman.mjs <port> <folder>
import fs from 'node:fs';
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [, , port = '4511', out = 'docs/visual-review/konsolidasi'] = process.argv; fs.mkdirSync(out, { recursive: true });
const HAL = ['office', 'dashboard', 'pesan', 'tasks', 'brain', 'team', 'settings', 'karakter', 'admin'];
const c = await bukaChrome(); const log = [];
const denyut = () => c.kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5 + (Date.now() % 7), y: 5 }).catch(() => {});
for (const [tema, w, h] of [['dark', 1440, 900], ['light', 1440, 900], ['dark', 390, 844]]) {
  await c.ukuran(w, h, { tema });
  for (const hal of HAL) {
    await c.buka(`http://127.0.0.1:${port}/?nointro#${hal}`); await c.eval(`localStorage.setItem('ui-theme','${tema}')`).catch(() => {});
    await c.eval(`location.hash='${hal}'`).catch(() => {});
    for (let i = 0; i < 12; i++) { await denyut(); await tidur(250); }
    const g = [...c.galat].length; const judul = await c.eval(`document.title + ' | ' + (document.querySelector('#view')?.innerText || '').slice(0, 60).replace(/\n/g, ' ')`).catch(() => '?');
    const f = `${out}/${hal}-${w}x${h}-${tema}.png`; await c.foto(f); log.push(`${hal} ${w}x${h} ${tema}: ${judul} (galat JS kumulatif ${g})`);
  }
}
await c.tutup(); fs.writeFileSync(`${out}/DAFTAR.txt`, log.join('\n') + '\n'); console.log(log.join('\n'));
