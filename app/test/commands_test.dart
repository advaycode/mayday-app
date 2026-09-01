import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/commands.dart';

import 'ai_fixture.dart';

void main() {
  late CommandGrammar grammar;

  setUp(() async {
    grammar = CommandGrammar((await loadKnowledge()).lexicon.normalizer);
  });

  test('the spoken commands are recognised', () {
    final cases = <String, VoiceCommandKind>{
      'next': VoiceCommandKind.next,
      'next step': VoiceCommandKind.next,
      'done': VoiceCommandKind.next,
      'ok next': VoiceCommandKind.next,
      'repeat': VoiceCommandKind.repeat,
      'say that again': VoiceCommandKind.repeat,
      'what did you say': VoiceCommandKind.repeat,
      "i'm alone": VoiceCommandKind.alone,
      'there is nobody here': VoiceCommandKind.alone,
      'too fast': VoiceCommandKind.slower,
      'slow down': VoiceCommandKind.slower,
      'faster': VoiceCommandKind.faster,
      'call 911': VoiceCommandKind.call,
      'be quiet': VoiceCommandKind.hush,
      'timeline': VoiceCommandKind.timeline,
      'help': VoiceCommandKind.help,
      'what do I do': VoiceCommandKind.help,
    };
    cases.forEach((utterance, kind) {
      expect(grammar.parse(utterance)?.kind, kind, reason: utterance);
    });
  });

  /// The failure this guards against is a protocol that advances because
  /// somebody in the room said a word. A command has to be the whole sentence.
  test('a question that contains a command word is not a command', () {
    for (final utterance in [
      'when do I stop',
      'how long until I stop pushing',
      'what do I do if they start breathing again',
      'should I call an ambulance or keep going',
      'is the next step the AED',
      'they are not breathing',
      'how fast should I push',
    ]) {
      expect(grammar.parse(utterance), isNull, reason: utterance);
    }
  });

  test('silence and noise are not commands', () {
    for (final utterance in ['', '   ', '...', 'uh', 'um']) {
      expect(grammar.parse(utterance), isNull, reason: '"$utterance"');
    }
  });

  test('the vocabulary is small enough to show the user', () {
    final phrases =
        grammar.vocabulary.values.expand((v) => v).toList(growable: false);
    expect(phrases.length, lessThan(50));
    expect(phrases.toSet().length, phrases.length,
        reason: 'a phrase claimed by two commands is ambiguous');
  });
}
