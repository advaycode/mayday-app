# Medical sources

Generated 2026-10-18 by `tools/medical_sources.py` from `mobile/src/protocols/corpus/`. Do not edit by hand.

**78 protocol steps. 64 are quoted word for word from a retrieved source. 14 are awaiting review** (marked ⚠ below): the content is long-standing first-aid teaching, but the exact 2025 sentence could not be downloaded (ahajournals.org, cpr.heart.org and redcross.org block automated access). A CPR-certified reviewer should open each source in a browser, confirm or correct the step, and set `verified: true` with the quote.

## For the reviewer

1. Read each protocol's table top to bottom: it is the order a rescuer hears it.
2. For every ⚠ row, find the sentence in the named source and either paste it into the step's `quote` or change the step.
3. Check the flagged decisions at the end of this file.
4. Sign and date the bottom of this file.

## Sources

| ID | Source | How we read it |
|---|---|---|
| `aha2025-highlights` | Highlights of the 2025 American Heart Association Guidelines for CPR and ECC. American Heart Association (Heart & Stroke Foundation of Canada co-branded edition). https://cpr.heartandstroke.ca/resource/GuidelinesHighlightsEN2025 | Downloaded copy in `research/` |
| `aha2025-part7` | Part 7: Adult Basic Life Support. 2025 AHA Guidelines for CPR and ECC. American Heart Association. https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support | Read through a search index (publisher blocks downloads) |
| `aha2025-peds` | Part 8 (Pediatric Basic Life Support). 2025 AHA and AAP Guidelines for CPR and ECC. American Heart Association and American Academy of Pediatrics. https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines | **Not retrieved** |
| `aha-arc-2024-fa` | Highlights of the 2024 American Heart Association and American Red Cross Guidelines for First Aid. American Heart Association and American Red Cross. https://cpr.heart.org/en/resuscitation-science/first-aid-guidelines | Downloaded copy in `research/` |
| `arc-burn-cooling` | Scientific Advisory Council Advisory: Burn Cooling. American Red Cross Scientific Advisory Council. https://www.redcross.org/content/dam/redcross/docs/Burn%20Cooling%E2%80%94ADVISORY.pdf | Read through a search index (publisher blocks downloads) |
| `acs-stop-the-bleed` | Bleeding Control Basic, instructor presentation notes (STOP THE BLEED). American College of Surgeons. https://www.stopthebleed.org/training/ | Fetched directly |
| `medlineplus-burns` | Burns. MedlinePlus, U.S. National Library of Medicine (NIH). https://medlineplus.gov/ency/article/000030.htm | Fetched directly |
| `medlineplus-unconscious` | Unconsciousness: first aid. MedlinePlus, U.S. National Library of Medicine (NIH). https://medlineplus.gov/ency/article/000022.htm | Fetched directly |
| `medlineplus-stroke` | Stroke. MedlinePlus, U.S. National Library of Medicine (NIH). https://medlineplus.gov/ency/article/000726.htm | Fetched directly |
| `ohsu-narcan` | How to use Narcan nasal spray. OHSU Hospital (Oregon Health & Science University). https://www.ohsu.edu/sites/default/files/2024-04/How-to-use-Narcan-nasal-spray.pdf | Fetched directly |

