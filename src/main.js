// Boot: load the letters and the photo list, pick (or replay) a conversation, start the app and the loop,
// and hang the sheets (viewer, share), the badge celebration and record-keeping on the app's hooks.
import * as THREE from 'three';
import { Stage } from './engine/stage.js';
import { floorMaterial, setShadowStrength } from './engine/toon.js';
import { textLook, TEXT_DEPTH } from './chat/objects.js';
import { GlyphFont } from './text/font.js';
import { randomChat, replayChat, SCRIPT_VERSION } from './chat/generate.js';
import { PHOTOS, CARDS, ELDER } from './chat/script.js';
import { STICKERS } from './models/catalog.js';
import { App } from './app.js';
import { TEXT_LAYER_CSS } from './ui/textlayer.js';
import { SHEET_CSS, openSheet, button, linkButton, para, picture, placeholder, toast } from './ui/sheet.js';
import { elderTexture, elderCanvas } from './share/elder.js';
import { makeBadge, ensureEnvironment, shortId } from './models/badge.js';
import { shareCard, longImage, badgeCanvas, stickerCanvas, renderSnippet, pickSnippet } from './share/export.js';
import { saveFile, shareFiles, copyText, canvasBlob, shareUrl, lineShareLink, recordChat, uploadShareImage, attachShareImage, inArtifact } from './share/platform.js';
import { initAnalytics, setAnalytics, track, trackThen } from './share/analytics.js';
import { burst } from './fx/confetti.js';
import { Runner } from './fx/runner.js';
import { play, setFeel, soundFor, canVibrate } from './fx/feel.js';
import { Tilt } from './fx/tilt.js';
import { SideScenery } from './fx/scenery-side.js';
import { createScenery } from './models/scenery.js';
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
// viewer settings, remembered on this device only
const SETTINGS_KEY = 'hl:settings';
const saved = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; } })();
// usage statistics start before the letters load, so quick visits count too (設定 can turn them off)
initAnalytics(saved.stats !== false, { dry: q.has('ga-dry') });
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
const mode = replay ? 'replay' : 'own';
if (replay) track('replay_view');

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
let scenery = null;

// the look defaults are the easiest to read; people can make it more 3D or more hand-drawn in 設定
const LOOK_DEFAULTS = { depth: TEXT_DEPTH, shadow: 1, hand: 1 };
const settings = { sound: false, vibrate: false, tilt: false, stats: true, ...LOOK_DEFAULTS, ...saved };
function applyLook() {
  textLook.depth = settings.depth;
  setShadowStrength(settings.shadow);
  stage.ink.uniforms.hand.value = settings.hand;
}
applyLook();
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } };
const tilt = new Tilt(stage);
// sound needs a tap before it may play, so a remembered "on" starts at the first touch
if (settings.sound || settings.vibrate) addEventListener('pointerdown', () => setFeel({ sound: settings.sound, vibrate: settings.vibrate }), { once: true });
if (settings.tilt) addEventListener('pointerdown', () => tilt.enable(), { once: true });
// how far people get: the first message, then each quarter of the chat
let started = false, quarters = 0;
function progress(it, i, n) {
  if (it.kind === 'cover' || it.kind === 'date') return;
  if (!started) { started = true; track('chat_start', { mode }); }
  const k = Math.min(3, Math.floor(4 * (i + 1) / n));
  while (quarters < k) track('chat_progress', { percent: ++quarters * 25, mode });
}
const app = new App({
  stage, font, chat, ...builderOpts,
  hooks: {
    skipIntro: q.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches,
    replay,
    tap: onTap,
    share: openShare,
    reveal(it, i, n) {
      progress(it, i, n);
      scenery?.reveal(it);
      if (it.kind === 'badge') confetti = burst(stage.scene, new THREE.Vector3(0, 0, it.z + it.h / 2), matchMedia('(prefers-reduced-motion: reduce)').matches ? 24 : 90);
    },
    ended() {
      track('chat_complete', { mode });
      recordChat({ id: chat.id, serial, topics: chat.topics, script: SCRIPT_VERSION });
      try { localStorage.setItem('hl:mine', chat.id); } catch (e) { /* private mode */ }
    },
    frame(dt) { if (confetti && !confetti.update(dt)) confetti = null; runner?.update(dt); scenery?.update(dt); },
    relayout() { scenery?.reset(); },
    topic(t) { runner?.topic(); track('topic_view', { topic: t.id, category: t.cat }); },
    avatarTap() { runner?.summon(); },
    tapExtra(rc, d, at) { const hit = runner?.hit(rc, at) || false; if (hit) track('runner_tap'); return hit; },
    press(id) {
      if (id === 'bye') track('fast_forward');
      else if (id === 'auto') track('auto_chat', { state: app.auto ? 'on' : 'off' });
      else if (id === 'big') track('setting_change', { setting: 'big_text', state: app.big ? 'on' : 'off' });
    },
    settings: openSettings,
    feel(it) { const n = soundFor(it); if (n) play(n); },
    key() { play('key'); },
    tilt(dt) { tilt.update(dt); },
  },
});
// starting over reloads the page, so the event goes out first
const restart = (name, params) => trackThen(name, params, () => { location.hash = ''; location.reload(); });

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
runner = q.has('norunner') ? null : new Runner(app, createChuan, { calm, sfx: play });
scenery = new SideScenery(app, createScenery);
if (q.has('debug')) window.__runner = runner;
window.__app = app;
if (q.has('at')) app.jumpTo(+q.get('at'));
if (q.has('debug')) window.__hl = { stage, font, chat, builderOpts, shareCard, longImage, badgeCanvas, stickerCanvas, renderSnippet, pickSnippet };

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

