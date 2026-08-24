# Mayday — Regulatory & Legal Constraints (raw research notes)

Research key: `legal-regulatory`
Started 2026-08-23. **WORKING DRAFT — updated as sources are read.**

Rule for this file: every claim carries the URL actually fetched. Verbatim quotes are in
blockquotes and marked `VERBATIM`. Anything not verbatim-sourced is marked `[inference]`.

---

## 1. FDA — Policy for Device Software Functions and Mobile Medical Applications

**Source (fetched, full 45-page PDF):** https://www.fda.gov/media/80958/download
Title page: *"Policy for Device Software Functions and Mobile Medical Applications —
Guidance for Industry and Food and Drug Administration Staff. Document issued on
September 28, 2022. Document originally issued on September 25, 2013. This document
supersedes 'Policy for Device Software Functions and Mobile Medical Apps' issued
September 27, 2019."*

Note: the fda.gov HTML pages 404 against WebFetch; the `/media/80958/download` PDF
endpoint works via curl with a browser UA. Text extracted with pypdf.

### 1.1 The three-bucket structure

The guidance sorts software into three buckets, each with its own appendix:

| Appendix | Bucket | Consequence |
|---|---|---|
| **A** | Software functions that are **NOT medical devices** | No FDA regulation at all. No registration, no 510(k), no QSR. |
| **B** | MAY meet the device definition, but **enforcement discretion** | Device on paper; FDA does not enforce "at this time". |
| **C** | **Focus of FDA's regulatory oversight** | Real device. Registration, listing, QSR/QMSR, 510(k) or PMA. |

VERBATIM (p.2 of guidance / PDF p.6):
> "Many software functions are not medical devices (meaning such software functions do not
> meet the definition of a device under section 201(h) of the Federal Food, Drug, and
> Cosmetic Act (FD&C Act)), and FDA does not regulate them as devices. Some software
> functions may meet the definition of a medical device, but because they pose a lower risk
> to the public, FDA intends to exercise enforcement discretion over these devices (meaning
> it does not, at this time, intend to enforce requirements under the FD&C Act)."

VERBATIM (p.2):
> "Consistent with FDA's existing oversight approach that considers functionality of the
> software rather than platform, FDA intends to apply its regulatory oversight to only those
> software functions that are medical devices and whose functionality could pose a risk to a
> patient's safety if the device were to not function as intended."

Guidance is **nonbinding**. VERBATIM (p.3):
> "In general, FDA's guidance documents do not establish legally enforceable
> responsibilities. Instead, guidances describe the Agency's current thinking on a topic and
> should be viewed only as recommendations, unless specific regulatory or statutory
> requirements are cited. The use of the word should in Agency guidances means that
> something is suggested or recommended, but not required."

Every page is headed **"Contains Nonbinding Recommendations."**

### 1.2 *** THE HEADLINE FINDING FOR MAYDAY ***

**Appendix A, item 1** — software functions that are NOT devices — lists, verbatim among
its examples:

> "o Encyclopedia of first-aid or emergency care information;"

Full context, VERBATIM (Appendix A ¶1, guidance p.17 / PDF p.21):
> "1. **Software functions that are intended to provide access to electronic "copies"
> (e.g., e-books, audio books) of medical textbooks or other reference materials with
> generic text search capabilities** – These are not devices because the software is
> intended to be used as reference material and is not intended for use in the diagnosis of
> disease or other conditions, or in the cure, mitigation, treatment, or prevention of
> disease by facilitating a health professional's assessment of a specific patient, replacing
> the judgment of clinical personnel, or performing any clinical assessment. Examples of
> these types of software functions include:
>  o Medical dictionaries;
>  o Electronic copies of medical textbooks or literature articles such as the Physician's
>    Desk Reference or Diagnostic and Statistical Manual of Mental Disorders (DSM);
>  o Library of clinical descriptions for diseases and conditions;
>  o **Encyclopedia of first-aid or emergency care information;**
>  o Medical abbreviations and definitions; and
>  o Translations of medical terms across multiple languages."

**Appendix A, item 3** — general patient education / access to reference info — lists,
VERBATIM (guidance p.18 / PDF p.22):
> "3. **Software functions that are intended for general patient education and facilitate
> patient access to commonly used reference information** – This software can be
> patient-specific (i.e., filters information to patient-specific characteristics), but is
> intended for increased patient awareness, education, and empowerment, and ultimately
> supports patient-centered health care. These functions are not devices because they are
> intended generally for patient education, and are not intended for use in the diagnosis of
> disease or other conditions, or in the cure, mitigation, treatment, or prevention of disease
> by aiding clinical decision-making (i.e., to facilitate a health professional's assessment of
> a specific patient, replace the judgment of a health professional, or perform any clinical
> assessment). Examples include software functions that:
>  ...
>  o **Provide tutorials or training videos on how to administer first-aid or CPR;**
>  ...
>  o Find the closest medical facilities and doctors to the user's location;
>  o **Provide lists of emergency hotlines and physician/nurse advice lines;** ..."

