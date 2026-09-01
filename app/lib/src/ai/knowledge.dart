import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'lexicon.dart';

/// What a card is for.
enum CardKind {
  /// Answers the question *and* offers to start a protocol.
  route,

  /// Answers a question inside a protocol Mayday already covers.
  answer,

  /// An emergency Mayday deliberately does not cover yet. A coverage-gap card
  /// makes NO clinical claim. It names the gap and hands the caller to a
  /// dispatcher. This is the honest answer, and it is the one thing a
  /// generative model in this position cannot be relied upon to give.
  coverageGap,

  /// About the app itself — what it knows, where the content came from,
  /// whether it needs a signal. No clinical claim.
  meta,
}

/// How closely [KnowledgeCard.quote] tracks the source document.
enum QuoteKind {
  /// Transcribed character-for-character.
  verbatim,

  /// Written from the source but not transcribed. A paraphrase can never be
  /// marked verified — `knowledge_test.dart` enforces that.
  paraphrase,

  /// The card makes no clinical claim, so there is nothing to cite.
  none,
}

/// One answer the assistant is allowed to give.
///
/// The important property: [display] and [speech] are fixed strings authored
/// against a source. The assistant chooses *which* card to return. It never
/// writes one. That is what makes the answer surface auditable — the set of
/// sentences Mayday can say is finite, reviewable, and checked into git.
class KnowledgeCard {
  const KnowledgeCard({
    required this.id,
    required this.kind,
    required this.ask,
    required this.display,
    required this.speech,
    required this.quoteKind,
    required this.verified,
    required this.tags,
    this.protocolId,
    this.protocolStepId,
    this.source,
    this.quote,
    this.verificationNote,
  });

  final String id;
  final CardKind kind;

  /// The ways people ask this. Indexed for retrieval; also the honest answer to
  /// "what can it understand?" — you can read the whole set.
  final List<String> ask;

  /// The on-screen answer.
  final String display;

  /// The spoken answer. Separate because "911" reads right and must be said
  /// "nine one one", and because spoken guidance is shorter than written.
  final String speech;

  /// Protocol this card can start or belongs to.
  final String? protocolId;
  final String? protocolStepId;

  /// Source id in `assets/protocols/sources.json`. Null only for cards that
  /// make no clinical claim.
  final String? source;
  final String? quote;
  final QuoteKind quoteKind;

  final bool verified;
  final String? verificationNote;
  final List<String> tags;

  bool get makesClinicalClaim =>
      kind == CardKind.route || kind == CardKind.answer;

  /// Everything about this card that should be searchable.
  ///
  /// The `ask` phrasings are repeated so they outweigh the answer text. A card
  /// is found by the question somebody asks, not by the words in its answer —
  /// without this, "are you a doctor" matches the aftercare card that happens
  /// to say "they still need to see a doctor".
  List<String> get indexSegments => [
        ...ask,
        ...ask,
        ...ask,
        display,
        ...tags,
      ];

  factory KnowledgeCard.fromJson(Map<String, dynamic> json) {
    final kindName = json['kind'] as String;
    final quoteKindName = json['quoteKind'] as String? ?? 'none';
    return KnowledgeCard(
      id: json['id'] as String,
      kind: CardKind.values.firstWhere(
        (k) => k.name == kindName,
        orElse: () => throw FormatException('Unknown card kind "$kindName"'),
      ),
      ask: (json['ask'] as List<dynamic>).cast<String>(),
      display: json['display'] as String,
      speech: json['speech'] as String,
      protocolId: json['protocolId'] as String?,
      protocolStepId: json['protocolStepId'] as String?,
      source: json['source'] as String?,
      quote: json['quote'] as String?,
      quoteKind: QuoteKind.values.firstWhere(
        (q) => q.name == quoteKindName,
        orElse: () =>
            throw FormatException('Unknown quoteKind "$quoteKindName"'),
      ),
      verified: json['verified'] as bool? ?? false,
      verificationNote: json['verificationNote'] as String?,
      tags: ((json['tags'] as List<dynamic>?) ?? const []).cast<String>(),
    );
  }
}

/// The bundled knowledge the assistant can draw on: the vocabulary plus every
/// answer card. Offline by construction — there is no network client in this
/// file and there must never be one.
class KnowledgeBase {
  KnowledgeBase._(this.revision, this.lexicon, this._cards);

