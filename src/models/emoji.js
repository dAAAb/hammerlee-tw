// Inline 3D emoji: chunky little "cookie / token / toy" objects that sit inside a line of 3D text on a bubble.
// Every model: footprint about 1 x 1 em centred on the group origin (x, z within ±0.55), standing on y = 0,
// at most 0.7 em tall. The camera looks almost straight down, so the top (+y) carries the read and the front
// (+z) shows as a band below it. Each id is built once as a prototype; makeEmoji() hands out clones that
// share geometry and materials, and gives each clone its own idle tick.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { EMOJI } from './catalog.js';

export const EMOJI_NAMES = EMOJI.slice();

// ---------------------------------------------------------------- palettes (besides the shared PAL keys)
const P = {
  eye:    { l: '#3d3532', m: '#2b2522', d: '#171311' },
  heart:  { l: '#ff6d86', m: '#e8435f', d: '#86203a' },
  cherry: { l: '#ff6b5e', m: '#e0473b', d: '#7a1d16' },
  cheek:  { l: '#ffb1c0', m: '#f48ea5', d: '#b2536a' },
  mouth:  { l: '#7a302b', m: '#55201c', d: '#2e0f0d' },
  tongue: { l: '#ff8d8d', m: '#ea6767', d: '#8c2d2d' },
  tear:   { l: '#c4ecff', m: '#86cdf3', d: '#3b7fae' },
  tan:    { l: '#f6d3a2', m: '#e0a86c', d: '#7e5128' },
  brown:  { l: '#b07a48', m: '#8d5a33', d: '#4a2b15' },
  window: { l: '#4f7fbf', m: '#3a64a0', d: '#1d3a66' },
  tea:    { l: '#f3c565', m: '#d79a35', d: '#7a4f12' },
  coinD:  { l: '#f6c444', m: '#d99e1a', d: '#79500a' },
  pine:   { l: '#ffd44a', m: '#efa62a', d: '#875212' },
  rubber: { l: '#4b4f5c', m: '#353843', d: '#1c1e25' },
  stripe: { l: '#e98a2c', m: '#c96a17', d: '#6e3305' },
  nipple: { l: '#ffe2a8', m: '#f4c070', d: '#93652a' },
  brick:  { l: '#d9826a', m: '#b8604a', d: '#5e2a1d' },
  sponge: { l: '#ffe7b0', m: '#f3c97a', d: '#9a7134' },
  glow:   { l: '#c8fffb', m: '#8ff0ea', d: '#2aa9a6' },
};
const mat = p => toon(typeof p === 'string' ? (P[p] || p) : p);

// ---------------------------------------------------------------- small builders
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function mesh(geo, pal, name) {
  const m = new THREE.Mesh(geo, mat(pal));
  m.castShadow = true;
  if (name) m.name = name;
  return m;
}
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
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }
function heartShape(w) {
  const s = new THREE.Shape(), k = w / 32, N = 56;
  for (let i = 0; i < N; i++) {
    const t = i / N * TAU;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    i ? s.lineTo(x * k, (y + 2.5) * k) : s.moveTo(x * k, (y + 2.5) * k);
  }
  return s;
}
function starShape(R, r, n = 5) {
  const pts = [], off = (R - R * Math.cos(Math.PI / n)) / 2;
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R;
    pts.push([q * Math.cos(a), q * Math.sin(a) - off]);
  }
  return polyShape(pts);
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
function triShape(base, len) { return polyShape([[-base / 2, -len / 2], [base / 2, -len / 2], [0, len / 2]]); }
function arcBand(r0, r1) { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI, false); s.absarc(0, 0, r0, Math.PI, 0, true); return s; }
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

// Extrude a floor shape upward from y = 0 to y = h with a rounded (bevelled) rim. The bevel grows the outline by b.
function puff(shape, h, b = 0.05, segs = 3, curve = 12) {
  b = Math.min(b, h * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, h - 2 * b), bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b,
    bevelSegments: segs, curveSegments: curve, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  return g;
}
// Rounded slab with an exact w x d footprint.
function slab(w, d, h, r = 0.05, b = 0.03) { return puff(rrShape(w - 2 * b, d - 2 * b, Math.max(0.001, r - b)), h, b); }
// Extrude a side profile (x right, y up) along z, centred on z = 0, total thickness `depth`.
function prism(shape, depth, b = 0.03, segs = 2, curve = 10) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, depth - 2 * b), bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b,
    bevelSegments: segs, curveSegments: curve, steps: 1,
  });
  g.translate(0, 0, -depth / 2 + b);
  return g;
}
function ell(rx, ry, rz, w = 16, h = 12) { return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz); }
function dome(r, h, seg = 20) { return new THREE.SphereGeometry(1, seg, Math.ceil(seg / 3) + 2, 0, TAU, 0, Math.PI / 2).scale(r, h, r); }
function between(geo, a, b) {   // orient a +y-aligned geometry's mesh from point a to point b
  const d = b.clone().sub(a), len = d.length();
  return { len, pos: a.clone().add(b).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()) };
}
function rod(parent, a, b, r, pal, seg = 10) {
  const { len, pos, q } = between(null, a, b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), pal);
  m.position.copy(pos); m.quaternion.copy(q); parent.add(m);
  return m;
}
function capsule(parent, a, b, r, pal, seg = 12) {
  const { len, pos, q } = between(null, a, b);
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg), pal);
  m.position.copy(pos); m.quaternion.copy(q); parent.add(m);
  return m;
}
// a tube through points (Vector3), with round caps
function stroke(parent, pts, r, pal, { closed = false, seg = 0, name } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const g = new THREE.Group(); if (name) g.name = name;
  g.add(mesh(new THREE.TubeGeometry(curve, seg || Math.max(8, pts.length * 6), r, 6, closed), pal));
  if (!closed) {
    const cap = new THREE.SphereGeometry(r, 8, 6);
    add(g, mesh(cap, pal), pts[0].x, pts[0].y, pts[0].z);
    const e = pts[pts.length - 1];
    add(g, mesh(cap, pal), e.x, e.y, e.z);
  }
  parent.add(g);
  return g;
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// points on a dome (radius r, height h, base at y = 0) and their outward normals
function domePt(r, h, x, z, lift = 0) {
  const q = Math.max(0, 1 - (x * x + z * z) / (r * r));
  const y = h * Math.sqrt(q);
  const n = new THREE.Vector3(x / (r * r), y / (h * h), z / (r * r)).normalize();
  return { p: new THREE.Vector3(x, y, z).addScaledVector(n, lift), n };
}
function onDome(obj, r, h, x, z, lift = 0) {
  const { p, n } = domePt(r, h, x, z, lift);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(UP, n);
  return obj;
}
function domeStroke(parent, r, h, xz, rad, pal, lift = 0) {
  return stroke(parent, xz.map(([x, z]) => domePt(r, h, x, z, lift).p), rad, pal);
}
// lift a whole object so its lowest point sits on y = 0
function sit(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box.min.y;
  return obj;
}

// ---------------------------------------------------------------- face parts for dome faces
const G_EYE = ell(0.062, 0.05, 0.088, 12, 8);
const G_CHEEK = ell(0.08, 0.03, 0.055, 12, 6);
function dotEyes(b, r, h, x, z) { for (const s of [-1, 1]) b.add(onDome(mesh(G_EYE, 'eye'), r, h, s * x, z, -0.014)); }
function cheeks(b, r, h, x, z) { for (const s of [-1, 1]) b.add(onDome(mesh(G_CHEEK, 'cheek'), r, h, s * x, z, -0.012)); }
function smileLine(b, r, h, w, z0, dz, rad = 0.036) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const u = -1 + i / 4; pts.push([w * u, z0 + dz * (1 - u * u)]); }
  domeStroke(b, r, h, pts, rad, 'mouth');
}

