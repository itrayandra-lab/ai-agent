// Performa HTTP: kompresi (brotli/gzip), ETag + 304, cache statis di memori. Tanpa pustaka luar.
// Dipakai oleh server/index.js untuk berkas statis dan balasan JSON. SSE tidak dikompres di sini.
import zlib from 'node:zlib';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BISA_KOMPRES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest', '.wasm', '.txt', '.map']);
const BATAS_CACHE = 2 * 1024 * 1024;   // berkas statis sampai 2 MB disimpan (mentah + terkompresi) di memori
const MIN_KOMPRES = 512;               // di bawah ini kompresi tidak sepadan
const cache = new Map();
const jsonZ = new Map();               // etag+sandi → hasil kompresi JSON terakhir (permintaan berulang dengan isi sama = gratis)               // jalur berkas → { mtimeMs, size, etag, raw, br, gz }

/** pilih sandi terbaik dari Accept-Encoding: 'br' | 'gzip' | null */
export function pilihSandi(req) {
  const h = String(req?.headers?.['accept-encoding'] || '');
  if (/\bbr\b/.test(h)) return 'br';
  if (/\bgzip\b/.test(h)) return 'gzip';
  return null;
}
const kompres = (sandi, buf, { cepat = false } = {}) => new Promise((ok, gagal) => {
  const cb = (e, r) => (e ? gagal(e) : ok(r));
  if (sandi === 'br') zlib.brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: cepat ? 4 : 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }, cb);
  else zlib.gzip(buf, { level: cepat ? 4 : 9 }, cb);
});
export const etagDari = (buf) => '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"';
const cocok = (req, etag) => { const n = req.headers['if-none-match']; return !!n && n.split(',').some((x) => x.trim().replace(/^W\//, '') === etag); };

/** Balasan JSON: dikompres bila klien mendukung dan ukurannya cukup besar; ETag + 304 untuk GET besar. */
export async function kirimJson(req, res, code, data, extra = {}) {
  const buf = Buffer.from(JSON.stringify(data));
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding', ...extra };
  const sandi = buf.length >= MIN_KOMPRES ? pilihSandi(req) : null;
  if (req?.method === 'GET' && code === 200 && buf.length > 64 * 1024 && extra.etag !== false) {
    const etag = etagDari(buf);
    h.ETag = etag; h['Cache-Control'] = 'private, no-cache';   // boleh disimpan, wajib divalidasi: 304 menghemat seluruh isi
    if (cocok(req, etag)) { res.writeHead(304, { ETag: etag, 'Cache-Control': h['Cache-Control'], Vary: h.Vary }); return res.end(); }
  }
  delete h.etag;
  if (!sandi) { h['Content-Length'] = buf.length; res.writeHead(code, h); return res.end(buf); }
  const kunci = h.ETag ? h.ETag + sandi : null;
  let z = kunci ? jsonZ.get(kunci) : null;
  try { if (!z) { z = await kompres(sandi, buf, { cepat: true }); if (kunci) { jsonZ.set(kunci, z); if (jsonZ.size > 4) jsonZ.delete(jsonZ.keys().next().value); } } } catch { h['Content-Length'] = buf.length; res.writeHead(code, h); return res.end(buf); }
  h['Content-Encoding'] = sandi; h['Content-Length'] = z.length; res.writeHead(code, h); res.end(z);
}

/** Berkas statis. Mengembalikan false bila berkas tak ada (agar pemanggil bisa 404 atau SPA fallback). */
export function kirimBerkas(req, res, file, mime, { kebijakan }) {
  return new Promise((selesai) => {
    fs.stat(file, async (err, st) => {
      if (err || !st.isFile()) return selesai(false);
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      const dapatKompres = BISA_KOMPRES.has(ext);
      const sandi = dapatKompres ? pilihSandi(req) : null;
      const cc = typeof kebijakan === 'function' ? kebijakan(ext) : kebijakan;
      const dasar = { 'Content-Type': mime, 'Cache-Control': cc, Vary: 'Accept-Encoding', 'Last-Modified': new Date(st.mtimeMs).toUTCString() };
      try {
        if (st.size <= BATAS_CACHE) {
          let c = cache.get(file);
          if (!c || c.mtimeMs !== st.mtimeMs || c.size !== st.size) {
            const raw = await fs.promises.readFile(file);
            c = { mtimeMs: st.mtimeMs, size: st.size, etag: etagDari(raw), raw, br: null, gz: null }; cache.set(file, c);
          }
          const h = { ...dasar, ETag: c.etag };
          if (cocok(req, c.etag)) { res.writeHead(304, { ETag: c.etag, 'Cache-Control': cc, Vary: h.Vary }); res.end(); return selesai(true); }
          let isi = c.raw;
          if (sandi && c.raw.length >= MIN_KOMPRES) {
            const k = sandi === 'br' ? 'br' : 'gz';
            if (!c[k]) c[k] = await kompres(sandi, c.raw);   // sekali per berkas per versi, lalu dari memori
            isi = c[k]; h['Content-Encoding'] = sandi;
          }
          h['Content-Length'] = isi.length;
          res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : isi);
          return selesai(true);
        }
        // berkas besar (GLB, gambar): alirkan; validasi lewat mtime-ukuran
        const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
        if (cocok(req, etag)) { res.writeHead(304, { ETag: etag, 'Cache-Control': cc }); res.end(); return selesai(true); }
        res.writeHead(200, { ...dasar, ETag: etag, 'Content-Length': st.size, 'Accept-Ranges': 'none' });
        if (req.method === 'HEAD') { res.end(); return selesai(true); }
        fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
        selesai(true);
      } catch { if (!res.headersSent) { res.writeHead(500); res.end(); } selesai(true); }
    });
  });
}
export const ukuranCache = () => cache.size;
