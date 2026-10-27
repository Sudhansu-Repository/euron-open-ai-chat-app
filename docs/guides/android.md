# Android

Building and running on an emulator and on a device. Release builds are in
[release.md](release.md).

## Requirements

- Android Studio with the Android SDK: platform 37 (compile) and 36 (target), build tools 37,
  NDK 27.1, an emulator image (a Google APIs image if you want to try push).
- JDK 17 (`JAVA_HOME` pointing at it).
- Node 22.11+ and pnpm 9, then `pnpm install`.

Minimum SDK is 24 (Android 7.0). The application id is `com.example.openchat` until you rename it.
The Gradle wrapper's network timeout is raised to 60 seconds (`networkTimeout=60000` in
`android/gradle/wrapper/gradle-wrapper.properties`; the default is 10 seconds), so the first
download of the Gradle distribution does not time out on a slow connection.

## Run on an emulator

```bash
pnpm start             # Metro on 8098
pnpm android:reverse   # forward the local stack's ports into the emulator
pnpm android           # react-native run-android --port 8098: build, install, launch
```

The emulator has its own `localhost`. [`scripts/android-reverse.sh`](../../scripts/android-reverse.sh)
runs `adb reverse` for every connected device on ports 5036 (API), 3540 (web app), 4607 (S3
emulator), 5129 (stubs), 8056 (Mailpit) and 8098 (Metro), so the default `.env`
(`http://localhost:5036/api`) works unchanged. Forwarding is lost when the emulator restarts: run
`pnpm android:reverse` again.

## Run on a device

**USB:** enable USB debugging, connect, check `adb devices`, then `pnpm android:reverse` and
`pnpm android`, exactly as with an emulator.

**Wi-Fi without `adb reverse`:** put your machine's LAN address in `.env` and rebuild, or enter it on
the welcome screen:

```bash
API_BASE_URL=http://192.168.1.20:5036/api
```

The signed URLs the server returns for uploads and images also have to be reachable from the phone;
with a LAN setup that means configuring the server's public S3 endpoint on the same address, or
using `adb reverse` over USB instead.

## Cleartext HTTP in debug builds

A local stack speaks plain HTTP. Debug builds allow it:

- [`android/app/src/debug/res/xml/network_security_config.xml`](../../android/app/src/debug/res/xml/network_security_config.xml)
  permits cleartext everywhere, overriding the main config for the debug build type only;
- the React Native Gradle plugin sets `usesCleartextTraffic` to true for debug.

Release builds use [`src/main/res/xml/network_security_config.xml`](../../android/app/src/main/res/xml/network_security_config.xml):
HTTPS everywhere (plus `127.0.0.1`). A release build pointed at an `http://` server fails every
request, even on a LAN address the server picker accepts: use HTTPS.

## What is Android specific

- **Permissions**: microphone (`RECORD_AUDIO`) asked when dictation starts; camera asked by the image
  picker; notifications (`POST_NOTIFICATIONS`, Android 13+) asked only from the push offer or
  Settings; storage write only on Android 9 and older, to save images.
- **Push** needs `google-services.json` in `android/app/` at build time; the Google services plugin
  is applied only when that file exists ([push guide](push.md)).
- **Backups** are off (`android:allowBackup="false"`).
- **Back** closes sheets and pushed screens; the drawer opens from the left edge.

## Clean build

```bash
cd android && ./gradlew clean && cd ..
pnpm android
```
