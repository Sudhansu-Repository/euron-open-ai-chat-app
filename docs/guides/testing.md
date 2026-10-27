# Testing

Every gate runs locally. The fast ones run in CI on every push; native builds, gitleaks and the
end-to-end flows are an opt-in pipeline for forks.

| Gate | Command | Needs | Status |
| --- | --- | --- | --- |
| Lint | `pnpm lint` | Node | Passing, zero warnings |
| Types | `pnpm typecheck` | Node | Passing |
| Unit and component tests | `pnpm test` | Node | Passing: 37 tests in 12 suites |
| API contract | `pnpm sync-types:check` | a euron-open-ai-chat checkout | Passing |
| Sanitisation scan | `pnpm sanitize` | bash, git | Passing |
| iOS debug build | `pnpm ios` | Xcode | Builds and launches on the simulator, shows the welcome screen from a local server |
| Android debug build | `pnpm android` | Android SDK, JDK 17 | Builds, installs and runs on an API 36 emulator |
| End to end | `pnpm e2e:ios` / `pnpm e2e:android` | Maestro, a simulator or emulator, a running server | **Written, never run** |
| By hand on devices | below | emulator, simulator | Done on the Android emulator (list below); iOS checked up to the welcome screen |

## Unit and component tests

```bash
pnpm test                          # everything
pnpm test src/features/chat        # one area
pnpm test --watch
pnpm test --coverage               # the vendored contract is excluded
```

Jest with the React Native preset and React Native Testing Library
([`jest.config.js`](../../jest.config.js)). Tests sit next to the code as `*.test.ts(x)`:

| Suite | What it checks |
| --- | --- |
| [`turn-runner.test.ts`](../../src/features/chat/turn-runner.test.ts) | Answers built from events; errors; send with 202 then XHR; background hand-off arms a push and resumes after the last seq; no push, no arming |
| [`query.test.ts`](../../src/app/query.test.ts) | The offline cache keeps the right roots and the newest chats, and fits 2 MB |
| [`server.test.ts`](../../src/lib/server.test.ts) | Address normalisation, refusals, probing `/api/meta` |
| [`push.test.ts`](../../src/lib/push.test.ts), [`offer.test.ts`](../../src/features/push/offer.test.ts) | Push decisions, which notifications open a chat, the one-time offer |
| [`meta.test.ts`](../../src/app/meta.test.ts) | Features off by default; version comparison |
| [`parse.test.ts`](../../src/features/chat/markdown/parse.test.ts), [`highlight.test.ts`](../../src/features/chat/markdown/highlight.test.ts), [`Markdown.test.tsx`](../../src/features/chat/markdown/Markdown.test.tsx) | Markdown parsing, highlighting, rendering, citations, math |
| [`ModelPicker.test.ts`](../../src/features/chat/ModelPicker.test.ts) | The model line of facts; which model a new chat uses |
| [`queries.test.ts`](../../src/features/chat/queries.test.ts) | Sidebar date groups |
| [`format.test.ts`](../../src/features/settings/lib/format.test.ts) | Two-step secrets and codes, recovery codes text, relative times, device names, colours |

- **Native modules** are mocked once in [`test/setup.ts`](../../test/setup.ts). Do not edit it for
  one test: put a `jest.mock(...)` at the top of your test file instead.
- **Components** render inside the app's providers with a fake session from
  [`test/render.tsx`](../../test/render.tsx); [`test/after-each.ts`](../../test/after-each.ts) lets
  pending queries settle and forgets the clients.

Not covered by unit tests yet: the voice code, the screens other than the markdown renderer, and
`PushBridge`.

## API contract

```bash
pnpm sync-types:check              # compares src/api/vendor with ../euron-open-ai-chat
node scripts/sync-types.mjs --check /path/to/euron-open-ai-chat
pnpm sync-types                    # copy after a server change, then fix the app
```

The check fails with the list of drifted files and "Run: pnpm sync-types". With no server checkout at
the path it prints a notice and passes, so run it with a checkout before you rely on it. CI checks
out the server's main branch next to the app so the check is real.

## Sanitisation

```bash
pnpm sanitize
```

[`scripts/check-sanitization.sh`](../../scripts/check-sanitization.sh) scans every file git would
commit for cloud keys, private keys, tokens, Firebase API keys, Apple team ids, Firebase or signing
files, committed env files, email addresses outside the reserved example domains, public IP
addresses, internal hostnames, the em dash character, and the brand name outside the places it
belongs. It prints each hit with its file and line.

