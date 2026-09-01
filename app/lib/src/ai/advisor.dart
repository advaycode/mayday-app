import '../data/protocol_repository.dart';
import '../domain/protocol.dart';
import 'knowledge.dart';
import 'lexicon.dart';
import 'retriever.dart';
import 'text.dart';

/// What the assistant decided to do with an utterance.
enum GuidanceKind {
  /// A red-flag phrase was heard. Stop asking questions and start the protocol.
  escalate,

  /// Answered, and there is a protocol to start.
  route,

  /// Answered a question about a protocol Mayday covers.
  answer,

  /// Mayday does not cover this. Say so and hand over to a dispatcher.
  coverageGap,

  /// About the app itself.
  meta,

  /// Two readings, materially different. Ask one short question.
  clarify,

  /// Not confident enough to say anything. This is a first-class outcome, not
  /// a failure — see the class comment on [Advisor].
  unknown,
}

class ClarifyOption {
  const ClarifyOption({required this.label, required this.protocolId});

  final String label;
  final String protocolId;
}

/// One answer, with everything needed to display it, speak it, and justify it.
class Guidance {
  const Guidance({
    required this.kind,
    required this.utterance,
    required this.display,
    required this.body,
    required this.confidence,
    this.prefix = '',
    this.suffix = '',
    this.cardId,
    this.protocolId,
    this.protocolStepId,
    this.sourceId,
    this.quote,
    this.quoteKind = QuoteKind.none,
    this.verified = true,
    this.verificationNote,
    this.matched = const {},
    this.options = const [],
  });

  final GuidanceKind kind;

  /// What the assistant heard.
  final String utterance;

  /// The on-screen answer.
  final String display;

  /// The authored sentence being spoken — verbatim from a knowledge card or a
  /// protocol step, never assembled from fragments.
  final String body;

  /// Fixed framing sentences. Both must come from [Advisor.templates]; a test
  /// enforces it. This is the mechanism that keeps the set of things Mayday can
  /// say out loud finite and reviewable.
  final String prefix;
  final String suffix;

  final double confidence;
  final String? cardId;
  final String? protocolId;
  final String? protocolStepId;
  final String? sourceId;
  final String? quote;
  final QuoteKind quoteKind;
  final bool verified;
  final String? verificationNote;

  /// Query terms that actually matched. Shown in the UI — "matched: chest,
  /// hand" — because an answer you cannot interrogate is an answer you cannot
  /// trust.
  final Set<String> matched;

  final List<ClarifyOption> options;

  /// The full spoken utterance.
  String get speech =>
      [prefix, body, suffix].where((s) => s.trim().isNotEmpty).join(' ');

  bool get offersProtocol =>
      protocolId != null &&
      (kind == GuidanceKind.route || kind == GuidanceKind.escalate);

  bool get isConfident =>
      kind != GuidanceKind.unknown && kind != GuidanceKind.clarify;
}

class AdvisorConfig {
  const AdvisorConfig({
    this.confidentScore = 0.34,
    this.confidentCoverage = 0.5,
    this.hedgeScore = 0.18,
    this.clarifyMargin = 0.12,
    this.cardWeight = 1.0,
    this.stepWeight = 0.65,
    this.protocolWeight = 0.5,
    this.coverageGapWeight = 0.45,
  });

  /// Normalised BM25 above which an answer is given plainly.
  final double confidentScore;

  /// ...and the fraction of the question's words that must have been matched.
  /// Score alone is not enough: one rare word can carry a high score while the
  /// rest of the sentence went unheard.
  final double confidentCoverage;

  /// Below this, the assistant says it does not know.
  final double hedgeScore;

  /// If the runner-up is within this of the best AND points at a different
  /// protocol, ask instead of guessing.
  final double clarifyMargin;

  final double cardWeight;
  final double stepWeight;
  final double protocolWeight;

  /// Coverage-gap cards are reached by topic — "seizure", "baby", "bleeding" —
  /// through the out-of-scope veto, not by ordinary word overlap. Left at full
  /// weight they hijack neighbouring questions: "how do I do CPR" lands on the
  /// infant refusal, because that card mentions CPR twice while saying it will
  /// not help you.
  final double coverageGapWeight;
}