## CPR (adult) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `responsive` | Do they respond?<br><small>Tap both shoulders. Shout.</small> | Tap both shoulders hard and shout.<br>Do they respond? | `aha2025-highlights` | "Recognition and Emergency Activation" |
| `breathing` | Breathing normally?<br><small>Gasping is not breathing.</small> | Watch their chest.<br>Gasping is not breathing.<br>Are they breathing normally? | `aha2025-highlights` | "The No-No-Go framework is reiterated as an effective method for recognizing OHCA." |
| `send_aed` | Send for an AED<br><small>Point at one person.</small> | Point at one person.<br>Say: you, bring the A E D. | `aha2025-highlights` | "A simplified visual aid for lay rescuers emphasizes early activation of the EMS system and obtaining an automated external defibrillator in addition to initiation of chest compressions." |
| `position` | Flat on the floor<br><small>On their back. Kneel at the chest.</small> | Lay them flat on their back, on the floor.<br>Kneel beside their chest. | `aha2025-highlights` | "For adult cardiac arrest, rescuers should perform chest compressions with the patient on a firm surface and with the patient's torso at approximately the level of the rescuer's knees." |
| ⚠ `hands` | Hands on the chest<br><small>Center of the chest. Arms straight.</small> | Heel of one hand on the center of the chest.<br>Other hand on top. Arms straight. | `aha2025-part7` | _Not yet quoted. Confirm the 2025 Part 7 hand-position sentence (heel of one hand, center of the chest / lower half of the sternum) in a browser._ |
| `breaths_q` | Trained in rescue breaths?<br><small>If not, hands only works.</small> | Are you trained and willing to give breaths?<br>If not, hands only. | `aha2025-highlights` | "It is reasonable for lay rescuers and health care professionals to perform CPR with cycles of 30 compressions followed by 2 breaths before placement of an advanced airway. [...] Telecommunicators [...] are to guide lay rescuers to use Hands-Only CPR for adults." |
| `compressions` | Push hard and fast<br><small>About 2 inches. Let it come back up.</small> | Push hard and fast. Follow the beat.<br>Back to compressions. Now.<br>Push hard. Push fast.<br>Has anyone found an A E D?<br>Center of the chest.<br>Let the chest come all the way up.<br>Good. Keep going.<br>Two breaths.<br>Tilt the head. Lift the chin.<br>Pinch the nose. Breathe.<br>Breathe.<br>Push about two inches deep. | `aha2025-part7` | "During manual CPR, rescuers should perform chest compressions to a depth of at least 2 inches, or 5 cm, for an average adult while avoiding excessive chest compression depths (greater than 2.4 inches, or 6cm). [...] rescuers perform chest compressions at a rate of 100 to 120/min." |
| `aed_on` | Turn the AED on<br><small>Then do what it says.</small> | Keep pushing while someone opens it.<br>Turn it on. Follow its voice. | `aha2025-highlights` | "Early high-quality CPR and prompt defibrillation are the most important interventions associated with improved outcomes in adult cardiac arrest." |
| `aed_pads` | Pads on bare skin<br><small>A bra can be moved aside.</small> | Bare the chest. Pads where the pictures show.<br>You can move a bra aside. No need to remove it. | `aha2025-highlights` | "When placing pads for defibrillation for an adult in cardiac arrest, it might be reasonable to adjust the position of a bra instead of removing it." |
| ⚠ `aed_clear` | Hands off<br><small>While it analyzes or shocks.</small> | Hands off while it analyzes.<br>If it says shock, everyone stand clear. | `aha2025-part7` | _Not yet quoted. Confirm the 2025 Part 7 AED sequence (follow prompts, no one touching during analysis/shock, resume compressions immediately) in a browser._ |
| ⚠ `vomit` | Roll them to the side<br><small>Let it drain. Then back.</small> | Roll them onto their side to drain it.<br>Wipe the mouth. Roll back. Keep pushing. | `medlineplus-unconscious` | _MedlinePlus says to roll the whole body to the side if the person vomits; the fetch tool paraphrased it, so the exact sentence still needs copying from the page._ |
| `responsive_end` | Stay with them<br><small>Watch their breathing.</small> | They're responding. Don't start compressions.<br>Stay with them. Watch their breathing. | `medlineplus-unconscious` | "Check the person's airway, breathing, and pulse frequently. If necessary, begin CPR." |

## CPR (child) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `responsive` | Do they respond?<br><small>Tap the shoulders. Shout.</small> | Tap their shoulders and shout.<br>Do they respond? | `aha2025-highlights` | "Recognition and Emergency Activation" |
| `breathing` | Breathing normally?<br><small>Gasping is not breathing.</small> | Watch their chest.<br>Gasping is not breathing.<br>Are they breathing normally? | `aha2025-highlights` | "The No-No-Go framework is reiterated as an effective method for recognizing OHCA." |
| `send_aed` | Send for an AED<br><small>Point at one person.</small> | Point at one person.<br>Say: you, bring the A E D. | `aha2025-highlights` | "A simplified visual aid for lay rescuers emphasizes early activation of the EMS system and obtaining an automated external defibrillator in addition to initiation of chest compressions." |
| ⚠ `position` | Flat on a firm surface<br><small>On their back.</small> | Lay them flat on their back, on something firm. | `aha2025-peds` | _Firm-surface positioning is in the 2025 adult text; confirm the pediatric wording._ |
| ⚠ `hands` | One or two hands<br><small>Center of the chest.</small> | One or two hands on the center of the chest.<br>Use what it takes to push deep enough. | `aha2025-peds` | _Child compressions with one or two hands: long-standing AHA teaching, not yet confirmed against the 2025 text._ |
| `breaths_q` | Can you give breaths?<br><small>Children need breaths if you can.</small> | Children need breaths if you can.<br>Can you give rescue breaths? | `aha2025-highlights` | "they are to guide lay rescuers to use Hands-Only CPR for adults and conventional CPR, including breaths, for children." |
| ⚠ `compressions` | Push hard and fast<br><small>A third of the chest depth.</small> | Push hard and fast. Follow the beat.<br>Back to compressions. Now.<br>Push hard. Push fast.<br>Has anyone found an A E D?<br>Center of the chest.<br>Let the chest come all the way up.<br>Good. Keep going.<br>Two breaths.<br>Tilt the head. Lift the chin.<br>Pinch the nose. Breathe.<br>Breathe.<br>Push about one third of the chest depth. | `aha2025-peds` | _Rate 100 to 120 per minute is confirmed for adults (aha2025-part7). Child depth (about one third of the chest, about 2 inches) and the 30:2 lay ratio for children still need confirming against the 2025 pediatric text._ |
| ⚠ `aed_on` | Turn the AED on<br><small>Child pads if it has them.</small> | Keep pushing while someone opens it.<br>Turn it on. Follow its voice. | `aha2025-peds` | _Pediatric pads or attenuator preference; confirm the 2025 pediatric wording._ |
| ⚠ `aed_pads` | Pads on bare skin<br><small>Where the pictures show.</small> | Bare the chest. Pads where the pictures show. | `aha2025-peds` | _Pediatric pad placement; confirm the 2025 pediatric wording._ |
| ⚠ `aed_clear` | Hands off<br><small>While it analyzes or shocks.</small> | Hands off while it analyzes.<br>If it says shock, everyone stand clear. | `aha2025-part7` | _Standard AED sequence; the 2025 sentence has not been read first-hand._ |
| ⚠ `vomit` | Roll them to the side<br><small>Let it drain. Then back.</small> | Roll them onto their side to drain it.<br>Wipe the mouth. Roll back. Keep pushing. | `medlineplus-unconscious` | _MedlinePlus says to roll the whole body to the side if the person vomits; copy the exact sentence from the page._ |
| `responsive_end` | Stay with them<br><small>Watch their breathing.</small> | They're responding. Don't start compressions.<br>Stay with them. Watch their breathing. | `medlineplus-unconscious` | "Check the person's airway, breathing, and pulse frequently. If necessary, begin CPR." |

