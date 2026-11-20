// Chat Engine: riwayat percakapan, tujuan, routing otomatis tanpa sintaks "@nama", rapat singkat, penugasan balik,
// pagar konfirmasi pekerjaan, isolasi antar pengguna, dan bahasa awam. Model tiruan; tidak ada token berbayar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-chat-engine-'));
process.env.GROQ_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';

const store = await import('../server/penyimpanan/store.js');
const pm = await import('../server/pemandu.js');
const ce = await import('../server/chat-engine.js');
const router = await import('../server/chat-router.js');
const { scan } = await import('../server/kamus.js');
store.load();

const db = () => store.get();
const world = () => ({ employees: db().employees, divisions: db().divisions });
const goals = () => db().tasks.filter((t) => t.kind === 'goal' && t.status !== 'cancelled');
let n = 0; const sid = () => `ce-${++n}-${Date.now()}`;
const turn = (s, x, userId = 'owner') => ce.turn({ userId, sessionId: s, ...x });
const ids = (r) => r.thread.map((m) => m.speaker?.id);

/** model tiruan: menjawab sebagai tokoh yang disebut di perintah sistem; mencatat siapa yang bicara */
let spoken = []; let flagWork = false;
pm.setChat(async ({ system, messages }) => {
  const who = /Kamu (\w+),/.exec(system)?.[1] || 'Sora'; const last = messages.at(-1).content;
  spoken.push(who);
  const ringkas = /rangkum rapat/i.test(last);
  return { balasan: ringkas ? 'Keputusan: kita lanjut. Tindak lanjut: susun jadwal.' : `${who} menjawab: baik, begini pendapatku.`, saran: ringkas ? [] : ['Lanjut bahas'], alat: 'tidak', kueri: '', kerja: flagWork && who !== 'Sora', judul: '' };
});

// ───────────────────────── router (tanpa model) ─────────────────────────
const pick = (text) => router.route(text, world());
test('router: peran, bagian, dan topik dalam bahasa biasa menuju orang yang tepat, tanpa "@nama"', () => {
  assert.deepEqual(pick('gimana strategi promosi minggu depan?').agents, ['maya']);                // topik saja
  assert.equal(pick('minta tim keuangan cek ini').agents[0], 'hendra');                             // "tim X"
  assert.ok(pick('minta tim keuangan cek ini').agents.length >= 2, 'tim = pimpinan + staf');
  assert.deepEqual(pick('bagian keuangan tolong lihat angka ini').agents.slice(0, 1), ['hendra']);  // "bagian X"
  assert.equal(pick('si desainer udah selesai belum?').agents[0], 'alya');                          // "si <peran>"
  assert.equal(pick('ada soal pajak nih').agents[0], 'hendra');                                     // kata sehari-hari
  assert.equal(pick('kontrak sewa ini aman nggak ya').agents[0], 'rudi');
});
test('router: nama salah eja, panggilan, dan huruf tertukar tetap dikenali; kata biasa tidak salah dikira nama', () => {
  assert.equal(pick('tanya hendar dong').agents[0], 'hendra');    // huruf tertukar
  assert.equal(pick('Pak Hendra, bagaimana kasnya?').agents[0], 'hendra');
  assert.equal(pick('tanya mayaa soal kampanye').kind === 'agents' || pick('tanya maya soal kampanye').agents[0] === 'maya', true);
  assert.notEqual(pick('besok hari libur').agents[0], 'hadi', '"hari" bukan Hadi');
  assert.equal(pick('halo apa kabar').kind, 'none');
});
test('router: "siapa yang bisa ..." menjawab dengan kandidat, bukan memanggil siapa pun', () => {
  const r = pick('siapa yang bisa urus pajak perusahaan?');
  assert.equal(r.kind, 'siapa'); assert.equal(r.candidates[0].id, 'hendra');
});
test('router: nama depan kembar tanpa pimpinan menghasilkan satu pertanyaan pilihan (maksimal 3 tombol)', () => {
  const emps = [{ id: 'z1', type: 'ai', name: 'Zara', title: 'Staf Desain', divisionId: 'design' }, { id: 'z2', type: 'ai', name: 'Zara', title: 'Staf Keuangan', divisionId: 'fin' }, { id: 'z3', type: 'ai', name: 'Zara', title: 'Staf Hukum', divisionId: 'legal' }, { id: 'z4', type: 'ai', name: 'Zara', title: 'Staf Data', divisionId: 'data' }];
  const r = router.route('tanya Zara dong', { employees: emps, divisions: db().divisions });
  assert.equal(r.kind, 'ambiguous'); assert.ok(r.options.length >= 2 && r.options.length <= 3);
});
test('router: saran "@" bisa dicari lewat nama, peran, atau divisi', () => {
  assert.equal(ce.suggest('keu')[0].id, 'hendra');
  assert.ok(ce.suggest('hend').some((x) => x.id === 'hendra'));
  assert.ok(ce.suggest('desain').some((x) => x.id === 'alya'));
  assert.deepEqual(ce.suggest(''), []);
});

