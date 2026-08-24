# Mayday — Competitive Landscape (KEY: competitors)
Research date: 2026-08-23. All facts below were fetched this session; URLs given.
STATUS: IN PROGRESS — being rewritten as more sources land.

---

## 1. American Red Cross "First Aid" app
- URL (iOS): https://apps.apple.com/us/app/first-aid-american-red-cross/id529160691
- URL (Android): https://play.google.com/store/apps/details?id=com.cube.arc.fa
- Version **4.1**, last updated **May 11** (2026 per store listing), **262.7 MB** on iOS, **requires iOS 18.0+**.
- Rating 4.7 / 2.3K ratings (iOS). Free, no IAP.
- Features per listing: preloaded offline content ("instant access ... without internet connection or cellular reception"); **spoken instructions** ("spoken instructions reduce stress and keep you focused"); toggle audio vs article view; **CPR metronome** with full-screen audio player, looping playback, casting; microlearning cards w/ images+video; quizzes+badges; Hospital Finder; integrated 911 calling; Siri/Bixby search shortcuts. Updated to "r.25 program update" guidelines.
- WEAKNESS: it is a **reference library that reads aloud**, not a state machine. Audio is one-way playback (article read aloud + metronome). No listening, no branching on what the user says, no incident timeline, no compression-quality feedback. 262.7 MB and iOS 18 floor. Requires the user to *choose* the right article first — an untrained panicking bystander must self-triage.
- NOTE: the ~May 2026 4.x rewrite moved to "microlearning" — i.e. Red Cross is optimizing for *learning before the event*, not *coaching during it*.

## 2. PulsePoint Respond
- URL: https://apps.apple.com/us/app/pulsepoint-respond/id500772134 ; https://www.pulsepoint.org/pulsepoint-respond
- Version **26.8.5383**, **37.3 MB**, iOS 15.0+, rating **4.8 / 271K ratings** (large install base — 271K ratings implies millions of installs).
- What it does: alerts *CPR-trained volunteers* near a public cardiac arrest simultaneously with EMS dispatch; shows AED locations from PulsePoint AED registry; live dispatch feed + radio; wildfire/flood/utility alerts; FirstNet certified. 2026 updates: CPR-needed alert tone now repeats up to 3x; new "On Duty" feed.
- Requires the local 911 agency to be integrated (city-by-city rollout, e.g. Danville VA launched March 2026).
- Store listing does **not** mention offline functionality, voice guidance, or CPR coaching.
- WEAKNESS: it is a **dispatch/notification network, not a coach**. It recruits an already-trained responder; it does nothing for the untrained person already standing over the patient. Fully dependent on network + agency integration.

## 3. GoodSAM
- URL: https://www.goodsamapp.org/ , /instantOnScene , /evidence , https://play.google.com/store/apps/details?id=com.goodsam.responder
- Two products: **GoodSAM Responder** (alert trained/verified responders + AED registry, used by ambulance/police/fire) and **Instant-On-Scene** (control room sends an SMS link, opens the caller's phone camera, live-streams video to the dispatcher — no app install needed).
- 2026 app update notes: new alert sounds/tones, clearer responder + emergency-kit icons, live video sharing from the app, responder ID shown on alert.
- WEAKNESS: responder side is **verified-responder only** (you must be credentialed). Instant-On-Scene is **entirely network-dependent** (streams video) and is a *dispatcher* tool — the intelligence is a human in a control room, not on the phone. Nothing offline.

---
(more sections pending: Staying Alive, AED locators, Red Cross Emergency, RapidSOS, what3words, Apple/Android Emergency SOS + Medical ID, AI-first first-aid apps 2024-26, accelerometer CPR feedback apps, DA-CPR literature, hypothesis tests a-e, differentiator claims)
