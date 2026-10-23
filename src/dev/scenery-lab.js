// Bench for the topic dioramas (src/models/scenery.js): every diorama in a labelled grid.
//   node tools/build.mjs --dev --entry src/dev/scenery-lab.js --out dist/scenery-lab.html
//   scenery-lab.html?only=rail,ai   subset (in that order)
//   &cols=N                         grid columns (default up to 3)
//   &pop=0.4                        freeze the entrance at k = 0.4;  pop=play replays it every 5 s
//   &live=1                         keep animating after a ?t= jump (by default a ?t= shot freezes on that frame)
//   + harness params: emPx, x, z, t, iso=1
import { bench, params } from './harness.js';
import { createScenery, SCENERY_IDS } from '../models/scenery.js';

const B = await bench();
const freeze = params.has('t') && !params.has('live');
let warm = true;
const tick = (fn) => B.onUpdate((dt, t) => { if (freeze && !warm) return; fn(dt, t); });

const note = (msg) => {
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;background:#fff;color:#b00;font:12px monospace;z-index:9;white-space:pre-wrap';
  d.textContent = msg;
  document.body.appendChild(d);
};
addEventListener('error', (e) => note(String(e.message || e)));

const list = params.get('only') ? params.get('only').split(',').filter(Boolean) : SCENERY_IDS;
const cols = +params.get('cols') || Math.min(3, list.length);
const DX = 9.6, DZ = 10.8;
const rows = Math.ceil(list.length / cols);
const popP = params.get('pop');

list.forEach((id, i) => {
  let s;
  try { s = createScenery(id); } catch (err) { note(id + ': ' + err.stack); return; }
  if (!s) { note('unknown scenery id: ' + id); return; }
  const x = (i % cols - (cols - 1) / 2) * DX, z = Math.floor(i / cols) * DZ;
  s.position.set(x, 0, z);
  B.add(s);
  B.label(id, x, z + 4.3, 0.6);
  const delay = i * 0.15;
  if (popP !== null && popP !== 'play') s.userData.pop(+popP);
  tick((dt, t) => {
    s.userData.tick(t, dt);
    if (popP === 'play') {
      const u = (((t - delay) % 5) + 5) % 5;
      s.userData.pop(u / 1.4);
    }
  });
});

if (!params.has('x')) B.stage.rig.target.x = 0;
if (!params.has('z')) B.stage.rig.target.z = (rows - 1) * DZ / 2 - 1.0;
B.stage.applyRig();
warm = false;
