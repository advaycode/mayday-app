import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'call_state.dart';
import 'speech.dart';

/// The real microphone, wired to the platform recogniser.
///
/// Two decisions here are worth defending.
///
/// **On-device only.** [requireOnDevice] is true by default, so a listen that
/// cannot be served locally *fails* rather than quietly shipping a recording of
/// somebody's worst day to a speech API. Mayday claims to work with no signal
/// and to keep the incident on the phone; that claim has to be enforced
/// somewhere, and this is where. The app also ships without the INTERNET
/// permission, so the claim is checkable from the manifest.
///
/// **Deafness is detected, not assumed.** [CallStateMonitor] runs alongside the
/// recogniser, and a call going up flips [availability] to
/// [MicAvailability.silencedByCall] — which [VoiceSession] announces out loud
/// before handing over to the touch path.
class PlatformRecognizer implements SpeechRecognizer {
  PlatformRecognizer({
    SpeechToText? speech,
    CallStateMonitor? callState,
    this.requireOnDevice = true,
    this.pauseFor = const Duration(seconds: 2),
    this.listenFor = const Duration(seconds: 20),
    this.localeId,
  })  : _speech = speech ?? SpeechToText(),
        _callState = callState ?? CallStateMonitor();

  final SpeechToText _speech;
  final CallStateMonitor _callState;

  /// Refuse to fall back to network recognition. See the class comment.
  final bool requireOnDevice;
  final Duration pauseFor;
  final Duration listenFor;
  final String? localeId;

  final _availabilityController = StreamController<MicAvailability>.broadcast();
  final _fragmentController = StreamController<SpeechFragment>.broadcast();
  StreamSubscription<CallState>? _callSubscription;

  MicAvailability _availability = MicAvailability.unknown;
  MicAvailability _baseline = MicAvailability.unknown;
  bool _wantsToListen = false;

  @override
  MicAvailability get availability => _availability;

  @override
  Stream<MicAvailability> get availabilityChanges =>
      _availabilityController.stream;

  @override
  Stream<SpeechFragment> get fragments => _fragmentController.stream;

  @override
  bool get isListening => _speech.isListening;

  @override
  Future<MicAvailability> initialize() async {
    _callSubscription = _callState.changes.listen(_onCallState);
    _callState.start();

    bool ok;
    try {
      ok = await _speech.initialize(
        onError: _onError,
        onStatus: _onStatus,
        debugLogging: false,
      );
    } catch (_) {
      ok = false;
    }

    if (!ok) {
      _baseline = MicAvailability.unsupported;
    } else {
      final permitted = await _speech.hasPermission;
      _baseline =
          permitted ? MicAvailability.available : MicAvailability.deniedByUser;
    }

    _recompute();
    return _availability;
  }

  @override
  Future<void> listen() async {
    if (!_availability.canListen) return;
    _wantsToListen = true;
    try {
      await _speech.listen(
        onResult: _onResult,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          onDevice: requireOnDevice,
          cancelOnError: true,
          listenMode: ListenMode.dictation,
          pauseFor: pauseFor,
          listenFor: listenFor,
          localeId: localeId,
        ),
      );
    } catch (_) {
      // A refused listen must not take the incident with it. The touch path is
      // always there.
      _wantsToListen = false;
      _baseline = MicAvailability.unsupported;
      _recompute();
    }
  }

  @override
  Future<void> stop() async {
    _wantsToListen = false;
    try {
      await _speech.stop();
    } catch (_) {
      // Already stopped, or never started.
    }
  }

  void _onResult(SpeechRecognitionResult result) {
    if (_fragmentController.isClosed) return;
    _fragmentController.add(SpeechFragment(
      text: result.recognizedWords,
      isFinal: result.finalResult,
      confidence: result.confidence,
    ));
  }

  void _onStatus(String status) {
    if (status == SpeechToText.doneStatus ||
        status == SpeechToText.notListeningStatus) {
      _wantsToListen = false;
    }
  }

  void _onError(SpeechRecognitionError error) {
    // Map the platform's error vocabulary onto something a user can act on.
    // `error_busy` during a call is exactly the D1 failure, so the call monitor
    // gets the final say rather than the error string.
    switch (error.errorMsg) {
      case 'error_permission':
        _baseline = MicAvailability.deniedByUser;
      case 'error_language_not_supported':
      case 'error_language_unavailable':
        // on-device model missing for this locale
        _baseline = MicAvailability.unsupported;
      default:
        if (error.permanent && _callState.state != CallState.inCall) {
          _baseline = MicAvailability.unsupported;
        }
    }
    _recompute();
  }

  void _onCallState(CallState _) => _recompute();

  void _recompute() {
    final next = _callState.state == CallState.inCall
        ? MicAvailability.silencedByCall
        : _baseline;
    if (next == _availability) return;
    _availability = next;
    if (!_availabilityController.isClosed) _availabilityController.add(next);
    if (!next.canListen && _wantsToListen) unawaited(stop());
  }

  @override
  Future<void> dispose() async {
    await _callSubscription?.cancel();
    await _callState.dispose();
    await stop();
    await _availabilityController.close();
    await _fragmentController.close();
  }
}

