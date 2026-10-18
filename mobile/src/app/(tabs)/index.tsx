import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { unlockAudio } from '@/audio/engine';
import { Glass } from '@/design/Glass';
import { HoldButton } from '@/design/HoldButton';
import { useDeviceInsets } from '@/design/insets';
import { Orb } from '@/design/Orb';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { setSettings, useSettings } from '@/settings/store';

/**
 * Home. Three things on screen: the name, a quiet light, and the control.
 * Everything else lives one tab away.
 */
export default function Home() {
  const insets = useDeviceInsets();
  const settings = useSettings();
  const { width, height } = useWindowDimensions();
  const [origin, setOrigin] = useState({ x: width / 2, y: height * 0.66, size: 184 });
  const grow = useSharedValue(0);

  // Reset the red surge when we come back from emergency mode.
  useFocusEffect(
    useCallback(() => {
      grow.value = 0;
    }, [grow]),
  );

  const go = () => router.push('/emergency');

  const start = (o: { x: number; y: number; size: number }) => {
    setOrigin(o);
    // The red disc grows to fill the screen, then emergency mode takes over
    // on the same red and fades to black: one continuous surface.
    grow.value = withTiming(1, { duration: 380, easing: Easing.bezier(0.16, 1, 0.3, 1) }, (done) => {
      if (done) runOnJS(go)();
    });
  };

  const cover = Math.hypot(width, height) * 2.1;
  const surge = useAnimatedStyle(() => ({
    opacity: grow.value > 0 ? 1 : 0,
    transform: [{ scale: 1 + grow.value * (cover / origin.size - 1) }],
  }));

  const orbSize = Math.min(width * 0.86, 340);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[3] }]}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Mayday
        </Text>
      </View>

      {!settings.disclaimerSeen && (
        <Pressable
          onPress={() => setSettings({ disclaimerSeen: true })}
          accessibilityRole="button"
          accessibilityLabel="This guides you while help is on the way. Always call 911. Tap to dismiss."
          style={styles.noteWrap}>
          <Glass radius={radius.lg}>
            <View style={styles.note}>
              <Text variant="body" style={{ flex: 1 }}>
                This guides you while help is on the way. Always call 911.
              </Text>
              <Text variant="bodyStrong" tone="muted">
                OK
              </Text>
            </View>
          </Glass>
        </Pressable>
      )}

      <View style={styles.orbArea} pointerEvents="none">
        <Orb size={orbSize} />
      </View>

      <View style={[styles.control, { paddingBottom: insets.bottom + 96 }]}>
        <HoldButton
          label="911"
          accessibilityLabel="Emergency"
          onPressStart={unlockAudio}
          onComplete={start}
        />
        <Text variant="caption" tone="faint" style={{ marginTop: space[3] }}>
          Hold
        </Text>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.surge,
          {
            left: origin.x - origin.size / 2,
            top: origin.y - origin.size / 2,
            width: origin.size,
            height: origin.size,
            borderRadius: origin.size / 2,
          },
          surge,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  header: { paddingHorizontal: space[6], height: 44, justifyContent: 'center' },
  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  control: { alignItems: 'center' },
  surge: { position: 'absolute', backgroundColor: color.signal },
  noteWrap: { marginHorizontal: space[4], marginTop: space[2] },
  note: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[4], paddingVertical: space[3] },
});
