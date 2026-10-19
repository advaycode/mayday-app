"""
Crawl Wikimedia Commons for first-aid images, one set of candidates per step
picture, keeping only images whose license lets us use them with credit.

    python tools/crawl_images.py              # crawl every visual
    python tools/crawl_images.py recovery     # just one

Writes research/images/candidates/<visual>/<n>.jpg plus meta.json (title,
author, license, source page) and a contact sheet per visual for choosing.
Choosing is done by a person (anatomy matters): tools/pick_images.py then
copies the chosen file into the app, styled, with its credit.
"""
from __future__ import annotations

import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "images" / "candidates"
API = "https://commons.wikimedia.org/w/api.php"
UA = "Mayday-CAC-student-app/0.1 (advay.awesomer@gmail.com)"
PER_QUERY = 12
KEEP = 10

# Licenses that allow reuse in an app with attribution. Commons hosts nothing
# more restrictive than these, but we check anyway.
OK_LICENSE = re.compile(r"^(public domain|pd|cc0|cc by(-sa)? [\d.]+)", re.I)

QUERIES: dict[str, list[str]] = {
    "hands-adult": ["CPR chest compressions hands", "cardiopulmonary resuscitation hand position", "CPR training manikin compressions"],
    "hands-child": ["child CPR", "pediatric cardiopulmonary resuscitation"],
    "hands-infant": ["infant CPR", "infant cardiopulmonary resuscitation thumbs"],
    "tap-shout": ["check responsiveness first aid", "first aid training unconscious casualty", "basic life support training response check"],
    "check-breathing": ["checking breathing first aid training", "airway breathing check casualty", "first aid unconscious person breathing check"],
    "point": ["call emergency services bystander", "call for help first aid"],
    "position": ["CPR manikin on floor", "person lying supine first aid"],
    "aed": ["automated external defibrillator", "AED defibrillator public"],
    "aed-pads": ["defibrillator pads placement", "AED electrode pad placement"],
    "recovery": ["recovery position", "lateral recovery position first aid"],
    "choking-sign": ["universal choking sign", "choking hands throat"],
    "back-blows": ["back blows choking", "choking first aid back slaps"],
    "abdominal-thrusts": ["Heimlich maneuver", "abdominal thrusts choking"],
    "chest-thrusts": ["chest thrusts choking"],
    "infant-back-blows": ["infant choking back blows", "baby choking first aid", "infant manikin choking training"],
    "infant-chest-thrusts": ["infant chest thrusts choking"],
    "pressure": ["stop the bleed training pressure", "bleeding control training hands", "hemorrhage control direct pressure", "first aid bleeding wound pressure"],
    "pack": ["wound packing gauze", "hemostatic gauze"],
    "tourniquet": ["tourniquet applied arm", "combat application tourniquet"],
    "stop-drop-roll": ["stop drop and roll"],
    "cool-water": ["hand under running water tap", "washing hands faucet running water", "burn first aid cold water"],
    "cover": ["burn dressing first aid", "sterile dressing burn"],
    "fast-face": ["facial droop stroke", "facial palsy smile"],
    "fast-arms": ["arm drift stroke test", "pronator drift"],
    "nasal-spray": ["naloxone", "naloxone kit", "Narcan"],
}


def api(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def clean(s: str | None) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def search(query: str) -> list[dict]:
    data = api({
        "action": "query", "generator": "search", "gsrnamespace": 6, "gsrsearch": f"{query} filetype:bitmap",
        "gsrlimit": PER_QUERY, "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size", "iiurlwidth": 900,
    })
    out = []
    for page in (data.get("query", {}).get("pages") or {}).values():
        ii = (page.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata", {})
        lic = clean(meta.get("LicenseShortName", {}).get("value"))
        if ii.get("mime") not in ("image/jpeg", "image/png") or not OK_LICENSE.match(lic or ""):
            continue
        if (ii.get("width") or 0) < 400:
            continue
        out.append({
            "title": page["title"],
            "thumb": ii.get("thumburl") or ii.get("url"),
            "page": ii.get("descriptionurl"),
            "license": lic,
            "license_url": clean(meta.get("LicenseUrl", {}).get("value")),
            "author": clean(meta.get("Artist", {}).get("value"))[:120],
            "description": clean(meta.get("ImageDescription", {}).get("value"))[:240],
            "query": query,
        })
    return out


def contact_sheet(folder: Path, items: list[dict]) -> None:
    if not items:
        return
    tile = 300
    cols = 5
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * (tile + 28)), (18, 17, 16))
    draw = ImageDraw.Draw(sheet)
    for i, it in enumerate(items):
        try:
            im = Image.open(folder / it["file"]).convert("RGB")
        except Exception:
            continue
        im.thumbnail((tile - 8, tile - 8))
        x, y = (i % cols) * tile, (i // cols) * (tile + 28)
        sheet.paste(im, (x + (tile - im.width) // 2, y + (tile - im.height) // 2))
        draw.text((x + 6, y + tile + 4), f"{i}: {it['license'][:18]}", fill=(242, 239, 232))
    sheet.save(folder / "sheet.jpg", quality=80)


def crawl(visual: str) -> None:
    folder = OUT / visual
    folder.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    items: list[dict] = []
    for q in QUERIES[visual]:
        for it in search(q):
            if it["title"] in seen:
                continue
            seen.add(it["title"])
            items.append(it)
        time.sleep(0.5)
    items = items[:KEEP]
    for n, it in enumerate(items):
        req = urllib.request.Request(it["thumb"], headers={"User-Agent": UA})
        try:
            raw = urllib.request.urlopen(req, timeout=60).read()
            Image.open(io.BytesIO(raw)).convert("RGB").save(folder / f"{n}.jpg", quality=88)
            it["file"] = f"{n}.jpg"
        except Exception as e:  # skip broken downloads
            it["file"] = None
            it["error"] = str(e)
        time.sleep(0.3)
    items = [it for it in items if it.get("file")]
    (folder / "meta.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    contact_sheet(folder, items)
    print(f"{visual}: {len(items)} candidates")


if __name__ == "__main__":
    for v in sys.argv[1:] or QUERIES:
        crawl(v)
