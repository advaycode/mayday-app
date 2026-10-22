"""
Train and test Mayday's heartbeat model (BeatNet).

    python tools/heart_ml/train.py            # needs data/cebsdb (PhysioNet) and data/sim (SIM_EXPORT=1 npx jest heartdata)

Two models, the same small network:
  vibration  one input (the accelerometer), trained on REAL recordings: the
             PhysioNet CEBS database, 20 people, beats annotated from the ECG.
             Tested by 5-fold cross-validation over people: every score comes
             from people the model never saw.
  both       two inputs (accelerometer and gyroscope). No open dataset has a
             phone-style gyroscope on the chest, so it learns from both: the
             real CEBS recordings with a gyroscope that sees only its own
             noise (the worst case: a gyroscope that adds nothing), and
             simulated people (mobile/src/sensors/sim.ts) whose gyroscope
             feels the heart's twist. On real people it is scored with that
             noise-only gyroscope, so it must stand on the accelerometer;
             its gyroscope numbers are simulator numbers.

Each is compared with the app's rule-based reader on exactly the same
windows. Writes the models (mobile/src/sensors/beatnet-*.json), a fixture for
the app's parity test, mobile/reports/heart-model.json and docs/HEART_MODEL.md.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

sys.path.insert(0, str(Path(__file__).parent))
import cebs  # noqa: E402
from dsp import MODEL_FS, features, to_model_rate  # noqa: E402
from rules import MIN_GAP_S, THRESHOLD, match, model_beats, rules_heart  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
MOBILE = ROOT / "mobile"
WIN = 10 * MODEL_FS
SIGMA = 3  # target bump half-width, samples (30 ms)
PHONE_NOISE_G = 180e-6 * math.sqrt(MODEL_FS / 2)  # 180 µg/√Hz at 100/s, per sample
GYRO_NOISE_DPS = 0.007 * math.sqrt(MODEL_FS / 2)  # 0.007 °/s/√Hz (Bosch BMI160), per sample
torch.set_num_threads(16)


class BeatNet(nn.Module):
    """Dilated 1-D convolutions, 'same' padding: a probability of a beat at every sample. Sees about 1.2 s."""

    def __init__(self, cin, ch=12, k=9, dil=(1, 2, 4, 8)):
        super().__init__()
        layers = []
        c = cin
        for d in dil:
            layers.append(nn.Conv1d(c, ch, k, dilation=d, padding=d * (k - 1) // 2))
            c = ch
        self.convs = nn.ModuleList(layers)
        self.out = nn.Conv1d(ch, 1, 1)

    def forward(self, x):
        for conv in self.convs:
            x = torch.relu(conv(x))
        return self.out(x).squeeze(1)  # logits


def targets(beat_idx, n):
    y = np.zeros(n, dtype=np.float32)
    idx = np.arange(n)
    for b in beat_idx:
        if -3 * SIGMA <= b < n + 3 * SIGMA:
            y = np.maximum(y, np.exp(-0.5 * ((idx - b) / SIGMA) ** 2))
    return y


# --- Data ---------------------------------------------------------------------------------

def real_windows(recs, stride_s, noise_levels, rng, gyro=False, one_noise=False):
    """
    10 s windows of real SCG, features and beat targets. noise_levels:
    phone-noise multiples to add (all of them, or with one_noise one picked
    at random per window, for training). stride_s is for the 5-minute
    records; the 50-minute ones (m) are strided 3 times wider so they do not
    swamp them. A window is skipped where the annotations and our R waves
    disagree on the number of beats (a lost electrode, a missed annotation).
    gyro adds a gyroscope that measures only its own noise.
    """
    X, Y, meta = [], [], []
    for r in recs:
        scg, beats, ecg = r["scg"], r["beats"], r["ecgBeats"]
        stride = stride_s * (3 if r["name"].startswith("m") else 1)
        for start in range(0, len(scg) - WIN, stride * MODEL_FS):
            seg = scg[start : start + WIN]
            inside = lambda t: t[(t * MODEL_FS >= start) & (t * MODEL_FS < start + WIN)]
            if abs(len(inside(beats)) - len(inside(ecg))) > 0:
                continue
            b = inside(beats) * MODEL_FS - start
            for k in [noise_levels[rng.integers(len(noise_levels))]] if one_noise else noise_levels:
                s = seg + (rng.normal(0, k * PHONE_NOISE_G, WIN) if k else 0)
                rot = [rng.normal(0, max(1, k) * GYRO_NOISE_DPS, WIN) for _ in range(3)] if gyro else None
                X.append(features(s, rot))
                Y.append(targets(b, WIN))
                meta.append({"subject": r["subject"], "record": r["name"], "noise": k, "raw": s, "rot": rot, "beats": b / MODEL_FS})
    return X, Y, meta


def beatless_windows(recs, count, rng, gyro=False):
    """
    Windows with no heartbeat, for the model to stay quiet on. The features
    are scaled to their own size, so a very noisy window with real beats
    under it looks much like a window of noise alone; trained with too few
    beat-free windows, the first version of this fix found a steady 50-80
    a minute in pure sensor noise. Three kinds, in turn:
      chest-coloured noise  random noise with the spectrum of a real SCG
                            window, smoothed over 2 Hz so the heart's rhythm
                            (lines every 1-2 Hz) is gone: a chest's colour,
                            no beats
      phone noise           white, at 100 a second
      browser noise         white at 60 a second, put on the model's clock
                            the way the app does (straight lines between
                            samples, which colours it)
    """
    X, Y, meta = [], [], []
    freqs = np.fft.rfftfreq(WIN, 1 / MODEL_FS)
    smooth = max(1, int(round(2.0 / (freqs[1] - freqs[0]))))
    for i in range(count):
        kind = i % 3
        if kind == 0:
            r = recs[rng.integers(len(recs))]
            start = rng.integers(0, len(r["scg"]) - WIN)
            mag = np.abs(np.fft.rfft(r["scg"][start : start + WIN]))
            mag = np.convolve(mag, np.ones(smooth) / smooth, mode="same")
            z = np.fft.irfft(mag * np.exp(2j * np.pi * rng.random(len(mag))), WIN)
            z = z / (np.std(z) + 1e-12) * np.std(r["scg"][start : start + WIN])
            z = z + rng.normal(0, PHONE_NOISE_G, WIN)
            source = "chest-coloured noise"
        elif kind == 1:
            z = rng.normal(0, PHONE_NOISE_G, WIN)
            source = "phone noise"
        else:
            n60 = int(10 * 60) + 1
            z = to_model_rate(rng.normal(0, PHONE_NOISE_G, n60), 60)[:WIN]
            source = "browser noise"
        rot = [rng.normal(0, GYRO_NOISE_DPS, WIN) for _ in range(3)] if gyro else None
        X.append(features(z, rot))
        Y.append(np.zeros(WIN, dtype=np.float32))
        meta.append({"subject": None, "record": source, "noise": 1, "raw": z, "rot": rot, "beats": np.zeros(0)})
    return X, Y, meta


def load_sims():
    root = ROOT / "data" / "sim"
    index = json.loads((root / "index.json").read_text())
    sims = []
    for e in index:
        a = np.fromfile(root / e["file"], dtype=np.float32).reshape(4, e["n"]).astype(np.float64)
        sims.append({**e, "z": a[0], "rot": a[1:], "beats": np.array(e["beats"])})
    return sims


def sim_windows(sims, both, stride_s=5):
    X, Y, meta = [], [], []
    for s in sims:
        fs = s["fs"]
        z100 = to_model_rate(s["z"], fs)
        rot100 = [to_model_rate(c, fs) for c in s["rot"]]
        for start in range(0, len(z100) - WIN, stride_s * MODEL_FS):
            z = z100[start : start + WIN]
            rot = [c[start : start + WIN] for c in rot100]
            b = s["beats"][(s["beats"] * MODEL_FS >= start) & (s["beats"] * MODEL_FS < start + WIN)] * MODEL_FS - start
            X.append(features(z, rot if both else None))
            Y.append(targets(b, WIN))
            meta.append({"scenario": s["scenario"], "heart": s["heart"], "z": z, "rot": rot, "beats": b / MODEL_FS})
    return X, Y, meta


# --- Training -----------------------------------------------------------------------------

CROP = 4 * MODEL_FS


def train(X, Y, cin, epochs=15, seed=0):
    """Features are made on whole 10 s windows (as in the app); training sees random 4 s crops of them, for speed."""
    torch.manual_seed(seed)
    net = BeatNet(cin)
    opt = torch.optim.Adam(net.parameters(), lr=3e-3)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(4.0))
    Xt = torch.tensor(np.stack(X))
    Yt = torch.tensor(np.stack(Y))
    g = torch.Generator().manual_seed(seed)
    for ep in range(epochs):
        perm = torch.randperm(len(Xt), generator=g)
        starts = torch.randint(0, WIN - CROP + 1, (len(Xt),), generator=g)
        for i in range(0, len(Xt), 128):
            j = perm[i : i + 128]
            idx = starts[j][:, None] + torch.arange(CROP)[None]
            xb = torch.gather(Xt[j], 2, idx[:, None, :].expand(-1, Xt.shape[1], -1))
            yb = torch.gather(Yt[j], 1, idx)
            opt.zero_grad()
            loss = loss_fn(net(xb), yb)
            loss.backward()
            opt.step()
        if ep == epochs - 5:
            for pg in opt.param_groups:
                pg["lr"] = 1e-3
    net.eval()
    return net


def predict(net, x):
    with torch.no_grad():
        return torch.sigmoid(net(torch.tensor(x[None]))).numpy()[0]


# --- Scoring ------------------------------------------------------------------------------

def score(readings, refs):
    """
    Per 10 s window, against the ECG's beats:
      found          share of windows where a heartbeat was reported (on windows
                     with no heartbeat this is the false-alarm rate)
      hrErrorPerMin  heart-rate error where one was reported
      sensitivity, precision
                     beats matched within ±100 ms after removing the window's
                     median delay from the ECG's R wave to the detected beat.
                     That delay is real physiology (the heart contracts 50-150 ms
                     after the R wave, differently in each person), so it is
                     removed, as in studies that compare beat-to-beat intervals.
      intervalErrorMs  mean error of beat-to-beat intervals against R-R intervals
    """
    tp = npred = nref = 0
    errs, ierrs = [], []
    found = 0
    for rd, ref in zip(readings, refs):
        ref = np.asarray(ref, dtype=np.float64)
        pred = np.array([b / rd["fs"] for b in rd["beats"]])
        if rd["found"]:
            found += 1
            if len(ref) >= 2:
                errs.append(abs(rd["perMin"] - 60 / float(np.median(np.diff(ref)))))
        if len(pred) and len(ref):
            near = np.array([ref[np.argmin(np.abs(ref - p))] for p in pred])
            d = pred - near
            d = d[np.abs(d) < 0.4]
            off = float(np.median(d)) if len(d) else 0.0
            t, p_, r_ = match(list(pred - off), list(ref))
            # Interval error: consecutive detected beats whose nearest R waves are consecutive too.
            j = [int(np.argmin(np.abs(ref - (p - off)))) for p in pred]
            for k in range(1, len(pred)):
                if j[k] == j[k - 1] + 1 and abs(pred[k] - off - ref[j[k]]) <= 0.1 and abs(pred[k - 1] - off - ref[j[k - 1]]) <= 0.1:
                    ierrs.append(abs((pred[k] - pred[k - 1]) - (ref[j[k]] - ref[j[k - 1]])) * 1000)
        else:
            t, p_, r_ = 0, len(pred), len(ref)
        tp += t
        npred += p_
        nref += r_
    return {
        "windows": len(readings),
        "found": round(found / len(readings), 3) if readings else None,
        "hrErrorPerMin": round(float(np.mean(errs)), 2) if errs else None,
        "sensitivity": round(tp / nref, 3) if nref else None,
        "precision": round(tp / npred, 3) if npred else None,
        "intervalErrorMs": round(float(np.mean(ierrs)), 1) if ierrs else None,
    }


def rule_readings(meta, rot):
    out = []
    for m in meta:
        z = m["raw"] if "raw" in m else m["z"]
        r = rules_heart(np.asarray(z), MODEL_FS, [np.asarray(c) for c in m["rot"]] if rot and m.get("rot") is not None else None)
        out.append({**r, "fs": MODEL_FS})
    return out


def model_readings(net, X, source):
    return [{**model_beats(predict(net, x), MODEL_FS, source), "fs": MODEL_FS} for x in X]


def export(net, path, name, inputs, trained_on, metrics):
    layers = []
    for conv in list(net.convs) + [net.out]:
        w = conv.weight.detach().numpy()
        layers.append({
            "in": int(w.shape[1]), "out": int(w.shape[0]), "k": int(w.shape[2]), "dilation": int(conv.dilation[0]),
            "relu": conv is not net.out,
            "w": [round(float(v), 6) for v in w.reshape(-1)],
            "b": [round(float(v), 6) for v in conv.bias.detach().numpy()],
        })
    params = sum(p.numel() for p in net.parameters())
    path.write_text(json.dumps({
        "name": name, "inputs": inputs, "fs": MODEL_FS, "threshold": THRESHOLD, "minGapS": MIN_GAP_S,
        "params": params, "trainedOn": trained_on, "metrics": metrics, "layers": layers,
    }, separators=(",", ":")) + "\n")
    return params


def main():
    t0 = time.time()
    rng = np.random.default_rng(7)
    report = {"generated": time.strftime("%Y-%m-%d %H:%M"), "window_s": 10, "tolerance_ms": 100}

    # ---- vibration model on real people -------------------------------------------------
    recs, dropped = cebs.load(ROOT / "data" / "cebsdb", cache=ROOT / "data" / "heart_ml_cache")
    subjects = sorted({r["subject"] for r in recs})
    amp = [float(np.percentile(np.abs(r["scg"]), 99)) * 1000 for r in recs]
    minutes = sum(len(r["scg"]) for r in recs) / MODEL_FS / 60
    print(f"CEBS: {len(recs)} records kept ({len(dropped)} dropped), {len(subjects)} people, {minutes:.0f} min, {sum(len(r['beats']) for r in recs)} beats, SCG 99th percentile {np.median(amp):.1f} mg")
    report["data"] = {
        "records": [r["name"] for r in recs],
        "dropped": {r["name"]: f"annotations agree with the ECG for {r['agree']:.0%} of beats" for r in dropped},
        "people": len(subjects),
        "minutes": round(minutes),
        "beats": int(sum(len(r["beats"]) for r in recs)),
        "annotationAgreement": round(float(np.mean([r["agree"] for r in recs])), 4),
    }
    sims = load_sims()
    # Simulated people: a fifth held out for the simulator scores and never trained on.
    idx = np.random.default_rng(2).permutation(len(sims))
    test_ids = set(idx[: len(sims) // 5].tolist())
    s_tr = [s for i, s in enumerate(sims) if i not in test_ids]
    s_te = [s for i, s in enumerate(sims) if i in test_ids]
    nX, nY, _ = sim_windows([s for s in s_tr if s["heart"] is None], both=False, stride_s=4)
    bX, bY, _ = sim_windows(s_tr, both=True, stride_s=4)

    def fit_both(pool, seed):
        """The two models on these real people, each with about 40% beat-free windows."""
        X, Y, _ = real_windows(pool, 4, [0, 1, 4], rng, one_noise=True)
        qX, qY, _ = beatless_windows(pool, len(X) // 3, rng)
        net = train(X + qX + nX, Y + qY + nY, 1, seed=seed)
        Xg, Yg, _ = real_windows(pool, 4, [0, 1, 4], rng, gyro=True, one_noise=True)
        qX, qY, _ = beatless_windows(pool, len(Xg) // 3, rng, gyro=True)
        net_b = train(Xg + qX + bX, Yg + qY + bY, 2, seed=seed)
        return net, net_b

    folds = np.array_split(np.random.default_rng(1).permutation(subjects), 5)
    cv = {k: {"model": [], "both": [], "rules": [], "refs": []} for k in (0, 1, 4, "beat-free")}
    for f, held in enumerate(folds):
        tr = [r for r in recs if r["subject"] not in held]
        te = [r for r in recs if r["subject"] in held]
        net, net_b = fit_both(tr, f)
        for k in (0, 1, 4, "beat-free"):
            if k == "beat-free":
                tXg, _, tmeta = beatless_windows(te, 150, rng, gyro=True)
            else:
                tXg, _, tmeta = real_windows(te, 10, [k], rng, gyro=True)
            tX = [features(m["raw"]) for m in tmeta]
            cv[k]["model"] += model_readings(net, tX, "vibration")
            cv[k]["both"] += model_readings(net_b, tXg, "both")
            cv[k]["rules"] += rule_readings(tmeta, False)
            cv[k]["refs"] += [m["beats"] for m in tmeta]
        print(f"  round {f + 1}/5 held out {list(map(int, held))}  ({time.time() - t0:.0f} s)", flush=True)

    real = {}
    for k in (0, 1, 4, "beat-free"):
        refs = cv[k]["refs"]
        real["beat_free" if k == "beat-free" else f"noise_{k}x"] = {
            "model": score(cv[k]["model"], refs),
            "both": score(cv[k]["both"], refs),
            "rules": score(cv[k]["rules"], refs),
        }
    report["real_cebs_cross_validated"] = real
    print(json.dumps(real, indent=1), flush=True)

    final_v, final_b = fit_both(recs, 99)
    sim_res = {}
    for name, both in (("both", True), ("vibration", False)):
        tX, _, tmeta = sim_windows(s_te, both=both, stride_s=10)
        net = final_b if both else final_v
        mr = model_readings(net, tX, name)
        rr = rule_readings(tmeta, both)
        by = {}
        for group, keep in (("heartbeat", lambda m: m["heart"] is not None), ("no heartbeat", lambda m: m["heart"] is None and m["scenario"] != "none_steps"), ("people walking, no heartbeat", lambda m: m["scenario"] == "none_steps")):
            sel = [i for i, m in enumerate(tmeta) if keep(m)]
            refs = [tmeta[i]["beats"] for i in sel]
            by[group] = {"model": score([mr[i] for i in sel], refs), "rules": score([rr[i] for i in sel], refs)}
        sim_res[name] = by
    report["simulated_held_out"] = sim_res
    print(json.dumps(sim_res, indent=1))

    # ---- export ----------------------------------------------------------------------------
    pv = export(final_v, MOBILE / "src" / "sensors" / "beatnet-vibration.json", "vibration", ["accelerometer"],
                f"PhysioNet CEBS, {len(subjects)} people, {sum(len(r['beats']) for r in recs)} beats, plus beat-free windows (simulated people with no heartbeat, sensor noise, chest-coloured noise)",
                real)
    pb = export(final_b, MOBILE / "src" / "sensors" / "beatnet-both.json", "both", ["accelerometer", "gyroscope"],
                f"PhysioNet CEBS, {len(subjects)} people, with a noise-only gyroscope; plus {len(s_tr)} simulated people (mobile/src/sensors/sim.ts)",
                {"real": real, "simulated": sim_res})
    report["params"] = {"vibration": pv, "both": pb}

    # Fixture: the app must produce the same probabilities from the same raw window.
    fx_real = np.round(recs[0]["scg"][3000 : 3000 + WIN], 9)
    s0 = next(s for s in s_te if s["heart"] is not None)
    fx_z = s0["z"][: int(10 * s0["fs"])]
    fx_rot = [c[: int(10 * s0["fs"])] for c in s0["rot"]]
    fixture = {
        "vibration": {"fs": MODEL_FS, "z": [round(float(v), 9) for v in fx_real],
                      "prob": [round(float(v), 6) for v in predict(final_v, features(fx_real))]},
        "both": {"fs": s0["fs"], "z": [round(float(v), 6) for v in fx_z], "rot": [[round(float(v), 6) for v in c] for c in fx_rot],
                 "prob": [round(float(v), 6) for v in predict(final_b, features(np.round(fx_z, 6), [np.round(c, 6) for c in fx_rot], s0["fs"]))]},
    }
    (MOBILE / "__tests__" / "fixtures" / "beatnet-fixture.json").write_text(json.dumps(fixture, separators=(",", ":")))
    (MOBILE / "reports" / "heart-model.json").write_text(json.dumps(report, indent=2) + "\n")
    (ROOT / "docs" / "HEART_MODEL.md").write_text(write_doc(report), encoding="utf-8")
    print(f"FINISHED in {time.time() - t0:.0f} s; params vibration {pv}, both {pb}")


def pct(v):
    return "" if v is None else f"{v * 100:.1f}%"


def num(v, unit=""):
    return "" if v is None else f"{v}{unit}"


def write_doc(report):
    d = report["data"]
    real = report["real_cebs_cross_validated"]
    sim = report["simulated_held_out"]
    rows = []
    for k, label in (("noise_0x", "as recorded"), ("noise_1x", "+ phone noise"), ("noise_4x", "+ 4× phone noise")):
        for m, name in (("model", "BeatNet, accelerometer"), ("both", "BeatNet, accelerometer + gyroscope (noise only)"), ("rules", "Rules (the old reader)")):
            s = real[k][m]
            rows.append(f"| {label} | {name} | {pct(s['sensitivity'])} | {pct(s['precision'])} | {num(s.get('intervalErrorMs'), ' ms')} | {pct(s['found'])} | {num(s['hrErrorPerMin'])} |")
    srows = []
    for model in ("both", "vibration"):
        for group, by in sim[model].items():
            for m in ("model", "rules"):
                s = by[m]
                who = ("BeatNet" if m == "model" else "Rules") + (", accelerometer + gyroscope" if model == "both" else ", accelerometer")
                srows.append(f"| {group} | {who} | {pct(s['sensitivity'])} | {pct(s['precision'])} | {pct(s['found'])} | {num(s['hrErrorPerMin'])} |")
    dropped = ", ".join(sorted(d["dropped"])) or "none"
    return f"""# Heartbeat model (BeatNet)

