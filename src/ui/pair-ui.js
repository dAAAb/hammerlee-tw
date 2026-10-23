// The screens of 兩支手機一起玩 (實驗功能, net/pair.js): the pairing sheet (show a code + QR, or type one in),
// the invitation a scanned QR opens, the full-screen "swipe from this phone onto the other" step that finds the
// seam, and a small chip that says the two phones are linked (tap it to end). Big words, one clear action.
import { encode } from 'uqr';
import { openSheet, closeSheet, button, para, toast } from './sheet.js';
import { pairLink, isPairCode } from '../net/pair.js';

export const PAIR_CSS = `
.pair-info { margin: 10px 4px 4px; padding: 12px 14px; border: 2px dashed #c9bfa6; border-radius: 14px; background: #fff8e0; font-size: 17px; line-height: 1.6; }
.pair-info b { color: var(--navy); }
.pair-code { font: 700 64px/1.1 ui-monospace, Menlo, monospace; letter-spacing: .18em; text-align: center; color: var(--navy); margin: 6px 0 4px; }
.pair-qr { display: block; width: 210px; height: 210px; margin: 6px auto 10px; border: 3px solid var(--ink); border-radius: 14px; background: #fff; image-rendering: pixelated; }
.pair-wait { text-align: center; font-size: 18px; color: #5d6f92; }
.pair-wait::after { content: '…'; display: inline-block; animation: pairDots 1.2s steps(4) infinite; width: 1.2em; text-align: left; overflow: hidden; vertical-align: bottom; }
.sheet input.pair-in { display: block; width: 100%; box-sizing: border-box; font: 700 48px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .3em; text-align: center;
  padding: 10px 0 10px .3em; border: 3px solid var(--ink); border-radius: 18px; background: #fff; color: var(--ink); }
.sheet input.pair-in:focus-visible { outline: 4px solid var(--blue); outline-offset: 2px; }
.pair-err { color: #c0392b; font-weight: 700; min-height: 1.5em; }
.pair-cal { position: fixed; inset: 0; z-index: 25; display: grid; place-items: center; padding: 16px; background: rgba(12, 28, 64, .6);
  touch-action: none; user-select: none; -webkit-user-select: none; animation: sheetFade .2s ease-out; }
.sheet.pair-card { box-sizing: border-box; width: min(460px, 100%); border-bottom: 3px solid var(--ink); border-radius: 26px; max-height: 100%; touch-action: none; }
.pair-swipe { position: relative; height: 56px; margin: 4px 8px 10px; border-radius: 28px; background: #e9eef6; border: 2px solid var(--ink); overflow: hidden; }
.pair-swipe::before { content: ''; position: absolute; top: 9px; left: 10px; width: 34px; height: 34px; border-radius: 50%; background: var(--yellow); border: 3px solid var(--ink);
  animation: pairSwipe 1.8s ease-in-out infinite; }
.pair-swipe::after { content: '→'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 30px; color: var(--navy); }
.pair-cal .ok { text-align: center; font-size: 24px; font-weight: 700; color: var(--line-green); }
.pair-chip { position: fixed; left: 50%; transform: translateX(-50%); z-index: 15; display: flex; align-items: center; gap: 8px;
  font: 600 17px/1.2 var(--ui-font); color: var(--ink); background: var(--paper); border: 2px solid var(--ink); border-radius: 999px;
  box-shadow: 2px 2px 0 var(--ink); padding: 8px 14px; cursor: pointer; white-space: nowrap; }
.pair-chip::before { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--line-green); border: 2px solid var(--ink); }
.pair-chip[hidden] { display: none; }
.pair-chip.lost::before { background: var(--yellow); }
.pair-chip:focus-visible { outline: 4px solid var(--blue); outline-offset: 2px; }
@keyframes pairSwipe { 0% { transform: translateX(0) } 70%, 100% { transform: translateX(calc(min(460px, 100vw - 32px) - 130px)) } }
@keyframes pairDots { from { width: 0 } to { width: 1.2em } }
@media (prefers-reduced-motion: reduce) { .pair-swipe::before, .pair-wait::after, .pair-cal { animation: none; } }
`;

const SIDE = { '-1': '左邊', 1: '右邊' };

// what is shared, said plainly (the settings sheet and the pairing sheet both show it)
export function pairInfo() {
  const d = document.createElement('div'); d.className = 'pair-info';
  d.innerHTML = '這是<b>實驗功能</b>，可能不太穩定。兩支手機之間只會傳：一組<b>臨時的四位數配對碼</b>，和<b>小川哥在畫面上跑到哪裡</b>。'
    + '不會用到你的位置（GPS）或藍牙，也不會傳任何個人資料，什麼都不會存下來。';
  return d;
}

function qrCanvas(text) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  const quiet = 3, n = size + quiet * 2, s = 8;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n * s;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, n * s, n * s);
  g.fillStyle = '#231e16';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y][x]) g.fillRect((x + quiet) * s, (y + quiet) * s, s, s);
  cv.className = 'pair-qr';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'QR 碼：用另一支手機的相機掃描');
  return cv;
}

