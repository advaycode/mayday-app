import { ArrowClockwise, X } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { audio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { Button } from '@/design/Button';
import { emergencyFor } from '@/design/emergencies';
import { haptic } from '@/design/haptics';
import { Text } from '@/design/Text';
import { useDeviceInsets } from '@/design/insets';
import { color, radius, space } from '@/design/tokens';
import type { Step } from '@/protocols/schema';
import { suggestAnswer } from '@/sensors/analyze';
import { SCENARIOS } from '@/sensors/sim';
import { BreathStats, LevelDial, Placement, TiltTrace } from '@/sensors/ui';
import type { Monitor } from '@/sensors/useMonitor';

import { RoundButton } from './parts';
import type { Incident } from './useIncident';

type AskStep = Extract<Step, { kind: 'ask' }>;

/**
 * "Breathing normally?", checked with the phone: lay it on the chest, let
 * go, 10 seconds. It can say "no normal breathing seen, start CPR". It never
 * says "breathing normally": if the chest moves, it hands the question back
 * to the rescuer, because chest movement is not air moving (a blocked airway
 * or gasps move the chest too).
 */
export function BreathCheck({ incident, step, monitor, onClose }: { incident: Incident; step: AskStep; monitor: Monitor; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useDeviceInsets();
  const tone = emergencyFor(incident.state.engine?.protocolId).tint;
  const { phase, level, reading, final, secondsLeft, retries, kind, scenario } = monitor;
  const abnormal = step.choices.find((c) => c.value === 'abnormal');
  const b = final?.breath ?? null;
  const verdict = phase === 'done' && b ? (suggestAnswer(b) === 'abnormal' ? 'start-cpr' : b.status === 'regular' ? 'moving' : 'unsure') : null;

  // Say each stage once.
  const said = useRef('');
  useEffect(() => {
    const key = `${phase}:${verdict}:${retries}`;
    if (said.current === key) return;
    said.current = key;
    const L = systemLines.lines;
    if (phase === 'place') audio()?.speak(retries ? [L.sensorLetGo] : [L.sensorPlace, L.sensorHow]);
    if (phase === 'measuring') audio()?.speak([L.sensorMeasuring]);
    if (verdict === 'start-cpr') {
      audio()?.speak([L.sensorNone]);
      haptic('attention');
    }
    if (verdict === 'moving') audio()?.speak([L.sensorMoving]);
    if (verdict === 'unsure' || phase === 'unavailable') audio()?.speak([L.sensorUnsure]);
  }, [phase, verdict, retries]);

  // Log what the phone saw, once.
  const logged = useRef(false);
  useEffect(() => {
    if (phase !== 'done' || !b || logged.current) return;
    logged.current = true;
    incident.log(`Phone check (${kind === 'simulated' ? 'simulated' : 'sensor'}): ${b.why}`);
  }, [phase, b, kind, incident]);

  const close = () => {
    monitor.stop();
    onClose();
  };
  const choose = (choiceId: string) => {
    monitor.stop();
    onClose();
    incident.dispatch({ type: 'choose', choiceId, at: Date.now() });
  };

  const dial = Math.min(232, width - 2 * space[6], height * 0.3);
  const title =
    phase === 'starting' ? 'Starting the sensor'
    : phase === 'place' ? (retries ? 'Let go of the phone' : 'Lay it on their chest')
    : phase === 'leveling' ? 'Leveling'
    : phase === 'measuring' ? `Measuring · ${secondsLeft}`
    : phase === 'unavailable' ? 'No motion sensor'
    : verdict === 'start-cpr' ? (b?.status === 'none' ? 'No breathing seen' : 'Not normal breathing')
    : verdict === 'moving' ? 'Chest moving'
    : verdict === 'unsure' ? "Couldn't measure"
    : '';
  const sub =
    phase === 'place' ? 'Top on the chest. Bottom on the belly.'
    : phase === 'leveling' ? 'Hold still'
    : phase === 'measuring' ? "Don't touch it"
    : phase === 'unavailable' ? 'Watch the chest yourself.'
    : verdict === 'start-cpr' ? b?.why ?? ''
    : verdict === 'moving' ? `${Math.round(b!.perMin!)} a minute. Normal breathing, or gasping?`
    : verdict === 'unsure' ? 'Watch the chest yourself.'
    : '';

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.top}>
        <RoundButton onPress={close} label="Back to the question">
          <X size={22} color={color.ink} />
        </RoundButton>
        {kind === 'simulated' ? (
          <Pressable
            onPress={() => {
              const i = SCENARIOS.findIndex((s) => s.id === scenario);
              monitor.setScenario(SCENARIOS[(i + 1) % SCENARIOS.length].id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Simulated person: ${SCENARIOS.find((s) => s.id === scenario)?.label}. Tap to change.`}
            style={styles.chip}>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              Simulated · {SCENARIOS.find((s) => s.id === scenario)?.label}
            </Text>
          </Pressable>
        ) : (
          <Text variant="caption" tone="muted">
            Phone check
          </Text>
        )}
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.head}>
          <Text variant="instruction" style={styles.center} accessibilityRole="header" accessibilityLiveRegion="assertive">
            {title}
          </Text>
          {sub ? (
            <Text variant="body" tone="muted" style={styles.center}>
              {sub}
            </Text>
          ) : null}
        </View>

        {phase === 'place' || phase === 'starting' ? (
          <Placement width={Math.min(320, width - 2 * space[5])} accent={tone.hue} />
        ) : phase === 'leveling' || phase === 'measuring' ? (
          <LevelDial level={level} size={dial} active />
        ) : null}

        {(phase === 'measuring' || phase === 'done') && (
          <>
            <TiltTrace reading={phase === 'done' ? final : reading} width={width - 2 * space[5]} height={88} accent={tone.hue} window={10} />
            <BreathStats breath={(phase === 'done' ? final : reading)?.breath ?? null} />
          </>
        )}
      </View>

      <View style={styles.actions}>
        {verdict === 'start-cpr' && abnormal && <Button size="emergency" kind="tint" tint={tone.hue} label="Start CPR" onPress={() => choose(abnormal.id)} />}
        {verdict === 'moving' && step.choices.map((c) => <Button key={c.id} size="emergency" label={c.label} onPress={() => choose(c.id)} />)}
        {(phase === 'done' || phase === 'unavailable') && (
          <Button icon={ArrowClockwise} label={phase === 'unavailable' ? 'Back' : 'Measure again'} onPress={phase === 'unavailable' ? close : monitor.start} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: color.void },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[2], height: 60 },
  chip: { paddingHorizontal: space[3], height: 32, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairlineStrong, justifyContent: 'center', maxWidth: 260 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: space[5] },
  head: { gap: space[1], alignItems: 'center' },
  center: { textAlign: 'center' },
  actions: { paddingHorizontal: space[4], paddingBottom: space[5], gap: space[2] },
});
