"""
Real chest compressions for scoring the phone's compression reader.

    python tools/cpr_data.py      # needs data/cprdat (below); writes data/cpr/ (git-ignored)

Source: CPRDAT, University of Graz (Zenodo record 5497700, CC BY 4.0;
Orlob S, Kern WJ, Alpers B, et al., "Chest compression fraction
calculation: a new, automated method to precisely identify periods of chest
compressions from defibrillator data", Resuscitation, in press at release). Five real
out-of-hospital resuscitations: the defibrillator's chest accelerometer at
250 samples a second, and the periods of chest compressions marked by
experienced physicians. Download Exemplary_Cases.zip from
https://zenodo.org/records/5497700 into data/cprdat/ and unzip it.

The accelerometer's unit is not published. It is calibrated here by
assuming the median compression is 5 cm deep (the guideline depth, and
close to what real resuscitations measure): each 5 s of compressions gives
its rate f and the size A of the motion at that rate, and a sinusoid of
depth D at f has acceleration amplitude (2πf)²·D/2. So the scale is set so
the median depth comes out 5 cm. Treat every mg figure from it as ±25%.

Writes, per case: the acceleration in g at 100 a second (float32), the
physician-marked compression periods, and reference compression times
found in the full-strength signal (one sharp peak per compression), for the
true rate.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, find_peaks, resample_poly

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "cprdat" / "Exemplary_Cases"
OUT = ROOT / "data" / "cpr"
FS = 100
DEPTH_M = 0.05
G = 9.80665


def main():
    if not SRC.exists():
        sys.exit(f"Missing {SRC}: see this file's docstring.")
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for case in sorted(SRC.glob("Case_*")):
        d = pd.read_csv(case / "Accelerometer.csv")
        t = d.iloc[:, 0].to_numpy(float)
        a = d.iloc[:, 1].to_numpy(float)
        fs0 = 1 / np.median(np.diff(t))
        ann = pd.read_csv(case / "Ann_CC-periods.csv")
        periods = [(float(s) - t[0], float(e) - t[0]) for s, e in zip(ann["CC-period-start"], ann["CC-period-stop"])]
        x = resample_poly(a - np.median(a), FS, int(round(fs0)))
        tt = np.arange(len(x)) / FS
        on = np.zeros(len(x), bool)
        for s, e in periods:
            on |= (tt >= s) & (tt <= e)

        # Calibration: the motion at the compression rate, per 5 s of compressions.
        b, a_ = butter(2, [0.5, 8], btype="band", fs=FS)
        xb = filtfilt(b, a_, x)
        depth_per_unit = []
        for i in range(0, len(x) - 5 * FS, 5 * FS):
            if not on[i : i + 5 * FS].all():
                continue
            seg = xb[i : i + 5 * FS] * np.hanning(5 * FS)
            spec = np.abs(np.fft.rfft(seg, 8 * 5 * FS)) * 2 / (np.hanning(5 * FS).sum())
            f = np.fft.rfftfreq(8 * 5 * FS, 1 / FS)
            band = (f > 1.2) & (f < 2.8)
            k = np.argmax(spec[band])
            amp, f0 = spec[band][k], f[band][k]
            depth_per_unit.append(2 * amp / (2 * np.pi * f0) ** 2)  # metres per (unit/s²)
        scale = DEPTH_M / float(np.median(depth_per_unit))  # m/s² per unit
        g = x * scale / G

        # Reference compressions: one sharp peak each in the full-strength signal.
        prom = 0.5 * np.median([np.ptp(xb[i : i + 2 * FS]) for i in range(0, len(xb) - 2 * FS, 2 * FS) if on[i : i + 2 * FS].all()])
        sign = 1 if np.percentile(xb[on], 99.5) >= -np.percentile(xb[on], 0.5) else -1
        pk, _ = find_peaks(sign * xb, distance=int(0.3 * FS), prominence=prom)
        pk = pk[on[pk]]

        name = case.name.lower()
        g.astype(np.float32).tofile(OUT / f"{name}.f32")
        index.append({
            "name": name, "file": f"{name}.f32", "fs": FS, "n": int(len(g)), "periods": periods,
            "compressions": [round(float(p) / FS, 3) for p in pk], "unitsToMg": round(scale / G * 1000, 5),
        })
        rate = 60 / np.median(np.diff(pk / FS)[np.diff(pk / FS) < 1.2])
        print(f"{name}: {len(g) / FS / 60:.0f} min, {on.mean():.0%} compressing, {len(pk)} compressions, median {rate:.0f}/min, "
              f"chest motion {np.std(xb[on]) * scale / G * 1000:.0f} mg RMS while compressing")
    (OUT / "index.json").write_text(json.dumps(index))


if __name__ == "__main__":
    main()
