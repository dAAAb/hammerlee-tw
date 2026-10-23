// The stage: renderer, an oblique orthographic camera, the shadow light and the hand-ink post pass.
//
// Camera model. World units are "em" (one em = the chat font size). The chat lies on the floor plane y = 0,
// newer messages further toward +z (screen-down). In reading view the camera looks straight down, so text on
// top of a bubble is drawn undistorted, and a shear in view space pushes anything with height up-left on
// screen: every slab, glyph and figure shows its bottom and right walls like a cabinet drawing. The intro
// swings the same rig from a 3/4 isometric view down into the reading view.
import * as THREE from 'three';
import { INK } from './toon.js';

THREE.ColorManagement.enabled = false;

const tmpM = new THREE.Matrix4();

export class ObliqueCamera extends THREE.OrthographicCamera {
  constructor() {
    super(-10, 10, 10, -10, 0.1, 400);
    this.shear = new THREE.Vector2(-0.22, 0.72);
    this.focusDist = 100;
  }
  updateProjectionMatrix() {
    super.updateProjectionMatrix();
    if (!this.shear) return;
    const { x: kx, y: ky } = this.shear, D = this.focusDist;
    // view space: x' = x + kx (z + D), y' = y + ky (z + D) -> the focus plane stays put, nearer things shift
    tmpM.set(1, 0, kx, kx * D, 0, 1, ky, ky * D, 0, 0, 1, 0, 0, 0, 0, 1);
    this.projectionMatrix.multiply(tmpM);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

const inkVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const inkFrag = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float inkW;
uniform float silT;
uniform float creaseT;
uniform vec3 inkColor;
uniform float grain;
uniform float seed;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float lin(vec2 uv){ return texture2D(tDepth, uv).x * (far - near) + near; }
void main(){
  vec2 px = vUv / texel;
  // hand-drawn wobble: the ink is looked up through a slow, slightly lumpy displacement
  vec2 wob = vec2(vnoise(px * 0.045 + seed), vnoise(px * 0.045 + seed + 17.0)) - 0.5;
  vec2 uv = vUv + wob * texel * 1.6;
  float w = inkW * (0.85 + 0.35 * vnoise(px * 0.02 + seed * 3.0));
  vec2 ox = vec2(texel.x * w, 0.0), oy = vec2(0.0, texel.y * w);
  float d0 = lin(uv);
  float dl = lin(uv - ox), dr = lin(uv + ox), dd = lin(uv - oy), du = lin(uv + oy);
  float dl2 = lin(uv - ox - oy), dr2 = lin(uv + ox + oy), dd2 = lin(uv + ox - oy), du2 = lin(uv - ox + oy);
  // silhouettes: a jump in depth to a neighbour that is clearly in front of us (draw the line on the far side)
  float sil = max(max(d0 - dl, d0 - dr), max(d0 - dd, d0 - du));
  sil = max(sil, 0.7 * max(max(d0 - dl2, d0 - dr2), max(d0 - dd2, d0 - du2)));
  // creases: a kink in depth (where a flat top meets a wall)
  float cr = max(abs(dl + dr - 2.0 * d0), abs(dd + du - 2.0 * d0));
  float e = smoothstep(silT, silT * 1.8, sil);
  e = max(e, 0.85 * smoothstep(creaseT, creaseT * 2.2, cr));
  vec4 c4 = texture2D(tColor, vUv);
  vec3 c = c4.rgb;
  // pixels drawn with alpha < 1 are 3D letters: keep ink off them and off their immediate border
  float tm = min(c4.a, min(min(texture2D(tColor, uv - ox).a, texture2D(tColor, uv + ox).a), min(texture2D(tColor, uv - oy).a, texture2D(tColor, uv + oy).a)));
  e *= step(0.9, tm);
  c = mix(c, inkColor, clamp(e, 0.0, 1.0) * 0.92);
  // paper tooth
  float g = vnoise(px * 0.9) * 0.6 + hash(floor(px * 0.5) + seed) * 0.4;
  c *= 1.0 - grain * (g - 0.5);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor('#a9c6ea');
    this.scene = new THREE.Scene();
    this.camera = new ObliqueCamera();
    this.camera.up.set(0, 0, -1);

    // rig: where the camera looks (on the floor), and how it is turned
    this.rig = { target: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 90, dist: 100, shear: new THREE.Vector2(-0.22, 0.72) };

    this.sun = new THREE.DirectionalLight('#ffffff', 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 1.5;
    this.shadowDir = new THREE.Vector3(-0.75, 1, -0.95).normalize();   // shadows fall toward screen lower-right
    this.scene.add(this.sun, this.sun.target);

    this.ink = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
        near: { value: this.camera.near }, far: { value: this.camera.far }, inkW: { value: 1.4 },
        silT: { value: 0.06 }, creaseT: { value: 0.02 }, inkColor: { value: new THREE.Color(INK) },
        grain: { value: 0.07 }, seed: { value: Math.random() * 100 },
      },
      vertexShader: inkVert, fragmentShader: inkFrag, depthTest: false, depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ink);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.rt = null;

    this.emPx = 22;          // CSS pixels per em (set by layout)
    this.viewW = 17;         // visible width in em
    this.viewH = 30;
    this.dirty = true;
    this.onBeforeRender = [];
    this.resize();
  }

