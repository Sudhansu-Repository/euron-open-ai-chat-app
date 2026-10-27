import type { ChatModel, ModelCatalog } from "../../api/vendor/types";
import { modelFacts, resolveModel } from "./ModelPicker";

const m = (id: string, over: Partial<ChatModel> = {}): ChatModel => ({ id, displayName: id, description: "", provider: "p", supportsVision: false, supportsTools: false, supportsReasoning: false, contextWindow: 0, weight: 1, isDefault: false, ...over });

describe("model picker", () => {
  it("describes a model as one line of facts", () => {
    expect(modelFacts(m("a", { supportsVision: true, supportsTools: true, contextWindow: 128_000 }))).toBe("vision · tools · 128k context");
    expect(modelFacts(m("b", { supportsReasoning: true, contextWindow: 2_000_000, weight: 4 }))).toBe("reasoning · 2M context · counts 4x");
    expect(modelFacts(m("c"))).toBe("");
  });

  it("uses this device's pick, then the account default, then the server default", () => {
    const catalog: ModelCatalog = { chat: [m("a"), m("b", { isDefault: true }), m("c")], imageModel: null };
    expect(resolveModel(catalog, "c", "a")?.id).toBe("c");
    expect(resolveModel(catalog, "gone", "a")?.id).toBe("a");
    expect(resolveModel(catalog, undefined, null)?.id).toBe("b");
    expect(resolveModel({ chat: [], imageModel: null }, "a", "a")).toBeNull();
  });
});
