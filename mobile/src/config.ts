/**
 * App-wide switches.
 *
 * DEMO_MODE is the most important flag in the app. While it is on, nothing
 * this app does can reach a real 911 dispatcher: the call screen is simulated
 * (or dials EXPO_PUBLIC_DEMO_DIAL, a team member's phone), and texts go to the
 * same number. It is on by default in every development build and in the web
 * preview, and a banner is pinned to every emergency screen while it is on.
 *
 * A store build turns it off by setting EXPO_PUBLIC_DEMO_MODE=false at build
 * time. There is no switch inside the app that turns it off.
 */
export const DEMO_MODE: boolean = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

/** Number to dial instead of 911 while DEMO_MODE is on. Empty = simulated call screen. */
export const DEMO_DIAL: string = process.env.EXPO_PUBLIC_DEMO_DIAL ?? '';

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