  get dpr() { return Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)); }

  resize(cssW = this.canvas.clientWidth || window.innerWidth, cssH = this.canvas.clientHeight || window.innerHeight) {
    this.cssW = cssW; this.cssH = cssH;
    const dpr = this.dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
    const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
    if (this.rt) { this.rt.dispose(); this.rt.depthTexture.dispose(); }
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.rt = new THREE.WebGLRenderTarget(w, h, { depthTexture: depth, depthBuffer: true, type: THREE.UnsignedByteType });
    this.ink.uniforms.tColor.value = this.rt.texture;
    this.ink.uniforms.tDepth.value = depth;
    this.ink.uniforms.texel.value.set(1 / w, 1 / h);
    this.ink.uniforms.inkW.value = 1.25 * dpr;
    this.setEmPx(this.emPx);
  }

  setEmPx(emPx) {
    this.emPx = emPx;
    this.viewW = this.cssW / emPx;
    this.viewH = this.cssH / emPx;
    const c = this.camera;
    c.left = -this.viewW / 2; c.right = this.viewW / 2; c.top = this.viewH / 2; c.bottom = -this.viewH / 2;
    // thresholds in world units, scaled to how much world one device pixel covers
    const wpp = 1 / (emPx * this.dpr);
    const wallGrad = wpp / Math.max(0.2, this.rig.shear.y);
    this.ink.uniforms.silT.value = Math.max(0.05, 2.6 * wallGrad * this.ink.uniforms.inkW.value);
    this.ink.uniforms.creaseT.value = Math.max(0.006, 0.55 * wallGrad * this.ink.uniforms.inkW.value);
    this.applyRig();
  }

  // screen point (CSS px) <-> world on the floor plane / at a height
  worldToCss(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.cssW, y: (1 - p.y) / 2 * this.cssH };
  }
  ray(cssX, cssY) {
    const nx = cssX / this.cssW * 2 - 1, ny = 1 - cssY / this.cssH * 2;
    const a = new THREE.Vector3(nx, ny, -1).unproject(this.camera);
    const b = new THREE.Vector3(nx, ny, 1).unproject(this.camera);
    return new THREE.Ray(a, b.sub(a).normalize());
  }
  // floor point (y = h) under a CSS pixel
  pick(cssX, cssY, h = 0) {
    const r = this.ray(cssX, cssY);
    const t = (h - r.origin.y) / r.direction.y;
    return r.origin.clone().addScaledVector(r.direction, t);
  }

  applyRig() {
    const { target, yaw, pitch, dist, shear } = this.rig;
    const c = this.camera;
    const p = THREE.MathUtils.degToRad(pitch), y = THREE.MathUtils.degToRad(yaw);
    // pitch 90 = straight down; yaw turns around the vertical axis
    const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
    c.position.copy(target).addScaledVector(dir, dist);
    c.up.set(-Math.sin(y), 0, -Math.cos(y));   // "away from the viewer" is screen-up, at every pitch
    c.lookAt(target);
    c.focusDist = dist;
    c.shear.copy(shear);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    // shadow light follows the view so the shadow map always covers what is on screen
    const s = this.sun, half = Math.max(this.viewW, this.viewH) * 0.75 + 6;
    s.target.position.copy(target);
    s.position.copy(target).addScaledVector(this.shadowDir, 60);
    s.shadow.camera.left = -half; s.shadow.camera.right = half; s.shadow.camera.top = half; s.shadow.camera.bottom = -half;
    s.shadow.camera.near = 1; s.shadow.camera.far = 140;
    s.shadow.camera.updateProjectionMatrix();
    s.target.updateMatrixWorld();
    this.dirty = true;
  }

  render() {
    for (const f of this.onBeforeRender) f();
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
    this.dirty = false;
  }

  // Render the scene once into an offscreen canvas of the given pixel size (used for stickers, posters, OG).
  snapshot(w, h, { camera = this.camera, scene = this.scene, ink = true, clear = null, transparent = false } = {}) {
    const r = this.renderer;
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    const rt = new THREE.WebGLRenderTarget(w, h, { depthTexture: depth, depthBuffer: true });
    const out = new THREE.WebGLRenderTarget(w, h);
    const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    if (clear) r.setClearColor(clear, transparent ? 0 : 1);
    r.setRenderTarget(rt); r.clear(); r.render(scene, camera);
    let src = rt;
    if (ink) {
      const u = this.ink.uniforms, keep = { c: u.tColor.value, d: u.tDepth.value, t: u.texel.value.clone(), w: u.inkW.value };
      u.tColor.value = rt.texture; u.tDepth.value = depth; u.texel.value.set(1 / w, 1 / h); u.inkW.value = Math.max(1.6, w / 600);
      r.setRenderTarget(out); r.render(this.postScene, this.postCam);
      u.tColor.value = keep.c; u.tDepth.value = keep.d; u.texel.value.copy(keep.t); u.inkW.value = keep.w;
      src = out;
    }
    const buf = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(src, 0, 0, w, h, buf);
    r.setRenderTarget(null);
    r.setClearColor(prevClear, prevAlpha);
    rt.dispose(); out.dispose(); depth.dispose();
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    this.dirty = true;
    return cv;
  }
}
