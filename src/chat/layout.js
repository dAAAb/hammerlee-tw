// Lay the conversation out on the floor like a LINE chat room: 川伯 on the left with his round avatar,
// the user on the right in green, stickers and photos without bubbles, a date pill at the top.
// All sizes are in em. Output items carry everything the builders and the timeline need.
import { layoutText } from '../text/layout.js';
import { CARDS } from './script.js';
import { mulberry32, hashString } from './dsl.js';

export const BUBBLE = { pad: 0.62, padY: 0.5, thick: 0.55, radius: 0.85, lineH: 1.42 };
export const SIZES = {
  avatar: 2.3, margin: 0.45, avatarGap: 0.5, rightMargin: 0.8, timeReserve: 2.6,
  gapSame: 0.42, gapOther: 1.0, nameH: 0.95,
  sticker: { w: 5.6, d: 5.2 }, photoW: 10.2, cardW: 11.2, elderW: 10.2, badge: 9.4,
};

export function columnWidth(viewW) { return Math.min(Math.max(viewW, 12), 22); }

// Clock labels the way LINE shows them: 上午 9:41 / 下午 3:12
export function clockLabel(d) {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '上午' : '下午'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

export function layoutChat(chat, font, opts) {
  const { viewW, start = new Date(), photoAspect = {} } = opts;
  const W = columnWidth(viewW);
  const left = -W / 2, right = W / 2;
  // narrow columns (big text on a phone) give the words the room: smaller avatar, no clock, only 已讀
  const compact = W < 15.5;
  const S = compact ? { ...SIZES, avatar: 1.9, avatarGap: 0.38, timeReserve: 1.25, margin: 0.35, rightMargin: 0.6 } : SIZES;
  const bubbleMaxLeft = W - S.margin - S.avatar - S.avatarGap - S.timeReserve;
  const bubbleMaxRight = W - S.rightMargin - S.timeReserve - 0.4;
  const items = [];
  let z = 0;                 // top of the next item
  let prevWho = null;
  let minute = 0;
  const clock = new Date(start.getTime());
  const rng = mulberry32(hashString(String(chat.id))[0]);

  // the cover sits above the first message (not in snippets or replays of a few lines)
  if (opts.cover) { items.push({ msg: { kind: 'cover' }, kind: 'cover', z: 0, h: 9.2, x: 0, w: W, who: 'sys' }); z = 9.2; }

  for (const msg of chat.msgs) {
    if (msg.kind === 'topic') { items.push({ msg, kind: 'topic', z, h: 0, x: 0, w: 0 }); continue; }
    const who = msg.who;
    const run = who === prevWho && who !== 'sys';
    const gap = items.length === 0 || (items.length === 1 && items[0].kind === 'cover') ? 0.6 : run ? S.gapSame : S.gapOther;
    z += gap;
    // a minute passes every few messages, like a real chat
    if (who !== 'sys' && rng() < 0.45) { minute++; clock.setMinutes(clock.getMinutes() + 1); }
    const it = { msg, kind: msg.kind, who, z, run, first: !run, time: compact ? '' : clockLabel(clock), compact, S };
    const isLeft = who === 'chuan';
    const xStart = isLeft ? left + S.margin + S.avatar + S.avatarGap : null;
    if (isLeft && !run) { it.nameZ = z; z += S.nameH; it.z = z; }   // "李四川" above the first bubble of a run

    switch (msg.kind) {
      case 'date': {
        it.text = opts.replay ? '朋友分享給你的對話' : `今天 ${clockLabel(clock)}`;
        it.w = font.measure(it.text, 0.62) + 1.4; it.h = 1.25; it.x = -it.w / 2;
        break;
      }
      case 'end': {
        it.text = '對話到這裡告一段落囉';
        it.w = font.measure(it.text, 0.62) + 1.4; it.h = 1.25; it.x = -it.w / 2;
        break;
      }
      case 'text': {
        const maxW = (isLeft ? bubbleMaxLeft : bubbleMaxRight) - BUBBLE.pad * 2;
        const L = layoutText(font, msg.text, maxW, 1, { lineH: BUBBLE.lineH });
        it.text = L;
        it.w = Math.max(L.w + BUBBLE.pad * 2, 2.6);
        it.h = L.h + BUBBLE.padY * 2;
        it.x = isLeft ? xStart : right - S.rightMargin - it.w;
        break;
      }
      case 'sticker': {
        it.w = S.sticker.w; it.h = S.sticker.d;
        it.x = isLeft ? xStart - 0.3 : right - S.rightMargin - it.w;
        break;
      }
      case 'photo': {
        const a = photoAspect[msg.id] || 1;
        it.w = Math.min(S.photoW, bubbleMaxLeft + 0.6); it.h = it.w / a + 0.8; // frame border
        it.x = xStart;
        break;
      }
      case 'elder': {
        it.w = Math.min(S.elderW, bubbleMaxLeft + 0.6); it.h = it.w * 1.25 + 0.8;
        it.x = xStart;
        break;
      }
      case 'card': {
        const cd = CARDS[msg.id];
        it.card = cd;
        it.w = Math.min(S.cardW, bubbleMaxLeft + 0.6);
        it.h = 2.3 + cd.lines.length * 1.25 + 2.0;
        it.x = xStart;
        break;
      }
      case 'badge': {
        it.w = S.badge; it.h = S.badge + 1.4;
        it.x = -it.w / 2 + 1.0;
        break;
      }
    }
    if (who === 'me') it.read = true;
    z += it.h;
    items.push(it);
    prevWho = who;
  }
  return { items, height: z, W, left, right, S };
}
