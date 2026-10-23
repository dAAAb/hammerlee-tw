"""Turn a TTF + charset into a compact glyph-outline file for 3D extrusion at runtime.

Usage: python3 -I tools/build_font.py FONT.ttf CHARSET.txt OUT.bin

Format (little endian):
  header : b'HLG1', u16 unitsPerEm, i16 ascender, i16 descender, u32 glyphCount
  index  : glyphCount x (u32 codepoint, u16 advance, u32 offset, u32 length)
  glyph  : u16 shapeCount, then per shape u16 contourCount (first = outer, rest = holes),
           per contour u16 pointCount, then points as int16 (x, y) absolute for the first point and
           int8 deltas after it (an escape byte pair (-128, 0) switches the next point to int16 absolute).
Contours are flattened (curves -> polylines) and normalised so the solid is always on the right of the
direction of travel in font (y-up) space: outer contours clockwise, holes counter-clockwise.
"""
import struct
import sys
from math import ceil, sqrt

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

TOL = 5.0        # flattening tolerance in font units (1000 per em)
SIMPLIFY = 2.5   # drop points closer than this to the line through their neighbours


class FlattenPen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.contours, self.cur = [], None

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        dev = sqrt((p0[0] - 2 * p1[0] + p2[0]) ** 2 + (p0[1] - 2 * p1[1] + p2[1]) ** 2) / 4
        n = max(1, min(8, ceil(sqrt(dev / TOL))))
        for i in range(1, n + 1):
            t = i / n
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        dev = max(abs(p0[0] - 2 * p1[0] + p2[0]) + abs(p0[1] - 2 * p1[1] + p2[1]),
                  abs(p1[0] - 2 * p2[0] + p3[0]) + abs(p1[1] - 2 * p2[1] + p3[1])) * 0.75
        n = max(1, min(10, ceil(sqrt(dev / TOL))))
        for i in range(1, n + 1):
            t = i / n
            mt = 1 - t
            a, b, c, d = mt ** 3, 3 * mt * mt * t, 3 * mt * t * t, t ** 3
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                             a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _closePath(self):
        if self.cur and len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


def area(c):
    s = 0.0
    for i in range(len(c)):
        x0, y0 = c[i]
        x1, y1 = c[(i + 1) % len(c)]
        s += x0 * y1 - x1 * y0
    return s / 2  # > 0 means counter-clockwise in y-up


def simplify(c):
    pts = [(round(x), round(y)) for x, y in c]
    out = []
    for p in pts:  # drop duplicates
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len(out) <= 3:
        return out
    keep = [out[0]]
    n = len(out)
    for i in range(1, n):
        a, b, c2 = keep[-1], out[i], out[(i + 1) % n]
        dx, dy = c2[0] - a[0], c2[1] - a[1]
        L = sqrt(dx * dx + dy * dy) or 1
        if abs((b[0] - a[0]) * dy - (b[1] - a[1]) * dx) / L < SIMPLIFY:
            continue  # b sits on the line from the last kept point to the next one
        keep.append(b)
    return keep if len(keep) >= 3 else out


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def sample_point(c):
    # a point just inside the contour near its first edge, robust against shared boundaries
    (x0, y0), (x1, y1) = c[0], c[1]
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    L = sqrt(dx * dx + dy * dy) or 1
    s = 1 if area(c) > 0 else -1  # interior is left of travel for CCW
    return (mx - dy / L * 0.6 * s, my + dx / L * 0.6 * s)


def shapes_of(contours):
    contours = [c for c in (simplify(c) for c in contours) if len(c) >= 3 and abs(area(c)) > 4]
    n = len(contours)
    depth = [0] * n
    parent = [-1] * n
    for i in range(n):
        sp = sample_point(contours[i])
        best, best_a = -1, 1e18
        for j in range(n):
            if i != j and inside(sp, contours[j]):
                depth[i] += 1
                a = abs(area(contours[j]))
                if a < best_a:
                    best, best_a = j, a
        parent[i] = best
    shapes = {}
    for i in range(n):
        c = contours[i]
        if depth[i] % 2 == 0:
            if area(c) > 0:
                c = c[::-1]  # outer -> clockwise
            shapes.setdefault(i, [None, []])[0] = c
    for i in range(n):
        if depth[i] % 2 == 1:
            c = contours[i]
            if area(c) < 0:
                c = c[::-1]  # hole -> counter-clockwise
            p = parent[i]
            if p in shapes:
                shapes[p][1].append(c)
    return [[o] + h for o, h in shapes.values() if o]


def enc_contour(c):
    out = bytearray(struct.pack("<H", len(c)))
    px, py = c[0]
    out += struct.pack("<hh", px, py)
    for x, y in c[1:]:
        dx, dy = x - px, y - py
        if -127 <= dx <= 127 and -127 <= dy <= 127:
            out += struct.pack("<bb", dx, dy)
        else:
            out += struct.pack("<bb", -128, 0) + struct.pack("<hh", x, y)
        px, py = x, y
    return out


def main(font_path, charset_path, out_path):
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    chars = sorted(set(open(charset_path, encoding="utf-8").read()) - set("\n\r\t"))
    missing = [ch for ch in chars if ord(ch) not in cmap and ch != " "]
    entries = []
    for ch in chars:
        cp = ord(ch)
        if cp not in cmap:
            continue
        name = cmap[cp]
        pen = FlattenPen(gs)
        gs[name].draw(pen)
        shapes = shapes_of(pen.contours)
        data = bytearray(struct.pack("<H", len(shapes)))
        for shape in shapes:
            data += struct.pack("<H", len(shape))
            for c in shape:
                data += enc_contour(c)
        entries.append((cp, hmtx[name][0], bytes(data)))
    upm = font["head"].unitsPerEm
    hh = font["hhea"]
    head = b"HLG1" + struct.pack("<HhhI", upm, hh.ascent, hh.descent, len(entries))
    index_size = len(entries) * 14
    off = len(head) + index_size
    index, blob = bytearray(), bytearray()
    for cp, adv, data in entries:
        index += struct.pack("<IHII", cp, adv, off + len(blob), len(data))
        blob += data
    with open(out_path, "wb") as f:
        f.write(head + index + blob)
    print(f"{len(entries)} glyphs, {len(head) + len(index) + len(blob)} bytes -> {out_path}")
    if missing:
        print("MISSING:", "".join(missing))


if __name__ == "__main__":
    main(*sys.argv[1:4])
