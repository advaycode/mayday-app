# Progress

Read this at the start of every session; update it at the end.

**Deadline:** 12:00 pm Eastern, Monday October 26 2026. **Our deadline:** submit by 9:00 am that morning.

## Status on Wednesday October 21

### Done today
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
