// Pembuat rintisan staf: satu berkas server/staff-catalog/<divisi>/<divisi>-<karyawan>.json untuk SETIAP karyawan AI non-manajer,
// ditambah _divisi.json per divisi (manifest + manajer). TIDAK PERNAH menimpa berkas yang sudah ada (spesifikasi yang sudah diisi aman).
// Pakai:  node scripts/staff-stubs.mjs            (buat yang belum ada)
//         node scripts/staff-stubs.mjs --dry      (hanya hitung)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../server/seed.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'staff-catalog');
const dry = process.argv.includes('--dry');
const seed = buildSeed();
const ai = seed.employees.filter((e) => e.type === 'ai');
const staff = ai.filter((e) => !e.isLead && !e.isMaster && !e.isPA);
let made = 0, kept = 0;
const put = (file, obj) => { if (fs.existsSync(file)) { kept++; return false; } if (!dry) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); } made++; return true; };

for (const e of staff) {
  const key = `${e.divisionId}-${e.id}`;
  put(path.join(root, e.divisionId, `${key}.json`), {
    schema: 1, status: 'todo', key, division: e.divisionId, employeeId: e.id, title: e.title,
    name: 'todo', ringkas: 'todo', kataKunci: 'todo', version: 1, inputs: 'todo', steps: 'todo', output: 'todo', schedule: 'todo', risk: 'todo', confirm: 'todo', brain: 'todo', sample: 'todo',
    konteks: { karakter: e.name, tugasPeran: String(e.taskAndFunction || '').split(/\.\s+/).filter(Boolean).slice(0, 5).map((s) => s.replace(/\.$/, '')), keahlian: (e.skills || []).slice(0, 6), contohTugas: (e.starters || []).slice(0, 3) },
  });
}
for (const d of seed.divisions) {
  const lead = ai.find((e) => e.divisionId === d.id && e.isLead);
  const keys = staff.filter((e) => e.divisionId === d.id).map((e) => `${d.id}-${e.id}`);
  if (!keys.length && !lead) continue;
  put(path.join(root, d.id, '_divisi.json'), {
    id: d.id, nama: d.name, misi: d.mission, manajer: lead ? { id: lead.id, nama: lead.name, jabatan: lead.title } : null, staf: keys,
    catatan: 'Isi rintisan staf divisi ini. Boleh menambah staf tambahan (kunci baru "<divisi>-<karyawan>-<topik>") untuk pekerjaan spesifik, ditugaskan ke karakter yang paling cocok.',
  });
}
const per = {}; for (const e of staff) per[e.divisionId] = (per[e.divisionId] || 0) + 1;
console.log(JSON.stringify({ staf: staff.length, manajer: ai.filter((e) => e.isLead).length, dibuat: made, dilewati: kept, perDivisi: per, dry }));
