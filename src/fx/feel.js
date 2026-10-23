// Sound and touch: a chat app's little chime when a message lands, a pop when yours is sent, soft key ticks
// while it types, and a short buzz on phones that can vibrate. Every sound is synthesised here (no audio
// files), and nothing plays until the viewer turns sound on — which is also the tap browsers require.
const S = { sound: false, vibrate: false };
let ctx = null, master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// one soft tone with a quick attack and a gentle tail
function tone(freq, t0, dur, { type = 'sine', gain = 0.2, slide = 0 } = {}) {
  const a = ctx, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, { gain = 0.08, freq = 3000, q = 1 } = {}) {
  const a = ctx, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

const SOUNDS = {
  // 川伯's message lands: a warm two-note chime
  incoming(t) { tone(1046.5, t, 0.22, { gain: 0.16 }); tone(1568, t + 0.09, 0.32, { gain: 0.13 }); tone(2093, t + 0.09, 0.2, { gain: 0.03, type: 'triangle' }); },
  // your line is sent: a quick upward pop
  sent(t) { tone(520, t, 0.11, { gain: 0.14, slide: 2.1 }); noise(t, 0.05, { gain: 0.05, freq: 4200 }); },
  // a sticker bounces in
  sticker(t) { tone(330, t, 0.18, { gain: 0.15, slide: 1.9, type: 'triangle' }); tone(660, t + 0.12, 0.2, { gain: 0.08, slide: 1.3 }); },
  // a photo or a card arrives
  photo(t) { noise(t, 0.12, { gain: 0.1, freq: 1800, q: 0.7 }); tone(880, t + 0.05, 0.18, { gain: 0.08 }); },
  // the badge: a little fanfare
  badge(t) { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.09, 0.4, { gain: 0.12, type: i % 2 ? 'triangle' : 'sine' })); },
  key(t) { noise(t, 0.025, { gain: 0.035, freq: 5200, q: 2 }); },
  bonk(t) { tone(160, t, 0.2, { gain: 0.2, slide: 0.6, type: 'triangle' }); noise(t, 0.08, { gain: 0.06, freq: 600 }); },
  boing(t) { tone(280, t, 0.28, { gain: 0.14, slide: 2.4, type: 'triangle' }); },
  // 川哥 digs and hammers at a build
  dig(t) { [0, 0.42, 0.84].forEach(d => { tone(190, t + d, 0.12, { gain: 0.14, slide: 0.7, type: 'triangle' }); noise(t + d, 0.06, { gain: 0.07, freq: 900 }); }); },
  // a build is done: a bright little run up
  built(t) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { gain: 0.1, type: i % 2 ? 'triangle' : 'sine' })); },
};

const BUZZ = { incoming: 18, sent: 10, sticker: [12, 40, 12], photo: 14, badge: [20, 60, 20, 60, 40], bonk: 30, boing: 12, dig: [12, 400, 12, 400, 12], built: [20, 50, 30] };

let lastKey = 0;
export function play(name) {
  if (S.sound && audio()) {
    if (name === 'key') { const now = ctx.currentTime; if (now - lastKey < 0.045) return; lastKey = now; }
    try { SOUNDS[name]?.(ctx.currentTime + 0.01); } catch (e) { /* audio is best-effort */ }
  }
  if (S.vibrate && BUZZ[name] && navigator.vibrate) { try { navigator.vibrate(BUZZ[name]); } catch (e) { /* not allowed here */ } }
}

export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function setFeel({ sound, vibrate }) {
  if (sound != null) { S.sound = sound; if (sound && audio()) SOUNDS.incoming(ctx.currentTime + 0.02); }
  if (vibrate != null) { S.vibrate = vibrate && canVibrate(); if (S.vibrate) try { navigator.vibrate(20); } catch (e) { /* ignore */ } }
}

// which sound a newly shown chat item makes
export function soundFor(it) {
  if (it.kind === 'text') return it.who === 'me' ? 'sent' : 'incoming';
  if (it.kind === 'sticker') return 'sticker';
  if (it.kind === 'photo' || it.kind === 'card' || it.kind === 'elder') return 'photo';
  if (it.kind === 'badge') return 'badge';
  return null;
}
