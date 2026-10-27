# ADR 0001: A bare React Native CLI app, not Expo

## Status

Accepted.

## Context

The app needs close control over its native projects:

- React Native Firebase, which resolves the Firebase SDK through Swift Package Manager and needs
  dynamically linked frameworks on iOS, plus a Podfile `post_install` fix for pods that call the
  type identifier APIs without declaring the frameworks (`RNCClipboard`,
  `react-native-image-picker`);
- Firebase configured only when the deployment's config file is present, on both platforms
  ([`AppDelegate.swift`](../../../ios/OpenChat/AppDelegate.swift),
  [`build.gradle`](../../../android/app/build.gradle)), so a build without push still compiles;
- Nitro modules for audio (`react-native-nitro-sound`), Keychain access with explicit
  accessibility classes, MMKV;
- hand-written platform security settings: App Transport Security, Android network security
  configs per build type, `allowBackup="false"`, the URL scheme, usage descriptions.

Each deployment also renames the app (bundle id, name, scheme) and signs it with its own accounts.
The sibling mobile client in the same family is a bare CLI app too, and this repository started
from its structure.

## Decision

A bare React Native app on `@react-native-community/cli` (React Native 0.87.1, New Architecture,
Hermes), with `ios/` and `android/` committed and edited directly. Native dependencies autolink.
Renaming is a script ([`scripts/rename-app.sh`](../../../scripts/rename-app.sh)) that edits the
projects in place. Metro runs on port 8098 (`pnpm start`, `pnpm ios`, `pnpm android` pass it) so it
does not collide with other React Native projects on the default port.

## Consequences

Positive:

- Every native setting is a reviewed file, readable in a pull request; the security-relevant ones
  are visible.
- CI builds with stock `xcodebuild` and Gradle.

Trade-offs:

- React Native upgrades are done by hand against the upgrade helper, including the native
  templates.
- No hosted build service or over-the-air update channel; releases go through the stores.
- Contributors need Xcode, CocoaPods, Android Studio and a JDK.
- The non-default Metro port needs care: a debug build that was not started by `pnpm ios` may look
  for Metro on 8081 ([troubleshooting](../../guides/troubleshooting.md#metro)).

## Alternatives considered

- **Expo (managed, with config plugins and prebuild).** Good for apps that fit its modules; here the
  conditional Firebase setup, the Podfile link fix and the hand-tuned security files would become
  config plugins that generate what is now plain source.
- **Separate native apps.** Two codebases for one client, while the server already ships a typed
  TypeScript client the app can reuse unchanged ([ADR 0002](0002-vendored-api-contract-with-a-drift-check.md)).
