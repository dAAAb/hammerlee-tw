// One place to get every model. Real implementations register themselves from main.js; until a model file
// exists, a simple stand-in keeps the chat working.
import * as THREE from 'three';
import { toon } from '../engine/toon.js';

export const models = {
  makeEmoji: null,           // (name) => Group, ~1 em footprint
  createChuanSticker: null,  // (id, font) => Group
  createMeSticker: null,     // (id, font) => Group
  createChuanAvatar: null,   // () => Group, 2.3 em coin
  createChuan: null,         // (opts) => runner rig
};

export function registerModels(impl) { Object.assign(models, impl); }

const ball = new THREE.SphereGeometry(0.42, 16, 12);
export function emoji(name) {
  if (models.makeEmoji) { try { return models.makeEmoji(name); } catch (e) { console.warn('emoji', name, e); } }
  const g = new THREE.Group();
  const m = new THREE.Mesh(ball, toon('yellow'));
  m.position.y = 0.32; m.scale.y = 0.75; m.castShadow = true;
  g.add(m);
  return g;
}

export function sticker(id, font, who) {
  try {
    if (who === 'chuan' && models.createChuanSticker) return models.createChuanSticker(id, font);
    if (who === 'me' && models.createMeSticker) return models.createMeSticker(id, font);
  } catch (e) { console.warn('sticker', id, e); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 32), toon(who === 'me' ? 'teal' : 'yellow'));
  m.position.y = 0.25; m.castShadow = true;
  g.add(m);
  return g;
}

export function avatar() {
  if (models.createChuanAvatar) { try { return models.createChuanAvatar(); } catch (e) { console.warn('avatar', e); } }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 32), toon('sky'));
  m.position.y = 0.22; m.castShadow = true;
  g.add(m);
  return g;
}
