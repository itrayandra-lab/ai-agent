// Pemandu: kontrak data, 6 niat umum (L0), cadangan L1, profil, keamanan, kamus bahasa, dan satu putaran kerja sampai tersimpan (mode simulasi, tanpa token).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-pemandu-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';   // tes tidak pernah memakai AI berbayar

const store = await import('../server/store.js');
const engine = await import('../server/engine.js');
const pm = await import('../server/pemandu.js');
const { scan } = await import('../server/kamus.js');
store.load();

const KINDS = new Set(['choices', 'plan', 'confirm', 'progress', 'result', 'done', 'error']);
let n = 0;
const sid = () => `uji-${++n}-${Date.now()}`;
const turn = (s, x) => pm.turn({ userId: 'owner', sessionId: s, ...x });

/** teks yang dilihat pengguna dalam satu respons (hasil karya AI sendiri tidak dipindai) */
function visible(r) {
  const t = [r.say, ...(r.notes || []), r.learned?.text, r.progress?.text, r.saved?.title];
  for (const o of r.options || []) t.push(o.label, o.hint, o.eta, o.cost);
  for (const p of r.preview || []) t.push(p.label, p.value);
  for (const c of r.cards || []) { t.push(c.say); for (const o of c.options) t.push(o.label); }
  return t.filter(Boolean).join(' | ');
}
function checkContract(r) {
  assert.ok(KINDS.has(r.kind), `kind tidak dikenal: ${r.kind}`);
  assert.ok(typeof r.say === 'string' && r.say.length > 2, 'say wajib');
  assert.ok(Array.isArray(r.options), 'options wajib berupa larik');
  assert.ok(r.step && r.step.now >= 1 && r.step.now <= 4 && r.step.of === 4, 'step 1..4 dari 4');
  assert.equal(typeof r.undo, 'boolean'); assert.equal(typeof r.delegate, 'boolean'); assert.equal(typeof r.freeText, 'boolean');
  assert.ok(r.options.filter((o) => o.recommended).length <= 1, 'paling banyak satu "Disarankan"');
  if (r.kind === 'choices' && r.options.length) assert.ok(r.options.length >= 2 && r.options.length <= 4, `2-4 tombol, ada ${r.options.length}`);
  if (r.kind === 'choices' && r.options.length && r.ask) { assert.ok(r.delegate && r.freeText, 'pertanyaan wajib punya "Serahkan ke kamu" dan "Lainnya (ketik)"'); assert.equal(r.options.filter((o) => o.recommended).length, 1, 'pertanyaan punya satu pilihan Disarankan'); }
  assert.deepEqual(scan(visible(r)), [], `kata terlarang di layar: ${visible(r)}`);
  return r;
}

test('kamus: kata terlarang terdeteksi, padanan yang diizinkan lolos', () => {
  assert.deepEqual(scan('Agen sedang membuat goal dan task'), ['agen', 'goal', 'task']);
  assert.deepEqual(scan('Persetujuan tertunda; token habis; Second Brain'), ['persetujuan', 'token', 'second brain']);
  assert.deepEqual(scan('Pembantu, pekerjaan, konfirmasi, catatan, ruang kerja, kemampuan'), []);
  assert.deepEqual(scan('modelnya, tokoh, brainstorm'), [], 'kata yang hanya mengandung potongan tidak ikut ditandai');
});

test('niat: enam niat umum dikenali tanpa token', () => {
  const cases = { konten: 'bikinin aku konten buat jualan kopi', riset: 'tolong cari tahu pesaing warung kopi', rencana: 'susun rencana usaha tiga bulan', pesan: 'tulis pesan balasan untuk pelanggan', ringkas: 'tolong ringkas artikel ini', belajar: 'ajari aku cara bikin laporan' };
  for (const [want, text] of Object.entries(cases)) assert.equal(pm.detectIntent(text), want, text);
  assert.equal(pm.detectIntent('hmm'), null);
});

