# Progress

Read this at the start of every session; update it at the end.

**Deadline:** 12:00 pm Eastern, Monday October 26 2026. **Our deadline:** submit by 9:00 am that morning.

## Status on Friday October 23

### Done today
- **The voice assistant, finished.** Tested with 11 things a panicking person says; 6 failed, all fixed:
  - "he's not breathing" right after "Gasping is not breathing. Is he breathing normally?" was thrown away as our own echo (every word was ours). The echo guard now looks at word order, against one stretch of up to three lines of our speech (`voice/echo.ts`): our line word for word is echo; our words rearranged is "suspect", which may only push toward more care (anything reassuring is stripped).
  - The listening screen showed "tell" (a fragment of our own "Tell me what's happening"): partials made only of our words are hidden.
  - "what's an AED?" repeated the step ("what" read as confusion): a question with a cited answer is now answered, then the step's question is asked again. New card `aed_what`.
  - "I'm scared, I don't know what to do": silence, or it opened the breathing check. Now "I'm right here with you." and the step again.
  - "what do I tell 911?", "where am I?", "call 911": new `voice/dispatchTalk.ts`. Reads the address and what happened, opens the 911 card; "I can't call. Call 911 on your phone." Nothing is ever dialed.
  - "my friend collapsed" → "Collapsed." Now "Your friend collapsed." (friend, roommate, neighbor, coworker, partner, teammate, coach, teacher; they until he or she is heard).
  - Unknown questions: "I don't know that one. Ask the 911 dispatcher."
- **Severity grading** for choking, bleeding, burns, stroke and overdose (`triage/`, `docs/SEVERITY.md`): level 1 Mild / 2 Serious / 3 Critical, and a burn's depth (1st, 2nd, 3rd degree). From the answers, what is said ("it's blistering", "it's spurting", "his lips are blue"), taps on "What do you see?", and the photo check. A badge on the step picture; tap for the card (scale, what to do, why). Spoken when it rises. Never goes down, never says 911 isn't needed, stroke and overdose never mild (tested). Engine panel has a Severity section.
- **Step screens re-spaced**: one full-width picture card that takes the height left over, then the instruction, then the answers, same gaps on every step (no more floating headline and empty bands). Photos are shown whole over a blurred copy of themselves. Sheets more opaque.
- **Breathe tab**: the breathing check as its own tab, liquid glass: a glass lens over a glowing orb with a glass bubble that moves with each breath (40× magnified), the head-to-foot and side angles live to 00.00°, breaths a minute, the wave. Simulated person on a computer.
- **Understanding accents and dialects** (later on the 23rd). The recognizer is the phone's own (Apple's or Google's) and cannot be retrained by us; what we control is what Mayday does with what it hears:
  - The recognizer's top 5 guesses are used, not only the first (`voice/understand.ts`): a runner-up wins only if it answers what is on screen and the best guess does not, and never if it reassures.
  - Dialect forms and common mishearings (`DIALECT` in `voice/router.ts`): ain't, -in', nah/naw/nae/aye/ja/mhm, yeah nah (no) and nah yeah (yes), Scots -nae, fillers (um, lah, innit), keeled over/blacked out/flaked out, gone blue, "not breeding", chalking, fentanol, OD'd.
  - Safety bug found by it and fixed: "he's just gasping", "he's gone blue", "yes he's gasping" and "he is breathing very strange" answered "Yes" at "Breathing normally?" (anything starting "he is" was a yes). Pronoun yeses must now be the whole reply, and an abnormal fact overrides a yes.
  - A fact answers the question on screen ("he's out cold" at "Do they respond?").
  - Scores (`__tests__/dialects*.test.ts`, `DIALECT_REPORT=1`): tuning set 24/45 → 45/45; held-out set written afterwards 14/20 → 16/20, then 17/20 after the post-hoc "breathing very strange" safety fix.
  - Never silent: clear speech with nothing to act on gets "Sorry, I didn't catch that." and the question again (at most every 9 s, never during CPR counting).
  - Quick answers: "no", "not breathing", "done" are acted on 450 ms after they settle, without waiting for the recognizer to close the sentence; "yes" always waits.
