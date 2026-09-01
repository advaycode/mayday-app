import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/knowledge.dart';
import 'package:mayday/src/data/protocol_repository.dart';

import 'ai_fixture.dart';

void main() {
  late KnowledgeBase knowledge;
  late ProtocolRepository repository;

  setUp(() async {
    knowledge = await loadKnowledge();
    repository = await loadRepository();
  });

  group('knowledge pack', () {
    test('parses and is structurally coherent', () {
      final problems = knowledge.validate(
        knownSourceIds: repository.sources.map((s) => s.id).toSet(),
        knownProtocolIds: repository.all.map((p) => p.id).toSet(),
        stepExists: (protocolId, stepId) =>
            repository.byId(protocolId)?.step(stepId) != null,
      );
      expect(problems, isEmpty,
          reason: 'Knowledge pack problems:\n${problems.join('\n')}');
    });

    test('every clinical answer carries a source and a quote', () {
      for (final card in knowledge.cards.where((c) => c.makesClinicalClaim)) {
        expect(card.source, isNotNull, reason: card.id);
        expect(card.quote?.trim(), isNotEmpty, reason: card.id);
        expect(repository.sourceById(card.source!), isNotNull, reason: card.id);
      }
    });

    // The rule that keeps the citation honest. A quote that was written from a
    // source rather than transcribed from it is evidence of intent, not
    // evidence of wording, and the UI must show it as unconfirmed.
    test('a paraphrased quote is never marked verified', () {
      for (final card in knowledge.cards) {
        if (card.quoteKind == QuoteKind.paraphrase) {
          expect(card.verified, isFalse, reason: card.id);
          expect(card.verificationNote?.trim(), isNotEmpty, reason: card.id);
        }
      }
    });

    // A coverage gap exists to refuse. If one ever starts handing out technique
    // it has stopped being a refusal and become unsourced medical advice.
    test('coverage-gap answers make no clinical claim', () {
      for (final card
          in knowledge.cards.where((c) => c.kind == CardKind.coverageGap)) {
        expect(card.protocolId, isNull, reason: card.id);
        expect(card.quoteKind, QuoteKind.none, reason: card.id);
        expect(
          '${card.display} ${card.speech}'.toLowerCase(),
          contains('911'),
          reason: '${card.id} must hand the caller to a dispatcher',
        );
      }
    });

    test('there is a coverage gap for children and infants', () {
      // The single most dangerous thing this app could do is answer a question
      // about a baby with the adult technique — and the 2025 Guidelines changed
      // the infant technique, so even a good memory of a first-aid class is
      // out of date. Until infant content exists and is cited, refusing is the
      // correct behaviour and it has to be guarded.
      final card = knowledge.byId('gap_child_or_infant');
      expect(card, isNotNull);
      expect(card!.kind, CardKind.coverageGap);
      expect(card.ask.any((a) => a.contains('baby')), isTrue);
    });

    test('nothing in the pack teaches the withdrawn 2-finger technique', () {
      for (final card in knowledge.cards) {
        final text = '${card.display} ${card.speech}'.toLowerCase();
        expect(text, isNot(contains('two finger')), reason: card.id);
        expect(text, isNot(contains('2 finger')), reason: card.id);
      }
    });

    test('spoken answers never read out a digit string for 911', () {
      // "911" is read by a synthesiser as "nine hundred and eleven".
      for (final card in knowledge.cards) {
        expect(card.speech, isNot(contains('911')), reason: card.id);
      }
    });

    test('every card is reachable by at least one distinct phrasing', () {
      final seen = <String, String>{};
      for (final card in knowledge.cards) {
        for (final ask in card.ask) {
          final existing = seen[ask.toLowerCase()];
          expect(existing, isNull,
              reason: 'phrase "$ask" is claimed by both $existing and '
                  '${card.id}');
          seen[ask.toLowerCase()] = card.id;
        }
      }
    });
  });
}
