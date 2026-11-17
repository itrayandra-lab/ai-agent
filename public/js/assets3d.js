// Rigged characters for the 3D office.
// Agents use the chibi body built in Blender (3d blender automation pipeline); the Quaternius CC0 humans stay as fallback.
// Every agent is ONE skinned mesh with ONE material: the body's materials are packed into a texture atlas at load
// (colour, glow and roughness/metalness tiles), and skin, hair, suit and trousers colours come from a small per-agent
// uniform, so an agent costs a single draw call whatever its look.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pickMascotLook } from './mascot-palettes.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const glb = new GLTFLoader();
const HUMAN_HEIGHT = 1.74; // metres
// bone names as the GLTF loader stores them (dots removed by PropertyBinding.sanitizeNodeName); both body families share them
const BONE = { armL: 'UpperArmL', foreL: 'LowerArmL', handL: 'PalmL', armR: 'UpperArmR', foreR: 'LowerArmR', handR: 'PalmR', thighL: 'UpperLegL', shinL: 'LowerLegL', footL: 'FootL', thighR: 'UpperLegR', shinR: 'LowerLegR', footR: 'FootR', neck: 'Neck', head: 'Head' };
const BODIES = { male: ['1352', '1353', '1354', '1355'], female: ['1348', '1349', '1350'] };
// When at least one chibi body loads, every agent uses it; set enabled: false to go back to the Quaternius bodies.
// toy_ray: vinyl-toy style body (hips at 0.345 model units -> 0.41 m at height 1.2, matching FURNITURE_SCALE)
/** natural pace of the chibi clips: walk cycle 0.54 s, stride ~0.56 u -> ~1.04 u/s; run ~2.0 u/s. Agents move at these speeds (x ~1.35 at most) so feet do not slide. office3d.js uses the same numbers. */
export const GAIT = { walk: 1.25, run: 3.9 };
const CHIBI = { enabled: true, height: 1.74, ids: ['kiko', 'kiko_ocean', 'kiko_coral', 'azure', 'azure_ocean', 'azure_coral', 'charcoal', 'charcoal_ocean', 'charcoal_coral', 'branch', 'branch_ocean', 'branch_coral'] };
// arm-IK hand targets from the hips: [outward, height, forward]. Human values are metres; chibi values are model units (x body scale).
const HUMAN_POSE = { rest: [0.22, -0.52, 0.04], sit: [0.1, -0.39, 0.12], wave: [0.34, 0.5, 0.05], talk: [0.12, 0.12, 0.34], shrug: [0.34, 0.1, 0.2], present: [0.22, 0.1, 0.45], think: [0.1, 0.5, 0.2], cheer: [0.3, 0.55, 0.0], type: [0.12, 0.2, 0.36], hold: [0.16, 0.12, 0.34] };
const CHIBI_POSE = { rest: [0.19, 0.01, 0.03], sit: [0.12, 0.06, 0.15], wave: [0.26, 0.5, 0.03], talk: [0.12, 0.2, 0.2], shrug: [0.28, 0.2, 0.1], present: [0.18, 0.17, 0.26], think: [0.06, 0.3, 0.15], cheer: [0.24, 0.5, 0.0], type: [0.07, 0.07, 0.2], hold: [0.1, 0.14, 0.2] };
export const FURNITURE_SCALE = 0.98; // office furniture is scaled to the chibi body (hips at 0.41 m): seat top 0.25 m, desk top 0.39 m
const SEAT_TOP = 0.49 * FURNITURE_SCALE; // default chair seat surface (metres); a seat spot can carry its own seatY
const CHIBI_SEAT_PAD = 0.07;  // model units from the hip joint down to the back of the thigh
const HUMAN_SEAT_PAD = 0.05;  // metres, same for the Quaternius bodies
const GEST_CLIP = { cheer: 'Cheer', clap: 'Clapping', think: 'Think', shrug: 'Shrug', nod: 'Nod', phone: 'Phone', drink: 'Drink', read: 'Read' };
// V4.2 bodies carry full arm animation in their clips: the clip drives the arms, IK is only a fallback for bodies without clips
const SIT_CLIPS = new Set(['Sitting', 'Type', 'Read']); // office gestures that have a clip in the chibi body
const EMI = 3; // emissive intensity of the body material; glow tiles are baked relative to it

// ───── appearance palettes (the Sims-style creator uses these; any hex is allowed too)
export const PALETTE = {
  skin: ['#fbe6d2', '#f5d5b5', '#ebbf98', '#dca57a', '#c48a60', '#a86f48', '#8a5532', '#6e4228'],
  hair: ['#1b1411', '#2e1f17', '#4a3022', '#6b4a2e', '#3a3a3d', '#5b3a29', '#7a5230', '#1e1e22'],
  shirt: ['#f4f2ee', '#2c3e57', '#8b9aa8', '#c9b89f', '#3d3d40', '#e6d8c3', '#c2185b', '#2e7d6b', '#f2b8c6', '#6a5acd', '#e8a33d', '#5d8aa8'],
  pants: ['#1f2a3d', '#2b2d31', '#6e6352', '#1a1a1c', '#3b4b63', '#7d7469', '#4a3b2f', '#55627a'],
  hairStyle: { female: ['long', 'bob', 'bun', 'ponytail', 'hijab', 'curly'], male: ['short', 'side', 'curly', 'bald'] },
};
const CASUAL_SHIRTS = [...PALETTE.shirt, '#ffffff', '#e4572e', '#4a7c59', '#f4a261', '#2a9d8f', '#264653', '#e9c46a', '#b56576', '#88b04b', '#f7cac9'];
export const STYLE_LABEL = { long: 'Panjang', bob: 'Bob', bun: 'Cepol', ponytail: 'Kuncir', hijab: 'Hijab', curly: 'Keriting', short: 'Pendek', side: 'Belah samping', bald: 'Plontos' };