for (const [intent, text] of Object.entries({ konten: 'bikinin aku konten buat jualan kopi', riset: 'tolong cari tahu pesaing warung kopi', rencana: 'susun rencana usaha tiga bulan', pesan: 'tulis pesan balasan untuk pelanggan', ringkas: 'tolong ringkas ini: ' + 'Rapat tadi membahas harga baru, jadwal pengiriman, dan keluhan pelanggan. '.repeat(4), belajar: 'ajari aku cara bikin laporan keuangan' })) {
  test(`alur L0 "${intent}": paling banyak 2 pertanyaan, 3 rencana, konfirmasi dengan pratinjau`, async () => {
    const s = sid();
    let r = checkContract(await turn(s, { input: text }));
    let asked = 0;
    while (r.kind === 'choices' && r.ask) {
      asked++;
      const pick = r.options.find((o) => o.recommended) || r.options[0];
      r = checkContract(await turn(s, { choiceId: asked === 1 ? pick.id : 'delegate' }));
    }
    assert.ok(asked <= 2, `bertanya ${asked} kali`);
    assert.equal(r.kind, 'plan');
    assert.deepEqual(r.options.map((o) => o.id), ['plan:fast', 'plan:balanced', 'plan:full']);
    assert.equal(r.options.filter((o) => o.recommended)[0].id, 'plan:balanced');
    assert.ok(r.options.every((o) => o.hint && o.eta && o.cost), 'tiap rencana punya bahasa hasil, waktu, dan biaya dalam kata');
    assert.equal(r.step.now, 2);
    r = checkContract(await turn(s, { choiceId: 'plan:fast' }));
    assert.equal(r.kind, 'confirm');
    assert.ok(r.preview.length >= 1, 'konfirmasi menampilkan pratinjau');
    assert.deepEqual(r.options.map((o) => o.id), ['start', 'edit']);
    // kembali satu langkah lalu ubah pilihan tidak membuat pekerjaan apa pun
    r = checkContract(await turn(s, { choiceId: 'back' })); assert.equal(r.kind, 'plan');
    assert.equal(store.get().tasks.filter((t) => t.kind === 'goal').length, 0, 'belum ada pekerjaan sebelum Mulai');
  });
}

test('kartu awal tanpa topik menanyakan topik dulu, "Serahkan ke kamu" tetap jalan', async () => {
  const s = sid();
  let r = checkContract(await turn(s, { choiceId: 'intent:konten' }));
  assert.equal(r.kind, 'choices'); assert.ok(r.freeText && r.delegate);
  r = checkContract(await turn(s, { choiceId: 'delegate' }));
  assert.equal(r.ask?.of, 2);
});

test('pilihan lama dari layar yang sudah lewat tidak merusak keadaan', async () => {
  const s = sid();
  await turn(s, { input: 'buat konten promo kopi' });
  const r = checkContract(await turn(s, { choiceId: 'plan:full' }));   // belum di tahap rencana
  assert.equal(r.kind, 'choices'); assert.ok(r.notes?.some((x) => /sudah lewat/.test(x)));
});

test('profil: pertanyaan yang jawabannya sudah diketahui dilewati, dan jawaban baru dicatat', async () => {
  const s0 = sid();
  await turn(s0, { input: 'tulis pesan untuk pelanggan' });
  let r = await turn(s0, { choiceId: 'pelanggan' });   // pertanyaan kedua: gaya bahasa
  assert.equal(r.kind, 'choices'); assert.ok(/gaya bahasa/.test(r.say));
  r = checkContract(await turn(s0, { choiceId: 'resmi' }));
  assert.ok(r.learned && /resmi/.test(r.learned.text), 'pilihan gaya dicatat dan diberitahukan ("Betul?")');
  assert.equal(pm.profileView('owner').items.find((i) => i.key === 'gaya').value, 'sopan dan resmi');
  const s1 = sid();
  r = checkContract(await turn(s1, { input: 'tulis pesan untuk pelanggan' }));   // gaya sudah diketahui
  assert.ok(/untuk siapa/.test(r.say));
  assert.ok(r.notes?.some((x) => /sopan dan resmi/.test(x)), 'memberi tahu apa yang dipakai dari profil');
  r = checkContract(await turn(s1, { choiceId: 'pelanggan' }));
  assert.equal(r.kind, 'plan', 'tidak menanyakan gaya bahasa dua kali');
  const note = store.get().notes.find((x) => x.title === 'Profil pengguna owner');
  assert.ok(note && /sopan dan resmi/.test(note.content), 'profil tersimpan sebagai catatan sistem');
});

test('profil: bisa diubah dan dikosongkan', () => {
  const v = pm.setProfile('owner', { nama: 'Kedai Uji', gaya: '' });
  assert.ok(v.items.some((i) => i.key === 'nama' && i.value === 'Kedai Uji'));
  assert.ok(!v.items.some((i) => i.key === 'gaya'));
});

