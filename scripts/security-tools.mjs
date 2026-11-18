// Alat keamanan dan privasi untuk pemilik server (P3). Aman secara bawaan: semua perintah hanya MENGHITUNG kecuali diberi --apply.
// Hentikan server dulu sebelum memakai --apply (server yang berjalan menulis ulang datanya dari memori). Jalankan dengan DATA_DIR untuk memilih folder data.
//   node scripts/security-tools.mjs status                         ringkasan: rahasia yang masih teks biasa, versi kunci, hook lama, ruang kerja terhapus
//   node scripts/security-tools.mjs migrate [--apply]              bungkus ulang kunci AI per ruang kerja + token Drive dengan kunci terbaru (rotasi)
//   node scripts/security-tools.mjs export --email a@b.id          tulis data pribadi satu akun ke stdout (JSON), tanpa token
//   node scripts/security-tools.mjs prune [--apply]                hitung/buang pesan dan kejadian yang melewati batas retensi (kantor utama tidak disentuh)
// Tidak pernah mencetak kunci, token, atau kode undangan.
import fs from 'node:fs';
import path from 'node:path';

const [cmd = 'status', ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(n), opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : ''; };
const apply = flag('--apply');
try { process.loadEnvFile(path.resolve('.env')); } catch { /* tanpa .env */ }
const dataDir = process.env.DATA_DIR || path.resolve('data');
process.env.DATA_DIR = dataDir;
const store = await import('../server/store.js'), auth = await import('../server/auth.js'), privacy = await import('../server/privacy.js'), secure = await import('../server/secure.js');
store.load(); store.loadWorkspaces(); auth.load();

if (cmd === 'status') {
  const out = { dataDir: path.basename(dataDir), versiKunciSekarang: secure.currentKeyId(), ruangKerja: store.ids().length, plan: privacy.migrateSecrets({ apply: false }), retensi: privacy.retention() };
  try { const reg = JSON.parse(fs.readFileSync(path.join(dataDir, 'otomasi.json'), 'utf8')); out.otomasi = { total: reg.items.length, hookLama: reg.items.filter((x) => x.hookLegacy || x.hookToken).length, hookV2: reg.items.filter((x) => x.hookV === 2).length, tokenPolos: reg.items.filter((x) => x.hookToken).length }; } catch { out.otomasi = null; }
  out.ruangKerjaTerhapus = auth.pendingDeletedWs().length;
  console.log(JSON.stringify(out, null, 1));
} else if (cmd === 'migrate') {
  const r = privacy.migrateSecrets({ apply }); console.log(JSON.stringify({ apply, ...r }));
  if (!apply) console.log('Hanya perhitungan. Tambahkan --apply (server berhenti) untuk menulis.');
  else store.saveAll();
} else if (cmd === 'export') {
  const email = String(opt('--email')).toLowerCase(); const u = auth.users().find((x) => String(x.email).toLowerCase() === email);
  if (!u) { console.error('Akun tidak ditemukan.'); process.exit(2); }
  console.log(JSON.stringify(privacy.exportMine(auth.userById(u.id), null), null, 1));
} else if (cmd === 'prune') {
  if (!apply) { console.log('Hanya melaporkan batas retensi; tambahkan --apply untuk membuang.', JSON.stringify(privacy.retention())); }
  else { console.log(JSON.stringify(privacy.prune())); store.saveAll(); }
} else { console.error('Perintah tidak dikenal. Lihat komentar di bagian atas berkas.'); process.exit(1); }
process.exit(0);
