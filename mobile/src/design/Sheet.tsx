import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from './Glass';
import { useDeviceInsets } from './insets';
import { radius, space, spring } from './tokens';

/**
 * A bottom sheet of liquid glass. It rises on a spring and leaves faster
 * than it arrived (180 ms out, spring in). Tap outside to close.
 */
export function Sheet({ open, onClose, children, above = 0 }: { open: boolean; onClose: () => void; children: ReactNode; /** Extra room at the bottom, e.g. for a tab bar the sheet must sit above. */ above?: number }) {
  const insets = useDeviceInsets();
  const [mounted, setMounted] = useState(open);
  const y = useSharedValue(600);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      y.value = withSpring(0, spring.settle);
      fade.value = withTiming(1, { duration: 200 });
    } else {
      fade.value = withTiming(0, { duration: 160 });
      y.value = withTiming(600, { duration: 180 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [open, y, fade]);

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View style={[styles.anchor, { paddingBottom: insets.bottom + space[2] + above }, panel]}>
        <Glass radius={radius.lg + 10} variant="thick">
          <View style={styles.content}>{children}</View>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(5,5,5,0.68)' },
  anchor: { position: 'absolute', left: space[3], right: space[3], bottom: 0 },
  content: { padding: space[5], gap: space[3] },
});
