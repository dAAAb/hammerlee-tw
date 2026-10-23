// The full-screen notes for voting day and after it (see src/chat/calendar.js). Plain HTML on the page's paper
// colour, big type, no candidate pitch. Resolves when the visitor chooses to look back at the chat (after the
// election only); on voting day it never resolves, so nothing else starts.
import { CONFIG } from '../config.js';

const TEXT = {
  vote: {
    title: '今天是投票日',
    body: ['依照選舉規定，投票日當天不能進行競選活動，', '這個網頁今天暫停一天。'],
  },
  after: {
    title: '謝謝你陪川伯聊天',
    body: ['選舉已經結束了。', '謝謝這段時間每一位來聊天、分享的朋友。'],
    button: '看看當時的對話',
  },
};

export function showDayNotice(phase) {
  const t = TEXT[phase];
  const box = document.createElement('div');
  box.id = 'day-notice';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', t.title);
  box.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;'
    + 'padding:24px max(24px,env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));'
    + 'background:#fffdf6;color:#231e16;text-align:center;font-family:var(--ui-font, system-ui, sans-serif)';
  const h = document.createElement('h1');
  h.textContent = t.title;
  h.style.cssText = 'margin:0;font-size:34px;line-height:1.3;color:#00449a';
  box.append(h);
  for (const line of t.body) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.cssText = 'margin:0;font-size:21px;line-height:1.6;max-width:28em';
    box.append(p);
  }
  let go = null;
  if (t.button) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.button;
    b.style.cssText = 'margin-top:12px;min-height:60px;padding:10px 28px;font-family:inherit;font-weight:600;font-size:22px;line-height:1.2;color:#231e16;background:#ffc105;'
      + 'border:3px solid #231e16;border-radius:18px;box-shadow:4px 4px 0 #231e16;cursor:pointer';
    b.addEventListener('click', () => { box.remove(); go?.(); });
    box.append(b);
  }
  const small = document.createElement('p');
  small.textContent = CONFIG.credit;
  small.style.cssText = 'position:absolute;bottom:calc(14px + env(safe-area-inset-bottom));margin:0;font-size:14px;color:#6b7894';
  box.append(small);
  document.body.append(box);
  return new Promise(res => { go = res; });
}
