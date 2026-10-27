import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { color } from './tokens';

/**
 * Procedure animations: a few steps are easier to copy than to read, so
 * their picture moves. Each is a plain line drawing in the same style as the
 * diagrams (light lines on the emergency's deep color), with the one thing
 * the rescuer does drawn in the emergency's color and looping at the real
 * pace: compressions at 110 a minute, back blows about one a second.
 *
 * Every moving part is its own layer (a 200 x 200 drawing) moved with a
 * transform, which animates the same on phones and in the browser. With
 * Reduce Motion on, each holds still mid-action.
 */

type Kit = { s: number; ink: string; hue: string; faint: string };
const W = 3;

/** 0 to 1 and round again, forever, every `ms`. */
function useLoop(ms: number): SharedValue<number> {
  const t = useSharedValue(0.5);
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
  }, [ms, still, t]);
  return t;
}

/** One layer: the whole 200 x 200 drawing area, moved as one piece. */
function Layer({ s, style, children }: { s: number; style?: object; children: ReactNode }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={s} height={s} viewBox="0 0 200 200">
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Rotate a layer by `deg` about the point (px, py) of the drawing. */
function spin(k: number, px: number, py: number, deg: number) {
  'worklet';
  const dx = (px - 100) * k;
  const dy = (py - 100) * k;
  return [{ translateX: dx }, { translateY: dy }, { rotate: `${deg}deg` }, { translateX: -dx }, { translateY: -dy }];
}

/** Scale a layer by `sc` about the point (px, py) of the drawing. */
function grow(k: number, px: number, py: number, sc: number) {
  'worklet';
  const dx = (px - 100) * k;
  const dy = (py - 100) * k;
  return [{ translateX: dx }, { translateY: dy }, { scale: sc }, { translateX: -dx }, { translateY: -dy }];
}

/** A quick push and a slower release: the shape of a compression or a thrust. */
function push(t: number) {
  'worklet';
  return t < 0.35 ? Math.sin((t / 0.35) * (Math.PI / 2)) : Math.cos(((t - 0.35) / 0.65) * (Math.PI / 2));
}

// --- The procedures -------------------------------------------------------------

/** Chest compressions, side view: straight arms, the chest goes down and comes all the way back up. */
function Compressions({ s, ink, hue, faint }: Kit) {
  const t = useLoop(545);
  const k = s / 200;
  const arms = useAnimatedStyle(() => ({ transform: [{ translateY: push(t.value) * 9 * k }] }));
  const chest = useAnimatedStyle(() => ({ transform: [{ translateY: push(t.value) * 6 * k }] }));
  const arrow = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * push(t.value) }));
  return (
    <>
      <Layer s={s}>
        <Line x1={8} y1={168} x2={192} y2={168} stroke={faint} strokeWidth={W} strokeLinecap="round" />
        <Circle cx={34} cy={148} r={13} stroke={ink} strokeWidth={W} fill="none" />
        <Path d="M50 166 L50 150 M152 166 L152 146 M152 150 L194 154 M152 160 L194 162" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s} style={chest}>
        <Path d="M50 150 C62 132 92 126 116 128 C134 130 146 136 152 146" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s} style={arms}>
        <Circle cx={100} cy={22} r={11} stroke={ink} strokeWidth={W} fill="none" />
        <Path d="M78 46 L122 46 M92 46 L98 112 M108 46 L102 112" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Rect x={86} y={110} width={28} height={12} rx={6} fill={hue} />
      </Layer>
      <Layer s={s} style={arrow}>
        <Path d="M140 66 L140 100 M131 91 L140 100 L149 91" stroke={hue} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Layer>
    </>
  );
}

/** Back blows: lean them forward, heel of the hand between the shoulder blades. */
function BackBlows({ s, ink, hue, faint }: Kit) {
  const t = useLoop(1100);
  const k = s / 200;
  const hand = useAnimatedStyle(() => ({ transform: spin(k, 150, 40, -38 * (1 - push(t.value))) }));
  const ring = useAnimatedStyle(() => {
    const hit = t.value < 0.35 ? 0 : (t.value - 0.35) / 0.65;
    return { opacity: t.value < 0.3 ? 0 : interpolate(hit, [0, 1], [0.9, 0]), transform: grow(k, 98, 86, 0.6 + hit * 0.9) };
  });
  return (
    <>
      <Layer s={s}>
        <Line x1={8} y1={188} x2={192} y2={188} stroke={faint} strokeWidth={W} strokeLinecap="round" />
        <Circle cx={56} cy={78} r={13} stroke={ink} strokeWidth={W} fill="none" />
        {/* Bent forward: the back, the chest, the legs. */}
        <Path d="M68 72 C88 70 110 80 118 120 M64 92 C76 104 90 116 100 128 M118 120 L122 188 M100 128 L98 188" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Path d="M70 96 L64 136" stroke={faint} strokeWidth={W} strokeLinecap="round" />
      </Layer>
      <Layer s={s} style={ring}>
        <Circle cx={98} cy={86} r={14} stroke={hue} strokeWidth={2} fill="none" />
      </Layer>
      <Layer s={s} style={hand}>
        <Path d="M150 40 L106 78" stroke={ink} strokeWidth={W} strokeLinecap="round" />
        <Rect x={92} y={72} width={22} height={14} rx={6} fill={hue} transform="rotate(-40 103 79)" />
      </Layer>
    </>
  );
}

