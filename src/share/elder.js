// 長輩圖: the classic Taiwanese good-morning picture — sunburst, flowers, sparkles and huge outlined words —
// painted on a canvas with the same 粉圓 outlines as the 3D letters, so it never depends on a system font.
import * as THREE from 'three';
import { ELDER } from '../chat/script.js';
import { CONFIG } from '../config.js';

const THEMES = {
  sunrise: { sky: ['#ffe9a8', '#ffb36b', '#ff7d7d'], ray: 'rgba(255,255,255,.28)', ink: ['#d6261f', '#1f4fa8'], flower: ['#ff5d8f', '#ffd23a', '#ff8a3d'] },
  lotus:   { sky: ['#fff3fb', '#ffc3dc', '#c99bff'], ray: 'rgba(255,255,255,.35)', ink: ['#c2185b', '#2e7d32'], flower: ['#ff7fb0', '#ffffff', '#ffd23a'] },
  sky:     { sky: ['#e8fbff', '#9fe0ff', '#52a8ff'], ray: 'rgba(255,255,255,.32)', ink: ['#0b4fa8', '#d6261f'], flower: ['#ffd23a', '#ff6b6b', '#ffffff'] },
  gold:    { sky: ['#fff6cf', '#ffd76a', '#ffb000'], ray: 'rgba(255,255,255,.3)', ink: ['#b3001b', '#00449a'], flower: ['#ff4d4d', '#ffffff', '#2ac9c9'] },
  tea:     { sky: ['#f4ffe9', '#c8f0a0', '#7fcf6a'], ray: 'rgba(255,255,255,.3)', ink: ['#2b6e1f', '#c2185b'], flower: ['#ffd23a', '#ff8fb3', '#ffffff'] },
};

export function drawElder(font, id, W = 720, H = 900) {
  const spec = ELDER[id] || ELDER.morning;
  const th = THEMES[spec.theme] || THEMES.sunrise;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // sky + sunburst
  const grad = g.createLinearGradient(0, 0, 0, H);
  th.sky.forEach((c, i) => grad.addColorStop(i / (th.sky.length - 1), c));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H * 0.42);
  for (let i = 0; i < 24; i++) {
    g.rotate(Math.PI * 2 / 24);
    if (i % 2) continue;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, -H); g.lineTo(60, -H); g.closePath();
    g.fillStyle = th.ray; g.fill();
  }
  g.restore();
  // a soft sun
  const sun = g.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, 220);
  sun.addColorStop(0, 'rgba(255,255,255,.9)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  // flowers along the bottom and in the corners
  let seed = [...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const flower = (x, y, r, col) => {
    g.save(); g.translate(x, y); g.rotate(rnd() * 3);
    for (let p = 0; p < 6; p++) {
      g.rotate(Math.PI / 3);
      g.beginPath(); g.ellipse(0, -r * 0.62, r * 0.38, r * 0.62, 0, 0, Math.PI * 2);
      g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(80,30,30,.35)'; g.stroke();
    }
    g.beginPath(); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); g.fillStyle = '#ffcf33'; g.fill(); g.stroke();
    g.restore();
  };
  const leaf = (x, y, r) => { g.save(); g.translate(x, y); g.rotate(rnd() * 6); g.beginPath(); g.ellipse(0, 0, r * 0.35, r, 0, 0, Math.PI * 2); g.fillStyle = '#5fbf4a'; g.fill(); g.restore(); };
  for (let i = 0; i < 16; i++) leaf(rnd() * W, H - rnd() * 140, 30 + rnd() * 20);
  for (let i = 0; i < 11; i++) flower(30 + rnd() * (W - 60), H - 30 - rnd() * 150, 34 + rnd() * 26, th.flower[i % th.flower.length]);
  for (let i = 0; i < 3; i++) flower(rnd() * 120, rnd() * 140, 30 + rnd() * 16, th.flower[(i + 1) % 3]);
  for (let i = 0; i < 3; i++) flower(W - rnd() * 120, rnd() * 140, 30 + rnd() * 16, th.flower[(i + 2) % 3]);
  // sparkles
  const sparkle = (x, y, r) => {
    g.save(); g.translate(x, y); g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.25 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = '#fffbe0'; g.fill(); g.restore();
  };
  for (let i = 0; i < 18; i++) sparkle(rnd() * W, rnd() * H * 0.75, 8 + rnd() * 16);
  // the words: huge, two colours, thick white and dark outlines
  const lines = spec.lines;
  const size0 = Math.min(190, (W - 80) / Math.max(...lines.map(l => [...l].length)));
  lines.forEach((line, i) => {
    const size = i === 0 ? size0 : size0 * 0.82;
    const w = font.measure(line, size, size * 0.04);
    const y = H * 0.2 + size + i * size0 * 1.08;
    const { path } = font.path2d(line, (W - w) / 2, y, size, { letter: size * 0.04 });
    g.save();
    g.lineJoin = 'round';
    g.lineWidth = size * 0.2; g.strokeStyle = '#3a1f12'; g.stroke(path);
    g.lineWidth = size * 0.12; g.strokeStyle = '#ffffff'; g.stroke(path);
    const fill = g.createLinearGradient(0, y - size, 0, y);
    fill.addColorStop(0, i === 0 ? '#ffe36b' : '#ffffff');
    fill.addColorStop(0.35, th.ink[i % 2]);
    fill.addColorStop(1, th.ink[i % 2]);
    g.fillStyle = fill; g.fill(path);
    g.restore();
  });
  // ribbon with the small line
  const sub = spec.sub, ss = 40, sw = font.measure(sub, ss);
  const ry = H * 0.2 + size0 * 2.35;
  g.fillStyle = 'rgba(255,255,255,.85)';
  roundRect(g, (W - sw) / 2 - 26, ry - ss - 8, sw + 52, ss + 30, 26); g.fill();
  const { path: sp } = font.path2d(sub, (W - sw) / 2, ry + 6, ss);
  g.fillStyle = '#5a2a12'; g.fill(sp);
  // signature
  const sig = '川伯 敬上', sg = 30, sgw = font.measure(sig, sg);
  const { path: sigp } = font.path2d(sig, W - sgw - 28, H - 24, sg);
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.stroke(sigp);
  g.fillStyle = '#00449a'; g.fill(sigp);
  // who made it, small in the other corner
  const { path: cp } = font.path2d(CONFIG.credit, 22, H - 26, 19);
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke(cp);
  g.fillStyle = '#4a5570'; g.fill(cp);
  return cv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const cache = new Map();
export function elderTexture(font, id) {
  if (!cache.has(id)) {
    const cv = drawElder(font, id);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    cache.set(id, { tex: t, canvas: cv });
  }
  return cache.get(id).tex;
}
export function elderCanvas(font, id) { elderTexture(font, id); return cache.get(id).canvas; }
