/**
 * Markdown to blocks, for the renderer. `marked` does the lexing (GitHub-flavoured:
 * tables, task lists, strikethrough). Display math (`$$...$$`, `\[...\]`) is lifted out
 * first into fenced "math" blocks, since marked does not know it; inline math (`$...$`,
 * `\(...\)`) stays in the text and the renderer shows it in the code face.
 *
 * Streaming: an answer is re-lexed on every delta (a few KB, well under a millisecond on
 * a phone); each top-level block carries its raw text so the renderer can skip blocks
 * that did not change. An unclosed fence at the end is closed so half-written code shows
 * as code, not as a paragraph of backticks.
 */
import { marked, type Token, type Tokens } from "marked";

export type Block = Token;

/** Lifts display math into ```math fences. Exported for tests. */
export function liftDisplayMath(src: string): string {
  // Leave code fences alone: split on them and only rewrite the text between.
  const parts = src.split(/(```[\s\S]*?(?:```|$))/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => `\n\`\`\`math\n${tex.trim()}\n\`\`\`\n`)
        .replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => `\n\`\`\`math\n${tex.trim()}\n\`\`\`\n`);
    })
    .join("");
}

/** Closes a code fence left open by a stream that is still writing. Exported for tests. */
export function closeOpenFence(src: string): string {
  const fences = src.match(/^ {0,3}```/gm)?.length ?? 0;
  return fences % 2 === 1 ? `${src}\n\`\`\`` : src;
}

export function parseMarkdown(src: string): Block[] {
  if (!src) return [];
  try {
    return marked.lexer(closeOpenFence(liftDisplayMath(src)), { gfm: true, breaks: false }).filter((t) => t.type !== "space");
  } catch {
    return [
      {
        type: "paragraph",
        raw: src,
        text: src,
        tokens: [{ type: "text", raw: src, text: src } as Tokens.Text],
      } as Tokens.Paragraph,
    ];
  }
}

/** A piece of inline text split around citation marks "[n]" for sources that exist. Exported for tests. */
export type TextPiece = { kind: "text"; text: string } | { kind: "cite"; n: number } | { kind: "math"; tex: string };

export function splitInline(text: string, citable: (n: number) => boolean): TextPiece[] {
  const out: TextPiece[] = [];
  // No lookbehind (not every JS engine on phones has it): an inline $ math opener keeps
  // the character before it in group 3 and puts it back as text.
  const re = /\[(\d{1,3})\]|\\\((.+?)\\\)|(^|[^\\$\w])\$([^$\n]+?)\$(?![\w$])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined && !citable(Number(m[1]))) continue;
    const lead = m[3] ?? "";
    const start = m.index + lead.length;
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    if (m[1] !== undefined) out.push({ kind: "cite", n: Number(m[1]) });
    else out.push({ kind: "math", tex: (m[2] ?? m[4] ?? "").trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
