"""
Publish the web page (tools/build_site.py) to GitHub Pages.

    python tools/build_site.py
    python tools/deploy_site.py            # -> https://<you>.github.io/mayday/

Needs the GitHub CLI, logged in (gh auth login) or given a token in GH_TOKEN.
Only site/dist is published, into its own repository (default: mayday), from
.pages/, a separate git folder. This replaces an iPhone-only build published
by deploy_iphone.py to the same repository: the app is at <site>/app/ and
installs from Safari the same way, so the QR code points there.
"""
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

import qrcode

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "site" / "dist"
PAGES = ROOT / ".pages"


def run(cmd: list[str], cwd: Path = ROOT, check=True) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        raise SystemExit(f"$ {' '.join(cmd)}\n{r.stdout}{r.stderr}")
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="mayday")
    repo = ap.parse_args().repo
    if not (BUILD / "index.html").exists() or not (BUILD / "app" / "index.html").exists():
        raise SystemExit("No site build. Run: python tools/build_site.py")
    if run(["gh", "auth", "status"], check=False).returncode != 0:
        raise SystemExit("Not logged in to GitHub. Run: gh auth login (or set GH_TOKEN)")
    user = run(["gh", "api", "user", "-q", ".login"]).stdout.strip()
    full = f"{user}/{repo}"
    if run(["gh", "repo", "view", full], check=False).returncode != 0:
        run(["gh", "repo", "create", full, "--public", "--description", "Mayday on the web: the app in a phone frame. Never calls 911. Source: github.com/" + user + "/mayday-app"])

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
        run(["git", "commit", "-q", "-m", "Mayday web page"], cwd=PAGES)
    run(["git", "push", "-q", "-u", "origin", "main", "--force"], cwd=PAGES)

    run(["gh", "api", "-X", "POST", f"repos/{full}/pages", "-f", "source[branch]=main", "-f", "source[path]=/"], check=False)
    url = f"https://{user.lower()}.github.io/{repo}/"
    print("Waiting for GitHub Pages to publish...")
    for _ in range(90):
        r = run(["gh", "api", f"repos/{full}/pages/builds/latest"], check=False)
        status = json.loads(r.stdout or "{}").get("status") if r.returncode == 0 else None
        if status == "built":
            break
        if status == "errored":
            raise SystemExit("GitHub Pages build failed; see the repository's Actions tab.")
        time.sleep(5)

    qr = qrcode.QRCode(border=2)
    qr.add_data(url + "app/")
    qr.make_image(fill_color="black", back_color="white").save(ROOT / "docs" / "install-qr.png")
    print(f"\nThe page: {url}\nThe app alone (Safari, Add to Home Screen): {url}app/\nQR code: docs/install-qr.png")


if __name__ == "__main__":
    main()
