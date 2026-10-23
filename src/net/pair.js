// 多支手機一起玩 (an opt-in 實驗功能): 2–52 phones lie in rows and mini 川哥 runs off one screen onto the next, to
// the end of the row and back, faster the bigger the room.
//
// Pairing: one phone (the host) opens a room named after a 128-bit random secret, and shows a QR code of a link that
// carries the secret and its own id, plus a 6-digit code. A scanned QR goes straight into the room. A typed code only
// leads to a lobby (hl-pair-<code>): the phone there shows a 2-digit check number and asks; the host's screen asks
// 「它的畫面上是不是 47？」, and on 是 the host sends the secret sealed for that phone alone (ECDH P-256 + AES-GCM),
// so nobody listening in the lobby learns it. In the room the host lets phones in (knock → welcome) and gives each
// a number, works out how they lie, and tells everyone (layout). If the host leaves, the smallest number takes over.
//
// Who is listened to: only phones present in the room (Realtime presence); the host's word (welcome, layout) only
// from the host this phone was sent to, or the one that took over; 川哥 only from the phone next to this one in its
// row, and not too often. Strangers with the code can at most ask the host, a few at a time, and be told no.
//
// How they lie, three ways:
//  - a swipe from one screen onto the next runs off the first at an edge ('out') and onto the second at the facing
//    edge ('in') a moment later. Every phone reports its edges timed on the host's clock (offset from the quickest
//    ping) and the host pairs each 'out' with the nearest 'in' into a link: "B lies on A's right, the seam is at
//    height sa on A and sb on B". A lone edge counts when only one phone can be there.
//  - 點我排隊: people tap each phone from left to right.
//  - by number: people put the phones in number order, rows of `cols`, and the host presses 排好了 (big rooms).
// Links are kept per edge (l r u d) and every phone gets a grid cell; 川哥 runs along each row (left/right links),
// one 川哥 per row.
//
// Running: in each row one phone holds 川哥 (`mine`). When he runs past an edge with a phone beyond it, this phone
// sends that phone his state (pose, speed, height on screen, facing) straight to its inbox, and it lets him run in
// from its own edge. At the end of the row he runs off, and a little later comes back the other way.
//
// Builds (fx/builds.js): now and then 川哥 stops and builds a little model. In a room only a few "lucky" phones,
// drawn by the host, can get one, and less often the bigger the room.
//
// What travels: the code and the secret (as names of the lobby and the room), a random id and a number per visit,
// the edges and seam heights of a swipe, and 川哥's position. No location, no personal data, nothing stored in a table.
// Nothing here runs, and no connection opens, until someone presses 顯示配對碼 or 輸入配對碼.
import { openChannel } from './realtime.js';
import { CONFIG, onPublicSite } from '../config.js';

const q = new URLSearchParams(location.search);
// Supabase Realtime on the public site (or anywhere with ?realtime, to try real phones against a dev machine);
// between windows of one browser on localhost; nowhere else (the Artifact sandbox blocks sockets).
export const pairTransport = onPublicSite || q.has('realtime') ? 'realtime'
  : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'local' : null;

export const MAX_PHONES = 52;
export const BIG_ROOM = 7;        // from this many phones, line them up by number
const LUCKY = 3;                  // phones that can get a build in a room
export const isPairCode = s => /^\d{6}$/.test(s);
const isSecret = s => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);

// randomness from the browser's cryptographic generator: codes, ids and room secrets can't be guessed from each other
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const newKey = () => hex(rand(8));
const newSecret = () => hex(rand(16));
function newCode() {
  const u = new Uint32Array(1);
  do crypto.getRandomValues(u); while (u[0] >= 4294800000);   // 4294800000 = 4772 * 900000: no bias
  return String(100000 + u[0] % 900000);
}
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const EC = { name: 'ECDH', namedCurve: 'P-256' };
// the 2-digit number a phone asking to join shows, and the host compares: from the phone's public key
async function checkOf(raw) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', raw)); return 10 + ((h[0] << 8 | h[1]) % 90); }

