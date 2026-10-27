# Push

The app gets one kind of notification: "your answer is ready", for an answer it left while it was
being written. This page is the client side of
[server ADR 0015](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/0015-push-opt-in-per-answer.md);
the decision for the app is [ADR 0006](adr/0006-push-opt-in-per-answer.md) and the setup is in the
[push guide](../guides/push.md).

## 1. When push is on

Push works only when all of these hold:

| Condition | Checked by |
| --- | --- |
| The server can send (`features.push` in `GET /api/meta`, which needs `PUSH_PROVIDER=fcm` and a service account on the server) | `useFeatures()` |
| This build has a Firebase app: `GoogleService-Info.plist` bundled on iOS, `google-services.json` present at build time on Android | `getPushMessaging()` returns null otherwise |
| Someone is signed in | the session |
| The person allowed notifications | `readPushPermission()` |

A build without the Firebase files has no push, silently: on iOS
[`AppDelegate.swift`](../../ios/OpenChat/AppDelegate.swift) configures Firebase only when the
plist is bundled (looked up by class name, so the target compiles without it); on Android
[`build.gradle`](../../android/app/build.gradle) applies the Google services plugin only when the
JSON file exists.

`pushDecision()` in [`src/lib/push.ts`](../../src/lib/push.ts) turns those inputs into `off`,
`offer` or `register`. It is pure and every guard has a test.

## 2. Asking, never at launch

The app never shows the system prompt at launch or after sign-in. There are two ways in:

- **The offer.** After an answer that took more than 10 seconds (`SLOW_ANSWER_MS`) ends in the
  foreground, on a server with push, in a build with Firebase, on a device that is not registered,
  one quiet line appears above the composer: "Leave while an answer is written and get told when it
  is ready?" with **Not now** and **Turn on** ([`PushOffer.tsx`](../../src/features/push/PushOffer.tsx),
  [`offer.ts`](../../src/features/push/offer.ts)). Either answer is remembered (`push.offered`)
  and it never shows again.
- **Settings, Notifications.** One switch, "Tell me when an answer is ready"
  ([`NotificationsScreen.tsx`](../../src/features/settings/NotificationsScreen.tsx)). It is
  disabled with a reason when the server has no push or the build has no Firebase, and points to
  the phone's settings when permission was refused.

**Turn on** asks the system (Android 13+ `POST_NOTIFICATIONS`, the iOS alert; the time of asking
is remembered so a refusal is never asked again), then registers the device.

## 3. Registering

`registerThisDevice()` gets the FCM token and calls `PUT /api/me/devices` with the platform
(`IOS` or `ANDROID`), the token and the app version, then stores the token in MMKV
(`push.token`). `PushBridge` also registers silently after sign-in when permission was already
granted, and re-registers when FCM rotates the token.

A stored token is what makes the device eligible for the background hand-off:
`canReceivePush(features.push)` is true only with a token.

## 4. Arming per answer

When the app goes to the background mid-answer, the turn runner calls
`POST /api/turns/:id/notify` for each live turn, only when `canReceivePush` is true
([streaming](streaming-and-background.md#3-the-background-hand-off)). Without that call the server
never pushes.

## 5. Receiving

The server sends the app name and "Your answer is ready." (or "Your answer could not be
finished."), with data `type: "turn"`, `conversationId` and `messageId`. The text is generic unless
the server operator sets `PUSH_PREVIEW=true`, in which case the title is the chat title and the
body the first 120 characters of the answer.

[`PushBridge.tsx`](../../src/features/push/PushBridge.tsx) handles:

| Case | Behaviour |
| --- | --- |
| Tap while the app is in the background | `onNotificationOpenedApp`: open the conversation |
| Tap that cold-starts the app | `getInitialNotification`: open the conversation once navigation is ready (retried every 100 ms, up to 5 seconds) |
| A message while the app is in the foreground | A short toast with the body |
| Anything without `type: "turn"` and a conversation id | Ignored (`conversationOf()` returns null) |

Opening the conversation loads it; if its answer is still streaming the runner rejoins the turn.

## 6. Turning it off and signing out

- The switch off calls `DELETE /api/me/devices/:token`, deletes the FCM token and
  forgets it locally.
- Sign-out sends the stored token with `POST /api/auth/logout`, so the server drops that device;
  "Sign out everywhere" removes every device of the account on the server. Locally the token is
  forgotten and deleted from FCM, so the next person on the phone gets a fresh one.
- If the server turns push off, `PushBridge` forgets the token so nothing is armed.

## 7. Tests

[`push.test.ts`](../../src/lib/push.test.ts): off without Firebase, without server push or signed
out; register when allowed, offer once when undecided, never nag after a refusal; open only
answer-ready notifications; arm only a registered device.
[`offer.test.ts`](../../src/features/push/offer.test.ts): the offer appears after a slow answer on
an eligible device and never after a quick one; answering it either way means it never returns.
