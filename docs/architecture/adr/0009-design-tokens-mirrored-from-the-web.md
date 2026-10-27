# ADR 0009: Design tokens mirrored from the web app

## Status

Accepted.

## Context

The same people use the web app and the phone app against the same server. They should feel like one
product: the same brand colour, the same greys, the same type. React Native cannot read the web
app's CSS custom properties.

## Decision

- [`src/ui/theme/tokens.ts`](../../../src/ui/theme/tokens.ts) mirrors the web app's
  `packages/ui/src/styles/tokens.css` in euron-open-ai-chat, value for value, kept as HSL so the two
  files can be compared line by line; light and dark palettes.
- The same fonts: Bricolage Grotesque for display, Hanken Grotesk for text, bundled as one file per
  weight (Android cannot pick weights of one family), under the SIL Open Font License.
- Screens read colours only through `useTheme()`; nothing hardcodes a colour.
- The same visual rules as the web: answers as prose on the page ground, rows as type on hairlines,
  quiet icon actions, no capsules.

## Consequences

Positive:

- A rebrand is a token change in two files.
- Dark mode is consistent across both apps.

Trade-offs:

- Two copies of the palette that a reviewer must keep in step by hand; there is no automatic check.

## Alternatives considered

- **A shared tokens package with generated outputs.** Worth it if a third client appears.
- **A third-party React Native UI kit.** Would not match the web app.
