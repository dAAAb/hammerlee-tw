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
import { shareCard, longImage, badgeCanvas, stickerCanvas, renderSnippet, pickSnippet, buildCard } from './share/export.js';
import { saveFile, shareFiles, copyText, canvasBlob, shareUrl, lineShareLink, recordChat, inArtifact } from './share/platform.js';
import { initAnalytics, setAnalytics, track, trackThen } from './share/analytics.js';
import { phaseAt } from './chat/calendar.js';
import { showDayNotice } from './ui/daynotice.js';
import { onPublicSite } from './config.js';
import { burst } from './fx/confetti.js';
import { Runner } from './fx/runner.js';
import { Builds, BUILDS, TIERS, collection } from './fx/builds.js';
import { play, setFeel, soundFor, canVibrate } from './fx/feel.js';
import { Tilt } from './fx/tilt.js';
import { SideScenery } from './fx/scenery-side.js';
import { createScenery } from './models/scenery.js';
import { registerModels, sticker as stickerModel } from './models/registry.js';
import { detectAR, canAR, support as arSupport, usdzURL, quickLookLink, startWebXR, AR_CSS } from './fx/ar.js';
import { makeEmoji } from './models/emoji.js';
import { createMeSticker } from './models/stickers-me.js';
import { createChuanSticker } from './models/stickers-chuan.js';
import { createChuanAvatar, createChuanHead } from './models/chuan-avatar.js';
import { createChuan } from './models/chuan.js';
import { Pair, pairTransport, isPairCode, MAX_PHONES } from './net/pair.js';
import { PAIR_CSS, openPairSheet, offerJoin, pairChip, pairInfo } from './ui/pair-ui.js';

registerModels({ makeEmoji, createMeSticker, createChuanSticker, createChuanAvatar, createChuan, createChuanHead });

const style = document.createElement('style');
style.textContent = TEXT_LAYER_CSS + SHEET_CSS + PAIR_CSS + AR_CSS;
document.head.append(style);

const q = new URLSearchParams(location.search);
// viewer settings, remembered on this device only
const SETTINGS_KEY = 'hl:settings';
const saved = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; } })();
// usage statistics start before the letters load, so quick visits count too (設定 can turn them off)
initAnalytics(saved.stats !== false, { dry: q.has('ga-dry') });
// 11/28 is voting day: no campaigning, so the page pauses for the day; afterwards it thanks people first and the
// chat can still be looked back on. ?day=YYYY-MM-DD tries a date, but never on the real site.
const testDay = !onPublicSite && /^\d{4}-\d\d-\d\d$/.test(q.get('day') || '') ? Date.parse(q.get('day') + 'T12:00:00+08:00') : undefined;
const phase = phaseAt(testDay);
if (phase !== 'campaign') { track('day_notice', { phase }); await showDayNotice(phase); }
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
let builds = null;

// the look defaults are the easiest to read; people can make it more 3D or more hand-drawn in 設定
const LOOK_DEFAULTS = { depth: TEXT_DEPTH, shadow: 1, hand: 1 };
const settings = { sound: false, vibrate: false, tilt: false, stats: true, pair: false, ...LOOK_DEFAULTS, ...saved };
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
    frame(dt) { if (confetti && !confetti.update(dt)) confetti = null; runner?.update(dt); builds?.update(dt); scenery?.update(dt); },
    relayout() { scenery?.reset(); builds?.reset(); },
    topic(t) { runner?.topic(); track('topic_view', { topic: t.id, category: t.cat }); },
    avatarTap() { runner?.summon(); },
    // holding a finger on 川哥 as he runs past: bring him into your room (AR)
    holdable(x, y, touch) {
      if (!runner || runner.state === 'off') return false;
      const ray = stage.ray(x, y);
      return runner.under(new THREE.Raycaster(ray.origin, ray.direction, 0, 1000), { x, y, touch });
    },
    hold() { play('boing'); openChuanAR(); },
    tapExtra(rc, d, at) {
      // 川哥 himself, then a build, then the finger-sized area around him
      if (runner?.hit(rc)) { track('runner_tap'); return true; }
      const b = builds?.hit(rc);
      if (b) { openBuild(b); return true; }
      const hit = runner?.hit(rc, at) || false;
      if (hit) track('runner_tap');
      return hit;
    },
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
// 川哥's builds: a model rises beside him now and then; tap it for its card
builds = new Builds(app, createScenery, {
  onBuilt(s) {
    const rare = s.b.tier === 'SSR' || s.b.tier === 'UR';
    play(rare ? 'badge' : 'built');
    track('build_made', { item_type: s.b.tier, item_id: s.b.id });
    if (rare) confetti = burst(stage.scene, new THREE.Vector3(s.x, 0, s.z), calm ? 20 : 60);
    toast(`${s.count[s.b.id] === 1 ? '新！' : ''}川哥做了一個「${s.b.name}」的小模型，點一下看看`, 3600);
  },
});
runner = q.has('norunner') ? null : new Runner(app, createChuan, { calm, sfx: play, builds });
scenery = new SideScenery(app, createScenery);
if (q.has('debug')) { window.__runner = runner; window.__builds = builds; }

