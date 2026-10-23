// 川伯's LINE profile picture as a 3D object: a round coin (white rim, sky-blue face) with a head-and-shoulders
// bust of him popping out of it — no hat, crew cut, glasses, big smile — tilted back so the face reads from
// above at chat size (~50 px). Footprint ≈ 2.3 em across, height ≤ 1.6 em, centred on the origin.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { createHead, DIM } from './chuan.js';

const DEG = Math.PI / 180;
const geos = {};
const once = (k, f) => (geos[k] ||= f());

function mesh(geo, mat, parent, p, r) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  if (p) o.position.set(...p);
  if (r) o.rotation.set(...r);
  parent.add(o);
  return o;
}

// shoulders in his light-blue shirt with a white collar, sized for the coin
function bust(parent) {
  const shirt = toon('shirt'), white = toon('white'), skin = toon('skin');
  const b = new THREE.Group();
  parent.add(b);
  mesh(once('shoulders', () => new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.82, 0.42, 0.55)), shirt, b);
  mesh(once('neck', () => new THREE.CylinderGeometry(0.15, 0.17, 0.2, 14)), skin, b, [0, 0.38, 0.04]);
  const flap = once('flap', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.3, 0.03); s.lineTo(0.09, -0.24); s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 1 });
  });
  for (const sd of [1, -1]) {
    const f = mesh(flap, white, b, [sd * 0.03, 0.36, 0.22], [-0.85, 0, 0]);
    if (sd < 0) f.scale.x = -1;
    f.rotateZ(-sd * 0.25);
  }
  mesh(once('btn', () => new THREE.SphereGeometry(0.035, 8, 6)), white, b, [0, 0.22, 0.44]);
  return b;
}

export function createChuanAvatar() {
  const g = new THREE.Group();
  g.name = 'chuanAvatar';
  const rim = mesh(once('rim', () => new THREE.CylinderGeometry(1.15, 1.15, 0.22, 48)), toon('white', { receive: 0.45 }), g, [0, 0.11, 0]);
  rim.receiveShadow = true;
  const face = mesh(once('disc', () => new THREE.CylinderGeometry(0.97, 0.97, 0.05, 48)), toon('sky', { receive: 0.55 }), g, [0, 0.245, 0]);
  face.receiveShadow = true;

  const fig = new THREE.Group();
  fig.position.set(0.06, 0.25, 0.26);
  g.add(fig);
  bust(fig);
  const head = createHead();
  head.setFace('grin');
  const hs = 0.86;
  head.group.scale.setScalar(hs);
  head.group.position.set(0, 0.79, -0.02);
  head.group.rotation.x = -24 * DEG;
  fig.add(head.group);

  g.userData.head = head;
  g.userData.tick = (t) => {
    head.group.rotation.z = 0.06 * Math.sin(t * 1.3);
    head.group.rotation.x = -24 * DEG + 0.03 * Math.sin(t * 0.9);
  };
  return g;
}

// Just his head (no hat), sitting on the floor and tilted back so the face shows from above. ~1.25 em wide.
export function createChuanHead() {
  const g = new THREE.Group();
  g.name = 'chuanHeadOnly';
  const head = createHead();
  head.setFace('grin');
  head.group.position.y = DIM.headR * 0.96;
  head.group.rotation.x = -22 * DEG;
  g.add(head.group);
  g.userData.head = head;
  return g;
}
