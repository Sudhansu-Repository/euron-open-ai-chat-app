# Quickstart

From nothing to the app running on a simulator or emulator against a local euron-open-ai-chat
server. About 15 minutes the first time (most of it Docker, CocoaPods and Gradle downloads).

## 1. Run euron-open-ai-chat

The app is a client only; run the server first, in a sibling folder:

```bash
git clone https://github.com/euron-sde-team/euron-open-ai-chat.git
cd euron-open-ai-chat
make up      # the stack on emulated AWS, provisioned by the same Terraform as production
make demo    # an admin, four members, models, sample chats, a project, images, memories
```

`make demo` ends with the logins and one shared password:

```
  admin    admin@example.com
  members  priya.nair@example.com, leo.marquez@example.com,
           sam.kowalski@example.com, amara.okafor@example.com

  Every demo account signs in with the password: <printed here>
```

The password is also `CHAT_DEMO_PASSWORD` in the server's `deploy/compose/.env`. Check the API:

```bash
curl -s http://localhost:5036/api/ready
curl -s http://localhost:5036/api/meta | jq .features
```

Locally the server uses deterministic stand-in models, so no key is needed. The server's own
[quickstart](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/guides/quickstart-local.md)
explains each step.

| Port | What | Used by the app |
| --- | --- | --- |
| 5036 | The API | Everything |
| 3540 | The web app | Share links point here |
| 4607 | The S3 emulator | Uploads and image downloads (signed URLs) |
| 5129 | The stubs (models, images, speech, search, FCM) | Indirectly, through the API |
| 8056 | Mailpit | Verification and reset mail |
| 8098 | Metro (this repository) | Debug builds |

## 2. Prerequisites for the app

- Node.js 22.11+ and pnpm 9 (`corepack enable` picks the pinned pnpm).
- iOS: macOS with Xcode 26 or newer, an iOS simulator runtime, Ruby with Bundler.
- Android: Android Studio with SDK platform 37 and 36, build tools 37, NDK 27.1, an emulator
  image, JDK 17.

No Apple or Google developer account and no Firebase project are needed for a debug build.

## 3. Run the app

```bash
git clone https://github.com/euron-sde-team/euron-open-ai-chat-app.git
cd euron-open-ai-chat-app
cp .env.example .env          # API_BASE_URL=http://localhost:5036/api
pnpm install

# iOS
bundle install                # once: CocoaPods from the Gemfile
pnpm pods
pnpm start                    # Metro on port 8098, in its own terminal
pnpm ios

# Android
pnpm start                    # if not already running
pnpm android:reverse          # forwards 5036 3540 4607 5129 8056 8098 into the emulator
pnpm android
```

`pnpm ios` and `pnpm android` pass `--port 8098`, so the debug build looks for Metro there. If
you launch a build another way and see a red screen about the bundle, see
[troubleshooting](troubleshooting.md#metro).

## 4. Try it

1. The welcome screen shows the server's name and `localhost:5036`. Tap **Sign in**.
2. Sign in as `priya.nair@example.com` with the demo password. The chat opens.
3. Open the sidebar: her chats, a project and images from the seed.
4. Start a new chat and try the stand-in model's trigger words:

   | Ask for | You get |
   | --- | --- |
   | "Show me some code" | A fenced TypeScript block with highlighting and Copy |
   | "Search the latest news about tides" (web search on) | A search step, citations and a sources sheet |
   | "Draw a lighthouse at dusk" (image mode) | A generated image |
   | "Please remember that I prefer metric units" | A memory, visible in Settings, Memory |
   | "Give me a formula" | Display math |
   | "Write a slow answer" | A long answer: tap stop, or send the app to the background and come back |

5. Regenerate an answer and switch between versions with `< 1 / 2 >`.
6. Settings has personalization, memory, shared links, devices, your data and sign-out.

## Next

- Run on a phone: [ios.md](ios.md), [android.md](android.md).
- Point at another server, or lock the build to one: [configuration.md](configuration.md).
- Push notifications: [push.md](push.md).
- A tour of every screen: [walkthrough.md](walkthrough.md).
