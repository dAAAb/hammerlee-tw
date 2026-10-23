// Boot: load the letters and the photo list, pick (or replay) a conversation, start the app and the loop,
// and hang the sheets (viewer, share), the badge celebration and record-keeping on the app's hooks.
import * as THREE from 'three';
import { Stage } from './engine/stage.js';
import { floorMaterial } from './engine/toon.js';
import { GlyphFont } from './text/font.js';
import { randomChat, replayChat, SCRIPT_VERSION } from './chat/generate.js';
import { PHOTOS, CARDS, ELDER } from './chat/script.js';
import { STICKERS } from './models/catalog.js';
import { App } from './app.js';
import { TEXT_LAYER_CSS } from './ui/textlayer.js';
import { SHEET_CSS, openSheet, button, linkButton, para, picture, placeholder, toast } from './ui/sheet.js';
import { elderTexture, elderCanvas } from './share/elder.js';
import { makeBadge, ensureEnvironment, shortId } from './models/badge.js';
import { shareCard, longImage, badgeCanvas, stickerCanvas } from './share/export.js';
import { saveFile, shareFiles, copyText, canvasBlob, shareUrl, lineShareLink, recordChat, uploadShareImage, attachShareImage, inArtifact } from './share/platform.js';
import { burst } from './fx/confetti.js';
import { Runner } from './fx/runner.js';
import { registerModels } from './models/registry.js';
import { makeEmoji } from './models/emoji.js';
import { createMeSticker } from './models/stickers-me.js';
import { createChuanSticker } from './models/stickers-chuan.js';
import { createChuanAvatar, createChuanHead } from './models/chuan-avatar.js';
import { createChuan } from './models/chuan.js';

registerModels({ makeEmoji, createMeSticker, createChuanSticker, createChuanAvatar, createChuan, createChuanHead });

const style = document.createElement('style');
style.textContent = TEXT_LAYER_CSS + SHEET_CSS;
document.head.append(style);

const q = new URLSearchParams(location.search);
const stage = new Stage(document.getElementById('stage'));
const [font, photoAspect] = await Promise.all([
  GlyphFont.load('glyphs.txt'),
  fetch('photos/index.json').then(r => r.json()).catch(() => ({})),
]);
ensureEnvironment(stage.renderer, stage.scene);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), floorMaterial());
floor.receiveShadow = true;
stage.scene.add(floor);
stage.onBeforeRender.push(() => { floor.position.x = stage.rig.target.x; floor.position.z = stage.rig.target.z; });

// a shared link carries the conversation id: #c-<hex>
const m = location.hash.match(/^#c-([0-9A-Fa-f]+)$/);
const replay = !!m;
const chat = replay ? replayChat(m[1]) : randomChat();
const serial = shortId(chat.id);

const textures = new Map();
const loader = new THREE.TextureLoader();
function loadPhoto(id) {
  if (!textures.has(id)) {
    const t = loader.load(`photos/${id}.jpg`, () => { stage.dirty = true; });
    t.anisotropy = 4;
    textures.set(id, t);
  }
  return textures.get(id);
}
const builderOpts = { photoAspect, loadPhoto, makeElder: id => elderTexture(font, id), makeBadge: () => makeBadge(chat.id, font) };

let confetti = null;
let runner = null;
const app = new App({
  stage, font, chat, ...builderOpts,
  hooks: {
    skipIntro: q.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches,
    replay,
    tap: onTap,
    share: openShare,
    reveal(it) {
      if (it.kind === 'badge') confetti = burst(stage.scene, new THREE.Vector3(0, 0, it.z + it.h / 2), matchMedia('(prefers-reduced-motion: reduce)').matches ? 24 : 90);
    },
    ended() {
      recordChat({ id: chat.id, serial, topics: chat.topics, script: SCRIPT_VERSION });
      try { localStorage.setItem('hl:mine', chat.id); } catch (e) { /* private mode */ }
    },
    frame(dt) { if (confetti && !confetti.update(dt)) confetti = null; runner?.update(dt); },
    topic() { runner?.topic(); },
    avatarTap() { runner?.summon(); },
    tapExtra(rc) { return runner?.hit(rc) || false; },
  },
});
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
runner = q.has('norunner') ? null : new Runner(app, createChuan, { calm });
if (q.has('debug')) window.__runner = runner;
window.__app = app;
if (q.has('at')) app.jumpTo(+q.get('at'));
if (q.has('debug')) window.__hl = { stage, font, chat, builderOpts, shareCard, longImage, badgeCanvas, stickerCanvas };

// ---------------------------------------------------------------------------------------------------
// copying from the selectable text layer: one message per line, emoji as real emoji
document.addEventListener('copy', e => {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !document.getElementById('textlayer').contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  const parts = [];
  for (const el of document.querySelectorAll('#textlayer .tl')) {
    if (!range.intersectsNode(el)) continue;
    const r = document.createRange(); r.selectNodeContents(el);
    if (range.compareBoundaryPoints(Range.START_TO_START, r) > 0) r.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, r) < 0) r.setEnd(range.endContainer, range.endOffset);
    parts.push(r.toString().replace(/\n/g, ''));
  }
  if (!parts.length) return;
  e.clipboardData.setData('text/plain', parts.join('\n'));
  e.preventDefault();
  toast('已複製');
});