// 多支手機一起玩 (實驗功能): off by default. Nothing is set up, and nothing connects, until it is turned on in 設定
// and someone presses 顯示配對碼 / 輸入配對碼, or says yes to the invitation a scanned QR code opens.
let pair = null;
function getPair() {
  if (!pair) {
    pair = new Pair({ runner });
    pairChip(pair, { top: () => app.chrome.headerH * app.chrome.unit * stage.emPx });
    if (q.has('debug')) window.__pair = pair;
  }
  return pair;
}
window.__app = app;
detectAR();
if (/^\d{1,3}$/.test(q.get('at') || '')) app.jumpTo(+q.get('at'));   // dev aid; anything else is ignored
if (q.has('debug')) window.__hl = { arSupport, usdzURL, stickerModel, makeBadge, standingBadge, makeChuanForAR, onTap: h => onTap(h), stage, font, chat, builderOpts, shareCard, longImage, badgeCanvas, stickerCanvas, renderSnippet, pickSnippet, buildCard, createScenery, BUILDS, TIERS };

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

const SOURCE = '取自李四川官方 Portaly（portaly.cc/hammerlee），版權屬原權利人';

function viewer({ title, canvas, src, filename, alt, shareText, kind = 'item', note, ar }) {
  let arDone = null;
  openSheet({ title, onClose: () => arDone?.() }, sheet => {
    sheet.append(canvas ? picture(canvas, alt) : picture(src, alt));
    if (note) sheet.append(para(note, 'note'));
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
    if (ar) arDone = arOffer(sheet, kind, ar.make, ar.size);
  });
}

// --- AR: "在你家擺擺看" ------------------------------------------------------------------------------------
// make() returns { group, update?(dt) } - a fresh copy of the 3D thing; size is how big it stands, in metres.
const ticking = (group, t0 = 0) => { let t = t0; return { group, update(dt) { t += dt; group.userData.tick?.(t, dt); } }; };
function arOffer(sheet, kind, make, size) {
  const label = '在你家擺擺看（AR）';
  const row = document.createElement('div'); row.className = 'acts';
  if (arSupport.quickLook) {
    // iPhone: the USDZ is made right away, so the tap can open Quick Look at once
    const a = quickLookLink('AR 準備中…', 'ar busy');
    let url = null;
    usdzURL(make().group, size).then(u => { url = u; a.href = u; a.lastChild.textContent = label; a.classList.remove('busy'); })
      .catch(() => { a.lastChild.textContent = '這個做不成 AR，抱歉'; });
    a.addEventListener('click', e => { if (!url) { e.preventDefault(); return; } track('ar_open', { item_type: kind, mode: 'quicklook' }); });
    row.append(a);
    sheet.append(row, para('會用手機的相機畫面，把它擺在桌上或地上；相機畫面不會傳給這個網站。', 'note'));
    return () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 60000); };
  }
  if (arSupport.webxr) {
    row.append(button(label, () => {
      track('ar_open', { item_type: kind, mode: 'webxr' });
      startWebXR(make, size).catch(() => toast('這支手機沒辦法打開 AR'));
    }, 'ar'));
    sheet.append(row, para('會用手機的相機畫面，把它擺在桌上或地上；相機畫面不會傳給這個網站。', 'note'));
    return null;
  }
  if (arSupport.line) sheet.append(para('用 Safari（iPhone）或 Chrome（Android）打開這個網頁，就能把它擺在你家（AR）。', 'note'));
  return null;
}

// the badge lies flat in the chat; on a real table it stands up, its face toward you
function standingBadge() {
  const b = makeBadge(chat.id, font), g = new THREE.Group();
  b.rotation.x = Math.PI / 2;
  g.add(b);
  let t = 0.6;
  b.userData.tick?.(t, 0);
  return { group: g, update(dt) { t += dt; b.userData.tick?.(t, dt); } };
}

