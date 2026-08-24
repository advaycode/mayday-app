# Mayday research — AED registries, location relay, EMD protocols, EMS handoff

KEY: `aed-and-location`
Researcher: Claude (Opus 5). Session date: **2026-08-23**. All findings below were fetched this session.

---

## 1. AED DATA

### 1.1 OpenStreetMap `emergency=defibrillator` — the only bundleable source

**Tag schema** (source: https://wiki.openstreetmap.org/wiki/Tag:emergency%3Ddefibrillator, fetched 2026-08-23)

Primary tag `emergency=defibrillator`, mapped **as a node only** (the wiki explicitly says do NOT put it on a building/amenity — that literally means "this building is a defibrillator"). Companion tags:

| Tag | Meaning |
|---|---|
| `opening_hours=*` | only accessible during these hours |
| `access=*` | `yes` / `customers` / `private` / `permissive` |
| `phone=*` | number of the location responsible for the device |
| `emergency:phone=*` | emergency number for the area |
| `defibrillator:location=*` | **free-text description of where the device physically is** — the single most useful field for a bystander |
| `indoor=yes/no` | wall-mounted inside vs outside |
| `locked=yes/no` | device/cabinet locked |
| `defibrillator:code=*` | access code for the cabinet |
| `level=*` | floor level if indoors |
| `description=*`, `manufacturer=*`, `model=*`, `defibrillator:cabinet=*` | extras |
| `ref:GB:the_circuit=*` | UK national registry cross-ref |

Deprecated: `emergency=aed` → replaced by `emergency=defibrillator`.

**Licence:** ODbL 1.0 (Open Database License). Confirmed directly in the Overpass API response header this session:
> `"copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL."`

ODbL permits bundling a static extract in a shipped app, **but** requires (a) attribution "© OpenStreetMap contributors", and (b) if you distribute a *modified* database (a derived/filtered extract counts as a Derivative Database), you must offer that database under ODbL too. A plain filtered subset shipped inside the APK is fine as long as attribution is present and you'd hand over the extract on request. Share-alike does NOT infect the app code — only the database.

**GLOBAL COUNT (taginfo API, `data_until` 2026-08-23T00:59:05Z):**
```
all:       172,651
nodes:     172,608
ways:           40
relations:       3
```
Source: https://taginfo.openstreetmap.org/api/4/tag/stats?key=emergency&value=defibrillator

**US COUNT (Geofabrik regional taginfo, `data_until` 2026-08-22T20:21:20Z):**
```
all:    2,846
nodes:  2,845
ways:       1
```
Source: https://taginfo.geofabrik.de/north-america:us/api/4/tag/stats?key=emergency&value=defibrillator

**=> The entire United States holds ~1.65% of the world's OSM defibrillators (2,846 of 172,651).** OSM AED mapping is a European/Japanese phenomenon. US coverage is effectively unusable as a primary "find the nearest AED" feature.

### 1.2 Working Overpass QL query (verified live this session)

Florida bounding box (24.396, -87.634, 31.001, -79.974):

```overpassql
[out:json][timeout:60];
nwr["emergency"="defibrillator"](24.396,-87.634,31.001,-79.974);
out count;
```

Result, live at 2026-08-23T17:30:46Z (Overpass API 0.7.62.11):
```json
{"type":"count","tags":{"nodes":"463","ways":"0","relations":"0","total":"463"}}
```

**ALL OF FLORIDA = 463 AEDs in OSM.** Florida has ~23M residents. This is roughly 1 mapped AED per 50,000 people.

For real use (returning objects with tags, no geometry bloat):
```overpassql
[out:json][timeout:60];
nwr["emergency"="defibrillator"]({{south}},{{west}},{{north}},{{east}});
out tags center;
```
Around-a-point form (radius in metres) for a "nearest AED" query:
```overpassql
[out:json][timeout:25];
nwr["emergency"="defibrillator"](around:1500,28.5384,-81.3789);
out tags center;
```
GET endpoint: `https://overpass-api.de/api/interpreter?data=<urlencoded QL>`. Verified working with a plain HTTPS GET, no API key, no auth.

### 1.3 Florida coverage quality — the data is a single cluster, not a state

Orlando-area bbox (28.3,-81.6 → 28.7,-81.2), `out tags`, live this session: **378 nodes**.

378 of Florida's 463 AEDs (**~82%**) are inside one 0.4° × 0.4° box centred on Orlando/Walt Disney World. Tag pattern of the first 20 elements was near-identical — `access=customers` + `check_date` + `website` — which is the signature of one bulk import/organised mapping effort (Disney parks + resorts), not organic statewide coverage.

Tag completeness across those 378 Orlando nodes:

| Tag | Count / 378 |
|---|---|
| `access` | 219 |
| `indoor` | 112 |
| `level` | 13 |
| `defibrillator:location` | **8** |
| `opening_hours` | **0** |
| `description` | **0** |
| `operator` | **0** |
| `phone` | **0** |

**The field a bystander actually needs — `defibrillator:location` ("inside the main lobby, left of the reception desk") — is present on 8 of 378 records (2.1%).** A raw lat/lon with no location text is close to useless to a panicking bystander inside a large building.

---

## 2. LOCATION RELAY  *(in progress)*

### 2.1 FCC wireless E911 location accuracy rules
- Z-axis metric: CMRS providers deploying z-axis tech must deliver vertical location within **±3 metres** of the handset for **80% of wireless E911 calls** from z-axis-capable devices, reported as **Height Above Ellipsoid (HAE)**, plus floor level where available.
- Nationwide carriers: z-axis nationwide by **April 3, 2025**. Non-nationwide carriers: 2026 for smaller markets. All CMRS providers must supply z-axis **or** dispatchable location throughout their service area by **April 3, 2026**.
- Source: FCC docs + Federal Register 2025-06865 (to be fetched/verified).

*(sections 2.2–2.5, 3, 4 pending)*
