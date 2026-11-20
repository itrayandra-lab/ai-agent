// Pilihan karakter Robot Mascot V4.2 untuk pemain: murni data (tanpa THREE), jadi bisa diuji di Node.
// Hanya memakai yang SUDAH ADA di aset: 4 bentuk (kiko, azure, charcoal, branch), 3 wajah per bentuk (standar, samudra, karang),
// 10 warna badan per bentuk (MASCOT_PALETTES) dan 5 warna aksen edisi (EDITION_ACCENTS). Tidak ada aset baru.
import { MASCOT_PALETTES, EDITION_ACCENTS } from './mascot-palettes.js';

export const BENTUK = [['kiko', 'Kiko'], ['azure', 'Azure'], ['charcoal', 'Charcoal'], ['branch', 'Branch']];
export const WAJAH = [['', 'Standar'], ['_ocean', 'Samudra'], ['_coral', 'Karang']];
export const TINGGI = { min: 0.92, max: 1.08 };
const FAM = BENTUK.map((x) => x[0]), VAR = WAJAH.map((x) => x[0]);
const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

/** id aset badan yang dipakai (sama dengan CHIBI.ids di assets3d.js) */
export const robotTplId = (r) => `${bersihRobot(r).family}${bersihRobot(r).variant}`;

/** menjaga pilihan tetap sah apa pun masukannya (data lama, rusak, atau dari luar) */
export function bersihRobot(r) {
  const o = r && typeof r === 'object' ? r : {};
  return { family: FAM.includes(o.family) ? o.family : 'kiko', variant: VAR.includes(o.variant) ? o.variant : '', colorway: int(o.colorway, 0, 9, 0), edition: int(o.edition, 0, 5, 0) };
}

/** lima peran warna yang dipakai bahan badan: sama bentuknya dengan pickMascotLook, tanpa variasi acak */
export function robotLook(r) {
  const R = bersihRobot(r), p = MASCOT_PALETTES[R.family][R.colorway];
  const accent = R.edition === 0 ? p.accent : EDITION_ACCENTS[R.edition - 1];
  const bezel = R.family === 'charcoal' && R.edition ? accent : p.bezel;
  return { top: p.shell, skin: p.body, hair: bezel, bottom: accent, cloth: p.cloth, name: p.name, edition: R.edition };
}

export const daftarWarna = (family) => (MASCOT_PALETTES[family] || MASCOT_PALETTES.kiko).map((p, i) => ({ i, name: p.name, shell: p.shell, accent: p.accent }));
export const daftarAksen = (family, colorway) => [{ i: 0, hex: (MASCOT_PALETTES[family] || MASCOT_PALETTES.kiko)[colorway]?.accent || '#888888' }, ...EDITION_ACCENTS.map((hex, k) => ({ i: k + 1, hex }))];

export function acakRobot(rnd = Math.random) {
  const pick = (n) => Math.floor(rnd() * n);
  return bersihRobot({ family: FAM[pick(4)], variant: VAR[pick(3)], colorway: pick(10), edition: pick(6) });
}

/**
 * Migrasi data penampilan lama: editor manusia (gender, rambut, kulit, kacamata, jenggot, postur ...) tidak berlaku lagi untuk robot.
 * Yang dibawa hanya pilihan robot dan tinggi (terjepit ke batas aman). Pemain lama tanpa pilihan robot jatuh ke bentuk bawaan (`bawaan`).
 */
export function migrasiPenampilan(ap, bawaan) {
  const a = ap && typeof ap === 'object' ? ap : {};
  const h = Number(a.height);
  return { robot: bersihRobot(a.robot || bawaan), height: Number.isFinite(h) ? Math.min(TINGGI.max, Math.max(TINGGI.min, h)) : 1 };
}

const fnv = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
/** pilihan bawaan seseorang = yang sekarang tampil di kantor (sama dengan pickMascotLook: warna dari id, bentuk dari tplId) */
export function robotBawaan(id, tplId) {
  const fam = String(tplId || 'kiko').split('_')[0], h = fnv(id);
  return bersihRobot({ family: fam, variant: String(tplId || '').slice(fam.length), colorway: h % 10, edition: (h >>> 5) % 5 });
}
