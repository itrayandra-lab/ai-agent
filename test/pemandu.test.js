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

const KINDS = new Set(['chat', 'choices', 'plan', 'confirm', 'progress', 'result', 'done', 'error']);
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

const INPUTS = { konten: 'bikinin aku konten buat jualan kopi', riset: 'tolong carikan pesaing warung kopi', rencana: 'susun rencana usaha tiga bulan', pesan: 'tulis pesan balasan untuk pelanggan', ringkas: 'tolong ringkas ini: ' + 'Rapat tadi membahas harga baru, jadwal pengiriman, dan keluhan pelanggan. '.repeat(4), belajar: 'tolong buatkan aku bahan belajar laporan keuangan' };
const goals = () => store.get().tasks.filter((t) => t.kind === 'goal' && t.status !== 'cancelled');
/** jawab semua pertanyaan dengan pilihan yang disarankan; berhenti di kalimat konfirmasi (opsional: lanjut "Ya, kerjakan") */
async function answerAll(s, r, { start = true } = {}) {
  let asked = 0;
  while (r.kind === 'choices' && r.ask) { asked++; r = checkContract(await turn(s, { choiceId: r.options.find((o) => o.recommended).id })); }
  const confirmed = r;
  if (start && r.kind === 'confirm') r = checkContract(await turn(s, { choiceId: 'start' }));
  return { r, asked, confirmed };
}
const stopWork = (s) => turn(s, { choiceId: 'cancel' });

for (const [intent, text] of Object.entries(INPUTS)) {
  test(`alur kerja "${intent}": permintaan jelas -> paling banyak 1 pertanyaan -> kalimat konfirmasi -> baru dikerjakan`, async () => {
    const s = sid(); const before = goals().length;
    let r = checkContract(await turn(s, { input: text }));
    const { asked, confirmed } = await answerAll(s, r, { start: false });
    assert.ok(asked <= 1, `bertanya ${asked} kali`);
    assert.equal(confirmed.kind, 'confirm');
    assert.deepEqual(confirmed.options.map((o) => o.id), ['start', 'edit', 'later']);
    assert.match(confirmed.say, /Mau aku kerjakan sekarang/);
    assert.equal(goals().length, before, 'belum ada pekerjaan sebelum "Ya, kerjakan"');
    r = checkContract(await turn(s, { choiceId: 'start' }));
    assert.equal(r.kind, 'progress'); assert.equal(r.step.now, 3);
    const g = goals().find((t) => t.description.includes(text.slice(0, 20)));
    assert.ok(g, 'pekerjaan dibuat setelah konfirmasi');
    assert.match(g.description, /Yang sudah diputuskan pengguna/, 'pilihan pengguna ikut sebagai brief');
    await stopWork(s);
  });
}

test('permintaan yang sudah jelas tidak ditanya lagi, tetapi tetap menunggu konfirmasi', async () => {
  const s = sid(); const before = goals().length;
  const r = checkContract(await turn(s, { input: 'tolong buatkan konten instagram promo kopi susu untuk akhir pekan di Bandung' }));
  assert.equal(r.kind, 'confirm'); assert.equal(goals().length, before);
  const n = checkContract(await turn(s, { choiceId: 'later' }));   // Nanti saja: kembali ngobrol, tanpa pekerjaan
  assert.equal(n.kind, 'chat'); assert.equal(goals().length, before);
  assert.ok(n.options.length <= 3);
});

test('Ubah di kalimat konfirmasi: teks tambahan diterima, tetap menunggu "Ya"', async () => {
  const s = sid(); const before = goals().length;
  await turn(s, { input: 'tolong buatkan pesan tagihan untuk pelanggan dengan nada santai ya' });
  let r = checkContract(await turn(s, { choiceId: 'edit' })); assert.equal(r.kind, 'confirm'); assert.ok(r.notes?.some((x) => /Ketik apa yang mau diubah/.test(x)));
  r = checkContract(await turn(s, { input: 'tambahkan nomor rekening BCA' })); assert.equal(r.kind, 'confirm'); assert.equal(goals().length, before);
  await turn(s, { choiceId: 'start' });
  assert.match(goals().at(-1).description, /nomor rekening BCA/);
  await stopWork(s);
});

test('pagar di kode: tombol "Ya, kerjakan" yang basi tidak membuat pekerjaan', async () => {
  const before = goals().length;
  const s = sid();
  const r = checkContract(await turn(s, { choiceId: 'start' }));   // tidak ada usulan kerja yang menunggu
  assert.equal(r.kind, 'chat'); assert.equal(goals().length, before);
});

