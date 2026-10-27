import type { DehydratedState } from "@tanstack/react-query";
import { MAX_CACHED_CHATS, serializeCache, trimForDisk } from "./query";

const q = (key: unknown[], updatedAt: number, status = "success", data: unknown = {}) => ({ queryKey: key, queryHash: JSON.stringify(key), state: { status, dataUpdatedAt: updatedAt, data } }) as unknown as DehydratedState["queries"][number];

describe("offline cache", () => {
  it("keeps only readable roots, successful queries and the newest conversations", () => {
    const chats = Array.from({ length: MAX_CACHED_CHATS + 5 }, (_, i) => q(["chat", `c${i}`], i));
    const state = { mutations: [], queries: [...chats, q(["chats", {}], 1), q(["usage"], 1), q(["sessions"], 1), q(["projects"], 1, "error")] } as DehydratedState;
    const kept = trimForDisk(state).queries.map((x) => x.queryKey);
    expect(kept.filter((k) => k[0] === "chat")).toHaveLength(MAX_CACHED_CHATS);
    expect(kept).toContainEqual(["chat", `c${MAX_CACHED_CHATS + 4}`]);
    expect(kept).not.toContainEqual(["chat", "c0"]);
    expect(kept).toContainEqual(["chats", {}]);
    expect(kept).not.toContainEqual(["usage"]);
    expect(kept).not.toContainEqual(["projects"]);
  });

  it("drops the oldest conversations until it fits", () => {
    const big = "x".repeat(600_000);
    const state = { mutations: [], queries: [q(["chat", "old"], 1, "success", big), q(["chat", "mid"], 2, "success", big), q(["chat", "new"], 3, "success", big), q(["chat", "newest"], 4, "success", big)] } as DehydratedState;
    const out = JSON.parse(serializeCache({ clientState: state, timestamp: 0, buster: "v1" }));
    expect(out.clientState.queries.map((x: { queryKey: string[] }) => x.queryKey[1])).toEqual(["mid", "new", "newest"]);
  });
});
