# state

Stamp: hnxj-core@_temp_frontend-style@f6e823f · 2026-11-09

Overwritten each session. Where this file and git or a gate disagree, git and the gate win.

Lane: `_temp_frontend-style` at E:/wt/hnxj-style-core, keeper: this session (desktop app). Pages lane: `_temp_frontend-style-pages` at E:/wt/hnxj-style-pages, no stacks of its own; its rulings are items 5 to 8 and 10 in evidence/rulings_pending.md.

## Works (with evidence)

- Branch `_temp_frontend-style` at f6e823f (stack evidence) on top of 734cf1d (style pass). Pushed in this step; not merged: 734cf1d is not an ancestor of origin/main (`git merge-base --is-ancestor` exits 1).
- Pages branch `_temp_frontend-style-pages` at 897f06d, pushed; not merged (exits 1).
- `node labyrinth/scan-static.mjs` on the tree at f6e823f: STATIC SCAN OK.
- Style checker v2 results from the 734cf1d and 897f06d commit messages (core 42 cases; pages 108 plus 12 cases; 0 regressions). Not re-run in this step. evidence/tools/style_check_v2.py adds 375 px and has not been run yet.

## Broken or in flight

- 375 px render not verified: six core pages (T-1); gammarena and gallery pages (T-2).
- Pixel comparison not done for the 80 gammarena cases whose height changed (T-3).
- jchat message list not verified at runtime; hub not reachable from this host (T-5).
- Owner rulings pending in evidence/rulings_pending.md (items 1 to 12). T-6 to T-12 wait on them.
- goal_stack.md and fact_stack.md opened from templates in this step; owner content pending (T-4). Unfilled, so the audit reports them as minor.
- artifacts/ also holds add-a-card.md, add-a-slide.md and tools/. They are not stack files and were not moved; the audit lists them as extras (minor).
- Pushes print a notice that the repository moved (ruling item 11).
- Main checkout E:/repos/hnxj.github.io ignores artifacts/ in its .gitignore (ruling item 12).

## Last gate results

- labyrinth/scan-static.mjs: STATIC SCAN OK (f6e823f).
- artifacts_check.py on this tree: VERDICT ACCEPT. Minors only: 3 extras in artifacts/; goal_stack.md and fact_stack.md unfilled.
- Style checker v2 at 375 px: not run yet (T-1, T-2).

## Environment

- Lane E:/wt/hnxj-style-core, branch _temp_frontend-style; keeper: this session.
- Worktrees: E:/repos/hnxj.github.io on _temp_labyrinth-three (b924859); E:/repos/hnxj-jchat-link on jchat-view-page (3da4299); E:/wt/hnxj-style-pages on _temp_frontend-style-pages (897f06d).
- origin: https://github.com/hnxj/hnxj.github.io.git (fetch and push); no credentials in the URL.
- Check base: commit 39ac1e9, exported with `git archive`.
- Hub: not reachable from this host.

## Next action

T-1: run evidence/tools/style_check_v2.py at 375 px on the six core pages. Owner rulings gate T-6 to T-12. T-4 needs the owner's goal and fact content.
