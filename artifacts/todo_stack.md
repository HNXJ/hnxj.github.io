# todo stack

Top = next. Ready items first, then items blocked by an owner ruling (evidence/rulings_pending.md, item numbers in the blocked-by text). Prerequisites sit above dependents. Delete an item when it is done; git holds history.

## now

- T-1 Run the style checker at 375 px on the six core pages: index.html, info/index.html, labyrinth/index.html, mindapp/index.html, slides/jaxfne/index.html, slides/jnwb/index.html. Base: export commit 39ac1e9 with `git archive 39ac1e9 | tar -x -C <tmp>`. Closes when: `python evidence/tools/style_check_v2.py <tmp> . <out> index.html info/index.html labyrinth/index.html mindapp/index.html slides/jaxfne/index.html slides/jnwb/index.html` prints 0 regressions. Blocked by: none.
- T-2 Run the same check at 375 px on every HTML page under pages/gammarena/ and pages/gallery/ on _temp_frontend-style-pages (lane E:/wt/hnxj-style-pages, base 39ac1e9). Closes when: the checker prints 0 regressions for those pages. Blocked by: none.
- T-3 Compare pixels for the 80 gammarena cases whose height changed (only computed style and text were compared so far). Closes when: evidence/pixel_receipt_gammarena.txt lists every case with its diff count and a reason, and no diff lacks a reason. Blocked by: none.
- T-4 Fill artifacts/goal_stack.md and artifacts/fact_stack.md (opened from templates; the owner writes them, agents only propose). Closes when: `python C:/Users/nejath/.claude/skills/match-workspace-hygiene/scripts/artifacts_check.py .` prints no unfilled-marker finding for either file. Blocked by: owner content.
- T-5 Run the jchat message-list check against the hub. Closes when: a receipt in evidence/ shows the list rendered from the hub with 0 console errors. Blocked by: hub access (not reachable from this host).

## blocked by an owner ruling

- T-6 Apply the ruling on the jchat message box accessible name to labyrinth/jchat/index.html. Closes when: the answer is written in evidence/rulings_pending.md and a DOM check finds the chosen name on #sendtext with 0 console errors. Blocked by: owner ruling, evidence/rulings_pending.md item 1.
- T-7 Apply the rulings on mindapp/index.html (item 2) and on the index.html footer p (item 3). Closes when: both answers are written, and the checker prints 0 regressions for mindapp/index.html and index.html. Blocked by: owner rulings, evidence/rulings_pending.md items 2 and 3.
- T-8 Apply the ruling on the info/index.html h5 headings (item 4). Closes when: the answer is written and the checker prints 0 regressions for info/index.html. Blocked by: owner ruling, evidence/rulings_pending.md item 4.
- T-9 Apply the rulings on _temp_frontend-style-pages (items 5 to 8: arena banner, gallery rgba, readme and sde headings, visible size changes). Closes when: each answer is written and the checker prints 0 regressions for the ruled pages. Blocked by: owner rulings, evidence/rulings_pending.md items 5 to 8.
- T-10 Apply the ruling on the origin URL (item 11). Closes when: the answer is written and `git remote get-url origin` shows the ruled URL. Blocked by: owner ruling, evidence/rulings_pending.md item 11.
- T-11 Apply the ruling on where the stack files live (item 12). Closes when: the answer is written and `git check-ignore -v artifacts/open_stack.md` gives the ruled result. Blocked by: owner ruling, evidence/rulings_pending.md item 12.
- T-12 Apply the rulings on merges to main (items 9 and 10). Merge only on an owner go, never on an agent's own decision. Closes when: both answers are written and, for each merged branch, `git merge-base --is-ancestor <tip> origin/main` exits 0. Blocked by: owner rulings, evidence/rulings_pending.md items 9 and 10.
