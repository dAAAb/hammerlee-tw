// Topic dioramas: little toy-town models that pop up in the empty floor beside the chat column when the
// conversation moves to a new topic. Each one stands on a round or rounded-square base plate (7 em across,
// 0.4 em thick), origin at the centre of the base on the floor, everything within x, z in [-4, 4] and at most
// 5 em tall. The camera looks almost straight down with a shear, so tall things sit toward the back (-z) and
// the details live on tops and +z fronts.
//
//   createScenery(id) -> THREE.Group | null
//     g.userData.tick(t, dt)   gentle looping animation (a pure function of t)
//     g.userData.pop(k)        build-up entrance, k 0 -> 1: the base plate grows first (k 0 .. 0.3), then the
//                              pieces rise from the base one after another (each takes 0.38 of k, starts spread
//                              over 0.15 .. 0.62), all exactly at rest at k = 1. About 1.2-1.5 s feels right.
//   SCENERY_IDS
//
// Each id is built once as a prototype; createScenery() hands out clones that share geometry and materials.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';

// ---------------------------------------------------------------- palettes (besides the shared PAL keys)
const P = {
  // base plates: soft paper pastels
  mint:     { l: '#effaf2', m: '#cfe8d7', d: '#86b096' },
  skyP:     { l: '#eef7fd', m: '#cbe1f2', d: '#83a5c4' },
  blush:    { l: '#fff1f0', m: '#f5d3d4', d: '#c08a90' },
  butter:   { l: '#fff8e2', m: '#f2e1b0', d: '#bea463' },
  lilac:    { l: '#f4f2fd', m: '#dbd6f3', d: '#9a94c6' },
  peach:    { l: '#fff2e6', m: '#f5d7bc', d: '#c4966c' },
  // ground
  grass:    { l: '#bde78f', m: '#90c967', d: '#4a8233' },
  grass2:   { l: '#9fd77a', m: '#76b554', d: '#3b6e28' },
  water:    { l: '#93d8f3', m: '#5db7e2', d: '#2b6d9c' },
  road:     { l: '#9da3b0', m: '#7b8190', d: '#444955' },
  walk:     { l: '#fbf3e2', m: '#e9dbbd', d: '#b29d75' },
  concrete: { l: '#ecebe6', m: '#cbc7be', d: '#8a857a' },
  clay:     { l: '#f2c08e', m: '#da9b62', d: '#85522a' },
  soil:     { l: '#a97d57', m: '#865a3b', d: '#4a2f1c' },
  mat:      { l: '#b4ece5', m: '#86d0c8', d: '#3c8b85' },
  rock:     { l: '#c9ccd3', m: '#a3a8b3', d: '#5d6370' },
  // things
  glassB:   { l: '#c3e8f9', m: '#88c7ea', d: '#3e7dab' },
  glow:     { l: '#b9ffe9', m: '#52e8c5', d: '#139c80' },
  glowHot:  { l: '#f0fffa', m: '#a6fff0', d: '#36d7b7' },
  lampOn:   { l: '#fffce6', m: '#fff1a6', d: '#e6c04a' },
  ledOff:   { l: '#3c5c80', m: '#2c4562', d: '#17283b' },
  tile:     { l: '#f5dfba', m: '#dcbb8c', d: '#8c683c' },
  maroon:   { l: '#d48a80', m: '#ae5f57', d: '#562622' },
  roofD:    { l: '#8a6f68', m: '#6b524c', d: '#3a2a26' },
  eye:      { l: '#3d3532', m: '#2b2522', d: '#171311' },
  tan:      { l: '#f8c98e', m: '#e3a05b', d: '#7e4f22' },
  ginger:   { l: '#ffc27a', m: '#f09a3e', d: '#7d4511' },
  heart:    { l: '#ff7a92', m: '#e8435f', d: '#86203a' },
  rubber:   { l: '#4b4f5c', m: '#353843', d: '#1c1e25' },
  ybike:    { l: '#ffd54d', m: '#f6a800', d: '#7a4c00' },
  dirt:     { l: '#e8b585', m: '#cc8f58', d: '#7a4a22' },
  bluePale: { l: '#d4ecff', m: '#a9d2f4', d: '#5b86b3' },
  window:   { l: '#4f7fbf', m: '#3a64a0', d: '#1d3a66' },
  brick:    { l: '#d9826a', m: '#b8604a', d: '#5e2a1d' },
  tea:      { l: '#f3c565', m: '#d79a35', d: '#7a4f12' },
};
const mat = (p, o) => toon(typeof p === 'string' ? (P[p] || p) : p, o);

// ---------------------------------------------------------------- small builders
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const H0 = 0.4;   // top of the base plate
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const yawOf = (dx, dz) => Math.atan2(-dz, dx);   // rotation.y that turns local +x toward (dx, dz)

function mesh(geo, pal, name, opts) {
  const m = new THREE.Mesh(geo, mat(pal, opts));
  m.castShadow = true;
  if (name) m.name = name;
  return m;
}
function ground(geo, pal, name) { const m = mesh(geo, pal, name, { receive: 0.5 }); m.receiveShadow = true; return m; }
function add(parent, obj, x = 0, y = 0, z = 0) { obj.position.set(x, y, z); parent.add(obj); return obj; }
function group(parent, name, x = 0, y = 0, z = 0) { const g = new THREE.Group(); if (name) g.name = name; return add(parent, g, x, y, z); }

// 2D shapes live in the floor plane: shape (x, y) = world (x, -z), so shape-up is screen-up.
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
function circleShape(r) { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false); return s; }
function ellipseShape(rx, rz) { const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, TAU, false); return s; }
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }
function heartShape(w) {
  const s = new THREE.Shape(), k = w / 32, N = 48;
  for (let i = 0; i < N; i++) {
    const t = i / N * TAU;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    i ? s.lineTo(x * k, (y + 2.5) * k) : s.moveTo(x * k, (y + 2.5) * k);
  }
  return s;
}
function sparkShape(R, c) {
  const s = new THREE.Shape();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 + i * Math.PI / 2, a2 = a + Math.PI / 4, a3 = a + Math.PI / 2;
    if (!i) s.moveTo(R * Math.cos(a), R * Math.sin(a));
    s.quadraticCurveTo(c * Math.cos(a2), c * Math.sin(a2), R * Math.cos(a3), R * Math.sin(a3));
  }
  return s;
}
function crossShape(L, t) {
  const a = L / 2, b = t / 2;
  return polyShape([[-b, a], [b, a], [b, b], [a, b], [a, -b], [b, -b], [b, -a], [-b, -a], [-b, -b], [-a, -b], [-a, b], [-b, b]]);
}
// thick polyline (world x/z points) as a closed shape, mitred joints
function strokeShape(pts, hw) {
  const P2 = pts.map(([x, z]) => new THREE.Vector2(x, -z));
  const L = [], R = [];
  for (let i = 0; i < P2.length; i++) {
    const p = P2[i];
    const a = P2[Math.max(0, i - 1)], b = P2[Math.min(P2.length - 1, i + 1)];
    let n, k = 1;
    if (i === 0 || i === P2.length - 1) {
      const d = b.clone().sub(a).normalize(); n = new THREE.Vector2(-d.y, d.x);
    } else {
      const d1 = p.clone().sub(a).normalize(), d2 = b.clone().sub(p).normalize();
      const t = d1.clone().add(d2).normalize(); n = new THREE.Vector2(-t.y, t.x);
      k = 1 / Math.max(0.3, n.dot(new THREE.Vector2(-d1.y, d1.x)));
    }
    L.push(p.clone().addScaledVector(n, hw * k)); R.push(p.clone().addScaledVector(n, -hw * k));
  }
  return polyShape([...L, ...R.reverse()].map(v => [v.x, v.y]));
}
// the strip of a circle of radius R between world z0 and z1 (roads that end at the plate rim)
function bandInCircle(R, z0, z1, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; pts.push([-Math.sqrt(R * R - z * z), -z]); }
  for (let i = n; i >= 0; i--) { const z = z0 + (z1 - z0) * i / n; pts.push([Math.sqrt(R * R - z * z), -z]); }
  return polyShape(pts);
}
// stadium (two straights along x joined by half circles) as a path; shape coords (y = -z)
function stadiumPath(p, a, r) {
  p.moveTo(-a, -r); p.lineTo(a, -r); p.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(-a, r); p.absarc(-a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return p;
}
function stadiumBand(a, r0, r1) { const s = stadiumPath(new THREE.Shape(), a, r1); s.holes.push(stadiumPath(new THREE.Path(), a, r0)); return s; }

// Extrude a floor shape upward from y = 0 to y = h with a rounded (bevelled) rim. The bevel grows the outline by b.
function puff(shape, h, b = 0.05, segs = 2, curve = 12) {
  b = Math.min(b, h * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, h - 2 * b), bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b,
    bevelSegments: segs, curveSegments: curve, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  return g;
}
// Rounded slab with an exact w (x) by d (z) footprint, from y = 0 to h.
function slab(w, d, h, r = 0.06, b = 0.03) { b = Math.min(b, h * 0.45); return puff(rrShape(w - 2 * b, d - 2 * b, Math.max(0.001, r - b)), h, b); }
// Extrude a side profile (x right, y up) along z, centred on z = 0, total thickness `depth`.
function prism(shape, depth, b = 0.03, segs = 2, curve = 10) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, depth - 2 * b), bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b,
    bevelSegments: segs, curveSegments: curve, steps: 1,
  });
  g.translate(0, 0, -depth / 2 + b);
  return g;
}
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);              // bottom at y = 0
const cylG = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
const discZ = (r, t, seg = 16) => new THREE.CylinderGeometry(r, r, t, seg).rotateX(Math.PI / 2);   // faces +z
function ell(rx, ry, rz, w = 16, h = 12) { return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz); }
function dome(r, h, seg = 18) { return new THREE.SphereGeometry(1, seg, Math.ceil(seg / 3) + 2, 0, TAU, 0, Math.PI / 2).scale(r, h, r); }
const ringG = (R, tube, seg = 28) => new THREE.TorusGeometry(R, tube, 6, seg).rotateX(Math.PI / 2);  // lies flat
function rod(parent, a, b, r, pal, seg = 8) {
  const d = b.clone().sub(a), len = d.length();
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), pal);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(m);
  return m;
}
// a flat band from a to b whose broad face turns as far up as it can (cables that read from above)
function strip(parent, a, b, w, th, pal) {
  const d = b.clone().sub(a), len = d.length(); d.normalize();
  const n = UP.clone().addScaledVector(d, -UP.dot(d)).normalize();
  const x = new THREE.Vector3().crossVectors(d, n);
  const m = mesh(new THREE.BoxGeometry(w, len, th), pal);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, n));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  parent.add(m);
  return m;
}
function arcBandShape(r0, r1, a0, a1) { const s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true); return s; }
function capsule(parent, a, b, r, pal, seg = 10) {
  const d = b.clone().sub(a), len = d.length();
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg), pal);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(m);
  return m;
}
function stroke(parent, pts, r, pal, seg = 0) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const g = new THREE.Group();
  g.add(mesh(new THREE.TubeGeometry(curve, seg || Math.max(8, pts.length * 6), r, 6, false), pal));
  const cap = new THREE.SphereGeometry(r, 8, 6);
  add(g, mesh(cap, pal), pts[0].x, pts[0].y, pts[0].z);
  const e = pts[pts.length - 1];
  add(g, mesh(cap, pal), e.x, e.y, e.z);
  parent.add(g);
  return g;
}

// geometry shared across dioramas
const GEO = new Map();
const once = (key, make) => { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); };

// A round lollipop tree. Its crown can be named for a sway.
function tree(parent, x, z, s = 1, crownName, pal = 'leaf', y = 0) {
  const t = group(parent, null, x, y, z);
  const inner = group(t); inner.scale.setScalar(s);
  add(inner, mesh(once('trunk', () => cylG(0.09, 0.13, 0.62, 10)), 'wood'));
  const c = group(inner, crownName, 0, 0.55, 0);
  add(c, mesh(once('crownA', () => ell(0.5, 0.46, 0.5, 18, 12)), pal), 0, 0.4, 0);
  add(c, mesh(once('crownB', () => ell(0.34, 0.31, 0.34, 14, 10)), pal), -0.32, 0.22, 0.18);
  add(c, mesh(once('crownC', () => ell(0.3, 0.28, 0.3, 14, 10)), pal), 0.3, 0.28, 0.16);
  return t;
}
function bush(parent, x, z, s = 1, pal = 'leaf', y = 0) {
  const b = add(parent, mesh(once('bush', () => ell(0.26, 0.2, 0.24, 14, 10).translate(0, 0.12, 0)), pal), x, y, z);
  b.scale.setScalar(s);
  return b;
}
function flower(parent, x, z, petal, name, y = 0, s = 1) {
  const f = group(parent, name, x, y, z);
  const inner = group(f); inner.scale.setScalar(s);
  add(inner, mesh(once('stem', () => cylG(0.022, 0.022, 0.22, 6)), 'leaf'));
  add(inner, mesh(once('leafS', () => ell(0.09, 0.025, 0.045, 10, 6)), 'leaf'), 0.07, 0.07, 0).rotation.z = 0.4;
  const pg = once('petal', () => ell(0.07, 0.035, 0.07, 10, 8));
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; add(inner, mesh(pg, petal), Math.sin(a) * 0.075, 0.24, Math.cos(a) * 0.075); }
  add(inner, mesh(once('fcore', () => new THREE.SphereGeometry(0.05, 10, 8)), 'yellow'), 0, 0.265, 0);
  return f;
}

