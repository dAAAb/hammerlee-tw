// The pictures people take away: the share card (1200 x 630, link-preview size), the long picture of the
// whole conversation, single stickers / the badge as square images, and 川哥's builds as collectible cards.
import * as THREE from 'three';
import { layoutChat, columnWidth } from '../chat/layout.js';
import { Builder } from '../chat/objects.js';
import { sticker as makeSticker } from '../models/registry.js';
import { makeBadge, shortId } from '../models/badge.js';
import { renderObject, isolatedScene, makeCamera } from './render.js';

const NAVY = '#00449a', BLUE = '#0096e8', YELLOW = '#ffc105', TEAL = '#2ac9c9', INK = '#231e16';

function text(g, font, str, x, y, size, fill, { stroke, strokeW = 0, align = 'left', letter = 0 } = {}) {
  const w = font.measure(str, size, letter);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const { path } = font.path2d(str, x0, y, size, { letter });
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = strokeW; g.strokeStyle = stroke; g.stroke(path); }
  g.fillStyle = fill; g.fill(path);
  return w;
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function logoBars(g, cx, cy, s, alpha = 1) {
  const cols = ['#0096e8', '#0096e8', '#0096e8', TEAL, YELLOW, NAVY, NAVY, NAVY, YELLOW, TEAL, '#0096e8', '#0096e8', '#0096e8'];
  g.save(); g.globalAlpha = alpha;
  for (let i = -6; i <= 6; i++) {
    const a = Math.abs(i) / 6, x = cx + i * s * 0.32;
    const base = cy + s * 0.35 * a * a, top = base - s * (0.18 + 1.25 * Math.max(0, 1 - Math.pow(a, 1.2)) * (Math.abs(i) <= 1 ? 1.15 : 0.85));
    g.fillStyle = cols[i + 6];
    g.fillRect(x - s * 0.09, top, s * 0.18, base - top);
  }
  g.restore();
}

// Lay out a few messages on their own and render them like the page does.
export function renderSnippet(stage, font, builderOpts, msgs, { w = 640, h = 560, viewW = 16 } = {}) {
  const mini = { id: 'snippet', msgs };
  const lay = layoutChat(mini, font, { viewW, photoAspect: builderOpts.photoAspect });
  const builder = new Builder({ font, ...builderOpts });
  const iso = isolatedScene(stage);
  const recs = [];
  for (const it of lay.items) {
    const rec = builder.build(it);
    if (!rec) continue;
    rec.enter(1); rec.tick?.(0.5, 0);
    iso.scene.add(rec.group);
    recs.push(rec);
  }
  const box = new THREE.Box3(new THREE.Vector3(lay.left, 0, -1.2), new THREE.Vector3(lay.right, 1, lay.height + 0.8));
  iso.place(box);
  const cam = makeCamera('read');
  // frame the column exactly (no automatic fit, so letters keep their size)
  const c = box.getCenter(new THREE.Vector3()); c.y = 0;
  cam.position.set(c.x, 80, c.z); cam.up.set(0, 0, -1); cam.lookAt(c); cam.focusDist = 80; cam.near = 0.1; cam.far = 210;
  cam.shear.set(-0.22, 0.72);
  const colW = lay.right - lay.left + 0.6;
  const halfW = colW / 2, halfH = halfW * h / w;
  const needH = (lay.height + 2.6) / 2;
  const k = Math.max(1, needH / halfH);
  cam.left = -halfW * k; cam.right = halfW * k; cam.top = halfH * k; cam.bottom = -halfH * k;
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const canvas = stage.snapshot(w, h, { camera: cam, scene: iso.scene });
  for (const rec of recs) { iso.scene.remove(rec.group); rec.dispose(); }
  iso.dispose();
  return canvas;
}

// pick a short, telling exchange: 川伯 line, the user's reaction, 川伯's answer — NVIDIA if possible
export function pickSnippet(chat) {
  const msgs = chat.msgs;
  const len = m => [...m.text.replace(/\[[a-z_0-9]+\]/g, 'E')].length;
  const ok = (m, who, max) => m && m.kind === 'text' && m.who === who && len(m) <= max;
  const tries = ['nvidia', ...chat.topics.filter(t => t !== 'nvidia'), null];
  for (const topic of tries) {
    for (let i = 1; i < msgs.length - 1; i++) {
      const m = msgs[i];
      if (topic && m.topic !== topic) continue;
      if (!ok(m, 'me', 22)) continue;
      const before = [...msgs.slice(0, i)].reverse().find(x => x.kind === 'text' && x.who === 'chuan');
      const after = msgs.slice(i + 1).find(x => x.kind === 'text' && x.who === 'chuan');
      if (ok(before, 'chuan', 40) && ok(after, 'chuan', 40)) return [before, m, after];
    }
  }
  return msgs.filter(m => m.kind === 'text').slice(0, 3);
}

