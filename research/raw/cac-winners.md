# cac-winners — What actually wins the Congressional App Challenge

Research for Mayday (CAC 2026, FL-15/FL-16). Started 2026-08-23. **WORKING DRAFT — updated as I go.**

---

## 1. THE OFFICIAL RUBRIC (primary source, extracted from PDF)

### 1a. "2021 CAC RUBRIC GUIDE" — the 30-point grid
Source: https://www.congressionalappchallenge.us/wp-content/uploads/2022/09/CAC-Judging-Rubric.pdf
(This is the file currently linked as "CAC-Judging-Rubric.pdf" from the CAC site; the document header
inside reads "2021 CAC RUBRIC GUIDE". Text extracted locally via pypdf.)

Header text verbatim:
> "This Rubric acts as a guide to structure the analysis of apps for the CAC. Split into
> the two categories of Concept and Technology, apps can be awarded up to 30 total
> points for ideology, data, technical expertise, and design. We encourage you to utilize
> this as a framework for your app."

**Two categories, 15 points each, 30 total. Six sub-criteria, each scored 1–5.**

#### CATEGORY: CONCEPT (/15)

**IDEOLOGY**
| Score | Verbatim descriptor |
|---|---|
| 1 | "Does not address an issue or a need" |
| 2 | "Briefly addresses an issue or a need" |
| 3 | "Issue or need is moderately relevant" |
| 4 | "Issue or need is relevant" |
| 5 | "Issue or need is extremely relevant" |

**IMPACT**
| Score | Verbatim descriptor |
|---|---|
| 1 | "App is unoriginal or does not aim to be impactful" |
| 2 | "Impact of app is broad and/or basic" |
| 3 | "App lacks in explaining a clear impact" |
| 4 | "App provides a strong explanation of its impact" |
| 5 | "Immense usage of creativity is featured as impact is explained" |

**STRUCTURE**  ← *this criterion grades the VIDEO, not the app*
| Score | Verbatim descriptor |
|---|---|
| 1 | "Video does not follow time limit and/or is difficult to view" |
| 2 | "Video has some technical issues, cuts, or is confusing" |
| 3 | "Video is mostly organized and explains some aspects of the app" |
| 4 | "Video is organized and explains all aspects of the app" |
| 5 | "Video is innovative and engaging" |

#### CATEGORY: TECHNOLOGY (/15)

**FUNCTION**
| Score | Verbatim descriptor |
|---|---|
| 1 | "App lacks any functionality" |
| 2 | "App contains snippets of code/action" |
| 3 | "App works, yet encounters errors" |
| 4 | "App is fully functional" |
| 5 | "App is functional with complex features" |

**CODE**  ← *this criterion also grades the VIDEO*
| Score | Verbatim descriptor |
|---|---|
| 1 | "Video does not explain code" |
| 2 | "App is not effectively explained technically" |
| 3 | "Code is partially explained with few areas of confusion/error" |
| 4 | "Code is effectively explained" |
| 5 | "Explanation of code indicates immense understanding" |

**UI**
| Score | Verbatim descriptor |
|---|---|
| 1 | "App lacks design and seems difficult to use" |
| 2 | "App is rudimentary in design and experience" |
| 3 | "App is navigable with basic access to features" |
| 4 | "App has aspects of design and navigation" |
| 5 | "App is highly innovative in design and interface" |

> **THE SINGLE BIGGEST FINDING SO FAR: 10 of the 30 points (STRUCTURE + CODE) are scored
> on the demo video itself, not the app.** You cannot win on app quality alone. A perfect
> app with a video that doesn't explain the code caps at 26/30 and probably lower.
> Note the column ordering was reconstructed from a scrambled PDF text layer; the wording
> is verbatim, the 1–5 ordering is inferred from severity (unambiguous).

### 1b. Older "Judging Guidelines & Rubric" (2018) — still hosted on the CAC site
Source: https://www.congressionalappchallenge.us/wp-content/uploads/2018/10/CAC_Rubric_2018.pdf

> "A score of 1 to 5—1 being poor, 3 being average, and 5 being superior—should be
> given across three criteria:"

1. **Concept** — "a. How creative is the idea? b. Does the app address a specific problem? If so, how creative is the solution?"
2. **Design** — "a. Did the student consider the user experience and interface? b. How intuitive is the U.I.? c. Did the student give any thought to the app design?"
3. **Skill** — verbatim scale:
   > "Rate 1 for use of 'block code' exclusively,
   > Rate 3 if the student integrated text-based code into his 'block code' app,
   > Rate 4 for use of a text-based programming language,
   > **Rate 5 for use of multiple text-based programming languages.**"

   "'Block code' includes Scratch, MIT App Inventor, Blocky."

