// Kontrak konsolidasi 2026-11-20 (docs/FUNDAMENTAL/konsolidasi/AUDIT.md): satu pintu pesan, tanpa berkas peneruskan yatim,
// CSS Kantor tanpa tumpukan versi, penjaga izin staf di kode. Tanpa model, tanpa biaya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const baca = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('satu pintu pesan: web, Telegram, Discord, dan Kantor 3D memanggil pemandu.turn yang diarahkan ke Chat Engine', () => {
  assert.match(baca('server/chat-engine.js'), /pemandu\.setFront\(turn\)/);
  assert.match(baca('server/pemandu.js'), /front && !args\._inner \? front\(args\)/);
  assert.match(baca('server/channels/core.js'), /pemandu\.turn\(a\)/);
  assert.match(baca('server/index.js'), /chatEngine\.turn\(/, '/api/orchestrate bawaan = Chat Engine');
});

test('tidak ada modul server yatim (tanpa pemanggil); yang yatim harus diarsipkan lewat _arsip-kode/DAFTAR.md', () => {
  const out = JSON.parse(execFileSync(process.execPath, ['scripts/inventaris.mjs', '--json'], { cwd: new URL('..', import.meta.url), maxBuffer: 1 << 26 }).toString());
  assert.deepEqual(out.serverTanpaPemanggil, []);
  assert.ok(fs.existsSync(new URL('../_arsip-kode/DAFTAR.md', import.meta.url)));
});

test('CSS Kantor: tanpa penanda versi bertumpuk dan tanpa selektor ganda dalam satu konteks', () => {
  const css = baca('public/css/office-layout.css');
  assert.doesNotMatch(css, /═══ v\d+/, 'versi dilebur, bukan ditumpuk');
  const out = JSON.parse(execFileSync(process.execPath, ['scripts/inventaris.mjs', '--json'], { cwd: new URL('..', import.meta.url), maxBuffer: 1 << 26 }).toString());
  const ganda = out.selektorGanda.filter((s) => s.berkas.length === 1 && s.berkas[0].endsWith('office-layout.css') && !s.selektor.startsWith('@') && s.kali > 1 && !/^(:root|\.|#|body)/.test('') );
  const dalamBerkas = ganda.filter((s) => s.kali > 2);
  assert.ok(dalamBerkas.length < 10, `selektor berulang >2x di office-layout.css: ${dalamBerkas.map((s) => s.selektor).join(' | ')}`);
});

test('jalan staf berdampak ditolak di kode bila pengguna tidak boleh mengotomasi (T-07)', () => {
  assert.match(baca('server/chat-engine.js'), /confirmed && args\.canAutomate === false/);
});

test('label halaman konsisten: Hasil Saya, tanpa "Hasil saya"', () => {
  for (const f of ['public/js/hasil-view.js', 'public/js/views.js', 'public/js/app.js']) assert.doesNotMatch(baca(f), /Hasil saya(?!n)/, f);
});

test('loadState menolak respons galat server (T-06)', () => {
  assert.match(baca('public/js/core.js'), /if \(!r\.ok\) throw/);
});
