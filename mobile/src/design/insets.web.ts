import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * In the phone mirror (mirror/ at the repo root) the app runs inside an
 * iframe sized exactly like an iPhone screen. The browser reports zero safe
 * area, so the mirror passes the real device's insets in the URL once and we
 * keep them for the rest of the session (routing changes the URL later).
 */
type Insets = { top: number; bottom: number; left: number; right: number };

function readMirrorInsets(): Insets | null {
  if (typeof window === 'undefined') return null;
  const key = 'mayday.mirrorInsets';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('insets');
  try {
    if (raw) {
      const [top, right, bottom, left] = raw.split(',').map(Number);
      const insets = { top, right, bottom, left };
      window.sessionStorage.setItem(key, JSON.stringify(insets));
      return insets;
    }
    const saved = window.sessionStorage.getItem(key);
    return saved ? (JSON.parse(saved) as Insets) : null;
  } catch {
    return null;
  }
}

const mirrorInsets = readMirrorInsets();

export function useDeviceInsets(): Insets {
  const real = useSafeAreaInsets();
  return mirrorInsets ?? real;
}

export const isMirror = mirrorInsets !== null;
