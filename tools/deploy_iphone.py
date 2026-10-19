"""
Publish the iPhone build to GitHub Pages and make a QR code to open it.

    gh auth login                      # once
    python tools/build_iphone.py       # build mobile/dist-iphone
    python tools/deploy_iphone.py      # -> https://<you>.github.io/mayday/  + docs/install-qr.png

Only the built app is published, into its own repository (default: mayday).
The source code stays on this computer. The publish happens from .pages/, a
separate git folder, so nothing else on this machine is ever pushed.
"""
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

import qrcode

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "mobile" / "dist-iphone"
PAGES = ROOT / ".pages"


def run(cmd: list[str], cwd: Path = ROOT, check=True, quiet=False) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        raise SystemExit(f"$ {' '.join(cmd)}\n{r.stdout}{r.stderr}")
    if not quiet and r.stdout.strip():
        print(r.stdout.strip())
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="mayday")
    repo = ap.parse_args().repo
    if not (BUILD / "index.html").exists():
        raise SystemExit("No build. Run: python tools/build_iphone.py")
    if run(["gh", "auth", "status"], check=False, quiet=True).returncode != 0:
        raise SystemExit("Not logged in to GitHub. Run: gh auth login")
    user = run(["gh", "api", "user", "-q", ".login"], quiet=True).stdout.strip()
    run(["gh", "auth", "setup-git"], quiet=True)
    full = f"{user}/{repo}"

    if run(["gh", "repo", "view", full], check=False, quiet=True).returncode != 0:
        run(["gh", "repo", "create", full, "--public", "--description", "Mayday: emergency help, step by step (web app build). Never calls 911."])

    # A clean copy of the build in its own git folder.
    PAGES.mkdir(exist_ok=True)
    if not (PAGES / ".git").exists():
        run(["git", "init", "-b", "main"], cwd=PAGES)
        run(["git", "remote", "add", "origin", f"https://github.com/{full}.git"], cwd=PAGES)
    for p in PAGES.iterdir():
        if p.name != ".git":
            shutil.rmtree(p) if p.is_dir() else p.unlink()
    shutil.copytree(BUILD, PAGES, dirs_exist_ok=True)
    run(["git", "add", "-A"], cwd=PAGES)
    if run(["git", "diff", "--cached", "--quiet"], cwd=PAGES, check=False).returncode != 0:
        run(["git", "commit", "-q", "-m", "Mayday iPhone build"], cwd=PAGES)
    run(["git", "push", "-q", "-u", "origin", "main", "--force"], cwd=PAGES)

    # Turn on Pages (already on is fine).
    run(["gh", "api", "-X", "POST", f"repos/{full}/pages", "-f", "source[branch]=main", "-f", "source[path]=/"], check=False, quiet=True)
    url = f"https://{user.lower()}.github.io/{repo}/"
    print("Waiting for GitHub Pages to publish...")
    for _ in range(60):
        r = run(["gh", "api", f"repos/{full}/pages/builds/latest"], check=False, quiet=True)
        status = json.loads(r.stdout or "{}").get("status") if r.returncode == 0 else None
        if status == "built":
            break
        if status == "errored":
            raise SystemExit("GitHub Pages build failed; see the repository's Actions tab.")
        time.sleep(5)

    qr = qrcode.QRCode(border=2)
    qr.add_data(url)
    qr.make_image(fill_color="black", back_color="white").save(ROOT / "docs" / "install-qr.png")
    qr.print_ascii(invert=True)
    print(f"\nOpen on the iPhone in Safari: {url}\nQR code: docs/install-qr.png")


if __name__ == "__main__":
    main()
