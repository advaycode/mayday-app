import { Linking, Platform } from 'react-native';

import { DEMO_DIAL, DEMO_MODE } from '@/config';

/**
 * Placing the call.
 *
 * Neither iOS nor Android lets an app silently dial 911. Opening a tel: link
 * hands the number to the phone's own dialer: iOS asks for one confirming
 * tap, Android shows the dialer. That is the right design for an emergency
 * number, so we work with it: a visible 5-second countdown that can be
 * cancelled, then one tap.
 *
 * DEMO_MODE (on in every development build and in the web preview) never
 * dials 911. It shows a simulated call, or dials EXPO_PUBLIC_DEMO_DIAL (a team
 * member's phone) if one is set.
 */
export type CallHow = 'dialer' | 'demo-dial' | 'simulated';

export async function placeCall(): Promise<CallHow> {
  if (DEMO_MODE) {
    if (DEMO_DIAL && Platform.OS !== 'web') {
      await Linking.openURL(`tel:${DEMO_DIAL}`).catch(() => {});
      return 'demo-dial';
    }
    return 'simulated';
  }
  await Linking.openURL('tel:911').catch(() => {});
  return 'dialer';
}

/**
 * Text-to-911, for when speaking is not possible. Availability depends on the
 * county; the app says so on the button. Opens the messages app with the
 * location and summary already written.
 */
export async function textTo911(body: string): Promise<boolean> {
  const to = DEMO_MODE ? DEMO_DIAL : '911';
  if (!to) return false;
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${to}${sep}body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
