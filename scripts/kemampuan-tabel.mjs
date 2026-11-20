// Mencetak tabel Markdown: kemampuan, jumlah staf pemakai, kasus evaluasi lulus/total (model tiruan). node scripts/kemampuan-tabel.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ray-kap-'));
const K = await import('../server/staff/kemampuan.js'); const R = await import('../server/staff/registry.js');
const pakai = {}; for (const s of R.all()) for (const id of s.kemampuan || []) pakai[id] = (pakai[id] || 0) + 1;
console.log('| Kemampuan | Kelompok | Staf pemakai | Kasus lulus/total |\n|---|---|---|---|');
let tot = 0, ok = 0;
for (const c of K.all()) { const r = await K.evaluasi(c); const l = r.kasus.filter((k) => k.ok).length; tot += r.kasus.length; ok += l; console.log(`| ${c.kemampuan.id} | ${c.kemampuan.kelompok} | ${pakai[c.kemampuan.id] || 0} | ${l}/${r.kasus.length} |`); }
console.log(`| **Jumlah** | | ${Object.values(pakai).reduce((a, b) => a + b, 0)} | ${ok}/${tot} |`);
