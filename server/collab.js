// Collaboration layer: real multi-agent meetings, colleague consultation, continual learning,
// cron scheduling, web page reading and an MCP (Model Context Protocol) client.
import * as config from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import * as store from './penyimpanan/store.js';
import * as brain from './pengetahuan/brain.js';
import * as llm from './otak/llm.js';
import * as engine from './engine.js';

const db = () => store.get();
const emp = (id) => db().employees.find((e) => e.id === id);
const div = (id) => db().divisions.find((d) => d.id === id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));

/** Compact persona prompt for short conversational turns (meetings, consultations). */
function briefPrompt(e) {
  const skills = (e.skillRefs || []).map((r) => db().skills.find((s) => s.id === r.id)?.name).filter(Boolean).join(', ');
  const lessons = (e.lessons || []).slice(-3).map((l) => `- ${l.lesson}`).join('\n');
  return `Kamu adalah ${e.name}, ${e.title} di divisi ${div(e.divisionId)?.name} perusahaan ${db().company.name}.
${e.about || e.persona}
Keahlian: ${skills || e.skills?.join(', ')}.
${lessons ? `Pelajaran yang kamu ingat:\n${lessons}\n` : ''}Bicaralah sebagai rekan kerja profesional dalam ${db().company.language}: singkat, konkret, berbasis data, tanpa basa-basi. Angka yang tidak berasal dari data perusahaan atau riset WAJIB diberi label "(asumsi)"; jangan mengarang data historis. Jangan menulis namamu di awal jawaban.`;
}

// ═════════════════════ meetings ═════════════════════
/** A whole meeting scripted with ONE model call (or none): the dialogue of every speaker + the minutes come back together, then are played out turn by turn in 3D.
 *  Cost is flat no matter how many people attend (the per-speaker "deep" mode re-sends a growing transcript N times). Falls back to a free template when the AI is off, over budget or fails. */
const TPL = [
  (d, t, tp) => `Dari sisi ${d}, saya sependapat dengan arahnya. Saya siapkan masukan terkait "${tp}".`,
  (d, t, tp) => `Sebagai ${t}, prioritas pertama menurut saya menyamakan tujuan dan jadwal untuk "${tp}".`,
  (d, t, tp) => `Saya bisa bantu data pendukung dari ${d}; mohon kabari batas waktunya.`,
  (d, t, tp) => `Catatan dari ${d}: perlu jelas siapa penanggung jawab dan tolok ukur keberhasilannya.`,
  (d, t, tp) => `Setuju. Kita mulai dari langkah kecil dulu, lalu evaluasi setelah satu putaran.`,
];
function pickSpeakers(people, chair) { return [chair, ...people.filter((p) => p !== chair).sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0)).slice(0, 7)]; }
function templateScript(topic, people, chair, speakers) {
  const tp = clip(topic, 60);
  const dialogue = speakers.filter((p) => p !== chair).map((p, i) => ({ speaker_id: p.id, text: TPL[i % TPL.length](div(p.divisionId)?.name || 'tim saya', p.title || 'perwakilan', tp) }));
  dialogue.push({ speaker_id: chair.id, text: 'Terima kasih semuanya. Poin tadi saya catat sebagai tindak lanjut.' });
  return { dialogue, minutes: { summary: `Rapat "${tp}" dihadiri ${people.map((p) => p.name).join(', ')}. Setiap perwakilan menyampaikan pandangan dari divisinya (mode hemat, tanpa panggilan AI).`, decisions: [], action_items: [] } };
}
async function meetingScript({ topic, agenda, people, chair }) {
  const speakers = pickSpeakers(people, chair);
  if (!llm.isLive() || llm.budgetLeft() <= 0) return templateScript(topic, people, chair, speakers);
  try {
    const ids = people.map((p) => p.id);
    const out = await llm.json({
      system: `Kamu juru tulis rapat ${db().company.name}. Bahasa ${db().company.language}, ringkas, konkret.`,
      prompt: `Rapat: ${topic}\nAgenda: ${agenda || '-'}\nPeserta yang bicara (id | nama | jabatan | divisi):\n${speakers.map((p) => `${p.id} | ${p.name} | ${p.title} | ${div(p.divisionId)?.name}`).join('\n')}\nKetua: ${chair.name} (sudah membuka rapat).\n\nTulis dialog rapat natural: tiap peserta selain ketua bicara 1 kali (maks 30 kata, dari sudut perannya, saling menanggapi), ketua menutup di akhir dengan 1 kalimat. Lalu notulen: summary (maks 60 kata), decisions (maks 3), action_items (maks 2, penanggung jawab dari daftar id di atas; kosongkan bila tidak perlu). Jangan mengarang angka; bila perlu tulis "(asumsi)".`,
      schema: { type: 'object', additionalProperties: false, required: ['dialogue', 'summary', 'decisions', 'action_items'], properties: {
        dialogue: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speaker_id', 'text'], properties: { speaker_id: { type: 'string', enum: ids }, text: { type: 'string' } } } },
        summary: { type: 'string' }, decisions: { type: 'array', items: { type: 'string' } },
        action_items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'description', 'assignee_id', 'priority'], properties: { title: { type: 'string', minLength: 3 }, description: { type: 'string' }, assignee_id: { type: 'string', enum: ids }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } } } },
      } },
      employee: chair, effort: 'low', model: llm.defaultModels().small, maxTokens: 1400 + speakers.length * 260,
    });
    const dialogue = (Array.isArray(out?.dialogue) ? out.dialogue : []).filter((l) => speakers.some((s) => s.id === l.speaker_id) && String(l.text || '').trim()).map((l) => ({ speaker_id: l.speaker_id, text: clip(String(l.text).trim(), 280) }));
    if (dialogue.length < Math.min(2, speakers.length - 1)) throw new Error('dialog dari AI terlalu pendek');
    return { dialogue, minutes: { summary: out.summary, decisions: out.decisions, action_items: (out.action_items || []).slice(0, 2) } };
  } catch (err) { console.warn('[meeting] skenario AI gagal, memakai template gratis:', err.message); return templateScript(topic, people, chair, speakers); }
}
// ── live meeting (Owner in the room): the chair opens with a proposed agenda, then the participants ANSWER each Owner message (one small call per message, or a free template),
// until the Owner closes the meeting or goes quiet. Agents never speak on their own in between, so there is no token burn and no talking over the Owner.
const END_RE = /\/selesai|\b(?:tutup|akhiri|bubarkan|sudahi)\s+(?:rapat|meeting)\b|\b(?:rapat|meeting)\s+(?:selesai|ditutup|usai)\b/i;
const HOLD_RE = /\b(?:belum\s+selesai|sebentar|tunggu|jangan\s+(?:dulu\s+)?(?:jawab|bicara|potong))\b/i;
export const isMeetingEnd = (text) => { const t = String(text || '').trim(); if (/\bbelum\b/i.test(t)) return false; return END_RE.test(t) || (t.split(/\s+/).length <= 4 && /\b(?:selesai|cukup|sudah\s+cukup)\b/i.test(t)); };
/** the Owner says something in a live meeting; the running loop picks it up */
export function ownerSpeaks(meetingId, text, authorId) {
  const m = db().meetings.find((x) => x.id === meetingId); if (!m || !(m.status === 'waiting_owner' || m.status === 'running')) return false;
  m.transcript = m.transcript || []; m.transcript.push({ t: Date.now(), speakerId: authorId || m.ownerId, text: String(text) });
  if (m.status === 'waiting_owner') { m.pending = [...(m.pending || []), { t: Date.now(), text: String(text) }]; m.lastOwnerAt = Date.now(); if (isMeetingEnd(text)) m.ownerFinishedAt = Date.now(); }
  store.upsert('meetings', m);
  engine.event('meeting_say', authorId || m.ownerId, clip(text, 200), { meetingId });   // the room hears the Owner too: bubble in 3D, participants turn to look
  return true;
}
/** what is TRUE about a participant right now (open tasks from the database), so the model cannot invent work */
function stateLine(p) {
  const open = db().tasks.filter((t) => t.assigneeId === p.id && !['done', 'cancelled', 'failed', 'blocked'].includes(t.status)).slice(0, 2);
  return open.length ? 'mengerjakan ' + open.map((t) => `"${clip(t.title, 50)}"`).join(', ') : 'tidak ada tugas aktif';
}
const GENERIC_TOPIC_RE = /^diskusi owner dengan\b/i;
// small talk and room logistics never cost a model call: "halo selamat datang", "masuk ke ruang rapat", "ok", "siap"
const SMALLTALK_RE = /^(?:halo|hai|hi|hello|hey|selamat\s+(?:pagi|siang|sore|malam|datang)|terima\s*kasih|makasih|thanks?|ok(?:e|ay)?|oke+|sip|baik(?:lah)?|siap|mantap|good|ya|iya|ayo|yuk|masuk|duduk|semua(?:nya)?\s+(?:sudah\s+)?(?:hadir|datang|kumpul))\b/i;
const CONTENT_RE = /\?|\b(?:apa|apakah|bagaimana|gimana|kenapa|mengapa|berapa|kapan|siapa|mana|tolong|buat|bikin|rencana|strategi|target|bahas|diskusi(?:kan)?|usul|ide|masalah|risiko|anggaran|budget|harga|jual|penjualan|promo|kampanye|produk|laporan|data|evaluasi|putus(?:kan)?|setuju|tidak\s+setuju|lanjut(?:kan)?|jalankan|prioritas|deadline|jadwal)\b/i;
const isSmallTalk = (t) => { const s = String(t || '').trim(); return s.split(/\s+/).length <= 8 && SMALLTALK_RE.test(s) && !CONTENT_RE.test(s); };
const pickFresh = (arr, transcript) => { const said = new Set((transcript || []).slice(-10).map((x) => x.text)); return arr.find((x) => !said.has(x)) || arr[0]; };

