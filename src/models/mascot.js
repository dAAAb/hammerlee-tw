// 小新: the citizen mascot who stands for the user (an elder of New Taipei) in their stickers. A soft teal mochi
// with a big friendly face on the front-top, stubby arms, two little feet and a little yellow flower clip.
// Origin at the floor between the feet, faces +z, about 2.6 em tall (MASCOT_SCALE × a 2 em model). createMascot() clones a shared prototype
// (geometry and materials are shared); setMascotPose() swaps the face, arms and props, and the group's
// userData.tick plays a small looping idle that suits the pose.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { makeEmoji } from './emoji.js';

export const MASCOT_POSES = ['idle', 'wow', 'love', 'clap', 'thumb', 'tea', 'flower', 'laugh', 'ok', 'cheer', 'moved'];

const C = {
  body:   { l: '#68ded9', m: '#2fbfbd', d: '#137677' },
  eye:    { l: '#3d3532', m: '#2b2522', d: '#171311' },
  cheek:  { l: '#ffb1c0', m: '#f48ea5', d: '#b2536a' },
  mouth:  { l: '#7a302b', m: '#55201c', d: '#2e0f0d' },
  tongue: { l: '#ff8d8d', m: '#ea6767', d: '#8c2d2d' },
  tear:   { l: '#c4ecff', m: '#86cdf3', d: '#3b7fae' },
  heart:  { l: '#ff6d86', m: '#e8435f', d: '#86203a' },
  wrap:   { l: '#fff6fb', m: '#f6d9e6', d: '#b88aa0' },
};
const mat = k => toon(C[k] || k);
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(geo, pal, name) { const m = new THREE.Mesh(geo, mat(pal)); m.castShadow = true; if (name) m.name = name; return m; }
function add(parent, obj, x = 0, y = 0, z = 0) { obj.position.set(x, y, z); parent.add(obj); return obj; }
function group(parent, name, x = 0, y = 0, z = 0) { const g = new THREE.Group(); if (name) g.name = name; return add(parent, g, x, y, z); }
function ell(rx, ry, rz, w = 16, h = 12) { return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz); }
function puff(shape, h, b = 0.04, segs = 2, curve = 12) {
  b = Math.min(b, h * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.004, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segs, curveSegments: curve, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  return g;
}
function heartShape(w) {
  const s = new THREE.Shape(), k = w / 32, N = 40;
  for (let i = 0; i < N; i++) {
    const t = i / N * TAU, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    i ? s.lineTo(x * k, (y + 2.5) * k) : s.moveTo(x * k, (y + 2.5) * k);
  }
  return s;
}
function stroke(parent, pts, r, pal, name) {
  const g = new THREE.Group(); if (name) g.name = name;
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), Math.max(10, pts.length * 6), r, 6, false), pal));
  const cap = new THREE.SphereGeometry(r, 8, 6);
  add(g, mesh(cap, pal), pts[0].x, pts[0].y, pts[0].z);
  const e = pts[pts.length - 1]; add(g, mesh(cap, pal), e.x, e.y, e.z);
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------- the body: a lathed mochi
const BR = 1.12, YC = 0.8, BT = 1.18, BB = 0.8;
function prof(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return th < 0 ? [BR * Math.pow(Math.max(0, c), 0.55), YC + BB * s] : [BR * c, YC + BT * s];
}
// point + outward normal on the body; th = elevation (-π/2 bottom .. π/2 top), ph = azimuth from +z toward +x
function surf(th, ph, lift = 0) {
  const [r, y] = prof(th);
  const e = 1e-3, [r1, y1] = prof(th + e), [r0, y0] = prof(th - e);
  const dth = v3((r1 - r0) * Math.sin(ph), y1 - y0, (r1 - r0) * Math.cos(ph));
  const dph = v3(Math.cos(ph), 0, -Math.sin(ph));
  const n = new THREE.Vector3().crossVectors(dph, dth).normalize();
  return { p: v3(r * Math.sin(ph), y, r * Math.cos(ph)).addScaledVector(n, lift), n };
}
function onBody(obj, th, ph, lift = 0) {
  const { p, n } = surf(th, ph, lift);
  obj.position.copy(p); obj.quaternion.setFromUnitVectors(UP, n);
  return obj;
}
const bodyStroke = (parent, tp, r, pal, lift = 0, name) => stroke(parent, tp.map(([th, ph]) => surf(th, ph, lift).p), r, pal, name);

