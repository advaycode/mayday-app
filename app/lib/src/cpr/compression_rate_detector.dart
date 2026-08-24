import 'dart:math' as math;

/// Estimates chest-compression RATE from accelerometer samples.
///
/// WHY RATE AND NOT DEPTH — this is a deliberate product decision, documented
/// in research/DECISIONS.md D3. Ruiz de Gauna et al. (PLOS ONE 2016,
/// doi:10.1371/journal.pone.0150139) measured accelerometer-only CPR feedback
/// against a photoelectric displacement reference and found rate error of
/// 0–1.7 compressions/min across three algorithms, but depth error of 1.3–3.4 mm
/// obtained only under laboratory conditions: a sensor bonded beneath the
/// rescuer's hands, a clean 100 Hz 16-bit signal, and a manikin on a rigid
/// surface. Depth by double integration is, in the authors' words, "inherently
/// unstable" — a baseline offset makes error grow quadratically with time.
///
/// None of those conditions hold for a phone held loosely against a real chest
/// on a mattress or a car seat. So Mayday measures rate, coaches depth by
/// instruction only, and never shows a depth number. Telling a bystander their
/// compressions are deep enough when they are not is the failure this avoids.
///
/// The estimator is autocorrelation over a sliding window rather than double
/// integration: it has no integration constant to drift, and it degrades to
/// "unknown" instead of to a plausible wrong number.
class CompressionRateDetector {
  CompressionRateDetector({
    this.windowSeconds = 4.0,
    this.minRateCpm = 60,
    this.maxRateCpm = 160,
    this.minSampleRateHz = 25.0,
    this.minConfidence = 0.35,
  });

  /// Analysis window. Long enough for ~7 compressions at 110 cpm, short enough
  /// that corrective feedback still feels immediate.
  final double windowSeconds;

  final int minRateCpm;
  final int maxRateCpm;

  /// Below this achieved sampling rate the estimate is refused outright.
  ///
  /// Compressions at 120 cpm are 2 Hz. Nyquist alone says >4 Hz, but robust
  /// peak timing needs far more headroom, and `sensors_plus` warns that on
  /// Android "it is not guaranteed that events from sensors will arrive with
  /// specified sampling rate" — the platform default (SENSOR_DELAY_NORMAL) is
  /// about 5 Hz, which is useless here. So the detector measures its OWN
  /// achieved rate and switches itself off rather than reporting nonsense.
  final double minSampleRateHz;

  /// Normalised autocorrelation peak below which we report no estimate.
  final double minConfidence;

  final List<double> _times = [];
  final List<double> _x = [];
  final List<double> _y = [];
  final List<double> _z = [];

  double _mean = 0;

  /// Feed one sample. [t] is seconds since the stream started (monotonic).
  /// [x], [y], [z] are user acceleration with gravity already removed by the
  /// platform (`userAccelerometerEventStream`).
  ///
  /// The three axes are kept separately and the estimator later works on the
  /// SIGNED value of whichever axis carries the motion. Using the vector
  /// magnitude instead would be a subtle and serious bug: compressions are an
  /// oscillation about zero, and |A sin(wt)| has half the period of A sin(wt),
  /// so a magnitude-based estimator reports roughly double the true rate — a
  /// wrong number that looks entirely plausible.
  void add(double t, double x, double y, double z) {
    _times.add(t);
    _x.add(x);
    _y.add(y);
    _z.add(z);

    final cutoff = t - windowSeconds;
    var drop = 0;
    while (drop < _times.length && _times[drop] < cutoff) {
      drop++;
    }
    if (drop > 0) {
      _times.removeRange(0, drop);
      _x.removeRange(0, drop);
      _y.removeRange(0, drop);
      _z.removeRange(0, drop);
    }
  }

  void reset() {
    _times.clear();
    _x.clear();
    _y.clear();
    _z.clear();
    _mean = 0;
  }

  static double _variance(List<double> v) {
    if (v.length < 2) return 0;
    final mean = v.reduce((a, b) => a + b) / v.length;
    var acc = 0.0;
    for (final s in v) {
      final d = s - mean;
      acc += d * d;
    }
    return acc / v.length;
  }

