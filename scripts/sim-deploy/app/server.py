"""ui de mentira para o sim-deploy: demora a abrir a porta 80 e responde a versão em /."""
import os
import signal
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

VERSION = os.environ.get("SIM_VERSION", "dev")
DELAY = float(os.environ.get("SIM_START_DELAY", "3"))
BROKEN = os.environ.get("SIM_HEALTH", "up") == "down"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if BROKEN:
            self._send(503, "down")
        else:
            self._send(200, VERSION)

    def _send(self, code, body):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    # A porta só abre depois do tempo de partida, para o health check precisar de retentativas.
    # Como o nginx: sai logo no SIGTERM (python como PID 1 ignoraria o sinal).
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    time.sleep(DELAY)
    print("fake-ui %s listening on 80 (broken=%s)" % (VERSION, BROKEN), flush=True)
    HTTPServer(("0.0.0.0", 80), Handler).serve_forever()
