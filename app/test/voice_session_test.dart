import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/advisor.dart';
import 'package:mayday/src/ai/speech.dart';
import 'package:mayday/src/ai/voice_session.dart';

import 'ai_fixture.dart';

void main() {
  late Advisor advisor;
  late FakeRecognizer mic;
  late FakeSpeaker voice;
  late VoiceSession session;

  setUp(() async {
    advisor = await loadAdvisor();
    mic = FakeRecognizer();
    voice = FakeSpeaker();
    session = VoiceSession(advisor: advisor, recognizer: mic, speaker: voice);
    await session.initialize();
  });

  tearDown(() => session.dispose());

  test('a heard sentence is answered out loud and recorded', () async {
    await mic.hear("he's not breathing");

    expect(voice.spoken, isNotEmpty);
    expect(voice.spoken.last, contains('Start C P R'));
    expect(session.latest?.protocolId, 'cpr_adult');

    expect(session.transcript.map((t) => t.who),
        containsAllInOrder([Speakerphone.user, Speakerphone.mayday]));
    expect(session.transcript.first.text, "he's not breathing");
  });

  test('a question that resolves to a protocol offers it to the screen',
      () async {
    Guidance? suggested;
    session.onProtocolSuggested = (g) => suggested = g;

    await mic.hear('someone is choking');

    expect(suggested, isNotNull);
    expect(suggested!.protocolId, 'choking_adult');
  });

  /// Barge-in. Nobody in an emergency should have to wait politely for a phone
  /// to finish a sentence before it will listen to them.
  test('the assistant stops talking the moment the user starts', () async {
    voice.holdOpen = true;
    await session.ask('how fast should I push');
    expect(voice.isSpeaking, isTrue);

    await mic.hear('wait', isFinal: false);
    expect(voice.stopCalls, greaterThan(0));
  });

  group('losing the microphone', () {
    /// The finding this whole design turns on: an app cannot record while a
    /// call is up, on either platform, and Android does not report an error —
    /// it just delivers silence. Going quietly deaf mid-incident is the failure
    /// mode being engineered out here, so the handover has to be *said*.
    test('a call going up is announced out loud, not absorbed', () async {
      await mic.setAvailability(MicAvailability.silencedByCall);

      expect(session.state, VoiceState.deaf);
      expect(voice.spoken.last, contains('cannot hear you'));
      expect(voice.priorities.last, SpeechPriority.interrupt);
    });

    test('the announcement is made once, not on a loop', () async {
      await mic.setAvailability(MicAvailability.silencedByCall);
      final after = voice.spoken.length;
      await mic.setAvailability(MicAvailability.silencedByCall);
      expect(voice.spoken.length, after);
    });

    test('the microphone is not opened while it cannot hear', () async {
      await mic.setAvailability(MicAvailability.silencedByCall);
      final before = mic.listenCalls;
      await session.startListening();
      expect(mic.listenCalls, before);
    });

    test('a refused permission degrades the same way', () async {
      await mic.setAvailability(MicAvailability.deniedByUser);
      expect(session.state, VoiceState.deaf);
      expect(voice.spoken.last, contains('Tap anywhere'));
    });

    test('the call ending brings listening back', () async {
      await mic.setAvailability(MicAvailability.silencedByCall);
      await mic.setAvailability(MicAvailability.available);
      expect(session.state, isNot(VoiceState.deaf));

      await session.startListening();
      expect(mic.listenCalls, 1);
    });
  });

  test('typing and speaking take the identical path', () async {
    final spoken = await session.ask('where do I put my hands');
    final typedSession = VoiceSession(
      advisor: advisor,
      recognizer: FakeRecognizer(),
      speaker: FakeSpeaker(),
    );
    await typedSession.initialize();
    final typed = await typedSession.ask('where do I put my hands');

    expect(typed.cardId, spoken.cardId);
    expect(typed.speech, spoken.speech);
    typedSession.dispose();
  });
}
