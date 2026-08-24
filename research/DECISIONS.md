# Mayday — Design decisions forced by the research

Written 2026-08-24. Every claim here traces to `research/raw/<key>.md`.
These three findings each invalidate part of the original spec. Read this before building.

---

## D1. The always-listening-during-the-911-call design is IMPOSSIBLE. Redesign required.

**Finding.** An ordinary app cannot capture microphone audio while a cellular call is active.
This is documented platform behaviour on both platforms, not a bug and not a permissions problem.

- **Android** — [developer.android.com/media/platform/sharing-audio-input](https://developer.android.com/media/platform/sharing-audio-input):
  a call is active when `AudioManager.getMode()` is `MODE_IN_CALL` / `MODE_IN_COMMUNICATION`;
  "the call always receives audio"; "two ordinary apps can never capture audio at the same time."
  Only an accessibility service with visible UI, or a privileged pre-installed app holding
  `CAPTURE_AUDIO_OUTPUT`, is exempt. Neither is available to a student's Play Store app.
- **iOS** — Apple DTS, [forums/thread/666607](https://developer.apple.com/forums/thread/666607):
  "There's no supported way to do this." Worse, [thread/784782](https://developer.apple.com/forums/thread/784782)
  shows `AVAudioSession` is interrupted while the phone is merely *ringing*, before the call connects.

**The trap that makes this dangerous.** On Android, `AudioRecord.startRecording()` **succeeds**
during a call and keeps delivering buffers. The buffers are digital silence. No exception, no
error code. A naive implementation looks alive and is deaf — during a cardiac arrest.

**Decision — three changes, and the constraint turns out to agree with best practice:**

1. **Delegate the call, don't make it.** The app's primary script is the BLS delegation technique
   already in the spec as F9: *"Point at one person. Say: YOU — call 911, put it on speaker."*
   The call happens on a **bystander's** phone; Mayday's phone stays free to listen and coach.
   This is what BLS courses actually teach, and it is now also what the platform requires.
   The constraint and the pedagogy point the same way — that is the F9 justification, upgraded
   from "nice extra" to "load-bearing".
2. **If the user is alone, degrade loudly and deliberately.** Mayday dials, and for the duration
   of the call drops to metronome + huge on-screen step + full-screen tap-to-advance. It announces
   the handover once ("I can't hear you while you're on the call — tap anywhere for the next step")
   rather than silently going deaf.
3. **Detect deafness rather than assuming it.** Android 11+ exposes
   `AudioRecord.registerAudioRecordingCallback()` → `AudioRecordingConfiguration.isClientSilenced()`,
   which returns true exactly when the OS is feeding us silence. iOS exposes
   `AVAudioSession.interruptionNotification`. Wire both to a single `MicAvailability` state.
   **This is the strongest 30 seconds of the code explanation in the video**: most apps in this
   category would ship the silent-failure bug, and the fix is a real platform-knowledge result.

**Never build:** a voice path whose correctness depends on the mic working during a call.
Voice is an *accelerator* over a touch path that always works.

---

## D2. There is no 30-point rubric. The spec's §7 rubric mapping is optimizing against a fiction.

**Finding.** The official [2026 CAC Rules PDF](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf)
contains no points, no rows, no level descriptors. Section 7.2 says apps **can** be judged on:

> a. Quality of the idea (including creativity and originality)
> b. Implementation of the idea (including user experience and design)
> c. Demonstrated excellence of coding and programming skills.

and §7.4 lets the office "substitute or modify the judging process or criteria at any time for
any reason. Judging is to be fair and impartial but left entirely to the discretion of the
Member of Congress." Judging is **entirely per-district** — no national round for winner selection.

**What actually binds, and what it means:**

| Rule | Consequence for Mayday |
|---|---|
| Video is "**the most critical component**" of the submission | The video is the deliverable. Budget accordingly — most judges will never run the app. |
| Video **1–3 minutes**, public on YouTube/Vimeo; over/under "may be penalized" | Hard 3:00 ceiling. |
| Video must state: participant names, app name, **purpose in one clear sentence**, target audience, tools/languages used, and showcase functionality | These six are checklist items. Missing "tools and coding languages" is a free avoidable loss. |
| **No code repository is required at submission** | But §7.3 lets judges demand source and the app on pain of "immediate disqualification" — so the repo must exist and run on demand. |
| **Prior work allowed back to Oct 30 2025** | No need to pretend Mayday started in May. |
| **AI usage permitted but must be "fully disclosed"**, and must not "constitute the entirety of the technical development" | Disclose AI assistance explicitly in the submission answers. Non-optional. |
| Originality: "solely created by the contestant"; open-source libraries allowed but must be "clearly document[ed]" | Keep a DEPENDENCIES.md naming every package and what it does. |
| Deadline **12:00 pm EDT, Monday October 26 2026** | Confirmed exactly as the spec stated. |

**Decision.** Stop optimizing for invented rubric rows. Optimize for the three real criteria and,
above all, for a 3-minute video that a non-technical congressional staffer finds compelling.
Keep §7 of the original spec only as an internal quality bar, clearly labelled as self-imposed.

---

## D3. Compression RATE is measurable. DEPTH is not — do not claim it.

**Finding.** Ruiz de Gauna et al., PLOS ONE 2016,
[10.1371/journal.pone.0150139](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0150139)
— three accelerometer-only algorithms, ADXL330 at 100 Hz/16-bit, sensor **bonded beneath the
rescuer's hands** on a **Resusci Anne manikin on a rigid surface**, ground truth from a
photoelectric displacement sensor:

| Method | Depth error | Rate error |
|---|---|---|
| Linear filtering (double integration) | 5.9% / 3.1 mm | 1.7% / 1.7 cpm |
| Zero-crossing velocity | 6.3% / 3.4 mm | 0.0% / 0.0 cpm |
| **Spectral analysis (first 3 harmonics)** | **2.5% / 1.3 mm** | 0.9% / 0.9 cpm |

Rate is essentially solved by every method. Depth is good *only* under laboratory conditions —
rigid backing, bonded sensor, clean 100 Hz signal. Double integration is "inherently unstable";
a baseline offset makes error **grow quadratically with time**. None of that survives a phone
loose in a rescuer's hand, on a real chest, on a mattress or car seat.

**Decision.**
- **Measure and coach rate.** Use spectral analysis over a sliding window, not double integration —
  better accuracy *and* no drift term to defend.
- **Never display or speak a depth number.** Coach depth by instruction and by the one thing that
  is honestly observable — recoil/rhythm regularity.
- The failure mode being avoided is not a lost rubric point. It is telling a bystander their
  compressions are deep enough when they are not.
- Say this out loud in the video. "We measure rate because the literature supports it, and we
  refuse to measure depth because it doesn't" is a stronger engineering claim than a fake number.

**Also load-bearing:** `sensors_plus` on Android defaults to `SENSOR_DELAY_NORMAL` ≈ **5 Hz**,
useless for 2 Hz compressions. An explicit fast `samplingPeriod` must be requested, and the
README warns the requested rate is "not guaranteed" — so the app must **measure its own achieved
sample rate at runtime** and disable rate feedback if it cannot sustain enough headroom.

---

## D4. Stack decisions that follow

| Area | Decision | Why |
|---|---|---|
| Flutter | Pin **3.47.x stable**, Dart ≥3.11 | Current stable Aug 2026. Budget time for the AGP 9 / Kotlin migration — plugins not updated since ~2025 may fail the Android build. |
| Metronome | **flutter_soloud 4.1.7** (MIT), `playClocked` / `playScheduled` | Timing resolved on the audio clock, not the Dart event loop. A `Timer.periodic` metronome drifts. Fallback: gapless loop of a pre-rendered click track. |
| Metronome risk | Test on Bluetooth earbuds | flutter_soloud [#400](https://github.com/alnitak/flutter_soloud/issues/400): playback broken on Pixel 6/6a over Bluetooth SCO — exactly the path when a BT mic is active. |
| Mic capture | **Not** flutter_soloud | Input capture is an open feature request ([#515](https://github.com/alnitak/flutter_soloud/issues/515)). Needs a separate package. |
| Sensors | **sensors_plus 7.1.0** (BSD-3), `userAccelerometerEventStream` | Gravity already removed by the platform. Cancel subscriptions in `dispose()` — [#3955](https://github.com/fluttercommunity/plus_plugins/issues/3955) is a teardown crash. |
| Tier B routing | **flutter_gemma 1.6.5** *if* it integrates; deterministic keyword decision tree as the fallback | Actively developed (1.6.0→1.6.5 in 3 days), supports Gemma 3 270M/1B. **But constrained decoding is unsupported** — [#195](https://github.com/DenisovAV/flutter_gemma/issues/195) is open and untriaged. We need a protocol ID from a fixed set, never free prose, so we must validate output against an allowlist and fall back to the decision tree on any miss. |
| Not MediaPipe | MediaPipe LLM Inference is **maintenance-only**; Google says migrate to LiteRT-LM | Don't build on a deprecated runtime. |
| Pre-1.0 tutorials | Ignore them | flutter_gemma 1.0 made the engine modular and opt-in; every older blog post is wrong. |

---

## D5. Content correctness — the 2025 guidelines are a genuine differentiator

The **2025** AHA Guidelines (Del Rios, Bartos, Panchal et al., *Circulation*. 2025;152(suppl 2),
published Oct 2025) changed things that virtually every shipping first-aid app still gets wrong:

- **Infant CPR: the 2-finger technique is no longer recommended.** Use heel of one hand, or
  2-thumb-encircling. Any asset saying "two fingers" is obsolete.
- **Adult choking now starts with 5 back blows**, then 5 abdominal thrusts, repeating. Adult
  choking wasn't even in the 2020 AHA guidelines; older AHA material taught abdominal thrusts alone.
  This also **eliminates the historic AHA/Red Cross divergence** — they now agree on five-and-five.
- **Child choking** likewise starts with back blows. **Infant**: 5 back blows / 5 chest thrusts
  using the **heel of one hand**.
- **Telecommunicator CPR splits by age**: Hands-Only for adults, conventional CPR **with breaths**
  for children. This is the guideline-sanctioned justification for Mayday's age branch.
- **AED + bras (new)**: "it might be reasonable to adjust the position of a bra instead of removing
  it" — added because women receive public-access defibrillation at significantly lower rates.
  The AED script should say so explicitly.
- **Opioid arrest is a breaths-indicated scenario**, not hands-only.

Being demonstrably current on an October-2025 guideline revision is a defensible answer to
"how do you know this is correct?" — and it is checkable by a judge in one search.