Note the *"can be patient-specific (i.e., filters information to patient-specific
characteristics)"* clause — FDA explicitly permits **filtering** reference content to the
situation without leaving Appendix A. That is exactly what a protocol picker does.

**Appendix A, item 2** even blesses CPR training simulation, VERBATIM (PDF p.22):
> "o Games that simulate various cardiac arrest scenarios to train health professionals in
> advanced cardiopulmonary resuscitation (CPR) skills."

**Reading:** Mayday's core — a fixed corpus of established first-aid/emergency protocol
text, selected by situation and read aloud — sits in **Appendix A**. It is not a device at
all. It does not even need the weaker Appendix B enforcement-discretion shelter. This is a
*much* stronger position than "FDA won't bother us."

### 1.3 *** THE HEADLINE RISK FOR MAYDAY: sensor-based CPR feedback is a REGULATED DEVICE ***

**Appendix C** (focus of FDA regulatory oversight), VERBATIM (guidance p.26 / PDF p.30):
> "· **Software functions that use a sensor or electrode attached to the mobile platform or
> tools within the mobile platform itself (e.g., accelerometer) to measure physiological
> parameters during CPR and give feedback about the quality of CPR being delivered.
> Possible product code: LIX (21 CFR 870.5210).**"

Appendix C preamble, VERBATIM (PDF p.30):
> "This Appendix provides examples of software functions that are considered medical devices
> (i.e., device software functions), and on which FDA will focus its regulatory oversight.
> This software meets the definition of a device under section 201(h) of the FD&C Act and
> its functionality poses a risk to a patient's safety if the software were to not function as
> intended."

**BUILD RULE (hard):** Mayday must NOT use the accelerometer, microphone, or camera to
*measure* compression rate/depth and *grade* the rescuer's CPR. That single feature moves
the app from Appendix A (unregulated) to Appendix C (regulated device, product code LIX,
21 CFR 870.5210, 510(k) territory). A **metronome** — an open-loop 100–120 bpm audio/haptic
tick with no sensing and no feedback about quality — does not measure anything and stays
outside Appendix C. Ship the metronome. Do not ship compression-depth detection.

### 1.4 Appendix B — enforcement discretion (the fallback shelter)

Appendix B preamble, VERBATIM (guidance p.24 / PDF p.28):
> "This Appendix provides examples of software functions that MAY meet the definition of
> medical device but for which FDA intends to exercise enforcement discretion. These
> software functions may be intended for use in the diagnosis of disease or other conditions,
> or in the cure, mitigation, treatment, or prevention of disease. Even though this software
> MAY meet the definition of medical device, FDA intends to exercise enforcement discretion
> for these types of software functions because they pose lower risk to the public."

Items directly relevant to Mayday's Tier B routing and the 911 button, VERBATIM:
> "6. Software functions that use patient characteristics such as age, sex, and behavioral
> risk factors to provide patient-specific screening, counseling, and preventive
> recommendations from well-known and established authorities."
>
> "7. Software functions that use a checklist of common signs and symptoms to provide a list
> of possible medical conditions and advice on when to consult a health care professional."
>
> "8. Software functions that guide a user through a questionnaire of signs and symptoms to
> provide a recommendation for the type of health care facility most appropriate to their
> needs."
>
> "9. Software functions that are intended to allow a user to initiate a pre-specified nurse
> call or emergency call using broadband or cellular phone technology."
>
> "10. Software functions that enable a patient or caregiver to create and send an alert or
> general emergency notification to first responders."

**Reading:** Mayday's Tier B symptom router is item 7/8 at worst — enforcement discretion,
not enforcement. The one-tap 911 dialer is items 9 and 10 — explicitly discretionary.
Note item 6's phrase *"from well-known and established authorities"* — FDA rewards citing
AHA/Red Cross rather than inventing content. That aligns the regulatory argument with the
citation strategy in §6 below.

