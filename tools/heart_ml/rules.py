"""
Python copy of the app's heartbeat logic (mobile/src/sensors/heart.ts):
the rule-based reader (the baseline the model has to beat) and the checks a
real heartbeat passes, which the model's beats go through too.
"""
import math

import numpy as np

from dsp import bandpass, js_round, lowpass

MIN_BPM, MAX_BPM, MIN_CONFIDENCE = 40, 180, 0.45


def envelope_of(channels, fs):
    bands = [bandpass(c, 5, min(25, fs * 0.45), fs) for c in channels]
    mag = np.sqrt(sum(b * b for b in bands))
    return lowpass(mag, 4, fs)


def beats_reading(kept, env, n, fs, lag, confidence, source):
    kept = sorted(kept)
    intervals = []
    for a, b in zip(kept, kept[1:]):
        d = b - a
        if 0.7 * lag <= d <= 1.3 * lag:
            intervals.append(d / fs * 1000)
    per_min = 60000 / float(np.median(intervals)) if intervals else 60 * fs / lag
    steady = len(intervals) >= 4 and np.std(intervals, ddof=1) / np.mean(intervals) < 0.15
    heights = [env[i] for i in kept]
    even = len(heights) >= 4 and np.std(heights, ddof=1) / np.mean(heights) < 0.4
    covered = len(kept) >= 0.6 * (n / lag)
    edges = [kept[0] if kept else n] + [b - a for a, b in zip(kept, kept[1:])] + [n - (kept[-1] if kept else 0)]
    unbroken = max(edges) <= 2.5 * lag
    found = bool(confidence >= MIN_CONFIDENCE and steady and even and covered and unbroken)
    return {"found": found, "perMin": per_min if found else None, "confidence": confidence, "source": source, "beats": kept}


def from_envelope(env, fs, source):
    e = env - env.mean()
    n = len(e)
    e0 = float(e @ e)
    if e0 == 0:
        return {"found": False, "perMin": None, "confidence": 0, "source": source, "beats": []}
    min_lag = js_round(60 / MAX_BPM * fs)
    max_lag = min(n - 1, js_round(60 / MIN_BPM * fs))
    r = np.array([float(e[: n - lag] @ e[lag:]) / e0 * (n / (n - lag)) for lag in range(max_lag + 1)])
    best = min_lag + int(np.argmax(r[min_lag : max_lag + 1]))
    lag = best
    for l in range(min_lag + 1, best):
        if r[l] >= 0.8 * r[best] and r[l] >= r[l - 1] and r[l] >= r[l + 1]:
            lag = l
            break
    confidence = float(max(0.0, min(1.0, r[lag])))
    cand = [(i, env[i]) for i in range(1, n - 1) if env[i] > env[i - 1] and env[i] >= env[i + 1]]
    cand.sort(key=lambda c: -c[1])
    top = cand[: max(1, js_round(n / lag))]
    floor = 0.5 * np.mean([v for _, v in top]) if top else 0
    gap = 0.6 * lag
    kept = []
    for i, v in cand:
        if v < floor:
            break
        if all(abs(k - i) >= gap for k in kept):
            kept.append(i)
    return beats_reading(kept, env, n, fs, lag, confidence, source)


def rules_heart(z, fs, rot=None):
    """The app's rule-based reader: best of vibration, rotation and both."""
    vib = envelope_of([z], fs)
    tries = [from_envelope(vib, fs, "vibration")]
    if rot is not None:
        turn = envelope_of(rot, fs)
        tries.append(from_envelope(turn, fs, "rotation"))
        mv = float(np.median(vib)) or 1.0
        mt = float(np.median(turn)) or 1.0
        tries.append(from_envelope(vib / mv + turn / mt, fs, "both"))
    found = [t for t in tries if t["found"]]
    return max(found or tries, key=lambda t: t["confidence"])


MIN_GAP_S = 0.33
THRESHOLD = 0.5


def model_beats(prob, fs, source):
    """Beats from the model's per-sample probability, through the same checks."""
    n = len(prob)
    cand = [(i, prob[i]) for i in range(1, n - 1) if prob[i] > THRESHOLD and prob[i] > prob[i - 1] and prob[i] >= prob[i + 1]]
    cand.sort(key=lambda c: -c[1])
    gap = js_round(MIN_GAP_S * fs)
    kept = []
    for i, _ in cand:
        if all(abs(k - i) >= gap for k in kept):
            kept.append(i)
    kept.sort()
    lag = float(np.median(np.diff(kept))) if len(kept) >= 2 else float(fs)
    confidence = float(np.mean([prob[i] for i in kept])) if kept else 0.0
    return beats_reading(kept, prob, n, fs, lag, confidence, source)


def match(pred_s, ref_s, tol=0.1):
    """One-to-one matching within tol seconds: true positives, predictions, references."""
    pred = sorted(pred_s)
    ref = sorted(ref_s)
    used = set()
    tp = 0
    for p in pred:
        best, bi = None, None
        for j, r in enumerate(ref):
            if j in used:
                continue
            d = abs(p - r)
            if d <= tol and (best is None or d < best):
                best, bi = d, j
        if bi is not None:
            used.add(bi)
            tp += 1
    return tp, len(pred), len(ref)
