// The 3D app chrome that stays on screen: the header (川伯's name, Auto and Big-text buttons) and the input
// bar (the field that types by itself, the send button that turns into Share at the end, the 說掰掰 chip and
// the ↓ jump-to-latest button). It floats high above the chat (y = LIFT) so nothing ever pokes through it.
// Screen placement: for the oblique camera a point at height y shows up shifted by (kx·y, ky·y) em, so
// world x = tx + sx − kx·y and world z = tz − sy + ky·y for a screen spot (sx, sy) measured from the centre.
import * as THREE from 'three';
import { toon, toonReveal } from '../engine/toon.js';
import { roundRect, slabFromShape, circleShape } from '../chat/shapes.js';
import { layoutText } from '../text/layout.js';
import { emoji, avatar, head } from '../models/registry.js';

export const LIFT = 7;
const HEADER_H = 3.5;
const BAR_H = 3.9;
const FIELD_LINE = 1.32;

export class Chrome {
  constructor(stage, font) {
    this.stage = stage;
    this.font = font;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    this.mode = 'chat';
    this.typing = { text: '', shown: 0, mesh: null, lines: 1, emojis: [] };
    this.buttons = [];
    this.flags = { auto: false, big: false, behind: false, ended: false, bye: true, hint: false };
    this.safeTop = 0; this.safeBottom = 0;
    this.anim = { send: 0, behind: 0, share: 0, hint: 0 };
  }