// ---------------------------------------------------------------- base plate and pop pieces
function plate(G, kind, pal) {
  const base = group(G, 'base');
  const b = 0.12;
  const shape = kind === 'round' ? circleShape(3.5 - b) : rrShape(7 - 2 * b, 7 - 2 * b, 1.2 - b);
  add(base, ground(puff(shape, H0, b, 3, 24), pal));
  return base;
}
// thin layer lying on the base top (lawns, roads, water)
function lay(base, shape, h, pal, x = 0, z = 0, y = H0) {
  return add(base, ground(puff(shape, h, Math.min(0.03, h * 0.4), 2, 16), pal), x, y, z);
}
// A piece of the diorama that rises from the base during the entrance. Its origin is its foot.
let popSlot = 0;
function piece(parent, x = 0, z = 0, y = H0, slot) {
  const g = group(parent, null, x, y, z);
  g.userData.popI = slot ?? popSlot++;
  return g;
}

// ---------------------------------------------------------------- the dioramas
const DEFS = {};
function def(id, base, build, tick) { DEFS[id] = { base, build, tick }; }

// --- 輝達: a glass-and-white AI headquarters on a lawn, a glowing chip floating on the roof
def('nvidia', ['round', 'mint'], (G, B) => {
  lay(B, circleShape(3.2), 0.08, 'grass');
  lay(B, rrShape(5.0, 0.75, 0.35), 0.12, 'walk', 0, 0.55);
  lay(B, rrShape(0.95, 2.4, 0.3), 0.12, 'walk', 0, 1.95);
  const hq = piece(G, 0, -1.05);
  add(hq, mesh(slab(4.8, 2.3, 0.14, 0.32), 'white'));
  const mg = boxG(0.06, 0.5, 0.05);
  for (let i = 0; i < 3; i++) {
    const w = 4.4 - 0.5 * i, d = 2.0 - 0.3 * i, z = -0.15 * i, y = 0.14 + i * 0.64;
    add(hq, mesh(slab(w - 0.22, d - 0.22, 0.5, 0.24), 'glassB'), 0, y, z);
    add(hq, mesh(slab(w, d, 0.14, 0.32), 'white'), 0, y + 0.5, z);
    const n = Math.floor((w - 0.7) / 0.42);
    for (let k = 0; k <= n; k++) {
      const x = -n * 0.42 / 2 + k * 0.42;
      if (i === 0 && Math.abs(x) < 0.5) continue;   // keep the doorway clear
      add(hq, mesh(mg, 'white'), x, y, z + (d - 0.22) / 2);
    }
  }
  // entrance: glass doors under a white canopy
  add(hq, mesh(boxG(0.8, 0.42, 0.04), 'navy'), 0, 0.14, 0.9);
  add(hq, mesh(slab(1.5, 0.62, 0.07, 0.1), 'white'), 0, 0.56, 1.15);
  for (const s of [-1, 1]) add(hq, mesh(cylG(0.035, 0.035, 0.42, 8), 'white'), s * 0.62, 0.14, 1.36);
  // the roof: a pedestal and a floating chip with breathing rings
  const roofY = 0.14 + 2 * 0.64 + 0.64;
  add(hq, mesh(slab(1.6, 1.2, 0.1, 0.2), 'navy'), 0, roofY, -0.3);
  const fl = group(hq, 'float', 0, roofY + 0.28, -0.3);
  const chip = group(fl, 'chip');
  add(chip, mesh(slab(1.1, 1.1, 0.16, 0.1), 'dark'));
  const pin = boxG(0.09, 0.05, 0.16);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2;
    for (let k = -2; k <= 2; k++) {
      const u = k * 0.19, r = 0.6;
      const m = add(chip, mesh(pin, 'gold'), Math.cos(a) * r - Math.sin(a) * u, 0.05, Math.sin(a) * r + Math.cos(a) * u);
      m.rotation.y = -a + Math.PI / 2;
    }
  }
  add(chip, mesh(slab(0.68, 0.68, 0.09, 0.08), 'glow', 'die'), 0, 0.15, 0);
  add(chip, mesh(slab(0.3, 0.3, 0.05, 0.05), 'glowHot'), 0, 0.23, 0);
  add(fl, mesh(ringG(0.86, 0.04), 'glow', 'ring0'), 0, 0.08, 0);
  add(fl, mesh(ringG(1.08, 0.035), 'teal', 'ring1'), 0, 0.08, 0);
  // garden
  const gd = piece(G, 0, 0);
  for (const x of [-2.3, -1.7, -1.1, 1.1, 1.7, 2.3]) bush(gd, x, 0.25, 0.9, 'grass2', 0.08);
  tree(piece(G, -2.7, 0.9), 0, 0, 0.95, 'tc0');
  tree(piece(G, 2.75, 0.75), 0, 0, 1.05, 'tc1');
  tree(piece(G, -1.95, 2.3), 0, 0, 0.75, 'tc2');
  tree(piece(G, 2.05, 2.3), 0, 0, 0.8, 'tc3');
}, (o, list) => {
  const fl = o('float'), chip = o('chip'), die = o('die'), r0 = o('ring0'), r1 = o('ring1'), crowns = list('tc');
  const y0 = fl.position.y;
  const cool = mat('glow'), hot = mat('glowHot');
  return t => {
    fl.position.y = y0 + 0.06 * Math.sin(t * 1.8);
    chip.rotation.y = 0.3 * Math.sin(t * 0.6);
    const p = Math.sin(t * 2.4);
    die.material = p > 0.45 ? hot : cool;
    die.scale.y = 1 + 0.6 * Math.max(0, p);
    r0.scale.setScalar(1 + 0.08 * p);
    r1.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4 - 1.4));
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.3 + i * 1.7); });
  };
});

