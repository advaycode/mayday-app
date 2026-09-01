import 'dart:async';
import 'dart:io';

import 'package:mayday/src/ai/advisor.dart';
import 'package:mayday/src/ai/knowledge.dart';
import 'package:mayday/src/ai/speech.dart';
import 'package:mayday/src/data/protocol_repository.dart';

/// Reads the bundled corpus and knowledge packs straight off disk, so the AI
/// tests need neither a Flutter binding nor an asset bundle.
Future<ProtocolRepository> loadRepository() =>
    ProtocolRepository.load(loader: (path) => File(path).readAsString());

Future<KnowledgeBase> loadKnowledge() =>
    KnowledgeBase.load(loader: (path) => File(path).readAsString());

Future<Advisor> loadAdvisor() async => Advisor.build(
      knowledge: await loadKnowledge(),
      repository: await loadRepository(),
    );

/// A microphone under test control.
class FakeRecognizer implements SpeechRecognizer {
  FakeRecognizer([this._availability = MicAvailability.available]);

  MicAvailability _availability;
  bool _listening = false;

  final _availabilityController = StreamController<MicAvailability>.broadcast();
  final _fragmentController = StreamController<SpeechFragment>.broadcast();

  int listenCalls = 0;
  int stopCalls = 0;

  @override
  MicAvailability get availability => _availability;

  @override
  Stream<MicAvailability> get availabilityChanges =>
      _availabilityController.stream;

  @override
  Stream<SpeechFragment> get fragments => _fragmentController.stream;

  @override
  bool get isListening => _listening;

  @override
  Future<MicAvailability> initialize() async => _availability;

  @override
  Future<void> listen() async {
    listenCalls++;
    _listening = true;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
    _listening = false;
  }

  /// Deliver a partial or final transcript, as the platform would.
  Future<void> hear(String text, {bool isFinal = true}) async {
    _fragmentController.add(SpeechFragment(text: text, isFinal: isFinal));
    // Let the session's listener run.
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
  }

  /// Simulate a call going up, or the permission being revoked.
  Future<void> setAvailability(MicAvailability availability) async {
    _availability = availability;
    _availabilityController.add(availability);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
  }

  @override
  Future<void> dispose() async {
    await _availabilityController.close();
    await _fragmentController.close();
  }
}

/// A voice that records instead of speaking.
class FakeSpeaker implements Speaker {
  final List<String> spoken = [];
  final List<SpeechPriority> priorities = [];
  int stopCalls = 0;

  bool _speaking = false;
  final _speakingController = StreamController<bool>.broadcast();

  /// When true, [speak] leaves [isSpeaking] set so barge-in can be tested.
  bool holdOpen = false;

  @override
  bool get isAvailable => true;

  @override
  bool get isSpeaking => _speaking;

  @override
  Stream<bool> get speakingChanges => _speakingController.stream;

  @override
  Future<bool> initialize() async => true;

  @override
  Future<void> speak(String text,
      {SpeechPriority priority = SpeechPriority.queued}) async {
    spoken.add(text);
    priorities.add(priority);
    _speaking = holdOpen;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
    _speaking = false;
  }

  @override
  Future<void> dispose() async {
    await _speakingController.close();
  }
}
