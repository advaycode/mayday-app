"""
Mayday's voice, for tools/render_voice.py (the recorded clips) and
tools/tts_server.py (lines that only exist at runtime), so both always
speak in the same voice.

    kokoro   Kokoro-82M (hexgrad/Kokoro-82M via thewh1teagle/kokoro-onnx),
             voice af_heart: warm and natural. The default when installed:
             venv at ~/tools/kokoro_venv, model files in ~/tools/kokoro.
    piper    Piper en_US-lessac-medium: the original voice, kept as a fallback.

Both run offline on the CPU. `speed` 1.0 is normal; above is faster.
"""
from __future__ import annotations

import io
import re
import wave
from pathlib import Path

import numpy as np

KOKORO_DIR = Path.home() / "tools" / "kokoro"
KOKORO_VOICE = "af_heart"
PIPER_MODEL = Path.home() / ".piper" / "models" / "en_US-lessac-medium.onnx"


def spoken(text: str) -> str:
    """How a line should sound: a voice would read 911 as "nine hundred eleven"."""
    text = re.sub(r"\b911\b", "nine one one", text.strip())
    return re.sub(r"\b112\b", "one one two", text)


def kokoro_available() -> bool:
    try:
        import kokoro_onnx  # noqa: F401
    except ImportError:
        return False
    return (KOKORO_DIR / "kokoro-v1.0.onnx").exists() and (KOKORO_DIR / "voices-v1.0.bin").exists()


class Voice:
    def __init__(self, engine: str | None = None, threads: int | None = None):
        """`threads`: CPU threads for this voice (several voices rendering side by side each take a few)."""
        self.engine = engine or ("kokoro" if kokoro_available() else "piper")
        if self.engine == "kokoro":
            import onnxruntime as ort
            from kokoro_onnx import Kokoro

            opts = ort.SessionOptions()
            if threads:
                opts.intra_op_num_threads = threads
                opts.inter_op_num_threads = 1
            session = ort.InferenceSession(str(KOKORO_DIR / "kokoro-v1.0.onnx"), opts, providers=["CPUExecutionProvider"])
            self._k = Kokoro.from_session(session, str(KOKORO_DIR / "voices-v1.0.bin"))
            self.name = f"kokoro-{KOKORO_VOICE}"
        else:
            from piper import PiperVoice

            self._p = PiperVoice.load(str(PIPER_MODEL))
            self.name = "piper-en_US-lessac-medium"

    def synth(self, text: str, speed: float = 1.0, lang: str = "en") -> tuple[np.ndarray, int]:
        """Mono float32 samples in -1..1, and the sample rate. `lang`: "en", or "es" / "hi" (Kokoro only)."""
        if lang != "en":
            voice, code = {"es": ("ef_dora", "es"), "hi": ("hf_alpha", "hi")}[lang]
            pcm, rate = self._k.create(text, voice=voice, speed=speed, lang=code)
            return np.asarray(pcm, dtype=np.float32), rate
        text = spoken(text)
        if self.engine == "kokoro":
            pcm, rate = self._k.create(text, voice=KOKORO_VOICE, speed=speed, lang="en-us")
            return np.asarray(pcm, dtype=np.float32), rate
        from piper import SynthesisConfig

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            self._p.synthesize_wav(text, wav, SynthesisConfig(length_scale=1.0 / speed, noise_scale=0.55, noise_w_scale=0.7))
        buf.seek(0)
        with wave.open(buf, "rb") as wav:
            rate = wav.getframerate()
            pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        return pcm, rate


def wav_bytes(pcm: np.ndarray, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(pcm, -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue()
