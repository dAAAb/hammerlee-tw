"""Extract every Portaly page (main + sub pages) into research/portaly/<slug>/content.md + image list."""
import json, re, sys, os, html

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding="utf-8"))
pd = d["props"]["pageProps"]["data"]
links = pd["links"]

def strip(h):
    h = re.sub(r"<br\s*/?>", "\n", h or "")
    h = re.sub(r"</(p|h\d|li)>", "\n", h)
    h = re.sub(r"<[^>]+>", "", h)
    return html.unescape(h).strip()

def dump_blocks(order, blocks, f, imgs):
    for bid in order:
        b = blocks[bid] if isinstance(blocks, dict) else next(x for x in blocks if x["id"] == bid)
        if b.get("hidden"):
            continue
        f.write(f"\n## [{b.get('type')}] {bid}\n")
        for it in b.get("items", []):
            for k in ("text", "alt", "title"):
                if it.get(k):
                    f.write(f"- **{k}**: {it[k]}\n")
            if it.get("description"):
                f.write(strip(it["description"]) + "\n")
            lid = it.get("linkId")
            if lid and lid in links:
                f.write(f"- link: {links[lid].get('url')}\n")
            if it.get("image"):
                n = len(imgs)
                imgs.append(it["image"])
                f.write(f"- image: img_{n:02d}\n")
            for sub in it.get("items", []) or []:
                if isinstance(sub, dict):
                    for k in ("text", "title", "urlyoutube"):
                        if sub.get(k):
                            f.write(f"  - {k}: {sub[k]}\n")
            for k in ("urlyoutube", "urlyoutubeShorts"):
                if it.get(k):
                    f.write(f"- {k}: {it[k]}\n")

def write_page(slug, title, order, blocks):
    os.makedirs(f"{out}/{slug}", exist_ok=True)
    imgs = []
    with open(f"{out}/{slug}/content.md", "w", encoding="utf-8") as f:
        f.write(f"# {title}\n")
        dump_blocks(order, blocks, f, imgs)
    with open(f"{out}/{slug}/images.txt", "w") as f:
        f.write("\n".join(imgs))
    print(slug, title, len(imgs), "images")

write_page("_main", pd.get("name"), pd["blockOrders"], pd["blocks"])
for pid, p in pd["pages"].items():
    slug = p.get("slug") or p.get("url") or pid
    title = p.get("title") or p.get("name") or slug
    write_page(re.sub(r"[^A-Za-z0-9_-]", "_", str(slug)), title, p["blockOrders"], p["blocks"])
extra = {k: pd.get(k) for k in ("avatar", "headerBanner", "footerCustomImage", "ogImage", "favicon")}
json.dump(extra, open(f"{out}/_brand_images.json", "w"), indent=1)
