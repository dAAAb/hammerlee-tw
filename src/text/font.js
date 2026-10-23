// 3D glyphs. glyphs.bin (tools/build_font.py) holds flattened outlines of every character the script uses;
// each glyph is triangulated once on first use and kept, and a whole run of text becomes one merged mesh.
import * as THREE from 'three';

export class GlyphFont {
  static async load(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    return new GlyphFont(buf);
  }
  constructor(buf) {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'HLG1') throw new Error('glyphs.bin: bad header');
    this.dv = dv;
    this.upm = dv.getUint16(4, true);
    this.ascender = dv.getInt16(6, true) / this.upm;
    this.descender = dv.getInt16(8, true) / this.upm;
    const n = dv.getUint32(10, true);
    this.index = new Map();
    for (let i = 0, o = 14; i < n; i++, o += 14) {
      this.index.set(dv.getUint32(o, true), { adv: dv.getUint16(o + 4, true) / this.upm, off: dv.getUint32(o + 6, true), len: dv.getUint32(o + 10, true) });
    }
    this.cache = new Map();   // codepoint -> { adv, pos: Float32Array, nrm: Float32Array, topCount }
  }
  has(ch) { return this.index.has(ch.codePointAt(0)); }
  advance(ch) {
    const g = this.index.get(ch.codePointAt(0));
    if (g) return g.adv;
    return ch === ' ' ? 0.3 : 1;
  }

  // shapes in em units, font y-up: [[outer, hole, hole...], ...], each contour a flat [x0,y0,x1,y1...]
  shapes(cp) {
    const g = this.index.get(cp);
    if (!g) return [];
    const dv = this.dv, k = 1 / this.upm;
    let o = g.off;
    const nShapes = dv.getUint16(o, true); o += 2;
    const out = [];
    for (let s = 0; s < nShapes; s++) {
      const nC = dv.getUint16(o, true); o += 2;
      const shape = [];
      for (let c = 0; c < nC; c++) {
        const nP = dv.getUint16(o, true); o += 2;
        const pts = new Float32Array(nP * 2);
        let x = dv.getInt16(o, true), y = dv.getInt16(o + 2, true); o += 4;
        pts[0] = x * k; pts[1] = y * k;
        for (let i = 1; i < nP; i++) {
          const dx = dv.getInt8(o), dy = dv.getInt8(o + 1); o += 2;
          if (dx === -128 && dy === 0) { x = dv.getInt16(o, true); y = dv.getInt16(o + 2, true); o += 4; }
          else { x += dx; y += dy; }
          pts[i * 2] = x * k; pts[i * 2 + 1] = y * k;
        }
        shape.push(pts);
      }
      out.push(shape);
    }
    return out;
  }

  // Unit glyph (1 em, depth 1) in world orientation: font x -> +x, font y -> -z, extrusion -> +y.
  // Only the top cap and the walls are built: the bottom always sits on something.
  glyph(ch) {
    const cp = ch.codePointAt(0);
    let g = this.cache.get(cp);
    if (g) return g;
    const pos = [], nrm = [];
    for (const shape of this.shapes(cp)) {
      const contours = shape.map(pts => { const v = []; for (let i = 0; i < pts.length; i += 2) v.push(new THREE.Vector2(pts[i], pts[i + 1])); return v; });
      const all = contours.flat();
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(contours[0], contours.slice(1)); } catch (e) { tris = []; }
      for (const [a, b, c] of tris) {
        const A = all[a], B = all[b], C = all[c];
        // keep the top face counter-clockwise when seen from above (+y): in x/-z that is clockwise in font space
        const cross = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
        const tri = cross > 0 ? [A, B, C] : [A, C, B];
        for (const P of tri) { pos.push(P.x, 1, -P.y); nrm.push(0, 1, 0); }
      }
      // walls: solid is on the right of travel (outer CW, holes CCW in font space), outward = left of travel
      for (const v of contours) {
        for (let i = 0; i < v.length; i++) {
          const p = v[i], q = v[(i + 1) % v.length];
          const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L, nz = -(dx / L);   // outward (−dy, dx) in font space; world z = −font y
          // quad p0 p1 q1 q0 (bottom y=0, top y=1), wound to face outward
          const p0 = [p.x, 0, -p.y], p1 = [p.x, 1, -p.y], q0 = [q.x, 0, -q.y], q1 = [q.x, 1, -q.y];
          pos.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
          for (let k = 0; k < 6; k++) nrm.push(nx, 0, nz);
        }
      }
    }
    g = { adv: this.advance(ch), pos: new Float32Array(pos), nrm: new Float32Array(nrm) };
    this.cache.set(cp, g);
    return g;
  }

  // One merged geometry for many placed glyphs: items = [{ ch, x, z, size, depth }] (x/z = pen position at
  // the baseline, in world em). Returns null when nothing is drawable.
  build(items) {
    let n = 0;
    const gs = items.map(it => { const g = this.glyph(it.ch); n += g.pos.length; return g; });
    if (!n) return null;
    const pos = new Float32Array(n), nrm = new Float32Array(n);
    let o = 0;
    items.forEach((it, i) => {
      const g = gs[i], s = it.size, d = it.depth, y0 = it.y || 0;
      const P = g.pos, N = g.nrm;
      for (let j = 0; j < P.length; j += 3) {
        pos[o + j] = it.x + P[j] * s;
        pos[o + j + 1] = y0 + P[j + 1] * d;
        pos[o + j + 2] = it.z + P[j + 2] * s;
      }
      nrm.set(N, o);
      o += P.length;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  // Draw a string into a 2D canvas with the same outlines (posters, 長輩圖, OG images): fills a Path2D.
  path2d(text, x, y, size, { letter = 0 } = {}) {
    const path = new Path2D();
    let pen = x;
    for (const ch of text) {
      for (const shape of this.shapes(ch.codePointAt(0))) {
        for (const pts of shape) {
          path.moveTo(pen + pts[0] * size, y - pts[1] * size);
          for (let i = 2; i < pts.length; i += 2) path.lineTo(pen + pts[i] * size, y - pts[i + 1] * size);
          path.closePath();
        }
      }
      pen += this.advance(ch) * size + letter;
    }
    return { path, width: pen - x };
  }
  measure(text, size, letter = 0) {
    let w = 0;
    for (const ch of text) w += this.advance(ch) * size + letter;
    return w;
  }
}
