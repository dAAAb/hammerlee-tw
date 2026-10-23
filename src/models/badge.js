// 新北事民徽章: a shiny medal generated from the conversation id. The id is hashed, and the hash picks the
// outline (scalloped, star, gear, shield, polygon, flower), the metal, the enamel colours, the relief pattern,
// the centre emblem, gems and the ribbon — so every conversation gets its own medal. It is the one object
// drawn with physical materials, so it catches real reflections from the environment map.
import * as THREE from 'three';
import { mulberry32, hashString } from '../chat/dsl.js';

const METALS = [
  { name: '金', color: '#f7c948', rough: 0.2 },
  { name: '銀', color: '#e8eef4', rough: 0.16 },
  { name: '玫瑰金', color: '#f2a58e', rough: 0.22 },
  { name: '青銅', color: '#d39a5c', rough: 0.3 },
  { name: '白金', color: '#dfe7ff', rough: 0.12 },
];
const ENAMELS = [
  ['#00449a', '#0096e8'], ['#2ac9c9', '#00449a'], ['#ffc105', '#e8473a'], ['#0096e8', '#2ac9c9'],
  ['#e8657e', '#ffc105'], ['#7f8bec', '#2ac9c9'], ['#16a36b', '#ffc105'], ['#00449a', '#ffc105'],
  ['#ef8f24', '#00449a'], ['#d9473a', '#0096e8'],
];
const EMBLEMS = ['arch', 'heart', 'bridge', 'train', 'hammer', 'star', 'house', 'sun', 'chip', 'dome'];
const SHAPES = ['scallop', 'star', 'gear', 'shield', 'polygon', 'flower'];

export function badgeSpec(id) {
  const [h1, h2] = hashString('badge:' + id);
  const r = mulberry32(h1 ^ (h2 << 1));
  const pick = a => a[Math.floor(r() * a.length)];
  const shape = pick(SHAPES);
  return {
    shape,
    n: shape === 'star' ? 5 + Math.floor(r() * 5) : shape === 'gear' ? 12 + Math.floor(r() * 10) : shape === 'polygon' ? 6 + Math.floor(r() * 5)
      : shape === 'flower' ? 6 + Math.floor(r() * 7) : 14 + Math.floor(r() * 12),
    depth: 0.3 + r() * 0.35,
    metal: pick(METALS),
    enamel: pick(ENAMELS),
    rings: 1 + Math.floor(r() * 3),
    rays: r() < 0.5 ? 0 : 12 + Math.floor(r() * 3) * 6,
    emblem: pick(EMBLEMS),
    gems: r() < 0.6 ? 4 + Math.floor(r() * 3) * 2 : 0,
    gem: pick(['#e8473a', '#2ac9c9', '#7f8bec', '#16a36b', '#ffc105', '#ffffff']),
    ribbon: r() < 0.85,
    stripes: 1 + Math.floor(r() * 3),
    tilt: (r() - 0.5) * 0.3,
    serial: shortId(id),
  };
}

