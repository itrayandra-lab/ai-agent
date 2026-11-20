// Bahan bersama templat otomasi. Semua teks dari pengguna/halaman web diperlakukan sebagai DATA: dibersihkan, lalu
// dimasukkan ke alur hanya sebagai literal string (tidak pernah sebagai ekspresi/kode yang bisa dieksekusi).
import crypto from 'node:crypto';

export const TZ = 'Asia/Jakarta';
export const uuid = () => crypto.randomUUID();
export const hex = (n = 12) => crypto.randomBytes(n).toString('hex');

/** Bersihkan teks bebas: tanpa karakter kontrol, tanpa kurung ekspresi ganda, dipotong. */
export const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\{\{|\}\}/g, (m) => `${m[0]} ${m[0]}`).replace(/\s+/g, ' ').trim().slice(0, n);
/** Literal string aman untuk parameter n8n (selalu berbentuk ekspresi string JSON, tidak pernah diawali "="). */
export const lit = (s) => `={{ ${JSON.stringify(String(s))} }}`;
export const js = (s) => JSON.stringify(String(s));

export const node = (name, type, typeVersion, parameters, pos, extra = {}) => ({ id: uuid(), name, type, typeVersion, position: pos, parameters, ...extra });
export const link = (conns, from, to, outIndex = 0) => { ((conns[from] ||= { main: [] }).main[outIndex] ||= []).push({ node: to, type: 'main', index: 0 }); };

export const webhookNode = (name, path, pos) => node(name, 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path, responseMode: 'lastNode', options: {} }, pos, { webhookId: uuid() });
export const scheduleNode = (name, cron, pos) => node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: cron }] } }, pos);
export const setNode = (name, fields, pos) => node(name, 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: Object.entries(fields).map(([k, v]) => ({ id: uuid(), name: k, value: v, type: 'string' })) }, options: {} }, pos);

// ── alamat layanan (bukan rahasia)
export const raiverseUrl = () => String(process.env.RAIVERSE_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 4317}`).replace(/\/+$/, '');
export const wahaUrl = () => String(process.env.WAHA_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

// ── validasi isian
export const normPhone = (v) => { const d = String(v || '').replace(/[^\d+]/g, '').replace(/^\+/, ''); const n = d.startsWith('0') ? '62' + d.slice(1) : d; return /^62\d{8,13}$/.test(n) ? n : ''; };
export const normEmail = (v) => { const s = String(v || '').trim().toLowerCase(); return /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/.test(s) && s.length <= 120 ? s : ''; };
export const normTime = (v, def = '08:00') => { const m = String(v || def).match(/^(\d{1,2})[:.](\d{2})$/) || String(v || '').match(/^(\d{1,2})$/) && [0, String(v), '00']; if (!m) return ''; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : ''; };
export const cronAt = (time, dow = '*') => { const [h, m] = time.split(':').map(Number); return `${m} ${h} * * ${dow}`; };
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'x';

/** Parameter kabar yang dipakai bersama: ke mana pesan dikirim. */
export const NOTIFY_PARAMS = [
  { key: 'saluran', label: 'Kabari lewat mana?', type: 'choice', choices: [{ v: 'raiverse', t: 'Di sini (dan Telegram atau Discord bila sudah dihubungkan)' }, { v: 'email', t: 'Email' }], default: 'raiverse' },   // WhatsApp tidak tersedia; kabar ikut diteruskan ke saluran chat yang tertaut (server/channels)
  { key: 'tujuan', label: 'Alamat email tujuan', type: 'text', when: (p) => p.saluran && p.saluran !== 'raiverse' },
];
export function checkNotify(p, errs) {
  p.saluran = ['raiverse', 'whatsapp', 'email'].includes(p.saluran) ? p.saluran : 'raiverse';
  if (p.saluran === 'whatsapp') { p.tujuan = normPhone(p.tujuan); if (!p.tujuan) errs.tujuan = 'Nomor WhatsApp belum benar (contoh: 0812xxxxxxx).'; }
  else if (p.saluran === 'email') { p.tujuan = normEmail(p.tujuan); if (!p.tujuan) errs.tujuan = 'Alamat email belum benar.'; }
  else delete p.tujuan;
}
export const channelName = (p) => p.saluran === 'whatsapp' ? `WhatsApp ${p.tujuan}` : p.saluran === 'email' ? `email ${p.tujuan}` : 'pesan di RAIVERSE';

/**
 * Simpul "Kirim kabar" sesuai saluran. textJs = ekspresi JavaScript (tanpa {{ }}) yang menghasilkan teks pesan.
 * Mengembalikan { node, sim } — sim = isian yang menggantikan simpul ini saat uji simulasi (tidak ada pesan nyata).
 */
export function notifyNode(p, textJs, ctx, pos, name = 'Kirim kabar') {
  const kirim = `={{ JSON.stringify({ ke: ${js(channelName(p))}, teks: String(${textJs}).slice(0, 1000) }) }}`;
  const sim = { [name]: { kirim } };
  if (p.saluran === 'whatsapp') {
    const n = node(name, 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: `${wahaUrl()}/api/sendText`, sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify({ session: 'default', chatId: ${js(p.tujuan + '@c.us')}, text: String(${textJs}).slice(0, 1000) }) }}`, options: { timeout: 20000 } }, pos, ctx.wahaCred ? { credentials: { httpHeaderAuth: ctx.wahaCred } } : {});
    if (ctx.wahaCred) { n.parameters.authentication = 'genericCredentialType'; n.parameters.genericAuthType = 'httpHeaderAuth'; }
    return { node: n, sim };
  }
  if (p.saluran === 'email') {
    return { node: node(name, 'n8n-nodes-base.emailSend', 2.1, { fromEmail: ctx.mailFrom || 'otomasi@localhost', toEmail: p.tujuan, subject: lit(ctx.subject || 'Kabar dari RAIVERSE'), emailFormat: 'text', text: `={{ String(${textJs}).slice(0, 4000) }}`, options: {} }, pos, ctx.smtpCred ? { credentials: { smtp: ctx.smtpCred } } : {}), sim };
  }
  // kanal RAIVERSE: alur hanya menaruh teks di keluaran 'kabar'; RAIVERSE yang mengambilnya (tanpa alamat publik, tanpa panggilan masuk)
  const kabar = `={{ String(${textJs}).slice(0, 1000) }}`;
  return { node: setNode(name, { kabar }, pos), sim: { [name]: { kabar, kirim } } };
}

