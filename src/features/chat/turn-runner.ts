/**
 * Runs turns from the app and writes what they produce straight into the React Query
 * cache, so the conversation on screen is always `qk.chat(id)`. Ported from the web app
 * (euron-open-ai-chat apps/web/src/lib/chat/turn-runner.ts) with three phone-specific
 * changes:
 *
 *   send        POST answers 202 with the turn id, then the turn is followed over
 *               XMLHttpRequest (`transport: "xhr"`): React Native's fetch cannot stream.
 *   background  when the app leaves the foreground mid-answer, the runner stops following
 *               (the turn goes on on the server) and, if this device can receive push,
 *               asks the server to notify it when the answer is ready (turns.notify).
 *   foreground  every detached turn is followed again from the last sequence number it
 *               saw, so nothing is lost and nothing is applied twice.
 *
 * Runners live outside React so a turn keeps streaming while screens change. Stop asks
 * the server to cancel; the server ends the turn with done CANCELLED and keeps the
 * partial answer.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "../../api/client";
import type { ChatFile, ConversationDetail, ConversationSummary, Message, Page, SendMessageInput, TurnEvent } from "../../api/vendor/types";
import { qk } from "../../app/query";

type Listener = () => void;

interface Running {
  turnId: string;
  conversationId: string;
  answerId: string;
  lastSeq: number;
  controller: AbortController;
  /** Stopped following because the app went to the background; resumed on return. */
  detached: boolean;
  startedAt: number;
}

const running = new Map<string, Running>();
const errors = new Map<string, string>();
const listeners = new Set<Listener>();
let bound: { api: ApiClient; qc: QueryClient } | null = null;
/** Called when an answer that took a while finishes in the foreground (the push offer). */
let onSlowAnswer: ((ms: number) => void) | null = null;

function notify() {
  for (const l of listeners) l();
}

function deps() {
  if (!bound) throw new Error("turn runner used before bindTurnRunner");
  return bound;
}

/** Points the runner at the signed-in client and cache (app/Navigator binds it). */
export function bindTurnRunner(api: ApiClient, qc: QueryClient, opts: { onSlowAnswer?: (ms: number) => void } = {}): () => void {
  bound = { api, qc };
  onSlowAnswer = opts.onSlowAnswer ?? null;
  return () => {
    detachAll();
    if (bound?.api === api) bound = null;
  };
}

export const turnState = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** The turn streaming in a conversation, if any. */
  activeIn(conversationId: string | null | undefined): string | null {
    if (!conversationId) return null;
    for (const r of running.values()) if (r.conversationId === conversationId) return r.turnId;
    return null;
  },
  isRunning(turnId: string): boolean {
    return running.has(turnId);
  },
  /** The readable reason a turn failed (from its error event). */
  errorOf(messageId: string): string | null {
    return errors.get(messageId) ?? null;
  },
  /** Turns still being written (for the background hand-off). */
  live(): string[] {
    return [...running.values()].filter((r) => !r.detached).map((r) => r.turnId);
  },
};

function patchMessage(qc: QueryClient, conversationId: string, messageId: string, fn: (m: Message) => Message) {
  qc.setQueryData<ConversationDetail>(qk.chat(conversationId), (d) =>
    d
      ? {
          ...d,
          messages: d.messages.map((m) => (m.id === messageId ? fn(m) : m)),
        }
      : d
  );
}

function patchSummary(qc: QueryClient, conversationId: string, fn: (c: ConversationSummary) => ConversationSummary) {
  qc.setQueriesData<{
    pages: Page<ConversationSummary>[];
    pageParams: unknown[];
  }>({ queryKey: qk.chatsAll }, (data) => {
    if (!data || !("pages" in data)) return data;
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.map((c) => (c.id === conversationId ? fn(c) : c)),
      })),
    };
  });
  qc.setQueryData<ConversationDetail>(qk.chat(conversationId), (d) => (d ? ({ ...d, ...fn(d) } as ConversationDetail) : d));
}