## Infant CPR (infant) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| ⚠ `responsive` | Does the baby respond?<br><small>Tap the foot. Call out.</small> | Tap the bottom of the foot. Call out loud.<br>Does the baby respond? | `aha2025-peds` | _Infant responsiveness check (tap the foot): long-standing teaching, confirm against the 2025 pediatric text._ |
| `breathing` | Breathing normally?<br><small>Gasping is not breathing.</small> | Watch the chest and belly.<br>Gasping is not breathing.<br>Is the baby breathing normally? | `aha2025-highlights` | "The No-No-Go framework is reiterated as an effective method for recognizing OHCA." |
| ⚠ `position` | On a firm, flat surface<br><small>A table or the floor.</small> | Lay the baby on its back on something firm. | `aha2025-peds` | _Confirm the 2025 pediatric wording for surface._ |
| `hands` | Two thumbs or one hand<br><small>Thumbs on the center of the chest.</small> | Wrap your hands around the chest.<br>Two thumbs on the center of the chest.<br>Or use the heel of one hand. | `aha2025-highlights` | "For infants, rescuers should compress the sternum with the heel of 1 hand or using the 2 thumb-encircling hands technique. If the rescuer cannot physically encircle the chest, it is recommended to compress the chest with the heel of 1 hand." |
| `breaths_q` | Can you give breaths?<br><small>Babies need breaths if you can.</small> | Babies need breaths if you can.<br>Can you give rescue breaths? | `aha2025-highlights` | "they are to guide lay rescuers to use Hands-Only CPR for adults and conventional CPR, including breaths, for children." |
| ⚠ `compressions` | Push fast<br><small>A third of the chest depth.</small> | Push fast. Follow the beat.<br>Back to compressions. Now.<br>Push fast.<br>Has anyone found an A E D?<br>Let the chest come all the way up.<br>Two small breaths.<br>Cover the mouth and nose. Gentle puff.<br>Puff.<br>Push about one third of the chest depth. | `aha2025-peds` | _Infant depth (one third of the chest, about 1.5 inches), mouth-and-nose breaths and the lay ratio need confirming against the 2025 pediatric text. The technique itself (thumbs or heel of one hand, never two fingers) is confirmed in the hands step._ |
| ⚠ `aed_on` | Turn the AED on<br><small>Infant or child pads if it has them.</small> | Keep pushing while someone opens it.<br>Turn it on. Follow its voice. | `aha2025-peds` | _Infant AED use and pad choice; confirm the 2025 pediatric wording._ |
| `responsive_end` | Stay with the baby<br><small>Watch the breathing.</small> | Stay with the baby. Watch the breathing.<br>If it stops, tell me. | `medlineplus-unconscious` | "Check the person's airway, breathing, and pulse frequently. If necessary, begin CPR." |

