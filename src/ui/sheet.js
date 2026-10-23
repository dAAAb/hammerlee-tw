// Sheets that slide up over the 3D chat: the picture viewer (stickers, photos, 長輩圖, the badge) and the
// share sheet at the end. Big buttons, big words, one clear main action, the paper-and-ink look of the page.
export const SHEET_CSS = `
.sheet-back { position: fixed; top: 0; left: 0; right: 0; height: 100vh; height: 100dvh; z-index: 20; background: rgba(12, 28, 64, .55);
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0 max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px)); animation: sheetFade .2s ease-out; }
/* sized to the visible screen (100dvh), so a phone's toolbar never hides the bottom; its scroll never runs on into the chat */
.sheet { box-sizing: border-box; width: min(560px, 100%); max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px));
  overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y;
  background: var(--paper); color: var(--ink); border: 3px solid var(--ink); border-bottom: 0; border-radius: 26px 26px 0 0;
  box-shadow: 0 -4px 0 rgba(0,0,0,.06); padding: 0 18px calc(22px + env(safe-area-inset-bottom, 0px)); animation: sheetUp .28s cubic-bezier(.2,1.2,.4,1);
  font-family: var(--ui-font); }
/* the title row stays on top while the sheet scrolls, with a big round 關閉 in the corner */
.sheet-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; gap: 10px; margin: 0 -18px 6px; padding: 16px 14px 10px 18px;
  background: var(--paper); border-bottom: 2px solid transparent; }
.sheet-head.scrolled { border-bottom-color: #e3dccb; }
.sheet h2 { flex: 1; min-width: 0; margin: 6px 4px 0; font-size: 26px; line-height: 1.3; color: var(--navy); text-wrap: balance; }
.sheet button.x { flex: none; width: 54px; height: 54px; min-height: 0; padding: 0; border-radius: 50%; box-shadow: 3px 3px 0 var(--ink); }
.sheet button.x svg { width: 26px; height: 26px; }
.sheet p { margin: 6px 4px 14px; font-size: 19px; line-height: 1.55; }
.sheet .pic { display: block; width: 100%; border: 3px solid var(--ink); border-radius: 18px; background: #dfeaf8; box-shadow: 4px 4px 0 var(--ink); }
.sheet .pic.loading { aspect-ratio: 1200 / 630; display: grid; place-items: center; font-size: 20px; color: var(--navy); }
.sheet .acts { display: grid; gap: 12px; margin-top: 18px; }
.sheet .acts.two { grid-template-columns: 1fr 1fr; }
.sheet button, .sheet a.btn { appearance: none; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 60px;
  font: 600 21px/1.2 var(--ui-font); color: var(--ink); background: #fff; border: 3px solid var(--ink); border-radius: 18px;
  box-shadow: 4px 4px 0 var(--ink); cursor: pointer; text-decoration: none; padding: 10px 14px; text-align: center; }
.sheet button:active, .sheet a.btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--ink); }
.sheet button:focus-visible, .sheet a.btn:focus-visible { outline: 4px solid var(--blue); outline-offset: 3px; }
.sheet .main, .sheet a.btn.main { background: var(--yellow); }
.sheet .line, .sheet a.btn.line { background: var(--line-green); color: #fff; }
.sheet .close { background: #e9eef6; }
.sheet > .close { width: 100%; margin-top: 22px; }
.sheet .note { font-size: 16px; color: #5d6f92; margin-top: 12px; text-align: center; }
.sheet .serial { font: 700 20px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .06em; color: var(--navy); }
.set-row { display: flex; align-items: center; gap: 14px; padding: 14px 4px; border-bottom: 2px dashed #e3dccb; }
.set-txt { flex: 1; min-width: 0; }
.set-txt label { display: block; font-size: 22px; font-weight: 700; color: var(--ink); }
.set-txt small { display: block; margin-top: 4px; font-size: 16px; line-height: 1.5; color: #5d6f92; }
.sheet button.switch { min-width: 92px; min-height: 56px; font-size: 22px; background: #e9eef6; }
.sheet button.switch[aria-checked="true"] { background: var(--line-green); color: #fff; }
.set-col { flex-direction: column; align-items: stretch; gap: 8px; }
.set-head { font-size: 20px; margin: 22px 4px 2px; color: var(--navy); }
.sheet input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 44px; background: transparent; margin: 0; }
.sheet input[type=range]::-webkit-slider-runnable-track { height: 12px; border-radius: 6px; background: #d9e2f0; border: 2px solid var(--ink); }
.sheet input[type=range]::-moz-range-track { height: 12px; border-radius: 6px; background: #d9e2f0; border: 2px solid var(--ink); }
.sheet input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 36px; height: 36px; margin-top: -14px; border-radius: 50%; background: var(--yellow); border: 3px solid var(--ink); box-shadow: 2px 2px 0 var(--ink); }
.sheet input[type=range]::-moz-range-thumb { width: 32px; height: 32px; border-radius: 50%; background: var(--yellow); border: 3px solid var(--ink); }
.sheet input[type=range]:focus-visible { outline: 4px solid var(--blue); outline-offset: 2px; border-radius: 8px; }
.set-col .ends { display: flex; justify-content: space-between; font-size: 15px; color: #5d6f92; }
.about h3 { font-size: 20px; margin: 22px 4px 6px; color: var(--navy); }
.about p, .about li { font-size: 17px; line-height: 1.6; margin: 4px; }
.about ul { padding-left: 22px; margin: 6px 0; }
.about a { color: var(--blue); }
.toast { position: fixed; left: 50%; bottom: calc(120px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 30;
  width: max-content; max-width: calc(100vw - 40px); box-sizing: border-box; text-align: center;
  background: var(--ink); color: #fff; font: 600 20px/1.3 var(--ui-font); padding: 12px 20px; border-radius: 999px; animation: sheetFade .2s; }
@keyframes sheetUp { from { transform: translateY(40%); opacity: .4 } to { transform: none; opacity: 1 } }
@keyframes sheetFade { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .sheet, .sheet-back { animation: none; } }
`;

