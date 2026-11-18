// Pustaka potongan simpul yang dipakai ulang oleh penulis spesifikasi staf.
// Tiap potongan: { ringkas, tool, effect, check(step) -> daftar masalah, build(step, c) -> { nodes, sim } }
//  - nodes dirangkai berurutan oleh pembangun (simpul pertama = pintu masuk, terakhir = pintu keluar)
//  - sim = isian pengganti simpul berefek keluar saat UJI (tidak ada kontak luar nyata saat uji)
// Aliran data: satu item membawa { ws, user, runId, staf, phase, input, v }. Hasil tiap langkah masuk ke `v`.
import * as X from './expr.js';
import * as C from '../n8n-templates/common.js';

const FIELD = /^[a-z][a-zA-Z0-9_]{0,23}$/;
const typed = (v, type = 'string') => ({ value: v, type });
/** Simpul Set (manual) dengan isian bertipe. keep=true membawa isian lain. */
export const setT = (name, fields, pos, keep = false) => C.node(name, 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: keep, assignments: { assignments: Object.entries(fields).map(([k, f]) => ({ id: C.uuid(), name: k, value: f.value, type: f.type || 'string' })) }, options: {} }, pos);
/** Isian yang selalu dibawa ke simpul berikutnya setelah simpul eksternal (HTTP, tabel) yang menimpa item. */
const carry = (prev, vExpr) => ({
  ws: typed(X.raw(`$('Masukan').item.json.ws`)), user: typed(X.raw(`$('Masukan').item.json.user`)), runId: typed(X.raw(`$('Masukan').item.json.runId`)), staf: typed(X.raw(`$('Masukan').item.json.staf`)),
  phase: typed(X.raw(`$('Masukan').item.json.phase`)), input: typed(X.raw(`$('Masukan').item.json.input`), 'object'), v: typed(X.raw(vExpr), 'object'),
});

