import {
  Baby,
  Bandaids,
  ChatCircleText,
  Clock,
  Drop,
  Fire,
  HandFist,
  HandPalm,
  HandPointing,
  HandTap,
  Lightning,
  MagnifyingGlass,
  PersonArmsSpread,
  Shower,
  Smiley,
  SprayBottle,
  Warning,
  Wind,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { color } from './tokens';

/**
 * Step pictures. The technique-critical ones (where exactly the hands go,
 * where AED pads go, the recovery position, where a tourniquet goes) are
 * drawn as precise line diagrams, one stroke weight, one colour. Everything
 * else uses a Phosphor icon from the same family as the rest of the app.
 *
 * Anatomy notes for the medical reviewer are next to each diagram.
 */

const STROKE = 2.5;
const ink = color.ink;
const faint = 'rgba(242, 239, 232, 0.35)';

/** Adult torso outline, front view. viewBox 200x200. */
function Torso({ scale = 1 }: { scale?: number }) {
  return (
    <G transform={`translate(${100 - 100 * scale} ${10 - 10 * scale}) scale(${scale})`}>
      {/* neck */}
      <Path d="M86 16 L86 36 M114 16 L114 36" stroke={faint} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      {/* shoulders and sides */}
      <Path
        d="M86 36 C66 38 40 42 30 60 C24 96 32 146 46 188 M114 36 C134 38 160 42 170 60 C176 96 168 146 154 188"
        stroke={ink}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      {/* sternum, from the notch to the bottom of the breastbone */}
      <Line x1={100} y1={44} x2={100} y2={130} stroke={faint} strokeWidth={STROKE} strokeLinecap="round" />
      {/* lower edge of the ribs */}
      <Path d="M58 132 Q100 162 142 132" stroke={faint} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </G>
  );
}

/** The target: where the heel of the hand goes. */
function Mark({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r + 9} stroke={ink} strokeWidth={1.5} strokeOpacity={0.5} fill="none" />
      <Circle cx={x} cy={y} r={r} fill={ink} />
    </G>
  );
}

// Reviewer: centre of the chest, lower half of the breastbone (about the
// nipple line), not over the bottom tip of the sternum.
function HandsAdult() {
  return (
    <>
      <Torso />
      <Mark x={100} y={102} />
    </>
  );
}

// Reviewer: same landmark on a smaller chest; one or two hands.
function HandsChild() {
  return (
    <>
      <Torso scale={0.78} />
      <Mark x={100} y={88} r={11} />
    </>
  );
}

// Reviewer: two thumbs side by side on the lower half of the breastbone, just
// below the nipple line, hands wrapped around the back. NOT two fingers.
function HandsInfant() {
  return (
    <>
      <Path d="M62 40 C50 60 50 130 66 170 M138 40 C150 60 150 130 134 170" stroke={ink} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      <Line x1={100} y1={44} x2={100} y2={128} stroke={faint} strokeWidth={STROKE} strokeLinecap="round" />
      {/* fingers wrapping around the back */}
      <Path d="M56 92 C42 96 42 120 58 124 M144 92 C158 96 158 120 142 124" stroke={faint} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      {/* two thumbs */}
      <Rect x={84} y={96} width={14} height={24} rx={7} fill={ink} />
      <Rect x={102} y={96} width={14} height={24} rx={7} fill={ink} />
    </>
  );
}

// Reviewer: standard anterolateral placement. One pad below the right
// collarbone; the other on the left side below the armpit. (Viewer's left is
// the patient's right.)
function AedPads() {
  return (
    <>
      <Torso />
      <Rect x={48} y={58} width={38} height={26} rx={5} fill={ink} transform="rotate(-8 67 71)" />
      <Rect x={132} y={110} width={26} height={40} rx={5} fill={ink} transform="rotate(14 145 130)" />
    </>
  );
}

// Reviewer: on the side, top knee bent forward at a right angle, head tilted
// back, lower arm out in front, hand under the cheek.
function Recovery() {
  return (
    <G stroke={ink} strokeWidth={STROKE + 1} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Line x1={10} y1={152} x2={190} y2={152} stroke={faint} strokeWidth={STROKE} />
      <Circle cx={42} cy={106} r={14} />
      <Path d="M56 112 L118 120" />
      {/* top leg bent to a right angle */}
      <Path d="M118 120 L148 104 L150 140" />
      {/* lower leg straight */}
      <Path d="M118 124 L182 140" stroke={faint} />
      {/* top arm, hand under the cheek */}
      <Path d="M70 114 L56 132 L40 122" />
    </G>
  );
}

// Reviewer: lying flat on the back on a firm floor.
function Supine() {
  return (
    <G stroke={ink} strokeWidth={STROKE + 1} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Line x1={10} y1={140} x2={190} y2={140} stroke={faint} strokeWidth={STROKE} />
      <Circle cx={34} cy={122} r={13} />
      <Path d="M47 124 L120 124 L182 128" />
      <Path d="M70 124 L102 130" stroke={faint} />
    </G>
  );
}

// Reviewer: thigh seen from the side, hip on the left. Band 2 to 3 inches
// above the wound (toward the hip), never on the knee.
function Tourniquet() {
  return (
    <G strokeLinecap="round" fill="none">
      <Path d="M16 70 C70 64 130 66 168 76 M16 130 C70 134 130 132 168 122" stroke={ink} strokeWidth={STROKE} />
      {/* knee */}
      <Path d="M168 76 C182 84 182 114 168 122" stroke={faint} strokeWidth={STROKE} />
      {/* wound */}
      <Circle cx={128} cy={100} r={9} fill={ink} />
      {/* the band */}
      <Rect x={78} y={60} width={14} height={80} rx={4} fill={ink} />
      {/* 2 to 3 inches */}
      <Path d="M92 156 L120 156 M92 150 L92 162 M120 150 L120 162" stroke={faint} strokeWidth={2} />
    </G>
  );
}

const DIAGRAMS: Record<string, ComponentType> = {
  'hands-adult': HandsAdult,
  'hands-child': HandsChild,
  'hands-infant': HandsInfant,
  'aed-pads': AedPads,
  recovery: Recovery,
  position: Supine,
  'position-infant': Supine,
  tourniquet: Tourniquet,
};

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'thin' | 'light' | 'regular' }>;

const ICONS: Record<string, IconType> = {
  'tap-shout': HandTap,
  'tap-infant': HandTap,
  'check-breathing': Wind,
  point: HandPointing,
  aed: Lightning,
  'choking-sign': Wind,
  'back-blows': HandPalm,
  'abdominal-thrusts': HandFist,
  'chest-thrusts': HandFist,
  'infant-back-blows': Baby,
  'infant-chest-thrusts': Baby,
  'find-wound': MagnifyingGlass,
  pressure: HandPalm,
  pack: Bandaids,
  'stop-drop-roll': Fire,
  'burn-size': HandPalm,
  jewelry: HandPalm,
  'cool-water': Shower,
  cover: Bandaids,
  'fast-face': Smiley,
  'fast-arms': PersonArmsSpread,
  'fast-speech': ChatCircleText,
  'fast-time': Clock,
  'nasal-spray': SprayBottle,
  spine: Warning,
  drop: Drop,
};

export function Visual({ id, size = 180 }: { id?: string; size?: number }) {
  if (!id) return null;
  const Diagram = DIAGRAMS[id];
  if (Diagram) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Diagram />
        </Svg>
      </View>
    );
  }
  const Icon = ICONS[id];
  if (!Icon) return null;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon size={size * 0.62} color={color.ink} weight="light" />
    </View>
  );
}
