# Mayday design system

The rules every screen follows. The code version is `mobile/src/design/tokens.ts`; if this file and the tokens disagree, the tokens win and this file is out of date.

**Design read:** an emergency coach for a frightened person kneeling on a floor, phone in a shaking hand or flat on the carpet, in any light from a dark bedroom to a sunlit parking lot. Calm mode is browsed at home, at night, when nothing is wrong.

Two modes, deliberately different:

- **Calm mode** (Home, Learn, Map, Me): warm graphite, Liquid Glass controls floating over content, very few words.
- **Emergency mode**: near-black, huge type, signal red for 911 only, no decoration, nothing to scroll.

## Color

One accent, one alarm color, everything else neutral. Neutrals are tinted very slightly warm (hue about 70) so the screen reads as graphite, not blue-black.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `canvas` | `#121110` | Calm-mode background | |
| `raised` | `#1B1A18` | Grouped settings, cards that are really elevated | |
| `sunken` | `#0C0B0A` | Under the map | |
| `void` | `#050505` | Emergency-mode background. Not pure black, but close enough that OLED pixels switch off and text stands out in sunlight | |
| `ink` | `#F2EFE8` | Primary text | 16.4:1 on canvas, 17.8:1 on void (WCAG AAA) |
| `inkMuted` | `#A8A39A` | Secondary text | 7.5:1 on canvas (AAA) |
| `inkFaint` | `#88847C` | Captions, metadata | 5.1:1 on canvas, 4.7:1 on raised (AA) |
| `accent` | `#D2BE94` | The orb's light, the demo banner, focus rings. Under 5% of any screen | Void text on accent: 11.2:1 |
| `signal` | `#D7261E` | **911 and emergency actions only** | Label `onSignal` `#FFF6F2` on it: 4.7:1 (AAA for large text; every label on red is large) |

**Red means emergency and nothing else.** Trauma centers on the map are ink, not red. Errors are not red. If something needs attention, it gets weight or size.

## Type

One family, Geist (SIL Open Font License, via Google Fonts), plus Geist Mono for numbers that must not jitter (timers, coordinates, the log). One family in several weights instead of a pairing: with so few words on screen, a second face would be decoration.

| Variant | Font | Size / line | Tracking | Use |
|---|---|---|---|---|
| `caption` | Geist Medium | 13 / 16 | +0.1 | Labels, metadata |
| `body` | Geist Regular | 17 / 24 | -0.1 | Reading |
| `bodyStrong` | Geist Medium | 17 / 24 | -0.1 | Buttons, list rows |
| `title` | Geist Medium | 22 / 28 | -0.4 | Section and card titles |
| `display` | Geist Light | 34 / 40 | -1.0 | Tab headings |
| `instruction` | Geist SemiBold | **32** / 38 | -0.8 | Emergency instruction (floor: 28) |
| `instructionSub` | Geist Regular | 20 / 27 | -0.2 | The second line of an instruction |
| `count` | Geist Medium | **128** / 132 | -6 | Compression count (floor: 64) |
| `countdown` | Geist Light | 96 / 100 | -4 | Burn-cooling timer |
| `timer` | Geist Mono Medium | 17 / 22 | 0 | Elapsed time |
| `mono` | Geist Mono | 13 / 18 | 0 | Coordinates, log times |

Numbers that change use tabular figures (`fontVariant: ['tabular-nums']`) so the count does not wobble from 11 to 12. No dashes in visible text; a test enforces it for protocol text.

## Space, radius, hit areas

- **Spacing: 4 pt base.** `0 4 8 12 16 20 24 32 40 48 64 80`. Nothing off the scale.
- **Radius:** `sm 8`, `md 14`, `lg 22`, `pill 999`. Glass controls use `lg` or `pill`; nested shapes keep concentric radii.
- **Hit areas:** 44 pt minimum everywhere; **72 pt** for every emergency control (gloves, shaking hands). Emergency answer buttons are full width or half width, never smaller.

## Liquid Glass

Glass is for the control layer that floats above content (tab bar, buttons, sheets, map filters), never for content itself. That is how Apple uses it, and it keeps glass from becoming the decoration this spec bans.

