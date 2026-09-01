# The Mayday assistant

*Ask Mayday what you're looking at, out loud, with no signal — and get an answer you can check.*

This document explains what the AI feature is, why it is built the way it is, and what would
change if the design were different. Code: `lib/src/ai/`. Content: `assets/knowledge/`.

---

## What it does

Two surfaces, one brain.

**Ask Mayday** (`lib/src/features/assistant/assistant_screen.dart`). Tap TALK, or type. Say
anything — *"he's not breathing"*, *"do I have to take her bra off"*, *"how deep do I push"* — and
you get a spoken answer, the same answer on screen in the largest type the sentence will take, the
line of the 2025 AHA guidelines it came from, and a button that starts the protocol.

**Voice during an incident** (`lib/src/features/incident/incident_voice.dart`). Every step is read
out as you reach it. `next`, `repeat`, `what do I do`, `I'm alone`, `slower`, `call 911` and
`timeline` work hands-free, which matters when both of your hands are on somebody's chest. You can
still ask questions mid-incident, and the answer never moves the protocol.

---

## Why it is retrieval and not a language model

The obvious build is a small on-device LLM answering first-aid questions. Mayday deliberately does
not do that, and the reasons are worth stating because they are the interesting part of the
feature.

**1. Every sentence it can say is checked into git.**
The advisor *selects* an authored answer card; it never writes one. `assets/knowledge/faq_2025.json`
is the complete set of things Mayday can say out loud, each with a source id and the guideline text
it rests on. A clinician can read the whole file in ten minutes and tell you whether the app is
correct. `test/advisor_test.dart` enforces this: every spoken utterance must decompose into an
authored body plus a framing sentence from `Advisor.templates`. There is no path by which a novel
sentence reaches the speaker.

**2. It can say "I don't know", and it does.**
A retrieval score is a real number you can threshold. Below `AdvisorConfig.hedgeScore` the answer
is a refusal plus *call 911* — and for a bystander app, a refusal is the right output far more
often than a fluent paragraph is. There are also **coverage-gap cards**: emergencies Mayday knows
it does not cover (bleeding, seizure, anaphylaxis, overdose, stroke, drowning, and anything
involving a child or an infant). Asking about one gets an explicit *"not in this build — call 911
now"*, never an approximation from a neighbouring protocol.

The infant case is the sharpest version of this. *"My baby is not breathing"* contains the most
time-critical phrase in the app, and the correct response is still to refuse: an infant is not a
small adult, and the 2025 Guidelines **withdrew** the 2-finger infant compression technique that
most first-aid content still teaches. So the coverage-gap veto runs *before* the red-flag check,
and there is a test named after it.

**3. It answers in under a millisecond, offline, with nothing to download.**
No weights, no warm-up, no first-token latency, no model file in the APK. `test/advisor_test.dart`
holds it under 20 ms per call with a wide margin; it measures in the tens of microseconds. Standing
over somebody in cardiac arrest waiting for a phone to think is not an acceptable interaction.

**4. It shows its working.**
Every answer displays which of your words it matched and how strong the match was. An answer you
cannot interrogate is an answer you cannot trust.

### Where a model *would* earn its place

