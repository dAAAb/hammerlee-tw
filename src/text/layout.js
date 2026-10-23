// Line breaking for chat bubbles: CJK breaks anywhere, Latin words and numbers stay whole, and the usual
// kinsoku rules keep closing punctuation off the start of a line. Inline emoji are written [name] in the
// script and take a square box in the line.

const NO_START = new Set('，。、！？；：」』）》〉…～,.!?;:)]}%．·ー—');
const NO_END = new Set('「『（《〈([{');

// tokens: { t: 'ch', ch } | { t: 'word', s } | { t: 'emoji', name } | { t: 'br' }
export function tokenize(text) {
  const out = [];
  const re = /\[([a-z_0-9]+)\]|\n|([A-Za-z0-9@#&'._%+\-\/]+)|([\s\S])/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) out.push({ t: 'emoji', name: m[1] });
    else if (m[0] === '\n') out.push({ t: 'br' });
    else if (m[2]) out.push({ t: 'word', s: m[2] });
    else out.push({ t: 'ch', ch: m[3] });
  }
  return out;
}

// Lay text out in a box `maxW` em wide at font `size` em.
// Returns { lines: [{ items: [{ t:'ch'|'emoji', ch, name, x, w }], w }], w, h, lineH, size }
export function layoutText(font, text, maxW, size = 1, { lineH = 1.42, emojiW = 1.2 } = {}) {
  const adv = c => font.advance(c) * size;
  // units = things that must stay on one line: a char, an emoji, or a whole word
  const units = [];
  for (const tok of tokenize(text)) {
    if (tok.t === 'br') units.push({ br: true });
    else if (tok.t === 'emoji') units.push({ items: [{ t: 'emoji', name: tok.name, w: emojiW * size }], w: emojiW * size });
    else if (tok.t === 'word') {
      const items = [...tok.s].map(c => ({ t: 'ch', ch: c, w: adv(c) }));
      units.push({ items, w: items.reduce((s, i) => s + i.w, 0) });
    } else units.push({ items: [{ t: 'ch', ch: tok.ch, w: adv(tok.ch) }], w: adv(tok.ch), ch: tok.ch });
  }
  const lines = [];
  let cur = [];
  let x = 0;
  const flush = () => { lines.push(cur); cur = []; x = 0; };
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.br) { flush(); continue; }
    if (u.ch === ' ' && !cur.length) continue;
    if (x + u.w > maxW + 1e-6 && cur.length) {
      if (u.ch && NO_START.has(u.ch)) {
        if (x + u.w <= maxW + size * 0.55) { cur.push(u); x += u.w; continue; }   // hang it
        const prev = cur.pop(); x -= prev.w;                                     // carry the previous unit down
        flush(); cur.push(prev); x = prev.w;
      } else {
        const last = cur[cur.length - 1];
        if (last && last.ch && NO_END.has(last.ch) && cur.length > 1) { cur.pop(); flush(); cur.push(last); x = last.w; }
        else flush();
      }
      if (u.ch === ' ') continue;
    }
    if (u.w > maxW && u.items.length > 1) {   // a word longer than a line: break inside it
      for (const it of u.items) { if (x + it.w > maxW && cur.length) flush(); cur.push({ items: [it], w: it.w }); x += it.w; }
      continue;
    }
    cur.push(u); x += u.w;
  }
  if (cur.length || !lines.length) flush();
  const out = lines.map(us => {
    while (us.length && us[us.length - 1].ch === ' ') us.pop();
    const items = [];
    let px = 0;
    for (const u of us) for (const it of u.items) { items.push({ ...it, x: px }); px += it.w; }
    return { items, w: px };
  });
  const w = Math.max(0, ...out.map(L => L.w));
  return { lines: out, w, h: out.length * lineH * size, lineH: lineH * size, size };
}

// Every character in a script string (for the font subset), emoji tokens removed.
export function charsOf(text) {
  return text.replace(/\[([a-z_0-9]+)\]/g, '');
}
