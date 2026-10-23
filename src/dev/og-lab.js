// Renders the site's default link-preview picture (1200 x 630) full-window, for a headless screenshot:
//   "Google Chrome" --headless=new --window-size=1200,630 --force-device-scale-factor=1 --screenshot=public/og-default.png .../og-lab.html
import { bench } from './harness.js';
import { buildCover } from '../chat/cover.js';
import { renderObject } from '../share/render.js';
import { createChuanSticker } from '../models/stickers-chuan.js';
import { CONFIG } from '../config.js';

const b = await bench();
const { font, stage } = b;
const W = 1200, H = 630;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
const bg = g.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#00449a'); bg.addColorStop(1, '#0a6fc4');
g.fillStyle = bg; g.fillRect(0, 0, W, H);
const cover = renderObject(stage, buildCover(font, 16), { w: 640, h: 540, view: 'iso', margin: 0.06 });
g.save(); g.beginPath(); g.roundRect(36, 45, 640, 540, 30); g.clip(); g.drawImage(cover, 36, 45); g.restore();
g.lineWidth = 5; g.strokeStyle = '#231e16'; g.beginPath(); g.roundRect(36, 45, 640, 540, 30); g.stroke();
const text = (str, x, y, size, fill, stroke) => {
  const { path } = font.path2d(str, x, y, size);
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = size * 0.14; g.strokeStyle = stroke; g.stroke(path); }
  g.fillStyle = fill; g.fill(path);
};
text('跟新北市長候選人', 716, 140, 48, '#ffffff');
text('李四川聊天', 716, 226, 76, '#ffc105', '#231e16');
text('不用打字，往下滑就好', 718, 296, 34, '#bcd3ff');
text('每段對話都獨一無二', 718, 344, 34, '#bcd3ff');
const st = renderObject(stage, createChuanSticker('c_hello', font), { w: 250, h: 230, view: 'card', margin: 0.05, floor: ['#fff8e6', '#fbefcf'] });
g.save(); g.beginPath(); g.roundRect(905, 378, 250, 210, 26); g.clip(); g.drawImage(st, 905, 368); g.restore();
g.lineWidth = 4; g.strokeStyle = '#231e16'; g.beginPath(); g.roundRect(905, 378, 250, 210, 26); g.stroke();
g.fillStyle = '#ffc105'; g.beginPath(); g.roundRect(716, 452, 166, 68, 34); g.fill();
g.lineWidth = 4; g.strokeStyle = '#231e16'; g.stroke();
text('開始 →', 748, 499, 32, '#2a1c00');
text(`模擬對話・內容依據李四川的公開政見與經歷整理｜${CONFIG.credit}`, 38, 616, 17, '#bcd3ff');
const img = new Image();
img.src = cv.toDataURL('image/png');
Object.assign(img.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', zIndex: 99 });
document.body.append(img);
