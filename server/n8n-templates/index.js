// Templat tepercaya. Tiap templat: param (isian bahasa awam), check (validasi), needs (apa yang harus tersambung),
// build (rakit alur), describe (pratinjau awam), samples + expect (uji simulasi tanpa efek keluar).
import * as C from './common.js';
const { node, link, clean, lit, js } = C;

const finish = (nodes, conns, trigger, sim, extra = {}) => ({ nodes, connections: conns, trigger, sim, ...extra });
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';   // sha256 dari badan kosong (GET)
const webhookPath = (ctx) => `rv-${ctx.hookToken.slice(0, 24)}`;

const catat = {
  id: 'catat_sheets', judul: 'Catat data baru ke Google Sheets', ringkas: 'Setiap ada data baru masuk, aku catat jadi satu baris di Google Sheets.',
  kata: /(catat|rekap|simpan|masukkan|tulis).*(sheet|spreadsheet|tabel|excel|baris|data)|google sheets?|spreadsheet|\bsheets?\b/i, keluar: true,
  params: [
    { key: 'namaSpreadsheet', label: 'Nama spreadsheet', type: 'text', default: 'RAIVERSE - Data' },
    { key: 'namaSheet', label: 'Nama lembar', type: 'text', default: 'Data' },
    { key: 'kolom', label: 'Kolom yang dicatat (pisahkan dengan koma)', type: 'text', default: 'nama, pesan' },
  ],
  check(p, errs) { C.checkSheet(p, errs); },
  needs: (p, env) => C.sheetNeeds(env),
  build(p, ctx) {
    const conns = {};
    const t = C.webhookNode('Data masuk', webhookPath(ctx), [0, 0]);
    const s = C.sheetsNode(p, ctx, [280, 0]);
    link(conns, t.name, s.node.name);
    return finish([t, s.node], conns, t.name, s.sim, { masuk: { path: webhookPath(ctx), kolom: p.kolom } });
  },
  describe: (p) => ({ langkah: [`Data baru masuk lewat satu alamat khusus (kolom: ${p.kolom.join(', ')})`, `Aku catat jadi baris baru di Google Sheets "${p.namaSpreadsheet}", lembar "${p.namaSheet}"`], dampak: [`Menulis baris ke Google Sheets "${p.namaSpreadsheet}"`] }),
  samples: (p) => [{ body: Object.fromEntries(p.kolom.map((c) => [c, `Contoh ${c}`])) }],
  expect(outs, p) { const k = JSON.parse(outs[0].tulis); return k.action === 'sheets.append' && k.payload.rows[0].length === p.kolom.length && k.payload.rows[0][0] === `Contoh ${p.kolom[0]}` ? '' : 'Baris yang akan ditulis tidak sesuai kolom.'; },
};