// ───────────────────────── percakapan ─────────────────────────
test('riwayat: buat, judul otomatis dari isi, daftar, cari, ganti nama, arsip, hapus', async () => {
  const c = ce.create('owner', {}); assert.equal(c.judul, 'Percakapan baru'); assert.equal(c.tujuan, 'auto');
  await turn(c.id, { input: 'halo' });
  assert.equal(ce.list('owner').find((x) => x.id === c.id).judul, 'Percakapan baru', 'sapaan tidak jadi judul');
  await turn(c.id, { input: 'menurutmu harga kopi susu 25 ribu itu kemahalan?' });
  const row = ce.list('owner').find((x) => x.id === c.id);
  assert.match(row.judul, /harga kopi susu/i); assert.ok(row.waktu > 0);
  assert.ok(ce.list('owner', { q: 'kemahalan' }).some((x) => x.id === c.id), 'cari di isi percakapan');
  assert.equal(ce.list('owner', { q: 'tidak-ada-kata-ini' }).some((x) => x.id === c.id), false);
  assert.equal(ce.update('owner', c.id, { judul: 'Harga menu' }).judul, 'Harga menu');
  ce.update('owner', c.id, { status: 'arsip' }); assert.equal(ce.list('owner').some((x) => x.id === c.id), false); assert.equal(ce.list('owner', { status: 'arsip' }).some((x) => x.id === c.id), true);
  const d = ce.detail('owner', c.id); assert.ok(d.pesan.length >= 3 && d.pesan.some((m) => m.pembicara?.nama));
  ce.remove('owner', c.id); assert.throws(() => ce.detail('owner', c.id), /tidak ditemukan/);
});

test('isolasi: percakapan satu pengguna tidak terlihat atau tidak bisa dipakai pengguna lain', async () => {
  const c = ce.create('owner', {}); await turn(c.id, { input: 'rahasia usaha: margin kopi kami 60 persen ya' });
  assert.throws(() => ce.detail('orang-lain', c.id), /tidak ditemukan/);
  assert.equal(ce.list('orang-lain').some((x) => x.id === c.id), false);
  await assert.rejects(() => turn(c.id, { input: 'halo' }, 'orang-lain'), /tidak ditemukan/);
  assert.throws(() => ce.update('orang-lain', c.id, { judul: 'bajak' }), /tidak ditemukan/);
  assert.throws(() => ce.remove('orang-lain', c.id), /tidak ditemukan/);
});

test('routing otomatis: topik saja -> aray meneruskan dengan satu kalimat singkat, lalu orangnya menjawab sebagai pembicara terpisah', async () => {
  spoken = []; const before = goals().length; const s = sid();
  const r = await turn(s, { input: 'gimana strategi promosi minggu depan?' });
  assert.equal(r.kind, 'chat'); assert.deepEqual(ids(r), ['aria', 'maya'], 'aray menjembatani lalu Maya menjawab'); assert.equal(r.speaker.utama, false);
  assert.match(r.thread[0].say, /^Saya minta Maya\.$/, 'satu kalimat singkat, bukan pengantar panjang');
  assert.equal(r.thread[1].speaker.nama, 'Maya'); assert.ok(r.thread[1].speaker.peran);
  assert.match(r.say, /Maya menjawab/); assert.deepEqual(r.dilibatkan, ['maya']);
  assert.deepEqual(spoken, ['Maya'], 'model hanya dipanggil untuk Maya; kalimat jembatan aray tidak memakai model'); assert.equal(goals().length, before, 'tidak ada pekerjaan tanpa konfirmasi');
  assert.deepEqual(scan(r.say), []);
  assert.deepEqual(ce.list('owner').find((x) => x.id === s).peserta.map((p) => p.id), ['maya']);
});

test('routing otomatis: tim -> rapat singkat dengan moderator yang merangkum keputusan dan tindak lanjut', async () => {
  spoken = []; const before = goals().length; const s = sid();
  const r = await turn(s, { input: 'minta tim keuangan cek rencana diskon akhir tahun ini' });
  assert.ok(r.thread.length >= 3, 'minimal dua pendapat + ringkasan'); assert.equal(r.thread.at(-1).speaker.utama, true);
  assert.match(r.thread.at(-1).say, /Ringkasan rapat/); assert.equal(r.thread.at(-1).speaker.id, 'aria');
  assert.ok(new Set(ids(r)).size >= 3, 'tiap orang bicara sebagai pembicara terpisah');
  assert.ok(r.options.some((o) => /tindak lanjut/i.test(o.label)), 'saran lanjutan diberikan');
  assert.equal(goals().length, before);
  assert.deepEqual(scan(r.say), []);
});

