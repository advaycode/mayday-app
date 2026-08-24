/// Domain model for the Mayday protocol corpus.
///
/// A protocol is a deterministic state machine. Tier A protocols are executed
/// with no model in the loop at any point — see [ProtocolTier]. The parser is
/// strict on purpose: a malformed protocol should fail loudly at load time in a
/// test, never halfway through a cardiac arrest.
library;

enum ProtocolTier { a, b, c }

enum AgeBand { adult, child, infant, any }

enum StepKind {
  /// A yes/no/which-is-it question. Renders [ProtocolStep.choices].
  confirm,

  /// Do this, then advance. Single forward edge.
  action,

  /// Do this N times, with an on-screen counter. Single forward edge.
  cycle,

  /// The compression coach: metronome, rate detection, swap timer.
  compressions,

  /// Script the bystander into delegating the 911 call to another person.
  /// Exists because the platform cannot give us the microphone during a call —
  /// see research/DECISIONS.md D1.
  delegate,

  /// We place the call ourselves, because the user is alone.
  call911,

  /// Jump to another protocol, preserving the incident timeline.
  gotoProtocol,

  /// End of this branch.
  terminal,
}

class ProtocolChoice {
  const ProtocolChoice({required this.label, required this.next});

  final String label;
  final String next;

  factory ProtocolChoice.fromJson(Map<String, dynamic> json) => ProtocolChoice(
        label: json['label'] as String,
        next: json['next'] as String,
      );
}

class ProtocolStep {
  const ProtocolStep({
    required this.id,
    required this.kind,
    required this.instruction,
    required this.detail,
    required this.speech,
    required this.source,
    required this.quote,
    required this.verified,
    this.next,
    this.choices = const [],
    this.count,
    this.altLabel,
    this.altNext,
    this.aloneLabel,
    this.aloneNext,
    this.targetProtocolId,
    this.targetStepId,
    this.targetRateBpm,
    this.acceptableRateMin,
    this.acceptableRateMax,
    this.depthCoaching,
    this.swapIntervalSeconds,
    this.handsOnly,
    this.verificationNote,
  });

  final String id;
  final StepKind kind;

  /// The huge line. Imperative, short enough to read at arm's length.
  final String instruction;

  /// The small supporting line.
  final String detail;

  /// What the voice says. Deliberately separate from [instruction] because
  /// "911" reads correctly but must be spoken "nine one one".
  final String speech;

  /// Id into sources.json.
  final String source;

  /// The guideline text this step encodes, so a judge (or a clinician) can
  /// check the step against its source without leaving the app.
  final String quote;

  /// False when the content could not be confirmed against a primary source.
  /// The corpus test fails the build if any Tier A step is unverified.
  final bool verified;
  final String? verificationNote;

  final String? next;
  final List<ProtocolChoice> choices;

  /// cycle: how many repetitions.
  final int? count;

  /// cycle/action: an alternate technique edge (e.g. chest thrusts when the
  /// rescuer cannot encircle the abdomen).
  final String? altLabel;
  final String? altNext;

  /// delegate: the escape hatch when there is nobody else present.
  final String? aloneLabel;
  final String? aloneNext;

  /// gotoProtocol
  final String? targetProtocolId;
  final String? targetStepId;

  /// compressions
  final int? targetRateBpm;
  final int? acceptableRateMin;
  final int? acceptableRateMax;
  final String? depthCoaching;
  final int? swapIntervalSeconds;
  final bool? handsOnly;

  /// Every outgoing edge from this step, used by the reachability test.
  Iterable<String> get outgoing => [
        ?next,
        ...choices.map((c) => c.next),
        ?altNext,
        ?aloneNext,
      ];

