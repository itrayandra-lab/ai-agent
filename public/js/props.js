// Division décor kit: small, flat-shaded props built from the shared furniture geometry cache (so they merge into a few draw calls).
// Every builder returns a Group standing on the floor, front facing +Z. "Rim" props are slim (≤0.45 m deep) so they sit between the desks and the glass.
import * as THREE from 'three';

export function makeProps(F) {
  const { box, cyl, put, M } = F;
  const sphC = new Map();
  const sph = (r) => { const k = r; if (!sphC.has(k)) sphC.set(k, new THREE.SphereGeometry(r, 8, 6)); return sphC.get(k); };
  const mats = new Map();
  const C = (hex, rough = 0.6, metal = 0.1, emis = 0) => {
    const k = `${hex}|${rough}|${metal}|${emis}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, flatShading: true, ...(emis ? { emissive: hex, emissiveIntensity: emis } : {}) }));
    return mats.get(k);
  };
  const GL = (hex, k = 1.1) => C(hex, 0.4, 0, k); // glowing little parts
  const nc = { cast: false };
  const PAL = [0xf26b6b, 0xf2c14e, 0x6bc4a6, 0x6b9bf2, 0xb08cff, 0xff9a62, 0xf5f5f5, 0x7a8db3];
  const pick = (k) => PAL[((k % PAL.length) + PAL.length) % PAL.length];
  const G = () => new THREE.Group();

  const P = {
    locker(w = 1.2, hex = 0x8fa3c7) {
      const g = G(); const n = Math.max(2, Math.round(w / 0.4)), cw = w / n;
      put(g, box(w, 1.9, 0.4), C(0x59627a, 0.5, 0.5), 0, 0.95, 0);
      for (let i = 0; i < n; i++) { const x = -w / 2 + cw * (i + 0.5); put(g, box(cw - 0.03, 1.8, 0.02), C(hex, 0.45, 0.4), x, 0.95, 0.21, nc); for (let v = 0; v < 3; v++) put(g, box(cw * 0.55, 0.012, 0.01), C(0x2a3042), x, 1.55 + v * 0.05, 0.225, nc); put(g, box(0.03, 0.12, 0.03), C(0xdfe3e8, 0.2, 1), x + cw * 0.3, 0.95, 0.24, nc); }
      return g;
    },
    cabinet(w = 0.8, hex = 0xc9d0e6) {
      const g = G(); put(g, box(w, 1.3, 0.42), C(hex, 0.5, 0.3), 0, 0.65, 0);
      for (let i = 0; i < 4; i++) { put(g, box(w - 0.06, 0.28, 0.02), C(hex, 0.5, 0.3), 0, 0.17 + i * 0.32, 0.215, nc); put(g, box(0.2, 0.03, 0.03), C(0xdfe3e8, 0.2, 1), 0, 0.22 + i * 0.32, 0.24, nc); }
      return g;
    },
    shelfCrates(w = 1.4, h = 2) {
      const g = G(); for (const sx of [-1, 1]) put(g, box(0.06, h, 0.4), C(0x59627a, 0.5, 0.5), sx * (w / 2 - 0.03), h / 2, 0, nc);
      for (let l = 0; l < 4; l++) { const y = 0.1 + l * (h - 0.2) / 3; put(g, box(w, 0.05, 0.4), C(0x6e7894, 0.5, 0.5), 0, y, 0, nc); for (let k = 0; k < 3; k++) put(g, box(0.38, 0.34, 0.3, 0.03), (k + l) % 3 ? M.cardboard : C(pick(k + l), 0.7), -w / 3 + k * w / 3, y + 0.2, 0, nc); }
      return g;
    },
    shelfBottles(w = 1.4, h = 1.9, hue = 0) {
      const g = G(); put(g, box(w, h, 0.34), C(0xeceff8, 0.4, 0.2), 0, h / 2, -0.03);
      for (let l = 0; l < 4; l++) { const y = 0.3 + l * 0.46; put(g, box(w - 0.06, 0.03, 0.34), C(0xbcc4dc, 0.3, 0.5), 0, y, 0.02, nc); for (let k = 0; k < 7; k++) { const x = -w / 2 + 0.16 + k * (w - 0.32) / 6; put(g, cyl(0.035, 0.04, 0.17 + (k % 3) * 0.03, 6), C(pick(k + l + hue), 0.2, 0, 0.12), x, y + 0.11, 0.06, nc); } }
      return g;
    },
    pegboard(w = 1.6) {
      const g = G(); put(g, box(w, 1.1, 0.05), C(0xd3b98f, 0.9), 0, 1.55, 0);
      put(g, box(w + 0.06, 0.05, 0.4), C(0x8b6f4e, 0.6), 0, 0.95, 0.17, nc);
      for (let k = 0; k < 6; k++) { const x = -w / 2 + 0.2 + k * (w - 0.4) / 5; put(g, box(0.035, 0.4 + (k % 3) * 0.08, 0.03), C(k % 2 ? 0xd9dde6 : 0xf2c14e, 0.3, 0.7), x, 1.55, 0.04, nc); put(g, box(0.1, 0.1, 0.03), C(pick(k), 0.5), x, 1.2, 0.04, nc); }
      for (let k = 0; k < 4; k++) put(g, box(0.2, 0.12, 0.2), C(pick(k + 2), 0.5), -w / 2 + 0.3 + k * 0.45, 1.03, 0.2, nc);
      return g;
    },
    monitorWall(w = 2.2, hue = 0x4dd4ff) {
      const g = G(); put(g, box(w, 1.2, 0.06), C(0x1b2236, 0.4, 0.5), 0, 1.6, 0);
      const n = Math.max(2, Math.round(w / 0.7)); for (let k = 0; k < n; k++) put(g, box(w / n - 0.05, 1.05, 0.02), GL([hue, 0x7be0a8, 0xb08cff, 0xffb36b][k % 4], 0.9), -w / 2 + (k + 0.5) * w / n, 1.6, 0.04, nc);
      put(g, box(w * 0.7, 0.9, 0.3), C(0x1b2236, 0.4, 0.5), 0, 0.45, -0.02, nc);
      return g;
    },
    notice(w = 1.5, hex = 0xf2d39b) {
      const g = G(); put(g, box(w, 1.0, 0.04), C(0xb7bfd8, 0.5, 0.6), 0, 1.7, 0); put(g, box(w - 0.1, 0.9, 0.02), C(hex, 0.95), 0, 1.7, 0.03, nc);
      for (let k = 0; k < 8; k++) put(g, box(0.18, 0.18, 0.01), C(pick(k + 1), 0.8), -w / 2 + 0.2 + (k % 4) * 0.34, 1.9 - Math.floor(k / 4) * 0.34, 0.045, { cast: false, ry: 0, rz: (k % 3 - 1) * 0.08 });
      return g;
    },
    trophy(w = 1.1) {
      const g = G(); put(g, box(w, 0.9, 0.4), C(0x7a6350, 0.6), 0, 0.45, 0); put(g, box(w - 0.1, 0.8, 0.34), C(0xcfe8ff, 0.1, 0, 0.1), 0, 1.35, 0, nc);
      for (let k = 0; k < 3; k++) { put(g, cyl(0.09, 0.05, 0.16, 8), C(0xf2c14e, 0.25, 0.9), -w / 3 + k * w / 3, 1.0, 0, nc); put(g, cyl(0.02, 0.02, 0.12, 6), C(0xf2c14e, 0.25, 0.9), -w / 3 + k * w / 3, 0.88, 0, nc); put(g, sph(0.07), C(0xf2c14e, 0.25, 0.9), -w / 3 + k * w / 3, 1.2 + (k % 2) * 0.2, 0, nc); }
      return g;
    },
    garmentRack(w = 1.4) {
      const g = G(); for (const sx of [-1, 1]) put(g, box(0.04, 1.6, 0.04), C(0xdfe3e8, 0.2, 1), sx * (w / 2), 0.8, 0, nc); put(g, cyl(0.015, 0.015, w, 5), C(0xdfe3e8, 0.2, 1), 0, 1.55, 0, { rz: Math.PI / 2, cast: false });
      for (let k = 0; k < 9; k++) put(g, box(0.1, 0.72 + (k % 3) * 0.08, 0.3), C(pick(k + 3), 0.9), -w / 2 + 0.14 + k * (w - 0.28) / 8, 1.14 - (k % 3) * 0.03, 0, nc);
      for (const sx of [-1, 1]) put(g, box(0.05, 0.04, 0.4), C(0xdfe3e8, 0.2, 1), sx * w / 2, 0.03, 0, nc);
      return g;
    },
    perfumeStand(w = 1.0, hex = 0xffd1e2) {
      const g = G(); for (let l = 0; l < 3; l++) { const ww = w - l * 0.28; put(g, box(ww, 0.14, 0.4 - l * 0.08), C(hex, 0.3, 0.1), 0, 0.14 + l * 0.34, 0, nc); for (let k = 0; k < 4 - l; k++) { const x = -ww / 2 + 0.12 + k * (ww - 0.24) / Math.max(1, 3 - l); put(g, box(0.1, 0.16 + (k % 2) * 0.05, 0.08, 0.02), C(pick(k + l), 0.15, 0.2, 0.2), x, 0.3 + l * 0.34, 0, nc); put(g, cyl(0.025, 0.025, 0.04, 6), C(0xf2c14e, 0.2, 0.9), x, 0.42 + l * 0.34 + (k % 2) * 0.03, 0, nc); } }
      put(g, box(w, 1.0, 0.06), C(hex, 0.5), 0, 1.4, -0.17, nc); put(g, box(w * 0.7, 0.1, 0.02), GL(0xffffff, 0.7), 0, 1.75, -0.13, nc);
      return g;
    },
    barrel(hex = 0x4aa3d9) { const g = G(); put(g, cyl(0.26, 0.26, 0.7, 6), C(hex, 0.45, 0.3), 0, 0.35, 0, nc); for (const y of [0.18, 0.52]) put(g, cyl(0.275, 0.275, 0.03, 6), C(0x2c3550, 0.5, 0.5), 0, y, 0, nc); put(g, cyl(0.07, 0.07, 0.03, 6), C(0xdfe3e8, 0.3, 0.8), 0, 0.71, 0, nc); return g; },
    gasTanks(n = 3) { const g = G(); for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * 0.32; put(g, cyl(0.13, 0.13, 1.0, 8), C(pick(k + 1), 0.4, 0.5), x, 0.55, 0, nc); put(g, sph(0.13), C(pick(k + 1), 0.4, 0.5), x, 1.05, 0, nc); put(g, cyl(0.03, 0.03, 0.1, 6), C(0xdfe3e8, 0.3, 0.9), x, 1.22, 0, nc); } return g; },
    sacks(n = 4) { const g = G(); for (let k = 0; k < n; k++) put(g, box(0.5, 0.18, 0.34, 0.07), C(k % 2 ? 0xe5d4b4 : 0xd9c39c, 0.95), (k % 2) * 0.1 - 0.2, 0.1 + Math.floor(k / 2) * 0.17, (k % 2) * 0.05, { cast: false, ry: k * 0.2 }); return g; },
    cooler() { const g = G(); put(g, box(0.34, 0.9, 0.34, 0.04), C(0xe9edf8, 0.4, 0.2), 0, 0.45, 0, nc); put(g, cyl(0.15, 0.15, 0.45, 8), C(0x8fd0ff, 0.1, 0, 0.35), 0, 1.15, 0, nc); put(g, box(0.1, 0.04, 0.05), C(0x4aa3d9), 0, 0.78, 0.18, nc); return g; },
    printer() { const g = G(); put(g, box(0.7, 0.75, 0.5, 0.04), C(0xdfe3ec, 0.5, 0.2), 0, 0.38, 0, nc); put(g, box(0.5, 0.02, 0.28), C(0x3b4260), 0, 0.77, 0, nc); put(g, box(0.4, 0.04, 0.2), C(0xffffff, 0.9), 0.0, 0.8, 0.08, { cast: false, rx: -0.2 }); put(g, box(0.1, 0.05, 0.02), GL(0x7be0a8), 0.25, 0.6, 0.26, nc); return g; },
    vending(hex = 0xff7a8a) { const g = G(); put(g, box(0.9, 1.85, 0.5, 0.04), C(hex, 0.4, 0.3), 0, 0.93, 0, nc); put(g, box(0.62, 1.15, 0.02), C(0xcfe8ff, 0.1, 0, 0.25), -0.08, 1.12, 0.26, nc); for (let r2 = 0; r2 < 4; r2++) for (let k = 0; k < 4; k++) put(g, box(0.1, 0.12, 0.04), C(pick(r2 * 4 + k), 0.4), -0.28 + k * 0.13, 0.78 + r2 * 0.28, 0.27, nc); put(g, box(0.12, 0.5, 0.02), C(0x1b2236), 0.34, 1.2, 0.26, nc); put(g, box(0.5, 0.1, 0.02), GL(0xffffff, 0.8), 0, 1.75, 0.26, nc); return g; },
    globe() { const g = G(); put(g, cyl(0.12, 0.14, 0.05, 8), C(0x59627a, 0.4, 0.6), 0, 0.03, 0, nc); put(g, cyl(0.02, 0.02, 0.9, 5), C(0x59627a, 0.4, 0.6), 0, 0.5, 0, nc); put(g, sph(0.32), C(0x4aa3d9, 0.4), 0, 1.12, 0, nc); put(g, new THREE.TorusGeometry(0.34, 0.012, 4, 20), C(0xf2c14e, 0.3, 0.9), 0, 1.12, 0, { cast: false, rx: 1.2 }); for (let k = 0; k < 4; k++) put(g, sph(0.1), C(0x7bc99a, 0.8), Math.sin(k * 1.9) * 0.22, 1.12 + Math.cos(k * 2.3) * 0.18, Math.cos(k * 1.9) * 0.22, nc); return g; },
    scales() { const g = G(); put(g, cyl(0.2, 0.26, 0.06, 8), C(0x59627a, 0.3, 0.7), 0, 0.03, 0, nc); put(g, cyl(0.025, 0.025, 1.0, 5), C(0xf2c14e, 0.3, 0.9), 0, 0.55, 0, nc); put(g, box(0.9, 0.025, 0.03), C(0xf2c14e, 0.3, 0.9), 0, 1.05, 0, nc); for (const sx of [-1, 1]) { put(g, cyl(0.012, 0.012, 0.3, 4), C(0xf2c14e, 0.3, 0.9), sx * 0.4, 0.88, 0, nc); put(g, cyl(0.15, 0.05, 0.03, 10), C(0xf2c14e, 0.3, 0.9), sx * 0.4, 0.72, 0, nc); } return g; },
    safe() { const g = G(); put(g, box(0.8, 0.9, 0.5, 0.04), C(0x3b4260, 0.4, 0.8), 0, 0.45, 0, nc); put(g, cyl(0.12, 0.12, 0.04, 14), C(0xdfe3e8, 0.2, 1), 0, 0.5, 0.26, { rx: Math.PI / 2, cast: false }); put(g, box(0.05, 0.3, 0.04), C(0xdfe3e8, 0.2, 1), 0.26, 0.5, 0.26, nc); return g; },
    coinTower() { const g = G(); put(g, cyl(0.28, 0.32, 0.5, 8), C(0x3b4260, 0.4, 0.5), 0, 0.25, 0, nc); for (let k = 0; k < 3; k++) { put(g, cyl(0.18 - k * 0.03, 0.18 - k * 0.03, 0.07, 14), C(0xf2c14e, 0.25, 0.9, 0.12), 0, 0.55 + k * 0.1, 0, nc); } put(g, cyl(0.02, 0.02, 0.6, 4), GL(0xf2c14e, 0.5), 0.3, 1.0, 0, nc); return g; },
    barChart(hue = 0x9be15d) { const g = G(); put(g, box(1.0, 0.08, 0.34), C(0x3b4260, 0.4, 0.5), 0, 0.04, 0, nc); for (let k = 0; k < 5; k++) { const h = 0.35 + k * 0.22; put(g, box(0.12, h, 0.12), GL(hue, 0.55 + k * 0.1), -0.38 + k * 0.19, 0.08 + h / 2, 0, nc); } put(g, box(0.9, 0.02, 0.02), GL(0xffffff, 0.6), 0, 1.4, -0.12, { cast: false, rz: 0.4 }); return g; },
    holoPillar(hue = 0x8fd0ff) { const g = G(); put(g, cyl(0.2, 0.26, 0.5, 8), C(0x2b3350, 0.4, 0.6), 0, 0.25, 0, nc); put(g, new THREE.TorusGeometry(0.2, 0.012, 4, 20), GL(hue, 1.3), 0, 0.52, 0, { cast: false, rx: Math.PI / 2 }); put(g, new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.55, depthWrite: false }), 0, 0.95, 0, nc).userData.holo = true; return g; },
    flipchart() { const g = G(); for (const sx of [-1, 1]) put(g, box(0.03, 1.8, 0.03), C(0xb9bdc3, 0.3, 0.9), sx * 0.34, 0.9, -0.06, nc); put(g, box(0.7, 0.95, 0.03), C(0xfdfdfd, 0.9), 0, 1.35, 0, nc); put(g, box(0.5, 0.04, 0.01), C(0x5b8cff), 0, 1.6, 0.02, nc); put(g, box(0.42, 0.04, 0.01), C(0xf26b6b), 0, 1.48, 0.02, nc); put(g, box(0.5, 0.04, 0.01), C(0x6bc4a6), 0, 1.3, 0.02, nc); put(g, box(0.7, 0.04, 0.14), C(0xb9bdc3, 0.3, 0.9), 0, 0.9, 0.06, nc); return g; },
    microscope() { const g = G(); put(g, box(0.9, 0.06, 0.5, 0.02), C(0xf3f5f4, 0.4), 0, 0.8, 0, nc); for (const sx of [-1, 1]) put(g, box(0.05, 0.8, 0.05), C(0xb9bdc3, 0.3, 0.9), sx * 0.4, 0.4, 0, nc); put(g, box(0.16, 0.05, 0.2), C(0x2b3350, 0.4, 0.5), 0, 0.85, 0, nc); put(g, cyl(0.025, 0.03, 0.3, 6), C(0xe9edf8, 0.3, 0.6), 0, 1.02, -0.04, { rx: -0.3, cast: false }); put(g, box(0.05, 0.22, 0.05), C(0x2b3350, 0.4, 0.5), 0, 0.97, -0.09, nc); put(g, box(0.2, 0.01, 0.1, 0.005), GL(0xaee4ff, 0.8), 0, 0.84, 0.0, nc); for (let k = 0; k < 3; k++) put(g, cyl(0.04, 0.04, 0.16, 8), C(pick(k + 3), 0.15, 0, 0.2), -0.3 + k * 0.1, 0.9, 0.1, nc); return g; },
    sampleJars(w = 1.2) { const g = G(); put(g, box(w, 0.05, 0.36), C(0xeceff8, 0.4, 0.2), 0, 1.0, 0, nc); put(g, box(w, 0.05, 0.36), C(0xeceff8, 0.4, 0.2), 0, 1.5, 0, nc); put(g, box(w, 1.55, 0.02), C(0xbcc4dc, 0.4, 0.3), 0, 0.78, -0.17, nc); for (let l = 0; l < 2; l++) for (let k = 0; k < 6; k++) put(g, cyl(0.045, 0.045, 0.14, 8), C(pick(k + l * 3), 0.15, 0, 0.18), -w / 2 + 0.12 + k * (w - 0.24) / 5, 1.1 + l * 0.5, 0, nc); put(g, box(w, 0.9, 0.34), C(0xe9edf8, 0.4, 0.2), 0, 0.45, 0, nc); return g; },
    tripodSoftbox(hue = 0xfff1d6) { const g = G(); for (let k = 0; k < 3; k++) { const a = k * 2.1; put(g, cyl(0.012, 0.012, 1.4, 4), C(0x2b3350, 0.4, 0.6), Math.sin(a) * 0.22, 0.65, Math.cos(a) * 0.22, { rx: Math.cos(a) * 0.2, rz: -Math.sin(a) * 0.2, cast: false }); } put(g, cyl(0.02, 0.02, 0.8, 4), C(0x2b3350, 0.4, 0.6), 0, 1.5, 0, nc); put(g, box(0.62, 0.62, 0.16), C(0x2b3350, 0.5, 0.4), 0, 1.95, 0, nc); put(g, box(0.56, 0.56, 0.02), GL(hue, 1.0), 0, 1.95, 0.09, nc); return g; },
    backdrop(hex = 0xffd1e2, w = 2.2) { const g = G(); put(g, cyl(0.03, 0.03, w + 0.3, 6), C(0x2b3350, 0.4, 0.6), 0, 2.3, 0, { rz: Math.PI / 2, cast: false }); put(g, box(w, 2.2, 0.03), C(hex, 0.9), 0, 1.15, 0, nc); for (const sx of [-1, 1]) put(g, box(0.04, 2.3, 0.04), C(0x2b3350, 0.4, 0.6), sx * (w / 2 + 0.1), 1.15, -0.02, nc); return g; },
    micBoom() { const g = G(); put(g, cyl(0.1, 0.12, 0.04, 8), C(0x2b3350, 0.4, 0.6), 0, 0.02, 0, nc); put(g, cyl(0.015, 0.015, 1.6, 4), C(0x2b3350, 0.4, 0.6), 0, 0.8, 0, nc); put(g, cyl(0.012, 0.012, 0.7, 4), C(0x2b3350, 0.4, 0.6), 0.2, 1.6, 0, { rz: Math.PI / 2 - 0.2, cast: false }); put(g, cyl(0.045, 0.045, 0.2, 8), C(0x1b2236, 0.7), 0.5, 1.55, 0, { rz: Math.PI / 2 - 0.2, cast: false }); return g; },
    flagPair(a = 0xf26b6b, b = 0x5b8cff) { const g = G(); [[-0.3, a], [0.3, b]].forEach(([x, c]) => { put(g, cyl(0.012, 0.012, 1.8, 4), C(0xdfe3e8, 0.2, 1), x, 0.9, 0, nc); put(g, box(0.5, 0.32, 0.01), C(c, 0.8), x + 0.27, 1.62, 0, nc); put(g, cyl(0.1, 0.12, 0.04, 8), C(0x59627a, 0.4, 0.6), x, 0.02, 0, nc); }); return g; },
    handshakeSign(hex = 0x4dd4ac) { const g = G(); put(g, cyl(0.02, 0.02, 1.2, 5), C(0xdfe3e8, 0.2, 1), 0, 0.6, 0, nc); put(g, box(0.9, 0.55, 0.05, 0.03), C(0x2b3350, 0.5, 0.4), 0, 1.4, 0, nc); put(g, box(0.8, 0.45, 0.02, 0.02), GL(hex, 0.8), 0, 1.4, 0.03, nc); put(g, cyl(0.2, 0.24, 0.05, 8), C(0x2b3350, 0.5, 0.4), 0, 0.03, 0, nc); return g; },
    parcels(n = 5) { const g = G(); for (let k = 0; k < n; k++) { const w = 0.4 + (k % 3) * 0.1, h = 0.26 + (k % 2) * 0.12; put(g, box(w, h, 0.36, 0.02), k % 3 ? M.cardboard : C(pick(k), 0.7), (k % 3 - 1) * 0.42, h / 2 + Math.floor(k / 3) * 0.32, 0, { cast: false, ry: (k % 2) * 0.12 }); put(g, box(0.05, h + 0.01, 0.37), C(0xf5f5f5, 0.8), (k % 3 - 1) * 0.42, h / 2 + Math.floor(k / 3) * 0.32, 0, nc); } return g; },
    trolley(hex = 0xff9a62) { const g = G(); put(g, box(0.8, 0.06, 0.5), C(0x59627a, 0.4, 0.6), 0, 0.2, 0, nc); put(g, box(0.8, 0.04, 0.5), C(0x59627a, 0.4, 0.6), 0, 0.8, 0, nc); for (const sx of [-1, 1]) put(g, box(0.04, 0.8, 0.04), C(0xdfe3e8, 0.2, 1), sx * 0.38, 0.5, -0.2, nc); put(g, box(0.76, 0.04, 0.04), C(0xdfe3e8, 0.2, 1), 0, 1.0, -0.2, nc); for (let k = 0; k < 3; k++) put(g, box(0.3, 0.22, 0.3, 0.03), C(pick(k + 2), 0.7), -0.25 + k * 0.25, 0.34, 0, nc); put(g, box(0.4, 0.22, 0.34, 0.03), C(hex, 0.7), 0, 0.93, 0, nc); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, cyl(0.05, 0.05, 0.04, 8), C(0x1b2236), x * 0.36, 0.05, z * 0.2, { rz: Math.PI / 2, cast: false }); return g; },
    mannequin(hex = 0xffd1e2) { const g = G(); put(g, cyl(0.2, 0.22, 0.03, 8), C(0x2b3350, 0.4, 0.6), 0, 0.02, 0, nc); put(g, cyl(0.015, 0.015, 0.9, 4), C(0xdfe3e8, 0.2, 1), 0, 0.5, 0, nc); put(g, box(0.32, 0.5, 0.18, 0.08), C(hex, 0.8), 0, 1.2, 0, nc); put(g, sph(0.1), C(0xf1e6dc, 0.8), 0, 1.58, 0, nc); put(g, cyl(0.15, 0.2, 0.5, 8), C(hex, 0.8), 0, 0.82, 0, nc); return g; },
    standSign(text = 0) { const g = G(); put(g, box(0.05, 1.2, 0.05), C(0xdfe3e8, 0.2, 1), 0, 0.6, 0, nc); put(g, box(0.7, 0.9, 0.04, 0.02), C(0xf5f5f5, 0.8), 0, 1.45, 0, nc); for (let k = 0; k < 4; k++) put(g, box(0.5 - k * 0.07, 0.04, 0.01), C(pick(k + text), 0.8), 0, 1.75 - k * 0.18, 0.025, nc); put(g, box(0.36, 0.03, 0.2), C(0xdfe3e8, 0.2, 1), 0, 0.015, 0, nc); return g; },
    serverMini() { const g = G(); put(g, box(0.5, 1.5, 0.45), C(0x1f2638, 0.4, 0.7), 0, 0.75, 0, nc); for (let k = 0; k < 9; k++) { put(g, box(0.42, 0.06, 0.01), C(0x2b3350, 0.4, 0.5), 0, 0.2 + k * 0.15, 0.23, nc); put(g, box(0.03, 0.03, 0.012), GL(k % 3 ? 0x3ddc84 : 0x5b8cff, 1.2), -0.16, 0.2 + k * 0.15, 0.235, nc); put(g, box(0.03, 0.03, 0.012), GL(k % 4 ? 0x5b8cff : 0xffb36b, 1.2), -0.1, 0.2 + k * 0.15, 0.235, nc); } return g; },
    cableDrum() { const g = G(); put(g, cyl(0.38, 0.38, 0.06, 10), C(0xd3ba98, 0.9), 0, 0.03, 0, nc); put(g, cyl(0.38, 0.38, 0.06, 10), C(0xd3ba98, 0.9), 0, 0.42, 0, nc); put(g, cyl(0.2, 0.2, 0.36, 10), C(0x5b8cff, 0.6), 0, 0.22, 0, nc); return g; },
    craneArm() { const g = G(); put(g, box(0.16, 1.9, 0.16), C(0xf2c14e, 0.5, 0.3), 0, 0.95, 0, nc); put(g, box(1.3, 0.12, 0.12), C(0xf2c14e, 0.5, 0.3), 0.5, 1.9, 0, nc); put(g, box(0.02, 0.6, 0.02), C(0x2b3350), 1.0, 1.55, 0, nc); put(g, box(0.18, 0.14, 0.18), C(0xd9dde6, 0.3, 0.8), 1.0, 1.2, 0, nc); put(g, box(0.5, 0.1, 0.4), C(0x59627a, 0.5, 0.5), 0, 0.05, 0, nc); return g; },
    pot(hex = 0x7bc99a) { const g = G(); put(g, cyl(0.22, 0.17, 0.32, 8), C(0xe2b49c, 0.85), 0, 0.16, 0, nc); put(g, sph(0.3), C(hex, 0.85), 0, 0.58, 0, nc); put(g, sph(0.2), C(hex, 0.85), 0.14, 0.86, 0.04, nc); return g; },
    planterBox(w = 1.2, hex = 0x86c49a) { const g = G(); put(g, box(w, 0.5, 0.4, 0.04), C(0xd8d2c8, 0.7), 0, 0.25, 0, nc); for (let k = 0; k < 5; k++) put(g, sph(0.2 + (k % 2) * 0.05), C(hex, 0.85), -w / 2 + 0.2 + k * (w - 0.4) / 4, 0.62, 0, nc); return g; },
    bookStack() { const g = G(); put(g, box(0.9, 0.5, 0.4), C(0x8b6f4e, 0.6), 0, 0.25, 0, nc); for (let k = 0; k < 7; k++) put(g, box(0.07, 0.3 + (k % 3) * 0.05, 0.22), C(pick(k + 4), 0.9), -0.3 + k * 0.1, 0.65 + (k % 3) * 0.025, 0, nc); return g; },
    wallScreen(hue = 0x4dd4ff, w = 1.6) { const g = G(); put(g, box(w, 0.9, 0.05), C(0x1b2236, 0.4, 0.5), 0, 2.1, 0, nc); put(g, box(w - 0.08, 0.82, 0.02), GL(hue, 0.85), 0, 2.1, 0.03, nc); for (let k = 0; k < 4; k++) put(g, box(w * (0.3 + (k % 3) * 0.15), 0.06, 0.01), C(0xffffff, 0.5, 0, 0.5), -w * 0.12 + (k % 2) * 0.05, 2.35 - k * 0.15, 0.045, nc); return g; },
    banner(hex = 0xffffff, h = 1.3) { const g = G(); put(g, box(0.62, h, 0.03), C(hex, 0.7, 0, 0.18), 0, 3.0, 0, nc); put(g, box(0.5, 0.05, 0.035), C(0xffffff, 0.5, 0, 0.6), 0, 3.0 + h * 0.32, 0.003, nc); put(g, box(0.5, 0.05, 0.035), C(0xffffff, 0.5, 0, 0.6), 0, 3.0, 0.003, nc); put(g, cyl(0.02, 0.02, 0.7, 5), C(0xdfe3e8, 0.2, 1), 0, 3.0 + h / 2 + 0.02, 0, { rz: Math.PI / 2, cast: false }); return g; },
    pods() { const g = G(); for (let k = 0; k < 3; k++) { put(g, box(0.5, 0.36, 0.5, 0.12), C(pick(k + 1), 0.95), (k - 1) * 0.55, 0.18, 0, nc); } return g; },
    headset() { const g = G(); put(g, cyl(0.16, 0.18, 0.04, 8), C(0x59627a, 0.4, 0.6), 0, 0.02, 0, nc); put(g, new THREE.TorusGeometry(0.14, 0.02, 4, 12, Math.PI), C(0x2b3350, 0.5, 0.4), 0, 0.3, 0, { cast: false }); put(g, cyl(0.025, 0.025, 0.3, 4), C(0x59627a, 0.4, 0.6), 0, 0.17, 0, nc); for (const sx of [-1, 1]) put(g, cyl(0.05, 0.05, 0.04, 8), C(0x2b3350, 0.5, 0.4), sx * 0.14, 0.3, 0, { rz: Math.PI / 2, cast: false }); return g; },
  };

  // ── tiny desk-top items, one flavour per division, laid on a desk (y = 0.765) ─────────────
  const T = (g, geo, mat, x, y, z, o = nc) => put(g, geo, mat, x, y, z, o);
  const DESK = {
    fin: (g, x) => { for (let k = 0; k < 3; k++) T(g, cyl(0.04, 0.04, 0.02, 10), C(0xf2c14e, 0.25, 0.9), x, 0.78 + k * 0.022, 0.18); T(g, box(0.1, 0.02, 0.14), C(0x2b3350), x - 0.14, 0.775, 0.12); },
    legal: (g, x) => { T(g, cyl(0.025, 0.025, 0.12, 6), C(0x8b6f4e, 0.6), x, 0.8, 0.16, { cast: false, rz: Math.PI / 2 }); T(g, cyl(0.03, 0.03, 0.06, 8), C(0x8b6f4e, 0.6), x - 0.06, 0.8, 0.16); T(g, box(0.16, 0.05, 0.2), C(0x6b3a3a, 0.7), x + 0.16, 0.79, 0.1); },
    design: (g, x) => { for (let k = 0; k < 5; k++) T(g, box(0.03, 0.01, 0.14), C(pick(k), 0.7), x + (k - 2) * 0.025, 0.772, 0.16, { cast: false, ry: (k - 2) * 0.22 }); T(g, box(0.2, 0.01, 0.14), C(0x1b2236), x - 0.2, 0.77, 0.12); },
    mkt: (g, x) => { T(g, cyl(0.02, 0.05, 0.12, 8), C(0xff6b8b, 0.5), x, 0.82, 0.16, { cast: false, rz: Math.PI / 2 }); T(g, cyl(0.07, 0.07, 0.02, 8), C(0xf2c14e, 0.4), x + 0.07, 0.82, 0.16, { cast: false, rz: Math.PI / 2 }); },
    sales: (g, x) => { T(g, cyl(0.05, 0.03, 0.1, 8), C(0xf2c14e, 0.25, 0.9), x, 0.82, 0.16); T(g, cyl(0.025, 0.025, 0.07, 6), C(0xf2c14e, 0.25, 0.9), x, 0.9, 0.16); T(g, sph(0.04), C(0xf2c14e, 0.25, 0.9), x, 0.96, 0.16); },
    eng: (g, x) => { T(g, sph(0.05), C(0xf2c14e, 0.5), x, 0.8, 0.17); T(g, box(0.04, 0.02, 0.03), C(0xff7a3c), x, 0.8, 0.22); T(g, box(0.14, 0.012, 0.1), C(0x2b3350), x - 0.16, 0.77, 0.12); T(g, box(0.1, 0.1, 0.1), C(0x6bc4a6, 0.6), x + 0.17, 0.815, 0.1); },
    it: (g, x) => { T(g, box(0.12, 0.04, 0.1), C(0x1f2638, 0.4, 0.7), x, 0.785, 0.16); T(g, box(0.02, 0.02, 0.012), GL(0x3ddc84), x - 0.04, 0.79, 0.215); T(g, box(0.05, 0.015, 0.02), C(0xdfe3e8, 0.3, 0.8), x + 0.14, 0.773, 0.1); },
    data: (g, x) => { for (let k = 0; k < 4; k++) T(g, box(0.04, 0.04 + k * 0.03, 0.04), GL(0xffd166, 0.6), x + (k - 1.5) * 0.06, 0.765 + (0.04 + k * 0.03) / 2, 0.16); },
    hr: (g, x) => { T(g, cyl(0.05, 0.04, 0.08, 10), C(0xc58bff, 0.6), x, 0.8, 0.16); T(g, box(0.18, 0.012, 0.12), C(0xfff6c9, 0.9), x + 0.16, 0.77, 0.12, { cast: false, ry: 0.3 }); },
    cs: (g, x) => { T(g, new THREE.TorusGeometry(0.06, 0.014, 4, 10, Math.PI), C(0x2b3350, 0.5, 0.4), x, 0.84, 0.16); T(g, cyl(0.03, 0.03, 0.03, 8), C(0x2b3350, 0.5, 0.4), x - 0.06, 0.8, 0.16, { cast: false, rz: Math.PI / 2 }); },
    ops: (g, x) => { T(g, box(0.16, 0.02, 0.12), C(0xff9f43, 0.5), x, 0.775, 0.14); T(g, cyl(0.04, 0.04, 0.05, 6), C(0xdfe3e8, 0.3, 0.8), x + 0.14, 0.79, 0.12); },
    rnd: (g, x) => { T(g, cyl(0.04, 0.05, 0.07, 8), C(0x8fd0ff, 0.1, 0, 0.3), x, 0.8, 0.16); T(g, cyl(0.015, 0.015, 0.1, 6), C(0x8fd0ff, 0.1, 0, 0.3), x, 0.88, 0.16); T(g, cyl(0.014, 0.014, 0.1, 5), C(0xff7ad9, 0.1, 0, 0.4), x + 0.1, 0.81, 0.14); },
    qa: (g, x) => { T(g, box(0.14, 0.018, 0.1), C(0xf5f5f5, 0.8), x, 0.775, 0.14); T(g, box(0.05, 0.03, 0.01), GL(0x3ddc84, 0.9), x + 0.03, 0.8, 0.14); T(g, cyl(0.04, 0.04, 0.04, 10), C(0xdfe3e8, 0.3, 0.8), x + 0.14, 0.785, 0.14); },
    mfg: (g, x) => { T(g, sph(0.08), C(0xf2c14e, 0.45), x, 0.8, 0.16); T(g, box(0.18, 0.012, 0.06), C(0xf2c14e, 0.45), x, 0.775, 0.16); T(g, box(0.06, 0.03, 0.06), C(0xdfe3e8, 0.3, 0.8), x + 0.17, 0.78, 0.13); },
    scm: (g, x) => { for (let k = 0; k < 2; k++) T(g, box(0.14, 0.09 + k * 0.03, 0.12, 0.01), M.cardboard, x + k * 0.04 - 0.02, 0.81 + k * 0.08, 0.16 - k * 0.02); },
    reg: (g, x) => { T(g, box(0.16, 0.04, 0.22), C(0xa3a8b8, 0.6), x, 0.79, 0.12); T(g, cyl(0.04, 0.04, 0.02, 10), C(0xd1495b, 0.5), x + 0.14, 0.775, 0.16); },
    ecom: (g, x) => { T(g, box(0.13, 0.1, 0.1, 0.01), M.cardboard, x, 0.815, 0.16); T(g, box(0.14, 0.02, 0.02), C(0xf5f5f5), x, 0.835, 0.16); },
    kms: (g, x) => { T(g, cyl(0.05, 0.05, 0.03, 14), GL(0xb08cff, 0.8), x, 0.78, 0.16); T(g, sph(0.035), GL(0xffd9a8, 1.0), x, 0.84, 0.16); },
    studio: (g, x) => { T(g, cyl(0.04, 0.05, 0.1, 10), C(0x1b2236, 0.5), x, 0.815, 0.16); T(g, cyl(0.025, 0.025, 0.03, 8), C(0xf26b6b, 0.5), x, 0.88, 0.16); },
    bizdev: (g, x) => { T(g, box(0.1, 0.012, 0.16), C(0xfff6c9, 0.9), x, 0.77, 0.16, { cast: false, ry: 0.4 }); T(g, cyl(0.03, 0.03, 0.08, 6), C(0x4dd4ac, 0.5), x + 0.15, 0.805, 0.12); },
    retail: (g, x) => { T(g, box(0.06, 0.1, 0.05, 0.015), C(0xff7a8a, 0.2, 0.2, 0.15), x, 0.81, 0.16); T(g, box(0.06, 0.13, 0.05, 0.015), C(0xffd1e2, 0.2, 0.2, 0.15), x + 0.08, 0.83, 0.15); },
    exec: (g, x) => { T(g, box(0.2, 0.02, 0.08), C(0xf2c14e, 0.25, 0.9), x, 0.78, 0.18); T(g, cyl(0.02, 0.02, 0.1, 6), C(0xf2c14e, 0.25, 0.9), x - 0.08, 0.82, 0.18); },
  };
  P.deskItems = (g, divId, w = 1.6) => { const f = DESK[divId]; if (f) f(g, -w / 2 + 0.2 + 0.05); };

  // ── what each division gets: slim wall-side props (rim), a free-standing cluster either side of the entrance (front) and the banner colour ──
  const DIVS = {
    exec: { rim: ['trophy', 'bookStack', 'globe', 'planterBox', 'cabinet', 'flagPair', 'safe', 'planterBox', 'trophy', 'bookStack', 'scales', 'planterBox'], front: ['globe', 'flipchart'] },
    mkt: { rim: ['standSign', 'monitorWall', 'backdrop', 'notice', 'pods', 'standSign', 'wallScreen', 'tripodSoftbox', 'planterBox', 'notice', 'monitorWall', 'pods'], front: ['flipchart', 'tripodSoftbox'] },
    sales: { rim: ['trophy', 'barChart', 'handshakeSign', 'notice', 'trophy', 'flagPair', 'barChart', 'cooler', 'planterBox', 'handshakeSign', 'wallScreen', 'trophy'], front: ['handshakeSign', 'barChart'] },
    eng: { rim: ['monitorWall', 'serverMini', 'notice', 'pegboard', 'monitorWall', 'cabinet', 'serverMini', 'printer', 'wallScreen', 'notice', 'cableDrum', 'monitorWall'], front: ['flipchart', 'holoPillar'] },
    design: { rim: ['backdrop', 'notice', 'pegboard', 'pods', 'standSign', 'backdrop', 'notice', 'planterBox', 'monitorWall', 'pods', 'standSign', 'wallScreen'], front: ['mannequin', 'tripodSoftbox'] },
    cs: { rim: ['headset', 'monitorWall', 'notice', 'cooler', 'planterBox', 'wallScreen', 'cabinet', 'notice', 'pods', 'monitorWall', 'headset', 'planterBox'], front: ['standSign', 'pods'] },
    fin: { rim: ['safe', 'barChart', 'cabinet', 'coinTower', 'monitorWall', 'cabinet', 'safe', 'wallScreen', 'barChart', 'coinTower', 'planterBox', 'cabinet'], front: ['coinTower', 'barChart'] },
    hr: { rim: ['planterBox', 'notice', 'pods', 'cooler', 'standSign', 'bookStack', 'planterBox', 'notice', 'pods', 'cabinet', 'planterBox', 'standSign'], front: ['standSign', 'pods'] },
    ops: { rim: ['trolley', 'monitorWall', 'shelfCrates', 'printer', 'locker', 'notice', 'wallScreen', 'parcels', 'cabinet', 'trolley', 'monitorWall', 'barrel'], front: ['trolley', 'holoPillar'] },
    legal: { rim: ['bookStack', 'scales', 'cabinet', 'cabinet', 'bookStack', 'safe', 'flagPair', 'cabinet', 'bookStack', 'scales', 'planterBox', 'cabinet'], front: ['scales', 'bookStack'] },
    it: { rim: ['serverMini', 'monitorWall', 'serverMini', 'cableDrum', 'serverMini', 'wallScreen', 'locker', 'serverMini', 'monitorWall', 'cabinet', 'serverMini', 'printer'], front: ['holoPillar', 'serverMini'] },
    data: { rim: ['monitorWall', 'barChart', 'wallScreen', 'serverMini', 'monitorWall', 'notice', 'barChart', 'cabinet', 'wallScreen', 'holoPillar', 'monitorWall', 'printer'], front: ['holoPillar', 'barChart'] },
    rnd: { rim: ['sampleJars', 'shelfBottles', 'microscope', 'gasTanks', 'sampleJars', 'cabinet', 'shelfBottles', 'microscope', 'barrel', 'sampleJars', 'shelfBottles', 'gasTanks'], front: ['microscope', 'flipchart'] },
    mfg: { rim: ['craneArm', 'barrel', 'locker', 'gasTanks', 'pegboard', 'barrel', 'shelfCrates', 'cableDrum', 'locker', 'barrel', 'pegboard', 'craneArm'], front: ['barrel', 'craneArm'] },
    qa: { rim: ['sampleJars', 'microscope', 'cabinet', 'shelfBottles', 'notice', 'sampleJars', 'microscope', 'locker', 'wallScreen', 'sampleJars', 'cabinet', 'printer'], front: ['microscope', 'flipchart'] },
    reg: { rim: ['cabinet', 'bookStack', 'safe', 'cabinet', 'notice', 'cabinet', 'flagPair', 'bookStack', 'scales', 'cabinet', 'planterBox', 'printer'], front: ['bookStack', 'flagPair'] },
    scm: { rim: ['shelfCrates', 'parcels', 'trolley', 'shelfCrates', 'barrel', 'sacks', 'shelfCrates', 'parcels', 'craneArm', 'shelfCrates', 'trolley', 'sacks'], front: ['parcels', 'trolley'] },
    ecom: { rim: ['parcels', 'monitorWall', 'shelfCrates', 'tripodSoftbox', 'backdrop', 'parcels', 'wallScreen', 'standSign', 'shelfCrates', 'trolley', 'monitorWall', 'parcels'], front: ['tripodSoftbox', 'parcels'] },
    kms: { rim: ['holoPillar', 'bookStack', 'monitorWall', 'serverMini', 'holoPillar', 'wallScreen', 'bookStack', 'notice', 'holoPillar', 'monitorWall', 'planterBox', 'serverMini'], front: ['holoPillar', 'globe'] },
    studio: { rim: ['backdrop', 'tripodSoftbox', 'micBoom', 'monitorWall', 'tripodSoftbox', 'backdrop', 'wallScreen', 'micBoom', 'pods', 'tripodSoftbox', 'monitorWall', 'planterBox'], front: ['tripodSoftbox', 'micBoom'] },
    bizdev: { rim: ['handshakeSign', 'flagPair', 'globe', 'notice', 'trophy', 'flagPair', 'wallScreen', 'handshakeSign', 'planterBox', 'cabinet', 'globe', 'barChart'], front: ['handshakeSign', 'globe'] },
    retail: { rim: ['garmentRack', 'perfumeStand', 'mannequin', 'perfumeStand', 'shelfBottles', 'garmentRack', 'perfumeStand', 'backdrop', 'mannequin', 'shelfBottles', 'perfumeStand', 'garmentRack'], front: ['mannequin', 'perfumeStand'] },
  };
  const KINDS = {
    conference: { rim: ['wallScreen', 'planterBox', 'notice', 'cabinet', 'flagPair', 'planterBox', 'bookStack', 'cooler', 'planterBox', 'notice', 'wallScreen', 'cabinet'], front: ['flipchart', 'holoPillar'] },
    library: { rim: ['bookStack', 'planterBox', 'globe', 'cabinet', 'bookStack', 'planterBox', 'notice', 'bookStack', 'planterBox', 'globe'], front: ['globe', 'bookStack'] },
    cafe: { rim: ['vending', 'planterBox', 'cooler', 'notice', 'vending', 'planterBox', 'standSign', 'cabinet', 'planterBox', 'cooler'], front: ['standSign', 'pods'] },
    play: { rim: ['pods', 'planterBox', 'vending', 'wallScreen', 'pods', 'planterBox', 'notice', 'pods', 'planterBox', 'standSign'], front: ['pods', 'standSign'] },
    lounge: { rim: ['planterBox', 'bookStack', 'wallScreen', 'planterBox', 'pods', 'cabinet', 'planterBox', 'notice', 'globe', 'planterBox'], front: ['pods', 'globe'] },
  };
  const FALLBACK = { rim: ['monitorWall', 'cabinet', 'planterBox', 'notice', 'bookStack', 'printer', 'wallScreen', 'cooler', 'planterBox', 'flipchart'], front: ['flipchart', 'pods'] };
  P.theme = (room) => DIVS[room.div?.id] || KINDS[room.kind] || FALLBACK;

  /** build any prop by name; unknown names are skipped. Division colour tints a few of them. */
  P.make = (name, accent) => {
    const f = P[name]; if (typeof f !== 'function') return null;
    const hex = new THREE.Color(accent || '#8fb4ff').lerp(new THREE.Color(0xffffff), 0.35).getHex();
    if (name === 'locker' || name === 'cabinet') return f(undefined, hex);
    if (name === 'monitorWall') return f(undefined, hex);
    if (name === 'wallScreen' || name === 'holoPillar' || name === 'barChart') return f(hex);
    return f();
  };
  return P;
}