export const MASCOT_SCALE = 1.3;   // the body is modelled ~2 em tall; shown ~2.6 em
const ARM = 0.56;   // shoulder to hand centre at rest; poses may stretch it (squishy mochi arms)
const EYE_TH = 0.66, EYE_PH = 0.33, MOUTH_TH = 0.4;

let GEO = null;
function geos() {
  if (GEO) return GEO;
  const pts = [];
  for (let i = 0; i <= 28; i++) { const [r, y] = prof(-Math.PI / 2 + Math.PI * i / 28); pts.push(new THREE.Vector2(Math.max(r, i === 0 || i === 28 ? 0 : 1e-4), y)); }
  const dshape = new THREE.Shape();
  dshape.moveTo(-0.21, 0.07); dshape.lineTo(0.21, 0.07); dshape.absellipse(0, 0.07, 0.21, 0.19, 0, -Math.PI, true);
  GEO = {
    body: new THREE.LatheGeometry(pts, 36),
    eye: ell(0.14, 0.08, 0.19, 14, 10),
    hi: new THREE.SphereGeometry(0.042, 8, 6),
    hi2: new THREE.SphereGeometry(0.024, 8, 6),
    blush: ell(0.15, 0.04, 0.09, 14, 8),
    heartEye: puff(heartShape(0.3), 0.08, 0.03, 2),
    dmouth: puff(dshape, 0.12, 0.025, 2),
    tongue: puff(new THREE.Shape().absellipse(0, 0, 0.1, 0.06, 0, TAU, false), 0.04, 0.012, 1),
    omouth: ell(0.09, 0.05, 0.12, 12, 8),
    arm: new THREE.CapsuleGeometry(0.15, 0.48, 4, 12).translate(0, -0.24, 0),
    hand: new THREE.SphereGeometry(0.17, 14, 10),
    foot: ell(0.25, 0.13, 0.21, 16, 10),
    petal: ell(0.11, 0.06, 0.15, 12, 8),
    bud: new THREE.SphereGeometry(0.09, 12, 8),
    leaf: ell(0.07, 0.03, 0.14, 10, 6),
    drop: ell(0.07, 0.05, 0.1, 10, 8),
  };
  return GEO;
}

