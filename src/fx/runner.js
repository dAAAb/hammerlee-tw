// Mini 川哥 hurrying across the chat now and then — hammer in hand, shovel on his shoulder, busy going to
// build the next thing. He runs over the bubbles (hopping up onto them), sometimes trips and loses his hard
// hat, picks it up and runs on. Tap him and he jumps, then hurries off again. Tap 川伯's avatar and he comes.
import * as THREE from 'three';

const BUBBLE_KINDS = { text: 0.55, card: 0.45, photo: 0.42, elder: 0.42, date: 0.28, end: 0.28 };
const BLOCKING = new Set(['sticker', 'badge', 'cover']);

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
  }

  // a new topic starts: often he dashes off to build it
  topic() { if (this.state === 'off' && Math.random() < 0.55) this.cool = Math.min(this.cool, 0.8 + Math.random() * 1.6); }
  summon() { if (this.state === 'off') this.start({ from: -1, z: null, trip: false, hop: true }); else this.jump(); }

  start({ from = Math.random() < 0.5 ? -1 : 1, z = null, trip = !this.calm && Math.random() < 0.32, hop = false } = {}) {
    const st = this.app.stage, lay = this.app.layout;
    const half = st.viewW / 2 + 2.5;
    // a lane in the middle band of the screen that crosses no sticker
    const tz = st.rig.target.z;
    let lane = z;
    for (let k = 0; lane == null && k < 12; k++) {
      const cand = tz - (Math.random() * 0.45 - 0.12) * st.viewH;
      if (!lay.items.some(it => BLOCKING.has(it.kind) && cand > it.z - 2 && cand < it.z + it.h + 1.5)) lane = cand;
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
    this.state = 'run';
    this.c.play('run');
    this.c.setFacing(this.dir > 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42);
    this.g.visible = true;
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
  hit(raycaster) {
    if (!this.g.visible) return false;
    const h = raycaster.intersectObject(this.g, true)[0];
    if (!h) return false;
    this.jump();
    return true;
  }

  update(dt) {
    const c = this.c;
    if (this.state === 'off') {
      this.cool -= dt;
      if (this.cool <= 0 && !this.app.ended && this.app.intro.done) { this.start(); if (this.state === 'off') this.cool = 4; }
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
        this.state = 'trip';
        c.play('trip', { onDone: () => { this.state = 'run'; c.play('run'); } });
        setTimeout(() => this.sfx('bonk'), 380);
      } else if (f > this.hopAt) {
        this.hopAt = 2;
        this.jump();
      }
      if ((this.dir > 0 && this.x > this.endX) || (this.dir < 0 && this.x < this.endX)) {
        this.state = 'off';
        this.g.visible = false;
        this.cool = 16 + Math.random() * 18;
        return;
      }
    } else if (this.state === 'trip') {
      this.x += this.dir * (c.speed || 0) * dt;         // the stumble carries him forward a bit
    } else if (this.state === 'jump') {
      this.jumpLeft -= dt;
      if (this.jumpLeft <= 0) { this.state = 'run'; c.setFacing(this.dir > 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42); }
    }
    const target = this.floorAt(this.x, this.lane);
    this.y += (target - this.y) * Math.min(1, dt * 14);
    this.g.position.set(this.x, this.y, this.lane);
  }
}
