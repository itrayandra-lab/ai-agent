import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanText, terbilang, profileFor, audiblyDifferent, genderOf, createFloor } from '../public/js/tts.js';
import { buildSeed } from '../server/seed.js';

test('terbilang membaca angka dengan wajar', () => {
  assert.equal(terbilang(0), 'nol'); assert.equal(terbilang(11), 'sebelas'); assert.equal(terbilang(100), 'seratus');
  assert.equal(terbilang(2025), 'dua ribu dua puluh lima'); assert.equal(terbilang(1500000), 'satu juta lima ratus ribu');
});
test('cleanText membuang markdown, tautan, emoji; angka dan singkatan dibacakan', () => {
  const t = cleanText('## Laporan **KPI** 🎉\n- Selesai 95% dgn [dokumen](https://x.io/a) cek https://x.io\n`kode` Rp1.500.000 utk 3 tim');
  assert.ok(!/[*#`\[\]🎉]|https?:/.test(t), t);
  assert.match(t, /ka pi ai/); assert.match(t, /sembilan puluh lima persen/); assert.match(t, /dengan dokumen/); assert.match(t, /satu juta lima ratus ribu rupiah/); assert.match(t, /untuk tiga tim/);
});
test('cleanText memotong teks panjang di batas kalimat', () => {
  const t = cleanText(('Ini kalimat panjang sekali. ').repeat(60), 200); assert.ok(t.length <= 200 && t.endsWith('.'));
});
test('profil suara deterministik dan berbeda untuk 170+ agen', () => {
  const emps = buildSeed().employees.filter((e) => e.type === 'ai');
  assert.ok(emps.length >= 100);
  const P = emps.map((e) => profileFor(e.id, genderOf(e), 1));
  assert.deepEqual(P[3], profileFor(emps[3].id, genderOf(emps[3]), 1));
  assert.equal(new Set(P.map((p) => p.pitch + '/' + p.rate)).size, P.length, 'parameter tepat sama');
  // 20 agen pertama: setiap pasangan terhitung, minimal 85% terdengar berbeda dengan satu suara id-ID
  const first = P.slice(0, 20); let pairs = 0, diff = 0;
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) { pairs++; if (audiblyDifferent(first[i], first[j])) diff++; }
  assert.ok(diff / pairs >= 0.85, `hanya ${diff}/${pairs}`);
  for (const p of P) { assert.ok(p.pitch >= 0.55 && p.pitch <= 1.55 && p.rate >= 0.8 && p.rate <= 1.2); }
});

test('profil mesin server (Microsoft): suara sesuai gender, parameter valid, 20 agen cukup berbeda', async () => {
  const { audiblyDifferentEdge, cleanText: ct } = await import('../public/js/tts.js');
  const emps = buildSeed().employees.filter((e) => e.type === 'ai').slice(0, 20);
  const P = emps.map((e) => profileFor(e.id, genderOf(e), 1));
  for (const p of P) { assert.equal(p.eVoice, p.gender === 'female' ? 'id-ID-GadisNeural' : 'id-ID-ArdiNeural'); assert.ok(p.eRate >= -8 && p.eRate <= 12 && p.ePitch >= -10 && p.ePitch <= 12); }
  let pairs = 0, diff = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { pairs++; if (audiblyDifferentEdge(P[i], P[j])) diff++; }
  assert.ok(diff / pairs >= 0.88, diff + '/' + pairs);
  assert.match(ct('Rapat jam 10:30 tgl 05/12/2025 dgn @maya'), /^Rapat pukul sepuluh lewat tiga puluh tanggal lima Desember dua ribu dua puluh lima dengan maya$/);
});

test('kamus ucapan: hanya kata utuh yang diganti, selain itu teks tidak berubah', async () => {
  const { applyPron } = await import('../public/js/tts.js');
  const s = 'Saya sedang luang, selesai sesuai target dan sebagainya. Sesi server sehat?';
  assert.equal(applyPron(s, {}), s, 'tanpa kamus tidak ada huruf yang berubah');
  assert.equal(applyPron('Sedang, sedang-sedangan', { sedang: 'sudang' }), 'Sudang, sudang-sedangan');
  assert.equal(applyPron('kata (x) 5%', { x: 'ex' }), 'kata (ex) 5%');
});

test('teks yang sampai ke suara 3D sama dengan pesan asli (tidak ada huruf hilang, tidak terpotong)', async () => {
  const { messageSource, cleanText: ct } = await import('../public/js/tts.js');
  const original = 'Baik, saya di sini—siap membantu! Silakan sampaikan tugas selanjutnya, sesuai kebutuhan sistem. '.repeat(4).trim();
  const ev = { type: 'message', text: 'Sora → Owner: ' + original.replace(/\s+/g, ' ').slice(0, 80), messageId: 'm1' };
  const got = messageSource(ev, (e) => (e.messageId === 'm1' ? original : ''));
  assert.equal(got, original.replace(/\s+/g, ' '));
  for (const w of ['saya', 'sini', 'siap', 'Silakan', 'selanjutnya', 'sistem']) assert.ok(got.includes(w), w);
  // cadangan bila pesan belum ada di klien: pratinjau event tanpa awalan "A → B:"
  assert.equal(messageSource({ text: 'Sora → Owner: Halo, saya siap.' }, () => ''), 'Halo, saya siap.');
  assert.equal(messageSource({ text: 'tanpa pemisah' }, null), 'tanpa pemisah');
  // jalur Chat: tombol bicara memakai m.text apa adanya; pembersih hanya membuang markup, bukan huruf
  assert.equal(ct('Saya sedang **siap** di sini, selesai sesuai sistem.'), 'Saya sedang siap di sini, selesai sesuai sistem.');
});

test('event pesan dari server membawa messageId (balasan agen, send_message, tanya rekan)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const eng = fs.readFileSync(path.join(root, 'server/engine.js'), 'utf8'), col = fs.readFileSync(path.join(root, 'server/collab.js'), 'utf8');
  assert.match(eng, /event\('message', e\.id, `\$\{e\.name\} → \$\{emp\(msg\.authorId\)[^\n]*messageId: m\.id/);
  assert.match(eng, /messageId: sent\.id/);
  assert.match(col, /messageId: asked\.id/); assert.match(col, /messageId: answered\.id/);
});

test('gender dari nama: nama umum benar, semua agen punya gender, cewek dan cowok seimbang', async () => {
  const { inferGender, explainGender } = await import('../public/js/tts.js');
  const cases = { Dewi: 'female', Maya: 'female', Sinta: 'female', Putri: 'female', Salsabila: 'female', Nirmala: 'female', Raka: 'male', Dimas: 'male', Budi: 'male', Gunawan: 'male', Prasetyo: 'male', Taufik: 'male', Fitriani: 'female', Sutrisno: 'male', Rafihr: 'male' };
  for (const [n, g] of Object.entries(cases)) assert.equal(inferGender(n), g, n);
  assert.equal(inferGender('Anda (Owner)'), inferGender('Anda'), 'tanda kurung diabaikan');
  assert.equal(inferGender('Zzz'), inferGender('Zzz'), 'tebakan stabil');
  const names = buildSeed().employees.filter((e) => e.type === 'ai').map((e) => e.name);
  const g = names.map(inferGender), f = g.filter((x) => x === 'female').length;
  assert.ok(f > names.length * 0.35 && f < names.length * 0.65, 'cewek ' + f + ' dari ' + names.length);
  assert.ok(names.every((n) => explainGender(n).source === 'daftar'), 'nama seed semua dikenal dari daftar');
});

test('gender tidak memakai appearance (3D) dan nilai tersimpan menang atas tebakan', async () => {
  const { genderOf } = await import('../public/js/tts.js');
  assert.equal(genderOf({ name: 'Dewi', appearance: { gender: 'male' } }), 'female');
  assert.equal(genderOf({ name: 'Dewi', voiceGender: 'male' }), 'male');
  assert.equal(genderOf({ name: 'Dewi', voiceGender: 'oops' }), 'female');
});

test('migrasi server: voiceGender diisi sekali untuk agen AI, tidak menimpa, manusia dilewati', async () => {
  const { fillVoiceGender } = await import('../server/store.js');
  const list = [{ type: 'ai', name: 'Dewi' }, { type: 'ai', name: 'Raka', voiceGender: 'female' }, { type: 'human', name: 'Anda' }, { type: 'ai', name: 'Budi', voiceGender: 'male' }];
  assert.equal(fillVoiceGender(list), 1);
  assert.deepEqual(list.map((e) => e.voiceGender), ['female', 'female', undefined, 'male']);
  assert.equal(fillVoiceGender(list), 0, 'dijalankan lagi tidak mengubah apa pun');
});

test('rentang nada cewek dan cowok tidak tumpang tindih, dan satu rapat tidak ada suara kembar', async () => {
  const { tts, audiblyDifferent, BAND } = await import('../public/js/tts.js');
  const ai = buildSeed().employees.filter((e) => e.type === 'ai');
  tts.bind((id) => ai.find((e) => e.id === id));
  const fem = ai.filter((e) => genderOf(e) === 'female'), mal = ai.filter((e) => genderOf(e) === 'male');
  const fp = fem.map((e) => profileFor(e.id, 'female', 1)), mp = mal.map((e) => profileFor(e.id, 'male', 1));
  assert.ok(Math.min(...fp.map((p) => p.pitch)) > Math.max(...mp.map((p) => p.pitch)) + 0.05, 'cewek selalu lebih tinggi dari cowok');
  assert.ok(BAND.female.pitch[0] > BAND.male.pitch[1]);
  for (const size of [6, 12, 20]) {
    const room = ai.slice(10, 10 + size).map((e) => e.id), P = room.map((id) => tts.profile(id, room));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) assert.ok(audiblyDifferent(P[i], P[j]), `${room[i]} dan ${room[j]} (rapat ${size}) terdengar sama`);
    assert.deepEqual(room.map((id) => tts.profile(id, room)), P, 'hasil sama setiap dipanggil');
  }
});

test('pesan asli dicari lewat messageId, lalu pengirim+kanal terbaru, lalu pratinjau', async () => {
  const { findMessageFor, messageSource } = await import('../public/js/tts.js');
  const msgs = [{ id: 'a1', authorId: 'x', channelId: 'c1', text: 'lama' }, { id: 'a2', authorId: 'x', channelId: 'c1', text: 'Baik, saya sedang di sini, siap membantu sesuai sistem.' }, { id: 'a3', authorId: 'y', channelId: 'c1', text: 'lain' }];
  assert.equal(findMessageFor({ messageId: 'a1' }, msgs), 'lama');
  assert.equal(findMessageFor({ actorId: 'x', channelId: 'c1' }, msgs), 'Baik, saya sedang di sini, siap membantu sesuai sistem.', 'server lama tanpa messageId');
  assert.equal(findMessageFor({ actorId: 'z', channelId: 'c1' }, msgs), '');
  const old = { actorId: 'x', channelId: 'c1', text: 'X → Y: Baik,  aya di  ini— iap mem' };
  assert.equal(messageSource(old, (e) => findMessageFor(e, msgs)), 'Baik, saya sedang di sini, siap membantu sesuai sistem.');
  assert.equal(messageSource({ actorId: 'z', channelId: 'c1', text: 'X → Y: pratinjau' }, (e) => findMessageFor(e, msgs)), 'pratinjau');
});

test('kata kapital: nama panjang dibaca sebagai kata, singkatan pendek tetap dieja, tag audio tidak dibaca', async () => {
  const { cleanText: ct, extractTag, learnBrands } = await import('../public/js/tts.js');
  const a = ct('Produk PHYTOSYNC lolos BPOM dan CPKB, bayar via ATM atau KTP.');
  assert.ok(!/p h y t o|pe ha ye/.test(a), a);
  assert.match(a, /\bFitosink\b/);
  assert.match(a, /be pe o em/); assert.match(a, /ce pe ka be/); assert.match(a, /a te em/); assert.match(a, /ka te pe/);
  assert.match(ct('NASA dan GOJEK.'), /^Nasa dan Gojek\.$/);
  assert.match(ct('Produk SKINTIFIC baru.'), /Skintific/);
  assert.equal(ct('[excited] Selamat, berhasil! [sighs]'), 'Selamat, berhasil!');
  assert.equal(extractTag('[Whispers] pelan'), 'whispers');
  learnBrands([['NIVELLA', 'Nivela']]); assert.match(ct('Merek NIVELLA.'), /Nivela/);
  assert.equal(ct('Maaf, gagal...'), 'Maaf, gagal…');
});

test('gaya bicara: tanya naik, seru bertenaga, ragu melambat, tag memengaruhi, jeda mengikuti tanda baca', async () => {
  const { prosodyFor, sentencesOf } = await import('../public/js/tts.js');
  const q = prosodyFor('Apakah sudah siap?'), e = prosodyFor('Sudah selesai!'), d = prosodyFor('Hmm, entahlah...'), c = prosodyFor('Baik, lanjut,'), n = prosodyFor('Itu data hari ini.');
  assert.ok(q.dPitch > n.dPitch && e.dRate > n.dRate && d.dRate < n.dRate && d.pause > n.pause && c.pause < n.pause);
  assert.ok(prosodyFor('Selamat berhasil!').dPitch > e.dPitch, 'isi senang menambah semangat');
  assert.ok(prosodyFor('Maaf, gagal.').dRate < n.dRate, 'isi simpati melambat');
  assert.ok(prosodyFor('Halo.', 'whispers').vol < 1 && prosodyFor('Halo.', 'excited').dPitch > prosodyFor('Halo.').dPitch);
  for (const t of ['Apakah?', 'Wah selamat berhasil!', 'Maaf gagal...']) { const p = prosodyFor(t, 'excited'); assert.ok(Math.abs(p.dPitch) <= 0.12 && p.dRate >= -0.15 && p.dRate <= 0.12); }
  assert.deepEqual(sentencesOf('Halo. Apa kabar? Baik!'), ['Halo.', 'Apa kabar?', 'Baik!']);
  assert.ok(sentencesOf('Halo Owner, saya sudah memeriksa semua laporan hari ini, dan ada tiga hal penting yang perlu Anda ketahui sekarang.').length >= 2);
});

// ── pengatur giliran, dengan jam palsu: tidak ada yang bunyi saat Owner mengetik, tidak ada yang tumpang tindih
function fakeClock() {
  let t = 0, id = 0; const timers = new Map();
  return { now: () => t, timer: (fn, ms) => { timers.set(++id, { fn, at: t + ms }); return id; }, clear: (i) => timers.delete(i),
    advance(ms) { const end = t + ms; for (;;) { let best = null; for (const [k, v] of timers) if (v.at <= end && (!best || v.at < best[1].at)) best = [k, v]; if (!best) break; timers.delete(best[0]); t = Math.max(t, best[1].at); best[1].fn(); } t = end; } };
}
function sim(extra = {}) {
  const clk = fakeClock(), log = [], active = new Set(); let overlap = 0, plays = [];
  const floor = createFloor({ ...clk, rand: () => 0.5, ...extra,
    start: (it, done) => { if (active.size) overlap++; active.add(it.id); log.push(['start', it.id, clk.now()]); plays.push([it.id, clk.now()]); clk.timer(() => { active.delete(it.id); log.push(['end', it.id, clk.now()]); done(); }, it.dur || 1500); },
    stop: (it) => { active.delete(it.id); log.push(['cut', it.id, clk.now()]); } });
  return { clk, floor, log, plays, get overlap() { return overlap; } };
}

test('giliran: Owner mengetik lalu 3 balasan datang: tidak ada yang bunyi sebelum Owner berhenti 1,2 dtk, lalu berurutan tanpa tumpang tindih', () => {
  const s = sim();
  s.floor.ownerActive();                      // Owner mulai mengetik pada t=0
  s.clk.advance(500); s.floor.ownerActive();  // terus mengetik
  s.floor.enqueue({ id: 'A' }); s.clk.advance(100); s.floor.enqueue({ id: 'B' }); s.clk.advance(100); s.floor.enqueue({ id: 'C' });
  s.clk.advance(900); assert.equal(s.plays.length, 0, 'masih ditahan: Owner baru berhenti 900 ms');
  s.clk.advance(300); s.clk.advance(400);
  assert.ok(s.plays.length >= 1, 'mulai setelah Owner berhenti');
  assert.ok(s.plays[0][1] >= 500 + 1200, 'tidak sebelum 1,2 dtk setelah ketikan terakhir: ' + s.plays[0][1]);
  s.clk.advance(20000);
  assert.deepEqual(s.plays.map((p) => p[0]), ['A', 'B', 'C'], 'urutan menurut kedatangan');
  assert.equal(s.overlap, 0, 'tidak ada tumpang tindih');
  for (let i = 1; i < s.plays.length; i++) { const prevEnd = s.log.find((l) => l[0] === 'end' && l[1] === s.plays[i - 1][0])[2]; const gap = s.plays[i][1] - prevEnd; assert.ok(gap >= 200 && gap <= 600, 'jeda alami 200-600 ms: ' + gap); }
});

test('giliran: agen sedang bicara lalu Owner mengetik: dipotong halus, kalimat lama tidak diulang, balasan baru menunggu', () => {
  const s = sim();
  s.floor.enqueue({ id: 'A', dur: 30000 }); s.clk.advance(1000);
  assert.deepEqual(s.plays.map((p) => p[0]), ['A']);
  s.floor.enqueue({ id: 'old' }); s.clk.advance(9000);   // 'old' sudah usang (>8 dtk) saat Owner memotong
  s.floor.ownerActive();
  assert.ok(s.log.some((l) => l[0] === 'cut' && l[1] === 'A'), 'A dipotong');
  s.floor.enqueue({ id: 'new' }); s.clk.advance(1000);
  assert.ok(!s.plays.some((p) => p[0] === 'new'), 'balasan baru ditahan selama Owner memegang giliran');
  s.clk.advance(3000);
  assert.ok(s.plays.some((p) => p[0] === 'new'), 'balasan baru dibunyikan setelah Owner berhenti');
  assert.ok(!s.plays.some((p) => p[0] === 'old'), 'kalimat usang dibuang, bukan diulang');
  assert.equal(s.plays.filter((p) => p[0] === 'A').length, 1, 'A tidak diulang');
  assert.equal(s.overlap, 0);
});

test('giliran: balasan yang tertunda lebih dari 20 detik dibuang suaranya; antrean dibatasi', () => {
  const dropped = []; const s = sim({ onDrop: (it) => dropped.push(it.id) });
  s.floor.ownerActive(30000);
  s.floor.enqueue({ id: 'late' }); s.clk.advance(25000); s.clk.advance(6000);
  assert.ok(!s.plays.some((p) => p[0] === 'late') && dropped.includes('late'), 'terlalu lama: suara dibuang');
  for (const id of ['a', 'b', 'c', 'd', 'e']) s.floor.enqueue({ id, dur: 100 });
  s.clk.advance(60000);
  assert.ok(s.plays.length <= 4 && dropped.includes('b'), 'antrean dibatasi: ' + s.plays.length);
  assert.equal(s.overlap, 0);
});

test('giliran: ocehan latar (ambient) hanya saat lantai kosong; manual (tombol dengar) tidak ditahan', () => {
  const s = sim();
  assert.ok(s.floor.idle());
  s.floor.ownerActive(); assert.ok(!s.floor.idle(), 'Owner memegang giliran: ocehan harus diam');
  s.clk.advance(1300); assert.ok(s.floor.idle());
  s.floor.enqueue({ id: 'R', dur: 2000 }); assert.ok(!s.floor.idle(), 'ada yang bicara: ocehan harus diam');
  s.clk.advance(5000);
  s.floor.ownerActive(5000); s.floor.enqueue({ id: 'klik', manual: true }); s.clk.advance(50);
  assert.ok(s.plays.some((p) => p[0] === 'klik'), 'permintaan manual langsung dibunyikan');
});

test('suara mengikuti gender yang dipilih di Agent Studio (voiceGender), pria dan wanita jelas terpisah', async () => {
  const { voiceGenderOf, genderOf, profileFor, BAND } = await import('../public/js/tts.js');
  assert.equal(voiceGenderOf('Microsoft David - English (United States)'), 'male');
  assert.equal(voiceGenderOf('Microsoft Zira - English (United States)'), 'female');
  assert.equal(voiceGenderOf('Microsoft Andika - Indonesian (Indonesia)'), 'male');
  assert.equal(voiceGenderOf('Microsoft Gadis Online (Natural) - Indonesian'), 'female');
  assert.equal(voiceGenderOf('Microsoft Ardi Online (Natural) - Indonesian'), 'male');
  assert.equal(voiceGenderOf('Google Bahasa Indonesia'), '', 'tanpa keterangan');
  // mengganti dropdown mengubah suara: nama cewek dengan voiceGender cowok -> profil cowok (nada rendah, suara Ardi)
  const e = { id: 'dewi', name: 'Dewi' };
  assert.equal(genderOf(e), 'female');
  const pf = profileFor('dewi', genderOf({ ...e, voiceGender: 'female' }), 1), pm = profileFor('dewi', genderOf({ ...e, voiceGender: 'male' }), 1);
  assert.equal(pm.gender, 'male'); assert.equal(pm.eVoice, 'id-ID-ArdiNeural'); assert.equal(pf.eVoice, 'id-ID-GadisNeural');
  assert.ok(pm.pitch <= BAND.male.pitch[1] + 0.01 && pf.pitch >= BAND.female.pitch[0] - 0.01 && pf.pitch > pm.pitch + 0.1);
  // Studio dan server
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.match(fs.readFileSync(path.join(root, 'public/js/studio.js'), 'utf8'), /data-f="voiceGender"/);
  const idx = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
  assert.match(idx, /EMP_FIELDS = \[[^\]]*'voiceGender'/); assert.match(idx, /cleanVoiceGender\(pick\(b, EMP_FIELDS\)\)/);
});

test('suara pria: bila browser tidak punya suara pria Indonesia, agen cowok memakai Microsoft Ardi (bisa dimatikan)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = fs.readFileSync(path.join(root, 'public/js/tts.js'), 'utf8');
  assert.match(src, /maleViaEdge = \(p\) => !!\(S\.maleEdge && S\.engine === 'browser' && p\?\.gender === 'male' && !hasMaleIdVoice\(\) && EG\.avail === true/);
  assert.match(src, /\(S\.engine === 'edge' \|\| maleViaEdge\(it\.profile\)\)/);
  assert.match(src, /maleEdge: true/);
  assert.match(fs.readFileSync(path.join(root, 'public/js/views.js'), 'utf8'), /data-mm="1"/);
});

test('percakapan: hanya pesan baru, segar, dari percakapan yang Owner ikuti, tanpa salinan cermin dan perintah garis miring', async () => {
  const { pickSpeakable } = await import('../public/js/tts.js');
  const now = 1_000_000, me = 'owner';
  const channels = [{ id: 'dm1', kind: 'dm', members: ['owner', 'sora'] }, { id: 'g1', kind: 'channel', members: ['owner', 'dewi', 'raka', 'maya'] }, { id: 'x', kind: 'dm', members: ['dewi', 'raka'] }, { id: 'mtg', kind: 'meeting', members: ['owner', 'bima', 'laras'] }, { id: 'general', kind: 'channel' }];
  const msgs = [
    { id: '1', channelId: 'dm1', authorId: 'owner', text: 'Halo Sora', t: now - 1000 },
    { id: '2', channelId: 'dm1', authorId: 'sora', text: 'Halo Owner, saya siap.', t: now - 500 },
    { id: '3', channelId: 'x', authorId: 'dewi', text: 'obrolan antar agen', t: now - 500 },
    { id: '4', channelId: 'g1', authorId: 'dewi', text: 'Saya setuju.', t: now - 400 },
    { id: '5', channelId: 'g1', authorId: 'raka', text: 'Saya juga.', t: now - 300 },
    { id: '6', channelId: 'dm1', authorId: 'sora', text: 'lama sekali', t: now - 60000 },
    { id: '7', channelId: 'mtg', authorId: 'bima', text: 'Usul saya begini.', t: now - 200 },
    { id: '8', channelId: 'g1', authorId: 'bima', text: 'salinan cermin', t: now - 200, mirrored: true },
    { id: '9', channelId: 'dm1', authorId: 'owner', text: '/rapat tentang promo', t: now - 100 },
    { id: '10', channelId: 'general', authorId: 'pa-owner', text: 'Dicatat, Owner.', t: now - 50 },
  ];
  const seen = new Set(), out = pickSpeakable(msgs, channels, me, seen, now);
  assert.deepEqual(out.map((m) => m.id), ['1', '2', '4', '5', '7', '10'], '#general tanpa daftar anggota terbuka untuk semua');
  assert.equal(out[0].owner, true); assert.equal(out[1].owner, false);
  assert.deepEqual(out[2].group.sort(), ['dewi', 'maya', 'raka'], 'grup untuk membedakan suara tiap anggota');
  assert.deepEqual(pickSpeakable(msgs, channels, me, seen, now), [], 'pesan yang sama tidak dibacakan dua kali');
});

test('giliran: baris Owner sendiri maju ke depan dan tidak ditahan, balasan agen menyusul', () => {
  const s = sim();
  s.floor.ownerActive();                                 // Owner baru selesai mengetik
  s.floor.enqueue({ id: 'balasan1' }); s.floor.enqueue({ id: 'balasan2' });
  s.floor.enqueue({ id: 'owner', manual: true }, { front: true });
  s.clk.advance(50); assert.deepEqual(s.plays.map((p) => p[0]), ['owner'], 'Owner didengar dulu, langsung');
  s.clk.advance(20000);
  assert.deepEqual(s.plays.map((p) => p[0]), ['owner', 'balasan1', 'balasan2']);
  assert.equal(s.overlap, 0);
});
