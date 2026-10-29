# Add a slide deck to Labyrinth

A presentation card points to an HTML slide deck (reveal.js, Slidev, Marp, or static web viewer for Beamer slides).

Pick where the deck lives:

| | A. Its own repo (recommended) | B. Inside this repo |
|---|---|---|
| Deck URL | `https://hnxj.github.io/<repo>/` | `https://hnxj.github.io/slides/<name>/` |
| Good for | A deck with its own source, history, or build | A small deck with no build, or built output you commit |
| Publish | Push built output to `gh-pages` | Copy built output into `slides/<name>/` and push this repo |

---

## 1. Publish the deck

- **Option A (Own repo)**: Publish to `gh-pages` branch on GitHub. Ensure base path is `/<repo>/`.
- **Option B (Inside this repo)**: Place the deck's `index.html` and assets in `slides/<name>/`.

---

## 2. Add the card

Run `artifacts/tools/add_card.py` with `--presentation`:

```bash
python3 artifacts/tools/add_card.py \
  --subject "My Talk Title" \
  --desc "Slides for <topic>." \
  --url "/slides/my-talk/" \
  --image "/assets/images/purple.jpg" \
  --presentation
```

The card will appear in the **Presentations** section on `/labyrinth/`.
