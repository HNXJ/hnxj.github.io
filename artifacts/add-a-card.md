# Add a card to Labyrinth

Cards appear on Labyrinth (`/labyrinth/`) in two distinct sections:
- **Top**: Webpages (applications, tools, research systems)
- **Bottom**: Presentations (slides, talks)

Each card displays:
1. **Image**: Preview thumbnail (or clean geometric placeholder if omitted)
2. **Subject**: Card title / topic
3. **Description**: Short one- or two-line summary
4. **Action Link**: "Open →" or "View slides →"

---

## 1. Fast command (recommended)

Run the Python tool from the repository root:

```bash
# Add a webpage card (top section):
python3 artifacts/tools/add_card.py \
  --subject "My Tool" \
  --desc "A fast ephys analysis tool." \
  --url "/my-tool/" \
  --image "/assets/images/mind_opt.png"

# Add a presentation card (bottom section):
python3 artifacts/tools/add_card.py \
  --subject "Laminar Ephys Slides" \
  --desc "Talk on cortical laminar architecture." \
  --url "/slides/laminar/" \
  --image "/assets/images/purple.jpg" \
  --presentation
```

---

## 2. Manual edit

Alternatively, open `assets/projects.js` and append an object before `];`:

```js
{
  subject: "My Tool",
  description: "One-line description.",
  url: "/my-tool/",
  image: "/assets/images/mind_opt.png",
  category: "webpage"  // or "presentation"
}
```

Commit and push; GitHub Pages will update within 1–2 minutes.
