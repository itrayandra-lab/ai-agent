// Pemanggil alur staf lewat alamat masuk (webhook) di mesin otomasi + kelas galat berbahasa awam.
export class StaffError extends Error { constructor(msg, kind = 'umum', code = 400) { super(msg); this.kind = kind; this.code = code; } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const baseUrl = () => String(process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
const MAX_RESPONSE = 900_000;

async function readCapped(res) {
  const reader = res.body?.getReader(); if (!reader) return '';
  const dec = new TextDecoder(); let out = '', n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > MAX_RESPONSE) { await reader.cancel().catch(() => {}); throw new StaffError('Hasil terlalu besar untuk diambil.', 'besar', 502); } out += dec.decode(value, { stream: true }); }
  return out + dec.decode();
}

/** Panggil alur. Webhook yang baru diaktifkan kadang butuh sebentar: 404 diulang (retry404). Mengembalikan objek hasil. */
export async function callHook(path, body, { timeoutMs = 60_000, retry404 = 0 } = {}) {
  let res, lastErr;
  for (let i = 0; i <= retry404; i++) {
    try { res = await fetch(`${baseUrl()}/webhook/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) }); }
    catch (e) { lastErr = e; res = null; if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new StaffError('Pekerjaan ini memakan waktu lebih lama dari biasanya.', 'lama', 504); }
    if (res && res.status !== 404) break; if (i < retry404) await wait(1200);
  }
  if (!res) throw new StaffError('Mesin otomasi belum menyala. Nyalakan dulu, lalu coba lagi.', 'mati', 503);
  const text = await readCapped(res); let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (res.status === 404) throw new StaffError('Staf ini belum terpasang di mesin otomasi.', 'belum_siap', 503);
  if (!res.ok) throw new StaffError(`Ada langkah yang gagal saat bekerja${j?.message ? ': ' + String(j.message).slice(0, 160) : ''}.`, 'langkah', 502);
  const out = Array.isArray(j) ? j[0] : j;
  if (!out || typeof out !== 'object') throw new StaffError('Mesin otomasi tidak mengembalikan hasil.', 'kosong', 502);
  return out;
}
