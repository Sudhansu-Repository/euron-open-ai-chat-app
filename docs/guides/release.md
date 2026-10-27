# Release

Turning the template into your organisation's app and shipping it to the stores. Run through it once
on a fresh clone.

## 1. Identity

```bash
scripts/rename-app.sh --id org.example.chat --name "Example Chat" --scheme examplechat
```

[`rename-app.sh`](../../scripts/rename-app.sh) edits files in place:

| Platform | What changes |
| --- | --- |
| iOS | `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project, `CFBundleDisplayName` and the URL scheme in `Info.plist` |
| Android | `applicationId` and `namespace` in `android/app/build.gradle`, the Kotlin package directory and declarations, `app_name`, the scheme in `AndroidManifest.xml` |
| JavaScript | `APP_SCHEME` in `.env` and `.env.example` |

It does not rename the Xcode project or scheme (`OpenChat`) or the Keychain service name; neither is
visible to people. Review the diff, then `pnpm pods`. The Maestro flows use `appId:
com.example.openchat`; change it in every flow if you run them against the renamed app.

## 2. Icons and launch screen

- iOS: `ios/OpenChat/Images.xcassets/AppIcon.appiconset` and `LaunchScreen.storyboard`.
- Android: `android/app/src/main/res/mipmap-*` (`ic_launcher`, `ic_launcher_round`).

## 3. Release configuration

A release `.env`:

```bash
API_BASE_URL=https://chat.example.com/api
APP_SCHEME=examplechat
ALLOW_CUSTOM_SERVER=false      # your own app, locked to your server; true for a generic build
```

A release build without `API_BASE_URL` throws at start. Android release builds allow HTTPS only.

## 4. Signing

**iOS.** Open `ios/OpenChat.xcworkspace`, target `OpenChat`, **Signing & Capabilities**, set your
team (the repository ships with no team, and the sanitisation scan rejects a committed team id). Add
**Push Notifications** if you use push. Archive with Product, Archive (scheme `OpenChat`,
configuration Release), then distribute through the Organizer.

**Android.** Create an upload keystore once:

```bash
keytool -genkeypair -v -keystore android/app/upload.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

and `android/keystore.properties` (git-ignored):

```properties
storeFile=upload.keystore
storePassword=...
keyAlias=upload
keyPassword=...
```

`storeFile` is resolved relative to `android/app`. When the file exists the release build type signs
with it; without it a release build is unsigned. Keystores other than the React Native debug keystore
are git-ignored. Build the bundle for Play:

```bash
cd android && ./gradlew bundleRelease     # android/app/build/outputs/bundle/release/app-release.aab
```

Use Play App Signing so the upload key can be replaced if lost.

> [!WARNING]
> Release builds have not been exercised end to end in this repository yet. R8 minification is off
> (`enableProguardInReleaseBuilds = false` in `android/app/build.gradle`), as in the template this
> app started from. Test a release build on a device before you submit it, and if you turn R8 on,
> check every native module's keep rules.

## 5. Versions

| | Marketing version | Build number |
| --- | --- | --- |
| iOS | `MARKETING_VERSION` (Xcode: Version) | `CURRENT_PROJECT_VERSION` (Xcode: Build) |
| Android | `versionName` in `android/app/build.gradle` | `versionCode` in the same file |

Both start at `1.0` / `1`. Every store upload needs a higher build number. About shows
`<version> (<build>)`. To retire old versions, set the server's `minSupportedVersion`: older apps
show the update gate with a store link.

## 6. Server contract

The app targets the server version recorded in `src/api/vendor/SOURCE`. Before a release, run
`pnpm sync-types:check` against the server version you deploy; a drift means the app and server
disagree on a shape ([testing](testing.md#api-contract)).

## 7. App Store review

- **Account deletion** is in the app, as guideline 5.1.1(v) requires: Settings, Your data, Delete
  account. It asks for the username (and the password, or a code with two-step sign-in), signs out
  everywhere, and the server erases the data after its grace period.
- **Guideline 4.2 (minimum functionality).** The app is a native client with streaming, offline
  reading, voice, attachments, images and push, not a wrapped website. Say so in the review notes.
- **A demo account.** Give the reviewer an account on a server that is reachable from the internet
  over HTTPS, with models configured. If the build allows a custom server, say which address to
  enter, or ship the review build with `ALLOW_CUSTOM_SERVER=false`.
- **User-generated content and AI output.** Describe the server's moderation settings and how
  people report a problem (the feedback buttons under answers, and your support contact).
- **App Privacy.** Declare what your server collects: account data, chat content, files and images,
  audio sent for dictation, the push token, usage. The required reason API declarations are in
  `ios/OpenChat/PrivacyInfo.xcprivacy`.

## 8. Google Play

Declare the same data in the Data safety form. The account deletion path above also covers Play's
requirement; Play additionally asks for a web link where people can request deletion, which your
server's web app can provide. Review Google Play's policy on AI-generated content for your
countries before launch.

## Checklist

- [ ] `rename-app.sh` run, diff reviewed, pods reinstalled
- [ ] Icons and launch screen replaced
- [ ] Release `.env` with an HTTPS `API_BASE_URL`, your scheme and `ALLOW_CUSTOM_SERVER` decided
- [ ] Signing: Xcode team; `android/keystore.properties` and the upload keystore kept safe
- [ ] Push: Firebase files added (and the plist added to the target), APNs key uploaded, server configured
- [ ] A release build tested on a real iPhone and a real Android phone
- [ ] Version and build numbers bumped
- [ ] `pnpm sync-types:check` against the server version you deploy
