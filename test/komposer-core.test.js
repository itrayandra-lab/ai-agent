// Logika komposer bersama (Obrolan + dock Kantor 3D): penerima, izin tiga kata, status, riwayat, keadaan mengetik. Modul murni: dites di Node tanpa DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-komposer-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const K = await import('../public/js/komposer-core.js');
const store = await import('../server/penyimpanan/store.js');
const ce = await import('../server/chat-engine.js');
store.load();

test('izin tiga kata: nilai dari pengaturan (termasuk pengaturan lama), pilihan sesuai peran, "Serahkan penuh" hanya pengelola', () => {
  assert.deepEqual(K.IZIN.map((o) => o.label), ['Tanya dulu', 'Lanjut sendiri', 'Serahkan penuh']);
  assert.equal(K.izinSaatIni({ permission: 'ask' }), 'ask'); assert.equal(K.izinSaatIni({ permission: 'full' }), 'full');
  assert.equal(K.izinSaatIni({}), 'auto'); assert.equal(K.izinSaatIni({ autoApprove: false }), 'ask'); assert.equal(K.izinSaatIni({ permission: 'aneh' }), 'auto');
  assert.deepEqual(K.izinOpsi(false).map((o) => o.nilai), ['ask', 'auto']); assert.deepEqual(K.izinOpsi(true).map((o) => o.nilai), ['ask', 'auto', 'full']);
  assert.equal(K.izinSah('full', false), 'auto'); assert.equal(K.izinSah('full', true), 'full'); assert.equal(K.izinSah('ask', false), 'ask');
});

test('penerima: kosong = otomatis, satu = orang itu, banyak = rapat; label dan bentuk server konsisten', () => {
  const nama = (id) => ({ hendra: 'Hendra', ratih: 'Ratih Kusuma', alya: 'Alya', rudi: 'Rudi', maya: 'Maya' }[id]);
  assert.equal(K.modeDari([]), 'auto'); assert.equal(K.modeDari(['hendra']), 'agen'); assert.equal(K.modeDari(['hendra', 'ratih']), 'tim');
  assert.equal(K.labelTarget({ ids: [], nama }), 'Ke: aray'); assert.equal(K.labelTarget({ ids: ['hendra'], nama }), 'Ke: Hendra');
  assert.equal(K.labelTarget({ ids: ['hendra', 'ratih'], nama }), 'Ke: Hendra, Ratih (rapat)');
  assert.match(K.labelTarget({ ids: ['hendra', 'ratih', 'alya', 'rudi'], nama }), /\+1 \(rapat\)$/);
  assert.deepEqual(K.targetKeServer([]), { tujuan: 'auto', agen: [], eksplisit: false }); assert.deepEqual(K.targetKeServer(['hendra']), { tujuan: 'agen', agen: ['hendra'], eksplisit: true });
  assert.deepEqual(K.targetKeServer(['a', 'b', 'c', 'd', 'e']), { tujuan: 'auto', agen: ['a', 'b', 'c', 'd'], eksplisit: true }, 'paling banyak empat; banyak orang tidak memaksa rapat tiap pesan');
  assert.deepEqual(K.targetDariServer({ peserta: [{ id: 'hendra' }, { id: 'ratih' }] }), { ids: ['hendra', 'ratih'], mode: 'tim' });
});

test('status: urutan prioritas sedang menjawab, dijeda, terhambat, perlu kamu, sedang jalan, siap', () => {
  const base = { settings: { autonomy: true }, tasks: [], approvals: [], employees: [] };
  assert.equal(K.statusTim(base).kode, 'siap');
  assert.deepEqual(K.statusTim({ ...base, employees: [{ type: 'ai', status: 'working' }, { type: 'ai', status: 'meeting' }, { type: 'human', status: 'working' }] }), { kode: 'jalan', teks: '2 orang bekerja' });
  assert.equal(K.statusTim({ ...base, approvals: [{ status: 'pending' }] }).teks, 'Perlu kamu'); assert.equal(K.statusTim({ ...base, approvals: [{ status: 'pending' }, { status: 'pending' }, { status: 'done' }] }).teks, '2 hal menunggumu');
  assert.equal(K.statusTim({ ...base, tasks: [{ status: 'blocked' }], approvals: [{ status: 'pending' }] }).kode, 'terhambat');
  assert.equal(K.statusTim({ ...base, settings: { autonomy: false }, tasks: [{ status: 'blocked' }] }).kode, 'dijeda');
  assert.equal(K.statusTim({ ...base, settings: { autonomy: false } }, true).kode, 'menjawab', 'sedang menjawab menang atas semuanya');
});

