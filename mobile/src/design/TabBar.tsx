import { TabList, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { BookOpen, House, IdentificationCard, MapTrifold, WaveSine } from 'phosphor-react-native';
import { forwardRef, type ComponentRef, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Glass } from './Glass';
import { haptic } from './haptics';
import { useDeviceInsets } from './insets';
import { Text } from './Text';
import { color, radius, space, spring } from './tokens';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'fill' }>;

const TABS: { name: string; href: '/' | '/breathe' | '/learn' | '/map' | '/me'; Icon: IconType; label: string; hint: string }[] = [
  { name: 'index', href: '/', Icon: House, label: 'Help', hint: 'Start help for an emergency' },
  { name: 'breathe', href: '/breathe', Icon: WaveSine, label: 'Breathe', hint: 'Check breathing with the phone on the chest' },
  { name: 'learn', href: '/learn', Icon: BookOpen, label: 'Learn', hint: 'Practice CPR and read every step' },
  { name: 'map', href: '/map', Icon: MapTrifold, label: 'Map', hint: 'Nearest emergency rooms' },
  { name: 'me', href: '/me', Icon: IdentificationCard, label: 'Me', hint: 'Medical ID and settings' },
];

type TabButtonProps = TabTriggerSlotProps & { Icon: IconType; label: string; hint: string };

const TabButton = forwardRef<ComponentRef<typeof View>, TabButtonProps>(({ isFocused, Icon, label, hint, onPress, ...rest }, ref) => {
  const dot = useAnimatedStyle(() => ({
    opacity: withSpring(isFocused ? 1 : 0, spring.press),
    transform: [{ scale: withSpring(isFocused ? 1 : 0.4, spring.press) }],
  }));
  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(e) => {
        if (!isFocused) haptic('navigate');
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}>
      <Animated.View style={[styles.selection, dot]} />
      <Icon size={24} color={isFocused ? color.ink : color.inkMuted} weight={isFocused ? 'fill' : 'regular'} />
      <Text variant="caption" style={[styles.label, { color: isFocused ? color.ink : color.inkMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
});
TabButton.displayName = 'TabButton';

/**
 * Floating glass tab bar, iOS 26 style: five tabs, each an icon and a word.
 */
export function TabBar(props: TabListProps) {
  const insets = useDeviceInsets();
  return (
    <View
      {...props}
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 6, space[3]) }]}>
      <Glass radius={radius.pill} style={styles.capsule} interactive>
        <View style={styles.row}>{props.children}</View>
      </Glass>
    </View>
  );
}

export function TabTriggers() {
  return TABS.map(({ name, href, Icon, label, hint }) => (
    <TabTrigger key={name} name={name} href={href} asChild>
      <TabButton Icon={Icon} label={label} hint={hint} />
    </TabTrigger>
  ));
}

export { TabList };

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
  },
  capsule: { height: 68 },
  row: { flexDirection: 'row', alignItems: 'center', height: 68, paddingHorizontal: space[2] },
  tab: { width: 66, height: 68, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, lineHeight: 15 },
  selection: {
    position: 'absolute',
    width: 60,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242, 239, 232, 0.10)',
  },
});
