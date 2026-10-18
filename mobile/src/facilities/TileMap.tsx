import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/design/Text';
import { color } from '@/design/tokens';

import type { Facility } from './nearest';

/**
 * A small, dependency-free slippy map: dark raster tiles plus our own
 * markers. Web Mercator, 256 px tiles at 2x density. Drag to pan; the zoom
 * buttons live in the screen that hosts it.
 *
 * Tiles need a connection; the facility data underneath does not. Offline,
 * the map is blank but the nearest-ER list still works.
 */
const TILE = 256;
// Esri's dark gray canvas: a muted base, plus a transparent layer of road and
// place labels drawn on top. No API key; attribution shown on the map.
const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas';
const BASE_URL = (z: number, x: number, y: number) => `${ESRI}/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
const LABEL_URL = (z: number, x: number, y: number) => `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/${z}/${y}/${x}`;

function project(lat: number, lon: number, z: number) {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, z: number) {
  const scale = TILE * 2 ** z;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

type Props = {
  center: { lat: number; lon: number };
  zoom: number;
  onCenterChange: (c: { lat: number; lon: number }) => void;
  facilities: Facility[];
  user?: { lat: number; lon: number } | null;
  selectedId?: string | null;
  onSelect: (f: Facility) => void;
};

export function TileMap({ center, zoom, onCenterChange, facilities, user, selectedId, onSelect }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const start = useRef(center);
  const latest = useRef({ center, zoom });
  latest.current = { center, zoom };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          start.current = latest.current.center;
        },
        onPanResponderMove: (_, g) => {
          const z = latest.current.zoom;
          const p = project(start.current.lat, start.current.lon, z);
          onCenterChange(unproject(p.x - g.dx, p.y - g.dy, z));
        },
      }),
    [onCenterChange],
  );

  const c = project(center.lat, center.lon, zoom);
  const left = c.x - size.w / 2;
  const top = c.y - size.h / 2;
  const n = 2 ** zoom;

  const tiles: { key: string; x: number; y: number; base: string; labels: string }[] = [];
  if (size.w > 0) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${zoom}/${tx}/${ty}`, x: tx * TILE - left, y: ty * TILE - top, base: BASE_URL(zoom, wx, ty), labels: LABEL_URL(zoom, wx, ty) });
      }
    }
  }

  const toScreen = (lat: number, lon: number) => {
    const p = project(lat, lon, zoom);
    return { x: p.x - left, y: p.y - top };
  };

  // Draw urgent care first, then ERs, then trauma centers on top, then the selection.
  const order = { urgent: 0, er: 1, trauma: 2 } as const;
  const visible = facilities
    .map((f) => ({ f, ...toScreen(f.lat, f.lon) }))
    .filter((m) => m.x > -30 && m.y > -30 && m.x < size.w + 30 && m.y < size.h + 30)
    .sort((a, b) => order[a.f.kind] - order[b.f.kind] + (a.f.id === selectedId ? 10 : 0) - (b.f.id === selectedId ? 10 : 0));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...pan.panHandlers}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0e0e0e' }]} />
      {tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.base }}
          style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }}
          cachePolicy="memory-disk"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      ))}
      {/* Pull the gray tiles toward the app's warm graphite. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,13,12,0.38)' }]} />
      {tiles.map((t) => (
        <Image
          key={`l${t.key}`}
          source={{ uri: t.labels }}
          style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE, opacity: 0.8 }}
          cachePolicy="memory-disk"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      ))}

      {user && (() => {
        const p = toScreen(user.lat, user.lon);
        return (
          <View pointerEvents="none" style={[styles.userHalo, { left: p.x - 18, top: p.y - 18 }]}>
            <View style={styles.userDot} />
          </View>
        );
      })()}

      {visible.map(({ f, x, y }) => {
        const selected = f.id === selectedId;
        return (
          <Pressable
            key={f.id}
            onPress={() => onSelect(f)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}. ${f.kind === 'trauma' ? `Trauma center level ${f.traumaLevel}` : f.kind === 'er' ? 'Emergency room' : 'Urgent care, not for emergencies'}`}
            style={{ position: 'absolute', left: x - 14, top: y - 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            {f.kind === 'trauma' ? (
              <View style={[styles.trauma, selected && styles.selected]}>
                <Text style={styles.traumaText}>{f.traumaLevel?.startsWith('Pediatric') ? 'P' : f.traumaLevel?.split(' ')[0]}</Text>
              </View>
            ) : f.kind === 'er' ? (
              <View style={[styles.er, selected && styles.selected]} />
            ) : (
              <View style={[styles.urgent, selected && styles.selected]} />
            )}
          </Pressable>
        );
      })}

      <Text style={styles.attribution} pointerEvents="none">
        Esri, HERE, Garmin, © OpenStreetMap
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  er: { width: 13, height: 13, borderRadius: 7, backgroundColor: color.ink, borderWidth: 2, borderColor: '#0e0e0e' },
  trauma: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0e0e0e',
  },
  traumaText: { fontFamily: 'Geist_600SemiBold', fontSize: 11, lineHeight: 13, color: color.void },
  urgent: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: color.inkMuted, backgroundColor: 'transparent' },
  selected: { transform: [{ scale: 1.45 }], borderColor: color.accent },
  userHalo: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(210,190,148,0.22)', alignItems: 'center', justifyContent: 'center' },
  userDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: color.accent, borderWidth: 2, borderColor: color.void },
  attribution: { position: 'absolute', right: 8, bottom: 4, fontSize: 9, color: 'rgba(242,239,232,0.45)', fontFamily: 'Geist_400Regular' },
});
