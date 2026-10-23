// Bench page for the inline emoji, the 小新 mascot poses and the 'me' stickers.
// Build: node tools/build.mjs --dev --entry src/dev/emoji-gallery.js --out dist/emoji-gallery.html
// URL params (besides harness.js ones): show=emoji|bubbles|mascot|stickers frames one group (default: emoji),
// only=heart,smile,... limits the emoji grid, cols=N grid columns.
import * as THREE from 'three';
import { bench, params } from './harness.js';
import { makeEmoji, EMOJI_NAMES } from '../models/emoji.js';
import { createMascot, setMascotPose, MASCOT_POSES } from '../models/mascot.js';
import { createMeSticker, ME_STICKER_IDS } from '../models/stickers-me.js';
import { toon } from '../engine/toon.js';
import { layoutText } from '../text/layout.js';
import { bubbleShape, slabFromShape } from '../chat/shapes.js';

const B = await bench();
const { font, stage } = B;
const ticks = [];
const track = o => { if (o.userData.tick) ticks.push(o.userData.tick); return o; };
const centers = {};

// ---------------------------------------------------------------- emoji grid at true inline size
const names = params.get('only') ? params.get('only').split(',') : EMOJI_NAMES;
const COLS = +params.get('cols') || 5, CW = 3.4, CH = 2.6;
const x0 = -(COLS - 1) / 2 * CW;
let z = 0;
names.forEach((n, i) => {
  const x = x0 + (i % COLS) * CW, zz = z + Math.floor(i / COLS) * CH;
  const e = track(B.add(makeEmoji(n)));
  e.position.set(x, 0, zz);
  B.label(n, x, zz + 1.15, 0.45);
});
const rows = Math.ceil(names.length / COLS);
centers.emoji = new THREE.Vector3(0, 0, z + (rows - 1) * CH / 2 + 0.3);
z += rows * CH + 1.5;

// ---------------------------------------------------------------- emoji inline in real chat bubbles
const T = 0.55, PAD = 0.62;
function bubble(text, side, x, zTop) {
  const L = layoutText(font, text, 11, 1);
  const w = L.w + PAD * 2, h = L.h + PAD * 1.2;
  const g = new THREE.Group();
  const slabM = new THREE.Mesh(slabFromShape(bubbleShape(w, h, side), T), toon(side === 'left' ? 'white' : 'green', { receive: 0.5 }));
  slabM.castShadow = true; slabM.receiveShadow = true;
  g.add(slabM);
  const items = [];
  L.lines.forEach((line, i) => {
    const base = PAD * 0.6 + i * L.lineH + (L.lineH - 1) / 2 + 0.86;
    const mid = PAD * 0.6 + i * L.lineH + L.lineH / 2;
    for (const it of line.items) {
      if (it.t === 'ch') items.push({ ch: it.ch, x: PAD + it.x, z: base, size: 1, depth: 0.2, y: T });
      else if (it.t === 'emoji') { const e = track(makeEmoji(it.name)); e.position.set(PAD + it.x + it.w / 2, T, mid); g.add(e); }
    }
  });
  const geo = font.build(items);
  if (geo) { const tm = new THREE.Mesh(geo, toon('text', { top: '#1c2442', text: true })); tm.castShadow = true; g.add(tm); }
  g.position.set(side === 'left' ? x : x - w, 0, zTop);
  B.add(g);
  return h;
}
const bz0 = z;
const chunk = 9;
for (let i = 0; i < EMOJI_NAMES.length; i += chunk) {
  const part = EMOJI_NAMES.slice(i, i + chunk).map(n => `[${n}]`);
  const txt = (i / chunk) % 2 ? '好期待' + part.join('') : '說實在' + part.slice(0, 4).join('') + '真的很高興' + part.slice(4).join('');
  z += bubble(txt, (i / chunk) % 2 ? 'right' : 'left', (i / chunk) % 2 ? 8.4 : -8.2, z) + 0.6;
}
centers.bubbles = new THREE.Vector3(0, 0, (bz0 + z) / 2);
z += 2;

// ---------------------------------------------------------------- mascot poses
const poses = MASCOT_POSES.filter(p => p !== 'idle');
const MC = 4.8, MR = 5.4, mcols = 3;
const mz0 = z;
poses.forEach((p, i) => {
  const x = -(mcols - 1) / 2 * MC + (i % mcols) * MC, zz = z + 1.4 + Math.floor(i / mcols) * MR;
  const m = createMascot();
  setMascotPose(m, p);
  m.position.set(x, 0, zz);
  track(B.add(m));
  B.label(p, x, zz + 1.6, 0.5);
});
z += Math.ceil(poses.length / mcols) * MR + 1;
centers.mascot = new THREE.Vector3(0, 0, (mz0 + z) / 2 - 0.5);

// ---------------------------------------------------------------- 'me' stickers
const SC = 6.4, SR = 6.6, scols = 2;
const sz0 = z;
ME_STICKER_IDS.forEach((id, i) => {
  const x = -(scols - 1) / 2 * SC + (i % scols) * SC, zz = z + 2.6 + Math.floor(i / scols) * SR;
  const s = createMeSticker(id, font);
  s.position.set(x, 0, zz);
  track(B.add(s));
  B.label(id, x, zz + 2.9, 0.45);
  const k = +params.get('pop');
  if (params.has('pop')) s.userData.pop(k);
});
z += Math.ceil(ME_STICKER_IDS.length / scols) * SR + 1;
centers.stickers = new THREE.Vector3(0, 0, (sz0 + z) / 2 - 0.5);

// ---------------------------------------------------------------- frame the requested group
const show = params.get('show') || 'emoji';
if (!params.has('z') && centers[show]) {
  stage.rig.target.set(+params.get('x') || 0, 0, centers[show].z);
  stage.applyRig();
}
B.onUpdate((dt, t) => { for (const f of ticks) f(t, dt); });
window.__centers = centers;
