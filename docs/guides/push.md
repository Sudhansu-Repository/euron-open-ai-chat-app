# Push notifications setup

How to turn on "your answer is ready" for your own build. Push is off until you do this, and the
app works fully without it. How it behaves is in [architecture/push.md](../architecture/push.md).
The server side, step by step, is the server's
[push guide](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/guides/push.md).

You need: a Firebase project, the Firebase config files for this app, an APNs key for iPhones, and a
service account key on the server.

## 1. Firebase project

1. In the Firebase console, create a project (Analytics is not needed).
2. Add an **iOS** app with your bundle id (`com.example.openchat` until you run
   `scripts/rename-app.sh`). Download `GoogleService-Info.plist`.
3. Add an **Android** app with your application id (the same value). Download
   `google-services.json`.

Both files identify your Firebase project, not a secret key, but they are per deployment: never
commit them. The sanitisation scan fails if either is in the tree.

## 2. iOS

1. Put the file at `ios/OpenChat/GoogleService-Info.plist`.
2. In Xcode, drag it into the `OpenChat` group and tick the `OpenChat` target, so it is copied into
   the app bundle. [`AppDelegate.swift`](../../ios/OpenChat/AppDelegate.swift) configures Firebase
   only when the bundle contains it.
3. In **Signing & Capabilities**, add **Push Notifications**. `Info.plist` already declares the
   `remote-notification` background mode.
4. In your Apple Developer account, under Certificates, Identifiers and Profiles, Keys, create a key
   with **Apple Push Notifications service (APNs)**. Download the `.p8` once and note its Key ID and
   your Team ID.
5. In Firebase, Project settings, Cloud Messaging, Apple app configuration, upload the `.p8` with
   the Key ID and Team ID.

Without step 5 Android receives pushes and iPhones do not. The iOS simulator does not receive remote
pushes reliably; test on a device.

## 3. Android

1. Put the file at `android/app/google-services.json`.
2. Rebuild. [`android/app/build.gradle`](../../android/app/build.gradle) applies the Google services
   plugin only when the file exists.

Use an emulator image with Google APIs (Play services) or a real device.

## 4. The server

On the euron-open-ai-chat server, create a service account with the **Firebase Cloud Messaging API
Admin** role in the same Firebase project, download its JSON key, and set:

| Variable | Value |
| --- | --- |
| `PUSH_PROVIDER` | `fcm` |
| `FCM_SERVICE_ACCOUNT_JSON` | The key file as one string (on AWS, a secret) |
| `PUSH_PREVIEW` | `false` (default): generic text. `true` puts the chat title and the start of the answer on the lock screen |

The server's [push guide](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/guides/push.md)
has the exact steps for local compose and Terraform.

## 5. Check it works

```bash
curl -s https://chat.example.com/api/meta | jq .features.push   # true
```

Then on a device:

1. Sign in. No prompt appears: the app never asks at launch.
2. Settings, Notifications: turn on **Tell me when an answer is ready** and allow notifications. (Or
   wait for a long answer: the offer appears once above the composer.)
3. Ask for something long ("write a slow answer" against the local stubs) and put the app in the
   background before it finishes.
4. The notification arrives when the answer ends; tapping it opens the chat.

## 6. Locally, without Firebase

The server's `PUSH_PROVIDER=stub` sends to the local stubs instead of FCM (they record every
message at `http://localhost:5129/fcm/messages`). The app still needs a Firebase app to get a token,
so the end-to-end check needs real Firebase files in the build; the stub lets you test the server
side on its own.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| No Notifications row in Settings | The server reports `features.push: false` |
| The switch is disabled: "This build of the app has no notification service set up." | The Firebase file is missing from this build (iOS: not added to the target) |
| The switch is on but nothing arrives on iPhones | APNs key not uploaded to Firebase, or the bundle id differs from the Firebase iOS app |
| Nothing arrives after leaving the app | The app was killed before it could arm the push, or the answer finished before you left (`notify` answered `finished`) |
| The prompt never appears again after "Don't allow" | By design; the switch points to the phone's settings |
