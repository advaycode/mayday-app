"""
Pre-render every line Mayday can speak into audio files.

Why: during a protocol the app must speak instantly, offline, and put each
count exactly on its beat. On-device text-to-speech has a startup delay that
varies by phone, and network voices need signal. So every spoken line is
rendered once, here, with the Piper neural voice, and shipped inside the app.

    python tools/render_voice.py            # render anything missing
    python tools/render_voice.py --force    # re-render everything

Reads:   mobile/src/protocols/corpus/*.json   (every say / reminder / breath line)
         mobile/src/audio/systemLines.json    (counts and app lines)
         mobile/src/voice/answers.json        (answers to open questions)
Writes:  mobile/assets/voice/en/<key>.wav|mp3
         mobile/src/audio/voiceManifest.ts    (key -> require(...) for Metro)

Needs:   pip install piper-tts numpy, ffmpeg on PATH, and the voice model at
         ~/.piper/models/en_US-lessac-medium.onnx
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"
CORPUS = MOBILE / "src" / "protocols" / "corpus"
SYSTEM = MOBILE / "src" / "audio" / "systemLines.json"
ANSWERS = MOBILE / "src" / "voice" / "answers.json"
OUT = MOBILE / "assets" / "voice" / "en"
MANIFEST = MOBILE / "src" / "audio" / "voiceManifest.ts"
MODEL = Path.home() / ".piper" / "models" / "en_US-lessac-medium.onnx"

# A count has to fit inside one beat at 110 per minute (545 ms) with room for
# the click, so counts are spoken briskly and squeezed to at most this long.
MAX_COUNT_S = 0.40
TARGET_RMS_DB = -18.0

# Mirrors src/cpr/timeline.ts. __tests__/voice.test.ts fails if these drift apart.
MINUTE_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
                "Nineteen", "Twenty"]
TIMELINE_LINES = ["Back to compressions.", "Keep going. Switch with someone if you can."] + [
    f"{MINUTE_WORDS[m]} minute{'' if m == 1 else 's'}. Switch with someone if you can." for m in range(1, 21)
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
    counts = system["counts"]
    # De-duplicate while keeping order.
    seen: set[str] = set()
    unique = [l for l in lines if not (clip_key(l) in seen or seen.add(clip_key(l)))]
    return unique, counts


def synth(voice: PiperVoice, text: str, length_scale: float) -> tuple[np.ndarray, int]:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        voice.synthesize_wav(text, wav, SynthesisConfig(length_scale=length_scale, noise_scale=0.55, noise_w_scale=0.7))
    buf.seek(0)
    with wave.open(buf, "rb") as wav:
        rate = wav.getframerate()
        pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return pcm, rate


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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not MODEL.exists():
        print(f"Voice model not found at {MODEL}", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(str(MODEL))
    lines, counts = collect_lines()

    entries: list[tuple[str, str, str, float]] = []  # key, file, text, duration

    for text in counts:
        key = clip_key(text)
        path = OUT / f"{key}.wav"
        if args.force or not path.exists():
            pcm, rate = synth(voice, text, length_scale=0.78)
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

    for text in lines:
        key = clip_key(text)
        path = OUT / f"{key}.mp3"
        if args.force or not path.exists():
            pcm, rate = synth(voice, text, length_scale=1.06)
            pcm = level(trim(pcm, rate, pad_s=0.03))
            tmp = OUT / f"{key}.tmp.wav"
            write_wav(tmp, pcm, rate)
            ffmpeg("-i", str(tmp), "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-q:a", "5", str(path))
            tmp.unlink()
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        )
        entries.append((key, path.name, text, float(probe.stdout.strip())))

    # Remove clips for lines that no longer exist.
    keep = {e[1] for e in entries}
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
