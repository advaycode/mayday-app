import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/cpr/compression_rate_detector.dart';

/// Feeds a synthetic compression signal: a sinusoid on one axis at [cpm],
/// sampled at [sampleRateHz], optionally with timing jitter and noise.
void feed(
  CompressionRateDetector d, {
  required double cpm,
  required double sampleRateHz,
  double seconds = 6,
  double amplitude = 6,
  double noise = 0,
  double jitterFraction = 0,
  int axis = 2,
  int seed = 7,
}) {
  final rng = math.Random(seed);
  final freq = cpm / 60.0;
  final dt = 1 / sampleRateHz;
  var t = 0.0;
  while (t < seconds) {
    final v = amplitude * math.sin(2 * math.pi * freq * t) +
        (noise > 0 ? (rng.nextDouble() - 0.5) * 2 * noise : 0);
    final x = axis == 0 ? v : 0.0;
    final y = axis == 1 ? v : 0.0;
    final z = axis == 2 ? v : 0.0;
    d.add(t, x, y, z);
    final step = jitterFraction > 0
        ? dt * (1 + (rng.nextDouble() - 0.5) * 2 * jitterFraction)
        : dt;
    t += step;
  }
}

void main() {
  group('CompressionRateDetector', () {
    test('recovers a clean 110 cpm signal', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 60);
      final r = d.estimate()!;
      expect(r.isAvailable, isTrue);
      expect(r.cpm, closeTo(110, 3));
      expect(r.verdict(min: 100, max: 120), RateVerdict.good);
    });

    test('does NOT double the rate — the magnitude trap', () {
      // Compressions oscillate about zero. An estimator built on the vector
      // magnitude would see |sin| and report ~220 cpm here. Guard the fix.
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 60);
      expect(d.estimate()!.cpm, lessThan(150));
    });

    test('flags a rate that is too slow', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 78, sampleRateHz: 60);
      final r = d.estimate()!;
      expect(r.cpm, closeTo(78, 4));
      expect(r.verdict(min: 100, max: 120), RateVerdict.tooSlow);
      expect(r.verdict(min: 100, max: 120).spoken, 'Faster');
    });

    test('flags a rate that is too fast', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 140, sampleRateHz: 60);
      final r = d.estimate()!;
      expect(r.cpm, closeTo(140, 5));
      expect(r.verdict(min: 100, max: 120), RateVerdict.tooFast);
      expect(r.verdict(min: 100, max: 120).spoken, 'Slow down');
    });

    test('finds the signal on any axis', () {
      for (final axis in [0, 1, 2]) {
        final d = CompressionRateDetector();
        feed(d, cpm: 110, sampleRateHz: 60, axis: axis);
        expect(d.estimate()!.cpm, closeTo(110, 4), reason: 'axis $axis');
      }
    });

    test('survives sensor jitter and noise', () {
      final d = CompressionRateDetector();
      feed(d,
          cpm: 112,
          sampleRateHz: 55,
          jitterFraction: 0.35,
          noise: 1.5);
      final r = d.estimate()!;
      expect(r.isAvailable, isTrue);
      expect(r.cpm, closeTo(112, 6));
    });

    test('refuses to report when the sample rate is too low', () {
      // Android's default SENSOR_DELAY_NORMAL is around 5 Hz. Reporting a
      // number from that would be worse than reporting nothing.
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 8, seconds: 8);
      final r = d.estimate()!;
      expect(r.isAvailable, isFalse);
      expect(r.unavailableReason, RateUnavailableReason.sampleRateTooLow);
      expect(r.verdict(min: 100, max: 120), RateVerdict.unknown);
    });

    test('reports no motion when the phone is still', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 60, amplitude: 0, noise: 0);
      final r = d.estimate()!;
      expect(r.isAvailable, isFalse);
      expect(r.unavailableReason, RateUnavailableReason.noMotion);
    });

    test('rejects pure noise rather than inventing a rate', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 60, amplitude: 0, noise: 4);
      final r = d.estimate()!;
      expect(r.isAvailable, isFalse,
          reason: 'random shaking must not produce a confident rate');
    });

    test('measures its own achieved sample rate', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 50);
      expect(d.achievedSampleRateHz, closeTo(50, 3));
    });

    test('returns null before it has enough data', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 110, sampleRateHz: 60, seconds: 0.2);
      expect(d.estimate(), isNull);
    });

    test('never reports the subharmonic across the whole plausible range', () {
      // Regression: autocorrelation peaks as strongly at 2T as at T, so the
      // naive global-maximum pick reported half the true rate (118 -> 59).
      // Halving is the most dangerous possible error — it tells a rescuer who
      // is compressing correctly to speed up.
      for (var cpm = 70; cpm <= 150; cpm += 2) {
        final d = CompressionRateDetector();
        feed(d, cpm: cpm.toDouble(), sampleRateHz: 60, seconds: 6);
        final r = d.estimate()!;
        expect(r.isAvailable, isTrue, reason: '$cpm cpm');
        expect(r.cpm, closeTo(cpm.toDouble(), 5), reason: '$cpm cpm');
      }
    });

    test('tracks a rate change after reset', () {
      final d = CompressionRateDetector();
      feed(d, cpm: 90, sampleRateHz: 60);
      expect(d.estimate()!.cpm, closeTo(90, 4));
      d.reset();
      feed(d, cpm: 118, sampleRateHz: 60);
      expect(d.estimate()!.cpm, closeTo(118, 4));
    });
  });
}
