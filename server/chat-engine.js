// CHAT ENGINE: satu mesin obrolan untuk web, Kantor 3D, Telegram, dan Discord (semuanya lewat turn()).
// Obrolan mengalir seperti ChatGPT (streaming SSE), dengan saran lanjutan dan pilihan ganda di akhir balasan; riwayat bertahan;
// tujuan percakapan auto | agen | tim; routing otomatis ke orang yang tepat (pembicara = orang yang menjawab; asisten utama tidak tampil sebagai pendamping);
// gaya NotebookLM: sumber + kutipan terperiksa + dokumen jadi; pekerjaan hanya lewat kalimat konfirmasi (pagar di server/pemandu.js).
// Rancangan: docs/CHAT-ENGINE.md.
import * as store from './penyimpanan/store.js';
import * as brain from './pengetahuan/brain.js';
import * as engine from './engine.js';
import * as pemandu from './pemandu.js';
import * as chat from './pemandu-chat.js';
import * as router from './chat-router.js';
import { PERSONA_ARAY } from './otak/perilaku-obrolan.js';
import * as src from './chat-sources.js';
import * as stafMod from './chat-staf.js';

const db = () => store.get();
const C = () => (db().chat ||= { convs: {} });
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const emp = (id) => db().employees.find((e) => e.id === id);
const divName = (e) => db().divisions.find((d) => d.id === e?.divisionId)?.name || '';
/** pembicara; `utama` = asisten utama (UI menampilkannya tanpa nama, bukan sebagai pendamping) */
export const speakerOf = (e) => (e ? { id: e.id, nama: e.name, peran: e.title, divisi: divName(e), utama: !!(e.isPA || e.isMaster) } : null);
const pa = (userId) => pemandu.paOf(userId);
/** orang yang sedang difokus di Kantor 3D (dikirim klien sebagai args.fokus); hanya pembantu AI biasa, bukan asisten utama */
const fokusOf = (id) => { const e = id ? emp(String(id)) : null; return e && e.type === 'ai' && !e.isPA && !e.isMaster && e.status !== 'offline' ? e : null; };
const o = (id, label, recommended) => ({ id, label, ...(recommended ? { recommended: true } : {}) });
const world = () => ({ employees: db().employees, divisions: db().divisions });

// ───────────────────────── riwayat percakapan ─────────────────────────
const MAX_MSGS = 300;
function getConv(userId, id, source = 'web') {
  const ok = /^[\w-]{6,48}$/.test(id || '');
  const cid = ok ? id : store.uid('c');
  const all = C().convs;
  let c = all[cid];
  if (c && c.userId !== userId) throw Object.assign(new Error('Percakapan tidak ditemukan'), { code: 404 });
  if (!c) {
    c = all[cid] = { id: cid, userId, title: 'Percakapan baru', titleAuto: true, goal: 'auto', agents: [], source, status: 'aktif', createdAt: Date.now(), updatedAt: Date.now(), msgs: [], sugg: [], pending: null, sources: [], docs: [], docMode: null };
    const keys = Object.keys(all).filter((k) => all[k].userId === userId);
    if (keys.length > 200) for (const old of keys.sort((a, b) => all[a].updatedAt - all[b].updatedAt).slice(0, keys.length - 200)) delete all[old];
  }
  c.sources ||= []; c.docs ||= [];
  return c;
}
const find = (userId, id) => { const c = C().convs[id]; if (!c || c.userId !== userId) throw Object.assign(new Error('Percakapan tidak ditemukan'), { code: 404 }); c.sources ||= []; c.docs ||= []; return c; };
const POLITE = /^(?:tolong|coba|bisa|bisakah|mohon|dong|hai|halo|hi|hey|eh|oke|ok)\b[\s,.!]*/i;
export function titleFrom(text) {
  let t = String(text).trim(); for (let i = 0; i < 3; i++) t = t.replace(POLITE, '');
  t = t.split(/[.!?\n]/)[0].trim();
  return t.length >= 6 ? t.charAt(0).toUpperCase() + clip(t, 48).slice(1) : '';
}
function addMsg(conv, m) {
  const msg = { id: store.uid('m'), t: Date.now(), ...m };
  conv.msgs.push(msg); if (conv.msgs.length > MAX_MSGS) conv.msgs.splice(0, conv.msgs.length - MAX_MSGS);
  conv.updatedAt = msg.t;
  if (m.role === 'user' && conv.titleAuto && conv.title === 'Percakapan baru' && !chat.SAPAAN.test(m.text) && !chat.TERIMA.test(m.text)) { const t = titleFrom(m.text); if (t) conv.title = t; }
  return msg;
}
const view = (c) => ({
  id: c.id, judul: c.title, ...(c.kontak ? { kontak: c.kontak } : {}), tujuan: c.goal, status: c.status, sumber: c.source, waktu: c.updatedAt, dibuat: c.createdAt,
  peserta: c.agents.map((id) => speakerOf(emp(id))).filter(Boolean), terakhir: clip(c.msgs.at(-1)?.text, 90), jumlahSumber: (c.sources || []).length,
});
export function list(userId, { q = '', status = 'aktif' } = {}) {
  const needle = router.norm(q);
  return Object.values(C().convs).filter((c) => c.userId === userId && !c.kontak && (status === 'semua' || c.status === status)   // percakapan khusus kontak hidup di halaman Pesan
    && (!needle || router.norm(c.title).includes(needle) || c.msgs.some((m) => router.norm(m.text).includes(needle))))
    .sort((a, b) => b.updatedAt - a.updatedAt).map(view);
}