One job: turning a rambling sentence into a protocol id. That is `lib/src/ai/llm_router.dart` —
an interface, off by default, with `DisabledLlmRouter` shipping. It exists because
`flutter_gemma` still has **no constrained decoding**
([#195](https://github.com/DenisovAV/flutter_gemma/issues/195)), so a model asked for `cpr_adult`
can return anything at all. `RoutingAllowlist` therefore parses the output, matches it against
protocol ids the corpus actually defines, and drops anything else; `GuardedLlmRouter` adds a hard
900 ms deadline and swallows crashes. A model that hallucinates `cpr_infant` produces a fallback,
not a wrong protocol. A model may classify. A model may never compose.

---

## How the pipeline works

```
utterance
  │
  ├─ normalise            text.dart      contractions → phrases → stopwords → stem → negation
  ├─ coverage-gap veto    lexicon.dart   "baby", "seizure", "stroke" → refuse, and stop
  ├─ red flags            lexicon.dart   "not breathing", "choking" → escalate inside that protocol
  ├─ exact phrasing       advisor.dart   the pack already claims this sentence, word for word
  └─ BM25 retrieval       retriever.dart cards ×1.0, protocol steps ×0.65, coverage gaps ×0.45
        │
        ├─ score ≥ 0.34 and coverage ≥ 0.5 → answer plainly
        ├─ two protocols within 0.12        → ask which one
        ├─ score ≥ 0.18                     → answer, hedged and marked uncertain
        └─ otherwise                        → "I don't know. Call 911."
```

Two details in the normaliser are load-bearing and neither is obvious:

**Negation is folded into the token.** A bag of words cannot tell *are they breathing* from *they
are not breathing*, and in this corpus that is the whole question. A negator binds to the next
three content tokens and prefixes them: `not breathing` becomes the single term `not_breath`, which
can never be matched by a document about breathing.

**Negation stops at a clause boundary.** Without this, the sentence *"there is no network call
anywhere in the app"* leaks its negator forward, and a knowledge card's `ask` list — which is a set
of unrelated sentences — turns half its vocabulary into negatives. That bug produced a confidently
wrong answer and left no trace of why; `clauseBoundary` in `text.dart` is the fix.

---

## The microphone problem

An ordinary app **cannot record audio while a call is up**, on Android or iOS. This is documented
platform behaviour, not a permissions problem (`research/DECISIONS.md` D1). The trap: on Android
`AudioRecord.startRecording()` *succeeds* during a call and returns digital silence — no exception,
no error code. An app that does not check looks alive and is deaf, at the exact moment somebody is
kneeling on a pavement counting on it.

So Mayday never assumes it can hear:

- `MainActivity.kt` exposes `AudioManager.getMode()` over a method channel — `MODE_IN_CALL` /
  `MODE_IN_COMMUNICATION`, and it needs no permission at all.
- `CallStateMonitor` polls it once a second. Polling, not events, because a missed event leaves you
  stuck believing you can hear.
- `MicAvailability` folds that together with the recogniser's own state.
- When it turns to `silencedByCall`, `VoiceSession` **says so out loud** — *"I can't hear you while
  you're on the call. Tap anywhere for the next step"* — once, and hands over to touch.

Announced deafness is recoverable. Silent deafness is not. This is why voice is an accelerator over
a touch path that always works, and why `IncidentVoiceController` owns nothing the incident screen
needs.

iOS still needs its half: `AVAudioSession.interruptionNotification`, which fires while the phone is
merely *ringing*. `CallStateMonitor` reports `unknown` there today and the recogniser's error path
is the backstop. Tracked in `STATE.md`.

## Recognition stays on the device

`PlatformRecognizer.requireOnDevice` defaults to true, so a listen that cannot be served locally
**fails** rather than quietly shipping a recording of somebody's worst day to a speech API. The app
also ships without `android.permission.INTERNET`, which turns "works offline, stays on your phone"
from a promise into something you can check in the manifest.

---

## Adding to it

Answers are content, not code. To teach Mayday something new, add a card to
`assets/knowledge/faq_2025.json`:

| Field | Notes |
|---|---|
| `kind` | `route` (answers and starts a protocol), `answer`, `coverageGap` (refuses), `meta` (about the app) |
| `ask` | Every phrasing you would expect to hear. These are weighted ×3 in the index. |
| `display` / `speech` | Written separately: "911" reads right and must be *said* "nine one one". |
| `source` + `quote` | Required for anything clinical. Must be a source id from `assets/protocols/sources.json`. |
| `quoteKind` | `verbatim` if transcribed character-for-character, `paraphrase` otherwise. |
| `verified` | A `paraphrase` can never be `true` — `knowledge_test.dart` fails the build. |

Vocabulary — synonyms, red flags, out-of-scope topics — lives in `assets/knowledge/lexicon.json`
and contains no medical content at all. It only maps what a frightened person says onto concepts
the cited corpus is indexed under.

## Tests worth reading first

| File | What it holds |
|---|---|
| `test/advisor_test.dart` | Routing, refusals, and *"the assistant never writes prose"* |
| `test/knowledge_test.dart` | Pack integrity, the paraphrase rule, coverage-gap purity |
| `test/incident_voice_test.dart` | A question cannot advance the protocol; every spoken line traces to the corpus |
| `test/voice_session_test.dart` | Barge-in, and losing the microphone out loud rather than silently |
| `test/tier_a_safety_test.dart` | No inference runtime or network client on either the protocol or the advisor path |
| `test/llm_router_test.dart` | Allowlist validation, deadline, crash containment |