// The pairing sheet. It redraws itself as the pairing moves along; closing it while still waiting cancels.
export function openPairSheet(pair, { view = null } = {}) {
  let local = view;          // 'enter' while typing a code (nothing connects until 連線 is pressed)
  let err = '', typed = '';
  const sheet = openSheet({
    title: '兩支手機一起玩',
    onClose() { off(); if (pair.phase === 'hosting' || pair.phase === 'joining') pair.end('cancel'); },
  }, () => {});
  sheet.classList.add('pair-sheet');
  const body = document.createElement('div');
  sheet.insertBefore(body, sheet.lastChild);
  const acts = (...bs) => { const a = document.createElement('div'); a.className = 'acts'; a.append(...bs); return a; };

  function draw() {
    body.replaceChildren();
    const ph = pair.phase;
    if (ph === 'hosting') {
      body.append(para('請拿另一支手機，也打開「跟川伯聊天」：'));
      body.append(para('① 用相機掃這個 QR 碼'), qrCanvas(pairLink(pair.code)));
      body.append(para('② 或在那支手機按左下角的齒輪（設定），打開「兩支手機一起玩」，按「開始配對」→「我要輸入配對碼」，輸入：'));
      const c = document.createElement('div'); c.className = 'pair-code'; c.textContent = pair.code;
      c.setAttribute('aria-label', `配對碼 ${[...pair.code].join(' ')}`);
      body.append(c, para('等另一支手機加入中', 'pair-wait'));
      body.append(acts(button('取消配對', () => { pair.end('cancel'); closeSheet(); })));
    } else if (ph === 'joining') {
      body.append(para(`正在連到配對碼 ${pair.code}`, 'pair-wait'));
      body.append(acts(button('取消', () => { pair.end('cancel'); local = 'enter'; draw(); })));
    } else if (ph === 'linked' || ph === 'ready' || ph === 'lost') {
      body.append(para(ph === 'ready' ? `已經跟另一支手機配對好了，它在這支手機的${SIDE[pair.side]}。小川哥會在兩支手機之間跑來跑去。`
        : ph === 'lost' ? '另一支手機好像斷線了，等它回來。一直沒回來的話，配對會自動結束。'
          : '連上了！請照畫面上的說明，用手指從一支手機滑到另一支。'));
      body.append(acts(
        button('重新告訴我另一支在哪邊', () => { closeSheet(); calibrate(pair); }),
        button('結束配對', () => { pair.end('user'); closeSheet(); toast('已經結束配對'); }, 'main'),
      ));
    } else if (local === 'enter') {
      const l = document.createElement('label'); l.htmlFor = 'pair-in';
      l.append(para('請輸入另一支手機上顯示的四位數配對碼：'));
      const inp = document.createElement('input');
      Object.assign(inp, { id: 'pair-in', className: 'pair-in', inputMode: 'numeric', autocomplete: 'off', maxLength: 4, pattern: '[0-9]*', enterKeyHint: 'go' });
      inp.setAttribute('aria-describedby', 'pair-err');
      inp.value = typed;
      const e = para(err, 'pair-err'); e.id = 'pair-err'; e.setAttribute('role', 'alert');
      const go = () => {
        const code = inp.value.replace(/\D/g, '');
        if (!isPairCode(code)) { err = '請輸入四個數字'; e.textContent = err; inp.focus(); return; }
        err = ''; typed = code; pair.join(code);
      };
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 4);
        e.textContent = '';
        if (inp.value.length === 4) go();
      });
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
      body.append(l, inp, e, acts(button('連線', go, 'main')));
      setTimeout(() => inp.focus(), 60);
    } else {
      if (err) body.append(para(err, 'pair-err'));
      body.append(para('把兩支手機並排平放在桌上，小川哥會從這支手機跑到另一支手機上。'));
      body.append(para('兩支手機都要打開「跟川伯聊天」。先讓其中一支顯示配對碼，另一支再輸入或掃描它。'));
      body.append(acts(
        button('這支手機顯示配對碼', () => pair.host(), 'main'),
        button('我要輸入配對碼', () => { local = 'enter'; err = ''; draw(); }),
      ));
      body.append(pairInfo());
    }
  }

  const off = pair.listen((ph, why) => {
    if (!sheet.isConnected) { off(); return; }
    if (ph === 'linked') { closeSheet(); return; }       // the swipe step takes over
    if (ph === 'idle' && why && why !== 'cancel') { err = REASONS[why] || ''; if (pair.role === 'guest') local = 'enter'; }
    draw();
  });
  draw();
  return sheet;
}

const REASONS = {
  nohost: '找不到這個配對碼，請再確認一次。另一支手機要停在顯示配對碼的畫面。',
  full: '這個配對碼已經有兩支手機在用了。',
  offline: '連不上網路，配對結束了。',
  timeout: '等太久了，配對先取消。要玩的話再按一次。',
  'peer-left': '另一支手機結束配對了。',
  'peer-gone': '另一支手機斷線了，配對結束。',
};

