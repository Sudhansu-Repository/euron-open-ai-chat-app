# ADR 0004: One build, any server

## Status

Accepted.

## Context

euron-open-ai-chat is self-hosted: every organisation runs its own server. Requiring each one to
build and publish its own app is a high bar, while a single public build has to be pointed at a
server somehow. Some organisations will still want their own app locked to their server.

## Decision

- The build's `API_BASE_URL` is the **default** server. When `ALLOW_CUSTOM_SERVER` is not `false`,
  the welcome screen shows the server in use and lets people enter another one
  ([`AuthScreens.tsx`](../../../src/features/auth/AuthScreens.tsx)).
- [`normalizeServer()`](../../../src/lib/server.ts) turns what was typed into an API base: assumes
  `https://`, adds `/api`, drops trailing slashes; refuses credentials, queries, fragments and
  hosts without a dot (except `localhost`); allows plain `http://` only for local addresses.
- [`probeServer()`](../../../src/lib/server.ts) accepts the address only when `GET /api/meta`
  answers within 8 seconds with an `appName`, `features` and `limits`, and turns failures into
  readable reasons ("not an Open AI Chat server", "did not answer in time", "could not be
  reached").
- The chosen server is saved in MMKV (removed again when it equals the default). Switching signs
  out first, clears the cached meta and the query cache.
- `ALLOW_CUSTOM_SERVER=false` ignores any saved server, always uses `API_BASE_URL` and hides the
  picker: one script ([`rename-app.sh`](../../../scripts/rename-app.sh)) and one setting make an
  organisation's own app.

## Consequences

Positive:

- One build in the stores can serve every self-hosted server.
- The same code makes a locked, branded app.
- A typo or a non-chat address is refused before anyone types a password.

Trade-offs:

- Anyone can type any address, so a look-alike server that implements `/api/meta` could collect
  passwords. The server in use is always visible, and HTTPS is required for public hosts
  ([threat model](../threat-model.md)).
- The app's name and icon are generic in the public build; the server's own name appears only after
  `/api/meta` answers.

## Alternatives considered

- **A build per server only.** Simple and safe, but a burden for small deployments.
- **A server directory.** Needs a central service, which a self-hosted product should not depend
  on.
- **Discovery from an email domain.** Needs DNS or well-known files every self-hoster would have to
  publish.
