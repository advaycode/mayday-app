# Submission answers (DRAFT)

**Rewrite every answer in your own words before submitting.** The rules require the app and the submission to be the team's own work, and judges can tell. These drafts are factual scaffolding: the numbers are real and sourced, and the places that need your voice are marked `[YOU]`.

The six questions are verbatim from the 2026 rules.

---

## 1. What is the title of your app?

Mayday

## 2. Explain the app's purpose.

Mayday talks a panicking bystander through a medical emergency, out loud and step by step, while help is on the way, even with no signal.

You hold one button and say what is happening. Mayday starts a cancellable 911 call, works out which of ten protocols fits (CPR for adults, children and babies; choking; severe bleeding; burns; stroke; opioid overdose; recovery position), and coaches you with a calm voice, one large instruction at a time, and a picture. During CPR it counts every compression at 110 a minute and tells you when to give breaths, swap rescuers, or use the AED. It shows where the nearest emergency room and trauma center are, and it keeps a timestamped log for the paramedics.

## 3. What inspired you to create this app?

`[YOU: your own story. A moment you or someone you know froze, a CPR class, a relative's emergency. Judges reward the personal reason; every winning video we studied opened with one.]`

The numbers that made it urgent: in 2024, 137,119 out-of-hospital cardiac arrests were reported to the CARES registry; 71.3% happened at home, only 41.7% of patients got CPR from a bystander, and 10.5% survived. Most people who could help don't, because nobody is standing next to them saying what to do.

## 4. What technical/coding difficulty did you face in programming your app, and how did you address this technical challenge?

`[YOU: pick ONE and tell it as a story: what broke, how you found out, what you changed.]`

**Option A: keeping the CPR beat exact.** Our first metronome used a JavaScript timer, and timers fire late by a few milliseconds every time. Over ten minutes a naive version drifted 2.2 seconds, enough to pull a rescuer below 110 a minute. We rebuilt it so that every beat's time is computed from the start (beat n is at start + n × 60/110, never "previous beat + 545 ms"), and a lookahead scheduler hands each click and spoken count to the phone's audio hardware a fifth of a second early, which plays it at exactly that time. The number on screen and the vibration read the same audio clock, so they can't disagree. A test runs ten simulated minutes with a deliberately unreliable timer: all 1,100 beats land on time.

**Option B: using AI without letting it give medical advice.** A language model improvising CPR steps is dangerous. So the AI is never allowed to write instructions: all 78 steps live in data files, each citing the guideline sentence it comes from, and tests fail the build if a step loses its source or contradicts the 2025 guidelines. The AI only does two narrow jobs, picking which protocol fits what someone said and rephrasing a cited passage, and its output has to match a strict schema or it is thrown away. A set of offline rules runs first, so a life-threat phrase starts CPR in under a millisecond without waiting for any AI. On 20 sentences it had never seen, it picked the right protocol 85% of the time and never missed someone who wasn't breathing.

## 5. What did you learn while participating in the CAC? What was your biggest takeaway?

`[YOU]` Things that are true and worth saying if they are true for you:
- Medical guidelines change: the 2025 guidelines dropped two-finger infant CPR and changed adult choking to back blows first, and most first-aid content online is out of date.
- An app that could dial 911 by mistake is dangerous, so Mayday never dials at all, and a test proves it; it hands you what the dispatcher needs instead.
- Testing what you claim (drift, accuracy on unseen data) changes what you claim.

## 6. What would you change about your app if you were to create a 2.0 version?

- Spanish (and more languages) for every protocol and voice line, a big deal in Florida.
- Accelerometer feedback on compression rate (rate is measurable with a phone; depth is not, and we would not claim it).
- More protocols: anaphylaxis with an epinephrine auto-injector, seizure, heat stroke, low blood sugar.
- Trauma center and ER data for every state.
- A lock-screen shortcut, and a version that runs on a watch.
- Formal testing with people who have never done CPR, measured on a manikin.
