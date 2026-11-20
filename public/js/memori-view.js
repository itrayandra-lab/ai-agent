// Memori: "Yang aku tahu tentang kamu" (profil usaha dan gaya), hal yang dipelajari dari bekerja bersama, dan kenalan lewat alamat situs
// atau satu kalimat. Dulu tampil di layar awal obrolan; kini hidup di Pengaturan > Memori supaya obrolan tetap bersih.
// Server: GET/PUT /api/pemandu/profile, POST /api/pemandu/onboard, DELETE /api/belajar/profil/:nomor.
import { esc, modal, toast } from './core.js';
import { icon } from './icons.js';

async function call(method, url, body) {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : null;
  } catch { return null; }
}

/** jendela ubah profil (dipakai juga oleh tombol "Ubah" di obrolan bila ada catatan baru yang perlu dikoreksi) */
export async function ubahProfil(sesudah = () => {}) {
  const p0 = await call('GET', '/api/pemandu/profile'); if (!p0) return toast('Belum bisa dibuka. Coba lagi sebentar.', '');
  const p = { ...p0, items: p0.items || [], fields: p0.fields || [] };
  const val = Object.fromEntries(p.items.map((i) => [i.key, i.value]));
  modal('Yang aku tahu tentang kamu', `<p class="small muted">Boleh diubah kapan saja. Kosongkan kalau mau dihapus.</p><div class="pm-form">${p.fields.map((f) => `<label class="f" for="pf-${f.key}">${esc(f.label)}</label><input class="input" id="pf-${f.key}" name="${f.key}" value="${esc(val[f.key] || '')}">`).join('')}</div>`, {
    actions: [{ label: 'Batal' }, { label: 'Simpan', kind: 'primary', run: async () => {
      const items = Object.fromEntries(p.fields.map((f) => [f.key, document.getElementById(`pf-${f.key}`)?.value || '']));
      const r = await call('PUT', '/api/pemandu/profile', { items, replace: true });
      if (r) { toast('Sudah kuingat.', 'ok'); sesudah(r); }
    } }],
  });
}

/** isi bagian Memori di Pengaturan */
export async function renderMemori(box) {
  const gambar = async () => {
    const p0 = await call('GET', '/api/pemandu/profile'); const p = p0 && { ...p0, items: p0.items || [], extras: p0.extras || [], fields: p0.fields || [] };
    if (!p) { box.innerHTML = '<p class="muted">Memori belum bisa dibuka. Coba lagi sebentar.</p>'; return; }
    box.innerHTML = `<p class="muted">Ini yang kuingat supaya kamu tidak perlu mengulang cerita. Semuanya bisa kamu baca dan ubah.</p>
      ${p.items.length ? `<ul class="mem-daftar">${p.items.map((i) => `<li><span class="muted">${esc(i.label)}</span> <b>${esc(i.value)}</b></li>`).join('')}</ul>` : '<p class="muted">Belum ada yang kuingat. Kenalkan usahamu di bawah, atau cukup ngobrol; aku akan memberi tahu bila mencatat sesuatu.</p>'}
      <div class="set-row"><div><b>Ubah yang kuingat</b></div><button type="button" class="btn" id="memUbah">${icon('edit', 18)} Ubah</button></div>
      <div class="set-row mem-kenal"><div><b>Kenalkan usahamu</b><p class="muted">Tempel alamat situs atau tulis satu kalimat tentang usahamu.</p><label class="sr-only" for="memIn">Alamat situs atau satu kalimat tentang usahamu</label><input id="memIn" class="input" placeholder="Contoh: kedaikopi.id, atau “Aku jual kopi susu di Bandung”"></div><button type="button" class="btn primary" id="memKenal">Catat</button></div>
      ${p.extras?.length ? `<h4>Yang kupelajari dari kita bekerja bersama</h4><ul class="pm-extra">${p.extras.map((x) => `<li><span>${esc(x.teks)}</span><button type="button" class="btn sm ghost" data-hapus="${x.nomor}">Hapus</button></li>`).join('')}</ul>` : ''}`;
    box.querySelector('#memUbah').onclick = () => ubahProfil(gambar);
    box.querySelector('#memKenal').onclick = async () => {
      const v = box.querySelector('#memIn').value.trim(); if (!v) return box.querySelector('#memIn').focus();
      const b = box.querySelector('#memKenal'); b.disabled = true; b.textContent = 'Sebentar…';
      const r = await call('POST', '/api/pemandu/onboard', { input: v });
      toast(r ? 'Sudah kucatat. Cek hasilnya di bawah.' : 'Aku belum bisa membaca itu. Coba tulis satu kalimat tentang usahamu.', r ? 'ok' : '');
      gambar();
    };
    box.querySelectorAll('[data-hapus]').forEach((b) => (b.onclick = async () => { b.disabled = true; await call('DELETE', `/api/belajar/profil/${b.dataset.hapus}`); gambar(); }));
  };
  box.innerHTML = '<p class="muted">Sebentar…</p>';
  await gambar();
}
