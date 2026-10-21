/**
 * Design tokens. Every component reads from here; nothing hardcodes a color,
 * size or duration. The plain-language version of these rules is
 * design/SYSTEM.md at the repo root.
 *
 * Two modes share one token set:
 *   calm       home, learn, map, profile. Warm graphite, glass controls.
 *   emergency  near-black, huge type, signal red. No decoration.
 *
 * Red means emergency and nothing else. If you reach for `signal` to make
 * something "pop", stop: use weight or size instead.
 */

export const color = {
  // Calm mode surfaces. Neutrals are tinted very slightly warm (hue ~70)
  // so the screen reads as graphite rather than blue-black.
  canvas: '#121110',
  raised: '#1B1A18',
  sunken: '#0C0B0A',

  // Emergency mode. Not pure black (#000), but close enough for OLED panels
  // to switch most pixels off, which keeps the screen legible in sunlight
  // relative to everything around the text.
  void: '#050505',

  // Text. Contrast ratios measured against `canvas` (calm) and `void`
  // (emergency); see design/SYSTEM.md for the numbers.
  ink: '#F2EFE8', // 16.4:1 on canvas, 17.8:1 on void (WCAG AAA)
  inkMuted: '#A8A39A', // 7.5:1 on canvas (AAA)
  inkFaint: '#88847C', // 5.1:1 on canvas, 4.7:1 on raised (AA): captions and metadata only

  hairline: 'rgba(242, 239, 232, 0.10)',
  hairlineStrong: 'rgba(242, 239, 232, 0.18)',

  // The one accent. Used for the orb's light and focus rings, never for text
  // blocks or large fills.
  accent: '#D2BE94',

  // Signal red: 911 only.
  signal: '#D7261E',
  signalPressed: '#B81E17',
  onSignal: '#FFF6F2', // 4.7:1 on signal: AAA for large text, and every label on red is large

  // The light card every step picture sits on (tools/pick_images.py uses the same value).
  card: '#F3EFE7',
} as const;

/**
 * One color per kind of emergency: its tile on Home, its chip and progress bar
 * during the steps, and its main button. Each has a bright hue and a deep
 * shade of the same hue. Measured contrast: the hue on its deep shade 5.7 to
 * 8.9:1, ink text on the deep shade 12.8 to 14.6:1, near-black text on the hue
 * 6.9 to 12.2:1. Meaning never rests on color alone: every tile and chip also
 * has an icon and a word.
 */
export const tint = {
  cpr: { hue: '#FF7A66', deep: '#35140F' },
  choking: { hue: '#F7C04A', deep: '#33260A' },
  bleeding: { hue: '#FF5C8A', deep: '#36101D' },
  burns: { hue: '#FF9A4D', deep: '#361C0B' },
  stroke: { hue: '#6CB8FF', deep: '#0F2236' },
  overdose: { hue: '#4ED8A8', deep: '#0C2E22' },
  recovery: { hue: '#B9A6FF', deep: '#211A3A' },
} as const;
export type TintName = keyof typeof tint;

/** 4pt base grid. Anything not on this scale is a bug. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Font families, loaded in app/_layout.tsx. */
export const font = {
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/**
 * Type scale. Emergency sizes are floors, not suggestions: 28pt minimum for
 * an instruction, 64pt+ for the compression count.
 */
export const type = {
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: font.medium, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  title: { fontFamily: font.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  display: { fontFamily: font.light, fontSize: 34, lineHeight: 40, letterSpacing: -1.0 },

  // Emergency mode
  instruction: { fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  instructionSub: { fontFamily: font.regular, fontSize: 20, lineHeight: 27, letterSpacing: -0.2 },
  count: { fontFamily: font.medium, fontSize: 128, lineHeight: 132, letterSpacing: -6 },
  countdown: { fontFamily: font.light, fontSize: 96, lineHeight: 100, letterSpacing: -4 },
  timer: { fontFamily: font.monoMedium, fontSize: 17, lineHeight: 22, letterSpacing: 0 },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
} as const;

/** Durations in ms. Exit faster than enter. */
export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 420,
  breath: 6000, // one full orb breath: about 10 breaths a minute, a calming pace
} as const;

/** Reanimated spring configs, tuned per interaction. */
export const spring = {
  /** Buttons settling after a press. Fast, no overshoot you can see. */
  press: { damping: 22, stiffness: 340, mass: 0.6 },
  /** Sheets and cards moving into place. */
  settle: { damping: 24, stiffness: 180, mass: 1 },
  /** The emergency transition: decisive, a touch of weight. */
  surge: { damping: 26, stiffness: 120, mass: 1.1 },
} as const;

/** cubic-bezier(0.16, 1, 0.3, 1): fast out, long gentle settle. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

/** Hit areas. Emergency controls assume gloves and shaking hands. */
export const hit = {
  min: 44,
  emergency: 72,
} as const;