  factory ProtocolStep.fromJson(Map<String, dynamic> json) {
    final kindName = json['kind'] as String;
    final kind = StepKind.values.firstWhere(
      (k) => k.name == kindName,
      orElse: () => throw FormatException('Unknown step kind "$kindName"'),
    );
    return ProtocolStep(
      id: json['id'] as String,
      kind: kind,
      instruction: json['instruction'] as String,
      detail: json['detail'] as String? ?? '',
      speech: json['speech'] as String,
      source: json['source'] as String,
      quote: json['quote'] as String,
      verified: json['verified'] as bool? ?? false,
      verificationNote: json['verificationNote'] as String?,
      next: json['next'] as String?,
      choices: (json['choices'] as List<dynamic>? ?? [])
          .map((c) => ProtocolChoice.fromJson(c as Map<String, dynamic>))
          .toList(growable: false),
      count: json['count'] as int?,
      altLabel: json['altLabel'] as String?,
      altNext: json['altNext'] as String?,
      aloneLabel: json['aloneLabel'] as String?,
      aloneNext: json['aloneNext'] as String?,
      targetProtocolId: json['targetProtocolId'] as String?,
      targetStepId: json['targetStepId'] as String?,
      targetRateBpm: json['targetRateBpm'] as int?,
      acceptableRateMin: json['acceptableRateMin'] as int?,
      acceptableRateMax: json['acceptableRateMax'] as int?,
      depthCoaching: json['depthCoaching'] as String?,
      swapIntervalSeconds: json['swapIntervalSeconds'] as int?,
      handsOnly: json['handsOnly'] as bool?,
    );
  }
}

class Protocol {
  Protocol({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.tier,
    required this.ageBand,
    required this.revision,
    required this.guidelineYear,
    required this.entryStepId,
    required this.summary,
    required List<ProtocolStep> steps,
  }) : _steps = {for (final s in steps) s.id: s} {
    if (steps.length != _steps.length) {
      throw FormatException('Protocol "$id" has duplicate step ids');
    }
    if (!_steps.containsKey(entryStepId)) {
      throw FormatException(
          'Protocol "$id" entryStepId "$entryStepId" is not a step');
    }
  }

  final String id;
  final String title;
  final String subtitle;
  final ProtocolTier tier;
  final AgeBand ageBand;
  final String revision;
  final int guidelineYear;
  final String entryStepId;
  final String summary;

  final Map<String, ProtocolStep> _steps;

  Iterable<ProtocolStep> get steps => _steps.values;
  ProtocolStep get entryStep => _steps[entryStepId]!;

  ProtocolStep? step(String id) => _steps[id];

  ProtocolStep requireStep(String id) {
    final s = _steps[id];
    if (s == null) {
      throw StateError('Protocol "${this.id}" has no step "$id"');
    }
    return s;
  }

  /// Edges that point at a step id this protocol does not define. Excludes
  /// cross-protocol jumps, which are resolved by the repository instead.
  List<String> danglingEdges() {
    final bad = <String>[];
    for (final s in _steps.values) {
      for (final e in s.outgoing) {
        if (!_steps.containsKey(e)) bad.add('${s.id} -> $e');
      }
    }
    return bad;
  }

  /// Step ids not reachable from [entryStepId]. Dead content is a corpus bug.
  Set<String> unreachableSteps() {
    final seen = <String>{};
    final queue = <String>[entryStepId];
    while (queue.isNotEmpty) {
      final id = queue.removeLast();
      if (!seen.add(id)) continue;
      final s = _steps[id];
      if (s == null) continue;
      queue.addAll(s.outgoing);
    }
    return _steps.keys.toSet().difference(seen);
  }

  factory Protocol.fromJson(Map<String, dynamic> json) {
    final tierName = (json['tier'] as String).toLowerCase();
    final ageName = (json['ageBand'] as String).toLowerCase();
    return Protocol(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String? ?? '',
      tier: ProtocolTier.values.firstWhere((t) => t.name == tierName,
          orElse: () => throw FormatException('Unknown tier "$tierName"')),
      ageBand: AgeBand.values.firstWhere((a) => a.name == ageName,
          orElse: () => throw FormatException('Unknown ageBand "$ageName"')),
      revision: json['revision'] as String,
      guidelineYear: json['guidelineYear'] as int,
      entryStepId: json['entryStepId'] as String,
      summary: json['summary'] as String? ?? '',
      steps: (json['steps'] as List<dynamic>)
          .map((s) => ProtocolStep.fromJson(s as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class SourceRef {
  const SourceRef({
    required this.id,
    required this.title,
    required this.publisher,
    required this.citation,
    required this.url,
    required this.verified,
    this.comment,
  });

  final String id;
  final String title;
  final String publisher;
  final String citation;
  final String? url;
  final bool verified;
  final String? comment;

  factory SourceRef.fromJson(Map<String, dynamic> json) => SourceRef(
        id: json['id'] as String,
        title: json['title'] as String,
        publisher: json['publisher'] as String,
        citation: json['citation'] as String,
        url: json['url'] as String?,
        verified: json['verified'] as bool? ?? false,
        comment: json['comment'] as String?,
      );
}