// ───────────────────────── membicarakan sebagai orang tertentu ─────────────────────────
const personaOf = (e) => e.isMaster ? PERSONA_ARAY(e.name) : `Kamu ${e.name},${e.title} di divisi ${divName(e)}. ${clip(e.persona || e.about || '', 260)} Keahlianmu: ${(e.skills || []).slice(0, 5).join(', ') || 'umum'}. Jawab sebagai ${e.name} dari sudut pandang perananmu; jangan mengaku sebagai orang lain. Bila ditanya soal dirimu (bisa apa, ahli apa, siapa), jawab dari peran dan keahlian di atas saja, natural dan singkat. Kamu tidak bisa membuat pekerjaan sendiri: bila pengguna butuh hasil jadi, katakan bahwa asisten utama bisa menjadikannya pekerjaan setelah pengguna setuju (isi kerja: true).`;
const paPersona = (e) => `${PERSONA_ARAY(e.name)} Kamu juga moderator saat beberapa orang berdiskusi.`;
const transcript = (conv, text, instruct = '') => {
  const lines = conv.msgs.slice(-10).map((m) => `${m.role === 'user' ? 'Pengguna' : m.speaker?.nama || 'Asisten'}: ${clip(m.text, 400)}`);
  return `${lines.length ? `Percakapan sejauh ini:\n${lines.join('\n')}\n\n` : ''}Pesan terbaru dari pengguna: ${text}${instruct ? `\n\n${instruct}` : ''}`;
};
const DOC_WORDS = [[/\bnotulen(si)?\b/i, 'notulensi'], [/\b(ringkasan|rangkuman)\b/i, 'ringkasan'], [/panduan belajar|study guide/i, 'panduan'], [/\bfaq\b|tanya jawab/i, 'faq'], [/\bbriefing\b/i, 'briefing'], [/\brencana\b/i, 'rencana'], [/\bemail\b|\bsurel\b/i, 'email'], [/\btabel\b/i, 'tabel']];
const docTypeFrom = (t) => DOC_WORDS.find(([re]) => re.test(t))?.[1] || null;
const srcBlock = (conv, text) => src.block(conv.sources, text);
/** kompaksi otomatis: percakapan panjang diringkas (bagian lama saja) supaya konteks tetap muat dan murah; 10 pesan terakhir tetap utuh */
const AMBANG_RINGKAS = 24, SISA_UTUH = 10;
async function compact(conv) {
  const batas = conv.msgs.length - SISA_UTUH;
  if (conv.msgs.length < AMBANG_RINGKAS || batas - (conv.ringkasUntil || 0) < 8) return;
  const baris = conv.msgs.slice(conv.ringkasUntil || 0, batas).map((m) => `${m.role === 'user' ? 'Pengguna' : m.speaker?.nama || 'Asisten'}: ${clip(m.text, 500)}`);
  try { conv.ringkasan = await chat.ringkasPercakapan({ lama: conv.ringkasan || '', baris }); conv.ringkasUntil = batas; pemandu.setRingkasan(conv.userId, conv.id, conv.ringkasan); store.save(); }
  catch (err) { console.warn('[obrolan] kompaksi gagal:', err.message); }
}
/** pertanyaan tentang diri orang yang diajak bicara ("kamu ahli apa", "kmu bisa apa", "siapa kamu", termasuk salah ketik) */
export const TANYA_DIRI = /\b(siapa (kamu|kmu|anda)|(kamu|kmu|km|anda)\s+\w{2,9}\s+apa|bisa apa|ahli apa|spesialis|keahlian|bidangmu|tugasmu|pengalaman(mu)?|perkenal|jam (berapa )?(kerja|mulai)|mulai kerja|umurmu|usiamu|sudah berapa lama|berapa (klien|proyek)|lama (kerja|bekerja))/i;
const profilDiriOf = (e) => (e && !e.isMaster ? `${e.title}${(e.skills || []).length ? `; keahlian: ${e.skills.slice(0, 5).join(', ')}` : ''}` : '');
async function speak(conv, e, text, userId, instruct = '', { persona, hooks = {} } = {}) {
  await compact(conv);
  const diri = TANYA_DIRI.test(text);
  if (diri) instruct = `${instruct ? instruct + ' ' : ''}Pengguna bertanya tentang dirimu (kata yang tampak salah ketik tafsirkan paling masuk akal, misalnya "algi" = "ahli"). Jawab langsung dalam 2 sampai 3 kalimat natural: perkenalkan perananmu dan keahlian dari profilmu saja (${profilDiriOf(e) || 'peranmu'}). Jangan bertanya balik tentang kata yang tidak jelas, jangan memberi menu, dan jangan menyebut pengalaman, lama bekerja, jam kerja, atau angka yang tidak ada di profil. Bila yang ditanyakan (jam kerja, pengalaman, umur, jumlah klien) tidak ada di profilmu, katakan terus terang profilmu belum memuatnya lalu sebut apa yang bisa kamu bantu.`;
  return chat.reply({ history: [{ role: 'user', content: transcript(conv, text, instruct) }], profile: pemandu.profileText(userId), profilDiri: diri ? profilDiriOf(e) : '', text, persona: persona || personaOf(e), sources: srcBlock(conv, text), summary: conv.ringkasan || '', onDelta: hooks.onDelta, onTool: hooks.onTool });
}
function saveSugg(conv, labels) { conv.sugg = labels.slice(0, 4); return conv.sugg.map((l, i) => o(`ces:${i}`, l)); }
const item = (e, say, extra = {}) => ({ speaker: speakerOf(e), say, ...extra });
const aksiFor = (conv, thread) => (conv.sources.length || thread.some((m) => m.say.length > 350) ? src.GEN_ACTIONS : []);
const verified = (conv, cites) => src.verify(conv.sources, cites || []);
function respond(conv, thread, extra = {}) {
  const last = thread.at(-1);
  const named = (m) => m.speaker && !m.speaker.utama;
  const multi = thread.length > 1 || named(last);
  const say = thread.length > 1 ? thread.map((m) => (named(m) ? `${m.speaker.nama} (${m.speaker.peran}): ${m.say}` : m.say)).join('\n\n') : last.say;
  const kutipan = verified(conv, thread.flatMap((m) => m.kutipan || []));
  return {
    sessionId: conv.id, convId: conv.id, judul: conv.title, kind: 'chat', say, speaker: last.speaker, thread: thread.map((m) => ({ speaker: m.speaker, say: m.say, ...(m.tools?.length ? { tools: m.tools } : {}) })),
    options: last.options || [], delegate: false, freeText: true, undo: false, step: { now: 1, of: 4 }, quota: pemandu.quota(),
    dilibatkan: [...new Set(thread.map((m) => m.speaker?.id).filter((id) => id && !emp(id)?.isPA && !emp(id)?.isMaster))],
    disarankan: recommended(conv.userId, conv.id).map((p) => p.id), aksi: aksiFor(conv, thread), jumlahSumber: conv.sources.length,
    ...(kutipan.length ? { kutipan } : {}), ...(last.pilihanGanda ? { pilihanGanda: true } : {}),
    ...(thread.some((m) => m.tools?.length) ? { tools: thread.flatMap((m) => m.tools || []) } : {}), ...extra, multi,
  };
}
function log(conv, thread) { for (const m of thread) { addMsg(conv, { role: 'agent', speaker: m.speaker, text: m.say, kind: 'chat' }); pemandu.remember(conv.userId, conv.id, 'assistant', `${m.speaker && !m.speaker.utama ? m.speaker.nama + ': ' : ''}${m.say}`); } store.save(); }
const names = (ids) => ids.map((id) => emp(id)).filter(Boolean).map((e) => `${e.name} (${divName(e) || e.title})`);
const join = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} dan ${a.at(-1)}`);

// ───────────────────────── satu giliran ─────────────────────────
const offlineSay = (who) => `Otak AI-ku sedang belum tersambung, jadi aku belum bisa menghadirkan ${who} berbicara sekarang. Kalau mau, aku bisa menjadikannya pekerjaan setelah kamu setuju.`;

/** konteks aliran: emit(peristiwa) bila klien meminta streaming */
const mkHooks = (ctx, e) => {
  let started = false;
  const mulai = () => { if (!started && ctx.emit) { started = true; ctx.emit({ jenis: 'mulai', speaker: speakerOf(e) }); } };
  return { onDelta: ctx.emit ? (d) => { mulai(); ctx.emit({ jenis: 'delta', speaker: speakerOf(e), teks: d }); } : null, onTool: ctx.emit ? (t) => ctx.emit({ jenis: 'alat', alat: t }) : null, mulai };
};

/** pesan asisten utama sendiri (tanpa model tambahan): konfirmasi, penjelasan, pertanyaan pilihan */
function soraSays(conv, text, options = [], extra = {}) {
  const thread = [item(pa(conv.userId), text, { options })];
  log(conv, thread);
  return respond(conv, thread, extra);
}

async function involve(conv, args, ctx, text, plan) {
  const { userId } = args; const p = pa(userId);
  pemandu.remember(userId, conv.id, 'user', text);
  // penugasan balik otomatis: yang sedang tidak aktif diganti rekan sedivisi
  const ids = []; const notes = [...(plan.notes || [])];
  for (const id of plan.agents) {
    const e = emp(id); if (!e) continue;
    if (e.status === 'offline') {
      const alt = db().employees.find((x) => x.type === 'ai' && x.divisionId === e.divisionId && x.id !== e.id && x.status !== 'offline' && !x.isPA && !x.isMaster && !plan.agents.includes(x.id));
      if (alt) { ids.push(alt.id); notes.push(`${e.name} sedang tidak aktif, jadi aku minta ${alt.name}.`); }
      continue;
    }
    ids.push(id);
  }
  if (!ids.length) return finishInner(conv, args, ctx, text);
  conv.agents = [...new Set([...conv.agents, ...ids])].slice(-4);
  if (!chat.live()) return soraSays(conv, `${notes.join(' ')} ${offlineSay(join(names(ids)))}`.trim());
  const thread = [];
  if (plan.delegasi) {   // aray memilihkan orang berdasarkan topik: satu kalimat singkat, lalu orangnya menjawab dengan nama dan perannya sendiri
    const br = item(p, `Saya minta ${join(ids.map((x) => String(emp(x)?.name || x).split(' ')[0]))}.`); thread.push(br);
    if (ctx.emit) { const h0 = mkHooks(ctx, p); h0.mulai(); ctx.emit({ jenis: 'delta', speaker: speakerOf(p), teks: br.say }); }
  }
  const prior = [];
  const rapat = plan.meeting && ids.length >= 2;
  for (const id of ids) {
    const e = emp(id); const hooks = mkHooks(ctx, e);
    try {
      const out = await speak(conv, e, text, userId, rapat ? `Ini rapat singkat. Beri pendapat singkat (2 sampai 3 kalimat) dari sudut pandang perananmu.${prior.length ? ` Pendapat sebelumnya:\n${prior.join('\n')}` : ''}` : prior.length ? `Rekan yang sudah menjawab:\n${prior.join('\n')}\nTambahkan hanya bila ada hal baru dari perananmu.` : '', { hooks });
      hooks.mulai();
      thread.push(item(e, out.balasan, { tools: out.tools, kerja: out.kerja, saran: out.saran, kutipan: out.kutipan, pilihanGanda: out.pilihan }));
      prior.push(`${e.name}: ${clip(out.balasan, 300)}`);
    } catch (err) {
      console.warn('[chat] orang itu gagal menjawab, dialihkan ke asisten utama:', err.message);
      const h2 = mkHooks(ctx, p);
      try { const o2 = await speak(conv, p, text, userId, `${e.name} sedang tidak bisa menjawab; jawab sebisamu dan katakan itu singkat di awal.`, { persona: paPersona(p), hooks: h2 }); h2.mulai(); thread.push(item(p, o2.balasan, { tools: o2.tools, saran: o2.saran, kutipan: o2.kutipan, pilihanGanda: o2.pilihan })); } catch { thread.push(item(p, `${e.name} sedang tidak bisa menjawab. Coba lagi sebentar ya.`)); }
    }
  }
  if (rapat && prior.length >= 2) {   // moderator merangkum keputusan dan tindak lanjut
    const h3 = mkHooks(ctx, p);
    try {
      const sum = await speak(conv, p, text, userId, `Sebagai moderator, rangkum rapat singkat ini dalam 3 sampai 5 kalimat: keputusan yang tampak dan tindak lanjutnya. Pendapat:\n${prior.join('\n')}`, { persona: paPersona(p), hooks: { ...h3, onDelta: null } });
      const say = `**Ringkasan rapat**\n${sum.balasan}`;
      if (ctx.emit) { h3.mulai(); ctx.emit({ jenis: 'delta', speaker: speakerOf(p), teks: say }); }
      thread.push(item(p, say, { options: saveSugg(conv, ['Buat notulensi', 'Buatkan rencana tindak lanjut']) }));
    } catch { /* tanpa ringkasan bila model gagal */ }
  } else { const last = thread.at(-1); last.options = saveSugg(conv, last.saran || []); }
  // pagar: orang lain tidak membuat pekerjaan; bila ada yang menandai butuh hasil jadi, asisten utama mengusulkan lewat kalimat konfirmasi
  const needsWork = thread.some((m) => m.kerja) && !chat.isQuestion(text);
  log(conv, thread);
  const r = respond(conv, thread, notes.length ? { notes } : {});
  if (needsWork) {
    const confirm = await pemandu.proposeFor(userId, conv.id, text);
    if (confirm) { addMsg(conv, { role: 'agent', speaker: speakerOf(p), text: confirm.say, kind: 'confirm' }); return { ...confirm, speaker: speakerOf(p), convId: conv.id, thread: r.thread, preface: r.say }; }
  }
  return r;
}

/** jawaban asisten utama lewat mesin kerja (obrolan, usulan kerja, konfirmasi) */
async function finishInner(conv, args, ctx, text) {
  const hooks = mkHooks(ctx, pa(args.userId));
  const resp = await pemandu.innerTurn({ ...args, sessionId: conv.id, ...(text ? { input: text } : {}), onDelta: hooks.onDelta, onTool: hooks.onTool, sources: text ? srcBlock(conv, text) : '' });
  if (resp.kind !== 'chat' && resp.say) hooks.mulai();   // jenis lain (konfirmasi, kemajuan) tidak mengalir; isinya tiba lewat peristiwa "selesai"
  return decorate(conv, args, resp);
}
function decorate(conv, args, resp) {
  const p = pa(args.userId);
  const out = { ...resp, sessionId: conv.id, convId: conv.id, judul: conv.title, speaker: speakerOf(p) };
  if (resp.kutipanMentah) { const k = verified(conv, resp.kutipanMentah); delete out.kutipanMentah; if (k.length) out.kutipan = k; }
  if (out.kind === 'chat') { out.aksi = aksiFor(conv, [{ say: out.say || '' }]); out.jumlahSumber = conv.sources.length; }
  const polling = args.choiceId === 'poll' && resp.kind === 'progress';
  if (!polling && resp.say) { addMsg(conv, { role: 'agent', speaker: out.speaker, text: resp.say, kind: resp.kind }); store.save(); }
  return out;
}

/** kendali percakapan dengan bahasa biasa: "cukup Sora saja", "ajak yang paham pajak" */
async function control(conv, args, text) {
  const t = router.norm(text);
  if (/\b(cukup (?:sora|aray|aku|kita) saja|(?:sora|aray) saja|tanpa (?:tim|agen|yang lain)|lepas semua|berdua saja)\b/.test(t) || /^cukup (?:sora|aray|kamu)\b/.test(t)) {
    conv.agents = []; conv.goal = 'auto';
    return soraSays(conv, 'Baik, kita ngobrol berdua saja.');
  }
  if (/\b(ajak|libatkan|tambahkan|undang|panggil)\b/.test(t) && !router.MEETING_RE.test(t) && !chat.wantsWork(text)) {
    const plan = router.route(text, world());
    if (plan.kind === 'agents' && plan.agents.length) {
      conv.agents = [...new Set([...conv.agents, ...plan.agents])].slice(-4);
      return soraSays(conv, `Siap, aku ajak ${join(names(plan.agents))} ke percakapan ini. Silakan lanjut bertanya.`);
    }
    if (plan.kind === 'ambiguous') return ask(conv, text, plan);
  }
  return null;
}
function ask(conv, text, plan) {
  conv.pending = { text, agents: plan.agents, meeting: plan.meeting };
  const opts = [...plan.options.slice(0, 3).map((x) => o(`pilih:${x.id}`, x.label)), o('pilih:aray', 'aray saja')].slice(0, 4);
  return soraSays(conv, 'Maksudmu yang mana?', opts, { pilihanGanda: true });
}
async function resolvePending(conv, args, ctx, pick) {
  const pend = conv.pending; conv.pending = null;
  if (!pend || pick === 'sora' || pick === 'aray') { conv.agents = pick === 'sora' || pick === 'aray' ? [] : conv.agents; return pend ? finishInner(conv, args, ctx, pend.text) : soraSays(conv, 'Baik.'); }
  if (!emp(pick)) return soraSays(conv, 'Orang itu tidak ditemukan. Coba sebut lagi dengan kata lain.');
  return involve(conv, args, ctx, pend.text, { kind: 'agents', agents: [...new Set([...(pend.agents || []), pick])], meeting: pend.meeting });
}

// ───────────────────────── dokumen jadi ─────────────────────────
function material(conv) {
  const s = src.block(conv.sources, conv.msgs.filter((m) => m.role === 'user').slice(-3).map((m) => m.text).join(' '), 20000);
  const talk = conv.msgs.slice(-12).map((m) => `${m.role === 'user' ? 'Pengguna' : m.speaker?.nama || 'Asisten'}: ${clip(m.text, 600)}`).join('\n');
  return `${s ? `SUMBER:\n${s}\n\n` : ''}PERCAKAPAN:\n${talk}`;
}
/** disimpan ke Hasil Saya sebagai pekerjaan selesai (tombol aksi yang ditekan pengguna sendiri adalah konfirmasinya) */
function saveResult(userId, doc) {
  const p = pa(userId);
  const t = engine.createTask({ title: doc.judul, description: 'Dibuat dari obrolan.', assigneeId: p.id, createdBy: userId, kind: 'task', priority: 'low' });
  Object.assign(t, { status: 'done', output: doc.isi, summary: clip(doc.isi, 300), completedAt: Date.now(), updatedAt: Date.now(), generated: true });
  store.upsert('tasks', t);
  return t.id;
}
const docView = (d) => ({ id: d.id, judul: d.judul, jenis: d.jenis, isi: d.isi, versi: d.versi, tersimpanDiCatatan: !!d.noteId });
async function generate(conv, args, ctx, type, instruksi = '') {
  const meta = src.DOC_TYPES[type]; const p = pa(args.userId);
  if (!meta) return soraSays(conv, 'Jenis dokumen itu belum ada.');
  if (!chat.live()) return soraSays(conv, `Otak AI-ku sedang belum tersambung, jadi aku belum bisa membuat ${meta.label.toLowerCase()} sekarang.`);
  if (conv.msgs.length < 2 && !conv.sources.length) return soraSays(conv, 'Ceritakan dulu bahannya atau tambahkan sumber, lalu aku buatkan.');
  const hooks = mkHooks(ctx, p);
  const isi = await chat.writeDoc({ system: src.docSystem(p.name), prompt: src.docPrompt(type, material(conv), instruksi), onDelta: hooks.onDelta });
  hooks.mulai?.();
  const doc = { id: store.uid('d'), judul: `${meta.label}: ${conv.title === 'Percakapan baru' ? 'dari obrolan' : conv.title}`, jenis: type, isi, versi: 1, noteId: null, t: Date.now() };
  doc.taskId = saveResult(args.userId, doc);
  conv.docs.push(doc); if (conv.docs.length > src.LIMIT.doc) conv.docs.shift();
  conv.docMode = doc.id;
  return docResponse(conv, doc, `Ini ${meta.label.toLowerCase()}-nya. Sudah masuk Hasil Saya. Mau diubah atau disimpan ke Catatan?`);
}
function docResponse(conv, doc, say) {
  const p = pa(conv.userId);
  const options = [o(`doc:simpan:${doc.id}`, 'Simpan ke Catatan', true), ...(doc.jenis === 'notulensi' ? [o(`doc:tugas:${doc.id}`, 'Jadikan tugas')] : []), ...saveSugg(conv, ['Buat lebih singkat', 'Tambah contoh', 'Ubah jadi tabel']).slice(0, 3)];
  const thread = [item(p, say, { options })];
  addMsg(conv, { role: 'agent', speaker: speakerOf(p), text: say, kind: 'dokumen', dokumenId: doc.id });
  store.save();
  return respond(conv, thread, { dokumen: docView(doc), aksi: [] });
}
async function reviseDoc(conv, args, ctx, doc, instruksi) {
  const p = pa(args.userId); const hooks = mkHooks(ctx, p);
  doc.isi = await chat.writeDoc({ system: src.docSystem(p.name), prompt: src.revisePrompt(doc.isi, instruksi), onDelta: hooks.onDelta });
  hooks.mulai?.();
  doc.versi += 1; doc.t = Date.now();
  const t = db().tasks.find((x) => x.id === doc.taskId); if (t) { Object.assign(t, { output: doc.isi, summary: clip(doc.isi, 300), updatedAt: Date.now() }); store.upsert('tasks', t); }
  return docResponse(conv, doc, `Sudah kuubah (versi ${doc.versi}). Mau diubah lagi atau disimpan?`);
}
/**
 * LAPORAN agen -> aray -> pemilik. Tidak ada data ganda: kartu laporan diturunkan dari pekerjaan yang selesai di ruang kerja (db().tasks);
 * hanya tanda "sudah dibaca" yang disimpan (db().chat.laporanDibaca[userId]). Pekerjaan hasil pecahan aray (punya sub-tugas) dilaporkan aray dengan daftar
 * agen sumber yang bisa ditelusuri; pekerjaan satu orang dilaporkan orang itu lewat aray. Saat pemilik bicara langsung dengan agen, agen menjawab langsung (bukan lewat laporan).
 */
export function laporan(userId, { batas = 20 } = {}) {
  const aray = pa(userId); const dibaca = new Set((C().laporanDibaca ||= {})[userId] || []);
  const selesai = db().tasks.filter((t) => t.status === 'done' && !t.parentId && t.kind !== 'chat' && !t.generated && (t.summary || t.output))
    .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0)).slice(0, batas);
  const kartu = selesai.map((t) => {
    const anak = db().tasks.filter((x) => (x.rootId === t.id || x.parentId === t.id) && x.id !== t.id && x.status === 'done');
    const sumber = [...new Map(anak.map((x) => emp(x.assigneeId)).filter((e) => e && e.type === 'ai' && !e.isPA && !e.isMaster).map((e) => [e.id, speakerOf(e)])).values()];
    const pemilik = emp(t.assigneeId); const langsung = pemilik && !pemilik.isPA && !pemilik.isMaster;
    return { id: t.id, judul: clip(t.title, 90), ringkas: clip(t.summary || t.output, 220), dari: speakerOf(langsung ? pemilik : aray), lewat: speakerOf(aray), sumberAgen: langsung ? [speakerOf(pemilik)] : sumber, waktu: t.completedAt || t.updatedAt || t.createdAt || 0, tugasId: t.id, dibaca: dibaca.has(t.id) };
  });
  return { lewat: speakerOf(aray), laporan: kartu, belumDibaca: kartu.filter((k) => !k.dibaca).length };
}
export function laporanBaca(userId, id) {
  const l = ((C().laporanDibaca ||= {})[userId] ||= []);
  if (id === 'semua') for (const k of laporan(userId).laporan) { if (!l.includes(k.id)) l.push(k.id); } else if (db().tasks.some((t) => t.id === id) && !l.includes(id)) l.push(id);
  if (l.length > 300) l.splice(0, l.length - 300);
  store.save(); return { ok: true, belumDibaca: laporan(userId).belumDibaca };
}
/** fakta nyata untuk ringkasan aray: dihitung dari data ruang kerja, bukan dikarang model */
export function faktaAray() {
  const d = db(); const tujuh = Date.now() - 7 * 86400000;
  const akar = d.tasks.filter((t) => t.kind === 'goal' || (!t.parentId && t.kind !== 'chat'));
  const selesai = akar.filter((t) => t.status === 'done' && (t.completedAt || t.updatedAt || 0) >= tujuh);
  const jalan = akar.filter((t) => ['in_progress', 'running', 'working', 'todo', 'pending', 'queued'].includes(t.status));
  const tertahan = d.tasks.filter((t) => t.status === 'blocked');
  const menunggu = d.approvals.filter((a) => a.status === 'pending');
  const kerja = d.employees.filter((e) => e.type === 'ai' && (e.status === 'working' || e.status === 'meeting')).length;
  const u = d.usage || {};
  return {
    selesaiMingguIni: selesai.length, berjalan: jalan.length, tertahan: tertahan.length, menungguKeputusan: menunggu.length, orangBekerja: kerja,
    contohSelesai: selesai.slice(0, 5).map((t) => clip(t.title, 70)), contohBerjalan: jalan.slice(0, 5).map((t) => clip(t.title, 70)), contohTertahan: tertahan.slice(0, 3).map((t) => clip(t.title, 70)),
    biayaHariIniUSD: Math.round((u.costToday || 0) * 10000) / 10000, anggaranHarianUSD: d.settings?.dailyBudgetUSD ?? null,
  };
}
// persona aray: satu sumber di otak/perilaku-obrolan.js (PERSONA_ARAY)
const RINGKAS_ARAY = /(ringkasan|rekap|laporan|kabar|perkembangan|progres|kemajuan|status)/i;
const SEBUT_ARAY = /@?\baray\b/gi;
const SEBUT_ARAY_UJI = /(^|\s)@?aray\b/i;   // "aray" selalu dikenali sebagai sebutan koordinator, apa pun nama tampilan di data ruang kerja
/** @aray: (1) minta ringkasan -> ringkasan dari data nyata; (2) selain itu -> usulan koordinasi lintas divisi yang berhenti di kartu konfirmasi */
const KOORDINASI = /\b(koordinasi\w*|kerjakan|buat\w*|susun\w*|siapkan|luncur\w*|rencana\w*|atur|delegasi\w*|tolong)\b/i;
async function koordinasiAray(conv, args, ctx, text, aray) {
  const { userId } = args; const sisa = clip(text.replace(SEBUT_ARAY, ' ').replace(/\s+/g, ' '), 600) || 'koordinasikan tujuan ini';
  conv.agents = [...new Set([...conv.agents, aray.id])].slice(-4);
  if (!RINGKAS_ARAY.test(sisa) && !KOORDINASI.test(sisa) && !chat.wantsWork(sisa)) return await involve(conv, args, ctx, text, { kind: 'agents', agents: [aray.id], meeting: false });   // sapaan atau pertanyaan biasa ke aray: ia menjawab sendiri
  if (RINGKAS_ARAY.test(sisa) && !chat.wantsWork(sisa)) {
    if (!chat.live()) return soraSays(conv, 'Otak AI-ku sedang belum tersambung, jadi ringkasannya belum bisa kususun. Datanya sendiri bisa kamu lihat di Hasil Saya.');
    const hooks = mkHooks(ctx, aray); const fakta = faktaAray();
    const bahan = `${sisa}\n\nFAKTA RUANG KERJA (satu-satunya bahan, jangan menambah angka):\n${JSON.stringify(fakta)}\n\nTulis ringkasan singkat untuk pemilik: yang selesai, yang berjalan, yang tertahan atau menunggu keputusannya, dan satu hal yang perlu diperhatikan. Bila datanya kosong, katakan apa adanya.`;
    const out = await chat.reply({ history: [{ role: 'user', content: bahan }], profile: pemandu.profileText(userId), text, persona: PERSONA_ARAY(aray.name), sources: '', onDelta: hooks.onDelta, onTool: hooks.onTool });
    hooks.mulai?.();
    const thread = [item(aray, out.balasan, { tools: out.tools, saran: out.saran })];
    log(conv, thread);
    return respond(conv, thread, { options: saveSugg(conv, ['Buat notulensi', 'Minta aray mengoordinasi tindak lanjut']), dilibatkan: conv.agents });
  }
  // koordinasi: usulan kerja lewat kartu konfirmasi (pekerjaan baru tercipta hanya setelah "Ya, kerjakan"); goal dipecah aray sebagai koordinator
  const resp = await pemandu.usulKerja(userId, conv.id, `Koordinasikan lintas divisi: ${sisa}`);
  const out = decorate(conv, args, resp);
  out.notes = [...(out.notes || []), 'Aray, koordinator lintas divisi, akan memecah ini menjadi tugas dan menunjuk penanggung jawab setelah kamu setuju.'];
  return out;
}
/** "Jadikan tugas" dari notulensi: hanya usulan; pekerjaan tercipta setelah konfirmasi */
async function notulensiJadiTugas(conv, args, docId) {
  const doc = conv.docs.find((d) => d.id === docId); if (!doc) return soraSays(conv, 'Notulensi itu tidak ditemukan.');
  const bagian = /tugas lanjutan[:*\s]*([\s\S]*)$/i.exec(doc.isi)?.[1] || doc.isi;
  const resp = await pemandu.usulKerja(args.userId, conv.id, `Kerjakan tugas lanjutan dari notulensi: ${clip(bagian, 500)}`);
  return decorate(conv, args, resp);
}
function saveDocNote(conv, args, docId) {
  const doc = conv.docs.find((d) => d.id === docId);
  if (!doc) return soraSays(conv, 'Dokumen itu tidak ditemukan.');
  const n = brain.writeNote({ title: `${doc.judul}${doc.versi > 1 ? ` (v${doc.versi})` : ''}`, content: doc.isi, folder: 'Hasil', tags: ['hasil', 'obrolan'], authorId: args.userId });
  doc.noteId = n.id;
  return soraSays(conv, `Tersimpan di Catatan: ${n.title}.`, [], { dokumen: docView(doc), saved: { title: n.title } });
}

// ───────────────────────── kemampuan staf dijalankan dari obrolan ─────────────────────────
// Pagar izin: bila spesifikasi rakitan berdampak keluar, WAJIB berhenti di kartu konfirmasi; runner menolak menjalankannya tanpa confirmed=true.
const saveStaf = (conv, m, isian, tanya, periksa) => { conv.staf = { capKey: m.cap.key, personKey: m.person.key, isian, tanya, periksa: !!periksa }; };
/** periksa = isian hasil tebakan aturan murah (tanpa model): pengguna wajib memeriksa dulu walau kemampuannya tidak berdampak keluar */
async function stafLanjut(conv, args, m, isian, periksa = false) {
  const kurang = stafMod.kurang(m.cap, isian);
  if (kurang.length) {
    const q = stafMod.pertanyaan(m.cap, kurang[0]); saveStaf(conv, m, isian, kurang[0].key, periksa);
    return soraSays(conv, q.say, q.options, q.options.length ? { pilihanGanda: true } : {});
  }
  const berdampak = stafMod.berdampak(m);
  if (berdampak || periksa) {
    saveStaf(conv, m, isian, null, periksa);
    const say = berdampak ? `Aku siap menjalankan ${m.cap.name.toLowerCase()}. Ini berdampak ke luar, jadi aku tanya dulu. Lanjutkan?` : `Aku akan menjalankan ${m.cap.name.toLowerCase()} dengan isian di bawah. Sudah benar?`;
    const thread = [item(pa(args.userId), say, { options: [o('staf:ya', 'Ya, jalankan', true), o('staf:batal', 'Batal')] })];
    log(conv, thread);
    return { ...respond(conv, thread), kind: 'confirm', preview: stafMod.pratinjau(m.cap, isian) };
  }
  return stafJalan(conv, args, m, isian, false);
}
async function stafJalan(conv, args, m, isian, confirmed) {
  conv.staf = null;
  let r; try { r = await stafMod.jalankan(m, isian, { confirmed, employeeId: db().employees.find((e) => e.isMaster)?.id }); } catch (err) { r = { status: 'gagal', galat: clip(err.message, 160) }; }
  const h = stafMod.ringkasHasil(m, r, isian);
  const who = emp(m.person.employeeId) || pa(args.userId);
  const thread = [item(who, h.say, { options: saveSugg(conv, h.ok ? ['Hitung dengan angka lain', 'Jelaskan hasilnya'] : ['Coba lagi']) })];
  log(conv, thread);
  return respond(conv, thread, { hasil: { id: r.id || null, status: r.status }, kemampuan: m.cap.name });
}
async function stafPilihan(conv, args, choiceId) {
  const st = conv.staf; if (!st) return soraSays(conv, 'Permintaan itu sudah lewat. Tulis lagi apa yang mau dikerjakan.');
  const m = await stafMod.muat({ capKey: st.capKey, personKey: st.personKey, userId: args.userId });
  if (!m) { conv.staf = null; return soraSays(conv, 'Kemampuan itu belum bisa dipakai sekarang.'); }
  if (choiceId === 'staf:batal') { conv.staf = null; return soraSays(conv, 'Baik, tidak dijalankan.'); }
  if (choiceId === 'staf:ya') return stafJalan(conv, args, m, st.isian, true);   // satu-satunya jalan ke confirmed=true: tombol "Ya, jalankan" milik pengguna
  const [, , key, i] = choiceId.split(':'); const f = (m.cap.inputs || []).find((x) => x.key === key); const c = f?.choices?.[Number(i)];
  if (!c) return stafLanjut(conv, args, m, st.isian, st.periksa);
  return stafLanjut(conv, args, m, { ...st.isian, [key]: c.v }, st.periksa);
}
async function stafKetik(conv, args, text) {
  const st = conv.staf; const m = await stafMod.muat({ capKey: st.capKey, personKey: st.personKey, userId: args.userId });
  if (!m) { conv.staf = null; return null; }
  const f = (m.cap.inputs || []).find((x) => x.key === st.tanya); if (!f) { conv.staf = null; return null; }
  const nilai = f.type === 'number' ? String(stafMod.angkaDari(text)[0] ?? text) : text;
  return stafLanjut(conv, args, m, { ...st.isian, [f.key]: nilai }, st.periksa);
}

/** pintu depan: menyertakan id pesan jawaban terakhir (untuk umpan balik, salin, dan ulangi di antarmuka) */
export async function turn(args) {
  const r = await turnInti(args);
  try { const c = find(args.userId, r?.convId || args.sessionId); const m = [...c.msgs].reverse().find((x) => x.role === 'agent'); if (m && r && typeof r === 'object') r.pesanId = m.id; } catch { /* percakapan tidak ada: biarkan */ }
  return r;
}
async function turnInti(args) {
  const { userId, sessionId, choiceId = '' } = args;
  if (!userId) throw new Error('userId wajib');
  const ctx = { emit: typeof args.emit === 'function' ? args.emit : null };
  const conv = getConv(userId, sessionId, args.source || 'web');
  await compact(conv);
  conv.source = conv.source || args.source || 'web';
  let text = clip(args.input, 2000);
  try {
    if (choiceId.startsWith('ces:')) text = conv.sugg?.[Number(choiceId.slice(4))] || '';
    else if (choiceId.startsWith('pilih:')) { addMsg(conv, { role: 'user', text: ['sora', 'aray'].includes(choiceId.slice(6)) ? 'aray saja' : emp(choiceId.slice(6))?.name || 'Pilihanku' }); return await resolvePending(conv, args, ctx, choiceId.slice(6)); }
    else if (choiceId.startsWith('gen:')) { addMsg(conv, { role: 'user', text: `Buatkan ${src.DOC_TYPES[choiceId.slice(4)]?.label?.toLowerCase() || 'dokumen'}` }); return await generate(conv, args, ctx, choiceId.slice(4)); }
    else if (choiceId.startsWith('doc:simpan:')) return saveDocNote(conv, args, choiceId.slice(11));
    else if (choiceId.startsWith('doc:tugas:')) return await notulensiJadiTugas(conv, args, choiceId.slice(10));
    else if (choiceId.startsWith('staf:')) { addMsg(conv, { role: 'user', text: choiceId === 'staf:ya' ? 'Ya, jalankan' : choiceId === 'staf:batal' ? 'Batal' : 'Pilihanku' }); return await stafPilihan(conv, args, choiceId); }
    else if (choiceId) return decorate(conv, args, await pemandu.innerTurn({ ...args, sessionId: conv.id }));   // tombol alur kerja (konfirmasi, hasil, otomasi)
    if (!text) return decorate(conv, args, await pemandu.innerTurn({ ...args, sessionId: conv.id }));
    // perintah lanjutan untuk dokumen yang baru dibuat ("buat lebih singkat", "tambah contoh")
    const doc = conv.docMode && conv.docs.find((d) => d.id === conv.docMode);
    if (doc && src.REVISE_RE.test(text) && !chat.isQuestion(text)) { addMsg(conv, { role: 'user', text }); return await reviseDoc(conv, args, ctx, doc, text); }
    conv.docMode = null;
    // sedang mengisi formulir kemampuan staf: ketikan menjawab pertanyaan terakhir, kecuali pengguna bertanya lain atau membatalkan
    if (conv.staf) {
      if (conv.staf.tanya && !chat.isQuestion(text) && !/^\s*(batal|tidak usah|nggak usah|jangan)\b/i.test(text)) { addMsg(conv, { role: 'user', text }); const r = await stafKetik(conv, args, text); if (r) return r; }
      else conv.staf = null;
    }
    const stage = pemandu.stageOf(userId, conv.id);
    const plan0 = router.route(text, world());
    // di tengah usulan atau hasil: ketikan diurus alur itu, kecuali jelas menyebut orang lain
    if (stage !== 'start') {
      const byName = router.nameHits(text, db().employees.filter((e) => e.type === 'ai' && !e.isPA && !e.isMaster)).length > 0;
      if (!(byName && plan0.kind === 'agents' && ['topic', 'ask', 'confirm'].includes(stage))) { addMsg(conv, { role: 'user', text }); return decorate(conv, args, await pemandu.innerTurn({ ...args, sessionId: conv.id })); }
      pemandu.abandon(userId, conv.id);
    }
    addMsg(conv, { role: 'user', text });
    const ctl = await control(conv, args, text); if (ctl) return ctl;
    if (stage === 'start') {   // permintaan berhitung/menyusun berangka: jalankan kemampuan staf yang cocok (konfirmasi dipaksa bila berdampak)
      const m = await stafMod.cocok(text, { userId });
      if (m) { const x = await stafMod.isi(m.cap, text); return await stafLanjut(conv, args, m, x.isian, !x.dariModel); }
    }
    const dt = (conv.sources.length || /notulen/i.test(text)) ? docTypeFrom(text) : null;   // perintah ketikan untuk dokumen dari sumber ("buatkan ringkasan") sama dengan menekan tombol aksinya
    if (dt && chat.wantsWork(text)) return await generate(conv, args, ctx, dt);
    const aray = db().employees.find((e) => e.isMaster);
    if (aray && !((conv.goal !== 'auto' || conv.eksplisit === true) && conv.agents.length > 0) && (SEBUT_ARAY_UJI.test(text) || router.nameHits(text, [aray]).length)) return await koordinasiAray(conv, args, ctx, text, aray);   // @aray: koordinator lintas divisi (hanya bila disebut)
    if (chat.wantsWork(text)) return await finishInner(conv, args, ctx, text);   // kerja eksplisit: asisten utama, lewat kalimat konfirmasi
    // PRIORITAS PENERIMA: (1) tujuan eksplisit (chip peserta, kontak di Pesan) > (2) orang yang disapa/disebut namanya > (3) orang yang sedang difokus/diikuti di Kantor 3D > (4) topik/peran > (5) peserta yang sudah diajak > (6) asisten utama.
    // Sora (asisten utama) bukan tokoh default: ia menjawab hanya bila tidak ada yang cocok, atau pesannya soal mengatur/koordinasi.
    const fokus = fokusOf(args.fokus);
    const eksplisit = (conv.goal !== 'auto' || conv.eksplisit === true) && conv.agents.length > 0;
    const disebut = router.nameHits(text, db().employees.filter((e) => e.type === 'ai' && !e.isPA && !e.isMaster)).length > 0;
    if (!eksplisit && !disebut && !fokus && !conv.agents.length && (chat.SAPAAN.test(text) || chat.TERIMA.test(text) || chat.TENTANG.test(text))) return await finishInner(conv, args, ctx, text);
    let plan;
    if (eksplisit) plan = { kind: 'agents', agents: conv.agents.slice(0, conv.goal === 'agen' ? 1 : 3), meeting: router.MEETING_RE.test(router.norm(text)), sticky: true };
    else if (disebut) plan = plan0;
    else if (fokus) plan = { kind: 'agents', agents: [fokus.id], meeting: false, fokus: true };
    else plan = plan0;
    if (plan.kind === 'agents' && !eksplisit && !disebut && !fokus && !plan.sticky) plan = { ...plan, delegasi: true };   // pilihan berdasar topik = delegasi oleh aray
    if (plan.kind === 'none' && conv.agents.length && conv.goal === 'auto') plan = { kind: 'agents', agents: conv.agents.slice(0, 3), meeting: false, sticky: true };   // peserta yang sudah diajak tetap menjawab sampai pengguna berkata cukup
    if (plan.kind === 'ambiguous') return ask(conv, text, plan);
    if (plan.kind === 'siapa') {
      if (!plan.candidates?.length) return await finishInner(conv, args, ctx, text);
      conv.pending = { text, agents: [], meeting: false };
      return soraSays(conv, `Yang paling cocok untuk itu: ${join(plan.why)}. Mau kutanyakan ke salah satunya?`, [...plan.candidates.slice(0, 3).map((e, i) => o(`pilih:${e.id}`, `Tanya ${e.name}`, i === 0)), o('pilih:aray', 'aray saja')], { pilihanGanda: true });
    }
    if (plan.kind === 'agents') return await involve(conv, args, ctx, text, plan);
    return await finishInner(conv, args, ctx, text);
  } catch (err) {
    if (err.code === 404) throw err;
    console.warn('[chat] giliran gagal:', err.message);
    return { sessionId: conv.id, convId: conv.id, kind: 'error', say: 'Ada yang belum berhasil. Kamu bisa coba lagi, atau mulai percakapan baru.', options: [o('poll', 'Coba lagi', true), o('new', 'Mulai dari awal')], delegate: false, freeText: true, undo: false, step: { now: 1, of: 4 }, quota: pemandu.quota() };
  }
}

// ───────────────────────── operasi daftar percakapan ─────────────────────────
export function create(userId, { tujuan = 'auto', agen = [], judul = '', source = 'web' } = {}) {
  const c = getConv(userId, null, source);
  if (['auto', 'agen', 'tim'].includes(tujuan)) c.goal = tujuan;
  c.agents = agen.filter((id) => emp(id)?.type === 'ai').slice(0, 4);
  if (c.goal === 'agen') c.agents = c.agents.slice(0, 1);
  if (judul) { c.title = clip(judul, 80); c.titleAuto = false; }
  store.save();
  return view(c);
}
export function update(userId, id, { judul, status, tujuan, agen, eksplisit } = {}) {
  const c = find(userId, id);
  if (typeof judul === 'string' && judul.trim()) { c.title = clip(judul, 80); c.titleAuto = false; }
  if (['aktif', 'arsip'].includes(status)) c.status = status;
  if (['auto', 'agen', 'tim'].includes(tujuan)) c.goal = tujuan;   // riwayat tidak hilang; agen baru ikut membaca konteks lewat transkrip
  if (Array.isArray(agen)) c.agents = agen.filter((x) => emp(x)?.type === 'ai').slice(0, c.goal === 'agen' ? 1 : 4);
  if (typeof eksplisit === 'boolean') c.eksplisit = eksplisit && c.agents.length > 0;   // penerima yang dipilih pengguna (chip/@): mengalahkan nama, fokus, dan topik
  if (!c.agents.length) c.eksplisit = false;
  c.updatedAt = Date.now(); store.save();
  return view(c);
}
export function remove(userId, id) { const c = find(userId, id); delete C().convs[c.id]; pemandu.dropSession(userId, id); store.save(); return { ok: true }; }
export function detail(userId, id) {
  const c = find(userId, id);
  return { ...view(c), sumber: c.sources.map(src.viewSource), dokumen: c.docs.map(docView), pesan: c.msgs.slice(-100).map((m) => ({ id: m.id, waktu: m.t, peran: m.role, pembicara: m.speaker, teks: m.text, jenis: m.kind, ...(m.umpan ? { umpan: m.umpan } : {}), ...(m.dokumenId ? { dokumenId: m.dokumenId } : {}) })) };
}
/** ulangi jawaban terakhir atau ubah pesan pengguna terakhir: riwayat dimundurkan ke sebelum pesan itu, lalu dikirim lagi lewat mesin yang sama (aliran SSE) */
export function rewind(userId, id, { teks = '' } = {}) {
  const c = find(userId, id);
  let i = c.msgs.length - 1; while (i >= 0 && c.msgs[i].role !== 'user') i--;
  if (i < 0) throw Object.assign(new Error('Belum ada pesan yang bisa diulang.'), { code: 400 });
  if (c.msgs.slice(i + 1).some((m) => m.kind && m.kind !== 'chat') || c.pending || c.docMode) throw Object.assign(new Error('Pesan ini sudah memicu pekerjaan atau dokumen, jadi tidak bisa diulang. Tulis pesan baru saja.'), { code: 409 });
  const r = pemandu.rewindChat(userId, id); if (!r.ok) throw Object.assign(new Error('Sedang ada pekerjaan atau konfirmasi, jadi pesan ini tidak bisa diulang.'), { code: 409 });
  const asli = c.msgs[i].text; c.msgs.splice(i); c.updatedAt = Date.now(); store.save();
  return { teks: String(teks || '').trim() || asli };
}
/** umpan balik pada satu jawaban: 'suka' | 'kurang' | '' (hapus); disimpan di pesan itu */
export function umpan(userId, id, { pesanId, nilai = '' } = {}) {
  const c = find(userId, id); const m = c.msgs.find((x) => x.id === pesanId && x.role !== 'user');
  if (!m) throw Object.assign(new Error('Jawaban tidak ditemukan.'), { code: 404 });
  if (nilai) m.umpan = nilai === 'suka' ? 'suka' : 'kurang'; else delete m.umpan;
  store.save(); return { ok: true, umpan: m.umpan || '' };
}
export function participants(userId, id, { tambah = [], hapus = [], eksplisit } = {}) {
  const c = find(userId, id);
  c.agents = [...new Set([...c.agents.filter((x) => !hapus.includes(x)), ...tambah.filter((x) => emp(x)?.type === 'ai')])].slice(0, c.goal === 'agen' ? 1 : 4);
  if (typeof eksplisit === 'boolean') c.eksplisit = eksplisit && c.agents.length > 0;
  if (!c.agents.length) c.eksplisit = false;
  c.updatedAt = Date.now(); store.save();
  return view(c);
}
/** saran kontekstual "Disarankan": orang yang cocok dengan topik terakhir yang belum ikut */
export function recommended(userId, id) {
  const c = find(userId, id);
  const text = c.msgs.filter((m) => m.role === 'user').slice(-3).map((m) => m.text).join(' ');
  const sc = router.scoreDivisions(text, world()).slice(0, 3);
  return sc.map((x) => db().employees.find((e) => e.id === x.division.leadId)).filter((e) => e && !c.agents.includes(e.id)).map((e) => speakerOf(e));
}
export const suggest = (q) => router.suggest(q, world());
/** "kabar": notifikasi aktivitas, daftar terpisah dari percakapan */
export function news(limit = 30) {
  return (db().events || []).filter((e) => e.type !== 'message').slice(-limit * 2).reverse().slice(0, limit).map((e) => ({ id: e.id, waktu: e.t, jenis: e.type, teks: chat.rapikan(e.text) }));
}
/** tambah arahan pada pekerjaan yang sedang berjalan di percakapan ini, atau hentikan */
export async function taskControl(userId, id, { aksi, teks = '' }) {
  const c = find(userId, id);
  if (aksi === 'hentikan') { const r = await pemandu.innerTurn({ userId, sessionId: c.id, choiceId: 'cancel' }); return { ok: true, say: r.say }; }
  if (aksi === 'arahan') {
    const g = pemandu.goalOf(userId, id); if (!g || g.status === 'done') return { ok: false, pesan: 'Belum ada pekerjaan yang sedang berjalan di percakapan ini.' };
    const note = clip(teks, 500); if (!note) return { ok: false, pesan: 'Tulis arahannya dulu.' };
    g.log = g.log || []; g.log.push({ t: Date.now(), actorId: userId, type: 'comment', text: note });
    if (g.status !== 'done') g.description += `\n\n[Arahan tambahan]: ${note}`;
    store.upsert('tasks', g);
    return { ok: true, pesan: 'Arahan ditambahkan.' };
  }
  if (aksi === 'jeda' || aksi === 'lanjut') return pemandu.setPaused(userId, id, aksi === 'jeda') ? { ok: true, pesan: aksi === 'jeda' ? 'Pekerjaan dijeda: bagian yang sudah berjalan tetap selesai, sisanya menunggu.' : 'Pekerjaan dilanjutkan.' } : { ok: false, pesan: 'Belum ada pekerjaan yang sedang berjalan di percakapan ini.' };
  return { ok: false, pesan: 'Aksi tidak dikenal. Pilih: jeda, lanjut, arahan, atau hentikan.' };
}

/** layar awal obrolan: sapaan singkat dan beberapa chip saran dinamis (bukan menu kartu): lanjutan percakapan, hasil yang menunggu, ide dari profil, dan sesuai jam */
export function awal(userId) {
  const h = pemandu.home(userId); const chips = [];
  const last = Object.values(C().convs).filter((c) => c.userId === userId && c.status === 'aktif' && c.msgs.length >= 2).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (last) chips.push({ label: `Lanjutkan: ${clip(last.title, 36)}`, aksi: 'buka', ref: last.id });
  const menunggu = db().approvals.filter((a) => a.status === 'pending' && a.kind === 'review' && a.approverId === userId).length;
  if (menunggu) chips.push({ label: `${menunggu} hasil menunggu kamu`, aksi: 'ke', ref: 'tasks' });
  const nama = h.profile?.items?.find((i) => i.key === 'nama')?.value;
  chips.push({ label: nama ? `Ide konten untuk ${clip(nama, 30)}` : 'Jelaskan sesuatu yang baru untukku', aksi: 'kirim' });
  const jam = new Date().getHours();
  chips.push({ label: jam < 11 ? 'Bantu aku merencanakan hari ini' : jam < 17 ? 'Apa yang sudah beres hari ini?' : 'Apa yang perlu disiapkan untuk besok?', aksi: 'kirim' });
  chips.push({ label: 'Bantu aku menulis pesan', aksi: 'kirim' });
  return { say: h.say, chips: chips.slice(0, 4), quota: h.quota };
}

// ───────────────────────── sumber ─────────────────────────
export function sources(userId, id) { const c = find(userId, id); return { sumber: c.sources.map(src.viewSource) }; }
export function addSources(userId, id, b = {}) {
  const c = find(userId, id); let s;
  if (b.catatanId) {
    const n = db().notes.find((x) => x.id === b.catatanId);
    if (!n || !brain.canRead(n, { employeeId: userId })) throw Object.assign(new Error('Catatan tidak ditemukan'), { code: 404 });
    s = src.addSource(c, { judul: n.title, teks: n.content, jenis: 'catatan', ref: n.id });
  } else if (b.tugasId) {
    const t = db().tasks.find((x) => x.id === b.tugasId);
    if (!t || !(t.output || t.summary)) throw Object.assign(new Error('Hasil itu tidak ditemukan'), { code: 404 });
    s = src.addSource(c, { judul: t.title, teks: t.output || t.summary, jenis: 'hasil', ref: t.id });
  } else s = src.addSource(c, { judul: b.judul, teks: b.teks, jenis: b.jenis === 'berkas' ? 'berkas' : 'teks' });
  c.updatedAt = Date.now(); store.save();
  return { sumber: c.sources.map(src.viewSource), ditambah: src.viewSource(s, c.sources.length - 1) };
}
export function dropSource(userId, id, sid) { const c = find(userId, id); if (!src.removeSource(c, sid)) throw Object.assign(new Error('Sumber tidak ditemukan'), { code: 404 }); store.save(); return { sumber: c.sources.map(src.viewSource) }; }
export function docFile(userId, id, docId) {
  const c = find(userId, id); const d = c.docs.find((x) => x.id === docId); if (!d) throw Object.assign(new Error('Dokumen tidak ditemukan'), { code: 404 });
  return { nama: `${router.norm(d.judul).replace(/ /g, '-').slice(0, 60) || 'dokumen'}.md`, judul: d.judul, isi: d.isi };
}

pemandu.setFront(turn);   // web, Telegram, Discord, dan Kantor 3D memanggil pemandu.turn: sekarang menuju mesin ini

// ───────────────────────── rute (kompatibel mundur dengan /api/pemandu/* dan /api/orchestrate) ─────────────────────────
const who = (b) => b.userId || db().settings.currentUserId;
const sendArgs = (b, p, extra = {}) => ({ userId: who(b), sessionId: p.id, input: b.teks, choiceId: b.pilihan, canAutomate: b.canAutomate !== false, source: b.sumber || 'web', fokus: b.fokus || undefined, ...extra });
export const routes = [
  ['GET', '/api/chat/conversations', (b, p, url) => ({ percakapan: list(who(b), { q: url.searchParams.get('q') || '', status: url.searchParams.get('status') || 'aktif' }) })],
  ['POST', '/api/chat/conversations', (b) => create(who(b), { tujuan: b.tujuan, agen: b.agen || [], judul: b.judul })],
  ['GET', '/api/chat/conversations/:id', (b, p) => detail(who(b), p.id)],
  ['PATCH', '/api/chat/conversations/:id', (b, p) => update(who(b), p.id, b)],
  ['DELETE', '/api/chat/conversations/:id', (b, p) => remove(who(b), p.id)],
  ['POST', '/api/chat/conversations/:id/send', (b, p) => turn(sendArgs(b, p))],
  // streaming: peristiwa SSE mulai{speaker} -> delta{teks} -> alat{alat} -> selesai{respons} (atau galat). Pemasang rute (index.js) menjalankan fungsi __sse di ruang kerja yang benar.
  ['POST', '/api/chat/conversations/:id/stream', (b, p) => ({ __sse: async (emit) => { try { const r = await turn(sendArgs(b, p, { emit })); emit({ jenis: 'selesai', respons: r }); } catch (err) { emit({ jenis: 'galat', pesan: err.code === 404 ? 'Percakapan tidak ditemukan.' : 'Ada yang belum berhasil. Coba lagi.' }); } } })],
  ['POST', '/api/chat/conversations/:id/ulang', (b, p) => { const { teks } = rewind(who(b), p.id, {}); return { __sse: async (emit) => { try { const r = await turn(sendArgs({ ...b, teks }, p, { emit })); emit({ jenis: 'selesai', respons: r }); } catch (err) { emit({ jenis: 'galat', pesan: 'Ada yang belum berhasil. Coba lagi.' }); } } }; }],
  ['POST', '/api/chat/conversations/:id/ubah', (b, p) => { const { teks } = rewind(who(b), p.id, { teks: b.teks }); return { __sse: async (emit) => { try { const r = await turn(sendArgs({ ...b, teks }, p, { emit })); emit({ jenis: 'selesai', respons: r }); } catch (err) { emit({ jenis: 'galat', pesan: 'Ada yang belum berhasil. Coba lagi.' }); } } }; }],
  ['GET', '/api/chat/laporan', (b) => laporan(who(b))],
  ['POST', '/api/chat/laporan/:id/baca', (b, p) => laporanBaca(who(b), p.id)],
  ['POST', '/api/chat/conversations/:id/umpan', (b, p) => umpan(who(b), p.id, b)],
  ['POST', '/api/chat/conversations/:id/peserta', (b, p) => participants(who(b), p.id, b)],
  ['GET', '/api/chat/conversations/:id/disarankan', (b, p) => ({ disarankan: recommended(who(b), p.id) })],
  ['POST', '/api/chat/conversations/:id/tugas', (b, p) => taskControl(who(b), p.id, b)],
  ['GET', '/api/chat/conversations/:id/sumber', (b, p) => sources(who(b), p.id)],
  ['POST', '/api/chat/conversations/:id/sumber', (b, p) => addSources(who(b), p.id, b)],
  ['DELETE', '/api/chat/conversations/:id/sumber/:sid', (b, p) => dropSource(who(b), p.id, p.sid)],
  ['GET', '/api/chat/conversations/:id/dokumen/:docId', (b, p) => docFile(who(b), p.id, p.docId)],
  ['GET', '/api/percakapan', (b) => list(who(b), { status: 'aktif' }).map((c) => ({ id: c.id, judul: c.judul, tujuan: c.tujuan, waktu: c.waktu, peserta: c.peserta.map((p) => p.id) }))],
  ['GET', '/api/chat/awal', (b) => awal(who(b))],
  ['GET', '/api/chat/saran', (b, p, url) => ({ saran: suggest(url.searchParams.get('q') || '') })],
  ['GET', '/api/chat/kabar', () => ({ kabar: news() })],
];
