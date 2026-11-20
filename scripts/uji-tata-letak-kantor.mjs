// Uji tumpang tindih panel Kantor 3D memakai Chrome headless.
// Mengukur kotak batas setiap panel pada lima ukuran layar dan dalam banyak keadaan (bawaan, ruangan, kabar, menu, halaman di panel kiri, ...).
// Gagal bila dua panel beririsan, ada panel keluar dari area Kantor, lebih dari satu popup terbuka, atau pusat pandangan tertutup panel.
// Cepat: satu peramban bersama (viewport diubah, halaman dimuat ulang hanya saat berpindah antara tata letak HP dan desktop),
// semua tunggu berupa tunggu-kondisi (bukan tidur tetap). Bisa dijalankan per ukuran.
// Pakai: node scripts/uji-tata-letak-kantor.mjs <port> [folder-tangkapan] [tag]   (server uji terisolasi, tanpa kunci AI)
import fs from 'node:fs';
import { bukaChrome, tidur } from './lib/chrome-cdp.mjs';

export const UKURAN = [[1920, 950], [1440, 900], [1280, 720], [820, 900], [390, 844]];
const PANEL = ['.ovz.tr .cam-btns', '#lpage', '#orooms', '.cam-menu', '#ohud', '#ohelp', '#ovis', '#oapps', '#ofeedp', '#ofollow', '#odock', '#oinfobar', '#phud', '.tod-pop'];
const POPUP = ['#orooms', '.cam-menu', '#ohud', '#ohelp', '#ovis', '#oapps', '#ofeedp', '#phud', '.tod-pop'];

const UKUR = `(() => {
  const ov = document.querySelector('.office-ov'); if (!ov) return JSON.stringify({ galat: 'tidak ada .office-ov' });
  const o = ov.getBoundingClientRect();
  const out = [];
  for (const s of ${JSON.stringify(PANEL)}) for (const el of ov.querySelectorAll(s)) {
    if (el.hidden || el.closest('[hidden]')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    out.push({ s, l: b.left, t: b.top, r: b.right, b: b.bottom });
  }
  const sb = document.querySelector('#sidebar'); if (sb && getComputedStyle(sb).display !== 'none') { const b = sb.getBoundingClientRect(); if (b.width > 1) out.push({ s: '#sidebar', l: b.left, t: b.top, r: b.right, b: b.bottom, bebas: true }); }
  return JSON.stringify({ ov: { l: o.left, t: o.top, r: o.right, b: o.bottom }, vw: innerWidth, vh: innerHeight, panel: out });
})()`;

export function periksa(data) {
  const masalah = [];
  if (data.galat) return [data.galat];
  const { ov, panel } = data; const e = 1.5;
  for (const p of panel) if (!p.bebas && (p.l < ov.l - e || p.t < ov.t - e || p.r > ov.r + e || p.b > ov.b + e)) masalah.push(`${p.s} keluar dari layar (${[p.l, p.t, p.r, p.b].map(Math.round)}) area ${[ov.l, ov.t, ov.r, ov.b].map(Math.round)}`);
  for (let i = 0; i < panel.length; i++) for (let j = i + 1; j < panel.length; j++) {
    const a = panel[i], c = panel[j];
    const w = Math.min(a.r, c.r) - Math.max(a.l, c.l), h = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (w > 1 && h > 1) masalah.push(`${a.s} menimpa ${c.s} (${Math.round(w)}x${Math.round(h)} px)`);
  }
  return masalah;
}

