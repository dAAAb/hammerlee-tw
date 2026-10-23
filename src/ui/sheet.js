// Sheets that slide up over the 3D chat: the picture viewer (stickers, photos, 長輩圖, the badge) and the
// share sheet at the end. Big buttons, big words, one clear main action, the paper-and-ink look of the page.
export const SHEET_CSS = `
.sheet-back { position: fixed; inset: 0; z-index: 20; background: rgba(12, 28, 64, .55); display: flex; align-items: flex-end; justify-content: center;
  padding: 0 max(12px, env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px) max(12px, env(safe-area-inset-left, 0px)); animation: sheetFade .2s ease-out; }
.sheet { width: min(560px, 100%); max-height: 92%; overflow: auto; background: var(--paper); color: var(--ink); border: 3px solid var(--ink);
  border-bottom: 0; border-radius: 26px 26px 0 0; box-shadow: 0 -4px 0 rgba(0,0,0,.06); padding: 18px 18px 22px; animation: sheetUp .28s cubic-bezier(.2,1.2,.4,1);
  font-family: var(--ui-font); }
.sheet h2 { margin: 2px 4px 12px; font-size: 26px; line-height: 1.3; color: var(--navy); text-wrap: balance; }
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
.sheet .close { background: transparent; box-shadow: none; border-color: transparent; color: var(--navy); min-height: 52px; }
.sheet .note { font-size: 16px; color: #5d6f92; margin-top: 12px; text-align: center; }
.sheet .serial { font: 700 20px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .06em; color: var(--navy); }
.toast { position: fixed; left: 50%; bottom: calc(120px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 30;
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

export function closeSheet() { if (open) { open.remove(); open = null; } }

// body: array of nodes; returns the sheet element
export function openSheet({ title, label }, build) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.addEventListener('click', e => { if (e.target === back) closeSheet(); });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label || title);
  const h = document.createElement('h2'); h.textContent = title;
  sheet.append(h);
  build(sheet);
  const close = button('關閉', closeSheet, 'close');
  sheet.append(close);
  back.append(sheet);
  document.body.append(back);
  open = back;
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeSheet(); removeEventListener('keydown', esc); } });
  setTimeout(() => sheet.querySelector('button.main, a.main, button')?.focus(), 50);
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
