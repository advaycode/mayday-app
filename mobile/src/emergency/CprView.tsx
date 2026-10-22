import { Ambulance, Lightning } from 'phosphor-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePaceSensor } from '@/cpr/usePaceSensor';
import { useCprCoach } from '@/cpr/useCprCoach';
import { Button } from '@/design/Button';
import { emergencyFor } from '@/design/emergencies';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';
import { elapsed } from '@/incident/log';
import type { StepOf } from '@/protocols/schema';
import { personalize } from '@/voice/adapt';
import { voiceContext } from '@/voice/voice';

import { PulseRing } from './parts';
import type { Incident } from './useIncident';

/**
 * The compression coach. The number is the point of the screen: 128 pt, so a
 * rescuer can follow it from their knees without reading anything else.
 */
export function CprView({ incident, step }: { incident: Incident; step: StepOf<'cpr'> }) {
  const tone = emergencyFor(incident.state.engine?.protocolId).tint;
  const { slots, dispatch, handoff, log, state } = incident;
  const mode = step.ratio === '30:2' || (step.ratio === 'fromSlot' && slots.rescue_breaths === 'true') ? '30:2' : 'handsOnly';
  const reentry = (state.engine?.visits[`${state.engine.protocolId}#${step.id}`] ?? 1) > 1;
  const intro = useMemo(
    () => (reentry && step.resumeSay.length ? step.resumeSay : [...step.say, step.depthSay]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reentry, step.id],
  );

  // The phone feeling the compressions: pace lines in the coaching slot, and a line on screen.
  const pace = usePaceSensor(true);
  const coach = useCprCoach({
    active: true,
    mode,
    introLines: intro,
    reminders: step.reminders,
    breathsSay: step.breathsSay,
    swapEveryS: step.swapEveryS,
    onStart: (at) => log(reentry ? 'Compressions resumed' : `Compressions started (${mode === '30:2' ? '30:2 with breaths' : 'hands only'})`, at),
    onSwap: () => log('Rescuer swap prompted'),
    paceLine: pace.paceLine,
  });
  pace.phase.current = coach.phase;

  const big =
    coach.phase === 'intro' ? 'Ready' : coach.phase === 'breaths' ? 'Breathe' : coach.count !== null ? String(coach.count) : '';
  const bigIsNumber = coach.count !== null && coach.phase === 'compress';

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <View style={styles.countWrap}>
          <PulseRing size={250} pulse={coach.pulse} tone={tone.hue} />
          <Text
            variant={bigIsNumber ? 'count' : 'display'}
            tabular
            style={[styles.count, !bigIsNumber && { fontSize: 44, lineHeight: 50 }]}
            accessibilityLabel={bigIsNumber ? `Compression ${coach.count}` : big}>
            {big}
          </Text>
        </View>

        <Text variant="instruction" style={styles.instruction}>
          {coach.phase === 'breaths' ? 'Two breaths' : personalize(step.text, voiceContext().pronoun)}
        </Text>

        <View style={styles.meta}>
          <Text variant="timer" tone="muted" tabular accessibilityLabel={`${Math.floor(coach.elapsed / 60)} minutes of compressions`}>
            {elapsed(coach.elapsed * 1000)}
          </Text>
          {!coach.withAudio && (
            <Text variant="caption" tone="faint">
              sound off
            </Text>
          )}
        </View>
        <PaceLine pace={pace} />
      </View>

      <View style={styles.actions}>
        <Button size="emergency" kind="tint" tint={tone.hue} icon={Lightning} label="AED is here" onPress={() => dispatch({ type: 'intent', intent: 'aed_here', at: Date.now() })} />
        <Button icon={Ambulance} label="Paramedics are here" onPress={handoff} />
      </View>
    </View>
  );
}

/** One quiet line under the timer: the pace the phone feels, or nothing at all where it cannot feel it. */
export function PaceLine({ pace }: { pace: ReturnType<typeof usePaceSensor> }) {
  if (pace.status === 'needs-tap') {
    return (
      <Pressable onPress={() => void pace.startFromTap()} accessibilityRole="button" accessibilityLabel="Let the phone feel your compressions" hitSlop={10} style={styles.paceChip}>
        <Text variant="caption" tone="muted">
          Check my pace
        </Text>
      </Pressable>
    );
  }
  if (pace.status !== 'on') return null;
  const { trusted, perMin, advice } = pace.summary;
  if (!trusted || perMin === null) {
    return (
      <Text variant="caption" tone="faint" accessibilityLiveRegion="polite">
        {advice === 'keep' ? 'Keep pushing' : 'Feeling for your pushes'}
      </Text>
    );
  }
  const note = advice === 'faster' ? 'faster' : advice === 'slower' ? 'a little slower' : 'good';
  return (
    <Text variant="caption" tone={advice ? 'ink' : 'muted'} tabular accessibilityLiveRegion="polite" accessibilityLabel={`Your pace ${Math.round(perMin)} a minute, ${note}`}>
      Your pace {Math.round(perMin)} · {note}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[5], paddingBottom: space[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  countWrap: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center', marginBottom: space[4] },
  count: { color: color.ink, textAlign: 'center' },
  instruction: { textAlign: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[4] },
  paceChip: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairlineStrong },
  // Full width, one above the other: side by side the words were cut off.
  actions: { gap: space[2] },
});
