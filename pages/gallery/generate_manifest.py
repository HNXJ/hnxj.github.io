#!/usr/bin/env python3
"""
Auto-generate gallery manifest.json from HTML files in the directory.
Run this whenever you add new HTML files to the gallery.
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime

def extract_title_from_html(filepath):
    """Extract title from HTML file (from <title> tag or filename)."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(500)  # Read first 500 chars
            match = re.search(r'<title[^>]*>([^<]+)</title>', content, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    except:
        pass
    return None

def slugify(text):
    """Convert text to URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')

def get_file_date(filepath):
    """Get file modification date."""
    mtime = os.path.getmtime(filepath)
    return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')

def infer_category_from_name(filename):
    """Infer category from filename patterns."""
    name_lower = filename.lower()

    if '3d' in name_lower or '3-d' in name_lower:
        return '3D Visualization'
    elif 'hpc' in name_lower or 'hypothesis' in name_lower or 'vector' in name_lower:
        return 'HPC Research'
    elif 'trend' in name_lower or 'shift' in name_lower:
        return '3D Visualization'
    else:
        return 'Visualizations'

def humanize_filename(filename):
    """Convert filename to human-readable title."""
    # Remove file extension
    name = os.path.splitext(filename)[0]
    # Replace underscores and hyphens with spaces
    name = re.sub(r'[_-]', ' ', name)
    # Remove leading numbers
    name = re.sub(r'^\d+\s*', '', name)
    # Title case
    return ' '.join(word.capitalize() for word in name.split())

def generate_manifest():
    """Scan gallery directory and generate manifest.json."""
    gallery_dir = Path(__file__).parent
    html_files = sorted(gallery_dir.glob('*.html'))

    # Filter out index.html
    html_files = [f for f in html_files if f.name != 'index.html']

    if not html_files:
        print("No HTML files found in gallery directory.")
        return

    items = []
    for html_file in html_files:
        filename = html_file.name

        # Extract title from HTML or use humanized filename
        html_title = extract_title_from_html(str(html_file))
        if html_title and len(html_title) < 100:
            title = html_title
        else:
            title = humanize_filename(filename)

        # Create item
        item = {
            "id": slugify(title),
            "title": title,
            "description": f"Interactive visualization - {filename}",
            "filename": filename,
            "category": infer_category_from_name(filename),
            "date": get_file_date(str(html_file))
        }
        items.append(item)

    manifest = {"gallery": items}
    manifest_path = gallery_dir / 'manifest.json'

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"✓ Generated manifest.json with {len(items)} items:")
    for item in items:
        print(f"  - {item['title']} ({item['category']})")
    print(f"\nManifest saved to: {manifest_path}")

if __name__ == '__main__':
    generate_manifest()
