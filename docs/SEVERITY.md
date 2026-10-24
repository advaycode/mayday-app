# Severity grading

Code: `mobile/src/triage/severity.ts` (the grade), `mobile/src/triage/ui.tsx` (badge and card). Tests: `mobile/__tests__/severity.test.ts`.

For the five emergencies where how bad it is changes what a bystander should do (choking, bleeding, burns, stroke, overdose), Mayday grades severity on a three-level scale and, for burns, the depth:

| Level | Name | Means |
|---|---|---|
| 1 | Mild | Care here, watch for change |
| 2 | Serious | Needs medical care |
| 3 | Critical | 911 now |

On screen: a badge on the step picture's corner ("2nd degree · Serious", "Level 3 · Critical"; "Severity ?" before any evidence). Tap it for the card: the scale with this level lit, what to do, "What do you see?" (three taps per emergency, matched like speech), and why (each piece of evidence and where it came from). Mayday says it out loud when the grade rises ("Sounds like a second degree burn.", "This is serious. Make sure 911 is called."), before its next line so a step is never cut off. The desktop mirror's Engine panel shows every grade with its signals.

## How it decides

Rules, not a model: instant, offline, and every decision can be shown. Evidence comes from:
- answers on the steps (read from the incident log, which keeps them after Back) and facts the voice router filled in;
- what the rescuer says ("it's blistering", "it's spurting", "his lips are blue"); only speech the echo guard is sure is the rescuer counts;
- taps on "What do you see?";
- the photo check (Claude vision through the proxy, when a key is set), which already sets a burn's `burn_severity`.

The level is the strongest evidence. With none yet, the badge shows a starting guess (level 2) marked as a guess.

## Rules that cannot be broken (tested)
- It only moves toward more care. Once evidence raised the grade it never goes down in that emergency ("actually it's just red" after "charred" stays critical).
- No level ever says 911 is not needed. Stroke and overdose are never graded mild: both always need 911.
- A guess is never presented as a finding.

## Criteria

| Emergency | Critical (3) | Serious (2) | Mild (1) | Source |
|---|---|---|---|---|
| Burns | Third degree (white, waxy, leathery, charred, painless); on the face, hands, feet, groin, a joint or the airway; larger than the palm; chemical, electrical or smoke; "Is it a bad burn? Yes" | Second degree (blisters, wet, raw) | First degree (red, dry, no blisters) and small | `medlineplus-burns`, `aha-arc-2024-fa` (the burns protocol's own "bad burn" question uses the same features) |
| Bleeding | Spurting, pooling, soaking through, won't stop, amputation, stab or gunshot; neck, armpit, groin, chest or belly; a tourniquet was needed | Steady bleeding from an arm or leg | A small cut, scrape or oozing | `acs-stop-the-bleed` |
| Choking | Can't breathe, cough or speak; turning blue; a weak or silent cough, high-pitched noise | (starting guess) | Coughing hard, can talk | `aha2025-highlights` ("encourage cough... check for signs of severe FBAO") |
| Stroke | Any FAST sign (face drooping, arm drifting, speech slurred or wrong), or stops responding | No FAST sign yet (still 911 if anything is off) | never | `medlineplus-stroke` |
| Overdose | Not breathing normally, blue lips, gurgling or snoring, hard to wake, a second Narcan dose | Awake and breathing (Narcan wears off: still 911) | never | `ohsu-narcan`, `aha2025-highlights` |

**Awaiting review.** These thresholds follow the cited first-aid sources but have not been checked by a CPR or first-aid instructor; add them to the review in `docs/MEDICAL_SOURCES.md`.
