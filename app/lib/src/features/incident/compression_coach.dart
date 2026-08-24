import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../../cpr/compression_rate_detector.dart';
import '../../cpr/metronome.dart';
import '../../design/tokens.dart';
import '../../domain/protocol.dart';

/// The compression coach: metronome, live rate feedback, swap timer.
///
/// The pulsing ring is the only animation in the entire app. It is information,
/// not decoration — it is the beat the rescuer is matching.
class CompressionCoach extends StatefulWidget {
  const CompressionCoach({
    super.key,
    required this.step,
    required this.onAdvance,
    required this.onSwapPrompt,
    required this.onStarted,
  });

  final ProtocolStep step;
  final VoidCallback onAdvance;
  final VoidCallback onSwapPrompt;
  final VoidCallback onStarted;

  @override
  State<CompressionCoach> createState() => _CompressionCoachState();
}

class _CompressionCoachState extends State<CompressionCoach>
    with SingleTickerProviderStateMixin {
  late final Metronome _metronome;
  late final AnimationController _pulse;
  final CompressionRateDetector _detector = CompressionRateDetector();
  final Stopwatch _sensorClock = Stopwatch();

  StreamSubscription<UserAccelerometerEvent>? _accel;
  Timer? _uiTimer;

  int _beats = 0;
  CompressionRate? _rate;
  bool _sensorAvailable = true;
  String? _sensorError;
  bool _swapPrompted = false;

  int get _targetBpm => widget.step.targetRateBpm ?? 110;
  int get _minRate => widget.step.acceptableRateMin ?? 100;
  int get _maxRate => widget.step.acceptableRateMax ?? 120;
  int get _swapSeconds => widget.step.swapIntervalSeconds ?? 120;

  @override
  void initState() {
    super.initState();
    widget.onStarted();

    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 130),
    );

    _metronome = Metronome(
      bpm: _targetBpm,
      onBeat: _onBeat,
    )..start();

    _startSensors();

    // The readout updates on its own cadence, decoupled from the beat, so the
    // numbers do not flicker in time with the pulse.
    _uiTimer = Timer.periodic(const Duration(milliseconds: 400), (_) {
      if (!mounted) return;
      setState(() => _rate = _detector.estimate());
      _checkSwap();
    });
  }

  void _onBeat(int beat, Duration scheduledAt) {
    _beats = beat + 1;
    // Haptic on the beat so the rescuer can keep tempo without looking. This is
    // also the fallback channel when the phone is face-down on the ground.
    HapticFeedback.lightImpact();
    if (mounted) {
      _pulse.forward(from: 0);
      setState(() {});
    }
  }

  Future<void> _startSensors() async {
    _sensorClock.start();
    try {
      // The platform default on Android is SENSOR_DELAY_NORMAL, roughly 5 Hz,
      // which cannot resolve 2 Hz compressions. Ask for a fast rate explicitly.
      // sensors_plus warns the request is not guaranteed to be honoured, which
      // is why CompressionRateDetector measures its own achieved rate and
      // refuses to report below 25 Hz.
      _accel = userAccelerometerEventStream(
        samplingPeriod: SensorInterval.gameInterval,
      ).listen(
        (e) {
          final t = _sensorClock.elapsedMicroseconds / 1e6;
          _detector.add(t, e.x, e.y, e.z);
        },
        onError: (Object err) {
          if (!mounted) return;
          setState(() {
            _sensorAvailable = false;
            _sensorError = 'No motion sensor on this device';
          });
        },
        cancelOnError: true,
      );
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _sensorAvailable = false;
        _sensorError = 'No motion sensor on this device';
      });
    }
  }

  void _checkSwap() {
    if (_swapPrompted) return;
    if (_metronome.elapsed.inSeconds >= _swapSeconds) {
      _swapPrompted = true;
      HapticFeedback.heavyImpact();
      widget.onSwapPrompt();
      setState(() {});
    }
  }

  @override
  void dispose() {
    // sensors_plus issue #3955 is a teardown crash when stream handlers outlive
    // the engine. Cancel explicitly, do not rely on GC.
    _accel?.cancel();
    _uiTimer?.cancel();
    _metronome.dispose();
    _pulse.dispose();
    _sensorClock.stop();
    super.dispose();
  }

  RateVerdict get _verdict =>
      _rate?.verdict(min: _minRate, max: _maxRate) ?? RateVerdict.unknown;

  @override
  Widget build(BuildContext context) {
    final elapsed = _metronome.elapsed;
    final mm = elapsed.inMinutes.toString().padLeft(2, '0');
    final ss = (elapsed.inSeconds % 60).toString().padLeft(2, '0');

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onAdvance,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_swapPrompted) const _SwapBanner(),
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (context, _) {
                    final t = Curves.easeOut.transform(_pulse.value);
                    return CustomPaint(
                      size: Size.infinite,
                      painter: _BeatPainter(intensity: 1 - t),
                    );
                  },
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('PUSH', style: MType.instruction.copyWith(fontSize: 72)),
                    const SizedBox(height: MSpace.tight),
                    Text(
                      widget.step.depthCoaching ??
                          'Hard and fast. Let the chest come all the way up.',
                      textAlign: TextAlign.center,
                      style: MType.detail,
                    ),
                  ],
                ),
              ],
            ),
          ),
          _RateReadout(
            verdict: _verdict,
            rate: _rate,
            sensorAvailable: _sensorAvailable,
            sensorError: _sensorError,
            targetBpm: _targetBpm,
          ),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: MSpace.gutter, vertical: MSpace.gap),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: MColor.rule)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _Stat(label: 'ELAPSED', value: '$mm:$ss'),
                _Stat(label: 'COMPRESSIONS', value: '$_beats'),
                _Stat(label: 'TARGET', value: '$_targetBpm'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: MType.label),
        const SizedBox(height: 2),
        Text(value, style: MType.numeric.copyWith(fontSize: 32)),
      ],
    );
  }
}

