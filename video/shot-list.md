# Shot list and production plan

## Before Saturday

- [ ] Borrow a CPR manikin (school health office, a local Red Cross or AHA training center).
- [ ] Moulage burn on a forearm (theatrical makeup) for the photo check. Never photograph a real injury.
- [ ] Development build installed on the filming phone (speech recognition and audio engine need it).
- [ ] Proxy running with keys if showing the photo check (`docs/PROGRESS.md` item 4).
- [ ] DEMO_MODE banner visible in every emergency shot. Never place a real 911 call.
- [ ] Novice test done and the time recorded (`docs/PROGRESS.md` item 3).
- [ ] Phone: Do Not Disturb on, brightness high, battery icon above 50%, clean status bar.

## Shots

| # | Shot | Camera | Audio | Notes |
|---|---|---|---|---|
| 1 | Manikin, phone on floor counting, hands compressing | Low, side, dim warm light | App audio only, clean | Compress in time with the app: the count must match the hands |
| 2 | Close-up of the phone: "17" pulsing | Top-down, locked off | App audio | Same take as 1 if possible |
| 3 | Team intro line | Eye level, natural light | Lav or phone mic close | Each person says their own name |
| 4 | Thumb holding the 911 button, red flood | Over the shoulder | App | Slow down 0.8x in edit if it reads too fast |
| 5 | Screen recording: full voice flow (intake → CPR → breaths → AED) | Phone screen capture | Internal audio + mic | Do 5 takes; use the cleanest |
| 6 | Screen recording: map, trauma toggle | Screen capture | None | |
| 7 | Moulage photo check | Over the shoulder + screen capture | App | Needs proxy keys |
| 8 | Airplane mode toggled mid-count | Screen capture | App | Pull down Control Center, tap, keep counting |
| 9 | Code snippets | Editor, large font (20 pt+), dark theme | VO | `cpr_adult.json` aed_pads step; `timeline.ts` cycles(); `scheduler.ts` tick() |
| 10 | Team closing | Same as 3 | Lav | |

## Edit (Sunday)

- **Remotion** segments: the statistics cards (0:15), the architecture diagram (1:50), the numbers card (2:20), the AI disclosure card. Use the app's tokens: background `#050505`, text `#F2EFE8`, red `#D7261E` only for the 911 button, Geist.
- **ffmpeg** to assemble: normalize loudness to -14 LUFS, burn in captions (from a .srt), export 1920×1080 H.264, under 2:58.
- Upload to YouTube as **Public** (rules require public), title and description in `youtube.md`.
- Watch the uploaded version once on a phone and once on a TV before submitting.

`Obsidian/OpenMontage` has a working video pipeline (see its `CLAUDE.md`) that can render the Remotion segments and do the ffmpeg assembly.
