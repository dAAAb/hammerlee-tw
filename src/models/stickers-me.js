// The user's own LINE-style stickers: 小新 in a pose on a small round stage, with the sticker's words as chunky
// 3D letters on a rounded plate lying flat in front. Footprint within x ∈ [-2.7, 2.7], z ∈ [-2.6, 2.4],
// height ≤ 4.5 em; origin at the centre of the footprint on the floor.
//   createMeSticker(id, font) -> THREE.Group with userData.tick(t, dt) (looping idle) and userData.pop(k)
//   (entrance, k 0 → 1; k = 1 leaves the sticker at rest scale).
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { STICKERS } from './catalog.js';
import { createMascot, setMascotPose, MASCOT_SCALE } from './mascot.js';

export const ME_STICKER_IDS = Object.keys(STICKERS).filter(id => STICKERS[id].who === 'me');
const POSE_OF = {
  m_wow: 'wow', m_love: 'love', m_clap: 'clap', m_thumb: 'thumb', m_tea: 'tea',
  m_flower: 'flower', m_laugh: 'laugh', m_ok: 'ok', m_cheer: 'cheer', m_moved: 'moved',
};

const TEXT_TOP = '#1c2442';
const PLATE_Z = 1.52, PLATE_D = 1.5, PLATE_H = 0.26, BASE_Z = -0.84, FIG_Z = -0.9, FIG_S = 1.12 / MASCOT_SCALE;

function rrShape(w, d, r) {
  r = Math.max(0.001, Math.min(r, w / 2 - 0.0005, d / 2 - 0.0005));
  const s = new THREE.Shape(), hw = w / 2, hd = d / 2;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd); s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - r); s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hd); s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + r); s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function puff(shape, h, b, segs = 3, curve = 14) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.004, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segs, curveSegments: curve, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  return g;
}
const slab = (w, d, h, r, b) => puff(rrShape(w - 2 * b, d - 2 * b, Math.max(0.001, r - b)), h, b);
function disc(r, h, b) { const s = new THREE.Shape(); s.absarc(0, 0, r - b, 0, Math.PI * 2, false); return puff(s, h, b, 3, 40); }
function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }

// shared stage pieces
let BASE = null;
function baseGeos() {
  if (!BASE) BASE = { top: disc(1.38, 0.22, 0.07), rim: disc(1.5, 0.12, 0.04) };
  return BASE;
}
const plateCache = new Map();
function plateGeos(w) {
  const k = w.toFixed(2);
  if (!plateCache.has(k)) plateCache.set(k, { top: slab(w, PLATE_D, PLATE_H, 0.55, 0.08), rim: slab(w + 0.18, PLATE_D + 0.18, PLATE_H * 0.55, 0.62, 0.05) });
  return plateCache.get(k);
}
const textCache = new Map();
function textGeo(font, text, size) {
  const key = text + '|' + size.toFixed(3);
  if (textCache.has(key)) return textCache.get(key);
  const items = [];
  let x = 0;
  for (const ch of text) { items.push({ ch, x, z: 0, size, depth: 0.2, y: PLATE_H }); x += font.advance(ch) * size; }
  const geo = font.build(items);
  if (geo) {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
  }
  textCache.set(key, geo);
  return geo;
}

const easeOutBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };

export function createMeSticker(id, font) {
  const spec = STICKERS[id] || STICKERS.m_wow;
  const pose = POSE_OF[id] || 'wow';
  const root = new THREE.Group();
  root.name = 'sticker:' + id;
  const pop = new THREE.Group(); pop.name = 'pop';
  root.add(pop);

  // round stage under 小新
  const bg = baseGeos();
  const rim = mesh(bg.rim, toon('teal')); rim.position.set(0, 0, BASE_Z); pop.add(rim);
  const top = mesh(bg.top, toon('yellow', { receive: 0.3 })); top.position.set(0, 0.02, BASE_Z); top.receiveShadow = true; pop.add(top);

  const fig = createMascot();
  setMascotPose(fig, pose);
  fig.position.set(0, 0.23, FIG_Z);
  fig.scale.setScalar(FIG_S);
  pop.add(fig);

  // the words on a plate
  const text = spec.text;
  const size = Math.min(1.05, 4.4 / Math.max(0.5, font.measure(text, 1)));
  const tg = textGeo(font, text, size);
  let tw = font.measure(text, size);
  if (tg) tw = tg.boundingBox.max.x - tg.boundingBox.min.x;
  const pw = Math.min(5.2, Math.max(2.6, tw + 1.0));
  const pg = plateGeos(pw);
  const plate = new THREE.Group(); plate.name = 'plate';
  plate.position.set(0, 0, PLATE_Z);
  pop.add(plate);
  const pr = mesh(pg.rim, toon('teal')); plate.add(pr);
  const pt = mesh(pg.top, toon('white', { receive: 0.5 })); pt.receiveShadow = true; pt.position.y = 0.02; plate.add(pt);
  if (tg) { const tm = mesh(tg, toon('text', { top: TEXT_TOP, text: true })); tm.position.y = 0.02; plate.add(tm); }

  let popK = 1;
  root.userData.pop = k => {
    popK = Math.min(1, Math.max(0, k));
    const s = Math.max(0.001, easeOutBack(popK));
    const sq = Math.sin(popK * Math.PI) * 0.22 * (1 - popK * 0.5);
    pop.scale.set(s * (1 + sq * 0.5), Math.max(0.001, s * (1 - sq)), s * (1 + sq * 0.5));
  };
  root.userData.tick = (t, dt) => {
    fig.userData.tick?.(t, dt);
  };
  root.userData.id = id;
  root.userData.pose = pose;
  return root;
}