// ---------------------------------------------------------------------------------------------------
// tapping things in the chat
async function saveCanvas(cv, name) {
  const r = await saveFile(name, await canvasBlob(cv));
  if (r === 'saved') toast('已存好囉');
  else if (r === 'unavailable') toast('這裡不能下載，請長按圖片儲存');
}
async function shareCanvas(cv, name, text) {
  const blob = await canvasBlob(cv);
  const file = new File([blob], name, { type: 'image/png' });
  const ok = await shareFiles({ title: '跟川伯聊天', text, url: shareUrl(chat.id), files: [file] });
  if (!ok) { await copyText(shareUrl(chat.id)); toast('邀請連結已複製'); }
}

function viewer({ title, canvas, src, filename, alt, shareText }) {
  openSheet({ title }, sheet => {
    sheet.append(canvas ? picture(canvas, alt) : picture(src, alt));
    const acts = document.createElement('div');
    acts.className = 'acts two';
    const getCanvas = async () => {
      if (canvas) return canvas;
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
      return c;
    };
    acts.append(button('下載圖片', async () => saveCanvas(await getCanvas(), filename), 'main'));
    acts.append(button(inArtifact ? '複製邀請連結' : '分享給朋友', async () => {
      if (inArtifact) { await copyText(shareUrl(chat.id)); toast('邀請連結已複製'); }
      else shareCanvas(await getCanvas(), filename, shareText || title);
    }));
    sheet.append(acts);
  });
}

