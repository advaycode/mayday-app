import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from './haptics';
import { Text } from './Text';
import { color, spring } from './tokens';

const HOLD_MS = 800;

type Props = {
  size?: number;
  label: string;
  accessibilityLabel: string;
  onComplete: (origin: { x: number; y: number; size: number }) => void;
  /** Called the instant a press begins, e.g. to unlock audio in a browser. */
  onPressStart?: () => void;
};

/**
 * The emergency control: press and hold until the ring closes.
 *
 * Holding prevents a pocket or a toddler from starting an emergency, but the
 * hold is short (0.8 s) and the ring shows exactly how much is left. Light
 * haptic ticks mark a third and two thirds; a heavy one marks the start.
 * Screen-reader users activate it with a normal double tap, because they
 * have already made a deliberate choice.
 */
export function HoldButton({ size = 184, label, accessibilityLabel, onComplete, onPressStart }: Props) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const ringPad = 14;
  const canvasSize = size + ringPad * 2;
  const ringR = size / 2 + ringPad / 2 + 1;

  const ring = Skia.Path.Circle(canvasSize / 2, canvasSize / 2, ringR);

  const fire = () => {
    ref.current?.measureInWindow((x: number, y: number, w: number) => {
      onComplete({ x: x + w / 2, y: y + w / 2, size: w });
    });
  };

  // Haptic ticks at one third and two thirds, fired from the UI thread.
  const tick = (step: number) => haptic(step === 3 ? 'start' : 'holdStep');
  useAnimatedReaction(
    () => Math.floor(progress.value * 3 + 0.0001),
    (step, prev) => {
      if (prev !== null && step > prev) {
        runOnJS(tick)(step);
        if (step === 3) runOnJS(fire)();
      }
    },
  );

  const start = () => {
    onPressStart?.();
    scale.value = withSpring(0.95, spring.press);
    progress.value = withTiming(1, { duration: HOLD_MS * (1 - progress.value), easing: Easing.linear });
  };

  const release = () => {
    scale.value = withSpring(1, spring.press);
    if (progress.value < 1) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 600 });
    }
  };

  const end = useDerivedValue(() => progress.value);
  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ width: canvasSize, height: canvasSize, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={canvasSize / 2} cy={canvasSize / 2} r={ringR} style="stroke" strokeWidth={3} color={color.hairlineStrong} />
        <Path
          path={ring}
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
          color={color.ink}
          start={0}
          end={end}
          transform={[{ rotate: -Math.PI / 2 }]}
          origin={{ x: canvasSize / 2, y: canvasSize / 2 }}
        />
      </Canvas>
      <Pressable
        ref={ref}
        onPressIn={start}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Press and hold to start emergency mode"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && fire()}
        hitSlop={12}>
        <Animated.View
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color.signal,
              alignItems: 'center',
              justifyContent: 'center',
            },
            discStyle,
          ]}>
          <Text
            tone="onSignal"
            style={{ fontFamily: 'Geist_500Medium', fontSize: size * 0.3, lineHeight: size * 0.34, letterSpacing: -2 }}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}