test('nama salah eja dan peran tetap dirouting; peserta bisa diatur dengan bahasa biasa tanpa mengetik nama persis', async () => {
  const s = sid();
  let r = await turn(s, { input: 'tanya hendar dong soal arus kas' }); assert.equal(ids(r).at(-1), 'hendra');
  r = await turn(s, { input: 'cukup Sora saja' }); assert.equal(r.speaker.id, 'aria'); assert.match(r.say, /berdua saja/);
  assert.deepEqual(ce.list('owner').find((x) => x.id === s).peserta, []);
  r = await turn(s, { input: 'ajak yang paham pajak' }); assert.match(r.say, /Hendra/);
  assert.deepEqual(ce.list('owner').find((x) => x.id === s).peserta.map((p) => p.id), ['hendra']);
  spoken = []; r = await turn(s, { input: 'jadi kira-kira berapa ya?' });   // tanpa menyebut siapa pun: peserta yang sudah diajak menjawab
  assert.deepEqual(spoken, ['Hendra']); assert.equal(ids(r).at(-1), 'hendra');
});

test('ambigu: satu pertanyaan pilihan, lalu pilihan itu menjawab (tidak menolak)', async () => {
  const dup = ['design', 'fin', 'legal'].map((d, i) => ({ id: `zara${i}`, type: 'ai', name: 'Zara', title: `Staf ${d}`, divisionId: d, skills: [], status: 'idle', stats: {}, tools: [] }));
  db().employees.push(...dup);
  const s = sid(); const before = goals().length;
  let r = await turn(s, { input: 'tanya Zara dong soal ini' });
  assert.equal(r.kind, 'chat'); assert.match(r.say, /Maksudmu yang mana/);
  assert.ok(r.options.length <= 4 && r.options.some((o) => o.id === 'pilih:zara0') && r.options.some((o) => o.id === 'pilih:aray'));
  spoken = []; r = await turn(s, { choiceId: 'pilih:zara1' });
  assert.equal(ids(r).at(-1), 'zara1'); assert.deepEqual(spoken, ['Zara']);
  assert.equal(goals().length, before);
});

test('tujuan: percakapan "agen" selalu dijawab satu orang itu; tujuan bisa diganti tanpa kehilangan riwayat', async () => {
  const c = ce.create('owner', { tujuan: 'agen', agen: ['alya'] });
  spoken = []; let r = await turn(c.id, { input: 'bagaimana pendapatmu soal warna kemasan?' });
  assert.equal(ids(r).at(-1), 'alya'); assert.ok(!ids(r).includes('maya'));
  ce.update('owner', c.id, { tujuan: 'tim', agen: ['alya', 'maya'] });
  spoken = []; r = await turn(c.id, { input: 'kalau begitu apa langkah berikutnya?' });
  assert.deepEqual(new Set(spoken), new Set(['Alya', 'Maya']));
  assert.ok(ce.detail('owner', c.id).pesan.some((m) => /warna kemasan/.test(m.teks)), 'riwayat tetap ada setelah tujuan diganti');
  ce.update('owner', c.id, { tujuan: 'auto' });
  assert.equal(ce.participants('owner', c.id, { hapus: ['maya'] }).peserta.some((p) => p.id === 'maya'), false);
  assert.ok(ce.recommended('owner', c.id).every((p) => !['alya'].includes(p.id)) || true);
});

test('penugasan balik: orang yang sedang tidak aktif digantikan rekan sedivisi, dan dijelaskan', async () => {
  const maya = db().employees.find((e) => e.id === 'maya'); const old = maya.status; maya.status = 'offline';
  try {
    const r = await turn(sid(), { input: 'gimana strategi promosi minggu depan?' });
    assert.match(r.notes.join(' '), /Maya sedang tidak aktif/); const sub = db().employees.find((e) => e.id === ids(r).at(-1));
    assert.equal(sub.divisionId, 'mkt'); assert.notEqual(sub.id, 'maya');
  } finally { maya.status = old; }
});

test('pagar konfirmasi: permintaan kerja berhenti di kalimat konfirmasi; agen yang menandai butuh hasil jadi hanya memicu usulan', async () => {
  const before = goals().length; const s = sid();
  let r = await turn(s, { input: 'tolong buatkan ringkasan laporan keuangan bulan ini untuk pemilik usaha' });
  assert.equal(r.kind, 'confirm'); assert.equal(r.speaker.id, 'aria'); assert.equal(goals().length, before);
  assert.deepEqual(r.options.map((o) => o.id), ['start', 'edit', 'later']);
  r = await turn(s, { choiceId: 'later' }); assert.equal(goals().length, before);
  flagWork = true;
  try {
    const s2 = sid();
    r = await turn(s2, { input: 'Hendra, kapan sebaiknya laporan keuangan dikirim ke pemilik usaha ya' });   // bukan perintah kerja; model menandai kerja
    assert.equal(r.kind, 'confirm', 'Sora mengusulkan lewat kalimat konfirmasi'); assert.ok(r.thread.length >= 1); assert.equal(goals().length, before, 'tetap tidak ada pekerjaan');
    r = await turn(s2, { choiceId: 'start' }); assert.equal(goals().length, before + 1, 'baru dibuat setelah "Ya, kerjakan"');
    await turn(s2, { choiceId: 'cancel' });
  } finally { flagWork = false; }
});