- **iOS 26:** Apple's own material through `expo-glass-effect` (`GlassView`), dark color scheme, interactive on buttons.
- **Older iOS and Android:** a blur with a hairline rim.
- **Web preview:** a real refraction effect. For each glass element's exact size and corner radius we compute a displacement map (strongest at the rim, zero in the middle) and apply it with an SVG `feDisplacementMap` inside `backdrop-filter`, plus blur, saturation and a specular rim. Chromium only; other browsers get the blur.
- Variants: `regular` (controls), `clear` (over imagery), `thick` (sheets over busy content; must stay readable).

## Motion

| Token | Value | Use |
|---|---|---|
| `fast` | 160 ms | Exits, small state changes |
| `base` | 240 ms | Most transitions |
| `slow` | 420 ms | The emergency surge |
| `breath` | 6000 ms | One orb breath: about ten breaths a minute, a calming pace |
| `spring.press` | damping 22, stiffness 340, mass 0.6 | Buttons settling after a press (scale 0.97) |
| `spring.settle` | damping 24, stiffness 180 | Sheets arriving |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` | Fast out, long settle. No bounce, no linear (except timers, which must look like a clock) |

Exits are faster than entrances. Only transform and opacity animate. With Reduce Motion on, the orb holds still.

**Opening help:** one tap, on Talk or on a tile, and the help screen is there. No hold, no countdown: in an emergency every second of ceremony is a second without help.

## Haptics

| Event | Pattern | Why |
|---|---|---|
| Navigate | Selection tick | Soft acknowledgement |
| Emergency starts | Heavy impact | Unmistakable |
| Compression | Rigid impact, every beat | Coaches with the phone in a pocket |
| Switch rescuers | Three medium taps, 120 ms apart | Different from a beat, every 2 minutes |
| Needs attention | Warning notification | Bleeding-pressure reminders |

In the web preview the phone frame twitches instead (`mirror/index.html`), so haptics show up on video.

## Emergency colors

Each kind of emergency has one color (`tint` in `mobile/src/design/tokens.ts`): coral for CPR, amber for choking, raspberry for bleeding, orange for burns, sky for stroke, mint for overdose, lavender for passed out. A bright hue and a deep shade of the same hue: the tile, the chip and the progress bar during the steps, and the main button. Red stays for 911 only. Color never carries meaning alone; every tile and chip also has an icon and a word.

## Talk to Mayday

The AI assistant is the easiest thing to press on every screen: a 128 pt bar on Home, an 84 pt circle in the middle of the bottom bar during the steps. Light on dark, a microphone, no hold. While listening it turns sand and a ring breathes with the voice.

## The level

The breathing sensor borrows the iPhone Level: two circles, one fixed, one that moves with the tilt, and when they meet the dial turns green (`tint.overdose`, the one green in the app). The movement is magnified 40 times and the angle is shown to a hundredth of a degree in Geist Mono, because a breath is only one or two degrees. Below it, the last seconds of tilt as a line in the emergency's color, with a faint band showing the smallest change that counts as a breath. Results use the same words and buttons as a step: one headline, one line under it, the main action in the emergency's color.

## Pictures

A step screen is a picture and a headline. The pictures are real illustrations and photos from Wikimedia Commons in full color, on one light card (`color.card`): drawings on white blend into it, photos fill it. Square, 280 pt, `radius.lg`. Where no image was good enough (infant CPR, the nasal spray) the app's own line drawing or an icon stands in. `tools/pick_images.py` makes them; credits are in the app.

## Words

Barely any. The detail of a step is spoken, not shown. A screen gets a heading only if you would be lost without it. Instructions read like a calm paramedic: short sentences, the verb first, 12 words or fewer when spoken (tested), 5 or fewer in a headline (tested). No marketing words, no exclamation marks, no emoji.

## Banned (from the spec, enforced in review)

Purple or blue gradients, neon glow, glass on everything; emoji as icons or mixed icon sets (one family: Phosphor, regular for inactive, fill for active); default system font; identical stacked rounded cards; "AI-powered" badges, fake stats, lorem ipsum, stock photos; centered hero with gradient button; anything off the spacing scale.

## Before calling a screen done

Screenshot it at 402 × 874 (`node mirror/shot.mjs`), then check: contrast, one primary action, nothing truncated, no word that could be cut, red used only for 911, glass only on controls, works one-handed in the bottom half.
