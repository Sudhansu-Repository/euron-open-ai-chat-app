import type { AppMeta } from "../api/vendor/types";
import { featuresOf, versionBelow } from "./meta";

describe("meta", () => {
  it("treats every feature as off until the server says otherwise", () => {
    expect(featuresOf(undefined)).toEqual({ webSearch: false, imageGeneration: false, dictation: false, readAloud: false, memory: false, projects: false, sharing: false, push: false });
    expect(featuresOf({ features: { webSearch: true } } as unknown as AppMeta).webSearch).toBe(true);
  });

  it("compares dotted versions numerically", () => {
    expect(versionBelow("1.9.2", "1.10.0")).toBe(true);
    expect(versionBelow("1.10.0", "1.9.2")).toBe(false);
    expect(versionBelow("2.0", "2.0.0")).toBe(false);
    expect(versionBelow("1.0.0", null)).toBe(false);
  });
});
