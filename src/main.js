import * as THREE from 'three';
import { Stage } from './engine/stage.js';
import { toon, floorMaterial } from './engine/toon.js';
import { GlyphFont } from './text/font.js';
import { layoutText } from './text/layout.js';
import { bubbleShape, slabFromShape } from './chat/shapes.js';

const canvas = document.getElementById('stage');
const stage = new Stage(canvas);
const font = await GlyphFont.load('glyphs.bin');

const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), floorMaterial());
floor.receiveShadow = true;
stage.scene.add(floor);

const T = 0.55, PAD = 0.62;
function bubble(text, side, x, z) {
  const L = layoutText(font, text, 11, 1);
  const w = L.w + PAD * 2, h = L.h + PAD * 1.2;
  const g = new THREE.Group();
  const slab = new THREE.Mesh(slabFromShape(bubbleShape(w, h, side), T), toon(side === 'left' ? 'white' : 'green', { receive: 0.5 }));
  slab.castShadow = true; slab.receiveShadow = true;
  g.add(slab);
  const items = [];
  L.lines.forEach((line, i) => {
    const base = -(PAD * 0.6 + i * L.lineH + (L.lineH - 1) / 2 + 0.86);
    for (const it of line.items) if (it.t === 'ch') items.push({ ch: it.ch, x: PAD + it.x, z: -base, size: 1, depth: 0.2, y: T });
  });
  const geo = font.build(items);
  if (geo) {
    const tm = new THREE.Mesh(geo, toon('text', { top: '#1c2442', text: true }));
    tm.castShadow = true;
    g.add(tm);
  }
  g.position.set(side === 'left' ? x : x - w, 0, z);
  stage.scene.add(g);
  return h;
}

let z = -10;
z += bubble('說實在，輝達的海外總部能夠落腳台北，我心裡真的很高興[heart]', 'left', -6.2, z) + 0.6;
z += bubble('哇～好期待黃仁勳也來新北市！', 'right', 8, z) + 0.6;
z += bubble('交給我！新北的下一段路，我知道怎麼鋪。AI 科技之都，一件一件做。', 'left', -6.2, z) + 0.6;

stage.rig.target.set(0, 0, 0);
stage.setEmPx(22);
document.getElementById('boot').classList.add('gone');
addEventListener('resize', () => { stage.resize(); });
function loop() { stage.render(); requestAnimationFrame(loop); }
loop();
