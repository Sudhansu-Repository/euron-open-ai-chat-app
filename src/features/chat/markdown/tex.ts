/**
 * Inline math as readable text. Display math goes through KaTeX (MathBlock); inline math
 * sits inside a line of prose, where a WebView cannot, so the common TeX is turned into
 * Unicode: x = (−b ± √(b² − 4ac)) / (2a). Anything it does not know is left as written.
 */
const SYMBOLS: Record<string, string> = {
  pm: "±", mp: "∓", times: "×", cdot: "·", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", equiv: "≡", sim: "∼",
  infty: "∞", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", iff: "⇔", in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", forall: "∀", exists: "∃",
  partial: "∂", nabla: "∇", sum: "∑", prod: "∏", int: "∫", degree: "°", circ: "∘", ldots: "…", cdots: "⋯", dots: "…",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎" };

/** The {group} starting at s[i] (which must be "{"): its content and the index after it. */
function group(s: string, i: number): [string, number] {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

/** An argument: a {group} or a single character, after optional spaces. */
function arg(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "{") return group(s, i);
  return [s[i] ?? "", i + 1];
}

const wrap = (x: string) => (/^(\d+(\.\d+)?|\w)$/.test(x) || /^\(.*\)$/.test(x) ? x : `(${x})`);
const script = (x: string, table: Record<string, string>, mark: string) => ([...x].every((c) => table[c]) ? [...x].map((c) => table[c]).join("") : `${mark}${wrap(x)}`);

export function texToText(tex: string): string {
  let out = "";
  let i = 0;
  while (i < tex.length) {
    const c = tex[i]!;
    if (c === "\\") {
      const name = /^[A-Za-z]+/.exec(tex.slice(i + 1))?.[0] ?? "";
      if (!name) {
        out += tex[i + 1] ?? "";
        i += 2;
        continue;
      }
      i += name.length + 1;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [a, j] = arg(tex, i);
        const [b, k] = arg(tex, j);
        out += `${wrap(texToText(a))}/${wrap(texToText(b))}`;
        i = k;
      } else if (name === "sqrt") {
        const [a, j] = arg(tex, i);
        out += `√${wrap(texToText(a))}`;
        i = j;
      } else if (name === "text" || name === "mathrm" || name === "mathbf" || name === "operatorname") {
        const [a, j] = arg(tex, i);
        out += a;
        i = j;
      } else if (name === "left" || name === "right" || name === "displaystyle" || name === ",") {
        // spacing and sizing only
      } else out += SYMBOLS[name] ?? `\\${name}`;
    } else if (c === "^" || c === "_") {
      const [a, j] = arg(tex, i + 1);
      out += script(texToText(a), c === "^" ? SUP : SUB, c);
      i = j;
    } else if (c === "{" || c === "}") i++;
    else if (c === "-") {
      out += "−";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}