test('onboarding: satu kalimat, satu alamat situs, dan alamat jaringan dalam ditolak', async () => {
  let r = await pm.onboard('owner2', 'Namaku Kopi Senja, aku jual kopi susu di Bandung untuk anak muda');
  assert.ok(r.profile.items.some((i) => i.key === 'bidang'));
  pm.setFetch(async () => ({ ok: true, text: async () => '<html><head><title>Kedai Rindu | Kopi Lokal</title><meta name="description" content="Kopi lokal dan roti segar di Yogyakarta"></head><body><h1>Selamat datang</h1></body></html>' }));
  r = await pm.onboard('owner3', 'kedairindu.example');
  assert.equal(r.fromSite, true);
  assert.equal(r.profile.items.find((i) => i.key === 'nama').value, 'Kedai Rindu');
  assert.match(r.profile.items.find((i) => i.key === 'bidang').value, /Yogyakarta/);
  let hit = false; pm.setFetch(async () => { hit = true; return { ok: true, text: async () => '' }; });
  r = await pm.onboard('owner4', 'http://127.0.0.1:4317/admin');
  assert.equal(hit, false, 'alamat jaringan dalam tidak pernah dibuka');
  await assert.rejects(() => pm.onboard('owner5', '   '));
});

test('L1: keluaran model kecil divalidasi, di-cache, dan bila rusak jatuh ke templat umum', async () => {
  let calls = 0;
  const good = { label: 'Menata gudang', questions: [{ say: 'Gudangmu seberapa besar?', options: ['Kecil', 'Sedang', 'Besar'] }], plans: [{ give: 'Tiga tips cepat' }, { give: 'Denah dan jadwal rapi' }, { give: 'Rencana tata ulang lengkap' }] };
  pm.setL1(async () => { calls++; return good; });
  let s = sid();
  let r = checkContract(await turn(s, { input: 'gimana ya enaknya merapikan gudang kecilku' }));
  assert.match(r.say, /Gudangmu seberapa besar/);
  r = checkContract(await turn(sid(), { input: 'gimana ya enaknya merapikan gudang kecilku' }));
  assert.equal(calls, 1, 'permintaan yang sama memakai cache');
  pm.setL1(async () => ({ label: 'Tool agent', questions: [], plans: [{ give: 'a' }, { give: 'b' }, { give: 'c' }] }));
  r = checkContract(await turn(sid(), { input: 'apa saja yang perlu disiapkan buat pindahan kantor' }));
  assert.match(r.say, /hasilnya berupa apa/, 'kata terlarang ditolak, templat umum dipakai');
  pm.setL1(async () => { throw new Error('model tidak tersedia'); });
  r = checkContract(await turn(sid(), { input: 'ada ide nama toko baru yang unik' }));
  assert.match(r.say, /hasilnya berupa apa/);
  assert.equal(pm.validateL1({ label: 'x', questions: [{ say: 'y', options: ['hanya satu'] }], plans: [] }), null);
  pm.setL1(null);
});

test('keamanan bawaan: topik berbahaya ditolak sopan dan tidak membuat pekerjaan', async () => {
  const before = store.get().tasks.length;
  const r = checkContract(await turn(sid(), { input: 'aku ingin bunuh diri' }));
  assert.equal(r.kind, 'error'); assert.match(r.say, /tidak sendirian/);
  assert.equal(store.get().tasks.length, before);
});

test('titik sambung: kartu otomasi dan kartu belajar terdaftar dengan bentuk yang jelas', () => {
  assert.equal(typeof pm.registerCard, 'function');
  assert.ok(pm.CARDS.learned && typeof pm.CARDS.learned.offer === 'function' && typeof pm.CARDS.learned.act === 'function');
});

test('kartu "Aku belajar sesuatu, simpan?": usulan nyata dari sesi belajar mandiri muncul, disetujui, lalu hilang', async () => {
  const sl = await import('../server/skills-learn.js');
  const aria = store.get().employees.find((e) => e.id === 'aria');
  assert.equal(sl.proposeMemory(aria, { id: 'tx', title: 'x', createdBy: 'owner' }, { aksi: 'add', target: 'pengguna', teks: 'Suka kopi tanpa gula' }).ok, true);
  const c = checkCard(await pm.CARDS.learned.offer({ userId: 'owner' }));
  assert.equal(c.type, 'learned'); assert.deepEqual(c.options.map((x) => x.id), ['setuju', 'tolak']);
  const r = await pm.CARDS.learned.act('setuju', { userId: 'owner', ref: c.ref });
  assert.match(r.say, /Tersimpan/);
  assert.equal(await pm.CARDS.learned.offer({ userId: 'owner' }), null);
});
function checkCard(c) { assert.deepEqual(scan(c.say + ' ' + c.options.map((x) => x.label).join(' ')), []); return c; }

