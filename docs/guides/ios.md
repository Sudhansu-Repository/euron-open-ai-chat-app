# iOS

Building and running on the simulator and on a device. Release builds are in
[release.md](release.md).

## Requirements

- macOS with Xcode 26 or newer and an iOS simulator runtime.
- Ruby with Bundler. The repository's `Gemfile` pins CocoaPods; `bundle install` installs it.
- Node 22.11+ and pnpm 9, then `pnpm install`.

The deployment target is iOS 15.1. The project is `ios/OpenChat.xcworkspace` (always open the
workspace, not the `.xcodeproj`), scheme `OpenChat`, bundle id `com.example.openchat` until you
rename it.

## Pods

```bash
bundle install     # once
pnpm pods          # cd ios && bundle exec pod install
```

Run `pnpm pods` again after `pnpm install` adds or upgrades a native dependency, and after any change
to `ios/Podfile`. The Podfile builds **dynamic frameworks** (`use_frameworks! :linkage => :dynamic`),
which React Native Firebase needs because it resolves Firebase through Swift Package Manager. With
dynamic frameworks every pod links on its own, and two pods call the system type identifier APIs
without declaring the frameworks that provide them, so the `post_install` hook adds
`-framework MobileCoreServices -framework UniformTypeIdentifiers` to `RNCClipboard` and
`react-native-image-picker`.

## Run on the simulator

```bash
pnpm start         # Metro on 8098
pnpm ios           # react-native run-ios --port 8098: build, install, launch
```

To pick a simulator: `pnpm ios --simulator "iPhone 17"`. The simulator shares the Mac's network, so
the default `.env` (`http://localhost:5036/api`) reaches a local server directly.

If you build and run from Xcode instead, the debug build looks for Metro on the default port 8081.
Tell it about 8098 once per simulator:

```bash
xcrun simctl spawn booted defaults write com.example.openchat RCT_jsLocation "localhost:8098"
```

(`booted` is the running simulator; use a device id from `xcrun simctl list devices` for another
one.)

## Run on a device

1. Open `ios/OpenChat.xcworkspace` in Xcode, select the `OpenChat` target, **Signing &
   Capabilities**, and choose your team. The repository ships with no team set.
2. A phone cannot reach your Mac's `localhost`. Either put your Mac's LAN address in `.env`
   (rebuild after changing it: `react-native-config` reads `.env` at build time):

   ```bash
   API_BASE_URL=http://192.168.1.20:5036/api
   ```

   or keep the default and enter the address on the welcome screen's server picker. Plain HTTP is
   accepted for local addresses only; `NSAllowsLocalNetworking` in `Info.plist` allows it in every
   build.
3. The signed URLs the server returns for uploads and images must be reachable from the phone too.
   Locally they point at `localhost:4607` (the S3 emulator); on a LAN, configure the server's public
   S3 endpoint on the same address, or uploads and images will fail while chat works.
4. Metro must be reachable from the phone (same network); the debug build finds it through the Mac's
   address.

## What is iOS specific

- **Permissions** are asked on first use, with the texts in `Info.plist`: camera (take a photo to
  ask about it), photo library (pick photos), add to photo library (save images you create),
  microphone (dictation). Notifications are asked only from the push offer or Settings
  ([push](../architecture/push.md)).
- **Push** needs `GoogleService-Info.plist` in `ios/OpenChat`, added to the target, and an APNs key
  in your Firebase project ([push guide](push.md)). Without the file, `AppDelegate.swift` skips
  Firebase and the app has no push.
- **Background mode** `remote-notification` is declared for push.
- **Keychain on the simulator** persists across reinstalls; see
  [troubleshooting](troubleshooting.md#signing-in).

## Clean build

```bash
rm -rf ios/build ~/Library/Developer/Xcode/DerivedData/OpenChat-*
pnpm pods
pnpm ios
```