// --- AI 科技廊帶: 蘆社大橋 over the river, server towers on the west bank, a factory east, a drone circling
def('ai', ['square', 'skyP'], (G, B) => {
  lay(B, rrShape(3.4, 6.76, 0.3), 0.06, 'water');
  lay(B, rrShape(2.5, 6.76, 1.0), 0.22, 'walk', -2.1, 0);
  lay(B, rrShape(2.5, 6.76, 1.0), 0.22, 'grass', 2.1, 0);
  const wv = once('wave', () => ell(0.2, 0.04, 0.06, 10, 6));
  [[0.1, -2.4], [-0.25, -0.7], [0.3, 2.2], [-0.2, 3.0]].forEach(([x, z], i) => add(B, mesh(wv, 'white', 'wv' + i), x, H0 + 0.05, z));
  const yb = H0 + 0.22;
  // server towers
  const sv = piece(G, -2.15, -1.4, yb);
  const stripG = boxG(0.3, 0.06, 0.04), led = boxG(0.08, 0.08, 0.04);
  const fanBlade = boxG(0.15, 0.02, 0.07).translate(0.075, 0, 0);
  let n = 0;
  [1.35, 1.8, 1.15].forEach((h, i) => {
    const x = (i - 1) * 0.66;
    add(sv, mesh(slab(0.58, 0.9, h, 0.08), 'navy'), x, 0, 0);
    add(sv, mesh(slab(0.46, 0.76, 0.04, 0.06), 'metal'), x, h, 0);
    add(sv, mesh(once('fanHole', () => cylG(0.16, 0.16, 0.03, 16)), 'dark'), x, h + 0.04, -0.12);
    const fan = group(sv, 'fan' + i, x, h + 0.06, -0.12);
    for (let b = 0; b < 3; b++) add(fan, mesh(fanBlade, 'metal')).rotation.y = b * TAU / 3;
    add(fan, mesh(once('fanHub', () => cylG(0.045, 0.045, 0.04, 10)), 'teal'));
    const rows = Math.floor((h - 0.15) / 0.24);
    for (let j = 0; j < rows; j++) {
      const y = 0.15 + j * 0.24;
      add(sv, mesh(stripG, 'teal'), x - 0.06, y, 0.45);
      add(sv, mesh(led, 'glow', 'led' + n++), x + 0.18, y - 0.01, 0.45);
    }
  });
  // factory with a sawtooth roof
  const fa = piece(G, 2.15, -1.6, yb);
  add(fa, mesh(slab(2.0, 1.3, 0.6, 0.06), 'white'));
  const tooth = prism(polyShape([[0, 0], [0.62, 0], [0, 0.36]]), 1.26, 0.02);
  for (let k = 0; k < 3; k++) {
    add(fa, mesh(tooth, 'blue'), -0.93 + k * 0.64, 0.6, 0);
    add(fa, mesh(boxG(0.03, 0.28, 1.1), 'glassB'), -0.95 + k * 0.64, 0.62, 0);
  }
  add(fa, mesh(boxG(0.42, 0.36, 0.04), 'navy'), 0.45, 0, 0.65);
  for (const x of [-0.65, -0.2]) add(fa, mesh(boxG(0.28, 0.2, 0.04), 'sky'), x, 0.28, 0.65);
  // the bridge: deck, piers, an H pylon in the river and a fan of yellow stays
  const br = piece(G, 0, 0.95);
  add(br, mesh(slab(6.7, 0.9, 0.16, 0.06), 'white'), 0, 0.64, 0);
  add(br, mesh(slab(6.6, 0.66, 0.03, 0.04), 'road'), 0, 0.8, 0);
  for (const s of [-1, 1]) {
    add(br, mesh(slab(0.5, 0.74, 0.42, 0.05), 'concrete'), s * 2.85, 0.22, 0);
    add(br, mesh(cylG(0.12, 0.12, 0.42, 12), 'concrete'), s * 1.7, 0.22, 0);
  }
  add(br, mesh(cylG(0.2, 0.26, 0.66, 12), 'concrete'), 0, 0, 0);
  add(br, mesh(slab(0.22, 0.18, 2.1, 0.05), 'white'), 0, 0.8, 0);
  add(br, mesh(slab(0.26, 0.24, 0.24, 0.06), 'teal'), 0, 2.86, 0);
  const hs = [2.0, 2.3, 2.6], xs = [2.45, 1.65, 0.9];
  for (const d of [-1, 1]) for (let k = 0; k < 3; k++) strip(br, v3(0, hs[2 - k], 0), v3(d * xs[k], 0.84, 0), 0.11, 0.03, 'yellow');
  // two little cars crossing
  for (let i = 0; i < 2; i++) {
    const c = group(br, 'car' + i, 0, 0.83, i ? -0.19 : 0.19);
    const body = group(c); if (i) body.rotation.y = Math.PI;
    add(body, mesh(slab(0.46, 0.24, 0.12, 0.06), i ? 'yellow' : 'teal'), 0, 0.02, 0);
    add(body, mesh(slab(0.24, 0.2, 0.1, 0.06), 'glassB'), -0.04, 0.13, 0);
  }
  // trees on the banks
  tree(piece(G, -2.45, 2.35, yb), 0, 0, 0.8, 'tc0');
  tree(piece(G, 1.75, 2.45, yb), 0, 0, 0.75, 'tc1');
  tree(piece(G, 2.75, 2.0, yb), 0, 0, 0.9, 'tc2');
  // the drone (mover -> pop piece -> body)
  const dr = group(G, 'drone', 1.2, 2.5, -0.6);
  const dsc = group(piece(dr, 0, 0, 0)); dsc.scale.setScalar(1.3);
  const body = group(dsc, 'dbody');
  add(body, mesh(slab(0.36, 0.36, 0.13, 0.1), 'white'), 0, -0.06, 0);
  add(body, mesh(dome(0.13, 0.09, 14), 'teal'), 0, 0.06, 0);
  add(body, mesh(new THREE.SphereGeometry(0.05, 10, 8), 'dark'), 0.19, -0.02, 0);
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(body, mesh(boxG(0.88, 0.05, 0.06), 'dark'), 0, -0.02, 0).rotation.y = a;
  const blade = boxG(0.34, 0.015, 0.06), guard = ringG(0.19, 0.025, 20);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], k) => {
    const x = sx * 0.31, z = sz * 0.31;
    add(body, mesh(once('hub', () => cylG(0.04, 0.04, 0.08, 8)), 'dark'), x, -0.03, z);
    add(body, mesh(guard, 'teal'), x, 0.03, z);
    const r = group(body, 'rot' + k, x, 0.06, z);
    add(r, mesh(blade, 'metal'));
  });
  for (const s of [-1, 1]) add(body, mesh(boxG(0.36, 0.04, 0.04), 'dark'), 0, -0.16, s * 0.12);
}, (o, list) => {
  const dr = o('drone'), body = o('dbody'), rots = list('rot'), fans = list('fan'), leds = list('led');
  const cars = list('car'), waves = list('wv'), crowns = list('tc');
  const on = [mat('glow'), mat('yellow'), mat('ledOff')];
  return t => {
    const th = 0.7 * t;
    dr.position.set(0.3 + 0.9 * Math.cos(th), 2.5 + 0.1 * Math.sin(2 * th), -0.6 + 0.45 * Math.sin(th));
    dr.rotation.y = yawOf(-Math.sin(th) * 0.9, Math.cos(th) * 0.45);
    body.rotation.x = -0.12;
    rots.forEach((r, k) => { r.rotation.y = t * (k % 2 ? 24 : -24) + k; });
    fans.forEach((f, k) => { f.rotation.y = t * 6 + k; });
    leds.forEach((l, k) => {
      const s = Math.sin(t * (2.2 + (k * 0.37) % 1.3) + k * 2.1);
      l.material = s > 0.3 ? on[0] : s > -0.4 ? on[1] : on[2];
    });
    cars.forEach((c, i) => {
      const u = ((0.75 * t + i * 3.1) % 6.2 + 6.2) % 6.2;
      const x = i ? 3.1 - u : -3.1 + u;
      c.position.x = x;
      const s = Math.max(1e-3, Math.min(1, smooth((x + 3.1) / 0.4), smooth((3.1 - x) / 0.4)));
      c.scale.setScalar(s);
    });
    waves.forEach((w, i) => { const k = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9); w.scale.set(0.6 + 0.5 * k, 1, 1); });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 醫療: a friendly hospital with red crosses, an ambulance going round the drop-off loop, a tree
def('medical', ['round', 'blush'], (G, B) => {
  const ring = new THREE.Shape(); ring.absellipse(0, 0, 2.55, 1.05, 0, TAU, false);
  const hole = new THREE.Path(); hole.absellipse(0, 0, 1.72, 0.38, 0, TAU, true); ring.holes.push(hole);
  lay(B, ring, 0.06, 'road', 0, 1.75);
  lay(B, ellipseShape(1.62, 0.3), 0.12, 'grass', 0, 1.75);
  lay(B, rrShape(1.15, 1.3, 0.25), 0.08, 'walk', 0, 0.2);
  lay(B, circleShape(0.95), 0.07, 'grass', -2.5, -0.25);
  lay(B, circleShape(0.6), 0.07, 'grass', 2.65, 0.5);
  const fd = once('fdot', () => ell(0.09, 0.07, 0.09, 10, 8));
  [[-1.1, 'pink'], [-0.55, 'yellow'], [0, 'pink'], [0.55, 'yellow'], [1.1, 'pink']].forEach(([x, p]) => add(B, mesh(fd, p), x, H0 + 0.12, 1.75));
  // hospital
  const hp = piece(G, 0, -1.3);
  add(hp, mesh(slab(3.6, 1.6, 2.0, 0.14), 'white'));
  add(hp, mesh(slab(3.7, 1.7, 0.1, 0.16), 'paper'), 0, 2.0, 0);
  const wg = boxG(0.3, 0.26, 0.04);
  for (const y of [0.78, 1.18, 1.58]) for (const x of [-1.4, -0.95, -0.5, 0.5, 0.95, 1.4]) add(hp, mesh(wg, 'sky'), x, y, 0.8);
  add(hp, mesh(boxG(3.4, 0.1, 0.04), 'coral'), 0, 0.6, 0.8);
  add(hp, mesh(prism(crossShape(0.56, 0.19), 0.08, 0.02), 'red'), 0, 1.3, 0.82);
  add(hp, mesh(cylG(0.62, 0.62, 0.06, 24), 'white'), 0, 2.1, -0.05);
  add(hp, mesh(puff(crossShape(0.84, 0.28), 0.1, 0.03), 'red'), 0, 2.15, -0.05);
  for (const x of [-1.35, 1.3]) add(hp, mesh(slab(0.4, 0.34, 0.2, 0.05), 'metal'), x, 2.1, -0.4);
  add(hp, mesh(boxG(0.8, 0.46, 0.04), 'glassB'), 0, 0, 0.8);
  add(hp, mesh(slab(1.4, 0.6, 0.08, 0.1), 'teal'), 0, 0.5, 1.0);
  for (const s of [-1, 1]) add(hp, mesh(cylG(0.035, 0.035, 0.5, 8), 'white'), s * 0.6, 0, 1.22);
  add(hp, mesh(slab(1.0, 1.2, 1.2, 0.12), 'white'), 2.28, 0, 0.1);
  for (const y of [0.5, 0.88]) for (const x of [2.05, 2.5]) add(hp, mesh(wg, 'sky'), x, y, 0.7);
  // trees
  tree(piece(G, -2.5, -0.25), 0, 0, 1.05, 'tc0');
  tree(piece(G, 2.65, 0.5), 0, 0, 0.7, 'tc1');
  // ambulance (mover -> pop piece -> model, forward +x)
  const am = group(G, 'amb', 2.15, H0 + 0.06, 1.75);
  const ap = piece(am, 0, 0, 0);
  add(ap, mesh(slab(0.74, 0.54, 0.5, 0.08), 'white'), -0.13, 0.1, 0);
  add(ap, mesh(slab(0.32, 0.52, 0.36, 0.09), 'white'), 0.37, 0.1, 0);
  add(ap, mesh(boxG(0.06, 0.15, 0.44), 'glassB'), 0.51, 0.27, 0);
  add(ap, mesh(boxG(0.18, 0.14, 0.54), 'glassB'), 0.37, 0.28, 0);
  add(ap, mesh(boxG(1.04, 0.08, 0.56), 'red'), 0.03, 0.2, 0);
  add(ap, mesh(puff(crossShape(0.3, 0.1), 0.04, 0.012), 'red'), -0.15, 0.6, 0);
  add(ap, mesh(boxG(0.1, 0.08, 0.15), 'red', 'lt0'), 0.15, 0.6, -0.09);
  add(ap, mesh(boxG(0.1, 0.08, 0.15), 'blue', 'lt1'), 0.15, 0.6, 0.09);
  const wh = once('wheelZ', () => discZ(0.1, 0.07, 14));
  for (const x of [-0.3, 0.3]) for (const z of [-0.26, 0.26]) add(ap, mesh(wh, 'rubber'), x, 0.1, z);
}, (o, list) => {
  const am = o('amb'), l0 = o('lt0'), l1 = o('lt1'), crowns = list('tc');
  const red = mat('red'), blue = mat('blue'), white = mat('white');
  return t => {
    const th = 0.5 * t;
    am.position.x = 2.15 * Math.cos(th);
    am.position.z = 1.75 + 0.715 * Math.sin(th);
    am.rotation.y = yawOf(-2.15 * Math.sin(th), 0.715 * Math.cos(th));
    const ph = Math.floor(t * 4) % 2;
    l0.material = ph ? red : white;
    l1.material = ph ? white : blue;
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 軌道建設: an elevated loop viaduct with a two-car train gliding round, a station on the back straight
const RA = 1.35, RR = 1.45, RL = 4 * RA + 2 * Math.PI * RR;
function railAt(s) {
  s = ((s % RL) + RL) % RL;
  if (s < 2 * RA) return [-RA + s, RR, 1, 0];
  s -= 2 * RA;
  if (s < Math.PI * RR) { const f = s / RR; return [RA + RR * Math.sin(f), RR * Math.cos(f), Math.cos(f), -Math.sin(f)]; }
  s -= Math.PI * RR;
  if (s < 2 * RA) return [RA - s, -RR, -1, 0];
  s -= 2 * RA;
  const f = s / RR; return [-RA - RR * Math.sin(f), -RR * Math.cos(f), -Math.cos(f), Math.sin(f)];
}
def('rail', ['round', 'mint'], (G, B) => {
  lay(B, stadiumPath(new THREE.Shape(), RA, RR - 0.5), 0.06, 'grass');
  lay(B, bandInCircle(3.32, 2.3, 2.9), 0.05, 'road');
  for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) lay(B, rrShape(0.42, 0.08, 0.03), 0.07, 'white', x, 2.6);
  // viaduct
  const vd = piece(G, 0, 0);
  const deckY = 0.8;
  add(vd, mesh(puff(stadiumBand(RA, RR - 0.36, RR + 0.36), 0.2, 0.04, 2, 16), 'concrete'), 0, deckY, 0);
  add(vd, mesh(puff(stadiumBand(RA, RR - 0.22, RR + 0.22), 0.04, 0.012, 1, 16), 'road'), 0, deckY + 0.2, 0);
  const pier = once('pier', () => cylG(0.12, 0.14, deckY, 12));
  for (let k = 0; k < 10; k++) { const [x, z] = railAt(k * RL / 10 + 0.4); add(vd, mesh(pier, 'concrete'), x, 0, z); }
  // station on the back straight: platform, yellow edge, canopy on white posts
  const st = piece(G, 0, -(RR + 0.36 + 0.28));
  add(st, mesh(slab(2.2, 0.5, 0.8, 0.06), 'white'), 0, 0, -0.02);
  for (const x of [-0.6, 0.2]) add(st, mesh(boxG(0.32, 0.36, 0.04), 'glassB'), x, 0.1, 0.24);
  add(st, mesh(slab(2.5, 0.56, 0.2, 0.06), 'walk'), 0, deckY, 0);
  add(st, mesh(boxG(2.4, 0.02, 0.07), 'yellow'), 0, deckY + 0.2, 0.22);
  for (const x of [-1.0, 0, 1.0]) add(st, mesh(cylG(0.04, 0.04, 0.75, 8), 'white'), x, deckY + 0.2, -0.12);
  add(st, mesh(prism(arcBandShape(0.95, 1.06, Math.PI * 0.34, Math.PI * 0.66), 2.8, 0.025, 2, 16).rotateY(Math.PI / 2), 'teal'), 0, deckY - 0.04, -0.12);
  // trees in the middle of the loop and outside
  tree(piece(G, -0.55, 0.05), 0, 0, 0.62, 'tc0');
  tree(piece(G, 0.7, -0.1), 0, 0, 0.5, 'tc1');
  const bs = piece(G, 0.05, 0.35);
  bush(bs, 0, 0, 0.8, 'grass2', 0.06); bush(bs, 0.3, 0.1, 0.6, 'grass2', 0.06);
  // the train: two cars, each mover -> pop piece -> body (forward +x)
  for (let i = 0; i < 2; i++) {
    const car = group(G, 'car' + i, 0, H0 + deckY + 0.24, 0);
    const cp = piece(car, 0, 0, 0);
    add(cp, mesh(prism(carProfile(i === 0 ? 0.2 : 0.05, i === 1 ? 0.2 : 0.05), 0.46, 0.03), 'white'), 0, 0.06, 0);
    add(cp, mesh(boxG(1.0, 0.14, 0.48), 'navy'), 0, 0.32, 0);
    add(cp, mesh(boxG(1.06, 0.06, 0.48), 'blue'), 0, 0.18, 0);
    add(cp, mesh(boxG(0.8, 0.03, 0.14), 'teal'), 0, 0.56, 0);
    add(cp, mesh(slab(0.28, 0.26, 0.06, 0.05), 'metal'), i ? 0.12 : -0.12, 0.56, 0);
    for (const x of [-0.32, 0.32]) add(cp, mesh(boxG(0.26, 0.07, 0.36), 'rubber'), x, 0, 0);
    add(cp, mesh(new THREE.SphereGeometry(0.04, 8, 6), 'yellow'), i ? -0.56 : 0.56, 0.18, 0.13);
  }
}, (o, list) => {
  const cars = list('car'), crowns = list('tc');
  const sSt = 3 * RA + Math.PI * RR;
  return t => {
    const u = (t / 11) % 1;
    const s = sSt + RL * (u - 0.88 / TAU * Math.sin(TAU * u));
    cars.forEach((c, i) => {
      const [x, z, dx, dz] = railAt(s + (i ? -0.58 : 0.58));
      c.position.x = x; c.position.z = z;
      c.rotation.y = yawOf(dx, dz);
    });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});
function carProfile(front, back) {
  const x0 = -0.55, x1 = 0.55, y0 = 0.0, y1 = 0.5, s = new THREE.Shape();
  const bl = 0.05, br = 0.05, tr = front, tl = back;
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0); s.absarc(x1 - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - tr); s.absarc(x1 - tr, y1 - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y1); s.absarc(x0 + tl, y1 - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl); s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}

// --- 巨蛋城: an open-roof dome with a baseball diamond inside, pulsing flood lights, chasing rim bulbs, flags
def('domecity', ['round', 'skyP'], (G, B) => {
  const R = 2.45, sy = 0.68, yEq = 0.32, th0 = Math.asin(1.4 / R);
  const rimY = yEq + R * Math.cos(th0) * sy;
  lay(B, circleShape(2.36), 0.06, 'grass');
  // the diamond: dirt square, grass infield, bases, mound (seen through the opening)
  const dm = new THREE.Group(); dm.position.set(-0.15, H0, -0.85); dm.rotation.y = Math.PI / 4; B.add(dm);
  add(dm, ground(puff(rrShape(1.05, 1.05, 0.1), 0.1, 0.02), 'dirt'));
  add(dm, ground(puff(rrShape(0.66, 0.66, 0.06), 0.12, 0.02), 'grass2'));
  const bg = once('base4', () => boxG(0.14, 0.14, 0.14));
  for (const [x, z] of [[0.48, 0.48], [0.48, -0.48], [-0.48, -0.48], [-0.48, 0.48]]) add(dm, mesh(bg, 'white'), x, 0, z).rotation.y = 0;
  add(dm, mesh(cylG(0.14, 0.17, 0.15, 14), 'dirt'), 0, 0, 0);
  // the dome
  const dc = piece(G, 0, 0);
  add(dc, mesh(new THREE.CylinderGeometry(R, R, yEq, 36, 1, true).translate(0, yEq / 2, 0), 'glassB', null, { side: 2 }));
  const shell = new THREE.SphereGeometry(R, 36, 7, 0, TAU, th0, Math.PI / 2 - th0).scale(1, sy, 1).translate(0, yEq, 0);
  add(dc, mesh(shell, 'white', null, { side: 2 }));
  add(dc, mesh(ringG(1.4, 0.11, 36), 'navy'), 0, rimY, 0);
  add(dc, mesh(ringG(R + 0.02, 0.06, 40), 'blue'), 0, yEq, 0);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + 0.13, pts = [];
    for (let k = 0; k <= 6; k++) {
      const th = th0 + (Math.PI / 2 - th0) * k / 6;
      const r = R * Math.sin(th) + 0.025;
      pts.push(v3(r * Math.cos(a), yEq + (R * Math.cos(th) + 0.025) * sy, r * Math.sin(a)));
    }
    stroke(dc, pts, 0.035, 'blue', 18);
  }
  const bulb = once('bulb', () => new THREE.SphereGeometry(0.08, 10, 8));
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; add(dc, mesh(bulb, 'gold', 'bulb' + i), 1.4 * Math.cos(a), rimY + 0.1, 1.4 * Math.sin(a)); }
  // entrance canopy at the front
  add(dc, mesh(slab(1.1, 0.5, 0.45, 0.1), 'blue'), 0, 0, R - 0.08);
  add(dc, mesh(boxG(0.7, 0.28, 0.04), 'navy'), 0, 0, R + 0.18);
  // flood light masts
  [[-2.3, -2.4], [2.3, -2.4]].forEach(([x, z], i) => {
    const m = piece(G, x, z);
    add(m, mesh(once('mast', () => cylG(0.06, 0.08, 2.5, 8)), 'metal'));
    const head = group(m, 'lamp' + i, 0, 2.5, 0);
    head.rotation.set(0.3, Math.atan2(-x, -z), 0, 'YXZ');
    add(head, mesh(slab(0.82, 0.18, 0.5, 0.06), 'navy'), 0, -0.22, -0.02);
    add(head, mesh(boxG(0.7, 0.38, 0.05), 'lampOn', 'lface' + i), 0, -0.16, 0.08);
    for (const x2 of [-0.22, 0, 0.22]) add(head, mesh(once('lbulb', () => ell(0.08, 0.08, 0.04, 10, 8)), 'white'), x2, 0.03, 0.11);
  });
  // flags along the front
  const pole = once('fpole', () => cylG(0.025, 0.025, 1.05, 6));
  const pen = prism(polyShape([[0, 0], [0.5, 0.14], [0, 0.28]]), 0.04, 0.012);
  const fc = ['blue', 'teal', 'yellow', 'navy'];
  [-52, -31, -10, 10, 31, 52].forEach((deg, i) => {
    const a = deg * Math.PI / 180, x = 3.0 * Math.sin(a), z = 3.0 * Math.cos(a);
    const f = piece(G, x, z);
    add(f, mesh(pole, 'white'));
    const fg = group(f, 'flag' + i, 0, 0.74, 0);
    add(fg, mesh(pen, fc[i % 4]));
  });
}, (o, list) => {
  const bulbs = list('bulb'), heads = list('lamp'), faces = list('lface'), flags = list('flag');
  const lit = mat('lampOn'), dim = mat('gold'), warm = mat('yellow');
  return t => {
    const step = Math.floor(t * 6);
    bulbs.forEach((b, i) => { b.material = (i + step) % 4 === 0 ? lit : (i + step) % 4 === 1 ? warm : dim; });
    heads.forEach((h, i) => {
      const p = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.8);
      h.scale.setScalar(1 + 0.12 * p);
      faces[i].material = p > 0.45 ? lit : warm;
    });
    flags.forEach((f, i) => {
      f.rotation.y = -0.25 + 0.35 * Math.sin(t * 2.6 + i * 1.1);
      f.children[0].scale.set(1, 1, 1 + 0.6 * Math.sin(t * 7 + i));
    });
  };
});

