import { flattenHtml, highlight, scopeColor } from "./highlight";

describe("code highlighting", () => {
  it("flattens nested highlight.js spans, innermost scope wins, entities decoded", () => {
    expect(flattenHtml('<span class="hljs-keyword">const</span> a = <span class="hljs-string">&quot;x &amp; y&quot;</span>')).toEqual([
      { text: "const", scope: "keyword" },
      { text: " a = ", scope: null },
      { text: '"x & y"', scope: "string" },
    ]);
    expect(flattenHtml('<span class="hljs-function"><span class="hljs-title">f</span>()</span>')).toEqual([
      { text: "f", scope: "title" },
      { text: "()", scope: "function" },
    ]);
  });

  it("highlights known languages and aliases; unknown ones stay plain", () => {
    const ts = highlight("const n: number = 1", "ts");
    expect(ts.find((t) => t.text === "const")?.scope).toBe("keyword");
    expect(ts.map((t) => t.text).join("")).toBe("const n: number = 1");
    expect(highlight("x", "brainfudge")).toEqual([{ text: "x", scope: null }]);
    expect(highlight("x", null)).toEqual([{ text: "x", scope: null }]);
  });

  it("has a colour per scope in both themes", () => {
    expect(scopeColor("keyword", false)).toMatch(/^#/);
    expect(scopeColor("keyword", true)).not.toBe(scopeColor("keyword", false));
    expect(scopeColor(null, false)).toBeUndefined();
  });
});
