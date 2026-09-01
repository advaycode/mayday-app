import 'dart:async';

/// Why the microphone can or cannot be used right now.
///
/// [silencedByCall] is the one that matters, and it is the finding that
/// reshaped this whole feature (research/DECISIONS.md D1): an ordinary app
/// cannot capture microphone audio while a cellular call is up, on either
/// platform. On Android `AudioRecord.startRecording()` *succeeds* during a call
/// and then delivers digital silence — no exception, no error code. A naive
/// implementation looks alive and is deaf, during a cardiac arrest.
///
/// So Mayday never assumes the microphone is working. It watches
/// `AudioRecordingConfiguration.isClientSilenced()` on Android 11+ and
/// `AVAudioSession.interruptionNotification` on iOS, folds both into this one
/// value, and when it turns to [silencedByCall] it *says so out loud* and hands
/// the user the touch path. Announced deafness is recoverable. Silent deafness
/// is not.
enum MicAvailability {
  /// Not asked yet.
  unknown,

  available,

  /// The user declined the microphone permission. Voice input is off; every
  /// other part of the app still works.
  deniedByUser,

  /// A call is active. The OS is feeding us silence.
  silencedByCall,

  /// No recogniser on this device or platform (this includes the web build
  /// used for screenshots).
  unsupported,
}

extension MicAvailabilityMessage on MicAvailability {
  /// What the user is told when the microphone goes away. Spoken, so the
  /// numbers are written the way they should be said.
  String? get announcement => switch (this) {
        MicAvailability.silencedByCall =>
          'I cannot hear you while you are on the call. Tap anywhere for the '
              'next step.',
        MicAvailability.deniedByUser =>
          'Microphone is off. Tap anywhere for the next step.',
        MicAvailability.unsupported =>
          'Voice is not available on this device. Tap anywhere for the next '
              'step.',
        _ => null,
      };

  String get label => switch (this) {
        MicAvailability.unknown => 'MIC — CHECKING',
        MicAvailability.available => 'MIC — LIVE',
        MicAvailability.deniedByUser => 'MIC — OFF',
        MicAvailability.silencedByCall => 'MIC — DEAF ON CALL',
        MicAvailability.unsupported => 'MIC — UNAVAILABLE',
      };

  bool get canListen => this == MicAvailability.available;
}

/// A piece of recognised speech. Partial results arrive as [isFinal] false and
/// are shown live, because seeing your own words appear is what tells a
/// panicking person the phone is listening.
class SpeechFragment {
  const SpeechFragment({
    required this.text,
    required this.isFinal,
    this.confidence = 1.0,
  });

  final String text;
  final bool isFinal;
  final double confidence;
}

/// Speech in. Implemented over the platform recogniser in
/// `platform_speech.dart`; faked in tests.
abstract interface class SpeechRecognizer {
  Future<MicAvailability> initialize();

  MicAvailability get availability;
  Stream<MicAvailability> get availabilityChanges;
  Stream<SpeechFragment> get fragments;

  bool get isListening;
  Future<void> listen();
  Future<void> stop();
  Future<void> dispose();
}

enum SpeechPriority {
  /// Queue behind whatever is being said.
  queued,

  /// Cut it off. Used when the user speaks over the assistant, and when a step
  /// changes underneath a sentence that is now stale.
  interrupt,
}

/// Speech out.
abstract interface class Speaker {
  Future<bool> initialize();
  bool get isAvailable;
  bool get isSpeaking;
  Stream<bool> get speakingChanges;

  Future<void> speak(String text, {SpeechPriority priority});
  Future<void> stop();
  Future<void> dispose();
}

/// A recogniser that never hears anything. Used on platforms with no speech
/// support, and any time the permission was refused — the app must behave
/// identically, minus the accelerator.
class NullRecognizer implements SpeechRecognizer {
  NullRecognizer([this._availability = MicAvailability.unsupported]);

  final MicAvailability _availability;
  final _availabilityController = StreamController<MicAvailability>.broadcast();
  final _fragmentController = StreamController<SpeechFragment>.broadcast();

  @override
  MicAvailability get availability => _availability;

  @override
  Stream<MicAvailability> get availabilityChanges =>
      _availabilityController.stream;

  @override
  Stream<SpeechFragment> get fragments => _fragmentController.stream;

  @override
  bool get isListening => false;

  @override
  Future<MicAvailability> initialize() async => _availability;

  @override
  Future<void> listen() async {}

  @override
  Future<void> stop() async {}

  @override
  Future<void> dispose() async {
    await _availabilityController.close();
    await _fragmentController.close();
  }
}

/// A speaker that says nothing but records what it was asked to say. The
/// recording is what the tests assert against, and it is also what the
/// diagnostics screen shows when text-to-speech is unavailable.
class NullSpeaker implements Speaker {
  final List<String> spoken = [];
  final _speakingController = StreamController<bool>.broadcast();

  @override
  bool get isAvailable => false;

  @override
  bool get isSpeaking => false;

  @override
  Stream<bool> get speakingChanges => _speakingController.stream;

  @override
  Future<bool> initialize() async => false;

  @override
  Future<void> speak(String text,
      {SpeechPriority priority = SpeechPriority.queued}) async {
    spoken.add(text);
  }

  @override
  Future<void> stop() async {}

  @override
  Future<void> dispose() async {
    await _speakingController.close();
  }
}