// --- 都更: old low walk-ups beside a new tower going up, a tower crane swinging a load of beams
function oldBlock(parent, W, D, floors, wall) {
  const fh = 0.42, H = floors * fh, zf = D / 2;
  add(parent, mesh(slab(W, D, H, 0.06), wall));
  add(parent, mesh(slab(W + 0.04, D + 0.04, 0.07, 0.06, 0.02), 'concrete'), 0, H, 0);
  const nw = Math.max(2, Math.round(W / 0.58));
  const cage = once('cage', () => boxG(0.4, 0.28, 0.1)), pane = once('pane', () => boxG(0.3, 0.19, 0.03));
  for (let f = 1; f < floors; f++) for (let i = 0; i < nw; i++) {
    const x = (i - (nw - 1) / 2) * (W - 0.3) / nw;
    add(parent, mesh(cage, 'metal'), x, f * fh + 0.07, zf);
    add(parent, mesh(pane, 'window'), x, f * fh + 0.11, zf + 0.05);
  }
  // shop on the ground floor: shutter and an awning
  add(parent, mesh(boxG(W * 0.42, 0.3, 0.04), 'metal'), -W * 0.22, 0, zf);
  add(parent, mesh(boxG(W * 0.3, 0.3, 0.04), 'window'), W * 0.25, 0, zf);
  const aw = add(parent, mesh(boxG(W - 0.15, 0.04, 0.32), 'teal'), 0, 0.36, zf + 0.12);
  aw.rotation.x = 0.35;
  // the roof: water tanks and a tin shack (頂樓加蓋)
  const tank = once('tank', () => cylG(0.15, 0.15, 0.3, 14));
  add(parent, mesh(tank, 'white'), W / 2 - 0.35, H + 0.12, -D / 2 + 0.35);
  add(parent, mesh(tank, 'bluePale'), W / 2 - 0.72, H + 0.12, -D / 2 + 0.35);
  add(parent, mesh(boxG(0.8, 0.12, 0.3), 'dark'), W / 2 - 0.53, H + 0.02, -D / 2 + 0.35);
  add(parent, mesh(slab(0.75, 0.6, 0.3, 0.04), 'concrete'), -W / 2 + 0.5, H + 0.05, -D / 2 + 0.42);
  add(parent, mesh(slab(0.85, 0.7, 0.05, 0.03, 0.015), 'teal'), -W / 2 + 0.5, H + 0.35, -D / 2 + 0.42);
}
def('urban', ['square', 'peach'], (G, B) => {
  lay(B, rrShape(6.6, 1.0, 0.4), 0.05, 'road', 0, 2.6);
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) lay(B, rrShape(0.5, 0.09, 0.04), 0.07, 'white', x, 2.6);
  lay(B, rrShape(6.6, 0.55, 0.25), 0.09, 'walk', 0, 1.82);
  lay(B, rrShape(2.9, 2.5, 0.3), 0.04, 'clay', 1.5, -1.0);
  // the old walk-ups
  oldBlock(piece(G, -1.95, -1.3), 2.3, 1.8, 4, 'tile');
  oldBlock(piece(G, -2.15, 0.75), 1.9, 1.3, 3, 'maroon');
  // the new tower: finished glass floors below, a concrete frame on top
  const tw = piece(G, 1.45, -1.05);
  const fh = 0.38;
  for (let f = 0; f < 5; f++) {
    add(tw, mesh(slab(1.6, 1.6, fh - 0.08, 0.1), 'glassB'), 0, f * fh, 0);
    add(tw, mesh(slab(1.72, 1.72, 0.08, 0.12, 0.02), 'white'), 0, f * fh + fh - 0.08, 0);
  }
  const col = once('col', () => boxG(0.12, fh - 0.08, 0.12));
  for (let f = 5; f < 7; f++) {
    for (const x of [-0.75, 0, 0.75]) for (const z of [-0.75, 0, 0.75]) {
      if (f === 6 && x > 0 && z < 0) continue;
      add(tw, mesh(col, 'concrete'), x, f * fh, z);
    }
    add(tw, mesh(slab(1.72, 1.72, 0.08, 0.12, 0.02), 'concrete'), 0, f * fh + fh - 0.08, 0);
  }
  add(tw, mesh(slab(0.5, 0.35, 0.16, 0.03), 'navy'), -0.35, 7 * fh, 0.3);
  // site hoarding along the street side
  const fe = piece(G, 1.5, 0.35);
  add(fe, mesh(slab(2.6, 0.1, 0.42, 0.03, 0.015), 'white'));
  add(fe, mesh(slab(2.62, 0.12, 0.08, 0.03, 0.015), 'blue'), 0, 0.42, 0);
  for (const x of [-0.65, 0, 0.65]) add(fe, mesh(boxG(0.03, 0.42, 0.12), 'blue'), x, 0, 0);
  // street trees
  tree(piece(G, -0.55, 1.8), 0, 0, 0.6, 'tc0', 'leaf', 0.09);
  tree(piece(G, 2.85, 1.8), 0, 0, 0.6, 'tc1', 'leaf', 0.09);
  // the tower crane
  const cr = piece(G, 2.85, -2.55);
  const seg = once('mastSeg', () => boxG(0.32, 0.44, 0.32)), con = once('mastCon', () => boxG(0.24, 0.06, 0.24));
  for (let k = 0; k < 7; k++) { add(cr, mesh(seg, 'yellow'), 0, k * 0.5 + 0.06, 0); add(cr, mesh(con, 'dark'), 0, k * 0.5, 0); }
  const sl = group(cr, 'slew', 0, 3.56, 0);
  add(sl, mesh(cylG(0.24, 0.24, 0.1, 14), 'dark'));
  add(sl, mesh(slab(0.34, 0.34, 0.3, 0.05), 'white'), 0.1, 0.06, 0.26);
  add(sl, mesh(boxG(0.04, 0.14, 0.26), 'window'), 0.27, 0.18, 0.26);
  add(sl, mesh(boxG(2.65, 0.18, 0.2).translate(1.3, 0, 0), 'yellow'), 0, 0.28, 0);
  add(sl, mesh(boxG(0.95, 0.16, 0.22).translate(-0.47, 0, 0), 'yellow'), 0, 0.29, 0);
  add(sl, mesh(slab(0.34, 0.34, 0.32, 0.04), 'concrete'), -0.72, 0.06, 0);
  add(sl, mesh(new THREE.ConeGeometry(0.14, 0.6, 4).translate(0, 0.3, 0), 'yellow'), 0, 0.42, 0).rotation.y = Math.PI / 4;
  rod(sl, v3(0, 1.0, 0), v3(2.45, 0.46, 0), 0.02, 'dark', 5);
  rod(sl, v3(0, 1.0, 0), v3(-0.85, 0.45, 0), 0.02, 'dark', 5);
  const tr = group(sl, 'trolley', 1.9, 0.28, 0);
  add(tr, mesh(boxG(0.2, 0.08, 0.26), 'dark'), 0, -0.08, 0);
  const hk = group(tr, 'hook', 0, -0.08, 0);
  add(hk, mesh(cylG(0.015, 0.015, 0.6, 5), 'dark'), 0, -0.6, 0);
  add(hk, mesh(boxG(0.1, 0.1, 0.1), 'yellow'), 0, -0.7, 0);
  const ld = group(hk, null, 0, -0.82, 0);
  const beam = once('beam', () => boxG(0.72, 0.09, 0.12));
  for (let k = 0; k < 3; k++) add(ld, mesh(beam, 'navy'), 0, 0, (k - 1) * 0.13);
  for (const z of [-0.065, 0.065]) add(ld, mesh(beam, 'navy'), 0, 0.09, z);
}, (o, list) => {
  const sl = o('slew'), tr = o('trolley'), hk = o('hook'), crowns = list('tc');
  return t => {
    const sw = Math.sin(t * 0.7);
    sl.rotation.y = -2.36 + 0.55 * sw;
    tr.position.x = 1.75 + 0.45 * Math.sin(t * 0.5 + 1);
    hk.rotation.z = -0.1 * Math.cos(t * 0.7) + 0.04 * Math.sin(t * 2.1);
    hk.rotation.x = 0.05 * Math.sin(t * 1.7);
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 高齡: a park bench with a cup of tea, a YouBike, a bus stop the bus pulls into, a flower bed
def('senior', ['round', 'lilac'], (G, B) => {
  lay(B, circleShape(3.22), 0.06, 'grass');
  lay(B, bandInCircle(3.34, -2.38, -1.55), 0.09, 'road');
  for (const x of [-1.8, -0.6, 0.6, 1.8]) lay(B, rrShape(0.45, 0.08, 0.03), 0.11, 'white', x, -1.96);
  lay(B, bandInCircle(3.26, -2.98, -2.38), 0.1, 'walk');
  lay(B, strokeShape([[-3.0, 1.5], [-1.7, 1.05], [-0.3, 0.95], [0.55, 0.15], [0.75, -1.5]], 0.3), 0.1, 'walk');
  // bus stop on the far side of the road
  const bs = piece(G, 1.0, -2.75, H0 + 0.1);
  add(bs, mesh(boxG(1.3, 0.72, 0.05), 'glassB'), 0, 0.12, -0.15);
  for (const x of [-0.62, 0.62]) add(bs, mesh(cylG(0.035, 0.035, 0.95, 8), 'metal'), x, 0, -0.12);
  add(bs, mesh(slab(1.5, 0.6, 0.08, 0.08), 'blue'), 0, 0.95, -0.02);
  add(bs, mesh(slab(1.0, 0.22, 0.06, 0.04), 'wood'), 0, 0.32, -0.02);
  for (const x of [-0.4, 0.4]) add(bs, mesh(boxG(0.05, 0.32, 0.05), 'metal'), x, 0, -0.02);
  add(bs, mesh(cylG(0.03, 0.03, 1.15, 8), 'metal'), 0.95, 0, 0.12);
  add(bs, mesh(discZ(0.2, 0.05, 18), 'blue'), 0.95, 1.2, 0.12);
  add(bs, mesh(discZ(0.13, 0.06, 18), 'white'), 0.95, 1.2, 0.13);
  // the bench, with a cup of tea
  const be = piece(G, -1.0, 0.25, H0 + 0.06);
  const slat = once('slat', () => slab(1.5, 0.12, 0.06, 0.03, 0.015));
  for (const z of [-0.09, 0.05, 0.19]) add(be, mesh(slat, 'wood'), 0, 0.38, z);
  for (const y of [0.56, 0.74]) add(be, mesh(slat, 'wood'), 0, y, -0.22).rotation.x = -0.15;
  for (const x of [-0.66, 0.66]) {
    add(be, mesh(boxG(0.07, 0.4, 0.07), 'navy'), x, 0, 0.17);
    add(be, mesh(boxG(0.07, 0.86, 0.07), 'navy'), x, 0, -0.2);
    add(be, mesh(boxG(0.07, 0.05, 0.45), 'navy'), x, 0.56, -0.01);
  }
  add(be, mesh(cylG(0.11, 0.11, 0.02, 14), 'white'), 0.45, 0.44, 0.06);
  add(be, mesh(cylG(0.075, 0.06, 0.1, 12), 'white'), 0.45, 0.46, 0.06);
  add(be, mesh(cylG(0.062, 0.062, 0.01, 12), 'tea'), 0.45, 0.555, 0.06);
  // YouBike (side view along x)
  const yb = piece(G, 1.5, 0.75, H0 + 0.06);
  const bk = group(yb); bk.scale.setScalar(1.2);
  const tyre = once('tyre', () => new THREE.TorusGeometry(0.22, 0.045, 6, 18));
  for (const x of [-0.37, 0.37]) { add(bk, mesh(tyre, 'rubber'), x, 0.265, 0); add(bk, mesh(once('hubZ', () => discZ(0.05, 0.1, 10)), 'metal'), x, 0.265, 0); }
  const F = 'ybike', r = 0.035;
  rod(bk, v3(0.27, 0.62, 0), v3(-0.03, 0.22, 0), r, F);
  rod(bk, v3(-0.03, 0.22, 0), v3(-0.16, 0.56, 0), r, F);
  rod(bk, v3(-0.03, 0.22, 0), v3(-0.37, 0.265, 0), r, F);
  rod(bk, v3(-0.16, 0.56, 0), v3(-0.37, 0.265, 0), r * 0.8, F);
  rod(bk, v3(0.27, 0.66, 0), v3(0.37, 0.265, 0), r, F);
  rod(bk, v3(0.27, 0.7, -0.17), v3(0.27, 0.7, 0.17), 0.028, 'dark');
  add(bk, mesh(ell(0.11, 0.035, 0.065, 12, 8), 'dark'), -0.17, 0.6, 0);
  add(bk, mesh(slab(0.22, 0.26, 0.15, 0.04, 0.02), 'white'), 0.43, 0.5, 0);
  add(bk, mesh(boxG(0.08, 0.06, 0.06), 'ybike'), 0.53, 0.56, 0);
  rod(bk, v3(-0.05, 0.22, 0.05), v3(-0.12, 0.0, 0.14), 0.02, 'metal');
  // flower bed
  const fb = piece(G, 0.3, 2.3, H0 + 0.06);
  add(fb, mesh(slab(2.6, 0.8, 0.28, 0.14), 'brick'));
  add(fb, mesh(slab(2.42, 0.62, 0.05, 0.1, 0.02), 'soil'), 0, 0.28, 0);
  const pc = ['pink', 'red', 'yellow', 'purple', 'pink', 'coral', 'purple'];
  for (let i = 0; i < 7; i++) flower(fb, -1.02 + i * 0.34, i % 2 ? 0.12 : -0.12, pc[i], 'fl' + i, 0.32, 1.25);
  // a shade tree
  tree(piece(G, -2.4, -0.7, H0 + 0.06), 0, 0, 1.1, 'tc0');
  // the bus (mover; it scales in and out at the plate rim) and a butterfly
  const bus = group(G, 'bus', -2.6, H0 + 0.09, -1.96);
  const bp = piece(bus, 0, 0, 0);
  const D = 0.56;
  add(bp, mesh(prism(carProfile(0.12, 0.06), D, 0.03), 'blue'), 0, 0.06, 0).scale.set(1.2, 1.2, 1);
  add(bp, mesh(slab(1.2, 0.46, 0.04, 0.08, 0.015), 'white'), -0.02, 0.66, 0);
  for (const x of [-0.42, -0.16, 0.1]) add(bp, mesh(boxG(0.2, 0.2, D + 0.02), 'glassB'), x, 0.36, 0);
  add(bp, mesh(boxG(0.16, 0.28, D + 0.02), 'glassB'), 0.4, 0.3, 0);
  add(bp, mesh(boxG(1.24, 0.05, D + 0.02), 'yellow'), 0, 0.22, 0);
  const tw = once('busWheel', () => discZ(0.11, 0.08, 14));
  for (const x of [-0.38, 0.38]) for (const z of [-0.25, 0.25]) add(bp, mesh(tw, 'rubber'), x, 0.1, z);
  const fly = group(G, 'fly', 0.3, H0 + 1.3, 2.2);
  const fp = piece(fly, 0, 0, 0);
  add(fp, mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), 'dark')).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const w = group(fp, s < 0 ? 'wingL' : 'wingR', 0, 0, 0);
    add(w, mesh(ell(0.1, 0.02, 0.12, 10, 6), 'yellow'), 0.02, 0, s * 0.12);
    add(w, mesh(ell(0.07, 0.02, 0.08, 10, 6), 'orange'), -0.07, 0, s * 0.09);
  }
}, (o, list) => {
  const bus = o('bus'), fly = o('fly'), wl = o('wingL'), wr = o('wingR'), fls = list('fl'), crowns = list('tc');
  const ease = x => 1 - (1 - x) ** 3, easeIn = x => x * x * x;
  return t => {
    const u = ((t % 12) + 12) % 12;
    let x;
    if (u < 4) x = -2.6 + 3.6 * ease(u / 4);
    else if (u < 6.6) x = 1.0;
    else if (u < 9.2) x = 1.0 + 1.6 * easeIn((u - 6.6) / 2.6);
    else x = 2.6;
    bus.position.x = x;
    const s = u >= 9.2 ? 1e-3 : Math.max(1e-3, Math.min(smooth((x + 2.6) / 0.6), smooth((2.6 - x) / 0.5)));
    bus.scale.setScalar(s);
    bus.visible = s > 0.01;
    const a = t * 0.8;
    const fx = 0.3 + 1.1 * Math.sin(a), fz = 2.2 + 0.32 * Math.sin(2 * a);
    fly.position.set(fx, H0 + 1.25 + 0.12 * Math.sin(t * 3.1), fz);
    fly.rotation.y = yawOf(1.1 * Math.cos(a), 0.64 * Math.cos(2 * a));
    const fl = 0.25 + 0.9 * Math.abs(Math.sin(t * 11));
    wl.rotation.x = fl; wr.rotation.x = -fl;
    fls.forEach((f, i) => { f.rotation.z = 0.12 * Math.sin(t * 1.6 + i * 0.9); f.rotation.x = 0.06 * Math.sin(t * 1.3 + i); });
    crowns.forEach((c, i) => { c.rotation.z = 0.035 * Math.sin(t * 1.1 + i * 2); });
  };
});

