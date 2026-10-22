import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Play, X } from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/design/Button';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { RoundButton } from '@/emergency/parts';
import { SCENARIOS } from '@/sensors/sim';
import { BreathStats, HeartPanel, LEVEL, LevelDial, Placement, TiltTrace } from '@/sensors/ui';
import { useMonitor } from '@/sensors/useMonitor';

const HINT: Record<string, string> = {
  idle: 'Lie down. Phone on your chest: top on the chest, bottom on the belly.',
  starting: 'Starting the sensor',
  place: 'Lay it down and let go',
  leveling: 'Leveling: hold still',
  measuring: 'Measuring. Tap the dial to level again.',
  unavailable: 'This device has no motion sensor.',
};

/**
 * The breathing sensor, to try on yourself: the level magnified 40 times,
 * 30 seconds of breathing, and the experimental heartbeat. On a computer
 * there is no accelerometer, so a simulated person lies under the phone
 * instead, and you can switch what they are doing.
 */
export default function Sensor() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const insets = useDeviceInsets();
  const { width } = useWindowDimensions();
  const m = useMonitor({ mode: 'lab', scenario: 'normal' });
  const inner = width - 2 * space[5];
  const running = m.phase !== 'idle' && m.phase !== 'unavailable';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <RoundButton
          onPress={() => {
            m.stop();
            router.back();
          }}
          label="Close">
          <X size={22} color={color.ink} />
        </RoundButton>
        <Text variant="bodyStrong">Breathing sensor</Text>
        <View style={styles.source}>
          <Text variant="caption" tone="muted">
            {m.kind === 'simulated' ? 'Simulated' : m.kind === 'phone' ? 'Phone sensor' : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space[6] }]}>
        <Text variant="body" tone="muted" style={styles.center}>
          {HINT[m.phase] ?? ''}
        </Text>

        {!running ? (
          <>
            <Placement width={Math.min(320, inner)} accent={LEVEL} />
            <Button size="emergency" kind="tint" tint={LEVEL} icon={Play} label="Start" onPress={m.start} />
          </>
        ) : (
          <>
            <Pressable
              onPress={() => {
                haptic('navigate');
                m.relevel();
              }}
              accessibilityRole="button"
              accessibilityLabel="Level again"
              accessibilityHint="Sets the current angle as zero"
              style={{ alignSelf: 'center' }}>
              <LevelDial level={m.level} size={Math.min(248, inner)} active={m.phase === 'measuring'} />
            </Pressable>
            <TiltTrace reading={m.reading} width={inner} accent={LEVEL} window={m.reading ? Math.round(m.reading.seconds) : 30} />
            <BreathStats breath={m.reading?.breath ?? null} lab />
            {m.reading?.breath.why ? (
              <Text variant="mono" tone="faint" style={styles.center}>
                {m.reading.breath.why} · noise {m.reading.noiseDeg.toFixed(3)}° · {m.reading.rate}/s
                {m.reading.gyro ? ` · gyro ${m.reading.gyro.locked ? `matched ${m.reading.gyro.match.toFixed(2)}${m.reading.gyro.blended ? ', blended' : ''}` : 'not matched yet'}` : ' · no gyro'}
              </Text>
            ) : null}
            <HeartPanel heart={m.reading?.heart ?? null} width={inner} method={m.heartMethod} onSwitch={() => m.setHeartMethod(m.heartMethod === 'model' ? 'rules' : 'model')} />
          </>
        )}

        {m.kind === 'simulated' && (
          <View style={styles.scenarios}>
            <Text variant="caption" tone="muted">
              The simulated person is
            </Text>
            <View style={styles.chips}>
              {SCENARIOS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => m.setScenario(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: m.scenario === s.id }}
                  style={[styles.chip, m.scenario === s.id && styles.chipOn]}>
                  <Text variant="caption" style={{ color: m.scenario === s.id ? color.void : color.ink }}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Text variant="caption" tone="faint" style={styles.center}>
          Experimental, including chest & belly and the heartbeat. In an emergency Mayday only uses this to tell you to start CPR sooner, never to tell you someone is fine.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], height: 60 },
  source: { width: 72, alignItems: 'flex-end' },
  body: { alignItems: 'stretch', gap: space[4], paddingHorizontal: space[5], paddingTop: space[2] },
  center: { textAlign: 'center', alignSelf: 'center' },
  scenarios: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairlineStrong },
  chipOn: { backgroundColor: LEVEL, borderColor: LEVEL },
});