// 16 hex digits from the id, grouped for reading aloud: 7F3A-91C2-77D0-1E4B
export function shortId(id) {
  const [a, b] = hashString('serial:' + id);
  const hex = (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}

function outline(spec, R) {
  const s = new THREE.Shape();
  const n = spec.n;
  const pts = [];
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const a = i / steps * Math.PI * 2 + Math.PI / 2;
    let r = R;
    const u = (i / steps) * n % 1;
    switch (spec.shape) {
      case 'scallop': r = R * (0.93 + 0.07 * Math.sqrt(Math.max(0, Math.sin(u * Math.PI)))); break;
      case 'star': { const t = Math.abs(u - 0.5) * 2; r = R * (0.62 + 0.38 * Math.pow(t, 1.6)); break; }
      case 'gear': r = R * (u < 0.5 ? 1 : 0.88); break;
      case 'flower': r = R * (0.8 + 0.2 * Math.sin(u * Math.PI)); break;
      case 'polygon': { const seg = Math.PI * 2 / n, aa = ((a - Math.PI / 2) % seg + seg) % seg - seg / 2; r = R * Math.cos(Math.PI / n) / Math.cos(aa); break; }
      case 'shield': {
        const x = Math.cos(a), y = Math.sin(a);
        r = R * (y > 0 ? 0.95 : 0.95 + 0.35 * Math.pow(-y, 3) * (1 - Math.abs(x)));
        break;
      }
    }
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  s.setFromPoints(pts);
  return s;
}

function extrudeUp(shape, depth, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

function emblemShape(kind) {
  const s = new THREE.Shape();
  switch (kind) {
    case 'heart':
      s.moveTo(0, -0.9); s.bezierCurveTo(-1.6, 0.1, -0.8, 1.1, 0, 0.45); s.bezierCurveTo(0.8, 1.1, 1.6, 0.1, 0, -0.9); return [s];
    case 'star': {
      const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1.1; p.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
      s.setFromPoints(p); return [s];
    }
    case 'house':
      s.moveTo(0, 1.05); s.lineTo(1.05, 0.15); s.lineTo(0.75, 0.15); s.lineTo(0.75, -0.9); s.lineTo(-0.75, -0.9); s.lineTo(-0.75, 0.15); s.lineTo(-1.05, 0.15); s.closePath(); return [s];
    case 'sun': {
      const out = [new THREE.Shape().absarc(0, 0, 0.55, 0, Math.PI * 2)];
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = new THREE.Shape(); r.moveTo(Math.cos(a - 0.15) * 0.72, Math.sin(a - 0.15) * 0.72); r.lineTo(Math.cos(a) * 1.15, Math.sin(a) * 1.15); r.lineTo(Math.cos(a + 0.15) * 0.72, Math.sin(a + 0.15) * 0.72); r.closePath(); out.push(r); }
      return out;
    }
    case 'hammer': {
      const head = new THREE.Shape(); head.moveTo(-0.95, 0.45); head.lineTo(0.95, 0.45); head.lineTo(0.95, 0.95); head.lineTo(-0.95, 0.95); head.closePath();
      const handle = new THREE.Shape(); handle.moveTo(-0.17, 0.48); handle.lineTo(0.17, 0.48); handle.lineTo(0.17, -1.05); handle.lineTo(-0.17, -1.05); handle.closePath();
      return [head, handle];
    }
    case 'train': {
      const b = new THREE.Shape(); b.moveTo(-0.8, -0.7); b.lineTo(0.8, -0.7); b.lineTo(0.8, 0.6); b.quadraticCurveTo(0.8, 1.0, 0.4, 1.0); b.lineTo(-0.4, 1.0); b.quadraticCurveTo(-0.8, 1.0, -0.8, 0.6); b.closePath();
      const w = new THREE.Path(); w.moveTo(-0.55, 0.15); w.lineTo(0.55, 0.15); w.lineTo(0.55, 0.65); w.lineTo(-0.55, 0.65); w.closePath(); b.holes.push(w);
      return [b];
    }
    case 'bridge': {
      const b = new THREE.Shape(); b.moveTo(-1.15, -0.6); b.lineTo(1.15, -0.6); b.lineTo(1.15, -0.3); b.quadraticCurveTo(0, 1.3, -1.15, -0.3); b.closePath();
      const h = new THREE.Path(); h.moveTo(-0.85, -0.45); h.quadraticCurveTo(0, 0.9, 0.85, -0.45); h.closePath(); b.holes.push(h);
      return [b];
    }
    case 'chip': {
      const b = new THREE.Shape(); b.moveTo(-0.7, -0.7); b.lineTo(0.7, -0.7); b.lineTo(0.7, 0.7); b.lineTo(-0.7, 0.7); b.closePath();
      const out = [b];
      for (let i = -1; i <= 1; i++) for (const [dx, dy, w, h] of [[i * 0.4, 0.95, 0.12, 0.3], [i * 0.4, -0.95, 0.12, 0.3], [0.95, i * 0.4, 0.3, 0.12], [-0.95, i * 0.4, 0.3, 0.12]]) {
        const p = new THREE.Shape(); p.moveTo(dx - w / 2, dy - h / 2); p.lineTo(dx + w / 2, dy - h / 2); p.lineTo(dx + w / 2, dy + h / 2); p.lineTo(dx - w / 2, dy + h / 2); p.closePath(); out.push(p);
      }
      return out;
    }
    case 'dome': {
      const b = new THREE.Shape(); b.moveTo(-1.1, -0.55); b.lineTo(1.1, -0.55); b.quadraticCurveTo(1.0, 1.0, 0, 1.0); b.quadraticCurveTo(-1.0, 1.0, -1.1, -0.55); return [b];
    }
    default: { // 'arch': the logo's bars standing on an arch, three tall ones in the middle = 川
      const out = [];
      for (let i = -4; i <= 4; i++) {
        const a = Math.abs(i) / 4, x = i * 0.25, base = -0.75 + 0.3 * a * a, top = base + 0.35 + 1.25 * (1 - Math.pow(a, 1.3));
        const b = new THREE.Shape(); b.moveTo(x - 0.085, base); b.lineTo(x + 0.085, base); b.lineTo(x + 0.085, top); b.lineTo(x - 0.085, top); b.closePath(); out.push(b);
      }
      return out;
    }
  }
}

export function makeBadge(id, font) {
  const spec = badgeSpec(id);
  const R = 3.4;
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: spec.metal.color, metalness: 1, roughness: spec.metal.rough, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const enamelA = new THREE.MeshPhysicalMaterial({ color: spec.enamel[0], metalness: 0.05, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 });
  const enamelB = new THREE.MeshPhysicalMaterial({ color: spec.enamel[1], metalness: 0.05, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#fdfcf7', metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });

  const medal = new THREE.Group();
  g.add(medal);
  // ribbon tails behind the medal
  if (spec.ribbon) {
    for (const side of [-1, 1]) {
      const rs = new THREE.Shape();
      rs.moveTo(0, 0); rs.lineTo(1.3, 0); rs.lineTo(1.3, -3.4); rs.lineTo(0.65, -2.8); rs.lineTo(0, -3.4); rs.closePath();
      const tail = new THREE.Mesh(extrudeUp(rs, 0.06, 0.02), enamelB);
      tail.position.set(side < 0 ? -1.9 : 0.6, 0, R * 0.55);
      tail.rotation.y = side * 0.32;
      medal.add(tail);
      for (let k = 0; k < spec.stripes; k++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 2.6), white);
        st.position.set((side < 0 ? -1.9 : 0.6) + 0.3 + k * 0.32, 0.1, R * 0.55 + 1.3);
        st.rotation.y = side * 0.32;
        medal.add(st);
      }
    }
  }
  // body, enamel field, relief
  const body = new THREE.Mesh(extrudeUp(outline(spec, R), spec.depth, 0.12), metal);
  medal.add(body);
  const top = spec.depth + 0.24;
  const field = new THREE.Mesh(extrudeUp(outline({ ...spec, shape: spec.shape === 'shield' ? 'shield' : 'polygon', n: 48 }, R * 0.74), 0.05, 0.03), enamelA);
  field.position.y = top - 0.02;
  medal.add(field);
  for (let k = 0; k < spec.rings; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * (0.78 + k * 0.05), 0.05, 8, 72), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = top + 0.05;
    medal.add(ring);
  }
  if (spec.rays) {
    for (let k = 0; k < spec.rays; k++) {
      const a = k / spec.rays * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, R * 0.28), enamelB);
      ray.position.set(Math.cos(a) * R * 0.55, top + 0.06, Math.sin(a) * R * 0.55);
      ray.rotation.y = -a + Math.PI / 2;
      medal.add(ray);
    }
  }
  // emblem
  const emb = new THREE.Mesh(new THREE.ExtrudeGeometry(emblemShape(spec.emblem), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 }), metal);
  if (spec.emblem === 'hammer') emb.geometry.rotateZ(-Math.PI / 4);   // a hammer reads as a hammer when it leans
  emb.geometry.rotateX(-Math.PI / 2);
  emb.scale.setScalar(1.05);
  emb.position.set(0, top + 0.05, -0.55);
  medal.add(emb);
  // gems
  for (let k = 0; k < spec.gems; k++) {
    const a = k / spec.gems * Math.PI * 2 + Math.PI / spec.gems;
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshPhysicalMaterial({ color: spec.gem, metalness: 0.1, roughness: 0.05, clearcoat: 1, transmission: 0, ior: 2 }));
    gem.position.set(Math.cos(a) * R * 0.88, top - 0.05, Math.sin(a) * R * 0.88);
    medal.add(gem);
  }
  // text plate: 新北事民 + serial
  if (font) {
    const plate = new THREE.Mesh(extrudeUp(roundedRect(4.6, 1.45, 0.4), 0.08, 0.04), white);
    plate.position.set(-2.3, top - 0.02, 0.45 + 1.45);
    medal.add(plate);
    const letters = new THREE.MeshPhysicalMaterial({ color: '#163c84', metalness: 0.2, roughness: 0.3, clearcoat: 1 });
    letters.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 0.5;'); };
    const t1 = '新北事民', s1 = 0.78, w1 = font.measure(t1, s1);
    medal.add(textMesh(font, t1, -w1 / 2, 1.25, s1, top + 0.12, letters));
    const t2 = 'No. ' + spec.serial, s2 = 0.34, w2 = font.measure(t2, s2);
    medal.add(textMesh(font, t2, -w2 / 2, 1.78, s2, top + 0.12, letters));
  }
  medal.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  medal.rotation.z = spec.tilt * 0.3;
  g.userData.spec = spec;
  g.userData.medal = medal;
  // everything here is built fresh for this badge, so it can all be freed
  g.userData.dispose = () => g.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) m.dispose();
  });
  // slow glint: tip the medal back and forth so the highlights slide across the metal
  g.userData.tick = (t) => {
    medal.rotation.x = Math.sin(t * 0.9) * 0.22;
    medal.rotation.z = spec.tilt * 0.3 + Math.sin(t * 0.7 + 1) * 0.16;
    medal.position.y = 0.4 + Math.sin(t * 1.4) * 0.12;
  };
  return g;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(r, 0); s.lineTo(w - r, 0); s.quadraticCurveTo(w, 0, w, r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(r, h); s.quadraticCurveTo(0, h, 0, h - r); s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
  return s;
}

function textMesh(font, str, x, z, size, y, mat) {
  let pen = x;
  const items = [];
  for (const ch of str) { items.push({ ch, x: pen, z, size, depth: 0.12, y }); pen += font.advance(ch) * size; }
  const geo = font.build(items);
  return new THREE.Mesh(geo || new THREE.BufferGeometry(), mat);
}

// environment for the reflections (built once, used by every physical material)
let envTex = null;
export async function ensureEnvironment(renderer, scene) {
  if (envTex) { scene.environment = envTex; return; }
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 1.15;
  pm.dispose();
}
