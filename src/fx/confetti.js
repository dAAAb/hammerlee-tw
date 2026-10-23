// Paper confetti in the brand colours: bursts up around a point, tumbles down and stays on the floor.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';

const COLS = ['yellow', 'teal', 'blue', 'navy', 'pink', 'white', 'orange'];
const shapes = [new THREE.BoxGeometry(0.42, 0.04, 0.24), new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), new THREE.BoxGeometry(0.12, 0.04, 0.5)];

export function burst(scene, at, n = 90) {
  const group = new THREE.Group();
  scene.add(group);
  const bits = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shapes[i % shapes.length], toon(COLS[i % COLS.length], { side: 2 }));
    m.castShadow = true;
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
    m.position.set(at.x + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, at.z + (Math.random() - 0.5) * 2);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    bits.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 9 + Math.random() * 8, Math.sin(a) * sp * 0.8), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), rest: false });
    group.add(m);
  }
  let t = 0;
  return {
    group,
    // returns false once everything has landed
    update(dt) {
      t += dt;
      let moving = false;
      for (const b of bits) {
        if (b.rest) continue;
        moving = true;
        b.v.y -= 18 * dt;
        b.v.multiplyScalar(1 - Math.min(0.9, dt * 1.6));           // paper drag
        if (b.v.y < -3.2) b.v.y = -3.2;                             // flutter instead of fall
        b.m.position.addScaledVector(b.v, dt);
        b.m.position.x += Math.sin(t * 5 + b.w.x) * dt * 1.4;
        b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
        if (b.m.position.y <= 0.62 && b.v.y < 0) {
          b.m.position.y = 0.6 + Math.random() * 0.05;
          b.m.rotation.set(0, Math.random() * 6, 0);
          b.rest = true;
        }
      }
      return moving;
    },
  };
}
