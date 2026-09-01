# Third-party code and AI disclosure

The 2026 Congressional App Challenge rules require two things this file covers.

> "While participants may use open-source libraries, frameworks, and external tools, they must
> clearly document any such usage and ensure their project reflects significant personal effort
> and technical understanding." — 2026 CAC Rules, §3 Originality

> "The use of AI tools in app development for the Congressional App Challenge is permitted,
> provided that all AI usage is fully disclosed in the submission materials. AI may only be used
> to support specific aspects of the project and must not constitute the entirety of the
> technical development." — 2026 CAC Rules, §3 AI Usage

---

## Framework

| Name | Version | Licence | What it does here |
|---|---|---|---|
| Flutter | 3.47.1 (stable) | BSD-3-Clause | UI framework and build toolchain, targeting Android and iOS |
| Dart | 3.13.1 | BSD-3-Clause | Language |

## Packages

| Package | Version | Licence | What it does here | Why this one |
|---|---|---|---|---|
| `sensors_plus` | 7.1.0 | BSD-3-Clause | Accelerometer stream feeding compression-rate detection | Verified publisher (fluttercommunity.dev), actively maintained, and exposes `userAccelerometerEventStream` so gravity is removed by the platform rather than by us |
| `url_launcher` | latest | BSD-3-Clause | Hands 911 to the system dialer | First-party Flutter team package |
| `speech_to_text` | 7.4.0 | BSD-3-Clause | Microphone input for the assistant | The only maintained Flutter binding to the platform recognisers, and the only one that exposes on-device-only recognition — which Mayday requires, so a listen fails rather than going to a server |
| `flutter_tts` | 4.2.5 | MIT | Speaks instructions and answers | Wraps the OS text-to-speech engine, so the voice is already installed, works offline, and matches the accessibility voice the user has already chosen |
| `cupertino_icons` | 1.0.8 | MIT | Default Flutter scaffold dependency | Ships with `flutter create` |

## Fonts

| Asset | Licence | Source |
|---|---|---|
| Archivo (variable) | SIL Open Font License 1.1 (`assets/fonts/OFL.txt`) | github.com/google/fonts/ofl/archivo |

## Content

Protocol content is derived from published clinical guidelines, cited inline in the app and
recorded in `assets/protocols/sources.json`. Primary source is the **2025 American Heart
Association Guidelines for CPR and ECC** (Del Rios M, Bartos JA, Panchal AR, et al. Circulation.
2025;152(suppl 2)). No text was adapted from another first-aid app.

Every instruction in the app carries the guideline quote it encodes, viewable by tapping the
source strip. Steps that could not be confirmed against a fetchable primary source are marked
`unconfirmed` **in the UI itself** and are tracked in `test/corpus_test.dart` as a debt register
that the test suite refuses to let grow.

## What is written by hand

Everything in `lib/` and `test/` is original code written for this project. Nothing was copied
from a tutorial or another app. The parts worth pointing at:

- `lib/src/cpr/compression_rate_detector.dart` — autocorrelation rate estimation with sub-sample
  parabolic peak refinement, dominant-axis selection, an achieved-sample-rate floor, and an
  explicit octave-error guard. The algorithm choice follows Ruiz de Gauna et al., PLOS ONE 2016.
- `lib/src/cpr/metronome.dart` — drift-corrected beat scheduling from a single time origin.
- `lib/src/engine/incident_engine.dart` — the Tier A protocol state machine.
- `lib/src/data/protocol_repository.dart` — corpus loading plus graph validation (dangling edges,
  unreachable steps, per-kind structural rules).
- `test/tier_a_safety_test.dart` — enforces the no-model-in-the-loop architectural invariant.
- `lib/src/ai/` — the assistant. A normaliser with negation folded into the token and negation
  scoping stopped at clause boundaries; an Okapi BM25 index over the cited corpus; a router that
  vetoes on coverage gaps before it escalates on red flags; a command grammar tight enough that a
  question can never advance the protocol; and a voice session that announces losing the microphone
  instead of going quietly deaf. Explained in full in `docs/ASSISTANT.md`.
- `android/.../MainActivity.kt` — a permission-free `AudioManager.getMode()` read, because Android
  will hand a recording app digital silence during a call rather than an error.

## AI disclosure

AI assistance (Claude) was used during development for:

- **Research**: locating and summarising the 2025 AHA guideline changes, platform documentation
  on microphone availability during calls, and the accelerometer CPR literature. All findings are
  cited to primary sources in `../research/`, and the load-bearing ones were checked against those
  sources rather than taken on trust.
- **Code**: drafting and reviewing implementation across the app.

Two things this project did *not* get from AI, and they are the parts that matter:

1. **The design decisions.** The three findings that shaped the product — that the microphone is
   unavailable during a call, that there is no CAC points rubric, and that accelerometer depth is
   not defensible — came out of reading primary platform docs, the official rules PDF, and a
   validation study, and each is written up with its source in `../research/DECISIONS.md`.
2. **The correctness gates.** The test suite, the citation-per-step requirement, and the
   unverified-content debt register exist because shipping medical instructions demands them.

### The assistant in the app is not a language model

Mayday has an AI feature — you talk to it and it answers — and it contains **no language model and
no network call**. It is Okapi BM25 retrieval over a bundled corpus of authored, cited answer
cards. The assistant *selects* an answer; it never writes one, and
`test/advisor_test.dart` fails the build if a sentence it speaks cannot be traced to
`assets/knowledge/faq_2025.json` or to a protocol step. The complete set of things this app can say
out loud is a JSON file you can read in ten minutes.

That is a deliberate engineering position rather than a shortcut, and `docs/ASSISTANT.md` argues
it: retrieval can cite its source, can be reviewed by a clinician, can be thresholded into an
honest *"I don't know — call 911"*, runs in microseconds offline, and cannot invent a technique for
an infant. One narrow job is reserved for an on-device model — turning a rambling sentence into a
protocol id — and `lib/src/ai/llm_router.dart` is where it would plug in: an interface, disabled by
default, whose output is validated against an allowlist of protocols the corpus actually defines
and dropped on any miss.

Tier A protocols execute as a deterministic state machine with no model in the loop — enforced by
`test/tier_a_safety_test.dart`, which fails the build if an inference runtime or network client
ever appears on that code path, or on the advisor's.
