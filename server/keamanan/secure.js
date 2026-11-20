// Bahan keamanan bersama (P3): amplop enkripsi berversi untuk rahasia, tulis berkas atomik + kunci, perbandingan waktu-konstan.
// Tidak mencetak rahasia ke log. Kunci enkripsi tidak pernah ditulis ke db/ruang kerja.
//
// Format amplop:  ev2.<kid>.<iv>.<tag>.<ciphertext>[~<4 huruf terakhir>]
//   kid  = nomor versi kunci. Kunci diatur lewat RAIVERSE_KEYS="3:rahasia-baru,2:rahasia-lama" (pertama = dipakai menulis).
//          Tanpa RAIVERSE_KEYS dipakai TOKEN_ENC_KEY sebagai versi "1". Tanpa keduanya dibuat berkas data/.raiverse-keys.json (mode 0600).
//   AAD  = konteks ("ws-secret", "drive-token", ...) supaya amplop satu tempat tidak bisa dipasang di tempat lain.
//   "~hint" = 4 huruf terakhir teks asli, hanya supaya tampilan "••••abcd" yang sudah ada tetap benar (sama dengan yang sudah tampil sebelumnya).
// Kompatibel mundur: teks biasa lama dan format lama (iv.tag.ct dengan sha256(TOKEN_ENC_KEY)) masih bisa dibaca; yang ditulis ulang selalu format baru.
import * as config from '../config.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = () => config.dataDir();
const env = (k) => process.env[k] || '';
const b64 = (b) => Buffer.from(b).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacHex = (secret, msg) => crypto.createHmac('sha256', secret).update(msg).digest('hex');
/** perbandingan waktu-konstan untuk teks (panjang berbeda → false) */
export function safeEqual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
export const rand = (n = 16) => crypto.randomBytes(n).toString('hex');

// ── kunci berversi
let cache = null, cacheSig = '';
function keyRing() {
  const sig = env('RAIVERSE_KEYS') + '|' + env('TOKEN_ENC_KEY') + '|' + dataDir();
  if (cache && cacheSig === sig) return cache;
  const ring = new Map(); let current = null;
  const add = (kid, secret) => { ring.set(String(kid), Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), 'raiverse-seal-v2', 32))); if (current === null) current = String(kid); };
  for (const part of env('RAIVERSE_KEYS').split(',').map((s) => s.trim()).filter(Boolean)) { const i = part.indexOf(':'); if (i > 0 && /^\d{1,4}$/.test(part.slice(0, i)) && part.length - i > 16) add(part.slice(0, i), part.slice(i + 1)); }
  if (!ring.size && env('TOKEN_ENC_KEY')) add('1', env('TOKEN_ENC_KEY'));
  if (!ring.size) {
    const f = path.join(dataDir(), '.raiverse-keys.json');
    let j = null; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* belum ada */ }
    if (!j?.keys?.length) { j = { keys: [{ kid: '1', secret: crypto.randomBytes(32).toString('base64url') }] }; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j), { mode: 0o600 }); }
    for (const k of j.keys) add(k.kid, k.secret);
  }
  cache = { ring, current }; cacheSig = sig; return cache;
}
export const currentKeyId = () => keyRing().current;
/** kunci turunan untuk keperluan lain (mis. tanda tangan token gerbang), terpisah dari kunci enkripsi */
export function derive(label) { const { ring, current } = keyRing(); return crypto.createHmac('sha256', ring.get(current)).update('derive:' + label).digest(); }

export function seal(text, ctx = 'ws-secret') {
  const s = String(text ?? ''); if (!s) return '';
  if (isSealed(s)) return s;
  const { ring, current } = keyRing(), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', ring.get(current), iv);
  c.setAAD(Buffer.from(ctx));
  const ct = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return `ev2.${current}.${b64(iv)}.${b64(c.getAuthTag())}.${b64(ct)}~${s.slice(-4).replace(/[~.]/g, '')}`;
}
export const isSealed = (s) => typeof s === 'string' && s.startsWith('ev2.');
/** legacy: 'auth' = format lama token Drive (iv.tag.ct, sha256 TOKEN_ENC_KEY); 'plain' = teks biasa lama dikembalikan apa adanya */
export function open(blob, ctx = 'ws-secret', { legacy = 'plain' } = {}) {
  if (!blob) return '';
  const s = String(blob);
  if (!isSealed(s)) {
    if (legacy === 'auth') { const [iv, tag, ct] = s.split('.').map((x) => Buffer.from(x, 'base64url')); const d = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(env('TOKEN_ENC_KEY')).digest(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }
    return s;
  }
  const [, kid, iv, tag, rest] = s.split('~')[0].split('.');
  const key = keyRing().ring.get(kid); if (!key) throw new Error(`Kunci enkripsi versi ${kid} tidak ada (RAIVERSE_KEYS).`);
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); d.setAAD(Buffer.from(ctx)); d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(rest, 'base64url')), d.final()]).toString('utf8');
}
/** perlu ditulis ulang? (teks biasa, format lama, atau versi kunci bukan yang sekarang) */
export const needsReseal = (blob) => !!blob && (!isSealed(blob) || String(blob).split('.')[1] !== currentKeyId());
/** baca dengan kunci lama apa pun, tulis dengan kunci sekarang (rotasi) */
export function reseal(blob, ctx = 'ws-secret', opts) { if (!blob) return ''; return seal(open(blob, ctx, opts), ctx); }
/** tampilan aman untuk log/layar: tidak pernah memuat rahasia */
export const mask = (s) => (s ? '••••' + (String(s).includes('~') ? String(s).split('~').pop() : String(s).slice(-4)) : '');