// ───────────────────────── obrolan dengan model tiruan ─────────────────────────
/** model tiruan: mengembalikan objek sesuai skema; mencatat panggilan agar tes bisa memeriksa model yang dipakai */
function fakeChat(rules) {
  const calls = [];
  pm.setChat(async ({ system, messages, model }) => {
    calls.push({ system, messages, model });
    const last = messages.at(-1).content; const sys = system;
    for (const [re, out] of rules) if (re.test(last)) return typeof out === 'function' ? out({ last, sys, messages }) : out;
    return { balasan: 'Oke, aku dengar.', saran: [], alat: 'tidak', kueri: '', kerja: false, judul: '' };
  });
  return calls;
}
const jawab = (balasan, extra = {}) => ({ balasan, saran: [], alat: 'tidak', kueri: '', kerja: false, judul: '', ...extra });
const noMenu = (r) => { assert.equal(r.kind, 'chat'); assert.ok(r.options.length <= 3, 'paling banyak tiga tombol saran'); assert.ok(!r.options.some((o) => o.id.startsWith('intent:')), 'bukan menu topik pembuka'); };

test('obrolan: "hi" dijawab hangat tanpa menu topik dan tanpa pekerjaan', async () => {
  fakeChat([]); const before = goals().length;
  for (const sapa of ['hi', 'halo', 'Hai!']) { const r = checkContract(await turn(sid(), { input: sapa })); noMenu(r); assert.match(r.say, /Halo/); assert.ok(r.say.length < 100, 'satu atau dua kalimat'); }
  assert.equal(goals().length, before);
});

test('obrolan: basa-basi, pertanyaan umum, dan diskusi bisnis dijawab model sebagai obrolan, tanpa pekerjaan', async () => {
  const calls = fakeChat([
    [/apa kabar/i, jawab('Kabarku baik, terima kasih sudah tanya! Kamu sendiri gimana?', { saran: ['Cerita soal usahaku'] })],
    [/apa itu seo/i, jawab('SEO itu cara membuat situsmu lebih mudah ditemukan lewat mesin pencari. Contohnya memakai kata yang dicari orang.', { saran: ['Kasih contoh', 'Buatkan tips SEO'] })],
    [/kemahalan/i, jawab('Untuk kopi susu, Rp25.000 masih wajar di kafe, tapi tergantung lokasi dan ukuran gelasnya.', { kerja: true, judul: 'Analisis harga' })],   // model salah menandai kerja: pagar tetap menahan
  ]);
  const before = goals().length;
  let r = checkContract(await turn(sid(), { input: 'apa kabar?' })); noMenu(r); assert.match(r.say, /Kabarku baik/);
  r = checkContract(await turn(sid(), { input: 'apa itu SEO?' })); noMenu(r); assert.match(r.say, /mesin pencari/); assert.deepEqual(r.options.map((o) => o.label), ['Kasih contoh', 'Buatkan tips SEO']);
  r = checkContract(await turn(sid(), { input: 'menurutmu harga kopi susu 25 ribu itu kemahalan?' })); noMenu(r); assert.match(r.say, /wajar/);
  assert.equal(goals().length, before, 'diskusi tidak berubah menjadi pekerjaan');
  assert.ok(calls.every((c) => c.model === 'openai/gpt-oss-20b'), 'obrolan ringan memakai model kecil');
});

test('obrolan: riwayat menempel pada percakapan yang sama', async () => {
  const calls = fakeChat([[/lanjutkan/i, jawab('Baik, soal kopi tadi, kita lanjutkan.')]]);
  const s = sid();
  await turn(s, { input: 'aku punya kedai kopi kecil di Bandung ya' });
  await turn(s, { input: 'lanjutkan yang tadi' });
  const msgs = calls.at(-1).messages.map((m) => m.content);
  assert.ok(msgs.some((x) => /kedai kopi kecil di Bandung/.test(x)), 'pesan sebelumnya ikut dikirim');
  assert.equal(calls.at(-1).messages[0].role, 'user');
});

