/**
 * Syntax highlighting for code blocks: highlight.js (core plus the common languages, so
 * the bundle stays small) turned into flat tokens the renderer draws as Text spans.
 * Unknown languages come back as one plain token.
 */
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGS = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  swift,
  typescript,
  xml,
  yaml,
};
for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def);
hljs.registerAliases(["sh", "shell", "zsh", "console"], {
  languageName: "bash",
});
hljs.registerAliases(["js", "jsx", "mjs"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["py"], { languageName: "python" });
hljs.registerAliases(["html", "svg"], { languageName: "xml" });
hljs.registerAliases(["yml"], { languageName: "yaml" });
hljs.registerAliases(["cs"], { languageName: "csharp" });
hljs.registerAliases(["kt"], { languageName: "kotlin" });
hljs.registerAliases(["rs"], { languageName: "rust" });

/** `scope` is the highlight.js class without its prefix ("keyword", "string"), null for plain text. */
export interface CodeToken {
  text: string;
  scope: string | null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
};
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (m) => ENTITIES[m] ?? m);

/** Flattens highlight.js HTML (nested spans) into tokens, the innermost scope winning. Exported for tests. */
export function flattenHtml(html: string): CodeToken[] {
  const out: CodeToken[] = [];
  const stack: string[] = [];
  const re = /<span class="hljs-([^"]+)">|<\/span>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) stack.push(m[1].split(/\s+/)[0]!.replace(/_$/, ""));
    else if (m[0] === "</span>") stack.pop();
    else if (m[2]) {
      const text = decode(m[2]);
      const scope = stack.length ? stack[stack.length - 1]! : null;
      const last = out[out.length - 1];
      if (last && last.scope === scope) last.text += text;
      else out.push({ text, scope });
    }
  }
  return out;
}

export function highlight(code: string, lang: string | null | undefined): CodeToken[] {
  const name = (lang ?? "").trim().toLowerCase();
  if (!name || !hljs.getLanguage(name) || code.length > 40_000) return [{ text: code, scope: null }];
  try {
    return flattenHtml(hljs.highlight(code, { language: name, ignoreIllegals: true }).value);
  } catch {
    return [{ text: code, scope: null }];
  }
}

/** Token colours per theme, chosen to pass AA on the code block's ground. */
export function scopeColor(scope: string | null, dark: boolean): string | undefined {
  if (!scope) return undefined;
  const light = {
    keyword: "#7C3AED",
    built_in: "#0F766E",
    type: "#0F766E",
    literal: "#B45309",
    number: "#B45309",
    string: "#15803D",
    regexp: "#BE123C",
    comment: "#64748B",
    meta: "#64748B",
    title: "#1D4ED8",
    function: "#1D4ED8",
    attr: "#9A3412",
    attribute: "#9A3412",
    variable: "#9A3412",
    params: "#334155",
    tag: "#BE123C",
    name: "#BE123C",
    symbol: "#B45309",
    addition: "#15803D",
    deletion: "#BE123C",
    section: "#1D4ED8",
    bullet: "#B45309",
  };
  const night = {
    keyword: "#C4B5FD",
    built_in: "#5EEAD4",
    type: "#5EEAD4",
    literal: "#FCD34D",
    number: "#FCD34D",
    string: "#86EFAC",
    regexp: "#FDA4AF",
    comment: "#94A3B8",
    meta: "#94A3B8",
    title: "#93C5FD",
    function: "#93C5FD",
    attr: "#FDBA74",
    attribute: "#FDBA74",
    variable: "#FDBA74",
    params: "#CBD5E1",
    tag: "#FDA4AF",
    name: "#FDA4AF",
    symbol: "#FCD34D",
    addition: "#86EFAC",
    deletion: "#FDA4AF",
    section: "#93C5FD",
    bullet: "#FCD34D",
  };
  const table: Record<string, string> = dark ? night : light;
  return table[scope] ?? table[scope.split(".")[0]!];
}