/** Apa yang perlu tersedia agar saluran ini bisa jalan. */
export function notifyNeeds(p, env) {
  const need = [];
  if (p.saluran === 'whatsapp') need.push({ kind: 'whatsapp', pesan: 'WhatsApp belum tersedia di RAIVERSE. Hubungkan Telegram atau Discord di Pengaturan, atau pilih kabar lewat RAIVERSE.' });
  else if (p.saluran === 'email' && !env.shared) need.push({ kind: 'pengirim', pesan: 'Email belum tersedia untuk akunmu. Pakai kabar lewat RAIVERSE (bisa juga lewat Telegram atau Discord yang sudah kamu hubungkan).' });
  if (p.saluran === 'email' && !env.smtp) need.push({ kind: 'email', pesan: 'Email pengirim belum disiapkan. Pilih kabar lewat RAIVERSE, atau hubungkan Telegram atau Discord dulu.' });
  return need;
}

// ── penulisan ke Google Sheets lewat konektor Google Apps Script yang sudah dipasang Owner (tanpa formulir teknis)
export const colList = (v) => [...new Set(String(v || '').split(/[,\n;]+/).map((c) => clean(c, 40).replace(/[^\p{L}\p{N} _-]/gu, '').trim()).filter(Boolean))].slice(0, 12);
export function sheetsNode(p, ctx, pos, name = 'Tulis ke Sheets') {
  const row = `[${p.kolom.map((c) => `$json.body?.[${js(c)}] ?? ''`).join(', ')}]`;
  const payload = `{ spreadsheet_name: ${js(p.namaSpreadsheet)}, sheet_name: ${js(p.namaSheet)}, headers: ${JSON.stringify(p.kolom)}, rows: [${row}] }`;
  const body = `={{ JSON.stringify({ action: 'sheets.append', payload: ${payload} }) }}`;
  const n = node(name, 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: ctx.googleUrl, authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, specifyBody: 'json', jsonBody: body, options: { timeout: 30000, redirect: { redirect: { followRedirects: true, maxRedirects: 5 } } } }, pos, { credentials: { httpCustomAuth: ctx.googleCred } });
  return { node: n, sim: { [name]: { tulis: body } } };
}
export function dataTableNode(p, ctx, pos, name = 'Simpan ke tabel') {
  const cols = { tenant: ctx.tenant, otomasi: ctx.otomasiId, waktu: '={{ $now.toISO() }}', isi: '={{ JSON.stringify($json.body ?? {}).slice(0, 3000) }}' };
  const n = node(name, 'n8n-nodes-base.dataTable', 1.1, { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: ctx.tableId }, columns: { mappingMode: 'defineBelow', value: cols, matchingColumns: [], schema: [] }, options: {} }, pos);
  return { node: n, sim: { [name]: { simpan: '={{ JSON.stringify($json.body ?? {}).slice(0, 3000) }}' } } };
}
export const sheetNeeds = (env) => env.google ? [] : [{ kind: 'google', pesan: 'Google belum tersambung. Sambungkan Google dulu (cukup sekali), lalu aku lanjutkan.' }];
export function checkSheet(p, errs) {
  p.namaSheet = clean(p.namaSheet || 'Data', 60).replace(/[^\p{L}\p{N} _-]/gu, '') || 'Data';
  p.namaSpreadsheet = clean(p.namaSpreadsheet || 'RAIVERSE - Data', 80).replace(/[^\p{L}\p{N} _-]/gu, '') || 'RAIVERSE - Data';
  p.kolom = colList(Array.isArray(p.kolom) ? p.kolom.join(',') : p.kolom || 'nama, pesan');
  if (!p.kolom.length) errs.kolom = 'Tulis minimal satu nama kolom, contoh: nama, nomor, pesan.';
}
