// Kartu "Sambungan chat": hubungkan Telegram atau Discord ke akunmu sendiri (satu langkah: kirim kode singkat ke bot).
// Dipasang dari Pengaturan dengan satu baris: import { pasangSambungan } from './sambungan-view.js'; pasangSambungan(elemen);
// Tanpa gaya baru: memakai kelas yang sudah ada (set-k2, set-row, set-pil, btn, chip, input, muted) dan icon().
import { api, esc, toast } from './core.js';
import { icon } from './icons.js';
import { memuat, galat, ramah } from './awam.js';

const IKON = { telegram: 'chat', discord: 'chat' };
const LANGKAH = { telegram: 'Kirim kode ke bot Telegram kami.', discord: 'Kirim kode lewat pesan pribadi (DM) ke bot Discord kami.' };

/** Pasang kartu ke dalam `box`. Mengembalikan fungsi pembersih (hentikan pengecekan berkala). */
export function pasangSambungan(box) {
  let mati = false, timer = null, data = null, kode = {};   // kode: layanan -> { code, langkah, bot, exp }
  const henti = () => { clearInterval(timer); timer = null; };
  const adaKode = () => Object.values(kode).some((k) => k.exp > Date.now());

  const gambar = () => {
    if (mati) return;
    box.innerHTML = `<div class="set-k2"><h4>Obrolan: Telegram dan Discord</h4>
      <p class="muted">Pakai RAIVERSE langsung dari aplikasi obrolan di ponselmu. Percakapanmu terpisah dari orang lain, dan kamu bisa memutuskannya kapan saja. WhatsApp bisa disambungkan lewat aray.</p>
      ${(data?.services || []).map(kartu).join('')}</div>`;
    box.querySelectorAll('[data-hub]').forEach((b) => (b.onclick = () => hubungkan(b.dataset.hub, b)));
    box.querySelectorAll('[data-putus]').forEach((b) => (b.onclick = () => putuskan(b.dataset.putus, b)));
    box.querySelectorAll('[data-salin]').forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.salin).then(() => toast('Kode sudah disalin.', 'ok')).catch(() => toast('Salin manual dari kolom ya.', 'warn'))));
  };
  const kartu = (s) => {
    const k = kode[s.id] && kode[s.id].exp > Date.now() && !s.linked ? kode[s.id] : null;
    const status = s.linked ? `<span class="chip set-ok">${icon('check', 14)} Tersambung</span>` : s.available ? '<span class="chip">Belum tersambung</span>' : '<span class="chip">Belum disiapkan</span>';
    const aksi = s.linked ? `<button type="button" class="btn" data-putus="${esc(s.id)}">Putuskan</button>`
      : s.available ? `<button type="button" class="btn primary" data-hub="${esc(s.id)}">${icon('link', 18)} Hubungkan ${esc(s.label)}</button>` : '';
    const catatan = !s.linked && !s.available ? `<p class="muted">${esc(s.note || 'Belum tersedia.')}</p>` : '';
    const petunjuk = k ? `<div class="set-k2" role="status" aria-live="polite">
        <p>${esc((k.langkah || [LANGKAH[s.id]]).join(' '))}</p>
        <div class="set-row"><label class="sr-only" for="kode-${esc(s.id)}">Kode untuk ${esc(s.label)}</label><input class="input" id="kode-${esc(s.id)}" readonly value="${esc(k.code)}"><button type="button" class="btn" data-salin="${esc(k.code)}">Salin</button></div>
        <p class="muted">${icon('clock', 16)} Kode berlaku ${esc(String(k.minutes || 10))} menit dan hanya bisa dipakai sekali. Setelah dikirim, halaman ini akan berubah sendiri.</p></div>` : '';
    return `<div class="set-row"><span>${icon(IKON[s.id] || 'chat', 20)} <b>${esc(s.label)}</b></span><span class="set-aksi">${status}${aksi}</span></div>${catatan}${petunjuk}`;
  };

  const muat = async () => {
    try { data = await fetch('/api/saluran').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))); }
    catch { if (!mati) box.innerHTML = galat(ramah('', 0), '<button type="button" class="btn" data-ulangi>Coba lagi</button>'); box.querySelector('[data-ulangi]')?.addEventListener('click', () => { box.innerHTML = memuat(); muat(); }); return; }
    for (const s of data?.services || []) if (s.linked && kode[s.id]) { delete kode[s.id]; toast(`${s.label} sudah tersambung.`, 'ok'); }
    gambar();
    if (!adaKode()) henti();
  };
  const cek = () => { if (!timer) timer = setInterval(muat, 3000); };

  const hubungkan = async (id, tombol) => {
    tombol.disabled = true;
    try { const r = await api('POST', '/api/saluran/link', { service: id }); kode[id] = { code: r.code, langkah: r.langkah, bot: r.bot, minutes: r.minutes, exp: r.expiresAt }; gambar(); cek(); box.querySelector(`#kode-${id}`)?.focus(); }
    catch { tombol.disabled = false; }   // api() sudah menampilkan pesan ramah
  };
  const putuskan = async (id, tombol) => {
    tombol.disabled = true;
    try { await api('POST', '/api/saluran/unlink', { service: id }); delete kode[id]; toast('Sudah diputus.', 'ok'); await muat(); }
    catch { tombol.disabled = false; }
  };

  box.innerHTML = memuat();
  muat();
  return () => { mati = true; henti(); };
}
