# Owner rulings pending

Decisions the owner answers, one number each. None is an open row: no row blocks the top goal or makes a recorded claim untrue, so each todo item that needs one names its R-number and waits. Write the answer after "Answer:". Figures marked reported come from a run and were not re-measured in this step.

Lanes: R-1 to R-4 are on _temp_frontend-style; R-5 to R-8 are on _temp_frontend-style-pages (897f06d); R-9 and R-10 are merges; R-11 and R-12 are repo settings.

## R-1 jchat message box has no accessible name (_temp_frontend-style)
Symptom: textarea #sendtext has no accessible name.
Evidence: labyrinth/jchat/index.html:74 (placeholder only); labyrinth/jchat/jchat.js:462 (placeholder set at runtime).
Options, ranked: 1 static label "Message" (smallest diff). 2 label synced to the placeholder in jchat.js (follows the open room). 3 identity text (needs owner wording).
Question: which label?
Answer:

## R-2 mindapp rgba alpha literals (_temp_frontend-style)
Symptom: rgba literals with alpha have no token in the madelane theme.
Evidence: mindapp/index.html:29-30 (rgba(207, 184, 124, 0.45) and 0.08); assets/css/madelane-theme.css has no alpha or RGB token.
Options, ranked: 1 color-mix() on var(--vandy-gold): one source, needs a modern browser. 2 RGB component tokens in madelane: works in any browser, adds tokens. 3 keep the literals: no change.
Question: which option?
Answer:

## R-3 index footer p keeps an inline style (_temp_frontend-style)
Symptom: the footer p.footer-nav-links carries an inline style that the madelane rule does not reach.
Evidence: index.html:172 (inline style); assets/css/madelane-theme.css:78 (the rule targets the links, not the p).
Options, ranked: 1 move the style to a rule on the footer p: removes the inline style. 2 keep inline: no change.
Question: move or keep?
Answer:

## R-4 info h5 headings kept (_temp_frontend-style)
Symptom: h2 to h5 skips h3 and h4 on info/index.html.
Evidence: info/index.html:125, 131, 137, 142, 148 (h5); assets/css/madelane-theme.css:59-63 (h1 to h3 get weight 700 !important; h5 is outside that rule).
Options, ranked: 1 keep skipped: no visual change. 2 resolve the weight in madelane: a change that touches every page using the rule.
Question: keep h5, or resolve?
Answer:

## R-5 arena disclaimer banner now visible (_temp_frontend-style-pages, 897f06d)
Symptom: the banner rule moved to common.css and shows on arena: +60 px at 1440, +16 px at 390 (reported).
Evidence: pages/gammarena/common.css:622 (.disclaimer-banner); pages/gammarena/arena.html:66 and analysis.html:264 use the class.
Options, ranked: 1 keep site-wide: arena keeps its disclaimer, no change from the branch. 2 scope the rule to analysis.html: arena.html:66 loses its banner.
Question: keep, or scope?
Answer:

## R-6 gallery rgba literals (_temp_frontend-style-pages, 897f06d)
Symptom: gold and black rgba literals stay in the page.
Evidence: pages/gallery/index.html:18-19, 30, 66.
Options, ranked: 1 tokenise in common.css: one source for the gold alpha values. 2 keep the literals: no change.
Question: tokenise, or keep?
Answer:

## R-7 readme hero h2 and sde h3 kept (_temp_frontend-style-pages, 897f06d)
Symptom: the readme page has no h1; the sde h3 styling is tag-specific.
Evidence: pages/gammarena/wiki/readme.html:119 (h2.hero-subtitle, no h1 in the file); pages/gammarena/wiki/sde.html:33 (.sde-card h3), :72 (h3).
Options, ranked: 1 keep: no change. 2 promote with a selector change: gives the headings the heading style, which changes their look.
Question: keep, or promote?
Answer:

## R-8 visible size changes to confirm (_temp_frontend-style-pages, 897f06d)
Symptom: gallery hero heading 17.6 to 32 px; genesis panel text 16 to 14.4 px with a colour change (reported).
Evidence: pages/gallery/index.html:55 (.hero-title), :104 (h2.hero-title); the genesis panel is .panel-desc in pages/gammarena/wiki/genesis-tree.html (location from the task input, not re-checked).
Options, ranked: 1 accept both: keeps the change as made. 2 revert the hero size: keeps 17.6 px. 3 revert the panel size: keeps 16 px.
Question: accept both?
Answer:

## R-9 merge _temp_frontend-style to main
Symptom: branch not merged; origin/main is at 39ac1e9 (last fetch).
Evidence: 734cf1d is not an ancestor of origin/main (`git merge-base --is-ancestor` exits 1).
Options, ranked: 1 merge after an owner go. 2 hold: no merge.
Question: merge, or hold?
Answer:

## R-10 merge _temp_frontend-style-pages to main
Symptom: branch not merged.
Evidence: 897f06d is not an ancestor of origin/main (exits 1).
Options, ranked: 1 merge after an owner go. 2 hold: no merge.
Question: merge, or hold?
Answer:

## R-11 origin URL
Symptom: pushes print a notice that the repository moved to https://github.com/HNXJ/hnxj.github.io.git (reported).
Evidence: `git remote -v` shows origin https://github.com/hnxj/hnxj.github.io.git (fetch and push, no credentials); pushes succeed.
Options, ranked: 1 update origin to the location GitHub reports. 2 keep the current origin: pushes still succeed.
Question: update origin?
Answer:

## R-12 where the stack files live
Symptom: the main checkout ignores artifacts/; the lane branches track it. A merge would bring stack files into a branch that ignores the folder.
Evidence: E:/repos/hnxj.github.io/.gitignore line 10 lists artifacts/ (branch _temp_labyrinth-three). The lane's .gitignore does not list it.
Options, ranked: 1 keep the seven files in artifacts/ and add exceptions for them to .gitignore. 2 keep the stacks local only (not pushed). 3 move the stacks to docs/.
Question: which location?
Answer:
