# App architecture

How the code is organised: folders, navigation, server state, the session, theming and tests.
The system around the app is in [HLD.md](HLD.md).

## 1. Folders

```
App.tsx                         providers, outermost first: gestures, safe area, keyboard,
                                theme, the persisted query client, session, navigation
src/config.ts                   build-time settings from .env (react-native-config)
src/app/
  Navigator.tsx                 auth stack or the signed-in drawer; retries an offline session
  routes.ts                     every screen and its params, typed
  linking.ts                    deep links on openchat://
  navigation-ref.ts             navigation from outside screens (push taps)
  session.tsx                   SessionProvider: native tokens, sign in and out, server switch
  meta.tsx                      useMeta(), useFeatures(), versionBelow()
  query.ts                      query client, keys (qk), offline persistence to MMKV
  UpdateGate.tsx                blocks the app below the server's minSupportedVersion
src/api/
  client.ts                     makeApi(): the vendored client in native token mode
  vendor/                       copied from euron-open-ai-chat by pnpm sync-types; never edited
src/features/
  auth/AuthScreens.tsx          welcome, server, sign in, sign up, check email, forgot
                                password, verify email
  chat/                         ChatScreen, Composer, MessageView, Sidebar, SearchScreen,
                                ModelPicker, SourcesSheet, attachments.ts, actions.ts,
                                queries.ts, turn-runner.ts, markdown/
  voice/                        dictation.ts, readAloud.ts
  images/                       the gallery and the viewer
  projects/                     the projects list and a project
  settings/                     Settings and every account screen, lib/ (format, files, signout)
  push/                         PushBridge, PushOffer, offer.ts
src/ui/                         theme/ (tokens, ThemeProvider) and components/
src/lib/                        server.ts, push.ts, secure-store.ts, storage.ts, urls.ts
test/                           Jest setup, render helpers, after-each
```

Rules of thumb:

- **Logic next to the screen, in plain TypeScript, with a test.** `turn-runner.ts`, `offer.ts`,
  `lib/push.ts` (`pushDecision`), `lib/server.ts` (`normalizeServer`), `markdown/parse.ts`,
  `queries.ts` (date groups) are pure or close to it and tested directly.
- **Errors by code.** Screens switch on `ApiError.code`, never on message text.
- **Theme only through `useTheme()`.** No colour is hardcoded in a screen.

## 2. Navigation

React Navigation 7. [`Navigator.tsx`](../../src/app/Navigator.tsx) picks the tree from the
session status:

| Status | Tree |
| --- | --- |
| `booting` | A spinner while the stored session is checked |
| `signedOut` | The auth stack: Welcome, Server, SignIn, SignUp, CheckEmail, ForgotPassword, VerifyEmail |
| `signedIn` or `offline` | A stack whose first screen is `Main`, a drawer whose content is the sidebar around the chat screen; Search, Projects, Project, Images, ImageViewer, Settings and every account screen are pushed over it |

Every route and its params are in [`routes.ts`](../../src/app/routes.ts), so a renamed route fails
the typecheck instead of a tap. The whole tree sits inside `UpdateGate`.

### Deep links

[`linking.ts`](../../src/app/linking.ts), on the app's scheme (`openchat://` until renamed):

| Link | Opens |
| --- | --- |
| `openchat://c/:id` | A conversation (what a push tap opens) |
| `openchat://projects`, `openchat://projects/:id` | Projects, a project |
| `openchat://images` | The image gallery |
| `openchat://settings`, `settings/shared-links`, `settings/memories` | Settings screens |
| `openchat://verify-email?token=` | Email verification |

Linking is passed to the `NavigationContainer` only while signed in. The verify-email screen is in
the signed-out stack, so that link does nothing while signed out today; see the
[threat model](threat-model.md#known-gaps).

## 3. Server state

TanStack Query 5, created in [`query.ts`](../../src/app/query.ts):

- `staleTime` 30 seconds, `gcTime` 24 hours, one retry for network errors and none for 4xx,
  refetch when the app returns to the foreground (`focusManager` wired to `AppState`).
- `onlineManager` follows NetInfo, so queries pause offline and refresh on return.
- Keys come from `qk` only (`qk.chat(id)`, `qk.chats(filter)`, `qk.projects`, `qk.models`, ...),
  so invalidations always match.
- The cache is persisted to MMKV through `PersistQueryClientProvider` in `App.tsx`
  ([offline cache](offline-cache.md)).

Turns write into the same cache: `turn-runner.ts` applies each event to `qk.chat(id)` and patches
the conversation's title in the list. See [streaming-and-background.md](streaming-and-background.md).

Client state that is not server state lives in small stores next to the feature:
`turnState` (which turns are running), `pushOffer` (whether the offer shows), the read-aloud
player state. Screens subscribe with `useSyncExternalStore`.

## 4. Session

[`session.tsx`](../../src/app/session.tsx) owns the API client, the access token (a ref, in
memory), the refresh token (Keychain through `secure-store.ts`), the signed-in user and the server
in use. It exposes `signIn`, `signUp`, `verifyEmail`, `signOut`, `setServer` and `retry`. Details
in [sessions-and-native-tokens.md](sessions-and-native-tokens.md).

## 5. Theming and design tokens

[`tokens.ts`](../../src/ui/theme/tokens.ts) holds the same palette as the web app
(`packages/ui/src/styles/tokens.css` in euron-open-ai-chat), as HSL so the two files can be compared
line by line: one teal brand, ink for text and solid calls to action, cool grey grounds and
hairlines. Radii, a 4 point spacing scale and the type scale (Bricolage Grotesque for display,
Hanken Grotesk for text, each weight its own file) are defined there too.
[`ThemeProvider.tsx`](../../src/ui/theme/ThemeProvider.tsx) picks light, dark or the system
setting, remembered in MMKV. See [ADR 0009](adr/0009-design-tokens-mirrored-from-the-web.md).

The visual rules the screens follow: answers are prose on the page ground, not cards; rows are type
on hairlines; actions are quiet icon buttons; nothing is a capsule.

## 6. Testing approach

- **Jest with the React Native preset** ([`jest.config.js`](../../jest.config.js)); tests sit
  next to the code as `*.test.ts(x)`.
- **Native modules are mocked once** in [`test/setup.ts`](../../test/setup.ts) (MMKV in memory,
  NetInfo, device info, Keychain, Firebase, and the rest), so tests never need a device.
- **Screens and components** render inside the app's providers with a fake session from
  [`test/render.tsx`](../../test/render.tsx). [`test/after-each.ts`](../../test/after-each.ts)
  lets pending queries settle and forgets the query clients.
- **Maestro flows** in [`e2e/flows`](../../e2e/flows) drive the debug app by `testID`
  (`<area>-<thing>`). They are written but have not been run in this repository yet
  ([e2e/README.md](../../e2e/README.md)).

How to run everything: [docs/guides/testing.md](../guides/testing.md).