// --- 親子: a playground with a slide, a swing, a little carousel of horses, and a house
function horse(parent, pal, mane) {
  const h = group(parent);
  add(h, mesh(once('hBody', () => ell(0.24, 0.12, 0.11, 14, 10)), pal), 0, 0.3, 0);
  capsule(h, v3(0.15, 0.33, 0), v3(0.25, 0.5, 0), 0.07, pal);
  add(h, mesh(once('hHead', () => ell(0.12, 0.07, 0.07, 12, 8)), pal), 0.3, 0.52, 0).rotation.z = -0.5;
  add(h, mesh(once('hMane', () => ell(0.1, 0.05, 0.04, 10, 6)), mane), 0.17, 0.5, 0).rotation.z = 0.9;
  add(h, mesh(once('hTail', () => ell(0.09, 0.04, 0.04, 10, 6)), mane), -0.27, 0.28, 0).rotation.z = 0.8;
  add(h, mesh(once('hSaddle', () => ell(0.1, 0.05, 0.12, 12, 8)), 'red'), -0.02, 0.4, 0);
  const lg = once('hLeg', () => cylG(0.03, 0.03, 0.24, 6));
  for (const x of [-0.14, 0.14]) for (const z of [-0.06, 0.06]) add(h, mesh(lg, pal), x, 0.06, z).rotation.z = x > 0 ? -0.35 : 0.35;
  return h;
}
def('family', ['round', 'butter'], (G, B) => {
  lay(B, rrShape(5.8, 4.4, 1.4), 0.06, 'mat', 0, 0.35);
  lay(B, circleShape(0.72), 0.08, 'grass', -2.6, 0.45);
  // the house
  const hs = piece(G, -1.6, -1.5);
  add(hs, mesh(prism(polyShape([[-0.8, 0], [0.8, 0], [0.8, 0.85], [0, 1.4], [-0.8, 0.85]]), 1.2, 0.03), 'cream'));
  add(hs, mesh(prism(polyShape([[-1.0, 0.72], [0, 1.62], [1.0, 0.72], [1.0, 0.58], [0, 1.47], [-1.0, 0.58]]), 1.42, 0.03), 'red'));
  add(hs, mesh(boxG(0.18, 0.42, 0.18), 'brick'), 0.48, 1.08, -0.25);
  add(hs, mesh(boxG(0.3, 0.52, 0.04), 'wood'), 0.28, 0, 0.6);
  add(hs, mesh(new THREE.SphereGeometry(0.03, 6, 4), 'gold'), 0.38, 0.27, 0.63);
  add(hs, mesh(boxG(0.34, 0.3, 0.04), 'white'), -0.36, 0.34, 0.6);
  add(hs, mesh(boxG(0.26, 0.22, 0.05), 'sky'), -0.36, 0.38, 0.6);
  add(hs, mesh(discZ(0.12, 0.05, 16), 'yellow'), 0, 1.06, 0.6);
  add(hs, mesh(slab(0.5, 0.3, 0.06, 0.06), 'walk'), 0.28, 0, 0.82);
  // the slide (chute toward the front)
  const sd = piece(G, 1.55, -1.45);
  const post = once('post', () => cylG(0.05, 0.05, 1.42, 8));
  for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) add(sd, mesh(post, 'blue'), x, 0, z);
  add(sd, mesh(slab(0.76, 0.76, 0.08, 0.06), 'yellow'), 0, 0.9, 0);
  add(sd, mesh(new THREE.ConeGeometry(0.6, 0.42, 4).translate(0, 0.21, 0), 'red'), 0, 1.4, 0).rotation.y = Math.PI / 4;
  for (const x of [-0.3, 0.3]) rod(sd, v3(x, 1.0, -0.3), v3(x, 1.0, 0.3), 0.03, 'blue', 6);
  for (const x of [-0.18, 0.18]) rod(sd, v3(x, 0, -0.75), v3(x, 0.95, -0.34), 0.03, 'teal', 6);
  for (let k = 1; k < 5; k++) { const f = k / 5; rod(sd, v3(-0.18, 0.95 * f, -0.75 + 0.41 * f), v3(0.18, 0.95 * f, -0.75 + 0.41 * f), 0.022, 'teal', 5); }
  const L = 1.58, ang = Math.atan2(0.82, 1.35);
  const ch = group(sd, null, 0, 0.98, 0.36); ch.rotation.x = ang;
  const uprof = polyShape([[-0.27, 0], [0.27, 0], [0.27, 0.16], [0.2, 0.16], [0.2, 0.05], [-0.2, 0.05], [-0.2, 0.16], [-0.27, 0.16]]);
  add(ch, mesh(prism(uprof, L, 0.02).translate(0, -0.05, L / 2), 'orange'));
  add(sd, mesh(slab(0.54, 0.4, 0.06, 0.05), 'orange'), 0, 0.1, 0.36 + 1.35 + 0.15);
  // the swing (seats swing toward the viewer)
  const sw = piece(G, -1.45, 1.15);
  rod(sw, v3(-0.9, 1.45, 0), v3(0.9, 1.45, 0), 0.06, 'teal', 10);
  for (const s of [-1, 1]) for (const dz of [-1, 1]) rod(sw, v3(s * 0.86, 1.45, 0), v3(s * 0.98, 0, dz * 0.5), 0.05, 'blue', 8);
  ['red', 'yellow'].forEach((p, i) => {
    const sg = group(sw, 'sw' + i, (i ? 1 : -1) * 0.38, 1.45, 0);
    for (const x of [-0.15, 0.15]) add(sg, mesh(once('chain', () => cylG(0.018, 0.018, 1.05, 5)), 'metal'), x, -1.1, 0);
    add(sg, mesh(slab(0.42, 0.26, 0.07, 0.05), p), 0, -1.15, 0);
  });
  // the little carousel
  const cs = piece(G, 1.5, 1.25);
  add(cs, mesh(cylG(0.95, 1.0, 0.16, 28), 'pink'));
  const rot = group(cs, 'carousel', 0, 0.16, 0);
  add(rot, mesh(cylG(0.9, 0.9, 0.04, 28), 'yellow'));
  add(rot, mesh(cylG(0.07, 0.07, 1.3, 10), 'gold'));
  add(rot, mesh(new THREE.ConeGeometry(0.4, 0.32, 12).translate(0, 0.16, 0), 'red'), 0, 1.3, 0);
  add(rot, mesh(new THREE.SphereGeometry(0.08, 10, 8), 'yellow'), 0, 1.64, 0);
  const hc = ['white', 'cream', 'white'], mc = ['blue', 'pink', 'teal'];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, x = 0.58 * Math.cos(a), z = -0.58 * Math.sin(a);
    add(rot, mesh(once('hpole', () => cylG(0.025, 0.025, 1.05, 6)), 'gold'), x, 0.04, z);
    add(rot, mesh(new THREE.SphereGeometry(0.045, 8, 6), 'gold'), x, 1.1, z);
    const h = group(rot, 'horse' + i, x, 0, z);
    h.rotation.y = a + Math.PI / 2;
    horse(h, hc[i], mc[i]).scale.setScalar(1.55);
  }
  tree(piece(G, -2.6, 0.45), 0, 0, 0.85, 'tc0', 'leaf', 0.08);
}, (o, list) => {
  const sws = list('sw'), rot = o('carousel'), horses = list('horse'), crowns = list('tc');
  return t => {
    sws.forEach((s, i) => { s.rotation.x = 0.5 * Math.sin(t * 2.4 + i * 2.2); });
    rot.rotation.y = t * 0.7;
    horses.forEach((h, i) => { h.position.y = 0.02 + 0.1 * Math.sin(t * 2.8 + i * 2.1); });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 觀光: a terraced mountain town (九份) with two cable-car cabins going up and down, the sea and a little boat
// The mountain is a stack of rounded terraces, each tier shifted a little back and left so its front step shows
// from above and the side the cable runs down stays gentle enough for the cabins to clear.
const MT = { x: -1.1, z: -0.5, th: 0.46, tiers: [[2.1, 0, 0], [1.68, -0.12, -0.1], [1.26, -0.24, -0.2], [0.86, -0.36, -0.28], [0.5, -0.48, -0.34]] };
const BOT = { x: 1.5, z: 0.1, y: 1.02 }, TOP = { x: MT.x - 0.48, z: MT.z - 0.34, y: H0 + 5 * MT.th + 1.1 };
// height of the terrace under a point (relative to the mountain centre)
function mtH(dx, dz) {
  let h = 0;
  MT.tiers.forEach(([r, ox, oz], i) => { if (Math.hypot(dx - ox, dz - oz) <= r) h = (i + 1) * MT.th; });
  return h;
}
def('tourism', ['square', 'butter'], (G, B) => {
  lay(B, rrShape(3.7, 2.65, 0.9), 0.06, 'water', 1.45, 1.92);
  const wv = once('wave', () => ell(0.2, 0.04, 0.06, 10, 6));
  [[0.4, 1.2], [2.5, 1.15], [0.9, 2.85], [2.6, 2.9]].forEach(([x, z], i) => add(B, mesh(wv, 'white', 'wv' + i), x, H0 + 0.05, z));
  // the mountains: terraces in two greens
  const mt = piece(G, MT.x, MT.z);
  MT.tiers.forEach(([r, ox, oz], i) => add(mt, mesh(puff(circleShape(r - 0.1), MT.th + 0.02, 0.1, 3, 24), i % 2 ? 'grass' : 'grass2'), ox, i * MT.th, oz));
  const h2 = piece(G, 1.95, -2.05);
  [[1.25, 0], [0.85, -0.08], [0.45, -0.14]].forEach(([r, oz], i) => add(h2, mesh(puff(circleShape(r - 0.08), 0.42, 0.08, 3, 20), i % 2 ? 'grass2' : 'leaf'), 0, i * 0.4, oz));
  tree(h2, 0, -0.14, 0.55, 'tc0', 'leaf', 1.2);
  // woods on the terraces
  const wd = piece(G, MT.x, MT.z);
  [[-1.85, -0.6, 0.9], [-1.0, -1.6, 0.85], [0.85, -1.25, 0.8], [-1.5, 0.75, 0.75], [1.35, -0.45, 0.7], [-1.95, 0.3, 0.75], [1.2, 0.85, 0.7]].forEach(([dx, dz, sc]) => {
    bush(wd, dx, dz, sc, 'leaf', mtH(dx, dz));
  });
  // 九份 houses with red lanterns on the front slope
  const town = piece(G, MT.x, MT.z);
  const hb = once('mtHouse', () => slab(0.44, 0.38, 0.4, 0.04)), hr = once('mtRoof', () => slab(0.52, 0.46, 0.08, 0.04, 0.02));
  const lan = once('lantern', () => ell(0.075, 0.09, 0.075, 10, 8));
  [[-0.75, 1.82, 'cream'], [0.1, 1.86, 'paper'], [0.55, 1.72, 'cream'], [-0.45, 1.3, 'paper'], [0.25, 1.35, 'cream'], [-0.3, 0.9, 'cream']].forEach(([dx, dz, wall], i) => {
    const y = mtH(dx, dz);
    const h = group(town, null, dx, y, dz);
    h.rotation.y = Math.atan2(dx, dz) * 0.4;
    add(h, mesh(hb, wall));
    add(h, mesh(hr, i % 2 ? 'roofD' : 'maroon'), 0, 0.4, 0);
    add(h, mesh(boxG(0.14, 0.18, 0.03), 'window'), 0.08, 0.14, 0.19);
    add(h, mesh(lan, 'red', 'lan' + i), -0.12, 0.24, 0.25);
  });
  // cable car stations
  const sb = piece(G, BOT.x, BOT.z);
  add(sb, mesh(slab(0.62, 0.5, 0.5, 0.06), 'white'));
  add(sb, mesh(slab(0.72, 0.6, 0.08, 0.08), 'teal'), 0, 0.5, 0);
  add(sb, mesh(boxG(0.24, 0.26, 0.04), 'glassB'), 0, 0, 0.25);
  const stp = piece(G, TOP.x, TOP.z, H0 + 5 * MT.th);
  add(stp, mesh(slab(0.6, 0.54, 1.0, 0.06), 'white'));
  add(stp, mesh(slab(0.7, 0.64, 0.09, 0.08), 'orange'), 0, 1.0, 0);
  for (const y of [0.4, 0.7]) add(stp, mesh(boxG(0.4, 0.14, 0.04), 'glassB'), 0, y, 0.27);
  add(stp, mesh(boxG(0.22, 0.26, 0.04), 'glassB'), 0, 0.02, 0.27);
  // the two cables and two cabins
  const dx = BOT.x - TOP.x, dz = BOT.z - TOP.z, dh = Math.hypot(dx, dz);
  const px = -dz / dh * 0.13, pz = dx / dh * 0.13;
  const cab = piece(G, 0, 0, 0);
  for (const s of [-1, 1]) rod(cab, v3(TOP.x + s * px, TOP.y, TOP.z + s * pz), v3(BOT.x + s * px, BOT.y, BOT.z + s * pz), 0.022, 'dark', 5);
  const cyaw = yawOf(dx, dz);
  ['yellow', 'red'].forEach((p, i) => {
    const g = group(G, 'gon' + i, 0, 0, 0);
    g.userData.side = i ? 1 : -1;
    const gp = piece(g, 0, 0, 0);
    const body = group(gp); body.rotation.y = cyaw;
    add(body, mesh(cylG(0.015, 0.015, 0.12, 5), 'dark'), 0, -0.12, 0);
    add(body, mesh(slab(0.34, 0.32, 0.3, 0.07), p), 0, -0.42, 0);
    add(body, mesh(boxG(0.36, 0.1, 0.34), 'glassB'), 0, -0.28, 0);
    add(body, mesh(slab(0.36, 0.34, 0.05, 0.06, 0.015), 'white'), 0, -0.14, 0);
  });
  // the boat
  const bt = group(G, 'boat', 1.6, H0 + 0.05, 2.0);
  const bpp = piece(bt, 0, 0, 0);
  const hull = group(bpp, 'hull'); hull.scale.setScalar(1.15);
  add(hull, mesh(prism(polyShape([[-0.42, 0.02], [0.3, 0.02], [0.5, 0.2], [-0.46, 0.2]]), 0.36, 0.03), 'white'));
  add(hull, mesh(boxG(0.92, 0.05, 0.38), 'blue'), 0.02, 0.1, 0);
  add(hull, mesh(slab(0.34, 0.26, 0.2, 0.05), 'teal'), -0.1, 0.2, 0);
  add(hull, mesh(boxG(0.2, 0.08, 0.28), 'glassB'), -0.08, 0.28, 0);
  add(hull, mesh(cylG(0.015, 0.015, 0.45, 5), 'metal'), 0.18, 0.2, 0);
  add(hull, mesh(prism(polyShape([[0, 0], [0.18, 0.06], [0, 0.12]]), 0.02, 0.005), 'red'), 0.18, 0.52, 0);
}, (o, list) => {
  const gons = list('gon'), boat = o('boat'), hull = o('hull'), lans = list('lan'), waves = list('wv'), crowns = list('tc');
  const dx = BOT.x - TOP.x, dz = BOT.z - TOP.z, dh = Math.hypot(dx, dz);
  const px = -dz / dh * 0.13, pz = dx / dh * 0.13;
  return t => {
    const u = 0.5 - 0.5 * Math.cos(TAU * t / 10);
    gons.forEach((g, i) => {
      const f = 0.2 + 0.7 * (i ? 1 - u : u), s = g.userData.side;
      g.position.set(TOP.x + dx * f + s * px, TOP.y + (BOT.y - TOP.y) * f, TOP.z + dz * f + s * pz);
      g.rotation.z = 0.04 * Math.sin(t * 2 + i);
    });
    const a = -0.45 * t;
    boat.position.x = 1.6 + 0.9 * Math.cos(a);
    boat.position.z = 2.0 + 0.42 * Math.sin(a);
    boat.rotation.y = yawOf(0.9 * Math.sin(a), -0.42 * Math.cos(a));
    hull.position.y = 0.025 * Math.sin(t * 2.2);
    hull.rotation.x = 0.07 * Math.sin(t * 1.7);
    lans.forEach((l, i) => { l.rotation.z = 0.2 * Math.sin(t * 1.8 + i); });
    waves.forEach((w, i) => { const k = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9); w.scale.set(0.6 + 0.5 * k, 1, 1); });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 毛孩: a dog house, a shiba wagging its tail, a cat, a food bowl, hearts floating up
def('pets', ['round', 'peach'], (G, B) => {
  lay(B, circleShape(3.2), 0.07, 'grass');
  lay(B, strokeShape([[-0.4, 0.2], [-0.2, 1.4], [0.3, 2.4], [0.4, 3.0]], 0.3), 0.1, 'walk');
  const fd = once('fdot', () => ell(0.09, 0.07, 0.09, 10, 8));
  [[-2.4, -0.4, 'yellow'], [-2.65, 0.15, 'pink'], [2.5, -1.2, 'yellow'], [2.3, 1.7, 'pink'], [-1.9, 1.9, 'yellow']].forEach(([x, z, p]) => add(B, mesh(fd, p), x, H0 + 0.07, z));
  // the dog house
  const dh = piece(G, -0.45, -1.45, H0 + 0.07);
  add(dh, mesh(prism(polyShape([[-0.8, 0], [0.8, 0], [0.8, 0.85], [0, 1.4], [-0.8, 0.85]]), 1.4, 0.04), 'wood'));
  add(dh, mesh(prism(polyShape([[-1.0, 0.7], [0, 1.64], [1.0, 0.7], [1.0, 0.55], [0, 1.48], [-1.0, 0.55]]), 1.6, 0.04), 'red'));
  const door = new THREE.Shape(); door.moveTo(-0.32, 0); door.lineTo(0.32, 0); door.lineTo(0.32, 0.42); door.absarc(0, 0.42, 0.32, 0, Math.PI, false); door.lineTo(-0.32, 0);
  add(dh, mesh(prism(door, 0.04, 0.01), 'eye'), 0, 0, 0.71);
  // a bone on the gable
  const bone = group(dh, null, 0, 1.0, 0.72);
  add(bone, mesh(boxG(0.32, 0.08, 0.05).translate(0, -0.04, 0), 'white'));
  for (const x of [-0.17, 0.17]) for (const y of [-0.04, 0.04]) add(bone, mesh(once('boneEnd', () => new THREE.SphereGeometry(0.055, 10, 8)), 'white'), x, y, 0);
  // the shiba
  const dg = piece(G, -0.35, 0.35, H0 + 0.07);
  const dog = group(dg, 'dog');
  add(dog, mesh(ell(0.38, 0.36, 0.4, 18, 12), 'tan'), 0, 0.36, -0.05);
  add(dog, mesh(ell(0.25, 0.28, 0.18, 14, 10), 'cream'), 0, 0.42, 0.22);
  for (const s of [-1, 1]) {
    capsule(dog, v3(s * 0.14, 0.42, 0.2), v3(s * 0.15, 0.1, 0.3), 0.075, 'tan');
    add(dog, mesh(once('paw', () => ell(0.08, 0.06, 0.1, 10, 8)), 'cream'), s * 0.15, 0.05, 0.36);
    add(dog, mesh(once('haunch', () => ell(0.14, 0.16, 0.22, 12, 8)), 'tan'), s * 0.3, 0.17, -0.08);
  }
  add(dog, mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 18).rotateX(Math.PI / 2 - 0.25), 'red'), 0, 0.66, 0.06);
  add(dog, mesh(discZ(0.06, 0.03, 12), 'gold'), 0, 0.57, 0.28);
  const hd = group(dog, 'dogHead', 0, 0.9, 0.1);
  add(hd, mesh(ell(0.34, 0.3, 0.3, 18, 12), 'tan'));
  add(hd, mesh(ell(0.22, 0.14, 0.16, 14, 10), 'cream'), 0, -0.08, 0.2);
  add(hd, mesh(ell(0.065, 0.05, 0.045, 10, 8), 'eye'), 0, -0.01, 0.35);
  for (const s of [-1, 1]) {
    add(hd, mesh(once('dEye', () => ell(0.045, 0.055, 0.03, 10, 8)), 'eye'), s * 0.13, 0.07, 0.27);
    add(hd, mesh(once('dCheek', () => ell(0.06, 0.03, 0.03, 10, 6)), 'pink'), s * 0.22, -0.04, 0.22);
    const ear = add(hd, mesh(once('dEar', () => new THREE.ConeGeometry(0.11, 0.22, 4).translate(0, 0.11, 0)), 'tan'), s * 0.19, 0.18, 0.0);
    ear.rotation.set(0, Math.PI / 4, -s * 0.35);
  }
  add(hd, mesh(ell(0.05, 0.025, 0.04, 10, 6), 'pink'), 0, -0.16, 0.3);
  const tail = group(dog, 'dogTail', 0, 0.5, -0.4);
  add(tail, mesh(new THREE.TorusGeometry(0.13, 0.065, 8, 14, Math.PI * 1.5).rotateY(Math.PI / 2), 'tan'), 0, 0.13, 0);
  // the cat, loafing on the right
  const ct = piece(G, 1.75, 0.15, H0 + 0.07);
  const cat = group(ct); cat.rotation.y = -0.45;
  add(cat, mesh(ell(0.34, 0.26, 0.42, 16, 12), 'ginger'), 0, 0.24, 0);
  for (const z of [-0.15, 0.02]) add(cat, mesh(ell(0.3, 0.06, 0.05, 12, 6), 'orange'), 0, 0.42, z);
  const ch = group(cat, 'catHead', 0, 0.48, 0.3);
  add(ch, mesh(ell(0.24, 0.21, 0.21, 16, 12), 'ginger'));
  add(ch, mesh(ell(0.12, 0.07, 0.08, 10, 8), 'white'), 0, -0.07, 0.15);
  add(ch, mesh(ell(0.03, 0.022, 0.02, 8, 6), 'pink'), 0, -0.03, 0.21);
  for (const s of [-1, 1]) {
    const e = add(ch, mesh(once('cEar', () => new THREE.ConeGeometry(0.08, 0.16, 4).translate(0, 0.08, 0)), 'ginger'), s * 0.13, 0.13, -0.02);
    e.rotation.set(0, Math.PI / 4, -s * 0.3);
    add(ch, mesh(once('cEye', () => ell(0.035, 0.045, 0.025, 8, 6)), 'eye'), s * 0.09, 0.04, 0.18);
  }
  const ctail = group(cat, 'catTail', 0.22, 0.12, -0.3);
  stroke(ctail, [v3(0, 0, 0), v3(0.18, 0.02, 0.1), v3(0.24, 0.03, 0.35), v3(0.12, 0.04, 0.55)], 0.055, 'ginger');
  // food bowl and a ball
  const bw = piece(G, 0.75, 1.55, H0 + 0.07);
  add(bw, mesh(cylG(0.36, 0.27, 0.2, 20), 'blue'));
  add(bw, mesh(cylG(0.3, 0.3, 0.03, 18), 'soil'), 0, 0.17, 0);
  const kb = once('kibble', () => new THREE.SphereGeometry(0.06, 8, 6));
  [[0, 0], [0.13, 0.05], [-0.12, 0.06], [0.04, -0.13], [-0.06, 0.15], [0.15, -0.1], [-0.15, -0.08]].forEach(([x, z]) => add(bw, mesh(kb, 'clay'), x, 0.21, z));
  const bl = piece(G, -1.75, 1.45, H0 + 0.07);
  add(bl, mesh(new THREE.SphereGeometry(0.22, 16, 12).translate(0, 0.22, 0), 'yellow'));
  add(bl, mesh(new THREE.TorusGeometry(0.222, 0.035, 6, 20).translate(0, 0, 0), 'red'), 0, 0.22, 0).rotation.y = 0.6;
  // hearts floating up
  const hg = prism(heartShape(0.5), 0.14, 0.04);
  for (let i = 0; i < 2; i++) {
    const h = group(G, 'heart' + i, -0.35, H0 + 1.5, 0.45);
    add(piece(h, 0, 0, 0), mesh(hg, 'heart'));
  }
}, (o, list) => {
  const tail = o('dogTail'), head = o('dogHead'), ctail = o('catTail'), chead = o('catHead'), hearts = list('heart');
  return t => {
    tail.rotation.z = 0.55 * Math.sin(t * 10);
    head.rotation.z = 0.13 * Math.sin(t * 1.2);
    ctail.rotation.y = 0.35 * Math.sin(t * 1.4);
    chead.rotation.y = 0.2 * Math.sin(t * 0.7 + 1);
    hearts.forEach((h, i) => {
      const u = ((t / 2.8 + i * 0.5) % 1 + 1) % 1;
      h.position.y = H0 + 1.3 + 1.7 * u;
      h.position.x = -0.35 + 0.18 * Math.sin(u * TAU * 1.2 + i * 2);
      const s = Math.max(1e-3, Math.sin(Math.PI * u) ** 0.7);
      h.scale.setScalar(s * (0.85 + 0.15 * Math.sin(t * 8)));
      h.rotation.y = 0.3 * Math.sin(u * TAU);
    });
  };
});

// --- default: the campaign arch logo, 13 bars standing on an arch (3 navy bars in the middle = 川)
def('default', ['round', 'skyP'], (G, B) => {
  const cols = ['blue', 'blue', 'blue', 'teal', 'yellow', 'navy', 'navy', 'navy', 'yellow', 'teal', 'blue', 'blue', 'blue'];
  const sp = 0.44, zc = k => 0.8 * (k / 6) ** 2 - 0.15;
  const ht = k => { const a = Math.abs(k) / 6; return 0.85 + 1.25 * (1 - a ** 1.4) + (Math.abs(k) <= 1 ? 0.6 : 0); };
  const pts = [];
  for (let k = -6.6; k <= 6.61; k += 0.6) pts.push([k * sp, zc(k)]);
  const pl = piece(G, 0, 0, H0, 0);
  add(pl, mesh(puff(strokeShape(pts, 0.42), 0.32, 0.07, 2, 10), 'white'));
  add(pl, mesh(puff(strokeShape(pts, 0.5), 0.1, 0.04, 2, 10), 'navy'));
  for (let k = -6; k <= 6; k++) {
    const pc = piece(G, k * sp, zc(k), H0 + 0.32, 10 + Math.abs(k));
    const bar = group(pc, 'bar' + (k + 6));
    add(bar, mesh(slab(0.32, 0.32, ht(k), 0.12, 0.05), cols[k + 6]));
  }
  [[-2.35, 1.9, 0.9, 0.32], [2.45, 2.1, 0.6, 0.27], [1.55, 3.2, -0.9, 0.22]].forEach(([x, y, z, r], i) => {
    const sk = group(G, 'spk' + i, x, y, z);
    add(piece(sk, 0, 0, 0, 20 + i), mesh(prism(sparkShape(r, r * 0.22), 0.1, 0.03), 'yellow'));
  });
}, (o, list) => {
  const bars = list('bar'), spk = list('spk');
  return t => {
    bars.forEach((b, i) => { b.scale.y = 1 + 0.06 * Math.sin(t * 2.0 - Math.abs(i - 6) * 0.7); });
    spk.forEach((s, i) => { s.scale.setScalar(0.8 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.6 + i * 2.1))); s.rotation.y = 0.3 * Math.sin(t * 0.9 + i); });
  };
});

