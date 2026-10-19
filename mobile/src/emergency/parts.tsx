import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { ListBullets, Phone, PhoneCall } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { DEMO_MODE } from '@/config';
import { Glass } from '@/design/Glass';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { elapsed } from '@/incident/log';

import type { IncidentState } from './useIncident';

/** Pinned to every emergency screen while DEMO_MODE is on. Impossible to miss, impossible to confuse with red. */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <View style={styles.demo} accessibilityRole="alert" accessibilityLabel="Mayday never calls 911. Call it yourself.">
      <Text variant="caption" style={{ color: color.void }}>
        Mayday never calls 911.
      </Text>
    </View>
  );
}

/** The practice-call countdown: a red arc that empties over five seconds. Nothing is dialed. */
export function CountdownRing({ size, remaining, children }: { size: number; remaining: SharedValue<number>; children?: ReactNode }) {
  const r = size / 2 - 6;
  const path = Skia.Path.Circle(size / 2, size / 2, r);
  const end = useDerivedValue(() => remaining.value);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} style="stroke" strokeWidth={6} color={color.hairline} />
        <Path
          path={path}
          style="stroke"
          strokeWidth={6}
          strokeCap="round"
          color={color.signal}
          start={0}
          end={end}
          transform={[{ rotate: -Math.PI / 2 }]}
          origin={{ x: size / 2, y: size / 2 }}
        />
      </Canvas>
      {children}
    </View>
  );
}

/** A beat you can see: a ring that swells on every compression. */
export function PulseRing({ size, pulse }: { size: number; pulse: SharedValue<number> }) {
  const r = useDerivedValue(() => size / 2 - 14 + pulse.value * 10);
  const opacity = useDerivedValue(() => 0.25 + pulse.value * 0.6);
  return (
    <Canvas style={{ position: 'absolute', width: size, height: size }} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 14} style="stroke" strokeWidth={2} color={color.hairline} />
      <Circle cx={size / 2} cy={size / 2} r={r} style="stroke" strokeWidth={4} color={color.ink} opacity={opacity} />
    </Canvas>
  );
}

/** Compact call status for the top bar once a protocol is running. Tap for the dispatcher card. */
export function CallPill({ call, now, onPress }: { call: IncidentState['call']; now: number; onPress: () => void }) {
  let label: string;
  let red = false;
  if (call.status === 'countdown') {
    label = `Practice call in ${Math.max(0, Math.ceil((call.endsAt - now) / 1000))}`;
    red = true;
  } else if (call.status === 'calling') {
    label = `Practice  ${elapsed(now - (call.placedAt ?? now))}`;
    red = true;
  } else if (call.status === 'delegated') {
    label = 'Someone is calling 911';
  } else {
    label = 'Practice call';
    red = true;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Opens what to tell the dispatcher.`}
      style={({ pressed }) => [styles.pill, { backgroundColor: red ? color.signal : 'rgba(242,239,232,0.08)' }, pressed && { opacity: 0.85 }]}>
      {call.status === 'calling' ? <PhoneCall size={18} color={color.onSignal} weight="fill" /> : <Phone size={18} color={red ? color.onSignal : color.ink} weight="fill" />}
      <Text variant="bodyStrong" tabular style={{ color: red ? color.onSignal : color.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TopBar({ left, onLog }: { left: ReactNode; onLog: () => void }) {
  return (
    <View style={styles.top}>
      <View style={{ flexShrink: 1 }}>{left}</View>
      <Pressable onPress={onLog} accessibilityRole="button" accessibilityLabel="Incident log for paramedics" hitSlop={8}>
        <Glass radius={radius.pill} style={styles.round}>
          <View style={styles.roundInner}>
            <ListBullets size={22} color={color.ink} />
          </View>
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  demo: {
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  pill: {
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
  },
  top: {
    height: 60,
    paddingHorizontal: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  round: { width: 44, height: 44 },
  roundInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
