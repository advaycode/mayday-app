import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import type { Emergency } from './emergencies';
import { haptic } from './haptics';
import { Text } from './Text';
import { radius, space, spring, tint } from './tokens';

/**
 * One kind of emergency, one tap. Its own color, its icon, one or two words.
 * Tall tiles on Home; short rows under the microphone during intake.
 */
export function EmergencyTile({
  emergency,
  onPress,
  compact = false,
  style,
}: {
  emergency: Emergency;
  onPress: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { hue, deep } = tint[emergency.id];
  const { Icon } = emergency;
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.03 }] }));

  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPress={() => {
          haptic('navigate');
          onPress();
        }}
        onPressIn={() => (pressed.value = withSpring(1, spring.press))}
        onPressOut={() => (pressed.value = withSpring(0, spring.press))}
        accessibilityRole="button"
        accessibilityLabel={emergency.label}
        style={[styles.tile, compact ? styles.compact : styles.tall, { backgroundColor: deep, borderColor: `${hue}33` }]}>
        <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: hue }]}>
          <Icon size={compact ? 20 : 26} color={deep} weight="fill" />
        </View>
        <Text variant={compact ? 'bodyStrong' : 'title'} numberOfLines={1} adjustsFontSizeToFit style={compact ? { fontSize: 15, flexShrink: 1 } : undefined}>
          {emergency.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, borderWidth: 1 },
  tall: { height: 104, padding: space[4], justifyContent: 'space-between' },
  compact: { height: 60, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  iconCompact: { width: 34, height: 34 },
});
