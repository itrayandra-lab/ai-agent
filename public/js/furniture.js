// Architectural material palette + detailed low-poly furniture (rounded edges, contact shadows), Enscape-inspired.
// Every builder returns a THREE.Group positioned at the origin; the office merges static groups into few draw calls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeFurniture() {
  const tex = (w, h, draw, repeat = [1, 1]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
  };
  const grain = (g, w, h, a = 0.05) => { for (let i = 0; i < (w * h) / 5; i++) { const v = (Math.random() * 255) | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); } };
  const T = {
    herringbone: tex(512, 512, (g, w, h) => {
      g.fillStyle = '#a57a52'; g.fillRect(0, 0, w, h);
      const cols = ['#b48659', '#a0744c', '#bd9063', '#97693f', '#aa7d50'];
      const L = 96, W = 24;
      for (let y = -L; y < h + L; y += W) for (let x = -L; x < w + L; x += L) {
        for (const dir of [1, -1]) {
          g.save(); g.translate(x + (dir < 0 ? L / 2 : 0), y + (dir < 0 ? W : 0)); g.rotate(dir * Math.PI / 4);
          g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(0, 0, L * 0.72, W - 2);
          g.strokeStyle = 'rgba(60,35,15,0.35)'; g.strokeRect(0, 0, L * 0.72, W - 2); g.restore();
        }
      }
      grain(g, w, h, 0.05);
    }, [2, 2]),
    concrete: tex(512, 512, (g, w, h) => {
      const grd = g.createRadialGradient(w * 0.4, h * 0.4, 20, w / 2, h / 2, w * 0.8); grd.addColorStop(0, '#8f8a83'); grd.addColorStop(1, '#7b766f');
      g.fillStyle = grd; g.fillRect(0, 0, w, h); grain(g, w, h, 0.06);
      g.strokeStyle = 'rgba(40,40,40,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    }, [2, 2]),
    carpet: tex(256, 256, (g, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 48 + ((x + y) % 2) * 6 + Math.random() * 4; g.fillStyle = `rgb(${v},${v + 2},${v + 6})`; g.fillRect(x * 64, y * 64, 64, 64); }
      grain(g, w, h, 0.1);
    }, [6, 5]),
    terrazzo: tex(256, 256, (g, w, h) => {
      g.fillStyle = '#e7e2da'; g.fillRect(0, 0, w, h);
      const chips = ['#b9aea0', '#8e8478', '#d6c3a8', '#a7b4b0', '#c9a487'];
      for (let i = 0; i < 520; i++) { g.fillStyle = chips[(Math.random() * chips.length) | 0]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    }, [5, 4]),
    epoxy: tex(256, 256, (g, w, h) => { g.fillStyle = '#c9ccce'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.04); }, [4, 4]),
    vinyl: tex(256, 256, (g, w, h) => { g.fillStyle = '#e9efed'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,140,135,0.18)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } grain(g, w, h, 0.03); }, [5, 4]),
    oak: tex(256, 64, (g, w, h) => { g.fillStyle = '#b8916a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,55,30,${0.05 + Math.random() * 0.08})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 4, (2 * w) / 3, y - 4, w, y); g.stroke(); } }, [1, 1]),
    walnut: tex(256, 64, (g, w, h) => { g.fillStyle = '#5b3d2a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(20,10,5,${0.08 + Math.random() * 0.1})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 5, (2 * w) / 3, y - 5, w, y); g.stroke(); } }, [1, 1]),
    grass: tex(256, 256, (g, w, h) => { g.fillStyle = '#5c7a45'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40},${100 + Math.random() * 50},${40 + Math.random() * 30},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2); } }, [40, 40]),
    paving: tex(256, 256, (g, w, h) => { g.fillStyle = '#b5aea4'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,60,50,0.35)'; g.lineWidth = 2; for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) g.strokeRect(x, y, 64, 32); grain(g, w, h, 0.05); }, [8, 8]),
    asphalt: tex(256, 256, (g, w, h) => { g.fillStyle = '#3d3f42'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.12); }, [10, 10]),
    blob: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })(),
    wallFade: (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'); const r = g.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, 'rgba(0,0,0,0.38)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })(),
  };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  const M = {
    plaster: std(0xcdc6bb, { roughness: 0.95 }), plasterWarm: std(0xcfc3b1, { roughness: 0.92 }), base: std(0x2b2825, { roughness: 0.6 }),
    oak: std(0xffffff, { map: T.oak, roughness: 0.45 }), walnut: std(0xffffff, { map: T.walnut, roughness: 0.4 }), laminate: std(0xf1eee8, { roughness: 0.38 }),
    blackMetal: std(0x1d1e21, { metalness: 0.55, roughness: 0.38 }), steel: std(0xb9bdc3, { metalness: 0.9, roughness: 0.3 }), chrome: std(0xdfe3e8, { metalness: 1, roughness: 0.15 }),
    fabric: std(0x6f6d6a, { roughness: 1 }), fabricLight: std(0xbdb6ab, { roughness: 1 }), leather: std(0x8a5a36, { roughness: 0.5 }), mesh: std(0x2a2b2e, { roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xb9ccd6, transparent: true, opacity: 0.07, roughness: 0.02, metalness: 0.4, depthWrite: false }),
    glassware: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    frame: std(0x26282b, { metalness: 0.6, roughness: 0.35 }), screen: std(0x0b0d10, { roughness: 0.25, metalness: 0.3 }),
    leaf: std(0x3f7a45, { roughness: 0.85 }), leafDark: std(0x2c5e37, { roughness: 0.85 }), terracotta: std(0xb5694c, { roughness: 0.85 }), potConcrete: std(0x99958f, { roughness: 0.9 }),
    ceramic: std(0xf4f1ec, { roughness: 0.3 }), paper: std(0xfaf8f3, { roughness: 0.9 }), rubber: std(0x151515, { roughness: 0.9 }),
    yellow: std(0xf2c230, { roughness: 0.6 }), cardboard: std(0xb38b5d, { roughness: 0.95 }), pallet: std(0x9c7a52, { roughness: 0.9 }), labWhite: std(0xf3f5f4, { roughness: 0.45 }),
    blobMat: new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, depthWrite: false, color: 0x000000 }),
    wallAO: new THREE.MeshBasicMaterial({ map: T.wallFade, transparent: true, depthWrite: false, color: 0x000000 }),
    emissiveWarm: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 1.4 }),
    emissiveCool: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff1ff, emissiveIntensity: 1.1 }),
    floor: {
      office: std(0xffffff, { map: T.concrete, roughness: 0.55, metalness: 0.05 }), exec: std(0xffffff, { map: T.herringbone, roughness: 0.5 }), carpet: std(0xffffff, { map: T.carpet, roughness: 1 }),
      terrazzo: std(0xe4ded4, { map: T.terrazzo, roughness: 0.62 }), epoxy: std(0xe8e8e8, { map: T.epoxy, roughness: 0.5, metalness: 0.05 }), vinyl: std(0xffffff, { map: T.vinyl, roughness: 0.4 }),
      grass: std(0xffffff, { map: T.grass, roughness: 1 }), paving: std(0xffffff, { map: T.paving, roughness: 0.9 }), asphalt: std(0xffffff, { map: T.asphalt, roughness: 0.95 }),
    },
  };
  const geoCache = new Map();
  const rbox = (w, h, d, r = 0.02, seg = 2) => { const k = `rb${w},${h},${d},${r}`; if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01))); return geoCache.get(k); };
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); };
  const cyl = (rt, rb, h, s = 16) => { const k = `c${rt},${rb},${h},${s}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, s)); return geoCache.get(k); };
  const sph = (r, ws = 12, hs = 10) => { const k = `s${r},${ws}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, ws, hs)); return geoCache.get(k); };
  const put = (g, geo, mat, x, y, z, { cast = true, receive = true, rx = 0, ry = 0, rz = 0 } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = receive; g.add(m); return m; };
  const blob = (g, w, d, x = 0, z = 0, o = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.material = o === 1 ? M.blobMat : M.blobMat; m.renderOrder = 1; g.add(m); return m; };

  const F = {};
  F.M = M; F.T = T; F.rbox = rbox; F.box = box; F.cyl = cyl; F.put = put; F.blob = blob;

  /** Office chair: 5-star base, casters, gas lift, seat, mesh back, armrests. */
  F.officeChair = (accent) => {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const leg = put(g, box(0.3, 0.03, 0.04), M.blackMetal, Math.sin(a) * 0.15, 0.08, Math.cos(a) * 0.15, { ry: a + Math.PI / 2, cast: false }); leg.userData.small = true; put(g, sph(0.028, 8, 6), M.rubber, Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29, { cast: false }); }
    put(g, cyl(0.025, 0.03, 0.3, 8), M.chrome, 0, 0.25, 0, { cast: false });
    put(g, rbox(0.5, 0.08, 0.48, 0.035), accent || M.fabric, 0, 0.45, 0);
    put(g, rbox(0.46, 0.5, 0.05, 0.03), M.mesh, 0, 0.78, 0.25, { rx: -0.12 });
    put(g, rbox(0.3, 0.06, 0.04, 0.02), M.blackMetal, 0, 1.0, 0.26, { cast: false });
    for (const sx of [-0.27, 0.27]) { put(g, box(0.03, 0.2, 0.03), M.blackMetal, sx, 0.56, 0.02, { cast: false }); put(g, rbox(0.06, 0.03, 0.26, 0.012), M.rubber, sx, 0.66, 0.0, { cast: false }); }
    blob(g, 0.8, 0.8);
    return g;
  };
  /** Work desk: oak top, A-frame metal legs, modesty panel, monitor arm, keyboard, mouse, mug, notebook, small plant. */
  F.desk = ({ w = 1.6, d = 0.8, lead = false, accent, items = true } = {}) => {
    const g = new THREE.Group();
    const top = lead ? M.walnut : M.oak;
    put(g, rbox(w, 0.04, d, 0.012), top, 0, 0.74, 0);
    for (const sx of [-1, 1]) { put(g, box(0.05, 0.7, 0.05), M.blackMetal, sx * (w / 2 - 0.08), 0.37, -d / 2 + 0.08); put(g, box(0.05, 0.7, 0.05), M.blackMetal, sx * (w / 2 - 0.08), 0.37, d / 2 - 0.08); put(g, box(0.05, 0.04, d - 0.1), M.blackMetal, sx * (w / 2 - 0.08), 0.04, 0, { cast: false }); }
    put(g, box(w - 0.2, 0.3, 0.02), lead ? M.walnut : M.laminate, 0, 0.52, -d / 2 + 0.06, { cast: false });
    if (items) {
      put(g, box(0.03, 0.28, 0.03), M.blackMetal, 0, 0.9, -d / 2 + 0.15, { cast: false });
      put(g, rbox(0.62, 0.38, 0.03, 0.01), M.screen, 0, 1.12, -d / 2 + 0.17);
      put(g, rbox(0.42, 0.015, 0.14, 0.005), M.laminate, 0, 0.765, 0.05, { cast: false });
      put(g, rbox(0.06, 0.02, 0.1, 0.01), M.laminate, 0.32, 0.765, 0.06, { cast: false });
      put(g, cyl(0.04, 0.035, 0.1, 12), M.ceramic, -0.55 + Math.random() * 0.1, 0.81, 0.1, { cast: false });
      put(g, box(0.22, 0.015, 0.3), accent || M.paper, -0.36, 0.765, -0.05, { ry: 0.2, cast: false });
      if (Math.random() < 0.6) { put(g, cyl(0.05, 0.04, 0.08, 10), M.terracotta, w / 2 - 0.16, 0.8, -0.22, { cast: false }); put(g, sph(0.07, 8, 6), M.leaf, w / 2 - 0.16, 0.89, -0.22, { cast: false }); }
      if (lead) { put(g, cyl(0.012, 0.012, 0.42, 6), M.blackMetal, -w / 2 + 0.2, 0.96, -0.25, { cast: false }); put(g, cyl(0.09, 0.05, 0.08, 14), M.emissiveWarm, -w / 2 + 0.2, 1.17, -0.18, { cast: false }); }
    }
    blob(g, w + 0.4, d + 0.4);
    return g;
  };
  /** Indoor plant: pot + layered canopy, three sizes. */
  F.plant = (s = 1, kind = 0) => {
    const g = new THREE.Group();
    put(g, cyl(0.2 * s, 0.15 * s, 0.42 * s, 14), kind ? M.potConcrete : M.terracotta, 0, 0.21 * s, 0);
    put(g, cyl(0.19 * s, 0.19 * s, 0.02, 14), M.rubber, 0, 0.42 * s, 0, { cast: false });
    if (kind === 2) { put(g, cyl(0.025 * s, 0.03 * s, 1.1 * s, 6), M.walnut, 0, 0.95 * s, 0); for (let k = 0; k < 6; k++) put(g, sph(0.22 * s, 7, 5), k % 2 ? M.leaf : M.leafDark, Math.sin(k) * 0.18 * s, (1.35 + (k % 3) * 0.18) * s, Math.cos(k * 1.7) * 0.18 * s); }
    else { for (let k = 0; k < 5; k++) put(g, new THREE.IcosahedronGeometry((0.28 - k * 0.03) * s, 0), k % 2 ? M.leaf : M.leafDark, Math.sin(k * 2.1) * 0.1 * s, (0.62 + k * 0.14) * s, Math.cos(k * 1.3) * 0.1 * s); }
    blob(g, 0.7 * s, 0.7 * s);
    return g;
  };
  /** Bookshelf with book texture faces, optional decor. */
  F.bookshelf = (w = 1.6, h = 2, d = 0.38, books) => {
    const g = new THREE.Group();
    put(g, box(w, h, d), M.walnut, 0, h / 2, 0);
    const front = put(g, new THREE.PlaneGeometry(w - 0.08, h - 0.1), books, 0, h / 2, d / 2 + 0.002, { cast: false });
    front.userData.small = true;
    blob(g, w + 0.3, d + 0.4);
    return g;
  };
  F.sofa = (w = 2.4, color) => {
    const g = new THREE.Group(); const mat = color || M.fabricLight;
    put(g, rbox(w, 0.22, 0.9, 0.06), mat, 0, 0.24, 0);
    put(g, rbox(w, 0.5, 0.2, 0.08), mat, 0, 0.55, -0.36);
    for (const sx of [-1, 1]) put(g, rbox(0.18, 0.42, 0.9, 0.07), mat, sx * (w / 2 - 0.09), 0.42, 0);
    const n = Math.max(2, Math.round(w / 0.8));
    for (let k = 0; k < n; k++) put(g, rbox((w - 0.4) / n - 0.03, 0.14, 0.66, 0.06), mat, -w / 2 + 0.2 + ((k + 0.5) * (w - 0.4)) / n, 0.42, 0.06, { cast: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.025, 0.02, 0.12, 6), M.blackMetal, sx * (w / 2 - 0.12), 0.06, sz * 0.36, { cast: false });
    blob(g, w + 0.5, 1.4);
    return g;
  };
  F.armchair = (color) => { const g = F.sofa(0.95, color || M.leather); return g; };
  F.coffeeTable = (w = 1.2, d = 0.6) => { const g = new THREE.Group(); put(g, rbox(w, 0.05, d, 0.02), M.walnut, 0, 0.42, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.02, 0.02, 0.4, 6), M.blackMetal, sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06), { cast: false }); put(g, box(0.24, 0.04, 0.18), M.paper, 0.15, 0.465, 0, { cast: false }); blob(g, w + 0.3, d + 0.3); return g; };
  F.rug = (w, d, color = 0x8c7b68) => { const g = new THREE.Group(); put(g, rbox(w, 0.012, d, 0.005), new THREE.MeshStandardMaterial({ color, roughness: 1 }), 0, 0.012, 0, { cast: false }); return g; };
  F.pendant = (y = 2.3) => { const g = new THREE.Group(); put(g, cyl(0.004, 0.004, 0.6, 4), M.blackMetal, 0, y + 0.3, 0, { cast: false }); put(g, cyl(0.06, 0.22, 0.2, 18), M.blackMetal, 0, y, 0, { cast: false }); put(g, cyl(0.18, 0.18, 0.01, 18), M.emissiveWarm, 0, y - 0.1, 0, { cast: false }); return g; };
  F.tableLong = (w = 4.8, d = 1.4) => { const g = new THREE.Group(); put(g, rbox(w, 0.06, d, 0.02), M.walnut, 0, 0.75, 0); for (const sx of [-1, 1]) put(g, rbox(0.12, 0.7, d * 0.6, 0.02), M.blackMetal, sx * (w / 2 - 0.6), 0.37, 0); blob(g, w + 0.6, d + 0.8); return g; };
  F.barStool = () => { const g = new THREE.Group(); put(g, cyl(0.17, 0.17, 0.05, 16), M.leather, 0, 0.75, 0); put(g, cyl(0.025, 0.025, 0.7, 8), M.chrome, 0, 0.38, 0, { cast: false }); put(g, cyl(0.2, 0.22, 0.02, 16), M.chrome, 0, 0.02, 0, { cast: false }); put(g, new THREE.TorusGeometry(0.15, 0.01, 6, 20), M.chrome, 0, 0.3, 0, { rx: Math.PI / 2, cast: false }); blob(g, 0.5, 0.5); return g; };
  F.cafeChair = () => { const g = new THREE.Group(); put(g, rbox(0.42, 0.04, 0.42, 0.02), M.oak, 0, 0.46, 0); put(g, rbox(0.42, 0.34, 0.03, 0.02), M.oak, 0, 0.7, 0.19, { rx: -0.08 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.015, 0.012, 0.46, 6), M.blackMetal, sx * 0.17, 0.23, sz * 0.17, { cast: false }); blob(g, 0.6, 0.6); return g; };
  F.roundTable = (r = 0.45) => { const g = new THREE.Group(); put(g, cyl(r, r, 0.04, 28), M.ceramic, 0, 0.74, 0); put(g, cyl(0.04, 0.04, 0.7, 8), M.blackMetal, 0, 0.37, 0, { cast: false }); put(g, cyl(0.25, 0.27, 0.03, 18), M.blackMetal, 0, 0.015, 0, { cast: false }); blob(g, r * 2.6, r * 2.6); return g; };
  F.wallArt = (w = 1.2, h = 0.8, hue = Math.random()) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 170; const x = c.getContext('2d');
    const col = (l, s = 45) => `hsl(${Math.round(hue * 360)},${s}%,${l}%)`;
    x.fillStyle = col(88, 20); x.fillRect(0, 0, 256, 170);
    for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? col(40 + i * 8) : `hsl(${Math.round(((hue + 0.5) % 1) * 360)},35%,${50 + i * 5}%)`; x.beginPath(); x.arc(40 + Math.random() * 180, 30 + Math.random() * 110, 18 + Math.random() * 40, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); put(g, box(w + 0.06, h + 0.06, 0.03), M.blackMetal, 0, 0, 0, { cast: false }); put(g, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), 0, 0, 0.017, { cast: false });
    return g;
  };
  F.clock = () => { const g = new THREE.Group(); put(g, cyl(0.18, 0.18, 0.03, 24), M.ceramic, 0, 0, 0, { rx: Math.PI / 2, cast: false }); put(g, box(0.01, 0.12, 0.01), M.blackMetal, 0, 0.04, 0.02, { cast: false }); put(g, box(0.09, 0.01, 0.01), M.blackMetal, 0.03, 0, 0.02, { cast: false }); return g; };
  F.whiteboard = (w = 2.2, h = 1.1) => { const g = new THREE.Group(); put(g, box(w, h, 0.03), M.laminate, 0, 0, 0, { cast: false }); put(g, box(w + 0.04, 0.04, 0.05), M.steel, 0, -h / 2, 0.02, { cast: false }); return g; };
  // ── division-specific equipment
  F.labBench = (w = 2.4) => { const g = new THREE.Group(); put(g, rbox(w, 0.05, 0.8, 0.01), M.labWhite, 0, 0.9, 0); put(g, box(w - 0.04, 0.84, 0.76), M.laminate, 0, 0.44, 0); put(g, box(w, 0.6, 0.25), M.labWhite, 0, 1.25, -0.28, { cast: false }); for (let k = 0; k < 5; k++) { const x = -w / 2 + 0.3 + k * (w - 0.6) / 4; put(g, cyl(0.04, 0.05, 0.16 + (k % 2) * 0.08, 12), M.glassware, x, 1.0 + (k % 2) * 0.04, 0.05, { cast: false }); } put(g, box(0.18, 0.28, 0.2), M.blackMetal, w / 2 - 0.3, 1.06, -0.05); blob(g, w + 0.4, 1.2); return g; };
  F.fumeHood = () => { const g = new THREE.Group(); put(g, box(1.4, 2.1, 0.8), M.labWhite, 0, 1.05, 0); put(g, box(1.2, 0.7, 0.02), M.glassware, 0, 1.25, 0.41, { cast: false }); put(g, box(1.2, 0.04, 0.6), M.steel, 0, 0.9, 0.1, { cast: false }); blob(g, 1.8, 1.2); return g; };
  F.mixTank = () => { const g = new THREE.Group(); put(g, cyl(0.6, 0.6, 1.4, 24), M.steel, 0, 1.25, 0); put(g, cyl(0.6, 0.15, 0.4, 24), M.steel, 0, 0.35, 0); put(g, cyl(0.62, 0.62, 0.06, 24), M.chrome, 0, 1.98, 0, { cast: false }); put(g, cyl(0.12, 0.12, 0.35, 12), M.blackMetal, 0, 2.18, 0); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; put(g, cyl(0.03, 0.03, 0.8, 6), M.steel, Math.sin(a) * 0.55, 0.4, Math.cos(a) * 0.55, { cast: false }); } put(g, new THREE.TorusGeometry(0.66, 0.03, 6, 28), M.yellow, 0, 1.6, 0, { rx: Math.PI / 2, cast: false }); blob(g, 1.8, 1.8); return g; };
  F.conveyor = (w = 3) => { const g = new THREE.Group(); put(g, box(w, 0.08, 0.6), M.rubber, 0, 0.85, 0); for (const sz of [-1, 1]) put(g, box(w, 0.12, 0.04), M.steel, 0, 0.85, sz * 0.32, { cast: false }); for (let k = 0; k < 4; k++) put(g, box(0.05, 0.8, 0.5), M.steel, -w / 2 + 0.2 + k * (w - 0.4) / 3, 0.4, 0, { cast: false }); for (let k = 0; k < 6; k++) put(g, cyl(0.035, 0.035, 0.12, 10), M.ceramic, -w / 2 + 0.3 + k * 0.45, 0.95, 0, { cast: false }); blob(g, w + 0.4, 1); return g; };
  F.filler = () => { const g = new THREE.Group(); put(g, box(1, 1.6, 0.9), M.steel, 0, 0.8, 0); put(g, box(0.8, 0.6, 0.02), M.glassware, 0, 1.15, 0.46, { cast: false }); put(g, cyl(0.25, 0.2, 0.4, 16), M.chrome, 0, 1.8, 0); put(g, box(0.25, 0.18, 0.04), M.emissiveCool, 0.32, 1.45, 0.47, { cast: false }); blob(g, 1.4, 1.3); return g; };
  F.pallet = (load = true) => { const g = new THREE.Group(); put(g, box(1.2, 0.14, 1), M.pallet, 0, 0.07, 0); if (load) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) put(g, rbox(0.55, 0.4, 0.45, 0.01), M.cardboard, -0.28 + x * 0.57, 0.36 + y * 0.42, -0.23 + z * 0.47, { cast: y === 1 }); blob(g, 1.6, 1.4); return g; };
  F.rack = (w = 2.6, h = 2.4) => { const g = new THREE.Group(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.07, h, 0.07), new THREE.MeshStandardMaterial({ color: 0x2f5ea8, roughness: 0.5, metalness: 0.4 }), sx * w / 2, h / 2, sz * 0.45, { cast: false }); for (let l = 0; l < 3; l++) { const y = 0.15 + l * 0.8; put(g, box(w, 0.06, 1), M.yellow, 0, y, 0, { cast: false }); for (let k = 0; k < 3; k++) put(g, rbox(0.7, 0.45, 0.7, 0.01), M.cardboard, -w / 2 + 0.45 + k * 0.85, y + 0.26, 0, { cast: l === 2 }); } blob(g, w + 0.4, 1.5); return g; };
  F.ringLight = () => { const g = new THREE.Group(); put(g, cyl(0.012, 0.012, 1.6, 6), M.blackMetal, 0, 0.8, 0, { cast: false }); for (let k = 0; k < 3; k++) { const a = k * 2.1; put(g, cyl(0.01, 0.01, 0.6, 4), M.blackMetal, Math.sin(a) * 0.18, 0.2, Math.cos(a) * 0.18, { rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, cast: false }); } put(g, new THREE.TorusGeometry(0.28, 0.035, 8, 32), M.emissiveCool, 0, 1.7, 0, { cast: false }); return g; };
  F.camera = () => { const g = new THREE.Group(); put(g, box(0.18, 0.12, 0.1), M.blackMetal, 0, 1.45, 0); put(g, cyl(0.04, 0.04, 0.1, 10), M.rubber, 0, 1.45, 0.08, { rx: Math.PI / 2, cast: false }); for (let k = 0; k < 3; k++) { const a = k * 2.1; put(g, cyl(0.012, 0.012, 1.45, 4), M.blackMetal, Math.sin(a) * 0.14, 0.72, Math.cos(a) * 0.14, { rx: Math.cos(a) * 0.18, rz: -Math.sin(a) * 0.18, cast: false }); } return g; };
  F.displayShelf = (w = 1.6) => { const g = new THREE.Group(); put(g, box(w, 1.8, 0.4), M.laminate, 0, 0.9, 0); const cols = [0xf6c7d0, 0xfff1d6, 0xd7f0e6, 0xe6e0ff]; for (let l = 0; l < 3; l++) for (let k = 0; k < 6; k++) put(g, cyl(0.05, 0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: cols[(k + l) % 4], roughness: 0.3 }), -w / 2 + 0.18 + k * (w - 0.36) / 5, 0.55 + l * 0.5, 0.05, { cast: false }); blob(g, w + 0.3, 0.8); return g; };
  F.serverRack = () => { const g = new THREE.Group(); put(g, box(0.6, 2, 0.9), M.blackMetal, 0, 1, 0); put(g, box(0.56, 1.9, 0.01), M.glassware, 0, 1, 0.455, { cast: false }); blob(g, 0.9, 1.2); return g; };
  F.draftTable = () => { const g = new THREE.Group(); put(g, rbox(1.3, 0.04, 0.9, 0.01), M.laminate, 0, 0.92, 0, { rx: -0.35 }); for (const sx of [-1, 1]) put(g, box(0.04, 0.9, 0.04), M.steel, sx * 0.55, 0.45, 0, { cast: false }); put(g, box(1.1, 0.03, 0.04), M.steel, 0, 0.2, 0, { cast: false }); blob(g, 1.6, 1.2); return g; };
  F.tree = (s = 1) => { const g = new THREE.Group(); put(g, cyl(0.12 * s, 0.18 * s, 2 * s, 7), M.walnut, 0, s, 0); for (let k = 0; k < 4; k++) put(g, new THREE.IcosahedronGeometry((1.1 - k * 0.12) * s, 1), k % 2 ? M.leaf : M.leafDark, Math.sin(k * 2.3) * 0.5 * s, (2.4 + k * 0.45) * s, Math.cos(k * 1.9) * 0.5 * s); blob(g, 3 * s, 3 * s); return g; };
  F.hedge = (w) => { const g = new THREE.Group(); put(g, rbox(w, 0.7, 0.6, 0.2), M.leafDark, 0, 0.35, 0); return g; };
  F.car = (color) => { const g = new THREE.Group(); const body = std(color, { metalness: 0.6, roughness: 0.3 }); put(g, rbox(1.8, 0.5, 4, 0.15), body, 0, 0.5, 0); put(g, rbox(1.6, 0.45, 2.1, 0.15), M.glass, 0, 0.95, -0.2); put(g, rbox(1.55, 0.06, 2, 0.04), body, 0, 1.18, -0.2, { cast: false }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.33, 0.33, 0.22, 14), M.rubber, sx * 0.86, 0.33, sz * 1.3, { rz: Math.PI / 2, cast: false }); blob(g, 2.6, 4.8); return g; };
  return F;
}
