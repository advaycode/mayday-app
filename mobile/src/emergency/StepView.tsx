import { Ambulance } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design/Button';
import { haptic } from '@/design/haptics';
import { Text } from '@/design/Text';
import { space } from '@/design/tokens';
import { Visual } from '@/design/Visual';
import { elapsed } from '@/incident/log';
import type { Step } from '@/protocols/schema';
import { personalize } from '@/voice/adapt';
import { say, voiceContext } from '@/voice/voice';

import type { Incident } from './useIncident';

/**
 * One protocol step on screen: a picture, the instruction in type you can
 * read from the floor, and the answers as big buttons. Voice does the same
 * things as the buttons; the buttons always work.
 */
export function StepView({ incident, step }: { incident: Incident; step: Exclude<Step, { kind: 'cpr' }> }) {
  const { dispatch, handoff } = incident;
  const at = () => Date.now();
  const stepKey = `${incident.state.engine?.protocolId}#${step.id}#${incident.state.engine?.trail.length}`;

  // Ask steps with a timeout move on by themselves if nobody answers.
  useEffect(() => {
    if (step.kind !== 'ask' || !step.timeoutS) return;
    const t = setTimeout(() => dispatch({ type: 'timeout', at: at() }), step.timeoutS * 1000 + 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // Hold steps (pressure on a wound) get a calm reminder every so often.
  useEffect(() => {
    if (step.kind !== 'hold') return;
    let i = 0;
    const t = setInterval(() => {
      say([step.reminders[i++ % step.reminders.length]], { calm: false });
      haptic('attention');
    }, step.remindEveryS * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const timer = useTimer(step.kind === 'timer' ? step.seconds : null, stepKey, () => dispatch({ type: 'timeout', at: at() }));

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <Visual id={step.visual} size={280} />
        <Text
          variant="instruction"
          style={styles.instruction}
          accessibilityRole="header"
          accessibilityLiveRegion="assertive"
          accessibilityHint={step.sub}>
          {personalize(step.text, voiceContext().pronoun)}
        </Text>
        {timer !== null && (
          <Text variant="countdown" tabular style={{ marginTop: space[4] }} accessibilityLabel={`${Math.ceil(timer / 60)} minutes left`}>
            {elapsed(timer * 1000)}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {step.kind === 'do' && (
          <>
            {step.alts.map((c) => (
              <Button key={c.id} size="emergency" label={c.label} onPress={() => dispatch({ type: 'choose', choiceId: c.id, at: at() })} />
            ))}
            <Button size="emergency" kind="primary" label={step.action} onPress={() => dispatch({ type: 'advance', at: at() })} />
          </>
        )}
        {step.kind === 'ask' && (
          // Two short answers sit side by side; anything longer stacks, so no label is ever cut off.
          <View style={pairable(step.choices) ? styles.pair : styles.stack}>
            {step.choices.map((c) => (
              <Button
                key={c.id}
                size="emergency"
                label={c.label}
                onPress={() => dispatch({ type: 'choose', choiceId: c.id, at: at() })}
                style={pairable(step.choices) ? { flex: 1 } : undefined}
              />
            ))}
          </View>
        )}
        {step.kind === 'timer' && (
          <Button size="emergency" kind="primary" label={step.action} onPress={() => dispatch({ type: 'advance', at: at() })} />
        )}
        {(step.kind === 'hold' || step.kind === 'end') && (
          <>
            {step.choices.map((c) => (
              <Button key={c.id} size="emergency" label={c.label} onPress={() => dispatch({ type: 'choose', choiceId: c.id, at: at() })} />
            ))}
            <Button size="emergency" icon={Ambulance} label="Paramedics are here" onPress={handoff} />
          </>
        )}
      </View>
    </View>
  );
}

const pairable = (choices: { label: string }[]) => choices.length === 2 && choices.every((c) => c.label.length <= 10);

/** Counts down from `seconds` for this step; calls onDone once at zero. */
function useTimer(seconds: number | null, key: string, onDone: () => void) {
  const [left, setLeft] = useState<number | null>(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (seconds === null) {
      setLeft(null);
      return;
    }
    const end = Date.now() + seconds * 1000;
    setLeft(seconds);
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        done.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [seconds, key]);
  return left;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[5], paddingBottom: space[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  instruction: { textAlign: 'center', marginTop: space[2] },
  actions: { gap: space[3] },
  pair: { flexDirection: 'row', gap: space[3] },
  stack: { gap: space[3] },
});

