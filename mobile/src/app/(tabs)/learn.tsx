import { router } from 'expo-router';
import { Baby, Brain, CaretRight, Drop, Fire, Heartbeat, Person, Pill, Wind } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Orb } from '@/design/Orb';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { libraryOrder, protocols } from '@/protocols';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'light' }>;
const ICON: Record<string, IconType> = { heartbeat: Heartbeat, baby: Baby, wind: Wind, drop: Drop, fire: Fire, brain: Brain, pill: Pill, person: Person };
const AGE: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Baby', any: '' };

/** Practice, then every protocol the app can coach, each one readable with its sources. */
export default function Learn() {
  const insets = useDeviceInsets();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space[3], paddingBottom: insets.bottom + 120 }}>
      <Text variant="display" style={styles.heading} accessibilityRole="header">
        Learn
      </Text>

      <Pressable
        onPress={() => {
          haptic('navigate');
          router.push('/practice');
        }}
        accessibilityRole="button"
        accessibilityLabel="Practice compressions"
        style={({ pressed }) => [styles.practiceWrap, pressed && { transform: [{ scale: 0.985 }] }]}>
        <Glass radius={radius.lg + 6} interactive>
          <View style={styles.practice}>
            <Orb size={72} />
            <View style={{ flex: 1 }}>
              <Text variant="title">Practice CPR</Text>
              <Text variant="body" tone="muted">
                Find the beat. Two minutes.
              </Text>
            </View>
            <CaretRight size={20} color={color.inkMuted} />
          </View>
        </Glass>
      </Pressable>

      <View style={styles.list}>
        {libraryOrder.map((id, i) => {
          const p = protocols[id];
          const Icon = ICON[p.icon] ?? Heartbeat;
          const age = p.appliesTo ? 'Adult, child' : AGE[p.ageGroup];
          return (
            <Pressable
              key={id}
              onPress={() => {
                haptic('navigate');
                router.push({ pathname: '/protocol/[id]', params: { id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${p.id.startsWith('cpr') || p.id.startsWith('choking') ? p.short : p.title}${age ? `, ${age}` : ''}`}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
              <Icon size={24} color={color.ink} weight="light" />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {p.id.startsWith('cpr') || p.id.startsWith('choking') ? p.short : p.title}
              </Text>
              {age ? (
                <Text variant="caption" tone="muted">
                  {age}
                </Text>
              ) : null}
              <CaretRight size={16} color={color.inkFaint} />
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" tone="faint" style={styles.footer}>
        Every step cites the 2025 American Heart Association guidelines, the American Red Cross, or the source named on it.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  heading: { paddingHorizontal: space[6], marginBottom: space[5] },
  practiceWrap: { marginHorizontal: space[4] },
  practice: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4] },
  list: { marginTop: space[8], marginHorizontal: space[6] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4], height: 60 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  footer: { marginHorizontal: space[6], marginTop: space[8], lineHeight: 18 },
});
