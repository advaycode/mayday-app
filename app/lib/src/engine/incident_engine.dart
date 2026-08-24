import 'package:flutter/foundation.dart';

import '../data/protocol_repository.dart';
import '../domain/protocol.dart';

/// One recorded moment in an incident. Timestamps are relative to the start of
/// the incident, because "4 minutes 12 seconds in" is what a paramedic needs,
/// not a wall clock.
@immutable
class TimelineEvent {
  const TimelineEvent({
    required this.at,
    required this.label,
    required this.kind,
    this.detail,
  });

  final Duration at;
  final String label;
  final TimelineEventKind kind;
  final String? detail;

  String get stamp {
    final m = at.inMinutes.toString().padLeft(2, '0');
    final s = (at.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

enum TimelineEventKind {
  incidentStarted,
  protocolEntered,
  stepAdvanced,
  choiceMade,
  callPlaced,
  callDelegated,
  compressionsStarted,
  compressionsPaused,
  rescuerSwapPrompted,
  aedUsed,
  note,
}

/// Drives a Tier A protocol.
///
/// SAFETY INVARIANT: nothing in this class, or anything it calls, may consult a
/// language model. Tier A execution is a pure state machine over vetted content.
/// `test/tier_a_safety_test.dart` asserts this by static inspection of the
/// library's imports.
class IncidentEngine extends ChangeNotifier {
  IncidentEngine({
    required ProtocolRepository repository,
    required Protocol protocol,
    Stopwatch? clock,
    String? startStepId,
  })  : _repo = repository,
        _protocol = protocol,
        _clock = clock ?? Stopwatch() {
    _clock.start();
    _step = startStepId != null
        ? protocol.requireStep(startStepId)
        : protocol.entryStep;
    _record(TimelineEventKind.incidentStarted, 'Incident started');
    _record(TimelineEventKind.protocolEntered,
        '${protocol.title} — ${protocol.subtitle}');
  }

  final ProtocolRepository _repo;
  final Stopwatch _clock;

  Protocol _protocol;
  late ProtocolStep _step;
  final List<TimelineEvent> _timeline = [];

  /// How many repetitions of the current [StepKind.cycle] step are done.
  int _cycleProgress = 0;

  Protocol get protocol => _protocol;
  ProtocolStep get step => _step;
  int get cycleProgress => _cycleProgress;
  Duration get elapsed => _clock.elapsed;
  List<TimelineEvent> get timeline => List.unmodifiable(_timeline);
  bool get isTerminal => _step.kind == StepKind.terminal;

  /// The source behind the current step, for the inline citation.
  SourceRef? get currentSource => _repo.sourceById(_step.source);

  void _record(TimelineEventKind kind, String label, [String? detail]) {
    _timeline.add(TimelineEvent(
      at: _clock.elapsed,
      label: label,
      kind: kind,
      detail: detail,
    ));
  }

  void _goTo(String stepId, TimelineEventKind kind, String label) {
    _step = _protocol.requireStep(stepId);
    _cycleProgress = 0;
    _record(kind, label, _step.instruction);
    notifyListeners();
  }

  /// Advance along the single forward edge. Valid for action / delegate /
  /// call911 / compressions and for a cycle whose repetitions are complete.
  void advance() {
    final step = _step;

    if (step.kind == StepKind.cycle && _cycleProgress < (step.count ?? 0)) {
      _cycleProgress++;
      notifyListeners();
      if (_cycleProgress < (step.count ?? 0)) return;
    }

    final next = step.next;
    if (next == null) return;
    _goTo(next, TimelineEventKind.stepAdvanced, 'Completed: ${step.instruction}');
  }

  /// Take a branch from a [StepKind.confirm] step.
  void choose(ProtocolChoice choice) {
    _record(TimelineEventKind.choiceMade,
        '${_step.instruction} → ${choice.label}');
    _goTo(choice.next, TimelineEventKind.stepAdvanced, choice.label);
  }

  /// The alternate-technique edge (e.g. chest thrusts instead of abdominal).
  void takeAlternate() {
    final alt = _step.altNext;
    if (alt == null) return;
    _record(TimelineEventKind.choiceMade, _step.altLabel ?? 'Alternate technique');
    _goTo(alt, TimelineEventKind.stepAdvanced, _step.altLabel ?? 'Alternate');
  }

  /// The user is on their own — we place the call instead of delegating it.
  void takeAloneBranch() {
    final alone = _step.aloneNext;
    if (alone == null) return;
    _record(TimelineEventKind.note, 'Rescuer is alone');
    _goTo(alone, TimelineEventKind.stepAdvanced, 'Alone');
  }

  void noteCallPlaced() =>
      _record(TimelineEventKind.callPlaced, '911 called from this phone');

  void noteCallDelegated() => _record(
      TimelineEventKind.callDelegated, '911 call delegated to a bystander');

  void noteCompressionsStarted() => _record(
      TimelineEventKind.compressionsStarted, 'Compressions started');

  void noteRescuerSwapPrompted() => _record(
      TimelineEventKind.rescuerSwapPrompted, 'Rescuer swap prompted');

  void noteAedUsed() => _record(TimelineEventKind.aedUsed, 'AED used');

  void note(String text) => _record(TimelineEventKind.note, text);

  /// Follow a [StepKind.gotoProtocol] edge into another protocol.
  void jumpToTargetProtocol() {
    final targetId = _step.targetProtocolId;
    if (targetId == null) return;
    final target = _repo.requireById(targetId);
    _protocol = target;
    _step = _step.targetStepId != null
        ? target.requireStep(_step.targetStepId!)
        : target.entryStep;
    _cycleProgress = 0;
    _record(TimelineEventKind.protocolEntered,
        '${target.title} — ${target.subtitle}');
    notifyListeners();
  }

  @override
  void dispose() {
    _clock.stop();
    super.dispose();
  }
}