// 川哥 himself, standing with his hammer and shovel
function makeChuanForAR() {
  const c = createChuan({ hat: true, tools: true });
  c.setFacing?.(0);
  c.play('idle');
  c.update(0.4);
  return { group: c.group, update: dt => c.update(dt) };
}
function openChuanAR() {
  track('ar_hold', { supported: canAR() ? 'yes' : 'no' });
  if (!canAR() && !arSupport.line) { toast('這支手機或瀏覽器不能用 AR。iPhone 請用 Safari，Android 請用 Chrome。', 3600); return; }
  let done = null;
  openSheet({ title: '把川哥帶回家', onClose: () => done?.() }, sheet => {
    sheet.append(para('小川哥可以站到你的桌上或地上，陪你一下下。'));
    done = arOffer(sheet, 'chuan', makeChuanForAR, 0.28);
  });
}

const safeName = s => s.replace(/[\\/:*?"<>|！～…]/g, '');

function openBuild(s) {
  track('open_item', { item_type: 'build', item_id: s.b.id });
  const have = Object.keys(collection()).filter(id => BUILDS.some(b => b.id === id)).length;
  viewer({
    title: `${s.b.tier}｜${s.b.name}`, canvas: buildCard(stage, font, createScenery, s.b, TIERS[s.b.tier], { have, total: BUILDS.length }),
    filename: safeName(`川哥的微縮建設-${s.b.name}.png`), alt: `川哥蓋的微縮模型：${s.b.name}`,
    shareText: `川哥幫我蓋了「${s.b.name}」（${s.b.tier}）！你也來跟川伯聊天`, kind: 'build',
    ar: { make: () => { const g = createScenery(s.b.model); g.userData.pop?.(1); return ticking(g, 1.3); }, size: 0.32 },
  });
}

function onTap(h) {
  if (h.type !== 'avatar' && h.type !== 'bubble') track('open_item', { item_type: h.type, item_id: h.id || h.title || '' });
  switch (h.type) {
    case 'sticker': {
      const s = STICKERS[h.id];
      viewer({ title: `貼圖「${s?.text || ''}」`, canvas: stickerCanvas(stage, font, h.id, h.who), filename: safeName(`川伯貼圖-${s?.text || h.id}.png`), alt: s?.text, kind: h.type,
        ar: { make: () => ticking(stickerModel(h.id, font, h.who), 0.6), size: 0.22 } });
      break;
    }
    case 'photo':
      viewer({ title: PHOTOS[h.id]?.alt || '川伯傳來的照片', src: `photos/${h.id}.jpg`, filename: `川伯-${h.id}.png`, alt: PHOTOS[h.id]?.alt, kind: h.type, note: '照片' + SOURCE });
      break;
    case 'elder': {
      const e = ELDER[h.id];
      viewer({ title: '川伯送你的長輩圖', canvas: elderCanvas(font, h.id), filename: `長輩圖-${e.lines.join('')}.png`, alt: e.lines.join(' '), kind: h.type });
      break;
    }
    case 'badge':
      viewer({ title: '我的新北事民徽章', canvas: badgeCanvas(stage, font, chat.id, 900, 'iso'), filename: `新北事民徽章-${serial}.png`, alt: `新北事民徽章 No. ${serial}`, shareText: `我拿到了新北事民徽章 No. ${serial}！`, kind: h.type,
        ar: { make: standingBadge, size: 0.16 } });
      break;
    case 'link': case 'card': {
      const cd = CARDS[h.id] || Object.values(CARDS).find(c => c.title === h.title);
      if (!cd) break;
      openSheet({ title: cd.title }, sheet => {
        for (const l of cd.lines) sheet.append(para('・' + l));
        const acts = document.createElement('div'); acts.className = 'acts';
        acts.append(linkButton('打開完整政見（新視窗）', cd.link, 'main'));
        sheet.append(acts, para('政見圖文' + SOURCE, 'note'));
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
    const lab = document.createElement('h3'); lab.className = 'set-head'; lab.textContent = '實驗功能';
    sheet.append(lab);
    const pairBox = document.createElement('div'); pairBox.className = 'acts';
    const paintPair = () => {
      pairBox.replaceChildren();
      if (settings.pair) pairBox.append(button(pair && pair.phase !== 'idle' ? '配對狀態／結束配對' : '開始配對', () => openPairSheet(getPair()), 'main'));
    };
    sheet.append(toggle('多支手機一起玩', `把 2～${MAX_PHONES} 支手機排好平放，小川哥會從一支跑到下一支，手機越多跑越快。打開以後，要按「開始配對」才會連線。`, settings.pair, v => {
      if (v && !pairTransport) { toast('這裡不能用，請到 hammerlee.tw 試試'); return false; }
      settings.pair = v; saveSettings();
      track('setting_change', { setting: 'pair', state: v ? 'on' : 'off' });
      if (!v) pair?.end('off');
      paintPair();
      return v;
    }));
    sheet.append(pairInfo(), pairBox);
    paintPair();
    const again = document.createElement('div'); again.className = 'acts';
    again.append(button('跟川伯重新聊一次（換一段新的）', () => restart('chat_again', { from: 'settings' })));
    sheet.append(again);
    const about = document.createElement('div'); about.className = 'about';
    about.innerHTML = `
      <h3>關於這個網頁</h3>
      <p>這是支持者 dAAAb 個人出資製作的粉絲創作，不是李四川競選團隊的官方網站。對話是模擬的，內容依據川伯的公開政見與經歷整理，照片與政見圖卡取自
      <a href="https://portaly.cc/hammerlee" target="_blank" rel="noopener">李四川官方 Portaly</a>。</p>
      <h3>隱私</h3>
      <p>不需要登入，也不會要你輸入任何資料。對話結束時，只會記錄這段對話的編號、聊到的話題和時間，用來讓分享連結顯示預覽圖；
      設定只存在你自己的手機裡。立體視角只在你的手機上計算，不會傳出去。用 AR 把東西擺在你家時，用的是手機自己的相機功能，相機畫面不會傳給這個網站。小川哥蓋的微縮建設圖鑑也只記在你的手機裡。</p>
      <p>為了知道有多少人來聊天、聊到哪裡、有沒有分享給朋友，我們用 Google Analytics 做匿名統計：它會在你的瀏覽器存一個識別碼（Cookie），
      Google 會收到你的大概地區、裝置類型和在這頁上的動作，但不會知道你是誰，也沒有開啟廣告追蹤。不想被統計，把上面的「匿名使用統計」關掉就好。</p>
      <p>「多支手機一起玩」是實驗功能，預設是關的。只有你打開它、按下配對以後才會連線：手機之間透過 Supabase 的即時訊息服務，
      只傳一組臨時的六位數配對碼、每支手機的號碼和排在哪裡（左右哪一邊、手指滑過的高度），和小川哥跑到哪裡、跑多快。
      不會用到你的位置（GPS）或藍牙，不會傳任何個人資料，也不會存進資料庫。結束配對或關掉網頁，連線就斷了。</p>
      <h3>開源授權與致謝</h3>
      <ul>
        <li><a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> — MIT License</li>
        <li><a href="https://github.com/justfont/Huninn" target="_blank" rel="noopener">jf 粉圓 Huninn</a> — SIL Open Font License 1.1</li>
        <li><a href="https://github.com/chiron-fonts/chiron-go-round-tc" target="_blank" rel="noopener">Chiron GoRound TC</a> — SIL Open Font License 1.1</li>
        <li>畫風與配色參考 <a href="https://april-zhu.com/colorfigures" target="_blank" rel="noopener">Colorfigures</a>（April Zhu、Tolga Cohce）— MIT License</li>
        <li><a href="https://github.com/unjs/uqr" target="_blank" rel="noopener">uqr</a>（配對用的 QR 碼）— MIT License</li>
        <li>Google Fonts 提供網頁字型服務；Google Analytics 提供匿名使用統計</li>
      </ul>
      <p><a href="licenses.txt" target="_blank" rel="noopener">完整授權條款</a>　·　<a href="https://github.com/dAAAb/hammerlee-tw" target="_blank" rel="noopener">原始碼</a></p>
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
  const invite = '我剛跟新北市長候選人李四川（川伯）聊天，還拿到專屬的新北事民徽章！你也來跟川伯聊聊天吧';
  openSheet({ title: '分享我跟川伯的對話' }, sheet => {
    sheet.append(para(`這段對話全世界只有你有。徽章編號 No. ${serial}`));
    const ph = placeholder('分享圖製作中…');
    sheet.append(ph);
    let card = null;
    requestAnimationFrame(() => setTimeout(() => {
      card = shareCard(stage, font, chat, builderOpts);
      ph.replaceWith(picture(card, '分享圖：我跟新北市長候選人李四川的對話'));
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

// a scanned pairing QR code: …/?pair=4827
if (q.has('pair')) {
  const code = q.get('pair'), u = new URL(location.href);
  u.searchParams.delete('pair');
  history.replaceState(null, '', u);
  if (pairTransport && isPairCode(code)) offerJoin(code, c => { settings.pair = true; saveSettings(); const p = getPair(); p.join(c); openPairSheet(p); });
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
