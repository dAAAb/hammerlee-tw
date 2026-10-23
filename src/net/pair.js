// 兩支手機一起玩 (an opt-in 實驗功能): two phones lie side by side and mini 川哥 runs off one screen onto the other.
//
// Pairing: one phone shows a 4-digit room code (and a QR code of a link that carries it); the other types the
// code or scans the QR. Both join a Realtime channel named after the code and shake hands (knock → welcome).
// A finger swiped from one screen onto the other then tells each phone which side its partner lies on, and at
// what height the seam is. From then on, whenever 川哥 runs past the edge that faces the partner, this phone
// sends his state (pose, speed, height on screen, facing) and the partner lets him run in from its own edge.
// Only one phone holds him at a time (`mine`); the hand-over passes him on, so he ping-pongs between the two.
//
// What travels: the room code (as the channel name), a random id per visit, which side the other phone lies
// on, the seam height, and 川哥's position. No location, no personal data, nothing stored in a table.
// Nothing here runs, and no connection opens, until someone presses 顯示配對碼 or 輸入配對碼.
import { openChannel } from './realtime.js';
import { CONFIG, onPublicSite } from '../config.js';

const q = new URLSearchParams(location.search);
// Supabase Realtime on the public site (or anywhere with ?realtime, to try two real phones against a dev
// machine); between windows of one browser on localhost; nowhere else (the Artifact sandbox blocks sockets).
export const pairTransport = onPublicSite || q.has('realtime') ? 'realtime'
  : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'local' : null;

export const isPairCode = s => /^\d{4}$/.test(s);

// the link inside the QR code: opening it on the other phone offers to join this room
export function pairLink(code) {
  const base = onPublicSite ? CONFIG.publicUrl : location.origin + location.pathname;
  return `${base}?pair=${code}${!onPublicSite && pairTransport === 'realtime' ? '&realtime' : ''}`;
}

const WAIT_HOST = 5 * 60e3;   // a shown code stays open this long
const KNOCKS = 7;             // a joining phone asks this many times, 1.2 s apart, before giving up
const GRACE = 25e3;           // a partner that drops off gets this long to come back
const newKey = () => Math.random().toString(36).slice(2, 10);
const num = (v, lo, hi, d = 0) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);

