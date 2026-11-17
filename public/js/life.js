// Living sky around the station: drifting clouds (above and below the deck), flocks of birds, slow sky-whales,
// glowing spores, aurora ribbons and a sea of mist underneath. Everything repeated is instanced; one update per frame.
import * as THREE from 'three';

const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function buildLife({ world, center, R, renderer, camera }) {
  const rnd = rng(31), g = new THREE.Group(); g.userData.keep = true; world.add(g);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), eul = new THREE.Euler();
  const inst = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; g.add(im); return im; };

  // ── clouds: soft puffs drawn as one Points object (one draw call). They live far from the station, fade out near the camera
  // so they never block the view, and fade into the sky colour with distance.
  const CLOUDS = 46, PER = 22, puffs = CLOUDS * PER, cp = new Float32Array(puffs * 3), cs = new Float32Array(puffs), ch = new Float32Array(puffs), cu = new Float32Array(puffs), cv = new Float32Array(puffs);
  const order = Array.from({ length: CLOUDS }, (_, i) => i).sort(() => rnd() - 0.5);
  for (let i = 0; i < CLOUDS; i++) {
    const a = rnd() * Math.PI * 2, d = R + 170 + rnd() * 260, layer = i % 4, y0 = layer === 0 ? 85 + rnd() * 70 : layer === 1 ? 25 + rnd() * 45 : layer === 2 ? -4 + rnd() * 22 : -40 - rnd() * 22;
    const rank = order[i] / CLOUDS, vsz = 0.45 + rnd() * 1.3;
    const cx = center.x + Math.cos(a) * d, cz = center.z + Math.sin(a) * d, W = 26 + rnd() * 44, H = 5 + rnd() * 7, D = 14 + rnd() * 22, rot = rnd() * Math.PI;
    for (let k = 0; k < PER; k++) {
      const u = (rnd() + rnd() + rnd()) / 3 * 2 - 1, v = rnd() * 2 - 1, w = (rnd() + rnd()) - 1, dome = 1 - Math.abs(u) * 0.7, j = i * PER + k;
      const px = u * W, pz = w * D, py = Math.max(0, v) * H * dome + (rnd() - 0.5) * 2;
      cp[j * 3] = cx + Math.cos(rot) * px - Math.sin(rot) * pz; cp[j * 3 + 1] = y0 + py; cp[j * 3 + 2] = cz + Math.sin(rot) * px + Math.cos(rot) * pz;
      cs[j] = (9 + rnd() * 14) * (0.6 + dome * 0.6); ch[j] = Math.min(1, py / (H * 0.9 + 1) + rnd() * 0.25); cu[j] = rank; cv[j] = vsz;
    }
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('size', new THREE.BufferAttribute(cs, 1)); cg.setAttribute('lit', new THREE.BufferAttribute(ch, 1)); cg.setAttribute('cut', new THREE.BufferAttribute(cu, 1)); cg.setAttribute('vsz', new THREE.BufferAttribute(cv, 1));
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 500 }, uLight: { value: new THREE.Color(0xffffff) }, uShadow: { value: new THREE.Color(0xb9c3dd) }, uFog: { value: new THREE.Color(0x9fb4d8) }, uGain: { value: 0.7 }, uDensity: { value: 1 }, uBoost: { value: 1 }, uVar: { value: 1 } },
    vertexShader: 'attribute float size; attribute float lit; attribute float cut; attribute float vsz; uniform float uScale; uniform float uBoost; uniform float uVar; varying float vLit; varying float vNear; varying float vFar; varying float vCut; void main(){ vCut = cut; vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = length(mv.xyz); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * mix(1.0, vsz, uVar) * uBoost * uScale / max(d, 1.0), 0.0, 180.0); vLit = lit; vNear = smoothstep(60.0, 170.0, d); vFar = smoothstep(260.0, 760.0, d); }',
    fragmentShader: 'uniform vec3 uLight; uniform vec3 uShadow; uniform vec3 uFog; uniform float uGain; uniform float uDensity; uniform float uBoost; varying float vLit; varying float vNear; varying float vFar; varying float vCut; void main(){ float kd = clamp((uDensity - vCut) * 14.0, 0.0, 1.0); if (kd <= 0.0) discard; vec2 p = gl_PointCoord - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r * r, 1.6); vec3 c = mix(uShadow, uLight, vLit); c = mix(c, uFog, vFar * 0.75); gl_FragColor = vec4(c, a * kd * uGain * uBoost * vNear * (1.0 - vFar * 0.35)); }',
  });
  const clouds = new THREE.Points(cg, cloudMat); clouds.frustumCulled = false; clouds.renderOrder = 2; g.add(clouds);
  // ── cirrus: long thin streaks very high up; contrails: white lines drawn by planes far above
  const shared = { uLight: cloudMat.uniforms.uLight, uFog: cloudMat.uniforms.uFog };
  const cirrusMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { ...shared, uAmt: { value: 0.6 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uLight; uniform vec3 uFog; uniform float uAmt; varying vec2 vUv; void main(){ float along = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x); float across = pow(1.0 - abs(vUv.y * 2.0 - 1.0), 2.0); float st = 0.55 + 0.45 * sin(vUv.y * 46.0 + vUv.x * 5.0); gl_FragColor = vec4(mix(uLight, uFog, 0.25), along * across * st * uAmt * 0.5); }',
  });
  const CIR = 36, cirrus = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cirrusMat, CIR); cirrus.frustumCulled = false; cirrus.renderOrder = 1; g.add(cirrus);
  { const m = new THREE.Matrix4(), qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), qb = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < CIR; i++) { const a = rnd() * Math.PI * 2, d = 120 + rnd() * 260, L = 90 + rnd() * 200, W = 8 + rnd() * 18; qb.setFromAxisAngle(up, rnd() * Math.PI); cirrus.setMatrixAt(i, m.compose(new THREE.Vector3(center.x + Math.cos(a) * d, 170 + rnd() * 90, center.z + Math.sin(a) * d), qb.clone().multiply(qa), new THREE.Vector3(L, W, 1))); } }
  const trailMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uLight: shared.uLight },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uLight; varying vec2 vUv; void main(){ float along = smoothstep(0.0, 0.9, vUv.x); float across = pow(1.0 - abs(vUv.y * 2.0 - 1.0), 1.5); gl_FragColor = vec4(uLight, along * along * across * 0.75); }',
  });
  const trails = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), trailMat); const yaw = rnd() * Math.PI * 2;
    m.scale.set(420, 2.6, 1); m.rotation.set(-Math.PI / 2, 0, 0); m.frustumCulled = false; m.renderOrder = 1;
    const grp = new THREE.Group(); grp.add(m); grp.rotation.y = yaw; grp.position.set(center.x + (rnd() - 0.5) * 400, 300 + rnd() * 40, center.z + (rnd() - 0.5) * 400); grp.userData.dir = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); grp.visible = i < 2; g.add(grp); trails.push(grp);
  }
  let drift = 0, lonRot = 0;

  // ── birds: one instanced "V" each, flapping by scaling the wings through the matrix; they circle at different heights
  const birdGeo = new THREE.BufferGeometry(); birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.5, -1.1, 0.1, -0.2, 0, 0.05, 0, 0, 0, 0.5, 1.1, 0.1, -0.2, 0, 0.05, 0]), 3)); birdGeo.computeVertexNormals();
  const BN = 18, birds = inst(birdGeo, new THREE.MeshBasicMaterial({ color: 0xfff6e0, side: THREE.DoubleSide, fog: true }), BN), bd = [];
  for (let i = 0; i < BN; i++) { const flock = i % 6; bd.push({ r: R * 0.55 + flock * 12 + rnd() * 10, y: 22 + flock * 9 + rnd() * 8, a: rnd() * Math.PI * 2, sp: (0.05 + flock * 0.01) * (flock % 2 ? 1 : -1), ph: rnd() * 6.28, off: rnd() * 0.22 }); }

  // ── sky-whales: three huge calm creatures gliding in wide circles, a tail that sways
  const whaleMat = new THREE.MeshStandardMaterial({ color: 0xc9d6ff, emissive: 0x5a6fd0, emissiveIntensity: 0.3, flatShading: true, roughness: 0.7 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf3efff, flatShading: true });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xffc6e4, emissive: 0xf08fc0, emissiveIntensity: 0.4, flatShading: true });
  const whales = [];
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Group(), s = 0.9 + i * 0.25;
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), whaleMat); body.scale.set(14, 5.5, 5.5); w.add(body);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), bellyMat); belly.scale.set(11, 2.6, 4.6); belly.position.set(1, -2.4, 0); w.add(belly);
    const tail = new THREE.Group(); tail.position.set(-12, 0, 0); const stalk = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 6).rotateZ(Math.PI / 2).translate(-4, 0, 0), whaleMat); tail.add(stalk);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(-9.5, 0, 0), finMat); fl.scale.set(0.5, 1, 1.4); tail.add(fl); w.add(tail);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 4), finMat); fin.position.set(2, -3, 3.8); fin.rotation.set(0.6, 0, 0.5); w.add(fin); const fin2 = fin.clone(); fin2.position.z = -3.8; fin2.rotation.x = -0.6; w.add(fin2);
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0x1b1b3a })); eye.position.set(9.5, 0.9, 4.2); w.add(eye); const eye2 = eye.clone(); eye2.position.z = -4.2; w.add(eye2);
    w.scale.setScalar(s); w.userData = { tail, r: R + 110 + i * 40, y: 38 + i * 22, a: rnd() * 6.28, sp: 0.012 + i * 0.002 }; whales.push(w); g.add(w);
  }

  // ── fireflies: warm white glowing dots hovering in clusters around the central plaza (ambience, by day and night). One Points draw call; each dot twinkles in the shader.
  const FN = 84, fbase = new Float32Array(FN * 3), fpos = new Float32Array(FN * 3), fph = new Float32Array(FN), fsz = new Float32Array(FN), fsp = new Float32Array(FN);
  let fcount = 0;
  { const spots = 8, per = Math.ceil(FN / spots); for (let sp0 = 0; sp0 < spots && fcount < FN; sp0++) { const a = (sp0 / spots) * Math.PI * 2 + rnd() * 0.5, r = 6 + rnd() * 17, cx = center.x + Math.cos(a) * r, cz = center.z + Math.sin(a) * r;
    for (let k = 0; k < per && fcount < FN; k++, fcount++) { const i = fcount; fbase[i * 3] = cx + (rnd() - 0.5) * 6; fbase[i * 3 + 1] = 0.5 + rnd() * 2.1; fbase[i * 3 + 2] = cz + (rnd() - 0.5) * 6; fph[i] = rnd() * 6.28; fsz[i] = 0.55 + rnd() * 0.7; fsp[i] = 0.25 + rnd() * 0.5; } } }
  const fireN = fcount; fpos.set(fbase);
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fGeo.setAttribute('aPh', new THREE.BufferAttribute(fph, 1)); fGeo.setAttribute('aSz', new THREE.BufferAttribute(fsz, 1));
  const fMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uT: { value: 0 }, uScale: { value: 500 }, uK: { value: 0.8 } },
    vertexShader: 'attribute float aPh; attribute float aSz; uniform float uT; uniform float uScale; uniform float uK; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float tw = 0.55 + 0.45 * sin(uT * 1.8 + aPh * 3.0); vA = tw * uK; gl_PointSize = clamp(0.4 * aSz * uScale / max(0.5, -mv.z), 3.5, 44.0); }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float core = smoothstep(1.0, 0.0, d); float a = pow(core, 1.5) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.96, 0.72) * (0.65 + core * 0.9), a); }',
  });
  const fireflies = new THREE.Points(fGeo, fMat); fireflies.frustumCulled = false; fireflies.renderOrder = 4; g.add(fireflies); fGeo.setDrawRange(0, Math.min(fireN, 84));
  let fireShow = 84, fireK = 0.8;
  const setFireflies = (n) => { fireShow = Math.max(0, Math.min(fireN, Math.round(n))); fGeo.setDrawRange(0, fireShow); fireflies.visible = fireShow > 0; };

  // ── spores / fireflies drifting over the plaza and the promenade
  const SN = 110, sp = new Float32Array(SN * 3), sd = [];
  for (let i = 0; i < SN; i++) { const a = rnd() * 6.28, r = rnd() * (R + 10); sd.push({ a, r, y: 0.6 + rnd() * 9, ph: rnd() * 6.28, sp: 0.02 + rnd() * 0.05 }); }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spores = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xcffff0, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); spores.frustumCulled = false; g.add(spores);

  // ── aurora: two translucent ribbons high in the sky, colour-shifting
  const auroras = [];
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.PlaneGeometry(1, 1, 24, 1), pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k); pos.setZ(k, Math.sin(x * 9 + i) * 0.06); }
    // a soft curtain: bright lower edge fading upward, no hard rectangle edges, slowly folding rays
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 }, uAmt: { value: 0.4 }, uC1: { value: new THREE.Color(i ? 0x6dffc0 : 0xa98bff) }, uC2: { value: new THREE.Color(i ? 0x7fb6ff : 0xff8fe0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uT; uniform float uAmt; uniform vec3 uC1; uniform vec3 uC2; varying vec2 vUv; void main(){ float x = vUv.x, y = vUv.y; float edgeX = smoothstep(0.0, 0.22, x) * smoothstep(1.0, 0.78, x); float fold = 0.5 + 0.5 * sin(x * 18.0 + sin(x * 5.0 + uT * 0.15) * 2.0 + uT * 0.12); float rays = pow(0.5 + 0.5 * sin(x * 90.0 + fold * 6.0 + uT * 0.3), 2.0); float base = smoothstep(0.0, 0.14, y) * pow(1.0 - y, 1.9); float a = edgeX * base * (0.3 + 0.7 * rays) * (0.45 + 0.55 * fold) * uAmt; vec3 col = mix(uC1, uC2, y * 1.3); gl_FragColor = vec4(col * (0.8 + 0.6 * rays), a); }' });
    const m = new THREE.Mesh(geo, mat); m.scale.set(520, 120, 1); m.position.set(center.x + (i ? 160 : -140), 200, center.z - 380 + i * 60); m.rotation.y = (i ? -0.25 : 0.3); m.frustumCulled = false; g.add(m); auroras.push(m);
  }

  // ── inside the dome: glowing butterflies over the plaza and promenade, and slow jellyfish-lanterns drifting high above the heads
  const BF = 14, bfGeo = new THREE.BufferGeometry(); bfGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.5, 0.05, 0.35, -0.5, 0.05, -0.3, 0, 0, 0, 0.5, 0.05, 0.35, 0.5, 0.05, -0.3]), 3)); bfGeo.computeVertexNormals();
  const butter = inst(bfGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), BF), bf = [], tint = new THREE.Color();
  for (let i = 0; i < BF; i++) { bf.push({ cx: (rnd() - 0.5) * R * 1.1, cz: (rnd() - 0.5) * R * 1.1, r: 2 + rnd() * 5, y: 2.6 + rnd() * 3, sp: 0.4 + rnd() * 0.5, ph: rnd() * 6.28 }); butter.setColorAt(i, tint.setHSL([0.55, 0.88, 0.12, 0.78, 0.35][i % 5] + rnd() * 0.05, 0.8, 0.7)); }
  const JN = 4, jMat = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, emissive: 0x7fd0ff, emissiveIntensity: 1.3, transparent: true, opacity: 0.7, flatShading: true, depthWrite: false });
  const jelly = inst(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), jMat, JN), jd = [];
  for (let i = 0; i < JN; i++) jd.push({ a: rnd() * 6.28, r: 6 + rnd() * (R * 0.45), y: 7 + rnd() * 9, s: 0.9 + rnd() * 1.1, sp: (0.02 + rnd() * 0.03) * (i % 2 ? 1 : -1), ph: rnd() * 6.28 });

  // ── foggy dreams: low drifting mist banks with soft edges and a few faint light shafts (Sky: Children of the Light mood). 26 + 5 sprites, one shared texture each.
  const softTex = (vertical) => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); if (vertical) { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.globalCompositeOperation = 'destination-in'; const gh = x.createLinearGradient(0, 0, 128, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gh; x.fillRect(0, 0, 128, 128); } else { const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mistTex = softTex(false), shaftTex = softTex(true), dreamG = new THREE.Group(); dreamG.userData.keep = true; g.add(dreamG);
  const mist = [], shafts = []; let dream = 0.6, dreamLite = false; const mistCol = new THREE.Color(0xbfe3ee);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = 5 + Math.sqrt(rnd()) * Math.min(R * 0.62, 62), w = 14 + rnd() * 14;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: mistCol, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    sp.position.set(center.x + Math.cos(a) * r, 0.5 + rnd() * 1.1, center.z + Math.sin(a) * r); sp.scale.set(w, 3 + rnd() * 2.4, 1); sp.renderOrder = 3; sp.userData = { x0: sp.position.x, z0: sp.position.z, ph: rnd() * 6.28, base: 0.2 + rnd() * 0.14, w }; dreamG.add(sp); mist.push(sp);
  }
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * 40;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: shaftTex, color: 0xfff1d0, transparent: true, depthWrite: false, opacity: 0, fog: false, blending: THREE.AdditiveBlending }));
    sp.position.set(center.x + Math.cos(a) * r, 20, center.z + Math.sin(a) * r); sp.scale.set(4 + rnd() * 5, 38 + rnd() * 14, 1); sp.renderOrder = 3;
    sp.userData = { ph: rnd() * 6.28, base: 0.07 + rnd() * 0.05 }; dreamG.add(sp); shafts.push(sp);
  }
  const sstep = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const updateDream = (t) => {
    dreamG.visible = dream > 0.01 && camera.position.y < 70; if (!dreamG.visible) return;
    for (let i = 0; i < mist.length; i++) { const sp = mist[i], u = sp.userData, d = sp.position.distanceTo(camera.position); sp.position.x = u.x0 + Math.sin(t * 0.05 + u.ph) * 3; const o = u.base * dream * sstep(3, 15, d) * (1 - sstep(95, 170, d)) * (0.85 + 0.15 * Math.sin(t * 0.3 + u.ph)); sp.material.opacity = o; sp.visible = o > 0.006 && !(dreamLite && i % 2); }   // invisible sprites cost no fill-rate
    for (const sp of shafts) { const u = sp.userData, d = sp.position.distanceTo(camera.position); const o = u.base * dream * sstep(8, 26, d) * (1 - sstep(90, 160, d)) * (0.7 + 0.3 * Math.sin(t * 0.25 + u.ph)); sp.material.opacity = o; sp.visible = o > 0.004 && !dreamLite; }
  };
  const setDream = (k) => { dream = Math.max(0, Math.min(1, Number(k) || 0)); dreamG.visible = dream > 0.01; };

  const rot = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  const update = (dt, t) => {
    updateDream(t);
    if (fireShow > 0) {
      const cd = Math.hypot(camera.position.x - center.x, camera.position.z - center.z); fireflies.visible = cd < 95 && camera.position.y < 70;   /* center is a plain {x,z}, not a Vector3 */
      if (fireflies.visible) {
        for (let i = 0; i < fireShow; i++) { const sp1 = fsp[i], ph = fph[i]; fpos[i * 3] = fbase[i * 3] + Math.sin(t * sp1 + ph) * 0.9; fpos[i * 3 + 1] = fbase[i * 3 + 1] + Math.sin(t * 0.7 * sp1 + ph * 1.7) * 0.35; fpos[i * 3 + 2] = fbase[i * 3 + 2] + Math.cos(t * sp1 * 0.8 + ph) * 0.9; }
        fGeo.attributes.position.needsUpdate = true; fMat.uniforms.uT.value = t; fMat.uniforms.uK.value = fireK; fMat.uniforms.uScale.value = (renderer.domElement.height / 2) * camera.projectionMatrix.elements[5];
      }
    }
    cloudMat.uniforms.uScale.value = (renderer.domElement.height / 2) * camera.projectionMatrix.elements[5]; drift += dt * 0.0016; clouds.rotation.y = drift + lonRot; for (const tr of trails) { if (!tr.visible) continue; tr.position.addScaledVector(tr.userData.dir, dt * 14); if (Math.hypot(tr.position.x - center.x, tr.position.z - center.z) > 560) { tr.position.set(center.x - tr.userData.dir.x * 500 + (rnd() - 0.5) * 300, tr.position.y, center.z - tr.userData.dir.z * 500 + (rnd() - 0.5) * 300); } }
    for (let i = 0; i < BN; i++) {
      const b = bd[i]; b.a += b.sp * dt; const x = center.x + Math.cos(b.a) * b.r, z = center.z + Math.sin(b.a) * b.r, y = b.y + Math.sin(t * 0.8 + b.ph) * 1.4;
      rot.setFromAxisAngle(yAxis, -b.a + (b.sp > 0 ? 0 : Math.PI)); const flap = 0.25 + Math.abs(Math.sin(t * 7 + b.ph)) * 0.9;
      birds.setMatrixAt(i, m4.compose(v3.set(x, y, z), rot, sc.set(1.6, flap * 1.6, 1.6)));
    }
    birds.instanceMatrix.needsUpdate = true;
    for (const w of whales) { const u = w.userData; u.a += u.sp * dt; w.position.set(center.x + Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.25 + u.r) * 3, center.z + Math.sin(u.a) * u.r); w.rotation.y = -u.a - Math.PI / 2 * Math.sign(u.sp) + (u.sp > 0 ? Math.PI : 0); u.tail.rotation.y = Math.sin(t * 0.9 + u.r) * 0.35; w.rotation.z = Math.sin(t * 0.4 + u.r) * 0.05; }
    for (let i = 0; i < BF; i++) { const b = bf[i], a = t * b.sp + b.ph, fl = 0.2 + Math.abs(Math.sin(t * 9 + b.ph)) * 0.9; rot.setFromAxisAngle(yAxis, a + Math.PI / 2); butter.setMatrixAt(i, m4.compose(v3.set(center.x + b.cx + Math.cos(a) * b.r, b.y + Math.sin(a * 2) * 0.6, center.z + b.cz + Math.sin(a) * b.r), rot, sc.set(0.7, fl * 0.7, 0.7))); }
    butter.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < JN; i++) { const j = jd[i]; j.a += j.sp * dt; const pulse = 1 + Math.sin(t * 1.6 + j.ph) * 0.12; jelly.setMatrixAt(i, m4.compose(v3.set(center.x + Math.cos(j.a) * j.r, j.y + Math.sin(t * 0.5 + j.ph) * 0.8, center.z + Math.sin(j.a) * j.r), rot.identity(), sc.set(j.s * pulse, j.s * 0.7 * (2 - pulse), j.s * pulse))); }
    jelly.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < SN; i++) { const s = sd[i]; s.a += s.sp * dt * 0.15; sp[i * 3] = center.x + Math.cos(s.a) * s.r + Math.sin(t * 0.5 + s.ph) * 1.2; sp[i * 3 + 1] = s.y + Math.sin(t * 0.7 + s.ph) * 0.8; sp[i * 3 + 2] = center.z + Math.sin(s.a) * s.r + Math.cos(t * 0.45 + s.ph) * 1.2; }
    sGeo.attributes.position.needsUpdate = true; spores.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.3;
    auroras.forEach((m, i) => { m.material.uniforms.uT.value = t; m.material.uniforms.uAmt.value = 0.38 + Math.sin(t * 0.3 + i * 2) * 0.14; m.position.x += Math.sin(t * 0.05 + i) * dt * 0.8; });
  };
  const C = (h) => new THREE.Color(h);
  /** day 0..1, dusk 0..1, night 0..1 and the horizon colour (clouds fade into it) */
  const setSky = (day, dusk, night, hor) => {
    const u = cloudMat.uniforms;
    u.uLight.value.copy(C(0x4a5590)).lerp(C(0xffd4bc), 1 - night).lerp(C(0xffffff), day * (1 - dusk * 0.6));
    u.uShadow.value.copy(C(0x1c2147)).lerp(C(0x8f7aa8), 1 - night).lerp(C(0xaebbd8), day * (1 - dusk * 0.5));
    u.uFog.value.copy(hor); u.uGain.value = 0.55 + day * 0.2;
    mistCol.copy(hor).lerp(C(0x9fd9e6), 0.4).lerp(C(0xffffff), 0.15 * day);
    fireK = Math.max(0.75, Math.min(1.25, 0.75 + 0.5 * Math.max(night, dusk, 1 - day)));   /* softer in bright daylight, glowing at dusk and night */
    spores.visible = night > 0.3 || dusk > 0.6; auroras.forEach((m) => (m.visible = night > 0.55));
  };
  /** density, variety, cirrus, lon, lat are 0..1; contrails is a count 0..6 */
  const setClouds = (o) => {
    const u = cloudMat.uniforms;
    if (o.density != null) { u.uDensity.value = Math.min(1, o.density * 2); u.uBoost.value = 1 + Math.max(0, o.density - 0.5) * 1.4; }
    if (o.variety != null) u.uVar.value = o.variety;
    if (o.cirrus != null) { cirrus.count = Math.max(0, Math.min(CIR, Math.round(CIR * o.cirrus * 1.4))); cirrusMat.uniforms.uAmt.value = 0.35 + o.cirrus; cirrus.visible = o.cirrus > 0.01; }
    if (o.contrails != null) trails.forEach((tr, i) => (tr.visible = i < Math.min(1, Math.round(o.contrails))));
    if (o.lon != null) lonRot = (o.lon - 0.5) * Math.PI * 2;
    if (o.lat != null) clouds.scale.setScalar(0.7 + o.lat * 0.6);
  };
  const setDreamLite = (on) => { dreamLite = !!on; };
  return { update, setSky, setClouds, setDream, setDreamLite, setFireflies, group: g };
}