class _SwapBanner extends StatelessWidget {
  const _SwapBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: MColor.signal,
      padding: const EdgeInsets.symmetric(
          horizontal: MSpace.gutter, vertical: MSpace.gap),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('SWAP RESCUERS', style: MType.instructionSmall.copyWith(fontSize: 28)),
          Text('Two minutes. Change over in under 10 seconds.',
              style: MType.detail.copyWith(color: Colors.white70)),
        ],
      ),
    );
  }
}

class _RateReadout extends StatelessWidget {
  const _RateReadout({
    required this.verdict,
    required this.rate,
    required this.sensorAvailable,
    required this.sensorError,
    required this.targetBpm,
  });

  final RateVerdict verdict;
  final CompressionRate? rate;
  final bool sensorAvailable;
  final String? sensorError;
  final int targetBpm;

  @override
  Widget build(BuildContext context) {
    final Color accent = switch (verdict) {
      RateVerdict.good => MColor.good,
      RateVerdict.tooSlow || RateVerdict.tooFast => MColor.warn,
      RateVerdict.unknown => MColor.textFaint,
    };

    final String message;
    if (!sensorAvailable) {
      message = sensorError ?? 'Follow the beat';
    } else if (rate?.unavailableReason ==
        RateUnavailableReason.sampleRateTooLow) {
      // Being explicit beats silently pretending to measure.
      message = 'Rate check off — sensor too slow on this device';
    } else {
      message = verdict.label;
    }

    return Semantics(
      liveRegion: true,
      label: message,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
            horizontal: MSpace.gutter, vertical: MSpace.gap),
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: MColor.rule)),
        ),
        child: Row(
          children: [
            // Meaning is carried by the word and by position, not by hue alone.
            Container(width: 4, height: 34, color: accent),
            const SizedBox(width: MSpace.gap),
            Expanded(
              child: Text(message, style: MType.button.copyWith(color: accent)),
            ),
          ],
        ),
      ),
    );
  }
}

/// The beat pulse. A ring that flashes on each beat and decays — peripheral
/// vision picks it up without the rescuer having to focus on the screen.
class _BeatPainter extends CustomPainter {
  const _BeatPainter({required this.intensity});

  final double intensity;

  @override
  void paint(Canvas canvas, Size size) {
    if (intensity <= 0.01) return;
    final centre = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) * 0.42;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10 * intensity
      ..color = MColor.signal.withValues(alpha: intensity.clamp(0.0, 1.0));
    canvas.drawCircle(centre, radius, paint);
  }

  @override
  bool shouldRepaint(_BeatPainter oldDelegate) =>
      oldDelegate.intensity != intensity;
}