let loaded = null;
let human = null; // { male: [body], female: [body], chibi?: [body] }

// which per-agent colour a body material takes: 0 none, 1 skin, 2 hair, 3 trousers, 4 top / suit
// (chibi materials are tagged "role_skin|Skin" in Blender; the Quaternius ones are plain "Skin", "Shirt", …)
// V4.2 body parts that take a per-agent colour (unique looks for 200+ agents): body=1 skin slot, bezel=2 hair slot, accent=3 trousers slot, shell=4 suit slot, cloth=6 (jacket)
const V4_ROLE = { body: 1, bezel: 2, accent: 3, shell: 4, cloth: 6 };
function roleId(name) {
  const n = String(name).split('|')[0];
  if (n === 'role_skin' || n === 'Skin') return 1;
  if (n === 'role_hair' || n === 'Hair' || n === 'HairBase') return 2;
  if (n === 'role_bottom' || n === 'Pants') return 3;
  if (n === 'role_top' || n === 'Shirt' || n === 'Dress') return 4;
  if (n.startsWith('LOCKED_V4_')) return V4_ROLE[n.slice(10).replace(/_\d+$/, '')] ?? 0;
  if (n === 'Face') return 5; // only used when the face is a 4x4 expression sheet (see applyFace)
  return 0;
}

/**
 * Packs every material of a body into one atlas: a colour tile, a glow tile and a roughness/metalness tile each.
 * Flat-colour materials get a tiny white tile (their colour is a vertex colour); textured ones keep their image at half size.
 */
function buildAtlas(materials) {
  const AW = 1024, PAD = 2;
  const tiles = new Map(); let x = 0, y = 0, rowH = 0;
  const sorted = [...materials].sort((a, b) => (b.map ? b.map.image.height : 0) - (a.map ? a.map.image.height : 0));
  for (const m of sorted) {
    if (tiles.has(m.name)) continue;
    const img = m.map && m.map.image;
    const w = img ? Math.min(768, Math.ceil(img.width / 2)) : 8, h = img ? Math.min(512, Math.ceil(img.height / 2)) : 8;
    if (x + w > AW) { x = 0; y += rowH + PAD; rowH = 0; }
    tiles.set(m.name, { x, y, w, h, flat: !img, m });
    x += w + PAD; rowH = Math.max(rowH, h);
  }
  const AH = THREE.MathUtils.ceilPowerOfTwo(y + rowH);
  const mk = () => { const c = document.createElement('canvas'); c.width = AW; c.height = AH; return c; };
  const cCol = mk(), cEmi = mk(), cOrm = mk();
  const gC = cCol.getContext('2d'), gE = cEmi.getContext('2d'), gO = cOrm.getContext('2d');
  gC.fillStyle = '#fff'; gC.fillRect(0, 0, AW, AH); gE.fillStyle = '#000'; gE.fillRect(0, 0, AW, AH); gO.fillStyle = 'rgb(0,180,0)'; gO.fillRect(0, 0, AW, AH);
  for (const t of tiles.values()) {
    const { m } = t;
    if (!t.flat) gC.drawImage(m.map.image, t.x, t.y, t.w, t.h);
    const k = Math.min(1, (m.emissiveIntensity ?? 1) / EMI);
    if (m.emissiveMap && m.emissiveMap.image) { gE.globalAlpha = k; gE.drawImage(m.emissiveMap.image, t.x, t.y, t.w, t.h); gE.globalAlpha = 1; }
    else if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) { gE.fillStyle = '#' + m.emissive.clone().multiplyScalar(k).getHexString(); gE.fillRect(t.x, t.y, t.w, t.h); }
    gO.fillStyle = `rgb(0,${Math.round(m.roughness * 255)},${Math.round(m.metalness * 255)})`; gO.fillRect(t.x - 1, t.y - 1, t.w + 2, t.h + 2);
  }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
  return { tiles, AW, AH, color: tex(cCol, true), emissive: tex(cEmi, true), orm: tex(cOrm, false) };
}

/**
 * Merges every skinned part of a body into one bind-space geometry without groups.
 * UVs point into the atlas, `color` holds the flat material colours and `roleId` marks the vertices a look recolours.
 */
