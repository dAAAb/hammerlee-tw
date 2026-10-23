// Bench: six badges from six ids. ?iso=1 for the 3/4 view, ?n=1 for one big badge.
import { bench, params } from './harness.js';
import { makeBadge, ensureEnvironment } from '../models/badge.js';

const b = await bench();
await ensureEnvironment(b.stage.renderer, b.stage.scene);
const ids = ['A1B2C3', '9FD2CB95D8867B37', '2542A3B7DF4522', '29D61ECDBA73C8', 'FFEE0011', '1234ABCD5678'];
const n = +params.get('n') || 6;
ids.slice(0, n).forEach((id, i) => {
  const m = makeBadge(id, b.font);
  const x = n === 1 ? 0 : (i % 2) * 8.6 - 4.3, z = n === 1 ? 0 : Math.floor(i / 2) * 11 - 11;
  m.position.set(x, 0, z);
  b.add(m);
  b.onUpdate((dt, t) => m.userData.tick(t + i));
  if (n > 1) b.label(m.userData.spec.shape + ' ' + m.userData.spec.emblem, x, z + 6.2, 0.55);
});
