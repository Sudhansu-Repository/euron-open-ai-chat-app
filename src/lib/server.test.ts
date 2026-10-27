import { normalizeServer, probeServer } from "./server";

describe("server address", () => {
  it("assumes https, adds /api and drops trailing slashes", () => {
    expect(normalizeServer("chat.example.com")).toBe("https://chat.example.com/api");
    expect(normalizeServer("https://chat.example.com/")).toBe("https://chat.example.com/api");
    expect(normalizeServer("https://example.com/team-chat/api/")).toBe("https://example.com/team-chat/api");
    expect(normalizeServer("http://localhost:5036")).toBe("http://localhost:5036/api");
    expect(normalizeServer("http://192.168.1.20:5036/api")).toBe("http://192.168.1.20:5036/api");
  });

  it("refuses plain http for public hosts, credentials, queries and non-hosts", () => {
    expect(normalizeServer("http://chat.example.com")).toBeNull();
    expect(normalizeServer("https://user:pass@chat.example.com")).toBeNull();
    expect(normalizeServer("https://chat.example.com/?x=1")).toBeNull();
    expect(normalizeServer("not a host")).toBeNull();
    expect(normalizeServer("")).toBeNull();
  });

  it("accepts only something that answers like an Open AI Chat meta", async () => {
    const ok = { appName: "Team Chat", features: {}, limits: {} };
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ok })) as unknown as typeof fetch;
    await expect(probeServer("https://chat.example.com/api")).resolves.toMatchObject({ appName: "Team Chat" });
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ hello: "world" }) })) as unknown as typeof fetch;
    await expect(probeServer("https://chat.example.com/api")).rejects.toThrow(/not an Open AI Chat server/);
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    await expect(probeServer("https://chat.example.com/api")).rejects.toThrow(/answered 404/);
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    await expect(probeServer("https://chat.example.com/api")).rejects.toThrow(/could not be reached/);
  });
});
