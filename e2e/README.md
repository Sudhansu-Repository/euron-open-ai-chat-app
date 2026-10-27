# End-to-end flows

[Maestro](https://maestro.mobile.dev) flows that drive the debug app on a simulator or emulator
against a real, local euron-open-ai-chat server. They tap through the app the way a person does,
using the `testID`s on the screens (named `<area>-<thing>`), so a renamed id breaks a flow, not a
user.

> [!WARNING]
> **These flows have not been executed in this repository yet.** They were written against the
> screens' `testID`s and the server's stand-in model, but nobody has run them end to end. Expect to
> fix selectors and timings on the first run, and please send those fixes back.

The flows cannot run without a server: every one of them talks to the API, and the answers come from
the deterministic stand-in model that `make up` starts in euron-open-ai-chat. It picks its behaviour
from words in the question (`code`, `search`, `latest`, `news`, `remember`, `slow`, and so on; the
server's `apps/stubs/README.md` lists them).

## What they cover

| Flow | Journey | Platform | Account |
| --- | --- | --- | --- |
| [`01-welcome-and-server`](flows/01-welcome-and-server.yaml) | The welcome screen shows the server in use; entering `http://chat.example.com` is refused with an error (plain HTTP to a public host); the default server stays | both | none |
| [`02-sign-in`](flows/02-sign-in.yaml) | A wrong password shows an error; the right one opens the chat; the session survives a restart | both | `priya.nair@example.com` |
| [`03-chat-stream-regenerate`](flows/03-chat-stream-regenerate.yaml) | Ask for code, see the code block stream in, regenerate, see `2 / 2`, go back to `1 / 2` | both | `leo.marquez@example.com` |
| [`04-stop`](flows/04-stop.yaml) | A slow answer is stopped after its second sentence and ends with "Stopped." | both | leo |
| [`05-web-search-sources`](flows/05-web-search-sources.yaml) | Web search on, a news question, the search step and sources, the sources sheet | both | leo |
| [`06-image`](flows/06-image.yaml) | Image mode draws a picture in the chat; it opens in the viewer; it shows in Images | both | leo |
| [`07-project-files`](flows/07-project-files.yaml) | Create a project "Field notes", save instructions, start a chat in it ("New chat in Field notes") | both | priya |
| [`08-share-and-memory`](flows/08-share-and-memory.yaml) | "Please remember ..." saves a memory that shows in Settings, Memory; the chat menu offers Share | both | `amara.okafor@example.com` |
| [`09-offline-reading`](flows/09-offline-reading.yaml) | Ask, then airplane mode and a restart: the answer is still readable and the composer says it is offline | **Android only** (no platform guard: exclude it on iOS) | leo |
| [`10-settings-sign-out`](flows/10-settings-sign-out.yaml) | Settings from the sidebar, Personalization, sign out back to the welcome screen | both | `sam.kowalski@example.com` |

Shared steps live in [`flows/common/`](flows/common): `fresh-start.yaml` (clear the app's data and
the Keychain, where the refresh token survives a reinstall on iOS), `sign-in.yaml` (the account comes
from the caller, the password from the command line) and `ask.yaml` (type a question and send).
Maestro runs only the top-level files of `e2e/flows`, so these never run on their own.
[`flows/config.yaml`](flows/config.yaml) fixes the order and continues after a failure.

## Prerequisites

1. **The server.** In a euron-open-ai-chat checkout:

   ```bash
   make up
   make demo        # prints the demo logins and the shared password
   ```

   `make demo` ends with `Every demo account signs in with the password: <value>`. It is also
   `CHAT_DEMO_PASSWORD` in the server's `deploy/compose/.env`.
2. **The Maestro CLI**: `curl -fsSL "https://get.maestro.mobile.dev" | bash` (see the Maestro docs).
   It needs Java 17 or newer.
3. **The app**, a debug build from this repository with the default `.env` (copied from
   `.env.example`), installed on a booted iOS Simulator or Android emulator, with Metro running
   (`pnpm start`, port 8098). The flows use the placeholder app id `com.example.openchat`; after
   `scripts/rename-app.sh` change `appId` in every flow.
4. **Android only:** `pnpm android:reverse`, so the emulator's localhost reaches the server, the
   storage emulator, the stubs and Metro. Run it again after the emulator restarts.

## Running

```bash
pnpm e2e:android -e DEMO_PASSWORD=<password from make demo>
pnpm e2e:ios     -e DEMO_PASSWORD=<password from make demo> --exclude-tags=android

# One flow
maestro test --platform android -e DEMO_PASSWORD=<password> e2e/flows/03-chat-stream-regenerate.yaml

# By tag
maestro test --platform ios -e DEMO_PASSWORD=<password> --include-tags=chat e2e/flows
```

`pnpm e2e:ios` and `pnpm e2e:android` are `maestro test --platform <os> e2e/flows`; extra arguments
are passed through.

## What the flows assume

- **A freshly seeded server with stubs.** The answers they wait for ("It adds two numbers.",
  "Sentence 2 of a slow answer.", "Done. I will remember that.") come from the stand-in model. Against
  real models those assertions fail by design.
- **Features on.** Web search, image generation, memory, projects and sharing are on in the local
  stack. A flow for a feature the server has off fails on a missing control.
- **State left behind.** Flows add chats, a project and a memory to the demo accounts; they do not
  depend on a clean account beyond what `fresh-start` resets on the device. For a clean server run
  `make down && make up && make demo` in euron-open-ai-chat.
- **No push prompt.** The app never asks at launch, and a debug build without Firebase files has no
  push at all. A slow answer can show the in-chat push offer only in a build with Firebase.
- **Offline on iOS.** iOS simulators have no airplane mode, so `09` is Android only.

## In CI

[`.github/workflows-full/e2e.yml`](../.github/workflows-full/e2e.yml) is set up to run every flow on
an Android emulator against a real server stack (`make up`, `make demo`), nightly and on demand. It
is opt-in (move it into `.github/workflows/` in your fork) and, like the flows, has not been run yet.
See [docs/guides/testing.md](../docs/guides/testing.md) for the rest of the test suite.