/** Belly thrusts: a fist just above the belly button, quick thrusts in and up. */
function BellyThrusts({ s, ink, hue, faint }: Kit) {
  const t = useLoop(1000);
  const k = s / 200;
  const fist = useAnimatedStyle(() => ({ transform: [{ translateX: -push(t.value) * 7 * k }, { translateY: -push(t.value) * 10 * k }] }));
  const arrow = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * push(t.value) }));
  return (
    <>
      <Layer s={s}>
        <Line x1={8} y1={188} x2={192} y2={188} stroke={faint} strokeWidth={W} strokeLinecap="round" />
        <Circle cx={92} cy={34} r={14} stroke={ink} strokeWidth={W} fill="none" />
        {/* Standing, side view: back on the right, belly on the left. */}
        <Path d="M100 50 C110 70 112 110 108 140 M84 50 C76 80 74 104 80 136 M108 140 L112 188 M80 136 L84 188" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Circle cx={80} cy={118} r={2.5} fill={faint} />
        <Path d="M160 60 C150 80 130 100 92 106" stroke={faint} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s} style={fist}>
        <Rect x={72} y={98} width={22} height={18} rx={7} fill={hue} />
      </Layer>
      <Layer s={s} style={arrow}>
        <Path d="M54 126 C48 112 52 100 62 92 M54 96 L62 92 L64 101" stroke={hue} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Layer>
    </>
  );
}

/** Direct pressure: both hands, hard, and do not let up. */
function Pressure({ s, ink, hue, faint }: Kit) {
  const t = useLoop(1800);
  const k = s / 200;
  const hands = useAnimatedStyle(() => ({ transform: [{ translateY: (0.5 - 0.5 * Math.cos(t.value * 2 * Math.PI)) * 4 * k }] }));
  const ring = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 1], [0.8, 0]), transform: grow(k, 100, 138, 0.5 + t.value * 0.9) }));
  return (
    <>
      <Layer s={s}>
        <Path d="M10 120 C60 112 140 112 190 120 M10 160 C60 166 140 166 190 160" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Circle cx={100} cy={138} r={6} fill={faint} />
      </Layer>
      <Layer s={s} style={ring}>
        <Circle cx={100} cy={138} r={30} stroke={hue} strokeWidth={2} fill="none" />
      </Layer>
      <Layer s={s} style={hands}>
        <Path d="M72 40 L86 96 M128 40 L114 96" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Rect x={76} y={94} width={48} height={14} rx={7} fill={hue} />
        <Rect x={80} y={106} width={40} height={12} rx={6} fill={hue} opacity={0.75} />
      </Layer>
    </>
  );
}

/** Cool running water over the burn. */
function CoolWater({ s, ink, hue, faint }: Kit) {
  const t = useLoop(900);
  const k = s / 200;
  const drop = (phase: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const p = (t.value + phase) % 1;
      return { opacity: p < 0.85 ? 1 : 0, transform: [{ translateY: p * 70 * k }] };
    });
  const drops = [drop(0), drop(0.25), drop(0.5), drop(0.75)];
  return (
    <>
      <Layer s={s}>
        <Path d="M40 30 L110 30 C120 30 124 36 124 44 L124 52 M110 52 L138 52" stroke={faint} strokeWidth={W} strokeLinecap="round" fill="none" />
        {/* The forearm under the tap. */}
        <Path d="M14 140 C60 134 120 134 186 128 M14 168 C60 166 120 164 186 156" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Path d="M112 140 C118 146 130 146 136 140" stroke={hue} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      </Layer>
      {drops.map((style, i) => (
        <Layer key={i} s={s} style={style}>
          <Path d={`M${120 + (i % 2) * 8} 58 L${120 + (i % 2) * 8} 70`} stroke={hue} strokeWidth={W} strokeLinecap="round" />
        </Layer>
      ))}
    </>
  );
}

/**
 * Narcan: lying on their back, head tilted back, the nozzle in one nostril.
 * Two fingers under the flange, the thumb presses the plunger.
 */
