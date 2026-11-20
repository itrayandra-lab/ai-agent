// Tes tumpang tindih panel Kantor 3D: Chrome headless mengukur kotak batas panel pada lima ukuran layar.
// Satu server uji terisolasi dan satu peramban bersama; satu tes per ukuran (masing-masing bisa lulus mandiri), batas waktu eksplisit.
// Dilewati bila Chrome tidak ada. Data sementara, tanpa kunci AI, port 4641-4649.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cariChrome, bukaChrome } from '../scripts/lib/chrome-cdp.mjs';
import { ujiTataLetak, periksa, UKURAN } from '../scripts/uji-tata-letak-kantor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADA_CHROME = !!cariChrome();
const port = 4643;
let srv = null, dataDir = null, peramban = null;

before(async () => {
  if (!ADA_CHROME) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-tata-'));
  srv = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', N8N_URL: 'http://127.0.0.1:1', N8N_API_KEY: '', TELEGRAM_BOT_TOKEN: '' } });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/state`)).ok) break; } catch { /* belum siap */ } await new Promise((r) => setTimeout(r, 250)); }
  peramban = await bukaChrome();
});
after(async () => {
  try { await peramban?.tutup(); } catch { /* sudah tutup */ }
  try { srv?.kill(); } catch { /* sudah mati */ }
  if (dataDir) try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* terkunci */ }
});

test('periksa(): irisan dan panel keluar layar terdeteksi, susunan rapi lolos', () => {
  const ov = { l: 0, t: 0, r: 1000, b: 800 };
  assert.deepEqual(periksa({ ov, panel: [{ s: 'a', l: 0, t: 0, r: 100, b: 50 }, { s: 'b', l: 100, t: 0, r: 200, b: 50 }] }), []);   // bersisian = tidak beririsan
  assert.match(periksa({ ov, panel: [{ s: 'a', l: 0, t: 0, r: 120, b: 50 }, { s: 'b', l: 100, t: 0, r: 200, b: 50 }] })[0], /menimpa/);
  assert.match(periksa({ ov, panel: [{ s: 'a', l: 900, t: 700, r: 1100, b: 850 }] })[0], /keluar dari layar/);
  assert.equal(UKURAN.length, 5);
});

for (const [w, h] of UKURAN) {
  test(`Kantor 3D ${w}x${h}: tidak ada panel tumpang tindih, satu popup sekali waktu, pusat pandangan di ruang kanan`, { skip: !ADA_CHROME && 'Chrome tidak ditemukan', timeout: 150000 }, async () => {
    const hasil = await ujiTataLetak({ port, ukuran: [[w, h]], peramban });
    const gagal = hasil.filter((x) => x.masalah.length).map((x) => `${x.ukuran} ${x.keadaan}: ${x.masalah.join('; ')}`);
    assert.deepEqual(gagal, []);
    assert.ok(hasil.length >= (w <= 900 ? 9 : 17), 'jumlah keadaan yang diuji tidak berkurang');
  });
}

test('kolom ketik Kantor 3D: Enter dan "/" memfokuskan chat di mode karakter; Esc menutup; satu komponen (tanpa panel DM terpisah)', async () => {
  const v = fs.readFileSync(path.join(ROOT, 'public/js/views.js'), 'utf8');
  assert.match(v, /\(e\.key !== 'Enter' && e\.key !== '\/'\) \|\| !office\?\.isPlayer\?\.\(\)/, 'Enter dan / memfokuskan #goalq saat Play');
  assert.match(v, /gq\.addEventListener\('keydown', \(e\) => \{ if \(e\.key === 'Escape'\)/, 'Esc menutup percakapan');
  assert.match(v, /\.querySelector\('#goalq'\)\?\.focus\(\)/);
  assert.doesNotMatch(v, /id="ptalk"/, 'panel DM kanan sudah dihapus');
  assert.match(v, /onkeydown = \(e\) => \{ e\.stopPropagation\(\)/, 'ketikan tidak bocor ke tombol gerak');
});
test('pesan gerbang 403: sudah masuk tetapi belum anggota tidak disuruh masuk lagi', () => {
  const c = fs.readFileSync(path.join(ROOT, 'public/js/core.js'), 'utf8');
  assert.match(c, /Kamu belum menjadi anggota ruang kerja ini/); assert.match(c, /forbidden: r\.status === 403/);
});