// ---------------------------------------------------------------- builds: things 川伯 worked on (fx/builds.js)
// a toy car (forward +x), its own pop piece
function toyCar(parent, name, pal, x, z, y = H0 + 0.06) {
  const c = group(parent, name, x, y, z);
  const p = piece(c, 0, 0, 0);
  add(p, mesh(once('carBody', () => slab(0.82, 0.44, 0.24, 0.1)), pal), 0, 0.08, 0);
  add(p, mesh(once('carCab', () => slab(0.44, 0.38, 0.2, 0.08)), 'glassB'), -0.06, 0.3, 0);
  const wh = once('carWheel', () => discZ(0.09, 0.06, 12));
  for (const wx of [-0.24, 0.24]) for (const wz of [-0.2, 0.2]) add(p, mesh(wh, 'rubber'), wx, 0.09, wz);
  return c;
}
const winG = () => once('winS', () => boxG(0.22, 0.2, 0.04));

// --- 天橋: a footbridge over the road outside a school, stair towers either side, a car passing under it
def('overpass', ['round', 'skyP'], (G, B) => {
  lay(B, bandInCircle(3.32, -0.05, 0.55), 0.1, 'walk');
  lay(B, bandInCircle(3.32, 0.55, 1.75), 0.06, 'road');
  lay(B, bandInCircle(3.32, 1.75, 2.35), 0.1, 'walk');
  const dash = once('dashX', () => boxG(0.42, 0.02, 0.07));
  for (const x of [-2.3, -1.3, -0.3, 0.7]) add(B, mesh(dash, 'white'), x, H0 + 0.06, 1.15);
  // the school
  const sc = piece(G, -0.55, -1.75);
  add(sc, mesh(slab(3.2, 1.25, 1.45, 0.1), 'cream'));
  add(sc, mesh(slab(3.36, 1.4, 0.12, 0.12), 'brick'), 0, 1.45, 0);
  for (const y of [0.42, 0.95]) for (const x of [-1.25, -0.75, 0.75, 1.25]) add(sc, mesh(winG(), 'sky'), x, y, 0.63);
  add(sc, mesh(boxG(0.7, 0.62, 0.04), 'navy'), 0, 0, 0.63);
  add(sc, mesh(discZ(0.2, 0.06, 18), 'white'), 0, 1.12, 0.66);
  add(sc, mesh(boxG(0.03, 0.15, 0.02), 'dark'), 0, 1.12, 0.7);
  // the footbridge, spanning the road
  const br = piece(G, 1.75, 1.15);
  for (const z of [-0.98, 0.98]) {
    add(br, mesh(slab(0.72, 0.5, 1.32, 0.06), 'yellow'), 0, 0, z);
    for (let i = 0; i < 4; i++) add(br, mesh(once('stepB', () => boxG(0.74, 0.05, 0.1)), 'white'), 0, 0.3 + i * 0.28, z + (z > 0 ? 0.22 : -0.22));
  }
  add(br, mesh(slab(0.66, 2.5, 0.14, 0.05), 'navy'), 0, 1.32, 0);
  for (const x of [-0.3, 0.3]) add(br, mesh(boxG(0.05, 0.3, 2.4), 'white'), x, 1.46, 0);
  add(br, mesh(slab(0.82, 2.62, 0.06, 0.06), 'teal'), 0, 1.98, 0);
  for (const x of [-0.36, 0.36]) for (const z of [-1.2, 0, 1.2]) add(br, mesh(once('postB', () => cylG(0.025, 0.025, 0.52, 6)), 'white'), x, 1.46, z);
  tree(piece(G, -2.75, 2.05), 0, 0, 0.55, 'tc0');
  tree(piece(G, 2.75, -0.35), 0, 0, 0.7, 'tc1');
  toyCar(G, 'car', 'red', -2.6, 0.85);
}, (o, list) => {
  const car = o('car'), crowns = list('tc');
  return t => {
    const u = (t * 0.3) % 1;
    car.position.x = -2.9 + 5.8 * u;
    car.visible = u > 0.03 && u < 0.97;
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.3 + i * 1.9); });
  };
});

