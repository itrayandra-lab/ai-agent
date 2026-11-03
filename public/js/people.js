// Realistic low-poly people with a simple two-joint rig. Every person is unique (derived from their id):
// body shape, skin tone, hair style (incl. hijab), outfit by role, accessories. AI staff wear a glowing earpiece + ID badge.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const mats = new Map();
const mat = (c, o) => { const k = c + JSON.stringify(o || {}); if (!mats.has(k)) mats.set(k, std(c, o)); return mats.get(k); };
const SKINS = [0xf3d2b8, 0xe7b995, 0xd29e76, 0xb27a54, 0x8c5a3a, 0x6b4128];
const HAIRS = [0x1b1411, 0x2e1f17, 0x4a3022, 0x6b4a2e, 0x0d0d0f, 0x8a6a4a, 0xb7b0a6];
const PANTS = [0x1f2a3d, 0x2b2d31, 0x6e6352, 0x1a1a1c, 0x3b4b63, 0x7d7469];
const SHOES = [0xf2f2f0, 0x1a1a1a, 0x5a3b26, 0x2b2b2b];
const NEUTRAL_TOPS = [0xf4f2ee, 0x2c3e57, 0x8b9aa8, 0xc9b89f, 0x3d3d40, 0xe6d8c3];
const HIJAB = [0x3d4a5c, 0xc49a8a, 0x8a6f5a, 0x2f2f33, 0xe6d6c6, 0x6d7f72];

function hash(id) {
  let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const G = {};
const geo = (k, make) => G[k] || (G[k] = make());
function lathe(profile, seg = 14) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

export function traitsFor(e) {
  const r = hash(e.id);
  const ap = e.appearance || {};
  const rf = r();
  const fem = ap.gender ? ap.gender === 'female' : rf < 0.48;
  const t = {
    fem, height: (fem ? 0.94 : 0.99) + r() * 0.08, build: (fem ? 0.9 : 0.97) + r() * 0.12,
    skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)],
    hairStyle: fem ? pick(r, ['long', 'bob', 'bun', 'ponytail', 'hijab', 'hijab', 'long', 'curly']) : pick(r, ['crop', 'side', 'crop', 'curly', 'bald', 'side', 'quiff']),
    beard: !fem && r() < 0.25, glasses: r() < 0.28, skirt: fem && r() < 0.3,
    pants: pick(r, PANTS), shoes: pick(r, SHOES), neutral: pick(r, NEUTRAL_TOPS), hijab: pick(r, HIJAB), toneShift: r(),
  };
  // explicit appearance (e.g. the player's chosen character) overrides the generated look
  if (ap.hairStyle) t.hairStyle = ap.hairStyle;
  if (ap.skin != null) t.skin = SKINS[ap.skin] ?? t.skin;
  if (ap.hair != null) t.hair = HAIRS[ap.hair] ?? t.hair;
  if (ap.skirt != null) t.skirt = !!ap.skirt && fem;
  if (ap.glasses != null) t.glasses = !!ap.glasses;
  if (!fem) { t.skirt = false; if (['long', 'bob', 'bun', 'ponytail', 'hijab'].includes(t.hairStyle) && !ap.hairStyle) t.hairStyle = 'side'; }
  else { t.beard = false; if (['crop', 'quiff', 'bald'].includes(t.hairStyle) && !ap.hairStyle) t.hairStyle = 'long'; }
  return t;
}
export const LOOKS = { SKINS, HAIRS, female: ['long', 'bob', 'bun', 'ponytail', 'hijab', 'curly'], male: ['crop', 'side', 'quiff', 'curly', 'bald'] };

