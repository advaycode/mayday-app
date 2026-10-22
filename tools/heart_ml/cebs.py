"""
PhysioNet CEBS database (Combined measurement of ECG, Breathing and
Seismocardiograms): 20 healthy volunteers lying still, supine; ECG leads I
and II, respiration, and a seismocardiogram from a chest accelerometer
(LIS344ALH), all at 5 kHz, with annotated heartbeats. Open Data Commons
Attribution License v1.0.

  Garcia-Gonzalez MA, Argelagos-Palau A, Fernandez-Chimeno M, Ramos-Castro J.
  A comparison of heartbeat detectors for the seismocardiogram. Computing in
  Cardiology 2013;40:461-464.
  Goldberger AL, et al. PhysioBank, PhysioToolkit, and PhysioNet. Circulation
  2000;101(23):e215-e220.

Readers for the WFDB files (header, format-16 signals, MIT annotations), so
no extra package is needed.

Every record's annotations are checked against R waves we find in its own
ECG (`r_waves`). In b001 and p001-p020 they agree within 20 ms. In
b002-b020 they do not, and their beat-to-beat intervals do not even match
the record's ECG (correlation 0.1-0.2 at any shift): those signal files are
copies of p002-p020 (identical SHA-256 in PhysioNet's own SHA256SUMS.txt)
while the annotations are the real basal ones. Training on them taught the
model, and scored it, against beats that were not there; they are dropped.
"""
from pathlib import Path

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks, resample_poly

# LIS344ALH: ratiometric, about Vdd/5 per g; at 3.3 V that is 660 mV per g.
# The database gives the SCG in mV, so this converts it to g (an assumption:
# the supply voltage is not stated).
MV_PER_G = 660.0


def read_header(path: Path):
    lines = [l for l in path.read_text().splitlines() if l and not l.startswith("#")]
    name, nsig, fs, nsamp = lines[0].split()[:4]
    sigs = []
    for l in lines[1 : 1 + int(nsig)]:
        parts = l.split()
        fmt = int(parts[1])
        g = parts[2]
        gain = float(g.split("(")[0].split("/")[0])
        baseline = int(g.split("(")[1].split(")")[0]) if "(" in g else 0
        sigs.append({"fmt": fmt, "gain": gain, "baseline": baseline, "desc": parts[-1]})
    return {"fs": float(fs), "n": int(nsamp), "signals": sigs}


def read_signals(record: Path):
    """All channels in physical units (mV), keyed by description."""
    h = read_header(record.with_suffix(".hea"))
    assert all(s["fmt"] == 16 for s in h["signals"])
    raw = np.fromfile(record.with_suffix(".dat"), dtype="<i2")
    raw = raw[: h["n"] * len(h["signals"])].reshape(-1, len(h["signals"]))
    out = {s["desc"]: (raw[:, i].astype(np.float64) - s["baseline"]) / s["gain"] for i, s in enumerate(h["signals"])}
    return h["fs"], out


def read_annotations(path: Path):
    """MIT-format annotations: (sample, type code, channel) for each beat.
    CEBS marks every beat once per ECG lead, told apart by the channel field.
    A CHN word follows the annotation it belongs to, and the channel carries
    over to later annotations until the next CHN."""
    data = np.fromfile(path, dtype="<u2")
    t = 0
    chan = 0
    out = []
    i = 0
    while i < len(data):
        w = int(data[i])
        code, interval = w >> 10, w & 0x3FF
        i += 1
        if code == 0 and interval == 0:
            break
        if code == 59:  # SKIP: a 32-bit interval follows, high word first
            t += (int(data[i]) << 16) + int(data[i + 1])
            i += 2
            continue
        if code == 63:  # AUX: a string follows, padded to a whole word
            i += (interval + 1) // 2
            continue
        if code == 62:  # CHN: the channel of the annotation just read
            chan = interval
            if out:
                out[-1] = (out[-1][0], out[-1][1], chan)
            continue
        if code in (60, 61):  # NUM, SUB
            continue
        t += interval
        out.append((t, code, chan))
    return out


