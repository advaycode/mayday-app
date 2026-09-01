/// Text normalisation for the offline assistant.
///
/// Pure Dart, no Flutter, no I/O, no model. Everything here is deterministic
/// and unit-testable, which matters because this is the layer that decides
/// whether "she's not breathing" and "not breathing" are the same sentence.
///
/// The one non-obvious rule is negation. A first-aid corpus is full of pairs
/// that differ by a single word — *are they breathing* vs *they are not
/// breathing* — and a bag of words cannot tell them apart. So negation is
/// folded into the token itself: a negator binds to the next [negationScope]
/// content tokens and prefixes them with `not_`. "not breathing" becomes the
/// single token `not_breath`, which can never be matched by a document about
/// breathing.
library;

/// How many tokens after a negator are marked.
const int negationScope = 3;

/// Clause boundaries. Negation must not cross one.
///
/// Without this, "there is no network call anywhere in the app" leaks its
/// negator into the next sentence, and the phrase list of a knowledge card —
/// which is a list of separate sentences — turns half its vocabulary into
/// negatives. It is the kind of bug that produces a confidently wrong answer
/// and leaves no trace of why.
final RegExp clauseBoundary = RegExp('[.!?;:,\n]+');

const String negationPrefix = 'not_';

/// Splits on anything that is not a letter or a digit, lowercases, and drops
/// empties. Apostrophes are removed rather than split on, so "she's" arrives as
/// "shes" and is then expanded by the contraction table.
List<String> rawTokens(String input) {
  final buffer = StringBuffer();
  for (final rune in input.toLowerCase().runes) {
    final c = String.fromCharCode(rune);
    if (RegExp(r'[a-z0-9]').hasMatch(c)) {
      buffer.write(c);
    } else if (c == "'" || c == '’') {
      // Elide: don't -> dont, she's -> shes.
    } else {
      buffer.write(' ');
    }
  }
  return buffer
      .toString()
      .split(' ')
      .where((t) => t.isNotEmpty)
      .toList(growable: false);
}

/// A very small suffix stripper. Not Porter — Porter is more aggressive than
/// this corpus can afford ("breathing" and "breath" should collide, "chest"
/// and "chess" absolutely should not). Order matters: longest suffix first.
String stem(String token) {
  if (token.length <= 3) return token;

  const rules = <String, String>{
    'ies': 'y',
    'sses': 'ss',
    'ing': '',
    'ed': '',
    'ly': '',
    'es': '',
  };

  for (final entry in rules.entries) {
    if (token.endsWith(entry.key)) {
      final stripped =
          token.substring(0, token.length - entry.key.length) + entry.value;
      // Refuse to produce a stub. "does" -> "do" is fine, "ing" -> "" is not.
      if (stripped.length >= 3) return _undouble(stripped);
    }
  }

  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) {
    return token.substring(0, token.length - 1);
  }

  return token;
}

/// "pushh" -> "push", "stopp" -> "stop". Falls out of stripping "-ing"/"-ed"
/// from a doubled consonant ("pushing", "stopped").
String _undouble(String token) {
  if (token.length < 4) return token;
  final last = token[token.length - 1];
  final penultimate = token[token.length - 2];
  if (last == penultimate && !'aeiou'.contains(last)) {
    return token.substring(0, token.length - 1);
  }
  return token;
}

/// The result of normalising one utterance or one document.
class NormalizedText {
  const NormalizedText({
    required this.raw,
    required this.words,
    required this.terms,
  });

  /// The input, untouched.
  final String raw;

  /// Expanded, lowercased words before stopword removal and stemming. Kept
  /// because phrase matching needs word order and stopwords.
  final List<String> words;

  /// The scoring terms: stemmed, stopworded, negation-marked. Order preserved
  /// but only adjacency matters downstream.
  final List<String> terms;

  bool get isEmpty => terms.isEmpty;

  /// Word n-grams of length [n], as space-joined strings. Used for phrase hits.
  Set<String> ngrams(int n) {
    if (words.length < n) return const {};
    return {
      for (var i = 0; i + n <= words.length; i++) words.sublist(i, i + n).join(' '),
    };
  }

