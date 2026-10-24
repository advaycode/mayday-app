# CAC rubric check

Checked October 23, 2026, against the CAC's own documents (`research/findings.md` section 1):

- **2026 rules**: judges *may* use (1) quality of the idea, (2) implementation (user experience and design), (3) excellence of coding. Each district can change its process.
- **Rubric guide** ("2021 CAC RUBRIC GUIDE", still published): six rows scored 1 to 5, 30 points. Two rows grade the **video**.

Status: **Strong** = top-score wording met, with evidence a judge can check. **You** = only the team can do it. **Gap** = not done yet.

## The six rubric rows

| Row | Top score (verbatim) | Status | Evidence | Left to do |
|---|---|---|---|---|
| **Ideology** | "Issue or need is extremely relevant" | Strong | Cardiac arrest at home, CPR rates and survival (CARES 2024, `research/findings.md` section 5). Map: **Lagos, where the bystander is the ambulance**: 8.7% of Africans covered by any EMS (Mould-Millman 2017), 53% of Lagos road-crash calls unanswered (Venkatraman 2020), bystander CPR doubles survival (Song 2018) | Say the numbers in the video's first 30 s (script 0:15) |
| **Impact** | "Immense usage of creativity is featured as impact is explained" | Strong | Anyone, no training, no account, offline. Florida *and* Lagos (112, 514 places, sourced "why here" card). Understands many Englishes (dialect set 45/45, held-out 17/20). Severity grading, quick guides for seizures, allergic reactions, low sugar, heat stroke, chest pain | Add the optional Lagos beat in the video (script, 2:30 section). Use "low-resource" or "places with little ambulance coverage", not "third world" |
| **Structure** (video) | "Video is innovative and engaging" | **Gap** | Script and shot list ready (`video/script.md`, `video/shot-list.md`): cold open on the app's own count, 3:00 cap | **Film Sat Oct 24, edit Sun Oct 25.** Real footage only |
| **Function** | "App is functional with complex features" | Strong | Voice triage with N-best recognition and dialect handling; audio-clock CPR coach (0 ms drift over 10 min); breathing check from the phone's tilt and gyroscope (Breathe tab, live 00.00° angles); CPR pace from the accelerometer; gasp hearing; severity grading 1-3 and burn degree; 911/112 script by voice (never dials); trauma-aware map, two regions; offline iPhone web app (crawled, works in airplane mode); 354 tests | **Run it once on a real phone** (nothing has touched hardware). Record the novice time (script 2:20 `[NOVICE TIME]`) |
| **Code** (video) | "Explanation of code indicates immense understanding" | Ready, **You** | Script 1:45-2:30: rules before AI, data-with-sources protocol, audio-clock scheduler, live Engine panel (Ctrl+Shift+E). Good extra snippets: `voice/understand.ts` (never take a runner-up guess that reassures), `triage/severity.ts` (only moves toward more care) | Rehearse until you can explain each snippet without notes: judges listen for understanding, not reading |
| **UI** | "App is highly innovative in design and interface" | Strong | Liquid Glass (Breathe lens, tab bar, sheets), emergency mode in 128 pt type, one picture card per step with simple animations, 9-20 words a screen, contrast-checked colors | — |

## The 2026 rules

| Requirement | Status | Where |
|---|---|---|
| Video 1-3 minutes, public on YouTube or Vimeo | **Gap** | Film and upload; text in `video/youtube.md` |
| Video says: participant names, app name, purpose in one sentence, target audience, **tools and coding languages**, shows functionality | Scripted (✓ marks in `video/script.md`) | Fill `[NAMES]`. Say the languages out loud: TypeScript, Python, SkSL |
| **AI disclosure**, "fully disclosed"; AI must not be the entirety of the development | **You** | `submission/ai-disclosure.md`: fill every `[TEAM]` cell honestly (what you designed, decided, tested, rewrote) |
| Submission answers in your own words | **You** | `submission/answers.md` drafts are scaffolding. Rewrite every `[YOU]` |
| Source code and app on request | Ready | Repo runs (`npx expo export -p web`, `mirror/launch.ps1`); iPhone web app in `mobile/dist-iphone`. Deploy it (`gh auth login`, then `python tools/deploy_iphone.py`) so a judge can open a link |
| Prior work only from October 30, 2025 | OK | All of `mobile/` is from October 2026; the August prototype is within the window |

## Before submitting (by 9:00 am Monday October 26)

1. Film and edit the video (Structure and Code rows are a third of the points).
2. Real-phone run and the novice test (a number for the video).
3. A CPR or first-aid instructor reviews `docs/MEDICAL_SOURCES.md` (14 steps), `docs/SEVERITY.md` and the 5 quick guides.
4. Rewrite the answers and the AI disclosure in your own words.
5. Deploy the iPhone web app and put the link in the submission.
