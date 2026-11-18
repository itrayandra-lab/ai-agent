// Guards against a lost backslash: /s+/ (the letter "s") written where /\s+/ (whitespace) was meant.
// That typo once removed every "s" from the text shown above agents' heads and read aloud by the voice
// ("saya di sini" became " aya di  ini").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// recursive, so subfolders such as server/staff/ are guarded too
const files = ['server', 'public/js'].flatMap((dir) => fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => String(f).endsWith('.js') && !String(f).includes('node_modules')).map((f) => `${dir}/${String(f).replace(/\\/g, '/')}`));
const SUSPECT = /\.(?:replace|replaceAll|split|match)\(\s*\/(?:s[+*]|\^s[+*]|s[+*]\$)\/[a-z]*/;

test('no regular expression uses the letter s where whitespace was meant', () => {
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => { if (SUSPECT.test(line)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, [], `Suspicious /s+/ patterns (missing backslash?): ${hits.join(', ')}`);
});

// The same lost backslash for the other shorthand classes: /d+/ (letter d) where /\d+/ was meant, /w+/ for /\w+/, /S+/ for /\S+/ ...
// Only a bare run of one shorthand letter with a quantifier is flagged, so real words such as /ddos/ or /sw+/ are not.
const SUSPECT_CLASS = /\.(?:replace|replaceAll|split|match|matchAll|test|exec|search)\(\s*\/\^?[dDwWsS][+*]\$?\/[a-z]*/;
const SUSPECT_CTOR = /new RegExp\(\s*(['"`])\^?[dDwWsS][+*]\$?\1/;   // new RegExp('s+') loses the backslash the same way

test('no regular expression uses a bare shorthand letter (d w s S D W) where a character class was meant', () => {
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => { if (SUSPECT_CLASS.test(line) || SUSPECT_CTOR.test(line)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, [], `Suspicious shorthand patterns (missing backslash?): ${hits.join(', ')}`);
});

test('the guard patterns catch the typo and ignore correct code', () => {
  const bs = String.fromCharCode(92);
  for (const bad of ['x.replace(/s+/g, " ")', 'x.split(/d+/)', 'x.match(/^w*$/)', 'x.test(/S+/)', "new RegExp('s+', 'g')"]) assert.ok(SUSPECT.test(bad) || SUSPECT_CLASS.test(bad) || SUSPECT_CTOR.test(bad), bad);
  for (const good of ['x.replace(/' + bs + 's+/g, " ")', 'x.split(/' + bs + 'd+/)', 'x.match(/sw+/)', 'x.test(/ddos/)', "new RegExp('" + bs + bs + "s+', 'g')"]) assert.ok(!(SUSPECT.test(good) || SUSPECT_CLASS.test(good) || SUSPECT_CTOR.test(good)), good);
});

test('an agent reply event keeps its letters when whitespace is collapsed', () => {
  const src = fs.readFileSync(path.join(root, 'server/engine.js'), 'utf8');
  const wanted = 'String(text).replace(/' + String.fromCharCode(92) + 's+/g';
  assert.ok(src.includes(wanted), 'reply() must collapse whitespace with the whitespace class');
  const ws = new RegExp(String.fromCharCode(92) + 's+', 'g');
  const sentence = 'Baik, saya di sini—siap membantu!';
  assert.equal(sentence.replace(ws, ' '), sentence);
});