  @override
  String toString() => 'NormalizedText(${terms.join(' ')})';
}

/// Turns free text into comparable terms. Configured entirely from the bundled
/// lexicon asset so the vocabulary can be edited without touching Dart.
class Normalizer {
  const Normalizer({
    this.contractions = const {},
    this.stopwords = const {},
    this.negations = const {},
    this.numberWords = const {},
    this.synonymToCanonical = const {},
    this.phraseToCanonical = const {},
  });

  /// dont -> "do not"
  final Map<String, String> contractions;
  final Set<String> stopwords;
  final Set<String> negations;

  /// "five" -> "5"
  final Map<String, String> numberWords;

  /// Single-word synonym -> canonical word. "defibrillator" -> "aed".
  final Map<String, String> synonymToCanonical;

  /// Multi-word synonym -> canonical word. "passed out" -> "unresponsive".
  /// Applied over the word stream before stemming, longest phrase first.
  final Map<String, String> phraseToCanonical;

  /// Normalises a whole utterance, one clause at a time.
  NormalizedText normalize(String input) {
    final words = <String>[];
    final terms = <String>[];
    for (final clause in input.split(clauseBoundary)) {
      if (clause.trim().isEmpty) continue;
      final segment = normalizeClause(clause);
      words.addAll(segment.words);
      terms.addAll(segment.terms);
    }
    return NormalizedText(raw: input, words: words, terms: terms);
  }

  /// Normalises a list of separate phrases without letting one bleed into the
  /// next. Used to index a knowledge card, whose `ask` list is a set of
  /// unrelated sentences that must not be treated as one paragraph.
  NormalizedText normalizeAll(Iterable<String> inputs) {
    final words = <String>[];
    final terms = <String>[];
    for (final input in inputs) {
      final segment = normalize(input);
      words.addAll(segment.words);
      terms.addAll(segment.terms);
    }
    return NormalizedText(
      raw: inputs.join(' | '),
      words: words,
      terms: terms,
    );
  }

  NormalizedText normalizeClause(String input) {
    // 1. tokenize and expand contractions
    final expanded = <String>[];
    for (final token in rawTokens(input)) {
      final contraction = contractions[token];
      if (contraction != null) {
        expanded.addAll(contraction.split(' '));
      } else {
        expanded.add(token);
      }
    }

    // 2. collapse known multi-word phrases into their canonical single word
    final words = _applyPhrases(expanded);

    // 3. stopword removal + stemming + negation marking
    final terms = <String>[];
    var negationBudget = 0;
    for (final word in words) {
      if (negations.contains(word)) {
        negationBudget = negationScope;
        continue;
      }
      if (stopwords.contains(word)) continue;

      // Number words are folded late: "nine one one" must survive as a phrase
      // long enough to be collapsed to "911" in step 2.
      final digits = numberWords[word] ?? word;
      final canonical = synonymToCanonical[digits] ?? digits;
      final stemmed = stem(canonical);
      if (stemmed.isEmpty) continue;

      if (negationBudget > 0) {
        terms.add('$negationPrefix$stemmed');
        negationBudget--;
      } else {
        terms.add(stemmed);
      }
    }

    return NormalizedText(raw: input, words: words, terms: terms);
  }

  List<String> _applyPhrases(List<String> words) {
    if (phraseToCanonical.isEmpty) return words;

    // Longest first so "not waking up" beats "waking up".
    final byLength = phraseToCanonical.keys.toList()
      ..sort((a, b) => b.split(' ').length.compareTo(a.split(' ').length));

    final out = <String>[];
    var i = 0;
    outer:
    while (i < words.length) {
      for (final phrase in byLength) {
        final parts = phrase.split(' ');
        if (parts.length < 2 || i + parts.length > words.length) continue;
        var match = true;
        for (var k = 0; k < parts.length; k++) {
          if (words[i + k] != parts[k]) {
            match = false;
            break;
          }
        }
        if (match) {
          out.add(phraseToCanonical[phrase]!);
          i += parts.length;
          continue outer;
        }
      }
      out.add(words[i]);
      i++;
    }
    return out;
  }
}
