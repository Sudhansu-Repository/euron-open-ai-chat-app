# Troubleshooting

## Metro

**"Unable to load script", "No bundle URL present" or a red screen about the bundle.** Metro is not
running, or the build is looking on the wrong port. This repository runs Metro on **8098**, not the
default 8081:

- Run `pnpm start` in its own terminal (it passes `--port 8098`).
- Launch with `pnpm ios` or `pnpm android`, which pass the same port to the build.
- **iOS, built from Xcode or reinstalled by hand:** the debug build falls back to 8081. Set the
  location once per simulator:

  ```bash
  xcrun simctl spawn booted defaults write com.example.openchat RCT_jsLocation "localhost:8098"
  ```

  Use a device id from `xcrun simctl list devices` instead of `booted` for a simulator that is not
  running. Use your renamed bundle id after `scripts/rename-app.sh`.
- **Android:** run `pnpm android:reverse`, which forwards 8098 with the server's ports. Or set the
  port in the dev menu (shake or `adb shell input keyevent 82`, Settings, Debug server host:
  `localhost:8098`).

**Port 8098 already in use.** Another Metro is running: `lsof -i :8098`, stop it, then `pnpm start`.

**Stale code or odd module errors after switching branches.**

```bash
pnpm start --reset-cache
```

**`.env` changes have no effect.** `react-native-config` bakes `.env` into the native build. Rebuild
(`pnpm ios` / `pnpm android`); reloading JavaScript is not enough.

## CocoaPods and iOS builds

**`pod install` fails or uses the wrong CocoaPods.** Install through the `Gemfile`: `bundle install`,
then `pnpm pods` (which runs `bundle exec pod install`).

**Build errors after `pnpm install` added a native package.** Run `pnpm pods` again, then build.

**Link errors such as undefined `UTType` or `_OBJC_CLASS_$_UTType` symbols, or `kUTType...`.** The
pods are dynamic frameworks (React Native Firebase needs them), and a pod that uses the system type
identifier APIs without declaring the frameworks fails to link. The Podfile's `post_install` hook adds
`-framework MobileCoreServices -framework UniformTypeIdentifiers` to `RNCClipboard` and
`react-native-image-picker`. If another pod fails the same way, add its target name to that list,
then `pnpm pods`.

**Everything else on iOS.** Clean and rebuild:

```bash
rm -rf ios/build ~/Library/Developer/Xcode/DerivedData/OpenChat-*
pnpm pods && pnpm ios
```

## Gradle and Android builds

**The Gradle wrapper download times out.** The wrapper's `networkTimeout` is already raised to
60 seconds in `android/gradle/wrapper/gradle-wrapper.properties`. On a very slow connection, download
once with `cd android && ./gradlew --version`, or raise it further locally.

**Gradle uses the wrong Java.** The project needs JDK 17: set `JAVA_HOME`, then
`cd android && ./gradlew --stop && ./gradlew clean`.

## Connecting to the server

**The welcome screen says the server cannot be reached.** Check the server first:
`curl -s localhost:5036/api/ready` on the Mac.

- **Android emulator or USB device:** its `localhost` is not your Mac's. Run `pnpm android:reverse`
  (again after every emulator restart); `adb reverse --list` should show 5036 3540 4607 5129 8056
  8098.
- **A phone on Wi-Fi:** use the Mac's LAN address in `.env` or the server picker, and make sure the
  server listens on that interface.
- **`adb: no devices/emulators found`:** start the emulator first, or authorise USB debugging.

**"That address is not an Open AI Chat server."** The address answered, but `GET <address>/api/meta`
did not return the server's meta. Check the path: the picker adds `/api` itself, so enter
`https://chat.example.com`, not a page of the web app.

**A LAN `http://` address works in debug but not in a release build (Android).** Release builds allow
HTTPS only. Serve the server over HTTPS.

**Chat works but uploads or images fail on a phone.** The signed URLs point at the server's storage
endpoint. Locally that is `localhost:4607`: forward it with `pnpm android:reverse`, or configure the
server's public S3 endpoint on an address the phone can reach.

## Signing in

**Still signed in after reinstalling on iOS.** The Keychain survives an uninstall, so a reinstalled
app finds the stored session and uses it if it belongs to the default server (MMKV, with a chosen
server, does not survive). To start clean, sign out in the app before uninstalling, or on the
simulator use **Device, Erase All Content and Settings**. The Maestro flows clear the Keychain in
`common/fresh-start.yaml`.

**Signed out after changing the server.** By design: a session belongs to the server that issued it.

**Signed out unexpectedly.** The server rejected the refresh token: it expired, was revoked (sign
out everywhere, a password change, an admin action) or was replayed. Sign in again.

## Streaming

**"The connection was lost. Open the chat again to see the answer."** The client gave up after 8
reconnect attempts. Open the chat again: if the answer is still being written, the app rejoins it;
if it finished, the full answer loads.

**An answer stops when the app goes to the background.** Expected: the app stops following and the
server keeps writing. Coming back continues it.

## Push is off

Push needs three things: `features.push` from the server, the Firebase file in this build, and
permission. See the troubleshooting table in [push.md](push.md#troubleshooting).

## Maestro

The flows have not been run in this repository yet. If one fails on a missing id, check the
`testID` in the screen first ([e2e/README.md](../../e2e/README.md)).
