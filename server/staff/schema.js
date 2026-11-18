// Skema spesifikasi staf + pemeriksa. Satu berkas JSON = satu staf = satu alur n8n = satu karakter 3D.
// Dua bentuk sah: RINTISAN (status "todo", hanya identitas) dan LENGKAP (status "siap", semua bidang terisi).
// Dokumen contoh: server/staff-catalog/README.md dan berkas-berkas di server/staff-catalog/{mkt,fin,cs}/.
import * as X from './expr.js';
import { FRAGMENTS, STEP_USES, AI_USES } from './fragments.js';
import { compile, needsAccount } from './blueprint.js';
import * as C from '../n8n-templates/common.js';
import { checkOtak, OTAK_TYPES } from './native.js';

export const SCHEMA_VERSION = 1;
export const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)+$/;
export const FIELD_RE = /^[a-z][a-z0-9_]{0,23}$/;
export const INPUT_TYPES = ['text', 'longtext', 'number', 'choice', 'date', 'url', 'email'];
export const FILE_KINDS = ['csv', 'md', 'txt', 'json', 'html'];
export const RISKS = ['low', 'medium', 'high'];
export const STATUSES = ['todo', 'siap'];

// kata yang tidak boleh sampai ke layar pengguna awam (nama, ringkasan, label)
const JARGON = /\b(n8n|workflow|node|webhook|json|api|token|prompt|agen|task|goal|brain|mcp|payload|endpoint|llm|schema|spreadsheet id)\b/i;
// pola rahasia yang tidak boleh ada di spesifikasi
const SECRET = /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|\bsk-[A-Za-z0-9_-]{16,}|\bgsk_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|\bghp_[A-Za-z0-9]{20,}|bearer\s+[A-Za-z0-9._-]{16,}|(?:api[_-]?key|secret|password|kata\s*sandi|token)\s*["']?\s*[:=]\s*["'][^"']{6,}/i;
// jenis simpul yang boleh muncul di alur hasil kompilasi (daftar putih) dan yang dilarang keras
export const ALLOWED_NODE_TYPES = new Set(['webhook', 'set', 'if', 'httpRequest', 'dataTable', 'noOp', 'switch', 'merge', 'aggregate', 'filter']);
export const FORBIDDEN_NODE = /executeCommand|readWriteFile|readBinaryFile|writeBinaryFile|\bssh\b|ftp|executeWorkflow|localFileTrigger|puppeteer|compression|\bgit\b|code|function|n8n\b|emailSend|rssFeedRead/i;

export const isStub = (s) => s?.status === 'todo';
const todo = (v) => v === undefined || v === null || v === '' || v === 'todo';

