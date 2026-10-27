# ADR 0005: Send with a 202, follow over XHR, hand off to the server in the background

## Status

Accepted.

## Context

Answers stream. The server can stream a turn on the response of the send request, or answer `202`
with the turn id and let the client follow `GET /api/turns/:id/events` as Server-Sent Events,
resuming after any sequence number for an hour
([streaming.md](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/api/streaming.md)).
Turns run on the server whatever happens to the connection
([server ADR 0005](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/0005-turns-decoupled-via-redis-streams.md)).

On a phone:

- React Native's built-in `fetch` cannot read a body as it arrives; XMLHttpRequest exposes the
  growing response text on progress events.
- The OS suspends the app soon after it goes to the background; a request held open there will be
  cut anyway.
- People switch screens while an answer is written.

## Decision

- **Send, then follow.** `api.chats.send()` without the event-stream header returns 202; the turn is
  followed with `api.turns.follow(..., { transport: "xhr" })`
  ([`turn-runner.ts`](../../../src/features/chat/turn-runner.ts)).
- **Runners outside React.** A module-level map of running turns, writing events straight into the
  TanStack Query cache (`qk.chat(id)`), so screens only render the cache and a turn survives
  navigation.
- **Hand off on background.** On `active` to `inactive` or `background`, every live turn is marked
  detached and its request aborted; when this device can receive push, the runner calls
  `turns.notify` for each ([ADR 0006](0006-push-opt-in-per-answer.md)).
- **Resume on foreground** from the last sequence number applied; events at or below it are
  skipped.
- **Rejoin on open.** A conversation that loads with an active turn still streaming is followed from
  sequence 0, since the stored answer is empty until the turn ends.

## Consequences

Positive:

- No background execution entitlement, no long-lived socket, no lost or repeated text.
- The same client code as the web app (the XHR transport is part of the vendored client).
- Stop is a separate request (`turns.cancel`), so it works whether or not the app is following.

Trade-offs:

- XHR keeps the whole response text in memory for the life of the request; long answers grow it.
  Turns are finite, and the request ends with the turn.
- iOS reports `inactive` for short interruptions (Control Center, the app switcher), which also
  triggers a hand-off and a resume.
- A killed app cannot arm a push; the answer is there on the next open.

## Alternatives considered

- **Stream on the send response.** Not readable with React Native's fetch, and a dropped send would
  need special handling anyway.
- **A streaming fetch polyfill or a native SSE module.** More native code for what XHR already does.
- **WebSockets.** The server does not offer them, and they would still need resume logic.
- **Keep streaming in the background with a background task.** Platform limits make it unreliable,
  and the server keeps writing regardless.
