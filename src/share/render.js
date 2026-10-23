// Offscreen renders of single 3D things (a sticker, the badge, a stretch of the chat) into canvases, in the
// same look as the page: its own little floor, sun and ink. Used for downloads, the share card and the long
// picture of the whole conversation.
import * as THREE from 'three';
import { ObliqueCamera } from '../engine/stage.js';
import { floorMaterial } from '../engine/toon.js';

const corners = b => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

// view: 'read' (the page's camera) or 'iso' (a 3/4 view that shows off the 3D)
export function makeCamera(view = 'read', shear = { x: -0.22, y: 0.72 }) {
  const cam = new ObliqueCamera();
  cam.userData.view = view;
  cam.userData.shearRead = shear;
  return cam;
}

function aim(cam, center, dist = 80) {
  const view = cam.userData.view;
  // read = the page's own camera; iso = a 3/4 show-off view; card = steep enough that flat words stay readable
  const pitch = view === 'iso' ? 36 : view === 'card' ? 58 : 90, yaw = view === 'iso' ? 30 : view === 'card' ? 16 : 0;
  const p = THREE.MathUtils.degToRad(pitch), y = THREE.MathUtils.degToRad(yaw);
  cam.position.set(center.x + Math.sin(y) * Math.cos(p) * dist, center.y + Math.sin(p) * dist, center.z + Math.cos(y) * Math.cos(p) * dist);
  cam.up.set(-Math.sin(y), 0, -Math.cos(y));
  cam.lookAt(center);
  cam.focusDist = dist;
  if (view !== 'read') cam.shear.set(0, 0); else cam.shear.set(cam.userData.shearRead.x, cam.userData.shearRead.y);
  cam.near = 0.1; cam.far = dist * 2 + 50;
  cam.updateMatrixWorld();
}

// Fit an orthographic camera around a box for an output of aspect w/h, with a margin (fraction).
export function frameBox(cam, box, aspect, margin = 0.08) {
  const c = box.getCenter(new THREE.Vector3()); c.y = 0;
  aim(cam, c);
  cam.left = -50; cam.right = 50; cam.top = 50; cam.bottom = -50;
  cam.updateProjectionMatrix();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of corners(box)) { const q = p.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  // NDC -> view units (the frustum is 100 wide/tall)
  const cx = (x0 + x1) / 2 * 50, cy = (y0 + y1) / 2 * 50;
  let w = (x1 - x0) * 50, h = (y1 - y0) * 50;
  w *= 1 + margin * 2; h *= 1 + margin * 2;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  cam.left = cx - w / 2; cam.right = cx + w / 2; cam.top = cy + h / 2; cam.bottom = cy - h / 2;
  cam.updateProjectionMatrix();
  return { w, h };
}

// A throwaway scene with floor, sun and (optionally) the reflection environment.
export function isolatedScene(stage, { floor = ['#a9c6ea', '#9fbfe6'], env = true } = {}) {
  const scene = new THREE.Scene();
  const f = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), floorMaterial(floor[0], floor[1]));
  f.receiveShadow = true;
  scene.add(f);
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 1.5;
  scene.add(sun, sun.target);
  if (env && stage.scene.environment) { scene.environment = stage.scene.environment; scene.environmentIntensity = stage.scene.environmentIntensity; }
  return {
    scene,
    place(box) {
      const c = box.getCenter(new THREE.Vector3());
      const half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.75 + 8;
      sun.target.position.set(c.x, 0, c.z);
      sun.position.copy(sun.target.position).addScaledVector(stage.shadowDir, 60);
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 160 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.target.updateMatrixWorld();
      f.position.set(c.x, 0, c.z);
    },
    dispose() { f.geometry.dispose(); sun.dispose?.(); },
  };
}

// Render one object (already built) to a canvas of w x h px.
export function renderObject(stage, obj, { w = 900, h = 900, view = 'read', margin = 0.1, floor, t = 0 } = {}) {
  const iso = isolatedScene(stage, { floor });
  iso.scene.add(obj);
  obj.updateMatrixWorld(true);
  obj.userData.tick?.(t, 0);
  obj.userData.pop?.(1);
  const box = new THREE.Box3().setFromObject(obj);
  box.min.y = Math.min(0, box.min.y);
  iso.place(box);
  const cam = makeCamera(view);
  frameBox(cam, box, w / h, margin);
  const canvas = stage.snapshot(w, h, { camera: cam, scene: iso.scene, ink: true });
  iso.scene.remove(obj);
  iso.dispose();
  return canvas;
}