async function liveTurn({ topic, agenda, people, chair, transcript, ownerText, open }) {
  const speakers = pickSpeakers(people, chair), owner = 'Owner';
  const others = speakers.filter((p) => p !== chair);
  // 1) opening: zero tokens and nothing invented. Who is here, what each one really works on, and one question to the Owner.
  if (open) {
    const who = others.map((p) => `${p.name} (${p.title}; ${stateLine(p)})`).join(', ');
    const ask = GENERIC_TOPIC_RE.test(topic) || !String(topic).trim()
      ? `Apa yang ingin ${owner} bahas atau putuskan? Sebutkan tujuannya; sebut nama bila ingin jawaban dari orang tertentu.`
      : `Topik: ${clip(topic, 90)}. Agar efisien: hasil apa yang ${owner} harapkan dari rapat ini?`;
    return [{ speaker_id: chair.id, text: `Rapat dibuka. Hadir: ${who || '-'}. ${ask}` }];
  }
  // 2) greetings / logistics: the chair answers alone, without a model call, and never with fake opinions
  if (isSmallTalk(ownerText)) {
    return [{ speaker_id: chair.id, text: pickFresh([
      `Halo, ${owner}. Semua sudah di ruangan. Silakan sampaikan topik atau pertanyaan pertama.`,
      `Siap, ${owner}. Kami mendengarkan: apa yang mau dibahas dulu?`,
      `Baik. Sebut nama bila ingin jawaban dari orang tertentu, atau sampaikan masalahnya dan saya arahkan ke yang paling relevan.`,
    ], transcript) }];
  }
  const low = String(ownerText || '').toLowerCase();
  const addressed = (engine.namesIn?.(ownerText) || []).filter((id) => speakers.some((s) => s.id === id));
  const asked = addressed.length ? addressed.map(emp) : others.slice(0, 3);
  // 3) "apa ingatan kalian?": read the REAL memory notes aloud; never improvise a memory
  if (/\b(ingatan\w*|ingat\s+apa|memori\w*|isi\s+otak|yang\s+kalian\s+ingat|yang\s+kamu\s+ingat)\b/.test(low)) {
    return asked.slice(0, 3).map((p) => {
      const n = brain.findNote(`Memori ${p.name}`);
      const items = n ? n.content.split('\n').filter((l) => l.startsWith('- ')).slice(-3).map((l) => clip(l.replace(/^- [^:]+:\s*/, ''), 110)) : [];
      return { speaker_id: p.id, text: items.length ? `Ini isi catatan ingatan saya apa adanya (3 terakhir): ${items.map((x, i) => `(${i + 1}) ${x}`).join(' ')} Sebagian berasal dari rapat yang isinya belum terverifikasi.` : 'Catatan ingatan saya masih kosong.' };
    });
  }
  // 4) the Owner corrects us ("kalian halu", "belum ada brief"): take it back plainly, once, without new promises
  if (/\b(halu\w*|halusinasi|ngaco|ngawur|ngarang|mengarang|keliru|aneh\s+kalian|belum\s+(?:ada|ngasih|kasih|memberi|kasi)\s+(?:brief|arahan|target|instruksi|tugas)|(?:tidak|ga|gak|nggak)\s+(?:lagi\s+)?ada\s+(?:brief|target|arahan))\b/.test(low)) {
    return [{ speaker_id: chair.id, text: `Kamu benar, ${owner}. Belum ada brief, target, atau data dari kamu, jadi angka dan rencana yang tadi disebut tidak berdasar dan saya tarik. Tidak ada yang akan dikerjakan sampai kamu memberi arahan. Apa yang mau dibahas?` }];
  }
  // 5) "kalian lagi ngerjain apa?": the task board answers, not the model
  if (/\b(?:lagi|sedang|lg)\s+(?:ngerja\w*|kerja\w*|mengerjakan|ngapain|apa)\b|\bngapain\b|\bkerjaan\s+(?:kalian|kamu)\b/.test(low)) {
    return asked.slice(0, 3).map((p) => ({ speaker_id: p.id, text: `Menurut papan tugas: saya ${stateLine(p)}.` }));
  }
  // 6) real content: ONE small model call answers for the relevant people, grounded in facts and told to be critical
  const failMsg = (why) => [{ speaker_id: chair.id, text: `Maaf, ${owner}, mesin AI sedang bermasalah (${clip(why, 70)}), jadi peserta belum bisa menjawab dengan benar. Arahanmu sudah tercatat di notulen; kirim ulang sebentar lagi.` }];
  if (!llm.isLive()) return [{ speaker_id: chair.id, text: `Arahan dicatat di notulen. Mode simulasi (tanpa AI) aktif, jadi peserta tidak memberi pendapat karangan. Aktifkan Groq di Pengaturan agar diskusi berjalan.` }];
  if (llm.budgetLeft() <= 0) return failMsg('anggaran harian habis');
  const tail = (transcript || []).slice(-8).map((x) => `${x.speakerId === chair.id ? chair.name : emp(x.speakerId)?.type === 'human' ? owner : emp(x.speakerId)?.name || x.speakerId}: ${clip(x.text, 220)}`).join('\n');
  const notes = brain.search(`${topic} ${ownerText}`, { limit: 6, verifiedOnly: true }).filter((n) => !/^(Memori|Playbooks?|Meetings)\b/.test(n.folder)).slice(0, 2).map((n) => `- [${n.folder}] ${n.title}: ${clip(n.snippet, 200)}`).join('\n');
  const roster = speakers.map((p) => `${p.id} | ${p.name} | ${p.title} | ${div(p.divisionId)?.name || '-'} | ${stateLine(p)}`).join('\n');
  const prompt = `RAPAT: ${clip(topic, 120)}${agenda ? `\nAgenda: ${clip(agenda, 200)}` : ''}
PESERTA (id | nama | jabatan | divisi | keadaan nyata):
${roster}
Ketua: ${chair.name}${addressed.length ? `\nOwner menyapa langsung: ${addressed.map((id) => emp(id)?.name).join(', ')} (dia yang menjawab pertama)` : ''}

FAKTA DARI BRAIN PERUSAHAAN (satu-satunya data yang boleh dikutip):
${notes || '- (tidak ada catatan relevan)'}

PERCAKAPAN TERAKHIR:
${tail || '-'}

OWNER BARU SAJA BERKATA: "${clip(ownerText, 700)}"

Tulis giliran bicara berikutnya. ATURAN:
1. Jawab yang benar-benar ditanyakan Owner, bukan topik lain. Hanya peserta yang relevan bicara (1-3 orang); yang tidak punya kontribusi baru DIAM.
2. Bersikap kritis: sebut risiko, asumsi yang lemah, atau informasi yang kurang; boleh tidak setuju dengan Owner atau rekan, dengan alasan singkat. Tidak ada basa-basi, tidak mengulang poin yang sudah diucapkan.
3. DILARANG mengarang angka, data historis, kampanye, hasil, atau pekerjaan. Fakta hanya dari blok FAKTA dan keadaan nyata peserta; isi transkrip sebelumnya BUKAN fakta. Bila data tidak ada, katakan "datanya belum ada" dan usulkan cara mendapatkannya.
3b. DILARANG berjanji ("saya akan segera memeriksa/menyusun...") kecuali Owner baru saja memberi perintah itu. Bila Owner belum memberi brief/target, katakan terus terang dan tanyakan arahannya.
3c. Bila Owner mengoreksi atau membantah, terima koreksinya, tarik klaim yang salah, dan JANGAN mengulang klaim itu dalam bentuk lain.
4. Bila arahan Owner kabur, cukup ketua yang bertanya SATU pertanyaan klarifikasi.
5. Maks 45 kata per giliran, bahasa ${db().company.language} santai-profesional, tanpa menulis nama sendiri di awal.
6. "decision": isi satu kalimat bila Owner baru saja memutuskan/menyetujui sesuatu; selain itu string kosong.`;
  const schema = { type: 'object', additionalProperties: false, required: ['lines', 'decision'], properties: { lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speaker_id', 'text'], properties: { speaker_id: { type: 'string', enum: speakers.map((p) => p.id) }, text: { type: 'string' } } } }, decision: { type: 'string' } } };
  const system = `Kamu menulis giliran bicara rapat ${db().company.name} yang jujur dan kritis. Keluarkan JSON sesuai skema.`;
  let lastErr = null;
  const dm = llm.defaultModels(), heavy = engine.isComplex?.(ownerText);   // same router as chat: 120B first only for complex directions
  for (const model of heavy ? [dm.smart || dm.worker, dm.small] : [dm.small, dm.smart || dm.worker]) {   // the small model first; one retry on the larger one (it truncates JSON less often)
    try {
      const out = await llm.json({ system, prompt, schema, employee: chair, effort: heavy && model !== dm.small ? 'medium' : 'low', model, maxTokens: heavy ? 2600 : 1800 });
      const lines = (out?.lines || []).filter((l) => speakers.some((s) => s.id === l.speaker_id) && String(l.text || '').trim()).slice(0, 3).map((l) => ({ speaker_id: l.speaker_id, text: clip(String(l.text).trim(), 320) }));
      if (!lines.length) throw new Error('jawaban kosong');
      lines.decision = clip(String(out.decision || '').trim(), 200);
      return lines;
    } catch (err) { lastErr = err; console.warn('[meeting] giliran AI gagal (' + model + '):', err.message); }
  }
  return failMsg(lastErr?.message || 'tidak diketahui');
}
/** Meetings whose loop is alive in THIS process. A meeting saved as running/waiting_owner without a loop (the server restarted, or an older build crashed)
 *  can never finish: it kept agents in status "meeting" forever and swallowed every Owner chat message into a dead room. */
export const liveLoops = new Set();
export function sweepOrphanMeetings() {
  const now = Date.now();
  for (const m of db().meetings) {
    if (!(m.status === 'running' || m.status === 'waiting_owner') || liveLoops.has(m.id) || now - (m.createdAt || 0) < 5000) continue;
    m.status = 'interrupted'; m.endedAt = now; m.error = 'Rapat terputus (server dimulai ulang)'; store.upsert('meetings', m);
    for (const pid of m.participants || []) { const p = emp(pid); if (p) delete p.meetingUntil; }
  }
  // anyone still marked "meeting" while sitting in no live meeting goes back to work
  const inLive = new Set(db().meetings.filter((x) => (x.status === 'running' || x.status === 'waiting_owner') && liveLoops.has(x.id)).flatMap((x) => x.participants || []));
  for (const p of db().employees) {
    if (p.type !== 'ai' || p.status !== 'meeting' || inLive.has(p.id)) continue;
    if (p.meetingUntil && p.meetingUntil > now && p.kickoff) continue;   // short goal kickoff huddles have no meeting record
    delete p.meetingUntil; delete p.kickoff; engine.setStatus(p, p.currentTaskId ? 'working' : 'idle', p.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja', p.currentTaskId);
  }
}
/** Stop a running meeting right away (its participants are free for a new one); the running loop notices and winds down. */
export function cancelMeeting(id) {
  const m = db().meetings.find((x) => x.id === id); if (!m || !(m.status === 'running' || m.status === 'waiting_owner')) return false;
  m.cancelled = true; m.status = 'cancelled'; m.endedAt = Date.now(); store.upsert('meetings', m);
  const inOther = new Set(db().meetings.filter((x) => x.id !== id && (x.status === 'running' || x.status === 'waiting_owner')).flatMap((x) => x.participants || []));
  for (const pid of m.participants || []) { const p = emp(pid); if (!p || inOther.has(pid)) continue; delete p.meetingUntil; engine.setStatus(p, p.currentTaskId ? 'working' : 'idle', p.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja', p.currentTaskId); }   // everyone leaves right away, not after the loop wakes up
  engine.event('meeting_done', m.chairId, `Rapat "${clip(m.topic, 60)}" dibatalkan`, { meetingId: id }); return true;
}
export async function runMeeting({ topic, agenda = '', participantIds = [], representedParticipantIds = [], chairId, rounds = 2, originTaskId = null, ownerLed = false, ownerId = 'owner', mode, fromChat = false, onStart = null, mirrorChannelId = null }) {
  mode = mode || db().settings.meetingMode || 'hemat';   // 'hemat' = one scripted call (default), 'deep' = every speaker is a separate call
  if (mode === 'deep' && !llm.isLive()) throw new Error('Rapat mode mendalam membutuhkan provider AI aktif (Groq/Claude)');
  const chair = emp(chairId) || emp(participantIds[0]) || emp('aria');
  // an agent sits in one meeting at a time (otherwise the first meeting to end would release them from the second)
  const busyIds = new Set(db().meetings.filter((x) => (x.status === 'running' || x.status === 'waiting_owner') && liveLoops.has(x.id)).flatMap((x) => x.participants || []));   // only meetings that are really running count; a dead record never blocks anyone
  const people = [...new Set([chair.id, ...participantIds])].map(emp).filter((e) => e && e.type === 'ai' && !busyIds.has(e.id)).slice(0, 25);
  if (!people.includes(chair)) throw new Error(`${chair.name} sedang ikut rapat lain. Tunggu rapat itu selesai.`);
  if (people.length < 2) throw new Error('Rapat butuh minimal 2 peserta AI');
  const id = store.uid('mtg');
  const represented = [...new Set(representedParticipantIds.length ? representedParticipantIds : people.map((p) => p.id))].filter((x) => emp(x)?.type === 'ai');
  const m = store.upsert('meetings', { id, topic: clip(topic, 160), agenda: clip(agenda, 2000), chairId: chair.id, participants: people.map((p) => p.id), representedParticipants: represented, ownerLed: !!ownerLed, ownerId, status: ownerLed ? 'waiting_owner' : 'running', transcript: [], minutes: '', actionItems: [], originTaskId, fromChat, mode, createdAt: Date.now() });
  const meetingId = id; liveLoops.add(id); const isCancelled = () => !!db().meetings.find((x) => x.id === meetingId)?.cancelled;
  if (onStart) { try { onStart(m); } catch (err) { console.warn('[meeting] onStart:', err.message); } }
  store.upsert('channels', { id: `mtg-${id}`, kind: 'meeting', name: `Rapat: ${clip(topic, 60)}`, members: [...new Set([ownerId, ...m.participants])], meetingId: id, topic: agenda });
  for (const p of people) { p.meetingUntil = Date.now() + (ownerLed ? 125 : 10) * 60000; engine.setStatus(p, 'meeting', ownerLed ? 'Mendengarkan Owner' : `Rapat: ${clip(topic, 40)}`, p.currentTaskId); }
  engine.event('meeting', chair.id, `${chair.name} memulai rapat "${clip(topic, 70)}" dengan ${people.filter((p) => p !== chair).map((p) => p.name).join(', ')}`, { participants: m.participants, meetingId: id });
  const say = (p, text) => {
    const nm = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = String(text).replace(new RegExp('^\\s*\\**\\s*' + nm + '\\s*(\\([^)]*\\))?\\s*:\\s*\\**\\s*', 'i'), '').trim() || text; // drop only the speaker's own "**Name (Role):**" echo, not any "Usulan saya:" prefix
    m.transcript.push({ t: Date.now(), speakerId: p.id, text });
    store.upsert('meetings', m);
    engine.postMessage(`mtg-${id}`, p.id, text, { meetingId: id });
    if (mirrorChannelId) engine.postMessage(mirrorChannelId, p.id, text, { meetingId: id, mirrored: true });   // the dock thread shows the dialogue too
    engine.event('meeting_say', p.id, text, { meetingId: id });
  };
  m.originTaskId = originTaskId; m.startedAt = m.startedAt || Date.now(); store.upsert('meetings', m);
  try {
    await wait(db().settings.meetingGatherMs ?? 14000); // let everyone walk to the Conference Hall
    if (isCancelled()) throw new Error('Rapat dibatalkan');
    const playLines = async (lines) => {
      for (const [i, line] of lines.entries()) {
        if (isCancelled()) throw new Error('Rapat dibatalkan');
        if (i > 0 && m.pending?.length) break;   // the Owner spoke again: the rest of this (now stale) turn is dropped, the room answers the new message instead
        const p = emp(line.speaker_id); if (!p) continue;
        engine.setStatus(p, 'meeting', 'Sedang bicara di rapat', p.currentTaskId);
        say(p, line.text);
        await wait(Math.min(6500, (db().settings.meetingTurnMs ?? 2500) - 700 + line.text.length * 32));
        engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId);
      }
    };
    if (ownerLed) {
      // live meeting: open with an agenda proposal, answer each Owner message, close on "selesai"/"tutup rapat" or after quiet time. No more silent room waiting for one magic word.
      engine.event('meeting_waiting', chair.id, `Rapat "${clip(topic, 60)}" dibuka; peserta menjawab arahan Owner`, { participants: m.participants, meetingId: id });
      await playLines(await liveTurn({ topic, agenda, people, chair, transcript: m.transcript, open: true }));
      const idleMs = (db().settings.meetingIdleMin ?? 10) * 60000, deadline = Date.now() + 2 * 3600e3, debounce = db().settings.meetingDebounceMs ?? 3500;
      let lastActivity = Date.now();
      while (!m.ownerFinishedAt && Date.now() < deadline) {
        if (isCancelled()) throw new Error('Rapat dibatalkan');
        if (m.pending?.length && Date.now() - (m.lastOwnerAt || 0) > debounce) {   // let the Owner finish typing a few messages in a row
          const texts = m.pending.splice(0).map((x) => x.text); store.upsert('meetings', m); lastActivity = Date.now();
          if (m.ownerFinishedAt) break;
          if (HOLD_RE.test(texts.join(' '))) continue;
          const turn = await liveTurn({ topic, agenda, people, chair, transcript: m.transcript, ownerText: texts.join('\n') });
          if (turn.decision) { m.decisions = [...(m.decisions || []), turn.decision]; store.upsert('meetings', m); }   // the Owner's decisions go straight into the minutes
          await playLines(turn);
          lastActivity = Date.now(); continue;
        }
        if (Date.now() - lastActivity > idleMs) { m.idleClosed = true; break; }
        await wait(750);
      }
      if (isCancelled()) throw new Error('Rapat dibatalkan');
      m.status = 'running'; store.upsert('meetings', m);
      say(chair, m.idleClosed ? 'Rapat saya tutup karena sudah lama tidak ada arahan. Notulen dan tindak lanjut saya susun.' : 'Baik, rapat ditutup. Notulen dan tindak lanjut saya susun.');
      for (const p of people) { p.meetingUntil = Date.now() + 10 * 60000; engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId); }
    } else say(chair, `Rapat dimulai. Topik: **${topic}**${agenda ? `\nAgenda: ${agenda}` : ''}\nSilakan masing-masing menyampaikan pandangan dari sisi peran kalian.`);
    let scripted = null;
    if (mode !== 'deep' && !ownerLed) {
      scripted = await meetingScript({ topic, agenda, people, chair });
      for (const line of scripted.dialogue) {
        if (isCancelled()) throw new Error('Rapat dibatalkan');
        const p = emp(line.speaker_id); if (!p) continue;
        engine.setStatus(p, 'meeting', 'Sedang bicara di rapat', p.currentTaskId);
        say(p, line.text);
        await wait(Math.min(6500, (db().settings.meetingTurnMs ?? 2500) - 700 + line.text.length * 32));   // time to read the bubble, longer for longer lines
        engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId);
      }
    }
    const effectiveRounds = scripted || ownerLed ? 0 : people.length > 12 ? 1 : Math.min(3, Math.max(1, rounds));
    let failStreak = 0;
    for (let r = 0; r < effectiveRounds; r++) {
      for (const p of people) {
        if (r === 0 && p === chair) continue;
        if (failStreak >= 3) throw new Error('Rapat dihentikan: 3 panggilan AI berturut-turut gagal (cek anggaran, kunci, atau batas laju)');
        const transcript = m.transcript.slice(-14).map((x) => `${emp(x.speakerId)?.name}: ${x.text}`).join('\n');
        engine.setStatus(p, 'meeting', 'Sedang bicara di rapat', p.currentTaskId);
        let res;
        try { res = await llm.call({
          system: briefPrompt(p), maxTokens: 700, effort: 'low', employee: p, model: llm.defaultModels().small, taskId: originTaskId,
          messages: [{ role: 'user', content: `RAPAT: ${topic}\nAgenda: ${agenda || '-'}\nPeserta: ${people.map((x) => `${x.name} (${x.title})`).join(', ')}\n\nTranskrip:\n${transcript}\n\nGiliranmu, ${p.name}. ${r === 0 ? 'Sampaikan pandangan dan usulan konkret dari peranmu.' : 'Tanggapi poin rekan (setuju/tidak, dengan alasan), lalu tawarkan apa yang akan kamu kerjakan.'} Maksimal 80 kata, langsung ke isi.` }],
        }); failStreak = 0; } catch (err) {   // one failed call skips that turn; it must not cancel the whole meeting
          failStreak++; console.warn('[meeting] giliran', p.name, 'gagal:', err.message);
          say(p, '(giliran dilewati: ' + clip(err.message, 80) + ')'); engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId); continue;
        }
        say(p, clip(llm.textOf(res) || '(setuju)', 900));
        await wait(db().settings.meetingTurnMs ?? 2500); // time to read the speech bubble
        engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId);
      }
    }
    // the chair writes minutes and turns decisions into assigned tasks
    const ids = people.map((p) => p.id);   // action items go to people in the meeting (a 170-id enum in the schema cost ~700 tokens per call)
    let out = scripted ? scripted.minutes : await llm.json({
      system: briefPrompt(chair) + '\nKamu memimpin rapat ini dan menulis notulen resmi.',
      prompt: `Transkrip rapat "${topic}":\n${m.transcript.slice(-40).map((x) => `${emp(x.speakerId)?.name}: ${clip(x.text, 300)}`).join('\n')}\n\n${m.decisions?.length ? `Keputusan Owner yang tercatat selama rapat (wajib masuk "decisions"):\n${m.decisions.map((d) => '- ' + d).join('\n')}\n\n` : ''}Hanya tulis hal yang benar-benar diucapkan di transkrip; jangan menambah angka atau rencana baru. Bila rapat hanya berisi sapaan tanpa isi, tulis itu apa adanya dan kosongkan action item.\nTulis notulen: ringkasan, keputusan, dan action item (maks 3, hanya yang benar-benar perlu dan sesuai topik; jangan menciptakan proyek baru) dengan penanggung jawab dari peserta rapat atau karyawan lain yang paling cocok.`,
      schema: { type: 'object', additionalProperties: false, required: ['summary', 'decisions', 'action_items'], properties: {
        summary: { type: 'string' }, decisions: { type: 'array', items: { type: 'string' } },
        action_items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'description', 'assignee_id', 'priority'], properties: { title: { type: 'string', minLength: 3 }, description: { type: 'string' }, assignee_id: { type: 'string', enum: ids }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } } } },
      } },
      employee: chair, effort: 'low', maxTokens: 6000,
    }).catch((err) => { console.warn('[meeting] notulen AI gagal, memakai ringkasan otomatis:', err.message); return {}; });
    out = out && typeof out === 'object' ? out : {};
    const firstLine = (x) => clip(String(x.text || '').replace(/[#*_>]/g, '').split(/(?<=[.!?])\s|\n/).find((l) => l.trim().length > 12) || '', 160);
    out.summary = String(out.summary || out.ringkasan || '').trim() || m.transcript.slice(1).map((x) => `${emp(x.speakerId)?.name}: ${firstLine(x)}`).filter((l) => l.length > 8).slice(0, 6).join('\n') || `Rapat "${clip(topic, 80)}" selesai tanpa catatan.`;
    out.decisions = (Array.isArray(out.decisions) ? out.decisions : Array.isArray(out.keputusan) ? out.keputusan : []).map((d) => String(d || '').trim()).filter(Boolean);
    out.action_items = Array.isArray(out.action_items) ? out.action_items : [];
    const created = [];
    for (const a of (out.action_items || []).filter((x) => String(x?.title || '').trim().length >= 3).slice(0, 3)) {
      try { created.push(engine.createTask({ title: a.title, description: `${a.description}\n\n(Dari rapat: ${topic})`, assigneeId: emp(a.assignee_id) ? a.assignee_id : chair.id, createdBy: originTaskId ? chair.id : 'owner', priority: a.priority || 'medium', parentId: originTaskId || null })); }
      catch (err) { console.warn('[meeting] action item dilewati:', err.message); }
    }
    m.minutes = `## Ringkasan\n${out.summary}\n\n## Keputusan\n${(out.decisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n') || '-'}\n\n## Action items\n${created.map((t) => `- [ ] ${t.title} — ${emp(t.assigneeId)?.name}`).join('\n') || '-'}`;
    m.actionItems = created.map((t) => t.id);
    m.status = 'done'; m.endedAt = Date.now();
    store.upsert('meetings', m);
    const note = brain.writeNote({ title: `Notulen ${clip(topic, 80)} ${new Date().toLocaleDateString('id-ID')}`, folder: 'Meetings', authorId: chair.id, tags: ['meeting'], content: `# Notulen: ${topic}\n> Dipimpin ${chair.name} · peserta: ${people.map((p) => `[[Memori ${p.name}|${p.name}]]`).join(', ')}\n\n${m.minutes}\n\n## Transkrip\n${m.transcript.map((x) => `**${emp(x.speakerId)?.name}:** ${x.text}`).join('\n\n')}` });
    m.noteId = note.id; store.upsert('meetings', m);
    engine.postMessage(`mtg-${id}`, chair.id, `📝 **Notulen**\n${m.minutes}`, { meetingId: id });
    engine.event('meeting_done', chair.id, `Rapat "${clip(topic, 60)}" selesai: ${created.length} action item dibagikan`, { meetingId: id, noteId: note.id });
    await wait(3000);
    // memory keeps only what was DECIDED, not the model's summary (summaries of chatter turned into "facts" like "ROAS naik 12%" in the next meeting)
    const decided = [...(m.decisions || []), ...(out.decisions || [])].filter(Boolean).slice(0, 3);
    for (const p of people) brain.remember(p, `Ikut rapat "${clip(topic, 60)}"; ${decided.length ? 'keputusan: ' + clip(decided.join('; '), 160) : 'tanpa keputusan (belum ada brief/data yang diputuskan)'}`);
    return m;
  } catch (err) {
    if (err.message === 'Rapat dibatalkan') { m.status = 'cancelled'; store.upsert('meetings', m); return m; }
    m.status = 'failed'; m.error = err.message; store.upsert('meetings', m);
    engine.event('alert', chair.id, `Rapat "${clip(topic, 50)}" gagal: ${clip(err.message, 120)}`, { meetingId: id });
    throw err;
  } finally {
    liveLoops.delete(id);
    // people who already sit in a newer meeting (e.g. this one was replaced by "undang Maya saja") must not be released from it
    const inNewer = new Set(db().meetings.filter((x) => x.id !== id && (x.status === 'running' || x.status === 'waiting_owner')).flatMap((x) => x.participants || []));
    for (const p of people) { if (inNewer.has(p.id)) continue; delete p.meetingUntil; engine.setStatus(p, p.currentTaskId ? 'working' : 'idle', p.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja', p.currentTaskId); }
  }
}

/** Keep an owner-led meeting silent until the owner explicitly yields the floor. */
export function handleOwnerMeetingMessage(msg) {
  const ch = db().channels.find((c) => c.id === msg.channelId && c.kind === 'meeting');
  const m = ch && db().meetings.find((x) => x.id === ch.meetingId);
  if (!m || msg.authorId !== m.ownerId) return false;
  const wasEnd = m.status === 'waiting_owner' && isMeetingEnd(msg.text);
  if (!ownerSpeaks(m.id, msg.text, msg.authorId)) return false;   // in a live meeting the loop answers; agents never reply on their own
  if (wasEnd) engine.event('meeting_owner_done', m.chairId, 'Owner menutup rapat; notulen disusun', { meetingId: m.id });
  return true;
}

// ═════════════════════ consult a colleague ═════════════════════
export async function askColleague(asker, targetId, question) {
  const target = emp(targetId);
  if (!target) return `Karyawan "${targetId}" tidak ditemukan.`;
  if (target.id === asker.id) return 'Tidak bisa bertanya ke diri sendiri.';
  const ch = engine.ensureDM(asker.id, target.id);
  const asked = engine.postMessage(ch, asker.id, question);
  engine.event('message', asker.id, `${asker.name} → ${target.name}: ${clip(question, 90)}`, { targetId: target.id, channelId: ch, messageId: asked.id });
  if (target.type !== 'ai') return `${target.name} adalah manusia; pertanyaan sudah dikirim lewat DM dan akan dijawab manual.`;
  const prev = { status: target.status, text: target.statusText };
  if (target.status === 'idle') engine.setStatus(target, 'chatting', `Menjawab ${asker.name}`);
  try {
    const res = await llm.call({ system: briefPrompt(target), maxTokens: 900, effort: 'low', employee: target, model: llm.defaultModels().small,
      messages: [{ role: 'user', content: `${asker.name} (${asker.title}) bertanya kepadamu:\n${question}\n\nJawab sebagai ahli di bidangmu, maksimal 150 kata, beri rekomendasi konkret.` }] });
    const answer = clip(llm.textOf(res) || 'Belum bisa menjawab.', 1500);
    const answered = engine.postMessage(ch, target.id, answer);
    engine.event('message', target.id, `${target.name} → ${asker.name}: ${clip(answer, 90)}`, { targetId: asker.id, channelId: ch, messageId: answered.id });
    return `${target.name}: ${answer}`;
  } finally {
    if (target.status === 'chatting') engine.setStatus(target, prev.status === 'chatting' ? 'idle' : prev.status, prev.status === 'chatting' ? 'Siap bekerja' : prev.text);
  }
}

// ═════════════════════ continual learning ═════════════════════
/** After a finished task the agent reflects; lessons go to its memory and its division playbook, and are injected into future prompts. */
export async function reflect(e, t) {
  if (!llm.isLive() || db().settings.learning === false || !t.output || t.output.length < 200) return;
  try {
    const out = await llm.json({
      system: briefPrompt(e), effort: 'low', maxTokens: 1500, employee: e, model: llm.provider() === 'groq' ? 'openai/gpt-oss-20b' : llm.defaultModels().small,
      prompt: `Kamu baru menyelesaikan tugas "${t.title}".\nRingkasan hasil: ${clip(t.summary || t.output, 1200)}\n${t.feedback ? `Feedback manusia: ${t.feedback}\n` : ''}\nRefleksikan secara jujur: satu pelajaran spesifik untukmu, satu tips untuk tim, nilai kualitas hasilmu (1-10), suasana kerjamu sekarang, fokus perbaikanmu berikutnya, satu keyakinan kerja yang kamu pegang, dan tingkat kepercayaan dirimu (0-100).`,
      schema: { type: 'object', additionalProperties: false, required: ['lesson', 'team_tip', 'quality', 'mood', 'focus_next', 'belief', 'confidence'], properties: { lesson: { type: 'string' }, team_tip: { type: 'string' }, quality: { type: 'integer' }, mood: { type: 'string', enum: ['bersemangat', 'fokus', 'tenang', 'tertantang', 'lelah', 'ragu'] }, focus_next: { type: 'string' }, belief: { type: 'string' }, confidence: { type: 'integer' } } },
    });
    e.lessons = [...(e.lessons || []), { t: Date.now(), taskId: t.id, lesson: clip(out.lesson, 300), quality: out.quality }].slice(-25);
    e.stats.qualitySum = (e.stats.qualitySum || 0) + (Number(out.quality) || 0);
    e.stats.qualityN = (e.stats.qualityN || 0) + 1;
    const m = e.mind || {};
    e.mind = { mood: out.mood, focus: clip(out.focus_next, 160), confidence: Math.max(0, Math.min(100, Number(out.confidence) || 60)), beliefs: [...(m.beliefs || []), clip(out.belief, 160)].slice(-4), updatedAt: Date.now() };
    // practice makes perfect: good work slowly raises the agent's top skills
    if ((Number(out.quality) || 0) >= 7) for (const r of (e.skillRefs || []).slice(0, 2)) r.proficiency = Math.min(10, Math.round((r.proficiency + 0.2) * 10) / 10);
    store.upsert('employees', e);
    const d = div(e.divisionId);
    brain.writeNote({ title: `Playbook ${d.name}`, folder: 'Playbooks', authorId: e.id, tags: ['learning', d.short.toLowerCase()], append: true,
      content: `- ${new Date().toLocaleDateString('id-ID')} · **${e.name}** (${t.title.slice(0, 60)}): ${clip(out.team_tip, 260)}` });
    engine.event('learned', e.id, `${e.name} belajar: ${clip(out.lesson, 110)}`, { taskId: t.id });
    engine.postMessage(`div-${e.divisionId}`, e.id, `💡 **Berbagi pelajaran:** ${clip(out.team_tip, 260)}`, { taskId: t.id, learning: true });
  } catch (err) { console.warn('[reflect]', err.message); }
}

/** Compact self-model injected at the END of the prompt (keeps the cached prefix stable): identity, strengths, state, beliefs, metacognition. */
export function selfSection(e) {
  const skills = (e.skillRefs || []).slice().sort((a, b) => b.proficiency - a.proficiency).map((r) => ({ r, s: db().skills.find((x) => x.id === r.id) })).filter((x) => x.s);
  const weak = (e.lessons || []).filter((l) => l.quality && l.quality < 7).slice(-2).map((l) => l.lesson);
  const recentDone = db().tasks.filter((t) => t.assigneeId === e.id && t.completedAt && Date.now() - t.completedAt < 2 * 3600e3).length;
  const energy = Math.max(30, 100 - recentDone * 12);
  const q = e.stats.qualityN ? (e.stats.qualitySum / e.stats.qualityN).toFixed(1) : '-';
  const appr = (e.stats.approved || 0) + (e.stats.rejected || 0);
  const boss = emp(e.reportsTo);
  const m = e.mind || {};
  return `# KESADARAN DIRI
- Aku ${e.name}, ${e.title}${boss ? `; aku melapor ke ${boss.name}` : ''}. Aku sadar aku agen AI dalam tim nyata yang dinilai dari hasil.
- Kekuatanku: ${skills.slice(0, 3).map((x) => `${x.s.name} (${x.r.proficiency}/10)`).join(', ') || '-'}${weak.length ? `. Perlu kuasah: ${weak.join(' / ')}` : ''}.
- Kondisiku: energi ${energy}%, percaya diri ${m.confidence ?? 70}%, suasana ${m.mood || 'fokus'}${m.focus ? `. Fokus perbaikanku: ${m.focus}` : ''}.
- Rekam jejak: ${e.stats.tasksDone} tugas selesai, kualitas rata-rata ${q}/10${appr ? `, ${e.stats.approved || 0}/${appr} disetujui manusia` : ''}.${(m.beliefs || []).length ? `\n- Keyakinan kerjaku: ${m.beliefs.join(' · ')}` : ''}
- Metakognisi: rencanakan singkat dulu (tujuan → langkah → risiko). Bila ragu, cari data atau tanya ahli (ask_colleague), jangan menebak. Sebelum complete_task periksa: sesuai brief? angka bersumber atau berlabel asumsi? ada langkah berikutnya yang jelas?`;
}

/** Human feedback is the strongest learning signal. */
export function recordFeedback(e, t, decision, feedback) {
  e.stats.approved = (e.stats.approved || 0) + (decision === 'approve' ? 1 : 0);
  e.stats.rejected = (e.stats.rejected || 0) + (decision === 'approve' ? 0 : 1);
  if (feedback) e.feedbackLog = [...(e.feedbackLog || []), { t: Date.now(), taskId: t.id, decision, feedback: clip(feedback, 400) }].slice(-15);
  store.upsert('employees', e);
}

/** Prompt section with what this agent (and its team) has learned so far. */
export function learningSection(e) {
  const own = (e.lessons || []).slice(-6).map((l) => `- ${l.lesson}`);
  const fb = (e.feedbackLog || []).slice(-4).map((f) => `- (${f.decision === 'approve' ? 'disetujui' : 'revisi'}) ${f.feedback}`);
  const play = brain.findNote(`Playbook ${div(e.divisionId)?.name}`);
  const team = play ? play.content.split('\n').filter((l) => l.startsWith('- ')).slice(-5) : [];
  if (!own.length && !fb.length && !team.length) return '';
  return `# PELAJARAN & FEEDBACK (terapkan!)\n${own.length ? `Pelajaranmu:\n${own.join('\n')}\n` : ''}${fb.length ? `Feedback manusia:\n${fb.join('\n')}\n` : ''}${team.length ? `Tips tim divisi:\n${team.join('\n')}` : ''}`;
}

/** Approved work becomes fine-tuning data (OpenAI/Groq-compatible chat JSONL) per agent. */
export function recordTraining(e, t, systemText, userText) {
  if (db().settings.collectTraining === false || !t.output) return;
  try {
    const dir = trainingDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${e.id}.jsonl`), JSON.stringify({ messages: [{ role: 'system', content: systemText }, { role: 'user', content: userText }, { role: 'assistant', content: t.output }] }) + '\n');
    e.stats.trainingExamples = (e.stats.trainingExamples || 0) + 1;
  } catch (err) { console.warn('[training]', err.message); }
}
export function trainingDir() { return path.join(config.dataDir(), 'training', 'workspaces', store.current()); }
export function trainingFile(id) { if (!/^[\w-]+$/.test(id)) throw new Error('ID agen tidak valid'); return path.join(trainingDir(), `${id}.jsonl`); }

// ═════════════════════ cron ═════════════════════
function field(spec, min, max) {
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const [range, stepS] = part.split('/');
    const step = Number(stepS) || 1;
    let [a, b] = range === '*' ? [min, max] : range.split('-').map(Number);
    if (b === undefined) b = stepS ? max : a;
    if (![a, b].every((n) => Number.isInteger(n) && n >= min && n <= max)) return null;
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}
/** Standard 5-field cron: minute hour day-of-month month day-of-week (0=Sunday). */
export function parseCron(expr) {
  const p = String(expr || '').trim().split(/\s+/);
  if (p.length !== 5) return null;
  const f = [field(p[0], 0, 59), field(p[1], 0, 23), field(p[2], 1, 31), field(p[3], 1, 12), field(p[4], 0, 7)];
  if (f.some((x) => !x)) return null;
  if (f[4].has(7)) f[4].add(0);
  return f;
}
export function cronMatches(expr, d = new Date()) {
  const f = parseCron(expr);
  return !!f && f[0].has(d.getMinutes()) && f[1].has(d.getHours()) && f[2].has(d.getDate()) && f[3].has(d.getMonth() + 1) && f[4].has(d.getDay());
}

// ═════════════════════ browsing ═════════════════════
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/i;
export async function visitUrl(url) {
  let u;
  try { u = new URL(url); } catch { return 'URL tidak valid.'; }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return 'Hanya URL publik http/https yang boleh dibuka.';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (RayOffice research agent)', Accept: 'text/html,application/json,text/plain' } });
    const type = res.headers.get('content-type') || '';
    const raw = (await res.text()).slice(0, 1_500_000);
    const text = /json|plain/.test(type) ? raw : raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    const title = raw.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || u.hostname;
    return `HTTP ${res.status} · ${title}\n${u.href}\n\n${text.slice(0, 9000)}`;
  } catch (err) { return `Gagal membuka ${u.href}: ${err.name === 'AbortError' ? 'timeout' : err.message}`; }
  finally { clearTimeout(timer); }
}

// ═════════════════════ MCP client (Streamable HTTP, JSON-RPC 2.0) ═════════════════════
const sessions = new Map(); // serverId -> { sid, initialized }
const toolCache = new Map(); // serverId -> { at, tools }
let rpcId = 0;
/** (P3) URL server MCP: ruang kerja pengguna publik tidak boleh mengarahkan server ini ke alamat lokal/privat/metadata awan (SSRF); lolos browser.checkUrl (termasuk DNS).
 *  Kantor utama (milik pemilik platform) boleh memakai MCP di komputernya sendiri, tetapi tetap tidak boleh ke metadata awan atau ke aplikasi ini sendiri. MCP_BLOCK_PRIVATE=1 memperketat juga untuk kantor utama. */
export async function assertMcpUrl(raw, wsId = store.current()) {
  let u; try { u = new URL(String(raw || '')); } catch { throw new Error('URL server MCP tidak valid.'); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error('URL server MCP harus http/https tanpa kredensial di alamat.');
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (wsId === 'main' && process.env.MCP_BLOCK_PRIVATE !== '1') {
    if (/^(169\.254\.|metadata\.google\.internal$|fd00:ec2::)/.test(host)) throw new Error('Alamat metadata awan tidak diizinkan untuk server MCP.');
    if (/^(localhost|127\.0\.0\.1|::1)$/.test(host) && Number(u.port || 80) === config.port()) throw new Error('Server MCP tidak boleh mengarah ke aplikasi ini sendiri.');
    return u.href;
  }
  const { checkUrl } = await import('./integrasi/browser.js');
  const r = await checkUrl(u.href, undefined, { resolve: true });
  if (!r.ok) throw new Error(`Server MCP ditolak: ${r.reason}`);
  return u.href;
}
async function rpc(server, method, params, notify = false) {
  await assertMcpUrl(server.url);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(server.headers || {}) };
  const s = sessions.get(store.current() + ':' + server.id);
  if (s?.sid) headers['mcp-session-id'] = s.sid;
  const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++rpcId, method, params };
  const res = await fetch(server.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessions.set(store.current() + ':' + server.id, { ...(sessions.get(store.current() + ':' + server.id) || {}), sid });
  if (notify) return null;
  if (!res.ok) throw new Error(`MCP ${server.name}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  let msg;
  if (type.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) if (line.startsWith('data:')) { try { const j = JSON.parse(line.slice(5)); if (j.id === body.id) msg = j; } catch { /* keep scanning */ } }
  } else msg = await res.json();
  if (!msg) throw new Error(`MCP ${server.name}: respons kosong`);
  if (msg.error) throw new Error(`MCP ${server.name}: ${msg.error.message}`);
  return msg.result;
}
async function ensureInit(server) {
  if (sessions.get(store.current() + ':' + server.id)?.initialized) return;
  await rpc(server, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ray-agent-office', version: '1.2.0' } });
  await rpc(server, 'notifications/initialized', {}, true).catch(() => {});
  sessions.set(store.current() + ':' + server.id, { ...(sessions.get(store.current() + ':' + server.id) || {}), initialized: true });
}
const servers = () => (db().settings.mcpServers || []).filter((s) => s.enabled !== false && s.url);
const toolName = (sid, name) => `mcp__${sid}__${name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
export async function mcpListTools(server, fresh = false) {
  const c = toolCache.get(store.current() + ':' + server.id);
  if (!fresh && c && Date.now() - c.at < 300000) return c.tools;
  await ensureInit(server);
  const r = await rpc(server, 'tools/list', {});
  const tools = r?.tools || [];
  toolCache.set(store.current() + ':' + server.id, { at: Date.now(), tools });
  return tools;
}
/** Tool definitions (Anthropic shape) for every configured MCP server; failures are skipped, not fatal. */
export async function mcpToolDefs() {
  const out = [];
  for (const s of servers()) {
    try {
      for (const t of (await mcpListTools(s)).slice(0, 40)) out.push({ name: toolName(s.id, t.name), description: `[MCP ${s.name}] ${clip(t.description || t.name, 900)}`, input_schema: t.inputSchema?.type === 'object' ? t.inputSchema : { type: 'object', properties: {} }, _mcp: { server: s.id, tool: t.name } });
    } catch (err) { console.warn('[mcp]', s.name, err.message); }
  }
  return out;
}
export async function mcpCall(name, args) {
  for (const s of servers()) {
    const tools = toolCache.get(store.current() + ':' + s.id)?.tools || [];
    const t = tools.find((x) => toolName(s.id, x.name) === name);
    if (!t) continue;
    await ensureInit(s);
    const r = await rpc(s, 'tools/call', { name: t.name, arguments: args || {} });
    const text = (r?.content || []).map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
    return `${r?.isError ? 'ERROR: ' : ''}${clip(text || JSON.stringify(r?.structuredContent || r), 9000)}`;
  }
  return `Tool MCP ${name} tidak ditemukan (server belum terhubung?).`;
}
export function resetMcp() { sessions.clear(); toolCache.clear(); }

// ═════════════════════ Google Workspace via free Apps Script ═════════════════════
const googleConfig = () => db().settings.googleAppsScript || {};
export const googleWorkspaceConfigured = () => {
  const c = googleConfig();
  try { const u = new URL(c.url); return c.enabled !== false && !!c.secret && /(^|\.)script\.google(?:usercontent)?\.com$/i.test(u.hostname); } catch { return false; }
};
export async function googleWorkspaceCall(action, payload = {}) {
  const c = googleConfig();
  if (!googleWorkspaceConfigured()) throw new Error('Konektor Google belum aktif. Isi URL Web App dan secret di Pengaturan → Google Workspace.');
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(c.url, { method: 'POST', redirect: 'follow', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, secret: c.secret, payload }) });
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`respons bukan JSON (HTTP ${res.status})`); }
    if (!res.ok || data.ok === false || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    const receipt = data.receipt || data;
    const proof = receipt.spreadsheetId || receipt.fileId || receipt.eventId || receipt.url;
    if (action !== 'status' && !proof) throw new Error('konektor tidak mengembalikan receipt/ID; eksekusi tidak dapat diverifikasi');
    return { ok: true, action, executedAt: Date.now(), receipt };
  } catch (err) { throw new Error(`Google Workspace gagal: ${err.name === 'AbortError' ? 'timeout' : err.message}`); }
  finally { clearTimeout(timer); }
}
