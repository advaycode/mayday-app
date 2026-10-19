# Mayday on an iPhone

Apple only installs native apps from the App Store, TestFlight, or a Mac with Xcode. So on an iPhone, Mayday installs as a home-screen web app: Safari adds it with its own icon, it opens full screen, and after the first open it works with no signal.

**Mayday never calls 911.** The countdown is a practice call; nothing is ever dialed. In a real emergency, call 911 yourself.

## Install (2 minutes)

1. On the iPhone, scan `docs/install-qr.png` with the Camera, or open the link in **Safari** (it has to be Safari).
2. Let it load once on Wi-Fi. It stores everything it needs (27 MB) for offline use.
3. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
4. Open Mayday from the home screen. When it asks for the microphone, tap **Allow**.

Test that it works offline: turn on Airplane Mode, open Mayday from the home screen, hold the button, and tap **No breath**. The steps and the voice should keep going.

## Differences from the native app

| | Home-screen app (iPhone) | Native app (needs a Mac or Apple developer account) |
|---|---|---|
| Steps, pictures, CPR coach, voice | Yes | Yes |
| Works offline | Yes, after the first open | Yes |
| Voice input | Yes if Safari allows it (needs Dictation on: Settings → General → Keyboard). If not, tap the buttons | Yes, on the phone |
| Vibration | No (Safari has no vibration) | Yes |
| Glass effect | Frosted blur | Apple's Liquid Glass |
| Plays with the silent switch on | Yes (iOS 16.4+) | Yes |

## Update it

```bash
python tools/build_iphone.py
python tools/deploy_iphone.py
```

On the phone, close Mayday and open it again (twice if the change doesn't show). It downloads the new version on the first open and uses it from the next.
