// Obsidian-style force-directed knowledge graph on a 2D canvas (pan, zoom, drag, hover highlight).
export function createGraph(canvas, { onOpen } = {}) {
  const ctx = canvas.getContext('2d');
  let nodes = [], links = [], byId = new Map();
  let view = { x: 0, y: 0, k: 1 };
  let hover = null, drag = null, pan = null, focusId = null;
  let alpha = 1, raf = 0, running = true;
  let colors = {};
  const dpr = () => Math.min(devicePixelRatio || 1, 2);

  function setData(notes, { folderColors = {}, focus = null } = {}) {
    colors = folderColors;
    focusId = focus;
    const old = byId;
    const titleToId = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));
    nodes = notes.map((n) => {
      const o = old.get(n.id);
      return { id: n.id, title: n.title, folder: n.folder, x: o?.x ?? (Math.random() - 0.5) * 400, y: o?.y ?? (Math.random() - 0.5) * 400, vx: 0, vy: 0, deg: 0, ghost: false };
    });
    byId = new Map(nodes.map((n) => [n.id, n]));
    links = [];
    for (const n of notes) {
      for (const m of n.content.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
        const t = m[1].trim().toLowerCase();
        let target = titleToId.get(t);
        if (!target) { // unresolved link → ghost node like Obsidian
          target = 'ghost:' + t;
          if (!byId.has(target)) { const g = { id: target, title: m[1].trim(), folder: '__ghost', x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300, vx: 0, vy: 0, deg: 0, ghost: true }; nodes.push(g); byId.set(target, g); }
        }
        if (target !== n.id) links.push({ s: byId.get(n.id), t: byId.get(target) });
      }
    }
    for (const l of links) { l.s.deg++; l.t.deg++; }
    if (focusId) {
      const keep = new Set([focusId]);
      for (const l of links) { if (l.s.id === focusId) keep.add(l.t.id); if (l.t.id === focusId) keep.add(l.s.id); }
      nodes = nodes.filter((n) => keep.has(n.id));
      links = links.filter((l) => keep.has(l.s.id) && keep.has(l.t.id));
    }
    alpha = 1;
    if (!old.size || focusId) fit();
  }

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    view = { x: w / 2, y: h / 2, k: focusId ? 1.1 : Math.min(1, Math.min(w, h) / 650) };
  }

  function step() {
    if (alpha < 0.005) return;
    const rep = 4200, spring = 0.025, len = focusId ? 95 : 85;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 250000) continue;
        const f = rep / Math.max(d2, 400);
        const d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      a.vx -= a.x * 0.004; a.vy -= a.y * 0.004; // gravity
    }
    for (const l of links) {
      const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - len) * spring;
      l.s.vx += (dx / d) * f; l.s.vy += (dy / d) * f; l.t.vx -= (dx / d) * f; l.t.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      if (n === drag?.node) continue;
      n.vx = Math.max(-40, Math.min(40, n.vx * 0.82)); n.vy = Math.max(-40, Math.min(40, n.vy * 0.82));
      n.x += n.vx * alpha; n.y += n.vy * alpha;
    }
    alpha *= 0.992;
  }

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, r = dpr();
    if (canvas.width !== w * r || canvas.height !== h * r) { canvas.width = w * r; canvas.height = h * r; }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
    const linkCol = css('--graph-link') || 'rgba(140,150,180,.25)';
    const textCol = css('--text') || '#ddd';
    const near = hover ? new Set([hover.id, ...links.filter((l) => l.s === hover || l.t === hover).flatMap((l) => [l.s.id, l.t.id])]) : null;
    ctx.lineWidth = 1 / view.k;
    for (const l of links) {
      const hl = hover && (l.s === hover || l.t === hover);
      ctx.strokeStyle = hl ? (css('--accent') || '#7aa2ff') : linkCol;
      ctx.globalAlpha = near && !hl ? 0.25 : 1;
      ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
    }
    for (const n of nodes) {
      const rad = 3.5 + Math.sqrt(n.deg) * 2.2;
      ctx.globalAlpha = near && !near.has(n.id) ? 0.2 : 1;
      ctx.fillStyle = n.ghost ? 'rgba(140,150,170,.45)' : colors[n.folder] || '#8a93a6';
      ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fill();
      if (n.id === focusId) { ctx.strokeStyle = css('--accent') || '#7aa2ff'; ctx.lineWidth = 2.5 / view.k; ctx.stroke(); ctx.lineWidth = 1 / view.k; }
      const showText = view.k > 0.75 || n.deg > 4 || n === hover || (near && near.has(n.id)) || focusId;
      if (showText) {
        ctx.fillStyle = textCol;
        ctx.font = `${n === hover ? 600 : 400} ${11 / Math.max(0.7, view.k) * Math.min(1.2, view.k)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.title.length > 34 ? n.title.slice(0, 32) + '…' : n.title, n.x, n.y + rad + 11);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() { raf = requestAnimationFrame(loop); if (!running) return; step(); draw(); }
  loop();

  const toWorld = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }; };
  const nodeAt = (p) => { let best = null, bd = Infinity; for (const n of nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < 12 / Math.min(1, view.k) && d < bd) { best = n; bd = d; } } return best; };
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = toWorld(e); const n = nodeAt(p);
    downAt = { x: e.clientX, y: e.clientY, n };
    if (n) drag = { node: n }; else pan = { x: e.clientX - view.x, y: e.clientY - view.y };
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toWorld(e);
    if (drag) { drag.node.x = p.x; drag.node.y = p.y; alpha = Math.max(alpha, 0.3); }
    else if (pan) { view.x = e.clientX - pan.x; view.y = e.clientY - pan.y; }
    else { hover = nodeAt(p); canvas.style.cursor = hover ? 'pointer' : 'grab'; }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && downAt.n && !downAt.n.ghost) onOpen?.(downAt.n.id);
    else if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && downAt.n?.ghost) onOpen?.(null, downAt.n.title);
    drag = null; pan = null; downAt = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(4, Math.max(0.15, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - ((mx - view.x) / view.k) * k; view.y = my - ((my - view.y) / view.k) * k; view.k = k;
  }, { passive: false });
  // pinch zoom
  const touches = new Map();
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const prev = touches.get('d'); touches.set('d', d);
    if (prev) { const k = Math.min(4, Math.max(0.15, view.k * (d / prev))); view.k = k; }
    pan = null; drag = null;
  }, { passive: false });
  canvas.addEventListener('touchend', () => touches.clear());

  return {
    setData, fit,
    reheat: () => { alpha = 1; },
    pause: (p) => { running = !p; },
    dispose: () => cancelAnimationFrame(raf),
  };
}
