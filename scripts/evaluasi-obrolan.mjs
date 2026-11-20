// EVALUASI MUTU OBROLAN: 33 percakapan uji (test/fixtures/obrolan-uji.json) dinilai dengan rubrik aturan (server/otak/evaluasi-obrolan.js):
// ketepatan, kejujuran, kejelasan, penggunaan alat, kepatuhan konfirmasi. Berjalan di folder data SEMENTARA; data/ asli tidak disentuh.
//   node scripts/evaluasi-obrolan.mjs --versi baru --batas 0.14         model asli (Groq) lewat kunci di .env; tidak pernah dicetak
//   node scripts/evaluasi-obrolan.mjs --versi lama --batas 0.14         perilaku lama sebagai pembanding
//   node scripts/evaluasi-obrolan.mjs --tiruan                          model tiruan (tanpa biaya): hanya memeriksa pipa evaluasi
//   --id sapa-1,umum-1  hanya percakapan tertentu;  --keluar berkas.json
// Penilaian aturan mengukur hal yang bisa diperiksa mesin; ini bukan pengganti penilaian manusia dan bukan bukti "setara Claude".
import fs from 'node:fs';
import path from 'node:path';
import { siapkanSalinan, modUrl, ROOT } from './lib/uji-lingkungan.mjs';

const arg = (n, d = null) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]); };
const TIRUAN = arg('tiruan') === true;
const VERSI = arg('versi', 'baru') === 'lama' ? 'lama' : 'baru';
const BATAS = Number(arg('batas', 0.14)) || 0.14;
const only = arg('id') && arg('id') !== true ? String(arg('id')).split(',') : null;
const OUT = arg('keluar') && arg('keluar') !== true ? path.resolve(String(arg('keluar'))) : path.join(ROOT, 'docs', 'uji-nyata', `obrolan-${TIRUAN ? 'tiruan' : VERSI}.json`);
process.env.RAY_PROMPT_OBROLAN = VERSI;

const env = siapkanSalinan({ batasUSD: BATAS, tanpaSalinan: true });
if (!TIRUAN && !env.adaKunci) { console.error('Kunci AI tidak ditemukan di .env (GROQ_API_KEY). Evaluasi dibatalkan.'); process.exit(2); }
const store = await import(modUrl('server/penyimpanan/store.js'));
store.load();
env.terapkan(store.get());
if (TIRUAN) store.get().settings.provider = 'sim';
const pm = await import(modUrl('server/pemandu.js'));
const ce = await import(modUrl('server/chat-engine.js'));
const brain = await import(modUrl('server/pengetahuan/brain.js'));
const llm = await import(modUrl('server/otak/llm.js'));
const { nilaiPercakapan, ringkas } = await import(modUrl('server/otak/evaluasi-obrolan.js'));
const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'obrolan-uji.json'), 'utf8'));

if (TIRUAN) {   // model tiruan sederhana: menjawab singkat dan jujur; cukup untuk membuktikan pipa
  pm.setChat(async ({ messages }) => {
    const t = String(messages.at(-1).content);
    return { balasan: /omzet|saldo|laporan|pelanggan terbesar|gaji/i.test(t) ? 'Datanya belum ada di catatanku, bisa kamu bagikan?' : 'Baik, begini penjelasannya.', saran: ['Lanjut bahas'], alat: 'tidak', kueri: '', tambahan: [], kerja: false, judul: '', pilihan: false, kutipan: [] };
  });
}
brain.writeNote({ title: fx.catatan.judul, content: fx.catatan.isi, folder: 'Notes', authorId: 'owner', kb: 'owner' });

const goals = () => store.get().tasks.filter((t) => t.kind !== 'chat').length;
const hasil = []; const mulai = Date.now(); const biaya0 = () => store.get().usage.costToday;
let berhenti = false;
for (const c of fx.percakapan) {
  if (only && !only.includes(c.id)) continue;
  if (biaya0() > BATAS) { berhenti = true; console.log(`[anggaran habis] berhenti sebelum ${c.id}`); break; }
  const sid = `eval-${VERSI}-${c.id}`; const tugas0 = goals();
  const conv = ce.create ? ce.create('owner', {}) : null;
  const sessionId = conv?.id || sid;
  if (c.pakaiSumber) ce.addSources('owner', sessionId, { judul: fx.sumber.judul, teks: fx.sumber.teks });
  const turns = [];
  try {
    for (const t of c.turns) {
      const r = await ce.turn({ userId: 'owner', sessionId, input: t });
      turns.push({ say: r.say || '', kind: r.kind, tools: r.tools || [], kutipan: r.kutipan || [], options: (r.options || []).map((o) => o.label), pilihanGanda: !!r.pilihanGanda, speakers: (r.thread || []).map((m) => m.speaker?.id).filter(Boolean) });
    }
  } catch (err) { turns.push({ say: `[GALAT] ${err.message}`, kind: 'error', tools: [], kutipan: [], options: [] }); }
  const nilai = nilaiPercakapan(c, { turns, tugasBaru: goals() - tugas0, sumberTeks: c.pakaiSumber ? fx.sumber.teks : '', catatanTeks: c.pakaiCatatan ? fx.catatan.isi : '' });
  hasil.push({ ...nilai, jawaban: turns.at(-1)?.say?.slice(0, 600), alatDipakai: turns.flatMap((t) => t.tools.map((x) => x.label)) });
  process.stdout.write(`${nilai.catatan.length ? '✗' : '✓'} ${c.id} `);
}
console.log('');
const ring = ringkas(hasil);
const laporan = { versi: TIRUAN ? 'tiruan' : VERSI, model: TIRUAN ? 'tiruan' : llm.defaultModels().small + ' / ' + llm.defaultModels().smart, jumlah: ring.jumlah, berhentiKarenaAnggaran: berhenti, biayaUSD: Math.round(biaya0() * 1e5) / 1e5, detik: Math.round((Date.now() - mulai) / 1000), skor: ring.per, total: ring.total, gagal: ring.gagal, hasil };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(laporan, null, 2));
const f = (x) => (typeof x === 'number' ? x.toFixed(2) : '-');
console.log(`versi=${laporan.versi} jumlah=${ring.jumlah} biaya=${laporan.biayaUSD} USD`);
console.log(`ketepatan ${f(ring.per.ketepatan)} | kejujuran ${f(ring.per.kejujuran)} | kejelasan ${f(ring.per.kejelasan)} | alat ${f(ring.per.alat)} | konfirmasi ${f(ring.per.konfirmasi)} | respons ${f(ring.per.respons)} | TOTAL ${f(ring.total)}`);
console.log(`hasil lengkap: ${path.relative(ROOT, OUT)}`);
env.bersihkan();
process.exit(0);