/** Periksa satu spesifikasi. Mengembalikan { kind: 'stub'|'ready'|'invalid', errors[], warnings[] }. */
export function validateSpec(spec, { roster } = {}) {
  const errors = [], warnings = [], err = (m) => errors.push(m);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { kind: 'invalid', errors: ['bukan objek JSON'], warnings };
  if (spec.schema !== SCHEMA_VERSION) err(`"schema" harus ${SCHEMA_VERSION}`);
  if (!KEY_RE.test(spec.key || '') || spec.key.length > 60) err('"key" tidak valid (huruf kecil/angka dipisah "-", maks 60)');
  if (!STATUSES.includes(spec.status)) err('"status" harus "todo" atau "siap"');
  if (!spec.division || typeof spec.division !== 'string') err('"division" wajib');
  else if (spec.key && !spec.key.startsWith(spec.division + '-')) err('"key" harus diawali "<division>-"');
  if (roster && spec.employeeId !== null) {
    const e = roster.find((x) => x.id === spec.employeeId);
    if (!e) err(`"employeeId" "${spec.employeeId}" tidak ada di roster`); else if (e.divisionId !== spec.division) err(`"employeeId" milik divisi ${e.divisionId}, bukan ${spec.division}`);
  }
  if (typeof spec.employeeId !== 'string' && spec.employeeId !== null) err('"employeeId" wajib (id karyawan, atau null untuk karakter baru)');
  if (!spec.title || typeof spec.title !== 'string') err('"title" (jabatan) wajib');
  if (SECRET.test(JSON.stringify(spec))) err('terdeteksi pola rahasia (kunci/token/kata sandi) di spesifikasi');
  if (errors.length) return { kind: 'invalid', errors, warnings };
  if (isStub(spec)) return { kind: 'stub', errors, warnings };

  // ── spesifikasi lengkap ──
  const text = (v, label, max) => { if (typeof v !== 'string' || !v.trim() || todo(v)) err(`"${label}" wajib`); else { if (v.length > max) err(`"${label}" maks ${max} karakter`); if (JARGON.test(v)) err(`"${label}" memuat istilah teknis (${v.match(JARGON)[0]}); pakai bahasa awam`); } };
  text(spec.name, 'name', 60); text(spec.ringkas, 'ringkas', 160);
  if (!Array.isArray(spec.kataKunci) || spec.kataKunci.length < 2 || spec.kataKunci.length > 12 || spec.kataKunci.some((k) => typeof k !== 'string' || k.length > 30)) err('"kataKunci" 2–12 kata (dipakai manajer untuk memilih staf)');
  if (!Number.isInteger(spec.version) || spec.version < 1) err('"version" bilangan bulat ≥ 1');

  // masukan
  const inputs = spec.inputs;
  if (!Array.isArray(inputs) || inputs.length > 12) err('"inputs" harus daftar (maks 12)');
  else {
    const seen = new Set();
    for (const f of inputs) {
      if (!FIELD_RE.test(f?.key || '')) { err(`input "${f?.key}" tidak valid`); continue; }
      if (seen.has(f.key)) err(`input "${f.key}" dobel`); seen.add(f.key);
      if (!INPUT_TYPES.includes(f.type)) err(`input "${f.key}": jenis harus salah satu ${INPUT_TYPES.join('/')}`);
      text(f.label, `inputs.${f.key}.label`, 120);
      if (typeof f.required !== 'boolean') err(`input "${f.key}": "required" wajib true/false`);
      if (f.type === 'choice') {
        if (!Array.isArray(f.choices) || f.choices.length < 2 || f.choices.length > 8 || f.choices.some((c) => !c || typeof c.v !== 'string' || typeof c.t !== 'string' || !c.t.trim() || JARGON.test(c.t))) err(`input "${f.key}": pilihan tombol 2–8 buah, masing-masing { v, t } berbahasa awam`);
        else if (f.default !== undefined && !f.choices.some((c) => c.v === f.default)) err(`input "${f.key}": default bukan salah satu pilihan`);
      }
      if (f.contoh !== undefined && typeof f.contoh !== 'string') err(`input "${f.key}": "contoh" harus teks`);
    }
  }

  // langkah n8n
  const steps = spec.steps;
  if (!Array.isArray(steps) || !steps.length || steps.length > 12) err('"steps" harus 1–12 langkah');
  else {
    if (steps.filter((s) => AI_USES.includes(s?.use)).length > 1) err('maksimal satu langkah AI ("minta_ai" atau "otak")');
    const ids = new Set();
    for (const [i, s] of steps.entries()) {
      if (!FRAGMENTS[s?.use]) { err(`langkah ${i + 1}: "use" harus salah satu ${STEP_USES.join('/')}`); continue; }
      if (s.id && ids.has(s.id)) err(`langkah ${i + 1}: id dobel`); ids.add(s.id);
      for (const m of FRAGMENTS[s.use].check(s, spec)) err(`langkah ${i + 1} (${s.use}): ${m}`);
      if (s.use === 'ambil_web') { const f = (inputs || []).find((x) => x.key === s.dari); if (!f || f.type !== 'url') err(`langkah ${i + 1}: "dari" harus input bertipe url`); }
    }
  }

  // keluaran
  const o = spec.output;
  if (!o || typeof o !== 'object') err('"output" wajib');
  else {
    for (const k of ['ringkas', 'teks', 'data']) if (o[k] !== undefined) { const b = X.badExpr(o[k]); if (b) err(`output.${k}: ${b}`); }
    if (!o.ringkas) err('output.ringkas (ekspresi kalimat ringkas hasil) wajib');
    const files = o.berkas || [];
    if (!Array.isArray(files) || files.length > 6) err('output.berkas maks 6');
    else for (const [i, b] of files.entries()) {
      if (!FILE_KINDS.includes(b?.jenis)) err(`output.berkas[${i}].jenis harus salah satu ${FILE_KINDS.join('/')}`);
      for (const k of ['nama', 'isi']) { const m = X.badExpr(b?.[k]); if (m) err(`output.berkas[${i}].${k}: ${m}`); }
    }
    if (!o.teks && !files.length) err('output harus punya "teks" atau minimal satu berkas');
    const types = [o.teks ? 'teks' : null, files.length ? 'berkas' : null, steps?.some((s) => s.use === 'simpan_baris') ? 'data' : null, steps?.some((s) => s.use === 'tulis_sheets') ? 'sheets' : null].filter(Boolean);
    if (!types.length) err('jenis keluaran tidak terdeteksi');
  }

  // jadwal, risiko, akun
  if (!spec.schedule || typeof spec.schedule.allowed !== 'boolean') err('"schedule" wajib: { allowed: true|false }');
  else if (spec.schedule.allowed && steps?.some((s) => AI_USES.includes(s?.use))) err('staf berlangkah AI belum boleh dijadwalkan (butuh server RAIVERSE di tiap jalan)');
  if (!RISKS.includes(spec.risk)) err('"risk" harus low/medium/high');
  if (typeof spec.confirm !== 'boolean') err('"confirm" wajib true/false');
  const effects = (steps || []).map((s) => FRAGMENTS[s?.use]?.effect);
  if (effects.includes('write-external') && spec.risk === 'low') err('langkah yang menulis ke akun luar minimal risk "medium"');
  if (effects.includes('write-external') && !spec.confirm) err('langkah yang menulis ke akun luar wajib "confirm": true');
  if (spec.risk === 'high' && !spec.confirm) err('risk "high" wajib "confirm": true');
  if (spec.needsN8n !== undefined && typeof spec.needsN8n !== 'boolean') err('"needsN8n" harus true/false (true = staf ini butuh jadwal terus-menerus atau pemicu luar, tetap lewat otomasi n8n)');
  if (spec.otakProfil !== undefined) for (const m of checkProfil(spec.otakProfil)) err('otakProfil: ' + m);
  if (!spec.brain || typeof spec.brain !== 'object') err('"brain" wajib: { folder, simpan }');
  else if (typeof spec.brain.simpan !== 'boolean') err('brain.simpan wajib true/false');

  // contoh
  const sample = spec.sample;
  if (!sample?.input || typeof sample.input !== 'object') err('"sample.input" wajib (isian contoh untuk uji)');
  else for (const f of inputs || []) if (f.required && todo(sample.input[f.key])) err(`sample.input.${f.key} wajib`);
  if (!sample?.expect || typeof sample.expect !== 'object') err('"sample.expect" wajib: { berkas?, mengandung?[] }');
  if (steps?.some((s) => AI_USES.includes(s?.use)) && typeof sample?.ai !== 'string') err('"sample.ai" (teks AI contoh untuk uji) wajib bila ada langkah minta_ai');
  if (steps?.some((s) => s?.use === 'ambil_web') && !sample?.web) warnings.push('sample.web disarankan agar uji tidak membuka web nyata');

  // kompilasi percobaan + daftar putih simpul
  if (!errors.length) {
    try {
      const built = compile(spec, { token: 'validator00', tableId: 'T' });
      for (const n of built.nodes) {
        const short = String(n.type).replace(/^n8n-nodes-base\./, '');
        if (!String(n.type).startsWith('n8n-nodes-base.') || FORBIDDEN_NODE.test(short) || !ALLOWED_NODE_TYPES.has(short)) err(`simpul "${n.name}" (${short}) tidak diizinkan`);
        if (SECRET.test(JSON.stringify(n.parameters))) err(`simpul "${n.name}" memuat pola rahasia`);
      }
      if (built.nodes.length > 40) err('hasil kompilasi terlalu besar (>40 simpul)');
    } catch (e) { err('kompilasi gagal: ' + e.message); }
  }
  return { kind: errors.length ? 'invalid' : 'ready', errors, warnings };
}

