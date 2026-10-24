# AI usage disclosure

The 2026 rules require that "all AI usage is fully disclosed in the submission materials" and that AI "must not constitute the entirety of the technical development". This is the complete list. **The team should add anything missing** (for example, any chatbot used to brainstorm or to write the original project brief) before submitting.

## AI used to build the app

| Tool | What it was used for | What the team did |
|---|---|---|
| **Claude Code** (Anthropic, model Claude Opus 5.5) | `[TEAM: describe the real split honestly]` Generated the first version of most of the code (app screens, protocol engine, CPR scheduler, router, proxy, Python tools), wrote first drafts of the documentation, ran web research and summarised sources, and took and critiqued screenshots | `[TEAM: what you designed, decided, reviewed, rewrote, tested on devices, and can explain line by line]` |
| Claude Code, August 2026 prototype | Research notes in `research/raw/` and the first Flutter prototype in `app/` | `[TEAM]` |
| **Kokoro-82M** neural text-to-speech (open source, Apache 2.0, voice `af_heart`; replaced Piper `en_US-lessac-medium` on October 23) | Pre-recorded every line the app speaks, including the counts and the 112 versions for Lagos | Wrote every line; chose the voice and timing |
| `[TEAM: any other tool, e.g. ChatGPT, GitHub Copilot, image generators]` | | |

## AI the app uses while running

| Model | Where | What it may do | What it may not do |
|---|---|---|---|
| **Groq**, `llama-3.1-8b-instant` | `proxy/src/index.ts` `/route` | Suggest which protocol fits a sentence the offline rules were unsure about | Write any instruction. Output must match a fixed schema of ids or it is discarded. Never delays a life-threat protocol |
| **Claude**, `claude-opus-5-5` (Anthropic) | `/ask` | Rephrase an answer using only the cited protocol passages the app sends, citing them | Add facts or steps. Uncited or long answers are discarded and the app says "I don't know. Keep doing compressions." |
| **Claude**, `claude-opus-5-5`, or on the demo laptop with no key a local model (`qwen2.5:14b-instruct` through Ollama) | `/adapt` | Rephrase upcoming spoken lines for this patient ("your dad", "him") and this rescuer (calmer when they panic) | Change any medical word, number or negation, add a step, or speak to the patient. The app checks every line against the original and keeps the original wording if it fails |
| **Claude**, `claude-opus-5-5` | `/scan` (photo check) | Describe a burn or wound photo in hedged words and suggest burns or bleeding | Diagnose or give treatment steps |

The app is complete with no AI at all: without the proxy the protocols, voice, CPR coach, 911 flow and map all work, and the photo check is hidden.

## Third-party code and data

Open-source libraries (each under its own license): Expo SDK and modules, React Native, React Native Reanimated, React Native Skia, react-native-audio-api, react-native-svg, expo-speech-recognition, Phosphor icons, zod, the Anthropic TypeScript SDK, Geist and Geist Mono fonts (SIL Open Font License), Kokoro-82M through kokoro-onnx (Apache 2.0 / MIT), Piper TTS. Full list: `mobile/package.json` and `proxy/package.json`.

Images: 15 step pictures from Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA), recolored; authors and licenses in `docs/IMAGE_CREDITS.md` and in the app. Local model: Qwen2.5 (Apache 2.0) through Ollama, only on the demo laptop.

Data: CMS Hospital General Information; Florida Department of Health trauma center list; OpenStreetMap (Tampa Bay urgent care, and 514 hospitals and health centres in Lagos State, ODbL); U.S. Census geocoder; CARES 2024 Metrics Summary; map tiles from Esri. Lagos figures: Mould-Millman et al. 2017 (Prehospital and Disaster Medicine), Venkatraman et al. 2020 (European Journal of Trauma and Emergency Surgery), Song et al. 2018 (Scand J Trauma Resusc Emerg Med). Quick guides: CDC and MedlinePlus. Medical content: see `docs/MEDICAL_SOURCES.md`.