// the link inside the QR code: opening it on another phone offers to join this room, no questions asked
export function pairLink(code, secret, host) {
  const base = onPublicSite ? CONFIG.publicUrl : location.origin + location.pathname;
  return `${base}?pair=${code}&pk=${secret}&ph=${host}${!onPublicSite && pairTransport === 'realtime' ? '&realtime' : ''}`;
}

// A scanned link's secret and host id, taken out of the address bar (so they don't linger or get shared on) and
// kept until the person says yes to joining.
let invite = null;
export function takeInvite(code) {
  const u = new URL(location.href), secret = u.searchParams.get('pk'), host = u.searchParams.get('ph');
  if (!secret && !host) return;
  u.searchParams.delete('pk'); u.searchParams.delete('ph');
  history.replaceState(history.state, '', u);
  invite = isSecret(secret) && /^[0-9a-f]{16}$/.test(host || '') ? { code, secret, host } : null;
}

// edges of a screen, the step to the cell beyond each, and the facing edge of the phone there
const STEP = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
const OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
export const edgeOf = dir => (dir > 0 ? 'r' : 'l');

const WAIT_HOST = 10 * 60e3;  // a shown code stays open this long with nobody joining
const KNOCKS = 7;             // a joining phone asks this many times, 1.2 s apart, before giving up
const GRACE = 25e3;           // a phone that drops off gets this long to come back
const ASK_WAIT = 90e3;        // a typed code waits this long for the host's 是
const ASKS = 3;               // requests the host holds at once
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
    this.members = [];          // everyone in the room (the host's word)
    this.nums = new Map();      // key -> the number the host gave it (the host is 1)
    this.counter = 0;
    this.links = [];            // { a, e, b, sa, sb }: b lies on a's edge e ('r' or 'd'); the seam is at sa on a, sb on b
    this.cells = new Map(); this.groups = new Map();
    this.cols = 0;              // by number: phones per row (0: the host hasn't said)
    this.queued = [];           // 點我排隊, left to right
    this.pend = [];             // host: swipe edges not yet paired
    this.holders = new Set();   // the phone holding 川哥 in each row (the host's word, kept up to date by 'got')
    this.lucky = new Set();     // phones that can get a build
    this.mine = false;          // 川哥's next run starts on this phone
    this.hidden = new Set();    // phones put away
    this.gone = new Set();      // phones whose line dropped
    this.seen = new Set();
    this.graces = new Map();
    this.rtt = new Map();       // host: key -> seconds, as each guest measured it
    this.rttHost = 0.25;        // guest: seconds to the host and back
    this.offset = 0;            // host clock - this clock (ms), from the quickest ping
    this.best = Infinity;
    this.hostKey = null;
    this.whole = false;
    this.knocking = null;
    this.secret = null;
    this.present = new Set();   // keys in the room's presence: the only ones listened to
    this.knocks = new Set();    // host: knocks from keys not (yet) present
    this.held = {};             // the host's welcome / newest layout that came early (presence lagging, or before our welcome)
    this.v = 0;                 // the host's layout count: an older layout never replaces a newer one
    this.asks = new Map();      // host: lobby requests waiting for 是 / 不是 (key -> { pub, check })
    this.blocked = new Set();   // host: told 不是
    this.sealed = new Map();    // host: invites already sent (key -> payload), sent again if that phone asks again
    this.heldInvite = null;     // guest: an invite that came before the host showed up in the lobby's presence
    this.lastAsk = 0;
    this.lobbyHosts = new Set();
    this.asking = null;         // guest at the lobby: { kp, pub, check }
    this.asked = false;
    this.lastRun = 0;
    this.lastCall = 0;
    this.edgeAt = new Map();
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
  // every phone in the room is linked into one arrangement
  get complete() { return this.members.length >= 2 && new Set(this.members.map(k => this.groups.get(k))).size === 1; }
  get count() { return this.members.length; }
  get number() { return this.nums.get(this.key) || 0; }
  get isHost() { return this.role === 'host'; }
  // the row a phone is in (same group, same grid row), left to right
  row(key = this.key) {
    const g = this.groups.get(key), y = this.cells.get(key)?.[1];
    return this.members.filter(k => this.groups.get(k) === g && this.cells.get(k)?.[1] === y)
      .sort((p, r) => this.cells.get(p)[0] - this.cells.get(r)[0]);
  }
  rows() {
    const out = new Map();
    for (const k of this.members) {
      const id = `${this.groups.get(k)}:${this.cells.get(k)?.[1]}`;
      if (!out.has(id)) out.set(id, this.row(k));
    }
    return [...out.values()];
  }
  // rows, top to bottom, of the arrangement this phone is in
  get rowCount() { return new Set(this.members.filter(k => this.groups.get(k) === this.groups.get(this.key)).map(k => this.cells.get(k)[1])).size; }
  // where the one other phone lies (for the two-phone wording): -1 left, 1 right, 0 not yet known
  get side() { return this.neighbor(this.key, 'r') ? 1 : this.neighbor(this.key, 'l') ? -1 : 0; }
  get anyAway() { return this.members.some(k => k !== this.key && this.away(k)); }

  // --- for the runner -------------------------------------------------------------------------------
  // the awake phone beyond this one's left (-1) or right (1) edge
  next(dir) { const k = this.neighbor(this.key, edgeOf(dir)); return k && !this.away(k) ? k : null; }
  get active() { return this.phase === 'linked' && !!(this.next(1) || this.next(-1)); }
  get lag() { return Math.min(0.4, (this.isHost ? Math.max(0, ...this.rtt.values()) || 0.25 : this.rttHost) / 2); }
  // he runs faster the more phones there are: 1.5x for two, up to 2.6x from 22 on
  get pace() { return 1.5 + 1.1 * Math.min(1, Math.max(0, (this.count - 2) / 20)); }
  // how often a build may happen here, as a share of the single-phone rate: only lucky phones, less in big rooms
  get buildShare() { return this.lucky.has(this.key) ? Math.min(1, 4 / Math.max(1, this.count)) : 0; }

  // 川哥 just ran past the edge toward `dir`: pass him to the phone there
  handoff(dir, s) {
    const to = this.next(dir);
    if (!to) return;
    this.mine = false;
    this.direct(to, 'run', { ...s, seam: this.seam(this.key, edgeOf(dir)) });
    // the message got lost: after a while he starts from here again
    this.stop(this.unsure);
    this.unsure = this.later(4000, () => this.took(to));
  }

  // this phone holds 川哥 now (after `prev` had him): the host keeps count
  took(prev) {
    this.mine = true;
    if (this.isHost) { this.holders.delete(prev); this.holders.add(this.key); }
    else this.direct(this.hostKey, 'got', { prev });
  }

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
    if (this.isHost) this.onEdges(this.key, v); else this.direct(this.hostKey, 'edge', { list: v });
  }
  lineUp() { if (this.isHost) this.onQueue(this.key); else this.direct(this.hostKey, 'queue', {}); }
  startOver() { if (this.isHost) this.onStartOver(); else this.direct(this.hostKey, 'again', {}); }
  // host only: phones per row for lining up by number, and "they're in place"
  setCols(c) { if (!this.isHost) return; this.cols = Math.round(num(c, 1, 13, 6)); this.publish(); }
  arrange() { if (this.isHost) this.onArrange(); }
  defaultCols(n = this.count) { return n <= 6 ? n : n <= 12 ? Math.ceil(n / 2) : 6; }

  // --- pairing --------------------------------------------------------------------------------------
  // the room itself, named after its secret: only phones given the secret can find it
  openRoom() {
    this.ch = openChannel(`hl-room-${this.secret}`, {
      key: this.key, transport: pairTransport,
      on: { status: st => this.status(st), message: (ev, p) => this.message(ev, p), presence: m => this.presence(m) },
    });
  }
  // the lobby a typed code leads to: the host listens there for requests; a phone asking gets an inbox for the answer
  openLobby() {
    this.lobby?.close();
    this.asked = false;
    this.lobby = openChannel(`hl-pair-${this.code}`, {
      key: this.key, transport: pairTransport, inbox: !this.isHost,
      on: { status: st => this.lobbyStatus(st), message: (ev, p) => this.lobbyMessage(ev, p), presence: m => this.lobbyPresence(m) },
    });
  }

  host() {
    this.end();
    this.reset();
    this.role = 'host'; this.key = newKey(); this.code = newCode(); this.secret = newSecret();
    this.members = [this.key]; this.hostKey = this.key; this.nums.set(this.key, ++this.counter);
    this.mine = true; this.holders.add(this.key);
    this.place();
    this.openRoom();
    this.openLobby();
    this.set('hosting');
    this.later(WAIT_HOST, () => { if (this.phase === 'hosting') this.end('timeout'); });
  }

  // a scanned link brings the secret and the host's id: straight in. A typed code asks the host first.
  join(code) {
    const inv = invite?.code === code ? invite : null;
    invite = null;
    this.end();
    this.reset();
    this.role = 'guest'; this.key = newKey(); this.code = code;
    this.set('joining');
    if (inv) { this.secret = inv.secret; this.hostKey = inv.host; this.openRoom(); } else this.ask();
  }

  end(why) {
    if (!this.ch && !this.lobby) return;
    this.send('bye', {});
    this.ch?.close(); this.ch = null;
    this.lobby?.close(); this.lobby = null;
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    this.timers.clear();
    this.reset();
    this.set('idle', why);
  }

  send(event, p) { return this.ch?.send(event, { ...p, from: this.key }) || false; }
  direct(to, event, p) { return !!to && (this.ch?.sendTo(to, event, { ...p, from: this.key, to }) || false); }

  // --- the lobby: a typed code asks, the host says 是 or 不是 -------------------------------------------
  async ask() {
    try {
      const kp = await crypto.subtle.generateKey(EC, false, ['deriveKey']);
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      const check = await checkOf(raw);
      if (this.phase !== 'joining') return;
      this.asking = { kp, pub: b64(raw), check };
    } catch (e) { this.end('insecure'); return; }   // no WebCrypto (a plain-http address): scan the QR instead
    this.openLobby();
    this.set('joining');
    this.later(ASK_WAIT, () => { if (this.asking) this.end('noanswer'); });
  }

  lobbyStatus(st) {
    if (st === 'closed') { if (this.asking) this.end('offline'); return; }
    if (st !== 'joined') return;
    this.lobby.track({ role: this.role });
    if (!this.asking || this.asked) return;
    this.asked = true;
    const ask = () => { if (this.asking) this.lobby?.send('ask', { from: this.key, pub: this.asking.pub }); };
    ask();
    this.every(3000, ask);
    this.later(8000, () => { if (this.asking && !this.lobbyHosts.size) this.end('nohost'); });
  }

  lobbyPresence(m) {
    this.lobbyHosts = new Set([...m].filter(([k, v]) => k !== this.key && v?.role === 'host').map(([k]) => k));
    if (this.heldInvite && this.lobbyHosts.has(this.heldInvite.from)) { const p = this.heldInvite; this.heldInvite = null; this.opened(p.from, p); }
    // two rooms drew the same code: the one with the larger id draws a new one (its room and secret stay)
    if (this.isHost && this.phase === 'hosting' && [...this.lobbyHosts].some(k => k < this.key)) {
      this.code = newCode();
      this.openLobby();
      this.set(this.phase);
    }
  }

  async lobbyMessage(ev, p) {
    if (!p || !isKey(p.from) || p.from === this.key || (p.to && p.to !== this.key)) return;
    const f = p.from;
    if (this.isHost) {
      if (ev !== 'ask' || typeof p.pub !== 'string' || p.pub.length > 120 || this.blocked.has(f) || this.asks.has(f)) return;
      // already said 是 and the phone asks again: the invite went missing, send the same one again
      const sent = this.sealed.get(f);
      if (sent) { if (sent.for === p.pub) this.lobby?.sendTo(f, 'invite', sent.msg); return; }
      if ([...this.asks.values()].some(a => a.pub === p.pub)) return;          // someone repeating another's request
      if (this.members.length >= MAX_PHONES) { this.lobby?.sendTo(f, 'full', { from: this.key, to: f }); return; }
      const now = performance.now();
      if (this.asks.size >= ASKS || now - this.lastAsk < 1500) return;         // a few at a time: the rest ask again
      this.lastAsk = now;
      let check;
      try { check = await checkOf(unb64(p.pub)); } catch (e) { return; }
      if (this.asks.has(f) || this.asks.size >= ASKS) return;
      this.asks.set(f, { pub: p.pub, check });
      this.later(60e3, () => { if (this.asks.delete(f)) this.set(this.phase); });
      this.set(this.phase);
      return;
    }
    if (!this.asking) return;
    // (presence can lag the host's answer a moment)
    if (!this.lobbyHosts.has(f)) { if (ev === 'invite') this.heldInvite = p; return; }
    if (ev === 'nope') this.end('nope');
    else if (ev === 'full') this.end('full');
    else if (ev === 'invite') this.opened(f, p);
  }

  // host: the requests waiting, oldest first
  get requests() { return [...this.asks].map(([key, a]) => ({ key, check: a.check })); }

  // host: 是 — seal the room's secret (and this host's id) for that phone alone
  async approve(k) {
    const a = this.asks.get(k);
    if (!a || !this.lobby) return;
    this.asks.delete(k);
    this.set(this.phase);
    try {
      const kp = await crypto.subtle.generateKey(EC, false, ['deriveKey']);
      const theirs = await crypto.subtle.importKey('raw', unb64(a.pub), EC, false, []);
      const aes = await crypto.subtle.deriveKey({ name: 'ECDH', public: theirs }, kp.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const iv = rand(12);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify({ s: this.secret, h: this.key })));
      const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      const msg = { from: this.key, to: k, pub: b64(pub), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
      this.sealed.set(k, { for: a.pub, msg });
      this.lobby?.sendTo(k, 'invite', msg);
    } catch (e) { /* a broken key: nothing to send */ }
  }

  // host: 不是
  decline(k) {
    if (!this.asks.delete(k)) return;
    this.blocked.add(k);
    this.lobby?.sendTo(k, 'nope', { from: this.key, to: k });
    this.set(this.phase);
  }

  // guest: the host said 是 — open the seal and go into the room
  async opened(f, p) {
    try {
      const theirs = await crypto.subtle.importKey('raw', unb64(p.pub), EC, false, []);
      const aes = await crypto.subtle.deriveKey({ name: 'ECDH', public: theirs }, this.asking.kp.privateKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, aes, unb64(p.ct));
      const msg = JSON.parse(new TextDecoder().decode(plain));
      if (!isSecret(msg.s) || msg.h !== f || this.phase !== 'joining' || !this.asking) return;
      this.asking = null;
      this.lobby?.close(); this.lobby = null;
      this.secret = msg.s; this.hostKey = f;
      this.openRoom();
      this.set(this.phase);
    } catch (e) { /* not sealed for this phone */ }
  }

  // --- the room -------------------------------------------------------------------------------------
  status(st) {
    if (st === 'closed') { this.end('offline'); return; }
    if (st !== 'joined') return;
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

  hold(ev, p) {
    if (ev === 'welcome' || !this.held.layout || num(p.v, 0, 1e9) >= num(this.held.layout.v, 0, 1e9)) this.held[ev] = p;
  }

  presence(m) {
    this.present = new Set(m.keys());
    // a knock is answered once the knocker shows up in the room (a key that never does is no phone)
    if (this.isHost) for (const k of [...this.knocks]) if (this.present.has(k)) { this.knocks.delete(k); this.admit(k); }
    // the host's word that came while presence lagged: the welcome first, then the latest layout
    for (const ev of ['welcome', 'layout']) {
      const h = this.held[ev];
      if (h && this.present.has(h.from)) { delete this.held[ev]; this.message(ev, h); }
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
        if (this.isHost) this.graces.set(k, this.later(GRACE, () => this.drop(k, 'peer-gone')));
        else if (k === this.hostKey) { this.set('lost'); this.graces.set(k, this.later(GRACE, () => this.succeed(k, 'peer-gone'))); }
      }
    }
    if (changed) this.changed();
  }

  // something about the room changed: tell the screens; a room just put together sends 川哥 off on a first run
  changed() {
    const whole = this.complete;
    if (whole && !this.whole && this.mine) this.runner?.called(1.6);
    this.whole = whole;
    this.set(this.phase);
  }

  pings() {
    const ping = () => this.direct(this.hostKey, 'ping', { t: performance.now(), r: this.rttHost });
    ping(); this.later(400, ping); this.later(1000, ping);
    this.every(10000, ping);
  }

  message(ev, p) {
    if (!this.ch || !p || !isKey(p.from) || p.from === this.key) return;
    if (p.to && p.to !== this.key) return;
    const f = p.from;
    // only phones that are in the room's presence are listened to
    if (!this.present.has(f)) {
      if ((ev === 'welcome' || ev === 'layout') && f === this.hostKey) this.hold(ev, p);   // presence can lag a moment
      else if (ev === 'knock' && this.isHost && this.knocks.size < 64) this.knocks.add(f);
      return;
    }
    if (this.isHost && ev === 'knock') { this.admit(f); return; }
    if (!this.isHost && (ev === 'welcome' || ev === 'full' || ev === 'layout')) {
      // the host's word, only from the host this phone was sent to (or the one that took over)
      if (f !== this.hostKey) return;
      if (ev === 'layout' && this.phase === 'joining') { this.hold(ev, p); return; }   // our welcome is still on its way
      if (ev === 'welcome') {
        if (this.welcomed) return;
        // the welcome carries the room as it is; a newer layout may have come ahead of it
        this.welcomed = true;
        if (this.phase === 'joining') { this.phase = 'linked'; this.pings(); }
        if (Array.isArray(p.members)) this.onLayout(f, p); else this.set(this.phase);
        const L = this.held.layout;
        if (L) { delete this.held.layout; this.onLayout(f, L); }
      } else if (ev === 'full') {
        if (this.phase === 'joining') this.end('full');
      } else this.onLayout(f, p);
      return;
    }
    if (!this.members.includes(f)) return;
    const r = this.runner, now = performance.now();
    // 川哥 comes only from the phone next to this one in its row, and not more than once a moment
    const beside = f === this.neighbor(this.key, 'l') || f === this.neighbor(this.key, 'r');
    switch (ev) {
      case 'ping':
        if (!this.isHost) break;
        this.direct(f, 'pong', { t: p.t, h: performance.now() });
        if (p.r) this.rtt.set(f, num(p.r, 0, 5));
        break;
      case 'pong': {
        const now = performance.now(), rtt = now - num(p.t, 0, Infinity, now);
        if (rtt < 0 || rtt > 5000) break;
        this.rttHost = this.rttHost * 0.6 + rtt / 1000 * 0.4;
        if (rtt <= this.best) { this.best = rtt; this.offset = num(p.h, 0, Infinity) - (num(p.t, 0, Infinity) + now) / 2; }
        break;
      }
      case 'edge':
        if (!this.isHost || !Array.isArray(p.list) || now - (this.edgeAt.get(f) || 0) < 250) break;
        this.edgeAt.set(f, now);
        this.onEdges(f, p.list.slice(0, 4));
        break;
      case 'sync': if (this.isHost) this.direct(f, 'layout', this.layout()); break;
      case 'queue': if (this.isHost) this.onQueue(f); break;
      case 'again': if (this.isHost) this.onStartOver(); break;
      case 'run': {
        if (!beside || now - this.lastRun < 800) break;
        this.lastRun = now;
        const dir = p.dir === -1 ? -1 : 1;
        this.took(f);
        r?.enter({
          dir, pose: p.pose === 'trip' ? 'trip' : 'run', t: num(p.t, 0, 6), px: num(p.px, -200, 400),
          v: num(p.v, 0, 1200, 100), sy: num(p.sy, -2000, 4000), H: num(p.H, 100, 4000, innerHeight),
          h: num(p.h, 0, 2), facing: num(p.facing, -4, 4, NaN), tripped: !!p.tripped,
          seam: p.seam == null ? null : num(p.seam, -2000, 4000), lag: this.lag,
        });
        if (this.isHost || f !== this.hostKey) this.direct(f, 'got', { prev: f });   // (took() already told the host)
        break;
      }
      case 'got':
        if (p.prev === this.key) this.stop(this.unsure);
        if (this.isHost) { this.holders.delete(p.prev); this.holders.add(f); }
        break;
      case 'call': {
        // the 川哥 of the caller's row comes over
        if (!this.mine || !this.row().includes(f) || now - this.lastCall < 1000) break;
        this.lastCall = now;
        r?.called(0, Math.sign(this.cells.get(f)[0] - this.cells.get(this.key)[0]));
        break;
      }
      case 'give': if (beside) this.took(f); break;
      case 'vis': if (p.hidden) this.hidden.add(f); else this.hidden.delete(f); this.changed(); break;
      case 'bye':
        if (this.isHost) this.drop(f, 'peer-left');
        else if (f === this.hostKey) this.succeed(f, 'peer-left');
        break;
    }
  }

  // a phone put away can't show him: it hands him to an awake phone in its row, and is skipped until it's back
  visibility() {
    if (!this.ch) return;
    if (document.hidden) {
      this.send('vis', { hidden: true });
      if (this.mine) {
        const to = this.next(1) || this.next(-1);
        if (to) { this.mine = false; this.direct(to, 'give', {}); }
      }
    } else {
      this.ch.wake();
      this.send('vis', { hidden: false });
    }
  }

  // the host left: the phone with the smallest number takes the room over
  succeed(old, why) {
    if (!this.members.includes(old)) return;
    this.members = this.members.filter(k => k !== old);
    this.links = this.links.filter(L => L.a !== old && L.b !== old);
    this.holders.delete(old); this.lucky.delete(old); this.gone.delete(old); this.hidden.delete(old);
    if (this.members.length < 2) { this.end(why); return; }
    const next = this.members.filter(k => !this.gone.has(k)).sort((a, b) => (this.nums.get(a) || 1e9) - (this.nums.get(b) || 1e9))[0] || this.members[0];
    this.hostKey = next;
    if (this.phase === 'lost') this.set('linked');
    if (next !== this.key) {
      this.place(); this.changed();
      this.later(1500, () => { if (this.hostKey === next) this.direct(next, 'sync', {}); });   // the room as the new host has it
      return;
    }
    this.role = 'host';
    this.ch.track({ role: 'host' });
    this.counter = Math.max(0, ...this.nums.values());
    if (this.mine) this.holders.add(this.key);
    this.stop(this.knocking);
    this.welcomed = true;
    this.openLobby();
    this.drawLucky();
    this.publish();
  }

  // --- the host keeps the room ------------------------------------------------------------------------
  publish() {
    this.place();
    // one 川哥 per row of two or more: keep the holder a row has, give one to a row that has none
    for (const k of [...this.holders]) if (!this.members.includes(k)) this.holders.delete(k);
    for (const r of this.rows()) {
      if (r.length < 2) { r.forEach(k => this.holders.delete(k)); continue; }
      const have = r.filter(k => this.holders.has(k));
      if (!have.length) this.holders.add(r[0]); else have.slice(1).forEach(k => this.holders.delete(k));
    }
    this.mine = this.holders.has(this.key) || (this.mine && !this.complete);
    this.v++;
    this.send('layout', this.layout());
    this.changed();
  }
  layout() {
    return {
      v: this.v,
      members: this.members, nums: Object.fromEntries(this.nums), links: this.links, cols: this.cols,
      queued: this.queued, holders: [...this.holders], lucky: [...this.lucky],
    };
  }

  onLayout(f, p) {
    // not let in yet: the room's news is about the phones that are
    if (this.phase === 'joining' || !this.hostKey || !Array.isArray(p.members) || !Array.isArray(p.links)) return;
    if (num(p.v, 0, 1e9) < this.v) return;   // older than what this phone has
    this.v = num(p.v, 0, 1e9);
    const members = p.members.filter(isKey).slice(0, MAX_PHONES);
    // dropped from the room (gone too long): this visit's pairing is over
    if (!members.includes(this.key)) { this.end('dropped'); return; }
    this.hostKey = f;
    this.members = members;
    this.nums = new Map(Object.entries(p.nums || {}).filter(([k]) => members.includes(k)).map(([k, n]) => [k, num(n, 1, 999, 0)]));
    this.links = p.links.filter(L => L && members.includes(L.a) && members.includes(L.b) && (L.e === 'r' || L.e === 'd')).map(L => ({
      a: L.a, e: L.e, b: L.b, sa: L.sa == null ? null : num(L.sa, -2000, 4000), sb: L.sb == null ? null : num(L.sb, -2000, 4000),
    }));
    this.cols = num(p.cols, 0, 13, 0);
    this.queued = Array.isArray(p.queued) ? p.queued.filter(k => members.includes(k)) : [];
    this.holders = new Set(Array.isArray(p.holders) ? p.holders.filter(k => members.includes(k)) : []);
    this.lucky = new Set(Array.isArray(p.lucky) ? p.lucky.filter(k => members.includes(k)) : []);
    this.place();
    this.mine = this.holders.has(this.key);
    this.changed();
  }

  admit(k) {
    if (!this.members.includes(k)) {
      if (this.members.length >= MAX_PHONES) { this.direct(k, 'full', {}); return; }
      this.members.push(k);
      this.nums.set(k, ++this.counter);
      this.queued = [];
      if (!this.cols || this.cols === this.defaultCols(this.members.length - 1)) this.cols = this.defaultCols();
      this.drawLucky();
    }
    if (this.phase === 'hosting') {
      this.set('linked');
      this.every(5 * 60e3, () => { this.drawLucky(); this.publish(); });   // new lucky phones now and then
    }
    this.publish();
    this.direct(k, 'welcome', this.layout());
  }

  drop(k, why) {
    if (!this.members.includes(k)) return;
    this.members = this.members.filter(m => m !== k);
    this.links = this.links.filter(L => L.a !== k && L.b !== k);
    this.queued = this.queued.filter(m => m !== k);
    this.hidden.delete(k); this.gone.delete(k); this.lucky.delete(k);
    if (this.members.length < 2) { this.end(why); return; }
    if (this.lucky.size < Math.min(LUCKY, this.members.length)) this.drawLucky();
    this.publish();
  }

  drawLucky() {
    const pool = [...this.members];
    this.lucky = new Set();
    while (pool.length && this.lucky.size < LUCKY) this.lucky.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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

  // by number, `cols` to a row, rows top to bottom
  onArrange() {
    const cols = this.cols || this.defaultCols();
    const order = [...this.members].sort((a, b) => this.nums.get(a) - this.nums.get(b));
    this.links = [];
    order.forEach((k, i) => {
      if ((i + 1) % cols && order[i + 1]) this.links.push({ a: k, e: 'r', b: order[i + 1], sa: null, sb: null });
      if (order[i + cols]) this.links.push({ a: k, e: 'd', b: order[i + cols], sa: null, sb: null });
    });
    this.queued = [];
    this.publish();
  }

  onStartOver() {
    this.links = []; this.queued = []; this.pend = [];
    this.publish();
  }
}
