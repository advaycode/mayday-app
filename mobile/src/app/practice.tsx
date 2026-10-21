import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { unlockAudio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { useCprCoach } from '@/cpr/useCprCoach';
import { Button } from '@/design/Button';
import { Glass } from '@/design/Glass';
import { useDeviceInsets } from '@/design/insets';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { PulseRing } from '@/emergency/parts';
import { elapsed } from '@/incident/log';
import { protocols } from '@/protocols';

const step = protocols.cpr_adult.steps.find((s) => s.kind === 'cpr')!;

/**
 * Practice: the same coach as a real emergency, with no 911, on a cushion.
 * Two minutes is one full rescuer shift, so it ends on the swap prompt.
 */
export default function Practice() {
  // The screen stays on while helping. On web the lock can still be pending when
  // the screen closes; releasing it early is harmless, so the warning is muted.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const insets = useDeviceInsets();
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'handsOnly' | '30:2'>('handsOnly');

  useEffect(() => () => setActive(false), []);

  const coach = useCprCoach({
    active,
    mode,
    introLines: [systemLines.lines.practiceStart],
    reminders: step.kind === 'cpr' ? step.reminders : [],
    breathsSay: step.kind === 'cpr' ? step.breathsSay : [],
    swapEveryS: 120,
    onSwap: () => setTimeout(() => setActive(false), 3500),
  });

  const big = !active ? 'Ready' : coach.phase === 'intro' ? 'Ready' : coach.phase === 'breaths' ? 'Breathe' : coach.count !== null ? String(coach.count) : '';
  const isNumber = active && coach.phase === 'compress' && coach.count !== null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + space[3] }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close practice" hitSlop={8}>
          <Glass radius={radius.pill} style={{ width: 44, height: 44 }}>
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <X size={22} color={color.ink} />
            </View>
          </Glass>
        </Pressable>
        <Text variant="bodyStrong" tone="muted">
          Practice
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.center}>
        <View style={styles.countWrap}>
          <PulseRing size={250} pulse={coach.pulse} />
          <Text variant={isNumber ? 'count' : 'display'} tabular style={[{ color: color.ink, textAlign: 'center' }, !isNumber && { fontSize: 44, lineHeight: 50 }]}>
            {big}
          </Text>
        </View>
        <Text variant="instruction" style={{ textAlign: 'center' }}>
          {active ? (coach.phase === 'breaths' ? 'Two breaths' : 'Push on the beat') : 'Kneel by a firm cushion'}
        </Text>
        <Text variant="instructionSub" tone="muted" style={{ textAlign: 'center', maxWidth: 330 }}>
          {active ? 'About 2 inches. Let it come back up.' : '110 a minute. Heel of the hand, arms straight.'}
        </Text>
        {active && (
          <Text variant="timer" tone="muted" tabular style={{ marginTop: space[4] }}>
            {elapsed(coach.elapsed * 1000)}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {!active && (
          <View style={styles.modes}>
            {(['handsOnly', '30:2'] as const).map((m) => (
              <Button key={m} label={m === 'handsOnly' ? 'Hands only' : '30 and 2'} kind={mode === m ? 'primary' : 'glass'} onPress={() => setMode(m)} style={{ flex: 1 }} />
            ))}
          </View>
        )}
        <Button
          size="emergency"
          kind={active ? 'glass' : 'primary'}
          label={active ? 'Stop' : 'Start'}
          onPress={() => {
            unlockAudio();
            setActive((a) => !a);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  top: { height: 60, paddingHorizontal: space[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: space[5] },
  countWrap: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center', marginBottom: space[4] },
  actions: { paddingHorizontal: space[5], gap: space[3] },
  modes: { flexDirection: 'row', gap: space[3] },
});
