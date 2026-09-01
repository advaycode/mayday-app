import 'text.dart';

/// Hands-free control of a running incident.
enum VoiceCommandKind {
  /// Advance one step, or count one repetition.
  next,

  /// Say the current step again.
  repeat,

  /// The user is on their own — take the alone branch.
  alone,

  /// Slow the metronome down / speed it up, within the guideline band.
  slower,
  faster,

  /// Place the 911 call from this phone.
  call,

  /// Stop talking. Someone is trying to hear the dispatcher.
  hush,

  /// Show the EMS handoff timeline.
  timeline,

  /// "What do I do" — repeat the step and read the detail line too.
  help,
}

class VoiceCommand {
  const VoiceCommand({required this.kind, required this.phrase});

  final VoiceCommandKind kind;

  /// The phrase that matched, for the transcript.
  final String phrase;
}

/// Recognises a small, fixed set of spoken commands.
///
/// Two rules keep this from firing on ordinary speech, which matters because
/// the alternative is a phone that advances the protocol because somebody in
/// the room said the word "next":
///
///  1. Matching is on the *word* stream, not the stemmed search terms. Commands
///     are two or three words long and stemming destroys them — "what do I do"
///     is entirely stopwords and normalises to nothing at all.
///  2. A command must be effectively the whole utterance. "Stop" is a command;
///     "when do I stop" is a question, and goes to the advisor instead. The
///     allowance is [slack] extra words, no more.
class CommandGrammar {
  CommandGrammar(this._normalizer) {
    for (final entry in _phrases.entries) {
      for (final phrase in entry.value) {
        _compiled.add((
          kind: entry.key,
          phrase: phrase,
          words: _normalizer.normalize(phrase).words,
        ));
      }
    }
    // Longest first: "go back" must beat "back", "next step" must beat "next".
    _compiled.sort((a, b) => b.words.length.compareTo(a.words.length));
  }

  final Normalizer _normalizer;

  /// Extra words tolerated around a command before it stops counting as one.
  static const int slack = 2;

  final List<({VoiceCommandKind kind, String phrase, List<String> words})>
      _compiled = [];

  static const Map<VoiceCommandKind, List<String>> _phrases = {
    VoiceCommandKind.next: [
      'next',
      'next step',
      'done',
      'go on',
      'continue',
      'ok next',
      'okay next',
      'what next',
      'that is done',
    ],
    VoiceCommandKind.repeat: [
      'repeat',
      'again',
      'say that again',
      'say it again',
      'what did you say',
      'i missed that',
    ],
    VoiceCommandKind.alone: [
      'i am alone',
      'i am on my own',
      'nobody else is here',
      'no one else is here',
      'there is nobody here',
    ],
    VoiceCommandKind.slower: ['slower', 'too fast', 'slow down'],
    VoiceCommandKind.faster: ['faster', 'too slow', 'speed up'],
    VoiceCommandKind.call: ['call 911', 'call for help', 'phone 911'],
    VoiceCommandKind.hush: ['stop talking', 'be quiet', 'quiet', 'shush'],
    VoiceCommandKind.timeline: ['timeline', 'what happened', 'show the timeline'],
    VoiceCommandKind.help: [
      'help',
      'what do i do',
      'i do not know what to do',
      'tell me what to do',
    ],
  };

  /// Every phrase the app listens for, so the UI can show the user the whole
  /// list rather than making them guess at a hidden vocabulary.
  Map<VoiceCommandKind, List<String>> get vocabulary => _phrases;

  VoiceCommand? parse(String utterance) {
    final normalized = _normalizer.normalize(utterance);
    final words = normalized.words;
    if (words.isEmpty) return null;

    for (final candidate in _compiled) {
      if (candidate.words.isEmpty) continue;
      if (words.length > candidate.words.length + slack) continue;
      if (_containsSequence(words, candidate.words)) {
        return VoiceCommand(kind: candidate.kind, phrase: candidate.phrase);
      }
    }
    return null;
  }

  static bool _containsSequence(List<String> haystack, List<String> needle) {
    if (needle.length > haystack.length) return false;
    for (var i = 0; i + needle.length <= haystack.length; i++) {
      var match = true;
      for (var k = 0; k < needle.length; k++) {
        if (haystack[i + k] != needle[k]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }
}