  // rebuild for a view size — called on resize and font-size change. `unit` = world em per chrome unit:
  // the chrome is laid out in its own units (the standard text size) so 大字 enlarges the chat, not the bars.
  build(viewW, viewH, safeTopEm = 0, safeBottomEm = 0, unit = 1) {
    this.unit = unit;
    this.viewW = viewW; this.viewH = viewH;
    this.safeTop = safeTopEm; this.safeBottom = safeBottomEm;
    for (const c of [...this.root.children]) { this.root.remove(c); c.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); }); }
    const W = viewW + 2;    // a little wider than the screen so edges never show
    const own = m => { m.userData.own = true; return m; };
    this.headerH = HEADER_H + safeTopEm;
    this.barH = BAR_H + safeBottomEm;

    // header: navy slab across the top
    const header = new THREE.Group();
    const hs = own(new THREE.Mesh(slabFromShape(roundRect(W, this.headerH + 1, 0.0), 0.7, { bevel: 0.08 }), toon('navy')));
    hs.position.set(-W / 2, -0.7, -1);
    header.add(hs);
    const stripe = own(new THREE.Mesh(slabFromShape(roundRect(W, 0.32, 0.0), 0.1, { bevel: 0.02 }), toon('yellow')));
    stripe.position.set(-W / 2, 0, this.headerH - 0.32);
    header.add(stripe);
    const av = avatar();
    av.scale.setScalar(0.92);
    av.position.set(-viewW / 2 + 1.75, 0, safeTopEm + HEADER_H / 2 + 0.05);
    header.add(av);
    const name = this.text('川伯 李四川', -viewW / 2 + 3.3, safeTopEm + 1.75, 1.0, '#ffffff', 0.1, 0.14);
    header.add(name.mesh);
    const sub = this.text('新北市長候選人', -viewW / 2 + 3.32, safeTopEm + 2.75, 0.56, '#bcd3ff', 0.1, 0.08);
    header.add(sub.mesh);
    // right side buttons: 自動聊 / 大字
    const bigW = 2.6, autoW = 4.3, gap = 0.35, bh = 2.0;
    const xBig = viewW / 2 - 0.45 - bigW, xAuto = xBig - gap - autoW, by = safeTopEm + (HEADER_H - bh) / 2;
    this.autoBtn = this.pillButton(autoW, bh, this.flags.auto ? '■ 暫停' : '▶ 自動聊', 'yellow', '#3a2a00', 0.78);
    this.autoBtn.group.position.set(xAuto, 0.1, by);
    header.add(this.autoBtn.group);
    this.bigBtn = this.pillButton(bigW, bh, this.flags.big ? '標準' : '大字', 'white', '#163c84', 0.82);
    this.bigBtn.group.position.set(xBig, 0.1, by);
    header.add(this.bigBtn.group);
    this.header = header;
    this.root.add(header);

    // input bar at the bottom
    const bar = new THREE.Group();
    const bs = own(new THREE.Mesh(slabFromShape(roundRect(W, this.barH + 1, 0.0), 0.7, { bevel: 0.08 }), toon('paper')));
    bs.position.set(-W / 2, -0.7, 0);
    bar.add(bs);
    this.sendW = 2.7;
    this.gearD = 2.5;
    this.gear = this.gearButton(this.gearD);
    this.gear.position.set(-viewW / 2 + 0.5 + this.gearD / 2, 0.05, BAR_H / 2);
    bar.add(this.gear);
    this.fieldX = -viewW / 2 + 0.5 + this.gearD + 0.35;
    this.fieldW = this.fieldWidth();
    this.field = new THREE.Group();
    bar.add(this.field);
    this.sendBtn = this.sendButton();
    this.sendBtn.position.set(viewW / 2 - 0.55 - this.sendW / 2, 0.05, BAR_H / 2);
    bar.add(this.sendBtn);
    this.bar = bar;
    this.root.add(bar);

    // floating chips above the bar
    this.byeChip = this.pillButton(6.7, 1.85, '👋 跟川伯說掰掰', 'yellow', '#3a2a00', 0.76, 'head');
    this.root.add(this.byeChip.group);
    this.downBtn = this.roundButton(2.3, 'sky');
    this.root.add(this.downBtn);
    this.hint = this.pillButton(8.6, 1.9, '往下滑，繼續聊', 'white', '#163c84', 0.84);
    const arrow = this.roundButton(1.5, 'yellow');
    arrow.position.set(8.6 + 0.2 + 0.75, 0, 0.95);
    this.hint.group.add(arrow);
    this.root.add(this.hint.group);
    this.hint.group.visible = false;

    this.buildField(1);
    this.setTyping(this.typing.text, this.typing.shown, true);
    this.layoutButtons();
    this.noShadows();
  }

  // the chrome floats far above the chat: its shadows would land as big blobs on the messages
  noShadows() { this.root.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); }

  text(str, x, z, size, top, y = 0, depth = 0.1) {
    const f = this.font;
    let pen = x;
    const items = [];
    for (const ch of str) { items.push({ ch, x: pen, z, size, depth, y }); pen += f.advance(ch) * size; }
    const geo = f.build(items);
    const mesh = geo ? new THREE.Mesh(geo, toon('text', { top, text: true })) : new THREE.Group();
    if (geo) mesh.userData.own = true;
    return { mesh, width: pen - x };
  }

  pillButton(w, h, label, pal, textTop, size, icon) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(slabFromShape(roundRect(w, h, h / 2), 0.45, { bevel: 0.08 }), toon(pal));
    m.userData.own = true;
    g.add(m);
    let str = label, x0 = 0;
    if (icon || label.startsWith('👋')) {
      str = label.replace('👋 ', '');
      const e = icon === 'head' || !icon ? head() : emoji(icon);
      e.scale.setScalar(icon === 'head' || !icon ? 0.55 : 1.05);
      x0 = 1.2;
      e.position.set(0.95, 0.45, h / 2 + 0.05);
      g.add(e);
    }
    const t = this.text(str, 0, h / 2 + size * 0.36, size, textTop, 0.45, 0.12);
    t.mesh.position.x = x0 + (w - x0 - t.width) / 2;
    g.add(t.mesh);
    g.userData.size = { w, h };
    return { group: g, w, h };
  }

  roundButton(d, pal) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(slabFromShape(circleShape(d / 2), 0.5, { bevel: 0.08 }), toon(pal));
    m.userData.own = true;
    g.add(m);
    // a chunky down arrow
    const s = new THREE.Shape();
    s.moveTo(-0.18, 0.5); s.lineTo(0.18, 0.5); s.lineTo(0.18, -0.05); s.lineTo(0.48, -0.05); s.lineTo(0, -0.55); s.lineTo(-0.48, -0.05); s.lineTo(-0.18, -0.05); s.closePath();
    const a = new THREE.Mesh(slabFromShape(s, 0.18, { bevel: 0.03 }), toon('navy'));
    a.userData.own = true;
    a.position.y = 0.5;
    g.add(a);
    g.userData.d = d;
    return g;
  }

  sendButton() {
    const g = new THREE.Group();
    const d = this.sendW;
    const disc = new THREE.Mesh(slabFromShape(circleShape(d / 2), 0.5, { bevel: 0.08 }), toon('#06c755'));
    disc.userData.own = true;
    g.add(disc);
    // paper plane
    const s = new THREE.Shape();
    s.moveTo(-0.62, 0.05); s.lineTo(0.66, 0.5); s.lineTo(0.12, -0.6); s.lineTo(-0.02, -0.12); s.closePath();
    const plane = new THREE.Mesh(slabFromShape(s, 0.22, { bevel: 0.03 }), toon('white'));
    plane.userData.own = true;
    plane.position.y = 0.5;
    g.add(plane);
    // share label for the end
    const share = new THREE.Group();
    const sd = new THREE.Mesh(slabFromShape(roundRect(d + 1.6, d * 0.78, d * 0.39), 0.55, { bevel: 0.08 }), toon('yellow'));
    sd.userData.own = true;
    sd.position.set(-(d + 1.6) + d / 2 + 0.05, 0, -d * 0.39);
    share.add(sd);
    const st = this.text('分享', 0, d * 0.13 + 0.36, 1.0, '#3a2a00', 0.55, 0.14);
    st.mesh.position.x = -(d + 1.6) / 2 + d / 2 - st.width / 2 + 0.05;
    share.add(st.mesh);
    share.visible = false;
    g.add(share);
    g.userData = { disc, plane, share };
    return g;
  }

  fieldWidth() { return this.viewW - 1.1 - this.sendW - 0.4 - this.gearD - 0.35 - (this.mode === 'share' ? 1.6 : 0); }

  // a chunky cog: a toothed disc with a hole, the universal "settings" sign
  gearButton(d) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(slabFromShape(circleShape(d / 2), 0.5, { bevel: 0.08 }), toon('white'));
    disc.userData.own = true;
    g.add(disc);
    const s = new THREE.Shape();
    const teeth = 8, r0 = 0.62, r1 = 0.86;
    for (let i = 0; i < teeth * 4; i++) {
      const a = i / (teeth * 4) * Math.PI * 2, r = (i % 4 < 2) ? r1 : r0;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    s.holes.push(new THREE.Path().absarc(0, 0, 0.3, 0, Math.PI * 2, true));
    const cog = new THREE.Mesh(slabFromShape(s, 0.22, { bevel: 0.03 }), toon('navy'));
    cog.userData.own = true;
    cog.position.y = 0.5;
    g.add(cog);
    g.userData.cog = cog;
    return g;
  }

  buildField(lines) {
    for (const c of [...this.field.children]) { this.field.remove(c); if (c.userData.own) c.geometry.dispose(); }
    const h = Math.max(1, lines) * FIELD_LINE + 0.9;
    this.fieldH = h;
    const m = new THREE.Mesh(slabFromShape(roundRect(this.fieldW, h, Math.min(h / 2, 1.2)), 0.3, { bevel: 0.06 }), toon('#f1f5fb'));
    m.userData.own = true;
    this.field.add(m);
    this.field.position.set(this.fieldX, 0.05, BAR_H / 2 + 0.95 - h);
    this.typing.lines = lines;
  }

  // show `text` typed up to `shown` letters (emoji count as one). Placeholder when empty.
  setTyping(text, shown, force = false) {
    const T = this.typing;
    if (text !== T.text || force) {
      if (T.mesh) { this.field.remove(T.mesh); T.mesh.geometry?.dispose?.(); T.mat?.dispose(); }
      for (const e of T.emojis) this.field.remove(e);
      T.emojis = []; T.mesh = null; T.text = text;
      const str = text || (this.mode === 'share' ? '分享我跟川伯的對話給朋友' : '往下滑，川伯陪你聊天');
      const placeholder = !text;
      const L = layoutText(this.font, str, this.fieldW - 1.2, 0.95, { lineH: FIELD_LINE / 0.95 });
      const lines = placeholder ? 1 : Math.min(4, L.lines.length);
      if (lines !== T.lines || force) this.buildField(lines);
      const items = [];
      let order = 0;
      const first = Math.max(0, L.lines.length - 4);
      L.lines.slice(first).forEach((line, i) => {
        const z = 0.45 + i * FIELD_LINE + 0.86 * 0.95;
        for (const g of line.items) {
          if (g.t === 'ch') { if (g.ch !== ' ') items.push({ ch: g.ch, x: 0.6 + g.x, z, size: 0.95, depth: 0.12, y: 0.3, order: order++ }); }
          else {
            const e = emoji(g.name); e.scale.setScalar(0.8); e.position.set(0.6 + g.x + g.w / 2, 0.3, z - 0.32); e.userData.order = order++;
            this.field.add(e); T.emojis.push(e);
          }
        }
      });
      T.total = order;
      const geo = this.font.build(items, { withIndex: true });
      if (geo) {
        T.mat = toonReveal('text', { top: placeholder ? '#9aa6bf' : '#1c2442', text: true, drop: 0.5 });
        T.mesh = new THREE.Mesh(geo, T.mat);
        this.field.add(T.mesh);
      }
      this.noShadows();
      T.placeholder = placeholder;
    }
    T.shown = T.placeholder ? 1e6 : shown;
    if (T.mat) T.mat.uniforms.uReveal.value = T.shown;
    for (const e of T.emojis) e.visible = T.shown > e.userData.order;
    this.stage.dirty = true;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const { share, plane, disc } = this.sendBtn.userData;
    share.visible = mode === 'share';
    plane.visible = disc.visible = mode !== 'share';
    this.fieldW = this.fieldWidth();
    this.setTyping('', 0, true);
    this.layoutButtons();
  }

  // screen rectangles (CSS px) of tappable chrome, for the HTML hit layer
  layoutButtons() {
    const em = this.stage.emPx * this.unit, vw = this.viewW, vh = this.viewH;
    const px = (sx, sy) => ({ x: (sx + vw / 2) * em, y: (vh / 2 - sy) * em });
    const rects = [];
    const top = vh / 2;
    const by = top - this.safeTop - (HEADER_H - 2.0) / 2;
    const xBig = vw / 2 - 0.45 - 2.6, xAuto = xBig - 0.35 - 4.3;
    rects.push({ id: 'auto', label: this.flags.auto ? '暫停自動聊天' : '自動聊天', ...rect(px(xAuto, by), 4.3 * em, 2.0 * em) });
    rects.push({ id: 'big', label: this.flags.big ? '恢復標準字' : '放大字體', ...rect(px(xBig, by), 2.6 * em, 2.0 * em) });
    const bottom = -vh / 2 + this.safeBottom;
    const sendCx = vw / 2 - 0.55 - this.sendW / 2, sendCy = bottom + BAR_H / 2;
    if (this.mode === 'share') rects.push({ id: 'share', label: '分享這段對話給朋友', ...rect(px(sendCx - this.sendW / 2 - 1.6, sendCy + this.sendW * 0.39), (this.sendW + 1.6) * em, this.sendW * 0.78 * em) });
    else rects.push({ id: 'send', label: '下一則', ...rect(px(sendCx - this.sendW / 2, sendCy + this.sendW / 2), this.sendW * em, this.sendW * em) });
    rects.push({ id: 'settings', label: '設定與說明（聲音、震動、立體視角）', ...rect(px(-vw / 2 + 0.5, bottom + BAR_H / 2 + this.gearD / 2), this.gearD * em, this.gearD * em) });
    rects.push({ id: 'field', label: this.mode === 'share' ? '分享這段對話給朋友' : '下一則', ...rect(px(this.fieldX, bottom + BAR_H / 2 - 0.95 + this.fieldH), this.fieldW * em, this.fieldH * em) });
    if (this.flags.bye && !this.flags.ended) rects.push({ id: 'bye', label: '跟川伯說掰掰（直接看到最後）', ...rect(px(-vw / 2 + 0.55, bottom + BAR_H + this.fieldExtra() + 2.35), 6.7 * em, 1.85 * em) });
    if (this.flags.behind) rects.push({ id: 'down', label: '回到最新訊息', ...rect(px(vw / 2 - 0.55 - 2.3, bottom + BAR_H + this.fieldExtra() + 1.75 + 1.15), 2.3 * em, 2.3 * em) });
    this.buttons = rects;
    return rects;
  }
  fieldExtra() { return Math.max(0, this.fieldH - (FIELD_LINE + 0.9)); }

  // follow the camera every frame; t = seconds, for little idle motions
  update(t, dt) {
    const st = this.stage, k = st.camera.shear, tgt = st.rig.target, u = this.unit;
    const vw = this.viewW, vh = this.viewH;
    const place = (obj, sx, sy, y = LIFT) => { obj.position.set(tgt.x + sx * u - k.x * y, y, tgt.z - sy * u + k.y * y); obj.scale.setScalar(u); };
    place(this.header, 0, vh / 2, LIFT);   // local origin: top edge, local +z goes down the screen
    place(this.bar, 0, -vh / 2 + this.barH, LIFT);
    // the bar's local origin is its top edge
    const above = -vh / 2 + this.barH + this.fieldExtra();
    this.anim.behind += ((this.flags.behind ? 1 : 0) - this.anim.behind) * Math.min(1, dt * 10);
    const b = this.anim.behind;
    this.downBtn.visible = b > 0.02;
    place(this.downBtn, vw / 2 - 0.55 - 1.15, above + 1.75 - (1 - b) * 3, LIFT - 0.6);
    this.downBtn.scale.setScalar(u * Math.max(0.01, b));
    this.anim.hint += ((this.flags.hint ? 1 : 0) - this.anim.hint) * Math.min(1, dt * 6);
    const hk = this.anim.hint;
    this.hint.group.visible = hk > 0.02;
    place(this.hint.group, -(8.6 + 1.9) / 2, above + 5.6 + Math.abs(Math.sin(t * 3.2)) * 0.6 - (1 - hk) * 2, LIFT - 0.3);
    this.hint.group.scale.setScalar(u * Math.max(0.01, hk));
    const showBye = this.flags.bye && !this.flags.ended;
    this.byeChip.group.visible = showBye;
    place(this.byeChip.group, -vw / 2 + 0.55, above + 2.35, LIFT - 0.6);
    this.byeChip.group.rotation.y = Math.sin(t * 2.2) * 0.02;
    // send button squash after a send
    this.anim.send = Math.max(0, this.anim.send - dt * 3);
    const s = 1 - Math.sin(this.anim.send * Math.PI) * 0.18;
    this.sendBtn.scale.set(s, 1, s);   // (inside the bar, which carries the unit scale)
    if (this.mode === 'share') this.sendBtn.userData.share.position.y = Math.abs(Math.sin(t * 3)) * 0.25;
    for (const e of this.typing.emojis) e.userData.tick?.(t);
    if (this.gear) this.gear.userData.cog.rotation.y = t * 0.25;
    this.autoBtn.group.position.y = 0.1 + (this.flags.auto ? Math.abs(Math.sin(t * 4)) * 0.15 : 0);
  }

  pulseSend() { this.anim.send = 1; }

  // the Auto button reads "■ 暫停" while the chat plays by itself
  setAuto(on) {
    if (!this.autoBtn || this.flags.auto === on && this.autoBtn.label === (on ? 'on' : 'off')) return;
    this.flags.auto = on;
    const old = this.autoBtn.group;
    const next = this.pillButton(4.3, 2.0, on ? '■ 暫停' : '▶ 自動聊', on ? 'white' : 'yellow', on ? '#163c84' : '#3a2a00', 0.78);
    next.group.position.copy(old.position);
    next.label = on ? 'on' : 'off';
    old.parent.add(next.group);
    old.parent.remove(old);
    this.autoBtn = next;
    this.noShadows();
  }
}

function rect(p, w, h) { return { x: p.x, y: p.y, w, h }; }