// --- 治水: a pumping station on the bank, big pipes pouring into the river, a floodgate that lifts and drops
def('pump', ['square', 'mint'], (G, B) => {
  lay(B, rrShape(5.6, 2.9, 0.4), 0.08, 'grass', 0, -1.6);
  lay(B, rrShape(6.76, 0.4, 0.12), 0.22, 'concrete', 0, 0.95);
  lay(B, rrShape(6.76, 2.0, 0.3), 0.06, 'water', 0, 2.25);
  const st = piece(G, -1.0, -1.45);
  add(st, mesh(slab(2.7, 1.55, 1.4, 0.1), 'concrete'));
  add(st, mesh(slab(2.86, 1.7, 0.12, 0.12), 'blue'), 0, 1.4, 0);
  add(st, mesh(boxG(0.95, 0.85, 0.04), 'navy'), -0.55, 0, 0.79);
  for (const x of [0.35, 0.85]) add(st, mesh(winG(), 'sky'), x, 0.85, 0.79);
  add(st, mesh(cylG(0.16, 0.16, 0.5, 12), 'metal'), 0.9, 1.5, -0.3);
  const pp = piece(G, 0, 0);
  [-1.65, -1.0, -0.35].forEach((x, i) => {
    stroke(pp, [v3(x, 0.55, -0.7), v3(x, 0.95, 0.35), v3(x, 0.8, 1.15), v3(x, 0.45, 1.45)], 0.12, 'metal');
    add(G, mesh(once('spout', () => ell(0.26, 0.08, 0.26, 14, 8)), 'white', 'spout' + i), x, H0 + 0.07, 1.62);
  });
  const fg = piece(G, 2.05, 1.05);
  for (const sx of [-0.78, 0.78]) add(fg, mesh(slab(0.3, 0.42, 1.85, 0.05), 'concrete'), sx, 0, 0);
  add(fg, mesh(slab(1.9, 0.48, 0.26, 0.05), 'concrete'), 0, 1.85, 0);
  add(fg, mesh(slab(1.24, 0.16, 0.95, 0.04), 'blue', 'gate'), 0, 0.1, 0);
  tree(piece(G, 1.9, -1.75), 0, 0, 0.95, 'tc0');
  bush(piece(G, 2.8, -0.6), 0, 0, 1.1, 'grass2');
}, (o, list) => {
  const gate = o('gate'), sp = list('spout'), crowns = list('tc');
  return t => {
    gate.position.y = 0.1 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.8));
    sp.forEach((s, i) => { const k = (t * 1.4 + i * 0.33) % 1; s.scale.set(0.7 + k * 0.8, 1 - 0.5 * k, 0.7 + k * 0.8); });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// --- 小巨蛋: the Taipei Arena, a wide low dome on a ring of glass, a plaza with flags and a big screen
def('arena', ['round', 'skyP'], (G, B) => {
  lay(B, circleShape(3.25), 0.08, 'walk');
  lay(B, ellipseShape(2.75, 2.0), 0.05, 'concrete', 0, -0.35, H0 + 0.08);
  const ar = piece(G, 0, -0.45, H0 + 0.08);
  const oval = geo => geo.scale(1, 1, 0.72);
  add(ar, mesh(oval(cylG(2.35, 2.45, 0.5, 40)), 'navy'));
  add(ar, mesh(oval(cylG(2.18, 2.22, 0.55, 40)), 'glassB'), 0, 0.5, 0);
  add(ar, mesh(oval(ringG(2.24, 0.06, 40)), 'yellow', 'band'), 0, 0.52, 0);
  add(ar, mesh(oval(dome(2.32, 0.95, 40)), 'white'), 0, 1.05, 0);
  for (const r of [1.55, 0.85]) add(ar, mesh(oval(ringG(r, 0.035, 36)), 'metal'), 0, 1.05 + 0.95 * Math.sqrt(1 - (r / 2.32) ** 2), 0);
  add(ar, mesh(slab(1.5, 0.55, 0.08, 0.1), 'white'), 0, 0.55, 1.62);
  for (const s of [-1, 1]) add(ar, mesh(cylG(0.035, 0.035, 0.55, 8), 'white'), s * 0.62, 0, 1.82);
  const sg = piece(G, 2.25, 1.7);
  add(sg, mesh(cylG(0.05, 0.06, 0.95, 8), 'metal'));
  add(sg, mesh(slab(0.95, 0.14, 0.62, 0.04), 'dark'), 0, 0.95, 0);
  add(sg, mesh(boxG(0.8, 0.48, 0.03), 'glow', 'screen'), 0, 1.02, 0.07);
  const fl = piece(G, -1.7, 2.15);
  [-0.35, 0.35].forEach((x, i) => {
    add(fl, mesh(cylG(0.025, 0.025, 1.3, 6), 'metal'), x, 0, 0);
    const f = group(fl, 'flag' + i, x, 1.08, 0);
    add(f, mesh(boxG(0.42, 0.22, 0.03), i ? 'teal' : 'yellow'), 0.21, 0, 0);
  });
  tree(piece(G, -2.65, 0.85), 0, 0, 0.7, 'tc0');
}, (o, list) => {
  const band = o('band'), screen = o('screen'), flags = list('flag'), crowns = list('tc');
  const hot = mat('glowHot'), cool = mat('glow'), y = mat('yellow'), w = mat('white');
  return t => {
    band.material = Math.floor(t * 2) % 2 ? y : w;
    screen.material = Math.sin(t * 2.2) > 0 ? hot : cool;
    flags.forEach((f, i) => { f.rotation.y = 0.3 * Math.sin(t * 3 + i * 1.3); });
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.3 + i); });
  };
});