function viewer({ title, canvas, src, filename, alt, shareText, kind = 'item' }) {
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
    acts.append(button('下載圖片', async () => { track('share', { method: 'download', content_type: kind }); saveCanvas(await getCanvas(), filename); }, 'main'));
    acts.append(button(inArtifact ? '複製邀請連結' : '分享給朋友', async () => {
      track('share', { method: inArtifact ? 'copy_link' : 'native', content_type: kind });
      if (inArtifact) { await copyText(shareUrl(chat.id)); toast('邀請連結已複製'); }
      else shareCanvas(await getCanvas(), filename, shareText || title);
    }));
    sheet.append(acts);
  });
}

const safeName = s => s.replace(/[\\/:*?"<>|！～…]/g, '');

function onTap(h) {
  if (h.type !== 'avatar' && h.type !== 'bubble') track('open_item', { item_type: h.type, item_id: h.id || h.title || '' });
  switch (h.type) {
    case 'sticker': {
      const s = STICKERS[h.id];
      viewer({ title: `貼圖「${s?.text || ''}」`, canvas: stickerCanvas(stage, font, h.id, h.who), filename: safeName(`川伯貼圖-${s?.text || h.id}.png`), alt: s?.text, kind: h.type });
      break;
    }
    case 'photo':
      viewer({ title: PHOTOS[h.id]?.alt || '川伯傳來的照片', src: `photos/${h.id}.jpg`, filename: `川伯-${h.id}.png`, alt: PHOTOS[h.id]?.alt, kind: h.type });
      break;
    case 'elder': {
      const e = ELDER[h.id];
      viewer({ title: '川伯送你的長輩圖', canvas: elderCanvas(font, h.id), filename: `長輩圖-${e.lines.join('')}.png`, alt: e.lines.join(' '), kind: h.type });
      break;
    }
    case 'badge':
      viewer({ title: '我的新北事民徽章', canvas: badgeCanvas(stage, font, chat.id, 900, 'iso'), filename: `新北事民徽章-${serial}.png`, alt: `新北事民徽章 No. ${serial}`, shareText: `我拿到了新北事民徽章 No. ${serial}！`, kind: h.type });
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
// settings and credits
function toggle(label, note, on, onChange) {
  const row = document.createElement('div'); row.className = 'set-row';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'switch'; b.setAttribute('role', 'switch');
  const paint = v => { b.setAttribute('aria-checked', String(v)); b.textContent = v ? '開' : '關'; };
  paint(on);
  b.addEventListener('click', async () => { const v = b.getAttribute('aria-checked') !== 'true'; paint(await onChange(v)); });
  const txt = document.createElement('div'); txt.className = 'set-txt';
  const l = document.createElement('label'); l.textContent = label;
  const n = document.createElement('small'); n.textContent = note;
  txt.append(l, n);
  row.append(txt, b);
  b.setAttribute('aria-label', label);
  return row;
}

// a big, finger-friendly slider with words for its ends
function slider(label, note, { min, max, step, value, words }, onInput) {
  const row = document.createElement('div'); row.className = 'set-row set-col';
  const id = 'sl-' + label;
  const l = document.createElement('label'); l.textContent = label; l.htmlFor = id;
  const n = document.createElement('small'); n.textContent = note;
  const r = document.createElement('input');
  Object.assign(r, { type: 'range', id, min, max, step, value });
  const ends = document.createElement('div'); ends.className = 'ends';
  ends.innerHTML = `<span>${words[0]}</span><span>${words[1]}</span>`;
  let t = null;
  r.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => onInput(+r.value), 60); });
  const txt = document.createElement('div'); txt.className = 'set-txt';
  txt.append(l, n);
  row.append(txt, r, ends);
  row.querySelector('input').value = value;
  return row;
}

function openSettings() {
  openSheet({ title: '設定與說明' }, sheet => {
    sheet.append(toggle('訊息提示音', '每則訊息出現時「叮咚」一聲。', settings.sound, v => {
      settings.sound = v; saveSettings(); setFeel({ sound: v }); track('setting_change', { setting: 'sound', state: v ? 'on' : 'off' }); return v;
    }));
    sheet.append(toggle('震動', canVibrate() ? '每則訊息出現時手機輕輕震一下。' : '這支手機或瀏覽器不支援網頁震動（iPhone 目前都不支援）。', settings.vibrate && canVibrate(), v => {
      if (!canVibrate()) { toast('這裡不支援震動'); return false; }
      settings.vibrate = v; saveSettings(); setFeel({ vibrate: v }); track('setting_change', { setting: 'vibrate', state: v ? 'on' : 'off' }); return v;
    }));
    sheet.append(toggle('立體視角', '轉動手機（電腦上是移動滑鼠），光影和角度會跟著微微改變。iPhone 會先問你是否允許使用動作感應。', settings.tilt, async v => {
      settings.tilt = v; saveSettings();
      track('setting_change', { setting: 'tilt', state: v ? 'on' : 'off' });
      if (!v) { tilt.disable(); return false; }
      const r = await tilt.enable();
      if (r === 'pointer-only') toast('沒有取得動作感應權限，電腦上可用滑鼠體驗');
      return true;
    }));
    sheet.append(toggle('大字', '把聊天的字放大 1.2 倍。', app.big, v => { app.press('big'); return app.big; }));
    if (!inArtifact) sheet.append(toggle('匿名使用統計', '用 Google Analytics 計算有多少人來聊天、聊到哪裡、有沒有分享，幫團隊把網頁做得更好。不會知道你是誰；關掉就不再傳送。', settings.stats, v => {
      settings.stats = v; saveSettings(); setAnalytics(v); return v;
    }));
    const head = document.createElement('h3'); head.className = 'set-head'; head.textContent = '畫面風格';
    sheet.append(head);
    sheet.append(slider('字的立體厚度', '字從泡泡上浮起來多高。', { min: 0.03, max: 0.32, step: 0.01, value: settings.depth, words: ['平平的，好讀', '厚厚的，很立體'] }, v => {
      settings.depth = v; saveSettings(); applyLook(); app.rebuildAll();
    }));
    sheet.append(slider('陰影濃淡', '泡泡、貼圖投在地上的藍色影子。', { min: 0, max: 1.4, step: 0.05, value: settings.shadow, words: ['淡', '濃'] }, v => {
      settings.shadow = v; saveSettings(); applyLook();
    }));
    sheet.append(slider('手繪感', '墨線的手繪抖動和紙張紋理。', { min: 0, max: 1.6, step: 0.05, value: settings.hand, words: ['乾淨俐落', '手繪感重'] }, v => {
      settings.hand = v; saveSettings(); applyLook();
    }));
    const reset = document.createElement('div'); reset.className = 'acts';
    reset.append(button('畫面恢復預設（最好讀）', () => {
      Object.assign(settings, LOOK_DEFAULTS); saveSettings(); applyLook(); app.rebuildAll();
      sheet.querySelectorAll('input[type=range]').forEach((r, i) => { r.value = [settings.depth, settings.shadow, settings.hand][i]; });
      toast('已恢復預設');
    }));
    sheet.append(reset);
    const again = document.createElement('div'); again.className = 'acts';
    again.append(button('跟川伯重新聊一次（換一段新的）', () => restart('chat_again', { from: 'settings' })));
    sheet.append(again);
    const about = document.createElement('div'); about.className = 'about';
    about.innerHTML = `
      <h3>關於這個網頁</h3>
      <p>這是李四川（川伯）競選團隊的互動網頁。內容依據川伯的公開政見與經歷整理，照片與政見圖卡取自
      <a href="https://portaly.cc/hammerlee" target="_blank" rel="noopener">李四川官方 Portaly</a>。</p>
      <h3>隱私</h3>
      <p>不需要登入，也不會要你輸入任何資料。對話結束時，只會記錄這段對話的編號、聊到的話題和時間，用來讓分享連結顯示預覽圖；
      設定只存在你自己的手機裡。立體視角只在你的手機上計算，不會傳出去。</p>
      <p>為了知道有多少人來聊天、聊到哪裡、有沒有分享給朋友，我們用 Google Analytics 做匿名統計：它會在你的瀏覽器存一個識別碼（Cookie），
      Google 會收到你的大概地區、裝置類型和在這頁上的動作，但不會知道你是誰，也沒有開啟廣告追蹤。不想被統計，把上面的「匿名使用統計」關掉就好。</p>
      <h3>開源授權與致謝</h3>
      <ul>
        <li><a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> — MIT License</li>
        <li><a href="https://github.com/justfont/Huninn" target="_blank" rel="noopener">jf 粉圓 Huninn</a> — SIL Open Font License 1.1</li>
        <li><a href="https://github.com/chiron-fonts/chiron-goround-tc" target="_blank" rel="noopener">Chiron GoRound TC</a> — SIL Open Font License 1.1</li>
        <li>畫風參考 <a href="https://april-zhu.com/colorfigures" target="_blank" rel="noopener">Colorfigures</a>（April Zhu）— MIT License</li>
        <li>Google Fonts 提供網頁字型服務；Google Analytics 提供匿名使用統計</li>
      </ul>
      <p class="note">對話編號 No. ${serial}</p>`;
    sheet.append(about);
  });
}

// ---------------------------------------------------------------------------------------------------
// the share sheet at the end
function openShare() {
  track('share_open', { mode });
  if (replay) {
    openSheet({ title: '換你跟川伯聊天！' }, sheet => {
      sheet.append(para('這是朋友跟川伯的對話。每個人跟川伯聊的內容都不一樣，你的也會是獨一無二的。'));
      const acts = document.createElement('div'); acts.className = 'acts';
      acts.append(button('開始我自己的對話', () => restart('start_own_chat', { from: 'replay' }), 'main'));
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
    const shared = method => track('share', { method, content_type: 'chat' });
    if (native) acts.append(button('分享給朋友…', async () => { if (card) { shared('native'); shareCanvas(card, '跟川伯聊天.png', invite); } }, 'main'));
    const line = linkButton('傳給 LINE 好友', lineShareLink(url, invite), native ? 'line' : 'line main');
    line.addEventListener('click', () => shared('line'));
    acts.append(line);
    acts.append(button('複製邀請連結', async () => { shared('copy_link'); toast((await copyText(invite + ' ' + url)) ? '邀請連結已複製' : '請長按連結複製'); }));
    const two = document.createElement('div'); two.className = 'acts two';
    two.append(button('下載分享圖', async () => { if (card) { shared('download_card'); saveCanvas(card, `跟川伯聊天-${serial}.png`); } }));
    two.append(button('下載徽章', async () => { shared('download_badge'); saveCanvas(badgeCanvas(stage, font, chat.id, 900, 'iso'), `新北事民徽章-${serial}.png`); }));
    sheet.append(acts, two);
    const longBtn = button('下載整段對話長圖', async () => {
      shared('download_long');
      longBtn.disabled = true; longBtn.textContent = '長圖製作中…';
      const cv = await longImage(stage, font, chat, builderOpts, { onProgress: p => { longBtn.textContent = `長圖製作中… ${Math.round(p * 100)}%`; } });
      longBtn.textContent = '下載整段對話長圖'; longBtn.disabled = false;
      saveCanvas(cv, `我跟川伯的對話-${serial}.png`);
    });
    const one = document.createElement('div'); one.className = 'acts'; one.append(longBtn);
    sheet.append(one);
    sheet.append(para('朋友打開連結，會看到跟你一模一樣的這段對話，看完也能開始他自己的。', 'note'));
    const again = document.createElement('div'); again.className = 'acts';
    again.append(button('跟川伯再聊一次（換一段新的）', () => restart('chat_again', { from: 'share' })));
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