## Choking (Adult and child) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `severe` | Can they cough or speak?<br><small>A strong cough means let them cough.</small> | Can they cough hard, or speak? | `aha2025-highlights` | "Check for signs of severe FBAO: Weak or absence of cough / Unable to speak / Change in colour (cyanosis) / Altered mental status / Apnea" |
| `back_blows` | 5 back blows<br><small>Lean them forward. Between the shoulder blades.</small> | Lean them forward.<br>Five hard blows between the shoulder blades. | `aha2025-highlights` | "Start repeated cycles of 5 back blows (slaps), followed by 5 abdominal thrusts. Repeat until object is expelled or the adult becomes unresponsive." |
| `abd_thrusts` | 5 belly thrusts<br><small>Fist above the belly button. In and up.</small> | Stand behind them. Fist above the belly button.<br>Grab your fist. Pull in and up, five times. | `aha2025-highlights` | "For children with severe foreign-body airway obstruction (FBAO), repeated cycles of 5 back blows alternated with 5 abdominal thrusts should be performed until the object is expelled or the child becomes unresponsive." |
| `chest_thrusts` | 5 chest thrusts<br><small>Instead of belly thrusts.</small> | Use chest thrusts instead.<br>Five, then back blows again. | `aha2025-highlights` | "For patients in the late stages of pregnancy, or when the rescuer is unable to encircle the patient's abdomen, 5 chest thrusts should be used instead." |
| `cough_end` | Let them cough<br><small>Stay close.</small> | Let them keep coughing.<br>If the cough gets weak, tell me. | `aha2025-highlights` | "Encourage cough. Continue to check for signs of severe FBAO." |
| `out_end` | Stay with them<br><small>Watch their breathing.</small> | Good. Stay with them.<br>Watch their breathing until help arrives. | `aha2025-highlights` | "If object is expelled, continue to monitor until advanced care arrives." |

## Infant choking (infant) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `severe` | Can the baby cry?<br><small>Or cough?</small> | Can the baby cry, or cough? | `aha2025-highlights` | "Check for signs of severe FBAO: Weak or absence of cough / Unable to speak / Change in colour (cyanosis) / Altered mental status / Apnea" |
| `back_blows` | 5 back blows<br><small>Face down on your forearm. Head low.</small> | Baby face down along your forearm.<br>Hold the jaw. Head lower than the chest.<br>Five firm blows between the shoulder blades. | `aha2025-highlights` | "For infants with severe FBAO, repeated cycles of 5 back blows alternating with 5 chest thrusts should be performed until the object is expelled or the infant becomes unresponsive."<br>_The count and order are confirmed. The forearm, jaw and head-low positioning is standard infant teaching that should also be confirmed against the 2025 pediatric text._ |
| `chest_thrusts` | 5 chest thrusts<br><small>Face up. Heel of one hand.</small> | Turn the baby face up, head low.<br>Heel of one hand, center of the chest.<br>Five firm chest thrusts. | `aha2025-highlights` | "Abdominal thrusts are not recommended for infants, given the potential to cause abdominal organ injury. The heel-of-1-hand technique for chest thrusts is now recommended for infants with severe FBAO." |
| `cough_end` | Let the baby cough<br><small>Stay close.</small> | Let the baby keep coughing.<br>If it gets weak or silent, tell me. | `aha2025-highlights` | "Encourage cough. Continue to check for signs of severe FBAO." |
| `out_end` | Stay with the baby<br><small>Watch the breathing.</small> | Good. Stay with the baby.<br>Watch the breathing until help arrives. | `aha2025-highlights` | "If object is expelled, continue to monitor until advanced care arrives." |

## Severe bleeding (any age) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `where` | Where is it bleeding?<br><small>Open clothing to see the wound.</small> | Open the clothing. Find where the blood comes from.<br>Is it an arm or leg? | `acs-stop-the-bleed` | "Find where the victim is bleeding from. Open or remove the clothing so you can see the wound." |
| `tq_q` | Have a tourniquet?<br><small>A real one, from a kit.</small> | Do you have a real tourniquet? | `acs-stop-the-bleed` | "Apply immediately if life-threatening bleeding is seen from an arm or a leg." |
| `tourniquet` | High and tight<br><small>2 to 3 inches above. Not on a joint.</small> | Two to three inches above the wound.<br>Not on the knee or elbow.<br>Tighten until the bleeding stops. It will hurt. | `acs-stop-the-bleed` | "Place 2 to 3 inches above the bleeding wound (higher on the arm or leg). BUT... DO NOT apply directly over the knee or elbow joints. [...] Tighten the tourniquet until bleeding stops" |
| `tq_second` | Add a second one<br><small>Just above the first.</small> | Put a second tourniquet just above the first.<br>Tighten it the same way. | `acs-stop-the-bleed` | "If the bleeding is not stopped with one tourniquet and it is as tight as you can get it, place a second one, if available, just above the first and tighten as before" |
| `tq_time` | Never loosen it<br><small>Time noted for paramedics.</small> | I've noted the time.<br>Never loosen it. Only paramedics take it off. | `acs-stop-the-bleed` | "Note the time the tourniquet was applied. [...] Periodically loosening the tourniquet to allow blood flow to the injured extremity. Causes unacceptable additional blood loss--DO NOT LOOSEN" |
| `pressure` | Press hard<br><small>Both hands, straight down. Don't let go.</small> | Cover the wound with cloth.<br>Push down with both hands, as hard as you can.<br>Don't lift to look.<br>Keep pressing. Don't let up.<br>Don't lift to check. Keep the pressure on. | `acs-stop-the-bleed` | "Apply continuous pressure with both hands directly on top of the bleeding wound. Push down as hard as you can. Hold pressure until relieved by medical responders. Don't release pressure to check the wound." |
| `pack` | Pack the wound<br><small>Stuff cloth deep in. Then press.</small> | Stuff gauze or clean cloth deep into the wound.<br>Pack it tight. Then press hard with both hands. | `acs-stop-the-bleed` | "Pack the wound: Hemostatic dressing, OR Gauze roll, OR Clean cloth. Stuff right into the wound and directly onto the bleeding site. [...] Quickly apply and hold pressure directly on the packed wound until relieved by medical responders." |
| `pack_hold` | Press on the packing<br><small>Hard, both hands, until help arrives.</small> | Now press down hard on the packing.<br>Hold it until paramedics take over.<br>Keep pressing. Don't let up. | `acs-stop-the-bleed` | "Quickly apply and hold pressure directly on the packed wound until relieved by medical responders." |
| `pack_more` | Pack more on top<br><small>Then press harder.</small> | Pack more cloth on top of the first.<br>Then press even harder. | `acs-stop-the-bleed` | "If initial packing and direct pressure fail to stop the bleeding, pack a second gauze on top of the first and reapply pressure using increased force." |
| `torso` | Press and wait<br><small>Tell 911: chest or belly wound.</small> | Press on any wound you can see.<br>Tell 911 the wound is in the chest or belly.<br>Keep pressing. Help is coming. | `acs-stop-the-bleed` | "This bleeding CANNOT be stopped outside the hospital. These victims need rapid transport to a trauma center. Identify these patients to EMS providers when they arrive." |

