# protocol-bleeding — Severe bleeding control + shock

Research for Mayday (Congressional App Challenge 2026). Tier A protocol: SEVERE BLEEDING.
Status: IN PROGRESS. Last updated during session 2026-08-23.

## Sources fetched this session

| # | Source | URL | Fetched |
|---|--------|-----|---------|
| S1 | ACS Bleeding Control Basic v1.0 — INSTRUCTOR PRESENTATION NOTES (full slide text) | https://grandroundsinurology.com/wp-content/uploads/2018/09/Bleeding-Control-Basic-Instructor-Presentation-Notes-PPT-Coburn-final.pdf | yes (pdftotext) |
| S2 | ACS STOP THE BLEED Course **Version 2.0** deck (© 2019 ACS) | https://www.uc.edu/content/dam/refresh/cont-ed-62/olli/spring22/class-handouts/stop%20the%20bleed.pdf | yes (pdftotext) |
| S3 | ACS STOP THE BLEED Course **Version 3** deck (current, released Clinical Congress 2024) | https://www.stopthebleed.org/media/12yhd4ze/acs-stop-the-bleed-course-version-3.pdf | yes (pdftotext — image-only, headings only) |
| S4 | ANZCOR Guideline 9.1.1 — First Aid for Management of Bleeding | https://www.anzcor.org/home/first-aid/guideline-9-1-1-first-aid-for-management-of-bleeding | yes |
| S5 | stopthebleed.org training page | https://www.stopthebleed.org/training/ | yes (thin) |

BLOCKED (403, do not retry): ahajournals.org/doi/10.1161/CIR.0000000000001281 ; cpr.heart.org ; redcross.org.

---

## 1. The ABC of bleeding control (ACS, canonical)

**A — Alert.** "Call 9-1-1 yourself, OR Tell someone to call 9-1-1." Know your location. Follow
instructions provided by the 911 operator. (S1, S2)

**B — Bleeding.** Find where the victim is bleeding from. "Open or remove the clothing so you can
see the wound." Note: "There may be multiple places the victim is bleeding" and "Clothing may also
hide life-threatening bleeding." (S1, S2)

**C — Compress.** Pressure → packing → tourniquet. (S1, S2)

Personal safety precedes all of it: "YOUR safety is YOUR first priority… If you are injured, you
cannot help others." (S2)

## 2. Recognizing LIFE-THREATENING bleeding (verbatim 7-item list, S1)

> - Blood that is spurting out of the wound
> - Blood that won't stop coming out of the wound
> - Blood that is pooling on the ground
> - Clothing that is soaked with blood
> - Bandages that are soaked with blood
> - Loss of all or part of an arm or leg
> - Bleeding in a victim who is now confused or unconscious

**Build note:** this is a 7-item yes/no checklist a bystander can answer by LOOKING. It is the
Tier-A entry gate for the bleeding protocol — no judgment, no estimation of mL lost.

## 3. Three wound categories → three different actions (S1)

1. **Arm and leg wounds** — "Most frequent cause of preventable death from injury."
   Controlled by "direct pressure or a tourniquet."
2. **Torso junctional wounds** — "Neck, shoulder, and groin." Controlled by "direct pressure and
   wound packing." (Tourniquet cannot be applied here.)
3. **Chest and abdominal injuries** — "Front, back, or side… Usually cause internal bleeding."
   > "This bleeding CANNOT be stopped outside the hospital"
   > "These victims need rapid transport to a trauma center"
   > "Identify these patients to EMS providers when they arrive"

**Build note (critical):** the app must branch on WOUND LOCATION first (limb / junctional /
torso-core), because the correct action is different and mutually exclusive in each branch. For
torso-core the only correct action is pressure + get EMS fast — the app must NOT promise the
bystander they can stop it.

## 4. Direct pressure — exact technique (S1, verbatim)

> - Use your hand or fingers — Use two hands, if at all possible
> - Effective most of the time for external bleeding — Direct pressure can stop even major arterial bleeding
> - Bleeding control requires very firm, continuous pressure until relieved by medical responders
> - To be effective, apply pressure with the victim on a firm surface to provide support
> - Don't release pressure to check the wound
> - Apply continuous pressure with both hands directly on top of the bleeding wound
> - Push down as hard as you can
> - Hold pressure until relieved by medical responders
> - Use any clean cloth (for example, a shirt) to cover the wound
> - If the wound is large and deep, try to "stuff" the cloth down into the wound

v2.0 deck adds: "Use just enough gauze or cloth to cover injury. If pressure stops the bleeding,
keep pressure on wound until help arrives." (S2)

**HOW LONG:** ACS gives NO fixed number of minutes. The instruction is *until relieved by medical
responders* — i.e. duration = time to EMS arrival, which is exactly Mayday's 4–8 minute window.