test('obrolan: permintaan kerja eksplisit hanya sampai kalimat konfirmasi; Ya baru membuat pekerjaan', async () => {
  fakeChat([]); const before = goals().length; const s = sid();
  let r = checkContract(await turn(s, { input: 'bikinin aku caption instagram buat promo kopi susu hari ini ya' }));
  assert.equal(r.kind, 'confirm'); assert.equal(goals().length, before);
  r = checkContract(await turn(s, { choiceId: 'later' })); assert.equal(r.kind, 'chat'); assert.equal(goals().length, before);
  r = checkContract(await turn(s, { input: 'bikinin aku caption instagram buat promo kopi susu hari ini ya' }));
  r = checkContract(await turn(s, { choiceId: 'start' })); assert.equal(r.kind, 'progress'); assert.equal(goals().length, before + 1);
  await stopWork(s);
});

test('obrolan: permintaan ambigu dan topik yang memancing eksekusi tidak membuat pekerjaan', async () => {
  fakeChat([
    [/kerjakan atau jelaskan/i, jawab('Maksudmu mau aku buatkan, atau cukup dijelaskan dulu?', { saran: ['Buatkan saja', 'Jelaskan dulu'] })],
    [/otomasi di n8n/i, jawab('Singkatnya, otomasi itu rangkaian langkah yang jalan sendiri sesuai jadwal.', { kerja: true, judul: 'Pasang otomasi' })],   // model memancing eksekusi
    [/rencana usaha/i, jawab('Boleh kita bahas dulu: usahamu di bidang apa?', { kerja: true })],
  ]);
  const before = goals().length; const routines = store.get().routines.length;
  let r = checkContract(await turn(sid(), { input: 'soal konten ini kerjakan atau jelaskan dulu ya' })); assert.equal(r.kind, 'chat');
  r = checkContract(await turn(sid(), { input: 'jelaskan cara membuat otomasi di n8n' })); assert.equal(r.kind, 'chat');
  r = checkContract(await turn(sid(), { input: 'aku masih bingung soal rencana usaha, ngobrol dulu boleh?' })); assert.ok(['chat', 'confirm'].includes(r.kind));
  assert.equal(goals().length, before, 'tidak ada pekerjaan tanpa konfirmasi'); assert.equal(store.get().routines.length, routines);
});

test('obrolan: menyela usulan kerja dengan pertanyaan melepas usulan dan dijawab sebagai obrolan', async () => {
  fakeChat([[/apa itu seo/i, jawab('SEO itu cara membuat situsmu mudah ditemukan.')]]);
  const before = goals().length; const s = sid();
  let r = await turn(s, { input: 'buat konten buat jualan kopi' }); assert.ok(['choices', 'confirm'].includes(r.kind));
  r = checkContract(await turn(s, { input: 'eh, apa itu SEO?' })); assert.equal(r.kind, 'chat'); assert.match(r.say, /mudah ditemukan/);
  r = checkContract(await turn(s, { choiceId: 'start' })); assert.equal(r.kind, 'chat'); assert.equal(goals().length, before);
});

test('obrolan: alat dipakai senyap lewat satu pintu, ditandai "Memanggil ...", hasilnya tetap bagian percakapan', async () => {
  const brainMod = await import('../server/pengetahuan/brain.js');
  brainMod.writeNote({ title: 'Harga menu kopi', content: 'Kopi susu Rp22.000, americano Rp18.000', folder: 'Company', authorId: 'owner', kb: 'owner' });
  fakeChat([[/harga menu/i, ({ sys }) => (sys.includes('Hasil alat (data') ? jawab('Menurut catatanmu, kopi susu Rp22.000 dan americano Rp18.000.') : jawab('Sebentar, kucek catatanmu.', { alat: 'catatan', kueri: 'harga menu kopi' }))]]);
  const before = goals().length;
  const r = checkContract(await turn(sid(), { input: 'berapa harga menu kopi kita sekarang?' }));
  assert.equal(r.kind, 'chat'); assert.match(r.say, /Rp22\.000/);
  assert.equal(r.tools.length, 1); assert.match(r.tools[0].label, /Memanggil Catatan/); assert.match(r.tools[0].detail, /harga menu kopi/);
  assert.equal(goals().length, before);
});

test('obrolan: jargon dari model dibersihkan, dan semua layar bebas kata terlarang', async () => {
  fakeChat([[/jargon/i, jawab('Agen kami memakai token dan model untuk membuat goal serta task lewat API.')]]);
  const r = checkContract(await turn(sid(), { input: 'ceritakan soal jargon dong' }));
  assert.deepEqual(scan(r.say), []); assert.match(r.say, /pembantu/);
});

