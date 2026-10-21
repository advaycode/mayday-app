import { router } from 'expo-router';
import { Phone } from 'phosphor-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { unlockAudio } from '@/audio/engine';
import { EMERGENCIES, type Emergency } from '@/design/emergencies';
import { EmergencyTile } from '@/design/EmergencyTile';
import { useDeviceInsets } from '@/design/insets';
import { TalkButton } from '@/design/TalkButton';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';

/**
 * Home is the emergency screen. The biggest thing on it is Talk to Mayday;
 * below it, every kind of emergency as one colored tile. One tap either way
 * and the steps start. Mayday never calls 911: the red line says to call.
 */
export default function Home() {
  const insets = useDeviceInsets();

  const talk = () => {
    unlockAudio();
    router.push({ pathname: '/emergency', params: { talk: '1' } });
  };
  const open = (e: Emergency) => {
    unlockAudio();
    router.push({ pathname: '/emergency', params: { tile: e.id } });
  };

  const [last, ...rest] = [...EMERGENCIES].reverse();
  const grid = rest.reverse();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space[2], paddingBottom: insets.bottom + 112, paddingHorizontal: space[4], gap: space[4] }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Mayday
        </Text>
        <View style={styles.call} accessible accessibilityLabel="Call 911 first. Mayday does not call for you.">
          <Phone size={16} color={color.signal} weight="fill" />
          <Text variant="bodyStrong" style={{ color: color.ink }}>
            Call 911 first
          </Text>
        </View>
      </View>

      <TalkButton size="hero" onPress={talk} />

      <View style={styles.grid}>
        {grid.map((e) => (
          <EmergencyTile key={e.id} emergency={e} onPress={() => open(e)} style={styles.cell} />
        ))}
      </View>
      <EmergencyTile emergency={last} onPress={() => open(last)} compact />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: space[1] },
  call: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  cell: { width: '48%', flexGrow: 1 },
});
