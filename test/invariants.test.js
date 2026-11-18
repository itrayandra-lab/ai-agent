// Tes invarian lintas lapisan (P0, docs/AUDIT-SINKRONISASI-DAN-RENCANA-MIGRASI.md bagian 5).
// Tiga keadaan yang sengaja kelihatan di laporan:
//   - LULUS     : sinkron sekarang; jika merah berarti ada yang rusak.
//   - DITUNDA   : tes `todo` bertanda [P<fase>]; badan tes memeriksa keadaan sebenarnya dan gagal sampai fase itu selesai.
//                 Tidak dihapus dan tidak dipaksa lulus. Ketika sebuah fase selesai, tes ini lulus sendiri; lalu buang tanda todo.
//   - DIKETAHUI : pelanggaran yang sudah ada (daftar KNOWN di bawah) dilaporkan sebagai todo bertuliskan daftarnya;
//                 pelanggaran BARU di luar daftar membuat tes merah sungguhan.
// Semua tes memakai seed dan folder data sementara, tidak pernah data Owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-invariants-'));
process.env.DATA_DIR = tmp;
process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
process.env.ANTHROPIC_API_KEY = ''; process.env.GROQ_API_KEY = '';
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara saja */ } });

const { buildSeed } = await import('../server/seed.js');
const { starterDb } = await import('../server/workspace.js');
const store = await import('../server/store.js');
const catalog = await import('../server/catalog.js');
const { pickMascotLook, MASCOT_PALETTES } = await import('../public/js/mascot-palettes.js');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const listJs = (dir) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => `${dir}/${String(f).replace(/\\/g, '/')}`) : [];
const STATUSES = ['working', 'meeting', 'chatting', 'idle', 'offline'];   // lima nilai yang dimengerti ruang 3D (office3d.js STATUS_COLOR)
const seed = buildSeed();
const ai = (db) => db.employees.filter((e) => e.type === 'ai');

/** pelanggaran yang sudah ada dan dicatat; tes merah hanya untuk yang baru. */
function knownFailure(t, violations, known, why) {
  const fresh = violations.filter((v) => !known.includes(v));
  assert.deepEqual(fresh, [], `Pelanggaran BARU (di luar daftar yang diketahui): ${fresh.join(', ')}`);
  if (violations.length) {
    t.todo(`DIKETAHUI: ${why}. Daftar: ${violations.join(', ')}`);
    assert.fail(`Pelanggaran yang diketahui: ${violations.join(', ')}`);
  }
}
const phase = (p, why) => ({ todo: `[${p}] ${why}` });

