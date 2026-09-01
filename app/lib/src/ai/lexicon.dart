import 'text.dart';

/// A named cluster of phrases that all mean the same emergency.
///
/// Concepts carry no medical content — they are purely the vocabulary that maps
/// what a frightened person says onto a protocol id. The instruction they lead
/// to comes from the cited corpus, never from here.
class Concept {
  const Concept({
    required this.id,
    required this.phrases,
    this.protocolId,
  });

  final String id;
  final String? protocolId;
  final List<String> phrases;

  factory Concept.fromJson(Map<String, dynamic> json) => Concept(
        id: json['id'] as String,
        protocolId: json['protocolId'] as String?,
        phrases: (json['phrases'] as List<dynamic>).cast<String>(),
      );
}

/// Vocabulary for the assistant, loaded from `assets/knowledge/lexicon.json`.
class Lexicon {
  Lexicon({
    required this.revision,
    required this.normalizer,
    required this.concepts,
    required this.redFlags,
    required this.outOfScope,
  });

  final String revision;
  final Normalizer normalizer;

  /// Topic vocabulary, used to bias retrieval.
  final List<Concept> concepts;

  /// Phrases that mean *stop searching and act*. A hit here outranks every
  /// retrieval score in the app — see [Advisor].
  final List<Concept> redFlags;

  /// Phrases for emergencies Mayday deliberately does not cover yet. A hit here
  /// must never be answered from a neighbouring protocol.
  final List<Concept> outOfScope;

  factory Lexicon.fromJson(Map<String, dynamic> json) {
    final synonyms = <String, String>{};
    final phrases = <String, String>{};
    final rawSynonyms = (json['synonyms'] as Map<String, dynamic>? ?? {});
    for (final entry in rawSynonyms.entries) {
      for (final variant in (entry.value as List<dynamic>).cast<String>()) {
        final words = rawTokens(variant);
        if (words.isEmpty) continue;
        if (words.length == 1) {
          synonyms[words.single] = entry.key;
        } else {
          phrases[words.join(' ')] = entry.key;
        }
      }
    }

    final contractions = <String, String>{
      for (final e in (json['contractions'] as Map<String, dynamic>? ?? {}).entries)
        e.key: e.value as String,
    };
    final numberWords = <String, String>{
      for (final e in (json['numberWords'] as Map<String, dynamic>? ?? {}).entries)
        e.key: e.value as String,
    };

    List<Concept> concepts(String key) =>
        ((json[key] as List<dynamic>?) ?? const [])
            .map((c) => Concept.fromJson(c as Map<String, dynamic>))
            .toList(growable: false);

    return Lexicon(
      revision: json['revision'] as String? ?? 'unknown',
      normalizer: Normalizer(
        contractions: contractions,
        numberWords: numberWords,
        stopwords:
            ((json['stopwords'] as List<dynamic>?) ?? const []).cast<String>().toSet(),
        negations:
            ((json['negations'] as List<dynamic>?) ?? const []).cast<String>().toSet(),
        synonymToCanonical: synonyms,
        phraseToCanonical: phrases,
      ),
      concepts: concepts('concepts'),
      redFlags: concepts('redFlags'),
      outOfScope: concepts('outOfScope'),
    );
  }

  /// Concept ids whose phrases appear in [text], as a whole phrase. Substring
  /// matching on the normalised *term* stream, not on raw characters, so
  /// "they're not breathing!!" hits the "not breathing" phrase and "breathing"
  /// alone does not.
  List<Concept> matches(List<Concept> pool, NormalizedText text) {
    final hits = <Concept>[];
    for (final concept in pool) {
      for (final phrase in concept.phrases) {
        if (containsPhrase(text, phrase)) {
          hits.add(concept);
          break;
        }
      }
    }
    return hits;
  }

  /// True when the normalised terms of [phrase] appear contiguously in [text].
  bool containsPhrase(NormalizedText text, String phrase) {
    final needle = normalizer.normalize(phrase).terms;
    if (needle.isEmpty) return false;
    final hay = text.terms;
    if (needle.length > hay.length) return false;
    for (var i = 0; i + needle.length <= hay.length; i++) {
      var match = true;
      for (var k = 0; k < needle.length; k++) {
        if (hay[i + k] != needle[k]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }
}
