"""
Exact Python copy of the app's signal kit (mobile/src/sensors/dsp.ts) and of
the heartbeat model's input preparation (mobile/src/sensors/beatnet.ts).

The model is trained on what these functions produce, and the app feeds it
what the TypeScript versions produce, so the two must match sample for
sample. tools/heart_ml/train.py writes a fixture the app's tests compare
against.
"""
import math

import numpy as np
from scipy.signal import lfilter, lfilter_zi

BUTTER4_Q = (0.5411961, 1.3065630)
MODEL_FS = 100


def js_round(v: float) -> int:
    """JavaScript's Math.round (halves go up), not Python's banker's rounding."""
    return int(math.floor(v + 0.5))


def section(kind: str, fc: float, fs: float, q: float):
    w = 2 * math.pi * min(fc, fs * 0.49) / fs
    cos = math.cos(w)
    alpha = math.sin(w) / (2 * q)
    a0 = 1 + alpha
    if kind == "low":
        b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
    else:
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
    return np.array(b) / a0, np.array([1.0, -2 * cos / a0, (1 - alpha) / a0])


def butter4(kind: str, fc: float, fs: float):
    return [section(kind, fc, fs, q) for q in BUTTER4_Q]


def run(sections, x: np.ndarray) -> np.ndarray:
    """Each section starts in steady state on the first sample (as in dsp.ts)."""
    y = np.asarray(x, dtype=np.float64)
    for b, a in sections:
        if len(y) == 0:
            return y
        y = lfilter(b, a, y, zi=lfilter_zi(b, a) * y[0])[0]
    return y


def filtfilt(sections, x, pad_samples: int = 0, anchor: int = 10) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    n = len(x)
    if n == 0:
        return x
    pad = max(0, min(n - 1, pad_samples))
    k = max(1, min(anchor, n // 4))
    a0 = x[:k].mean()
    a1 = x[n - k:].mean()
    head = 2 * a0 - x[pad - np.arange(pad)] if pad else np.empty(0)
    tail = 2 * a1 - x[n - 2 - np.arange(pad)] if pad else np.empty(0)
    ext = np.concatenate([head, x, tail])
    fwd = run(sections, ext)[::-1]
    back = run(sections, fwd)[::-1]
    return back[pad:pad + n]


def lowpass(x, fc, fs):
    return filtfilt(butter4("low", fc, fs), x, js_round(3 * fs / fc), js_round(fs / (4 * fc)))


def highpass(x, fc, fs):
    return filtfilt(butter4("high", fc, fs), x, js_round(3 * fs / fc), js_round(fs / 10))


def bandpass(x, lo, hi, fs):
    return lowpass(highpass(x, lo, fs), hi, fs)


def to_model_rate(x, fs: float) -> np.ndarray:
    """Linear interpolation onto the model's 100 samples a second (as dsp.ts `resample`)."""
    x = np.asarray(x, dtype=np.float64)
    if fs == MODEL_FS:
        return x
    t = np.arange(len(x)) / fs
    n = int(math.floor(t[-1] * MODEL_FS)) + 1
    return np.interp(np.arange(n) / MODEL_FS, t, x)


def features(z, rot=None, fs: float = MODEL_FS) -> np.ndarray:
    """
    The model's input: the out-of-screen acceleration band-passed to the
    heart's 5-25 Hz, and (if given) the size of the rotation rate in the same
    band; each divided by its own mean size so the model sees shape, not
    strength.
    """
    z = to_model_rate(z, fs)
    bz = bandpass(z, 5, 25, MODEL_FS)
    chans = [bz / (np.mean(np.abs(bz)) + 1e-9)]
    if rot is not None:
        br = [bandpass(to_model_rate(c, fs), 5, 25, MODEL_FS) for c in rot]
        m = np.sqrt(sum(c * c for c in br))
        chans.append(m / (np.mean(m) + 1e-9))
    return np.stack(chans).astype(np.float32)