// ---------------------------------------------------------------- prototype
let PROTO = null;
function buildProto() {
  const G = geos();
  const root = new THREE.Group();
  root.name = 'mascot';
  const size = group(root, 'size');
  size.scale.setScalar(MASCOT_SCALE);
  const sq = group(size, 'squash');
  for (const s of [-1, 1]) add(sq, mesh(G.foot, 'body'), s * 0.42, 0.11, 0.74);
  const tilt = group(sq, 'tilt');
  add(tilt, mesh(G.body, 'body', 'bodyMesh'));

  // a little yellow flower clipped on the head (top-right, tipped toward the viewer)
  const clip = group(tilt, 'clip');
  onBody(clip, 0.86, 1.2, -0.03);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; const m = add(clip, mesh(G.petal, 'yellow'), Math.sin(a) * 0.15, 0.04, -Math.cos(a) * 0.15); m.rotation.y = -a; }
  add(clip, mesh(G.bud, 'orange'), 0, 0.08, 0);
  for (const a of [2.6, 3.7]) { const m = add(clip, mesh(G.leaf, 'leaf'), Math.sin(a) * 0.25, 0.0, -Math.cos(a) * 0.25); m.rotation.y = -a; }
  // face
  const face = group(tilt, 'face');
  const eyeSet = (name, build) => { const g = group(face, 'eyes:' + name); build(g); g.visible = false; return g; };
  const dotEye = (g, ph, big = 1) => {
    const e = onBody(mesh(G.eye, 'eye'), EYE_TH, ph, -0.03);
    e.scale.setScalar(big);
    add(e, mesh(G.hi, 'white'), -0.04, 0.07, -0.075);
    if (big > 1) add(e, mesh(G.hi2, 'white'), 0.04, 0.05, 0.06);
    g.add(e);
  };
  const caret = (g, ph, up = 1) => bodyStroke(g, [[EYE_TH - 0.06 * up, ph - 0.13], [EYE_TH + 0.055 * up, ph], [EYE_TH - 0.06 * up, ph + 0.13]], 0.05, 'eye', 0.005);
  eyeSet('dot', g => { dotEye(g, -EYE_PH); dotEye(g, EYE_PH); });
  eyeSet('wide', g => { dotEye(g, -EYE_PH, 1.22); dotEye(g, EYE_PH, 1.22); });
  eyeSet('happy', g => { caret(g, -EYE_PH); caret(g, EYE_PH); });
  eyeSet('wink', g => { dotEye(g, -EYE_PH); caret(g, EYE_PH); });
  eyeSet('laugh', g => {
    for (const s of [-1, 1]) bodyStroke(g, [[EYE_TH + 0.075, s * 0.45], [EYE_TH, s * 0.22], [EYE_TH - 0.075, s * 0.45]], 0.05, 'eye', 0.005);
    for (const s of [-1, 1]) g.add(onBody(mesh(G.drop, 'tear'), EYE_TH - 0.04, s * 0.6, -0.01));
  });
  eyeSet('heart', g => { for (const s of [-1, 1]) g.add(onBody(mesh(G.heartEye, 'heart'), EYE_TH, s * EYE_PH, -0.02)); });
  eyeSet('teary', g => {
    dotEye(g, -EYE_PH, 1.22); dotEye(g, EYE_PH, 1.22);
    for (const s of [-1, 1]) {
      bodyStroke(g, [[EYE_TH - 0.12, s * 0.31], [EYE_TH - 0.25, s * 0.33], [EYE_TH - 0.4, s * 0.34]], 0.05, 'tear', 0.0, 'tear');
      g.add(onBody(mesh(G.drop, 'tear'), EYE_TH - 0.45, s * 0.34, 0.0));
    }
  });
  const mouthSet = (name, build) => { const g = group(face, 'mouth:' + name); build(g); g.visible = false; return g; };
  mouthSet('smile', g => { const p = []; for (let i = 0; i <= 8; i++) { const u = -1 + i / 4; p.push([MOUTH_TH + 0.075 * u * u, 0.18 * u]); } bodyStroke(g, p, 0.045, 'mouth', 0.004); });
  mouthSet('open', g => {
    const m = onBody(mesh(G.dmouth, 'mouth'), MOUTH_TH, 0, -0.1);
    add(m, mesh(G.tongue, 'tongue'), 0, 0.095, 0.05);
    g.add(m);
  });
  mouthSet('o', g => { g.add(onBody(mesh(G.omouth, 'mouth'), MOUTH_TH - 0.02, 0, -0.02)); });
  mouthSet('wobble', g => { const p = []; for (let i = 0; i <= 10; i++) { const u = -1 + i / 5; p.push([MOUTH_TH + 0.025 * Math.sin(u * 7), 0.14 * u]); } bodyStroke(g, p, 0.036, 'mouth', 0.004); });
  mouthSet('cat', g => { bodyStroke(g, [[MOUTH_TH + 0.05, -0.15], [MOUTH_TH - 0.02, -0.075], [MOUTH_TH + 0.04, 0], [MOUTH_TH - 0.02, 0.075], [MOUTH_TH + 0.05, 0.15]], 0.04, 'mouth', 0.004); });
  const blush = group(face, 'blush');
  for (const s of [-1, 1]) blush.add(onBody(mesh(G.blush, 'cheek'), MOUTH_TH + 0.08, s * 0.62, -0.022));

  // arms: a pivot at each shoulder; the arm hangs along the pivot's -y
  for (const s of [-1, 1]) {
    const { p } = surf(0.0, s * 1.0, -0.08);
    const piv = group(tilt, s > 0 ? 'armR' : 'armL', p.x, p.y, p.z);
    add(piv, mesh(G.arm, 'body', s > 0 ? 'armMeshR' : 'armMeshL'));
    const hand = group(piv, s > 0 ? 'handR' : 'handL', 0, -ARM, 0);
    add(hand, mesh(G.hand, 'body'));
  }
  group(tilt, 'fx');     // pose props that ride on the body (foam thumb, tea, bouquet...)
  group(size, 'float');  // pose props that float around (hearts, sparkles)
  return root;
}

