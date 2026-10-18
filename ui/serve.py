#!/usr/bin/env python3
"""Local preview server for the Control Tower UI testbed.

Serves only the folders the UI needs (ui/, docs/, tasks/) from the repo
root. Everything else -- .git, dotfiles, any other path -- returns 404, so
running this on your Wi-Fi never exposes repository internals.

Usage (from anywhere):
    python3 ui/serve.py              # http://127.0.0.1:8000/ui/  (this machine only)
    python3 ui/serve.py --lan        # also reachable from a phone on the same network
    python3 ui/serve.py --port 9000

Standard library only; no install step.
"""
import argparse
import functools
import http.server
import mimetypes
import socket
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ALLOWED_DIRS = tuple((REPO_ROOT / d).resolve() for d in ("ui", "docs", "tasks"))

# Python's table lacks the web app manifest type Chrome expects.
mimetypes.add_type("application/manifest+json", ".webmanifest")


def is_safe_url_path(path):
    """True if a URL path is safe to map onto the file system.

    Checks the *decoded* path, since translate_path() percent-decodes (so a
    raw check would miss %2e%2e for .. and %2egit for .git):
    - backslashes are refused outright -- they are path separators on
      Windows and could hide ..\\.git inside one URL component;
    - NUL bytes are refused;
    - any component starting with "." (traversal or hidden file) is refused.
    """
    decoded = urllib.parse.unquote(path)
    if "\\" in decoded or "\x00" in decoded:
        return False
    return not any(part.startswith(".") for part in decoded.split("/") if part)


class TestbedHandler(http.server.SimpleHTTPRequestHandler):
    """Static handler restricted to ALLOWED_DIRS, no directory listings."""

    def _path_only(self):
        return self.path.split("?", 1)[0].split("#", 1)[0]

    def _is_allowed(self):
        path = self._path_only()
        if not is_safe_url_path(path):
            return False
        # The file actually served must sit inside an allowed folder
        # (resolve() also follows symlinks), not merely inside the repo.
        target = Path(self.translate_path(path)).resolve()
        return any(target == d or d in target.parents for d in ALLOWED_DIRS)

    def send_head(self):
        path = self._path_only()
        if path in ("", "/"):
            # Convenience: the bare host opens the app.
            self.send_response(302)
            self.send_header("Location", "/ui/")
            self.end_headers()
            return None
        if not self._is_allowed():
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        # Folders without index.html are not browsable.
        self.send_error(404)
        return None

    def end_headers(self):
        # Always serve fresh files while iterating on the UI.
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def lan_address():
    """Best-effort local network IP (no packets are actually sent)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return None


def main():
    parser = argparse.ArgumentParser(description="Serve the Control Tower UI testbed locally.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--lan", action="store_true",
                        help="listen on all interfaces so a phone on the same network can connect")
    args = parser.parse_args()

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    handler = functools.partial(TestbedHandler, directory=str(REPO_ROOT))
    server = http.server.ThreadingHTTPServer((host, args.port), handler)

    print(f"Control Tower UI testbed: http://127.0.0.1:{args.port}/ui/")
    if args.lan:
        ip = lan_address()
        print(f"On your phone (same Wi-Fi): http://{ip or '<this-computer-ip>'}:{args.port}/ui/")
        print("Serving ui/, docs/ and tasks/ only. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
