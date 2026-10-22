"""
Real sounds that are not gasps, for measuring how often the gasp rules
(mobile/src/sensors/sounds.ts) are fooled.

    python tools/sound_data.py      # writes data/sounds/ (git-ignored)

  ESC-50 (Piczak, "ESC: Dataset for Environmental Sound Classification",
  ACM Multimedia 2015; Harvard Dataverse, doi 10.7910/DVN/YDEPUT; CC BY-NC
  3.0, clips from Freesound): the breathing, snoring, coughing, sneezing and
  laughing classes, 40 five-second clips each. Fetched from
  github.com/karolpiczak/ESC-50 into data/esc50/ (meta/esc50.csv, audio/).
  Used only for testing here, never shipped.

  Talking: the app's own recorded voice lines (mobile/assets/voice/en),
  strung together with 0.2-0.8 s pauses into 10-second stretches, like a
  rescuer talking during the check.

Everything is written as 16 kHz mono float32, with a faint room noise
(-70 dBFS) so silence is never digital zero.
"""
import csv
import json
import random
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
ESC = ROOT / "data" / "esc50"
VOICE = ROOT / "mobile" / "assets" / "voice" / "en"
OUT = ROOT / "data" / "sounds"
RATE = 16000
GROUPS = ["breathing", "snoring", "coughing", "sneezing", "laughing"]


def to16k(x: np.ndarray, rate: int) -> np.ndarray:
    if x.ndim > 1:
        x = x.mean(axis=1)
    if x.dtype.kind == "i":
        x = x / np.iinfo(x.dtype).max
    g = np.gcd(rate, RATE)
    return resample_poly(x.astype(np.float64), RATE // g, rate // g)


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(RATE), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(3)
    index = []

    def write(name, x, group, source):
        x = x + rng.normal(0, 10 ** (-70 / 20), len(x))
        x.astype(np.float32).tofile(OUT / f"{name}.f32")
        index.append({"file": f"{name}.f32", "group": group, "source": source, "seconds": round(len(x) / RATE, 2)})

    with open(ESC / "esc50.csv", newline="") as f:
        for row in csv.DictReader(f):
            if row["category"] not in GROUPS:
                continue
            rate, x = wavfile.read(ESC / "audio" / row["filename"])
            write(f"esc_{row['filename'][:-4]}", to16k(x, rate), row["category"], f"ESC-50 {row['filename']}")

    lines = sorted(VOICE.glob("*.mp3"))
    random.seed(5)
    clips = [decode(p) for p in random.sample(lines, 120)]
    for k in range(40):
        parts, total = [], 0.0
        while total < 10:
            c = clips[random.randrange(len(clips))]
            gap = np.zeros(int(random.uniform(0.2, 0.8) * RATE))
            parts += [c, gap]
            total += (len(c) + len(gap)) / RATE
        x = np.concatenate(parts)[: 10 * RATE]
        write(f"talk_{k:02d}", x * random.uniform(0.1, 0.6), "talking (app voice)", f"voice lines, stretch {k}")

    (OUT / "index.json").write_text(json.dumps(index))
    print(f"{len(index)} clips -> {OUT}")


if __name__ == "__main__":
    main()