// ---------------------------------------------------------------- the models
const DEFS = {};
function def(name, build, tick) { DEFS[name] = { build, tick }; }
const wave01 = (t, f) => 0.5 + 0.5 * Math.sin(t * f);

def('heart', G => {
  const b = add(G, mesh(puff(heartShape(0.68), 0.34, 0.1, 3, 16), 'heart', 'beat'));
  const gl = add(b, mesh(ell(0.08, 0.03, 0.05), 'white'), -0.2, 0.332, -0.2);
  gl.rotation.y = 0.6;
}, o => {
  const b = o('beat');
  return t => {
    const u = t % 1.3;
    const k = Math.exp(-(((u - 0.12) / 0.07) ** 2)) + 0.55 * Math.exp(-(((u - 0.36) / 0.08) ** 2));
    b.scale.setScalar(1 + 0.07 * k);
  };
});

def('sparkle', G => {
  add(G, mesh(puff(sparkShape(0.33, 0.075), 0.26, 0.05, 2), 'yellow', 'big'), -0.1, 0, 0.07);
  add(G, mesh(puff(sparkShape(0.15, 0.035), 0.2, 0.035, 2), 'yellow', 's1'), 0.3, 0, -0.28);
  add(G, mesh(puff(sparkShape(0.1, 0.025), 0.16, 0.03, 2), 'gold', 's2'), 0.31, 0, 0.3);
}, o => {
  const a = o('big'), b = o('s1'), c = o('s2');
  return t => {
    a.rotation.y = 0.12 * Math.sin(t * 1.3);
    b.scale.setScalar(0.78 + 0.28 * wave01(t, 3.1));
    c.scale.setScalar(0.78 + 0.28 * wave01(t + 1.7, 3.1));
  };
});

function faceDome(G, pal = 'yellow') {
  const r = 0.46, h = 0.36;
  const b = group(G, 'body');
  add(b, mesh(dome(r, h, 24), pal));
  return { b, r, h };
}
const squash = o => { const b = o('body'); return t => { const k = Math.sin(t * 2.2); b.scale.set(1 - 0.015 * k, 1 + 0.035 * k, 1 - 0.015 * k); }; };

def('smile', G => {
  const { b, r, h } = faceDome(G);
  dotEyes(b, r, h, 0.15, -0.07);
  smileLine(b, r, h, 0.19, 0.08, 0.1);
  cheeks(b, r, h, 0.29, 0.1);
}, squash);

def('laugh', G => {
  const { b, r, h } = faceDome(G);
  // > < squeezed eyes
  for (const s of [-1, 1]) domeStroke(b, r, h, [[s * 0.23, -0.17], [s * 0.1, -0.1], [s * 0.23, -0.03]], 0.036, 'eye');
  // big open D mouth with a tongue
  const ms = new THREE.Shape();
  ms.moveTo(-0.18, 0.06); ms.lineTo(0.18, 0.06); ms.absellipse(0, 0.06, 0.18, 0.14, 0, -Math.PI, true);
  const mouth = mesh(puff(ms, 0.1, 0.02, 2), 'mouth');
  const { p, n } = domePt(r, h, 0, 0.12);
  mouth.position.copy(p).addScaledVector(n, -0.08);
  mouth.quaternion.setFromUnitVectors(UP, n);
  b.add(mouth);
  add(mouth, mesh(puff(circleShape(0.075), 0.03, 0.012, 2), 'tongue'), 0, 0.08, 0.06).scale.set(1.2, 1, 0.6);
  // tears of joy
  const tg = ell(0.05, 0.035, 0.085, 10, 8);
  for (const s of [-1, 1]) b.add(onDome(mesh(tg, 'tear'), r, h, s * 0.38, 0.02, -0.01));
}, o => {
  const b = o('body');
  return t => {
    const k = Math.sin(t * 15) * Math.max(0, Math.sin(t * 1.6));
    b.rotation.z = 0.035 * k;
    b.scale.y = 1 + 0.03 * Math.abs(k);
  };
});

def('thumb', G => {
  const b = group(G, 'body', 0.07, 0, 0);
  add(b, mesh(slab(0.18, 0.5, 0.27, 0.06, 0.04), 'blue'), -0.38, 0, 0.17);
  add(b, mesh(slab(0.36, 0.48, 0.25, 0.12, 0.06), 'skin'), -0.12, 0, 0.17);
  [0.38, 0.37, 0.35, 0.31].forEach((w, i) => add(b, mesh(slab(w, 0.122, 0.29, 0.061, 0.035), 'skin'), -0.08 + w / 2, 0, -0.01 + i * 0.113));
  const th = add(b, mesh(slab(0.17, 0.46, 0.28, 0.085, 0.05), 'skin'), -0.1, 0, -0.21);
  th.rotation.y = -0.12;
}, o => { const b = o('body'); return t => { b.rotation.y = 0.06 * Math.sin(t * 1.4); }; });

def('star', G => {
  const s = add(G, mesh(puff(starShape(0.39, 0.19), 0.3, 0.08, 3), 'yellow', 'star'));
  add(s, mesh(ell(0.065, 0.025, 0.04), 'white'), -0.1, 0.298, -0.12).rotation.y = 0.5;
}, o => { const s = o('star'); return t => { s.rotation.y = 0.2 * Math.sin(t * 0.9); }; });

