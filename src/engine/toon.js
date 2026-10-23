// Colorfigures-style shading for three.js: every face is painted in one of three flat bands (light / mid / dark)
// by how it meets a fixed light, and cast shadows land as one flat colour. Ink lines are added later by the
// post pass in stage.js, so materials here never draw outlines themselves.
import * as THREE from 'three';

// Band light: from above, a little left and toward the viewer, so tops are light, the walls that face the
// bottom of the screen are mid and the right-facing walls are dark.
export const SHADE_DIR = new THREE.Vector3(-0.55, 1.0, 0.42).normalize();

export const INK = '#231e16';
export const SHADOW = '#41538f';

// Palettes: l = lit, m = mid, d = shade (the dark band leans warm/saturated like the reference look).
export const PAL = {
  paper:   { l: '#fffdf6', m: '#ece6d6', d: '#c9bfa8' },
  white:   { l: '#ffffff', m: '#e7ebf2', d: '#b9c2d3' },
  green:   { l: '#a6ec7c', m: '#7fcc56', d: '#3f7a2a' },   // LINE-like "my" bubble
  navy:    { l: '#1f4fa8', m: '#163c84', d: '#0b2152' },   // brand navy #00449A family
  blue:    { l: '#33aef0', m: '#1689cf', d: '#0b4f86' },   // brand blue #0096E8
  sky:     { l: '#9fd2f2', m: '#78b5dc', d: '#3f6f98' },
  teal:    { l: '#52d8d6', m: '#2ab3b2', d: '#126b6c' },   // brand teal #2AC9C9
  yellow:  { l: '#ffd23a', m: '#f0b400', d: '#7a5600' },   // brand yellow #FFC105
  orange:  { l: '#ffb14a', m: '#ef8f24', d: '#7a3f0b' },
  red:     { l: '#ff7a63', m: '#e0533f', d: '#6d2016' },
  pink:    { l: '#ff9fb3', m: '#ea7690', d: '#73283b' },
  purple:  { l: '#a9b2ff', m: '#7f8bec', d: '#343d8a' },
  coral:   { l: '#ffa88c', m: '#ee8466', d: '#73331f' },
  skin:    { l: '#ffd9bd', m: '#f2b994', d: '#9b5d3c' },
  hair:    { l: '#3a3634', m: '#2a2725', d: '#151312' },
  shirt:   { l: '#cfe6ff', m: '#a9cdf2', d: '#5a7fb0' },
  pants:   { l: '#3b4f7a', m: '#2c3c60', d: '#151d33' },
  metal:   { l: '#eef0f0', m: '#c6ccce', d: '#8f989b' },
  dark:    { l: '#55504a', m: '#3d3935', d: '#272421' },
  wood:    { l: '#e7b57a', m: '#c98f53', d: '#6e4421' },
  gold:    { l: '#ffe58a', m: '#f2c14e', d: '#8a6418' },
  text:    { l: '#2a3352', m: '#93a0c6', d: '#64709a' },   // 3D text: walls light/mid, the face is set by `top`
  leaf:    { l: '#8fd36b', m: '#62ad45', d: '#2b5a1f' },
  glass:   { l: '#e4f2f4', m: '#c4dfe4', d: '#97b9c0' },
  cream:   { l: '#fff4d6', m: '#f3dfae', d: '#b39a5c' },
};

const vert = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
varying vec3 vWN;
varying vec3 vObjN;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  mat3 m3 = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    m3 = m3 * mat3(instanceMatrix);
  #endif
  vWN = normalize(m3 * objectNormal);
  vObjN = objectNormal;
}`;

const frag = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
uniform vec3 cL;
uniform vec3 cM;
uniform vec3 cD;
uniform vec3 cS;
uniform vec3 uShade;
uniform float uShadowK;
uniform float uTopOnly;
uniform vec3 uTop;
uniform float opacity;
uniform float uMark;
varying vec3 vWN;
varying vec3 vObjN;
void main() {
  vec3 n = normalize(vWN);
  if (!gl_FrontFacing) n = -n;
  float d = dot(n, uShade);
  float aa = max(fwidth(d), 1e-4);
  vec3 col = mix(cD, cM, smoothstep(-0.18 - aa, -0.18 + aa, d));
  col = mix(col, cL, smoothstep(0.62 - aa, 0.62 + aa, d));
  // optional flat colour for faces pointing straight up (text faces, stickers' printed tops)
  col = mix(col, uTop, uTopOnly * step(0.97, n.y));
  float sm = getShadowMask();
  col = mix(col, cS, (1.0 - sm) * uShadowK);
  gl_FragColor = vec4(col, opacity * uMark);
}`;