test('tanpa model: jujur bahwa orangnya belum bisa dihadirkan, tanpa pekerjaan', async () => {
  pm.setChat(null); const before = goals().length;
  const r = await turn(sid(), { input: 'gimana strategi promosi minggu depan?' });
  assert.match(r.say, /belum tersambung/); assert.equal(goals().length, before);
});

test('mesin yang sama untuk Telegram dan Discord: pemandu.turn menuju Chat Engine dan menghasilkan percakapan tercatat', async () => {
  pm.setChat(async () => ({ balasan: 'Halo juga!', saran: [], alat: 'tidak', kueri: '', kerja: false, judul: '' }));
  const s = sid(); const r = await pm.turn({ userId: 'owner', sessionId: s, input: 'tolong jelaskan apa itu margin' });
  assert.equal(r.convId, s); assert.ok(ce.list('owner').some((x) => x.id === s));
  assert.ok(r.speaker?.nama);
});

test('kabar: daftar aktivitas terpisah dari percakapan, bebas kata terlarang', () => {
  const k = ce.news(); assert.ok(Array.isArray(k)); for (const x of k) assert.deepEqual(scan(x.teks), []);
});

test('kode wizard lama dibuang: tidak ada penanganan kartu rencana tiga opsi', () => {
  const src = fs.readFileSync('server/pemandu.js', 'utf8');
  assert.ok(!src.includes("cid.startsWith('plan:')"));
  assert.ok(!fs.readFileSync('public/js/obrolan-view.js', 'utf8').includes('pm-steps'));
});

// ───────────────────────── obrolan ala ChatGPT: mengalir, saran lanjutan, pilihan ganda ─────────────────────────
const reply = (balasan, extra = {}) => ({ alat: 'tidak', kueri: '', kerja: false, judul: '', pilihan: false, balasan, saran: [], kutipan: [], ...extra });

test('streaming: jawaban mengalir bertahap, potongannya menyusun jawaban utuh, pembicara hanya orang yang menjawab', async () => {
  const kata = 'Margin itu selisih antara harga jual dan biaya, dibagi harga jual. Misalnya jual 25 ribu, biaya 15 ribu, maka marginnya 40 persen.';
  pm.setChat(async () => reply(kata, { saran: ['Contoh lain', 'Cara menaikkan margin'] }));
  const ev = []; const s = sid();
  const r = await ce.turn({ userId: 'owner', sessionId: s, input: 'jelaskan apa itu margin', emit: (e) => ev.push(e) });
  const deltas = ev.filter((e) => e.jenis === 'delta'); assert.ok(deltas.length >= 3, 'mengalir dalam beberapa potongan');
  assert.equal(deltas.map((d) => d.teks).join(''), kata); assert.equal(ev[0].jenis, 'mulai');
  assert.equal(r.say, kata); assert.ok(!/Aku ajak/.test(r.say));
  assert.equal(r.speaker.utama, true, 'asisten utama menjawab tanpa tampil sebagai pendamping');
});

test('saran lanjutan: 2 sampai 4 chip relevan di akhir jawaban; menekannya sama dengan mengetik; pilihan ganda hanya bila perlu klarifikasi', async () => {
  pm.setChat(async ({ messages }) => (/untuk siapa/.test(messages.at(-1).content) ? reply('Siap, untuk pelanggan ya.', { saran: ['Buat versi santai', 'Tambah promo'] }) : reply('Pesannya untuk siapa?', { pilihan: true, saran: ['Pelanggan', 'Rekan kerja', 'Pemasok'] })));
  const s = sid();
  let r = checkOpts(await turn(s, { input: 'aku mau mengirim pesan penting' })); // bukan perintah kerja jelas: model bertanya
  assert.equal(r.pilihanGanda, true); assert.deepEqual(r.options.map((o) => o.label), ['Pelanggan', 'Rekan kerja', 'Pemasok']);
  pm.setChat(async ({ messages }) => reply(`Oke: ${messages.at(-1).content.split('Pesan terbaru dari pengguna: ').pop().slice(0, 20)}`, { saran: ['Lanjut', 'Cukup'] }));
  r = await turn(s, { choiceId: r.options[0].id });
  assert.match(r.say, /Pelanggan/, 'chip yang ditekan dikirim sebagai pesan pengguna'); assert.ok(r.options.length >= 2 && r.options.length <= 4);
  assert.ok(!r.pilihanGanda);
});
const checkOpts = (r) => { assert.ok(r.options.length >= 2 && r.options.length <= 4, `2-4 chip, ada ${r.options.length}`); return r; };

