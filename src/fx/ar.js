// AR: put a 3D thing from the chat (a sticker, the badge, one of 川哥's mini builds, or 川哥 himself) on a real
// table through the phone's camera.
//  - iPhone / iPad (Safari): AR Quick Look. The model is turned into a USDZ file right here in the page and opened
//    through an <a rel="ar"> link, so nothing is uploaded anywhere.
//  - Android (Chrome with Google Play Services for AR): a WebXR session in this page. Find the floor or a table,
//    tap to put the model down; 川哥 keeps moving there.
// The toon look relies on our own shaders and the ink post pass, which AR viewers can't run, so the model is
// handed over in plain coloured materials (the palette's colours) lit by the room.
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mixHex } from '../engine/toon.js';

export const support = { quickLook: false, webxr: false, line: false };

// what this phone and browser can do (called once at start; WebXR answers asynchronously)
export async function detectAR() {
  try { support.quickLook = !!document.createElement('a').relList?.supports?.('ar'); } catch (e) { support.quickLook = false; }
  support.line = /\bLine\//i.test(navigator.userAgent);
  try { support.webxr = !support.quickLook && !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { support.webxr = false; }
  return support;
}
export const canAR = () => support.quickLook || support.webxr;

// --- materials: the palette colours in a material every AR viewer understands ---------------------------
const standard = new Map();
function standardOf(m) {
  if (!m) return null;
  if (m.isMeshStandardMaterial) return m;                 // the badge's shiny metal goes as it is
  if (standard.has(m)) return standard.get(m);
  const u = m.uniforms || {}, pal = m.userData?.pal;
  let color = pal ? mixHex(pal.l, pal.m, 0.4) : m.color ? '#' + m.color.getHexString() : '#cfd6e2';
  if (u.uTopOnly?.value) color = '#' + u.uTop.value.getHexString();   // 3D letters: their face colour
  const opacity = u.opacity?.value ?? m.opacity ?? 1;
  const s = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, transparent: opacity < 1, opacity, map: m.map || null });
  standard.set(m, s);
  return s;
}

// --- a flat copy for USDZ: every mesh baked into world space (USDZ can't mirror), one material per mesh -----
function flipWinding(g) {
  const idx = g.index;
  if (idx) { const a = idx.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } idx.needsUpdate = true; return; }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name], n = at.itemSize, arr = at.array;
    for (let v = 0; v < at.count; v += 3) for (let k = 0; k < n; k++) { const t = arr[(v + 1) * n + k]; arr[(v + 1) * n + k] = arr[(v + 2) * n + k]; arr[(v + 2) * n + k] = t; }
    at.needsUpdate = true;
  }
}
function cleanGeometry(src, matrix) {
  let g = src.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  g.morphAttributes = {};
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) flipWinding(g);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// one geometry per material group (USDZ takes a single material per mesh)
function split(g, mats) {
  if (!Array.isArray(mats)) return [[g, mats]];
  const flat = g.index ? g.toNonIndexed() : g;
  const groups = flat.groups.length ? flat.groups : [{ start: 0, count: flat.attributes.position.count, materialIndex: 0 }];
  return groups.map(gr => {
    const part = new THREE.BufferGeometry();
    for (const [name, at] of Object.entries(flat.attributes)) {
      const n = at.itemSize;
      part.setAttribute(name, new THREE.BufferAttribute(at.array.slice(gr.start * n, (gr.start + gr.count) * n), n));
    }
    return [part, mats[gr.materialIndex]];
  });
}
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

// A world-space copy of `root` for AR: plain materials, standing on y = 0, centred, its largest side `size` metres.
export function bakeForAR(root, size) {
  root.updateMatrixWorld(true);
  const parts = [];
  const m4 = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || !shown(o) || o.material?.userData?.floor) return;
    const each = o.isInstancedMesh ? o.count : 1;
    for (let i = 0; i < each; i++) {
      if (o.isInstancedMesh) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); } else m4.copy(o.matrixWorld);
      for (const [g, mat] of split(cleanGeometry(o.geometry, m4), o.material)) {
        const s = standardOf(mat);
        if (s && (s.opacity ?? 1) > 0.02) parts.push(new THREE.Mesh(g, s));
      }
    }
  });
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
  const dim = box.getSize(new THREE.Vector3()), k = size / Math.max(dim.x, dim.y, dim.z, 1e-6);
  const fit = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const out = new THREE.Group();
  for (const p of parts) { p.geometry.applyMatrix4(fit); out.add(p); }
  return out;
}