export const FRAGMENTS = {
  hitung: {
    ringkas: 'Hitung atau susun data dari isian (rumus, daftar, tabel, teks). Hasil disimpan di v.<nama>.',
    tool: 'Edit Fields', awam: 'Menghitung dan menyusun data', effect: 'none',
    check(step) {
      const p = [];
      if (!step.set || typeof step.set !== 'object' || !Object.keys(step.set).length) return ['langkah "hitung" butuh "set" berisi nama → ekspresi'];
      if (Object.keys(step.set).length > 12) p.push('satu langkah hitung maksimal 12 isian');
      for (const [k, e] of Object.entries(step.set)) { if (!FIELD.test(k)) p.push(`nama isian "${k}" tidak valid`); const b = X.badExpr(e); if (b) p.push(`ekspresi "${k}": ${b}`); }
      return p;
    },
    build(step, c) { return { nodes: [setT(c.uniq(step.label || 'Hitung'), { v: typed(X.accumulate(step.set), 'object') }, c.pos(), true)], sim: {} }; },
  },

  ambil_web: {
    ringkas: 'Buka satu alamat web publik (hanya membaca) dan simpan isinya di v.<simpan> = { status, html }.',
    tool: 'HTTP Request', awam: 'Membuka halaman web (hanya membaca)', effect: 'read',
    check(step) {
      const p = [];
      if (!FIELD.test(step.dari || '')) p.push('"dari" harus nama isian bertipe url');
      if (step.simpan && !FIELD.test(step.simpan)) p.push('"simpan" tidak valid');
      return p;
    },
    build(step, c) {
      const label = c.uniq(step.label || 'Buka halaman'), out = step.simpan || 'web';
      const http = C.node(label, 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: X.raw(`String($json.input[${JSON.stringify(step.dari)}] || '')`), sendHeaders: true, specifyHeaders: 'keypair', headerParameters: { parameters: [{ name: 'User-Agent', value: 'RAIVERSE-Staf/1 (+pembaca halaman)' }] }, options: { timeout: 20000, redirect: { redirect: { maxRedirects: 3 } }, response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } } }, c.pos());
      const prev = c.prevName();
      const tidy = setT(c.uniq(label + ' – rapikan'), carry(prev, `Object.assign({}, $('${prev}').item.json.v, { ${out}: { status: Number($json.statusCode) || 0, html: String($json.body ?? '').slice(0, 250000) } })`), c.pos());
      return { nodes: [http, tidy], sim: { [label]: { body: typed(String(c.spec.sample?.web?.[out] ?? '<html><head><title>Contoh</title></head><body>contoh</body></html>').replace(/^=/, ' =')), statusCode: typed('200', 'number') } } };
    },
  },

  simpan_baris: {
    ringkas: 'Simpan satu baris data (milik ruang kerja ini) ke tabel data bersama. Tidak butuh akun luar.',
    tool: 'Data Table', awam: 'Mencatat ke tabel data', effect: 'write-internal',
    check(step) {
      const b = X.badExpr(step.isi); return b ? [`"isi": ${b}`] : [];
    },
    build(step, c) {
      const label = c.uniq(step.label || 'Simpan ke tabel'), prev = c.prevName();
      const cols = { tenant: X.raw('$json.ws'), staf: c.spec.key, runId: X.raw('$json.runId'), waktu: X.raw('new Date().toISOString()'), isi: X.raw('JSON.stringify(' + X.inner(step.isi) + ').slice(0, 3000)') };
      const table = C.node(label, 'n8n-nodes-base.dataTable', 1.1, { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: c.ctx.tableId || 'TABEL_BELUM_ADA' }, columns: { mappingMode: 'defineBelow', value: cols, matchingColumns: [], schema: [] }, options: {} }, c.pos());
      const tidy = setT(c.uniq(label + ' – rapikan'), carry(prev, `Object.assign({}, $('${prev}').item.json.v, { tersimpan: true })`), c.pos());
      return { nodes: [table, tidy], sim: { [label]: { simpan: typed('ok') } } };
    },
  },

  tulis_sheets: {
    ringkas: 'Tambahkan baris ke Google Sheets lewat konektor Google milik pengguna. Butuh akun Google tersambung; selalu salinan per ruang kerja.',
    tool: 'Google Sheets (konektor Google)', awam: 'Menulis ke Google Sheets milikmu', effect: 'write-external', account: 'google',
    check(step) {
      const p = []; if (!step.sheet || !/^[\p{L}\p{N} _-]{1,60}$/u.test(step.sheet)) p.push('"sheet" wajib (huruf/angka, maks 60)');
      if (!Array.isArray(step.kolom) || !step.kolom.length || step.kolom.length > 12) p.push('"kolom" 1–12 nama kolom');
      const b = X.badExpr(step.baris); if (b) p.push(`"baris": ${b}`);
      return p;
    },
    build(step, c) {
      const label = c.uniq(step.label || 'Tulis ke Sheets'), prev = c.prevName();
      const rowExpr = X.raw('JSON.stringify({ action: "sheets.append", payload: { spreadsheet_name: ' + JSON.stringify(step.spreadsheet || 'RAIVERSE - Data') + ', sheet_name: ' + JSON.stringify(step.sheet) + ', headers: ' + JSON.stringify(step.kolom) + ', rows: ' + X.inner(step.baris) + ' } })');
      const http = C.node(label, 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: c.ctx.googleUrl || 'https://script.google.com/BELUM-TERSAMBUNG', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, specifyBody: 'json', jsonBody: rowExpr, options: { timeout: 30000, redirect: { redirect: { followRedirects: true, maxRedirects: 5 } } } }, c.pos(), c.ctx.googleCred ? { credentials: { httpCustomAuth: c.ctx.googleCred } } : {});
      const tidy = setT(c.uniq(label + ' – rapikan'), carry(prev, `Object.assign({}, $('${prev}').item.json.v, { sheets: true })`), c.pos());
      return { nodes: [http, tidy], sim: { [label]: { tulis: typed('ok') } } };
    },
  },

  // Langkah AI: n8n TIDAK memegang kunci AI. Alur berhenti di sini dan mengembalikan permintaan; server RAIVERSE yang memanggil model
  // (lewat gerbang yang dijaga governor), lalu memanggil alur lagi dengan fase "selesaikan" membawa teks hasilnya di v.ai.
  minta_ai: {
    ringkas: 'Minta model bahasa menulis/menganalisis. Dipanggil oleh server RAIVERSE (bukan oleh n8n). Hasilnya tersedia di v.ai pada langkah sesudahnya.',
    tool: 'AI lewat gerbang RAIVERSE', awam: 'Menulis dengan bantuan AI', effect: 'llm',
    check(step) {
      const p = [];
      for (const k of ['sistem', 'perintah']) { const b = X.badExpr(step[k]); if (b) p.push(`"${k}": ${b}`); }
      if (step.maxToken !== undefined && !(step.maxToken >= 100 && step.maxToken <= 3000)) p.push('"maxToken" 100–3000');
      return p;
    },
    build(step, c) {
      const label = c.uniq(step.label || 'Minta AI');
      const n = setT(label, { tahap: typed('minta_ai'), runId: typed(X.raw('$json.runId')), staf: typed(X.raw('$json.staf')), state: typed(X.raw('({ v: $json.v, input: $json.input })'), 'object'), llm: typed(X.raw(`({ system: ${X.inner(step.sistem)}, prompt: ${X.inner(step.perintah)}, maxTokens: ${Math.round(step.maxToken || 900)} })`), 'object') }, c.pos());
      return { nodes: [n], sim: {} };
    },
  },
};

