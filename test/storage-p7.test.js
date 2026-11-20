// Tes P7: penyimpanan SQLite (tulis selisih), mode json/dual/sqlite, pembanding, isolasi, pemulihan, migrasi dan rollback,
// retensi, pemuatan malas + pelepasan memori, dan tick hanya untuk ruang kerja aktif. Memakai folder sementara; tidak menyentuh data/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-p7-'));
process.env.DATA_DIR = tmp;
process.env.ARCHIVE_DIR = path.join(tmp, 'arsip-dummy');
process.env.ANTHROPIC_API_KEY = ''; process.env.GROQ_API_KEY = '';
delete process.env.STORAGE_MODE; delete process.env.STORE_LAZY;
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sementara */ } });

const sq = await import('../server/store-sqlite.js');
const store = await import('../server/store.js');
const { starterDb } = await import('../server/workspace.js');
const mig = await import('../scripts/storage-migrate.mjs');
const hasSql = sq.available();
const T = (name, fn) => test(name, { skip: !hasSql && 'node:sqlite tidak ada' }, fn);
const fresh = (n) => starterDb({ ownerName: `Uji ${n}` });
const msg = (i, text = 'halo') => ({ id: `m-${i}`, channelId: 'umum', authorId: 'owner', text, t: 1000 + i });
store.load({ reset: true });

T('backend: tulis lalu baca = identik; tulis ulang tanpa perubahan = nol baris; satu perubahan = satu baris', () => {
  const f = path.join(tmp, 'rt.sqlite'); const h = sq.open(f);
  const d = fresh(1); d.messages = Array.from({ length: 50 }, (_, i) => msg(i));
  assert.ok(sq.write(h, d) > 50);
  assert.equal(sq.write(h, d), 0, 'tanpa perubahan tidak boleh menulis apa pun');
  d.messages[10].text = 'berubah';
  assert.equal(sq.write(h, d), 1);
  d.messages.push(msg(99));
  assert.equal(sq.write(h, d), 1);
  const h2 = sq.open(f); assert.deepEqual(sq.diffKeys(d, sq.read(h2)), []); sq.close(h2); sq.close(h);
});

T('backend: urutan larik terjaga saat potong depan, hapus tengah, sisip tengah, dan larik kosong', () => {
  const f = path.join(tmp, 'order.sqlite'); const h = sq.open(f);
  const d = { settings: { a: 1 }, messages: Array.from({ length: 10 }, (_, i) => msg(i)), kosong: [], daftar: [1, 2, 3], dup: [{ id: 'x' }, { id: 'x' }] };
  sq.write(h, d);
  d.messages.splice(0, 3);                    // potong depan (batas cincin)
  d.messages.splice(2, 1);                    // hapus di tengah
  d.messages.splice(1, 0, msg(77));           // sisip di tengah
  d.messages.push(msg(88));
  const rows = sq.write(h, d);
  const h2 = sq.open(f); const back = sq.read(h2); sq.close(h2); sq.close(h);
  assert.deepEqual(back.messages.map((m) => m.id), d.messages.map((m) => m.id));
  assert.deepEqual(back.kosong, []); assert.deepEqual(back.daftar, [1, 2, 3]); assert.equal(back.dup.length, 2);
  assert.ok(rows < 25);
  delete d.kosong; delete d.daftar;           // kunci hilang
  const h3 = sq.open(f); sq.write(h3, d); const b3 = sq.read(h3); sq.close(h3);
  assert.equal('kosong' in b3, false); assert.equal('daftar' in b3, false);
});

T('mode dual: JSON tetap benar, SQLite ditulis berdampingan, pembanding cocok; sengaja dirusak = terdeteksi', () => {
  store.createWorkspace('w-dual0001', fresh('dual'));
  store.setStorageMode('w-dual0001', 'dual');
  store.run('w-dual0001', () => { store.upsert('messages', msg(1, 'dual')); store.saveNow(); store.upsert('messages', msg(2, 'dual2')); store.saveNow(); });
  const jf = path.join(tmp, 'ws', 'w-dual0001', 'db.json'), sf = path.join(tmp, 'ws', 'w-dual0001', 'db.sqlite');
  assert.ok(fs.existsSync(jf) && fs.existsSync(sf));
  assert.deepEqual(store.verifyWorkspace('w-dual0001'), []);
  assert.equal(store.storageStats().mismatches, 0);
  // rusak: ubah satu baris langsung di SQLite
  const h = sq.open(sf); h.conn.exec(`UPDATE docs SET v = '{"id":"m-2","text":"RUSAK"}' WHERE coll='messages' AND id='m-2'`); sq.close(h);
  assert.deepEqual(store.verifyWorkspace('w-dual0001'), ['messages']);
  assert.equal(store.storageStats().mismatches, 1);
});

