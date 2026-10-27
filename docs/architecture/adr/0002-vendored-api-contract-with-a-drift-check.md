# ADR 0002: The server's types and API client are vendored verbatim, with a drift check

## Status

Accepted.

## Context

The server repository publishes its contract as two TypeScript packages: `packages/types` (every
request, response and event type) and `packages/api-client` (`@open-chat/api-client`, the typed
client its web app uses). The client has no DOM dependencies, already speaks native token mode
(`X-Client: native`, a pluggable refresh token store) and can read turn streams over
XMLHttpRequest. The packages are not published to a registry.

A hand-written client in the app would drift from the server silently. A git submodule or a
workspace link would tie the app's build to a server checkout.

## Decision

- [`scripts/sync-types.mjs`](../../../scripts/sync-types.mjs) copies both packages from a
  euron-open-ai-chat checkout (default `../euron-open-ai-chat`) into
  [`src/api/vendor/`](../../../src/api/vendor/): `types/` and `client/`. The **whole** client is
  copied, unchanged except that the `@open-chat/types` import points at the vendored copy. Each
  file gets a header saying not to edit it.
- The server commit it came from is written to `src/api/vendor/SOURCE` (with a note when the
  server checkout had uncommitted changes in those packages).
- `pnpm sync-types:check` fails with the list of drifted files when the vendored copy differs from
  the checkout. Without a checkout at the path it prints a notice and passes, so local runs never
  block on a missing sibling; CI checks out the server so the check is real.
- [`src/api/client.ts`](../../../src/api/client.ts) is the only app code around it: it builds the
  client with the app's token store and hooks.

## Consequences

Positive:

- The app and the web app use the same client code, so streaming, refresh and error handling
  behave the same.
- A server change that breaks the app shows up as a type error after `pnpm sync-types`, or as a
  failed contract check in CI.
- Reviewers can see exactly which server version the app targets.

Trade-offs:

- The admin endpoint group comes along unused. Copying everything keeps the check exact.
- A contract change is two pull requests: the server first, then the sync here.
- The check compares against the server's main branch, so an unreleased server change can fail
  the app's CI until the sync lands.

## Alternatives considered

- **Publish the packages to npm.** Adds a release process to the server for one consumer.
- **Generate a client from `openapi.yaml`.** Loses the hand-written streaming and refresh logic the
  server already tests.
- **Copy only the types and write the client here.** Duplicates the hardest part (streams and
  refresh).
