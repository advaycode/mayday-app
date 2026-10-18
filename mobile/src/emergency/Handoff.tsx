import { router } from 'expo-router';
import { ArrowCounterClockwise, ShareNetwork } from 'phosphor-react-native';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/design/Button';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';
import { clockWithSeconds, summaryLine } from '@/incident/log';
import { formatCoords } from '@/location/location';
import { hasMedicalId, useSettings } from '@/settings/store';

import type { Incident } from './useIncident';

const LABELS = { name: 'Name', born: 'Born', conditions: 'Conditions', medications: 'Medications', allergies: 'Allergies', contact: 'Emergency contact' };

/**
 * For the paramedics: one line of what they need most, then everything that
 * happened, to the second. Big enough to read over a shoulder.
 */
export function Handoff({ incident, onBack }: { incident: Incident; onBack: () => void }) {
  const { state, slots } = incident;
  const { medical } = useSettings();
  const summary = summaryLine(state.log, slots, state.engine?.protocolId ?? null);
  const text = [
    `Mayday incident log`,
    summary,
    state.fix ? `Location: ${state.fix.address ?? ''} ${formatCoords(state.fix)}` : '',
    '',
    ...state.log.map((e) => `${clockWithSeconds(e.at)}  ${e.text}`),
  ].join('\n');

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted">
        For paramedics
      </Text>
      <Text variant="title" style={{ marginTop: space[2] }} selectable>
        {summary}
      </Text>
      <View style={styles.rule} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space[3], paddingBottom: space[4] }}>
        {hasMedicalId(medical) && (
          <View style={styles.medical}>
            <Text variant="caption" tone="muted">
              Phone owner's Medical ID
            </Text>
            {Object.entries(medical)
              .filter(([, v]) => v.trim())
              .map(([k, v]) => (
                <Text key={k} variant="body" selectable>
                  {LABELS[k as keyof typeof LABELS]}: {v}
                </Text>
              ))}
          </View>
        )}
        {state.log.map((e, i) => (
          <View key={i} style={styles.row}>
            <Text variant="mono" tone="muted" tabular style={styles.time}>
              {clockWithSeconds(e.at)}
            </Text>
            <Text variant="body" style={{ flex: 1 }} selectable>
              {e.text}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Button label="Back" icon={ArrowCounterClockwise} onPress={onBack} style={{ flex: 1 }} />
        <Button label="Share" icon={ShareNetwork} onPress={() => Share.share({ message: text }).catch(() => {})} style={{ flex: 1 }} />
      </View>
      <Button label="End" kind="primary" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[5], paddingBottom: space[3], gap: space[3] },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairlineStrong },
  row: { flexDirection: 'row', gap: space[4], alignItems: 'baseline' },
  time: { width: 78 },
  actions: { flexDirection: 'row', gap: space[3] },
  medical: { gap: space[1], padding: space[4], borderRadius: 14, backgroundColor: color.raised },
});