const ringkasan = {
  id: 'ringkasan_harian', judul: 'Ringkasan harian', ringkas: 'Tiap hari di jam yang kamu pilih, aku kirim ringkasan kabar perusahaan.',
  kata: /ringkasan|rangkuman|laporan harian|rekap harian|daily|digest/i, keluar: true,
  params: [{ key: 'jam', label: 'Jam berapa dikirim?', type: 'time', default: '08:00' }, ...C.NOTIFY_PARAMS],
  check(p, errs) { p.jam = C.normTime(p.jam, '08:00'); if (!p.jam) errs.jam = 'Jam belum benar (contoh: 08:00).'; C.checkNotify(p, errs); },
  needs: (p, env) => [...(p.saluran !== 'raiverse' && !env.hook ? [{ kind: 'alamat', pesan: 'Ringkasan lewat email butuh alamat publik RAIVERSE (belum diatur). Pakai kabar lewat RAIVERSE dulu.' }] : []), ...C.notifyNeeds(p, env)],
  build(p, ctx) {
    const conns = {};
    const t = C.scheduleNode('Jadwal harian', C.cronAt(p.jam), [0, 0]);
    // kanal lain: panggilan ke RAIVERSE ditandatangani (cap waktu + nonce + HMAC), lihat handleHook di server/n8n.js
    const sign = p.saluran === 'raiverse' ? null : [
      C.setNode('Waktu panggilan', { rvTs: '={{ String($now.toMillis()) }}', rvNonce: '={{ Math.random().toString(36).slice(2, 12) + String($now.toMillis()) }}' }, [130, 0]),
      node('Tanda tangan', 'n8n-nodes-base.crypto', 1, { action: 'hmac', type: 'SHA256', value: '={{ $json.rvTs }}.{{ $json.rvNonce }}.GET.digest.' + EMPTY_SHA, dataPropertyName: 'rvSig', secret: ctx.hookSecret || '', encoding: 'hex' }, [195, 0]),
    ];
    const g = p.saluran === 'raiverse' ? C.setNode('Ambil ringkasan', { text: '__RINGKASAN__' }, [260, 0]) : node('Ambil ringkasan', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: `${C.raiverseUrl()}/api/automations/hook/${ctx.hookToken}/digest`, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-rv-ts', value: '={{ $json.rvTs }}' }, { name: 'x-rv-nonce', value: '={{ $json.rvNonce }}' }, { name: 'x-rv-sig', value: '={{ $json.rvSig }}' }] }, options: { timeout: 15000 } }, [260, 0]);   // kanal RAIVERSE: RAIVERSE sendiri mengisi ringkasannya saat mengambil hasil
    const k = C.notifyNode(p, '$json.text', { ...ctx, subject: 'Ringkasan harian RAIVERSE' }, [520, 0]);
    if (sign) { link(conns, t.name, sign[0].name); link(conns, sign[0].name, sign[1].name); link(conns, sign[1].name, g.name); } else link(conns, t.name, g.name);
    link(conns, g.name, k.node.name);
    return finish([t, ...(sign || []), g, k.node], conns, t.name, { 'Waktu panggilan': { rvTs: '1', rvNonce: 'contoh1234' }, 'Tanda tangan': { rvSig: 'contoh' }, 'Ambil ringkasan': { text: 'Ringkasan contoh: 3 tugas selesai, 2 sedang berjalan.' }, ...k.sim });
  },
  describe: (p) => ({ langkah: [`Setiap hari jam ${p.jam}`, 'Aku kumpulkan ringkasan kabar perusahaan', `Aku kirim lewat ${C.channelName(p)}`], dampak: [`Mengirim pesan harian ke ${C.channelName(p)}`] }),
  samples: () => [{ body: {} }],
  expect: (outs) => (/Ringkasan contoh/.test(JSON.parse(outs[0].kirim).teks) ? '' : 'Isi pesan ringkasan kosong.'),
};

const DOW = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6, minggu: 0 };
const pengingat = {
  id: 'pengingat', judul: 'Pengingat terjadwal', ringkas: 'Aku kirim pesan pengingat sesuai jadwal yang kamu mau.',
  kata: /ingat|remind|pengingat|jangan lupa|jadwal(kan)?|alarm/i, keluar: true,
  params: [
    { key: 'pesan', label: 'Apa yang perlu diingatkan?', type: 'text', required: true },
    { key: 'ulang', label: 'Seberapa sering?', type: 'choice', choices: [{ v: 'harian', t: 'Setiap hari' }, { v: 'hari_kerja', t: 'Senin sampai Jumat' }, { v: 'mingguan', t: 'Seminggu sekali' }], default: 'harian' },
    { key: 'hari', label: 'Hari apa?', type: 'choice', choices: Object.keys(DOW).map((d) => ({ v: d, t: d[0].toUpperCase() + d.slice(1) })), default: 'senin', when: (p) => p.ulang === 'mingguan' },
    { key: 'jam', label: 'Jam berapa?', type: 'time', default: '08:00' }, ...C.NOTIFY_PARAMS,
  ],
  check(p, errs) {
    p.pesan = clean(p.pesan, 300); if (p.pesan.length < 3) errs.pesan = 'Tulis apa yang perlu diingatkan.';
    p.ulang = ['harian', 'hari_kerja', 'mingguan'].includes(p.ulang) ? p.ulang : 'harian';
    p.hari = p.ulang === 'mingguan' ? (DOW[p.hari] !== undefined ? p.hari : 'senin') : undefined; if (!p.hari) delete p.hari;
    p.jam = C.normTime(p.jam, '08:00'); if (!p.jam) errs.jam = 'Jam belum benar (contoh: 08:00).'; C.checkNotify(p, errs);
  },
  needs: (p, env) => C.notifyNeeds(p, env),
  build(p, ctx) {
    const dow = p.ulang === 'hari_kerja' ? '1-5' : p.ulang === 'mingguan' ? String(DOW[p.hari]) : '*';
    const conns = {};
    const t = C.scheduleNode('Jadwal pengingat', C.cronAt(p.jam, dow), [0, 0]);
    const s = C.setNode('Siapkan pesan', { teks: lit(`Pengingat: ${p.pesan}`) }, [260, 0]);
    const k = C.notifyNode(p, '$json.teks', { ...ctx, subject: 'Pengingat dari RAIVERSE' }, [520, 0]);
    link(conns, t.name, s.name); link(conns, s.name, k.node.name);
    return finish([t, s, k.node], conns, t.name, k.sim);
  },
  describe(p) { const kapan = p.ulang === 'harian' ? 'Setiap hari' : p.ulang === 'hari_kerja' ? 'Senin sampai Jumat' : `Setiap hari ${p.hari}`; return { langkah: [`${kapan} jam ${p.jam}`, `Aku kirim pengingat: "${p.pesan}"`, `Lewat ${C.channelName(p)}`], dampak: [`Mengirim pengingat ke ${C.channelName(p)} sesuai jadwal`] }; },
  samples: () => [{ body: {} }],
  expect: (outs, p) => (JSON.parse(outs[0].kirim).teks === `Pengingat: ${p.pesan}` ? '' : 'Isi pengingat tidak sesuai.'),
};