## End-to-end flows (Maestro)

Ten flows in [`e2e/flows`](../../e2e/flows) cover the main journeys. **They have not been run in
this repository yet**; expect to fix selectors the first time. How to run them, what each covers and
what they assume: [e2e/README.md](../../e2e/README.md).

```bash
# euron-open-ai-chat
make up && make demo                  # note the printed password

# this repository, app installed on a booted simulator or emulator, Metro running
pnpm android:reverse                  # Android only
pnpm e2e:android -e DEMO_PASSWORD=<password>
```

## Continuous integration

| Workflow | Runs | Where |
| --- | --- | --- |
| [`checks.yml`](../../.github/workflows/checks.yml) | install, lint, typecheck, tests, the contract check against the server's main branch, the sanitisation scan | Every push and pull request |
| [`workflows-full/android.yml`](../../.github/workflows-full/android.yml) | `assembleDebug`, unsigned `assembleRelease`, Android lint | Opt-in |
| [`workflows-full/ios.yml`](../../.github/workflows-full/ios.yml) | `pod install`, an unsigned simulator build | Opt-in |
| [`workflows-full/security.yml`](../../.github/workflows-full/security.yml) | gitleaks (full history), CodeQL, `pnpm audit` | Opt-in |
| [`workflows-full/e2e.yml`](../../.github/workflows-full/e2e.yml) | A real server stack and every Maestro flow on an Android emulator | Opt-in |

Move the opt-in workflows into `.github/workflows/` in your fork to enable them
([README](../../.github/workflows-full/README.md)).

## By hand on devices

Against a local server (`make up && make demo`), on an Android emulator with
`pnpm android:reverse`:

```bash
adb devices                                   # the emulator is listed as "device"
adb reverse --list                            # 5036 3540 4607 5129 8056 8098 forwarded
adb shell am start -a android.intent.action.VIEW -d "openchat://settings"     # deep link, signed in
adb shell am start -a android.intent.action.VIEW -d "openchat://c/<chat id>"  # a conversation
adb shell cmd connectivity airplane-mode enable    # offline reading in a release build (disable afterwards)
adb logcat | grep -i -E "ReactNativeJS|FATAL"
```

Airplane mode also cuts a debug build off from Metro, so it cannot cold-start. To check offline
reading in a debug build, stop the server instead: the launch gives up after 10 s and opens on
the cached chats.

### What the first run covered

On an Android 16 (API 36) emulator against a local server with stub models:

| Checked and working | Not checked yet |
| --- | --- |
| Welcome from the server's meta; a plain-http public address refused with a reason | Sign-up, forgot password, two-step sign-in |
| Sign in; sign out back to welcome | Edit a question |
| Streaming over XHR, a highlighted code block, copy | Attachments from camera, photos and Files (and vision) |
| Regenerate and the `< 2 / 2 >` switcher | Dictation (needs a microphone) |
| Stop: the partial answer stays, marked "Stopped." | Push (needs a Firebase project) |
| Home mid-answer, back again: the turn is followed from `after=12` and completes | iOS beyond the welcome screen (no tap tool for the simulator here) |
| Web search: the tool line, citations, the sources sheet from a citation | |
| Image mode in a chat; the Images grid; Projects and a project's files | |
| Model picker; Settings; Personalization; dark mode | |
| Read aloud (server speech downloaded, played and released) | |
| Server down at launch: opens offline on the cached chats, composer explains | |

Two launch bugs found in that run are fixed: a hanging connection kept the boot spinner up
forever (now a 10 s limit), and an online device with the server down retried in a loop (now
only a change to connected retries).

A checklist for a release candidate, on one iPhone and one Android phone:

- [ ] Welcome shows the server's name; an invalid address is refused with a reason
- [ ] Sign in, sign up (if the server is open), forgot password, two-step sign-in
- [ ] Ask, stream, stop, regenerate, edit a question, switch versions
- [ ] Web search with citations and the sources sheet; an image; a project with a file; memory
- [ ] Attach from camera, photos and Files
- [ ] Dictation and read aloud
- [ ] Leave mid-answer and come back: the answer completes, nothing duplicated
- [ ] With push set up: leave mid-answer, get the notification, tap it, land in the chat
- [ ] Airplane mode: recent chats open, the composer explains why it cannot send
- [ ] Dark mode on every screen
- [ ] Sign out: back to welcome, sidebar empty after signing in as someone else