// ── tulis berkas atomik + kunci antar proses
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** tulis ke berkas sementara lalu rename: pembaca tidak pernah melihat berkas setengah jadi, dan proses mati di tengah tidak merusak berkas lama */
export function writeAtomic(file, text, { mode } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'w', mode);
  try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (err) { if (i >= 8 || !/EPERM|EBUSY|EACCES/.test(err.code || '')) { try { fs.unlinkSync(tmp); } catch { /* sudah hilang */ } throw err; } sleepSync(15 * (i + 1)); }   // Windows: berkas sedang dibuka pembaca lain
  }
}
/** kunci sederhana berbasis berkas (O_EXCL). Basi setelah 15 detik (proses mati). Sinkron: dipakai di dalam read-modify-write yang pendek. */
export function withLock(file, fn, { waitMs = 5000 } = {}) {
  const lock = file + '.lock', t0 = Date.now(); let fd;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (;;) {
    try { fd = fs.openSync(lock, 'wx'); break; }
    catch (err) {
      if (err.code !== 'EEXIST' && err.code !== 'EPERM' && err.code !== 'EACCES') throw err;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 15000) { fs.unlinkSync(lock); continue; } } catch { /* dilepas orang lain */ }
      if (Date.now() - t0 > waitMs) throw new Error('Berkas data sedang dipakai proses lain. Coba lagi.');
      sleepSync(8 + Math.random() * 12);
    }
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch { /* sudah tertutup */ } try { fs.unlinkSync(lock); } catch { /* sudah hilang */ } }
}
/** baca → ubah → tulis atomik, di bawah kunci. Selalu membaca ulang isi terbaru, jadi tidak ada tulis yang hilang. */
export function updateJson(file, fallback, mutate, { mode } = {}) {
  return withLock(file, () => {
    let cur; try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { cur = typeof fallback === 'function' ? fallback() : structuredClone(fallback); }
    const out = mutate(cur) ?? cur;
    writeAtomic(file, JSON.stringify(out), { mode }); return out;
  });
}

// ── konsol pengelola: sumber dan rotasi kunci
/** dari mana kunci enkripsi berasal: 'env-berversi' (RAIVERSE_KEYS), 'env' (TOKEN_ENC_KEY), atau 'berkas' (data/.raiverse-keys.json) */
export const keySource = () => (env('RAIVERSE_KEYS') && keyRing().ring.size ? 'env-berversi' : env('TOKEN_ENC_KEY') ? 'env' : 'berkas');
export const keyCount = () => keyRing().ring.size;
/** Putar kunci yang disimpan di berkas: tambah versi baru di depan (kunci lama tetap ada untuk membaca). Hanya untuk sumber 'berkas'; tidak mengembalikan kuncinya. */
export function rotateFileKey() {
  if (keySource() !== 'berkas') throw Object.assign(new Error('Kunci enkripsi diatur lewat env (RAIVERSE_KEYS atau TOKEN_ENC_KEY): tambah versi baru di sana lalu mulai ulang server.'), { code: 409 });
  keyRing();
  const f = path.join(dataDir(), '.raiverse-keys.json'), j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const kid = String(Math.max(0, ...j.keys.map((k) => Number(k.kid) || 0)) + 1);
  j.keys.unshift({ kid, secret: crypto.randomBytes(32).toString('base64url') });
  writeAtomic(f, JSON.stringify(j), { mode: 0o600 }); cache = null;
  return { versi: currentKeyId(), jumlah: keyRing().ring.size };
}