// ---------------------------------------------------------------- props (built once, cloned)
const PROPS = {};
function prop(name, build) {
  if (!PROPS[name]) { const g = new THREE.Group(); build(g); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); PROPS[name] = g; }
  const c = PROPS[name].clone(); c.name = 'prop:' + name;
  return c;
}
const PROP_BUILD = {
  pompomY: g => pompom(g, 'yellow'),
  pompomB: g => pompom(g, 'blue'),
  maru: g => { add(g, mesh(new THREE.TorusGeometry(0.36, 0.1, 10, 28), { l: '#ff6b5e', m: '#e0473b', d: '#7a1d16' })); },
  cup: g => {
    const prof = [[0, 0], [0.19, 0], [0.22, 0.03], [0.3, 0.34], [0.32, 0.38], [0.3, 0.395], [0.28, 0.375], [0.27, 0.32], [0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
    add(g, mesh(new THREE.LatheGeometry(prof, 28), 'white'));
    add(g, mesh(new THREE.TorusGeometry(0.262, 0.028, 6, 28).rotateX(Math.PI / 2), 'teal'), 0, 0.17, 0);
    add(g, mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.012, 24), { l: '#e9ac45', m: '#c98522', d: '#6d420b' }), 0, 0.33, 0);
    const hd = add(g, mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 14, Math.PI * 1.3), 'white'), 0.31, 0.2, 0);
    hd.rotation.z = -Math.PI * 0.65;
    const st = group(g, 'steam');
    stroke(st, [v3(-0.08, 0.34, 0), v3(-0.02, 0.48, 0), v3(-0.1, 0.6, 0), v3(-0.04, 0.74, 0)], 0.035, 'white');
    stroke(st, [v3(0.1, 0.34, -0.05), v3(0.15, 0.45, -0.05), v3(0.09, 0.56, -0.05), v3(0.14, 0.67, -0.05)], 0.03, 'white');
  },
  bouquet: g => {
    const wrapG = new THREE.ConeGeometry(0.3, 0.62, 14, 1, true).rotateX(Math.PI);
    const w = add(g, new THREE.Mesh(wrapG, toon(C.wrap, { side: 2 })), 0, 0, 0);
    w.castShadow = true;
    add(g, mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 16).rotateX(Math.PI / 2), 'pink'), 0, -0.12, 0);
    const lg = ell(0.07, 0.035, 0.2, 10, 6);
    for (const a of [-0.9, 0.9, 2.6]) { const l = add(g, mesh(lg, 'leaf'), Math.sin(a) * 0.22, 0.32, Math.cos(a) * 0.22); l.rotation.set(0.5, a, 0, 'YXZ'); }
    [[0, 0.36, 0.05, 0.62], [-0.18, 0.32, -0.08, 0.5], [0.18, 0.33, -0.06, 0.5], [0.02, 0.3, -0.2, 0.46]].forEach(([x, y, z, s], i) => {
      const f = add(g, makeEmoji('flower'), x, y, z);
      f.scale.setScalar(s); f.rotation.set(0.35, i * 1.3, 0);
    });
  },
};
function pompom(g, pal) {
  const geo = new THREE.IcosahedronGeometry(0.27, 1); geo.computeVertexNormals();
  add(g, mesh(geo, pal), 0, -0.22, 0);
  const sg = new THREE.IcosahedronGeometry(0.12, 0); sg.computeVertexNormals();
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; add(g, mesh(sg, pal), Math.cos(a) * 0.24, -0.22 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.24); }
}

