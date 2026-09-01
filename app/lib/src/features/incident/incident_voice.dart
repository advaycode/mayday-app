import 'dart:async';

import '../../ai/advisor.dart';
import '../../ai/commands.dart';
import '../../ai/speech.dart';
import '../../ai/voice_session.dart';
import '../../engine/incident_engine.dart';

/// What a spoken command should do to the running incident. The screen supplies
/// these; the controller never reaches into the engine itself.
class IncidentVoiceActions {
  const IncidentVoiceActions({
    required this.next,
    required this.alone,
    required this.call,
    required this.timeline,
    this.nudgeRate,
  });

  final void Function() next;
  final void Function() alone;
  final void Function() call;
  final void Function() timeline;

  /// +1 / -1 within the guideline band. Null when the current step has no rate.
  final void Function(int direction)? nudgeRate;
}

/// Voice during a live incident.
///
/// The rules it enforces are the whole reason it is a separate object from
/// [VoiceSession]:
///
///  * **Every word spoken during an incident is the step's own `speech` field.**
///    The controller reads vetted content aloud; it does not narrate. Questions
///    asked mid-incident are still answered from the cited pack, but the answer
///    never becomes an instruction and never moves the protocol.
///  * **A question cannot advance the protocol.** Only a command does that, and
///    the command grammar is tiny and exact (`commands.dart`). Saying "should I
///    stop?" must not skip a step.
///  * **Voice is an accelerator over a touch path that always works.** If the
///    microphone dies — and during a 911 call it will, by design, on both
///    platforms — the incident carries on unchanged. That is enforced here by
///    having the controller own nothing the screen needs.
class IncidentVoiceController {
  IncidentVoiceController({
    required this.session,
    required this.engine,
    required this.grammar,
    required this.actions,
  });

  final VoiceSession session;
  final IncidentEngine engine;
  final CommandGrammar grammar;
  final IncidentVoiceActions actions;

  String? _lastSpokenStepId;

  /// Commands the user has issued, for the EMS timeline and the transcript.
  final List<VoiceCommand> commands = [];

  Future<void> start() async {
    // Every final transcript inside an incident goes through [handle], not
    // straight to the advisor: in here a sentence is a command first and a
    // question second.
    session.onFinalUtterance = handle;
    await session.initialize();
    engine.addListener(_onStepChanged);
    await _speakCurrentStep();
    if (session.mic.canListen) await session.startListening();
  }

  void _onStepChanged() => unawaited(_speakCurrentStep());

  Future<void> _speakCurrentStep() async {
    final step = engine.step;
    if (step.id == _lastSpokenStepId) return;
    _lastSpokenStepId = step.id;
    // Verbatim from the corpus. Nothing is composed here.
    await session.announceStep(step.speech);
  }

  /// Say the current step again, with its supporting line this time.
  Future<void> repeat({bool withDetail = false}) async {
    final step = engine.step;
    await session.announceStep(
      withDetail && step.detail.isNotEmpty
          ? '${step.speech} ${step.detail}'
          : step.speech,
    );
  }

  /// One heard utterance. Returns the guidance when it was a question, null
  /// when it was a command.
  Future<Guidance?> handle(String utterance) async {
    final command = grammar.parse(utterance);
    if (command != null) {
      commands.add(command);
      engine.note('Voice: "${command.phrase}"');
      _run(command.kind);
      return null;
    }

    // Not a command, so it is a question. Answering must not move the protocol,
    // which is why this calls the session directly rather than acting on
    // `guidance.protocolId`.
    return session.ask(utterance);
  }

  void _run(VoiceCommandKind kind) {
    switch (kind) {
      case VoiceCommandKind.next:
        actions.next();
      case VoiceCommandKind.repeat:
        unawaited(repeat());
      case VoiceCommandKind.help:
        unawaited(repeat(withDetail: true));
      case VoiceCommandKind.alone:
        actions.alone();
      case VoiceCommandKind.call:
        actions.call();
      case VoiceCommandKind.timeline:
        actions.timeline();
      case VoiceCommandKind.hush:
        unawaited(session.stopListening());
      case VoiceCommandKind.slower:
        actions.nudgeRate?.call(-1);
      case VoiceCommandKind.faster:
        actions.nudgeRate?.call(1);
    }
  }

  void dispose() {
    session.onFinalUtterance = null;
    engine.removeListener(_onStepChanged);
  }
}
