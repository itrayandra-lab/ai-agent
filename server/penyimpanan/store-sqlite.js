// Penyimpanan SQLite per ruang kerja (P7). Satu berkas .sqlite per ruang kerja, memakai node:sqlite bawaan Node (tanpa paket baru).
// Bentuk data: tabel `docs` (satu baris per dokumen untuk koleksi berupa larik objek ber-`id`) dan tabel `kv` (kunci lain: settings, company, dst).
// Simpan = TULIS SELISIH: hanya baris yang isinya berubah yang ditulis (bandingkan dengan salinan teks terakhir), dalam satu transaksi.
// Baca = rakit ulang objek `db` persis seperti yang ditulis (urutan kunci dan urutan larik dipertahankan).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let mod;
/** modul node:sqlite atau null bila Node-nya tidak punya */
export function sqliteModule() {
  if (mod === undefined) { try { mod = process.getBuiltinModule?.('node:sqlite') || null; } catch { mod = null; } }
  return mod;
}
export const available = () => !!sqliteModule()?.DatabaseSync;

const SHAPE = '__shape';
const isDocs = (v) => {
  if (!Array.isArray(v)) return false;
  const seen = new Set();
  for (const x of v) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.id !== 'string' || seen.has(x.id)) return false;
    seen.add(x.id);
  }
  return true;
};

/** buka (atau buat) berkas dan kembalikan penangan penulisan/pembacaan */
export function open(file) {
  if (!available()) throw new Error('node:sqlite tidak tersedia di versi Node ini');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new (sqliteModule().DatabaseSync)(file);
  conn.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=3000;');
  conn.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;');
  conn.exec('CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, seq INTEGER NOT NULL, v TEXT NOT NULL, PRIMARY KEY (coll, id)) WITHOUT ROWID;');
  conn.exec('CREATE INDEX IF NOT EXISTS docs_seq ON docs (coll, seq);');
  const q = {
    kvSet: conn.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
    kvDel: conn.prepare('DELETE FROM kv WHERE k = ?'),
    kvAll: conn.prepare('SELECT k, v FROM kv'),
    docSet: conn.prepare('INSERT INTO docs (coll, id, seq, v) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET seq = excluded.seq, v = excluded.v'),
    docDel: conn.prepare('DELETE FROM docs WHERE coll = ? AND id = ?'),
    docDelColl: conn.prepare('DELETE FROM docs WHERE coll = ?'),
    docColl: conn.prepare('SELECT v FROM docs WHERE coll = ? ORDER BY seq'),
    docCount: conn.prepare('SELECT COUNT(*) AS n FROM docs'),
    one: conn.prepare('SELECT v FROM kv WHERE k = ?'),
  };
  // salinan teks terakhir yang diketahui ada di berkas: kunci -> teks (kv) atau koleksi -> { order:[id], text: Map(id->teks), seq: Map(id->angka), next }
  return { file, conn, q, kv: new Map(), colls: new Map(), shape: null, primed: false, stats: { writes: 0, rowsWritten: 0, lastMs: 0 } };
}
export function close(h) { try { h.conn.close(); } catch { /* sudah tertutup */ } }

/** isi salinan teks dari isi berkas (dipanggil sekali setelah baca, supaya simpan pertama hanya menulis yang beda) */
function prime(h) {
  h.kv.clear(); h.colls.clear();
  for (const r of h.q.kvAll.all()) h.kv.set(r.k, r.v);
  h.shape = h.kv.has(SHAPE) ? JSON.parse(h.kv.get(SHAPE)) : {};
  for (const [k, t] of Object.entries(h.shape)) {
    if (t !== 'docs') continue;
    const st = { order: [], text: new Map(), seq: new Map(), next: 0 };
    let i = 0;
    for (const r of h.conn.prepare('SELECT id, seq, v FROM docs WHERE coll = ? ORDER BY seq').all(k)) { st.order.push(r.id); st.text.set(r.id, r.v); st.seq.set(r.id, r.seq); st.next = Math.max(st.next, r.seq + 1); i++; }
    h.colls.set(k, st);
  }
  h.primed = true;
}

/** apakah berkas sudah berisi data ruang kerja (ada kunci __shape) */
export function hasData(h) { return !!h.q.one.get(SHAPE); }

/** baca seluruh objek db dari berkas */
export function read(h) {
  const shape = JSON.parse(h.q.one.get(SHAPE)?.v ?? '{}');
  const kv = new Map(h.q.kvAll.all().map((r) => [r.k, r.v]));
  const db = {};
  for (const [k, t] of Object.entries(shape)) {
    if (t === 'docs') db[k] = h.q.docColl.all(k).map((r) => JSON.parse(r.v));
    else if (kv.has('k:' + k)) db[k] = JSON.parse(kv.get('k:' + k));
  }
  prime(h);
  return db;
}

