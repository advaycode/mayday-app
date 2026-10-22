"""
Real breathing for the phone simulator.

    python tools/heart_ml/breathing.py      # needs data/cebsdb; writes data/resp/ (git-ignored)

The simulator's breaths are drawn by a formula. Real people breathe less
neatly: the depth wanders, there are sighs and pauses, the timing drifts.
The CEBS database has a respiration belt around the chest of the same 20
people as the heartbeat data, for up to 50 minutes each. This exports those
belts as breathing traces the simulator can play (`recorded` in
mobile/src/sensors/sim.ts), so the breathing check can be scored on real
breathing patterns through a simulated phone.

Each record's trace is band-passed to 0.05-2 Hz, turned so breathing in goes
up (breathing in is the quicker half of a breath, so the slope is steeper
going up), and scaled so a typical breath (the median peak-to-valley) is 1.
Breath peaks are found with a prominence of 30% of a typical breath, for the
true rate. Stretches where the belt jumps (more than 4 typical breaths in a
second, someone moving) are listed so they can be skipped.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks, resample_poly
from scipy.stats import skew

sys.path.insert(0, str(Path(__file__).parent))
import cebs  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FS = 25


def process(rec: Path):
    fs, sig = cebs.read_signals(rec)
    x = resample_poly(sig["RESP"] - sig["RESP"].mean(), 1, int(round(fs / FS)))
    b, a = butter(2, [0.05, 2], btype="band", fs=FS)
    x = filtfilt(b, a, x)
    flip = skew(np.diff(x)) < 0
    if flip:
        x = -x
    # A typical breath: median prominence of clear peaks.
    pk, prop = find_peaks(x, distance=int(1.5 * FS), prominence=0.2 * (np.percentile(x, 95) - np.percentile(x, 5)))
    unit = float(np.median(prop["prominences"])) if len(pk) else 1.0
    x = x / unit
    pk, _ = find_peaks(x, distance=int(1.5 * FS), prominence=0.3)
    # Movement: the belt jumping by more than 4 breaths within a second.
    jump = np.array([np.ptp(x[i : i + FS]) for i in range(0, len(x) - FS, FS)])
    bad = [int(i) for i in np.nonzero(jump > 4)[0]]
    return x.astype(np.float32), pk / FS, bad, bool(flip)


def main():
    root = ROOT / "data" / "cebsdb"
    out = ROOT / "data" / "resp"
    out.mkdir(parents=True, exist_ok=True)
    recs, dropped = cebs.load(root, cache=ROOT / "data" / "heart_ml_cache", log=lambda s: None)
    index = []
    for r in recs:
        x, peaks, bad, flip = process(root / r["name"])
        f = f"{r['name']}.f32"
        x.tofile(out / f)
        rate = 60 / float(np.median(np.diff(peaks))) if len(peaks) > 2 else None
        index.append({"name": r["name"], "subject": r["subject"], "file": f, "fs": FS, "n": int(len(x)), "peaks": [round(float(p), 3) for p in peaks], "badSeconds": bad, "flipped": flip})
        print(f"{r['name']}: {len(x) / FS / 60:.1f} min, {len(peaks)} breaths, {rate:.1f}/min, {len(bad)} s moving, {'flipped' if flip else 'as is'}")
    (out / "index.json").write_text(json.dumps(index))
    print(f"{len(index)} records, {len({e['subject'] for e in index})} people -> {out}")


if __name__ == "__main__":
    main()