**IMPLICATION: an explicit, mechanical bonus for using MORE THAN ONE text-based language.**
Mayday in Dart alone = 4/5 on this scale. Dart + Python (protocol compiler / build tooling)
+ Kotlin/Swift (platform channels for audio/wakelock) = 5/5. This costs nothing to satisfy
honestly and must be *named on screen* in the video.

Sample scorecard in the 2018 doc is a 3-row grid (Concept / Design / Skill), max 15.
Two different rubrics are in circulation. Districts pick.

---

## 2. THE 2026 OFFICIAL RULES (primary source)
Source: https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf
(Extracted locally via pypdf — full text obtained.)

### Deadline
> "The Congressional App Challenge will accept submissions from May 2026 – October 26th:
> **12:00 pm EDT, Monday, October 26th, 2026.**"

> "After the Submission Period has ended, the Submission cannot be modified in any way."

### DEMONSTRATION VIDEO (max 3 min) — verbatim requirement list
> "Students must create a demonstration video with the following information:
> - The name(s) of each participant
> - The name of the app
> - Clearly explain the purpose of the app (**Students should do this in one, clear sentence**)
> - Explain the app's target audience (who the app is intended for?)
> - **The tools and coding languages used to create the app**
> - Showcase the functionality of the app"

> "The video should be **1-3 minutes** long. **Video submissions which do not adhere to the
> time constraints may be penalized by the judges at their discretion.** This is not a
> video-creation competition. However, the judges view the demonstration video to learn
> about the app. The video should be as clear and compelling as possible."

> "Upload the completed video to YouTube or Vimeo. The video must be set to 'public'."

**Note: the rules do NOT require showing code, but the 2021 rubric's CODE criterion scores
"Video does not explain code" = 1/5. The rules and the rubric disagree; satisfy the rubric.**

### The six written questions (verbatim)
> "1. What is the title of your app?
> 2. Explain the app's purpose.
> 3. What inspired you to create this app?
> 4. What technical/coding difficulty did you face in programming your app, and how did you address this technical challenge?
> 5. What did you learn while participating in the CAC? What was your biggest takeaway?
> 6. What would you change about your app if you were to create a 2.0 version?"

### Winner Selection (verbatim)
> "1. Demonstration Videos and Submission Answers will be reviewed and evaluated by the
> Member of Congress and their office. Members of Congress may opt to use a panel of
> judges to evaluate applications."

> "2. Apps can be judged based on the following criteria:
> a. Quality of the idea (including creativity and originality)
> b. Implementation of the idea (including user experience and design)
> c. Demonstrated excellence of coding and programming skills."

> "3. **The Judges have the right to request access to the App and source code** in person or
> via any reasonable manner to verify that the App functions and operates as stated in the
> Submission Form. **Failure by a Contestant to honor such a request will result in the
> Submission's immediate disqualification.**"

> "4. Members of Congress and their staff reserve the right to substitute or modify the
> judging process or criteria at any time for any reason. Judging is to be fair and impartial
> but left entirely to the discretion of the Member of Congress."

> "5. **Odds of winning depend on the number of eligible Submissions received and the quality
> of the Submissions.**"

### AI USAGE (verbatim) — critical for Mayday
> "AI USAGE: The use of AI tools in app development for the Congressional App Challenge is
> permitted, provided that **all AI usage is fully disclosed in the submission materials**.
> AI may only be used to support specific aspects of the project and **must not constitute
> the entirety of the technical development**. Participants are expected to demonstrate
> significant individual contributions and technical understanding of their app."

### ORIGINALITY (verbatim)
> "The app must be original and solely created by the contestant. All coding and technical
> development must be done by the student or student team. While participants may use
> open-source libraries, frameworks, and external tools, **they must clearly document any
> such usage** and ensure their project reflects significant personal effort and technical
> understanding. No other party should have any rights or interest in the app."

### Eligibility / other
- Enrolled in middle or high school on October 26th, 2026.
- Compete in district where you **reside OR attend school**. One district only.
- Teams of up to 4. "At least half of teammates on any team must live or attend school in the same Congressional District."
- **PRIOR PROJECTS: "Students may submit any app they've created after October 30th, 2025.
  If submitting a 2.0 version of an app, only the new coding should be highlighted for consideration."**
- ONE entry per person per year.
- Registration needs a **personal (non-school) email**, 9-digit ZIP, parent/guardian contact.
- Embargo: CAC cannot disclose results before **January 15, 2027**. Members announce themselves.
- Prizes: featured on House.gov + CongressionalAppChallenge.us; ARTS ACT copyright fee waiver.

---

## TODO / still to research
- [ ] 2025 winners gallery — names, apps, districts, count
- [ ] Participation stats (13,830 students / 4,650 apps / 394 districts for 2025 — needs primary confirmation)
- [ ] Health/safety/emergency winning apps
- [ ] Demo video craft patterns — actual winner videos
- [ ] FL-15 / FL-16 specifics
- [ ] House of Code / #HouseOfCode showcase