export function emptyAnswer(
  id: string,
  conversationId: string,
  parentId: string,
  model: { id: string; displayName: string } | null,
  webSearch: boolean,
  siblingIds: string[]
): Message {
  return {
    id,
    conversationId,
    parentId,
    role: "ASSISTANT",
    content: "",
    reasoning: null,
    sources: [],
    toolSteps: [],
    attachments: [],
    outputs: [],
    model,
    status: "STREAMING",
    errorCode: null,
    feedback: null,
    webSearch,
    siblingIds,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/** Apply one event to the cached conversation. Exported for tests. */
export function applyEvent(qc: QueryClient, conversationId: string, answerId: string, ev: TurnEvent): void {
  switch (ev.type) {
    case "turn.started":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        model: ev.model,
      }));
      break;
    case "message.delta":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        content: m.content + ev.text,
      }));
      break;
    case "reasoning.delta":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        reasoning: (m.reasoning ?? "") + ev.text,
      }));
      break;
    case "tool.started":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        toolSteps: [...m.toolSteps, { tool: ev.tool, label: ev.label, status: "RUNNING" }],
      }));
      break;
    case "tool.finished":
      patchMessage(qc, conversationId, answerId, (m) => {
        const steps = [...m.toolSteps];
        const i = steps.map((s) => s.status).lastIndexOf("RUNNING");
        if (i >= 0)
          steps[i] = {
            tool: ev.tool,
            label: ev.label,
            status: ev.ok ? "DONE" : "FAILED",
          };
        const sources = ev.sources?.length ? [...m.sources, ...ev.sources.filter((s) => !m.sources.some((x) => x.n === s.n))] : m.sources;
        const outputs = ev.image ? [...m.outputs, ev.image] : m.outputs;
        return { ...m, toolSteps: steps, sources, outputs };
      });
      break;
    case "message.completed":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        content: ev.content,
        sources: ev.sources,
        status: "COMPLETE",
        completedAt: new Date().toISOString(),
      }));
      break;
    case "title":
      patchSummary(qc, conversationId, (c) => ({ ...c, title: ev.title }));
      break;
    case "error":
      errors.set(answerId, ev.message);
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        status: "FAILED",
        errorCode: ev.code,
      }));
      break;
    case "done":
      patchMessage(qc, conversationId, answerId, (m) => ({
        ...m,
        status: ev.status === "COMPLETE" ? "COMPLETE" : ev.status,
      }));
      break;
    default:
      break;
  }
}

async function finish(qc: QueryClient, conversationId: string) {
  // The turn is over: the cached copy must not keep pointing at it, or a screen that
  // mounts before the refetch lands would rejoin a finished turn.
  qc.setQueryData<ConversationDetail>(qk.chat(conversationId), (d) => (d ? { ...d, activeTurnId: null } : d));
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.chat(conversationId) }),
    qc.invalidateQueries({ queryKey: qk.chatsAll }),
    qc.invalidateQueries({ queryKey: qk.usage }),
    qc.invalidateQueries({ queryKey: qk.images }),
  ]);
}

/** Follow a turn's events until done, from the last sequence number seen. */
async function drive(r: Running): Promise<void> {
  const { api, qc } = deps();
  let ended = false;
  try {
    for await (const ev of api.turns.follow(r.turnId, {
      after: r.lastSeq,
      signal: r.controller.signal,
      transport: "xhr",
    })) {
      if (ev.seq <= r.lastSeq) continue;
      r.lastSeq = ev.seq;
      applyEvent(qc, r.conversationId, r.answerId, ev);
      if (ev.type === "done") ended = true;
    }
  } catch {
    if (!r.controller.signal.aborted) {
      errors.set(r.answerId, "The connection was lost. Open the chat again to see the answer.");
      patchMessage(qc, r.conversationId, r.answerId, (m) => (m.status === "STREAMING" ? { ...m, status: "FAILED", errorCode: "INTERNAL" } : m));
      ended = true;
    }
  } finally {
    // A detached turn stays registered: it is followed again when the app comes back.
    if (!r.detached) {
      running.delete(r.turnId);
      notify();
      if (ended) {
        const took = Date.now() - r.startedAt;
        if (onSlowAnswer) onSlowAnswer(took);
      }
      await finish(qc, r.conversationId);
    }
  }
}

function start(r: Running) {
  running.set(r.turnId, r);
  notify();
  drive(r);
}

export interface SendArgs extends SendMessageInput {
  conversationId: string | null;
  projectId?: string | null;
  /** The attachments as the composer holds them, for the optimistic question. */
  files?: ChatFile[];
}

