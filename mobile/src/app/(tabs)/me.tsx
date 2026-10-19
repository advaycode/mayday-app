import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DEMO_MODE } from '@/config';
import { useDeviceInsets } from '@/design/insets';
import { stepImages } from '@/design/stepImages';
import { Text } from '@/design/Text';
import { color, font, radius, space } from '@/design/tokens';
import { protocols } from '@/protocols';
import { setSettings, useSettings, type MedicalId } from '@/settings/store';

const FIELDS: { key: keyof MedicalId; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Name', placeholder: 'Your name' },
  { key: 'born', label: 'Born', placeholder: 'Year' },
  { key: 'conditions', label: 'Conditions', placeholder: 'Asthma, diabetes, heart' },
  { key: 'medications', label: 'Medications', placeholder: 'What you take daily' },
  { key: 'allergies', label: 'Allergies', placeholder: 'Penicillin, peanuts' },
  { key: 'contact', label: 'Emergency contact', placeholder: 'Name and number' },
];

/**
 * Medical ID (optional, stays on this phone) and the few settings that
 * matter. The disclaimer lives here in full; the home screen shows it once.
 */
export default function Me() {
  const insets = useDeviceInsets();
  const settings = useSettings();
  const stepCount = Object.values(protocols).reduce((n, p) => n + p.steps.length, 0);
  const verified = Object.values(protocols).reduce((n, p) => n + p.steps.filter((s) => s.verified).length, 0);

  const setMedical = (key: keyof MedicalId, value: string) => setSettings({ medical: { ...settings.medical, [key]: value } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space[3], paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
      <Text variant="display" style={styles.heading} accessibilityRole="header">
        Medical ID
      </Text>
      <Text variant="body" tone="muted" style={styles.lede}>
        Stays on this phone.
      </Text>

      <View style={styles.group}>
        {FIELDS.map((f, i) => (
          <View key={f.key} style={[styles.field, i > 0 && styles.divider]}>
            <Text variant="caption" tone="muted">
              {f.label}
            </Text>
            <TextInput
              value={settings.medical[f.key]}
              onChangeText={(v) => setMedical(f.key, v)}
              placeholder={f.placeholder}
              placeholderTextColor={color.inkFaint}
              style={styles.input}
              accessibilityLabel={f.label}
              autoCorrect={false}
            />
          </View>
        ))}
      </View>

      <Text variant="title" style={styles.section}>
        Settings
      </Text>
      <View style={styles.group}>
        <Toggle label="Spoken coaching" value={settings.voice} onChange={(v) => setSettings({ voice: v })} />
        <Toggle label="Vibration" value={settings.haptics} onChange={(v) => setSettings({ haptics: v })} divider />
      </View>

      {DEMO_MODE && (
        <View style={styles.demo}>
          <Text variant="bodyStrong" style={{ color: color.void }}>
            Demo. Calls are simulated.
          </Text>
        </View>
      )}

      <Text variant="title" style={styles.section}>
        About
      </Text>
      <View style={[styles.group, { padding: space[4], gap: space[2] }]}>
        <Text variant="body">Guides you until help arrives. Always call 911.</Text>
        <Text variant="caption" tone="faint">
          {verified} of {stepCount} steps quoted from their source.
        </Text>
      </View>
      <Credits />
    </ScrollView>
  );
}

/** Step pictures are from Wikimedia Commons; their licenses ask for credit, here and in docs/IMAGE_CREDITS.md. */
function Credits() {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.group, { marginTop: space[3] }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ padding: space[4] }}>
        <Text variant="bodyStrong">Photo credits</Text>
      </Pressable>
      {open &&
        Object.values(stepImages).map(({ credit }) => (
          <Pressable key={credit.visual} onPress={() => Linking.openURL(credit.source)} accessibilityRole="link" style={[styles.credit, styles.divider]}>
            <Text variant="caption">{credit.author}</Text>
            <Text variant="caption" tone="faint">
              {credit.license}
              {credit.license.startsWith('CC') ? ', recolored' : ''}  ·  Wikimedia Commons
            </Text>
          </Pressable>
        ))}
    </View>
  );
}

function Toggle({ label, value, onChange, divider }: { label: string; value: boolean; onChange: (v: boolean) => void; divider?: boolean }) {
  return (
    <View style={[styles.toggle, divider && styles.divider]}>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color.ink, false: color.hairlineStrong }}
        thumbColor={value ? color.void : color.inkMuted}
        // react-native-web's own prop for the "on" thumb (otherwise a default teal).
        {...({ activeThumbColor: color.void } as object)}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  credit: { paddingHorizontal: space[4], paddingVertical: space[2] },
  screen: { flex: 1, backgroundColor: color.canvas },
  heading: { paddingHorizontal: space[6] },
  lede: { paddingHorizontal: space[6], marginTop: space[1], marginBottom: space[5] },
  group: { marginHorizontal: space[4], backgroundColor: color.raised, borderRadius: radius.lg },
  field: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  input: { fontFamily: font.regular, fontSize: 17, color: color.ink, paddingVertical: space[1], minHeight: 32 },
  section: { paddingHorizontal: space[6], marginTop: space[8], marginBottom: space[3] },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], height: 56 },
  demo: { marginHorizontal: space[4], marginTop: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: color.accent, gap: space[1] },
});
