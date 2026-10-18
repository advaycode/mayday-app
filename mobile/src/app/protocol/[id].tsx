import { router, useLocalSearchParams } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Glass } from '@/design/Glass';
import { useDeviceInsets } from '@/design/insets';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { Visual } from '@/design/Visual';
import { protocols, sources, type Step } from '@/protocols';

/**
 * Steps in the order a rescuer meets them: depth-first from the entry,
 * following the first answer (the main path) before the side branches.
 */
function ordered(id: string): Step[] {
  const p = protocols[id];
  const byId = new Map(p.steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Step[] = [];
  const visit = (sid: string) => {
    if (seen.has(sid) || !byId.has(sid)) return;
    seen.add(sid);
    const s = byId.get(sid)!;
    out.push(s);
    const next: string[] = [];
    if (s.kind === 'ask' || s.kind === 'hold' || s.kind === 'end') next.push(...s.choices.map((c) => c.next));
    if ('next' in s) next.unshift(s.next);
    if (s.kind === 'cpr') next.push(s.aedNext);
    if (s.kind === 'do') next.push(...s.alts.map((c) => c.next));
    next.filter((r) => !r.startsWith('@')).forEach(visit);
  };
  visit(p.entry);
  return [...out, ...p.steps.filter((s) => !seen.has(s.id))];
}

/**
 * Read a protocol before you need it. Every step shows where it came from;
 * tap it to read the guideline sentence itself.
 */
export default function ProtocolReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useDeviceInsets();
  const [open, setOpen] = useState<string | null>(null);
  const p = protocols[id ?? ''];
  if (!p) return null;
  const steps = ordered(p.id);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space[10] }}>
        <Text variant="display" style={styles.heading} accessibilityRole="header">
          {p.title}
        </Text>
        <Text variant="body" tone="muted" style={styles.meta}>
          {p.appliesTo ? 'Adults and children' : p.ageGroup === 'infant' ? 'Babies under 1 year' : p.ageGroup === 'child' ? 'Children, 1 year to puberty' : p.ageGroup === 'adult' ? 'Adults' : 'Any age'}
          {'  ·  '}v{p.version}
        </Text>

        {steps.map((s, i) => {
          const src = sources[s.source];
          const expanded = open === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setOpen(expanded ? null : s.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${s.text}. ${s.sub ?? ''}. Source: ${src?.publisher}. ${s.verified ? 'Quoted from the source.' : 'Awaiting medical review.'}`}
              style={[styles.step, i > 0 && styles.divider]}>
              <View style={styles.stepRow}>
                <Text variant="mono" tone="faint" style={styles.index}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text variant="bodyStrong">{s.text}</Text>
                  {s.sub ? (
                    <Text variant="body" tone="muted">
                      {s.sub}
                    </Text>
                  ) : null}
                  <Text variant="caption" tone={s.verified ? 'muted' : 'faint'} style={{ marginTop: space[1] }}>
                    {src?.publisher.replace(/ \(.*\)$/, '')}  ·  {s.verified ? 'quoted' : 'awaiting review'}
                  </Text>
                </View>
                {s.visual ? <Visual id={s.visual} size={56} /> : null}
              </View>
              {expanded && (
                <View style={styles.quote}>
                  {s.quote ? (
                    <Text variant="body" style={{ fontStyle: 'italic' }} selectable>
                      &ldquo;{s.quote}&rdquo;
                    </Text>
                  ) : null}
                  <Text variant="caption" tone="muted" selectable>
                    {src?.title}. {src?.citation}
                  </Text>
                  {s.note ? (
                    <Text variant="caption" tone="faint" selectable>
                      {s.note}
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[styles.back, { top: insets.top + space[2] }]} hitSlop={8}>
        <Glass radius={radius.pill} style={{ width: 44, height: 44 }}>
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <CaretLeft size={20} color={color.ink} />
          </View>
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  heading: { paddingHorizontal: space[6] },
  meta: { paddingHorizontal: space[6], marginTop: space[1], marginBottom: space[6] },
  step: { paddingHorizontal: space[6], paddingVertical: space[4] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  stepRow: { flexDirection: 'row', gap: space[4], alignItems: 'flex-start' },
  index: { width: 22, marginTop: 3 },
  quote: { marginTop: space[3], marginLeft: 22 + space[4], gap: space[2], paddingLeft: space[3], borderLeftWidth: 1, borderLeftColor: color.hairlineStrong },
  back: { position: 'absolute', left: space[4] },
});
