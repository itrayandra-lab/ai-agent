// Skrip kecil yang jalan paling awal (klasik, bukan modul): mulai mengunduh data dan, di layar lebar yang membuka Kantor 3D, modul 3D, sejajar dengan pemuatan UI.
try { window.__state0 = fetch('/api/state'); } catch (e) { /* loadState mengunduh sendiri */ }
(function () {
  var h = location.hash.slice(1).split('?')[0];
  if (matchMedia('(max-width: 820px)').matches || (h && h !== 'office')) return;
  ['/vendor/three/build/three.module.js', '/vendor/three/build/three.core.js', '/vendor/three/examples/jsm/loaders/GLTFLoader.js', '/js/office3d.js', '/js/assets3d.js', '/js/environment.js', '/js/furniture.js', '/js/props.js', '/js/people.js', '/js/life.js', '/js/chatter.js']
    .forEach(function (u) { var l = document.createElement('link'); l.rel = 'modulepreload'; l.href = u; document.head.appendChild(l); });
})();
