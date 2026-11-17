// Procedural sound: no audio files. A calm generative music bed (slow pads + soft bells through a reverb and echo), a faint ambience,
// and short synthesized effects. Master, music and effects can each be switched off, and the volume is adjustable; everything is remembered.
// Cost: about ten audio nodes while running; the context is suspended when everything is off or when the tab is hidden.
let ctx = null, master = null, fxBus = null, musicBus = null, musicIn = null, melBus = null, bed = null, humG = null, started = false, lastAt = {}, sparkT = 0, timer = 0;
const S = { on: true, music: true, fx: true, vol: 0.7 };
try { Object.assign(S, JSON.parse(localStorage.getItem('office-audio') || '{}')); if (localStorage.getItem('office-sound') === '0') S.on = false; } catch { /* defaults */ }
const save = () => { try { localStorage.setItem('office-audio', JSON.stringify(S)); localStorage.setItem('office-sound', S.on ? '1' : '0'); } catch { /* ignore */ } };
const apply = () => {
  if (!ctx) return; const t = ctx.currentTime;
  master.gain.setTargetAtTime(S.on ? S.vol : 0, t, 0.12); musicBus.gain.setTargetAtTime(S.music ? 0.9 : 0, t, 0.5); fxBus.gain.setTargetAtTime(S.fx ? 0.4 : 0, t, 0.08);   /* effects sit well under the music bed (were 1.0 and masked it) */
};

const mk = () => {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
  ctx = new C(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  fxBus = ctx.createGain(); fxBus.connect(master); musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  // faint air bed
  bed = ctx.createGain(); bed.gain.value = 0.03; bed.connect(fxBus);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0); let b0 = 0; for (let i = 0; i < d.length; i++) { b0 = 0.97 * b0 + (Math.random() * 2 - 1) * 0.03; d[i] = b0 * 3; }
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.5; ns.connect(bp).connect(bed); ns.start();
  // brain hum, louder near the core
  const hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 164.8; humG = ctx.createGain(); humG.gain.value = 0; const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 700; hum.connect(humG).connect(hl).connect(fxBus); hum.start();
  // music chain: reverb (generated impulse) + a slow echo for the bells
  musicIn = ctx.createGain(); musicIn.gain.value = 0.9; musicIn.connect(musicBus);
  const rl = Math.floor(ctx.sampleRate * 3.4), ib = ctx.createBuffer(2, rl, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const dd = ib.getChannelData(c); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.4); }
  const conv = ctx.createConvolver(); conv.buffer = ib; const wet = ctx.createGain(); wet.gain.value = 0.7; musicIn.connect(conv); conv.connect(wet).connect(musicBus);
  melBus = ctx.createGain(); melBus.gain.value = 1; melBus.connect(musicIn);
  const del = ctx.createDelay(2); del.delayTime.value = 0.62; const fb = ctx.createGain(); fb.gain.value = 0.34; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
  melBus.connect(del); del.connect(dl).connect(fb).connect(del); dl.connect(musicIn);
  return true;
};

// ── generative music: a four-chord loop, each chord nine seconds, with sparse pentatonic bells
const CHORDS = [[130.81, 164.81, 196, 246.94], [110, 130.81, 164.81, 196], [87.31, 130.81, 164.81, 220], [98, 146.83, 196, 246.94]];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7];
let chordIdx = 0, nextChord = 0, nextBell = 0;
const pad = (f, t0, dur, vol) => {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.3;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 3.2); g.gain.setValueAtTime(vol, t0 + dur - 1.2); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 3.5);
  lp.connect(g).connect(musicIn);
  for (const [mul, type, det, v] of [[1, 'sine', -4, 1], [1, 'triangle', 5, 0.35], [2, 'sine', 3, 0.18]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = det; const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(lp); o.start(t0); o.stop(t0 + dur + 3.7); }
};
const bell = (f, t0, vol) => {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6); g.connect(melBus);
  for (const [mul, v] of [[1, 1], [2.01, 0.25], [3.99, 0.08]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul; const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(g); o.start(t0); o.stop(t0 + 2.7); }
};
const schedule = () => {
  if (!ctx || ctx.state !== 'running' || !S.on || !S.music) return;
  const now = ctx.currentTime;
  while (nextChord < now + 1.5) {
    if (nextChord < now) nextChord = now + 0.1;
    const ch = CHORDS[chordIdx % CHORDS.length]; ch.forEach((f, i) => pad(f, nextChord + i * 0.18, 9, 0.034));
    pad(ch[0] / 2, nextChord, 9, 0.05); chordIdx++; nextChord += 9;
  }
  while (nextBell < now + 1.5) {
    if (nextBell < now) nextBell = now + 0.2;
    if (Math.random() > 0.28) bell(BELLS[(Math.random() * BELLS.length) | 0], nextBell, 0.04 + Math.random() * 0.025);
    nextBell += 1.3 + Math.random() * 3.2;
  }
};

