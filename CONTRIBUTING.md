# Contributing

Thanks for helping improve Euron Open AI Chat App. This guide covers the workflow, the bar a change
has to clear, and the conventions the codebase follows.

## Ground rules

- **Open an issue first** for anything larger than a bug fix or a docs tweak.
- **One concern per pull request.** A refactor and a feature are two PRs.
- **Security issues go through private reporting**, never a public issue. See
  [SECURITY.md](SECURITY.md).
- By contributing you agree your work is released under the [MIT License](LICENSE).

## Development setup

Run a local euron-open-ai-chat first (`make up && make demo` there), then:

```bash
cp .env.example .env
pnpm install
bundle install && pnpm pods      # iOS
pnpm start                       # Metro on port 8098
pnpm ios                         # or: pnpm android:reverse && pnpm android
```

Requirements and details: [docs/guides/quickstart.md](docs/guides/quickstart.md).

## Before you open a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm sanitize                    # no credentials, real emails, IPs, em dashes or Firebase/signing files
pnpm sync-types:check            # the vendored API contract matches euron-open-ai-chat
pnpm e2e:ios / pnpm e2e:android  # when you touched a user flow (e2e/README.md)
pnpm pods && a native build      # when you added or upgraded a native dependency
```

## Branches and commits

Branch from `main` (`fix/...`, `feat/...`, `docs/...`). Commit messages use the imperative mood with
an optional scope: `chat: keep the partial answer after stop`,
`push: register again when the token rotates`. Explain the why in the body when it is not obvious.

## Conventions

- **The server decides.** Models, limits, features and access come from the API; the app renders
  them. Never add a client-side rule that the server should enforce.
- **Features follow `/api/meta`.** A control for a server feature checks `useFeatures()` and is
  hidden when the feature is off.
- **Logic in plain TypeScript next to the screen, with a test** (`turn-runner.ts`, `offer.ts`,
  `lib/push.ts`, `lib/server.ts`, `markdown/parse.ts`); screens draw what it returns. Components that
  matter get a render test with the helpers in `test/render.tsx`.
- **Errors by code.** Switch on `ApiError.code`, never on message text.
- **Server state in TanStack Query** with keys from `qk` (`src/app/query.ts`). Turns write into the
  same cache through the turn runner. Secrets only in `src/lib/secure-store.ts`; MMKV
  (`src/lib/storage.ts`) is for non-secret preferences.
- **Theme colours only** through `useTheme()`; answers are prose, not cards; no capsule buttons, no
  box inside a box; `testID` on key elements (`<area>-<thing>`); 44 point touch targets.
- **Comments explain why**: a short header per file and the constraint behind non-obvious code. No
  em dashes, anywhere.

## Changing the API contract

`src/api/vendor/` is copied from euron-open-ai-chat and never edited here.

1. Change the types or the client in euron-open-ai-chat (`packages/types`, `packages/api-client`) and
   land that first.
2. Here, run `pnpm sync-types` (reads `../euron-open-ai-chat` by default, or pass its path).
3. Adapt the app until `pnpm typecheck` and `pnpm test` pass, and commit the vendored files with
   `src/api/vendor/SOURCE`.

See [ADR 0002](docs/architecture/adr/0002-vendored-api-contract-with-a-drift-check.md).

## Architecture decisions

A change to a documented decision (session storage, the server picker, streaming and the background
hand-off, push, the offline cache, the markdown renderer) needs a new ADR in
`docs/architecture/adr/`, linked from the pull request.