  /// The axis carrying the compression motion. The phone's orientation in the
  /// rescuer's hand is unknown and changes between rescuers, so the axis is
  /// chosen by variance each time rather than assumed to be z.
  List<double> _dominantAxis() {
    final vx = _variance(_x);
    final vy = _variance(_y);
    final vz = _variance(_z);
    if (vx >= vy && vx >= vz) return _x;
    if (vy >= vz) return _y;
    return _z;
  }

  int get sampleCount => _times.length;

  /// Samples per second actually achieved over the current window.
  double get achievedSampleRateHz {
    if (_times.length < 2) return 0;
    final span = _times.last - _times.first;
    if (span <= 0) return 0;
    return (_times.length - 1) / span;
  }

  /// Current estimate, or null when the signal will not support one.
  CompressionRate? estimate() {
    final n = _times.length;
    if (n < 16) return null;

    final span = _times.last - _times.first;
    if (span < windowSeconds * 0.6) return null;

    final fs = achievedSampleRateHz;
    if (fs < minSampleRateHz) {
      return CompressionRate.unavailable(
        reason: RateUnavailableReason.sampleRateTooLow,
        achievedSampleRateHz: fs,
      );
    }

    // Resample onto a uniform grid. Platform sensor delivery is jittery, and
    // autocorrelation assumes even spacing.
    final grid = _resample(fs, _dominantAxis());
    if (grid.length < 16) return null;

    // Remove DC so the autocorrelation measures oscillation, not offset.
    _mean = grid.reduce((a, b) => a + b) / grid.length;
    final centred = [for (final v in grid) v - _mean];

    final energy = centred.fold<double>(0, (a, v) => a + v * v);
    if (energy <= 1e-6) {
      return CompressionRate.unavailable(
        reason: RateUnavailableReason.noMotion,
        achievedSampleRateHz: fs,
      );
    }

    // Lag bounds from the plausible compression-rate band.
    final minLag = math.max(1, (fs * 60 / maxRateCpm).floor());
    final maxLag = math.min(centred.length - 1, (fs * 60 / minRateCpm).ceil());
    if (maxLag <= minLag) return null;

    // Autocorrelation across the candidate lag range.
    final ac = List<double>.filled(maxLag + 1, 0);
    var bestValue = -double.infinity;
    for (var lag = minLag; lag <= maxLag; lag++) {
      var sum = 0.0;
      final limit = centred.length - lag;
      for (var i = 0; i < limit; i++) {
        sum += centred[i] * centred[i + lag];
      }
      // Normalise by overlap so long lags are not penalised for having fewer
      // terms — otherwise the estimator is biased toward fast rates.
      final normalised = sum / limit;
      ac[lag] = normalised;
      if (normalised > bestValue) bestValue = normalised;
    }
    if (bestValue <= 0) {
      return CompressionRate.unavailable(
        reason: RateUnavailableReason.lowConfidence,
        achievedSampleRateHz: fs,
      );
    }

    // OCTAVE-ERROR GUARD. A periodic signal autocorrelates just as strongly at
    // twice its period as at its period — for a pure sinusoid R(2T) == R(T) —
    // so taking the global maximum can silently report HALF the true rate. That
    // is the worst possible failure here: it would tell a rescuer compressing
    // correctly at 118 that they are at 59 and to push faster.
    //
    // Standard pitch-detection practice, and what we do: take the SHORTEST lag
    // whose peak is within a tolerance of the global maximum, rather than the
    // tallest peak.
    const acceptFraction = 0.85;
    final threshold = bestValue * acceptFraction;
    var bestLag = -1;
    for (var lag = minLag; lag <= maxLag; lag++) {
      if (ac[lag] < threshold) continue;
      final risingInto = lag == minLag || ac[lag] >= ac[lag - 1];
      final fallingOut = lag == maxLag || ac[lag] >= ac[lag + 1];
      if (risingInto && fallingOut) {
        bestLag = lag;
        break;
      }
    }
    if (bestLag < 0) return null;
    bestValue = ac[bestLag];

    final r0 = energy / centred.length;
    final confidence = r0 > 0 ? (bestValue / r0).clamp(-1.0, 1.0) : 0.0;
    if (confidence < minConfidence) {
      return CompressionRate.unavailable(
        reason: RateUnavailableReason.lowConfidence,
        achievedSampleRateHz: fs,
        confidence: confidence.toDouble(),
      );
    }

    // Parabolic interpolation around the peak for sub-sample lag resolution.
    final refinedLag = _refinePeak(centred, bestLag, minLag, maxLag);
    final cpm = 60.0 * fs / refinedLag;

    return CompressionRate(
      cpm: cpm,
      confidence: confidence.toDouble(),
      achievedSampleRateHz: fs,
    );
  }

