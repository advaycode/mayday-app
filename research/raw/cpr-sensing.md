# cpr-sensing — Measuring CPR compression rate & depth from a smartphone accelerometer

Research for Mayday (Congressional App Challenge 2026). Session date: 2026-08-23.
STATUS: IN PROGRESS — being rewritten as sources are read.

---

## 1. Core literature: accelerometer-only rate & depth

### Ruiz de Gauna et al., PLOS ONE 2016 — "Feedback on the Rate and Depth of Chest
### Compressions during CPR Using Only Accelerometers"
URL: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0150139
(PMC mirror PMC4773040 — captcha-blocked this session, PLOS copy read directly.)

THE most directly relevant paper. Compares three accelerometer-only algorithms.

Hardware / setup:
- Tri-axial accelerometer **ADXL330 (Analog Devices)**, **100 Hz**, **16-bit** resolution.
- Sensor placed **beneath the rescuer's hands** on the manikin chest (i.e. sandwich position —
  NOT loose in a pocket, NOT in-hand).
- Ground truth: photoelectric **displacement sensor**.
- Surface: **Resusci Anne manikin on a rigid surface**. Not a soft/mattress surface.

Three algorithms:
1. **LF — Linear Filtering.** Band-pass filter + trapezoidal-rule double integration.
   Response matches ideal above **0.6 Hz**.
2. **ZCV — Zero-Crossing Velocity.** Band-pass, find zero crossings of the velocity signal,
   depth = area between compression onset and max displacement. This is the "boundary
   condition per compression cycle" trick that stops drift accumulating across cycles.
3. **SA — Spectral Analysis.** FFT over an analysis window of duration Tw; reconstruct the
   periodic displacement using the **first three harmonics**. Avoids integration entirely.

Reported accuracy (median, IQR):

| Method | Depth error % | Depth error abs | Rate error % | Rate error abs |
|---|---|---|---|---|
| LF  | 5.9% (2.8–10.3) | 3.1 mm (1.5–5.4) | 1.7% (0.0–2.3) | 1.7 cpm (0.0–3.1) |
| ZCV | 6.3% (2.9–11.3) | 3.4 mm (1.5–6.0) | 0.0% (0.0–2.0) | 0.0 cpm (0.0–2.3) |
| SA  | **2.5% (1.2–4.4)** | **1.3 mm (0.6–2.3)** | 0.9% (0.4–1.6) | 0.9 cpm (0.0–3.1) |

KEY READ: **rate is essentially solved** (median error 0–1.7 cpm across all three methods).
**Depth is only good under laboratory conditions** — sensor bonded to a rigid manikin chest,
100 Hz clean 16-bit sensor, rigid backing surface. Spectral analysis beats double integration
roughly 2x on depth.

Stated error sources for double integration (quoted/paraphrased):
- "integration is a process inherently unstable: the accumulation" of error over time
- baseline offset in acceleration → **error grows quadratically with time**
- velocity imbalance across compression cycles

---

## 2. Flutter: what sensors_plus actually delivers

### pub.dev/packages/sensors_plus
URL: https://pub.dev/packages/sensors_plus
- **Version 7.1.0**, published ~58 days before 2026-08-23 (≈late June 2026). Actively maintained.
- Publisher: fluttercommunity.dev (verified publisher).
- Licence: **BSD-3-Clause**.
- Requires **Flutter ≥3.19.0, Dart ≥3.3.0 <4.0.0**.

Streams:
- `accelerometerEventStream()` — raw, **includes gravity** (~9.8 m/s² on the vertical axis at rest).
- `userAccelerometerEventStream()` — **gravity filtered out** by the platform.
  (Android: TYPE_LINEAR_ACCELERATION; iOS: CoreMotion userAcceleration.)
- Every stream accepts a `samplingPeriod` — predefined `SensorInterval` constants or a custom
  `Duration`.

CRITICAL LIMITATION, quoted from the README:
> "On Android it is not guaranteed that events from sensors will arrive with specified
> sampling rate" — varies by Android version, device hardware, and vendor customisation.

Web: sampling rate cannot be set at all. iOS barometer interval is ignored (CMAltimeter).

Practical rate reports: Android default `SENSOR_DELAY_NORMAL` ≈ **5 Hz**; iOS default reported
around **100 Hz**. You MUST explicitly request a fast samplingPeriod on Android or you get 5 Hz,
which is useless for CPR (Nyquist: 2 Hz compressions need ≫4 Hz).

### Open issues on sensors_plus (GitHub API query, 2026-08-23)
Only **6 open issues** total across the whole package — a genuinely healthy package.
- #3955 (2026-08-05) — **[Bug] termination crash** on Mac Catalyst/iOS: "Sending a message
  before the FlutterEngine has been run"; motion stream handlers post to a destroyed engine.
  Relevant to us: we must cancel sensor subscriptions in `dispose()` / on app teardown.
- #2962 request: gravity-acceleration stream
- #2521 request: background operation on Android  ← relevant, see below
- #1954, #1551, #660 — feature requests (gyro absolute values, rotation, Linux support)

No open issues about sampling-rate inaccuracy or data corruption. Good sign.

TODO: Android 12 HIGH_SAMPLING_RATE_SENSORS permission; iOS CoreMotion max rate; smartphone
validation papers; microphone tempo; mattress compliance; verdict.
