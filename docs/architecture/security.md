# Security

The controls in the app, where they live, and the limits we know about. The STRIDE analysis is in
[threat-model.md](threat-model.md). Server-side controls (authentication, quotas, tool safety,
what the server logs) are in the server repository's
[security.md](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/security.md).

## 1. The client is not trusted

The app decides nothing that matters. Which models a person may use, their limits, which features
exist, what a tool may fetch, who may see a shared link: all of it is the server's. The app holds no
provider key, no admin credential and no server secret, and renders what the API returns. A
modified app can only do what the signed-in account could do through the API anyway.

## 2. Storage on the device

| Data | Where | Notes |
| --- | --- | --- |
| Refresh token, its expiry, the server it belongs to | Keychain / Keystore ([`secure-store.ts`](../../src/lib/secure-store.ts)) | `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: not synced, not in backups |
| Access token | Memory only | Gone when the app is killed |
| Theme, server in use, cached meta, push token, "asked" and "offered" flags, last model | MMKV ([`storage.ts`](../../src/lib/storage.ts)) | Not secret |
| Offline query cache (chat titles and text, projects, preferences) | MMKV, at most 2 MB | Wiped on every session end; MMKV encryption is not on ([offline cache](offline-cache.md)) |
| Read-aloud audio | Cache folder | Deleted when playback ends or stops |
| An image being saved or shared, a data export | Cache folder | Written only for the share sheet or Photos; the OS may purge the cache folder. Recovery codes go to the share sheet as text, never to a file |

Android sets `android:allowBackup="false"`, so app data is not copied into device backups. Nothing
secret is logged by the app.

## 3. Transport

| Platform | Release | Debug |
| --- | --- | --- |
| iOS ([`Info.plist`](../../ios/OpenChat/Info.plist)) | `NSAllowsArbitraryLoads` off, `NSAllowsLocalNetworking` on: HTTPS everywhere, plain HTTP only to local network addresses | Same |
| Android ([network security config](../../android/app/src/main/res/xml/network_security_config.xml)) | HTTPS only (plus `127.0.0.1`) | Plain HTTP allowed ([debug config](../../android/app/src/debug/res/xml/network_security_config.xml)), for a local stack |

The server picker matches this: [`normalizeServer()`](../../src/lib/server.ts) assumes `https://`
and accepts `http://` only for `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*` and
`*.local`. A release build on Android still refuses plain HTTP to a LAN address, so a self-hoster
must use HTTPS for phones running release builds.

There is no certificate pinning: the platform trust store decides (see
[known limitations](#10-known-limitations)).

## 4. Sessions

Native token mode, single-flight refresh, save-before-use rotation, and a token that is only ever
sent to the server that issued it. Every way a session ends clears the Keychain, the caches and the
push token. Details in [sessions-and-native-tokens.md](sessions-and-native-tokens.md).

## 5. Choosing a server

A self-hosted app has to let people type an address, which means an attacker can try to get them
to type a hostile one. The picker ([`ServerScreen`](../../src/features/auth/AuthScreens.tsx),
[`server.ts`](../../src/lib/server.ts)):

- refuses addresses with credentials, a query or a fragment, and hosts without a dot (except
  `localhost`);
- refuses plain HTTP to public hosts;
- accepts a server only after `GET /api/meta` answers within 8 seconds with a JSON body that has an
  `appName`, `features` and `limits`;
- signs out of the current server before switching, so no token or cached chat crosses over.

A server that passes those checks is still trusted with everything the person types into it. The
welcome screen always shows which server is in use. A company that ships the app for its own server
sets `ALLOW_CUSTOM_SERVER=false` and the picker disappears ([ADR 0004](adr/0004-server-picker.md)).

## 6. Content from the model and the web

Answers, sources and tool output are untrusted text.

- **Markdown is drawn as native views.** Raw HTML is shown as text, never interpreted; markdown
  images are shown as links and never loaded ([markdown rendering](markdown-rendering.md)).
- **Math is the only WebView.** It loads an HTML string generated on the phone by KaTeX, with
  `default-src 'none'` (inline styles only), `originWhitelist` of `about:blank`, every navigation
  refused, no new windows and no file access. JavaScript is on only for one injected line that
  reports the height.
- **Links leave the app only as http or https**, through the in-app browser (a separate browser
  context: SFSafariViewController or a Custom Tab, not a WebView with app access). `mailto:` goes to
  the system; every other scheme is ignored ([`openLink`](../../src/features/chat/markdown/Markdown.tsx),
  [`urls.ts`](../../src/lib/urls.ts)).

## 7. Links into the app

The `openchat://` scheme opens a conversation, projects, images, settings screens, or email
verification ([`linking.ts`](../../src/app/linking.ts)). Links only navigate: opening a conversation
loads it with the person's own session, so a link to someone else's chat shows an error, not their
data. Linking is enabled only while signed in. Custom schemes are first come, first served on both
platforms; another app can register `openchat://` too.

## 8. Push

Push text is generic by default ("Your answer is ready."). Only a server operator can turn on
previews (`PUSH_PREVIEW`), which put the chat title and the start of the answer on the lock screen.
The app arms a push for one answer at a time and only when it leaves that answer mid-stream
([push](push.md)). Taps open a conversation by id, nothing else.

## 9. Release signing and secrets

- Release signing reads `android/keystore.properties` (git-ignored); without it the release build
  is unsigned. The iOS project ships with no team set.
- Firebase config files (`GoogleService-Info.plist`, `google-services.json`) are per deployment and
  never committed.
- [`scripts/check-sanitization.sh`](../../scripts/check-sanitization.sh) fails the build on cloud
  keys, private keys, Firebase API keys, Apple team ids in signing settings, Firebase or signing
  files in the tree, committed env files, real email addresses, public IP addresses, internal
  hostnames and em dashes. [`.gitleaks.toml`](../../.gitleaks.toml) runs in the full pipeline.

## 10. Known limitations

The honest list. Most are accepted for a chat client; some are open.

| Limitation | Why, and what would change it |
| --- | --- |
| No certificate pinning | A self-hosted app does not know its servers' certificates in advance. A device with a user-installed root CA can intercept traffic |
| No screenshot or screen-recording protection | A chat app, not paid media; people expect to screenshot answers. The app switcher snapshot shows the last screen |
| Offline cache is plain MMKV | Protected by the sandbox and file protection only; turning on MMKV encryption with a key in the Keychain would close it |
| Cached images need the network | Signed URLs in the cache expire |
| Math uses a WebView | Locked down as above, but it is still a browser engine on untrusted input |
| Release builds with R8 untested | Minification is off (`enableProguardInReleaseBuilds = false`), as in the template this app was built from; turning it on needs keep rules checked for every native module |
| Maestro flows never executed | Written against the screens' `testID`s, not yet run ([e2e/README.md](../../e2e/README.md)) |
| Push needs the self-hoster's own Firebase project | And an APNs key uploaded to it for iPhones |
| The verify-email link works only if the server's mail links to `openchat://` | The server's verification mail normally links to its web app. When it does link here, the screen waits for a tap before it uses the token (see the [threat model](threat-model.md#known-gaps)) |
| Jailbroken or rooted devices | The Keychain and the sandbox can be read there; out of scope |
