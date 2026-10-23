// 川哥 builds things. Now and then, mid-run, he stops, digs and hammers, and a little model of something he worked
// on rises from the floor beside him: a collectible with a tier, N to UR. Tap it to see it big and save or share
// its card. Every kind found is remembered on this phone (圖鑑). Captions come from research/NOTES.md; the UR is
// a pledge and says so.
//
// Odds (爆率): on one phone, a run has a BUILD_RATE chance of a build; in a room of phones only a few lucky ones
// can get one, less often the bigger the room (net/pair.js buildShare). Which build: a tier by TIERS weights,
// then any build of that tier.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';

export const BUILD_RATE = 0.18;
export const TIERS = {
  N:   { w: 50, color: '#7d879c', light: '#eef1f6', dark: '#3d4456' },
  R:   { w: 30, color: '#1689cf', light: '#dff1fc', dark: '#0b4f86' },
  SR:  { w: 14, color: '#7f5bd6', light: '#efe8ff', dark: '#3c2a80' },
  SSR: { w: 5,  color: '#e9a800', light: '#fff4cc', dark: '#7a5600' },
  UR:  { w: 1,  color: '#e0533f', light: '#ffe9e3', dark: '#6d2016' },
};
export const BUILDS = [
  { id: 'overpass', tier: 'N', model: 'overpass', name: '學校旁的天橋', note: '他說：「我在校園周圍蓋過天橋。」' },
  { id: 'pump', tier: 'N', model: 'pump', name: '抽水站與水門', note: '做過工務局長，負責治水。' },
  { id: 'daycare', tier: 'N', model: 'family', name: '新北第一所公托', note: '民國 100 年新北第一所公托，他有參與。' },
  { id: 'arena', tier: 'R', model: 'arena', name: '台北小巨蛋', note: '在台北市工務局的時候，參與過小巨蛋工程。' },
  { id: 'cityhall', tier: 'R', model: 'cityhall', name: '台北市政府大樓', note: '在信義計畫區的市府大樓當過監工。' },
  { id: 'crossing', tier: 'R', model: 'crossing', name: '公館圓環改善', note: '公館圓環改善以後，事故率降了 51%。' },
  { id: 'hospital', tier: 'SR', model: 'medical', name: '土城醫院', note: '從會勘、協調到一層一層蓋起來，跟了五年。' },
  { id: 'rail', tier: 'SR', model: 'rail', name: '三環三線', note: '參與規劃。當年被笑「夢裡相見」，現在環狀線、機場線、淡海輕軌都在跑。' },
  { id: 'dome', tier: 'SSR', model: 'domecity', name: '台北大巨蛋', note: '他說：協助解決大巨蛋卡關，讓它完工啟用。' },
  { id: 'nvidia', tier: 'SSR', model: 'nvidia', name: '國際 AI 總部大樓（北士科）', note: '提出第三方鑑價解開用地僵局，2026 年 2 月代表台北市政府簽約。' },
  { id: 'lushe', tier: 'UR', model: 'ai', name: '蘆社大橋（下一段路）', note: '政見：興建蘆社大橋，串起北士科和新北的 AI 產業。' },
];
const SCALE = 0.32;                       // dioramas are ~7 em across: builds are ~2.2 em
const R = 7 * SCALE / 2 + 0.15;           // the room a build needs around its centre
const KEEP = 8;                           // builds kept in the chat at once (the oldest goes)
const STORE = 'hl:builds';

export function rollBuild(rand = Math.random) {
  const tiers = Object.entries(TIERS), sum = tiers.reduce((s, [, t]) => s + t.w, 0);
  let r = rand() * sum, tier = 'N';
  for (const [k, t] of tiers) { if ((r -= t.w) < 0) { tier = k; break; } }
  const pool = BUILDS.filter(b => b.tier === tier);
  return pool[Math.floor(rand() * pool.length)];
}

// the 圖鑑 on this phone: build id -> how many times
export function collection() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
}
function remember(id) {
  const c = collection();
  c[id] = (c[id] || 0) + 1;
  try { localStorage.setItem(STORE, JSON.stringify(c)); } catch (e) { /* private mode */ }
  return c;
}