export class Pair {
  constructor({ runner }) {
    this.runner = runner;
    this.phase = 'idle';        // idle | hosting | joining | linked (side unknown) | ready | lost
    this.side = 0;              // where the other phone lies: -1 left, 1 right
    this.mine = false;          // 川哥's next run starts on this phone
    this.rtt = 0.2;
    this.listeners = new Set();
    this.timers = new Set();
    addEventListener('visibilitychange', () => this.visibility());
    addEventListener('pagehide', () => this.end('left'));
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

  // --- for the runner -------------------------------------------------------------------------------
  // the partner is there, awake, and we know which side it is on
  get active() { return this.phase === 'ready' && !this.peerHidden; }
  get lag() { return Math.min(0.4, this.rtt / 2); }

  // 川哥 just ran past the edge that faces the partner
  handoff(s) {
    this.mine = false;
    this.send('run', s);
    // the message got lost: after a while he starts from here again
    this.stop(this.unsure);
    this.unsure = this.later(4000, () => { this.mine = true; });
  }

  // tapping 川伯's avatar while 川哥 is over there calls him across
  call() { this.send('call', {}); }

  // a height on the partner's screen -> the same height on this one (CSS px; phones' CSS px are about the same size)
  mapY(sy, H) {
    if (this.seamY != null && this.peerSeamY != null) return sy - this.peerSeamY + this.seamY;
    return sy / H * innerHeight;
  }

  // --- pairing --------------------------------------------------------------------------------------
  open(code, role) {
    this.end();
    this.code = code; this.role = role; this.key = newKey();
    this.peer = null; this.peerSeen = false; this.peerHidden = false;
    this.side = 0; this.seamY = null; this.peerSeamY = null; this.mine = false;
    this.ch = openChannel(`hl-pair-${code}`, {
      key: this.key, transport: pairTransport,
      on: { status: s => this.status(s), message: (ev, p) => this.message(ev, p), presence: m => this.presence(m) },
    });
  }

  host() {
    this.open(String(1000 + Math.floor(Math.random() * 9000)), 'host');
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
    this.peer = null; this.knocking = null;
    this.set('idle', why);
  }

  send(event, p) { return this.ch?.send(event, { ...p, from: this.key }) || false; }

  status(s) {
    if (s === 'closed') { this.end('offline'); return; }
    if (s !== 'joined') return;
    this.ch.track({ role: this.role });
    if (this.role === 'guest' && !this.peer && !this.knocking) {
      let n = 0;
      const knock = () => {
        if (this.peer) { this.stop(this.knocking); this.knocking = null; return; }
        if (++n > KNOCKS) { this.knocking = null; this.end('nohost'); return; }
        this.send('knock', {});
      };
      this.knocking = this.every(1200, knock);
      knock();
    }
    if (this.peer) this.send('vis', { hidden: document.hidden });   // back after a dropped line
  }

  presence(members) {
    // two phones showed the same code: the one with the larger id picks a new one
    if (this.phase === 'hosting' && [...members].some(([k, m]) => k !== this.key && m?.role === 'host' && k < this.key)) {
      this.host();
      return;
    }
    if (!this.peer) return;
    const here = members.has(this.peer);
    if (here) {
      this.peerSeen = true;
      this.stop(this.gone);
      if (this.phase === 'lost') this.set(this.side ? 'ready' : 'linked');
    } else if (this.peerSeen && this.phase !== 'lost') {
      this.set('lost');
      this.gone = this.later(GRACE, () => this.end('peer-gone'));
    }
  }

  linked(peer) {
    this.peer = peer;
    this.mine = this.role === 'host';
    this.set('linked');
    this.ping();
    this.every(10000, () => this.ping());
  }

  ping() { this.send('ping', { t: performance.now() }); }

  // this phone's own swipe (or button) says where the partner is
  setSide(side, seamY = null) {
    this.side = side; this.seamY = seamY;
    this.send('seam', { side, y: seamY });
    this.ready();
  }

  ready() {
    if (this.phase === 'ready') return;
    this.set('ready');
    if (this.mine) this.runner?.called(1.6);    // a first run across, right after the overlay goes away
  }

  message(ev, p) {
    if (!this.ch || !p || p.from === this.key) return;
    if (p.to && p.to !== this.key) return;
    if (ev === 'knock') {
      if (this.role !== 'host') return;
      if (!this.peer) this.linked(p.from);
      if (p.from === this.peer) this.send('welcome', { to: p.from });
      else this.send('full', { to: p.from });
      return;
    }
    if (ev === 'welcome' && this.role === 'guest' && !this.peer) { this.linked(p.from); return; }
    if (ev === 'full' && this.role === 'guest' && !this.peer) { this.end('full'); return; }
    if (p.from !== this.peer) return;
    const r = this.runner;
    switch (ev) {
      case 'ping': this.send('pong', { t: p.t }); break;
      case 'pong': {
        const rtt = (performance.now() - num(p.t, 0, Infinity)) / 1000;
        if (rtt >= 0 && rtt < 5) this.rtt = this.rtt * 0.6 + rtt * 0.4;
        break;
      }
      case 'seam':
        this.peerSeamY = p.y == null ? null : num(p.y, -2000, 4000);
        if (!this.side && (p.side === 1 || p.side === -1)) { this.side = -p.side; this.ready(); }
        break;
      case 'run': {
        const dir = p.dir === -1 ? -1 : 1;
        // he arrived before this phone was swiped: he came from the side he was running away from
        if (!this.side) { this.side = -dir; this.ready(); }
        this.mine = true;
        this.send('got', {});
        r?.enter({
          dir, pose: p.pose === 'trip' ? 'trip' : 'run', t: num(p.t, 0, 6), px: num(p.px, -200, 400),
          v: num(p.v, 0, 600, 100), sy: num(p.sy, -2000, 4000), H: num(p.H, 100, 4000, innerHeight),
          h: num(p.h, 0, 2), facing: num(p.facing, -4, 4, NaN), tripped: !!p.tripped,
        });
        break;
      }
      case 'got': this.stop(this.unsure); break;
      case 'call': if (this.mine) r?.called(0); break;
      case 'give': this.mine = true; break;
      case 'vis': this.peerHidden = !!p.hidden; this.set(this.phase); break;
      case 'bye': this.end('peer-left'); break;
    }
  }

  // a phone put away can't show him: it hands him over and the other one runs him on its own until it's back
  visibility() {
    if (!this.ch) return;
    if (document.hidden) {
      this.send('vis', { hidden: true });
      if (this.mine) { this.mine = false; this.send('give', {}); }
    } else {
      this.ch.wake();
      this.send('vis', { hidden: false });
    }
  }
}
