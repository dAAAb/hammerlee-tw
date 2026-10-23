// Bench: the same two bubbles with the old letter look (left) and the new one (right), at 2x size.
import { bench } from './harness.js';
import { layoutChat } from '../chat/layout.js';
import { Builder, textLook } from '../chat/objects.js';

const b = await bench();
const msgs = [
  { kind: 'text', who: 'chuan', text: '說實在，我是做工程的人，做了四十年，路、橋、捷運都蓋過[hammer]', topic: 'x' },
  { kind: 'text', who: 'me', text: '台灣之光！川伯也是新北之光[star]', topic: 'x' },
];
const lay = layoutChat({ id: 'lab', msgs }, b.font, { viewW: 17 });
const builder = new Builder({ font: b.font });
for (const [dx, look] of [[-9, { depth: 0.2, shadow: true }], [9, { depth: 0.12, shadow: false }]]) {
  Object.assign(textLook, look);
  for (const it of lay.items) {
    const rec = builder.build(it);
    if (!rec) continue;
    rec.enter(1);
    rec.group.position.x += dx;
    b.add(rec.group);
  }
}
b.label('修改前', -9, -1.2, 0.8);
b.label('修改後', 9, -1.2, 0.8);
b.stage.rig.target.set(0, 0, 4.5);
b.stage.applyRig();