/// The real voice, wired to the platform text-to-speech engine.
///
/// Rate is set below the default on purpose. Synthesised speech at normal
/// conversational speed is close to unusable for someone whose hearing has gone
/// narrow with adrenaline, and every line this app speaks is an instruction
/// somebody is about to act on.
class PlatformSpeaker implements Speaker {
  PlatformSpeaker({
    FlutterTts? tts,
    this.language = 'en-US',
    this.rate = 0.48,
    this.pitch = 1.0,
  }) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;
  final String language;
  final double rate;
  final double pitch;

  final _speakingController = StreamController<bool>.broadcast();
  bool _available = false;
  bool _speaking = false;

  @override
  bool get isAvailable => _available;

  @override
  bool get isSpeaking => _speaking;

  @override
  Stream<bool> get speakingChanges => _speakingController.stream;

  @override
  Future<bool> initialize() async {
    try {
      await _tts.setLanguage(language);
      await _tts.setSpeechRate(rate);
      await _tts.setPitch(pitch);
      await _tts.setVolume(1.0);
      // Makes speak() resolve when the utterance actually finishes, which is
      // what lets the session know when to go back to listening.
      await _tts.awaitSpeakCompletion(true);

      _tts.setStartHandler(() => _setSpeaking(true));
      _tts.setCompletionHandler(() => _setSpeaking(false));
      _tts.setCancelHandler(() => _setSpeaking(false));
      _tts.setErrorHandler((dynamic _) => _setSpeaking(false));

      _available = true;
    } catch (_) {
      _available = false;
    }
    return _available;
  }

  @override
  Future<void> speak(String text,
      {SpeechPriority priority = SpeechPriority.queued}) async {
    if (!_available || text.trim().isEmpty) return;
    if (priority == SpeechPriority.interrupt && _speaking) {
      await stop();
    }
    try {
      _setSpeaking(true);
      await _tts.speak(text);
    } catch (_) {
      // Losing the voice is survivable — the instruction is on the screen too.
    } finally {
      _setSpeaking(false);
    }
  }

  @override
  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {
      // Nothing was playing.
    }
    _setSpeaking(false);
  }

  void _setSpeaking(bool speaking) {
    if (_speaking == speaking) return;
    _speaking = speaking;
    if (!_speakingController.isClosed) _speakingController.add(speaking);
  }

  @override
  Future<void> dispose() async {
    await stop();
    await _speakingController.close();
  }
}

/// Builds the pair the app actually runs with, degrading to the null objects
/// rather than throwing when a platform has no speech support.
({SpeechRecognizer recognizer, Speaker speaker}) buildPlatformSpeech() {
  if (kIsWeb) {
    // The web target exists only for headless screenshots.
    return (recognizer: NullRecognizer(), speaker: NullSpeaker());
  }
  return (recognizer: PlatformRecognizer(), speaker: PlatformSpeaker());
}