## Stroke check (adult) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `face` | Ask them to smile<br><small>Does one side droop?</small> | Ask them to smile.<br>Does one side of the face droop? | `medlineplus-stroke` | "FACE: Ask the person to smile. Check if one side of the face droops." |
| `arms` | Raise both arms<br><small>Does one drift down?</small> | Ask them to raise both arms.<br>Does one drift down? | `medlineplus-stroke` | "ARMS: Ask the person to raise both arms. See if one arm drifts downward." |
| `speech` | Repeat a short sentence<br><small>Slurred or wrong?</small> | Ask them to repeat a simple sentence.<br>Is it slurred or wrong? | `medlineplus-stroke` | "SPEECH: Ask the person to repeat a simple sentence. Check if words are slurred and if the sentence is repeated correctly." |
| `time` | Call 911 now<br><small>Tell them when this started.</small> | This could be a stroke. Minutes matter.<br>Tell 911 when they last seemed normal. | `aha-arc-2024-fa` | "If stroke is suspected, the EMS system should be activated immediately." |
| `wait` | Stay with them<br><small>Don't drive them. Wait for EMS.</small> | Stay with them. Don't drive them yourself.<br>If they stop responding, tell me. | `medlineplus-stroke` | "TIME: If a person shows any of these symptoms, time is essential. Call 911 or the local emergency number."<br>_"Don't drive them yourself" is our routing advice (EMS can pre-alert a stroke center); it is not a guideline sentence. Reviewer: confirm you are comfortable with it._ |
| `no_signs` | No FAST signs<br><small>Still call 911 if something is sudden or wrong.</small> | No clear stroke signs right now.<br>If anything is sudden or wrong, call 911. | `aha-arc-2024-fa` | "The use of a stroke recognition scale, such as the Face, Arms, Speech, Time (FAST) or Cincinnati Prehospital Stroke Scale, is recommended to aid in the recognition of acute stroke in adults." |