def('party', G => {
  // the popper: a striped cone, tip on the bubble at lower left, mouth up-right
  const cone = new THREE.Group();
  const L = 0.5, R = 0.18, cuts = [0, 0.3, 0.55, 0.78, 1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i] * L, y1 = cuts[i + 1] * L;
    add(cone, mesh(new THREE.CylinderGeometry(R * cuts[i + 1], R * cuts[i], y1 - y0, 14), i % 2 ? 'cherry' : 'yellow'), 0, (y0 + y1) / 2, 0);
  }
  const al = Math.atan(R / L);
  const d = new THREE.Vector3(Math.cos(al) * 0.7071, Math.sin(al), -Math.cos(al) * 0.7071);
  cone.quaternion.setFromUnitVectors(UP, d);
  add(G, cone, -0.34, 0, 0.34);
  sit(cone);
  const mouth = new THREE.Vector3(-0.34, 0, 0.34).addScaledVector(d, L);
  mouth.y = 0.2;
  // streamers curling out of the mouth
  const sp = (pal, pts) => stroke(G, [mouth.clone(), ...pts.map(a => v3(...a))], 0.03, pal);
  sp('teal', [[0.12, 0.22, -0.2], [0.04, 0.12, -0.34], [0.16, 0.05, -0.45]]);
  sp('pink', [[0.2, 0.2, -0.06], [0.32, 0.12, -0.02], [0.44, 0.04, -0.14]]);
  sp('blue', [[0.2, 0.24, -0.2], [0.32, 0.14, -0.3], [0.4, 0.05, -0.43]]);
  // confetti
  const cg = new THREE.BoxGeometry(0.075, 0.025, 0.045), dg = new THREE.SphereGeometry(0.032, 8, 6);
  const conf = group(G, 'conf');
  [[-0.12, 0.14, -0.3, 'yellow', 0.4], [-0.02, 0.06, -0.46, 'cherry', 1.2], [0.27, 0.16, -0.36, 'yellow', 2.1],
   [0.42, 0.08, 0.1, 'teal', 0.7], [0.3, 0.05, 0.24, 'purple', 1.9], [0.12, 0.1, -0.12, 'pink', 2.6]]
    .forEach(([x, y, z, pal, r]) => { const m = add(conf, mesh(cg, pal), x, y, z); m.rotation.set(r, r * 1.7, r * 0.6); });
  [[-0.24, 0.12, -0.16, 'blue'], [0.46, 0.06, -0.3, 'yellow'], [0.18, 0.12, 0.14, 'cherry']]
    .forEach(([x, y, z, pal]) => add(conf, mesh(dg, pal), x, y, z));
}, o => {
  const c = o('conf');
  return t => { c.children.forEach((m, i) => { m.rotation.y += 0.02 * (i % 2 ? 1 : -1); }); c.position.y = 0.012 * Math.sin(t * 2.4); };
});

def('flower', G => {
  const f = group(G, 'f');
  const lg = ell(0.09, 0.035, 0.17, 12, 8);
  for (const a of [Math.PI * 0.8, Math.PI * 1.2]) { const m = add(f, mesh(lg, 'leaf'), Math.sin(a) * 0.34, 0.03, -Math.cos(a) * 0.34); m.rotation.y = -a; }
  const pg = ell(0.155, 0.09, 0.21, 16, 10);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; const m = add(f, mesh(pg, 'pink'), Math.sin(a) * 0.23, 0.085, -Math.cos(a) * 0.23); m.rotation.y = -a; }
  add(f, mesh(dome(0.14, 0.2, 16), 'yellow'), 0, 0.07, 0);
}, o => { const f = o('f'); return t => { f.rotation.y = 0.14 * Math.sin(t * 0.8); }; });

def('sun', G => {
  const rays = group(G, 'rays');
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, len = i % 2 ? 0.1 : 0.15;
    const m = add(rays, mesh(puff(triShape(0.15, len), 0.1, 0.025, 2), 'orange'), Math.sin(a) * (0.31 + len / 2), 0, -Math.cos(a) * (0.31 + len / 2));
    m.rotation.y = -a;
  }
  const r = 0.3, h = 0.28;
  const b = group(G, 'core');
  add(b, mesh(dome(r, h, 22), 'yellow'));
  for (const s of [-1, 1]) b.add(onDome(mesh(ell(0.045, 0.04, 0.065, 10, 8), 'eye'), r, h, s * 0.1, -0.05, -0.012));
  smileLine(b, r, h, 0.11, 0.06, 0.06, 0.03);
}, o => { const r = o('rays'); return t => { r.rotation.y = -t * 0.35; }; });

// side-profile helper: rounded rect in x/y with its own corner radii [bl, br, tr, tl]
function profile(x0, y0, x1, y1, [bl, br, tr, tl]) {
  const s = new THREE.Shape();
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0); s.absarc(x1 - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - tr); s.absarc(x1 - tr, y1 - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y1); s.absarc(x0 + tl, y1 - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl); s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}

def('train', G => {
  const D = 0.32, zf = D / 2;
  add(G, mesh(prism(profile(-0.46, 0.1, 0.46, 0.58, [0.05, 0.06, 0.24, 0.09]), D, 0.03), 'white'));
  add(G, mesh(new THREE.BoxGeometry(0.9, 0.07, 0.02), 'blue'), -0.03, 0.2, zf);
  const wg = new THREE.BoxGeometry(0.15, 0.17, 0.02);
  for (const x of [-0.33, -0.14, 0.05]) add(G, mesh(wg, 'window'), x, 0.39, zf);
  add(G, mesh(prism(profile(0, 0, 0.13, 0.17, [0.02, 0.02, 0.08, 0.02]), 0.02, 0), 'window'), 0.25, 0.31, zf);
  add(G, mesh(slab(0.3, 0.18, 0.06, 0.04, 0.02), 'metal'), -0.12, 0.6, 0);
  const bg = new THREE.BoxGeometry(0.24, 0.1, 0.22), wh = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12).rotateX(Math.PI / 2);
  for (const x of [-0.27, 0.27]) {
    add(G, mesh(bg, 'rubber'), x, 0.05, 0);
    for (const dx of [-0.065, 0.065]) add(G, mesh(wh, 'dark'), x + dx, 0.055, 0.11);
  }
  add(G, mesh(new THREE.SphereGeometry(0.035, 8, 6), 'yellow'), 0.47, 0.2, 0.08);
});

def('hospital', G => {
  add(G, mesh(slab(0.8, 0.58, 0.48, 0.07, 0.03), 'white'), 0, 0, 0.03);
  add(G, mesh(puff(crossShape(0.38, 0.135), 0.07, 0.022, 2), 'cherry'), 0, 0.47, 0.01);
  const zf = 0.03 + 0.29;
  const wg = new THREE.BoxGeometry(0.11, 0.11, 0.02);
  for (const x of [-0.29, -0.15, 0.15, 0.29]) add(G, mesh(wg, 'sky'), x, 0.32, zf);
  for (const x of [-0.29, 0.29]) add(G, mesh(wg, 'sky'), x, 0.14, zf);
  add(G, mesh(new THREE.BoxGeometry(0.17, 0.22, 0.02), 'blue'), 0, 0.11, zf);
});

def('house', G => {
  add(G, mesh(prism(polyShape([[-0.34, 0.02], [0.34, 0.02], [0.34, 0.27], [0, 0.55], [-0.34, 0.27]]), 0.42, 0.02), 'cream'), 0, 0, 0.08);
  add(G, mesh(prism(polyShape([[-0.48, 0.24], [0, 0.64], [0.48, 0.24], [0.48, 0.15], [0, 0.555], [-0.48, 0.15]]), 0.5, 0.025), 'cherry'), 0, 0, 0.07);
  add(G, mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), 'brick'), 0.24, 0.48, -0.06);
  const zf = 0.08 + 0.21;
  add(G, mesh(new THREE.BoxGeometry(0.15, 0.25, 0.02), 'wood'), 0.08, 0.125, zf);
  add(G, mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), 'sky'), -0.18, 0.2, zf);
  add(G, mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14).rotateX(Math.PI / 2), 'sky'), 0, 0.42, zf);
});