test('obrolan: permintaan panjang memakai model besar, selain itu model kecil', async () => {
  const calls = fakeChat([]);
  pm.setChat(null);   // model tiruan menandai impl: pemilihan model besar hanya berlaku pada model asli, jadi cukup periksa fungsi pemilih
  const eng = await import('../server/engine.js');
  assert.equal(eng.isComplex('halo'), false); assert.equal(eng.isComplex('tolong analisis '.repeat(25)), true);
  assert.equal(calls.length, 0);
});

test('tanpa model (mode simulasi): sapaan tetap hangat, pertanyaan dijawab jujur, tombol "Kerjakan sebagai pekerjaan" membuka konfirmasi', async () => {
  pm.setChat(null); const before = goals().length; const s = sid();
  let r = checkContract(await turn(s, { input: 'hmm kira-kira siapa penemu lampu ya?' }));
  assert.equal(r.kind, 'chat'); assert.match(r.say, /belum tersambung/); assert.deepEqual(r.options.map((o) => o.label), ['Kerjakan sebagai pekerjaan']);
  assert.equal(goals().length, before);
  r = checkContract(await turn(s, { choiceId: 'say:0' }));
  assert.ok(['choices', 'confirm'].includes(r.kind)); assert.equal(goals().length, before, 'tetap menunggu konfirmasi');
  await stopWork(s);
});

test('kartu awal lama: diperlakukan sebagai pesan biasa, bukan wizard', async () => {
  pm.setChat(null);
  const s = sid(); const before = goals().length;
  let r = checkContract(await turn(s, { choiceId: 'intent:konten' }));
  assert.ok(['choices', 'confirm'].includes(r.kind)); assert.equal(goals().length, before);
  await stopWork(s);
});

test('obrolan ringan tanpa model dijawab ramah tanpa membuat pekerjaan', async () => {
  pm.setChat(null); const before = store.get().tasks.length;
  let r = checkContract(await turn(sid(), { input: 'makasih ya' })); assert.match(r.say, /Sama-sama/);
  r = checkContract(await turn(sid(), { input: 'kamu bisa apa' })); assert.match(r.say, /kembaran digitalmu/);
  r = checkContract(await turn(sid(), { input: 'halo' })); noMenu(r);
  assert.equal(store.get().tasks.length, before);
});

test('pilihan lama dari layar yang sudah lewat tidak merusak keadaan', async () => {
  pm.setChat(null);
  const s = sid();
  await turn(s, { input: 'buat konten kopi' });
  const r = checkContract(await turn(s, { choiceId: 'plan:full' }));   // tidak ada pilihan itu di layar sekarang
  assert.equal(r.kind, 'choices'); assert.ok(r.notes?.some((x) => /sudah lewat/.test(x)));
});