Note also that Appendix B item 7's safe harbor is "**possible** medical conditions and
advice on **when to consult**" — a *list* plus a *referral*, not a single confident answer
and not a treatment. [inference] If Tier B ever renders one definite condition name as a
verdict, it drifts toward device territory. Present routing as "this looks like it may be
X — here is the X protocol; EMS is on the way", never "you have X."

### 1.5 Device definition and the role of INTENDED USE

VERBATIM (guidance p.6 / PDF p.10):
> "The intended use of a mobile app determines whether it meets the definition of a 'device.'
> As stated in 21 CFR 801.4, intended use may be shown by labeling claims, advertising
> materials, or oral or written statements by manufacturers or their representatives. When
> the intended use of a mobile app is for the diagnosis of disease or other conditions, or the
> cure, mitigation, treatment, or prevention of disease, or is intended to affect the structure
> or any function of the body of man, the mobile app is a device under section 201(h) of the
> FD&C Act if it is not a software function excluded from the device definition by section
> 520(o) of the FD&C Act."

Device definition footnote 19, VERBATIM (PDF p.9):
> "That provision defines a device as '…an instrument, apparatus, implement, machine,
> contrivance, implant, in vitro reagent, or other similar or related article, including any
> component, part, or accessory', that is '… intended for use in the diagnosis of disease or
> other conditions, or in the cure, mitigation, treatment, or prevention of disease, in man …'
> or '… intended to affect the structure or any function of the body of man or other
> animals…' and 'does not include software functions excluded pursuant to section 520(o)'
> of the FD&C Act."

**BUILD RULE:** Because intended use is established by *"labeling claims, advertising
materials, or oral or written statements,"* Mayday's App Store copy, website, README,
demo video narration, and CAC submission text are all legally load-bearing. Marketing the
app as "diagnoses your emergency" or "tells you what's wrong" would *create* a device
intended use that the code itself does not have. Every public description must say
**guides / instructs / reads you established first-aid steps / helps you act until EMS
arrives** — never diagnose, detect, assess, or treat.

The LED example makes the point, VERBATIM (PDF p.10):
> "If the manufacturer intends the system to illuminate objects generally (i.e., without a
> specific medical device intended use), the mobile app would not be considered a medical
> device. If, however, through marketing, labeling, and the circumstances surrounding the
> distribution, the mobile app is promoted by the manufacturer for use as a light source for
> doctors to examine patients, then the intended use of the light source would be similar to
> a conventional device such as an ophthalmoscope."

Same software. Different words. Different regulatory status. That is the whole game.

### 1.6 21st Century Cures Act §3060 / FD&C Act §520(o)

VERBATIM (guidance p.4 / PDF p.8):
> "Additionally, the Cures Act, enacted on December 13, 2016, amended section 520 of the
> FD&C Act to remove certain software functions from the definition of device (201(h) of the
> FD&C Act). FDA has published the following guidance documents that help provide clarity
> on the types of software functions that do not meet the definition of device:
> · Changes to Existing Medical Software Policies Resulting from Section 3060 of the 21st
>   Century Cures Act
> · Clinical Decision Support Software
> · Medical Device Data Systems, Medical Image Storage Devices, and Medical Image
>   Communications Devices
> · General Wellness: Policy for Low Risk Devices"

VERBATIM (guidance p.2 / PDF p.6):
> "This guidance was also updated on September 27, 2019, to be consistent with section
> 3060(a) of the 21st Century Cures Act (Cures Act), which amended section 520 of the FD&C
> Act, removing certain software functions from the definition of device in section 201(h) of
> the FD&C Act."

Related final rule cited: **"Medical Devices; Medical Device Classification Regulations To
Conform to Medical Software Provisions in the 21st Century Cures Act" (86 FR 20278)**,
https://www.federalregister.gov/documents/2021/04/19/2021-07860/medical-devices-medical-device-classification-regulations-to-conform-to-medical-software-provisions

*TODO: pull §520(o)(1)(A)–(E) statutory text verbatim; pull the CDS guidance four criteria.*

---

## STATUS / TODO
- [x] FDA MMA guidance Sept 28 2022 — full text obtained and mined
- [ ] FD&C Act §520(o) statutory text verbatim
- [ ] FDA CDS Software guidance (Sept 2022) four criteria
- [ ] Apple App Store Review Guideline 1.4.1 + 5.1.3 medical
- [ ] Google Play health/medical policy
- [ ] Fla. Stat. 768.13, 768.1325, 893.21
- [ ] Red Cross / comparable app disclaimers verbatim
- [ ] Privacy: on-device storage, BIPA, COPPA
- [ ] Copyright: AHA/Red Cross protocol text, idea/expression
