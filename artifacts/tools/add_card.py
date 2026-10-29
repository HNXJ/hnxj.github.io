#!/usr/bin/env python3
"""
Append a lightweight card to assets/projects.js (the Labyrinth card list).

Usage:
    python3 artifacts/tools/add_card.py --subject "JaxFNE" --desc "Tensor-field modeling." --url "https://..." [--image "/assets/..."] [--type webpage|presentation]

Examples:
    # Add a webpage card (top section):
    python3 artifacts/tools/add_card.py --subject "My Tool" --desc "A fast ephys analysis tool." --url "https://hnxj.github.io/my-tool/" --image "/assets/images/mind_opt.png"

    # Add a presentation card (bottom section):
    python3 artifacts/tools/add_card.py --subject "Laminar Ephys Slides" --desc "Talk at CoSyNe 2026." --url "https://hnxj.github.io/slides/laminar/" --image "/assets/images/purple.jpg" --presentation
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Add a lightweight card to Labyrinth.")
    parser.add_argument("--subject", "-s", required=True, help="Card title or subject")
    parser.add_argument("--desc", "-d", "--description", required=True, help="Short one- or two-line description")
    parser.add_argument("--url", "-u", required=True, help="Destination URL (https://... or relative path)")
    parser.add_argument("--image", "-i", default="", help="Path or URL to preview image")
    parser.add_argument(
        "--type", "-t", choices=["webpage", "presentation"], default="webpage",
        help="Card category: webpage (top section) or presentation (bottom section)"
    )
    parser.add_argument("--presentation", "--slides", action="store_true", help="Shortcut for --type presentation")
    parser.add_argument("--tags", nargs="*", default=[], help="Optional tags/labels")

    args = parser.parse_args()

    subject = args.subject.strip()
    description = args.desc.strip()
    url = args.url.strip()
    image = args.image.strip()
    category = "presentation" if args.presentation else args.type
    tags = list(args.tags)

    if category == "presentation" and "slides" not in tags:
        tags.append("slides")

    if not url.startswith(("https://", "http://", "/", "./", "../")):
        sys.stderr.write(f"Error: URL must start with https:// or a relative path (got '{url}')\n")
        return 1

    repo_root = Path(__file__).resolve().parent.parent.parent
    projects_file = repo_root / "assets" / "projects.js"

    if not projects_file.is_file():
        sys.stderr.write(f"Error: Could not locate {projects_file}\n")
        return 1

    content = projects_file.read_text(encoding="utf-8")

    # Check for existing card by subject or name
    escaped_subject = json.dumps(subject)
    if f"subject: {escaped_subject}" in content or f"name: {escaped_subject}" in content:
        sys.stderr.write(f"Error: A card with subject {escaped_subject} already exists in {projects_file.name}\n")
        return 1

    parts = [
        f"subject: {json.dumps(subject)}",
        f"name: {json.dumps(subject)}",
        f"description: {json.dumps(description)}",
        f"url: {json.dumps(url)}",
    ]
    if image:
        parts.append(f"image: {json.dumps(image)}")
    parts.append(f"category: {json.dumps(category)}")
    if tags:
        tag_json = ", ".join(json.dumps(t) for t in tags)
        parts.append(f"tags: [{tag_json}]")

    card_str = "  {" + ", ".join(parts) + "}"

    # Insert before closing `];`
    pattern = re.compile(r"(\})(\s*)(\r?\n)\];\s*$", re.MULTILINE)
    match = pattern.search(content)

    if not match:
        empty_pattern = re.compile(r"(\[\s*)(\r?\n)?\];\s*$", re.MULTILINE)
        empty_match = empty_pattern.search(content)
        if empty_match:
            new_content = empty_pattern.sub(f"[\n{card_str}\n];\n", content)
        else:
            sys.stderr.write("Error: Could not find closing `];` in assets/projects.js\n")
            return 1
    else:
        newline = match.group(3)
        replacement = f"{match.group(1)},{newline}{card_str}{newline}];\n"
        new_content = pattern.sub(replacement, content)

    projects_file.write_text(new_content, encoding="utf-8")
    print(f"Added {category} card '{subject}' to {projects_file.relative_to(repo_root)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
