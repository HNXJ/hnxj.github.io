"""Tests of the regeneration gate (tools/o38s_status.py) against throwaway repositories.

The source repository holds a stand-in for jomission's scripts/open38_status.py that writes the committed
template (this site's genuine snapshot) with its own git provenance, so the gate is tested as a comparison with
a generator, never with status rules. `O38S_LIVE=1` adds a run against the real pinned repository.

Run: python -m unittest discover -s tests -p "test_*.py"
"""

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import o38s_status as gate  # noqa: E402

GENERATOR = '''import json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
out, repo = sys.argv[1], Path(sys.argv[sys.argv.index("--repo") + 1])
def g(*a):
    return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True).stdout.strip()
rc = repo / "generator_rc.txt"
if rc.exists():
    sys.exit(int(rc.read_text()))
raw = (repo / "template.json").read_text(encoding="utf-8")
if raw.startswith("{"):
    status = json.loads(raw)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status["generated_utc"] = (repo / "now.txt").read_text().strip() if (repo / "now.txt").exists() else now
    status["source"] = {"sha": g("rev-parse", "HEAD"), "branch": g("rev-parse", "--abbrev-ref", "HEAD"),
                        "dirty_tracked": bool(g("status", "--porcelain", "--untracked-files=no")),
                        "repo_url": (repo / "repo_url.txt").read_text().strip()}
    status.update(json.loads((repo / "override.json").read_text()) if (repo / "override.json").exists() else {})
    raw = json.dumps(status)
Path(out).write_text(raw, encoding="utf-8")
'''

GENUINE = json.loads((ROOT / "data" / "o38s" / "status.json").read_text(encoding="ascii"))
CASES = json.loads((ROOT / "tests" / "fixtures" / "o38s_contradictions.json").read_text(encoding="utf-8"))["cases"]
PYTHON = f"{sys.version_info.major}.{sys.version_info.minor}"


def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.invalid",
                        "-c", "core.autocrlf=false", *args], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        raise AssertionError(f"git {args}: {r.stderr}")
    return r.stdout.strip()


def mutate(status, case):
    """A copy of a snapshot with one fixture case applied (paths are /-separated)."""
    status = json.loads(json.dumps(status))
    for path, value in case.get("set", {}).items():
        node, parts = status, path.split("/")
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    for path in case.get("delete", []):
        node, parts = status, path.split("/")
        for part in parts[:-1]:
            node = node[part]
        del node[parts[-1]]
    return status


class GateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        self.origin, self.src, self.site = base / "origin.git", base / "src", base / "site"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "status", str(self.origin)], check=True)
        subprocess.run(["git", "init", "-q", "-b", "status", str(self.src)], check=True)
        (self.src / "scripts").mkdir()
        (self.src / "scripts" / "open38_status.py").write_text(GENERATOR, encoding="utf-8")
        (self.src / "repo_url.txt").write_text(str(self.origin), encoding="utf-8")
        (self.src / "template.json").write_text(json.dumps(GENUINE), encoding="utf-8")
        git(self.src, "remote", "add", "origin", str(self.origin))
        self.source_sha = self.commit_source()

        subprocess.run(["git", "init", "-q", "-b", "main", str(self.site)], check=True)
        (self.site / "data" / "o38s").mkdir(parents=True)
        self.write_pin(sha=self.source_sha)
        gate.refresh(self.site)
        self.commit_site()

    # --- fixtures
    def commit_source(self, push=True, **files):
        for name, text in files.items():
            (self.src / name).write_text(text, encoding="utf-8")
        git(self.src, "add", "-A")
        git(self.src, "commit", "-q", "-m", "source")
        if push:
            git(self.src, "push", "-q", "origin", "HEAD")
        return git(self.src, "rev-parse", "HEAD")

    def write_pin(self, **changes):
        pin = {"repo_url": str(self.origin), "ref": "refs/heads/status", "sha": self.source_sha, "python": PYTHON}
        pin.update(changes)
        (self.site / gate.PIN).write_text(json.dumps(pin, indent=1) + "\n", encoding="ascii")

    def commit_site(self):
        git(self.site, "add", gate.PIN.as_posix(), gate.SNAPSHOT.as_posix())
        git(self.site, "commit", "-q", "--allow-empty", "-m", "site")
        return git(self.site, "rev-parse", "HEAD")

    def snapshot(self):
        return json.loads((self.site / gate.SNAPSHOT).read_text(encoding="ascii"))

    def write_snapshot(self, status):
        (self.site / gate.SNAPSHOT).write_bytes(gate.canonical(status))

    def artifact(self):
        text = (self.site / gate.ARTIFACT).read_text(encoding="ascii")
        return json.loads(text[text.index("window.O38S_ARTIFACT = ") + len("window.O38S_ARTIFACT = "):].rstrip().rstrip(";"))

    def assert_refused(self, expect, commit=True):
        """`verify` refuses with the expected reason; `build` refuses too and leaves no artifact."""
        if commit:
            self.commit_site()
        with self.assertRaises(gate.Refused) as caught:
            gate.verify(self.site)
        self.assertIn(expect, str(caught.exception))
        (self.site / gate.ARTIFACT).parent.mkdir(parents=True, exist_ok=True)
        (self.site / gate.ARTIFACT).write_text("window.O38S_ARTIFACT = {};", encoding="ascii")  # an earlier build
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 1)
        self.assertFalse((self.site / gate.ARTIFACT).exists(), "a refused build must leave no artifact")

    # --- genuine snapshots
    def test_genuine_snapshot_is_verified_and_built_with_its_exact_bytes(self):
        raw = (self.site / gate.SNAPSHOT).read_bytes()
        head = git(self.site, "rev-parse", "HEAD")
        self.assertEqual(gate.main(["verify", "--site", str(self.site)]), 0)
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 0)
        built = self.artifact()
        self.assertEqual(built["snapshot_text"].encode("ascii"), raw)
        v = built["verification"]
        self.assertEqual(v["snapshot_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual((v["site_sha"], v["source_sha"], v["source_repo"]), (head, self.source_sha, str(self.origin)))
        self.assertEqual(v["schema"], "o38s_verification/1")
        self.assertRegex(v["verified_utc"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        self.assertEqual(json.loads(built["snapshot_text"])["stage1"]["public_status"], "PASS", "fixture must hold a PASS")

    def test_generation_time_alone_may_differ(self):
        later = datetime.fromtimestamp(time.time() + 3600, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.assertNotEqual(self.snapshot()["generated_utc"], later)
        self.source_sha = self.commit_source(**{"now.txt": later})
        self.write_pin()
        status = self.snapshot()
        status["source"]["sha"] = self.source_sha  # the pin moved by a reviewed commit; the time was not regenerated
        self.write_snapshot(status)
        self.commit_site()
        self.assertEqual(gate.main(["verify", "--site", str(self.site)]), 0)

    def test_valid_fail_and_unknown_are_preserved_without_reinterpretation(self):
        override = {"stage1": dict(GENUINE["stage1"], status="FAIL", public_status="FAIL", reason="checker receipts"),
                    "stage2": dict(GENUINE["stage2"], status="UNKNOWN", public_status="UNKNOWN")}
        self.source_sha = self.commit_source(**{"override.json": json.dumps(override)})
        self.write_pin()
        gate.refresh(self.site)
        self.commit_site()
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 0)
        shown = json.loads(self.artifact()["snapshot_text"])
        self.assertEqual(shown["stage1"], override["stage1"])
        self.assertEqual(shown["stage2"], override["stage2"])

    # --- snapshots the generator did not write
    def test_contradictory_snapshots_are_refused(self):
        self.assertGreaterEqual(len(CASES), 11)
        for case in CASES:
            with self.subTest(case["name"]):
                genuine = self.snapshot()
                changed = mutate(genuine, case)
                self.assertNotEqual(changed, genuine, "the case must change the snapshot")
                self.write_snapshot(changed)
                self.assert_refused("not the generator's output")
                self.write_snapshot(genuine)
                self.commit_site()
                self.assertEqual(gate.main(["verify", "--site", str(self.site)]), 0, "the genuine snapshot must pass again")

    def test_a_value_of_another_type_is_a_mismatch(self):
        status = self.snapshot()
        self.assertIs(status["stage1"]["committed"], True)
        status["stage1"]["committed"] = 1  # equal to True in Python, not in the snapshot
        self.write_snapshot(status)
        self.assert_refused("not the generator's output")

    def test_reordered_keys_are_a_mismatch(self):
        status = self.snapshot()
        reordered = dict(reversed(list(status.items())))
        self.assertEqual(reordered, status)
        self.assertNotEqual(gate.canonical(reordered), gate.canonical(status), "the case must change the bytes")
        self.write_snapshot(reordered)
        self.assert_refused("the order of its keys")

    def test_generation_time_outside_its_bounds_is_refused(self):
        for when in ("2020-01-01T00:00:00Z", "2099-01-01T00:00:00Z"):
            with self.subTest(when):
                self.write_snapshot(dict(self.snapshot(), generated_utc=when))
                self.assert_refused("is before the pinned commit or after this verification")

    def test_a_crashed_build_leaves_no_artifact(self):
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 0)
        self.assertTrue((self.site / gate.ARTIFACT).exists(), "fixture must hold an earlier artifact")
        with mock.patch.object(gate, "regenerate", side_effect=RuntimeError("crash")):
            with self.assertRaises(RuntimeError):
                gate.build(self.site)
        self.assertFalse((self.site / gate.ARTIFACT).exists(), "a crashed build must leave no artifact")

    def test_snapshot_that_is_not_in_the_committed_form_is_refused(self):
        raw = (self.site / gate.SNAPSHOT).read_bytes()
        (self.site / gate.SNAPSHOT).write_bytes(raw.replace(b'"schema"', b'"stage1": {"public_status": "FAIL"},\n "schema"', 1))
        self.assert_refused("committed form")  # a duplicate key a parser would drop
        (self.site / gate.SNAPSHOT).write_bytes(b"not json")
        self.assert_refused("not ASCII JSON")
        (self.site / gate.SNAPSHOT).write_bytes(b"[" * 200000)  # too deep to parse
        self.assert_refused("not ASCII JSON")
        (self.site / gate.SNAPSHOT).unlink()
        self.assert_refused("unreadable", commit=False)

    # --- source
    def test_snapshot_source_that_is_not_the_pin_is_refused(self):
        other = self.commit_source(**{"note.txt": "x"})
        status = self.snapshot()
        status["source"]["sha"] = other
        self.write_snapshot(status)
        self.assert_refused("is not the pinned")
        status["source"].update(sha=self.source_sha, repo_url="https://github.com/other/repo")
        self.write_snapshot(status)
        self.assert_refused("not the pinned repository")
        status["source"].update(repo_url=str(self.origin), dirty_tracked=True)
        self.write_snapshot(status)
        self.assert_refused("dirty_tracked")

    def test_missing_source_revision_is_refused(self):
        status = self.snapshot()
        status["source"]["sha"] = "f" * 40
        self.write_snapshot(status)
        self.write_pin(sha="f" * 40)
        self.assert_refused("is not in refs/heads/status")

    def test_inaccessible_repository_or_ref_is_refused(self):
        self.write_pin(ref="refs/heads/absent")
        self.assert_refused("not reachable")
        gone = str(Path(self.tmp.name) / "gone.git")
        status = self.snapshot()
        status["source"]["repo_url"] = gone
        self.write_snapshot(status)
        self.write_pin(repo_url=gone)
        self.assert_refused("not reachable")

    def test_commit_outside_the_pinned_ref_is_refused(self):
        git(self.src, "checkout", "-q", "-b", "elsewhere")
        other = self.commit_source(**{"template.json": json.dumps(dict(GENUINE, current_stage="stage 2"))})
        git(self.src, "checkout", "-q", "status")
        status = dict(self.snapshot(), current_stage="stage 2")
        status["source"]["sha"] = other
        self.write_snapshot(status)
        self.write_pin(sha=other)
        self.assert_refused("is not an ancestor of refs/heads/status")  # in the repository, not on the pinned branch

    def test_unreadable_or_malformed_pin_is_refused(self):
        for text, expect in (("not json", "unreadable"), ("[]", "not an object"),
                             (json.dumps({"repo_url": "x", "ref": "refs/heads/status", "sha": "abc", "python": PYTHON}), "40-hex"),
                             (json.dumps({"repo_url": "x", "ref": "refs/tags/v1", "sha": "a" * 40, "python": PYTHON}), "branch ref"),
                             (json.dumps({"ref": "refs/heads/status", "sha": "a" * 40, "python": PYTHON}), "no repo_url")):
            (self.site / gate.PIN).write_text(text, encoding="ascii")
            self.assert_refused(expect)

    def test_another_python_version_is_refused(self):
        self.write_pin(python="2.7")
        self.assert_refused("the pin requires 2.7")

    # --- generator
    def test_generator_failure_and_output_that_is_not_json_are_refused(self):
        genuine = self.snapshot()
        self.source_sha = self.commit_source(**{"generator_rc.txt": "3"})
        genuine["source"]["sha"] = self.source_sha
        self.write_snapshot(genuine)
        self.write_pin()
        self.assert_refused("generator failed (exit 3)")
        (self.src / "generator_rc.txt").unlink()
        self.source_sha = self.commit_source(**{"template.json": "not json"})
        genuine["source"]["sha"] = self.source_sha
        self.write_snapshot(genuine)
        self.write_pin()
        self.assert_refused("not JSON")

    def test_generator_output_that_changed_is_a_mismatch(self):
        genuine = self.snapshot()
        self.source_sha = self.commit_source(**{"override.json": json.dumps({"tests": dict(GENUINE["tests"], defined=1)})})
        genuine["source"]["sha"] = self.source_sha
        self.write_snapshot(genuine)
        self.write_pin()
        self.assert_refused("differs at /tests/defined")

    # --- binding to the site commit
    def test_build_is_bound_to_a_clean_site_commit_and_an_untracked_artifact(self):
        status = self.snapshot()
        (self.site / "page.html").write_text("a", encoding="ascii")
        git(self.site, "add", "page.html")
        git(self.site, "commit", "-q", "-m", "page")
        (self.site / "page.html").write_text("b", encoding="ascii")
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 1)  # a tracked file is modified
        self.assertFalse((self.site / gate.ARTIFACT).exists())
        git(self.site, "checkout", "-q", "--", "page.html")
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 0)
        git(self.site, "add", "-f", gate.ARTIFACT.as_posix())
        git(self.site, "commit", "-q", "-m", "artifact committed by hand")
        self.assertEqual(gate.main(["build", "--site", str(self.site)]), 1)  # the artifact must never be tracked
        self.assertFalse((self.site / gate.ARTIFACT).exists())
        self.assertEqual(status, self.snapshot())

    def test_refresh_to_tip_moves_the_pin_and_the_snapshot_together(self):
        tip = self.commit_source(**{"note.txt": "newer"})
        self.assertEqual(gate.main(["refresh", "--to-tip", "--site", str(self.site)]), 0)
        self.assertEqual(json.loads((self.site / gate.PIN).read_text())["sha"], tip)
        self.assertEqual(self.snapshot()["source"]["sha"], tip)
        self.commit_site()
        self.assertEqual(gate.main(["verify", "--site", str(self.site)]), 0)


@unittest.skipUnless(os.environ.get("O38S_LIVE") == "1", "set O38S_LIVE=1 to run against the real pinned repository")
class LiveGateTest(unittest.TestCase):
    """The committed snapshot and every contradictory case, against jomission's generator at the pinned commit."""

    def test_committed_snapshot_is_verified_and_each_contradiction_refused(self):
        pin = gate.read_pin(ROOT / gate.PIN)
        raw, verification = gate.verify(ROOT)  # the gate itself, on this checkout
        self.assertEqual(raw, (ROOT / gate.SNAPSHOT).read_bytes())
        self.assertEqual(verification["source_sha"], pin["sha"])
        for case in CASES:  # the gate compares bytes with the generator's output, which `raw` equals
            with self.subTest(case["name"]):
                self.assertNotEqual(gate.canonical(mutate(GENUINE, case)), raw)


if __name__ == "__main__":
    unittest.main()