def('chip', G => {
  add(G, mesh(slab(0.62, 0.62, 0.14, 0.08, 0.03), 'navy'));
  const pg = new THREE.BoxGeometry(0.065, 0.05, 0.14);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2;
    for (const k of [-0.21, -0.07, 0.07, 0.21]) {
      const x = 0.37, m = mesh(pg, 'gold');
      m.position.set(Math.cos(a) * x - Math.sin(a) * k, 0.035, -Math.sin(a) * x - Math.cos(a) * k);
      m.rotation.y = a + Math.PI / 2;
      G.add(m);
    }
  }
  add(G, mesh(slab(0.34, 0.34, 0.06, 0.06, 0.018), 'teal'), 0, 0.135, 0);
  add(G, mesh(slab(0.16, 0.16, 0.045, 0.04, 0.012), 'glow', 'glow'), 0, 0.185, 0);
}, o => {
  const g = o('glow');
  const mats = ['#2ac9c9', '#6fe6e2', '#b2f7f3', '#e8fffd'].map(c => toon({ l: c, m: '#8ff0ea', d: '#2aa9a6' }));
  return t => { const k = wave01(t, 2.4); g.material = mats[Math.min(3, Math.floor(k * 4))]; };
});

def('ball', G => {
  const R = 0.37, k = 0.88;
  add(G, mesh(new THREE.SphereGeometry(R, 24, 16).scale(1, k, 1), 'white'), 0, R * k, 0);
  // baseball seam (tennis-ball curve), turned so the two arcs face each other left and right
  const a = 0.7, b = 0.3, c = 2 * Math.sqrt(a * b), pts = [];
  for (let i = 0; i < 64; i++) {
    const t = i / 64 * TAU;
    const u = a * Math.cos(t) + b * Math.cos(3 * t), v = a * Math.sin(t) - b * Math.sin(3 * t), w = c * Math.sin(2 * t);
    const x = (u - v) * Math.SQRT1_2, z = (u + v) * Math.SQRT1_2;
    pts.push(v3(R * x, R * k * (1 + w), R * z));
  }
  stroke(G, pts, 0.03, 'cherry', { closed: true, seg: 96 });
});

def('bridge', G => {
  // an arch bridge as a flat cookie over a strip of water
  add(G, mesh(slab(1.06, 0.34, 0.05, 0.12, 0.02), 'sky'), 0, 0, 0.17);
  const wl = [];
  for (let i = 0; i <= 8; i++) { const x = -0.2 + i * 0.05; wl.push(v3(x, 0.05, 0.2 - 0.02 * Math.sin(i * 1.6))); }
  stroke(G, wl, 0.022, 'white');
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.3);
  s.bezierCurveTo(-0.34, 0.36, 0.34, 0.36, 0.5, -0.3);
  s.lineTo(0.31, -0.3);
  s.absellipse(0, -0.3, 0.31, 0.3, 0, Math.PI, false);
  s.lineTo(-0.5, -0.3);
  add(G, mesh(puff(s, 0.18, 0.045, 3, 18), 'yellow'), 0, 0, -0.02);
  // railing posts along the top
  const pg = new THREE.SphereGeometry(0.04, 10, 8), rail = [];
  for (let i = 0; i <= 6; i++) {
    const t = 0.1 + i * 0.8 / 6, mt = 1 - t;
    const x = mt ** 3 * -0.5 + 3 * mt * mt * t * -0.34 + 3 * mt * t * t * 0.34 + t ** 3 * 0.5;
    const y = mt ** 3 * -0.3 + 3 * mt * mt * t * 0.36 + 3 * mt * t * t * 0.36 + t ** 3 * -0.3 - 0.07;
    add(G, mesh(pg, 'navy'), x, 0.19, -y - 0.02);
    rail.push(v3(x, 0.2, -y - 0.02));
  }
  stroke(G, rail, 0.02, 'navy');
});

def('bottle', G => {
  const B = group(G, 'b');
  B.rotation.y = Math.PI / 4;
  const R = 0.16, y = 0.18, ax = g => g.rotateZ(-Math.PI / 2);
  add(B, mesh(ax(new THREE.CylinderGeometry(R, R, 0.4, 18)), 'white'), -0.11, y, 0);
  add(B, mesh(ell(0.07, R, R, 18, 10), 'white'), -0.31, y, 0);
  add(B, mesh(ax(new THREE.CylinderGeometry(0.18, 0.18, 0.11, 18)), 'teal'), 0.14, y, 0);
  add(B, mesh(ell(0.13, 0.1, 0.1, 14, 10), 'nipple'), 0.25, y, 0);
  add(B, mesh(ell(0.05, 0.045, 0.045, 10, 8), 'nipple'), 0.37, y, 0);
  const hm = add(B, mesh(puff(heartShape(0.11), 0.03, 0.012, 2), 'heart'), -0.12, y + R - 0.018, 0);
  hm.rotation.y = -Math.PI / 4;
  for (const x of [-0.24, 0.02]) add(B, mesh(new THREE.BoxGeometry(0.018, 0.02, 0.09), 'sky'), x, y + R - 0.004, -0.06);
  B.position.x = -0.02;
  B.scale.setScalar(1.12);
});

def('dog', G => {
  const r = 0.38, h = 0.33;
  const b = group(G, 'body');
  add(b, mesh(dome(r, h, 22), 'tan'));
  const eg = ell(0.12, 0.055, 0.21, 12, 8);
  for (const s of [-1, 1]) {
    const ear = add(b, mesh(eg, 'brown', s < 0 ? 'earL' : 'earR'), s * 0.36, 0.17, -0.03);
    ear.rotation.set(0, s * -0.25, s * -0.55, 'YXZ');
  }
  const mz = mesh(ell(0.18, 0.08, 0.13, 14, 8), 'white');
  b.add(onDome(mz, r, h, 0, 0.13, -0.035));
  const nose = mesh(ell(0.07, 0.045, 0.05, 10, 8), 'eye');
  b.add(onDome(nose, r, h, 0, 0.09, 0.03));
  dotEyes(b, r, h, 0.14, -0.08);
  add(b, mesh(ell(0.05, 0.02, 0.06, 10, 6), 'tongue'), 0, 0.12, 0.33);
}, o => {
  const L = o('earL'), R = o('earR');
  return t => { const k = Math.max(0, Math.sin(t * 1.7)) ** 6 * 0.25; L.rotation.z = 0.55 + k; R.rotation.z = -0.55 - k; };
});

def('cat', G => {
  const r = 0.37, h = 0.3;
  const b = group(G, 'body');
  for (const s of [-1, 1]) {
    const ear = group(b, null, s * 0.2, 0.12, -0.22);
    add(ear, mesh(puff(triShape(0.24, 0.22), 0.07, 0.025, 2), 'orange'));
    add(ear, mesh(puff(triShape(0.12, 0.11), 0.03, 0.01, 1), 'cheek'), 0, 0.06, -0.01);
    ear.rotation.set(0.85, s * -0.38, 0, 'YXZ');
  }
  add(b, mesh(dome(r, h, 22), 'orange'));
  for (const x of [-0.09, 0, 0.09]) domeStroke(b, r, h, [[x, -0.33], [x * 1.1, -0.21]], 0.028, 'stripe');
  dotEyes(b, r, h, 0.14, -0.05);
  b.add(onDome(mesh(ell(0.05, 0.03, 0.035, 10, 6), 'cheek'), r, h, 0, 0.07, -0.006));
  domeStroke(b, r, h, [[-0.08, 0.1], [-0.04, 0.15], [0, 0.11], [0.04, 0.15], [0.08, 0.1]], 0.022, 'mouth');
  for (const s of [-1, 1]) {
    domeStroke(b, r, h, [[s * 0.17, 0.07], [s * 0.3, 0.05], [s * 0.4, 0.04]], 0.016, 'eye', 0.004);
    domeStroke(b, r, h, [[s * 0.17, 0.12], [s * 0.29, 0.14], [s * 0.38, 0.17]], 0.016, 'eye', 0.004);
  }
}, squash);

