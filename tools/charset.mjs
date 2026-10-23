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
  if (cp >= 0x1f000) return false;                 // real emoji are drawn as 3D models, never from the font
  if (cp >= 0x2600 && cp <= 0x27bf) return false;   // dingbats/symbols likewise
  if (cp === 0xfe0f || cp === 0x20e3) return false;
  return true;
});
process.stdout.write(keep.sort().join(''));
