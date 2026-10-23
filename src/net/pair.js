// 多支手機一起玩 (an opt-in 實驗功能): 2–4 phones lie in a row and mini 川哥 runs off one screen onto the next,
// to the far end of the row and back.
//
// Pairing: one phone shows a 4-digit room code (and a QR code of a link that carries it); the others type the
// code or scan the QR. All join one Realtime channel named after the code. The phone that showed the code is the
// host and keeps the room: it lets phones in (knock → welcome), works out how they lie, and tells everyone
// (layout). If the host leaves, the room ends.
//
// How they lie: a finger swiped from one screen onto the next runs off the first at an edge ('out') and onto the
// second at the facing edge ('in') a moment later. Every phone reports its edges, timed on the host's clock (the
// offset comes from the quickest ping), and the host pairs each 'out' with the nearest 'in' into a link: "B lies
// on A's right, and the seam is at height sa on A and sb on B". A lone edge counts when only one phone can be
// there; or people tap 點我排隊 on each phone from left to right. Links are kept per edge (l r u d) and every
// phone gets a grid cell, so phones above and below can be added later; this version only makes left/right links.
//
// Running: one phone holds 川哥 at a time (`mine`). When he runs past an edge with a phone beyond it, this phone
// sends that phone his state (pose, speed, height on screen, facing) and it lets him run in from its own edge.
// At the end of the row he runs off, and a little later comes back the other way.
//
// What travels: the room code (as the channel name), a random id per visit, the edges and seam heights of a
// swipe, and 川哥's position. No location, no personal data, nothing stored in a table.
// Nothing here runs, and no connection opens, until someone presses 顯示配對碼 or 輸入配對碼.
import { openChannel } from './realtime.js';
import { CONFIG, onPublicSite } from '../config.js';

const q = new URLSearchParams(location.search);
// Supabase Realtime on the public site (or anywhere with ?realtime, to try real phones against a dev machine);
// between windows of one browser on localhost; nowhere else (the Artifact sandbox blocks sockets).
export const pairTransport = onPublicSite || q.has('realtime') ? 'realtime'
  : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'local' : null;

export const MAX_PHONES = 4;
export const isPairCode = s => /^\d{4}$/.test(s);

// the link inside the QR code: opening it on another phone offers to join this room
export function pairLink(code) {
  const base = onPublicSite ? CONFIG.publicUrl : location.origin + location.pathname;
  return `${base}?pair=${code}${!onPublicSite && pairTransport === 'realtime' ? '&realtime' : ''}`;
}

// edges of a screen, the step to the cell beyond each, and the facing edge of the phone there
const STEP = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
const OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
export const edgeOf = dir => (dir > 0 ? 'r' : 'l');

const WAIT_HOST = 5 * 60e3;   // a shown code stays open this long
const KNOCKS = 7;             // a joining phone asks this many times, 1.2 s apart, before giving up
const GRACE = 25e3;           // a phone that drops off gets this long to come back
const newKey = () => Math.random().toString(36).slice(2, 10);
const num = (v, lo, hi, d = 0) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const isKey = k => typeof k === 'string' && /^[a-z0-9]{1,16}$/.test(k);

// grid cells from links: every group of linked phones gets coordinates of its own
function placeAll(members, links) {
  const cells = new Map(), groups = new Map();
  let g = 0;
  for (const k0 of members) {
    if (cells.has(k0)) continue;
    cells.set(k0, [0, 0]); groups.set(k0, g);
    for (const todo = [k0]; todo.length;) {
      const k = todo.pop(), [x, y] = cells.get(k);
      for (const L of links) {
        const [n, e] = L.a === k ? [L.b, L.e] : L.b === k ? [L.a, OPP[L.e]] : [];
        if (!n || cells.has(n) || !members.includes(n)) continue;
        cells.set(n, [x + STEP[e][0], y + STEP[e][1]]); groups.set(n, g); todo.push(n);
      }
    }
    g++;
  }
  return { cells, groups };
}

export class Pair {
  constructor({ runner }) {
    this.runner = runner;
    this.phase = 'idle';        // idle | hosting | joining | linked | lost (a guest whose host dropped off)
    this.reset();
    this.listeners = new Set();
    this.timers = new Set();
    addEventListener('visibilitychange', () => this.visibility());
    addEventListener('pagehide', () => this.end('left'));
  }

