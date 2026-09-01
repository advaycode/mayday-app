# Mayday — state (2026-08-31)

Congressional App Challenge 2026. Deadline **12:00 pm EDT, Mon Oct 26 2026** (~9 weeks).
Offline, voice-first bystander emergency coach. **Flutter**, Android + iOS.

## Where things are
- `app/` — Flutter project (git repo initialised at `Obsidian/Mayday`, 1 commit)
- `research/DECISIONS.md` — **read this first**, the findings that reshaped the spec
- `research/raw/*.md` — 15 cited research notes
- `app/DEPENDENCIES.md` — CAC-required third-party + AI disclosure

## Toolchain
- Flutter **3.47.1** stable / Dart 3.13.1 at `C:\src\flutter`, on User PATH
- `JAVA_HOME` → `C:\Program Files\Android\Android Studio\jbr` (JDK 21). System `java` is JDK 8.
- Android SDK platforms 30/34/35/36
- **Windows desktop target removed** — Flutter plugins need symlinks, which need Developer Mode,
  which needs admin. Enable it (`start ms-settings:developers`) and `flutter create --platforms
  windows .` to get desktop iteration back.
- `cmdline-tools` still missing → `flutter doctor --android-licenses` will fail until installed
  via Android Studio → SDK Manager → SDK Tools.
- Web target added purely for headless screenshots.

## Done
- Protocol corpus format (`assets/protocols/*.json`): cited state machines, one source quote per
  step, `verified` flag per step
- `cpr_adult` and `choking_adult`, content transcribed verbatim from the 2025 AHA algorithms
- Deterministic Tier A engine + incident timeline
- Compression coach: drift-corrected metronome, autocorrelation rate detector, swap timer
- EMS handoff screen with copyable timeline
- Design system: near-monochrome, one signal red, bundled Archivo, radius 2, no page transitions
- 911 dialer that **refuses to dial in non-release builds** so testing and filming are safe
- **The assistant** (`lib/src/ai/`, `assets/knowledge/`) — read `app/docs/ASSISTANT.md`:
  - "Ask Mayday": talk or type, get a spoken answer, the guideline line it came from, and a button
    that starts the protocol
  - Voice during an incident: every step read aloud, hands-free `next` / `repeat` / `what do I do`
    / `I'm alone` / `slower` / `call 911` / `timeline`
  - BM25 retrieval over 28 authored, cited answer cards. **No language model, no network.** The
    advisor selects an answer, never writes one, and a test fails the build if a spoken sentence
    cannot be traced to the pack or to a protocol step
  - Coverage-gap cards that refuse: children/infants, bleeding, seizure, anaphylaxis, overdose,
    stroke, drowning. The gap veto runs *before* the red-flag check, so "my baby is not breathing"
    refuses instead of opening the adult protocol
  - `MicAvailability` + `CallStateMonitor` + a permission-free `AudioManager.getMode()` channel in
    `MainActivity.kt`: losing the mic to a call is **announced out loud**, then it degrades to touch
  - `llm_router.dart`: the one job a model may do (classification), disabled by default, output
    validated against a protocol-id allowlist with a 900 ms deadline
- **94 tests passing**, `flutter analyze` clean
- Web build verified; home + compression coach screenshotted

## Open — in priority order
1. **Confirm the CPR rate/depth numbers.** `cpr_adult.hand_position` and `cpr_adult.compressions`
   are marked `verified:false` and show as "unconfirmed" in the app. ahajournals.org and
   cpr.heart.org both 403 automated fetches — get the Part 7 PDF manually, confirm 100–120/min
   and 5–6 cm, set `verified:true`, and delete the entries from `kKnownUnverifiedTierASteps`
   in `test/corpus_test.dart`.
2. **Audio.** The metronome is currently haptic + visual only. Add `flutter_soloud` 4.1.7 and
   drive clicks with `playScheduled` on the audio clock (never a Dart Timer). Test on Bluetooth
   earbuds — flutter_soloud #400 breaks on Pixel 6 over Bluetooth SCO. Note the interaction with
   the assistant: TTS and the click track share an output, so check they do not duck each other.
3. **Voice — the iOS half of mic detection.** Android is done (`AudioManager.getMode()` over
   `dev.advay.mayday/audio`, no permission needed). iOS still needs an
   `AVAudioSession.interruptionNotification` observer in `AppDelegate.swift` answering the same
   `isCallActive` method; `CallStateMonitor` reports `unknown` there today and falls back to the
   recogniser's error path. Also untested on hardware: `requireOnDevice` recognition fails the
   listen when no local model is installed for the locale, which is the intended behaviour but has
   not been seen on a real phone.
4. Remaining Tier A protocols: bleeding, anaphylaxis, opioid overdose, drowning; then child and
   infant variants of CPR and choking (**infant = heel of one hand or 2-thumb; NEVER 2 fingers**,
   changed in 2025 — there is a test guarding this).
5. Tier B routing. `flutter_gemma` 1.6.5 has **no constrained decoding** (issue #195 open), so
   validate any model output against a protocol-id allowlist and fall back to a deterministic
   keyword decision tree.
6. Run on a real Android device — nothing has touched physical hardware yet, so the accelerometer
   path, the speech recogniser, the TTS voice and the call-state channel are all unproven outside
   synthetic tests. `MainActivity.kt` in particular has never been compiled.
7. The 3-minute video. Rules call it "the most critical component". Must state: participant
   names, app name, purpose in one sentence, target audience, tools/languages, and show
   functionality.

## Research gaps still open
Batch A/B agents died on session limits partway through; notes are partial. Thin files worth
re-running: `ondevice-voice` (only Part 0 written), `ondevice-llm`, `competitors`,
`protocol-tierb-neuro-cardiac`, `cpr-sensing` (stops before the verdict).
`research/BRIEF.md` and `research/STRATEGY.md` were never written.
