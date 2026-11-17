# Jomission / LANSA (OPEN-38) status

The Labyrinth card and `/labyrinth/o38s/` show the status of OPEN-38.

**Authority.** jomission's generator (`scripts/open38_status.py`, schema `o38s_status/1`) is the only authority
for a status. This site holds no status logic. It owns provenance, freshness and presentation.

| File | Role |
|---|---|
| `data/o38s/source.json` | The pin: repository, branch ref, commit, Python version. Changed by a reviewed commit. |
| `data/o38s/status.json` | The committed snapshot: the generator's JSON at the pinned commit. Written by `refresh`, never by hand. |
| `assets/data/o38s_status.js` | The artifact the pages load: the snapshot's exact bytes and a verification record. Built, never committed. |
| `tools/o38s_status.py` | The regeneration gate: `verify`, `build`, `refresh`. |
| `assets/o38s_view.js`, `assets/o38s_card.js` | View model and renderer. |

**Gate.** `python tools/o38s_status.py verify` clones the pinned repository, requires the pinned commit on the
pinned ref, checks it out, runs the generator and compares its output with the committed snapshot byte for
byte, key order included, with `generated_utc` set aside. `generated_utc` cannot be regenerated, so it is
bounded: no earlier than the pinned commit and no later than the verification (300 s tolerance). Any mismatch,
generator failure, missing source or unreadable provenance exits 1. `build` runs `verify` on a clean site
commit and writes the artifact with the snapshot's sha256, the source commit, the site commit and the
verification time. A refused or crashed build removes the artifact. `labyrinth/scan-static.mjs` fails when the
artifact is committed or when a committed page or script outside the view and the card names `O38S_ARTIFACT`.

**Display.** A status is shown only from an artifact whose snapshot bytes hash to its verification record.
Without the artifact, or with one that is unsealed, altered, malformed, or verified more than 168 h ago, every
status is UNKNOWN. The 168 h limit is provisional (owner, 2026-11-17).

**Limits.** Equality with the generator is consistency, not scientific correctness, and it does not show that
the pinned commit deserves trust. The record in the artifact is a statement by the pipeline that built it: the
guarantee holds only where deployment runs `build` and nothing else writes the artifact. Under a deployment
that serves the committed tree as is, no artifact exists and every status is UNKNOWN.

The view hides a stage's detail when `status` differs from `public_status` (receipts not committed); that is
the one presentation rule that reads two status fields, and it can only hide.

**Deployment (not active).** `tools/o38s_pages.workflow.yml` is a proposed GitHub Pages workflow: tests, the
gate, then deploy, on a push to `main` and daily (a verification older than 168 h is distrusted). It takes
effect only when the owner moves it to `.github/workflows/` and sets the Pages source to GitHub Actions. The
gate is the only route to a visible PASS only when the owner also protects `main` with a ruleset, restricts the
`github-pages` environment to `main`, and keeps that workflow the only one with `pages: write`. Until then the
false-PASS criterion is not closed: a hand-written artifact committed to the served branch would be displayed.

**Commands.**

```
python tools/o38s_status.py refresh            # regenerate the snapshot at the pinned commit
python tools/o38s_status.py refresh --to-tip   # move the pin to the tip of its ref, then regenerate
python tools/o38s_status.py verify             # the gate
python tools/o38s_status.py build              # the gate, then the artifact
node --test tests/                             # view model
python -m unittest discover -s tests -p "test_*.py"   # gate (O38S_LIVE=1 adds the real repository)
node labyrinth/scan-static.mjs                 # static rules
python tests/browser_o38s.py . <out dir>       # both pages in a browser, after `build`
```