// --- iPhone: a USDZ file for AR Quick Look ------------------------------------------------------------------
export async function usdzURL(root, size) {
  const scene = new THREE.Scene();
  scene.add(bakeForAR(root, size));
  const data = await new USDZExporter().parseAsync(scene, { quickLookCompatible: true, ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } } });
  return URL.createObjectURL(new Blob([data], { type: 'model/vnd.usdz+zip' }));
}

// An <a rel="ar"> styled as one of our buttons. Quick Look wants an <img> as the link's first child.
export function quickLookLink(text, cls = '') {
  const a = document.createElement('a');
  a.rel = 'ar';
  a.className = 'btn ' + cls;
  const img = document.createElement('img');
  img.alt = ''; img.width = 1; img.height = 1;
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  a.append(img, document.createTextNode(text));
  return a;
}

// --- Android: a WebXR session in the page ------------------------------------------------------------------
// make() returns { group, update?(dt) }; the group is shown live (川哥 keeps moving) with plain materials.
export async function startWebXR(make, size, { onEnd } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'ar-overlay';
  overlay.innerHTML = '<p class="ar-hint">慢慢移動手機，對著地面或桌面。<br>看到圓圈以後，點一下就放上去。</p>';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'ar-close'; close.textContent = '結束 AR';
  overlay.append(close);
  overlay.addEventListener('beforexrselect', e => { if (e.target === close) e.preventDefault(); });
  document.body.append(overlay);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96aa, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(0.4, 1, 0.6); scene.add(sun);
  const camera = new THREE.PerspectiveCamera();

  // the model, in plain materials, standing on its base and `size` metres across
  const thing = make();
  thing.group.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(standardOf) : standardOf(o.material); });
  thing.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(thing.group), dim = box.getSize(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y, dim.z, 1e-6);
  const holder = new THREE.Group(), inner = new THREE.Group();
  inner.add(thing.group);
  thing.group.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  inner.scale.setScalar(k);
  holder.add(inner);
  // a soft shadow under it so it sits on the table
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.1, size * 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  holder.add(shadow);
  holder.visible = false;
  scene.add(holder);
  // the ring that shows where it will go
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc105 }));
  reticle.matrixAutoUpdate = false; reticle.visible = false;
  scene.add(reticle);

  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: overlay } });
  } catch (e) {
    overlay.remove(); renderer.dispose();
    throw e;
  }
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewer });
  const face = new THREE.Vector3();
  session.addEventListener('select', () => {
    if (!reticle.visible) return;
    holder.position.setFromMatrixPosition(reticle.matrix);
    // turn it to face the phone
    face.setFromMatrixPosition(camera.matrixWorld);
    holder.rotation.set(0, Math.atan2(face.x - holder.position.x, face.z - holder.position.z), 0);
    holder.visible = true;
    overlay.querySelector('.ar-hint').textContent = '想換地方，再點一下別的位置。';
  });
  close.addEventListener('click', () => session.end());
  let last = performance.now();
  renderer.setAnimationLoop((t, frame) => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (frame) {
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits.length ? hits[0].getPose(renderer.xr.getReferenceSpace()) : null;
      reticle.visible = !!pose;
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
    thing.update?.(dt);
    renderer.render(scene, camera);
  });
  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    hitSource.cancel?.();
    overlay.remove();
    pm.dispose(); shadowTex.dispose(); renderer.dispose();
    onEnd?.();
  });
}

export const AR_CSS = `
.sheet a.btn.ar, .sheet button.ar { background: #7fe0de; }
.sheet a.btn.ar.busy { opacity: .55; }
.sheet a.btn.ar img { position: absolute; width: 1px; height: 1px; opacity: 0; }
.sheet a.btn.ar { position: relative; }
.ar-overlay { position: fixed; inset: 0; z-index: 60; pointer-events: none; font-family: var(--ui-font); }
.ar-hint { position: absolute; left: 50%; top: calc(18px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); width: max-content; max-width: calc(100vw - 32px);
  margin: 0; padding: 12px 18px; border-radius: 18px; background: rgba(35,30,22,.78); color: #fff; font-size: 19px; line-height: 1.5; text-align: center; }
.ar-close { pointer-events: auto; position: absolute; left: 50%; bottom: calc(26px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
  min-height: 60px; padding: 10px 30px; font: 600 22px/1.2 var(--ui-font); color: #231e16; background: #ffc105; border: 3px solid #231e16; border-radius: 18px; box-shadow: 4px 4px 0 #231e16; }
`;
