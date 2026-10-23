// Mini 川哥 — the chibi 李四川 (川伯 / "Hammer Lee"): crew cut, thin rectangular glasses, a big open smile, a
// light-blue shirt and a yellow hard hat with the navy 川 bars, carrying a sledgehammer and a shovel.
// About 2.4 heads tall (~3.1 em with the hat), origin between the feet on the floor, facing +z.
//
// Rig: group > facing (yaw) > base (pivot on the floor between the feet: falls, hops, squash) > pelvis > torso >
// neck > head, with shoulder > elbow > wrist arms and hip > knee > ankle legs. Poses are small specs (degrees,
// directions or IK targets) solved into joint quaternions, so any two poses blend by slerp.
//
//   const c = createChuan({ hat: true, tools: true });
//   c.setPose('wave', 1);            // any POSES id; k blends from rest. Looping extras run in c.update(dt)
//   c.play('run');                   // 'idle' | 'walk' | 'run' | 'jump' | 'trip'  (in place)
//   each frame: c.update(dt); group.position += forward(facing) * c.speed * dt
//   c.play('trip', { onDone })       // stumble, splat, hat flies off, dazed, grabs the hat, dusts off, runs on
import * as THREE from 'three';
import { toon } from '../engine/toon.js';

const DEG = Math.PI / 180;
const V3 = THREE.Vector3, QT = THREE.Quaternion, M4 = THREE.Matrix4;
const ONE = new V3(1, 1, 1);
const DOWN = new V3(0, -1, 0);
const QI = new QT();

// ---------------------------------------------------------------------------------------------------------
// proportions (em)
export const DIM = {
  hipY: 0.80, hipX: 0.18, thigh: 0.36, shin: 0.33, ankle: 0.11,
  waist: 0.08, shoulderX: 0.37, shoulderY: 0.62, neckY: 0.80, headY: 0.57, headR: 0.62,
  upper: 0.33, lower: 0.31, fist: 0.115,
};
const FACE = 11;             // elevation (deg) of the face centre on the head sphere
const BELLY = 0.36;          // base height that rests his tummy on the floor when he lies flat

// ---------------------------------------------------------------------------------------------------------
// materials (shared toon materials; never disposed)
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    skin: toon('skin'), hair: toon({ l: '#5b5551', m: '#34302d', d: '#191715' }), shirt: toon('shirt'), pants: toon('pants'), white: toon('white'),
    yellow: toon('yellow'), navy: toon('navy'), metal: toon('metal'), wood: toon('wood'), dark: toon('dark'),
    gold: toon('gold'), red: toon('red'), sky: toon('sky'),
    shoe: toon({ l: '#6a5444', m: '#47372c', d: '#261c16' }),
    eye: toon({ l: '#3a302a', m: '#231e16', d: '#120f0b' }),
    mouth: toon({ l: '#c4544b', m: '#9a3430', d: '#5a1a17' }),
    tongue: toon({ l: '#ffa496', m: '#ef8273', d: '#93413a' }),
    blush: toon({ l: '#ffbcb4', m: '#f6a198', d: '#c97670' }),
    frame: toon({ l: '#5d6673', m: '#3e4551', d: '#22262d' }),
    belt: toon({ l: '#55463a', m: '#3a2f25', d: '#1e1813' }),
    hatIn: toon({ l: '#f3bb12', m: '#d99f00', d: '#7a5600' }, { side: 2 }),
    dust: toon({ l: '#ffffff', m: '#eef1f6', d: '#c3cbd8' }),
  };
  return MAT;
}