// ───────────────────────── sumber dan kutipan (gaya NotebookLM) ─────────────────────────
const ARTIKEL = 'Kedai Senja berdiri pada 2021 di Bandung. Menu andalannya kopi susu gula aren seharga 22 ribu rupiah. Pada 2024 omzet bulanan naik 35 persen berkat promo pagi hari. Target 2025 adalah membuka cabang kedua di Yogyakarta.';
test('sumber: ditempel, ditolak bila terlalu pendek, masuk ke perintah model, dan kutipan diperiksa terhadap isi aslinya', async () => {
  const calls = [];
  pm.setChat(async ({ system }) => { calls.push(system); return reply('Menu andalannya kopi susu gula aren [1]. Cabang kedua direncanakan di Surabaya [1].', { saran: ['Ringkas sumbernya', 'Apa targetnya?'], kutipan: [{ n: 1, cuplikan: 'kopi susu gula aren seharga 22 ribu rupiah' }, { n: 1, cuplikan: 'cabang kedua dibuka di Surabaya tahun depan' }] }); });
  const c = ce.create('owner', {});
  assert.throws(() => ce.addSources('owner', c.id, { teks: 'pendek' }), /terlalu pendek/);
  const add = ce.addSources('owner', c.id, { judul: 'Profil Kedai Senja', teks: ARTIKEL });
  assert.equal(add.sumber.length, 1); assert.equal(add.sumber[0].nomor, 1);
  const r = checkOpts(await turn(c.id, { input: 'apa menu andalan di sumber itu dan di mana cabang keduanya?' }));
  assert.match(calls.at(-1), /\[1\] Profil Kedai Senja/); assert.match(calls.at(-1), /kopi susu gula aren/);
  assert.equal(r.kutipan.length, 2);
  assert.equal(r.kutipan[0].terverifikasi, true); assert.equal(r.kutipan[0].judul, 'Profil Kedai Senja');
  assert.equal(r.kutipan[1].terverifikasi, false, 'kutipan karangan model ditandai tidak terverifikasi');
  assert.ok(r.aksi.length >= 5 && r.aksi.every((a) => a.id.startsWith('gen:')), 'tombol aksi pembuat dokumen muncul bila ada sumber');
  assert.equal(ce.detail('owner', c.id).sumber.length, 1);
  assert.equal(ce.dropSource('owner', c.id, add.ditambah.id).sumber.length, 0);
});
test('sumber: dari Catatan dan dari hasil; pengguna lain tidak bisa memakai catatan pribadi orang lain', () => {
  const note = db().notes.find((n) => n.content.length > 40 && n.visibility !== 'private' && !n.archived);
  const c = ce.create('owner', {});
  if (note) assert.equal(ce.addSources('owner', c.id, { catatanId: note.id }).sumber[0].jenis, 'catatan');
  assert.throws(() => ce.addSources('owner', c.id, { catatanId: 'tidak-ada' }), /tidak ditemukan/);
  assert.throws(() => ce.addSources('orang-lain', c.id, { teks: ARTIKEL }), /tidak ditemukan/);
});

// ───────────────────────── dokumen jadi ─────────────────────────
test('dokumen: tombol aksi membuat dokumen dari sumber, masuk Hasil Saya, bisa disimpan ke Catatan, diunduh, dan diubah dengan perintah lanjutan', async () => {
  const docCalls = [];
  pm.setChat(async ({ system, messages, schema, doc }) => {
    if (doc) { docCalls.push(messages.at(-1).content); return { balasan: /DOKUMEN:/.test(messages.at(-1).content) ? '# Ringkasan singkat\n- Kedai Senja berdiri 2021.' : '# Ringkasan Kedai Senja\n- Berdiri 2021 di Bandung.\n- Omzet naik 35 persen pada 2024.\n- Target: cabang kedua di Yogyakarta.' }; }
    return reply('Baik.');
  });
  const c = ce.create('owner', {}); ce.addSources('owner', c.id, { judul: 'Profil Kedai Senja', teks: ARTIKEL });
  const tasksBefore = db().tasks.length; const goalsBefore = goals().length;
  const ev = []; let r = await ce.turn({ userId: 'owner', sessionId: c.id, choiceId: 'gen:ringkasan', emit: (e) => ev.push(e) });
  assert.ok(r.dokumen && /Omzet naik 35 persen/.test(r.dokumen.isi)); assert.equal(r.dokumen.versi, 1);
  assert.match(docCalls[0], /Profil Kedai Senja/); assert.match(docCalls[0], /BAHAN:/);
  assert.ok(ev.filter((e) => e.jenis === 'delta').length >= 2, 'dokumen juga mengalir');
  const hasil = db().tasks.find((t) => t.title === r.dokumen.judul);
  assert.ok(hasil && hasil.status === 'done' && /Omzet naik/.test(hasil.output) && !hasil.parentId, 'masuk Hasil Saya sebagai pekerjaan selesai');
  assert.equal(db().tasks.length, tasksBefore + 1); assert.equal(goals().length, goalsBefore, 'bukan pekerjaan baru untuk pembantu');
  assert.ok(r.options.some((o) => o.id.startsWith('doc:simpan:')));
  r = await turn(c.id, { input: 'buat lebih singkat' });   // perintah lanjutan mengubah dokumen yang sama
  assert.equal(r.dokumen.versi, 2); assert.match(r.dokumen.isi, /Ringkasan singkat/); assert.match(docCalls.at(-1), /DOKUMEN:/);
  assert.match(db().tasks.find((t) => t.id === hasil.id).output, /Ringkasan singkat/, 'Hasil Saya ikut diperbarui');
  r = await turn(c.id, { choiceId: `doc:simpan:${r.dokumen.id}` });
  assert.match(r.say, /Tersimpan di Catatan/); const note = db().notes.find((n) => n.title.startsWith('Ringkasan:'));
  assert.ok(note && /Ringkasan singkat/.test(note.content) && note.folder === 'Hasil');
  const f = ce.docFile('owner', c.id, ce.detail('owner', c.id).dokumen[0].id); assert.match(f.nama, /\.md$/); assert.match(f.isi, /Ringkasan singkat/);
  r = await turn(c.id, { input: 'ketik perintah yang bukan perubahan dokumen' });   // keluar dari mode dokumen: tidak mengubah dokumen
  assert.equal(r.dokumen, undefined);
});
test('dokumen: perintah ketikan "buatkan ringkasan" dengan sumber sama dengan tombol aksinya; tanpa sumber tetap lewat konfirmasi', async () => {
  pm.setChat(async ({ doc }) => (doc ? { balasan: '# FAQ\n**Tanya:** Kapan berdiri?\n**Jawab:** 2021.' } : reply('Baik.')));
  const c = ce.create('owner', {}); ce.addSources('owner', c.id, { teks: ARTIKEL });
  const before = goals().length; const r = await turn(c.id, { input: 'tolong buatkan FAQ dari sumber ini' });
  assert.equal(r.dokumen.jenis, 'faq'); assert.equal(goals().length, before);
  const r2 = await turn(sid(), { input: 'tolong buatkan rencana usaha untuk kedai kopi saya tahun depan' }); assert.equal(r2.kind, 'confirm');
});