// ---------------------------------------------------------------- poses
// arm directions for the right arm (x = outward); the left arm mirrors x unless given
const POSE = {
  idle:   { eyes: 'dot', mouth: 'smile', blush: true, R: [0.55, -0.8, 0.25] },
  wow:    { eyes: 'wide', mouth: 'o', blush: false, R: [0.8, 0.55, 0.22], tilt: [-0.08, 0] },
  love:   { eyes: 'heart', mouth: 'smile', blush: true, R: [-0.3, 0.6, 0.75], tilt: [0, 0.07], reach: 0.7 },
  clap:   { eyes: 'happy', mouth: 'open', blush: true, R: [-0.6, 0.25, 0.76], reach: 0.85 },
  thumb:  { eyes: 'wink', mouth: 'smile', blush: true, R: [0.35, 0.7, 0.62], L: [0.6, -0.75, 0.3], tilt: [0, -0.06] },
  tea:    { eyes: 'happy', mouth: 'cat', blush: true, R: [-0.6, -0.1, 0.8], reach: 0.75 },
  flower: { eyes: 'dot', mouth: 'smile', blush: true, R: [-0.05, 0.3, 0.95], L: [0.55, -0.8, 0.25], tilt: [0, -0.05], reach: 0.7 },
  laugh:  { eyes: 'laugh', mouth: 'open', blush: true, R: [-0.35, -0.3, 0.88], tilt: [-0.12, 0] },
  ok:     { eyes: 'wink', mouth: 'open', blush: true, R: [0.5, 0.85, 0.2], L: [0.55, -0.8, 0.25], tilt: [0, -0.07] },
  cheer:  { eyes: 'happy', mouth: 'open', blush: true, R: [0.45, 0.85, 0.25] },
  moved:  { eyes: 'teary', mouth: 'wobble', blush: true, R: [-0.65, 0.2, 0.73], tilt: [0.04, 0], reach: 0.8 },
};
const dirOf = ([x, y, z], s) => v3(x * s, y, z).normalize();
function aimArm(piv, dir) { piv.quaternion.setFromUnitVectors(DOWN, dir); }

export function createMascot() {
  if (!PROTO) PROTO = buildProto();
  const g = PROTO.clone();
  setMascotPose(g, 'idle');
  return g;
}

export function setMascotPose(group, name) {
  const P = POSE[name] || POSE.idle;
  if (!POSE[name]) name = 'idle';
  const o = n => group.getObjectByName(n);
  const face = o('face');
  for (const c of face.children) {
    if (c.name.startsWith('eyes:')) c.visible = c.name === 'eyes:' + P.eyes;
    if (c.name.startsWith('mouth:')) c.visible = c.name === 'mouth:' + P.mouth;
  }
  o('blush').visible = !!P.blush;
  const tilt = o('tilt');
  tilt.rotation.set(P.tilt?.[0] || 0, 0, P.tilt?.[1] || 0);
  const armR = o('armR'), armL = o('armL'), handR = o('handR'), handL = o('handL');
  const dR = dirOf(P.R, 1), dL = P.L ? dirOf(P.L, -1) : dirOf(P.R, -1);
  aimArm(armR, dR); aimArm(armL, dL);
  const reach = P.reach || ARM;
  for (const k of ['R', 'L']) { o('armMesh' + k).scale.y = reach / ARM; o('hand' + k).position.y = -reach; }
  // clear old props
  const fx = o('fx'), fl = o('float');
  for (const h of [handR, handL]) for (const c of [...h.children]) if (c.name.startsWith('prop:')) h.remove(c);
  fx.clear(); fl.clear();
  fx.position.set(0, 0, 0); fx.rotation.set(0, 0, 0); fx.scale.set(1, 1, 1);
  const ticks = [];
  const emo = (parent, id, x, y, z, s) => { const e = add(parent, makeEmoji(id), x, y, z); e.scale.setScalar(s); if (e.userData.tick) ticks.push(e.userData.tick); return e; };
  if (name === 'cheer') { handR.add(prop('pompomY', PROP_BUILD.pompomY)); handL.add(prop('pompomB', PROP_BUILD.pompomB)); }
  if (name === 'thumb') {
    // a big foam 👍 held up beside the face
    const th = emo(fx, 'thumb', 1.12, 1.55, 0.72, 1.25); th.rotation.set(0.5, -0.25, 0.15);
    emo(fl, 'sparkle', -1.35, 1.85, 0.1, 0.8);
  }
  if (name === 'ok') {
    // the 「⭕」 mark: a big red ring beside the raised hand
    const r = add(fl, prop('maru', PROP_BUILD.maru), 1.45, 1.75, 0.2); r.rotation.x = -0.35;
  }
  if (name === 'love') { emo(fl, 'heart', -1.25, 1.75, 0.2, 0.75); emo(fl, 'heart', 1.2, 2.0, -0.1, 0.6); emo(fl, 'heart', -0.55, 2.45, -0.45, 0.5); }
  if (name === 'wow') { emo(fl, 'sparkle', -1.4, 1.8, 0.1, 0.85); emo(fl, 'sparkle', 1.4, 2.0, -0.1, 0.7); }
  if (name === 'tea') { const c = add(fx, prop('cup', PROP_BUILD.cup), 0, 0.6, 1.36); ticks.push(t => { c.getObjectByName('steam').rotation.y = 0.3 * Math.sin(t * 0.9); }); }
  if (name === 'flower') { const b = add(fx, prop('bouquet', PROP_BUILD.bouquet), 0.62, 1.12, 1.18); b.rotation.set(0.45, 0, -0.35); }
  if (name === 'clap') {
    const pg = new THREE.CapsuleGeometry(0.045, 0.16, 3, 8);
    for (const sx of [-1, 1]) for (const [x, y, a] of [[1.32, 1.5, 0.5], [1.42, 1.25, 1.2], [1.38, 1.0, 1.9]]) {
      const m = add(fx, mesh(pg, 'yellow'), sx * x, y, 0.65); m.rotation.z = -sx * a;
    }
  }
  group.userData.pose = name;
  group.userData.tick = makeTick(group, name, dR, dL, ticks);
  return group;
}

