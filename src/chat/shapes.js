// Chunky slab shapes that lie on the floor: chat bubbles with a LINE-style tail, rounded cards, pills.
// All are built in the x / -z plane (shape y-up = screen-up) and extruded upward from y = 0.
import * as THREE from 'three';

const BEVEL = 0.07;

export function slabFromShape(shape, height, { bevel = BEVEL, curveSegments = 7 } = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, height - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

// Rounded rectangle path, top-left at (x, y) in shape space (y-up), w wide, h tall.
export function roundRectPath(p, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y - r);
  p.lineTo(x + w, y - h + r); p.quadraticCurveTo(x + w, y - h, x + w - r, y - h);
  p.lineTo(x + r, y - h); p.quadraticCurveTo(x, y - h, x, y - h + r);
  p.lineTo(x, y - r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

export function roundRect(w, h, r) {
  return roundRectPath(new THREE.Shape(), 0, 0, w, h, r);
}

// Chat bubble w x h with its tail at the top-left (side 'left') or top-right (side 'right').
// The local origin is the bubble's top-left corner (the tail sticks out past it).
export function bubbleShape(w, h, side = 'left', r = 0.85) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  if (side === 'left') {
    s.moveTo(0.62, 0);
    s.lineTo(w - r, 0); s.quadraticCurveTo(w, 0, w, -r);
    s.lineTo(w, -h + r); s.quadraticCurveTo(w, -h, w - r, -h);
    s.lineTo(r, -h); s.quadraticCurveTo(0, -h, 0, -h + r);
    s.lineTo(0, -Math.min(h - r, 0.95));
    s.quadraticCurveTo(0.02, -0.28, -0.42, 0.06);   // tail out to the tip
    s.quadraticCurveTo(0.12, -0.02, 0.62, 0);       // and back along the top edge
  } else {
    s.moveTo(w - 0.62, 0);
    s.quadraticCurveTo(w - 0.12, -0.02, w + 0.42, 0.06);
    s.quadraticCurveTo(w - 0.02, -0.28, w, -Math.min(h - r, 0.95));
    s.lineTo(w, -h + r); s.quadraticCurveTo(w, -h, w - r, -h);
    s.lineTo(r, -h); s.quadraticCurveTo(0, -h, 0, -h + r);
    s.lineTo(0, -r); s.quadraticCurveTo(0, 0, r, 0);
    s.lineTo(w - 0.62, 0);
  }
  return s;
}

export function circleShape(r, seg = 40) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return s;
}
