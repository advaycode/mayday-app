import 'dart:async';

import 'package:flutter/services.dart';

/// Is a phone call up right now?
///
/// This is the single most important question the voice layer asks, and the
/// reason is worth stating plainly: **an ordinary app cannot record audio while
/// a call is active, on either platform** (research/DECISIONS.md D1). On
/// Android the trap is that `AudioRecord.startRecording()` *succeeds* during a
/// call and then hands back digital silence — no exception, no error code. An
/// app that does not ask this question looks alive and is deaf, and it will be
/// deaf at the exact moment somebody is kneeling on a pavement counting on it.
///
/// So Mayday asks. On Android it reads `AudioManager.getMode()`, which is
/// `MODE_IN_CALL` or `MODE_IN_COMMUNICATION` for the duration of a cellular or
/// VoIP call and needs no permission at all — see
/// developer.android.com/media/platform/sharing-audio-input. When the answer is
/// yes, the voice layer says so out loud and hands the user the touch path.
///
/// iOS: the equivalent signal is `AVAudioSession.interruptionNotification`,
/// which fires while the phone is merely *ringing*. That side is not
/// implemented yet — [CallStateMonitor] reports [CallState.unknown] there, and
/// the recogniser's own error path is the current backstop. Listed in STATE.md.
enum CallState { unknown, idle, inCall }

/// Polls the platform for call state.
///
/// Polling rather than a native event stream is deliberate: one integer read
/// per second costs nothing, and it cannot get stuck in the wrong state the way
/// a missed event can. Getting stuck here means a phone that believes it can
/// hear and cannot.
class CallStateMonitor {
  CallStateMonitor({
    this.channel = const MethodChannel(channelName),
    this.interval = const Duration(seconds: 1),
  });

  static const String channelName = 'dev.advay.mayday/audio';

  final MethodChannel channel;
  final Duration interval;

  final _controller = StreamController<CallState>.broadcast();
  Timer? _timer;
  CallState _state = CallState.unknown;

  /// False once the platform has told us it has no implementation. Stops the
  /// polling so an unsupported platform costs one call, not one per second.
  bool _supported = true;

  CallState get state => _state;
  Stream<CallState> get changes => _controller.stream;
  bool get isSupported => _supported;

  Future<CallState> check() async {
    if (!_supported) return CallState.unknown;
    try {
      final active = await channel.invokeMethod<bool>('isCallActive');
      final next = active == null
          ? CallState.unknown
          : (active ? CallState.inCall : CallState.idle);
      _emit(next);
      return next;
    } on MissingPluginException {
      _supported = false;
      stop();
      _emit(CallState.unknown);
      return CallState.unknown;
    } on PlatformException {
      _emit(CallState.unknown);
      return CallState.unknown;
    }
  }

  void start() {
    if (_timer != null) return;
    unawaited(check());
    _timer = Timer.periodic(interval, (_) => unawaited(check()));
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  void _emit(CallState next) {
    if (next == _state) return;
    _state = next;
    if (!_controller.isClosed) _controller.add(next);
  }

  Future<void> dispose() async {
    stop();
    await _controller.close();
  }
}