const safeName = s => s.replace(/[\\/:*?"<>|！～…]/g, '');

function onTap(h) {
  switch (h.type) {
    case 'sticker': {
      const s = STICKERS[h.id];
      viewer({ title: `貼圖「${s?.text || ''}」`, canvas: stickerCanvas(stage, font, h.id, h.who), filename: safeName(`川伯貼圖-${s?.text || h.id}.png`), alt: s?.text });
      break;
    }
    case 'photo':
      viewer({ title: PHOTOS[h.id]?.alt || '川伯傳來的照片', src: `photos/${h.id}.jpg`, filename: `川伯-${h.id}.png`, alt: PHOTOS[h.id]?.alt });
      break;
    case 'elder': {
      const e = ELDER[h.id];
      viewer({ title: '川伯送你的長輩圖', canvas: elderCanvas(font, h.id), filename: `長輩圖-${e.lines.join('')}.png`, alt: e.lines.join(' ') });
      break;
    }
    case 'badge':
      viewer({ title: '我的新北事民徽章', canvas: badgeCanvas(stage, font, chat.id, 900, 'iso'), filename: `新北事民徽章-${serial}.png`, alt: `新北事民徽章 No. ${serial}`, shareText: `我拿到了新北事民徽章 No. ${serial}！` });
      break;
    case 'link': case 'card': {
      const cd = CARDS[h.id] || Object.values(CARDS).find(c => c.title === h.title);
      if (!cd) break;
      openSheet({ title: cd.title }, sheet => {
        for (const l of cd.lines) sheet.append(para('・' + l));
        const acts = document.createElement('div'); acts.className = 'acts';
        acts.append(linkButton('打開完整政見（新視窗）', cd.link, 'main'));
        sheet.append(acts);
      });
      break;
    }
    case 'avatar':
      app.hooks.avatarTap?.();
      break;
  }
}

// ---------------------------------------------------------------------------------------------------
// the share sheet at the end
function openShare() {
  if (replay) {
    openSheet({ title: '換你跟川伯聊天！' }, sheet => {
      sheet.append(para('這是朋友跟川伯的對話。每個人跟川伯聊的內容都不一樣，你的也會是獨一無二的。'));
      const acts = document.createElement('div'); acts.className = 'acts';
      acts.append(button('開始我自己的對話', () => { location.hash = ''; location.reload(); }, 'main'));
      sheet.append(acts);
    });
    return;
  }
  const url = shareUrl(chat.id);
  const invite = '我剛跟未來新北市長李四川聊天，還拿到專屬的新北事民徽章！你也來跟川伯聊聊天吧';
  openSheet({ title: '分享我跟川伯的對話' }, sheet => {
    sheet.append(para(`這段對話全世界只有你有。徽章編號 No. ${serial}`));
    const ph = placeholder('分享圖製作中…');
    sheet.append(ph);
    let card = null;
    requestAnimationFrame(() => setTimeout(() => {
      card = shareCard(stage, font, chat, builderOpts);
      ph.replaceWith(picture(card, '分享圖：我跟未來新北市長李四川的對話'));
      // production: the card becomes the link preview picture
      canvasBlob(card).then(b => uploadShareImage(serial, b)).then(u => attachShareImage(chat.id, u));
    }, 30));
    const acts = document.createElement('div'); acts.className = 'acts';
    const native = !inArtifact && !!navigator.share;
    if (native) acts.append(button('分享給朋友…', async () => { if (card) shareCanvas(card, '跟川伯聊天.png', invite); }, 'main'));
    acts.append(linkButton('傳給 LINE 好友', lineShareLink(url, invite), native ? 'line' : 'line main'));
    acts.append(button('複製邀請連結', async () => { toast((await copyText(invite + ' ' + url)) ? '邀請連結已複製' : '請長按連結複製'); }));
    const two = document.createElement('div'); two.className = 'acts two';
    two.append(button('下載分享圖', async () => { if (card) saveCanvas(card, `跟川伯聊天-${serial}.png`); }));
    two.append(button('下載徽章', async () => saveCanvas(badgeCanvas(stage, font, chat.id, 900, 'iso'), `新北事民徽章-${serial}.png`)));
    sheet.append(acts, two);
    const longBtn = button('下載整段對話長圖', async () => {
      longBtn.disabled = true; longBtn.textContent = '長圖製作中…';
      const cv = await longImage(stage, font, chat, builderOpts, { onProgress: p => { longBtn.textContent = `長圖製作中… ${Math.round(p * 100)}%`; } });
      longBtn.textContent = '下載整段對話長圖'; longBtn.disabled = false;
      saveCanvas(cv, `我跟川伯的對話-${serial}.png`);
    });
    const one = document.createElement('div'); one.className = 'acts'; one.append(longBtn);
    sheet.append(one);
    sheet.append(para('朋友打開連結，會看到跟你一模一樣的這段對話，看完也能開始他自己的。', 'note'));
    const again = document.createElement('div'); again.className = 'acts';
    again.append(button('跟川伯再聊一次（換一段新的）', () => { location.hash = ''; location.reload(); }));
    sheet.append(again);
  });
}

document.getElementById('boot').classList.add('gone');
// Full rate while scrolling, revealing or while 川哥 runs; half rate when the chat just sits there.
let last = performance.now(), skip = false;
function loop(now) {
  requestAnimationFrame(loop);
  const busy = app.isBusy() || runner?.state !== 'off' || !!confetti || document.querySelector('.sheet-back');
  if (!busy && (skip = !skip)) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.frame(dt);
  stage.render();
}
requestAnimationFrame(loop);
