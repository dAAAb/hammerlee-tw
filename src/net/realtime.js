// A short-lived message room for a group of phones: a tiny Supabase Realtime client (broadcast + presence, no
// database tables), and a same-browser stand-in for local testing.
//
// Each phone joins two topics on one WebSocket: the room (everyone hears it, and presence says who is there) and
// its own inbox (only it listens). Room-wide messages are rare (who joined, the layout, goodbyes); everything else
// goes straight to one phone's inbox through Realtime's REST broadcast, so a room of 52 phones doesn't make
// every phone hear every hand-over.
//
// Supabase Realtime speaks the Phoenix channel protocol over a WebSocket, one JSON object per message:
//   join      { topic: 'realtime:<name>', event: 'phx_join', payload: { config: { broadcast, presence, private } } }
//   broadcast { topic, event: 'broadcast', payload: { type: 'broadcast', event, payload } }
//   track     { topic, event: 'presence', payload: { type: 'presence', event: 'track', payload: meta } }
//   presence_state / presence_diff come back as { [key]: { metas: [{ phx_ref, ...meta }] } }
// and a heartbeat on topic 'phoenix' every 25 s, or the server hangs up. A direct message is
//   POST /realtime/v1/api/broadcast { messages: [{ topic: '<name>-<key>', event, payload, private: false }] }
//
//   const ch = openChannel('hl-room-<secret>', { key, transport: 'realtime' | 'local', inbox: true, on: { status, message, presence } });
//   ch.track({ role: 'host' }); ch.send('layout', {...}); ch.sendTo(key, 'run', {...}); ch.wake(); ch.close();
//   on.status('joined' | 'retry' | 'closed'), on.message(event, payload), on.presence(Map key -> meta)
import { CONFIG } from '../config.js';

export function openChannel(name, opts) {
  return opts.transport === 'local' ? new LocalChannel(name, opts) : new RealtimeChannel(name, opts);
}
const inboxOf = (name, key) => `${name}-${key}`;

class RealtimeChannel {
  constructor(name, { key, on, inbox = true }) {
    this.name = name;
    this.topic = `realtime:${name}`;
    this.inbox = inbox ? `realtime:${inboxOf(name, key)}` : null;
    this.key = key;
    this.on = on;
    this.ref = 0;
    this.tries = 0;
    this.meta = null;
    this.members = new Map();      // key -> Map(phx_ref -> meta): one key can hold a stale and a fresh socket
    this.connect();
  }