function mergeSkin(root, atlas, filter = null, byMaterial = false) {
  const parts = []; root.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
  const keep = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];
  const geos = [];
  for (const o of parts) {
    o.updateMatrixWorld(true);
    const slots = Array.isArray(o.material) ? o.material : [o.material];
    const src = o.geometry; const idx = src.index ? src.index.array : null;
    const groups = src.groups.length ? src.groups : [{ start: 0, count: idx ? idx.length : src.attributes.position.count, materialIndex: 0 }];
    for (const grp of groups) {
      const m = slots[grp.materialIndex] || slots[0];
      if (filter && !filter(m)) continue;
      const t = atlas ? atlas.tiles.get(m.name) : null;
      const order = []; for (let i = grp.start; i < grp.start + grp.count; i++) order.push(idx ? idx[i] : i);
      const n = order.length;
      const g = new THREE.BufferGeometry();
      for (const name of keep) {
        const a = src.attributes[name];
        if (!a) { g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 2), 2)); continue; } // a part without UVs
        const arr = new a.array.constructor(n * a.itemSize);
        order.forEach((vi, j) => { for (let k = 0; k < a.itemSize; k++) arr[j * a.itemSize + k] = a.array[vi * a.itemSize + k]; });
        g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
      }
      // UVs into this material's tile (flat tiles are sampled at their centre)
      const uv = g.attributes.uv;
      if (atlas) for (let j = 0; j < n; j++) {
        const u = t.flat ? 0.5 : Math.min(1, Math.max(0, uv.getX(j))), v = t.flat ? 0.5 : Math.min(1, Math.max(0, uv.getY(j)));
        uv.setXY(j, (t.x + 0.5 + u * (t.w - 1)) / atlas.AW, (t.y + 0.5 + v * (t.h - 1)) / atlas.AH);
      }
      if (atlas) {
        const role = m.userData?.faceSheet ? 5 : (roleId(m.name) === 5 ? 0 : roleId(m.name));
        const col = new Uint8Array(n * 3), rid = new Uint8Array(n).fill(role);
        const c = role ? [255, 255, 255] : [Math.round(m.color.r * 255), Math.round(m.color.g * 255), Math.round(m.color.b * 255)];
        for (let j = 0; j < n; j++) { col[j * 3] = c[0]; col[j * 3 + 1] = c[1]; col[j * 3 + 2] = c[2]; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
        g.setAttribute('roleId', new THREE.BufferAttribute(rid, 1, false));
      }
      g.applyMatrix4(o.bindMatrix); // bake each part's bind transform so all parts share identity bind space
      g.userData.mat = m;
      geos.push(g);
    }
  }
  if (byMaterial) {
    // one group per material (a hero mesh keeps its own textured materials)
    const order = [], per = new Map();
    for (const g of geos) { const m = g.userData.mat; if (!per.has(m)) { per.set(m, []); order.push(m); } per.get(m).push(g); }
    if (!order.length) return null;
    const merged = order.map((m) => mergeGeometries(per.get(m), false));
    const out = mergeGeometries(merged, true); out.computeBoundingSphere();
    geos.forEach((g) => g.dispose()); merged.forEach((g) => g.dispose());
    return { geo: out, mats: order };
  }
  if (!geos.length) return null;
  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  geo.computeBoundingSphere();
  return geo;
}
const materialsOf = (root) => { const out = []; root.traverse((o) => { if (o.isSkinnedMesh) out.push(...(Array.isArray(o.material) ? o.material : [o.material])); }); return out; };

/** Loads one body (plus its lighter LOD twin) and checks that every joint the animator needs exists. */
/** linear RGB triple from a manifest → THREE.Color */
const lin = (v) => new THREE.Color().setRGB(v[0], v[1], v[2]);
/**
 * Puts a face on the body: the "Face" material gets one expression cell of <id>.face.png, drawn on the colour of the surface behind it.
 * "ink" faces are dark marks on the skin; "screen" faces are glowing marks on the dark visor.
 */
async function applyFace(root, id, info) {
  const face = materialsOf(root).find((m) => String(m.name).split('|')[0] === 'Face'); if (!face) return;
  const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `/assets/characters/agents/${id}.face.png?v=${AGENT_V}`; });
  if (!img) return;
  const screen = info.faceStyle === 'screen', dc = info.designColors || {};
  const bg = screen ? (dc.Eye ? lin(dc.Eye) : new THREE.Color(0x05070c)) : (dc['role_skin|Skin'] ? lin(dc['role_skin|Skin']) : new THREE.Color(0xdddddd));
  const tint = new THREE.Color(info.faceTint || (screen ? '#9fd8ff' : '#1b1b22'));
  const S = 256, cell = img.width / 4; // sheet: 16 cells of 256 px, one expression each
  const glyph = document.createElement('canvas'); glyph.width = glyph.height = S * 4; const gg = glyph.getContext('2d');
  gg.drawImage(img, 0, 0, S * 4, S * 4); gg.globalCompositeOperation = 'source-in'; gg.fillStyle = tint.getStyle(); gg.fillRect(0, 0, S * 4, S * 4);
  const col = document.createElement('canvas'); col.width = col.height = S * 4; const gc = col.getContext('2d'); gc.fillStyle = bg.getStyle(); gc.fillRect(0, 0, S * 4, S * 4); gc.drawImage(glyph, 0, 0);
  face.userData.faceSheet = true;
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.flipY = false; return t; };
  face.map = tex(col); face.color.setRGB(1, 1, 1); face.transparent = false;
  if (screen) { const emi = document.createElement('canvas'); emi.width = emi.height = S * 4; const ge = emi.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, S * 4, S * 4); ge.drawImage(glyph, 0, 0); face.emissiveMap = tex(emi); face.emissive.setRGB(1, 1, 1); face.emissiveIntensity = EMI * 0.8; }
}

