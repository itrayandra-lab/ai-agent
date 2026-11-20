// Kamus layar depan (sisi peramban). Salinan TERLARANG peladen (server/kamus.js) + kata teknis tambahan.
// test/ui-awam.test.js memastikan salinan ini tidak tertinggal dari server/kamus.js dan memindai SEMUA layar pengguna biasa.
// Jalur pengelola (admin) dikecualikan secara eksplisit lewat DAFTAR_PUTIH_PENGELOLA di bawah, tidak diam-diam.
export const TERLARANG = [
  'agen', 'agent', 'agents', 'goal', 'goals', 'task', 'tasks', 'approval', 'approvals', 'persetujuan', 'mcp', 'tool', 'tools',
  'capability', 'brain', 'second brain', 'knowledge base', 'workspace', 'token', 'tokens', 'model', 'prompt', 'error', 'api', 'json', 'orkestrator', 'orchestrator', 'pemandu',
];
/** kata teknis tambahan yang juga tidak boleh tampil bagi pengguna biasa */
export const TAMBAHAN = ['workflow', 'n8n', 'provider', 'effort', 'endpoint', 'npm', 'localhost', 'webhook', 'api key', 'sse', 'llm', 'groq', 'anthropic', 'jsonl', 'dataset', 'fine-tuning', 'knowledge graph', 'cron', 'orchestrator', 'dashboard', 'chat', 'konsol', 'persona', 'otonomi', 'sandbox', 'review', 'blocked', 'kanban', 'timeline'];
export const SEMUA = [...TERLARANG, ...TAMBAHAN];
const RE = new RegExp(`(?<![\\p{L}\\p{N}])(${SEMUA.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/** daftar kata terlarang yang ditemukan dalam teks (kosong = bersih) */
export const scan = (text) => [...new Set([...String(text ?? '').matchAll(RE)].map((m) => m[1].toLowerCase()))];

/** satu-satunya tempat pengecualian: berkas dan potongan kode yang HANYA bisa dicapai lewat jalur pengelola (#admin) */
export const DAFTAR_PUTIH_PENGELOLA = {
  /** emoji yang memang isi berkas: tabel pemetaan emoji → ikon (icons.js, iconizer.js) dan dunia 3D (papan, gelembung ucapan: office3d.js, chatter.js), bukan ikon antarmuka */
  emoji: ['icons.js', 'iconizer.js', 'office3d.js', 'chatter.js'],
  /** warna 3D (bahan dunia 3D, palet kulit karakter): bukan warna antarmuka, dikecualikan hanya dari tes warna merah */
  warna3d: ['office3d.js', 'environment.js', 'mascot-palettes.js', 'assets3d.js', 'furniture.js', 'props.js', 'life.js', 'people.js'],
  /** berkas pengelola/perkakas, atau bukan milik sesi P4 (tts.js = sesi suara; assets3d.js dan office3d.js = dunia 3D, hanya teks seperlunya) */
  berkas: ['kamus-ui.js', 'studio.js', 'knowledge-view.js', 'browser-view.js', 'admin-view.js', 'admin-bagian.js', 'assets3d.js', 'tts.js'],
  /** di views.js, wilayah antara penanda ini adalah layar lama yang dipindah ke jalur pengelola */
  penanda: ['// <pengelola>', '// </pengelola>'],
};
