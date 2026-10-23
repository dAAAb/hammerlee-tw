"""Make the light JPEGs the chat sends (川伯's policy graphics and photos) from research/portaly.

Usage: python3 -I tools/photos.py
Reads PHOTOS from src/chat/script.js (src, optional crop) and writes public/photos/<id>.jpg at 720 px wide,
plus public/photos/index.json with each photo's aspect ratio.
"""
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "research", "portaly")
OUT = os.path.join(ROOT, "public", "photos")
WIDTH = 720


def photos_from_script():
    text = open(os.path.join(ROOT, "src", "chat", "script.js"), encoding="utf-8").read()
    block = text[text.index("export const PHOTOS = {"):text.index("};", text.index("export const PHOTOS = {"))]
    out = {}
    for m in re.finditer(r"(\w+): \{ src: '([^']+)'(?:, crop: \[([\d, ]+)\])?", block):
        crop = [int(v) for v in m.group(3).split(",")] if m.group(3) else None
        out[m.group(1)] = (m.group(2), crop)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    total = 0
    for pid, (src, crop) in photos_from_script().items():
        im = Image.open(os.path.join(SRC, src)).convert("RGB")
        if crop:
            im = im.crop(tuple(crop))
        h = round(im.height * WIDTH / im.width)
        im = im.resize((WIDTH, h), Image.LANCZOS)
        path = os.path.join(OUT, pid + ".jpg")
        im.save(path, "JPEG", quality=74, optimize=True, progressive=True)
        index[pid] = round(im.width / im.height, 4)
        total += os.path.getsize(path)
    json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=0)
    print(f"{len(index)} photos, {total // 1024} KB -> {OUT}")


if __name__ == "__main__":
    main()
