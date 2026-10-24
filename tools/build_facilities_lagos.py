"""
Build the offline map data for Lagos State, Nigeria: every hospital and
health centre OpenStreetMap knows, sorted into kinds that say only what the
data supports.

Nigeria has no public list of which hospitals run an emergency department
(the U.S. has CMS's). OpenStreetMap marks one at only two Lagos hospitals,
so the map keeps four kinds apart:

  er         OpenStreetMap says emergency=yes
  referral   public general, teaching, federal and specialist hospitals,
             by name (Lagos State's referral hospitals)
  phc        primary health centres and health posts: "not for emergencies"
  hospital   everything else (mostly private): "emergency care not confirmed"

    python tools/build_facilities_lagos.py            # use research/data/lagos_overpass.json
    python tools/build_facilities_lagos.py --refresh  # download it again from the Overpass API

Writes mobile/src/facilities/lagos_facilities.json.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "research" / "data" / "lagos_overpass.json"
OUT = ROOT / "mobile" / "src" / "facilities" / "lagos_facilities.json"
QUERY = (
    '[out:json][timeout:120];area["name"="Lagos"]["admin_level"="4"]["boundary"="administrative"]->.a;'
    '(nwr["amenity"="hospital"](area.a);nwr["healthcare"="hospital"](area.a););out center tags;'
)

REFERRAL = re.compile(
    r"general hospital|teaching hospital|federal medical|national orthop|"
    r"military hospital|navy|naval|police hospital|state hospital|randle general|lasuth|\bluth\b",
    re.I,
)
PHC = re.compile(r"primary health|health cent(er|re)|health post|\bphc\b|maternity cent(er|re)|community health", re.I)


def download() -> None:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter", data=body, headers={"User-Agent": "Mayday-CAC-student-project"}
    )
    RAW.write_bytes(urllib.request.urlopen(req, timeout=180).read())


def kind_of(tags: dict) -> str:
    name = tags.get("name", "")
    if tags.get("emergency") == "yes":
        return "er"
    # A psychiatric hospital is not where a collapse or a wound should go.
    if REFERRAL.search(name) and "psychiatric" not in name.lower():
        return "referral"
    if PHC.search(name):
        return "phc"
    return "hospital"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    if args.refresh or not RAW.exists():
        download()
    data = json.loads(RAW.read_text(encoding="utf-8"))
    seen: set[tuple[str, float, float]] = set()
    facilities = []
    for e in data["elements"]:
        tags = e.get("tags", {})
        name = " ".join(tags.get("name", "").split())
        lat = e.get("lat", e.get("center", {}).get("lat"))
        lon = e.get("lon", e.get("center", {}).get("lon"))
        if not name or lat is None or tags.get("emergency") == "no":
            continue
        key = (name.lower(), round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)
        street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
        facilities.append(
            {
                "id": f"osm-{e['type'][0]}{e['id']}",
                "name": name,
                "kind": kind_of(tags),
                "traumaLevel": None,
                "address": street or None,
                "city": tags.get("addr:city") or None,
                "phone": tags.get("phone") or tags.get("contact:phone") or None,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "pediatric": bool(re.search(r"child|paediatric|pediatric|massey", name, re.I)),
            }
        )
    facilities.sort(key=lambda f: (f["kind"], f["name"]))
    counts = {k: sum(1 for f in facilities if f["kind"] == k) for k in ("er", "referral", "phc", "hospital")}
    out = {
        "region": "Lagos State, Nigeria",
        "built": date.today().isoformat(),
        "sources": [
            {
                "what": "Hospitals and health centres",
                "name": "OpenStreetMap contributors, via the Overpass API (amenity=hospital or healthcare=hospital in Lagos State)",
                "license": "ODbL 1.0",
                "url": "https://www.openstreetmap.org/copyright",
                "retrieved": date.today().isoformat(),
            }
        ],
        "note": "OpenStreetMap marks an emergency department at only a few Lagos hospitals. 'referral' is assigned by name "
        "(general, teaching, federal and specialist public hospitals), not from an official list.",
        "counts": counts,
        "facilities": facilities,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(facilities)} places -> {OUT.relative_to(ROOT)}  {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
