import { Platform } from 'react-native';

/**
 * The engine's working, sent to the desktop phone mirror (mirror/index.html),
 * which draws it in a side panel: what was heard, how it was cleaned and
 * routed, how the rescuer sounds, what was said and why, and every AI rewrite
 * with its verdict. Real values from the running app, nothing staged.
 *
 * Only in the web build inside the mirror's frame; on a phone this does nothing.
 */
const inMirror = Platform.OS === 'web' && typeof window !== 'undefined' && window.parent !== window;

export function trace(kind: string, data: Record<string, unknown> = {}) {
  if (!inMirror) return;
  try {
    // Our own fields last, so an event's data can never overwrite them.
    window.parent.postMessage({ ...data, type: 'mayday:trace', kind, t: Date.now() }, '*');
  } catch {
    // the panel is optional
  }
}

/** Milliseconds since `start`, to one decimal. */
export const since = (start: number) => Math.round((performance.now() - start) * 10) / 10;
