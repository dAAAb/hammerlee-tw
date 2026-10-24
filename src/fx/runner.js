// Mini 川哥 hurrying across the chat now and then — hammer in hand, shovel on his shoulder, busy going to
// build the next thing. He runs over the bubbles (hopping up onto them), sometimes trips and loses his hard
// hat, picks it up and runs on. Tap him and he jumps, then hurries off again. Tap 川伯's avatar and he comes.
//
// 多支手機一起玩 (net/pair.js sets `link`): with phones lying in a row, he runs past the edge toward the next phone
// and that phone lets him run in from its own edge in the same stride, on to the end of the row; then back —
// faster the more phones there are. And now and then he stops to build a little model (fx/builds.js).
import * as THREE from 'three';
import { BUILD_RATE } from './builds.js';

const BUBBLE_KINDS = { text: 0.55, card: 0.45, photo: 0.42, elder: 0.42, date: 0.28, end: 0.28 };
const BLOCKING = new Set(['sticker', 'badge', 'cover']);
const GAP_PX = 60;   // the bezels between two phones lying side by side, in CSS px (about 1 cm)

export class Runner {
  constructor(app, createChuan, { calm = false, sfx = () => {}, builds = null } = {}) {
    this.app = app;
    this.calm = calm;
    this.sfx = sfx;
    this.builds = builds;
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

  // the phone link, when an awake phone lies beside this one
  get partner() { return this.link?.active ? this.link : null; }

  // a new topic starts: often he dashes off to build it
  topic() { if (this.state === 'off' && Math.random() < 0.55) this.cool = Math.min(this.cool, 0.8 + Math.random() * 1.6); }
  summon() {
    const P = this.partner;
    if (P && !P.mine && this.state === 'off') { P.call(); return; }   // he is on another phone: call him over
    if (this.state === 'off') this.start({ from: P ? -this.heading() : -1, z: null, trip: false, hop: true }); else this.jump();
  }
  // another phone called him (or the row was just put together): run soon, toward `dir` if given
  called(delay = 0, dir = 0) {
    this.want = dir;
    if (this.state === 'off') this.cool = Math.min(this.cool, delay); else this.soon = true;
  }
  // which way to run: along the row, away from the end with no phone beyond it
  heading() {
    const P = this.partner;
    if (!P) return Math.random() < 0.5 ? -1 : 1;
    if (this.want && P.next(this.want)) return this.want;
    const r = !!P.next(1), l = !!P.next(-1);
    return r && !l ? 1 : l && !r ? -1 : Math.random() < 0.5 ? -1 : 1;
  }

  laneFree(z) { return !this.app.layout.items.some(it => BLOCKING.has(it.kind) && z > it.z - 2 && z < it.z + it.h + 1.5); }
  runYaw() { return this.dir > 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42; }
  // where along this run (as a share of it) he stops to build, if he does
  buildPoint() {
    const P = this.partner, share = P ? P.buildShare : this.link ? 0 : 1;
    return this.builds && Math.random() < BUILD_RATE * share ? 0.1 + Math.random() * 0.35 : 2;
  }

  start({ from = -this.heading(), z = null, trip = !this.calm && Math.random() < 0.32, hop = false } = {}) {
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
    this.buildAt = hop ? 2 : this.buildPoint();
    this.dist = 0;
    this.total = half * 2;
    this.handed = this.tripped = this.soon = false;
    this.want = 0;
    this.site = null;
    this.state = 'run';
    this.c.play('run');
    this.c.setFacing(this.runYaw());
    this.g.visible = true;
  }

  // He runs in over the seam from the phone beside this one, in the state he left it: same stride or stumble,
  // same height on screen (through the seam the swipe measured), a little further on for the time the message took.
  enter(s) {
    const st = this.app.stage, c = this.c, lag = s.lag || 0;
    const from = -s.dir, edge = st.viewW / 2, half = edge + 2.5;
    const sy = Math.min(st.cssH * 0.78, Math.max(st.cssH * 0.14, this.link ? this.link.mapY(s) : s.sy));
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
    this.buildAt = this.buildPoint();
    this.site = null;
    this.handed = false;                      // on to the next phone, if there is one that way
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

  // time to build: pick free floor ahead (fx/builds.js) and run on until he's beside it
  plan() {
    const at = this.builds?.spot(this.x, this.lane, this.dir);
    if (at) { this.site = at; this.siteX = at.x - this.dir * 1.25; }
  }
  // he stops, turns to us and digs; the model rises beside him, he gives a thumbs-up, runs on
  build() {
    const at = this.site;
    this.site = null;
    if (!this.builds?.begin(at)) return;
    this.state = 'build';
    this.buildT = 0;
    this.cheered = false;
    this.c.setFacing(0);
    this.c.setPose('shovelDig');
    this.sfx('dig');
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
    if (!this.under(raycaster, at)) return false;
    this.jump();
    return true;
  }
  // is he under this point (a finger gets a margin around him)?
  under(raycaster, at) {
    if (!this.g.visible) return false;
    return !!raycaster.intersectObject(this.g, true)[0] || !!(at?.touch && this.near(at.x, at.y));
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
    // linked phones: he runs faster (legs and all)
    const pace = P && this.state !== 'build' ? P.pace : 1, k = dt * pace;
    c.update(k);
    if (this.state === 'run') {
      const step = (c.speed || 4) * k;
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
      } else if (f > this.buildAt) {
        this.buildAt = 2;
        this.plan();
      } else if (this.site && (this.x - this.siteX) * this.dir >= 0) {
        this.build();
      }
      if ((this.dir > 0 && this.x > this.endX) || (this.dir < 0 && this.x < this.endX)) {
        this.state = 'off';
        this.g.visible = false;
        this.cool = P ? (this.soon ? 0.4 : 4 + Math.random() * 5) : 16 + Math.random() * 18;
        return;
      }
    } else if (this.state === 'trip') {
      this.x += this.dir * (c.speed || 0) * k;          // the stumble carries him forward a bit
    } else if (this.state === 'build') {
      this.buildT += dt;
      if (this.buildT > 1.9 && !this.cheered) { this.cheered = true; c.setPose('thumbsUp'); }
      if (this.buildT > 2.9) { this.state = 'run'; c.play('run'); c.setFacing(this.runYaw()); }
    } else if (this.state === 'jump') {
      this.jumpLeft -= k;
      if (this.jumpLeft <= 0) { this.state = 'run'; c.setFacing(this.runYaw()); }
    }
    // past an edge with a phone beyond it: hand him over (he keeps running off this screen). Only the phone that
    // holds him does; a 川哥 already running here when the row came together just runs off.
    const st = this.app.stage, edge = st.viewW / 2;
    if (P && P.mine && !this.handed && this.x * this.dir > edge && P.next(this.dir)) {
      this.handed = true;
      P.handoff(this.dir, {
        dir: this.dir, pose: this.state, t: c.time, px: (this.x * this.dir - edge) * st.emPx, v: (c.speed || 0) * pace * st.emPx,
        sy: st.worldToCss(new THREE.Vector3(this.x, 0, this.lane)).y, H: st.cssH, h: this.y, facing: c.rig.facing.rotation.y,
        tripped: this.tripped,
      });
    }
    const target = this.floorAt(this.x, this.lane);
    this.y += (target - this.y) * Math.min(1, dt * 14);
    this.g.position.set(this.x, this.y, this.lane);
  }
}