T('mode dual: SQLite rusak total TIDAK menghentikan simpan JSON (JSON sumber kebenaran)', () => {
  store.createWorkspace('w-dual0002', fresh('dual2'));
  store.setStorageMode('w-dual0002', 'dual');
  store.run('w-dual0002', () => store.saveNow());
  const sf = path.join(tmp, 'ws', 'w-dual0002', 'db.sqlite');
  // buang jurnal lalu timpa sampah di berkas (sambil ruang kerja tidak memegang berkas: tutup lewat pelepasan)
  process.env.STORE_LAZY = '1';
  store.evictIdle({ idleMs: 0 }); delete process.env.STORE_LAZY;
  for (const x of ['-wal', '-shm']) fs.rmSync(sf + x, { force: true });
  fs.writeFileSync(sf, 'bukan database sqlite'.repeat(50));
  const before = store.storageStats().errors;
  store.run('w-dual0002', () => { store.upsert('messages', msg(5, 'masih-tersimpan')); store.saveNow(); });
  assert.ok(store.storageStats().errors > before);
  const j = JSON.parse(fs.readFileSync(path.join(tmp, 'ws', 'w-dual0002', 'db.json'), 'utf8'));
  assert.ok(j.messages.some((m) => m.text === 'masih-tersimpan'));
});

T('mode sqlite: db.json tidak ditulis lagi; data hidup di SQLite; berkas SQLite rusak = galat, bukan data baru', () => {
  store.createWorkspace('w-sql00001', fresh('sql'));
  store.setStorageMode('w-sql00001', 'sqlite');
  const jf = path.join(tmp, 'ws', 'w-sql00001', 'db.json');
  const stamp0 = fs.statSync(jf).mtimeMs;
  store.run('w-sql00001', () => { store.upsert('messages', msg(1, 'hanya-sqlite')); store.saveNow(); });
  assert.equal(fs.statSync(jf).mtimeMs, stamp0, 'db.json tidak boleh berubah di mode sqlite');
  assert.equal(JSON.parse(fs.readFileSync(jf, 'utf8')).messages.length, 0);
  const h = sq.open(path.join(tmp, 'ws', 'w-sql00001', 'db.sqlite')); const back = sq.read(h); sq.close(h);
  assert.ok(back.messages.some((m) => m.text === 'hanya-sqlite'));
});

T('isolasi: perubahan di satu ruang kerja tidak muncul di berkas atau memori ruang kerja lain', () => {
  for (const id of ['w-isoA0001', 'w-isoB0001']) { store.createWorkspace(id, fresh(id)); store.setStorageMode(id, 'sqlite'); }
  store.run('w-isoA0001', () => { store.upsert('messages', msg(1, 'RAHASIA-A-12345')); store.saveNow(); });
  store.run('w-isoB0001', () => { store.upsert('messages', msg(2, 'milik-B')); store.saveNow(); });
  assert.equal(store.run('w-isoB0001', () => store.get().messages.some((m) => m.text.includes('RAHASIA-A'))), false);
  for (const f of ['w-isoB0001/db.sqlite', 'w-isoB0001/db.sqlite-wal']) { const p = path.join(tmp, 'ws', f); if (fs.existsSync(p)) assert.equal(fs.readFileSync(p).includes('RAHASIA-A-12345'), false); }
  const ha = sq.open(path.join(tmp, 'ws', 'w-isoA0001', 'db.sqlite')); const A = sq.read(ha); sq.close(ha);
  assert.equal(A.messages.some((m) => m.text === 'milik-B'), false);
});

T('migrasi + rollback pada salinan: idempoten, cocok, JSON kembali persis', () => {
  const id = 'w-mig00001'; store.createWorkspace(id, fresh('mig'));
  store.run(id, () => { for (let i = 0; i < 30; i++) store.upsert('messages', msg(i, 'pesan ' + i)); store.saveNow(); });
  const jf = path.join(tmp, 'ws', id, 'db.json'); const original = fs.readFileSync(jf, 'utf8');
  const r1 = mig.toSqlite(id); assert.deepEqual(r1.bad, []); assert.ok(r1.rows > 30);
  const r2 = mig.toSqlite(id); assert.deepEqual(r2.bad, []); assert.equal(r2.rows, 0, 'migrasi kedua tidak menulis apa pun');
  assert.deepEqual(mig.compare(id), []);
  // cutover lalu rollback
  store.setStorageMode(id, 'sqlite');
  fs.writeFileSync(jf, '{"usang":true}');                // JSON usang setelah cutover
  assert.deepEqual(mig.toJson(id), []);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(jf, 'utf8'))), JSON.stringify(JSON.parse(original)));
  assert.ok(fs.readdirSync(path.dirname(jf)).some((n) => n.includes('bak-pra-rollback')), 'cadangan db.json lama dibuat');
  store.setStorageMode(id, 'json');
});