## Overdose (any age) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `responsive` | Can you wake them?<br><small>Shout their name. Shake them.</small> | Shout their name. Shake their shoulders.<br>Can you wake them? | `ohsu-narcan` | "Check for signs of an opioid overdose. Slow, weak or no breathing / Falling asleep or can't wake up / Gurgling sounds in throat / Very small pupils / Cold, clammy skin / Discolored skin (especially lips and fingernails)" |
| `breathing` | Breathing normally?<br><small>Slow, gurgling, or gasping is not normal.</small> | Watch their chest.<br>Is the breathing normal? | `aha-arc-2024-fa` | "A first aid provider who encounters a person with suspected opioid overdose who is unresponsive and not breathing or not breathing normally should activate the emergency response system, provide high-quality CPR (compressions plus ventilation), and administer naloxone." |
| `naloxone_q` | Have Narcan?<br><small>Naloxone nasal spray.</small> | Do you have Narcan? Naloxone spray? | `aha2025-highlights` | "An opioid antagonist (e.g., naloxone) should be given to people with respiratory arrest from suspected opioid overdose. Trained rescuers, lay rescuers, and members of the general public can all administer naloxone." |
| `spray` | Spray in one nostril<br><small>Head back. Push the plunger firmly.</small> | Lay them on their back. Tilt the head back.<br>Tip in one nostril. Push the plunger firmly.<br>Don't test spray it. | `ohsu-narcan` | "Lay the person on their back. Tilt their head back. [...] Do NOT test spray the Narcan. They need the full dose. Put the tip of the nozzle in 1 nostril. Push the plunger firmly to give the entire dose." |
| `after_spray` | Breathing normally now? | Is the breathing normal now? | `aha-arc-2024-fa` | "A first aid provider who encounters a person with suspected opioid overdose who is unresponsive and not breathing or not breathing normally should activate the emergency response system, provide high-quality CPR (compressions plus ventilation), and administer naloxone." |
| `roll_watch` | Roll them on their side<br><small>Watch. Second dose if no change.</small> | Roll them onto their side. Top knee bent.<br>Watch for two to three minutes.<br>Still not waking up? Give a second dose.<br>New spray. Other nostril. | `ohsu-narcan` | "Roll the person on their side. Bend their top knee to keep them from rolling on their stomach. [...] Watch to see if they wake up or start breathing normally. If they don't within 2-3 minutes, give a 2nd dose in the other nostril." |
| `second_dose` | Second dose<br><small>New spray, other nostril.</small> | Use a new spray, in the other nostril. | `ohsu-narcan` | "You will need a new nasal spray for the 2nd dose." |
| `no_naloxone` | Breathing normally? | No naloxone. Is the breathing normal? | `aha-arc-2024-fa` | "A first aid provider who encounters a person with suspected opioid overdose who is unresponsive and not breathing or not breathing normally should activate the emergency response system, provide high-quality CPR (compressions plus ventilation), and administer naloxone." |
| `awake_end` | Stay with them<br><small>It can wear off. Wait for EMS.</small> | Stay with them until help arrives.<br>If they get sleepy again, tell me. | `ohsu-narcan` | "If they still don't respond and you have more Narcan, you can keep giving new doses every 2-3 minutes in a different nostril each time. Do this until they wake up or emergency help arrives."<br>_"It can wear off" is a common teaching point not stated in this source; reviewer to confirm or remove._ |

## Burns (any age) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `stop` | Away from the heat<br><small>If clothes are on fire: stop, drop, roll.</small> | Get them away from the heat.<br>If clothes are burning: stop, drop, and roll. | `medlineplus-burns` | "Wrap the person in thick material; such as a wool or cotton coat, rug, or blanket."<br>_MedlinePlus pairs this with stop, drop and roll for burning clothing._ |
| `severity` | Is it a bad burn?<br><small>Bigger than their palm. Face, hands, feet, groin. Or smoke breathed in.</small> | Is it bigger than their palm?<br>Or on the face, hands, feet, or groin? | `aha-arc-2024-fa` | "A person with a full-thickness burn or with a partial-thickness burn that is larger than the person's palm or involves the person's face, hands, feet, or genitals, should promptly seek evaluation by a health care professional." |
| `major` | This needs 911<br><small>Smoke, chemicals, or electricity too.</small> | This burn needs emergency care.<br>Make sure 911 is called. | `aha-arc-2024-fa` | "For a person with evidence of smoke inhalation injury, such as facial burns, difficulty breathing, singed nasal hairs, or soot around the nose or mouth, EMS should be activated." |
| `jewelry` | Rings and tight things off<br><small>Before it swells.</small> | Take off rings, watches, and belts near the burn.<br>Do it before it swells. | `aha-arc-2024-fa` | "A person with thermal burns should promptly remove all jewelry, belts, and other tight items from burned areas." |
| `cool` | Cool running water<br><small>At least 10 minutes. Never ice.</small> | Run cool water over the burn.<br>At least ten minutes. Never ice.<br>Ten minutes. Twenty is even better, if you can. | `arc-burn-cooling` | "Begin immediate cooling of thermal burns, preferably with cool running water applied to the burn for a minimum of 10 minutes, ideally 20 minutes. [...] Do not use ice to cool a burn, including an ice pack or bag, due to a risk of worsening the injury."<br>_MedlinePlus advises against putting a SEVERE burn in cold water (shock risk), while the Red Cross advisory recommends cool running water for all thermal burns and warns against cooling beyond 40 minutes. We follow the Red Cross (running water, not immersion) and flag this for the medical reviewer._ |
| `cover` | Cover it loosely<br><small>Clean cloth. Don't pop blisters.</small> | Cover it loosely with a clean cloth.<br>Don't pop blisters. No butter or ice. | `aha-arc-2024-fa` | "After cooling, while awaiting evaluation by a health care professional, it may be reasonable to loosely cover a burn that has intact skin or an intact blister with a clean cloth or nonadherent dry dressing." |

## Recovery position (any age) · v2025.3.0