let open = null;

export function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export function closeSheet() {
  if (!open) return;
  const was = open;
  open = null;
  was.remove();
  was.onClose?.();
}

// body: array of nodes; returns the sheet element. onClose runs however the sheet goes away.
export function openSheet({ title, label, onClose }, build) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.addEventListener('click', e => { if (e.target === back) closeSheet(); });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label || title);
  const head = document.createElement('div'); head.className = 'sheet-head';
  const h = document.createElement('h2'); h.textContent = title;
  const x = button('', closeSheet, 'x');
  x.setAttribute('aria-label', '關閉');
  x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
  head.append(h, x);
  sheet.append(head);
  sheet.addEventListener('scroll', () => head.classList.toggle('scrolled', sheet.scrollTop > 4), { passive: true });
  build(sheet);
  sheet.append(button('關閉', closeSheet, 'close'));
  back.append(sheet);
  back.onClose = onClose;
  document.body.append(back);
  open = back;
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeSheet(); removeEventListener('keydown', esc); } });
  setTimeout(() => sheet.querySelector('button.main, a.main, button:not(.x)')?.focus({ preventScroll: true }), 50);
  return sheet;
}

export function button(text, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
export function linkButton(text, href, cls = '') {
  const a = document.createElement('a');
  a.className = 'btn ' + cls; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
  return a;
}
export function para(text, cls = '') { const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; }
export function picture(srcOrCanvas, alt) {
  const img = document.createElement('img');
  img.className = 'pic'; img.alt = alt || '';
  img.src = typeof srcOrCanvas === 'string' ? srcOrCanvas : srcOrCanvas.toDataURL('image/png');
  return img;
}
export function placeholder(text) { const d = document.createElement('div'); d.className = 'pic loading'; d.textContent = text; return d; }
