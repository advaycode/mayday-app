"""
Turn the chosen crawled images into step pictures that fit the app, and
write their credits.

    python tools/pick_images.py

Choices below were made by looking at every candidate's contact sheet
(research/images/candidates/<visual>/sheet.jpg) and rejecting anything
anatomically wrong for 2025 guidance. Rejected on purpose:
  - every infant CPR image found shows the two-finger technique, withdrawn in
    2025, so infant CPR keeps the app's own two-thumb diagram;
  - naloxone photos show the injectable kit, not the nasal spray device.

Styling, so the pictures are calm on a black screen and look like one set:
  line   drawings on white: inverted to light lines on near-black
  photo  photographs: toned to the app's two colors (near-black to warm
         off-white), which also takes the color out of any blood
Output: mobile/assets/steps/<visual>.jpg (square, 720 px), the TypeScript
manifest, and docs/IMAGE_CREDITS.md. Wikimedia licenses require credit and,
for CC BY-SA, that the edited image keeps the same license; both are stated.
"""
import json
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CAND = ROOT / "research" / "images" / "candidates"
OUT = ROOT / "mobile" / "assets" / "steps"
MANIFEST = ROOT / "mobile" / "src" / "design" / "stepImages.ts"
CREDITS = ROOT / "docs" / "IMAGE_CREDITS.md"
SIZE = 720
VOID = (5, 5, 5)
INK = (242, 239, 232)

# visual -> (candidate folder, file, style, crop box as fractions of width/height: left, top, right, bottom)
PICKS = {
    "hands-adult": ("hands-adult", "2.jpg", "photo", (0.18, 0.0, 0.92, 1.0)),
    "hands-child": ("hands-child", "1.jpg", "photo", (0.1, 0.0, 0.9, 0.8)),
    "check-breathing": ("check-breathing", "0.jpg", "photo", (0.05, 0.0, 0.85, 1.0)),
    "recovery": ("recovery", "1.jpg", "line", (0.0, 0.0, 1.0, 1.0)),
    "choking-sign": ("choking-sign", "1.jpg", "line", (0.0, 0.0, 1.0, 0.85)),
    "back-blows": ("back-blows", "0.jpg", "line", (0.0, 0.0, 1.0, 1.0)),
    "abdominal-thrusts": ("abdominal-thrusts", "3.jpg", "line", (0.0, 0.0, 1.0, 1.0)),
    "chest-thrusts": ("chest-thrusts", "3.jpg", "line", (0.0, 0.0, 1.0, 1.0)),
    "aed": ("aed", "1.jpg", "photo", (0.0, 0.0, 1.0, 1.0)),
    "aed-pads": ("aed-pads", "1.jpg", "line-color", (0.2, 0.3, 0.86, 0.82)),
    "tourniquet": ("tourniquet", "3.jpg", "photo", (0.0, 0.0, 1.0, 1.0)),
    "pressure": ("pressure", "3.jpg", "photo", (0.05, 0.0, 0.95, 1.0)),
    "pack": ("pressure", "9.jpg", "photo", (0.1, 0.1, 0.9, 1.0)),
    "cool-water": ("cool-water", "0.jpg", "photo", (0.0, 0.2, 1.0, 1.0)),
    "fast-face": ("fast-face", "1.jpg", "line", (0.15, 0.05, 0.85, 0.85)),
}


def square(im: Image.Image, box, kind: str) -> Image.Image:
    w, h = im.size
    l, t, r, b = box
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if kind == "photo":
        # Photos: crop to a centered square (no bars).
        side = min(im.size)
        x, y = (im.width - side) // 2, (im.height - side) // 2
        return im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
    # Drawings: pad to square on white so nothing is cut off.
    side = max(im.size)
    bg = Image.new("RGB", (side, side), (255, 255, 255))
    bg.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return bg.resize((SIZE, SIZE), Image.LANCZOS)


def tone(gray: Image.Image) -> Image.Image:
    """Map a grayscale image onto the app's two colors."""
    return ImageOps.colorize(gray, black=VOID, white=INK)


def style(im: Image.Image, kind: str) -> Image.Image:
    g = ImageOps.grayscale(im)
    if kind == "line":
        g = ImageOps.autocontrast(ImageOps.invert(g), cutoff=1)
        return tone(g)
    if kind == "line-color":
        # Colored drawings: invert lightness but keep shapes readable.
        g = ImageOps.autocontrast(ImageOps.invert(g), cutoff=1)
        g = ImageEnhance.Contrast(g).enhance(1.15)
        return tone(g)
    # photo: gentle contrast, a little darker so it sits on black
    g = ImageOps.autocontrast(g, cutoff=1)
    g = ImageEnhance.Brightness(g).enhance(0.88)
    return tone(g)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, credits = [], []
    for visual, (folder, file, kind, box) in PICKS.items():
        meta = {m["file"]: m for m in json.loads((CAND / folder / "meta.json").read_text(encoding="utf-8"))}[file]
        im = Image.open(CAND / folder / file).convert("RGB")
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
        "Each was cropped and recolored to the app's two colors (changes made). Images under a CC BY-SA license remain under that same license in their edited form.",
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
