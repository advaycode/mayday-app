import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/cpr/metronome.dart';

void main() {
  group('Metronome scheduling', () {
    test('beat times are exact and do not accumulate error', () {
      final m = Metronome(bpm: 110, onBeat: (_, _) {});

      // Ten minutes of compressions. A Timer.periodic implementation would
      // have drifted by seconds; computing from a single origin cannot.
      const beats = 1100;
      final expectedMicros = (beats * 60 * 1000000 / 110).round();
      expect(m.beatTime(beats).inMicroseconds, expectedMicros);

      // The interval between consecutive late beats is still one period,
      // within rounding.
      final a = m.beatTime(999).inMicroseconds;
      final b = m.beatTime(1000).inMicroseconds;
      expect((b - a - m.period.inMicroseconds).abs(), lessThanOrEqualTo(1));
    });

    test('period matches the requested tempo', () {
      expect(Metronome(bpm: 100, onBeat: (_, _) {}).period.inMilliseconds, 600);
      expect(Metronome(bpm: 120, onBeat: (_, _) {}).period.inMilliseconds, 500);
      final m110 = Metronome(bpm: 110, onBeat: (_, _) {});
      expect(m110.period.inMicroseconds, closeTo(545454, 2));
    });

    test('delivers beats in order with their scheduled times', () async {
      final seen = <int>[];
      final stamps = <Duration>[];
      final m = Metronome(
        bpm: 600, // fast, so the test runs quickly
        onBeat: (beat, at) {
          seen.add(beat);
          stamps.add(at);
        },
      )..start();

      await Future<void>.delayed(const Duration(milliseconds: 350));
      m.stop();

      expect(seen.length, greaterThan(2));
      expect(seen, orderedEquals(List.generate(seen.length, (i) => i)));
      for (var i = 0; i < stamps.length; i++) {
        expect(stamps[i].inMicroseconds, m.beatTime(i).inMicroseconds);
      }
    });

    test('lookahead schedule is contiguous', () {
      final m = Metronome(bpm: 110, onBeat: (_, _) {}, lookaheadBeats: 4);
      final pending = m.pendingSchedule();
      expect(pending.length, 4);
      for (var i = 1; i < pending.length; i++) {
        final gap = pending[i] - pending[i - 1];
        expect((gap.inMicroseconds - m.period.inMicroseconds).abs(),
            lessThanOrEqualTo(1));
      }
    });

    test('stop halts delivery', () async {
      var count = 0;
      final m = Metronome(bpm: 600, onBeat: (_, _) => count++)..start();
      await Future<void>.delayed(const Duration(milliseconds: 250));
      m.stop();
      final atStop = count;
      await Future<void>.delayed(const Duration(milliseconds: 250));
      expect(count, atStop);
    });
  });
}
