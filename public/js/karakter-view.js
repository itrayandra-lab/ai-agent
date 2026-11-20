// Editor "Karakter saya" untuk Robot Mascot V4.2: pilih 1 dari 4 bentuk, wajah, warna badan, warna aksen, ukuran; ada tombol Acak
// dan PRATINJAU 3D langsung (satu canvas kecil, dimuat saat dibuka, dilepas saat ditutup). Robot di kantor baru berubah setelah "Simpan karakter".
// Hanya memakai aset yang sudah ada (docs/mascot-v4-2/README.md). Tidak menyentuh kamera, gerak, atau geometri kantor.
import { S, api, esc, emp, toast, modal } from './core.js';
import { icon } from './icons.js';
import { resolveAppearance, robotDefault, buildFbxRig, humanReady } from './assets3d.js';
import { BENTUK, WAJAH, TINGGI, bersihRobot, migrasiPenampilan, acakRobot, daftarWarna, daftarAksen } from './mascot-robot.js';

const wajahUrl = (id) => `/assets/characters/agents/${id}.face.png`;

export function bukaEditorKarakter() {
  const me = emp(S.me); if (!me) return;
  const awal = migrasiPenampilan(me.appearance, robotDefault(me));   // data lama (manusia) jatuh ke robot bawaan
  const cur = { robot: { ...awal.robot }, height: awal.height };
  let pv = null;   // pratinjau 3D { dispose, set }

  const html = () => {
    const r = cur.robot, warna = daftarWarna(r.family), aksen = daftarAksen(r.family, r.colorway);
    const sw = (c, on, attr, label) => `<button type="button" class="kr-sw ${on ? 'on' : ''}" ${attr} aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}" style="background:${c}"></button>`;
    const pvHtml = `<div class="kr-pv"><canvas id="krcv" width="320" height="320" aria-label="Pratinjau robotmu. Seret untuk memutar." role="img"></canvas><p class="small muted" id="krhint">Seret untuk memutar.</p></div>`;
    const optHtml = `<div class="kr-opt">
        <div class="kr-g"><b>Bentuk robot</b><div class="kr-cards">${BENTUK.map(([id, nm]) => `<button type="button" class="kr-card ${r.family === id ? 'on' : ''}" data-kr-fam="${id}" aria-pressed="${r.family === id}"><img src="${wajahUrl(id)}" alt="" width="56" height="56" loading="lazy"><span>${nm}</span></button>`).join('')}</div></div>
        <div class="kr-g"><b>Wajah</b><div class="kr-row">${WAJAH.map(([v, nm]) => `<button type="button" class="btn sm ${r.variant === v ? 'on' : ''}" data-kr-var="${v}" aria-pressed="${r.variant === v}">${nm}</button>`).join('')}</div></div>
        <div class="kr-g"><b>Warna badan</b><div class="kr-sws">${warna.map((w) => sw(`linear-gradient(135deg, ${w.shell} 55%, ${w.accent} 55%)`, r.colorway === w.i, `data-kr-col="${w.i}"`, w.name)).join('')}</div></div>
        <div class="kr-g"><b>Warna aksen</b><div class="kr-sws">${aksen.map((a) => sw(a.hex, r.edition === a.i, `data-kr-ed="${a.i}"`, a.i === 0 ? 'Aksen bawaan' : `Aksen ${a.i}`)).join('')}</div></div>
        <label class="kr-g"><b>Ukuran</b><input type="range" min="${TINGGI.min}" max="${TINGGI.max}" step="0.01" value="${cur.height}" data-kr-h aria-label="Ukuran robot"></label>
        <div class="kr-row"><button type="button" class="btn sm" data-kr-acak>${icon('repeat', 16)} Acak</button><span class="small muted">Robot di kantor berubah setelah kamu menekan Simpan.</span></div>
      </div>`;
    return { pvHtml, optHtml };
  };

  const kirimPratinjau = () => pv?.set({ ...cur.robot }, cur.height);
  modal('Karakter saya', '<div id="krbox"></div>', {
    wide: true,
    onMount: (el, close) => {
      const box = el.querySelector('#krbox');
      const bind = () => {
        box.querySelectorAll('[data-kr-fam]').forEach((b) => (b.onclick = () => { cur.robot = bersihRobot({ ...cur.robot, family: b.dataset.krFam }); gambar(); }));
        box.querySelectorAll('[data-kr-var]').forEach((b) => (b.onclick = () => { cur.robot = bersihRobot({ ...cur.robot, variant: b.dataset.krVar }); gambar(); }));
        box.querySelectorAll('[data-kr-col]').forEach((b) => (b.onclick = () => { cur.robot = bersihRobot({ ...cur.robot, colorway: +b.dataset.krCol }); gambar(); }));
        box.querySelectorAll('[data-kr-ed]').forEach((b) => (b.onclick = () => { cur.robot = bersihRobot({ ...cur.robot, edition: +b.dataset.krEd }); gambar(); }));
        box.querySelector('[data-kr-h]').oninput = (e) => { cur.height = Math.min(TINGGI.max, Math.max(TINGGI.min, +e.target.value)); kirimPratinjau(); };
        box.querySelector('[data-kr-acak]').onclick = () => { cur.robot = acakRobot(); gambar(); };
        pv?.pasang(box.querySelector('#krcv'));
      };
      const gambar = () => { box.querySelector('.kr-opt').outerHTML = html().optHtml; bind(); kirimPratinjau(); };   // kanvas tetap: hanya pilihan yang digambar ulang
      { const h = html(); box.innerHTML = `<div class="kr">${h.pvHtml}${h.optHtml}</div>`; }
      // pratinjau dimuat malas: hanya bila aset 3D siap; kalau tidak, editor tetap berfungsi tanpa pratinjau
      if (humanReady()) buatPratinjau(me).then((p) => { if (!document.body.contains(box)) { p.dispose(); return; } pv = p; bind(); kirimPratinjau(); }).catch(() => { box.querySelector('#krhint').textContent = 'Pratinjau tidak tersedia di perangkat ini.'; bind(); });
      else { box.querySelector('#krhint').textContent = 'Pratinjau muncul setelah kantor 3D selesai dimuat.'; bind(); }
      // dilepas saat modal ditutup (tombol, Esc, atau klik latar)
      const mo = new MutationObserver(() => { if (!document.body.contains(box)) { pv?.dispose(); pv = null; mo.disconnect(); } });
      mo.observe(document.getElementById('modal'), { childList: true, subtree: true, attributes: true });
    },
    actions: [{ label: 'Batal' }, { label: 'Simpan karakter', kind: 'primary', run: async () => {
      await api('PATCH', `/api/employees/${S.me}`, { appearance: { robot: cur.robot, height: cur.height } });
      toast('Karaktermu sudah diperbarui', 'ok');
    } }],
  });
}