| Step | Screen | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `spine` | Could the neck be hurt?<br><small>A fall, a crash, a dive.</small> | Could they have hurt their neck or back? | `medlineplus-unconscious` | "If you suspect a spinal injury, leave the person where you found them (as long as breathing continues)." |
| `roll` | Roll onto their side<br><small>Top leg bent. Head tilted back.</small> | Roll them toward you, onto their side.<br>Bend the top leg. Tilt the head back. | `medlineplus-unconscious` | "carefully roll the person toward you onto their side. Bend the top leg so both hip and knee are at right angles. Gently tilt their head back to keep the airway open." |
| `stay_put` | Don't move them<br><small>Watch their breathing.</small> | Don't move them.<br>Watch their breathing. If it stops, tell me. | `medlineplus-unconscious` | "If you suspect a spinal injury, leave the person where you found them (as long as breathing continues)." |
| `watch` | Watch their breathing<br><small>If it stops, start CPR.</small> | Stay with them. Watch their breathing.<br>If it stops or turns to gasping, tell me. | `medlineplus-unconscious` | "Check the person's airway, breathing, and pulse frequently. If necessary, begin CPR." |

## Answers to open questions

Spoken when someone asks a question mid-emergency (`mobile/src/voice/answers.json`).

| Card | Asked as | Spoken | Source | Quote or note |
|---|---|---|---|---|
| `move_patient` (any) | should i move him? | Only move them if it's not safe where they are.<br>For CPR, flat on a firm floor is best. | `aha2025-highlights` | "Verify scene safety. [...] For adult cardiac arrest, rescuers should perform chest compressions with the patient on a firm surface and with the patient's torso at approximately the level of the rescuer's knees." |
| `scene_safety` (any) | is it safe? | Check for traffic, fire, wires, or water first.<br>You can't help if you get hurt. | `aha2025-highlights` | "Verify scene safety." |
| `alone` (any) | i am alone? | Call 911 yourself, on speaker.<br>Put the phone down beside you and keep going. | `aha2025-highlights` | "Activate emergency response system." |
| `cpr_depth_rate_adult` (cpr_adult) | how deep do i push? | About two inches deep. Let it come all the way up.<br>Follow the beat. It's set to the right speed. | `aha2025-part7` | "During manual CPR, rescuers should perform chest compressions to a depth of at least 2 inches, or 5 cm, for an average adult while avoiding excessive chest compression depths (greater than 2.4 inches, or 6cm). [...] rescuers perform chest compressions at a rate of 100 to 120/min." |
| ⚠ `cpr_depth_rate_young` (cpr_child, cpr_infant) | how deep do i push? | About a third of the depth of the chest.<br>Follow the beat. It's set to the right speed. | `aha2025-peds` | _Pediatric depth not yet confirmed against the 2025 pediatric text._ |
| ⚠ `cpr_hands` (cpr_adult) | where do i put my hands? | Heel of one hand on the center of the chest.<br>Other hand on top. Arms straight. | `aha2025-part7` | _Hand position: confirm the 2025 Part 7 sentence._ |
| `cpr_surface` (cpr) | they are on a bed? | Get them flat on the floor. Not a bed. | `aha2025-highlights` | "For adult cardiac arrest, rescuers should perform chest compressions with the patient on a firm surface and with the patient's torso at approximately the level of the rescuer's knees." |
| `cpr_gasping` (cpr) | they are gasping? | Gasping is not breathing.<br>Keep pushing. | `aha2025-highlights` | "The No-No-Go framework is reiterated as an effective method for recognizing OHCA." |
| `cpr_breaths_adult` (cpr_adult) | do i do mouth to mouth? | If you're not trained, hands only is fine.<br>Just keep pushing. | `aha2025-highlights` | "they are to guide lay rescuers to use Hands-Only CPR for adults and conventional CPR, including breaths, for children." |
| ⚠ `cpr_stop` (cpr) | when do i stop? | Keep going until they breathe normally or paramedics take over.<br>Swap with someone every two minutes if you can. | `aha2025-part7` | _Continue until EMS takes over or signs of life; switch compressors about every 2 minutes. Confirm the 2025 Part 7 wording._ |
| `aed_use` (cpr) | how do i use the aed? | Turn it on. It talks you through every step.<br>Don't stop pushing to go look for one. | `aha2025-highlights` | "Early high-quality CPR and prompt defibrillation are the most important interventions associated with improved outcomes in adult cardiac arrest." |
| `aed_bra` (cpr) | she is wearing a bra? | You can move a bra aside.<br>No need to remove it. | `aha2025-highlights` | "When placing pads for defibrillation for an adult in cardiac arrest, it might be reasonable to adjust the position of a bra instead of removing it." |
| `choking_can_cough` (choking) | they can still cough? | If they can cough hard, let them cough.<br>Stay close and watch. | `aha2025-highlights` | "Encourage cough. Continue to check for signs of severe FBAO." |
| `choking_pregnant` (choking) | she is pregnant? | Use chest thrusts instead of belly thrusts. | `aha2025-highlights` | "For patients in the late stages of pregnancy, or when the rescuer is unable to encircle the patient's abdomen, 5 chest thrusts should be used instead." |
| `choking_after` (choking) | it came out are they okay? | Stay with them until help arrives.<br>Keep watching their breathing. | `aha2025-highlights` | "If object is expelled, continue to monitor until advanced care arrives." |
| `tourniquet_loosen` (bleeding) | can i take the tourniquet off? | Never loosen it. Only paramedics take it off.<br>It hurts because it's working. | `acs-stop-the-bleed` | "Tourniquets HURT when applied effectively (they HURT A LOT) [...] Pain DOES NOT mean you should take the tourniquet off" |
| `pressure_check` (bleeding) | should i check the wound? | Don't lift to check. Keep pressing until help arrives. | `acs-stop-the-bleed` | "Don't release pressure to check the wound. [...] Hold pressure until relieved by medical responders." |
| `burn_ice` (burns) | should i put ice on it? | No ice, butter, or creams on it.<br>Cool running water only. | `medlineplus-burns` | "Do not apply oil, butter, ice, medicines, cream, oil spray, or any household remedy to a severe burn." |
| `burn_how_long` (burns) | how long do i run water? | At least ten minutes. Twenty is better. | `arc-burn-cooling` | "Begin immediate cooling of thermal burns, preferably with cool running water applied to the burn for a minimum of 10 minutes, ideally 20 minutes." |
| `burn_blisters` (burns) | should i pop the blister? | Don't pop blisters.<br>Cover it loosely with a clean cloth. | `aha-arc-2024-fa` | "it may be reasonable to loosely cover a burn that has intact skin or an intact blister with a clean cloth or nonadherent dry dressing." |
| `stroke_time` (stroke) | why does time matter? | Note when they last seemed normal.<br>Tell 911. Treatment depends on that time. | `medlineplus-stroke` | "TIME: If a person shows any of these symptoms, time is essential. Call 911 or the local emergency number." |
| `naloxone_second` (opioid_overdose) | when do i give another dose? | No change in two to three minutes?<br>New spray, other nostril. | `ohsu-narcan` | "If they don't within 2-3 minutes, give a 2nd dose in the other nostril. You will need a new nasal spray for the 2nd dose." |
| `naloxone_harm` (opioid_overdose) | what if it is not opioids? | Narcan won't hurt them if it isn't opioids.<br>Use it anyway. | `ohsu-narcan` | "If you think someone is having an overdose, use Narcan right away -- even if you don't know what drugs they took. Narcan only works for opioids, but there is no harm if they took a different drug." |