def r_waves(ecg: np.ndarray, fs: float) -> np.ndarray:
    """
    R waves (sample indices) from one ECG lead: band-pass 5-30 Hz, square
    the slope (Pan and Tompkins, 1985), smooth over 120 ms, take peaks at
    least 300 ms apart over a threshold that follows the signal's size,
    then move each to the largest deflection within 80 ms of the dominant
    sign.
    """
    b, a = butter(2, [5, 30], btype="band", fs=fs)
    e = filtfilt(b, a, ecg)
    slope = np.gradient(e) ** 2
    w = int(0.12 * fs)
    c = np.concatenate([[0.0], np.cumsum(slope)])
    energy = np.empty_like(slope)
    lo = np.clip(np.arange(len(slope)) - w // 2, 0, len(slope))
    hi = np.clip(np.arange(len(slope)) + (w - w // 2), 0, len(slope))
    energy[:] = (c[hi] - c[lo]) / w
    # Threshold: 30% of the typical beat's energy, measured over 10 s stretches.
    seg = int(10 * fs)
    level = np.array([np.percentile(energy[i : i + seg], 98) for i in range(0, len(energy), seg)])
    thr = 0.3 * np.repeat(level, seg)[: len(energy)]
    pk, _ = find_peaks(energy, distance=int(0.3 * fs))
    pk = pk[energy[pk] > thr[pk]]
    r = int(0.08 * fs)
    polarity = 1.0 if np.median([e[max(0, p - r) : p + r].max() for p in pk]) >= np.median([-e[max(0, p - r) : p + r].min() for p in pk]) else -1.0
    out = [max(0, p - r) + int(np.argmax(polarity * e[max(0, p - r) : p + r])) for p in pk]
    return np.unique(np.array(out, dtype=np.int64))


def annotation_agreement(r: np.ndarray, ann: np.ndarray, fs: float, tol_s: float = 0.02):
    """Share of the database's beats that have one of our R waves within tol, after the median offset."""
    if not len(r) or not len(ann):
        return 0.0, 0.0
    j = np.clip(np.searchsorted(r, ann), 1, len(r) - 1)
    d = np.where(np.abs(r[j] - ann) < np.abs(r[j - 1] - ann), r[j] - ann, r[j - 1] - ann) / fs
    off = float(np.median(d))
    return float(np.mean(np.abs(d - off) <= tol_s)), off


BEAT_CODES = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 25, 30, 34, 35, 38}


MIN_AGREEMENT = 0.95


def _process(rec: Path, fs_out: int):
    fs, sig = read_signals(rec)
    scg = sig["SCG"] / MV_PER_G
    down = int(round(fs / fs_out))
    scg = resample_poly(scg - scg.mean(), 1, down)
    ann = read_annotations(rec.with_suffix(".atr"))
    ann0 = np.array([s for s, c, ch in ann if c in BEAT_CODES and ch == 0], dtype=np.int64)
    best = max(((k, r_waves(sig[k], fs)) for k in ("I", "II")), key=lambda kr: annotation_agreement(kr[1], ann0, fs)[0])
    agree, off = annotation_agreement(best[1], ann0, fs)
    return {
        "scg": scg.astype(np.float64), "beats": ann0 / fs, "ecgBeats": best[1] / fs,
        "lead": best[0], "agree": agree, "offMs": off * 1000,
    }


def load(root: Path, fs_out: int = 100, cache: Path | None = None, log=print):
    """
    Every b, m and p record whose annotations can be trusted: SCG in g at
    fs_out, the database's beat times in seconds, our own R waves from the
    ECG (`ecgBeats`, to check them), and the subject.

    A record is kept only if at least 95% of its annotated beats have one of
    our R waves within 20 ms. That drops b002-b020, whose signal files are
    byte-for-byte copies of p002-p020 (PhysioNet's own SHA256SUMS shows the
    same hash for each pair) while their annotations and headers are the
    real basal ones.
    """
    recs, dropped = [], []
    for hea in sorted(root.glob("[bmp][0-9][0-9][0-9].hea")):
        rec = hea.with_suffix("")
        dat = rec.with_suffix(".dat")
        if not dat.exists():
            continue
        key = f"{dat.stat().st_size}-{int(dat.stat().st_mtime)}-{fs_out}-v2"
        cf = cache / f"{rec.name}.npz" if cache else None
        if cf and cf.exists() and str(np.load(cf, allow_pickle=False)["key"]) == key:
            z = np.load(cf, allow_pickle=False)
            r = {k: z[k] for k in ("scg", "beats", "ecgBeats")} | {"lead": str(z["lead"]), "agree": float(z["agree"]), "offMs": float(z["offMs"])}
        else:
            r = _process(rec, fs_out)
            if cf:
                cf.parent.mkdir(parents=True, exist_ok=True)
                np.savez(cf, key=key, **r)
        info = {"name": rec.name, "subject": int(rec.name[1:]), "fs": fs_out, **r}
        if r["agree"] >= MIN_AGREEMENT:
            recs.append(info)
        else:
            dropped.append(info)
        log(f"  {rec.name}: {len(r['beats'])} beats, {len(r['scg']) / fs_out / 60:.1f} min, annotations agree with lead {r['lead']} {r['agree']:.0%}{'' if r['agree'] >= MIN_AGREEMENT else '  DROPPED'}")
    return recs, dropped