/** satu canvas kecil: robot yang sama dengan di kantor (buildFbxRig), animasi diam, bisa diputar dengan seretan */
async function buatPratinjau(me) {
  const THREE = await import('three');
  let canvas = null, renderer = null, scene = null, camera = null, rig = null, raf = 0, rot = 0.5, drag = null, mati = false;
  const render = () => { if (mati || !renderer) return; raf = requestAnimationFrame(render); try { rig?.rig?.apply?.(null); } catch { /* animasi pratinjau tak boleh merusak editor */ } if (rig && !drag) rot += 0.004; if (rig) rig.g.rotation.y = rot; renderer.render(scene, camera); };
  const bangun = (robot, height) => {
    if (rig) scene.remove(rig.g);
    const e = { ...me, appearance: { robot, height } };
    rig = buildFbxRig(e, '#888888');
    scene.add(rig.g);
    // pas ke bingkai: tinggi robot menentukan jarak kamera (tanpa mengubah proporsinya)
    const t = rig.top || 1.7; camera.position.set(0, t * 0.55, t * 2.6); camera.lookAt(0, t * 0.48, 0);
  };
  return {
    pasang(cv) {
      if (mati || !cv || cv === canvas) return;
      cancelAnimationFrame(raf); renderer?.dispose();
      canvas = cv;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(cv.clientWidth || 320, cv.clientHeight || 320, false);
      scene = scene || new THREE.Scene();
      if (!scene.userData.lampu) { scene.userData.lampu = true; scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a8, 1.15)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 4, 3); scene.add(d); }
      camera = new THREE.PerspectiveCamera(30, (cv.clientWidth || 320) / (cv.clientHeight || 320), 0.1, 60);
      cv.onpointerdown = (ev) => { drag = { x: ev.clientX, r: rot }; cv.setPointerCapture?.(ev.pointerId); };
      cv.onpointermove = (ev) => { if (drag) rot = drag.r + (ev.clientX - drag.x) * 0.01; };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
      if (rig) { const t = rig.top || 1.7; camera.position.set(0, t * 0.55, t * 2.6); camera.lookAt(0, t * 0.48, 0); }
      render();
    },
    set(robot, height) { if (!scene || !camera) { this._tunda = [robot, height]; return; } bangun(robot, height); },
    dispose() {
      mati = true; cancelAnimationFrame(raf);
      if (rig && scene) scene.remove(rig.g);
      try { renderer?.dispose(); renderer?.forceContextLoss?.(); } catch { /* sudah lepas */ }
      renderer = null; scene = null; rig = null; canvas = null;
    },
  };
}
