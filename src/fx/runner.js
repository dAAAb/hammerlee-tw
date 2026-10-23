// Mini 川哥 hurrying across the chat now and then — hammer in hand, shovel on his shoulder, busy going to
// build the next thing. He runs over the bubbles (hopping up onto them), sometimes trips and loses his hard
// hat, picks it up and runs on. Tap him and he jumps, then hurries off again. Tap 川伯's avatar and he comes.
//
// 兩支手機一起玩 (net/pair.js sets `link`): with a partner phone lying beside this one, he runs toward it, past
// the edge, and the partner lets him run in from its own edge in the same stride; next time he runs back.
import * as THREE from 'three';

const BUBBLE_KINDS = { text: 0.55, card: 0.45, photo: 0.42, elder: 0.42, date: 0.28, end: 0.28 };
const BLOCKING = new Set(['sticker', 'badge', 'cover']);
const GAP_PX = 60;   // the bezels between two phones lying side by side, in CSS px (about 1 cm)

export class Runner {
  constructor(app, createChuan, { calm = false, sfx = () => {} } = {}) {
    this.app = app;
    this.calm = calm;
    this.sfx = sfx;
    this.c = createChuan({ hat: true, tools: true });
    this.g = this.c.group;
    this.g.visible = false;
    this.g.scale.setScalar(0.92);
    this.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    app.stage.scene.add(this.g);
    this.state = 'off';
    this.cool = 7;              // seconds until the first run
    this.y = 0;
    this.ray = new THREE.Raycaster();
    this.link = null;
  }

  // the partner phone, when it is there, awake, and we know which side it lies on
  get partner() { return this.link?.active ? this.link : null; }

  // a new topic starts: often he dashes off to build it
  topic() { if (this.state === 'off' && Math.random() < 0.55) this.cool = Math.min(this.cool, 0.8 + Math.random() * 1.6); }
  summon() {
    const P = this.partner;
    if (P && !P.mine && this.state === 'off') { P.call(); return; }   // he is on the other phone: call him over
    if (this.state === 'off') this.start({ from: P ? -P.side : -1, z: null, trip: false, hop: true }); else this.jump();
  }
  // the partner phone called him (or pairing just finished): run over soon
  called(delay = 0) { if (this.state === 'off') this.cool = Math.min(this.cool, delay); else this.soon = true; }

  laneFree(z) { return !this.app.layout.items.some(it => BLOCKING.has(it.kind) && z > it.z - 2 && z < it.z + it.h + 1.5); }
  runYaw() { return this.dir > 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42; }

  start({ from = this.partner ? -this.partner.side : Math.random() < 0.5 ? -1 : 1, z = null, trip = !this.calm && Math.random() < 0.32, hop = false } = {}) {
    const st = this.app.stage;
    const half = st.viewW / 2 + 2.5;
    // a lane in the middle band of the screen that crosses no sticker
    const tz = st.rig.target.z;
    let lane = z;
    for (let k = 0; lane == null && k < 12; k++) {
      const cand = tz - (Math.random() * 0.45 - 0.12) * st.viewH;
      if (this.laneFree(cand)) lane = cand;
    }
    if (lane == null) { this.cool = 6; return; }
    this.dir = -from;                         // from the left (-1) means running toward +x
    this.lane = lane;
    this.x = from * half;
    this.endX = -from * half;
    this.tripAt = trip ? (Math.random() * 0.5 + 0.25) : 2;
    this.hopAt = hop ? 0.3 : 2;
    this.dist = 0;
    this.total = half * 2;
    this.handed = this.tripped = this.soon = false;
    this.state = 'run';
    this.c.play('run');
    this.c.setFacing(this.runYaw());
    this.g.visible = true;
  }

  // He runs in over the seam from the partner phone, in the state he left it: same stride or stumble, same
  // height on screen (through the seam the swipe measured), a little further on for the time the message took.
  enter(s) {
    const st = this.app.stage, c = this.c, lag = this.link?.lag || 0;
    const from = -s.dir, edge = st.viewW / 2, half = edge + 2.5;
    const sy = Math.min(st.cssH * 0.78, Math.max(st.cssH * 0.14, this.link ? this.link.mapY(s.sy, s.H) : s.sy));
    let lane = st.pick(st.cssW / 2, sy, 0).z;
    for (let k = 1; !this.laneFree(lane) && k <= 8; k++) {
      const d = (k + 1 >> 1) * 1.5 * (k % 2 ? 1 : -1);
      if (this.laneFree(lane + d)) { lane += d; break; }
    }
    const inside = (s.px + s.v * lag - GAP_PX) / st.emPx;   // em past this screen's edge (< 0: still in the gap)
    this.dir = s.dir;
    this.lane = lane;
    this.x = from * edge + this.dir * inside;
    this.endX = -from * half;
    this.dist = 0;
    this.total = Math.abs(this.endX - this.x);
    this.tripped = s.tripped || s.pose === 'trip';
    this.tripAt = this.tripped || this.calm || Math.random() > 0.3 ? 2 : Math.random() * 0.45 + 0.25;
    this.hopAt = 2;
    this.handed = true;                       // running away from the seam now
    this.soon = false;
    this.y = s.h;
    c.play('run');
    if (s.pose === 'trip') this.trip(); else this.state = 'run';
    // pick up the stride (or the stumble) where it was on the other phone
    for (let t = Math.min(6, s.t + lag); t > 1e-3; t -= 0.1) c.update(Math.min(0.1, t));
    c.setFacing(Number.isFinite(s.facing) ? s.facing : this.runYaw());
    this.g.visible = true;
    this.g.position.set(this.x, this.y, this.lane);
  }