// Langkah OTAK (mesin native): AI sebagai pengisi dan pembahas, aturan sebagai kerangka. Jawaban AI wajib JSON sesuai "skema"; bagian yang
// salah/kosong diganti hasil "cadangan" (aturan). Hasil di v.<simpan> = { ...bidang, dariAI }. Model kecil bawaan, biaya dan kuota dicatat per ruang kerja.
// Di alur n8n (kompatibel mundur) langkah ini dikompilasi seperti minta_ai lalu v.<simpan> diisi hasil "cadangan" saja (dariAI:false).
/** Isi kosong yang masuk akal per jenis bidang skema (dipakai mesin native dan cadangan n8n supaya bentuknya sama). */
export const otakEmpty = (type) => (type === 'angka' ? 0 : type === 'daftar' ? [] : String(type).startsWith('pilihan:') ? String(type).slice(8).split('|')[0] : '');
export const otakDefaults = (skema) => Object.fromEntries(Object.entries(skema || {}).map(([k, t]) => [k, otakEmpty(t)]));
const OTAK_FIELD_TYPE = /^(teks|angka|daftar|pilihan:[^|]{1,30}(\|[^|]{1,30}){1,7})$/;
FRAGMENTS.otak = {
  ringkas: 'Minta AI berpikir (menulis, merangkum, membahas) dengan jawaban terstruktur yang diperiksa; aturan cadangan dipakai bila AI tidak tersedia atau salah format. Hasil di v.<simpan>.',
  tool: 'AI lewat gerbang RAIVERSE', awam: 'Berpikir dan menulis dengan bantuan AI (hasilnya diperiksa)', effect: 'llm',
  check(step) {
    const p = [];
    if (!FIELD.test(step.simpan || '')) p.push('"simpan" harus nama isian valid');
    for (const k of ['sistem', 'perintah']) { const b = X.badExpr(step[k]); if (b) p.push(`"${k}": ${b}`); }
    if (step.cadangan !== undefined) { const b = X.badExpr(step.cadangan); if (b) p.push(`"cadangan": ${b}`); }
    const sk = step.skema;
    if (!sk || typeof sk !== 'object' || Array.isArray(sk) || !Object.keys(sk).length || Object.keys(sk).length > 8) p.push('"skema" 1–8 bidang { nama: teks|angka|daftar|pilihan:a|b }');
    else for (const [k, t] of Object.entries(sk)) { if (!FIELD.test(k) || k === 'dariAI') p.push(`bidang skema "${k}" tidak valid`); if (typeof t !== 'string' || !OTAK_FIELD_TYPE.test(t)) p.push(`bidang skema "${k}": jenis harus teks, angka, daftar, atau pilihan:a|b`); }
    if (step.maxToken !== undefined && !(step.maxToken >= 100 && step.maxToken <= 3000)) p.push('"maxToken" 100–3000');
    if (step.model !== undefined && !['kecil', 'sedang'].includes(step.model)) p.push('"model" harus kecil atau sedang');
    return p;
  },
  build: (step, c) => FRAGMENTS.minta_ai.build(step, c),
};

export const STEP_USES = Object.keys(FRAGMENTS);
/** Langkah yang memanggil AI (alur n8n dua tahap). */
export const AI_USES = ['minta_ai', 'otak'];
/** Alat dalam bahasa awam untuk layar depan (tanpa nama teknis). */
export const awamTools = (spec) => [...new Set((spec.steps || []).map((s) => FRAGMENTS[s.use]?.awam).filter(Boolean))];
export const toolNames = (spec) => [...new Set(['Webhook', 'Edit Fields', 'If', ...(spec.steps || []).map((s) => FRAGMENTS[s.use]?.tool).filter(Boolean)])];
