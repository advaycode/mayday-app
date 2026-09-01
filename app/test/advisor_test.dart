import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/advisor.dart';
import 'package:mayday/src/ai/knowledge.dart';
import 'package:mayday/src/data/protocol_repository.dart';

import 'ai_fixture.dart';

void main() {
  late Advisor advisor;
  late KnowledgeBase knowledge;
  late ProtocolRepository repository;

  setUp(() async {
    knowledge = await loadKnowledge();
    repository = await loadRepository();
    advisor = Advisor.build(knowledge: knowledge, repository: repository);
  });

  group('routing', () {
    test('a time-critical finding escalates rather than chats', () {
      for (final utterance in [
        "he's not breathing",
        'she stopped breathing and is not moving',
        'there is no pulse',
      ]) {
        final guidance = advisor.advise(utterance);
        expect(guidance.kind, GuidanceKind.escalate, reason: utterance);
        expect(guidance.protocolId, 'cpr_adult', reason: utterance);
        expect(guidance.offersProtocol, isTrue, reason: utterance);
      }
    });

    test('choking is recognised from how people actually describe it', () {
      for (final utterance in [
        'someone is choking',
        "he can't breathe, something is stuck in his throat",
        'she is grabbing her throat and cannot cough',
      ]) {
        final guidance = advisor.advise(utterance);
        expect(guidance.protocolId, 'choking_adult', reason: utterance);
      }
    });

    test('questions inside a protocol are answered, not escalated', () {
      final cases = <String, String>{
        'how fast should I push': 'cpr_rate',
        'where do I put my hands': 'cpr_hand_position',
        'do I do mouth to mouth': 'cpr_breaths',
        'she is wearing a bra, do I take it off': 'aed_bra',
        'they are on a bed': 'cpr_surface',
        'she is pregnant': 'choking_pregnant',
        'when can I stop': 'cpr_stop',
      };
      cases.forEach((utterance, cardId) {
        final guidance = advisor.advise(utterance);
        expect(guidance.cardId, cardId, reason: utterance);
        expect(guidance.kind, GuidanceKind.answer, reason: utterance);
      });
    });

    test('questions about the app itself are answered as such', () {
      expect(advisor.advise('are you a doctor').cardId, 'meta_trust');
      expect(advisor.advise('what can you do').cardId, 'meta_capabilities');
      expect(advisor.advise('does this work without internet').cardId,
          'meta_offline');
    });
  });

  group('safety', () {
    // The single most important behaviour in the file. An infant is not a small
    // adult, and the 2025 Guidelines changed the infant technique specifically.
    // Answering "my baby is not breathing" from the adult protocol would be
    // wrong content delivered with total confidence.
    test('an age we do not cover refuses, even under a red-flag phrase', () {
      for (final utterance in [
        'my baby is not breathing',
        'my son is choking',
        'how do I do CPR on a toddler',
      ]) {
        final guidance = advisor.advise(utterance);
        expect(guidance.kind, GuidanceKind.coverageGap, reason: utterance);
        expect(guidance.protocolId, isNull, reason: utterance);
        expect(guidance.speech.toLowerCase(), contains('nine one one'),
            reason: utterance);
      }
    });

    test('emergencies outside the corpus are refused, not approximated', () {
      for (final utterance in [
        'they are having a seizure',
        'there is blood everywhere',
        'I think it is a stroke',
        'they have overdosed',
      ]) {
        final guidance = advisor.advise(utterance);
        expect(guidance.kind, GuidanceKind.coverageGap, reason: utterance);
        expect(guidance.protocolId, isNull, reason: utterance);
      }
    });

    test('a question it cannot answer produces a refusal, not a guess', () {
      for (final utterance in [
        'what is the weather like',
        'how do I change a tyre',
        'the dog ate my homework',
        '',
        '   ',
      ]) {
        final guidance = advisor.advise(utterance);
        expect(guidance.kind, GuidanceKind.unknown, reason: '"$utterance"');
        expect(guidance.protocolId, isNull, reason: '"$utterance"');
      }
    });

    test('unverified content is carried through to the answer', () {
      // cpr_rate rests on the AHA Part 7 numbers, which could not be fetched.
      // The UI shows "unconfirmed" off the back of these two fields, so losing
      // them would silently upgrade an unconfirmed claim to a confident one.
      final guidance = advisor.advise('how fast should I push');
      expect(guidance.verified, isFalse);
      expect(guidance.verificationNote, isNotNull);
      expect(guidance.sourceId, 'aha2025-part7');
      expect(repository.sourceById(guidance.sourceId!), isNotNull);
    });

    test('a paraphrased citation reaches the UI flagged as one', () {
      final guidance = advisor.advise('do I do mouth to mouth');
      expect(guidance.quoteKind, QuoteKind.paraphrase);
      expect(guidance.verified, isFalse);
    });
  });

  group('the assistant never writes prose', () {
    /// THE INVARIANT.
    ///
    /// Mayday's claim is that the complete set of sentences it can say out loud
    /// is finite, authored, cited, and checked into git. That is what makes the
    /// answer surface reviewable by someone who knows first aid, and it is the
    /// property that a generative model on this path would destroy.
    ///
    /// So: every spoken utterance must decompose into a framing template from
    /// [Advisor.templates] plus a body that is verbatim from a knowledge card
    /// or a protocol step. Nothing else is allowed through.
    test('every spoken answer is an authored sentence plus a fixed template',
        () {
      final authoredBodies = <String>{
        for (final card in knowledge.cards) card.speech,
        for (final protocol in repository.all)
          for (final step in protocol.steps) step.speech,
        for (final protocol in repository.all)
          for (final step in protocol.steps) '${step.speech} ${step.detail}',
      };

      final utterances = <String>[
        ...knowledge.cards.expand((c) => c.ask),
        'what is the weather like',
        'they are having a seizure',
        'my baby is not breathing',
        'someone is choking',
        '',
        'aaaaa',
        'push chest breathing choking baby blood aed',
      ];

      for (final utterance in utterances) {
        final guidance = advisor.advise(utterance);

        expect(Advisor.templates, contains(guidance.prefix),
            reason: 'unauthored prefix for "$utterance": '
                '"${guidance.prefix}"');
        expect(Advisor.templates, contains(guidance.suffix),
            reason: 'unauthored suffix for "$utterance": '
                '"${guidance.suffix}"');

        if (guidance.kind == GuidanceKind.clarify) continue;
        if (guidance.body.isEmpty) continue;

        expect(authoredBodies, contains(guidance.body),
            reason: 'unauthored spoken body for "$utterance": '
                '"${guidance.body}"');
      }
    });

    test('a clarify question only ever names protocols that exist', () {
      final guidance = advisor.advise('help');
      // "help" is intentionally vague; whatever it produces, any clarify
      // options must be real protocols.
      for (final option in guidance.options) {
        expect(repository.byId(option.protocolId), isNotNull);
      }
    });
  });

  group('determinism', () {
    test('the same sentence always produces the same answer', () {
      for (final utterance in [
        "he's not breathing",
        'how deep do I push',
        'what is the weather like',
      ]) {
        final first = advisor.advise(utterance);
        for (var i = 0; i < 20; i++) {
          final again = advisor.advise(utterance);
          expect(again.kind, first.kind, reason: utterance);
          expect(again.cardId, first.cardId, reason: utterance);
          expect(again.speech, first.speech, reason: utterance);
          expect(again.confidence, first.confidence, reason: utterance);
        }
      }
    });

    test('every card can be found by every phrasing that claims it', () {
      // A card nobody can reach is dead content, and a phrasing that lands on
      // the wrong card is worse than no phrasing at all. Coverage gaps veto by
      // topic rather than by card, so they are checked by kind.
      final misses = <String>[];
      for (final card in knowledge.cards) {
        for (final ask in card.ask) {
          final guidance = advisor.advise(ask);
          final ok = guidance.cardId == card.id ||
              (card.kind == CardKind.coverageGap &&
                  guidance.kind == GuidanceKind.coverageGap);
          if (!ok) {
            misses.add('"$ask" (${card.id}) -> ${guidance.cardId ?? '-'} '
                '[${guidance.kind.name}]');
          }
        }
      }
      expect(misses, isEmpty, reason: misses.join('\n'));
    });

    test('answering is fast enough to be invisible', () {
      final stopwatch = Stopwatch()..start();
      for (var i = 0; i < 200; i++) {
        advisor.advise('he is not breathing and I am on my own');
      }
      stopwatch.stop();
      final perCall = stopwatch.elapsedMicroseconds / 200;
      expect(perCall, lessThan(20000),
          reason: 'advise() took ${perCall.toStringAsFixed(0)}us per call');
    });
  });
}
