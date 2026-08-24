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

No AI runs inside the app. Tier A protocols execute as a deterministic state machine with no
model in the loop — enforced by `test/tier_a_safety_test.dart`, which fails the build if an
inference runtime or network client ever appears on that code path.
