#!/usr/bin/env python3
"""Servidor estático local sin caché (evita JS cacheado en desarrollo)."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.chdir(DIR)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