**Build note:** do NOT implement a countdown that ends pressure (e.g. "hold 10 minutes then
check"). Implement a HOLD-UNTIL-EMS loop with encouragement/reassurance ticks. Explicitly voice
"do not lift up to look."

## 5. Wound packing — exact steps (S1, verbatim, 4 slides)

> **(1 of 4)** Open clothing around the wound. If possible, remove excess pooled blood from the
> wound while preserving any clots already formed in the wound. Locate the source of the most
> active bleeding.
> **(2 of 4)** Pack the wound — Hemostatic dressing, OR Gauze roll, OR Clean cloth. Stuff right
> into the wound and directly onto the bleeding site.
> **(4 of 4)** Quickly apply and hold pressure directly on the packed wound until relieved by
> medical responders. If initial packing and direct pressure fail to stop the bleeding, pack a
> second gauze on top of the first and reapply pressure using increased force.

v2.0 deck: "For large wounds, superficial pressure is not effective. If bleeding is from a deep
wound, pack gauze tightly into the wound until it stops the bleeding; hold pressure until help
arrives." (S2)

**WHERE PACKING IS INDICATED:** deep wounds; junctional sites where a tourniquet cannot go —
"Neck, shoulder, and groin" per S1; the ACS algorithm branch is labelled "Neck, shoulder, groin".
Some ACS/derived material also lists armpit (axilla) — v2.0 deck lists the region set as
"Neck, armpits, and groin". (S2)

**REGIONS NOT PACKED:** The ACS algorithm routes chest/abdomen ("Body") to *neither* packing nor
tourniquet — those are internal-bleeding wounds that "CANNOT be stopped outside the hospital."
NB: the ACS lay course does NOT phrase this as "never pack the neck"; it explicitly INCLUDES the
neck as a packable junctional site. TO VERIFY against TCCC / Red Cross wording — some lay
material says do not pack the neck. FLAG AS OPEN QUESTION.

## 6. Tourniquet — exact parameters (S1, S2)

**Indication:** "Apply immediately if life-threatening bleeding is seen from an arm or a leg." (S1)
ACS algorithm: kit available → wound is arm/leg → tourniquet available immediately → apply it.
Tourniquet is FIRST-LINE for life-threatening limb bleeding when one is at hand, not a fallback
after a failed pressure attempt.

**Placement (S1 verbatim):**
> - The tourniquet can be placed right on top of clothing, if necessary
> - Place 2 to 3 inches above the bleeding wound (higher on the arm or leg)
> - BUT… DO NOT apply directly over the knee or elbow joints
>   - The bones of the joint will prevent the tourniquet from compressing the artery, so you won't stop the bleeding
> - DO NOT apply directly over a pocket that contains bulky items
>   - Anything in a pocket that is underneath a tourniquet will interfere with the function of the tourniquet
> - Tighten the tourniquet until bleeding stops

v2.0 deck condensed 4-line version (S2 verbatim):
> - Apply 2 to 3 inches above wound
> - Do not place over the elbow or knee
> - Tighten tourniquet until bleeding stops
> - Do NOT remove the tourniquet

"above" here means **closer to the torso / proximal**, clarified by "(higher on the arm or leg)".

**Endpoint of tightening = bleeding STOPS.** Not a pressure number, not a number of windlass turns.

**Second tourniquet (S1 verbatim):**
> If the bleeding is not stopped with one tourniquet and it is as tight as you can get it, place a
> second one, if available, just above the first and tighten as before

**Time recording (S1, C.A.T. step 8 of 8, verbatim):**
> Step 8. Note the time the tourniquet was applied. If you have a marker, you can write it directly
> on the tourniquet. The patient is now ready for transport.

**Never loosen / never remove — verbatim from the ACS "Common Mistakes" slide (S1):**
> - Periodically loosening the tourniquet to allow blood flow to the injured extremity
>   - Causes unacceptable additional blood loss--DO NOT LOOSEN
> - Removing a tourniquet
>   - Only a paramedic or physician should loosen or remove it

Full "Common Mistakes" list (S1 verbatim):
> - Not using a tourniquet or waiting too long to apply it when there is life-threatening bleeding
> - Not making the tourniquet tight enough to stop the bleeding
> - Not using a second tourniquet, if needed
> - Periodically loosening the tourniquet…
> - Removing a tourniquet…

**Pain (S1 verbatim) — the single biggest bystander-abandonment risk:**
> - Tourniquets HURT when applied effectively (they HURT A LOT) — Explain this fact to the victim
> - Pain DOES NOT mean you put on the tourniquet incorrectly
> - Pain DOES NOT mean you should take the tourniquet off
> - Once paramedics arrive, they will treat the pain with medication

**Limb-loss / duration (S1 verbatim):**
> - No amputations have been caused by a tourniquet when left in place for fewer than two hours
>   - BUT… it is best to get the patient to a trauma center as soon as possible so the bleeding can be completely controlled and the tourniquet removed
> - Better to risk damage to the arm or leg than to have a victim bleed to death

**Training tourniquets (S1 verbatim):**
> Training (practice) tourniquets should NOT be used during a real patient incident — Repetitive
> use during training exercises may cause the tourniquet to fail

**Named commercial devices.** S1 (2017-era): C.A.T. (Combat Application Tourniquet — "the
military's preferred tourniquet"), SOFTT (SOF Tactical Tourniquet, 1st + 2nd gen), EMT (Emergency
and Military Tourniquet). "Military research has shown these three tourniquets work the best to
control bleeding." S2 (v2.0, 2019) expands the pictured set: SOFT-TT, CAT, SAM-XT, RCMAT, TX3, TMT.

**C.A.T. 8-step sequence (S1 verbatim, abbreviated):**
1. Insert the wounded extremity (arm or leg) through the C.A.T.
2. Pull the self-adhering band tight, and securely fasten it back on itself.
3. Adhere the band around the extremity. Do not adhere the band past the clip.
4. Twist the windlass rod until the bleeding has stopped.
5. Lock the windlass rod in place in the windlass clip. Bleeding is now controlled.
6. Adhere the remaining self-adhering band over the rod, through the windlass clip…
7. Secure the rod and the band with the windlass strap. Grasp the strap, pull it tight…
8. Note the time the tourniquet was applied…

**Build note:** the app's tourniquet branch must (a) ask "do you have a real tourniquet" as a hard
yes/no gate, (b) speak placement as "2 to 3 inches closer to the body than the wound, never on the
knee or elbow", (c) hold on the tighten step until the user confirms bleeding stopped, (d) capture
a timestamp automatically at the moment of confirmed application into the on-device incident log
and read it out to EMS, (e) hard-refuse every "should I loosen it?" turn, (f) pre-empt the pain
question before the user asks it.

## 7. Improvised tourniquets — ACS position (S1, S2, verbatim)

> Improvised (homemade) tourniquets are much less effective than commercially available tourniquets
> such as the C.A.T. and are difficult to make and apply without extensive practice

ACS lists "Improvised tourniquets?" as an FAQ topic in both v1.0 and v2.0 but does NOT publish a
step-by-step improvised technique in the lay deck. Course guidance is to fall back to direct
pressure / packing rather than to improvise.

**Build note:** if user says no tourniquet available, Mayday must route to
**pressure + packing held continuously**, NOT to "make one from a belt." A belt in particular
cannot be wound tight enough — TO VERIFY with a peer-reviewed failure-rate figure.

## 8. Hemostatic dressings (S1)

> Hemostatic dressings are materials that help cause blood to clot.
> Examples: QuikClot (civilian) / Combat Gauze (military), Celox, Celox Rapid, Chitoflex, Chitogauze

ACS algorithm wording for the junctional branch: "Use hemostatic (bleeding control) gauze
(preferred) or any gauze or clean cloth. Apply continuous, direct pressure."

**Build note:** "preferred, not required" — the app must never stall waiting for a hemostatic
dressing. Any clean cloth is an acceptable substitute and the script must say so immediately.

## 9. Children (S1, S2 verbatim)

> - In all but the extremely young child, the same tourniquet used for adults can be used in children.
> - For the infant or very small child (tourniquet too big), direct pressure on the wound as
>   described previously will work in virtually all cases.
> - For large, deep wounds, wound packing can be performed in children just as in adults using the
>   same technique as described previously.

**Build note:** no separate pediatric bleeding state machine needed. One age branch only: infant /
very small child → skip the tourniquet node, go to pressure.

## 10. ANZCOR Guideline 9.1.1 (S4) — corroborating + elevation

- "Firm pressure on or around the wound is the most effective way to stop most bleeding." [Good Practice Statement]
- Tourniquet: "We suggest to use an arterial tourniquet for life-threatening limb bleeding that is
  not controlled by direct wound pressure." [CoSTR 2020, **weak recommendation, very low certainty
  of evidence**]
