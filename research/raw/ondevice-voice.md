# ondevice-voice — Offline STT/TTS in Flutter + mic during a live phone call

Research date: 2026-08-23. All claims below have a URL that was fetched this session.

---

## PART 0 — THE KILLER QUESTION: mic during an active cellular call

### ANDROID: NO. Officially documented, not a bug.

Source (fetched): https://developer.android.com/media/platform/sharing-audio-input

Exact rules from the page:
- "A voice call is active if the audio mode returned by `AudioManager.getMode()` is `MODE_IN_CALL` or `MODE_IN_COMMUNICATION`."
- "The call always receives audio."
- An ordinary app using `MIC` / `VOICE_RECOGNITION` **cannot capture while a call is active**.
- Only two exceptions: (a) an **accessibility service** whose UI is displayed, (b) a **privileged, pre-installed** app holding `CAPTURE_AUDIO_OUTPUT` (using `VOICE_UPLINK` / `VOICE_DOWNLINK` / `TYPE_TELEPHONY`). Neither is available to a Play-Store app from a student.
- "Two ordinary apps can never capture audio at the same time."
- Android 10+ priority order: privileged > visible foreground UI > privacy-sensitive source (`CAMCORDER`, `VOICE_COMMUNICATION`) > most recently started.
- Android 11+ `AudioRecord.registerAudioRecordingCallback()` → `AudioRecordingConfiguration.isClientSilenced()` returns **true** when the app is being fed silence by the capture policy. THIS IS THE DETECTION HOOK — it lets Mayday know it has gone deaf and fall back to touch UI instead of silently failing.

Note the trap: `AudioRecord.startRecording()` **succeeds** and keeps delivering buffers; the buffers are just **digital silence**. There is no exception, no error code. A naive implementation looks alive and is deaf.

### iOS: NO. Also documented/confirmed by Apple DTS.

Sources (fetched):
- https://developer.apple.com/forums/thread/666607 — Apple DTS (Quinn "The Eskimo!"): "There's no supported way to do this." (re: recording telephone call audio). Also: "As far as I know Apple has never published an official document saying why that's the case."
- https://developer.apple.com/forums/thread/784782 — mic recording is killed by `AVAudioSession` interruption **even while the phone is merely ringing**, before the call is answered. Apple's only reply: "Please use Feedback Assistant to file an enhancement request." (developer filed FB18434531). No API, no workaround.

So on iOS the app's `AVAudioSession` is **interrupted** (`.began`) when the call starts; the app's input node is torn down. Re-activating during the call fails.

### CONSEQUENCE FOR MAYDAY (write this down)
The "user calls 911 on speakerphone and the app keeps listening for 'done'/'next'" design is **impossible on both platforms**. This is not a polish problem, it is a product-design problem, and it must be redesigned NOW.

---

(rest of notes below — in progress)
