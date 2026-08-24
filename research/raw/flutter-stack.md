# Mayday — Flutter 2026 Stack Research (KEY: flutter-stack)

Research date: 2026-08-23. Every claim below is from a page fetched this session; URLs inline.

---

## 1. Flutter / Dart versions (Aug 2026)

- **Flutter 3.47.0 is the latest stable** as of Aug 2026. Prior stables: 3.44.0, 3.41.0, 3.38.0, 3.35.0.
  Source: https://docs.flutter.dev/release/release-notes (page last updated 2026-08-12; docs site itself still says it "reflects Flutter 3.44.7", i.e. 3.47 is very fresh).
- Flutter 3.47 **bumped minimum Dart SDK constraint to 3.11.0** (PR #188357). An attempt to bump to ^3.13.0 was reverted (#186957 → reverted #187209). Flutter 3.44.6 shipped Dart 3.12.2 (per flutterreleases.com, 2026-07-09).
  Source: https://docs.flutter.dev/release/release-notes/release-notes-3.47.0
- **Impeller**: now default renderer on Windows (#188140) and Linux (#187573). Android/iOS already Impeller by default from earlier releases. Android texture-coordinate Y-flip workaround removed (#187686).
- **Android**: Flutter 3.47 adds support for **Android 17 (API level)**; **AGP 9+ migration with built-in Kotlin support** (#188543) — this is a real migration hazard for older plugins.
- **iOS**: dropped availability checks for iOS 14/15 in the embedder (#188189). VSyncClient + DisplayLinkManager migrated to Swift (#187001, #186935); iOS task runners refactored (`FlutterFMLTaskRunner`, #185617).
- **macOS min raised 10.15 → 12** to support Xcode 27. Irrelevant to us (no Mac) except that CI images must be modern.
- **WASM**: web compile-to-WebAssembly supported. Not relevant for Mayday (mobile only) but means `dart:ffi` packages still can't target web — flutter_soloud does target web via its own path.

**BUILD IMPLICATION**: Pin to Flutter 3.47.x stable, Dart >=3.11. Budget time for the **AGP 9 / Kotlin migration** — any plugin not updated since ~2025 may fail the Android build outright.

---

## 2. Audio: the metronome timing problem (THE critical decision)

### The core problem
A Dart `Timer.periodic(Duration(milliseconds: 500))` firing `player.play()` **will drift and jitter**. Reasons: Dart timers are event-loop scheduled (fire *no earlier than* the duration, never exactly on it), GC pauses and frame work delay them, and every `play()` call has variable engine-side latency. Compression-rate feedback needs 100–120 bpm sustained accurately for minutes — accumulated drift is the failure mode.

Medium case study confirming Dart timer imprecision: https://medium.com/geekculture/flutter-case-study-timer-precision-a1154b431e8 — notes frame-based timing is OK at ~120bpm granularity but "if you need to repeat tasks more frequently, this approach is not appropriate", and inter-isolate communication is asynchronous and irregular.

### WINNER: flutter_soloud
- **Version 4.1.7**, published ~2026-08-08 (15 days before 2026-08-23). **MIT licence** (Dart plugin; underlying SoLoud C++ engine has its own permissive licence).
- Publisher: marcobavagnoli.com (verified). **599 likes, 160 pub points, 88.5k downloads.**
- Platforms: **Android 21+, iOS 13.0+**, macOS 10.15+, Linux, Windows, Web.
- Source: https://pub.dev/packages/flutter_soloud , https://github.com/alnitak/flutter_soloud
- **This is the decisive feature**: `playClocked` gives "sub-millisecond spaced playback **regardless of buffer size**", and `playScheduled` schedules whole batches of sounds **on the engine's own audio clock**, with optional scheduled stop/fade. The README explicitly names the use case: *"Perfect for metronomes, music sequencers, rhythm games and precisely timed audio cues."*
- Architecture: Dart FFI → C++ SoLoud engine. Timing is resolved in the audio callback, not on the Dart event loop. That is exactly why it does not drift.

### OPEN ISSUES (the trap check) — only **9 open issues total**, unusually healthy
Source: https://github.com/alnitak/flutter_soloud/issues
1. #515 (2026-07-28) feat: add **native input-device capture** — i.e. **microphone capture is NOT supported**, it's an open feature request.
2. #489 (2026-06-22) iOS Safari/PWA background/lock-screen audio — web-only, not our concern.
3. #438 (2026-04-02) `bufferingTimeNeeds` not working as expected — affects streamed audio, not preloaded buffers.
4. #437 (2026-04-01) feat: listen to engine output.
5. **#400 (2026-02-03) playback on Pixel 6 / Pixel 6a using Bluetooth SCO not working** — REAL RISK. Bluetooth SCO is the mode Android enters when a BT headset mic is active. If Mayday records mic while playing metronome and the user has AirPods/BT earbuds, this is the exact code path.
6. #388 (2025-12-23) `SoLoudSoundHashNotFoundCppException` — runtime exception on missing sound hash. Guard all handles.
7. #355, #334, #163 — feature requests (web OPUS config, pull buffering, get AudioSource by path).

**BUILD IMPLICATION**: Use flutter_soloud for the metronome and for short spoken cues, driving beats with `playScheduled`/`playClocked` rather than a Dart Timer. Schedule a rolling window of N beats ahead and top it up from a coarse Dart timer — the Dart timer only needs to be roughly right, the audio clock supplies the precision. Do NOT use it for microphone capture; that needs a second package. Test explicitly on Bluetooth earbuds (issue #400).

### Alternative considered: looped buffer
A pre-rendered WAV of exactly N beats at the target BPM, looped gaplessly, has zero drift by construction (the loop is sample-exact). flutter_soloud advertises **gapless looping**. This is the *simplest possible* fallback if `playClocked` disappoints: render 60s of 110bpm clicks offline, loop it. Downside: BPM cannot change smoothly mid-loop, and you lose per-beat callbacks for UI sync.

---

## (sections below still being filled in — audio_session, recording, haptics, sensors, storage, camera, telephony, background, iOS-from-Windows CI)
