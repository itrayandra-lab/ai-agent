// Surroundings for the 3D campus: endless ground fading into fog, a ring road with moving cars, street lamps,
// a city skyline of instanced buildings (lit windows at dusk), Ray Group annex buildings, plaza fountain, benches,
// café umbrellas, flags and an instanced tree forest. Everything static is instanced or merged to stay light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deep-space surroundings for the station: everything is far away, cheap (one Points cloud, a handful of low-poly bodies) and slowly moving. */
export function buildSpace({ F, world, center, half }) {
  const rnd = mulberry(11); const out = { cars: [], windowMats: [], flags: [] };
  const g = new THREE.Group(); g.userData.keep = true; world.add(g);
  // stars on a big shell (drawn without fog so they stay crisp)
  const N = 1100, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 520, q = Math.sqrt(1 - u * u), y = Math.abs(u) * 0.97 + 0.03; // upper hemisphere only
    pos[i * 3] = center.x + Math.cos(a) * q * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = center.z + Math.sin(a) * q * r;
    const t = rnd(), warm = t < 0.18 ? 1 : 0, cool = t > 0.7 ? 1 : 0; col[i * 3] = 0.85 + warm * 0.15; col[i * 3 + 1] = 0.88 - warm * 0.12; col[i * 3 + 2] = 0.95 + cool * 0.05 - warm * 0.3;
    siz[i] = rnd() < 0.06 ? 3.6 + rnd() * 2 : 1.2 + rnd() * 1.6; ph[i] = rnd() * 6.28;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setAttribute('size', new THREE.BufferAttribute(siz, 1)); sg.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uStarB: { value: 1 }, uPx: { value: Math.min(devicePixelRatio || 1, 1.5) } },
    vertexShader: 'attribute float size; attribute float ph; attribute vec3 color; uniform float uTime; uniform float uPx; varying vec3 vC; varying float vT; void main(){ vC = color; vT = 0.82 + 0.18 * sin(uTime * (1.2 + fract(ph) * 2.0) + ph * 20.0); gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uNight; uniform float uStarB; varying vec3 vC; varying float vT; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 1.5); gl_FragColor = vec4(vC, a * vT * uNight * uStarB); }',
  });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = 0; g.add(stars);
  // one shooting star at a time, every so often
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.5), new THREE.MeshBasicMaterial({ color: 0xd8e6ff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); shoot.frustumCulled = false; g.add(shoot);
  const shot = { t: 99, wait: 6, dir: new THREE.Vector3() };
  const body = (geo, color, emissive, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: o.glow ?? 0.35, flatShading: true, roughness: 0.9, fog: false })); m.position.set(center.x + x, y, center.z + z); m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; g.add(m); return m; };
  // a ringed planet low on the horizon, and a small moon
  const planet = body(new THREE.IcosahedronGeometry(120, 2), 0xb9a8ee, 0x6a58c8, -330, 30, -300);
  const pring = new THREE.Mesh(new THREE.RingGeometry(150, 215, 40), new THREE.MeshBasicMaterial({ color: 0xd8ccff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, fog: false, depthWrite: false })); pring.position.copy(planet.position); pring.rotation.set(Math.PI / 2 - 0.35, 0.25, 0); pring.frustumCulled = false; g.add(pring);
  const moon = body(new THREE.IcosahedronGeometry(26, 1), 0xf0d9e6, 0xa77c98, 300, 150, -220, { glow: 0.3 });
  // drifting rocks and a few distant relay satellites
  const rocks = [];
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, d = half.x + 120 + rnd() * 200; const m = body(new THREE.IcosahedronGeometry(3 + rnd() * 7, 0), 0xa9aec6, 0x4a4f72, Math.cos(a) * d, -30 + rnd() * 110, Math.sin(a) * d, { glow: 0.25 }); m.userData.spin = (rnd() - 0.5) * 0.3; rocks.push(m); }
  const glow = new THREE.MeshStandardMaterial({ color: 0xcfeaff, emissive: 0x8fd0ff, emissiveIntensity: 1.5, flatShading: true });
  // the station deck: a wide low-poly disc under the building, light seam around the rim, four docking arms with beacons
  const rx = half.x + 26, rz = half.z + 26;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.86, 5, 12), F.M.plasterWarm); deck.scale.set(rx, 1, rz); deck.position.set(center.x, -2.56, center.z); deck.receiveShadow = true; g.add(deck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 3, 12), glow); rim.rotation.x = Math.PI / 2; rim.scale.set(rx, rz, 40); rim.position.set(center.x, -0.05, center.z); g.add(rim);
  const under = new THREE.Mesh(new THREE.ConeGeometry(1, 16, 8), F.M.blackMetal); under.scale.set(rx * 0.5, 1, rz * 0.5); under.rotation.x = Math.PI; under.position.set(center.x, -13, center.z); g.add(under);
  const beacons = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(dx ? 26 : 3, 1.2, dz ? 26 : 3), F.M.plasterWarm); arm.position.set(center.x + dx * (rx + 11), -1.2, center.z + dz * (rz + 11)); g.add(arm);
    const b = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), glow); b.position.set(center.x + dx * (rx + 23), 1.4, center.z + dz * (rz + 23)); g.add(b); beacons.push(b);
  }
  // ── the city around the station: floating districts with future towers, sky-lanes with hover cars, light bridges, a lit deck.
  // Everything repeated is instanced: districts, towers, tower lights, cars, lamps = a handful of draw calls.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const farGlow = new THREE.MeshStandardMaterial({ color: 0xcfeaff, emissive: 0x8fd0ff, emissiveIntensity: 1.8, flatShading: true, fog: false });
  const pinkGlow = new THREE.MeshStandardMaterial({ color: 0xffd6ea, emissive: 0xf08fc0, emissiveIntensity: 1.6, flatShading: true, fog: false });
  const shell = new THREE.MeshStandardMaterial({ color: 0xe6e9f6, flatShading: true, roughness: 0.6, metalness: 0.25, fog: false });
  const inst = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; g.add(im); return im; };
  const ISL = 10, isl = [];
  for (let i = 0; i < ISL; i++) { const a = (i / ISL) * Math.PI * 2 + rnd() * 0.35, d = half.x + 95 + rnd() * 95; isl.push({ x: center.x + Math.cos(a) * d, z: center.z + Math.sin(a) * d, y: -26 + rnd() * 56, r: 24 + rnd() * 24 }); }
  const islTop = inst(new THREE.CylinderGeometry(1, 0.9, 1, 8), shell, ISL), islKeel = inst(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color: 0x9aa0c2, flatShading: true, roughness: 0.8, fog: false }), ISL), islRim = inst(new THREE.TorusGeometry(1, 0.012, 3, 8), farGlow, ISL);
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  isl.forEach((o, i) => {
    islTop.setMatrixAt(i, m4.compose(v3.set(o.x, o.y - 1.5, o.z), q, sc.set(o.r, 3, o.r)));
    islKeel.setMatrixAt(i, m4.compose(v3.set(o.x, o.y - 3 - o.r * 0.3, o.z), qd, sc.set(o.r * 0.8, o.r * 0.6, o.r * 0.8)));
    islRim.setMatrixAt(i, m4.compose(v3.set(o.x, o.y + 0.1, o.z), qx, sc.set(o.r, o.r, 30)));
  });
  // towers: tapered hex prisms, each with a light band and a beacon on top; a few domes
  const T = []; for (const o of isl) { const n = 5 + (rnd() * 5 | 0); for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d = rnd() * o.r * 0.72; T.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, y: o.y, w: 2.6 + rnd() * 4.2, h: 24 + rnd() * 78 * (1 - d / o.r * 0.6) }); } }
  const towers = inst(new THREE.CylinderGeometry(0.62, 1, 1, 6).translate(0, 0.5, 0), shell, T.length), bands = inst(new THREE.CylinderGeometry(1, 1, 1, 6), farGlow, T.length * 2), caps = inst(new THREE.OctahedronGeometry(1, 0), pinkGlow, T.length);
  T.forEach((t, i) => {
    towers.setMatrixAt(i, m4.compose(v3.set(t.x, t.y, t.z), q, sc.set(t.w, t.h, t.w)));
    for (let b = 0; b < 2; b++) { const f = b ? 0.72 : 0.38, w = t.w * (1 - 0.38 * f) * 1.04; bands.setMatrixAt(i * 2 + b, m4.compose(v3.set(t.x, t.y + t.h * f, t.z), q, sc.set(w, 0.5, w))); }
    caps.setMatrixAt(i, m4.compose(v3.set(t.x, t.y + t.h + 1.6, t.z), q, sc.setScalar(0.5 + t.w * 0.18)));
  });
  const domes = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xbfd6ff, emissive: 0x6f9cf0, emissiveIntensity: 0.5, flatShading: true, transparent: true, opacity: 0.75, fog: false }), ISL);
  isl.forEach((o, i) => domes.setMatrixAt(i, m4.compose(v3.set(o.x + o.r * 0.45, o.y, o.z - o.r * 0.3), q, sc.set(o.r * 0.28, o.r * 0.2, o.r * 0.28))));
  // light bridges from the station to the nearest districts
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
  const bridges = [];
  for (const o of [...isl].sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z)).slice(0, 4)) {
    const from = new THREE.Vector3(center.x, 0.4, center.z), to = new THREE.Vector3(o.x, o.y + 0.4, o.z), dir = to.clone().sub(from), len = dir.length();
    from.addScaledVector(dir.clone().normalize(), Math.max(rx, rz) * 0.9);
    bridges.push({ ax: from.x, ay: from.y, az: from.z, bx: to.x, by: to.y, bz: to.z, w: 1.6 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1), beamMat); b.position.copy(from).lerp(to, 0.5); b.scale.z = from.distanceTo(to); b.lookAt(to); b.frustumCulled = false; g.add(b);
  }
  // sky-lanes: glowing loops around the station, and hover cars following them
  const lanes = [{ ax: rx + 34, az: rz + 34, y: 7, tilt: 0.0, n: 5, sp: 0.07 }, { ax: rx + 62, az: rz + 58, y: 24, tilt: 0.16, n: 5, sp: -0.05 }, { ax: rx + 96, az: rz + 90, y: -6, tilt: -0.1, n: 4, sp: 0.04 }];
  for (const L of lanes) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 3, 40), beamMat); t.rotation.x = Math.PI / 2 + L.tilt; t.scale.set(L.ax, L.az, 50); t.position.set(center.x, L.y, center.z); t.frustumCulled = false; g.add(t); }
  // upper skyways inside the dome: visible when you look up from the plaza
  lanes.push({ ax: 72, az: 64, y: 46, tilt: 0.05, n: 3, sp: 0.09 }, { ax: 48, az: 54, y: 62, tilt: -0.06, n: 2, sp: -0.07 }, { ax: 84, az: 74, y: 30, tilt: 0.03, n: 3, sp: 0.06 });
  for (const L of lanes.slice(-3)) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 3, 40), beamMat); t.rotation.x = Math.PI / 2 + L.tilt; t.scale.set(L.ax, L.az, 50); t.position.set(center.x, L.y, center.z); t.frustumCulled = false; g.add(t); }
  const CARS = lanes.reduce((n, L) => n + L.n, 0);
  const carGeo = new THREE.CylinderGeometry(0.25, 0.9, 3.4, 5).rotateZ(-Math.PI / 2).scale(1, 0.55, 1);
  const cars = inst(carGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.4, metalness: 0.3, fog: false }), CARS), tails = inst(new THREE.BoxGeometry(0.5, 0.3, 1.5), pinkGlow, CARS);
  const CARCOL = [0xffffff, 0xc9d0f2, 0xf6c7d9, 0xbfe6d6, 0xffe1b8]; const cc = new THREE.Color(), carS = [];
  { let i = 0; for (const L of lanes) for (let k = 0; k < L.n; k++) { carS.push({ L, s: (k / L.n) * Math.PI * 2 + rnd() * 0.25, lift: rnd() * 2 - 1 }); cars.setColorAt(i++, cc.setHex(CARCOL[(rnd() * CARCOL.length) | 0])); } }
  const fwd = new THREE.Vector3(), xAxis = new THREE.Vector3(1, 0, 0);
  const moveCars = (dt) => { for (let i = 0; i < CARS; i++) { const c = carS[i], L = c.L; c.s += dt * L.sp; const cs = Math.cos(c.s), sn = Math.sin(c.s), yy = L.y + c.lift + Math.sin(c.s) * L.az * Math.sin(L.tilt);
      v3.set(center.x + cs * L.ax, yy, center.z + sn * L.az); fwd.set(-sn * L.ax, 0, cs * L.az).multiplyScalar(Math.sign(L.sp)).normalize(); q.setFromUnitVectors(xAxis, fwd);
      cars.setMatrixAt(i, m4.compose(v3, q, sc.set(1, 1, 1))); tails.setMatrixAt(i, m4.compose(v3.addScaledVector(fwd, -1.9), q, sc.set(1, 1, 1))); }
    cars.instanceMatrix.needsUpdate = true; tails.instanceMatrix.needsUpdate = true; q.identity(); };
  moveCars(0);
  // flying motorbikes: a lean body, two glowing wheels and a light underneath, on two more lanes
  const bikeGeo = mergeGeometries([
    new THREE.CapsuleGeometry(0.2, 1.0, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.7, 0.55),
    new THREE.TorusGeometry(0.34, 0.07, 6, 14).translate(0.72, -0.12, 0), new THREE.TorusGeometry(0.34, 0.07, 6, 14).translate(-0.72, -0.12, 0),
    new THREE.BoxGeometry(0.5, 0.08, 0.26).translate(-0.1, 0.24, 0), new THREE.BoxGeometry(0.06, 0.06, 0.7).translate(0.62, 0.3, 0),
  ], false);
  const bikeLanes = [{ ax: 60, az: 58, y: 38, tilt: 0.1, n: 2, sp: 0.14 }, { ax: 76, az: 68, y: 54, tilt: -0.08, n: 2, sp: -0.12 }];
  for (const L of bikeLanes) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 3, 40), beamMat); t.rotation.x = Math.PI / 2 + L.tilt; t.scale.set(L.ax, L.az, 50); t.position.set(center.x, L.y, center.z); t.frustumCulled = false; g.add(t); }
  const BIKES = bikeLanes.reduce((n, L) => n + L.n, 0), bikes = inst(bikeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.4, metalness: 0.4, fog: false }), BIKES), bikeGlow = inst(new THREE.BoxGeometry(1.1, 0.05, 0.4), glow, BIKES);
  const bikeS = []; { let i = 0; for (const L of bikeLanes) for (let k = 0; k < L.n; k++) { bikeS.push({ L, s: (k / L.n) * Math.PI * 2 + rnd() * 0.2, lift: rnd() * 2 - 1 }); bikes.setColorAt(i++, cc.setHex(CARCOL[(rnd() * CARCOL.length) | 0])); } }
  const moveBikes = (dt) => { for (let i = 0; i < BIKES; i++) { const c = bikeS[i], L = c.L; c.s += dt * L.sp; const cs = Math.cos(c.s), sn = Math.sin(c.s), yy = L.y + c.lift + Math.sin(c.s * 3) * 0.8 + Math.sin(c.s) * L.az * Math.sin(L.tilt);
      v3.set(center.x + cs * L.ax, yy, center.z + sn * L.az); fwd.set(-sn * L.ax, 0, cs * L.az).multiplyScalar(Math.sign(L.sp)).normalize(); q.setFromUnitVectors(xAxis, fwd);
      bikes.setMatrixAt(i, m4.compose(v3, q, sc.set(1, 1, 1))); bikeGlow.setMatrixAt(i, m4.compose(v3.addScaledVector(up, -0.42), q, sc.set(1, 1, 1))); }
    bikes.instanceMatrix.needsUpdate = true; bikeGlow.instanceMatrix.needsUpdate = true; q.identity(); };
  moveBikes(0);
  // the deck itself: a lit ring road, lamp posts around the rim, three landing pads with parked pods
  const road = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 3, 48), F.M.blackMetal); road.rotation.x = Math.PI / 2; road.scale.set(rx - 9, rz - 9, 1.2); road.position.set(center.x, 0.0, center.z); road.receiveShadow = true; g.add(road);
  for (const k of [-1, 1]) { const ln = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 3, 48), glow); ln.rotation.x = Math.PI / 2; ln.scale.set(rx - 9 + k * 2.2, rz - 9 + k * 2.2, 14); ln.position.set(center.x, 0.07, center.z); g.add(ln); }
  const LAMPS = 26, posts = inst(new THREE.CylinderGeometry(0.09, 0.14, 3.6, 5).translate(0, 1.8, 0), shell, LAMPS), heads = inst(new THREE.OctahedronGeometry(0.34, 0), glow, LAMPS);
  for (let i = 0; i < LAMPS; i++) { const a = (i / LAMPS) * Math.PI * 2, x = center.x + Math.cos(a) * (rx - 4.5), z = center.z + Math.sin(a) * (rz - 4.5); posts.setMatrixAt(i, m4.compose(v3.set(x, 0, z), q, sc.set(1, 1, 1))); heads.setMatrixAt(i, m4.compose(v3.set(x, 3.9, z), q, sc.set(1, 1, 1))); }
  for (let k = -1; k <= 1; k++) { const x = center.x + half.x + 14, z = center.z + k * 9;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.16, 6), F.M.blackMetal); pad.position.set(x, 0.08, z); pad.receiveShadow = true; g.add(pad);
    const pr = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.07, 3, 6), glow); pr.rotation.x = Math.PI / 2; pr.position.set(x, 0.18, z); g.add(pr);
    if (k) { const pod = new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({ color: CARCOL[k + 2], flatShading: true, roughness: 0.4, metalness: 0.3 })); pod.position.set(x, 0.9, z); pod.rotation.y = 0.6 * k; pod.castShadow = true; g.add(pod); } }
  out.update = (dt, t) => { moveCars(dt); moveBikes(dt); planet.rotation.y += dt * 0.01; moon.rotation.y += dt * 0.03; stars.rotation.y += dt * 0.0015; for (const r of rocks) { r.rotation.x += dt * r.userData.spin; r.rotation.y += dt * r.userData.spin * 0.7; } for (let i = 0; i < beacons.length; i++) beacons[i].position.y = 1.4 + Math.sin(t * 1.4 + i) * 0.35; };
  out.group = g;
  // the city (floating districts, towers, bridges, cars) takes the scene fog, so far pieces fade into the sky instead of glowing through it
  g.traverse((o) => { if (o.isPoints || !o.material || o === g) return; const d = Math.hypot(o.position.x - center.x, o.position.z - center.z); if (d < 0 && o.geometry && o.geometry.type !== 'SphereGeometry') for (const m of [].concat(o.material)) if (m.fog === false) { m.fog = true; m.needsUpdate = true; } });
  out.setDusk = () => {};
  out.setNight = (n) => { starMat.uniforms.uNight.value = n; };
  out.setStarB = (b) => { starMat.uniforms.uStarB.value = b; };
  const upd = out.update;
  out.update = (dt, t) => {
    upd(dt, t); starMat.uniforms.uTime.value = t; stars.rotation.y += dt * 0.002;
    const n = starMat.uniforms.uNight.value;
    if (n > 0.6) { shot.wait -= dt; if (shot.wait <= 0 && shot.t > 1) { shot.t = 0; shot.wait = 7 + Math.random() * 12; const a = Math.random() * 6.28; shoot.position.set(center.x + Math.cos(a) * 400, 220 + Math.random() * 120, center.z + Math.sin(a) * 400); shoot.lookAt(center.x, 200, center.z); shoot.rotateZ((Math.random() - 0.5) * 1.2); shot.dir.set(1, -0.25, 0).applyQuaternion(shoot.quaternion).multiplyScalar(260); } }
    if (shot.t < 1) { shot.t += dt * 1.6; shoot.position.addScaledVector(shot.dir, dt); shoot.material.opacity = Math.sin(Math.min(1, shot.t) * Math.PI) * 0.9 * n; } else shoot.material.opacity = 0;
  };
  out.walk = { cx: center.x, cz: center.z, rx, rz, bridges, isl, towers: T, arms: [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: center.x + dx * (rx + 11), z: center.z + dz * (rz + 11), w: dx ? 26 : 3, d: dz ? 26 : 3, y: -0.6 })) };
  return out;
}

