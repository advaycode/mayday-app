# Video script (target 2:55, hard cap 3:00)

Real app footage only: screen recordings from a phone (or the phone mirror), never mock-ups. Burned-in captions throughout. 1080p. Export under 2:58.

The rules require the video to say: **participant names, app name, purpose in one sentence, target audience, tools and coding languages**, and show the functionality. Each is marked ✓ below where it is covered.

---

## 0:00 to 0:15 · Cold open (Structure)

**Picture:** low angle, dim living room. A CPR manikin on the floor. A phone lies face-up beside it, screen showing a huge "17" pulsing. Hands pumping on the manikin's chest, in time.
**Sound:** only the app: *"...seventeen, eighteen, nineteen..."* and the click. No music, no narration.
**On screen at 0:12, small:** Mayday

## 0:15 to 0:35 · The problem (Ideology)

**Picture:** black. Text appears one line at a time, Geist Light, off-white.

> 7 in 10 cardiac arrests happen at home.
> Fewer than half get CPR from the person next to them.
> Fewer than 1 in 9 survive.
> *CARES registry, 2024*

**Voice (team member, on camera or over):** "When someone collapses, the person who can save them is usually family, and usually untrained. They don't freeze because they don't care. They freeze because nobody is telling them what to do. We're `[NAMES]` ✓, and we built **Mayday** ✓. It talks you through a medical emergency, out loud and step by step, while help is on the way ✓."

## 0:35 to 1:45 · Live demo (Function, UI)

Screen recording, phone in hand (or the phone mirror), real voice audio.

| Time | Picture | What we say or hear |
|---|---|---|
| 0:35 | Home: the big "Talk to Mayday" button and the colored tiles. Thumb taps Talk | "One button. Tap it and talk." |
| 0:40 | The listening screen: the light swells with the rescuer's voice | App: *"Tell me what's happening."* Rescuer: *"My dad collapsed, he's not breathing!"* |
| 0:48 | Screen jumps to "Send for an AED" | App: *"Your dad isn't breathing. We'll do this together."* (under 1.5 s; it heard "dad", and says "him" from here on) |
| 0:52 | Thumb taps the red 911 at the bottom: "Call 911 on your phone", with the address, coordinates and a summary | "It never dials 911. You call, and it gives you your address and a summary to read out." |
| 1:00 | Hands photo; then the count, 128 pt | App counts; *"Push hard and fast."* |
| 1:08 | 30:2: "Breathe" screen | App: *"Two breaths. Tilt the head. Lift the chin."* |
| 1:15 | Rescuer: *"The AED is here!"* → "Turn the AED on", pads screen | App: *"You can move a bra aside. No need to remove it."* (caption: 2025 guideline change) |
| 1:24 | Map tab: nearest ER, toggle to Trauma: "St. Joseph's Hospital, Level II and Pediatric" | "It knows an ER from a trauma center, from state and federal data." |
| 1:31 | Photo check on a moulage burn: "This looks consistent with..." → "Burn steps" | "It can look at a burn and pick the right steps, without diagnosing." |
| 1:38 | Control Center: airplane mode on. Counting continues | "And it all works with no signal." |

## 1:45 to 2:30 · How it works (Code: the row most videos lose)

Team member on camera for the first sentence, then animation and real code.

**1:45** On camera: "Here's the part we're proudest of: the AI is never allowed to give medical advice."

**1:50** Remotion animation of the architecture (from `docs/ARCHITECTURE.md`): voice → offline rules → protocol engine → voice and screen; a dotted side path to the AI through our proxy, with a schema check on the way back.
**Voice:** "What you say goes first to rules that run on the phone in a few milliseconds. Anything that sounds like a life threat starts the protocol immediately. The AI only helps when the rules are unsure, and its answer has to match a strict format or we throw it away."

**1:56** Screen recording of the desktop phone window with the **Engine** panel open (hidden by default: click beside the phone, then Ctrl+Shift+E; `docs/screens/engine.png`). Say *"Oh my god, please help, my dad collapsed, he is not, he is not breathing."* The panel fills in: cpr_adult at 0.97, distress 0.85 from "oh my god" and the repeated "he is not", state panicked, voice ×0.92, two questions skipped as already known.
**Voice:** "It also listens to how you sound. Panic slows the voice down and adds one calming line. This panel is the app's real reasoning, live, not an animation."

**2:02** Code snippet 1 on screen, `mobile/src/protocols/corpus/cpr_adult.json`, the `aed_pads` step with its `quote` highlighted.
**Voice:** "Every instruction is data with the guideline sentence it came from. 78 steps, and tests fail the build if one loses its source."

**2:10** Code snippet 2, `mobile/src/cpr/timeline.ts`, the line `const start = t0 + index * baseCycle + ...` highlighted, then `scheduler.ts`.
**Voice:** "JavaScript timers drift: a normal metronome is two seconds late after ten minutes. We schedule every beat on the phone's audio hardware clock. Our test runs ten minutes with a bad timer, and all 1,100 beats land on time."

**2:20** Numbers card: **354 tests** · **85% on sentences it had never heard** · **0 ms drift** · **[NOVICE TIME] seconds** from "your friend collapsed" to first compression, someone who had never seen the app.

## 2:30 to 2:55 · Impact and learning

**Picture:** team on camera, then the app's home screen.
**Voice:**
- "Mayday is for anyone standing next to someone who just collapsed, especially people who've never taken a CPR class ✓."
- *(Optional, 6 s, Impact row)* Map tab: the region chip switches to **Lagos, Nigeria**; the card reads "Here, the bystander is the ambulance": **8.7%** of Africans covered by any ambulance service, **53%** of Lagos road-crash calls with no ambulance response, **2×** survival with bystander CPR. "And where no ambulance is coming, the bystander is the only help. Mayday says 112 there, works offline, and understands many accents."
- "We built it with TypeScript, React Native and Expo, Python for our data and voice tools, Skia's shader language for the light, and Claude and Groq for the AI features ✓."
- "The hardest part was `[YOU: the one challenge from your written answer]`."
- "What we learned: `[YOU]`."
- On screen, 4 seconds: **AI disclosure**: "We used Claude Code to help write code and documentation, and the open-source Kokoro voice model to record the voice. Full disclosure in our repository."
- Last frame: the home screen, Talk to Mayday. "Mayday. Always call 911."

---

## Timing check

Read it aloud with a stopwatch before filming. If it runs long, cut in this order: photo check (1:31), the 30:2 breaths beat (1:08), the map toggle (1:24). Never cut the code section or the cold open.
