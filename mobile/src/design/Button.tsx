import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from './Glass';
import { haptic } from './haptics';
import { Text } from './Text';
import { color, hit, radius, space, spring } from './tokens';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'fill' | 'bold' }>;

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary  solid off-white: the one thing to do next
   * glass    liquid glass: everything else
   * signal   red: 911 actions only
   */
  kind?: 'primary' | 'glass' | 'signal' | 'tint';
  /** With kind 'tint': the emergency's color. */
  tint?: string;
  icon?: IconType;
  size?: 'emergency' | 'regular';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Icon above the label: for half-width tiles. */
  stacked?: boolean;
  children?: ReactNode;
};

/**
 * Buttons settle on a spring when pressed (scale 0.97) and give a soft
 * selection tick. Emergency size is 72 pt tall: big enough for a gloved or
 * shaking thumb.
 */
export function Button({ label, onPress, kind = 'glass', icon: Icon, size = 'regular', style, accessibilityHint, stacked, tint }: ButtonProps) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.03 }] }));
  const height = stacked ? 92 : size === 'emergency' ? hit.emergency : 52;
  const fg = kind === 'primary' || kind === 'tint' ? color.void : kind === 'signal' ? color.onSignal : color.ink;
  const textVariant = size === 'emergency' && !stacked ? 'title' : 'bodyStrong';

  const content = (
    <View style={[stacked ? styles.stack : styles.row, { height }]}>
      {Icon && <Icon size={stacked ? 30 : size === 'emergency' ? 26 : 22} color={fg} weight={kind === 'glass' ? 'regular' : 'fill'} />}
      <Text variant={textVariant} style={{ color: fg }} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );

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
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        hitSlop={6}>
        {kind === 'glass' ? (
          <Glass radius={radius.lg} interactive>
            {content}
          </Glass>
        ) : (
          <View style={{ borderRadius: radius.lg, backgroundColor: kind === 'tint' ? (tint ?? color.ink) : kind === 'primary' ? color.ink : color.signal }}>{content}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
  },
});
