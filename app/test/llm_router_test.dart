import 'package:flutter_test/flutter_test.dart';
import 'package:mayday/src/ai/llm_router.dart';

class _StubRouter implements LlmRouter {
  _StubRouter(this.output, {this.delay = Duration.zero, this.available = true});

  final String output;
  final Duration delay;
  final bool available;
  int calls = 0;

  @override
  bool get isAvailable => available;

  @override
  Future<LlmRouting?> route(String utterance, RoutingAllowlist allowlist) async {
    calls++;
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    return LlmRouting(protocolId: output, raw: output, latency: delay);
  }
}

class _ThrowingRouter implements LlmRouter {
  @override
  bool get isAvailable => true;

  @override
  Future<LlmRouting?> route(String utterance, RoutingAllowlist allowlist) async {
    throw StateError('the model fell over');
  }
}

void main() {
  final allowlist = RoutingAllowlist(['cpr_adult', 'choking_adult']);

  group('allowlist', () {
    /// `flutter_gemma` has no constrained decoding (issue #195 is open), so a
    /// small model asked for an id will variously answer with quotes, JSON, or
    /// a whole sentence. All of those are fine.
    test('pulls an id out of whatever shape the model returns', () {
      const shapes = [
        'cpr_adult',
        '"cpr_adult"',
        '{"protocol": "cpr_adult"}',
        'The answer is cpr_adult.',
        'CPR_ADULT',
        '  cpr_adult\n',
      ];
      for (final shape in shapes) {
        expect(allowlist.extract(shape), 'cpr_adult', reason: shape);
      }
    });

    /// The mitigation that makes a model safe to have here at all.
    test('a protocol the corpus does not have is rejected outright', () {
      for (final hallucination in [
        'cpr_infant',
        'anaphylaxis',
        'I would start rescue breaths and elevate the legs',
        '',
        'null',
      ]) {
        expect(allowlist.extract(hallucination), isNull, reason: hallucination);
      }
    });

    test('the first allowed id in the output wins', () {
      expect(allowlist.extract('choking_adult, then cpr_adult'),
          'choking_adult');
    });
  });

  group('guard', () {
    test('the shipping default is no model at all', () async {
      const router = DisabledLlmRouter();
      expect(router.isAvailable, isFalse);
      expect(await router.route('anything', allowlist), isNull);
    });

    test('a valid answer passes through', () async {
      final router = GuardedLlmRouter(_StubRouter('cpr_adult'));
      final result = await router.route('he is not breathing', allowlist);
      expect(result?.protocolId, 'cpr_adult');
    });

    test('off-allowlist output is dropped, not passed on', () async {
      final router = GuardedLlmRouter(_StubRouter('cpr_infant'));
      expect(await router.route('my baby is not breathing', allowlist), isNull);
    });

    /// A model that has not answered in time is a model that has lost. Several
    /// seconds is an unacceptable amount of time to stand over somebody in
    /// cardiac arrest holding a phone that is thinking.
    test('a slow model is abandoned on the deadline', () async {
      final router = GuardedLlmRouter(
        _StubRouter('cpr_adult', delay: const Duration(milliseconds: 200)),
        budget: const Duration(milliseconds: 20),
      );
      expect(await router.route('he is not breathing', allowlist), isNull);
      expect(router.lastCallTimedOut, isTrue);
    });

    test('a model that crashes does not take the app with it', () async {
      final router = GuardedLlmRouter(_ThrowingRouter());
      expect(await router.route('he is not breathing', allowlist), isNull);
    });

    test('an unavailable model is never called', () async {
      final stub = _StubRouter('cpr_adult', available: false);
      final router = GuardedLlmRouter(stub);
      expect(await router.route('anything', allowlist), isNull);
      expect(stub.calls, 0);
    });
  });
}
