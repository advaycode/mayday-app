"""
Build the public web page: the real app in a phone frame, with a developer panel.

    python tools/build_site.py              # -> site/dist, for https://<user>.github.io/mayday/
    python tools/build_site.py --skip-app   # reuse mobile/dist-iphone if it was built for this base
    python tools/deploy_site.py             # publish site/dist

site/dist/
  index.html    the page (site/index.html): phone frame, "Source code", "Developer only"
  heartlab.js   the developer panel's heartbeat lab: the simulated person (sensors/sim.ts)
                and BeatNet (sensors/beatnet.ts), bundled from the app's own TypeScript
  app/          the iPhone web build (tools/build_iphone.py) under <base>/app

Bundling needs Bun (https://bun.sh). Nothing in Mayday can call 911 or anyone else.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
OUT = SITE / "dist"
APP_BUILD = ROOT / "mobile" / "dist-iphone"


def bun() -> str:
    found = shutil.which("bun") or next((str(p) for p in (Path.home() / ".bun" / "bin").glob("bun*") if p.stem == "bun"), None)
    if not found:
        raise SystemExit("Bun is needed to bundle the heartbeat lab: https://bun.sh")
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="/mayday", help="where the page lives on the site")
    ap.add_argument("--skip-app", action="store_true")
    a = ap.parse_args()
    base = "/" + a.base.strip("/")

    if not a.skip_app:
        # Called with a list, so no shell rewrites the path (Git Bash turns /mayday into C:/Program Files/Git/mayday).
        subprocess.run([sys.executable, str(ROOT / "tools" / "build_iphone.py"), "--base", f"{base}/app"], check=True)
    if f"{base}/app/" not in (APP_BUILD / "index.html").read_text(encoding="utf-8"):
        raise SystemExit(f"mobile/dist-iphone was not built for {base}/app. Run without --skip-app.")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    subprocess.run([bun(), "build", str(SITE / "heartlab.ts"), "--outfile", str(OUT / "heartlab.js"), "--format", "esm", "--target", "browser", "--minify"], check=True)
    shutil.copy(SITE / "index.html", OUT / "index.html")
    shutil.copytree(APP_BUILD, OUT / "app")
    (OUT / ".nojekyll").write_text("")  # GitHub Pages: serve the app's _expo/ folder
    # Any other path on the site goes back to the page.
    (OUT / "404.html").write_text(f'<!doctype html><meta charset="utf-8"><title>Mayday</title><meta http-equiv="refresh" content="0; url={base}/"><a href="{base}/">Mayday</a>\n', encoding="utf-8")
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()) / 1e6
    print(f"site -> {OUT.relative_to(ROOT)}  ({size:.1f} MB, base {base}/)")


if __name__ == "__main__":
    main()