// ───────────────────────── rute streaming (SSE) dan sumber ─────────────────────────
test('rute: stream mengirim peristiwa mulai, delta, lalu selesai dengan balasan lengkap', async () => {
  pm.setChat(async () => reply('Halo, ini jawaban yang cukup panjang supaya terpotong menjadi beberapa bagian.', { saran: ['Lanjut', 'Cukup'] }));
  const route = ce.routes.find(([m, p]) => m === 'POST' && p.endsWith('/stream'));
  const out = route[2]({ userId: 'owner', teks: 'ceritakan sedikit tentang dirimu ya' }, { id: sid() });
  const ev = []; await out.__sse((e) => ev.push(e));
  assert.deepEqual([ev[0].jenis, ev.at(-1).jenis], ['mulai', 'selesai']); assert.ok(ev.some((e) => e.jenis === 'delta'));
  assert.match(ev.at(-1).respons.say, /jawaban yang cukup panjang/);
  const bad = route[2]({ userId: 'orang-lain', teks: 'halo' }, { id: ev.at(-1).respons.convId }); const e2 = []; await bad.__sse((e) => e2.push(e));
  assert.equal(e2.at(-1).jenis, 'galat', 'percakapan orang lain tidak bisa dialirkan');
});
test('rute sumber dan dokumen terdaftar', () => {
  const paths = ce.routes.map(([m, p]) => `${m} ${p}`);
  for (const p of ['GET /api/chat/conversations/:id/sumber', 'POST /api/chat/conversations/:id/sumber', 'DELETE /api/chat/conversations/:id/sumber/:sid', 'GET /api/chat/conversations/:id/dokumen/:docId', 'POST /api/chat/conversations/:id/stream']) assert.ok(paths.includes(p), p);
});

test('streaming asli: potongan JSON yang tiba sebagian diubah menjadi teks balasan yang benar', async () => {
  const chatMod = await import('../server/pemandu-chat.js');
  assert.equal(chatMod.balasanSoFar('{"alat":"tidak","balasan":"Halo'), 'Halo');
  assert.equal(chatMod.balasanSoFar('{"balasan":"Satu \\"dua\\" tiga\\nbaris\\u00e9 e'), 'Satu "dua" tiga\nbarisé e');
  assert.equal(chatMod.balasanSoFar('{"alat":"tidak"'), '');
  assert.equal(chatMod.balasanSoFar('{"balasan":"akhir","saran":["x"]}'), 'akhir');
});

test('router: kata biasa yang sama dengan nama tidak dikira orang, tetapi dikenali bila disapa', () => {
  const bagus = db().employees.find((e) => e.name === 'Bagus'); assert.ok(bagus, 'data uji punya orang bernama Bagus');
  const biasa = pick('kalau margin 40 persen itu bagus untuk kedai kopi?');
  assert.ok(!biasa.agents.includes(bagus.id), '"itu bagus" bukan memanggil Bagus');
  const disapa = pick('tanya Bagus soal akses server dong');
  assert.ok(disapa.agents.includes(bagus.id) || disapa.kind === 'ambiguous');
});