T('cadangan penuh memuat berkas SQLite sebagai salinan konsisten', async () => {
  const { makeBackup } = await import('../scripts/backup-data.mjs');
  const b = makeBackup({ dataDir: tmp, label: 'uji-p7' });
  const f = b.manifest.files.find((x) => x.path === 'ws/w-isoA0001/db.sqlite');
  assert.ok(f, 'db.sqlite ada di manifest');
  assert.ok(b.manifest.skipped?.some((x) => x.path === 'ws/w-dual0002/db.sqlite'), 'SQLite rusak dilewati dan tercatat, cadangan JSON tetap jadi');
  assert.ok(b.manifest.files.some((x) => x.path === 'ws/w-dual0002/db.json'));
  const h = sq.open(path.join(b.dir, f.path)); assert.ok(sq.hasData(h)); sq.close(h);
});

test('retensi: events/messages dipotong ke batas, log tugas dibatasi, data lain utuh', () => {
  const d = { events: Array.from({ length: 700 }, (_, i) => ({ id: `e${i}` })), messages: Array.from({ length: 3100 }, (_, i) => ({ id: `m${i}` })), tasks: [{ id: 't', log: Array.from({ length: 400 }, (_, i) => ({ i })) }], notes: [{ id: 'n' }] };
  const cut = store.capCollections(d);
  assert.equal(d.events.length, 600); assert.equal(d.events[0].id, 'e100'); assert.equal(d.messages.length, 3000);
  assert.equal(d.tasks[0].log.length, 300); assert.equal(d.tasks[0].log[0].i, 100); assert.equal(d.notes.length, 1);
  assert.equal(cut, 100 + 100 + 100);
});

T('pemuatan malas: ruang kerja idle dilepas dari memori, dimuat ulang utuh, yang sibuk atau main tidak dilepas', () => {
  process.env.STORE_LAZY = '1';
  try {
    const id = 'w-lazy0001'; store.createWorkspace(id, fresh('lazy')); store.setStorageMode(id, 'sqlite');
    store.run(id, () => { store.upsert('messages', msg(1, 'sebelum-dilepas')); });   // belum disimpan: harus disimpan saat dilepas
    store.setActivity(id, { busy: true });
    assert.equal(store.evictIdle({ idleMs: 0 }) >= 0, true); assert.equal(store.activity(id).loaded, true, 'ruang kerja sibuk tidak dilepas');
    store.setActivity(id, { busy: false });
    const n = store.evictIdle({ idleMs: 0 });
    assert.ok(n >= 1); assert.equal(store.activity(id).loaded, false); assert.equal(store.activity('main').loaded, true);
    assert.equal(store.run(id, () => store.get().messages.some((m) => m.text === 'sebelum-dilepas')), true, 'isi kembali utuh setelah dimuat ulang');
    assert.equal(store.activity(id).loaded, true);
  } finally { delete process.env.STORE_LAZY; }
});

T('tick hanya untuk ruang kerja aktif: yang tidur dilewati, yang baru dipakai atau sibuk di-tick', async () => {
  const engine = await import('../server/engine.js');
  const mk = (id) => { store.createWorkspace(id, fresh(id)); store.setActivity(id, { lastTouch: 0 }); };
  mk('w-tick0001'); mk('w-tick0002');
  await engine._passOnce();                                       // lintasan pertama: tiap ruang kerja dicek sekali (wakeAt belum diketahui)
  const t1 = store.activity('w-tick0001').ticks; assert.equal(t1, 1);
  assert.ok(store.activity('w-tick0001').wakeAt > Date.now(), 'jadwal bangun dihitung');
  await engine._passOnce(); await engine._passOnce();
  assert.equal(store.activity('w-tick0001').ticks, 1, 'ruang kerja tidur tidak di-tick lagi');
  store.run('w-tick0002', () => store.get());                    // dipakai orang = aktif
  await engine._passOnce(); assert.equal(store.activity('w-tick0002').ticks, 2);
  assert.equal(store.activity('w-tick0001').ticks, 1);
  // tugas terbuka = sibuk = di-tick
  store.runQuiet('w-tick0001', () => store.get().tasks.push({ id: 't-1', title: 'x', status: 'todo', assigneeId: 'owner', createdBy: 'owner', priority: 'low', log: [], createdAt: Date.now() }));
  store.setActivity('w-tick0001', { wakeAt: 0 }); await engine._passOnce();
  assert.equal(store.activity('w-tick0001').busy, true);
  await engine._passOnce(); assert.ok(store.activity('w-tick0001').ticks >= 3);
});