export function badgeCanvas(stage, font, chatId, size = 900, view = 'iso') {
  const b = makeBadge(chatId, font);
  b.userData.tick(0.6);
  const cv = renderObject(stage, b, { w: size, h: size, view, margin: 0.06, floor: ['#dfeaf8', '#d3e2f5'] });
  b.userData.dispose();
  return cv;
}

export function stickerCanvas(stage, font, id, who, size = 900) {
  const s = makeSticker(id, font, who);
  return renderObject(stage, s, { w: size, h: size, view: 'card', margin: 0.08, floor: ['#fff8e6', '#fbefcf'] });
}

export function shareCard(stage, font, chat, builderOpts) {
  const W = 1200, H = 630;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, NAVY); bg.addColorStop(1, '#0a6fc4');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) logoBars(g, 80 + (i % 3) * 420, 120 + Math.floor(i / 3) * 230, 60, 0.07);
  // the chat snippet
  const snip = renderSnippet(stage, font, builderOpts, pickSnippet(chat), { w: 600, h: 560, viewW: 15 });
  g.save(); rr(g, 34, 36, 600, 560, 28); g.clip(); g.drawImage(snip, 34, 36); g.restore();
  g.lineWidth = 5; g.strokeStyle = INK; rr(g, 34, 36, 600, 560, 28); g.stroke();
  // right column
  const x = 672;
  text(g, font, '我跟未來新北市長', x, 112, 46, '#ffffff');
  text(g, font, '李四川的對話', x, 190, 68, YELLOW, { stroke: INK, strokeW: 8 });
  const badge = badgeCanvas(stage, font, chat.id, 520, 'iso');
  g.drawImage(badge, x - 6, 214, 250, 250);
  text(g, font, '新北事民徽章', x + 262, 300, 30, '#ffffff');
  text(g, font, 'No.', x + 262, 350, 24, '#bcd3ff');
  const serial = shortId(chat.id);
  text(g, font, serial.slice(0, 9), x + 262, 388, 30, '#ffffff');
  text(g, font, serial.slice(10), x + 262, 426, 30, '#ffffff');
  // call to action
  g.fillStyle = YELLOW; rr(g, x, 488, 494, 92, 46); g.fill();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  text(g, font, '邀請你也來跟川伯聊天 →', x + 247, 548, 34, '#2a1c00', { align: 'center' });
  return cv;
}

