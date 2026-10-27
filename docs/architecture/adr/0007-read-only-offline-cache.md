# ADR 0007: A small, read-only offline cache that belongs to the session

## Status

Accepted.

## Context

People open a chat app on trains and planes to look something up in an earlier conversation.
Everything the app shows is already in TanStack Query's cache while it runs. But conversation text
is personal, phones are shared, and a chat history can be large.

## Decision

- Persist the query cache to MMKV with TanStack Query's sync storage persister
  ([`query.ts`](../../../src/app/query.ts)), restored at launch when younger than 7 days.
- Keep only what helps reading: the chat list (and pinned chats), the 20 most recently updated
  conversations, projects, models, preferences and the server's meta. Only successful queries.
- Cap the blob at 2 MB by dropping the oldest conversations first.
- **Read-only.** Offline, the composer explains that sending waits for a connection; nothing is
  queued.
- **The cache belongs to the stored session**: every way a session ends (sign-out, a rejected
  refresh, no usable session at launch, a server change) clears it on disk and in memory.
- Start offline on the cache when a session is stored but the server cannot be reached, and retry
  the session when the network returns.

## Consequences

Positive:

- Recent chats open instantly, online or not.
- No sync engine, no conflict handling, no outbox.
- The next person on a shared phone never sees the previous person's chats.

Trade-offs:

- Images and attachments in cached chats come from signed URLs that expire; offline they do not
  load.
- MMKV encryption is not turned on; the cache relies on the app sandbox and platform file
  protection ([threat model](../threat-model.md)).
- Only 20 conversations; older ones need the network.

## Alternatives considered

- **No offline support.** Simpler, and a poor experience on a phone.
- **A local database with sync and an outbox.** Far more code and state to get wrong, for writes
  that need the server (the model runs there) anyway.
- **Persist everything.** Unbounded storage of personal text.