/** tulis selisih db ke berkas dalam satu transaksi. Mengembalikan jumlah baris yang ditulis/dihapus. */
export function write(h, db) {
  if (!h.primed) prime(h);
  const t0 = performance.now();
  const shape = {};
  let rows = 0;
  h.conn.exec('BEGIN IMMEDIATE');
  try {
    for (const [k, v] of Object.entries(db)) {
      if (v === undefined) continue;
      if (isDocs(v)) {
        shape[k] = 'docs';
        if (h.kv.has('k:' + k)) { h.q.kvDel.run('k:' + k); h.kv.delete('k:' + k); rows++; }
        let st = h.colls.get(k);
        if (!st) { st = { order: [], text: new Map(), seq: new Map(), next: 0 }; h.colls.set(k, st); }
        const nowIds = v.map((x) => x.id), nowSet = new Set(nowIds);
        // dokumen yang hilang
        for (const id of st.order) if (!nowSet.has(id)) { h.q.docDel.run(k, id); st.text.delete(id); st.seq.delete(id); rows++; }
        // urutan: dokumen lama yang tersisa harus tetap berurutan, dokumen baru di belakang; selain itu nomor urut ditulis ulang
        const kept = nowIds.filter((id) => st.text.has(id));
        let inOrder = true, last = -1;
        for (const id of kept) { const s = st.seq.get(id); if (s < last) { inOrder = false; break; } last = s; }
        let renumber = !inOrder;
        for (let i = 0; i < nowIds.length && !renumber; i++) if (!st.text.has(nowIds[i]) && nowIds.slice(i).some((id) => st.text.has(id))) renumber = true;   // dokumen baru di tengah
        if (renumber) st.next = 0;
        const order = [];
        for (const x of v) {
          const text = JSON.stringify(x);
          const had = st.text.get(x.id);
          let seq = st.seq.get(x.id);
          if (renumber || seq === undefined) seq = st.next++; else st.next = Math.max(st.next, seq + 1);
          if (had !== text || st.seq.get(x.id) !== seq) { h.q.docSet.run(k, x.id, seq, text); rows++; }
          st.text.set(x.id, text); st.seq.set(x.id, seq); order.push(x.id);
        }
        st.order = order;
      } else {
        shape[k] = 'kv';
        const text = JSON.stringify(v);
        if (h.colls.has(k)) { h.q.docDelColl.run(k); h.colls.delete(k); rows++; }
        if (h.kv.get('k:' + k) !== text) { h.q.kvSet.run('k:' + k, text); h.kv.set('k:' + k, text); rows++; }
      }
    }
    // kunci yang sudah tidak ada di db
    for (const k of Object.keys(h.shape || {})) {
      if (k in shape) continue;
      if (h.colls.has(k)) { h.q.docDelColl.run(k); h.colls.delete(k); rows++; }
      if (h.kv.has('k:' + k)) { h.q.kvDel.run('k:' + k); h.kv.delete('k:' + k); rows++; }
    }
    const shapeText = JSON.stringify(shape);
    if (h.kv.get(SHAPE) !== shapeText) { h.q.kvSet.run(SHAPE, shapeText); h.kv.set(SHAPE, shapeText); rows++; }
    h.shape = shape;
    h.conn.exec('COMMIT');
  } catch (err) {
    try { h.conn.exec('ROLLBACK'); } catch { /* tidak ada transaksi */ }
    h.primed = false;   // salinan teks tidak lagi dipercaya
    throw err;
  }
  h.stats.writes++; h.stats.rowsWritten += rows; h.stats.lastMs = performance.now() - t0;
  return rows;
}

/** hash isi logis sebuah objek db (urutan kunci dipertahankan; dipakai pembanding JSON <-> SQLite) */
export const digest = (obj) => {
  const per = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) per[k] = crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  return per;
};
/** bandingkan dua objek db; kembalikan daftar kunci yang berbeda (kosong = cocok) */
export function diffKeys(a, b) {
  const da = digest(a), db = digest(b), bad = [];
  for (const k of new Set([...Object.keys(da), ...Object.keys(db)])) if (da[k] !== db[k]) bad.push(k);
  return bad;
}

/** berkas kecil untuk pemeriksaan cepat: jumlah dokumen */
export const docCount = (h) => h.q.docCount.get().n;