function makeTick(group, name, dR, dL, ticks) {
  const o = n => group.getObjectByName(n);
  const sq = o('squash'), tilt = o('tilt'), armR = o('armR'), armL = o('armL'), fl = o('float'), fx = o('fx');
  const t0 = tilt.rotation.clone();
  const fl0 = fl.children.map(c => c.position.clone());
  const tmp = new THREE.Vector3();
  const swing = (piv, d, dx, dy, dz) => { tmp.set(d.x + dx, d.y + dy, d.z + dz).normalize(); aimArm(piv, tmp); };
  return (t, dt) => {
    const br = Math.sin(t * TAU / 1.8);
    let sy = 1 + 0.025 * br, sxz = 1 - 0.012 * br;
    tilt.rotation.copy(t0);
    switch (name) {
      case 'wow': { const k = Math.sin(t * 7) * 0.12; swing(armR, dR, 0, k, 0); swing(armL, dL, 0, -k, 0); break; }
      case 'love': tilt.rotation.z = t0.z + 0.07 * Math.sin(t * 2.2); break;
      case 'clap': {
        const k = Math.max(0, Math.sin(t * 9));
        swing(armR, dR, -0.3 * k, 0, 0.1 * k); swing(armL, dL, 0.3 * k, 0, 0.1 * k);
        fx.scale.setScalar(0.6 + 0.4 * k);
        break;
      }
      case 'thumb': { const k = Math.max(0, Math.sin(t * 3)) ** 2; swing(armR, dR, 0, 0.08 * k, 0); fx.position.y = 0.07 * k; break; }
      case 'tea': tilt.rotation.z = 0.03 * Math.sin(t * 1.3); break;
      case 'flower': tilt.rotation.z = t0.z + 0.05 * Math.sin(t * 1.6); fx.rotation.z = 0.04 * Math.sin(t * 1.6 + 0.5); break;
      case 'laugh': {
        const burst = Math.max(0, Math.sin(t * 1.9));
        tilt.rotation.z = 0.05 * Math.sin(t * 18) * burst;
        sy += 0.03 * Math.abs(Math.sin(t * 9)) * burst;
        break;
      }
      case 'ok': { const k = Math.sin(t * 2.6); swing(armR, dR, 0, 0, 0.12 * k); tilt.rotation.z = t0.z + 0.03 * k; break; }
      case 'cheer': {
        const k = Math.sin(t * 6);
        swing(armR, dR, 0.25 * k, 0.15 * k, 0); swing(armL, dL, 0.25 * k, -0.15 * k, 0);
        sy += 0.03 * Math.abs(k); break;
      }
      case 'moved': {
        // a slow, wobbly sniffle: sway and little hiccups
        tilt.rotation.z = 0.04 * Math.sin(t * 1.2);
        sy += 0.025 * Math.max(0, Math.sin(t * 4.5)) ** 8;
        break;
      }
      default: break;
    }
    sq.scale.set(sxz, sy, sxz);
    fl.children.forEach((c, i) => { const p0 = fl0[i]; if (p0) c.position.set(p0.x, p0.y + 0.12 * Math.sin(t * 2 + i * 2.1), p0.z); });
    for (const f of ticks) f(t, dt);
  };
}
