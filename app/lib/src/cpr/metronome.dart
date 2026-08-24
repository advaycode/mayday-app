import 'dart:async';

/// A drift-corrected metronome.
///
/// The naive implementation — `Timer.periodic(Duration(milliseconds: 545))` —
/// drifts, and drift is the failure mode that matters here. Dart timers fire
/// *no earlier than* their duration but frequently later; GC pauses and frame
/// work push each tick out, and because `Timer.periodic` measures the next
/// interval from when the last one *fired*, that lateness accumulates. Over the
/// several minutes of a real resuscitation the beat walks away from 110 cpm.
///
/// This scheduler instead computes beat N's due time as `start + N * period`
/// from a single monotonic origin and schedules each timer for the *remaining*
/// delta. Lateness on one beat is absorbed rather than carried forward, so the
/// long-run average rate is exact.
///
/// AUDIO NOTE: this class drives the *logical* beat — UI pulse, haptics and
/// counters. It is not sample-accurate, because nothing scheduled on the Dart
/// event loop can be. Audible clicks should be scheduled ahead on the audio
/// engine's own clock (flutter_soloud `playScheduled` / `playClocked`), with
/// this ticker only topping up the schedule. See research/DECISIONS.md D4.
class Metronome {
  Metronome({
    required this.onBeat,
    int bpm = 110,
    this.lookaheadBeats = 8,
  })  : assert(bpm > 0),
        _bpm = bpm;

  /// Called on every beat with the 0-based beat index and its scheduled time
  /// relative to [start]. The scheduled time — not the wall clock at delivery —
  /// is what downstream audio scheduling should key off.
  final void Function(int beat, Duration scheduledAt) onBeat;

  /// How many beats ahead a real audio backend should be kept scheduled.
  final int lookaheadBeats;

  int _bpm;
  final Stopwatch _clock = Stopwatch();
  Timer? _timer;
  int _nextBeat = 0;
  bool _running = false;

  int get bpm => _bpm;
  bool get isRunning => _running;
  int get beatsElapsed => _nextBeat;
  Duration get elapsed => _clock.elapsed;

  Duration get period =>
      Duration(microseconds: (60 * 1000000 / _bpm).round());

  /// Scheduled time of beat [n], measured from [start]. Exact by construction.
  Duration beatTime(int n) =>
      Duration(microseconds: (n * 60 * 1000000 / _bpm).round());

  void start() {
    if (_running) return;
    _running = true;
    _nextBeat = 0;
    _clock
      ..reset()
      ..start();
    _scheduleNext();
  }

  void stop() {
    _running = false;
    _timer?.cancel();
    _timer = null;
    _clock.stop();
  }

  /// Change tempo without losing phase continuity: the beats already delivered
  /// stay delivered, and the origin is rebased so the next beat lands one new
  /// period after the last one rather than jumping.
  void setBpm(int bpm) {
    if (bpm <= 0 || bpm == _bpm) return;
    final wasRunning = _running;
    final lastBeatAt = _nextBeat > 0 ? beatTime(_nextBeat - 1) : Duration.zero;
    final sinceLastBeat = _clock.elapsed - lastBeatAt;
    _bpm = bpm;
    if (!wasRunning) return;
    _timer?.cancel();
    _clock
      ..reset()
      ..start();
    // Restart the origin at the last beat, preserving how far into the current
    // interval we already are.
    _nextBeat = 0;
    final remaining = period - sinceLastBeat;
    _timer = Timer(
      remaining.isNegative ? Duration.zero : remaining,
      _fire,
    );
  }

  void _scheduleNext() {
    if (!_running) return;
    final due = beatTime(_nextBeat);
    final delta = due - _clock.elapsed;
    _timer = Timer(delta.isNegative ? Duration.zero : delta, _fire);
  }

  void _fire() {
    if (!_running) return;
    final beat = _nextBeat;
    final scheduledAt = beatTime(beat);
    _nextBeat++;
    onBeat(beat, scheduledAt);
    _scheduleNext();
  }

  /// Beats that a lookahead audio scheduler should queue right now.
  List<Duration> pendingSchedule() => [
        for (var i = _nextBeat; i < _nextBeat + lookaheadBeats; i++)
          beatTime(i),
      ];

  void dispose() => stop();
}
