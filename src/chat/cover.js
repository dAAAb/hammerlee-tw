// The cover at the top of the chat: the campaign's arch logo standing as 3D bars (the three tall navy ones in
// the middle are 川), a big extruded title and a subtitle. The intro camera swings past it in 3/4 view.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';
import { roundRect, slabFromShape } from './shapes.js';
import { CONFIG } from '../config.js';

const BAR_COLS = ['blue', 'blue', 'blue', 'teal', 'yellow', 'navy', 'navy', 'navy', 'yellow', 'teal', 'blue', 'blue', 'blue'];

export function buildCover(font, W) {
  const g = new THREE.Group();
  // logo bars on an arch, standing up
  const bars = new THREE.Group();
  for (let i = -6; i <= 6; i++) {
    const a = Math.abs(i) / 6;
    const h = 0.35 + (Math.abs(i) <= 1 ? 3.4 - Math.abs(i) * 0.45 : 2.6 * Math.max(0, 1 - Math.pow(a, 1.1)) + 0.25);
    const geo = new THREE.BoxGeometry(0.42, h, 0.42);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, toon(BAR_COLS[i + 6]));
    m.position.set(i * 0.78, 0, 2.6 - 0.9 * a * a);
    m.rotation.y = -i * 0.05;
    m.castShadow = true;
    m.userData.h = h;
    bars.add(m);
  }
  g.add(bars);
  // title plate + letters
  const title = '跟川伯聊天', size = 2.25;
  const tw = font.measure(title, size);
  const plateW = tw + 1.6, plateH = 3.4;
  const plate = new THREE.Mesh(slabFromShape(roundRect(plateW, plateH, 1.0), 0.5), toon('white', { receive: 0.4 }));
  plate.position.set(-plateW / 2, 0, 3.6);
  plate.castShadow = true; plate.receiveShadow = true;
  g.add(plate);
  const items = [];
  let pen = -tw / 2;
  for (const ch of title) { items.push({ ch, x: pen, z: 3.6 + 2.45, size, depth: 0.55, y: 0.5 }); pen += font.advance(ch) * size; }
  const tgeo = font.build(items);
  if (tgeo) {
    const t = new THREE.Mesh(tgeo, toon({ l: '#ffc105', m: '#163c84', d: '#0b2152' }, { top: '#ffc105', text: true }));
    t.castShadow = true;
    g.add(t);
  }
  // subtitle
  const sub = '新北市長候選人 李四川 陪你話家常', ss = 0.74, sw = font.measure(sub, ss);
  const sitems = [];
  pen = -sw / 2;
  for (const ch of sub) { sitems.push({ ch, x: pen, z: 7.95, size: ss, depth: 0.12, y: 0 }); pen += font.advance(ch) * ss; }
  const sgeo = font.build(sitems);
  if (sgeo) g.add(new THREE.Mesh(sgeo, toon('text', { top: '#163c84', text: true })));
  // the conversation is written from his public statements, and says so up front
  const note = '模擬對話・內容依據川伯的公開政見與經歷整理', ns = 0.46, nw = font.measure(note, ns);
  const nitems = [];
  pen = -nw / 2;
  for (const ch of note) { nitems.push({ ch, x: pen, z: 8.95, size: ns, depth: 0.06, y: 0 }); pen += font.advance(ch) * ns; }
  const ngeo = font.build(nitems);
  if (ngeo) g.add(new THREE.Mesh(ngeo, toon('text', { top: '#5d6f92', text: true })));
  // and who made it
  const cs = 0.4, cw = font.measure(CONFIG.credit, cs), citems = [];
  pen = -cw / 2;
  for (const ch of CONFIG.credit) { citems.push({ ch, x: pen, z: 9.6, size: cs, depth: 0.05, y: 0 }); pen += font.advance(ch) * cs; }
  const cgeo = font.build(citems);
  if (cgeo) g.add(new THREE.Mesh(cgeo, toon('text', { top: '#7d8aa6', text: true })));
  g.userData.tick = t => {
    bars.children.forEach((b, k) => { b.scale.y = 1 + Math.sin(t * 2.2 - k * 0.45) * 0.06; });
  };
  g.userData.size = { w: Math.max(plateW, 11), h: 10.4 };
  return g;
}
