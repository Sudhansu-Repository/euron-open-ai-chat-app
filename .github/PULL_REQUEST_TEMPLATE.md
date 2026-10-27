## What and why

<!-- One paragraph: the problem, and how this change solves it. Link the issue. -->

## How it was verified

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm sanitize` and `pnpm sync-types:check`
- [ ] Ran on iOS (simulator or device, OS version: )
- [ ] Ran on Android (emulator or device, OS version: )
- [ ] Maestro flows (`pnpm e2e:ios` / `pnpm e2e:android`) if a user flow changed
- [ ] Server version tested against (euron-open-ai-chat commit): 

## Checklist

- [ ] Docs updated (`docs/`) for any behaviour or configuration change
- [ ] Vendored contract changed only through `pnpm sync-types`
- [ ] New controls for server features check `useFeatures()`
- [ ] Secrets only in the Keychain/Keystore; nothing sensitive logged, cached or passed to a WebView
- [ ] Anything new kept on the device is cleared when the session ends
- [ ] New native dependency: `pnpm pods` and both native builds checked
- [ ] Light and dark mode, `testID`s on new key elements, no em dashes
- [ ] Security-relevant change? Described the threat and mitigation above
