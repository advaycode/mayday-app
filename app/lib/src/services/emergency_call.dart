import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Places the 911 call.
///
/// SAFETY: dialling emergency services by accident during development, testing,
/// or while filming a demo video is a real and antisocial failure mode. So the
/// dialer refuses to place a real call unless [armed] is explicitly true, and
/// [armed] defaults to false in debug and profile builds. A release build ships
/// armed; every other build shows what *would* have happened.
///
/// This also means the demo video can be filmed safely on a live device.
class EmergencyCall {
  EmergencyCall({bool? armed}) : armed = armed ?? kReleaseMode;

  /// When false, [dial] records the intent and returns
  /// [CallOutcome.suppressedForSafety] without touching the dialer.
  final bool armed;

  static const String number = '911';

  Future<CallOutcome> dial() async {
    if (!armed) {
      debugPrint('[Mayday] 911 dial suppressed — build is not armed.');
      return CallOutcome.suppressedForSafety;
    }

    final uri = Uri(scheme: 'tel', path: number);
    try {
      // Note: neither Android nor iOS lets a third-party app place a call
      // without the user confirming in the system dialer, and iOS will not
      // auto-dial an emergency number at all. The app therefore hands off to
      // the dialer; it never claims to have completed the call itself.
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      return ok ? CallOutcome.handedToDialer : CallOutcome.failed;
    } catch (_) {
      return CallOutcome.failed;
    }
  }
}

enum CallOutcome {
  /// The system dialer was opened with 911 loaded. The user still confirms.
  handedToDialer,

  /// Debug/profile build — no call was placed.
  suppressedForSafety,

  failed,
}

extension CallOutcomeMessage on CallOutcome {
  String get message => switch (this) {
        CallOutcome.handedToDialer => 'Dialer opened — press call',
        CallOutcome.suppressedForSafety =>
          'DEMO BUILD — no real call was placed',
        CallOutcome.failed => 'Could not open the dialer — dial 911 yourself',
      };
}