function NasalSpray({ s, ink, hue, faint }: Kit) {
  const t = useLoop(1600);
  const k = s / 200;
  const plunger = useAnimatedStyle(() => ({ transform: [{ translateY: push(t.value) * 5 * k }] }));
  const puff = useAnimatedStyle(() => {
    const p = t.value < 0.3 ? 0 : (t.value - 0.3) / 0.7;
    return { opacity: t.value < 0.3 ? 0 : 0.9 - 0.9 * p, transform: grow(k, 108.5, 60, 0.6 + p) };
  });
  return (
    <>
      <Layer s={s} style={puff}>
        <Circle cx={108.5} cy={60} r={10} stroke={hue} strokeWidth={2} fill="none" />
      </Layer>
      <Layer s={s}>
        {/* The nozzle, the flange, and two fingers under it. */}
        <Rect x={104} y={40} width={9} height={24} rx={4.5} fill={hue} />
        <Rect x={89} y={34} width={39} height={8} rx={4} fill={hue} />
        <Path d="M95 47 C95 43 99 41 101 43 M116 43 C118 41 122 43 122 47" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s} style={plunger}>
        <Rect x={100} y={12} width={17} height={22} rx={5} fill={hue} opacity={0.82} />
        <Rect x={99} y={3} width={19} height={9} rx={4.5} stroke={ink} strokeWidth={W} fill="none" />
        <Path d="M118 7 C136 4 152 10 168 24" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s}>
        <Line x1={8} y1={180} x2={192} y2={180} stroke={faint} strokeWidth={W} strokeLinecap="round" />
        {/* The head in profile, tilted back, chin up; the nose drawn over the nozzle's tip. */}
        <Path d="M46 178 C20 168 10 138 20 110 C28 90 46 80 66 78 C76 77 84 76 90 72 L103 53 C106 48 112 50 111 55 C110 60 112 64 116 64 C121 64 123 68 127 68 C131 68 133 66 136 66 C140 66 142 60 147 59 C153 58 156 72 162 86 C168 97 176 102 192 102" stroke={ink} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M58 118 C67 112 76 120 72 130 C70 135 63 136 60 132" stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <Path d="M74 90 C78 94 84 94 88 91" stroke={ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </Layer>
    </>
  );
}

/** Stroke check: both arms up; one drifts down. */
function ArmDrift({ s, ink, hue, faint }: Kit) {
  const t = useLoop(2600);
  const k = s / 200;
  const arm = useAnimatedStyle(() => {
    const p = t.value < 0.2 ? 0 : t.value > 0.8 ? 1 - (t.value - 0.8) / 0.2 : (t.value - 0.2) / 0.6;
    return { transform: spin(k, 122, 84, 28 * p) };
  });
  return (
    <>
      <Layer s={s}>
        <Circle cx={100} cy={52} r={16} stroke={ink} strokeWidth={W} fill="none" />
        <Path d="M78 84 L122 84 M80 84 L84 170 M120 84 L116 170 M84 170 L116 170" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
        {/* The arm that stays up. */}
        <Path d="M78 84 L28 88" stroke={ink} strokeWidth={W} strokeLinecap="round" />
        <Line x1={128} y1={88} x2={176} y2={88} stroke={faint} strokeWidth={1.5} strokeDasharray="4 5" />
      </Layer>
      <Layer s={s} style={arm}>
        <Path d="M122 84 L172 88" stroke={hue} strokeWidth={W + 1} strokeLinecap="round" />
      </Layer>
    </>
  );
}

/** Tap their shoulders and shout. */
function TapShout({ s, ink, hue, faint }: Kit) {
  const t = useLoop(700);
  const k = s / 200;
  const hands = useAnimatedStyle(() => ({ transform: [{ translateY: push(t.value) * 6 * k }] }));
  const sound = useAnimatedStyle(() => ({ opacity: 0.2 + 0.8 * push(t.value) }));
  return (
    <>
      <Layer s={s}>
        <Circle cx={100} cy={128} r={18} stroke={ink} strokeWidth={W} fill="none" />
        <Path d="M40 186 C44 160 64 150 80 150 L120 150 C136 150 156 160 160 186" stroke={ink} strokeWidth={W} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer s={s} style={hands}>
        <Rect x={50} y={128} width={30} height={12} rx={6} fill={hue} />
        <Rect x={120} y={128} width={30} height={12} rx={6} fill={hue} />
      </Layer>
      <Layer s={s} style={sound}>
        <Path d="M84 60 C92 52 108 52 116 60 M74 46 C88 32 112 32 126 46" stroke={hue} strokeWidth={W} strokeLinecap="round" fill="none" />
        <Path d="M100 84 L100 96" stroke={faint} strokeWidth={W} strokeLinecap="round" />
      </Layer>
    </>
  );
}

const MOTIONS: Record<string, (k: Kit) => ReactNode> = {
  'hands-adult': Compressions,
  'hands-child': Compressions,
  'back-blows': BackBlows,
  'abdominal-thrusts': BellyThrusts,
  pressure: Pressure,
  'cool-water': CoolWater,
  'nasal-spray': NasalSpray,
  'fast-arms': ArmDrift,
  'tap-shout': TapShout,
};

export const hasMotion = (id?: string) => !!id && id in MOTIONS;

/** The animated picture for a step, `size` points square, or null if the step has none. */
export function Motion({ id, size, tone }: { id?: string; size: number; tone?: { hue: string; deep: string } }) {
  if (!id || !MOTIONS[id]) return null;
  const Draw = MOTIONS[id];
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Draw s={size} ink={color.ink} hue={tone?.hue ?? color.accent} faint="rgba(242, 239, 232, 0.35)" />
    </View>
  );
}
