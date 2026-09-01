import 'dart:math' as math;

import 'text.dart';

enum DocumentKind {
  /// An authored answer card.
  card,

  /// One step of a protocol, indexed so "where do I put my hands" can find the
  /// instruction even when nobody wrote a card for it.
  step,

  /// A protocol's title and summary.
  protocol,
}

class Document {
  Document({
    required this.id,
    required this.kind,
    required this.terms,
    this.cardId,
    this.protocolId,
    this.stepId,
    this.weight = 1.0,
  });

  final String id;
  final DocumentKind kind;
  final List<String> terms;
  final String? cardId;
  final String? protocolId;
  final String? stepId;

  /// Multiplier applied after scoring. Authored cards outrank raw protocol text
  /// because a card was written to answer a question and a step was not.
  final double weight;

  late final Map<String, int> frequencies = () {
    final counts = <String, int>{};
    for (final term in terms) {
      counts[term] = (counts[term] ?? 0) + 1;
    }
    return counts;
  }();
}

class ScoredDocument {
  const ScoredDocument({
    required this.document,
    required this.score,
    required this.normalized,
    required this.coverage,
    required this.matched,
  });

  final Document document;

  /// Raw BM25, weighted.
  final double score;

  /// [score] scaled into roughly 0..1 against the best score this query could
  /// possibly achieve. Comparable across queries, which raw BM25 is not — and
  /// the assistant needs a comparable number to decide whether it knows the
  /// answer or should say so.
  final double normalized;

  /// Fraction of the query's distinct terms that appear in the document.
  final double coverage;

  final Set<String> matched;
}

/// Okapi BM25 over the bundled corpus.
///
/// Chosen over an embedding model on purpose. It needs no weights file, no
/// runtime, no warm-up and no GPU; it runs in well under a millisecond on a
/// corpus this size; and — the part that matters here — its output is
/// *explainable*. Every answer can show which words matched, which is exactly
/// what a first-aid app owes its user. See `docs/ASSISTANT.md`.
class Retriever {
  Retriever(this.documents, {this.k1 = 1.5, this.b = 0.75}) {
    var totalLength = 0;
    for (final document in documents) {
      totalLength += document.terms.length;
      for (final term in document.frequencies.keys) {
        _documentFrequency[term] = (_documentFrequency[term] ?? 0) + 1;
      }
    }
    _averageLength = documents.isEmpty ? 1 : totalLength / documents.length;
  }

  final List<Document> documents;
  final double k1;
  final double b;

  final Map<String, int> _documentFrequency = {};
  late final double _averageLength;

  double _idf(String term) {
    final df = _documentFrequency[term] ?? 0;
    final n = documents.length;
    return math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  List<ScoredDocument> search(NormalizedText query, {int limit = 5}) {
    final queryTerms = query.terms.toSet();
    if (queryTerms.isEmpty || documents.isEmpty) return const [];

    // The best score any document could get for this query: every term present,
    // fully saturated, in a document of average length.
    var ceiling = 0.0;
    for (final term in queryTerms) {
      ceiling += _idf(term) * (k1 + 1);
    }
    if (ceiling <= 0) return const [];

    final results = <ScoredDocument>[];
    for (final document in documents) {
      var score = 0.0;
      final matched = <String>{};
      final length = document.terms.length;

      for (final term in queryTerms) {
        final tf = document.frequencies[term];
        if (tf == null) continue;
        matched.add(term);
        final numerator = tf * (k1 + 1);
        final denominator =
            tf + k1 * (1 - b + b * (length / _averageLength));
        score += _idf(term) * (numerator / denominator);
      }

      if (matched.isEmpty) continue;
      score *= document.weight;

      results.add(ScoredDocument(
        document: document,
        score: score,
        normalized: (score / ceiling).clamp(0.0, 1.0),
        coverage: matched.length / queryTerms.length,
        matched: matched,
      ));
    }

    results.sort((a, b) => b.score.compareTo(a.score));
    return results.length <= limit ? results : results.sublist(0, limit);
  }
}