## App lines (not medical instructions)

Spoken outside protocol steps: confirmations, questions and status. None gives a medical instruction.

- `intake`: Tell me what's happening.
- `calling`: Calling nine one one.
- `speaker`: Put the call on speaker.
- `callCancelled`: Okay. Not calling.
- `someoneCalling`: Good. Keep them on the line.
- `micLost`: I can't hear you during the call. Tap the screen instead.
- `notUnderstood`: Tap what you see.
- `groundFallback`: Keep doing compressions. Tell the dispatcher that.
- `emsHere`: Paramedics are here. Show them this screen.
- `askAge`: Adult, child, or baby?
- `askWhat`: Not breathing, choking, or bleeding?
- `practiceStart`: Practice. Push on a firm cushion, in time with me.
- `practiceEnd`: Good practice.
- `offline`: No signal. I still have everything I need.
- `scanLooking`: Looking.
- `scanUnsure`: I can't tell from the photo. Tell me what you see.
- `groundFallbackGeneral`: I'm not sure. Tell the dispatcher that.
- `answerFrom`: Here's what the guidelines say.
- `voiceBack`: I can hear you again.
- `cpr_adult`: Not breathing. We'll do this together.
- `cpr_child`: A child, not breathing. We'll do this together.
- `cpr_infant`: A baby, not breathing. We'll do this together.
- `cpr_check`: Collapsed. Let's check them first.
- `choking`: Choking. I'll walk you through it.
- `choking_infant`: A baby choking. I'll walk you through it.
- `bleeding`: Bleeding. Let's stop it.
- `burns`: A burn. Let's cool it.
- `stroke`: Could be a stroke. Quick check.
- `opioid_overdose`: Possible overdose. Stay with me.
- `recovery_position`: Breathing but not awake. Let's protect the airway.

## Decisions the reviewer should confirm

1. **FAST instead of BE-FAST.** The 2024 AHA/Red Cross First Aid guidelines recommend FAST or the Cincinnati Prehospital Stroke Scale for lay recognition. The app uses FAST.
2. **Burn cooling for severe burns.** MedlinePlus advises against putting a severe burn in cold water; the Red Cross advisory recommends cool running water for all thermal burns (10 minutes minimum, ideally 20, never past 40). The app follows the Red Cross and says "cool running water", never "cold" or "soak".
3. **Adult CPR defaults to hands-only** if the rescuer does not answer the breaths question within 6 seconds.
4. **Opioid overdose with abnormal breathing** goes to naloxone first (6-second question), then CPR. The 2024 guideline says both; it does not set an order. Confirm.

## Sign-off

Reviewed by: ______________________  Certification: ______________________  Date: __________