Generated by `python tools/heart_ml/train.py` on {report['generated']}. Numbers in `mobile/reports/heart-model.json`.

**Experimental, lab only.** The heartbeat is never shown in an emergency and never decides anything: lay rescuers are taught not to check for a pulse.

## What it is

A small neural network ({report['params']['vibration']:,} numbers; four dilated 1-D convolutions that see 1.2 s at a time) that gives the probability of a heartbeat at every moment of the chest's vibration (seismocardiogram). It runs on the phone in plain TypeScript (`mobile/src/sensors/beatnet.ts`), and a test checks that the app's copy gives the same output as the trained one. Two versions: accelerometer only, and accelerometer + gyroscope.

## Data

Real people: the PhysioNet **CEBS** database (Combined measurement of ECG, Breathing and Seismocardiograms; García-González et al., Computing in Cardiology 2013; Open Data Commons Attribution v1.0): healthy volunteers lying still, a chest accelerometer, and beats annotated from the ECG. Used: {len(d['records'])} recordings, {d['people']} people, {d['minutes']} minutes, {d['beats']:,} beats. Each recording's annotations were checked against R waves found independently in its own ECG: {d['annotationAgreement'] * 100:.1f}% agree within 20 ms on the recordings kept.

**A fault in the published database.** Dropped: {dropped}. Their signal files are byte-for-byte copies of p002-p020 (PhysioNet's own `SHA256SUMS.txt` lists the same SHA-256 for each pair), while their annotations and headers are the real basal recordings'. Their annotated beats match the ECG in the file only 2-8% of the time, and their beat-to-beat intervals do not correlate with it at any shift. The first version of this model trained on them, so it was taught, and scored, against beats that were not there: it found 58% of beats. A 10-second window is also skipped wherever the annotations and our R waves disagree on the number of beats.

Simulated people (`mobile/src/sensors/sim.ts`): no heartbeat at all, or footsteps nearby, so the model learns to stay quiet; and, for the gyroscope model, people whose gyroscope feels the heart's twist. No open dataset has a phone-style gyroscope on the chest (one with 29 people needs an IEEE DataPort account: Kaisti et al., DOI 10.21227/vfcs-k196).

## Real people, never seen in training (5-fold cross-validation by person)

10-second windows. A beat counts if it is within 100 ms of an ECG beat after removing the window's median delay (the heart contracts 30-130 ms after the R wave, differently in each person). Phone noise is 180 µg/√Hz (a typical phone accelerometer) added to the recording. "Interval error" is the mean error of beat-to-beat intervals against the ECG's.

| Recording | Reader | Beats found (sensitivity) | Beats real (precision) | Interval error | Windows with a heart rate | Rate error (/min) |
|---|---|---|---|---|---|---|
{chr(10).join(rows)}

The gyroscope model is scored here with a gyroscope that measures only its own noise, the worst case: it has to stand on the accelerometer.

**No heartbeat at all.** Held-out beat-free windows made from the same held-out people: noise with the colour (spectrum) of their chest recordings but no beats, and plain phone and browser sensor noise. Any heart rate reported here is a false alarm.

| Reader | Windows with a heart rate (false alarms) |
|---|---|
{chr(10).join(f"| {name} | {pct(real['beat_free'][m]['found'])} |" for m, name in (("model", "BeatNet, accelerometer"), ("both", "BeatNet, accelerometer + gyroscope"), ("rules", "Rules")))}

The first fixed version, trained with only 17% beat-free windows, reported a heartbeat in 14-17% of simulated people with none; it now trains on about 40%.

## Simulated people, held out

| Who | Reader | Sensitivity | Precision | Windows with a heart rate | Rate error (/min) |
|---|---|---|---|---|---|
{chr(10).join(srows)}

On people with no heartbeat, "windows with a heart rate" is the false-alarm rate. These are simulator numbers: the simulated heartbeat's shape is an assumption.

## Limits

- CEBS is 20 healthy young adults, lying still, at rest. Nobody in cardiac arrest, nobody heavy, nobody on a soft bed.
- The CEBS sensor is a lab accelerometer taped to the sternum; a phone resting on the chest couples less well. Phone noise is added, but the coupling is not modelled.
- The gyroscope has only simulator evidence.
- Measure it on yourself before trusting any of this (plan in `research/sensor-breathing.md`).
"""


if __name__ == "__main__":
    main()