const formulir = {
  id: 'formulir_masuk', judul: 'Formulir masuk, dicatat, lalu dikabari', ringkas: 'Saat ada isian formulir masuk, aku catat di Google Sheets lalu kabari kamu.',
  kata: /formulir|form\b|pendaftaran|pesanan masuk|order masuk|lead|webhook|isian/i, keluar: true,
  params: [...catat.params, ...C.NOTIFY_PARAMS],
  check(p, errs) { C.checkSheet(p, errs); C.checkNotify(p, errs); },
  needs: (p, env) => [...C.sheetNeeds(env), ...C.notifyNeeds(p, env)],
  build(p, ctx) {
    const conns = {};
    const t = C.webhookNode('Formulir masuk', webhookPath(ctx), [0, 0]);
    const s = C.sheetsNode(p, ctx, [260, 0]);
    const k = C.notifyNode(p, `'Data baru masuk: ' + Object.values($('Formulir masuk').item.json.body || {}).join(', ').slice(0, 300)`, { ...ctx, subject: 'Data baru masuk' }, [520, 0]);
    link(conns, t.name, s.node.name); link(conns, s.node.name, k.node.name);
    return finish([t, s.node, k.node], conns, t.name, { ...s.sim, ...k.sim }, { masuk: { path: webhookPath(ctx), kolom: p.kolom } });
  },
  describe: (p) => ({ langkah: [`Isian formulir masuk lewat satu alamat khusus (kolom: ${p.kolom.join(', ')})`, `Aku catat di Google Sheets "${p.namaSpreadsheet}"`, `Lalu aku kabari lewat ${C.channelName(p)}`], dampak: [`Menulis baris ke Google Sheets "${p.namaSpreadsheet}"`, `Mengirim kabar ke ${C.channelName(p)} setiap ada isian baru`] }),
  samples: (p) => catat.samples(p),
  expect(outs, p) { const e = catat.expect(outs, p); return e || (/Data baru masuk: Contoh/.test(JSON.parse(outs[0].kirim).teks) ? '' : 'Isi kabar tidak sesuai.'); },
  // dua simpul berefek: uji membaca keluaran simpul terakhir, jadi cek isi kabar saja
  simLast: true,
};

