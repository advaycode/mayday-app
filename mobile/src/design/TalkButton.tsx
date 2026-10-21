import { Microphone } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { haptic } from './haptics';
import { Text } from './Text';
import { color, radius, space, spring } from './tokens';

/**
 * Talk to Mayday: the AI assistant, one tap away and the easiest thing on the
 * screen to hit. Light on dark so it is the brightest object everywhere, a
 * microphone so nobody has to read it, no hold, no menu.
 *
 *   hero  Home: full width, 128 pt tall.
 *   dock  During an emergency: an 84 pt circle in the middle of the bottom
 *         bar, under the thumb. While listening, a ring breathes with the
 *         voice level.
 */
export function TalkButton({
  size,
  listening = false,
  level,
  onPress,
}: {
  size: 'hero' | 'dock';
  listening?: boolean;
  level?: SharedValue<number>;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const idle = useSharedValue(0);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.04 }] }));

  // While listening, a slow pulse even in silence, so it is obviously on.
  useEffect(() => {
    idle.value = listening ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1) : withTiming(0, { duration: 200 });
  }, [listening, idle]);
  const halo = useAnimatedStyle(() => ({
    opacity: listening ? 0.9 : 0,
    transform: [{ scale: 1.08 + idle.value * 0.06 + (level?.value ?? 0) * 0.28 }],
  }));

  const handlers = {
    onPress: () => {
      haptic('start');
      onPress();
    },
    onPressIn: () => (pressed.value = withSpring(1, spring.press)),
    onPressOut: () => (pressed.value = withSpring(0, spring.press)),
    accessibilityRole: 'button' as const,
    accessibilityLabel: listening ? 'Stop listening' : 'Talk to Mayday',
    accessibilityHint: listening ? undefined : 'Say what is happening, or ask a question',
    accessibilityState: { selected: listening },
  };

  if (size === 'hero') {
    return (
      <Animated.View style={press}>
        <Pressable {...handlers} style={styles.hero} hitSlop={8}>
          <View style={styles.heroMic}>
            <Microphone size={34} color={color.ink} weight="fill" />
          </View>
          <Text variant="instruction" style={{ color: color.void, fontSize: 28, lineHeight: 34 }}>
            Talk to Mayday
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={styles.dockWrap}>
      <Animated.View pointerEvents="none" style={[styles.halo, halo]} />
      <Animated.View style={press}>
        <Pressable {...handlers} style={[styles.dock, listening && { backgroundColor: color.accent }]} hitSlop={12}>
          <Microphone size={38} color={color.void} weight="fill" />
        </Pressable>
      </Animated.View>
      <Text variant="caption" style={{ color: listening ? color.accent : color.inkMuted, marginTop: space[1] }}>
        {listening ? 'Listening' : 'Talk'}
      </Text>
    </View>
  );
}

const DOCK = 84;

const styles = StyleSheet.create({
  hero: {
    height: 128,
    borderRadius: 32,
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
  },
  heroMic: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: color.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockWrap: { alignItems: 'center', width: DOCK + 24 },
  dock: {
    width: DOCK,
    height: DOCK,
    borderRadius: DOCK / 2,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: 0,
    width: DOCK,
    height: DOCK,
    borderRadius: DOCK / 2,
    borderWidth: 3,
    borderColor: color.accent,
  },
});
