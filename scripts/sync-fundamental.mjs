// Menyalin diagram (blok mermaid) dari docs/FUNDAMENTAL/01-FUNDAMENTAL.md dan tabel dari 00-STATUS.md ke docs/FUNDAMENTAL/index.html.
// Jalankan: node scripts/sync-fundamental.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'FUNDAMENTAL');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const esc = (s) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');

const md = read('01-FUNDAMENTAL.md');
const diagrams = {};
const blockRe = /```mermaid\r?\n%% id: (\w+)\r?\n([\s\S]*?)```/g;
for (let m; (m = blockRe.exec(md));) diagrams[m[1]] = m[2].trim();

const status = read('00-STATUS.md').split(/\r?\n/);
const rows = status.filter((l) => l.startsWith('|') && !/^\|[\s-|]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const updated = (status.find((l) => l.startsWith('Terakhir diperbarui')) || '').replace(/\*\*/g, '');
const cls = (s) => (/^Jalan|^Ada, tidak/.test(s) ? (/^Ada/.test(s) ? 'off' : 'ok') : /^Belum/.test(s) ? 'off' : 'half');
const table = '<table><thead><tr>' + rows[0].map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' +
  rows.slice(1).map((r) => `<tr><td>${esc(r[0])}</td><td><span class="chip ${cls(r[1])}">${esc(r[1])}</span></td><td>${esc(r[2] || '')}</td></tr>`).join('') + '</tbody></table>';

const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const put = (id, body) => {
  const re = new RegExp(`(<!--BEGIN:${id}-->)[\\s\\S]*?(<!--END:${id}-->)`);
  if (!re.test(html)) throw new Error('penanda tidak ada di index.html: ' + id);
  html = html.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
};
for (const [id, code] of Object.entries(diagrams)) put(id, `<pre class="mermaid">${esc(code)}</pre>`);
put('status', table);
put('updated', esc(updated));
fs.writeFileSync(htmlPath, html);
console.log('diagram:', Object.keys(diagrams).join(', '), '| baris status:', rows.length - 1);
