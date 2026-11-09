# memory

Verified lessons the code and git do not show. This project only. No state, secrets, or unverified claims.

- trigger: a background review file looks days old
  cause: timestamps are local time, and the run had been going about 15 minutes; a duplicate launch cost a full review
  repair: compare with the local clock (`date`) and the file growth before calling a task stalled; stop a duplicate at once
  evidence: this audit session, 2026-11-07 to 2026-11-09: the duplicate was launched and stopped before it produced output
  scope: background tasks in this repo

- trigger: a reviewer reports no visual change for an inline-style move
  cause: the rule targets a child element, and the inline style sat on the parent
  repair: before accepting no change, read the computed style on the element that carried the inline style
  evidence: index.html:172 and assets/css/madelane-theme.css:78 (ruling R-3)
  scope: style refactors

- trigger: `grep -c` with a CR pattern in this shell reports wrong counts
  cause: grep -c with $'\r' miscounts here (3 for a 2-line CR file)
  repair: count CR bytes with `tr -cd "\r" < file | wc -c`
  evidence: scratch file with 2 CR lines: grep -c gave 3, tr gave 2; repo files index.html, info/index.html and labyrinth/jchat/jchat.js hold 0 CR bytes (LF)
  scope: line-ending checks
