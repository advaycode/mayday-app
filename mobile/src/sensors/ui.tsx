import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Text } from '@/design/Text';
import { color, font, radius, space, tint } from '@/design/tokens';

import type { BreathReading, Reading } from './analyze';
import type { HeartReading } from './heart';
import type { Level } from './useMonitor';

/** Level green, as on the iPhone's Level when the circles meet. */
export const LEVEL = tint.overdose.hue;
const LEVEL_DEEP = tint.overdose.deep;
/** How much the moving circle is magnified: pixels per degree. */
const MAGNIFY = 40;
/** Inside this, both ways, counts as level. */
const LEVEL_DEG = 0.1;

const signed = (v: number, digits = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}°`;

/**
 * Two circles, like the iPhone's Level lying flat: one fixed, one that moves
 * with the tilt. Here the movement is magnified 40 times, so a breath of one
 * degree moves it 40 points. When they meet, the dial turns green.
 */
export function LevelDial({ level, size = 248, active }: { level: Level | null; size?: number; active: boolean }) {
  const c = size / 2;
  const r = size * 0.3;
  const p = level?.ref ? level.relPitch : 0;
  const q = level?.ref ? level.relRoll : 0;
  const lim = c - r - 4;
  const dx = Math.max(-lim, Math.min(lim, q * MAGNIFY));
  const dy = Math.max(-lim, Math.min(lim, -p * MAGNIFY));
  const isLevel = !!level?.ref && Math.abs(p) < LEVEL_DEG && Math.abs(q) < LEVEL_DEG;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={level?.ref ? `Tilt ${p.toFixed(2)} degrees` : 'Level'}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={c - 1} fill={isLevel ? LEVEL_DEEP : color.sunken} stroke={isLevel ? LEVEL : color.hairlineStrong} strokeWidth={1.5} />
        {/* Crosshair, outside the circles so it never runs through the number. */}
        <Line x1={c} y1={6} x2={c} y2={c - r - 6} stroke={color.hairlineStrong} strokeWidth={1} />
        <Line x1={c} y1={c + r + 6} x2={c} y2={size - 6} stroke={color.hairlineStrong} strokeWidth={1} />
        <Line x1={6} y1={c} x2={c - r - 6} y2={c} stroke={color.hairlineStrong} strokeWidth={1} />
        <Line x1={c + r + 6} y1={c} x2={size - 6} y2={c} stroke={color.hairlineStrong} strokeWidth={1} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={isLevel ? LEVEL : color.inkMuted} strokeWidth={2} />
        <G opacity={active ? 1 : 0.4}>
          <Circle cx={c + dx} cy={c + dy} r={r} fill={isLevel ? LEVEL : 'rgba(242,239,232,0.10)'} fillOpacity={isLevel ? 0.28 : 1} stroke={isLevel ? LEVEL : color.ink} strokeWidth={2} />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.dialText]} pointerEvents="none">
        <Text style={[styles.degrees, { color: isLevel ? LEVEL : color.ink }]} tabular>
          {level?.ref ? signed(p) : level ? `${Math.abs(level.pitch).toFixed(1)}°` : '—'}
        </Text>
        <Text variant="mono" tone="muted" tabular>
          {level?.ref ? `side ${signed(q)}` : 'resting angle'}
        </Text>
      </View>
    </View>
  );
}

/** The breathing tilt over the last seconds, with each breath's peak marked. */
export function TiltTrace({ reading, width, height = 112, accent, window }: { reading: Reading | null; width: number; height?: number; accent: string; window: number }) {
  const tr = reading?.trace;
  const pad = 6;
  const peak = tr && tr.deg.length ? Math.max(...tr.deg.map(Math.abs)) : 0;
  const thr = reading?.breath.thresholdDeg ?? 0.05;
  const scale = Math.max(0.25, peak * 1.25, thr * 2);
  const x = (t: number) => pad + ((t + window) / window) * (width - 2 * pad);
  const y = (d: number) => height / 2 - (d / scale) * (height / 2 - pad);
  let d = '';
  if (tr) tr.t.forEach((t, i) => (d += `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(tr.deg[i]).toFixed(1)}`));
  const peaks = reading?.breath.peaks ?? [];
  return (
    <View>
      <Svg width={width} height={height}>
        <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={radius.md} fill={color.sunken} stroke={color.hairline} />
        <Line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke={color.hairline} />
        {/* The smallest tilt that counts as a breath: anything inside the band is noise. */}
        <Rect x={pad} width={width - 2 * pad} y={y(thr / 2)} height={Math.max(1, y(-thr / 2) - y(thr / 2))} fill="rgba(242,239,232,0.05)" />
        {d ? <Path d={d} stroke={accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {tr &&
          peaks.map((t, i) => {
            const k = tr.t.findIndex((v) => v >= t);
            return k >= 0 ? <Circle key={i} cx={x(t)} cy={y(tr.deg[k])} r={4} fill={accent} /> : null;
          })}
      </Svg>
      <View style={styles.traceLabels} pointerEvents="none">
        <Text variant="mono" tone="faint">
          ±{scale.toFixed(2)}°
        </Text>
        <Text variant="mono" tone="faint">
          {Math.round(window)} s
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statRow}>
        <Text style={styles.statValue} tabular numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const RHYTHM: Record<BreathReading['status'], string> = {
  unknown: '—',
  moving: 'moving',
  none: 'none',
  irregular: 'gasps',
  seesaw: 'see-saw',
  regular: 'steady',
};

export function BreathStats({ breath, lab }: { breath: BreathReading | null; lab?: boolean }) {
  const b = breath;
  return (
    <View style={styles.stats}>
      <Stat label="Breaths" value={b?.perMin ? `${Math.round(b.perMin)}` : '—'} unit="a minute" />
      <Stat label="Tilt per breath" value={b?.depthDeg ? `${b.depthDeg.toFixed(2)}°` : '—'} unit={b?.depthMm ? `≈${b.depthMm.toFixed(1)} mm` : undefined} />
      <Stat label="Rhythm" value={b ? RHYTHM[b.status] : '—'} />
      {lab && <Stat label="Chest & belly" value={b?.sync == null ? '—' : Math.abs(b.sync) < 0.3 ? 'see-saw' : 'together'} />}
    </View>
  );
}

/**
 * EXPERIMENTAL heartbeat: rate, how sure, and each beat-to-beat interval as
 * a bar, so you can see the rhythm speed up as you breathe in.
 */
export function HeartPanel({ heart, width }: { heart: HeartReading | null; width: number }) {
  const h = heart;
  const bars = (h?.intervalsMs ?? []).slice(-14);
  const maxMs = Math.max(1200, ...bars);
  const bw = bars.length ? (width - 2 * space[4]) / 14 : 0;
  const label = !h ? 'Waiting' : h.status === 'moving' ? 'Hold still' : h.status === 'slow-sensor' ? 'Sensor too slow' : h.status === 'found' ? `${Math.round(h.perMin!)}` : 'Not found';
  return (
    <View style={styles.heart}>
      <View style={styles.heartHead}>
        <Text variant="caption" tone="muted">
          Heartbeat · experimental
        </Text>
        <Text variant="mono" tone="faint">
          sure {Math.round((h?.confidence ?? 0) * 100)}%
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <Text style={styles.heartValue} tabular>
          {label}
        </Text>
        {h?.status === 'found' && (
          <Text variant="caption" tone="muted">
            /min{h.rmssdMs ? ` · varies ${Math.round(h.rmssdMs)} ms` : ''}
          </Text>
        )}
      </View>
      <Svg width={width - 2 * space[4]} height={44}>
        {bars.map((ms, i) => {
          const hgt = (ms / maxMs) * 40;
          return <Rect key={i} x={i * bw + 1} y={44 - hgt} width={Math.max(2, bw - 3)} height={hgt} rx={2} fill={h?.status === 'found' ? tint.cpr.hue : color.inkFaint} />;
        })}
      </Svg>
      <Text variant="caption" tone="faint">
        Each bar is one beat-to-beat interval. Not a pulse check: never use it to decide on CPR.
      </Text>
    </View>
  );
}

/** Side view: a person lying down, the phone along the torso, top end on the chest. */
export function Placement({ width, accent }: { width: number; accent: string }) {
  const h = width * 0.42;
  const s = width / 320;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 134" accessibilityLabel="Phone lying on the chest, top end on the chest, bottom end on the belly">
      {/* The floor. */}
      <Line x1={8} x2={312} y1={118} y2={118} stroke={color.hairlineStrong} strokeWidth={2 / s} />
      {/* Head, chest, belly, legs: one outline, lying on the floor. */}
      <Circle cx={30} cy={96} r={20} fill="none" stroke={color.inkMuted} strokeWidth={2.5} />
      <Path d="M54 116 L 54 96 C 60 76, 80 64, 100 63 C 130 62, 150 66, 170 69 C 190 71, 205 72, 214 73 C 235 75, 250 82, 262 88 L 306 98 L 306 116 Z" fill="none" stroke={color.inkMuted} strokeWidth={2.5} strokeLinejoin="round" />
      {/* The phone, resting on the chest and the belly. */}
      <Line x1={100} y1={58.5} x2={214} y2={68.5} stroke={accent} strokeWidth={9} strokeLinecap="round" />
      {/* Which way the ends move: the belly more than the chest. */}
      <Path d="M102 44 l0 -12 m-5 5 l5 -5 l5 5" stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M212 56 l0 -24 m-5 5 l5 -5 l5 5" stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dialText: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  degrees: { fontFamily: font.monoMedium, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  traceLabels: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', padding: space[2] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignSelf: 'stretch' },
  stat: { flexGrow: 1, flexBasis: '46%', backgroundColor: color.sunken, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, paddingHorizontal: space[3], paddingVertical: space[2], gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  statValue: { fontFamily: font.monoMedium, fontSize: 20, lineHeight: 26, color: color.ink },
  heart: { backgroundColor: color.sunken, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, padding: space[4], gap: space[2] },
  heartHead: { flexDirection: 'row', justifyContent: 'space-between' },
  heartValue: { fontFamily: font.monoMedium, fontSize: 28, lineHeight: 34, color: color.ink },
});
