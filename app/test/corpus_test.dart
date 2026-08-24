import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/data/protocol_repository.dart';
import 'package:mayday/src/domain/protocol.dart';

/// Reads the corpus straight off disk so these tests do not need a Flutter
/// binding or an asset bundle.
Future<ProtocolRepository> loadFromDisk() =>
    ProtocolRepository.load(loader: (path) => File(path).readAsString());

/// Tier A steps whose wording is not yet confirmed against a fetchable primary
/// source. This list is a debt register, not a permission slip: it must only
/// ever shrink, and nothing ships to a real user while it is non-empty.
///
/// Both entries depend on the numeric CPR targets in AHA Part 7 (2025).
/// ahajournals.org and cpr.heart.org both return HTTP 403 to automated fetches,
/// so the values were carried forward from the 2020 Guidelines on the evidence
/// that they are absent from the 2025 change list. Confirm against the PDF and
/// delete these entries.
const kKnownUnverifiedTierASteps = <String>{
  'cpr_adult.hand_position (source: aha2025-part7)',
  'cpr_adult.compressions (source: aha2025-part7)',
};

void main() {
  group('protocol corpus', () {
    late ProtocolRepository repo;

    setUp(() async => repo = await loadFromDisk());

    test('parses and is structurally coherent', () {
      final problems = repo.validate();
      expect(problems, isEmpty,
          reason: 'Corpus integrity problems:\n${problems.join('\n')}');
    });

    test('every protocol has at least one terminal step', () {
      for (final p in repo.all) {
        expect(
          p.steps.any((s) => s.kind == StepKind.terminal),
          isTrue,
          reason: '${p.id} can never end',
        );
      }
    });

    test('no step is reachable only from itself', () {
      for (final p in repo.all) {
        expect(p.unreachableSteps(), isEmpty, reason: p.id);
      }
    });

    test('every step cites a source that exists and carries a quote', () {
      for (final p in repo.all) {
        for (final s in p.steps) {
          expect(repo.sourceById(s.source), isNotNull,
              reason: '${p.id}.${s.id} cites unknown source "${s.source}"');
          expect(s.quote.trim(), isNotEmpty, reason: '${p.id}.${s.id}');
        }
      }
    });

    test('unverified Tier A content matches the declared debt register', () {
      final actual = repo.unverifiedTierASteps().toSet();

      final undeclared = actual.difference(kKnownUnverifiedTierASteps);
      expect(undeclared, isEmpty,
          reason: 'New unverified Tier A content appeared. Every Tier A '
              'instruction must be traceable to a confirmed primary source '
              'before it can ship:\n${undeclared.join('\n')}');

      final staleEntries = kKnownUnverifiedTierASteps.difference(actual);
      expect(staleEntries, isEmpty,
          reason: 'These steps are now verified — remove them from '
              'kKnownUnverifiedTierASteps:\n${staleEntries.join('\n')}');
    });

    test('compressions steps sit inside the guideline rate band', () {
      for (final p in repo.all) {
        for (final s in p.steps.where((s) => s.kind == StepKind.compressions)) {
          expect(s.acceptableRateMin, 100, reason: '${p.id}.${s.id}');
          expect(s.acceptableRateMax, 120, reason: '${p.id}.${s.id}');
          expect(s.targetRateBpm, inInclusiveRange(100, 120));
          expect(s.swapIntervalSeconds, 120,
              reason: 'Rescuers swap every 2 minutes');
        }
      }
    });

    test('the 2025 infant guidance change is not silently reintroduced', () {
      // The 2-finger infant technique was withdrawn in the 2025 Guidelines.
      // Most first-aid content on the internet still teaches it, so this test
      // guards against it creeping back in via a copy-paste.
      for (final p in repo.all) {
        for (final s in p.steps) {
          final text = '${s.instruction} ${s.detail} ${s.speech}'.toLowerCase();
          expect(text.contains('two finger'), isFalse,
              reason: '${p.id}.${s.id} uses the withdrawn 2-finger technique');
          expect(text.contains('2 finger'), isFalse,
              reason: '${p.id}.${s.id} uses the withdrawn 2-finger technique');
        }
      }
    });

    test('no step speaks a depth measurement', () {
      // DECISIONS.md D3: depth is coached by instruction, never measured or
      // reported as a number, because accelerometer depth does not survive
      // real-world conditions.
      for (final p in repo.all) {
        for (final s in p.steps) {
          expect(s.instruction.toLowerCase(), isNot(contains('depth')),
              reason: '${p.id}.${s.id}');
        }
      }
    });
  });
}
