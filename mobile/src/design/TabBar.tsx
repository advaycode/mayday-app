import { router } from 'expo-router';
import { TabList, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { House, IdentificationCard, MapTrifold, Phone, Heartbeat } from 'phosphor-react-native';
import { forwardRef, type ComponentRef, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Glass } from './Glass';
import { haptic } from './haptics';
import { useDeviceInsets } from './insets';
import { color, radius, space, spring } from './tokens';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'fill' }>;

const TABS: { name: string; href: '/' | '/learn' | '/map' | '/me'; Icon: IconType; label: string }[] = [
  { name: 'index', href: '/', Icon: House, label: 'Home' },
  { name: 'learn', href: '/learn', Icon: Heartbeat, label: 'Practice and protocols' },
  { name: 'map', href: '/map', Icon: MapTrifold, label: 'Nearest emergency rooms' },
  { name: 'me', href: '/me', Icon: IdentificationCard, label: 'Medical ID and settings' },
];

type TabButtonProps = TabTriggerSlotProps & { Icon: IconType; label: string };

const TabButton = forwardRef<ComponentRef<typeof View>, TabButtonProps>(({ isFocused, Icon, label, onPress, ...rest }, ref) => {
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
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}>
      <Animated.View style={[styles.selection, dot]} />
      <Icon size={24} color={isFocused ? color.ink : color.inkMuted} weight={isFocused ? 'fill' : 'regular'} />
    </Pressable>
  );
});
TabButton.displayName = 'TabButton';

/**
 * Floating glass tab bar, iOS 26 style: a capsule of icons, and on every tab
 * except Home (which has the big control) a separate red circle that opens
 * emergency mode. Icons only, with full screen-reader labels.
 */
export function TabBar({ showEmergency, ...props }: TabListProps & { showEmergency: boolean }) {
  const insets = useDeviceInsets();
  return (
    <View
      {...props}
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 6, space[3]) }]}>
      <Glass radius={radius.pill} style={styles.capsule} interactive>
        <View style={styles.row}>{props.children}</View>
      </Glass>
      {showEmergency && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency. Opens step-by-step help. It never calls anyone; call 911 yourself."
          onPress={() => {
            haptic('start');
            router.push('/emergency');
          }}
          style={({ pressed }) => [styles.sos, pressed && { backgroundColor: color.signalPressed, transform: [{ scale: 0.96 }] }]}>
          <Phone size={26} color={color.onSignal} weight="fill" />
        </Pressable>
      )}
    </View>
  );
}

export function TabTriggers() {
  return TABS.map(({ name, href, Icon, label }) => (
    <TabTrigger key={name} name={name} href={href} asChild>
      <TabButton Icon={Icon} label={label} />
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
  capsule: { height: 64 },
  row: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: space[2] },
  tab: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  selection: {
    position: 'absolute',
    width: 52,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242, 239, 232, 0.10)',
  },
  sos: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