export class Builds {
  constructor(app, createScenery, { onBuilt = () => {} } = {}) {
    this.app = app;
    this.create = createScenery;
    this.onBuilt = onBuilt;
    this.items = [];      // { b, holder, g, x, z, born, revealed }
  }

  // Free floor for a build: no chat item (川伯's avatar and name included; a little clock label may be covered,
  // never words), no other build, on screen. Searched ahead of 川哥 (toward `dir`) near his lane, nearest first.
  spot(x0, z0, dir) {
    const st = this.app.stage, lay = this.app.layout, tz = st.rig.target.z;
    const top = tz - st.viewH / 2 + 4.2 + R, bottom = tz + st.viewH / 2 - 4.6 - R, maxX = st.viewW / 2 - R - 0.2;
    const boxes = lay.items.filter(it => it.w > 0 && it.h > 0).map(it => {
      const left = it.who === 'chuan' ? lay.left : it.x - 0.3;
      return [left, (it.nameZ ?? it.z) - 0.2, it.x + it.w + 0.3, it.z + it.h + 0.2];
    });
    const free = (x, z) => Math.abs(x) <= maxX && z >= top && z <= bottom
      && !boxes.some(([a, b, c, d]) => x + R > a && x - R < c && z + R > b && z - R < d)
      && !this.items.some(s => Math.hypot(s.x - x, s.z - z) < 2 * R);
    for (let dx = 1.2; dx < st.viewW; dx += 0.6) {
      const x = x0 + dir * dx;
      if (x * dir > maxX) break;          // past the far edge
      if (x * dir < -maxX) continue;      // not on screen yet
      for (const dz of [-1.4, 0, 1.4, -2.6, 2.6, -3.6, 3.6]) if (free(x, z0 + dz)) return { x, z: z0 + dz };
    }
    return null;
  }

  // 川哥 builds at the spot he ran to: place the model (it rises in update) and say which one, or null
  begin(at, rand = Math.random) {
    if (!at || !this.create) return null;
    const b = rollBuild(rand), t = TIERS[b.tier];
    const g = this.create(b.model);
    if (!g) return null;
    const holder = new THREE.Group();
    holder.add(g);
    holder.scale.setScalar(SCALE);
    holder.position.set(at.x, 0, at.z);
    // a ring on the floor in the tier's colour
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.16, 6, 48).rotateX(Math.PI / 2), toon({ l: t.light, m: t.color, d: t.dark }));
    ring.position.y = 0.05;
    holder.add(ring);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData.pop?.(0);
    ring.scale.setScalar(1e-3);
    this.app.stage.scene.add(holder);
    const item = { b, holder, g, ring, x: at.x, z: at.z, born: this.app.time, revealed: false };
    this.items.push(item);
    while (this.items.length > KEEP) this.drop(this.items[0]);
    return item;
  }

  drop(item) {
    this.app.stage.scene.remove(item.holder);
    this.items = this.items.filter(s => s !== item);
  }

  update(dt) {
    const t = this.app.time, tz = this.app.stage.rig.target.z, vh = this.app.stage.viewH;
    for (const s of this.items) {
      const age = t - s.born;
      // he digs a moment, then it rises; the reveal comes as it settles
      const k = Math.min(1, Math.max(0, (age - 0.35) / 1.4));
      if (!s.done) { s.g.userData.pop?.(k); s.ring.scale.setScalar(Math.max(1e-3, Math.min(1, k * 1.6))); s.done = k >= 1; }
      if (!s.revealed && age > 1.9) { s.revealed = true; s.count = remember(s.b.id); this.onBuilt(s); }
      const near = Math.abs(s.holder.position.z - tz) < vh;
      s.holder.visible = near;
      if (near) {
        s.g.userData.tick?.(t, dt);
        if (s.done) s.ring.scale.setScalar(1 + 0.04 * Math.sin(t * 3));
      }
    }
  }

  // tap test: the build under the finger, if any
  hit(raycaster) {
    let best = null;
    for (const s of this.items) {
      if (!s.holder.visible) continue;
      const h = raycaster.intersectObject(s.holder, true)[0];
      if (h && (!best || h.distance < best.d)) best = { s, d: h.distance };
    }
    return best?.s || null;
  }

  // a relayout (resize, 大字) moves the chat: the builds go
  reset() {
    for (const s of [...this.items]) this.drop(s);
  }
}
