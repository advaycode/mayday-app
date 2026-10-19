import { useFocusEffect } from 'expo-router';
import { Minus, NavigationArrow, Phone, Plus } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { DEMO_MODE } from '@/config';
import { Button } from '@/design/Button';
import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { describe, driveMinutes, ER_KINDS, facilities, miles, navigate, nearest, type Facility } from '@/facilities/nearest';
import { TileMap } from '@/facilities/TileMap';
import { getFix } from '@/location/location';

type Filter = 'er' | 'trauma' | 'urgent';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'er', label: 'ER' },
  { id: 'trauma', label: 'Trauma' },
  { id: 'urgent', label: 'Urgent care' },
];

/**
 * Nearest emergency care. Three kinds of place, never mixed up:
 *   ER            has an emergency department (CMS)
 *   Trauma        state-designated trauma center, with its level (Florida DOH)
 *   Urgent care   shown, but labelled "not for emergencies"
 */
export default function MapScreen() {
  const insets = useDeviceInsets();
  const [user, setUser] = useState<{ lat: number; lon: number } | null>(null);
  const [center, setCenter] = useState({ lat: 28.1866, lon: -82.3473 });
  const [zoom, setZoom] = useState(11);
  const [filter, setFilter] = useState<Filter>('er');
  const [selected, setSelected] = useState<Facility | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getFix().then((fix) => {
        if (!alive || !fix) return;
        const here = { lat: fix.lat, lon: fix.lon };
        setUser(here);
        setCenter(here);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const from = user ?? center;
  const kinds: Facility['kind'][] = filter === 'er' ? ER_KINDS : [filter];
  const shown = useMemo(() => facilities.filter((f) => kinds.includes(f.kind)), [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const closest = useMemo(() => nearest(from, kinds, 1)[0], [from.lat, from.lon, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const focus = selected && kinds.includes(selected.kind) ? selected : closest?.f;
  const d = focus ? miles(from, focus) : 0;

  return (
    <View style={styles.screen}>
      <TileMap center={center} zoom={zoom} onCenterChange={setCenter} facilities={shown} user={user} selectedId={focus?.id} onSelect={(f) => { haptic('navigate'); setSelected(f); }} />

      <View style={[styles.top, { top: insets.top + space[2] }]} pointerEvents="box-none">
        <Glass radius={radius.pill}>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  haptic('navigate');
                  setFilter(f.id);
                  setSelected(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === f.id }}
                style={[styles.filter, filter === f.id && styles.filterOn]}>
                <Text variant="bodyStrong" tone={filter === f.id ? 'ink' : 'muted'}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Glass>
        <View style={styles.zoomCol}>
          <ZoomButton icon={Plus} label="Zoom in" onPress={() => setZoom((z) => Math.min(16, z + 1))} />
          <ZoomButton icon={Minus} label="Zoom out" onPress={() => setZoom((z) => Math.max(6, z - 1))} />
        </View>
      </View>

      {focus && (
        <View style={[styles.cardWrap, { bottom: insets.bottom + 92 }]}>
          <Glass radius={radius.lg + 6} variant="thick">
            <View style={styles.card}>
              <Text variant="caption" tone={focus.kind === 'urgent' ? 'muted' : 'muted'}>
                {focus === closest?.f ? 'Nearest' : 'Selected'}  ·  {d.toFixed(1)} mi  ·  about {driveMinutes(d)} min
              </Text>
              <Text variant="title" numberOfLines={2}>
                {focus.name}
              </Text>
              <Text variant="body" tone={focus.kind === 'urgent' ? 'ink' : 'muted'}>
                {describe(focus)}
                {focus.pediatric && focus.kind !== 'urgent' && !focus.traumaLevel?.includes('ediatric') ? '  Children' : ''}
              </Text>
              {DEMO_MODE && focus.phone ? (
                <Text variant="body" tone="muted" tabular>
                  {focus.phone}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Button label="Directions" icon={NavigationArrow} onPress={() => navigate(focus)} style={{ flex: 1 }} />
                {/* Demo builds never dial anyone real: the number is shown above, not called. */}
                {focus.phone && !DEMO_MODE ? (
                  <Button label="Call" icon={Phone} onPress={() => Linking.openURL(`tel:${focus.phone}`)} style={{ flex: 1 }} />
                ) : null}
              </View>
            </View>
          </Glass>
        </View>
      )}
    </View>
  );
}

function ZoomButton({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Glass radius={radius.pill} style={{ width: 44, height: 44 }}>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color.ink} />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.sunken },
  top: { position: 'absolute', left: space[4], right: space[4], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  filters: { flexDirection: 'row', padding: space[1] },
  filter: { height: 40, paddingHorizontal: space[4], borderRadius: radius.pill, justifyContent: 'center' },
  filterOn: { backgroundColor: 'rgba(242,239,232,0.12)' },
  zoomCol: { gap: space[2] },
  cardWrap: { position: 'absolute', left: space[3], right: space[3] },
  card: { padding: space[5], gap: space[2] },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[2] },
});
