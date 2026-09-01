import '../data/protocol_repository.dart';
import 'advisor.dart';
import 'commands.dart';
import 'knowledge.dart';
import 'llm_router.dart';
import 'platform_speech.dart';
import 'speech.dart';
import 'voice_session.dart';

/// Everything the assistant needs, assembled once at startup.
///
/// Built before the first frame alongside the protocol corpus, because the
/// whole point is that asking a question is never gated on loading anything.
/// Cost is a few hundred KB of JSON and one pass to build the index.
class MaydayAi {
  MaydayAi._({
    required this.knowledge,
    required this.advisor,
    required this.grammar,
    required this.llmRouter,
    required this.allowlist,
  });

  final KnowledgeBase knowledge;
  final Advisor advisor;
  final CommandGrammar grammar;

  /// Off by default. See `llm_router.dart` for why a model is allowed to
  /// classify and never to compose.
  final LlmRouter llmRouter;
  final RoutingAllowlist allowlist;

  static Future<MaydayAi> load({
    required ProtocolRepository repository,
    Future<String> Function(String path)? loader,
    LlmRouter llmRouter = const DisabledLlmRouter(),
  }) async {
    final knowledge = await KnowledgeBase.load(loader: loader);
    return MaydayAi._(
      knowledge: knowledge,
      advisor: Advisor.build(knowledge: knowledge, repository: repository),
      grammar: CommandGrammar(knowledge.lexicon.normalizer),
      llmRouter: llmRouter,
      allowlist: RoutingAllowlist(repository.all.map((p) => p.id)),
    );
  }

  /// A fresh conversation. One per screen — the transcript belongs to the
  /// incident, not to the process.
  VoiceSession newSession({
    SpeechRecognizer? recognizer,
    Speaker? speaker,
  }) {
    if (recognizer != null && speaker != null) {
      return VoiceSession(
        advisor: advisor,
        recognizer: recognizer,
        speaker: speaker,
      );
    }
    final platform = buildPlatformSpeech();
    return VoiceSession(
      advisor: advisor,
      recognizer: recognizer ?? platform.recognizer,
      speaker: speaker ?? platform.speaker,
    );
  }
}
