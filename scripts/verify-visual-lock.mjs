import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'visual-lock.json'), 'utf8'));
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
  const p = `${dir}/${e.name}`;
  return e.isDirectory() ? walk(p) : [p];
});
const files = [...walk('public/css'), ...walk('public/js'), 'public/index.html', 'public/favicon.svg'].sort();
const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const errors = [];
for (const file of new Set([...files, ...Object.keys(manifest.files)])) {
  if (!files.includes(file)) errors.push(`Deleted: ${file}`);
  else if (!manifest.files[file]) errors.push(`Unreviewed new file: ${file}`);
  else if (hash(fs.readFileSync(path.join(root, file), 'utf8')) !== manifest.files[file]) errors.push(`Changed: ${file}`);
}
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const styles = [...html.matchAll(/<link\b[^>]*href="([^\"]+\.css)"[^>]*>/g)].map(m => m[1]);
if (styles.at(-1) !== '/css/identity.css') errors.push('identity.css must be the final stylesheet');
if (errors.length) {
  console.error('VISUAL LOCK FAILED\n' + errors.join('\n') + '\nReview changes using VISUAL-LOCK.md. Never refresh the baseline just to pass.');
  process.exitCode = 1;
} else console.log(`Visual lock: ${files.length} frontend files unchanged; stylesheet order verified.`);