// ───── expressive face: one decal per head, expressions painted on shared canvas textures (cheap: swap the map)
const FACE = new Map();
const EXPR = ['neutral', 'smile', 'laugh', 'talk1', 'talk2', 'sad', 'surprised', 'focus', 'sleepy', 'love'];
export function faceTexture(expr, blink, browHex, fem) {
  const key = `${expr}|${blink}|${browHex}|${fem}`;
  if (FACE.has(key)) return FACE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const brow = '#' + new THREE.Color(browHex).multiplyScalar(0.8).getHexString();
  const ex = [64 - 30, 64 + 30], ey = 46, my = 104;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // cheeks
  if (['smile', 'laugh', 'love'].includes(expr) || fem) { g.fillStyle = expr === 'neutral' || expr === 'focus' ? 'rgba(220,110,110,0.10)' : 'rgba(225,105,105,0.28)'; for (const x of ex) { g.beginPath(); g.ellipse(x + (x < 64 ? -4 : 4), ey + 26, 12, 7, 0, 0, Math.PI * 2); g.fill(); } }
  // brows
  g.strokeStyle = brow; g.lineWidth = 5;
  for (const [i, x] of ex.entries()) {
    const inner = i ? -1 : 1; // direction toward the centre of the face
    let y = ey - 19, innerDy = 0;
    if (expr === 'surprised') y -= 6;
    if (expr === 'sad') innerDy = -6;
    if (expr === 'focus') { innerDy = 4; y += 1; }
    if (expr === 'laugh' || expr === 'love') y -= 2;
    g.beginPath(); g.moveTo(x - inner * 10, y + 1); g.quadraticCurveTo(x, y - 4, x + inner * 10, y + innerDy); g.stroke();
  }
  // eyes
  const closed = blink || expr === 'laugh';
  for (const x of ex) {
    if (expr === 'love') { g.fillStyle = '#d6455e'; g.beginPath(); g.moveTo(x, ey + 7); g.bezierCurveTo(x - 12, ey - 2, x - 6, ey - 11, x, ey - 4); g.bezierCurveTo(x + 6, ey - 11, x + 12, ey - 2, x, ey + 7); g.fill(); continue; }
    if (closed) { g.strokeStyle = '#1d1512'; g.lineWidth = 3.6; g.beginPath(); if (expr === 'laugh') { g.moveTo(x - 8, ey + 3); g.quadraticCurveTo(x, ey - 7, x + 8, ey + 3); } else { g.moveTo(x - 8, ey); g.quadraticCurveTo(x, ey + 5, x + 8, ey); } g.stroke(); continue; }
    const big = expr === 'surprised' ? 1.25 : expr === 'sleepy' ? 0.85 : 1;
    g.fillStyle = '#fbf8f3'; g.beginPath(); g.ellipse(x, ey, 8.5 * big, 7 * big, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1d16'; g.beginPath(); g.ellipse(x, ey + 0.5, 5.2 * big, 6 * big, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0907'; g.beginPath(); g.arc(x, ey + 0.5, 2.6 * big, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(x + 1.8, ey - 2, 1.6, 0, Math.PI * 2); g.fill();
    if (expr === 'sleepy') { g.fillStyle = 'rgba(0,0,0,0)'; g.strokeStyle = '#1d1512'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, ey - 1); g.lineTo(x + 9, ey - 1); g.stroke(); }
    g.strokeStyle = '#1d1512'; g.lineWidth = fem ? 2.6 : 1.8; g.beginPath(); g.ellipse(x, ey, 8.5 * big, 7 * big, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    if (fem) { g.beginPath(); const s = x < 64 ? -1 : 1; g.moveTo(x + s * 8, ey - 3); g.lineTo(x + s * 12, ey - 6); g.stroke(); }
  }
  // mouth
  const lip = fem ? '#b2545a' : '#7a3b36';
  g.strokeStyle = lip; g.fillStyle = '#5a1f22'; g.lineWidth = 3.4;
  const open = (w, h, teeth) => { g.beginPath(); g.ellipse(64, my, w, h, 0, 0, Math.PI * 2); g.fill(); if (teeth) { g.fillStyle = '#f6f2ec'; g.fillRect(64 - w * 0.7, my - h + 1, w * 1.4, h * 0.45); } g.fillStyle = '#c96a6a'; g.beginPath(); g.ellipse(64, my + h * 0.55, w * 0.55, h * 0.3, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = lip; g.lineWidth = 2.2; g.beginPath(); g.ellipse(64, my, w, h, 0, 0, Math.PI * 2); g.stroke(); };
  if (expr === 'neutral' || expr === 'focus' || expr === 'sleepy') { g.beginPath(); g.moveTo(52, my); g.quadraticCurveTo(64, my + (expr === 'neutral' ? 3 : 0.5), 76, my); g.stroke(); }
  else if (expr === 'smile' || expr === 'love') { g.beginPath(); g.moveTo(48, my - 4); g.quadraticCurveTo(64, my + 10, 80, my - 4); g.stroke(); }
  else if (expr === 'laugh') { g.beginPath(); g.moveTo(46, my - 6); g.quadraticCurveTo(64, my + 18, 82, my - 6); g.closePath(); g.fill(); g.fillStyle = '#f6f2ec'; g.fillRect(52, my - 5, 24, 4); g.strokeStyle = lip; g.stroke(); }
  else if (expr === 'talk1') open(9, 7, true);
  else if (expr === 'talk2') open(6, 3.5, false);
  else if (expr === 'surprised') open(6, 7.5, false);
  else if (expr === 'sad') { g.beginPath(); g.moveTo(50, my + 4); g.quadraticCurveTo(64, my - 6, 78, my + 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.08, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  FACE.set(key, m);
  return m;
}
export { EXPR };

/** Builds the person. Returns rig parts used by the office animator. */
export function makePerson(e, divisionHex, add) {
  const T = traitsFor(e);
  const human = e.type === 'human';
  const role = e.divisionId;
  const skin = mat(T.skin, { roughness: 0.6 });
  const hair = mat(T.hair, { roughness: 0.85 });
  const div = new THREE.Color(divisionHex);
  // outfit: leaders wear blazers, lab/QA wear lab coats, factory wears coveralls, others smart-casual in division tones
  const tone = div.clone().lerp(new THREE.Color(T.neutral), 0.35 + T.toneShift * 0.3);
  let top = mat(tone.getHex(), { roughness: 0.8 });
  let outfit = 'casual';
  if (e.isLead || e.isMaster || e.isPA || human) { outfit = 'blazer'; top = mat(T.toneShift < 0.5 ? 0x24324a : 0x2b2b2f, { roughness: 0.7 }); }
  if (role === 'rnd' || role === 'qa') { outfit = 'labcoat'; top = mat(0xf5f6f4, { roughness: 0.65 }); }
  if (role === 'mfg' || role === 'scm') { outfit = 'coverall'; top = mat(role === 'mfg' ? 0x2f4d6e : 0x4b5d3a, { roughness: 0.85 }); }
  const pants = outfit === 'coverall' ? top : mat(T.pants, { roughness: 0.85 });
  const shoes = mat(T.shoes, { roughness: 0.5 });
  const shirt = outfit === 'blazer' || outfit === 'labcoat' ? mat(tone.getHex(), { roughness: 0.8 }) : top;

  const g = new THREE.Group();
  const body = new THREE.Group(); body.scale.set(T.build, T.height, T.build); g.add(body);
  const w = T.fem ? 0.92 : 1;
  // torso (lathe: waist → chest → shoulders), elliptical in depth
  // anatomy: smoother lathe torso with waist, ribcage, chest and sloped shoulders; trapezius + deltoids blend into the arms
  const torsoGeo = geo(`torso${T.fem}`, () => { const p = T.fem ? [[0.0, 0.93], [0.128, 0.94], [0.122, 0.99], [0.112, 1.05], [0.122, 1.12], [0.148, 1.2], [0.158, 1.27], [0.152, 1.33], [0.16, 1.39], [0.135, 1.44], [0.09, 1.475], [0.05, 1.5]] : [[0.0, 0.93], [0.142, 0.94], [0.146, 1.0], [0.15, 1.07], [0.162, 1.15], [0.18, 1.24], [0.192, 1.32], [0.198, 1.39], [0.17, 1.445], [0.11, 1.48], [0.055, 1.505]]; const gg = lathe(p, 20); gg.scale(1, 1, 0.6); return gg; });
  const torso = add(new THREE.Mesh(torsoGeo, outfit === 'blazer' ? top : outfit === 'labcoat' ? top : shirt), 0, 0, 0, body);
  if (outfit === 'blazer' || outfit === 'labcoat') {
    // shirt "V" visible at the front + lapels
    add(new THREE.Mesh(geo('vee', () => new THREE.ConeGeometry(0.07, 0.22, 3)), shirt), 0, 1.36, 0.105, body, { cast: false }).rotation.set(Math.PI, 0, 0);
    if (outfit === 'labcoat') add(new THREE.Mesh(geo('coatTail', () => { const gg = lathe([[0.17, 0.62], [0.165, 0.8], [0.155, 0.95]], 12); gg.scale(1.02, 1, 0.66); return gg; }), top), 0, 0, 0, body);
  }
  if (outfit === 'coverall') add(new THREE.Mesh(geo('belt', () => new THREE.TorusGeometry(0.145, 0.018, 6, 20)), mat(0x1c1c1c)), 0, 0.97, 0, body, { cast: false }).scale.set(1, 0.62, 1);
  // pelvis / hips or skirt
  if (T.skirt) add(new THREE.Mesh(geo('skirt', () => { const gg = lathe([[0.135, 0.98], [0.16, 0.85], [0.2, 0.6]], 14); gg.scale(1, 1, 0.75); return gg; }), mat(tone.clone().offsetHSL(0, -0.1, -0.15).getHex())), 0, 0, 0, body);
  else add(new THREE.Mesh(geo(`hips${T.fem}`, () => { const gg = new THREE.SphereGeometry(0.155, 14, 10); gg.scale(1.05 * w, 0.75, 0.72); return gg; }), pants), 0, 0.9, 0, body);
  for (const sx of [-1, 1]) add(new THREE.Mesh(geo(`trap${T.fem}`, () => { const gg = new THREE.SphereGeometry(0.075, 12, 8); gg.scale(1.3, 0.55, 0.85); return gg; }), outfit === 'casual' ? shirt : top), sx * 0.09 * w, 1.455, -0.01, body, { cast: false });
  // neck (own joint so the head can nod/tilt naturally) + head
  const neck = new THREE.Group(); neck.position.set(0, 1.5, 0); body.add(neck);
  add(new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.042, 0.052, 0.12, 12)), skin), 0, 0.03, 0, neck, { cast: false });
  const head = new THREE.Group(); head.position.set(0, 0.14, 0.005); neck.add(head);
  add(new THREE.Mesh(geo('head', () => { const gg = new THREE.SphereGeometry(0.105, 22, 16); gg.scale(0.9, 1.12, 1); return gg; }), skin), 0, 0, 0, head);
  add(new THREE.Mesh(geo(`jaw${T.fem}`, () => { const gg = new THREE.SphereGeometry(0.075, 14, 10); gg.scale(T.fem ? 0.92 : 1.02, 0.72, 0.95); return gg; }), skin), 0, -0.058, 0.02, head, { cast: false });
  for (const sx of [-1, 1]) add(new THREE.Mesh(geo('cheek', () => { const gg = new THREE.SphereGeometry(0.032, 10, 8); gg.scale(1, 0.8, 0.7); return gg; }), skin), sx * 0.05, -0.02, 0.07, head, { cast: false });
  add(new THREE.Mesh(geo('nose', () => { const gg = new THREE.ConeGeometry(0.015, 0.042, 8); gg.rotateX(Math.PI / 2); return gg; }), skin), 0, -0.01, 0.103, head, { cast: false });
  for (const sx of [-1, 1]) add(new THREE.Mesh(geo('ear', () => { const gg = new THREE.SphereGeometry(0.021, 10, 8); gg.scale(0.45, 1, 0.8); return gg; }), skin), sx * 0.094, 0.0, 0, head, { cast: false });
  // painted face decal (eyes, brows, mouth) — swapped per expression by the animator
  const faceGeo = geo('face', () => { const gg = new THREE.SphereGeometry(0.1062, 22, 14, Math.PI / 2 - 0.62, 1.24, 1.0, 1.1); gg.scale(0.9, 1.12, 1); return gg; });
  const face = add(new THREE.Mesh(faceGeo, faceTexture('neutral', false, T.hair, T.fem)), 0, 0, 0.002, head, { cast: false, receive: false });
  face.userData.keep = true; face.renderOrder = 2;
  // hair styles
  const capGeo = geo('hairCap', () => { const gg = new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); gg.scale(0.94, 1.12, 1.04); return gg; });
  const hs = T.hairStyle;
  if (hs === 'hijab') {
    const hj = mat(T.hijab, { roughness: 0.9 });
    // hijab frames the face: wraps sides/back, a forehead band on top, the face stays open
    add(new THREE.Mesh(geo('hijabHead', () => { const gg = new THREE.SphereGeometry(0.122, 20, 14, Math.PI / 2 + 0.72, Math.PI * 2 - 1.44, 0, Math.PI * 0.8); gg.scale(0.95, 1.14, 1.04); return gg; }), hj), 0, 0.005, -0.008, head);
    add(new THREE.Mesh(geo('hijabTop', () => { const gg = new THREE.SphereGeometry(0.122, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.3); gg.scale(0.95, 1.14, 1.04); return gg; }), hj), 0, 0.005, -0.008, head);
    add(new THREE.Mesh(geo('hijabDrape', () => { const gg = lathe([[0.12, 0.1], [0.16, 0.0], [0.24, -0.16]], 16); gg.scale(1, 1, 0.8); return gg; }), hj), 0, -0.13, -0.01, head);
    head.children.filter((m) => m.geometry === G.ear).forEach((m) => (m.visible = false));
    face.position.z = 0.004;
  } else if (hs !== 'bald') {
    add(new THREE.Mesh(capGeo, hair), 0, 0.012, -0.008, head);
    if (hs === 'long' || hs === 'bob') add(new THREE.Mesh(geo(`hairBack${hs}`, () => new RoundedBoxGeometry(0.21, hs === 'long' ? 0.32 : 0.16, 0.08, 2, 0.03)), hair), 0, hs === 'long' ? -0.1 : -0.03, -0.07, head);
    if (hs === 'long') for (const sx of [-1, 1]) add(new THREE.Mesh(geo('hairSide', () => new RoundedBoxGeometry(0.04, 0.26, 0.1, 2, 0.015)), hair), sx * 0.095, -0.08, 0, head);
    if (hs === 'bun') add(new THREE.Mesh(geo('bun', () => new THREE.SphereGeometry(0.05, 10, 8)), hair), 0, 0.09, -0.1, head);
    if (hs === 'ponytail') add(new THREE.Mesh(geo('pony', () => new THREE.CapsuleGeometry(0.03, 0.16, 4, 8)), hair), 0, -0.04, -0.13, head).rotation.x = 0.35;
    if (hs === 'curly') for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; add(new THREE.Mesh(geo('curl', () => new THREE.SphereGeometry(0.042, 8, 6)), hair), Math.sin(a) * 0.085, 0.06 + Math.cos(a * 2) * 0.02, Math.cos(a) * 0.08 - 0.01, head, { cast: false }); }
    if (hs === 'side' || hs === 'quiff') add(new THREE.Mesh(geo(`fore${hs}`, () => new RoundedBoxGeometry(0.15, 0.04, 0.07, 2, 0.015)), hair), hs === 'side' ? 0.02 : 0, 0.1, 0.06, head, { cast: false }).rotation.z = hs === 'side' ? -0.25 : 0;
  }
  if (T.beard) add(new THREE.Mesh(geo('beard', () => { const gg = new THREE.SphereGeometry(0.078, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55); gg.scale(1, 0.9, 1); return gg; }), hair), 0, -0.04, 0.012, head, { cast: false });
  if (T.glasses) { const fr = mat(0x111111, { roughness: 0.3 }); for (const sx of [-1, 1]) add(new THREE.Mesh(geo('lens', () => new THREE.TorusGeometry(0.02, 0.004, 6, 14)), fr), sx * 0.036, 0.022, 0.104, head, { cast: false }); add(new THREE.Mesh(geo('bridge', () => new THREE.BoxGeometry(0.03, 0.004, 0.004)), fr), 0, 0.024, 0.106, head, { cast: false }); }
  // AI tells: glowing earpiece + chest ID badge (humans get a plain lanyard badge)
  const glow = new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: divisionHex, emissiveIntensity: 1.8 });
  let visor = null;
  if (!human) { visor = add(new THREE.Mesh(geo('earpiece', () => new THREE.SphereGeometry(0.018, 8, 6)), glow), 0.1, -0.005, 0.015, head, { cast: false }); }
  add(new THREE.Mesh(geo('badge', () => new THREE.BoxGeometry(0.05, 0.07, 0.006)), human ? mat(0xf5f5f5) : glow), 0.075, 1.27, 0.115, body, { cast: false });
  // limbs: shoulder→elbow→hand, hip→knee→shoe
  const joint = (parent, x, y, z = 0) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const longSleeve = outfit !== 'casual' || T.toneShift > 0.4;
  const sleeve = outfit === 'blazer' || outfit === 'labcoat' || outfit === 'coverall' ? top : shirt;
  const arm = (sx) => {
    const s = joint(body, sx * 0.2 * w, 1.42);
    add(new THREE.Mesh(geo(`delt${T.fem}`, () => { const gg = new THREE.SphereGeometry(T.fem ? 0.05 : 0.058, 12, 10); gg.scale(1, 1.05, 1); return gg; }), sleeve), 0, -0.01, 0, s, { cast: false });
    add(new THREE.Mesh(geo(`upper${T.fem}`, () => { const gg = new THREE.CapsuleGeometry(T.fem ? 0.04 : 0.047, 0.21, 6, 12); return gg; }), sleeve), 0, -0.145, 0, s);
    const el = joint(s, 0, -0.29);
    add(new THREE.Mesh(geo(`fore${T.fem}`, () => { const gg = new THREE.CapsuleGeometry(T.fem ? 0.034 : 0.04, 0.19, 6, 12); return gg; }), longSleeve ? (outfit === 'casual' ? shirt : top) : skin), 0, -0.125, 0, el);
    const wr = joint(el, 0, -0.255);
    // hand: palm + thumb + finger block, slightly cupped
    add(new THREE.Mesh(geo('palm', () => new RoundedBoxGeometry(0.058, 0.07, 0.026, 2, 0.011)), skin), 0, -0.03, 0.004, wr, { cast: false });
    add(new THREE.Mesh(geo('fingers', () => { const gg = new RoundedBoxGeometry(0.054, 0.05, 0.022, 2, 0.01); gg.translate(0, -0.025, 0); return gg; }), skin), 0, -0.06, 0.008, wr, { cast: false }).rotation.x = 0.25;
    add(new THREE.Mesh(geo('thumb', () => new THREE.CapsuleGeometry(0.009, 0.03, 3, 6)), skin), -sx * 0.03, -0.03, 0.016, wr, { cast: false }).rotation.z = sx * 0.6;
    return { s, el, wr };
  };
  const leg = (sx) => {
    const hp = joint(body, sx * 0.085 * w, 0.88);
    add(new THREE.Mesh(geo(`thigh${T.fem}`, () => { const gg = new THREE.CapsuleGeometry(T.fem ? 0.064 : 0.068, 0.3, 6, 12); return gg; }), T.skirt ? skin : pants), 0, -0.21, 0, hp);
    const kn = joint(hp, 0, -0.42);
    add(new THREE.Mesh(geo('knee', () => new THREE.SphereGeometry(0.052, 10, 8)), T.skirt ? skin : pants), 0, 0, 0.005, kn, { cast: false });
    add(new THREE.Mesh(geo(`shin${T.fem}`, () => { const gg = lathe([[0.038, -0.4], [0.05, -0.3], [0.058, -0.16], [0.052, -0.02], [0.046, 0.02]], 12); return gg; }), T.skirt ? skin : pants), 0, 0, 0, kn);
    const an = joint(kn, 0, -0.4);
    add(new THREE.Mesh(geo(`shoe${T.fem}`, () => { const gg = new RoundedBoxGeometry(T.fem ? 0.085 : 0.1, 0.07, T.fem ? 0.23 : 0.26, 3, 0.03); return gg; }), shoes), 0, -0.01, 0.045, an);
    return { hp, kn, an };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  return { g, body, torso, neck, head, face, visor, armL, armR, legL, legR, T, sitDrop: -0.42, top: 1.85 * T.height };
}
