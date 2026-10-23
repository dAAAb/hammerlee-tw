// Builders: one laid-out chat item -> a 3D object on the floor.
// Every record has the item's top-left corner at its local origin, content toward +x / +z, and offers
// enter(k) for the pop-in, tick(t, dt) for idle motion, hits for tappable parts, and dispose().
import * as THREE from 'three';
import { toon, toonReveal } from '../engine/toon.js';
import { bubbleShape, slabFromShape, roundRect } from './shapes.js';
import { BUBBLE, SIZES } from './layout.js';
import { emoji, sticker, avatar } from '../models/registry.js';
import { buildCover } from './cover.js';

const TEXT_TOP = '#1c2442';
const GRAY_TOP = '#5d6f92';
const CAT = { teal: '#16a6a6', coral: '#e8735a', blue: '#1185d6', red: '#d9473a', purple: '#6f7fe6', pink: '#e8657e', orange: '#ef8f24' };

const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp01 = t => Math.max(0, Math.min(1, t));

export class Builder {
  constructor({ font, photoAspect = {}, makeElder, makeBadge, loadPhoto }) {
    this.font = font;
    this.photoAspect = photoAspect;
    this.makeElder = makeElder;      // (id, w, h) => THREE.Texture
    this.makeBadge = makeBadge;      // (chatId) => Group
    this.loadPhoto = loadPhoto;      // (id) => THREE.Texture
  }

  // text helper: a run of 3D letters, left-aligned at (x, z baseline), returns { mesh, width }
  label(text, x, z, size, top = GRAY_TOP, y = 0, depth = 0.08) {
    const f = this.font;
    let pen = x;
    const items = [];
    for (const ch of text) { items.push({ ch, x: pen, z, size, depth, y }); pen += f.advance(ch) * size; }
    const geo = f.build(items);
    const mesh = geo ? new THREE.Mesh(geo, toon('text', { top, text: true })) : new THREE.Group();
    mesh.castShadow = false;
    return { mesh, width: pen - x };
  }

  build(it) {
    switch (it.kind) {
      case 'text': return this.textBubble(it);
      case 'sticker': return this.sticker(it);
      case 'photo': return this.photo(it, this.loadPhoto(it.msg.id), this.photoAspect[it.msg.id] || 1);
      case 'elder': return this.photo(it, this.makeElder(it.msg.id), 0.8, true);
      case 'card': return this.card(it);
      case 'badge': return this.badge(it);
      case 'date': case 'end': return this.pill(it);
      case 'cover': {
        const rec = this.frame(it, 0, 0);
        const c = buildCover(this.font, it.w);
        rec.add(c);
        rec.enterDuration = 0.01;
        rec.tick = t => c.userData.tick(t);
        return rec;
      }
      default: return null;
    }
  }

