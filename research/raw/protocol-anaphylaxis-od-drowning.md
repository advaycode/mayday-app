# protocol-anaphylaxis-od-drowning — RAW RESEARCH NOTES
Key: `protocol-anaphylaxis-od-drowning`
Topic: Anaphylaxis + epinephrine auto-injector; opioid overdose + naloxone; drowning
Status: IN PROGRESS (started 2026-08-23)

---

## 1. ANAPHYLAXIS — EPINEPHRINE AUTO-INJECTOR

### 1.1 EpiPen / EpiPen Jr — FDA label (DailyMed, Viatris/Mylan)
Source fetched: https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=7560c201-9246-487c-a13b-6295db04274a&type=display

**HOLD TIME = 3 SECONDS. CONFIRMED.** (The old "10 seconds" figure is obsolete; FDA-approved
labeling now says 3 seconds.)

Verbatim / near-verbatim from the label's Instructions for Use:
- "Pull off the blue safety top" / "Place the orange needle end against the outer thigh"
- "Push down firmly and hold in place for 3 seconds"
- Mnemonic used in patient materials: **"Blue to the sky, orange to the thigh."**
- Injection site: **middle of the OUTER thigh** only. Intramuscular or subcutaneous.
- **Can be given through clothing** — label states the injection "can be given through clothes."
- Dose strengths: **EpiPen 0.3 mg for patients ≥30 kg (66 lb+)**; **EpiPen Jr 0.15 mg for
  patients 15–30 kg (33–66 lb)**.
- After use: "Get emergency medical help right away."
- Repeat dosing: "You can use a second EpiPen or EpiPen Jr auto-injector if symptoms continue
  or come back." BUT — "more than two sequential doses of epinephrine should only be
  administered under direct medical supervision."

BUILD NOTE: our CPR/anaphylaxis state machine must say **"hold 3 seconds"** and must NOT
say 10. Must never tell the user to remove clothing first (wastes seconds). Must never let
the app pick 0.3 vs 0.15 — the device the bystander is holding is already dose-fixed; the app
should say "use the device you have."

### 1.2 Positioning — supine, legs elevated
Source (search-surfaced, WAO Anaphylaxis Guidance 2020):
https://www.worldallergyorganizationjournal.org/article/S1939-4551(20)30375-6/fulltext
- Most patients supine during anaphylaxis. Exception: respiratory distress → sitting may
  optimize respiratory effort. Pregnant → semi-recumbent, LEFT side. Unconscious → recovery
  position.
- Rationale for supine: prevents sudden drop in BP/HR ("empty ventricle syndrome" — sudden
  upright posture can cause fatal cardiac standstill).
STATUS: NEED PRIMARY FETCH of WAO 2020 text. TODO.

### 1.3 Second dose timing
- Search-surfaced consensus: second dose if no response within **5–15 minutes**, or symptoms
  persist / rapidly progress, or resolve then return (biphasic).
- 7%–18% of anaphylaxis cases require >1 dose (ILCOR scoping review, Circulation 2020).
STATUS: NEED PRIMARY FETCH. TODO.

### 1.4 neffy (nasal epinephrine)
STATUS: TODO.

---

## 2. OPIOID OVERDOSE — NALOXONE

### 2.1 2024 AHA / American Red Cross Guidelines for First Aid
Citation: Circulation, published 14 Nov 2024. PMID **39540278**.
DOI 10.1161/CIR.0000000000001281.
NOTE: ahajournals.org, cpr.heart.org, professional.heart.org and redcross.org ALL return
HTTP 403 to automated fetch. Findings below are from search-result snippets = MEDIUM
confidence until a fetchable mirror is found.

- First comprehensive update of first aid treatment recommendations **since 2010**.
- New / substantially revised topics: **opioid overdose, bleeding control, open chest wounds,
  spinal motion restriction, hypothermia, frostbite, presyncope, anaphylaxis, snakebite,
  oxygen administration, pulse oximetry.**
- Opioid overdose recommendation (snippet): "A first aid provider who encounters a person with
  suspected opioid overdose who is unresponsive and not breathing normally should activate the
  emergency response system, provide high-quality cardiopulmonary resuscitation (CPR;
  compressions plus ventilation), and administer naloxone."
  → i.e. **compressions PLUS ventilation**, not hands-only, when opioid overdose suspected.

### 2.2 Narcan 4 mg nasal spray
STATUS: TODO — need FDA label.

### 2.3 Good Samaritan overdose laws (incl. Florida)
STATUS: TODO.

---

## 3. DROWNING

### 3.1 ILCOR BLS CoSTR — compression-only vs conventional CPR in drowning
Source fetched: https://costr.ilcor.org/document/chest-compression-cpr-versus-conventional-cpr-in-drowning-bls-tfsr

Treatment recommendations (verbatim fragments):
- Adults, lay responders: "bystanders commence CPR with compressions rather than ventilations";
  "bystanders who are trained, able, and willing to give rescue breaths and chest compressions
  do so".
- Children: "bystanders provide CPR with ventilation for infants and children younger than 18
  years"; if unable to give rescue breaths, "should at least provide chest compressions".
- HCP/lifeguards: provide ventilations alongside compressions when trained and capable.

Evidence figures (both studies VERY LOW certainty):
- Fukada et al — favorable neuro outcome (CPC 1–2): 7.5% conventional vs 6.6% compression-only
  (RR 1.15, p=0.42). Survival to discharge 10.5% vs 8.6% (p=0.18).
- Tobin et al — favorable neuro outcome 24.7% conventional vs 16.2% compression-only (p=0.19).
  Survival to discharge **29.7% conventional vs 18.1% compression-only (p=0.046)**.
- Subgroup: children aged 5–15 benefit from conventional CPR (aOR 2.68, p=0.03).

IMPORTANT NUANCE FOR BUILD: ILCOR does NOT tell an untrained bystander to do rescue-breaths-
FIRST. It says start with compressions unless trained/able/willing to also ventilate. So our
drowning protocol must branch on "are you willing/able to give rescue breaths" rather than
hard-requiring them.

- ILCOR general statement: "The apparent superiority of conventional CPR which includes
  ventilation has biological plausibility because cardiac arrest caused by drowning is
  primarily due to hypoxia."

### 3.2 2025 AHA Guidelines Part 7 Adult BLS
https://www.ahajournals.org/doi/10.1161/CIR.0000000000001369 — 403, need mirror. TODO.

### 3.3 Reach-throw-row-go, spinal precautions, abdominal thrusts, delayed deterioration
STATUS: TODO.

---

## FETCH BLOCKLIST (403 / failed this session — do not retry)
- ahajournals.org (all DOIs)
- cpr.heart.org
- professional.heart.org
- newsroom.heart.org (fetched but content-thin)
- redcross.org press release
- guidelines.redcross.org (SSL handshake failure)
- resuscitationjournal.com
- accessdata.fda.gov/.../019430s120lbl.pdf (404)