def('tooth', G => {
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0.22);
  s.bezierCurveTo(-0.3, 0.38, -0.12, 0.42, 0, 0.32);
  s.bezierCurveTo(0.12, 0.42, 0.3, 0.38, 0.3, 0.22);
  s.bezierCurveTo(0.3, 0.05, 0.27, -0.08, 0.24, -0.2);
  s.bezierCurveTo(0.21, -0.36, 0.12, -0.38, 0.1, -0.26);
  s.bezierCurveTo(0.08, -0.16, 0.04, -0.12, 0, -0.12);
  s.bezierCurveTo(-0.04, -0.12, -0.08, -0.16, -0.1, -0.26);
  s.bezierCurveTo(-0.12, -0.38, -0.21, -0.36, -0.24, -0.2);
  s.bezierCurveTo(-0.27, -0.08, -0.3, 0.05, -0.3, 0.22);
  const b = group(G, 'body', 0, 0, 0.02);
  add(b, mesh(puff(s, 0.28, 0.07, 3, 10), 'white'));
  const top = 0.28;
  for (const x of [-0.11, 0.11]) add(b, mesh(ell(0.05, 0.04, 0.072, 10, 8), 'eye'), x, top, -0.12);
  for (const x of [-0.21, 0.21]) add(b, mesh(ell(0.065, 0.02, 0.045, 10, 6), 'cheek'), x, top, -0.03);
  const pts = [];
  for (let i = 0; i <= 6; i++) { const u = -1 + i / 3; pts.push(v3(0.09 * u, top + 0.005, -0.02 + 0.06 * (1 - u * u))); }
  stroke(b, pts, 0.028, 'mouth');
}, o => { const b = o('body'); return t => { b.rotation.y = 0.08 * Math.sin(t * 1.5); }; });

def('gift', G => {
  add(G, mesh(slab(0.66, 0.6, 0.32, 0.05, 0.03), 'cherry'), 0, 0, 0.03);
  add(G, mesh(slab(0.76, 0.7, 0.11, 0.05, 0.03), 'cherry'), 0, 0.3, 0.03);
  add(G, mesh(new THREE.BoxGeometry(0.13, 0.016, 0.72), 'yellow'), 0, 0.414, 0.03);
  add(G, mesh(new THREE.BoxGeometry(0.78, 0.016, 0.13), 'yellow'), 0, 0.414, 0.03);
  add(G, mesh(new THREE.BoxGeometry(0.13, 0.3, 0.02), 'yellow'), 0, 0.15, 0.335);
  add(G, mesh(new THREE.BoxGeometry(0.13, 0.11, 0.02), 'yellow'), 0, 0.355, 0.385);
  const lg = new THREE.TorusGeometry(0.095, 0.036, 8, 18);
  for (const s of [-1, 1]) {
    const m = add(G, mesh(lg, 'yellow'), s * 0.11, 0.45, 0.0);
    m.rotation.set(Math.PI / 2 - 0.55, 0, s * -0.35, 'YXZ');
    m.rotation.y = s * 0.45;
  }
  add(G, mesh(new THREE.SphereGeometry(0.058, 12, 8), 'yellow'), 0, 0.44, 0.03);
});

def('check', G => {
  add(G, mesh(slab(0.8, 0.8, 0.14, 0.2, 0.04), 'teal'));
  add(G, mesh(puff(strokeShape([[-0.21, -0.01], [-0.06, 0.14], [0.22, -0.17]], 0.056), 0.1, 0.03, 2), 'white', 'ck'), 0, 0.125, 0.01);
}, o => { const c = o('ck'); return t => { const k = Math.max(0, Math.sin(t * 2)) ** 8; c.scale.set(1 + 0.06 * k, 1 + 0.3 * k, 1 + 0.06 * k); }; });

def('hammer', G => {
  const H = group(G, 'h');
  const A = v3(-0.33, 0.065, 0.33), B = v3(0.17, 0.065, -0.17);
  rod(H, A, B, 0.065, 'wood', 12);
  const u = B.clone().sub(A).normalize();
  rod(H, A.clone().addScaledVector(u, -0.01), A.clone().addScaledVector(u, 0.2), 0.076, 'navy', 12);
  const head = add(H, mesh(slab(0.52, 0.23, 0.25, 0.06, 0.045), 'metal'), 0.2, 0, -0.2);
  head.rotation.y = -Math.PI / 4;
  const cap = slab(0.06, 0.25, 0.27, 0.03, 0.02);
  for (const s of [-1, 1]) { const m = add(head, mesh(cap, 'dark'), s * 0.255, -0.01, 0); }
});

def('helmet', G => {
  // the yellow hard hat in front view as a flat cookie: crown, centre rib, wide brim, navy badge
  const d = new THREE.Shape();
  d.moveTo(-0.34, -0.1); d.absarc(0, -0.1, 0.34, Math.PI, 0, true); d.lineTo(-0.34, -0.1);
  add(G, mesh(puff(d, 0.26, 0.06, 3, 20), 'yellow'), 0, 0, 0.0);
  add(G, mesh(slab(0.98, 0.17, 0.18, 0.08, 0.05), 'gold'), 0, 0, 0.17);
  add(G, mesh(slab(0.11, 0.3, 0.06, 0.05, 0.02), 'yellow'), 0, 0.23, -0.16);
  add(G, mesh(puff(circleShape(0.055), 0.05, 0.015, 2, 16), 'navy'), 0, 0.23, 0.04);
});

def('clock', G => {
  add(G, mesh(puff(circleShape(0.31), 0.2, 0.05, 3, 28), 'blue'), 0, 0, 0.05);
  for (const s of [-1, 1]) {
    const bell = mesh(dome(0.12, 0.13, 14), 'yellow');
    const dir = v3(s * 0.62, 0.35, -0.7).normalize();
    bell.quaternion.setFromUnitVectors(UP, dir);
    add(G, bell, s * 0.22, 0.11, -0.22);
  }
  for (const s of [-1, 1]) add(G, mesh(ell(0.06, 0.04, 0.06, 10, 6), 'metal'), s * 0.22, 0.03, 0.34);
  add(G, mesh(puff(circleShape(0.255), 0.04, 0.015, 2, 28), 'white'), 0, 0.19, 0.05);
  const tg = new THREE.BoxGeometry(0.035, 0.02, 0.065);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const m = add(G, mesh(tg, 'navy'), Math.sin(a) * 0.2, 0.232, 0.05 - Math.cos(a) * 0.2); m.rotation.y = -a; }
  const hr = add(G, mesh(new THREE.BoxGeometry(0.05, 0.025, 0.13).translate(0, 0, -0.06), 'navy', 'hr'), 0, 0.236, 0.05);
  hr.rotation.y = Math.PI / 3;
  add(G, mesh(new THREE.BoxGeometry(0.036, 0.025, 0.2).translate(0, 0, -0.09), 'navy', 'mn'), 0, 0.244, 0.05);
  add(G, mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10), 'yellow'), 0, 0.25, 0.05);
}, o => { const h = o('hr'), m = o('mn'); return t => { m.rotation.y = -t * 0.5; h.rotation.y = Math.PI / 3 - t * 0.5 / 12; }; });