  List<double> _resample(double fs, List<double> values) {
    final dt = 1 / fs;
    final start = _times.first;
    final end = _times.last;
    final out = <double>[];
    var j = 0;
    for (var t = start; t <= end; t += dt) {
      while (j < _times.length - 2 && _times[j + 1] < t) {
        j++;
      }
      final t0 = _times[j];
      final t1 = _times[j + 1];
      final v0 = values[j];
      final v1 = values[j + 1];
      final denom = (t1 - t0);
      final frac = denom.abs() < 1e-9 ? 0.0 : ((t - t0) / denom).clamp(0.0, 1.0);
      out.add(v0 + (v1 - v0) * frac);
    }
    return out;
  }

  double _refinePeak(List<double> x, int lag, int minLag, int maxLag) {
    if (lag <= minLag || lag >= maxLag) return lag.toDouble();
    double ac(int l) {
      var sum = 0.0;
      final limit = x.length - l;
      for (var i = 0; i < limit; i++) {
        sum += x[i] * x[i + l];
      }
      return sum / limit;
    }

    final ym1 = ac(lag - 1);
    final y0 = ac(lag);
    final yp1 = ac(lag + 1);
    final denom = (ym1 - 2 * y0 + yp1);
    if (denom.abs() < 1e-12) return lag.toDouble();
    final delta = 0.5 * (ym1 - yp1) / denom;
    // A true parabolic vertex sits within half a sample of the peak bin.
    // Anything larger means the neighbourhood is not parabolic, so refining
    // would move us off the peak rather than onto it.
    if (delta.abs() > 0.5) return lag.toDouble();
    return lag + delta;
  }
}

enum RateUnavailableReason { sampleRateTooLow, noMotion, lowConfidence }

class CompressionRate {
  const CompressionRate({
    required this.cpm,
    required this.confidence,
    required this.achievedSampleRateHz,
  }) : unavailableReason = null;

  const CompressionRate.unavailable({
    required RateUnavailableReason reason,
    required this.achievedSampleRateHz,
    this.confidence = 0,
  })  : cpm = null,
        unavailableReason = reason;

  final double? cpm;
  final double confidence;
  final double achievedSampleRateHz;
  final RateUnavailableReason? unavailableReason;

  bool get isAvailable => cpm != null;

  /// The coaching verdict against the guideline band. Deliberately only three
  /// states — a panicking rescuer cannot act on more nuance than this.
  RateVerdict verdict({required int min, required int max}) {
    final r = cpm;
    if (r == null) return RateVerdict.unknown;
    if (r < min) return RateVerdict.tooSlow;
    if (r > max) return RateVerdict.tooFast;
    return RateVerdict.good;
  }
}

enum RateVerdict { tooSlow, good, tooFast, unknown }

extension RateVerdictCoaching on RateVerdict {
  /// What the coach actually says. Imperative, two words where possible, and
  /// never a number — a rescuer cannot act on "you are at 94 compressions per
  /// minute" but can act on "faster".
  String? get spoken => switch (this) {
        RateVerdict.tooSlow => 'Faster',
        RateVerdict.tooFast => 'Slow down',
        RateVerdict.good => null,
        RateVerdict.unknown => null,
      };

  String get label => switch (this) {
        RateVerdict.tooSlow => 'FASTER',
        RateVerdict.tooFast => 'SLOW DOWN',
        RateVerdict.good => 'GOOD RATE',
        RateVerdict.unknown => 'FOLLOW THE BEAT',
      };
}
