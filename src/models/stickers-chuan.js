// LINE-style big stickers of mini 川哥: the figure in a pose on a small round base, plus the sticker's words as
// chunky 3D letters on a rounded plate lying flat in front of him. Footprint centred on the origin within
// x ∈ [-2.7, 2.7], z ∈ [-2.6, 2.4], height ≤ 4.5 em.
//   const s = createChuanSticker('c_thumb', font);
//   s.userData.pop(k)        // entrance squash & stretch, k 0 -> 1
//   s.userData.tick(t, dt)   // looping idle animation
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { STICKERS } from './catalog.js';
import { createChuan, heartGeometry, starGeometry } from './chuan.js';
import { slabFromShape, roundRect } from '../chat/shapes.js';

const FIG_Z = -0.95;          // where he stands
const BASE_R = 1.42, BASE_H = 0.16;
const FIG_S = 1.22;          // the figure a bit bigger than in the chat so poses read
const PLATE_Z = 1.42, PLATE_D = 1.42, PLATE_H = 0.26, PLATE_MAX_W = 5.2;
const TEXT_TOP = '#10306e';

// per-sticker flavour: plate colour, tools, pose variant, little extras
const LOOK = {
  c_thumb:  { plate: 'yellow', extras: ['sparkle'] },
  c_fist:   { plate: 'white', extras: ['sparkle'] },
  c_heart:  { plate: 'white', extras: ['heart'] },
  c_ok:     { plate: 'yellow' },
  c_hammer: { plate: 'yellow', tools: { hammer: true }, extras: ['sparkle'] },
  c_bow:    { plate: 'white' },
  c_salute: { plate: 'white' },
  c_hello:  { plate: 'white' },
  c_bye:    { plate: 'yellow', tools: { hammer: true }, v: { mirror: true, other: 'hammer', face: 'wink' } },
  c_shovel: { plate: 'yellow', tools: { shovel: true }, extras: ['dirt'] },
  c_think:  { plate: 'white', extras: ['dots'] },
  c_run:    { plate: 'yellow', tools: true, extras: ['dust'], yaw: 0.55 },
  c_cheer:  { plate: 'yellow', extras: ['sparkle'] },
  c_thanks: { plate: 'yellow', v: { hat: true } },
  c_vote:   { plate: 'yellow', v: { other: 'point' }, extras: ['sparkle'] },
};

const easeOutBack = (k) => { const c = 1.9; const x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
function popScale(obj, k) {
  if (k <= 0) { obj.scale.setScalar(1e-4); obj.visible = false; return; }
  obj.visible = true;
  if (k >= 1) { obj.scale.set(1, 1, 1); return; }
  const e = Math.max(1e-4, easeOutBack(k));
  const w = Math.sin(k * Math.PI * 2.4) * (1 - k);
  obj.scale.set(e * (1 - 0.2 * w), e * (1 + 0.34 * w), e * (1 - 0.2 * w));
}

function mesh(geo, mat, parent, p, r, s) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  if (p) o.position.set(...p);
  if (r) o.rotation.set(...r);
  if (s !== undefined) { if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(...s); }
  parent.add(o);
  return o;
}

