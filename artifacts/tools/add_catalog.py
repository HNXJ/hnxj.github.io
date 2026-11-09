#!/usr/bin/env python3
"""
Add a catalog card: one entry in assets/projects.js, drawn by assets/lab.js.
The card markup is artifacts/tools/catalog_card.html (the Lab-page card design).

Usage:
    python3 artifacts/tools/add_catalog.py --subject "Title" --desc "One or two lines." --url "https://..." \
        [--image "../assets/cards/x.jpg"] [--type webpage|presentation] [--tags a b] [--dry-run] [--render]

    --render   print the card HTML (catalog_card.html filled in)
    --dry-run  print the entry and the card; write nothing

Refuses (exit 1): empty or over-long subject (80) or description (200); a URL that is not
https://, http:// or a relative path; a local image that is not in the repo; a subject that already
has a card. Exit 2: usage. Stdlib only. Works in any repo with assets/projects.js holding
`window.PROJECTS = [ ... ];`.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
TEMPLATE = TOOLS / "catalog_card.html"
MAX_SUBJECT = 80
MAX_DESC = 200


def refuse(msg: str) -> int:
    sys.stderr.write(f"Error: {msg}\n")
    return 1


def local_image_path(image: str) -> Path:
    """Map an image path to the repo file: '../assets/x' and '/assets/x' both mean REPO/assets/x."""
    p = image
    while p.startswith(("../", "./")):
        p = p[3:] if p.startswith("../") else p[2:]
    return REPO / p.lstrip("/")


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def render_card(entry: dict) -> str:
    """Fill catalog_card.html the way assets/lab.js draws the same entry."""
    is_pres = entry["category"] == "presentation"
    url = entry["url"]
    target = ' target="_blank"' if url.startswith("http") else ""
    if entry.get("image"):
        thumb = f'<img class="card-thumb" src="{esc(entry["image"])}" alt="" loading="lazy">'
    else:
        thumb = f'<div class="card-thumb-placeholder">{"Presentation" if is_pres else "Webpage"}</div>'
    tags = entry.get("tags") or []
    tag_block = ""
    if tags:
        tag_block = '<div class="tags">' + "".join(f'<span class="tag">{esc(t)}</span>' for t in tags) + "</div>"
    fills = {
        "url": esc(url),
        "target": target,
        "thumb": thumb,
        "subject": esc(entry["subject"]),
        "description": esc(entry["description"]),
        "tags": tag_block,
        "action": esc("View slides →" if is_pres else "Open site →"),
    }
    tpl = re.sub(r"<!--.*?-->\s*", "", TEMPLATE.read_text(encoding="utf-8"), flags=re.S)
    for key, value in fills.items():
        tpl = tpl.replace("{{" + key + "}}", value)
    return tpl.strip()


def insert_entry(content: str, card_str: str) -> str | None:
    """Append card_str as the last element of window.PROJECTS, as add_card.py does."""
    pattern = re.compile(r"(\})(\s*)(\r?\n)\];\s*$", re.MULTILINE)
    m = pattern.search(content)
    if m:
        return pattern.sub(lambda x: f"{x.group(1)},{x.group(3)}{card_str}{x.group(3)}];\n", content, count=1)
    empty = re.compile(r"(\[\s*)(\r?\n)?\];\s*$", re.MULTILINE)
    if empty.search(content):
        return empty.sub(lambda x: f"[\n{card_str}\n];\n", content, count=1)
    return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Add a catalog card to assets/projects.js.")
    ap.add_argument("--subject", "-s", required=True, help="card title")
    ap.add_argument("--desc", "-d", "--description", required=True, help="one or two lines")
    ap.add_argument("--url", "-u", required=True, help="https://... or a relative path")
    ap.add_argument("--image", "-i", default="", help="thumbnail: https://... or a path inside the repo")
    ap.add_argument("--type", "-t", choices=["webpage", "presentation"], default="webpage")
    ap.add_argument("--presentation", "--slides", action="store_true", help="same as --type presentation")
    ap.add_argument("--tags", nargs="*", default=[], help="optional labels")
    ap.add_argument("--dry-run", action="store_true", help="print the entry and card; write nothing")
    ap.add_argument("--render", action="store_true", help="print the card HTML")
    args = ap.parse_args(argv)

    subject = args.subject.strip()
    description = args.desc.strip()
    url = args.url.strip()
    image = args.image.strip()
    category = "presentation" if args.presentation else args.type
    tags = [t.strip() for t in args.tags if t.strip()]
    if category == "presentation" and "slides" not in tags:
        tags.append("slides")

    if not subject:
        return refuse("subject is empty")
    if len(subject) > MAX_SUBJECT:
        return refuse(f"subject is longer than {MAX_SUBJECT} characters")
    if not description:
        return refuse("description is empty")
    if len(description) > MAX_DESC:
        return refuse(f"description is longer than {MAX_DESC} characters")
    if not url.startswith(("https://", "http://", "/", "./", "../")):
        return refuse(f"URL must start with https:// or be a relative path (got '{url}')")
    if image and not image.startswith(("https://", "http://")):
        img_file = local_image_path(image)
        if not img_file.is_file():
            return refuse(f"image not found in the repo: {img_file}")

    projects = REPO / "assets" / "projects.js"
    if not projects.is_file():
        return refuse(f"could not find {projects}")
    content = projects.read_bytes().decode("utf-8")
    nl = "\r\n" if "\r\n" in content else "\n"  # write back with the file's own line endings

    def js(value: str) -> str:
        return json.dumps(value, ensure_ascii=False)

    entry = {"subject": subject, "description": description, "url": url, "image": image,
             "category": category, "tags": tags}
    parts = [f"subject: {js(subject)}", f"name: {js(subject)}", f"description: {js(description)}",
             f"url: {js(url)}"]
    if image:
        parts.append(f"image: {js(image)}")
    parts.append(f"category: {js(category)}")
    if tags:
        parts.append("tags: [" + ", ".join(js(t) for t in tags) + "]")
    card_str = "  {" + ", ".join(parts) + "}"

    # --render and --dry-run only print: they never refuse on an existing subject.
    if args.render or args.dry_run:
        print(render_card(entry))
        if args.dry_run:
            print(card_str)
            print("dry run: nothing written")
        return 0

    if f"subject: {js(subject)}" in content or f"name: {js(subject)}" in content:
        return refuse(f"a card with subject {js(subject)} already exists in projects.js")

    new_content = insert_entry(content, card_str)
    if new_content is None:
        return refuse("could not find the closing ]; of window.PROJECTS in projects.js")

    projects.write_bytes(new_content.replace("\r\n", "\n").replace("\n", nl).encode("utf-8"))
    print(f"Added {category} card {js(subject)} to assets/projects.js")
    return 0


if __name__ == "__main__":
    # The card text has non-ASCII (×, →); a cp1252 console would crash on print.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    sys.exit(main())
