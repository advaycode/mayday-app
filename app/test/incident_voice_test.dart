import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/commands.dart';
import 'package:mayday/src/ai/speech.dart';
import 'package:mayday/src/ai/voice_session.dart';
import 'package:mayday/src/data/protocol_repository.dart';
import 'package:mayday/src/engine/incident_engine.dart';
import 'package:mayday/src/features/incident/incident_voice.dart';

import 'ai_fixture.dart';

void main() {
  late ProtocolRepository repository;
  late IncidentEngine engine;
  late VoiceSession session;
  late FakeRecognizer mic;
  late FakeSpeaker voice;
  late IncidentVoiceController coach;
  var nextCalls = 0;
  var aloneCalls = 0;
  var callCalls = 0;
  var timelineCalls = 0;

  setUp(() async {
    final advisor = await loadAdvisor();
    repository = await loadRepository();
    engine = IncidentEngine(
      repository: repository,
      protocol: repository.requireById('cpr_adult'),
    );
    mic = FakeRecognizer();
    voice = FakeSpeaker();
    session = VoiceSession(advisor: advisor, recognizer: mic, speaker: voice);
    nextCalls = aloneCalls = callCalls = timelineCalls = 0;

    coach = IncidentVoiceController(
      session: session,
      engine: engine,
      grammar: CommandGrammar(advisor.lexicon.normalizer),
      actions: IncidentVoiceActions(
        next: () => nextCalls++,
        alone: () => aloneCalls++,
        call: () => callCalls++,
        timeline: () => timelineCalls++,
      ),
    );
    await coach.start();
  });

  tearDown(() {
    coach.dispose();
    session.dispose();
    engine.dispose();
  });

  test('entering a step reads that step out, verbatim', () async {
    expect(voice.spoken, [engine.step.speech]);
  });

  test('a step change is announced and never repeated', () async {
    voice.spoken.clear();
    engine.choose(engine.step.choices.first);
    await Future<void>.delayed(Duration.zero);

    expect(voice.spoken, [engine.step.speech]);

    // Notifying again without a step change must not re-read the instruction.
    engine.note('something happened');
    await Future<void>.delayed(Duration.zero);
    expect(voice.spoken.length, 1);
  });

  test('a command drives the incident', () async {
    await coach.handle('next');
    expect(nextCalls, 1);

    await coach.handle("i'm alone");
    expect(aloneCalls, 1);

    await coach.handle('call 911');
    expect(callCalls, 1);

    await coach.handle('timeline');
    expect(timelineCalls, 1);
  });

  test('a command is written into the EMS timeline', () async {
    await coach.handle('next');
    expect(
      engine.timeline.map((e) => e.label),
      contains(contains('Voice: "next"')),
    );
  });

  /// The rule that separates asking from doing. Somebody standing over a
  /// collapsed person will say "should I stop?" out loud. That is a question,
  /// and answering it must not skip a step of the protocol.
  test('a question answers without moving the protocol', () async {
    final before = engine.step.id;

    final guidance = await coach.handle('how fast should I push');

    expect(guidance, isNotNull);
    expect(guidance!.cardId, 'cpr_rate');
    expect(engine.step.id, before);
    expect(nextCalls, 0);
  });

  test('repeat re-reads the current step', () async {
    voice.spoken.clear();
    await coach.handle('say that again');
    expect(voice.spoken, [engine.step.speech]);
  });

  test('what do I do reads the step with its supporting line', () async {
    voice.spoken.clear();
    await coach.handle('what do I do');
    expect(voice.spoken.single, contains(engine.step.speech));
    expect(voice.spoken.single, contains(engine.step.detail));
  });

  /// The claim the whole feature rests on: during an incident, the voice reads
  /// vetted content. It does not narrate, summarise or improvise.
  test('everything said during an incident traces back to the corpus',
      () async {
    final knowledge = await loadKnowledge();
    final authored = <String>{
      for (final protocol in repository.all)
        for (final step in protocol.steps) ...[
          step.speech,
          '${step.speech} ${step.detail}',
        ],
      for (final card in knowledge.cards) card.speech,
    };

    voice.spoken.clear();
    for (final utterance in [
      'next',
      'say that again',
      'what do I do',
      'how fast should I push',
      'where do I put my hands',
      'they are on a bed',
    ]) {
      await coach.handle(utterance);
    }

    for (final line in voice.spoken) {
      final body = line
          .replaceAll('I think you mean:', '')
          .replaceAll('I am not certain, so check this yourself.', '')
          .replaceAll('Call nine one one now.', '')
          .trim();
      if (body.isEmpty) continue;
      expect(authored, contains(body), reason: 'unauthored line: "$line"');
    }
  });

  test('losing the microphone does not touch the incident', () async {
    final before = engine.step.id;
    await mic.setAvailability(MicAvailability.silencedByCall);

    expect(session.state, VoiceState.deaf);
    expect(engine.step.id, before);
    // ...and the touch path is untouched.
    engine.choose(engine.step.choices.first);
    expect(engine.step.id, isNot(before));
  });
}
