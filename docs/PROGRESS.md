# Progress

Read this at the start of every session; update it at the end.

**Deadline:** 12:00 pm Eastern, Monday October 26 2026. **Our deadline:** submit by 9:00 am that morning.

## Status on Sunday October 18 (end of day)

### Done
- Research: `research/findings.md` (rules, 20 winners, 4 winning videos transcribed, sources, CARES statistics). Plan: `docs/PLAN.md`.
- Expo app in `mobile/` (SDK 58, TypeScript strict): Home, Learn, Map, Me, emergency mode, practice, protocol reader.
- 10 protocols, 78 cited steps; 64 quoted from their source, 14 awaiting review (`docs/MEDICAL_SOURCES.md`).
- Protocol engine (pure reducer) with skip-if-known and interrupts.
- CPR coach on the audio clock: hands-only and 30:2, counts, coaching lines, 2-minute swaps, AED branch, haptics.
- Voice: speech recognition wrapper, echo guard, barge-in, keyword router (100% on its tuning set, **85% held-out**), offline answers, Groq router and Claude answers through the proxy.
- 911: 5-second countdown, cancel, "Already called", DEMO_MODE, dispatcher card with address, coordinates and summary, text-to-911.
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
