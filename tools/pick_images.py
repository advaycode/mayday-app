"""
Turn the chosen crawled images into step pictures for the app, and write
their credits.

    python tools/pick_images.py

Choices were made by looking at every candidate's contact sheet
(research/images/candidates*/<visual>/sheet.jpg) and rejecting anything wrong
for 2025 guidance. Rejected on purpose:
  - every infant CPR image found shows the two-finger technique, withdrawn in
    2025, so infant CPR keeps the app's own two-thumb diagram;
  - every naloxone image shows the injectable kit, not the nasal spray;
  - a green "tourniquet" that is really a blood-draw strap.

Full color (2026-10-21). Every picture sits on the same light card in the app:
  ill    illustrations and drawings on white: the white becomes the card color
         (multiply), so the drawing sits on the card with no visible box
  photo  photographs: a centered square crop, colors kept
Output: mobile/assets/steps/<visual>.jpg (square, 720 px), the TypeScript
manifest, and docs/IMAGE_CREDITS.md. Wikimedia licenses require credit and,
for CC BY-SA, that the edited image keeps the same license; both are stated.
"""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "c": ROOT / "research" / "images" / "candidates-color",
    "o": ROOT / "research" / "images" / "candidates",
}
OUT = ROOT / "mobile" / "assets" / "steps"
MANIFEST = ROOT / "mobile" / "src" / "design" / "stepImages.ts"
CREDITS = ROOT / "docs" / "IMAGE_CREDITS.md"
SIZE = 720
# The card behind every step picture (mobile/src/design/tokens.ts color.card).
CARD = (243, 239, 231)

# visual -> (source, candidate folder, file, style, crop box as fractions: left, top, right, bottom)
# Crops cut off the captions burned into some illustrations.
PICKS = {
    "hands-adult": ("c", "hands-adult", "5.jpg", "ill", (0.0, 0.0, 1.0, 0.80)),
    "hands-child": ("c", "hands-child", "0.jpg", "ill", (0.0, 0.0, 1.0, 0.78)),
    "check-breathing": ("c", "check-breathing", "0.jpg", "ill", (0.0, 0.17, 1.0, 1.0)),
    "abdominal-thrusts": ("c", "abdominal-thrusts", "1.jpg", "ill", (0.052, 0.08, 0.358, 0.76)),
    "infant-back-blows": ("c", "infant-choking", "0.jpg", "ill", (0.0, 0.0, 0.5, 0.74)),
    "back-blows": ("o", "back-blows", "0.jpg", "ill", (0.0, 0.0, 1.0, 1.0)),
    "chest-thrusts": ("o", "chest-thrusts", "3.jpg", "ill", (0.0, 0.0, 1.0, 1.0)),
    "choking-sign": ("o", "choking-sign", "1.jpg", "ill", (0.0, 0.0, 1.0, 0.85)),
    "recovery": ("o", "recovery", "1.jpg", "ill", (0.0, 0.0, 1.0, 1.0)),
    "fast-face": ("o", "fast-face", "1.jpg", "ill", (0.15, 0.05, 0.85, 0.85)),
    "aed-pads": ("o", "aed-pads", "1.jpg", "ill", (0.2, 0.3, 0.86, 0.82)),
    "point": ("c", "aed", "9.jpg", "photo", (0.0, 0.0, 1.0, 1.0)),
    "aed": ("o", "aed", "1.jpg", "photo", (0.0, 0.0, 1.0, 1.0)),
    "tourniquet": ("o", "tourniquet", "3.jpg", "photo", (0.0, 0.0, 1.0, 1.0)),
    "pressure": ("o", "pressure", "3.jpg", "photo", (0.05, 0.0, 0.95, 1.0)),
    "pack": ("o", "pressure", "9.jpg", "photo", (0.1, 0.1, 0.9, 1.0)),
    "cool-water": ("o", "cool-water", "0.jpg", "photo", (0.0, 0.2, 1.0, 1.0)),
}


def square(im: Image.Image, box, kind: str) -> Image.Image:
    w, h = im.size
    l, t, r, b = box
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if kind == "photo":
        # Photos: a centered square, no bars.
        side = min(im.size)
        x, y = (im.width - side) // 2, (im.height - side) // 2
        return im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
    # Drawings: pad to square on white (which becomes the card color), with a margin.
    side = int(max(im.size) * 1.08)
    bg = Image.new("RGB", (side, side), (255, 255, 255))
    bg.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return bg.resize((SIZE, SIZE), Image.LANCZOS)


def style(im: Image.Image, kind: str) -> Image.Image:
    if kind == "ill":
        # White paper becomes the card; colors and lines are kept.
        return ImageChops.multiply(im, Image.new("RGB", im.size, CARD))
    return ImageEnhance.Contrast(im).enhance(1.04)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, credits = [], []
    for old in OUT.glob("*.jpg"):
        old.unlink()
    for visual, (source, folder, file, kind, box) in PICKS.items():
        base = SOURCES[source] / folder
        meta = {m["file"]: m for m in json.loads((base / "meta.json").read_text(encoding="utf-8"))}[file]
        im = Image.open(base / file).convert("RGB")
        out = style(square(im, box, kind), kind)
        out.save(OUT / f"{visual}.jpg", quality=86, optimize=True)
        # Commons author fields can hold several lines (a unit and its address); keep the first.
        author = " ".join((meta["author"] or "Unknown").strip().splitlines()[0].split())
        if author == "Unknown" and meta["title"].startswith("File:USMC-"):
            author = "U.S. Marine Corps"  # official USMC photo (the file name is its DoD ID)
        credit = {
            "visual": visual,
            "title": meta["title"].removeprefix("File:"),
            "author": author,
            "license": meta["license"],
            "licenseUrl": meta.get("license_url") or "",
            "source": meta["page"],
        }
        credits.append(credit)
        rows.append(f"  {json.dumps(visual)}: {{ src: require('../../assets/steps/{visual}.jpg'), credit: {json.dumps(credit, ensure_ascii=False)} }},")

    MANIFEST.write_text(
        "// GENERATED by tools/pick_images.py. Do not edit by hand.\n"
        "// Step pictures crawled from Wikimedia Commons, restyled for the app. Credits: docs/IMAGE_CREDITS.md\n\n"
        "export type StepImage = { src: number; credit: { visual: string; title: string; author: string; license: string; licenseUrl: string; source: string } };\n\n"
        "export const stepImages: Record<string, StepImage> = {\n" + "\n".join(rows) + "\n};\n",
        encoding="utf-8",
    )

    lines = [
        "# Image credits",
        "",
        "Step pictures come from Wikimedia Commons, found with `tools/crawl_images.py` and chosen by hand with `tools/pick_images.py`. "
        "Each was cropped (removing burned-in captions) and set on the app's light card color (changes made). Images under a CC BY-SA license remain under that same license in their edited form.",
        "",
        "| Step picture | Original | Author | License |",
        "|---|---|---|---|",
    ]
    for c in credits:
        lic = f"[{c['license']}]({c['licenseUrl']})" if c["licenseUrl"] else c["license"]
        lines.append(f"| `{c['visual']}` | [{c['title']}]({c['source']}) | {c['author'].replace('|', '/')} | {lic} |")
    lines += ["", "Map tiles: Esri, HERE, Garmin, © OpenStreetMap contributors."]
    CREDITS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(credits)} step images -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
