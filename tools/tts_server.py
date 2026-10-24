"""
Local neural voice server: speaks any line in the same voice as the
pre-recorded clips (tools/voice_engine.py), for lines that only exist at
runtime: AI-adapted phrasing, the address read out for 911. Runs on this
computer next to the phone mirror.

    ~/tools/kokoro_venv/Scripts/python tools/tts_server.py   # http://127.0.0.1:8743/tts?text=Kneel+beside+his+chest.

On a phone, lines that are not pre-recorded use the phone's own voice instead.
"""
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import parse_qs, urlparse

from voice_engine import Voice, wav_bytes

PORT = 8743
voice = Voice()
lock = Lock()
cache: "OrderedDict[str, bytes]" = OrderedDict()


def synth(text: str) -> bytes:
    text = text.strip()[:300]
    if text in cache:
        cache.move_to_end(text)
        return cache[text]
    with lock:
        pcm, rate = voice.synth(text, speed=0.94)
    data = wav_bytes(pcm, rate)
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
            self.wfile.write(f'{{"ok":true,"voice":"{voice.name}"}}'.encode())
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
