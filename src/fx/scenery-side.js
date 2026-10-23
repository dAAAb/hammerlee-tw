import * as THREE from 'three';

// On wide screens, a little diorama about each topic pops up in the empty floor beside the chat, next to where
// that topic starts, and scrolls along with the conversation. Phones don't have the room, so they skip it.
const MAP = {
  nvidia: 'nvidia', ai: 'ai', medical: 'medical', tucheng: 'medical', rail: 'rail', mrt: 'rail', domecity: 'domecity', dome: 'domecity',
  urban: 'urban', housing: 'urban', seniorcard: 'senior', homecheck: 'senior', elevator: 'senior', teeth: 'senior', esports: 'senior',
  family: 'family', daycare: 'family', gender: 'family', edu: 'family', youth: 'family', tourism: 'tourism', sports: 'tourism',
  culture: 'tourism', hakka: 'tourism', indigenous: 'tourism', pets: 'pets',
};

export class SideScenery {
  constructor(app, createScenery) {
    this.app = app;
    this.create = createScenery;
    this.seen = new Set();
    this.items = [];          // { g, born, side }
    this.side = 1;
  }

  room() {
    const st = this.app.stage, colW = this.app.layout.W;
    return (st.viewW - colW) / 2;      // em of free floor on each side
  }

  // called when a chat item appears
  reveal(it) {
    const topic = it.msg?.topic || it.topic;
    if (!topic || this.seen.has(topic) || !this.create) return;
    const id = MAP[topic];
    if (!id) return;
    this.seen.add(topic);
    const room = this.room();
    if (room < 5.5) return;                        // phones: no space beside the chat
    const g = this.create(id) || this.create('default');
    if (!g) return;
    const holder = new THREE.Group();   // our placement and size; the diorama animates itself inside
    holder.add(g);
    holder.scale.setScalar(Math.max(0.6, Math.min(1.25, (room - 0.8) / 8)));   // dioramas are ~8 em across
    const lay = this.app.layout;
    const x = this.side * (lay.W / 2 + Math.min(room, 14) / 2 + 0.2);
    this.side = -this.side;
    holder.position.set(x, 0, it.z + 3.5);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.app.stage.scene.add(holder);
    this.items.push({ g, holder, born: this.app.time });
    g.userData.pop?.(0);
  }

  update(dt) {
    const t = this.app.time, tz = this.app.stage.rig.target.z, vh = this.app.stage.viewH;
    for (const s of this.items) {
      const k = Math.min(1, (t - s.born) / 1.4);
      if (k < 1 || !s.done) { s.g.userData.pop?.(k); s.done = k >= 1; }
      const near = Math.abs(s.holder.position.z - tz) < vh;
      s.holder.visible = near;
      if (near) s.g.userData.tick?.(t, dt);
    }
  }

  // a relayout (resize, 大字) moves the chat: drop the dioramas, they reappear for the next topics
  reset() {
    for (const s of this.items) this.app.stage.scene.remove(s.holder);
    this.items = [];
    this.seen.clear();
  }
}