// ───────────────────────── 1. struktur organisasi ─────────────────────────
test('INV1 id karyawan unik, reportsTo menuju id yang ada, tanpa siklus (seed dan ruang kerja baru)', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    const ids = db.employees.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${name}: id ganda`);
    const set = new Set(ids);
    for (const e of db.employees) if (e.reportsTo != null) assert.ok(set.has(e.reportsTo), `${name}: ${e.id} melapor ke ${e.reportsTo} yang tidak ada`);
    const by = new Map(db.employees.map((e) => [e.id, e]));
    for (const e of db.employees) { const seen = new Set(); for (let c = e; c; c = by.get(c.reportsTo)) { assert.ok(!seen.has(c.id), `${name}: siklus di ${e.id}`); seen.add(c.id); } }
  }
});

test('INV2a tiap divisi punya tepat satu manajer AI dan leadId menunjuk dia (seed, 22 divisi)', () => {
  assert.equal(seed.divisions.length, 22);
  for (const d of seed.divisions) {
    const leads = ai(seed).filter((e) => e.divisionId === d.id && e.isLead);
    assert.equal(leads.length, 1, `divisi ${d.id}: ${leads.length} manajer AI`);
    assert.equal(d.leadId, leads[0].id, `divisi ${d.id}: leadId tidak sama dengan manajernya`);
  }
});

test('INV2b manajer tunggal per divisi bila manusia ikut dihitung (satu medan role)', (t) => {
  const bad = seed.divisions.filter((d) => seed.employees.filter((e) => e.divisionId === d.id && e.isLead).length !== 1).map((d) => `divisi ${d.id} punya ${seed.employees.filter((e) => e.divisionId === d.id && e.isLead).map((e) => e.id).join('+')}`);
  knownFailure(t, bad, ['divisi exec punya owner+aria'], 'Executive punya dua pemimpin karena Owner (manusia) juga ber-isLead; P1 menggantinya dengan satu medan `role`');
});

test('INV2c ruang kerja baru berisi 22 divisi', phase('P1', 'starterDb hanya membuat 6 divisi inti; ruang kerja baru wajib 22 divisi'), () => {
  assert.equal(starterDb().divisions.length, 22);
});

test('INV2d aturan satu manajer tetap benar setelah PATCH isLead dan hire', phase('P1', 'PATCH isLead dan hire belum menurunkan pemimpin lama; butuh tes HTTP setelah diperbaiki'), () => {
  assert.fail('belum ada jalur yang menegakkan aturan ini');
});

test('INV3a tepat satu PA per owner dan satu master per ruang kerja', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    for (const o of db.employees.filter((e) => e.type === 'human')) assert.equal(db.employees.filter((e) => e.isPA && e.ownerId === o.id).length, 1, `${name}: PA untuk ${o.id}`);
    assert.equal(db.employees.filter((e) => e.isMaster).length, 1, `${name}: jumlah master`);
  }
});

test('INV3b PA dan master bukan manajer divisi', (t) => {
  const bad = seed.employees.filter((e) => (e.isPA || e.isMaster) && e.isLead).map((e) => `${e.id} (${e.isMaster ? 'master' : 'PA'}) ber-isLead`);
  knownFailure(t, bad, ['aria (master) ber-isLead'], 'master orkestrator aria masih sekaligus manajer divisi Executive; P1 memisahkan lewat medan `role`');
});

// ───────────────────────── 5. bentuk data ─────────────────────────
test('INV5a isLead boolean, divisionId ada di divisions, status dalam lima nilai (seed dan ruang kerja baru)', () => {
  for (const [name, db] of [['seed', seed], ['starterDb', starterDb()]]) {
    const divs = new Set(db.divisions.map((d) => d.id));
    for (const e of db.employees) {
      if (e.isLead !== undefined) assert.equal(typeof e.isLead, 'boolean', `${name}: isLead ${e.id}`);
      assert.ok(divs.has(e.divisionId), `${name}: ${e.id} berdivisi ${e.divisionId} yang tidak ada`);
      assert.ok(STATUSES.includes(e.status), `${name}: status ${e.id} = ${e.status}`);
    }
    for (const d of db.divisions) if (d.leadId) assert.ok(db.employees.some((e) => e.id === d.leadId), `${name}: leadId ${d.leadId}`);
  }
});

test('INV5b pemetaan status workflow ke lima nilai 3D tertutup', phase('P2', 'belum ada modul pemetaan status staf -> lima nilai (dikerjakan bersama staff.run)'), () => {
  assert.fail('belum ada fungsi pemetaan status yang bisa diperiksa');
});

// ───────────────────────── 4. satu id di semua lapisan ─────────────────────────
test('INV4a tiap agen punya tampilan 3D deterministik untuk keluarga palet yang ada', () => {
  const fams = Object.keys(MASCOT_PALETTES);
  assert.ok(fams.length >= 4);
  for (const e of ai(seed)) for (const f of fams) {
    const look = pickMascotLook(e.id, f);
    assert.ok(look && /^#[0-9a-f]{6}$/i.test(look.top), `${e.id}/${f}: tampilan tidak valid`);
    assert.deepEqual(look, pickMascotLook(e.id, f), `${e.id}/${f}: tampilan tidak deterministik`);
  }
  const src = read('public/js/assets3d.js');
  for (const id of ['kiko', 'azure', 'charcoal', 'branch']) assert.ok(src.includes(`'${id}'`), `rangka ${id} hilang dari CHIBI.ids`);
});

test('INV4b tiap staf punya staffId, workflowId, characterId, role', phase('P1', 'medan ini belum ada di data karyawan'), () => {
  for (const e of ai(seed).filter((x) => !x.isPA && !x.isMaster)) for (const k of ['staffId', 'workflowId', 'characterId', 'role']) assert.ok(e[k], `${e.id}.${k}`);
});

test('INV4c himpunan id roster = katalog staf = data = 3D, tanpa katalog yatim', phase('P5', 'katalog staf (server/staff-catalog/) belum diisi untuk semua divisi'), () => {
  const files = listJs('server/staff-catalog').filter((f) => !/index\.js$/.test(f));
  const ids = new Set(files.map((f) => path.basename(f, '.js')));
  const roster = ai(seed).filter((e) => !e.isPA && !e.isMaster).map((e) => e.id);
  assert.deepEqual(roster.filter((id) => !ids.has(id)), [], 'agen tanpa spesifikasi katalog');
  assert.deepEqual([...ids].filter((id) => !roster.includes(id)), [], 'katalog yatim');
});

// ───────────────────────── 6-8. mesin ─────────────────────────
test('INV6a daun melihat kurang dari 8 tool, PA/master/manajer kurang dari 12', phase('P2', 'semua agen AI masih melihat seluruh CAP_IDS'), () => {
  const leaf = seed.employees.find((e) => e.type === 'ai' && !e.isLead && !e.isPA && !e.isMaster);
  const lead = seed.employees.find((e) => e.isLead && e.type === 'ai');
  assert.ok(catalog.defaultTools(leaf).length < 8, `daun melihat ${catalog.defaultTools(leaf).length} tool`);
  assert.ok(catalog.defaultTools(lead).length < 12, `manajer melihat ${catalog.defaultTools(lead).length} tool`);
});

test('INV6b leadOnly dan paOnly ditegakkan (staf tidak melihat recruit_agent)', phase('P2', 'penanda leadOnly/paOnly di catalog.js tidak dipakai mesin'), () => {
  const used = ['server/engine.js', 'server/collab.js', 'server/index.js'].some((f) => /leadOnly|paOnly/.test(read(f)));
  assert.ok(used, 'tidak ada kode yang menyaring tool menurut leadOnly/paOnly');
});

test('INV7 satu gerbang pembuat tugas dengan kuota per ruang kerja; biaya n8n tercatat', phase('P2', 'governor belum mengenal kuota per ruang kerja maupun eksekusi n8n'), () => {
  const gov = read('server/governor.js');
  assert.ok(/quota|kuota/i.test(gov) && /n8n/i.test(gov), 'governor.js tidak menyebut kuota atau n8n');
});

test('INV8 tidak ada store.upsert(\'approvals\' di luar modul persetujuan', phase('P2', 'persetujuan tersebar di beberapa modul; satu modul persetujuan belum ada'), () => {
  const outside = listJs('server').filter((f) => !/\/approvals\.js$/.test(f)).filter((f) => /store\.upsert\(\s*['"]approvals['"]/.test(read(f)));
  assert.deepEqual(outside, [], `upsert approvals di luar modul: ${outside.join(', ')}`);
});

// ───────────────────────── 9. migrasi ─────────────────────────
function lastMigrationVersion() {
  const m = [...read('server/store.js').matchAll(/db\.version\s*=\s*(\d+)\s*;/g)];
  assert.ok(m.length, 'tidak menemukan `db.version = N` di store.js');
  return Math.max(...m.map((x) => Number(x[1])));
}
const fingerprint = (db) => JSON.stringify({ v: db.version, emp: db.employees.map((e) => e.id).sort(), div: db.divisions.map((d) => d.id).sort(), notes: db.notes.map((n) => n.id).sort(), skills: db.skills.map((s) => s.id).sort(), routines: db.routines.map((r) => r.id).sort() });

test('INV9a migrasi idempoten dan tidak menghilangkan id (db lama v8 -> terbaru, dijalankan dua kali)', () => {
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
  const first = store.load();
  const f1 = fingerprint(first);
  const seedIds = buildSeed().employees.map((e) => e.id);
  for (const id of seedIds) assert.ok(first.employees.some((e) => e.id === id), `id ${id} hilang setelah migrasi`);
  assert.equal(first.version, lastMigrationVersion());
  const second = store.load();   // membaca ulang berkas yang sudah termigrasi
  assert.equal(fingerprint(second), f1, 'menjalankan migrasi ulang mengubah hasil');
  assert.deepEqual(second.employees.map((e) => e.id), first.employees.map((e) => e.id));
});

test('INV9b version seed sama dengan migrasi terakhir', (t) => {
  const last = lastMigrationVersion();
  const bad = [];
  if (buildSeed().version !== last) bad.push(`seed v${buildSeed().version} vs migrasi v${last}`);
  if (starterDb().version !== last) bad.push(`starterDb v${starterDb().version} vs migrasi v${last}`);
  knownFailure(t, bad, [`seed v8 vs migrasi v${last}`, `starterDb v10 vs migrasi v${last}`], 'version seed tertinggal dari migrasi terakhir; P1 menyamakan lewat satu fungsi migrate(db)');
});

test('INV9c migrasi berlaku untuk semua ruang kerja (loadWorkspaces)', phase('P1', 'loadWorkspaces tidak menjalankan migrasi; satu fungsi migrate(db) dibutuhkan'), () => {
  const dir = path.join(tmp, 'ws', 'ws-lama-tes');
  fs.mkdirSync(dir, { recursive: true });
  const old = buildSeed(); old.version = 7;
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(old));
  store.loadWorkspaces();
  const got = store.run('ws-lama-tes', () => store.get());
  assert.equal(got.version, lastMigrationVersion(), `ruang kerja lama tetap di v${got.version}`);
});

// ───────────────────────── bendera P0 ─────────────────────────
test('BENDERA settings.staffModel default mati di seed, ruang kerja baru, dan data lama', () => {
  assert.strictEqual(seed.settings.staffModel, false);
  assert.strictEqual(starterDb().settings.staffModel, false);
  assert.equal(typeof store.staffModelOn, 'function');
  fs.writeFileSync(path.join(tmp, 'db.json'), JSON.stringify(buildSeed()));
  const d = store.load();
  assert.strictEqual(store.staffModelOn(), false);
  d.settings.staffModel = 'true';   // hanya boolean true yang menyalakan
  assert.strictEqual(store.staffModelOn(), false);
  d.settings.staffModel = true;
  assert.strictEqual(store.staffModelOn(), true);
  delete d.settings.staffModel;
  assert.strictEqual(store.staffModelOn(), false);
  assert.strictEqual(store.staffModelOn('tidak-ada'), false);
});

// ───────────────────────── 11. regex dan prompt ─────────────────────────
test('INV11a tidak ada pola /s+/ (huruf s, bukan spasi) di server dan klien', () => {
  const suspect = /\.(?:replace|replaceAll|split|match)\(\s*\/(?:s[+*]|\^s[+*]|s[+*]\$)\/[a-z]*/;
  const hits = [];
  for (const f of [...listJs('server'), ...listJs('public/js')]) read(f).split('\n').forEach((line, i) => { if (suspect.test(line)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, []);
});

test('INV11b prompt sistem tidak memuat id agen yang tidak ada', phase('P2', 'prompt masih mencantumkan daftar semua agen dan struktur lama; dirapikan di P2'), () => {
  assert.fail('belum ada penyusun prompt yang bisa diperiksa terhadap roster');
});

// ───────────────────────── 12-13. antarmuka dan publik ─────────────────────────
test('INV12 kata terlarang, nama aksesibel, tanpa emoji ikon/merah, ukuran huruf dan area ketuk di semua layar pengguna', phase('P4', 'hanya pemandu-view.js yang dijaga kamus; layar lain masih penuh jargon'), () => {
  assert.fail('pemindaian seluruh layar menunggu P4');
});

test('INV13 isolasi dua pengguna, tanda tangan hook, kuota 429, n8n mati lalu pulih tanpa duplikasi', phase('P3', 'keamanan publik belum dikerjakan (hook, kuota, batas laju)'), () => {
  assert.fail('belum ada mekanisme yang bisa diuji');
});

test('INV10 status 3D mengikuti setStatus selama staff.run', phase('P2', 'staff.run belum tersambung ke engine'), () => {
  assert.fail('belum ada staff.run yang tersambung ke setStatus');
});

// ───────────────────────── 14. mascot ─────────────────────────
test('INV14 verifikasi mascot V4.2 utuh', () => {
  const r = spawnSync(process.execPath, ['docs/mascot-v4-2/verify-v42.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `verify-v42 gagal:\n${(r.stdout || '').slice(-600)}${(r.stderr || '').slice(-300)}`);
  assert.match(r.stdout, /0 masalah/);
});