- **More useful AI**: quick sourced guidance from Talk to Mayday for emergencies with no protocol (seizure, allergic reaction, low blood sugar, heat stroke, chest pain; CDC and MedlinePlus, fetched 2026-10-23, awaiting review); answers are now also shown as a caption over the picture for 10 s.
- **Procedure animations** (`design/Motion.tsx`): compressions at 110/min, back blows, belly thrusts, direct pressure, cool water, Narcan spray, arm drift, tap and shout. Still with Reduce Motion.
- **Engine console hidden**: the desktop mirror no longer shows it; Ctrl+Shift+E (click outside the phone first) or `?engine` opens it. It was never part of the app or the iPhone build.
- **iPhone build** rebuilt (`python tools/build_iphone.py`, 30 MB) and crawled at `/mayday/`: every tab, every emergency, Talk; no console; service worker on; with the network cut, Home and CPR still work (only the street-address lookup fails, as expected). Not deployed (needs `gh auth login`).
- **Regions: Lagos, Nigeria** (`src/region/`), the first place where Mayday helps most. Map chip switches region (or Automatic from the phone's location). Lagos: 514 hospitals and health centres from OpenStreetMap (`tools/build_facilities_lagos.py`; only 2 marked with an emergency department, 15 public general/teaching hospitals, 93 health centres "not for emergencies", 404 others "emergency care not confirmed"), distances in km, no drive-time guess. A "why here" card with three sourced figures (DOIs checked on Europe PMC): 8.7% of Africans covered by any EMS (Mould-Millman 2017), 53% of Lagos road-crash calls unanswered and 17 min average response (Venkatraman 2020), bystander CPR doubles survival (Song 2018). The emergency number follows the region everywhere: Home "Call 112 first", the dock, the 911 card ("or 767 in Lagos State"), step text, and the voice (44 lines recorded with "one one two"). A region chosen away from the phone uses a labelled demo location there. Never dials (safety test extended to the figures' source links).
- **CAC rubric check**: `submission/RUBRIC_CHECK.md`. Script, YouTube text and AI disclosure updated (354 tests, Kokoro voice, Lagos beat, Engine panel shortcut).
- **New voice**: Kokoro-82M `af_heart` (warmer, much less robotic than Piper lessac), offline. `tools/voice_engine.py` is shared by `render_voice.py` (now parallel, `--jobs`) and `tts_server.py`; run both with `~/tools/kokoro_venv/Scripts/python`. Samples to compare in `voice-samples/`. `--engine piper` brings the old voice back.

## Status on Thursday October 22

