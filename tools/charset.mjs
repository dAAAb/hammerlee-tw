// Print every character the app can show: everything that appears in src/ (script, catalog, UI strings)
// plus printable ASCII and common full-width punctuation. Over-collecting (e.g. from comments) only costs a
// few glyphs; missing one would show a gap in a 3D sentence.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const chars = new Set();
const base = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  + '，。、！？；：「」『』（）《》〈〉…～—．·＋－×÷％／○●◎★☆♥♡→←↑↓＃＆＠１２３４５６７８９０年月日時分秒上午下午晚安早';
for (const c of base) chars.add(c);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json)$/.test(name)) for (const c of readFileSync(p, 'utf8')) chars.add(c);
  }
}
walk('src');

const keep = [...chars].filter(c => {
  const cp = c.codePointAt(0);
  if (cp < 32) return false;
  if (/\p{Extended_Pictographic}/u.test(c) && c !== '▶') return false;   // real emoji are 3D models, never letters
  if (cp >= 0x1f000 || cp === 0xfe0f || cp === 0x20e3 || cp === 0x200d) return false;
  return true;
});
process.stdout.write(keep.sort().join(''));