// --- 市府大樓: Taipei City Hall in the 信義計畫區 — a tall middle block, two wings, a plaza fountain, a flag
def('cityhall', ['square', 'butter'], (G, B) => {
  lay(B, rrShape(6.4, 3.0, 0.4), 0.08, 'walk', 0, 1.55);
  lay(B, circleShape(0.78), 0.12, 'concrete', 0, 1.7);
  lay(B, circleShape(0.62), 0.06, 'water', 0, 1.7, H0 + 0.12);
  const hall = piece(G, 0, -1.45);
  add(hall, mesh(slab(2.2, 1.6, 2.8, 0.08), 'paper'));
  add(hall, mesh(slab(2.32, 1.72, 0.12, 0.1), 'navy'), 0, 2.8, 0);
  for (const sx of [-1, 1]) {
    add(hall, mesh(slab(1.5, 1.3, 1.9, 0.08), 'paper'), sx * 1.85, 0, 0.1);
    add(hall, mesh(slab(1.6, 1.4, 0.1, 0.1), 'navy'), sx * 1.85, 1.9, 0.1);
    for (const y of [0.55, 1.0, 1.45]) for (const x of [1.4, 1.85, 2.3]) add(hall, mesh(winG(), 'window'), sx * x, y, 0.77);
  }
  for (const y of [0.55, 1.0, 1.45, 1.9, 2.35]) for (const x of [-0.7, -0.35, 0.35, 0.7]) add(hall, mesh(winG(), 'window'), x, y, 0.81);
  add(hall, mesh(boxG(0.5, 0.6, 0.04), 'glassB'), 0, 0, 0.81);
  for (const x of [-0.4, -0.13, 0.13, 0.4]) add(hall, mesh(cylG(0.04, 0.04, 0.62, 8), 'white'), x, 0, 0.98);
  add(hall, mesh(slab(1.1, 0.4, 0.07, 0.06), 'white'), 0, 0.62, 0.98);
  const ft = piece(G, 0, 1.7, H0 + 0.12);
  add(ft, mesh(cylG(0.07, 0.1, 0.32, 10), 'concrete'));
  add(ft, mesh(ell(0.12, 0.3, 0.12, 12, 10), 'glowHot', 'jet'), 0, 0.42, 0);
  const fp = piece(G, 2.5, 1.05);
  add(fp, mesh(cylG(0.03, 0.035, 2.1, 8), 'metal'));
  const fg = group(fp, 'flag', 0, 1.62, 0);
  add(fg, mesh(boxG(0.6, 0.38, 0.03), 'red'), 0.3, 0, 0);
  add(fg, mesh(boxG(0.3, 0.19, 0.035), 'navy'), 0.15, 0.19, 0);
  tree(piece(G, -2.65, 2.45), 0, 0, 0.7, 'tc0');
  tree(piece(G, 2.7, 2.65), 0, 0, 0.6, 'tc1');
}, (o, list) => {
  const jet = o('jet'), flag = o('flag'), crowns = list('tc');
  return t => {
    jet.scale.set(1, 0.8 + 0.3 * Math.sin(t * 5), 1);
    flag.rotation.y = 0.25 * Math.sin(t * 2.4);
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.3 + i * 1.5); });
  };
});

// --- 公館路口: the old roundabout made a plain crossroads — zebra crossings, traffic lights, cars taking turns
def('crossing', ['square', 'peach'], (G, B) => {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lay(B, rrShape(2.5, 2.5, 0.35), 0.1, 'walk', sx * 2.13, sz * 2.13);
  lay(B, rrShape(6.76, 1.7, 0.15), 0.06, 'road');
  lay(B, rrShape(1.7, 6.76, 0.15), 0.061, 'road');
  const zb = once('zebra', () => boxG(0.13, 0.02, 0.55));
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const u = -0.56 + i * 0.28;
    add(B, mesh(zb, 'white'), u, H0 + 0.062, s * 1.2).rotation.y = Math.PI / 2;
    add(B, mesh(zb, 'white'), s * 1.2, H0 + 0.062, u);
  }
  [[1.1, 1.1, 'x'], [-1.1, -1.1, 'z']].forEach(([x, z, k]) => {
    const tl = piece(G, x, z);
    add(tl, mesh(cylG(0.04, 0.05, 1.2, 8), 'dark'));
    add(tl, mesh(slab(0.3, 0.22, 0.62, 0.05), 'dark'), 0, 1.0, 0);
    add(tl, mesh(once('lampR', () => discZ(0.08, 0.05, 12)), 'red', 'stop' + k), 0, 1.45, 0.12);
    add(tl, mesh(once('lampG', () => discZ(0.08, 0.05, 12)), 'green', 'go' + k), 0, 1.18, 0.12);
  });
  tree(piece(G, 2.5, -2.4), 0, 0, 0.75, 'tc0');
  tree(piece(G, -2.5, 2.45), 0, 0, 0.65, 'tc1');
  toyCar(G, 'carx', 'blue', -2.6, 0.38);
  const cz = toyCar(G, 'carz', 'yellow', -0.38, 2.6);
  cz.rotation.y = Math.PI / 2;   // heading -z
}, (o, list) => {
  const sx = o('stopx'), gx = o('gox'), sz = o('stopz'), gz = o('goz'), cx = o('carx'), cz = o('carz'), crowns = list('tc');
  const red = mat('red'), green = mat('green'), off = mat('dark');
  // each car: 3 s waiting at its line, 3 s driving across while its light is green
  const drive = (u, wait) => (u < 0.5 ? -3.0 + (wait + 3.0) * smooth(u / 0.5) : wait + (3.2 - wait) * ((u - 0.5) / 0.5));
  return t => {
    const xGo = (t % 6) >= 3, zGo = !xGo;
    sx.material = xGo ? off : red; gx.material = xGo ? green : off;
    sz.material = zGo ? off : red; gz.material = zGo ? green : off;
    const ux = ((t + 0) % 6) / 6, uz = ((t + 3) % 6) / 6;
    cx.position.x = drive(ux, -1.95); cx.visible = Math.abs(cx.position.x) < 3.05;
    cz.position.z = -drive(uz, -1.95); cz.visible = Math.abs(cz.position.z) < 3.05;
    crowns.forEach((c, i) => { c.rotation.z = 0.04 * Math.sin(t * 1.2 + i * 2); });
  };
});

// ---------------------------------------------------------------- public API
export const SCENERY_IDS = Object.keys(DEFS);

const easeOutBack = k => { const c = 1.9; const x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
function popScale(obj, k) {
  if (k <= 0) { obj.scale.setScalar(1e-4); obj.visible = false; return; }
  obj.visible = true;
  if (k >= 1) { obj.scale.set(1, 1, 1); return; }
  const e = Math.max(1e-4, easeOutBack(k));
  const w = Math.sin(k * Math.PI * 2.4) * (1 - k);
  obj.scale.set(e * (1 - 0.18 * w), e * (1 + 0.3 * w), e * (1 - 0.18 * w));
}

const protos = new Map();
export function createScenery(id) {
  const d = DEFS[id];
  if (!d) return null;
  let proto = protos.get(id);
  if (!proto) {
    proto = new THREE.Group();
    popSlot = 1;
    const base = plate(proto, d.base[0], d.base[1]);
    d.build(proto, base);
    proto.traverse(o => { if (o.isMesh) o.castShadow = true; });
    protos.set(id, proto);
  }
  const g = proto.clone();
  g.name = 'scenery:' + id;
  const base = g.getObjectByName('base');
  const pieces = [];
  g.traverse(o => { if (o.userData.popI !== undefined) pieces.push(o); });
  const slots = [...new Set(pieces.map(p => p.userData.popI))].sort((a, b) => a - b);
  const startOf = new Map(slots.map((s, i) => [s, 0.15 + 0.47 * (slots.length > 1 ? i / (slots.length - 1) : 0)]));
  const byName = n => g.getObjectByName(n) || (console.warn('scenery', id, 'missing', n), new THREE.Object3D());
  const list = prefix => { const r = []; for (let i = 0; ; i++) { const n = g.getObjectByName(prefix + i); if (!n) break; r.push(n); } return r; };
  const tick = d.tick ? d.tick(byName, list, g) : null;
  g.userData.id = id;
  g.userData.tick = (t, dt) => { if (tick) tick(t, dt); };
  g.userData.pop = k => {
    k = Math.min(1, Math.max(0, k));
    popScale(base, k / 0.3);
    for (const p of pieces) popScale(p, (k - startOf.get(p.userData.popI)) / 0.38);
  };
  return g;
}
