import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { ArrowsClockwise, Play, Stop } from 'phosphor-react-native';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Button } from '@/design/Button';
import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Orb } from '@/design/Orb';
import { Text } from '@/design/Text';
import { color, font, radius, space } from '@/design/tokens';
import { SCENARIOS } from '@/sensors/sim';
import { LEVEL, TiltTrace } from '@/sensors/ui';
import { useMonitor } from '@/sensors/useMonitor';

/** Pixels the bubble moves per degree of tilt: a 0.3° breath moves it 12 points. */
const MAGNIFY = 40;
/** Degrees as 00.00, signed, fixed width so the numbers never jump as they change. */
const deg = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).padStart(5, '0')}°`;
const GREEN: [number, number, number] = [0.31, 0.85, 0.66];

const HINT: Record<string, string> = {
  idle: 'Lie down. Phone on your chest.',
  starting: 'Starting',
  place: 'Lay it down and let go',
  leveling: 'Hold still',
  measuring: 'Breathe normally',
  unavailable: 'No motion sensor here',
};

/**
 * The breathing check as its own tab, to try on yourself: the phone on your
 * chest reads the tilt your breathing makes, like the iPhone's Level, and
 * shows it live. A glass lens with a bubble that moves with every breath
 * (magnified 40 times), the two angles to the hundredth of a degree, breaths
 * a minute and the wave. A computer has no motion sensor, so there a
 * simulated person breathes under it (and the pill says so).
 */
export default function Breathe() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const insets = useDeviceInsets();
  const { width } = useWindowDimensions();
  const m = useMonitor({ mode: 'lab', scenario: 'normal' });
  const running = m.phase !== 'idle' && m.phase !== 'unavailable';
  const inner = width - 2 * space[4];
  const lens = Math.min(inner - space[8], 296);

  // Leaving the tab stops the sensor.
  const { stop } = m;
  useFocusEffect(useCallback(() => () => stop(), [stop]));

  const p = m.level ? (m.level.ref ? m.level.relPitch : m.level.pitch) : 0;
  const q = m.level ? (m.level.ref ? m.level.relRoll : m.level.roll) : 0;
  const relative = !!m.level?.ref;

  // The bubble follows the tilt on a soft spring, so it glides rather than jitters.
  const lim = lens / 2 - lens * 0.17 - 8;
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    const on = relative && running;
    bx.value = withSpring(on ? Math.max(-lim, Math.min(lim, q * MAGNIFY)) : 0, { damping: 18, stiffness: 140 });
    by.value = withSpring(on ? Math.max(-lim, Math.min(lim, -p * MAGNIFY)) : 0, { damping: 18, stiffness: 140 });
    glow.value = withTiming(on ? Math.min(1, Math.abs(p) * 3) : 0, { duration: 200 });
  }, [p, q, relative, running, lim, bx, by, glow]);
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: bx.value }, { translateY: by.value }] }));

  const b = m.reading?.breath;
  const perMin = b?.perMin ? `${Math.round(b.perMin)}` : '—';
  const status = !running ? 'Ready' : m.phase === 'measuring' ? (b?.status === 'regular' ? 'Steady' : b?.status === 'irregular' ? 'Uneven' : b?.status === 'none' ? 'No breaths' : 'Reading') : HINT[m.phase];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space[2], paddingBottom: insets.bottom + 120, paddingHorizontal: space[4], gap: space[4] }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            Breathing
          </Text>
          {m.kind && (
            <Glass radius={radius.pill} variant="clear" style={styles.pill}>
              <View style={styles.pillRow}>
                <View style={[styles.liveDot, { backgroundColor: running ? LEVEL : color.inkFaint }]} />
                <Text variant="caption" tone="muted">
                  {m.kind === 'simulated' ? 'Simulated · no sensor here' : 'Phone sensor'}
                </Text>
              </View>
            </Glass>
          )}
        </View>

        {/* The lens: a glowing orb under liquid glass, and a glass bubble that moves with the chest. */}
        <Pressable
          onPress={() => {
            if (!running) return;
            haptic('navigate');
            m.relevel();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Tilt ${p.toFixed(2)} degrees head to foot, ${q.toFixed(2)} side to side`}
          accessibilityHint={running ? 'Tap to set this angle as zero' : undefined}
          style={[styles.stage, { height: lens + space[8] }]}>
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Orb size={lens + space[8]} tint={GREEN} energy={running ? 0.6 : 0.15} />
          </View>
          <Glass radius={lens / 2} variant="clear" style={{ width: lens, height: lens }}>
            <View style={[styles.center, { width: lens, height: lens }]}>
              <View style={[styles.ring, { width: lens * 0.34, height: lens * 0.34, borderRadius: lens * 0.17 }]} />
              <View style={[styles.cross, { width: 1, height: lens - 24 }]} />
              <View style={[styles.cross, { height: 1, width: lens - 24 }]} />
              <Animated.View style={[styles.bubbleWrap, bubble]}>
                <Glass radius={lens * 0.17} variant="regular" tint="rgba(78,216,168,0.18)" style={{ width: lens * 0.34, height: lens * 0.34 }} />
              </Animated.View>
              <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                <Text style={styles.bigAngle} tabular>
                  {deg(p)}
                </Text>
                <Text variant="mono" tone="muted" tabular>
                  {relative ? 'from level' : 'resting angle'}
                </Text>
              </View>
            </View>
          </Glass>
        </Pressable>

        <Text variant="bodyStrong" style={styles.hint}>
          {HINT[m.phase] ?? ''}
        </Text>

        {/* The numbers, live. */}
        <View style={styles.tiles}>
          <Tile label="Head to foot" value={deg(p)} />
          <Tile label="Side" value={deg(q)} />
          <Tile label="Breaths/min" value={perMin} />
        </View>

        <Glass radius={radius.lg} style={styles.waveCard}>
          <View style={styles.waveHead}>
            <Text variant="caption" tone="muted">
              Chest movement
            </Text>
            <Text variant="caption" style={{ color: b?.status === 'regular' ? LEVEL : color.ink }}>
              {status}
            </Text>
          </View>
          <TiltTrace reading={m.reading} width={inner - 2 * space[3]} height={96} accent={LEVEL} window={m.reading ? Math.round(m.reading.seconds) : 30} />
        </Glass>

        {!running ? (
          <Button size="emergency" kind="tint" tint={LEVEL} icon={Play} label="Start" onPress={m.start} />
        ) : (
          <View style={styles.row}>
            <Button icon={ArrowsClockwise} label="Level" onPress={m.relevel} style={{ flex: 1 }} />
            <Button icon={Stop} label="Stop" onPress={m.stop} style={{ flex: 1 }} />
          </View>
        )}

        {m.kind === 'simulated' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SCENARIOS.map((s) => {
              const on = m.scenario === s.id;
              return (
                <Pressable key={s.id} onPress={() => m.setScenario(s.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Glass radius={radius.pill} variant={on ? 'regular' : 'clear'} tint={on ? 'rgba(78,216,168,0.28)' : undefined} style={styles.chip}>
                    <Text variant="caption" style={{ color: on ? color.ink : color.inkMuted }}>
                      {s.label}
                    </Text>
                  </Glass>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Glass radius={radius.md} style={styles.tile}>
      <View style={styles.tileInner}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.tileValue} tabular numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: space[1] },
  pill: { height: 30, justifyContent: 'center', paddingHorizontal: space[3] },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(242,239,232,0.45)' },
  cross: { position: 'absolute', backgroundColor: 'rgba(242,239,232,0.12)' },
  bubbleWrap: { position: 'absolute' },
  bigAngle: { fontFamily: font.monoMedium, fontSize: 40, lineHeight: 46, letterSpacing: -1.5, color: color.ink },
  hint: { textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: space[2] },
  tile: { flex: 1 },
  tileInner: { paddingHorizontal: space[3], paddingVertical: space[3], gap: 2 },
  tileValue: { fontFamily: font.monoMedium, fontSize: 19, lineHeight: 24, color: color.ink },
  waveCard: { padding: space[3], gap: space[2] },
  waveHead: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: space[3] },
  chips: { gap: space[2], paddingVertical: space[1] },
  chip: { height: 34, justifyContent: 'center', paddingHorizontal: space[3] },
});
