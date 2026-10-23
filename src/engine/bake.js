// Merge the meshes of a static model into one mesh per material, so a detailed figure costs a handful of draw
// calls instead of dozens. Only for parts that never move relative to each other (avatars, the chrome).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const inv = new THREE.Matrix4(), m = new THREE.Matrix4();

export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  inv.copy(root.matrixWorld).invert();
  const byMat = new Map();
  const keep = [];
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    if (o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.noBake) { keep.push(o); return; }
    m.multiplyMatrices(inv, o.matrixWorld);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    const list = byMat.get(o.material) || [];
    list.push({ g, cast: o.castShadow, receive: o.receiveShadow });
    byMat.set(o.material, list);
  });
  const out = new THREE.Group();
  out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list.map(x => x.g), false);
    for (const x of list) x.g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list.some(x => x.cast);
    mesh.receiveShadow = list.some(x => x.receive);
    out.add(mesh);   // shared by every clone: never disposed by a caller
  }
  for (const o of keep) { const c = o.clone(); m.multiplyMatrices(inv, o.matrixWorld); c.matrix.copy(m); c.matrix.decompose(c.position, c.quaternion, c.scale); out.add(c); }
  return out;
}

// A baked prototype per key, handed out as cheap clones that share geometry.
const protos = new Map();
export function bakedClone(key, make) {
  if (!protos.has(key)) protos.set(key, bakeStatic(make()));
  return protos.get(key).clone();
}
