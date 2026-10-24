"""
Pre-render every line Mayday can speak into audio files.

Why: during a protocol the app must speak instantly, offline, and put each
count exactly on its beat. On-device text-to-speech has a startup delay that
varies by phone, and network voices need signal. So every spoken line is
rendered once, here, with a neural voice (tools/voice_engine.py: Kokoro af_heart,
or Piper as a fallback), and shipped inside the app.

    ~/tools/kokoro_venv/Scripts/python tools/render_voice.py            # render anything missing
    ~/tools/kokoro_venv/Scripts/python tools/render_voice.py --force    # re-render everything
    python tools/render_voice.py --engine piper                         # the original voice

Reads:   mobile/src/protocols/corpus/*.json   (every say / reminder / breath line)
         mobile/src/audio/systemLines.json    (counts and app lines)
         mobile/src/voice/answers.json        (answers to open questions)
Writes:  mobile/assets/voice/en/<key>.wav|mp3
         mobile/src/audio/voiceManifest.ts    (key -> require(...) for Metro)

Needs:   ffmpeg on PATH, and either Kokoro (pip install kokoro-onnx soundfile in
         ~/tools/kokoro_venv, model files in ~/tools/kokoro) or Piper (pip install
         piper-tts, model at ~/.piper/models/en_US-lessac-medium.onnx). Changing the
         voice re-renders every clip (the voice's name is kept in assets/voice/en/.voice).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import wave
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from voice_engine import Voice

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"
CORPUS = MOBILE / "src" / "protocols" / "corpus"
SYSTEM = MOBILE / "src" / "audio" / "systemLines.json"
ANSWERS = MOBILE / "src" / "voice" / "answers.json"
ADAPTED = MOBILE / "src" / "voice" / "adaptedLines.json"  # written by mobile/__tests__/adapt.test.ts
OUT = MOBILE / "assets" / "voice" / "en"
MANIFEST = MOBILE / "src" / "audio" / "voiceManifest.ts"

# A count has to fit inside one beat at 110 per minute (545 ms) with room for
# the click, so counts are spoken briskly and squeezed to at most this long.
MAX_COUNT_S = 0.40
TARGET_RMS_DB = -18.0

# Emergency numbers other than 911, from mobile/src/region/regions.ts.
REGION_NUMBERS = ["112"]

# Mirrors src/cpr/timeline.ts. __tests__/voice.test.ts fails if these drift apart.
MINUTE_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
                "Nineteen", "Twenty"]
TIMELINE_LINES = ["Back to compressions.", "Keep going. Switch with someone if you can.", "Keep going. Help is coming."] + [
    f"{MINUTE_WORDS[m]} minute{'' if m == 1 else 's'}. {tail}"
    for m in range(1, 21)
    for tail in ("Switch with someone if you can.", "Keep going.")  # with a helper / alone
]


def normalize(text: str) -> str:
    text = text.replace("’", "'").strip().lower()
    return re.sub(r"\s+", " ", text)


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def clip_key(text: str) -> str:
    """Must match clipKey() in src/audio/voiceManifest.ts."""
    norm = normalize(text)
    slug = re.sub(r"[^a-z0-9]+", "_", norm).strip("_")[:40]
    return f"{slug}_{fnv1a(norm)}"


def collect_lines() -> tuple[list[str], list[str]]:
    lines: list[str] = []
    for path in sorted(CORPUS.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("$schema") != "mayday.protocol.v2":
            continue
        for step in data["steps"]:
            for field in ("say", "resumeSay", "reminders", "breathsSay", "doneSay"):
                lines += step.get(field, [])
            if "depthSay" in step:
                lines.append(step["depthSay"])
    system = json.loads(SYSTEM.read_text(encoding="utf-8"))
    lines += list(system["lines"].values()) + list(system["confirm"].values()) + TIMELINE_LINES
    for card in json.loads(ANSWERS.read_text(encoding="utf-8"))["cards"]:
        lines += card["say"]
    if ADAPTED.exists():
        lines += json.loads(ADAPTED.read_text(encoding="utf-8"))["lines"]
    counts = system["counts"]
    # A line that says 911 is also recorded with each other region's number
    # (mobile/src/region/regions.ts), so the voice can say "one one two" in Lagos.
    lines += [l.replace("911", n) for l in list(lines) if "911" in l for n in REGION_NUMBERS]
    # De-duplicate while keeping order.
    seen: set[str] = set()
    unique = [l for l in lines if not (clip_key(l) in seen or seen.add(clip_key(l)))]
    return unique, counts


def trim(pcm: np.ndarray, rate: int, threshold_db: float = -42.0, pad_s: float = 0.012) -> np.ndarray:
    """Cut leading and trailing silence so a count starts the instant it is scheduled."""
    thresh = 10 ** (threshold_db / 20)
    loud = np.where(np.abs(pcm) > thresh)[0]
    if len(loud) == 0:
        return pcm
    pad = int(pad_s * rate)
    return pcm[max(0, loud[0] - pad): min(len(pcm), loud[-1] + pad)]


def level(pcm: np.ndarray) -> np.ndarray:
    rms = np.sqrt(np.mean(pcm ** 2)) or 1e-9
    gain = 10 ** (TARGET_RMS_DB / 20) / rms
    out = pcm * gain
    peak = np.max(np.abs(out)) or 1e-9
    if peak > 0.95:
        out *= 0.95 / peak
    # 8 ms fades so clips never click when they start or stop.
    fade = min(len(out) // 4, 176)
    if fade > 0:
        ramp = np.linspace(0, 1, fade)
        out[:fade] *= ramp
        out[-fade:] *= ramp[::-1]
    return out


def write_wav(path: Path, pcm: np.ndarray, rate: int) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes((np.clip(pcm, -1, 1) * 32767).astype(np.int16).tobytes())


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


# Lines render in several processes side by side, each with its own voice.
_worker_voice: Voice | None = None


def _start_worker(engine: str, threads: int) -> None:
    global _worker_voice
    _worker_voice = Voice(engine, threads)


def _render_line(job: tuple[str, str]) -> str:
    text, path = job
    assert _worker_voice is not None
    # A touch slower than normal: calm, and clear over a noisy room.
    pcm, rate = _worker_voice.synth(text, speed=0.94)
    pcm = level(trim(pcm, rate, pad_s=0.03))
    tmp = Path(path).with_suffix(".tmp.wav")
    write_wav(tmp, pcm, rate)
    ffmpeg("-i", str(tmp), "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-q:a", "5", path)
    tmp.unlink()
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--engine", choices=["kokoro", "piper"], default=None, help="default: kokoro when installed")
    ap.add_argument("--jobs", type=int, default=4, help="lines rendered side by side")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    voice = Voice(args.engine)
    # A different voice than the clips on disk: every clip is rendered again, so none mix.
    stamp = OUT / ".voice"
    if not stamp.exists() or stamp.read_text(encoding="utf-8").strip() != voice.name:
        args.force = True
    print(f"Voice: {voice.name}{' (rendering every clip)' if args.force else ''}", flush=True)
    lines, counts = collect_lines()

    entries: list[tuple[str, str, str, float]] = []  # key, file, text, duration

    for text in counts:
        key = clip_key(text)
        path = OUT / f"{key}.wav"
        if args.force or not path.exists():
            pcm, rate = voice.synth(text, speed=1.28)
            pcm = level(trim(pcm, rate))
            write_wav(path, pcm, rate)
            dur = len(pcm) / rate
            if dur > MAX_COUNT_S:
                # Squeeze long numbers ("twenty seven") into the beat without changing pitch.
                tmp = path.with_suffix(".tmp.wav")
                path.rename(tmp)
                ffmpeg("-i", str(tmp), "-filter:a", f"atempo={dur / MAX_COUNT_S:.4f}", str(path))
                tmp.unlink()
        with wave.open(str(path), "rb") as w:
            entries.append((key, path.name, text, w.getnframes() / w.getframerate()))

    todo = [(text, str(OUT / f"{clip_key(text)}.mp3")) for text in lines if args.force or not (OUT / f"{clip_key(text)}.mp3").exists()]
    if todo:
        jobs = max(1, min(args.jobs, len(todo)))
        threads = max(1, (os.cpu_count() or 4) // jobs)
        with ProcessPoolExecutor(jobs, initializer=_start_worker, initargs=(voice.engine, threads)) as pool:
            for i, _ in enumerate(pool.map(_render_line, todo, chunksize=2), 1):
                if i % 25 == 0 or i == len(todo):
                    print(f"  {i}/{len(todo)} lines", flush=True)

    for text in lines:
        key = clip_key(text)
        path = OUT / f"{key}.mp3"
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        )
        entries.append((key, path.name, text, float(probe.stdout.strip())))

    stamp.write_text(voice.name, encoding="utf-8")
    # Remove clips for lines that no longer exist.
    keep = {e[1] for e in entries} | {stamp.name}
    for f in OUT.iterdir():
        if f.name not in keep:
            f.unlink()

    rows = "\n".join(f"  {json.dumps(key)}: require('../../assets/voice/en/{name}')," for key, name, _, _ in entries)
    durations = "\n".join(f"  {json.dumps(key)}: {dur:.3f}," for key, _, _, dur in entries)
    MANIFEST.write_text(
        "// GENERATED by tools/render_voice.py. Do not edit by hand.\n"
        "// Every line the app can say, pre-rendered with the Piper voice en_US-lessac-medium.\n\n"
        "/** Same algorithm as clip_key() in tools/render_voice.py. */\n"
        "export function clipKey(text: string): string {\n"
        "  const norm = text.replace(/\\u2019/g, \"'\").trim().toLowerCase().replace(/\\s+/g, ' ');\n"
        "  const slug = norm.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);\n"
        "  let h = 0x811c9dc5;\n"
        "  for (const ch of norm) {\n"
        "    h ^= ch.codePointAt(0)!;\n"
        "    h = Math.imul(h, 0x01000193) >>> 0;\n"
        "  }\n"
        "  return `${slug}_${h.toString(16).padStart(8, '0')}`;\n"
        "}\n\n"
        f"export const voiceClips: Record<string, number> = {{\n{rows}\n}};\n\n"
        f"/** Seconds, for planning; the engine measures real durations after decoding. */\n"
        f"export const voiceDurations: Record<string, number> = {{\n{durations}\n}};\n",
        encoding="utf-8",
    )
    long_counts = [(t, d) for k, n, t, d in entries if t in counts and d > MAX_COUNT_S + 0.02]
    print(f"{len(entries)} clips ({len(counts)} counts, {len(lines)} lines) -> {OUT.relative_to(ROOT)}")
    if long_counts:
        print("WARNING counts longer than a beat allows:", long_counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
