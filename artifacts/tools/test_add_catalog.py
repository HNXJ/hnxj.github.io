#!/usr/bin/env python3
"""Tests for add_catalog.py. Each test copies the tool and a fixture projects.js into a temp repo.

Run: python artifacts/tools/test_add_catalog.py
"""

import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
FIXTURE = (
    "// fixture\n"
    "window.PROJECTS = [\n"
    '  {subject: "Existing", name: "Existing", description: "Old.", url: "https://example.org/", '
    'category: "webpage", tags: ["x"]}\n'
    "];\n"
)
EMPTY = "window.PROJECTS = [\n];\n"


class CatalogTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        (self.repo / "artifacts" / "tools").mkdir(parents=True)
        shutil.copy(TOOLS / "add_catalog.py", self.repo / "artifacts" / "tools")
        shutil.copy(TOOLS / "catalog_card.html", self.repo / "artifacts" / "tools")
        (self.repo / "assets" / "cards").mkdir(parents=True)
        (self.repo / "assets" / "cards" / "x.jpg").write_bytes(b"jpg")
        self.projects = self.repo / "assets" / "projects.js"
        self.projects.write_bytes(FIXTURE.encode("utf-8"))  # bytes: write_text would add CRLF on Windows
        self.tool = self.repo / "artifacts" / "tools" / "add_catalog.py"
        self.assertIn('subject: "Existing"', self.projects.read_text(encoding="utf-8"))

    def tearDown(self):
        self._tmp.cleanup()

    def run_tool(self, *args):
        return subprocess.run([sys.executable, str(self.tool), *args],
                              capture_output=True, text=True, encoding="utf-8")

    def digest(self):
        return hashlib.sha256(self.projects.read_bytes()).hexdigest()

    def args(self, subject="New page", desc="A description.", url="https://example.org/new", *extra):
        return ["-s", subject, "-d", desc, "-u", url, *extra]

    def test_add_webpage(self):
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new",
                                     "--tags", "alpha", "beta"))
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.projects.read_text(encoding="utf-8")
        self.assertIn('subject: "New page"', text)
        self.assertIn('category: "webpage"', text)
        self.assertIn('tags: ["alpha", "beta"]', text)
        self.assertIn('tags: ["x"]},', text)  # previous last entry gained its comma
        self.assertTrue(text.rstrip().endswith("];"))

    def test_presentation_adds_slides_tag_and_placeholder(self):
        r = self.run_tool(*self.args("Talk", "Slides.", "https://example.org/talk",
                                     "--presentation", "--render"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('card-thumb-placeholder">Presentation<', r.stdout)
        self.assertIn("View slides →", r.stdout)
        self.assertIn('<span class="tag">slides</span>', r.stdout)

    def test_render_existing_subject_writes_nothing(self):
        # Regression: --render on an existing subject used to refuse on the duplicate check.
        before = self.digest()
        r = self.run_tool(*self.args("Existing", "Old.", "https://example.org/", "--render"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("<h3>Existing</h3>", r.stdout)
        self.assertEqual(self.digest(), before)

    def test_refuses_duplicate_subject(self):
        before = self.digest()
        r = self.run_tool(*self.args("Existing"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("already exists", r.stderr)
        self.assertEqual(self.digest(), before)

    def test_dry_run_prints_and_writes_nothing(self):
        before = self.digest()
        r = self.run_tool(*self.args("New page"), "--dry-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('subject: "New page"', r.stdout)
        self.assertIn("dry run: nothing written", r.stdout)
        self.assertEqual(self.digest(), before)

    def test_refuses_bad_url(self):
        before = self.digest()
        r = self.run_tool(*self.args("New page", url="javascript:alert(1)"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("URL must start", r.stderr)
        self.assertEqual(self.digest(), before)

    def test_refuses_missing_image_and_accepts_root_relative(self):
        before = self.digest()
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new",
                                     "-i", "../assets/cards/none.jpg"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("image not found", r.stderr)
        self.assertEqual(self.digest(), before)
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new",
                                     "-i", "/assets/cards/x.jpg"))
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_refuses_empty_and_over_long(self):
        before = self.digest()
        cases = [
            (self.args("   "), "subject is empty"),
            (self.args("x" * 81), "longer than 80"),
            (self.args("New page", " "), "description is empty"),
            (self.args("New page", "y" * 201), "longer than 200"),
        ]
        for argv, msg in cases:
            r = self.run_tool(*argv)
            self.assertEqual(r.returncode, 1, argv)
            self.assertIn(msg, r.stderr)
        self.assertEqual(self.digest(), before)

    def test_render_escapes_html(self):
        r = self.run_tool(*self.args('A <b>"&"', "Desc & <i>.", "https://example.org/", "--render"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("<b>", r.stdout)
        self.assertNotIn("<i>", r.stdout)
        self.assertIn("A &lt;b&gt;&quot;&amp;&quot;", r.stdout)
        self.assertIn("Desc &amp; &lt;i&gt;.", r.stdout)

    def test_target_only_for_external_url(self):
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new", "--render"))
        self.assertIn('target="_blank"', r.stdout)
        r = self.run_tool(*self.args("New page", "A description.", "/collab/x/", "--render"))
        self.assertNotIn("target=", r.stdout)

    def test_non_ascii_output_on_piped_stdout(self):
        # Regression: a cp1252 pipe crashed on "→" and "×" before the UTF-8 reconfigure.
        r = self.run_tool(*self.args("Bastos × Chao", "Desc.", "https://example.org/", "--render"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("Bastos × Chao", r.stdout)
        self.assertIn("Open site →", r.stdout)

    def test_empty_list(self):
        self.projects.write_bytes(EMPTY.encode("utf-8"))
        r = self.run_tool(*self.args("New page"))
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.projects.read_text(encoding="utf-8")
        self.assertIn('window.PROJECTS = [\n  {subject: "New page"', text)
        self.assertTrue(text.rstrip().endswith("];"))

    def test_refuses_when_no_closing_bracket(self):
        self.projects.write_bytes(b"window.PROJECTS = [ ]\n")
        before = self.digest()
        r = self.run_tool(*self.args("New page"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("could not find the closing", r.stderr)
        self.assertEqual(self.digest(), before)

    def test_keeps_lf_line_endings(self):
        # Regression: write_text on Windows turned every LF into CRLF (whole-file diff).
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn(b"\r", self.projects.read_bytes())

    def test_keeps_crlf_line_endings(self):
        self.projects.write_bytes(FIXTURE.replace("\n", "\r\n").encode("utf-8"))
        r = self.run_tool(*self.args("New page", "A description.", "https://example.org/new"))
        self.assertEqual(r.returncode, 0, r.stderr)
        raw = self.projects.read_bytes()
        self.assertIn(b'subject: "New page"', raw)
        self.assertEqual(raw.count(b"\n"), raw.count(b"\r\n"))


if __name__ == "__main__":
    unittest.main()