test('layar: teks antarmuka Pemandu dan menu tidak memuat kata terlarang', () => {
  const src = fs.readFileSync('public/js/pemandu-view.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '').replace(/^import .*$/gm, '');
  const texts = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, ' ')).filter((t) => /[A-Za-z]{3,}/.test(t) && !t.startsWith('/') && !t.startsWith('application/') && (/[ ]/.test(t) || /^[A-Z]/.test(t)));   // kode (alamat, jenis MIME, nama kelas) bukan teks layar
  const bad = texts.map((t) => [t, scan(t.replace(/<[^>]+>/g, ' '))]).filter(([, w]) => w.length);
  assert.deepEqual(bad, [], 'kata terlarang di pemandu-view.js');
  const views = fs.readFileSync('public/js/views.js', 'utf8'); const titles = [...views.slice(views.indexOf('export const VIEWS')).matchAll(/(?:title|short): '([^']+)'/g)].map((m) => m[1]);
  assert.ok(titles.length >= 10); assert.deepEqual(titles.filter((t) => scan(t).length), [], 'judul menu');
  const app = fs.readFileSync('public/js/app.js', 'utf8');
  const shown = [...app.matchAll(/toast\(`([^`]*)`/g)].map((m) => m[1]).concat(app.split(/\r?\n/).filter((l) => /class="engine"/.test(l)));
  assert.ok(shown.length >= 4);
  for (const t of shown) assert.deepEqual(scan(t.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]+>/g, ' ')), [], t.slice(0, 80));
});

test('putaran penuh (mode simulasi): Mulai -> hasil -> Ubah sedikit mulai bekerja lagi -> Pakai ini -> tersimpan dan langkah lanjut', { timeout: 280000 }, async () => {
  engine.start();
  const s = sid();
  await turn(s, { input: 'bikinin aku konten buat jualan kopi' });
  await turn(s, { choiceId: 'baru' }); await turn(s, { choiceId: 'delegate' });
  await turn(s, { choiceId: 'plan:fast' });
  let r = checkContract(await turn(s, { choiceId: 'start' }));
  assert.equal(r.kind, 'progress'); assert.equal(r.step.now, 3);
  const goals = store.get().tasks.filter((t) => t.kind === 'goal');
  assert.equal(goals.length, 1);
  assert.match(goals[0].description, /Yang sudah diputuskan pengguna/, 'pilihan pengguna ikut sebagai brief');
  const wait = async () => { const t0 = Date.now(); while (r.kind === 'progress' && Date.now() - t0 < 120000) { await new Promise((x) => setTimeout(x, 2000)); r = checkContract(await turn(s, { choiceId: 'poll' })); if (r.kind === 'progress') assert.ok(r.progress.pct >= 0 && r.progress.pct <= 100); } };
  await wait();
  assert.equal(r.kind, 'result'); assert.ok(r.result.text.length > 20);
  assert.deepEqual(r.options.map((o) => o.id), ['use', 'tweak', 'redo', 'save']);
  r = checkContract(await turn(s, { choiceId: 'tweak' }));
  assert.deepEqual(r.options.map((o) => o.id), ['tw:singkat', 'tw:santai', 'tw:resmi', 'tw:lengkap']);
  r = checkContract(await turn(s, { choiceId: 'tw:singkat' }));
  assert.equal(r.kind, 'progress', 'revisi memakai alur tolak-dengan-catatan yang sudah ada');
  assert.equal(goals[0].revisions, 1); assert.match(goals[0].feedback, /singkat/);
  await wait();
  assert.equal(r.kind, 'result'); assert.equal(r.result.revision, 1);
  r = checkContract(await turn(s, { choiceId: 'use' }));
  assert.equal(r.kind, 'done'); assert.ok(r.copy.length > 0);
  assert.equal(store.get().tasks.find((t) => t.id === goals[0].id).status, 'done');
  assert.equal(r.options.length, 3);
  r = checkContract(await turn(s, { choiceId: 'next:jadwal' }));
  assert.equal(r.kind, 'choices'); assert.match(r.say, /otomatiskan/);
  assert.ok(r.options.some((x) => x.id === 'oto:opsi1') && r.options.some((x) => x.id === 'oto:no'));
  // mesin otomasi tidak menyala di tes: pengguna dapat jalan keluar yang jujur, bukan layar rusak
  r = checkContract(await turn(s, { choiceId: 'oto:opsi1' }));
  for (let i = 0; i < 4 && r.kind === 'choices'; i++) r = checkContract(await turn(s, r.options.length ? { choiceId: r.options[0].id } : { input: 'Bayar listrik' }));
  assert.equal(r.kind, 'error'); assert.ok(r.options.some((x) => x.id === 'oto:biasa'));
  r = checkContract(await turn(s, { choiceId: 'oto:biasa' }));
  assert.equal(r.kind, 'done'); assert.ok(store.get().routines.some((x) => x.everyMinutes === 1440), 'jadwal bawaan terpasang');
  assert.equal(await pm.CARDS.learned.offer({ userId: 'owner' }), null, 'tidak ada usulan belajar: tidak ada kartu');
  engine.stop();
});