const out = () => fxBus;
const tone = (f, dur = 0.3, type = 'sine', vol = 0.15, slide = 0, delay = 0) => {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out()); o.start(t); o.stop(t + dur + 0.05);
};
const air = (dur = 0.5, f0 = 400, f1 = 3000, vol = 0.12) => {
  const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(out()); s.start(t);
};
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5 };
const FX = {
  task: () => { tone(N.E5, 0.35, 'sine', 0.13); tone(N.B5, 0.5, 'sine', 0.12, 0, 0.1); tone(N.E6, 0.7, 'triangle', 0.05, 0, 0.2); },
  brain: () => { tone(110, 1.1, 'sine', 0.07, 3.2); tone(N.E6, 1.0, 'sine', 0.025, 0, 0.12); tone(N.B5, 0.8, 'triangle', 0.03, 0, 0.18); air(0.9, 200, 2600, 0.03); },
  absorb: () => { tone(330, 0.5, 'sine', 0.1, 2); tone(N.A5, 0.6, 'sine', 0.07, 0, 0.08); },
  done: () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, 0, i * 0.075)); },
  ask: () => { tone(N.A5, 0.18, 'sine', 0.1); tone(N.A5, 0.25, 'sine', 0.1, 0, 0.2); },
  approved: () => { [N.G5, N.B5, N.D5 * 2].forEach((f, i) => tone(f, 0.45, 'sine', 0.1, 0, i * 0.09)); },
  alert: () => { tone(150, 0.35, 'sawtooth', 0.07, 0.6); tone(120, 0.4, 'sawtooth', 0.06, 0.6, 0.18); },
  msg: () => tone(660 + Math.random() * 120, 0.09, 'sine', 0.05, 1.3),
  meeting: () => { tone(196, 2.2, 'sine', 0.16); tone(392.5, 1.6, 'sine', 0.07); tone(590, 1.2, 'sine', 0.04); },
  jump: () => air(0.25, 300, 1400, 0.05),
  hire: () => { [N.C5, N.G5].forEach((f, i) => tone(f, 0.5, 'triangle', 0.09, 0, i * 0.12)); },
  click: () => tone(520, 0.06, 'square', 0.03, 0.7),
  sit: () => { tone(190, 0.12, 'sine', 0.06, 0.7); air(0.18, 200, 700, 0.03); },
  splash: () => { air(0.5, 1500, 5000, 0.04); tone(900, 0.2, 'sine', 0.03, 1.5); },
  pop: () => tone(740, 0.1, 'sine', 0.07, 1.6),
  rec: () => { tone(1320, 0.12, 'square', 0.03); tone(1320, 0.12, 'square', 0.03, 0, 0.2); },
  step: () => tone(140, 0.05, 'sine', 0.025),
};
const GAP = { msg: 450, absorb: 250, task: 350, jump: 200, click: 60, pop: 120, step: 300 };

export const sfx = {
  /** must be called from a user gesture the first time */
  init() { if (started) { ctx?.resume?.(); return; } started = true; if (!mk()) return; apply(); ctx.resume(); if (!timer) timer = setInterval(schedule, 400); },
  state: () => ({ ...S }),
  isOn: () => S.on,
  set(patch) { Object.assign(S, patch); save(); if (!started) this.init(); apply(); if (S.on && ctx?.state === 'suspended') ctx.resume(); return { ...S }; },
  toggle() { this.set({ on: !S.on }); return S.on; },
  play(name) {
    if (!ctx || !S.on || !S.fx || ctx.state !== 'running') return;
    const now = performance.now(); if (now - (lastAt[name] || 0) < (GAP[name] || 80)) return; lastAt[name] = now;
    FX[name]?.();
  },
  /** 0..1: how close the listener is to the Company Brain */
  brain(level) { if (humG && ctx) humG.gain.setTargetAtTime(S.on && S.fx ? level * 0.025 : 0, ctx.currentTime, 0.3); },
  /** a soft sparkle now and then; called from the frame loop with the time in seconds */
  tick(t) { if (!ctx || !S.on || !S.fx || ctx.state !== 'running' || t < sparkT) return; sparkT = t + 6 + Math.random() * 10; tone([N.E6, N.B5 * 2, N.G5 * 2][(Math.random() * 3) | 0], 2.4, 'sine', 0.01); },
  pause(p) { if (ctx) p ? ctx.suspend() : ctx.resume(); },
};
addEventListener('pointerdown', () => sfx.init(), { once: true, passive: true });
addEventListener('keydown', () => sfx.init(), { once: true, passive: true });
document.addEventListener('visibilitychange', () => sfx.pause(document.hidden));
