import { Ambulance, Camera, Phone } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { capabilities } from '@/ai/proxy';
import { Button } from '@/design/Button';
import { EMERGENCIES } from '@/design/emergencies';
import { EmergencyTile } from '@/design/EmergencyTile';
import { Sheet } from '@/design/Sheet';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';
import { summaryLine } from '@/incident/log';
import { formatCoords } from '@/location/location';
import { careAdvice, distanceText, miles } from '@/facilities/nearest';
import { useRegion } from '@/region/store';
import { protocols } from '@/protocols';

import type { Incident } from './useIncident';

/**
 * 911. Mayday does not dial: this is what to say when you call. The three
 * things a call-taker asks first, ready to read out: where you are, how
 * precise that is, and what happened.
 */
export function DispatcherSheet({ incident, open, onClose }: { incident: Incident; open: boolean; onClose: () => void }) {
  const { state, slots } = incident;
  const region = useRegion();
  const fix = state.fix;
  const summary = summaryLine(state.log, slots, state.engine?.protocolId ?? null);
  const where = fix?.address ?? (fix ? 'Address unavailable' : 'Finding location');
  const care = state.engine ? protocols[state.engine.protocolId].care : null;
  const advice = fix ? careAdvice(care, slots, fix) : null;

  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.callHead}>
        <View style={styles.callIcon}>
          <Phone size={22} color={color.onSignal} weight="fill" />
        </View>
        <Text variant="title" style={{ flex: 1 }}>
          Call {region.number} on your phone
        </Text>
      </View>
      {region.alsoCall ? (
        <Text variant="caption" tone="muted">
          Or {region.alsoCall}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        Tell them
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
      {fix && advice && advice.likely && (
        <Text variant="caption" tone="muted">
          Nearest {region.id === 'us-fl' ? 'ER' : 'hospital'}: {advice.likely.f.name}, {distanceText(miles(fix, advice.likely.f))}
        </Text>
      )}
      <Button label="Done" kind="primary" onPress={onClose} />
    </Sheet>
  );
}

/** Change what is happening, or who it is happening to. */
export function MoreSheet({ incident, open, onClose, onScan }: { incident: Incident; open: boolean; onClose: () => void; onScan: () => void }) {
  const { startProtocol, setAge, slots, state, handoff } = incident;
  const age = slots.age_group ?? 'adult';
  const family = state.engine?.protocolId.startsWith('cpr') || state.engine?.protocolId.startsWith('choking');
  // Photo check needs Claude behind the proxy; without it the button is not shown at all.
  const [vision, setVision] = useState(false);
  useEffect(() => {
    capabilities().then((c) => setVision(c.claude));
  }, []);
  return (
    <Sheet open={open} onClose={onClose}>
      {family && (
        <View style={styles.ageRow} accessibilityRole="radiogroup" accessibilityLabel="Age">
          {(['adult', 'child', 'infant'] as const).map((a) => (
            <Button
              key={a}
              label={a === 'infant' ? 'Baby' : a === 'child' ? 'Child' : 'Adult'}
              kind={age === a ? 'primary' : 'glass'}
              onPress={() => {
                setAge(a);
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      )}
      <View style={styles.grid}>
        {EMERGENCIES.map((e) => (
          <EmergencyTile
            key={e.id}
            emergency={e}
            compact
            style={styles.cell}
            onPress={() => {
              onClose();
              startProtocol(e.protocol, e.slots);
            }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button
          icon={Ambulance}
          label="Paramedics here"
          onPress={() => {
            onClose();
            handoff();
          }}
          style={{ flex: 1 }}
        />
        {vision && <Button label="Photo" icon={Camera} onPress={onScan} accessibilityHint="Take a photo of a burn or wound to pick the right steps" style={{ flex: 1 }} />}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[3] },
  ageRow: { flexDirection: 'row', gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cell: { width: '48%', flexGrow: 1 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairlineStrong, marginVertical: space[1] },
  callHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  callIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.signal, alignItems: 'center', justifyContent: 'center' },
});