const pantau = {
  id: 'pantau_halaman', judul: 'Pantau perubahan halaman web atau harga', ringkas: 'Aku cek halaman web secara berkala dan kabari kamu kalau isinya atau harganya berubah.',
  kata: /pantau|monitor|awasi|cek (harga|halaman|situs|website)|harga (turun|naik|berubah)|perubahan (halaman|harga|situs)|berubah/i, keluar: true,
  params: [
    { key: 'url', label: 'Alamat halaman yang dipantau', type: 'url', required: true },
    { key: 'cari', label: 'Bagian yang dipantau (mis. "Rp" untuk harga). Kosongkan untuk seluruh halaman', type: 'text' },
    { key: 'setiap', label: 'Dicek setiap berapa jam?', type: 'choice', choices: [1, 3, 6, 12, 24].map((n) => ({ v: String(n), t: `${n} jam` })), default: '6' },
    ...C.NOTIFY_PARAMS,
  ],
  async check(p, errs, helpers) {
    p.cari = clean(p.cari, 60);
    p.setiap = [1, 3, 6, 12, 24].includes(Number(p.setiap)) ? Number(p.setiap) : 6;
    const r = await helpers.checkUrl(p.url);
    if (!r.ok) errs.url = r.reason || 'Alamat halaman tidak bisa dipakai.'; else p.url = r.url;
    C.checkNotify(p, errs);
  },
  needs: (p, env) => C.notifyNeeds(p, env),
  build(p, ctx) {
    const conns = {};
    const t = node('Jadwal cek', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'hours', hoursInterval: p.setiap }] } }, [0, 0]);
    const g = node('Ambil halaman', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: p.url, options: { timeout: 20000, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } } }, [240, 0]);
    // Why Code: butuh ingatan antar-jalan (static data) untuk membandingkan isi sekarang dengan sebelumnya; teks pencarian masuk sebagai literal, bukan regex dari pengguna.
    const code = `const s = $getWorkflowStaticData('global');
const cari = ${js(p.cari)};
const teks = String($json.data ?? '').replace(/<script[\\s\\S]*?<\\/script>|<style[\\s\\S]*?<\\/style>|<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
let nilai = teks.slice(0, 400);
if (cari) { const i = teks.toLowerCase().indexOf(cari.toLowerCase()); nilai = i >= 0 ? teks.slice(i, i + cari.length + 60) : '(bagian itu tidak ditemukan)'; }
const lama = s.terakhir;
s.terakhir = nilai;
return [{ json: { pertama: lama === undefined, berubah: lama !== undefined && lama !== nilai, lama: lama ?? '', baru: nilai } }];`;
    const c = node('Bandingkan', 'n8n-nodes-base.code', 2, { language: 'javaScript', mode: 'runOnceForAllItems', jsCode: code, notes: 'Why Code: ingatan antar-jalan untuk membandingkan isi halaman.' }, [480, 0]);
    const f = node('Berubah?', 'n8n-nodes-base.if', 2.2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: C.uuid(), leftValue: '={{ $json.berubah }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, [720, 0]);
    const k = C.notifyNode(p, `'Halaman berubah: ' + $json.baru + ' (sebelumnya: ' + $json.lama + ')'`, { ...ctx, subject: 'Halaman yang kamu pantau berubah' }, [960, -60]);
    const z = node('Tidak berubah', 'n8n-nodes-base.noOp', 1, {}, [960, 100]);   // ujung cabang "tidak berubah": tidak melakukan apa-apa
    link(conns, t.name, g.name); link(conns, g.name, c.name); link(conns, c.name, f.name); link(conns, f.name, k.node.name, 0); link(conns, f.name, z.name, 1);
    return finish([t, g, c, f, k.node, z], conns, t.name, { 'Ambil halaman': { data: '={{ $json.body?.html ?? "" }}' }, ...k.sim });
  },
  describe: (p) => ({ langkah: [`Setiap ${p.setiap} jam aku buka ${p.url}`, p.cari ? `Aku perhatikan bagian "${p.cari}"` : 'Aku perhatikan isi halamannya', `Kalau berubah, aku kabari lewat ${C.channelName(p)}`], dampak: [`Mengunjungi ${p.url} secara berkala`, `Mengirim kabar ke ${C.channelName(p)} saat ada perubahan`] }),
  samples: (p) => [{ body: { html: `<html><body>Harga ${p.cari || 'barang'} 100.000</body></html>` } }, { body: { html: `<html><body>Harga ${p.cari || 'barang'} 90.000</body></html>` } }],
  expect(outs) { const [a, b] = outs; if (!a || a.pertama !== true || a.berubah !== false) return 'Pembacaan pertama halaman tidak sesuai.'; return b && b.berubah === true && /Halaman berubah/.test(JSON.parse(b.kirim || '{"teks":""}').teks) ? '' : 'Perubahan halaman tidak terdeteksi saat diuji.'; },
};

const catatTabel = {
  id: 'catat_tabel', judul: 'Simpan data masuk ke tabel (gratis)', ringkas: 'Setiap ada data baru masuk, aku simpan di tabel milikmu. Tanpa Google, tanpa biaya.',
  kata: /simpan|tabel|database|basis data|catat|daftar|data masuk|tanpa google|gratis/i, keluar: false, tabel: true,
  params: [{ key: 'nama', label: 'Nama catatan ini', type: 'text', default: 'Catatan' }],
  check(p) { p.nama = clean(p.nama || 'Catatan', 60).replace(/[^\p{L}\p{N} _-]/gu, '') || 'Catatan'; },
  needs: () => [],
  build(p, ctx) {
    const conns = {};
    const t = C.webhookNode('Data masuk', webhookPath(ctx), [0, 0]);
    const s = C.dataTableNode(p, ctx, [280, 0]);
    link(conns, t.name, s.node.name);
    return finish([t, s.node], conns, t.name, s.sim, { masuk: { path: webhookPath(ctx) } });
  },
  describe: (p) => ({ langkah: [`Data baru masuk lewat satu alamat khusus (${p.nama})`, 'Aku simpan sebagai baris baru di tabel milikmu'], dampak: ['Menyimpan data di tabel pribadimu (tidak mengirim ke luar)'] }),
  samples: () => [{ body: { nama: 'Contoh', pesan: 'Halo' } }],
  expect: (outs) => (/Contoh/.test(outs[0].simpan || '') ? '' : 'Data contoh tidak sampai ke langkah simpan.'),
};

