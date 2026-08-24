import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../domain/protocol.dart';

/// Loads the protocol corpus from bundled assets.
///
/// Everything here is offline by construction — there is no network client in
/// this class and there must never be one. The corpus ships inside the app so
/// that a parking garage, a trail, or a basement is not a degraded experience.
class ProtocolRepository {
  ProtocolRepository._(this._protocols, this._sources, this.corpusRevision);

  final Map<String, Protocol> _protocols;
  final Map<String, SourceRef> _sources;
  final String corpusRevision;

  static const String _dir = 'assets/protocols';

  Iterable<Protocol> get all => _protocols.values;
  Iterable<SourceRef> get sources => _sources.values;

  Protocol? byId(String id) => _protocols[id];

  Protocol requireById(String id) {
    final p = _protocols[id];
    if (p == null) throw StateError('No protocol "$id" in corpus');
    return p;
  }

  SourceRef? sourceById(String id) => _sources[id];

  Iterable<Protocol> get tierA =>
      _protocols.values.where((p) => p.tier == ProtocolTier.a);

  /// Reads the corpus from the asset bundle. Uses a loader function so tests
  /// can read straight off disk without a Flutter binding.
  static Future<ProtocolRepository> load({
    Future<String> Function(String path)? loader,
  }) async {
    final read = loader ?? rootBundle.loadString;

    final index =
        jsonDecode(await read('$_dir/index.json')) as Map<String, dynamic>;
    final ids = (index['protocols'] as List<dynamic>).cast<String>();
    final corpusRevision = index['corpusRevision'] as String;

    final sourcesJson =
        jsonDecode(await read('$_dir/sources.json')) as Map<String, dynamic>;
    final sources = <String, SourceRef>{};
    for (final s in (sourcesJson['sources'] as List<dynamic>)) {
      final ref = SourceRef.fromJson(s as Map<String, dynamic>);
      sources[ref.id] = ref;
    }

    final protocols = <String, Protocol>{};
    for (final id in ids) {
      final raw = jsonDecode(await read('$_dir/$id.json')) as Map<String, dynamic>;
      final p = Protocol.fromJson(raw);
      if (p.id != id) {
        throw FormatException('Protocol file "$id.json" declares id "${p.id}"');
      }
      protocols[p.id] = p;
    }

    return ProtocolRepository._(protocols, sources, corpusRevision);
  }

  /// Corpus-wide integrity problems. Empty list means the corpus is coherent.
  /// Run from a test so a bad edit cannot ship.
  List<String> validate() {
    final problems = <String>[];

    for (final p in _protocols.values) {
      for (final dangling in p.danglingEdges()) {
        problems.add('${p.id}: dangling edge $dangling');
      }
      for (final orphan in p.unreachableSteps()) {
        problems.add('${p.id}: step "$orphan" is unreachable from the entry step');
      }

      for (final s in p.steps) {
        if (!_sources.containsKey(s.source)) {
          problems.add('${p.id}.${s.id}: unknown source "${s.source}"');
        }
        if (s.quote.trim().isEmpty) {
          problems.add('${p.id}.${s.id}: empty source quote');
        }

        switch (s.kind) {
          case StepKind.confirm:
            if (s.choices.length < 2) {
              problems.add('${p.id}.${s.id}: confirm step needs >=2 choices');
            }
          case StepKind.cycle:
            if ((s.count ?? 0) <= 0) {
              problems.add('${p.id}.${s.id}: cycle step needs a positive count');
            }
            if (s.next == null) {
              problems.add('${p.id}.${s.id}: cycle step needs "next"');
            }
          case StepKind.compressions:
            if (s.targetRateBpm == null ||
                s.acceptableRateMin == null ||
                s.acceptableRateMax == null) {
              problems.add('${p.id}.${s.id}: compressions step needs a rate band');
            } else if (s.targetRateBpm! < s.acceptableRateMin! ||
                s.targetRateBpm! > s.acceptableRateMax!) {
              problems.add(
                  '${p.id}.${s.id}: target rate ${s.targetRateBpm} outside '
                  'acceptable band ${s.acceptableRateMin}-${s.acceptableRateMax}');
            }
          case StepKind.gotoProtocol:
            final target = s.targetProtocolId;
            if (target == null) {
              problems.add('${p.id}.${s.id}: gotoProtocol needs targetProtocolId');
            } else {
              final tp = _protocols[target];
              if (tp == null) {
                problems.add('${p.id}.${s.id}: jumps to unknown protocol "$target"');
              } else if (s.targetStepId != null &&
                  tp.step(s.targetStepId!) == null) {
                problems.add('${p.id}.${s.id}: jumps to unknown step '
                    '"$target.${s.targetStepId}"');
              }
            }
          case StepKind.action:
          case StepKind.delegate:
          case StepKind.call911:
            if (s.next == null) {
              problems.add('${p.id}.${s.id}: ${s.kind.name} step needs "next"');
            }
          case StepKind.terminal:
            if (s.outgoing.isNotEmpty) {
              problems.add('${p.id}.${s.id}: terminal step has outgoing edges');
            }
        }
      }
    }
    return problems;
  }

  /// Tier A steps whose content is not confirmed against a primary source.
  /// The safety test treats a non-empty result as a build failure.
  List<String> unverifiedTierASteps() {
    final out = <String>[];
    for (final p in _protocols.values.where((p) => p.tier == ProtocolTier.a)) {
      for (final s in p.steps.where((s) => !s.verified)) {
        out.add('${p.id}.${s.id} (source: ${s.source})');
      }
    }
    return out;
  }
}