/** @param {{ port: number|string, ukuran?: number[][], peramban?: any, out?: string, tag?: string, tema?: string, log?: Function }} o */
export async function ujiTataLetak({ port, ukuran = UKURAN, peramban, out, tag = 'uji', tema = 'dark', log = () => {}, snap = null }) {
  const c = peramban || await bukaChrome(); const hasil = [];
  // Chrome headless tidak menggambar frame bila tidak ada masukan, dan rute aplikasi berjalan di requestAnimationFrame: gerakan mouse kecil memicu frame
  const denyut = () => c.kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5 + (Date.now() % 7), y: 5 }).catch(() => {});
  const tunggu = async (fn, batas = 8000, langkah = 60) => { const t0 = Date.now(); for (;;) { if (Date.now() - t0 > 700) await denyut();   /* hanya bila macet: setiap frame memaksa render 3D yang mahal */ const v = await fn().catch(() => false); if (v) return v; if (Date.now() - t0 > batas) return false; await tidur(langkah); } };
  const ada = (js) => () => c.eval(js);
  try {
    for (const [w, h] of ukuran) {
      const mobile = w <= 900;
      await c.ukuran(w, h, { tema });
      // halaman dimuat ulang hanya bila belum ada, atau berpindah antara tata letak HP dan desktop (rute memilih layar saat dimuat)
      if (!c._hal || c._hal.mobile !== mobile || c._hal.port !== port) {
        await c.buka(`http://127.0.0.1:${port}/?nointro#office`);
        await c.eval(`localStorage.setItem('ui-theme', '${tema}')`).catch(() => {});
        c._hal = { mobile, port };
      }
      await tunggu(ada(`innerWidth === ${w}`), 4000);
      await tunggu(ada(`!!document.querySelector('.office-ov #odock')`), 30000);
      if (!mobile) await tunggu(ada(`(async () => { const m = await import('/js/views.js'); return !!m.officeApi()?.focusScreen; })()`), 30000);
      await tidur(150);   // satu putaran tata letak setelah ukuran berubah
      const klik = async (sel) => { await c.eval(`document.querySelector(${JSON.stringify(sel)})?.click()`); await tidur(40); };
      const tutupSemua = async () => {
        await c.eval(`if (!/office/.test(location.hash)) location.hash = 'office';`);
        await tunggu(ada(`!!document.querySelector('.office-ov #odock') && !document.querySelector('.office-ov #odock').closest('[hidden]')`), 15000);
        await c.eval(`(() => { const ov = document.querySelector('.office-ov'); try { Object.keys(localStorage).filter((k) => k.startsWith('ui-penuh-')).forEach((k) => localStorage.removeItem(k)); } catch (e) {} const x = document.querySelector('#lpx'); if (x && !document.querySelector('#lpage').hidden) x.click(); for (const s of ${JSON.stringify([...POPUP, '#otpm'])}) { const e = ov.querySelector(s); if (e) e.hidden = true; } })()`);
        await tunggu(ada(`${JSON.stringify(POPUP)}.every((s) => { const e = document.querySelector(s); return !e || e.hidden; }) && document.querySelector('#lpage').hidden`), 4000, 40);
      };
      // setiap keadaan menyebut panel yang HARUS tampak, supaya ukuran nol (panel hilang) tidak dianggap lolos
      const keadaan = [
        ['bawaan', async () => {}, mobile ? ['#odock', '.ovz.tr .cam-btns'] : ['#odock', '.ovz.tr .cam-btns', '#oinfobar']],
        ['ruangan', async () => klik(mobile ? '#roomtog2' : '#roomtog'), ['#orooms']],
        ['percakapan', async () => klik(mobile ? '#feedtog2' : '#feedchip'), ['#ofeedp']],
        ['menu', async () => klik('.cam-btns [data-cam="more"]'), ['.cam-menu']],
        ...(mobile ? [] : [['kolom-terbuka', async () => klik('#odtog'), ['#lpage']]]),   // #odtog membuka panel Obrolan di panel kiri
        ['keadaan-tim', async () => { await klik('.cam-btns [data-cam="more"]'); await klik('.cam-menu [data-cam="info"]'); }, ['#ohud']],
        ['bantuan', async () => { await klik('.cam-btns [data-cam="more"]'); await klik('.cam-menu [data-cam="sound"]'); }, ['#ohelp']],
        ...(mobile ? [] : [['halaman-hasil', async () => klik('#sidebar [data-nav="tasks"]'), ['#lpage', '#sidebar']], ['halaman-pengaturan', async () => { await klik('#sidebar [data-nav="tasks"]'); await klik('#navmore'); await klik('#sidebar [data-nav="settings"]'); }, ['#lpage']], ['obrolan-penuh', async () => klik('#sidebar [data-nav="dashboard"]'), ['#lpage', '#sidebar']]]),
        ...(mobile ? [] : [['dock-fokus', async () => { await c.eval(`document.querySelector('#goalq').click()`); }, ['#lpage']]]),
        ...(mobile ? [] : [['halaman-penuh', async () => { await klik('#sidebar [data-nav="tasks"]'); await tunggu(ada(`!document.querySelector('#lpage').hidden`), 8000); await klik('#lpfs'); }, ['#lpage']]]),
        ['tombol-h', async () => { await c.eval(`dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', bubbles: true }))`); }, mobile ? [] : ['#phud']],
        ['petunjuk-ikon', async () => klik('.cam-btns [data-cam="hint"]'), mobile ? [] : ['#phud']],
        ...(mobile ? [] : [['jam', async () => klik('#oclock [data-clock]'), ['.tod-pop']]]),
        ['satu-popup', async () => { await klik(mobile ? '#roomtog2' : '#roomtog'); await klik(mobile ? '#feedtog2' : '#feedchip'); await klik('.cam-btns [data-cam="more"]'); }, ['.cam-menu']],
        ['dua-panel', async () => { await klik(mobile ? '#roomtog2' : '#roomtog'); await klik(mobile ? '#feedtog2' : '#feedchip'); if (!mobile) await klik('#odtog'); }, mobile ? [] : ['#lpage']],
      ];
      for (const [nama, fn, harus] of keadaan) {
        const tMulai = Date.now();
        await tutupSemua();
        await fn();
        await tunggu(async () => { const d0 = JSON.parse(await c.eval(UKUR)); return harus.every((x) => (d0.panel || []).some((p) => p.s === x)); }, 15000, 80);
        const data = JSON.parse(await c.eval(UKUR));
        const masalah = periksa(data);
        if (snap) await snap(c, w, h, nama);   // pengait opsional (scripts/snapshot-gaya.mjs)
        for (const x of harus) if (!(data.panel || []).some((p) => p.s === x)) masalah.push(`${x} tidak tampil (ukuran nol atau tersembunyi)`);
        const nTerbuka = data.panel ? data.panel.filter((p) => POPUP.includes(p.s)).length : 0;
        const batas = 1;   // aturan Owner: HANYA SATU popup terbuka sekali waktu
        if (nTerbuka > batas) masalah.push(`${nTerbuka} panel terbuka bersamaan (batas ${batas})`);
        if (nama === 'halaman-penuh') {
          const u = JSON.parse(await c.eval(`JSON.stringify({ kanan: document.querySelector('#lpage').getBoundingClientRect().right, W: innerWidth, kiri: document.querySelector('#lpage').getBoundingClientRect().left, nav: document.querySelector('#sidebar').getBoundingClientRect().right, cls: document.querySelector('.office-ov').classList.contains('lp-penuh') })`));
          if (!u.cls) masalah.push('kelas lp-penuh tidak terpasang'); if (u.kanan < u.W - 24) masalah.push(`halaman penuh berhenti di x=${Math.round(u.kanan)} (layar ${u.W})`); if (u.kiri < u.nav) masalah.push('halaman penuh menimpa bilah navigasi kiri');
        }
        if (!mobile && harus.includes('#lpage') && nama !== 'halaman-penuh') {
          // pusat pandangan harus di tengah ruang kanan (toleransi 40 px, TIDAK dilonggarkan); tunggu transisi kamera 450 ms selesai
          const ambil = async () => JSON.parse(await c.eval(`(async () => { const m = await import('/js/views.js'); const f = m.officeApi()?.focusScreen?.(); const lp = document.querySelector('#lpage').getBoundingClientRect(); return JSON.stringify({ f, kanan: lp.right, W: innerWidth }); })()`));
          let ukur = await ambil();
          const t0 = Date.now();
          while (!(ukur.f && Math.abs(ukur.f.x - (ukur.kanan + ukur.W) / 2) <= 40) && Date.now() - t0 < 12000) { await tidur(80); ukur = await ambil(); }
          const tengah = (ukur.kanan + ukur.W) / 2;
          if (!ukur.f) masalah.push('titik pusat pandangan tidak terbaca');
          else if (ukur.f.x < ukur.kanan + 8) masalah.push(`pusat pandangan (x=${Math.round(ukur.f.x)}) tertutup panel (tepi kanan ${Math.round(ukur.kanan)})`);
          else if (Math.abs(ukur.f.x - tengah) > 40) masalah.push(`pusat pandangan x=${Math.round(ukur.f.x)} tidak di tengah ruang kanan (${Math.round(tengah)})`);
        }
        if (!mobile && harus.includes('#phud')) { const p = (data.panel || []).find((x) => x.s === '#phud'); if (p && p.t > h * 0.45) masalah.push(`petunjuk tombol ada di bawah (top=${Math.round(p.t)})`); }
        if (!mobile && nama === 'bawaan') {   // dock di KIRI BAWAH, rata dengan tepi kiri area konten (di kanan bilah navigasi)
          // letak dock harus stabil di kiri bawah; beri waktu sampai 4 detik bila tata letak masih berganti (kriteria sama, hanya menunggu)
          let d2 = data; const tw = Date.now();
          while (Date.now() - tw < 4000) { const x = (d2.panel || []).find((p) => p.s === '#odock'), n = (d2.panel || []).find((p) => p.s === '#sidebar'); if (x && n && x.l >= n.r && x.l <= n.r + 40 && x.b >= h - 40) break; await tidur(100); d2 = JSON.parse(await c.eval(UKUR)); }
          const dk = (d2.panel || []).find((x) => x.s === '#odock'), nav = (d2.panel || []).find((x) => x.s === '#sidebar');
          if (dk && nav && (dk.l < nav.r || dk.l > nav.r + 40)) masalah.push(`dock tidak rata di kiri bawah (kiri=${Math.round(dk.l)}, tepi bilah navigasi=${Math.round(nav.r)})`);
          if (dk && dk.b < h - 40) masalah.push('dock tidak menempel di bawah');
        }
        if (nama === 'obrolan-penuh') {   // satu komponen komposer: baris kontrol dock ada di kaki panel Obrolan, tanpa komposer ganda
          const k = await tunggu(ada("!!document.querySelector('#lpb .pm-dock > .od-foot') && !!document.querySelector('#ctlplus')"), 6000);
          if (!k) masalah.push('baris kontrol dock tidak ada di kaki panel Obrolan');
          const sisa = JSON.parse(await c.eval("JSON.stringify({ komposer: document.querySelectorAll('#lpb textarea, #lpb input#goalq').length, ajak: getComputedStyle(document.querySelector('#lpb .ob-ajak') || document.body).display })"));
          if (sisa.komposer !== 1) masalah.push('komposer ganda di panel Obrolan: ' + sisa.komposer);
          const terpotong = JSON.parse(await c.eval("JSON.stringify([...document.querySelectorAll('#lpb .od-foot .btn, #lpb .od-foot span')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map((e) => e.id || e.className))"));
          if (terpotong.length) masalah.push('teks terpotong di baris kontrol: ' + terpotong.join(','));
        }
        if (nama === 'dock-fokus' && (data.panel || []).some((x) => x.s === '#odock')) masalah.push('dock masih tampil setelah fokus: harus langsung panel Obrolan');
        hasil.push({ ukuran: `${w}x${h}`, keadaan: nama, masalah });
        if (out && (['bawaan', 'dua-panel', 'ruangan', 'kolom-terbuka', 'halaman-hasil', 'halaman-pengaturan', 'obrolan-penuh'].includes(nama))) await c.foto(`${out}/kantor-${w}x${h}-${nama}-${tag}.png`);
        log(`${w}x${h} ${nama}: ${masalah.length ? 'GAGAL ' + masalah.join(' | ') : 'ok'} [${Date.now() - tMulai} ms]`);
      }
    }
  } finally { if (!peramban) await c.tutup(); }
  return hasil;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('uji-tata-letak-kantor.mjs')) {
  const [, , port = '4641', out, tag = 'sesudah'] = process.argv;
  if (out) fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const r = await ujiTataLetak({ port, out, tag, log: console.log });
  const gagal = r.filter((x) => x.masalah.length);
  console.log(gagal.length ? `\n${gagal.length} keadaan GAGAL` : '\nSemua keadaan lolos', `(${Math.round((Date.now() - t0) / 1000)} detik)`);
  process.exit(gagal.length ? 1 : 0);
}
