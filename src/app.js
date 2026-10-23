// The chat app: turns page scroll into conversation progress, moves the camera like a chat that scrolls,
// pops messages in, types the user's lines into the input bar, and keeps the chrome, the selectable text and
// the tap targets in step.
//
// Scroll model. Every chat item owns a stretch of scroll (L px). Within it, the first part (a·L) is the
// lead-in — 川伯's "…" bubble, or the user's line being typed into the field — and at a·L the item appears.
// The page scroll is the *target*; the shown progress P chases it, and past the furthest point reached (Pmax)
// it may only advance at a reading-friendly rate, so a hard fling plays the chat fast instead of skipping it.
// Scrolling back up is free: that is just reading the history.
import * as THREE from 'three';
import { layoutChat, BUBBLE } from './chat/layout.js';
import { Builder, typingBubble } from './chat/objects.js';
import { Chrome } from './ui/chrome.js';
import { TextLayer, plainText } from './ui/textlayer.js';

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const RATE = 760;          // px/s the chat may advance beyond what was already read
const RATE_FF = 3600;      // px/s when 說掰掰 fast-forwards
const READ_CPS = 8.5;      // characters per second for 自動聊

export class App {
  constructor({ stage, font, chat, photoAspect, makeElder, makeBadge, loadPhoto, hooks = {} }) {
    this.stage = stage;
    this.font = font;
    this.chat = chat;
    this.hooks = hooks;
    this.builder = new Builder({ font, photoAspect, makeElder, makeBadge, loadPhoto });
    this.chrome = new Chrome(stage, font);
    this.textLayer = new TextLayer(document.getElementById('textlayer'), stage);
    this.typing = typingBubble();
    this.typing.visible = false;
    stage.scene.add(this.typing);
    this.records = new Map();          // item index -> record
    this.revealed = new Map();         // item index -> reveal time (s)
    this.P = 0; this.Pmax = 0;
    this.time = 0;
    this.big = false;
    this.auto = false;
    this.ff = false;
    this.ended = false;
    this.userScrolled = false;
    this.intro = { t: 0, dur: 2.2, done: !!hooks.skipIntro };
    this.scroller = document.getElementById('scroller');
    this.hits = document.getElementById('hits');
    this.log = document.getElementById('log');
    this.relayout();
    this.bindInput();
  }

  // ---------------------------------------------------------------- layout & timeline
  emPxFor(w, h) {
    const base = Math.max(19, Math.min(28, Math.min(w / 17, h / 33)));
    return this.big ? Math.min(34, base * 1.2) : base;
  }

  relayout() {
    const st = this.stage;
    const keep = this.timeline ? this.progressAnchor() : null;
    const cw = st.canvas.clientWidth || window.innerWidth, ch = st.canvas.clientHeight || window.innerHeight;
    st.resize(cw, ch);
    st.setEmPx(this.emPxFor(cw, ch));
    const safe = safeInsets();
    const chromeEm = this.big ? st.emPx / 1.2 : st.emPx;     // the bars keep the standard size
    const unit = chromeEm / st.emPx;                          // world em per chrome unit
    this.chrome.build(cw / chromeEm, ch / chromeEm, safe.top / chromeEm, safe.bottom / chromeEm, unit);
    for (const [i, rec] of this.records) this.dropRecord(i, rec);
    this.layout = layoutChat(this.chat, this.font, { viewW: st.viewW, photoAspect: this.builder.photoAspect, start: this.hooks.start || new Date(), cover: true });
    this.buildTimeline();
    this.scroller.style.height = (this.total + window.innerHeight) + 'px';
    if (keep) {
      this.P = this.fromAnchor(keep.p); this.Pmax = this.fromAnchor(keep.max);
      window.scrollTo(0, this.P);
    }
    this.stage.dirty = true;
  }

