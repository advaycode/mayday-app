"""
Build the offline map data: every Florida hospital with an emergency
department, every state-designated trauma center with its level, and urgent
care clinics around Tampa Bay (clearly marked "not for emergencies").

Most "nearest hospital" features are wrong because not every hospital has an
emergency department and very few are trauma centers. This keeps the three
apart, from sources a judge can check:

  ERs           CMS Provider Data Catalog, "Hospital General Information"
                (dataset xubh-q36u), field `emergency_services` == "Yes"
  Trauma        Florida Department of Health, "Florida Trauma Centers",
                updated July 23, 2026 (research/data/fl_trauma_centers_doh.pdf)
  Urgent care   OpenStreetMap via the Overpass API (partial coverage)
  Coordinates   U.S. Census Bureau batch geocoder, with OpenStreetMap
                Nominatim for the addresses it cannot match

    python tools/build_facilities.py           # use cached downloads in research/data
    python tools/build_facilities.py --refresh # download everything again

Writes mobile/src/facilities/fl_facilities.json. To add another state, add
its trauma list to TRAUMA and change STATE.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "research" / "data"
OUT = ROOT / "mobile" / "src" / "facilities" / "fl_facilities.json"
STATE = "FL"
UA = "Mayday-CAC-student-app/0.1 (advay.awesomer@gmail.com)"

CMS_URL = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0"
    "?conditions%5B0%5D%5Bproperty%5D=state&conditions%5B0%5D%5Bvalue%5D={state}"
    "&conditions%5B0%5D%5Boperator%5D=%3D&limit=500"
)
CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
OVERPASS_URL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
TAMPA_BAY_BBOX = (27.6, -82.9, 28.6, -81.9)

# Florida DOH "Florida Trauma Centers", updated July 23, 2026. Name and level
# exactly as published, then the CMS facility it corresponds to (matched by
# name and confirmed by street address where the names differ), or None when
# CMS does not list it separately and we geocode it ourselves.
TRAUMA = [
    ("Ascension Sacred Heart Bay", "II", "ASCENSION SACRED HEART BAY"),
    ("Ascension Sacred Heart Pensacola", "I", "SACRED HEART HOSPITAL"),
    ("Baptist Hospital", "II", ("BAPTIST HOSPITAL", "PENSACOLA")),
    ("Broward Health Medical Center", "I", "BROWARD HEALTH MEDICAL CENTER"),
    ("Broward Health North", "II", "BROWARD HEALTH NORTH"),
    ("Delray Medical Center", "I", "DELRAY MEDICAL CENTER"),
    ("Gulf Coast Medical Center", "II", "GULF COAST MEDICAL CENTER LEE HEALTH"),
    ("Halifax Health Medical Center of Daytona Beach", "II", "HALIFAX HEALTH MEDICAL CENTER"),
    ("HCA Florida Aventura Hospital", "II", "HCA FLORIDA AVENTURA HOSPITAL"),
    ("HCA Florida Bayonet Point Hospital", "II", "HCA FLORIDA BAYONET POINT HOSPITAL"),
    ("HCA Florida Blake Hospital", "II", "HCA FLORIDA BLAKE HOSPITAL"),
    ("HCA Florida Fort Walton-Destin Hospital", "II", "HCA FLORIDA FORT WALTON-DESTIN HOSPITAL"),
    ("HCA Florida Kendall Hospital", "I", "HCA FLORIDA KENDALL HOSPITAL"),
    # CMS lists 1401 W Seminole Blvd, Sanford under its corporate name.
    ("HCA Florida Lake Monroe Hospital", "II", "CENTRAL FLORIDA LAKE MONROE HOSPITAL"),
    ("HCA Florida Lawnwood Hospital", "II", "HCA FLORIDA LAWNWOOD HOSPITAL"),
    ("HCA Florida Memorial Hospital", "II", "HCA FLORIDA MEMORIAL HOSPITAL"),
    # CMS lists 1431 SW 1st Ave, Ocala as "Marion Community Hospital" (its legal name).
    ("HCA Florida Ocala Hospital", "II", "MARION COMMUNTIY HOSPITAL"),
    ("HCA Florida Orange Park Hospital", "II", "HCA FLORIDA ORANGE PARK HOSPITAL"),
    ("HCA Florida Osceola Hospital", "II", "HCA FLORIDA OSCEOLA HOSPITAL"),
    ("Holmes Regional Medical Center", "II", "HOLMES REGIONAL MEDICAL CENTER"),
    # CMS lists 1611 NW 12th Ave, Miami (Jackson Memorial) as "Jackson Health System".
    ("Jackson Memorial Hospital", "I", "JACKSON HEALTH SYSTEM"),
    ("Jackson South Medical Center", "II", None),
    ("Johns Hopkins All Children's Hospital", "Pediatric", "JOHNS HOPKINS ALL CHILDREN'S HOSPITAL"),
    ("Lakeland Regional Health Medical Center", "I", "LAKELAND REGIONAL MEDICAL CENTER"),
    ("Memorial Regional Hospital", "I", "MEMORIAL REGIONAL HOSPITAL"),
    ("Nicklaus Children's Hospital", "Pediatric", "NICKLAUS CHILDREN'S HOSPITAL"),
    ("Orlando Health Bayfront Hospital", "II", "ORLANDO HEALTH BAYFRONT HOSPITAL"),
    # CMS lists 52 W Underwood St, Orlando (ORMC) as "Orlando Health".
    ("Orlando Health Orlando Regional Medical Center", "I", "ORLANDO HEALTH"),
    ("Sarasota Memorial Hospital", "II", ("SARASOTA MEMORIAL HOSPITAL", "SARASOTA")),
    ("St. Joseph's Hospital", "II and Pediatric", "ST JOSEPHS HOSPITAL"),
    ("St. Mary's Medical Center", "I", "ST MARY'S MEDICAL CENTER"),
    ("Tallahassee Memorial Hospital", "II", "TALLAHASSEE MEMORIAL HEALTHCARE"),
    ("Tampa General Hospital", "I", ("TAMPA GENERAL HOSPITAL", "TAMPA")),
    ("UF Health Jacksonville", "I", "SHANDS JACKSONVILLE"),
    ("UF Health Shands Hospital", "I", "UF HEALTH SHANDS HOSPITAL"),
    ("Wolfson Children's Hospital", "Pediatric", None),
]
# Addresses for the trauma centers CMS does not list on their own.
EXTRA_ADDRESSES = {
    "Jackson South Medical Center": ("9333 SW 152nd St", "Miami", "33157"),
    "Wolfson Children's Hospital": ("800 Prudential Dr", "Jacksonville", "32207"),
}
# Better search terms for hospitals whose CMS address neither geocoder matches.
ALIASES = {
    "HCA FLORIDA TWIN CITIES HOSPITAL": "Twin Cities Hospital, Niceville, Florida",
    "BAPTIST HOSPITAL": "Baptist Hospital, Brent Lane, Pensacola, Florida",
    "VA NORTH FLORIDA/SOUTH GEORGIA HEALTHCARE SYSTEM - GAINESVILLE": "Malcom Randall VA Medical Center, Gainesville, Florida",
}
# Coordinates read by hand when no geocoder knows the address (new campuses).
MANUAL_COORDS = {
    # Opened September 2023 at Brent Ln and I-110; 30 25 47 N, 87 13 52 W.
    "BAPTIST HOSPITAL": (30.42972, -87.23111, "Wikipedia: Baptist Hospital (Pensacola), 123 Baptist Way"),
}
# Military hospitals restrict access; psychiatric emergency rooms are not for medical emergencies.
EXCLUDED_TYPES = {"Acute Care - Department of Defense", "Psychiatric"}


def get(url: str, data: bytes | None = None, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def cms_hospitals(refresh: bool) -> list[dict]:
    path = DATA / "cms_fl.json"
    if refresh or not path.exists():
        path.write_bytes(get(CMS_URL.format(state=STATE)))
    return json.loads(path.read_text(encoding="utf-8"))["results"]


def census_geocode(rows: list[tuple[str, str, str, str]], refresh: bool) -> dict[str, tuple[float, float]]:
    path = DATA / "geocoded.csv"
    if refresh or not path.exists():
        buf = io.StringIO()
        w = csv.writer(buf)
        for fid, addr, city, zip_ in rows:
            w.writerow([fid, addr, city, STATE, zip_])
        boundary = "mayday-boundary"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"benchmark\"\r\n\r\nPublic_AR_Current\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"addressFile\"; filename=\"a.csv\"\r\n"
            f"Content-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n--{boundary}--\r\n"
        ).encode()
        path.write_bytes(get(CENSUS_URL, body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}))
    out = {}
    for row in csv.reader(path.read_text(encoding="utf-8").splitlines()):
        if len(row) >= 6 and row[2] == "Match":
            lon, lat = map(float, row[5].split(","))
            out[row[0]] = (lat, lon)
    return out


def nominatim(query: str) -> tuple[float, float] | None:
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "countrycodes": "us"}
    )
    time.sleep(1.1)  # Nominatim usage policy: at most one request a second.
    try:
        res = json.loads(get(url))
    except Exception:
        return None
    return (float(res[0]["lat"]), float(res[0]["lon"])) if res else None


def urgent_care(refresh: bool) -> list[dict]:
    path = DATA / "overpass_urgent.json"
    if refresh or not path.exists():
        s, w, n, e = TAMPA_BAY_BBOX
        q = f'[out:json][timeout:60];nwr["name"~"Urgent Care",i]({s},{w},{n},{e});out center tags;'
        path.write_bytes(get(OVERPASS_URL, urllib.parse.urlencode({"data": q}).encode()))
    out = []
    for el in json.loads(path.read_text(encoding="utf-8"))["elements"]:
        t = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        addr = " ".join(filter(None, [t.get("addr:housenumber"), t.get("addr:street")]))
        out.append({
            "id": f"osm-{el['type'][0]}{el['id']}",
            "name": t["name"],
            "kind": "urgent",
            "traumaLevel": None,
            "address": addr or None,
            "city": t.get("addr:city"),
            "phone": t.get("phone") or t.get("contact:phone"),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "pediatric": "pediatric" in t["name"].lower() or "kid" in t["name"].lower(),
        })
    return out


def title(s: str) -> str:
    small = {"of", "and", "the", "at"}
    words = s.lower().split()
    fixed = []
    for i, w in enumerate(words):
        if w in {"hca", "uf", "va", "tgh", "ii"}:
            fixed.append(w.upper())
        elif i and w in small:
            fixed.append(w)
        else:
            fixed.append(w[:1].upper() + w[1:])
    out = " ".join(fixed).replace("'S", "'s")
    # Brand spellings that title case gets wrong.
    for wrong, right in {"Adventhealth": "AdventHealth", "Baycare": "BayCare", "Hca ": "HCA ", "Uf Health": "UF Health", "Mcdonald": "McDonald", "Nh ": "NH "}.items():
        out = out.replace(wrong, right)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    hospitals = cms_hospitals(args.refresh)
    er = [h for h in hospitals if h["emergency_services"] == "Yes" and h["hospital_type"] not in EXCLUDED_TYPES]
    coords = census_geocode([(h["facility_id"], h["address"], h["citytown"], h["zip_code"]) for h in er], args.refresh)

    fills_path = DATA / "nominatim_fills.json"
    fills = json.loads(fills_path.read_text(encoding="utf-8")) if fills_path.exists() else {}
    for h in er:
        fid = h["facility_id"]
        if fid in coords:
            continue
        if h["facility_name"] in MANUAL_COORDS and h["citytown"].upper() == "PENSACOLA":
            lat, lon, _ = MANUAL_COORDS[h["facility_name"]]
            coords[fid] = (lat, lon)
            continue
        if fid not in fills or fills[fid] is None:
            alias = ALIASES.get(h["facility_name"])
            hit = (alias and nominatim(alias)) or nominatim(f"{h['facility_name']}, {h['citytown']}, {STATE}") or nominatim(
                f"{h['address']}, {h['citytown']}, {STATE} {h['zip_code']}"
            )
            fills[fid] = [hit[0], hit[1], "nominatim"] if hit else None
        if fills.get(fid):
            coords[fid] = (fills[fid][0], fills[fid][1])
    fills_path.write_text(json.dumps(fills, indent=1), encoding="utf-8")

    by_name: dict[str, list[dict]] = {}
    for h in er:
        by_name.setdefault(h["facility_name"], []).append(h)

    facilities: dict[str, dict] = {}
    for h in er:
        if h["facility_id"] not in coords:
            print("skip (no coordinates):", h["facility_name"])
            continue
        lat, lon = coords[h["facility_id"]]
        facilities[h["facility_id"]] = {
            "id": f"cms-{h['facility_id']}",
            "name": title(h["facility_name"]),
            "kind": "er",
            "traumaLevel": None,
            "address": title(h["address"]),
            "city": title(h["citytown"]),
            "phone": h["telephone_number"] or None,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "pediatric": h["hospital_type"] == "Childrens",
            "veterans": "Veterans" in h["hospital_type"],
        }

    unmatched = []
    for doh_name, level, cms in TRAUMA:
        target = None
        if cms is not None:
            name, city = (cms if isinstance(cms, tuple) else (cms, None))
            cands = [h for h in by_name.get(name, []) if city is None or h["citytown"].upper() == city]
            if len(cands) == 1 and cands[0]["facility_id"] in facilities:
                target = facilities[cands[0]["facility_id"]]
        if target is None and cms is not None:
            # Matched in CMS but that hospital has no coordinates: never guess by name alone.
            unmatched.append(doh_name)
            continue
        if target is None:
            addr, city, zip_ = EXTRA_ADDRESSES[doh_name]
            hit = nominatim(f"{doh_name}, {city or ''}, {STATE}") or (addr and nominatim(f"{addr}, {city}, {STATE} {zip_}"))
            if not hit:
                unmatched.append(doh_name)
                continue
            target = facilities[f"doh-{doh_name}"] = {
                "id": "doh-" + doh_name.lower().replace(" ", "-").replace("'", ""),
                "name": doh_name,
                "kind": "er",
                "traumaLevel": None,
                "address": addr,
                "city": city,
                "phone": None,
                "lat": round(hit[0], 6),
                "lon": round(hit[1], 6),
                "pediatric": "Children" in doh_name,
                "veterans": False,
            }
        target["kind"] = "trauma"
        target["traumaLevel"] = level
        target["name"] = doh_name  # the state's name for it is the one people know
        target["pediatric"] = target["pediatric"] or "Pediatric" in level

    urgent = urgent_care(args.refresh)
    all_f = sorted(facilities.values(), key=lambda f: f["name"]) + urgent

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "generated": date.today().isoformat(),
                "state": STATE,
                "sources": {
                    "er": "CMS Provider Data Catalog, Hospital General Information (xubh-q36u), emergency_services = Yes",
                    "trauma": "Florida Department of Health, Florida Trauma Centers, updated July 23, 2026",
                    "urgent": "OpenStreetMap contributors via Overpass API (Tampa Bay; partial coverage)",
                    "geocoding": "U.S. Census Bureau geocoder; OpenStreetMap Nominatim for unmatched addresses",
                },
                "facilities": all_f,
            },
            indent=1,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    kinds = {k: sum(1 for f in all_f if f["kind"] == k) for k in ("er", "trauma", "urgent")}
    print(f"wrote {OUT.relative_to(ROOT)}: {kinds}")
    if unmatched:
        print("UNMATCHED trauma centers:", unmatched)


if __name__ == "__main__":
    main()
