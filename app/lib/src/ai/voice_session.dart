import 'dart:async';

import 'package:flutter/foundation.dart';

import 'advisor.dart';
import 'speech.dart';

enum VoiceState {
  idle,

  /// The microphone is open.
  listening,

  /// A final transcript is being answered. Sub-millisecond in practice — the
  /// state exists so the UI never shows a stale answer next to a new question.
  thinking,

  /// Mayday is talking.
  speaking,

  /// The microphone is unavailable. Announced, never silent. See
  /// [MicAvailability].
  deaf,
}

enum Speakerphone { user, mayday }

class VoiceTurn {
  const VoiceTurn({
    required this.who,
    required this.text,
    required this.at,
    this.guidance,
  });

  final Speakerphone who;
  final String text;
  final Duration at;
  final Guidance? guidance;
}

/// The conversation. Owns turn-taking between the recogniser, the advisor and
/// the synthesiser, and owns the one piece of etiquette that decides whether
/// talking to this thing feels alive or infuriating: barge-in. The moment the
/// user starts speaking, Mayday stops. Nobody in an emergency should have to
/// wait politely for a phone to finish a sentence.
class VoiceSession extends ChangeNotifier {
  VoiceSession({
    required this.advisor,
    required this.recognizer,
    required this.speaker,
    Stopwatch? clock,
  }) : _clock = clock ?? Stopwatch() {
    _clock.start();
  }

  final Advisor advisor;
  final SpeechRecognizer recognizer;
  final Speaker speaker;
  final Stopwatch _clock;

  StreamSubscription<SpeechFragment>? _fragments;
  StreamSubscription<MicAvailability>? _availability;
  StreamSubscription<bool>? _speaking;

  final List<VoiceTurn> _transcript = [];
  VoiceState _state = VoiceState.idle;
  String _partial = '';
  Guidance? _latest;
  MicAvailability _mic = MicAvailability.unknown;
  MicAvailability? _announced;

  VoiceState get state => _state;
  String get partial => _partial;
  Guidance? get latest => _latest;
  MicAvailability get mic => _mic;
  List<VoiceTurn> get transcript => List.unmodifiable(_transcript);

  /// Fired when the user's question resolves to a protocol they should start.
  /// The session never navigates by itself — a voice match opens a screen only
  /// because the UI decided to act on this, and for a low-confidence match the
  /// UI asks first.
  void Function(Guidance guidance)? onProtocolSuggested;

  /// Where a completed transcript goes. Null means straight to the advisor,
  /// which is what the "ask me anything" screen wants. A running incident
  /// installs its own handler so that a sentence is checked against the command
  /// grammar before it is treated as a question — see [IncidentVoiceController].
  Future<void> Function(String utterance)? onFinalUtterance;

  Future<void> initialize() async {
    await speaker.initialize();
    _mic = await recognizer.initialize();

    _fragments = recognizer.fragments.listen(_onFragment);
    _availability = recognizer.availabilityChanges.listen(_onAvailability);
    _speaking = speaker.speakingChanges.listen((speaking) {
      if (!speaking && _state == VoiceState.speaking) {
        _setState(recognizer.isListening ? VoiceState.listening : VoiceState.idle);
      }
    });

    _applyAvailability(_mic, announce: false);
    notifyListeners();
  }

  Future<void> startListening() async {
    if (!_mic.canListen) {
      await _announce(_mic);
      return;
    }
    _partial = '';
    _setState(VoiceState.listening);
    await recognizer.listen();
  }

  Future<void> stopListening() async {
    await recognizer.stop();
    if (_state == VoiceState.listening) _setState(VoiceState.idle);
  }

  void _onFragment(SpeechFragment fragment) {
    // Barge-in. The user has started talking, so stop talking over them.
    if (speaker.isSpeaking) unawaited(speaker.stop());

    if (!fragment.isFinal) {
      _partial = fragment.text;
      if (_state != VoiceState.listening) _setState(VoiceState.listening);
      notifyListeners();
      return;
    }

    _partial = '';
    final handler = onFinalUtterance;
    unawaited(handler == null ? ask(fragment.text) : handler(fragment.text));
  }

  /// Answer one utterance. Exposed directly so the whole conversation can be
  /// driven from a test, and from the on-screen text field used when the
  /// microphone is unavailable — the two paths are identical below this line.
  Future<Guidance> ask(String utterance) async {
    _setState(VoiceState.thinking);
    _record(Speakerphone.user, utterance);

    final guidance = advisor.advise(utterance);
    _latest = guidance;
    _record(Speakerphone.mayday, guidance.display, guidance: guidance);

    await _say(guidance.speech, priority: SpeechPriority.interrupt);

    if (guidance.offersProtocol) onProtocolSuggested?.call(guidance);
    return guidance;
  }

  /// Speak an authored line that did not come from a question — a protocol step
  /// on entry, or a rescuer-swap prompt.
  Future<void> announceStep(String speech) =>
      _say(speech, priority: SpeechPriority.interrupt);

  Future<void> _say(String text,
      {SpeechPriority priority = SpeechPriority.queued}) async {
    if (text.trim().isEmpty) {
      _setState(recognizer.isListening ? VoiceState.listening : VoiceState.idle);
      return;
    }
    _setState(VoiceState.speaking);
    await speaker.speak(text, priority: priority);
    if (_state == VoiceState.speaking && !speaker.isSpeaking) {
      _setState(recognizer.isListening ? VoiceState.listening : VoiceState.idle);
    }
  }

  void _onAvailability(MicAvailability availability) =>
      _applyAvailability(availability, announce: true);

  void _applyAvailability(MicAvailability availability, {required bool announce}) {
    final changed = availability != _mic;
    _mic = availability;

    if (!availability.canListen) {
      _setState(VoiceState.deaf);
      if (announce && changed) unawaited(_announce(availability));
    } else if (_state == VoiceState.deaf) {
      _announced = null;
      _setState(VoiceState.idle);
    }
    notifyListeners();
  }

  /// Say the handover out loud, once per transition. Repeating it every few
  /// seconds would be worse than silence.
  Future<void> _announce(MicAvailability availability) async {
    final message = availability.announcement;
    if (message == null || _announced == availability) return;
    _announced = availability;
    _record(Speakerphone.mayday, message);
    await speaker.speak(message, priority: SpeechPriority.interrupt);
  }

  void _record(Speakerphone who, String text, {Guidance? guidance}) {
    _transcript.add(VoiceTurn(
      who: who,
      text: text,
      at: _clock.elapsed,
      guidance: guidance,
    ));
    notifyListeners();
  }

  void _setState(VoiceState state) {
    if (_state == state) return;
    _state = state;
    notifyListeners();
  }

  @override
  void dispose() {
    _fragments?.cancel();
    _availability?.cancel();
    _speaking?.cancel();
    recognizer.dispose();
    speaker.dispose();
    _clock.stop();
    super.dispose();
  }
}
