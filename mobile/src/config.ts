/**
 * App-wide switches.
 *
 * DEMO_MODE is always on. Mayday never calls 911 or anyone else: the call
 * screen is a simulation (src/emergency/call.ts), a banner says so on every
 * emergency screen, and the voice tells the person to call 911 themselves.
 * There is no build setting or switch that turns this off.
 */
export const DEMO_MODE = true;

/**
 * Base URL of the model proxy (proxy/ at the repo root). Empty means the app
 * never makes a network call for AI, and runs entirely on the offline path:
 * keyword routing, bundled protocols, bundled voice. That is a complete app,
 * not a degraded one.
 */
export const PROXY_URL: string = process.env.EXPO_PUBLIC_PROXY_URL ?? '';

/** Compression tempo. AHA: 100 to 120 per minute; 110 sits in the middle. */
export const CPR_BPM = 110;

/** Seconds on the "Calling 911" ring before the call is placed. */
export const CALL_COUNTDOWN_S = 5;

/**
 * Local neural voice server (tools/tts_server.py) for lines that are not
 * pre-recorded, such as AI-adapted phrasing. Empty means the phone's own voice.
 */
export const TTS_URL: string = process.env.EXPO_PUBLIC_TTS_URL ?? '';
