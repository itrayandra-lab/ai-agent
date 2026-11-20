// Editor Karakter saya (robot Mascot V4.2): 4 bentuk, migrasi data lama, pratinjau ringan dan dilepas, tanpa opsi manusia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENTUK, WAJAH, bersihRobot, robotLook, robotTplId, acakRobot, migrasiPenampilan, robotBawaan, daftarWarna, daftarAksen, TINGGI } from '../public/js/mascot-robot.js';
import { pickMascotLook } from '../public/js/mascot-palettes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('4 bentuk x 3 wajah = 12 id aset yang ADA (sama dengan CHIBI.ids dan berkas GLB)', () => {
  const ids = BENTUK.flatMap(([f]) => WAJAH.map(([v]) => robotTplId({ family: f, variant: v })));
  assert.equal(BENTUK.length, 4); assert.equal(new Set(ids).size, 12);
  const chibi = read('public/js/assets3d.js').match(/CHIBI = \{[^}]*ids: \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map((x) => x.replace(/'/g, ''));
  assert.deepEqual([...ids].sort(), [...chibi].sort());
  for (const id of ids) assert.ok(fs.existsSync(path.join(ROOT, 'public/assets/characters/agents', id + '.glb')), `${id}.glb ada`);
});

test('bersihRobot: masukan rusak atau asing selalu jatuh ke pilihan sah', () => {
  assert.deepEqual(bersihRobot(null), { family: 'kiko', variant: '', colorway: 0, edition: 0 });
  assert.deepEqual(bersihRobot({ family: 'manusia', variant: '_x', colorway: 99, edition: -3 }), { family: 'kiko', variant: '', colorway: 0, edition: 0 });
  assert.deepEqual(bersihRobot({ family: 'azure', variant: '_coral', colorway: 4, edition: 5 }), { family: 'azure', variant: '_coral', colorway: 4, edition: 5 });
  for (let i = 0; i < 50; i++) { const r = acakRobot(); assert.deepEqual(r, bersihRobot(r)); }
});

test('warna: lima peran terisi; daftar warna dan aksen sesuai palet yang ada', () => {
  for (const [f] of BENTUK) {
    assert.equal(daftarWarna(f).length, 10); assert.equal(daftarAksen(f, 0).length, 6);
    for (let c = 0; c < 10; c++) for (const ed of [0, 3, 5]) { const l = robotLook({ family: f, colorway: c, edition: ed }); for (const k of ['top', 'skin', 'hair', 'bottom', 'cloth']) assert.match(l[k], /^#[0-9a-f]{6}$/i, `${f} ${c} ${k}`); }
  }
});

test('robotBawaan = tampilan yang sekarang (pickMascotLook): pemain lama tidak berubah rupa diam-diam', () => {
  for (const id of ['owner', 'aria', 'sora', 'maya']) for (const fam of ['kiko', 'azure', 'charcoal', 'branch']) {
    const b = robotBawaan(id, fam + '_ocean'), a = robotLook(b), p = pickMascotLook(id, fam);
    assert.equal(a.name, p.name); assert.equal(a.edition, p.edition);
  }
});

test('migrasi: data lama manusia dibuang, tinggi dijepit, bentuk bawaan dipakai bila belum memilih', () => {
  const lama = { gender: 'male', hairStyle: 'short', skin: 2, hair: 1, shirt: '#fff', pants: '#000', glasses: true, beard: true, build: 1.1, height: 1.5 };
  const bawaan = { family: 'branch', variant: '_ocean', colorway: 2, edition: 1 };
  const m = migrasiPenampilan(lama, bawaan);
  assert.deepEqual(Object.keys(m).sort(), ['height', 'robot']); assert.deepEqual(m.robot, bawaan); assert.equal(m.height, TINGGI.max);
  assert.equal(migrasiPenampilan(undefined, bawaan).height, 1);
  assert.deepEqual(migrasiPenampilan({ robot: { family: 'charcoal', variant: '', colorway: 3, edition: 0 }, height: 0.5 }, bawaan), { robot: { family: 'charcoal', variant: '', colorway: 3, edition: 0 }, height: TINGGI.min });
});

test('editor: tanpa opsi manusia, pratinjau malas satu canvas dan dilepas, simpan hanya robot + tinggi, Batal tidak menyimpan', () => {
  const k = read('public/js/karakter-view.js'); const v = read('public/js/views.js');
  for (const kata of ['Jenis kelamin', 'Gaya rambut', 'Warna kulit', 'Kacamata', 'Jenggot', 'Postur']) assert.ok(!k.includes(kata), `opsi manusia dibuang: ${kata}`);
  assert.match(k, /await import\('three'\)/, 'three dimuat malas'); assert.match(k, /dispose\(\)/); assert.match(k, /forceContextLoss/);
  assert.equal((k.match(/new THREE\.WebGLRenderer/g) || []).length, 1, 'satu renderer kecil');
  assert.match(k, /appearance: \{ robot: cur\.robot, height: cur\.height \}/, 'simpan hanya robot + tinggi');
  assert.match(k, /\{ label: 'Batal' \}/); assert.match(v, /characterPicker\(\) \{[^}]*bukaEditorKarakter\(\)/);   // boleh dimuat malas (perf) maupun langsung
  assert.doesNotMatch(v, /bindAppearance\(box, ap0/, 'editor lama tidak dipakai lagi di Karakter saya');
});

test('assets3d: pilihan robot dipakai di buildFbxRig tanpa mengubah proporsi, gerak, atau kamera', () => {
  const a = read('public/js/assets3d.js');
  assert.match(a, /robot: a\.robot \? bersihRobot\(a\.robot\) : null/); assert.match(a, /pool\.find\(\(t\) => t\.id === robotTplId\(ap\.robot\)\)/); assert.match(a, /robotLook\(ap\.robot\)/);
  assert.match(a, /scale \* \(chibi \? 1 : ap\.build\)/, 'proporsi chibi tidak berubah');
});