  connect() {
    clearTimeout(this.again);
    this.joined = false;
    const url = `${CONFIG.supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(CONFIG.supabaseAnonKey)}&vsn=1.0.0`;
    const ws = this.ws = new WebSocket(url);
    ws.onopen = () => {
      const join = (topic, presence) => {
        const ref = String(this.ref + 1);
        this.push('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: presence }, private: false }, access_token: CONFIG.supabaseAnonKey }, topic, ref);
        return ref;
      };
      this.joinRef = join(this.topic, this.key);
      if (this.inbox) this.inboxRef = join(this.inbox, '');
      this.beat = setInterval(() => this.push('heartbeat', {}, 'phoenix'), 25000);
    };
    ws.onmessage = e => { try { this.receive(JSON.parse(e.data)); } catch (err) { /* not ours */ } };
    ws.onclose = () => { clearInterval(this.beat); if (ws === this.ws) this.lost(); };
    ws.onerror = () => {};   // a close always follows
  }

  // the line dropped (a phone going to sleep, a tunnel): try again a few times, then give up
  lost() {
    this.joined = false;
    if (this.closed) return;
    if (++this.tries > 7) { this.closed = true; this.on.status('closed'); return; }
    this.on.status('retry');
    this.again = setTimeout(() => this.connect(), Math.min(8000, 400 * 2 ** this.tries));
  }

  // back from the background: reconnect now instead of waiting out the backoff
  wake() {
    if (this.closed || this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    this.connect();
  }

  push(event, payload, topic = this.topic, joinRef = topic === this.topic ? this.joinRef : topic === this.inbox ? this.inboxRef : undefined) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ topic, event, payload, ref: String(++this.ref), join_ref: joinRef }));
    return true;
  }

  receive(m) {
    const p = m.payload || {};
    if (this.inbox && m.topic === this.inbox) {
      if (m.event === 'broadcast' && p.event) this.on.message(p.event, p.payload || {});
      return;
    }
    if (m.topic !== this.topic) return;
    switch (m.event) {
      case 'phx_reply':
        if (m.ref !== this.joinRef) return;
        if (p.status !== 'ok') { this.ws.close(); return; }
        this.joined = true; this.tries = 0;
        this.on.status('joined');
        break;
      case 'broadcast': if (p.event) this.on.message(p.event, p.payload || {}); break;
      case 'presence_state': this.members.clear(); this.diff(p, {}); break;
      case 'presence_diff': this.diff(p.joins || {}, p.leaves || {}); break;
      case 'phx_error': case 'phx_close': this.ws.close(); break;
    }
  }

  diff(joins, leaves) {
    for (const [k, v] of Object.entries(joins)) {
      const refs = this.members.get(k) || new Map();
      for (const meta of v.metas || []) refs.set(meta.phx_ref, meta);
      this.members.set(k, refs);
    }
    for (const [k, v] of Object.entries(leaves)) {
      const refs = this.members.get(k);
      if (!refs) continue;
      for (const meta of v.metas || []) refs.delete(meta.phx_ref);
      if (!refs.size) this.members.delete(k);
    }
    const out = new Map();
    for (const [k, refs] of this.members) out.set(k, [...refs.values()].pop());
    this.on.presence(out);
  }

  track(meta) {
    this.meta = meta;
    if (this.joined) this.push('presence', { type: 'presence', event: 'track', payload: meta });
  }

  send(event, payload) {
    return this.joined && this.push('broadcast', { type: 'broadcast', event, payload });
  }

  // one phone's inbox, over HTTPS (keep-alive keeps it quick after the first one)
  sendTo(key, event, payload) {
    if (this.closed) return false;
    fetch(`${CONFIG.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: inboxOf(this.name, key), event, payload, private: false }] }),
    }).catch(() => {});
    return true;
  }

  close() {
    if (this.closed && !this.ws) return;
    this.closed = true;
    clearTimeout(this.again); clearInterval(this.beat);
    if (this.joined) { this.push('phx_leave', {}); if (this.inbox) this.push('phx_leave', {}, this.inbox); }
    const ws = this.ws; this.ws = null;
    try { ws?.close(); } catch (e) { /* already gone */ }
  }
}

// Windows of one browser on localhost talk through a BroadcastChannel, with the same shape as above.
// ?lag=<ms> delays every message, to see how the hand-over copes with a slow network.
class LocalChannel {
  constructor(name, { key, on }) {
    this.key = key;
    this.on = on;
    this.meta = null;
    this.members = new Map();
    this.lag = +new URLSearchParams(location.search).get('lag') || 0;
    this.bc = new BroadcastChannel(`hl:${name}`);
    this.bc.onmessage = e => setTimeout(() => this.receive(e.data), this.lag);
    setTimeout(() => { this.joined = true; this.on.status('joined'); }, 30);
  }

  receive(m) {
    if (this.closed || !m || m.key === this.key) return;
    if (m.to && m.to !== this.key) return;
    if (m.t === 'here') {
      this.members.set(m.key, m.meta);
      if (m.ask && this.meta) this.bc.postMessage({ t: 'here', key: this.key, meta: this.meta });
      this.presence();
    } else if (m.t === 'gone') {
      if (this.members.delete(m.key)) this.presence();
    } else if (m.t === 'b') this.on.message(m.event, m.payload);
  }

  presence() {
    const out = new Map(this.members);
    if (this.meta) out.set(this.key, this.meta);
    this.on.presence(out);
  }

  track(meta) {
    this.meta = meta;
    if (!this.joined) return;
    this.bc.postMessage({ t: 'here', key: this.key, meta, ask: true });
    this.presence();
  }

  send(event, payload) {
    if (!this.joined || this.closed) return false;
    this.bc.postMessage({ t: 'b', key: this.key, event, payload });
    return true;
  }

  sendTo(key, event, payload) {
    if (this.closed) return false;
    this.bc.postMessage({ t: 'b', key: this.key, to: key, event, payload });
    return true;
  }

  wake() {}

  close() {
    if (this.closed) return;
    this.closed = true;
    this.bc.postMessage({ t: 'gone', key: this.key });
    this.bc.close();
  }
}
