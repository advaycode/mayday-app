"""
App icon: the home screen's emergency control, reduced to its essentials.
A signal-red disc and three quarters of the hold ring, on warm graphite. Drawn at
4x and downsampled so the edges are clean.

    python tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "mobile" / "assets" / "images"
GRAPHITE = (18, 17, 16, 255)
SIGNAL = (215, 38, 30, 255)
INK = (242, 239, 232, 255)
SS = 4  # supersampling


def mark(size: int, bg, disc_frac=0.46, ring=True, disc=SIGNAL, ring_color=INK) -> Image.Image:
    S = size * SS
    im = Image.new("RGBA", (S, S), bg)
    d = ImageDraw.Draw(im)
    c = S / 2
    r = S * disc_frac / 2
    if ring:
        # Three quarters of the hold ring: the moment just before emergency mode opens.
        rr = r * 1.2
        w = max(SS, int(S * 0.016))
        d.arc([c - rr, c - rr, c + rr, c + rr], start=-90, end=180, fill=ring_color, width=w)
    d.ellipse([c - r, c - r, c + r, c + r], fill=disc)
    return im.resize((size, size), Image.LANCZOS)


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    mark(1024, GRAPHITE).save(IMG / "icon.png")
    # Android adaptive icon: the system crops to a circle or squircle, so keep the mark inside the middle 60%.
    mark(1024, (0, 0, 0, 0), disc_frac=0.34).save(IMG / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), GRAPHITE).save(IMG / "android-icon-background.png")
    mark(1024, (0, 0, 0, 0), disc_frac=0.34, disc=(255, 255, 255, 255), ring_color=(255, 255, 255, 255)).save(IMG / "android-icon-monochrome.png")
    mark(400, (0, 0, 0, 0), disc_frac=0.7).save(IMG / "splash-icon.png")
    mark(48, GRAPHITE, disc_frac=0.56).save(IMG / "favicon.png")
    # Windows shortcut icon for the phone mirror.
    big = mark(256, (0, 0, 0, 0), disc_frac=0.62)
    big.save(ROOT / "mirror" / "mayday.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("icons written")


if __name__ == "__main__":
    main()
