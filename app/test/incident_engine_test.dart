import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/data/protocol_repository.dart';
import 'package:mayday/src/domain/protocol.dart';
import 'package:mayday/src/engine/incident_engine.dart';

Future<ProtocolRepository> loadFromDisk() =>
    ProtocolRepository.load(loader: (path) => File(path).readAsString());

void main() {
  late ProtocolRepository repo;

  setUp(() async => repo = await loadFromDisk());

  IncidentEngine engineFor(String id) =>
      IncidentEngine(repository: repo, protocol: repo.requireById(id));

  ProtocolChoice choiceLabelled(ProtocolStep step, String label) =>
      step.choices.firstWhere((c) => c.label == label);

  group('IncidentEngine', () {
    test('starts at the entry step and records the incident opening', () {
      final e = engineFor('cpr_adult');
      expect(e.step.id, 'scene_safe');
      expect(e.timeline.first.kind, TimelineEventKind.incidentStarted);
      expect(e.timeline.any((t) => t.kind == TimelineEventKind.protocolEntered),
          isTrue);
    });

    test('walks the full hands-only CPR path to compressions', () {
      final e = engineFor('cpr_adult');

      e.choose(choiceLabelled(e.step, 'YES')); // scene safe
      expect(e.step.id, 'check_response');

      e.choose(choiceLabelled(e.step, 'NO RESPONSE'));
      expect(e.step.id, 'delegate');
      expect(e.step.kind, StepKind.delegate);

      e.advance(); // someone else is calling
      expect(e.step.id, 'check_breathing');

      e.choose(choiceLabelled(e.step, 'ONLY GASPING'));
      expect(e.step.id, 'position_body');

      e.advance();
      expect(e.step.id, 'hand_position');

      e.advance();
      expect(e.step.kind, StepKind.compressions);
      expect(e.step.targetRateBpm, 110);
    });

    test('gasping is treated as not breathing, never as breathing', () {
      final e = engineFor('cpr_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO RESPONSE'));
      e.advance();

      final notBreathing = choiceLabelled(e.step, 'NOT BREATHING').next;
      final gasping = choiceLabelled(e.step, 'ONLY GASPING').next;
      expect(gasping, notBreathing,
          reason: 'agonal gasps must lead to compressions');
    });

    test('the alone branch routes to placing the call ourselves', () {
      final e = engineFor('cpr_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO RESPONSE'));
      expect(e.step.kind, StepKind.delegate);

      e.takeAloneBranch();
      expect(e.step.id, 'call_alone');
      expect(e.step.kind, StepKind.call911);
    });

    test('a responsive person never reaches compressions', () {
      final e = engineFor('cpr_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'THEY RESPOND'));
      expect(e.step.kind, StepKind.terminal);
      expect(e.isTerminal, isTrue);
    });

    test('cycle steps count down and only then advance', () {
      final e = engineFor('choking_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO — SILENT'));
      expect(e.step.kind, StepKind.delegate);
      e.advance();

      expect(e.step.id, 'back_blows');
      expect(e.step.count, 5);

      for (var i = 0; i < 4; i++) {
        e.advance();
        expect(e.step.id, 'back_blows', reason: 'still counting at ${i + 1}');
        expect(e.cycleProgress, i + 1);
      }
      e.advance(); // fifth
      expect(e.step.id, 'abdominal_thrusts');
      expect(e.cycleProgress, 0, reason: 'counter resets on a new cycle step');
    });

    test('choking that goes unresponsive jumps into the CPR protocol', () {
      final e = engineFor('choking_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO — SILENT'));
      e.advance();
      for (var i = 0; i < 5; i++) {
        e.advance(); // back blows
      }
      for (var i = 0; i < 5; i++) {
        e.advance(); // abdominal thrusts
      }
      expect(e.step.id, 'check_cleared');

      e.choose(choiceLabelled(e.step, 'WENT LIMP'));
      expect(e.step.kind, StepKind.gotoProtocol);

      e.jumpToTargetProtocol();
      expect(e.protocol.id, 'cpr_adult');
      expect(e.step.id, 'hand_position');
      expect(
        e.timeline.where((t) => t.kind == TimelineEventKind.protocolEntered).length,
        2,
        reason: 'the timeline records both protocols for the EMS handoff',
      );
    });

    test('the pregnancy branch swaps abdominal for chest thrusts', () {
      final e = engineFor('choking_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO — SILENT'));
      e.advance();
      for (var i = 0; i < 5; i++) {
        e.advance();
      }
      expect(e.step.id, 'abdominal_thrusts');

      e.takeAlternate();
      expect(e.step.id, 'chest_thrusts');
      expect(e.step.count, 5);
    });

    test('the timeline captures the events a paramedic asks about', () {
      final e = engineFor('cpr_adult');
      e.choose(choiceLabelled(e.step, 'YES'));
      e.choose(choiceLabelled(e.step, 'NO RESPONSE'));
      e.noteCallDelegated();
      e.advance();
      e.choose(choiceLabelled(e.step, 'NOT BREATHING'));
      e.advance();
      e.advance();
      e.noteCompressionsStarted();

      final kinds = e.timeline.map((t) => t.kind).toSet();
      expect(kinds, contains(TimelineEventKind.callDelegated));
      expect(kinds, contains(TimelineEventKind.compressionsStarted));

      for (final event in e.timeline) {
        expect(event.stamp, matches(RegExp(r'^\d{2}:\d{2}$')));
      }
    });

    test('exposes the source behind the current step', () {
      final e = engineFor('cpr_adult');
      expect(e.currentSource, isNotNull);
      expect(e.currentSource!.publisher, contains('American Heart'));
    });
  });
}