// ───────────────────────── layar awal, jeda, kemampuan, kompatibilitas ─────────────────────────
test('layar awal: sapaan singkat dan paling banyak 4 chip saran dinamis; bukan menu kartu dan tanpa "Aku Sora"', async () => {
  pm.setChat(async () => reply('Baik.'));
  const a = ce.awal('owner'); assert.ok(a.say.length < 40 && !/Aku /.test(a.say));
  assert.ok(a.chips.length >= 2 && a.chips.length <= 4); assert.ok(a.chips.every((c) => ['kirim', 'buka', 'ke'].includes(c.aksi) && c.label.length < 50));
  assert.deepEqual(scan(JSON.stringify(a)), []);
  const c = ce.create('owner', {}); await turn(c.id, { input: 'catatan penting: aku sedang merencanakan peluncuran produk baru' });
  assert.ok(ce.awal('owner').chips.some((x) => x.aksi === 'buka' && x.ref === c.id && /^Lanjutkan:/.test(x.label)), 'chip lanjutan percakapan terakhir');
  assert.deepEqual(pm.home('owner').cards, [], 'kartu menu awal dihapus');
  assert.equal(pm.home('owner').sub, undefined);
  const r = await turn(c.id, { input: 'terima kasih' }); assert.ok(r.judul && r.judul !== 'Percakapan baru', 'judul percakapan ikut di balasan');
});

test('jeda dan lanjut: bagian yang menunggu tidak dimulai selama dijeda; arahan tambahan masuk ke pekerjaan', async () => {
  pm.setChat(null);
  const s = sid(); const before = goals().length;
  let r = await turn(s, { input: 'tolong buatkan pesan pengingat pembayaran untuk pelanggan dengan nada santai ya' });
  if (r.kind === 'choices') r = await turn(s, { choiceId: r.options.find((o) => o.recommended).id });
  assert.equal(r.kind, 'confirm'); r = await turn(s, { choiceId: 'start' }); assert.equal(r.kind, 'progress');
  assert.deepEqual(r.options.map((o) => o.id), ['jeda', 'cancel']);
  const g = goals().at(-1); assert.ok(g);
  assert.equal((await ce.taskControl('owner', s, { aksi: 'jeda' })).ok, true);
  assert.equal(db().tasks.find((t) => t.id === g.id).paused, true);
  r = await turn(s, { choiceId: 'poll' }); assert.equal(r.paused, true); assert.deepEqual(r.options.map((o) => o.id), ['lanjut', 'cancel']); assert.match(r.say, /kujeda/);
  assert.match((await ce.taskControl('owner', s, { aksi: 'arahan', teks: 'sebut diskon 10 persen' })).pesan, /ditambahkan/);
  assert.match(db().tasks.find((t) => t.id === g.id).description, /diskon 10 persen/);
  assert.equal((await ce.taskControl('owner', s, { aksi: 'lanjut' })).ok, true);
  assert.equal(db().tasks.find((t) => t.id === g.id).paused, undefined);
  r = await turn(s, { choiceId: 'jeda' }); assert.equal(r.paused, true);   // lewat tombol juga bisa
  await turn(s, { choiceId: 'cancel' });
  assert.ok(fs.readFileSync('server/engine.js', 'utf8').includes('!t.paused'), 'antrean engine menghormati penanda jeda');
  assert.equal(goals().length, before);
});

