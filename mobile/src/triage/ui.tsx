import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { Sheet } from '@/design/Sheet';
import { Text } from '@/design/Text';
import { color, radius, severityTint, space } from '@/design/tokens';

import { localize } from '@/region/store';

import { DEGREE_NAME, LEVEL_NAME, LOOKS, type Grade, type Level } from './severity';

/**
 * The severity badge sits on the step picture's corner: a dot in the level's
 * color and two or three words. Tap it for the card. At level 3 the dot
 * pulses, the only moving thing on the screen besides the voice.
 */
export function SeverityBadge({ grade, onPress }: { grade: Grade; onPress: () => void }) {
  const t = severityTint[grade.level];
  const label = grade.degree ? `${DEGREE_NAME[grade.degree]} · ${grade.name}` : grade.guess ? 'Severity ?' : `Level ${grade.level} · ${grade.name}`;
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = grade.level === 3 && !grade.guess ? withRepeat(withSequence(withTiming(0.35, { duration: 600 }), withTiming(1, { duration: 600 })), -1) : withTiming(1);
  }, [grade.level, grade.guess, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Pressable
      onPress={() => {
        haptic('navigate');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Severity: ${label}. ${localize(grade.action)} Tap for details.`}
      hitSlop={8}
      style={styles.badgeWrap}>
      <Glass radius={radius.pill} variant="thick" style={styles.badge}>
        <View style={styles.badgeRow}>
          <Animated.View style={[styles.dot, { backgroundColor: grade.guess ? color.inkFaint : t.hue }, dot]} />
          <Text variant="caption" style={{ color: color.ink }}>
            {label}
          </Text>
        </View>
      </Glass>
    </Pressable>
  );
}

/**
 * The card: the three levels with this one lit, what to do, why (each piece
 * of evidence as it came in), and "what do you see?" to tell it more.
 */
export function SeveritySheet({ grade, open, onClose, onObserve }: { grade: Grade | null; open: boolean; onClose: () => void; onObserve: (text: string) => void }) {
  if (!grade) return null;
  const t = severityTint[grade.level];
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.head}>
        <Text variant="caption" tone="muted">
          {grade.category === 'burns' ? 'Burn depth and severity' : 'Severity'}
        </Text>
        <Text variant="title">{grade.degree ? `${DEGREE_NAME[grade.degree]} burn` : grade.guess ? 'Not sure yet' : `Level ${grade.level}: ${grade.name}`}</Text>
      </View>

      <View style={styles.scale} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: grade.level }}>
        {([1, 2, 3] as Level[]).map((l) => {
          const on = l <= grade.level && !grade.guess;
          return (
            <View key={l} style={[styles.seg, { backgroundColor: on ? severityTint[l].hue : color.hairlineStrong }]}>
              <Text variant="caption" style={{ color: on ? color.void : color.inkMuted }}>
                {LEVEL_NAME[l]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.action, { backgroundColor: t.deep, borderColor: `${t.hue}55` }]}>
        <Text variant="bodyStrong" style={{ color: t.hue }}>
          {localize(grade.action)}
        </Text>
      </View>

      <Text variant="caption" tone="muted">
        What do you see?
      </Text>
      <View style={styles.looks}>
        {LOOKS[grade.category].map((o) => (
          <Pressable
            key={o.label}
            onPress={() => {
              haptic('navigate');
              onObserve(o.text);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.look, pressed && { opacity: 0.7 }]}>
            <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {grade.signals.length > 0 && (
        <View style={styles.why}>
          <Text variant="caption" tone="muted">
            Why
          </Text>
          {grade.signals.slice(0, 4).map((s, i) => (
            <View key={`${s.name}${i}`} style={styles.signal}>
              <View style={[styles.signalDot, { backgroundColor: severityTint[s.level].hue }]} />
              <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>
                {s.name}
                <Text variant="body" tone="faint">
                  {'  '}
                  {s.evidence}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text variant="caption" tone="faint">
        It only ever moves toward more care. If in doubt, call {localize('911')}.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  badgeWrap: { position: 'absolute', top: space[3], left: space[3] },
  badge: { paddingHorizontal: space[3], height: 32, justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  head: { gap: space[1] },
  scale: { flexDirection: 'row', gap: space[1] },
  seg: { flex: 1, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  action: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space[4], paddingVertical: space[3] },
  looks: { flexDirection: 'row', gap: space[2] },
  look: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  why: { gap: space[2] },
  signal: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  signalDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
