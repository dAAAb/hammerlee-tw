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

async function once() {
  const t = Date.now();
  syncFont();
  const js = await bundle();
  const frag = page(js);
  const full = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${frag}</body></html>`;
  if (outName) {
    writeFileSync(outName, full);
    if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
    console.log(`built ${outName} in ${Date.now() - t}ms`);
    return;
  }
  writeFileSync('dist/artifact.html', frag);
  writeFileSync('dist/index.html', `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${frag}</body></html>`);
  if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
  console.log(`built in ${Date.now() - t}ms — app ${(js.length / 1024).toFixed(0)} KB`);
}

await once();
if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  let timer = null;
  for (const dir of ['src', 'public']) fsWatch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => once().catch(e => console.error(e.message)), 120); });
  console.log('watching…');
}
