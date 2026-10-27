# Sessions and native tokens

How the app signs in, keeps a session across launches, refreshes it, and ends it. The server side
is [server ADR 0013](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/0013-native-token-mode.md);
the app's decision is [ADR 0003](adr/0003-native-token-mode-and-keychain.md). Code:
[`src/app/session.tsx`](../../src/app/session.tsx), [`src/api/client.ts`](../../src/api/client.ts),
[`src/lib/secure-store.ts`](../../src/lib/secure-store.ts) and the vendored
[`http.ts`](../../src/api/vendor/client/http.ts).

## 1. Native token mode

The vendored client is created with a `native` token store, so it sends `X-Client: native` on every
request and never uses cookies (`credentials: "omit"`). In that mode every endpoint that issues a
session (sign-in, including the second factor; sign-up without verification; verify-email;
refresh) returns the `AuthResult` plus `refreshToken` and `refreshExpiresAt` in the body.

| Token | Where it lives | Lifetime |
| --- | --- | --- |
| Access token | A ref in `SessionProvider`, memory only | Short; refreshed on demand |
| Refresh token | Keychain (iOS) or Keystore-backed storage (Android), service `open-chat.session`, as JSON `{ refreshToken, refreshExpiresAt, server }` | Rotates on every refresh |

The Keychain entry is `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: readable after the first unlock since
boot (so a refresh works when a notification opens the app), never synced to other devices or
included in backups.

## 2. Launch

On launch `SessionProvider` reads the stored session:

1. Nothing stored, a session for **another server**, or one past `refreshExpiresAt`: clear it,
   clear the query cache (memory and disk), status `signedOut`.
2. Otherwise call `refreshSession()` once:
   - success: keep the new access token and the user, status `signedIn`;
   - the server answers 401 or 403: end the session locally (below);
   - a network error, or no answer within 10 s (`BOOT_TIMEOUT_MS`): keep the stored session,
     status `offline`, and open on the cached chats. The navigator retries when NetInfo reports a
     change from disconnected to connected.

## 3. Refresh

The vendored client refreshes when a request gets `401` with a stale-token code
(`TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_EXPIRED`, or `UNAUTHENTICATED` while a token was sent):

- **Single flight.** Concurrent callers share one `POST /api/auth/refresh` with
  `{ refreshToken }` in the body. The app runs one JavaScript runtime, so the client's in-memory
  single flight is enough (`crossTabLock: (fn) => fn()`).
- **Save before use.** The rotated refresh token is written to the Keychain through
  `native.setRefreshToken` before the access token is handed to anyone, so a crash cannot leave a
  spent token stored. The server revokes the whole family when a rotated token is replayed, so
  using one twice would sign the person out.
- **Network errors do not sign out.** Only a 401 or 403 from the refresh ends the session.
- The request is then retried once with the new access token.

Read aloud downloads audio outside the client (straight to a file); on a 401 it calls
`refreshSession()` once and retries ([voice](voice.md)).

## 4. Sign in, sign up, verify

| Screen | Call | Outcomes |
| --- | --- | --- |
| Sign in | `auth.login` with email or username and password, plus `totp` or `recoveryCode` when asked | Signed in; or "a code is needed" (the screen asks for the six digit code or a recovery code) |
| Sign up | `auth.signup` (shown only when the server's `registration` is `OPEN`) | Signed in; or "verification required" (the check-email screen) |
| Verify email | `auth.verifyEmail(token)` from `openchat://verify-email?token=` | Signed in |
| Forgot password | `auth.forgotPassword` | The server mails a reset link |

## 5. Ending a session

`endLocally()` runs for every way a session ends: forget both tokens, clear the Keychain entry,
clear the query cache in memory and on disk, forget the push token (and delete it from FCM), status
`signedOut`.

| Trigger | Server call first |
| --- | --- |
| Sign out | `DELETE /api/me/devices/:token` while the session still works, then `POST /api/auth/logout` with `{ refreshToken, deviceToken }` |
| Sign out of all devices | `POST /api/auth/logout-all` |
| The server rejects a refresh | none (the client calls `onSignedOut`) |
| Password change, account deletion | the change itself, then `POST /api/auth/logout-all` (the screen signs out of every device) |

Sign-out always completes locally, even offline or with a revoked session: the server call is
best effort.

## 6. One server at a time

A refresh token belongs to the server that issued it. The stored session carries the API base it
came from, and `getRefreshToken` returns it only when that matches the current server, so a token is
never sent to another host. `setServer()` signs out first when someone is signed in, saves the new
address, drops the cached meta and clears the query cache. See
[ADR 0004](adr/0004-server-picker.md) for the picker itself.

## 7. Devices

Settings, Devices lists the account's sessions (`users.sessions`) with this one first; any other can
be signed out (`users.revokeSession`), and "Sign out everywhere" ends them all
([`SessionsScreen.tsx`](../../src/features/settings/SessionsScreen.tsx)).
