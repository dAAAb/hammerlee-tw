// A tiny script language for the conversation and the machinery that turns it into one concrete chat.
//
// Every place the script offers alternatives is a "choice" with n options. A conversation is the list of
// choices made, and its id is that list read as one mixed-radix number: digit i is the option picked at
// choice i, in base n_i. Generating from random digits and decoding an id run the exact same walk, so an id
// and a conversation are the same thing — two different ids are two different conversations.

// --- building blocks used by script.js --------------------------------------------------------------
export const c = (...v) => ({ k: 'say', who: 'chuan', v });          // 川伯 says one of v
export const me = (...v) => ({ k: 'say', who: 'me', v });            // the user says one of v
export const stk = (who, ...v) => ({ k: 'sticker', who, v });          // a sticker, one of the ids
export const img = (...v) => ({ k: 'photo', who: 'chuan', v });        // 川伯 sends one of these photos
export const card = (id) => ({ k: 'card', who: 'chuan', v: [id] });    // a policy card (rich message)
export const elder = (...v) => ({ k: 'elder', who: 'chuan', v });      // a 長輩圖 drawn on the fly
export const alt = (...seqs) => ({ k: 'alt', v: seqs });              // one of several sub-sequences
export const opt = (...seq) => ({ k: 'alt', v: [seq, []] });          // a sub-sequence, or nothing

// emoji a user line may get appended when it doesn't already end with one (more variety, more ids)
export const TAILS = ['', '[heart]', '[thumb]', '[smile]'];
const endsWithEmoji = s => /\]$/.test(s);

// --- choosers ----------------------------------------------------------------------------------------
export class RandomChooser {
  constructor(rng = Math.random) { this.rng = rng; this.trace = []; }
  pick(n, forced) {
    if (n <= 1) return 0;
    const v = forced != null ? forced : Math.floor(this.rng() * n);
    this.trace.push([v, n]);
    return v;
  }
  get id() { return encode(this.trace); }
}

export class DecodeChooser {
  constructor(id) { this.x = decodeId(id); this.trace = []; }
  pick(n) {
    if (n <= 1) return 0;
    const N = BigInt(n);
    const v = Number(this.x % N);
    this.x /= N;
    this.trace.push([v, n]);
    return v;
  }
  get id() { return encode(this.trace); }
}

export function encode(trace) {
  let x = 0n, mult = 1n;
  for (const [v, n] of trace) { x += BigInt(v) * mult; mult *= BigInt(n); }
  return x.toString(16).toUpperCase();
}
export function decodeId(id) {
  const hex = String(id).replace(/[^0-9a-fA-F]/g, '');
  return hex ? BigInt('0x' + hex) : 0n;
}

// --- walking a sequence --------------------------------------------------------------------------------
// emit(msg) receives { kind, who, text | id, topic }
export function walk(seq, ch, emit, topic) {
  for (const node of seq) {
    if (node.k === 'alt') { walk(node.v[ch.pick(node.v.length)], ch, emit, topic); continue; }
    const i = ch.pick(node.v.length);
    const val = node.v[i];
    if (node.k === 'say') {
      let text = val;
      if (node.who === 'me' && !endsWithEmoji(text)) text += TAILS[ch.pick(TAILS.length)];
      emit({ kind: 'text', who: node.who, text, topic });
    } else {
      emit({ kind: node.k, who: node.who, id: val, topic });
    }
  }
}

// --- counting ------------------------------------------------------------------------------------------
// The number of different ways a sequence can come out (BigInt).
export function count(seq) {
  let total = 1n;
  for (const node of seq) total *= countNode(node);
  return total;
}
function countNode(node) {
  if (node.k === 'alt') return node.v.reduce((s, sub) => s + count(sub), 0n);
  if (node.k === 'say' && node.who === 'me') return node.v.reduce((s, t) => s + (endsWithEmoji(t) ? 1n : BigInt(TAILS.length)), 0n);
  return BigInt(node.v.length);
}

// Ordered picks of k items from a pool, each item with its own number of inner variants:
// sum over ordered k-subsets of the product of their counts = k! * e_k(counts).
export function orderedPicks(counts, k) {
  const e = Array(k + 1).fill(0n); e[0] = 1n;
  for (const c of counts) for (let j = k; j >= 1; j--) e[j] += e[j - 1] * c;
  let f = 1n; for (let i = 2n; i <= BigInt(k); i++) f *= i;
  return e[k] * f;
}

// small seeded RNG for anything that must look random but stay reproducible (layout jitter, badge looks)
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashString(s) {
  let h1 = 1779033703, h2 = 3144134277;
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 597399067); h2 = Math.imul(h2 ^ k, 2869860233);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}