  reset() {
    this.members = [];          // everyone in the room, host first (the host's word)
    this.links = [];            // { a, e, b, sa, sb }: b lies on a's edge e ('r' or 'd'); the seam is at sa on a, sb on b
    this.cells = new Map(); this.groups = new Map();
    this.queued = [];           // 點我排隊, left to right
    this.pend = [];             // host: swipe edges not yet paired
    this.mine = false;          // 川哥's next run starts on this phone
    this.holder = null;
    this.hidden = new Set();    // phones put away
    this.gone = new Set();      // phones whose line dropped
    this.seen = new Set();
    this.graces = new Map();
    this.rtt = new Map();       // key -> seconds
    this.offset = 0;            // host clock - this clock (ms), from the quickest ping
    this.best = Infinity;
    this.hostKey = null;
    this.whole = false;
    this.knocking = null;
  }

  listen(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  set(phase, why) {
    this.phase = phase;
    if (this.runner) this.runner.link = phase === 'idle' ? null : this;
    for (const fn of [...this.listeners]) fn(phase, why);
  }
  later(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  every(ms, fn) { const t = setInterval(fn, ms); this.timers.add(t); return t; }
  stop(t) { clearTimeout(t); clearInterval(t); this.timers.delete(t); }

  // --- where the phones lie -------------------------------------------------------------------------
  neighbor(key, e) {
    for (const L of this.links) {
      if (L.a === key && L.e === e) return L.b;
      if (L.b === key && OPP[L.e] === e) return L.a;
    }
    return null;
  }
  seam(key, e) {
    for (const L of this.links) {
      if (L.a === key && L.e === e) return L.sa;
      if (L.b === key && OPP[L.e] === e) return L.sb;
    }
    return null;
  }
  away(k) { return this.hidden.has(k) || this.gone.has(k); }
  place() { ({ cells: this.cells, groups: this.groups } = placeAll(this.members, this.links)); }
  // every phone in the room is linked into one row
  get complete() { return this.members.length >= 2 && new Set(this.members.map(k => this.groups.get(k))).size === 1; }
  get count() { return this.members.length; }
  // the phones linked with this one, left to right
  row(key = this.key) {
    const g = this.groups.get(key);
    return this.members.filter(k => this.groups.get(k) === g).sort((p, r) => this.cells.get(p)[0] - this.cells.get(r)[0]);
  }
  // where the one other phone lies (for the two-phone wording): -1 left, 1 right, 0 not yet known
  get side() { return this.neighbor(this.key, 'r') ? 1 : this.neighbor(this.key, 'l') ? -1 : 0; }
  get anyAway() { return this.members.some(k => k !== this.key && this.away(k)); }

  // --- for the runner -------------------------------------------------------------------------------
  // the awake phone beyond this one's left (-1) or right (1) edge
  next(dir) { const k = this.neighbor(this.key, edgeOf(dir)); return k && !this.away(k) ? k : null; }
  get active() { return this.phase === 'linked' && !!(this.next(1) || this.next(-1)); }
  lagTo(k) { return Math.min(0.4, (this.rtt.get(k) ?? 0.2) / 2); }

  // 川哥 just ran past the edge toward `dir`: pass him to the phone there
  handoff(dir, s) {
    const to = this.next(dir);
    if (!to) return;
    this.mine = false; this.holder = to;
    this.send('run', { ...s, to, seam: this.seam(this.key, edgeOf(dir)) });
    // the message got lost: after a while he starts from here again
    this.stop(this.unsure);
    this.unsure = this.later(4000, () => { if (this.holder === to) this.take(); });
  }

  take() { this.mine = true; this.holder = this.key; this.send('got', {}); }

  // tapping 川伯's avatar while 川哥 is on another phone calls him over
  call() { this.send('call', {}); }

  // a height on the sending phone's screen -> the same height on this one, through the seam both sides measured
  // (CSS px; phones' CSS px are about the same size). Without a measured seam, the same share of the height.
  mapY(s) {
    const mine = this.seam(this.key, edgeOf(-s.dir));
    if (s.seam != null && mine != null) return s.sy - s.seam + mine;
    return s.sy / s.H * innerHeight;
  }

  // --- this phone's own say on where it lies -----------------------------------------------------------
  // edges a finger crossed: [{ kind: 'in' | 'out', edge, s (seam height), t (performance.now()), weak, sure }]
  swiped(list) {
    const v = list.map(x => ({ ...x, t: x.t + this.offset }));
    if (this.role === 'host') this.onEdges(this.key, v); else this.send('edge', { to: this.hostKey, list: v });
  }
  lineUp() { if (this.role === 'host') this.onQueue(this.key); else this.send('queue', { to: this.hostKey }); }
  startOver() { if (this.role === 'host') this.onStartOver(); else this.send('again', { to: this.hostKey }); }

  // --- pairing --------------------------------------------------------------------------------------
  open(code, role) {
    this.end();
    this.reset();
    this.code = code; this.role = role; this.key = newKey();
    this.ch = openChannel(`hl-pair-${code}`, {
      key: this.key, transport: pairTransport,
      on: { status: s => this.status(s), message: (ev, p) => this.message(ev, p), presence: m => this.presence(m) },
    });
  }

  host() {
    this.open(String(1000 + Math.floor(Math.random() * 9000)), 'host');
    this.members = [this.key]; this.hostKey = this.key; this.mine = true; this.holder = this.key;
    this.place();
    this.set('hosting');
    this.later(WAIT_HOST, () => { if (this.phase === 'hosting') this.end('timeout'); });
  }

  join(code) {
    this.open(code, 'guest');
    this.set('joining');
  }

  end(why) {
    if (!this.ch) return;
    this.send('bye', {});
    this.ch.close(); this.ch = null;
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    this.timers.clear();
    this.reset();
    this.set('idle', why);
  }

  send(event, p) { return this.ch?.send(event, { ...p, from: this.key }) || false; }

  status(s) {
    if (s === 'closed') { this.end('offline'); return; }
    if (s !== 'joined') return;
    this.ch.track({ role: this.role });
    if (this.role !== 'guest') return;
    // knock until the host answers: on the first join, and again after a dropped line
    this.welcomed = false;
    this.stop(this.knocking);
    let n = 0;
    const knock = () => {
      if (this.welcomed) { this.stop(this.knocking); return; }
      if (++n > KNOCKS) { this.end(this.phase === 'joining' ? 'nohost' : 'peer-gone'); return; }
      this.send('knock', {});
    };
    this.knocking = this.every(1200, knock);
    knock();
  }

  presence(m) {
    // two phones showed the same code: the one with the larger id picks a new one
    if (this.phase === 'hosting' && [...m].some(([k, v]) => k !== this.key && v?.role === 'host' && k < this.key)) {
      this.host();
      return;
    }
    let changed = false;
    for (const k of this.members) {
      if (k === this.key) continue;
      if (m.has(k)) {
        this.seen.add(k);
        if (this.gone.delete(k)) {
          this.stop(this.graces.get(k));
          if (k === this.hostKey && this.phase === 'lost') this.set('linked');
          changed = true;
        }
      } else if (this.seen.has(k) && !this.gone.has(k)) {
        this.gone.add(k);
        changed = true;
        if (this.role === 'host') this.graces.set(k, this.later(GRACE, () => this.drop(k, 'peer-gone')));
        else if (k === this.hostKey) { this.set('lost'); this.graces.set(k, this.later(GRACE, () => this.end('peer-gone'))); }
      }
    }
    if (changed) this.changed();
  }

  // something about the room changed: tell the screens; a row just completed sends him off on a first run
  changed() {
    const whole = this.complete;
    if (whole && !this.whole && this.mine) this.runner?.called(1.6);
    this.whole = whole;
    this.set(this.phase);
  }

  pings() {
    const ping = () => this.send('ping', { t: performance.now() });
    ping(); this.later(300, ping); this.later(800, ping);
    this.every(10000, ping);
  }

  message(ev, p) {
    if (!this.ch || !p || !isKey(p.from) || p.from === this.key) return;
    if (p.to && p.to !== this.key) return;
    const f = p.from, host = this.role === 'host';
    if (host && ev === 'knock') { this.admit(f); return; }
    if (!host) {
      if (ev === 'welcome' && (!this.hostKey || this.hostKey === f)) {
        this.hostKey = f; this.welcomed = true;
        if (this.phase === 'joining') { this.set('linked'); this.pings(); }
        return;
      }
      if (ev === 'full' && this.phase === 'joining') { this.end('full'); return; }
      if (ev === 'layout' && f === this.hostKey) { this.onLayout(p); return; }
    }
    if (!this.members.includes(f)) return;
    const r = this.runner;
    switch (ev) {
      case 'ping': this.send('pong', { to: f, t: p.t, h: performance.now() }); break;
      case 'pong': {
        const now = performance.now(), rtt = now - num(p.t, 0, Infinity, now);
        if (rtt < 0 || rtt > 5000) break;
        this.rtt.set(f, (this.rtt.get(f) ?? rtt / 1000) * 0.6 + rtt / 1000 * 0.4);
        if (f === this.hostKey && !host && rtt <= this.best) { this.best = rtt; this.offset = num(p.h, 0, Infinity) - (num(p.t, 0, Infinity) + now) / 2; }
        break;
      }
      case 'edge': if (host && Array.isArray(p.list)) this.onEdges(f, p.list.slice(0, 4)); break;
      case 'queue': if (host) this.onQueue(f); break;
      case 'again': if (host) this.onStartOver(); break;
      case 'run': {
        const dir = p.dir === -1 ? -1 : 1;
        this.take();
        r?.enter({
          dir, pose: p.pose === 'trip' ? 'trip' : 'run', t: num(p.t, 0, 6), px: num(p.px, -200, 400),
          v: num(p.v, 0, 600, 100), sy: num(p.sy, -2000, 4000), H: num(p.H, 100, 4000, innerHeight),
          h: num(p.h, 0, 2), facing: num(p.facing, -4, 4, NaN), tripped: !!p.tripped,
          seam: p.seam == null ? null : num(p.seam, -2000, 4000), lag: this.lagTo(f),
        });
        break;
      }
      case 'got':
        this.holder = f;
        if (this.mine) this.mine = false;
        this.stop(this.unsure);
        break;
      case 'call': {
        if (!this.mine) break;
        const cf = this.cells.get(f), cm = this.cells.get(this.key);
        const dir = cf && cm && this.groups.get(f) === this.groups.get(this.key) ? Math.sign(cf[0] - cm[0]) : 0;
        r?.called(0, dir);
        break;
      }
      case 'give': this.take(); break;
      case 'vis': if (p.hidden) this.hidden.add(f); else this.hidden.delete(f); this.changed(); break;
      case 'bye':
        if (host) this.drop(f, 'peer-left');
        else if (f === this.hostKey) this.end('peer-left');
        break;
    }
  }

  // a phone put away can't show him: it hands him to an awake phone, and is skipped until it's back
  visibility() {
    if (!this.ch) return;
    if (document.hidden) {
      this.send('vis', { hidden: true });
      if (this.mine) {
        const to = this.next(1) || this.next(-1) || this.members.find(k => k !== this.key && !this.away(k));
        if (to) { this.mine = false; this.holder = to; this.send('give', { to }); }
      }
    } else {
      this.ch.wake();
      this.send('vis', { hidden: false });
    }
  }

  // --- the host keeps the room ------------------------------------------------------------------------
  publish() {
    this.place();
    this.send('layout', { members: this.members, links: this.links, queued: this.queued });
    this.changed();
  }

  onLayout(p) {
    if (!Array.isArray(p.members) || !Array.isArray(p.links)) return;
    const members = p.members.filter(isKey).slice(0, MAX_PHONES);
    // dropped from the room (gone too long): this visit's pairing is over
    if (!members.includes(this.key)) { this.end('dropped'); return; }
    this.members = members;
    this.links = p.links.filter(L => L && members.includes(L.a) && members.includes(L.b) && (L.e === 'r' || L.e === 'd')).map(L => ({
      a: L.a, e: L.e, b: L.b, sa: L.sa == null ? null : num(L.sa, -2000, 4000), sb: L.sb == null ? null : num(L.sb, -2000, 4000),
    }));
    this.queued = Array.isArray(p.queued) ? p.queued.filter(k => members.includes(k)) : [];
    this.place();
    this.changed();
  }

  admit(k) {
    if (!this.members.includes(k)) {
      if (this.members.length >= MAX_PHONES) { this.send('full', { to: k }); return; }
      this.members.push(k);
      this.queued = [];
    }
    this.send('welcome', { to: k });
    if (this.phase === 'hosting') { this.set('linked'); this.pings(); }
    this.publish();
  }

  drop(k, why) {
    if (!this.members.includes(k)) return;
    this.members = this.members.filter(m => m !== k);
    this.links = this.links.filter(L => L.a !== k && L.b !== k);
    this.queued = this.queued.filter(m => m !== k);
    this.hidden.delete(k); this.gone.delete(k);
    if (this.members.length < 2) { this.end(why); return; }
    if (this.holder === k) this.take();
    this.publish();
  }

  // b lies on a's edge e. A fresh observation wins: it replaces whatever else held those edges, and if the
  // phones were placed otherwise (moved around since), their other links go too.
  link(a, e, b, sa, sb) {
    if (a === b) return false;
    if (e === 'l' || e === 'u') return this.link(b, OPP[e], a, sb, sa);   // links are kept as right / down
    const same = this.links.find(L => L.a === a && L.e === e && L.b === b);
    if (same) {
      if (sa != null) same.sa = sa;
      if (sb != null) same.sb = sb;
      return true;
    }
    let keep = this.links.filter(L => !(L.a === a && L.e === e) && !(L.b === b && L.e === e));
    const { cells, groups } = placeAll(this.members, keep);
    const ca = cells.get(a), cb = cells.get(b);
    if (groups.get(a) === groups.get(b) && (cb[0] !== ca[0] + STEP[e][0] || cb[1] !== ca[1] + STEP[e][1])) {
      keep = keep.filter(L => L.a !== a && L.b !== a && L.a !== b && L.b !== b);
    }
    this.links = [...keep, { a, e, b, sa: sa ?? null, sb: sb ?? null }];
    this.place();
    return true;
  }

  // the phones that could lie beyond `key`'s edge e as things stand
  could(key, e) {
    const n = this.neighbor(key, e);
    if (n) return [n];
    return this.members.filter(k => k !== key && !this.neighbor(k, OPP[e]) && this.groups.get(k) !== this.groups.get(key));
  }

  onEdges(key, list) {
    const at = performance.now();
    for (const v of list) {
      if (!v || (v.kind !== 'in' && v.kind !== 'out') || (v.edge !== 'l' && v.edge !== 'r')) continue;
      this.pend.push({
        key, kind: v.kind, edge: v.edge, at, t: num(v.t, -1e12, 1e12), s: v.s == null ? null : num(v.s, -2000, 4000),
        weak: !!v.weak, sure: !!v.sure,
      });
    }
    this.match();
    this.later(600, () => this.match());
    this.later(1600, () => this.match());
  }

  match() {
    const now = performance.now();
    this.pend = this.pend.filter(v => now - v.at < 1500 && this.members.includes(v.key));
    const drop = v => { this.pend = this.pend.filter(o => o !== v); };
    let changed = false;
    // a finger runs off one phone and, a moment later, onto the phone next to it: one seam
    for (const out of this.pend.filter(v => v.kind === 'out')) {
      const into = this.pend
        .filter(v => v.kind === 'in' && v.key !== out.key && v.edge === OPP[out.edge] && v.t > out.t - 300 && v.t < out.t + 700)
        .sort((x, y) => Math.abs(x.t - out.t) - Math.abs(y.t - out.t))[0];
      if (!into) continue;
      drop(out); drop(into);
      changed = this.link(out.key, out.edge, into.key, out.s, into.s) || changed;
    }
    // a lone edge whose other half went missing (a back gesture can eat it): fine when only one phone can be
    // there. Wait a moment for the other half first; a tap on 在左邊 / 在右邊 counts at once.
    for (const v of [...this.pend]) {
      if (!v.sure && (v.weak || now - v.at < 500)) continue;
      const c = this.could(v.key, v.edge);
      if (c.length !== 1) continue;
      drop(v);
      changed = this.link(v.key, v.edge, c[0], v.s, null) || changed;
    }
    if (changed) this.publish();
  }

  onQueue(k) {
    if (!this.queued.includes(k)) this.queued.push(k);
    if (this.queued.length >= this.members.length) {
      this.links = this.queued.slice(1).map((b, i) => ({ a: this.queued[i], e: 'r', b, sa: null, sb: null }));
      this.queued = [];
    }
    this.publish();
  }

  onStartOver() {
    this.links = []; this.queued = []; this.pend = [];
    this.publish();
  }
}