// ── normalisasi isian pengguna sesuai spesifikasi (dipakai runner, tidak pernah mengirim kode ke n8n)
export class InputError extends Error { constructor(msg, field) { super(msg); this.field = field; this.code = 400; } }
export const parseNumber = (x) => { let s = String(x ?? '').replace(/rp/gi, '').replace(/\s/g, ''); if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.'); else s = s.replace(/,/g, ''); const n = Number(s); return s !== '' && Number.isFinite(n) ? n : NaN; };
/** Kembalikan isian bersih (hanya kunci yang dikenal). checkUrl: async (u) => {ok, reason, url}. */
export async function normalizeInput(spec, raw, { checkUrl } = {}) {
  const out = {}, src = raw && typeof raw === 'object' ? raw : {};
  for (const f of spec.inputs || []) {
    let v = src[f.key]; if (v === undefined || v === null || String(v).trim() === '') v = f.default;
    const empty = v === undefined || v === null || String(v).trim() === '';
    if (empty) { if (f.required) throw new InputError(`Isi dulu: ${f.label}`, f.key); continue; }
    if (f.type === 'longtext') out[f.key] = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').slice(0, f.max || 4000);
    else if (f.type === 'number') { const n = parseNumber(v); if (Number.isNaN(n)) throw new InputError(`${f.label}: tulis angka saja (contoh: 150000)`, f.key); out[f.key] = n; }
    else if (f.type === 'choice') { const c = f.choices.find((x) => x.v === String(v) || x.t === String(v)); if (!c) throw new InputError(`${f.label}: pilih salah satu tombol yang tersedia`, f.key); out[f.key] = c.v; }
    else if (f.type === 'date') { const s = String(v).trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new InputError(`${f.label}: tulis tanggal seperti 2026-11-18`, f.key); out[f.key] = s; }
    else if (f.type === 'email') { const m = C.normEmail(v); if (!m) throw new InputError(`${f.label}: alamat email belum benar`, f.key); out[f.key] = m; }
    else if (f.type === 'url') {
      const s = String(v).trim().slice(0, 500); if (!/^https?:\/\//i.test(s)) throw new InputError(`${f.label}: tulis alamat lengkap diawali https://`, f.key);
      if (checkUrl) { const r = await checkUrl(s); if (!r.ok) throw new InputError(`${f.label}: ${r.reason || 'alamat tidak bisa dibuka'}`, f.key); out[f.key] = r.url || s; } else out[f.key] = s;
    } else out[f.key] = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, f.max || 200);
  }
  return out;
}

/** Cek hasil uji terhadap sample.expect. Mengembalikan '' bila cocok, selain itu alasan. */
export function checkExpect(result, expect = {}) {
  if (!result || result.tahap !== 'selesai') return `hasil bukan "selesai" (${result?.tahap || 'kosong'}${result?.pesan ? ': ' + result.pesan : ''})`;
  const all = JSON.stringify(result);
  if (typeof expect.berkas === 'number' && (result.berkas || []).length !== expect.berkas) return `jumlah berkas ${(result.berkas || []).length}, diharapkan ${expect.berkas}`;
  for (const s of expect.mengandung || []) if (!all.includes(s)) return `hasil tidak memuat "${s}"`;
  return '';
}

/** Tampilan formulir untuk layar depan (bahasa awam, tombol pilihan untuk jenis choice). */
export const formView = (spec) => (spec.inputs || []).map((f) => ({ kunci: f.key, label: f.label, jenis: f.type, wajib: !!f.required, pilihan: f.choices?.map((c) => ({ nilai: c.v, teks: c.t })), contoh: f.contoh, bawaan: f.default }));
export { needsAccount };

/** Periksa blok otakProfil (otak berbasis data). Mengembalikan daftar masalah. */
export function checkProfil(p) {
  const m = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['harus objek'];
  for (const k of ['peran', 'tujuan', 'gaya']) if (typeof p[k] !== 'string' || p[k].trim().length < 5 || p[k].length > 400) m.push('"' + k + '" teks 5-400 huruf');
  const sk = p.skema;
  if (!sk || typeof sk !== 'object' || Array.isArray(sk) || Object.keys(sk).length < 1 || Object.keys(sk).length > 6) m.push('"skema" 1-6 bidang');
  else {
    if (sk.pembahasan !== 'teks') m.push('skema wajib punya "pembahasan": "teks"');
    for (const [k, t] of Object.entries(sk)) if (!FIELD_RE.test(k) || k === 'dariAI' || typeof t !== 'string' || !OTAK_TYPES.test(t)) m.push('bidang skema "' + k + '" tidak valid');
  }
  if (p.contoh !== undefined) for (const k of ['baik', 'buruk']) if (p.contoh?.[k] !== undefined && (typeof p.contoh[k] !== 'string' || p.contoh[k].length > 400)) m.push('contoh.' + k + ' teks maks 400');
  const b = p.batas || {}; if ((b.pembahasan !== undefined && !(b.pembahasan >= 100 && b.pembahasan <= 1500)) || (b.butir !== undefined && !(b.butir >= 1 && b.butir <= 8))) m.push('"batas" pembahasan 100-1500, butir 1-8');
  if (p.model !== undefined && !['kecil', 'sedang'].includes(p.model)) m.push('"model" kecil atau sedang');
  const k = p.kriteria; if (!k || typeof k !== 'object' || !Array.isArray(k.kataKunci) || !k.kataKunci.length || k.kataKunci.length > 5 || k.kataKunci.some((x) => typeof x !== 'string' || !x.trim())) m.push('"kriteria.kataKunci" 1-5 kata wajib');
  else if (!(k.minPanjang >= 10) || !(k.maksPanjang >= k.minPanjang)) m.push('"kriteria" minPanjang >=10 dan maksPanjang >= minPanjang');
  if (typeof p.contohAI !== 'string' || !p.contohAI) m.push('"contohAI" (jawaban AI contoh berupa JSON) wajib');
  else if (sk && typeof sk === 'object' && !m.length && !checkOtak(sk, p.contohAI, {}).dariAI) m.push('"contohAI" tidak sesuai skema');
  return m;
}