def('mountain', G => {
  G = group(G); G.scale.y = 0.92;
  // two standing ridges (profiles extruded along z) so the front reads as the classic peak outline
  add(G, mesh(slab(1.04, 0.62, 0.04, 0.2, 0.015), 'leaf'), 0, 0, 0.02);
  add(G, mesh(prism(polyShape([[-0.5, 0], [-0.08, 0.64], [0.36, 0]]), 0.34, 0.03), 'teal'), 0, 0.02, -0.1);
  add(G, mesh(prism(polyShape([[-0.25, 0.38], [-0.08, 0.64], [0.095, 0.38], [0.03, 0.43], [-0.03, 0.37], [-0.09, 0.43], [-0.15, 0.37], [-0.2, 0.43]]), 0.37, 0.045), 'white'), 0, 0.02, -0.1);
  add(G, mesh(prism(polyShape([[-0.06, 0], [0.24, 0.42], [0.5, 0]]), 0.28, 0.03), 'leaf'), 0, 0.02, 0.15);
  add(G, mesh(prism(polyShape([[0.13, 0.27], [0.24, 0.42], [0.345, 0.28], [0.29, 0.31], [0.24, 0.27], [0.18, 0.31]]), 0.31, 0.045), 'white'), 0, 0.02, 0.15);
});

def('wave', G => {
  // the 🌊 curl as a flat cookie: blue curl, white foam on the crest, a white ripple line below
  const s = new THREE.Shape();
  s.moveTo(-0.46, -0.32);
  s.lineTo(0.48, -0.32);
  s.lineTo(0.48, -0.2);
  s.bezierCurveTo(0.26, -0.15, 0.1, 0.03, -0.02, 0.22);
  s.bezierCurveTo(-0.1, 0.35, -0.33, 0.35, -0.41, 0.19);
  s.bezierCurveTo(-0.46, 0.08, -0.38, -0.01, -0.28, 0.03);
  s.bezierCurveTo(-0.21, 0.06, -0.17, -0.04, -0.23, -0.11);
  s.bezierCurveTo(-0.29, -0.19, -0.38, -0.21, -0.46, -0.21);
  s.lineTo(-0.46, -0.32);
  const w = group(G, 'w', 0, 0, 0.02);
  add(w, mesh(puff(s, 0.2, 0.05, 3, 18), 'blue'));
  const fg = ell(0.065, 0.04, 0.06, 10, 8);
  for (const [x, y] of [[0.05, 0.1], [-0.05, 0.22], [-0.19, 0.27], [-0.32, 0.22], [-0.37, 0.1]]) add(w, mesh(fg, 'white'), x, 0.2, -y);
  const rip = [];
  for (let i = 0; i <= 12; i++) { const x = -0.38 + i * 0.065; rip.push(v3(x, 0.2, 0.235 - 0.03 * Math.sin(i * 1.3))); }
  stroke(w, rip, 0.026, 'white');
}, o => { const w = o('w'); return t => { w.rotation.y = 0.05 * Math.sin(t * 1.2); }; });

def('game', G => {
  add(G, mesh(slab(0.68, 0.34, 0.2, 0.15, 0.05), 'navy'), 0, 0, -0.04);
  const grip = puff(circleShape(0.13), 0.2, 0.05, 3, 18);
  for (const s of [-1, 1]) add(G, mesh(grip, 'navy'), s * 0.27, 0, 0.09);
  add(G, mesh(puff(crossShape(0.2, 0.068), 0.05, 0.015, 2), 'white'), -0.22, 0.19, -0.03);
  const bg = dome(0.045, 0.045, 12);
  [[0.22, -0.1, 'yellow'], [0.3, -0.03, 'cherry'], [0.22, 0.04, 'teal'], [0.14, -0.03, 'sky']].forEach(([x, z, p]) => add(G, mesh(bg, p), x, 0.195, z));
  const sg = slab(0.06, 0.03, 0.02, 0.015, 0.006);
  for (const s of [-1, 1]) add(G, mesh(sg, 'metal'), s * 0.05, 0.195, -0.08);
});

def('balloon', G => {
  const b = group(G, 'b');
  add(b, mesh(ell(0.3, 0.27, 0.34, 20, 14), 'cherry'), 0.04, 0.3, -0.1);
  const knot = add(b, mesh(new THREE.ConeGeometry(0.05, 0.07, 10), 'cherry'), 0.04, 0.3, 0.26);
  knot.rotation.x = -Math.PI / 2;
  const hl = add(b, mesh(ell(0.06, 0.03, 0.1, 10, 8), 'white'), -0.1, 0.5, -0.24);
  hl.rotation.set(-0.5, 0.5, 0.25);
  stroke(G, [v3(0.04, 0.29, 0.29), v3(0.0, 0.16, 0.35), v3(0.07, 0.05, 0.42), v3(0.0, 0.02, 0.5), v3(-0.1, 0.02, 0.52)], 0.016, 'dark');
}, o => { const b = o('b'); return t => { b.position.y = 0.012 * Math.sin(t * 1.6); b.rotation.z = 0.03 * Math.sin(t * 1.1); }; });

def('pineapple', G => {
  const p = group(G, 'p');
  p.rotation.y = -Math.PI / 4;
  p.scale.setScalar(1.15);
  p.position.set(-0.03, 0, 0.03);
  const bg = new THREE.IcosahedronGeometry(1, 1).scale(0.22, 0.2, 0.3);
  bg.computeVertexNormals();
  add(p, mesh(bg, 'pine'), 0, 0.2, 0.08);
  const lg = ell(0.06, 0.03, 0.17, 10, 6).translate(0, 0, -0.15);
  for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) {
    const m = add(p, mesh(lg, a === 0 ? 'leaf' : 'green'), 0, 0.25, -0.18);
    m.rotation.set(0.3 + Math.abs(a) * 0.15, a, 0, 'YXZ');
  }
}, o => { const p = o('p'); return t => { p.rotation.z = 0.04 * Math.sin(t * 1.2); }; });

