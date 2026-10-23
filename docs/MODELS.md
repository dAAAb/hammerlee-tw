# 3D model conventions

Everything on screen is a real three.js object drawn in the Colorfigures look: flat three-band shading and a hand
ink line. Model code only builds meshes; the look comes from shared pieces:

- **Materials:** `toon(pal, opts)` from `src/engine/toon.js`. `pal` is a key of `PAL` (`white`, `navy`, `blue`,
  `teal`, `yellow`, `orange`, `red`, `pink`, `purple`, `coral`, `skin`, `hair`, `shirt`, `pants`, `metal`, `dark`,
  `wood`, `gold`, `leaf`, `glass`, `cream`, `green`, `sky`, `paper`) or any hex (`toon('#ff8800')` derives l/m/d).
  Materials are cached; never dispose them. Do not use other material types (except the shiny badge).
- **Ink:** automatic (a post pass draws silhouettes and creases from depth). Never add outline meshes or lines.
- **3D text** (for sticker plates): `font.build([{ ch, x, z, size, depth, y }])` from `src/text/font.js` returns a
  merged geometry; draw it with `toon('text', { top: '#1c2442', text: true })` (`text: true` keeps ink off letters).
  `font.measure(str, size)` gives the width. Only characters in `public/glyphs.bin` exist (`npm run font` rebuilds it
  from every character found in `src/`, so adding a string to a source file is enough).
- **Units:** 1 unit = 1 em = the chat font size (about 22 CSS px on a phone). Up is +y, the floor is y = 0.
  Screen-up is world −z, screen-down is +z, screen-right is +x.
- **Camera:** looks almost straight down; a shear shows faces that point +z (toward the bottom of the screen) at
  ~72 % height and faces that point +x as a thin band; anything tall leans up-left on screen (≈ −0.22·h, +0.72·h).
  So: tops (+y) and fronts (+z) are what people see. Put faces, labels and details on the top and the front.
  The 3/4 isometric view (`?iso=1` in the bench) is only used for the intro and should also look right.
- **Bands:** the shading light comes from up-left-front, so +y faces get `l`, +z faces mostly `m`, +x faces `d`.
  Spheres show all three bands; that is the intended look.
- **Shadows:** set `castShadow = true` on every mesh. Shadows fall toward screen lower-right as flat blue.
- **Size budget:** low poly (spheres 16–24 segments, cylinders 12–20), share geometries between copies, no textures.
- **Animation:** a model may set `group.userData.tick = (t, dt) => {}`; the app calls it every frame while visible.
- **Bench:** `src/dev/harness.js` (see its header for how to build a page and take headless screenshots).
