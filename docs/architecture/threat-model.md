# Threat model

A STRIDE analysis of the mobile app as built, against a euron-open-ai-chat server deployed with its
production defaults. Server-side threats (prompt injection through tools, quotas, the admin plane,
shared links) are analysed in the server repository's
[threat-model.md](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/threat-model.md);
this page covers what the app adds. Controls are described in [security.md](security.md).
**Accepted** means a design choice; **open** means a known gap that should be fixed; the rating
(low, medium, high) is the impact on a typical deployment if exploited.

## Scope and trust boundaries

| Boundary | Crossing |
| --- | --- |
| TB1 | The app to the euron-open-ai-chat API over the internet (TLS, `X-Client: native`, bearer token) |
| TB2 | The app to third parties on URLs the API handed out: object storage (presigned upload, signed downloads), FCM, web pages in the in-app browser |
| TB3 | Other apps on the same phone: the URL scheme into the app, the share sheet out |
| TB4 | The device itself: the Keychain/Keystore, the app sandbox, backups, the lock screen, the app switcher |
| TB5 | The person choosing a server: the address typed on the welcome screen |

| Principal | Holds |
| --- | --- |
| Visitor | Nothing; sees the welcome screen of the server in use |
| Member | A refresh token in the keystore, an access token in memory, cached chats in MMKV |
| Another app on the phone | Can send links to the app's scheme and receive what the person shares |
| Someone holding the unlocked phone | Everything the member can do in the app |
| Someone seeing the locked phone | Notifications on the lock screen |
| A network attacker | Can observe and modify traffic it can intercept |
| A hostile server | Whatever a person sends to it after choosing it |

## Spoofing

| Threat | Control | Status |
| --- | --- | --- |
| Replaying a stolen refresh token | Rotation on every use; reuse revokes the family on the server; the app single-flights refresh and saves before use, so it never trips this itself | Accepted, low |
| Reading the refresh token from storage | Keychain/Keystore, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, never in MMKV or logs | Accepted, low |
| A refresh token sent to the wrong host | The stored session carries its server; it is returned only for that server, and switching servers signs out | Accepted, low |
| A look-alike server collecting passwords (phishing someone into typing its address) | Only addresses that answer `/api/meta` like an Open AI Chat server are accepted; the server in use is shown on the welcome screen; HTTPS required for public hosts; `ALLOW_CUSTOM_SERVER=false` removes the picker | Accepted, medium. A server that implements `/api/meta` passes |
| A crafted `openchat://verify-email?token=<attacker's token>` signing the phone into the attacker's account | While signed out only this one link is routed, and the screen it opens explains what happens and waits for "Verify and sign in"; nothing is used on open | Mitigated, low: a person who taps through still lands in that account, and sees its name in Settings |
| A man-in-the-middle presenting a certificate from a user-installed root CA | Platform trust store only | Accepted (no pinning), medium |

## Tampering

| Threat | Control | Status |
| --- | --- | --- |
| Modifying requests to exceed limits or use disabled features | The server enforces quotas, models and features; the app's switches only hide controls | Accepted, low |
| Injected markup in an answer (HTML, script) | Native rendering; raw HTML shown as text; markdown images not loaded | Accepted, low |
| Malicious TeX in display math | KaTeX output in a WebView with `default-src 'none'`, no navigation, no file access; bad TeX shown as code | Accepted, low |
| A link in an answer pointing at `javascript:`, `file:` or an app scheme | Only http and https open (in-app browser); `mailto:` to the system; others ignored | Accepted, low |
| Tampering with the offline cache on a rooted device | Out of scope (device compromised); the cache is display-only and refetched online | Accepted, low |

## Repudiation

| Threat | Control | Status |
| --- | --- | --- |
| Denying an action taken from the app | The server's audit log and session records (device and last activity, shown in Settings, Devices) | Accepted, low |

## Information disclosure

| Threat | Control | Status |
| --- | --- | --- |
| Chat text on the lock screen | Generic push text by default; previews only if the operator sets `PUSH_PREVIEW` | Accepted, low (operator choice) |
| Chat text read from the offline cache | Sandbox and platform file protection; at most 20 conversations and 2 MB; wiped on every session end. MMKV encryption is off | **Open, medium.** Fix: MMKV encryption with a key in the Keychain |
| Chat visible in the app switcher snapshot or in screenshots | None: no screenshot protection in a chat app | Accepted, low |
| The next person on a shared phone seeing chats | Sign-out wipes the cache in memory and on disk, deletes the push token, clears the Keychain | Accepted, low |
| Pushes for the previous account on a shared phone | Sign-out sends the device token so the server drops it; the token is deleted from FCM; a new one is created for the next account | Accepted, low |
| Files left in the cache folder (data export, a saved image) | Written only for the share sheet or Photos; read-aloud audio is deleted after playback | Accepted, low |
| Backups carrying app data | `allowBackup="false"` on Android; the Keychain entry is this-device-only | Accepted, low |
| Plain HTTP to a LAN server on iOS | `NSAllowsLocalNetworking` allows it in every build; the picker allows `http://` only for local addresses | Accepted, low (a home or office network) |
| Content shared to another app | Only what the person chooses in the share sheet | Accepted, low |

## Denial of service

| Threat | Control | Status |
| --- | --- | --- |
| A huge answer or table freezing the UI | Blocks memoised on raw text; tables and code scroll; math capped at 600 points tall | Accepted, low |
| A server that never answers the picker | 8 second timeout on `/api/meta` | Accepted, low |
| Reconnect storms while following a turn | The client backs off (400 ms doubling to 8 s, 8 attempts) | Accepted, low |
| An app version the server can no longer serve | `minSupportedVersion` in meta shows the update gate | Accepted, low |

## Elevation of privilege

| Threat | Control | Status |
| --- | --- | --- |
| Reaching admin endpoints from the app | The vendored admin endpoint group is present but unused; the server checks the role on every admin route | Accepted, low |
| Another app driving the app through `openchat://` | Links only navigate to screens of the signed-in account; no link performs an action | Accepted, low |

## Known gaps

Things a reviewer should know before trusting this app in production:

- **Maestro flows never executed.** The 10 flows in [`e2e/flows`](../../e2e/flows) are written
  against the screens' `testID`s but have not been run in this repository yet.
- **Release build and R8 untested.** `enableProguardInReleaseBuilds` is `false` (as in the template
  this app started from), and no signed release build has been exercised end to end.
- **Push needs the self-hoster's own Firebase project**, with an APNs key for iPhones and a service
  account on the server. Without it there is no push, by design.
- **Cached images need the network.** Signed file URLs in the offline cache expire.
- **Math blocks use a WebView**, sandboxed as described above.
- **No certificate pinning** and **no screenshot protection**, both by choice.
- **Verify-email deep link.** It works only if the server's verification mail links to
  `openchat://verify-email?token=...`; the server's mail normally links to its web app. While signed
  out, [`linking.ts`](../../src/app/linking.ts) routes only this link, and `VerifyEmailScreen` waits
  for a tap before it uses the token.
- **Offline cache not encrypted** (see Information disclosure).
- **Android release builds refuse plain HTTP to LAN servers**, while the picker accepts them; the
  connection then fails with "The server could not be reached". Self-hosters should serve HTTPS.
