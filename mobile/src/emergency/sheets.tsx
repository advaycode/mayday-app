import { Brain, ChatText, Fire, Person, Phone, PhoneDisconnect, Pill } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { DEMO_DIAL, DEMO_MODE } from '@/config';
import { Button } from '@/design/Button';
import { Sheet } from '@/design/Sheet';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';
import { elapsed, summaryLine } from '@/incident/log';
import { formatCoords } from '@/location/location';

import { textTo911 } from './call';
import type { Incident } from './useIncident';

/**
 * "Tell the dispatcher": the three things a 911 call-taker asks first, ready
 * to read out. Where you are, how precise that is, and what happened.
 */
export function DispatcherSheet({ incident, open, onClose, now }: { incident: Incident; open: boolean; onClose: () => void; now: number }) {
  const { state, slots, call, cancelCall } = incident;
  const fix = state.fix;
  const summary = summaryLine(state.log, slots, state.engine?.protocolId ?? null);
  const where = fix?.address ?? (fix ? 'Address unavailable' : 'Finding location');
  const simulated = state.call.status === 'calling' && state.call.how === 'simulated';

  const body = `EMERGENCY. ${summary} Location: ${fix?.address ?? ''} ${fix ? formatCoords(fix) : ''}`.trim();

  return (
    <Sheet open={open} onClose={onClose}>
      {simulated && (
        <View style={styles.callRow}>
          <Text variant="bodyStrong" tabular>
            Demo call to 911  {elapsed(now - (state.call.placedAt ?? now))}
          </Text>
          <Text variant="caption" tone="faint">
            No real call. Simulated for testing.
          </Text>
        </View>
      )}
      <Text variant="caption" tone="muted">
        Tell the dispatcher
      </Text>
      <Text variant="title" selectable>
        {where}
        {fix?.source === 'demo' ? '  (demo location)' : ''}
      </Text>
      {fix && (
        <Text variant="mono" tone="muted" selectable>
          {formatCoords(fix)}
          {fix.accuracy ? `  ±${Math.round(fix.accuracy)} m` : ''}
        </Text>
      )}
      <View style={styles.rule} />
      <Text variant="body" selectable>
        {summary}
      </Text>
      <View style={styles.row}>
        {state.call.status === 'calling' ? (
          <Button label={simulated ? 'End call' : 'Close'} icon={PhoneDisconnect} onPress={() => (simulated ? cancelCall() : onClose())} style={{ flex: 1 }} />
        ) : (
          <Button label="Call 911" kind="signal" icon={Phone} onPress={() => { call(); onClose(); }} style={{ flex: 1 }} />
        )}
        <Button label="Text 911" icon={ChatText} onPress={() => textTo911(body)} style={{ flex: 1 }} />
      </View>
      <Text variant="caption" tone="faint">
        Text to 911 works in many, not all, counties.{DEMO_MODE ? (DEMO_DIAL ? ' Demo: goes to the test number.' : ' Demo: disabled.') : ''}
      </Text>
    </Sheet>
  );
}

/** Everything that is not one of the three big tiles. */
export function MoreSheet({ incident, open, onClose }: { incident: Incident; open: boolean; onClose: () => void }) {
  const { startProtocol, setAge, slots } = incident;
  const go = (id: Parameters<typeof startProtocol>[0], extra?: Parameters<typeof startProtocol>[1]) => {
    onClose();
    startProtocol(id, extra);
  };
  const age = slots.age_group ?? 'adult';
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.ageRow} accessibilityRole="radiogroup" accessibilityLabel="Age">
        {(['adult', 'child', 'infant'] as const).map((a) => (
          <Button
            key={a}
            label={a === 'infant' ? 'Baby' : a === 'child' ? 'Child' : 'Adult'}
            kind={age === a ? 'primary' : 'glass'}
            onPress={() => setAge(a)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button stacked size="emergency" icon={Person} label="Passed out" onPress={() => go('recovery_position', { conscious: 'false' })} style={{ flex: 1 }} />
        <Button stacked size="emergency" icon={Pill} label="Overdose" onPress={() => go('opioid_overdose')} style={{ flex: 1 }} />
      </View>
      <View style={styles.row}>
        <Button stacked size="emergency" icon={Brain} label="Stroke" onPress={() => go('stroke')} style={{ flex: 1 }} />
        <Button stacked size="emergency" icon={Fire} label="Burn" onPress={() => go('burns')} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[3] },
  ageRow: { flexDirection: 'row', gap: space[2] },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairlineStrong, marginVertical: space[1] },
  callRow: { gap: space[1], paddingBottom: space[2] },
});