async function loadBody(url, lodUrl, id = null) {
  const gltf = await glb.loadAsync(url);
  const root = gltf.scene;
  const info = id ? await fetch(`/assets/characters/agents/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  if (info) await applyFace(root, id, info).catch((err) => console.warn('[assets] wajah', id, err.message));
  const names = new Set(); root.traverse((o) => { if (o.isBone) names.add(o.name); });
  for (const name of Object.values(BONE)) if (!names.has(name)) throw new Error(`tulang "${name}" tidak ada di ${url}`);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  // the foot bone sits at the ankle: its rest height above the soles (model units)
  const boneY = (n) => { let y = 0; root.traverse((o) => { if (o.isBone && o.name === n) y = o.getWorldPosition(new THREE.Vector3()).y; }); return y; };
  const soleOffset = Math.min(boneY(BONE.footL), boneY(BONE.footR)) - box.min.y;
  const atlas = buildAtlas(materialsOf(root));
  const geo = mergeSkin(root, atlas);
  // hero materials: anything with its own normal map keeps its textures for near agents (LOD0); everything else, and every far LOD, uses the shared atlas
  const heroSet = new Set(materialsOf(root).filter((m) => m.normalMap && !m.userData?.faceSheet && String(m.name).split('|')[0] !== 'Face'));
  let geoBase = null, heroGeo = null, heroMats = null;
  if (heroSet.size) {
    const h = mergeSkin(root, null, (m) => heroSet.has(m), true);
    if (h) { heroGeo = h.geo; heroMats = h.mats; geoBase = mergeSkin(root, atlas, (m) => !heroSet.has(m)); }
  }
  let faceRect = null; for (const [k, t] of atlas.tiles) if (String(k).split('|')[0] === 'Face' && t.m.userData?.faceSheet) faceRect = new THREE.Vector4((t.x + 0.5) / atlas.AW, (t.y + 0.5) / atlas.AH, (t.w - 1) / atlas.AW, (t.h - 1) / atlas.AH);
  // distance LOD: the decimated twin has its own bone order, so its joint indices are remapped to the full skeleton
  let lodGeo = null;
  try {
    const lodRoot = (await glb.loadAsync(lodUrl)).scene;
    // the LOD twin's Face panel must be flagged like the hero's (applyFace only flags the hero), or the shader shows the whole 4x4 sheet instead of one cell
    if (info) materialsOf(lodRoot).forEach((m) => { if (String(m.name).split('|')[0] === 'Face') m.userData.faceSheet = true; });
    const joints = (r) => { let sk = null; r.traverse((o) => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; }); return sk.bones.map((x) => x.name); };
    const remap = joints(lodRoot).map((n) => joints(root).indexOf(n));
    if (remap.every((i) => i >= 0) && materialsOf(lodRoot).every((m) => atlas.tiles.has(m.name))) {
      lodGeo = mergeSkin(lodRoot, atlas);
      const si = lodGeo.attributes.skinIndex;
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, remap[si.getComponent(i, k)]);
    }
  } catch (err) { console.warn('[assets] LOD gagal, memakai model penuh:', err.message); }
  // the source images are in the atlas now
  for (const m of materialsOf(root)) { if (heroSet.has(m)) continue; m.map?.dispose(); m.emissiveMap?.dispose(); }
  // the character's own design: colours for the tinted parts, height relative to the 1.3 m reference, hip-to-thigh pad for sitting
  let design = null, seatPad, relHeight = 1;
  if (info) {
    const dc = info.designColors || {}, hex = (k, d) => '#' + (dc[k] ? lin(dc[k]) : new THREE.Color(d)).getHexString();
    design = { skin: hex('role_skin|Skin', 0xdddddd), hair: hex('role_hair|Hair', 0x333333), bottom: hex('role_bottom|Under', 0xcccccc), top: hex('role_top|Suit', 0xdddddd) };
    if (info.seat && info.seat.hipHeight > info.seat.thighLow) seatPad = info.seat.hipHeight - info.seat.thighLow;
    if (info.height > 0.5) relHeight = Math.min(1.25, Math.max(0.8, info.height / 1.3));
    // round bodies hang below the hip joint: sit them on the lowest point of the torso, not on the joint
    { let sk = null; root.traverse((o) => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; });
      const torso = new Set(['Hips', 'Abdomen', 'Torso'].map((n) => sk.bones.findIndex((b) => b.name === n)));
      const P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight; let low = Infinity;
      for (let i = 0; i < P.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (torso.has(SI.getComponent(i, k))) w += SW.getComponent(i, k); if (w > 0.6) low = Math.min(low, P.getY(i)); }
      const hy = boneY('Hips'); if (low < hy) seatPad = Math.max(seatPad || 0, (hy - low) * 0.94); }
    // measured in the sitting clip by the character pipeline: used as a floor: never sit lower than this
    if (info.seat && info.seat.bodyLow > 0 && info.seat.hipHeight > info.seat.bodyLow) seatPad = Math.max(seatPad || 0, info.seat.hipHeight - info.seat.bodyLow);
  }
  return { id, info, design, seatPad, relHeight, faceRect, root, height: Math.max(0.01, box.max.y - box.min.y), geo, geoBase, heroGeo, heroMats, lodGeo, atlas, anims: gltf.animations, soleOffset, mats: new Map() };
}

/** bump when the agent GLBs are redeployed, so browsers do not serve the old textures (e.g. the pale Terra) */
const AGENT_V = 'v4-2-1117c';
/** Loads the bodies once. Resolves even on failure, so the procedural people stay as fallback. */
export function loadAssets() {
  if (loaded) return loaded;
  loaded = (async () => {
    if (CHIBI.enabled) {
      try { const got = await Promise.allSettled(CHIBI.ids.map((id) => loadBody(`/assets/characters/agents/${id}.glb?v=${AGENT_V}`, `/assets/characters/agents/lod/${id}.glb?v=${AGENT_V}`, id))); got.forEach((r, i) => { if (r.status !== 'fulfilled') console.warn('[assets] karakter gagal dimuat:', CHIBI.ids[i], r.reason?.message); }); const ok = got.filter((r) => r.status === 'fulfilled').map((r) => r.value); if (!ok.length) throw new Error('tidak ada karakter yang termuat'); human = { chibi: ok }; }
      catch (err) { console.warn('[assets] karakter chibi gagal dimuat, memakai body biasa:', err.message); }
    }
    if (!human) {
      try {
        const load = (g, ids) => Promise.all(ids.map((id) => { const f = `quaternius_cc0-${g}-character-${id}.glb`; return loadBody(`/assets/characters/quaternius/${f}`, `/assets/characters/quaternius/lod/${f}`); }));
        const [male, female] = await Promise.all([load('male', BODIES.male), load('female', BODIES.female)]);
        human = { male, female };
      } catch (err) { console.warn('[assets] karakter gagal dimuat, memakai karakter prosedural:', err.message); }
    }
    return { human: !!human };
  })();
  return loaded;
}

const pools = () => (human ? Object.values(human).flat() : []);
export const assetsReady = () => ({ human: !!human, chibi: !!(human && human.chibi), lod: pools().every((b) => b.lodGeo), looks: pools().reduce((n, b) => n + b.mats.size, 0) });
export const humanReady = () => !!human;

// ───── appearance: explicit fields win; anything missing is derived from the id so each agent differs
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** Full appearance record for an agent (or the player). */
export function resolveAppearance(e, divisionHex = '#888888') {
  const a = e.appearance || {};
  const h = hashStr(e.id || e.name || 'x');
  const gender = a.gender || (h % 100 < 48 ? 'female' : 'male');
  const styles = PALETTE.hairStyle[gender];
  const r = (k, n) => (a[k] != null ? a[k] : (((h >>> ((k.length * 5) % 24)) ^ hashStr(k + e.id)) >>> 0) % n);
  return {
    gender,
    division: divisionHex,
    skin: a.skin ?? (h % 4 === 0 ? 5 : (((h >>> 3) ^ hashStr('skin' + e.id)) >>> 0) % 5),
    hair: r('hair', PALETTE.hair.length),
    hairStyle: a.hairStyle || styles[((h >>> 7) ^ hashStr('hs' + e.id)) % styles.length],
    dress: a.dress || (['casual', 'casual', 'smart', 'formal'][((h >>> 11) ^ hashStr('dress' + e.id)) % 4 >>> 0]),
    shirt: a.shirt || (CASUAL_SHIRTS[(((h >>> 5) ^ hashStr('shirt' + e.id)) >>> 0) % CASUAL_SHIRTS.length]),
    pants: a.pants || PALETTE.pants[r('pants', PALETTE.pants.length)],
    tie: a.tie || null,
    glasses: a.glasses != null ? !!a.glasses : (h % 7) === 0,
    beard: gender === 'male' ? (a.beard != null ? !!a.beard : (h % 5) < 2) : false,
    earring: gender === 'female' ? (a.earring != null ? !!a.earring : (h % 3) !== 0) : false,
    build: a.build ?? (0.92 + ((h >>> 9) % 17) / 100),
    height: a.height ?? (0.95 + ((h >>> 13) % 11) / 100),
  };
}

/**
 * The material for one look of a body. All looks share one shader program and the body's atlas textures;
 * only the five role colours (a uniform) differ, and identical looks share the material.
 */
function bodyMaterial(body, hex) {
  const key = `${hex.skin}|${hex.hair}|${hex.bottom}|${hex.top}|${hex.cloth || ''}`;
  if (!body.mats.has(key)) {
    const roleColors = [new THREE.Color(0xffffff), new THREE.Color(hex.skin), new THREE.Color(hex.hair), new THREE.Color(hex.bottom), new THREE.Color(hex.top), new THREE.Color(0xffffff), new THREE.Color(hex.cloth || 0xffffff), new THREE.Color(0xffffff)];
    const m = new THREE.MeshStandardMaterial({ map: body.atlas.color, emissive: 0xffffff, emissiveMap: body.atlas.emissive, emissiveIntensity: EMI, roughnessMap: body.atlas.orm, metalnessMap: body.atlas.orm, roughness: 1, metalness: 1, vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.roleColors = { value: roleColors };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float roleId;\nuniform vec3 roleColors[8];')
        .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb *= roleColors[int(roleId + 0.5)];');
    };
    m.customProgramCacheKey = () => 'agent-roles';
    body.mats.set(key, m);
  }
  return body.mats.get(key);
}

/** a copy of the body material whose face cell can change per agent without touching the shared atlas */
function faceVariant(base, rect) {
  const m = base.clone(), cell = { value: new THREE.Vector2(2, 0) }, orig = base.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    orig(sh, r); sh.uniforms.faceCell = cell; sh.uniforms.faceRect = { value: rect };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', ['#include <common>', 'uniform vec2 faceCell; uniform vec4 faceRect;'].join('\n'))
      .replace('#include <uv_vertex>', ['vec2 uvX = uv; if (abs(roleId - 5.0) < 0.5) uvX = faceRect.xy + ((uv - faceRect.xy) + faceCell * faceRect.zw) * 0.25;', '#define uv uvX', '#include <uv_vertex>', '#undef uv'].join('\n'));
  };
  m.customProgramCacheKey = () => 'agent-roles-face';
  m.userData.cell = cell; return m;
}

/**
 * Posable joint proxy: animation writes `.rotation` (Euler); apply() sets the bone quaternion on top of its rest pose.
 * worldAxes = true (head and neck): the angles turn around the body's own up/left/forward axes, so looking
 * left/right keeps the head level whatever the bone's internal orientation is.
 */
function joint(bone, worldAxes = false) {
  const p = { bone, rest: bone.quaternion.clone(), rotation: new THREE.Euler(), q: new THREE.Quaternion(), e: new THREE.Euler(), worldAxes, wbind: null };
  if (worldAxes) { const parentQ = new THREE.Quaternion(); if (bone.parent) bone.parent.getWorldQuaternion(parentQ); p.wbind = parentQ.multiply(p.rest); }
  return p;
}
function applyJoints(list) {
  for (const p of list) {
    p.e.set(p.rotation.x, p.rotation.y, p.rotation.z);
    p.q.setFromEuler(p.e);
    if (p.worldAxes) {
      // world rotation R, expressed in the bone's local frame: D = inv(Wbind) * R * Wbind
      const D = p.wbind.clone().invert().multiply(p.q).multiply(p.wbind);
      p.bone.quaternion.copy(p.rest).multiply(D);
    } else p.bone.quaternion.copy(p.rest).multiply(p.q);
  }
}

/** hero (LOD0) materials that carry their own textures (Kiko's jacket): one clone per look so each agent can have its own jacket colour */
function heroMatsFor(tpl, look) {
  if (!look || !tpl.heroMats) return tpl.heroMats;
  const cache = tpl.heroLooks || (tpl.heroLooks = new Map());
  if (!cache.has(look.cloth)) cache.set(look.cloth, tpl.heroMats.map((m) => { const c = m.clone(); if (/LOCKED_V4_cloth/.test(m.name)) c.color.set(look.cloth); return c; }));
  return cache.get(look.cloth);
}

/** Builds one posable agent with its own look. Returns the shape the office animator expects. */
export function buildFbxRig(e, divisionHex) {
  const ap = resolveAppearance(e, divisionHex);
  const chibi = !!human.chibi;
  const pool = chibi ? human.chibi : (human[ap.gender] || human.male);
  const tpl = pool[hashStr(e.id || e.name || 'x') % pool.length];
  // chibi agents wear their division colour on the suit; the human bodies use the shirt colour
  // V4.2 mascots: every agent gets its own deterministic colour set (colourway x edition x small variation); other bodies keep their template colours
  const look = chibi && tpl.id ? pickMascotLook(e.id || e.name || 'x', String(tpl.id).split('_')[0]) : null;
  const baseMat = bodyMaterial(tpl, look ? { skin: look.skin, hair: look.hair, bottom: look.bottom, top: look.top, cloth: look.cloth } : (tpl.design || { skin: PALETTE.skin[ap.skin] || ap.skin, hair: PALETTE.hair[ap.hair] || ap.hair, bottom: ap.pants, top: chibi ? ap.division : ap.shirt }));
  const mat = tpl.faceRect ? faceVariant(baseMat, tpl.faceRect) : baseMat;
  const clone = cloneRig(tpl.root);
  // the cloned parts are only needed for their skeleton: one merged mesh replaces them
  const parts = []; let skeleton = null;
  clone.traverse((o) => { if (o.isSkinnedMesh) { parts.push(o); skeleton = skeleton || o.skeleton; } });
  for (const o of parts) o.parent.remove(o);
  const body_ = new THREE.SkinnedMesh(tpl.heroGeo && tpl.geoBase ? tpl.geoBase : tpl.geo, mat);
  body_.bind(skeleton, new THREE.Matrix4());
  body_.castShadow = true; body_.receiveShadow = false; body_.frustumCulled = false;
  clone.add(body_);
  let hero_ = null;
  if (tpl.heroGeo && tpl.geoBase) { hero_ = new THREE.SkinnedMesh(tpl.heroGeo, heroMatsFor(tpl, look)); hero_.bind(skeleton, new THREE.Matrix4()); hero_.castShadow = true; hero_.receiveShadow = false; hero_.frustumCulled = false; clone.add(hero_); }
  const topH = (chibi ? CHIBI.height * (tpl.relHeight || 1) : HUMAN_HEIGHT) * ap.height;
  const scale = topH / tpl.height;
  const g = new THREE.Group(); g.add(clone);
  clone.scale.set(scale * (chibi ? 1 : ap.build), scale, scale * (chibi ? 1 : ap.build));   // V4 mascots keep their designed proportions: no random width (it made some look flattened)
  const soleLift = tpl.soleOffset * scale; // ankle height above the sole
  const bones = {}; clone.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const body = new THREE.Group(); body.add(g);
  const torso = { scale: new THREE.Vector3(1, 1, 1), userData: {} }; // breathing hook (the rig has no separate torso mesh)
  g.updateMatrixWorld(true);
  // limb proxies only receive the office animator's values; the limbs follow the body clips and IK
  const armL = { s: joint(bones[BONE.armL]), el: joint(bones[BONE.foreL]), wr: joint(bones[BONE.handL]) };
  const armR = { s: joint(bones[BONE.armR]), el: joint(bones[BONE.foreR]), wr: joint(bones[BONE.handR]) };
  const legL = { hp: joint(bones[BONE.thighL]), kn: joint(bones[BONE.shinL]), an: joint(bones[BONE.footL]) };
  const legR = { hp: joint(bones[BONE.thighR]), kn: joint(bones[BONE.shinR]), an: joint(bones[BONE.footR]) };
  const neck = joint(bones[BONE.neck], true); const head = joint(bones[BONE.head], true);

  // the body's own clips drive the figure (idle, walk, run, sit, wave, …); seat and hand IK go on top
  const mixer = new THREE.AnimationMixer(clone);
  const acts = {};
  for (const c of tpl.anims) acts[c.name.split('_').pop()] = mixer.clipAction(c);
  let curName = null, lastT = performance.now(), tick = 0;
  const breathSeed = (hashStr(e.id || e.name || 'x') % 628) / 100;
  const stateOf = (a) => {
    const now = performance.now(), gest = a.gest && now < a.gest.until ? a.gest.type : null;
    if (a.path.length > 0 || a.moving) return a.running ? 'Run' : 'Walk';
    // an agent at its desk (or pose sit) uses a seated clip: typing while it works, reading on request, otherwise the plain seated clip
    if (a.pose === 'sit' || (a.mode === 'desk' && !!a.desk)) {
      if (acts.Type && a.e.status === 'working' && a.mode === 'desk' && !gest) return 'Type';
      if (acts.Read && gest === 'read') return 'Read';
      // seated but not working: now and then a short read
      if (acts.Read && a.e.status !== 'working') {
        if (a.fidget && now < a.fidget.until) return 'Read';
        if (!a.fidgetAt) a.fidgetAt = now + 5000 + Math.random() * 9000;
        if (now > a.fidgetAt) { a.fidget = { clip: 'Read', until: now + 3500 + Math.random() * 3000 }; a.fidgetAt = now + 12000 + Math.random() * 18000; return 'Read'; }
      }
      return 'Sitting';
    }
    if (now < a.waveUntil && acts.Wave) return 'Wave';
    if (gest && GEST_CLIP[gest] && acts[GEST_CLIP[gest]]) return GEST_CLIP[gest];
    if (a.holding && acts.HoldR) return 'HoldR';
    if (now < a.talkUntil && acts.Talk) return 'Talk';
    // a quiet agent never freezes: every so often a short fidget (nod, shrug, think, sip, phone) plays, then it returns to idle
    if (acts.Idle) {
      if (a.fidget && now < a.fidget.until) return a.fidget.clip;
      if (!a.fidgetAt) a.fidgetAt = now + 3500 + Math.random() * 7000;
      if (now > a.fidgetAt) {
        const pool = ['Nod', 'Shrug', 'Think', 'Drink', 'Phone', 'Nod', 'Think'].filter((c) => acts[c]);
        if (pool.length) { const c = pool[(Math.random() * pool.length) | 0]; a.fidget = { clip: c, until: now + Math.max(1400, (acts[c].getClip().duration || 2) * 1000) }; }
        a.fidgetAt = now + 6000 + Math.random() * 11000;
        if (a.fidget && now < a.fidget.until) return a.fidget.clip;
      }
      return 'Idle';
    }
    return 'Standing';
  };
  const V = () => new THREE.Vector3();
  const v0 = new THREE.Vector3();
  // keep the soles on the floor whatever the clip does: measure the feet and lift or drop the body
  const ground = () => {
    clone.position.y = 0; g.updateMatrixWorld(true);
    const ref = g.getWorldPosition(v0).y;
    const feet = Math.min(bones[BONE.footL].getWorldPosition(v0).y, bones[BONE.footR].getWorldPosition(v0).y) - ref;
    clone.position.y = -feet + soleLift;
    clone.updateMatrixWorld(true);
  };
  ground();
  // seated height is set, never accumulated: the whole body moves so the hip joint rests a thigh-thickness above the seat surface
  const seat = (a) => {
    g.updateMatrixWorld(true);
    const ref = g.getWorldPosition(v0).y;
    const target = ((a && a.spot && a.spot.seatY) || SEAT_TOP) + (chibi ? (tpl.seatPad ?? CHIBI_SEAT_PAD) * scale : HUMAN_SEAT_PAD);
    clone.position.y += target - (bones.Hips.getWorldPosition(v0).y - ref);
    clone.updateMatrixWorld(true);
  };
  // turn a bone so its child lies along a world direction
  const aim = (bone, child, dir) => {
    bone.updateMatrixWorld(true); child.updateMatrixWorld(true);
    const cur = child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const qW = bone.getWorldQuaternion(new THREE.Quaternion());
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(q).multiply(qW));
    bone.updateMatrixWorld(true);
  };
  // two-bone IK: root → mid → tip reaches the world point F, the mid joint bends towards `pole`
  const twoBone = (root, mid, tip, F, pole) => {
    root.updateMatrixWorld(true);
    const H = root.getWorldPosition(V());
    const K0 = mid.getWorldPosition(V()), L1 = H.distanceTo(K0), L2 = K0.distanceTo(tip.getWorldPosition(V()));
    const d = Math.max(0.02, Math.min(H.distanceTo(F), (L1 + L2) * 0.999));
    const dirHF = F.clone().sub(H).normalize();
    const a2 = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a2 * a2));
    const pl = pole.clone().sub(dirHF.clone().multiplyScalar(pole.dot(dirHF))).normalize();
    const K = H.clone().addScaledVector(dirHF, a2).addScaledVector(pl, h);
    aim(root, mid, K.clone().sub(H));
    aim(mid, tip, F.clone().sub(K));
  };
  // seated legs: each ankle at its height above the floor, ahead of the hip, knee bent forward over the seat
  const seatLegs = () => {
    const fwd = g.getWorldDirection(V()); fwd.y = 0; fwd.normalize();
    const floor = g.getWorldPosition(V()).y + soleLift;
    for (const [th, sh, ft] of [[bones[BONE.thighL], bones[BONE.shinL], bones[BONE.footL]], [bones[BONE.thighR], bones[BONE.shinR], bones[BONE.footR]]]) {
      th.updateMatrixWorld(true);
      const F = th.getWorldPosition(V()).addScaledVector(fwd, chibi ? 0.11 * scale : 0.44); F.y = floor;
      twoBone(th, sh, ft, F, fwd);
    }
  };
  // arm IK: each hand reaches a target in the agent's own frame (relative to the hips); elbows bend back and out.
  // A target out of reach simply straightens the arm towards it.
  const sideL = g.worldToLocal(bones[BONE.armL].getWorldPosition(V())).x >= 0 ? 1 : -1;
  const PT = chibi ? CHIBI_POSE : HUMAN_POSE, pk = chibi ? scale : 1;
  const armIK = (a, sitting, typing, gait) => {
    const now = performance.now();
    const hipsL = g.worldToLocal(bones.Hips.getWorldPosition(V()));
    const fwd = g.getWorldDirection(V()); fwd.y = 0; fwd.normalize();
    const pose = sitting ? { L: PT.sit, R: PT.sit } : { L: PT.rest, R: PT.rest };
    // typing: both hands on the keyboard, tapping up and down a little out of phase
    if (typing) { const w = Math.sin(now * 0.02) * 0.008, w2 = Math.cos(now * 0.017) * 0.008; pose.L = [PT.type[0], PT.type[1] + w, PT.type[2]]; pose.R = [PT.type[0], PT.type[1] + w2, PT.type[2]]; }
    // walking or running: hands swing forward and back beside the body, opposite to each other
    if (gait) { const sw = Math.sin(now * (gait > 1 ? 0.016 : 0.011)) * (gait > 1 ? 0.1 : 0.06); pose.L = [PT.rest[0], PT.rest[1] + Math.abs(sw) * 0.3, PT.rest[2] + sw]; pose.R = [PT.rest[0], PT.rest[1] + Math.abs(sw) * 0.3, PT.rest[2] - sw]; }
    // carrying something: the right hand holds it in front of the chest
    if (a && a.holding && !typing) pose.R = PT.hold;
    const gest = a && a.gest && now < a.gest.until ? a.gest.type : null;
    if (a && now < a.waveUntil) pose.R = PT.wave;
    else if (a && now < a.talkUntil) pose.R = PT.talk;
    else if (gest === 'shrug') { pose.L = PT.shrug; pose.R = PT.shrug; }
    else if (gest === 'present') pose.R = PT.present;
    else if (gest === 'think') pose.R = PT.think;
    else if (gest === 'cheer') { pose.L = PT.cheer; pose.R = PT.cheer; }
    const origin = g.localToWorld(new THREE.Vector3(0, hipsL.y, hipsL.z));
    for (const side of ['L', 'R']) {
      const sgn = side === 'L' ? sideL : -sideL;
      const [ox, dy, dz] = pose[side].map((v) => v * pk);
      const T = g.localToWorld(new THREE.Vector3(sgn * ox, hipsL.y + dy, hipsL.z + dz));
      const out = g.localToWorld(new THREE.Vector3(sgn, hipsL.y, hipsL.z)).sub(origin).normalize();
      const arm = side === 'L' ? armL : armR;
      twoBone(arm.s.bone, arm.el.bone, arm.wr.bone, T, fwd.clone().multiplyScalar(-1).addScaledVector(out, 0.6));
    }
  };
  // spine bones at their rest pose: when seated the torso is held upright against the chair back
  const spineRest = ['Abdomen', 'Torso'].filter((n) => bones[n]).map((n) => [bones[n], bones[n].quaternion.clone()]);

  let prop = null; const propV = new THREE.Vector3();
  const rig = {
    skin: body_,
    /** something to carry in the right hand (a small mesh); it follows the hand and stays upright */
    setProp(mesh) { if (prop) g.remove(prop); prop = mesh; if (mesh) { mesh.visible = false; g.add(mesh); } },
    /** slide the body back with its chair: horizontal only, the height is set by ground() / seat() */
    setSeatShift(k, dir) { if (dir) { clone.position.x = dir.x * k; clone.position.z = dir.z * k; } },
    /** distance level of detail (set from the office loop): only near agents cast shadows, far ones use the light mesh */
    /** choose the expression cell (0..15) of the 4x4 face sheet */
    setFace(i) { if (mat.userData.cell) mat.userData.cell.value.set(i % 4, Math.floor(i / 4)); },
    setLod(lod) {
      body_.castShadow = lod === 0;
      if (hero_) { hero_.visible = lod === 0; hero_.castShadow = lod === 0; body_.geometry = lod === 0 ? tpl.geoBase : (lod >= 1 && tpl.lodGeo ? tpl.lodGeo : tpl.geo); }
      else body_.geometry = lod >= 1 && tpl.lodGeo ? tpl.lodGeo : tpl.geo;
    },
    /** one animation step; far agents keep their last pose between updates */
    apply(a) {
      const lod = a ? a.lod || 0 : 0;
      tick++;
      if ((lod === 1 && tick % 2) || (lod === 2 && tick % 4)) return;
      const now = performance.now(); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      const want = a ? stateOf(a) : 'Idle';
      const name = acts[want] ? want : (acts.Standing ? 'Standing' : 'Idle');
      if (name !== curName) { if (curName) acts[curName].fadeOut(0.3); acts[name].reset().fadeIn(0.3).play(); curName = name; }
      // gait: agents move at fixed speeds (2.8 walk / 5.2 run); the clip's natural pace is stride/0.54 s, so speed the cycle up to avoid feet sliding
      { const act = acts[name]; if (name === 'Walk' || name === 'Run') { const nat = (((tpl.info && tpl.info.walkStride) || 0.5) * scale / 0.54) * (name === 'Run' ? 1.92 : 1), v = name === 'Run' ? GAIT.run : GAIT.walk; act.timeScale = Math.min(2.2, Math.max(0.5, v / nat)); } else act.timeScale = 1; }
      mixer.update(dt);
      // breathing: the chest swells a little, out of phase between agents
      { const br = 1 + 0.011 * Math.sin(now / 640 + breathSeed); if (bones.Torso) { bones.Torso.scale.set(2 - br, br, 2 - br); } }
      const sitting = SIT_CLIPS.has(name);
      if (sitting) for (const [b, q] of spineRest) b.quaternion.copy(q);
      applyJoints([neck, head]);
      if (sitting) {
        seat(a); seatLegs();
        // the cape falls behind the chair back instead of through the seat
        if (bones.Cape1 && bones.Cape2) { const back = g.getWorldDirection(V()).multiplyScalar(-0.55); back.y = -1; aim(bones.Cape1, bones.Cape2, back); }
      } else ground();
      // gesture clips move the arms themselves; everywhere else IK places the hands (rest, swing, lap, keyboard, talk)
      const typing = sitting && a && a.e.status === 'working' && a.mode === 'desk' && !a.gest;
      const gestNow = a && a.gest && now < a.gest.until ? a.gest.type : null;
      // the clip moves both arms (swing, talk, hold, shrug, read...). Typing keeps the keyboard IK (the clip's hands float ~10 cm above the desk); armIK is also the fallback for bodies without clips
      const clipDriven = !!acts[name] && name !== 'Type';
      if (!clipDriven) armIK(a, sitting, typing, name === 'Run' ? 2 : name === 'Walk' ? 1 : 0);
      if (prop && prop.visible) { armR.wr.bone.getWorldPosition(propV); g.worldToLocal(propV); prop.position.set(propV.x, propV.y + 0.005, propV.z + 0.045); }
    },
  };
  const T = { fem: ap.gender === 'female', height: ap.height, hair: PALETTE.hair[ap.hair], skin: PALETTE.skin[ap.skin], hairStyle: ap.hairStyle, toneShift: 0 };
  g.userData.dynamic = true;
  return { g, body, torso, neck, head, face: null, visor: null, armL, armR, legL, legR, T, sitDrop: 0, top: topH, rig, look: ap };
}
