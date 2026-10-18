import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius as radii } from './tokens';

export type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /**
   * 'regular' frosts; 'clear' lets more of the background through; 'thick'
   * is for sheets that sit over busy content and must stay readable.
   */
  variant?: 'regular' | 'clear' | 'thick';
  /** Tinted glass, e.g. the signal-red emergency control. */
  tint?: string;
  /** iOS 26: the glass reacts to touch (it flexes and brightens under a finger). */
  interactive?: boolean;
};

/**
 * Liquid Glass on iOS 26 is Apple's own material (UIGlassEffect), so it
 * refracts and lights exactly like the system controls around it. We only
 * use glass for the control layer that floats above content (tab bar,
 * buttons, sheets), never for content itself, which is how Apple uses it.
 *
 * Older iOS and Android get a blur with a hairline rim. The web preview has
 * its own implementation in Glass.web.tsx.
 */
const hasLiquidGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export function Glass({
  children,
  style,
  radius = radii.lg,
  variant = 'regular',
  tint,
  interactive,
}: GlassProps) {
  if (hasLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle={variant === 'clear' ? 'clear' : 'regular'}
        tintColor={tint ?? (variant === 'thick' ? 'rgba(22,21,19,0.6)' : undefined)}
        isInteractive={interactive}
        colorScheme="dark"
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={variant === 'clear' ? 18 : variant === 'thick' ? 80 : 36}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: tint ?? (variant === 'thick' ? 'rgba(22, 21, 19, 0.78)' : 'rgba(242, 239, 232, 0.06)'),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: color.hairlineStrong,
          },
        ]}
      />
      {children}
    </View>
  );
}