// ---------------------------------------------------------------------------------------------------------
// shared geometry
const GEO = new Map();
const memo = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const sph = (r, w = 18, h = 14) => memo(`sph${r}/${w}/${h}`, () => new THREE.SphereGeometry(r, w, h));
const ell = (x, y, z, w = 18, h = 14) => memo(`ell${x}/${y}/${z}/${w}`, () => new THREE.SphereGeometry(1, w, h).scale(x, y, z));
const cap = (r, len, rs = 12) => memo(`cap${r}/${len}/${rs}`, () => new THREE.CapsuleGeometry(r, len, 4, rs));
const cyl = (rt, rb, h, rs = 14) => memo(`cyl${rt}/${rb}/${h}/${rs}`, () => new THREE.CylinderGeometry(rt, rb, h, rs));
const tor = (r, t, rs, ts, arc = Math.PI * 2) => memo(`tor${r}/${t}/${rs}/${ts}/${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const box = (x, y, z) => memo(`box${x}/${y}/${z}`, () => new THREE.BoxGeometry(x, y, z));

function add(parent, geo, mat, p, r, s) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0], r[1], r[2]);
  if (s !== undefined) { if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]); }
  parent.add(o);
  return o;
}

function extrude(shape, depth, bevel = 0, curveSegments = 10) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments,
  });
}
function rrPath(p, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy + h / 2;
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y - r);
  p.lineTo(x + w, y - h + r); p.quadraticCurveTo(x + w, y - h, x + w - r, y - h);
  p.lineTo(x + r, y - h); p.quadraticCurveTo(x, y - h, x, y - h + r);
  p.lineTo(x, y - r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

// A puffy heart (about 1 unit tall) in the xy plane, centred, extruded toward +z. Also used by the stickers.
export function heartGeometry() {
  return memo('heart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.16, -0.34, 0.56, -0.1, 0.5, 0.18);
    s.bezierCurveTo(0.46, 0.44, 0.14, 0.5, 0, 0.27);
    s.bezierCurveTo(-0.14, 0.5, -0.46, 0.44, -0.5, 0.18);
    s.bezierCurveTo(-0.56, -0.1, -0.16, -0.34, 0, -0.5);
    const g = extrude(s, 0.16, 0.12, 14);
    g.center();
    return g;
  });
}
// A chunky five-point star (radius 1) lying in the xy plane, extruded toward +z.
export function starGeometry() {
  return memo('star', () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.48 : 1;
      if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = extrude(s, 0.3, 0.12, 1);
    g.center();
    return g;
  });
}

// orientation whose local z is the surface normal n and local y points "up" along the surface
function tangentQ(n) {
  const x = new V3(0, 1, 0).cross(n);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new V3().crossVectors(n, x).normalize();
  return new QT().setFromRotationMatrix(new M4().makeBasis(x, y, n));
}
const sdir = (el, az) => new V3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG));

// ---------------------------------------------------------------------------------------------------------
// head

// Crew cut: a cap over the top of the head cut by a plane tilted back (high hairline in front, sideburns at the
// ears, low at the back), with the very top pressed flat.
function hairGeo() {
  return memo('hair', () => {
    const R = DIM.headR, Rh = R * 1.035;
    const tilt = 36 * DEG, lift = 8 * DEG;
    const capAng = Math.acos(Math.sin(lift) * R / Rh);
    const g = new THREE.SphereGeometry(Rh, 28, 18, 0, Math.PI * 2, 0, capAng);
    g.rotateX(-tilt);
    const pos = g.attributes.position, nrm = g.attributes.normal, top = R * 0.9;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > top) { pos.setY(i, top); nrm.setXYZ(i, 0, 1, 0); }
    return g;
  });
}
// the skull, pressed flat on top so the crew cut's flat top always covers it
function skullGeo() {
  return memo('skull', () => {
    const R = DIM.headR, g = new THREE.SphereGeometry(R, 28, 20);
    const pos = g.attributes.position, nrm = g.attributes.normal, top = R * 0.86;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > top) { pos.setY(i, top); nrm.setXYZ(i, 0, 1, 0); }
    return g;
  });
}
function glassesGeo() {
  return memo('glasses', () => {
    const s = rrPath(new THREE.Shape(), 0, 0, 0.26, 0.19, 0.05);
    s.holes.push(rrPath(new THREE.Path(), 0, 0, 0.19, 0.125, 0.03));
    return extrude(s, 0.03, 0, 6);
  });
}
function mouthGeo() {
  return memo('mouthD', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.18, 0.075);
    s.lineTo(0.18, 0.075);
    s.absellipse(0, 0.075, 0.18, 0.2, 0, Math.PI, true);
    const g = extrude(s, 0.07, 0, 14);
    g.translate(0, 0, -0.04);
    return g;
  });
}
function teethGeo() {
  return memo('teeth', () => {
    const s = rrPath(new THREE.Shape(), 0, 0.045, 0.29, 0.055, 0.025);
    const g = extrude(s, 0.08, 0, 6);
    g.translate(0, 0, -0.04);
    return g;
  });
}
function tongueGeo() {
  return memo('tongue', () => {
    const s = new THREE.Shape();
    s.absellipse(0, -0.075, 0.085, 0.045, 0, Math.PI * 2, false);
    const g = extrude(s, 0.076, 0, 12);
    g.translate(0, 0, -0.04);
    return g;
  });
}

const EXPR = {
  grin:  { eyes: ['arc', 'arc'], mouth: 'grin', brow: 0 },
  smile: { eyes: ['arc', 'arc'], mouth: 'smile', brow: 0 },
  wink:  { eyes: ['dot', 'arc'], mouth: 'grin', brow: 0 },
  open:  { eyes: ['dot', 'dot'], mouth: 'grin', brow: 0 },
  go:    { eyes: ['dot', 'dot'], mouth: 'grin', brow: -1 },
  oh:    { eyes: ['dot', 'dot'], mouth: 'o', brow: 1 },
  dizzy: { eyes: ['ring', 'ring'], mouth: 'o', brow: 1 },
  think: { eyes: ['dot', 'dot'], mouth: 'smile', brow: 2 },
};
export const EXPRESSIONS = Object.keys(EXPR);

// The head alone, centred on the origin, face toward +z (no tilt). Returns { group, hatSeat, fx, setFace(name),
// tick(t) }. hatSeat is where a hard hat sits; fx holds the dizzy stars and the sweat drop.
export function createHead() {
  const m = mats(), R = DIM.headR;
  const g = new THREE.Group();
  g.name = 'chuanHead';
  add(g, skullGeo(), m.skin);
  add(g, hairGeo(), m.hair);
  const place = (o, el, az, r) => { const n = sdir(el, az); o.position.copy(n).multiplyScalar(r); o.quaternion.copy(tangentQ(n)); g.add(o); return o; };
  const mesh = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; return o; };

  for (const s of [1, -1]) {
    place(mesh(ell(0.1, 0.135, 0.07), m.skin), FACE + 4, s * 86, R - 0.02);       // ears
    place(mesh(cyl(0.072, 0.072, 0.02, 16), m.blush), FACE - 5, s * 42, R - 0.004).rotateX(Math.PI / 2);   // blush
  }
  place(mesh(sph(0.066, 14, 10), m.skin), FACE - 1, 0, R - 0.008);                // nose

  // eyes: four looks each, swapped by setFace
  const eyes = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const a = place(new THREE.Group(), FACE + 9, s * 20, R);
    eyes[side] = {
      arc: add(a, tor(0.05, 0.02, 6, 12, Math.PI), m.eye),
      dot: add(a, ell(0.042, 0.054, 0.026, 12, 10), m.eye, [0, 0, -0.004]),
      ring: add(a, tor(0.043, 0.015, 6, 16), m.eye),
      line: add(a, cap(0.017, 0.07, 6), m.eye, [0, 0, 0], [0, 0, Math.PI / 2]),
    };
  }
  // his signature thin rectangular glasses
  for (const s of [1, -1]) {
    place(mesh(glassesGeo(), m.frame), FACE + 9, s * 21, R + 0.03).rotateY(-s * 10 * DEG);
    place(mesh(cap(0.014, 0.17, 6), m.frame), FACE + 11, s * 43, R + 0.02).rotateZ(Math.PI / 2);   // temples
  }
  place(mesh(cap(0.016, 0.13, 6), m.frame), FACE + 10.5, 0, R + 0.038).rotateZ(Math.PI / 2);       // bridge

  // thick friendly brows (rotated per expression)
  const brows = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const o = place(mesh(cap(0.032, 0.12, 8), m.hair), FACE + 23, s * 20, R + 0.004);
    o.userData.q0 = o.quaternion.clone();
    o.userData.p0 = o.position.clone();
    o.userData.up = new V3(0, 1, 0).applyQuaternion(o.quaternion);
    brows[side] = o;
  }

  // mouth: a big open D-shaped grin with teeth, a closed smile and a little "o"
  const mouth = place(new THREE.Group(), FACE - 17, 0, R);
  const mouths = {
    grin: new THREE.Group(), smile: new THREE.Group(), o: new THREE.Group(),
  };
  add(mouths.grin, mouthGeo(), m.mouth);
  add(mouths.grin, teethGeo(), m.white);
  add(mouths.grin, tongueGeo(), m.tongue);
  add(mouths.smile, tor(0.12, 0.024, 6, 14, Math.PI), m.eye, [0, 0.07, 0.0], [0, 0, Math.PI]);
  add(mouths.o, ell(0.06, 0.075, 0.03, 14, 10), m.mouth, [0, 0.0, 0.0]);
  for (const k in mouths) mouth.add(mouths[k]);

  // hard-hat seat (the hat's origin is the centre of its brim ring)
  const hatSeat = new THREE.Group();
  hatSeat.position.set(0, 0.4, -0.16);
  hatSeat.rotation.x = -0.34;
  g.add(hatSeat);

  // fx: dizzy stars circling above the head and a sweat drop
  const fx = new THREE.Group();
  g.add(fx);
  const stars = new THREE.Group();
  stars.position.set(0, 0.86, 0);
  fx.add(stars);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    add(stars, starGeometry(), m.yellow, [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [-Math.PI / 2, 0, 0], 0.12);
  }
  const sweat = place(new THREE.Group(), 34, -62, R + 0.07);
  add(sweat, sph(0.075, 12, 10), m.sky);
  add(sweat, new THREE.ConeGeometry(0.066, 0.12, 12), m.sky, [0, 0.085, 0]);
  stars.visible = false; sweat.visible = false;

  let cur = null;
  function setFace(name = 'grin') {
    if (name === cur) return;
    cur = name;
    const e = EXPR[name] || EXPR.grin;
    ['L', 'R'].forEach((side, i) => { for (const k in eyes[side]) eyes[side][k].visible = k === e.eyes[i]; });
    for (const k in mouths) mouths[k].visible = k === e.mouth;
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const o = brows[side];
      // kind: outer ends a touch down; raised: up and arched; determined: inner ends down; think: one raised
      let tilt = -s * 9, lift = 0;
      if (e.brow === 1) { tilt = -s * 4; lift = 0.035; }
      if (e.brow === -1) { tilt = s * 14; lift = -0.01; }
      if (e.brow === 2 && s === 1) { tilt = s * 10; lift = 0.045; }
      o.quaternion.copy(o.userData.q0).multiply(new QT().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2 + tilt * DEG));
      o.position.copy(o.userData.p0).addScaledVector(o.userData.up, lift);
    }
  }
  setFace('grin');
  function setFx(starsOn, sweatOn, t = 0) {
    stars.visible = starsOn; sweat.visible = sweatOn;
    if (starsOn) stars.rotation.y = t * 5;
  }
  return { group: g, hatSeat, fx, setFace, setFx };
}

// ---------------------------------------------------------------------------------------------------------
// hard hat (origin = centre of the brim ring, dome up, front +z)
const HAT_RD = 0.58, HAT_CAP = 84 * DEG, HAT_CY = -HAT_RD * Math.cos(HAT_CAP), HAT_SX = 0.93;
export const HAT_TOP = HAT_CY + HAT_RD;     // dome top above the ring

export function createHardHat() {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'hardHat';
  const dome = memo('hatDome', () => new THREE.SphereGeometry(HAT_RD, 24, 12, 0, Math.PI * 2, 0, HAT_CAP).scale(HAT_SX, 1, 1));
  add(g, dome, m.yellow, [0, HAT_CY, 0]);
  const inner = memo('hatInner', () => new THREE.SphereGeometry(HAT_RD * 0.94, 20, 10, 0, Math.PI * 2, 0, HAT_CAP).scale(HAT_SX, 1, 1));
  add(g, inner, m.hatIn, [0, HAT_CY, 0]);
  const brim = memo('hatBrim', () => {
    const s = new THREE.Shape();
    s.absellipse(0, -0.06, 0.63 * HAT_SX + 0.04, 0.67, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absellipse(0, 0, 0.545 * HAT_SX, 0.545, 0, Math.PI * 2, true);
    s.holes.push(h);
    const geo = extrude(s, 0.03, 0.014, 28);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  add(g, brim, m.yellow, [0, -0.03, 0]);
  // the raised crest over the top, front to back
  const crest = memo('hatCrest', () => {
    const t = new THREE.TorusGeometry(HAT_RD, 0.05, 6, 22, 2.5);
    t.rotateZ(0.32);
    t.rotateY(Math.PI / 2);
    t.scale(0.8, 1, 1);
    return t;
  });
  add(g, crest, m.yellow, [0, HAT_CY, 0]);
  // the navy 川 bars on the front (outer bars taller and splayed, like the campaign logo)
  const bars = [[-10, 0.2, 7], [0, 0.15, 0], [10, 0.2, -7]];
  for (const [az, h, spin] of bars) {
    const el = 22;
    const n = sdir(el, az);
    const o = new THREE.Mesh(box(0.055, h, 0.05), m.navy);
    o.castShadow = true;
    o.position.set(n.x * HAT_RD * HAT_SX, HAT_CY + n.y * HAT_RD, n.z * HAT_RD);
    o.quaternion.copy(tangentQ(n));
    o.rotateZ(spin * DEG);
    o.translateY(h / 2 - 0.1);
    g.add(o);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------------
// tools
// Sledgehammer ("Hammer Lee"): origin at the grip, handle along +y, head across it along z.
export function createHammer() {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'hammer';
  add(g, cyl(0.044, 0.05, 0.92, 10), m.wood, [0, 0.29, 0]);
  add(g, cyl(0.058, 0.058, 0.24, 10), m.navy, [0, -0.04, 0]);
  add(g, cyl(0.12, 0.12, 0.44, 16), m.metal, [0, 0.76, 0], [Math.PI / 2, 0, 0]);
  add(g, cyl(0.128, 0.128, 0.09, 16), m.yellow, [0, 0.76, 0], [Math.PI / 2, 0, 0]);
  for (const z of [-0.2, 0.2]) add(g, cyl(0.13, 0.13, 0.05, 16), m.dark, [0, 0.76, z], [Math.PI / 2, 0, 0]);
  return g;
}
// Shovel: origin at the socket, handle along +y with a D-grip on top, blade below (face normal +z).
export function createShovel() {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'shovel';
  add(g, cyl(0.04, 0.042, 1.12, 10), m.wood, [0, 0.62, 0]);
  add(g, tor(0.09, 0.028, 6, 14), m.navy, [0, 1.27, 0]);
  add(g, cap(0.03, 0.12, 8), m.navy, [0, 1.335, 0], [0, 0, Math.PI / 2]);
  add(g, cyl(0.055, 0.075, 0.18, 12), m.dark, [0, 0.02, 0]);
  const blade = memo('blade', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.19, 0);
    s.lineTo(0.19, 0);
    s.lineTo(0.19, -0.27);
    s.quadraticCurveTo(0.18, -0.42, 0, -0.48);
    s.quadraticCurveTo(-0.18, -0.42, -0.19, -0.27);
    s.lineTo(-0.19, 0);
    const geo = extrude(s, 0.02, 0.012, 10);
    geo.translate(0, -0.06, -0.01);
    return geo;
  });
  add(g, blade, m.metal);
  add(g, cap(0.03, 0.36, 8), m.metal, [0, -0.06, 0.0], [0, 0, Math.PI / 2]);
  return g;
}

// how each thing sits in a fist (hand frame: fingers −y, thumb +z, palm toward the body)
const FIST_C = new V3(0, -0.11, 0);
const GRIP = {
  hammer: { p: FIST_C.clone(), q: new QT().setFromRotationMatrix(new M4().makeBasis(new V3(0, 1, 0), new V3(0, 0, 1), new V3(1, 0, 0))) },
  shovel: { p: new V3(0, -0.11, 0.98), q: new QT().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2) },
  hat:    { p: new V3(0, -0.72, 0), q: new QT().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2) },
};
// tools slung on his back (torso frame) when a pose needs both hands
const BACK = {
  hammer: { p: new V3(0.18, 0.05, -0.53), q: new QT().setFromEuler(new THREE.Euler(-0.1, 0, 0.4)) },
  shovel: { p: new V3(0.08, 0.55, -0.56), q: new QT().setFromEuler(new THREE.Euler(0.1, 0, Math.PI - 0.4)) },
};

// ---------------------------------------------------------------------------------------------------------
// hands: every hand shape is prebuilt and toggled
function buildHand(s) {
  const m = mats();
  const g = new THREE.Group();
  const v = {};
  const mk = (name) => { const o = new THREE.Group(); o.visible = false; g.add(o); v[name] = o; return o; };
  const fistBall = (o) => add(o, ell(0.1, 0.118, 0.112), m.skin, [0, -0.11, 0]);

  const fist = mk('fist');
  fistBall(fist);
  add(fist, cap(0.036, 0.05, 6), m.skin, [-s * 0.045, -0.1, 0.085], [0.5, 0, -s * 0.6]);

  const thumb = mk('thumb');
  fistBall(thumb);
  add(thumb, cap(0.054, 0.12, 8), m.skin, [-s * 0.01, -0.07, 0.17], [Math.PI / 2, 0, 0]);

  const point = mk('point');
  fistBall(point);
  add(point, cap(0.036, 0.12, 8), m.skin, [0, -0.26, 0.05]);
  add(point, cap(0.034, 0.05, 6), m.skin, [-s * 0.045, -0.1, 0.085], [0.5, 0, -s * 0.6]);

  const open = mk('open');
  add(open, ell(0.06, 0.12, 0.112), m.skin, [0, -0.11, 0]);
  for (let i = -1; i <= 1; i++) add(open, cap(0.034, 0.075, 6), m.skin, [0, -0.235, i * 0.06], [i * 0.18, 0, 0]);
  add(open, cap(0.036, 0.07, 6), m.skin, [-s * 0.01, -0.1, 0.125], [1.0, 0, 0]);

  const flat = mk('flat');
  add(flat, ell(0.055, 0.17, 0.105), m.skin, [0, -0.15, 0]);
  add(flat, cap(0.034, 0.06, 6), m.skin, [-s * 0.012, -0.09, 0.1], [0.35, 0, 0]);

  const ok = mk('ok');
  add(ok, ell(0.06, 0.11, 0.1), m.skin, [0, -0.1, -0.015]);
  add(ok, tor(0.052, 0.024, 6, 14), m.skin, [-s * 0.01, -0.2, 0.075], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 3; i++) add(ok, cap(0.031, 0.09, 6), m.skin, [0, -0.25, -i * 0.047], [-0.12 * i, 0, 0]);

  const heart = mk('heart');
  fistBall(heart);
  add(heart, cap(0.034, 0.06, 6), m.skin, [-s * 0.02, -0.12, 0.12], [1.2, 0, 0]);
  add(heart, heartGeometry(), m.red, [-s * 0.01, -0.2, 0.16], [Math.PI / 2, 0, 0], 0.17);

  let cur = null;
  return {
    group: g, v,
    set(name) { if (name === cur || !v[name]) return; if (cur) v[cur].visible = false; v[name].visible = true; cur = name; },
  };
}

// ---------------------------------------------------------------------------------------------------------
// the body rig
function buildRig() {
  const m = mats();
  const root = new THREE.Group(); root.name = 'chuan';
  const facing = new THREE.Group(); root.add(facing);
  const base = new THREE.Group(); facing.add(base);
  const pelvis = new THREE.Group(); pelvis.position.y = DIM.hipY; base.add(pelvis);
  add(pelvis, ell(0.4, 0.25, 0.33), m.pants, [0, 0.02, 0]);
  add(pelvis, memo('belt', () => new THREE.CylinderGeometry(1, 1, 1, 24).scale(0.387, 0.075, 0.34)), m.belt, [0, 0.14, 0.012]);
  add(pelvis, box(0.13, 0.085, 0.04), m.gold, [0, 0.14, 0.352]);

  const torso = new THREE.Group(); torso.position.y = DIM.waist; pelvis.add(torso);
  add(torso, ell(0.45, 0.5, 0.38, 22, 16), m.shirt, [0, 0.36, 0.02]);
  add(torso, cyl(0.15, 0.17, 0.16, 14), m.skin, [0, 0.8, 0.01]);
  // collar flaps and buttons
  const flap = memo('collar', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.2, 0.03); s.lineTo(0.06, -0.15); s.lineTo(0, 0);
    return extrude(s, 0.035, 0.01, 1);
  });
  for (const sd of [1, -1]) {
    const f = add(torso, flap, m.white, [sd * 0.025, 0.8, 0.15]);
    f.rotation.set(-1.0, 0, 0);
    if (sd < 0) f.scale.x = -1;
    f.rotateZ(-sd * 0.2);
  }
  add(torso, sph(0.026, 8, 6), m.white, [0, 0.55, 0.383]);
  add(torso, sph(0.026, 8, 6), m.white, [0, 0.36, 0.4]);

  const neck = new THREE.Group(); neck.position.y = DIM.neckY; torso.add(neck);
  const head = createHead();
  head.group.position.set(0, DIM.headY, 0.03);
  neck.add(head.group);

  const arms = {}, legs = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const sh = new THREE.Group(); sh.position.set(s * DIM.shoulderX, DIM.shoulderY, 0); torso.add(sh);
    add(sh, sph(0.135, 14, 10), m.shirt);
    add(sh, cap(0.112, DIM.upper - 0.04, 12), m.shirt, [0, -DIM.upper / 2 + 0.01, 0]);
    const el = new THREE.Group(); el.position.y = -DIM.upper; sh.add(el);
    add(el, cap(0.082, DIM.lower - 0.02, 10), m.skin, [0, -DIM.lower / 2, 0]);
    const wrist = new THREE.Group(); wrist.position.y = -DIM.lower; el.add(wrist);
    const hand = buildHand(s); wrist.add(hand.group); hand.set('fist');
    arms[side] = { sh, el, wrist, hand };

    const hp = new THREE.Group(); hp.position.set(s * DIM.hipX, 0, 0); pelvis.add(hp);
    add(hp, cap(0.128, DIM.thigh - 0.02, 12), m.pants, [0, -DIM.thigh / 2, 0]);
    const kn = new THREE.Group(); kn.position.y = -DIM.thigh; hp.add(kn);
    add(kn, cap(0.118, DIM.shin - 0.04, 12), m.pants, [0, -DIM.shin / 2 + 0.01, 0]);
    const an = new THREE.Group(); an.position.y = -DIM.shin; kn.add(an);
    add(an, ell(0.15, 0.1, 0.235, 16, 10), m.shoe, [0, -0.03, 0.065]);
    legs[side] = { hp, kn, an };
  }
  return { root, facing, base, pelvis, torso, neck, head, arms, legs };
}

// ---------------------------------------------------------------------------------------------------------
// pose specs and the solver
//
// spec fields (all optional; degrees for angles):
//   base  { x, y, z, rx, ry, rz, sq }   pivot on the floor between the feet; sq = squash (y scale)
//   hip   { x, y, z, rx, ry, rz }       pelvis offset from standing / rotation
//   torso { rx, ry, rz }, head { rx, ry, rz }   rx > 0 leans forward, rz > 0 leans to his right (−x)
//   L / R arms: { a, b, fa, fb }  upper-arm and forearm directions in the torso frame (a = swing from straight
//             down toward the front, b = out to the side), or an IK target for the fist centre: atT (torso
//             frame) / at (facing frame) / grip (computed). pole = where the elbow points. hand shape, and
//             the hand's orientation: hf = finger direction, ha = thumb axis (props run along it), hp = palm.
//             x is mirrored for R (positive = outward) unless abs: true.
//   legL / legR: { a, b, k, foot, toe } thigh angle and knee bend in the base frame, foot pitch (toes up > 0),
//             or an ankle target: at (facing frame) / atP (pelvis frame), pole = knee direction.
//   face, hammer / shovel / hat placement ('handL' | 'handR' | 'back' | 'head' | 'none' | { in, p, r } or
//   { in: 'base', at, dir, roll } for a two-handed shovel), fx { stars, sweat }
const REST = {
  base: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sq: 1 },
  hip: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
  torso: { rx: 0, ry: 0, rz: 0 },
  head: { rx: -16, ry: 0, rz: 0 },
  L: { a: 4, b: 13, fa: 9, fb: 9, hand: 'fist' },
  R: { a: 4, b: 13, fa: 9, fb: 9, hand: 'fist' },
  legL: { a: 0, b: 3, k: 0, foot: 0 },
  legR: { a: 0, b: 3, k: 0, foot: 0 },
  face: 'grin', hammer: 'back', shovel: 'back', hat: 'head', fx: { stars: 0, sweat: 0 },
};
const OBJ = new Set(['base', 'hip', 'torso', 'head', 'legL', 'legR', 'fx']);
function full(sp) {
  const o = {};
  for (const k in REST) {
    if (OBJ.has(k)) o[k] = { ...REST[k], ...(sp[k] || {}) };
    else if (k === 'L' || k === 'R') o[k] = sp[k] ? { hand: 'fist', ...(sp[k].at || sp[k].atT || sp[k].grip ? {} : REST[k]), ...sp[k] } : { ...REST[k] };
    else o[k] = sp[k] ?? REST[k];
  }
  return o;
}

const angDir = (a, b, s) => {
  a *= DEG; b *= DEG;
  return new V3(s * Math.sin(b), -Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b));
};
const eulerQ = (rx = 0, ry = 0, rz = 0, order = 'XYZ') => new QT().setFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, order));
function perp(v) {
  const p = Math.abs(v.y) < 0.9 ? new V3(0, 1, 0) : new V3(0, 0, 1);
  return p.addScaledVector(v, -p.dot(v)).normalize();
}
// hand: local −y -> F (fingers), local −s·x -> P (palm), local z -> s(P × F) (thumb side)
function basisQ(F, P, s) {
  const f = F.clone().normalize();
  const p = P.clone().addScaledVector(f, -P.dot(f));
  if (p.lengthSq() < 1e-6) p.copy(perp(f)); else p.normalize();
  const ex = p.clone().multiplyScalar(-s), ey = f.clone().negate(), ez = new V3().crossVectors(p, f).multiplyScalar(s);
  return new QT().setFromRotationMatrix(new M4().makeBasis(ex, ey, ez));
}
function twoBone(root, target, L1, L2, pole) {
  const d = target.clone().sub(root);
  let len = d.length();
  const dn = len > 1e-6 ? d.divideScalar(len) : DOWN.clone();
  len = THREE.MathUtils.clamp(len, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
  const A = Math.acos(THREE.MathUtils.clamp((L1 * L1 + len * len - L2 * L2) / (2 * L1 * len), -1, 1));
  const pn = pole.clone().addScaledVector(dn, -pole.dot(dn));
  if (pn.lengthSq() < 1e-8) pn.copy(perp(dn)); else pn.normalize();
  const u = dn.clone().multiplyScalar(Math.cos(A)).addScaledVector(pn, Math.sin(A));
  const elbow = root.clone().addScaledVector(u, L1);
  const l = root.clone().addScaledVector(dn, len).sub(elbow).normalize();
  return [u, l];
}

function solveArm(a, s, F) {
  const mir = (v) => (a.abs ? new V3(v[0], v[1], v[2]) : new V3(v[0] * s, v[1], v[2]));
  const sh = new V3(s * DIM.shoulderX, DIM.shoulderY, 0);
  let hf = a.hf ? mir(a.hf).normalize() : null;
  let ha = a.ha ? mir(a.ha).normalize() : null;
  let hp = a.hp ? mir(a.hp).normalize() : null;
  let u, l, target = null;
  if (a.grip) { target = a.grip.p.clone(); ha = a.grip.axis.clone(); }
  else if (a.atT) target = mir(a.atT);
  else if (a.at) target = mir(a.at).applyMatrix4(F.toTorso);
  if (target) {
    let f = hf ? hf.clone() : target.clone().sub(sh).normalize();
    if (ha) { f.addScaledVector(ha, -f.dot(ha)); f = f.lengthSq() < 1e-6 ? perp(ha) : f.normalize(); }
    const wrist = target.clone().addScaledVector(f, -DIM.fist);
    const pole = a.pole ? mir(a.pole) : new V3(s, -0.6, -0.4);
    [u, l] = twoBone(sh, wrist, DIM.upper, DIM.lower, pole);
    hf = f;
  } else {
    u = angDir(a.a, a.b, s); l = angDir(a.fa, a.fb, s);
  }
  let f = hf || l.clone();
  if (ha) {
    f = f.clone().addScaledVector(ha, -f.dot(ha));
    f = f.lengthSq() < 1e-6 ? perp(ha) : f.normalize();
    hp = new V3().crossVectors(f, ha).multiplyScalar(s);
  }
  if (!hp) hp = new V3(-s, 0, 0);
  const Qh = basisQ(f, hp, s);
  const qU = new QT().setFromUnitVectors(DOWN, u);
  const qLw = new QT().setFromUnitVectors(DOWN, l);
  return { u: qU, l: qU.clone().invert().multiply(qLw), h: qLw.clone().invert().multiply(Qh), hand: a.hand || 'fist' };
}

function solveLeg(lg, s, F) {
  const mir = (v) => new V3(v[0] * s, v[1], v[2]);
  const hip = new V3(s * DIM.hipX, 0, 0);
  let u, l;
  if (lg.at || lg.atP) {
    const target = lg.atP ? mir(lg.atP) : mir(lg.at).applyMatrix4(F.toPelvis);
    const pole = (lg.pole ? mir(lg.pole) : new V3(0, 0.15, 1)).applyQuaternion(F.hipQi);
    [u, l] = twoBone(hip, target, DIM.thigh, DIM.shin, pole);
  } else {
    u = angDir(lg.a, lg.b, s).applyQuaternion(F.hipQi);
    l = angDir(lg.a - lg.k, lg.kb ?? lg.b, s).applyQuaternion(F.hipQi);
  }
  const Qf = F.hipQi.clone().multiply(eulerQ(-lg.foot, s * (lg.toe ?? 7), 0, 'YXZ'));
  const qU = new QT().setFromUnitVectors(DOWN, u);
  const qLw = new QT().setFromUnitVectors(DOWN, l);
  return { u: qU, l: qU.clone().invert().multiply(qLw), f: qLw.clone().invert().multiply(Qf) };
}

// prop placement -> { node, p, q }
function resolveProp(kind, sp) {
  if (sp == null || sp === 'none') return { node: 'none' };
  if (typeof sp === 'string') {
    if (sp === 'handL' || sp === 'handR') return { node: sp, p: GRIP[kind].p.clone(), q: GRIP[kind].q.clone() };
    if (sp === 'back' && BACK[kind]) return { node: 'torso', p: BACK[kind].p.clone(), q: BACK[kind].q.clone() };
    if (sp === 'head') return { node: 'head', p: new V3(), q: new QT() };
    return { node: 'none' };
  }
  if (sp.dir) {
    const d = new V3(...sp.dir).normalize();
    const q = new QT().setFromUnitVectors(new V3(0, 1, 0), d).multiply(new QT().setFromAxisAngle(new V3(0, 1, 0), (sp.roll || 0) * DEG));
    return { node: sp.in || 'base', p: new V3(...sp.at), q };
  }
  const q = eulerQ(...(sp.r || [0, 0, 0]));
  if (sp.aa) q.multiply(new QT().setFromAxisAngle(new V3(sp.aa[0], sp.aa[1], sp.aa[2]).normalize(), sp.aa[3] * DEG));
  return { node: sp.in || 'torso', p: new V3(...(sp.p || [0, 0, 0])), q };
}

function solve(sp) {
  const s = full(sp);
  const st = {};
  const sq = s.base.sq;
  st.base = { p: new V3(s.base.x, s.base.y, s.base.z), q: eulerQ(s.base.rx, s.base.ry, s.base.rz), sq };
  st.hip = { p: new V3(s.hip.x, DIM.hipY + s.hip.y, s.hip.z), q: eulerQ(s.hip.rx, s.hip.ry, s.hip.rz) };
  st.torso = eulerQ(s.torso.rx, s.torso.ry, s.torso.rz);
  st.head = eulerQ(s.head.rx, s.head.ry, s.head.rz, 'YXZ');
  const Mb = new M4().compose(st.base.p, st.base.q, new V3(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)));
  const Mh = new M4().compose(st.hip.p, st.hip.q, ONE);
  const Mw = new M4().compose(new V3(0, DIM.waist, 0), st.torso, ONE);
  const Mpel = Mb.clone().multiply(Mh), Mtor = Mpel.clone().multiply(Mw);
  const F = {
    toTorso: Mtor.clone().invert(), toPelvis: Mpel.clone().invert(),
    baseToTorso: Mh.clone().multiply(Mw).invert(), hipQi: st.hip.q.clone().invert(),
  };
  st.hammer = resolveProp('hammer', s.hammer);
  st.shovel = resolveProp('shovel', s.shovel);
  st.hat = resolveProp('hat', s.hat);
  // two-handed grips on a shovel placed in the base frame
  for (const side of ['L', 'R']) {
    const a = s[side];
    if (a.grab !== undefined && st.shovel.node === 'base') {
      const p = new V3(0, a.grab, 0).applyQuaternion(st.shovel.q).add(st.shovel.p).applyMatrix4(F.baseToTorso);
      const axis = new V3(0, a.grabFlip ? -1 : 1, 0).applyQuaternion(st.shovel.q).transformDirection(F.baseToTorso);
      s[side] = { ...a, grip: { p, axis } };
    }
  }
  st.L = solveArm(s.L, 1, F);
  st.R = solveArm(s.R, -1, F);
  st.legL = solveLeg(s.legL, 1, F);
  st.legR = solveLeg(s.legR, -1, F);
  st.face = s.face;
  st.fx = { stars: s.fx.stars, sweat: s.fx.sweat };
  return st;
}

const lerp = (a, b, k) => a + (b - a) * k;
function blendProp(A, B, k) {
  if (A.node !== B.node) return k < 0.5 ? A : B;
  if (A.node === 'none') return A;
  return { node: A.node, p: A.p.clone().lerp(B.p, k), q: A.q.clone().slerp(B.q, k) };
}
function blend(A, B, k) {
  if (k <= 0) return A;
  if (k >= 1) return B;
  const sl = (a, b) => a.clone().slerp(b, k);
  const o = {
    base: { p: A.base.p.clone().lerp(B.base.p, k), q: sl(A.base.q, B.base.q), sq: lerp(A.base.sq, B.base.sq, k) },
    hip: { p: A.hip.p.clone().lerp(B.hip.p, k), q: sl(A.hip.q, B.hip.q) },
    torso: sl(A.torso, B.torso), head: sl(A.head, B.head),
    face: k < 0.5 ? A.face : B.face,
    fx: { stars: lerp(A.fx.stars, B.fx.stars, k), sweat: lerp(A.fx.sweat, B.fx.sweat, k) },
    hammer: blendProp(A.hammer, B.hammer, k), shovel: blendProp(A.shovel, B.shovel, k), hat: blendProp(A.hat, B.hat, k),
  };
  for (const sd of ['L', 'R']) o[sd] = { u: sl(A[sd].u, B[sd].u), l: sl(A[sd].l, B[sd].l), h: sl(A[sd].h, B[sd].h), hand: k < 0.5 ? A[sd].hand : B[sd].hand };
  for (const lg of ['legL', 'legR']) o[lg] = { u: sl(A[lg].u, B[lg].u), l: sl(A[lg].l, B[lg].l), f: sl(A[lg].f, B[lg].f) };
  return o;
}
let REST_STATE = null;
const restState = () => (REST_STATE ||= solve({}));

// ---------------------------------------------------------------------------------------------------------
// motions (all in place). Cycle speeds come from leg swing so the feet roughly stick to the floor.
const WALK = { f: 1.6, A: 18 };
const RUN = { f: 2.4, A: 34 };
const LEG = DIM.thigh + DIM.shin;
const WALK_SPEED = +(2 * WALK.f * 2 * LEG * 0.97 * Math.sin(WALK.A * DEG)).toFixed(2);
const RUN_SPEED = +(2 * RUN.f * 2 * LEG * 0.9 * Math.sin(RUN.A * DEG)).toFixed(2);
export const SPEEDS = { idle: 0, walk: WALK_SPEED, run: RUN_SPEED, jump: 0, trip: RUN_SPEED };

// right hand: the shovel resting on his right shoulder; left hand: the hammer
const carryR = (bob = 0, extra = {}) => ({ atT: [0.27, 0.6 + bob, 0.3], pole: [1, -1, -0.1], ha: [0.55, 0.42, -0.72], hf: [0, 0.3, 1], ...extra });
const holdL = (a = 6, fa = 12) => ({ a, b: 14, fa, fb: 8, ha: [0.3, -0.72, 0.62] });
const TOOLS = { hammer: 'handL', shovel: 'handR' };

function idleSpec(t) {
  const br = Math.sin(t * Math.PI * 2 / 2.6);
  return {
    ...TOOLS,
    hip: { y: -0.004 + 0.012 * br },
    torso: { rx: 1 + 1.2 * br },
    head: { rx: -16 - 1.5 * br, rz: 3 * Math.sin(t * Math.PI * 2 / 3.7), ry: 5 * Math.sin(t * Math.PI * 2 / 5.3) },
    L: holdL(6 + 1.5 * br), R: carryR(0.01 * br),
  };
}

function walkSpec(t) {
  const ph = 2 * Math.PI * WALK.f * t, sn = Math.sin(ph), cs = Math.cos(ph);
  const leg = (sgn) => {
    const s1 = sgn * sn, c1 = sgn * cs;
    return { a: WALK.A * s1, b: 3, k: 4 + 34 * Math.pow(Math.max(0, c1), 1.5), foot: -6 * Math.max(0, c1) };
  };
  return {
    ...TOOLS,
    base: { y: -0.035 * sn * sn + 0.012 },
    hip: { ry: -4 * sn, rz: 2 * cs },
    torso: { rx: 3, ry: 6 * sn },
    head: { rx: -16, ry: -4 * sn, rz: -1.5 * cs },
    legL: leg(1), legR: leg(-1),
    L: holdL(6 - 16 * sn, 12 - 10 * sn), R: carryR(0.02 * Math.abs(sn)),
  };
}

function runSpec(t, face = 'grin') {
  const ph = 2 * Math.PI * RUN.f * t, sn = Math.sin(ph), cs = Math.cos(ph);
  const leg = (sgn) => {
    const s1 = sgn * sn, c1 = sgn * cs;
    return { a: 6 + RUN.A * s1, b: 3, k: 12 + 78 * Math.pow(Math.max(0, c1), 1.2), foot: -14 * Math.max(0, c1) + 4 };
  };
  return {
    ...TOOLS,
    base: { y: 0.065 * Math.abs(sn) - 0.02 },
    hip: { y: -0.03, rx: 8, ry: -6 * sn },
    torso: { rx: 7, ry: 9 * sn },
    head: { rx: -20, ry: -6 * sn },
    legL: leg(1), legR: leg(-1),
    L: { a: 18 - 42 * sn, b: 18, fa: 95 - 30 * sn, fb: 8, ha: [0.25, 0.2, 0.95] },
    R: carryR(0.03 * Math.abs(cs)),
    face,
  };
}

// keyframed sequences: blend solved states between [time, spec(t)] keys with smoothstep easing
function keyed(keys, t) {
  if (t <= keys[0][0]) return solve(keys[0][1](t));
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (t < t1) {
      const u = (t - t0) / (t1 - t0), e = u * u * (3 - 2 * u);
      return blend(solve(a(t)), solve(b(t)), e);
    }
  }
  return solve(keys[keys.length - 1][1](t));
}

const JUMP_DUR = 0.8;
const JUMP_KEYS = [
  [0.0, () => ({ ...TOOLS, L: holdL(), R: carryR() })],
  [0.12, () => ({ ...TOOLS, hip: { y: -0.13, rx: 10 }, torso: { rx: 8 }, head: { rx: -16 }, legL: { a: 22, k: 46, foot: -2 }, legR: { a: 22, k: 46, foot: -2 },
    L: { a: -28, b: 22, fa: -10, fb: 10, ha: [0, 0.3, 1] }, R: { a: -28, b: 22, fa: -10, fb: 10, ha: [0, 0.5, -1] } })],
  [0.26, () => ({ ...TOOLS, base: { y: 0.36, sq: 1.12 }, head: { rx: -20 }, legL: { a: -6, k: 8, foot: -20 }, legR: { a: -6, k: 8, foot: -20 },
    L: { a: 160, b: 36, fa: 172, fb: 30, ha: [0.2, 0.6, -0.8] }, R: { a: 160, b: 36, fa: 172, fb: 30, ha: [0.2, 0.3, -1] }, face: 'grin' })],
  [0.42, () => ({ ...TOOLS, base: { y: 0.58 }, head: { rx: -22 }, legL: { a: 36, k: 72, foot: -10 }, legR: { a: 36, k: 72, foot: -10 },
    L: { a: 165, b: 42, fa: 178, fb: 38, ha: [0.2, 0.6, -0.8] }, R: { a: 165, b: 42, fa: 178, fb: 38, ha: [0.2, 0.3, -1] }, face: 'grin' })],
  [0.58, () => ({ ...TOOLS, base: { y: 0.1 }, legL: { a: 8, k: 14 }, legR: { a: 8, k: 14 },
    L: { a: 120, b: 45, fa: 150, fb: 40, ha: [0.2, 0.6, -0.8] }, R: { a: 120, b: 45, fa: 150, fb: 40, ha: [0.2, 0.3, -1] } })],
  [0.66, () => ({ ...TOOLS, base: { sq: 0.86 }, hip: { y: -0.12, rx: 6 }, legL: { a: 20, k: 42 }, legR: { a: 20, k: 42 },
    L: { a: 40, b: 30, fa: 60, fb: 20, ha: [0, 0.8, 0.6] }, R: carryR(-0.06) })],
  [0.8, () => ({ ...TOOLS, L: holdL(), R: carryR() })],
];

// ---------------------------------------------------------------------------------------------------------
// the trip gag. Times in seconds; "L-frame" = the floor frame where he lies (z measured from his feet then).
const TRIP_DUR = 5.05;
const TRIP_STAND = 2.35;          // where he stands up again (L-frame z); paid back during the dust-off
const TRIP_HAT = new V3(0.55, 0, 3.45);   // where the hat comes to rest (L-frame), upside down

function tripSpeedAt(t, V) {
  if (t < 0.22) return V;
  if (t < 0.58) return lerp(V, 0.35 * V, (t - 0.22) / 0.36);
  if (t < 0.84) return lerp(0.35 * V, 0, (t - 0.58) / 0.26);
  if (t < 4.25) return 0;
  if (t < 4.75) return TRIP_STAND * (Math.PI / 2) / 0.5 * Math.sin(Math.PI * (t - 4.25) / 0.5);
  if (t < TRIP_DUR) return lerp(0, V, (t - 4.75) / (TRIP_DUR - 4.75));
  return V;
}
const TRIP_TRAVEL = (() => {
  const dt = 1 / 240, n = Math.ceil(TRIP_DUR / dt) + 2, a = new Float32Array(n);
  for (let i = 1; i < n; i++) a[i] = a[i - 1] + dt * 0.5 * (tripSpeedAt((i - 1) * dt, RUN_SPEED) + tripSpeedAt(i * dt, RUN_SPEED));
  return { dt, a };
})();
function tripTravel(t) {
  const { dt, a } = TRIP_TRAVEL;
  const x = Math.max(0, t) / dt, i = Math.min(a.length - 2, Math.floor(x));
  return lerp(a[i], a[i + 1], Math.min(1, x - i));
}
const TRIP_ZL = tripTravel(0.84);
const fz = (t) => TRIP_ZL - tripTravel(t);          // L-frame -> facing frame z offset
const Z = (zb, t) => zb + fz(t);

function tripKeys(ph0) {
  const sit = (t, extra = {}) => {
    const w = t * Math.PI * 2 * 1.1;
    return {
      ...TOOLS,
      base: { z: Z(1.15, t) },
      hip: { y: -0.56, rx: -12 },
      torso: { rx: 6 },
      head: { rx: -12 + 9 * Math.sin(w), rz: 10 * Math.cos(w), ry: 0 },
      legL: { a: 82, b: 16, k: 8, foot: 32 }, legR: { a: 82, b: 16, k: 8, foot: 32 },
      L: { at: [0.34, 0.5, 1.15 + 0.42 + fz(t)], pole: [1, 0, -0.3], ha: [0.4, 0.9, 0.1] },
      R: { at: [0.34, 0.5, 1.15 + 0.42 + fz(t)], pole: [1, 0, -0.3], ha: [0.4, 0.9, 0.1] },
      face: 'dizzy', fx: { stars: 1 },
      ...extra,
    };
  };
  const flat = (t, sq = 1, kick = 0) => ({
    ...TOOLS,
    base: { rx: 90, y: BELLY, sq },
    torso: { rx: 0 }, head: { rx: -46 + 4 * Math.sin(t * 9) },
    L: { a: 168, b: 30, fa: 176, fb: 30, ha: [0, 0.2, 1] }, R: { a: 168, b: 30, fa: 176, fb: 30, ha: [0, 0.2, 1] },
    legL: { a: -4, b: 6, k: 82 + kick * 22 * Math.sin(t * 26), foot: 10 },
    legR: { a: -4, b: 6, k: 82 - kick * 22 * Math.sin(t * 26), foot: 10 },
    face: 'dizzy',
  });
  const hatGrab = (t) => {   // fist target on the near rim of the resting hat (facing frame)
    const p = TRIP_HAT.clone();
    return [p.x, 0.34, p.z - 0.5 + fz(t)];
  };
  const stand = (t, extra = {}) => ({ ...TOOLS, base: { z: Z(TRIP_STAND, t) }, L: holdL(), R: carryR(), ...extra });
  return [
    [0.0, (t) => runSpec(ph0 + t)],
    [0.22, () => ({ ...TOOLS, base: { rx: 24 }, hip: { y: -0.03 }, torso: { rx: 8 }, head: { rx: -26 },
      L: { a: 115, b: 38, fa: 150, fb: 34, ha: [0, 0.5, -0.8] }, R: { a: 125, b: 34, fa: 160, fb: 28, ha: [0, 0.3, -1] },
      legL: { a: 26, k: 16 }, legR: { a: -40, k: 58, foot: -26 }, face: 'oh' })],
    [0.42, () => ({ ...TOOLS, base: { rx: 66, y: 0.24 }, head: { rx: -40 },
      L: { a: 160, b: 24, fa: 172, fb: 20, ha: [0, 0.2, 1] }, R: { a: 160, b: 24, fa: 172, fb: 20, ha: [0, 0.2, 1] },
      legL: { a: -10, k: 66, foot: 0 }, legR: { a: -14, k: 74, foot: 0 }, face: 'oh' })],
    [0.58, (t) => flat(t, 0.8)],
    [0.7, (t) => flat(t, 1.07)],
    [0.84, (t) => flat(t, 1, 0.3)],
    [1.3, (t) => flat(t, 1, 1)],
    [1.55, (t) => ({ ...flat(t, 1), torso: { rx: -50 }, head: { rx: -8 },
      L: { a: 95, b: 18, fa: 95, fb: 14, ha: [0, 0.2, 1] }, R: { a: 95, b: 18, fa: 95, fb: 14, ha: [0, 0.2, 1] },
      legL: { a: 0, b: 6, k: 30, foot: 40 }, legR: { a: 0, b: 6, k: 30, foot: 40 } })],
    [1.72, (t) => ({ ...sit(t), base: { z: Z(0.95, t), y: 0.3, sq: 1.1 }, legL: { a: 60, b: 18, k: 70, foot: 10 }, legR: { a: 60, b: 18, k: 70, foot: 10 },
      L: { a: 70, b: 70, fa: 100, fb: 60, ha: [0, 1, 0] }, R: { a: 70, b: 70, fa: 100, fb: 60, ha: [0, 1, 0] }, fx: { stars: 0 } })],
    [1.9, (t) => sit(t, { base: { z: Z(1.15, t), sq: 0.9 } })],
    [2.05, (t) => sit(t)],
    [2.7, (t) => sit(t)],
    [2.92, (t) => sit(t, { head: { rx: -24, ry: 12, rz: 4 }, torso: { rx: 12 }, face: 'oh', fx: { stars: 0, sweat: 1 } })],
    [3.18, (t) => ({ ...TOOLS, base: { z: Z(1.85, t), x: 0.12 }, hip: { y: -0.4, rx: 40 }, torso: { rx: 16 }, head: { rx: -34, ry: 8 },
      legL: { a: 50, b: 8, k: 100, foot: 20 }, legR: { a: -20, b: 6, k: 95, foot: -30 },
      L: { at: hatGrab(t), abs: true, pole: [1, -0.4, 0], hf: [0, -0.3, 1] }, R: { a: -20, b: 30, fa: 10, fb: 30, ha: [0, 0.5, -1] },
      face: 'open', fx: { sweat: 1 } })],
    [3.4, (t) => ({ ...TOOLS, base: { z: Z(1.88, t), x: 0.1 }, hip: { y: -0.42, rx: 42 }, torso: { rx: 18 }, head: { rx: -30, ry: 6 },
      legL: { a: 50, b: 8, k: 100, foot: 20 }, legR: { a: -20, b: 6, k: 95, foot: -30 },
      L: { at: hatGrab(t), abs: true, pole: [1, -0.4, 0], hf: [0, -0.3, 1] }, R: { a: -20, b: 30, fa: 10, fb: 30, ha: [0, 0.5, -1] },
      face: 'open' })],
    [3.7, (t) => stand(t, { L: { atT: [0.12, 0.55, 0.5], hf: [0, 0, 1], ha: [-0.2, 1, 0], pole: [1, -0.5, -0.3] }, head: { rx: -14 }, face: 'grin' })],
    [3.95, (t) => stand(t, { L: { atT: [0.3, 1.3, 0.28], hf: [-0.3, 0.6, 0.6], ha: [0, 0.5, -0.8], pole: [1, 0.2, -0.5] }, R: { atT: [0.42, 1.12, 0.12], pole: [1, -0.2, -0.5], ha: [0.1, 0.5, -0.86] }, head: { rx: -6 }, face: 'grin' })],
    [4.12, (t) => stand(t, { base: { z: Z(TRIP_STAND, t), sq: 0.88 }, hip: { y: -0.04 }, L: { atT: [0.45, 1.05, 0.1], pole: [1, -0.3, -0.4] }, R: { atT: [0.42, 1.05, 0.12], pole: [1, -0.2, -0.5], ha: [0.1, 0.5, -0.86] }, face: 'grin' })],
    [4.25, (t) => stand(t, { face: 'smile' })],
    [4.5, (t) => stand(t, { torso: { rz: 16 * Math.sin(t * 34) }, hip: { rz: -6 * Math.sin(t * 34), y: 0.02 * Math.abs(Math.sin(t * 34)) }, head: { rx: -10, rz: -10 * Math.sin(t * 34) }, face: 'smile' })],
    [4.75, (t) => stand(t, { face: 'grin' })],
    [TRIP_DUR, () => runSpec(0)],
  ];
}

// dust puffs for the trip (L-frame positions, start time, size)
const TRIP_PUFFS = [
  [0.58, -0.55, 1.4, 0.2], [0.6, 0.6, 1.2, 0.22], [0.62, -0.4, 2.5, 0.16], [0.6, 0.45, 2.6, 0.18], [0.64, 0.05, 3.1, 0.15],
  [1.9, -0.5, 1.0, 0.16], [1.92, 0.55, 0.95, 0.15],
  [4.3, -0.55, 2.0, 0.15], [4.42, 0.55, 2.3, 0.16], [4.55, -0.45, 2.45, 0.14], [4.62, 0.5, 1.95, 0.13],
];

// ---------------------------------------------------------------------------------------------------------
// poses (functions of time and a variant object; the looping extras play while update() runs)
const akimbo = { atT: [0.47, 0.1, 0.03], pole: [1, 0.25, -0.7], hf: [-0.3, -0.8, 0.35], hand: 'fist' };
const T2 = Math.PI * 2;

export const POSE_SPECS = {
  idle: (t) => idleSpec(t),

  wave: (t, v) => {
    const w = Math.sin(t * T2 * 1.7);
    const other = v.other === 'point'
      ? { atT: [0.3, 0.12, 0.46], pole: [1, -0.6, -0.2], hf: [0.05, -0.45, 1], hp: [-0.9, 0, 0.1], hand: 'point' }
      : v.other === 'hammer'
        ? { a: 30, b: 32, fa: 150, fb: 10, ha: [0.1, 0.2, -1], hf: [-0.4, 0.9, 0] }
        : akimbo;
    return {
      hammer: v.other === 'hammer' ? 'handL' : 'back',
      torso: { rz: 3, ry: -5 }, head: { rx: -12, rz: 7 + 2 * w, ry: -6 },
      R: { a: 108, b: 62, fa: 172, fb: 26 + 22 * w, hand: 'open', hp: [0, 0.3, 1] },
      L: other,
      face: v.face || 'grin',
    };
  },

  thumbsUp: (t) => {
    const b = Math.sin(t * T2 * 1.4);
    return {
      hip: { y: 0.012 * b }, head: { rx: -12, rz: 4 * Math.sin(t * T2 * 0.7) },
      L: { a: 62 + 5 * b, b: 42, fa: 100 + 6 * b, fb: 24, hand: 'thumb', ha: [-0.1, 1, 0.1] },
      R: { a: 62 - 5 * b, b: 42, fa: 100 - 6 * b, fb: 24, hand: 'thumb', ha: [-0.1, 1, 0.1] },
      face: 'grin',
    };
  },

  fistPump: (t) => {
    const p = Math.max(0, Math.sin(t * T2 * 1.5));
    return {
      base: { y: 0.02 * p }, torso: { rz: 4, rx: 2 }, head: { rx: -12, rz: 5 },
      R: { a: 52 + 6 * p, b: 58, fa: 166 + 8 * p, fb: -4, hand: 'fist', hp: [-0.35, 0, -1] },
      L: { a: -16, b: 18, fa: 68, fb: -12, hand: 'fist' },
      face: 'go',
    };
  },

  fingerHeart: (t) => {
    const w = Math.sin(t * T2 * 0.8);
    return {
      base: { rz: 2.5 * w }, head: { rx: -14, rz: -6 * w },
      L: { atT: [0.16, 0.5, 0.44], pole: [1, -0.6, -0.2], hand: 'heart', hf: [0, 0.6, 0.8], ha: [-0.4, 0.9, -0.1] },
      R: { atT: [0.16, 0.5, 0.44], pole: [1, -0.6, -0.2], hand: 'heart', hf: [0, 0.6, 0.8], ha: [-0.4, 0.9, -0.1] },
      face: 'smile',
    };
  },

  okSign: (t, v) => {
    const w = Math.sin(t * T2 * 1.2);
    return {
      torso: { rz: -3 }, head: { rx: -12, rz: -6 + 1.5 * w, ry: 6 },
      L: { a: 28 + 3 * w, b: 52, fa: 162, fb: 22, hand: 'ok', hf: [0.1, 1, 0.1], hp: [0.05, 0.35, 1] },
      R: akimbo,
      face: v.face || 'wink',
    };
  },

  hammerUp: (t) => {
    const w = Math.sin(t * T2 * 1.3);
    return {
      hammer: 'handR',
      base: { y: 0.015 * Math.max(0, w) }, torso: { rz: 5, rx: -2 }, head: { rx: -14, rz: 4 },
      R: { a: 122 + 4 * w, b: 64, fa: 166, fb: 44 + 3 * w, hand: 'fist', ha: [0.62, 0.74, 0.25], hf: [0, 0.3, 1] },
      L: akimbo,
      face: 'go',
    };
  },

  bow: (t, v) => {
    const d = 0.5 + 0.5 * Math.sin(t * T2 * 0.5);
    const pray = { atT: [0.06, 0.42, 0.36], pole: [1, -0.5, -0.4], hand: 'flat', hf: [0, 0.9, 0.35], hp: [-1, 0, 0] };
    const spec = {
      hip: { rx: 8 + 4 * d, z: -0.03 }, torso: { rx: 6 + 4 * d }, head: { rx: -27 + 2 * d },
      L: pray, R: pray, face: 'smile',
    };
    if (v.hat) {   // hard hat off and held to his chest, a bow of respect
      spec.hat = { in: 'torso', p: [0, 0.4, 0.44], r: [-30, 0, 0], aa: [0, 1, 1, 180] };
      spec.L = { atT: [0.5, 0.42, 0.5], pole: [1, -0.5, -0.4], hand: 'fist', hf: [-1, 0, 0.25], ha: [0, 0.5, 0.85] };
      spec.R = spec.L;
      spec.head = { rx: 2 + 6 * d };
    }
    return spec;
  },

  salute: (t) => {
    const w = Math.sin(t * T2 * 1.0);
    return {
      base: { y: 0.008 * w }, head: { rx: -8, rz: 6 },
      R: { atT: [0.43, 1.42, 0.32], pole: [1, 0.25, -0.35], hand: 'flat', hf: [-0.6, 0.75, 0.1], hp: [0.15, -0.2, 1] },
      L: { a: 1, b: 7, fa: 1, fb: 6, hand: 'flat', hp: [-1, 0, 0] },
      face: 'go',
    };
  },

  shovelDig: (t) => {
    // a dig cycle: push in, lever back, lift and toss
    const P = 1.5, u = (t % P) / P;
    const k = [
      [0.0, { at: [-0.75, 0.3, 0.85], dir: [0.6, 0.7, -0.4], lean: 18 }],
      [0.35, { at: [-0.75, 0.03, 0.88], dir: [0.58, 0.74, -0.36], lean: 26 }],
      [0.55, { at: [-0.72, 0.06, 0.85], dir: [0.6, 0.58, -0.55], lean: 22 }],
      [0.8, { at: [-0.88, 0.5, 0.62], dir: [0.75, 0.55, -0.36], lean: 12 }],
      [1.0, { at: [-0.75, 0.3, 0.85], dir: [0.6, 0.7, -0.4], lean: 18 }],
    ];
    let i = 0;
    while (u > k[i + 1][0]) i++;
    const [u0, A] = k[i], [u1, B] = k[i + 1];
    const e = (u - u0) / (u1 - u0), s = e * e * (3 - 2 * e);
    const mix = (a, b) => a.map((x, j) => lerp(x, b[j], s));
    const lean = lerp(A.lean, B.lean, s);
    return {
      shovel: { in: 'base', at: mix(A.at, B.at), dir: mix(A.dir, B.dir), roll: 0 },
      hammer: 'back',
      hip: { y: -0.08, rx: lean * 0.45 }, torso: { rx: lean * 0.55, ry: -14 }, head: { rx: -lean - 16, ry: -6 },
      legL: { a: 14, b: 6, k: 18 }, legR: { a: -12, b: 6, k: 10 },
      R: { grab: 1.0, pole: [1, -0.6, -0.3] }, L: { grab: 1.28, pole: [1, -0.2, -0.6] },
      face: 'go',
    };
  },

  think: (t) => {
    const w = Math.sin(t * T2 * 0.6);
    return {
      torso: { rz: -3, rx: 2 }, head: { rx: -16 + 2 * w, rz: -9, ry: 6 },
      L: { atT: [0.07, 0.84, 0.47], pole: [0.6, -1, 0], hand: 'fist', hf: [-0.1, 1, 0.2] },
      R: { atT: [0.18, 0.28, 0.42], pole: [1, -0.6, -0.2], hand: 'flat', hf: [-1, 0.15, 0.2], hp: [0, 1, 0] },
      face: 'think',
    };
  },

  run: (t) => runSpec(t),

  cheer: (t) => {
    const ph = t * T2 * 1.6, hop = Math.max(0, Math.sin(ph));
    return {
      base: { y: 0.16 * hop, sq: 1 + 0.06 * Math.sin(ph) },
      legL: { a: 8 * hop, k: 18 * hop }, legR: { a: 8 * hop, k: 18 * hop },
      head: { rx: -16 },
      L: { a: 166, b: 36 + 6 * hop, fa: 176, fb: 32 + 8 * hop, hand: 'fist' },
      R: { a: 166, b: 36 + 6 * hop, fa: 176, fb: 32 + 8 * hop, hand: 'fist' },
      face: 'grin',
    };
  },
};

// mirror a spec left <-> right
function mirrorSpec(sp) {
  const o = { ...sp };
  o.L = sp.R; o.R = sp.L;
  if (sp.legL || sp.legR) { o.legL = sp.legR; o.legR = sp.legL; }
  for (const k of ['base', 'hip', 'torso', 'head']) if (sp[k]) o[k] = { ...sp[k], ry: -(sp[k].ry || 0), rz: -(sp[k].rz || 0), x: -(sp[k].x || 0) };
  const sw = (p) => (p === 'handL' ? 'handR' : p === 'handR' ? 'handL' : p);
  o.hammer = sw(sp.hammer); o.shovel = sw(sp.shovel); o.hat = sw(sp.hat);
  if (sp.face === 'wink') o.face = 'wink';
  return o;
}

// ---------------------------------------------------------------------------------------------------------
// the character
export function createChuan({ hat = true, tools = true } = {}) {
  const m = mats();
  const rig = buildRig();
  const useHammer = tools === true || (tools && tools.hammer);
  const useShovel = tools === true || (tools && tools.shovel);
  const hatObj = hat ? createHardHat() : null;
  const hammer = useHammer ? createHammer() : null;
  const shovel = useShovel ? createShovel() : null;
  if (hatObj) rig.head.hatSeat.add(hatObj);

  const puffs = [];
  const nodes = {
    handL: rig.arms.L.wrist, handR: rig.arms.R.wrist, torso: rig.torso, pelvis: rig.pelvis, base: rig.base,
    head: rig.head.hatSeat, facing: rig.facing,
  };

  function placeProp(obj, pl) {
    if (!obj) return;
    if (!pl || pl.node === 'none') { obj.visible = false; return; }
    obj.visible = true;
    const parent = nodes[pl.node];
    if (obj.parent !== parent) parent.add(obj);
    obj.position.copy(pl.p);
    obj.quaternion.copy(pl.q);
  }

  function apply(st) {
    const sq = st.base.sq;
    rig.base.position.copy(st.base.p);
    rig.base.quaternion.copy(st.base.q);
    rig.base.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    rig.pelvis.position.copy(st.hip.p);
    rig.pelvis.quaternion.copy(st.hip.q);
    rig.torso.quaternion.copy(st.torso);
    rig.neck.quaternion.copy(st.head);
    for (const sd of ['L', 'R']) {
      const a = rig.arms[sd], s = st[sd];
      a.sh.quaternion.copy(s.u); a.el.quaternion.copy(s.l); a.wrist.quaternion.copy(s.h);
      a.hand.set(s.hand);
    }
    for (const [sd, key] of [['L', 'legL'], ['R', 'legR']]) {
      const g = rig.legs[sd], s = st[key];
      g.hp.quaternion.copy(s.u); g.kn.quaternion.copy(s.l); g.an.quaternion.copy(s.f);
    }
    rig.head.setFace(st.face);
    rig.head.setFx(st.fx.stars > 0.5, st.fx.sweat > 0.5, clockT);
    placeProp(hammer, st.hammer);
    placeProp(shovel, st.shovel);
    if (!tripHat) placeProp(hatObj, st.hat);
    last = st;
  }

  // ---- playback state
  let mode = { kind: 'pose', name: 'idle', k: 1, v: {}, t: 0 };
  let fade = null;
  let last = null;
  let clockT = 0;
  let resume = null;
  let tripCtx = null;
  let tripHat = false;

  function poseState(name, t, k, v) {
    const fn = POSE_SPECS[name] || POSE_SPECS.idle;
    let sp = fn(t, v || {});
    if (v && v.mirror) sp = mirrorSpec(sp);
    if (v && v.face) sp = { ...sp, face: v.face };
    if (!useHammer) sp = { ...sp, hammer: 'none' };
    if (!useShovel) sp = { ...sp, shovel: 'none' };
    const st = solve(sp);
    return k >= 1 ? st : blend(restState(), st, Math.max(0, k));
  }

  function motionState(name, t) {
    if (name === 'walk') return solve(walkSpec(t));
    if (name === 'run') return solve(runSpec(t));
    if (name === 'jump') return keyed(JUMP_KEYS, t);
    if (name === 'trip') return keyed(tripCtx.keys, t);
    return solve(idleSpec(t));
  }

  function evaluate() {
    let st = mode.kind === 'pose' ? poseState(mode.name, mode.t, mode.k, mode.v) : motionState(mode.name, mode.t);
    if (fade) {
      const u = Math.min(1, fade.t / fade.dur), e = u * u * (3 - 2 * u);
      st = blend(fade.from, st, e);
      if (u >= 1) fade = null;
    }
    apply(st);
    if (mode.kind === 'motion' && mode.name === 'trip') tripObjects(mode.t);
  }

  // ---- trip: the hat (and dust) leave the rig and move in the facing frame
  const relM = (node) => {
    const mm = new M4();
    for (let n = node; n && n !== rig.facing; n = n.parent) { n.updateMatrix(); mm.premultiply(n.matrix); }
    return mm;
  };
  const decompose = (mm) => { const p = new V3(), q = new QT(), s = new V3(); mm.decompose(p, q, s); return { p, q }; };

  function hatPathL(t) {   // the hat's flight in the L frame after it pops off: { p, q }
    const c = tripCtx;
    const X = new V3(1, 0, 0), Y = new V3(0, 1, 0);
    const B1 = new V3(0.75, 0.035, 4.45), B2 = new V3(0.7, 0.035, 5.0);
    const H = TRIP_HAT.clone().setY(0.035);
    const wob = (amp, tt) => new QT().setFromEuler(new THREE.Euler(amp * Math.sin(tt * 15), 0, amp * Math.cos(tt * 13.5)));
    if (t < 0.92) {        // pops up, somersaults forward, lands on its brim
      const u = (t - 0.45) / 0.47;
      const p = c.hat0.p.clone().lerp(B1, u);
      p.y = lerp(c.hat0.p.y, B1.y, u) + 4 * 0.85 * u * (1 - u);
      const q = c.hat0.q.clone().slerp(new QT(), u).multiply(new QT().setFromAxisAngle(X, T2 * u));
      return { p, q };
    }
    if (t < 1.22) {        // a smaller bounce with a half spin
      const u = (t - 0.92) / 0.3;
      const p = B1.clone().lerp(B2, u);
      p.y += 4 * 0.38 * u * (1 - u);
      return { p, q: new QT().setFromAxisAngle(Y, Math.PI * u).multiply(wob(0.3 * Math.sin(Math.PI * u), t)) };
    }
    const spin0 = new QT().setFromAxisAngle(Y, Math.PI);
    if (t < 1.6) return { p: B2.clone(), q: spin0.clone().multiply(wob(0.32 * (1 - (t - 1.22) / 0.38 * 0.4), t)) };
    if (t < 2.3) {         // rolls back toward him on its brim, wobbling like a spun coin
      const u = (t - 1.6) / 0.7, e = 1 - (1 - u) * (1 - u);
      const p = B2.clone().lerp(H, e);
      return { p, q: new QT().setFromAxisAngle(Y, Math.PI + 2.5 * T2 * e).multiply(wob(0.22, t)) };
    }
    const decay = Math.max(0, 1 - (t - 2.3) / 0.6);
    return { p: H, q: new QT().setFromAxisAngle(Y, Math.PI + 2.5 * T2).multiply(wob(0.22 * decay * decay, t)) };
  }

  function tripObjects(t) {
    const c = tripCtx;
    const off = new V3(0, 0, fz(t));
    if (hatObj) {
      if (t >= 0.45 && !tripHat) {
        // pop! capture where it is now, in the L frame
        const h = decompose(relM(rig.head.hatSeat));
        c.hat0 = { p: h.p.clone().sub(off), q: h.q };
        tripHat = true;
        rig.facing.add(hatObj);
        hatObj.visible = true;
      }
      if (tripHat) {
        let p, q;
        if (t < 3.3) ({ p, q } = hatPathL(t), p = p.clone().add(off));
        else {
          const held = decompose(relM(rig.arms.L.wrist).multiply(new M4().compose(GRIP.hat.p, GRIP.hat.q, ONE)));
          if (t < 3.42) {
            const rest = hatPathL(3.3), u = (t - 3.3) / 0.12;
            p = rest.p.clone().add(off).lerp(held.p, u); q = rest.q.clone().slerp(held.q, u);
          } else if (t < 3.95) ({ p, q } = held);
          else {
            const seat = decompose(relM(rig.head.hatSeat)), u = Math.min(1, (t - 3.95) / 0.17), e = u * u * (3 - 2 * u);
            p = held.p.clone().lerp(seat.p, e); p.y += 0.25 * Math.sin(Math.PI * e);
            q = held.q.clone().slerp(seat.q, e);
          }
        }
        hatObj.position.copy(p);
        hatObj.quaternion.copy(q);
      }
    }
    // dust puffs
    while (puffs.length < TRIP_PUFFS.length) {
      const o = add(rig.facing, sph(1, 12, 8), m.dust);
      o.visible = false;
      puffs.push(o);
    }
    TRIP_PUFFS.forEach(([t0, x, z, s], i) => {
      const o = puffs[i], u = (t - t0) / 0.5;
      o.visible = u > 0 && u < 1;
      if (o.visible) {
        o.scale.setScalar(s * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.8 + 0.4 * u));
        o.position.set(x * (1 + 0.4 * u), 0.08 + 0.25 * u, z + fz(t));
      }
    });
  }

  function endTrip() {
    if (hatObj) { rig.head.hatSeat.add(hatObj); hatObj.position.set(0, 0, 0); hatObj.quaternion.identity(); }
    tripHat = false;
    for (const o of puffs) o.visible = false;
  }

  // ---- public API
  function setPose(name, k = 1, v = {}) {
    if (tripHat) endTrip();
    const same = mode.kind === 'pose' && mode.name === name;
    mode = { kind: 'pose', name, k, v, t: same ? mode.t : 0 };
    fade = null;
    evaluate();
  }

  function play(name, opts = {}) {
    if (!['idle', 'walk', 'run', 'jump', 'trip'].includes(name)) name = 'idle';
    if (tripHat && name !== 'trip') endTrip();
    const prev = mode;
    if (name === 'jump') {
      if (prev.name === 'jump') return;
      resume = prev.name === 'trip' ? { kind: 'motion', name: 'run', t: 0 } : { ...prev };
    }
    if (name === 'trip') {
      const ph0 = prev.kind === 'motion' && prev.name === 'run' ? prev.t : 0;
      tripCtx = { keys: tripKeys(ph0), onDone: opts.onDone, then: opts.then || 'run' };
      if (tripHat) endTrip();
    }
    mode = { kind: 'motion', name, t: 0, opts };
    fade = last ? { from: last, t: 0, dur: name === 'trip' ? 0.08 : name === 'jump' ? 0.1 : 0.22 } : null;
    evaluate();
  }

  function update(dt = 1 / 60) {
    dt = Math.min(dt, 0.1);
    clockT += dt;
    mode.t += dt;
    if (fade) fade.t += dt;
    if (mode.kind === 'motion' && mode.name === 'jump' && mode.t >= JUMP_DUR) {
      const r = resume || { kind: 'motion', name: 'idle', t: 0 };
      resume = null;
      mode = { ...r, t: r.kind === 'pose' ? r.t : 0 };
      fade = { from: last, t: 0, dur: 0.12 };
    }
    if (mode.kind === 'motion' && mode.name === 'trip' && mode.t >= TRIP_DUR) {
      const done = tripCtx.onDone, then = tripCtx.then;
      endTrip();
      mode = { kind: 'motion', name: then, t: 0 };
      fade = { from: last, t: 0, dur: 0.05 };
      evaluate();
      if (done) done();
      return;
    }
    evaluate();
  }

  const api = {
    group: rig.root, rig, hat: hatObj, hammer, shovel,
    speeds: SPEEDS,
    durations: { jump: JUMP_DUR, trip: TRIP_DUR },
    // live forward speed in em/s: move group along the facing direction by speed * dt every frame
    get speed() {
      if (mode.kind !== 'motion') return 0;
      if (mode.name === 'trip') return tripSpeedAt(mode.t, RUN_SPEED);
      if (mode.name === 'jump') return 0;
      return SPEEDS[mode.name] || 0;
    },
    get motion() { return mode.kind === 'motion' ? mode.name : null; },
    get pose() { return mode.kind === 'pose' ? mode.name : null; },
    get time() { return mode.t; },
    setPose, play, update,
    setFacing(yaw) { rig.facing.rotation.y = yaw; },
    setFace(name) { rig.head.setFace(name); },
  };
  setPose('idle', 1);
  return api;
}