  final String revision;
  final Lexicon lexicon;
  final Map<String, KnowledgeCard> _cards;

  static const String _dir = 'assets/knowledge';

  Iterable<KnowledgeCard> get cards => _cards.values;
  KnowledgeCard? byId(String id) => _cards[id];

  KnowledgeCard requireById(String id) {
    final card = _cards[id];
    if (card == null) throw StateError('No knowledge card "$id"');
    return card;
  }

  /// Reads the packs from the asset bundle. Takes a loader so tests can read
  /// straight off disk without a Flutter binding.
  static Future<KnowledgeBase> load({
    Future<String> Function(String path)? loader,
  }) async {
    final read = loader ?? rootBundle.loadString;

    final index =
        jsonDecode(await read('$_dir/index.json')) as Map<String, dynamic>;
    final revision = index['packRevision'] as String;

    final lexiconJson = jsonDecode(
        await read('$_dir/${index['lexicon']}.json')) as Map<String, dynamic>;
    final lexicon = Lexicon.fromJson(lexiconJson);

    final cards = <String, KnowledgeCard>{};
    for (final packId in (index['packs'] as List<dynamic>).cast<String>()) {
      final pack =
          jsonDecode(await read('$_dir/$packId.json')) as Map<String, dynamic>;
      for (final raw in (pack['cards'] as List<dynamic>)) {
        final card = KnowledgeCard.fromJson(raw as Map<String, dynamic>);
        if (cards.containsKey(card.id)) {
          throw FormatException('Duplicate knowledge card id "${card.id}"');
        }
        cards[card.id] = card;
      }
    }

    return KnowledgeBase._(revision, lexicon, cards);
  }

  /// Integrity problems. Empty means the pack is coherent. Run from a test so a
  /// bad edit cannot ship.
  List<String> validate({
    required Set<String> knownSourceIds,
    required Set<String> knownProtocolIds,
    required bool Function(String protocolId, String stepId) stepExists,
  }) {
    final problems = <String>[];

    for (final card in _cards.values) {
      if (card.ask.isEmpty) {
        problems.add('${card.id}: no "ask" phrasings, so it can never be found');
      }
      if (card.display.trim().isEmpty || card.speech.trim().isEmpty) {
        problems.add('${card.id}: empty display or speech');
      }

      if (card.makesClinicalClaim) {
        final source = card.source;
        if (source == null) {
          problems.add('${card.id}: clinical card with no source');
        } else if (!knownSourceIds.contains(source)) {
          problems.add('${card.id}: unknown source "$source"');
        }
        if ((card.quote ?? '').trim().isEmpty) {
          problems.add('${card.id}: clinical card with no supporting quote');
        }
        if (card.quoteKind == QuoteKind.none) {
          problems.add('${card.id}: clinical card must declare a quoteKind');
        }
      } else {
        if (card.quoteKind != QuoteKind.none) {
          problems.add('${card.id}: ${card.kind.name} card should not cite; it '
              'makes no clinical claim');
        }
      }

      // A paraphrase is by definition not confirmed against the source.
      if (card.quoteKind == QuoteKind.paraphrase && card.verified) {
        problems.add('${card.id}: paraphrased quote cannot be marked verified');
      }
      if (!card.verified &&
          (card.verificationNote ?? '').trim().isEmpty &&
          card.makesClinicalClaim) {
        problems.add('${card.id}: unverified card must explain why');
      }

      final protocolId = card.protocolId;
      if (protocolId != null) {
        if (!knownProtocolIds.contains(protocolId)) {
          problems.add('${card.id}: unknown protocol "$protocolId"');
        } else if (card.protocolStepId != null &&
            !stepExists(protocolId, card.protocolStepId!)) {
          problems.add('${card.id}: unknown step '
              '"$protocolId.${card.protocolStepId}"');
        }
      }

      // Coverage-gap cards exist to refuse. One that quietly routes into a
      // protocol would defeat the point.
      if (card.kind == CardKind.coverageGap && card.protocolId != null) {
        problems.add('${card.id}: a coverage gap must not route to a protocol');
      }
    }

    return problems;
  }
}