const cekSitus = {
  id: 'cek_situs', judul: 'Cek situs masih hidup', ringkas: 'Aku cek situsmu berkala dan kabari kalau tiba-tiba tidak bisa dibuka (dan saat sudah pulih).',
  kata: /situs|website|web\b|server|down|mati|uptime|hidup|bisa dibuka/i, keluar: true,
  params: [{ key: 'url', label: 'Alamat situs yang dicek', type: 'url', required: true }, { key: 'setiap', label: 'Dicek setiap berapa jam?', type: 'choice', choices: [1, 3, 6, 12].map((n) => ({ v: String(n), t: `${n} jam` })), default: '1' }, ...C.NOTIFY_PARAMS],
  async check(p, errs, helpers) { p.setiap = [1, 3, 6, 12].includes(Number(p.setiap)) ? Number(p.setiap) : 1; const r = await helpers.checkUrl(p.url); if (!r.ok) errs.url = r.reason || 'Alamat situs tidak bisa dipakai.'; else p.url = r.url; C.checkNotify(p, errs); },
  needs: (p, env) => C.notifyNeeds(p, env),
  build(p, ctx) {
    const conns = {};
    const t = node('Jadwal cek', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'hours', hoursInterval: p.setiap }] } }, [0, 0]);
    const g = node('Ambil situs', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: p.url, options: { timeout: 20000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } } }, [240, 0], { onError: 'continueRegularOutput' });
    // Why Code: ingatan antar-jalan agar kabar hanya muncul saat status berubah (mati / pulih), bukan tiap jam.
    const code = `const s = $getWorkflowStaticData('global');
const kode = Number($json.statusCode || 0);
const mati = !(kode >= 200 && kode < 400);
const lama = s.mati;
s.mati = mati;
const berubah = lama === undefined ? mati : lama !== mati;
return [{ json: { berubah, mati, kode } }];`;
    const c = node('Bandingkan status', 'n8n-nodes-base.code', 2, { language: 'javaScript', mode: 'runOnceForAllItems', jsCode: code, notes: 'Why Code: ingatan antar-jalan.' }, [480, 0]);
    const f = node('Berubah?', 'n8n-nodes-base.if', 2.2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: C.uuid(), leftValue: '={{ $json.berubah }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, [720, 0]);
    const k = C.notifyNode(p, `$json.mati ? ('Situs tidak bisa dibuka: ' + ${js(p.url)} + ' (kode ' + $json.kode + ')') : ('Situs sudah bisa dibuka lagi: ' + ${js(p.url)})`, { ...ctx, subject: 'Status situs berubah' }, [960, -60]);
    const z = node('Tidak berubah', 'n8n-nodes-base.noOp', 1, {}, [960, 100]);
    link(conns, t.name, g.name); link(conns, g.name, c.name); link(conns, c.name, f.name); link(conns, f.name, k.node.name, 0); link(conns, f.name, z.name, 1);
    return finish([t, g, c, f, k.node, z], conns, t.name, { 'Ambil situs': { statusCode: '={{ Number($json.body?.status ?? 200) }}' }, ...k.sim });
  },
  describe: (p) => ({ langkah: [`Setiap ${p.setiap} jam aku buka ${p.url}`, 'Kalau tidak bisa dibuka, atau sudah pulih lagi, aku kabari', `Lewat ${C.channelName(p)}`], dampak: [`Mengunjungi ${p.url} secara berkala`, `Mengirim kabar ke ${C.channelName(p)} saat status berubah`] }),
  samples: () => [{ body: { status: 200 } }, { body: { status: 503 } }],
  expect(outs) { const [a, b] = outs; if (!a || a.berubah !== false) return 'Pembacaan pertama tidak sesuai.'; return b && b.berubah === true && /tidak bisa dibuka/.test(b.kabar || '') ? '' : 'Situs mati tidak terdeteksi saat diuji.'; },
};

export const TEMPLATES = [catat, catatTabel, ringkasan, pengingat, formulir, pantau, cekSitus];

export const byId = (id) => TEMPLATES.find((t) => t.id === id);