def('tea', G => {
  // a cup of tea in side view as a flat cookie: cup with a teal band, tea surface, handle, saucer, steam
  const c = new THREE.Shape();
  c.moveTo(-0.27, 0.1); c.lineTo(0.27, 0.1);
  c.bezierCurveTo(0.27, -0.06, 0.24, -0.2, 0.14, -0.22);
  c.lineTo(-0.14, -0.22);
  c.bezierCurveTo(-0.24, -0.2, -0.27, -0.06, -0.27, 0.1);
  const cup = group(G, null, -0.05, 0, 0);
  add(cup, mesh(puff(c, 0.26, 0.05, 3, 14), 'white'));
  add(cup, mesh(new THREE.TorusGeometry(0.095, 0.04, 8, 18).rotateX(Math.PI / 2), 'white'), 0.3, 0.12, 0.03);
  add(cup, mesh(slab(0.46, 0.075, 0.04, 0.035, 0.012), 'teal'), 0, 0.245, 0.02);
  add(cup, mesh(ell(0.25, 0.03, 0.045, 18, 8), 'tea'), 0, 0.26, -0.085);
  add(G, mesh(slab(0.84, 0.1, 0.12, 0.05, 0.03), 'teal'), -0.03, 0, 0.27);
  const st = group(G, 'steam', -0.05, 0, 0);
  stroke(st, [v3(-0.09, 0.04, -0.17), v3(-0.04, 0.04, -0.25), v3(-0.11, 0.04, -0.33), v3(-0.06, 0.04, -0.42)], 0.034, 'sky');
  stroke(st, [v3(0.08, 0.04, -0.17), v3(0.13, 0.04, -0.24), v3(0.06, 0.04, -0.31), v3(0.11, 0.04, -0.39)], 0.034, 'sky');
}, o => { const s = o('steam'); return t => { s.position.z = -0.015 * (0.5 + 0.5 * Math.sin(t * 1.6)); s.position.x = -0.05 + 0.012 * Math.sin(t * 2.3); }; });

def('coin', G => {
  add(G, mesh(puff(circleShape(0.38), 0.14, 0.045, 3, 32), 'gold'));
  add(G, mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 36).rotateX(Math.PI / 2), 'coinD'), 0, 0.14, 0);
  const S = [[0.11, -0.13], [0.02, -0.17], [-0.09, -0.13], [-0.09, -0.05], [0.0, -0.01], [0.09, 0.03], [0.1, 0.12], [0.01, 0.17], [-0.11, 0.13]];
  stroke(G, S.map(([x, z]) => v3(x, 0.14, z)), 0.036, 'coinD');
  stroke(G, [v3(0, 0.14, -0.24), v3(0, 0.14, 0.24)], 0.03, 'coinD');
  add(G, mesh(puff(sparkShape(0.1, 0.022), 0.05, 0.012, 1), 'white', 'glint'), 0.25, 0.14, -0.24);
}, o => { const g = o('glint'); return t => { const k = Math.max(0, Math.sin(t * 1.8)); g.scale.setScalar(0.05 + k); }; });

def('bike', G => {
  const y = 0.05, W = (x, z) => v3(x, y, z);
  const wg = new THREE.TorusGeometry(0.2, 0.05, 8, 28).rotateX(Math.PI / 2), hg = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10);
  for (const x of [-0.28, 0.28]) { add(G, mesh(wg, 'rubber'), x, y, 0.1); add(G, mesh(hg, 'metal'), x, y, 0.1); }
  const R = W(-0.28, 0.1), Bb = W(-0.03, 0.1), S = W(-0.12, -0.13), H = W(0.17, -0.13), F = W(0.28, 0.1);
  for (const [a, b] of [[R, Bb], [R, S], [S, Bb], [S, H], [H, Bb], [H, F]]) rod(G, a, b, 0.042, 'yellow', 8);
  add(G, mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 16).rotateX(Math.PI / 2), 'metal'), -0.03, y, 0.1);
  rod(G, S, W(-0.14, -0.22), 0.03, 'metal', 6);
  add(G, mesh(ell(0.1, 0.045, 0.05, 12, 8), 'rubber'), -0.13, 0.07, -0.25);
  rod(G, H, W(0.19, -0.25), 0.032, 'metal', 6);
  rod(G, W(0.12, -0.27), W(0.27, -0.24), 0.034, 'rubber', 6);
  add(G, mesh(slab(0.15, 0.13, 0.12, 0.03, 0.02), 'navy'), 0.36, 0, -0.16);
});

def('book', G => {
  add(G, mesh(slab(0.98, 0.7, 0.05, 0.06, 0.015), 'navy'));
  const pg = slab(0.45, 0.62, 0.1, 0.04, 0.02), lg = new THREE.BoxGeometry(0.3, 0.02, 0.04);
  for (const s of [-1, 1]) {
    const p = add(G, mesh(pg, 'paper'), s * 0.235, 0.04, -0.005);
    p.rotation.z = s * 0.11;
    for (let i = 0; i < 4; i++) add(p, mesh(lg, 'sky'), -s * 0.02, 0.1, -0.18 + i * 0.12).scale.x = i === 3 ? 0.6 : 1;
  }
  add(G, mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), 'cherry'), 0.05, 0.05, 0.39);
});

def('drone', G => {
  add(G, mesh(slab(0.3, 0.34, 0.14, 0.1, 0.04), 'white'), 0, 0.1, 0);
  add(G, mesh(slab(0.09, 0.28, 0.025, 0.03, 0.008), 'blue'), 0, 0.235, 0);
  add(G, mesh(new THREE.SphereGeometry(0.06, 12, 8), 'eye'), 0, 0.15, 0.17);
  for (const s of [-1, 1]) {
    rod(G, v3(s * 0.1, 0.02, -0.15), v3(s * 0.1, 0.02, 0.15), 0.022, 'metal', 6);
    rod(G, v3(s * 0.1, 0.02, 0), v3(s * 0.07, 0.13, 0), 0.02, 'metal', 6);
  }
  const mg = new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), gg = new THREE.TorusGeometry(0.16, 0.022, 6, 28).rotateX(Math.PI / 2), pg = new THREE.BoxGeometry(0.27, 0.014, 0.05);
  let i = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 0.29, z = sz * 0.29;
    rod(G, v3(0, 0.18, 0), v3(x, 0.2, z), 0.034, 'navy', 8);
    add(G, mesh(mg, 'navy'), x, 0.2, z);
    add(G, mesh(gg, 'teal'), x, 0.22, z);
    add(G, mesh(pg, 'rubber', 'p' + i++), x, 0.243, z);
  }
}, o => {
  const ps = [0, 1, 2, 3].map(i => o('p' + i));
  return t => ps.forEach((p, i) => { p.rotation.y = t * 9 * (i % 3 ? 1 : -1) + i; });
});

def('cake', G => {
  const lg = new THREE.CylinderGeometry(0.36, 0.36, 0.11, 28);
  add(G, mesh(lg, 'sponge'), 0, 0.055, 0.02);
  add(G, mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.04, 28), 'white'), 0, 0.13, 0.02);
  add(G, mesh(lg, 'sponge'), 0, 0.205, 0.02);
  add(G, mesh(puff(circleShape(0.345), 0.08, 0.03, 2, 28), 'pink'), 0, 0.255, 0.02);
  const sg = ell(0.075, 0.07, 0.085, 12, 8);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; add(G, mesh(sg, 'cherry'), Math.sin(a) * 0.24, 0.345, 0.02 + Math.cos(a) * 0.24); }
  add(G, mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10), 'sky'), 0, 0.43, 0.02);
  add(G, mesh(ell(0.048, 0.08, 0.048, 10, 8).translate(0, 0.06, 0), 'yellow', 'flame'), 0, 0.53, 0.02);
}, o => { const f = o('flame'); return t => { const k = Math.sin(t * 11) * 0.5 + Math.sin(t * 7.3) * 0.5; f.scale.set(1 - 0.08 * k, 1 + 0.14 * k, 1 - 0.08 * k); f.rotation.z = 0.08 * Math.sin(t * 5.1); }; });

