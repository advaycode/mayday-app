# AI usage disclosure

The 2026 rules require that "all AI usage is fully disclosed in the submission materials" and that AI "must not constitute the entirety of the technical development". This is the complete list. **The team should add anything missing** (for example, any chatbot used to brainstorm or to write the original project brief) before submitting.

## AI used to build the app

| Tool | What it was used for | What the team did |
|---|---|---|
| **Claude Code** (Anthropic, model Claude Opus 5.5) | `[TEAM: describe the real split honestly]` Generated the first version of most of the code (app screens, protocol engine, CPR scheduler, router, proxy, Python tools), wrote first drafts of the documentation, ran web research and summarised sources, and took and critiqued screenshots | `[TEAM: what you designed, decided, reviewed, rewrote, tested on devices, and can explain line by line]` |
| Claude Code, August 2026 prototype | Research notes in `research/raw/` and the first Flutter prototype in `app/` | `[TEAM]` |
| **Piper** neural text-to-speech (open source, voice `en_US-lessac-medium`) | Pre-recorded every line the app speaks, including the counts | Wrote every line; chose the voice and timing |
| `[TEAM: any other tool, e.g. ChatGPT, GitHub Copilot, image generators]` | | |

## AI the app uses while running

| Model | Where | What it may do | What it may not do |
|---|---|---|---|
| **Groq**, `llama-3.1-8b-instant` | `proxy/src/index.ts` `/route` | Suggest which protocol fits a sentence the offline rules were unsure about | Write any instruction. Output must match a fixed schema of ids or it is discarded. Never delays a life-threat protocol |
| **Claude**, `claude-opus-5-5` (Anthropic) | `/ask` | Rephrase an answer using only the cited protocol passages the app sends, citing them | Add facts or steps. Uncited or long answers are discarded and the app says "Keep doing compressions. Tell the dispatcher that." |
| **Claude**, `claude-opus-5-5` | `/scan` (photo check) | Describe a burn or wound photo in hedged words and suggest burns or bleeding | Diagnose or give treatment steps |

The app is complete with no AI at all: without the proxy the protocols, voice, CPR coach, 911 flow and map all work, and the photo check is hidden.

## Third-party code and data

Open-source libraries (each under its own license): Expo SDK and modules, React Native, React Native Reanimated, React Native Skia, react-native-audio-api, react-native-svg, expo-speech-recognition, Phosphor icons, zod, the Anthropic TypeScript SDK, Geist and Geist Mono fonts (SIL Open Font License), Piper TTS. Full list: `mobile/package.json` and `proxy/package.json`.

Data: CMS Hospital General Information; Florida Department of Health trauma center list; OpenStreetMap; U.S. Census geocoder; CARES 2024 Metrics Summary; map tiles from Esri. Medical content: see `docs/MEDICAL_SOURCES.md`.