let G = null;
function geos() {
  if (G) return G;
  G = {
    base: new THREE.CylinderGeometry(BASE_R, BASE_R + 0.05, BASE_H, 40),
    baseTop: new THREE.CylinderGeometry(BASE_R - 0.16, BASE_R - 0.16, 0.03, 40),
    puff: new THREE.SphereGeometry(1, 12, 8),
    dot: new THREE.SphereGeometry(1, 14, 10),
    mound: new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  return G;
}

export function createChuanSticker(id, font) {
  const def = STICKERS[id];
  if (!def || def.who !== 'chuan') throw new Error(`not a 川哥 sticker: ${id}`);
  const look = LOOK[id] || { plate: 'white' };
  const g = geos();
  const group = new THREE.Group();
  group.name = `sticker:${id}`;

  // --- the figure on its base
  const stand = new THREE.Group();
  stand.position.set(0, 0, FIG_Z);
  group.add(stand);
  const base = mesh(g.base, toon('white', { receive: 0.5 }), stand, [0, BASE_H / 2, 0]);
  base.receiveShadow = true;
  const top = mesh(g.baseTop, toon('sky', { receive: 0.55 }), stand, [0, BASE_H + 0.005, 0]);
  top.receiveShadow = true;
  const chuan = createChuan({ hat: true, tools: look.tools ?? false });
  chuan.group.position.y = BASE_H + 0.02;
  chuan.group.scale.setScalar(FIG_S);
  chuan.setPose(def.pose, 1, look.v || {});
  if (look.yaw) chuan.setFacing(look.yaw);
  stand.add(chuan.group);

  // --- the text plate
  const plate = new THREE.Group();
  plate.position.set(0, 0, PLATE_Z);
  group.add(plate);
  const text = def.text;
  let size = 1.0;
  const w1 = font.measure(text, 1);
  size = Math.min(1.0, (PLATE_MAX_W - 0.7) / Math.max(0.01, w1));
  const tw = w1 * size;
  const W = Math.min(PLATE_MAX_W, Math.max(2.6, tw + 0.8));
  const slab = new THREE.Mesh(slabFromShape(roundRect(W, PLATE_D, 0.62), PLATE_H, { bevel: 0.07 }),
    toon(look.plate === 'yellow' ? 'yellow' : 'white', { receive: 0.5 }));
  slab.position.set(-W / 2, 0, -PLATE_D / 2);
  slab.castShadow = true; slab.receiveShadow = true;
  plate.add(slab);
  const asc = font.ascender ?? 0.88, desc = font.descender ?? -0.12;
  const baseline = (asc + desc) / 2 * size;
  const items = [];
  let x = -tw / 2;
  for (const ch of text) {
    items.push({ ch, x, z: baseline, size, depth: 0.2, y: PLATE_H });
    x += font.advance(ch) * size;
  }
  const geo = font.build(items);
  if (geo) {
    const tm = new THREE.Mesh(geo, toon('text', { top: TEXT_TOP, text: true }));
    tm.castShadow = true;
    plate.add(tm);
  }

  // --- extras
  const fx = [];
  const extras = look.extras || [];
  if (extras.includes('heart')) {
    const h = mesh(heartGeometry(), toon('red'), stand, [0.95, 3.15, 0.1], [-0.9, 0.2, -0.15], 0.62);
    const h2 = mesh(heartGeometry(), toon('pink'), stand, [-1.0, 2.6, 0.2], [-0.9, -0.2, 0.2], 0.36);
    fx.push((t) => {
      h.position.y = 3.15 + 0.12 * Math.sin(t * 2.4);
      h.scale.setScalar(0.62 * (1 + 0.08 * Math.max(0, Math.sin(t * 6.0))));
      h2.position.y = 2.6 + 0.1 * Math.sin(t * 2.4 + 1.7);
    });
  }
  if (extras.includes('sparkle')) {
    const ss = [[1.05, 2.85, -0.1, 0.16], [-1.1, 2.4, 0.15, 0.12], [0.75, 3.45, -0.5, 0.1]];
    const ms = ss.map(([x, y, z, s]) => mesh(starGeometry(), toon('yellow'), stand, [x, y, z], [-1.0, 0, 0.3], s));
    fx.push((t) => ms.forEach((o, i) => { o.scale.setScalar(ss[i][3] * (0.75 + 0.35 * Math.sin(t * 4 + i * 2.1))); o.rotation.z = 0.3 + t * 0.8 + i; }));
  }
  if (extras.includes('dirt')) {
    const dirt = toon('#a0703f');
    // a little heap of earth where the blade bites, and a clod flying off with each toss
    mesh(g.mound, dirt, stand, [-0.95, BASE_H, 0.95], null, [0.5, 0.26, 0.42]);
    for (const p of [[-0.45, 0.2, 1.15], [-1.3, 0.2, 0.55]]) mesh(g.dot, dirt, stand, p, null, 0.07);
    const clod = mesh(g.dot, dirt, stand, [0, 0, 0], null, 0.085);
    fx.push((t) => {
      const u = (t / 1.5) % 1, k = Math.min(1, Math.max(0, (u - 0.72) / 0.28));
      clod.visible = k > 0 && k < 1;
      clod.position.set(-1.05 - 0.6 * k, 0.75 + 0.9 * Math.sin(Math.PI * k) - 0.5 * k, 0.6 + 0.3 * k);
    });
  }
  if (extras.includes('dust')) {
    const ps = [0, 1, 2].map(() => mesh(g.puff, toon('white'), stand, [0, 0.15, -0.8], null, 0.1));
    fx.push((t) => ps.forEach((o, i) => {
      const u = ((t * 1.6 + i / 3) % 1);
      const d = 0.45 + 0.8 * u, side = (i - 1) * 0.3;
      o.position.set(-0.52 * d - 0.85 * side, BASE_H + 0.1 + 0.3 * u, -0.85 * d + 0.52 * side);
      o.scale.setScalar(0.06 + 0.2 * Math.sin(Math.PI * u));
    }));
  }
  if (extras.includes('dots')) {
    const ds = [[0.9, 2.7, 0.0, 0.07], [1.15, 3.0, -0.2, 0.1], [1.45, 3.35, -0.4, 0.14]];
    const ms = ds.map(([x, y, z, s]) => mesh(g.dot, toon('white'), stand, [x, y, z], null, s));
    fx.push((t) => ms.forEach((o, i) => o.scale.setScalar(ds[i][3] * (0.85 + 0.25 * Math.max(0, Math.sin(t * 3 - i * 0.9))))));
  }

  group.userData.chuan = chuan;
  group.userData.tick = (t, dt = 1 / 60) => {
    chuan.update(dt);
    for (const f of fx) f(t);
  };
  group.userData.pop = (k) => {
    k = Math.max(0, Math.min(1, k));
    popScale(plate, Math.min(1, k / 0.55));
    popScale(stand, Math.max(0, (k - 0.2) / 0.8));
  };
  return group;
}

export const CHUAN_STICKER_IDS = Object.keys(STICKERS).filter(id => STICKERS[id].who === 'chuan');