def('muscle', G => {
  add(G, mesh(slab(0.15, 0.32, 0.29, 0.05, 0.04), 'blue'), -0.42, 0, 0.22);
  capsule(G, v3(-0.38, 0.13, 0.22), v3(0.12, 0.13, 0.22), 0.13, 'skin');
  add(G, mesh(ell(0.2, 0.155, 0.15, 16, 12), 'skin', 'bi'), -0.1, 0.15, 0.1);
  capsule(G, v3(0.14, 0.12, 0.24), v3(0.22, 0.12, -0.2), 0.12, 'skin');
  add(G, mesh(ell(0.155, 0.13, 0.14, 14, 10), 'skin'), 0.22, 0.13, -0.3);
}, o => { const b = o('bi'); return t => { const k = Math.max(0, Math.sin(t * 2)) ** 3; b.scale.setScalar(1 + 0.12 * k); }; });

// a flat hand lying palm-down: fingers point -z (screen-up), thumb on side `ts`
function hand(ts) {
  const h = new THREE.Group();
  add(h, mesh(slab(0.26, 0.26, 0.12, 0.1, 0.04), 'skin'), 0, 0, 0.05);
  const fl = [0.15, 0.19, 0.18, 0.13];
  [-0.09, -0.03, 0.03, 0.09].forEach((x, i) => capsule(h, v3(x, 0.055, -0.04), v3(x, 0.055, -0.04 - fl[ts > 0 ? 3 - i : i]), 0.043, 'skin', 10));
  capsule(h, v3(ts * 0.1, 0.05, 0.1), v3(ts * 0.21, 0.05, -0.04), 0.05, 'skin', 10);
  return h;
}

def('clap', G => {
  G = group(G, 'body', 0.02, 0, 0.08); G.scale.setScalar(1.22);
  const L = add(G, hand(1), -0.13, 0, 0.1); L.name = 'L';
  L.rotation.y = -0.5;
  const R = add(G, hand(-1), 0.13, 0.05, 0.06); R.name = 'R';
  R.rotation.set(0, 0.5, -0.06, 'YXZ');
  const mk = group(G, 'mk');
  const pg = slab(0.05, 0.14, 0.05, 0.025, 0.012);
  [[0, -0.42, 0], [-0.22, -0.37, 0.55], [0.22, -0.37, -0.55]].forEach(([x, z, a]) => { add(mk, mesh(pg, 'yellow'), x, 0, z).rotation.y = a; });
}, o => {
  const L = o('L'), R = o('R'), mk = o('mk');
  return t => {
    const k = Math.max(0, Math.sin(t * 5)) ** 2;
    L.rotation.y = -0.5 - 0.14 * k; R.rotation.y = 0.5 + 0.14 * k;
    mk.scale.setScalar(0.7 + 0.35 * (1 - k));
  };
});

def('rainbow', G => {
  const bands = ['cherry', 'orange', 'yellow', 'leaf', 'blue'];
  const R0 = 0.48, w = 0.06, b = 0.012;
  bands.forEach((p, i) => {
    const r1 = R0 - i * w, r0 = r1 - w;
    add(G, mesh(puff(arcBand(r0 + b, r1 - b), 0.22 - i * 0.025, b, 1, 28), p), 0, 0, 0.14);
  });
  const cg = [ell(0.13, 0.1, 0.11, 12, 8), ell(0.1, 0.08, 0.09, 12, 8), ell(0.09, 0.07, 0.08, 12, 8)];
  for (const s of [-1, 1]) {
    add(G, mesh(cg[0], 'white'), s * 0.34, 0.08, 0.2);
    add(G, mesh(cg[1], 'white'), s * 0.44, 0.06, 0.15);
    add(G, mesh(cg[2], 'white'), s * 0.24, 0.05, 0.25);
  }
});

def('bus', G => {
  const D = 0.34, zf = D / 2;
  add(G, mesh(prism(profile(-0.46, 0.12, 0.46, 0.6, [0.05, 0.05, 0.12, 0.08]), D, 0.03), 'blue'));
  add(G, mesh(slab(0.86, 0.28, 0.03, 0.06, 0.012), 'white'), -0.01, 0.62, 0);
  const wg = new THREE.BoxGeometry(0.15, 0.15, 0.02);
  for (const x of [-0.33, -0.15, 0.03]) add(G, mesh(wg, 'glass'), x, 0.43, zf);
  add(G, mesh(new THREE.BoxGeometry(0.15, 0.26, 0.02), 'glass'), 0.3, 0.38, zf);
  add(G, mesh(new THREE.BoxGeometry(0.82, 0.04, 0.02), 'yellow'), -0.03, 0.26, zf);
  const tg = new THREE.CylinderGeometry(0.105, 0.105, 0.07, 16).rotateX(Math.PI / 2), hg = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10).rotateX(Math.PI / 2);
  for (const x of [-0.27, 0.27]) { add(G, mesh(tg, 'rubber'), x, 0.105, zf - 0.02); add(G, mesh(hg, 'metal'), x, 0.105, zf - 0.01); }
  add(G, mesh(new THREE.SphereGeometry(0.035, 8, 6), 'yellow'), 0.47, 0.2, 0.1);
});

def('pray', G => {
  G = group(G, 'body', 0, 0, 0.04); G.scale.setScalar(1.15);
  const L = add(G, hand(1), -0.115, 0, 0.0); L.rotation.y = -0.1;
  const R = add(G, hand(-1), 0.115, 0, 0.0); R.rotation.y = 0.1;
  for (const s of [-1, 1]) add(G, mesh(slab(0.24, 0.12, 0.16, 0.04, 0.03), 'blue'), s * 0.12, 0, 0.25);
  const mk = group(G, 'mk');
  const pg = slab(0.05, 0.13, 0.05, 0.025, 0.012);
  [[0, -0.4, 0], [-0.27, -0.33, 0.6], [0.27, -0.33, -0.6]].forEach(([x, z, a]) => { add(mk, mesh(pg, 'yellow'), x, 0, z).rotation.y = a; });
}, o => { const mk = o('mk'); return t => { mk.scale.setScalar(0.85 + 0.2 * wave01(t, 2.2)); }; });

// ---------------------------------------------------------------- public API
const protos = new Map();
let serial = 0;

export function makeEmoji(name) {
  const key = DEFS[name] ? name : 'sparkle';
  if (!DEFS[name]) console.warn('makeEmoji: unknown emoji', name);
  let proto = protos.get(key);
  if (!proto) {
    proto = new THREE.Group();
    DEFS[key].build(proto);
    proto.traverse(o => { if (o.isMesh) o.castShadow = true; });
    protos.set(key, proto);
  }
  const g = proto.clone();
  g.name = 'emoji:' + key;
  const tk = DEFS[key].tick;
  if (tk) {
    const phase = (serial++ * 0.618034 % 1) * 10;
    const f = tk(n => g.getObjectByName(n), g);
    g.userData.tick = (t, dt) => f(t + phase, dt);
  }
  return g;
}
