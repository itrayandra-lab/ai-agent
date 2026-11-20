// Lapisan PENYEDIA MODEL untuk obrolan: tingkat model per tugas, bisa diganti tanpa mengubah logika obrolan.
//   cepat  = sapaan, obrolan ringan, pengisian formulir, kompaksi
//   pintar = pertanyaan panjang atau rumit, jawaban setelah alat, penulisan dokumen
// Penyedia mengikuti pengaturan mesin AI yang sudah ada (konsol pengelola: Groq atau Claude). Obrolan tidak menyimpan atau meminta kunci sendiri:
// bila pengelola mengisi kunci Anthropic dan memilih Claude, tingkat berpindah ke model kelas Claude secara otomatis (llm.defaultModels).
import * as llm from './llm.js';

export const penyedia = () => llm.provider();   // 'groq' | 'claude' | 'sim'

/** nama model untuk satu tingkat pada penyedia yang aktif */
export function modelUntuk(tingkat = 'cepat') {
  const d = llm.defaultModels();
  if (tingkat === 'pintar') return d.smart || d.lead;
  return d.small || d.worker;
}
/** streaming kata demi kata asli hanya tersedia di Groq (tanpa skema ketat); penyedia lain memotong balasan utuh */
export const alirAsli = () => penyedia() === 'groq';

/** ringkasan keadaan untuk konsol pengelola dan dokumen; tidak memuat kunci apa pun */
export function info() {
  const p = penyedia();
  return {
    penyedia: p, cepat: p === 'sim' ? null : modelUntuk('cepat'), pintar: p === 'sim' ? null : modelUntuk('pintar'), alirAsli: alirAsli(),
    kelasClaude: p === 'claude',
    catatanMutu: p === 'claude' ? 'Model kelas Claude aktif: mutu penalaran dan kepatuhan instruksi paling baik.' : p === 'groq' ? 'Model gpt-oss aktif: cepat dan murah, tetapi mutu penalaran, kepatuhan format, dan kejujuran lebih rendah daripada model kelas Claude.' : 'Tidak ada model aktif (mode simulasi).',
  };
}
