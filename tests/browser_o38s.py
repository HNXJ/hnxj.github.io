"""Browser check of the Labyrinth gallery card and the OPEN-38 board under several artifacts.

Usage: python tests/browser_o38s.py <site root with a built artifact> <out dir>

Needs Playwright with Chromium, and a site where `python tools/o38s_status.py build` has passed (the "real"
case loads that artifact as deployed). The other cases swap the artifact by request interception: each is the
committed snapshot with a change, sealed with a test-only verification record the way the gate seals a verified
one, or left unsealed. Exits 1 when a case shows a PASS it must not, or hides the known PASS of the real case.
"""

import functools
import hashlib
import http.server
import json
import re
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(SITE / "tools"))

import o38s_status as gate  # noqa: E402

built = (SITE / gate.ARTIFACT).read_text(encoding="ascii")
real = json.loads(built[built.index("window.O38S_ARTIFACT = ") + len("window.O38S_ARTIFACT = "):].rstrip().rstrip(";"))
GENUINE = json.loads(real["snapshot_text"])
NOW = gate.now_utc()


def sealed(status, **record):
    """An artifact for a snapshot with a verification record bound to its bytes (test-only: nothing was verified)."""
    raw = gate.canonical(status)
    v = dict(real["verification"], snapshot_sha256=hashlib.sha256(raw).hexdigest(), verified_utc=NOW)
    v.update(record)
    return gate.artifact_text(raw, v)


def changed(**changes):
    status = json.loads(json.dumps(GENUINE))
    for key, value in changes.items():
        node, parts = status, key.split("__")
        for part in parts[:-1]:
            node = node[part]
        node[parts[-1]] = value
    return status


def all_status(value):
    """A snapshot as the generator would write it with every item at one status."""
    status = json.loads(json.dumps(GENUINE))
    for stage in ("stage1", "stage2"):
        status[stage].update(status=value, public_status=value, committed=True, reason="synthetic case",
                             checks={"stage_check": value})
    status["stage2"]["construction_gate"] = {"verdict": value, "family": None}
    status["tests"]["status"] = value
    status["latest_verified_milestone"] = None
    return status


tampered = sealed(GENUINE).replace('\\"public_status\\": \\"UNKNOWN\\"', '\\"public_status\\": \\"PASS\\"')
assert tampered != sealed(GENUINE), "the tampered case must change the snapshot text"

# name -> (artifact body, or None to fail the request; the four pills expected; whether PASS may appear at all)
U4 = ["UNKNOWN"] * 4
CASES = {
    "real": ("as built", ["PASS", "UNKNOWN", "UNKNOWN", "UNKNOWN"], True),
    "stale": (sealed(GENUINE, verified_utc="2026-10-01T00:00:00Z"), U4, False),
    "dirty": (sealed(changed(source__dirty_tracked=True)), U4, False),
    "future": (sealed(GENUINE, verified_utc="2027-06-01T00:00:00Z"), U4, False),
    "schema": (sealed(changed(schema="o38s_status/2")), U4, False),
    "local_only_pass": (sealed(changed(stage1__public_status="UNKNOWN")), U4, False),
    "missing": (None, U4, False),
    "garbage": ("window.O38S_ARTIFACT = 'PASS';", U4, False),
    "fail": (sealed(all_status("FAIL")), ["FAIL"] * 4, False),
    "running": (sealed(all_status("RUNNING")), ["RUNNING"] * 4, False),
    "blocked": (sealed(all_status("BLOCKED")), ["BLOCKED"] * 4, False),
    "unknown": (sealed(all_status("UNKNOWN")), U4, False),
    "unverified": ("window.O38S_ARTIFACT = " + json.dumps({"snapshot_text": real["snapshot_text"]}) + ";", U4, False),
    "bare_snapshot": ("window.O38S_STATUS = " + real["snapshot_text"] + ";", U4, False),
    "tampered": (tampered, U4, False),
    "pass_everywhere": (sealed(all_status("PASS")), ["PASS"] * 4, True),
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}"
OFF_SITE = re.compile(r"^https?://(?!127\.0\.0\.1)")
failures = []

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for name, (body, want, pass_allowed) in CASES.items():
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))

        def make_swap(artifact):
            def swap(route):
                if artifact is None:
                    route.abort()
                else:
                    route.fulfill(status=200, content_type="application/javascript", body=artifact)
            return swap

        if body != "as built":
            page.route("**/assets/data/o38s_status.js", make_swap(body))
        page.route(OFF_SITE, lambda route: route.abort())  # fonts are not needed for the check

        page.goto(base + "/labyrinth/", wait_until="load")
        card = page.locator(".labyrinth-card", has_text="Jomission / LANSA")
        card_lines = card.locator(".labyrinth-status").all_inner_texts()
        page.screenshot(path=str(OUT / f"gallery_{name}.png"), full_page=True)

        page.goto(base + "/labyrinth/o38s/", wait_until="load")
        board = page.locator("#o38s-dashboard")
        board_text = board.inner_text()
        pills = page.locator("#o38s-dashboard .o38s-pill").all_inner_texts()
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        board.screenshot(path=str(OUT / f"board_{name}.png"))
        (OUT / f"board_{name}.txt").write_text("\n".join(card_lines) + "\n---\n" + board_text, encoding="utf-8")

        shown_pass = "PASS" in " ".join(card_lines) or "PASS" in board_text
        print(f"== {name}: pills={pills} pass_shown={shown_pass} h-overflow={overflow} errors={errors}")
        if not card_lines:
            failures.append(f"{name}: the card shows no status line")
        elif f"Stage 1 {want[0]} · Stage 2 {want[1]}" != card_lines[0]:
            failures.append(f"{name}: card line {card_lines[0]!r}")
        if pills != want:
            failures.append(f"{name}: pills {pills}, expected {want}")
        if shown_pass and not pass_allowed:
            failures.append(f"{name}: PASS is shown")
        if pass_allowed and not shown_pass:
            failures.append(f"{name}: the known PASS is not shown")
        if errors:
            failures.append(f"{name}: page errors {errors}")
        if overflow:
            failures.append(f"{name}: horizontal overflow")
        if name == "real":
            phone = browser.new_context(viewport={"width": 390, "height": 800})
            pp = phone.new_page()
            pp.route(OFF_SITE, lambda route: route.abort())
            for path, tag in (("/labyrinth/", "gallery"), ("/labyrinth/o38s/", "board")):
                pp.goto(base + path, wait_until="load")
                if pp.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"):
                    failures.append(f"phone {tag}: horizontal overflow")
                pp.screenshot(path=str(OUT / f"phone_{tag}_real.png"), full_page=True)
            phone.close()
        ctx.close()
    browser.close()
server.shutdown()

print("FAILURES:" if failures else f"BROWSER CHECK OK: {len(CASES)} cases")
for f in failures:
    print("  ", f)
sys.exit(1 if failures else 0)
