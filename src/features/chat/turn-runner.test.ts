import { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "../../api/client";
import type { ConversationDetail, TurnEvent } from "../../api/vendor/types";
import { qk } from "../../app/query";
import { applyEvent, bindTurnRunner, emptyAnswer, handOffToBackground, resumeDetached, sendMessage, turnState } from "./turn-runner";

type Follow = (turnId: string, opts: { after?: number; signal?: AbortSignal; transport?: string }) => AsyncGenerator<TurnEvent>;

function fakeApi(follow: Follow, extra: Record<string, unknown> = {}) {
  const api = {
    chats: { send: jest.fn(async () => ({ turnId: "t1", conversationId: "c1", userMessageId: "q1", assistantMessageId: "t1" })) },
    turns: { follow: jest.fn(follow), notify: jest.fn(async () => ({ state: "armed" })), cancel: jest.fn(async () => undefined) },
    messages: { regenerate: jest.fn() },
    ...extra,
  };
  return api as unknown as ApiClient & { turns: { follow: jest.Mock; notify: jest.Mock } };
}

const ev = (seq: number, e: Record<string, unknown>) => ({ seq, ...e }) as TurnEvent;
const detail = (qc: QueryClient) => qc.getQueryData<ConversationDetail>(qk.chat("c1"))!;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("applyEvent", () => {
  it("builds the answer from deltas, tool steps, sources, images, and the final message", () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.chat("c1"), { id: "c1", messages: [emptyAnswer("a1", "c1", "q1", null, true, ["a1"])] } as unknown as ConversationDetail);
    const apply = (e: Record<string, unknown>, seq = 1) => applyEvent(qc, "c1", "a1", ev(seq, e));
    apply({ type: "tool.started", callId: "x", tool: "web_search", label: "Searching the web" });
    apply({ type: "tool.finished", callId: "x", tool: "web_search", label: "Searched the web", ok: true, sources: [{ n: 1, title: "T", url: "https://example.com", domain: "example.com", snippet: "", publishedAt: null }] });
    apply({ type: "message.delta", text: "Hel" });
    apply({ type: "message.delta", text: "lo [1]" });
    let m = detail(qc).messages[0]!;
    expect(m.content).toBe("Hello [1]");
    expect(m.toolSteps).toEqual([{ tool: "web_search", label: "Searched the web", status: "DONE" }]);
    expect(m.sources).toHaveLength(1);
    apply({ type: "message.completed", messageId: "a1", content: "Hello [1].", sources: m.sources, finishReason: "stop" });
    apply({ type: "done", status: "COMPLETE" });
    m = detail(qc).messages[0]!;
    expect(m).toMatchObject({ content: "Hello [1].", status: "COMPLETE" });
  });

  it("an error event marks the answer failed with a readable reason", () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.chat("c1"), { id: "c1", messages: [emptyAnswer("a2", "c1", "q1", null, false, ["a2"])] } as unknown as ConversationDetail);
    applyEvent(qc, "c1", "a2", ev(1, { type: "error", code: "QUOTA_EXCEEDED", message: "You have used today's allowance." }));
    expect(detail(qc).messages[0]).toMatchObject({ status: "FAILED", errorCode: "QUOTA_EXCEEDED" });
    expect(turnState.errorOf("a2")).toBe("You have used today's allowance.");
  });
});

describe("sending and the background hand-off", () => {
  it("sends with a 202, follows over XHR, shows the question at once and streams the answer in", async () => {
    const qc = new QueryClient();
    const api = fakeApi(async function* () {
      yield ev(1, { type: "turn.started", turnId: "t1", conversationId: "c1", userMessageId: "q1", assistantMessageId: "t1", model: { id: "m", displayName: "M" } });
      yield ev(2, { type: "message.delta", text: "Hi" });
      yield ev(3, { type: "done", status: "COMPLETE" });
    });
    const unbind = bindTurnRunner(api, qc);
    const id = await sendMessage({ conversationId: null, content: "Hello" });
    expect(id).toBe("c1");
    expect(detail(qc).messages.map((m) => [m.role, m.content])).toEqual([
      ["USER", "Hello"],
      ["ASSISTANT", expect.any(String)],
    ]);
    await flush();
    await flush();
    expect(api.turns.follow).toHaveBeenCalledWith("t1", expect.objectContaining({ after: 0, transport: "xhr" }));
    expect(turnState.isRunning("t1")).toBe(false);
    unbind();
  });

  it("going to the background stops following and arms a push; coming back resumes after the last seq", async () => {
    const qc = new QueryClient();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const calls: number[] = [];
    const api = fakeApi(async function* (_id, opts) {
      calls.push(opts.after ?? 0);
      if (calls.length === 1) {
        yield ev(1, { type: "message.delta", text: "Part one. " });
        await new Promise<void>((resolve, reject) => {
          opts.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
          gate.then(resolve).catch(() => undefined);
        });
      } else {
        yield ev(2, { type: "message.delta", text: "Part two." });
        yield ev(3, { type: "done", status: "COMPLETE" });
      }
    });
    const unbind = bindTurnRunner(api, qc);
    await sendMessage({ conversationId: null, content: "Long one" });
    await flush();
    expect(turnState.live()).toEqual(["t1"]);

    const armed = await handOffToBackground(true);
    expect(armed).toEqual(["t1"]);
    expect(api.turns.notify).toHaveBeenCalledWith("t1");
    expect(turnState.live()).toEqual([]);
    expect(turnState.isRunning("t1")).toBe(true);

    resumeDetached();
    await flush();
    await flush();
    expect(calls).toEqual([0, 1]);
    expect(detail(qc).messages[1]!.content).toBe("Part one. Part two.");
    release();
    unbind();
  });

  it("without push the hand-off arms nothing", async () => {
    const qc = new QueryClient();
    const api = fakeApi(async function* (_id, opts) {
      await new Promise((_r, reject) => opts.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    });
    const unbind = bindTurnRunner(api, qc);
    await sendMessage({ conversationId: null, content: "x" });
    await flush();
    expect(await handOffToBackground(false)).toEqual([]);
    expect(api.turns.notify).not.toHaveBeenCalled();
    unbind();
  });
});
