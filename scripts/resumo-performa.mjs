// Ringkas keluaran ukur-performa.mjs. Pakai: node scripts/resumo-performa.mjs berkas.json
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const f of ['dingin', 'hangat']) { const x = r[f]; console.log(f, JSON.stringify({ ui: x.uiTampilMs, d3: x.d3TampilMs, fps: x.fpsIdle, fcp: x.fcp, lcp: x.lcp, req: x.req, transferKB: x.totalTransferKB, decodedKB: x.totalDecodedKB, js: x.perJenis.js && Math.round(x.perJenis.js.transfer / 1024) + 'K/' + Math.round(x.perJenis.js.decoded / 1024) + 'K', state: x.apiState && x.apiState.transferKB + 'K', ltN: x.longTasks.length, ltMax: x.longTaskMax, memMB: x.memMB })); }
