// Pengatur panel Kantor 3D: batas jumlah panel yang terbuka bersamaan (desktop 2, HP 1).
// Panel terdaftar dengan fungsi "terbuka?" dan "tutup"; yang paling lama dibuka ditutup lebih dulu.
// Memakai pengamat atribut supaya kode lama yang membuka panel lewat hidden/class tetap bekerja tanpa diubah.
export function buatPengatur(root, { maks = () => (matchMedia('(max-width: 900px)').matches ? 1 : 2) } = {}) {
  const daftar = new Map();   // nama -> { el, terbuka, tutup, sejak }
  let sibuk = false;
  const cek = () => {
    if (sibuk) return; sibuk = true;
    try {
      const buka = [];
      for (const [nama, p] of daftar) {
        const t = !!p.terbuka();
        if (t && !p.sejak) p.sejak = ++cek.n;
        if (!t) p.sejak = 0;
        if (t) buka.push([nama, p]);
      }
      buka.sort((a, b) => a[1].sejak - b[1].sejak);
      const lebih = buka.length - maks();
      // yang baru saja dibuka (sejak terbesar) tidak pernah ditutup oleh dirinya sendiri
      for (let i = 0; i < lebih; i++) { buka[i][1].tutup(); buka[i][1].sejak = 0; }
    } finally { sibuk = false; }
    root.dispatchEvent(new CustomEvent('panel-berubah', { detail: [...daftar].filter(([, p]) => p.terbuka()).map(([n]) => n) }));
  };
  cek.n = 0;
  const mo = new MutationObserver(cek);
  return {
    daftarkan(nama, el, { terbuka, tutup }) { daftar.set(nama, { el, terbuka, tutup, sejak: 0 }); mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }); },
    periksa: cek,
    buka(nama) { const p = daftar.get(nama); if (p && !p.terbuka()) { p.bukaFn?.(); } },
    daftar,
    putus() { mo.disconnect(); daftar.clear(); },
  };
}
