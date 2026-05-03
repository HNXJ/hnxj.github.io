# Project Doctrine: Public Observation Plane

Public Pages observation surfaces must not contain credentials, demo passwords, reusable operator usernames, localhost/private endpoint calls, fetch/XHR/axios calls to control-plane services, form actions to private endpoints, or live handlers on disabled controls. Operator tools belong outside the public Pages deploy or must be rendered as inert static observation-plane previews.

## Verification Requirements
- **No Credentials**: Grep for demo strings like `editor_alpha`, `pass_alpha`.
- **No Localhost**: Grep for `localhost`, `127.0.0.1`, `0.0.0.0`.
- **No Mutation Handlers**: No `onclick` or `addEventListener` on mutation-shaped controls.
- **Static Only**: Public surfaces are read-only observation artifacts.
