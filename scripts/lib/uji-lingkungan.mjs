// Lingkungan terisolasi untuk uji nyata: SALINAN data Owner di folder sementara, model asli lewat kunci dari .env.
// Aturan keras: tidak pernah menulis ke data/ asli, tidak pernah mencetak kunci, hanya GROQ_API_KEY yang dibaca dari .env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const modUrl = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

/** Baca satu kunci dari .env tanpa memuat sisanya dan tanpa mencetaknya. */
export function bacaKunci(nama = 'GROQ_API_KEY') {
  if (process.env[nama]) return process.env[nama];
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] === nama) return m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* tidak ada .env */ }
  return '';
}

/**
 * Siapkan folder data sementara: salinan data/db.json (ruang kerja utama) dengan staffModel menyala, pemakaian di-nolkan, anggaran dibatasi.
 * Mengembalikan { dir, bersihkan() }. Menolak bila folder tujuan sama dengan data asli.
 */
export function siapkanSalinan({ batasUSD = 0.45, model = 'openai/gpt-oss-20b', modelBesar = model, tanpaSalinan = false } = {}) {
  const asli = process.env.RAIVERSE_DATA_SRC ? path.resolve(process.env.RAIVERSE_DATA_SRC) : path.join(ROOT, 'data');   // hanya dibaca
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-uji-nyata-'));
  if (path.resolve(dir) === path.resolve(asli)) throw new Error('Folder uji sama dengan data asli: dibatalkan.');
  if (!tanpaSalinan) {
    const sumber = path.join(asli, 'db.json');
    if (fs.existsSync(sumber)) fs.copyFileSync(sumber, path.join(dir, 'db.json'));   // hanya BACA dari data asli
  }
  const key = bacaKunci('GROQ_API_KEY');
  Object.assign(process.env, { DATA_DIR: dir, RAIVERSE_STAFF_ENGINE: '' });
  delete process.env.RAIVERSE_STAFF_ENGINE;
  process.env.ANTHROPIC_API_KEY = '';
  process.env.GROQ_API_KEY = key;   // hanya di proses ini
  process.env.RAIVERSE_UJI_NYATA = '1';
  return {
    dir, adaKunci: !!key,
    /** setelah store.load(): terapkan pengaturan uji pada salinan di memori */
    terapkan(db) {
      const s = db.settings;
      Object.assign(s, { staffModel: true, provider: key ? 'groq' : 'sim', mode: 'auto', groqModel: modelBesar, groqWorkerModel: model, groqSmartModel: modelBesar, dailyBudgetUSD: batasUSD, apiKey: '', groqApiKey: '', autoApprove: true, autonomy: true, ownerReview: s.ownerReview });
      delete s.staffEngine;
      db.usage = { day: new Date().toISOString().slice(0, 10), costToday: 0, costTotal: 0, tokensIn: 0, tokensOut: 0, calls: 0, byModel: {} };
    },
    bersihkan() { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* biarkan */ } },
  };
}
