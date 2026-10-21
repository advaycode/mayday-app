import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { EMERGENCIES } from '@/design/emergencies';
import { EmergencyTile } from '@/design/EmergencyTile';
import { Orb } from '@/design/Orb';
import { Text } from '@/design/Text';
import { space } from '@/design/tokens';

import type { Incident } from './useIncident';

type Props = {
  incident: Incident;
  level: SharedValue<number>;
  listening: boolean;
};

/**
 * Before we know what is happening: Mayday listens (the light moves with the
 * voice, and the words appear as they are heard), and every emergency is one
 * tap below it.
 */
export function Intake({ incident, level, listening }: Props) {
  const { state, startProtocol } = incident;
  const heard = listening && state.heard && !state.heard.final ? state.heard.text : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.listen} accessibilityLiveRegion="polite">
        <Orb size={128} level={level} energy={listening ? 1 : 0} />
        <Text variant="instruction" numberOfLines={3} style={styles.prompt}>
          {heard ?? (listening ? 'Say what happened' : "What's happening?")}
        </Text>
      </View>

      <View style={styles.grid}>
        {EMERGENCIES.map((e) => (
          <EmergencyTile key={e.id} emergency={e} compact style={styles.cell} onPress={() => startProtocol(e.protocol, e.slots)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[4], justifyContent: 'space-between', paddingBottom: space[2] },
  listen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], paddingHorizontal: space[2] },
  prompt: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cell: { width: '48%', flexGrow: 1 },
});
