# Project Doctrine: Public Observation Plane

Public Pages observation surfaces must not contain credentials, demo passwords, reusable operator usernames, localhost/private endpoint calls, fetch/XHR/axios calls to control-plane services, form actions to private endpoints, or live handlers on disabled controls. Operator tools belong outside the public Pages deploy or must be rendered as inert static observation-plane previews.

## Verification Requirements

- **No Credentials**: Public Pages must not contain demo usernames, demo passwords, reusable operator names, API keys, tokens, or private endpoint credentials.
- **No Localhost**: Public Pages must not contain localhost, 127.0.0.1, 0.0.0.0, or private/local endpoint references.
- **No Mutation Handlers**: No `onclick` or `addEventListener` on mutation-shaped controls.
- **Static Only**: Public surfaces are read-only observation artifacts.



## GAMMA-BUS Coordination Doctrine

Gamma Labyrinth uses a separated-but-synchronized coordination architecture:

1. **ChatGPT/Hamm orchestration chat**
   - Teacher/orchestrator cockpit.
   - Used for routing, synthesis, prompt generation, DELTA reconciliation, and final next-action decisions.
   - Not the durable execution ledger by itself.

2. **GitHub issue in \`gamma-labyrinth\`**
   - Standing GAMMA-BUS Coordination Thread.
   - Single durable cross-agent coordination thread / active agent ledger.
   - No secrets, no executable payloads, no unreceipted scientific truth.
   - Used for short cross-agent status, task links, blockers, handoffs, and final report links.

3. **GitHub Project \`gamma\`**
   - Control-plane board/status/task table.
   - Tracks issues, labels, status, routing, ownership, and evidence.
   - Not scientific Truth-plane state unless backed by receipts.

4. **Separate task issues**
   - Durable work envelopes for specific tasks.
   - Each task issue should specify repo, branch, plane, agent, scope, forbidden scope, evidence required, stop conditions, and final report format.

5. **Separate worker chats**
   - Agent-specific execution channels.
   - Windows Antigravity: front/UI/browser validation.
   - Gemini CLI: backend/runtime/git/terminal work.
   - Claude/Cowork: doctrine, audit, DELTA reconciliation, and high-level review.
   - Keep worker chats separate to avoid context contamination.

6. **Google Drive**
   - Artifact storage only: screenshots, PDFs, exported reports, large files.
   - Not the coordination ledger or source of task truth.

### Required agent behavior:
**Before work:**
- Check the relevant task issue and, when available, the GAMMA-BUS Coordination Thread.
- Verify repo, branch, plane, scope, and task ownership.
- Assume parallel agents may be active.

**During work:**
- Stay within assigned scope.
- Do not apply fixes in one repo/agent context that could conflict with another agent’s sensitive pending work.
- If another agent/repo/human dependency is needed, create or update a GitHub issue rather than relying only on chat.

**After work:**
Report with:
- agent/model
- repo/branch
- plane
- files changed
- commands run
- tests/validation
- commit/PR/artifact/screenshot/receipt links
- unresolved risks
- next single action
- footer with agent label/model/role/plane/truth_mode/date

### Truth and security constraints:
- No secrets in issues, memory files, prompts, or reports.
- No biological/scientific truth claims without Truth-plane receipts.
- Observation pages are not truth.
- GitHub Project state is task/control state, not scientific truth.
- Use \`truth_mode: truth_safe_unverified\` when no current receipt exists.
