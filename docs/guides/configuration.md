# Configuration

What is set when the app is built, what comes from the server at run time, and what each device
remembers.

## Build time: `.env`

[`react-native-config`](https://github.com/lugg/react-native-config) reads `.env` when the native
build runs, so a change needs a rebuild (`pnpm ios` / `pnpm android`), not just a JavaScript
reload. Copy [`.env.example`](../../.env.example) to `.env`; `.env` is git-ignored. The values are
read in [`src/config.ts`](../../src/config.ts).

| Key | Default | What |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:5036/api` | The default euron-open-ai-chat API, including `/api`. Trailing slashes are dropped. **Required for a release build**: a release build without it throws at start with "API_BASE_URL is not set" |
| `APP_SCHEME` | `openchat` | The deep link scheme the app builds links with. Must match `ios/OpenChat/Info.plist` and `android/app/src/main/AndroidManifest.xml`; [`scripts/rename-app.sh`](../../scripts/rename-app.sh) changes all three |
| `ALLOW_CUSTOM_SERVER` | `true` | `false` locks the build to `API_BASE_URL`: the server picker disappears and any saved server is ignored |

Local addresses per target:

| Target | `API_BASE_URL` |
| --- | --- |
| iOS simulator | `http://localhost:5036/api` (shares the Mac's network) |
| Android emulator or USB device | `http://localhost:5036/api` after `pnpm android:reverse` |
| A phone on Wi-Fi | `http://<your Mac's LAN address>:5036/api` (debug builds; Android release builds need HTTPS) |
| Production | `https://chat.example.com/api` |

## Run time: what the app reads from `/api/meta`

Everything that depends on the server comes from `GET /api/meta`, cached in MMKV so the app opens
with the last known values ([`meta.tsx`](../../src/app/meta.tsx)):

| Field | Effect in the app |
| --- | --- |
| `appName`, `tagline` | The welcome screen, About, the update gate, recovery codes text |
| `registration` | `OPEN` shows Create an account; `INVITE_ONLY` and `CLOSED` hide it |
| `features.webSearch` | The web search tool in the composer, and its default in Personalization |
| `features.imageGeneration` | Image mode in the composer, Images in the sidebar and Settings |
| `features.dictation` | The microphone in the composer |
| `features.readAloud` | Read aloud under answers, and the voice in Personalization |
| `features.memory` | Memory in Settings and the memory switch in Personalization |
| `features.projects` | Projects in the sidebar and "Move to a project" in the chat menu |
| `features.sharing` | Share in the chat menu, Shared links in Settings |
| `features.push` | Notifications in Settings, the push offer, arming pushes |
| `limits` | The composer uses `maxFilesPerMessage` and `maxMessageChars`; file size and type limits are enforced by the server when the upload is created |
| `minSupportedVersion` | Below it, the update gate blocks the app with a store link |

A feature missing from an older server's meta counts as off.

## Server settings that change the app

Set on the server (see its
[configuration guide](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/guides/configuration.md)):

| Server setting | What changes |
| --- | --- |
| Providers and models in Admin | The model picker and the account default |
| Web search provider | `features.webSearch` |
| Image and speech models | `features.imageGeneration`, `dictation`, `readAloud` |
| `PUSH_PROVIDER=fcm` with a service account | `features.push`; see [push.md](push.md) |
| `PUSH_PREVIEW=true` | Notifications show the chat title and the start of the answer |
| Registration mode | Whether the app offers sign-up |
| Quota tiers | What Settings shows as today's usage, and when sending is refused |

## Per-device preferences

Kept in MMKV ([`storage.ts`](../../src/lib/storage.ts)), never secret:

| Key | What |
| --- | --- |
| `theme` | System, light or dark (Settings, Appearance) |
| `server.url` | The server chosen on the welcome screen (absent means the default) |
| `meta.cache` | The last `/api/meta` |
| `query.cache.v1` | The offline cache ([offline cache](../architecture/offline-cache.md)) |
| `push.token`, `push.asked`, `push.offered` | Push registration and whether the prompt and the offer were shown |
| `chat.lastModel` | The model last picked in the composer, for new chats on this device |

Account-wide settings (personalization, the default model, the voice, memory) live on the server.