const cache = new Map();

// toon(pal, opts): shared material per palette+options. opts: { receive: 0..1 shadow strength, top: '#hex', opacity }
export function toon(pal, opts = {}) {
  if (typeof pal === 'string') pal = PAL[pal] || shadeOf(pal);
  const key = [pal.l, pal.m, pal.d, opts.receive ?? 0, opts.top ?? '', opts.opacity ?? 1, opts.side ?? 0, opts.shadowColor ?? '', opts.text ? 1 : 0].join('|');
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      cL: { value: new THREE.Color(pal.l) },
      cM: { value: new THREE.Color(pal.m) },
      cD: { value: new THREE.Color(pal.d) },
      cS: { value: new THREE.Color(opts.shadowColor || mixHex(pal.d, SHADOW, 0.35)) },
      uShade: { value: SHADE_DIR },
      uShadowK: { value: opts.receive ?? 0 },
      uTopOnly: { value: opts.top ? 1 : 0 },
      uTop: { value: new THREE.Color(opts.top || '#000000') },
      opacity: { value: opts.opacity ?? 1 },
      uMark: { value: opts.text ? 0.5 : 1 },   // alpha 0.5 marks 3D text for the ink pass
    }]),
    vertexShader: vert,
    fragmentShader: frag,
    lights: true,
    transparent: (opts.opacity ?? 1) < 1,
    side: opts.side === 2 ? THREE.DoubleSide : THREE.FrontSide,
  });
  mat.userData.pal = pal;
  cache.set(key, mat);
  return mat;
}

// A palette from one hex: lighter top, the colour itself as mid, a deep warm-shifted shade.
export function shadeOf(hex) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  const l = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.02), Math.min(0.96, hsl.l + (1 - hsl.l) * 0.28));
  const d = new THREE.Color().setHSL((hsl.h + 0.985) % 1, Math.min(1, hsl.s * 1.05), hsl.l * 0.42);
  return { l: '#' + l.getHexString(), m: '#' + c.getHexString(), d: '#' + d.getHexString() };
}

export function mixHex(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

// Floor material: flat colour + a faint printed pattern + flat blue cast shadows.
export function floorMaterial(base = '#a9c6ea', pattern = '#9fbfe6') {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      cBase: { value: new THREE.Color(base) },
      cPat: { value: new THREE.Color(pattern) },
      cS: { value: new THREE.Color(SHADOW) },
      uShadowK: { value: 0.62 },
    }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <shadowmap_pars_vertex>
      varying vec3 vWP;
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      uniform vec3 cBase; uniform vec3 cPat; uniform vec3 cS; uniform float uShadowK;
      varying vec3 vWP;
      void main() {
        // brand arch motif (the logo's bars), small and sparse in a staggered grid, very faint
        vec2 p = vWP.xz / 7.0;
        p.x += mod(floor(p.y), 2.0) * 0.5;
        vec2 f = (fract(p) - 0.5) * 7.0;             // em inside the cell, centred
        float bar = 0.0;
        for (int i = 0; i < 9; i++) {
          float k = float(i) - 4.0;
          float a = abs(k) / 4.0;
          float bx = k * 0.27;
          float base = 0.18 * a * a;               // bars stand on a gentle arch
          float top = base - (0.28 + 0.62 * (1.0 - pow(a, 1.4)));
          bar = max(bar, step(abs(f.x - bx), 0.075) * step(top, f.y) * step(f.y, base));
        }
        vec3 col = mix(cBase, cPat, bar);
        float sm = getShadowMask();
        col = mix(col, cS, (1.0 - sm) * uShadowK);
        gl_FragColor = vec4(col, 1.0);
      }`,
    lights: true,
  });
}

// Physically-lit material for the shiny badge (reflections need an env map set on the scene).
export function shiny(hex, { metal = 1, rough = 0.22, clearcoat = 0 } = {}) {
  return new THREE.MeshPhysicalMaterial({ color: hex, metalness: metal, roughness: rough, clearcoat, clearcoatRoughness: 0.08 });
}