test('komposer: keadaan, langganan, mengetik, penerima disimpan ke server dan dipulihkan bila gagal', async () => {
  const log = []; let gagal = false; const data = { settings: { permission: 'ask', autonomy: true }, tasks: [], approvals: [], employees: [] };
  const k = K.buatKomposer({ panggil: async (m, u, b) => { log.push([m, u, b]); return gagal ? null : { ok: true, percakapan: [{ id: 'c1', judul: 'Diskon', terakhir: 'oke', waktu: 5, peserta: [{ nama: 'Hendra' }] }] }; }, nama: (x) => x, ambilData: () => data, bisaKelola: () => false });
  assert.equal(k.state.izin.nilai, 'ask'); assert.deepEqual(k.state.izin.opsi.map((o) => o.nilai), ['ask', 'auto']); assert.equal(k.state.target.label, 'Ke: aray');
  const dilihat = []; const stop = k.subscribe((s) => dilihat.push(s.status.kode + '|' + s.mengetik));
  k.setMengetik(true); k.setMengetik(true); k.setMengetik(false); assert.deepEqual(dilihat, ['siap|true', 'siap|false'], 'hanya perubahan nyata yang dikabarkan');
  k.setSibuk(true); assert.equal(k.state.status.kode, 'menjawab'); k.setSibuk(false); assert.equal(k.state.status.kode, 'siap');
  // penerima tanpa percakapan: hanya lokal
  assert.equal(await k.setTarget({ ids: ['hendra'] }), true); assert.equal(log.length, 0); assert.equal(k.state.target.mode, 'agen');
  k.pakaiPercakapan('c1', { peserta: [{ id: 'hendra' }] }); const n = dilihat.length; k.pakaiPercakapan('c1', { peserta: [{ id: 'hendra' }] }); assert.equal(dilihat.length, n, 'tidak berubah = tidak ada kabar baru');
  assert.equal(await k.setTarget({ ids: ['hendra', 'ratih'] }), true);
  assert.deepEqual(log.at(-1), ['PATCH', '/api/chat/conversations/c1', { tujuan: 'auto', agen: ['hendra', 'ratih'], eksplisit: true }]);
  gagal = true; assert.equal(await k.setTarget({ ids: [] }), false); assert.deepEqual(k.state.target.ids, ['hendra', 'ratih'], 'gagal: penerima lama kembali');
  // izin
  gagal = false; assert.equal(await k.setIzin('full'), false, 'bukan pengelola tidak boleh "Serahkan penuh"'); assert.equal(k.state.izin.nilai, 'ask');
  assert.equal(await k.setIzin('auto'), true); assert.deepEqual(log.at(-1), ['PATCH', '/api/settings', { permission: 'auto' }]); assert.equal(k.state.izin.nilai, 'auto');
  gagal = true; assert.equal(await k.setIzin('ask'), false); assert.equal(k.state.izin.nilai, 'auto', 'gagal: izin lama kembali');
  const adm = K.buatKomposer({ panggil: async () => ({ ok: true }), ambilData: () => data, bisaKelola: () => true }); assert.equal(await adm.setIzin('full'), true);
  // riwayat
  gagal = false; assert.deepEqual(await k.riwayat('dis'), [{ id: 'c1', judul: 'Diskon', terakhir: 'oke', waktu: 5, peserta: ['Hendra'] }]);
  assert.match(log.at(-1)[1], /\?q=dis$/);
  data.settings.autonomy = false; k.sinkron(); assert.equal(k.state.status.kode, 'dijeda'); stop();
});

test('server menerima bentuk yang dikirim komposer: penerima lewat PATCH percakapan, izin lewat pengaturan', () => {
  const v = ce.create('owner', {}); const hasil = ce.update('owner', v.id, K.targetKeServer(['hendra', 'ratih']));
  assert.deepEqual(hasil.peserta.map((p) => p.id).sort(), ['hendra', 'ratih']); assert.equal(hasil.tujuan, 'auto');
  const satu = ce.update('owner', v.id, K.targetKeServer(['hendra'])); assert.deepEqual(satu.peserta.map((p) => p.id), ['hendra']); assert.equal(satu.tujuan, 'agen');
  const idx = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8'); assert.match(idx, /'permission' in ch/);
});

test('satu komposer: Obrolan memakai modul bersama dan memberi kabar ke dock lewat peristiwa jendela; tidak ada komposer kedua dibuat', () => {
  const ob = fs.readFileSync(new URL('../public/js/obrolan-view.js', import.meta.url), 'utf8');
  assert.match(ob, /from '\.\/komposer-core\.js'/); assert.match(ob, /raiverse:komposer/); assert.match(ob, /id="obIzin"/); assert.match(ob, /id="obKe"/); assert.match(ob, /id="obStatus"/);
  assert.match(ob, /Serahkan penuh\?/, 'peringatan sebelum "Serahkan penuh" tetap ada');
  assert.equal((ob.match(/<form id="pmForm"/g) || []).length, 1, 'satu form komposer');
  const core = fs.readFileSync(new URL('../public/js/komposer-core.js', import.meta.url), 'utf8');
  assert.doesNotMatch(core, /^import /m, 'modul murni tanpa impor, bisa dipakai dock tanpa menarik komponen lain');
  assert.doesNotMatch(core, /document\.|window\./, 'tanpa DOM');
});
