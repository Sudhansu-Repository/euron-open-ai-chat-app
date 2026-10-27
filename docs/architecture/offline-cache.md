# Offline cache

What the app keeps on the phone so recent chats open instantly and can be read with no network,
and when it throws it away. The code is in [`src/app/query.ts`](../../src/app/query.ts) and
[`App.tsx`](../../App.tsx); the decision is [ADR 0007](adr/0007-read-only-offline-cache.md).

## 1. What is kept

TanStack Query's cache is persisted with `@tanstack/query-sync-storage-persister` to one MMKV key
(`query.cache.v1`, see [`src/lib/storage.ts`](../../src/lib/storage.ts)). `trimForDisk()` keeps:

| Query root | What it is |
| --- | --- |
| `chats` | The sidebar list (pages of conversation summaries) and pinned chats |
| `chat` | Single conversations, only the **20** most recently updated |
| `projects`, `project` | The projects list and projects that were opened |
| `models` | The model catalogue for the picker |
| `preferences` | The account's personalization |
| `meta` | The server's `GET /api/meta` |

Only queries in the `success` state are kept. Sessions, usage, memories, images, shares and the
signed-in user are not persisted.

`serializeCache()` then writes the JSON and, while it is larger than **2 MB**
(`MAX_CACHE_BYTES = 2_000_000` characters), drops the oldest conversation and tries again. If no
conversations are left and it is still too large, it writes an empty cache.

Writes are throttled to one every 2 seconds. On launch, `PersistQueryClientProvider` restores the
cache if it is younger than 7 days (`CACHE_MAX_AGE`) and was written with the same buster (`v1`).

## 2. Answers being written

A conversation whose answer is still streaming is in the cache with that answer in `STREAMING`
state. When the app opens it again online, `resume()` rejoins the turn and the server replays it
([streaming](streaming-and-background.md#5-opening-a-chat-mid-answer)). Offline, the chat screen
does not try to resume.

## 3. Using it offline

- **At launch.** With a stored session and no answer from the server (no network, the server down,
  or a connection that hangs: the refresh gives up after 10 s, `BOOT_TIMEOUT_MS`), the session
  status is `offline`; the signed-in app opens and the screens render from the restored cache. The
  session is retried when NetInfo reports the device going from disconnected to connected. It is
  not retried on the listener's first call (the current state), which would loop while the device
  is online but the server is not answering.
- **While running.** `onlineManager` follows NetInfo, so queries pause instead of failing and
  refetch on return.
- **The composer** is replaced by one line: "You are offline. Your recent chats are here to read;
  sending waits for a connection." Nothing is queued.

## 4. When it is wiped

The cache belongs to the stored session. `clearPersistedCache()` removes the MMKV key, and
`queryClient.clear()` empties memory, whenever:

| Event | Where |
| --- | --- |
| Sign out, or sign out everywhere | `endLocally()` in [`session.tsx`](../../src/app/session.tsx) |
| The server rejects the refresh token (expired, revoked, reused) | `onSignedOut` from the client, then `endLocally()` |
| Launch finds no usable stored session (none, another server's, or expired) | The boot effect in `session.tsx` |
| The server is changed | `setServer()` signs out first, clears the cached meta and the cache |

So the next person to sign in on the phone never sees the previous person's chats.

## 5. Limits we know about

- **Images and files need the network.** The cache holds the API's JSON, including signed file
  and image URLs. Those URLs expire, so a cached chat shows its text offline but its images and
  attachment previews only load while the URL is still valid and the phone is online.
- **Plain MMKV, not encrypted.** The cache sits in the app's sandbox, protected by the platform's
  file protection, but MMKV encryption is not turned on. It holds conversation text; see the
  [threat model](threat-model.md).
- **The size limit counts characters**, not bytes on disk; text in non-Latin scripts takes more
  bytes than the limit suggests.

## 6. Tests

[`query.test.ts`](../../src/app/query.test.ts): `trimForDisk` keeps only the persisted roots,
successful queries and the newest conversations; `serializeCache` drops the oldest conversations
until the blob fits.