/** Send a message and stream its answer into the cache. Resolves with the conversation id once the server accepted it. */
export async function sendMessage(args: SendArgs): Promise<string> {
  const { api, qc } = deps();
  const { conversationId, files = [], ...body } = args;
  const started = await api.chats.send(conversationId ?? "new", body);
  const convId = started.conversationId;
  errors.delete(started.assistantMessageId);

  // Optimistic: the question and an empty answer, on the branch being continued.
  const existing = qc.getQueryData<ConversationDetail>(qk.chat(convId));
  const parentId = body.parentId === undefined ? existing?.currentLeafId ?? null : body.parentId;
  const keep: Message[] = [];
  if (existing && parentId) {
    for (const m of existing.messages) {
      keep.push(m);
      if (m.id === parentId) break;
    }
  }
  const replaced = existing?.messages.find((m) => m.role === "USER" && m.parentId === parentId);
  const question: Message = {
    ...emptyAnswer(started.userMessageId!, convId, parentId ?? "", null, false, replaced ? [...replaced.siblingIds, started.userMessageId!] : [started.userMessageId!]),
    parentId,
    role: "USER",
    content: body.content,
    attachments: files,
    status: "COMPLETE",
  };
  const answer = emptyAnswer(started.assistantMessageId, convId, question.id, null, body.webSearch ?? false, [started.assistantMessageId]);
  const now = new Date().toISOString();
  qc.setQueryData<ConversationDetail>(qk.chat(convId), {
    id: convId,
    title: existing?.title ?? (body.content.slice(0, 60) || "New chat"),
    projectId: existing?.projectId ?? args.projectId ?? null,
    pinned: existing?.pinned ?? false,
    archived: false,
    lastMessageAt: now,
    createdAt: existing?.createdAt ?? now,
    currentLeafId: answer.id,
    messages: [...keep, question, answer],
    activeTurnId: started.turnId,
  });
  if (!existing) qc.invalidateQueries({ queryKey: qk.chatsAll });
  start({
    turnId: started.turnId,
    conversationId: convId,
    answerId: answer.id,
    lastSeq: 0,
    controller: new AbortController(),
    detached: false,
    startedAt: Date.now(),
  });
  return convId;
}

/** Regenerate an answer: a new sibling under the same question, streamed into the cache. */
export async function regenerate(conversationId: string, answer: Message, opts: { modelId?: string } = {}): Promise<void> {
  const { api, qc } = deps();
  const started = await api.messages.regenerate(answer.id, opts);
  qc.setQueryData<ConversationDetail>(qk.chat(conversationId), (d) => {
    if (!d) return d;
    const idx = d.messages.findIndex((m) => m.id === answer.id);
    const before = idx >= 0 ? d.messages.slice(0, idx) : d.messages;
    const fresh = emptyAnswer(started.assistantMessageId, conversationId, answer.parentId ?? "", answer.model, answer.webSearch, [
      ...answer.siblingIds,
      started.assistantMessageId,
    ]);
    return {
      ...d,
      messages: [...before, fresh],
      currentLeafId: fresh.id,
      activeTurnId: started.turnId,
    };
  });
  start({
    turnId: started.turnId,
    conversationId,
    answerId: started.assistantMessageId,
    lastSeq: 0,
    controller: new AbortController(),
    detached: false,
    startedAt: Date.now(),
  });
}

/** Rejoin a turn that was running when the conversation loaded (opened mid-answer, or from a push). */
export function resume(detail: ConversationDetail): void {
  const { qc } = deps();
  const turnId = detail.activeTurnId;
  if (!turnId || running.has(turnId)) return;
  if (detail.messages.find((m) => m.id === turnId)?.status !== "STREAMING") return;
  // The stored answer is empty until the turn ends; replaying from 0 rebuilds it.
  patchMessage(qc, detail.id, turnId, (m) => ({
    ...m,
    content: "",
    reasoning: null,
    toolSteps: [],
    sources: [],
    outputs: [],
  }));
  start({
    turnId,
    conversationId: detail.id,
    answerId: turnId,
    lastSeq: 0,
    controller: new AbortController(),
    detached: false,
    startedAt: Date.now(),
  });
}

/** Ask the server to stop a turn (the partial answer is kept). */
export async function stop(turnId: string): Promise<void> {
  await deps().api.turns.cancel(turnId);
}

/**
 * The app is leaving the foreground: stop following every live turn and, when this device
 * can be told, ask the server to push when each answer is ready. Returns the turns armed.
 */
export async function handOffToBackground(canPush: boolean): Promise<string[]> {
  const live = [...running.values()].filter((r) => !r.detached);
  for (const r of live) {
    r.detached = true;
    r.controller.abort();
  }
  if (!canPush || !bound) return [];
  const { api } = bound;
  const armed: string[] = [];
  await Promise.all(
    live.map(async (r) => {
      try {
        const res = await api.turns.notify(r.turnId);
        if (res.state === "armed") armed.push(r.turnId);
      } catch {
        // Best effort: the answer is still saved on the server either way.
      }
    })
  );
  return armed;
}

/** Back in the foreground: follow every detached turn again from where it stopped. */
export function resumeDetached(): void {
  for (const r of [...running.values()]) {
    if (!r.detached) continue;
    start({ ...r, detached: false, controller: new AbortController() });
  }
}

/** Stop following everything (sign-out). Turns go on on the server. */
export function detachAll(): void {
  for (const r of running.values()) {
    r.detached = true;
    r.controller.abort();
  }
  running.clear();
  notify();
}