export function buildSurroundings({ F, world, center, half }) {
  const { M } = F;
  const rnd = mulberry(7);
  const out = { cars: [], lampHeads: null, windowMats: [], flags: [] };
  const R = Math.max(half.x, half.z);
  const ring = { x1: center.x - half.x - 30, x2: center.x + half.x + 30, z1: center.z - half.z - 30, z2: center.z + half.z + 30 };

  // ── ground: huge plane (fog hides the edge), lawn ring and sidewalks
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d5a3e, roughness: 1 });
  out.groundMat = groundMat;
  mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), groundMat, center.x, -0.06, center.z, { receive: true });
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
    g.fillStyle = lit ? '#000' : '#d3d9ea'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 6; y += 16) for (let x = 6; x < w - 6; x += 14) {
      const on = rnd() < 0.42;
      g.fillStyle = lit ? (on ? `rgba(${110 + rnd() * 70 | 0},${190 + rnd() * 50 | 0},255,${0.55 + rnd() * 0.45})` : '#000') : (on ? '#9fc6f0' : '#b6bfd8');
      g.fillRect(x, y, 12, 4);
    }
  });
  const facadeMap = facade(false), litMap = facade(true);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc6cce0, roughness: 0.6, metalness: 0.3 });
  const classes = [[10, 22, 0.55], [24, 46, 0.3], [50, 90, 0.15]];
  const blocks = [];
  for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
    const x = center.x + gx * 34, z = center.z + gz * 34;
    if (x > ring.x1 - 24 && x < ring.x2 + 24 && z > ring.z1 - 24 && z < ring.z2 + 24) continue; // keep the campus clear
    if (Math.abs(x - center.x) < 10 || Math.abs(z - center.z) < 10) continue; // avenues
    const d = Math.hypot(x - center.x, z - center.z);
    if (d < R + 70 || d > R + 150 || rnd() < 0.3) continue; // one ring of towers: the fog hides anything further
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
  // rolling hills on the horizon and grassy mounds near the campus: the land is not one flat plate
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const HILLS = 26, hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.42, 1), hillMat, HILLS);
  const hq = new THREE.Quaternion(), hc = new THREE.Color();
  for (let k = 0; k < HILLS; k++) {
    const near = k < 8; const a = (k / (near ? 8 : HILLS - 8)) * Math.PI * 2 + rnd();
    const d = near ? R + 44 + rnd() * 14 : R + 170 + rnd() * 90, r = near ? 7 + rnd() * 7 : 40 + rnd() * 45;
    hq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
    m4.compose(new THREE.Vector3(center.x + Math.cos(a) * d, near ? -1.2 : -4, center.z + Math.sin(a) * d), hq, new THREE.Vector3(r, r * (near ? 0.5 : 0.7 + rnd() * 0.5), r * (0.7 + rnd() * 0.5)));
    hills.setMatrixAt(k, m4); hills.setColorAt(k, hc.setHex(near ? 0x5f7d48 : [0x4f6b4a, 0x5a7658, 0x466356][k % 3]));
  }
  hills.receiveShadow = true; hills.frustumCulled = false; world.add(hills);

  const TREES = 150;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 5).translate(0, 1.1, 0), M.walnut, TREES);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 0).translate(0, 3.2, 0), new THREE.MeshStandardMaterial({ flatShading: true, color: 0xffffff, roughness: 0.9 }), TREES);
  // species colours: greens, olive, autumn orange and red, pink blossom
  const LEAF = [0x3f7a45, 0x2c5e37, 0x6f9a3c, 0x4f7a2e, 0x2f6f5e, 0xd08a2e, 0xb5642a, 0x8a2f2a, 0xe7a9bd];
  let n = 0; const q = new THREE.Quaternion(), lc = new THREE.Color();
  const tryTree = (x, z, s) => { if (n >= TREES) return; m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.85 + rnd() * 0.4), s)); trunk.setMatrixAt(n, m4); crown.setMatrixAt(n, m4); crown.setColorAt(n, lc.setHex(LEAF[(rnd() * rnd() * LEAF.length) | 0])); n++; };
  for (let x = ring.x1; x <= ring.x2; x += 13) { tryTree(x + 4, ring.z1 - W / 2 - 6, 0.9 + rnd() * 0.5); tryTree(x + 4, ring.z2 + W / 2 + 6, 0.9 + rnd() * 0.5); }
  for (let z = ring.z1; z <= ring.z2; z += 13) { tryTree(ring.x1 - W / 2 - 6, z + 4, 0.9 + rnd() * 0.5); tryTree(ring.x2 + W / 2 + 6, z + 4, 0.9 + rnd() * 0.5); }
  while (n < TREES) { const a = rnd() * Math.PI * 2, d = R + 50 + rnd() * 120; tryTree(center.x + Math.cos(a) * d, center.z + Math.sin(a) * d, 1 + rnd() * 1.2); }
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
    for (const m of out.windowMats) m.emissiveIntensity = 0.55 + dusk * 1.3;
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
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uBlur: { value: 0 }, uTime: { value: 0 }, uVig: { value: 0.32 }, uWarm: { value: 0.5 }, uTeal: { value: 0.8 }, uSat: { value: 0.93 }, uCon: { value: 0.4 }, uCA: { value: 0.7 }, uHi: { value: 0 }, uSh: { value: 0 }, uTemp: { value: 0 }, uHazeK: { value: 1 }, uTaps: { value: 20 }, uGlow: { value: 0.22 }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 20 }, uAp: { value: 1 }, uWide: { value: 0 }, uHaze: { value: new THREE.Vector3(0.7, 0.78, 0.9) }, uRes: { value: new THREE.Vector2(1280, 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uAp; uniform float uWide; uniform float uHi; uniform float uSh; uniform float uTemp; uniform float uHazeK; uniform float uTaps; uniform float uTeal; uniform float uSat; uniform float uCon; uniform float uCA; uniform float uGlow; uniform vec3 uHaze; uniform vec2 uRes; uniform float uTime; uniform float uBlur; uniform float uVig; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // depth of field like a photographer: a close focus gives a shallow, creamy background; a wide shot keeps nearly everything sharp and lets haze carry the depth
      float dz = texture2D(tDepth, vUv).x;
      float zl = (2.0 * uNear * uFar) / (uFar + uNear - (dz * 2.0 - 1.0) * (uFar - uNear));
      float farB = smoothstep(uFocus * 1.2, uFocus * 5.0, zl);
      float nearEdge = min(uFocus * 0.3, 2.4);
      float nearB = smoothstep(nearEdge, nearEdge * 0.3, zl) * (1.0 - uWide);
      float coc = max(farB * 0.85, nearB * 0.5);
      bool sky = dz > 0.9999;
      if (sky) coc = max(coc, 0.16);
      coc = clamp(coc * uAp * mix(1.0, 0.22, uWide), 0.0, 1.0);
      if (coc > 0.03) {
        vec2 px = vec2(1.0) / uRes; vec3 acc = c.rgb; float ws = 1.0;
        float rot = 0.35 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float R = mix(11.0, 5.0, uWide);
        for (int i = 0; i < 24; i++) { float fi = float(i); if (fi >= uTaps) break; float a = fi * 2.39996 + rot; float rad = sqrt((fi + 0.5) / uTaps); vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rad * coc * R * px).rgb; float w = 1.0 + max(max(s.r, s.g), s.b) * 0.25; acc += s * w; ws += w; }
        c.rgb = acc / ws;
      }
      if (!sky) { float hf = max(uFocus, 48.0); c.rgb = mix(c.rgb, uHaze, min(0.55, smoothstep(hf * 1.6, hf * 6.0, zl) * mix(0.26, 0.12, uWide) * uHazeK)); }   // haze keys off the scene scale, not the (small) Play focus distance, so the plaza and the pods stay clear and only the far world softens
      float edge = smoothstep(0.2, 0.5, abs(vUv.y - 0.5)) * uBlur;
      if (edge > 0.01) { float r = edge * 0.0042; vec3 acc = c.rgb; acc += texture2D(tDiffuse, vUv + vec2(r, 0.0)).rgb; acc += texture2D(tDiffuse, vUv - vec2(r, 0.0)).rgb; acc += texture2D(tDiffuse, vUv + vec2(0.0, r)).rgb; acc += texture2D(tDiffuse, vUv - vec2(0.0, r)).rgb; acc += texture2D(tDiffuse, vUv + vec2(r, r) * 0.7).rgb; acc += texture2D(tDiffuse, vUv - vec2(r, r) * 0.7).rgb; c.rgb = acc / 7.0; }
      vec3 col = c.rgb;
      // soft glow: a wide, smooth spiral of the brightest areas, screen-blended so it never ghosts or clips
      if (uGlow > 0.0) {
        vec2 gp = vec2(1.0) / uRes; vec3 gl = vec3(0.0); float gw = 0.0; float gr = 10.0 + 22.0 * min(uGlow, 1.4);
        float grot = 6.2831 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        for (int i = 0; i < 14; i++) { float fi = float(i); float a = fi * 2.39996 + grot; float rad = sqrt((fi + 0.5) / 14.0); vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rad * gr * gp).rgb; float k = smoothstep(0.5, 1.0, max(max(s.r, s.g), s.b)); float w = 1.0 - rad * 0.55; gl += s * k * w; gw += w; }
        gl /= gw; float gk = min(uGlow, 1.3) * 0.7;
        col = 1.0 - (1.0 - col) * (1.0 - clamp(gl * gk, 0.0, 0.9));
      }
      // lens colour fringing: only the red/blue difference at edges is added, growing smoothly from the centre to the corners
      if (uCA > 0.0) {
        vec2 dd = vUv - 0.5; float ln = length(dd); vec2 off = (dd / max(ln, 1e-4)) * (smoothstep(0.3, 0.75, ln) * ln) * min(uCA, 0.8) * 3.0 / uRes;
        float r0 = texture2D(tDiffuse, vUv).r, b0 = texture2D(tDiffuse, vUv).b;
        col.r += texture2D(tDiffuse, vUv + off).r - r0; col.b += texture2D(tDiffuse, vUv - off).b - b0;
      }
      col = mix(col, col * col * (3.0 - 2.0 * col), uCon);              // soft S-curve contrast
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= 1.0 + uHi * 0.3 * smoothstep(0.45, 1.0, l);                // highlights
      col += uSh * 0.1 * (1.0 - smoothstep(0.0, 0.5, l));                // shadows
      col.r *= 1.0 + uTemp * 0.08; col.b *= 1.0 - uTemp * 0.08;           // colour temperature
      col += uWarm * (vec3(0.035, 0.012, -0.03) * smoothstep(0.35, 1.0, l) + vec3(-0.012, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.4, l)));
      col += uTeal * vec3(-0.018, 0.012, 0.035) * (1.0 - smoothstep(0.0, 0.5, l));   // cool shadows against warm highlights
      col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat);   // slight desaturation = filmic
      vec2 d = vUv - 0.5; col *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      col += (h(vUv * 900.0) - 0.5) * 0.018;
      col = mix(col, col * vec3(1.02, 1.0, 0.985), 0.6);                  // faint film tint
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
