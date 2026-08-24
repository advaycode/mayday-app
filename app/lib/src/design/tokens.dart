import 'package:flutter/material.dart';

/// Mayday's visual language.
///
/// The reference points are defibrillator faceplates, aviation checklists and
/// emergency exit signage — things designed to be read correctly by a stressed
/// human on the first try. Deliberately NOT the current app-design default:
/// no gradients, no glassmorphism, no soft shadows, no 16px radii, no emoji.
///
/// Three rules hold the whole thing together:
///   1. One signal colour. [signal] marks the current action and nothing else.
///      If red appears twice on a screen, one of them is a bug.
///   2. Type does the work. One family, a small set of sizes, enormous at the
///      top of the hierarchy and small everywhere else.
///   3. Flat surfaces, hard edges. Depth costs contrast and buys nothing.
abstract final class MColor {
  /// True black. Cheaper on OLED at 3am and less glare on a night scene.
  static const bg = Color(0xFF000000);

  /// The one step up from the background, for grouped blocks.
  static const surface = Color(0xFF121212);
  static const surfaceHigh = Color(0xFF1E1E1E);

  /// Hairlines. Never a shadow.
  static const rule = Color(0xFF2E2E2E);

  static const text = Color(0xFFFFFFFF);
  static const textDim = Color(0xFF9A9A9A);
  static const textFaint = Color(0xFF6B6B6B);

  /// THE signal colour. Reserved for the current action.
  static const signal = Color(0xFFFF2D16);
  static const signalPressed = Color(0xFFC41F0E);

  /// Rate feedback only. Meaning is never carried by hue alone — these are
  /// always paired with a text label and a position on the rate scale, so the
  /// UI still reads under protanopia and deuteranopia.
  static const good = Color(0xFF31D158);
  static const warn = Color(0xFFFFB020);
}

abstract final class MType {
  /// Bundled, so typography is identical offline and on every device.
  /// Archivo is an open-licence (OFL) condensed-ish grotesque that holds up at
  /// very large sizes without turning into a wall.
  static const family = 'Archivo';

  /// The current instruction. Sized to be read at arm's length by someone
  /// kneeling over a person on the ground.
  static const TextStyle instruction = TextStyle(
    fontFamily: family,
    fontSize: 54,
    height: 1.0,
    fontWeight: FontWeight.w800,
    fontVariations: [FontVariation('wght', 800)],
    letterSpacing: -1.2,
    color: MColor.text,
  );

  static const TextStyle instructionSmall = TextStyle(
    fontFamily: family,
    fontSize: 38,
    height: 1.02,
    fontWeight: FontWeight.w800,
    fontVariations: [FontVariation('wght', 800)],
    letterSpacing: -0.8,
    color: MColor.text,
  );

  /// The supporting line. Gets out of the way.
  static const TextStyle detail = TextStyle(
    fontFamily: family,
    fontSize: 19,
    height: 1.3,
    fontWeight: FontWeight.w400,
    fontVariations: [FontVariation('wght', 400)],
    color: MColor.textDim,
  );

  static const TextStyle button = TextStyle(
    fontFamily: family,
    fontSize: 22,
    height: 1.0,
    fontWeight: FontWeight.w700,
    fontVariations: [FontVariation('wght', 700)],
    letterSpacing: 0.4,
    color: MColor.text,
  );

  /// Counters, timers, rate readout. Tabular so digits do not jitter.
  static const TextStyle numeric = TextStyle(
    fontFamily: family,
    fontSize: 88,
    height: 1.0,
    fontWeight: FontWeight.w800,
    fontVariations: [FontVariation('wght', 800)],
    letterSpacing: -2,
    color: MColor.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle label = TextStyle(
    fontFamily: family,
    fontSize: 13,
    height: 1.2,
    fontWeight: FontWeight.w600,
    fontVariations: [FontVariation('wght', 600)],
    letterSpacing: 1.6,
    color: MColor.textFaint,
  );

  static const TextStyle citation = TextStyle(
    fontFamily: family,
    fontSize: 12,
    height: 1.35,
    fontWeight: FontWeight.w400,
    fontVariations: [FontVariation('wght', 400)],
    color: MColor.textFaint,
  );
}

abstract final class MSpace {
  static const double gutter = 24;
  static const double gap = 16;
  static const double tight = 8;

  /// Radius 2, not 16. Hard edges read as equipment, not as an app.
  static const Radius radius = Radius.circular(2);
  static const BorderRadius border = BorderRadius.all(radius);

  /// WCAG 2.2 SC 2.5.8 sets a 24x24 CSS px minimum target; 2.5.5 (AAA) asks for
  /// 44x44. Nothing interactive in an active incident goes below this, and the
  /// primary affordance is most of the screen.
  static const double minTarget = 56;
}

ThemeData maydayTheme() {
  const scheme = ColorScheme.dark(
    surface: MColor.bg,
    primary: MColor.signal,
    onPrimary: MColor.text,
    secondary: MColor.signal,
    error: MColor.signal,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: MColor.bg,
    fontFamily: MType.family,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    // Motion communicates state; it never decorates. No page transition.
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: _NoTransitionBuilder(),
      TargetPlatform.iOS: _NoTransitionBuilder(),
      TargetPlatform.windows: _NoTransitionBuilder(),
    }),
  );
}

class _NoTransitionBuilder extends PageTransitionsBuilder {
  const _NoTransitionBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) =>
      child;
}
