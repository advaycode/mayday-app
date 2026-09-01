# Mayday

**Offline, voice-first coaching for an untrained bystander in a medical emergency.**

Congressional App Challenge 2026. Flutter, Android and iOS.

Most people who witness a cardiac arrest do nothing, and it is not because they do not care — it is
because they do not know what to do and there is nobody standing next to them saying it out loud.
Mayday is that voice. It works in a basement, on a trail, in a car park, with no signal and no
account, and every single instruction it gives you shows you the line of the guidelines it came
from.

---

## What it does

- **One button.** Cold start to an instruction, no onboarding, no sign-in, no splash.
- **One instruction at a time**, in type you can read at arm's length while kneeling.
- **Talk to it.** Say what you can see — *"he's not breathing"*, *"something's stuck in her
  throat"*, *"how deep do I push"* — and it answers out loud and starts the right protocol.
- **Hands-free during the incident.** `next`, `repeat`, `what do I do`, `I'm alone`, `slower`,
  `call 911`. Both of your hands are busy.
- **A compression coach** with a drift-corrected metronome and a real rate estimate from the
  accelerometer.
- **An EMS handoff**: a timestamped timeline of everything that happened, to hand to the paramedics.
- **A source on every screen.** Tap it and read the guideline text the instruction encodes.

## The three things that make it different

**1. It shows you where every word came from.**
The protocol corpus (`app/assets/protocols/`) is a set of cited state machines: one guideline quote
per step, a `verified` flag per step, and a test that fails the build if a Tier A instruction is not
traceable to a confirmed primary source. Two steps are currently marked **unconfirmed in the app
itself**, because the AHA Part 7 PDF sits behind a Cloudflare challenge and has not been read
first-hand. Showing that is the point.

**2. Its AI feature contains no language model.**
You can talk to Mayday and it answers — and the answer surface is a JSON file of authored, cited
cards that you can read in ten minutes. Retrieval selects the answer; nothing writes one. That buys
things a model cannot give here: a citation on every answer, an honest *"I don't know — call 911"*
below a confidence threshold, microsecond latency with nothing to download, and a hard refusal on
emergencies it does not cover. *"My baby is not breathing"* contains the most time-critical phrase
in the app, and the correct answer is still to refuse — an infant is not a small adult, and the 2025
Guidelines withdrew the infant technique most first-aid content still teaches. Full argument in
[`app/docs/ASSISTANT.md`](app/docs/ASSISTANT.md).

**3. It knows when it has gone deaf.**
An app cannot record audio while a call is up, on either platform — and on Android the microphone
API *succeeds* and returns digital silence rather than an error, so the naive implementation looks
alive and is deaf. Mayday watches the call state, and when it loses the microphone it **says so**
and hands you the touch path. Voice is an accelerator over something that always works.

## Content currency

Built against the **2025** AHA Guidelines for CPR and ECC (published October 2025), which changed
things most shipping first-aid apps still get wrong:

- Adult choking now starts with **5 back blows**, then 5 abdominal thrusts — reversing the previous
  guidance and ending the historic AHA/Red Cross split.
- The infant 2-finger compression technique is **withdrawn**.
- The AED script may say a bra can be **moved aside** rather than removed, added because women are
  defibrillated at significantly lower rates.

Rate, and not depth, is measured — because
[Ruiz de Gauna et al. (PLOS ONE, 2016)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0150139)
shows accelerometer depth only works with a bonded sensor on a rigid manikin, and telling a
bystander their compressions are deep enough when they are not is the worst thing this app could
do. Reasoning in [`research/DECISIONS.md`](research/DECISIONS.md).

## Running it

```bash
cd app
flutter pub get
flutter test        # 94 tests
flutter analyze
flutter run
```

The 911 dialer **refuses to place a real call unless the build is a release build**, so development,
testing and filming the demo video are all safe.

## Layout

```
app/                     Flutter app
  lib/src/domain/        protocol model — cited state machines
  lib/src/engine/        Tier A execution: deterministic, no model in the loop
  lib/src/cpr/           metronome + compression-rate detection
  lib/src/ai/            the assistant — see app/docs/ASSISTANT.md
  lib/src/features/      screens
  assets/protocols/      the cited corpus
  assets/knowledge/      the assistant's answer cards and vocabulary
  test/                  94 tests, including the architectural invariants
  DEPENDENCIES.md        third-party code and AI-use disclosure (CAC §3)
research/                sourced research notes
  DECISIONS.md           the findings that reshaped the spec — read this first
STATE.md                 where the build is, and what is next
```

## Status and honesty

This is in-progress work for the October 2026 deadline. What is **not** done is listed in
[`STATE.md`](STATE.md) rather than hidden: audio clicks for the metronome, the iOS half of
call-state detection, protocols beyond adult CPR and adult choking, and — importantly — nothing has
run on physical hardware yet.

Mayday coaches you through published first-aid protocols. It is not a substitute for professional
medical care or for formal training, and it does not diagnose. In an emergency, call 911.
