import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Safe-area insets. On a phone these come straight from the OS. */
export function useDeviceInsets() {
  return useSafeAreaInsets();
}
