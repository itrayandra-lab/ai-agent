// Pustaka kecil untuk skrip penonaktif/pengaktif alur staf di n8n. Tidak pernah mencetak kunci; hanya memanggil
// GET daftar alur, POST aktifkan, POST nonaktifkan. TIDAK ADA hapus, TIDAK ADA ubah isi alur.
import fs from 'node:fs';
import path from 'node:path';

export const STAF_PREFIX = '[RAIVERSE][staf] ';
export const isStaf = (w) => typeof w?.name === 'string' && w.name.startsWith(STAF_PREFIX);
export const isRaiverseLain = (w) => typeof w?.name === 'string' && w.name.startsWith('[RAIVERSE]') && !isStaf(w);

/** Muat .env bila kunci belum ada di lingkungan (tanpa mencetak apa pun). */
export function loadEnv() {
  if (process.env.N8N_API_KEY) return;
  try { process.loadEnvFile(path.resolve('.env')); } catch { /* tidak ada .env: lanjut, nanti ditolak dengan pesan jelas */ }
}
export const baseUrl = () => String(process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
const scrub = (s) => String(s ?? '').split(process.env.N8N_API_KEY || '\u0000').join('***').slice(0, 200);

export async function api(method, p, body) {
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY belum diisi (di .env atau lingkungan).');
  let res;
  try { res = await fetch(baseUrl() + p, { method, headers: { accept: 'application/json', 'X-N8N-API-KEY': key, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) }); }
  catch (e) { throw new Error('n8n tidak bisa dihubungi: ' + scrub(e.message)); }
  const text = await res.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) throw new Error(`n8n menolak (${res.status}): ${scrub(j?.message || '')}`);
  return j;
}

/** Semua alur (dengan halaman berikutnya), hanya bidang yang dibutuhkan. */
export async function listAll() {
  const out = []; let cursor = '';
  for (let i = 0; i < 40; i++) {
    const r = await api('GET', `/api/v1/workflows?limit=250${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    for (const w of r?.data || []) out.push({ id: String(w.id), name: String(w.name ?? ''), active: w.active === true });
    cursor = r?.nextCursor || ''; if (!cursor) break;
  }
  return out;
}

export function ringkas(list) {
  const staf = list.filter(isStaf), lain = list.filter(isRaiverseLain);
  const owner = list.filter((w) => !isStaf(w) && !isRaiverseLain(w));
  return { total: list.length, staf: staf.length, stafAktif: staf.filter((w) => w.active).length, raiverseLain: lain.length, raiverseLainAktif: lain.filter((w) => w.active).length, lainnya: owner.length, lainnyaAktif: owner.filter((w) => w.active).length };
}
/** Sidik jari alur non-staf (id + aktif/tidak): dipakai membuktikan bahwa alur milik Owner dan otomasi lain tidak berubah. */
export const sidikJari = (list) => JSON.stringify(list.filter((w) => !isStaf(w)).map((w) => [w.id, w.name, w.active]).sort());

export const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export function writeJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2)); fs.renameSync(t, f); }
export const defaultFile = () => path.resolve('data', 'n8n-staf-nonaktif.json');
export function argOf(name, dflt) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt; }
export const memori = () => { const m = process.memoryUsage(); return Math.round(m.rss / 1048576); };
