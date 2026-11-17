#!/usr/bin/env python3
"""Regeneration gate for the Jomission/LANSA (OPEN-38) status the Labyrinth cards show.

jomission's generator (`scripts/open38_status.py`, schema o38s_status/1) is the only authority for a status.
This tool holds no status logic. It proves that the committed snapshot is what that generator writes at the
pinned source commit, and only then builds the file the pages load.

  data/o38s/source.json          the pin: repository, branch ref, commit, Python version (reviewed by hand)
  data/o38s/status.json          the committed snapshot: the generator's JSON at the pinned commit
  assets/data/o38s_status.js     the artifact the pages load: the snapshot's exact bytes plus a verification
                                 record. Never committed; written only by `build`, only after `verify` passes.

Commands:
  verify    clone the pinned repository, check the pinned commit out, run the generator, compare. Exit 1 on
            any mismatch, failure, missing source or unreadable provenance.
  build     verify, then write the artifact, bound to the snapshot's sha256 and the site commit. On a refusal
            or a crash the artifact is removed, so the pages show UNKNOWN.
  refresh   regenerate the snapshot at the pinned commit (`--to-tip` first moves the pin to the tip of its ref).

Equality with the generator is consistency, not scientific correctness, and it says nothing about whether the
pinned commit deserves trust: the pin is changed by a reviewed commit, never by this tool unasked.
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "o38s_status/1"
VERIFICATION_SCHEMA = "o38s_verification/1"
ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = Path("data/o38s/status.json")
PIN = Path("data/o38s/source.json")
ARTIFACT = Path("assets/data/o38s_status.js")
VOLATILE = ("generated_utc",)  # the only field that differs between two runs at one commit
CLOCK_SKEW_S = 300
SHA = re.compile(r"[0-9a-f]{40}")
UTC = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ")
HEADER = (
    "// Built by tools/o38s_status.py build after the regeneration gate passed. Not committed, never edited:\n"
    "// the pages show UNKNOWN without it or when it does not match its verification record.\n"
)


class Refused(Exception):
    pass


def run(cmd, cwd=None):
    return subprocess.run([str(c) for c in cmd], cwd=cwd, capture_output=True, text=True, stdin=subprocess.DEVNULL)


def git(repo, *args):
    r = run(["git", "-C", repo, *args])
    if r.returncode != 0:
        raise Refused(f"git {' '.join(args[:2])} failed: {r.stderr.strip()[-200:]}")
    return r.stdout.strip()


def now_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical(status):
    """The committed form of a snapshot: the generator's key order, one fixed layout."""
    return (json.dumps(status, indent=1, ensure_ascii=True) + "\n").encode("ascii")


