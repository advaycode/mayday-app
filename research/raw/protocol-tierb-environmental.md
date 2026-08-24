# protocol-tierb-environmental — raw research notes

Key: `protocol-tierb-environmental`
Topic: Tier B — burns, heat, cold, poisoning, asthma, eye splash, fractures, electrical injury
Started 2026-08-23. STATUS: IN PROGRESS — being rewritten as sources are read.

## FETCH BLOCKLIST (do not retry)
- `ahajournals.org` — 403 on article, epub. AHA 2024 First Aid Guidelines full text NOT directly fetchable.
- `cpr.heart.org` — 403 (incl. the Highlights PDF).
- `redcross.org` — 403.
- `pmc.ncbi.nlm.nih.gov` — reCAPTCHA wall.
- `pubmed.ncbi.nlm.nih.gov` — cookie wall.
- `annemergmed.com` — 403.
Workaround that works: PDFs saved by WebFetch to the tool-results dir can be text-extracted locally with `pypdf`.

---

## 1. BURNS — thermal

### CONTRADICTION: 5 minutes (ABA) vs 20 minutes (everyone else)
This is the single most important conflict in this whole topic and Mayday must resolve it explicitly.

**American Burn Association (ameriburn.org/patients/burn-first-aid)** — fetched 2026-08-23:
> "Cool the burn with running water for at least 5 minutes (not cold or icy water)."
> "Remove jewelry, rings, watches, and any clothing near the burn."
> "Cover loosely with sterile gauze or a clean cloth."
> Do NOT: "Apply ice—it can worsen the damage"; "Use butter, oils, or ointments—they trap heat"; "Break blisters—they protect the skin as it heals"
> Seek care if "the pain persists or a fever develops" or for "burns larger than a hand."

**ANZCOR Guideline 9.1.3 (anzcor.org)** — fetched 2026-08-23:
- "at least 20 minutes" cool running water
- start "as soon as practicable" but still effective "up to 3 hours after the burn"
- cool water, NOT ice / ice water (further tissue damage)
- any clean cool liquid if no water; commercial burn gels only AFTER the 20 min of water
- Do NOT apply: ice, ice water, lotions/ointments/creams/powders; do NOT peel off adherent clothing; no cling wrap or hydrogel on chemical burns; no cling film on the face
- Remove "non-adherent clothing" and "rings, watches, jewellery" from affected areas, esp. items "soaked with hot liquids"
- Cover: "loose non-stick dressing, preferably clean material e.g. plastic cling film" — not on face, do not wrap circumferentially around limbs

**AAFP, Outpatient Burn Care (aafp.org/pubs/afp/issues/2020/0415/p463.html)** — peer-reviewed, fetched 2026-08-23:
> "The burn surface should be cooled with running tap water (at 46.4°F [8°C] to 77°F [25°C]) for at least 20 minutes" within three hours of injury.
- reduces burn depth, improves healing, decreases grafting need
- ice avoided — vasoconstriction
- wet dressings are NOT effective for cooling

**AHA/ARC 2024 First Aid Guidelines** (via secondary summaries only — full text 403):
- "running cool (not ice-cold) water over burns for 10 to 20 minutes", avoid butter/ointments
- full-thickness burn, or partial-thickness larger than the person's palm, or involving face/hands/feet/genitals → prompt evaluation by a health care professional
- smoke inhalation evidence (facial burns, difficulty breathing, singed nasal hairs, soot around nose/mouth) → activate EMS
- MARKED MEDIUM CONFIDENCE — could not fetch the primary.

**Evidence for 20 min** (Annals of Emergency Medicine, blocked; via search snippet + AAP Grand Rounds title): children with ≥20 min cool running water had odds of skin grafting reduced by >40%; 20 min within 3 h significantly improves burn-related outcomes.

RESOLUTION FOR MAYDAY: 20 minutes is the number with outcome evidence behind it and is the international consensus (ANZCOR/ABA-Australia/British Burn Assoc/European Burns Assoc/AAFP). ABA's US-facing consumer page says "at least 5 minutes" — a floor, not a ceiling, and it does not contradict continuing. Script "at least 20 minutes" and cite AAFP + ANZCOR; note ABA's 5-minute minimum in the citation panel.

### Burn size — rule of palm
AAFP: "The palm equals approximately 0.5% TBSA. The entire palm including fingers is approximately 1% TBSA."
→ The colloquial "palm = 1%" means palm PLUS fingers. Mayday must say "your whole hand, palm and fingers, is about 1%."

### ABA Burn Center Referral Criteria — VERBATIM, 10 items
Source: ABA/ABLS PDF via rherman.pharmacy.uiowa.edu/lib/PdfDocs/Burns/ABA-BurnCenterReferralCriteria.pdf (text-extracted locally). Excerpted from *Guidelines for the Operation of Burn Centers* (pp. 79–86), *Resources for Optimal Care of the Injured Patient 2006*, ACS Committee on Trauma.

> 1. Partial thickness burns greater than 10% total body surface area (TBSA).
> 2. Burns that involve the face, hands, feet, genitalia, perineum, or major joints.
> 3. Third degree burns in any age group.
> 4. Electrical burns, including lightning injury.
> 5. Chemical burns.
> 6. Inhalation injury.
> 7. Burn injury in patients with preexisting medical disorders that could complicate management, prolong recovery, or affect mortality.
> 8. Any patient with burns and concomitant trauma (such as fractures) in which the burn injury poses the greatest risk of morbidity or mortality. In such cases, if the trauma poses the greater immediate risk, the patient may be initially stabilized in a trauma center before being transferred to a burn unit...
> 9. Burned children in hospitals without qualified personnel or equipment for the care of children.
> 10. Burn injury in patients who will require special social, emotional, or rehabilitative intervention.

Same PDF, severity determination:
> First Degree (Partial Thickness): Superficial, red, sometimes painful.
> Second Degree (Partial Thickness): Skin may be red, blistered, swollen. Very painful.
> Third Degree (Full Thickness): Whitish, charred or translucent, no pin prick sensation in burned area.

NOTE: the ABA card labels first degree as "Partial Thickness" — that is what the official card says, and it is at odds with standard teaching (1st degree = superficial, not partial thickness). Do not copy this labeling into Mayday.

ANZCOR referral criteria add: burns >10% TBSA; special areas (face, hands, feet, genitalia); full-thickness >5% TBSA; inhalation injury; circumferential burns; very young/old; **all infants and children require medical assessment**.

### Chemical burns
ANZCOR 9.1.3: "IMMEDIATELY flush the area directly with running water for at least 20 min" to dilute; never neutralize with another chemical; no cling wrap or hydrogel on chemical burns; contact poisons hotline.

### Electrical burns
ANZCOR 9.1.3: isolate power; maintain **10 m** distance from high-voltage sources; cool with water; CPR if needed.

---
(sections 2–8 pending: eye splash, heat, cold, poisoning, asthma, fractures, electrical — being added as fetched)
