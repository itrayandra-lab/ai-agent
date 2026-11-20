// Setiap staf lengkap = satu SKILL di perpustakaan skill (halaman Skill): deskripsi awam + cara memanggil staf yang sebenarnya mengerjakan.
// Dengan begitu skill di website bukan sekadar teks: membukanya (skill_view) memberi agen langkah pasti untuk menjalankan alur nyata.
// Idempoten (dibandingkan lewat tanda tangan isi); hanya memperbarui skill berawalan "staf-" bertanda 'staf'; tidak menyentuh skill lain/ubahan Owner.
import crypto from 'node:crypto';
import * as registry from './registry.js';
import { formView } from './schema.js';

const CATEGORY = { mkt: 'Creative', sales: 'Sales', eng: 'Technical', design: 'Creative', cs: 'Customer', fin: 'Finance', hr: 'People', ops: 'Management', legal: 'Legal', it: 'Technical', data: 'Analysis', rnd: 'Research', mfg: 'Management', qa: 'Technical', reg: 'Legal', scm: 'Management', ecom: 'Sales', kms: 'Strategy', studio: 'Creative', bizdev: 'Sales', retail: 'Sales', exec: 'Strategy', alat: 'Analysis' };
const clip = (s, n) => String(s ?? '').slice(0, n);

export function skillOf(s) {
  const form = formView(s);
  const fields = form.map((f) => `- ${f.kunci} (${f.jenis}${f.wajib ? ', wajib' : ''}): ${f.label}${f.pilihan ? ` [pilihan: ${f.pilihan.map((p) => p.nilai).join('/')}]` : ''}${f.contoh ? ` contoh: ${clip(f.contoh, 60)}` : ''}`).join('\n');
  const out = [s.output?.teks ? 'teks Markdown' : '', ...(s.output?.berkas || []).map((b) => `berkas ${b.jenis}`)].filter(Boolean).join(', ');
  const snippet = `STAF NYATA: "${s.name}" (kunci ${s.key}). Ini bukan saran: memanggil staf ini benar-benar menghitung/menyusun dan mengembalikan ${out || 'hasil'}.\nLANGKAH: 1) Kumpulkan isian dari pengguna (jangan mengarang; tanyakan dengan 2-4 pilihan bila ragu). 2) Panggil staf(aksi:"jalankan", staf:"${s.key}", isian:{...}). 3) Baca hasilnya, jelaskan dengan bahasa sederhana, cantumkan id jalan dan nama berkas di evidence complete_task.\nISIAN:\n${fields || '-'}${s.confirm ? '\nCATATAN: butuh izin Owner sebelum berjalan.' : ''}`;
  return {
    id: `staf-${s.key}`, name: `Staf: ${s.name}`, category: CATEGORY[s.division] || 'Analysis', divisions: s.division === 'alat' ? ['*'] : [s.division], tools: ['staf'], description: clip(s.ringkas, 160),
    promptSnippet: snippet, usageGuide: `Saat pengguna butuh: ${(s.kataKunci || []).join(', ')}.`, example: s.sample?.input ? JSON.stringify(s.sample.input).slice(0, 400) : '', tags: ['staf', 'n8n', s.division], builtIn: true, staffKey: s.key,
  };
}
const sig = (o) => crypto.createHash('sha1').update(JSON.stringify([o.name, o.description, o.promptSnippet, o.usageGuide, o.category])).digest('hex').slice(0, 12);

/** Pasang/perbarui skill staf ke satu ruang kerja dan beri proficiency ke pemilik (9), manajer divisi (7). Mengembalikan { skills, refs, dihapus }. */
export function install(dbObj) {
  if (!dbObj?.skills || !dbObj?.employees) return { skills: 0, refs: 0, dihapus: 0 };
  let skills = 0, refs = 0, dihapus = 0;
  const ready = registry.all().filter(registry.ready), want = new Map(ready.map((s) => [`staf-${s.key}`, s]));
  const byId = new Map(dbObj.skills.map((x) => [x.id, x]));
  for (const [id, s] of want) {
    const n = skillOf(s); n.sig = sig(n); const have = byId.get(id);
    if (!have) { dbObj.skills.push({ ...n, createdAt: Date.now() }); skills++; }
    else if (have.staffKey && have.sig !== n.sig) { Object.assign(have, n, { updatedAt: Date.now() }); skills++; }
  }
  for (const x of [...dbObj.skills]) if (x.staffKey && !want.has(x.id)) { dbObj.skills.splice(dbObj.skills.indexOf(x), 1); dihapus++; }   // spesifikasi dicabut/dikembalikan ke rintisan
  for (const e of dbObj.employees) {
    if (e.type !== 'ai') continue;
    if (!e.staffToolSeeded) { if (Array.isArray(e.tools) && !e.tools.includes('staf')) e.tools.push('staf'); e.staffToolSeeded = true; refs++; }   // kemampuan baru "staf": diberikan sekali; Owner boleh mematikannya lagi
    e.skillRefs ??= [];
    const mine = new Map(e.skillRefs.map((r) => [r.id, r]));
    for (const [id, s] of want) {
      const lvl = s.employeeId === e.id ? 9 : (e.isLead && e.divisionId === s.division) ? 7 : 0;
      if (!lvl) continue;
      const r = mine.get(id);
      if (!r) { const n = { id, proficiency: lvl }; e.skillRefs.push(n); mine.set(id, n); refs++; } else if (Number(r.proficiency) < lvl) { r.proficiency = lvl; refs++; }
    }
    if (dihapus) e.skillRefs = e.skillRefs.filter((r) => !String(r.id).startsWith('staf-') || want.has(r.id));
  }
  return { skills, refs, dihapus };
}
