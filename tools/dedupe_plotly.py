#!/usr/bin/env python3
"""
Replace the inline Plotly.js bundle in each exported figure HTML with a
<script src> reference to a shared, version-matched copy under
assets/js/vendor/. Run from anywhere (path is repo-root-relative); safe
to re-run against new figure exports (idempotent — already-slim files
are skipped, unrecognized bundle versions are reported, not touched).

If a new Plotly export uses a version not in KNOWN_BUNDLES, extract its
bundle to assets/js/vendor/plotly-<version>.min.js and add the
(sha256-prefix -> (version, filename)) entry here first.
"""

import re
import glob
import hashlib
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KNOWN_BUNDLES = {
    "aea871d50e48": ("2.35.2", "plotly-2.35.2.min.js"),
    "51c44e924b16": ("3.4.0", "plotly-3.4.0.min.js"),
}

TARGET_GLOBS = [
    "pages/gallery/*.html",
    "pages/gammarena/assets/ontology/*.html",
]

SCRIPT_RE = re.compile(r"<script[^>]*>.*?</script>", re.DOTALL)


def relative_vendor_path(file_path):
    depth = os.path.relpath(file_path, REPO_ROOT).count(os.sep)
    return "../" * depth + "assets/js/vendor/"


def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    scripts = list(SCRIPT_RE.finditer(content))
    if not scripts:
        return "no-scripts"

    bundle_match = max(scripts, key=lambda m: len(m.group(0)))
    bundle_text = bundle_match.group(0)
    digest = hashlib.sha256(bundle_text.encode("utf-8")).hexdigest()[:12]

    if digest not in KNOWN_BUNDLES:
        if len(bundle_text) < 1_000_000:
            return "already-slim"
        return f"unknown-bundle:{digest}"

    version, filename = KNOWN_BUNDLES[digest]
    vendor_path = relative_vendor_path(file_path) + filename
    replacement = f'<script src="{vendor_path}"></script>'

    new_content = content[: bundle_match.start()] + replacement + content[bundle_match.end() :]

    with open(file_path, "w", encoding="utf-8") as fh:
        fh.write(new_content)

    saved = len(bundle_text) - len(replacement)
    return f"ok v{version} saved {saved // 1024} KB"


def main():
    files = []
    for pattern in TARGET_GLOBS:
        files.extend(sorted(glob.glob(os.path.join(REPO_ROOT, pattern))))
    files = [f for f in files if os.path.basename(f) != "index.html"]

    for f in files:
        rel = os.path.relpath(f, REPO_ROOT)
        result = process_file(f)
        print(f"{rel}: {result}")


if __name__ == "__main__":
    main()