/// The offline advisor — Mayday's "ask me anything" brain.
///
/// It is retrieval, not generation, and that is the design, not a limitation
/// worked around. Three properties follow from it and none of them survive
/// putting a language model on this path:
///
///  * **Every sentence it speaks is checked into git.** The advisor selects a
///    card; it never writes one. `test/advisor_test.dart` asserts that the
///    spoken string decomposes into an authored body plus a framing template
///    from [templates], so the complete set of things Mayday can say out loud
///    is finite and reviewable by a clinician.
///  * **It can say "I don't know".** A retrieval score is a real quantity you
///    can threshold. Below [AdvisorConfig.hedgeScore] the honest answer is a
///    refusal plus "call 911", and a refusal is the correct output far more
///    often than a fluent paragraph would be.
///  * **It is instant and offline.** No weights, no warm-up, no download, no
///    signal. It runs in under a millisecond on a corpus this size.
///
/// An on-device LLM still has a place here, but a much narrower one: turning a
/// rambling sentence into a protocol id. That job is [LlmRouter] in
/// `llm_router.dart`, it is off by default, and its output is validated against
/// an allowlist before it can move a single pixel.
class Advisor {
  Advisor._(
    this._knowledge,
    this._repository,
    this._retriever,
    this.config,
    this._exactAsk,
  );

  final KnowledgeBase _knowledge;
  final ProtocolRepository _repository;
  final Retriever _retriever;
  final AdvisorConfig config;

  /// Normalised phrasing -> card id. An exact hit outranks the scorer.
  ///
  /// Bag-of-words scoring has a blind spot on very short questions: "what can
  /// you do" is three stopwords and a pronoun, and whichever card happens to
  /// contain that pronoun most often wins. If somebody says a phrasing the pack
  /// already claims, word for word, there is nothing left to infer.
  final Map<String, String> _exactAsk;

  Lexicon get lexicon => _knowledge.lexicon;
  KnowledgeBase get knowledge => _knowledge;

  /// Every framing sentence the assistant is allowed to add around authored
  /// content. Kept as one visible list precisely so that it can be audited.
  static const List<String> templates = [
    '',
    'I think you mean:',
    'I am not certain, so check this yourself.',
    'I did not catch that.',
    'I do not know that one.',
    'Call nine one one now.',
    'Tell me which one it is.',
    'Say it again, or tap what you can see on the screen.',
  ];

  static const String _hedgePrefix = 'I think you mean:';
  static const String _hedgeSuffix = 'I am not certain, so check this yourself.';
  static const String _call911 = 'Call nine one one now.';

  static Advisor build({
    required KnowledgeBase knowledge,
    required ProtocolRepository repository,
    AdvisorConfig config = const AdvisorConfig(),
  }) {
    final normalizer = knowledge.lexicon.normalizer;
    final documents = <Document>[];
    final exactAsk = <String, String>{};

    for (final card in knowledge.cards) {
      documents.add(Document(
        id: 'card:${card.id}',
        kind: DocumentKind.card,
        terms: normalizer.normalizeAll(card.indexSegments).terms,
        cardId: card.id,
        protocolId: card.protocolId,
        stepId: card.protocolStepId,
        weight: card.kind == CardKind.coverageGap
            ? config.coverageGapWeight
            : config.cardWeight,
      ));
      for (final ask in card.ask) {
        exactAsk[normalizer.normalize(ask).words.join(' ')] = card.id;
      }
    }

    for (final protocol in repository.all) {
      documents.add(Document(
        id: 'protocol:${protocol.id}',
        kind: DocumentKind.protocol,
        terms: normalizer.normalizeAll(
            [protocol.title, protocol.subtitle, protocol.summary]).terms,
        protocolId: protocol.id,
        weight: config.protocolWeight,
      ));

      for (final step in protocol.steps) {
        documents.add(Document(
          id: 'step:${protocol.id}.${step.id}',
          kind: DocumentKind.step,
          terms: normalizer.normalizeAll(
              [step.instruction, step.detail, step.quote]).terms,
          protocolId: protocol.id,
          stepId: step.id,
          weight: config.stepWeight,
        ));
      }
    }

    return Advisor._(
      knowledge,
      repository,
      Retriever(documents),
      config,
      exactAsk,
    );
  }

  /// A handful of things worth asking, for the assistant's empty state. Drawn
  /// from the pack so they cannot drift away from what is actually answerable.
  List<String> suggestions() => [
        for (final id in const [
          'cpr_not_breathing',
          'choking_sequence',
          'cpr_rate',
          'aed_bra',
          'meta_trust',
        ])
          if (_knowledge.byId(id) case final card?) card.ask.first,
      ];