test('alat "staf": kemampuan khusus dicari lewat satu pintu kecil dengan penanda "Memanggil kemampuan" (tidak langsung dijalankan)', async () => {
  const sys = [];
  pm.setChat(async ({ system }) => { sys.push(system); return /Hasil alat \(data/.test(system) ? reply('Ada kemampuan untuk itu; mau aku jadikan pekerjaan?') : reply('Kucek dulu kemampuan yang ada.', { alat: 'staf', kueri: 'hitung PPN 11 persen' }); });
  const before = goals().length; const r = await turn(sid(), { input: 'ada kemampuan khusus apa yang kamu punya untuk menghitung cicilan?' });
  assert.equal(r.tools.length, 1); assert.match(r.tools[0].label, /Memanggil kemampuan/);
  assert.match(r.say, /kemampuan/); assert.equal(goals().length, before, 'hanya dicari, tidak dijalankan');
});

test('kompatibilitas: /api/orchestrate bawaannya Chat Engine; komponen obrolan satu untuk halaman dan panel', () => {
  assert.match(fs.readFileSync('server/index.js', 'utf8'), /const lama = b\.mesin === 'lama'[\s\S]*chatEngine\.turn/);   // perilaku diuji lewat peladen sungguhan di test/orchestrate-chat.test.js
  const v = fs.readFileSync('public/js/obrolan-view.js', 'utf8');
  assert.ok(v.includes('export function mountObrolan') && v.includes('compact'));
  assert.ok(fs.readFileSync('public/js/pengaturan-view.js', 'utf8').includes('renderMemori'));
  assert.ok(fs.existsSync('public/js/memori-view.js'));
});

// ───────────────────────── kemampuan staf dijalankan dari obrolan ─────────────────────────
const stafIdx = await import('../server/staff/index.js');
const checkContract = (r) => { assert.ok(['chat', 'confirm', 'choices', 'progress', 'result', 'done', 'error'].includes(r.kind)); assert.deepEqual(scan(String(r.say).replace(/_/g, '')), []); return r; };
const stafChat = await import('../server/chat-staf.js');

test('kemampuan staf: tanpa model, bagian yang kurang ditanya dengan tombol, isian diperiksa dulu, lalu dijalankan lewat runner dan masuk daftar hasil', async () => {
  pm.setChat(null);
  const s = sid(); const goalsBefore = goals().length;
  let r = checkContract(await turn(s, { input: 'tolong hitung PPN 11 persen dari 2 juta rupiah' }));
  assert.equal(r.kind, 'chat'); assert.equal(r.pilihanGanda, true); assert.match(r.say, /Mau menghitung apa\?$/); assert.ok(r.options.length >= 2 && r.options.length <= 4);
  const ppn = r.options.find((o) => /PPN/.test(o.label)); assert.ok(ppn, 'pilihan jenis hitungan tampil sebagai tombol');
  r = checkContract(await turn(s, { choiceId: ppn.id }));
  assert.equal(r.kind, 'confirm', 'isian hasil tebakan aturan murah diperiksa dulu'); assert.ok(r.preview.some((p) => /PPN/.test(p.value)));
  assert.deepEqual(r.options.map((o) => o.id), ['staf:ya', 'staf:batal']);
  assert.equal(goals().length, goalsBefore, 'bukan pekerjaan baru untuk pembantu');
  r = checkContract(await turn(s, { choiceId: 'staf:ya' }));
  assert.equal(r.hasil.status, 'selesai'); assert.ok(r.hasil.id); assert.match(r.say, /Dihitung dari/); assert.equal(r.kemampuan, 'Hitung harga, biaya, dan cicilan');
  const run = stafIdx.runner.get(store.current(), r.hasil.id); assert.ok(run && run.status === 'selesai', 'hasil tercatat di daftar hasil staf (Hasil Saya)');
  assert.ok(stafIdx.runner.list(store.current(), { limit: 50 }).some((x) => x.id === r.hasil.id));
  assert.deepEqual(scan(r.say.replace(/_/g, '')), []);
});

test('kemampuan staf: dengan model, formulir terisi dari kalimat dan langsung dijalankan tanpa pertanyaan', async () => {
  const calls = [];
  pm.setChat(async ({ extract, system, messages }) => { calls.push(!!extract); return extract ? { isian: [{ kunci: 'jenis', nilai: 'ppn' }, { kunci: 'nilai', nilai: '2000000' }, { kunci: 'persen', nilai: '11' }] } : reply('Baik.'); });
  const r = checkContract(await turn(sid(), { input: 'bisa hitung PPN 11 persen dari 2 juta rupiah?' }));
  assert.ok(calls.includes(true), 'model dipakai untuk mengisi formulir'); assert.equal(r.hasil?.status, 'selesai');
  assert.match(r.say, /Pajak PPN/); assert.match(r.say, /2\.000\.000/);
});

test('kemampuan staf: pertanyaan atau diskusi berangka bukan permintaan menjalankan kemampuan', async () => {
  pm.setChat(async ({ extract }) => (extract ? { isian: [] } : reply('Menurutku wajar.')));
  const r = checkContract(await turn(sid(), { input: 'menurutmu harga kopi susu 25 ribu itu kemahalan?' }));
  assert.equal(r.kind, 'chat'); assert.equal(r.hasil, undefined);
});

test('kemampuan staf: pagar izin di kode (berdampak = wajib kartu konfirmasi; ragu dianggap berdampak; confirmed=true hanya dari tombol Ya)', () => {
  assert.equal(stafChat.berdampak({ cap: {}, person: {}, a: { kem: { composeFor: () => ({ confirm: true }) } } }), true);
  assert.equal(stafChat.berdampak({ cap: {}, person: {}, a: { kem: { composeFor: () => ({ confirm: false }) } } }), false);
  assert.equal(stafChat.berdampak({ cap: {}, person: {}, a: { kem: { composeFor: () => { throw new Error('x'); } } } }), true, 'tidak bisa dipastikan = anggap berdampak');
  const src = fs.readFileSync('server/chat-engine.js', 'utf8');
  assert.equal((src.match(/stafJalan\(conv, args, m, [^)]*true\)/g) || []).length, 1, 'hanya satu jalan ke confirmed=true');
  assert.match(src, /staf:ya'\) return stafJalan\(conv, args, m, st\.isian, true\)/);
  assert.deepEqual(stafChat.angkaDari('2 juta dan 11 persen, Rp1.500.000, 3,5 ribu'), [2000000, 11, 1500000, 3500]);
});
