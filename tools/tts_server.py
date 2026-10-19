"""
Local neural voice server: speaks any line in the same Piper voice as the
pre-recorded clips, for lines that only exist at runtime (AI-adapted
phrasing). Runs on this computer next to the phone mirror.

    python tools/tts_server.py            # http://127.0.0.1:8743/tts?text=Kneel+beside+his+chest.

On a phone, lines that are not pre-recorded use the phone's own voice instead.
"""
import io
import re
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlparse

from piper import PiperVoice, SynthesisConfig

MODEL = Path.home() / ".piper" / "models" / "en_US-lessac-medium.onnx"
PORT = 8743
voice = PiperVoice.load(str(MODEL))
lock = Lock()
cache: "OrderedDict[str, bytes]" = OrderedDict()


def synth(text: str) -> bytes:
    text = re.sub(r"\b911\b", "nine one one", text.strip())[:300]
    if text in cache:
        cache.move_to_end(text)
        return cache[text]
    buf = io.BytesIO()
    with lock, wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w, SynthesisConfig(length_scale=1.06, noise_scale=0.55, noise_w_scale=0.7))
    data = buf.getvalue()
    cache[text] = data
    if len(cache) > 300:
        cache.popitem(last=False)
    return data


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200, ctype="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "max-age=3600")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/health":
            self._headers()
            self.wfile.write(b'{"ok":true,"voice":"en_US-lessac-medium"}')
            return
        if url.path == "/tts":
            text = (parse_qs(url.query).get("text") or [""])[0]
            if not text.strip():
                self._headers(400)
                return
            data = synth(text)
            self._headers(200, "audio/wav")
            self.wfile.write(data)
            return
        self._headers(404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Mayday voice on http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
