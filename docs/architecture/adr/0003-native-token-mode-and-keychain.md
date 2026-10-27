# ADR 0003: Native token mode, the refresh token in the Keychain/Keystore with its server

## Status

Accepted.

## Context

The web app keeps the refresh token in an httpOnly cookie. A React Native app has no cookie jar it
controls well and a far better place for a long-lived secret: the platform keystore. The server
supports this with native token mode
([server ADR 0013](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/0013-native-token-mode.md)):
with `X-Client: native` the refresh token comes back in the response body, and refresh and logout
take it in the body.

Refresh tokens rotate on every use and a replayed one revokes the family, so the app must never use
a token twice, never lose a rotated one, and never send one to a server that did not issue it (the
app can switch servers, [ADR 0004](0004-server-picker.md)).

## Decision

- The vendored client is created with a `native` token store
  ([`session.tsx`](../../../src/app/session.tsx)); it sends `X-Client: native` on every request and
  omits credentials.
- The refresh token is stored in the Keychain/Keystore
  ([`secure-store.ts`](../../../src/lib/secure-store.ts)), service `open-chat.session`, as
  `{ refreshToken, refreshExpiresAt, server }`, with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
- The access token lives in a ref in memory only.
- The client's single-flight refresh is used as is (one JavaScript runtime, so no cross-tab lock),
  and the rotated token is written through `setRefreshToken` before it is used.
- `getRefreshToken` returns the stored token only when its `server` matches the server in use.
- Every way a session ends runs one function that clears the Keychain entry, both caches and the
  push token.

## Consequences

Positive:

- The secret sits where the platform protects it; it is not synced or backed up.
- A refresh works when a notification opens the app after the first unlock.
- A crash between rotation and storage cannot leave a spent token behind.
- Switching servers can never leak a token to the new host.

Trade-offs:

- The token passes through JavaScript in a response body; the app must never log it (it does not).
- `AFTER_FIRST_UNLOCK` rather than `WHEN_UNLOCKED`: a stolen phone that was unlocked once since
  boot keeps the Keychain item readable to the app itself. The alternative breaks refresh from a
  notification on a locked phone.

## Alternatives considered

- **Cookies through the native HTTP stack.** Couples token storage to cookie behaviour that differs
  per platform and keeps the secret outside the keystore.
- **MMKV with encryption.** Needs its own key, which belongs in the Keychain anyway.
