# Gallery Setup

This is an **auto-extending gallery** for interactive HTML visualizations.

## How to Add New Visualizations

1. **Copy your HTML file** to this directory:
   ```bash
   cp your_visualization.html /pages/gallery/
   ```

2. **Regenerate the manifest** (from this directory):
   ```bash
   python3 generate_manifest.py
   ```

3. **Done!** The gallery will automatically discover and display your new visualization.

## What's in Here

- **index.html** — The gallery display page (loads manifest and renders items)
- **manifest.json** — Auto-generated registry of all gallery items
- **generate_manifest.py** — Python script that scans for HTML files and updates manifest.json
- **\*.html** — Your visualization files (linked from manifest)

## How It Works

1. The script `generate_manifest.py` scans the directory for `.html` files
2. For each file, it extracts:
   - Title (from HTML `<title>` tag, or humanized filename)
   - Filename
   - File modification date
   - Auto-inferred category (3D Visualization, HPC Research, etc.)
3. Generates `manifest.json` with all discovered items
4. **index.html** loads `manifest.json` and dynamically renders gallery cards
5. No hardcoding needed—just add files and run the script

## Customization

You can manually edit `manifest.json` to:
- Change titles, descriptions, categories
- Reorder items
- Add custom metadata

Or re-run `generate_manifest.py` to auto-regenerate from scratch.

## Category Auto-Detection

The script infers categories from filenames:
- Files with "3d" or "trend" or "shift" → **3D Visualization**
- Files with "hpc" or "hypothesis" or "vector" → **HPC Research**
- Everything else → **Visualizations**

You can customize this in `generate_manifest.py` if needed.
