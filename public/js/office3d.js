// "Agora" 3D office: one long building with division work floors and shared facilities
// (conference hall, library + brain core, café courtyard, play room, lounge, private office).
// Agents are mannequins on colored spawn pads that walk between rooms based on what they are doing.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildSurroundings, GradeShader } from './environment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeFurniture } from './furniture.js';
import { makePerson, faceTexture } from './people.js';

const RW = 13, RD = 11, CORR = 7, WALL_H = 2.5; // room width/depth, corridor width, wall height (metres)
const STATUS_COLOR = { working: 0x3ddc84, meeting: 0xb57bff, chatting: 0x4aa8ff, idle: 0x9a9a9a, offline: 0x3a3a3a };
const isMobile = matchMedia('(max-width: 820px)').matches || navigator.maxTouchPoints > 1;
const FACILITIES = [
  { id: 'conference', kind: 'conference', name: 'Conference Hall', note: 'Rapat & standup' },
  { id: 'library', kind: 'library', name: 'Library', note: 'Riset & Company Brain' },
  { id: 'cafe', kind: 'cafe', name: 'Courtyard Café', note: 'Istirahat' },
  { id: 'play', kind: 'play', name: 'Play Room', note: 'Agen yang sedang luang' },
  { id: 'lounge', kind: 'lounge', name: 'Guest Lounge', note: 'Ngobrol santai' },
];
const READING = /brain|catatan|riset|research|mencari|membaca|referensi/i;