- Placement "above the bleeding point" or per manufacturer instructions, avoiding joints and wounds.
- "tightened until the bleeding stops"; applied "tightly, even if this causes local discomfort."
- "The time of tourniquet application must be noted and communicated to emergency/paramedic personnel."
- "should not be removed until the person receives specialist care."
- Hemostatic dressings: when "the first aid provider is trained in their use."
- **ELEVATION — withdrawn:** "There is no evidence that elevating a bleeding part will help control
  bleeding and there is the potential to cause more pain or injury."
- Shock: "Lie the person down" and "Treat shock."

NOTE a real difference from ACS: ANZCOR sequences the tourniquet AFTER failed direct pressure;
ACS sequences the tourniquet FIRST for life-threatening limb bleeding when one is immediately
available. See contradictions section.

---

## TODO / still to fetch
- [ ] 2024 AHA + American Red Cross Guidelines for First Aid (Circulation, Nov 2024,
      DOI 10.1161/CIR.0000000000001281) — exact COR/LOE for bleeding + shock. ahajournals 403; try
      PubMed abstract, Red Cross press release, ERC/ILCOR CoSTR mirrors.
- [ ] Trendelenburg / leg elevation for shock — is it withdrawn in current US guidelines?
- [ ] Hypovolemic shock signs list from a primary source; hypothermia prevention ("keep warm"),
      nothing by mouth.
- [ ] Whether the neck may be packed — resolve ACS-includes-neck vs lay-advice-excludes-neck.
- [ ] Improvised tourniquet documented failure rate (peer-reviewed).
- [ ] Junctional tourniquets / junctional bleeding devices.
- [ ] "Pressure points" — withdrawn?
