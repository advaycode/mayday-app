/// Optional Tier B: an on-device language model, used for exactly one job.
///
/// Mayday's position on language models is narrow and deliberate. A model may
/// **classify** — turn "he went down in the driveway and he's not moving" into
/// the id `cpr_adult`. A model may never **compose** the instruction that
/// follows. Instructions come from the cited corpus, always.
///
/// That split exists because of a real, currently-open gap in the tooling:
/// `flutter_gemma` has no constrained decoding
/// (github.com/DenisovAV/flutter_gemma#195), so nothing stops a model from
/// returning prose where a protocol id was asked for. The mitigation is this
/// file: whatever comes back is parsed, matched against an allowlist of ids the
/// corpus actually defines, and discarded on any miss. A model that hallucinates
/// `cpr_infant` produces a fallback, not a wrong protocol.
///
/// Nothing here imports an inference runtime. [LlmRouter] is an interface and
/// the shipping default is [DisabledLlmRouter], so the app builds, runs, and is
/// demoed with no model file present. A model is an accelerator on top of a
/// deterministic path that already works — the same rule the microphone follows.
library;

/// What the model was asked to choose between, and what it may return.
class RoutingAllowlist {
  RoutingAllowlist(Iterable<String> protocolIds)
      : ids = Set.unmodifiable(protocolIds.toSet());

  final Set<String> ids;

  /// Pulls the first allowed id out of arbitrary model output.
  ///
  /// Tolerant on purpose: a small model asked for `cpr_adult` will variously
  /// answer `cpr_adult`, `"cpr_adult"`, `{"protocol": "cpr_adult"}` or
  /// `The answer is cpr_adult.` — all four are fine. Anything containing no
  /// allowed id at all returns null, and null means "use the deterministic
  /// path", never "guess".
  String? extract(String modelOutput) {
    final haystack = modelOutput.toLowerCase();
    String? best;
    var bestIndex = haystack.length;
    for (final id in ids) {
      final index = haystack.indexOf(id.toLowerCase());
      if (index >= 0 && index < bestIndex) {
        best = id;
        bestIndex = index;
      }
    }
    return best;
  }
}

class LlmRouting {
  const LlmRouting({
    required this.protocolId,
    required this.raw,
    required this.latency,
  });

  final String protocolId;
  final String raw;
  final Duration latency;
}

/// Turns an utterance into a protocol id, or gives up.
abstract interface class LlmRouter {
  bool get isAvailable;

  /// Returns null when the model is unavailable, too slow, or produced nothing
  /// on the allowlist. Callers must treat null as "carry on deterministically".
  Future<LlmRouting?> route(String utterance, RoutingAllowlist allowlist);
}

/// The shipping default: no model, no download, no latency. The app is fully
/// functional with this in place, which is the point.
class DisabledLlmRouter implements LlmRouter {
  const DisabledLlmRouter();

  @override
  bool get isAvailable => false;

  @override
  Future<LlmRouting?> route(String utterance, RoutingAllowlist allowlist) async =>
      null;
}

/// Wraps a router in the two guarantees the incident path needs: a hard
/// deadline, and validation of whatever comes back.
///
/// The deadline matters more than it looks. A 270M model on a mid-range phone
/// can take several seconds on a cold first token, and several seconds is an
/// unacceptable amount of time to stand over someone in cardiac arrest holding
/// a phone that is thinking. If the model has not answered by [budget], the
/// deterministic answer wins and the model's reply is dropped when it arrives.
class GuardedLlmRouter implements LlmRouter {
  GuardedLlmRouter(
    this._inner, {
    this.budget = const Duration(milliseconds: 900),
  });

  final LlmRouter _inner;
  final Duration budget;

  /// Set when the last call was abandoned on the deadline. Surfaced in the
  /// diagnostics screen rather than hidden.
  bool lastCallTimedOut = false;

  @override
  bool get isAvailable => _inner.isAvailable;

  @override
  Future<LlmRouting?> route(String utterance, RoutingAllowlist allowlist) async {
    if (!_inner.isAvailable) return null;
    lastCallTimedOut = false;

    final LlmRouting? result;
    try {
      result = await _inner.route(utterance, allowlist).timeout(
        budget,
        onTimeout: () {
          lastCallTimedOut = true;
          return null;
        },
      );
    } catch (_) {
      // A model failure must never take the app with it.
      return null;
    }

    if (result == null) return null;

    final id = allowlist.extract(result.raw);
    if (id == null) return null;
    return LlmRouting(protocolId: id, raw: result.raw, latency: result.latency);
  }
}
