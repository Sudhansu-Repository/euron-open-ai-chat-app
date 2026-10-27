import { closeOpenFence, liftDisplayMath, parseMarkdown, splitInline } from "./parse";
import { texToText } from "./tex";

describe("markdown parsing", () => {
  it("lifts display math into math fences but leaves code alone", () => {
    expect(liftDisplayMath("a $$x=1$$ b")).toContain("```math\nx=1\n```");
    expect(liftDisplayMath("\\[y\\]")).toContain("```math\ny\n```");
    expect(liftDisplayMath("```\n$$keep$$\n```")).toBe("```\n$$keep$$\n```");
  });

  it("closes a fence a stream left open, so half-written code shows as code", () => {
    expect(closeOpenFence("x\n```ts\nconst")).toBe("x\n```ts\nconst\n```");
    expect(closeOpenFence("```ts\na\n```")).toBe("```ts\na\n```");
    const blocks = parseMarkdown("Here:\n\n```ts\nconst a = 1");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "code"]);
  });

  it("parses GitHub-flavoured blocks and drops blank space tokens", () => {
    const blocks = parseMarkdown("# Title\n\n- a\n- [ ] t\n\n|a|b|\n|-|-|\n|1|2|\n\n> quote\n\n---");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "table", "blockquote", "hr"]);
    expect(parseMarkdown("")).toEqual([]);
  });

  it("splits citations for sources that exist, and inline math, keeping prices as text", () => {
    expect(splitInline("See [1] and [9], cost $5 and $x^2$ or \\(y\\).", (n) => n === 1)).toEqual([
      { kind: "text", text: "See " },
      { kind: "cite", n: 1 },
      { kind: "text", text: " and [9], cost $5 and " },
      { kind: "math", tex: "x^2" },
      { kind: "text", text: " or " },
      { kind: "math", tex: "y" },
      { kind: "text", text: "." },
    ]);
    expect(splitInline("plain", () => true)).toEqual([{ kind: "text", text: "plain" }]);
  });
});

describe("inline TeX as text", () => {
  it("writes fractions, roots, scripts and symbols readably", () => {
    expect(texToText("x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}")).toBe("x = (−b ± √(b² − 4ac))/(2a)");
    expect(texToText("E = mc^2")).toBe("E = mc²");
    expect(texToText("a_{n+1} = \\alpha a_2")).toBe("a_(n+1) = α a₂");
    expect(texToText("\\unknown{x}")).toBe("\\unknownx");
  });
});
