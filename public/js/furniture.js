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
      g.fillStyle = '#dfe4f2'; g.fillRect(0, 0, w, h);
      const cols = ['#e6eaf6', '#d9dff0', '#eceffa', '#d3daee', '#e1e6f4'];
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
      const grd = g.createRadialGradient(w * 0.4, h * 0.4, 20, w / 2, h / 2, w * 0.8); grd.addColorStop(0, '#e6e6ee'); grd.addColorStop(1, '#dcdce8');
      g.fillStyle = grd; g.fillRect(0, 0, w, h); grain(g, w, h, 0.06);
      g.strokeStyle = 'rgba(110,190,255,0.42)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    }, [2, 2]),
    carpet: tex(256, 256, (g, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 196 + ((x + y) % 2) * 7 + Math.random() * 4; g.fillStyle = `rgb(${v},${v + 4},${v + 22})`; g.fillRect(x * 64, y * 64, 64, 64); }
      grain(g, w, h, 0.1);
    }, [6, 5]),
    terrazzo: tex(256, 256, (g, w, h) => {
      g.fillStyle = '#e7e2da'; g.fillRect(0, 0, w, h);
      const chips = ['#b9aea0', '#8e8478', '#d6c3a8', '#a7b4b0', '#c9a487'];
      for (let i = 0; i < 520; i++) { g.fillStyle = chips[(Math.random() * chips.length) | 0]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    }, [5, 4]),
    epoxy: tex(256, 256, (g, w, h) => { g.fillStyle = '#e4e7ee'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.03); }, [4, 4]),
    vinyl: tex(256, 256, (g, w, h) => { g.fillStyle = '#e9efed'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,140,135,0.18)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } grain(g, w, h, 0.03); }, [5, 4]),
    oak: tex(256, 64, (g, w, h) => { g.fillStyle = '#eceff8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,55,30,${0.05 + Math.random() * 0.08})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 4, (2 * w) / 3, y - 4, w, y); g.stroke(); } }, [1, 1]),
    walnut: tex(256, 64, (g, w, h) => { g.fillStyle = '#dfe4f3'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(110,140,220,${0.04 + Math.random() * 0.05})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 5, (2 * w) / 3, y - 5, w, y); g.stroke(); } }, [1, 1]),
    grass: tex(256, 256, (g, w, h) => { g.fillStyle = '#a9cfa0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40},${100 + Math.random() * 50},${40 + Math.random() * 30},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2); } }, [40, 40]),
    paving: tex(256, 256, (g, w, h) => { g.fillStyle = '#e3e1ea'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,100,150,0.16)'; g.lineWidth = 2; for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) g.strokeRect(x, y, 64, 32); grain(g, w, h, 0.05); }, [8, 8]),
    asphalt: tex(256, 256, (g, w, h) => { g.fillStyle = '#a9adbd'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.06); }, [10, 10]),
    blob: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })(),
    wallFade: (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'); const r = g.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, 'rgba(0,0,0,0.38)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })(),
  };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...o });
  const M = {
    plaster: std(0xf3f5fb, { roughness: 0.7, metalness: 0.05 }), plasterWarm: std(0xeef1f9, { roughness: 0.6, metalness: 0.1 }), base: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x8fd0ff, emissiveIntensity: 1.25, roughness: 0.4 }),
    oak: std(0xffffff, { map: T.oak, roughness: 0.3, metalness: 0.12 }), walnut: std(0xffffff, { map: T.walnut, roughness: 0.28, metalness: 0.18 }), laminate: std(0xf6f8fd, { roughness: 0.22, metalness: 0.15 }),
    blackMetal: std(0xb4bbd6, { metalness: 0.75, roughness: 0.28 }), steel: std(0xb9bdc3, { metalness: 0.9, roughness: 0.3 }), chrome: std(0xdfe3e8, { metalness: 1, roughness: 0.15 }),
    fabric: std(0xa3a9c9, { roughness: 1 }), fabricLight: std(0xc9d0f2, { roughness: 1 }), leather: std(0xd6b59c, { roughness: 0.55 }), mesh: std(0x8188ab, { roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfd8f2, transparent: true, opacity: 0.10, roughness: 0.02, metalness: 0.4, depthWrite: false }),
    glassware: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    frame: std(0xd4daee, { metalness: 0.8, roughness: 0.25 }), screen: new THREE.MeshStandardMaterial({ color: 0x1c2444, emissive: 0x3f7cff, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.3 }),
    leaf: std(0x86c49a, { roughness: 0.85 }), leafDark: std(0x6aae86, { roughness: 0.85 }), terracotta: std(0xe2b49c, { roughness: 0.85 }), potConcrete: std(0xdcdbe6, { roughness: 0.9 }),
    ceramic: std(0xf4f1ec, { roughness: 0.3 }), paper: std(0xfaf8f3, { roughness: 0.9 }), rubber: std(0x6b7090, { roughness: 0.9 }),
    yellow: std(0xf0d58a, { roughness: 0.6 }), cardboard: std(0xdcc3a0, { roughness: 0.95 }), pallet: std(0xd3ba98, { roughness: 0.9 }), labWhite: std(0xf3f5f4, { roughness: 0.45 }),
    blobMat: new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, depthWrite: false, color: 0x000000 }),
    wallAO: new THREE.MeshBasicMaterial({ map: T.wallFade, transparent: true, depthWrite: false, color: 0x5a6096, opacity: 0.45 }),
    emissiveWarm: new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0x9fd8ff, emissiveIntensity: 1.5 }),
    emissiveCool: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff1ff, emissiveIntensity: 1.1 }),
    floor: {
      office: std(0xffffff, { map: T.concrete, roughness: 0.55, metalness: 0.05 }), exec: std(0xffffff, { map: T.herringbone, roughness: 0.5 }), carpet: std(0xffffff, { map: T.carpet, roughness: 1 }),
      terrazzo: std(0xe4ded4, { map: T.terrazzo, roughness: 0.62 }), epoxy: std(0xe8e8e8, { map: T.epoxy, roughness: 0.5, metalness: 0.05 }), vinyl: std(0xffffff, { map: T.vinyl, roughness: 0.4 }),
      grass: std(0xffffff, { map: T.grass, roughness: 1 }), paving: std(0xffffff, { map: T.paving, roughness: 0.9 }), asphalt: std(0xffffff, { map: T.asphalt, roughness: 0.95 }),
    },
  };
  const geoCache = new Map();
  const rbox = (w, h, d, r = 0.02, seg = 2) => { const k = `rb${w},${h},${d},${r}`; if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 1, Math.min(r * 1.6 + 0.01, w / 2.01, h / 2.01, d / 2.01))); return geoCache.get(k); };
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); };
  const cyl = (rt, rb, h, s0 = 6) => { const s = Math.min(s0, 6); const k = `c${rt},${rb},${h},${s}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, s)); return geoCache.get(k); };
  const sph = (r, ws = 8, hs = 6) => { const k = `s${r},${ws}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.IcosahedronGeometry(r, r > 0.6 ? 1 : 0)); return geoCache.get(k); };
  const put = (g, geo, mat, x, y, z, { cast = true, receive = true, rx = 0, ry = 0, rz = 0 } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = receive; g.add(m); return m; };
  const blob = (g, w, d, x = 0, z = 0, o = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.material = o === 1 ? M.blobMat : M.blobMat; m.renderOrder = 1; g.add(m); return m; };

  const F = {};
  /**
   * Bakes a furniture group into ONE geometry with vertex colours (one draw call, instancable).
   * Material colours become vertex colours; transparent helpers (contact-shadow blobs, glass) are left out.
   */
  F.bake = (group) => {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const pos = [], nor = [], col = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    group.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const P = g.attributes.position, N = g.attributes.normal, c = o.material.color;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
        col.push(c.r, c.g, c.b);
      }
      if (g !== o.geometry) g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  };
  // tree crowns come in several species colours, so a row of trees is not one flat green
  const LEAVES = [[M.leaf, M.leafDark], [std(0x6f9a3c, { roughness: 0.85 }), std(0x4f7a2e, { roughness: 0.85 })], [std(0xd08a2e, { roughness: 0.85 }), std(0xb5642a, { roughness: 0.85 })], [std(0xe7a9bd, { roughness: 0.85 }), std(0xcf7f9c, { roughness: 0.85 })], [std(0x8a2f2a, { roughness: 0.85 }), std(0xb0472f, { roughness: 0.85 })], [std(0x2f6f5e, { roughness: 0.85 }), std(0x1f4f47, { roughness: 0.85 })]];
  F.M = M; F.T = T; F.rbox = rbox; F.box = box; F.cyl = cyl; F.put = put; F.blob = blob;

  /** Office chair: 5-star base, casters, gas lift, seat, mesh back, armrests. */
  F.officeChair = (accent) => {
    const g = new THREE.Group(); const soft = accent || M.fabric;
    put(g, cyl(0.25, 0.29, 0.06, 20), M.blackMetal, 0, 0.03, 0, { cast: false });
    put(g, cyl(0.055, 0.08, 0.3, 12), M.chrome, 0, 0.21, 0, { cast: false });
    put(g, rbox(0.54, 0.1, 0.52, 0.045), M.laminate, 0, 0.385, 0.01);
    put(g, rbox(0.47, 0.07, 0.45, 0.03), soft, 0, 0.455, 0);
    put(g, rbox(0.54, 0.5, 0.1, 0.045), M.laminate, 0, 0.72, 0.27, { rx: -0.1 });
    put(g, rbox(0.42, 0.36, 0.05, 0.022), soft, 0, 0.74, 0.215, { rx: -0.1, cast: false });
    for (const sx of [-0.27, 0.27]) put(g, rbox(0.08, 0.2, 0.34, 0.035), M.laminate, sx, 0.53, 0.07, { cast: false });
    blob(g, 0.8, 0.8);
    return g;
  };
  /** Work desk: oak top, A-frame metal legs, modesty panel, monitor arm, keyboard, mouse, mug, notebook, small plant. */
  F.desk = ({ w = 1.6, d = 0.8, lead = false, accent, items = true } = {}) => {
    const g = new THREE.Group();
    const top = lead ? M.walnut : M.oak;
    put(g, rbox(w, 0.07, d, 0.03), top, 0, 0.73, 0);
    for (const sx of [-1, 1]) put(g, rbox(0.11, 0.7, d - 0.16, 0.045), M.laminate, sx * (w / 2 - 0.14), 0.35, 0);
    put(g, rbox(w - 0.34, 0.28, 0.05, 0.02), M.laminate, 0, 0.52, -d / 2 + 0.09, { cast: false });
    put(g, box(w - 0.5, 0.025, 0.02), M.emissiveWarm, 0, 0.675, d / 2 - 0.03, { cast: false });
    if (items) {
      put(g, cyl(0.03, 0.07, 0.26, 12), M.laminate, 0, 0.895, -d / 2 + 0.16, { cast: false });
      put(g, rbox(0.66, 0.42, 0.07, 0.03), M.laminate, 0, 1.13, -d / 2 + 0.16);
      put(g, rbox(0.58, 0.34, 0.02, 0.012), M.screen, 0, 1.13, -d / 2 + 0.2, { cast: false });
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
    else { for (let k = 0; k < 5; k++) put(g, sph((0.28 - k * 0.03) * s, 12, 8), k % 2 ? M.leaf : M.leafDark, Math.sin(k * 2.1) * 0.1 * s, (0.62 + k * 0.14) * s, Math.cos(k * 1.3) * 0.1 * s); }
    blob(g, 0.7 * s, 0.7 * s);
    return g;
  };
  /** Bookshelf with book texture faces, optional decor. */
  // real shelving: walnut carcass, shelf boards, and individual books of varied height/colour; some gaps hold a vase or a small plant
  const bookMats = new Map();
  const bookMat = (hex) => { if (!bookMats.has(hex)) bookMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })); return bookMats.get(hex); };
  const BOOK_COLORS = [0x2b4a6f, 0x7a2e2e, 0x2f5d46, 0xb8893c, 0x3b3b45, 0xd9cbb1, 0x5b3f6b, 0x8a5a3c, 0x1f3b35, 0xc4572e, 0x6f8fa3, 0xe9e3d4];
  F.bookshelf = (w = 1.6, h = 2, d = 0.38, books, seed = 7) => {
    const g = new THREE.Group();
    let s0 = Math.max(1, Math.round(seed * 9301 + w * 100 + h * 10));
    const rnd = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
    put(g, box(0.035, h, d), M.walnut, -w / 2 + 0.018, h / 2, 0);
    put(g, box(0.035, h, d), M.walnut, w / 2 - 0.018, h / 2, 0);
    put(g, box(w, 0.035, d), M.walnut, 0, h - 0.018, 0);
    put(g, box(w, 0.09, d * 0.9), M.walnut, 0, 0.045, 0);
    put(g, box(w - 0.07, h - 0.07, 0.015), M.frame, 0, h / 2, -d / 2 + 0.01, { cast: false });
    const rows = Math.max(3, Math.round((h - 0.2) / 0.36));
    const rowH = (h - 0.1) / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = 0.09 + r * rowH;
      if (r > 0) put(g, box(w - 0.07, 0.025, d), M.walnut, 0, y0, 0);
      let x = -w / 2 + 0.07;
      while (x < w / 2 - 0.1) {
        const roll = rnd();
        if (roll < 0.07 && w / 2 - 0.1 - x > 0.25) { // decor: vase with stems, or a small potted plant
          const vx = x + 0.12;
          if (rnd() < 0.5) {
            put(g, cyl(0.07, 0.05, 0.22, 12), F.M.ceramic, vx, y0 + 0.13, 0);
            for (let k = 0; k < 4; k++) put(g, cyl(0.006, 0.006, 0.2, 4), M.leaf, vx + (k - 1.5) * 0.02, y0 + 0.34, 0, { rx: (k - 1.5) * 0.12 });
          } else {
            put(g, cyl(0.06, 0.05, 0.13, 12), M.terracotta, vx, y0 + 0.08, 0);
            put(g, sph(0.1, 7, 5), M.leafDark, vx, y0 + 0.2, 0);
          }
          x += 0.26; continue;
        }
        const bw = 0.028 + rnd() * 0.035;
        const bh = (rowH - 0.05) * (0.62 + rnd() * 0.33);
        const tilt = rnd() < 0.08 ? (rnd() - 0.5) * 0.35 : 0;
        const col = BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)];
        put(g, box(bw, bh, d * 0.78), bookMat(col), x + bw / 2, y0 + bh / 2 + 0.01, 0, { rz: tilt });
        x += bw + 0.004 + (rnd() < 0.1 ? 0.03 : 0);
      }
    }
    blob(g, w + 0.3, d + 0.4);
    return g;
  };
  F.sofa = (w = 2.4, color) => {
    const g = new THREE.Group(); const mat = color || M.fabricLight;
    put(g, rbox(w, 0.3, 0.92, 0.11), mat, 0, 0.2, 0);
    put(g, rbox(w, 0.52, 0.28, 0.11), mat, 0, 0.56, -0.33);
    for (const sx of [-1, 1]) put(g, rbox(0.24, 0.44, 0.92, 0.1), mat, sx * (w / 2 - 0.12), 0.42, 0);
    const n = Math.max(1, Math.round((w - 0.5) / 0.8));
    for (let k = 0; k < n; k++) put(g, rbox((w - 0.52) / n - 0.03, 0.14, 0.62, 0.06), mat, -w / 2 + 0.26 + ((k + 0.5) * (w - 0.52)) / n, 0.42, 0.08, { cast: false });
    blob(g, w + 0.5, 1.4);
    return g;
  };
  F.armchair = (color) => { const g = F.sofa(1.05, color || M.fabric); return g; };
  F.coffeeTable = (w = 1.2, d = 0.6) => { const g = new THREE.Group(); put(g, rbox(w, 0.08, d, 0.035), M.laminate, 0, 0.405, 0); put(g, cyl(0.1, 0.16, 0.37, 14), M.laminate, 0, 0.185, 0, { cast: false }); put(g, cyl(0.07, 0.07, 0.02, 12), M.emissiveWarm, 0.15, 0.455, 0, { cast: false }); blob(g, w + 0.3, d + 0.3); return g; };
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
  const LIQ = [0xf3a6c0, 0xc4b0f5, 0x9fe0c8, 0xffcfa3, 0x9fd0ff];
  const liqMats = new Map();
  const liq = (k) => { const hex = LIQ[((k % LIQ.length) + LIQ.length) % LIQ.length]; if (!liqMats.has(hex)) liqMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.45, roughness: 0.25, flatShading: true })); return liqMats.get(hex); };
  const holo = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  /** small two-joint robot arm standing on (x, y, z) */
  const arm = (g, x, y, z, s = 1, ry = 0) => { const a = new THREE.Group(); put(a, cyl(0.07 * s, 0.09 * s, 0.1 * s, 6), M.laminate, 0, 0.05 * s, 0, { cast: false }); put(a, box(0.06 * s, 0.34 * s, 0.06 * s), M.laminate, 0, 0.26 * s, 0, { rz: 0.35, cast: false }); put(a, box(0.05 * s, 0.3 * s, 0.05 * s), M.blackMetal, 0.12 * s, 0.5 * s, 0, { rz: -0.9, cast: false }); put(a, box(0.03 * s, 0.1 * s, 0.03 * s), M.emissiveWarm, 0.25 * s, 0.5 * s, 0, { cast: false }); a.position.set(x, y, z); a.rotation.y = ry; g.add(a); return a; };
  /** formulation bench: glowing vials, a wide data screen, a pipetting arm and a hologram of the formula */
  F.labBench = (w = 2.4) => {
    const g = new THREE.Group();
    put(g, rbox(w, 0.07, 0.8, 0.02), M.labWhite, 0, 0.895, 0);
    put(g, rbox(w - 0.2, 0.8, 0.62, 0.04), M.laminate, 0, 0.44, 0);
    put(g, box(w - 0.3, 0.03, 0.02), M.emissiveWarm, 0, 0.1, 0.32, { cast: false });
    put(g, rbox(w, 0.5, 0.1, 0.02), M.labWhite, 0, 1.2, -0.33, { cast: false });
    put(g, box(w - 0.3, 0.34, 0.02), M.screen, 0, 1.22, -0.275, { cast: false });
    const n = Math.max(4, Math.round(w * 2));
    for (let k = 0; k < n; k++) { const x = -w / 2 + 0.3 + (k * (w - 1.1)) / (n - 1), h = 0.14 + (k % 3) * 0.05; put(g, cyl(0.04, 0.04, h + 0.05, 6), M.glassware, x, 0.93 + (h + 0.05) / 2, 0.12, { cast: false }); put(g, cyl(0.03, 0.03, h, 6), liq(k), x, 0.93 + h / 2, 0.12, { cast: false }); }
    arm(g, w / 2 - 0.55, 0.93, -0.05, 1, 2.6);
    put(g, cyl(0.12, 0.12, 0.02, 6), M.emissiveWarm, w / 2 - 0.2, 0.94, 0.12, { cast: false });
    put(g, new THREE.ConeGeometry(0.13, 0.34, 6, 1, true), holo, w / 2 - 0.2, 1.13, 0.12, { rx: Math.PI, cast: false, receive: false });
    blob(g, w + 0.4, 1.2); return g;
  };
  /** stability chamber: a tall white cabinet with a lit window and samples inside */
  F.fumeHood = () => {
    const g = new THREE.Group();
    put(g, rbox(1.4, 2.1, 0.8, 0.05), M.labWhite, 0, 1.05, 0);
    put(g, box(1.1, 0.9, 0.02), M.screen, 0, 1.3, 0.405, { cast: false });
    for (let k = 0; k < 4; k++) put(g, cyl(0.07, 0.07, 0.3, 6), liq(k + 1), -0.39 + k * 0.26, 1.2, 0.36, { cast: false });
    put(g, box(1.2, 0.04, 0.02), M.emissiveWarm, 0, 1.82, 0.41, { cast: false });
    put(g, box(0.3, 0.16, 0.02), M.emissiveCool, 0.4, 0.55, 0.41, { cast: false });
    put(g, box(1.2, 0.03, 0.02), M.emissiveWarm, 0, 0.08, 0.41, { cast: false });
    blob(g, 1.8, 1.2); return g;
  };
  /** emulsion reactor: a glass vessel full of glowing cream on a white pedestal, with two light rings and a stirrer head */
  let tankN = 0;
  F.mixTank = () => {
    const g = new THREE.Group(); const k = tankN++;
    put(g, cyl(0.62, 0.7, 0.5, 6), M.laminate, 0, 0.25, 0);
    put(g, cyl(0.56, 0.56, 1.3, 6), liq(k), 0, 1.15, 0, { cast: false });
    put(g, cyl(0.6, 0.6, 1.5, 6), M.glassware, 0, 1.25, 0, { cast: false });
    put(g, cyl(0.5, 0.64, 0.22, 6), M.laminate, 0, 2.1, 0);
    put(g, cyl(0.14, 0.14, 0.3, 6), M.blackMetal, 0, 2.36, 0, { cast: false });
    for (const y of [0.56, 1.96]) put(g, new THREE.TorusGeometry(0.64, 0.035, 4, 6), M.emissiveWarm, 0, y, 0, { rx: Math.PI / 2, cast: false });
    put(g, box(0.26, 0.16, 0.03), M.emissiveCool, 0, 0.3, 0.63, { cast: false });
    blob(g, 1.8, 1.8); return g;
  };
  /** filling line: a white belt with light rails, jars of product in soft colours, and a scanner gate */
  F.conveyor = (w = 3) => {
    const g = new THREE.Group();
    put(g, rbox(w, 0.1, 0.6, 0.02), M.fabric, 0, 0.85, 0);
    put(g, rbox(w - 0.3, 0.74, 0.44, 0.04), M.laminate, 0, 0.42, 0, { cast: false });
    for (const sz of [-1, 1]) put(g, box(w, 0.03, 0.03), M.emissiveWarm, 0, 0.91, sz * 0.3, { cast: false });
    const n = Math.max(4, Math.floor(w / 0.45) - 1);
    for (let k = 0; k < n; k++) { const x = -w / 2 + 0.35 + k * 0.45; put(g, cyl(0.06, 0.06, 0.09, 6), liq(k), x, 0.95, 0, { cast: false }); put(g, cyl(0.065, 0.065, 0.03, 6), M.laminate, x, 1.01, 0, { cast: false }); }
    for (const sz of [-1, 1]) put(g, box(0.06, 0.6, 0.06), M.laminate, 0.2, 1.2, sz * 0.36, { cast: false });
    put(g, box(0.06, 0.06, 0.78), M.laminate, 0.2, 1.52, 0, { cast: false });
    put(g, box(0.02, 0.5, 0.66), holo, 0.2, 1.2, 0, { cast: false, receive: false });
    blob(g, w + 0.4, 1); return g;
  };
  /** filling robot: a white cell with a lit window, a status screen and an arm on top */
  F.filler = () => {
    const g = new THREE.Group();
    put(g, rbox(1, 1.6, 0.9, 0.05), M.laminate, 0, 0.8, 0);
    put(g, box(0.8, 0.6, 0.02), M.screen, 0, 1.15, 0.455, { cast: false });
    for (let k = 0; k < 3; k++) put(g, cyl(0.05, 0.05, 0.22, 6), liq(k + 2), -0.2 + k * 0.2, 1.05, 0.42, { cast: false });
    put(g, box(0.25, 0.14, 0.02), M.emissiveCool, 0.3, 0.6, 0.455, { cast: false });
    put(g, box(0.9, 0.03, 0.02), M.emissiveWarm, 0, 0.08, 0.455, { cast: false });
    arm(g, 0, 1.6, 0, 1.5, 0.6);
    blob(g, 1.4, 1.3); return g;
  };
  /** cargo pad: sealed white crates with a light seam on a low hover pad */
  F.pallet = (load = true) => {
    const g = new THREE.Group();
    put(g, rbox(1.2, 0.1, 1, 0.03), M.blackMetal, 0, 0.1, 0);
    put(g, box(1.1, 0.03, 0.9), M.emissiveWarm, 0, 0.035, 0, { cast: false });
    if (load) for (const [x, y, z] of [[-0.3, 0.37, -0.22], [0.3, 0.37, -0.22], [-0.3, 0.37, 0.24], [0.3, 0.37, 0.24], [0, 0.83, 0]]) { put(g, rbox(0.54, 0.42, 0.42, 0.03), M.laminate, x, y, z); put(g, box(0.56, 0.03, 0.44), M.emissiveWarm, x, y, z, { cast: false }); }
    blob(g, 1.6, 1.4); return g;
  };
  /** automated storage rack: white uprights, three shelves of crates, a light strip per shelf */
  F.rack = (w = 2.6, h = 2.4) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) put(g, box(0.1, h, 0.9), M.laminate, sx * (w / 2 - 0.05), h / 2, 0, { cast: false });
    for (let l = 0; l < 3; l++) { const y = 0.15 + l * 0.8; put(g, box(w - 0.1, 0.06, 0.9), M.blackMetal, 0, y, 0, { cast: false }); put(g, box(w - 0.2, 0.025, 0.02), M.emissiveWarm, 0, y + 0.01, 0.45, { cast: false }); const n = Math.max(2, Math.floor(w / 0.8)); for (let k = 0; k < n; k++) put(g, rbox(0.56, 0.4, 0.6, 0.03), (k + l) % 3 ? M.laminate : liq(k + l), -w / 2 + 0.5 + (k * (w - 1)) / Math.max(1, n - 1), y + 0.24, 0, { cast: false }); }
    blob(g, w + 0.4, 1.4); return g;
  };
  F.ringLight = () => { const g = new THREE.Group(); put(g, cyl(0.012, 0.012, 1.6, 6), M.blackMetal, 0, 0.8, 0, { cast: false }); for (let k = 0; k < 3; k++) { const a = k * 2.1; put(g, cyl(0.01, 0.01, 0.6, 4), M.blackMetal, Math.sin(a) * 0.18, 0.2, Math.cos(a) * 0.18, { rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, cast: false }); } put(g, new THREE.TorusGeometry(0.28, 0.035, 8, 32), M.emissiveCool, 0, 1.7, 0, { cast: false }); return g; };
  F.camera = () => { const g = new THREE.Group(); put(g, box(0.18, 0.12, 0.1), M.blackMetal, 0, 1.45, 0); put(g, cyl(0.04, 0.04, 0.1, 10), M.rubber, 0, 1.45, 0.08, { rx: Math.PI / 2, cast: false }); for (let k = 0; k < 3; k++) { const a = k * 2.1; put(g, cyl(0.012, 0.012, 1.45, 4), M.blackMetal, Math.sin(a) * 0.14, 0.72, Math.cos(a) * 0.14, { rx: Math.cos(a) * 0.18, rz: -Math.sin(a) * 0.18, cast: false }); } return g; };
  F.displayShelf = (w = 1.6) => { const g = new THREE.Group(); put(g, box(w, 1.8, 0.4), M.laminate, 0, 0.9, 0); const cols = [0xf6c7d0, 0xfff1d6, 0xd7f0e6, 0xe6e0ff]; for (let l = 0; l < 3; l++) for (let k = 0; k < 6; k++) put(g, cyl(0.05, 0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: cols[(k + l) % 4], roughness: 0.3 }), -w / 2 + 0.18 + k * (w - 0.36) / 5, 0.55 + l * 0.5, 0.05, { cast: false }); blob(g, w + 0.3, 0.8); return g; };
  F.serverRack = () => { const g = new THREE.Group(); put(g, box(0.6, 2, 0.9), M.blackMetal, 0, 1, 0); put(g, box(0.56, 1.9, 0.01), M.glassware, 0, 1, 0.455, { cast: false }); blob(g, 0.9, 1.2); return g; };
  F.draftTable = () => { const g = new THREE.Group(); put(g, rbox(1.3, 0.04, 0.9, 0.01), M.laminate, 0, 0.92, 0, { rx: -0.35 }); for (const sx of [-1, 1]) put(g, box(0.04, 0.9, 0.04), M.steel, sx * 0.55, 0.45, 0, { cast: false }); put(g, box(1.1, 0.03, 0.04), M.steel, 0, 0.2, 0, { cast: false }); blob(g, 1.6, 1.2); return g; };
  F.tree = (s = 1, species = 0) => { const g = new THREE.Group(); const [la, lb] = LEAVES[species % LEAVES.length]; put(g, cyl(0.2 * s, 0.26 * s, 2 * s, 12), M.walnut, 0, s, 0); for (let k = 0; k < 3; k++) put(g, sph((1.15 - k * 0.14) * s, 14, 10), k % 2 ? la : lb, Math.sin(k * 2.3) * 0.5 * s, (2.4 + k * 0.45) * s, Math.cos(k * 1.9) * 0.5 * s); blob(g, 3 * s, 3 * s); return g; };
  F.hedge = (w) => { const g = new THREE.Group(); put(g, rbox(w, 0.7, 0.7, 0.16), M.leafDark, 0, 0.35, 0); return g; };
  F.car = (color) => { const g = new THREE.Group(); const body = std(color, { metalness: 0.6, roughness: 0.3 }); put(g, rbox(1.8, 0.5, 4, 0.15), body, 0, 0.5, 0); put(g, rbox(1.6, 0.45, 2.1, 0.15), M.glass, 0, 0.95, -0.2); put(g, rbox(1.55, 0.06, 2, 0.04), body, 0, 1.18, -0.2, { cast: false }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.33, 0.33, 0.22, 14), M.rubber, sx * 0.86, 0.33, sz * 1.3, { rz: Math.PI / 2, cast: false }); blob(g, 2.6, 4.8); return g; };
  return F;
}
