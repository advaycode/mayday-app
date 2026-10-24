import { Canvas, Circle } from '@shopify/react-native-skia';
import { CaretDown, CaretLeft, Check, Phone, SpeakerHigh, X } from 'phosphor-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { emergencyFor } from '@/design/emergencies';
import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { TalkButton } from '@/design/TalkButton';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { useRegion } from '@/region/store';

/** A beat you can see: a ring that swells on every compression. */
export function PulseRing({ size, pulse, tone = color.ink }: { size: number; pulse: SharedValue<number>; tone?: string }) {
  const r = useDerivedValue(() => size / 2 - 14 + pulse.value * 10);
  const opacity = useDerivedValue(() => 0.3 + pulse.value * 0.6);
  return (
    <Canvas style={{ position: 'absolute', width: size, height: size }} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 14} style="stroke" strokeWidth={2} color={color.hairline} />
      <Circle cx={size / 2} cy={size / 2} r={r} style="stroke" strokeWidth={5} color={tone} opacity={opacity} />
    </Canvas>
  );
}

export function RoundButton({ onPress, label, children }: { onPress: () => void; label: string; children: ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic('navigate');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}>
      <Glass radius={radius.pill} style={styles.round}>
        <View style={styles.roundInner}>{children}</View>
      </Glass>
    </Pressable>
  );
}

/**
 * Top of every emergency screen: close on the left, what is happening in the
 * middle (its color, icon and name; tap to switch), say-it-again on the right.
 */
export function TopBar({
  protocolId,
  onClose,
  onSwitch,
  onRepeat,
}: {
  protocolId: string | null;
  onClose: () => void;
  onSwitch: () => void;
  onRepeat: (() => void) | null;
}) {
  const e = emergencyFor(protocolId);
  return (
    <View style={styles.top}>
      <RoundButton onPress={onClose} label="Close">
        <X size={22} color={color.ink} />
      </RoundButton>

      <Pressable
        onPress={onSwitch}
        accessibilityRole="button"
        accessibilityLabel={protocolId ? `${e.label}. Tap to change.` : 'Choose what is happening'}
        style={({ pressed }) => [styles.chip, { backgroundColor: e.tint.deep, borderColor: `${e.tint.hue}55` }, pressed && { opacity: 0.85 }]}>
        <e.Icon size={20} color={e.tint.hue} weight="fill" />
        <Text variant="bodyStrong">{protocolId ? e.label : 'Choose'}</Text>
        <CaretDown size={14} color={color.inkMuted} weight="bold" />
      </Pressable>

      {onRepeat ? (
        <RoundButton onPress={onRepeat} label="Say it again">
          <SpeakerHigh size={22} color={color.ink} />
        </RoundButton>
      ) : (
        <View style={styles.round} />
      )}
    </View>
  );
}

/** How far through the steps, in the emergency's color. */
export function Progress({ fraction, tone }: { fraction: number; tone: string }) {
  const shown = Math.max(0.04, Math.min(1, fraction));
  const w = useSharedValue(shown);
  useEffect(() => {
    w.value = withTiming(shown, { duration: 300 });
  }, [shown, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
      <Animated.View style={[styles.fill, { backgroundColor: tone }, style]} />
    </View>
  );
}

/**
 * The bottom bar, under the thumb: Back, Talk to Mayday in the middle (the
 * biggest control), and 911, which shows what to tell the dispatcher.
 */
export function Dock({
  canBack,
  onBack,
  listening,
  level,
  onTalk,
  on911,
  bottomInset,
}: {
  canBack: boolean;
  onBack: () => void;
  listening: boolean;
  level: SharedValue<number>;
  onTalk: () => void;
  on911: () => void;
  bottomInset: number;
}) {
  // The region's number (911, 112): shown, never dialed.
  const { number } = useRegion();
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, space[3]) }]}>
      <Pressable
        onPress={() => {
          haptic('navigate');
          onBack();
        }}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel="Back one step"
        accessibilityState={{ disabled: !canBack }}
        style={({ pressed }) => [styles.side, { opacity: canBack ? 1 : 0.3 }, pressed && { opacity: 0.7 }]}>
        <View style={styles.sideCircle}>
          <CaretLeft size={26} color={color.ink} weight="bold" />
        </View>
        <Text variant="caption" tone="muted">
          Back
        </Text>
      </Pressable>

      <TalkButton size="dock" listening={listening} level={level} onPress={onTalk} />

      <Pressable
        onPress={() => {
          haptic('attention');
          on911();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Call ${number}. Shows your address and what to tell them. Mayday does not dial.`}
        style={({ pressed }) => [styles.side, pressed && { opacity: 0.8 }]}>
        <View style={[styles.sideCircle, { backgroundColor: color.signal }]}>
          <Phone size={24} color={color.onSignal} weight="fill" />
        </View>
        <Text variant="caption" style={{ color: color.ink }}>
          {number}
        </Text>
      </Pressable>
    </View>
  );
}

/** "Heard: no" for two and a half seconds, only for things Mayday acted on. */
export function Understood({ understood }: { understood: { text: string; at: number } | null }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!understood) return;
    setShown(understood.text);
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [understood]);
  return (
    <View style={styles.heardSlot} accessibilityLiveRegion="polite">
      {shown && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={styles.heard}>
          <Check size={14} color={color.accent} weight="bold" />
          <Text variant="caption" style={{ color: color.ink }} numberOfLines={1}>
            {shown}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * What Mayday just answered, as a caption over the picture for ten seconds:
 * a loud room can drown the voice, and a scared person may not take in a
 * spoken answer the first time. Tap to dismiss.
 */
export function ReplyCaption({ reply, tone }: { reply: { lines: string[]; source: string | null; at: number } | null; tone: string }) {
  const [shown, setShown] = useState<typeof reply>(null);
  useEffect(() => {
    if (!reply) return;
    setShown(reply);
    const t = setTimeout(() => setShown(null), 10_000);
    return () => clearTimeout(t);
  }, [reply]);
  if (!shown) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={styles.replyWrap} accessibilityLiveRegion="polite">
      <Pressable onPress={() => setShown(null)} accessibilityRole="button" accessibilityLabel={`Mayday said: ${shown.lines.join(' ')}. Tap to close.`}>
        <Glass radius={radius.lg} variant="thick">
          <View style={styles.reply}>
            <View style={[styles.replyBar, { backgroundColor: tone }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{shown.lines.join(' ')}</Text>
              {shown.source ? (
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {shown.source}
                </Text>
              ) : null}
            </View>
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  replyWrap: { position: 'absolute', left: space[4], right: space[4], top: 72 },
  reply: { flexDirection: 'row', gap: space[3], padding: space[4] },
  replyBar: { width: 3, borderRadius: 2 },
  top: {
    height: 60,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  round: { width: 44, height: 44 },
  roundInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: {
    height: 44,
    flexShrink: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  track: { height: 4, marginHorizontal: space[4], borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingTop: space[2],
  },
  side: { alignItems: 'center', width: 72, gap: space[1], paddingTop: space[2] },
  sideCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 232, 0.10)',
  },
  heardSlot: { height: 30, alignItems: 'center', justifyContent: 'center' },
  heard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242, 239, 232, 0.08)',
    maxWidth: 320,
  },
});
