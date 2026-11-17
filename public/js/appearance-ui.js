// Sims-style character creator controls, shared by Agent Studio (AI staff & new hires) and the player's own character.
import { PALETTE, STYLE_LABEL, resolveAppearance } from './assets3d.js';
import { esc } from './core.js';

const seg = (key, opts, cur) => `<div class="seg wrap">${opts.map(([v, l]) => `<button type="button" class="${String(cur) === String(v) ? 'on' : ''}" data-ap-${key}="${esc(String(v))}">${l}</button>`).join('')}</div>`;
const swatches = (key, list, cur) => `<div class="swatches">${list.map((c, i) => `<button type="button" title="${c}" style="background:${c}" class="${Number(cur) === i ? 'on' : ''}" data-ap-${key}="${i}"></button>`).join('')}</div>`;
const colorRow = (key, list, cur) => `<div class="swatches wrap">${list.map((c) => `<button type="button" title="${c}" style="background:${c}" class="${String(cur).toLowerCase() === c.toLowerCase() ? 'on' : ''}" data-ap-${key}="${c}"></button>`).join('')}</div>`;
const toggle = (key, on) => `<label class="pick-row"><span>${key}</span><input type="checkbox" data-ap-t="${key}" ${on ? 'checked' : ''}></label>`;

/** Full editor markup for an appearance record (see resolveAppearance). */
export function appearanceHTML(ap) {
  const styles = PALETTE.hairStyle[ap.gender];
  return `<div class="ap-editor">
    <div class="pick-row"><span>Jenis kelamin</span>${seg('gender', [['female', '👩 Wanita'], ['male', '👨 Pria']], ap.gender)}</div>
    <div class="pick-row"><span>Gaya rambut</span>${seg('hairStyle', styles.map((s) => [s, STYLE_LABEL[s]]), ap.hairStyle)}</div>
    <div class="pick-row"><span>Gaya pakaian</span>${seg("dress", [["casual", "👕 Casual"], ["smart", "🧥 Smart casual"], ["formal", "👔 Formal"]], ap.dress)}</div>
    <div class="pick-row"><span>Warna kulit</span>${swatches('skin', PALETTE.skin, ap.skin)}</div>
    <div class="pick-row"><span>Warna rambut</span>${swatches('hair', PALETTE.hair, ap.hair)}</div>
    <div class="pick-row"><span>Warna baju</span>${colorRow('shirt', PALETTE.shirt, ap.shirt)}</div>
    <div class="pick-row"><span>Warna celana</span>${colorRow('pants', PALETTE.pants, ap.pants)}</div>
    ${toggle('glasses', ap.glasses)}${ap.gender === 'male' ? toggle('beard', ap.beard) : toggle('earring', ap.earring)}
    <label class="pick-row"><span>Postur tubuh</span><input type="range" min="0.9" max="1.1" step="0.01" value="${ap.build}" data-ap-r="build"></label>
    <label class="pick-row"><span>Tinggi</span><input type="range" min="0.92" max="1.08" step="0.01" value="${ap.height}" data-ap-r="height"></label>
    <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-ap-random>🎲 Acak penampilan</button><span class="small muted">Setiap perubahan langsung terlihat di kantor 3D.</span></div>
  </div>`;
}

/** Wires the controls. `onChange(appearance)` fires after every change. */
export function bindAppearance(root, ap, onChange) {
  const cur = { ...ap };
  const rerender = () => { root.innerHTML = appearanceHTML(cur); bind(); onChange({ ...cur }); };
  const bind = () => {
    root.querySelectorAll('[data-ap-gender]').forEach((b) => (b.onclick = () => { cur.gender = b.dataset.apGender; cur.hairStyle = PALETTE.hairStyle[cur.gender][0]; rerender(); }));
    root.querySelectorAll('[data-ap-hairStyle]').forEach((b) => (b.onclick = () => { cur.hairStyle = b.dataset.apHairstyle ?? b.dataset.apHairStyle; rerender(); }));
    root.querySelectorAll('[data-ap-dress]').forEach((b) => (b.onclick = () => { cur.dress = b.dataset.apDress; rerender(); }));
    root.querySelectorAll('[data-ap-skin]').forEach((b) => (b.onclick = () => { cur.skin = +b.dataset.apSkin; rerender(); }));
    root.querySelectorAll('[data-ap-hair]').forEach((b) => (b.onclick = () => { cur.hair = +b.dataset.apHair; rerender(); }));
    root.querySelectorAll('[data-ap-shirt]').forEach((b) => (b.onclick = () => { cur.shirt = b.dataset.apShirt; rerender(); }));
    root.querySelectorAll('[data-ap-pants]').forEach((b) => (b.onclick = () => { cur.pants = b.dataset.apPants; rerender(); }));
    root.querySelectorAll('[data-ap-t]').forEach((i) => (i.onchange = () => { cur[i.dataset.apT] = i.checked; rerender(); }));
    root.querySelectorAll('[data-ap-r]').forEach((i) => (i.oninput = () => { cur[i.dataset.apR] = +i.value; onChange({ ...cur }); }));
    root.querySelector('[data-ap-random]')?.addEventListener('click', () => {
      const g = Math.random() < 0.5 ? 'female' : 'male';
      const pick = (a) => a[(Math.random() * a.length) | 0];
      Object.assign(cur, { dress: pick(['casual', 'casual', 'smart', 'formal']), gender: g, hairStyle: pick(PALETTE.hairStyle[g]), skin: (Math.random() * PALETTE.skin.length) | 0, hair: (Math.random() * PALETTE.hair.length) | 0, shirt: pick(PALETTE.shirt), pants: pick(PALETTE.pants), glasses: Math.random() < 0.3, beard: g === 'male' && Math.random() < 0.4, earring: g === 'female' && Math.random() < 0.6, build: +(0.92 + Math.random() * 0.16).toFixed(2), height: +(0.95 + Math.random() * 0.12).toFixed(2) });
      rerender();
    });
  };
  root.innerHTML = appearanceHTML(cur);
  bind();
  return { get: () => ({ ...cur }) };
}

/** Starting point for an editor: the agent's resolved look (so the sliders show what they currently look like). */
export const startingAppearance = (e, divisionHex) => resolveAppearance(e, divisionHex);