  /// The whole pipeline. Deterministic: the same sentence always produces the
  /// same guidance.
  Guidance advise(String utterance) {
    final query = lexicon.normalizer.normalize(utterance);

    if (query.isEmpty) {
      return Guidance(
        kind: GuidanceKind.unknown,
        utterance: utterance,
        display: 'I did not catch that. Say what you can see, '
            'or tap an emergency on the home screen.',
        body: '',
        prefix: 'I did not catch that.',
        suffix: 'Say it again, or tap what you can see on the screen.',
        confidence: 0,
      );
    }

    // 1. Coverage gaps veto everything else, red flags included. "My baby is
    //    not breathing" must NOT open the adult protocol — the adult technique
    //    is wrong for an infant, and the 2025 guidelines changed the infant
    //    technique specifically. Refusing is the safe answer here.
    final outOfScope = lexicon.matches(lexicon.outOfScope, query);
    if (outOfScope.isNotEmpty) {
      final gap = _bestAmong(
        query,
        (card) => card.kind == CardKind.coverageGap,
      );
      if (gap != null) return _fromCard(gap.card, query, gap.scored, GuidanceKind.coverageGap);
      return _unknown(utterance, query);
    }

    // 2. Red flags. A phrase like "not breathing" is not a search query, it is
    //    a finding. Retrieval is still run, but only inside the protocol the
    //    red flag names.
    final flags = lexicon.matches(lexicon.redFlags, query);
    if (flags.isNotEmpty) {
      final protocolId = flags.first.protocolId;
      if (protocolId != null && _repository.byId(protocolId) != null) {
        final best = _bestAmong(
          query,
          (card) => card.protocolId == protocolId && card.makesClinicalClaim,
        );
        if (best != null) {
          return _fromCard(
            best.card,
            query,
            best.scored,
            GuidanceKind.escalate,
            protocolId: protocolId,
          );
        }
        return _fromProtocol(_repository.requireById(protocolId), utterance, query);
      }
    }

    // 3. An exact phrasing the pack already claims.
    final exact = _exactAsk[query.words.join(' ')];
    if (exact != null) {
      final card = _knowledge.requireById(exact);
      return _fromCard(
        card,
        query,
        ScoredDocument(
          document: Document(id: 'exact:$exact', kind: DocumentKind.card,
              terms: const [], cardId: exact),
          score: 1,
          normalized: 1,
          coverage: 1,
          matched: query.terms.toSet(),
        ),
        null,
      );
    }

    // 4. Ordinary retrieval.
    final hits = _retriever.search(query, limit: 6);
    if (hits.isEmpty) return _unknown(utterance, query);

    final best = hits.first;

    // Two readings that lead to different protocols is the one case where
    // guessing is worse than asking. Adult choking and adult cardiac arrest are
    // three seconds apart and have completely different first actions.
    final rival = hits.skip(1).firstWhere(
          (h) =>
              h.document.protocolId != null &&
              best.document.protocolId != null &&
              h.document.protocolId != best.document.protocolId,
          orElse: () => best,
        );
    if (!identical(rival, best) &&
        _isEmergencyLevel(best) &&
        _isEmergencyLevel(rival) &&
        best.normalized >= config.hedgeScore &&
        (best.normalized - rival.normalized) < config.clarifyMargin) {
      return _clarify(utterance, query, best, rival);
    }

    if (best.normalized < config.hedgeScore) return _unknown(utterance, query);

    final hedged = best.normalized < config.confidentScore ||
        best.coverage < config.confidentCoverage;

    final cardId = best.document.cardId;
    if (cardId != null) {
      return _fromCard(
        _knowledge.requireById(cardId),
        query,
        best,
        null,
        hedged: hedged,
      );
    }

    // The match was raw protocol text rather than an authored card. Answer with
    // the step's own instruction, which is itself cited content.
    final protocolId = best.document.protocolId;
    final stepId = best.document.stepId;
    if (protocolId == null) return _unknown(utterance, query);
    final protocol = _repository.requireById(protocolId);
    if (stepId == null) return _fromProtocol(protocol, utterance, query, hedged: hedged);
    return _fromStep(protocol, protocol.requireStep(stepId), utterance, query, best,
        hedged: hedged);
  }

  /// True when this hit is a candidate answer to "which emergency is this?"
  /// rather than to a question inside one. Only that first kind of ambiguity is
  /// worth stopping to ask about — "when can I stop" scoring close on two
  /// protocols is not a real ambiguity, it is one word appearing twice.
  bool _isEmergencyLevel(ScoredDocument hit) {
    if (hit.document.kind == DocumentKind.protocol) return true;
    final cardId = hit.document.cardId;
    if (cardId == null) return false;
    return _knowledge.requireById(cardId).kind == CardKind.route;
  }

