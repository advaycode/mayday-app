# Mayday — session state (2026-08-23)

## Decisions locked
- **Name:** Mayday
- **Platform:** Flutter (Android + iOS)
- **Test devices:** Android phone, iPhone, desktop — all available
- **Project dir:** `C:/Users/advay/Obsidian/Mayday/` (renamed from Bystander)
- Congressional App Challenge 2026, hard deadline 12:00 PM EDT Mon Oct 26 2026 (~9 weeks)

## Toolchain — DONE this session
- Flutter stable cloned to `C:\src\flutter` (shallow, branch stable)
- `C:\src\flutter\bin` appended to **User** PATH
- `JAVA_HOME` set to `C:\Program Files\Android\Android Studio\jbr` (JDK 21).
  System `java` on PATH is still JDK 8 — Gradle would reject it, hence JAVA_HOME.
- Android SDK present at `%LOCALAPPDATA%\Android\Sdk`, platforms 30/34/35/36
- **NOT DONE:** `flutter doctor` has never been run (first run bootstraps the Dart SDK).
  `cmdline-tools` is MISSING from the Android SDK, so `flutter doctor --android-licenses`
  will fail until installed via Android Studio > SDK Manager > SDK Tools >
  "Android SDK Command-line Tools".
- New terminals needed to pick up PATH/JAVA_HOME.

## Research — 2 workflows launched, status unknown at checkpoint
Batch A `wf_d82a0df7-cb1` (17 agents): cac-rules, cac-winners, legal-regulatory,
protocol-cpr, protocol-choking, protocol-bleeding, protocol-anaphylaxis-od-drowning,
protocol-tierb-neuro-cardiac, protocol-tierb-environmental — 8 with adversarial verifiers.

Batch B `wf_96e41c29-e16` (9 agents): flutter-stack, ondevice-llm, ondevice-voice,
cpr-sensing, aed-and-location, competitors, design-references — verifiers on
ondevice-voice and cpr-sensing.

Both write cited markdown to `research/raw/<key>.md`. Agents were instructed to write
notes EARLY and update incrementally, so partial files survive an interruption —
CHECK `research/raw/` FIRST on resume before assuming anything was lost.

Prior run `wf_ed464142-a22` died wholesale on a session limit and produced no notes.
Only scraped sources survive in `research/raw/`: aha_2024_firstaid_highlights.pdf,
highlights_text.txt, _highlights2025.txt, aha_fa2024.html, aha_fa2024_reader.html,
_part7.html, rfa.html

## Not yet written
`research/BRIEF.md` (engineering brief + protocol JSON schema) and
`research/STRATEGY.md` (rubric mapping + video plan) — these were phase 3 of the
original design and still need a synthesis pass once A and B land.

## The one question that can reshape the product
Whether the OS grants microphone access while a cellular call is active (Android + iOS).
The always-listening voice coach in F3 assumes the user is on speakerphone with 911 while
the app keeps listening. If the platform denies it, F3 must be redesigned now. Batch B's
`ondevice-voice` agent was told to answer this first and definitively.
