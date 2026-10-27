# ADR 0006: Push is offered in context and armed per answer

## Status

Accepted. The client side of
[server ADR 0015](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/0015-push-opt-in-per-answer.md).

## Context

The server pushes only for a turn the app explicitly arms with `POST /api/turns/:id/notify`, and
only when it runs with `PUSH_PROVIDER=fcm`. Notification text passes through Google and Apple and
shows on the lock screen. Many self-hosters will not set up Firebase at all.

On the app side, a permission prompt at launch is easy to refuse and hard to undo: iOS asks once,
and Android 13+ asks a limited number of times. People understand the value of "tell me when it is
ready" best right after waiting for a long answer.

## Decision

- **Push exists only when the server and the build both have it**: `features.push` from
  `/api/meta`, and a Firebase app configured from the deployment's own files. Without either, there
  is no prompt, no offer and no error ([`push.ts`](../../../src/lib/push.ts)).
- **Never ask at launch.** The system prompt is shown only after a person taps **Turn on**, either
  in the one-time offer or in Settings, Notifications.
- **The offer comes once, in context**: after an answer that took more than 10 seconds ends in the
  foreground, on an eligible device that is not registered
  ([`offer.ts`](../../../src/features/push/offer.ts)). Either answer is remembered.
- **Arm per answer**: the turn runner calls `notify` only for turns it leaves mid-stream and only
  when this device has a registered token.
- **Taps open the conversation** (`type: "turn"`, `conversationId`); every other payload is
  ignored.
- **Sign-out forgets the device** on the server and deletes the FCM token locally.

## Consequences

Positive:

- No notification noise: a push means "the answer you left is ready", nothing else.
- The prompt appears when its value is obvious, which keeps the refusal rate low and never wastes
  the one iOS prompt at launch.
- Deployments without Firebase lose nothing but push.

Trade-offs:

- Someone who never waits more than 10 seconds never sees the offer; the switch in Settings is the
  other way in.
- A self-hoster who wants push needs a Firebase project, an APNs key and a server service account
  ([push guide](../../guides/push.md)).
- A killed app cannot arm a push.

## Alternatives considered

- **Ask at first launch.** The usual pattern, and the one most likely to be refused.
- **Register every device and push every answer.** Rejected on the server side (noise, text through
  third parties).
