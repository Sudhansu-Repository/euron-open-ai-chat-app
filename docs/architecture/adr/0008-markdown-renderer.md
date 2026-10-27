# ADR 0008: Markdown drawn as native views; math as MathML in a sandboxed WebView

## Status

Accepted.

## Context

Answers are markdown with code, tables, lists, links, citations and sometimes math, and they are
re-rendered on every streamed delta. A WebView per message is heavy, scrolls badly inside a list and
puts a browser engine on untrusted text. General markdown libraries for React Native either render
HTML or do not handle streaming well (re-rendering everything on each delta).

Math is the hard part: there is no native TeX renderer, and bundling a math font set is large.

## Decision

- **`marked` for lexing only** (GitHub-flavoured), and an own renderer from tokens to `Text` and
  `View` ([`markdown/`](../../../src/features/chat/markdown/)). Raw HTML is shown as text; markdown
  images are links.
- **Streaming-aware**: display math is lifted into fences, an unclosed fence is closed, and every
  top-level block is memoised on its raw text, so only the block being written re-renders.
- **highlight.js core** with a fixed set of common languages, flattened into coloured spans.
- **Display math through KaTeX to MathML**, shown in a small WebView with a strict content security
  policy, no navigation and no file access; WebKit and Chrome draw MathML natively, so no fonts are
  bundled. Bad TeX falls back to a code block. Inline math stays in the code face.
- **Citations** `[n]` become tappable only when that source exists.

## Consequences

Positive:

- Fast, native text (selection, accessibility, dynamic type) and smooth streaming.
- A small surface for injected content: no HTML interpretation.
- Math works offline with no extra assets.

Trade-offs:

- An own renderer to maintain for markdown edge cases.
- Each display formula is its own WebView: heavier than text, and still a browser engine (locked
  down) on model output.
- Inline math is not typeset.

## Alternatives considered

- **One WebView per message** with the web app's renderer. Consistent with the web, but heavy and
  awkward in a native list.
- **react-native-markdown-display or similar.** Less control over streaming and citations.
- **SVG math rendering on the phone.** Needs a TeX engine and fonts in the bundle.
