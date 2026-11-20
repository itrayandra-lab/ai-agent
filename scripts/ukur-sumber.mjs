// Daftar sumber yang dimuat saat halaman dibuka, urut waktu mulai (untuk melihat air terjun pemuatan). Pakai: node scripts/ukur-sumber.mjs <port> [hash]
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';
const [port = '4551', hash = '#office'] = process.argv.slice(2);
const c = await bukaChrome({ dbgPort: 9600 + Math.floor(Math.random() * 90) });
try {
  await c.ukuran(1440, 900); await c.buka(`http://127.0.0.1:${port}/${hash}`);
  await tidur(12000);
  const r = JSON.parse(await c.eval(`JSON.stringify(performance.getEntriesByType('resource').map((r) => [Math.round(r.startTime), Math.round(r.responseEnd), r.name.replace(location.origin, ''), Math.round(r.transferSize / 1024), Math.round(r.decodedBodySize / 1024)]).sort((a, b) => a[0] - b[0]))`));
  for (const x of r) console.log(String(x[0]).padStart(6), String(x[1]).padStart(6), String(x[3]).padStart(6) + 'K', String(x[4]).padStart(6) + 'K', x[2].slice(0, 90));
} finally { await c.tutup(); }