test('profil: pertanyaan yang jawabannya sudah diketahui dilewati, dan jawaban baru dicatat', async () => {
  pm.setChat(null);
  pm.setProfile('owner', { gaya: '' });   // jawaban rekomendasi di tes sebelumnya ikut tercatat
  const s0 = sid();
  let r = checkContract(await turn(s0, { input: 'tulis pesan untuk pelanggan' }));   // penerima terbaca dari kalimat; yang ditanya hanya gaya bahasa
  assert.equal(r.kind, 'choices'); assert.ok(/gaya bahasa/.test(r.say));
  r = checkContract(await turn(s0, { choiceId: 'resmi' }));
  assert.ok(r.learned && /resmi/.test(r.learned.text), 'pilihan gaya dicatat dan diberitahukan ("Betul?")');
  assert.equal(pm.profileView('owner').items.find((i) => i.key === 'gaya').value, 'sopan dan resmi');
  await stopWork(s0);
  const s1 = sid();
  r = checkContract(await turn(s1, { input: 'tulis pesan untuk pelanggan' }));   // gaya sudah diketahui: tidak ada pertanyaan, langsung kalimat konfirmasi
  assert.equal(r.kind, 'confirm', 'tidak menanyakan gaya bahasa dua kali');
  assert.ok(r.notes?.some((x) => /sopan dan resmi/.test(x)), 'memberi tahu apa yang dipakai dari profil');
  await stopWork(s1);
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
  pm.setChat(null); let calls = 0;
  const good = { label: 'Menata gudang', questions: [{ say: 'Gudangmu seberapa besar?', options: ['Kecil', 'Sedang', 'Besar'] }], plans: [{ give: 'Tiga tips cepat' }, { give: 'Denah dan jadwal rapi' }, { give: 'Rencana tata ulang lengkap' }] };
  pm.setL1(async () => { calls++; return good; });
  let s = sid();
  let r = checkContract(await turn(s, { input: 'tolong buatkan daftar belanja bulanan untuk gudang kecilku' }));
  assert.match(r.say, /Gudangmu seberapa besar/);
  r = checkContract(await turn(sid(), { input: 'tolong buatkan daftar belanja bulanan untuk gudang kecilku' }));
  assert.equal(calls, 1, 'permintaan yang sama memakai cache');
  pm.setL1(async () => ({ label: 'Tool agent', questions: [], plans: [{ give: 'a' }, { give: 'b' }, { give: 'c' }] }));
  r = checkContract(await turn(sid(), { input: 'tolong siapkan daftar persiapan pindahan kantor' }));
  assert.match(r.say, /hasilnya berupa apa/, 'kata terlarang ditolak, templat umum dipakai');
  pm.setL1(async () => { throw new Error('model tidak tersedia'); });
  r = checkContract(await turn(sid(), { input: 'tolong buatkan nama toko baru yang unik' }));
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

test('layar: satu percakapan, bukan wizard (tanpa penunjuk langkah, kartu rencana, atau panel)', () => {
  const v = fs.readFileSync('public/js/obrolan-view.js', 'utf8');
  for (const k of ['pm-steps', 'Dikerjakan', 'pm-cards', 'pm-hero', 'pm-suggest', 'Aku Sora', 'Yang aku tahu', 'Boleh kenalan']) assert.ok(!v.includes(k), `tidak boleh ada: ${k}`);
  for (const k of ['pmThread', 'pmForm', 'pmMic', 'ob-chips']) assert.ok(v.includes(k), `harus ada: ${k}`);
});

test('layar: teks antarmuka Pemandu dan menu tidak memuat kata terlarang', () => {
  const src = fs.readFileSync('public/js/obrolan-view.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '').replace(/^import .*$/gm, '');
  const texts = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, ' ')).filter((t) => /[A-Za-z]{3,}/.test(t) && !t.startsWith('/') && !t.startsWith('application/') && !/\/api\/|=>|await /.test(t) && (/[ ]/.test(t) || /^[A-Z]/.test(t)));   // kode (alamat, jenis MIME, nama kelas) bukan teks layar
  const bad = texts.map((t) => [t, scan(t.replace(/<[^>]+>/g, ' '))]).filter(([, w]) => w.length);
  assert.deepEqual(bad, [], 'kata terlarang di obrolan-view.js');
  const views = fs.readFileSync('public/js/views.js', 'utf8'); const titles = [...views.slice(views.indexOf('export const VIEWS')).matchAll(/(?:title|short): '([^']+)'/g)].map((m) => m[1]);
  assert.ok(titles.length >= 10); assert.deepEqual(titles.filter((t) => scan(t).length), [], 'judul menu');
  const app = fs.readFileSync('public/js/app.js', 'utf8');
  const shown = [...app.matchAll(/toast\(`([^`]*)`/g)].map((m) => m[1]).concat(app.split(/\r?\n/).filter((l) => /class="engine"/.test(l)));
  assert.ok(shown.length >= 4);
  for (const t of shown) assert.deepEqual(scan(t.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]+>/g, ' ')), [], t.slice(0, 80));
});

test('putaran penuh (mode simulasi): Mulai -> hasil -> Ubah sedikit mulai bekerja lagi -> Pakai ini -> tersimpan dan langkah lanjut', { timeout: 480000 }, async () => {
  pm.setChat(null); engine.start();
  const s = sid();
  let r = checkContract(await turn(s, { input: 'bikinin aku konten buat jualan kopi' }));
  ({ r } = await answerAll(s, r));
  assert.equal(r.kind, 'progress'); assert.equal(r.step.now, 3);
  const goals = store.get().tasks.filter((t) => t.kind === 'goal' && t.status !== 'cancelled' && t.description.includes('bikinin aku konten buat jualan kopi'));
  assert.equal(goals.length, 1);
  assert.match(goals[0].description, /Yang sudah diputuskan pengguna/, 'pilihan pengguna ikut sebagai brief');
  const wait = async () => { const t0 = Date.now(); while (r.kind === 'progress' && Date.now() - t0 < 200000) { await new Promise((x) => setTimeout(x, 2000)); r = checkContract(await turn(s, { choiceId: 'poll' })); if (r.kind === 'progress') assert.ok(r.progress.pct >= 0 && r.progress.pct <= 100); } };
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