### Done today (the sensors meet real data)
- **Heartbeat model fixed** (`docs/HEART_MODEL.md`). It scored 58% because of a fault in the PhysioNet CEBS database: b002-b020's signal files are copies of p002-p020 (same SHA-256 in PhysioNet's own checksum list) under the basal recordings' annotations. Records are now checked against R waves found in their own ECG; the 19 are dropped and the 20 fifty-minute music recordings added (18 hours, 76,945 beats). The gyroscope model now learns from real hearts too. On people it never saw: 96.4% of beats found, 96.6% precision (rules 95.2% / 94.7%). A first retrain heard heartbeats in pure noise (14-17%); with 40% beat-free training windows: 0% on simulated people with no heart, 2.4% with people walking nearby (rules 16-40%).
- **Breathing check on real breathing** (`docs/REAL_BREATHING.md`). CEBS respiration belts (20 people) played through the simulated phone. It called only 67% of healthy 10-second checks regular; real breaths' notches were counted as extra breaths. Ignoring wobbles under a quarter of the biggest swing: 85% regular, false "Start CPR" 33% → 15%. Gasping, none and very slow are still never called regular.
- **CPR pace from the accelerometer** (user's pick). `sensors/compressions.ts` + `cpr/pace.ts` + `cpr/usePaceSensor.ts`. During CPR (and in Practice, phone on the cushion) the phone feels the pushes; the hands-only coaching slot says "Faster. Push on every click.", "A little slower. Push on every click." or "Keep pushing. Don't stop." only after it has clearly felt compressions; "Your pace 108 · good" under the timer. Scored on five real resuscitations (CPRDAT, `docs/CPR_SENSOR.md`): felt 100% of compressions down to 1% of the chest's motion reaching the phone, rate within 5/min 90% of the time.
- **Hearing gasps** (user's pick). `sensors/sounds.ts` + `mic.ts`, browser only. Listens during the 10-second check; real non-gasp sounds (ESC-50, `docs/SOUND_CHECK.md`) showed a single loud breath, snore or sneeze sounds like a gasp (28-43%), so it only backs up a "not normal" the chest already gave: "I heard gasping. Gasping is not breathing."
- Engine panel: Compressions section, and what the microphone heard.
- **The voice assistant uses the sensors** (`voice/sensorTalk.ts`, `sensors/live.ts`). At "Breathing normally?": "check his breathing", "is she breathing?" or "I can't tell" opens the phone check (on iPhone Safari, which shares motion only from a tap: "Tap Check with the phone."; for a baby, no phone check: "If you're not sure, treat it as not breathing."); "what did the phone see?" repeats the result. During CPR: "how am I doing?", "am I too slow?" answers from the pace the phone feels ("Good pace. Keep going.", "Faster...", or "I can't feel your pushes from here. Follow the clicks."). Fixed lines chosen by rules from the readings; no model writes them, and none says someone is breathing normally. Tested end to end in the web build.
- **Safety bug fixed in the voice router.** Asking about breathing counted as "breathing normally": "is he breathing?" set breathing to normal (and on the intake screen chose the recovery position instead of CPR), and "how do I know if he is breathing" or "I can't tell if she's breathing" answered "Yes" at the breathing question. Questions and doubt now say nothing about breathing; "not sure ... he's not breathing" still counts as not breathing. Tested (`__tests__/sensorTalk.test.ts`).
- New voice lines rendered (pace and gasp lines). Tests: compressions, pace coach, sounds; real-data reports on request (`REAL_BREATH=1`, `CPR_REPORT=1`, `SOUND_REPORT=1`). Data in `data/` (git-ignored; scripts `tools/heart_ml/`, `tools/cpr_data.py`, `tools/sound_data.py`).

### Next
- **Test on yourself** (`research/sensor-breathing.md`, steps 1-8): the breathing check, Practice with the phone on the cushion (and on the floor beside it: how much motion reaches the phone is the number nobody has published), and a faked gasp.
- Tell PhysioNet about the CEBS duplicate files.

## Status on Wednesday October 21

### Done today
- **Breathing check with the phone** (user's idea: phone on the chest, top on the chest, bottom on the belly, read the tilt like the iPhone Level). "Check with the phone" at "Breathing normally?": place, level, 10 s, then "No breathing seen. Start CPR." or "Chest moving, N a minute. Normal breathing, or gasping?". It can only push toward CPR, never reassure (tested). Lab in Learn → Breathing sensor with the level magnified 40×, a 30 s trace, chest-belly sync and an experimental heartbeat (seismocardiography, after Landreani et al.). Engine panel has a Motion sensor section. Research: `research/sensor-breathing.md`. Code: `mobile/src/sensors/`.
- **Simulated physical testing**: a simulated person (`sensors/sim.ts`) with real-sized chest and belly motion, heartbeat, a rescuer's hand, footsteps and a phone-class accelerometer; thousands of runs across noise, sample rate, sensor offset and heartbeat strength (`docs/SENSOR_SIM.md`, `SENSOR_REPORT=1 npx jest sensors`). It caught six bugs before any person was involved. **Next: test on yourself** (plan at the end of `research/sensor-breathing.md`) and measure Safari's real sample rate.
- **Redesign for real use** (feedback: too wordy, no color, hard to navigate).
  - Home: one big **Talk to Mayday** button (the AI assistant: one tap, no hold) and a colored tile per emergency. "Call 911 first" in red.
  - Tabs have words: Help, Learn, Map, Me. The red phone button is gone (it looked like it dialed).
  - Every step: close, the emergency's chip (tap to switch), say-it-again; a progress bar; one picture card; one headline; big answers with the main one in the emergency's color; and a bottom bar under the thumb: **Back**, **Talk**, **911** (address and summary to read out; nothing is dialed).
  - Back: a new engine event that returns to the previous step and asks its question again (tested).
  - Listening is tap-to-talk; only things Mayday acted on are shown ("✓ no"), so room noise never appears.
  - One color per emergency (`tokens.tint`), every pair contrast-checked (5.7:1 and up).
- **Pictures in full color.** A second Commons crawl; BruceBlaus's CC BY-SA medical illustrations for adult and child CPR, the airway, the Heimlich and infant back blows; everything on one light card.
- **Adaptive engine panel** in the desktop phone window (Engine button): live, real values from the running app. What was heard and how it was cleaned, the echo check, the router's decision and its time, the rescuer model's weighted signals (distress and confusion, each signal with its weight and evidence), the patient, the protocol step and what was skipped, each spoken line against its original, every AI rewrite with its verdict, and answer-card match scores.
- The rescuer read is now a weighted multi-signal score (`assess()` in `voice/adapt.ts`), tested.
- iPhone: Expo Go audio fallback (`audio/players.ts`). Real-device work paused at the user's request.
- Fixes from a screenshot pass: the CPR screen's two buttons were cut off ("AED is h…"), now full width and stacked; closing a help screen on web threw a wake-lock error, now silent.
- README, video script and shot list, YouTube description, submission draft, architecture and design docs updated to the new design (no hold, no countdown; the engine panel added to the video at 1:56). New screenshots in `docs/screens/`.
- iPhone home-screen build rebuilt with the redesign and checked offline (`python tools/build_iphone.py`). Not deployed: needs `gh auth login`.
- 184 tests passing, typecheck clean.

## Status on Monday October 19

### Done today
- **Real pictures on the steps.** 15 images crawled from Wikimedia Commons (`tools/crawl_images.py`), chosen by hand, cropped and recolored to the app's two colors (`tools/pick_images.py`). Only public domain, CC0, CC BY and CC BY-SA. Credits in the app (Me → Photo credits) and `docs/IMAGE_CREDITS.md`. Rejected on purpose: every infant CPR image found (two-finger technique, withdrawn in 2025; the app keeps its own two-thumb drawing) and every naloxone image (injectable kit, not the nasal spray).
- **Fewer words.** Step screens are a picture and a headline; the detail is spoken (and still read by screen readers). The voice bar shows only what was heard. Shorter buttons ("Called", "AED", "EMS"), trimmed Me and Learn.
- **Adaptive voice** (`mobile/src/voice/adapt.ts`, `voice.ts`):
  - Who: "my dad collapsed" → "Your dad collapsed. Let's check him first.", then "Watch his chest", "Is he breathing normally?". All 41 they/them lines have grammar-checked he and she versions, pre-recorded (no delay). On-screen headlines use the same pronoun.
  - How the rescuer sounds: panic → "I'm right here with you." first, and a slower voice; "what?" → the step again, slower; silence on a yes/no question → asked again with "Yes or no?".
  - Alone ("I'm by myself") → the 2-minute line drops "switch with someone".
  - AI phrasing on top (`/adapt`, Claude or a local model through Ollama), checked line by line: a rewrite that drops or adds a medical word, a number or a "don't", talks to the patient, breaks grammar or gets clipped is thrown away. Measured on this laptop: 7–8 of 10 lines pass, 31–56 s per batch, so it runs in the background (`reports/adapt-eval.json`). New lines are spoken in the same voice by `tools/tts_server.py`, which `mirror/launch.ps1` starts.
- Fixes: the voice said "nine hundred eleven" (now "nine one one"); the echo guard missed late transcripts of our own voice (now a 12-second window); "no, he's not responding" did not answer "is he breathing?" (now the leading yes/no answers); the map's Call button could dial a real hospital in a demo build (now it only shows the number).
- 172 tests passing, typecheck clean.

- **Mayday never calls 911.** All dialing and texting code removed, demo mode made permanent, the call permission dropped, and `__tests__/never911.test.ts` fails if any of it comes back. The countdown is a "practice call"; the voice says "Nothing was dialed. If this is real, call 911 yourself." Hospital numbers on the map are shown, never dialed.
- **iPhone build** (`tools/build_iphone.py` → `mobile/dist-iphone`): an installable home-screen web app for Safari, with icons, full screen under the notch, a service worker that stores all 510 files on first open (tested: reloads and runs the emergency flow with the network cut), no long-press text selection on the 911 button, and audio that plays with the silent switch on. Install steps: `docs/IPHONE.md`.

### Learned
- Local models on this CPU add little over the offline adaptation: the lines they get right are mostly the ones the rules already produce. A Claude key would make the AI layer worth its place; without one, the offline adaptation is the feature.

## Status on Sunday October 18 (end of day)

### Done
- Research: `research/findings.md` (rules, 20 winners, 4 winning videos transcribed, sources, CARES statistics). Plan: `docs/PLAN.md`.
- Expo app in `mobile/` (SDK 58, TypeScript strict): Home, Learn, Map, Me, emergency mode, practice, protocol reader.
- 10 protocols, 78 cited steps; 64 quoted from their source, 14 awaiting review (`docs/MEDICAL_SOURCES.md`).
- Protocol engine (pure reducer) with skip-if-known and interrupts.
- CPR coach on the audio clock: hands-only and 30:2, counts, coaching lines, 2-minute swaps, AED branch, haptics.
- Voice: speech recognition wrapper, echo guard, barge-in, keyword router (100% on its tuning set, **85% held-out**), offline answers, Groq router and Claude answers through the proxy.
- 911: practice-call countdown (never dials), cancel, "Called", dispatcher card with address, coordinates and summary.
- Map: 145 ERs, 36 trauma centers with levels, 25 urgent cares; nearest with drive estimate; directions; care advice by protocol.
- Photo check (Claude vision via proxy), hedged, picks burns or bleeding.
- Liquid Glass (iOS 26 native; web refraction), Skia orb shader, design system `design/SYSTEM.md`.
- Proxy (`proxy/`): Worker + local Node server, rate limit, schema-checked output, keys never in the app.
- 145 tests passing, typecheck clean. Reports in `mobile/reports/`.
- Phone mirror (`mirror/`): the web build inside an iPhone 17 Pro frame at 402 × 874 points. Desktop shortcut "Mayday Phone".
- Docs: this file, `docs/ARCHITECTURE.md`, `docs/MEDICAL_SOURCES.md`, `design/SYSTEM.md`, README, `submission/` drafts, `video/` script.

### Not done, in priority order

1. **Run on a real phone.** Nothing has touched hardware. `cd mobile && npx expo run:android` (USB, Developer Mode) or `eas build --profile development`. Check: speech recognition, the audio engine, haptics, Liquid Glass on an iOS 26 iPhone.
2. **Medical review.** A CPR-certified person goes through `docs/MEDICAL_SOURCES.md`, confirms the 14 ⚠ steps against the 2025 Part 7 and Part 8 text in a browser, and signs it.
3. **Device tests (spec section 8), record the results here:**
   - 10-minute CPR run: tempo by ear and against a stopwatch (1,100 beats), voice timing, battery %, screen stays on.
   - Airplane mode mid-protocol: counting and steps continue.
   - Audio during a real call (to a team member): does our voice play alongside the call? If not, haptics + screen only (expected; the app says so).
   - **Novice test:** hand the phone to someone who has never seen it, say "your friend collapsed", time until the first compression. Target under 15 s. Record the number for the video.
4. **Keys for the AI features** (only needed for the photo check and online answers in the video): put `ANTHROPIC_API_KEY` and `GROQ_API_KEY` in `proxy/.dev.vars`, `cd proxy && npm run dev`, and set `EXPO_PUBLIC_PROXY_URL=http://<laptop-ip>:8787` in `mobile/.env.local`. Paid services: ask before adding.
5. **Video** (Sat Oct 24 film, Sun Oct 25 edit): `video/script.md`, `video/shot-list.md`. Remotion segments for the architecture diagram and stats.
6. **Submission text**: rewrite `submission/answers.md` in your own words.

### Known limitations (say them, don't hide them)
- AI phrasing with a local model takes about a minute and only helps later steps; the first steps always use the offline adaptation.
- Router misses on the held-out set: "hot coffee spilled all over the baby" (no protocol), "she suddenly can't move her right arm" (went to the CPR check, should be stroke), "found my roommate passed out with a needle" (CPR check, should be overdose).
- Child and infant depth figures and AED pediatric pads are awaiting review.
- Map tiles need signal; the facility data does not.
- Urgent care data is OpenStreetMap, Tampa Bay only, incomplete.
- Spanish not started.
- Accelerometer rate feedback not built (spec: ship only if accurate; Flutter v1 research says rate is measurable, depth is not).

## Schedule (from the spec)

| Day | Plan | Actual |
|---|---|---|
| Sun 18 | Research, plan, design system, scaffold | Done, plus most of Mon to Thu |
| Mon 19 | Engine + tests, CPR coach | Done. Use for: real-device build |
| Tue 20 | Voice loop, emergency UI | Done. Use for: device voice testing, fixes |
| Wed 21 | 911, location, maps | Done. Use for: medical review, novice test |
| Thu 22 | Remaining protocols, photo, offline | Done. Use for: polish from device testing |
| Fri 23 | Feature freeze, device tests, README | |
| Sat 24 | Film | |
| Sun 25 | Edit, captions, upload, text | |
| Mon 26 | Submit by 9:00 am | |