  // wraps content in a pivot so it can pop from a corner
  frame(it, pivotX, pivotZ) {
    const group = new THREE.Group();
    group.position.set(it.x, 0, it.z);
    const pivot = new THREE.Group();
    pivot.position.set(pivotX, 0, pivotZ);
    const content = new THREE.Group();
    content.position.set(-pivotX, 0, -pivotZ);
    pivot.add(content);
    group.add(pivot);
    const geos = [];
    const rec = {
      item: it, group, pivot, content, hits: [], geos, mats: [],
      add(obj) { content.add(obj); obj.traverse(o => { if (o.isMesh) { if (o.castShadow !== false) o.castShadow = true; } }); return obj; },
      enter: k => { const s = k >= 1 ? 1 : Math.max(0.001, easeOutBack(clamp01(k))); pivot.scale.set(s, s, s); },
      tick: null,
      dispose() {
        group.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); });
        for (const m of rec.mats) m.dispose();
      },
    };
    return rec;
  }

  extras(rec, it, w, h) {
    const S = SIZES;
    if (it.who === 'chuan' && it.first) {
      const av = avatar();
      av.position.set(-S.avatarGap - S.avatar / 2, 0, -S.nameH + S.avatar / 2 - 0.05);
      rec.group.add(av);
      rec.avatar = av;
      rec.hits.push({ obj: av, type: 'avatar' });
      const name = this.label('李四川', 0.15, -S.nameH + 0.62, 0.62, '#2b3f6b');
      rec.group.add(name.mesh);
    }
    if (it.who === 'chuan' && it.time && it.kind !== 'badge') {
      const t = this.label(it.time, w + 0.3, h - 0.15, 0.48);
      rec.group.add(t.mesh);
    }
    if (it.who === 'me') {
      const t = this.label(it.time, 0, h - 0.15, 0.48);
      t.mesh.position.x = -0.3 - t.width;
      rec.group.add(t.mesh);
      const r = this.label('已讀', 0, h - 0.8, 0.48);
      r.mesh.position.x = -0.3 - r.width;
      rec.group.add(r.mesh);
    }
  }

  textBubble(it) {
    const { w, h } = it;
    const left = it.who === 'chuan';
    const rec = this.frame(it, left ? 0 : w, 0);
    const T = BUBBLE.thick;
    const shape = it.first ? bubbleShape(w, h, left ? 'left' : 'right', BUBBLE.radius) : roundRect(w, h, BUBBLE.radius);
    const slab = new THREE.Mesh(slabFromShape(shape, T), toon(left ? 'white' : 'green', { receive: 0.45 }));
    slab.userData.ownGeo = true; slab.receiveShadow = true;
    rec.add(slab);
    rec.hits.push({ obj: slab, type: 'bubble' });

    // letters and inline emoji, in reading order
    const L = it.text, items = [], emojis = [];
    let order = 0;
    // same baseline the browser uses for the selectable text layer: half-leading + ascender
    const f = this.font, asc = f.ascender, content = f.ascender - f.descender;
    L.lines.forEach((line, i) => {
      const base = BUBBLE.padY + i * L.lineH + (L.lineH - content) / 2 + asc;
      for (const g of line.items) {
        if (g.t === 'ch') { if (g.ch !== ' ') items.push({ ch: g.ch, x: BUBBLE.pad + g.x, z: base, size: 1, depth: 0.2, y: T, order: order++ }); }
        else emojis.push({ name: g.name, x: BUBBLE.pad + g.x + g.w / 2, z: base - 0.36, order: order++ });
      }
    });
    const geo = this.font.build(items, { withIndex: true });
    let reveal = null;
    if (geo) {
      reveal = toonReveal('text', { top: TEXT_TOP, text: true, drop: 1.4 });
      rec.mats.push(reveal);
      const tm = new THREE.Mesh(geo, reveal);
      tm.userData.ownGeo = true;
      tm.castShadow = true;
      rec.add(tm);
      rec.textMesh = tm;
    }
    const emo = emojis.map(e => {
      const o = emoji(e.name);
      o.position.set(e.x, T, e.z);
      o.userData.order = e.order;
      rec.add(o);
      return o;
    });
    const n = order;
    const dur = Math.min(1.1, 0.18 + n * 0.028);
    rec.n = n;
    rec.enter = k => {
      const kb = clamp01(k / 0.35);
      const s = kb >= 1 ? 1 : Math.max(0.001, easeOutBack(kb));
      rec.pivot.scale.set(s, 1, s);
      const shown = clamp01((k - 0.2) / 0.8) * (n + 1);
      if (reveal) reveal.uniforms.uReveal.value = k >= 1 ? n + 2 : shown;
      for (const o of emo) {
        const e = clamp01(shown - o.userData.order);
        const sc = e <= 0 ? 0.001 : easeOutBack(e);
        o.scale.setScalar(sc);
      }
      if (k >= 1 && rec.textMesh && rec.textMesh.material !== rec.plainMat) {
        rec.plainMat = toon('text', { top: TEXT_TOP, text: true });
        rec.textMesh.material = rec.plainMat;
      }
    };
    rec.enterDuration = 0.35 + dur;
    rec.tick = (t) => { for (const o of emo) o.userData.tick?.(t); };
    this.extras(rec, it, w, h);
    return rec;
  }

  sticker(it) {
    const rec = this.frame(it, it.w / 2, it.h / 2);
    const s = sticker(it.msg.id, this.font, it.who);
    s.position.set(it.w / 2, 0, it.h / 2);
    rec.add(s);
    rec.hits.push({ obj: s, type: 'sticker', id: it.msg.id, who: it.who });
    rec.enter = k => {
      if (s.userData.pop) { s.userData.pop(clamp01(k)); rec.pivot.scale.setScalar(1); return; }
      const s2 = k >= 1 ? 1 : Math.max(0.001, easeOutBack(clamp01(k)));
      rec.pivot.scale.set(s2, s2, s2);
    };
    rec.enterDuration = 0.7;
    rec.tick = (t, dt) => s.userData.tick?.(t, dt);
    this.extras(rec, it, it.w, it.h);
    return rec;
  }

  photo(it, texture, aspect, elder = false) {
    const { w, h } = it;
    const rec = this.frame(it, 0, 0);
    const border = 0.4;
    const frameMesh = new THREE.Mesh(slabFromShape(roundRect(w, h, 0.55), 0.42), toon(elder ? 'cream' : 'white', { receive: 0.4 }));
    frameMesh.userData.ownGeo = true; frameMesh.receiveShadow = true;
    rec.add(frameMesh);
    const pw = w - border * 2, ph = h - border * 2;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texture, color: texture ? '#ffffff' : '#c9d3e3' }));
    plane.position.set(w / 2, 0.43, h / 2);
    plane.userData.ownGeo = true;
    plane.castShadow = false;
    rec.mats.push(plane.material);
    rec.add(plane);
    plane.castShadow = false;
    rec.hits.push({ obj: frameMesh, type: elder ? 'elder' : 'photo', id: it.msg.id });
    rec.enter = k => {
      const kk = clamp01(k);
      const s = kk >= 1 ? 1 : Math.max(0.001, easeOutBack(kk));
      rec.pivot.scale.set(s, s, s);
      rec.pivot.rotation.y = (1 - kk) * 0.25;
    };
    rec.enterDuration = 0.6;
    this.extras(rec, it, w, h);
    return rec;
  }

  card(it) {
    const { w, h, card } = it;
    const rec = this.frame(it, 0, 0);
    const base = new THREE.Mesh(slabFromShape(roundRect(w, h, 0.6), 0.45), toon('white', { receive: 0.45 }));
    base.userData.ownGeo = true; base.receiveShadow = true;
    rec.add(base);
    const col = CAT[card.cat] || CAT.blue;
    const band = new THREE.Mesh(slabFromShape(roundRect(w - 0.5, 1.9, 0.45), 0.16, { bevel: 0.04 }), toon(col));
    band.position.set(0.25, 0.45, 0.25);
    band.userData.ownGeo = true;
    rec.add(band);
    const icon = emoji(card.icon);
    icon.scale.setScalar(1.25);
    icon.position.set(1.05, 0.61, 1.2);
    rec.add(icon);
    const title = this.label(card.title, 1.95, 1.5, 0.82, '#ffffff', 0.61, 0.12);
    rec.add(title.mesh);
    card.lines.forEach((line, i) => {
      const z = 2.3 + 0.95 + i * 1.25;
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 14), toon(col));
      dot.position.set(0.85, 0.52, z - 0.32);
      dot.userData.ownGeo = true;
      rec.add(dot);
      const t = this.label(line, 1.25, z, 0.88, TEXT_TOP, 0.45, 0.14);
      rec.add(t.mesh);
    });
    // the button
    const bz = h - 1.75, bw = w - 1.0;
    const btn = new THREE.Mesh(slabFromShape(roundRect(bw, 1.3, 0.65), 0.22, { bevel: 0.05 }), toon('yellow'));
    btn.position.set(0.5, 0.45, bz);
    btn.userData.ownGeo = true;
    rec.add(btn);
    const btxt = '看完整政見 ›';
    const bt = this.label(btxt, 0, bz + 0.98, 0.78, '#3a2a00', 0.67, 0.1);
    bt.mesh.position.x = 0.5 + (bw - bt.width) / 2;
    rec.add(bt.mesh);
    rec.hits.push({ obj: btn, type: 'link', url: card.link, title: card.title });
    rec.hits.push({ obj: base, type: 'card', id: it.msg.id });
    rec.enterDuration = 0.6;
    rec.tick = t => icon.userData.tick?.(t);
    this.extras(rec, it, w, h);
    return rec;
  }

  badge(it) {
    const rec = this.frame(it, it.w / 2, it.h / 2);
    const b = this.makeBadge ? this.makeBadge() : new THREE.Group();
    b.position.set(it.w / 2, 0, it.h / 2 - 0.4);
    rec.add(b);
    rec.badge = b;
    rec.hits.push({ obj: b, type: 'badge' });
    rec.enterDuration = 1.2;
    rec.enter = k => {
      const kk = clamp01(k);
      const s = kk >= 1 ? 1 : Math.max(0.001, easeOutBack(kk));
      rec.pivot.scale.setScalar(s);
      b.rotation.y = (1 - kk) * Math.PI * 2;
    };
    rec.tick = (t, dt) => b.userData.tick?.(t, dt);
    return rec;
  }

  pill(it) {
    const rec = this.frame(it, it.w / 2, it.h / 2);
    const p = new THREE.Mesh(slabFromShape(roundRect(it.w, it.h, it.h / 2), 0.28, { bevel: 0.05 }), toon('#7f9cc8'));
    p.userData.ownGeo = true;
    rec.add(p);
    const t = this.label(it.text, 0, it.h / 2 + 0.24, 0.62, '#ffffff', 0.28, 0.08);
    t.mesh.position.x = (it.w - t.width) / 2;
    rec.add(t.mesh);
    rec.enterDuration = 0.4;
    return rec;
  }
}

// "…" typing bubble that 川伯 shows before each of his messages
export function typingBubble() {
  const g = new THREE.Group();
  const w = 3.2, h = 1.8;
  const slab = new THREE.Mesh(slabFromShape(bubbleShape(w, h, 'left', 0.85), BUBBLE.thick), toon('white', { receive: 0.45 }));
  slab.receiveShadow = true; slab.castShadow = true;
  g.add(slab);
  const dots = [0, 1, 2].map(i => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toon('#8c9bbb'));
    d.position.set(0.95 + i * 0.65, BUBBLE.thick + 0.18, h / 2);
    d.castShadow = true;
    g.add(d);
    return d;
  });
  g.userData.tick = t => dots.forEach((d, i) => { d.position.y = BUBBLE.thick + 0.18 + Math.max(0, Math.sin(t * 7 - i * 0.7)) * 0.35; });
  g.userData.size = { w, h };
  return g;
}
