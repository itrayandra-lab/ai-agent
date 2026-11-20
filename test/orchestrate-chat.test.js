// /api/orchestrate: bawaannya Chat Engine (satu riwayat), jalur lama tetap untuk kanal, thread, rapat, penerima tertentu, gambar, dan mode eksplisit.
// Diuji pada peladen terpisah (port 4652, data sementara, tanpa kunci AI, tanpa token Telegram); peladen Owner tidak disentuh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4652; const base = `http://127.0.0.1:${PORT}`;
let child;
test.before(async () => {
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ray-orch-')), GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '', N8N_API_KEY: '', DISCORD_BOT_TOKEN: '' },
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('peladen uji tidak menyala')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('berjalan di')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error(`peladen uji berhenti (${c})`)));
  });
});
test.after(() => { try { child?.kill(); } catch { /* sudah berhenti */ } });
const post = async (url, body) => { const r = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})), res: r }; };
const get = async (url) => (await fetch(base + url)).json();

test('bawaan: pesan baru ke /api/orchestrate diurus Chat Engine dan tercatat di riwayat yang sama', async () => {
  const r = await post('/api/orchestrate', { text: 'halo' });
  assert.equal(r.status, 200); assert.equal(r.body.action, 'chat'); assert.equal(r.body.mesin, 'chat');
  assert.ok(r.body.convId && r.body.respons.kind === 'chat'); assert.equal(r.body.channelId, null);
  const daftar = await get('/api/chat/conversations');
  assert.ok(daftar.percakapan.some((c) => c.id === r.body.convId), 'riwayat dipakai bersama');
  const lanjut = await post('/api/orchestrate', { text: 'terima kasih', percakapan: r.body.convId });
  assert.equal(lanjut.body.convId, r.body.convId, 'percakapan yang sama bisa dilanjutkan lewat jalur ini');
  assert.deepEqual(r.body.respons.options.map((o) => o.id.split(':')[0]).filter((x) => x !== 'say'), []);
});

test('kompatibilitas: mesin "lama", kanal, penerima tertentu, dan mode eksplisit tetap memakai jalur lama (bentuk balasan lama)', async () => {
  const lama = await post('/api/orchestrate', { text: 'halo', mesin: 'lama' });
  assert.equal(lama.status, 200); assert.ok(lama.body.channelId, 'jalur lama menghasilkan kanal'); assert.equal(lama.body.mesin, undefined);
  const ke = await post('/api/orchestrate', { text: 'halo Maya', to: ['maya'] });
  assert.ok(ke.body.channelId && ke.body.mesin === undefined, 'penerima tertentu = jalur lama');
  const goal = await post('/api/orchestrate', { text: 'tolong buatkan rencana konten minggu depan untuk kedai kopi', mode: 'goal' });
  assert.equal(goal.body.action, 'goal'); assert.ok(goal.body.taskId, 'mode eksplisit goal tetap membuat pekerjaan lewat jalur lama');
  const kosong = await post('/api/orchestrate', { text: '' }); assert.equal(kosong.status, 400);
});

test('bawaan tidak membuat pekerjaan tanpa konfirmasi: permintaan kerja lewat jalur baru berhenti di kartu konfirmasi', async () => {
  const sebelum = (await get('/api/state')).tasks.filter((t) => t.kind === 'goal').length;
  const r = await post('/api/orchestrate', { text: 'tolong buatkan caption instagram untuk promo kopi susu hari ini' });
  assert.equal(r.body.respons.kind, 'confirm');
  const sesudah = (await get('/api/state')).tasks.filter((t) => t.kind === 'goal').length;
  assert.equal(sesudah, sebelum, 'belum ada pekerjaan baru sebelum "Ya, kerjakan"');
});

test('aliran: rute stream mengirim SSE dan berakhir dengan peristiwa selesai', async () => {
  const c = await post('/api/chat/conversations', {});
  const r = await fetch(`${base}/api/chat/conversations/${c.body.id}/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teks: 'halo, apa kabar' }) });
  assert.match(r.headers.get('content-type'), /text\/event-stream/);
  const teks = await r.text();
  assert.match(teks, /"jenis":"selesai"/);
});