  buildTimeline() {
    const st = this.stage, em = st.emPx, vh = st.viewH;
    const barH = this.chrome.barH * this.chrome.unit, headH = this.chrome.headerH * this.chrome.unit;
    const items = this.layout.items;
    this.camTop = vh / 2 - headH - 1.2;                       // camera z that shows z = 0 under the header
    const camFor = z => Math.max(this.camTop, z - vh / 2 + barH + 1.6);
    const tl = [];
    let S = 0, prevCam = this.camTop;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let L = 0, a = 0.3, pre = 'none';
      const hpx = it.h * em;
      switch (it.kind) {
        case 'topic': L = 0; break;
        case 'cover': L = 0; a = 0; break;
        case 'date': L = 90; a = 0.2; break;
        case 'text': {
          const n = [...plainText(it.msg.text)].length;
          if (it.who === 'chuan') { L = 120 + hpx * 0.75 + Math.min(180, n * 3); a = 0.42; pre = 'typing'; }
          else { L = 130 + Math.min(520, n * 11) + hpx * 0.4; a = 0.72; pre = 'field'; }
          break;
        }
        case 'sticker': L = 210; a = it.who === 'chuan' ? 0.38 : 0.22; pre = it.who === 'chuan' ? 'typing' : 'none'; break;
        case 'photo': case 'elder': case 'card': L = 250; a = 0.4; pre = 'typing'; break;
        case 'badge': L = 380; a = 0.3; pre = 'typing'; break;
        case 'end': L = 160; a = 0.3; break;
      }
      const camEnd = it.kind === 'topic' ? prevCam : camFor(it.z + it.h + (it.kind === 'badge' ? 1.5 : 0.5));
      const camPre = pre === 'typing' ? Math.min(camEnd, camFor(it.z + 1.9)) : prevCam;
      tl.push({ i, S, L, a, pre, camStart: prevCam, camPre: Math.max(prevCam, camPre), camEnd });
      S += L;
      prevCam = Math.max(prevCam, camEnd);
    }
    this.timeline = tl;
    this.total = S;
  }

  progressAnchor() {
    const at = p => { const k = this.segmentAt(p); const s = this.timeline[k]; return { k, f: s.L ? (p - s.S) / s.L : 0 }; };
    return { p: at(this.P), max: at(this.Pmax) };
  }
  fromAnchor({ k, f }) { const s = this.timeline[Math.min(k, this.timeline.length - 1)]; return s.S + f * s.L; }

  segmentAt(p) {
    const tl = this.timeline;
    let lo = 0, hi = tl.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tl[mid].S <= p) lo = mid; else hi = mid - 1; }
    // skip zero-length markers forward
    while (lo < tl.length - 1 && tl[lo].L === 0 && tl[lo + 1].S <= p) lo++;
    return lo;
  }

  cameraAt(p) {
    const s = this.timeline[this.segmentAt(p)];
    if (!s.L) return s.camEnd;
    const f = Math.min(1, (p - s.S) / s.L);
    if (f < s.a) return lerp(s.camStart, s.camPre, ease(f / s.a));
    return lerp(s.camPre, s.camEnd, ease((f - s.a) / (1 - s.a)));
  }

  // something is moving: scroll catching up, an item popping in, the intro, autoplay or fast-forward
  isBusy() {
    if (!this.intro.done || this.auto || this.ff) return true;
    if (Math.abs(window.scrollY - this.P) > 0.5 && this.P < this.total) return true;
    if (this.time - (this.lastMove || 0) < 0.6) return true;
    for (const t of this.revealed.values()) if (this.time - t < 1.4) return true;
    return this.chrome.typing.text !== '' || this.typing.visible;
  }

  // testing aid: show the chat as if read up to item n (all reveals finished)
  jumpTo(n) {
    const s = this.timeline[Math.min(n, this.timeline.length - 1)];
    this.P = this.Pmax = Math.min(this.total, s.S + s.L);
    window.scrollTo(0, this.P);
    for (const t of this.timeline) if (t.S + t.a * t.L <= this.Pmax) this.revealed.set(t.i, -10);
    this.intro.done = true;
  }

  // ---------------------------------------------------------------- per frame
  frame(dt) {
    this.time += dt;
    const st = this.stage;
    this.advance(dt);

    // reveals: everything whose appear point is behind the furthest progress
    for (const s of this.timeline) {
      if (s.S + s.a * s.L > this.Pmax + 0.5) break;
      if (!this.revealed.has(s.i)) this.reveal(s.i);
    }

    // camera
    st.rig.target.z = this.cameraAt(this.P);
    st.rig.target.x = 0;
    this.runIntro(dt);
    st.applyRig();

    this.syncRecords();
    this.syncLeadIn();
    this.chrome.flags.behind = this.Pmax - this.P > 420 && !this.ended;
    // until people have scrolled a few messages themselves, show the bouncing "往下滑" hint when the chat waits
    const waiting = this.intro.done && !this.auto && !this.ff && Math.abs(window.scrollY - this.P) < 4 && this.time - (this.lastMove || 0) > 2.2;
    this.chrome.flags.hint = waiting && this.Pmax < (this.timeline[Math.min(9, this.timeline.length - 1)]?.S ?? 0) && !this.ended;
    this.chrome.flags.auto = this.auto;
    this.chrome.update(this.time, dt);
    this.textLayer.update();
    this.syncHits();
    this.hooks.frame?.(dt, this.time);
    st.dirty = true;
  }

  advance(dt) {
    const target = this.ff ? this.total : Math.min(this.total, window.scrollY);
    if (Math.abs(target - this.P) > 1) this.lastMove = this.time;
    if (this.auto && !this.ff) this.autoScroll(dt);
    const k = 1 - Math.exp(-dt * 11);
    let d = (target - this.P) * k;
    if (Math.abs(target - this.P) < 0.5) d = target - this.P;
    if (d > 0 && this.P + d > this.Pmax) {
      const free = Math.max(0, this.Pmax - this.P);
      d = free + Math.min(d - free, (this.ff ? RATE_FF : RATE) * dt);
    }
    this.P = Math.max(0, Math.min(this.total, this.P + d));
    if (this.P > this.Pmax) this.Pmax = this.P;
    if (this.ff && this.Pmax >= this.total - 1) { this.ff = false; window.scrollTo(0, this.total); }
    if (!this.ended && this.Pmax >= this.total - 1) this.finish();
  }

  autoScroll(dt) {
    const s = this.timeline[this.segmentAt(window.scrollY)];
    const it = this.layout.items[s.i];
    let secs = 1.4;
    if (it.kind === 'text') secs = (it.who === 'chuan' ? 1.0 : 1.6) + [...plainText(it.msg.text)].length / READ_CPS;
    else if (it.kind === 'photo' || it.kind === 'card' || it.kind === 'elder') secs = 4.2;
    else if (it.kind === 'sticker') secs = 2.2;
    else if (it.kind === 'badge') secs = 4;
    const v = Math.max(40, (s.L || 1) / secs);
    window.scrollTo(0, Math.min(this.total, window.scrollY + v * dt));
    if (window.scrollY >= this.total - 1) this.setAuto(false);
  }

  reveal(i) {
    this.revealed.set(i, this.time);
    const it = this.layout.items[i];
    if (it.kind === 'topic') { this.hooks.topic?.(it.msg); return; }
    if (it.kind === 'text' && it.who === 'me') this.chrome.pulseSend();
    if (it.kind === 'text' && this.log) {
      const line = document.createElement('p');
      line.textContent = (it.who === 'chuan' ? '川伯：' : '我：') + plainText(it.msg.text);
      this.log.append(line);
      while (this.log.childNodes.length > 6) this.log.firstChild.remove();
    }
    this.hooks.reveal?.(it, i);
  }

  finish() {
    this.ended = true;
    this.auto = false;
    this.chrome.flags.ended = true;
    this.chrome.setMode('share');
    this.hooks.ended?.();
  }

  // build records near the view, drop far ones; pre-build the next one so its pop never stutters
  syncRecords() {
    const st = this.stage, tz = st.rig.target.z, vh = st.viewH;
    const lo = tz - vh / 2 - 9, hi = tz + vh / 2 + 5;
    const items = this.layout.items;
    const frontier = this.segmentAt(this.Pmax);
    let built = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'topic') continue;
      const near = it.z + it.h > lo && it.z < hi;
      const wanted = near && (this.revealed.has(i) || i <= frontier + 1);
      let rec = this.records.get(i);
      if (wanted && !rec && built < 3) {
        rec = this.builder.build(it);
        if (rec) { this.stage.scene.add(rec.group); this.records.set(i, rec); built++; }
      } else if (!wanted && rec && !(it.z + it.h > lo - 6 && it.z < hi + 6)) {
        this.dropRecord(i, rec);
        rec = null;
      }
      if (!rec) continue;
      const rt = this.revealed.get(i);
      rec.revealed = rt != null;
      rec.group.visible = rec.revealed;
      if (rec.revealed) {
        const k = (this.time - rt) / (rec.enterDuration || 0.5);
        if (k < 1.05 || !rec.settled) { rec.enter(Math.min(1, k)); rec.settled = k >= 1; }
        rec.tick?.(this.time, 1 / 60);
        if (it.kind === 'text') this.textLayer.attach(rec);
      }
    }
  }

  dropRecord(i, rec) {
    this.stage.scene.remove(rec.group);
    this.textLayer.detach(rec);
    rec.dispose();
    this.records.delete(i);
  }

  // 川伯's "…" bubble and the user's line typing into the field
  syncLeadIn() {
    const s = this.timeline[this.segmentAt(this.Pmax)];
    const it = this.layout.items[s.i];
    const f = s.L ? (this.Pmax - s.S) / s.L : 1;
    const leading = !this.revealed.has(s.i) && f < s.a && !this.ended;
    this.typing.visible = leading && s.pre === 'typing';
    if (this.typing.visible) {
      const S = this.layout.S;
      this.typing.position.set(this.layout.left + S.margin + S.avatar + S.avatarGap, 0, it.z);
      this.typing.userData.tick(this.time);
    }
    if (leading && s.pre === 'field') {
      const n = [...it.msg.text.replace(/\[[a-z_0-9]+\]/g, 'E')].length;
      this.chrome.setTyping(it.msg.text, Math.min(n, (f / s.a) * (n + 0.5) * 1.12));
    } else if (this.chrome.typing.text) {
      this.chrome.setTyping('', 0);
    }
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const onResize = () => {
      const c = this.stage.canvas;
      if (c.clientWidth === this.stage.cssW && c.clientHeight === this.stage.cssH) return;
      clearTimeout(this._rz); this._rz = setTimeout(() => this.relayout(), 120);
    };
    addEventListener('resize', onResize);
    new ResizeObserver(onResize).observe(this.stage.canvas);
    const stop = () => { if (this.auto) this.setAuto(false); };
    addEventListener('wheel', stop, { passive: true });
    addEventListener('touchstart', stop, { passive: true });
    addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') stop();
    });
    // taps on 3D things (stickers, photos, cards, the badge, 川伯's avatar)
    let down = null;
    const cv = this.stage.canvas;
    addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), on: e.target }; }, { passive: true });
    addEventListener('pointerup', e => {
      if (!down || (down.on !== cv && down.on !== document.documentElement && down.on !== document.body && !down.on?.classList?.contains('tl'))) { down = null; return; }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      if (moved < 10 && quick && !(window.getSelection()?.toString())) this.tapAt(e.clientX, e.clientY);
      down = null;
    }, { passive: true });
  }

  tapAt(x, y) {
    const ray = this.stage.ray(x, y);
    const rc = new THREE.Raycaster(ray.origin, ray.direction, 0, 1000);
    const cands = [];
    for (const rec of this.records.values()) if (rec.revealed) for (const h of rec.hits) cands.push(h);
    let best = null;
    for (const h of cands) {
      const hit = rc.intersectObject(h.obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { h, d: hit.distance };
    }
    if (this.hooks.tapExtra?.(rc, best?.d ?? Infinity)) return;
    if (best) this.hooks.tap?.(best.h);
  }

  // chrome buttons are real <button>s laid over the 3D ones
  syncHits() {
    const rects = this.chrome.layoutButtons();
    const key = rects.map(r => r.id + (r.x | 0) + ',' + (r.y | 0) + ',' + (r.w | 0)).join('|');
    if (key === this._hitKey) return;
    this._hitKey = key;
    this.hits.textContent = '';
    for (const r of rects) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', r.label);
      b.title = r.label;
      Object.assign(b.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      b.addEventListener('click', ev => { ev.stopPropagation(); this.press(r.id); });
      this.hits.append(b);
    }
  }

  press(id) {
    switch (id) {
      case 'auto': this.setAuto(!this.auto); break;
      case 'big': this.big = !this.big; this.chrome.flags.big = this.big; this.relayout(); break;
      case 'send': case 'field': this.nextStep(); break;
      case 'bye': this.fastForward(); break;
      case 'down': window.scrollTo({ top: this.Pmax, behavior: 'smooth' }); break;
      case 'share': this.hooks.share?.(); break;
    }
  }

  // the send button / field: jump to the end of the current item (for people who prefer tapping)
  nextStep() {
    if (this.ended) return;
    const k = this.segmentAt(this.Pmax);
    let s = this.timeline[k];
    let p = s.S + s.L + 1;
    if (this.Pmax >= s.S + s.a * s.L) { const n = this.timeline[Math.min(k + 1, this.timeline.length - 1)]; p = n.S + n.a * n.L + 1; }
    window.scrollTo({ top: Math.min(this.total, p), behavior: 'smooth' });
  }

  setAuto(on) {
    this.auto = on;
    this.chrome.flags.auto = on;
    this.chrome.layoutButtons();
    this._hitKey = '';
  }

  fastForward() {
    this.setAuto(false);
    this.ff = true;
    this.chrome.flags.bye = false;
    this.hooks.bye?.();
  }

  runIntro(dt) {
    const st = this.stage, I = this.intro;
    const target = this.hooks.shear || { x: -0.22, y: 0.72 };
    if (I.done) {
      st.rig.pitch = 90; st.rig.yaw = 0; st.rig.shear.set(target.x, target.y); st.zoom = 1; this.chrome.root.visible = true;
      if (!I.greeted) { I.greeted = true; setTimeout(() => this.greet(), 400); }
      return;
    }
    I.t += dt;
    const k = ease(Math.min(1, Math.max(0, I.t - 0.5) / I.dur));
    st.rig.pitch = lerp(34, 90, k);
    st.rig.yaw = lerp(32, 0, k);
    st.rig.shear.set(target.x * k, target.y * k);
    st.rig.target.z = lerp(5.2, st.rig.target.z, k);
    st.zoom = lerp(0.62, 1, k);
    this.chrome.root.visible = k > 0.92;
    if (I.t >= I.dur + 0.5) { I.done = true; }
  }

  // 川伯 starts the conversation himself: play through the date pill and his first line
  greet() {
    if (this.Pmax > 1 || this.hooks.noGreet) return;
    const first = this.timeline.find(s => s.L && this.layout.items[s.i].who === 'chuan');
    if (first) window.scrollTo({ top: first.S + first.L, behavior: 'smooth' });
  }
}

function safeInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}
