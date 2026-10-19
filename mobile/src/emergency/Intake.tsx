import { DotsThree, Drop, Heartbeat, Phone, Wind } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Button } from '@/design/Button';
import { Orb } from '@/design/Orb';
import { Text } from '@/design/Text';
import { color, space } from '@/design/tokens';
import { elapsed } from '@/incident/log';
import type { ProtocolId } from '@/voice/routerSchema';

import { CountdownRing } from './parts';
import type { Incident } from './useIncident';

type Props = {
  incident: Incident;
  now: number;
  remaining: SharedValue<number>;
  level: SharedValue<number>;
  listening: boolean;
  onMore: () => void;
};

/**
 * The first screen of an emergency. Three jobs at once, top to bottom:
 *   1. 911 is being called (5-second ring, cancel, or "someone else is calling")
 *   2. we are listening: say what is happening
 *   3. or tap it: the three most common life threats, and everything else
 */
export function Intake({ incident, now, remaining, level, listening, onMore }: Props) {
  const { state, cancelCall, delegateCall, call, startProtocol } = incident;
  const { status } = state.call;
  const secondsLeft = Math.max(0, Math.ceil((state.call.endsAt - now) / 1000));
  const age = incident.slots.age_group;
  const cpr: ProtocolId = age === 'infant' ? 'cpr_infant' : age === 'child' ? 'cpr_child' : 'cpr_adult';
  const choking: ProtocolId = age === 'infant' ? 'choking_infant' : 'choking';

  const heard = state.heard?.text;

  return (
    <View style={styles.wrap}>
      <View style={styles.callBlock}>
        <CountdownRing size={200} remaining={remaining}>
          {status === 'countdown' && (
            <>
              <Text variant="bodyStrong" tone="muted">
                911
              </Text>
              <Text variant="countdown" tabular accessibilityLiveRegion="assertive" accessibilityLabel={`Calling 911 in ${secondsLeft}`}>
                {secondsLeft}
              </Text>
            </>
          )}
          {status === 'calling' && (
            <>
              <Phone size={32} color={color.ink} weight="fill" />
              <Text variant="title" style={{ marginTop: space[2] }}>
                911
              </Text>
              <Text variant="timer" tone="muted" tabular>
                {elapsed(now - (state.call.placedAt ?? now))}
              </Text>
            </>
          )}
          {(status === 'cancelled' || status === 'delegated') && (
            <Phone size={36} color={color.inkMuted} weight={status === 'delegated' ? 'fill' : 'regular'} />
          )}
        </CountdownRing>

        <View style={styles.row}>
          {status === 'countdown' ? (
            <>
              <Button label="Cancel" onPress={cancelCall} style={styles.half} />
              <Button label="Called" onPress={delegateCall} style={styles.half} accessibilityHint="Someone else is already on the phone with 911" />
            </>
          ) : status === 'calling' ? null : (
            <Button label="Call 911" kind="signal" icon={Phone} onPress={call} style={{ flex: 1 }} />
          )}
        </View>
      </View>

      <View style={styles.listen} accessibilityLiveRegion="polite">
        <Orb size={92} level={level} energy={listening ? 1 : 0} />
        {heard ? (
          <Text variant="title" numberOfLines={2} style={{ textAlign: 'center', marginTop: space[1] }}>
            {heard}
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <Button stacked size="emergency" icon={Heartbeat} label="No breath" accessibilityHint="Not breathing" onPress={() => startProtocol(cpr, { conscious: 'false', breathing: 'abnormal' })} style={styles.half} />
          <Button stacked size="emergency" icon={Wind} label="Choking" onPress={() => startProtocol(choking)} style={styles.half} />
        </View>
        <View style={styles.row}>
          <Button stacked size="emergency" icon={Drop} label="Bleeding" onPress={() => startProtocol('bleeding')} style={styles.half} />
          <Button stacked size="emergency" icon={DotsThree} label="Other" onPress={onMore} style={styles.half} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[5], justifyContent: 'space-between', paddingBottom: space[3] },
  callBlock: { alignItems: 'center', gap: space[4], paddingTop: space[2] },
  row: { flexDirection: 'row', gap: space[3], alignSelf: 'stretch' },
  half: { flex: 1 },
  listen: { alignItems: 'center', paddingHorizontal: space[2] },
  grid: { gap: space[3] },
});