// opened from a scanned QR (…/?pair=4827): ask first, nothing connects before 好
export function offerJoin(code, onYes) {
  openSheet({ title: '要跟另一支手機一起玩嗎？' }, sheet => {
    sheet.append(para('另一支手機邀請你一起玩：把兩支手機並排平放，小川哥會在兩支手機之間跑來跑去。'));
    sheet.append(pairInfo());
    const a = document.createElement('div'); a.className = 'acts';
    a.append(button('好，一起玩', () => { closeSheet(); onYes(code); }, 'main'), button('不用了', closeSheet));
    sheet.append(a);
  });
}

// Which side is the other phone on? A finger swiped from one screen onto the other says it: it runs off this
// screen at an edge (the partner is that way) or comes onto it at an edge (the partner is where it came from).
// Where it crossed also gives the seam's height. Two buttons do the same for those who'd rather tap.
export function swipeSide(a, b, w) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < w * 0.25 || Math.abs(dy) > Math.abs(dx)) return null;
  const zone = Math.max(40, w * 0.15), at = x => b.y + dy / dx * (x - b.x);
  if (dx > 0 && b.x > w - zone) return { side: 1, y: at(w) };
  if (dx < 0 && b.x < zone) return { side: -1, y: at(0) };
  if (dx > 0 && a.x < zone) return { side: -1, y: at(0) };
  if (dx < 0 && a.x > w - zone) return { side: 1, y: at(w) };
  return null;
}

let cal = null;
export function calibrate(pair) {
  if (cal) return;
  closeSheet();
  const root = document.createElement('div'); root.className = 'pair-cal';
  const card = document.createElement('div'); card.className = 'sheet pair-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', '告訴小川哥另一支手機在哪邊');
  const h = document.createElement('h2'); h.textContent = '連上了！';
  const msg = para('把兩支手機並排放好，用一根手指，從這支手機一路滑到另一支手機上。');
  const hint = document.createElement('div'); hint.className = 'pair-swipe'; hint.setAttribute('aria-hidden', 'true');
  const status = para('', 'pair-err'); status.setAttribute('role', 'status');
  const two = document.createElement('div'); two.className = 'acts two';
  two.append(button('◀ 在左邊', () => pick(-1)), button('在右邊 ▶', () => pick(1)));
  card.append(h, msg, hint, status, para('滑不過去也沒關係，直接點另一支手機在這支的哪一邊：'), two,
    button('結束配對', () => { pair.end('user'); close(); }, 'close'));
  root.append(card);
  document.body.append(root);
  cal = root;
  setTimeout(() => two.querySelector('button')?.focus(), 50);

  let a = null, b = null;
  root.addEventListener('pointerdown', e => { if (e.isPrimary) { a = b = { x: e.clientX, y: e.clientY }; } });
  root.addEventListener('pointermove', e => { if (e.isPrimary && a) b = { x: e.clientX, y: e.clientY }; });
  const up = e => {
    if (!e.isPrimary || !a) return;
    const end = e.type === 'pointerup' ? { x: e.clientX, y: e.clientY } : b;
    const r = swipeSide(a, end, innerWidth);
    const far = Math.abs(end.x - a.x) > innerWidth * 0.25;
    a = b = null;
    if (r) pick(r.side, r.y);
    else if (far) status.textContent = '再試一次：手指要一路滑到螢幕最旁邊，再滑到另一支手機上。';
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);

  function pick(side, y = null) { if (pair.phase === 'linked' || pair.phase === 'ready') pair.setSide(side, y); }
  function close() { off(); if (cal === root) cal = null; root.remove(); }
  let done = false;
  const off = pair.listen(ph => {
    if (done) return;
    if (ph === 'ready') {
      done = true;
      card.replaceChildren(h, para(`好了！另一支手機在${SIDE[pair.side]}。`, 'ok'), para('小川哥等一下就會跑過去。'));
      h.textContent = '配對好了';
      setTimeout(close, 1400);
    } else if (ph !== 'linked') close();
  });
}

// "兩支手機連線中" at the top while linked; tap it for the pairing sheet (and 結束配對)
export function pairChip(pair, { top }) {
  const chip = document.createElement('button');
  chip.type = 'button'; chip.className = 'pair-chip'; chip.hidden = true;
  chip.addEventListener('click', () => openPairSheet(pair));
  document.body.append(chip);
  pair.listen((ph, why) => {
    chip.hidden = !(ph === 'ready' || ph === 'lost');
    chip.classList.toggle('lost', ph === 'lost');
    chip.textContent = ph === 'lost' ? '另一支手機斷線了…' : pair.peerHidden ? '另一支手機休息中' : '兩支手機連線中';
    chip.style.top = `${Math.round(top()) + 8}px`;
    if (ph === 'linked') calibrate(pair);
    if (ph === 'idle' && REASONS[why] && !document.querySelector('.pair-sheet')) toast(REASONS[why], 3600);
  });
}
