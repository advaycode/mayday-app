# Research findings, and how they change the plan

Written 2026-10-18 for the Congressional App Challenge 2026 (deadline 12:00 pm Eastern, Monday October 26 2026).
Builds on the August research in `research/DECISIONS.md` and `research/raw/`. Every claim below names its source.

---

## 1. How the app is judged

**The 2026 rules have no points rubric.** The official rules ([2026-CAC-Rules.pdf](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf), section on winner selection) say apps *can* be judged on:

1. Quality of the idea (creativity and originality)
2. Implementation of the idea (user experience and design)
3. Demonstrated excellence of coding and programming skills

and that each Member of Congress may change the process "at any time for any reason". Judging is per district.

**The 30-point rubric still exists as a guide.** [CAC-Judging-Rubric.pdf](https://www.congressionalappchallenge.us/wp-content/uploads/2022/09/CAC-Judging-Rubric.pdf) (header: "2021 CAC RUBRIC GUIDE") scores Concept (Ideology, Impact, Structure) and Technology (Function, Code, UI), 1 to 5 each. Two of the six rows grade the **video**, not the app:

| Row | Top score wording (verbatim) | What Mayday does about it |
|---|---|---|
| Ideology | "Issue or need is extremely relevant" | Open on the CARES statistics (section 5) |
| Impact | "Immense usage of creativity is featured as impact is explained" | Who it serves: anyone, no training, no signal, no account |
| Structure (video) | "Video is innovative and engaging" | Cold open with the app's own voice counting; 3:00 hard cap |
| Function | "App is functional with complex features" | Voice triage, audio-clock CPR coach, 911 flow, trauma-aware map, offline |
| Code (video) | "Explanation of code indicates immense understanding" | 45 seconds on two real code snippets, the eval numbers, and the limits |
| UI | "App is highly innovative in design and interface" | Calm mode in Liquid Glass; emergency mode in 128 pt type on black |

**Rules that bind the video** (2026 rules, verbatim list): participant names, app name, purpose "in one, clear sentence", target audience, "the tools and coding languages used", and functionality. 1 to 3 minutes, public on YouTube or Vimeo. Missing "tools and coding languages" is a free, avoidable loss: every winning video we transcribed (section 3) says them out loud.

**AI disclosure** (verbatim): "The use of AI tools ... is permitted, provided that all AI usage is fully disclosed in the submission materials. AI may only be used to support specific aspects of the project and must not constitute the entirety of the technical development." The disclosure is in `submission/ai-disclosure.md`. **Prior work** is allowed back to October 30 2025; judges may demand the source code and app on pain of disqualification, so the repo must run on request.

## 2. Past winners: what wins in health, safety and emergencies

Source: the winner galleries for [2025](https://www.congressionalappchallenge.us/2025-winners/), [2024](https://www.congressionalappchallenge.us/2024-winners/) and [2023](https://www.congressionalappchallenge.us/2023-winners/): 1,053 winning apps, about 140 of them health or safety. The 20 closest to Mayday, from each app's official winner page:

| Year, district | App | Problem | Who it serves | Standout feature | How the video showed it |
|---|---|---|---|---|---|
| 2025 CA-49 | **HeartAngel** | Bystanders don't do CPR well enough | Anyone near a cardiac arrest | Real-time CPR guidance with phone sensors, metronome, AED map, responder network | Transcribed (section 3) |
| 2025 TX-17 | **Wound.ai** | Wounds treated too late lead to amputations | Anyone with a minor or chronic wound | Camera classifies 20 wound types; shows treatment steps | Transcribed |
| 2025 CA-28 | **Fire Up** | Conflicting wildfire alerts during evacuation | Wildfire-zone residents, crews | Fire-risk model + live smoke detection + evacuation routes | Transcribed |
| 2025 FL-15 | **NeuroPath** | Late diagnosis of neurodegenerative disease | Patients and families | Handwriting-based screening model | Transcribed |
| 2025 OH-7 | S.T.R.A.P. the Stroke | Kids are present at strokes but don't know the signs | Children | Games and acronyms for stroke signs | Video unavailable |
| 2025 CA-4 | Anchor: Surgery Recovery | Patients drop off physical therapy | Orthopedic surgery patients | Recovery tracking for language-barrier families | Linked, not reviewed |
| 2025 CA-36 | MemoryLane | Cognitive decline and safety at home | Alzheimer's and Parkinson's patients | Companion with health management and safety | Linked, not reviewed |
| 2025 GA-11 | CognifyAI | Alzheimer's caught late | Older adults | Handwriting machine-learning diagnosis | Linked, not reviewed |
| 2025 FL-16 | Senior Health Guardian | Falls and silent decline in older adults | Seniors | Wearable fall detection, gait, sleep, oxygen | Linked, not reviewed |
| 2025 FL-12 | SpectraAid | Color blindness in daily life | People with color vision deficiency | Color correction tools | Linked, not reviewed |
| 2025 FL-9 | Hurricane Helper | Scattered hurricane prep information | Florida residents | Prep resources in one place | Linked, not reviewed |
| 2025 OK-5 | DisasterReady | Communities unprepared for disasters | Residents, responders | Situational awareness + smart mapping | Linked, not reviewed |
| 2025 NJ-3 | AlertNow | School gun violence | Schools | Audio + video threat detection | Linked, not reviewed |
| 2025 TX-24 | MyHeartHealth | Home blood pressure logs doctors can't use | Hypertension patients | Turns home readings into doctor-ready data | Linked, not reviewed |
| 2024 CA-4 | SOS-Connect | Chaos after disasters (Hurricane Helene, Tubbs Fire) | Disaster-affected families | Support network for emergencies | Linked, not reviewed |
| 2024 CA-13 | Lifeline | Wildfire, quake and flood evacuations | Californians | Disaster preparation and response | Linked, not reviewed |
| 2024 FL-16 | SafeHavenAI | Falls in adults over 65 | Seniors | Fall prevention | Linked, not reviewed |
| 2024 OK-1 | Crisis Averted | Unused opioids at home | Families | Safe opioid disposal | Linked, not reviewed |
| 2023 VA-9 | Heart Help | People unsure if they are having a heart attack | Anyone with chest symptoms | Quick, reliable symptom information | Linked, not reviewed |
| 2023 CO-3 | First In Health | Lack of diversity in healthcare careers | First-generation students | Healthcare pathway information | Linked, not reviewed |

Video links for every row are in each winner's page (URL pattern `congressionalappchallenge.us/25-CA49/`).

**The pattern that separates winners.** Every winner above starts from a **personal story** (a grandparent's fall, a neighbor with Alzheimer's, a family evacuating), names a **specific population**, and shows **one technically serious idea** (a trained model, a sensor algorithm, a data pipeline) with **numbers** attached (accuracy, hours, sample counts). Breadth of features matters less than one deep thing explained well.

**What nobody has done.** HeartAngel is the closest winner and it matters: a CPR coach has already won a district. Mayday must not look like a second one. What none of the 20 do:

1. **Coach the whole emergency, not one condition**: ten protocols behind one button, chosen by what the person says.
2. **Listen.** None of them take spoken input from a panicking bystander.
3. **Prove the medicine.** None show where their instructions come from. Mayday cites a guideline sentence for every step and tests that it does.
4. **Work with no signal.** Every AI winner above needs a network (Fire Up, NeuroPath, Wound.ai's cloud, HeartAngel's Firebase).
5. **Get the hospital right.** None distinguish an ER from a trauma center from urgent care.
6. **Measure themselves honestly.** None report held-out accuracy or what fails.

## 3. Winning videos: structure and pacing

Transcribed from YouTube auto-captions (fetched with `yt-dlp`). All run 2:28 to 3:00.

| | HeartAngel (2:58) | Fire Up (3:00) | Wound.ai (2:28) | NeuroPath FL-15 (3:00) |
|---|---|---|---|---|
| 0:00 | Cinematic problem + music, no presenter | Personal story (Palisades Fire) | Name, app, problem | Team names, personal impact |
| ~0:20 | Statistic: "350,000 cardiac arrests ... 73.4% in homes" | Problem framed as before / during / after | Statistic (80% of amputations follow foot ulcers) | Statistic (10 million with Parkinson's) |
| ~1:00 | Creator intro, purpose, target users | What the app is | Target users, live walkthrough | What it is: three features |
| ~1:40 | **Tools named**: "Flutter, Xcode, Google Maps API, Firebase ... Dart" | **Tech deep-dive**: "over 100 hours ... NASA FIRMS ... LightGBM ... 95% accuracy ... Raspberry Pi" | Tech: Unity, Python, ONNX, LoRA | Science of the model, then walkthrough |
| End | Practice mode, slogan | Why it is unlike existing tools | Accuracy, thanks | Tech: Roboflow, 3,157 samples, Replit |

**Lessons for our video**: hook in the first 15 seconds without narration; one sourced statistic; say purpose, audience and tools explicitly; specific numbers beat adjectives; none of the four showed code on screen, which is exactly the gap the "Code" row rewards.

## 4. Medical source of truth

Every spoken line maps to a source in `docs/MEDICAL_SOURCES.md` (generated from the protocol files). The specific numbers this spec asked us to confirm:

| Claim | Status | Source |
|---|---|---|
| Rate 100 to 120 per minute | **Confirmed** (text of the AHA's Part 7 page, via search index; the page blocks automated download) | 2025 AHA Part 7 Adult BLS, *Circulation* 2025;152(suppl 2):S448-S478 |
| Adult depth at least 2 in, not more than 2.4 in | **Confirmed**, same source and method | Part 7 |
| Full chest recoil | Reflected in the coaching; sentence not yet quoted | Part 7 |
| 30:2 for trained rescuers | **Confirmed**, quoted | 2025 Highlights |
| Hands-Only CPR coached for adults; breaths for children | **Confirmed**, quoted ("Hands-Only CPR for adults and conventional CPR, including breaths, for children") | 2025 Highlights |
| Child depth about one third of the chest (about 2 in) | **Not confirmed**, flagged for reviewer | Part 8 (pediatric) not retrieved |
| Infant: heel of one hand or two-thumb encircling, two-finger removed | **Confirmed**, quoted, and a test fails the build if "two fingers" appears | 2025 Highlights |
| Adult and child choking start with 5 back blows | **Confirmed**, quoted | 2025 Highlights, Figure 6 |
| Bra may be moved aside for AED pads | **Confirmed**, quoted | 2025 Highlights |
| Naloxone by lay rescuers; CPR with breaths in opioid arrest | **Confirmed**, quoted | 2024 AHA/Red Cross First Aid Highlights; 2025 Highlights |
| Burn cooling: cool running water, 10 min minimum, ideally 20, no ice | **Confirmed** (Red Cross page blocks downloads; read via search index) | American Red Cross Scientific Advisory Council, Burn Cooling |
| Stroke: FAST, call EMS immediately | **Confirmed**, quoted | 2024 AHA/Red Cross First Aid; MedlinePlus |

**One deliberate deviation from the spec:** the spec asked for **BE-FAST**. The 2024 AHA/Red Cross First Aid guideline recommends **FAST** or the Cincinnati scale, and the research we found (AHA newsroom, PMC12307487) reports better recall for FAST. Mayday uses FAST. Balance and eye symptoms are worth adding later as "other sudden signs".

**One conflict for the medical reviewer:** MedlinePlus says not to put a *severe* burn in cold water (shock risk); the Red Cross advisory says cool running water for all thermal burns and warns against cooling beyond 40 minutes. Mayday follows the Red Cross (running water, not immersion) and flags it.

**Blocked sources.** ahajournals.org, cpr.heart.org and redcross.org return HTTP 403 to automated downloads. 14 of 78 protocol steps are marked "awaiting review" in the app itself until a person reads the primary text in a browser.

## 5. Statistics for the problem statement (verified)

From the [CARES 2024 Metrics Summary](https://mycares.net/sitepages/uploads/2025/CARES%2020250516%202024%20Metrics%20Summary.pdf) (Cardiac Arrest Registry to Enhance Survival), read from the PDF:

- **137,119** non-traumatic, worked out-of-hospital cardiac arrests were reported to CARES in 2024.
- **71.3%** happened in a **residential** setting. (Your family, not a stranger.)
- Only **41.7%** of patients **received bystander CPR**.
- Overall **survival: 10.5%**.
- Median EMS response time: **6.4 minutes**.

Suggested on-screen line: *"7 in 10 cardiac arrests happen at home. Fewer than half get CPR from the person standing next to them." Source: CARES, 2024.*

## 6. How this changes the plan

1. **Stack: Expo instead of the August Flutter prototype.** The team writes TypeScript, not Dart; Expo Go and EAS put the app on the team's iPhones without a Mac; and `expo-glass-effect` gives real iOS 26 Liquid Glass. The Flutter prototype's research and protocol content carried over.
2. **Differentiate from HeartAngel on purpose:** lead the video with the voice triage and the citations, not the metronome.
3. **The model never writes medicine** (spec section 2) is also the strongest code story: deterministic engine, schema-checked model output, held-out accuracy, a documented failure list.
4. **FAST, not BE-FAST**, with the reason stated.
5. **The video names tools and languages out loud**: TypeScript, Python, SkSL (the orb shader), Expo, React Native, Skia, Claude, Groq. Using several text languages is a criterion on the older 2018 rubric that some districts still use.
6. **Map data from three named public sources** (CMS, Florida DOH, OpenStreetMap), so a judge can check it.
