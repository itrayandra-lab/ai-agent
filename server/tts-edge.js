// Server-side Indonesian voices (Microsoft neural: Gadis and Ardi) through the `edge-tts` Python package, run as one warm helper process.
// Opt-in on the client. The text of the line being read is sent to Microsoft's read-aloud service; this is an unofficial endpoint, so
// every caller must be ready to fall back. Cost on the VPS: about 40 MB while in use (helper exits after 10 idle minutes), no model, no GPU.
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tts_edge.py');
export const VOICES = ['id-ID-GadisNeural', 'id-ID-ArdiNeural'];
const MAX_TEXT = 600, MAX_PENDING = 6, TIMEOUT = 20000, IDLE_MS = 10 * 60 * 1000;
let proc = null, buf = '', ready = null, idleT = null, py = null, lastErr = '';
const pend = new Map(); const cache = new Map();

function findPython() {
  if (py) return py;
  const cands = [process.env.TTS_PYTHON, 'python3', 'python', 'py'].filter(Boolean);
  for (const c of cands) { try { execFileSync(c, ['-c', 'import edge_tts'], { stdio: 'ignore', timeout: 15000, windowsHide: true }); return (py = c); } catch { /* try next */ } }
  return null;
}
function failAll(msg) { for (const [, p] of pend) p.rej(new Error(msg)); pend.clear(); }
function stop() { const p = proc; proc = null; ready = null; try { p?.kill(); } catch { /* ignore */ } failAll('helper berhenti'); }
function start() {
  if (proc) return ready;
  const cmd = findPython();
  if (!cmd) { lastErr = 'Python dengan paket edge-tts tidak ditemukan (pip install edge-tts==7.3.1, atau set TTS_PYTHON)'; return Promise.reject(new Error(lastErr)); }
  const me = spawn(cmd, ['-u', SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  proc = me; buf = '';
  ready = new Promise((res, rej) => { me.__ready = { res, rej }; setTimeout(() => rej(new Error('helper tidak siap')), 15000).unref?.(); });
  me.stdout.on('data', (d) => {
    buf += d.toString('utf8'); let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.ready) { me.__ready?.res(true); continue; }
      const p = pend.get(m.id); if (!p) continue; pend.delete(m.id);
      m.ok ? p.res(Buffer.from(m.audio, 'base64')) : p.rej(new Error(m.error || 'gagal'));
    }
  });
  me.stderr.on('data', (d) => { lastErr = d.toString().slice(0, 200); });
  me.on('exit', () => { if (proc === me) { proc = null; ready = null; } failAll('helper berhenti'); });
  me.on('error', (e) => { lastErr = String(e.message); });
  return ready;
}
const touch = () => { clearTimeout(idleT); idleT = setTimeout(stop, IDLE_MS); idleT.unref?.(); };

/** Is the helper usable? (does not start it) */
export function status() { const c = findPython(); return { available: !!c, voices: VOICES, error: c ? '' : lastErr || 'Python dengan paket edge-tts tidak ditemukan' }; }

/** Returns { mime, audio: Buffer }. rate "+12%", pitch "+4Hz". Identical requests are served from memory. */
export async function synthesize(text, { voice, rate = '+0%', pitch = '+0Hz' } = {}) {
  text = String(text || '').trim(); if (!text) throw Object.assign(new Error('Teks kosong'), { code: 400 });
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
  if (!VOICES.includes(voice)) voice = VOICES[1];
  if (!/^[+-]\d{1,2}%$/.test(rate)) rate = '+0%';
  if (!/^[+-]\d{1,2}Hz$/.test(pitch)) pitch = '+0Hz';
  const key = crypto.createHash('sha1').update([voice, rate, pitch, text].join('|')).digest('hex');
  const hit = cache.get(key); if (hit) { cache.delete(key); cache.set(key, hit); return { mime: 'audio/mpeg', audio: hit, cached: true }; }
  if (pend.size >= MAX_PENDING) throw Object.assign(new Error('Suara server sedang sibuk'), { code: 429 });
  try { await start(); } catch (e) { stop(); throw Object.assign(new Error(e.message), { code: 503 }); }
  touch();
  const id = crypto.randomUUID(), target = proc;
  const audio = await new Promise((res, rej) => {
    const t = setTimeout(() => { pend.delete(id); rej(new Error('Suara server terlalu lama')); }, TIMEOUT);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    target.stdin.write(JSON.stringify({ id, text, voice, rate, pitch }) + '\n');
  }).catch((e) => { throw Object.assign(e, { code: e.code || 502 }); });
  cache.set(key, audio); while (cache.size > 200) cache.delete(cache.keys().next().value);
  return { mime: 'audio/mpeg', audio };
}
process.on('exit', () => { try { proc?.kill(); } catch { /* ignore */ } });
