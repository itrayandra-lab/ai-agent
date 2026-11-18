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
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { buildLife } from './life.js';
import { sfx } from './sfx.js';
import { makeProps } from './props.js';
import { chat } from './chatter.js';
import { buildSpace, GradeShader } from './environment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeFurniture } from './furniture.js';
import { makePerson, faceTexture } from './people.js';
import { humanReady, buildFbxRig, FURNITURE_SCALE as FS, GAIT } from './assets3d.js';

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

export function createOffice(container, { onSelect, onAgentPie, onApp, onLower, onHolo, onZone, onPlayerHint, onPlayerAction, onFollow, onRequestPlay, onHelp, onToast, onMenu, onTime, onKeys, onTeleport, onTeleportMenu } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // refreshed from frame() a few times a second
  const crowdCap = () => (gfx === 'eco' ? Math.min(V.crowd ?? 14, 6) : (V.crowd ?? 14));
  let crowdNow = 0;   /* idle agents currently away from their desk (leisure/visit), counted each frame; capped by V.crowd */
  let uiBlock = false, winDim = false, shadowT = 0, lastInput = performance.now(), lastDraw = 0, frameNo = 0, agentSeq = 0, lifeAcc = 0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.92;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 620);
  const controls = new OrbitControls(camera, renderer.domElement);
  // Sims-like camera: drag moves you over the ground, right-drag turns, the wheel zooms towards the cursor
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, maxPolarAngle: Math.PI * 0.97, minPolarAngle: 0.05, minDistance: 2.2, maxDistance: 200, screenSpacePanning: true, zoomToCursor: true, zoomSpeed: 1.15, rotateSpeed: 0.7, panSpeed: 1.1 });
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  /** Keeps the camera inside the world: the focus stays near the ground and inside the campus, the eye never dips under the floor. */
  let camBound = 120;
  function clampCamera() {
    // In Play the camera follows the character up stairs and onto sky decks (higher than the free-camera ceiling below): clamping dragged it back down every frame (camera "stuck below")
    if (typeof player !== 'undefined' && player) { if (camera.position.y < 0.12) camera.position.y = 0.12; return; }
    const t = controls.target, b = camBound;
    const dx = Math.max(-b, Math.min(b, t.x)) - t.x, dz = Math.max(-b, Math.min(b, t.z)) - t.z, dy = Math.max(0, Math.min(2.5 + (floors.length - 1) * FH, t.y)) - t.y;
    if (dx || dy || dz) { t.x += dx; t.y += dy; t.z += dz; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz; }
    if (camera.position.y < 0.12) camera.position.y = 0.12;
  }

  // Image-based lighting gives PBR materials realistic reflections at almost no cost.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.2;
  const composer = new EffectComposer(renderer);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) rt.depthTexture = new THREE.DepthTexture(1, 1);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.35);
  composer.addPass(bloom);
  // Adaptive quality: 2 = bloom + shadows, 1 = shadows only, 0 = flat & low resolution. Drops automatically on slow devices.
  // There is one graphics mode: it starts light (shadows, no bloom) and steps down by itself on slow devices.
  try { localStorage.removeItem('officeLite'); localStorage.removeItem('officeVisualRestore'); } catch { /* storage unavailable */ }
  let quality = 1, fpsAvg = 60, slowSecs = 0, fpsFrames = 0, fpsT = performance.now(), resScale = 1, fastSecs = 0;
  // below quality 2 the scene is drawn straight to the screen (two full-screen passes and two big buffers less); a CSS vignette replaces the grade
  let gfx = 'auto'; try { gfx = localStorage.getItem('office-gfx') || 'auto'; } catch { /* default */ }
  /** Most users are on modest laptops (integrated Intel/AMD graphics, 4 cores or fewer, 4 GB or less). The scene is limited by the NUMBER OF OBJECTS the CPU/driver must submit (~19 us each,
   *  measured: hiding half of the meshes cut the frame by 28%, while 4x fewer pixels changed nothing), so such devices start in "eco": batched geometry, no post chain, no shadows, fewer wanderers. */
  function weakDevice() {
    try {
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'), rn = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software|basic render|mali|adreno|powervr|videocore/i.test(rn)) return true;
      if (/intel/i.test(rn) && !/arc|iris xe|iris pro/i.test(rn)) return true;
      if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
    } catch { /* unknown: stay on auto */ }
    return false;
  }
  { let stored = null; try { stored = localStorage.getItem('office-gfx'); } catch { /* none */ } if (!stored && weakDevice()) { gfx = 'eco'; console.info('[office3d] perangkat sederhana terdeteksi: mode Ringan'); } }
  if (gfx === 'eco') { quality = 0; resScale = 0.8; } else if (gfx === 'high') quality = 2;
  let lagSecs = 0;
  const dofSz = new THREE.Vector2();
  const LOOKS = { natural: { warm: 0.6, teal: 0, con: 0.25, sat: 0.97, ca: 0, glow: 0 }, cinema: { warm: 1, teal: 0.8, con: 0.4, sat: 0.93, ca: 0.7, glow: 0.22 }, soft: { warm: 1.2, teal: 0.3, con: 0.12, sat: 0.88, ca: 0.2, glow: 0.4 }, cool: { warm: 0.35, teal: 1.1, con: 0.3, sat: 1.02, ca: 0.3, glow: 0.1 } };
  let lookName = 'soft', lookNow = LOOKS.soft, bars = false;
  try { const q = localStorage.getItem('office-look'); if (LOOKS[q]) lookName = q; lookNow = LOOKS[lookName]; bars = localStorage.getItem('office-bars') === '1'; } catch { /* defaults */ }
  const barT = document.createElement('div'), barB = document.createElement('div'); barT.className = 'office-bar t'; barB.className = 'office-bar b'; container.appendChild(barT); container.appendChild(barB);
  let perfLite = false;
  const applyLook = () => {
    const u = grade.uniforms; u.uTeal.value = lookNow.teal; u.uSat.value = lookNow.sat * V.sat; u.uCon.value = lookNow.con; u.uCA.value = Math.min(1.6, lookNow.ca * (V.ca / 0.25)); u.uGlow.value = 0; u.uTaps.value = perfLite ? 8 : 14;
    u.uHi.value = V.hi; u.uSh.value = V.sh; u.uTemp.value = THREE.MathUtils.clamp((6600 - V.temp) / 3400, -1, 1); u.uHazeK.value = Math.min(2, V.fog / 20);
    bloom.strength = 0.04 + 0.6 * V.bloom * V.bloom; bloom.radius = 0.5; bloom.threshold = 1.25; bloom.enabled = quality >= 1 && V.bloom > 0 && !perfLite;
  };
  function applyVisual() {
    dofAmt = V.dof;
    // while playing (or in a cinematic) the lens is driven by the Play camera: writing V.fov here made every slider move snap the view wide and then ease back (zoom in/out)
    let lens = V.fov; try { if (player || intro) lens = camera.fov; } catch { /* not declared yet */ }
    camera.fov = lens; camera.updateProjectionMatrix(); applyLook();
    sky.material.uniforms.uSunB.value = V.sun; sky.material.uniforms.uMoonB.value = V.starsMoon; sky.material.uniforms.uMoonS.value = V.moon;
    env?.setStarB?.(V.starsMoon);
    life?.setDream?.(gfx === 'eco' ? 0 : V.dream * 0.75); life?.setDreamLite?.(perfLite); life?.setFireflies?.(gfx === 'eco' ? 28 : perfLite ? 44 : 84);
    life?.setClouds?.({ density: V.density, variety: V.variety, cirrus: V.cirrus, contrails: Math.min(1, V.contrails), lon: V.lon, lat: V.lat });
    if (typeof applySun === 'function') applySun();
  }
  const applyBars = () => { const w = container.clientWidth, h = container.clientHeight, bh = bars && w && h ? Math.max(0, (h - w / 2.39) / 2) : 0; barT.style.height = barB.style.height = bh + 'px'; };
  // every user-facing visual setting lives here, is saved, and is applied by applyVisual()
  const VDEF = { ver: 4, dof: 0.3, fov: 50, exposure: 0.21, hi: 0.39, sh: -0.49, sat: 1.4, temp: 5400, bloom: 0.67, vig: 0.59, ca: 0.33, fog: 41, density: 1, variety: 0, cirrus: 1, contrails: 2, lon: 0.49, lat: 0, sun: 0.36, starsMoon: 2, moon: 3, dream: 0.6, crowd: 14, tele: 45 };   /* ver 4 = the Owner's own preset (screenshots 4-6) as the default + the foggy-dreams layer */
  const V = { ...VDEF };
  try { let sv = JSON.parse(localStorage.getItem('office-visual') || '{}'); if (sv.ver !== 4) sv = {}; Object.assign(V, sv); const f = parseFloat(localStorage.getItem('office-fov')); if (!localStorage.getItem('office-visual') && f >= 20 && f <= 90) V.fov = f; const d = parseFloat(localStorage.getItem('office-dof')); if (!localStorage.getItem('office-visual') && d >= 0) V.dof = d; } catch { /* defaults */ }
  const saveV = () => { try { localStorage.setItem('office-visual', JSON.stringify(V)); } catch { /* ignore */ } };
  const expK = () => Math.max(0.2, V.exposure * 2);
  let dofFocus = 20, dofAmt = V.dof; try { const q = parseFloat(localStorage.getItem('office-dof')); if (q >= 0) dofAmt = q; const f = parseFloat(localStorage.getItem('office-fov')); if (f >= 20 && f <= 90) { camera.fov = f; camera.updateProjectionMatrix(); } } catch { /* defaults */ }
  const dofT = document.createElement('div'), dofB = document.createElement('div'); dofT.className = 'office-dof t'; dofB.className = 'office-dof b'; container.appendChild(dofT); container.appendChild(dofB);
  const vig = document.createElement('div'); vig.className = 'office-vig'; container.appendChild(vig);
  function applyQuality() {
    vig.style.display = quality >= 1 ? 'none' : 'block'; dofT.style.display = dofB.style.display = 'none';
    bloom.enabled = quality >= 1 && V.bloom > 0;
    sun.castShadow = quality >= 1;
    RES_FLOOR = gfx === 'eco' ? 0.6 : 0.8;
    renderer.setPixelRatio((quality >= 2 ? Math.min(devicePixelRatio, 1.5) : quality === 1 ? Math.min(devicePixelRatio, 1.0) : 0.85) * resScale);
    const w = container.clientWidth, h = container.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); composer.setSize(w, h); try { fxaaRes(); } catch { /* not created yet */ } }
    applyBars(); applyLook();
  }
  let RES_FLOOR = gfx === 'eco' ? 0.6 : 0.8;   /* below ~0.8 the picture turns visibly blocky (it used to fall to 0.55 = stair-stepped edges) */
  function trackFps(now) {
    fpsFrames++;
    if (now - fpsT < 1000) return;
    const fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now;
    fpsAvg = fpsAvg * 0.6 + fps * 0.4;
    if (gfx === 'auto' && fpsAvg < 30 && (player || performance.now() - lastInput < 4000)) {
      if (++lagSecs >= 8) { lagSecs = 0; gfx = 'eco'; try { localStorage.setItem('office-gfx', 'eco'); } catch { /* ignore */ } quality = 0; resScale = 0.8; applyQuality(); console.info('[office3d] lambat: beralih ke mode Ringan'); layoutKey = ''; if (data) sync(data); return; }
    } else lagSecs = Math.max(0, lagSecs - 1);
    if (performance.now() - lastInput < 4000 || player) { // only judge speed while the person is actually moving around (idle frames are capped on purpose)
      if (fpsAvg < 42 && resScale > RES_FLOOR) { resScale = Math.max(RES_FLOOR, resScale - 0.1); fastSecs = 0; applyQuality(); }
      else if (fpsAvg > 56 && resScale < 1) { if (++fastSecs >= 3) { resScale = Math.min(1, resScale + 0.05); fastSecs = 0; applyQuality(); } } else fastSecs = 0;
    }
    { const pl = fpsAvg < 46 && (player || performance.now() - lastInput < 4000); if (pl !== perfLite) { perfLite = pl; life?.setDreamLite?.(perfLite); life?.setFireflies?.(gfx === 'eco' ? 28 : perfLite ? 44 : 84); applyLook(); } }   /* effects are dropped first (blur taps, bloom, mist); resolution is the last resort */
    slowSecs = fpsAvg < 26 && resScale <= RES_FLOOR + 0.01 ? slowSecs + 1 : 0;
    if (slowSecs >= 3 && quality > 1 && gfx === 'auto') { quality--; slowSecs = 0; applyQuality(); console.info('[office3d] kualitas grafis diturunkan ke', quality); }
  }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  // the composer's render targets are not multisampled, so edges (especially the characters') were jagged: FXAA runs after tone mapping and before the grade.
  // Pass order matters: the grade samples the scene depth that lives in the buffer RenderPass drew into, so the number of buffer swaps per frame must stay even
  // (Output + FXAA swap, the grade renders to screen and must not swap) and FXAA must not write depth into that buffer.
  const fxaa = new ShaderPass(FXAAShader); fxaa.material.depthTest = false; fxaa.material.depthWrite = false; { const fxRender = fxaa.render.bind(fxaa); fxaa.render = (r, w, rb, dt, m) => { const ad = r.autoClearDepth, ac = r.autoClearColor; r.autoClearDepth = false; r.autoClearColor = false; try { fxRender(r, w, rb, dt, m); } finally { r.autoClearDepth = ad; r.autoClearColor = ac; } }; } composer.addPass(fxaa);
  grade.needsSwap = false; composer.addPass(grade);
  const fxaaRes = () => { const pr = renderer.getPixelRatio(), w = container.clientWidth, h = container.clientHeight; if (w && h) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); };
  let env = null, life = null, terrainH = null, terrainR = 0;   /* rolling lawn hills: height function used by the grass, the player and the camera */
  const hemi = new THREE.HemisphereLight(0xeef0ff, 0xb9b6cf, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.45);
  sun.position.set(-30, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9fb8e8, 0.28);
  fill.position.set(30, 20, -30);
  scene.add(fill);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(560, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.7, 0.35, 0.4).normalize() }, glow: { value: new THREE.Color() }, uNight: { value: 0 }, uSunB: { value: 1 }, uMoonB: { value: 1 }, uMoonS: { value: 1 }, moonDir: { value: new THREE.Vector3(0.3, 0.5, -0.8).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform vec3 moonDir; uniform float uNight; uniform float uSunB; uniform float uMoonB; uniform float uMoonS; varying vec3 vDir;',
      'float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y), mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }',
      'void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0); vec3 c = mix(horizon, top, pow(smoothstep(0.015, 0.4, h), 1.3));',
      '  float s = pow(max(dot(d, sunDir), 0.0), 6.0); c += glow * s * (1.0 - h) * uSunB;',
      '  float sd = dot(d, sunDir); float sunUp = smoothstep(-0.02, 0.12, sunDir.y); c += vec3(1.0, 0.95, 0.82) * (smoothstep(0.99935, 0.99975, sd) * 1.4 + pow(max(sd, 0.0), 220.0) * 0.5) * sunUp * uSunB;',
      '  if (uNight > 0.02) {',
      '    float md = dot(d, moonDir); float disc = smoothstep(1.0 - 0.00045 * uMoonS * uMoonS, 1.0 - 0.00025 * uMoonS * uMoonS, md); vec3 mc = vec3(0.86, 0.9, 1.0) * (0.82 + 0.18 * vnoise(d * 28.0));',
      '    c += (mc * disc * 1.3 + vec3(0.45, 0.55, 0.85) * pow(max(md, 0.0), 120.0) * 0.35) * uNight * smoothstep(-0.05, 0.1, moonDir.y) * uMoonB;',
      '    vec3 bn = normalize(vec3(0.35, 0.75, 0.55)); float band = exp(-pow(dot(d, bn) * 3.6, 2.0)); float nz = vnoise(d * 5.0) * 0.6 + vnoise(d * 13.0) * 0.4;',
      '    c += vec3(0.5, 0.46, 0.85) * band * (0.15 + 0.7 * nz * nz) * uNight * 0.55 * smoothstep(0.0, 0.25, d.y);',
      '  }',
      '  gl_FragColor = vec4(c, 1.0); }',
    ].join('\n'),
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  window.__ray3d = { applyWant: (id) => { const q = avatars.get(id); if (q) applyWant(q); }, perf: () => ({ fps: Math.round(fpsAvg), resScale, perfLite, quality, dpr: devicePixelRatio, pixelRatio: renderer.getPixelRatio(), canvas: [renderer.domElement.width, renderer.domElement.height] }), terrainH: (x, z) => (terrainH ? terrainH(x, z) : 0), composer: () => composer, grade: () => grade, bloom: () => bloom, scene, camera, controls, renderer, get rooms() { return rooms; }, get solids() { return solids; }, collides: (x, z) => collides(x, z), play: (id) => enterPlayer(id), walk: (on) => setWalk(on), zoneAt: (p) => zoneAt(p), idle: (ms) => { lastInput = performance.now() - ms; }, surfaceAt: (x, z, y) => surfaceAt(x, z, y), get envWalk() { return envWalk; }, get player() { return player; }, sit: () => { const q = sitAll?.find((x) => !claimed.has(x.key)); return q; }, sendTo: (id, tag) => { const a = avatars.get(id), sp = claimPlaza(a, tag); if (sp) goSpot(a, sp, 'leisure', 60000); return !!sp; }, get plazaSpots() { return plazaSpots; }, step: (n = 1) => { for (let i = 0; i < n; i++) frame(true); } }; // inspection hook for debugging
  const world = new THREE.Group();
  // partition walls: kept as separate meshes so the player view can cut them away when they block the camera (Sims-style)
  const walls = [];
  const wall = (...args) => { const m = add(...args); m.userData.wall = true; m.userData.keep = true; walls.push(m); return m; };
  scene.add(world);
  const avatars = new Map();
  const rooms = new Map(); // id -> room
  const packets = [];
  const pickables = [];
  const claimed = new Map(); // spot key -> agent id
  const solids = []; // axis-aligned obstacles for the player {x1,x2,z1,z2}
  const pois = [];   // interactable objects {id,x,z,label,sub}
  const blinkers = []; // server-rack LEDs
  const pods = []; // round pod walls {x,z,r,nx,nz,cg}: solid except in the entrance opening
  let roomFrame = null; // while a room is being built: its placement, so obstacles land in the shared flat plan
  const frameOf = (px, pz, k) => { const c = [1, 0, -1, 0][k], sn = [0, 1, 0, -1][k]; return { px, pz, k, th: k * Math.PI / 2, swap: k % 2 === 1, pt: (x, z) => [px + x * c + z * sn, pz - x * sn + z * c], inv: (x, z) => { const dx = x - px, dz = z - pz; return [dx * c - dz * sn, dx * sn + dz * c]; } }; };
  const solid = (x, z, w, d) => { if (roomFrame) { [x, z] = roomFrame.pt(x, z); if (roomFrame.swap) [w, d] = [d, w]; } solids.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 }); };
  const inRoom = (r, x, z, m = 0) => { const [lx, lz] = r.T.inv(x, z); return Math.hypot(lx, lz) < 8.6 - m; };
  let layoutKey = '', data = null, selectedId = null, follow = false, showLabels = true, visible = true;
  let bounds = new THREE.Box3(), brainCore = null, lenX = 0, hallX = 0, corridors = [0];
  let screens = {}, appFx = [], appDraws = [], pulseMats = [], fountainFx = null, glowRef = null, flows = [], envWalk = null, grassMeshes = [], grassU = null, podRI = 40, gaps = [], plazaSpots = [], decks = [], plazaSites = [], floaters = [], sitAll = null;
  // ───── storeys. The simulation stays on one flat plan (wings side by side along z); the picture stacks every wing as a floor.
  const FH = WALL_H + 0.9, WD = RD * 2 + CORR, STAIR_L = RD - 2, STAIR_Z = CORR / 2 + 0.3;
  let floors = [], viewFloor = 0, autoFloor = null, onFloor = null;
  const tmpW = new THREE.Vector3();
  const wingOf = (z) => Math.max(0, Math.min(corridors.length - 1, Math.floor((z - corridors[0] + WD / 2) / WD)));
  const TWIST = Math.PI / 2, RAMP_R = 5.2, RAMP_A = 0.12;
  let lastYaw = 0; // extra heading of the last toWorld() result (the arm's turn, plus the bend of the ramp)
  /** turn a point (in an unturned arm's frame) by th around the core */
  const spin = (out, th) => { const dx = out.x - hallX, dz = out.z, c = Math.cos(th), sn = Math.sin(th); out.x = hallX + dx * c + dz * sn; out.z = -dx * sn + dz * c; lastYaw = th; return out; };
  /** flat plan → world. Inside a wing: lift to its floor and turn with its arm. In the hall between two wings: walk the spiral ramp around the core. */
  function toWorld(p, out = new THREE.Vector3()) {
    const n = corridors.length; let k = wingOf(p.z); const u = p.z - corridors[k];
    if (p.x >= -lenX / 2 || Math.abs(u) <= CORR / 2 || (u < 0 && k === 0) || (u > 0 && k === n - 1)) return spin(out.set(p.x, p.y + k * FH, u), k * TWIST);
    let t = ((Math.abs(u) - CORR / 2) / RD) * 0.5; if (u < 0) { t = 1 - t; k -= 1; }
    const h = CORR / 2, a = RAMP_A; let yaw = 0;
    if (t < a) out.set(hallX, p.y + k * FH, h + (RAMP_R - h) * (t / a));
    else if (t > 1 - a) { out.set(hallX - (h + (RAMP_R - h) * ((1 - t) / a)), p.y + (k + 1) * FH, 0); yaw = Math.PI / 2; }
    else { const f = (t - a) / (1 - 2 * a), ph = f * Math.PI / 2; out.set(hallX - RAMP_R * Math.sin(ph), p.y + (k + f) * FH, RAMP_R * Math.cos(ph)); yaw = -Math.PI / 2 - ph; }
    spin(out, k * TWIST); lastYaw += yaw; return out;
  }
  /** world (x, z) on floor k → flat plan, for the free walking camera */
  const toFlat = (x, z, k) => { const th = -k * TWIST, dx = x - hallX, c = Math.cos(th), sn = Math.sin(th); return [hallX + dx * c + z * sn, -dx * sn + z * c + (corridors[k] || 0)]; };
  const collidesW = (x, z) => { const [fx, fz] = toFlat(x, z, viewFloor); return collides(fx, fz); };
  const yawW = (a) => { toWorld(a.g.position, tmpW); return a.g.rotation.y + lastYaw; };
  const wp = (a, out) => toWorld(a.g.position, out);
  const wpY = (a, h) => { const v = toWorld(a.g.position); v.y += h - a.g.position.y; return v; };
  function setFloor(k) { viewFloor = Math.max(0, Math.min(floors.length - 1, k)); floors.forEach((f, i) => (f.visible = i <= viewFloor)); updateRoof(); onFloor?.(viewFloor); }

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
  const screenT = { value: 0 };
  const STRIPS = new Map();
  const ROLE_SCREENS = { eng: ['code', 'term', 'doc'], it: ['term', 'code', 'chart'], data: ['chart', 'sheet', 'code'], mkt: ['chart', 'design', 'doc', 'chat'], sales: ['chat', 'sheet', 'chart'], design: ['design', 'design', 'doc'], cs: ['chat', 'doc'], fin: ['sheet', 'chart', 'doc'], hr: ['doc', 'chat', 'sheet'], ops: ['kanban', 'sheet', 'chart'], legal: ['doc', 'doc'], reg: ['doc', 'sheet'], ecom: ['chart', 'design', 'sheet'], kms: ['doc', 'kanban'], exec: ['chart', 'doc', 'kanban'], bizdev: ['chart', 'doc', 'chat'], retail: ['sheet', 'chart'], mfg: ['chart', 'term'], scm: ['sheet', 'kanban'], rnd: ['chart', 'doc', 'term'], qa: ['term', 'kanban', 'sheet'] };
  ROLE_SCREENS.mkt.push('video', 'dash'); ROLE_SCREENS.design.push('video', 'wave'); ROLE_SCREENS.ecom.push('video', 'dash'); ROLE_SCREENS.sales.push('dash', 'mail'); ROLE_SCREENS.cs.push('mail', 'feed'); ROLE_SCREENS.exec.push('dash', 'cal');
  ROLE_SCREENS.hr.push('cal', 'mail'); ROLE_SCREENS.ops.push('feed'); ROLE_SCREENS.kms.push('feed'); ROLE_SCREENS.fin.push('dash'); ROLE_SCREENS.data.push('dash'); ROLE_SCREENS.legal.push('mail'); ROLE_SCREENS.bizdev.push('mail', 'cal');
  const AMBIENT = ['dash', 'feed', 'mail', 'cal', 'chart', 'kanban'];   /* idle desks are never dark or a blue screensaver: they show dim ambient content */
  function scrStrip(kind) {
    if (STRIPS.has(kind)) return STRIPS.get(kind);
    const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let sd = 1 + kind.length * 97 + kind.charCodeAt(0); const rnd = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    const dark = !['doc', 'sheet', 'design', 'mail', 'cal'].includes(kind); g.fillStyle = dark ? '#0d1220' : '#f4f6fb'; g.fillRect(0, 0, W, H);
    const pick = (a) => a[(rnd() * a.length) | 0];
    if (kind === 'code') { const cols = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#6b7499']; for (let y = 6; y < H - 6; y += 8) { let x = 6 + ((rnd() * 4) | 0) * 7; g.fillStyle = '#3a4160'; g.fillRect(1, y, 3, 5); while (x < W - 14 && rnd() < 0.9) { const w = 6 + rnd() * 26; g.fillStyle = pick(cols); g.fillRect(x, y, w, 5); x += w + 4; } } }
    else if (kind === 'term') { for (let y = 6; y < H - 6; y += 8) { g.fillStyle = rnd() < 0.2 ? '#7ee787' : '#8fa0c8'; g.fillRect(6, y, 4, 5); let x = 14; const n = 1 + ((rnd() * 4) | 0); for (let k = 0; k < n; k++) { const w = 8 + rnd() * 30; g.fillStyle = rnd() < 0.08 ? '#ff7b72' : rnd() < 0.15 ? '#e3b341' : '#c9d1d9'; g.fillRect(x, y, w, 5); x += w + 4; } } }
    else if (kind === 'sheet') { g.strokeStyle = '#d5dae8'; g.lineWidth = 1; for (let y = 0; y < H; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (const x of [0, 26, 58, 90]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 12) { if (y % 96 === 0) { g.fillStyle = '#2f6fe4'; g.fillRect(0, y, W, 12); } for (const x of [3, 29, 61, 93]) { if (rnd() < 0.85) { g.fillStyle = y % 96 === 0 ? '#fff' : rnd() < 0.12 ? '#34a853' : '#3c4257'; g.fillRect(x, y + 4, 8 + rnd() * 16, 4); } } } }
    else if (kind === 'chart') { for (let y0 = 0; y0 < H; y0 += 128) { const t = ((y0 / 128) | 0) % 3; g.fillStyle = '#151c33'; g.fillRect(4, y0 + 4, W - 8, 120); if (t === 0) { for (let i = 0; i < 9; i++) { const h = 18 + rnd() * 78; g.fillStyle = ['#5b8cff', '#34d399', '#f59e0b', '#ec4899'][i % 4]; g.fillRect(12 + i * 12, y0 + 112 - h, 8, h); } } else if (t === 1) { g.strokeStyle = '#34d399'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 10; i++) { const x = 10 + i * 11, y = y0 + 90 - rnd() * 60 - i * 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.fillStyle = '#5b8cff'; g.fillRect(10, y0 + 12, 36, 8); } else { g.strokeStyle = '#5b8cff'; g.lineWidth = 10; g.beginPath(); g.arc(44, y0 + 64, 30, 0, 4.2); g.stroke(); g.strokeStyle = '#f59e0b'; g.beginPath(); g.arc(44, y0 + 64, 30, 4.2, 6.28); g.stroke(); g.fillStyle = '#c9d1d9'; g.fillRect(86, y0 + 40, 30, 8); g.fillRect(86, y0 + 60, 24, 8); g.fillRect(86, y0 + 80, 34, 8); } } }
    else if (kind === 'doc') { for (let y = 8; y < H - 8; ) { if (rnd() < 0.18) { g.fillStyle = '#1f2a55'; g.fillRect(8, y, 40 + rnd() * 40, 7); y += 14; } else { const n = 3 + ((rnd() * 4) | 0); for (let k = 0; k < n; k++) { g.fillStyle = '#8b93ad'; g.fillRect(8, y, 112 - (k === n - 1 ? rnd() * 60 : 0), 4); y += 8; } y += 8; } } }
    else if (kind === 'design') { for (let y0 = 0; y0 < H; y0 += 128) { g.fillStyle = '#e9edf7'; g.fillRect(6, y0 + 6, W - 12, 116); for (let i = 0; i < 5; i++) { g.fillStyle = pick(['#ff6b9a', '#5b8cff', '#34d399', '#f59e0b', '#a78bfa']); if (rnd() < 0.5) { g.beginPath(); g.arc(20 + rnd() * 88, y0 + 24 + rnd() * 80, 8 + rnd() * 16, 0, 7); g.fill(); } else g.fillRect(14 + rnd() * 80, y0 + 16 + rnd() * 70, 14 + rnd() * 30, 10 + rnd() * 26); } g.strokeStyle = '#2f6fe4'; g.lineWidth = 1; g.strokeRect(18 + rnd() * 20, y0 + 18 + rnd() * 20, 50, 40); } }
    else if (kind === 'chat') { for (let y = 8; y < H - 14; y += 20) { const me = rnd() < 0.45, w = 30 + rnd() * 54; g.fillStyle = me ? '#3b6cf0' : '#26304f'; const x = me ? W - w - 8 : 18; g.fillRect(x, y, w, 12); if (!me) { g.fillStyle = pick(['#f59e0b', '#34d399', '#ec4899']); g.beginPath(); g.arc(9, y + 6, 5, 0, 7); g.fill(); } } }
    else if (kind === 'kanban') { for (let y0 = 0; y0 < H; y0 += 128) for (let k = 0; k < 3; k++) { g.fillStyle = '#18203a'; g.fillRect(4 + k * 41, y0 + 4, 38, 120); for (let i = 0; i < 1 + ((rnd() * 3) | 0) + 1; i++) { g.fillStyle = pick(['#5b8cff', '#34d399', '#f59e0b', '#ec4899']); g.fillRect(7 + k * 41, y0 + 10 + i * 30, 32, 24); g.fillStyle = '#c9d1d9'; g.fillRect(10 + k * 41, y0 + 16 + i * 30, 20, 3); } } }
    else if (kind === 'video') { for (let y0 = 0; y0 < H; y0 += 128) { g.fillStyle = '#05070d'; g.fillRect(4, y0 + 4, W - 8, 52); const gr = g.createLinearGradient(4, 0, W - 4, 0); gr.addColorStop(0, pick(['#ff7a59', '#5b8cff', '#34d399', '#f59e0b'])); gr.addColorStop(1, pick(['#a78bfa', '#ff6b9a', '#22d3ee'])); g.fillStyle = gr; g.globalAlpha = 0.75; g.fillRect(10, y0 + 9, W - 20, 42); g.globalAlpha = 1; g.fillStyle = '#e5e9ff'; g.beginPath(); g.moveTo(W / 2 - 5, y0 + 22); g.lineTo(W / 2 + 6, y0 + 30); g.lineTo(W / 2 - 5, y0 + 38); g.fill();
      for (let tr = 0; tr < 3; tr++) { let x = 4 + rnd() * 10; const ty = y0 + 64 + tr * 18; while (x < W - 12) { const w = 14 + rnd() * 34; g.fillStyle = pick(tr === 2 ? ['#34d399', '#22c55e'] : ['#5b8cff', '#a78bfa', '#f59e0b', '#ff6b9a']); g.fillRect(x, ty, Math.min(w, W - 8 - x), 13); x += w + 2 + rnd() * 6; } }
      const px = 20 + rnd() * (W - 40); g.fillStyle = '#ff4d4d'; g.fillRect(px, y0 + 60, 2, 56); } }
    else if (kind === 'wave') { for (let y0 = 0; y0 < H; y0 += 64) { g.fillStyle = '#0a1020'; g.fillRect(4, y0 + 3, W - 8, 58); g.fillStyle = pick(['#22d3ee', '#a78bfa', '#34d399']); for (let x = 8; x < W - 8; x += 3) { const h = 4 + Math.abs(Math.sin(x * 0.07 + y0) + (rnd() - 0.5)) * 20; g.fillRect(x, y0 + 32 - h / 2, 2, h); } } }
    else if (kind === 'dash') { for (let y0 = 0; y0 < H; y0 += 128) { for (let k = 0; k < 3; k++) { g.fillStyle = '#151c33'; g.fillRect(4 + k * 41, y0 + 4, 38, 30); g.fillStyle = pick(['#5b8cff', '#34d399', '#f59e0b', '#ff6b9a']); g.fillRect(8 + k * 41, y0 + 10, 14 + rnd() * 16, 7); g.fillStyle = '#8b93ad'; g.fillRect(8 + k * 41, y0 + 22, 20, 3); }
      g.fillStyle = '#151c33'; g.fillRect(4, y0 + 40, W - 8, 80); g.strokeStyle = pick(['#5b8cff', '#34d399', '#22d3ee']); g.lineWidth = 2; g.beginPath(); let yy = y0 + 90; for (let x = 8; x < W - 8; x += 8) { yy = Math.max(y0 + 50, Math.min(y0 + 112, yy + (rnd() - 0.5) * 22)); if (x === 8) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke(); } }
    else if (kind === 'feed') { for (let y = 6; y < H - 6; y += 22) { g.fillStyle = pick(['#34d399', '#5b8cff', '#f59e0b', '#a78bfa']); g.beginPath(); g.arc(12, y + 8, 4, 0, 7); g.fill(); g.fillStyle = '#d7dcf2'; g.fillRect(24, y + 2, 40 + rnd() * 54, 5); g.fillStyle = '#6b7499'; g.fillRect(24, y + 11, 30 + rnd() * 50, 4); g.fillStyle = '#3a4160'; g.fillRect(W - 22, y + 4, 14, 4); } }
    else if (kind === 'mail') { for (let y = 6; y < H - 6; y += 24) { const sel = rnd() < 0.18; g.fillStyle = sel ? '#e7eeff' : '#f4f6fb'; g.fillRect(2, y, W - 4, 21); g.fillStyle = pick(['#ff6b9a', '#5b8cff', '#34d399', '#f59e0b']); g.beginPath(); g.arc(13, y + 10, 6, 0, 7); g.fill(); g.fillStyle = '#1f2a55'; g.fillRect(26, y + 4, 30 + rnd() * 40, 5); g.fillStyle = '#8b93ad'; g.fillRect(26, y + 12, 50 + rnd() * 40, 4); } }
    else if (kind === 'cal') { for (let y0 = 0; y0 < H; y0 += 128) { g.fillStyle = '#f4f6fb'; g.fillRect(0, y0, W, 128); g.strokeStyle = '#d5dae8'; g.lineWidth = 1; for (let c = 0; c <= 7; c++) { g.beginPath(); g.moveTo(c * 18, y0); g.lineTo(c * 18, y0 + 128); g.stroke(); } for (let r = 0; r <= 6; r++) { g.beginPath(); g.moveTo(0, y0 + r * 21); g.lineTo(W, y0 + r * 21); g.stroke(); } for (let i = 0; i < 7; i++) { g.fillStyle = pick(['#5b8cff', '#34d399', '#f59e0b', '#ff6b9a', '#a78bfa']); g.fillRect(((rnd() * 6) | 0) * 18 + 2, y0 + ((rnd() * 5) | 0) * 21 + 3, 15, 8 + rnd() * 10); } } }
    else { for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,150,255,' + (0.1 + rnd() * 0.35).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * W, rnd() * H, 2 + rnd() * 8, 0, 7); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.anisotropy = 2; STRIPS.set(kind, t); return t;
  }
  const screenFor = (hex) => {
    if (screenTex.has(hex)) return screenTex.get(hex);
    const t = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#0c1016'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 9) { const ind = (Math.random() * 4 | 0) * 8; g.fillStyle = Math.random() < 0.25 ? hex : 'rgba(220,230,240,0.55)'; g.fillRect(6 + ind, y, 20 + Math.random() * 70, 4); } }, [1, 0.5]);
    screenTex.set(hex, t); return t;
  };

  // ───── materials & geometry (shared)
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...o });
  const M = {
    ground: std(0x15120f, { roughness: 1 }), slab: std(0xe2e6f2, { roughness: 0.5, metalness: 0.2 }), concrete: std(0xffffff, { roughness: 0.85, map: TEX.concrete }),
    corridor: std(0xffffff, { roughness: 0.7, map: TEX.corridor }), parquet: std(0xffffff, { roughness: 0.55, map: TEX.parquet }), darkwood: std(0x3b2a1e, { roughness: 0.6 }),
    stone: std(0xffffff, { roughness: 0.8, map: TEX.stone }), carpet: std(0xffffff, { roughness: 1, map: TEX.carpet }), playfloor: std(0x3a3f44, { roughness: 0.95 }),
    wall: std(0xeceaf2, { roughness: 0.8 }), glass: new THREE.MeshStandardMaterial({ color: 0xc9d6e2, transparent: true, opacity: 0.24, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    mullion: std(0xc4c8dc, { metalness: 0.6, roughness: 0.4 }), desk: std(0xdfe4f2, { roughness: 0.3, metalness: 0.2 }), deskTop: std(0xf4f6fc, { roughness: 0.22, metalness: 0.15 }),
    whiteTop: std(0xe4e0d8, { roughness: 0.45 }), metal: std(0xc2c9e2, { metalness: 0.85, roughness: 0.25 }), chair: std(0x8188ab, { roughness: 0.6 }),
    leather: std(0xd6b59c, { roughness: 0.55 }), screen: std(0x2f3556, { roughness: 0.3 }), plant: std(0x86c49a, { roughness: 0.9 }), pot: std(0xdcdbe6),
    felt: std(0x7fbf9a, { roughness: 1 }), pingpong: std(0x8fa6dc, { roughness: 0.6 }), sofa: std(0xb9bdd9, { roughness: 0.95 }), rug: std(0xd9d6ea, { roughness: 1 }),
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
  /** gives a flat-coloured material a tiling texture sampled from world XZ (horizontal faces only), so rings and merged floors keep a sane scale */
  function worldTextured(mat, tex, scale = 0.2, strength = 0.85, key = 'wt') {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tWorld = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vUpK;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vUpK = abs(normalize(mat3(modelMatrix) * normal).y);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vUpK; uniform sampler2D tWorld;').replace('#include <color_fragment>', '#include <color_fragment>\n vec3 tw = texture2D(tWorld, vWP.xz * ' + scale.toFixed(4) + ').rgb; diffuseColor.rgb *= mix(vec3(1.0), tw * 1.5, ' + strength.toFixed(3) + ' * smoothstep(0.5, 0.9, vUpK));');
    };
    mat.customProgramCacheKey = () => key + scale + strength; mat.needsUpdate = true; return mat;
  }
  function textSprite(lines, o = {}) {
    const { bg = 'rgba(255,255,255,0.84)', fg = '#1a2140', size = 28, accent = null, scale = 0.0092, border = 'rgba(255,255,255,0.55)' } = o; const M = 9; const pad = o.pad ?? Math.round(size * 0.62), mono = false;
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    const fam = mono ? '"Geist Mono", ui-monospace, Consolas, monospace' : 'Geist, Inter, system-ui, sans-serif';
    const font = (i) => `${o.halo ? 650 : o.glass ? 500 : i === 0 || o.sameColor ? 600 : 450} ${i === 0 || o.sameColor ? size : size * 0.82}px ${fam}`;
    const arr = Array.isArray(lines) ? lines : [lines];
    const widths = arr.map((l, i) => { g.font = font(i); return g.measureText(l).width; });
    const dot = accent ? size * 0.75 : 0;
    const w = Math.ceil(Math.max(...widths) + pad * 2 + dot) + M * 2; const lh = size * 1.3; const h = Math.ceil(lh * arr.length + pad) + M * 2;
    const Q = o.glass ? 3 : 2; c.width = w * Q; c.height = h * Q; g.scale(Q, Q);
    if (o.glass) {
      // frosted glass: a soft gradient veil, a hairline highlight on top, a tiny tail; tint drifts the whole pill toward a colour
      const rad = Math.min((h - M * 2) / 2, size * 0.95), t = o.tint || [255, 255, 255];
      g.save(); g.shadowColor = 'rgba(40,52,120,0.13)'; g.shadowBlur = 12; g.shadowOffsetY = 3;
      const gr = g.createLinearGradient(0, M, 0, h - M); gr.addColorStop(0, 'rgba(' + t + ',' + (o.a0 ?? 0.5) + ')'); gr.addColorStop(1, 'rgba(' + t + ',' + (o.a1 ?? 0.3) + ')');
      g.fillStyle = gr; rr(g, M, M, w - M * 2, h - M * 2, rad); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; rr(g, M + 0.6, M + 0.6, w - M * 2 - 1.2, h - M * 2 - 1.2, rad); g.stroke();
      const hl = g.createLinearGradient(M, 0, w - M, 0); hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.85)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = hl; g.lineWidth = 1.4; g.beginPath(); g.moveTo(M + rad * 0.8, M + 1.2); g.lineTo(w - M - rad * 0.8, M + 1.2); g.stroke();
    } else {
    g.save(); g.shadowColor = 'rgba(40,52,120,0.20)'; g.shadowBlur = 9; g.shadowOffsetY = 2; g.fillStyle = bg; rr(g, M, M, w - M * 2, h - M * 2, Math.min((h - M * 2) / 2, size * 0.8)); g.fill(); g.restore(); g.strokeStyle = border; g.lineWidth = 1.5; rr(g, M, M, w - M * 2, h - M * 2, Math.min((h - M * 2) / 2, size * 0.8)); g.stroke();
    }
    if (accent) { g.fillStyle = accent; g.beginPath(); g.arc(M + pad + size * 0.25, M + pad / 2 + lh / 2, size * 0.22, 0, Math.PI * 2); g.fill(); }
    arr.forEach((l, i) => { g.font = font(i); g.textBaseline = 'middle'; const tx = M + pad + dot, ty = M + pad / 2 + lh * (i + 0.5); if (o.halo) { g.save(); g.lineJoin = 'round'; g.lineWidth = size * 0.2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.strokeText(l, tx, ty); g.restore(); } g.fillStyle = i === 0 || o.sameColor ? fg : (o.sub || 'rgba(27,31,59,0.6)'); g.fillText(l, tx, ty); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: true, alphaTest: o.glass ? 0.14 : 0.08, transparent: true, opacity: 0.97, fog: false }));
    s.scale.set(w * scale, h * scale, 1); s.renderOrder = 10; s.userData.base = [w * scale, h * scale];
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
  const DECOR = makeProps(F);
  const CHAIR_Z = 0.68; // chair position in the desk frame (before the furniture scale)
  /** Place a furniture group in a room and register it as an obstacle (footprint w×d, rotation snapped to 90°). */
  let clampFn = null; // set while a round room is being built
  function place(parent, grp, x, z, ry = 0, w = 0, d = 0) {
    if (clampFn) [x, z] = clampFn(x, z);
    grp.position.set(x, 0, z); grp.rotation.y = ry; parent.add(grp);
    const k = grp.userData.fs || 1; // fitted furniture has a smaller footprint
    if (w && d) { const swap = Math.abs(Math.sin(ry)) > 0.7; solid(x, z, (swap ? d : w) * k, (swap ? w : d) * k); }
    return grp;
  }
  // seats, tables and counters are scaled to the agent body (FS); the building and big equipment stay full size
  const fit = (grp) => { grp.scale.setScalar(FS); grp.userData.fs = FS; return grp; };
  const plant = (x, z, s = 1, parent = world, kind = (Math.random() * 3) | 0) => place(parent, F.plant(s * 0.75, kind), x, z, Math.random() * 6, 0.4 * s, 0.4 * s);
  function ceilingLamp(x, z, w = 2.4, parent = world) { const m = new THREE.Mesh(box(w, 0.03, 0.14), M.lamp); m.position.set(x, WALL_H + 0.05, z); parent.add(m); return m; }
  function wallText(text, w, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d');
    g.font = '700 110px "Geist Mono", ui-monospace, monospace'; g.fillStyle = color; g.textBaseline = 'middle';
    const tw = g.measureText(text).width; const sc = Math.min(1, 980 / tw); g.save(); g.translate(512 - (tw * sc) / 2, 80); g.scale(sc, 1); g.fillText(text, 0, 0); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.156), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  }

  // ───── draw-call reduction: merge static meshes that share a material into one mesh
  // Two plain Standard materials with the same look ARE the same material. The builders make a fresh material per prop, which left ~1,800 one-mesh groups (= ~1,800 draw calls) after merging.
  // Only non-emissive, non-custom Standard materials are folded; anything that glows, pulses, is shared (F.M) or is retinted at runtime keeps its own identity.
  const sharedMats = new Set(Object.values(F.M || {}));
  function matKey(mat) {
    if (!mat || Array.isArray(mat)) return mat ? String(mat[0]?.uuid) : '';
    if (!mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial || sharedMats.has(mat) || mat.userData?.noMerge) return mat.uuid;
    if (mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) return mat.uuid;
    if (mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) return mat.uuid;
    return ['S', mat.color.getHex(), mat.roughness, mat.metalness, mat.opacity, mat.transparent ? 1 : 0, mat.side, mat.depthWrite ? 1 : 0, mat.depthTest ? 1 : 0, mat.alphaTest, mat.map?.uuid, mat.normalMap?.uuid, mat.roughnessMap?.uuid, mat.vertexColors ? 1 : 0, mat.flatShading ? 1 : 0, mat.envMapIntensity, mat.polygonOffset ? 1 : 0, mat.fog ? 1 : 0].join('|');
  }
  let vcMat = null;
  const vcEligible = (mat) => mat && !Array.isArray(mat) && mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial && !sharedMats.has(mat) && !mat.userData?.noMerge && !mat.map && !mat.transparent && mat.opacity === 1
    && mat.side === THREE.FrontSide && !mat.vertexColors && !mat.alphaTest && !(mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) && mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
  const vcBasicEligible = (mat) => mat && !Array.isArray(mat) && !sharedMats.has(mat) && !mat.userData?.noMerge && !mat.map && !mat.transparent && mat.opacity === 1 && mat.side === THREE.FrontSide && !mat.alphaTest && !mat.vertexColors
    && mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && (mat.isMeshBasicMaterial || (mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial && mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0));
  let vcBasic = null;
  const ECO_CELL = 26;
  const ecoDetail = [];   /* eco: merged cells of SMALL props (furniture, plants, trinkets): hidden when the camera is far, where they are invisible anyway but cost most of the triangles */
  const sizeOf = (m) => { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const e = m.matrixRel.elements; return g.boundingSphere.radius * Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])); };
  function mergeInto(parent, meshes, eco = false) {
    const groups = new Map();
    for (const m of meshes) {
      const kind = eco ? (vcEligible(m.material) ? 'VL' : vcBasicEligible(m.material) ? 'VB' : '') : ''; const el = m.matrixRel.elements;
      const cell = kind ? '@' + Math.floor(el[12] / ECO_CELL) + ',' + Math.floor(el[13] / 7) + ',' + Math.floor(el[14] / ECO_CELL) + (sizeOf(m) < 0.8 ? 's' : 'b') : '';
      const k = (kind || matKey(m.material)) + cell + (eco ? '' : (m.castShadow ? 'c' : '')) + (m.receiveShadow ? 'r' : '') + m.renderOrder;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const kind0 = eco ? (vcEligible(list[0].material) ? 'VL' : vcBasicEligible(list[0].material) ? 'VB' : '') : '';
      const isVC = !!kind0 && list.every((m) => (kind0 === 'VL' ? vcEligible(m.material) : vcBasicEligible(m.material)));
      const geos = list.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); g.applyMatrix4(m.matrixRel);
        if (isVC) { const mt = m.material, glow = mt.isMeshStandardMaterial, ei = glow ? Math.min(1.5, mt.emissiveIntensity) : 0, c = mt.color, e2 = glow ? mt.emissive : null, n = g.attributes.position.count, arr = new Float32Array(n * 3), r0 = glow ? Math.min(1, c.r * 0.35 + e2.r * ei) : c.r, g0 = glow ? Math.min(1, c.g * 0.35 + e2.g * ei) : c.g, b0 = glow ? Math.min(1, c.b * 0.35 + e2.b * ei) : c.b; for (let i = 0; i < n; i++) { arr[i * 3] = r0; arr[i * 3 + 1] = g0; arr[i * 3 + 2] = b0; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); }
        return g;
      });
      let merged;
      try { merged = mergeGeometries(geos, false); } catch { merged = null; }
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      if (isVC && kind0 === 'VL' && !vcMat) vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      if (isVC && kind0 === 'VB' && !vcBasic) vcBasic = new THREE.MeshBasicMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(merged, isVC ? (kind0 === 'VL' ? vcMat : vcBasic) : list[0].material);
      mesh.castShadow = eco ? false : list[0].castShadow; mesh.receiveShadow = eco ? false : list[0].receiveShadow;
      if (isVC && sizeOf(list[0]) < 0.8) { merged.computeBoundingSphere(); mesh.userData.ecoR = merged.boundingSphere.radius; mesh.userData.ecoC = merged.boundingSphere.center.clone().applyMatrix4(parent.matrixWorld); ecoDetail.push(mesh); } mesh.renderOrder = list[0].renderOrder;
      parent.add(mesh);
      for (const m of list) m.parent.remove(m);
    }
  }
  const skipMerge = (o) => { if (o.isInstancedMesh) return true; for (let p = o; p && p !== world; p = p.parent) if (p.userData.dynamic || p.userData.keep) return true; return pickables.includes(o) || o.userData.keep; };
  /** Window and wall frames are hundreds of thin boxes: merge them per parent, keeping them hideable for the cutaway. */
  function mergeWalls() {
    world.updateMatrixWorld(true);
    const groups = new Map(); const out = [];
    for (const m of walls) {
      if (m.material !== F.M.frame) { out.push(m); continue; }
      const k = m.parent.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m);
    }
    for (const list of groups.values()) {
      if (list.length < 2) { out.push(...list); continue; }
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), F.M.frame); geos.forEach((g) => g.dispose());
      mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.userData.wall = true; mesh.userData.keep = true;
      list[0].parent.add(mesh); for (const m of list) m.parent.remove(m);
      mesh.geometry.computeBoundingBox(); mesh.updateMatrixWorld(true);
      mesh.userData.center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      out.push(mesh);
    }
    walls.length = 0; walls.push(...out);
  }
  function mergeStatic() {
    ecoDetail.length = 0; world.updateMatrixWorld(true);
    for (const root of [...floors, world]) {
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const meshes = [];
      root.traverse((o) => { if (o.isMesh && !skipMerge(o) && o.geometry.attributes.uv && o.geometry.attributes.normal) { o.matrixRel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); meshes.push(o); } });
      mergeInto(root, meshes, gfx === 'eco');
      if (root !== world) root.userData.keep = true;
    }
  }
  /** Merge the rigid parts of one character group (body or head) – keeps limbs/visor separate so they can animate. */
  function mergeRigid(group) {
    const meshes = group.children.filter((o) => o.isMesh && !o.userData.keep && o.visible && o.geometry.attributes.uv);
    for (const m of meshes) { m.updateMatrix(); m.matrixRel = m.matrix.clone(); }
    mergeInto(group, meshes);
  }

  // ───── things agents carry: one small baked mesh per kind, shared geometry
  const propGeo = new Map();
  const PROP_BY_DIV = { mfg: 'wrench', scm: 'box', ecom: 'camera', design: 'camera', rnd: 'magnifier', qa: 'magnifier', it: 'tablet', finance: 'clipboard', hr: 'clipboard' };
  const PROP_ANY = ['mug', 'tablet', 'book', 'clipboard', 'mug'];
  function propMesh(kind) {
    if (!propGeo.has(kind)) {
      const g = new THREE.Group(); const c = (hex) => std(hex, { roughness: 0.6 });
      if (kind === 'mug') { F.put(g, F.cyl(0.036, 0.03, 0.075, 10), c(0xf4f1ea), 0, 0.04, 0); F.put(g, F.box(0.012, 0.04, 0.03), c(0xf4f1ea), 0.045, 0.04, 0); F.put(g, F.cyl(0.03, 0.03, 0.004, 10), c(0x5a3a22), 0, 0.076, 0); }
      else if (kind === 'tablet') { const t = new THREE.Group(); F.put(t, F.box(0.17, 0.012, 0.12), c(0x2a2d3a), 0, 0, 0); F.put(t, F.box(0.155, 0.002, 0.105), c(0x8fd3ff), 0, 0.007, 0); t.rotation.x = -0.9; t.position.y = 0.06; g.add(t); }
      else if (kind === 'book') { F.put(g, F.box(0.14, 0.03, 0.1), c(0x7a2f4a), 0, 0.03, 0); F.put(g, F.box(0.13, 0.022, 0.092), c(0xf2ead8), 0.003, 0.03, 0); }
      else if (kind === 'clipboard') { const t = new THREE.Group(); F.put(t, F.box(0.14, 0.008, 0.19), c(0x9a6b3f), 0, 0, 0); F.put(t, F.box(0.12, 0.002, 0.16), c(0xffffff), 0, 0.005, 0.005); F.put(t, F.box(0.05, 0.012, 0.016), c(0x8a8f99), 0, 0.008, -0.085); t.rotation.x = -1.0; t.position.y = 0.07; g.add(t); }
      else if (kind === 'wrench') { F.put(g, F.box(0.028, 0.2, 0.012), c(0x9aa3ad), 0, 0.1, 0); F.put(g, F.box(0.07, 0.045, 0.014), c(0x9aa3ad), 0, 0.21, 0); F.put(g, F.box(0.05, 0.03, 0.014), c(0x9aa3ad), 0, 0.005, 0); }
      else if (kind === 'camera') { F.put(g, F.box(0.11, 0.07, 0.05), c(0x30323a), 0, 0.05, 0); const l = F.put(g, F.cyl(0.028, 0.03, 0.04, 10), c(0x9aa3ad), 0, 0.05, 0.04); l.rotation.x = Math.PI / 2; F.put(g, F.box(0.03, 0.015, 0.03), c(0x30323a), -0.03, 0.092, 0); }
      else if (kind === 'magnifier') { F.put(g, F.cyl(0.011, 0.011, 0.11, 8), c(0x3a3a3a), 0, 0.055, 0); const r = F.put(g, F.cyl(0.05, 0.05, 0.012, 14), c(0x8a8f99), 0, 0.155, 0); r.rotation.x = Math.PI / 2; const gl = F.put(g, F.cyl(0.041, 0.041, 0.014, 14), c(0xbfe6ff), 0, 0.155, 0); gl.rotation.x = Math.PI / 2; }
      else { F.put(g, F.box(0.2, 0.14, 0.16), c(0xc49a6c), 0, 0.07, 0); F.put(g, F.box(0.205, 0.012, 0.04), c(0xe8d9b8), 0, 0.142, 0); }
      const baked = F.bake(g); propGeo.set(kind, { geometry: baked.geometry, material: baked.material });
    }
    const t = propGeo.get(kind); const m = new THREE.Mesh(t.geometry, t.material); m.castShadow = false; m.userData.keep = true; return m;
  }
  function giveProp(a) {
    if (!a.rig?.setProp || a.e.type !== 'ai') return;
    let h = 0; for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const kind = PROP_BY_DIV[a.e.divisionId] && h % 3 ? PROP_BY_DIV[a.e.divisionId] : h % 5 < 3 ? PROP_ANY[h % PROP_ANY.length] : null;
    if (!kind) return;
    a.prop = propMesh(kind); a.prop.scale.setScalar(1.45); a.propKind = kind; a.rig.setProp(a.prop);
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

  // ───── the building as a building: plinth, pillars, ring beam, entrance canopy and a roof per wing.
  // The roof is a cutaway (Sims-style): it shows from far away or from the street, and hides when you look inside.
  let roofG = null, roofMode = 'auto', footprint = null, aiCore = null, domeG = null, domeR = 1, domeH = 1, podDomes = [], ringR = 46, ringW = 8;
  function buildShell(fullX, midX, depth) {
    const x1 = -lenX / 2 - CORR, x2 = lenX / 2, z1 = -depth / 2, z2 = depth / 2;
    footprint = { x1, x2, z1, z2 };
    const stone = F.M.plasterWarm, dark = M.slab;
    const put = (geo, mat, x, y, z, o = { cast: true, receive: true }) => add(new THREE.Mesh(geo, mat), x, y, z, world, o);
    // plinth along the three closed sides, and beside the entrance doors
    for (const z of [z1, z2]) put(box(fullX + 0.5, 0.55, 0.34), dark, midX, 0.27, z);
    put(box(0.34, 0.55, depth + 0.5), dark, x2, 0.27, 0);
    for (const s of [-1, 1]) put(box(0.34, 0.55, depth / 2 - 3.2), dark, x1, 0.27, s * (depth / 4 + 1.6));
    // pillars every half bay and at the corners; ring beam on top ties them together
    const o2 = { cast: true, receive: true };
    const pil = (x, z) => floors.forEach((f, k) => add(new THREE.Mesh(F.cyl(0.24, 0.24, FH, 16), stone), x, FH / 2 - 0.3, z + corridors[k], f, o2));
    for (let x = x1; x <= x2 + 0.01; x += RW / 2) for (const z of [z1, z2]) pil(Math.min(x, x2), z);
    for (let z = z1 + RD / 2; z < z2 - 0.01; z += RD / 2) { pil(x2, z); if (Math.abs(z) > 3.4) pil(x1, z); }
    const glowBand = new THREE.MeshStandardMaterial({ color: 0xcfeaff, emissive: 0x8fd0ff, emissiveIntensity: 1.3, roughness: 0.4 });
    floors.forEach((f, k) => { for (const z of [z1, z2]) add(new THREE.Mesh(box(fullX + 0.94, 0.06, 0.64), glowBand), midX, WALL_H + 0.02, z + corridors[k], f, { cast: false, receive: false }); });
    floors.forEach((f, k) => { for (const z of [z1, z2]) add(new THREE.Mesh(box(fullX + 0.9, 0.5, 0.6), stone), midX, WALL_H + 0.3, z + corridors[k], f, o2); for (const x of [x1, x2]) add(new THREE.Mesh(box(0.6, 0.5, depth + 0.9), stone), x, WALL_H + 0.3, corridors[k], f, o2); });
    // entrance: canopy on two columns, double doors standing open, name above the door
    put(box(3.6, 0.22, 8.4), dark, x1 - 1.6, WALL_H + 0.75, 0);
    for (const s of [-1, 1]) { put(F.cyl(0.14, 0.14, WALL_H + 0.65, 10), F.M.steel, x1 - 3, (WALL_H + 0.65) / 2, s * 3.6); const door = put(box(0.06, 2.3, 1.5), F.M.glassware, x1 - 0.7, 1.15, s * 2.3, { cast: false, receive: false }); door.rotation.y = s * 1.15; }
    const sign = wallText('RAY GROUP', 6.5, '#f4efe6'); sign.position.set(x1 - 3.42, WALL_H + 0.75, 0); sign.rotation.y = -Math.PI / 2; sign.userData.keep = true; world.add(sign);
    put(box(0.12, 0.6, 7.2), dark, x1 - 3.36, WALL_H + 0.75, 0, { cast: false, receive: false });
    // roofs: one slab per row of rooms, a glass skylight over each corridor and the atrium, rooftop units
    { const glow = new THREE.MeshStandardMaterial({ color: 0xcfeaff, emissive: 0x6fb8ff, emissiveIntensity: 1.7, flatShading: true, roughness: 0.3 });
      const top = (floors.length - 1) * FH + WALL_H + 0.8;
      aiCore = new THREE.Group(); aiCore.userData.keep = true; aiCore.position.set(hallX, top + 5.2, 0);
      aiCore.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.9, 0), glow));
      for (const [r, tilt] of [[3.1, 0.35], [4.0, -0.5]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 4, 14), glow); ring.rotation.x = Math.PI / 2 + tilt; aiCore.add(ring); }
      world.add(aiCore);
      const mast = add(new THREE.Mesh(F.cyl(0.12, 0.3, 3.2, 6), F.M.frame), hallX, top + 1.6, 0, world, { cast: false, receive: false }); mast.userData.keep = true; }
    roofG = new THREE.Group(); roofG.userData.keep = true; roofG.visible = false; { const th = (floors.length - 1) * TWIST; roofG.rotation.y = th; roofG.position.set(hallX - hallX * Math.cos(th), (floors.length - 1) * FH, hallX * Math.sin(th)); } world.add(roofG);
    const roofMat = std(0xd3d4e2, { roughness: 0.95 }), skyMat = new THREE.MeshStandardMaterial({ color: 0x9fc0d4, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.3 });
    const RY = WALL_H + 0.62;
    const rp = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = false; roofG.add(m); return m; };
    for (const zc of [0]) {
      for (const sd of [-1, 1]) {
        const rz = zc + sd * (CORR / 2 + RD / 2);
        rp(box(lenX + 0.4, 0.26, RD + 0.3), roofMat, 0, RY, rz);
        for (let x = -lenX / 2 + RW / 2; x < lenX / 2; x += RW * 2) rp(box(1.8, 0.9, 1.4), F.M.steel, x, RY + 0.58, rz + sd * 1.6); // rooftop air units
      }
      rp(box(lenX, 0.1, CORR - 0.3), skyMat, 0, RY + 0.25, zc);
      for (let x = -lenX / 2; x <= lenX / 2 + 0.01; x += RW / 2) rp(box(0.12, 0.16, CORR), F.M.frame, x, RY + 0.25, zc);
    }
    rp(box(CORR + 0.3, 0.1, depth + 0.3), skyMat, hallX, RY + 0.25, 0);
    for (let z = z1; z <= z2 + 0.01; z += RD / 2) rp(box(CORR, 0.16, 0.12), F.M.frame, hallX, RY + 0.25, z);
    // spiral ramp around the core: from each floor's hall, a quarter turn up to the next arm
    { const N = 14, tread = new THREE.MeshStandardMaterial({ color: 0xeef2fb, emissive: 0x8fd0ff, emissiveIntensity: 0.2, roughness: 0.35, metalness: 0.2, flatShading: true });
      const arc = (RAMP_R * Math.PI / 2) / N, h = CORR / 2, lead = RAMP_R - h + 0.95;
      for (let k = 0; k < floors.length - 1; k++) {
        const f = floors[k], zc = corridors[k];
        for (let i = 0; i < N; i++) {
          const ph = ((i + 0.5) / N) * Math.PI / 2, y = ((i + 0.5) / N) * FH - 0.06, x = hallX - RAMP_R * Math.sin(ph), z = zc + RAMP_R * Math.cos(ph), ry = Math.atan2(-Math.cos(ph), -Math.sin(ph));
          const t = add(new THREE.Mesh(box(1.9, 0.12, arc + 0.12), tread), x, y, z, f, o2); t.rotation.y = ry;
          const e = add(new THREE.Mesh(box(0.06, 0.2, arc + 0.12), glowBand), hallX - (RAMP_R + 0.95) * Math.sin(ph), y + 0.06, zc + (RAMP_R + 0.95) * Math.cos(ph), f, { cast: false, receive: false }); e.rotation.y = ry;
        }
        add(new THREE.Mesh(box(1.9, 0.12, lead), tread), hallX, -0.07, zc + h + lead / 2, f, o2);
        add(new THREE.Mesh(box(lead, 0.12, 1.9), tread), hallX - h - lead / 2, FH - 0.07, zc, f, o2);
      }
      // the core: a light column through every floor, right behind the ramp
      const coreH = (floors.length - 1) * FH + WALL_H + 2.4;
      const col = add(new THREE.Mesh(F.cyl(0.5, 0.7, coreH, 6), glowBand), hallX - 2.2, coreH / 2, 2.2, world, { cast: false, receive: false }); col.userData.keep = true; }
  }
  function updateDome() {
    if (!domeG) return; const c = camera.position, d = Math.hypot(c.x - hallX, c.z);
    const surf = d < domeR ? domeH * Math.sqrt(1 - (d / domeR) ** 2) : 0;
    domeG.visible = !(d < domeR - 1 && c.y < surf - 1);
  }
  /** Play: the glass roof stays on while you and the camera are outside the pod; it lifts only when you step in, so the rooms stay clear. */
  const podOutside = (w, c, p) => Math.hypot(c.x - w.x, c.z - w.z) > 10.2 && Math.hypot(p.x - w.x, p.z - w.z) > 10.2;
  /** Pod domes: shown from far away or from above, hidden when you are close, so the rooms stay clear. */
  function updateRoof() {
    if (!podDomes.length) return;
    const c = camera.position;
    for (const d of podDomes) { const w = d.userData.c; d.visible = roofMode === 'on' ? true : roofMode === 'off' ? false : (player ? podOutside(w, c, player.a.g.position) : (c.y > 22 || Math.hypot(c.x - w.x, c.z - w.z) > 15)); }
  }
  /** Standing spots that ended up inside furniture (or a desk) move to the nearest free floor of their own room. */
  function freeSpots(only) {
    for (const r of only ? [only] : rooms.values()) for (const sp of r.spots) {
      if (sp.pose !== 'stand' || !collides(sp.p.x, sp.p.z)) continue;
      search: for (let rad = 0.25; rad <= 4.5; rad += 0.25) for (let a = 0; a < 16; a++) {
        const x = sp.p.x + Math.cos(a * Math.PI / 8) * rad, z = sp.p.z + Math.sin(a * Math.PI / 8) * rad;
        if (inRoom(r, x, z, 0.5) && !collides(x, z)) { sp.p.x = x; sp.p.z = z; break search; }
      }
    }
  }
  function build() {
    for (const r of rooms.values()) disposeSprite(r.sign);
    for (const a of avatars.values()) { disposeSprite(a.label); disposeSprite(a.bubble); }
    world.clear(); rooms.clear(); avatars.clear(); pickables.length = 0; claimed.clear(); solids.length = 0; pods.length = 0; walls.length = 0; pois.length = 0; blinkers.length = 0; podDomes = []; brainCore = null;
    const secs = sectionsFor(data.divisions);
    lenX = 0; hallX = 0; corridors = [0]; footprint = null; roofG = null;
    const f0 = new THREE.Group(); world.add(f0); floors = [f0]; viewFloor = 0;
    const N = secs.length, nIn = Math.round(N * 0.345), nOut = N - nIn;
    const RI = Math.max(40, (nIn * 18.4) / (Math.PI * 2)), RO = Math.max(RI + 29, (nOut * 18.4) / (Math.PI * 2));
    ringR = (RI + RO) / 2; ringW = RO - RI - 19.6;
    podRI = RI; gaps = Array.from({ length: nIn }, (_, i) => (i / nIn) * Math.PI * 2 - Math.PI / 2); plazaSpots = []; decks = []; plazaSites = []; pulseMats = []; fountainFx = null; screens = {}; appFx = []; appDraws = []; for (const f of flows) disposeFlow(f); flows = []; floaters = []; sitAll = null;
    const QT = Math.PI / 2;
    const std2 = (o) => new THREE.MeshStandardMaterial({ flatShading: true, ...o });
    const mintM = worldTextured(std2({ color: 0xcfeedb, roughness: 0.9 }), F.M.floor.grass.map, 0.16, 0.9, 'wtg'), promM = worldTextured(std2({ color: 0xe6e9f6, roughness: 0.55, metalness: 0.1 }), F.M.floor.paving.map, 0.1, 0.8, 'wtp');
    const glowM = std2({ color: 0xcfeaff, emissive: 0x8fd0ff, emissiveIntensity: 1.5 }), postM = std2({ color: 0xf1f4fb, roughness: 0.4, metalness: 0.3 }); glowRef = glowM;
    const shellM = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, roughness: 0.1 });
    const domeM = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, emissive: 0x5a7fd0, emissiveIntensity: 0.25, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, flatShading: true, roughness: 0.1 });
    // shared, cheap rim lines for every pod dome (one geometry + one material for all 27)
    const hudSegs = [], hudW = 1.1, hudH = 0.7, hudL = 0.35;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) hudSegs.push(sx * hudW, sy * hudH, 0, sx * (hudW - hudL), sy * hudH, 0, sx * hudW, sy * hudH, 0, sx * hudW, sy * (hudH - hudL), 0);
    const hudGeo = new THREE.BufferGeometry(); hudGeo.setAttribute('position', new THREE.Float32BufferAttribute(hudSegs, 3));
    const hudM = new THREE.LineBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
    const podEdgeGeo = new THREE.EdgesGeometry(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(8.8, 7.4, 8.8), 20), podEdgeM = new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.6, fog: false, depthWrite: false });
    const GAP = 0.55, padGeo = new THREE.CylinderGeometry(9.4, 9.4, 0.3, 28), shellGeo = new THREE.CylinderGeometry(8.8, 8.8, 4.8, 24, 1, true, GAP / 2, Math.PI * 2 - GAP), ringGeo = new THREE.TorusGeometry(1, 0.012, 4, 20), domeGeo = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(8.8, 7.4, 8.8);
    const skirtGeo = (() => { const sh = new THREE.Shape(), p0 = GAP / 2 - Math.PI / 2, p1 = Math.PI * 2 - GAP / 2 - Math.PI / 2; sh.absarc(0, 0, 8.85, p0, p1, false); sh.absarc(0, 0, 8.75, p1, p0, true); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 26 }).rotateX(-Math.PI / 2); })(), skirtM = std2({ color: 0xf1f4fb, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }), muGeo = new THREE.BoxGeometry(0.1, 5.0, 0.1);
    secs.forEach((sec, i) => {
      const inner = i < nIn, n = inner ? nIn : nOut, idx = inner ? i : i - nIn, R = inner ? RI : RO;
      const ang = ((idx + (inner ? 0.5 : 0)) / n) * Math.PI * 2 - Math.PI / 2, px = Math.cos(ang) * R, pz = Math.sin(ang) * R;
      const nx = (inner ? 1 : -1) * Math.cos(ang), nz = (inner ? 1 : -1) * Math.sin(ang); // the way the door should face
      let k = 0, best = -9; for (let q = 0; q < 4; q++) { const d = Math.sin(q * QT) * nx + Math.cos(q * QT) * nz; if (d > best + 1e-6) { best = d; k = q; } }
      const T = frameOf(px, pz, k);
      const room = { ...sec, cx: 0, cz: 0, zc: 9, side: -1, exterior: true, round: true, wing: 0, spots: [], desks: [], group: new THREE.Group(), T };
      const [dx, dz] = T.pt(0, 6.1), [ix, iz] = T.pt(0, 4.3);
      room.door = new THREE.Vector3(dx, 0, dz); room.inside = new THREE.Vector3(ix, 0, iz);
      room.group.position.set(px, 0, pz); room.group.rotation.y = T.th; f0.add(room.group);
      const p0 = pois.length;
      roomFrame = T; buildRoom(room); roomFrame = null;
      room.cx = px; room.cz = pz;
      pods.push({ x: px, z: pz, r: 8.8, nx: Math.sin(T.th), nz: Math.cos(T.th), cg: Math.cos(GAP / 2 + 0.08) });
      for (let j = p0; j < pois.length; j++) { const o = pois[j]; [o.x, o.z] = T.pt(o.x, o.z); }
      for (const sp of room.spots) { const [x, z] = T.pt(sp.p.x, sp.p.z); sp.p.set(x, 0, z); sp.face += T.th; }
      if (brainCore && !brainCore.room) brainCore.room = room;
      rooms.set(sec.id, room);
      // round pod: garden pad, glass wall with an opening at the door, light ring, glass dome
      const g = room.group;
      const pad = new THREE.Mesh(padGeo, mintM); pad.position.y = -0.15; pad.receiveShadow = true; g.add(pad);
      const sk = new THREE.Mesh(skirtGeo, skirtM); sk.position.y = 0; g.add(sk);
      const wl = new THREE.Mesh(shellGeo, shellM); wl.position.y = 3.6; g.add(wl);
      for (let q = 0; q <= 14; q++) { const a2 = GAP / 2 + (q / 14) * (Math.PI * 2 - GAP); const mu = new THREE.Mesh(muGeo, postM); mu.position.set(Math.sin(a2) * 8.8, 3.7, Math.cos(a2) * 8.8); g.add(mu); }
      for (const sgn of [-1, 1]) { const gp = new THREE.Mesh(F.cyl(0.2, 0.24, 6.6, 6), glowM); gp.position.set(Math.sin((sgn * GAP) / 2) * 8.8, 3.3, Math.cos((sgn * GAP) / 2) * 8.8); g.add(gp); }
      const rg = new THREE.Mesh(ringGeo, glowM); rg.rotation.x = Math.PI / 2; rg.scale.set(8.8, 8.8, 26); rg.position.y = 6.2; g.add(rg);
      const dome = new THREE.Mesh(domeGeo, domeM); dome.position.y = 6.2; dome.userData.keep = true; dome.userData.c = new THREE.Vector3(px, 6.2, pz); dome.castShadow = false; g.add(dome); podDomes.push(dome);
      dome.add(new THREE.LineSegments(podEdgeGeo, podEdgeM)); // rim lines of the glass dome (child, so it hides with the dome)
      const baseRing = new THREE.Mesh(ringGeo, glowM); baseRing.rotation.x = Math.PI / 2; baseRing.scale.set(8.8, 8.8, 26); baseRing.position.y = 0.2; g.add(baseRing); // light line where the glass meets the pad
      // HUD brackets: two corner frames on the outside of the glass wall (one shared geometry, one material)
      for (const th of [Math.PI / 2, -Math.PI / 2]) { const hb = new THREE.LineSegments(hudGeo, hudM); hb.position.set(Math.sin(th) * 8.95, 4.6, Math.cos(th) * 8.95); hb.rotation.y = th; g.add(hb); }
    });
    // promenade and plaza
    const prom = new THREE.Mesh(new THREE.RingGeometry(ringR - ringW / 2, ringR + ringW / 2, 64).rotateX(-Math.PI / 2), promM); prom.position.y = 0.02; prom.receiveShadow = true; world.add(prom);
    for (const sg of [-1, 1]) { const ln = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 3, 64), glowM); ln.rotation.x = Math.PI / 2; ln.scale.set(ringR + sg * ringW / 2, ringR + sg * ringW / 2, 30); ln.position.y = 0.09; world.add(ln); }
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, rr = ringR + (i % 2 ? 1 : -1) * (ringW / 2 + 0.5); const post = new THREE.Mesh(F.cyl(0.08, 0.12, 1.8, 6), postM); post.position.set(Math.cos(a) * rr, 0.9, Math.sin(a) * rr); world.add(post); const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), glowM); lamp.position.set(post.position.x, 2.0, post.position.z); world.add(lamp); }
    {
      const kerbM = std2({ color: 0xc9cfe4, roughness: 0.7 }), paintM = std2({ color: 0xf7f9ff, roughness: 0.9 }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      for (const rr of [ringR - ringW / 2, ringR + ringW / 2]) { const sh = new THREE.Shape(); sh.absarc(0, 0, rr + 0.15, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, rr - 0.15, 0, Math.PI * 2, true); sh.holes.push(hole); const kb = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 72 }).rotateX(-Math.PI / 2), kerbM); kb.receiveShadow = true; world.add(kb); }
      const DASH = Math.max(24, Math.round((Math.PI * 2 * ringR) / 3.2)), dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.012, 0.12), paintM, DASH);
      for (let i = 0; i < DASH; i++) { const a = (i / DASH) * Math.PI * 2; q.setFromAxisAngle(up, -a - Math.PI / 2); dashes.setMatrixAt(i, m4.compose(p.set(Math.cos(a) * ringR, 0.032, Math.sin(a) * ringR), q, sc)); }
      dashes.receiveShadow = true; world.add(dashes);
      const ZB = 4 * 7, zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.012, 2.6), paintM, ZB);
      for (let c = 0; c < 4; c++) { const a = (c / 4) * Math.PI * 2 + Math.PI / 4; for (let k = 0; k < 7; k++) { const off = (k - 3) * 0.9; q.setFromAxisAngle(up, Math.PI / 2 - a); zebra.setMatrixAt(c * 7 + k, m4.compose(p.set(Math.cos(a) * ringR - Math.sin(a) * off, 0.034, Math.sin(a) * ringR + Math.cos(a) * off), q, sc.set(1, 1, Math.min(1.9, ringW / 2.7)))); } }
      sc.set(1, 1, 1); zebra.receiveShadow = true; world.add(zebra);
      const BOL = 72, bol = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6), postM, BOL), cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), glowM, BOL);
      for (let i = 0; i < BOL; i++) { const a = (i / BOL) * Math.PI * 2 + 0.02, rr = ringR + (i % 2 ? 1 : -1) * (ringW / 2 - 0.5); bol.setMatrixAt(i, m4.compose(p.set(Math.cos(a) * rr, 0.4, Math.sin(a) * rr), q.identity(), sc)); cap.setMatrixAt(i, m4.compose(p.set(Math.cos(a) * rr, 0.815, Math.sin(a) * rr), q, sc)); }
      bol.castShadow = true; world.add(bol, cap);
      // benches and planters between the crossings, facing the road
      for (let i = 0; i < 14; i++) {
        const a = ((i + 0.5) / 14) * Math.PI * 2 + 0.11, side2 = i % 2 ? 1 : -1, rr = ringR + side2 * (ringW / 2 - 1.1), b = new THREE.Group();
        F.put(b, F.box(1.6, 0.07, 0.45), F.M.walnut, 0, 0.45, 0); F.put(b, F.box(1.6, 0.4, 0.06), F.M.walnut, 0, 0.72, -0.22 * side2); for (const sx of [-0.7, 0.7]) F.put(b, F.box(0.07, 0.45, 0.4), F.M.blackMetal, sx, 0.22, 0);
        b.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); b.rotation.y = -a - Math.PI / 2; world.add(b);
      }
      for (let i = 0; i < 10; i++) { const a = ((i + 0.5) / 10) * Math.PI * 2 + 0.52, rr = ringR + (i % 2 ? -1 : 1) * (ringW / 2 - 0.9), pl = F.plant(0.9, i % 3); pl.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); world.add(pl); }
    }
    const plazaR = RI - 9.6 - 1.4;
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(plazaR, plazaR, 0.1, 40), mintM); plaza.position.y = -0.03; plaza.receiveShadow = true; world.add(plaza);
    const prr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 3, 40), glowM); prr.rotation.x = Math.PI / 2; prr.scale.set(plazaR, plazaR, 24); prr.position.y = 0.09; world.add(prr);
    for (let t = 0; t < 3; t++) { const d = new THREE.Mesh(new THREE.CylinderGeometry((7.4 - t * 1.5) * 0.62, (8.0 - t * 1.5) * 0.62, 0.5, 6), t % 2 ? glowM : postM); d.position.y = 0.25 + t * 0.5; d.castShadow = true; world.add(d); }
    const BRAIN_K = 0.95, FOUNT_K = 0.62;   // plaza relayout: Company Brain and fountain are smaller than before (1.5 / 1.0)
    // ── Company Brain: a glass atrium on the plaza pedestal, about as tall as the rooms. Warm light breathes slowly; it flares when something is learned.
    {
      const bg = new THREE.Group(); bg.userData.dynamic = true; bg.scale.setScalar(BRAIN_K); bg.position.y = -0.75 * (BRAIN_K / 1.5); world.add(bg);
      const warm = std2({ color: 0xffe3c2, emissive: 0xff9a3c, emissiveIntensity: 1.3 });
      const glassB = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.9, 5.2, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe8cf, emissive: 0xffa75c, emissiveIntensity: 0.25, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, flatShading: true })); glassB.position.y = 1.5 + 2.6; bg.add(glassB);
      // HUD brackets on the atrium glass, four around it (shared geometry from the pods)
      for (let i = 0; i < 4; i++) { const th = (i / 4) * Math.PI * 2 + Math.PI / 4; const hb = new THREE.LineSegments(hudGeo, hudM); hb.scale.setScalar(0.8); hb.position.set(Math.sin(th) * 2.95, 4.1, Math.cos(th) * 2.95); hb.rotation.y = th; bg.add(hb); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const p = new THREE.Mesh(F.cyl(0.07, 0.1, 5.2, 4), warm); p.position.set(Math.cos(a) * 2.7, 4.1, Math.sin(a) * 2.7); bg.add(p); }
      for (const y of [1.55, 6.65]) { const rr = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.06, 4, 8), warm); rr.rotation.x = Math.PI / 2; rr.position.y = y; bg.add(rr); }
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xff9a3c, emissiveIntensity: 1.1, wireframe: true })); orb.position.y = 4.2; bg.add(orb);
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffb15c, emissiveIntensity: 1.8, flatShading: true })); inner.position.y = 4.2; bg.add(inner);
      const rings = [0, 1].map((k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.7 + k * 0.5, 0.045, 4, 14), warm); r.position.y = 4.2; r.rotation.x = Math.PI / 2 + (k ? -0.5 : 0.4); bg.add(r); return r; });
      const light = new THREE.PointLight(0xffb36b, 8, 34, 2); light.position.y = 4.2; bg.add(light);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 6.6, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 3.3; hit.userData = { brain: true, keep: true }; bg.add(hit); pickables.push(hit);
      const beamMat = (c1, c2, amt, streak) => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uT: { value: 0 }, uAmt: { value: amt }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uStreak: { value: streak } },
        vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uT; uniform float uAmt; uniform vec3 uC1; uniform vec3 uC2; uniform float uStreak; varying vec3 vN; varying vec2 vUv; void main(){ float fres = pow(clamp(abs(vN.z), 0.0, 1.0), 1.8); float h = vUv.y; float vert = pow(1.0 - h, 1.6) * smoothstep(0.0, 0.05, h); float st = 1.0 - uStreak + uStreak * (0.5 + 0.5 * sin(vUv.x * 40.0 + h * 9.0 - uT * 0.35)) * (0.6 + 0.4 * sin(vUv.x * 11.0 - uT * 0.2)); vec3 col = mix(uC1, uC2, smoothstep(0.0, 0.75, h)); gl_FragColor = vec4(col, fres * vert * st * uAmt); }',
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.9, 70, 24, 1, true), beamMat(0xffe2b8, 0xff9a4a, 0.5, 0.35)); beam.position.y = 4.2 + 35; beam.userData.keep = true; bg.add(beam);
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.6, 70, 24, 1, true), beamMat(0xffb36b, 0xb08cff, 0.2, 0.2)); halo.position.y = 4.2 + 35; halo.userData.keep = true; bg.add(halo);
      const MN = 44, mp = new Float32Array(MN * 3), mdat = []; for (let i = 0; i < MN; i++) mdat.push({ a: Math.random() * 6.28, r: 3.2 + Math.random() * 2.6, y: 0.8 + Math.random() * 7, sp: (0.15 + Math.random() * 0.25) * (i % 2 ? 1 : -1), ph: Math.random() * 6.28 });
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffd9a8, size: 0.22, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false })); motes.frustumCulled = false; motes.userData.keep = true; bg.add(motes);
      // neural network inside the orb: nodes on a sphere joined to their nearest neighbours; nodes pulse like firing neurons
      const NN = 72, npos = [], ncol = new Float32Array(NN * 3), nph = [];
      for (let i = 0; i < NN; i++) { const y = 1 - (i / (NN - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963; npos.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(1.28)); nph.push(Math.random() * 6.28); }
      const lp = []; for (let i = 0; i < NN; i++) { const ds = npos.map((p, j) => [p.distanceTo(npos[i]), j]).sort((a, b) => a[0] - b[0]); for (let k = 1; k <= 3; k++) { const j = ds[k][1]; if (j > i) lp.push(npos[i], npos[j]); } }
      const net = new THREE.Group(); net.position.y = 4.2; net.userData.keep = true; bg.add(net);
      net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
      const ngeo = new THREE.BufferGeometry().setFromPoints(npos); ngeo.setAttribute('color', new THREE.BufferAttribute(ncol, 3));
      net.add(new THREE.Points(ngeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false })));
      const sats = []; const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.04, 4, 40), warm); ring3.position.y = 4.2; ring3.rotation.x = Math.PI / 2 - 0.9; ring3.rotation.y = 0.5; bg.add(ring3); rings.push(ring3);
      rings.forEach((r, k) => { for (let m = 0; m < 2; m++) { const sat = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: m ? 0xb08cff : 0xffd9a8 })); const R = 1.7 + (k < 2 ? k * 0.5 : 1.1), an = m * Math.PI; sat.position.set(Math.cos(an) * R, Math.sin(an) * R, 0); r.add(sat); sats.push(sat); } });
      // four energy pylons joined to the orb by flickering lightning
      const pylons = [], bolts = []; const boltMat = new THREE.LineBasicMaterial({ color: 0xffeccc, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4, px = Math.cos(a) * 5.0, pz = Math.sin(a) * 5.0;
        /* the dark pylon posts were removed (Owner): the crystals still float and arc lightning to the orb */
        const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffd9a8 })); cap.position.set(px, 0.83 + 4.85, pz); cap.userData.keep = true; bg.add(cap); pylons.push(cap);
        const bp = new Float32Array(14 * 3), bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); const bl = new THREE.Line(bgeo, boltMat); bl.frustumCulled = false; bl.userData.keep = true; bg.add(bl); bolts.push({ bl, bp, from: new THREE.Vector3(px, 0.83 + 4.85, pz), to: new THREE.Vector3(0, 4.2, 0) });
      }
      // a glyph ring on the top step that turns slowly
      const glyph = new THREE.Mesh(new THREE.RingGeometry(2.95, 3.25, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uT: { value: 0 }, uAmt: { value: 0.6 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uT; uniform float uAmt; varying vec2 vP; void main(){ float a = atan(vP.y, vP.x) + uT * 0.25; float tick = step(0.55, fract(a * 22.0 / 6.2831)); float chunk = step(0.35, fract(a * 5.0 / 6.2831 + 0.1)); float r = (length(vP) - 2.95) / 0.3; float edge = smoothstep(0.0, 0.12, r) * smoothstep(1.0, 0.88, r); gl_FragColor = vec4(1.0, 0.82, 0.56, edge * (0.25 + 0.55 * tick * chunk) * uAmt); }' }));
      glyph.position.y = 1.52; glyph.userData.keep = true; bg.add(glyph);
      brainCore = { group: bg, boltMat, orb, inner, light, rings, beam, halo, motes, mdat, mp, net, ncol, nph, sats, pylons, bolts, glyph, notes: [], spin: 0, scanT: 0, insightT: 0, pulse: 0, pulseS: 0, top: 5.55 };
      pois.push({ id: 'brain', x: 0, z: 0, r: 6.4, label: 'Company Brain', sub: 'E: sentuh & buka graf pengetahuan' });
    }
    solid(0, 0, 9.5, 9.5);
    // ── plaza life: a floating sky deck with a winding stair, an open-air stage, a fountain and a kiosk, plus gathering points, so the middle of the campus is used
    {
      const PI = Math.PI, PI2 = PI * 2, DEG = PI / 180, RR = 17;
      const site = (deg) => { const a = deg * DEG; return { x: Math.cos(a) * RR, z: Math.sin(a) * RR, a }; };
      const sites = { deck: site(-70), stage: site(50), fountain: site(130), kiosk: site(210) };
      plazaSites = Object.values(sites);
      const pm = (c, r = 0.7, o = {}) => std2({ color: c, roughness: r, ...o });
      const yawTo = (dx, dz) => Math.atan2(dx, dz);
      const addPs = (x, z, face, pose, tag, y = 0, extra = {}) => plazaSpots.push({ p: new THREE.Vector3(x, y, z), face, pose, tag, plaza: true, key: 'plaza:' + plazaSpots.length, ...extra });
      const bench = (parent, x, y, z, ry) => { const b = new THREE.Group(); F.put(b, F.box(1.6, 0.07, 0.45), F.M.walnut, 0, 0.45, 0); F.put(b, F.box(1.6, 0.4, 0.06), F.M.walnut, 0, 0.72, -0.22); for (const sx of [-0.7, 0.7]) F.put(b, F.box(0.07, 0.45, 0.4), F.M.blackMetal, sx, 0.22, 0); b.position.set(x, y, z); b.rotation.y = ry; parent.add(b); return b; };
      const toward = (fx, fz, tx, tz) => yawTo(tx - fx, tz - fz);
      // ── sky decks: floating discs with a winding stair; three of them, spread around the plaza so people gather in several places
      const makeDeck = (cx, cz, sa, H, DR, N, ds, label) => {
        const S = PI2 * 0.78, th0 = sa + PI / 2, SR = DR + 0.85;
        const dk = { cx, cz, H, DR, R1: SR + 0.85, th0, S, ds, via: [] }; decks.push(dk); plazaSites.push({ x: cx, z: cz });
        const dg = new THREE.Group(); dg.position.set(cx, 0, cz); world.add(dg);
        const slab = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR - 0.5, 0.4, 28), pm(0xe8ecf8, 0.5)); slab.position.y = H - 0.2; slab.castShadow = slab.receiveShadow = true; dg.add(slab);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.06, 4, 36), glowM); rim.rotation.x = PI / 2; rim.position.y = H + 0.03; dg.add(rim);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(DR - 0.8, 0.25, 1.6, 10), pm(0x9fb4e8, 0.4, { emissive: 0x5b8cff, emissiveIntensity: 0.9 })); core.position.y = H - 1.2; dg.add(core); pulseMats.push({ m: core.material, base: 0.9, amp: 0.5, sp: 0.8, ph: decks.length * 1.7 });
        for (let k = 0; k < 2; k++) { const hr = new THREE.Mesh(new THREE.TorusGeometry(DR * 0.45 + k * 1.1, 0.05, 4, 28), glowM); hr.rotation.x = PI / 2; hr.position.y = H - 2.3 - k * 0.6; dg.add(hr); }
        const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 1, 1), pm(0xffffff, 0.6), N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c1 = new THREE.Color(0xdfe5f7), c2 = new THREE.Color(0xc4d0f0);
        for (let i = 0; i < N; i++) { const th = th0 + ds * (S * (i + 0.5)) / N, h = (H * (i + 1)) / N; q.setFromAxisAngle(up, -th); steps.setMatrixAt(i, m4.compose(P.set(Math.cos(th) * SR, h / 2, Math.sin(th) * SR), q, Sc.set(1, h, (S / N) * SR * 1.12))); steps.setColorAt(i, i % 2 ? c1 : c2); }
        steps.castShadow = steps.receiveShadow = true; steps.position.set(cx, 0, cz); world.add(steps);
        const pts = []; for (let i = 0; i <= 60; i++) { const th = th0 + ds * (S * i) / 60; pts.push(new THREE.Vector3(Math.cos(th) * (SR + 0.8), (H * i) / 60 + 0.95, Math.sin(th) * (SR + 0.8))); }
        dg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.04, 4), glowM));
        for (let i = 0; i <= N; i += 2) { const th = th0 + ds * (S * i) / N, post = new THREE.Mesh(F.cyl(0.03, 0.03, 0.95, 4), postM); post.position.set(Math.cos(th) * (SR + 0.8), (H * i) / N + 0.48, Math.sin(th) * (SR + 0.8)); dg.add(post); }
        for (let i = 0; i <= N; i++) { const th = th0 + ds * (S * i) / N; dk.via.push(new THREE.Vector3(cx + Math.cos(th) * SR, (H * i) / N, cz + Math.sin(th) * SR)); }
        const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), pm(0x9fd8ff, 0.3, { emissive: 0x5bb7ff, emissiveIntensity: 1.2, wireframe: true })); globe.position.set(0, H + 1.5, 0); dg.add(globe);
        const gp = new THREE.Mesh(F.cyl(0.25, 0.35, 0.7, 10), pm(0x2b3558, 0.4)); gp.position.set(0, H + 0.35, 0); dg.add(gp);
        const bR = DR * 0.67, sR = DR * 0.42;
        for (let k = 0; k < 3; k++) {
          const al = sa + PI + k * (PI2 / 3) + 0.5, bx = Math.cos(al) * bR, bz = Math.sin(al) * bR, ry = toward(bx, bz, 0, 0);
          bench(dg, bx, H, bz, ry);
          for (const o of [-0.4, 0.4]) addPs(cx + bx + Math.cos(ry) * o, cz + bz - Math.sin(ry) * o, ry, 'sit', 'deck', H, { via: dk.via });
        }
        for (let k = 0; k < 4; k++) { const al = sa + k * (PI / 2) + 0.7, x = cx + Math.cos(al) * sR, z = cz + Math.sin(al) * sR; addPs(x, z, toward(x, z, cx, cz), 'stand', 'deck', H, { via: dk.via }); }
        pois.push({ id: 'skydeck' + decks.length, x: cx, z: cz, r: DR + 0.8, label: label, sub: 'Naik tangga ke dek melayang' });
      };
      { const q = sites.deck; makeDeck(q.x, q.z, q.a, 5, 3.6, 26, 1, 'Sky Deck'); }
      { const a = -30 * DEG; makeDeck(Math.cos(a) * 22.5, Math.sin(a) * 22.5, a, 4, 2.9, 22, -1, 'Sky Deck Timur'); }
      { const a = 170 * DEG; makeDeck(Math.cos(a) * 23, Math.sin(a) * 23, a, 6.5, 3.3, 32, 1, 'Sky Deck Barat'); }
      // ── open-air stage with a curved screen
      {
        const { x: cx, z: cz, a: sa } = sites.stage;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.14, 28), pm(0xdfe5f7, 0.5)); disc.position.set(cx, 0.07, cz); disc.receiveShadow = true; world.add(disc);
        const sr = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 4, 36), glowM); sr.rotation.x = PI / 2; sr.position.set(cx, 0.15, cz); world.add(sr);
        const thc = PI / 2 - sa, scr = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.6, 24, 1, true, thc - 0.85, 1.7), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, emissive: 0x3b6fd0, emissiveIntensity: 0.9, side: THREE.DoubleSide, flatShading: true })); { const sc2 = mkScreenTex(1024, 440); screens.dash = sc2; scr.material = mkScreenMat(sc2.tex, 0.9); } scr.position.set(cx, 2.0, cz); scr.userData.keep = true; world.add(scr); addCurvedFrame(world, { R: 3.6, H: 2.6, t0: thc - 0.85, tl: 1.7, pos: [cx, 2.0, cz], glow: 0x38bdf8 }); pulseMats.push({ m: scr.material, base: 0.9, amp: 0.35, sp: 0.6, ph: 2 });
        const fwd = [-Math.cos(sa), -Math.sin(sa)];
        for (let k = -1; k <= 1; k++) { const x = cx + Math.cos(sa) * 0.6 + Math.cos(sa + PI / 2) * k * 1.3, z = cz + Math.sin(sa) * 0.6 + Math.sin(sa + PI / 2) * k * 1.3; addPs(x, z, yawTo(fwd[0], fwd[1]), 'stand', 'stage'); }
        for (let k = -2; k <= 2; k++) { const al = sa + PI + k * 0.2, x = cx + Math.cos(al) * 5.4, z = cz + Math.sin(al) * 5.4; addPs(x, z, toward(x, z, cx, cz), 'stand', 'audience'); }
        for (const k of [-1, 1]) { const al = sa + PI + k * 0.55, x = cx + Math.cos(al) * 6.6, z = cz + Math.sin(al) * 6.6, ry = toward(x, z, cx, cz); bench(world, x, 0, z, ry); for (const o of [-0.4, 0.4]) addPs(x + Math.cos(ry) * o, z - Math.sin(ry) * o, ry, 'sit', 'audience'); }
        pois.push({ id: 'stage', x: cx, z: cz, r: 4, label: 'Panggung terbuka', sub: 'Presentasi & demo' });
      }
      // ── fountain: three tiers, arching jets that really fly, overflow sheets, a tall central jet, mist, rippling water and a gilded crown
      {
        const { x: cx, z: cz, a: sa } = sites.fountain;
        const stone = pm(0xdde2f2, 0.5), stone2 = pm(0xc3cae2, 0.6), gold = pm(0xf4dca0, 0.35, { metalness: 0.55 });
        const grp = new THREE.Group(); grp.position.set(cx, 0, cz); grp.scale.setScalar(FOUNT_K); world.add(grp);
        const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
        // basin, column, bowls
        add(new THREE.CylinderGeometry(3.5, 3.75, 0.72, 40), stone, 0, 0.36, 0);
        add(new THREE.TorusGeometry(3.46, 0.11, 6, 44), stone2, 0, 0.74, 0).rotation.x = PI / 2;
        for (let k = 0; k < 16; k++) { const a = (k / 16) * PI2; add(new THREE.SphereGeometry(0.15, 8, 6), gold, Math.cos(a) * 3.5, 0.82, Math.sin(a) * 3.5); }
        add(new THREE.CylinderGeometry(0.62, 0.95, 1.5, 14), stone, 0, 1.4, 0);
        const bowl = (sc) => new THREE.LatheGeometry([[0.28, 0], [1.2, 0.12], [1.85, 0.46], [2.0, 0.66], [1.9, 0.68], [1.74, 0.52], [1.1, 0.24], [0.34, 0.16]].map(([x, y]) => new THREE.Vector2(x * sc, y * sc)), 36);
        add(bowl(1), stone, 0, 2.0, 0).material.side = THREE.DoubleSide;
        add(new THREE.CylinderGeometry(0.34, 0.5, 1.15, 12), stone, 0, 2.95, 0);
        add(bowl(0.5), stone, 0, 3.45, 0).material.side = THREE.DoubleSide;
        add(new THREE.CylinderGeometry(0.1, 0.22, 0.5, 10), gold, 0, 3.95, 0); add(new THREE.SphereGeometry(0.22, 12, 10), pm(0xffffff, 0.2, { emissive: 0x8fe9ff, emissiveIntensity: 1.2 }), 0, 4.3, 0);
        // rippling water surfaces
        const wmat = (rad) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uR: { value: rad } },
          vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uT; uniform float uR; varying vec2 vP; void main(){ float r = length(vP); float w = sin(r * 7.0 - uT * 2.2) * 0.5 + 0.5; float w2 = sin(r * 13.0 + uT * 1.6 + sin(vP.x * 3.0 + uT) * 0.6) * 0.5 + 0.5; float sp = pow(max(0.0, sin(vP.x * 9.0 + uT * 1.4) * sin(vP.y * 9.0 - uT * 1.1)), 6.0); vec3 deep = vec3(0.06, 0.5, 0.66), shallow = vec3(0.5, 0.9, 0.97); vec3 col = mix(deep, shallow, 0.3 * w + 0.22 * w2 + smoothstep(uR, 0.2, r) * 0.28); col += sp * 0.75; gl_FragColor = vec4(col, 0.9 * smoothstep(uR, uR - 0.35, r)); }' });
        const waters = [[3.42, 0.64], [1.78, 2.58], [0.84, 3.62]].map(([r, y]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-PI / 2), wmat(r)); m.position.y = y; m.userData.keep = true; grp.add(m); return m; });
        // overflow sheets and arching jets share a flowing-streak shader
        const flow = (alpha) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float s = 0.5 + 0.5 * sin(vUv.x * 90.0); float f = 0.5 + 0.5 * sin((vUv.y + uT * 0.9) * 14.0 + vUv.x * 8.0); float a = (0.25 + 0.75 * s * f) * ' + alpha.toFixed(2) + ' * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y); gl_FragColor = vec4(0.72, 0.95, 1.0, a); }' });
        const sheetMat = flow(0.5);
        for (const [r, y, h] of [[2.02, 2.62, 1.95], [1.0, 3.55, 0.98]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.04, h, 40, 1, true), sheetMat); m.position.y = y - h / 2 + 0.05; m.userData.keep = true; grp.add(m); }
        const jetMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float d = 0.45 + 0.55 * (0.5 + 0.5 * sin(vUv.x * 60.0 - uT * 9.0)); gl_FragColor = vec4(0.8, 0.97, 1.0, d * 0.7); }' });
        const arcs = [];
        const ring = (n, p0, c, p2, tube) => { for (let k = 0; k < n; k++) { const a = (k / n) * PI2 + (tube > 0.04 ? 0 : 0.2); const cv = new THREE.QuadraticBezierCurve3(new THREE.Vector3(p0[0], p0[1], 0), new THREE.Vector3(c[0], c[1], 0), new THREE.Vector3(p2[0], p2[1], 0)); arcs.push(new THREE.TubeGeometry(cv, 18, tube, 5, false).rotateY(a)); } };
        ring(14, [3.25, 0.86], [2.35, 4.2], [1.58, 2.62], 0.045); ring(8, [1.62, 2.66], [1.05, 4.6], [0.62, 3.58], 0.04);
        { const jm = new THREE.Mesh(mergeGeometries(arcs, false), jetMat); jm.userData.keep = true; grp.add(jm); arcs.forEach((g) => g.dispose()); }
        // the central jet: a tapered translucent column plus physical droplets
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 3.0, 10, 1, true), sheetMat); core.position.y = 5.0; core.userData.keep = true; grp.add(core);
        // droplets: each follows a real ballistic path (x = x0 + v t, y = y0 + vy t - g t^2 / 2) until it hits a water surface, then restarts
        const G = 9.8, ND = 260, dp = new Float32Array(ND * 3), dd = [];
        for (let i = 0; i < ND; i++) {
          const central = i < 150, a = Math.random() * PI2, vr = central ? 0.5 + Math.random() * 1.5 : 0.4 + Math.random() * 0.8, vy = central ? 6.4 + Math.random() * 1.8 : 3.0 + Math.random() * 1.6, oy = central ? 3.66 : 2.7, r0 = central ? 0.05 : 1.7;
          const solve = (yl) => (vy + Math.sqrt(vy * vy + 2 * G * (oy - yl))) / G; let T = solve(2.58); if (r0 + vr * T > 1.78) T = solve(0.66); if (central && r0 + vr * T < 0.84) T = solve(3.62);
          dd.push({ a, vr, vy, oy, r0, T, ph: Math.random() });
        }
        const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
        const drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xdff8ff, size: 0.12, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); drops.frustumCulled = false; drops.userData.keep = true; grp.add(drops);
        // mist hanging over the basin
        const NM = 70, mp = new Float32Array(NM * 3), md = []; for (let i = 0; i < NM; i++) md.push({ a: Math.random() * PI2, r: Math.random() * 3.0, y: 0.8 + Math.random() * 2.4, sp: 0.15 + Math.random() * 0.3, ph: Math.random() * 6.28 });
        const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
        const mist = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xe8fbff, size: 0.9, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); mist.frustumCulled = false; mist.userData.keep = true; grp.add(mist);
        // ripple rings where the water lands
        const mkRip = (r, y) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.rotation.x = -PI / 2; m.position.y = y; m.userData.keep = true; grp.add(m); return m; };
        const ripples = [[mkRip(1, 0.66), 2.4], [mkRip(1, 0.66), 2.4], [mkRip(1, 0.66), 2.4], [mkRip(1, 2.6), 1.2], [mkRip(1, 2.6), 1.2]];
        solid(cx, cz, 7.2 * FOUNT_K + 0.4, 7.2 * FOUNT_K + 0.4);
        fountainFx = {
          update(t, dt) {
            for (const w of waters) w.material.uniforms.uT.value = t; sheetMat.uniforms.uT.value = t; jetMat.uniforms.uT.value = t;
            for (let i = 0; i < ND; i++) { const d = dd[i], u = (t * 0.7 + d.ph * d.T) % d.T, r = d.r0 + d.vr * u; dp[i * 3] = Math.cos(d.a) * r; dp[i * 3 + 1] = d.oy + d.vy * u - 0.5 * G * u * u; dp[i * 3 + 2] = Math.sin(d.a) * r; }
            drops.geometry.attributes.position.needsUpdate = true;
            for (let i = 0; i < NM; i++) { const m = md[i]; m.a += m.sp * dt * 0.3; mp[i * 3] = Math.cos(m.a) * m.r; mp[i * 3 + 1] = m.y + Math.sin(t * 0.5 + m.ph) * 0.3; mp[i * 3 + 2] = Math.sin(m.a) * m.r; }
            mist.geometry.attributes.position.needsUpdate = true; mist.material.opacity = 0.08 + Math.sin(t * 0.4) * 0.03;
            ripples.forEach(([r, mx], k) => { const u = (t * 0.4 + k / 3) % 1; r.scale.setScalar(0.5 + u * mx); r.material.opacity = (1 - u) * 0.4; });
          },
        };
        // benches and standing places around the larger basin
        for (let k = 0; k < 4; k++) { const al = sa + k * (PI / 2) + PI / 4, x = cx + Math.cos(al) * 3.6, z = cz + Math.sin(al) * 3.6, ry = toward(x, z, cx, cz); bench(world, x, 0, z, ry); for (const o of [-0.4, 0.4]) addPs(x + Math.cos(ry) * o, z - Math.sin(ry) * o, ry, 'sit', 'fountain'); }
        for (let k = 0; k < 4; k++) { const al = sa + k * (PI / 2) + PI / 4 + 0.5, x = cx + Math.cos(al) * 3.3, z = cz + Math.sin(al) * 3.3; addPs(x, z, toward(x, z, cx, cz), 'stand', 'fountain'); }
        pois.push({ id: 'fountain', x: cx, z: cz, r: 4.0, label: 'Air mancur', sub: 'Santai di taman' });
      }
      // ── kiosk
      {
        const { x: cx, z: cz, a: sa } = sites.kiosk, k0 = new THREE.Group(); k0.position.set(cx, 0, cz); k0.rotation.y = toward(cx, cz, 0, 0); world.add(k0);
        F.put(k0, F.rbox(3.4, 1.1, 0.9, 0.05), F.M.walnut, 0, 0.55, 0); F.put(k0, F.rbox(3.5, 0.06, 1.0, 0.02), F.M.ceramic, 0, 1.12, 0);
        for (const sx of [-1.6, 1.6]) F.put(k0, F.box(0.08, 2.4, 0.08), F.M.blackMetal, sx, 1.2, -0.4);
        F.put(k0, F.rbox(3.8, 0.12, 1.5, 0.04), pm(0xff9a6b, 0.5), 0, 2.45, 0); F.put(k0, F.box(3.2, 0.14, 0.04), glowM, 0, 2.2, 0.52, { cast: false });
        F.put(k0, F.rbox(0.5, 0.5, 0.4, 0.04), F.M.blackMetal, -1.0, 1.42, -0.1);
        solid(cx, cz, 3.2, 3.2);
        for (let k = -1; k <= 1; k++) { const x = cx - Math.cos(sa) * 2.4 + Math.cos(sa + PI / 2) * k * 1.0, z = cz - Math.sin(sa) * 2.4 + Math.sin(sa + PI / 2) * k * 1.0; addPs(x, z, toward(x, z, cx, cz), 'stand', 'kiosk'); }
        for (const k of [-1, 1]) { const x = cx - Math.cos(sa) * 3.4 + Math.cos(sa + PI / 2) * k * 1.6, z = cz - Math.sin(sa) * 3.4 + Math.sin(sa + PI / 2) * k * 1.6; place(world, F.roundTable(0.5), x, z, 0, 0.9, 0.9); for (const d of [0, PI]) { const tx = x + Math.sin(d) * 0.75, tz = z + Math.cos(d) * 0.75; place(world, F.cafeChair(), tx, tz, d); addPs(tx, tz, d + PI, 'sit', 'kiosk'); } }
        pois.push({ id: 'kiosk', x: cx, z: cz, r: 3.4, label: 'Kios kopi taman', sub: 'Ngopi bareng' });
      }
      // ── landmarks for the parts of the platform: each is a small themed building; click it (or press E) to open the page as a window
      {
        const ZNAME = { tasks: ['📋', 'Papan Tugas', 'Kanban perusahaan'], studio: ['✨', 'Bengkel Agent Studio', 'Rancang karyawan AI'], approvals: ['🛑', 'Gerbang Persetujuan', 'Keputusan menunggu'], knowledge: ['🏛️', 'Paviliun Pengetahuan', 'Perpustakaan perusahaan'], team: ['👥', 'Pohon Organisasi', 'Tim & divisi'], chat: ['💬', 'Menara Obrolan', 'Percakapan & rapat'] };
        const mkCv = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return { cv, tex, g: cv.getContext('2d') }; };
        const SITES = [['tasks', 10], ['studio', 50], ['approvals', 90], ['knowledge', 130], ['team', 210], ['chat', 250]];
        for (const [id, deg] of SITES) {
          const a = deg * DEG, R = 25.5, cx = Math.cos(a) * R, cz = Math.sin(a) * R; plazaSites.push({ x: cx, z: cz });
          const g1 = new THREE.Group(); g1.position.set(cx, 0, cz); g1.rotation.y = toward(cx, cz, 0, 0); world.add(g1);
          const an = new THREE.Group(); an.userData.keep = true; g1.add(an);
          const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.28, 24), pm(0xdfe5f7, 0.5)); base.position.y = 0.14; base.receiveShadow = true; g1.add(base);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.045, 4, 32), glowM); ring.rotation.x = PI / 2; ring.position.y = 0.3; g1.add(ring);
          if (id === 'tasks') {
            for (const sx of [-2.34, 2.34]) { const p = new THREE.Mesh(F.box(0.14, 3.6, 0.14), F.M.blackMetal); p.position.set(sx, 1.9, 0); g1.add(p); }
            const kb = mkCv(768, 420), pl = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.13), mkScreenMat(kb.tex, 0.9)); pl.position.set(0, 2.6, 0); pl.userData.keep = true; an.add(pl);
            { const km = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.35, flatShading: true }), kg = new THREE.MeshBasicMaterial({ color: 0x22d3ee, fog: false }), bw = 3.9, bh = 2.13;
              const add2 = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g1.add(m); return m; };
              add2(new THREE.BoxGeometry(bw + 0.36, bh + 0.36, 0.18), km, 0, 2.6, -0.12);
              for (const sy of [1, -1]) { add2(new THREE.BoxGeometry(bw + 0.36, 0.14, 0.26), km, 0, 2.6 + sy * (bh / 2 + 0.11), -0.04); add2(new THREE.BoxGeometry(bw, 0.03, 0.03), kg, 0, 2.6 + sy * (bh / 2 - 0.02), 0.025); }
              for (const sx of [1, -1]) { add2(new THREE.BoxGeometry(0.14, bh, 0.26), km, sx * (bw / 2 + 0.11), 2.6, -0.04); add2(new THREE.BoxGeometry(0.03, bh, 0.03), kg, sx * (bw / 2 - 0.02), 2.6, 0.025); for (const sy of [0.28, -0.28]) add2(new THREE.BoxGeometry(0.36, 0.09, 0.12), km, sx * 2.22, 2.6 + bh * sy, -0.12); }
              const ft = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 18), kg); for (const sx of [-2.34, 2.34]) { const f2 = ft.clone(); f2.rotation.x = Math.PI / 2; f2.position.set(sx, 0.33, 0); g1.add(f2); } }
            appDraws.push((emps, tasks) => { drawKanban(kb.g, 768, 420, emps, tasks); kb.tex.needsUpdate = true; });
          } else if (id === 'studio') {
            const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfe4ff, emissive: 0x6a8cff, emissiveIntensity: 0.35, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })); dome.position.y = 0.28; g1.add(dome);
            const rob = new THREE.Group(); rob.position.y = 1.0; an.add(rob);
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 8), pm(0x2b3558, 0.4)), head = new THREE.Mesh(F.rbox(0.62, 0.46, 0.46, 0.08), pm(0x11162a, 0.3)), face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), new THREE.MeshBasicMaterial({ color: 0xffd45a })); head.position.y = 0.78; face.position.set(0, 0.78, 0.24);
            for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 3, 6), pm(0x2b3558, 0.4)); arm.position.set(sx * 0.42, 0.18, 0); rob.add(arm); }
            rob.add(body, head, face);
            const scan = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 4, 28), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); scan.rotation.x = PI / 2; scan.userData.keep = true; an.add(scan);
            appFx.push((t, dt) => { rob.rotation.y += dt * 0.8; rob.position.y = 1.0 + Math.sin(t * 1.4) * 0.08; scan.position.y = 0.5 + (Math.sin(t * 1.1) * 0.5 + 0.5) * 1.3; });
          } else if (id === 'approvals') {
            for (const sx of [-1.35, 1.35]) { const p = new THREE.Mesh(F.box(0.2, 3.4, 0.24), F.M.blackMetal); p.position.set(sx, 1.7, 0); g1.add(p); }
            const lin = new THREE.Mesh(F.box(3.1, 0.32, 0.34), F.M.blackMetal); lin.position.set(0, 3.45, 0); g1.add(lin);
            const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.0), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); gate.position.set(0, 1.7, 0); gate.userData.keep = true; an.add(gate);
            const sg = mkCv(256, 96), sp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), new THREE.MeshBasicMaterial({ map: sg.tex, transparent: true, toneMapped: false, fog: false, side: THREE.DoubleSide })); sp.position.set(0, 4.15, 0); sp.userData.keep = true; an.add(sp);
            let pend = 0; appDraws.push((emps, tasks, apps) => { pend = apps.filter((x) => x.status === 'pending').length; const g = sg.g; g.clearRect(0, 0, 256, 96); g.fillStyle = 'rgba(15,22,48,0.82)'; rr(g, 4, 4, 248, 88, 18); g.fill(); g.fillStyle = pend ? '#fbbf24' : '#4ade80'; g.font = '700 40px ' + FAMILY; g.textAlign = 'center'; g.fillText(pend ? pend + ' menunggu' : 'Semua beres', 128, 62); g.textAlign = 'left'; sg.tex.needsUpdate = true; });
            appFx.push((t) => { gate.material.color.setHex(pend ? 0xfbbf24 : 0x4ade80); gate.material.opacity = 0.2 + Math.sin(t * (pend ? 3 : 1.2)) * 0.1; });
          } else if (id === 'knowledge') {
            for (let k = -1; k <= 1; k++) { const al = k * 0.95, sh = new THREE.Mesh(F.box(1.5, 2.3, 0.4), books); sh.position.set(Math.sin(al) * 1.5, 1.4, -Math.cos(al) * 1.5 + 0.2); sh.rotation.y = -al; g1.add(sh); }
            const bk = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.86), pm(0xffe3a8, 0.4, { emissive: 0xffa84a, emissiveIntensity: 1.2 })); bk.userData.keep = true; an.add(bk);
            const pgs = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.8), pm(0xffffff, 0.6)); pgs.position.y = 0.02; bk.add(pgs);
            appFx.push((t, dt) => { bk.rotation.y += dt * 0.9; bk.position.y = 1.7 + Math.sin(t * 1.5) * 0.12; bk.rotation.x = Math.sin(t * 0.8) * 0.2; });
          } else if (id === 'team') {
            const tree = new THREE.Group(); tree.position.y = 0; an.add(tree);
            const nodes = [[0, 3.6, 0], [-1.2, 2.6, 0], [0, 2.6, 0], [1.2, 2.6, 0], [-1.7, 1.6, 0], [-0.7, 1.6, 0], [0.5, 1.6, 0], [1.7, 1.6, 0]], links = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [3, 6], [3, 7]], nm = new THREE.MeshBasicMaterial({ color: 0xffd166 });
            nodes.forEach((p, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(i ? 0.2 : 0.3, 10, 8), i ? new THREE.MeshBasicMaterial({ color: [0x5b8cff, 0x34d399, 0xec4899, 0xa78bfa][i % 4] }) : nm); m.position.set(...p); tree.add(m); });
            const pts = []; for (const [x, y] of links) pts.push(new THREE.Vector3(...nodes[x]), new THREE.Vector3(...nodes[y]));
            tree.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.8 })));
            const post = new THREE.Mesh(F.cyl(0.12, 0.2, 1.2, 8), pm(0x2b3558, 0.4)); post.position.y = 0.9; g1.add(post);
            appFx.push((t, dt) => { tree.rotation.y += dt * 0.5; tree.position.y = Math.sin(t * 1.2) * 0.06; });
          } else if (id === 'chat') {
            const col = new THREE.Mesh(F.cyl(0.18, 0.26, 2.4, 8), pm(0x2b3558, 0.4)); col.position.y = 1.4; g1.add(col);
            const bub = []; [[0xff8fb8, 0.9, 0.55, 0], [0x8fd0ff, 1.15, 0.6, 2.1], [0xffd166, 0.8, 0.5, 4.2], [0x34d399, 1.0, 0.55, 5.3]].forEach(([c, w, h, ph], i) => { const m = new THREE.Mesh(F.rbox(w, h, 0.3, 0.12), new THREE.MeshBasicMaterial({ color: c })); m.userData.ph = ph; m.userData.i = i; an.add(m); bub.push(m); });
            appFx.push((t) => { for (const m of bub) { const ph = m.userData.ph, r = 1.3 + (m.userData.i % 2) * 0.3; m.position.set(Math.sin(t * 0.6 + ph) * r, 2.2 + m.userData.i * 0.45 + Math.sin(t * 1.3 + ph) * 0.15, Math.cos(t * 0.6 + ph) * r); m.rotation.y = t * 0.6 + ph; } });
          }
          const z = ZNAME[id]; const lb = textSprite([z[0] + ' ' + z[1]], { size: 24, scale: 0.0105 }); lb.position.set(0, id === 'approvals' ? 5.2 : id === 'tasks' ? 4.9 : 4.2, 0); g1.add(lb);
          const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2.5; hit.userData = { app: id, keep: true }; g1.add(hit); pickables.push(hit);
          pois.push({ id: 'app:' + id, x: cx, z: cz, r: 3.4, label: z[1], sub: 'E: buka di kantor' });
          solid(cx, cz, 2.6, 2.6);
        }
      }
      // ── gathering points: around the Company Brain, and a patrol loop at the plaza entrances
      // six benches on a neat ring around the Brain, all facing it; standing places on a wider ring behind them, between the benches
      for (let k = 0; k < 6; k++) { const al = (k / 6) * PI2 + PI / 6, x = Math.cos(al) * 8.2, z = Math.sin(al) * 8.2, ry = yawTo(-x, -z); bench(world, x, 0, z, ry); for (const o of [-0.4, 0.4]) addPs(x + Math.cos(ry) * o, z - Math.sin(ry) * o, ry, 'sit', 'brain'); }
      for (let k = 0; k < 6; k++) { const al = (k / 6) * PI2, x = Math.cos(al) * 7.6, z = Math.sin(al) * 7.6; addPs(x, z, yawTo(-x, -z), 'stand', 'brain'); }
      for (let i = 0; i < gaps.length; i++) { const al = gaps[i], x = Math.cos(al) * (plazaR - 2), z = Math.sin(al) * (plazaR - 2); addPs(x, z, yawTo(x, z), 'stand', 'patrol'); }
      // ── profession corners: content creator set, wellness lawn, pitch booth, maker & lab bench
      {
        const zone = (deg) => { const q = site(deg); return { ...q, th: toward(q.x, q.z, 0, 0) }; };
        const loc = (c, lx, lz) => [c.x + lx * Math.cos(c.th) + lz * Math.sin(c.th), c.z - lx * Math.sin(c.th) + lz * Math.cos(c.th)];
        const grp = (c) => { const g0 = new THREE.Group(); g0.position.set(c.x, 0, c.z); g0.rotation.y = c.th; world.add(g0); return g0; };
        const disc = (g0, r, col, h = 0.1) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, h, 24), pm(col, 0.7)); d.position.y = h / 2; d.receiveShadow = true; g0.add(d); const rg = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 4, 32), glowM); rg.rotation.x = PI / 2; rg.position.y = h + 0.01; g0.add(rg); };
        { // content creator corner
          const c = zone(10), g0 = grp(c); disc(g0, 2.9, 0xe9d5ff);
          const bd = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.8, 20, 1, true, PI - 0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0xff8fb8, emissive: 0xff5c9a, emissiveIntensity: 0.5, side: THREE.DoubleSide, flatShading: true })); { const sc2 = mkScreenTex(1024, 440); screens.feed = sc2; bd.material = mkScreenMat(sc2.tex, 0.85); } bd.position.y = 1.4; bd.userData.keep = true; g0.add(bd); addCurvedFrame(g0, { R: 2.6, H: 2.8, t0: PI - 0.9, tl: 1.8, pos: [0, 1.4, 0], glow: 0xe879f9 });
          const cam = F.camera(); cam.position.set(0, 0, 1.9); cam.rotation.y = PI; g0.add(cam);
          for (const sx of [-1.5, 1.5]) { const rl = F.ringLight(); rl.position.set(sx, 0, 1.2); rl.rotation.y = PI; g0.add(rl); }
          const rec = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); rec.userData.keep = true; rec.position.set(0.12, 1.55, 1.9); g0.add(rec); floaters.push({ kind: 'rec', m: rec });
          { const [x, z] = loc(c, 0, -0.6); addPs(x, z, c.th, 'stand', 'content'); } { const [x, z] = loc(c, 1.3, 2.4); addPs(x, z, c.th + PI, 'stand', 'content'); }
          pois.push({ id: 'content', x: c.x, z: c.z, r: 3.4, label: 'Sudut konten kreator', sub: 'Rekam konten di sini' });
        }
        { // wellness lawn
          const c = zone(90), g0 = grp(c); disc(g0, 3.5, 0x8fd9a8, 0.08);
          for (let k = -1; k <= 1; k++) { const mt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 1.8), pm([0xff9ecd, 0x9ec5ff, 0xffe08f][k + 1], 0.8)); mt.position.set(k * 1.1, 0.1, 0); g0.add(mt); const [x, z] = loc(c, k * 1.1, 0); addPs(x, z, c.th, 'stand', 'wellness'); }
          for (const sx of [-3.0, 3.0]) { const pl = F.plant(0.9, 1); pl.position.set(sx, 0, -1.2); g0.add(pl); }
          pois.push({ id: 'wellness', x: c.x, z: c.z, r: 3.6, label: 'Taman peregangan', sub: 'Yoga & napas sejenak' });
        }
        { // pitch booth
          const c = zone(188), g0 = grp(c);
          F.put(g0, F.rbox(3, 1.05, 0.9, 0.05), F.M.walnut, 0, 0.52, 0); F.put(g0, F.rbox(3.1, 0.05, 1, 0.02), F.M.ceramic, 0, 1.08, 0);
          for (const sx of [-1.45, 1.45]) F.put(g0, F.box(0.07, 2.5, 0.07), F.M.blackMetal, sx, 1.25, -0.4);
          for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 1.7), pm(k % 2 ? 0xffffff : 0xff6b6b, 0.6)); st.position.set(-1.3 + k * 0.52, 2.5 - 0.06, 0.15); st.rotation.x = 0.22; g0.add(st); }
          F.put(g0, F.box(2.4, 0.3, 0.04), glowM, 0, 2.05, 0.55, { cast: false });
          solid(c.x, c.z, 2.2, 2.2);
          { const [x, z] = loc(c, 0, -1.6); addPs(x, z, c.th, 'stand', 'pitch'); } for (const sx of [-0.9, 0.9]) { const [x, z] = loc(c, sx, 2.4); addPs(x, z, c.th + PI, 'stand', 'pitch'); }
          pois.push({ id: 'pitch', x: c.x, z: c.z, r: 3.4, label: 'Booth penawaran', sub: 'Pitch & demo produk' });
        }
        { // maker & lab bench
          const c = zone(250), g0 = grp(c); disc(g0, 3.4, 0xe3e9f7);
          const dt = F.draftTable(); dt.position.set(-1.4, 0, 0); g0.add(dt); const lb = F.labBench(2); lb.position.set(1.5, 0, 0); g0.add(lb);
          { const [x, z] = loc(c, -1.4, 0); solid(x, z, 1.6, 1.6); } { const [x, z] = loc(c, 1.5, 0); solid(x, z, 2.2, 2.2); }
          for (const sx of [-1.9, -0.9]) { const [x, z] = loc(c, sx, 2.3); addPs(x, z, c.th + PI, 'stand', 'sketch'); } for (const sx of [1.0, 2.0]) { const [x, z] = loc(c, sx, 2.4); addPs(x, z, c.th + PI, 'stand', 'demo'); }
          pois.push({ id: 'maker', x: c.x, z: c.z, r: 3.6, label: 'Meja kreatif & lab', sub: 'Sketsa dan eksperimen' });
        }
      }
      // ── things that float: lanterns, planted islands, patrol drones and holo boards that show live figures
      {
        const lanM = std2({ color: 0xffe3b0, emissive: 0xffa84a, emissiveIntensity: 1.6 });
        for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), lanM); m.userData.keep = true; world.add(m); floaters.push({ kind: 'lantern', m, r: 8 + (i % 4) * 4.5, a: (i / 4) * PI2, h: 6.5 + (i % 4) * 1.6, sp: (i % 2 ? 1 : -1) * (0.025 + (i % 3) * 0.01), ph: i }); }
        [30, 150, 230].forEach((deg, i) => {
          const g1 = new THREE.Group(); g1.userData.keep = true;
          const dsc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.8, 0.3, 14), pm(0xe8ecf8, 0.5)); const rg = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.04, 4, 20), glowM); rg.rotation.x = PI / 2; rg.position.y = 0.16; const pl = F.plant(0.7, i % 3); pl.position.y = 0.15; g1.add(dsc, rg, pl); g1.scale.setScalar(0.5); world.add(g1);
          floaters.push({ kind: 'island', m: g1, r: 17.5, a: deg * DEG, h: 3.4 + (i % 3) * 2.2, sp: 0, ph: i * 1.7 });
        });
        for (let i = 0; i < 2; i++) {
          const d = new THREE.Group(); d.userData.keep = true; const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), pm(0xf1f4fb, 0.4, { metalness: 0.4 })); d.add(body);
          const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x5bf0a0 : 0x5bb7ff })); led.position.y = -0.14; d.add(led);
          const rot = []; for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), pm(0x2b3558, 0.5)); r.position.set(sx * 0.38, 0.12, sz * 0.38); d.add(r); rot.push(r); }
          world.add(d); floaters.push({ kind: 'drone', m: d, led, rot, r: 26 + i * 3, a: (i / 2) * PI2, h: 11 + (i % 3) * 3, sp: (i % 2 ? 1 : -1) * (0.07 + i * 0.012), ph: i });
        }
        for (let i = 0; i < 3; i++) {
          const cv = document.createElement('canvas'); cv.width = 768; cv.height = 432; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.52), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.userData.keep = true; m.userData.holo = i; pickables.push(m); world.add(m);
          floaters.push({ kind: 'holo', m, cv, tex, page: i, r: 11.5, a: (i / 3) * PI2 + 0.5, h: 5.2, sp: 0.016, ph: i * 2 });
        }
      }
    }
    // ── lawn: tiling grass texture + instanced tufts and flowers, so the ground has pattern, variety and life
    {
      const rnd = (() => { let sd = 7; return () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646; })();
      const T = 256, cv = document.createElement('canvas'); cv.width = cv.height = T; const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, '#5fc864'); gr.addColorStop(0.5, '#4bb558'); gr.addColorStop(1, '#6bd06a'); g.fillStyle = gr; g.fillRect(0, 0, T, T);
      for (let i = 0; i < 900; i++) { const x = rnd() * T, y = rnd() * T, h = 8 + rnd() * 16, a = (rnd() - 0.5) * 0.9; g.strokeStyle = ['#3d9f4d', '#7fdc6c', '#9be873', '#2f8f45', '#58c45c', '#b7ee7a'][(rnd() * 6) | 0]; g.globalAlpha = 0.35 + rnd() * 0.5; g.lineWidth = 1 + rnd() * 1.6; for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.sin(a) * h, y + oy - Math.cos(a) * h); g.stroke(); } }
      g.globalAlpha = 1; for (let i = 0; i < 26; i++) { g.fillStyle = ['#fff7e0', '#ffe27a', '#ffb3d1', '#c9b6ff'][(rnd() * 4) | 0]; const x = rnd() * T, y = rnd() * T; g.beginPath(); g.arc(x, y, 1.2 + rnd() * 1.4, 0, 7); g.fill(); }
      const grassTex = new THREE.CanvasTexture(cv); grassTex.colorSpace = THREE.SRGBColorSpace; grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(plazaR / 1.6, plazaR / 1.6); grassTex.anisotropy = 4;
      plaza.material = std2({ color: 0xffffff, map: grassTex, roughness: 0.95 });
      // tufts: three crossed tapered blades, dark at the root and light at the tip, swaying in the wind
      const bl = [], col = []; const B = (ang, w, h) => { const c = Math.cos(ang), sn = Math.sin(ang); const pts = [[-w, 0, 0], [w, 0, 0], [w * 0.2, h, 0.04]]; for (const [x, y, z] of pts) { bl.push(x * c - z * sn, y, x * sn + z * c); const t = y / h; col.push(0.25 + t * 0.75, 0.55 + t * 0.45, 0.2 + t * 0.3); } };
      for (let k = 0; k < 3; k++) B((k * Math.PI) / 3, 0.045, 0.16 + k * 0.03);   /* short, fine blades (was 0.07 x 0.4-0.56) */
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(bl, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
      const tm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
      tm.onBeforeCompile = (sh) => { sh.uniforms.uT = grassU = { value: 0 }; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uT * 1.7 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5) * position.y * 0.22; transformed.z += cos(uT * 1.3 + instanceMatrix[3].z * 0.6) * position.y * 0.12;'); };
      const NT = 5200, tufts = new THREE.InstancedMesh(tg, tm, NT), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 5, 4), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 520);
      const exc = pois.map((p) => ({ x: p.x, z: p.z, r: Math.max(p.r || 3, 3.6) + 1.2 })).filter((p) => Math.hypot(p.x, p.z) < plazaR + 4); exc.push({ x: 0, z: 0, r: 7.8 }); for (const dk of decks) exc.push({ x: dk.cx, z: dk.cz, r: dk.R1 + 0.4 });
      const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
      // ── rolling hills: soft round mounds on the open lawn (not a flat disc). They keep clear of every site, bench, gate path and tree, so nothing else has to move;
      // the flat lawn below stays as it was and the mounds simply rise through it. Grass follows them, the player walks over them.
      {
        const hills = [], trees = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2, rr = plazaR - 4 - (i % 2) * 3; trees.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr }); }
        const hr = (() => { let sd = 91; return () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646; })();
        for (let tries = 0; tries < 1500 && hills.length < 12; tries++) {
          const a = hr() * Math.PI * 2, r = plazaR * (0.3 + hr() * 0.62), rm = 3 + hr() * 2.6, hm = 0.4 + hr() * 0.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (r + rm > plazaR - 0.5) continue;
          if (exc.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + rm * 0.7)) continue;
          if (trees.some((q) => Math.hypot(q.x - x, q.z - z) < rm + 2.2)) continue;
          if (gaps.some((g) => { const al = x * Math.cos(g) + z * Math.sin(g), pp = Math.abs(x * Math.sin(g) - z * Math.cos(g)); return al > plazaR * 0.55 && pp < rm * 0.6 + 1.8; })) continue;
          if (hills.some((q) => Math.hypot(q.x - x, q.z - z) < (q.rm + rm) * 0.85)) continue;
          hills.push({ x, z, rm, hm });
        }
        terrainR = plazaR; window.__hills = { n: hills.length, plazaR, exc: exc.length, gaps: gaps.length };
        terrainH = (x, z) => { let h = 0; for (const q of hills) { const d2 = ((x - q.x) ** 2 + (z - q.z) ** 2) / (q.rm * q.rm); if (d2 < 1) { const k = 1 - d2; h += q.hm * k * k * (3 - 2 * k) ; } } return h; };
        if (hills.length) {
          const tg = new THREE.RingGeometry(0.01, plazaR - 0.05, 96, 44); tg.rotateX(-Math.PI / 2); const pa = tg.attributes.position;
          for (let i = 0; i < pa.count; i++) pa.setY(i, terrainH(pa.getX(i), pa.getZ(i)));
          tg.computeVertexNormals(); const tm2 = new THREE.Mesh(tg, plaza.material); tm2.receiveShadow = true; tm2.castShadow = false; world.add(tm2);
        }
      }
      let nt = 0, nf = 0;
      for (let tries = 0; tries < 16000 && nt < NT; tries++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (plazaR - 1.2), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (exc.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r)) continue;
        const sc = 0.6 + rnd() * 0.5; qq.setFromAxisAngle(up, rnd() * 6.28); tufts.setMatrixAt(nt, m4.compose(pp.set(x, 0.05 + terrainH(x, z), z), qq, ss.set(sc, sc * (0.8 + rnd() * 0.4), sc)));
        tufts.setColorAt(nt, cc.setHSL(0.27 + rnd() * 0.08, 0.5 + rnd() * 0.3, 0.55 + rnd() * 0.2)); nt++;
        if (nf < 520 && rnd() < 0.12) { fl.setMatrixAt(nf, m4.compose(pp.set(x + (rnd() - 0.5) * 0.3, 0.18 + rnd() * 0.06 + terrainH(x, z), z + (rnd() - 0.5) * 0.3), qq.identity(), ss.set(1, 1, 1))); fl.setColorAt(nf, cc.set(['#fff3c4', '#ffd166', '#ff9ec7', '#c7b3ff', '#ffffff'][(rnd() * 5) | 0])); nf++; }
      }
      tufts.count = nt; fl.count = nf; tufts.userData.full = nt; fl.userData.full = nf; tufts.instanceMatrix.needsUpdate = fl.instanceMatrix.needsUpdate = true; if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true; if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
      tufts.receiveShadow = true; tufts.frustumCulled = false; fl.frustumCulled = false; world.add(tufts, fl); grassMeshes = [tufts, fl];
    }
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2, rr = plazaR - 4 - (i % 2) * 3; if (plazaSites.some((q) => Math.hypot(q.x - Math.cos(a) * rr, q.z - Math.sin(a) * rr) < 8.5)) continue; place(world, F.tree(0.75 + (i % 3) * 0.12, i), Math.cos(a) * rr, Math.sin(a) * rr, i); }
    freeSpots();
    // dome over the whole station, with twelve anchor pylons
    domeR = RO + 14; domeH = 84;
    domeG = new THREE.Group(); domeG.userData.keep = true; domeG.position.set(0, -0.05, 0); world.add(domeG);
    const dgeo = new THREE.SphereGeometry(1, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2); dgeo.scale(domeR, domeH, domeR);
    const glass = new THREE.Mesh(dgeo, new THREE.MeshStandardMaterial({ color: 0xcfe4ff, emissive: 0x5a7fd0, emissiveIntensity: 0.3, transparent: true, opacity: 0.2, side: THREE.FrontSide, depthWrite: false, flatShading: true, roughness: 0.1, metalness: 0.2 }));
    glass.renderOrder = 4; glass.castShadow = false; glass.receiveShadow = false; glass.frustumCulled = false; domeG.add(glass);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(dgeo, 8), new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.7, fog: false })); edges.frustumCulled = false; domeG.add(edges);
    const drim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 48), glowM); drim.rotation.x = Math.PI / 2; drim.scale.set(domeR, domeR, 34); drim.position.y = 0.1; domeG.add(drim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const m = new THREE.Mesh(F.cyl(0.9, 1.6, 9, 6), postM); m.position.set(Math.cos(a) * (domeR + 0.4), 4.5, Math.sin(a) * (domeR + 0.4)); m.castShadow = true; domeG.add(m); const l = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glowM); l.position.set(m.position.x, 4.9, m.position.z); domeG.add(l); }
    camBound = RO + 60;
    const half = RO + 14;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 300 });
    sun.target.position.set(0, 0, 0); sun.position.set(-80, 70, 50);
    sun.shadow.camera.updateProjectionMatrix();
    life = buildLife({ world, center: { x: 0, z: 0 }, R: RO + 10, renderer, camera });
    env = buildSpace({ F, world, center: { x: 0, z: 0 }, half: { x: RO + 4, z: RO + 4 } });
    envWalk = env.walk || null;
    env.setDusk(document.documentElement.dataset.theme === 'light' ? 0 : 1);
    setTimeout(() => { applySun(); applyVisual(); }, 0);
    bounds = new THREE.Box3(new THREE.Vector3(-RO - 10, 0, -RO - 10), new THREE.Vector3(RO + 10, 3, RO + 10));
    setFloor(0);
    fitCamera(true);
  }

  /** Desk places on concentric arcs around the pod centre, the entrance kept clear. Outer ring faces the glass, the next faces the centre. */
  function ringSlots(n, tight = false) {
    const out = [], GA = 0.9, span = Math.PI * 2 - 2 * GA, radii = tight ? [5.2, 3.5, 1.9] : [7.5, 5.2, 3.0];
    let left = n;
    for (let ring = 0; ring < 3 && left > 0; ring++) {
      const rho = radii[ring], cap = Math.max(1, Math.floor((span * rho) / 1.7)), cnt = Math.min(left, ring === 2 ? left : cap);
      const rr = ring === 0 && cnt * 1.7 < span * rho ? Math.max(3.6, Math.min(rho, (cnt * 1.8) / span)) : rho;
      for (let i = 0; i < cnt; i++) { const al = GA + ((i + 0.5) / cnt) * span; out.push({ x: Math.sin(al) * rr, z: Math.cos(al) * rr, ry: ring % 2 ? al : al + Math.PI }); }
      left -= cnt;
    }
    return out;
  }
  function buildRoom(r) {
    const g = r.group; const { cx, cz, side, zc } = r;
    const Z = (t) => zc + side * (CORR / 2 + t); // t: 0 at the corridor glass → RD at the back wall
    const floorMat = { office: F.M.floor.office, exec: F.M.floor.exec, lab: F.M.floor.vinyl, servers: F.M.floor.vinyl, factory: F.M.floor.epoxy, warehouse: F.M.floor.epoxy, studio: F.M.floor.office, creative: F.M.floor.exec, conference: F.M.floor.carpet, library: F.M.floor.exec, cafe: F.M.floor.terrazzo, play: F.M.floor.carpet, lounge: F.M.floor.exec }[r.variant || r.kind] || F.M.floor.office;
    const fl = add(new THREE.Mesh(r.round ? new THREE.CylinderGeometry(8.7, 8.7, 0.03, 28) : box(RW - 0.15, 0.03, RD - 0.1), floorMat), cx, 0.015, cz, g, { cast: false, receive: true });
    fl.userData = { room: r.id }; pickables.push(fl);
    // partitions: plaster side walls with baseboard + soft AO on the floor; back wall plaster (or curtain wall if exterior)
    if (!r.round) for (const sx of [-1, 1]) {
      wall(new THREE.Mesh(box(0.14, WALL_H, RD), F.M.plaster), cx + sx * RW / 2, WALL_H / 2, cz, g, { cast: false, receive: true });
      add(new THREE.Mesh(box(0.16, 0.1, RD), F.M.base), cx + sx * RW / 2, 0.05, cz, g, { cast: false });
      const ao = add(new THREE.Mesh(new THREE.PlaneGeometry(RD, 0.6), F.M.wallAO), cx + sx * (RW / 2 - 0.37), 0.02, cz, g, { cast: false }); ao.rotation.set(-Math.PI / 2, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2); ao.renderOrder = 1;
      solid(cx + sx * RW / 2, cz, 0.25, RD);
    }
    if (!r.exterior) { wall(new THREE.Mesh(box(RW, WALL_H, 0.14), F.M.plasterWarm), cx, WALL_H / 2, Z(RD), g, { cast: false, receive: true }); add(new THREE.Mesh(box(RW, 0.1, 0.16), F.M.base), cx, 0.05, Z(RD) - side * 0.01, g, { cast: false }); solid(cx, Z(RD), RW, 0.25); }
    const aoB = r.round ? { rotation: { set() {} }, renderOrder: 0 } : add(new THREE.Mesh(new THREE.PlaneGeometry(RW, 0.6), F.M.wallAO), cx, 0.02, Z(RD - 0.37), g, { cast: false }); aoB.rotation.set(-Math.PI / 2, 0, side > 0 ? 0 : Math.PI); aoB.renderOrder = 1;
    // corridor façade: framed glass with a 1.8 m doorway
    const fz = Z(0); const seg = (RW - 1.8) / 2;
    if (!r.round) {
    // doorway: posts and lintel, with two doors standing open into the room
    for (const sx of [-1, 1]) { wall(new THREE.Mesh(box(0.09, 2.14, 0.14), F.M.frame), cx + sx * 0.9, 1.07, fz, g, { cast: false }); const leaf = add(new THREE.Mesh(box(0.84, 2.05, 0.04), F.M.walnut), cx + sx * (0.9 + 0.02), 1.03, fz + side * 0.42, g, { cast: false }); leaf.rotation.y = Math.PI / 2; }
    wall(new THREE.Mesh(box(1.98, 0.1, 0.14), F.M.frame), cx, 2.19, fz, g, { cast: false });
    for (const sx of [-1, 1]) {
      wall(new THREE.Mesh(box(seg, WALL_H, 0.04), F.M.glass), cx + sx * (0.9 + seg / 2), WALL_H / 2, fz, g, { cast: false });
      for (let k = 0; k <= 3; k++) wall(new THREE.Mesh(box(0.05, WALL_H, 0.07), F.M.frame), cx + sx * (0.9 + (k * seg) / 3), WALL_H / 2, fz, g, { cast: false });
      add(new THREE.Mesh(box(seg, 0.05, 0.07), F.M.frame), cx + sx * (0.9 + seg / 2), 0.03, fz, g, { cast: false });
      solid(cx + sx * (0.9 + seg / 2), fz, seg, 0.15);
    }
    add(new THREE.Mesh(box(RW, 0.09, 0.09), F.M.frame), cx, WALL_H, fz, g, { cast: false });
    }
    // painted floor title near the entrance + glowing name on the back wall
    const title = r.kind === 'work' ? `${r.div.name.toUpperCase()}` : r.kind === 'private' ? 'EXECUTIVE OFFICE' : r.name.toUpperCase();
    const ft = floorText(title, RW * 0.7, { color: 'rgba(90,100,160,0.18)' }); ft.position.set(cx, 0.035, Z(0.8)); g.add(ft);
    const accent = r.div ? r.div.color : '#d8c3a5';
    if (r.round) {
      // every pod gets its own floor pattern: a tinted centre disc and two light rings in the division colour
      const tint = new THREE.Color(accent), soft = tint.clone().lerp(new THREE.Color(0xffffff), 0.5);
      const cd = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.012, 24), new THREE.MeshStandardMaterial({ color: soft, roughness: 0.8, flatShading: true })); cd.position.set(cx, 0.06, cz); cd.receiveShadow = true; g.add(cd);
      for (const rr of [3.3, 8.35]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 3, 32), new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.9, flatShading: true })); rg.rotation.x = Math.PI / 2; rg.scale.set(rr, rr, 22); rg.position.set(cx, 0.09, cz); g.add(rg); }
    }
    add(new THREE.Mesh(box(RW - 0.5, 0.015, 0.1), cmat(accent)), cx, 0.035, Z(0.14), g, { cast: false });
    if (!r.exterior) { const wt = wallText(title, Math.min(6, RW * 0.5), accent); wt.position.set(cx, 2.05, Z(RD) - side * 0.08); wt.rotation.y = side > 0 ? Math.PI : 0; g.add(wt); }
    clampFn = r.round ? (x, z) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); return d > 7.8 ? [cx + (dx * 7.8) / d, cz + (dz * 7.8) / d] : [x, z]; } : null;
    const spot = (x0, z0, face, pose = 'stand', tag = '', seatY) => { const [x, z] = clampFn ? clampFn(x0, z0) : [x0, z0]; return r.spots.push({ p: new THREE.Vector3(x, 0, z), face, pose, tag, seatY, key: `${r.id}:${r.spots.length}` }); };
    const back = Z(RD - 0.45);
    const faceBack = side > 0 ? 0 : Math.PI, faceFront = side > 0 ? Math.PI : 0;
    const wallFace = side > 0 ? Math.PI : 0; // rotation for objects hung on the back wall facing into the room
    // décor shared by all rooms
    plant(cx - RW / 2 + 0.7, back, 1.2, g, 2); plant(cx + RW / 2 - 0.7, Z(0.9), 0.9, g);
    if (!r.exterior) { const art = F.wallArt(1.3, 0.85); art.position.set(cx - RW / 2 + 2.6, 1.55, Z(RD) - side * 0.09); art.rotation.y = wallFace; g.add(art); }
    if (!r.round) { const clk = F.clock(); clk.position.set(cx + RW / 2 - 0.09, 2.05, cz); clk.rotation.y = -Math.PI / 2; g.add(clk); }

    const ang = (a, rho) => [cx + Math.sin(a) * rho, cz + Math.cos(a) * rho]; // a = 0 is the entrance, PI the far side
    const inward = (a) => a + Math.PI; // rotation that makes an object look at the centre
    /** a flat screen on a stand: 10 cm frame, real thickness, feet on the floor */
    const mkDisplay = (w, h) => {
      const d = new THREE.Group(), cy = h / 2 + 0.5;
      F.put(d, F.rbox(w + 0.12, h + 0.12, 0.1, 0.015), F.M.blackMetal, 0, cy, 0);
      const scr = F.put(d, new THREE.PlaneGeometry(w, h), cmat(0x1b2a3a), 0, cy, 0.056, { cast: false }); scr.userData.keep = true;
      F.put(d, F.box(0.1, cy - 0.3, 0.07), F.M.steel, 0, (cy - 0.3) / 2 + 0.05, -0.02); F.put(d, F.box(Math.min(1.4, w * 0.5), 0.05, 0.5), F.M.blackMetal, 0, 0.025, 0);
      return { group: d, screen: scr };
    };
    /** whiteboard on a rolling frame: aluminium rim 4 cm thick, marker tray, two posts, base feet */
    const mkBoard = (w, h, map) => {
      const b = new THREE.Group(), cy = h / 2 + 0.62;
      F.put(b, F.box(w + 0.1, h + 0.1, 0.04), F.M.steel, 0, cy, 0);
      const face = F.put(b, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }), 0, cy, 0.024, { cast: false }); face.userData.keep = true;
      F.put(b, F.box(w * 0.9, 0.04, 0.1), F.M.steel, 0, cy - h / 2 - 0.04, 0.06);
      for (const sx of [-1, 1]) { F.put(b, F.box(0.05, cy + h / 2, 0.05), F.M.steel, sx * (w / 2 + 0.02), (cy + h / 2) / 2 - 0.02, -0.04); F.put(b, F.box(0.05, 0.05, 0.55), F.M.steel, sx * (w / 2 + 0.02), 0.06, -0.04); }
      return { group: b, face };
    };
    if (r.kind === 'work' || r.kind === 'private') {
      const v = r.variant;
      const deskFront = v === 'office' || v === 'creative' || v === 'servers' || v === 'exec';
      r.deskSlots = (n) => {
        if (r.round) return ringSlots(n, ['lab', 'factory', 'warehouse', 'studio', 'servers'].includes(v));
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
      const PI = Math.PI, ring = (rho, col = 0xf2c14e) => add(new THREE.Mesh(new THREE.RingGeometry(rho, rho + 0.08, 56), new THREE.MeshBasicMaterial({ color: col })), cx, 0.035, cz, g, { cast: false }).rotateX(-PI / 2);
      const wb = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f4f6fb'; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      if (v === 'exec') {
        place(g, F.rug(6, 4, 0x6d5a48), cx, cz, 0);
        for (let k = -1; k <= 1; k++) { const a = PI + k * 0.34, [x, z] = ang(a, 7.7); place(g, F.bookshelf(1.5, 2.1, 0.38, books), x, z, inward(a), 1.6, 0.5); }
        { const a = PI + 1.75, [x, z] = ang(a, 7.0), [tx, tz] = ang(a, 5.7); place(g, fit(F.sofa(2.2, F.M.leather)), x, z, inward(a), 2.2, 1); place(g, fit(F.coffeeTable()), tx, tz, inward(a), 1.2, 0.6); }
      }
      if (v === 'office') {
        // kanban on a rolling board (live sticky notes) + a huddle table in the middle
        { const bd = mkBoard(2.6, 1.5, wb()); bd.group.position.set(0, 0, -7.5); bd.group.rotation.y = 0; g.add(bd.group); solid(0, -7.5, 2.8, 0.7); r.board = { x: -0.2, z: -7.5, notes: [], side: -1 }; }
        place(g, F.rug(4, 4, 0x7a6a5a), cx, cz, 0);
        place(g, fit(F.roundTable(0.55)), cx, cz, 0, 1.1, 1.1);
        for (const a of [0, 2.1, 4.2]) { const hx = cx + Math.sin(a) * 0.85 * FS, hz = cz + Math.cos(a) * 0.85 * FS; place(g, fit(F.cafeChair()), hx, hz, a); spot(hx, hz, a + PI, 'sit', 'huddle'); }
      }
      if (v === 'creative') {
        for (let k = 0; k < 2; k++) place(g, fit(F.draftTable()), cx + (k ? 1.4 : -1.4), cz, 0, 1.3, 1);
        { const bd = mkBoard(3, 1.5, wb()); bd.group.position.set(0, 0, -7.5); g.add(bd.group); solid(0, -7.5, 3.2, 0.7); }
      }
      if (v === 'servers') {
        for (let k = 0; k < 9; k++) {
          const a = PI + (k - 4) * 0.115, [x, z] = ang(a, 7.6), rk = new THREE.Group(); rk.add(F.serverRack());
          for (let l = 0; l < 6; l++) { const led = add(new THREE.Mesh(box(0.05, 0.025, 0.01), new THREE.MeshBasicMaterial({ color: l % 3 ? 0x3ddc84 : 0x5b8cff })), -0.18 + (l % 3) * 0.12, 0.6 + Math.floor(l / 3) * 0.7, 0.46, rk, { cast: false }); led.userData.keep = true; blinkers.push(led); }
          place(g, rk, x, z, inward(a), 0.6, 0.9);
        }
        { const [x, z] = ang(PI, 6.2); spot(x, z, PI, 'stand', 'work'); }
        ring(4.7, 0x5b8cff);
      }
      if (v === 'lab') {
        for (const d of [-0.62, 0.62]) { const a = PI + d, [x, z] = ang(a, 6.9); place(g, fit(F.labBench(3)), x, z, inward(a), 3, 0.8); const [sx, sz] = ang(a, 5.8); spot(sx, sz, a, 'stand', 'work'); }
        for (const d of [-1.5, 1.5]) { const a = PI + d, [x, z] = ang(a, 7.7); place(g, F.fumeHood(), x, z, inward(a), 1.4, 0.8); }
        { const [x, z] = ang(PI, 7.7); place(g, F.displayShelf(1.8), x, z, inward(PI), 1.8, 0.5); }
        ring(4.5, 0x5bd1c9);
      }
      if (v === 'factory') {
        for (const d of [-1.05, -0.8]) { const a = PI + d, [x, z] = ang(a, 7.2); place(g, F.mixTank(), x, z, 0, 1.4, 1.4); }
        { const [x, z] = ang(PI, 6.2); place(g, F.conveyor(4), x, z, 0, 4, 0.7); const [fx, fz] = ang(PI + 0.55, 6.9); place(g, F.filler(), fx, fz, inward(PI + 0.55), 1, 0.9); }
        for (const [d, rho] of [[1.0, 7.0], [1.3, 6.9]]) { const a = PI + d, [x, z] = ang(a, rho); place(g, F.pallet(d < 1.1), x, z, inward(a), 1.2, 1); }
        { const [x, z] = ang(PI, 5.0); spot(x, z, PI, 'stand', 'work'); const [x2, z2] = ang(PI - 0.9, 6.0); spot(x2, z2, PI - 0.9, 'stand', 'work'); }
        ring(4.3);
      }
      if (v === 'warehouse') {
        for (const d of [-0.85, 0, 0.85]) { const a = PI + d, [x, z] = ang(a, 7.4); place(g, F.rack(2.8), x, z, inward(a), 2.8, 1); }
        for (let k = 0; k < 3; k++) { const a = PI + (k - 1) * 0.7, [x, z] = ang(a, 5.8); place(g, F.pallet(k !== 1), x, z, inward(a), 1.2, 1); }
        { const [x, z] = ang(PI + 0.38, 6.4); spot(x, z, PI + 0.38, 'stand', 'work'); }
        ring(4.3);
      }
      if (v === 'studio') {
        { const [x, z] = ang(PI, 7.9); place(g, F.displayShelf(2.4), x, z, inward(PI), 2.4, 0.5); }
        { const [x, z] = ang(PI, 6.3); place(g, fit(F.roundTable(0.5)), x, z, 0, 1, 1); const [px, pz] = ang(PI, 7.1); spot(px, pz, 0, 'stand', 'live'); }
        place(g, F.camera(), 0, -3.4, PI); place(g, F.ringLight(), -1.6, -3.8, PI); place(g, F.ringLight(), 1.6, -3.8, PI);
      }
      // corner planters flanking the entrance and the far wall
      for (const [a, rho] of [[0.95, 7.3], [-0.95, 7.3], [PI - 1.2, 7.5], [PI + 1.2, 7.5]]) { const [x, z] = ang(a, rho); plant(x, z, 1.1, g, 1); }
      if (['office', 'exec', 'creative', 'studio'].includes(v)) { const hue = (parseInt((r.div?.color || '#888888').slice(1), 16) % 360) / 360; for (const d of [-1.15, 1.15]) { const a = PI + d, [x, z] = ang(a, 8.6); const art = F.wallArt(1.1, 0.75, hue); art.position.set(x, 1.55, z); art.rotation.y = inward(a); g.add(art); } }
    }
    if (r.kind === 'conference') {
      place(g, F.rug(8 * FS + 1.4, 4.4 * FS + 1.4, 0x3b3d42), cx, cz, 0);
      place(g, fit(F.tableLong(6.6, 1.7)), cx, cz, 0, 6.6, 1.7);
      for (let k = 0; k < 6; k++) for (const s2 of [-1, 1]) {
        const x = cx + (-2.75 + k * 1.1) * FS; const z = cz + s2 * 1.35 * FS;
        place(g, fit(F.officeChair(F.M.leather)), x, z, s2 > 0 ? 0 : Math.PI);
        spot(x, z, s2 > 0 ? Math.PI : 0, 'sit', 'meeting');
      }
      spot(cx - 3.9 * FS - 0.3, cz, Math.PI / 2, 'stand', 'meeting'); spot(cx + 3.9 * FS + 0.3, cz, -Math.PI / 2, 'stand', 'meeting');
      for (let k = -1; k <= 1; k++) place(g, F.pendant(2.15), cx + k * 2.2, cz);
      { const tv = mkDisplay(3.4, 1.9), [x, z] = ang(Math.PI, 7.7); tv.group.position.set(x, 0, z); tv.group.rotation.y = inward(Math.PI); g.add(tv.group); r.screen = tv.screen; solid(x, z, 3.6, 0.6); }
      { const [x, z] = ang(Math.PI + 1.15, 7.7); place(g, F.bookshelf(2.2, 0.8, 0.45, books), x, z, inward(Math.PI + 1.15), 2.2, 0.8); }
      pois.push({ id: 'meeting', x: cx, z: cz - side * 2.3, r: 2.6, label: 'Mulai rapat di sini', sub: 'Conference Hall' });
      const wbCanvas = document.createElement('canvas'); wbCanvas.width = 512; wbCanvas.height = 320;
      const wbTex = new THREE.CanvasTexture(wbCanvas); wbTex.colorSpace = THREE.SRGBColorSpace;
      { const bd = mkBoard(3, 1.9, wbTex), a = Math.PI - 1.15, [x, z] = ang(a, 7.55); bd.group.position.set(x, 0, z); bd.group.rotation.y = inward(a); g.add(bd.group); solid(x, z, 3.2, 0.7);
        r.whiteboard = { canvas: wbCanvas, tex: wbTex, key: '' };
        const [px, pz] = ang(a, 6.3); pois.push({ id: 'board', x: px, z: pz, r: 1.8, label: 'Lihat whiteboard rapat', sub: 'Notulen & keputusan' }); }
    }
    if (r.kind === 'library') {
      // shelves follow the curve of the wall; readers stand in front of them
      for (let k = 0; k < 8; k++) {
        const a = Math.PI - 1.45 + k * (2.9 / 7), [x, z] = ang(a, 7.7);
        place(g, F.bookshelf(1.5, 2.2, 0.42, books), x, z, inward(a), 1.7, 0.7);
        const [sx, sz] = ang(a, 6.7); spot(sx, sz, a, 'stand', 'read');
      }
      for (const dx of [-2.6, 2.6]) {
        const tx = cx + dx, tz = cz - 0.6;
        place(g, fit(F.tableLong(2.6, 1)), tx, tz, 0, 2.6, 1);
        for (const dd of [-0.65 * FS, 0.65 * FS]) for (const s2 of [-1, 1]) { const x = tx + dd, z = tz + s2 * 0.75 * FS; place(g, fit(F.cafeChair()), x, z, s2 > 0 ? 0 : Math.PI); spot(x, z, s2 > 0 ? Math.PI : 0, 'sit', 'read'); }
        place(g, F.pendant(2.1), tx, tz);
      }
      place(g, F.rug(7, 3.4, 0x7a6a5a), cx, cz - 0.6, 0);
      for (const a of [Math.PI - 2.1, Math.PI + 2.1]) { const [x, z] = ang(a, 6.6); place(g, fit(F.armchair()), x, z, inward(a), 1, 1); spot(x, z, a + Math.PI, 'sit', 'read'); }
    }
    if (r.kind === 'cafe') {
      const mkCounter = (machine) => {
        const c = new THREE.Group();
        F.put(c, F.rbox(2.8, 1.05, 0.75, 0.04), F.M.walnut, 0, 0.52, 0); F.put(c, F.rbox(2.9, 0.05, 0.85, 0.02), F.M.ceramic, 0, 1.07, 0);
        if (machine) { F.put(c, F.rbox(0.45, 0.5, 0.4, 0.04), F.M.blackMetal, -0.8, 1.35, 0); F.put(c, F.box(0.12, 0.04, 0.12), cmat(0xff7a3c), -0.8, 1.42, 0.21, { cast: false }); for (let k = 0; k < 4; k++) F.put(c, F.cyl(0.05, 0.04, 0.1, 10), F.M.ceramic, 0.0 + k * 0.22, 1.14, 0, { cast: false }); }
        return c;
      };
      [-0.62, 0, 0.62].forEach((da, i) => {
        const a = Math.PI + da, [x, z] = ang(a, 7.3);
        place(g, fit(mkCounter(i === 1)), x, z, inward(a), 2.9, 0.9);
        for (const off of [-0.55, 0.55]) { const [sx, sz] = ang(a + off / 6.3, 6.25); place(g, fit(F.barStool()), sx, sz); spot(sx, sz, a, 'sit', 'leisure', 0.775 * FS); }
      });
      { const a = Math.PI + 1.3, [x, z] = ang(a, 7.6), fridge = new THREE.Group(); F.put(fridge, F.rbox(0.9, 2, 0.75, 0.04), F.M.steel, 0, 1, 0); F.put(fridge, F.box(0.04, 0.6, 0.04), F.M.chrome, 0.35, 1.2, 0.39, { cast: false }); place(g, fridge, x, z, inward(a), 0.9, 0.75); }
      for (const [dx, dz] of [[-3.3, 1.2], [3.3, 1.2], [0, -0.4], [-2.6, -3.3], [2.6, -3.3]]) {
        const x = cx + dx, z = cz + dz;
        place(g, fit(F.roundTable(0.5)), x, z, 0, 1, 1); place(g, F.pendant(2.1), x, z);
        for (const a of [0, Math.PI]) { const tx = x + Math.sin(a) * 0.75 * FS, tz = z + Math.cos(a) * 0.75 * FS; place(g, fit(F.cafeChair()), tx, tz, a); spot(tx, tz, a + Math.PI, 'sit', 'leisure'); }
      }
      { const [x, z] = ang(Math.PI, 5.5); pois.push({ id: 'coffee', x, z, r: 1.6, label: 'Ambil kopi ☕', sub: 'Pantry' }); }
    }
    if (r.kind === 'play') {
      place(g, F.rug(6, 4, 0xcfd3ea), cx, cz, 0);
      const pool = new THREE.Group();
      F.put(pool, F.rbox(2.6, 0.14, 1.5, 0.04), F.M.walnut, 0, 0.8, 0); F.put(pool, F.box(2.3, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: 0x7fbf9a, roughness: 1 }), 0, 0.88, 0, { cast: false });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(pool, F.rbox(0.14, 0.75, 0.14, 0.03), F.M.walnut, sx * 1.15, 0.38, sz * 0.62);
      for (let k = 0; k < 7; k++) F.put(pool, new THREE.SphereGeometry(0.03, 8, 6), cmat([0xffffff, 0xf2c14e, 0xd1495b, 0x2e86ab, 0x111111, 0xe07a5f, 0x6a4c93][k]), -0.5 + (k % 4) * 0.08, 0.92, -0.1 + Math.floor(k / 4) * 0.08, { cast: false });
      place(g, fit(pool), cx - 2.6, cz, 0, 2.6, 1.5);
      for (const [dx, dz, f] of [[-1.7, 0, Math.PI / 2], [1.7, 0, -Math.PI / 2], [0, 1.2, Math.PI]]) spot(cx - 2.6 + dx * FS, cz + dz * FS, f, 'stand', 'leisure');
      const pp = new THREE.Group(); F.put(pp, F.box(2.4, 0.04, 1.3), new THREE.MeshStandardMaterial({ color: 0x1f4f8a, roughness: 0.5 }), 0, 0.76, 0); F.put(pp, F.box(0.02, 0.15, 1.35), F.M.laminate, 0, 0.84, 0, { cast: false }); for (const lx of [-0.9, 0.9]) F.put(pp, F.box(0.06, 0.74, 1), F.M.blackMetal, lx, 0.37, 0);
      place(g, fit(pp), cx + 2.6, cz + side * 1.8, 0, 2.4, 1.3);
      spot(cx + 2.6 - 1.6 * FS, cz + side * 1.8, Math.PI / 2, 'stand', 'leisure'); spot(cx + 2.6 + 1.6 * FS, cz + side * 1.8, -Math.PI / 2, 'stand', 'leisure');
      const fb = new THREE.Group(); F.put(fb, F.rbox(1.4, 0.9, 0.8, 0.04), F.M.walnut, 0, 0.45, 0); F.put(fb, F.box(1.3, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0x1f6b3e }), 0, 0.91, 0, { cast: false });
      place(g, fit(fb), cx + 2.6, cz - side * 1.8, 0, 1.4, 0.8); spot(cx + 2.6, cz - side * (1.8 + 0.7 * FS), side > 0 ? 0 : Math.PI, 'stand', 'leisure');
      { const [x, z] = ang(Math.PI, 7.2); place(g, fit(F.sofa(2.4)), x, z, inward(Math.PI), 2.4, 1); }
    }
    if (r.kind === 'lounge') {
      place(g, F.rug(RW * 0.6, RD * 0.5, 0x8c7b68), cx, cz, 0);
      // the lounge set is pulled in around the coffee table so the fitted sofas still face each other closely
      place(g, fit(F.sofa(3.6)), cx, cz + side * 1.7 * FS, faceFront, 3.6, 1); place(g, fit(F.sofa(2.4)), cx - 2.8 * FS, cz + side * 0.2 * FS, Math.PI / 2, 2.4, 1);
      place(g, fit(F.armchair()), cx + 2.4 * FS, cz - side * 0.6 * FS, -Math.PI / 2 - (side > 0 ? 0.4 : -0.4), 1, 1); place(g, fit(F.coffeeTable(1.6, 0.8)), cx, cz, 0, 1.6, 0.8);
      for (let k = -1.2; k <= 1.2; k += 1.2) spot(cx + k * FS, cz + side * 1.55 * FS, faceFront, 'sit', 'leisure');
      spot(cx - 2.65 * FS, cz + side * 0.2 * FS, Math.PI / 2, 'sit', 'leisure'); spot(cx + 2.3 * FS, cz - side * 0.55 * FS, -Math.PI / 2, 'sit', 'leisure');
      { const tv = mkDisplay(2.6, 1.4), [x, z] = ang(Math.PI, 7.7); tv.group.position.set(x, 0, z); tv.group.rotation.y = inward(Math.PI); g.add(tv.group); solid(x, z, 2.8, 0.6); }
      { const [x, z] = ang(Math.PI + 1.1, 7.7); place(g, F.bookshelf(1.8, 1.9, 0.38, books), x, z, inward(Math.PI + 1.1), 1.8, 0.5); }
      pois.push({ id: 'lounge', x: cx, z: cz, r: 2.2, label: 'Duduk santai di lounge', sub: 'Guest Lounge' });
    }
    if (r.div) pois.push({ id: `div:${r.div.id}`, x: cx, z: Z(1.2), r: 1.4, label: `${r.div.icon} ${r.div.name}`, sub: 'E: lihat divisi & tim' });
    spot(cx - 1.6, Z(1.4), faceBack, 'stand', 'door');
    // division décor: slim props along the glass, a cluster either side of the entrance, banners on the glass
    if (r.round && !location.hash.includes('nodecor')) {
      const th = DECOR.theme(r), A0 = 0.95, A1 = Math.PI * 2 - 0.95, n = th.rim.length;
      if (!location.hash.includes('norim')) th.rim.forEach((kind, i) => { if (i >= (+(location.hash.match(/rim(d+)/)||[])[1] || 99)) return; const a = A0 + ((i + 0.5) / n) * (A1 - A0), [x, z] = ang(a, 8.3), o = DECOR.make(kind, accent); if (!o) return; o.position.set(x, 0, z); o.rotation.y = inward(a); g.add(o); });
      if (!location.hash.includes('nobanner')) for (let i = 0; i <= n; i++) { const a = A0 + (i / n) * (A1 - A0), [x, z] = ang(a, 8.62), b = DECOR.banner(new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.25).getHex(), 1.1 + (i % 3) * 0.2); b.position.set(x, 0, z); b.rotation.y = inward(a); g.add(b); }
      if (!location.hash.includes('nofront')) th.front.forEach((kind, i) => { const sg = i ? 1 : -1, a = sg * 0.62, [x, z] = ang(a, 6.9), o = DECOR.make(kind, accent); if (!o) return; o.position.set(x, 0, z); o.rotation.y = inward(a) + sg * 0.5; g.add(o); solid(x, z, 0.9, 0.9); });
    }
    clampFn = null;
  }

  // a desk chair is ONE vertex-coloured mesh (shared geometry per colour): it can slide as a whole and costs one draw call
  const chairGeos = new Map();
  const chairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 });
  function deskChair(hex) {
    if (!chairGeos.has(hex)) chairGeos.set(hex, F.bake(F.officeChair(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex) }))));
    const m = new THREE.Mesh(chairGeos.get(hex), chairMat); m.castShadow = false; m.userData.dynamic = true; return m;
  }
  /** monitor state: 'on' (working, seated at the desk), 'idle' (standby glow) or 'off'; a person can force it from the click menu */
  function deskScreen(a) {
    const dk = a.desk; if (!dk?.screenMat) return;
    const e = a.e, seated = a.mode === 'desk' && a.pose === 'sit', act = e.status === 'working' || e.status === 'chatting';
    const st = dk.force || (e.status === 'offline' ? 'off' : seated && act ? 'on' : 'idle');
    const now = performance.now();
    if (dk.state === st && !(st === 'on' && now > dk.nextSwitch)) return;
    const changed = dk.state !== st; dk.state = st;
    if (st === 'on') {
      const kinds = ROLE_SCREENS[a.desk?.room?.div?.id] || ['doc', 'chart', 'code']; dk.kind = kinds[(Math.random() * kinds.length) | 0];
      dk.nextSwitch = now + 18000 + Math.random() * 30000; dk.scrU.uSpd.value = -(0.012 + Math.random() * 0.05); if (changed) dk.scrU.uPh.value = Math.random();
      dk.screenMat.map = scrStrip(dk.kind); dk.screenMat.color.set(0xffffff);
    } else if (st === 'idle') { let h = 0; for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; dk.kind = AMBIENT[h % AMBIENT.length]; dk.screenMat.map = scrStrip(dk.kind); dk.scrU.uSpd.value = -(0.006 + (h % 7) * 0.0012); dk.screenMat.color.set(0xa7b3d9); }
    else { dk.screenMat.map = null; dk.screenMat.color.set(0x050505); }
    dk.screenMat.needsUpdate = true;
  }
  /** the live "what is this person doing" bar on the top fifth of a desk screen; only desks near the camera get a texture (created on demand, disposed when the camera leaves) */
  function deskTitle(a, d) {
    const dk = a.desk; if (!dk?.scrU) return;
    const lim = gfx === 'eco' ? 9 : 18;
    if (d > lim + 6) { if (dk.titleTex) { dk.titleTex.dispose(); dk.titleTex = null; dk.titleKey = ''; dk.scrU.uTitle.value = null; dk.scrU.uHasT.value = 0; } return; }
    if (d > lim) return;
    const e = a.e, task = e.status === 'working' ? data?.tasks?.find((t) => t.assigneeId === e.id && t.status === 'in_progress') : null;
    const txt = e.status === 'offline' ? 'Offline' : e.status === 'working' ? (task?.title || e.statusText || 'Bekerja') : e.status === 'meeting' ? (e.statusText || 'Rapat') : e.status === 'chatting' ? 'Mengobrol' : 'Siap bekerja';
    const key = e.status + '|' + txt;
    if (dk.titleKey === key) { dk.scrU.uHasT.value = dk.state === 'off' ? 0 : 1; return; }
    dk.titleKey = key;
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,12,26,0.92)'; g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#' + new THREE.Color(STATUS_COLOR[e.status] ?? STATUS_COLOR.idle).getHexString(); g.beginPath(); g.arc(11, 16, 4.5, 0, 7); g.fill();
    g.font = '600 15px Geist, Inter, system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#e8ecff';
    let t = String(txt).replace(/\s+/g, ' '); while (t.length > 3 && g.measureText(t).width > 226) t = t.slice(0, -2); if (t.length < String(txt).length) t = t.replace(/\s+$/, '') + '…';
    g.fillText(t, 22, 17);
    if (dk.titleTex) dk.titleTex.dispose();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; dk.titleTex = tex; dk.scrU.uTitle.value = tex; dk.scrU.uHasT.value = dk.state === 'off' ? 0 : 1;
  }
  const partitionMats = new Map();
  const partitionMat = (hex) => { if (!partitionMats.has(hex)) partitionMats.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color(0xeeeeee), 0.55), roughness: 1 })); return partitionMats.get(hex); };
  function buildDesk(room, slot, e) {
    const lead = e.isLead || e.isMaster || e.isPA;
    const ry = slot.ry ?? (room.side < 0 ? 0 : Math.PI); // monitors face the back wall, people sit facing away from the corridor
    const g = new THREE.Group();
    const desk = F.desk({ w: lead ? 2 : 1.6, d: lead ? 0.9 : 0.8, lead });
    DECOR.deskItems(desk, room.div?.id, lead ? 2 : 1.6);
    g.add(desk);
    const scrU = { uSpd: { value: -0.025 }, uPh: { value: Math.random() }, uTitle: { value: null }, uHasT: { value: 0 } };
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x14181d });
    screenMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = screenT; sh.uniforms.uSpd = scrU.uSpd; sh.uniforms.uPh = scrU.uPh; sh.uniforms.uTitle = scrU.uTitle; sh.uniforms.uHasT = scrU.uHasT;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uSpd; uniform float uPh; uniform sampler2D uTitle; uniform float uHasT;').replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D(map, vec2(vMapUv.x, fract(vMapUv.y * 0.15 + uT * uSpd + uPh))); if (uHasT > 0.5 && vMapUv.y > 0.8) { vec4 tc = texture2D(uTitle, vec2(vMapUv.x, (vMapUv.y - 0.8) * 5.0)); sampledDiffuseColor = vec4(mix(sampledDiffuseColor.rgb * 0.3, tc.rgb, tc.a), 1.0); }\n diffuseColor *= sampledDiffuseColor;\n#endif');
    };
    screenMat.customProgramCacheKey = () => 'deskscreen2';
    { const ec = new THREE.Color(room.div?.color || '#8fb4ff'); const em = new THREE.MeshBasicMaterial({ color: ec.lerp(new THREE.Color(0xffffff), 0.35) }); F.put(g, F.box(lead ? 1.8 : 1.4, 0.014, 0.014), em, 0, 0.752, 0.37, { cast: false }); }
    const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), screenMat), 0, 1.13, -(lead ? 0.9 : 0.8) / 2 + 0.224, g, { cast: false });   /* the desk model's own (blue) screen face and bezel front sit at -d/2 + 0.21/0.215: the live screen was 0.022 m BEHIND them, so every monitor looked plain blue */ scr.userData.keep = true;
    const hitBox = (w, h, d, x, y, z, prop) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false })), x, y, z, g, { cast: false }); m.userData = { prop, owner: e.id, keep: true }; pickables.push(m); };
    hitBox(0.78, 0.52, 0.14, 0, 1.12, -(lead ? 0.9 : 0.8) / 2 + 0.2, 'pc'); hitBox(0.62, 0.95, 0.62, 0, 0.48, CHAIR_Z, 'chair'); hitBox(lead ? 2 : 1.6, 0.1, lead ? 0.9 : 0.8, 0, 0.74, 0, 'desk');
    const chairGrp = deskChair(lead ? '#8f9be0' : '#' + new THREE.Color(room.div?.color || '#a3a9c9').lerp(new THREE.Color(0xffffff), 0.15).getHexString());
    chairGrp.position.set(0, 0, CHAIR_Z); g.add(chairGrp);
    if (room.kind === 'work' && !lead) { const scrn = F.put(g, F.rbox(1.6, 0.45, 0.04, 0.015), partitionMat(room.div.color), 0, 0.98, -0.42, { cast: false }); scrn.userData.small = true; }
    g.position.set(slot.x, 0, slot.z); g.rotation.y = ry; g.scale.setScalar(FS);
    room.group.add(g);
    if (slot.ry !== undefined) solid(slot.x, slot.z, 0.95, 0.95); else solid(slot.x, slot.z, (lead ? 2.1 : 1.7) * FS, (lead ? 1 : 0.9) * FS);
    const seat = new THREE.Vector3(0, 0, 0.66 * FS).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position);
    return { force: null, state: '', scrU, nextSwitch: 0, group: g, screenMat, screen: scr, chair: chairGrp, seat, facing: ry + Math.PI, room, color: new THREE.Color(room.div?.color || '#d8c3a5') };
  }

  // People: realistic low-poly humans (see people.js) + spawn pad, plumbob status marker, click target.
  function buildAvatar(e, desk) {
    const hex = desk.room.div?.color || '#d8c3a5';
    const color = new THREE.Color(hex);
    const P = humanReady() ? buildFbxRig(e, hex, add) : makePerson(e, hex, add);
    const g = P.g; g.userData.dynamic = true;
    if (P.visor) P.visor.userData.keep = true;
    P.torso.userData.keep = true; // breathing animation scales the torso
    g.traverse((o) => { if (o.isMesh) o.castShadow = o === P.torso || o.geometry.type === 'CapsuleGeometry'; });
    if (!P.rig) { mergeRigid(P.body); mergeRigid(P.head); }
    for (const o of [P.face]) if (o) o.castShadow = false;
    const pad = { scale: { setScalar() {} } }; // the ring alone marks the agent: one mesh instead of disc + ring + blob
    const ring = add(new THREE.Mesh(G.padRing, cmat('#' + color.getHexString(), { transparent: true, opacity: 0.9, side: THREE.DoubleSide })), 0, 0.035, 0, g, { cast: false });
    ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.6);
    const statusDot = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: STATUS_COLOR.idle, transparent: true, opacity: 0.92 })), 0, P.top + 0.22, 0, g, { cast: false });
    statusDot.scale.set(1, 1.7, 1);
    const hit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshBasicMaterial({ visible: false })), 0, 1, 0, g, { cast: false });
    hit.userData = { agent: e.id }; pickables.push(hit);
    g.position.copy(desk.seat); g.rotation.y = desk.facing;
    world.add(g); g.matrixAutoUpdate = false;
    const a = { id: e.id, e, g, body: P.body, torso: P.torso, head: P.head, neck: P.neck, face: P.face, rig: P.rig, visor: P.visor, looks: JSON.stringify(e.appearance || {}), armL: P.armL, armR: P.armR, legL: P.legL, legR: P.legR, pad, ring, statusDot, desk, T: P.T, sitDrop: P.sitDrop, topY: P.top, path: [], phase: Math.random() * 10, pose: 'sit', mode: 'desk', spot: null, until: 0, nextIdle: performance.now() + 6000 + Math.random() * 18000, label: null, bubble: null, bubbleUntil: 0, jump: 0, talkUntil: 0, waveUntil: 0, lookAt: null };
    // the direction "away from the desk" in this agent's own frame: the chair slides that way when the agent sits
    a.backLocal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.facing - Math.PI).applyAxisAngle(new THREE.Vector3(0, 1, 0), -desk.facing);
    avatars.set(e.id, a); giveProp(a);
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
    // arms-up gestures are for standing people; a seated agent keeps the seated ones
    const STANDING_ONLY = ['cheer', 'stretch', 'dance', 'clap', 'carry', 'facepalm'];
    const gest = a.gest && now < a.gest.until && !(sit && STANDING_ONLY.includes(a.gest.type)) ? a.gest.type : null;
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
    a.body.position.y = bob; // seated pose comes from the body clip; the feet are grounded by the rig
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
    a.rig?.apply(a);
    updateFace(a, now, gest, mood);
    if (a.emote) {
      const t = (now - a.emote.t0) / 1000, life = (a.emote.until - a.emote.t0) / 1000;
      if (t > life) { disposeSprite(a.emote.s); a.emote = null; }
      else { const pop = t < 0.25 ? 0.4 + (t / 0.25) * 0.75 : t < 0.4 ? 1.15 - (t - 0.25) * 1 : 1; a.emote.s.scale.setScalar(0.42 * pop); a.emote.s.position.y = (a.topY || 1.85) + 0.62 + t * 0.12; a.emote.s.material.opacity = t > life - 0.4 ? (life - t) / 0.4 : 1; }
    }
    if (a.bubble?.userData.base) {
      const u = a.bubble.userData, t = (now - u.t0) / 1000, e0 = Math.min(1, t / 0.35), ein = 1 - (1 - e0) * (1 - e0), eout = Math.max(0, Math.min(1, (a.bubbleUntil - now) / 500));
      a.bubble.scale.copy(u.base).multiplyScalar(0.9 + 0.1 * ein); if (u.y0 !== undefined) a.bubble.position.y = u.y0 - 0.1 * (1 - ein) + 0.05 * (1 - eout);
      a.bubble.material.opacity = (u.glass ? 0.95 : 0.97) * (u.k ?? 1) * ein * eout;
    }
  }
  // ───── face: expression from emotion > speech > gesture > mood > activity, with natural blinking
  function updateFace(a, now, gest, mood) {
    if (!a.face && !a.rig?.setFace) return;
    let ex = 'neutral';
    const emo = a.emo && now < a.emo.until ? a.emo.type : null, st = a.e.status;
    // a finished task / a status change is worth a short reaction
    if (a.lastSt !== st) { if (a.lastSt && (st === 'done' || st === 'approved')) a.react = { ex: 'laugh', until: now + 2200 }; else if (a.lastSt && st === 'blocked') a.react = { ex: 'error', until: now + 2600 }; else if (a.lastSt === 'offline') a.react = { ex: 'wow', until: now + 1600 }; a.lastSt = st; }
    const react = a.react && now < a.react.until ? a.react.ex : null;
    const seed = a.e.name.length * 977 + (a.e.id ? a.e.id.length * 131 : 0), slow = Math.floor(now / 5200 + seed) % 7;
    if (emo) ex = emo;
    else if (now < a.talkUntil) { const s = Math.sin(now * 0.026 + a.e.name.length) + Math.sin(now * 0.061) * 0.6; ex = s > 0.45 ? 'talk1' : s > -0.3 ? 'talk2' : (Math.sin(now * 0.002 + seed) > 0.8 ? 'laugh' : 'smile'); }
    else if (react) ex = react;
    else if (st === 'offline') ex = 'sleepy';
    else if (st === 'blocked') ex = 'error';
    else if (gest === 'dance' || gest === 'cheer' || gest === 'laugh') ex = 'laugh';
    else if (gest === 'sad' || gest === 'facepalm') ex = 'sad';
    else if (gest === 'think' || gest === 'observe') ex = 'think';
    else if (gest === 'shrug') ex = 'wow';
    else if (mood === 'lelah') ex = slow === 3 ? 'sad' : 'sleepy';
    else if (a.mode === 'leisure' || a.mode === 'visit') ex = slow === 5 ? 'laugh' : slow === 2 ? 'wink' : 'smile';
    else if (st === 'working') ex = slow === 1 || slow === 4 ? 'think' : 'focus';        // concentrates, now and then visibly thinks
    else if (st === 'meeting' || st === 'chatting') ex = slow === 2 ? 'wow' : slow === 5 ? 'think' : 'smile';
    else if (st === 'pending' || st === 'waiting' || st === 'todo') ex = slow % 3 === 0 ? 'think' : 'neutral';
    else if (st === 'done') ex = 'smile';
    else if (mood === 'bersemangat' || mood === 'tenang') ex = 'smile';
    // idle micro-expressions so a quiet agent is never frozen on one face (not while busy talking or reacting)
    if (!emo && !react && now >= a.talkUntil && (ex === 'neutral' || ex === 'smile' || ex === 'focus')) {
      if (!a.microNext) a.microNext = now + 1500 + Math.random() * 5000;
      if (now > a.microNext) { const R = Math.random(); a.micro = { ex: R < 0.34 ? 'smile' : R < 0.5 ? 'wink' : R < 0.62 ? 'laugh' : R < 0.72 ? 'wow' : R < 0.8 ? 'love' : R < 0.9 ? 'think' : ex === 'neutral' ? 'sleepy' : 'smile', until: now + 1400 + Math.random() * 1800 }; a.microNext = now + 4500 + Math.random() * 8500; }
      if (a.micro && now < a.micro.until) ex = a.micro.ex;
    }
    if (!a.blinkAt) a.blinkAt = now + 800 + Math.random() * 4000;
    const blink = now > a.blinkAt && now < a.blinkAt + 140 && ex !== 'laugh';
    if (now > a.blinkAt + 140) a.blinkAt = now + 2200 + Math.random() * 4200 * (Math.random() < 0.15 ? 0.1 : 1); // occasional double blink
    const key = ex + (blink ? '*' : '');
    if (key !== a.faceKey) {
      a.faceKey = key;
      if (!a.face) { const CELL = { neutral: 0, smile: 2, laugh: 3, surprised: 4, wow: 4, love: 5, angry: 6, sad: 7, cry: 8, sleepy: 9, wink: 10, think: 11, talk1: 12, talk2: 13, focus: 14, error: 15 }; a.rig.setFace(blink && ex !== 'sleepy' ? 1 : (CELL[ex] ?? 2)); }
      else a.face.material = faceTexture(ex, blink, a.T.hair, a.T.fem);
    }
  }
  /** Emotion = facial expression held for a while (laugh, sad, surprised, love, smile…). */
  const feel = (a, type, ms = 2500) => { if (a) a.emo = { type, until: performance.now() + ms }; };
  const SMALLTALK = ['Kopinya enak banget hari ini ☕', 'Hahaha serius? 😂', 'Weekend kemarin ke mana?', 'Campaign kemarin tembus target! 🎉', 'Aku lagi belajar skill baru nih 📚', 'Ayo satu ronde lagi! 🎮', 'GG! 😆', 'Butuh istirahat sebentar 😌', 'Ide bagus, nanti kita bahas di rapat', 'Mantap, lanjut! 💪', 'Eh, sudah lihat dashboard KPI tadi?', 'Siapa yang mau es kopi susu?', 'Tadi riset kompetitor seru banget', 'Wah, notulen rapat tadi rapi sekali 👏'];
  /** Life in shared spaces: play room games & dancing, café drinks, lounge small talk between neighbours. */
  function leisureLife(a, now) {
    if (a.mode !== 'leisure' || a.path.length || a.player || now < (a.nextAct || 0)) return;
    a.nextAct = now + 3500 + Math.random() * 6500;
    if (a.spot?.plaza) return plazaLife(a, now);
    const kind = roomAt(a.g.position)?.kind;
    const near = [...avatars.values()].filter((o) => o !== a && o.mode === 'leisure' && !o.path.length && o.g.position.distanceTo(a.g.position) < 4.5);
    const r = Math.random();
    if (kind === 'play') {
      if (r < 0.35) { gesture(a, 'dance', 3200); feel(a, 'laugh', 3200); }
      else if (r < 0.6) { a.jump = 1; feel(a, 'laugh', 1800); emote(a, ['🎮', '😂', '🏓', '🎯'][(Math.random() * 4) | 0], 2000); }
      else if (r < 0.8) { gesture(a, 'cheer', 1800); feel(a, 'laugh', 2000); if (Math.random() < 0.5) say(a, ['GG! 😆', 'Ayo satu ronde lagi! 🎮', 'Hahaha 😂', 'Menang lagi! 🏆'][(Math.random() * 4) | 0], 2600); }
      else if (near[0]) { const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 2500; say(a, chat.open(chat.topic(a, o, tod)), 3200); setTimeout(() => { feel(o, 'laugh', 1500); gesture(o, 'laugh', 1500); }, 1400); }
    } else if (kind === 'cafe') {
      if (r < 0.45) { gesture(a, 'drink', 3000); feel(a, 'smile', 3000); }
      else if (near[0]) { const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 3000; feel(a, 'smile', 3000); say(a, chat.open(chat.topic(a, o, tod)), 3600); setTimeout(() => { o.talkUntil = performance.now() + 2200; if (Math.random() < 0.5) { feel(o, 'laugh', 1600); gesture(o, 'laugh', 1500); } }, 1800); }
      else { gesture(a, 'phone', 2600); }
    } else if (near[0]) {
      const o = near[0]; a.lookAt = o.g.position; o.lookAt = a.g.position; a.talkUntil = now + 2800; if (Math.random() < 0.45) say(a, chat.open(chat.topic(a, o, tod)), 3200);
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

  // ───── follow: an agent walks with the person who asked (chat "ikuti saya"), keeping a natural distance; "berhenti ikut" sends them back to work
  const followers = new Map(); // agent id -> person id
  function startFollow(id, target) {
    const a = avatars.get(id); if (!a || id === target || !avatars.get(target)) return;
    release(a); followers.set(id, target); a.mode = 'follow'; a.until = 0; a.nextFollowAt = 0;
    say(a, 'Siap, saya ikut! 🚶', 2500);
  }
  function stopFollow(id) {
    const a = avatars.get(id); followers.delete(id); if (!a) return;
    if (a.mode === 'follow') { a.mode = 'desk'; goDesk(a); }
  }
  // people do not pass through each other: pairs closer than two body radii are pushed apart (seated agents stay put)
  const BODY_R = 0.42;
  let lodTick = 0;
  // the next person ahead of a walker who is standing still: slow down instead of walking into them
  function yieldTo(a, dir) {
    const n = dir.clone().normalize();
    for (const o of avatars.values()) {
      if (o === a || o.player || o.path.length > 0 || o.pose === 'sit') continue;
      const dx = o.g.position.x - a.g.position.x, dz = o.g.position.z - a.g.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.9 && (dx * n.x + dz * n.z) / Math.max(d, 1e-6) > 0.5) return true;
    }
    return false;
  }
  // a seat is taken while someone stands or sits on it: the walker waits rather than pushing through
  function seatTaken(a, seat) {
    for (const o of avatars.values()) if (o !== a && !o.player && o.g.position.distanceTo(seat) < 0.5) return true;
    return false;
  }
  const CHAIR_PULL = 0.1; // metres the chair (and its agent) slides back from the desk when the agent sits
  window.__avatars = avatars; // inspection hook: lets the seat height be measured in the browser
  // walking agents go around people in their way; two people walking straight at each other step to opposite sides
  const avoidVec = new THREE.Vector3();
  function steer(a, dir) {
    avoidVec.set(0, 0, 0);
    for (const o of avatars.values()) {
      if (o === a || o.player || (o.pose === 'sit' && o.path.length === 0)) continue;
      const dx = a.g.position.x - o.g.position.x, dz = a.g.position.z - o.g.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1.6 * 1.6 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      avoidVec.x += (dx / d) * (1.6 - d); avoidVec.z += (dz / d) * (1.6 - d);
      if (d < 1.1 && (dx * dir.x + dz * dir.z) / d < -0.6) { // head-on: sidestep, the pair picks opposite sides
        const side = a.id < o.id ? 1 : -1;
        avoidVec.x += -dir.z * side * 1.2; avoidVec.z += dir.x * side * 1.2;
      }
    }
    if (avoidVec.lengthSq() > 0) dir.addScaledVector(avoidVec, 0.9).normalize();
  }
  function separate() {
    const list = [...avatars.values()].filter((a) => !a.player && !(a.pose === 'sit' && a.path.length === 0));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      const dx = B.g.position.x - A.g.position.x, dz = B.g.position.z - A.g.position.z;
      const d2 = dx * dx + dz * dz; const min = 2 * BODY_R;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      const ov = min - d; const nx = dx / d, nz = dz / d;
      const aSits = A.pose === 'sit' && A.path.length === 0, bSits = B.pose === 'sit' && B.path.length === 0;
      const shareA = aSits ? 0 : bSits ? 1 : 0.5, shareB = 1 - shareA;
      const ax = A.g.position.x - nx * ov * shareA, az = A.g.position.z - nz * ov * shareA;
      const bx = B.g.position.x + nx * ov * shareB, bz = B.g.position.z + nz * ov * shareB;
      if (shareA && !collides(ax, az)) { A.g.position.x = ax; A.g.position.z = az; }
      if (shareB && !collides(bx, bz)) { B.g.position.x = bx; B.g.position.z = bz; }
    }
  }
  function followLife(a, now) {
    const target = followers.get(a.id); if (!target) return;
    const t = avatars.get(target); if (!t) return stopFollow(a.id);
    if (now < (a.nextFollowAt || 0)) return;
    a.nextFollowAt = now + 600; // re-plan a few times a second, so the agent keeps up with the person
    if (a.g.position.distanceTo(t.g.position) < 2.4) { a.path = []; a.pose = 'stand'; a.faceTo = Math.atan2(t.g.position.x - a.g.position.x, t.g.position.z - a.g.position.z); return; }
    // trail just behind and beside the person, along their facing direction
    const fwd = new THREE.Vector3(Math.sin(t.g.rotation.y), 0, Math.cos(t.g.rotation.y));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar(a.id.length % 2 ? 0.9 : -0.9);
    const goal = t.g.position.clone().addScaledVector(fwd, -1.6).add(side);
    a.pose = 'walk'; a.path = [];
    routeTo(a, goal, () => { a.pose = 'stand'; });
  }
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
    const lines = long ? wrap(text, 34, 4) : wrap(text, 38, 2);
    a.bubble = textSprite(lines, { glass: true, halo: true, fg: '#141c42', size: 16, scale: 0.0053, sameColor: true, a0: 0.94, a1: 0.88 });
    a.bubble.userData.glass = true; a.bubble.userData.y0 = (a.topY || 1.85) + 0.62 + (lines.length - 1) * 0.085; a.bubble.position.y = a.bubble.userData.y0; a.g.add(a.bubble); a.bubbleUntil = performance.now() + ms;
    a.bubble.userData.base = a.bubble.scale.clone(); a.bubble.userData.t0 = performance.now();
  }

  // ───── navigation
  function roomAt(p) {
    for (const r of rooms.values()) if (inRoom(r, p.x, p.z)) return r;
    return null;
  }
  const nearestCorridor = (z) => corridors.reduce((b, c) => (Math.abs(c - z) < Math.abs(b - z) ? c : b), corridors[0]);
  // room → own door → the promenade ring (the short way round) → target door → target
  const RING_N = 64;
  /** ground height at a point: the sky deck and its winding stair are the only raised walkways */
  const elev = (x, z) => {
    for (const dk of decks) {
      const dx = x - dk.cx, dz = z - dk.cz, r2 = dx * dx + dz * dz; if (r2 > (dk.R1 + 0.3) ** 2) continue;
      const r = Math.sqrt(r2); if (r < dk.DR) return dk.H; if (r > dk.R1) continue;
      let u = dk.ds * (Math.atan2(dz, dx) - dk.th0); u = ((u % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return u <= dk.S ? (dk.H * u) / dk.S : 0;
    }
    return 0;
  };
  /** the height of the walkable surface under a point that is no higher than y + a step, or null over the void: station deck, docks, stairs/decks, light bridges, district tops */
  function surfaceAt(x, z, y) {
    let best = null; const take = (h) => { if (h <= y + 0.75 && (best === null || h > best)) best = h; };
    if (terrainH && x * x + z * z < terrainR * terrainR) { const th = terrainH(x, z); if (th > 0.02) take(th); }
    for (const dk of decks) { const dx = x - dk.cx, dz = z - dk.cz; if (dx * dx + dz * dz <= dk.R1 * dk.R1) take(elev(x, z)); }
    const w = envWalk; if (!w) { take(0); return best; }
    const ex = (x - w.cx) / (w.rx * 0.95), ez = (z - w.cz) / (w.rz * 0.95); if (ex * ex + ez * ez <= 1) take(0);
    for (const a of w.arms) if (Math.abs(x - a.x) <= a.w / 2 && Math.abs(z - a.z) <= a.d / 2) take(a.y);
    for (const b of w.bridges) { const dx = b.bx - b.ax, dz = b.bz - b.az, t = ((x - b.ax) * dx + (z - b.az) * dz) / (dx * dx + dz * dz); if (t < 0 || t > 1) continue; const px = b.ax + dx * t, pz = b.az + dz * t; if ((x - px) ** 2 + (z - pz) ** 2 <= (b.w / 2) ** 2) take(b.ay + (b.by - b.ay) * t + 0.06); }
    for (const i of w.isl) if ((x - i.x) ** 2 + (z - i.z) ** 2 <= i.r * i.r) take(i.y + 0.02);
    return best;
  }
  const towerHit = (x, z, y) => { const w = envWalk; if (!w || Math.hypot(x - w.cx, z - w.cz) < w.rx) return false; for (const t of w.towers) if (Math.abs(y - t.y) < 6 && (x - t.x) ** 2 + (z - t.z) ** 2 < (t.w * 0.95) ** 2) return true; return false; };
  const deckOf = (v) => decks.find((dk) => Math.hypot(v.x - dk.cx, v.z - dk.cz) < dk.R1 + 0.5);
  const inPlaza = (v) => Math.hypot(v.x, v.z) < podRI - 2;
  const gapAt = (v) => { let best = 0, bd = 9; const an = Math.atan2(v.z, v.x); for (let i = 0; i < gaps.length; i++) { const d = Math.abs(Math.atan2(Math.sin(gaps[i] - an), Math.cos(gaps[i] - an))); if (d < bd) { bd = d; best = i; } } return gaps[best]; };
  // ───── urgent trips: far = teleport, medium = run, near = walk. Leisure strolls always walk; "urgent" means the trip was caused by work (meeting, library, station, back to the desk).
  let teleBatch = { names: [], label: '', n: 0, timer: 0 };
  const teleFx = []; let teleRoot = null;
  function teleFxItem() {
    if (!teleRoot || teleRoot.parent !== world) { teleRoot = new THREE.Group(); teleRoot.userData.keep = true; world.add(teleRoot); teleFx.length = 0; }
    const free = teleFx.find((q) => !q.on); if (free) return free;
    if (teleFx.length >= 10) return teleFx.reduce((o, q) => (q.t0 < o.t0 ? q : o));
    const mk = (geo) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 6; return m; };
    const g = new THREE.Group(), ringA = mk(new THREE.RingGeometry(0.28, 0.4, 40).rotateX(-Math.PI / 2)), ringB = mk(new THREE.RingGeometry(0.5, 0.56, 48).rotateX(-Math.PI / 2)), col = mk(new THREE.CylinderGeometry(0.42, 0.55, 3.4, 20, 1, true));
    col.position.y = 1.7; g.add(ringA, ringB, col);
    const N = 16, pos = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++) seed.push({ a: Math.random() * 6.28, r: 0.15 + Math.random() * 0.45, h: Math.random(), s: 0.6 + Math.random() * 0.8 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); pts.frustumCulled = false; pts.renderOrder = 6; g.add(pts);
    g.visible = false; teleRoot.add(g); const it = { g, ringA, ringB, col, pts, pos, seed, on: false, t0: 0, kind: 'in' }; teleFx.push(it); return it;
  }
  function spawnTeleFx(pos, a, kind) {
    const it = teleFxItem(), c = new THREE.Color(a?.desk?.room?.div?.color || '#7fe9ff').lerp(new THREE.Color(0xffffff), 0.45);
    for (const m of [it.ringA, it.ringB, it.col]) m.material.color.copy(c); it.pts.material.color.copy(c.clone().lerp(new THREE.Color(0xffffff), 0.5));
    it.g.position.set(pos.x, pos.y + 0.03, pos.z); it.g.visible = true; it.on = true; it.t0 = performance.now(); it.kind = kind;
  }
  function animateTele(now) {
    for (const it of teleFx) {
      if (!it.on) continue; const u = (now - it.t0) / 950; if (u >= 1) { it.on = false; it.g.visible = false; continue; }
      const out = it.kind === 'out', fade = 1 - u;
      it.ringA.scale.setScalar(out ? 2.2 - 1.7 * u : 0.5 + 1.8 * u); it.ringA.material.opacity = fade * 0.85;
      it.ringB.scale.setScalar(out ? 3.2 - 2.6 * u : 0.4 + 3.0 * u); it.ringB.material.opacity = fade * fade * 0.55;
      it.col.scale.set(out ? 1 - 0.7 * u : 1 + 0.15 * u, out ? 1 - 0.8 * u : 0.3 + 0.7 * Math.min(1, u * 2.5), out ? 1 - 0.7 * u : 1 + 0.15 * u); it.col.position.y = 1.7 * it.col.scale.y; it.col.material.opacity = (u < 0.2 ? u / 0.2 : (1 - u) / 0.8) * 0.45;
      for (let i = 0; i < it.seed.length; i++) { const q = it.seed[i], ang = q.a + u * 3; it.pos[i * 3] = Math.cos(ang) * q.r * (1 + u * 0.6); it.pos[i * 3 + 1] = q.h * 0.2 + u * (1.2 + q.s * 1.8); it.pos[i * 3 + 2] = Math.sin(ang) * q.r * (1 + u * 0.6); }
      it.pts.geometry.attributes.position.needsUpdate = true; it.pts.material.opacity = fade * 0.9;
    }
  }
  function teleAnnounce(a, near, land) {
    const label = a.tele?.label || (a.mode === 'meeting' ? 'Conference Hall' : a.mode === 'read' ? 'Library' : a.mode === 'station' ? 'stasiun kerja' : a.mode === 'desk' ? 'meja kerja' : 'tujuan');
    teleBatch.names.push(String(a.e.name).split(' ')[0]); teleBatch.n++; teleBatch.label = label;
    if (!teleBatch.timer) teleBatch.timer = setTimeout(() => { const b = teleBatch; teleBatch = { names: [], label: '', n: 0, timer: 0 }; onTeleport?.({ names: b.names, n: b.n, label: b.label }); }, 800);
    if (near) { emote(a, '⚡', 1600); if (camera.position.distanceTo(land) < 35) sfx.play('tele'); }
  }
  /** one step of the teleport of an agent: it dissolves where it stands (0.33 s), reappears near its destination (0.38 s), then walks the last few steps so the normal arrival logic still runs */
  function teleStep(a, now) {
    const T = a.tele, near = Math.min(a.g.position.distanceTo(camera.position), T.land.distanceTo(camera.position)) < 90;
    if (T.phase === 'out') {
      if (!T.fx) { T.fx = true; if (near) spawnTeleFx(a.g.position, a, 'out'); }
      a.g.scale.setScalar(T.base * (near ? Math.max(0.02, 1 - (now - T.t0) / 330) : 1));
      if (!near || now - T.t0 >= 330) {
        a.path.splice(0, T.drop); a.g.position.copy(T.land); if (decks.length && !T.exactY) a.g.position.y = elev(T.land.x, T.land.z); else if (T.exactY) a.g.position.y = T.land.y;
        if (a.player && player) { a.g.rotation.y = T.yaw; a.faceTo = T.yaw; player.yaw = T.yaw; player.vy = 0; player.safe = { x: T.land.x, y: a.g.position.y, z: T.land.z };
          const tg = wp(a).add(new THREE.Vector3(0, player.fp ? 1.62 : 1.35, 0)); if (player.fp) { camera.position.copy(tg); } else { const cp = Math.cos(player.pitch); camera.position.copy(tg).add(new THREE.Vector3(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp).multiplyScalar(player.dist)); } controls.target.copy(tg); }
        teleAnnounce(a, near, T.land);
        if (near) { T.phase = 'in'; T.t0 = now; spawnTeleFx(T.land, a, 'in'); } else { a.g.scale.setScalar(T.base); a.tele = null; }
      }
    } else {
      const k = Math.min(1, (now - T.t0) / 380), e = 1 - Math.pow(1 - k, 3); a.g.scale.setScalar(T.base * (0.02 + 0.98 * e)); if (k >= 1) { a.g.scale.setScalar(T.base); a.tele = null; }
    }
  }
  function routeTo(a, target, onArrive) {
    if (a.tele) { a.g.scale.setScalar(a.tele.base); a.tele = null; }   /* a new route replaces a teleport in progress (its path indices would no longer match) */
    const from = a.g.position.clone();
    const pts = [];
    if (decks.length && from.y > 0.5) { const dk = deckOf(from); if (dk) { for (let i = dk.via.length - 1; i >= 0; i--) pts.push(dk.via[i].clone()); from.copy(dk.via[0]); from.y = 0; } }
    const r1 = roomAt(from), r2 = roomAt(target);
    const f1 = !r1 && inPlaza(from), f2 = !r2 && inPlaza(target);
    if (!(r1 && r1 === r2) && !(f1 && f2)) {
      const R = ringR + (Math.random() - 0.5) * (ringW - 2.6);
      const idx = (v) => ((Math.round((Math.atan2(v.z, v.x) / (Math.PI * 2)) * RING_N) % RING_N) + RING_N) % RING_N;
      const at = (i) => { const t = (i / RING_N) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * R, 0, Math.sin(t) * R); };
      const rad = (g, r) => new THREE.Vector3(Math.cos(g) * r, 0, Math.sin(g) * r);
      let gFrom = null, gTo = null;
      const f1g = f1 ? gapAt(from) : null; if (f1) gFrom = f1g;
      if (f2) gTo = gapAt(target);
      const i1 = gFrom !== null ? idx(rad(gFrom, 1)) : idx(r1 ? r1.door : from), i2 = gTo !== null ? idx(rad(gTo, 1)) : idx(r2 ? r2.door : target);
      if (r1) pts.push(r1.inside.clone(), r1.door.clone());
      if (f1) { pts.push(rad(gFrom, podRI - 9), rad(gFrom, podRI), rad(gFrom, R)); }
      let d = (((i2 - i1) % RING_N) + RING_N) % RING_N; const dir = d <= RING_N / 2 ? 1 : -1; if (dir < 0) d = RING_N - d;
      for (let k = 0; k <= d; k++) pts.push(at(((i1 + dir * k) % RING_N + RING_N) % RING_N));
      if (r2) pts.push(r2.door.clone(), r2.inside.clone());
      if (f2) pts.push(rad(gTo, R), rad(gTo, podRI), rad(gTo, podRI - 9));
    }
    pts.push(target.clone());
    a.path = pts; a.onArrive = onArrive; a.runTrip = false;
    if (a.urgent && !a.player && a.e?.type === 'ai') {
      let L = 0, prev = from; for (const p of pts) { L += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
      const cap = V.tele ?? 45;
      if (cap > 0 && L > cap && pts.length >= 2 && !a.tele) a.tele = { t0: performance.now(), phase: 'out', land: pts[pts.length - 2].clone(), drop: pts.length - 1, base: a.g.scale.x || 1, fx: false };
      else if (L > 6) a.runTrip = true;   /* near but not trivial (within a room or an area): run, with the Run clip and GAIT.run speed; the path is measured along the corridors, so across rooms it is almost always far = teleport */
    }
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
    const fin = () => { a.faceTo = s.face; a.pose = s.pose; a.until = stay ? performance.now() + stay : 0; };
    if (s.via) { routeTo(a, s.via[0], fin); a.path.push(...s.via.slice(1).map((v) => v.clone()), s.p.clone()); } else routeTo(a, s.p, fin);
  }
  function claimPlaza(a, tag) {
    const free = plazaSpots.filter((s) => s.tag === tag && !claimed.has(s.key)); if (!free.length) return null;
    const s = free[(Math.random() * free.length) | 0]; release(a); claimed.set(s.key, a.id); a.spot = s; return s;
  }
  // each division has places in the plaza that match its work; people also drift to any other spot
  const PLAZA_BY_DIV = { mkt: ['content', 'stage'], ecom: ['content', 'stage'], design: ['sketch', 'content'], sales: ['pitch', 'stage'], bizdev: ['pitch'], retail: ['pitch', 'kiosk'], eng: ['deck', 'sketch'], data: ['demo', 'deck'], rnd: ['demo'], qa: ['demo'], kms: ['deck'], exec: ['deck', 'stage'], it: ['patrol', 'deck'], ops: ['patrol'], hr: ['wellness', 'fountain'], cs: ['wellness', 'fountain'], fin: ['fountain', 'deck'], legal: ['fountain'], reg: ['fountain'], mfg: ['demo', 'kiosk'], scm: ['kiosk', 'demo'] };
  function goPlaza(a) {
    if (!plazaSpots.length || a.player || a.e.type === 'human') return false;
    const prefs = PLAZA_BY_DIV[a.desk?.room?.div?.id] || [], any = ['brain', 'fountain', 'kiosk', 'deck', 'audience', 'wellness', 'content', 'pitch', 'stage'];
    const tag = prefs.length && Math.random() < 0.65 ? prefs[(Math.random() * prefs.length) | 0] : any[(Math.random() * any.length) | 0];
    const s = claimPlaza(a, tag) || (tag === 'stage' ? claimPlaza(a, 'audience') : null) || claimPlaza(a, 'brain'); if (!s) return false;
    goSpot(a, s, 'leisure', 14000 + Math.random() * 22000); return true;
  }
  const TAG_GEST = { stage: ['present', 'present', 'point', 'cheer'], audience: ['clap', 'nod', 'observe', 'nod'], deck: ['think', 'observe', 'point', 'nod'], content: ['phone', 'present', 'laugh', 'point'], sketch: ['operate', 'think', 'observe', 'operate'], demo: ['pipette', 'observe', 'pipette', 'think'], pitch: ['present', 'point', 'nod', 'present'], wellness: ['stretch', 'observe', 'stretch', 'stretch'], fountain: ['drink', 'observe', 'laugh', 'drink'], kiosk: ['drink', 'laugh', 'observe', 'drink'], brain: ['observe', 'think', 'observe', 'nod'], patrol: ['observe', 'observe', 'point', 'observe'] };
  const TAG_EMO = { stage: ['🎤', '📈'], content: ['🎬', '📸', '🔴'], sketch: ['🎨', '✏️'], demo: ['🔬', '🧪'], pitch: ['🤝', '💼'], wellness: ['🧘', '🌿'], fountain: ['☕', '🌿', '😄'], kiosk: ['☕', '🍪'], brain: ['🧠', '💡'], patrol: ['🛡️'], deck: ['💡', '🔭'], audience: ['👏'] };
  function plazaLife(a, now) {
    const t = a.spot.tag, r = Math.random(), g = TAG_GEST[t];
    if (g) gesture(a, g[(r * g.length) | 0], 2800);
    if (t === 'stage' || t === 'content' || t === 'pitch') { a.talkUntil = now + 2600; feel(a, 'smile', 2800); }
    if (r < 0.55) { const l = chat.prof(t); if (l) say(a, l, 3800, true); }
    if (r > 0.7 && TAG_EMO[t]) emote(a, TAG_EMO[t][(Math.random() * TAG_EMO[t].length) | 0], 2200);
    if (t === 'content' && r < 0.3) sfx.play('rec');
    if (t === 'fountain' && r < 0.2) sfx.play('splash');
    if (t === 'brain' && brainCore && r > 0.45 && r < 0.8) knowledgeFlow(a, 0xffb36b);
    if ((t === 'audience') && r < 0.2) for (const o of avatars.values()) if (o.spot?.tag === 'stage' && o !== a) { a.lookAt = o.g.position; break; }
  }
  // ───── agent ↔ agent social life: free neighbours strike up multi-turn conversations with natural, varied lines
  let nextSocial = 0;
  function startConvo(a, b, now) {
    const h = tod, t = chat.topic(a, b, h), t2 = chat.topic(b, a, h);
    const seq = [[a, chat.greet(b, h)], [b, chat.greetBack(a)], [a, chat.open(t)], [b, chat.reply(t)], [a, chat.follow(t)], [b, chat.back(t)]];
    if (Math.random() < 0.55) seq.push([b, chat.open(t2)], [a, chat.reply(t2)], [b, chat.follow(t2)]);
    seq.push([Math.random() < 0.5 ? a : b, chat.close()]);
    a.talkLock = b.talkLock = true; a.chatCool = b.chatCool = now + 40000;
    a.friends ||= {}; b.friends ||= {}; a.friends[b.id] = (a.friends[b.id] || 0) + 1; b.friends[a.id] = (b.friends[a.id] || 0) + 1;
    let i = 0;
    const end = () => { a.talkLock = b.talkLock = false; if (a.lookAt === b.g.position) a.lookAt = null; if (b.lookAt === a.g.position) b.lookAt = null; if (Math.random() < 0.4) { a.waveUntil = performance.now() + 1600; emote(b, ['🤝', '😄', '👍', '✌️'][(Math.random() * 4) | 0], 2200); } };
    const step = () => {
      if (!avatars.has(a.id) || !avatars.has(b.id) || a.path.length || b.path.length || a.g.position.distanceTo(b.g.position) > 7 || i >= seq.length) return end();
      const [sp, txt] = seq[i++], o = sp === a ? b : a, t0 = performance.now();
      sp.lookAt = o.g.position; o.lookAt = sp.g.position;
      if (sp.pose !== 'sit') sp.faceTo = Math.atan2(o.g.position.x - sp.g.position.x, o.g.position.z - sp.g.position.z);
      if (o.pose !== 'sit') o.faceTo = Math.atan2(sp.g.position.x - o.g.position.x, sp.g.position.z - o.g.position.z);
      say(sp, txt, 4200, true); sp.talkUntil = t0 + 1800 + txt.length * 40;
      if (/haha|😂|lucu/i.test(txt)) { feel(sp, 'laugh', 2000); feel(o, 'laugh', 2000); gesture(o, 'laugh', 1600); }
      else if (/\?/.test(txt)) { gesture(sp, 'shrug', 1400); gesture(o, 'think', 1600); }
      else { if (Math.random() < 0.5) gesture(o, 'nod', 1500); if (Math.random() < 0.35) gesture(sp, 'point', 1400); feel(sp, 'smile', 2000); }
      if (a.until) a.until = Math.max(a.until, t0 + 6000); if (b.until) b.until = Math.max(b.until, t0 + 6000);
      setTimeout(step, 2200 + txt.length * 55);
    };
    step();
  }
  function socialTick(now) {
    if (now < nextSocial) return; nextSocial = now + 1500;
    const free = [];
    for (const a of avatars.values()) {
      if (a.player || a.talkLock || a.e.type !== 'ai' || a.path.length || a.lod >= 3 || now < (a.chatCool || 0) || a.mode === 'meeting' || a.mode === 'talk' || a.mode === 'station' || a.spot?.tag === 'content') continue;
      if (a.mode === 'leisure' || a.mode === 'visit' || (a.mode === 'desk' && want(a) === 'free')) free.push(a);
    }
    if (free.length < 2) return;
    for (let k = 0; k < 6; k++) {
      const a = free[(Math.random() * free.length) | 0]; let best = null, bd = 4.2;
      for (const o of free) { if (o === a) continue; const d = a.g.position.distanceTo(o.g.position); if (d < bd) { bd = d; best = o; } }
      if (best) return startConvo(a, best, now);
    }
  }
  // ───── the player's hands-on actions
  function playerSit(sp) {
    const a = player.a; player.sitting = sp; claimed.set(sp.key, a.id);
    a.g.position.copy(sp.p); a.g.rotation.y = sp.face; a.faceTo = sp.face; a.pose = 'sit'; a.moving = false; a.running = false; a.path = [];
    sfx.play('sit'); onToast?.('🪑 Kamu duduk · tekan E atau gerak untuk berdiri');
  }
  function playerStand() {
    const sp = player?.sitting; if (!sp) return; const a = player.a;
    claimed.delete(sp.key); player.sitting = null; a.pose = 'stand'; a.g.position.x += Math.sin(sp.face) * 0.7; a.g.position.z += Math.cos(sp.face) * 0.7;
  }
  const PDO = {
    stage: ['present', '🎤', 'Kamu naik panggung! Semua menoleh 🎤', 'pop', 'stage'], kiosk: ['drink', '☕', 'Kopi taman, enak ☕', 'pop', 'kiosk'], fountain: ['observe', '⛲', 'Gemericik air mancur 🌿', 'splash', 'fountain'],
    skydeck1: ['observe', '🔭', 'Pemandangan dari Sky Deck ✨', 'pop', 'deck'], skydeck2: ['observe', '🔭', 'Pemandangan dari Sky Deck ✨', 'pop', 'deck'], skydeck3: ['observe', '🔭', 'Pemandangan dari Sky Deck ✨', 'pop', 'deck'], content: ['phone', '🎬', 'Kamera menyala… 🔴 REC', 'rec', 'content'], wellness: ['stretch', '🧘', 'Tarik napas… hembuskan 🧘', 'pop', 'wellness'],
    pitch: ['present', '🤝', 'Pitch dimulai! 🤝', 'pop', 'pitch'], maker: ['pipette', '🧪', 'Eksperimen dulu 🧪', 'pop', 'demo'],
  };
  function playerDo(id) {
    const d = PDO[id]; if (!d || !player) return false; const a = player.a, now = performance.now();
    gesture(a, d[0], 3000); emote(a, d[1], 2600); onToast?.(d[2]); sfx.play(d[3]);
    const l = chat.prof(d[4]); if (l) say(a, l, 3800, true);
    for (const o of avatars.values()) { if (o === a || o.mode === 'meeting' || o.g.position.distanceTo(a.g.position) > 7) continue; if (o.pose !== 'sit') o.lookAt = a.g.position; if (Math.random() < 0.5) gesture(o, id === 'stage' ? 'clap' : 'nod', 2000); if (Math.random() < 0.25) emote(o, '👏', 1800); setTimeout(() => { if (o.lookAt === a.g.position) o.lookAt = null; }, 5000); }
    return true;
  }
  // ───── floating things (lanterns, islands, drones, holo boards)
  let holoT = 0, noteTick = 0;
  function addCurvedFrame(parent, { R, H, t0, tl, pos, glow }) {
    const fr = new THREE.Group(); fr.position.set(pos[0], pos[1], pos[2]); parent.add(fr);
    const metal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.35, flatShading: true, side: THREE.DoubleSide }), glo = new THREE.MeshBasicMaterial({ color: glow, fog: false, side: THREE.DoubleSide });
    fr.add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.18, R + 0.18, H + 0.24, 28, 1, true, t0, tl), metal));
    const sh = new THREE.Shape(), a0 = t0 - Math.PI / 2, a1 = t0 + tl - Math.PI / 2; sh.absarc(0, 0, R + 0.18, a0, a1, false); sh.absarc(0, 0, R - 0.02, a1, a0, true); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 28 }).rotateX(-Math.PI / 2);
    for (const sy of [1, -1]) {
      const m = new THREE.Mesh(rg, metal); m.position.y = sy > 0 ? H / 2 - 0.02 : -H / 2 - 0.12; m.castShadow = true; fr.add(m);
      fr.add(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.012, R - 0.012, 0.035, 28, 1, true, t0, tl), glo)); fr.children[fr.children.length - 1].position.y = sy * (H / 2 - 0.06);
    }
    const gy = -pos[1], pl = pos[1] + H / 2 + 0.1;
    for (const t of [t0, t0 + tl]) {
      const sn = Math.sin(t), cs = Math.cos(t);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, H + 0.28, 0.26), metal); cap.position.set(sn * (R + 0.08), 0, cs * (R + 0.08)); cap.rotation.y = t; fr.add(cap);
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.025, H, 0.025), glo); ln.position.set(sn * (R - 0.01), 0, cs * (R - 0.01)); ln.rotation.y = t; fr.add(ln);
      for (const sy of [0.33, -0.33]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.34), metal); arm.position.set(sn * (R + 0.2), H * sy, cs * (R + 0.2)); arm.rotation.y = t; fr.add(arm); }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, pl, 10), metal); post.position.set(sn * (R + 0.34), gy + pl / 2, cs * (R + 0.34)); post.castShadow = true; fr.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 14), metal); foot.position.set(sn * (R + 0.34), gy + 0.04, cs * (R + 0.34)); fr.add(foot);
      const fring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 4, 18), glo); fring.rotation.x = Math.PI / 2; fring.position.set(sn * (R + 0.34), gy + 0.09, cs * (R + 0.34)); fr.add(fring);
    }
    return fr;
  }
  const mkScreenTex = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return { cv, tex }; };
  /** emissive screen: the front face shows the picture as drawn, the back face mirrors it back so it never reads reversed; a thin scanline drifts down it */
  const mkScreenMat = (tex, glass) => {   // glass = intensity of a see-through hologram: additive, so dark panel fills vanish and only the neon glows; omitted = solid screen
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false, fog: false, ...(glass ? { transparent: true, opacity: glass, depthWrite: false, blending: THREE.AdditiveBlending } : {}) });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = screenT;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <map_fragment>', '#ifdef USE_MAP\n vec2 uvm = vMapUv; if (!gl_FrontFacing) uvm.x = 1.0 - uvm.x;\n vec4 sampledDiffuseColor = texture2D(map, uvm); diffuseColor *= sampledDiffuseColor;\n float sl = smoothstep(0.0, 0.05, 0.05 - abs(fract(uvm.y - uT * 0.06) - 0.5) + 0.45); diffuseColor.rgb *= 0.93 + 0.07 * sin(uvm.y * 380.0 + uT * 3.0) + 0.05 * sl;\n#endif');
    };
    m.customProgramCacheKey = () => 'hitechscreen'; return m;
  };
  const FAMILY = 'Geist, Inter, system-ui, sans-serif';
  // ───── hi-tech interface kit used by the big screens: chamfered panels, neon text, grid, corner brackets, status LEDs
  let uiTick = 0;
  const HT = {
    chamfer(g, x, y, w, h, c = 8) { g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath(); },
    bg(g, W, H, c1, c2, accent) {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = accent + '14'; g.lineWidth = 1; for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      const rg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.strokeStyle = accent; g.lineWidth = 3; const L = 26, m = 8; for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * L); g.lineTo(cx, cy); g.lineTo(cx + sx * L, cy); g.stroke(); }
    },
    glow(g, text, x, y, font, color, blur = 14, align = 'left') { g.save(); g.shadowColor = color; g.shadowBlur = blur; g.fillStyle = color; g.font = font; g.textAlign = align; g.fillText(text, x, y); g.restore(); },
    text(g, text, x, y, font, color, align = 'left') { g.save(); g.fillStyle = color; g.font = font; g.textAlign = align; g.fillText(text, x, y); g.restore(); },
    fit(g, text, maxW) { let t = String(text || ''); if (g.measureText(t).width <= maxW) return t; while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; },
    led(g, x, y, on, color) { g.save(); g.shadowColor = color; g.shadowBlur = on ? 14 : 0; g.fillStyle = on ? color : color + '55'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.restore(); },
    ring(g, x, y, r, frac, color) { g.save(); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.shadowColor = color; g.shadowBlur = 10; g.strokeStyle = color; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(1, frac))); g.stroke(); g.restore(); },
    hex(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); },
  };
  const clean = (t) => String(t || '').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
  const nameOf = (emps, id) => (emps.find((e) => e.id === id)?.name || 'Sistem').split(' ')[0];
  function drawKanban(g, W, H, emps, tasks) {
    HT.bg(g, W, H, '#050b1c', '#0b2236', '#22d3ee');
    HT.glow(g, '◈ PAPAN TUGAS', 28, 40, '700 24px ' + FAMILY, '#22d3ee', 12); HT.led(g, W - 40, 32, uiTick % 2 === 0, '#34d399'); HT.text(g, 'LIVE', W - 54, 38, '600 13px ' + FAMILY, '#8fe9ff', 'right');
    const cols = [['TO DO', ['todo'], '#5b8cff'], ['DIKERJAKAN', ['in_progress'], '#34d399'], ['SELESAI', ['done'], '#a78bfa']], cw = (W - 28 * 2 - 14 * 2) / 3;
    cols.forEach(([label, ids, c], i) => {
      const x = 28 + i * (cw + 14), list = tasks.filter((t) => ids.includes(t.status)), y0 = 60;
      HT.chamfer(g, x, y0, cw, H - y0 - 24, 12); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill(); g.strokeStyle = c + '88'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = c; g.fillRect(x + 14, y0 + 10, 26, 4);
      HT.text(g, label, x + 14, y0 + 40, '700 18px ' + FAMILY, '#e6f4ff'); HT.glow(g, String(list.length), x + cw - 14, y0 + 40, '700 24px ' + FAMILY, c, 10, 'right');
      list.slice(-4).reverse().forEach((t, k) => { const y = y0 + 58 + k * 62; HT.chamfer(g, x + 10, y, cw - 20, 52, 8); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); g.fillStyle = c; g.fillRect(x + 10, y + 6, 4, 40); g.font = '600 15px ' + FAMILY; HT.text(g, HT.fit(g, clean(t.title), cw - 52), x + 24, y + 22, '600 15px ' + FAMILY, '#f2f7ff'); HT.text(g, nameOf(emps, t.assigneeId), x + 24, y + 42, '500 13px ' + FAMILY, '#8fb4d8'); });
      if (!list.length) HT.text(g, 'kosong', x + cw / 2, y0 + 140, '500 16px ' + FAMILY, '#5b7490', 'center');
    });
  }
  function drawScreens() {
    uiTick++;
    const emps = data?.employees || [], tasks = data?.tasks || [], apps = data?.approvals || [];
    if (screens.dash) {
      const { cv, tex } = screens.dash, g = cv.getContext('2d'), W = cv.width, H = cv.height;
      HT.bg(g, W, H, '#040a1a', '#0a1b3d', '#38bdf8');
      HT.glow(g, '◈ RAIVERSE // COMMAND DECK', 30, 40, '700 24px ' + FAMILY, '#38bdf8', 14);
      const now = new Date(), hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      HT.led(g, W - 150, 32, uiTick % 2 === 0, '#34d399'); HT.text(g, 'LIVE', W - 136, 38, '600 14px ' + FAMILY, '#8fe9ff'); HT.text(g, hh, W - 34, 40, '600 20px ' + FAMILY, '#cfe9ff', 'right');
      const t0 = new Date().setHours(0, 0, 0, 0), ai = emps.filter((e) => e.type === 'ai').length, act = emps.filter((e) => e.status === 'working' || e.status === 'meeting').length, active = tasks.filter((x) => x.status !== 'done').length, doneT = tasks.filter((x) => x.status === 'done' && (x.completedAt || 0) >= t0).length, pend = apps.filter((x) => x.status === 'pending').length;
      const kp = [['AGEN AKTIF', act, '#34d399', ai ? act / ai : 0], ['TUGAS AKTIF', active, '#38bdf8', tasks.length ? active / tasks.length : 0], ['SELESAI HARI INI', doneT, '#a78bfa', Math.min(1, doneT / Math.max(1, doneT + active))], ['PERSETUJUAN', pend, '#fbbf24', Math.min(1, pend / 5)]], kw = (W - 30 * 2 - 14 * 3) / 4;
      kp.forEach(([l, n, c, fr], i) => { const x = 30 + i * (kw + 14), y = 62; HT.chamfer(g, x, y, kw, 104, 12); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill(); g.strokeStyle = c + '99'; g.lineWidth = 1.5; g.stroke(); HT.glow(g, String(n), x + 18, y + 66, '700 50px ' + FAMILY, c, 14); HT.text(g, l, x + 18, y + 92, '600 13px ' + FAMILY, '#9fc3e6'); HT.ring(g, x + kw - 40, y + 50, 22, fr, c); });
      // flow bars
      HT.chamfer(g, 30, 184, 470, 226, 12); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fill(); g.strokeStyle = '#38bdf855'; g.stroke(); HT.text(g, 'ALUR TUGAS', 48, 212, '700 15px ' + FAMILY, '#8fe9ff');
      const cols = [['TO DO', 'todo', '#5b8cff'], ['JALAN', 'in_progress', '#34d399'], ['TUNGGU', 'waiting', '#f59e0b'], ['REVIEW', 'review', '#ec4899'], ['SELESAI', 'done', '#a78bfa']], cnt = cols.map(([, id]) => tasks.filter((x) => (id === 'waiting' ? x.status === 'waiting' || x.status === 'blocked' : x.status === id)).length), mx = Math.max(1, ...cnt);
      cols.forEach(([l, , c], i) => { const x = 54 + i * 88, bh = Math.max(6, Math.round((118 * cnt[i]) / mx)), y = 376 - bh; const gr = g.createLinearGradient(0, y, 0, 376); gr.addColorStop(0, c); gr.addColorStop(1, c + '33'); g.save(); g.shadowColor = c; g.shadowBlur = 12; g.fillStyle = gr; HT.chamfer(g, x, y, 56, bh, 5); g.fill(); g.restore(); HT.text(g, String(cnt[i]), x + 28, y - 8, '700 16px ' + FAMILY, '#e6f4ff', 'center'); HT.text(g, l, x + 28, 398, '600 11px ' + FAMILY, '#8fb4d8', 'center'); });
      // queue
      HT.chamfer(g, 518, 184, W - 548, 226, 12); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fill(); g.strokeStyle = '#38bdf855'; g.stroke(); HT.text(g, 'ANTRIAN TERBARU', 536, 212, '700 15px ' + FAMILY, '#8fe9ff');
      const SC = { todo: ['#5b8cff', 'TODO'], in_progress: ['#34d399', 'JALAN'], waiting: ['#f59e0b', 'TUNGGU'], blocked: ['#f59e0b', 'TUNGGU'], review: ['#ec4899', 'REVIEW'] };
      tasks.filter((x) => x.status !== 'done').slice(-4).reverse().forEach((x, i) => { const y = 224 + i * 45, c = SC[x.status] || ['#38bdf8', '•']; HT.chamfer(g, 536, y, W - 584, 38, 8); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill(); g.fillStyle = c[0]; g.fillRect(536, y + 5, 4, 28); HT.text(g, c[1], 552, y + 24, '700 12px ' + FAMILY, c[0]); g.font = '600 16px ' + FAMILY; HT.text(g, HT.fit(g, clean(x.title), W - 584 - 200), 612, y + 25, '600 16px ' + FAMILY, '#f2f7ff'); HT.text(g, nameOf(emps, x.assigneeId), W - 52, y + 24, '500 13px ' + FAMILY, '#8fb4d8', 'right'); });
      HT.text(g, 'SINKRON · ' + ai + ' AGEN · ' + tasks.length + ' TUGAS TERCATAT', 30, H - 14, '500 12px ' + FAMILY, '#6f93b8');
      tex.needsUpdate = true;
    }
    if (screens.feed) {
      const { cv, tex } = screens.feed, g = cv.getContext('2d'), W = cv.width, H = cv.height;
      HT.bg(g, W, H, '#12061c', '#2a0f3c', '#e879f9');
      HT.glow(g, '◈ COMMS // AKTIVITAS LIVE', 30, 40, '700 24px ' + FAMILY, '#e879f9', 14); HT.led(g, W - 80, 32, uiTick % 2 === 0, '#22d3ee'); HT.text(g, 'LIVE', W - 66, 38, '600 14px ' + FAMILY, '#f0abfc');
      const cl = ['#22d3ee', '#e879f9', '#a78bfa', '#f472b6', '#38bdf8'];
      (data?.messages || []).slice(-6).reverse().forEach((m, i) => { const y = 60 + i * 56, nm = nameOf(emps, m.authorId), c = cl[i % cl.length]; HT.chamfer(g, 30, y, W - 60, 48, 10); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill(); g.strokeStyle = c + '66'; g.lineWidth = 1.2; g.stroke(); g.save(); HT.hex(g, 62, y + 24, 17); g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10; g.fill(); g.restore(); HT.text(g, (nm[0] || '?').toUpperCase(), 62, y + 31, '700 18px ' + FAMILY, '#12061c', 'center'); HT.text(g, nm, 94, y + 20, '700 15px ' + FAMILY, c); g.font = '500 17px ' + FAMILY; HT.text(g, HT.fit(g, clean(m.text), W - 60 - 80), 94, y + 40, '500 17px ' + FAMILY, '#fbeaff'); });
      if (!(data?.messages || []).length) HT.text(g, 'belum ada percakapan', W / 2, H / 2, '500 20px ' + FAMILY, '#a78bfa', 'center');
      tex.needsUpdate = true;
    }
    for (const f of appDraws) f(emps, tasks, apps);
  }
  function drawHolo(t) {
    const emps = data?.employees || [], t0 = new Date().setHours(0, 0, 0, 0), act = emps.filter((e) => e.status === 'working' || e.status === 'meeting').length, tasks = data?.tasks?.filter((x) => x.status !== 'done').length ?? 0, done = data?.tasks?.filter((x) => x.status === 'done' && (x.completedAt || 0) >= t0).length ?? 0;
    const FAM = 'Geist, Inter, system-ui, sans-serif';
    const pages = [
      { k: 'KANTOR HARI INI', m: [[act, 'aktif'], [tasks, 'tugas'], [done, 'selesai']] },
      { k: 'PINTASAN', keys: [['E', 'duduk / gunakan'], ['M', 'suara'], ['H', 'bantuan']] },
      { k: 'PLAZA TENGAH', big: fmtTod(), sub: 'Selamat datang 👋' },
      { k: 'TIM', big: String(emps.length), sub: 'agen siap bekerja & bergaul' },
    ];
    for (const f of floaters) {
      if (f.kind !== 'holo') continue; const g = f.cv.getContext('2d'), p = pages[(f.page + Math.floor(t / 8)) % pages.length], W = 768, H = 432;
      g.clearRect(0, 0, W, H);
      const rrp = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(50,60,140,0.25)'; g.shadowBlur = 24; g.shadowOffsetY = 6; const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,0.62)'); gr.addColorStop(1, 'rgba(226,230,255,0.42)'); g.fillStyle = gr; rrp(28, 28, W - 56, H - 56, 34); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; rrp(28, 28, W - 56, H - 56, 34); g.stroke();
      g.fillStyle = '#7c83ff'; g.beginPath(); g.arc(78, 84, 8, 0, 7); g.fill();
      g.fillStyle = '#5d6490'; g.font = '600 24px ' + FAM; g.textBaseline = 'middle'; g.fillText(p.k, 98, 85);
      g.fillStyle = '#2a3250';
      if (p.m) p.m.forEach(([n, l], i) => { const x = 78 + i * 220; g.font = '700 92px ' + FAM; g.fillText(String(n), x, 218); g.fillStyle = '#6a7199'; g.font = '500 28px ' + FAM; g.fillText(l, x + 2, 288); g.fillStyle = '#2a3250'; });
      else if (p.keys) p.keys.forEach(([kk, l], i) => { const y = 160 + i * 74; g.fillStyle = 'rgba(124,131,255,0.16)'; rrp(78, y - 26, 58, 52, 14); g.fill(); g.fillStyle = '#4b53c9'; g.font = '700 30px ' + FAM; g.textAlign = 'center'; g.fillText(kk, 107, y + 1); g.textAlign = 'left'; g.fillStyle = '#2a3250'; g.font = '500 32px ' + FAM; g.fillText(l, 160, y + 1); });
      else { g.font = '700 104px ' + FAM; g.fillText(p.big, 78, 212); g.fillStyle = '#6a7199'; g.font = '500 32px ' + FAM; g.fillText(p.sub, 80, 292); }
      f.tex.needsUpdate = true;
    }
  }
  function refreshBrainNotes() {
    if (!brainCore) return; const notes = (data?.notes || []).filter((n) => n.title); if (!notes.length) return;
    brainCore.pool = notes;
    if (brainCore.notes.length) return;
    for (let i = 0; i < 5; i++) { const c = { s: null, a: (i / 5) * Math.PI * 2, r: 3.7 + (i % 3) * 0.5, y: 2.3 + (i % 3) * 1.5 + (i > 2 ? 0.6 : 0), sp: (0.06 + (i % 3) * 0.02) * (i % 2 ? 1 : -1), ph: i, t0: performance.now() - i * 2200, life: 9000 + i * 700 }; brainCore.notes.push(c); brainCardSwap(c); }
  }
  /** a brain card is a tiny frosted violet chip (not a speech bubble): it fades in, holds, fades out and comes back with another note */
  function brainCardSwap(c) {
    if (c.s) { const i = pickables.indexOf(c.s); if (i >= 0) pickables.splice(i, 1); disposeSprite(c.s); }
    const pool = brainCore.pool || [], n = pool[(Math.random() * pool.length) | 0]; if (!n) return;
    const s2 = textSprite([String(n.title).slice(0, 30)], { glass: true, tint: [236, 226, 255], a0: 0.4, a1: 0.22, fg: '#3b2f6b', size: 12, scale: 0.0042, accent: 'rgba(176,140,255,0.95)' });
    s2.userData.brain = true; s2.userData.keep = true; s2.material.opacity = 0; brainCore.group.add(s2); pickables.push(s2); c.s = s2; c.t0 = performance.now();
  }
  /** touching the Brain: a big flare, three shock rings, sparks and a bell; the rings and neurons speed up for a while */
  function brainTouch() {
    if (!brainCore) return; brainCore.pulse = 1.5; brainCore.spin = 1;
    [0, 260, 520].forEach((d, k) => setTimeout(() => shock(brainFlat(), [0xffd9a8, 0x8fd0ff, 0xc9a0ff][k], 10 + k * 5, 0.75), d));
    sparkBurst(toWorld(brainFlat()), 0xffd9a8); sfx.play('brain'); setTimeout(() => sfx.play('absorb'), 220);
  }
  function animateFloaters(t, dt) {
    if (grassU) grassU.value = t;
    screenT.value = t;
    if (glowRef) glowRef.emissiveIntensity = 1.5 * (0.88 + 0.12 * Math.sin(t * 0.9));
    for (const pm of pulseMats) pm.m.emissiveIntensity = pm.base + Math.sin(t * pm.sp + pm.ph) * pm.amp;
    updateFlows(dt);
    if (fountainFx) fountainFx.update(t, dt);
    if (spotIds.size || spotBeams.size) updateSpots(t);
    if (grassMeshes.length) { const far = camera.position.y > 70; for (const m of grassMeshes) { m.visible = !far; m.count = perfLite ? Math.floor(m.userData.full * 0.5) : m.userData.full; } }
    for (const f of floaters) {
      if (f.kind === 'rec') { f.m.visible = Math.floor(t * 1.2) % 2 === 0; continue; }
      if (f.kind === 'drone') { f.a += f.sp * dt; f.m.position.set(Math.cos(f.a) * f.r, f.h + Math.sin(t * 0.7 + f.ph) * 0.8, Math.sin(f.a) * f.r * 0.85); f.m.rotation.y = -f.a * (f.sp > 0 ? 1 : -1); f.led.visible = Math.floor(t * 3 + f.ph) % 2 === 0; for (const r of f.rot) r.rotation.y += dt * 45; continue; }
      f.a += f.sp * dt;
      if (f.kind === 'holo') { f.m.position.set(Math.cos(f.a) * f.r, f.h + Math.sin(t * 0.6 + f.ph) * 0.3, Math.sin(f.a) * f.r); f.m.lookAt(camera.position.x, f.m.position.y, camera.position.z); { const dd = f.m.position.distanceTo(camera.position), k = dd < 9 ? dd / 9 : 1 - Math.max(0, (dd - 38) / 40); f.m.material.opacity = Math.max(0, Math.min(0.95, k)); f.m.visible = f.m.material.opacity > 0.03; } continue; }
      f.m.position.set(Math.cos(f.a) * f.r, f.h + Math.sin(t * 0.8 + f.ph) * (f.kind === 'lantern' ? 0.35 : 0.18), Math.sin(f.a) * f.r);
      if (f.kind === 'island') f.m.rotation.y += dt * 0.1;
    }
    for (const f of appFx) f(t, dt);
    if (t > holoT) { holoT = t + 3.5; drawHolo(t); drawScreens(); if (!brainCore?.notes.length || (++noteTick % 4) === 0) refreshBrainNotes(); }
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
  function applyWant(a) { a.urgent = true; try { applyWantInner(a); } finally { a.urgent = false; } }   /* work-driven trips may teleport or run */
  function applyWantInner(a) {
    if (a.player || followers.has(a.id)) return;
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
  /** the Company Brain core lives in its room frame: this is where it stands in the flat plan */
  const brainFlat = () => { const g = brainCore.group.position, r = brainCore.room; if (!r) return new THREE.Vector3(g.x, brainCore.top || 0, g.z); const [x, z] = r.T.pt(g.x, g.z); return new THREE.Vector3(x, g.y, z); };
  function packet(from, to, color, onDone) {
    if (!from || !to) return;
    from = toWorld(from); to = toWorld(to);
    const mid = from.clone().add(to).multiplyScalar(0.5); mid.y += 2.5 + from.distanceTo(to) * 0.15;
    const curve = new THREE.QuadraticBezierCurve3(from.clone().setY(from.y + 1.8), mid, to.clone().setY(to.y + 1.8));
    const m = new THREE.Mesh(G.packet, new THREE.MeshBasicMaterial({ color, transparent: true }));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.75 }));
    line.computeLineDistances(); world.add(m, line);
    packets.push({ curve, m, line, t: 0, speed: 0.6 / Math.max(1, from.distanceTo(to) / 14), onDone });
  }
  /** big expanding light ring on the ground (used by the brain); pos is in plan coordinates */
  function shock(pos, color, big = 12, spd = 0.7) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; toWorld(pos, ring.position); ring.position.y = 0.45; world.add(ring); packets.push({ ring, t: 0, big, spd });
  }
  const brainHit = (col = 0xffb36b, snd = 'brain') => { if (!brainCore) return; brainCore.pulse = 1; shock(brainFlat(), col); sfx.play(snd); };
  let haloTex = null; const flowSparks = [];
  function disposeFlow(f) { for (const o of [f.tube, f.orb, f.halo, ...f.beads]) { if (!o) continue; o.parent?.remove(o); o.geometry?.dispose?.(); o.material?.dispose?.(); } f.dead = true; }
  /** an agent's new knowledge travels to the Company Brain: clear line + orb + trail, then a flash, ring, sparks and a bell */
  function knowledgeFlow(a, color = 0xffb36b) {
    if (!a || !brainCore) return;
    if (!haloTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); haloTex = new THREE.CanvasTexture(c); }
    const from = toWorld(a.g.position); from.y += 1.7; const to = toWorld(brainFlat()); const mid = from.clone().add(to).multiplyScalar(0.5); mid.y += 5 + from.distanceTo(to) * 0.18;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to), mat = () => new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.07, 6, false), mat()); tube.frustumCulled = false; tube.material.opacity = 0.85; tube.geometry.setDrawRange(0, 0);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat()); orb.material.opacity = 1; orb.frustumCulled = false;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.set(2.6, 2.6, 1);
    const beads = []; for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16 - i * 0.012, 8, 6), mat()); b.material.opacity = 0.75 - i * 0.07; b.frustumCulled = false; beads.push(b); world.add(b); }
    world.add(tube, orb, halo);
    flows.push({ curve, tube, orb, halo, beads, t: 0, dur: THREE.MathUtils.clamp(from.distanceTo(to) / 14, 1.6, 3.6), color, count: tube.geometry.index.count, arrived: false, fade: 0 });
    emote(a, '💡', 1800); sfx.play('brain');
  }
  function sparkBurst(pos, color) {
    const N = 36, p = new Float32Array(N * 3), v = []; for (let i = 0; i < N; i++) { p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z; const a = Math.random() * 6.28, u = Math.random() * 2 - 1, k = Math.sqrt(1 - u * u), sp = 3 + Math.random() * 5; v.push(Math.cos(a) * k * sp, u * sp + 2, Math.sin(a) * k * sp); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.3, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); pts.frustumCulled = false; world.add(pts);
    flowSparks.push({ pts, p, v, t: 0 });
  }
  function updateFlows(dt) {
    for (let i = flows.length - 1; i >= 0; i--) {
      const f = flows[i];
      if (!f.arrived) {
        f.t += dt / f.dur; const t = Math.min(1, f.t), e = t * t * (3 - 2 * t);
        f.tube.geometry.setDrawRange(0, Math.floor(f.count * Math.min(1, e * 1.35))); f.orb.position.copy(f.curve.getPoint(e)); f.halo.position.copy(f.orb.position); f.orb.scale.setScalar(1 + Math.sin(f.t * 30) * 0.12);
        f.beads.forEach((b, k) => b.position.copy(f.curve.getPoint(Math.max(0, e - (k + 1) * 0.03))));
        if (f.t >= 1) { f.arrived = true; brainHit(f.color, 'absorb'); sparkBurst(f.curve.getPoint(1), f.color); f.orb.visible = f.halo.visible = false; for (const b of f.beads) b.visible = false; shock(brainFlat(), f.color, 7, 1.1); }
      } else { f.fade += dt / 0.9; f.tube.material.opacity = Math.max(0, 0.85 * (1 - f.fade)); if (f.fade >= 1) { disposeFlow(f); flows.splice(i, 1); } }
    }
    for (let i = flowSparks.length - 1; i >= 0; i--) {
      const sp = flowSparks[i]; sp.t += dt; const pos = sp.p;
      for (let k = 0; k < pos.length / 3; k++) { sp.v[k * 3 + 1] -= 9 * dt; pos[k * 3] += sp.v[k * 3] * dt; pos[k * 3 + 1] += sp.v[k * 3 + 1] * dt; pos[k * 3 + 2] += sp.v[k * 3 + 2] * dt; }
      sp.pts.geometry.attributes.position.needsUpdate = true; sp.pts.material.opacity = Math.max(0, 1 - sp.t / 1.1);
      if (sp.t > 1.1) { sp.pts.parent?.remove(sp.pts); sp.pts.geometry.dispose(); sp.pts.material.dispose(); flowSparks.splice(i, 1); }
    }
  }
  function burst(pos, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; toWorld(pos, ring.position); ring.position.y += 0.06 - pos.y; world.add(ring); packets.push({ ring, t: 0 });
  }

  // ───── public sync
  function sync(next) {
    data = next;
    const key = data.divisions.map((d) => d.id + d.color + d.name).join() + '|' + data.employees.map((e) => e.id + e.divisionId + e.isLead + e.type).join();
    if (key !== layoutKey) {
      layoutKey = key; build(); mergeWalls();
      for (const r of rooms.values()) {
        if (!r.deskSlots) continue;
        const members = data.employees.filter((e) => e.divisionId === r.id).sort((a, b) => (b.isLead - a.isLead) || a.name.localeCompare(b.name));
        const slots = r.deskSlots(members.length);
        members.forEach((e, i) => { roomFrame = r.T; const d = buildDesk(r, slots[i], e); roomFrame = null; const [sx, sz] = r.T.pt(d.seat.x, d.seat.z); d.seat.set(sx, 0, sz); d.facing += r.T.th; r.desks.push(d); buildAvatar(e, d); });
        freeSpots(r);
      }
      mergeStatic();
    }
    for (const e of data.employees) {
      let a = avatars.get(e.id); if (!a) continue;
      if (JSON.stringify(e.appearance || {}) !== a.looks) a = rebuildAvatar(e) || a;
      const prevStatus = a.e.status, prevText = a.e.statusText;
      a.e = e;
      a.statusDot.material.color.setHex(STATUS_COLOR[e.status] ?? STATUS_COLOR.idle);
      deskScreen(a);
      if (a.visor) a.visor.visible = e.status !== 'offline';
      updateLabel(a);
      /* a status change must never cover real dialogue: in meetings the words said ARE the bubble, and a line someone is still saying stays up */
      if (prevText !== e.statusText && e.status !== 'idle' && e.status !== 'meeting' && e.statusText && !(performance.now() < (a.speechUntil || 0))) say(a, e.statusText);
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
      r.sign.position.set(r.cx, 7.4, r.cz); r.sign.visible = !player; floors[0].add(r.sign);
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
    if (ev.type === 'follow') return startFollow(ev.actorId, ev.targetId);
    if (ev.type === 'unfollow') return stopFollow(ev.actorId);
    const a = avatars.get(ev.actorId), b = avatars.get(ev.targetId);
    const col = (x) => new THREE.Color(x?.desk.room.div?.color || '#d8c3a5');
    switch (ev.type) {
      case 'delegated': case 'handoff': case 'task_created':
        if (ev.type === 'task_created') { sfx.play('task'); if (brainCore) { brainHit(0x8fd0ff, 'brain'); if (b) packet(brainFlat(), b.desk.seat, 0x8fd0ff); } } else if (ev.type === 'delegated') sfx.play('task');
        if (a && b) { packet(a.g.position, b.desk.seat, col(a), () => { burst(b.desk.seat, col(a)); emote(b, '📥', 2200); feel(b, 'surprised', 900); setTimeout(() => feel(b, 'focus', 3000), 900); }); if (ev.type !== 'task_created') { gesture(a, 'point', 1600); emote(a, '📨', 2000); if (Math.random() < 0.55) visit(a, b); } }
        break;
      case 'message': sfx.play('msg'); if (a) { const txt = String(ev.text).split(': ').slice(1).join(': ') || ev.text; if (a.mode !== 'talk') speak(a, txt, 2); a.talkUntil = performance.now() + Math.min(9000, 1800 + txt.length * 45); a.speechUntil = a.talkUntil;
        if (/haha|wkwk|😂|🎉|mantap|selamat|keren/i.test(txt)) { feel(a, 'laugh', 2500); gesture(a, 'laugh', 1800); } else if (/maaf|gagal|sayang|kendala|masalah/i.test(txt)) feel(a, 'sad', 3000); else if (/\?/.test(txt)) gesture(a, 'shrug', 1500); else if (Math.random() < 0.4) gesture(a, 'present', 2500); if (b) { packet(a.g.position, b.g.position, 0x9ecbff); a.lookAt = b.g.position; setTimeout(() => { if (a.lookAt === b.g.position) a.lookAt = null; }, 4000); if (Math.random() < 0.3) visit(a, b); } } break;
      case 'reasoning': if (a) { say(a, '💭 ' + ev.text, 7000, true); a.talkUntil = performance.now() + 6500; gesture(a, 'think', 4200); feel(a, 'focus', 5000); emote(a, '💭', 2600); } break;
      case 'meeting_say': if (a) {
        say(a, ev.text, 9000, true); a.speechUntil = performance.now() + 9000; a.talkUntil = performance.now() + 6000; gesture(a, 'present', 4000);
        for (const o of avatars.values()) if (o !== a && o.mode === 'meeting' && Math.random() < 0.35) gesture(o, 'observe', 4000);
        if (/setuju|sepakat|bagus|tepat|agree/i.test(ev.text)) for (const o of avatars.values()) if (o !== a && o.mode === 'meeting' && Math.random() < 0.5) gesture(o, 'nod', 2500);
        if (/\?|bagaimana|apakah|kenapa/i.test(ev.text)) gesture(a, 'shrug', 1800); else if (/risiko|masalah|hati-hati|kendala/i.test(ev.text)) gesture(a, 'think', 2600);
        for (const o of avatars.values()) if (o !== a && o.mode === 'meeting') o.lookAt = a.g.position;
      } break;
      case 'meeting_done': for (const o of avatars.values()) if (o.mode === 'meeting') { o.lookAt = null; gesture(o, 'clap', 2000); emote(o, '👏', 2200); } break;
      case 'meeting': sfx.play('meeting'); if (a) emote(a, '🗓️', 2600); break;
      case 'hired': sfx.play('hire'); if (a) { a.waveUntil = performance.now() + 2500; emote(a, '🤝', 2600); feel(a, 'smile', 3000); } if (b) { b.waveUntil = performance.now() + 3000; emote(b, '👋', 3000); feel(b, 'love', 2500); } break;
      case 'alert': sfx.play('alert'); if (a) { gesture(a, 'facepalm', 2400); feel(a, 'sad', 4000); emote(a, '😵', 2800); setTimeout(() => gesture(a, 'sad', 2500), 2400); } break;
      case 'learned': if (a && brainCore) knowledgeFlow(a, 0xffb36b); if (a) { gesture(a, 'think', 2600); emote(a, '💡', 3000); feel(a, 'surprised', 700); setTimeout(() => feel(a, 'smile', 2500), 700); say(a, '💡 ' + (String(ev.text).split('belajar: ')[1] || String(ev.text).split(': ').slice(1).join(': ') || ''), 5000, true); if (brainCore) packet(a.g.position, brainFlat(), 0x8fd3ff, () => { brainCore.pulse = 0.6; }); } break;
      case 'scheduled': if (a) { say(a, '⏰ Jadwal dibuat', 3000); emote(a, '⏰'); } break;
      case 'note_written': if (a) emote(a, /merapikan|rapikan/.test(ev.text) ? '🗂️' : '📝', 2200);
        if (a && brainCore) knowledgeFlow(a, 0xffb36b); break;
      case 'task_done': sfx.play('done'); if (a) { burst(a.g.position, 0x3ddc84); say(a, '✓ Selesai', 2500); feel(a, Math.random() < 0.5 ? 'laugh' : 'smile', 3000); emote(a, ['🎉', '✅', '😄', '💪'][(Math.random() * 4) | 0], 2800); if (a.pose !== 'sit') { a.jump = 1; gesture(a, 'cheer', 1800); } else gesture(a, 'stretch', 1600); } break;
      case 'approval_requested': sfx.play('ask'); if (a) { say(a, '⏸ Menunggu persetujuan', 5000); emote(a, '✋', 3000); const o = avatars.get('owner'); if (o) packet(a.g.position, o.g.position, 0xffb020); } break;
      case 'approved': sfx.play('approved'); if (b) { burst(b.g.position, 0xf5c76b); say(b, 'Disetujui', 2500); emote(b, '🥳', 3000); gesture(b, 'cheer', 2000); feel(b, 'laugh', 2600); if (b.pose !== 'sit') b.jump = 1; } break;
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
    const t = wp(a);
    const wy = yawW(a), fwd = new THREE.Vector3(Math.sin(wy), 0, Math.cos(wy));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    animateTo(t.clone().addScaledVector(fwd, -5.8).addScaledVector(side, 3.6).add(new THREE.Vector3(0, 5, 0)), t.clone().addScaledVector(fwd, 0.6).setY(t.y + 1.1));
  }
  function highlight() { for (const a of avatars.values()) { const s = a.id === selectedId ? 1.45 : 1; a.ring.scale.setScalar(s); a.pad.scale.setScalar(s); } }

  // ───── follow-cam: click an agent → the camera rides behind them (orbitable), like controlling your own character
  let chaseId = null, lastDrag = 0;
  function startChase(id) {
    const a = avatars.get(id); if (!a || player) return;
    chaseId = id; selectedId = id; follow = false; highlight();
    const wy = yawW(a), fwd = new THREE.Vector3(Math.sin(wy), 0, Math.cos(wy));
    const t = wpY(a, (a.topY || 1.3) * 0.6);
    animateTo(t.clone().addScaledVector(fwd, -3.2).add(new THREE.Vector3(0, 1.5, 0)), t);
    onFollow?.(id);
  }
  function stopChase() { if (!chaseId) return; chaseId = null; selectedId = null; highlight(); onFollow?.(null); }
  function updateChase(dt) {
    const a = avatars.get(chaseId); if (!a) return stopChase();
    const t = wpY(a, (a.topY || 1.3) * (a.pose === 'sit' ? 0.45 : 0.6));
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
  // ───── conversation with the player: the agent visibly thinks while waiting, then answers in tidy sentence-sized bubbles with matching expressions
  const cleanText = (t) => String(t).replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>|~]+/g, '').replace(/\s+/g, ' ').trim();
  function chunkText(t, max) {
    const parts = cleanText(t).split(/(?<=[.!?…])\s+/), out = []; let cur = '';
    for (const p of parts) { if ((cur + ' ' + p).trim().length <= 110) cur = (cur + ' ' + p).trim(); else { if (cur) out.push(cur); cur = p.length > 140 ? p.slice(0, 137) + '…' : p; } }
    if (cur) out.push(cur); return out.slice(0, max);
  }
  function stopThinking(a) { if (!a) return; a.thinking = false; clearInterval(a.thinkT); a.thinkT = 0; }
  function think(id) {
    const a = avatars.get(id); if (!a) return; stopThinking(a); a.thinking = true; a.speakId = (a.speakId || 0) + 1;
    const t0 = performance.now(), dots = ['💭  ●  ○  ○', '💭  ○  ●  ○', '💭  ○  ○  ●', '💭  ○  ●  ○']; let k = 0;
    gesture(a, 'think', 2600); feel(a, 'think', 2600); emote(a, '🤔', 1800); sfx.play('pop');
    a.thinkT = setInterval(() => {
      if (!a.thinking || performance.now() - t0 > 45000 || !avatars.has(a.id)) return stopThinking(a);
      say(a, dots[k++ % dots.length], 700, false);
      if (k % 6 === 0) { gesture(a, Math.random() < 0.6 ? 'think' : 'observe', 2400); feel(a, 'think', 2400); }
    }, 450);
  }
  function reactTo(a, c, first) {
    if (first && /^(hai|halo|hi|hei|selamat (pagi|siang|sore|malam))/i.test(c)) { a.waveUntil = performance.now() + 1600; feel(a, 'smile', 2400); return; }
    if (/maaf|gagal|sayang|belum bisa|tidak bisa|kendala/i.test(c)) { feel(a, 'sad', 2600); gesture(a, 'shrug', 1800); }
    else if (/terima kasih|makasih|senang|bagus|mantap|keren|berhasil|selesai|siap/i.test(c)) { feel(a, 'smile', 2600); gesture(a, Math.random() < 0.5 ? 'nod' : 'laugh', 1800); }
    else if (/\?\s*$/.test(c)) { feel(a, 'focus', 2400); gesture(a, 'think', 2000); }
    else if (/langkah|pertama|kedua|berikut|\b1[.)]/i.test(c)) gesture(a, 'point', 2200);
    else gesture(a, ['present', 'nod', 'present', 'observe'][(Math.random() * 4) | 0], 2200);
  }
  function speak(id, text, max = 4) {
    const a = typeof id === 'string' ? avatars.get(id) : id; if (!a) return;
    const cs = chunkText(text, max); if (!cs.length) return;
    stopThinking(a); const mine = (a.speakId = (a.speakId || 0) + 1); let t = 0;
    cs.forEach((c, i) => {
      setTimeout(() => {
        if (a.speakId !== mine || !avatars.has(a.id)) return;
        say(a, c, Math.max(2800, 1500 + c.length * 60), true); a.talkUntil = performance.now() + 1200 + c.length * 45; sfx.play('msg'); reactTo(a, c, i === 0);
        if (player?.a) a.lookAt = player.a.g.position;
      }, t);
      t += Math.max(2600, 1400 + c.length * 55);
    });
  }
  function listen(id) { const a = avatars.get(id); if (!a) return; gesture(a, Math.random() < 0.5 ? 'nod' : 'think', 2200); feel(a, 'focus', 2200); }

  // ───── Enscape-style navigation without entering Play: WASD fly, E/Q up/down, Shift fast, Alt faster,
  // numpad standard views, U/I time of day, Shift+U/I solar angle, B bookmark view, PageUp/PageDown cycle, H help
  const fly = new Set();
  const NOOP = () => {};
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 320); dots.frustumCulled = false; dots.count = 0; dots.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(dots);
  const dotM = new THREE.Matrix4(), dotP = new THREE.Vector3(), dotS = new THREE.Vector3(1, 1.7, 1), dotQ = new THREE.Quaternion();
  const frustum = new THREE.Frustum(), frustumM = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let clockAcc = 0, fogNight = 0, autoDay = true, dayAcc = 0, tod = 10, solarAz = 0.6, favIdx = -1;
  const favs = (() => { try { return JSON.parse(localStorage.getItem('rayFavViews') || '[]'); } catch { return []; } })();
  const saveFavs = () => { try { localStorage.setItem('rayFavViews', JSON.stringify(favs.slice(-9))); } catch { /* ignore */ } };
  // Walk vs Fly (Enscape / SketchUp Walk mode): Walk keeps the eye at head height, moves on the floor only and is blocked by walls and furniture.
  // Fly (default) moves freely in 3D. Toggle with Space (or the 🚶 button).
  let walkMode = false;
  const EYE = 1.65, EYE_TARGET = 1.35;
  const FREE_CAM = { minDistance: 2.2, maxDistance: 200, rotateSpeed: 0.7, minPolarAngle: 0.05, maxPolarAngle: Math.PI * 0.97, enableZoom: true, enablePan: true };
  const WALK_CAM = { minDistance: 0.3, maxDistance: 0.3, rotateSpeed: -0.45, minPolarAngle: Math.PI * 0.22, maxPolarAngle: Math.PI * 0.8, enableZoom: false, enablePan: false };
  function setWalk(on) {
    if (on) {
      if (player) return;
      const eye = camera.position.clone(), dv = controls.target.clone().sub(camera.position).setY(0), yaw0 = dv.lengthSq() > 1e-6 ? Math.atan2(dv.x, dv.z) : 0;
      if (!enterPlayer('owner')) return;
      const a = player.a, sy = surfaceAt(eye.x, eye.z, 2);
      if (sy !== null && !collides(eye.x, eye.z)) { a.g.position.set(eye.x, sy, eye.z); player.safe = { x: eye.x, y: sy, z: eye.z }; }
      player.fp = true; player.yaw = yaw0; player.pitch = 0; player.dist = 5; a.fpHide = true; a.g.visible = false; walkMode = true;
      onToast?.('🚶 Mode jalan (tanpa karakter): gerakkan mouse = arah, WASD jalan, Space lompat, E sentuh / duduk, Esc keluar');
    } else exitPlayer();
  }
  // ── configurable keys. Handlers keep their built-in key names ("canonical" codes); the keys a person presses are translated first.
  // [mode, canonical, default key, label]
  const KEYACT = [
    ['free', 'KeyW', 'KeyW', 'Maju'], ['free', 'KeyS', 'KeyS', 'Mundur'], ['free', 'KeyA', 'KeyA', 'Geser kiri'], ['free', 'KeyD', 'KeyD', 'Geser kanan'],
    ['free', 'Act:lookLeft', 'KeyZ', 'Tengok kiri (menoleh di tempat)'], ['free', 'Act:lookRight', 'KeyC', 'Tengok kanan (menoleh di tempat)'], ['free', 'Act:up', 'KeyQ', 'Naik'], ['free', 'Act:down', 'KeyE', 'Turun'],
    ['free', 'Space', 'Space', 'Mode jalan / terbang'], ['free', 'KeyP', 'KeyP', 'Main sebagai karakter'], ['free', 'Tab', 'Tab', 'Agen berikutnya'],
    ['free', 'KeyU', 'KeyU', 'Waktu mundur'], ['free', 'KeyI', 'KeyI', 'Waktu maju'], ['free', 'KeyT', 'KeyT', 'Siang-malam otomatis'],
    ['free', 'KeyL', 'KeyL', 'Label nama'], ['free', 'KeyH', 'KeyH', 'Bantuan'], ['free', 'KeyB', 'KeyB', 'Simpan tampilan favorit'], ['free', 'PageUp', 'PageUp', 'Favorit sebelumnya'], ['free', 'PageDown', 'PageDown', 'Favorit berikutnya'],
    ['free', 'Digit8', 'Digit8', 'Tampilan dari atas'], ['free', 'Digit5', 'Digit5', 'Tampilan isometrik'], ['free', 'Digit4', 'Digit4', 'Putar 90° ke kiri'], ['free', 'Digit6', 'Digit6', 'Putar 90° ke kanan'], ['free', 'Digit2', 'Digit2', 'Tampilan depan'], ['free', 'Digit0', 'Digit0', 'Posisi awal'],
    ['play', 'KeyW', 'KeyW', 'Maju'], ['play', 'KeyS', 'KeyS', 'Mundur'], ['play', 'KeyA', 'KeyA', 'Kiri'], ['play', 'KeyD', 'KeyD', 'Kanan'],
    ['play', 'KeyQ', 'KeyQ', 'Putar kamera ke kiri'], ['play', 'KeyR', 'KeyR', 'Putar kamera ke kanan'], ['play', 'KeyE', 'KeyE', 'Panggil & bicara'], ['play', 'KeyF', 'KeyF', 'Beri tugas'], ['play', 'KeyG', 'KeyG', 'Lambai'], ['play', 'Space', 'Space', 'Lompat'], ['play', 'KeyH', 'KeyH', 'Bantuan'], ['play', 'KeyV', 'KeyV', 'Teleport (menu tujuan)'], ['free', 'KeyV', 'KeyV', 'Teleport (menu tujuan)'],
  ].map(([mode, id, def, label]) => ({ mode, id, def, label }));
  const RESERVED = /^(Escape|Shift|Control|Alt|Meta|Arrow|F\d|Enter|Backspace|ContextMenu|CapsLock)/;
  let custom = { free: {}, play: {} }, lookInvert = false, hasStored = false;
  const rev = { free: {}, play: {} }, blocked = { free: new Set(), play: new Set() };
  const effKey = (a) => custom[a.mode][a.id] || a.def;
  const rebuildKeys = () => {
    for (const m of ['free', 'play']) { rev[m] = {}; blocked[m] = new Set(); }
    for (const a of KEYACT) { const k = effKey(a); if (a.id.startsWith('Act:') || k !== a.def) rev[a.mode][k] = a.id; if (!a.id.startsWith('Act:') && k !== a.def) blocked[a.mode].add(a.def); }
  };
  const xlate = (code) => { const m = player ? 'play' : 'free'; if (rev[m][code]) return rev[m][code]; if (blocked[m].has(code)) return null; return code; };
  const keysJSON = () => ({ free: { ...custom.free }, play: { ...custom.play }, invert: lookInvert });
  const saveKeys = () => { try { localStorage.setItem('office-keys-v2', JSON.stringify(keysJSON())); } catch { /* storage blocked */ } onKeys?.(keysJSON()); };
  const applyKeys = (o) => { const ok = (v) => typeof v === 'string' && v.length < 24 && !RESERVED.test(v); custom = { free: {}, play: {} }; for (const m of ['free', 'play']) for (const [k, v] of Object.entries((o && o[m]) || {})) if (ok(v) && KEYACT.some((a) => a.mode === m && a.id === k && v !== a.def)) custom[m][k] = v; lookInvert = !!(o && o.invert); rebuildKeys(); };
  try { const raw = localStorage.getItem('office-keys-v2'); if (raw) { applyKeys(JSON.parse(raw)); hasStored = true; } } catch { /* defaults */ }
  rebuildKeys();
  const flyVel = new THREE.Vector3(); let flyTurn = 0;
  function updateFly(dt) {
    // C / Z: stand still and look left / right (the camera turns on the spot, it does not move)
    const ease = 1 - Math.exp(-dt * 7);
    flyTurn += (((fly.has('Act:lookLeft') ? 1 : 0) - (fly.has('Act:lookRight') ? 1 : 0)) * (lookInvert ? -1 : 1) - flyTurn) * ease;
    if (Math.abs(flyTurn) > 0.002) { const off = controls.target.clone().sub(camera.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), flyTurn * dt * 1.4); controls.target.copy(camera.position).add(off); }
    if (walkMode) {
      // floor-only movement with collision, eye height locked (Enscape Walk)
      const off = camera.position.clone().sub(controls.target);
      const fwd = off.clone().setY(0).normalize().negate(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const v = new THREE.Vector3();
      if (fly.has('KeyW') || fly.has('ArrowUp')) v.add(fwd); if (fly.has('KeyS') || fly.has('ArrowDown')) v.sub(fwd);
      if (fly.has('KeyD') || fly.has('ArrowRight')) v.add(right); if (fly.has('KeyA') || fly.has('ArrowLeft')) v.sub(right);
      if (v.lengthSq()) {
        const sp = (fly.has('ShiftLeft') || fly.has('ShiftRight') ? 4.2 : 2.2) * dt;
        v.normalize().multiplyScalar(sp);
        const nx = controls.target.x + v.x, nz = controls.target.z + v.z;
        const ox = controls.target.x, oz = controls.target.z;
        if (collidesW(ox, oz) || !collidesW(nx, nz)) { controls.target.x = nx; controls.target.z = nz; camera.position.x += v.x; camera.position.z += v.z; }
        else if (!collidesW(nx, oz)) { controls.target.x = nx; camera.position.x += v.x; }
        else if (!collidesW(ox, nz)) { controls.target.z = nz; camera.position.z += v.z; }
      }
      { const dy = EYE + viewFloor * FH - camera.position.y; camera.position.y += dy; controls.target.y += dy; }
      return;
    }
    const off = camera.position.clone().sub(controls.target);
    const dist = off.length();
    const fwd = off.clone().setY(0).normalize().negate(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const v = new THREE.Vector3();
    if (fly.has('KeyW') || fly.has('ArrowUp')) v.add(fwd); if (fly.has('KeyS') || fly.has('ArrowDown')) v.sub(fwd);
    if (fly.has('KeyD') || fly.has('ArrowRight')) v.add(right); if (fly.has('KeyA') || fly.has('ArrowLeft')) v.sub(right);
    if (v.lengthSq()) v.normalize();
    v.y = ((fly.has('Act:up') ? 1 : 0) - (fly.has('Act:down') ? 1 : 0)) * 0.6;
    const fast = fly.has('ShiftLeft') || fly.has('ShiftRight');
    v.multiplyScalar(Math.max(2.2, dist * 0.32) * (fast ? 3.2 : 1));
    flyVel.lerp(v, ease);
    if (flyVel.lengthSq() < 1e-5) { flyVel.set(0, 0, 0); return; }
    v.copy(flyVel).multiplyScalar(dt);
    if (camera.position.y + v.y < 0.12) v.y = 0.12 - camera.position.y;
    if (camera.position.y + v.y > 150) v.y = 150 - camera.position.y;
    // the eye keeps climbing; the point you look at only follows up to the top floor
    camera.position.add(v); controls.target.x += v.x; controls.target.z += v.z; controls.target.y = Math.max(0, Math.min(2.5 + (floors.length - 1) * FH, controls.target.y + v.y));
    if (camera.position.y < 0.12) camera.position.y = 0.12;
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
    sun.intensity = (0.15 + day * (light ? 2.2 : 2.0) + (1 - night) * 0.3) * Math.max(0.05, V.sun);
    hemi.intensity = 0.25 + day * 0.75 + (light ? 0.25 : 0);
    const C = (h) => new THREE.Color(h);
    const dayK = THREE.MathUtils.smoothstep(e, 0.12, 0.62), nightK = 1 - THREE.MathUtils.smoothstep(e, -0.3, 0.05);
    const top = C(0x060a1c).lerp(C(0x3b3f86), 1 - nightK).lerp(C(0x2f6fcf), dayK);
    const hor = C(0x151a3a).lerp(C(0xe39a8a), 1 - nightK).lerp(C(0x8fbbec), dayK);
    sky.material.uniforms.top.value.copy(top); sky.material.uniforms.uNight.value = nightK; sky.material.uniforms.moonDir.value.set(-Math.cos(solarAz), 0.18 + Math.max(0, -e) * 0.75, -Math.sin(solarAz)).normalize(); sky.material.uniforms.horizon.value.copy(hor);
    sky.material.uniforms.glow.value.copy(C(0x6a3a18).multiplyScalar(dusk * (1 - night * 0.7)));
    sky.material.uniforms.sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    if (scene.fog) scene.fog.color.copy(hor);
    renderer.toneMappingExposure = (0.85 + day * 0.15 + night * 0.12) * expK();
    env?.setDusk(Math.max(dusk, night)); env?.setNight?.(nightK); life?.setSky(dayK, dusk * (1 - dayK), nightK, hor);
    fogNight = nightK;
    for (const r of rooms.values()) if (r.ceilLights) r.ceilLights.forEach((l) => (l.intensity = 0.4 + night * 0.8));
  }
  const fmtTod = () => `${String(Math.floor(tod)).padStart(2, '0')}:${String(Math.round((tod % 1) * 60)).padStart(2, '0')}`;

  // ───── input
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let down = null;
  const pick = (e) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(pickables, false)[0]; };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY }; follow = false; camAnim = null; lastDrag = performance.now();
    if (player || chaseId || walkMode) return;
    const rc = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    let d = 0; const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) d = hit.distance; else if (ray.ray.direction.y < -0.02) d = (camera.position.y - viewFloor * FH) / -ray.ray.direction.y;
    if (!d) return;
    const dir = controls.target.clone().sub(camera.position).normalize();
    controls.target.copy(camera.position).addScaledVector(dir, Math.max(1.5, Math.min(140, d)));
  }, true);
  renderer.domElement.addEventListener('pointermove', (e) => { if (!down) return; lastDrag = performance.now(); if (chaseId && e.buttons === 1 && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) stopChase(); }); // dragging the ground lets go of the agent you were following
  renderer.domElement.addEventListener('dblclick', (e) => { if (!player && !pick(e)) teleport(e); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null;
    if (player && (e.pointerType === 'touch' || document.pointerLockElement === renderer.domElement)) return;
    const hit = pick(e);
    if (!player && hit?.object.userData.prop) return propMenu(hit.object.userData, e);
    if (!player && hit?.object.userData.agent) {
      const id = hit.object.userData.agent;
      if (e.button === 2) onAgentPie?.(id); // right click: the round quick-action bubbles
      else { onAgentPie?.(null); startChase(id); } // left click: follow with the camera (the follow card shows details)
      return;
    }
    if (e.button !== 2) onAgentPie?.(null);
    if (hit?.object.userData.agent) { const id = hit.object.userData.agent; selectedId = id; highlight(); onSelect?.(id); }
    else if (hit?.object.userData.app) onApp?.(hit.object.userData.app);
    else if (hit?.object.userData.holo != null) { const t = performance.now() / 1000, f = floaters.find((x) => x.m === hit.object); onHolo?.(f ? (f.page + Math.floor(t / 8)) % 4 : 0); }
    else if (hit?.object.userData.brain) { brainTouch(); onZone?.('brain'); }
    else if (hit?.object.userData.room) { const r = rooms.get(hit.object.userData.room); onZone?.(r.div ? r.div.id : r.id); }
  });
  renderer.domElement.addEventListener('pointermove', (e) => { if (isMobile) return; const h = pick(e); renderer.domElement.style.cursor = h?.object.userData.agent || h?.object.userData.prop || h?.object.userData.brain || h?.object.userData.holo != null || h?.object.userData.app ? 'pointer' : 'grab'; });
  // ───── click menus: people (social) and props (computer, chair, desk)
  const menuEl = document.createElement('div'); menuEl.className = 'omenu glass'; menuEl.hidden = true; container.appendChild(menuEl);
  const closeMenu = () => { menuEl.hidden = true; };
  renderer.domElement.addEventListener('pointerdown', closeMenu);
  addEventListener('keydown', (e) => { if (e.code === 'Escape') closeMenu(); });
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** rows: {ic,t,fn} buttons, {emo:[[ch,title,fn]]} a row of expressions, {sep:1} */
  function showMenu(ev, title, sub, rows) {
    menuEl.innerHTML = '<div class="omenu-h"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' + rows.map((r, i) => r.sep ? '<hr>' : r.emo ? '<div class="omenu-e">' + r.emo.map(([c, t], j) => '<button data-i="' + i + '.' + j + '" title="' + esc(t) + '">' + c + '</button>').join('') + '</div>' : '<button class="omenu-b" data-i="' + i + '"><i>' + r.ic + '</i>' + esc(r.t) + '</button>').join('');
    menuEl.onclick = (ev2) => { const b = ev2.target.closest('button'); if (!b) return; const [i, j] = b.dataset.i.split('.'); const r = rows[+i]; closeMenu(); (j !== undefined ? r.emo[+j][2] : r.fn)(); };
    const cr = container.getBoundingClientRect(); menuEl.hidden = false;
    const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
    menuEl.style.left = Math.max(8, Math.min(cr.width - w - 8, ev.clientX - cr.left + 10)) + 'px';
    menuEl.style.top = Math.max(8, Math.min(cr.height - h - 8, ev.clientY - cr.top + 6)) + 'px';
  }
  const face = (a, who) => { const v = (who ? wp(who) : camera.position).clone(); a.lookAt = v; setTimeout(() => { if (a.lookAt === v) a.lookAt = null; }, 4200); };
  const pickOf = (l) => l[(Math.random() * l.length) | 0];
  function agentMenu(id, ev) {
    const a = avatars.get(id); if (!a) return; const e = a.e, seated = a.pose === 'sit', now = performance.now();
    const peer = () => [...avatars.values()].filter((o) => o !== a && !o.player && o.e.type === 'ai' && o.e.status !== 'offline').sort((x, y) => x.g.position.distanceTo(a.g.position) - y.g.position.distanceTo(a.g.position))[0];
    const act = (ch, feelT, gest, ms = 2200) => () => { face(a); emote(a, ch, ms + 400); if (feelT) feel(a, feelT, ms + 800); if (gest) gesture(a, gest, ms); };
    showMenu(ev, e.name, (e.title || '') + (e.statusText ? ' · ' + e.statusText : ''), [
      { ic: '👋', t: 'Sapa', fn: () => { face(a); a.waveUntil = now + 2200; emote(a, '👋', 2400); feel(a, 'smile', 2600); say(a, pickOf(['Halo! 👋', 'Hai, ada yang bisa kubantu?', 'Selamat datang! 😄']), 3000); } },
      { ic: '🙌', t: 'High-five', fn: () => { face(a); a.waveUntil = now + 1800; emote(a, '🙌', 2200); feel(a, 'laugh', 2400); if (!seated) a.jump = 1; say(a, 'High five! 🙌', 2200); } },
      { ic: '💬', t: 'Tanya kabar', fn: () => { face(a); gesture(a, 'nod', 1800); feel(a, 'smile', 2600); say(a, e.statusText || 'Lagi santai nih ☕', 4200); } },
      { ic: '🗣️', t: 'Ajak ngobrol rekan terdekat', fn: () => { const o = peer(); if (!o) return; face(a, o); face(o, a); a.talkUntil = now + 3000; say(a, pickOf(SMALLTALK), 3400); setTimeout(() => { o.talkUntil = performance.now() + 2400; feel(o, Math.random() < 0.5 ? 'laugh' : 'smile', 2200); gesture(o, 'nod', 1600); say(o, pickOf(SMALLTALK), 3200); }, 1700); } },
      { emo: [['😄', 'Tertawa', act('😄', 'laugh', 'laugh')], ['😮', 'Kaget', act('😮', 'surprised', null)], ['😢', 'Sedih', act('😢', 'sad', 'sad')], ['🤔', 'Berpikir', act('🤔', 'focus', 'think')], ['🥳', 'Rayakan', act('🥳', 'laugh', seated ? 'laugh' : 'cheer')], ['💃', 'Joget', () => { if (seated) { say(a, 'Lagi duduk nih 😅', 2400); feel(a, 'laugh', 2000); } else { gesture(a, 'dance', 3400); feel(a, 'laugh', 3400); emote(a, '🎶', 3200); } }]] },
      { sep: 1 },
      { ic: '📷', t: 'Ikuti dengan kamera', fn: () => startChase(id) },
      { ic: '🔎', t: 'Detail & pekerjaan', fn: () => onMenu?.('detail', id) },
      { ic: '✉️', t: 'Chat', fn: () => onMenu?.('chat', id) },
      { ic: '＋', t: 'Beri tugas', fn: () => onMenu?.('task', id) },
    ]);
  }
  function propMenu(u, ev) {
    const a = avatars.get(u.owner); if (!a?.desk) return; const dk = a.desk, e = a.e;
    const seated = a.mode === 'desk' && a.pose === 'sit', st = dk.state, nm = e.name.split(' ')[0];
    const base = [{ sep: 1 }, { ic: '🔎', t: 'Lihat pekerjaan ' + nm, fn: () => onMenu?.('detail', e.id) }, { ic: '＋', t: 'Beri tugas ke ' + nm, fn: () => onMenu?.('task', e.id) }];
    const away = !seated ? [{ ic: '🪑', t: 'Panggil ' + nm + ' ke meja', fn: () => { goDesk(a); say(a, 'Siap, balik ke meja! 🪑', 2400); } }] : [];
    if (u.prop === 'pc') {
      showMenu(ev, 'Komputer ' + nm, st === 'on' ? 'Layar aktif · ' + (e.statusText || 'mengetik') : st === 'off' ? 'Layar mati' : seated ? 'Standby · menunggu tugas' : 'Standby · pemilik sedang pergi', [
        { ic: st === 'on' ? '⏻' : '💡', t: st === 'on' ? 'Matikan layar' : 'Nyalakan layar', fn: () => { dk.force = st === 'on' ? 'off' : 'on'; deskScreen(a); } },
        ...(dk.force ? [{ ic: '↺', t: 'Kembali otomatis', fn: () => { dk.force = null; deskScreen(a); } }] : []), ...away, ...base]);
    } else if (u.prop === 'chair') {
      showMenu(ev, 'Kursi ' + nm, seated ? nm + ' sedang duduk' : 'Kursi kosong', [
        ...(seated ? [{ ic: '🚶', t: 'Suruh istirahat sebentar', fn: () => { const sp = claimSpot(a, pickOf(['cafe', 'lounge']), null); if (sp) { goSpot(a, sp, 'leisure', 12000); say(a, 'Oke, rehat dulu ☕', 2400); } } }, { ic: '🙋', t: 'Panggil perhatian', fn: () => { face(a); a.waveUntil = performance.now() + 1500; emote(a, '❓', 2000); } }]
          : [{ ic: '↔', t: dk.slid ? 'Dorong kursi masuk' : 'Tarik kursi keluar', fn: () => { dk.slid = !dk.slid; dk.chair.position.z = CHAIR_Z + (dk.slid ? 0.4 : 0); } }, ...away]), ...base]);
    } else {
      showMenu(ev, 'Meja ' + nm, (e.title || '') + ' · ' + (e.statusText || 'siap bekerja'), [...away, ...base.slice(1)]);
    }
  }
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
  const ro = new ResizeObserver(resize); ro.observe(container);
  /* the chat dock covers the left edge: shift the 3D image to the right so the world is centred in the part you can still see */
  let inset = 0;
  function applyInset() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; if (inset > 0) camera.setViewOffset(w, h, -inset / 2, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  /* agents that are busy right now get a pulsing ring and a soft beam so you can find them at a glance */
  let spotIds = new Set(); const spotBeams = new Map();
  function spotlight(ids) { spotIds = new Set(ids || []); }
  function updateSpots(t) {
    for (const a of avatars.values()) {
      const on = spotIds.has(a.id); let b = spotBeams.get(a.id);
      if (on && !b) { b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); b.position.y = 1.7; b.userData.keep = true; a.g.add(b); spotBeams.set(a.id, b); }
      if (b) { if (b.parent !== a.g) { a.g.add(b); } const k = on ? 1 : 0; b.material.opacity += (k * (0.16 + Math.sin(t * 3) * 0.05) - b.material.opacity) * 0.12; b.visible = b.material.opacity > 0.01; if (!on && !b.visible) { a.g.remove(b); b.geometry.dispose(); b.material.dispose(); spotBeams.delete(a.id); } }
      if (on && a.id !== selectedId) { const s = 1.35 + Math.sin(t * 3) * 0.12; a.ring.scale.setScalar(s); a.pad.scale.setScalar(s); }
    }
  }
  function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); composer.setSize(w, h); fxaaRes(); bloom.resolution.set(w / 2, h / 2); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); applyInset(); if (!fitted && rooms.size) { fitted = true; fitCamera(true); } }

  // ───── player mode: walk your own character (WASD / arrows / joystick), talk to agents, use objects
  let player = null;
  const keys = new Set();
  const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  const look = { id: null, x: 0, y: 0 };
  let hintKey = '';
  const RADIUS = 0.32;
  function collides(x, z) {
    for (const pd of pods) { const dx = x - pd.x, dz = z - pd.z, d = Math.hypot(dx, dz); if (Math.abs(d - pd.r) < RADIUS + 0.1 && (dx * pd.nx + dz * pd.nz) / Math.max(d, 1e-6) < pd.cg) return true; }
    for (const s of solids) {
      const cx = Math.max(s.x1, Math.min(x, s.x2)), cz = Math.max(s.z1, Math.min(z, s.z2));
      if ((x - cx) ** 2 + (z - cz) ** 2 < RADIUS * RADIUS) return true;
    }
    return false;
  }
  // ───── teleport menu (V / the ⚡ button): any place on the campus or any agent. Works in Play (the mouse is released while the menu is open) and in the free camera.
  function teleTargets() {
    const out = [], ICON = { brain: '🧠', stage: '🎤', fountain: '⛲', kiosk: '☕', meeting: '🗣️', pitch: '🤝' };
    out.push({ id: 'center', group: 'Plaza', icon: '🌿', label: 'Plaza tengah', sub: 'Taman, bangku, dan bukit' });
    const roomNames = new Set([...rooms.values()].map((r) => String(r.div?.name || r.name || '').toLowerCase()));
    const iconFor = (l) => (/brain/i.test(l) ? '🧠' : /panggung|stage/i.test(l) ? '🎤' : /air mancur/i.test(l) ? '⛲' : /kopi|kios|pantry|kafe|café/i.test(l) ? '☕' : /taman|peregangan|wellness/i.test(l) ? '🧘' : /pitch|booth|penawaran/i.test(l) ? '🤝' : /konten|studio|kreator/i.test(l) ? '🎬' : /lab|maker|bengkel/i.test(l) ? '🧪' : /papan tugas|kanban/i.test(l) ? '📋' : /approval|persetujuan/i.test(l) ? '✅' : /knowledge|pengetahuan|library|perpustakaan/i.test(l) ? '📚' : /chat|percakapan/i.test(l) ? '💬' : /rapat|whiteboard/i.test(l) ? '🗣️' : '📍');
    for (const p of pois) {
      if (!p.label) continue; const deck = String(p.id).startsWith('skydeck');
      if (!deck && (roomNames.has(String(p.label).toLowerCase()) || /^E: lihat divisi/i.test(p.sub || ''))) continue;   /* room signs are already in the "Ruangan" group */
      out.push({ id: 'poi:' + p.id, group: deck ? 'Sky Deck' : 'Plaza', icon: deck ? '🛰️' : (ICON[p.id] || iconFor(p.label)), label: p.label, sub: String(p.sub || '').replace(/^E:\s*/i, '') });
    }
    for (const r of rooms.values()) out.push({ id: 'room:' + r.id, group: 'Ruangan', icon: r.div?.icon || '🏢', label: r.div?.name || r.name || String(r.id), sub: r.kind === 'work' ? 'Ruang kerja' : '' });
    for (const a of avatars.values()) out.push({ id: 'agent:' + a.id, group: 'Agen', icon: '🙂', label: a.e.name, sub: a.e.title || '', status: a.e.status });
    return out;
  }
  function teleResolve(id) {
    const land = (x, z) => { for (let rad = 0; rad <= 7; rad += 0.8) for (let k = 0; k < (rad ? 12 : 1); k++) { const ang = (k / 12) * Math.PI * 2, px = x + Math.cos(ang) * rad, pz = z + Math.sin(ang) * rad; if (!collides(px, pz)) return [px, pz]; } return [x, z]; };
    const face = (px, pz, tx, tz) => Math.atan2(tx - px, tz - pz);
    const ground = (x, z, high) => { try { return surfaceAt(x, z, high ? 40 : 1.2) ?? 0; } catch { return 0; } };
    if (id === 'center') { const [x, z] = land(0, 12); return { x, z, y: ground(x, z), yaw: Math.PI, label: 'Plaza tengah' }; }
    if (id.startsWith('poi:')) {
      const p = pois.find((q) => 'poi:' + q.id === id); if (!p) return null;
      if (String(p.id).startsWith('skydeck')) return { x: p.x, z: p.z, y: ground(p.x, p.z, true), yaw: face(p.x, p.z, 0, 0), label: p.label, exactY: true };
      const h = Math.hypot(p.x, p.z), dx = h > 6 ? -p.x / h : 0, dz = h > 6 ? -p.z / h : 1, r = (p.r || 3) * 0.9 + 1.2, [x, z] = land(p.x + dx * r, p.z + dz * r);
      return { x, z, y: ground(x, z), yaw: face(x, z, p.x, p.z), label: p.label };
    }
    if (id.startsWith('room:')) {
      const r = rooms.get(id.slice(5)); if (!r || !r.inside) return null; const [x, z] = land(r.inside.x, r.inside.z);
      return { x, z, y: ground(x, z), yaw: r.door ? face(r.door.x, r.door.z, r.inside.x, r.inside.z) : 0, label: r.div?.name || r.name || 'ruangan' };
    }
    if (id.startsWith('agent:')) {
      const a = avatars.get(id.slice(6)); if (!a) return null; const p = wp(a), fy = yawW(a), [x, z] = land(p.x + Math.sin(fy) * 1.4, p.z + Math.cos(fy) * 1.4);
      return { x, z, y: ground(x, z), yaw: face(x, z, p.x, p.z), label: a.e.name };
    }
    return null;
  }
  function teleportTo(id) {
    const T = teleResolve(id); if (!T) return false;
    const y = T.y || 0, dest = new THREE.Vector3(T.x, y, T.z);
    if (player) {
      if (player.sitting) playerStand();
      const a = player.a; keys.clear(); a.moving = false;
      a.tele = { t0: performance.now(), phase: 'out', land: dest, drop: 0, base: a.g.scale.x || 1, fx: false, yaw: T.yaw, label: T.label, exactY: !!T.exactY };
      return true;
    }
    // free camera: fly there (and mark the spot with the portal)
    stopChase(); spawnTeleFx(dest, null, 'in');
    const back = new THREE.Vector3(-Math.sin(T.yaw) * 10, 7, -Math.cos(T.yaw) * 10);
    animateTo(dest.clone().add(new THREE.Vector3(0, 1, 0)).add(back), dest.clone().add(new THREE.Vector3(0, 1.2, 0)));
    onToast?.('⚡ Teleport: ' + T.label);
    return true;
  }
  function enterPlayer(id) {
    const a = avatars.get(id); if (!a) return false;
    stopChase(); fly.clear();
    release(a); a.path = []; a.player = true; a.mode = 'player'; a.pose = 'stand';
    // step away from the desk until the character stands free
    const away = new THREE.Vector3(-Math.sin(a.desk.facing), 0, -Math.cos(a.desk.facing));
    for (let d = 0; d < 3 && collides(a.g.position.x, a.g.position.z); d += 0.15) a.g.position.copy(a.desk.seat).addScaledVector(away, d);
    for (const r of rooms.values()) if (r.sign) r.sign.visible = false;
    zoneKey = ''; zoneCand = ''; zoneShownAt = 0;
    player = { a, yaw: a.g.rotation.y, pitch: 0.42, dist: 5.2, vy: 0, safe: { x: a.g.position.x, y: a.g.position.y, z: a.g.position.z } };
    if (a.label) a.label.visible = false;
    controls.enabled = false; follow = false; selectedId = null; highlight(); camAnim = null; dofB.style.opacity = '0.25';
    renderer.domElement.focus?.();
    lockMouse();
    return true;
  }
  // ───── opening cinematic: overview of the campus, then a slow dive onto the player's character, then Play mode
  let intro = null;
  const PLAY_FOV = 38;
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  function cinematicIntro(onDone, opts = {}) {   // opts: { hold (s), dur (s), id (agent id), title (false = no title) }
    const a = avatars.get(opts.id || 'owner'); if (!a || player || intro) return false;
    stopChase(); fly.clear(); follow = false; camAnim = null; controls.enabled = false;
    const bars = document.createElement('div'); bars.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30';
    bars.innerHTML = '<div style="position:absolute;left:0;right:0;top:0;height:8%;background:#000;transition:height 1.2s"></div><div style="position:absolute;left:0;right:0;bottom:0;height:8%;background:#000;transition:height 1.2s"></div><div class="it" style="position:absolute;left:0;right:0;bottom:13%;text-align:center;color:#fff;font:600 20px system-ui;letter-spacing:.38em;opacity:0;transition:opacity 1.4s;text-shadow:0 2px 14px #0009">RAY AGENT OFFICE</div><div class="is" style="position:absolute;left:0;right:0;bottom:10%;text-align:center;color:#fffa;font:12px system-ui;letter-spacing:.12em;opacity:0;transition:opacity 1s">tekan tombol apa saja untuk melewati</div>';
    container.appendChild(bars); if (opts.title === false) bars.querySelectorAll('.it,.is').forEach((e) => { e.style.display = 'none'; }); requestAnimationFrame(() => { bars.querySelector('.it').style.opacity = '1'; setTimeout(() => { const s = bars.querySelector('.is'); if (s) s.style.opacity = '1'; }, 1500); });
    intro = { t: 0, hold: opts.hold ?? 3.4, dur: opts.dur ?? 9.5, id: opts.id || 'owner', p0: camera.position.clone(), t0: controls.target.clone(), A: null, TA: null, onDone, bars };
    const skip = () => { if (intro) endIntro(true); window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip); };
    window.addEventListener('keydown', skip); window.addEventListener('pointerdown', skip);
    return true;
  }
  function endIntro(done) {
    const I = intro; if (!I) return; intro = null; controls.enabled = true; I.bars.remove();
    if (!done) { camera.fov = V.fov; camera.updateProjectionMatrix(); }
    if (done) I.onDone?.();
  }
  function stepIntro(dt) {
    const I = intro, a = avatars.get(I.id); if (!a) { endIntro(false); return; }
    I.t += Math.min(dt, 0.05);
    const p = wp(a), yaw = a.g.rotation.y, cp = Math.cos(0.42), sp = Math.sin(0.42);
    const endT = p.clone().add(new THREE.Vector3(0, 1.35, 0));
    const endP = endT.clone().add(new THREE.Vector3(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp).multiplyScalar(5.2));
    if (I.t < I.hold) { // slow drift around the overview
      const ang = I.t * 0.03, rel = I.p0.clone().sub(I.t0), c = Math.cos(ang), s = Math.sin(ang);
      camera.position.set(I.t0.x + rel.x * c - rel.z * s, I.p0.y, I.t0.z + rel.x * s + rel.z * c); controls.target.copy(I.t0); camera.lookAt(controls.target); return;
    }
    if (!I.A) { I.A = camera.position.clone(); I.TA = controls.target.clone(); }
    const u = Math.min(1, (I.t - I.hold) / I.dur), k = easeIO(u);
    const B = p.clone().add(new THREE.Vector3(-Math.sin(yaw) * 16, 26, -Math.cos(yaw) * 16));   // swing high over the owner, then dive in
    const a1 = I.A.clone().lerp(B, k), b1 = B.clone().lerp(endP, k);
    camera.position.copy(a1.lerp(b1, k)); controls.target.copy(I.TA.clone().lerp(endT, k)); camera.lookAt(controls.target);
    { const f = V.fov + (Math.min(V.fov, PLAY_FOV) - V.fov) * k; camera.fov = f; camera.updateProjectionMatrix(); }   // the lens narrows while diving in
    if (u > 0.55) { const t = I.bars.querySelector('.it'), s = I.bars.querySelector('.is'); if (t) t.style.opacity = '0'; if (s) s.style.opacity = '0'; }
    if (u >= 1) endIntro(true);
  }
  // ───── leaving Play mode: a slow, smooth pull-back to a moderate distance behind/above the character (no jump to the far overview)
  let pull = null;
  function softPullBack(a) {
    const p = wp(a), yaw = a.g.rotation.y, tt = p.clone().add(new THREE.Vector3(0, 1.1, 0));
    const off = new THREE.Vector3(-Math.sin(yaw) * 8.5, 5.2, -Math.cos(yaw) * 8.5);
    camera.fov = Math.min(V.fov, PLAY_FOV); camera.updateProjectionMatrix();
    pull = { t: 0, dur: 3.4, from: camera.position.clone(), tf: controls.target.clone(), off, id: a.id, fov0: camera.fov };
    controls.enabled = false; follow = false; camAnim = null;
  }
  function stepPull(dt) {
    const P = pull, a = avatars.get(P.id); P.t += Math.min(dt, 0.05);
    const u = Math.min(1, P.t / P.dur), k = easeIO(u);
    const tt = a ? wp(a).add(new THREE.Vector3(0, 1.1, 0)) : P.tf, to = tt.clone().add(P.off);
    camera.position.lerpVectors(P.from, to, k); controls.target.lerpVectors(P.tf, tt, k); camera.lookAt(controls.target);
    camera.fov = P.fov0 + (V.fov - P.fov0) * k; camera.updateProjectionMatrix();
    if (u >= 1) { pull = null; controls.enabled = true; }
  }
  function lockMouse() { if (isMobile || document.pointerLockElement === renderer.domElement) return; try { const p = renderer.domElement.requestPointerLock?.(); p?.catch?.(() => onToast?.('🖱 Klik layar sekali untuk mengunci mouse (mouse = arah kamera)')); } catch { /* needs a click */ } }
  function exitPlayer() {
    camera.fov = V.fov; camera.updateProjectionMatrix();   // back to the user's own field of view
    if (!player) return;
    if (player.sitting) playerStand();
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    const a = player.a, wasFp = player.fp, fpYaw = player.yaw; player = null; keys.clear(); a.moving = false; a.player = false; a.fpHide = false; walkMode = false;
    if (a.label) a.label.visible = showLabels;
    controls.enabled = true; dofB.style.opacity = ''; goDesk(a); onPlayerHint?.(null);
    if (wasFp) { const p = wp(a), d2 = new THREE.Vector3(Math.sin(fpYaw), 0, Math.cos(fpYaw)); Object.assign(controls, FREE_CAM); controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; controls.target.set(p.x + d2.x * 3, p.y + 1, p.z + d2.z * 3); camera.position.set(p.x - d2.x * 5, p.y + EYE + 4, p.z - d2.z * 5); camera.lookAt(controls.target); } else softPullBack(a);   // gentle cinematic pull-back close to the character, not the whole-campus overview
    for (const w of walls) w.visible = true;
    for (const r of rooms.values()) if (r.sign) r.sign.visible = true;
  }
  const typingInField = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName) || e.target?.isContentEditable;
  const onOfficePage = () => visible && container.isConnected && container.offsetParent !== null && document.getElementById('modal')?.hidden !== false;
  addEventListener('keydown', (ev) => {
    const code = xlate(ev.code); if (code === null) return;
    const e = code === ev.code ? ev : new Proxy(ev, { get: (t, p) => (p === 'code' ? code : typeof t[p] === 'function' ? t[p].bind(t) : t[p]) });
    if (typingInField(e) || !onOfficePage()) return;
    if (uiBlock && e.code !== 'Escape') return;
    if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); onTeleportMenu?.(); return; }
    if (!player) {
      // free navigation (no Play mode needed)
      const nav = ['Act:lookLeft', 'Act:lookRight', 'Act:up', 'Act:down', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'];
      if (nav.includes(e.code) && !e.ctrlKey && !e.metaKey) { if (!/Shift|Alt/.test(e.code)) stopChase(); fly.add(e.code); e.preventDefault(); return; }
      const num = { Numpad8: 8, Numpad5: 5, Numpad4: 4, Numpad6: 6, Numpad2: 2, Numpad0: 0, Digit8: 8, Digit5: 5, Digit4: 4, Digit6: 6, Digit2: 2, Digit0: 0 }[e.code];
      if (num != null && !e.ctrlKey) { standardView(num); e.preventDefault(); return; }
      if (e.code === 'KeyU' || e.code === 'KeyI') { const d = e.code === 'KeyU' ? -1 : 1; if (e.shiftKey) solarAz += d * 0.26; else { autoDay = false; tod = (tod + d * 0.5 + 24) % 24; } applySun(); onToast?.(e.shiftKey ? `☀️ Sudut matahari ${Math.round(((solarAz * 180) / Math.PI) % 360)}°` : `🕐 Waktu ${fmtTod()}`); return; }
      if (e.code === 'Space') { e.preventDefault(); setWalk(!walkMode); return; }
      if (e.code === 'KeyP') { e.preventDefault(); onRequestPlay?.(); return; }
      if (e.code === 'KeyB') { favs.push({ p: camera.position.toArray(), t: controls.target.toArray() }); saveFavs(); favIdx = favs.length - 1; onToast?.(`⭐ Tampilan favorit #${favs.length} disimpan`); return; }
      if ((e.code === 'PageUp' || e.code === 'PageDown') && favs.length) { e.preventDefault(); favIdx = (favIdx + (e.code === 'PageDown' ? 1 : -1) + favs.length) % favs.length; const f = favs[favIdx]; stopChase(); animateTo(new THREE.Vector3(...f.p), new THREE.Vector3(...f.t)); onToast?.(`⭐ Favorit #${favIdx + 1}`); return; }
      if (e.code === 'Tab' && avatars.size) { e.preventDefault(); const list = [...avatars.values()].filter((x) => x.e.type === 'ai' && (x.e.status === 'working' || x.e.status === 'meeting' || x.mode !== 'desk')); const pool = list.length ? list : [...avatars.values()]; const i = pool.findIndex((x) => x.id === chaseId); const n = pool[(i + (e.shiftKey ? -1 : 1) + pool.length) % pool.length]; startChase(n.id); onSelect?.(n.id); return; }
      if (e.code === 'KeyT') { autoDay = !autoDay; onToast?.(autoDay ? '🌗 Siang-malam berjalan otomatis' : '⏸ Waktu dikunci ' + fmtTod()); return; }
      if (e.code === 'KeyM') { onToast?.(sfx.toggle() ? '🔊 Suara menyala' : '🔇 Suara mati'); return; }
      if (e.code === 'KeyL') { showLabels = !showLabels; for (const a of avatars.values()) if (a.label) a.label.visible = showLabels; return; }
      if (e.code === 'KeyH' || e.key === '?') { onHelp?.(); return; }
      if (e.code === 'Escape') { stopChase(); onHelp?.(false); }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyR'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
    if (e.code === 'Space') { if (player.sitting) playerStand(); else if (!player.a.jump) { player.a.jump = 1; sfx.play('jump'); } e.preventDefault(); }
    if (e.code === 'KeyM') { onToast?.(sfx.toggle() ? '🔊 Suara menyala' : '🔇 Suara mati'); }
    if (e.code === 'KeyG') player.a.waveUntil = performance.now() + 1600;
    if (e.code === 'KeyE') { if (player.sitting) playerStand(); else if (currentHint?.type === 'sit') playerSit(currentHint.spot); else if (currentHint?.type === 'poi' && currentHint.id === 'brain') { brainTouch(); onPlayerAction?.(currentHint, 'talk'); } else if (currentHint?.type === 'poi' && playerDo(currentHint.id)) { /* handled */ } else if (currentHint) onPlayerAction?.(currentHint, 'talk'); }
    if (e.code === 'KeyF' && currentHint?.type === 'agent') onPlayerAction?.(currentHint, 'task');
    if (e.code === 'KeyH') onHelp?.();
    if (e.code === 'Escape') exitPlayer();
  });
  addEventListener('keyup', (e) => { for (const c of [e.code, rev.free[e.code], rev.play[e.code]]) if (c) { keys.delete(c); fly.delete(c); } });
  addEventListener('blur', () => { keys.clear(); fly.clear(); });
  addEventListener('blur', () => { keys.clear(); fly.clear(); });
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (!player) return;
    if (e.pointerType === 'mouse' && document.pointerLockElement !== el) { lockMouse(); return; }
    const r = el.getBoundingClientRect();
    if (e.pointerType === 'touch' && e.clientX - r.left < r.width * 0.45 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; }
    else { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!player) return;
    if (e.pointerId === joy.id) { joy.x = Math.max(-1, Math.min(1, (e.clientX - joy.ox) / 50)); joy.y = Math.max(-1, Math.min(1, (e.clientY - joy.oy) / 50)); }
    if (e.pointerId === look.id) { player.yaw -= (e.clientX - look.x) * 0.006; player.pitch = Math.max(player.fp ? -1.4 : -0.85, Math.min(player.fp ? 1.4 : 1.2, player.pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; }
  });
  document.addEventListener('mousemove', (e) => { if (!player || document.pointerLockElement !== el) return; player.yaw -= e.movementX * 0.0035; player.pitch = Math.max(player.fp ? -1.4 : -0.85, Math.min(player.fp ? 1.4 : 1.3, player.pitch + e.movementY * 0.0030)); });
  document.addEventListener('pointerlockchange', () => { if (player && document.pointerLockElement !== el) onToast?.('🖱 Mouse dilepas · klik layar untuk mengunci lagi · Esc lagi untuk keluar'); });
  const endPtr = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; } if (e.pointerId === look.id) look.id = null; };
  el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', endPtr);
  el.addEventListener('wheel', (e) => { if (player) { player.dist = Math.max(2.2, Math.min(14, player.dist * Math.exp(e.deltaY * 0.001))); e.preventDefault(); } }, { passive: false });

  let currentHint = null;
  // ───── the player's character has a mind of its own: left alone it hums, stretches, looks around, waves, chats, strolls, sits down or dances
  const HUMS = ['♪ mmm~ la la ♪', '♪ du du du~ ♪', 'Hmm hmm hmm~ 🎵', '♪ hari yang indah ♪', '🎶 mmm mmm 🎶'];
  // ───── lower third: tells the player which room or zone they just walked into
  let zoneKey = '', zoneCand = '', zoneCandT = 0, zoneShownAt = 0;
  const ZONES = { stage: ['🎤', 'Panggung terbuka', 'Presentasi & demo'], fountain: ['⛲', 'Air mancur', 'Taman santai'], kiosk: ['☕', 'Kios kopi taman', 'Ngopi bareng'], skydeck1: ['🛰️', 'Sky Deck Utara', 'Dek melayang · tangga spiral'], skydeck2: ['🛰️', 'Sky Deck Timur', 'Dek melayang · 4 m'], skydeck3: ['🛰️', 'Sky Deck Barat', 'Dek melayang · 6,5 m'], content: ['🎬', 'Sudut konten kreator', 'Rekam & produksi konten'], wellness: ['🧘', 'Taman peregangan', 'Yoga & napas sejenak'], pitch: ['🤝', 'Booth penawaran', 'Pitch & demo produk'], maker: ['🧪', 'Meja kreatif & lab', 'Sketsa dan eksperimen'], brain: ['🧠', 'Company Brain', 'Pusat pengetahuan perusahaan'], 'app:tasks': ['📋', 'Papan Tugas', 'Kanban perusahaan'], 'app:studio': ['✨', 'Bengkel Agent Studio', 'Rancang karyawan AI'], 'app:approvals': ['🛑', 'Gerbang Persetujuan', 'Keputusan menunggu'], 'app:knowledge': ['🏛️', 'Paviliun Pengetahuan', 'Perpustakaan perusahaan'], 'app:team': ['👥', 'Pohon Organisasi', 'Tim & divisi'], 'app:chat': ['💬', 'Menara Obrolan', 'Percakapan & rapat'] };
  const ROOM_SUB = { conference: 'Ruang rapat', library: 'Perpustakaan pengetahuan', cafe: 'Kafe & pantry', play: 'Ruang bermain', lounge: 'Lounge tamu', private: 'Ruang eksekutif' };
  function zoneAt(p) {
    const r = roomAt(p);
    if (r) { const n = data?.employees?.filter((x) => x.divisionId === r.id).length ?? 0; return { key: 'room:' + r.id, icon: r.div?.icon || '🏢', title: r.div ? r.div.name : r.name, sub: ROOM_SUB[r.kind] || (n ? n + ' agen di divisi ini' : 'Ruang kerja'), color: r.div?.color || '#7c83ff' }; }
    for (const poi of pois) { const z = ZONES[poi.id]; if (z && Math.hypot(poi.x - p.x, poi.z - p.z) < (poi.r || 3)) return { key: 'poi:' + poi.id, icon: z[0], title: z[1], sub: z[2], color: '#7c83ff' }; }
    const d = Math.hypot(p.x, p.z), w = envWalk;
    if (w && d > w.rx * 0.95) { for (const i of w.isl) if ((p.x - i.x) ** 2 + (p.z - i.z) ** 2 <= i.r * i.r) return { key: 'isl', icon: '🌆', title: 'Distrik melayang', sub: 'Kota langit di seberang', color: '#5b8cff' }; return { key: 'bridge', icon: '🌉', title: 'Jembatan cahaya', sub: 'Menuju distrik di seberang', color: '#5bbfff' }; }
    if (d < podRI - 2) return { key: 'plaza', icon: '🌿', title: 'Plaza tengah', sub: 'Taman, panggung, dan Sky Deck', color: '#34d399' };
    if (Math.abs(d - ringR) < ringW / 2 + 1) return { key: 'ring', icon: '🛣️', title: 'Jalan lingkar', sub: 'Penghubung semua ruangan', color: '#f59e0b' };
    if (w && d > w.rx * 0.5) return { key: 'deck', icon: '🛰️', title: 'Dek stasiun', sub: 'Tepi stasiun luar angkasa', color: '#a78bfa' };
    return null;
  }
  function zoneTick(a, now) {
    const z = zoneAt(a.g.position), k = z ? z.key : '';
    if (k !== zoneCand) { zoneCand = k; zoneCandT = now; return; }
    if (k !== zoneKey && now - zoneCandT > 600) { zoneKey = k; if (z && now - zoneShownAt > 2500) { zoneShownAt = now; onLower?.(z); } }
  }
  function playerLife(dt, now) {
    if (player.fp) return;
    const a = player.a, idle = now - lastInput;
    // any input hands control straight back
    if (idle < 600) { if (player.auto) { a.path = []; a.onArrive = null; player.auto = null; a.running = false; } return; }
    if (player.sitting && idle > 12000 && now > (player.nextMicro || 0)) { player.nextMicro = now + 7000 + Math.random() * 7000; const r = Math.random(); if (r < 0.4) { say(a, HUMS[(Math.random() * HUMS.length) | 0], 3400); emote(a, '🎵', 2400); } else if (r < 0.7) { gesture(a, 'think', 2600); feel(a, 'smile', 2600); } else say(a, chat.solo(tod), 3600, true); return; }
    if (player.sitting || a.path.length) return;
    if (idle > 9000 && now > (player.nextMicro || 0)) {
      player.nextMicro = now + 6000 + Math.random() * 8000; const r = Math.random();
      if (r < 0.25) { say(a, HUMS[(Math.random() * HUMS.length) | 0], 3600); emote(a, '🎵', 2600); feel(a, 'smile', 2800); gesture(a, 'observe', 2600); }
      else if (r < 0.45) { gesture(a, 'stretch', 2600); feel(a, 'smile', 2600); }
      else if (r < 0.65) { player.lookTo = player.yaw + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.2); gesture(a, 'observe', 2800); }
      else if (r < 0.8) { say(a, chat.solo(tod), 3800, true); gesture(a, 'think', 2400); }
      else { let best = null, bd = 9; for (const o of avatars.values()) { if (o === a) continue; const d = o.g.position.distanceTo(a.g.position); if (d < bd) { bd = d; best = o; } } if (best) { a.waveUntil = now + 1800; a.lookAt = best.g.position; setTimeout(() => { if (a.lookAt === best.g.position) a.lookAt = null; }, 3500); emote(a, '👋', 2200); } else gesture(a, 'stretch', 2400); }
    }
    if (idle > 30000 && now > (player.nextAuto || 0) && !player.auto) {
      player.nextAuto = now + 30000 + Math.random() * 25000; const r = Math.random();
      let near = null, nd = 6.5; for (const o of avatars.values()) { if (o === a || o.mode === 'meeting') continue; const d = o.g.position.distanceTo(a.g.position); if (d < nd) { nd = d; near = o; } }
      if (r < 0.28 && near && near.pose !== 'sit') { near.lookAt = a.g.position; startConvo(a, near, now); return; }
      if (r < 0.45) { gesture(a, 'dance', 4200); say(a, '🎶 ♪ ayo goyang dikit ♪ 🎶', 3600); emote(a, '💃', 3000); return; }
      if (!sitAll) sitAll = [...plazaSpots, ...[...rooms.values()].flatMap((q) => q.spots)].filter((q) => q.pose === 'sit');
      const wantSit = r < 0.72, pool = (wantSit ? sitAll : plazaSpots.filter((q) => q.pose === 'stand')).filter((q) => !claimed.has(q.key) && q.p.distanceTo(a.g.position) < 45 && Math.abs(q.p.y - a.g.position.y) < 1.5);
      const sp = pool.length ? pool[(Math.random() * pool.length) | 0] : null; if (!sp) return;
      player.auto = sp; claimed.set(sp.key, a.id); a.running = false;
      const fin = () => { player.auto = null; claimed.delete(sp.key); a.faceTo = sp.face; if (sp.pose === 'sit') { playerSit(sp); } else { gesture(a, ['observe', 'stretch', 'think'][(Math.random() * 3) | 0], 3000); say(a, chat.solo(tod), 3600, true); } };
      if (sp.via) { routeTo(a, sp.via[0], fin); a.path.push(...sp.via.slice(1).map((v) => v.clone()), sp.p.clone()); } else routeTo(a, sp.p, fin);
      if (!player.toldAuto) { player.toldAuto = true; onToast?.('😌 Karaktermu bergerak sendiri saat kamu diam. Gerak sedikit untuk mengambil alih lagi'); }
    }
    if (player.lookTo != null) { const d = player.lookTo - player.yaw; player.yaw += d * Math.min(1, dt * 1.6); if (Math.abs(d) < 0.03) player.lookTo = null; }
  }
  function updatePlayer(dt, now) {
    const a = player.a;
    playerLife(dt, now); zoneTick(a, now);
    { const pv = wpY(a, 1.4); const wp = new THREE.Vector3(); for (const w of walls) { if (w.userData.center) wp.copy(w.userData.center); else w.getWorldPosition(wp); w.visible = wp.distanceTo(pv) > 4.2; } }
    if (keys.has('KeyQ')) player.yaw += dt * 2.2;
    if (keys.has('KeyR')) player.yaw -= dt * 2.2;
    let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
    let iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
    const len = Math.hypot(ix, iz);
    if (player.sitting && len > 0.3) playerStand();
    a.running = !player.sitting && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
    a.moving = !player.sitting && len > 0.15;
    if (a.moving) {
      ix /= Math.max(1, len); iz /= Math.max(1, len);
      const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
      toWorld(a.g.position, tmpW); const th = lastYaw, wx = fx * iz - fz * ix, wz = fz * iz + fx * ix;
      const mx = wx * Math.cos(th) - wz * Math.sin(th), mz = wx * Math.sin(th) + wz * Math.cos(th);
      const sp = (a.running ? GAIT.run : GAIT.walk) * dt;
      const nx = a.g.position.x + mx * sp, nz = a.g.position.z + mz * sp;
      const cl = (x, z) => collides(x, z) || towerHit(x, z, a.g.position.y);
      const stuck = cl(a.g.position.x, a.g.position.z);
      if (stuck || !cl(nx, nz)) { a.g.position.x = nx; a.g.position.z = nz; }
      else if (!cl(nx, a.g.position.z)) a.g.position.x = nx;
      else if (!cl(a.g.position.x, nz)) a.g.position.z = nz;
      a.faceTo = Math.atan2(mx, mz);
    }
    // gravity and ground: walk on any real surface, fall into the void, and return to the last safe spot
    if (!player.sitting) {
      const p = a.g.position, gY = surfaceAt(p.x, p.z, p.y + 0.3), grounded = gY !== null && p.y - gY <= 0.35;
      if (grounded) {
        p.y += (gY - p.y) * Math.min(1, dt * 14); player.vy = 0;
        if (now - (player.safeT || 0) > 400) { player.safeT = now; let ok = true; for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) if (surfaceAt(p.x + dx, p.z + dz, p.y + 0.8) === null) { ok = false; break; } if (ok) player.safe = { x: p.x, y: p.y, z: p.z }; }
      } else {
        player.vy = Math.max(-45, (player.vy || 0) - 24 * dt); p.y += player.vy * dt;
        if (gY !== null && p.y <= gY) { p.y = gY; player.vy = 0; }
        else if (gY === null && p.y < -28) { const sf = player.safe || { x: 0, y: 0, z: 0 }; p.set(sf.x, sf.y, sf.z); player.vy = 0; camera.position.copy(wp(a)).add(new THREE.Vector3(0, 3, 6)); onToast?.('🪂 Kamu jatuh. Kembali ke titik terakhir yang aman'); sfx.play('pop'); }
      }
    }
    if (player.fp) {
      const p = wp(a), eyeH = player.sitting ? 1.12 : 1.62, bob = a.moving && !player.sitting && a.g.position.y < 0.2 ? Math.sin(now * 0.012) * 0.025 * (a.running ? 1.6 : 1) : 0, cp = Math.cos(player.pitch);
      camera.position.set(p.x, p.y + eyeH + bob, p.z);
      const tg = new THREE.Vector3(camera.position.x + Math.sin(player.yaw) * cp, camera.position.y - Math.sin(player.pitch), camera.position.z + Math.cos(player.yaw) * cp); controls.target.copy(tg); camera.lookAt(tg);
    } else {
    // third-person camera behind the player
    const target = wp(a).add(new THREE.Vector3(0, 1.35, 0));
    const back = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)).multiplyScalar(player.dist);
    camera.position.lerp(target.clone().add(back), Math.min(1, dt * 8));
    if (!player.fp) { const gy = (surfaceAt(camera.position.x, camera.position.z, camera.position.y + 0.8) ?? 0) + 0.22; if (camera.position.y < gy) camera.position.y = gy; }   /* low orbit: the camera may drop below head height but never into the ground */
    controls.target.lerp(target, Math.min(1, dt * 10));
    // wide FOV (default 65) stretches anything near the screen edge horizontally (a head measured 1.22x wide at the centre, 1.61x at the edge): in third-person Play use a narrow, cinematic lens
    { const tf = Math.min(V.fov, PLAY_FOV); if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); } }
    camera.lookAt(controls.target);
    }
    // nearby agents notice you; nearest one or object becomes interactable
    let best = null, bd = 1.9;
    if (player.sitting) best = { type: 'sit', id: 'stand', label: 'Kamu sedang duduk', sub: 'Tekan E atau gerak untuk berdiri' };
    for (const b of avatars.values()) {
      if (b === a) continue;
      const d = b.g.position.distanceTo(a.g.position);
      b.lookAt = d < 4 && b.mode !== 'meeting' ? a.g.position : (b.lookAt === a.g.position ? null : b.lookAt);
      if (d < bd) { bd = d; best = { type: 'agent', id: b.id, label: b.e.name, sub: b.e.title }; }
    }
    if (!best) { if (!sitAll) sitAll = [...plazaSpots, ...[...rooms.values()].flatMap((r) => r.spots)].filter((q) => q.pose === 'sit'); let bs = null, bds = 1.5; const pp = a.g.position; for (const q of sitAll) { if (claimed.has(q.key) || Math.abs(q.p.y - pp.y) > 1.2) continue; const d = Math.hypot(q.p.x - pp.x, q.p.z - pp.z); if (d < bds) { bds = d; bs = q; } } if (bs) best = { type: 'sit', id: bs.key, label: 'Duduk di sini', sub: 'Tekan E untuk duduk', spot: bs }; }
    if (!best) for (const poi of pois) { const d = Math.hypot(poi.x - a.g.position.x, poi.z - a.g.position.z); if (d < (poi.r || 2)) { best = { type: 'poi', id: poi.id, label: poi.label, sub: poi.sub }; break; } }
    currentHint = best;
    const k = best ? best.type + best.id : '';
    if (k !== hintKey) { hintKey = k; onPlayerHint?.(best); }
  }

  // ───── loop
  let raf = 0, lastT = performance.now();
  const tmp = new THREE.Vector3();
  const PR = { on: false, t: {}, l: 0 }; window.__prof = PR; const mark = (k) => { if (!PR.on) return; const n = performance.now(); PR.t[k] = (PR.t[k] || 0) + n - PR.l; PR.l = n; };
  const draw = () => { mark("pre"); if (quality >= 1) { const u = grade.uniforms, sz = renderer.getDrawingBufferSize(dofSz); u.uAp.value = dofAmt; u.uNear.value = camera.near; u.uFar.value = camera.far; u.uRes.value.copy(sz); const eye = 1 - THREE.MathUtils.smoothstep(camera.position.y, 1.5, 7); const rawF = player ? (player.fp ? 14 : THREE.MathUtils.clamp(Math.max(camera.position.distanceTo(player.a.g.position) + 0.5, 5.5), 5.5, 40)) : THREE.MathUtils.clamp(Math.max(camera.position.distanceTo(controls.target), 9, eye * 18), 2.5, 110); /* Play: focus ON the player's character (the old floor of 6-18 units left a character 3-6 units away soft) */ dofFocus += (rawF - dofFocus) * (player ? 0.35 : 0.12); if (!isFinite(dofFocus)) dofFocus = 12; u.uFocus.value = dofFocus; u.uWide.value = THREE.MathUtils.smoothstep(dofFocus, 28, 85); if (scene.fog) { const fc = scene.fog.color; u.uHaze.value.set(Math.pow(fc.r, 1 / 2.2), Math.pow(fc.g, 1 / 2.2), Math.pow(fc.b, 1 / 2.2)); } u.tDepth.value = composer.readBuffer.depthTexture; composer.render(); } else renderer.render(scene, camera); mark("render"); };
  let sndOff = false;
  function frame(step) {
    // step === true renders one frame on demand (inspection hook), without starting a second loop
    if (step !== true) { raf = requestAnimationFrame(frame); const off = !visible || document.hidden; if (off !== sndOff) { sndOff = off; sfx.pause(off); if (off) sfx.brain(0); } if (off) return; }
    const now = performance.now();
    if (step !== true && gfx === 'eco' && now - lastDraw < 30) return;
    if (step !== true && winDim && now - lastDraw < 66) return;
    if (step !== true && !player && !chaseId && !camAnim && now - lastInput > 4000 && now - lastDraw < (() => { const idle = now - lastInput; return idle > 120000 ? 200 : idle > 45000 ? 100 : idle > 12000 ? 50 : 32; })()) return;   /* idle tiers: ~30 fps, 20, 10, 5; any input wakes it at once. The scene is GPU-bound (~40 ms/frame on an integrated GPU), so frame rate is the lever that cuts average load without touching how it looks while you use it */
    if ((frameNo % 8) === 0) {
      const cp = camera.position, list = [];
      for (const a of avatars.values()) { if (!a.bubble) continue; const d = a.g.position.distanceTo(cp); list.push([d, a]); }
      list.sort((x, y) => x[0] - y[0]);
      list.forEach(([d, a], i) => { const k = d > 36 || i >= 6 ? 0 : 1 - Math.max(0, (d - 14) / 22); a.bubble.visible = k > 0.04; a.bubble.userData.k = k; });
    }
    sfx.tick(now / 1000); animateTele(now); socialTick(now); animateFloaters(now / 1000, Math.min((now - lastT) / 1000, 0.1));
    PR.l = performance.now(); trackFps(now); renderer.info.reset();
    const realDt = Math.min((now - lastT) / 1000, 0.5); const dt = Math.min(realDt, 0.05); lastT = now; // movement uses real time so walking speed survives low FPS
    let crowdCount = 0;
    for (const a of avatars.values()) {
      a.phase += dt;
      if ((a.mode === 'leisure' || a.mode === 'visit') && a.e.type === 'ai') crowdCount++;
      if (a.tele) teleStep(a, now);
      if (a.path.length && !(a.tele && a.tele.phase === 'out')) {
        const tgt = a.path[0]; tmp.subVectors(tgt, a.g.position); tmp.y = 0;
        const d = tmp.length();
        // walk short trips, run long ones (hysteresis 28 / 14 units to the final target) at the clips' natural paces
        a.running = !!a.runTrip;   /* leisure strolls walk; urgent medium trips run */
        let step = (a.running ? GAIT.run : GAIT.walk) * realDt;
        // global traffic rules, for every agent: wait for a seat someone is still using; slow down behind a standing person
        a.seatWait = a.path.length === 1 && seatTaken(a, tgt) ? (a.seatWait || 0) + realDt : 0;
        if (a.seatWait > 0 && a.seatWait < 8) step = 0; // waits up to 8 s, then goes anyway so nobody is stuck forever
        else if (yieldTo(a, tmp)) step *= 0.2;
        if (step === 0) { /* waiting */ } else if (d <= step) { a.g.position.copy(tgt); a.path.shift(); if (!a.path.length) { a.runTrip = false; const f = a.onArrive; a.onArrive = null; f?.(); } }
        else { tmp.normalize(); steer(a, tmp); a.g.position.addScaledVector(tmp, step); a.faceTo = Math.atan2(tmp.x, tmp.z); }
        if (decks.length) a.g.position.y = elev(a.g.position.x, a.g.position.z);
      }
      // NPCs follow the lawn hills too (the player already did through surfaceAt): before, agents walked at y=0 and sank into every mound
      if (terrainH && !a.player && a.pose !== 'sit' && a.lod < 4) { const th = terrainH(a.g.position.x, a.g.position.z); if (th > 0.001 || a.onHill) { const base = decks.length ? elev(a.g.position.x, a.g.position.z) : 0; a.g.position.y = base + th; a.onHill = th > 0.001; } }
      const walking = a.path.length > 0 || a.moving;
      a.acc = (a.acc || 0) + dt;
      if (a.lod === 4) { a.ran = false; a.path.length || (a.moving = false); }
      { const mv = a.path.length > 0 || a.moving, k = a.lod === 4 ? 16 : a.lod === 3 ? 8 : a.lod === 2 ? (mv ? 2 : 4) : a.lod === 1 ? (mv ? 1 : 2) : 1; a.ran = k === 1 || (frameNo + (a.seq ??= ++agentSeq)) % k === 0; if (a.ran) { animate(a, a.acc, now); a.acc = 0; } }
      if (a.faceTo !== undefined) { let d = a.faceTo - a.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.g.rotation.y += d * Math.min(1, dt * 7); }
      const farIdle = a.lod === 4 && !a.path.length && !a.player && (frameNo + (a.seq || 0)) % 4 !== 0;   /* tiny dots in the distance: skip this frame's cosmetics and life logic */
      if (!farIdle) { a.ring.material.opacity = a.e.status === 'working' ? 0.55 + Math.sin(a.phase * 5) * 0.4 : 0.9;
      a.statusDot.rotation.y += dt * 2.2 * (a.lod === 4 ? 4 : 1); a.statusDot.position.y = (a.topY || 1.85) + 0.24 + Math.sin(a.phase * 2.4) * 0.05; }
      if (a.jump > 0) { a.jump = Math.max(0, a.jump - dt * 1.6); a.body.position.y += Math.sin(a.jump * Math.PI * 2) * 0.25 * (a.jump > 0 ? 1 : 0); }
      if (!walking && !a.player) {
        if (a.mode === 'desk' && a.pose === 'sit' && a.e.status === 'working' && a.lod < 3 && now > (a.nextWork ??= now + 8000 + Math.random() * 40000)) { a.nextWork = now + 35000 + Math.random() * 60000; const wl = chat.work(a.desk?.room?.div?.id); if (wl && !a.bubble) say(a, wl, 4200, true); }
        if (a.until && now > a.until) { a.until = 0; const w = want(a); if (w === 'free' && a.mode !== 'desk' && crowdNow < crowdCap() && Math.random() < 0.4) { crowdNow++; /* linger elsewhere */ if (Math.random() < 0.5 && goPlaza(a)) { /* plaza */ } else { const s = claimSpot(a, ['cafe', 'play', 'lounge'][(Math.random() * 3) | 0], 'leisure'); s ? goSpot(a, s, 'leisure', 12000 + Math.random() * 20000) : goDesk(a); } } else if (w === 'free' || a.mode === 'visit' || a.mode === 'leisure') goDesk(a); else applyWant(a); }
        if (want(a) === 'free' && a.mode === 'desk' && a.e.type === 'ai' && now > a.nextIdle && crowdNow < crowdCap() && Math.random() < 0.06) {   // at most V.crowd idle agents roam at once; the rest stay at their desks
          a.nextIdle = now + 20000 + Math.random() * 40000; crowdNow++;
          if (Math.random() < 0.35) { gesture(a, ['stretch', 'think', 'nod'][(Math.random() * 3) | 0], 2200); if (Math.random() < 0.4) emote(a, ['☕', '🎧', '🤔', '😌', '✨'][(Math.random() * 5) | 0], 2400); }
          if (Math.random() < 0.55 && goPlaza(a)) { /* off to the plaza */ } else if (Math.random() < 0.6) { const s = claimSpot(a, ['cafe', 'play', 'lounge', 'library'][(Math.random() * 4) | 0], null); if (s && s.tag !== 'meeting') goSpot(a, s, 'leisure', 10000 + Math.random() * 25000); }
        }
      }
      if (a.bubble && now > a.bubbleUntil) { disposeSprite(a.bubble); a.bubble = null; }
      if (!farIdle) { leisureLife(a, now); stationLife(a, now); followLife(a, now); }
    }
    crowdNow = crowdCount;
    mark("agentsLoop"); separate(); mark("separate");
    updateRoof(); updateDome();
    if (aiCore) { aiCore.rotation.y += 0.006; aiCore.children[0].position.y = Math.sin(performance.now() * 0.0012) * 0.25; aiCore.children[1].rotation.z += 0.004; aiCore.children[2].rotation.z -= 0.003; }
    // the chair slides back while its agent sits (and returns when they stand); the body and the chair move together so they stay aligned
    for (const a of avatars.values()) {
      if (!a.desk || !a.desk.chair || !a.rig) continue;
      const want = a.pose === 'sit' && a.path.length === 0 && a.mode === 'desk' ? CHAIR_PULL : 0;
      a.pull = (a.pull || 0) + (want - (a.pull || 0)) * Math.min(1, dt * 3);
      if (a.pull !== a.pullDrawn) { a.pullDrawn = a.pull; a.rig.setSeatShift?.(a.pull, a.backLocal); a.desk.chair.position.z = CHAIR_Z + a.pull / FS; }
    }
    { const lead = player ? player.a.id : chaseId || (follow ? selectedId : null);
      for (const a of avatars.values()) {
        const g = a.g; toWorld(g.position, tmpW); const armYaw = lastYaw; const fl = Math.max(0, Math.min(floors.length - 1, Math.ceil((tmpW.y - g.position.y) / FH - 0.05)));
        if (a.id === lead) autoFloor = fl;
        if (a.label?.userData.base) { const d = tmpW.distanceTo(camera.position); const mine = a.id === selectedId || a.id === chaseId; a.label.visible = showLabels && (d < 8 || mine); a.ring.visible = d < 18 || mine; a.statusDot.visible = d < 12 || mine; if (a.label.visible) { const k = Math.max(0.4, Math.min(1.6, d / 13)), b = a.label.userData.base; a.label.scale.set(b[0] * k, b[1] * k, 1); } }
        g.visible = fl <= viewFloor && a.lod !== 4 && !a.fpHide; g.matrixWorldAutoUpdate = a.ran !== false || !!a.path.length; { const sk = a.rig?.skin?.skeleton; if (sk) { if (!sk.__u) sk.__u = sk.update; sk.update = a.ran !== false || a.path.length || a.moving ? sk.__u : NOOP; } } if (a.prop) { a.holding = a.pose !== 'sit' && !(a.mode === 'desk' && !a.path.length) && a.lod === 0; a.prop.visible = a.holding; } { const ry = g.rotation.y; g.rotation.y = ry + armYaw; g.updateMatrix(); g.rotation.y = ry; } const m = g.matrix.elements; m[12] = tmpW.x; m[13] = tmpW.y; m[14] = tmpW.z; g.matrixWorldNeedsUpdate = true;
      }
      if (autoFloor !== null) { if (autoFloor !== viewFloor) setFloor(autoFloor); autoFloor = null; } }
    if ((lodTick % 10) === 0) for (const r of rooms.values()) { const sg = r.sign; if (!sg?.userData.base) continue; sg.getWorldPosition(tmpW); const d = tmpW.distanceTo(camera.position); sg.visible = !player && !walkMode && d > 9 && d < 46; const k = Math.max(0.5, Math.min(1.7, d / 28)), b = sg.userData.base; sg.scale.set(b[0] * k, b[1] * k, 1); }
    if ((lodTick % 10) === 0 && env?.group) for (const c of env.group.children) {
      if (c.isPoints || c.isInstancedMesh) continue;
      let cu = c.userData.cull; if (!cu) { c.userData.cull = cu = { c: new THREE.Vector3(), r: 0, city: false }; if (c.userData.noCull) cu.skip = true; else { const bb = new THREE.Box3().setFromObject(c); if (bb.isEmpty()) cu.skip = true; else { bb.getCenter(cu.c); cu.r = bb.getBoundingSphere(new THREE.Sphere()).radius; cu.city = Math.hypot(cu.c.x, cu.c.z) < 330 && cu.r < 120; } } }
      if (!cu.skip && cu.city) c.visible = camera.position.distanceTo(cu.c) - cu.r < 520;
    }
    if ((lodTick % 10) === 0) for (const a of avatars.values()) deskScreen(a);
    if ((lodTick % 10) === 0) for (const a of avatars.values()) { const dk = a.desk; if (!dk?.seat) continue; const dd = toWorld(dk.seat, tmpW).distanceTo(camera.position); if (dk.screen) dk.screen.visible = dd < 45; if (dk.chair) dk.chair.visible = dd < 85; }
    if ((lodTick % 10) === 0) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(frustumM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    if (gfx === 'eco' && (lodTick % 10) === 0) for (const m of ecoDetail) { const vis = m.userData.ecoC.distanceTo(camera.position) - m.userData.ecoR < 75; if (vis !== m.visible) m.visible = vis; }
    if ((lodTick++ % 10) === 0) for (const a of avatars.values()) { const d = wp(a, tmpW).distanceTo(camera.position); deskTitle(a, d); const eL = gfx === 'eco' ? 0.55 : 1, near = d < 22 * eL ? 0 : d < 50 * eL ? 1 : d < 110 * eL ? 2 : 4;   /* eco: the detailed bodies only very close */ sphere.center.copy(tmpW); sphere.radius = 1.6; const lod = a.mode === 'walk' || a.path.length || near === 0 || frustum.intersectsSphere(sphere) ? near : 3; if (lod !== a.lod) { a.lod = lod; a.rig?.setLod?.(Math.min(lod, 2)); }
      if (gfx === 'eco') { const far = d > 55, farDot = d > 110, dk = a.desk; if (far !== a.ecoFar) { a.ecoFar = far; if (a.ring) a.ring.visible = !far; if (dk?.screen) dk.screen.visible = !far; if (dk?.chair) dk.chair.visible = !far; } if (farDot !== a.ecoFarDot) { a.ecoFarDot = farDot; if (a.statusDot) a.statusDot.visible = !farDot; } }
      else if (a.ecoFar || a.ecoFarDot) { a.ecoFar = a.ecoFarDot = false; if (a.ring) a.ring.visible = true; if (a.statusDot) a.statusDot.visible = true; if (a.desk?.screen) a.desk.screen.visible = true; if (a.desk?.chair) a.desk.chair.visible = true; } }
    if (frameNo % 4 === 0) { let n = 0; for (const a of avatars.values()) { if (a.lod !== 4 || n >= 320) continue; wp(a, dotP); dotP.y += 1; dotM.compose(dotP, dotQ, dotS); dots.setMatrixAt(n, dotM); dots.setColorAt(n, a.ring.material.color); n++; } dots.count = n; dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true; }
    env?.update(realDt, now / 1000); lifeAcc += realDt; if (frameNo % 2 === 0) { life?.update(lifeAcc, now / 1000); lifeAcc = 0; }
    sky.position.copy(camera.position);
    // the focus stays clear and things a few times further fade out (short view distance up close)
    // exponential haze tied to camera distance: the ground melts into the sky's horizon colour (no hard edge)
    if (scene.fog) { const dist = camera.position.distanceTo(controls.target); scene.fog.density = Math.min(0.0055 + fogNight * 0.0016, 0.16 / Math.max(dist, 1)) * (V.fog / 20); }
    grade.uniforms.uTime.value = (now % 10000) / 1000;
    clockAcc += realDt; if (clockAcc > 0.5) { clockAcc = 0; const h = tod; onTime?.(fmtTod(), h >= 5 && h < 7.5 ? '🌅' : h >= 7.5 && h < 16.5 ? '☀️' : h >= 16.5 && h < 19 ? '🌇' : '🌙', autoDay, h); }
    if (autoDay) { tod = (tod + realDt * 0.04) % 24; dayAcc += realDt; if (dayAcc > 0.1) { dayAcc = 0; applySun(); } }
    { const far = player || walkMode ? 0 : THREE.MathUtils.clamp((camera.position.distanceTo(controls.target) - 14) / 70, 0, 1); grade.uniforms.uBlur.value += ((quality >= 2 ? 0 * far : 0) - grade.uniforms.uBlur.value) * Math.min(1, realDt * 3); }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.ring) { p.t += dt * (p.spd || 1.5); p.ring.scale.setScalar(1 + p.t * (p.big || 4)); p.ring.material.opacity = Math.max(0, 1 - p.t); if (p.t >= 1) { world.remove(p.ring); p.ring.geometry.dispose(); p.ring.material.dispose(); packets.splice(i, 1); } continue; }
      p.t += dt * p.speed;
      if (p.t >= 1) { world.remove(p.m, p.line); p.line.geometry.dispose(); p.m.material.dispose(); p.line.material.dispose(); packets.splice(i, 1); p.onDone?.(); continue; }
      p.m.position.copy(p.curve.getPoint(p.t)); p.line.material.opacity = 0.75 * (1 - p.t * 0.6);
    }
    if (brainCore) {
      if ((frameNo % 6) === 0) {
        const bp = brainFlat(), who = player ? player.a.g.position : controls.target; let dmin = Math.hypot(who.x - bp.x, who.z - bp.z);
        for (const a of avatars.values()) { if (a.player) continue; const d = Math.hypot(a.g.position.x - bp.x, a.g.position.z - bp.z); if (d < 9.2) { if (!a.inBrain && performance.now() > (a.brainAt || 0)) { a.inBrain = true; a.brainAt = performance.now() + 20000; brainHit(0xc9a0ff, 'absorb'); emote(a, '🧠', 2200); } } else if (d > 9) a.inBrain = false; }
        brainCore.near = Math.max(0, 1 - Math.max(0, dmin - 6) / 30); sfx.brain(brainCore.near);
      }
      brainCore.pulse = Math.max(brainCore.pulse, (brainCore.near || 0) * 0.28);
      brainCore.orb.rotation.y += dt * 0.35; brainCore.orb.rotation.x += dt * 0.14;
      brainCore.pulse = Math.max(0, brainCore.pulse - dt * 0.6);
      brainCore.pulseS += (brainCore.pulse - brainCore.pulseS) * Math.min(1, dt * 2.2); const ps = brainCore.pulseS;
      const br = 0.5 + 0.5 * Math.sin(now / 2600) * 0.7 + 0.5 * 0.3 * Math.sin(now / 1700 + 1.3); // slow, layered breathing (never a hard blink)
      brainCore.inner.scale.setScalar(1 + ps * 0.35 + br * 0.08);
      brainCore.orb.material.emissiveIntensity = 0.8 + br * 0.45 + ps * 1.0; brainCore.inner.material.emissiveIntensity = 1.3 + br * 0.6 + ps * 1.2;
      brainCore.light.intensity = 6 + br * 2.4 + ps * 16;
      { const tt = now / 1000, bu = brainCore.beam.material.uniforms, hu = brainCore.halo.material.uniforms; bu.uT.value = hu.uT.value = tt; bu.uAmt.value = 0.42 + br * 0.1 + ps * 0.3; hu.uAmt.value = 0.16 + br * 0.06 + ps * 0.18; const sc = 1 + ps * 0.18 + br * 0.03; brainCore.beam.scale.set(sc, 1, sc); brainCore.halo.scale.set(sc * 1.04, 1, sc * 1.04); }
      { const md = brainCore.mdat, mp = brainCore.mp, tt = now / 1000; for (let i = 0; i < md.length; i++) { const m = md[i]; m.a += m.sp * dt * (1 + brainCore.pulse * 3); mp[i * 3] = Math.cos(m.a) * m.r; mp[i * 3 + 1] = m.y + Math.sin(tt * 0.7 + m.ph) * 0.6; mp[i * 3 + 2] = Math.sin(m.a) * m.r; } brainCore.motes.geometry.attributes.position.needsUpdate = true; brainCore.motes.material.opacity = 0.55 + br * 0.3 + brainCore.pulse * 0.3; }
      brainCore.spin = Math.max(0, brainCore.spin - dt * 0.5); const sp = 1 + brainCore.spin * 4 + (brainCore.near || 0) * 1.2;
      if (brainCore.rings) { brainCore.rings[0].rotation.z += dt * 0.5 * sp; brainCore.rings[1].rotation.z -= dt * 0.35 * sp; brainCore.rings[2].rotation.z += dt * 0.28 * sp; }
      { const tt = now / 1000, nc = brainCore.ncol, nph = brainCore.nph; brainCore.net.rotation.y += dt * 0.18 * sp; brainCore.net.rotation.x = Math.sin(tt * 0.2) * 0.2;
        for (let i = 0; i < nph.length; i++) { const f = Math.pow(0.5 + 0.5 * Math.sin(tt * (1.1 + (i % 5) * 0.23) + nph[i]), 3) * (0.55 + brainCore.pulseS * 0.9); nc[i * 3] = 1.0 * (0.25 + f); nc[i * 3 + 1] = 0.78 * (0.25 + f); nc[i * 3 + 2] = 0.5 * (0.2 + f * 0.8) + (i % 7 === 0 ? 0.35 * f : 0); }
        brainCore.net.children[1].geometry.attributes.color.needsUpdate = true; brainCore.glyph.material.uniforms.uT.value = tt; brainCore.glyph.material.uniforms.uAmt.value = 0.45 + br * 0.2 + brainCore.pulseS * 0.4;
        for (const cap of brainCore.pylons) { cap.rotation.y += dt * 1.4; cap.scale.setScalar(1 + 0.15 * Math.sin(tt * 2.1 + cap.position.x) + brainCore.pulseS * 0.5); }
        const flick = 0.1 + 0.08 * br + brainCore.pulseS * 0.75; brainCore.boltMat.opacity = Math.min(0.95, flick * (0.6 + 0.4 * Math.random()));
        for (const b of brainCore.bolts) { for (let k = 0; k < 14; k++) { const u = k / 13, j = k === 0 || k === 13 ? 0 : 0.28 * (1 - Math.abs(u - 0.5) * 1.4), x = b.from.x + (b.to.x - b.from.x) * u + (Math.random() - 0.5) * j, y = b.from.y + (b.to.y - b.from.y) * u + (Math.random() - 0.5) * j, z = b.from.z + (b.to.z - b.from.z) * u + (Math.random() - 0.5) * j; b.bp[k * 3] = x; b.bp[k * 3 + 1] = y; b.bp[k * 3 + 2] = z; } b.bl.geometry.attributes.position.needsUpdate = true; }
        // note cards orbit the core
        for (const c of brainCore.notes) { if (!c.s) continue; const age = now - c.t0; if (age > c.life) { brainCardSwap(c); continue; }
          const fi = Math.min(1, age / 900), fo = Math.min(1, (c.life - age) / 900), dcam = camera.position.distanceTo(brainCore.group.position), kd = 1 - Math.min(1, Math.max(0, (dcam - 20) / 24));
          c.s.material.opacity = 0.9 * (fi * fi * (3 - 2 * fi)) * (fo * fo * (3 - 2 * fo)) * kd; c.s.visible = c.s.material.opacity > 0.02;
          c.a += c.sp * dt * (1 + brainCore.spin * 2); c.s.position.set(Math.cos(c.a) * c.r, c.y + Math.sin(tt * 0.8 + c.ph) * 0.25, Math.sin(c.a) * c.r); }
        // a sweeping scan ring when somebody stands close, and a thought now and then
        if ((brainCore.near || 0) > 0.3 && now > brainCore.scanT) { brainCore.scanT = now + 7000; shock(brainFlat(), 0xffd9a8, 17, 0.5); }
        if (now > brainCore.insightT) { brainCore.insightT = now + 22000 + Math.random() * 24000; const pool = [...avatars.values()].filter((x) => x.lod < 3 && !x.player); if (pool.length) knowledgeFlow(pool[(Math.random() * pool.length) | 0], [0xffb36b, 0x8fd0ff, 0xc9a0ff, 0x7be0a8][(Math.random() * 4) | 0]); }
      }
    }
    if (intro) stepIntro(realDt);
    else if (pull) stepPull(realDt);
    else if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt * 1.6); const k = 1 - Math.pow(1 - camAnim.t, 3);
      camera.position.lerpVectors(camAnim.from, camAnim.to, k); controls.target.lerpVectors(camAnim.tf, camAnim.tt, k);
      if (camAnim.t >= 1) { camAnim = null; if (selectedId) follow = true; }
    } else if (chaseId) updateChase(realDt);
    else if (follow && selectedId) {
      const a = avatars.get(selectedId); if (a) { const d = wp(a).sub(controls.target); controls.target.add(d); camera.position.add(d); }
    }
    if (!player) updateFly(realDt);
    for (const t of screenTex.values()) t.offset.y = (t.offset.y + dt * 0.04) % 1;
    if (blinkers.length && Math.random() < 0.3) { const l = blinkers[(Math.random() * blinkers.length) | 0]; l.visible = !l.visible; }
    if (now - shadowT > 125) { shadowT = now; renderer.shadowMap.needsUpdate = true; }
    lastDraw = now; frameNo++;
    { const nn = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.02, 0.3, 5); if (Math.abs(nn - camera.near) / camera.near > 0.1) { camera.near = nn; camera.updateProjectionMatrix(); } }
    if (player) { updatePlayer(realDt, now); draw(); return; }
    controls.update(); clampCamera();
    draw();
  }
  renderer.info.autoReset = false; // count draw calls across all composer passes of a frame
  applyQuality();
  frame();

  function setTheme(t) {
    const light = t === 'light';
    // light = hazy daylight; dark = cinematic golden-hour dusk with lit windows and street lamps
    const fogHex = 0x574f9e;
    scene.background = null;
    sky.material.uniforms.top.value.setHex(0x12173a); sky.material.uniforms.horizon.value.setHex(0x574f9e); sky.material.uniforms.glow.value.setHex(light ? 0x332a1c : 0x6a3a18);
    scene.fog = new THREE.FogExp2(fogHex, 0.0072);
    M.ground.color.setHex(light ? 0xd8d0c4 : 0x15120f);
    hemi.intensity = light ? 1.05 : 0.8;
    hemi.color.setHex(light ? 0xeef3fb : 0xc9cfe0); hemi.groundColor.setHex(light ? 0x6b5f50 : 0x2e2620);
    sun.intensity = light ? 2.0 : 2.1; sun.color.setHex(light ? 0xfff0dc : 0xffbf86);
    renderer.toneMappingExposure = (light ? 0.98 : 1.0) * expK();
    grade.uniforms.uWarm.value = (light ? 0.25 : 0.7) * lookNow.warm; grade.uniforms.uVig.value = (light ? 0.22 : 0.38) * (V.vig / 0.3);
    env?.setDusk(light ? 0 : 1);
    applySun();
  }
  setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  const stats = () => {
    const here = {}; for (const a of avatars.values()) { const r = roomAt(a.g.position); const k = r ? r.id : 'corridor'; here[k] = (here[k] || 0) + 1; }
    return { rooms: [...rooms.values()].map((r) => ({ id: r.id, name: r.div ? r.div.name : r.name, kind: r.kind, here: here[r.id] || 0 })), corridor: here.corridor || 0 };
  };

  return {
    sync, onEvent, focus, setTheme, stats,
    summon, endTalk, listen, think, speak, startChase, stopChase, following: () => chaseId, spotlight, mark: (id, ch, ms) => { const x = avatars.get(id); if (x) emote(x, ch, ms); }, setInset: (px) => { inset = Math.max(0, px | 0); applyInset(); },
    keyActions: () => KEYACT.map((a) => ({ mode: a.mode, id: a.id, label: a.label, def: a.def, key: effKey(a) })),
    lookInvert: () => lookInvert, setLookInvert: (v) => { lookInvert = !!v; saveKeys(); },
    /** bind an action to a key; if another action in the same mode already uses it, the two swap keys */
    setKey: (mode, id, code) => {
      if (RESERVED.test(code)) return false; const a = KEYACT.find((x) => x.mode === mode && x.id === id); if (!a) return false;
      const old = effKey(a), other = KEYACT.find((x) => x.mode === mode && x !== a && effKey(x) === code);
      const put = (x, k) => { if (k === x.def) delete custom[mode][x.id]; else custom[mode][x.id] = k; };
      put(a, code); if (other) put(other, old); rebuildKeys(); saveKeys(); return true;
    },
    resetKeys: () => { custom = { free: {}, play: {} }; lookInvert = false; rebuildKeys(); saveKeys(); },
    loadKeys: (o) => { if (!hasStored && o) applyKeys(o); },
    visual: () => ({ ...V }), visualDefaults: () => ({ ...VDEF }),
    setVisual: (patch) => { Object.assign(V, patch); saveV(); applyVisual(); },
    dof: () => V.dof, setDof: (v) => { V.dof = Math.max(0, Math.min(2.5, v)); saveV(); applyVisual(); },
    fov: () => V.fov, setFov: (v) => { V.fov = Math.max(20, Math.min(90, v)); saveV(); applyVisual(); },
    look: () => lookName, setLook: (n) => { if (!LOOKS[n]) return; lookName = n; lookNow = LOOKS[n]; try { localStorage.setItem('office-look', n); } catch { /* ignore */ } applyLook(); },
    bars: () => bars, setBars: (b) => { bars = !!b; try { localStorage.setItem('office-bars', bars ? '1' : '0'); } catch { /* ignore */ } applyBars(); },
    teleportTargets: () => teleTargets(), teleportTo: (id) => teleportTo(id), relock: () => lockMouse(),
    setBlocking: (on) => { uiBlock = !!on; winDim = !!on; if (on) { keys.clear(); fly.clear(); try { document.exitPointerLock?.(); } catch { /* ignore */ } } },
    gfx: () => gfx,
    setGfx: (m) => { const wasEco = gfx === 'eco'; gfx = m; try { localStorage.setItem('office-gfx', m); } catch { /* ignore */ } if (m === 'eco') { quality = 0; resScale = Math.min(resScale, 0.8); } else if (m === 'high') { quality = 2; resScale = 1; } else { quality = 1; resScale = 1; } applyQuality(); if ((m === 'eco') !== wasEco && data) { layoutKey = ''; sync(data); } },
    gfxStats: () => ({ gfx, fps: Math.round(fpsAvg), res: +resScale.toFixed(2), quality, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    timeOfDay: (h) => { if (h != null) { tod = ((h % 24) + 24) % 24; applySun(); } return fmtTod(); },
    setAutoDay: (v) => { autoDay = !!v; }, isAutoDay: () => autoDay,
    rebuildAvatar: (e) => rebuildAvatar(e),
    express: (id, ch, g) => { const a = avatars.get(id); if (!a) return; if (ch) emote(a, ch, 2600); if (g === "wave") a.waveUntil = performance.now() + 2200; else if (g) gesture(a, g, 2200); const pl = [...avatars.values()].find((x) => x.player); if (pl) { a.lookAt = pl.g.position; setTimeout(() => { if (a.lookAt === pl.g.position) a.lookAt = null; }, 6000); } },
    enterPlayer, exitPlayer, isPlayer: () => !!player, cinematicIntro, hasAvatar: (id) => avatars.has(id), introActive: () => !!intro, wave: () => { if (player) player.a.waveUntil = performance.now() + 1600; },
    joystickActive: () => joy.id !== null,
    /** screen position (px inside the 3D container) of a point just above an agent's head, or null when behind the camera */
    agentMenuAt: (id) => { const a = avatars.get(id); if (!a) return; const v = wp(a); v.y += (a.topY || 1.3) * 0.55; v.project(camera); const cr = renderer.domElement.getBoundingClientRect(); agentMenu(id, { clientX: cr.left + (v.x * 0.5 + 0.5) * cr.width, clientY: cr.top + (-v.y * 0.5 + 0.5) * cr.height }); },
    screenOf: (id) => { const a = avatars.get(id); if (!a) return null; const v = wp(a); v.y += (a.topY || 1.3) * 0.55; v.project(camera); if (v.z > 1) return null; const r = renderer.domElement.getBoundingClientRect(); return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height }; },
    /** roof: 'auto' (cutaway), 'on' or 'off'; returns the new mode */
    floorCount: () => floors.length, getFloor: () => viewFloor, setFloor: (k) => { setFloor(k); return viewFloor; },
    toggleRoof: () => { roofMode = roofMode === 'auto' ? 'on' : roofMode === 'on' ? 'off' : 'auto'; updateRoof(); return roofMode; },
    wave: (id) => { const a = avatars.get(id); if (a) { a.waveUntil = performance.now() + 2600; a.lookAt = camera.position.clone(); } },
    perf: () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, quality, fps: fpsAvg }),
    inspect: (id) => { const a = avatars.get(id); return a && { mode: a.mode, pose: a.pose, path: a.path.length, pos: a.g.position.toArray().map((v) => +v.toFixed(1)), status: a.e.status, spot: a.spot?.key || null }; },
    resetView: () => { selectedId = null; follow = false; highlight(); fitCamera(false, 'iso'); },
    topView: () => { selectedId = null; follow = false; fitCamera(false, 'top'); },
    zoom: (f) => { const d = camera.position.clone().sub(controls.target).multiplyScalar(f); animateTo(controls.target.clone().add(d), controls.target.clone()); },
    toggleLabels: () => { showLabels = !showLabels; for (const a of avatars.values()) if (a.label) a.label.visible = showLabels; return showLabels; },
    focusZone: (id) => { const r = rooms.get(id) || [...rooms.values()].find((x) => x.kind === id); if (!r) return; const t = toWorld(new THREE.Vector3(r.cx, 0, r.cz)); setFloor(r.wing); animateTo(t.clone().add(new THREE.Vector3(0, 12, 8)), t); },
    setVisible: (v) => {
      visible = v;
      if (!v && raf) { cancelAnimationFrame(raf); raf = 0; return; }
      if (v) { lastT = performance.now(); resize(); if (!raf) frame(); }
    },
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); composer.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
