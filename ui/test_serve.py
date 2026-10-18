"""Regression tests for ui/serve.py's path restrictions.

Run from the repo root (standard library only):
    python3 -m unittest ui/test_serve.py -v
"""
import functools
import http.client
import http.server
import threading
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import REPO_ROOT, TestbedHandler, is_safe_url_path  # noqa: E402


class ServeRestrictionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(TestbedHandler, directory=str(REPO_ROOT))
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, raw_path):
        # http.client sends the path verbatim (no client-side normalisation).
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request("GET", raw_path)
            resp = conn.getresponse()
            return resp.status, resp.getheader("Content-Type"), resp.read()
        finally:
            conn.close()

    def test_allowed_files_are_served(self):
        for path in ("/ui/", "/ui/index.html", "/ui/js/app.js",
                     "/docs/CLAUDE_CODE_SETUP.md", "/tasks/TEMPLATE_TASK.md"):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 200)

    def test_root_redirects_to_app(self):
        self.assertEqual(self.get("/")[0], 302)

    def test_manifest_mime_type(self):
        status, ctype, _ = self.get("/ui/manifest.webmanifest")
        self.assertEqual(status, 200)
        self.assertEqual(ctype, "application/manifest+json")

    def test_repository_internals_are_not_served(self):
        blocked = [
            # plain
            "/.git/config", "/.git/HEAD", "/.gitignore", "/README.md",
            # literal traversal
            "/ui/../.git/config", "/ui/../README.md", "/docs/../.git/HEAD",
            # percent-encoded traversal and dotfiles (ChatGPT review, PR #6)
            "/ui/%2e%2e/%2egit/config", "/ui/%2E%2E/%2Egit/HEAD",
            "/ui/%2e%2e/README.md", "/ui/.%2e/.%2e/README.md",
            "/%2egit/config", "/ui/%2egitignore", "/docs/%2e%2e/%2e%2e/etc/passwd",
            # encoded slash
            "/ui/..%2f.git/config", "/ui/%2e%2e%2f%2egit%2fconfig",
            # encoded backslash (Windows separator) and NUL
            "/ui/x%5C..%5C..%5C.git%5Cconfig", "/ui/..%5C.git%5Cconfig",
            "/ui/index.html%00.md",
            # directory listings
            "/ui/js/", "/docs/",
        ]
        for path in blocked:
            with self.subTest(path=path):
                status, _, body = self.get(path)
                self.assertEqual(status, 404, f"{path} returned {status}")
                self.assertNotIn(b"[core]", body)


class SafePathHelperTest(unittest.TestCase):
    """Platform-independent checks of the path filter itself (no server)."""

    def test_safe_paths(self):
        for path in ("/ui/", "/ui/js/app.js", "/docs/AI_REVIEWER_CHARTER.md", "/ui/icons/icon-192.png"):
            with self.subTest(path=path):
                self.assertTrue(is_safe_url_path(path))

    def test_unsafe_paths(self):
        for path in (
            "/ui/../.git/config", "/.git/HEAD", "/ui/.hidden",
            "/ui/%2e%2e/%2egit/config", "/ui/%2Egit",
            "/ui/x\\..\\.git\\config", "/ui/x%5C..%5C.git%5Cconfig", "/ui/%5c",
            "/ui/a%00b",
        ):
            with self.subTest(path=path):
                self.assertFalse(is_safe_url_path(path))


if __name__ == "__main__":
    unittest.main()