// The whole conversation as one tall picture, rendered strip by strip.
export async function longImage(stage, font, chat, builderOpts, { width = 900, onProgress } = {}) {
  const viewW = 17;
  const lay = layoutChat(chat, font, { viewW, photoAspect: builderOpts.photoAspect });
  const W = columnWidth(viewW) + 1.2;
  // iPhone Safari refuses canvases over ~16.7 M pixels: shrink the width until the whole picture fits
  const LIMIT = 15.5e6, k = (lay.height + 3) / W;
  width = Math.min(width, Math.floor((-660 + Math.sqrt(660 * 660 + 4 * k * LIMIT)) / (2 * k)));
  const emPx = width / W;
  const head = Math.round(300 * width / 900), foot = Math.round(360 * width / 900);
  const bodyH = Math.ceil((lay.height + 3) * emPx);
  const H = Math.min(30000, head + bodyH + foot);
  const out = document.createElement('canvas'); out.width = width; out.height = H;
  const g = out.getContext('2d');
  g.fillStyle = '#a9c6ea'; g.fillRect(0, 0, width, H);
  const builder = new Builder({ font, ...builderOpts });
  const chunkEm = 1400 / emPx;
  let z0 = -1.5;
  const items = lay.items.filter(it => it.kind !== 'topic');
  while (z0 < lay.height + 1.5 && head + (z0 + 1.5) * emPx < H - foot) {
    const z1 = z0 + chunkEm;
    const iso = isolatedScene(stage);
    const recs = [];
    for (const it of items) {
      if (it.z + it.h < z0 - 7 || it.z > z1 + 3) continue;
      const rec = builder.build(it);
      if (!rec) continue;
      rec.enter(1); rec.tick?.(0.5, 0);
      iso.scene.add(rec.group); recs.push(rec);
    }
    const box = new THREE.Box3(new THREE.Vector3(-W / 2, 0, z0), new THREE.Vector3(W / 2, 1, z1));
    iso.place(box);
    const cam = makeCamera('read');
    const c = new THREE.Vector3(0, 0, (z0 + z1) / 2);
    cam.position.set(0, 80, c.z); cam.up.set(0, 0, -1); cam.lookAt(c); cam.focusDist = 80; cam.near = 0.1; cam.far = 210;
    cam.shear.set(-0.22, 0.72);
    cam.left = -W / 2; cam.right = W / 2; cam.top = chunkEm / 2; cam.bottom = -chunkEm / 2;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const ph = Math.round(chunkEm * emPx);
    const strip = stage.snapshot(width, ph, { camera: cam, scene: iso.scene });
    g.drawImage(strip, 0, head + Math.round((z0 + 1.5) * emPx));
    for (const rec of recs) { iso.scene.remove(rec.group); rec.dispose(); }
    iso.dispose();
    z0 = z1;
    onProgress?.(Math.min(1, z0 / lay.height));
    await new Promise(r => setTimeout(r, 0));
  }
  // header and footer are drawn on a 900-wide design and scaled to the picture
  const sc = width / 900;
  g.save(); g.scale(sc, sc);
  g.fillStyle = NAVY; g.fillRect(0, 0, 900, 300);
  g.fillStyle = YELLOW; g.fillRect(0, 286, 900, 14);
  logoBars(g, 770, 150, 60, 1);
  text(g, font, '我跟川伯的對話', 48, 118, 64, '#ffffff');
  text(g, font, '未來新北市長 李四川', 50, 182, 34, '#bcd3ff');
  text(g, font, 'No. ' + shortId(chat.id), 50, 240, 30, YELLOW);
  g.restore();
  const fy = H - foot;
  g.save(); g.translate(0, fy); g.scale(sc, sc);
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 900, 360);
  g.fillStyle = INK; g.fillRect(0, 0, 900, 6);
  const badge = badgeCanvas(stage, font, chat.id, 520, 'iso');
  g.drawImage(badge, 34, 40, 260, 260);
  text(g, font, '這是只屬於我的一段對話', 320, 110, 38, NAVY);
  text(g, font, '你也來跟川伯聊聊天吧！', 320, 170, 38, INK);
  text(g, font, '11 月 28 日 新北的事 交給做過的人', 320, 236, 28, '#5d6f92');
  g.restore();
  return out;
}

// A build 川哥 made (fx/builds.js): the model on a card in its tier's colours, its name, what he did, and how
// many kinds this phone has found. 900 x 1125 (4:5, what photo apps like).
export function buildCard(stage, font, createScenery, b, tier, { have = 1, total = 1 } = {}) {
  const W = 900, H = 1125;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = tier.color; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fffdf6'; rr(g, 36, 36, W - 72, H - 72, 40); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  // the tier in a pill, and what this is
  const tw = font.measure(b.tier, 84) + 70;
  g.fillStyle = tier.color; rr(g, 74, 70, tw, 112, 56); g.fill(); g.lineWidth = 6; g.stroke();
  text(g, font, b.tier, 74 + tw / 2, 156, 84, '#ffffff', { stroke: INK, strokeW: 10, align: 'center' });
  text(g, font, '川哥的微縮建設', W - 78, 142, 42, NAVY, { align: 'right' });
  // the model
  const model = createScenery(b.model);
  const pic = renderObject(stage, model, { w: 780, h: 600, view: 'iso', margin: 0.06, floor: [tier.light, '#ffffff'], t: 1.3 });
  g.save(); rr(g, 60, 214, 780, 600, 30); g.clip(); g.drawImage(pic, 60, 214); g.restore();
  g.lineWidth = 6; g.strokeStyle = INK; rr(g, 60, 214, 780, 600, 30); g.stroke();
  // name, what he did
  const nameSize = Math.min(60, 760 / Math.max(1, font.measure(b.name, 1)));
  text(g, font, b.name, W / 2, 900, nameSize, INK, { align: 'center' });
  const lines = [];
  let cur = '';
  for (const ch of b.note) {
    if (cur && font.measure(cur + ch, 34) > 740) { lines.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => text(g, font, l, W / 2, 962 + i * 48, 34, '#4a5570', { align: 'center' }));
  text(g, font, `圖鑑 ${have} / ${total}`, 80, H - 66, 30, NAVY);
  text(g, font, 'hammerlee.tw 跟川伯聊天', W - 80, H - 66, 30, NAVY, { align: 'right' });
  return cv;
}