def epoch(utc):
    return datetime.strptime(utc, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


def differing(a, b, path=""):
    """Paths where two JSON values differ (for the refusal message)."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}/{k}")
            else:
                out += differing(a[k], b[k], f"{path}/{k}")
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [p for i, (x, y) in enumerate(zip(a, b)) for p in differing(x, y, f"{path}/{i}")]
    return [] if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True) else [path or "/"]


def read_pin(path):
    try:
        pin = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise Refused(f"the source pin is unreadable: {exc}")
    if not isinstance(pin, dict):
        raise Refused("the source pin is not an object")
    for key in ("repo_url", "ref", "sha", "python"):
        if not isinstance(pin.get(key), str) or not pin[key]:
            raise Refused(f"the source pin has no {key}")
    if not SHA.fullmatch(pin["sha"]):
        raise Refused("the pinned sha is not a 40-hex commit")
    if not re.fullmatch(r"refs/heads/[A-Za-z0-9._/-]+", pin["ref"]):
        raise Refused("the pinned ref is not a branch ref")
    return pin


def check_python(pin):
    have = f"{sys.version_info.major}.{sys.version_info.minor}"
    if have != pin["python"]:
        raise Refused(f"this is Python {have}; the pin requires {pin['python']}")


def fetch_source(pin, workdir):
    """A checkout of the pinned repository at the pinned commit, on the pinned branch, or Refused."""
    branch = pin["ref"][len("refs/heads/"):]
    src = Path(workdir) / "source"
    r = run(["git", "-c", "core.autocrlf=false", "clone", "-q", "--no-checkout", "--single-branch", "--branch", branch,
             "-c", "core.autocrlf=false", pin["repo_url"], src])
    if r.returncode != 0:
        raise Refused(f"the pinned repository or ref is not reachable: {r.stderr.strip()[-200:]}")
    if run(["git", "-C", src, "cat-file", "-e", pin["sha"] + "^{commit}"]).returncode != 0:
        raise Refused(f"commit {pin['sha'][:10]} is not in {pin['ref']} of the pinned repository")
    if run(["git", "-C", src, "merge-base", "--is-ancestor", pin["sha"], f"origin/{branch}"]).returncode != 0:
        raise Refused(f"commit {pin['sha'][:10]} is not an ancestor of {pin['ref']}")
    git(src, "checkout", "-q", "-B", branch, pin["sha"])
    if git(src, "rev-parse", "HEAD") != pin["sha"]:
        raise Refused("the checkout is not at the pinned commit")
    return src


def regenerate(pin, run_tests=False):
    """The generator's JSON at the pinned commit, from a fresh clone, and that commit's time; or Refused."""
    check_python(pin)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        src = fetch_source(pin, tmp)
        committed = int(git(src, "show", "-s", "--format=%ct", pin["sha"]))
        out = Path(tmp) / "status.json"
        cmd = [sys.executable, "-B", src / "scripts" / "open38_status.py", out, "--repo", src]
        if run_tests:
            cmd.append("--run-tests")
        r = run(cmd)
        if r.returncode != 0 or not out.is_file():
            raise Refused(f"the generator failed (exit {r.returncode}): {r.stderr.strip()[-300:]}")
        try:
            status = json.loads(out.read_text(encoding="utf-8"))
        except (ValueError, RecursionError) as exc:
            raise Refused(f"the generator's output is not JSON: {exc}")
    check_provenance(status, pin, "the generator's output")
    return status, committed


def check_provenance(status, pin, what):
    if not isinstance(status, dict) or status.get("schema") != SCHEMA:
        raise Refused(f"{what}: schema is not {SCHEMA}")
    source = status.get("source") if isinstance(status.get("source"), dict) else {}
    if source.get("sha") != pin["sha"]:
        raise Refused(f"{what}: source.sha {str(source.get('sha'))[:10]} is not the pinned {pin['sha'][:10]}")
    if source.get("repo_url") != pin["repo_url"]:
        raise Refused(f"{what}: source.repo_url is not the pinned repository")
    if source.get("dirty_tracked") is not False:
        raise Refused(f"{what}: source.dirty_tracked is not false")
    if not isinstance(status.get("generated_utc"), str) or not UTC.fullmatch(status["generated_utc"]):
        raise Refused(f"{what}: generated_utc is not a UTC time")


def read_snapshot(path):
    try:
        raw = Path(path).read_bytes()
    except OSError as exc:
        raise Refused(f"the snapshot is unreadable: {exc}")
    try:
        status = json.loads(raw.decode("ascii"))
    except (ValueError, RecursionError) as exc:
        raise Refused(f"the snapshot is not ASCII JSON: {exc}")
    if not isinstance(status, dict) or canonical(status) != raw:
        raise Refused("the snapshot is not in the committed form (rewrite it with `refresh`, never by hand)")
    return raw, status


def verify(site, run_tests=False):
    """The snapshot's bytes and a verification record without the site binding, or Refused."""
    site = Path(site)
    pin = read_pin(site / PIN)
    raw, status = read_snapshot(site / SNAPSHOT)
    check_provenance(status, pin, "the snapshot")
    fresh, committed = regenerate(pin, run_tests)
    # Byte for byte the generator's output, key order included, once the generation time is set aside.
    if canonical({**fresh, **{k: status.get(k) for k in VOLATILE}}) != raw:
        where = [p for p in differing(status, fresh) if p.strip("/") not in VOLATILE][:8]
        raise Refused("the snapshot is not the generator's output at the pinned commit; differs at "
                      + (", ".join(where) or "the order of its keys"))
    # The generation time cannot be regenerated, so it is bounded: after the source commit, before this run.
    made = epoch(status["generated_utc"])
    if made < committed - CLOCK_SKEW_S or made > epoch(fresh["generated_utc"]) + CLOCK_SKEW_S:
        raise Refused(f"generated_utc {status['generated_utc']} is before the pinned commit or after this verification")
    return raw, {
        "schema": VERIFICATION_SCHEMA,
        "snapshot_sha256": hashlib.sha256(raw).hexdigest(),
        "source_repo": pin["repo_url"],
        "source_ref": pin["ref"],
        "source_sha": pin["sha"],
        "python": pin["python"],
        "verified_utc": now_utc(),
    }


def site_commit(site):
    """The site commit the artifact is bound to: its tracked files unmodified, the artifact never tracked."""
    head = git(site, "rev-parse", "HEAD")
    if not SHA.fullmatch(head):
        raise Refused("the site has no commit")
    for rel in (SNAPSHOT, PIN):
        if run(["git", "-C", site, "ls-files", "--error-unmatch", rel.as_posix()]).returncode != 0:
            raise Refused(f"{rel.as_posix()} is not committed")
    if run(["git", "-C", site, "ls-files", "--error-unmatch", ARTIFACT.as_posix()]).returncode == 0:
        raise Refused(f"{ARTIFACT.as_posix()} is committed; the artifact is built, never committed")
    if git(site, "status", "--porcelain", "--untracked-files=no"):
        raise Refused("the site has modified tracked files; the artifact is bound to a commit")
    return head


def artifact_text(raw, verification):
    body = {"snapshot_text": raw.decode("ascii"), "verification": verification}
    return HEADER + "window.O38S_ARTIFACT = " + json.dumps(body, indent=1, ensure_ascii=True) + ";\n"


def build(site, run_tests=False):
    site = Path(site)
    out = site / ARTIFACT
    try:
        head = site_commit(site)
        raw, verification = verify(site, run_tests)
        if (site / SNAPSHOT).read_bytes() != raw or site_commit(site) != head:
            raise Refused("the site changed during verification")
    except BaseException:  # a refusal, a crash or an interrupt: fail closed, so the pages show UNKNOWN
        out.unlink(missing_ok=True)
        raise
    verification["site_sha"] = head
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(artifact_text(raw, verification).encode("ascii"))
    return verification


def refresh(site, to_tip=False, run_tests=False):
    site = Path(site)
    pin = read_pin(site / PIN)
    if to_tip:
        listed = run(["git", "ls-remote", pin["repo_url"], pin["ref"]]).stdout.split()
        if len(listed) != 2 or not SHA.fullmatch(listed[0]):
            raise Refused(f"{pin['ref']} is not readable on the pinned repository")
        pin["sha"] = listed[0]
    status, _ = regenerate(pin, run_tests)
    if to_tip:
        (site / PIN).write_bytes((json.dumps(pin, indent=1) + "\n").encode("ascii"))
    (site / SNAPSHOT).parent.mkdir(parents=True, exist_ok=True)
    (site / SNAPSHOT).write_bytes(canonical(status))
    return status


def main(argv=None):
    ap = argparse.ArgumentParser(description="Regeneration gate for the OPEN-38 status snapshot.")
    ap.add_argument("command", choices=("verify", "build", "refresh"))
    ap.add_argument("--site", default=str(ROOT), help="the site checkout (default: this one)")
    ap.add_argument("--run-tests", action="store_true", help="pass --run-tests to the generator")
    ap.add_argument("--to-tip", action="store_true", help="refresh only: move the pin to the tip of its ref first")
    args = ap.parse_args(argv)
    try:
        if args.command == "verify":
            _, v = verify(args.site, args.run_tests)
            print(f"VERIFIED: snapshot {v['snapshot_sha256'][:12]} is the generator's output at {v['source_sha'][:10]}")
        elif args.command == "build":
            v = build(args.site, args.run_tests)
            print(f"BUILT {ARTIFACT.as_posix()}: snapshot {v['snapshot_sha256'][:12]}, source {v['source_sha'][:10]}, "
                  f"site {v['site_sha'][:10]}, verified {v['verified_utc']}")
        else:
            s = refresh(args.site, args.to_tip, args.run_tests)
            print(f"wrote {SNAPSHOT.as_posix()}: source {s['source']['sha'][:10]}, generated {s['generated_utc']}")
    except Refused as exc:
        sys.stderr.write(f"REFUSED: {exc}\n")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
