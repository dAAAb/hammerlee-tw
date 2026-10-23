// Bundle the app with esbuild and write two pages:
//   dist/index.html    — a full document for local testing (python3 -m http.server --directory dist)
//   dist/artifact.html — the same page as a body fragment, the shape the Artifact tool publishes
// Static files in public/ (glyphs.bin, photos) are copied next to them and fetched by relative URL.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const watch = argv.includes('--watch');
const dev = argv.includes('--dev') || watch;
const entry = arg('--entry', 'src/main.js');
const outName = arg('--out', null);   // e.g. dist/gallery.html builds just that one page
mkdirSync('dist', { recursive: true });

async function bundle() {
  const res = await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'esm', minify: !dev, write: false,
    target: ['es2022', 'safari15.4'], legalComments: 'none', define: { __DEV__: String(dev) },
  });
  return res.outputFiles[0].text;
}

// link previews and icons for the public site (the Artifact host supplies its own)
const SITE = 'https://hammerlee.tw/';
const SITE_HEAD = [
  '<meta name="theme-color" content="#00449a">',
  '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
  '<meta property="og:type" content="website">',
  `<meta property="og:url" content="${SITE}">`,
  '<meta property="og:title" content="跟川伯聊天｜未來新北市長李四川陪你話家常">',
  '<meta property="og:description" content="不用打字，往下滑就好。一頁滑到底的 3D LINE 對話，每段對話都獨一無二，還有你專屬的新北事民徽章。">',
  `<meta property="og:image" content="${SITE}og-default.png">`,
  '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
].join('');

function page(js) {
  const shell = readFileSync('src/shell.html', 'utf8');
  // never let the bundle close the script tag early
  const safe = js.replace(/<\/script/gi, '<\\/script');
  return shell.replace('/*APP*/', () => safe);
}

// Keep public/glyphs.bin in step with every character in src/ (so no sentence can lose a letter).
let lastCharset = '';
function syncFont() {
  const charset = execFileSync('node', ['tools/charset.mjs'], { encoding: 'utf8' });
  if (charset === lastCharset && existsSync('public/glyphs.bin')) return;
  mkdirSync('build', { recursive: true });
  writeFileSync('build/charset.txt', charset);
  const fonts = ['assets/fonts/Huninn-Regular.ttf', 'assets/fonts/ChironGoRoundTC-Regular.ttf'].filter(existsSync).join(',');
  if (!fonts) { console.warn('fonts missing: run tools/fetch_fonts.sh'); return; }
  process.stdout.write(execFileSync('python3', ['-I', 'tools/build_font.py', fonts, 'build/charset.txt', 'public/glyphs.bin'], { encoding: 'utf8' }));
  lastCharset = charset;
}

// Hosts that only serve web types (the claude.ai Artifact) get the outlines as base64 text: dist/glyphs.txt
function writeGlyphText() {
  if (existsSync('dist/glyphs.bin')) writeFileSync('dist/glyphs.txt', readFileSync('dist/glyphs.bin').toString('base64'));
}

async function once() {
  const t = Date.now();
  syncFont();
  const js = await bundle();
  const frag = page(js);
  const full = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${frag}</body></html>`;
  if (outName) {
    writeFileSync(outName, full);
    if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
    writeGlyphText();
    console.log(`built ${outName} in ${Date.now() - t}ms`);
    return;
  }
  writeFileSync('dist/artifact.html', frag);
  writeFileSync('dist/index.html', `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${SITE_HEAD}</head><body>${frag}</body></html>`);
  if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
  writeGlyphText();
  console.log(`built in ${Date.now() - t}ms — app ${(js.length / 1024).toFixed(0)} KB`);
}

await once();
if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  let timer = null;
  for (const dir of ['src', 'public']) fsWatch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => once().catch(e => console.error(e.message)), 120); });
  console.log('watching…');
}