  trip() {
    this.state = 'trip';
    this.tripped = true;
    this.c.play('trip', { onDone: () => { this.state = 'run'; this.c.play('run'); } });
  }

  jump() {
    if (this.state !== 'run') return;
    this.state = 'jump';
    this.c.setFacing(0.0);
    this.c.play('jump');   // the rig goes back to running by itself when the hop ends
    this.sfx('boing');
    this.jumpLeft = (this.c.durations?.jump || 0.9) + 0.05;
  }

  // height of whatever is under (x, z): bubbles are low slabs he can run on
  floorAt(x, z) {
    for (const it of this.app.layout.items) {
      const h = BUBBLE_KINDS[it.kind];
      if (h == null || !this.app.revealed.has(this.app.layout.items.indexOf(it))) continue;
      if (x > it.x && x < it.x + it.w && z > it.z && z < it.z + it.h) return h;
    }
    return 0;
  }

  // tap test from the app (returns true when he was hit)
  hit(raycaster, at) {
    if (!this.g.visible) return false;
    if (!raycaster.intersectObject(this.g, true)[0] && !(at?.touch && this.near(at.x, at.y))) return false;
    this.jump();
    return true;
  }

  // fingers are blunt and he keeps running: on touch, anywhere close to his outline on screen counts
  near(x, y, pad = 24) {
    const b = (this.box ||= new THREE.Box3()).setFromObject(this.g), st = this.app.stage;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
      const p = st.worldToCss(new THREE.Vector3(cx, cy, cz));
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
  }

  update(dt) {
    const c = this.c, P = this.partner;
    if (this.state === 'off') {
      if (P && !P.mine) return;                 // he is over on the other phone
      this.cool -= dt;
      if (this.cool <= 0 && (!this.app.ended || P) && this.app.intro.done) { this.start(); if (this.state === 'off') this.cool = 4; }
      return;
    }
    c.update(dt);
    if (this.state === 'run') {
      const step = (c.speed || 4) * dt;
      this.x += this.dir * step;
      this.dist += step;
      const f = this.dist / this.total;
      if (f > this.tripAt) {
        this.tripAt = 2;
        this.trip();
        setTimeout(() => this.sfx('bonk'), 380);
      } else if (f > this.hopAt) {
        this.hopAt = 2;
        this.jump();
      }
      if ((this.dir > 0 && this.x > this.endX) || (this.dir < 0 && this.x < this.endX)) {
        this.state = 'off';
        this.g.visible = false;
        this.cool = P ? (this.soon ? 0.4 : 4 + Math.random() * 5) : 16 + Math.random() * 18;
        return;
      }
    } else if (this.state === 'trip') {
      this.x += this.dir * (c.speed || 0) * dt;         // the stumble carries him forward a bit
    } else if (this.state === 'jump') {
      this.jumpLeft -= dt;
      if (this.jumpLeft <= 0) { this.state = 'run'; c.setFacing(this.runYaw()); }
    }
    // past the edge that faces the partner phone: hand him over (he keeps running off this screen)
    const st = this.app.stage, edge = st.viewW / 2;
    if (P && !this.handed && this.dir === P.side && this.x * this.dir > edge) {
      this.handed = true;
      P.handoff({
        dir: this.dir, pose: this.state, t: c.time, px: (this.x * this.dir - edge) * st.emPx, v: (c.speed || 0) * st.emPx,
        sy: st.worldToCss(new THREE.Vector3(this.x, 0, this.lane)).y, H: st.cssH, h: this.y, facing: c.rig.facing.rotation.y,
        tripped: this.tripped,
      });
    }
    const target = this.floorAt(this.x, this.lane);
    this.y += (target - this.y) * Math.min(1, dt * 14);
    this.g.position.set(this.x, this.y, this.lane);
  }
}