  ({KnowledgeCard card, ScoredDocument scored})? _bestAmong(
    NormalizedText query,
    bool Function(KnowledgeCard) predicate,
  ) {
    for (final hit in _retriever.search(query, limit: 20)) {
      final cardId = hit.document.cardId;
      if (cardId == null) continue;
      final card = _knowledge.requireById(cardId);
      if (predicate(card)) return (card: card, scored: hit);
    }
    return null;
  }

  Guidance _fromCard(
    KnowledgeCard card,
    NormalizedText query,
    ScoredDocument scored,
    GuidanceKind? forcedKind, {
    bool hedged = false,
    String? protocolId,
  }) {
    final kind = forcedKind ??
        switch (card.kind) {
          CardKind.route => GuidanceKind.route,
          CardKind.answer => GuidanceKind.answer,
          CardKind.coverageGap => GuidanceKind.coverageGap,
          CardKind.meta => GuidanceKind.meta,
        };

    return Guidance(
      kind: kind,
      utterance: query.raw,
      display: card.display,
      body: card.speech,
      prefix: hedged ? _hedgePrefix : '',
      suffix: switch (kind) {
        GuidanceKind.coverageGap => _call911,
        _ when hedged => _hedgeSuffix,
        _ => '',
      },
      confidence: scored.normalized,
      cardId: card.id,
      protocolId: protocolId ?? card.protocolId,
      protocolStepId: card.protocolStepId,
      sourceId: card.source,
      quote: card.quote,
      quoteKind: card.quoteKind,
      verified: card.verified,
      verificationNote: card.verificationNote,
      matched: scored.matched,
    );
  }

  Guidance _fromStep(
    Protocol protocol,
    ProtocolStep step,
    String utterance,
    NormalizedText query,
    ScoredDocument scored, {
    bool hedged = false,
  }) {
    return Guidance(
      kind: GuidanceKind.answer,
      utterance: utterance,
      display: '${step.instruction} — ${step.detail}',
      body: step.speech,
      prefix: hedged ? _hedgePrefix : '',
      suffix: hedged ? _hedgeSuffix : '',
      confidence: scored.normalized,
      protocolId: protocol.id,
      protocolStepId: step.id,
      sourceId: step.source,
      quote: step.quote,
      quoteKind: QuoteKind.verbatim,
      verified: step.verified,
      verificationNote: step.verificationNote,
      matched: scored.matched,
    );
  }

  Guidance _fromProtocol(
    Protocol protocol,
    String utterance,
    NormalizedText query, {
    bool hedged = false,
  }) {
    final entry = protocol.entryStep;
    return Guidance(
      kind: GuidanceKind.route,
      utterance: utterance,
      display: '${protocol.title} — ${protocol.subtitle}. ${protocol.summary}',
      body: entry.speech,
      prefix: hedged ? _hedgePrefix : '',
      suffix: hedged ? _hedgeSuffix : '',
      confidence: hedged ? config.hedgeScore : config.confidentScore,
      protocolId: protocol.id,
      protocolStepId: entry.id,
      sourceId: entry.source,
      quote: entry.quote,
      quoteKind: QuoteKind.verbatim,
      verified: entry.verified,
      verificationNote: entry.verificationNote,
    );
  }

  Guidance _clarify(
    String utterance,
    NormalizedText query,
    ScoredDocument best,
    ScoredDocument rival,
  ) {
    final a = _repository.requireById(best.document.protocolId!);
    final b = _repository.requireById(rival.document.protocolId!);
    return Guidance(
      kind: GuidanceKind.clarify,
      utterance: utterance,
      display: 'Which one is it?',
      body: '${a.title}, or ${b.title}?',
      suffix: 'Tell me which one it is.',
      confidence: best.normalized,
      matched: best.matched,
      options: [
        ClarifyOption(label: '${a.title} — ${a.subtitle}', protocolId: a.id),
        ClarifyOption(label: '${b.title} — ${b.subtitle}', protocolId: b.id),
      ],
    );
  }

  Guidance _unknown(String utterance, NormalizedText query) => Guidance(
        kind: GuidanceKind.unknown,
        utterance: utterance,
        display: 'I do not know that one. Call 911 and describe exactly what '
            'you can see — the dispatcher can coach anything.',
        body: '',
        prefix: 'I do not know that one.',
        suffix: _call911,
        confidence: 0,
        matched: query.terms.toSet(),
      );
}
