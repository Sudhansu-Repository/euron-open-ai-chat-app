# Markdown rendering

Answers arrive as markdown and are drawn as native views, not in a WebView. The code is in
[`src/features/chat/markdown/`](../../src/features/chat/markdown/); the decision is
[ADR 0008](adr/0008-markdown-renderer.md).

## 1. Pipeline

```
answer text
  -> liftDisplayMath()   $$...$$ and \[...\] become ```math fences (code fences untouched)
  -> closeOpenFence()    a fence left open by a stream still writing is closed
  -> marked.lexer()      GitHub-flavoured: tables, task lists, strikethrough
  -> blocks              each top-level token keeps its raw text
  -> <Markdown>          one memoised view per block, keyed on its raw text
```

[`parse.ts`](../../src/features/chat/markdown/parse.ts) does the first four steps. If `marked`
throws, the whole answer is shown as one paragraph of plain text.

While an answer streams it is lexed again on every delta. That is a few kilobytes and quick on a
phone, and because blocks are memoised on their raw text, only the block being written re-renders.

## 2. Blocks

[`Markdown.tsx`](../../src/features/chat/markdown/Markdown.tsx):

| Block | Rendered as |
| --- | --- |
| Heading | The display face (Bricolage Grotesque) |
| Paragraph | The answer text size |
| List | Nested, numbered or bulleted (alternating markers by depth); task items as checked or empty boxes |
| Blockquote | A rule on the leading edge |
| Table | A horizontal scroll view, so wide tables scroll instead of squeezing |
| Code fence | [`CodeBlock`](../../src/features/chat/markdown/CodeBlock.tsx) |
| ```` ```math ```` fence | [`MathBlock`](../../src/features/chat/markdown/MathBlock.tsx) |
| Horizontal rule | A hairline |
| Raw HTML | The raw text, never interpreted |

Inline: bold, italic, strikethrough, inline code in the monospace face, links, line breaks. A
markdown image is shown as a link, never loaded.

## 3. Code

`CodeBlock` shows the language and a **Copy** button on a hairline above the code, then the code in
the monospace face, scrolling sideways instead of wrapping (wrapped code is hard to read and wrong
to copy). The text is selectable.

[`highlight.ts`](../../src/features/chat/markdown/highlight.ts) uses highlight.js core with a fixed
set of languages, to keep the bundle small: bash, c, cpp, csharp, css, diff, go, java, javascript,
json, kotlin, markdown, php, python, ruby, rust, sql, swift, typescript, xml, yaml (and their
aliases). The HTML highlight.js produces is flattened into tokens (the innermost scope wins,
entities decoded) and drawn as nested `Text` spans, each scope with a colour for light and dark.
Unknown languages come back as one plain token.

## 4. Math

- **Display math** (`$$...$$`, `\[...\]`) is rendered by KaTeX on the phone to **MathML** (no
  network, no fonts to bundle) and shown in a small WebView: WebKit on iOS and Chrome on Android
  draw MathML natively. The page has a `default-src 'none'; style-src 'unsafe-inline'` content
  security policy, the WebView only allows `about:blank`, refuses navigation and new windows, has
  file access off, and runs one injected line that reports the content height so the block sizes
  to the formula (capped at 600 points). TeX that does not parse is shown as a code block.
- **Inline math** (`$...$`, `\(...\)`) stays in the text and is shown in the code face. The pattern
  avoids lookbehind (not every JavaScript engine on phones has it) and leaves prices such as
  "$5 and $10" as text.

## 5. Citations

Web search answers cite sources as `[1]`, `[2]`. `splitInline()` turns `[n]` into a tappable
citation only when a source with that number exists on the message (`citable(n)`); other bracketed
numbers stay plain text. A tap opens that source ([`SourcesSheet.tsx`](../../src/features/chat/SourcesSheet.tsx)
lists all of them).

## 6. Links

`openLink()` opens http and https links in the in-app browser (`react-native-inappbrowser-reborn`:
SFSafariViewController on iOS, a Custom Tab on Android), falling back to the system browser.
`mailto:` goes to the system. Anything else (`javascript:`, `file:`, custom schemes) is ignored.

## 7. Tests

[`parse.test.ts`](../../src/features/chat/markdown/parse.test.ts) (display math lifting, open fences,
GitHub-flavoured blocks, citations and inline math with prices),
[`highlight.test.ts`](../../src/features/chat/markdown/highlight.test.ts) (flattening, languages,
colours in both themes) and [`Markdown.test.tsx`](../../src/features/chat/markdown/Markdown.test.tsx)
(headings, lists, code with copy, tables; citations only for existing sources; math in a sandboxed
view and bad TeX as code).
