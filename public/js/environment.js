// Surroundings for the 3D campus: endless ground fading into fog, a ring road with moving cars, street lamps,
// a city skyline of instanced buildings (lit windows at dusk), Ray Group annex buildings, plaza fountain, benches,
// café umbrellas, flags and an instanced tree forest. Everything static is instanced or merged to stay light.
import * as THREE from 'three';

export function buildSurroundings({ F, world, center, half }) {
  const { M } = F;
  const rnd = mulberry(7);
  const out = { cars: [], lampHeads: null, windowMats: [], flags: [] };
  const R = Math.max(half.x, half.z);
  const ring = { x1: center.x - half.x - 30, x2: center.x + half.x + 30, z1: center.z - half.z - 30, z2: center.z + half.z + 30 };

  // ── ground: huge plane (fog hides the edge), lawn ring and sidewalks
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d5a3e, roughness: 1 });
  out.groundMat = groundMat;
  mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), groundMat, center.x, -0.06, center.z, { receive: true });
  const road = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.92 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x9d978d, roughness: 0.9 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 });
  const W = 9;
  const seg = (x1, z1, x2, z2) => {
    const horiz = z1 === z2; const len = horiz ? Math.abs(x2 - x1) + W : Math.abs(z2 - z1) + W;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    mesh(new THREE.BoxGeometry(horiz ? len : W, 0.05, horiz ? W : len), road, cx, -0.02, cz, { receive: true });
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(horiz ? len : 2.2, 0.14, horiz ? 2.2 : len), curb, cx + (horiz ? 0 : s * (W / 2 + 1.1)), 0.02, cz + (horiz ? s * (W / 2 + 1.1) : 0), { receive: true });
    const dashes = Math.floor(len / 6);
    const g = new THREE.BoxGeometry(horiz ? 2.6 : 0.18, 0.01, horiz ? 0.18 : 2.6);
    const im = new THREE.InstancedMesh(g, lineMat, dashes); const m4 = new THREE.Matrix4();
    for (let k = 0; k < dashes; k++) { const t = -len / 2 + 3 + k * 6; m4.makeTranslation(cx + (horiz ? t : 0), 0.02, cz + (horiz ? 0 : t)); im.setMatrixAt(k, m4); }
    world.add(im);
  };
  seg(ring.x1, ring.z1, ring.x2, ring.z1); seg(ring.x1, ring.z2, ring.x2, ring.z2); seg(ring.x1, ring.z1, ring.x1, ring.z2); seg(ring.x2, ring.z1, ring.x2, ring.z2);
  // avenues out to the city
  for (const [x, z, horiz, len] of [[center.x, ring.z1 - 90, false, 180], [center.x, ring.z2 + 90, false, 180], [ring.x1 - 90, center.z, true, 180], [ring.x2 + 90, center.z, true, 180]]) {
    mesh(new THREE.BoxGeometry(horiz ? len : W, 0.05, horiz ? W : len), road, x, -0.025, z, { receive: true });
  }

  // ── street lamps (instanced poles + emissive heads)
  const lampPts = [];
  for (let x = ring.x1; x <= ring.x2; x += 18) lampPts.push([x, ring.z1 - W / 2 - 2], [x, ring.z2 + W / 2 + 2]);
  for (let z = ring.z1 + 18; z < ring.z2; z += 18) lampPts.push([ring.x1 - W / 2 - 2, z], [ring.x2 + W / 2 + 2, z]);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 6).translate(0, 2.5, 0), M.blackMetal, lampPts.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc98a, emissiveIntensity: 2.2 });
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.26).translate(0, 5, 0), headMat, lampPts.length);
  const m4 = new THREE.Matrix4();
  lampPts.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); pole.setMatrixAt(k, m4); head.setMatrixAt(k, m4); });
  pole.castShadow = true; pole.frustumCulled = head.frustumCulled = false; world.add(pole, head); out.lampHeads = headMat;

  // ── skyline: instanced towers in city blocks beyond the ring road
  const facade = (lit) => canvas(128, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : '#8e8a84'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 6; y += 16) for (let x = 6; x < w - 6; x += 14) {
      const on = rnd() < 0.42;
      g.fillStyle = lit ? (on ? `rgba(255,${190 + rnd() * 50 | 0},${120 + rnd() * 60 | 0},${0.55 + rnd() * 0.45})` : '#000') : (on ? '#5f6d78' : '#4b5560');
      g.fillRect(x, y, 9, 10);
    }
  });
  const facadeMap = facade(false), litMap = facade(true);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x55524e, roughness: 0.9 });
  const classes = [[10, 22, 0.55], [24, 46, 0.3], [50, 90, 0.15]];
  const blocks = [];
  for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
    const x = center.x + gx * 34, z = center.z + gz * 34;
    if (x > ring.x1 - 24 && x < ring.x2 + 24 && z > ring.z1 - 24 && z < ring.z2 + 24) continue; // keep the campus clear
    if (Math.abs(x - center.x) < 10 || Math.abs(z - center.z) < 10) continue; // avenues
    const d = Math.hypot(x - center.x, z - center.z);
    if (d < R + 70 || d > R + 280 || rnd() < 0.18) continue;
    blocks.push([x + (rnd() - 0.5) * 6, z + (rnd() - 0.5) * 6, d]);
  }
  for (const [lo, hi, share] of classes) {
    const pick = blocks.filter(([, , d]) => rnd() < share * (d > R + 120 ? 1.6 : 1));
    if (!pick.length) continue;
    const reps = (lo + hi) / 2 / 3.2;
    const fm = facadeMap.clone(); fm.needsUpdate = true; fm.repeat.set(2, reps / 8);
    const lm = litMap.clone(); lm.needsUpdate = true; lm.repeat.set(2, reps / 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: fm, emissive: 0xffffff, emissiveMap: lm, emissiveIntensity: 0, roughness: 0.6, metalness: 0.2 });
    out.windowMats.push(mat);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [mat, mat, roofMat, roofMat, mat, mat], pick.length);
    pick.forEach(([x, z], k) => { const w = 12 + rnd() * 12, dd = 12 + rnd() * 12, h = lo + rnd() * (hi - lo); m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, dd)); im.setMatrixAt(k, m4); });
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; world.add(im);
  }

  // ── Ray Group annex buildings with signage (a tower, the Ray Beauty plant, a parking deck)
  const annexMat = (rep) => { const fm = facadeMap.clone(); fm.needsUpdate = true; fm.repeat.set(...rep); const lm = litMap.clone(); lm.needsUpdate = true; lm.repeat.set(...rep); const m = new THREE.MeshStandardMaterial({ color: 0xe9e4dc, map: fm, emissive: 0xffffff, emissiveMap: lm, emissiveIntensity: 0, roughness: 0.5, metalness: 0.25 }); out.windowMats.push(m); return m; };
  const tower = new THREE.Group();
  F.put(tower, new THREE.BoxGeometry(22, 52, 18).translate(0, 26, 0), annexMat([3, 6]), 0, 0, 0);
  F.put(tower, new THREE.BoxGeometry(24, 1.2, 20), M.frame, 0, 52.6, 0);
  F.put(tower, new THREE.BoxGeometry(24, 4, 20).translate(0, 2, 0), M.glass, 0, 0, 0, { cast: false });
  sign(tower, 'RAY GROUP', 16, 0, 46, 9.05, 0);
  tower.position.set(center.x - half.x * 0.3, 0, ring.z1 - 30); world.add(tower);
  const plant = new THREE.Group();
  F.put(plant, new THREE.BoxGeometry(46, 11, 26).translate(0, 5.5, 0), M.plasterWarm, 0, 0, 0);
  for (let k = 0; k < 6; k++) F.put(plant, new THREE.BoxGeometry(7.4, 3, 26).translate(0, 1.5, 0), roofMat, -19.5 + k * 7.8, 11, 0, { rz: 0.35 });
  for (let k = 0; k < 3; k++) { F.put(plant, new THREE.CylinderGeometry(2.4, 2.4, 14, 16).translate(0, 7, 0), M.steel, 26 + (k % 2) * 5.5, 0, -8 + k * 7); }
  F.put(plant, new THREE.CylinderGeometry(0.8, 1, 24, 10).translate(0, 12, 0), M.potConcrete, -20, 0, -10);
  sign(plant, 'RAY BEAUTY · PLANT', 22, 0, 8.4, 13.05, 0);
  plant.position.set(ring.x2 + 46, 0, center.z + half.z * 0.2); world.add(plant);
  const deck = new THREE.Group();
  for (let f = 0; f < 4; f++) { F.put(deck, new THREE.BoxGeometry(30, 0.5, 22), M.potConcrete, 0, f * 3.2 + 0.25, 0); if (f) for (const sx of [-1, 1]) F.put(deck, new THREE.BoxGeometry(30, 1, 0.3), M.potConcrete, 0, f * 3.2 + 0.9, sx * 11); }
  for (let x = -13; x <= 13; x += 6.5) for (const z of [-10, 10]) F.put(deck, new THREE.BoxGeometry(0.6, 12.8, 0.6).translate(0, 6.4, 0), M.potConcrete, x, 0, z);
  deck.position.set(ring.x1 - 40, 0, center.z - half.z * 0.3); world.add(deck);

  // ── plaza: fountain, flags, benches, café umbrellas, bike rack
  const plaza = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: 0x5f8fa8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 });
  F.put(plaza, new THREE.CylinderGeometry(4, 4.2, 0.6, 32), M.potConcrete, 0, 0.3, 0);
  F.put(plaza, new THREE.CylinderGeometry(3.7, 3.7, 0.1, 32), water, 0, 0.58, 0, { cast: false });
  F.put(plaza, new THREE.CylinderGeometry(0.5, 0.7, 1.6, 16), M.potConcrete, 0, 1.2, 0);
  const jet = F.put(plaza, new THREE.ConeGeometry(0.35, 1.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xdaf0ff, transparent: true, opacity: 0.45, roughness: 0 }), 0, 2.6, 0, { cast: false });
  out.jet = jet;
  for (let k = 0; k < 3; k++) { const fl = flag([0xb59a73, 0xe8e2d6, 0x2b2825][k]); fl.position.set(-6, 0, -4 + k * 4); plaza.add(fl); out.flags.push(fl.userData.cloth); }
  plaza.position.set(center.x - half.x - 26, 0, center.z); jet.userData.keep = true; for (const cl of out.flags) cl.userData.dynamic = true; world.add(plaza);
  const benchPts = [], umbrellaPts = [];
  for (let k = -2; k <= 2; k++) benchPts.push([center.x - half.x - 16, center.z + k * 7, Math.PI / 2]);
  for (let k = 0; k < Math.floor(half.x / 9); k++) benchPts.push([center.x - half.x + 8 + k * 18, center.z - half.z - 7, 0], [center.x - half.x + 8 + k * 18, center.z + half.z + 7, Math.PI]);
  for (const [x, z, r] of benchPts) { const b = bench(); b.position.set(x, 0, z); b.rotation.y = r; world.add(b); }
  for (let k = 0; k < 4; k++) umbrellaPts.push([center.x - half.x - 20 + (k % 2) * 7, center.z + (k < 2 ? -12 : 12)]);
  for (const [x, z] of umbrellaPts) { const u = umbrella(); u.position.set(x, 0, z); world.add(u); }

  // ── forest of instanced trees around the city & campus edges
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6).translate(0, 1.1, 0), M.walnut, 260);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 1).translate(0, 3.2, 0), M.leafDark, 260);
  let n = 0; const q = new THREE.Quaternion();
  const tryTree = (x, z, s) => { if (n >= 260) return; m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)); trunk.setMatrixAt(n, m4); crown.setMatrixAt(n, m4); n++; };
  for (let x = ring.x1; x <= ring.x2; x += 9) { tryTree(x + 4, ring.z1 - W / 2 - 6, 0.9 + rnd() * 0.5); tryTree(x + 4, ring.z2 + W / 2 + 6, 0.9 + rnd() * 0.5); }
  for (let z = ring.z1; z <= ring.z2; z += 9) { tryTree(ring.x1 - W / 2 - 6, z + 4, 0.9 + rnd() * 0.5); tryTree(ring.x2 + W / 2 + 6, z + 4, 0.9 + rnd() * 0.5); }
  while (n < 260) { const a = rnd() * Math.PI * 2, d = R + 60 + rnd() * 220; tryTree(center.x + Math.cos(a) * d, center.z + Math.sin(a) * d, 1 + rnd() * 1.2); }
  trunk.count = crown.count = n; trunk.castShadow = crown.castShadow = true; trunk.frustumCulled = crown.frustumCulled = false; world.add(trunk, crown);

  // ── traffic on the ring road
  const loop = [[ring.x1, ring.z1 + 2], [ring.x2, ring.z1 + 2], [ring.x2 - 2, ring.z2], [ring.x1, ring.z2 - 2]];
  const perim = 2 * (ring.x2 - ring.x1 + ring.z2 - ring.z1);
  const colors = [0x8a1c1c, 0x1c3f8a, 0xd9d9d9, 0x222222, 0x5b6b4b, 0xc9a25b];
  for (let k = 0; k < 6; k++) { const c = F.car(colors[k]); c.userData.dynamic = true; c.userData.s = (k / 6) * perim; c.userData.v = 7 + rnd() * 4; world.add(c); out.cars.push(c); }
  const at = (s) => {
    s = ((s % perim) + perim) % perim; const L1 = ring.x2 - ring.x1, L2 = ring.z2 - ring.z1;
    if (s < L1) return [ring.x1 + s, ring.z1 + 2, Math.PI / 2];
    if ((s -= L1) < L2) return [ring.x2 - 2, ring.z1 + s, 0];
    if ((s -= L2) < L1) return [ring.x2 - s, ring.z2 - 2, -Math.PI / 2];
    s -= L1; return [ring.x1 + 2, ring.z2 - s, Math.PI];
  };
  void loop;

  out.update = (dt, t) => {
    for (const c of out.cars) { c.userData.s += c.userData.v * dt; const [x, z, r] = at(c.userData.s); c.position.set(x, 0, z); c.rotation.y = r; }
    if (out.jet) out.jet.scale.y = 1 + Math.sin(t * 3) * 0.08;
    for (const cl of out.flags) cl.rotation.y = Math.sin(t * 2 + cl.id) * 0.25;
  };
  /** dusk = 1 lights the windows and lamps; 0 is plain daylight. */
  out.setDusk = (dusk) => {
    for (const m of out.windowMats) m.emissiveIntensity = dusk * 1.6;
    headMat.emissiveIntensity = 0.3 + dusk * 2.4;
    groundMat.color.setHex(dusk ? 0x3a4430 : 0x5c6a49);
  };
  return out;

  // ── helpers
  function mesh(geo, mat, x, y, z, { receive = false, cast = false } = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = receive; m.castShadow = cast; world.add(m); return m; }
  function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
  function sign(g, text, w, x, y, z, ry) {
    const t = canvas(1024, 128, (c, cw, ch) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, cw, ch); c.font = '600 84px Geist, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff3dc'; c.fillText(text, cw / 2, ch / 2 + 4); });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8), new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: 0xffe2b0, emissiveMap: t, emissiveIntensity: 0.9, depthWrite: false }));
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  }
  function bench() { const g = new THREE.Group(); F.put(g, F.rbox(1.8, 0.06, 0.45, 0.02), M.oak, 0, 0.45, 0); F.put(g, F.rbox(1.8, 0.35, 0.05, 0.02), M.oak, 0, 0.72, 0.2, { rx: -0.15 }); for (const sx of [-0.75, 0.75]) F.put(g, F.box(0.06, 0.45, 0.42), M.blackMetal, sx, 0.22, 0); F.blob(g, 2.2, 0.9); return g; }
  function umbrella() { const g = new THREE.Group(); F.put(g, F.cyl(0.03, 0.03, 2.4, 6), M.steel, 0, 1.2, 0); F.put(g, new THREE.ConeGeometry(1.6, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9, side: THREE.DoubleSide }), 0, 2.4, 0); F.put(g, F.cyl(0.6, 0.6, 0.04, 16), M.laminate, 0, 0.74, 0); F.put(g, F.cyl(0.05, 0.08, 0.74, 8), M.blackMetal, 0, 0.37, 0); for (let k = 0; k < 3; k++) { const a = k * 2.1; F.put(g, F.rbox(0.42, 0.05, 0.42, 0.02), M.oak, Math.cos(a) * 1, 0.46, Math.sin(a) * 1); } F.blob(g, 3, 3); return g; }
  function flag(color) { const g = new THREE.Group(); F.put(g, F.cyl(0.05, 0.06, 8, 8), M.chrome, 0, 4, 0); const cl = new THREE.Group(); cl.position.set(0, 7.2, 0); F.put(cl, new THREE.BoxGeometry(1.8, 1.1, 0.02).translate(0.9, 0, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), 0, 0, 0, { cast: false }); g.add(cl); g.userData.cloth = cl; return g; }
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Cinematic grade applied after tone mapping: gentle S-curve, warm highlights / cool shadows, vignette, fine grain. */
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uWarm: { value: 0.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);               // soft S-curve contrast
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += uWarm * (vec3(0.035, 0.012, -0.03) * smoothstep(0.35, 1.0, l) + vec3(-0.012, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.4, l)));
      col = mix(vec3(l), col, 0.94);                                     // slight desaturation = filmic
      vec2 d = vUv - 0.5; col *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      col += (h(vUv * 900.0) - 0.5) * 0.018;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
