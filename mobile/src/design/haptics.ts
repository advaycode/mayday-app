import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getSettings } from '@/settings/store';

/**
 * Haptic choreography. Each event has one pattern so a rescuer with the phone
 * in a pocket can tell them apart without looking:
 *
 *   navigate     soft selection tick
 *   holdStep     light tap as the emergency ring fills
 *   start        heavy thud when emergency mode opens
 *   countdown    medium tap each second of the 911 ring
 *   compression  rigid tap on every beat (the strongest, most frequent)
 *   swap         three medium taps: switch rescuers
 *   attention    warning pattern: something needs you to look
 */
export type HapticEvent =
  | 'navigate'
  | 'holdStep'
  | 'start'
  | 'countdown'
  | 'compression'
  | 'swap'
  | 'attention';

function mirror(event: HapticEvent) {
  // In the web phone mirror there is no motor, so we tell the frame to
  // show a visible buzz instead. Harmless everywhere else.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage({ type: 'mayday:haptic', event }, '*');
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function haptic(event: HapticEvent): Promise<void> {
  if (!getSettings().haptics) return;
  mirror(event);
  if (Platform.OS === 'web') return;
  try {
    switch (event) {
      case 'navigate':
        return await Haptics.selectionAsync();
      case 'holdStep':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'start':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'countdown':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'compression':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      case 'swap':
        for (let i = 0; i < 3; i++) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await wait(120);
        }
        return;
      case 'attention':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // Haptics are a bonus channel; never let them break the flow.
  }
}
