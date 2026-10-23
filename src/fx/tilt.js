// 立體視角: tilt the phone (or move the mouse on a computer) and the chat answers like a real little 3D
// diorama under glass — the camera's lean, the shading light and the shadows all shift a touch.
// Phones report orientation; iPhones ask permission first, which must come from a tap (the settings switch).
import { SHADE_DIR } from '../engine/toon.js';

const BASE_SHADE = SHADE_DIR.clone();

export class Tilt {
  constructor(stage) {
    this.stage = stage;
    this.on = false;
    this.target = { x: 0, y: 0 };    // -1..1 each
    this.cur = { x: 0, y: 0 };
    this.base = null;                 // the orientation people hold the phone at
    this.baseShadow = stage.shadowDir.clone();
    this.onOrient = e => {
      if (e.beta == null || e.gamma == null) return;
      if (!this.base) this.base = { b: e.beta, g: e.gamma };
      // drift the resting angle toward how the phone is held, so only small moves show
      this.base.b += (e.beta - this.base.b) * 0.01;
      this.base.g += (e.gamma - this.base.g) * 0.01;
      this.target.x = clamp((e.gamma - this.base.g) / 22);
      this.target.y = clamp((e.beta - this.base.b) / 22);
      this.gotMotion = true;
    };
    this.onPointer = e => {
      if (this.gotMotion || e.pointerType === 'touch') return;
      this.target.x = clamp((e.clientX / innerWidth - 0.5) * 2);
      this.target.y = clamp((e.clientY / innerHeight - 0.5) * 2);
    };
  }

  static supported() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window; }

  // call from a tap. Resolves to 'on' | 'denied' | 'pointer-only'
  async enable() {
    let state = 'on';
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try { state = (await DOE.requestPermission()) === 'granted' ? 'on' : 'denied'; } catch (e) { state = 'denied'; }
    }
    if (state === 'on' && DOE) addEventListener('deviceorientation', this.onOrient);
    addEventListener('pointermove', this.onPointer, { passive: true });
    this.on = true;
    this.base = null;
    if (state === 'denied') return 'pointer-only';
    return state;
  }

  disable() {
    removeEventListener('deviceorientation', this.onOrient);
    removeEventListener('pointermove', this.onPointer);
    this.on = false;
    this.target.x = this.target.y = 0;
  }

  // ease toward the target and push it into the camera, the band light and the sun
  update(dt) {
    const k = 1 - Math.exp(-dt * 5);
    this.cur.x += (this.target.x - this.cur.x) * k;
    this.cur.y += (this.target.y - this.cur.y) * k;
    const { x, y } = this.cur;
    if (!this.on && Math.abs(x) + Math.abs(y) < 1e-3) return false;
    const st = this.stage;
    st.rig.shear.x += x * 0.16;
    st.rig.shear.y += y * 0.12;
    SHADE_DIR.copy(BASE_SHADE).add({ x: -x * 0.35, y: 0, z: -y * 0.3 }).normalize();
    st.shadowDir.copy(this.baseShadow).add({ x: -x * 0.6, y: 0, z: -y * 0.5 }).normalize();
    return true;
  }
}

function clamp(v) { return Math.max(-1, Math.min(1, v)); }
