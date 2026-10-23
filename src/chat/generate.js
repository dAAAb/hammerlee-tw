// Draw one conversation from the script. The same function serves a fresh random chat and the replay of a
// shared id (DecodeChooser): every decision goes through chooser.pick, in the same order.
import { walk, count, orderedPicks, RandomChooser, DecodeChooser } from './dsl.js';
import { GREETINGS, OPENING, NVIDIA, PAST_LEAD, PAST, BRIDGE, FUTURE_A, FUTURE_B, INTERLUDES, CLOSING, OUTRO } from './script.js';

export const SCRIPT_VERSION = 1;

export function hourBucket(h) { return h >= 5 && h < 11 ? 0 : h >= 11 && h < 14 ? 1 : h >= 14 && h < 18 ? 2 : 3; }

// policies for the "everyday life" slot that go first in line: the ones grandparents ask about most
const ELDER_FIRST = ['seniorcard', 'homecheck', 'elevator', 'teeth', 'esports'];

export function generate(chooser, { hour = new Date().getHours() } = {}) {
  const msgs = [];
  let topic = 'open';
  const emit = m => msgs.push({ ...m, topic: m.topic || topic });
  const run = (seq, t) => { topic = t; walk(seq, chooser, emit, t); };
  const topics = [];

  const bucket = chooser.pick(4, chooser instanceof RandomChooser ? hourBucket(hour) : undefined);
  emit({ kind: 'date', who: 'sys' });
  run(GREETINGS[bucket], 'open');
  run(OPENING, 'open');

  // the past: NVIDIA, then one more story
  topics.push(NVIDIA);
  run(NVIDIA.seq, NVIDIA.id);
  run(PAST_LEAD, 'past');
  const story = PAST[chooser.pick(PAST.length)];
  topics.push(story);
  run(story.seq, story.id);

  run(BRIDGE, 'bridge');

  // the future: all five builds in a shuffled order
  const a = [...FUTURE_A], b = [...FUTURE_B], future = [];
  while (a.length) future.push(a.splice(chooser.pick(a.length), 1)[0]);
  // then two everyday policies: one that matters most to elders, one from everything else
  const elderPool = b.filter(t => ELDER_FIRST.includes(t.id)), rest = b.filter(t => !ELDER_FIRST.includes(t.id));
  const pair = [elderPool[chooser.pick(elderPool.length)], rest[chooser.pick(rest.length)]];
  if (chooser.pick(2)) pair.reverse();
  future.push(...pair);

  // one little breather somewhere between future topics
  const g1 = chooser.pick(future.length - 1), g2 = -1;
  const i1 = chooser.pick(INTERLUDES.length), i2 = 0;

  future.forEach((t, k) => {
    topics.push(t);
    emit({ kind: 'topic', who: 'sys', id: t.id, title: t.title, cat: t.cat, topic: t.id });
    run(t.seq, t.id);
    if (k === g1) run(INTERLUDES[i1], 'interlude');
    if (k === g2) run(INTERLUDES[i2], 'interlude');
  });

  run(CLOSING, 'closing');
  emit({ kind: 'badge', who: 'chuan', topic: 'closing' });
  run(OUTRO, 'closing');
  emit({ kind: 'end', who: 'sys', topic: 'closing' });

  msgs.forEach((m, i) => { m.n = i; });
  return { id: chooser.id, msgs, topics: topics.map(t => t.id), bucket };
}

export function randomChat(opts) {
  const rng = crypto.getRandomValues ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random;
  return generate(new RandomChooser(rng), opts);
}
export function replayChat(id) {
  const chat = generate(new DecodeChooser(id));
  return chat;
}

// How many different conversations the script can produce (exact, BigInt).
export function totalConversations() {
  const greet = GREETINGS.reduce((s, g) => s + count(g), 0n);
  const past = PAST.reduce((sum, t) => sum + count(t.seq), 0n);
  let fA = 1n; for (const t of FUTURE_A) fA *= count(t.seq);
  fA *= 120n; // 5! orders
  const sum = list => list.reduce((s, x) => s + x, 0n);
  const eB = sum(FUTURE_B.filter(t => ELDER_FIRST.includes(t.id)).map(t => count(t.seq)));
  const oB = sum(FUTURE_B.filter(t => !ELDER_FIRST.includes(t.id)).map(t => count(t.seq)));
  const inter1 = sum(INTERLUDES.map(s => count(s)));
  // elder policy x other policy x 2 orders, one breather in one of 6 gaps
  const fB = eB * oB * 2n * 6n * inter1;
  return greet * count(OPENING) * count(NVIDIA.seq) * count(PAST_LEAD) * past * count(BRIDGE) * fA * fB * count(CLOSING) * count(OUTRO);
}
