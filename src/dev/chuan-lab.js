// Bench for mini 川哥 (src/models/chuan.js), his avatar and his stickers.
//   node tools/build.mjs --dev --entry src/dev/chuan-lab.js --out dist/chuan-lab.html
//   chuan-lab.html?show=poses|stickers|run|trip|avatar   (+ harness params: emPx, x, z, t, iso=1)
// Extra params: only=wave,bow (poses/stickers subset), cols=N, tools=0, face=grin, m=walk (show=run),
// lead=0.5 (seconds of running before the trip), yaw=90 (trip/run facing, degrees), live=1 (keep animating
// after a ?t= jump; by default a ?t= shot freezes on that frame).
import * as THREE from 'three';
import { bench, params } from './harness.js';
import { createChuan, SPEEDS } from '../models/chuan.js';
import { createChuanAvatar, createChuanHead } from '../models/chuan-avatar.js';
import { createChuanSticker, CHUAN_STICKER_IDS } from '../models/stickers-chuan.js';
import { POSES } from '../models/catalog.js';

const B = await bench();
const show = params.get('show') || 'poses';
const freeze = params.has('t') && !params.has('live');
let warm = true;
const tick = (fn) => B.onUpdate((dt, t) => { if (freeze && !warm) return; fn(dt, t); });
const only = params.get('only') ? params.get('only').split(',') : null;
const target = (x, z) => {
  if (!params.has('x')) B.stage.rig.target.x = x;
  if (!params.has('z')) B.stage.rig.target.z = z;
  B.stage.applyRig();
};

if (show === 'poses') {
  const list = only || POSES;
  const cols = +params.get('cols') || Math.min(4, list.length), dx = 4.4, dz = 5.4;
  const rows = Math.ceil(list.length / cols);
  list.forEach((name, i) => {
    const c = createChuan({ tools: params.get('tools') !== '0' });
    const x = (i % cols - (cols - 1) / 2) * dx, z = Math.floor(i / cols) * dz;
    c.group.position.set(x, 0, z);
    const v = params.get('face') ? { face: params.get('face') } : {};
    if (name.startsWith('face:')) { c.setPose('idle'); c.setFace(name.slice(5)); }
    else c.setPose(name, 1, v);
    B.add(c.group);
    B.label(name, x, z + 1.75, 0.5);
    tick((dt) => c.update(dt));
  });
  target(1.2, (rows - 1) * dz / 2 - 1.0);
}

if (show === 'stickers') {
  const list = only || CHUAN_STICKER_IDS;
  const cols = +params.get('cols') || Math.min(3, list.length), dx = 5.8, dz = 6.9;
  const rows = Math.ceil(list.length / cols);
  list.forEach((id, i) => {
    const s = createChuanSticker(id, B.font);
    const x = (i % cols - (cols - 1) / 2) * dx, z = Math.floor(i / cols) * dz;
    s.position.set(x, 0, z);
    B.add(s);
    const delay = params.has('pop') ? i * 0.12 : -1;
    tick((dt, t) => {
      s.userData.tick(t, dt);
      if (delay >= 0) s.userData.pop(Math.min(1, Math.max(0, (t - delay) / 0.7)));
    });
  });
  target(1.2, (rows - 1) * dz / 2 - 1.2);
}

if (show === 'run' && !params.has('sheet')) {
  // running (or walking) across the view, moved by the motion's own speed; tap-jump every few seconds
  const m = params.get('m') || 'run';
  const lanes = m === 'all' ? ['walk', 'run'] : [m];
  lanes.forEach((name, i) => {
    const c = createChuan();
    const yaw = (+params.get('yaw') || 90) * Math.PI / 180;
    c.setFacing(yaw);
    c.play(name);
    const z = i * 4.5, span = 8;
    let x = -span, tj = 0;
    c.group.position.set(x, 0, z);
    B.add(c.group);
    tick((dt) => {
      c.update(dt);
      x += c.speed * dt * Math.sin(yaw);
      if (x > span) x -= 2 * span;
      c.group.position.x = x;
      tj += dt;
      if (params.has('jump') && tj > 2.2) { tj = 0; c.play('jump'); }
    });
  });
  target(0, (lanes.length - 1) * 2.25 - 1.2);
}

if ((show === 'trip' || show === 'run') && params.has('sheet')) {
  // contact sheet: one frozen copy per time, two columns. show=trip: trip time after `lead` s of running;
  // show=run&m=walk|run|idle: motion time; show=run&m=jump: jump time after `lead` s of running
  const times = params.get('sheet').split(',').map(Number);
  const motion = show === 'trip' ? 'trip' : (params.get('m') || 'run');
  const lead = params.has('lead') ? +params.get('lead') : 0.3;
  const W = 9.5, H = 5.2, cols = 2;
  times.forEach((T, i) => {
    const cell = new THREE.Group();
    cell.position.set((i % cols - 0.5) * W, 0, Math.floor(i / cols) * H);
    B.add(cell);
    const c = createChuan();
    c.setFacing(Math.PI / 2);
    c.group.position.set(motion === 'trip' ? -4.4 : -1.2 - SPEEDS[motion === 'jump' ? 'run' : motion] * (motion === 'jump' ? lead : T), 0, 0);
    cell.add(c.group);
    const delayed = motion === 'trip' || motion === 'jump';
    c.play(delayed ? 'run' : motion);
    let tt = 0, started = !delayed;
    const dt = 1 / 60;
    for (let k = 0; k < Math.round(((delayed ? lead : 0) + T) * 60); k++) {
      c.update(dt);
      c.group.position.x += c.speed * dt;
      tt += dt;
      if (!started && tt >= lead - 1e-6) { started = true; c.play(motion); }
    }
    B.label(T.toFixed(2), cell.position.x - 3.4, cell.position.z + 1.3, 0.55);
  });
  target(0, (Math.ceil(times.length / cols) - 1) * H / 2 - 0.8);
} else if (show === 'trip') {
  const c = createChuan();
  const yaw = (params.has('yaw') ? +params.get('yaw') : 80) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const lead = params.has('lead') ? +params.get('lead') : 0.5;
  const start = new THREE.Vector3(-4.6, 0, -0.6);
  c.setFacing(yaw);
  B.add(c.group);
  let state = 'run', tt = 0;
  const begin = () => { c.group.position.copy(start); c.play('run'); state = 'run'; tt = 0; };
  begin();
  tick((dt) => {
    c.update(dt);
    c.group.position.addScaledVector(dir, c.speed * dt);
    tt += dt;
    if (state === 'run' && tt >= lead) { state = 'trip'; c.play('trip', { onDone: () => { state = 'after'; tt = 0; } }); }
    if (state === 'after' && tt > 0.7) begin();
  });
  target(0.6, -0.8);
}

if (show === 'avatar') {
  // the profile coin at a few sizes, his bare head, and a standing figure for scale
  const a = createChuanAvatar();
  a.position.set(-3.2, 0, 0);
  B.add(a);
  const a2 = createChuanAvatar();
  a2.position.set(1.0, 0, 0.2);
  a2.scale.setScalar(2);
  B.add(a2);
  const h = createChuanHead();
  h.position.set(-3.2, 0, 3.2);
  B.add(h);
  const c = createChuan();
  c.setPose('idle');
  c.group.position.set(-0.4, 0, 4.6);
  B.add(c.group);
  const h2 = createChuanHead();
  h2.position.set(2.6, 0, 4.4);
  h2.scale.setScalar(1.6);
  B.add(h2);
  tick((dt, t) => { a.userData.tick(t); a2.userData.tick(t); c.update(dt); });
  target(-0.3, 0.8);
}

warm = false;