export function createOffice(container, { onSelect, onZone, onPlayerHint, onPlayerAction, onFollow, onRequestPlay, onHelp, onToast } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.92;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1600);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.44, minPolarAngle: 0.05, minDistance: 6, maxDistance: 220, screenSpacePanning: true });
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  // Image-based lighting gives PBR materials realistic reflections at almost no cost.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.2;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.35);
  composer.addPass(bloom);
  // Adaptive quality: 2 = bloom + shadows, 1 = shadows only, 0 = flat & low resolution. Drops automatically on slow devices.
  let quality = isMobile ? 1 : 2, fpsAvg = 60, slowSecs = 0, fpsFrames = 0, fpsT = performance.now();
  function applyQuality() {
    bloom.enabled = quality >= 2;
    sun.castShadow = quality >= 1;
    renderer.setPixelRatio(quality >= 2 ? Math.min(devicePixelRatio, 1.75) : quality === 1 ? Math.min(devicePixelRatio, 1.25) : 0.85);
    const w = container.clientWidth, h = container.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); composer.setSize(w, h); }
  }
  function trackFps(now) {
    fpsFrames++;
    if (now - fpsT < 1000) return;
    const fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now;
    fpsAvg = fpsAvg * 0.6 + fps * 0.4;
    slowSecs = fpsAvg < 26 ? slowSecs + 1 : 0;
    if (slowSecs >= 3 && quality > 0) { quality--; slowSecs = 0; applyQuality(); console.info('[office3d] kualitas grafis diturunkan ke', quality); }
  }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  let env = null;
  const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x3a3129, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a6, 1.75);
  sun.position.set(-30, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9fb8e8, 0.28);
  fill.position.set(30, 20, -30);
  scene.add(fill);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.7, 0.35, 0.4).normalize() }, glow: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir; void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(horizon, top, pow(smoothstep(0.015, 0.62, h), 1.55)); float s = pow(max(dot(normalize(vDir), sunDir), 0.0), 6.0); c += glow * s * (1.0 - h); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  window.__ray3d = { scene, camera, controls, renderer }; // inspection hook for debugging
  const world = new THREE.Group();
  scene.add(world);
  const avatars = new Map();
  const rooms = new Map(); // id -> room
  const packets = [];
  const pickables = [];
  const claimed = new Map(); // spot key -> agent id
  const solids = []; // axis-aligned obstacles for the player {x1,x2,z1,z2}
  const pois = [];   // interactable objects {id,x,z,label,sub}
  const blinkers = []; // server-rack LEDs
  const solid = (x, z, w, d) => solids.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 });
  let layoutKey = '', data = null, selectedId = null, follow = false, showLabels = true, visible = true;
  let bounds = new THREE.Box3(), brainCore = null, lenX = 0, hallX = 0, corridors = [0];

  // ───── procedural textures (no image downloads)
  function canvasTex(w, h, draw, repeat = [1, 1]) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
  }
  const noise = (g, w, h, a, base) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < w * h / 6; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } };
  const TEX = {
    concrete: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, 0.05, '#7a7671'); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } }, [2.5, 2]),
    parquet: canvasTex(256, 256, (g, w, h) => { const cols = ['#7a5030', '#83593a', '#6f4a2c', '#8a6040', '#765033']; for (let y = 0; y < h; y += 16) { let x = -((y / 16) % 2) * 40; while (x < w) { const len = 60 + Math.random() * 60; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y, len - 1, 15); x += len; } } noise(g, 0, 0, 0, 'transparent'); g.globalAlpha = 0.08; for (let i = 0; i < 400; i++) { g.fillStyle = '#000'; g.fillRect(Math.random() * w, Math.random() * h, 8, 1); } }, [3, 3]),
    carpet: canvasTex(128, 128, (g, w, h) => noise(g, w, h, 0.08, '#30333a'), [6, 5]),
    stone: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, 0.05, '#9a948a'); g.strokeStyle = 'rgba(60,50,40,0.25)'; g.lineWidth = 2; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); } }, [4, 3]),
    corridor: canvasTex(256, 256, (g, w, h) => { noise(g, w, h, 0.04, '#5b5853'); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, h / 2 - 2, w, 4); }, [10, 1]),
  };
  // Monitor UI: scrolling "code" lines per division colour, shared by all desks of that colour.
  const screenTex = new Map();
  const screenFor = (hex) => {
    if (screenTex.has(hex)) return screenTex.get(hex);
    const t = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#0c1016'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 9) { const ind = (Math.random() * 4 | 0) * 8; g.fillStyle = Math.random() < 0.25 ? hex : 'rgba(220,230,240,0.55)'; g.fillRect(6 + ind, y, 20 + Math.random() * 70, 4); } }, [1, 0.5]);
    screenTex.set(hex, t); return t;
  };

  // ───── materials & geometry (shared)
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  const M = {
    ground: std(0x15120f, { roughness: 1 }), slab: std(0x2b2724, { roughness: 0.95 }), concrete: std(0xffffff, { roughness: 0.85, map: TEX.concrete }),
    corridor: std(0xffffff, { roughness: 0.7, map: TEX.corridor }), parquet: std(0xffffff, { roughness: 0.55, map: TEX.parquet }), darkwood: std(0x3b2a1e, { roughness: 0.6 }),
    stone: std(0xffffff, { roughness: 0.8, map: TEX.stone }), carpet: std(0xffffff, { roughness: 1, map: TEX.carpet }), playfloor: std(0x3a3f44, { roughness: 0.95 }),
    wall: std(0x1f1d1b, { roughness: 0.8 }), glass: new THREE.MeshStandardMaterial({ color: 0xc9d6e2, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    mullion: std(0x111111, { metalness: 0.6, roughness: 0.4 }), desk: std(0x3a2e25, { roughness: 0.55 }), deskTop: std(0x5a4636, { roughness: 0.5 }),
    whiteTop: std(0xe4e0d8, { roughness: 0.45 }), metal: std(0x2a2a2a, { metalness: 0.7, roughness: 0.35 }), chair: std(0x161616, { roughness: 0.6 }),
    leather: std(0x5b3a26, { roughness: 0.55 }), screen: std(0x0d0f12, { roughness: 0.3 }), plant: std(0x3d6b3a, { roughness: 0.9 }), pot: std(0x2b2b2b),
    felt: std(0x1f6b3e, { roughness: 1 }), pingpong: std(0x1f4f8a, { roughness: 0.6 }), sofa: std(0x4a4540, { roughness: 0.95 }), rug: std(0x6b5a48, { roughness: 1 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xcfc4b2, transparent: true, opacity: 0.55 }), robot: std(0xeeece8, { roughness: 0.28, metalness: 0.2 }), eyeMat: new THREE.MeshBasicMaterial({ color: 0x111111 }), robotDark: std(0x2a2a2c, { roughness: 0.4, metalness: 0.4 }),
    suit: std(0x2b2f36, { roughness: 0.8 }), skin: std(0xd6a985, { roughness: 0.7 }), hair: std(0x1d1612, { roughness: 0.9 }), dim: std(0x5a5a5a, { roughness: 0.6 }),
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const G = {
    leg: box(0.05, 0.72, 0.05), deskTop: box(1.7, 0.06, 0.85), monitor: box(0.75, 0.45, 0.04), screen: new THREE.PlaneGeometry(0.69, 0.39),
    seat: box(0.5, 0.08, 0.5), back: box(0.5, 0.55, 0.06), divider: box(1.75, 0.55, 0.05),
    torso: new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), head: new THREE.SphereGeometry(0.17, 16, 12), limb: new THREE.CapsuleGeometry(0.065, 0.36, 3, 6),
    visor: box(0.22, 0.06, 0.05), pad: new THREE.CircleGeometry(0.48, 32), padRing: new THREE.RingGeometry(0.48, 0.58, 40), packet: new THREE.SphereGeometry(0.15, 12, 10),
    ball: new THREE.SphereGeometry(0.045, 8, 6),
  };
  const colorMats = new Map();
  const cmat = (hex, o = {}) => { const k = hex + JSON.stringify(o); if (!colorMats.has(k)) colorMats.set(k, new THREE.MeshBasicMaterial({ color: hex, ...o })); return colorMats.get(k); };

  // ───── canvas helpers: background, floor text, sprites
  function gradientTexture(top, bottom) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top); grd.addColorStop(1, bottom); g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function floorText(text, w, { color = 'rgba(255,255,255,0.20)', size = 120 } = {}) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
    const g = c.getContext('2d'); g.font = `800 ${size}px Geist, Inter, system-ui, sans-serif`; g.fillStyle = color; g.textBaseline = 'middle';
    const tw = g.measureText(text).width; const scale = Math.min(1, 980 / tw);
    g.save(); g.translate(20, 80); g.scale(scale, 1); g.fillText(text, 0, 0); g.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 1024), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
    return m;
  }
  function textSprite(lines, o = {}) {
    const { bg = 'rgba(12,12,12,0.86)', fg = '#fafafa', size = 28, pad = 12, accent = null, scale = 0.009, mono = false, border = 'rgba(255,255,255,0.14)' } = o;
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    const fam = mono ? '"Geist Mono", ui-monospace, Consolas, monospace' : 'Geist, Inter, system-ui, sans-serif';
    const font = (i) => `${i === 0 || o.sameColor ? 600 : 450} ${i === 0 || o.sameColor ? size : size * 0.82}px ${fam}`;
    const arr = Array.isArray(lines) ? lines : [lines];
    const widths = arr.map((l, i) => { g.font = font(i); return g.measureText(l).width; });
    const dot = accent ? size * 0.75 : 0;
    const w = Math.ceil(Math.max(...widths) + pad * 2 + dot); const lh = size * 1.3; const h = Math.ceil(lh * arr.length + pad);
    c.width = w; c.height = h;
    g.fillStyle = bg; rr(g, 1, 1, w - 2, h - 2, 8); g.fill(); g.strokeStyle = border; g.lineWidth = 2; g.stroke();
    if (accent) { g.fillStyle = accent; g.beginPath(); g.arc(pad + size * 0.25, pad / 2 + lh / 2, size * 0.22, 0, Math.PI * 2); g.fill(); }
    arr.forEach((l, i) => { g.font = font(i); g.fillStyle = i === 0 || o.sameColor ? fg : 'rgba(250,250,250,0.62)'; g.textBaseline = 'middle'; g.fillText(l, pad + dot, pad / 2 + lh * (i + 0.5)); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(w * scale, h * scale, 1); s.renderOrder = 10;
    return s;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const disposeSprite = (s) => { if (!s) return; s.parent?.remove(s); s.material.map?.dispose(); s.material.dispose(); };
  function bookTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#2a1e15'; g.fillRect(0, 0, 256, 128);
    const cols = ['#7a3b2e', '#2f4a5c', '#6b5a2a', '#3d5a3a', '#4a3555', '#8a7a62', '#5c2a2a', '#2a3d4a'];
    for (const y of [4, 46, 88]) { let x = 2; while (x < 254) { const bw = 4 + Math.random() * 7; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y + Math.random() * 6, bw - 1, 36 - Math.random() * 6); x += bw; } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const books = new THREE.MeshStandardMaterial({ map: bookTexture(), roughness: 0.9 });

  // ───── generic props
  const add = (mesh, x, y, z, parent = world, { cast = true, receive = false } = {}) => { mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh); return mesh; };
  const F = makeFurniture();
  /** Place a furniture group in a room and register it as an obstacle (footprint w×d, rotation snapped to 90°). */
  function place(parent, grp, x, z, ry = 0, w = 0, d = 0) {
    grp.position.set(x, 0, z); grp.rotation.y = ry; parent.add(grp);
    if (w && d) { const swap = Math.abs(Math.sin(ry)) > 0.7; solid(x, z, swap ? d : w, swap ? w : d); }
    return grp;
  }
  const plant = (x, z, s = 1, parent = world, kind = (Math.random() * 3) | 0) => place(parent, F.plant(s, kind), x, z, Math.random() * 6, 0.5 * s, 0.5 * s);
  function ceilingLamp(x, z, w = 2.4, parent = world) { const m = new THREE.Mesh(box(w, 0.03, 0.14), M.lamp); m.position.set(x, WALL_H + 0.05, z); parent.add(m); return m; }
  function wallText(text, w, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d');
    g.font = '700 110px "Geist Mono", ui-monospace, monospace'; g.fillStyle = color; g.textBaseline = 'middle';
    const tw = g.measureText(text).width; const sc = Math.min(1, 980 / tw); g.save(); g.translate(512 - (tw * sc) / 2, 80); g.scale(sc, 1); g.fillText(text, 0, 0); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.156), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  }

  // ───── draw-call reduction: merge static meshes that share a material into one mesh
  function mergeInto(parent, meshes) {
    const groups = new Map();
    for (const m of meshes) {
      const k = m.material.uuid + (m.castShadow ? 'c' : '') + (m.receiveShadow ? 'r' : '') + m.renderOrder;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); g.applyMatrix4(m.matrixRel); return g; });
      let merged;
      try { merged = mergeGeometries(geos, false); } catch { merged = null; }
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.renderOrder = list[0].renderOrder;
      parent.add(mesh);
      for (const m of list) m.parent.remove(m);
    }
  }
  const skipMerge = (o) => { if (o.isInstancedMesh) return true; for (let p = o; p && p !== world; p = p.parent) if (p.userData.dynamic || p.userData.keep) return true; return pickables.includes(o) || o.userData.keep; };
  function mergeStatic() {
    world.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(world.matrixWorld).invert();
    const meshes = [];
    world.traverse((o) => { if (o.isMesh && !skipMerge(o) && o.geometry.attributes.uv && o.geometry.attributes.normal) { o.matrixRel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); meshes.push(o); } });
    mergeInto(world, meshes);
  }
  /** Merge the rigid parts of one character group (body or head) – keeps limbs/visor separate so they can animate. */
  function mergeRigid(group) {
    const meshes = group.children.filter((o) => o.isMesh && !o.userData.keep && o.visible && o.geometry.attributes.uv);
    for (const m of meshes) { m.updateMatrix(); m.matrixRel = m.matrix.clone(); }
    mergeInto(group, meshes);
  }

  // ───── layout: division sections interleaved with shared facilities so every wing has somewhere to meet, read and rest
  const SPECIAL = { rnd: 'lab', qa: 'lab', mfg: 'factory', scm: 'warehouse', ecom: 'studio', it: 'servers', design: 'creative' };
  function sectionsFor(divs) {
    const exec = divs.find((d) => d.id === 'exec');
    const work = divs.filter((d) => d !== exec).map((d) => ({ id: d.id, kind: 'work', variant: SPECIAL[d.id] || 'office', div: d, name: d.name }));
    const fac = FACILITIES.map((f) => ({ ...f }));
    const list = [];
    if (exec) list.push({ id: exec.id, kind: 'private', variant: 'exec', div: exec, name: exec.name });
    list.push(fac[0]);
    const slots = [fac[1], fac[2], fac[3], fac[4]];
    const every = Math.max(3, Math.ceil(work.length / (slots.length + 1)));
    work.forEach((w, i) => { list.push(w); if ((i + 1) % every === 0 && slots.length) list.push(slots.shift()); });
    list.push(...slots);
    return list;
  }

  function build() {
    for (const r of rooms.values()) disposeSprite(r.sign);
    for (const a of avatars.values()) { disposeSprite(a.label); disposeSprite(a.bubble); }
    world.clear(); rooms.clear(); avatars.clear(); pickables.length = 0; claimed.clear(); solids.length = 0; pois.length = 0; blinkers.length = 0;
    const secs = sectionsFor(data.divisions);
    const wings = Math.max(1, Math.min(4, Math.ceil(secs.length / 8)));
    const cols = Math.ceil(secs.length / (2 * wings));
    lenX = cols * RW;
    const wingD = RD * 2 + CORR;
    const depth = wingD * wings;
    hallX = -lenX / 2 - CORR / 2;
    corridors = Array.from({ length: wings }, (_, k) => -depth / 2 + wingD / 2 + k * wingD);
    const fullX = lenX + CORR, midX = -CORR / 2;
    // landscape: lawn, paving apron, entrance plaza, parking, trees, hedges
    add(new THREE.Mesh(new THREE.PlaneGeometry(fullX + 120, depth + 120).rotateX(-Math.PI / 2), F.M.floor.grass), midX, -0.03, 0, world, { cast: false, receive: true });
    add(new THREE.Mesh(box(fullX + 6, 0.06, depth + 6), F.M.floor.paving), midX, -0.02, 0, world, { cast: false, receive: true });
    add(new THREE.Mesh(box(14, 0.05, Math.min(depth, 18)), F.M.floor.paving), -lenX / 2 - CORR - 9, -0.015, 0, world, { cast: false, receive: true });
    add(new THREE.Mesh(box(18, 0.05, depth * 0.8), F.M.floor.asphalt), lenX / 2 + 13, -0.015, 0, world, { cast: false, receive: true });
    for (let k = 0; k < Math.floor(depth * 0.8 / 3); k++) { add(new THREE.Mesh(box(4.5, 0.01, 0.08), M.lamp), lenX / 2 + 10.5, 0.02, -depth * 0.4 + 1.5 + k * 3, world, { cast: false }); if (k % 3 === 1) place(world, F.car([0x8a1c1c, 0x1c3f8a, 0xd9d9d9, 0x222222, 0x5b6b4b][k % 5]), lenX / 2 + 10.5, -depth * 0.4 + 3 + k * 3, Math.PI / 2); }
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; place(world, F.tree(1 + (k % 3) * 0.15), midX + Math.cos(a) * (fullX / 2 + 11), Math.sin(a) * (depth / 2 + 11), k); }
    for (const z of [-depth / 2 - 4, depth / 2 + 4]) place(world, F.hedge(fullX * 0.8), midX, z);
    add(new THREE.Mesh(box(fullX + 1.2, 0.3, depth + 1.2), M.slab), midX, -0.15, 0, world, { cast: false, receive: true });
    for (const zc of corridors) add(new THREE.Mesh(box(lenX, 0.02, CORR), F.M.floor.terrazzo), 0, 0.01, zc, world, { cast: false, receive: true });
    for (const zc of corridors) for (let x = -lenX / 2 + RW; x < lenX / 2; x += RW) { place(world, F.pendant(WALL_H - 0.1), x, zc); if (Math.random() < 0.6) plant(x - 0.8, zc + (Math.random() < 0.5 ? -1 : 1) * (CORR / 2 - 0.5), 1.1); }
    // atrium hall: terrazzo, reception desk, lounge chairs, big plants, painted welcome
    add(new THREE.Mesh(box(CORR, 0.02, depth), F.M.floor.terrazzo), hallX, 0.012, 0, world, { cast: false, receive: true });
    const welcome = floorText('RAY // GROUP', Math.min(depth * 0.6, 26), { color: 'rgba(40,30,20,0.18)' });
    welcome.rotation.z = Math.PI / 2; welcome.position.set(hallX + 1.2, 0.03, 0); world.add(welcome);
    const rec = new THREE.Group();
    F.put(rec, F.rbox(0.8, 1.05, 3.6, 0.05), F.M.walnut, 0, 0.52, 0); F.put(rec, F.rbox(0.95, 0.05, 3.7, 0.02), F.M.laminate, 0, 1.07, 0); F.put(rec, F.box(0.04, 0.5, 2.6), F.M.emissiveWarm, 0.42, 0.55, 0, { cast: false });
    place(world, rec, hallX - 1.6, 0, 0, 0.9, 3.7);
    for (const z of [-depth / 2 + 2, depth / 2 - 2]) { place(world, F.armchair(), hallX + 1.3, z * 0.82, Math.PI / 2, 1, 1); place(world, F.coffeeTable(0.8, 0.8), hallX + 1.3, z * 0.7, 0, 0.8, 0.8); }
    for (const z of [-depth / 2 + 1, depth / 2 - 1, -5, 5]) plant(hallX - CORR / 2 + 0.7, z, 1.5, world, 2);

    secs.forEach((s, i) => {
      const wing = Math.floor(i / (2 * cols));
      const j = i % (2 * cols);
      const side = j % 2 === 0 ? -1 : 1; // -1: row on the -z side of its corridor
      const col = Math.floor(j / 2);
      const zc = corridors[wing];
      const cx = -lenX / 2 + RW / 2 + col * RW;
      const cz = zc + side * (CORR / 2 + RD / 2);
      const exterior = (wing === 0 && side < 0) || (wing === wings - 1 && side > 0);
      const room = { ...s, cx, cz, zc, side, exterior, spots: [], desks: [], group: new THREE.Group() };
      room.door = new THREE.Vector3(cx, 0, zc + side * (CORR / 2 - 0.6));
      room.inside = new THREE.Vector3(cx, 0, zc + side * (CORR / 2 + 1.2));
      world.add(room.group);
      buildRoom(room);
      rooms.set(s.id, room);
    });
    // envelope: curtain walls with mullions on the long sides, glass entrance, solid end wall
    for (const z of [-depth / 2, depth / 2]) {
      add(new THREE.Mesh(box(fullX, WALL_H, 0.05), F.M.glass), midX, WALL_H / 2, z, world, { cast: false });
      for (let x = -lenX / 2 - CORR; x <= lenX / 2 + 0.01; x += 1.6) add(new THREE.Mesh(box(0.05, WALL_H, 0.08), F.M.frame), x, WALL_H / 2, z, world, { cast: false });
      add(new THREE.Mesh(box(fullX, 0.08, 0.1), F.M.frame), midX, WALL_H, z, world, { cast: false });
    }
    add(new THREE.Mesh(box(0.06, WALL_H, depth), F.M.glass), -lenX / 2 - CORR, WALL_H / 2, 0, world, { cast: false });
    add(new THREE.Mesh(box(0.2, WALL_H, depth), F.M.plaster), lenX / 2, WALL_H / 2, 0, world, { cast: false });
    for (const z of [-depth / 2, depth / 2]) solid(midX, z, fullX, 0.3);
    solid(-lenX / 2 - CORR, 0, 0.3, depth); solid(lenX / 2, 0, 0.3, depth);
    const half = Math.max(fullX, depth) / 2 + 8;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 260 });
    sun.target.position.set(midX, 0, 0); sun.position.set(midX - 70, 48, 42);
    sun.shadow.camera.updateProjectionMatrix();
    env = buildSurroundings({ F, world, center: { x: midX, z: 0 }, half: { x: fullX / 2, z: depth / 2 } });
    env.setDusk(document.documentElement.dataset.theme === 'light' ? 0 : 1);
    setTimeout(applySun, 0);
    bounds = new THREE.Box3(new THREE.Vector3(-lenX / 2 - CORR - 0.5, 0, -depth / 2 - 0.5), new THREE.Vector3(lenX / 2 + 0.5, 3, depth / 2 + 0.5));
    fitCamera(true);
  }

  function buildRoom(r) {
    const g = r.group; const { cx, cz, side, zc } = r;
    const Z = (t) => zc + side * (CORR / 2 + t); // t: 0 at the corridor glass → RD at the back wall
    const floorMat = { office: F.M.floor.office, exec: F.M.floor.exec, lab: F.M.floor.vinyl, servers: F.M.floor.vinyl, factory: F.M.floor.epoxy, warehouse: F.M.floor.epoxy, studio: F.M.floor.office, creative: F.M.floor.exec, conference: F.M.floor.carpet, library: F.M.floor.exec, cafe: F.M.floor.terrazzo, play: F.M.floor.carpet, lounge: F.M.floor.exec }[r.variant || r.kind] || F.M.floor.office;
    const fl = add(new THREE.Mesh(box(RW - 0.15, 0.03, RD - 0.1), floorMat), cx, 0.015, cz, g, { cast: false, receive: true });
    fl.userData = { room: r.id }; pickables.push(fl);
    // partitions: plaster side walls with baseboard + soft AO on the floor; back wall plaster (or curtain wall if exterior)
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(box(0.14, WALL_H, RD), F.M.plaster), cx + sx * RW / 2, WALL_H / 2, cz, g, { cast: false, receive: true });
      add(new THREE.Mesh(box(0.16, 0.1, RD), F.M.base), cx + sx * RW / 2, 0.05, cz, g, { cast: false });
      const ao = add(new THREE.Mesh(new THREE.PlaneGeometry(RD, 0.6), F.M.wallAO), cx + sx * (RW / 2 - 0.37), 0.02, cz, g, { cast: false }); ao.rotation.set(-Math.PI / 2, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2); ao.renderOrder = 1;
      solid(cx + sx * RW / 2, cz, 0.25, RD);
    }
    if (!r.exterior) { add(new THREE.Mesh(box(RW, WALL_H, 0.14), F.M.plasterWarm), cx, WALL_H / 2, Z(RD), g, { cast: false, receive: true }); add(new THREE.Mesh(box(RW, 0.1, 0.16), F.M.base), cx, 0.05, Z(RD) - side * 0.01, g, { cast: false }); solid(cx, Z(RD), RW, 0.25); }
    const aoB = add(new THREE.Mesh(new THREE.PlaneGeometry(RW, 0.6), F.M.wallAO), cx, 0.02, Z(RD - 0.37), g, { cast: false }); aoB.rotation.set(-Math.PI / 2, 0, side > 0 ? 0 : Math.PI); aoB.renderOrder = 1;
    // corridor façade: framed glass with a 1.8 m doorway
    const fz = Z(0); const seg = (RW - 1.8) / 2;
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(box(seg, WALL_H, 0.04), F.M.glass), cx + sx * (0.9 + seg / 2), WALL_H / 2, fz, g, { cast: false });
      for (let k = 0; k <= 3; k++) add(new THREE.Mesh(box(0.05, WALL_H, 0.07), F.M.frame), cx + sx * (0.9 + (k * seg) / 3), WALL_H / 2, fz, g, { cast: false });
      add(new THREE.Mesh(box(seg, 0.05, 0.07), F.M.frame), cx + sx * (0.9 + seg / 2), 0.03, fz, g, { cast: false });
      solid(cx + sx * (0.9 + seg / 2), fz, seg, 0.15);
    }
    add(new THREE.Mesh(box(RW, 0.09, 0.09), F.M.frame), cx, WALL_H, fz, g, { cast: false });
    // painted floor title near the entrance + glowing name on the back wall
    const title = r.kind === 'work' ? `${r.div.name.toUpperCase()}` : r.kind === 'private' ? 'EXECUTIVE OFFICE' : r.name.toUpperCase();
    const ft = floorText(title, RW * 0.7, { color: 'rgba(30,25,20,0.16)' }); ft.position.set(cx, 0.035, Z(0.8)); g.add(ft);
    const accent = r.div ? r.div.color : '#d8c3a5';
    add(new THREE.Mesh(box(RW - 0.5, 0.015, 0.1), cmat(accent)), cx, 0.035, Z(0.14), g, { cast: false });
    if (!r.exterior) { const wt = wallText(title, Math.min(6, RW * 0.5), accent); wt.position.set(cx, 2.05, Z(RD) - side * 0.08); wt.rotation.y = side > 0 ? Math.PI : 0; g.add(wt); }
    const spot = (x, z, face, pose = 'stand', tag = '') => r.spots.push({ p: new THREE.Vector3(x, 0, z), face, pose, tag, key: `${r.id}:${r.spots.length}` });
    const back = Z(RD - 0.45);
    const faceBack = side > 0 ? 0 : Math.PI, faceFront = side > 0 ? Math.PI : 0;
    const wallFace = side > 0 ? Math.PI : 0; // rotation for objects hung on the back wall facing into the room
    // décor shared by all rooms
    plant(cx - RW / 2 + 0.7, back, 1.2, g, 2); plant(cx + RW / 2 - 0.7, Z(0.9), 0.9, g);
    if (!r.exterior) { const art = F.wallArt(1.3, 0.85); art.position.set(cx - RW / 2 + 2.6, 1.55, Z(RD) - side * 0.09); art.rotation.y = wallFace; g.add(art); }
    const clk = F.clock(); clk.position.set(cx + RW / 2 - 0.09, 2.05, cz); clk.rotation.y = -Math.PI / 2; g.add(clk);

    if (r.kind === 'work' || r.kind === 'private') {
      const v = r.variant;
      const deskFront = v === 'office' || v === 'creative' || v === 'servers' || v === 'exec';
      r.deskSlots = (n) => {
        const per = 4, sx = (RW - 1.6) / per;
        const rows = Math.max(1, Math.ceil(n / per));
        const pitch = deskFront ? Math.min(2.5, (RD - 3.2) / rows) : 2.2;
        const out = [];
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - row * per);
          out.push({ x: cx + (c - (inRow - 1) / 2) * sx, z: Z(2.1 + row * pitch) });
        }
        return out;
      };
      if (v === 'exec') {
        place(g, F.rug(RW * 0.6, RD * 0.5, 0x6d5a48), cx, cz + side * 0.6);
        for (let k = -1; k <= 1; k++) place(g, F.bookshelf(1.5, 2.1, 0.38, books), cx + k * 1.7 + 1.5, back, wallFace, 1.5, 0.4);
        place(g, F.sofa(2.2, F.M.leather), cx - RW / 2 + 1.9, Z(RD - 1.6), faceFront, 2.2, 1);
        place(g, F.coffeeTable(), cx - RW / 2 + 1.9, Z(RD - 2.8), 0, 1.2, 0.6);
      }
      if (v === 'office') {
        // kanban board with live sticky notes + team table
        const board = F.whiteboard(2.4, 1.2); board.position.set(cx + RW / 2 - 2.2, 1.4, Z(RD) - side * 0.1); board.rotation.y = wallFace; g.add(board);
        r.board = { x: cx + RW / 2 - 2.2, z: Z(RD) - side * 0.12, notes: [], side };
        place(g, F.roundTable(0.55), cx - RW / 2 + 2.2, Z(RD - 1.8), 0, 1.1, 1.1);
        for (const a of [0, 2.1, 4.2]) { const c = F.cafeChair(); place(g, c, cx - RW / 2 + 2.2 + Math.sin(a) * 0.85, Z(RD - 1.8) + Math.cos(a) * 0.85, a + Math.PI); spot(cx - RW / 2 + 2.2 + Math.sin(a) * 0.85, Z(RD - 1.8) + Math.cos(a) * 0.85, a + Math.PI, 'sit', 'huddle'); }
      }
      if (v === 'creative') { for (let k = 0; k < 2; k++) place(g, F.draftTable(), cx - 2 + k * 4, Z(RD - 1.6), faceFront, 1.3, 1); const mb = F.whiteboard(3, 1.3); mb.position.set(cx, 1.45, Z(RD) - side * 0.1); mb.rotation.y = wallFace; g.add(mb); }
      if (v === 'servers') for (let k = 0; k < 5; k++) { const x = cx - RW / 2 + 1.4 + k * 0.8; place(g, F.serverRack(), x, Z(RD - 0.8), faceFront, 0.6, 0.9); for (let l = 0; l < 6; l++) { const led = add(new THREE.Mesh(box(0.05, 0.025, 0.01), new THREE.MeshBasicMaterial({ color: l % 3 ? 0x3ddc84 : 0x5b8cff })), x - 0.18 + (l % 3) * 0.12, 0.6 + Math.floor(l / 3) * 0.7, Z(RD - 0.8) - side * 0.46, g, { cast: false }); led.userData.keep = true; blinkers.push(led); } }
      if (v === 'lab') {
        for (let k = 0; k < 2; k++) place(g, F.labBench(3), cx - 2.6 + k * 5.2, Z(RD - 2.6), 0, 3, 0.8);
        place(g, F.fumeHood(), cx + RW / 2 - 1.2, Z(RD - 0.6), faceFront, 1.4, 0.8); place(g, F.fumeHood(), cx - RW / 2 + 1.2, Z(RD - 0.6), faceFront, 1.4, 0.8);
        for (let k = 0; k < 2; k++) { spot(cx - 2.6 + k * 5.2, Z(RD - 2.6) - side * 0.75, faceBack, 'stand', 'work'); }
      }
      if (v === 'factory') {
        for (let k = 0; k < 2; k++) place(g, F.mixTank(), cx - RW / 2 + 1.8 + k * 2, Z(RD - 1.6), 0, 1.4, 1.4);
        place(g, F.conveyor(4), cx + 1.6, Z(RD - 2.4), 0, 4, 0.7); place(g, F.filler(), cx + RW / 2 - 1.2, Z(RD - 2.4), 0, 1, 0.9);
        place(g, F.pallet(), cx + 1, Z(RD - 0.9), 0, 1.2, 1); place(g, F.pallet(false), cx + 2.4, Z(RD - 0.9), 0, 1.2, 1);
        for (const t of [RD - 3.4, RD - 0.2]) add(new THREE.Mesh(box(RW - 1, 0.012, 0.08), F.M.yellow), cx, 0.035, Z(t), g, { cast: false });
        spot(cx + 1.6, Z(RD - 3.1), faceBack, 'stand', 'work'); spot(cx - RW / 2 + 2.8, Z(RD - 2.6), faceBack, 'stand', 'work');
      }
      if (v === 'warehouse') {
        for (let k = 0; k < 3; k++) place(g, F.rack(2.8), cx - 3.6 + k * 3.6, Z(RD - 0.7), 0, 2.8, 1);
        for (let k = 0; k < 3; k++) place(g, F.pallet(k !== 1), cx - 3 + k * 3, Z(RD - 2.8), Math.random() * 0.3, 1.2, 1);
        for (const t of [RD - 1.6, RD - 3.6]) add(new THREE.Mesh(box(RW - 1, 0.012, 0.08), F.M.yellow), cx, 0.035, Z(t), g, { cast: false });
        spot(cx, Z(RD - 2), faceBack, 'stand', 'work');
      }
      if (v === 'studio') {
        place(g, F.displayShelf(2.4), cx, Z(RD - 0.5), wallFace, 2.4, 0.5);
        place(g, F.ringLight(), cx - 1.6, Z(RD - 2.4), 0); place(g, F.camera(), cx, Z(RD - 3.2), faceBack);
        place(g, F.roundTable(0.5), cx, Z(RD - 1.6), 0, 1, 1);
        spot(cx, Z(RD - 1.15), faceFront, 'stand', 'live');
      }
      if (r.div?.id === 'exec' || v === 'office') place(g, F.rug(4.5, 3.2, 0x7a6a5a), cx, Z(3.4), 0);
      // shared decor for every work room: art on the back wall, corner planters, a wall clock, storage credenza
      const hue = (parseInt((r.div?.color || '#888888').slice(1), 16) % 360) / 360;
      const decor = ['office', 'exec', 'creative', 'studio'].includes(v);
      if (decor) { const art = F.wallArt(1.1, 0.75, hue); art.position.set(cx - RW / 2 + 1.6, 1.55, Z(RD) - side * 0.06); art.rotation.y = wallFace; g.add(art); const clk = F.clock(); clk.position.set(cx - RW / 2 + 3.2, 1.9, Z(RD) - side * 0.05); clk.rotation.y = wallFace; g.add(clk); }
      plant(cx - RW / 2 + 0.55, Z(RD - 0.55), 1.2, g, 1); plant(cx + RW / 2 - 0.55, Z(0.6), 0.9, g, 0);
      if (v === 'office') { const cr = new THREE.Group(); F.put(cr, F.rbox(1.8, 0.75, 0.45, 0.02), F.M.walnut, 0, 0.38, 0); F.put(cr, F.box(1.7, 0.02, 0.4), F.M.blackMetal, 0, 0.77, 0, { cast: false }); F.put(cr, F.cyl(0.1, 0.13, 0.3, 12), F.M.ceramic, -0.5, 0.93, 0); F.put(cr, F.rbox(0.5, 0.05, 0.32, 0.01), F.M.paper, 0.4, 0.8, 0); place(g, cr, cx - 0.6, Z(RD - 0.3), wallFace, 1.8, 0.45); }
    }
    if (r.kind === 'conference') {
      place(g, F.rug(8, 4.4, 0x3b3d42), cx, cz, 0);
      place(g, F.tableLong(6.6, 1.7), cx, cz, 0, 6.6, 1.7);
      for (let k = 0; k < 6; k++) for (const s2 of [-1, 1]) {
        const x = cx - 2.75 + k * 1.1; const z = cz + s2 * 1.35;
        place(g, F.officeChair(F.M.leather), x, z, s2 > 0 ? 0 : Math.PI);
        spot(x, z, s2 > 0 ? Math.PI : 0, 'sit', 'meeting');
      }
      spot(cx - 3.9, cz, Math.PI / 2, 'stand', 'meeting'); spot(cx + 3.9, cz, -Math.PI / 2, 'stand', 'meeting');
      for (let k = -1; k <= 1; k++) place(g, F.pendant(2.15), cx + k * 2.2, cz);
      const tv = add(new THREE.Mesh(F.rbox(3.4, 1.9, 0.06, 0.02), F.M.screen), cx, 1.45, back + side * 0.2, g);
      tv.rotation.y = wallFace;
      const glow = add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.75), cmat(0x1b2a3a)), cx, 1.45, back + side * 0.16, g, { cast: false });
      glow.rotation.y = wallFace; r.screen = glow; glow.userData.keep = true;
      place(g, F.bookshelf(2.2, 0.8, 0.45, books), cx + RW / 2 - 1.6, back, wallFace, 2.2, 0.45);
      solid(cx, cz, 6.6, 1.7);
      pois.push({ id: 'meeting', x: cx, z: cz - side * 2.3, r: 2.6, label: 'Mulai rapat di sini', sub: 'Conference Hall' });
      const wbCanvas = document.createElement('canvas'); wbCanvas.width = 512; wbCanvas.height = 320;
      const wbTex = new THREE.CanvasTexture(wbCanvas); wbTex.colorSpace = THREE.SRGBColorSpace;
      const wb = add(new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshBasicMaterial({ map: wbTex })), cx - RW / 2 + 0.1, 1.4, cz, g, { cast: false });
      wb.rotation.y = Math.PI / 2; wb.userData.keep = true; r.whiteboard = { canvas: wbCanvas, tex: wbTex, key: '' };
      pois.push({ id: 'board', x: cx - RW / 2 + 1.2, z: cz, r: 1.6, label: 'Lihat whiteboard rapat', sub: 'Notulen & keputusan' });
    }
    if (r.kind === 'library') {
      for (let k = 0; k < 4; k++) {
        const x = cx - 4.5 + k * 3; place(g, F.bookshelf(0.42, 2.2, 3, books), x, Z(RD - 2.2), Math.PI / 2, 0.42, 3);
        spot(x + 0.6, Z(RD - 2.6), -Math.PI / 2, 'stand', 'read'); spot(x - 0.6, Z(RD - 1.8), Math.PI / 2, 'stand', 'read');
      }
      for (const x of [cx - 3, cx + 2]) {
        place(g, F.tableLong(2.6, 1), x, Z(3), 0, 2.6, 1);
        for (const dx of [-0.65, 0.65]) { place(g, F.cafeChair(), x + dx, Z(3) - side * 0.75, faceBack); spot(x + dx, Z(3) - side * 0.75, faceBack, 'sit', 'read'); }
        place(g, F.pendant(2.1), x, Z(3));
      }
      // Company Brain core
      const core = new THREE.Group();
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.25, 32), F.M.steel), 0, 0.12, 0, core);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 8, 40), F.M.emissiveWarm), 0, 0.27, 0, core, { cast: false }).rotation.x = Math.PI / 2;
      const orb = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xff9a3c, emissiveIntensity: 1.1, wireframe: true })), 0, 1.35, 0, core, { cast: false });
      const inner = add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffb15c, emissiveIntensity: 1.8 })), 0, 1.35, 0, core, { cast: false });
      const light = new THREE.PointLight(0xffb36b, 10, 9, 2); light.position.y = 1.4; core.add(light);
      core.position.set(cx + RW / 2 - 1.8, 0, Z(5.6));
      core.userData.dynamic = true; g.add(core);
      const hit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2, 8), new THREE.MeshBasicMaterial({ visible: false })), 0, 1, 0, core, { cast: false });
      hit.userData = { brain: true }; pickables.push(hit);
      brainCore = { group: core, orb, inner, light, pulse: 0 };
      solid(core.position.x, core.position.z, 1.8, 1.8);
      pois.push({ id: 'brain', x: core.position.x, z: core.position.z, r: 2.2, label: 'Buka Company Brain', sub: 'Knowledge graph perusahaan' });
    }
    if (r.kind === 'cafe') {
      const counter = new THREE.Group();
      F.put(counter, F.rbox(4.6, 1.05, 0.75, 0.04), F.M.walnut, 0, 0.52, 0); F.put(counter, F.rbox(4.7, 0.05, 0.85, 0.02), F.M.ceramic, 0, 1.07, 0);
      F.put(counter, F.rbox(0.45, 0.5, 0.4, 0.04), F.M.blackMetal, -1.4, 1.35, 0); F.put(counter, F.box(0.12, 0.04, 0.12), cmat(0xff7a3c), -1.4, 1.42, 0.21, { cast: false });
      for (let k = 0; k < 4; k++) F.put(counter, F.cyl(0.05, 0.04, 0.1, 10), F.M.ceramic, -0.4 + k * 0.22, 1.14, 0, { cast: false });
      place(g, counter, cx - 0.5, back - side * 0.1, wallFace, 4.7, 0.85);
      for (let k = 0; k < 4; k++) { place(g, F.barStool(), cx - 2.2 + k * 1.1, back - side * 1.05); spot(cx - 2.2 + k * 1.1, back - side * 1.05, faceBack, 'sit', 'leisure'); }
      const fridge = new THREE.Group(); F.put(fridge, F.rbox(0.9, 2, 0.75, 0.04), F.M.steel, 0, 1, 0); F.put(fridge, F.box(0.04, 0.6, 0.04), F.M.chrome, 0.35, 1.2, 0.39, { cast: false });
      place(g, fridge, cx + RW / 2 - 1, back, wallFace, 0.9, 0.75);
      for (const [dx, t] of [[-3.2, 2.6], [0, 2.6], [3.2, 2.6], [-1.6, 5], [1.6, 5]]) {
        const x = cx + dx, z = Z(t);
        place(g, F.roundTable(0.5), x, z, 0, 1, 1); place(g, F.pendant(2.1), x, z);
        for (const a of [0, Math.PI]) { place(g, F.cafeChair(), x + Math.sin(a) * 0.75, z + Math.cos(a) * 0.75, a + Math.PI); spot(x + Math.sin(a) * 0.75, z + Math.cos(a) * 0.75, a + Math.PI, 'sit', 'leisure'); }
      }
      pois.push({ id: 'coffee', x: cx - 1.9, z: back - side * 1.3, r: 1.6, label: 'Ambil kopi ☕', sub: 'Pantry' });
    }
    if (r.kind === 'play') {
      place(g, F.rug(6, 4, 0x2f3a4a), cx, cz, 0);
      const pool = new THREE.Group();
      F.put(pool, F.rbox(2.6, 0.14, 1.5, 0.04), F.M.walnut, 0, 0.8, 0); F.put(pool, F.box(2.3, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: 0x1f6b3e, roughness: 1 }), 0, 0.88, 0, { cast: false });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(pool, F.rbox(0.14, 0.75, 0.14, 0.03), F.M.walnut, sx * 1.15, 0.38, sz * 0.62);
      for (let k = 0; k < 7; k++) F.put(pool, new THREE.SphereGeometry(0.03, 8, 6), cmat([0xffffff, 0xf2c14e, 0xd1495b, 0x2e86ab, 0x111111, 0xe07a5f, 0x6a4c93][k]), -0.5 + (k % 4) * 0.08, 0.92, -0.1 + Math.floor(k / 4) * 0.08, { cast: false });
      place(g, pool, cx - 2.6, cz, 0, 2.6, 1.5);
      for (const [dx, dz, f] of [[-1.7, 0, Math.PI / 2], [1.7, 0, -Math.PI / 2], [0, 1.2, Math.PI]]) spot(cx - 2.6 + dx, cz + dz, f, 'stand', 'leisure');
      const pp = new THREE.Group(); F.put(pp, F.box(2.4, 0.04, 1.3), new THREE.MeshStandardMaterial({ color: 0x1f4f8a, roughness: 0.5 }), 0, 0.76, 0); F.put(pp, F.box(0.02, 0.15, 1.35), F.M.laminate, 0, 0.84, 0, { cast: false }); for (const lx of [-0.9, 0.9]) F.put(pp, F.box(0.06, 0.74, 1), F.M.blackMetal, lx, 0.37, 0);
      place(g, pp, cx + 2.6, cz + side * 1.8, 0, 2.4, 1.3);
      spot(cx + 2.6 - 1.6, cz + side * 1.8, Math.PI / 2, 'stand', 'leisure'); spot(cx + 2.6 + 1.6, cz + side * 1.8, -Math.PI / 2, 'stand', 'leisure');
      const fb = new THREE.Group(); F.put(fb, F.rbox(1.4, 0.9, 0.8, 0.04), F.M.walnut, 0, 0.45, 0); F.put(fb, F.box(1.3, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0x1f6b3e }), 0, 0.91, 0, { cast: false });
      place(g, fb, cx + 2.6, cz - side * 1.8, 0, 1.4, 0.8); spot(cx + 2.6, cz - side * 2.5, side > 0 ? 0 : Math.PI, 'stand', 'leisure');
      place(g, F.sofa(2.4), cx, back - side * 0.1, faceFront, 2.4, 1);
    }
    if (r.kind === 'lounge') {
      place(g, F.rug(RW * 0.6, RD * 0.5, 0x8c7b68), cx, cz, 0);
      place(g, F.sofa(3.6), cx, cz + side * 1.7, faceFront, 3.6, 1); place(g, F.sofa(2.4), cx - 2.8, cz + side * 0.2, Math.PI / 2, 2.4, 1);
      place(g, F.armchair(), cx + 2.4, cz - side * 0.6, -Math.PI / 2 - (side > 0 ? 0.4 : -0.4), 1, 1); place(g, F.coffeeTable(1.6, 0.8), cx, cz, 0, 1.6, 0.8);
      for (let k = -1.2; k <= 1.2; k += 1.2) spot(cx + k, cz + side * 1.55, faceFront, 'sit', 'leisure');
      spot(cx - 2.65, cz + side * 0.2, Math.PI / 2, 'sit', 'leisure'); spot(cx + 2.3, cz - side * 0.55, -Math.PI / 2, 'sit', 'leisure');
      const tv = add(new THREE.Mesh(F.rbox(2.6, 1.4, 0.05, 0.02), F.M.screen), cx, 1.45, Z(0.4), g); tv.rotation.y = faceBack;
      place(g, F.bookshelf(1.8, 1.9, 0.38, books), cx + RW / 2 - 1.4, back, wallFace, 1.8, 0.4);
      pois.push({ id: 'lounge', x: cx, z: cz, r: 2.2, label: 'Duduk santai di lounge', sub: 'Guest Lounge' });
    }
    if (r.div) pois.push({ id: `div:${r.div.id}`, x: cx, z: Z(1.2), r: 1.4, label: `${r.div.icon} ${r.div.name}`, sub: 'E: lihat divisi & tim' });
    spot(cx - 1.6, Z(1.4), faceBack, 'stand', 'door');
  }

  function buildDesk(room, slot, e) {
    const lead = e.isLead || e.isMaster || e.isPA;
    const ry = room.side < 0 ? 0 : Math.PI; // monitors face the back wall, people sit facing away from the corridor
    const g = new THREE.Group();
    const desk = F.desk({ w: lead ? 2 : 1.6, d: lead ? 0.9 : 0.8, lead });
    g.add(desk);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x14181d });
    const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), screenMat), 0, 1.12, -(lead ? 0.9 : 0.8) / 2 + 0.188, g, { cast: false }); scr.userData.keep = true;
    const chairGrp = F.officeChair(lead ? F.M.leather : new THREE.MeshStandardMaterial({ color: new THREE.Color(room.div?.color || '#777').lerp(new THREE.Color(0x555555), 0.6), roughness: 1 }));
    chairGrp.position.set(0, 0, 0.68); g.add(chairGrp);
    if (room.kind === 'work' && !lead) { const scrn = F.put(g, F.rbox(1.6, 0.45, 0.04, 0.015), new THREE.MeshStandardMaterial({ color: new THREE.Color(room.div.color).lerp(new THREE.Color(0xeeeeee), 0.55), roughness: 1 }), 0, 0.98, -0.42, { cast: false }); scrn.userData.small = true; }
    g.position.set(slot.x, 0, slot.z); g.rotation.y = ry;
    room.group.add(g);
    solid(slot.x, slot.z, lead ? 2.1 : 1.7, lead ? 1 : 0.9);
    const seat = new THREE.Vector3(0, 0, 0.66).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position);
    return { group: g, screenMat, chair: chairGrp, seat, facing: ry + Math.PI, room, color: new THREE.Color(room.div?.color || '#d8c3a5') };
  }

  // People: realistic low-poly humans (see people.js) + spawn pad, plumbob status marker, click target.
  function buildAvatar(e, desk) {
    const hex = desk.room.div?.color || '#d8c3a5';
    const color = new THREE.Color(hex);
    const P = makePerson(e, hex, add);
    const g = P.g; g.userData.dynamic = true;
    if (P.visor) P.visor.userData.keep = true;
    P.torso.userData.keep = true; // breathing animation scales the torso
    g.traverse((o) => { if (o.isMesh) o.castShadow = o === P.torso || o.geometry.type === 'CapsuleGeometry'; });
    mergeRigid(P.body); mergeRigid(P.head);
    for (const o of [P.face]) if (o) o.castShadow = false;
    const pad = add(new THREE.Mesh(G.pad, cmat('#' + color.getHexString(), { transparent: true, opacity: 0.22, depthWrite: false })), 0, 0.03, 0, g, { cast: false });
    pad.rotation.x = -Math.PI / 2; pad.scale.setScalar(0.8);
    const ring = add(new THREE.Mesh(G.padRing, cmat('#' + color.getHexString(), { transparent: true, opacity: 0.9, side: THREE.DoubleSide })), 0, 0.035, 0, g, { cast: false });
    ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.8);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), F.M.blobMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const statusDot = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: STATUS_COLOR.idle, transparent: true, opacity: 0.92 })), 0, P.top + 0.22, 0, g, { cast: false });
    statusDot.scale.set(1, 1.7, 1);
    const hit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshBasicMaterial({ visible: false })), 0, 1, 0, g, { cast: false });
    hit.userData = { agent: e.id }; pickables.push(hit);
    g.position.copy(desk.seat); g.rotation.y = desk.facing;
    world.add(g);
    const a = { id: e.id, e, g, body: P.body, torso: P.torso, head: P.head, neck: P.neck, face: P.face, visor: P.visor, looks: JSON.stringify(e.appearance || {}), armL: P.armL, armR: P.armR, legL: P.legL, legR: P.legR, pad, ring, statusDot, desk, T: P.T, sitDrop: P.sitDrop, topY: P.top, path: [], phase: Math.random() * 10, pose: 'sit', mode: 'desk', spot: null, until: 0, nextIdle: performance.now() + 6000 + Math.random() * 18000, label: null, bubble: null, bubbleUntil: 0, jump: 0, talkUntil: 0, waveUntil: 0, lookAt: null };
    avatars.set(e.id, a);
    updateLabel(a);
    return a;
  }

  /** Rebuild one character in place (appearance changed, e.g. the player picked a female/male look). */
  function rebuildAvatar(e) {
    const a = avatars.get(e.id); if (!a) return null;
    const pos = a.g.position.clone(), rot = a.g.rotation.y, wasPlayer = a.player;
    disposeSprite(a.label); disposeSprite(a.bubble); if (a.emote) disposeSprite(a.emote.s);
    world.remove(a.g);
    for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.agent === e.id) pickables.splice(i, 1);
    avatars.delete(e.id);
    const b = buildAvatar(e, a.desk);
    b.g.position.copy(pos); b.g.rotation.y = rot; b.pose = a.pose === 'sit' ? 'sit' : 'stand'; b.mode = a.mode; b.spot = a.spot;
    if (wasPlayer && player) { b.player = true; b.mode = 'player'; b.pose = 'stand'; player.a = b; if (b.label) b.label.visible = false; }
    b.waveUntil = performance.now() + 1500; emote(b, '✨', 1800);
    return b;
  }
  // Joint targets per frame (smoothed): walk/run cycle with knee & elbow bend, sitting, typing, reading, talking gestures, waving, breathing.
  const lerpJ = (o, axis, v, k) => { o.rotation[axis] += (v - o.rotation[axis]) * k; };
  function animate(a, dt, now) {
    const walking = a.path.length > 0 || a.moving;
    const run = a.running && walking;
    const sit = !walking && a.pose === 'sit';
    const p = a.phase * (run ? 11 : 7.4); // gait phase
    const amp = run ? 0.8 : 0.48;
    const mood = a.e.mind?.mood;
    let hL = 0, hR = 0, kL = 0.06, kR = 0.06, aL = 0, aR = 0, sL = 0.04, sR = 0.04, eL = -0.2, eR = -0.2, sRz = 0, sLz = 0, wL = 0, wR = 0;
    let hx = 0, hz = 0, lean = 0, sway = 0, twist = 0, bob = 0;
    if (walking) {
      // natural gait: hip swing, knee flexes while the leg swings forward, heel-toe ankle roll,
      // counter arm swing with elbow bend, pelvic sway, slight torso twist, lowest at double support
      const sp = Math.sin(p), cp = Math.cos(p);
      hL = sp * amp; hR = -hL;
      kL = Math.max(0, -cp) * amp * 1.55 + 0.1; kR = Math.max(0, cp) * amp * 1.55 + 0.1;
      aL = hL * 0.45 - kL * 0.3; aR = hR * 0.45 - kR * 0.3;
      sL = -hL * 0.75; sR = -hR * 0.75;
      eL = -0.22 - Math.max(0, -sL) * 0.7 - (run ? 0.9 : 0); eR = -0.22 - Math.max(0, -sR) * 0.7 - (run ? 0.9 : 0);
      bob = (1 - Math.abs(sp)) * (run ? 0.06 : 0.035);
      sway = sp * (run ? 0.02 : 0.03); twist = sp * 0.07; lean = run ? 0.14 : 0.04;
    } else if (sit) { hL = hR = -1.5; kL = kR = 1.45; aL = aR = -0.05; }
    else {
      // idle standing: contrapposto weight shift, one knee softens, gentle breathing in the shoulders
      const ws = Math.sin(a.phase * 0.33 + a.e.name.length);
      sway = ws * 0.018; kL = 0.06 + Math.max(0, ws) * 0.14; kR = 0.06 + Math.max(0, -ws) * 0.14; hL = -Math.max(0, ws) * 0.07; hR = -Math.max(0, -ws) * 0.07;
      sL = sR = 0.04 + Math.sin(a.phase * 1.6) * 0.015;
    }
    const typing = sit && (a.e.status === 'working' || a.e.status === 'chatting') && a.mode === 'desk';
    if (typing) { sL = sR = -0.5; eL = -1.0 + Math.sin(now * 0.021) * 0.09; eR = -1.0 + Math.cos(now * 0.019) * 0.09; wL = Math.sin(now * 0.03) * 0.15; wR = Math.cos(now * 0.027) * 0.15; hx = 0.12; }
    if (!walking && a.mode === 'read' && !sit) { sL = sR = -0.55; eL = eR = -1.25; hx = 0.25; }
    if (now < a.talkUntil) { sR = -0.6 + Math.sin(a.phase * 3.1) * 0.28; eR = -1.2 + Math.sin(a.phase * 4.3) * 0.3; wR = Math.sin(a.phase * 5) * 0.3; if (!sit) { sL = -0.25 + Math.sin(a.phase * 2.2 + 1) * 0.18; eL = -0.9 + Math.cos(a.phase * 3.3) * 0.2; } hx += Math.sin(a.phase * 6.5) * 0.05; }
    if (now < a.waveUntil) { sR = -2.85; sRz = 0.25; eR = -0.35 + Math.sin(a.phase * 11) * 0.4; wR = Math.sin(a.phase * 11) * 0.3; }
    const gest = a.gest && now < a.gest.until ? a.gest.type : null;
    if (gest && !walking) {
      const w = a.phase;
      if (gest === 'cheer') { sL = sR = -2.9 + Math.sin(w * 9) * 0.15; eL = eR = -0.25; hx = -0.15; }
      else if (gest === 'think') { sR = -1.35; eR = -2.25; hz = 0.14; hx = 0.08; }
      else if (gest === 'nod') { hx = Math.max(0, Math.sin(w * 8)) * 0.22; }
      else if (gest === 'point') { sR = -1.5; eR = -0.12; sRz = -0.15; }
      else if (gest === 'shrug') { sL = sR = -0.3; eL = eR = -1.7; sLz = -0.2; sRz = 0.2; hz = 0.12; }
      else if (gest === 'facepalm') { sR = -2.1; eR = -2.45; hx = 0.3; }
      else if (gest === 'clap') { sL = sR = -1.15; eL = eR = -1.35 + Math.sin(w * 16) * 0.22; sLz = -0.25; sRz = 0.25; }
      else if (gest === 'stretch') { sL = sR = -3.0; eL = eR = -0.1; hx = -0.2; }
      else if (gest === 'dance') { const d = Math.sin(w * 7); sL = -2.4 + d * 0.5; sR = -2.4 - d * 0.5; eL = eR = -0.6; sway = d * 0.08; twist = Math.sin(w * 3.5) * 0.3; bob = Math.abs(Math.sin(w * 7)) * 0.06; kL = 0.2 + Math.max(0, d) * 0.4; kR = 0.2 + Math.max(0, -d) * 0.4; hz = d * 0.12; }
      else if (gest === 'drink') { const up = Math.sin(w * 1.6) > 0.2; sR = up ? -1.25 : -0.55; eR = up ? -2.35 : -1.3; hx = up ? -0.12 : 0.05; }
      else if (gest === 'phone') { sR = -1.1; eR = -2.5; hz = 0.18; }
      else if (gest === 'laugh') { hx = -0.18 + Math.sin(w * 18) * 0.05; lean = -0.04 + Math.sin(w * 18) * 0.025; sL = sR = -0.35; eL = eR = -1.3; sLz = -0.15; sRz = 0.15; }
      else if (gest === 'sad') { hx = 0.32; lean = 0.07; sL = sR = 0.12; eL = eR = -0.08; }
      else if (gest === 'observe') { hx = 0.05 + Math.sin(w * 0.8) * 0.04; sL = sR = -0.45; eL = eR = -1.55; sLz = -0.35; sRz = 0.35; } // arms folded, listening
      else if (gest === 'present') { sR = -1.7 + Math.sin(w * 2.5) * 0.25; eR = -0.4; sRz = -0.3; wR = 0.4; sL = -0.4; eL = -1.0; }
      else if (gest === 'pipette') { sL = -1.0; eL = -1.2; sR = -1.15 + Math.sin(w * 6) * 0.08; eR = -1.35; wR = Math.sin(w * 6) * 0.25; hx = 0.3; }
      else if (gest === 'operate') { sL = sR = -1.05 + Math.sin(w * 4) * 0.12; eL = eR = -0.8; hx = 0.22; lean = 0.08; }
      else if (gest === 'carry') { sL = sR = -0.85; eL = eR = -1.25; sLz = -0.2; sRz = 0.2; lean = -0.03; kL = kR = 0.15 + Math.max(0, Math.sin(w * 2)) * 0.5; hx = 0.1; }
    } else if (!walking && a.mode === 'meeting' && a.lookAt && now > a.talkUntil && Math.sin(a.phase * 0.9 + a.e.name.length) > 0.75) hx = Math.max(0, Math.sin(a.phase * 7)) * 0.16; // listeners nod
    if (!walking && !sit && !gest && mood === 'lelah') { lean = 0.06; hx += 0.12; sL = sR = 0.1; }
    const k = Math.min(1, dt * 12);
    lerpJ(a.legL.hp, 'x', hL, k); lerpJ(a.legR.hp, 'x', hR, k); lerpJ(a.legL.kn, 'x', kL, k); lerpJ(a.legR.kn, 'x', kR, k);
    if (a.legL.an) { lerpJ(a.legL.an, 'x', aL, k); lerpJ(a.legR.an, 'x', aR, k); }
    lerpJ(a.armL.s, 'x', sL, k); lerpJ(a.armR.s, 'x', sR, k); lerpJ(a.armL.el, 'x', eL, k); lerpJ(a.armR.el, 'x', eR, k);
    lerpJ(a.armL.s, 'z', 0.07 + sLz, k); lerpJ(a.armR.s, 'z', -0.07 - sRz, k); // slight A-pose so hands clear the hips
    if (a.armL.wr) { lerpJ(a.armL.wr, 'x', wL, k); lerpJ(a.armR.wr, 'x', wR, k); }
    a.body.position.y = (sit ? (a.sitDrop ?? -0.34) * (a.T?.height || 1) : 0) + bob;
    a.torso.scale.y = 1 + (walking ? 0 : Math.sin(a.phase * 1.6) * 0.012);
    a.torso.scale.x = a.torso.scale.z = 1 + (walking ? 0 : Math.sin(a.phase * 1.6) * 0.008);
    a.body.rotation.z += (sway - a.body.rotation.z) * Math.min(1, dt * 10);
    a.body.rotation.x += (lean - a.body.rotation.x) * Math.min(1, dt * 6);
    a.body.rotation.y += (twist - a.body.rotation.y) * Math.min(1, dt * 10);
    if (!walking && !sit && !gest && mood === 'bersemangat') a.body.position.y += Math.abs(Math.sin(a.phase * 3)) * 0.012;
    // head: look at a target (speaker, the player, a colleague) or idle glance; counter-rotates the torso twist
    let yaw = a.mode === 'meeting' && !a.lookAt ? Math.sin(a.phase * 0.8) * 0.4 : !walking && !sit && !a.lookAt ? Math.sin(a.phase * 0.27 + a.e.name.length) * 0.35 : 0;
    if (a.lookAt) { const dx = a.lookAt.x - a.g.position.x, dz = a.lookAt.z - a.g.position.z; let d = Math.atan2(dx, dz) - a.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw = Math.max(-1.1, Math.min(1.1, d)); }
    yaw -= a.body.rotation.y;
    const hk = Math.min(1, dt * 5);
    a.head.rotation.y += (yaw * 0.65 - a.head.rotation.y) * hk;
    if (a.neck) a.neck.rotation.y += (yaw * 0.35 - a.neck.rotation.y) * hk;
    a.head.rotation.x += ((mood === 'lelah' || mood === 'ragu' ? 0.1 : 0) + hx - a.head.rotation.x) * Math.min(1, dt * 8);
    a.head.rotation.z += (hz - a.head.rotation.z) * Math.min(1, dt * 6);
    updateFace(a, now, gest, mood);
    if (a.emote) {
      const t = (now - a.emote.t0) / 1000, life = (a.emote.until - a.emote.t0) / 1000;
      if (t > life) { disposeSprite(a.emote.s); a.emote = null; }
      else { const pop = t < 0.25 ? 0.4 + (t / 0.25) * 0.75 : t < 0.4 ? 1.15 - (t - 0.25) * 1 : 1; a.emote.s.scale.setScalar(0.42 * pop); a.emote.s.position.y = (a.topY || 1.85) + 0.62 + t * 0.12; a.emote.s.material.opacity = t > life - 0.4 ? (life - t) / 0.4 : 1; }
    }
    if (a.bubble?.userData.base) { const t = (now - a.bubble.userData.t0) / 1000; const f = t < 0.18 ? 0.55 + (t / 0.18) * 0.55 : t < 0.3 ? 1.1 - (t - 0.18) * 0.8 : 1; a.bubble.scale.copy(a.bubble.userData.base).multiplyScalar(f); }
  }
  // ───── face: expression from emotion > speech > gesture > mood > activity, with natural blinking
  function updateFace(a, now, gest, mood) {
    if (!a.face) return;
    let ex = 'neutral';
    const emo = a.emo && now < a.emo.until ? a.emo.type : null;
    if (emo) ex = emo;
    else if (now < a.talkUntil) { const s = Math.sin(now * 0.026 + a.e.name.length) + Math.sin(now * 0.061) * 0.6; ex = s > 0.45 ? 'talk1' : s > -0.3 ? 'talk2' : 'smile'; }
    else if (gest === 'dance' || gest === 'cheer' || gest === 'laugh') ex = 'laugh';
    else if (gest === 'sad' || gest === 'facepalm') ex = 'sad';
    else if (gest === 'think' || gest === 'observe') ex = 'focus';
    else if (mood === 'lelah') ex = 'sleepy';
    else if (a.mode === 'leisure' || a.mode === 'visit') ex = 'smile';
    else if (a.e.status === 'working' || a.e.status === 'meeting') ex = 'focus';
    else if (mood === 'bersemangat' || mood === 'tenang') ex = 'smile';
    if (!a.blinkAt) a.blinkAt = now + 800 + Math.random() * 4000;
    const blink = now > a.blinkAt && now < a.blinkAt + 140 && ex !== 'laugh';
    if (now > a.blinkAt + 140) a.blinkAt = now + 2200 + Math.random() * 4200 * (Math.random() < 0.15 ? 0.1 : 1); // occasional double blink
    const key = ex + (blink ? '*' : '');
    if (key !== a.faceKey) { a.faceKey = key; a.face.material = faceTexture(ex, blink, a.T.hair, a.T.fem); }
  }
  /** Emotion = facial expression held for a while (laugh, sad, surprised, love, smile…). */
  const feel = (a, type, ms = 2500) => { if (a) a.emo = { type, until: performance.now() + ms }; };
  const SMALLTALK = ['Kopinya enak banget hari ini ☕', 'Hahaha serius? 😂', 'Weekend kemarin ke mana?', 'Campaign kemarin tembus target! 🎉', 'Aku lagi belajar skill baru nih 📚', 'Ayo satu ronde lagi! 🎮', 'GG! 😆', 'Butuh istirahat sebentar 😌', 'Ide bagus, nanti kita bahas di rapat', 'Mantap, lanjut! 💪', 'Eh, sudah lihat dashboard KPI tadi?', 'Siapa yang mau es kopi susu?', 'Tadi riset kompetitor seru banget', 'Wah, notulen rapat tadi rapi sekali 👏'];
  /** Life in shared spaces: play room games & dancing, café drinks, lounge small talk between neighbours. */
  function leisureLife(a, now) {
    if (a.mode !== 'leisure' || a.path.length || a.player || now < (a.nextAct || 0)) return;
    a.nextAct = now + 3500 + Math.random() * 6500;
    const kind = roomAt(a.g.position)?.kind;
    const near = [...avatars.values()].filter((o) => o !== a && o.mode === 'leisure' && !o.path.length && o.g.position.distanceTo(a.g.position) < 4.5);
    const r = Math.random();
    if (kind === 'play') {
      if (r < 0.35) { gesture(a, 'dance', 3200); feel(a, 'laugh', 3200); }
      else if (r < 0.6) { a.jump = 1; feel(a, 'laugh', 1800); emote(a, ['🎮', '😂', '🏓', '🎯'][(Math.random() * 4) | 0], 2000); }
      else if (r < 0.8) { gesture(a, 'cheer', 1800); feel(a, 'laugh', 2000); if (Math.random() < 0.5) say(a, ['GG! 😆', 'Ayo satu ronde lagi! 🎮', 'Hahaha 😂', 'Menang lagi! 🏆'][(Math.random() * 4) | 0], 2600); }
      else if (near[0]) { const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 2500; say(a, SMALLTALK[(Math.random() * SMALLTALK.length) | 0], 3200); setTimeout(() => { feel(o, 'laugh', 1500); gesture(o, 'laugh', 1500); }, 1400); }
    } else if (kind === 'cafe') {
      if (r < 0.45) { gesture(a, 'drink', 3000); feel(a, 'smile', 3000); }
      else if (near[0]) { const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 3000; feel(a, 'smile', 3000); say(a, SMALLTALK[(Math.random() * SMALLTALK.length) | 0], 3600); setTimeout(() => { o.talkUntil = performance.now() + 2200; if (Math.random() < 0.5) { feel(o, 'laugh', 1600); gesture(o, 'laugh', 1500); } }, 1800); }
      else { gesture(a, 'phone', 2600); }
    } else if (near[0]) {
      const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 2800; if (Math.random() < 0.45) say(a, SMALLTALK[(Math.random() * SMALLTALK.length) | 0], 3200);
      setTimeout(() => { o.talkUntil = performance.now() + 2000; feel(o, Math.random() < 0.4 ? 'laugh' : 'smile', 2000); }, 1500);
    } else if (r < 0.4) gesture(a, ['stretch', 'phone', 'think'][(Math.random() * 3) | 0], 2400);
  }
  // ───── expressions: emoji emotes that pop above the head + body gestures
  const emoteTex = new Map();
  function emote(a, ch, ms = 2600) {
    if (!a || !visible) return;
    if (!emoteTex.has(ch)) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = 'rgba(250,248,244,0.95)'; g.beginPath(); g.arc(64, 60, 50, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(52, 104); g.lineTo(64, 124); g.lineTo(76, 104); g.fill();
      g.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; emoteTex.set(ch, t);
    }
    if (a.emote) disposeSprite(a.emote.s);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTex.get(ch), transparent: true, depthTest: false }));
    sp.renderOrder = 20; sp.scale.setScalar(0.2); a.g.add(sp);
    a.emote = { s: sp, t0: performance.now(), until: performance.now() + ms };
  }
  const gesture = (a, type, ms = 2200) => { if (a && !a.player) a.gest = { type, until: performance.now() + ms }; };
  function updateLabel(a) {
    const key = `${a.e.name}|${a.e.title}`;
    if (a.labelKey === key) return;
    a.labelKey = key; disposeSprite(a.label);
    a.label = textSprite([`${a.e.name}${a.e.type === 'human' ? ' · human' : ''}`], { size: 24, accent: a.desk.room.div?.color, scale: 0.0075, mono: true });
    a.label.position.y = (a.topY || 1.85) + 0.48; a.label.visible = showLabels; a.g.add(a.label);
  }
  function wrap(text, width = 40, max = 4) {
    const words = String(text).replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; if (lines.length === max) break; } else cur += ' ' + w; }
    if (lines.length < max && cur.trim()) lines.push(cur.trim());
    if (lines.length === max && words.join(' ').length > lines.join(' ').length) lines[max - 1] = lines[max - 1].slice(0, width - 1) + '…';
    return lines.length ? lines : [''];
  }
  function say(a, text, ms = 4200, long = false) {
    if (!text) return;
    disposeSprite(a.bubble);
    const lines = long ? wrap(text, 42, 4) : wrap(text, 44, 1);
    a.bubble = textSprite(lines, { bg: 'rgba(250,248,244,0.96)', fg: '#141414', size: 22, scale: 0.0072, border: 'rgba(0,0,0,0.1)', sameColor: true });
    a.bubble.position.y = (a.topY || 1.85) + 0.85 + (lines.length - 1) * 0.12; a.g.add(a.bubble); a.bubbleUntil = performance.now() + ms;
    a.bubble.userData.base = a.bubble.scale.clone(); a.bubble.userData.t0 = performance.now();
  }

  // ───── navigation
  function roomAt(p) {
    for (const r of rooms.values()) if (Math.abs(p.x - r.cx) <= RW / 2 && Math.abs(p.z - r.cz) <= RD / 2) return r;
    return null;
  }
  const nearestCorridor = (z) => corridors.reduce((b, c) => (Math.abs(c - z) < Math.abs(b - z) ? c : b), corridors[0]);
  // rooms → own door → corridor lane → (atrium hall if changing wing) → target corridor → door → target
  function routeTo(a, target, onArrive) {
    const from = a.g.position.clone();
    const r1 = roomAt(from), r2 = roomAt(target);
    const pts = [];
    if (!(r1 && r1 === r2)) {
      const z1 = r1 ? r1.zc : nearestCorridor(from.z), z2 = r2 ? r2.zc : nearestCorridor(target.z);
      const lane = (Math.random() - 0.5) * (CORR - 2.6);
      if (r1) pts.push(r1.inside.clone(), r1.door.clone());
      const inHall = (p) => p.x < -lenX / 2;
      if (!inHall(from)) pts.push(new THREE.Vector3(r1 ? r1.cx : from.x, 0, z1 + lane));
      if (z1 !== z2 || inHall(from) || inHall(target)) {
        if (!inHall(from)) pts.push(new THREE.Vector3(hallX + lane * 0.4, 0, z1 + lane));
        if (!inHall(target)) pts.push(new THREE.Vector3(hallX + lane * 0.4, 0, z2 + lane));
      }
      if (r2) pts.push(new THREE.Vector3(r2.cx, 0, z2 + lane), r2.door.clone(), r2.inside.clone());
      else if (!inHall(target)) pts.push(new THREE.Vector3(target.x, 0, z2 + lane));
    }
    pts.push(target.clone());
    a.path = pts; a.onArrive = onArrive;
  }
  function release(a) { if (a.spot) { claimed.delete(a.spot.key); a.spot = null; } }
  function claimSpot(a, roomId, tag) {
    const r = rooms.get(roomId); if (!r) return null;
    const free = r.spots.filter((s) => (!tag || s.tag === tag) && !claimed.has(s.key));
    if (!free.length) return null;
    const s = free[(Math.random() * free.length) | 0];
    release(a); claimed.set(s.key, a.id); a.spot = s; return s;
  }
  function goSpot(a, s, mode, stay = 0) {
    a.mode = mode; a.pose = 'walk';
    routeTo(a, s.p, () => { a.faceTo = s.face; a.pose = s.pose; a.until = stay ? performance.now() + stay : 0; });
  }
  function goDesk(a) {
    release(a); a.mode = 'desk'; a.pose = 'walk';
    routeTo(a, a.desk.seat, () => { a.faceTo = a.desk.facing; a.pose = 'sit'; });
  }
  function visit(a, b) {
    if (!a || !b || a === b || a.player || a.mode === 'meeting' || a.e.status === 'offline' || a.e.type === 'human') return;
    release(a); a.mode = 'visit'; a.pose = 'walk';
    const p = b.desk.seat.clone().add(new THREE.Vector3(0.85, 0, 0));
    routeTo(a, p, () => { a.faceTo = Math.atan2(b.g.position.x - p.x, b.g.position.z - p.z); a.pose = 'stand'; a.until = performance.now() + 2600; });
  }
  // hands-on roles leave the desk to work at their station: lab bench, production line, racks, studio set
  const STATION = { lab: 'work', factory: 'work', warehouse: 'work', studio: 'live' };
  const ACT_EMOJI = { lab: ['🧪', '🔬', '⚗️'], factory: ['🏭', '⚙️', '🧴'], warehouse: ['📦', '🚚', '📋'], studio: ['🎬', '📸', '🎙️'] };
  const stationOf = (a) => { const v = a.desk?.room?.variant; return STATION[v] && a.e.type === 'ai' && !a.e.isLead ? v : null; };
  function want(a) {
    const s = a.e.status;
    if (s === 'meeting') return 'meeting';
    if (s === 'working' && READING.test(a.e.statusText || '')) return 'read';
    if (s === 'working' && stationOf(a) && !/menulis|laporan|rangkum|dokumen/i.test(a.e.statusText || '')) return 'station';
    if (s === 'working' || s === 'chatting' || s === 'offline') return 'desk';
    return 'free';
  }
  function applyWant(a) {
    if (a.player) return;
    const w = want(a);
    if (w === 'meeting' && a.mode !== 'meeting') { const s = claimSpot(a, 'conference', 'meeting'); if (s) goSpot(a, s, 'meeting'); }
    else if (w === 'read' && a.mode !== 'read') { const s = claimSpot(a, 'library', 'read'); if (s) goSpot(a, s, 'read'); else if (a.mode !== 'desk') goDesk(a); }
    else if (w === 'station' && a.mode !== 'station') { const v = stationOf(a); const s = claimSpot(a, a.desk.room.id, STATION[v]); if (s) { goSpot(a, s, 'station'); emote(a, ACT_EMOJI[v][(Math.random() * 3) | 0], 2600); } else if (a.mode !== 'desk') goDesk(a); }
    else if (w === 'desk' && a.mode !== 'desk' && a.mode !== 'visit' && a.mode !== 'talk') goDesk(a);
    else if (w === 'free' && (a.mode === 'meeting' || a.mode === 'read' || a.mode === 'station')) goDesk(a);
    if (a.e.status === 'working' && w !== 'station' && Math.random() < 0.5) emote(a, { mkt: '📣', sales: '🤝', eng: '💻', design: '🎨', cs: '💬', fin: '💰', hr: '🌱', ops: '⚙️', legal: '⚖️', it: '🛡️', data: '📊', reg: '📜', ecom: '🛒', kms: '🗂️', exec: '🧭', bizdev: '🤝', retail: '🛍️', studio: '🎬' }[a.e.divisionId] || '💼', 2200);
  }
  /** Station work loop: role-specific motions + occasional emoji while working hands-on. */
  function stationLife(a, now) {
    if (a.mode !== 'station' || a.path.length || now < (a.nextAct || 0)) return;
    a.nextAct = now + 2600 + Math.random() * 3000;
    const v = stationOf(a); if (!v) return;
    const g = { lab: ['pipette', 'pipette', 'think', 'observe'], factory: ['operate', 'operate', 'point', 'observe'], warehouse: ['carry', 'carry', 'point', 'stretch'], studio: ['present', 'present', 'laugh', 'cheer'] }[v];
    const pick = g[(Math.random() * g.length) | 0];
    gesture(a, pick, 2800);
    if (v === 'studio') { a.talkUntil = now + 2600; feel(a, 'smile', 2800); if (Math.random() < 0.3) say(a, ['Hai guys! Hari ini kita review serum baru ✨', 'Jangan lupa checkout ya! 🛒', 'Tekstur ringan banget 😍', 'Diskon live cuma sampai jam 9! ⏰'][(Math.random() * 4) | 0], 3200); }
    else feel(a, pick === 'observe' || pick === 'think' ? 'focus' : 'neutral', 2800);
    if (Math.random() < 0.25) emote(a, ACT_EMOJI[v][(Math.random() * 3) | 0], 2200);
  }

  // ───── effects
  function packet(from, to, color, onDone) {
    if (!from || !to) return;
    const mid = from.clone().add(to).multiplyScalar(0.5); mid.y += 2.5 + from.distanceTo(to) * 0.15;
    const curve = new THREE.QuadraticBezierCurve3(from.clone().setY(1.8), mid, to.clone().setY(1.8));
    const m = new THREE.Mesh(G.packet, new THREE.MeshBasicMaterial({ color, transparent: true }));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.75 }));
    line.computeLineDistances(); world.add(m, line);
    packets.push({ curve, m, line, t: 0, speed: 0.6 / Math.max(1, from.distanceTo(to) / 14), onDone });
  }
  function burst(pos, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY(0.06); world.add(ring); packets.push({ ring, t: 0 });
  }

  // ───── public sync
  function sync(next) {
    data = next;
    const key = data.divisions.map((d) => d.id + d.color + d.name).join() + '|' + data.employees.map((e) => e.id + e.divisionId + e.isLead + e.type).join();
    if (key !== layoutKey) {
      layoutKey = key; build();
      for (const r of rooms.values()) {
        if (!r.deskSlots) continue;
        const members = data.employees.filter((e) => e.divisionId === r.id).sort((a, b) => (b.isLead - a.isLead) || a.name.localeCompare(b.name));
        const slots = r.deskSlots(members.length);
        members.forEach((e, i) => { const d = buildDesk(r, slots[i], e); r.desks.push(d); buildAvatar(e, d); });
      }
      mergeStatic();
    }
    for (const e of data.employees) {
      let a = avatars.get(e.id); if (!a) continue;
      if (JSON.stringify(e.appearance || {}) !== a.looks) a = rebuildAvatar(e) || a;
      const prevStatus = a.e.status, prevText = a.e.statusText;
      a.e = e;
      a.statusDot.material.color.setHex(STATUS_COLOR[e.status] ?? STATUS_COLOR.idle);
      const on = e.status === 'working' || e.status === 'chatting';
      a.desk.screenMat.map = on ? screenFor('#' + a.desk.color.getHexString()) : null;
      a.desk.screenMat.color.set(on ? 0xffffff : e.status === 'offline' ? 0x050505 : 0x14181d);
      a.desk.screenMat.needsUpdate = true;
      if (a.visor) a.visor.visible = e.status !== 'offline';
      updateLabel(a);
      if (prevText !== e.statusText && e.status !== 'idle' && e.statusText) say(a, e.statusText);
      if (prevStatus !== e.status || prevText !== e.statusText) applyWant(a);
    }
    for (const r of rooms.values()) {
      let k, lines;
      if (r.kind === 'work' || r.kind === 'private') {
        const members = data.employees.filter((e) => e.divisionId === r.id);
        const working = members.filter((e) => e.status === 'working').length;
        const open = data.tasks.filter((t) => t.divisionId === r.id && t.status !== 'done').length;
        lines = [`${r.div.icon} ${r.div.name}`, `${working}/${members.length} active · ${open} tasks`];
      } else {
        const here = [...avatars.values()].filter((a) => roomAt(a.g.position) === r).length;
        lines = [r.name, `${r.note} · ${here} here`];
      }
      k = lines.join('|');
      if (k === r.signKey) continue;
      r.signKey = k; disposeSprite(r.sign);
      r.sign = textSprite(lines, { accent: r.div?.color || '#d8c3a5', size: 30, scale: 0.0082, mono: true });
      r.sign.position.set(r.cx, WALL_H + 0.9, r.zc + r.side * (CORR / 2 + 0.3)); r.sign.visible = !player; world.add(r.sign);
    }
    const conf = rooms.get('conference');
    if (conf?.screen) conf.screen.material = cmat(data.employees.some((e) => e.status === 'meeting') ? 0x3a6ea5 : 0x1b2a3a);
    // sticky notes on each section's board = open tasks (yellow todo, green in progress, orange waiting/review)
    for (const r of rooms.values()) {
      if (!r.board) continue;
      const ts = data.tasks.filter((t) => t.divisionId === r.id && t.status !== 'done').slice(0, 15);
      const key = ts.map((t) => t.status[0]).join('');
      if (key === r.board.key) continue;
      r.board.key = key;
      for (const n of r.board.notes) n.parent?.remove(n);
      r.board.notes = ts.map((t, i) => {
        const col = t.status === 'in_progress' ? 0x9be15d : t.status === 'todo' ? 0xffe27a : 0xffb36b;
        const n = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), cmat(col));
        n.position.set(r.board.x - 1 + (i % 5) * 0.48 + (Math.random() - 0.5) * 0.06, 1.75 - Math.floor(i / 5) * 0.34, r.board.z - r.board.side * 0.06);
        n.rotation.y = r.board.side < 0 ? 0 : Math.PI; n.rotation.z = (Math.random() - 0.5) * 0.2;
        r.group.add(n); return n;
      });
    }
    if (conf?.whiteboard) {
      const m = (data.meetings || []).at(-1);
      const key = m ? m.id + m.status + m.transcript.length : 'none';
      if (key !== conf.whiteboard.key) {
        conf.whiteboard.key = key;
        const g = conf.whiteboard.canvas.getContext('2d');
        g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, 512, 320);
        g.fillStyle = '#1b1b1b'; g.font = '700 26px Geist, sans-serif';
        g.fillText(m ? (m.status === 'running' ? '● RAPAT BERLANGSUNG' : 'RAPAT TERAKHIR') : 'WHITEBOARD', 22, 40);
        g.font = '600 22px Geist, sans-serif'; g.fillStyle = '#2f5ee0';
        const lines = m ? wrap(m.topic, 34, 2) : ['Belum ada rapat. Tekan E di dekat meja', 'untuk memulai rapat.'];
        lines.forEach((l, i) => g.fillText(l, 22, 78 + i * 28));
        g.font = '400 18px Geist, sans-serif'; g.fillStyle = '#333';
        const body = m ? (m.minutes ? m.minutes.replace(/##[^\n]*\n/g, '').split('\n').filter(Boolean) : m.transcript.slice(-3).map((x) => `${data.employees.find((e) => e.id === x.speakerId)?.name}: ${x.text}`)) : [];
        let y = 150; for (const b of body.slice(0, 6)) { for (const l of wrap(b, 52, 2)) { if (y > 305) break; g.fillText(l, 22, y); y += 24; } }
        conf.whiteboard.tex.needsUpdate = true;
      }
    }
  }

  function onEvent(ev) {
    if (!rooms.size) return;
    const a = avatars.get(ev.actorId), b = avatars.get(ev.targetId);
    const col = (x) => new THREE.Color(x?.desk.room.div?.color || '#d8c3a5');
    switch (ev.type) {
      case 'delegated': case 'handoff': case 'task_created':
        if (a && b) { packet(a.g.position, b.desk.seat, col(a), () => { burst(b.desk.seat, col(a)); emote(b, '📥', 2200); feel(b, 'surprised', 900); setTimeout(() => feel(b, 'focus', 3000), 900); }); if (ev.type !== 'task_created') { gesture(a, 'point', 1600); emote(a, '📨', 2000); if (Math.random() < 0.55) visit(a, b); } }
        break;
      case 'message': if (a) { const txt = String(ev.text).split(': ').slice(1).join(': ') || ev.text; say(a, txt, 6000, true); a.talkUntil = performance.now() + Math.min(9000, 1800 + txt.length * 45);
        if (/haha|wkwk|😂|🎉|mantap|selamat|keren/i.test(txt)) { feel(a, 'laugh', 2500); gesture(a, 'laugh', 1800); } else if (/maaf|gagal|sayang|kendala|masalah/i.test(txt)) feel(a, 'sad', 3000); else if (/\?/.test(txt)) gesture(a, 'shrug', 1500); else if (Math.random() < 0.4) gesture(a, 'present', 2500); if (b) { packet(a.g.position, b.g.position, 0x9ecbff); a.lookAt = b.g.position; setTimeout(() => { if (a.lookAt === b.g.position) a.lookAt = null; }, 4000); if (Math.random() < 0.3) visit(a, b); } } break;
      case 'reasoning': if (a) { say(a, '💭 ' + ev.text, 7000, true); a.talkUntil = performance.now() + 6500; gesture(a, 'think', 4200); feel(a, 'focus', 5000); emote(a, '💭', 2600); } break;
      case 'meeting_say': if (a) {
        say(a, ev.text, 9000, true); a.talkUntil = performance.now() + 6000; gesture(a, 'present', 4000);
        for (const o of avatars.values()) if (o !== a && o.mode === 'meeting' && Math.random() < 0.35) gesture(o, 'observe', 4000);
        if (/setuju|sepakat|bagus|tepat|agree/i.test(ev.text)) for (const o of avatars.values()) if (o !== a && o.mode === 'meeting' && Math.random() < 0.5) gesture(o, 'nod', 2500);
        if (/\?|bagaimana|apakah|kenapa/i.test(ev.text)) gesture(a, 'shrug', 1800); else if (/risiko|masalah|hati-hati|kendala/i.test(ev.text)) gesture(a, 'think', 2600);
        for (const o of avatars.values()) if (o !== a && o.mode === 'meeting') o.lookAt = a.g.position;
      } break;
      case 'meeting_done': for (const o of avatars.values()) if (o.mode === 'meeting') { o.lookAt = null; gesture(o, 'clap', 2000); emote(o, '👏', 2200); } break;
      case 'meeting': if (a) emote(a, '🗓️', 2600); break;
      case 'hired': if (a) { a.waveUntil = performance.now() + 2500; emote(a, '🤝', 2600); feel(a, 'smile', 3000); } if (b) { b.waveUntil = performance.now() + 3000; emote(b, '👋', 3000); feel(b, 'love', 2500); } break;
      case 'alert': if (a) { gesture(a, 'facepalm', 2400); feel(a, 'sad', 4000); emote(a, '😵', 2800); setTimeout(() => gesture(a, 'sad', 2500), 2400); } break;
      case 'learned': if (a) { gesture(a, 'think', 2600); emote(a, '💡', 3000); feel(a, 'surprised', 700); setTimeout(() => feel(a, 'smile', 2500), 700); say(a, '💡 ' + (String(ev.text).split('belajar: ')[1] || String(ev.text).split(': ').slice(1).join(': ') || ''), 5000, true); if (brainCore) packet(a.g.position, brainCore.group.position, 0x8fd3ff, () => { brainCore.pulse = 0.6; }); } break;
      case 'scheduled': if (a) { say(a, '⏰ Jadwal dibuat', 3000); emote(a, '⏰'); } break;
      case 'note_written': if (a) emote(a, /merapikan|rapikan/.test(ev.text) ? '🗂️' : '📝', 2200);
        if (a && brainCore) packet(a.g.position, brainCore.group.position, 0xffb36b, () => { brainCore.pulse = 1; }); break;
      case 'task_done': if (a) { burst(a.g.position, 0x3ddc84); say(a, '✓ Selesai', 2500); feel(a, Math.random() < 0.5 ? 'laugh' : 'smile', 3000); emote(a, ['🎉', '✅', '😄', '💪'][(Math.random() * 4) | 0], 2800); if (a.pose !== 'sit') { a.jump = 1; gesture(a, 'cheer', 1800); } else gesture(a, 'stretch', 1600); } break;
      case 'approval_requested': if (a) { say(a, '⏸ Menunggu persetujuan', 5000); emote(a, '✋', 3000); const o = avatars.get('owner'); if (o) packet(a.g.position, o.g.position, 0xffb020); } break;
      case 'approved': if (b) { burst(b.g.position, 0xf5c76b); say(b, 'Disetujui', 2500); emote(b, '🥳', 3000); gesture(b, 'cheer', 2000); feel(b, 'laugh', 2600); if (b.pose !== 'sit') b.jump = 1; } break;
      case 'rejected': if (b) { say(b, 'Revisi diminta', 2500); emote(b, '😅', 2600); gesture(b, 'sad', 2400); feel(b, 'sad', 4000); } break;
    }
  }

  // ───── camera
  let camAnim = null, lastPreset = 'iso', fitted = false;
  const animateTo = (pos, target) => { camAnim = { from: camera.position.clone(), to: pos, tf: controls.target.clone(), tt: target, t: 0 }; };
  // Fit by projecting the building's corners: binary-search the distance along the preset view direction.
  function fitCamera(instant, preset = lastPreset) {
    lastPreset = preset;
    const w = container.clientWidth, h = container.clientHeight;
    const aspect = w / Math.max(1, h);
    const portrait = aspect < 0.9;
    const c = bounds.getCenter(new THREE.Vector3()).setY(0);
    const size = bounds.getSize(new THREE.Vector3());
    const longX = size.x >= size.z;
    let dir;
    if (preset === 'top') dir = new THREE.Vector3(0.0001, 1, 0.0001);
    else if (portrait === longX) dir = new THREE.Vector3(0.55, 1.15, 0.001); // look along the long axis sideways
    else dir = new THREE.Vector3(0, 1.15, 0.62);
    dir.normalize();
    const up = preset === 'top' && portrait === longX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const cam = camera.clone(); cam.aspect = aspect; cam.up.copy(up); cam.updateProjectionMatrix();
    const corners = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [0, 2.5]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const margin = w < 700 ? 0.96 : 0.9;
    const fits = (d) => { cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c); cam.updateMatrixWorld(); return corners.every((p) => { const q = p.clone().project(cam); return Math.abs(q.x) <= margin && Math.abs(q.y) <= margin && q.z < 1; }); };
    let lo = 5, hi = 400;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    const pos = c.clone().addScaledVector(dir, hi);
    camera.up.copy(up);
    if (instant) { camera.position.copy(pos); controls.target.copy(c); } else animateTo(pos, c);
    controls.update();
  }
  function focus(id) {
    const a = avatars.get(id); if (!a) return;
    selectedId = id; highlight();
    const t = a.g.position.clone();
    const fwd = new THREE.Vector3(Math.sin(a.g.rotation.y), 0, Math.cos(a.g.rotation.y));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    animateTo(t.clone().addScaledVector(fwd, -5.8).addScaledVector(side, 3.6).add(new THREE.Vector3(0, 5, 0)), t.clone().addScaledVector(fwd, 0.6).setY(1.1));
  }
  function highlight() { for (const a of avatars.values()) { const s = a.id === selectedId ? 1.45 : 1; a.ring.scale.setScalar(s); a.pad.scale.setScalar(s); } }

  // ───── follow-cam: click an agent → the camera rides behind them (orbitable), like controlling your own character
  let chaseId = null, lastDrag = 0;
  function startChase(id) {
    const a = avatars.get(id); if (!a || player) return;
    chaseId = id; selectedId = id; follow = false; highlight();
    const fwd = new THREE.Vector3(Math.sin(a.g.rotation.y), 0, Math.cos(a.g.rotation.y));
    const t = a.g.position.clone().setY(1.45);
    animateTo(t.clone().addScaledVector(fwd, -4.2).add(new THREE.Vector3(0, 1.6, 0)), t);
    onFollow?.(id);
  }
  function stopChase() { if (!chaseId) return; chaseId = null; selectedId = null; highlight(); onFollow?.(null); }
  function updateChase(dt) {
    const a = avatars.get(chaseId); if (!a) return stopChase();
    const t = a.g.position.clone().setY(a.pose === 'sit' ? 1.15 : 1.45);
    const d = t.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 6)); controls.target.add(d); camera.position.add(d);
    // swing gently behind the agent while they walk (unless the user is orbiting)
    const walking = a.path.length > 0;
    if (walking && performance.now() - lastDrag > 1500) {
      const off = camera.position.clone().sub(controls.target); const r = Math.hypot(off.x, off.z);
      const want = a.g.rotation.y + Math.PI; let cur = Math.atan2(off.x, off.z); let dd = want - cur; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      cur += dd * Math.min(1, dt * 1.6); camera.position.set(controls.target.x + Math.sin(cur) * r, camera.position.y, controls.target.z + Math.cos(cur) * r);
    }
  }

  // ───── summon (Sims-style): pressing E near/at an agent makes them walk over, face you, observe and chat expressively
  function summon(id) {
    const a = avatars.get(id); const me = player?.a; if (!a || !me || a === me) return;
    release(a); a.mode = 'talk'; a.pose = 'walk'; a.until = 0;
    const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    let p = me.g.position.clone().addScaledVector(fwd, 1.35);
    if (collides(p.x, p.z)) p = me.g.position.clone().addScaledVector(me.g.position.clone().sub(a.g.position).setY(0).normalize(), -1.2);
    const arrive = () => { a.pose = 'stand'; a.faceTo = Math.atan2(me.g.position.x - a.g.position.x, me.g.position.z - a.g.position.z); a.lookAt = me.g.position; a.waveUntil = performance.now() + 1800; feel(a, 'smile', 3500); setTimeout(() => gesture(a, 'observe', 4000), 1800); };
    const dist = a.g.position.distanceTo(p);
    if (dist < 0.6) arrive(); else if (dist < 6) { a.path = [p]; a.onArrive = arrive; } else routeTo(a, p, arrive);
    me.lookAt = a.g.position;
    emote(a, '👋', 2200);
  }
  function endTalk(id) { const a = avatars.get(id); if (!a || a.mode !== 'talk') return; a.lookAt = null; a.waveUntil = performance.now() + 1500; feel(a, 'smile', 2000); setTimeout(() => goDesk(a), 1500); if (player) player.a.lookAt = null; }
  function listen(id) { const a = avatars.get(id); if (!a) return; gesture(a, Math.random() < 0.5 ? 'nod' : 'think', 2200); feel(a, 'focus', 2200); }

  // ───── Enscape-style navigation without entering Play: WASD fly, E/Q up/down, Shift fast, Alt faster,
  // numpad standard views, U/I time of day, Shift+U/I solar angle, B bookmark view, PageUp/PageDown cycle, H help
  const fly = new Set();
  let tod = 17.5, solarAz = 0.6, favIdx = -1;
  const favs = (() => { try { return JSON.parse(localStorage.getItem('rayFavViews') || '[]'); } catch { return []; } })();
  const saveFavs = () => { try { localStorage.setItem('rayFavViews', JSON.stringify(favs.slice(-9))); } catch { /* ignore */ } };
  function updateFly(dt) {
    if (!fly.size) return;
    const off = camera.position.clone().sub(controls.target);
    const dist = off.length();
    const fwd = off.clone().setY(0).normalize().negate(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const v = new THREE.Vector3();
    if (fly.has('KeyW') || fly.has('ArrowUp')) v.add(fwd); if (fly.has('KeyS') || fly.has('ArrowDown')) v.sub(fwd);
    if (fly.has('KeyD') || fly.has('ArrowRight')) v.add(right); if (fly.has('KeyA') || fly.has('ArrowLeft')) v.sub(right);
    if (fly.has('KeyE')) v.y += 1; if (fly.has('KeyQ')) v.y -= 1;
    if (!v.lengthSq()) return;
    const speed = Math.max(4, dist * 0.7) * (fly.has('AltLeft') || fly.has('AltRight') ? 6 : fly.has('ShiftLeft') || fly.has('ShiftRight') ? 2.6 : 1);
    v.normalize().multiplyScalar(speed * dt);
    if (controls.target.y + v.y < 0) v.y = -controls.target.y;
    controls.target.add(v); camera.position.add(v);
    if (camera.position.y < 0.6) camera.position.y = 0.6;
  }
  function standardView(k) {
    const t = controls.target.clone(); const off = camera.position.clone().sub(t); const r = off.length();
    if (k === 8) animateTo(t.clone().add(new THREE.Vector3(0.01, r, 0.01)), t);
    else if (k === 5) fitCamera(false, 'iso');
    else if (k === 2) animateTo(t.clone().add(new THREE.Vector3(0, 1.7, Math.max(10, r * 0.6))).setY(1.7), t.clone().setY(1.5));
    else if (k === 4 || k === 6) { const a = Math.atan2(off.x, off.z) + (k === 4 ? -Math.PI / 2 : Math.PI / 2); const h = Math.hypot(off.x, off.z); animateTo(new THREE.Vector3(t.x + Math.sin(a) * h, camera.position.y, t.z + Math.cos(a) * h), t); }
    else if (k === 0) { stopChase(); fitCamera(false, 'iso'); }
  }
  function teleport(e) {
    const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
    stopChase(); const off = camera.position.clone().sub(controls.target).multiplyScalar(0.7); animateTo(hit.clone().add(off), hit);
  }
  // time of day drives the sun path, sky, fog, window lights and exposure
  function applySun() {
    const light = document.documentElement.dataset.theme === 'light';
    const e = Math.sin(((tod - 6) / 12) * Math.PI); // -1 night … 1 noon
    const elev = Math.max(-0.15, e) * 1.25; // radians-ish
    const R = 120, cx = bounds.getCenter(new THREE.Vector3()).x;
    sun.position.set(cx + Math.cos(solarAz) * Math.cos(elev) * R, Math.max(6, Math.sin(Math.max(0.05, elev)) * R), Math.sin(solarAz) * Math.cos(elev) * R);
    sun.target.position.set(cx, 0, 0);
    const day = THREE.MathUtils.clamp(e, 0, 1), dusk = 1 - THREE.MathUtils.smoothstep(e, -0.05, 0.45), night = 1 - THREE.MathUtils.smoothstep(e, -0.25, 0.08);
    const warm = new THREE.Color(0xffa866), white = new THREE.Color(light ? 0xfff3e2 : 0xffe7cc);
    sun.color.copy(warm).lerp(white, THREE.MathUtils.smoothstep(e, 0.05, 0.6));
    sun.intensity = 0.15 + day * (light ? 2.2 : 2.0) + (1 - night) * 0.3;
    hemi.intensity = 0.25 + day * 0.75 + (light ? 0.25 : 0);
    const C = (h) => new THREE.Color(h);
    const top = C(0x0c1222).lerp(C(0x2c3756), 1 - night).lerp(C(light ? 0x7fa2cc : 0x5878a6), day);
    const hor = C(0x1d1f2a).lerp(C(0xc08a64), 1 - night).lerp(C(light ? 0xd9d6cf : 0xcfc6b8), THREE.MathUtils.smoothstep(e, 0.25, 0.8));
    sky.material.uniforms.top.value.copy(top); sky.material.uniforms.horizon.value.copy(hor);
    sky.material.uniforms.glow.value.copy(C(0x6a3a18).multiplyScalar(dusk * (1 - night * 0.7)));
    sky.material.uniforms.sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    if (scene.fog) scene.fog.color.copy(hor);
    renderer.toneMappingExposure = 0.85 + day * 0.15 + night * 0.12;
    env?.setDusk(Math.max(dusk, night));
    for (const r of rooms.values()) if (r.ceilLights) r.ceilLights.forEach((l) => (l.intensity = 0.4 + night * 0.8));
  }
  const fmtTod = () => `${String(Math.floor(tod)).padStart(2, '0')}:${String(Math.round((tod % 1) * 60)).padStart(2, '0')}`;

  // ───── input
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let down = null;
  const pick = (e) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(pickables, false)[0]; };
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; follow = false; camAnim = null; lastDrag = performance.now(); });
  renderer.domElement.addEventListener('pointermove', () => { if (down) lastDrag = performance.now(); });
  renderer.domElement.addEventListener('dblclick', (e) => { if (!player && !pick(e)) teleport(e); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null;
    if (player && e.pointerType === 'touch') return;
    const hit = pick(e);
    if (hit?.object.userData.agent) { const id = hit.object.userData.agent; if (player) { selectedId = id; highlight(); onSelect?.(id); } else { startChase(id); onSelect?.(id); } }
    else if (hit?.object.userData.brain) onZone?.('brain');
    else if (hit?.object.userData.room) { const r = rooms.get(hit.object.userData.room); onZone?.(r.div ? r.div.id : r.id); }
  });
  renderer.domElement.addEventListener('pointermove', (e) => { if (isMobile) return; const h = pick(e); renderer.domElement.style.cursor = h?.object.userData.agent || h?.object.userData.brain ? 'pointer' : 'grab'; });
  const ro = new ResizeObserver(resize); ro.observe(container);
  function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); if (!fitted && rooms.size) { fitted = true; fitCamera(true); } }

  // ───── player mode: walk your own character (WASD / arrows / joystick), talk to agents, use objects
  let player = null;
  const keys = new Set();
  const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  const look = { id: null, x: 0, y: 0 };
  let hintKey = '';
  const RADIUS = 0.32;
  function collides(x, z) {
    for (const s of solids) {
      const cx = Math.max(s.x1, Math.min(x, s.x2)), cz = Math.max(s.z1, Math.min(z, s.z2));
      if ((x - cx) ** 2 + (z - cz) ** 2 < RADIUS * RADIUS) return true;
    }
    return false;
  }
  function enterPlayer(id) {
    const a = avatars.get(id); if (!a) return false;
    stopChase(); fly.clear();
    release(a); a.path = []; a.player = true; a.mode = 'player'; a.pose = 'stand';
    // step away from the desk until the character stands free
    const away = new THREE.Vector3(-Math.sin(a.desk.facing), 0, -Math.cos(a.desk.facing));
    for (let d = 0; d < 3 && collides(a.g.position.x, a.g.position.z); d += 0.15) a.g.position.copy(a.desk.seat).addScaledVector(away, d);
    for (const r of rooms.values()) if (r.sign) r.sign.visible = false;
    player = { a, yaw: a.g.rotation.y, pitch: 0.42, dist: 5.2 };
    if (a.label) a.label.visible = false;
    controls.enabled = false; follow = false; selectedId = null; highlight(); camAnim = null;
    renderer.domElement.focus?.();
    return true;
  }
  function exitPlayer() {
    if (!player) return;
    const a = player.a; player = null; keys.clear(); a.moving = false; a.player = false;
    if (a.label) a.label.visible = showLabels;
    controls.enabled = true; goDesk(a); fitCamera(false, 'iso'); onPlayerHint?.(null);
    for (const r of rooms.values()) if (r.sign) r.sign.visible = true;
  }
  const typingInField = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName) || e.target?.isContentEditable;
  const onOfficePage = () => visible && container.isConnected && container.offsetParent !== null && document.getElementById('modal')?.hidden !== false;
  addEventListener('keydown', (e) => {
    if (typingInField(e) || !onOfficePage()) return;
    if (!player) {
      // free navigation (no Play mode needed)
      const nav = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'];
      if (nav.includes(e.code) && !e.ctrlKey && !e.metaKey) { if (!/Shift|Alt/.test(e.code)) stopChase(); fly.add(e.code); e.preventDefault(); return; }
      const num = { Numpad8: 8, Numpad5: 5, Numpad4: 4, Numpad6: 6, Numpad2: 2, Numpad0: 0, Digit8: 8, Digit5: 5, Digit4: 4, Digit6: 6, Digit2: 2, Digit0: 0 }[e.code];
      if (num != null && !e.ctrlKey) { standardView(num); e.preventDefault(); return; }
      if (e.code === 'KeyU' || e.code === 'KeyI') { const d = e.code === 'KeyU' ? -1 : 1; if (e.shiftKey) solarAz += d * 0.26; else tod = Math.min(21.5, Math.max(4.5, tod + d * 0.5)); applySun(); onToast?.(e.shiftKey ? `☀️ Sudut matahari ${Math.round(((solarAz * 180) / Math.PI) % 360)}°` : `🕐 Waktu ${fmtTod()}`); return; }
      if (e.code === 'Space') { e.preventDefault(); onRequestPlay?.(); return; }
      if (e.code === 'KeyB') { favs.push({ p: camera.position.toArray(), t: controls.target.toArray() }); saveFavs(); favIdx = favs.length - 1; onToast?.(`⭐ Tampilan favorit #${favs.length} disimpan`); return; }
      if ((e.code === 'PageUp' || e.code === 'PageDown') && favs.length) { e.preventDefault(); favIdx = (favIdx + (e.code === 'PageDown' ? 1 : -1) + favs.length) % favs.length; const f = favs[favIdx]; stopChase(); animateTo(new THREE.Vector3(...f.p), new THREE.Vector3(...f.t)); onToast?.(`⭐ Favorit #${favIdx + 1}`); return; }
      if (e.code === 'Tab' && avatars.size) { e.preventDefault(); const list = [...avatars.values()].filter((x) => x.e.type === 'ai' && (x.e.status === 'working' || x.e.status === 'meeting' || x.mode !== 'desk')); const pool = list.length ? list : [...avatars.values()]; const i = pool.findIndex((x) => x.id === chaseId); const n = pool[(i + (e.shiftKey ? -1 : 1) + pool.length) % pool.length]; startChase(n.id); onSelect?.(n.id); return; }
      if (e.code === 'KeyL') { showLabels = !showLabels; for (const a of avatars.values()) if (a.label) a.label.visible = showLabels; return; }
      if (e.code === 'KeyH' || e.key === '?') { onHelp?.(); return; }
      if (e.code === 'Escape') { stopChase(); onHelp?.(false); }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyR'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
    if (e.code === 'Space') { if (!player.a.jump) player.a.jump = 1; e.preventDefault(); }
    if (e.code === 'KeyG') player.a.waveUntil = performance.now() + 1600;
    if (e.code === 'KeyE' && currentHint) onPlayerAction?.(currentHint, 'talk');
    if (e.code === 'KeyF' && currentHint?.type === 'agent') onPlayerAction?.(currentHint, 'task');
    if (e.code === 'KeyH') onHelp?.();
    if (e.code === 'Escape') exitPlayer();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); fly.delete(e.code); });
  addEventListener('blur', () => { keys.clear(); fly.clear(); });
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (!player) return;
    const r = el.getBoundingClientRect();
    if (e.pointerType === 'touch' && e.clientX - r.left < r.width * 0.45 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; }
    else { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!player) return;
    if (e.pointerId === joy.id) { joy.x = Math.max(-1, Math.min(1, (e.clientX - joy.ox) / 50)); joy.y = Math.max(-1, Math.min(1, (e.clientY - joy.oy) / 50)); }
    if (e.pointerId === look.id) { player.yaw -= (e.clientX - look.x) * 0.006; player.pitch = Math.max(0.12, Math.min(1.2, player.pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; }
  });
  const endPtr = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; } if (e.pointerId === look.id) look.id = null; };
  el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', endPtr);
  el.addEventListener('wheel', (e) => { if (player) { player.dist = Math.max(2.2, Math.min(14, player.dist * Math.exp(e.deltaY * 0.001))); e.preventDefault(); } }, { passive: false });

  let currentHint = null;
  function updatePlayer(dt, now) {
    const a = player.a;
    if (keys.has('KeyQ')) player.yaw += dt * 2.2;
    if (keys.has('KeyR')) player.yaw -= dt * 2.2;
    let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
    let iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
    const len = Math.hypot(ix, iz);
    a.running = keys.has('ShiftLeft') || keys.has('ShiftRight') || len > 1.3;
    a.moving = len > 0.15;
    if (a.moving) {
      ix /= Math.max(1, len); iz /= Math.max(1, len);
      const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
      const mx = fx * iz - fz * ix, mz = fz * iz + fx * ix;
      const sp = (a.running ? 5.2 : 2.8) * dt;
      const nx = a.g.position.x + mx * sp, nz = a.g.position.z + mz * sp;
      const stuck = collides(a.g.position.x, a.g.position.z);
      if (stuck || !collides(nx, nz)) { a.g.position.x = nx; a.g.position.z = nz; }
      else if (!collides(nx, a.g.position.z)) a.g.position.x = nx;
      else if (!collides(a.g.position.x, nz)) a.g.position.z = nz;
      a.faceTo = Math.atan2(mx, mz);
    }
    // third-person camera behind the player
    const target = a.g.position.clone().add(new THREE.Vector3(0, 1.35, 0));
    const back = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)).multiplyScalar(player.dist);
    camera.position.lerp(target.clone().add(back), Math.min(1, dt * 8));
    controls.target.lerp(target, Math.min(1, dt * 10));
    camera.lookAt(controls.target);
    // nearby agents notice you; nearest one or object becomes interactable
    let best = null, bd = 1.9;
    for (const b of avatars.values()) {
      if (b === a) continue;
      const d = b.g.position.distanceTo(a.g.position);
      b.lookAt = d < 4 && b.mode !== 'meeting' ? a.g.position : (b.lookAt === a.g.position ? null : b.lookAt);
      if (d < bd) { bd = d; best = { type: 'agent', id: b.id, label: b.e.name, sub: b.e.title }; }
    }
    if (!best) for (const poi of pois) { const d = Math.hypot(poi.x - a.g.position.x, poi.z - a.g.position.z); if (d < (poi.r || 2)) { best = { type: 'poi', id: poi.id, label: poi.label, sub: poi.sub }; break; } }
    currentHint = best;
    const k = best ? best.type + best.id : '';
    if (k !== hintKey) { hintKey = k; onPlayerHint?.(best); }
  }

  // ───── loop
  let raf = 0, lastT = performance.now();
  const tmp = new THREE.Vector3();
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    trackFps(performance.now()); renderer.info.reset();
    const now = performance.now(); const realDt = Math.min((now - lastT) / 1000, 0.5); const dt = Math.min(realDt, 0.05); lastT = now; // movement uses real time so walking speed survives low FPS
    for (const a of avatars.values()) {
      a.phase += dt;
      if (a.path.length) {
        const tgt = a.path[0]; tmp.subVectors(tgt, a.g.position); tmp.y = 0;
        const d = tmp.length(); const step = 2.6 * realDt;
        if (d <= step) { a.g.position.copy(tgt); a.path.shift(); if (!a.path.length) { const f = a.onArrive; a.onArrive = null; f?.(); } }
        else { tmp.normalize(); a.g.position.addScaledVector(tmp, step); a.faceTo = Math.atan2(tmp.x, tmp.z); }
      }
      const walking = a.path.length > 0 || a.moving;
      animate(a, dt, now);
      if (a.faceTo !== undefined) { let d = a.faceTo - a.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.g.rotation.y += d * Math.min(1, dt * 7); }
      a.ring.material.opacity = a.e.status === 'working' ? 0.55 + Math.sin(a.phase * 5) * 0.4 : 0.9;
      a.statusDot.rotation.y += dt * 2.2; a.statusDot.position.y = (a.topY || 1.85) + 0.24 + Math.sin(a.phase * 2.4) * 0.05;
      if (a.jump > 0) { a.jump = Math.max(0, a.jump - dt * 1.6); a.body.position.y += Math.sin(a.jump * Math.PI * 2) * 0.25 * (a.jump > 0 ? 1 : 0); }
      if (!walking && !a.player) {
        if (a.until && now > a.until) { a.until = 0; const w = want(a); if (w === 'free' && a.mode !== 'desk' && Math.random() < 0.4) { /* linger elsewhere */ const s = claimSpot(a, ['cafe', 'play', 'lounge'][(Math.random() * 3) | 0], 'leisure'); s ? goSpot(a, s, 'leisure', 12000 + Math.random() * 20000) : goDesk(a); } else if (w === 'free' || a.mode === 'visit' || a.mode === 'leisure') goDesk(a); else applyWant(a); }
        if (want(a) === 'free' && a.mode === 'desk' && a.e.type === 'ai' && now > a.nextIdle) {
          a.nextIdle = now + 20000 + Math.random() * 40000;
          if (Math.random() < 0.35) { gesture(a, ['stretch', 'think', 'nod'][(Math.random() * 3) | 0], 2200); if (Math.random() < 0.4) emote(a, ['☕', '🎧', '🤔', '😌', '✨'][(Math.random() * 5) | 0], 2400); }
          if (Math.random() < 0.6) { const s = claimSpot(a, ['cafe', 'play', 'lounge', 'library'][(Math.random() * 4) | 0], null); if (s && s.tag !== 'meeting') goSpot(a, s, 'leisure', 10000 + Math.random() * 25000); }
        }
      }
      if (a.bubble && now > a.bubbleUntil) { disposeSprite(a.bubble); a.bubble = null; }
      leisureLife(a, now); stationLife(a, now);
    }
    env?.update(realDt, now / 1000);
    sky.position.copy(camera.position);
    // exponential haze tied to camera distance: the ground melts into the sky's horizon colour (no hard edge)
    if (scene.fog) { const dist = camera.position.distanceTo(controls.target); scene.fog.density = 1.9 / (dist * 2.2 + 330); }
    grade.uniforms.uTime.value = (now % 10000) / 1000;
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.ring) { p.t += dt * 1.5; p.ring.scale.setScalar(1 + p.t * 4); p.ring.material.opacity = Math.max(0, 1 - p.t); if (p.t >= 1) { world.remove(p.ring); p.ring.geometry.dispose(); p.ring.material.dispose(); packets.splice(i, 1); } continue; }
      p.t += dt * p.speed;
      if (p.t >= 1) { world.remove(p.m, p.line); p.line.geometry.dispose(); p.m.material.dispose(); p.line.material.dispose(); packets.splice(i, 1); p.onDone?.(); continue; }
      p.m.position.copy(p.curve.getPoint(p.t)); p.line.material.opacity = 0.75 * (1 - p.t * 0.6);
    }
    if (brainCore) {
      brainCore.orb.rotation.y += dt * 0.5; brainCore.orb.rotation.x += dt * 0.2;
      brainCore.pulse = Math.max(0, brainCore.pulse - dt * 0.8);
      brainCore.inner.scale.setScalar(1 + brainCore.pulse * 0.5 + Math.sin(now / 500) * 0.04);
      brainCore.light.intensity = 8 + brainCore.pulse * 30;
    }
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt * 1.6); const k = 1 - Math.pow(1 - camAnim.t, 3);
      camera.position.lerpVectors(camAnim.from, camAnim.to, k); controls.target.lerpVectors(camAnim.tf, camAnim.tt, k);
      if (camAnim.t >= 1) { camAnim = null; if (selectedId) follow = true; }
    } else if (chaseId) updateChase(realDt);
    else if (follow && selectedId) {
      const a = avatars.get(selectedId); if (a) { const d = a.g.position.clone().sub(controls.target); controls.target.add(d); camera.position.add(d); }
    }
    if (!player) updateFly(realDt);
    for (const t of screenTex.values()) t.offset.y = (t.offset.y + dt * 0.04) % 1;
    if (blinkers.length && Math.random() < 0.3) { const l = blinkers[(Math.random() * blinkers.length) | 0]; l.visible = !l.visible; }
    if (player) { updatePlayer(realDt, now); composer.render(); return; }
    controls.update();
    composer.render();
  }
  renderer.info.autoReset = false; // count draw calls across all composer passes of a frame
  applyQuality();
  frame();

  function setTheme(t) {
    const light = t === 'light';
    // light = hazy daylight; dark = cinematic golden-hour dusk with lit windows and street lamps
    const fogHex = light ? 0xd6d4cf : 0xb08a6c;
    scene.background = null;
    sky.material.uniforms.top.value.setHex(light ? 0x7f9fc4 : 0x2a3552); sky.material.uniforms.horizon.value.setHex(fogHex); sky.material.uniforms.glow.value.setHex(light ? 0x332a1c : 0x6a3a18);
    scene.fog = new THREE.FogExp2(fogHex, 0.005);
    M.ground.color.setHex(light ? 0xd8d0c4 : 0x15120f);
    hemi.intensity = light ? 1.05 : 0.8;
    hemi.color.setHex(light ? 0xeef3fb : 0xc9cfe0); hemi.groundColor.setHex(light ? 0x6b5f50 : 0x2e2620);
    sun.intensity = light ? 2.0 : 2.1; sun.color.setHex(light ? 0xfff0dc : 0xffbf86);
    renderer.toneMappingExposure = light ? 0.98 : 1.0;
    grade.uniforms.uWarm.value = light ? 0.25 : 0.7; grade.uniforms.uVig.value = light ? 0.22 : 0.38;
    env?.setDusk(light ? 0 : 1);
    tod = light ? 11 : 17.4; applySun();
  }
  setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  const stats = () => {
    const here = {}; for (const a of avatars.values()) { const r = roomAt(a.g.position); const k = r ? r.id : 'corridor'; here[k] = (here[k] || 0) + 1; }
    return { rooms: [...rooms.values()].map((r) => ({ id: r.id, name: r.div ? r.div.name : r.name, kind: r.kind, here: here[r.id] || 0 })), corridor: here.corridor || 0 };
  };

  return {
    sync, onEvent, focus, setTheme, stats,
    summon, endTalk, listen, startChase, stopChase, following: () => chaseId,
    timeOfDay: (h) => { if (h != null) { tod = h; applySun(); } return fmtTod(); },
    rebuildAvatar: (e) => rebuildAvatar(e),
    express: (id, ch, g) => { const a = avatars.get(id); if (!a) return; if (ch) emote(a, ch, 2600); if (g === "wave") a.waveUntil = performance.now() + 2200; else if (g) gesture(a, g, 2200); const pl = [...avatars.values()].find((x) => x.player); if (pl) { a.lookAt = pl.g.position; setTimeout(() => { if (a.lookAt === pl.g.position) a.lookAt = null; }, 6000); } },
    enterPlayer, exitPlayer, isPlayer: () => !!player, wave: () => { if (player) player.a.waveUntil = performance.now() + 1600; },
    joystickActive: () => joy.id !== null,
    perf: () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, quality, fps: fpsAvg }),
    inspect: (id) => { const a = avatars.get(id); return a && { mode: a.mode, pose: a.pose, path: a.path.length, pos: a.g.position.toArray().map((v) => +v.toFixed(1)), status: a.e.status, spot: a.spot?.key || null }; },
    resetView: () => { selectedId = null; follow = false; highlight(); fitCamera(false, 'iso'); },
    topView: () => { selectedId = null; follow = false; fitCamera(false, 'top'); },
    zoom: (f) => { const d = camera.position.clone().sub(controls.target).multiplyScalar(f); animateTo(controls.target.clone().add(d), controls.target.clone()); },
    toggleLabels: () => { showLabels = !showLabels; for (const a of avatars.values()) if (a.label) a.label.visible = showLabels; return showLabels; },
    focusZone: (id) => { const r = rooms.get(id) || [...rooms.values()].find((x) => x.kind === id); if (!r) return; const t = new THREE.Vector3(r.cx, 0, r.cz); animateTo(t.clone().add(new THREE.Vector3(0, 12, 8)), t); },
    setVisible: (v) => { visible = v; if (v) { lastT = performance.now(); resize(); } },
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); composer.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
