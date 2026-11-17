// Collaboration layer: real multi-agent meetings, colleague consultation, continual learning,
// cron scheduling, web page reading and an MCP (Model Context Protocol) client.
import fs from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import * as brain from './brain.js';
import * as llm from './llm.js';
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
export async function runMeeting({ topic, agenda = '', participantIds = [], representedParticipantIds = [], chairId, rounds = 2, originTaskId = null, ownerLed = false, ownerId = 'owner' }) {
  if (!llm.isLive()) throw new Error('Rapat multi-agen membutuhkan provider AI aktif (Groq/Claude)');
  const chair = emp(chairId) || emp(participantIds[0]) || emp('aria');
  // an agent sits in one meeting at a time (otherwise the first meeting to end would release them from the second)
  const busyIds = new Set(db().meetings.filter((x) => x.status === 'running' || x.status === 'waiting_owner').flatMap((x) => x.participants || []));
  const people = [...new Set([chair.id, ...participantIds])].map(emp).filter((e) => e && e.type === 'ai' && !busyIds.has(e.id)).slice(0, 25);
  if (!people.includes(chair)) throw new Error(`${chair.name} sedang ikut rapat lain. Tunggu rapat itu selesai.`);
  if (people.length < 2) throw new Error('Rapat butuh minimal 2 peserta AI');
  const id = store.uid('mtg');
  const represented = [...new Set(representedParticipantIds.length ? representedParticipantIds : people.map((p) => p.id))].filter((x) => emp(x)?.type === 'ai');
  const m = store.upsert('meetings', { id, topic: clip(topic, 160), agenda: clip(agenda, 2000), chairId: chair.id, participants: people.map((p) => p.id), representedParticipants: represented, ownerLed: !!ownerLed, ownerId, status: ownerLed ? 'waiting_owner' : 'running', transcript: [], minutes: '', actionItems: [], originTaskId, createdAt: Date.now() });
  store.upsert('channels', { id: `mtg-${id}`, kind: 'meeting', name: `Rapat: ${clip(topic, 60)}`, members: [...new Set([ownerId, ...m.participants])], meetingId: id, topic: agenda });
  for (const p of people) { p.meetingUntil = Date.now() + (ownerLed ? 125 : 10) * 60000; engine.setStatus(p, 'meeting', ownerLed ? 'Mendengarkan Owner' : `Rapat: ${clip(topic, 40)}`, p.currentTaskId); }
  engine.event('meeting', chair.id, `${chair.name} memulai rapat "${clip(topic, 70)}" dengan ${people.filter((p) => p !== chair).map((p) => p.name).join(', ')}`, { participants: m.participants, meetingId: id });
  const say = (p, text) => {
    const nm = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = String(text).replace(new RegExp('^\\s*\\**\\s*' + nm + '\\s*(\\([^)]*\\))?\\s*:\\s*\\**\\s*', 'i'), '').trim() || text; // drop only the speaker's own "**Name (Role):**" echo, not any "Usulan saya:" prefix
    m.transcript.push({ t: Date.now(), speakerId: p.id, text });
    store.upsert('meetings', m);
    engine.postMessage(`mtg-${id}`, p.id, text, { meetingId: id });
    engine.event('meeting_say', p.id, text, { meetingId: id });
  };
  m.originTaskId = originTaskId; m.startedAt = m.startedAt || Date.now(); store.upsert('meetings', m);
  try {
    await wait(db().settings.meetingGatherMs ?? 9000); // let everyone walk to the Conference Hall
    if (ownerLed) {
      engine.event('meeting_waiting', chair.id, `Peserta rapat "${clip(topic, 60)}" diam dan mendengarkan Owner`, { participants: m.participants, meetingId: id });
      const deadline = Date.now() + 2 * 3600e3;
      while (!m.ownerFinishedAt && Date.now() < deadline) await wait(750);
      if (!m.ownerFinishedAt) {
        m.status = 'paused'; m.pauseReason = 'Owner belum menyatakan selesai berbicara dalam 2 jam'; store.upsert('meetings', m);
        return m;
      }
      m.status = 'running'; store.upsert('meetings', m);
      for (const p of people) { p.meetingUntil = Date.now() + 15 * 60000; engine.setStatus(p, 'meeting', `Rapat: ${clip(topic, 40)}`, p.currentTaskId); }
    }
    say(chair, `Rapat dimulai. Topik: **${topic}**${agenda ? `\nAgenda: ${agenda}` : ''}\nSilakan masing-masing menyampaikan pandangan dari sisi peran kalian.`);
    const effectiveRounds = people.length > 12 ? 1 : Math.min(3, Math.max(1, rounds));
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
    const ids = db().employees.filter((e) => e.type === 'ai').map((e) => e.id);
    let out = await llm.json({
      system: briefPrompt(chair) + '\nKamu memimpin rapat ini dan menulis notulen resmi.',
      prompt: `Transkrip rapat "${topic}":\n${m.transcript.map((x) => `${emp(x.speakerId)?.name}: ${x.text}`).join('\n')}\n\nTulis notulen: ringkasan, keputusan, dan action item (maks 3, hanya yang benar-benar perlu dan sesuai topik; jangan menciptakan proyek baru) dengan penanggung jawab dari peserta rapat atau karyawan lain yang paling cocok.`,
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
    for (const p of people) brain.remember(p, `Ikut rapat "${clip(topic, 60)}": ${clip(out.summary, 140)}`);
    return m;
  } catch (err) {
    m.status = 'failed'; m.error = err.message; store.upsert('meetings', m);
    engine.event('alert', chair.id, `Rapat "${clip(topic, 50)}" gagal: ${clip(err.message, 120)}`, { meetingId: id });
    throw err;
  } finally {
    for (const p of people) { delete p.meetingUntil; engine.setStatus(p, p.currentTaskId ? 'working' : 'idle', p.currentTaskId ? 'Kembali bekerja' : 'Siap bekerja', p.currentTaskId); }
  }
}

/** Keep an owner-led meeting silent until the owner explicitly yields the floor. */
export function handleOwnerMeetingMessage(msg) {
  const ch = db().channels.find((c) => c.id === msg.channelId && c.kind === 'meeting');
  const m = ch && db().meetings.find((x) => x.id === ch.meetingId);
  if (!m || m.status !== 'waiting_owner' || msg.authorId !== m.ownerId) return false;
  if (!/\bbelum\s+selesai\b/i.test(msg.text) && /(?:^|\b)(?:saya\s+)?(?:sudah\s+)?selesai(?:\s+bicara)?(?:\b|$)|silakan\s+(?:mulai|tanggapi|diskusi)|\/selesai/i.test(msg.text)) {
    m.ownerFinishedAt = Date.now();
    store.upsert('meetings', m);
    engine.event('meeting_owner_done', m.chairId, 'Owner selesai berbicara; peserta mulai menanggapi', { meetingId: m.id });
  }
  return true;
}

// ═════════════════════ consult a colleague ═════════════════════
export async function askColleague(asker, targetId, question) {
  const target = emp(targetId);
  if (!target) return `Karyawan "${targetId}" tidak ditemukan.`;
  if (target.id === asker.id) return 'Tidak bisa bertanya ke diri sendiri.';
  const ch = engine.ensureDM(asker.id, target.id);
  engine.postMessage(ch, asker.id, question);
  engine.event('message', asker.id, `${asker.name} → ${target.name}: ${clip(question, 90)}`, { targetId: target.id, channelId: ch });
  if (target.type !== 'ai') return `${target.name} adalah manusia; pertanyaan sudah dikirim lewat DM dan akan dijawab manual.`;
  const prev = { status: target.status, text: target.statusText };
  if (target.status === 'idle') engine.setStatus(target, 'chatting', `Menjawab ${asker.name}`);
  try {
    const res = await llm.call({ system: briefPrompt(target), maxTokens: 900, effort: 'low', employee: target, model: llm.defaultModels().small,
      messages: [{ role: 'user', content: `${asker.name} (${asker.title}) bertanya kepadamu:\n${question}\n\nJawab sebagai ahli di bidangmu, maksimal 150 kata, beri rekomendasi konkret.` }] });
    const answer = clip(llm.textOf(res) || 'Belum bisa menjawab.', 1500);
    engine.postMessage(ch, target.id, answer);
    engine.event('message', target.id, `${target.name} → ${asker.name}: ${clip(answer, 90)}`, { targetId: asker.id, channelId: ch });
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
    const dir = path.join(process.env.DATA_DIR || path.resolve('data'), 'training');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${e.id}.jsonl`), JSON.stringify({ messages: [{ role: 'system', content: systemText }, { role: 'user', content: userText }, { role: 'assistant', content: t.output }] }) + '\n');
    e.stats.trainingExamples = (e.stats.trainingExamples || 0) + 1;
  } catch (err) { console.warn('[training]', err.message); }
}
export function trainingFile(id) { return path.join(process.env.DATA_DIR || path.resolve('data'), 'training', `${id}.jsonl`); }

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
async function rpc(server, method, params, notify = false) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(server.headers || {}) };
  const s = sessions.get(server.id);
  if (s?.sid) headers['mcp-session-id'] = s.sid;
  const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++rpcId, method, params };
  const res = await fetch(server.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessions.set(server.id, { ...(sessions.get(server.id) || {}), sid });
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
  if (sessions.get(server.id)?.initialized) return;
  await rpc(server, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ray-agent-office', version: '1.2.0' } });
  await rpc(server, 'notifications/initialized', {}, true).catch(() => {});
  sessions.set(server.id, { ...(sessions.get(server.id) || {}), initialized: true });
}
const servers = () => (db().settings.mcpServers || []).filter((s) => s.enabled !== false && s.url);
const toolName = (sid, name) => `mcp__${sid}__${name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
export async function mcpListTools(server, fresh = false) {
  const c = toolCache.get(server.id);
  if (!fresh && c && Date.now() - c.at < 300000) return c.tools;
  await ensureInit(server);
  const r = await rpc(server, 'tools/list', {});
  const tools = r?.tools || [];
  toolCache.set(server.id, { at: Date.now(), tools });
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
    const tools = toolCache.get(s.id)?.tools || [];
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
