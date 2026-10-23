// Real, selectable text laid exactly over the 3D letters. Each bubble gets a transparent block of HTML text
// in the same font (Huninn, so every advance matches the 3D glyphs) with the same line breaks, moved every
// frame to where the letter tops are on screen. People can long-press or drag to select and copy, the
// selection shows as a yellow highlighter over the 3D type, and screen readers read the chat.
import * as THREE from 'three';
import { BUBBLE } from '../chat/layout.js';

const EMOJI_CHAR = {
  heart: '❤️', sparkle: '✨', smile: '😊', laugh: '😄', thumb: '👍', star: '⭐', party: '🎉', flower: '🌸', sun: '☀️',
  train: '🚇', hospital: '🏥', house: '🏠', chip: '🤖', ball: '⚾', bridge: '🌉', bottle: '🍼', dog: '🐶', cat: '🐱',
  tooth: '🦷', gift: '🎁', check: '✅', hammer: '🔨', helmet: '⛑️', clock: '⏰', mountain: '⛰️', wave: '👋', game: '🎮',
  balloon: '🎈', pineapple: '🍍', tea: '🍵', coin: '🪙', bike: '🚲', book: '📖', drone: '🛸', cake: '🍰', muscle: '💪',
  clap: '👏', rainbow: '🌈', bus: '🚌', pray: '🙏',
};
export const emojiChar = name => EMOJI_CHAR[name] || '';
export const plainText = text => text.replace(/\[([a-z_0-9]+)\]/g, (_, n) => emojiChar(n));

const v = new THREE.Vector3();

export class TextLayer {
  constructor(root, stage) {
    this.root = root;
    this.stage = stage;
    this.blocks = new Map();   // rec -> { el, lines }
  }

  attach(rec) {
    const it = rec.item;
    if (it.kind !== 'text' || this.blocks.has(rec)) return;
    const el = document.createElement('div');
    el.className = 'tl';
    el.setAttribute('role', 'article');
    el.setAttribute('aria-label', (it.who === 'chuan' ? '川伯說：' : '我說：') + plainText(it.msg.text));
    for (const line of it.text.lines) {
      const ln = document.createElement('span');
      ln.className = 'tl-line';
      for (const g of line.items) {
        if (g.t === 'ch') ln.append(g.ch);
        else { const e = document.createElement('span'); e.className = 'tl-emoji'; e.textContent = emojiChar(g.name); ln.append(e); }
      }
      el.append(ln);
    }
    this.root.append(el);
    this.blocks.set(rec, { el });
  }

  detach(rec) {
    const b = this.blocks.get(rec);
    if (!b) return;
    b.el.remove();
    this.blocks.delete(rec);
  }

  // position every block on the 3D letter tops (height = bubble thickness + letter depth)
  update() {
    const st = this.stage, em = st.emPx;
    const y = BUBBLE.thick + 0.2;
    for (const [rec, b] of this.blocks) {
      const it = rec.item, g = rec.group.position;
      v.set(g.x + BUBBLE.pad, y, g.z + BUBBLE.padY);
      const p = st.worldToCss(v);
      const shown = rec.revealed && rec.group.visible;
      b.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      b.el.style.fontSize = em + 'px';
      b.el.style.lineHeight = (BUBBLE.lineH * em).toFixed(2) + 'px';
      b.el.style.visibility = shown ? 'visible' : 'hidden';
    }
  }
}

// CSS for the layer (injected once by main.js)
export const TEXT_LAYER_CSS = `
#textlayer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.tl { position: absolute; left: 0; top: 0; font-family: "Huninn", var(--ui-font); color: transparent; white-space: pre;
  pointer-events: auto; -webkit-user-select: text; user-select: text; cursor: text; letter-spacing: 0; font-kerning: none;
  font-feature-settings: "palt" 0, "kern" 0; -webkit-touch-callout: default; }
.tl-line { display: block; min-height: 1em; }
.tl-emoji { display: inline-block; width: 1.2em; text-align: center; font-size: 1em; overflow: hidden; vertical-align: top; }
.tl ::selection, .tl::selection { background: rgba(255, 193, 5, .5); color: transparent; }
`;
