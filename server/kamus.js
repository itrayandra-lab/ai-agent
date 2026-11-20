// Kamus bahasa Pemandu (docs/PEMANDU-ALUR-AWAM.md bagian 7): kata yang tidak boleh muncul di wajah antarmuka pengguna awam.
// Dipakai tes otomatis (test/pemandu.test.js) dan penyaring keluaran model kecil.
export const TERLARANG = [
  'agen', 'agent', 'agents', 'goal', 'goals', 'task', 'tasks', 'approval', 'approvals', 'persetujuan', 'mcp', 'tool', 'tools',
  'capability', 'brain', 'second brain', 'knowledge base', 'workspace', 'token', 'tokens', 'model', 'prompt', 'error', 'api', 'json', 'orkestrator', 'orchestrator', 'pemandu',
];
const RE = new RegExp(`(?<![\\p{L}\\p{N}])(${TERLARANG.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/** daftar kata terlarang yang ditemukan dalam teks (kosong = bersih) */
export const scan = (text) => [...new Set([...String(text ?? '').matchAll(RE)].map((m) => m[1].toLowerCase()))];
export const bersih = (text) => scan(text).length === 0;
