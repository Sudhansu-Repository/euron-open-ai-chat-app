# ADR 0010: Features are switched by the server, not by the build

## Status

Accepted.

## Context

One build talks to many self-hosted servers ([ADR 0004](0004-server-picker.md)). Each server turns
capabilities on or off: web search needs a search provider, images and speech need models,
push needs Firebase. A control that does nothing, or fails with an error, is worse than no control.
Servers may also be older than the app.

## Decision

- The server's `GET /api/meta` is the only source of what is on: `features.webSearch`,
  `imageGeneration`, `dictation`, `readAloud`, `memory`, `projects`, `sharing`, `push`, plus
  `registration`, upload `limits` and `minSupportedVersion`.
- [`featuresOf()`](../../../src/app/meta.tsx) treats every feature as **off** unless the server
  says it is on, so an older server that lacks a newer key hides that control.
- Meta is cached in MMKV, so the app opens with the right name and switches before the network
  answers; it counts as fresh for 5 minutes, then refetches on the next use.
- Each control checks its flag: web search and image mode in the composer, dictation, read aloud,
  projects and images in the sidebar and chat menu, sharing, memory and notifications in Settings.
  Sign-up shows only when `registration` is `OPEN`.
- `minSupportedVersion` above the app's version shows the update gate
  ([`UpdateGate.tsx`](../../../src/app/UpdateGate.tsx)).
- Build-time `.env` holds only what is needed before a server answers.

## Consequences

Positive:

- One build adapts to every server; a feature appears when the operator turns it on, with no app
  release.
- The server can retire old app versions.

Trade-offs:

- A first launch with no cached meta shows a minimal UI until `/api/meta` answers.
- Hidden is not denied: the server still enforces every feature and limit itself.

## Alternatives considered

- **Build flags.** One build per server configuration.
- **Try and handle the error.** Shows controls that fail.
