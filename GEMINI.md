# Project Doctrine: Public Observation Plane

Public Pages observation surfaces must not contain credentials, demo passwords, reusable operator usernames, localhost/private endpoint calls, fetch/XHR/axios calls to control-plane services, form actions to private endpoints, or live handlers on disabled controls. Operator tools belong outside the public Pages deploy or must be rendered as inert static observation-plane previews.

## Verification Requirements

- **No Credentials**: Public Pages must not contain demo usernames, demo passwords, reusable operator names, API keys, tokens, or private endpoint credentials.
- **No Localhost**: Public Pages must not contain localhost, 127.0.0.1, 0.0.0.0, or private/local endpoint references.
- **No Mutation Handlers**: No `onclick` or `addEventListener` on mutation-shaped controls.
- **Static Only**: Public surfaces are read-only observation artifacts.
