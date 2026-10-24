import { useFocusEffect } from 'expo-router';
import { CaretDown, Check, Globe, MapPin, Minus, NavigationArrow, Plus } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/design/Button';
import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Sheet } from '@/design/Sheet';
import { Text } from '@/design/Text';
import { color, font, radius, space } from '@/design/tokens';
import { describe, distanceText, driveMinutes, miles, navigate, nearest, type Facility } from '@/facilities/nearest';
import { TileMap } from '@/facilities/TileMap';
import { getFix } from '@/location/location';
import { km, type Region } from '@/region/regions';
import { chooseRegion, REGIONS, useRegion } from '@/region/store';
import { useSettings } from '@/settings/store';

/**
 * Nearest emergency care, for the region in use (src/region/regions.ts).
 * Kinds of place are never mixed up: in Florida an ER (CMS), a trauma
 * center with its level (Florida DOH) and urgent care ("not for
 * emergencies"); in Lagos, where no official list exists, a hospital with a
 * confirmed emergency department, a public general or teaching hospital, a
 * clinic whose emergency care is not confirmed, or a health centre.
 *
 * The chip at the top switches region. Somewhere help is far away, the map
 * first says why Mayday matters there, with the sources.
 */
export default function MapScreen() {
  const insets = useDeviceInsets();
  const region = useRegion();
  const chosen = useSettings().region;
  const [user, setUser] = useState<{ lat: number; lon: number; demo: boolean } | null>(null);
  const [center, setCenter] = useState(region.center);
  const [zoom, setZoom] = useState(region.zoom);
  const [filter, setFilter] = useState(region.filters[0].id);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [picker, setPicker] = useState(false);
  const [why, setWhy] = useState(false);

  // A new region: its own map, tabs and, where it has one, the reason it matters.
  useEffect(() => {
    setCenter(region.center);
    setZoom(region.zoom);
    setFilter(region.filters[0].id);
    setSelected(null);
    setWhy(!!region.why);
  }, [region]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getFix().then((fix) => {
        if (!alive || !fix) return;
        const inRegion = km(fix, region.center) < 150;
        const here = inRegion ? { lat: fix.lat, lon: fix.lon, demo: fix.source === 'demo' } : { ...region.demo, demo: true };
        setUser(here);
        setCenter(here);
      });
      return () => {
        alive = false;
      };
    }, [region]),
  );

  const tab = region.filters.find((f) => f.id === filter) ?? region.filters[0];
  const from = user ?? center;
  const shown = useMemo(() => region.facilities.filter((f) => tab.kinds.includes(f.kind)), [region, tab]);
  const closest = useMemo(() => nearest(from, tab.kinds, 1, region.facilities)[0], [from.lat, from.lon, region, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const focus = selected && tab.kinds.includes(selected.kind) ? selected : closest?.f;
  const d = focus ? miles(from, focus) : 0;

  return (
    <View style={styles.screen}>
      <TileMap
        center={center}
        zoom={zoom}
        onCenterChange={setCenter}
        facilities={shown}
        user={user}
        selectedId={focus?.id}
        onSelect={(f) => {
          haptic('navigate');
          setWhy(false);
          setSelected(f);
        }}
      />

      <View style={[styles.top, { top: insets.top + space[2] }]} pointerEvents="box-none">
        <View style={{ gap: space[2], flexShrink: 1 }}>
          <Pressable
            onPress={() => {
              haptic('navigate');
              setPicker(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Region: ${region.name}. Tap to change.`}
            style={{ alignSelf: 'flex-start' }}>
            <Glass radius={radius.pill}>
              <View style={styles.regionChip}>
                <Globe size={16} color={color.ink} />
                <Text variant="bodyStrong">{region.name}</Text>
                <CaretDown size={13} color={color.inkMuted} weight="bold" />
              </View>
            </Glass>
          </Pressable>
          <Glass radius={radius.pill} style={{ alignSelf: 'flex-start' }}>
            <View style={styles.filters}>
              {region.filters.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    haptic('navigate');
                    setFilter(f.id);
                    setSelected(null);
                    setWhy(false);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab.id === f.id }}
                  style={[styles.filter, tab.id === f.id && styles.filterOn]}>
                  <Text variant="bodyStrong" tone={tab.id === f.id ? 'ink' : 'muted'} numberOfLines={1}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Glass>
        </View>
        <View style={styles.zoomCol}>
          <ZoomButton icon={Plus} label="Zoom in" onPress={() => setZoom((z) => Math.min(16, z + 1))} />
          <ZoomButton icon={Minus} label="Zoom out" onPress={() => setZoom((z) => Math.max(6, z - 1))} />
        </View>
      </View>

      <View style={[styles.cardWrap, { bottom: insets.bottom + 92 }]}>
        {why && region.why ? (
          <WhyCard region={region} onShow={() => setWhy(false)} />
        ) : (
          focus && (
            <Glass radius={radius.lg + 6} variant="thick">
              <View style={styles.card}>
                <Text variant="caption" tone="muted">
                  {focus === closest?.f ? 'Nearest' : 'Selected'}  ·  {distanceText(d, region.units)}
                  {region.driveEstimate ? `  ·  about ${driveMinutes(d)} min` : ''}
                  {user?.demo ? '  ·  from a demo location' : ''}
                </Text>
                <Text variant="title" numberOfLines={2}>
                  {focus.name}
                </Text>
                <Text variant="body" tone={focus.kind === 'urgent' || focus.kind === 'phc' ? 'ink' : 'muted'}>
                  {describe(focus)}
                  {focus.pediatric && focus.kind !== 'urgent' && !focus.traumaLevel?.includes('ediatric') ? '  Children' : ''}
                </Text>
                {/* Mayday never dials anyone; numbers are shown so the person can call them. */}
                {focus.phone ? (
                  <Text variant="body" tone="muted" tabular>
                    {focus.phone}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Button label="Directions" icon={NavigationArrow} onPress={() => navigate(focus)} style={{ flex: 1 }} />
                  {region.why ? <Button label="Why here" onPress={() => setWhy(true)} /> : null}
                </View>
              </View>
            </Glass>
          )
        )}
      </View>

      <Sheet open={picker} onClose={() => setPicker(false)} above={84}>
        <Text variant="title">Region</Text>
        <Text variant="caption" tone="muted">
          Its emergency number, its hospitals, and what the voice says to call. Mayday never dials.
        </Text>
        <RegionRow label="Automatic" detail="From this phone's location" on={chosen === null} onPress={() => pick(null)} />
        {REGIONS.map((r) => (
          <RegionRow
            key={r.id}
            label={r.name}
            detail={`Call ${r.number}${r.alsoCall ? ` or ${r.alsoCall}` : ''}  ·  ${r.facilities.length} places (${r.facilitySource})`}
            badge={r.why ? 'Where Mayday helps most' : null}
            on={chosen === r.id}
            onPress={() => pick(r.id)}
          />
        ))}
      </Sheet>
    </View>
  );

  function pick(id: Region['id'] | null) {
    haptic('navigate');
    chooseRegion(id);
    setPicker(false);
  }
}

/** Why Mayday matters here: three numbers, each with its source. */
function WhyCard({ region, onShow }: { region: Region; onShow: () => void }) {
  const why = region.why!;
  return (
    <Glass radius={radius.lg + 6} variant="thick">
      <View style={styles.card}>
        <View style={styles.whyHead}>
          <MapPin size={16} color={color.signal} weight="fill" />
          <Text variant="caption" tone="muted">
            {region.name}  ·  call {region.number}
          </Text>
        </View>
        <Text variant="title">{why.headline}</Text>
        <View style={styles.stats}>
          {why.stats.map((s) => (
            <Pressable
              key={s.big}
              onPress={() => Linking.openURL(s.source.url)}
              accessibilityRole="link"
              accessibilityLabel={`${s.big} ${s.text}. Source: ${s.source.title}`}
              style={({ pressed }) => [styles.stat, pressed && { opacity: 0.75 }]}>
              <Text style={styles.statBig}>{s.big}</Text>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {s.text}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text variant="body" tone="muted">
          {why.body}
        </Text>
        <Text variant="caption" tone="faint">
          Tap a number for its source.
        </Text>
        <Button label="Show hospitals" kind="primary" onPress={onShow} />
      </View>
    </Glass>
  );
}

function RegionRow({ label, detail, badge, on, onPress }: { label: string; detail: string; badge?: string | null; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
        {badge ? (
          <Text variant="caption" style={{ color: color.accent }}>
            {badge}
          </Text>
        ) : null}
      </View>
      {on ? <Check size={20} color={color.ink} weight="bold" /> : null}
    </Pressable>
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
  top: { position: 'absolute', left: space[4], right: space[4], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] },
  regionChip: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: 40, paddingHorizontal: space[4] },
  filters: { flexDirection: 'row', padding: space[1] },
  filter: { height: 40, paddingHorizontal: space[3], borderRadius: radius.pill, justifyContent: 'center' },
  filterOn: { backgroundColor: 'rgba(242,239,232,0.12)' },
  zoomCol: { gap: space[2] },
  cardWrap: { position: 'absolute', left: space[3], right: space[3] },
  card: { padding: space[5], gap: space[2] },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[2] },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stats: { gap: space[2], marginVertical: space[1] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space[3], backgroundColor: color.sunken, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairlineStrong, paddingHorizontal: space[3], paddingVertical: space[2] },
  statBig: { width: 64, fontFamily: font.semibold, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline },
  rowOn: { borderColor: color.hairlineStrong, backgroundColor: 'rgba(242,239,232,0.06)' },
});
