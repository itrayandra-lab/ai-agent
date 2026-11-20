// KESEHATAN OTAK: angka dari catatan jalan staf yang NYATA (bukan uji): tingkat sukses per kemampuan dan divisi, galat terbanyak,
// waktu dan biaya rata-rata, pekerjaan macet. Ditambah hasil uji nyata terakhir dan tombol "Uji ulang" (menjalankan scripts/uji-nyata.mjs
// di SALINAN data, dengan batas biaya). Dipakai konsol admin (server/admin/admin.js, rute /api/admin/kesehatan*). Dokumen: docs/UJI-NYATA.md.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as store from '../penyimpanan/store.js';
import { runsOf } from './data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = () => process.env.DATA_DIR || path.join(ROOT, 'data');
const ujiDir = () => path.join(dataDir(), 'uji-nyata');
export const MAKS_BATAS_USD = 0.3;
const MACET_MENIT = 10;

const nama = (r) => String(r.staf || '').replace(/^kap-/, '');
const rata = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const baca = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Ringkasan sekumpulan jalan: jumlah, sukses (selesai dan berbukti), gagal, menunggu izin, rata waktu dan biaya. */
function ringkasJalan(list) {
  const done = list.filter((r) => ['selesai', 'gagal'].includes(r.status));
  const ok = done.filter((r) => r.status === 'selesai' && (r.bukti || []).length > 0);
  return {
    total: list.length, selesai: done.length, sukses: ok.length, gagal: done.length - ok.length, tingkat: done.length ? Math.round((ok.length / done.length) * 100) : null,
    msRata: Math.round(rata(done.map((r) => r.ms || 0))), biayaRata: Math.round(rata(done.map((r) => r.biaya || 0)) * 1e6) / 1e6, biayaTotal: Math.round(done.reduce((a, r) => a + (r.biaya || 0), 0) * 1e6) / 1e6,
    pakaiAI: done.length ? Math.round((done.filter((r) => r.pakaiAI === true).length / done.length) * 100) : null,
  };
}

/** Pengelompokan galat menjadi kalimat pendek yang bisa dibaca (angka dan nama dibuang agar galat serupa menyatu). */
const galatKunci = (g) => String(g || 'tanpa alasan').replace(/"[^"]*"/g, '"…"').replace(/run-[0-9a-f]+/g, 'run-…').replace(/\d+/g, 'N').slice(0, 110);

export function status() {
  const d = store.get(), ws = store.current(), sejak = Date.now() - 7 * 86400e3;
  const runs = runsOf(ws).filter((r) => r.startedAt >= sejak);
  const divDari = (r) => d.employees.find((e) => e.id === r.employeeId)?.divisionId || '-';
  const namaDiv = (id) => d.divisions.find((x) => x.id === id)?.name || id;
  const group = (keyFn) => { const m = new Map(); for (const r of runs) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const perKemampuan = [...group(nama)].map(([k, l]) => ({ kemampuan: k, ...ringkasJalan(l) })).sort((a, b) => b.total - a.total).slice(0, 60);
  const perDivisi = [...group(divDari)].map(([k, l]) => ({ divisi: k, nama: namaDiv(k), ...ringkasJalan(l) })).sort((a, b) => b.total - a.total);
  const galat = new Map();
  for (const r of runs.filter((x) => x.status === 'gagal')) { const k = galatKunci(r.galat); const g = galat.get(k) || { galat: k, jumlah: 0, contoh: r.galat, kemampuan: new Set() }; g.jumlah++; g.kemampuan.add(nama(r)); galat.set(k, g); }
  const galatTop = [...galat.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, 8).map((g) => ({ galat: g.galat, jumlah: g.jumlah, contoh: String(g.contoh || '').slice(0, 200), kemampuan: [...g.kemampuan].slice(0, 4) }));
  const batas = Date.now() - MACET_MENIT * 60e3;
  const macetStaf = runs.filter((r) => ['jalan', 'menunggu'].includes(r.status) && (r.startedAt || 0) < batas).map((r) => ({ jenis: 'staf', id: r.id, nama: nama(r), status: r.status, menit: Math.round((Date.now() - r.startedAt) / 60e3) }));
  const macetTugas = d.tasks.filter((t) => ['in_progress', 'waiting'].includes(t.status) && (t.updatedAt || t.createdAt || 0) < batas).slice(0, 20).map((t) => ({ jenis: 'tugas', id: t.id, nama: String(t.title || '').slice(0, 70), status: t.status, menit: Math.round((Date.now() - (t.updatedAt || t.createdAt)) / 60e3) }));
  const terakhir = baca(path.join(ujiDir(), 'hasil.json'));
  return {
    periode: '7 hari terakhir', ringkasan: ringkasJalan(runs), perKemampuan, perDivisi, galatTerbanyak: galatTop, macet: [...macetStaf, ...macetTugas], macetMenit: MACET_MENIT,
    ujiTerakhir: terakhir ? { selesai: terakhir.selesai, biaya: terakhir.biayaTotal, panggilan: terakhir.panggilanTotal, ringkasan: terakhir.ringkasan, perDivisi: terakhir.perDivisi, berhenti: terakhir.berhenti || null, model: terakhir.model } : null,
    uji: ujiStatus(),
  };
}

// ── tombol "Uji ulang": satu pekerjaan latar belakang pada satu waktu, di SALINAN data (tidak menyentuh data asli), dengan batas biaya
let job = null;
const ujiStatus = () => (job ? { jalan: job.jalan, mulai: job.mulai, cakupan: job.cakupan, batasUSD: job.batasUSD, kode: job.kode ?? null, pesan: job.pesan || '' } : { jalan: false });
export function ujiUlang({ cakupan = 'kemampuan', batasUSD = 0.05 } = {}) {
  if (job?.jalan) { const e = new Error('Uji ulang masih berjalan. Tunggu sampai selesai.'); e.code = 409; throw e; }
  const batas = Math.min(MAKS_BATAS_USD, Math.max(0.005, Number(batasUSD) || 0.05));
  const cp = ['kemampuan', 'skenario', 'semua'].includes(cakupan) ? cakupan : 'kemampuan';
  fs.mkdirSync(ujiDir(), { recursive: true });
  const args = [path.join(ROOT, 'scripts', 'uji-nyata.mjs'), '--batas', String(batas), '--keluar', path.join(ujiDir(), 'hasil.json'), '--tenang', ...(cp === 'kemampuan' ? ['--kemampuan'] : cp === 'skenario' ? ['--skenario'] : [])];
  job = { jalan: true, mulai: Date.now(), cakupan: cp, batasUSD: batas };
  const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, RAIVERSE_DATA_SRC: dataDir() }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let err = ''; child.stderr.on('data', (c) => { err = (err + c).slice(-400); });
  const timer = setTimeout(() => child.kill(), 25 * 60e3); timer.unref?.();
  child.on('close', (kode) => { clearTimeout(timer); job = { ...job, jalan: false, kode, pesan: kode === 0 ? 'Selesai.' : kode === 2 ? 'Kunci AI tidak tersedia untuk uji.' : ('Berhenti dengan galat. ' + err.replace(/\s+/g, ' ').slice(0, 160)) }; });
  child.on('error', (e) => { job = { ...job, jalan: false, kode: -1, pesan: 'Tidak bisa memulai uji: ' + e.message }; });
  return ujiStatus();
}
