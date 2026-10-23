// Shared test bench for model work: a stage with the real camera, floor, light and ink, plus a 3D label helper.
// Build a page:  node tools/build.mjs --dev --entry src/dev/<file>.js --out dist/<file>.html
// Open:          http://localhost:<port>/<file>.html   (python3 -m http.server <port> --directory dist)
// Headless shot: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
//                --user-data-dir="$(mktemp -d)" --force-device-scale-factor=2 --window-size=420,800 \
//                --virtual-time-budget=4000 --enable-unsafe-swiftshader --screenshot=shot.png "http://localhost:<port>/<file>.html?..."
// URL params understood here: emPx (pixels per em, default 22), x / z (camera target), t (seconds to advance
// animations before the shot, default 0), iso=1 (3/4 isometric view instead of the reading view).
import * as THREE from 'three';
import { Stage } from '../engine/stage.js';
import { floorMaterial, toon } from '../engine/toon.js';
import { GlyphFont } from '../text/font.js';

export const params = new URLSearchParams(location.search);

export async function bench() {
  document.getElementById('boot')?.remove();
  const stage = new Stage(document.getElementById('stage'));
  const font = await GlyphFont.load('glyphs.bin');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), floorMaterial());
  floor.receiveShadow = true;
  stage.scene.add(floor);
  stage.rig.target.set(+params.get('x') || 0, 0, +params.get('z') || 0);
  if (params.get('iso')) { stage.rig.pitch = 38; stage.rig.yaw = 32; stage.rig.shear.set(0, 0); }
  stage.setEmPx(+params.get('emPx') || 22);
  const updaters = [];
  const clock = { t: 0 };
  // advance animations deterministically for screenshots, then keep running in real time
  const pre = +params.get('t') || 0;
  for (let t = 0; t < pre; t += 1 / 60) { clock.t = t; for (const u of updaters) u(1 / 60, t); }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    clock.t += dt;
    for (const u of updaters) u(dt, clock.t);
    stage.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  addEventListener('resize', () => stage.resize());
  window.__ready = true;
  return {
    stage, font, THREE, clock,
    add(obj) { stage.scene.add(obj); return obj; },
    onUpdate(fn) { updaters.push(fn); if (pre) for (let t = 0; t < pre; t += 1 / 60) fn(1 / 60, t); },
    // flat 3D label lying on the floor, centred at (x, z)
    label(text, x, z, size = 0.5) {
      const w = font.measure(text, size);
      const geo = font.build([...text].map((ch, i) => ({ ch, x: x - w / 2 + font.measure([...text].slice(0, i).join(''), size), z, size, depth: 0.08, y: 0 })));
      if (!geo) return null;
      const m = new THREE.Mesh(geo, toon('text', { top: '#1c2442', text: true }));
      stage.scene.add(m);
      return m;
    },
  };
}
